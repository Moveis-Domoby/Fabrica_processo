---
id: D-327
aliases: [D-327]
titulo: "Revogar a decisão da entrega parcial, quantas vezes for preciso"
tipo: decisao
data: 2026-11-16
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-325 - Na entrega parcial o que ainda esta na fabrica CONTINUA|D-325]]"]
area: [logistica-rotas]
tags: [decisao, area/logistica-rotas, provisoria-em-parte]
---
# D-327 · ✅ DECIDIDA (a regra é do dono) + ⏳ PROVISÓRIA (o lugar, o prazo e o que fica) — Revogar a decisão da entrega parcial, quantas vezes for preciso (16–17/11/2026, SESSAO-51, frente 3) — ↪️ D-325

1. **Onde:** a aba **"Entregas parciais"** no PCP (provisória: o lugar), ao lado de "Cancelados" e "Pedidos ocultos", e a **ficha do pedido**. A lista mostra só o pedido com a decisão que ainda dá para revogar, do mais recente para trás, por cursor, com a busca pelo número ou pelo cliente; **sem prazo** (provisória).
2. **Um botão só, o contrário da decisão que vale:** "Revogar e remover da linha de produção" (o "Limpar" de agora — cada peça guarda a etapa de AGORA) ou "Revogar e voltar tudo para a produção" (a volta da [[D-326 - Os detalhes da peca que sai e volta pela entrega parcial|D-326]]; as vagas reabrem em "Aguardando liberação"; o pedido que a parcial fechou reabre e a parada antiga sai da programação).
3. **"Revogar e remover" não tira peça já pronta** (Pedidos em aguardo, Expedição) **nem a da rota** (provisória) — a janela diz quantas ficam e onde, e o pedido segue para ser entregue com elas. Sem nada vivo depois, o pedido fecha pela própria entrega parcial.
4. **Quem:** logística, PCP e admin. Cada revogar = um fato no card do pedido (antes, depois, quem, a chave do toque); o toque repetido faz um efeito só; a trilha mostra todas as idas e voltas.
5. **Sai da lista (e o banco recusa, com o porquê) quando:** o resto foi entregue, o pedido foi cancelado ou excluído no Tiny, o Tiny o marcou como entregue, ele foi ocultado do PCP ou não sobrou nada na fábrica nem no PCP.
