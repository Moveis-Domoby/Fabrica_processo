---
id: D-195
aliases: [D-195]
titulo: "A ENTREGA PARCIAL: o entregador (ou a logística) marca o que foi entregue; o resto volta para a decisão da logística; o Tiny não muda"
tipo: decisao
data: 2026-10-27
status: revisada
revisa: []
revisada_por: ["[[D-325 - Na entrega parcial o que ainda esta na fabrica CONTINUA|D-325]]"]
complementa: ["[[D-129 - Devolucao o entregador nao marca mais Pedido devolvido|D-129]]"]
area: [logistica-rotas]
tags: [decisao, area/logistica-rotas]
---
# D-195 · A ENTREGA PARCIAL: o entregador (ou a logística) marca o que foi entregue; o resto volta para a decisão da logística; o Tiny não muda (27/10/2026, pedido do dono — SESSAO-41) — ↪️ D-129

**Pedido do dono:** *"um botão de opção de entrega parcial (adicionando o que foi entregue do referente pedido e campo de observação)… foi entregue apenas 3 deles e um retornou à fábrica, deve contabilizar o pedido como entregue parcialmente e o produto que retornou deve ficar para decisão do mesmo setor que trata os pedidos devolvidos"* · respostas: *"o próprio entregador pode marcar entregue parcialmente e selecionar um motivo pré-criado em utilitários ou adicionar um campo de observação"* (1); observação obrigatória quando algo volta — "Perfeito" (2); o Tiny não muda (3).

- Botão **"Entrega parcial"** na tela do entregador e em ROTAS → Entregas: as peças do pedido (todas marcadas de início — o comum é desmarcar o que voltou); **motivo da lista (Utilitários → Entrega parcial) e/ou observação — pelo menos um**. Marcadas = entregues (saem de toda conta, como no Entregue); desmarcadas = **voltam para "Em decisão pós devolução"**, com o aviso à logística e a mesma telinha **"Decidir situação"** (reenviar, estoque, realocar, danificados, loja, ajuste).
- O pedido fica **"Entregue em parte (N de M)"** (ficha, entregas do dia). **O Tiny não é chamado.** "Reenviar ao cliente" a peça que voltou reabre a entrega só na plataforma e o pedido volta a ser programado.
- ⏳ **PROVISÓRIAS (escolha do Claude — confirmar):** (a) a entrega parcial **não se desfaz** pelo "Desfazer" (as peças que voltaram já estão com a logística — para corrigir, a logística usa a decisão ou "Pedido devolvido"); (b) peça que a plataforma ainda vê em produção pede a confirmação, como no Entregue; (c) pedido com peça reservada do estoque não aceita entrega parcial (0 hoje) — vai pela logística.

**↩️ Revisada em 16/11/2026 (pedido do dono — SESSAO-51, [[D-325 - Na entrega parcial o que ainda esta na fabrica CONTINUA|D-325]]…[[D-329 - So a logistica o PCP e o admin escolhem Limpar da producao|D-329]]):** a regra acima vale só para as peças **prontas** (Pedidos em aguardo, Expedição, rota) que não foram entregues. O que **ainda está na fábrica** (em setor de produção) não vai mais para a decisão pós devolução: a janela separa "Saíram para a entrega" de "Ainda na fábrica" e pergunta **"Deixar em produção"** (vem marcada — o pedido segue vivo em toda regra) ou **"Limpar da produção"** (as peças saem com registro, sem perder o pedido, e as vagas saem do PCP); a decisão se revoga quantas vezes for preciso na aba "Entregas parciais" do PCP e na ficha do pedido.
