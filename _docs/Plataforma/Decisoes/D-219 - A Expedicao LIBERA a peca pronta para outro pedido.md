---
id: D-219
aliases: [D-219]
titulo: "A Expedição LIBERA a peça pronta para outro pedido"
tipo: decisao
data: 2026-11-04
status: provisoria
revisa: []
revisada_por: []
complementa: []
area: [expedicao]
tags: [decisao, area/expedicao, provisoria]
---
# D-219 · ⏳ PROVISÓRIA — A Expedição LIBERA a peça pronta para outro pedido (04/11/2026, SESSAO-45 — pedido do dono)

**Pedido do dono:** um botão na Expedição com "Qual produto foi liberado?", "O produto foi liberado para um pedido?" (sim → "Para qual pedido?"; não → o motivo da substituição) e "Lançar produto novo com essa tag de pedido para PCP?"; o pedido volta ao PCP com o produto que saiu e o do pedido novo é dado como concluído. O que a sessão escolheu onde o pedido não dizia:
1. **Botão** "Liberar para outro pedido" no cartão da Expedição que tem peça pronta (e não está em decisão pós devolução). A peça escolhida tem de estar **pronta** (Expedição ou já na rota), **perfeita**, de pedido **não entregue**.
2. **O destino** ("o pedido novo que chegou ou de algum outro que já estava lá") é um pedido vivo (não cancelado, não entregue) que **ainda espera esse mesmo móvel no PCP** (mesmo produto, cor e medidas — vaga sem peça). Pedido que já tem esse móvel liberado para a produção é recusado com a explicação (a peça em produção dele não fica sem dono). A janela confere ao digitar o número e diz o porquê de não dar.
3. **O gesto** (tudo ou nada, conferido de novo no banco): a peça sai do pedido de origem (a vaga reabre e ele **volta ao quadro do PCP**); o destino ganha a unidade **pronta na Expedição** na vaga que esperava (a mesma mecânica da peça do estoque — [[D-062 - A sugestao do estoque na liberacao o que e peca igual e quem|D-62]]); a peça antiga sai das contas com a história guardada; o PCP recebe o aviso "Pedido N voltou ao PCP". **Nada vai ao Tiny** (as duas vendas já estão lá; o estoque não muda).
4. **"Não" a "foi para um pedido?"** = substituição com **motivo obrigatório** (vitrine, troca de avaria de outro cliente…): a peça sai das contas e o pedido volta ao PCP.
5. **"Lançar produto novo com a etiqueta do pedido?"** — **Sim** (padrão): volta ao PCP para liberar a produção de novo. **Não por enquanto**: volta ao PCP **em stand-by**, com o motivo ("produto liberado para o pedido X — sem nova produção por enquanto"); como a rota não leva pedido em stand-by ([[D-171 - Onde o pedido em stand-by aparece|D-171]]), pedido programado com "não por enquanto" é recusado com o que fazer.
6. O mesmo toque repetido não faz nada duas vezes. Gesto da logística/admin.
