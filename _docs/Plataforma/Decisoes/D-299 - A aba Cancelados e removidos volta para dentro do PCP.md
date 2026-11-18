---
id: D-299
aliases: [D-299]
titulo: "A aba \"Cancelados e removidos\" volta para dentro do PCP"
tipo: decisao
data: 2026-11-11
status: provisoria
revisa: ["[[D-134 - A area PEDIDOS Todos os pedidos sai do PCP e Cancelados sai|D-134]]"]
revisada_por: ["[[D-307 - Cancelar pedido e Ocultar do PCP no lugar do Remover do PCP|D-307]]", "[[D-314 - As abas Cancelados e Pedidos ocultos|D-314]]"]
complementa: []
area: [pcp]
tags: [decisao, area/pcp, provisoria]
---
# D-299 · ⏳ PROVISÓRIA — A aba "Cancelados e removidos" volta para dentro do PCP (11/11/2026, SESSAO-48 — a aba é da demanda; o lugar, a ordem e o filtro são escolhas da sessão) — ↩️ D-134 (o `?aba=cancelados` levava para Pedidos → Cancelados)

1. **Mora no PCP** (`?aba=cancelados`, como a Stand-by): mostra os pedidos removidos do PCP e os cancelados no Tiny que passaram pelo PCP (card vivo); "Devolver ao PCP" é gesto do PCP. A história inteira dos cancelados continua em Pedidos → Cancelados, com um atalho na aba.
2. **A ordem é "quando saiu do PCP"**, o mais recente primeiro (removido: a remoção; cancelado: o último cancelamento vindo do Tiny) — quem acabou de remover acha o pedido no topo.
3. **A aba não mostra o total** ("(N)"), ao contrário das outras do PCP: contar a história inteira custava ~175 ms no ensaio ×100 (Lei §6.4); a lista anda ao rolar, 20 por vez, por cursor.
4. **O filtro raro pelo nome** acha o nome como ele está gravado (sem diferença de maiúscula, com acento) — o mesmo jeito da busca de Pedidos → Cancelados; o nome comum é conferido sem acento (a régua dos quadros).

**Como ficou (técnico):** `plt_fn_pedidos_cancelados(text, integer, timestamptz, bigint)` (a de 3 argumentos sai), cada metade pelo seu índice num laço que para na página; `AbaCanceladosRemovidos` (pedaço próprio). Migration `20261111020000_plt_pcp_aviso_remover.sql`.
