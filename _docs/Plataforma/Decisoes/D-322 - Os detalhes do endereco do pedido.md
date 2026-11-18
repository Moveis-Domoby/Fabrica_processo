---
id: D-322
aliases: [D-322]
titulo: "Os detalhes do endereço do pedido"
tipo: decisao
data: 2026-11-12
status: provisoria
revisa: []
revisada_por: []
complementa: ["[[D-319 - Editar o endereco de entrega do pedido com o original do Tiny|D-319]]"]
area: [logistica-rotas]
tags: [decisao, area/logistica-rotas, provisoria]
---
# D-322 · ⏳ PROVISÓRIA — Os detalhes do endereço do pedido (12/11/2026, SESSAO-50 — escolhas da sessão onde a demanda não dizia) — ↪️ D-319

1. **Pedido entregue:** só o admin edita (os outros não veem os botões). **Pedido sem card na plataforma:** o endereço só muda pelo Tiny (a janela diz o porquê).
2. **Escrever de novo o endereço do Tiny** na janela conta como "Voltar ao endereço original". **Depois que o Tiny confirmar** um endereço novo, "Voltar" é recusado ("edite o endereço — o original está no histórico").
3. **A projeção mora numa tabela própria e pequena** (`plt_pedido_enderecos`, uma linha só para os pedidos alterados — banco enxuto), não em 14 colunas quase sempre vazias no card do pedido. O registro de atividade é o do próprio fato (sem linha duplicada na Auditoria).
