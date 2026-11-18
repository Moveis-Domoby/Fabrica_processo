---
id: D-298
aliases: [D-298]
titulo: "O acerto das peças que já estavam paradas"
tipo: decisao
data: 2026-11-11
status: provisoria
revisa: []
revisada_por: []
complementa: []
area: [kanban-producao]
tags: [decisao, area/kanban-producao, provisoria]
---
# D-298 · ⏳ PROVISÓRIA — O acerto das peças que já estavam paradas (11/11/2026, SESSAO-48 — provisória escrita na demanda; o sino por pedido é escolha da sessão)

`supabase/manutencao/2026-11-11_cancelado_vira_gesto.sql`: cada peça viva nas colunas que cancelam passa pelo MESMO gesto (`fn_cancelar_fabricacao`), origem `api`, com a data do dia do acerto (cada uma ganha os dias de conferência); o sino do PCP sai uma vez por pedido; os números do estoque são recontados. Modo ensaio (conta antes e depois e não grava nada) e modo aplicar (só com o OK do dono).

**↩️ [[D-299 - A aba Cancelados e removidos volta para dentro do PCP|D-299]] e [[D-300 - Remover do PCP so a parte do PCP muda|D-300]] revisadas em 2026-11-12 ([[D-307 - Cancelar pedido e Ocultar do PCP no lugar do Remover do PCP|D-307]]/D-314, SESSAO-50 — pedido do dono):** o "Remover do PCP" com três motivos virou "Cancelar pedido" e "Ocultar do PCP", e a aba "Cancelados e removidos" virou "Cancelados" e "Pedidos ocultos".
