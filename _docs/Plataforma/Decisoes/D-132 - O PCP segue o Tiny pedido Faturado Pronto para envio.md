---
id: D-132
aliases: [D-132]
titulo: "O PCP segue o Tiny: pedido Faturado, Pronto para envio ou Enviado sai do PCP"
tipo: decisao
data: 2026-10-14
status: vigente
revisa: ["[[D-075 - O quadrinho do PCP na Visao do dia conta o que o quadro|D-75]]"]
revisada_por: []
complementa: []
area: [pcp]
tags: [decisao, area/pcp]
---
# D-132 · O PCP segue o Tiny: pedido Faturado, Pronto para envio ou Enviado sai do PCP (14/10/2026, noite — pedido do dono) — ↩️ revisa a D-75 (o filtro do quadrinho) e o filtro da SESSAO-23

**Pedido do dono:** *"No PCP, não faz sentido esses pedidos ainda estarem aqui, sendo que no Tiny eles já estão até como recebido, isso já deveria estar funcionando, sempre que um pedido é dado como entregue/recebido ou algo do tipo no Tiny, se ele ainda estiver em PCP, ele deve sumir e seguir a atualização do Tiny."*

- O "recebido" que o Tiny mostra é do **pagamento**; quem anda é a **situação do pedido**: Em aberto → **Preparando envio** (o estado normal de pedido esperando produção aqui — 36 em 14/10) → Faturado → Pronto para envio → Enviado → Entregue.
- O PCP já tirava Entregue, Não entregue e Cancelado; passa a tirar também **Faturado, Pronto para envio e Enviado** — o Tiny levou o pedido adiante, ele não espera liberação. **Preparando envio fica.**
- É **leitura**, não arquivamento: se o Tiny voltar a situação, o pedido volta ao PCP. Na área Pedidos ele aparece como **"Segue no Tiny"**.
- Uma regra só no banco (o quadro do PCP e o quadrinho da Visão do dia leem dela — painel = quadro, [[D-075 - O quadrinho do PCP na Visao do dia conta o que o quadro|D-75]]).
- Em 14/10 isso tirou **um** pedido (13623, Faturado); os outros 22 estavam "Preparando envio" no Tiny.
