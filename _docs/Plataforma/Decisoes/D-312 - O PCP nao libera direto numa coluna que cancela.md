---
id: D-312
aliases: [D-312]
titulo: "O PCP não libera direto numa coluna que cancela"
tipo: decisao
data: 2026-11-12
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-290 - Mover a peca para CANCELADO ou NAO ENCONTRADO cancela|D-290]]"]
area: [kanban-producao, pcp]
tags: [decisao, area/kanban-producao, area/pcp, provisoria-em-parte]
---
# D-312 · ✅ DECIDIDA (a regra é da demanda) + ⏳ PROVISÓRIA (o laço) — O PCP não libera direto numa coluna que cancela (12/11/2026, SESSAO-50, frente 5) — ↪️ D-290

1. **"Liberar unidades" não oferece CANCELADO nem NÃO ENCONTRADO** como destino, e o banco recusa se alguém tentar por outro caminho. No lugar, a linha *"Este pedido não vai ser produzido?"* com os dois botões. Arrastar uma peça **já liberada** para o CANCELADO continua valendo.
2. **O laço (provisória da demanda):** 3 ou mais peças do pedido canceladas em 24 h → o selo "Peças canceladas várias vezes" e, na janela "O que aconteceu?", *"As peças deste pedido estão sendo canceladas várias vezes. Se ele não vai ser produzido, cancele ou oculte o pedido."*
