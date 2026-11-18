---
id: D-96
aliases: [D-96, D-096]
titulo: "O pedido vivo que só a conferência achou entra no PCP"
tipo: decisao
data: 2026-10-01
status: vigente
revisa: []
revisada_por: []
complementa: []
area: [pcp]
tags: [decisao, area/pcp]
---
# D-96 · O pedido vivo que só a conferência achou entra no PCP (01/10/2026) — ↪️ a blindagem da carga histórica

**Decidido (resposta 3 do dono — "Pode ser"):** o pedido que o aviso do Tiny nunca trouxe e a conferência diária achou entra no quadro do PCP **como se tivesse chegado pelo aviso**, se ainda não foi entregue nem cancelado. Encerrado (entregue, não entregue, cancelado) entra só no banco. Nos 5.360 pedidos conferidos em 22/09 isso nunca tinha acontecido — é rede de segurança. **Técnico:** origem nova `pente_fino` em `pedidos`, aceita pela guarda do gatilho de inserção (migration 49); a carga histórica (`backfill`) segue fora.
