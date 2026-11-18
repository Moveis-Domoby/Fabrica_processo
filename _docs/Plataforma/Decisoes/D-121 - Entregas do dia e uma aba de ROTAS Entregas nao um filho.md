---
id: D-121
aliases: [D-121]
titulo: "\"Entregas do dia\" é uma aba de ROTAS → Entregas, não um filho do menu"
tipo: decisao
data: 2026-10-09
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-115 - O entregador usuario so de ROTAS a tela das entregas do dia|D-115]]", "[[D-036 - Lei de navegacao hierarquia pai filho pai nunca navega rota|D-36]]"]
area: [logistica-rotas]
tags: [decisao, area/logistica-rotas]
---
# D-121 · "Entregas do dia" é uma aba de ROTAS → Entregas, não um filho do menu (09/10/2026, pedido do dono) — ↪️ D-115/D-36

**Decidido (pedido do dono, 09/10):** *"Entrega do dia não precisa ser uma rota filha, pode ser apenas um filtro/aba dentro de entregas."*

- **ROTAS → Entregas** tem duas abas: **A entregar** (a lista de sempre, o padrão) e **Entregas do dia** (o caminhão de cada dia, parada por parada — a mesma tela do entregador, com "Ver outro dia" e o caminhão). A aba vive no endereço (`?aba=do-dia`), como as abas do PCP e da Programação — o Voltar e o link funcionam.
- No menu, a seção ROTAS fica com **Entregas** e **Programação**. Quem tinha o endereço antigo das entregas do dia cai direto na aba.
- **O entregador não muda ([[D-115 - O entregador usuario so de ROTAS a tela das entregas do dia|D-115]]):** ele não tem o módulo da fábrica, então continua com a tela própria dele, que é a única que ele vê.
- Cada aba só pede o que mostra (regra 17): "A entregar" pede a lista; "Entregas do dia" pede o dia — e o código da tela do dia só baixa quando a aba abre.
