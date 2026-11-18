---
titulo: "Mapa — Kanban e Produção"
tipo: mapa
area: kanban-producao
atualizado: 2026-11-18
tags: [mapa, moc, area/kanban-producao]
---

# 🗺️ MOC - Kanban e Producao

> O coração da plataforma: cada móvel liberado vira **um card por unidade** que percorre os setores (SECC, CNC, FURAÇÃO, FITAMENTO, METALURGICA, MONTAGEM, LIMPEZA E EMBALAGEM) por arrasto. Cada gesto vira um **fato** que não se apaga; fila, execução, pausa, qualidade e tempo são todos derivados dos fatos. Inclui o card avulso, a janela do card (anexos, conversa, responsáveis), as etiquetas, o filtro dos quadros, o botão Mover e o cancelamento da fabricação.

**No código:** `src/kanban/` (componentes, janela, lançamento) · `src/paginas/QuadroSetor.tsx` · `src/paginas/Estrutura.tsx` (setores e etapas) · `src/paginas/Utilitarios.tsx` · `src/utilitarios/`

**Notas da área:** [[PLT - Visao Geral]] · [[PLT - Requisitos]] · [[PLT - Modelo de Dados (conceito)]] · [[FAB - Estrutura de Producao (Trello e ClickUp)]] · [[FAB - Processo Alvo - Um Clique Um Evento]]

**Perguntas em aberto:** Q-22 (terceirizados) · Q-25 (migração dos cards vivos do ClickUp/Trello) — [[PLT - Perguntas em Aberto]]

## Últimas sessões da área (a mais nova primeiro)

- **51** · [[SESSAO-51 - Entrega Parcial Mantem a Producao e Mover Card para o PCP]] · [[handoff_2026_11_17_sessao51_entrega_parcial_mover_pcp|handoff]]
- **50** · [[SESSAO-50 - Observacao do Item Cancelar e Ocultar no PCP e Editar Endereco da Parada]] · [[handoff_2026_11_12_sessao50_observacao_cancelar_ocultar_endereco|handoff]]
- **48** · [[SESSAO-48 - Cancelar Fabricacao de Verdade - Peca de Pedido Pergunta o Destino]] · [[handoff_2026_11_11_cowork_sessao48_cancelamento_e_recargas|handoff 1]] · [[handoff_2026_11_11_sessao48_cancelar_fabricacao_recargas|handoff 2]]
- **40** · [[SESSAO-40 - Lancar Qualquer Produto Filtro por Pedido e Busca Geral]] · [[handoff_2026_10_23_sessao40_lancar_filtro_busca|handoff]]
- **39** · [[SESSAO-39 - Calendario das Rotas Painel de Motivos Google Maps e Mover]] · [[handoff_2026_10_22_sessao39_calendario_motivos_mover|handoff]]
- **38** · [[SESSAO-38 - Bateria de Ajustes - Cards Rotas Expedicao Stand-by e Login]] · [[handoff_2026_10_21_sessao38_bateria_ajustes|handoff]]
- **31** · [[SESSAO-31 - Kanban Completo - Card Avulso Janela do Card Anexos e Conversa]] · [[handoff_2026_10_14_sessao31_kanban_completo|handoff]]
- **24** · [[SESSAO-24 - Estoque Nucleo - Aguardo Cancelamentos e Alocacao]] · [[handoff_2026_09_27_sessao24_producao_concluida|handoff]]
- **22** · [[SESSAO-22 - Producao - Filas Reais Tempo de PCP e Paginacao]] · [[handoff_2026_09_21_sessao22_filas_tempo_pausa|handoff]]
- **06** · [[SESSAO-06 - Qualidade nas Transicoes]] · [[handoff_2026_08_27_sessao06_qualidade|handoff]]
- **05** · [[SESSAO-05 - Timers e Eventos de Tempo]] · [[handoff_2026_08_27_sessao05_timers|handoff]]
- **04** · [[SESSAO-04 - Kanban Nucleo]] · [[handoff_2026_08_27_sessao04_kanban|handoff]]

<!-- gerado:inicio -->
## Decisões vigentes (22)

- [[D-001 - Unidade do card hibrido|D-1]] · Unidade do card: híbrido
- [[D-002 - Timer dois contadores por etapa dash compara e soma|D-2]] · Timer: dois contadores por etapa, dash compara e soma
- [[D-012 - Setores do dia 1 os do ClickUp estrutura em 2 niveis|D-12]] · Setores do dia 1 = os do ClickUp; estrutura em 2 níveis configurável
- [[D-014 - Etapas internas cadastro livre cada uma com timer proprio|D-14]] · Etapas internas: cadastro livre, cada uma com timer próprio
- [[D-028 - Card do operador dados do produto espaco de imagens som|D-28]] · Card do operador: dados do produto, espaço de imagens, som discreto
- [[D-060 - Rotas das etapas etapa com nome de setor leva ao setor|D-60]] · Rotas das etapas: etapa com nome de setor leva ao setor; CONCLUÍDO leva ao próximo —…
- [[D-099 - A automacao pode mover o card sozinha e serve para tudo quem|D-99]] · A automação pode mover o card sozinha — e serve "para tudo"; quem monta e liga é só o…
- [[D-102 - Trazer de volta um card arquivado bloco da automacao e botao|D-102]] · "Trazer de volta" um card arquivado — bloco da automação e botão do admin
- [[D-126 - A marcacao do estado da peca perfeito atencao danificado vira|D-126]] · A marcação do estado da peça (perfeito/atenção/danificado) vira CONFIGURAÇÃO — por…
- [[D-127 - A LIMPEZA E EMBALAGEM conclui pela etapa EXPEDICAO o botao|D-127]] · A LIMPEZA E EMBALAGEM conclui pela etapa EXPEDIÇÃO — o botão "Concluir produção" sai
- [[D-130 - O ajuste de peca um card avulso de ajuste que leva a peca|D-130]] · O ajuste de peça: um card avulso de "ajuste" que leva a peça de volta à produção com…
- [[D-135 - Ajustes de tela do dono|D-135]] · Ajustes de tela do dono
- [[D-136 - As 6 decisoes provisorias da SESSAO-31 confirmadas pelo dono|D-136]] · As 6 decisões provisórias da SESSAO-31 confirmadas pelo dono
- [[D-173 - O botao MOVER do card a lideranca manda qualquer card|D-173]] · O botão MOVER do card: a liderança manda qualquer card de produção para a FILA de…
- [[D-187 - O FILTRO DOS QUADROS o numero do pedido ou o nome do movel|D-187]] · O FILTRO DOS QUADROS: o número do pedido ou o nome do móvel, em todo quadro de setor, no…
- [[D-188 - A BUSCA GERAL a lupa ao lado do sino acha os cards de TODOS|D-188]] · A BUSCA GERAL: a lupa ao lado do sino acha os cards de TODOS os setores e diz onde cada…
- [[D-190 - O quadro com rolagem so dentro da coluna como no trello|D-190]] · O QUADRO COM ROLAGEM SÓ DENTRO DA COLUNA, como no Trello
- [[D-268 - A Visao do dia conta o que o QUADRO mostra a fila e a coluna|D-268]] · A Visão do dia conta o que o QUADRO mostra: a fila é a coluna da fila (com o card…
- [[D-290 - Mover a peca para CANCELADO ou NAO ENCONTRADO cancela|D-290]] · Mover a peça para CANCELADO ou NÃO ENCONTRADO cancela a fabricação: sai da produção na…
- [[D-312 - O PCP nao libera direto numa coluna que cancela|D-312]] · O PCP não libera direto numa coluna que cancela
- [[D-315 - A observacao do item do Tiny na capa do card|D-315]] · A observação do item do Tiny na capa do card
- [[D-325 - Na entrega parcial o que ainda esta na fabrica CONTINUA|D-325]] · Na entrega parcial, o que ainda está na fábrica CONTINUA em produção; "Limpar da…

## Provisórias ⏳ — valem até o dono dizer o contrário (20)

- [[D-150 - O prazo e a PRIORIDADE do card de producao|D-150]] · O prazo e a PRIORIDADE do card de produção
- [[D-151 - Quem muda a prioridade|D-151]] · Quem muda a prioridade
- [[D-152 - Os RESPONSAVEIS do card por setor|D-152]] · Os RESPONSÁVEIS do card, por setor
- [[D-153 - A etiqueta que fazia o papel de prioridade|D-153]] · A etiqueta que fazia o papel de prioridade
- [[D-154 - O organizador da fila entrega prioridade alfabetica|D-154]] · O organizador da fila: entrega, prioridade, alfabética
- [[D-155 - O card do setor sem o cliente e o card do PCP refeito|D-155]] · O card do setor sem o cliente e o card do PCP refeito
- [[D-167 - O TEMPO UTIL do card so o expediente do setor o PCP nao tem|D-167]] · O TEMPO ÚTIL do card: só o expediente do setor; o PCP não tem fila
- [[D-169 - O stand-by no PCP|D-169]] · O STAND-BY no PCP
- [[D-171 - Onde o pedido em stand-by aparece|D-171]] · Onde o pedido em stand-by aparece
- [[D-291 - Excluir a peca cancelada e arquivar com fato nada e apagado|D-291]] · "Excluir" a peça cancelada é arquivar com fato; nada é apagado
- [[D-292 - Os dias da coluna moram na propria etapa Configuracoes|D-292]] · Os dias da coluna moram na própria etapa: Configurações → Setores e etapas, ao lado de…
- [[D-293 - A limpeza roda dentro da rotina da madrugada que ja existe|D-293]] · A limpeza roda dentro da rotina da madrugada que já existe (a conferência com o Tiny,…
- [[D-294 - So o admin recupera a peca que ja saiu da coluna ela volta|D-294]] · Só o admin recupera a peça que já saiu da coluna; ela volta para a fila do setor dela (a…
- [[D-295 - Arrastar de volta a peca volta a ser do pedido so quando|D-295]] · Arrastar de volta: a peça volta a ser do pedido só quando a vaga dele ainda está aberta;…
- [[D-298 - O acerto das pecas que ja estavam paradas|D-298]] · O acerto das peças que já estavam paradas
- [[D-302 - O destino do movel de pedido cancelado cada escolha e|D-302]] · O destino do móvel de pedido cancelado: cada escolha e as proteções
- [[D-316 - Qual peca mostra qual observacao|D-316]] · Qual peça mostra qual observação
- [[D-317 - Como a observacao aparece|D-317]] · Como a observação aparece
- [[D-318 - O preenchimento das observacoes antigas|D-318]] · O preenchimento das observações antigas
- [[D-326 - Os detalhes da peca que sai e volta pela entrega parcial|D-326]] · Os detalhes da peça que sai e volta pela entrega parcial

## Revisadas por outra (10) — só para a história

[[D-003 - Destino do card manual hoje automacao via API amanha|D-3]] · [[D-009 - Qualidade em 3 estados em TODA transicao com dupla atestacao|D-9]] · [[D-013 - Entrada unica e saidas terminais do fluxo|D-13]] · [[D-022 - Kanban liberacao parcial destino livre PCP com visao completa|D-22]] · [[D-024 - Execucao varios cards por pessoa com limite configuravel|D-24]] · [[D-025 - Qualidade nas transicoes detalhes de execucao|D-25]] · [[D-048 - Execucao um por vez com pausa por lider tempo de PCP e|D-48]] · [[D-059 - Quadros de producao so por arrasto o unico botao e Concluir|D-59]] · [[D-101 - Utilitarios etiquetas varias por card so a automacao poe|D-101]] · [[D-125 - O card avulso quem cria como termina vinculo etiquetas quem|D-125]]

## Onde mais ler (só o que a demanda tocar)

- **Banco:** [[Banco - Cards e Eventos do Kanban]] · [[Banco - Plataforma - Visao Geral das Tabelas plt]] · [[Banco - Setores Etapas e Execucao]]
- **Lições:** [[Memoria - Front Telas e React 1]] · [[Memoria - Front Telas e React 2]] · [[Memoria - Regras de Negocio - Producao PCP Estoque e Rotas 1]] · [[Memoria - Regras de Negocio - Producao PCP Estoque e Rotas 2]] · [[Memoria - Regras de Negocio - Producao PCP Estoque e Rotas 3]]
- **Design:** [[Design - Kanban Execucao e Qualidade]]
<!-- gerado:fim -->
