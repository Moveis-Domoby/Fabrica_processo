---
titulo: Próximos Passos — o plano em uma página
tipo: indice
atualizado: 2026-10-01
tags: [planejamento, roadmap, indice]
---

# 🎯 Próximos Passos — o plano em uma página

> [!abstract] O que é esta nota
> A leitura única de planejamento do projeto: **onde estamos, qual é o próximo passo, o que vem depois e o que está esperando você**. Ela não substitui as demandas — resume e aponta. Detalhe de execução vive em [[000 - ORDEM DAS SESSOES]]; o novo bloco em [[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]]; ideias de longo prazo em [[001 - HANDOFF - Pesquisa e Ideias de Plataformas]].
> **Regra de manutenção:** toda sessão entregue ou decisão nova atualiza esta nota junto com o mapa.

## Onde estamos (02/10/2026)

O **Bloco 5 está quase fechado**: entregues as SESSÕES 22, 23, 25, 24, 26 e **27** (automações em canvas, 02/10) e os ajustes do estoque (contagem da logística, sincronismo com o Tiny, fotos automáticas e o Ajuste Estoque 2). Falta a **28** (rota no mapa). A **[[SESSAO-29 - Reconciliacao Tiny - Pente-fino e Ultimo Pacote Vence]] foi entregue em 01/10** — a conferência diária com o Tiny está no ar. As telas novas (Automações, Configurações, Utilitários e a Auditoria da 29) **estão no site desde 02/10**. **Com você:** quando quiser chamar automação pelo n8n, a publicação da Edge Function.

> [!info] Revisão das pendências com o dono (01/10/2026)
> O dono passou a lista inteira a limpo: o que era rotina da equipe saiu da lista (reservas presas, conferência da venda, fotos, saldo negativo das peças), o que ele já resolveu foi marcado ✅, e as respostas viraram as decisões **D-90…D-94**. A lista abaixo é a que vale.

## ▶️ Agora (01/10): SESSAO-29 entregue — falta a sua revisão da Auditoria

- [[SESSAO-29 - Reconciliacao Tiny - Pente-fino e Ultimo Pacote Vence]] — ✅ **entregue em 01/10** — [[handoff_2026_10_01_sessao29_reconciliacao_tiny]]. **Conferência diária às 3h** (60 dias + não terminados) pelo fluxo da carga do n8n, agora acordado pelo banco só quando há trabalho; o que muda no Tiny muda aqui (apagar só apaga as observações); cliente pelo cadastro do Tiny → CPF → o cliente que o pedido já tem → nome + telefone; pedido igual não é regravado (D-95…D-98). 1ª conferência real: 611 relidos, 138 diferentes → **2ª: zero**. Migrations 49/50 aplicadas com o seu OK (integração idêntica). **Escopo novo seu: Painel admin → Auditoria** (D-95) — na branch. **Com você:** (1) ✅ ~~colar no fluxo de vendas do n8n as 3 trocas que passam o número do cadastro do cliente~~ — **colado e publicado em 01/10, 23:20** ([[N8N - Workflow Tiny para Planilha]]); (2) a Auditoria: você já viu a tela — falta o "pode subir" para ir ao site. ↪️ **01/10 à noite:** o Claude passou a **ler o n8n pela API** (chave criada por você, só no seu computador — [[N8N - Infraestrutura VPS]]).

## (anterior) 30/09: o Ajuste Estoque 2 está ENTREGUE e publicado

- **Ajuste Estoque 2:** ✅ **entregue e publicado em 30/09** — [[handoff_2026_09_30_ajuste_estoque_2]]. O **Top X** (1–50) virou a régua e a página do estoque — só ele tem mínimo (a capacidade do galpão saiu de uso); **mínimo automático por dias úteis de venda** (editar trava; "voltar ao automático" solta); **corte de pedido fora do comum**; filtro de 4 posições; cartão com a **bolinha vermelha** que abre a decisão no PCP e o **ícone vermelho** de lançar para produção; reposição parada **2 dias úteis sai do PCP sozinha**; **Painel admin → Estoque** com o liga/desliga de verdade, o Top X, o corte e o quadro do Tiny. Das rodadas ao vivo: **PCP em três abas** (Reabastecimento · Aguardando liberação com o selo de peça no estoque · Todos os pedidos com o status do Tiny em bolinha de cor e o detalhe de produção sob demanda) e **Cancelados na Logística**. Migrations 45/47/48 aplicadas (integração idêntica), 621 verificações verdes, 6 rodadas de lapidação com você logado (D-83…D-89). **Com você:** (1) a **contagem inicial** da logística; (2) depois dela, decidir **ligar a reposição automática** (Painel admin → Estoque); (3) você deixou **Top X = 30** e **cobertura = 1 semana** — mude quando quiser; (4) os pedidos presos no quadro com "entregue no Tiny" são avisos que o Tiny NÃO mandou (P17) — **recomendo a [[SESSAO-29 - Reconciliacao Tiny - Pente-fino e Ultimo Pacote Vence]] como próxima**; salvar o pedido no Tiny reenvia o aviso e ele some na hora. Pendência registrada sem correção: o raio-x de 29/09 (Q-72 em [[PLT - Perguntas em Aberto]]). ↪️ **01/10:** (2) **não é pendência** — ligar ou não a automática é escolha da operação (D-90); (3) ✅ revisado pelo dono; (4) a SESSAO-29 roda em 01/10.

## (anterior) 30/09: o estoque conversa com o Tiny — LIGADO

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
- **Nova (↪️ pronta para code desde 23/09 — D-50):** [[SESSAO-29 - Reconciliacao Tiny - Pente-fino e Ultimo Pacote Vence]] — a correção de raiz da deriva Tiny × banco achada na conferência de 22/09 (P17). Recomendo encaixar cedo: sem ela, a deriva volta.

## ⏭️ Depois: o resto do Bloco 5, na ordem (decidida em 18/09)

**22 → 23 → 25 → 24 → 26 → 27 → 28** (ordem revisada em 24/09 — D-53) — plano completo com o de-para demanda→sessão em [[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]]:

1. ✅ [[SESSAO-22 - Producao - Filas Reais Tempo de PCP e Paginacao]] (entregue 22/09) — fim da coluna "Chegada", tempo de PCP verdadeiro, 10 cards por etapa + "Ver mais", regra nova *"cada tela requisita só o que mostra"*, 1 pedido por vez + pausa por líder.
2. ✅ [[SESSAO-23 - Meu Painel 2 - Filas Pessoais Subtarefas e Tempos]] (entregue 23/09) — as três filas com a Fila de prioridade reordenável, subtarefas em 2 níveis, tarefa privada (D-51), tarefa do Sistema no lugar do bloco de qualidade, "Ver todos" no sino e o painel pessoal Meu desempenho.
3. ✅ ⏫ [[SESSAO-25 - Integracao Tiny Fabrica - Estoque e Minimos]] (entregue 26/09) — **o estoque inteiro**: saldo vindo do Tiny (integração já no ar), item com pedido × sem dono, lançamento manual, tela com saldo/mínimo/necessidade, venda da loja debita, sugestão de mínimo pelo trimestre.
4. ✅ [[SESSAO-24 - Estoque Nucleo - Aguardo Cancelamentos e Alocacao]] (entregue 27/09) — com o desenho novo do dono: quadros só por arrasto, "Concluir produção" só na LIMPEZA E EMBALAGEM → Pedidos em aguardo (abas Pedidos/Produtos reservados), os 3 fluxos de cancelamento e a sugestão do estoque no PCP.
5. ✅ [[SESSAO-26 - Chat Interno]] (entregue 27/09, validada e mesclada 28/09) — `/inicio/chat` + balão arrastável em toda tela; canais, particulares, avisos gerais, aniversários automáticos; websocket privado e leitura só por página.
6. ✅ [[SESSAO-27 - Automacoes em Canvas]] (entregue 02/10) — canvas no Painel super admin, para tudo e só o dono cria; motor na hora; "Se… senão"; Configurações, Utilitários (etiquetas e campos) e seletor de tema — [[handoff_2026_10_02_sessao27_automacoes_canvas]]. No site desde 02/10. **Com você:** a publicação da Edge Function (disparo pelo n8n), quando quiser.
7. [[SESSAO-28 - Rota Calculada no Mapa]] — rota real nas ruas (OSRM, grátis), partindo da fábrica.

## ⏸️ Em espera (decisão sua)

- [[SESSAO-08 - Publicacao no Ar]] — **você avisa quando quer lançar (D-30).** ↪️ 01/10: o dono vai **revisar se a demanda ainda faz sentido** antes de qualquer coisa.
- [[SESSAO-18 - Painel Admin Completo]] — standby desde a D-35. (A antiga 17 foi absorvida pela 27.)
- Ajustes herdados da loja no módulo Comercial — triagem em [[PLT - Comercial - Legado e Cutover]].

## 🧭 Depois do Bloco 5 (o horizonte)

- 🆕 **[[003 - PLANO - Integracao Completa Tiny da Fabrica]] (27/09)** — o pedido do dono de enxergar a fábrica **no nível de peça e insumo** (a CNC não conhece "penteadeira", corta peças). Levantamento da API feito: a **v3 tem filtro por data de ALTERAÇÃO**, traz a **estrutura com etapas** e tem **logs de movimentação com autor e origem**; a v2 dá a estrutura e o **saldo por depósito/empresa**. Plano em 5 ondas (alterações em minutos → estrutura/BOM → estoque com movimento → produção por peça → plano de corte SketchUp/CNC). **6 perguntas esperando o dono** (levadas a ele de novo em 01/10) — a primeira (app v3 na conta da fábrica) destrava as três primeiras ondas.

- BOM/insumos (chapas MDF) e custo real por móvel · migração dos **cards vivos** do ClickUp (Q-25) · **app/fluxo do motorista** · central de notificações com preferências.
- Banco de ideias completo: [[001 - HANDOFF - Pesquisa e Ideias de Plataformas]] · perguntas sem resposta: [[PLT - Perguntas em Aberto]].

## 🙋 Pendências que estão com VOCÊ (o dono) — revisada em 01/10/2026

1. 🔶 **SESSAO-29 (entregue em 01/10):** (a) ✅ fluxo de vendas do n8n passando o número do cadastro do cliente — **colado e publicado em 01/10, 23:20**; (b) dizer se a **Auditoria** (Painel admin → Auditoria — você já viu) pode ir ao site — [[handoff_2026_10_01_sessao29_reconciliacao_tiny]].
2. 🔶 **Contagem inicial da logística — confirmar.** Você acredita que foi feita em 30/09; a leitura do banco em 01/10 00:30 não achou contagem lançada pela plataforma (52 peças no ESTOQUE, 25 produtos — 46 delas vieram da cópia inicial do Tiny às 01:00 de 30/09). Se a equipe contou no papel, falta lançar.
3. **Responder as 6 perguntas do [[003 - PLANO - Integracao Completa Tiny da Fabrica]]** (a 1ª — app v3 na conta da fábrica — destrava as ondas 1–3).
4. **Cutover (SESSAO-21):** excluir o projeto antigo em **06/10** — tudo no [[handoff_2026_09_22_sessao21_cutover]].
5. **Revisar a [[SESSAO-08 - Publicacao no Ar]]** — se ainda faz sentido e como fica.
6. **Confirmar as decisões provisórias que sobraram** (handoffs 13, 15 e 19): Configurações → Meu Perfil; presença de 5 em 5 min fora da trilha; raio de 5 km fixo; `tiny_auth` fechada até para admin.
7. **Contas dos tablets e delegação por setor** — você vai mexer na lógica disso depois.
8. **Responder as perguntas de produto que restam:** Q-21 (card que se divide), Q-22 (terceirizados), Q-30/Q-64 (visual), Q-42 (onde chegam os alertas) — em [[PLT - Perguntas em Aberto]].
9. `PLT_GEOCODIFICACAO_CONTATO` (contato do Nominatim, opcional).

**Com os responsáveis (o dono pede; fora da lista do dono):** limpar no Tiny as reservas presas (Configurações → Tiny); conferir nos primeiros dias que a venda baixa o Tiny; corrigir no Tiny o saldo negativo das peças (P16).

### ✅ Saíram da lista em 01/10 (resolvidas ou decididas)

- **Reposição automática** — não é pendência: a logística escolhe deixar a automática ligada ou lançar pelo botão "Lançar para produção" (**D-90**, sobre a D-87).
- **Top X = 30 e cobertura = 1 semana** — revisados pelo dono.
- **Fotos dos produtos** — os 47 sem foto no Tiny ficam com a equipe, pela câmera; não é pendência.
- **Vendedor dos pedidos 13183 e 13421** — o dono não sabe; ficam vazios, como no Tiny.
- **Trocar a senha do admin** — fora da lista enquanto o projeto está em desenvolvimento (a senha só apareceu em conversa com o Claude). Revisitar na publicação ([[SESSAO-08 - Publicacao no Ar]]).
- **Limpeza dos ~163 cards históricos do PCP (E-24)** — ✅ **já feita em 08/09** na SESSAO-15: 233 cards arquivados por evento (D-45; conferido no banco em 01/10).
- **Q-63** (ID de produção) — ✅ respondida em 26/09: é o SKU (D-56).
- **Chat** (escritores dos Avisos gerais, botão "Sair do canal", ver não lidas com 2ª pessoa) — **postergado pelo dono**; volta quando ele retomar o chat.
- **Conta Tiny da fábrica** ✅ (21–23/09) · **Q-71** ✅ (29/09) · **Painel do PCP = quadro** ✅ (D-75) · **fotos automáticas** ✅ (D-81/D-82) · **token v2** — decidido não trocar (23/09).
- **Bonificação (Q-10…Q-14)** — descartada pelo dono (**D-94**).

## 🔧 Pendências técnicas vivas (fora das sessões)

- ✅ ~~**P17** — o webhook de vendas não cobre marcador, contato renomeado nem campo limpo: deriva silenciosa Tiny × banco~~ — **resolvido em 2026-10-01** (SESSAO-29: conferência diária às 3h; o fluxo de vendas passa o número do cadastro desde 01/10 23:20).
- **P1** — não existe alerta de erro nas automações do n8n (a SESSAO-25 propõe resolver junto). **P4** — token do Tiny v2 em texto puro no workflow. Lista completa: [[N8N - Pendencias e Riscos]].
- Débito técnico do módulo Comercial: [[PLT - Comercial - Debito Tecnico]].
- O raio-x do estoque (Q-72) — 10 achados, sem correção.
- ↪️ **01/10:** o dono decidiu tratar as pendências técnicas **depois** — nenhuma entra antes da SESSAO-29.
- ✅ ~~Foto com fundo transparente vira fundo PRETO pela câmera do Estoque~~ — corrigido em 30/09 com o OK do dono (a redução pinta o fundo de branco — D-81).

## Ver também

[[000 - MAPA DO PROJETO]] · [[000 - ORDEM DAS SESSOES]] · [[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]] · [[PLT - Decisoes de Produto]] · [[PLT - Memoria de Aprendizado]]
