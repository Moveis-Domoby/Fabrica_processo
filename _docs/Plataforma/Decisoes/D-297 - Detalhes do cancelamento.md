---
id: D-297
aliases: [D-297]
titulo: "Detalhes do cancelamento"
tipo: decisao
data: 2026-11-11
status: provisoria
revisa: []
revisada_por: []
complementa: []
area: [pcp]
tags: [decisao, area/pcp, provisoria]
---
# D-297 · ⏳ PROVISÓRIA (escolhas da sessão onde a demanda não dizia) — Detalhes do cancelamento (11/11/2026, SESSAO-48)

1. Toda peça cancelada perde o pedido — também a de pedido cancelado no Tiny e a de pedido removido do PCP (sem vaga de volta e sem aviso) — e guarda de qual era: o card mostra "Era do pedido N".
2. Passar de CANCELADO para NÃO ENCONTRADO (ou o contrário) troca o motivo e mantém a data: os dias contam do primeiro cancelamento.
3. O aviso no PCP fecha também quando o pedido é liberado por inteiro de novo (mesmo sem abrir a janela) e quando a peça volta ao pedido.
4. A peça de móvel do catálogo que perde o pedido fica sem "pai"; a de móvel fora do catálogo guarda o card do pedido (detalhe técnico — [[Memoria - Regras de Negocio - Producao PCP Estoque e Rotas 1#E-254|E-254]]/E-256).
5. Ninguém inicia nem retoma trabalho em peça cancelada: o banco recusa e diz para arrastar de volta.
6. A busca geral acha a peça cancelada (também a arquivada) pelo nome do móvel, com "Era do pedido N"; pelo número do pedido não acha (ela perdeu o pedido) — a janela "O que aconteceu?" do PCP lista as peças canceladas do pedido.
7. O sino do PCP sai a cada peça cancelada de pedido vivo; o acerto manda um só por pedido.
