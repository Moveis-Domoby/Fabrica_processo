---
id: D-325
aliases: [D-325]
titulo: "Na entrega parcial, o que ainda está na fábrica CONTINUA em produção; \"Limpar da produção\" é a exceção"
tipo: decisao
data: 2026-11-16
status: vigente
revisa: ["[[D-195 - A ENTREGA PARCIAL o entregador ou a logistica marca o que foi|D-195]]"]
revisada_por: []
complementa: ["[[D-156 - A rota aceita QUALQUER pedido vivo o Lancar para ROTAS deixa|D-156]]", "[[D-113 - Entregue e um fato so dos dois lados e entregue no Tiny fecha|D-113]]", "[[D-213 - Reabrir a entrega|D-213]]"]
area: [logistica-rotas, kanban-producao]
tags: [decisao, area/logistica-rotas, area/kanban-producao]
---
# D-325 · ✅ DECIDIDA pelo dono (16/11/2026, 22:41) + a forma escolhida pela sessão — Na entrega parcial, o que ainda está na fábrica CONTINUA em produção; "Limpar da produção" é a exceção (SESSAO-51, bloco A) — ↩️ revisa a D-195 para o que ainda está na fábrica · ↪️ D-156, D-113, D-213

*"Quando um pedido for lançado para entrega parcial, os produtos que ainda estão em produção continuam em produção, a menos que o responsável queira remover os mesmos da linha… podendo revogar essa decisão."*

1. **A janela em dois grupos:** "Saíram para a entrega" (as peças prontas, marcadas — desmarcada = voltou para a decisão da logística, a [[D-195 - A ENTREGA PARCIAL o entregador ou a logistica marca o que foi|D-195]] inalterada para elas) e "Ainda na fábrica" (as peças em setor de produção, com setor e etapa, desmarcadas, + "N produtos ainda no PCP, sem liberar"). Marcar uma da fábrica = "foi entregue mesmo" (a confirmação da [[D-156 - A rota aceita QUALQUER pedido vivo o Lancar para ROTAS deixa|D-156]]). Sem nada na fábrica, a janela é a de antes.
2. **"E o que ainda está na fábrica?"** — **"Deixar em produção"** (vem marcada) ou **"Limpar da produção"**.
3. **A forma (escolha da sessão — a demanda pedia a mais limpa):** com "Deixar em produção", o fato da entrega parcial **não vira a entrega vigente do card** do pedido — o pedido continua vivo em TODA regra (PCP, Expedição, programação, "A entregar") sem mexer em porta nenhuma. A entrega parcial fica em colunas próprias do card (quando, quantas, a decisão). A outra forma possível (reabrir a entrega pelo caminho da [[D-213 - Reabrir a entrega|D-213]]) traria de volta as peças entregues — descartada.
4. **"Limpar da produção":** cada peça na fábrica ganha o fato da saída (setor, etapa, posição, pedido, item, k/n), o tempo aberto fecha antes, ela é arquivada com registro e sai de quadro e de toda conta; **as vagas saem do PCP** pela marca de remoção que a regra única do PCP já lê, com o motivo próprio "entrega parcial" (não aparece em "Pedidos ocultos" nem no "Incluir pedido no PCP"); o pedido fecha como antes; sino do PCP.
5. **O resto entregue depois:** o "Entregue" normal fecha tudo e vai ao Tiny ([[D-113 - Entregue e um fato so dos dois lados e entregue no Tiny fecha|D-113]]/D-276). **O Tiny não muda na parcial.** O "Entregue" no Tiny segue fechando tudo (D-113 inalterada) — o pedido sai da lista "Entregas parciais" e a trilha mostra a entrega do Tiny.
