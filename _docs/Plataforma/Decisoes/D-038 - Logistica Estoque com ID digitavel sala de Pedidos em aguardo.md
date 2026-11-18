---
id: D-38
aliases: [D-38, D-038]
titulo: "Logística: Estoque com ID digitável, sala de Pedidos em aguardo, Danificados com destino"
tipo: decisao
data: 2026-08-28
status: revisada
revisa: []
revisada_por: ["[[D-058 - O lugar da peca pronta com pedido Pedidos em aguardo|D-58]]", "[[D-156 - A rota aceita QUALQUER pedido vivo o Lancar para ROTAS deixa|D-156]]"]
complementa: []
area: [estoque, expedicao]
tags: [decisao, area/estoque, area/expedicao]
---
# D-38 · Logística: Estoque com ID digitável, sala de Pedidos em aguardo, Danificados com destino (28/08/2026)

**↩️ revisada em 2026-09-27 ([[D-058 - O lugar da peca pronta com pedido Pedidos em aguardo|D-58]]):** Pedidos em aguardo deixou de ser só uma sala (filtro do ESTOQUE) e virou o lugar da peça pronta de pedido, com as abas "Pedidos" e "Produtos reservados".

- **Estoque:** produtos parados, cada um com **ID de produção digitável de formato livre** (o formato definitivo é decisão futura — Q-63).
- **Pedidos em aguardo:** onde unidades prontas esperam o pedido ficar **completo**; completo → **lançar para ROTAS**. Absorve como tela o reagrupamento da expedição.
- **Danificados:** tela própria com tudo que está em DANIFICADO; ações **arquivar** ou **resolvido → escolher destino** (Estoque, ROTAS ou qualquer setor). Tudo evento append-only.
