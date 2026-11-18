---
id: D-220
aliases: [D-220]
titulo: "O PCP e o Estoque falam das mesmas peças com as mesmas palavras"
tipo: decisao
data: 2026-11-04
status: provisoria
revisa: []
revisada_por: []
complementa: ["[[D-078 - A venda reserva a peca na hora o pedido segue no PCP|D-78]]", "[[D-118 - Reservados em venda ate a ENTREGA|D-118]]"]
area: [estoque]
tags: [decisao, area/estoque, provisoria]
---
# D-220 · ⏳ PROVISÓRIA — O PCP e o Estoque falam das mesmas peças com as mesmas palavras (04/11/2026, SESSAO-45 — o vídeo do "PCP mentindo") — ↪️ D-78, D-118

1. O chip do pedido no PCP conta, **por item**, no máximo o que ainda **falta liberar** (antes somava toda peça livre do SKU em todo pedido) e separa: **"N reservada(s)"** (separadas para este pedido quando a venda chegou) **+ "M livre(s)"** (livres no estoque que servem a ele).
2. No cartão e na janela do produto do Estoque, quando há peça reservada pela venda **ainda no galpão**, o número grande passa a se chamar **"livres no estoque"** e aparece logo abaixo **"+ N no estoque reservadas para venda (pedido X)"**. O número grande continua o livre ([[D-078 - A venda reserva a peca na hora o pedido segue no PCP|D-78]]: cai na hora da venda); "reservados em venda" ([[D-118 - Reservados em venda ate a ENTREGA|D-118]]) continua a soma de sempre.
3. O que a plataforma não sabe é se a peça está fisicamente no galpão: a contagem é da logística ([[D-070 - O estoque dos acabados e a CONTAGEM da logistica entrada|D-70]]). Se a peça usada do estoque não existir, a Expedição registra pela [[D-219 - A Expedicao LIBERA a peca pronta para outro pedido|D-219]] ("não foi para um pedido" + o motivo) e o pedido volta ao PCP — a peça fantasma sai das contas.
