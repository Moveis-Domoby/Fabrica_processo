---
titulo: Handoff — SESSAO-11 API Aberta + Módulo de ROTAS
tipo: handoff
data: 2026-08-28
atualizado: 2026-08-28
tags: [handoff, sessao, plataforma, api, rotas, webhooks, d-33]
---

# 📋 Handoff — SESSAO-11 · API Aberta + Módulo de ROTAS (D-33)

**Branch:** `sessao-11-api-rotas` (mesclada na `main` — bloco noturno D-26)
**Banco:** migration 19 aplicada em 28/08 · **Edge Function `api` v1 no ar** (deploy autorizado pelo bloco)
**Demanda:** [[SESSAO-11 - API Aberta e Integracao n8n]] (revisada pela [[PLT - Decisoes de Produto#D-33|D-33]]) · **Memória:** `docs/execucao/SESSAO-11.md`

## 1. O que foi feito

### API aberta (Edge Function `api` + chaves)

- **Chaves de API (Q-50 ✅):** geradas em *Administração → API e integrações* — o valor `pltk_…` aparece **uma vez** (só o sha256 fica no banco), com escopo leitura/escrita; **revogar corta na hora**. `ultimo_uso_em` mostra quem anda usando.
- **Endpoints** (`docs/api.md` com exemplos EXECUTADOS): GET setores/etapas/cards/card/eventos · POST criar card (pedido/unidade, nasce no PCP) · POST mover (**sem estado de qualidade — RF-86**, origem `api`) · DELETE = **arquivamento lógico** (evento `card_arquivado` → some das telas, a história fica — eventos são append-only). Todo evento sai com `dados.integracao` = nome da chave ("via integração X").
- **Execução não é exposta de propósito** — iniciar/finalizar é gesto de pessoa (D-02).
- As regras do domínio continuam nos TRIGGERS (M-14) — a API passa por elas como todo mundo.

### Webhooks de saída (RF-52)

- Cadastro no admin: URL + tipos de evento assinados + segredo opcional (header `X-Assinatura`, HMAC-sha256).
- Trigger **enfileira** cada evento assinado; **pg_net + pg_cron** (habilitados nesta sessão, job `plt-webhooks-despachar` a cada minuto) fazem o POST, com até 5 tentativas. Fila visível no admin.
- **Destino genérico** — nada de ClickUp (D-33): o n8n assina o que quiser.

### ROTAS dentro da plataforma (D-33 — opção B sua)

- Tela **`/rotas`** (menu da logística: admin, PCP, terminais): entregas **por pedido completo** — *aguardando completar* → *pronta para entrega* (quando TODAS as unidades chegam na ROTAS) → *entregue*.
- O card de entrega segue o **formato real** do ClickUp de hoje ([[N8N - ROTAS ClickUp]]): cliente, endereço completo, complemento, OBS, botões **WhatsApp (wa.me)** e **Mapa**.
- **"Entregue"** com confirmação em dois toques → evento `pedido_entregue` (append-only; o banco recusa pedido incompleto e entrega repetida).
- ⚠️ **Marcar entregue aqui NÃO atualiza o Tiny.** A automação ClickUp → Tiny em produção está intocada; ligar a plataforma ao Tiny é decisão sua (candidata: webhook `pedido_entregue` → n8n → `pedido.alterar.situacao`).

## 2. Verificação executada (contra a PRODUÇÃO, com curl)

| Critério | Resultado |
|---|---|
| Chave criada autentica; revogada para de funcionar na hora | ✅ curl: 401 sem chave · 200 com chave · revogação via SQL → **401 imediato** |
| Ciclo completo via API com autor "integração" | ✅ criar card unidade (pedido 13098) → mover PCP→SECC **sem qualidade** → eventos com `origem:"api"` e `dados.integracao` → arquivar |
| Webhook de saída entrega num endpoint de teste | ✅ evento `card_arquivado` → fila → POST no endpoint de eco: **HTTP 200, payload íntegro (card ecoado), header X-Assinatura presente** |
| Documentação validada executando os exemplos | ✅ os exemplos do `docs/api.md` são exatamente os comandos rodados |
| PR + handoff | ✅ merge direto (D-20/D-26) · este documento |

Mais: `test:banco` TUDO VERDE (2 rodadas, **+11 verificações**: fila de webhook com payload completo, despacho guardado sem pg_net, operador não arquiva, projeção do arquivado, rotas aguardando→pronta→entregue, entrega dupla recusada, gate da logística) · tsc · lint · Vitest 23/23 · build ok · pg_net/pg_cron habilitados e job agendado (conferidos por SQL). Cards de teste (10, 11 do pedido 13098) ficaram **arquivados** — invisíveis nas telas, história preservada. Chaves de teste revogadas; webhook de eco desativado.

## 3. Como validar (do zero)

1. Admin → **API e integrações** → gere uma chave → copie (ela não volta).
2. `curl -H "X-Chave-API: <chave>" https://axnzldwgwsmepukdiljx.supabase.co/functions/v1/api/setores`
3. Siga os exemplos de `docs/api.md` (criar unidade num pedido, mover, consultar eventos, arquivar).
4. Revogue a chave no admin → o mesmo curl responde 401.
5. Cadastre um webhook (ex.: um Webhook node do n8n) assinando `movimentacao_setor` → mova um card → o POST chega em até 1 min; a fila aparece no admin.
6. Menu **ROTAS** → mova as unidades de um pedido para a ROTAS → quando TODAS chegarem, o pedido fica "pronta para entrega" → **Entregue** (confirmação) → evento na linha do tempo do card de pedido.

## 4. Decisões provisórias (para você confirmar)

- **Edge Function com `verify_jwt=false`**: a autenticação é a chave própria (o caso previsto para isso) — o n8n só precisa do header `X-Chave-API`. Se preferir exigir também a anon key, é um toggle.
- **Webhook é fire-and-forget** ("enviada" = POST disparado; a resposta HTTP fica em `net._http_response` mas não reprova a entrega). Confirmação de resposta/reentrega inteligente é evolução.
- **Entrega não pede PIN** — é gesto do PCP/admin no computador (D-22). Se quiser PIN também aqui, é o mesmo mecanismo da SESSAO-07.
- **Endereço/contato do cliente na tela ROTAS**: exceção deliberada à regra "zero dado pessoal" — restrita ao grupo da logística; é o que o card do ClickUp já mostra hoje.

## 5. Notas do cofre atualizadas

[[SUPA - Esquema do Banco]] (migration 19 + Edge Function api) · [[000 - ORDEM DAS SESSOES]] · [[000 - MAPA DO PROJETO]] · [[SESSAO-11 - API Aberta e Integracao n8n]] (status).

## Ver também

[[SESSAO-11 - API Aberta e Integracao n8n]] · [[handoff_2026_08_28_sessao10_dashboards]] · [[N8N - ROTAS ClickUp]] · [[PLT - Plano Noturno Sessoes 07-12]]
