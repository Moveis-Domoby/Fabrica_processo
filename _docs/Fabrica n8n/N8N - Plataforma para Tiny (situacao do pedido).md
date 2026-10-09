---
titulo: n8n — Plataforma → Tiny (situação do pedido)
tipo: workflow
atualizado: 2026-10-08
tags: [n8n, tiny, rotas, entregue, plataforma, sessao-30]
---

# n8n · Plataforma → Tiny (situação do pedido)

**Criado em:** 08/10/2026 (SESSAO-30, etapa 4 — D-113). **Status: pronto para importar — ainda NÃO está no n8n.**
**Arquivo importável:** `domoby-plataforma-tiny-situacao.json` (nesta pasta — **sem segredo nenhum**: o token do Tiny vem da variável `TINY_FABRICA_TOKEN` do n8n, a mesma do fluxo do estoque; o Supabase, de `SUPABASE_FABRICA_URL`/`SUPABASE_FABRICA_KEY`).

> **O que faz:** quando alguém registra a entrega na plataforma (ROTAS → Entregas, e o entregador na SESSAO-30 etapa 5), o Tiny fica **"Entregue"**; quando a entrega do dia é **desfeita**, o Tiny volta para a situação de antes. É o terceiro caminho do "fluxo bifurcado" do dono (resposta 8): Tiny → plataforma (fluxo de vendas, já existia) · ClickUp → Tiny → plataforma (o fluxo antigo, [[N8N - ROTAS Entregue para Tiny]], **intocado**) · **plataforma → Tiny (este)**. O ClickUp só avisa, nunca recebe.

## Como funciona (sem relógio — Lei de Desempenho §4)

1. A entrega registrada na plataforma põe o pedido na **fila do banco** (`plt_tiny_pedido_fila`, uma linha por pedido — a última vontade vale, com versão) e o banco **chama este webhook na hora** (pg_net, sai depois do commit).
2. O fluxo valida o pedido, acha o id do Tiny pelo número quando o banco não tem (`pedidos.pesquisa`, como o fluxo do ClickUp), chama `pedido.alterar.situacao` (tempo limite de 15 s) e **devolve o resultado** ao banco (`plt_fn_tiny_pedido_resultado`, só a chave de serviço).
3. O banco: OK → sai da fila (e fica na trilha `tiny_situacao_alterada`); erro → nova tentativa com **espera crescente e sorteio** (1, 2, 4… min, teto de 1 h), por um relógio que **só existe enquanto há pedido esperando** e se desagenda sozinho; **disjuntor** (5 pedidos com erro e nenhum OK em 15 min = pausa de 15 min); **8 erros = parado** + aviso ao super admin, que manda de novo em Configurações → Caminhões.
4. Sem eco: o Tiny "Entregue" volta pelo fluxo de vendas, mas a entrega já existe aqui — nada se repete.

**A chave:** Configurações → Caminhões → **"Entregue vai ao Tiny"** — nasce **desligada**; só o super admin liga. Desligada, a plataforma não manda nada ao Tiny.

## Nós

`Webhook · situação do pedido` (POST, caminho `11118300-48bf-416f-be4d-95a58d0a106b` — o endereço já está cadastrado em `plt_webhooks`, evento `tiny_pedido_situacao`) → `Validar pedido` → `Tem o id do Tiny?` → (sim) `Tiny · pedido.alterar.situacao` / (não) `Tiny · pedidos.pesquisa` → `Achar o id pelo número` → `Achou?` → `Tiny · pedido.alterar.situacao` → `Montar resposta` → `Supabase · resultado`. Não renomear `Validar pedido` (os códigos o leem pelo nome).

## Para pôr no ar — com o dono (manhã de 08/10)

1. n8n → **Import from file** → `domoby-plataforma-tiny-situacao.json` → **Publish** (o webhook de produção passa a valer).
2. ⚠️ **Conferir a conta:** o fluxo do ClickUp usa um token escrito no próprio nó; este usa `TINY_FABRICA_TOKEN`. Os pedidos da plataforma são da conta da **fábrica** (CNPJ 27556613000166) — se o primeiro teste disser "pedido não encontrado", a conta está trocada.
3. Plataforma → Configurações → Caminhões → **Ligar** "Entregue vai ao Tiny".
4. **A prova com 1 pedido real:** registrar a entrega de um pedido que já foi entregue de verdade → no Tiny ele fica "Entregue" em segundos (e a fila esvazia). Se não, o erro aparece no cartão da chave.
5. Desfazer (opcional): "Desfazer" na ROTAS com o motivo "Marquei entregue por engano" → o Tiny volta para "Enviado".

Relacionado: [[N8N - ROTAS Entregue para Tiny]] · [[N8N - Tiny Integracoes Referencia]] · [[SESSAO-30 - Producao de Ponta a Ponta - Pedido Reabastecimento e Entrega]] · [[PLT - Decisoes de Produto]] (D-113).
