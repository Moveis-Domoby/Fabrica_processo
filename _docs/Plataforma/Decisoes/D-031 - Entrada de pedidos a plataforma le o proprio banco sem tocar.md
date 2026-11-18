---
id: D-31
aliases: [D-31, D-031]
titulo: "Entrada de pedidos: a plataforma lê o próprio banco, sem tocar o n8n"
tipo: decisao
data: 2026-08-28
status: vigente
revisa: []
revisada_por: []
complementa: []
area: [tiny-n8n]
tags: [decisao, area/tiny-n8n]
---
# D-31 · Entrada de pedidos: a plataforma lê o próprio banco, sem tocar o n8n (28/08/2026)

**Decidido (palavras do dono):** *"não precisa conectar no n8n, ele já lança no banco, então leia o banco e crie o card quando chegar lá, instantaneamente"*.

- Card do PCP nasce/atualiza por **trigger no banco** a partir de `pedidos` (que o n8n já alimenta via P15). Nenhum workflow novo no n8n; endpoint HTTP fica apenas documentado como alternativa futura.
- **Cancelamento (Q-24 ✅):** card marcado "cancelado", visível, não some; com unidades já liberadas, notifica admins.
- **Modelo do card do PCP** = o modelo real do PCP atual (ClickUp), documentado no cofre — seguir esse modelo.
