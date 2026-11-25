---
titulo: "Mapa — Logística e ROTAS"
tipo: mapa
area: logistica-rotas
atualizado: 2026-11-25
tags: [mapa, moc, area/logistica-rotas]
---

# 🗺️ MOC - Logistica e ROTAS

> A entrega com caminhão próprio: a Programação monta a rota do dia (pelas ruas, saindo da fábrica e voltando), o calendário mostra as rotas, o entregador marca Entregue / Não entregue / entrega parcial com comprovante, e "Entregue" é **um fato só, dos dois lados** (plataforma e Tiny). Inclui parada avulsa, endereço e data de entrega do pedido, Google Maps/Waze e o painel de motivos.

**No código:** `src/rotas/` · `src/paginas/Rotas.tsx` · `src/paginas/Programacao.tsx` · `src/paginas/EntregasDoDia.tsx` · `src/paginas/Caminhoes.tsx`

**Notas da área:** [[N8N - ROTAS Entregue para Tiny]] · [[N8N - ROTAS ClickUp]]

**Perguntas em aberto:** o pino a conferir pelo banco e o ponto do Google — [[PLT - Perguntas em Aberto]]

## Últimas sessões da área (a mais nova primeiro)

- **57** · [[SESSAO-57 - O Pino Certo]] · [[handoff_2026_11_24_sessao57_pino_certo|handoff]] (+ ajustes de 24 e 25/11) · [[handoff_2026_11_25_planejamento_ponto_do_google|plano do Google]] — ✅ no ar (24/11)
- **56** · [[SESSAO-56 - Busca de Endereco pela Geoapify e Tela que Avisa]] · [[handoff_2026_11_23_sessao56_busca_geoapify_ordem_da_rota|handoff]] — ✅ no ar (24/11)
- **53** · [[SESSAO-53 - Entregue em Parte na Programacao Expedicao e Entregas do Dia]] · [[handoff_2026_11_18_sessao53_entregue_em_parte_nas_telas|handoff]] — ✅ no ar (25/11)
- **52** · [[SESSAO-52 - Datas e Textos Certos na Busca Devolucao Pedidos e Auditoria]] · [[handoff_2026_11_18_sessao52_datas_e_textos_certos|handoff]] — ✅ no ar (25/11)
- **51** · [[SESSAO-51 - Entrega Parcial Mantem a Producao e Mover Card para o PCP]] · [[handoff_2026_11_17_sessao51_entrega_parcial_mover_pcp|handoff]]
- **50** · [[SESSAO-50 - Observacao do Item Cancelar e Ocultar no PCP e Editar Endereco da Parada]] · [[handoff_2026_11_12_sessao50_observacao_cancelar_ocultar_endereco|handoff]]
- **47** · [[SESSAO-47 - Pedido Adiantado no Tiny Data Real da Entrega Comprovantes e Painel de Tempos]] · [[handoff_2026_11_09_sessao47_pedido_adiantado_entrega_comprovantes_tempos|handoff]]
- As mais antigas (45, 44, 41, 39, 38, 30, 28, 15): [[MOC - Sessoes e Handoffs]]

<!-- gerado:inicio -->
## Decisões vigentes (39)

- [[D-093 - O endereco do cliente que o Tiny manda e o endereco|D-93]] · O endereço do cliente que o Tiny manda é o endereço de entrega das ROTAS
- [[D-108 - A rota da Programacao e calculada PELAS RUAS parte da fabrica|D-108]] · A rota da Programação é calculada PELAS RUAS, parte da fábrica e VOLTA para ela;…
- [[D-112 - Busca de enderecos recusa do servico nao e nao existe|D-112]] · Busca de endereços: recusa do serviço não é "não existe"; um segundo buscador gratuito…
- [[D-113 - Entregue e um fato so dos dois lados e entregue no Tiny fecha|D-113]] · "Entregue" é um fato só, dos dois lados — e entregue no Tiny fecha TUDO do pedido aqui
- [[D-116 - Motivos de nao entregue e de desfazer a entrega|D-116]] · Motivos de "não entregue" e de "desfazer a entrega" em Configurações → Utilitários
- [[D-118 - Reservados em venda ate a ENTREGA|D-118]] · Reservados em venda até a ENTREGA
- [[D-120 - O pedido entregue sai da ROTAS e mora no PCP com tudo dele|D-120]] · O pedido entregue sai da ROTAS e mora no PCP, com tudo dele num clique
- [[D-121 - Entregas do dia e uma aba de ROTAS Entregas nao um filho|D-121]] · "Entregas do dia" é uma aba de ROTAS → Entregas, não um filho do menu
- [[D-128 - Varias rotas por dia no mesmo caminhao cada rota com o seu|D-128]] · Várias rotas por dia no mesmo caminhão — cada rota com o seu dia, a sua ordem e a sua…
- [[D-129 - Devolucao o entregador nao marca mais Pedido devolvido|D-129]] · Devolução: o entregador não marca mais "Pedido devolvido"; a LOGÍSTICA marca, as peças…
- [[D-174 - A rota no GOOGLE MAPS e no WAZE o link oficial sem custo|D-174]] · A rota no GOOGLE MAPS e no WAZE: o link oficial, sem custo, na ordem da plataforma; o…
- [[D-175 - O CALENDARIO da programacao um modo de ver dentro de Rotas|D-175]] · O CALENDÁRIO da programação: um modo de ver dentro de Rotas → Programação, no formato do…
- [[D-176 - O PAINEL DE MOTIVOS os maiores problemas da fabrica e|D-176]] · O PAINEL DE MOTIVOS: os maiores problemas da fábrica e das rotas, do maior para o menor
- [[D-193 - O ENDERECO DE ENTREGA DO PEDIDO vale na logistica inteiro sem|D-193]] · O ENDEREÇO DE ENTREGA DO PEDIDO vale na logística, inteiro; sem ele, o do cadastro
- [[D-194 - A data de entrega mudada ou removida so na plataforma o tiny|D-194]] · A DATA DE ENTREGA MUDADA OU REMOVIDA SÓ NA PLATAFORMA; o Tiny mudando a data, vale o…
- [[D-196 - A PARADA AVULSA NA ROTA titulo endereco com pino observacao|D-196]] · A PARADA AVULSA NA ROTA: título, endereço com pino, observação, Feita/Não feita; a ordem…
- [[D-199 - FILTROS NA PROGRAMACAO DE CAMINHAO a lista para programar|D-199]] · FILTROS NA PROGRAMAÇÃO DE CAMINHÃO — a lista para programar com busca, situação,…
- [[D-221 - A rota vai SEMPRE pelo endereco do cliente o ponto e so|D-221]] · A rota vai SEMPRE pelo endereço do cliente; o ponto é só do mapa da rota (e se acerta à…
- [[D-267 - Pedido cancelado ou excluido no Tiny sai de ROTAS Entregas|D-267]] · Pedido cancelado (ou excluído) no Tiny sai de ROTAS → Entregas → "A entregar", mesmo…
- [[D-270 - Fora do calendario conta so o que nao aparece na grade|D-270]] · "Fora do calendário" conta só o que não aparece na grade
- [[D-276 - Marcar como entregue no dia a entrega pode ser registrada|D-276]] · "Marcar como entregue no dia…": a entrega pode ser registrada no dia em que aconteceu de…
- [[D-282 - Varios comprovantes de uma vez|D-282]] · Vários comprovantes de uma vez
- [[D-319 - Editar o endereco de entrega do pedido com o original do Tiny|D-319]] · Editar o endereço de entrega do pedido, com o original do Tiny guardado e a pergunta…
- [[D-325 - Na entrega parcial o que ainda esta na fabrica CONTINUA|D-325]] · Na entrega parcial, o que ainda está na fábrica CONTINUA em produção; "Limpar da…
- [[D-327 - Revogar a decisao da entrega parcial quantas vezes for preciso|D-327]] · Revogar a decisão da entrega parcial, quantas vezes for preciso
- [[D-368 - A busca de endereco pela Geoapify Photon de reserva Nominatim|D-368]] · A busca de endereço pela Geoapify Photon de reserva Nominatim fora
- [[D-369 - Quando a busca de endereco nao responde a tela avisa e oferece|D-369]] · Quando a busca de endereço não responde a tela avisa e oferece marcar ou tentar de novo
- [[D-370 - A faixa busca de endereco fora mostra desde quando|D-370]] · A faixa busca de endereço fora mostra desde quando
- [[D-371 - A ordem mostrada e a ordem da rota a sugestao so propoe|D-371]] · A ordem mostrada é a ordem da rota — a sugestão só propõe
- [[D-372 - Tirar reprogramar ou remover uma parada nao reordena o resto|D-372]] · Tirar reprogramar ou remover uma parada não reordena o resto da rota
- [[D-373 - O pedido que ganha ponto no mapa nao muda de lugar na rota|D-373]] · O pedido que ganha ponto no mapa não muda de lugar na rota
- [[D-374 - Quem entra numa rota que ja existe vai para o lugar mais perto|D-374]] · Quem entra numa rota que já existe vai para o lugar mais perto
- [[D-375 - Aviso no sino quando a busca de endereco passa 1 hora fora|D-375]] · Aviso no sino quando a busca de endereço passa 1 hora fora
- [[D-390 - A busca digitada so aceita rua ou casa o lugar vira nao achei|D-390]] · A busca digitada só aceita rua ou casa; o lugar vira "não achei" com onde abrir o mapa
- [[D-391 - Com a rua nao achada o Salvar fica travado ate arrastar o pino|D-391]] · Com a rua não achada o Salvar fica travado até arrastar o pino
- [[D-392 - O pino salvo a mao e conferido antes de salvar|D-392]] · O pino salvo à mão é conferido antes de salvar
- [[D-393 - Ja programadas mostra os pedidos com o pino a conferir|D-393]] · Já programadas mostra os pedidos com o pino a conferir
- [[D-401 - A aba Programar avisa o ponto aproximado como Ja programadas|D-401]] · A aba Programar avisa o ponto aproximado como Já programadas
- [[D-402 - O ponto do CEP e consultado pelo navegador|D-402]] · O ponto do CEP é consultado pelo navegador

## Provisórias ⏳ — valem até o dono dizer o contrário (53)

Com os títulos o mapa passaria do teto: o título de cada uma está em [[PLT - Decisoes de Produto]].

[[D-156 - A rota aceita QUALQUER pedido vivo o Lancar para ROTAS deixa|D-156]] · [[D-158 - A equipe da rota so entregador|D-158]] · [[D-159 - O mapa da rota So a ida e So a volta o Programar sem espaco|D-159]] · [[D-170 - Lancar direto para as entregas e Devolver|D-170]] · [[D-213 - Reabrir a entrega|D-213]] · [[D-214 - A volta atras no Tiny|D-214]] · [[D-216 - O acerto do 13787|D-216]] · [[D-217 - O Google Maps e o Waze vao pelo ENDERECO do pedido o ponto|D-217]] · [[D-218 - A busca de endereco confere o BAIRRO e o CEP o que ela nao|D-218]] · [[D-277 - O dia da entrega nunca fica antes do dia em que o pedido|D-277]] · [[D-278 - A hora guardada para um dia passado e o fim do expediente|D-278]] · [[D-279 - No calendario das rotas o entregue aparece no dia REAL com|D-279]] · [[D-280 - Desfazer do dia e o toque repetido contam pelo dia em que|D-280]] · [[D-281 - A correcao do dia da entrega motivo opcional registro novo|D-281]] · [[D-283 - Detalhes da entrega no dia real|D-283]] · [[D-321 - O Tiny mudando o endereco por fora vence e avisa|D-321]] · [[D-322 - Os detalhes do endereco do pedido|D-322]] · [[D-323 - Editar a parada avulsa|D-323]] · [[D-324 - Em Ja programadas o selo do endereco alterado fica na janela|D-324]] · [[D-326 - Os detalhes da peca que sai e volta pela entrega parcial|D-326]] · [[D-328 - Onde o pedido mostra Entregue em parte N de M e a parada|D-328]] · [[D-329 - So a logistica o PCP e o admin escolhem Limpar da producao|D-329]] · [[D-334 - Os pedidos entregues em parte antes desta sessao|D-334]] · [[D-340 - A lista de pedidos ganha uma porta nova no banco com a hora do|D-340]] · [[D-341 - A hora da entrega so aparece quando e a hora de verdade|D-341]] · [[D-342 - O texto da linha da entrega na lista de pedidos dia escolhido|D-342]] · [[D-344 - A busca geral diz Entregue em pelo dia real da entrega|D-344]] · [[D-346 - Depois que o resto e entregue o selo Entregue em parte some|D-346]] · [[D-347 - K ainda em producao so com deixar em producao e o pedido|D-347]] · [[D-348 - O Calendario da Programacao fica sem o selo Entregue em parte|D-348]] · [[D-349 - Em Entregues hoje o aviso em parte vira o selo com os numeros|D-349]] · [[D-350 - ROTAS Entregas fica como estava sem o selo novo|D-350]] · [[D-376 - Incluir um pedido na montagem poe ele onde o caminho aumenta|D-376]] · [[D-377 - A numeracao sem buracos da rota e so na tela|D-377]] · [[D-378 - A faixa da busca fora so em Rotas e para quem tem endereco|D-378]] · [[D-379 - Os textos dos avisos da busca e da montagem|D-379]] · [[D-380 - A pausa entre consultas a Geoapify e as consultas por endereco|D-380]] · [[D-381 - O nao achei fica registrado como procurado pela Geoapify|D-381]] · [[D-382 - Tirar com a lista incompleta na tela deixa o resto depois na|D-382]] · [[D-383 - A montagem com varios pedidos numa rota que ja existe entra no|D-383]] · [[D-384 - A parada avulsa nova segue a regra do lugar mais perto|D-384]] · [[D-385 - Na montagem um pedido so conta como programar sozinho|D-385]] · [[D-386 - Dois pedidos no mesmo ponto do mapa ficam juntos o novo antes|D-386]] · [[D-387 - O aviso Busca de endereco fora do ar para admin e logistica|D-387]] · [[D-388 - A busca que volta nao vira aviso no sino|D-388]] · [[D-389 - A chamada que so leu do guardado tambem avisa a busca fora|D-389]] · [[D-394 - A distancia para conferir o pino contra o CEP e 1 5 km|D-394]] · [[D-395 - A busca digitada nao usa mais a memoria de buscas|D-395]] · [[D-396 - O lugar que vem no lugar da rua e o primeiro que o mapa|D-396]] · [[D-397 - Salvar assim mesmo no aviso libera o botao e nao salva sozinho|D-397]] · [[D-398 - So o pino novo e conferido|D-398]] · [[D-399 - O toque em pino a conferir mostra as rotas inteiras|D-399]] · [[D-400 - A lista do pino a conferir conta de hoje em diante pelo dia da|D-400]]

## Revisadas por outra (11) — só para a história

[[D-005 - Escopo producao primeiro logistica depois|D-5]] · [[D-018 - Fins de linha ESTOQUE e ROTAS nascem juntos|D-18]] · [[D-033 - ROTAS dentro da plataforma ClickUp nao recebe mais nada|D-33]] · [[D-039 - ROTAS programacao de caminhao com mapa e sugestao caminhoes|D-39]] · [[D-045 - Logistica e ROTAS unidade pronta lancamento ID de producao|D-45]] · [[D-109 - A ordem das paradas a sugestao e a do mais perto mas qualquer|D-109]] · [[D-110 - O mapa da Programacao mostra tambem a rota JA PROGRAMADA|D-110]] · [[D-111 - A Programacao em duas abas Programar e Ja programadas itens|D-111]] · [[D-114 - Cancelado ou devolvido com o movel pronto vai SOZINHO para|D-114]] · [[D-115 - O entregador usuario so de ROTAS a tela das entregas do dia|D-115]] · [[D-195 - A ENTREGA PARCIAL o entregador ou a logistica marca o que foi|D-195]]

## Onde mais ler (só o que a demanda tocar)

- **Banco:** [[Banco - Logistica ROTAS e Entregas 1]] · [[Banco - Logistica ROTAS e Entregas 2]]
- **Lições:** [[Memoria - Regras de Negocio - Producao PCP Estoque e Rotas 1]] · [[Memoria - Regras de Negocio - Producao PCP Estoque e Rotas 2]] · [[Memoria - Regras de Negocio - Producao PCP Estoque e Rotas 3]]
- **Design:** [[Design - Logistica ROTAS e Pedidos]]
<!-- gerado:fim -->
