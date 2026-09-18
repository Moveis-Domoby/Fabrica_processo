---
titulo: SUPA — Comercial — Cron e Rotinas
tipo: nota
atualizado: 2026-09-17
tags: [comercial, supabase, cron, pg_net, automacao, cutover]
---

# ⏰ SUPA — Comercial — Cron e Rotinas

> [!info] Origem e estado
> Migrada do cofre da loja (`BD - Cron e pg net`) em **17/09/2026**. O que vale hoje: **NENHUM cron comercial existe na fábrica** — decisão deliberada da SESSAO-19 ([[handoff_2026_09_15_sessao19_banco_comercial]]); tudo que roda sozinho no domínio comercial roda **no projeto antigo** (`kfkcumjepnxnnzyvmxfo`, "Painel de recompra"), inclusive o **renovador do token Tiny v3 — o ÚNICO renovador, regra da casa**. No cutover (SESSAO-21) os agendamentos migram conforme a lista exata do §4 e o projeto antigo é desligado.

## 1. O mecanismo

O Postgres chama as Edge Functions de dentro do banco:

```
pg_cron (agendamento)
   └─► net.http_post direto  ou  função tick_*()
          └─► Edge Function (Deno)
                 └─► escreve de volta no banco com service_role
```

Na fábrica, `pg_cron` e `pg_net` já estão habilitadas desde a SESSAO-11 (o despacho de webhooks da plataforma usa exatamente esse mecanismo).

## 2. O que já roda na fábrica

| Job | Cron | Domínio |
|---|---|---|
| `plt-webhooks-despachar` | a cada minuto | **plataforma** (não é do comercial) — despacho da fila `plt_webhook_entregas` via `plt_privado.fn_despachar_webhooks` |

E **só**. `cron.job` conferido na S19: nenhum job comercial. As 6 Edge Functions do comercial estão deployadas e dormentes — ver [[SUPA - Comercial - Edge Functions]].

## 3. O que roda no projeto antigo — estado no projeto antigo (válido até o cutover)

6 jobs, versionados lá em `supabase/cron_agendamentos.sql` (placeholders `<PROJECT_REF>`/`<ANON_KEY>`; desde 2026-09-08 os headers usam a **anon key**, não a service_role — basta para o `verify_jwt` e tira o segredo forte do SQL):

| Job | Cron | Alvo | Propósito |
|---|---|---|---|
| `tiny-auth-refresh-cron` | `0 */3 * * *` | `/functions/v1/tiny-auth-refresh` | 🔴 **renova o token OAuth do Tiny — o job mais crítico do sistema** |
| `enviar-proximo-disparo-cron` | `* * * * *` | `/functions/v1/enviar-proximo-disparo` | um contato por lista por ciclo, respeitando `intervalo_disparo_segundos` |
| `processar-timers-disparo-cron` | `0 * * * *` | `/functions/v1/processar-timers-disparo` | expira `aguardando_resposta` vencidos |
| `verificar-vendas-disparo-cron` | `30 * * * *` | `/functions/v1/verificar-vendas-disparo` | atribuição de venda (30 min após a hora cheia, para o incremental-sync já ter rodado) |
| `tick-incremental-tiny` | `0 * * * *` | `tick_incremental_tiny()` → `/tiny-incremental-sync` | sync de regime dos pedidos do Tiny |
| `tick-auditoria-tiny` | `*/5 * * * *` | `tick_auditoria_tiny()` → `/tiny-auditoria-sync` | pente-fino de 30 dias, 1 página por execução |

As funções `tick_*()` (que fazem o `net.http_post`) existem **só no projeto antigo** e não foram copiadas para a fábrica — não serão necessárias (§4).

> [!danger] Regra da casa — o renovador do token Tiny v3 é ÚNICO
> O refresh token do Tiny é **rotativo** e vale ~24h: quando um lado renova, **invalida o refresh do outro**; mais de 24h sem renovar, o token morre de vez e só volta com um humano reautorizando no ERP. Por isso existe **um único renovador**: hoje, o `tiny-auth-refresh-cron` do projeto **antigo**. A `tiny-auth-refresh` da fábrica está deployada com `verify_jwt` **ligado** exatamente para ninguém a chamar por engano antes da hora. **Nunca deixar os dois renovadores ativos ao mesmo tempo** — a troca é atômica na janela do cutover (§4). (Foi essa mecânica que tornou o cutover Tiny da migração de 2026-09-08 irreversível: quando o projeto novo renovou, o refresh copiado no velho morreu.)

> [!warning] Lição da migração de 2026-09-08 (registrada no handoff da loja)
> Na migração de conta anterior, o `tiny-auth-refresh-cron` foi **esquecido** — recriaram-se 5 jobs dos 7 e o dono é que percebeu, com o token a ~23h da morte. Ao migrar agendamentos: **comparar a CONTAGEM e os NOMES dos jobs com a origem**, não só validar o que foi criado. E **começar pelo auth-refresh**.

## 4. Cutover (SESSAO-21) — a lista exata

### Criar na fábrica (4 jobs)

Na ordem, começando pelo renovador:

1. `tiny-auth-refresh-cron` — `0 */3 * * *` → `/functions/v1/tiny-auth-refresh`. ⚠️ Na fábrica esta function exige JWT: o cron **precisa mandar a anon key no header** (o modelo `cron_agendamentos.sql` do recompra já faz isso) — ou decide-se voltar o `verify_jwt` a desligado no cutover. Anotado na demanda da S21.
2. `enviar-proximo-disparo-cron` — `* * * * *` → `/functions/v1/enviar-proximo-disparo`.
3. `processar-timers-disparo-cron` — `0 * * * *` → `/functions/v1/processar-timers-disparo`.
4. `verificar-vendas-disparo-cron` — `30 * * * *` → `/functions/v1/verificar-vendas-disparo`. ⚠️ O deslocamento de 30 min existia para esperar o `tiny-incremental-sync` da hora cheia; na fábrica a venda entra por webhook do n8n quase em tempo real, então o horário pode ser revisto — **decisão em aberto, manter `30 * * * *` até alguém decidir**.

### NÃO migrar (morrem com o projeto antigo)

- `tick-incremental-tiny` e `tick-auditoria-tiny` — a fábrica **não roda sync do Tiny para o comercial**: `vendas_marketing` é view sobre `pedidos`, alimentado pelo pipeline próprio (webhook Tiny → n8n → `fn_upsert_pedido`). As functions de sync nem foram deployadas na fábrica ([[SUPA - Comercial - Edge Functions]]).
- `tiny-historico-loop` — já não existia nem no projeto antigo (carga histórica concluída em 2026-07-11).

### Pré-requisitos antes de ligar qualquer job

- **Secrets configurados na fábrica**: `TINY_CLIENT_ID`, `TINY_CLIENT_SECRET`, `DATACRAZY_WEBHOOK_TRIGGER_URL`, `DATACRAZY_WEBHOOK_SECRET` (nomes em [[SUPA - Comercial - Edge Functions]] — nunca valores em SQL ou nota).
- **Delta final de dados**: recarga das 6 tabelas com `supabase/manutencao/2026-09-15_carga_comercial.mjs` (reutilizável de propósito) — inclui recopiar o `tiny_auth` fresco na janela.
- **Repontar o webhook do DataCrazy** para a `webhook-datacrazy-resposta` da fábrica (e validar com o primeiro evento em `webhook_eventos_crm`).

### Desligar no projeto antigo (6 jobs — todos)

`SELECT cron.unschedule(...)` de: `tiny-auth-refresh-cron`, `enviar-proximo-disparo-cron`, `processar-timers-disparo-cron`, `verificar-vendas-disparo-cron`, `tick-incremental-tiny`, `tick-auditoria-tiny`. **O renovador do antigo desliga na MESMA janela em que o da fábrica liga** — nunca os dois ativos. Depois de dias estáveis: pausar/deletar o projeto antigo.

### Conferência final

```sql
-- na fábrica, após o cutover: 4 jobs comerciais + plt-webhooks-despachar
SELECT jobid, jobname, schedule, active, command FROM cron.job;

-- histórico de execuções (últimas falhas)
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 50;
```

Comparar **nomes e contagem** contra a lista deste §4 (lição do §3). Atualizar então esta nota e o [[SUPA - Esquema do Banco]].

## 5. Comportamentos herdados a conhecer (valem para os jobs migrados)

- **Falha invisível**: as functions de disparo devolvem sempre HTTP 200 com os erros dentro de `erros[]`, e o `net.http_post` do pg_cron **descarta a resposta**. Uma fila travada roda silenciosamente para sempre. Correção sugerida na loja (nunca feita): tabela `edge_function_runs` com uma linha por execução.
- **Granularidade real do disparo é 1 minuto**: o cron roda 1×/min e envia **um** contato por lista — um disparo de 200 contatos "a cada 10s" leva ~3h20, não os ~33 min que o modal estima.
- No projeto antigo, a renovação sob demanda do token (401 → `renovarToken()` dentro das functions de sync) **não substitui o cron**: num fim de semana sem tráfego ninguém dispara o 401 e o token morre sozinho. Na fábrica não há sync — o cron de 3h é o único mecanismo; ainda mais razão para ele ser o primeiro job criado.

## Ver também

[[SUPA - Comercial - Edge Functions]] · [[SUPA - Comercial - Dominio de Dados]] · [[SUPA - Esquema do Banco]] · [[SUPA - Visao Geral]] · [[handoff_2026_09_15_sessao19_banco_comercial]] · [[PLT - Plano Uniao das Plataformas]] · [[000 - MAPA DO PROJETO]]
