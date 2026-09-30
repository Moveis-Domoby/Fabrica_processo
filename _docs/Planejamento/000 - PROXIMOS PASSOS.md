---
titulo: Próximos Passos — o plano em uma página
tipo: indice
atualizado: 2026-09-30
tags: [planejamento, roadmap, indice]
---

# 🎯 Próximos Passos — o plano em uma página

> [!abstract] O que é esta nota
> A leitura única de planejamento do projeto: **onde estamos, qual é o próximo passo, o que vem depois e o que está esperando você**. Ela não substitui as demandas — resume e aponta. Detalhe de execução vive em [[000 - ORDEM DAS SESSOES]]; o novo bloco em [[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]]; ideias de longo prazo em [[001 - HANDOFF - Pesquisa e Ideias de Plataformas]].
> **Regra de manutenção:** toda sessão entregue ou decisão nova atualiza esta nota junto com o mapa.

## Onde estamos (23/09/2026)

Entregues nesta semana: a [[SESSAO-22 - Producao - Filas Reais Tempo de PCP e Paginacao]] (21–22/09), a [[SESSAO-21 - Uniao 3 - Cutover e Desligamento]] (22–23/09) e a **[[SESSAO-23 - Meu Painel 2 - Filas Pessoais Subtarefas e Tempos]]** (23/09, [[handoff_2026_09_23_sessao23_meu_painel_2]]) — o Meu Painel 2.0 com as três filas, subtarefas, tarefa privada, tarefa do Sistema e o painel pessoal "Meu desempenho"; migration 33 aplicada com permissão total do dono.

## ▶️ Agora (30/09): o estoque conversa com o Tiny — LIGADO

- **Estoque sincronizado com o Tiny (29–30/09):** ✅ construído e aplicado — [[handoff_2026_09_30_estoque_sincronizado_tiny]]. As duas mostram o mesmo número: o que entra no Tiny (fábrica ou loja) **sobe a plataforma**; entrada, baixa e contagem daqui **deixam o Tiny igual**; a **venda reserva a peça** e o PCP decide; **um fluxo só** no n8n (D-76…D-80). Migration 42 aplicada com o seu OK. ✅ **Ligado em 30/09 01:30** — fluxo publicado no n8n (sem relógio: o banco chama só quando há trabalho — migration 43), aviso da loja ligado, cópia inicial conferida (234 produtos, 46 peças, 0 falhas). **Com você:** acompanhar os primeiros dias (Configurações → Tiny mostra fila, erros e os ajustes gravados) e confirmar que a venda baixa o Tiny na hora. ↪️ **30/09 manhã:** Configurações → Tiny ganhou a **lista das reservas presas** (111 móveis, 814 unidades) — **pedir à equipe que limpe essas reservas no Tiny**, começando pelo topo; entrada/baixa/contagem seguem na plataforma.

## (anterior) Agora (28/09): o estoque virou a contagem da logística — falta a contagem inicial

- **Ajuste urgente do estoque (28/09):** ✅ entregue — [[handoff_2026_09_28_ajuste_estoque_contagem_top20]]. O número dos produtos prontos passou a ser a **contagem da logística** (cadastrar ao estoque, baixa e contagem — o Tiny não avisava a saída da venda e deixava quase tudo zerado ou negativo); a tela abre no **Top 20+** (os 20 mais vendidos dos 90 dias, depois o que tem estoque); **foto de cada produto**; **Configurações** com o mínimo editável, a **capacidade do galpão** e a sugestão de mínimo que cabe nela; o "i" no lugar do texto e as abas em quadrados no canto (D-70…D-74). Migration 40 aplicada com o seu OK, telas conferidas com você logado. **Com você:** (1) a logística fazer a **contagem inicial** (hoje tudo está em 0); (2) pôr a **capacidade do galpão** em Configurações; (3) conferir os mínimos (ou "usar todas as sugestões"); (4) as fotos; (5) só depois disso, decidir ligar a reposição automática.

## (histórico) 27/09: SESSAO-24 e SESSAO-26 — ligar a reposição quando o dono decidir

- **SESSAO-24 (Produção concluída, cancelamentos e alocação):** ✅ **entregue em 27/09** — [[handoff_2026_09_27_sessao24_producao_concluida]]. Quadros **só por arrasto** (D-59/D-60), **Pedidos em aguardo como lugar** e ESTOQUE só sem dono (D-58), aba **Cancelados** no PCP (D-61), **sugestão do estoque** na liberação (D-62). Migration 37 aplicada com o seu OK. Telas conferidas com você logado e **mesclada na `main` em 27/09** (D-20). Q-69/Q-70 respondidas na sessão (a 502 é card de teste; 518 e 537 arquivadas).
- **SESSAO-26 (Chat interno):** ✅ **entregue em 27/09** — [[handoff_2026_09_27_sessao26_chat]]. Migration 38 aplicada (sozinha, depois da 37 da 24). **Validada ao vivo com você logado e mesclada na `main` em 28/09 (D-20).** Com você: cadastrar a sua data de nascimento no Meu Perfil e, se quiser, liberar quem mais escreve nos Avisos gerais. Falta só ver, com uma 2ª pessoa de verdade, o número de não lidas subindo (provado nos testes automáticos). ⚠️ **Segurança corrigida na mesma migration (D-68):** CPF, PIN e convite estavam legíveis por qualquer pessoa logada.
- **Ajuste do Frete (28/09, achado da S24):** ✅ o **frete deixou de virar peça de produção** (D-63) — [[handoff_2026_09_28_ajuste_frete_fora_da_producao]]. Cadeira e acessório seguem nascendo no PCP (o PCP escolhe o lugar); pedido só de frete vai direto para Pedidos em aguardo. Migration 39 **aplicada com o seu OK** (integração idêntica); card de frete do 13215 arquivado. **Mesclado na `main` e publicado em 28/09 com o seu OK.**

## (histórico) 26/09 — SESSAO-25 mesclada; a reposição automática espera o dono

- **SESSAO-25 (Estoque completo):** ✅ **entregue em 26/09** — [[handoff_2026_09_26_sessao25_estoque]]. Migration 36 aplicada, carga do saldo rodada (442 produtos), telas validadas. **Com você:** (1) validar no roteiro do handoff e fazer um lançamento real no Tiny; (2) **decidir ligar a reposição automática** (1ª rodada: 44 cards / 121 unidades no PCP); (3) ✅ mesclada na `main` em 26/09. ⚠️ O físico dos móveis no Tiny está negativo em 93 de 168 — vale conferir o 327 na aba "reservas" do Tiny.

## (histórico) SESSAO-25 (Estoque completo) — ⏫ passou na frente da 24 (D-53)

- **SESSAO-23:** ✅ validada ao vivo em 2 rodadas de ajustes com o dono e **mesclada na `main` em 24/09** — detalhe no [[handoff_2026_09_23_sessao23_meu_painel_2]]. Bônus entregues: D-52 (admin sem setor), PCP sem encerrados do Tiny (161 → 37) e o achado do pedido 13257 (reforça a urgência da SESSAO-29).
- **Cutover (SESSAO-21):** ✅ DataCrazy repontado e ✅ trava do disparo aberta em 23/09 (PR #6). **Exclusão do projeto antigo: 06/10/2026**. Detalhe: [[handoff_2026_09_22_sessao21_cutover]].
- **Próxima de construção:** [[SESSAO-25 - Integracao Tiny Fabrica - Estoque e Minimos]] — **o estoque inteiro numa sessão só**. Em 24/09 o dono pediu urgência: a **25 trocou de lugar com a 24** e o estoque-base (item sem dono, lançamento manual, tela) **saiu da 24 e foi para a 25** (D-53). A 24 ficou com as consequências de produção e cancelamento e roda depois.
- **Metade da 25 já está entregue, fora de sessão (21–23/09):** integração com o **Tiny da fábrica no ar** — catálogo de 487 produtos no banco, produto novo entra sozinho a cada 15 min, varredura diária e **webhook de lançamentos de estoque ligado e testado** (manda o saldo resultante). Detalhe: [[N8N - Tiny Fabrica Produtos para Banco]] e [[N8N - Tiny Fabrica - Estudo do Cadastro]].
- **Nova (🔶 rascunho, 4 perguntas suas):** [[SESSAO-29 - Reconciliacao Tiny - Pente-fino e Ultimo Pacote Vence]] — a correção de raiz da deriva Tiny × banco achada na conferência de 22/09 (P17). Recomendo encaixar cedo: sem ela, a deriva volta.

## ⏭️ Depois: o resto do Bloco 5, na ordem (decidida em 18/09)

**22 → 23 → 25 → 24 → 26 → 27 → 28** (ordem revisada em 24/09 — D-53) — plano completo com o de-para demanda→sessão em [[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]]:

1. ✅ [[SESSAO-22 - Producao - Filas Reais Tempo de PCP e Paginacao]] (entregue 22/09) — fim da coluna "Chegada", tempo de PCP verdadeiro, 10 cards por etapa + "Ver mais", regra nova *"cada tela requisita só o que mostra"*, 1 pedido por vez + pausa por líder.
2. ✅ [[SESSAO-23 - Meu Painel 2 - Filas Pessoais Subtarefas e Tempos]] (entregue 23/09) — as três filas com a Fila de prioridade reordenável, subtarefas em 2 níveis, tarefa privada (D-51), tarefa do Sistema no lugar do bloco de qualidade, "Ver todos" no sino e o painel pessoal Meu desempenho.
3. ✅ ⏫ [[SESSAO-25 - Integracao Tiny Fabrica - Estoque e Minimos]] (entregue 26/09) — **o estoque inteiro**: saldo vindo do Tiny (integração já no ar), item com pedido × sem dono, lançamento manual, tela com saldo/mínimo/necessidade, venda da loja debita, sugestão de mínimo pelo trimestre.
4. ✅ [[SESSAO-24 - Estoque Nucleo - Aguardo Cancelamentos e Alocacao]] (entregue 27/09) — com o desenho novo do dono: quadros só por arrasto, "Concluir produção" só na LIMPEZA E EMBALAGEM → Pedidos em aguardo (abas Pedidos/Produtos reservados), os 3 fluxos de cancelamento e a sugestão do estoque no PCP.
5. ✅ [[SESSAO-26 - Chat Interno]] (entregue 27/09, validada e mesclada 28/09) — `/inicio/chat` + balão arrastável em toda tela; canais, particulares, avisos gerais, aniversários automáticos; websocket privado e leitura só por página.
6. [[SESSAO-27 - Automacoes em Canvas]] — absorve a antiga 17: canvas com gatilho por etapa/setor, mover card (revisa D-03), arquivar, etiquetas.
7. [[SESSAO-28 - Rota Calculada no Mapa]] — rota real nas ruas (OSRM, grátis), partindo da fábrica.

## ⏸️ Em espera (decisão sua)

- [[SESSAO-08 - Publicacao no Ar]] — **você avisa quando quer lançar (D-30).**
- [[SESSAO-18 - Painel Admin Completo]] — standby desde a D-35. (A antiga 17 foi absorvida pela 27.)
- Ajustes herdados da loja no módulo Comercial — triagem em [[PLT - Comercial - Legado e Cutover]].

## 🧭 Depois do Bloco 5 (o horizonte)

- 🆕 **[[003 - PLANO - Integracao Completa Tiny da Fabrica]] (27/09)** — o pedido do dono de enxergar a fábrica **no nível de peça e insumo** (a CNC não conhece "penteadeira", corta peças). Levantamento da API feito: a **v3 tem filtro por data de ALTERAÇÃO**, traz a **estrutura com etapas** e tem **logs de movimentação com autor e origem**; a v2 dá a estrutura e o **saldo por depósito/empresa**. Plano em 5 ondas (alterações em minutos → estrutura/BOM → estoque com movimento → produção por peça → plano de corte SketchUp/CNC). **6 perguntas esperando o dono** — a primeira (app v3 na conta da fábrica) destrava as três primeiras ondas.

- BOM/insumos (chapas MDF) e custo real por móvel · migração dos **cards vivos** do ClickUp (Q-25) · **app/fluxo do motorista** · central de notificações com preferências.
- Banco de ideias completo: [[001 - HANDOFF - Pesquisa e Ideias de Plataformas]] · perguntas sem resposta: [[PLT - Perguntas em Aberto]].

## 🙋 Pendências que estão com VOCÊ (o dono)

1. **Trocar a senha do admin** — ela já vazou em chat duas vezes. (Pendente desde 28/08.)
2. ✅ **Conta Tiny da fábrica resolvida (21–23/09):** conta FábricaDomoby, plano Evoluir, token no compose do n8n, integração no ar. **Fica com você:** o saldo negativo das peças no Tiny (P16 — decidido: na plataforma vira 0; a correção no Tiny é sua) e as 6 perguntas do início da SESSAO-25.
3. Decidir a **limpeza dos ~163 cards históricos** do PCP (E-24).
4. **Q-63** — formato do ID de produção (Estoque).
5. Conferir as **decisões provisórias** dos handoffs 13–15 e 19–20.
6. `PLT_GEOCODIFICACAO_CONTATO` (contato do Nominatim, opcional).
7. Avisar quando quiser a **publicação no ar** (SESSAO-08 / D-30).
9. **Cutover (SESSAO-21):** excluir o projeto antigo em **06/10** · (se souber) o vendedor antigo dos pedidos 13183 e 13421 — tudo no [[handoff_2026_09_22_sessao21_cutover]].
10. ✅ SESSAO-29 respondida por inteiro (D-50) — **📐 pronta para code**; só falta você dizer quando ela entra na fila.
11. ~~Trocar o token da API v2 do Tiny~~ — o dono decidiu **não** trocar (23/09).
8. Pendências antigas de 28/08: contas dos tablets e modo de delegação por setor.
12. **Estoque (28/09):** contagem inicial pela logística · capacidade do galpão · conferir os mínimos · ~~fotos dos produtos~~ ✅ **30/09: 144 produtos com a foto do Tiny** (47 móveis ativos seguem sem foto porque o Tiny não tem — a logística põe pela câmera) · depois, ligar (ou não) a reposição automática — tudo no [[handoff_2026_09_28_ajuste_estoque_contagem_top20]].
13. ✅ **Q-71 (ajuste do Frete) — respondida em 29/09: fica tudo como está.** Espelho Adnet, Longarina e Carro de mão: *"quando eles sentirem falta, eles cadastram"*. Lâmpadas em kit: *"são insumos"*, e continuam em Matéria-prima e insumos. "Fechadura (com instalação)": fica sem código; é insumo e serviço, e desde a D-70 a venda não baixa o estoque, com ou sem código (a premissa antiga estava velha — E-67).
14. ✅ **Painel do PCP = quadro do PCP (28/09, D-75):** a Visão do dia dizia 233 "a liberar" com 200 já entregues no Tiny — agora conta o que o quadro mostra (33), reposição inclusa, e a "mais antiga" também; "liberadas hoje" ficou como estava. Aplicado com o seu OK e **mesclado na `main` em 29/09** ([[handoff_2026_09_28_ajuste_painel_pcp_como_o_quadro]]).
15. **Fotos dos produtos (30/09, D-81):** ✅ as fotos do Tiny entraram (144 produtos) e agora aparecem **inteiras** — quadro quadrado, sem corte ([[handoff_2026_09_30_ajuste_fotos_tiny]]). ✅ **Cópia automática ligada em 30/09 (D-82):** produto novo com foto no Tiny ganha a foto em ~20 min; foto trocada no Tiny, na manhã seguinte; a da câmera fica; apagada no Tiny fica a última; o banco só chama a função quando há foto nova ([[handoff_2026_09_30_ajuste_fotos_tiny_automaticas]]). Se um dia quiser a troca no mesmo dia: rodar a releitura do catálogo mais vezes no n8n.

## 🔧 Pendências técnicas vivas (fora das sessões)

- **P17** — o webhook de vendas não cobre marcador, contato renomeado nem campo limpo: deriva silenciosa Tiny × banco (acumulado corrigido em 22/09; raiz na SESSAO-29).
- **P1** — não existe alerta de erro nas automações do n8n (a SESSAO-25 propõe resolver junto). **P4** — token do Tiny v2 em texto puro no workflow. Lista completa: [[N8N - Pendencias e Riscos]].
- Débito técnico do módulo Comercial: [[PLT - Comercial - Debito Tecnico]].
- ✅ ~~Foto com fundo transparente vira fundo PRETO pela câmera do Estoque~~ — corrigido em 30/09 com o OK do dono (a redução pinta o fundo de branco — D-81).

## Ver também

[[000 - MAPA DO PROJETO]] · [[000 - ORDEM DAS SESSOES]] · [[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]] · [[PLT - Decisoes de Produto]] · [[PLT - Memoria de Aprendizado]]
