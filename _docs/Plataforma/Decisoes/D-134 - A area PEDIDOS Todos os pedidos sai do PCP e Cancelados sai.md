---
id: D-134
aliases: [D-134]
titulo: "A área PEDIDOS: \"Todos os pedidos\" sai do PCP e \"Cancelados\" sai da Logística"
tipo: decisao
data: 2026-10-14
status: revisada
revisa: []
revisada_por: ["[[D-299 - A aba Cancelados e removidos volta para dentro do PCP|D-299]]"]
complementa: []
area: [pcp, interface]
tags: [decisao, area/pcp, area/interface]
---
# D-134 · A área PEDIDOS: "Todos os pedidos" sai do PCP e "Cancelados" sai da Logística (14/10/2026, noite — pedido do dono)

**Pedido do dono:** *"Remova de PCP a aba de todos os pedidos e jogue essa aba como rota filha de um novo pai chamado 'Pedidos' … todos os pedidos com todos os dados, sem exceção, dados de produção, dados comerciais, quem fechou essa venda, quem produziu cada produto com tempo de execução em cada etapa e pessoa que participou, com o dia da entrega e o horário que foi dado como entregue … layout de extrema qualidade e LEVE PARA O VISUAL, com botões ocultando dados pesados que são revelados com cliques, porém revelados de forma gradativa. Vai também a rota filha 'Cancelados', que mostra todos os pedidos cancelados da história da empresa de forma paginada, com TODOS os dados fornecidos pelo Tiny também."* · *"Após o pedido entregue, onde é possível visualizar o comprovante anexado? … coloque para ver dentro da nova rota de pedidos."*

- Menu da Fábrica: pai **Pedidos** com **Todos os pedidos** (`/fabrica/pedidos/todos`) e **Cancelados** (`/fabrica/pedidos/cancelados`). Quem vê: a logística (PCP, fins de linha) e o admin — o mesmo de antes.
- **Cancelados** reúne a tela que era da Logística (decisão provisória do Claude: duas telas "Cancelados" confundiriam) e passa a ter **toda a história** (164 em 14/10), não só os que tinham card.
- A **linha** é leve: número, data, situação no Tiny e na plataforma, cliente, **quem vendeu**, marcadores, valor, peças prontas — ou **entregue em (dia e hora) por quem**, ou cancelado em.
- **Tocar** abre a ficha (1 requisição): o resumo — cliente, venda, valor, entrega. O resto, por **botões**, um de cada vez: **Itens e pagamento** · **Produção** (cada peça, cada etapa, quem trabalhou e quanto tempo — busca só no clique) · **Entrega e comprovante** (o comprovante abre ali mesmo) · **Dados do Tiny** (o registro inteiro que o Tiny mandou — busca só no clique) · **Histórico**.
- A seleção do super admin ([[D-117 - PCP do super admin seletor de situacao do pedido e arquivar|D-117]]) foi junto para "Todos os pedidos".
