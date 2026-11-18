---
id: D-301
aliases: [D-301]
titulo: "\"Para onde vai este móvel?\": quem aparece para \"Passar para outro pedido\""
tipo: decisao
data: 2026-11-11
status: provisoria
revisa: []
revisada_por: []
complementa: ["[[D-290 - Mover a peca para CANCELADO ou NAO ENCONTRADO cancela|D-290]]", "[[D-201 - O PEDIDO NOVO USA PELO PCP A PECA SEM DONO QUE JA ESTA|D-201]]"]
area: [pcp]
tags: [decisao, area/pcp, provisoria]
---
# D-301 · ⏳ PROVISÓRIA — "Para onde vai este móvel?": quem aparece para "Passar para outro pedido" (11/11/2026, SESSAO-48 — escolhas da sessão onde a demanda não dizia) — ↪️ D-290, D-201

1. **"O mais antigo primeiro" é o pedido que espera há mais tempo no PCP** (a ordem da fila do PCP), não a data da venda.
2. **Até 10 pedidos por móvel**; a procura olha no máximo os 200 primeiros da fila que têm o móvel (Lei §6).
3. **Peça sem código (SKU) não tem candidato** — a mesma régua da sugestão de peça em produção do PCP ([[D-201 - O PEDIDO NOVO USA PELO PCP A PECA SEM DONO QUE JA ESTA|D-201]]).
4. **"Todas de uma vez → Passar para outro pedido"** distribui as peças pelos pedidos (o mais antigo primeiro, dividindo as vagas) e fica desligada, dizendo o porquê, quando alguma peça ficaria sem pedido.
5. **A janela abre no Estoque** (o caminho do sino, `?destino=`), em qualquer aba; a leitura aceita também o card de uma peça (leva ao pedido dela).
