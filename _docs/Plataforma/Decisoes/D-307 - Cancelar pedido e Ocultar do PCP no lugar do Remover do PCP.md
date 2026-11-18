---
id: D-307
aliases: [D-307]
titulo: "\"Cancelar pedido\" e \"Ocultar do PCP\" no lugar do \"Remover do PCP\""
tipo: decisao
data: 2026-11-12
status: vigente
revisa: ["[[D-299 - A aba Cancelados e removidos volta para dentro do PCP|D-299]]", "[[D-300 - Remover do PCP so a parte do PCP muda|D-300]]"]
revisada_por: []
complementa: ["[[D-075 - O quadrinho do PCP na Visao do dia conta o que o quadro|D-75]]", "[[D-290 - Mover a peca para CANCELADO ou NAO ENCONTRADO cancela|D-290]]"]
area: [pcp]
tags: [decisao, area/pcp]
---
# D-307 · ✅ DECIDIDA pelo dono (12/11/2026, 01:25 e 01:30) — "Cancelar pedido" e "Ocultar do PCP" no lugar do "Remover do PCP" (SESSAO-50, bloco B) — ↩️ D-299, D-300 · ↪️ D-75, D-290

*"Dentro de PCP a partir de agora tem um botão também de cancelar/ocultar pedido. Se clicar em cancelar, ele cancela no Tiny… O ocultar apenas remove ele por completo da lista do PCP, perguntando se ele deseja ocultar também os cards já liberados… podendo recuperar ele dentro de uma lista de 'Pedidos ocultos', que se apaga depois que o card ficar lá por 1 mês, e o único jeito de recuperar é pelo incluir pedido no PCP"* · sobre as peças ocultadas, ao recuperar: *"voltam todas para PCP, não para a coluna onde estavam."*

1. **Onde:** em todo pedido do PCP — o card do quadro, o card da aba Stand-by, a janela do card do pedido e a janela "O que aconteceu?" (que passa a ter "Produzir de novo", "Cancelar pedido" e "Ocultar do PCP"); e a linha da janela "Liberar unidades" (*"Este pedido não vai ser produzido?"*). Quem usa: PCP, logística e admin (a permissão de sempre). O "Remover do PCP" com três motivos deixou de existir (a porta antiga responde com o caminho novo).
2. **Cancelar pedido** (modal próprio, botão destrutivo "Cancelar no Tiny e aqui"): pede `cancelado` ao Tiny pela fila de saída (motivo novo `cancelar`; a última vontade do pedido vale), o pedido **sai do PCP na hora** com o fato `pedido_cancelado_plataforma` (com quem), as peças em produção esperam a logística ("Para onde vai este móvel?"), as prontas vão ao ESTOQUE sem dono e as reservas do estoque soltam. Um toque = uma chamada com chave (repetir não faz nada).
3. **Ocultar do PCP** (modal próprio): o pedido sai de todas as portas do PCP e fica em **"Pedidos ocultos"**; com peças já liberadas, a pergunta "Ocultar também essas peças?" — **"Ocultar só o pedido"** (as peças seguem na produção, do pedido) ou **"Ocultar o pedido e as peças"** (cada peça ganha `card_oculto`, perde o pedido e é guardada com registro — sai do quadro e de todas as contas; nada é apagado). O Tiny não muda.
4. **Recuperar** (na aba ou pelo "Incluir pedido no PCP"): o pedido volta a "Aguardando liberação" com **as vagas abertas** — nenhuma peça volta para a coluna; a liberação é a de sempre. A janela diz com quantos produtos ele volta.
5. **Depois do prazo**, o pedido só sai da lista (nada é apagado, nenhum relógio): o único caminho é **"Incluir pedido no PCP"**, que passa a achar o oculto de qualquer idade ("Oculto em dd/mm").

**Como ficou (técnico):** `plt_fn_pcp_cancelar`, `plt_fn_pcp_ocultar`, `plt_fn_pcp_saida_previa` (a prévia dos dois modais numa requisição), `plt_fn_pcp_devolver` (Recuperar), `plt_fn_pcp_cancelados`, `plt_fn_pcp_ocultos`, `plt_fn_pcp_incluir_lista`; `plt_cards.cancelado_plataforma_em/_evento_id`; `removido_pcp_motivo = 'oculto'`. Telas: `ModalSaidaPedido`, `AbaCancelados`, `AbaPedidosOcultos`, `ModalNovoPedido` ("Incluir pedido no PCP"), `JanelaDoCard`. Migrations `20261112010000_plt_sessao50_base.sql` e `20261112020000_plt_pcp_cancelar_ocultar_excluido.sql`.
