---
id: D-309
aliases: [D-309]
titulo: "Os detalhes do \"Ocultar do PCP\""
tipo: decisao
data: 2026-11-12
status: provisoria
revisa: []
revisada_por: []
complementa: ["[[D-307 - Cancelar pedido e Ocultar do PCP no lugar do Remover do PCP|D-307]]"]
area: [pcp]
tags: [decisao, area/pcp, provisoria]
---
# D-309 · ⏳ PROVISÓRIA — Os detalhes do "Ocultar do PCP" (12/11/2026, SESSAO-50 — os dois primeiros são provisórias da demanda; o resto são escolhas da sessão) — ↪️ D-307

1. **Peça na rota (programada) ou entregue não é ocultada** — o modal avisa quantas ficam e onde.
2. **"Ocultar o pedido e as peças" solta as reservas do estoque** do pedido; "Ocultar só o pedido" não mexe nelas.
3. **A contagem do modal** (quantas peças liberadas e onde) é lida ao abrir, numa requisição.
4. **O oculto que o Tiny mantém fora do PCP** (faturado, cancelado…): a linha da aba avisa que, recuperado, ele sai dos ocultos mas só volta ao quadro quando o Tiny voltar a situação.
