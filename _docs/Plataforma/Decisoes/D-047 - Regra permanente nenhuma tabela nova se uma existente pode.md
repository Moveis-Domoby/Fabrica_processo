---
id: D-47
aliases: [D-47, D-047]
titulo: "Regra permanente: nenhuma tabela nova se uma existente pode ser reutilizada"
tipo: decisao
data: 2026-09-15
status: vigente
revisa: []
revisada_por: []
complementa: []
area: [publicacao-infra]
tags: [decisao, area/publicacao-infra]
---
# D-47 · Regra permanente: nenhuma tabela nova se uma existente pode ser reutilizada (15/09/2026)

**Decidido (palavras do dono):** *"nenhuma nova tabela é criada se alguma existente pode ser reutilizada em um módulo similar"* — ex.: não criar tabela de pedidos sendo que todos os pedidos já estão em `pedidos`.

- Primeira aplicação (na própria união): `vendas_marketing` **não** vira tabela na fábrica — vira **view de compatibilidade** sobre `pedidos` + `clientes` + `pedido_itens` (verificado em 15/09: mesmo dataset, 5.302 = 5.302 pedidos, 19/19 meses batendo ao centavo, telefone no mesmo formato). `tiny_sync_state`, as 3 functions de sync do Tiny e seus ticks/crons também **não** migram — o webhook n8n da fábrica já cobre criação e edição de pedidos.
- A regra vale daqui em diante para toda demanda: antes de propor tabela nova, provar que nenhuma existente serve.
