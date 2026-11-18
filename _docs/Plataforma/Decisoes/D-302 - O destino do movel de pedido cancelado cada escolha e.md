---
id: D-302
aliases: [D-302]
titulo: "O destino do móvel de pedido cancelado: cada escolha e as proteções"
tipo: decisao
data: 2026-11-11
status: provisoria
revisa: []
revisada_por: []
complementa: []
area: [kanban-producao, pcp]
tags: [decisao, area/kanban-producao, area/pcp, provisoria]
---
# D-302 · ⏳ PROVISÓRIA — O destino do móvel de pedido cancelado: cada escolha e as proteções (11/11/2026, SESSAO-48 — a regra é da demanda e da D-290; os detalhes são escolhas da sessão)

1. **A peça danificada também espera a decisão**, mas não passa para outro pedido (a regra de sempre recusa) — a janela diz o porquê.
2. **A peça com ajuste aberto ([[D-130 - O ajuste de peca um card avulso de ajuste que leva a peca|D-130]]) não ganha a pendência:** o ajuste já tem o destino escolhido pelo PCP.
3. **"Cancelar a fabricação"** leva a peça para a coluna que cancela do setor dela (motivo "cancelada"), senão para a da LIMPEZA E EMBALAGEM; não se pede o estado da peça.
4. **O aviso é um por pedido**, para a logística (o admin entra pela régua do público): "Pedido N cancelado com móveis em produção".
5. **Blindagem:** se a marca de "esperando decisão" falhar, o cancelamento vale do mesmo jeito (a peça cai na regra de antes: ESTOQUE ao ficar pronta) e o erro vira aviso de automação para os administradores.
6. **"Descancelado" no Tiny:** a pendência sai sozinha (fato automático); o aviso que já estava no sino fica — aberto, a janela diz "Nada esperando decisão". Cancelado de novo, a peça espera de novo.
7. **Todo fato de decisão leva o pedido cancelado** (a origem); "outro pedido" leva também o pedido de destino e por onde veio (PCP ou logística).

**Como ficou (técnico):** migration `20261111030000_plt_cancelado_pergunta_destino.sql` — `fn_desvincular_por_cancelamento` recriada por extração (md5 da vigente no diário da frente 3), `plt_fn_destino_pendentes`, `plt_fn_destino_decidir`, gatilhos `plt_pedidos_destino_descancelado` e `plt_eventos_zz_destino_vinculada`; `ModalDestinoPedidoCancelado` (pedaço próprio) aberto pelo `?destino=` do Estoque.
