---
id: D-161
aliases: [D-161]
titulo: "O grupo \"Pedidos\" do menu mora logo abaixo de \"Rotas\""
tipo: decisao
data: 2026-10-21
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-134 - A area PEDIDOS Todos os pedidos sai do PCP e Cancelados sai|D-134]]"]
area: [interface]
tags: [decisao, area/interface]
---
# D-161 · O grupo "Pedidos" do menu mora logo abaixo de "Rotas" (21/10/2026, pedido do dono) — ↪️ D-134

**Pedido do dono (lote noturno da SESSAO-38):** mover o pai **Pedidos** (Todos os pedidos · Cancelados) para ficar logo **abaixo** do grupo **Rotas** (Entregas · Programação). Ordem da Fábrica agora: Controle de produção → Logística → Rotas → **Pedidos**. Nada mais muda: o pai continua sem rota própria, os filhos seguem `/fabrica/pedidos/…` e quem vê é o mesmo de antes ([[D-134 - A area PEDIDOS Todos os pedidos sai do PCP e Cancelados sai|D-134]]).
