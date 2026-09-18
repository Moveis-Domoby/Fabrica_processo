---
titulo: Handoff — SESSAO-19 União 1 · Banco do Comercial na Fábrica
tipo: handoff
data: 2026-09-15
atualizado: 2026-09-15
tags: [handoff, sessao, plataforma, uniao, comercial, banco]
---

# 📋 Handoff — SESSAO-19 · União 1: Banco do Comercial na fábrica — a 1ª do bloco União (D-46)

**Branch:** `sessao-19-uniao-banco-comercial` (**revisada na conversa e mesclada na `main` pelo PR #3 em 15/09** — D-20)
**Banco:** migration **26** (`20260915120000_plt_comercial_banco.sql`) aplicada em 15/09 com sua autorização na conversa, pela API do Supabase (o host direto do Postgres não resolve da sua rede — sem rota IPv6; mesmo caminho da S15). Impressão digital da integração antes = depois (`82df8df9…`). **6 Edge Functions do recompra deployadas — NENHUM cron agendado.** Carga das 6 tabelas concluída com **checksum idêntico 6/6**.
**Demanda:** [[SESSAO-19 - Uniao 1 - Banco do Comercial na Fabrica]] · **Memória:** `_docs/Plataforma/Execucao/SESSAO-19.md`
**Decisões que regem:** **D-46** (a união) · **D-47** (reutilizar antes de criar) · D-19/regra 2 · regra 4 · RNF-05

## 1. O que foi feito

- **As 6 tabelas do recompra** nasceram na fábrica em DDL idêntico ao banco vivo (enums, constraints, até os índices duplicados de membros): `listas_disparo`, `listas_disparo_membros`, `listas_disparo_eventos`, `webhook_eventos_crm`, `tarifas_mensagem_whatsapp`, `tiny_auth`.
- **`vendas_marketing` virou VIEW** (D-47 — nenhuma tabela nova quando `pedidos` já tem tudo): mesmo shape coluna a coluna, `valor_pedido` = total líquido, `data_compra` à meia-noite de São Paulo, itens no formato que as RPCs leem, nome do cliente pelo snapshot do pedido, telefone com fallback para o celular do cadastro. `vw_clientes_consolidados` e `vw_scorecards_lista` copiadas.
- **As 10 RPCs do recompra** copiadas do banco vivo **sem alterar uma linha do corpo** (só ganharam `search_path` fixado e tiveram o execute revogado do anon — E-11; nenhum número muda).
- **Permissão por módulo (D-46):** `plt_usuarios.modulos` — todos os 3 usuários ganharam `fabrica`; `comercial` começou **só no seu admin**. Usuário novo nasce sem módulos (quem cria concede — o fluxo de criação passa a conceder `fabrica` na SESSAO-20). O gate `fn_tem_modulo` vale para o RLS das tabelas E para a view.
- **RLS no padrão da casa**: módulo `comercial` ou admin nas tabelas de disparo/log; `webhook_eventos_crm` só leitura (quem escreve é a Edge Function); **`tiny_auth` sem NENHUMA policy, de propósito** — o token OAuth do Tiny é segredo de máquina, nem admin lê pelo navegador (regra 4). *Isto desvia do critério "admin lê tudo" — desvio deliberado, para sua confirmação.*
- **6 Edge Functions no ar** (cópia sem fork; a `verificar-vendas-disparo` subiu com sha256 **idêntico** ao do projeto antigo): `enviar-proximo-disparo`, `processar-timers-disparo`, `verificar-vendas-disparo`, `disparar-membro-individual`, `webhook-datacrazy-resposta` (autenticação própria por `x-api-key`, como no antigo) e `tiny-auth-refresh` — esta com **verify_jwt LIGADO até o cutover** (no antigo é desligado): ninguém a chama por engano na fábrica, o renovador continua rodando SÓ no projeto antigo (risco 1 do plano).
- **Carga das 6 tabelas** servidor→servidor por `supabase/manutencao/2026-09-15_carga_comercial.mjs` (4 listas · 128 membros · 288 eventos · 134 webhooks · 2 tarifas · 1 tiny_auth): espelho completo em transação, **checksum idêntico nas 6** — e o token do Tiny **nunca passou por chat, log ou tela**. O script deriva sozinho o pooler IPv4 e é **reutilizável no delta final da SESSAO-21**.
- **Harness `test:banco`**: +16 verificações do Comercial (shape exato da view, gate de módulo, números das RPCs, ciclo de campanha) — TUDO VERDE em 2 rodadas. De quebra: o `supabase-fabrica-schema.sql` estava desatualizado (faltavam as colunas do backfill em `clientes`) e foi espelhado (E-27).

## 2. Verificação executada (critérios da demanda)

| Critério | Resultado |
|---|---|
| Migration testada no harness antes de qualquer conversa de aplicar | ✅ `test:banco` 2 rodadas TUDO VERDE (+16 verificações da S19) |
| Aplicação só com OK explícito | ✅ seu OK na conversa; impressão digital da integração intacta; advisors: único apontamento novo é o `security_definer_view` da `vendas_marketing` — desenho intencional |
| Contagem das 6 tabelas idêntica origem×destino | ✅ e além: **checksum md5 idêntico nas 6** |
| 8 RPCs de dashboard + `fn_filter_customers` com os mesmos números | ✅ com corte do delta do dia: `revenue_chart`, `items`, `top_items` e `fn_vendas_disparo_por_telefone` **byte a byte idênticos** (md5); `scorecards` com receita R$ 4.353.116,28 e 5.299 pedidos **ao centavo** — clientes 4.086×4.088 e recorrentes 807×805: diferença de exatamente 2 = deriva histórica documentada (§3); `freq`/`transitions`/`filter` divergem só por essa mesma identidade + o delta do dia; `vw_scorecards_lista` idêntica (mesmo md5, 4 listas) |
| RLS: anon não lê nem escreve; sem módulo não lê; admin lê | ✅ anon key real recusada em TUDO (6 tabelas, 3 views, RPC — leitura e escrita); gate de módulo provado no harness (sem módulo = vazio; com módulo lê; admin sempre); exceção deliberada: `tiny_auth` fechada até para admin (§1) |
| `tiny-auth-refresh` sem cron | ✅ deployada com verify_jwt ligado; `cron.job` conferido: só o `plt-webhooks-despachar` de sempre |
| Esquema e `.sql` atualizados | ✅ [[SUPA - Esquema do Banco]] (seção migration 26) + `supabase-fabrica-schema.sql` (colunas do backfill) |

## 3. O que você precisa saber

- 🟠 **Deriva histórica de 10 pedidos (0,19%)** entre os dois pipelines — cliente editado no Tiny em momentos diferentes: telefones dos pedidos **8223 e 8711** e nomes de **8546, 8611, 8805, 9062, 9159, 9663, 9881, 12538**. A fábrica usa o dado ATUAL do cadastro; o recompra guardou o snapshot da época. Efeito visível: 2 clientes a menos e 2 recorrentes a mais no dashboard novo — **o número novo é o mais correto** (funde identidades que eram a mesma pessoa). Regra do recompra ("número visível que muda é avisado antes"): este é o aviso.
- 🟠 **O token do Tiny copiado já pode estar defasado** — o renovador do projeto antigo rotaciona a cada ~3h. É esperado e inofensivo: o delta final da S21 (mesmo script de carga) recopia na janela do cutover.
- **Secrets das functions**: configure no dashboard da fábrica quando quiser (`TINY_CLIENT_ID`, `TINY_CLIENT_SECRET`, `DATACRAZY_WEBHOOK_TRIGGER_URL`, `DATACRAZY_WEBHOOK_SECRET`) — sem eles as functions falham ao rodar, o que hoje é inofensivo (nada as chama). Precisam existir antes do cutover.
- **Para a SESSAO-21 (cutover):** a `tiny-auth-refresh` da fábrica exige JWT — o cron novo precisa mandar a anon key no header (o modelo `cron_agendamentos.sql` do recompra já faz isso), ou o verify_jwt volta a desligado no cutover. Anotado na demanda da 21 pelo plano.
- **Congelamento segue (D-46)**: nenhum disparo de WhatsApp em nenhum painel; nada de criar/disparar lista no banco novo até o cutover.
- **Pendência de cofre** (não bloqueia nada): o `supabase-fabrica-schema.sql` ainda não espelha `tiny_fila`/`notas_fiscais`/`contas_receber` do backfill (só as colunas de `clientes` entraram — era o que o harness precisava).

## 4. Como validar (5 minutos)

1. Supabase (Fabrica) → Table Editor: as 6 tabelas novas existem e têm os dados (4 listas, 128 membros…). `tiny_auth` aparece mas **não abre pelo papel anon** — certo assim.
2. SQL Editor: `select * from vendas_marketing limit 5` → os pedidos do Tiny no formato do recompra; `select * from vw_scorecards_lista` → os KPIs das 4 campanhas, idênticos aos do painel antigo.
3. SQL Editor: `select count(*) from fn_filter_customers('{}'::jsonb, 100000, 0)` responde; `select * from fn_dashboard_scorecards('{}'::jsonb)` → compare com o dashboard do painel antigo (diferença esperada: só o delta do dia + os 2 clientes do §3).
4. Edge Functions: as 6 novas listadas, nenhuma com cron; Database → Cron: só `plt-webhooks-despachar`.
5. `plt_usuarios` → coluna `modulos`: seu admin com `{fabrica,comercial}`, os demais com `{fabrica}`.

## 5. Pendente / decisões para você

- **Confirmar o desvio do `tiny_auth`** (fechada até para admin) — ou mando abrir para admin.
- **Secrets** (§3) quando quiser.
- ✅ Merge na `main` feito pelo PR #3 em 15/09, com sua aprovação na conversa.
- Próxima: **SESSAO-20 — Módulo Comercial no Front** (a demanda vira "pronta para code" com esta entregue).

## 6. Notas do cofre atualizadas

[[SUPA - Esquema do Banco]] (migration 26) · `supabase-fabrica-schema.sql` (colunas do backfill) · [[PLT - Memoria de Aprendizado]] (**E-27, A-14, A-15**) · [[000 - ORDEM DAS SESSOES]] · [[000 - MAPA DO PROJETO]] · [[SESSAO-19 - Uniao 1 - Banco do Comercial na Fabrica]] (resultado) · memória de execução `_docs/Plataforma/Execucao/SESSAO-19.md`

## Ver também

[[SESSAO-19 - Uniao 1 - Banco do Comercial na Fabrica]] · [[PLT - Plano Uniao das Plataformas]] · [[handoff_2026_09_08_sessao15_logistica_rotas]] · [[SESSAO-20 - Uniao 2 - Modulo Comercial no Front]] (a próxima)
