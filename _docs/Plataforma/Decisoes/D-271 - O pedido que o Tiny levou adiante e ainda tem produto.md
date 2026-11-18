---
id: D-271
aliases: [D-271]
titulo: "O pedido que o Tiny levou adiante e ainda tem produto por liberar aparece na Expedição com o aviso, e volta ao PCP por dois botões que mudam a situação no Tiny"
tipo: decisao
data: 2026-11-09
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-132 - O PCP segue o Tiny pedido Faturado Pronto para envio|D-132]]", "[[D-133 - A Expedicao mostra so pedido vivo a previsao mais proxima|D-133]]", "[[D-219 - A Expedicao LIBERA a peca pronta para outro pedido|D-219]]"]
area: [tiny-n8n, expedicao]
tags: [decisao, area/tiny-n8n, area/expedicao]
---
# D-271 · ✅ DECIDIDA pelo dono — O pedido que o Tiny levou adiante e ainda tem produto por liberar aparece na Expedição com o aviso, e volta ao PCP por dois botões que mudam a situação no Tiny (09/11/2026, SESSAO-47) — ↪️ complementa D-132, D-133, D-219

**Achado (o 13818, leitura do banco em 09/11):** o Tiny ficou "Pronto para envio" (mudança à mão, lá) e a logística liberou as duas peças prontas dele para outros pedidos. O pedido saiu do PCP ([[D-132 - O PCP segue o Tiny pedido Faturado Pronto para envio|D-132]]) **e** da Expedição ([[D-133 - A Expedicao mostra so pedido vivo a previsao mais proxima|D-133]]: o adiantado só aparecia com peça na fábrica) — ninguém o via, e o sino dizia "voltou ao PCP".

**Decidido (pedido e respostas do dono, 09/11):**
1. **A regra do PCP fica:** Faturado, Pronto para envio e Enviado no Tiny continuam fora do PCP.
2. **"Adiantado no Tiny com falta"** — uma regra só: o card do pedido vivo (não arquivado, sem entrega), o Tiny em Faturado, Pronto para envio ou Enviado, e pelo menos uma vaga de produção por liberar (a conta do PCP: frete não conta, personalizado conta). Entregue, Não entregue e Cancelado têm caminho próprio e ficam de fora.
3. **A Expedição mostra o pedido mesmo com zero peça pronta**, com a situação real: *"Este pedido está como Pronto para envio no Tiny, por isso saiu do PCP. Ainda falta liberar 2 produtos."* O pedido com peça pronta **e** com falta ganha o mesmo aviso no card normal. Pedidos antigos também aparecem (hoje, o 13652 e o 13684).
4. **Dois botões no aviso** — **"Voltar para Em aberto (Tiny)"** e **"Voltar para Preparando envio (Tiny)"** ("Em produção" não existe no Tiny) — para logística e admin (a permissão de liberar peça), com uma confirmação de uma frase. Num toque: a plataforma pede a situação ao Tiny, o pedido volta ao PCP **na hora** (sem esperar o Tiny) só com o que falta, fica o registro de quem fez com a situação de antes e a pedida, e o PCP recebe "Pedido N voltou ao PCP". Toque repetido = um efeito só.
5. **A volta vale até o Tiny mostrar outra situação**; depois a regra do PCP decide sozinha de novo (se alguém adiantar o pedido lá outra vez, ele sai do PCP e o aviso volta). Aviso antigo do Tiny fora de ordem não esconde o pedido devolvido. **O Tiny recusou ou não respondeu:** o pedido segue no PCP com "O Tiny ainda não confirmou a mudança" e o alerta sai pela porta de sempre.
6. **Na janela de liberar peça**, com o pedido de origem adiantado no Tiny e o produto voltando para a produção: a situação real e três opções no mesmo gesto — voltar para Em aberto, voltar para Preparando envio ou **"Deixar como está"** (o pedido fica na Expedição, com o aviso).
7. **Avisos que dizem a verdade:** "voltou ao PCP" só quando voltou; senão *"O produto saiu do pedido N, mas ele está como Pronto para envio no Tiny e ficou na Expedição esperando decisão."*

**Fora (dito na demanda):** mudar a D-132; Entregue, Não entregue e Cancelado; descobrir ou bloquear quem muda a situação no Tiny; mexer no fluxo do n8n; acertar o 13818 (já resolvido).

**Como ficou (técnico):** migrations `20261109010000` (base) e `20261109020000`. Regra única `plt_privado.vw_pedidos_adiantados_falta`; a regra do PCP `plt_privado.fn_fora_do_pcp(situação, volta_pcp_em)` lida por `plt_fn_pcp_quadro`, `plt_fn_cards_pedido_pcp`, `plt_fn_dash_pcp_dia`, `vw_standby_na_aba` e `plt_fn_pcp_standby`; a marca = fato `pedido_volta_pcp` → projeção `plt_cards.volta_pcp_em/_situacao`, fechada por `pedido_volta_pcp_fim` (gatilho próprio `plt_pedidos_volta_pcp` em `pedidos`, à prova de falha) ou pela entrega; porta `plt_fn_pedido_voltar_pcp(card, 'aberto'|'preparando_envio', chave)` → fila de saída que já existia (`plt_tiny_pedido_fila`, motivo novo `volta_pcp`); `plt_fn_expedicao` com `saiu_do_pcp`, `tiny_adiantado`, `volta_pcp`, `tiny_ligado` e o filtro; `plt_fn_liberar_peca(…, p_tiny)`; avisos `pedido_voltou_pcp` e `pedido_adiantado_tiny` no catálogo. O n8n não muda.
