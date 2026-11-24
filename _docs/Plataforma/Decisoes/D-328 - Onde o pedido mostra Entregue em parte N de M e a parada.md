---
id: D-328
aliases: [D-328]
titulo: "Onde o pedido mostra \"Entregue em parte (N de M)\" e a parada da rota"
tipo: decisao
data: 2026-11-16
status: provisoria
revisa: []
revisada_por: []
complementa: ["[[D-325 - Na entrega parcial o que ainda esta na fabrica CONTINUA|D-325]]"]
area: [logistica-rotas]
tags: [decisao, area/logistica-rotas, provisoria]
---
# D-328 · ⏳ PROVISÓRIA — Onde o pedido mostra "Entregue em parte (N de M)" e a parada da rota (16–17/11/2026, SESSAO-51 — escolhas da sessão) — ↪️ D-325

1. **Mostram:** a ficha do pedido (com "K ainda em produção", a decisão e o botão), o card do pedido no PCP, a lista de Pedidos ("Entregue em parte … · o resto segue na fábrica") e a busca geral. **Não mostram (dívida):** a Programação, a Expedição e as Entregas do dia — as portas delas devolvem uma tabela fixa que atualizações antigas recriam (a mesma razão da [[D-324 - Em Ja programadas o selo do endereco alterado fica na janela|D-324]]); quem abre o pedido nelas vê a ficha.
2. **Com "Deixar em produção" a parada sai da rota do dia** (como no "Não entregue") e o pedido volta para "Programar" — o resto é programado quando ficar pronto. Com "Limpar", a parada fica (o pedido fechou, como antes).
3. **O toque repetido do entregador** (a rede que volta) é conferido antes da permissão: a parada saiu da rota e ele deixou de ser da equipe dela.

> ✅ **18/11/2026 (SESSAO-53):** o item 1 está pago — a Programação (Programar e Já programadas), a Expedição e as Entregas do dia mostram "Entregue em parte (N de M)"; fica de fora o Calendário ([[D-348 - O Calendario da Programacao fica sem o selo Entregue em parte|D-348]] ⏳). As escolhas da sessão: [[D-346 - Depois que o resto e entregue o selo Entregue em parte some|D-346]]…[[D-350 - ROTAS Entregas fica como estava sem o selo novo|D-350]].
