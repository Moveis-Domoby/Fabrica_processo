---
titulo: "Mapa — PCP"
tipo: mapa
area: pcp
atualizado: 2026-11-18
tags: [mapa, moc, area/pcp]
---

# 🗺️ MOC - PCP

> A porta de entrada da produção: o PCP vê o **pedido inteiro**, decide e libera (por inteiro ou em parte). Aqui moram as abas (Reabastecimento · Pedidos aguardando liberação · Todos os pedidos · Cancelados · Pedidos ocultos), a reposição de estoque, o pedido que segue a situação do Tiny, "Cancelar pedido" e "Ocultar do PCP", a peça sem dono reaproveitada e o "Mover para o PCP".

**No código:** `src/paginas/PCP.tsx` · `src/pedidos/` (a área Pedidos)

**Notas da área:** [[PLT - Entrada Automatica de Pedidos]]

**Perguntas em aberto:** nenhuma registrada para a área — [[PLT - Perguntas em Aberto]]

## Últimas sessões da área (a mais nova primeiro)

- **51** · [[SESSAO-51 - Entrega Parcial Mantem a Producao e Mover Card para o PCP]] · [[handoff_2026_11_17_sessao51_entrega_parcial_mover_pcp|handoff]]
- **50** · [[SESSAO-50 - Observacao do Item Cancelar e Ocultar no PCP e Editar Endereco da Parada]] · [[handoff_2026_11_12_sessao50_observacao_cancelar_ocultar_endereco|handoff]]
- **48** · [[SESSAO-48 - Cancelar Fabricacao de Verdade - Peca de Pedido Pergunta o Destino]] · [[handoff_2026_11_11_cowork_sessao48_cancelamento_e_recargas|handoff 1]] · [[handoff_2026_11_11_sessao48_cancelar_fabricacao_recargas|handoff 2]]
- **47** · [[SESSAO-47 - Pedido Adiantado no Tiny Data Real da Entrega Comprovantes e Painel de Tempos]] · [[handoff_2026_11_09_sessao47_pedido_adiantado_entrega_comprovantes_tempos|handoff]]
- **45** · [[SESSAO-45 - Rotas no Mapa Certo Liberar Peca na Expedicao e PCP Honesto]] · [[handoff_2026_11_04_sessao45_rotas_expedicao_pcp|handoff]]
- **44** · [[SESSAO-44 - Entrega que Volta do Tiny e Itens Novos no PCP]] · [[handoff_2026_11_04_sessao44_entrega_tiny_itens_novos|handoff]]
- **30** · [[SESSAO-30 - Producao de Ponta a Ponta - Pedido Reabastecimento e Entrega]] · [[handoff_2026_10_08_sessao30_producao_ponta_a_ponta|handoff]]
- **22** · [[SESSAO-22 - Producao - Filas Reais Tempo de PCP e Paginacao]] · [[handoff_2026_09_21_sessao22_filas_tempo_pausa|handoff]]
- **09** · [[SESSAO-09 - Entrada de Pedidos via n8n]] · [[handoff_2026_08_28_sessao09_entrada_pedidos|handoff]]

<!-- gerado:inicio -->
## Decisões vigentes (15)

- [[D-063 - Frete nao vira peca de producao o resto nasce no PCP e o PCP|D-63]] · Frete não vira peça de produção; o resto nasce no PCP e o PCP escolhe o lugar; pedido…
- [[D-085 - Reposicao parada 2 dias uteis da FABRICA seg sex no PCP sai|D-85]] · Reposição parada 2 dias úteis da FÁBRICA (seg–sex) no PCP sai sozinha — o Sistema…
- [[D-088 - O PCP em tres abas Reabastecimento Pedidos aguardando|D-88]] · O PCP em três abas: Reabastecimento · Pedidos aguardando liberação · Todos os pedidos;…
- [[D-090 - Reposicao automatica e escolha da operacao nao pendencia|D-90]] · Reposição automática é escolha da operação, não pendência do dono
- [[D-096 - O pedido vivo que so a conferencia achou entra no PCP|D-96]] · O pedido vivo que só a conferência achou entra no PCP
- [[D-117 - PCP do super admin seletor de situacao do pedido e arquivar|D-117]] · PCP do super admin: seletor de situação do pedido e arquivar em massa — sem mexer no…
- [[D-120 - O pedido entregue sai da ROTAS e mora no PCP com tudo dele|D-120]] · O pedido entregue sai da ROTAS e mora no PCP, com tudo dele num clique
- [[D-132 - O PCP segue o Tiny pedido Faturado Pronto para envio|D-132]] · O PCP segue o Tiny: pedido Faturado, Pronto para envio ou Enviado sai do PCP
- [[D-186 - Lancar qualquer movel para producao a qualquer momento|D-186]] · LANÇAR QUALQUER MÓVEL PARA PRODUÇÃO, A QUALQUER MOMENTO — o mesmo ícone da fábrica em…
- [[D-201 - O PEDIDO NOVO USA PELO PCP A PECA SEM DONO QUE JA ESTA|D-201]] · O PEDIDO NOVO USA, PELO PCP, A PEÇA SEM DONO QUE JÁ ESTÁ EM PRODUÇÃO — da reposição de…
- [[D-269 - O cancelamento no Tiny FECHA o stand-by do pedido na hora|D-269]] · O cancelamento no Tiny FECHA o stand-by do pedido, na hora do cancelamento; o painel de…
- [[D-307 - Cancelar pedido e Ocultar do PCP no lugar do Remover do PCP|D-307]] · "Cancelar pedido" e "Ocultar do PCP" no lugar do "Remover do PCP"
- [[D-311 - O pedido excluido no Tiny sai do PCP de vez e segue o caminho|D-311]] · O pedido excluído no Tiny sai do PCP de vez e segue o caminho do cancelado
- [[D-312 - O PCP nao libera direto numa coluna que cancela|D-312]] · O PCP não libera direto numa coluna que cancela
- [[D-330 - Mover para o PCP a peca em producao volta ao PCP como vaga|D-330]] · "Mover para o PCP": a peça em produção volta ao PCP como vaga do pedido ou vira…

## Provisórias ⏳ — valem até o dono dizer o contrário (20)

- [[D-168 - O PCP ganha horario de expediente|D-168]] · O PCP ganha horário de expediente
- [[D-169 - O stand-by no PCP|D-169]] · O STAND-BY no PCP
- [[D-212 - Itens que o Tiny muda depois da liberacao|D-212]] · Itens que o Tiny muda depois da liberação
- [[D-215 - A peca ligada ao produto nao a posicao|D-215]] · A peça ligada ao produto, não à posição
- [[D-295 - Arrastar de volta a peca volta a ser do pedido so quando|D-295]] · Arrastar de volta: a peça volta a ser do pedido só quando a vaga dele ainda está aberta;…
- [[D-296 - A reposicao so perde a peca|D-296]] · A reposição só perde a peça
- [[D-297 - Detalhes do cancelamento|D-297]] · Detalhes do cancelamento
- [[D-299 - A aba Cancelados e removidos volta para dentro do PCP|D-299]] · A aba "Cancelados e removidos" volta para dentro do PCP
- [[D-300 - Remover do PCP so a parte do PCP muda|D-300]] · Remover do PCP: só a parte do PCP muda
- [[D-301 - Para onde vai este movel quem aparece para Passar para outro|D-301]] · "Para onde vai este móvel?": quem aparece para "Passar para outro pedido"
- [[D-302 - O destino do movel de pedido cancelado cada escolha e|D-302]] · O destino do móvel de pedido cancelado: cada escolha e as proteções
- [[D-308 - Os detalhes do Cancelar pedido|D-308]] · Os detalhes do "Cancelar pedido"
- [[D-309 - Os detalhes do Ocultar do PCP|D-309]] · Os detalhes do "Ocultar do PCP"
- [[D-310 - Os 30 dias dos Pedidos ocultos moram na linha do PCP e|D-310]] · Os 30 dias dos "Pedidos ocultos" moram na linha do PCP e o admin muda na própria aba
- [[D-313 - Incluir pedido no PCP so o pedido que o PCP mostraria pagina|D-313]] · "Incluir pedido no PCP": só o pedido que o PCP mostraria, página a página ao rolar
- [[D-314 - As abas Cancelados e Pedidos ocultos|D-314]] · As abas "Cancelados" e "Pedidos ocultos"
- [[D-318 - O preenchimento das observacoes antigas|D-318]] · O preenchimento das observações antigas
- [[D-331 - A lista Volta ao PCP com 5 sementes|D-331]] · A lista "Volta ao PCP" com 5 sementes
- [[D-332 - A reposicao que veio da producao|D-332]] · A reposição que veio da produção
- [[D-333 - Usar a mesma peca ao liberar de novo|D-333]] · "Usar a mesma peça" ao liberar de novo

## Revisadas por outra (4) — só para a história

[[D-061 - Cancelamento em tres estagios a aba Cancelados guarda|D-61]] · [[D-075 - O quadrinho do PCP na Visao do dia conta o que o quadro|D-75]] · [[D-087 - Liga desliga da reposicao automatica no Painel admin agendar|D-87]] · [[D-134 - A area PEDIDOS Todos os pedidos sai do PCP e Cancelados sai|D-134]]

## Onde mais ler (só o que a demanda tocar)

- **Banco:** [[Banco - PCP e Liberacao 1]] · [[Banco - PCP e Liberacao 2]] · [[Banco - PCP e Liberacao 3]]
- **Lições:** [[Memoria - Regras de Negocio - Producao PCP Estoque e Rotas 1]] · [[Memoria - Regras de Negocio - Producao PCP Estoque e Rotas 2]] · [[Memoria - Regras de Negocio - Producao PCP Estoque e Rotas 3]]
- **Design:** [[Design - Estoque e PCP]]
<!-- gerado:fim -->
