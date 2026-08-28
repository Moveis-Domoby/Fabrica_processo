# Memória de execução — SESSAO-11 · API Aberta + Módulo de ROTAS

**Branch:** `sessao-11-api-rotas` · **Início:** 2026-08-28 (bloco noturno D-26)
**Demanda:** `_docs/Plataforma/Demandas/SESSAO-11 - API Aberta e Integracao n8n.md` (revisada pela **D-33**: ponte ClickUp MORTA; módulo básico de ROTAS nasce DENTRO da plataforma, agrupamento por pedido completo)
**Decisões que regem:** D-03 (API é o caminho da automação futura) · D-33 · Q-50 ✅ (chave opaca com hash + escopos) · RF-86 (API move sem qualidade) · regras críticas 2–4.

## Task list (espelho da demanda + D-33)

1. [ ] Migration 19: `plt_chaves_api` (hash sha256, prefixo, escopo leitura/escrita, revogável — RLS admin) · tipos `card_arquivado`/`pedido_entregue` · coluna `arquivado_em` (projeção por evento; kanban filtra) · `plt_webhooks` + `plt_webhook_entregas` (fila) + trigger que enfileira · despacho via pg_net + pg_cron (guardado; habilitação em produção) · `plt_fn_rotas` (entregas por pedido completo, com endereço/contato — gate da logística) · `plt_fn_registrar_entrega`
2. [ ] Edge Function `api`: GET setores/etapas/cards/eventos · POST cards (pedido/unidade) · POST mover (origem 'api', SEM qualidade — RF-86) · DELETE (arquivamento lógico) — chave no header, escopos, "via integração X" nos eventos, chave inválida recusada e logada
3. [ ] Admin: gestão de chaves (criar mostra a chave UMA vez; revogar corta na hora) e de webhooks (URL + eventos + entregas recentes)
4. [ ] Tela ROTAS (`/rotas`, gate da logística): entregas por pedido completo (aguardando/pronta/entregue), formato do card real (endereço, contato wa.me, mapa, OBS), botão "Entregue" (evento append-only)
5. [ ] Front: cards arquivados somem das telas
6. [ ] Documentação `docs/api.md` com exemplos executáveis
7. [ ] Testes: harness (chave/hash, arquivar→some, webhook enfileira, rotas pronta/entregue, gates) → 2 rodadas → aplicar → advisors · exemplos da API validados contra a função real
8. [ ] Task list × demanda · merge na main · handoff + memória + continuidade

## Decisões técnicas

- **Chave de API**: valor `pltk_<32 hex>` mostrado UMA vez; no banco só `sha256` (pgcrypto `digest`) + prefixo para identificação. Escopos: `leitura` (GETs) e `escrita` (tudo). Verificação na Edge Function via service role.
- **"Excluir" via API = arquivamento lógico** (eventos são append-only; a linha do card tem FK de eventos): evento `card_arquivado` → projeção `plt_cards.arquivado_em` → todas as leituras filtram. Nada some da história.
- **Webhooks de saída**: trigger enfileira em `plt_webhook_entregas`; o POST real sai por `pg_net` disparado por `pg_cron` (1/min) — os DOIS guardados por existência (o Postgres dos testes não os tem; produção habilita as extensões na aplicação). Assinatura HMAC opcional via `segredo`.
- **Marcar ENTREGUE na plataforma NÃO toca o Tiny** — a automação ROTAS "entregue" → Tiny vive no ClickUp e não se toca (regra crítica); ligar a plataforma ao Tiny é decisão futura do dono. Documentado com destaque no handoff.
- **`plt_fn_rotas` expõe endereço/contato do cliente** — exceção DELIBERADA à regra "zero dado pessoal nas funções": entrega precisa de endereço (é o que o card do ClickUp já mostra hoje); gate restrito à logística (admin/entrada/terminal — D-22/`fn_pode_ver_expedicao`).
- Edge Function `api` fica atrás do gateway do Supabase (anon key no Authorization) + `X-Chave-API` própria — o n8n manda os dois headers; documentado.

## Registro contínuo

- [28/08] Branch criada. Extensões conferidas: pgcrypto instalado; pg_net/pg_cron disponíveis (não instalados — a migration habilita com guarda). Nota [[N8N - ROTAS ClickUp]] relida: formato do card de entrega (nome limpo, endereço, complemento, contato + wa.me, mapa, OBS) replicado na tela de ROTAS.
