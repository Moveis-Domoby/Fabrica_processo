---
id: D-13
aliases: [D-13, D-013]
titulo: "Entrada única e saídas terminais do fluxo"
tipo: decisao
data: 2026-08-24
status: revisada
revisa: []
revisada_por: ["[[D-058 - O lugar da peca pronta com pedido Pedidos em aguardo|D-58]]"]
complementa: []
area: [kanban-producao]
tags: [decisao, area/kanban-producao]
---
# D-13 · Entrada única e saídas terminais do fluxo (24/08/2026)

**↩️ revisada em 2026-09-27 ([[D-058 - O lugar da peca pronta com pedido Pedidos em aguardo|D-58]]):** os fins de linha agora são três — Pedidos em aguardo (peça de pedido), ESTOQUE (só peça sem dono) e ROTAS (pedido lançado). A entrada única pelo PCP não muda.

**Decidido (palavras do dono):** *"Todos os pedidos chegam exclusivamente primeiro para PCP e por último em estoque ou rotas, ficando ou parado ou entregue lá mesmo."*

- **Entrada única:** todo pedido entra **sempre** pelo **PCP** — não existe card nascendo em outro setor.
- **Saídas terminais:** o card termina em **ESTOQUE** (fica parado lá) ou em **ROTAS** (é entregue). São os dois únicos fins de linha.
- Consequência de modelo: o reagrupamento do pedido ([[D-001 - Unidade do card hibrido|D-01]]) acontece nesse fim de linha — responde a Q-27.
- ⚠️ Ponto a confirmar na sessão do kanban: na fase 1 a **ROTAS vive no ClickUp** ([[D-005 - Escopo producao primeiro logistica depois|D-05]]). Portanto ROTAS existe na plataforma como **setor terminal de handoff** (o card chega lá e a ponte n8n cria o card na ROTAS do ClickUp), ou o fim de linha na plataforma é só ESTOQUE + expedição? Decidir antes de codar a SESSAO-04.
