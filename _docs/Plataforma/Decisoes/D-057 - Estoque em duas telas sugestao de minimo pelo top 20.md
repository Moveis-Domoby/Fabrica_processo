---
id: D-57
aliases: [D-57, D-057]
titulo: "Estoque em duas telas + sugestão de mínimo pelo top 20"
tipo: decisao
data: 2026-09-26
status: revisada
revisa: []
revisada_por: ["[[D-072 - Minimo e capacidade do galpao na plataforma a sugestao|D-72]]"]
complementa: []
area: [estoque]
tags: [decisao, area/estoque]
---
# D-57 · Estoque em duas telas + sugestão de mínimo pelo top 20 (26/09/2026)

**↪️ 28/09/2026 ([[D-071 - Top 20 a tela do estoque abre pelos 20 mais vendidos|D-71]]/D-72):** "Produtos acabados" virou **Top 20+** (a lista de prioridade das vendas foi para lá) e "Sugestão de mínimo" virou **Configurações** (mínimo editável aqui, capacidade do galpão, sugestão que cabe no galpão). O dono ajusta o mínimo na plataforma — o do Tiny vale só enquanto não houver um definido aqui.

**Decidido (resposta 8 e pedido do dono na abertura da SESSAO-25):**

- **Produtos acabados** (F fabricado, S simples/revenda, variações) e **Matéria-prima e insumos** (M, K — peças, MDF, parafusos): *"pra produção, o que futuramente irá existir é estoque de peça e necessidade de produção de peça com plano de corte — esse será o nosso próximo passo, então já adiantaremos a peça."* As duas vivem em abas do mesmo filho `/fabrica/logistica/estoque` (não são rotas novas — [[D-036 - Lei de navegacao hierarquia pai filho pai nunca navega rota|D-36]]).
- **Sugestão de mínimo:** *"é para os 20 produtos mais vendidos dos últimos 90 dias, porém com rank — obviamente o produto mais vendido deve ter mais em estoque do que o top 20."* Sugestão = média semanal de vendas (sem personalizado, sem cancelado) × semanas de cobertura escolhidas na tela (1, 2 ou 4) — cresce com a venda. O dono ajusta o mínimo **no Tiny**.
- **Alerta de erro do n8n (P1): não agora** (*"belíssima ideia, porém não faremos ainda"*).
