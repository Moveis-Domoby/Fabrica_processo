---
id: D-293
aliases: [D-293]
titulo: "A limpeza roda dentro da rotina da madrugada que já existe (a conferência com o Tiny, 03:00 de Natal) — nenhum relógio novo"
tipo: decisao
data: 2026-11-11
status: provisoria
revisa: []
revisada_por: []
complementa: []
area: [kanban-producao]
tags: [decisao, area/kanban-producao, provisoria]
---
# D-293 · ⏳ PROVISÓRIA — A limpeza roda dentro da rotina da madrugada que já existe (a conferência com o Tiny, 03:00 de Natal) — nenhum relógio novo (11/11/2026, SESSAO-48 — provisória escrita na demanda)

`fn_tiny_pente_fino_iniciar` chama `fn_cancelados_arquivar()` no começo, protegida (se a limpeza falhar, a conferência do Tiny segue). E a coluna já não mostra o que passou do prazo mesmo antes de a limpeza rodar (filtro na leitura — a porta do quadro e o "Ver mais").
