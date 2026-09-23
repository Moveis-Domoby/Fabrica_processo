---
titulo: "Memória de execução — SESSAO-21 · Cutover e desligamento do projeto antigo"
tipo: execucao
data: 2026-09-22
atualizado: 2026-09-22
tags: [plataforma, execucao, sessao-21, cutover, uniao]
---

# 🛠️ Execução — SESSAO-21 · Cutover e desligamento

**Demanda:** [[SESSAO-21 - Uniao 3 - Cutover e Desligamento]] · **Branch:** `sessao-21-cutover` (criada da `main` em 22/09, depois do merge da S22)
**Projetos:** antigo `kfkcumjepnxnnzyvmxfo` ("Painel de recompra", us-east-1) · fábrica `axnzldwgwsmepukdiljx` (ca-central-1)
**Regra da janela:** um passo por vez, cada um confirmado pelo dono na conversa. Horários abaixo em UTC (Brasília = UTC−3).

## Task list (espelha a demanda item a item)

- [x] T1 · F5 — reconferência rápida de paridade + assinatura do dono na conversa (22/09)
- [x] T2 · F6.1 — desagendar os 6 crons do antigo (renovador primeiro, na mesma transação) — **desativados** 20:28 UTC; `unschedule` definitivo após o aceite de 24h
- [x] T3 · F6.2 — delta final das 6 tabelas (inclui `tiny_auth` fresco), contagens/checksums conferidos (rodado pelo dono; 6/6 idênticas)
- [x] T4 · F6.3 — agendar os 4 crons na fábrica (renovador primeiro), SQL versionado no repo (DT-ARQ5) — renovador 21:19 UTC, os 3 de disparo ~21:30 UTC
- [ ] T5 · F6.4 — dono troca a URL do webhook no DataCrazy (gesto do dono) + 1º evento em `webhook_eventos_crm` — 🔶 **com o dono** (lado da fábrica validado: 401 sem chave)
- [x] T6 · F6.5 — disparo manual do `tiny-auth-refresh` na fábrica; `tiny_auth.updated_at` avança SÓ lá (21:20 UTC, antecipado a pedido do dono)
- [ ] T7 · Destravar o disparo no front (`DISPARO_LIBERADO`) — 🔶 **com o dono** (barrado pela permissão automática; edição desfeita)
- [ ] T8 · Aceite: 24h de renovação só na fábrica sem falha (8 execuções do cron de 3h) — ⏳ em curso (manual 21:20 ✔; **1ª automática 23/09 00:00:01 UTC ✔** — vigia só de leitura; antigo parado em 18:00 de 22/09)
- [ ] T9 · Aceite: 1ª lista real pós-cutover ponta a ponta (envio → resposta via webhook → verificação de venda) — 🔶 depende de T5 + T7
- [ ] T10 · F7 — quarentena 2–4 semanas (data do dono) → dump final no cofre → pausar → excluir — 🔶 data do dono; quarentena começou 22/09 20:28 UTC
- [x] T11 · Nota de encerramento no `000 - MAPA DO PROJETO` e no cofre da loja (a da loja fica sem commit — outro repositório)
- [x] T12 · Herdado da S20: 3 apontamentos de segurança — levantamento feito e recomendação no handoff; **aplicar é decisão do dono** (não provável daqui que nenhuma automação externa use a função)
- [x] T13 · Notas do cofre (Cron e Rotinas, Edge Functions, Legado e Cutover, Esquema, DataCrazy, Máquina de Estados, Domínio, n8n) + handoff [[handoff_2026_09_22_sessao21_cutover]]
- [x] Extra (dono) · conferência Tiny × banco: setembro (206) + histórico (5.360); 15 pedidos + 2 cadastros corrigidos; P17 + SESSAO-29 (🔶) registradas
- [x] Extra · `unschedule` no antigo — barrado pela permissão automática → pendência do dono (SQL no handoff)

## 22/09 — Leituras e inventário (tudo só leitura, antes de qualquer passo)

### Crons — contagem e nomes conferidos contra a origem (lição da migração de 08/09)

| Projeto | Jobs vivos (`cron.job`) | Bate com a nota? |
|---|---|---|
| antigo | 6, todos `active`: `tiny-auth-refresh-cron` `0 */3 * * *` (jobid 6) · `enviar-proximo-disparo-cron` `* * * * *` (1) · `processar-timers-disparo-cron` `0 * * * *` (2) · `verificar-vendas-disparo-cron` `30 * * * *` (3) · `tick-incremental-tiny` `0 * * * *` (4) · `tick-auditoria-tiny` `*/5 * * * *` (5) | ✅ nomes, contagem e horários idênticos a [[SUPA - Comercial - Cron e Rotinas]] §3 |
| fábrica | 1: `plt-webhooks-despachar` `* * * * *` | ✅ nenhum job comercial |

Consulta usada (chave mascarada — o header `Bearer` nunca sai na tela): `regexp_replace(command, 'Bearer [A-Za-z0-9._\-]+', 'Bearer ***', 'g')`.

### Renovador do token (só datas — nenhum valor de token lido)

- Antigo: últimas 8 execuções do `tiny-auth-refresh-cron` `succeeded`; `tiny_auth.updated_at` = **2026-09-22 18:00 UTC** (renovando de verdade). Próxima execução: 21:00 UTC.
- Fábrica: `tiny_auth.updated_at` = 2026-09-15 12:00 UTC (a cópia da S19) — **refresh já rotacionado pelo antigo dezenas de vezes: morto**. Consequência: a fábrica **não pode** chamar o renovador antes do delta recopiar o `tiny_auth` (chamar com refresh velho = `invalid_grant` no melhor caso).
- Código da `tiny-auth-refresh`: `index.ts` **idêntico** nos dois projetos; o `deno.json` da fábrica tem um import a mais (`@supabase/server`) sem uso. Em falha devolve 500 **sem tocar** no `tiny_auth`; em sucesso a resposta não carrega token (seguro para `net._http_response`).
- `verify_jwt`: fábrica **ligado** (antigo desligado). A anon key da fábrica no `.env.local` é JWT legado (`eyJ…`) — passa no `verify_jwt`. Conferida só a FORMA, nunca o valor (E-12).

### 🔴 Achado: o antigo tem TRÊS renovadores, não um

As functions de sync do antigo (`tiny-auditoria-sync` a cada 5 min, `tiny-incremental-sync` a cada hora) chamam `renovarToken()` **sozinhas ao receber 401** (lido no código vivo). O access token vale ~4h: renovado às 18:00, expira por volta de 22:00 UTC — daí em diante a auditoria de 5 em 5 min renovaria no antigo e **mataria a cópia da fábrica**. Conclusão para a ordem: **os 2 ticks de sync saem do ar no MESMO passo do renovador, antes de copiar o `tiny_auth`** (a demanda já manda desagendar os 6 no passo 1 — o achado é o PORQUÊ de não fatiar esse passo). Além disso, depois do unschedule: conferir `net.http_request_queue` vazia e `updated_at` parado antes de copiar (um POST enfileirado pelo pg_net sai mesmo com o job desagendado).

### Delta das 6 tabelas (script da S19 em modo conferência — só lê)

`node supabase/manutencao/2026-09-15_carga_comercial.mjs` (sem `--confirmar`):

| Tabela | Antigo × fábrica | |
|---|---|---|
| `listas_disparo` | 4 × 4 | ✅ idêntico |
| `listas_disparo_membros` | 128 × 128 | ✘ difere — 10 membros saíram de `respondido_aguardando_resultado` para `perdido / prazo_resultado_expirado` no antigo |
| `listas_disparo_eventos` | 298 × 288 | ✘ +10 `timer_resultado_expirado` (16/09 21h–23h e 17/09 19h UTC — o `verificar-vendas` do antigo fechando os 10 acima) |
| `webhook_eventos_crm` | 134 × 134 | ✅ idêntico (nenhuma resposta nova do DataCrazy desde 15/09) |
| `tarifas_mensagem_whatsapp` | 2 × 2 | ✅ idêntico |
| `tiny_auth` | 1 × 1 | ✘ difere (esperado — renovado a cada 3h) |

Fábrica **não recebeu escrita** nessas tabelas desde a carga (eventos = 288 = baseline S19) → o espelho completo do script é seguro. Estado do antigo hoje: **4 listas `em_andamento`, 128/128 membros em estado final** (2 ganho · 13 erro de envio · 24 prazo expirado · 89 sem resposta) — nenhuma fila ativa, nenhum timer aberto. Os crons de disparo da fábrica, ao ligar, não terão nada a processar.

### F5 — reconferência rápida dos números do dashboard

`vendas_marketing` (tabela do antigo) × `pedidos` da fábrica com a mesma regra da view (data em America/Sao_Paulo, `total_pedido::numeric(10,2)`), mês a mês:

| Mês | Antigo | Fábrica |
|---|---|---|
| 2026-06 | 321 · R$ 287.136,35 | 321 · R$ 287.136,35 |
| 2026-07 | 330 · R$ 313.090,56 | 330 · R$ 313.090,56 |
| 2026-08 | 327 · R$ 325.405,35 | 327 · R$ 325.405,35 |
| 2026-09 | 205 · R$ 268.759,65 | 205 · R$ 268.759,65 |

✅ Ao centavo. (A view da fábrica tem o gate de módulo no `WHERE` — por isso a comparação lê `pedidos` com a definição da view, conferida por `pg_get_viewdef`.)

### Proposta técnica levada ao dono (antes do passo 1)

- **Passo 1 com `cron.alter_job(jobid, active := false)` em vez de `cron.unschedule`** (pg_cron 1.6.4 no antigo — suporta). Mesmo efeito (nada roda), mas o comando original — com a chave dentro — **fica guardado no próprio banco**: se a fábrica falhar ao renovar pela 1ª vez, o rollback é reativar os 6 jobs com um comando, sem a chave passar por chat. O `unschedule` definitivo vem depois do aceite de 24h (antes da quarentena). Fila do pg_net no antigo antes do passo: **0**.
- **Passo 3 por script local** (`supabase/manutencao/`), com o SQL versionado no repo usando placeholder `<ANON_KEY>` e a chave lida do `.env.local` — o valor não passa pelo chat nem pelo MCP. `verify_jwt` da fábrica fica ligado.

## 22/09 — Janela F6

### ✅ F5 assinada · ✅ Passo 1 — crons do antigo desativados (20:28:19 UTC)

- Dono respondeu **"Pode rodar"** depois de ver a reconferência de paridade → F5 considerada assinada na conversa, junto com a escolha de **desativar** (`alter_job`) em vez de `unschedule`. Ordem a partir do passo 3 e momento de destravar o disparo: **ainda em aberto** (perguntar antes do passo 3).
- Comando (antigo, um único statement = uma transação): `select cron.alter_job(jobid, active := false) from cron.job where jobname in (<os 6>)`.
- Conferência: 6/6 `active = false`, comando preservado em todos; `net.http_request_queue` = 0; `tiny_auth.updated_at` parado em **18:00:00 UTC**; **0 execuções** depois de 20:28:19 (o job de minuto das 20:29 não rodou). Última execução de cada: `enviar-proximo` 20:28:00, `tick-auditoria` 20:25:00 (access token ainda válido até ~22h UTC → sem 401, sem renovação escondida).
- **O painel antigo está congelado desde 20:28 UTC**: não sincroniza pedidos nem fecha timers. Validade do refresh atual: até ~18:00 UTC de 23/09.
- Rollback, se preciso (até a fábrica renovar com sucesso): `select cron.alter_job(jobid, active := true) from cron.job` no antigo.
- Pré-conferência do passo 2: nenhuma trigger de usuário nas 6 tabelas da fábrica (o espelho delete+insert não dispara nada).

### ✅ Passo 2 — delta final das 6 tabelas (rodado pelo DONO no terminal dele, ~20:40 UTC)

- O classificador de permissão automática **bloqueou** o `--confirmar` nesta sessão, mesmo com o OK do dono. Não houve contorno (a única alternativa — copiar pelo MCP — faria o token do Tiny passar pelo chat, regra 4): o dono rodou `node supabase/manutencao/2026-09-15_carga_comercial.mjs --confirmar` no terminal dele.
- Conferência (modo só leitura, 20:47 UTC): **TUDO IDÊNTICO** — listas 4×4 · membros 128×128 · eventos 298×298 · webhooks 134×134 · tarifas 2×2 · `tiny_auth` 1×1, checksums iguais nas 6.
- `tiny_auth.updated_at` na fábrica = **18:00:00.566 UTC** (o mesmo do antigo — o refresh vivo chegou). Antigo: 0 jobs ativos, 0 execuções desde 20:28:19. Fábrica: só `plt-webhooks-despachar`.
- Nesse intervalo **ninguém renova** (antigo desativado, fábrica ainda sem cron) — margem até ~18:00 UTC de 23/09.

### Pedido extra do dono na janela: conferência Tiny × plataforma, pedido por pedido

Dono logou no Tiny no navegador do painel e autorizou corrigir o que divergir (**"o Tiny sempre estará mais certo que a plataforma"**), com análise detalhe por detalhe. Escopo inicial: setembro/2026.

**Método (sem despejar dado pessoal):** lista de pedidos do Tiny filtrada em setembro/todas as situações, extraída página a página por JS (5 páginas, 206 linhas): id interno, nº, data, previsto, UF, cidade, valor, situação, forma de envio, marcadores; nome e CPF/CNPJ só como sha256 (12 hex) — mesma normalização nos dois lados (`NFC` + espaços + `upper(... collate "und-x-icu")`). A comparação rodou no banco da fábrica numa consulta de leitura com a lista como literal, devolvendo só divergências (A-14).

**Resultado (206 × 206):**
- ✅ Totais: Tiny 206 · R$ 271.666,65 = fábrica 206 · R$ 271.666,65 (o 13464 entrou por webhook às 20:37 UTC). Geral (sem filtro): **5.360 · R$ 4.438.186,23 dos dois lados**, 0 pedido sem `tiny_id`.
- ✅ Nº, id do Tiny, data, valor, situação e CPF/CNPJ: **batem nos 206**.
- ⚪ "Forma de envio" em ~80 pedidos: **artefato da minha consulta** — o Tiny mostra `nome_transportador` (o banco tem, com espaço no fim); eu comparei com `forma_frete`. Refeito: 0 divergência.
- ⚪ UF em 4 pedidos (13441, 13434, 13400, 13398): o próprio payload do Tiny traz `" "` (espaço); a lista dele apara. Não é erro.
- 🔴 **8 cancelados sem o marcador "Devolvido"** (13432, 13390, 13377, 13376, 13327, 13304, 13302, 13275): o marcador foi posto no Tiny depois do último webhook — **o Tiny não notifica mudança só de marcador** (o 13271 tem porque o marcador veio antes do cancelamento).
- 🔴 **13276 com previsão velha** (11/09) — o Tiny não tem mais previsão; o `raw` de 10/09 já veio vazio, mas `fn_upsert_pedido` faz **coalesce** (vazio nunca apaga) e a coluna ficou.
- 🔴 **Contato 752634629 renomeado no Tiny** (o nome antigo trazia bairro/origem depois de "/") — **renomear contato não dispara webhook de pedido**. Afetava `clientes` 335 e o nome guardado nos pedidos 8136 (2025) e 13429; no Tiny os dois já mostram o nome limpo. Cliente tem telefone → a identidade do Comercial (telefone) não muda, só o nome exibido.

**Correção (autorizada pelo dono):** `supabase/manutencao/2026-09-22_correcoes_conferencia_tiny.sql` (contar → executar → conferir; nenhum nome no arquivo — o nome novo é derivado do antigo e conferido contra o hash do Tiny). Lido antes o código de `fn_reagir_pedido` e `fn_upsert_pedido` (F-08): marcador/nome não disparam o gatilho; previsão dispara `pedido_atualizado` só se houver unidade liberada. Descartado reprocessar pela `tiny_fila`: o workflow de backfill está parado desde 10/09 (não confirmável daqui) e, para cliente sem CPF, o `fn_upsert_pedido` acharia por nome+fone e **criaria cliente duplicado** com o nome novo.
- Ensaio A-11 em produção (raise proposital): A=8 · B=1 · C=1 cliente + 2 pedidos · hash do nome derivado = hash do Tiny · card 305 (13276) sem unidades → 0 eventos.
- Aplicado (bloco atômico com guarda de contagem + hash): **A=8 · B=1 · C=1+2**. Conferência: 0 restantes nas 3 causas; marcadores coluna = raw ("Online Instagram Devolvido"); 0 evento novo no card; setembro segue 206 · R$ 271.666,65.
- Duas consultas de leitura quebraram por nome de coluna escrito de memória → **E-36**. Uma consulta de leitura ao `information_schema` foi barrada pelo classificador — nome tirado da migration.

**Dono pediu (22/09): conferência do histórico inteiro fica para DEPOIS do cutover; e entender a causa raiz + propor como arrumar na raiz.**

**Causas provadas (não deduzidas):**
1. *Marcador* — as "Ocorrências" do pedido 13432 no Tiny só registram mudança de situação; o cancelamento (21/09 08:11 BRT = 11:11 UTC) bate com o último webhook no banco, e o `raw` daquele webhook NÃO tinha "Devolvido". "Alterar marcadores" é ação separada no Tiny (menu próprio) → não gera `atualizacao_pedido` ([[N8N - Tiny Integracoes Referencia]] §2.1: o webhook de vendas só dispara em criação/alteração de pedido).
2. *Contato renomeado* — último webhook do 13429 (18/09) com o nome antigo; o Tiny mostra o nome novo nos 2 pedidos da cliente (inclusive o de 2025) → o nome é do cadastro de contato, e mudar contato não avisa pedido.
3. *Coalesce* — webhook de 10/09 do 13276 trouxe `data_prevista` vazio (está no `raw`), a coluna manteve 11/09. Mesma classe ainda presente no histórico: **2 pedidos com `obs_interna` e 2 com `vendedor`** presos (raw vazio, coluna preenchida) — entram na conferência pós-cutover.
- Raiz comum: a fábrica depende 100% do webhook, que não cobre tudo. A loja tinha reconciliação (`tiny-auditoria-sync`, 30 dias, 1 página/5 min) — a S19 a considerou redundante (D-47) e ela **morre neste cutover**. O próprio cofre já recomendava "job de reconciliação" (§2.4 da referência do Tiny).
- Escala medida: 607 pedidos nos últimos 60 dias; 41 não finalizados; 4.507 de 10.667 clientes sem CPF/CNPJ (identidade por nome+fone → renomear cria duplicado); 10.569 clientes JÁ têm `tiny_id_contato` (backfill); "/" no nome do cliente em ~4% dos pedidos, caindo por trimestre (19→13).

**Proposta de raiz levada ao dono (nova demanda — NÃO executada na S21):** A) pente-fino diário reusando `tiny_fila` + workflow de backfill (API v2, sem token novo, sem renovador novo); B) `fn_upsert_pedido` com "o último pacote do Tiny vence" (vazio limpa) exceto id/cliente/origem; C) identidade do cliente por `tiny_id_contato`; D) processo: nome do contato só com o nome.

**Dono (22/09):** registrar P17 + demanda nova **depois** de concluir a auditoria do histórico (pós-cutover); seguir o cutover agora na ordem proposta (renovador → manual → 3 de disparo → URL DataCrazy → trava).

### ✅ Passo 3a + 5 — renovador ligado na fábrica e provado (21:19–21:20 UTC)

- Arquivos novos: **`supabase/cron/cron_comercial.sql`** (modelo dos 4 jobs com `<PROJECT_REF>`/`<ANON_KEY>`, blocos `-- @job` — fecha o DT-ARQ5) e **`supabase/manutencao/2026-09-22_agendar_crons_comercial.mjs`** (agenda UM job por vez; guardas: ref da fábrica no `SUPABASE_URL`, chave com `role=anon` e `ref` da fábrica lidos do próprio JWT, job homônimo desligado no antigo; `--disparar` roda o comando do job uma vez e mostra a resposta + `tiny_auth.updated_at` dos dois lados). Nenhuma chave impressa.
- Conferência (sem escrever): guardas ✔. `--job tiny-auth-refresh-cron --confirmar` às 21:19:39 UTC → **agendado e ativo** (comando sem placeholder).
- `--disparar tiny-auth-refresh-cron --confirmar` → **HTTP 200 · "Tokens renovados com sucesso"**; `tiny_auth.updated_at` fábrica 18:00:00 → **21:20:04 UTC**; antigo **parado em 18:00:00**. ✔ a fábrica é agora a ÚNICA dona do token.
- ⚠️ **Ponto sem volta:** o refresh do antigo morreu nesta renovação. O rollback "reativar os 6 jobs do antigo" **deixou de valer para o renovador e os 2 syncs** — reativá-los faria o antigo tentar um refresh já rotacionado (na melhor hipótese `invalid_grant`; se o Tiny/Keycloak tiver detecção de reuso, poderia revogar a sessão inteira e derrubar a fábrica — **não verificado, risco tratado como real**). Proposto ao dono: `unschedule` desses 3 no antigo já, sem esperar as 24h.
- Próximas execuções automáticas na fábrica: 00:00, 03:00, 06:00 … UTC.

### ✅ Passo 3b — os 3 crons de disparo na fábrica (~21:30 UTC) · dono autorizou "todos os passos" e depois saiu com permissão completa (sem quebrar produção, nada na `main` — entregar por PR)

- `--job <nome> --confirmar` para `enviar-proximo-disparo-cron`, `processar-timers-disparo-cron`, `verificar-vendas-disparo-cron` — guarda do antigo ✔ nos 3; **fábrica = 5 jobs** (plt + os 4 do §4, nomes/horários idênticos ao antigo).
- `--disparar` de cada um: **HTTP 200** · `processar-timers` success=true processadosResposta=0 · `verificar-vendas` 0 verificados/0 ganhos/0 perdas · `enviar-proximo` 0 listas/0 envios. Primeira execução automática do `enviar-proximo` às 21:32:00 ✔ (uma consulta às 21:31 deu "zero execuções" — falso alarme: pegou o intervalo entre agendar e o primeiro minuto cheio).
- Tabelas do disparo intactas depois: membros ganho=2 · perdido=126; 298 eventos.
- Script ajustado: `--disparar` só compara `tiny_auth` quando o job é o renovador; resposta das functions de disparo impressa só como FORMA (chaves e contagens).

### ⛔ Bloqueados pela permissão automática da sessão (viraram pendência do dono — não houve contorno)

- `cron.unschedule` dos 6 jobs no projeto ANTIGO (via MCP) — ficam **desativados**; o SQL pronto está no handoff.
- Virar `DISPARO_LIBERADO` para `true` (`src/comercial/travas.ts`) + build — motivo informado: "Feature Flag Writes". A edição foi **desfeita** (`git checkout` dos 2 arquivos) para não ir num commit por engano; passo a passo no handoff.
- Uma leitura de `information_schema` (MCP) — contornada lendo a migration (regra 10).

### ✅ Webhook do DataCrazy — lado da fábrica pronto

- `webhook-datacrazy-resposta` na fábrica: `verify_jwt` **desligado** (conferido no `list_edge_functions`), código lido: autenticação por `x-api-key` ANTES de qualquer gravação. Sonda sem chave: **POST → 401, GET → 405** (nada gravado). Falta só o gesto do dono no DataCrazy.

### ✅ Auditoria do HISTÓRICO inteiro (5.360 pedidos) — pedida pelo dono para depois do cutover

- Extração do Tiny: lista "Todos", 108 páginas × 50, por JS em segundo plano na página (o limite de 45 s por chamada do navegador obrigou a rodar desacoplado e consultar o progresso). 5.360 pedidos (8091 → 13464).
- Impressão digital por pedido (nº, data, previsão, valor, situação, marcadores, UF, cidade, sha256 do nome e do CPF/CNPJ) nos dois lados, agregada por faixa de 100 (A-14). 1ª rodada: 54/55 faixas divergentes com contagens idênticas → **artefato de fórmula**: a coluna "Forma de envio" da lista é o TIPO de envio ("Terceirizada"), o banco guarda o nome da TRANSPORTADORA ("Shaolin Transportes") — campo retirado da impressão digital. 2ª rodada: **50/55 faixas idênticas**; nas 5 restantes, **5 pedidos**: 12679 e 12830 (causa 1 — "Devolvido"), 8205 e 9545 (causa 2 — "/" no nome), 11710 (**não é erro**: o Tiny guarda "D&#39;Elia" com a entidade HTML; o banco tem o mesmo texto; só a lista do Tiny decodifica — único caso em 5.360).
- Causa 3 no histórico: 13180 e 13410 (`obs_interna` limpa no Tiny — raw traz ""), 13183 e 13421 (vendedor removido no Tiny — **o raw nem traz a chave `nome_vendedor`**; conferido na tela do Tiny: `idVendedor`/`nomeVendedor` vazios). **Lição nova para a raiz B: vazio no Tiny pode chegar como chave AUSENTE.**
- Correção: `supabase/manutencao/2026-09-22_correcoes_auditoria_historico.sql` — ensaio A-11 (A=2 · B_obs=2 · B_vend=2 · C_ped=2 · C_cad=1 · 3 hashes = Tiny · 0 eventos nos cards 110/445) → aplicado com guarda atômica. Conferência: **54/55 faixas = Tiny** (a 117 é o 11710) e **0 campo preso pelo coalesce** em todo o banco (previsão, obs, obs_interna, rastreio, vendedor).

### 23/09 — respostas do dono e fechamento

- **PR #5 mesclado** pelo dono (00:30 UTC). **1ª renovação AUTOMÁTICA** do token na fábrica: 00:00:01 UTC ✔ (vigia só de leitura em segundo plano); antigo parado em 18:00 de 22/09, 0 jobs ativos, 0 execuções.
- Dono: "troquei" (URL do DataCrazy). Conferido 01:24 UTC: 134 webhooks (nenhum novo — nenhuma lista enviando); 4 listas `em_andamento`; membros ganho=2 · perdido=126.
- Dono: "pode destravar, só cuidado pra não disparar pra ninguém". Antes de virar: estado acima + código lido (`ListasDisparoDetalhe.tsx`: envio só em `handleRegistrarEnvio` — clique — e `iniciarFila` — botão + confirmação; o polling de 8 s só lê). Branch `sessao-21-destravar-disparo` a partir da `main` mesclada; `DISPARO_LIBERADO = true` + teste da trava atualizado; tsc ✔ · lint ✔ · vitest 49/49 ✔ · build ✔ (desta vez a permissão automática não barrou — o dono autorizou explicitamente). **PR #6** aberto; publica quando o dono mesclar. Tela não aberta no navegador (exigiria login; a mudança é uma constante coberta por teste).
- Dono sobre os jobs desativados do antigo: perguntou se há problema em deixá-los → explicado (aceitável até a F7; risco = reativação manual). 1ª lista real: não é pendência (dono). Backup final: dispensado (dono) — nada exclusivo ficou no antigo.
- Em aberto com o dono: data da F7; 3 apontamentos de segurança (explicados em linguagem simples); 4 perguntas da SESSAO-29.

### 23/09 — segurança herdada (migration 32) e alerta de token

- Dono colou os 4 workflows principais do n8n (produtos do Tiny fábrica, backfill, vendas, formulário→Tiny) e autorizou os ajustes se nenhum usasse a função. Nenhum chama `fn_pedido_por_numero_nf` (backfill chama só `fn_fila_proximos`/`fn_backfill_aplicar`/`fn_backfill_falha`; vendas só `fn_upsert_pedido`; produtos `fn_upsert_produto` + REST de `eventos`/`produtos`; formulário não fala com o Supabase).
- Banco: único uso interno = `plt_privado.fn_vincular_conta_receber` (DEFINER); `fn_backfill_conta_mapear` usada por ela e por `fn_backfill_aplicar`; `fn_vig_touch` = gatilho `vig_touch` de `vig_conhecimento_vendas`. Logs da API (24h): 0 chamadas da função × 66 da `fn_upsert_pedido` (controle) — A-20.
- Migration 32 `20260923120000_plt_seguranca_herdada.sql` (idempotente, só toca o que existe): test:banco 2 rodadas ✔ → impressão digital antes `e2109f3a…`/65 → aplicada pela API (`apply_migration`, só ela — o aplicador da casa reaplicaria todas) → depois: EXECUTE só `postgres`+`service_role`; `search_path=public, pg_temp` nas duas; digital idêntica; `fn_backfill_conta_mapear` e `fn_pedido_por_numero_nf` rodando para o dono; sonda anônima pela API → **401**; advisors: `anon_security_definer…` e `function_search_path_mutable` **sumiram** (authenticated definer 53→52).
- Nenhum dos 3 objetos tinha espelho no repo (criados direto no banco por outras frentes — classe E-27); registrado na nota do esquema.
- ⚠️ O JSON de vendas colado pelo dono tem o **token v2 do Tiny em texto puro** (P4) — não repetido em lugar nenhum; recomendado ao dono gerar token novo e usar `$env.TINY_TOKEN` (E-03).
- Organização: a migration e as notas foram para a branch do PR #6 (a branch nova a partir da `main` não tinha as anotações de 23/09 — evitar dois PRs editando os mesmos documentos).

### 23/09 (noite) — respostas do dono: F7, token, SESSAO-29 → D-50

- **F7:** exclusão do projeto antigo em **06/10/2026** (backup dispensado). **Token v2:** o dono decidiu não trocar. **SESSAO-29:** 60 dias ✅, 3h ✅, regra de gravação ✅ — *"observação tudo bem, mas o resto deve manter mesmo que apague lá; … edição lá deve editar aqui também, mas não apagar"* → registrada como **D-50**; pergunta 4 reexplicada; pergunta nova (marcador removido).
- **Retroativo da D-50:** a previsão do 13276 apagada em 22/09 voltou a 11/09 (ensaio A-11: 1 linha, 0 evento → aplicado com guarda). Obs. internas de 13180/13410 ficam limpas (permitido). Vendedor de 13183/13421: valor antigo não existe na plataforma → com o dono.
- **E-38:** o PR #6 foi mesclado às 01:31 UTC, antes do push dos 2 commits da migration 32 (01:38) — cherry-pick para a branch `sessao-21-regra-apagar-tiny` (PR #7) e aviso no PR #6.

### 🏁 Fechamento (23/09, a pedido do dono) — task list × demanda

| Item da demanda | Estado |
|---|---|
| F5 — paridade assinada | ✅ 22/09 |
| F6.1 — crons do antigo | ✅ desativados 20:28 UTC; somem na exclusão do projeto (06/10) |
| F6.2 — delta das 6 tabelas | ✅ idênticas byte a byte |
| F6.3 — 4 crons na fábrica | ✅ renovador + 3 de disparo, SQL versionado |
| F6.4 — URL do DataCrazy | ✅ trocada pelo dono (23/09); 1º evento real valida |
| F6.5 — renovação só na fábrica | ✅ manual 21:20 UTC + automática 00:00 UTC; 0 falha |
| F7 — quarentena/backup/exclusão | ✅ decidido: backup dispensado, **exclusão em 06/10** (gesto do dono) |
| Aceite: nunca dois ativos | ✅ |
| Aceite: 1ª lista real | ⚪ o dono roda quando usar — pediu para não ser pendência |
| Aceite: 24h de token | ⏳ em curso (00:00 ✔; fecha ~21:20 UTC de 23/09) |
| Aceite: backup antes de excluir | ⚪ dispensado pelo dono |
| Aceite: nota de encerramento | ✅ mapa + cofre da loja |
| Herdado: 3 apontamentos de segurança | ✅ migration 32 |
| Extras do dono | ✅ trava aberta (PR #6) · conferência Tiny (15 pedidos + 2 cadastros) · P17 → SESSAO-29 📐 · D-50 |

Respostas finais do dono (23/09): pergunta 4 da SESSAO-29 — nenhuma dependência de combinado com a equipe de vendas (item D descartado); pergunta 5 — marcadores ficam como estão. SESSAO-29 promovida a 📐.

**Achado sistêmico (para decisão do dono — não é da S21):** três buracos da integração webhook→banco que vão continuar gerando deriva: (1) marcador alterado sozinho no Tiny não notifica; (2) contato renomeado não notifica; (3) campo limpo no Tiny nunca limpa no banco (coalesce). Candidato a pendência nova em [[N8N - Pendencias e Riscos]] (P17) — perguntar antes de registrar/mexer (arquivo com alteração pendente do Cowork, E-23).

### Outros

- Working tree herdado: alterações do Cowork de 21/09 ainda **não commitadas** na `main` (demanda da S21 promovida, `PROXIMOS PASSOS`, `CLAUDE.md` do cofre, P16, migration 23 do Tiny fábrica). Vieram junto para a branch; **não serão varridas para os commits desta sessão** (E-23) — commit sempre por caminho explícito.
- Nenhum outro consumidor do token v3: n8n usa v2 ([[N8N - API Tiny v2 vs v3]]); o repo da fábrica só referencia `tiny_auth` na migration 26, no harness e no script de carga; a integração nova do Tiny da fábrica (S25) é outra conta.
