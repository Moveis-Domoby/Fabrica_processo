---
id: D-119
aliases: [D-119]
titulo: "Os números do estoque ficam PRONTOS no banco; o ranking das vendas anda de madrugada"
tipo: decisao
data: 2026-10-08
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-084 - Sugestao por dias uteis de VENDA loja seg sab e minimo|D-84]]", "[[D-086 - Reservados o cartao mostra TUDO que esta em producao|D-86]]", "[[D-118 - Reservados em venda ate a ENTREGA|D-118]]"]
area: [estoque]
tags: [decisao, area/estoque]
---
# D-119 · Os números do estoque ficam PRONTOS no banco; o ranking das vendas anda de madrugada (08/10/2026, Claude — sob a ordem noturna do dono; ✅ confirmada pelo dono em 13/10 — D-124) — ↪️ D-84/D-86/D-118

**Decidido pelo Claude (SESSAO-30, etapa 2 — Lei de Desempenho §6: "projeção pronta para leitura pesada"):**

- **Cada produto tem uma linha com os seus números prontos** — livres no galpão, reservadas pela venda, prontas de pedido (aguardo e ROTAS até a entrega — [[D-118 - Reservados em venda ate a ENTREGA|D-118]]), em produção para o estoque e de pedido, a última leitura do Tiny. A linha anda **no mesmo gesto** que mexe a peça (entrada, baixa, liberação, movimentação, entrega, cancelamento, leitura do Tiny) — o número na tela é sempre o de agora. **De madrugada** uma recontagem completa confere tudo e corrige qualquer diferença.
- **As vendas de 90 dias e a posição no ranking (o Top X) são recalculadas de madrugada** (na mesma rotina do mínimo automático) **e na hora em que o Top X, a cobertura ou o corte de pedido grande mudam** em Configurações. Uma venda nova **não** muda a posição do produto no ranking na hora — muda na manhã seguinte. *Por quê:* recalcular 90 dias de vendas de todos os produtos a cada abertura da tela custava segundos; a posição de um produto entre 90 dias de vendas não muda de forma que importe dentro do mesmo dia.
- **O resumo do galpão é a soma dos cartões** (raio-x 5) — a mesma regra, lida da mesma linha.
- A peça de estoque **personalizada** (de pedido cancelado, sem produto do catálogo) aparece numa lista própria na tela do Estoque, com o pedido de origem, e tem **baixa com motivo** (raio-x 6).
