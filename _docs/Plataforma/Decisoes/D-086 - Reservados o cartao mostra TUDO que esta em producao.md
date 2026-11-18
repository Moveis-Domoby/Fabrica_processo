---
id: D-86
aliases: [D-86, D-086]
titulo: "Reservados: o cartão mostra TUDO que está em produção; a NECESSIDADE conta só o que vem para o estoque; reservados em venda é um número só; a bolinha vermelha leva à decisão do PCP"
tipo: decisao
data: 2026-09-30
status: revisada
revisa: []
revisada_por: ["[[D-118 - Reservados em venda ate a ENTREGA|D-118]]"]
complementa: []
area: [estoque]
tags: [decisao, area/estoque]
---
# D-86 · Reservados: o cartão mostra TUDO que está em produção; a NECESSIDADE conta só o que vem para o estoque; reservados em venda é um número só; a bolinha vermelha leva à decisão do PCP (30/09/2026)

**↩️ revisada em 2026-10-08 ([[D-118 - Reservados em venda ate a ENTREGA|D-118]]):** "reservados em venda" inclui a peça lançada para ROTAS (programada, no caminhão) até o pedido ser entregue.

**Decidido (respostas 3, 5 e 6 do dono em 30/09):**

- **Reservados para produção (o número do cartão)** = a reposição parada no PCP (dentro do prazo) + TODAS as unidades em produção — as sem dono a caminho do estoque (inclusive peça de pedido cancelado — resposta 3) **e os móveis de pedidos** (o exemplo do dono: PCP recusou a peça do estoque e mandou produzir → "1 reservado para produção"). Aparece para todo produto, mesmo fora do Top X.
- **A conta da NECESSIDADE** (`em estoque + reservados < mínimo`) usa só o que **vem para o estoque** — móvel de pedido sai com o pedido, não abastece o galpão.
- **Reservados em venda é UM número** (resposta 6): as peças prontas separadas para pedidos — reservadas no galpão + em Pedidos em aguardo.
- **A bolinha vermelha** no canto do cartão: pedido esperando a decisão do PCP (peça reservada pela venda, pedido ainda não liberado). Tocar **leva direto à decisão** na tela do PCP.
- **O filtro do topo tem 4 posições:** Todos · Necessidade de produção · Reservados para produção · **Com estoque** (novo, resposta 5). A ordem é sempre pela venda; a busca varre o catálogo inteiro.

**Como ficou (técnico):** migration 45 — regra única em `fn_reservados_producao` (para_estoque × exibição), filtros e a bolinha (`pendente_card_id`) em `plt_fn_estoque_produtos`; no PCP, `?liberar=<card>` abre a decisão com uma busca própria página a página no servidor (modal por derivação, sem estado intermediário).
