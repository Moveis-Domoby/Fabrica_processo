---
titulo: BD — Cron Jobs e pg_net
tipo: banco-de-dados
atualizado: 2026-08-06
tags: [banco, cron, agendamento, automacao]
---

# ⏰ BD — Cron Jobs e `pg_net`

## Como funciona o mecanismo

O Postgres chama as Edge Functions **de dentro do banco**, via `pg_net`:

```
pg_cron (agendamento)
   └─► função tick_*()  ou  net.http_post direto
          └─► Edge Function (Deno)
                 └─► escreve de volta no banco com service_role
```

## Jobs versionados — `supabase/cron_agendamentos.sql`

Arquivo de execução manual (placeholders `<PROJECT_REF>` e `<SERVICE_ROLE_KEY>` a substituir no SQL Editor). Todos usam `net.http_post` com `Authorization: Bearer <SERVICE_ROLE_KEY>` e body `'{}'::jsonb`.

| Job | Cron | Alvo | Propósito |
|---|---|---|---|
| `enviar-proximo-disparo-cron` | `* * * * *` (a cada minuto) | `/functions/v1/enviar-proximo-disparo` | envia **um contato por lista por ciclo**, respeitando `intervalo_disparo_segundos` |
| `processar-timers-disparo-cron` | `0 * * * *` (hora cheia) | `/functions/v1/processar-timers-disparo` | expira membros `aguardando_resposta` cujo prazo passou → `perdido / sem_resposta_no_prazo` |
| `verificar-vendas-disparo-cron` | `30 * * * *` (min. 30) | `/functions/v1/verificar-vendas-disparo` | cruza membros `respondido_aguardando_resultado` com vendas |

> [!warning] Acoplamento temporal frágil
> O comentário no próprio arquivo explica o `30 * * * *`: *"Roda 30 min depois do processar-timers para garantir que o `tiny-incremental-sync` já rodou antes."* E admite: *"Ajuste o minuto conforme a cadência do seu incremental-sync."*
>
> Ou seja: **a corretude da atribuição de venda depende do incremental-sync terminar dentro de 30 minutos.** Se o sync atrasar, membros são fechados como perdidos tendo comprado. Isso deveria ser uma dependência explícita (o sync sinaliza conclusão), não um palpite de relógio.

> [!info] Granularidade real do disparo é 1 minuto
> O `DispararModal` aceita intervalos a partir de 10 segundos e estima o tempo total como `n × intervalo`. Mas o cron roda uma vez por minuto e envia **um** contato. Um disparo de 200 contatos "a cada 10s" (estimado: 33 min) leva na prática **~3h20**.

## Jobs referenciados mas NÃO versionados

`tick_historico_tiny()` chama `cron.unschedule('tiny-historico-loop')` — logo existe (ou existiu) um job **`tiny-historico-loop`** agendado **fora do controle de versão**, que se autodesagenda quando `tiny_sync_state.concluido` vira `true`.

Da mesma forma, `tick_incremental_tiny()` e `tick_auditoria_tiny()` só fazem sentido como alvo de jobs `pg_cron`, mas **nenhum agendamento delas está versionado**.

> [!todo] Ação pendente
> Rodar `SELECT * FROM cron.job;` em produção e **versionar o resultado** neste repositório. Hoje ninguém consegue reconstruir o estado de agendamento a partir do git.

## Comandos de inspeção

```sql
-- ver tudo que está agendado
SELECT jobid, schedule, jobname, active, command FROM cron.job;

-- histórico de execuções (últimas falhas)
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC LIMIT 50;

-- desagendar
SELECT cron.unschedule('nome-do-schedule');
```

## O padrão de erro invisível

> [!danger] Falhas nos crons não geram alerta nenhum
> `enviar-proximo-disparo` e `verificar-vendas-disparo` acumulam mensagens em `erros[]` e **sempre devolvem HTTP 200**. O `net.http_post` do `pg_cron` **descarta a resposta**.
>
> Uma fila travada por falha de rede, ou uma atribuição de venda quebrada, roda silenciosamente para sempre. Não há tabela de log de execução para as Edge Functions de disparo (existe `webhook_eventos_crm`, mas só para o *inbound*).
>
> **Correção sugerida:** criar `edge_function_runs (function_name, started_at, finished_at, ok, payload jsonb, erro text)` e gravar uma linha por execução. Um dashboard simples em cima disso resolve o problema de observabilidade inteiro.

## Sem `.limit()` nos loops

`processar-timers-disparo` e `verificar-vendas-disparo` selecionam **todos** os membros elegíveis e iteram com `await` sequencial. Com backlog grande, a function estoura o wall-clock do Deno Deploy no meio do processamento — e o ciclo seguinte **recomeça do zero**, nunca terminando.

Correção: `.limit(N)` + processar em lotes idempotentes.

## Ver também

- [[INT - Edge Functions]] · [[MM - Maquina de Estados do Disparo]] · [[BD - Seguranca e RLS]]
