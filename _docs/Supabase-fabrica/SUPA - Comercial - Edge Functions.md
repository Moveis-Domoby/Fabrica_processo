---
titulo: SUPA — Comercial — Edge Functions
tipo: nota
atualizado: 2026-09-22
tags: [comercial, supabase, edge-function, integracao]
---

# ⚡ SUPA — Comercial — Edge Functions

> [!success] ✅ Pós-cutover (22/09/2026, SESSAO-21) — o que vale hoje
> As 6 functions da fábrica **estão vivas**: os 4 crons as chamam com a anon key (`verify_jwt` segue **ligado** nas 4 — decidido manter; o cron manda o header). **`tiny-auth-refresh` da fábrica é o ÚNICO renovador do token** (1ª renovação: 22/09 21:20 UTC, HTTP 200). `enviar-proximo`/`processar-timers`/`verificar-vendas` provadas com HTTP 200 (nada a processar). `webhook-datacrazy-resposta`: `verify_jwt` desligado, sonda sem chave → 401; falta o dono repontar a URL no DataCrazy. As 9 do projeto antigo seguem deployadas lá, mas **nenhum cron as chama** (projeto em quarentena). Código: `tiny-auth-refresh` idêntico nos dois projetos (o `deno.json` da fábrica tem um import a mais, sem uso).
> O texto abaixo descreve o estado até o cutover.

> [!info] Origem e estado (até 22/09/2026)
> Migrada do cofre da loja (`INT - Edge Functions`) em **17/09/2026**. O que vale hoje: **6 das 9 functions do recompra estão deployadas na fábrica** desde a SESSAO-19 (15/09 — [[handoff_2026_09_15_sessao19_banco_comercial]]), cópia **sem fork** do código vivo, **sem NENHUM cron agendado** e sem secrets configurados — na prática, dormentes até o cutover (SESSAO-21). As 3 functions de **sync com o Tiny** rodam **só no projeto antigo** (`kfkcumjepnxnnzyvmxfo`) e **morrem no cutover** — a fábrica tem pipeline próprio de pedidos. Agendamentos: [[SUPA - Comercial - Cron e Rotinas]]. Dados: [[SUPA - Comercial - Dominio de Dados]].

## 1. As 6 functions no projeto da fábrica

Cópia do código vivo de 15/09 — inclui as reescritas da Fase E de 2026-09-08 (bugs DT-D1…D9 do disparo corrigidos; a `verificar-vendas-disparo` subiu com **sha256 idêntico** ao do projeto antigo). Enquanto o congelamento da união valer (D-46): **nenhum disparo de WhatsApp em nenhum painel**, nada de criar/disparar lista no banco novo.

| Function | Gatilho previsto (pós-cutover) | verify_jwt na fábrica | Estado hoje |
|---|---|---|---|
| `enviar-proximo-disparo` | cron `* * * * *` — motor da fila | default (ligado) | deployada, sem cron, nada a chama |
| `processar-timers-disparo` | cron `0 * * * *` — timer de resposta | default | idem |
| `verificar-vendas-disparo` | cron `30 * * * *` — atribuição de venda | default | idem |
| `disparar-membro-individual` | HTTP do browser (botão "Enviar" da linha) | default | deployada; congelada pela D-46 |
| `webhook-datacrazy-resposta` | POST do DataCrazy (respostas do lead) | **desligado** — autenticação própria por `x-api-key`, como no antigo | deployada; o DataCrazy ainda aponta para o projeto antigo |
| `tiny-auth-refresh` | cron `0 */3 * * *` — renovador do token OAuth do Tiny | **LIGADO de propósito até o cutover** (no antigo é desligado) — ninguém a chama por engano; o renovador roda SÓ no projeto antigo | deployada, sem cron |

### O que cada uma faz (comportamento do código copiado)

- **`enviar-proximo-disparo`** — a cada ciclo: lista as `listas_disparo` em `status='disparando'`, checa `intervalo_disparo_segundos` contra `ultimo_envio_em`, pega o próximo membro `aguardando_envio`, POSTa no gatilho do DataCrazy e atualiza membro (`data_envio`, `prazo_resposta_limite`, `status='aguardando_resposta'`) + `ultimo_envio_em` + evento `envio_registrado`. Fila vazia → lista vira `em_andamento`. Envia **um contato por lista por ciclo** — granularidade real de disparo é 1 minuto, independente do intervalo configurado.
- **`processar-timers-disparo`** — expira membros `aguardando_resposta` com `prazo_resposta_limite` vencido → `perdido / sem_resposta_no_prazo` + evento. **Nota arquitetural deixada no código**: o timer de *resultado* foi removido daqui de propósito e vive só em `verificar-vendas-disparo` (para não marcar perda de quem já comprou antes do dado de venda chegar) — **não reintroduzir**.
- **`verificar-vendas-disparo`** — cruza membros `respondido_aguardando_resultado` com as vendas na janela (`data_resposta` → `prazo_resultado_limite`): achou → `ganho` com `valor_ganho`; não achou e prazo venceu → `perdido / prazo_resultado_expirado`. Desde a Fase E usa a RPC `fn_vendas_disparo_por_telefone` (filtro por telefone no SQL). Na fábrica lê a **view** `vendas_marketing` — ou seja, a atribuição passa a enxergar venda assim que o pedido entra por webhook do n8n, sem esperar sync do Tiny.
- **`disparar-membro-individual`** — envio manual de um membro: valida método/estado (`aguardando_envio`), POSTa no DataCrazy, atualiza o membro. Não atualiza `ultimo_envio_em` nem checa o status da lista.
- **`webhook-datacrazy-resposta`** — inbound: recebe as automações do DataCrazy, loga o payload cru em `webhook_eventos_crm` e marca `data_resposta`/status do membro. Autentica por `x-api-key` (por isso `verify_jwt` desligado). Detalhe no cofre da loja: `INT - DataCrazy` (não migrado ainda).
- **`tiny-auth-refresh`** — renova o par access/refresh em `tiny_auth` (trata o refresh como **rotativo**: sobrescreve os dois). Só renova quando invocada — a proatividade vem do cron. **É a function mais crítica do sistema**: ver a regra do renovador único em [[SUPA - Comercial - Cron e Rotinas]].

> [!note] Estado pré-Fase E nas notas antigas da loja
> A nota `INT - Edge Functions` da loja (atualizada 2026-09-08) descreve bugs que **a própria Fase E de 2026-09-08 corrigiu** nas 4 functions de disparo (CORS ausente/DT-D3, fila travando no contato com erro, fechamento prematuro do `ganho`, match de venda em JS sujeito ao teto do PostgREST) — a nota não foi atualizada após a reescrita. O handoff da Fase E marca DT-D1/D3/D4/D5/D6/D7/D8/D9 como resolvidos; **o comportamento exato pós-fix não está documentado função a função** (incerteza registrada). O código deployado na fábrica é o pós-fix.

## 2. Secrets necessários (nomes — nunca valores)

Configurar no dashboard da fábrica **antes do cutover** (em 15/09 ainda não estavam configurados — sem eles as functions falham ao rodar, o que hoje é inofensivo porque nada as chama):

| Secret | Usado por |
|---|---|
| `TINY_CLIENT_ID` | `tiny-auth-refresh` (OAuth v3 do Tiny) |
| `TINY_CLIENT_SECRET` | `tiny-auth-refresh` |
| `DATACRAZY_WEBHOOK_TRIGGER_URL` | `enviar-proximo-disparo`, `disparar-membro-individual` — ⚠️ o POST de saída **não leva token**: a URL é o segredo (risco herdado do desenho antigo) |
| `DATACRAZY_WEBHOOK_SECRET` | `webhook-datacrazy-resposta` (validação do `x-api-key` inbound) |

## 3. O que roda só no projeto antigo (morre no cutover)

As **3 functions de sync com o Tiny** não foram (e não serão) deployadas na fábrica — `vendas_marketing` lá é view sobre `pedidos`, alimentado pelo pipeline próprio (webhook do Tiny → n8n → `fn_upsert_pedido`, ver [[SUPA - Esquema do Banco]] e [[SUPA - Visao Geral]]):

| Function (só no antigo) | Papel |
|---|---|
| `tiny-historico-mkt` | carga histórica (concluída desde 2026-07-11; a function legada "unificada" aceita `modo` no corpo, mas seu papel hoje é só histórico) |
| `tiny-incremental-sync` | regime: pedidos criados/alterados hoje, upsert por `numero_pedido`; renova token sob demanda em 401 |
| `tiny-auditoria-sync` | reconciliação: janela móvel de 30 dias, 1 página por execução, ponteiro em `tiny_sync_state`; modo ad-hoc `{data_inicial, data_final}` para backfill pontual |

Padrão comum das três: listar pedidos paginado → **N+1** no detalhe de cada pedido (os itens só vivem lá) → upsert em `vendas_marketing` → atualizar `tiny_sync_state`. Com o cutover, esse caminho inteiro (functions + `tiny_sync_state` + funções `tick_*`) é desligado junto com o projeto antigo.

Além delas, **as 6 homônimas do antigo continuam sendo as ativas de verdade** até o cutover: os crons do antigo seguem rodando e o DataCrazy aponta para lá — respostas e ganhos novos entram no banco antigo (o delta vem na carga final da SESSAO-21).

## 4. Observações herdadas do código (dívida conhecida)

- Helpers duplicados entre functions (`normalizarTelefone` em 4, `formatarTelefoneDataCrazy` em 3, `addDiasUteisSemDomingo` em 3) — a atribuição de venda depende de os dois lados normalizarem igual; extrair para `_shared/` segue pendente.
- Erros acumulados em `erros[]` e devolvidos com **HTTP 200** — o `pg_net` do cron descarta a resposta; não há tabela de log de execução das functions (só `webhook_eventos_crm`, para o inbound). Ver o padrão de erro invisível em [[SUPA - Comercial - Cron e Rotinas]].
- Loops de cron sem `.limit()` — backlog grande pode estourar o wall-clock e o ciclo recomeça do zero. ⚠️ Incerto se a Fase E tocou nisso (não listado nos DT-D resolvidos).

## Ver também

[[SUPA - Comercial - Dominio de Dados]] · [[SUPA - Comercial - Cron e Rotinas]] · [[SUPA - Esquema do Banco]] · [[SUPA - Visao Geral]] · [[handoff_2026_09_15_sessao19_banco_comercial]] · [[PLT - Plano Uniao das Plataformas]] · [[000 - MAPA DO PROJETO]]
