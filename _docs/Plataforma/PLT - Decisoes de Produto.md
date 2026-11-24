---
titulo: Plataforma — Decisões de Produto
tipo: indice
data: 2026-08-19
atualizado: 2026-11-18
tags: [plataforma, decisoes, produto]
---

# ⚖️ PLT — Decisões de Produto

> [!abstract] Como usar
> Toda decisão estrutural da plataforma ganha um ID (`D-NN`), a data, o que foi decidido e as alternativas descartadas. **Decisão revisada nunca é apagada** — ganha `↩️ revisada em AAAA-MM-DD`. Antes de propor qualquer arquitetura ou tela, ler este arquivo.

> [!info] ↪️ 18/11/2026 (SESSAO-49) — este arquivo virou o ÍNDICE
> Cada decisão mora agora na sua própria nota, em `Plataforma/Decisoes/` (`D-NNN - o que a decisão faz`), com o texto original intacto. **Não leia este índice inteiro:** leia o mapa da área (`Mapas/`) e abra só as decisões que ele aponta. Decisão nova = **nota nova** naquela pasta (copie o frontmatter de uma vizinha) — a lista abaixo é gerada por `node scripts/cofre/verificar.mjs --gerar`, ninguém a mantém à mão.

<!-- gerado:inicio -->
## As decisões, por área

**346 decisões** · 156 vigentes · 145 provisórias ⏳ (valem até o dono dizer o contrário) · 45 revisadas por outra. **Próxima livre: D-390.** A área é a principal da decisão; o mapa de cada área (`Mapas/`) lista também as que a tocam de lado.

### Kanban e Produção (34) — [[MOC - Kanban e Producao]]

- [[D-001 - Unidade do card hibrido|D-1]] · Unidade do card: híbrido
- [[D-012 - Setores do dia 1 os do ClickUp estrutura em 2 niveis|D-12]] · Setores do dia 1 = os do ClickUp; estrutura em 2 níveis configurável
- [[D-014 - Etapas internas cadastro livre cada uma com timer proprio|D-14]] · Etapas internas: cadastro livre, cada uma com timer próprio
- [[D-028 - Card do operador dados do produto espaco de imagens som|D-28]] · Card do operador: dados do produto, espaço de imagens, som discreto
- [[D-060 - Rotas das etapas etapa com nome de setor leva ao setor|D-60]] · Rotas das etapas: etapa com nome de setor leva ao setor; CONCLUÍDO leva ao próximo — SECC e CNC…
- [[D-102 - Trazer de volta um card arquivado bloco da automacao e botao|D-102]] · "Trazer de volta" um card arquivado — bloco da automação e botão do admin
- [[D-126 - A marcacao do estado da peca perfeito atencao danificado vira|D-126]] · A marcação do estado da peça (perfeito/atenção/danificado) vira CONFIGURAÇÃO — por setor, por…
- [[D-127 - A LIMPEZA E EMBALAGEM conclui pela etapa EXPEDICAO o botao|D-127]] · A LIMPEZA E EMBALAGEM conclui pela etapa EXPEDIÇÃO — o botão "Concluir produção" sai
- [[D-130 - O ajuste de peca um card avulso de ajuste que leva a peca|D-130]] · O ajuste de peça: um card avulso de "ajuste" que leva a peça de volta à produção com DESTINO…
- [[D-135 - Ajustes de tela do dono|D-135]] · Ajustes de tela do dono
- [[D-136 - As 6 decisoes provisorias da SESSAO-31 confirmadas pelo dono|D-136]] · As 6 decisões provisórias da SESSAO-31 confirmadas pelo dono
- [[D-150 - O prazo e a PRIORIDADE do card de producao|D-150]] · O prazo e a PRIORIDADE do card de produção ⏳
- [[D-151 - Quem muda a prioridade|D-151]] · Quem muda a prioridade ⏳
- [[D-152 - Os RESPONSAVEIS do card por setor|D-152]] · Os RESPONSÁVEIS do card, por setor ⏳
- [[D-153 - A etiqueta que fazia o papel de prioridade|D-153]] · A etiqueta que fazia o papel de prioridade ⏳
- [[D-154 - O organizador da fila entrega prioridade alfabetica|D-154]] · O organizador da fila: entrega, prioridade, alfabética ⏳
- [[D-155 - O card do setor sem o cliente e o card do PCP refeito|D-155]] · O card do setor sem o cliente e o card do PCP refeito ⏳
- [[D-171 - Onde o pedido em stand-by aparece|D-171]] · Onde o pedido em stand-by aparece ⏳
- [[D-173 - O botao MOVER do card a lideranca manda qualquer card|D-173]] · O botão MOVER do card: a liderança manda qualquer card de produção para a FILA de qualquer…
- [[D-187 - O FILTRO DOS QUADROS o numero do pedido ou o nome do movel|D-187]] · O FILTRO DOS QUADROS: o número do pedido ou o nome do móvel, em todo quadro de setor, no tablet…
- [[D-190 - O quadro com rolagem so dentro da coluna como no trello|D-190]] · O QUADRO COM ROLAGEM SÓ DENTRO DA COLUNA, como no Trello
- [[D-290 - Mover a peca para CANCELADO ou NAO ENCONTRADO cancela|D-290]] · Mover a peça para CANCELADO ou NÃO ENCONTRADO cancela a fabricação: sai da produção na hora,…
- [[D-291 - Excluir a peca cancelada e arquivar com fato nada e apagado|D-291]] · "Excluir" a peça cancelada é arquivar com fato; nada é apagado ⏳
- [[D-292 - Os dias da coluna moram na propria etapa Configuracoes|D-292]] · Os dias da coluna moram na própria etapa: Configurações → Setores e etapas, ao lado de "Cancela… ⏳
- [[D-293 - A limpeza roda dentro da rotina da madrugada que ja existe|D-293]] · A limpeza roda dentro da rotina da madrugada que já existe (a conferência com o Tiny, 03:00 de… ⏳
- [[D-294 - So o admin recupera a peca que ja saiu da coluna ela volta|D-294]] · Só o admin recupera a peça que já saiu da coluna; ela volta para a fila do setor dela (a LIMPEZA… ⏳
- [[D-295 - Arrastar de volta a peca volta a ser do pedido so quando|D-295]] · Arrastar de volta: a peça volta a ser do pedido só quando a vaga dele ainda está aberta; senão… ⏳
- [[D-298 - O acerto das pecas que ja estavam paradas|D-298]] · O acerto das peças que já estavam paradas ⏳
- [[D-302 - O destino do movel de pedido cancelado cada escolha e|D-302]] · O destino do móvel de pedido cancelado: cada escolha e as proteções ⏳
- [[D-312 - O PCP nao libera direto numa coluna que cancela|D-312]] · O PCP não libera direto numa coluna que cancela
- [[D-316 - Qual peca mostra qual observacao|D-316]] · Qual peça mostra qual observação ⏳
- [[D-317 - Como a observacao aparece|D-317]] · Como a observação aparece ⏳
- [[D-318 - O preenchimento das observacoes antigas|D-318]] · O preenchimento das observações antigas ⏳
- [[D-326 - Os detalhes da peca que sai e volta pela entrega parcial|D-326]] · Os detalhes da peça que sai e volta pela entrega parcial ⏳

### PCP (29) — [[MOC - PCP]]

- [[D-063 - Frete nao vira peca de producao o resto nasce no PCP e o PCP|D-63]] · Frete não vira peça de produção; o resto nasce no PCP e o PCP escolhe o lugar; pedido sem nada a…
- [[D-085 - Reposicao parada 2 dias uteis da FABRICA seg sex no PCP sai|D-85]] · Reposição parada 2 dias úteis da FÁBRICA (seg–sex) no PCP sai sozinha — o Sistema assina;…
- [[D-088 - O PCP em tres abas Reabastecimento Pedidos aguardando|D-88]] · O PCP em três abas: Reabastecimento · Pedidos aguardando liberação · Todos os pedidos;…
- [[D-090 - Reposicao automatica e escolha da operacao nao pendencia|D-90]] · Reposição automática é escolha da operação, não pendência do dono
- [[D-096 - O pedido vivo que so a conferencia achou entra no PCP|D-96]] · O pedido vivo que só a conferência achou entra no PCP
- [[D-117 - PCP do super admin seletor de situacao do pedido e arquivar|D-117]] · PCP do super admin: seletor de situação do pedido e arquivar em massa — sem mexer no Tiny
- [[D-120 - O pedido entregue sai da ROTAS e mora no PCP com tudo dele|D-120]] · O pedido entregue sai da ROTAS e mora no PCP, com tudo dele num clique
- [[D-132 - O PCP segue o Tiny pedido Faturado Pronto para envio|D-132]] · O PCP segue o Tiny: pedido Faturado, Pronto para envio ou Enviado sai do PCP
- [[D-168 - O PCP ganha horario de expediente|D-168]] · O PCP ganha horário de expediente ⏳
- [[D-169 - O stand-by no PCP|D-169]] · O STAND-BY no PCP ⏳
- [[D-201 - O PEDIDO NOVO USA PELO PCP A PECA SEM DONO QUE JA ESTA|D-201]] · O PEDIDO NOVO USA, PELO PCP, A PEÇA SEM DONO QUE JÁ ESTÁ EM PRODUÇÃO — da reposição de estoque…
- [[D-212 - Itens que o Tiny muda depois da liberacao|D-212]] · Itens que o Tiny muda depois da liberação ⏳
- [[D-215 - A peca ligada ao produto nao a posicao|D-215]] · A peça ligada ao produto, não à posição ⏳
- [[D-269 - O cancelamento no Tiny FECHA o stand-by do pedido na hora|D-269]] · O cancelamento no Tiny FECHA o stand-by do pedido, na hora do cancelamento; o painel de Motivos…
- [[D-296 - A reposicao so perde a peca|D-296]] · A reposição só perde a peça ⏳
- [[D-297 - Detalhes do cancelamento|D-297]] · Detalhes do cancelamento ⏳
- [[D-299 - A aba Cancelados e removidos volta para dentro do PCP|D-299]] · A aba "Cancelados e removidos" volta para dentro do PCP ⏳
- [[D-300 - Remover do PCP so a parte do PCP muda|D-300]] · Remover do PCP: só a parte do PCP muda ⏳
- [[D-301 - Para onde vai este movel quem aparece para Passar para outro|D-301]] · "Para onde vai este móvel?": quem aparece para "Passar para outro pedido" ⏳
- [[D-307 - Cancelar pedido e Ocultar do PCP no lugar do Remover do PCP|D-307]] · "Cancelar pedido" e "Ocultar do PCP" no lugar do "Remover do PCP"
- [[D-308 - Os detalhes do Cancelar pedido|D-308]] · Os detalhes do "Cancelar pedido" ⏳
- [[D-309 - Os detalhes do Ocultar do PCP|D-309]] · Os detalhes do "Ocultar do PCP" ⏳
- [[D-310 - Os 30 dias dos Pedidos ocultos moram na linha do PCP e|D-310]] · Os 30 dias dos "Pedidos ocultos" moram na linha do PCP e o admin muda na própria aba ⏳
- [[D-313 - Incluir pedido no PCP so o pedido que o PCP mostraria pagina|D-313]] · "Incluir pedido no PCP": só o pedido que o PCP mostraria, página a página ao rolar ⏳
- [[D-314 - As abas Cancelados e Pedidos ocultos|D-314]] · As abas "Cancelados" e "Pedidos ocultos" ⏳
- [[D-330 - Mover para o PCP a peca em producao volta ao PCP como vaga|D-330]] · "Mover para o PCP": a peça em produção volta ao PCP como vaga do pedido ou vira reposição de…
- [[D-331 - A lista Volta ao PCP com 5 sementes|D-331]] · A lista "Volta ao PCP" com 5 sementes ⏳
- [[D-332 - A reposicao que veio da producao|D-332]] · A reposição que veio da produção ⏳
- [[D-333 - Usar a mesma peca ao liberar de novo|D-333]] · "Usar a mesma peça" ao liberar de novo ⏳

### Estoque (19) — [[MOC - Estoque]]

- [[D-007 - Estoque modulo da mesma plataforma fase 2|D-7]] · Estoque: módulo da mesma plataforma, fase 2
- [[D-053 - Estoque na frente a 25 troca de ordem com a 24 e absorve|D-53]] · Estoque na frente: a 25 troca de ordem com a 24 e absorve o estoque-base
- [[D-056 - O ID da peca e o SKU reservada ganha a segunda etiqueta a|D-56]] · O ID da peça é o SKU; reservada ganha a segunda etiqueta, a do pedido — fecha a Q-63
- [[D-062 - A sugestao do estoque na liberacao o que e peca igual e quem|D-62]] · A sugestão do estoque na liberação: o que é "peça igual" e quem aceita
- [[D-070 - O estoque dos acabados e a CONTAGEM da logistica entrada|D-70]] · O estoque dos acabados é a CONTAGEM da logística (entrada, baixa e contagem manual) — o Tiny sai…
- [[D-073 - Foto de cada produto no estoque so a logistica e o admin|D-73]] · Foto de cada produto no estoque — só a logística e o admin cadastram
- [[D-074 - Estoque enxuto i no lugar do texto abas em quadrados no canto|D-74]] · Estoque enxuto: "i" no lugar do texto, abas em quadrados no canto superior direito, cartão com a…
- [[D-076 - O Tiny sobe a plataforma vale o saldo SOMADO das duas|D-76]] · O Tiny sobe a plataforma: vale o saldo SOMADO das duas empresas; Tiny acima → a plataforma sobe…
- [[D-077 - A plataforma manda no Tiny entrada baixa e contagem daqui|D-77]] · A plataforma manda no Tiny: entrada, baixa e contagem daqui deixam o Tiny com o número da…
- [[D-078 - A venda reserva a peca na hora o pedido segue no PCP|D-78]] · A venda reserva a peça na hora; o pedido segue no PCP, que decide; nada da venda vai ao Tiny
- [[D-079 - Ponto de partida ligar copia uma vez o saldo do Tiny tudo|D-79]] · Ponto de partida: ligar copia uma vez o saldo do Tiny; tudo nasce desligado e só o admin liga
- [[D-081 - As fotos dos produtos vem do Tiny e aparecem inteiras sem|D-81]] · As fotos dos produtos vêm do Tiny e aparecem inteiras, sem corte
- [[D-083 - O Top X manda no estoque e o tamanho da pagina e so ele tem|D-83]] · O Top X manda no estoque: é o tamanho da página e só ele tem mínimo; a capacidade do galpão sai…
- [[D-084 - Sugestao por dias uteis de VENDA loja seg sab e minimo|D-84]] · Sugestão por dias úteis de VENDA (loja seg–sáb) e mínimo AUTOMÁTICO que trava ao editar; corte…
- [[D-118 - Reservados em venda ate a ENTREGA|D-118]] · Reservados em venda até a ENTREGA
- [[D-119 - Os numeros do estoque ficam PRONTOS no banco o ranking|D-119]] · Os números do estoque ficam PRONTOS no banco; o ranking das vendas anda de madrugada
- [[D-138 - SESSAO-32 o OK dos indices e os insumos separados dos moveis|D-138]] · SESSAO-32: o OK dos índices e os insumos separados dos móveis no estoque
- [[D-186 - Lancar qualquer movel para producao a qualquer momento|D-186]] · LANÇAR QUALQUER MÓVEL PARA PRODUÇÃO, A QUALQUER MOMENTO — o mesmo ícone da fábrica em todo…
- [[D-220 - O PCP e o Estoque falam das mesmas pecas com as mesmas|D-220]] · O PCP e o Estoque falam das mesmas peças com as mesmas palavras ⏳

### Expedição (8) — [[MOC - Expedicao]]

- [[D-133 - A Expedicao mostra so pedido vivo a previsao mais proxima|D-133]] · A Expedição mostra só pedido vivo, a previsão mais próxima primeiro
- [[D-157 - A Expedicao absorve Pedidos em aguardo os filtros|D-157]] · A Expedição absorve "Pedidos em aguardo": os filtros em quadradinhos e o fim da tela do aguardo ⏳
- [[D-219 - A Expedicao LIBERA a peca pronta para outro pedido|D-219]] · A Expedição LIBERA a peça pronta para outro pedido ⏳
- [[D-272 - O pedido em stand-by tambem entra na regra do adiantado|D-272]] · O pedido em stand-by também entra na regra do adiantado com falta ⏳
- [[D-273 - Quadradinho Saiu do PCP pelo Tiny nos filtros da Expedicao|D-273]] · Quadradinho "Saiu do PCP pelo Tiny" nos filtros da Expedição ⏳
- [[D-274 - Com a ida ao Tiny desligada os botoes de voltar ao PCP ficam|D-274]] · Com a ida ao Tiny desligada, os botões de voltar ao PCP ficam apagados, com a explicação ⏳
- [[D-275 - Detalhes do pedido adiantado no Tiny|D-275]] · Detalhes do pedido adiantado no Tiny ⏳
- [[D-343 - Na devolucao a entrega com dia escolhido ou corrigido aparece|D-343]] · Na devolução a entrega com dia escolhido ou corrigido aparece só com o dia ⏳

### Logística e ROTAS (70) — [[MOC - Logistica e ROTAS]]

- [[D-093 - O endereco do cliente que o Tiny manda e o endereco|D-93]] · O endereço do cliente que o Tiny manda é o endereço de entrega das ROTAS
- [[D-108 - A rota da Programacao e calculada PELAS RUAS parte da fabrica|D-108]] · A rota da Programação é calculada PELAS RUAS, parte da fábrica e VOLTA para ela; distância e…
- [[D-112 - Busca de enderecos recusa do servico nao e nao existe|D-112]] · Busca de endereços: recusa do serviço não é "não existe"; um segundo buscador gratuito quando o…
- [[D-113 - Entregue e um fato so dos dois lados e entregue no Tiny fecha|D-113]] · "Entregue" é um fato só, dos dois lados — e entregue no Tiny fecha TUDO do pedido aqui
- [[D-116 - Motivos de nao entregue e de desfazer a entrega|D-116]] · Motivos de "não entregue" e de "desfazer a entrega" em Configurações → Utilitários
- [[D-121 - Entregas do dia e uma aba de ROTAS Entregas nao um filho|D-121]] · "Entregas do dia" é uma aba de ROTAS → Entregas, não um filho do menu
- [[D-128 - Varias rotas por dia no mesmo caminhao cada rota com o seu|D-128]] · Várias rotas por dia no mesmo caminhão — cada rota com o seu dia, a sua ordem e a sua equipe
- [[D-129 - Devolucao o entregador nao marca mais Pedido devolvido|D-129]] · Devolução: o entregador não marca mais "Pedido devolvido"; a LOGÍSTICA marca, as peças ficam "Em…
- [[D-156 - A rota aceita QUALQUER pedido vivo o Lancar para ROTAS deixa|D-156]] · A rota aceita QUALQUER pedido vivo; o "Lançar para ROTAS" deixa de ser passo ⏳
- [[D-158 - A equipe da rota so entregador|D-158]] · A equipe da rota: só entregador ⏳
- [[D-159 - O mapa da rota So a ida e So a volta o Programar sem espaco|D-159]] · O mapa da rota: "Só a ida" e "Só a volta"; o "Programar" sem espaço vazio ⏳
- [[D-170 - Lancar direto para as entregas e Devolver|D-170]] · "Lançar direto para as entregas" e "Devolver" ⏳
- [[D-174 - A rota no GOOGLE MAPS e no WAZE o link oficial sem custo|D-174]] · A rota no GOOGLE MAPS e no WAZE: o link oficial, sem custo, na ordem da plataforma; o entregador…
- [[D-175 - O CALENDARIO da programacao um modo de ver dentro de Rotas|D-175]] · O CALENDÁRIO da programação: um modo de ver dentro de Rotas → Programação, no formato do…
- [[D-193 - O ENDERECO DE ENTREGA DO PEDIDO vale na logistica inteiro sem|D-193]] · O ENDEREÇO DE ENTREGA DO PEDIDO vale na logística, inteiro; sem ele, o do cadastro
- [[D-196 - A PARADA AVULSA NA ROTA titulo endereco com pino observacao|D-196]] · A PARADA AVULSA NA ROTA: título, endereço com pino, observação, Feita/Não feita; a ordem…
- [[D-199 - FILTROS NA PROGRAMACAO DE CAMINHAO a lista para programar|D-199]] · FILTROS NA PROGRAMAÇÃO DE CAMINHÃO — a lista para programar com busca, situação, previsão,…
- [[D-213 - Reabrir a entrega|D-213]] · Reabrir a entrega ⏳
- [[D-214 - A volta atras no Tiny|D-214]] · A volta atrás no Tiny ⏳
- [[D-216 - O acerto do 13787|D-216]] · O acerto do 13787 ⏳
- [[D-217 - O Google Maps e o Waze vao pelo ENDERECO do pedido o ponto|D-217]] · O Google Maps e o Waze vão pelo ENDEREÇO do pedido; o ponto só manda quando uma pessoa o… ⏳
- [[D-218 - A busca de endereco confere o BAIRRO e o CEP o que ela nao|D-218]] · A busca de endereço confere o BAIRRO e o CEP; o que ela não acha (ou acha duvidoso) a logística… ⏳
- [[D-221 - A rota vai SEMPRE pelo endereco do cliente o ponto e so|D-221]] · A rota vai SEMPRE pelo endereço do cliente; o ponto é só do mapa da rota (e se acerta à mão);…
- [[D-267 - Pedido cancelado ou excluido no Tiny sai de ROTAS Entregas|D-267]] · Pedido cancelado (ou excluído) no Tiny sai de ROTAS → Entregas → "A entregar", mesmo lançado ou…
- [[D-270 - Fora do calendario conta so o que nao aparece na grade|D-270]] · "Fora do calendário" conta só o que não aparece na grade
- [[D-276 - Marcar como entregue no dia a entrega pode ser registrada|D-276]] · "Marcar como entregue no dia…": a entrega pode ser registrada no dia em que aconteceu de fato,…
- [[D-277 - O dia da entrega nunca fica antes do dia em que o pedido|D-277]] · O dia da entrega nunca fica antes do dia em que o pedido chegou à plataforma ⏳
- [[D-278 - A hora guardada para um dia passado e o fim do expediente|D-278]] · A hora guardada para um dia passado é o fim do expediente da fábrica naquele dia ⏳
- [[D-279 - No calendario das rotas o entregue aparece no dia REAL com|D-279]] · No calendário das rotas o entregue aparece no dia REAL, com a nota do dia programado quando… ⏳
- [[D-280 - Desfazer do dia e o toque repetido contam pelo dia em que|D-280]] · "Desfazer do dia" (e o toque repetido) contam pelo dia em que a entrega foi REGISTRADA, não pelo… ⏳
- [[D-281 - A correcao do dia da entrega motivo opcional registro novo|D-281]] · A correção do dia da entrega: motivo opcional, registro novo feito na hora ⏳
- [[D-282 - Varios comprovantes de uma vez|D-282]] · Vários comprovantes de uma vez
- [[D-283 - Detalhes da entrega no dia real|D-283]] · Detalhes da entrega no dia real ⏳
- [[D-319 - Editar o endereco de entrega do pedido com o original do Tiny|D-319]] · Editar o endereço de entrega do pedido, com o original do Tiny guardado e a pergunta "salvar…
- [[D-321 - O Tiny mudando o endereco por fora vence e avisa|D-321]] · O Tiny mudando o endereço por fora vence e avisa ⏳
- [[D-322 - Os detalhes do endereco do pedido|D-322]] · Os detalhes do endereço do pedido ⏳
- [[D-323 - Editar a parada avulsa|D-323]] · Editar a parada avulsa ⏳
- [[D-324 - Em Ja programadas o selo do endereco alterado fica na janela|D-324]] · Em "Já programadas" o selo do endereço alterado fica na janela, não no cartão ⏳
- [[D-325 - Na entrega parcial o que ainda esta na fabrica CONTINUA|D-325]] · Na entrega parcial, o que ainda está na fábrica CONTINUA em produção; "Limpar da produção" é a…
- [[D-327 - Revogar a decisao da entrega parcial quantas vezes for preciso|D-327]] · Revogar a decisão da entrega parcial, quantas vezes for preciso
- [[D-328 - Onde o pedido mostra Entregue em parte N de M e a parada|D-328]] · Onde o pedido mostra "Entregue em parte (N de M)" e a parada da rota ⏳
- [[D-329 - So a logistica o PCP e o admin escolhem Limpar da producao|D-329]] · Só a logística, o PCP e o admin escolhem "Limpar da produção" ⏳
- [[D-334 - Os pedidos entregues em parte antes desta sessao|D-334]] · Os pedidos entregues em parte antes desta sessão ⏳
- [[D-340 - A lista de pedidos ganha uma porta nova no banco com a hora do|D-340]] · A lista de pedidos ganha uma porta nova no banco com a hora do registro ⏳
- [[D-341 - A hora da entrega so aparece quando e a hora de verdade|D-341]] · A hora da entrega só aparece quando é a hora de verdade ⏳
- [[D-342 - O texto da linha da entrega na lista de pedidos dia escolhido|D-342]] · O texto da linha da entrega na lista de pedidos dia escolhido e registrado em ⏳
- [[D-346 - Depois que o resto e entregue o selo Entregue em parte some|D-346]] · Depois que o resto é entregue o selo Entregue em parte some das telas da logística ⏳
- [[D-347 - K ainda em producao so com deixar em producao e o pedido|D-347]] · K ainda em produção só com deixar em produção e o pedido aberto ⏳
- [[D-348 - O Calendario da Programacao fica sem o selo Entregue em parte|D-348]] · O Calendário da Programação fica sem o selo Entregue em parte ⏳
- [[D-349 - Em Entregues hoje o aviso em parte vira o selo com os numeros|D-349]] · Em Entregues hoje o aviso em parte vira o selo com os números ⏳
- [[D-350 - ROTAS Entregas fica como estava sem o selo novo|D-350]] · ROTAS → Entregas fica como estava sem o selo novo ⏳
- [[D-368 - A busca de endereco pela Geoapify Photon de reserva Nominatim|D-368]] · A busca de endereço pela Geoapify Photon de reserva Nominatim fora
- [[D-369 - Quando a busca de endereco nao responde a tela avisa e oferece|D-369]] · Quando a busca de endereço não responde a tela avisa e oferece marcar ou tentar de novo
- [[D-370 - A faixa busca de endereco fora mostra desde quando|D-370]] · A faixa busca de endereço fora mostra desde quando
- [[D-371 - A ordem mostrada e a ordem da rota a sugestao so propoe|D-371]] · A ordem mostrada é a ordem da rota — a sugestão só propõe
- [[D-372 - Tirar reprogramar ou remover uma parada nao reordena o resto|D-372]] · Tirar reprogramar ou remover uma parada não reordena o resto da rota
- [[D-373 - O pedido que ganha ponto no mapa nao muda de lugar na rota|D-373]] · O pedido que ganha ponto no mapa não muda de lugar na rota
- [[D-374 - Quem entra numa rota que ja existe vai para o lugar mais perto|D-374]] · Quem entra numa rota que já existe vai para o lugar mais perto
- [[D-375 - Aviso no sino quando a busca de endereco passa 1 hora fora|D-375]] · Aviso no sino quando a busca de endereço passa 1 hora fora
- [[D-376 - Incluir um pedido na montagem poe ele onde o caminho aumenta|D-376]] · Incluir um pedido na montagem põe ele onde o caminho aumenta menos ⏳
- [[D-377 - A numeracao sem buracos da rota e so na tela|D-377]] · A numeração sem buracos da rota é só na tela ⏳
- [[D-378 - A faixa da busca fora so em Rotas e para quem tem endereco|D-378]] · A faixa da busca fora só em Rotas e para quem tem endereço novo a procurar ⏳
- [[D-379 - Os textos dos avisos da busca e da montagem|D-379]] · Os textos dos avisos da busca e da montagem ⏳
- [[D-380 - A pausa entre consultas a Geoapify e as consultas por endereco|D-380]] · A pausa entre consultas à Geoapify e as consultas por endereço ⏳
- [[D-381 - O nao achei fica registrado como procurado pela Geoapify|D-381]] · O não achei fica registrado como procurado pela Geoapify ⏳
- [[D-382 - Tirar com a lista incompleta na tela deixa o resto depois na|D-382]] · Tirar com a lista incompleta na tela deixa o resto depois na ordem que tinha ⏳
- [[D-383 - A montagem com varios pedidos numa rota que ja existe entra no|D-383]] · A montagem com vários pedidos numa rota que já existe entra no fim ⏳
- [[D-384 - A parada avulsa nova segue a regra do lugar mais perto|D-384]] · A parada avulsa nova segue a regra do lugar mais perto ⏳
- [[D-385 - Na montagem um pedido so conta como programar sozinho|D-385]] · Na montagem um pedido só conta como programar sozinho ⏳
- [[D-386 - Dois pedidos no mesmo ponto do mapa ficam juntos o novo antes|D-386]] · Dois pedidos no mesmo ponto do mapa ficam juntos o novo antes ⏳

### Tiny e n8n (19) — [[MOC - Tiny e n8n]]

- [[D-031 - Entrada de pedidos a plataforma le o proprio banco sem tocar|D-31]] · Entrada de pedidos: a plataforma lê o próprio banco, sem tocar o n8n
- [[D-050 - Integracao Tiny banco edicao no Tiny edita aqui apagar|D-50]] · Integração Tiny → banco: edição no Tiny edita aqui, apagar no Tiny NÃO apaga aqui (só…
- [[D-080 - Um fluxo so no n8n para o Tiny da fabrica catalogo estoque|D-80]] · Um fluxo só no n8n para o Tiny da fábrica (catálogo + estoque); a carga avulsa do saldo morre
- [[D-082 - A foto do Tiny chega sozinha a plataforma a da camera fica|D-82]] · A foto do Tiny chega sozinha à plataforma — a da câmera fica, a apagada no Tiny também
- [[D-097 - O nome do cliente e gravado sem o codigo no lugar do apostrofo|D-97]] · O nome do cliente é gravado sem o código no lugar do apóstrofo
- [[D-098 - O cliente e achado pelo cadastro do Tiny o fluxo de vendas|D-98]] · O cliente é achado pelo cadastro do Tiny; o fluxo de vendas passa esse número — item C da…
- [[D-122 - As contas a receber voltam do Tiny todo dia na conferencia|D-122]] · As contas a receber voltam do Tiny todo dia, na conferência da madrugada
- [[D-123 - O Entregue vai ao Tiny mora dentro da automacao do Tiny|D-123]] · O "Entregue vai ao Tiny" mora dentro da automação do Tiny que já existia
- [[D-142 - Integracao completa com o Tiny as 6 perguntas do plano|D-142]] · Integração completa com o Tiny: as 6 perguntas do plano respondidas
- [[D-143 - Tiny completo o plano aprovado inteiro o que o Tiny nao avisa|D-143]] · Tiny completo: o plano aprovado inteiro; o que o Tiny não avisa, de hora em hora só das 8h às…
- [[D-144 - Os dados proprios da conta da FABRICA no Tiny ficam num|D-144]] · Os dados próprios da conta da FÁBRICA no Tiny ficam num módulo à parte — fora do Comercial e da…
- [[D-145 - A consulta de hora em hora pergunta os produtos alterados|D-145]] · A consulta de hora em hora pergunta os produtos alterados SÓ à fábrica
- [[D-148 - O que o Tiny nao avisa fica em dia pela conferencia|D-148]] · O que o Tiny não avisa fica em dia pela conferência da madrugada; o que foi apagado no Tiny é…
- [[D-194 - A data de entrega mudada ou removida so na plataforma o tiny|D-194]] · A DATA DE ENTREGA MUDADA OU REMOVIDA SÓ NA PLATAFORMA; o Tiny mudando a data, vale o Tiny
- [[D-271 - O pedido que o Tiny levou adiante e ainda tem produto|D-271]] · O pedido que o Tiny levou adiante e ainda tem produto por liberar aparece na Expedição com o…
- [[D-311 - O pedido excluido no Tiny sai do PCP de vez e segue o caminho|D-311]] · O pedido excluído no Tiny sai do PCP de vez e segue o caminho do cancelado
- [[D-315 - A observacao do item do Tiny na capa do card|D-315]] · A observação do item do Tiny na capa do card
- [[D-320 - Salvar na plataforma e no Tiny fica desligado por enquanto|D-320]] · "Salvar na plataforma e no Tiny" fica desligado por enquanto, com o porquê ⏳
- [[D-365 - API e integracoes rele as tres listas numa chamada so|D-365]] · API e integrações relê as três listas numa chamada só ⏳

### Tablet e TV (5) — [[MOC - Tablet e TV]]

- [[D-006 - Dispositivos tablet PC fixo por setor E celular pessoal|D-6]] · Dispositivos: tablet/PC fixo por setor E celular pessoal
- [[D-146 - Tablet 2 0 as 13 respostas provisorias da SESSAO-36|D-146]] · Tablet 2.0: as 13 respostas provisórias da SESSAO-36 + as escolhas extras do Claude ⏳
- [[D-147 - A arrumacao para entrar em producao limpa geral PINs curtos|D-147]] · A arrumação para entrar em produção: limpa geral, PINs curtos, dois níveis novos, pausa por…
- [[D-230 - A permissao Modo TV|D-230]] · A permissão Modo TV ⏳
- [[D-231 - O modo TV|D-231]] · O Modo TV ⏳

### Tempos e Painéis (39) — [[MOC - Tempos e Paineis]]

- [[D-002 - Timer dois contadores por etapa dash compara e soma|D-2]] · Timer: dois contadores por etapa, dash compara e soma
- [[D-029 - Controle de tempo pelo admin horario de funcionamento pausas|D-29]] · Controle de tempo pelo admin: horário de funcionamento, pausas manuais e correção retroativa
- [[D-042 - Dashboards guiados por imagem docs inspiracao dashboards e|D-42]] · Dashboards guiados por imagem: docs/inspiracao/dashboards/ é a régua
- [[D-094 - Bonificacao descartada|D-94]] · Bonificação descartada
- [[D-164 - Motivos de pausa ESPECIAIS Faltou peca Maquina quebrou|D-164]] · Motivos de pausa ESPECIAIS: "Faltou peça", "Máquina quebrou" e "Pausa solicitada por um líder" —…
- [[D-165 - O que nao contar o tempo quer dizer com precisao|D-165]] · O que "não contar o tempo" quer dizer, com precisão ⏳
- [[D-166 - O tempo do CARD nao muda com a pausa especial|D-166]] · O tempo do CARD não muda com a pausa especial ⏳
- [[D-167 - O TEMPO UTIL do card so o expediente do setor o PCP nao tem|D-167]] · O TEMPO ÚTIL do card: só o expediente do setor; o PCP não tem fila ⏳
- [[D-172 - A regua do tempo util vem na abertura do app Lei 2 8|D-172]] · A régua do tempo útil vem na abertura do app — Lei §2/§8 ⏳
- [[D-176 - O PAINEL DE MOTIVOS os maiores problemas da fabrica e|D-176]] · O PAINEL DE MOTIVOS: os maiores problemas da fábrica e das rotas, do maior para o menor
- [[D-197 - Sem card so 5 minutos contam como trabalho a tela segue|D-197]] · SEM CARD, SÓ 5 MINUTOS CONTAM COMO TRABALHO — a tela segue mostrando "trabalhando" até 15
- [[D-198 - O CARD ESQUECIDO na MONTAGEM 2 h rodando sem parar perguntam|D-198]] · O CARD ESQUECIDO: na MONTAGEM, 2 h rodando sem parar perguntam "ainda tem alguém neste card?" —…
- [[D-203 - O TEMPO CERTO o calendario da fabrica a pausa sozinha no fim|D-203]] · O TEMPO CERTO: o calendário da fábrica, a pausa sozinha no fim do expediente, as regras de tempo…
- [[D-204 - O que e o fim do expediente de um trecho|D-204]] · O que é o "fim do expediente" de um trecho ⏳
- [[D-205 - O trabalho simultaneo da mesma pessoa e dividido a forma|D-205]] · O trabalho simultâneo da mesma pessoa é dividido (a forma geral da resposta 12) ⏳
- [[D-206 - Retrabalho quais passagens saem da media|D-206]] · Retrabalho: quais passagens saem da média ⏳
- [[D-207 - Gesto de administrador|D-207]] · Gesto de administrador ⏳
- [[D-208 - A data oficial tira so das MEDIAS o tempo da pessoa conta|D-208]] · A data oficial tira só das MÉDIAS; o tempo da pessoa conta ⏳
- [[D-209 - Os dias da conta|D-209]] · Os dias da conta ⏳
- [[D-210 - O modelo sugerido pelo nome|D-210]] · O modelo sugerido pelo nome ⏳
- [[D-211 - Pequenas escolhas da tela e da regra|D-211]] · Pequenas escolhas da tela e da regra ⏳
- [[D-225 - Sem ranking nas abas internas ficam os Melhores tempos e|D-225]] · Sem ranking nas abas internas; ficam os "Melhores tempos" e o "Melhor da semana" ⏳
- [[D-226 - O que entra nas contas da tela Tempos de producao|D-226]] · O que entra nas contas da tela Tempos de produção ⏳
- [[D-227 - Quem ve o que na tela de tempos|D-227]] · Quem vê o quê na tela de tempos ⏳
- [[D-228 - A conferencia do historico do Trello e a lista Motivos|D-228]] · A conferência do histórico do Trello e a lista "Motivos de conferência" ⏳
- [[D-229 - A carga do historico do Trello|D-229]] · A carga do histórico do Trello ⏳
- [[D-232 - Tempo por setor mora dentro de Tempos de producao|D-232]] · "Tempo por setor" mora dentro de Tempos de produção ⏳
- [[D-233 - Periodos longos com 100 vezes o movimento de hoje passam|D-233]] · Períodos longos com 100 vezes o movimento de hoje passam do tempo-limite ⏳
- [[D-268 - A Visao do dia conta o que o QUADRO mostra a fila e a coluna|D-268]] · A Visão do dia conta o que o QUADRO mostra: a fila é a coluna da fila (com o card avulso), em…
- [[D-284 - Configurar painel em Tempos de producao uma configuracao|D-284]] · "Configurar painel" em Tempos de produção: uma configuração só, do admin, que vale para a tela e…
- [[D-285 - So o admin ve o botao Configurar painel e so ele salva|D-285]] · Só o admin vê o botão "Configurar painel" e só ele salva ⏳
- [[D-286 - Tres tipos de grafico empilhadas por montador barras e linhas|D-286]] · Três tipos de gráfico: empilhadas por montador, barras e linhas ⏳
- [[D-287 - Dupla com um desligado aparece como a letra ou o nome de quem|D-287]] · Dupla com um desligado aparece como a letra (ou o nome) de quem está ligado + "Outros" ⏳
- [[D-288 - A linha do tempo padrao virou uma marca na linha do dia|D-288]] · A "linha do tempo padrão" virou uma marca na linha do dia da aba Dia ⏳
- [[D-289 - Detalhes da configuracao do painel|D-289]] · Detalhes da configuração do painel ⏳
- [[D-358 - A porta de abertura junta as leituras de sempre e nao as|D-358]] · A porta de abertura junta as leituras de sempre e não as reescreve ⏳
- [[D-359 - O periodo dos paineis e resolvido no banco|D-359]] · O período dos painéis é resolvido no banco ⏳
- [[D-360 - O guardado dos paineis vale 30 segundos pelo endereco|D-360]] · O guardado dos painéis vale 30 segundos pelo endereço ⏳
- [[D-364 - As metas de Pessoas ganham guardado proprio|D-364]] · As metas de Pessoas ganham guardado próprio ⏳

### Comercial (9) — [[MOC - Comercial]]

- [[D-046 - Uniao das Plataformas o Painel de Recompra vira o modulo|D-46]] · União das Plataformas: o Painel de Recompra vira o módulo Comercial
- [[D-139 - SESSAO-32 o Comercial abre no mes atual e o periodo inteiro|D-139]] · SESSAO-32: o Comercial abre no mês atual e o período inteiro vem pronto do banco
- [[D-351 - A janela de confirmacao do Comercial pergunta no titulo e|D-351]] · A janela de confirmação do Comercial pergunta no título e avisa no corpo ⏳
- [[D-352 - Os avisos do Comercial sao os da casa e somem em 5 segundos|D-352]] · Os avisos do Comercial são os da casa e somem em 5 segundos ⏳
- [[D-353 - O texto de remover membros diz o que acontece com quem sai da|D-353]] · O texto de remover membros diz o que acontece com quem sai da lista ⏳
- [[D-354 - Os erros de parar o disparo e encerrar ganham titulo proprio|D-354]] · Os erros de parar o disparo e encerrar ganham título próprio ⏳
- [[D-355 - Durante o gesto a janela fica aberta com o botao girando|D-355]] · Durante o gesto a janela fica aberta com o botão girando ⏳
- [[D-356 - Trocar a ordem da tabela de clientes volta a pagina 1|D-356]] · Trocar a ordem da tabela de clientes volta à página 1 ⏳
- [[D-357 - A ordem da tabela de clientes viaja dentro dos filtros|D-357]] · A ordem da tabela de clientes viaja dentro dos filtros ⏳

### Acesso e Usuários (11) — [[MOC - Acesso e Usuarios]]

- [[D-021 - Identidade e acesso uma tabela matricula senha padrao|D-21]] · Identidade e acesso: uma tabela, matrícula, senha padrão com troca obrigatória
- [[D-041 - Identidade Meu Perfil com 8 temas Domoby login com logo|D-41]] · Identidade: Meu Perfil com 8 temas Domoby; login com logo metálica
- [[D-043 - Meu Perfil nome de login editavel pelo proprio e-mail tambem|D-43]] · Meu Perfil: nome de login editável pelo próprio, e-mail também, foto própria, log de tudo
- [[D-049 - Saida de usuario excluir de fato so sem historia arquivar|D-49]] · Saída de usuário: excluir de fato só sem história; arquivar realoca as pendências ao líder
- [[D-052 - Cadastro de ADMIN nao exige setor|D-52]] · Cadastro de ADMIN não exige setor
- [[D-068 - Dados sensiveis do cadastro fora da API|D-68]] · Dados sensíveis do cadastro fora da API
- [[D-091 - Tres tipos de usuario da fabrica do comercial e dos dois|D-91]] · Três tipos de usuário — da fábrica, do comercial e dos dois — com permissões bem definidas; o…
- [[D-163 - Entrar sem digitar o e-mail o aparelho lembra o nome|D-163]] · Entrar sem digitar o e-mail: o aparelho lembra o nome de usuário, e o PIN aceita usuário
- [[D-191 - ESQUECI MINHA SENHA LIBERADO POR UM ADMINISTRADOR aviso|D-191]] · "ESQUECI MINHA SENHA" LIBERADO POR UM ADMINISTRADOR: aviso urgente na tela, 2 h, uma troca, só…
- [[D-192 - A REVISAO DE SEGURANCA a segunda camada de permissoes a trava|D-192]] · A REVISÃO DE SEGURANÇA: a segunda camada de permissões, a trava geral do PIN de setor e os…
- [[D-200 - O PEDIDO DE TROCA DE SENHA PARA E-MAIL SEM CADASTRO AVISA|D-200]] · O PEDIDO DE TROCA DE SENHA PARA E-MAIL SEM CADASTRO AVISA OS ADMINISTRADORES; a tela de quem…

### Auditoria e Logs (4) — [[MOC - Auditoria e Logs]]

- [[D-040 - Auditoria total toda atividade de usuario gera log persistido|D-40]] · Auditoria total: toda atividade de usuário gera log persistido
- [[D-095 - Auditoria no Painel admin o rastro de tudo quem quando onde|D-95]] · Auditoria no Painel admin: o rastro de tudo — quem, quando, onde, o quê e porquê
- [[D-305 - A trilha diz por que a pagina abriu|D-305]] · A trilha diz por que a página abriu ⏳
- [[D-345 - A Auditoria traduz a configuracao do painel de tempos na hora|D-345]] · A Auditoria traduz a configuração do painel de tempos na hora de mostrar ⏳

### Publicação e Infra (11) — [[MOC - Publicacao e Infra]]

- [[D-008 - Banco o mesmo Supabase da fabrica|D-8]] · Banco: o mesmo Supabase da fábrica
- [[D-015 - Stack escolhida pelo Claude Code e imutavel depois|D-15]] · Stack escolhida pelo Claude Code, e imutável depois
- [[D-019 - Banco o projeto da org Tech e o de producao e por ora e onde|D-19]] · Banco: o projeto da org Tech é o de produção, e por ora é onde se trabalha
- [[D-020 - Sem PR e sem protecao de branch enquanto o dono for o unico|D-20]] · Sem PR e sem proteção de branch enquanto o dono for o único
- [[D-047 - Regra permanente nenhuma tabela nova se uma existente pode|D-47]] · Regra permanente: nenhuma tabela nova se uma existente pode ser reutilizada
- [[D-303 - A versao e o codigo e documentacao nao publica a mudanca|D-303]] · A versão é o código e documentação não publica — ⏳ a mudança na Vercel só entra com o OK do dono ⏳
- [[D-304 - O momento seguro de recarregar|D-304]] · O momento seguro de recarregar ⏳
- [[D-306 - A plataforma abre como aplicativo um icone uma janela|D-306]] · A plataforma abre como aplicativo: um ícone, uma janela só
- [[D-335 - Os roteiros do cofre nao publicam o site|D-335]] · Os roteiros do cofre não publicam o site ⏳
- [[D-366 - Telas numa leitura sobem banco antes do site no mesmo gesto|D-366]] · Telas numa leitura sobem banco antes do site no mesmo gesto ⏳
- [[D-367 - Ficam de fora de proposito indice novo paginacao dos cadastros|D-367]] · Ficam de fora de propósito índice novo paginação dos cadastros e a porta do login ⏳

### Meu Painel, Chat e Automações (26) — [[MOC - Meu Painel Chat e Automacoes]]

- [[D-034 - Delegacao 3 modos por setor sorteio entre logados tarefa|D-34]] · Delegação: 3 modos por setor, sorteio entre logados, tarefa avulsa sem timer obrigatório
- [[D-051 - Meu Painel 2 0 tres filas subtarefas tarefa privada e|D-51]] · Meu Painel 2.0: três filas, subtarefas, tarefa privada e o painel pessoal
- [[D-066 - Aniversarios o Sistema publica os parabens nos Avisos gerais|D-66]] · Aniversários: o Sistema publica os parabéns nos Avisos gerais
- [[D-092 - Automacoes so admin cria por ora o modulo e o laboratorio|D-92]] · Automações: só admin cria, por ora; o módulo é o laboratório
- [[D-099 - A automacao pode mover o card sozinha e serve para tudo quem|D-99]] · A automação pode mover o card sozinha — e serve "para tudo"; quem monta e liga é só o super…
- [[D-103 - As regras do motor na hora no banco nunca derruba o gesto|D-103]] · As regras do motor: na hora, no banco, nunca derruba o gesto; cadeia até 5; obedece às regras de…
- [[D-104 - Teste ao vivo com os cards de teste|D-104]] · Teste ao vivo com os cards de teste
- [[D-105 - O editor de uma automacao e uma AREA DE TRABALHO menu|D-105]] · O editor de uma automação é uma ÁREA DE TRABALHO: menu recolhido, canvas na tela toda, barra…
- [[D-106 - O Se senao a condicao com DUAS saidas cada uma com|D-106]] · O "Se… senão": a condição com DUAS saídas, cada uma com os próprios passos
- [[D-107 - Excluir automacao some de vez o que ela fez FICA na Auditoria|D-107]] · Excluir automação: some de vez; o que ela fez FICA na Auditoria, marcado "automação excluída"
- [[D-131 - Mensagens podem ser editadas e apagadas no card e no chat|D-131]] · Mensagens podem ser editadas e apagadas — no card e no chat; a história fica
- [[D-162 - As notificacoes fecham com qualquer toque fora do painel|D-162]] · As notificações fecham com qualquer toque fora do painel
- [[D-202 - OS AVISOS QUE CADA UM RECEBE ESCOLHIDOS EM CONFIGURACOES|D-202]] · OS AVISOS QUE CADA UM RECEBE, ESCOLHIDOS EM CONFIGURAÇÕES → AVISOS; os erros de automação ganham…
- [[D-260 - Tech Sugestao de melhoria o quadro que toda a equipe acompanha|D-260]] · Tech → "Sugestão de melhoria": o quadro que toda a equipe acompanha
- [[D-261 - So o dono super admin move os cards do quadro de sugestoes|D-261]] · Só o dono (super admin) move os cards do quadro de sugestões
- [[D-262 - Recusar exige o motivo que vai no aviso para quem sugeriu|D-262]] · Recusar exige o motivo, que vai no aviso para quem sugeriu
- [[D-263 - Finalizada avisa quem sugeriu ele testa e APROVA ou DEVOLVE|D-263]] · Finalizada avisa quem sugeriu; ele testa e APROVA ou DEVOLVE com uma sugestão nova, com o…
- [[D-264 - A pendencia de teste e uma tarefa do Sistema da pessoa aviso|D-264]] · A pendência de teste é uma tarefa do Sistema da pessoa; aviso e pendência levam à ficha pelo… ⏳
- [[D-265 - A bolinha das sugestoes acompanha todo usuario em toda tela|D-265]] · A bolinha das sugestões acompanha todo usuário, em toda tela, menos o modo tablet ⏳
- [[D-266 - Ordem e numeros do quadro de sugestoes|D-266]] · Ordem e números do quadro de sugestões ⏳
- [[D-361 - O trabalho da pessoa e uma leitura so e traz so o que a tela|D-361]] · O trabalho da pessoa é uma leitura só e traz só o que a tela aberta mostra ⏳
- [[D-362 - O contador de subtarefas vem contado do banco|D-362]] · O contador de subtarefas vem contado do banco ⏳
- [[D-363 - O numero do pedido dos cards vem na mesma porta dos afazeres|D-363]] · O número do pedido dos cards vem na mesma porta dos afazeres ⏳
- [[D-387 - O aviso Busca de endereco fora do ar para admin e logistica|D-387]] · O aviso Busca de endereço fora do ar para admin e logística ⏳
- [[D-388 - A busca que volta nao vira aviso no sino|D-388]] · A busca que volta não vira aviso no sino ⏳
- [[D-389 - A chamada que so leu do guardado tambem avisa a busca fora|D-389]] · A chamada que só leu do guardado também avisa a busca fora ⏳

### Interface e Navegação (6) — [[MOC - Interface e Navegacao]]

- [[D-027 - Padroes de interface menu lateral modelo de sistema no cofre|D-27]] · Padrões de interface: menu lateral, modelo de sistema no cofre, microinterações, sem códigos…
- [[D-036 - Lei de navegacao hierarquia pai filho pai nunca navega rota|D-36]] · Lei de navegação: hierarquia pai→filho, pai nunca navega, rota sempre /pai/filho
- [[D-100 - O Painel admin vira Configuracoes nasce o Painel super admin|D-100]] · O "Painel admin" vira Configurações; nasce o Painel super admin (só o dono): Automações e…
- [[D-161 - O grupo Pedidos do menu mora logo abaixo de Rotas|D-161]] · O grupo "Pedidos" do menu mora logo abaixo de "Rotas"
- [[D-188 - A BUSCA GERAL a lupa ao lado do sino acha os cards de TODOS|D-188]] · A BUSCA GERAL: a lupa ao lado do sino acha os cards de TODOS os setores e diz onde cada um está
- [[D-344 - A busca geral diz Entregue em pelo dia real da entrega|D-344]] · A busca geral diz Entregue em pelo dia real da entrega ⏳

### Processo de Trabalho (11) — [[MOC - Processo de Trabalho]]

- [[D-010 - Metodo de trabalho sessoes Claude Code ordenadas CLAUDE md|D-10]] · Método de trabalho: sessões Claude Code ordenadas + CLAUDE.md com limites
- [[D-016 - Bloco 1 de construcao Sessoes 01 05|D-16]] · Bloco 1 de construção = Sessões 01→05
- [[D-017 - Formato dos prompts do Claude Code minimo so o caminho|D-17]] · Formato dos prompts do Claude Code: mínimo, só o caminho
- [[D-026 - Bloco noturno autonomo sessoes 07 12 sem perguntas durante|D-26]] · Bloco noturno autônomo: sessões 07→12 sem perguntas durante a execução
- [[D-030 - Publicacao adiada nenhum deploy no bloco noturno|D-30]] · Publicação adiada: nenhum deploy no bloco noturno
- [[D-035 - Plataforma funcional primeiro externo em standby Bloco 3|D-35]] · Plataforma funcional primeiro: externo em standby; Bloco 3 = Sessões 13→16 com checkpoint
- [[D-141 - As respostas do dono sobre o que ficou da SESSAO-32 e|D-141]] · As respostas do dono sobre o que ficou da SESSAO-32 e as pendências antigas
- [[D-336 - A leitura por camadas obrigatoria ate 40 KB o mapa da area|D-336]] · A leitura por camadas: obrigatória até 40 KB, o mapa da área e o resto só por ligação ⏳
- [[D-337 - Uma nota por decisao com nome em portugues a citacao vira|D-337]] · Uma nota por decisão, com nome em português; a citação vira ligação com apelido; número pulado… ⏳
- [[D-338 - Os tetos de tamanho do cofre o que e erro o que e aviso|D-338]] · Os tetos de tamanho do cofre: o que é erro, o que é aviso e o que não se cobra ⏳
- [[D-339 - O que saiu da frente o Arquivo a Ordem curta e a copia|D-339]] · O que saiu da frente: o Arquivo, a Ordem curta e a cópia repetida ⏳

### Revisadas por outra decisão (45) — ficam para a história; vale a que revisou

- [[D-003 - Destino do card manual hoje automacao via API amanha|D-3]] · Destino do card: manual hoje, automação via API amanhã → [[D-059 - Quadros de producao so por arrasto o unico botao e Concluir|D-59]], [[D-099 - A automacao pode mover o card sozinha e serve para tudo quem|D-99]]
- [[D-004 - Produtividade e bonificacao|D-4]] · Produtividade e bonificação → [[D-094 - Bonificacao descartada|D-94]]
- [[D-005 - Escopo producao primeiro logistica depois|D-5]] · Escopo: produção primeiro, logística depois → [[D-033 - ROTAS dentro da plataforma ClickUp nao recebe mais nada|D-33]]
- [[D-009 - Qualidade em 3 estados em TODA transicao com dupla atestacao|D-9]] · Qualidade em 3 estados em TODA transição, com dupla atestação → [[D-126 - A marcacao do estado da peca perfeito atencao danificado vira|D-126]]
- [[D-011 - API antecipada entrada de pedidos via n8n logo apos o kanban|D-11]] · API antecipada: entrada de pedidos via n8n logo após o kanban → [[D-023 - Replanejamento da jornada a partir da 5 posicao|D-23]]
- [[D-013 - Entrada unica e saidas terminais do fluxo|D-13]] · Entrada única e saídas terminais do fluxo → [[D-058 - O lugar da peca pronta com pedido Pedidos em aguardo|D-58]]
- [[D-018 - Fins de linha ESTOQUE e ROTAS nascem juntos|D-18]] · Fins de linha: ESTOQUE e ROTAS nascem juntos → [[D-058 - O lugar da peca pronta com pedido Pedidos em aguardo|D-58]]
- [[D-022 - Kanban liberacao parcial destino livre PCP com visao completa|D-22]] · Kanban: liberação parcial, destino livre, PCP com visão completa → [[D-054 - O fluxo do estoque so peca pronta perfeita e sem pedido|D-54]], [[D-125 - O card avulso quem cria como termina vinculo etiquetas quem|D-125]]
- [[D-023 - Replanejamento da jornada a partir da 5 posicao|D-23]] · Replanejamento da jornada a partir da 5ª posição → [[D-030 - Publicacao adiada nenhum deploy no bloco noturno|D-30]]
- [[D-024 - Execucao varios cards por pessoa com limite configuravel|D-24]] · Execução: vários cards por pessoa com limite configurável, iniciar… → [[D-048 - Execucao um por vez com pausa por lider tempo de PCP e|D-48]], [[D-059 - Quadros de producao so por arrasto o unico botao e Concluir|D-59]]
- [[D-025 - Qualidade nas transicoes detalhes de execucao|D-25]] · Qualidade nas transições: detalhes de execução → [[D-126 - A marcacao do estado da peca perfeito atencao danificado vira|D-126]]
- [[D-032 - Dashboards foco pesado em tempo so lider e admin|D-32]] · Dashboards: foco pesado em tempo; só líder e admin → [[D-051 - Meu Painel 2 0 tres filas subtarefas tarefa privada e|D-51]]
- [[D-033 - ROTAS dentro da plataforma ClickUp nao recebe mais nada|D-33]] · ROTAS dentro da plataforma; ClickUp não recebe mais nada → [[D-113 - Entregue e um fato so dos dois lados e entregue no Tiny fecha|D-113]]
- [[D-037 - Tela inicial Meu Painel com cockpit de metas configuraveis|D-37]] · Tela inicial = Meu Painel, com cockpit de metas configuráveis → [[D-051 - Meu Painel 2 0 tres filas subtarefas tarefa privada e|D-51]]
- [[D-038 - Logistica Estoque com ID digitavel sala de Pedidos em aguardo|D-38]] · Logística: Estoque com ID digitável, sala de Pedidos em aguardo,… → [[D-058 - O lugar da peca pronta com pedido Pedidos em aguardo|D-58]], [[D-156 - A rota aceita QUALQUER pedido vivo o Lancar para ROTAS deixa|D-156]]
- [[D-039 - ROTAS programacao de caminhao com mapa e sugestao caminhoes|D-39]] · ROTAS: programação de caminhão com mapa e sugestão; caminhões… → [[D-108 - A rota da Programacao e calculada PELAS RUAS parte da fabrica|D-108]], [[D-156 - A rota aceita QUALQUER pedido vivo o Lancar para ROTAS deixa|D-156]]
- [[D-045 - Logistica e ROTAS unidade pronta lancamento ID de producao|D-45]] · Logística e ROTAS: unidade pronta, lançamento, ID de produção,… → [[D-058 - O lugar da peca pronta com pedido Pedidos em aguardo|D-58]], [[D-113 - Entregue e um fato so dos dois lados e entregue no Tiny fecha|D-113]], [[D-156 - A rota aceita QUALQUER pedido vivo o Lancar para ROTAS deixa|D-156]]
- [[D-048 - Execucao um por vez com pausa por lider tempo de PCP e|D-48]] · Execução um por vez com pausa por líder; tempo de PCP e de aguardo são… → [[D-059 - Quadros de producao so por arrasto o unico botao e Concluir|D-59]]
- [[D-054 - O fluxo do estoque so peca pronta perfeita e sem pedido|D-54]] · O fluxo do estoque: só peça pronta, perfeita e sem pedido; abaixo do… → [[D-070 - O estoque dos acabados e a CONTAGEM da logistica entrada|D-70]], [[D-126 - A marcacao do estado da peca perfeito atencao danificado vira|D-126]], [[D-186 - Lancar qualquer movel para producao a qualquer momento|D-186]]
- [[D-055 - O numero do estoque o do Tiny menos o que a loja ja vendeu|D-55]] · O número do estoque: o do Tiny menos o que a loja já vendeu e ainda… → [[D-070 - O estoque dos acabados e a CONTAGEM da logistica entrada|D-70]]
- [[D-057 - Estoque em duas telas sugestao de minimo pelo top 20|D-57]] · Estoque em duas telas + sugestão de mínimo pelo top 20 → [[D-072 - Minimo e capacidade do galpao na plataforma a sugestao|D-72]]
- [[D-058 - O lugar da peca pronta com pedido Pedidos em aguardo|D-58]] · O lugar da peça pronta: com pedido → Pedidos em aguardo; o ESTOQUE… → [[D-126 - A marcacao do estado da peca perfeito atencao danificado vira|D-126]], [[D-156 - A rota aceita QUALQUER pedido vivo o Lancar para ROTAS deixa|D-156]]
- [[D-059 - Quadros de producao so por arrasto o unico botao e Concluir|D-59]] · Quadros de produção só por arrasto; o único botão é "Concluir… → [[D-125 - O card avulso quem cria como termina vinculo etiquetas quem|D-125]], [[D-127 - A LIMPEZA E EMBALAGEM conclui pela etapa EXPEDICAO o botao|D-127]], [[D-173 - O botao MOVER do card a lideranca manda qualquer card|D-173]]
- [[D-061 - Cancelamento em tres estagios a aba Cancelados guarda|D-61]] · Cancelamento em três estágios; a aba Cancelados guarda para sempre;… → [[D-088 - O PCP em tres abas Reabastecimento Pedidos aguardando|D-88]], [[D-290 - Mover a peca para CANCELADO ou NAO ENCONTRADO cancela|D-290]]
- [[D-065 - Chat interno canais particulares e Avisos gerais quem cria|D-65]] · Chat interno: canais, particulares e Avisos gerais — quem cria, quem… → [[D-131 - Mensagens podem ser editadas e apagadas no card e no chat|D-131]]
- [[D-067 - Chat por websocket leitura so por pagina 10 mensagens 5|D-67]] · Chat por websocket; leitura só por página — 10 mensagens, 5 conversas → [[D-131 - Mensagens podem ser editadas e apagadas no card e no chat|D-131]]
- [[D-071 - Top 20 a tela do estoque abre pelos 20 mais vendidos|D-71]] · Top 20+: a tela do estoque abre pelos 20 mais vendidos; só aparece o… → [[D-083 - O Top X manda no estoque e o tamanho da pagina e so ele tem|D-83]]
- [[D-072 - Minimo e capacidade do galpao na plataforma a sugestao|D-72]] · Mínimo e capacidade do galpão na plataforma; a sugestão de mínimo CABE… → [[D-083 - O Top X manda no estoque e o tamanho da pagina e so ele tem|D-83]], [[D-084 - Sugestao por dias uteis de VENDA loja seg sab e minimo|D-84]]
- [[D-075 - O quadrinho do PCP na Visao do dia conta o que o quadro|D-75]] · O quadrinho do PCP na Visão do dia conta o que o quadro do PCP mostra… → [[D-132 - O PCP segue o Tiny pedido Faturado Pronto para envio|D-132]]
- [[D-086 - Reservados o cartao mostra TUDO que esta em producao|D-86]] · Reservados: o cartão mostra TUDO que está em produção; a NECESSIDADE… → [[D-118 - Reservados em venda ate a ENTREGA|D-118]]
- [[D-087 - Liga desliga da reposicao automatica no Painel admin agendar|D-87]] · Liga/desliga da reposição automática no Painel admin =… → [[D-186 - Lancar qualquer movel para producao a qualquer momento|D-186]]
- [[D-089 - A lapidacao ao vivo do Estoque|D-89]] · A lapidação ao vivo do Estoque → [[D-186 - Lancar qualquer movel para producao a qualquer momento|D-186]]
- [[D-101 - Utilitarios etiquetas varias por card so a automacao poe|D-101]] · Utilitários: etiquetas (várias por card, só a automação põe e tira) e… → [[D-125 - O card avulso quem cria como termina vinculo etiquetas quem|D-125]], [[D-150 - O prazo e a PRIORIDADE do card de producao|D-150]]
- [[D-109 - A ordem das paradas a sugestao e a do mais perto mas qualquer|D-109]] · A ordem das paradas: a sugestão é a do mais perto, mas qualquer um da… → [[D-111 - A Programacao em duas abas Programar e Ja programadas itens|D-111]]
- [[D-110 - O mapa da Programacao mostra tambem a rota JA PROGRAMADA|D-110]] · O mapa da Programação mostra também a rota JÁ PROGRAMADA de cada… → [[D-111 - A Programacao em duas abas Programar e Ja programadas itens|D-111]]
- [[D-111 - A Programacao em duas abas Programar e Ja programadas itens|D-111]] · A Programação em duas abas — "Programar" e "Já programadas"; itens… → [[D-128 - Varias rotas por dia no mesmo caminhao cada rota com o seu|D-128]], [[D-159 - O mapa da rota So a ida e So a volta o Programar sem espaco|D-159]]
- [[D-114 - Cancelado ou devolvido com o movel pronto vai SOZINHO para|D-114]] · Cancelado ou devolvido com o móvel pronto vai SOZINHO para o estoque —… → [[D-124 - O marcador Devolvido do Tiny NAO e cancelamento a fabrica|D-124]], [[D-129 - Devolucao o entregador nao marca mais Pedido devolvido|D-129]]
- [[D-115 - O entregador usuario so de ROTAS a tela das entregas do dia|D-115]] · O entregador: usuário só de ROTAS, a tela das entregas do dia, a… → [[D-128 - Varias rotas por dia no mesmo caminhao cada rota com o seu|D-128]], [[D-129 - Devolucao o entregador nao marca mais Pedido devolvido|D-129]]
- [[D-124 - O marcador Devolvido do Tiny NAO e cancelamento a fabrica|D-124]] · O marcador "Devolvido" do Tiny NÃO é cancelamento — a fábrica ainda… → [[D-129 - Devolucao o entregador nao marca mais Pedido devolvido|D-129]]
- [[D-125 - O card avulso quem cria como termina vinculo etiquetas quem|D-125]] · O card avulso: quem cria, como termina, vínculo, etiquetas, quem vê,… → [[D-150 - O prazo e a PRIORIDADE do card de producao|D-150]], [[D-152 - Os RESPONSAVEIS do card por setor|D-152]]
- [[D-134 - A area PEDIDOS Todos os pedidos sai do PCP e Cancelados sai|D-134]] · A área PEDIDOS: "Todos os pedidos" sai do PCP e "Cancelados" sai da… → [[D-299 - A aba Cancelados e removidos volta para dentro do PCP|D-299]]
- [[D-137 - SESSAO-32 as respostas do dono tempo logado medicao nos|D-137]] · SESSAO-32: as respostas do dono — tempo logado, medição nos aparelhos… → [[D-189 - O TABLET NAO CAI cada aparelho com a sua sessao quem sai|D-189]]
- [[D-140 - SESSAO-32 pedido excluido no Tiny nao existe em nenhum modulo|D-140]] · SESSAO-32: pedido excluído no Tiny não existe em nenhum módulo — uma… → [[D-311 - O pedido excluido no Tiny sai do PCP de vez e segue o caminho|D-311]]
- [[D-189 - O TABLET NAO CAI cada aparelho com a sua sessao quem sai|D-189]] · O TABLET NÃO CAI: cada aparelho com a sua sessão; quem sai do setor… → [[D-197 - Sem card so 5 minutos contam como trabalho a tela segue|D-197]]
- [[D-195 - A ENTREGA PARCIAL o entregador ou a logistica marca o que foi|D-195]] · A ENTREGA PARCIAL: o entregador (ou a logística) marca o que foi… → [[D-325 - Na entrega parcial o que ainda esta na fabrica CONTINUA|D-325]]

### Números sem decisão

D-44 · D-64 · D-69 · D-149 · D-160 · D-177…D-185 · D-222…D-224 · D-234…D-259 — reservados por sessões em paralelo e nunca usados; não existe texto para eles. D-44: reservada pela frente do histórico do Tiny e nunca escrita (as respostas do dono viraram a D-45). D-64: ficou sem uso.
<!-- gerado:fim -->

## Ver também

[[PLT - Visao Geral]] · [[PLT - Requisitos]] · [[PLT - Perguntas em Aberto]] · [[000 - ORDEM DAS SESSOES]] · [[PROMPT - Bloco 1 (Sessoes 01 a 05)]]
