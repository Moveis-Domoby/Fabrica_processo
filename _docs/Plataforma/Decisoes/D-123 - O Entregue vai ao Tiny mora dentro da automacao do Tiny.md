---
id: D-123
aliases: [D-123]
titulo: "O \"Entregue vai ao Tiny\" mora dentro da automação do Tiny que já existia"
tipo: decisao
data: 2026-10-09
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-113 - Entregue e um fato so dos dois lados e entregue no Tiny fecha|D-113]]"]
area: [tiny-n8n]
tags: [decisao, area/tiny-n8n]
---
# D-123 · O "Entregue vai ao Tiny" mora dentro da automação do Tiny que já existia (09/10/2026, pedido do dono) — ↪️ D-113

**Decidido (pedido do dono, 09/10):** *"atualizei também a api do n8n para que você possa aplicar fluxos lá, o fluxo que tinha ficado pendente de importação, publique lá, CUIDADO EXTREMO PARA NÃO QUEBRAR OS QUE JÁ EXISTEM, se possível, coloque esses fluxos de tiny dentro de automações já existentes do tiny."*

- O caminho plataforma → Tiny (a entrega registrada deixa o Tiny "Entregue"; desfeita, volta) **não é uma automação nova**: é a 2ª parte, com gatilho próprio, da automação que já liga o Tiny ao banco da fábrica ("subir banco de dados --- tiny -> supabase" — a mesma que traz pedidos e contas toda madrugada). A do ClickUp (que um dia será desligada) não serviu de casa por isso.
- Usa a chave da **loja** no Tiny (onde moram os pedidos de venda), não a da fábrica — o arquivo de 08/10 estava trocado.
- No ar desde 09/10 ~01:15; a chave "Entregue vai ao Tiny" segue **desligada** até o dono ligar e fazer a prova com 1 pedido real.
