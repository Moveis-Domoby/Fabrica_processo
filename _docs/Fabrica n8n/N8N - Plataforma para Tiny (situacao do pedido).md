---
titulo: n8n — Plataforma → Tiny (situação do pedido)
tipo: workflow
atualizado: 2026-10-09
tags: [n8n, tiny, rotas, entregue, plataforma, sessao-30]
---

# n8n · Plataforma → Tiny (situação do pedido)

**Criado em:** 08/10/2026 (SESSAO-30, etapa 4 — D-113). **Status: NO AR desde 09/10/2026 ~01:15 (Natal) — DENTRO da automação existente "subir banco de dados --- tiny -> supabase" (`Rzm3N1bKnhsgGfav`), como uma 2ª parte com gatilho próprio (D-123).** A chave "Entregue vai ao Tiny" continua **desligada** — ligar e a prova com 1 pedido real são do dono.
**Arquivo de referência:** `domoby-plataforma-tiny-situacao.json` (nesta pasta — **sem segredo nenhum**: o token do Tiny vem da variável **`TINY_TOKEN`** do n8n — a conta 1, da **loja** Domoby, onde moram os pedidos de venda; o Supabase, de `SUPABASE_FABRICA_URL`/`SUPABASE_FABRICA_KEY`).

> [!warning] ↪️ 09/10 — a chave estava trocada no arquivo de 08/10
> O arquivo nasceu com `TINY_FABRICA_TOKEN` (a conta da **fábrica**, de produtos e estoque). Os pedidos de venda moram na conta da **loja** (`TINY_TOKEN` — a mesma com que a fila lê pedidos e contas todo dia; o fluxo de vendas e o do ClickUp usam a mesma chave, escrita no nó). Com a da fábrica, todo pedido daria "não encontrado". Corrigido no arquivo e no n8n antes de publicar.

> **O que faz:** quando alguém registra a entrega na plataforma (ROTAS → Entregas, e o entregador na SESSAO-30 etapa 5), o Tiny fica **"Entregue"**; quando a entrega do dia é **desfeita**, o Tiny volta para a situação de antes. É o terceiro caminho do "fluxo bifurcado" do dono (resposta 8): Tiny → plataforma (fluxo de vendas, já existia) · ClickUp → Tiny → plataforma (o fluxo antigo, [[N8N - ROTAS Entregue para Tiny]], **intocado**) · **plataforma → Tiny (este)**. O ClickUp só avisa, nunca recebe.

## Como funciona (sem relógio — Lei de Desempenho §4)

1. A entrega registrada na plataforma põe o pedido na **fila do banco** (`plt_tiny_pedido_fila`, uma linha por pedido — a última vontade vale, com versão) e o banco **chama este webhook na hora** (pg_net, sai depois do commit).
2. O fluxo valida o pedido, acha o id do Tiny pelo número quando o banco não tem (`pedidos.pesquisa`, como o fluxo do ClickUp), chama `pedido.alterar.situacao` (tempo limite de 15 s) e **devolve o resultado** ao banco (`plt_fn_tiny_pedido_resultado`, só a chave de serviço).
3. O banco: OK → sai da fila (e fica na trilha `tiny_situacao_alterada`); erro → nova tentativa com **espera crescente e sorteio** (1, 2, 4… min, teto de 1 h), por um relógio que **só existe enquanto há pedido esperando** e se desagenda sozinho; **disjuntor** (5 pedidos com erro e nenhum OK em 15 min = pausa de 15 min); **8 erros = parado** + aviso ao super admin, que manda de novo em Configurações → Caminhões.
4. Sem eco: o Tiny "Entregue" volta pelo fluxo de vendas, mas a entrega já existe aqui — nada se repete.

**A chave:** Configurações → Caminhões → **"Entregue vai ao Tiny"** — nasce **desligada**; só o super admin liga. Desligada, a plataforma não manda nada ao Tiny.

## Nós

`Webhook · situação do pedido` (POST, caminho `11118300-48bf-416f-be4d-95a58d0a106b` — o endereço já está cadastrado em `plt_webhooks`, evento `tiny_pedido_situacao`) → `Validar pedido` → `Tem o id do Tiny?` → (sim) `Tiny · pedido.alterar.situacao` / (não) `Tiny · pedidos.pesquisa` → `Achar o id pelo número` → `Achou?` → `Tiny · pedido.alterar.situacao` → `Montar resposta` → `Supabase · resultado`. Não renomear `Validar pedido` (os códigos o leem pelo nome).

## Como entrou no ar (09/10, Claude pela API do n8n — D-123)

- A API do n8n passou a escrever (o dono trocou a chave em 09/10). O fluxo **não virou automação nova**: entrou como 2ª parte da "subir banco de dados --- tiny -> supabase" — os **8 nós de antes foram IDÊNTICOS** (comparação automática antes e depois de salvar, ligações também), + os 9 nós daqui (posições abaixo, com uma nota "Plataforma → Tiny") + o gatilho `11118300-…`.
- ⚠️ Na API do n8n 2.x, **salvar uma automação publicada a republica na hora** — por isso: cópia da versão publicada guardada e o `versionId` anterior anotado para voltar (`POST /workflows/{id}/activate` com o `versionId` antigo — **`4d0b5e79-56f4-43bd-976a-4fba61a6d100`**, a versão só com a fila, de antes de 09/10).
- Provas: os dois gatilhos responderam 200 a um envio vazio (o novo para em "Validar pedido" — não chama o Tiny); nenhuma execução com erro; a parte antiga releu de verdade um pedido (13625) pela fila depois da troca.

## Para ligar — com o dono

1. ~~Importar e publicar~~ — feito (acima).
2. ~~Conferir a conta~~ — é a da loja (`TINY_TOKEN`).
3. ~~Ligar "Entregue vai ao Tiny"~~ — **ligada pelo dono em 09/10, 01:29 (Natal).**

> [!success] **Prova (09/10, 01:30 Natal, pedido do dono — "liguei a chave, testa com o pedido 13470"):** a chave ligada às 01:29; o 13470 (entregue de fato em 25/09, já "Entregue" no Tiny) entrou na fila de envio com o mesmo gesto do botão "Entregue" → o banco chamou o gatilho → o n8n pediu `pedido.alterar.situacao` = entregue com a chave da loja → **o Tiny respondeu OK na 1ª tentativa, ~1 s** → a fila esvaziou, ficou a trilha "situação alterada no Tiny" e o "último OK" da chave. Releitura do 13470 pelo Tiny logo depois: **"Entregue"**, nada mudou no pedido.
4. **A prova com 1 pedido real:** registrar a entrega de um pedido que já foi entregue de verdade → no Tiny ele fica "Entregue" em segundos (e a fila esvazia). Se não, o erro aparece no cartão da chave.
5. Desfazer (opcional): "Desfazer" na ROTAS com o motivo "Marquei entregue por engano" → o Tiny volta para "Enviado".

Relacionado: [[N8N - ROTAS Entregue para Tiny]] · [[N8N - Tiny Integracoes Referencia]] · [[SESSAO-30 - Producao de Ponta a Ponta - Pedido Reabastecimento e Entrega]] · [[PLT - Decisoes de Produto]] (D-113).
