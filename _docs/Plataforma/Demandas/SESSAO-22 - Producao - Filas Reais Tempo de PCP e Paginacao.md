---
titulo: "SESSAO-22 — Produção: filas reais, tempo de PCP e paginação"
tipo: demanda
status: entregue
data: 2026-09-18
atualizado: 2026-09-22
tags: [plataforma, demanda, bloco-5, kanban, tempo, paginacao]
---

# 🎯 SESSAO-22 — Produção: filas reais, tempo de PCP e paginação

> Primeira sessão do **Bloco 5** ([[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]]). Conserta três dores do kanban de produção (coluna "Chegada", tempo de PCP zerado, quadros sem paginação) e endurece as regras de execução (um pedido por vez + pausa por líder).

## O que é

O kanban de produção passa a mostrar apenas as **filas reais** de cada setor ("A FITAR", "A MONTAR"…), o tempo em PCP passa a contar o tempo **verdadeiro** que o pedido esperou, cada etapa pagina em 10 cards, e a execução ganha as regras "uma pessoa, um pedido por vez" e "líder pode pausar uma execução".

## Requisitos cobertos

RNF-02 (paginação — agora com regra nova de sistema) · complementa D-02/D-24 (tempo e execução). Registrar os requisitos novos em [[PLT - Requisitos]] ao entregar.

## Decisões que regem esta demanda

D-14 (etapas por cadastro livre — o dono já cadastrou as etapas oficiais dos 7 setores em 28/08) · D-02/M-08 (fila é do setor, execução é da pessoa) · **D-24 (será REVISADA nesta sessão — ver item 4)** · D-22/D-31 (liberação e entrada de pedidos) · RNF-05/M-02 (eventos append-only — nada de reescrever história) · D-27 (sem códigos internos na UI).

## Comportamento esperado

1. **Fim da coluna "Chegada" nos setores de produção.**
   - Hoje "Chegada" é uma coluna fixa de apresentação para cards com `etapa_id` nulo (herança da D-14 + sentinela `'chegada'` da SESSAO-04). Ela deixa de existir na interface dos setores de produção: card que entra no setor cai direto na **etapa fila** (`plt_etapas.eh_fila`) do setor.
   - `movimentacao_setor` sem etapa de destino passa a projetar o card na etapa fila do setor de destino (banco), e o front não desenha mais a coluna sentinela.
   - **Migração dos cards vivos** que hoje estão com etapa nula: evento de `movimentacao_etapa` em lote para a etapa fila de cada setor (lote com origem `api` — E-26; passar o SQL no `test:banco` antes — jamais UPDATE de posição).
   - Setor de produção **sem nenhuma etapa fila cadastrada**: o quadro avisa o líder/admin para cadastrar a fila em Setores e Etapas (não inventar etapa — D-14). PCP e terminais não mudam de estrutura nesta sessão.

2. **Tempo em PCP verdadeiro no card.**
   - Causa raiz (diagnosticada no cofre): na liberação, o card de **unidade** nasce com `card_criado` + `movimentacao_setor` PCP→destino **no mesmo instante** — a permanência da unidade no PCP é ~0 por construção. O tempo real de espera vive no card de **pedido** (`card_criado` origem `automacao` → liberação).
   - Correção **por derivação, não por reescrita**: o "tempo em PCP" exibido no card de unidade e nas views/portas de tempo passa a ser o intervalo entre a **entrada do pedido no PCP** (card de pedido) e a **liberação COMPLETA do pedido** (todas as unidades) — ↪️ **resposta do dono em 21/09 (D-48)**, substituindo as duas alternativas cogitadas aqui. Com tudo produzido, o pedido conta **tempo de aguardo** em Pedidos em aguardo (insumo futuro do cálculo de tempo de entrega). Nenhum evento é alterado (RNF-05); muda o cálculo em `plt_vw_permanencias`/portas de dashboard e no rótulo do card (view/função que muda de forma: `drop` + `create` — E-17, A-12).
   - Vale para o histórico: pedidos que passaram dias no PCP passam a mostrar dias, não "0:11".

3. **Paginação nos quadros (PCP e produção) + regra nova de sistema.**
   - Cada etapa/coluna mostra **no máximo 10 cards** e um botão **"Ver mais"** que carrega a próxima página daquela etapa (paginação **no servidor**, por etapa, nas RPCs do kanban — padrão `limite/deslocamento` da casa).
   - Contador no topo da coluna continua mostrando o total real (agregado barato no servidor, sem trazer os cards).
   - **Regra nova de sistema, pedida pelo dono:** *"cada tela deve requisitar apenas o que ela mostra — se a tela não mostra, ela não requisita"*. Promover a regra ao [[CLAUDE - Regras do Claude Code (repo)]] (e à cópia na raiz do repo — "mudou aqui → mudou lá") e ao [[PLT - Modelo de Sistema]]. Aplicá-la já nesta sessão aos quadros: nada de baixar o quadro inteiro para desenhar 10 cards.

4. **Execução: um pedido por vez + pausa por líder (revisa D-24 e Q-17).**
   - **Uma pessoa não pega dois pedidos de uma única vez:** o padrão de `plt_setores.limite_execucoes_por_pessoa` muda de "sem limite" para **1**. O teto continua configurável por setor no painel admin (M-10) — a mudança é o padrão, não a liberdade.
   - **Líder pode pausar a execução de alguém** (urgência do dia a dia: um produto é interrompido por instantes para outro passar na frente). Pausar/retomar são **eventos novos append-only** (`execucao_pausada`/`execucao_retomada`, com autor e execução referenciada); execução pausada **não conta tempo** para a pessoa enquanto pausada e **não conta** no limite de execuções simultâneas (é isso que permite a urgência entrar). Quem pausa: líder do setor do card e admin. A UI mostra claramente card pausado (ícone + texto, nunca só cor — M-12).
   - A validação vive em **trigger** (`fn_validar_execucao`), não só no front nem só em RLS (M-14).

## Perguntar ao dono no início da sessão (ritual de sempre: entendimento + dúvidas + decisões técnicas, e só codar com o OK)

1. Confirma que **todo setor de produção já tem sua etapa fila cadastrada** ("A FITAR", "A MONTAR"…)? Algum setor está sem?
2. Tempo em PCP no card de unidade: conta **da entrada do pedido no PCP até a liberação da unidade** — confirma? (Alternativa: até a liberação da *primeira* unidade do pedido.)
3. Pausa por líder: a pessoa pausada pode **retomar sozinha**, ou só o líder retoma?
4. O limite padrão 1 vale para **todos os setores** desde já, ou algum setor precisa de teto maior de saída?

## Fora do escopo

Estrutura do PCP e dos terminais (a coluna some só nos setores de produção) · botão "Concluir produção" e destino ESTOQUE/aguardo (SESSAO-24) · automações (SESSAO-27) · qualquer mudança em eventos já gravados.

## Critérios de aceite

- [ ] Nenhum setor de produção exibe coluna "Chegada"; card movido para um setor aparece na etapa fila real dele (testável movendo um card de verdade).
- [ ] Cards vivos que estavam "na chegada" migrados por evento (lote origem `api`), com contagem antes/depois registrada na memória de execução.
- [ ] Pedido que passou N dias no PCP mostra ~N dias de "tempo em PCP" no card de unidade e nos dashboards — verificado com um pedido real antigo.
- [ ] Cada coluna carrega no máximo 10 cards por página; "Ver mais" traz os próximos 10 **sem** recarregar o quadro; o payload da requisição inicial do quadro não contém cards além dos exibidos (conferir no navegador, aba Network).
- [ ] Regra "cada tela requisita só o que mostra" escrita no CLAUDE do repo, na cópia do cofre e no Modelo de Sistema.
- [ ] Com limite 1: segunda tentativa de iniciar execução é recusada com mensagem que diz o que fazer; após o líder pausar a primeira, a urgência inicia normalmente; retomar volta a contar tempo.
- [ ] Pausa/retomada aparecem na linha do tempo do card e descontam do tempo de execução da pessoa (conferir em `plt_fn_linha_tempo_card` e nas views).
- [ ] Revisão de D-24 (e da Q-17) registrada em [[PLT - Decisoes de Produto]] com D-NN novo.

## Notas para o Claude Code

Leituras obrigatórias na ordem do [[CLAUDE - Regras do Claude Code (repo)]]; ler [[SUPA - Esquema do Banco]] antes de qualquer SQL; esta demanda **2×**. Depois de ler, **antes de codar**: (a) entendimento em até 15 linhas, (b) dúvidas de negócio (as 4 acima), (c) decisões técnicas — e só seguir com o OK do dono. Task list espelhando a demanda; memória de execução em `_docs/Plataforma/Execucao/SESSAO-22.md` escrita **enquanto executa**; todo erro/acerto vira E-NN/A-NN na [[PLT - Memoria de Aprendizado]] **na hora**.
Armadilhas conhecidas deste terreno: sentinela `'chegada'` e `Number('') === 0` (E-16) · view/função que muda de forma é DROP+CREATE inclusive na migration antiga (E-17, E-19) · lote sem autor usa origem `api` e passa no `test:banco` antes (E-26) · trava para todos mora em trigger, não em RLS (M-14) · espelho de qualquer ajuste de banco em migration no mesmo dia (E-24).
**Checklist de validação final obrigatório e marcado item a item:** `npm run test:banco` (2 rodadas) · `npx tsc -b` · `npm run lint` · `npm test` · `npm run build` · F-07 (375px e 768px, alvos ≥44px) · ⏸️ checkpoint de aprovação antes de aplicar migration (F-08, md5 antes/depois) · `get_advisors` · task list conferida contra a demanda · handoff em `_docs/Handoffs/` + notas do cofre atualizadas ([[SUPA - Esquema do Banco]], [[PLT - Decisoes de Produto]], [[PLT - Memoria de Aprendizado]], [[000 - ORDEM DAS SESSOES]], [[000 - MAPA DO PROJETO]], [[000 - PROXIMOS PASSOS]]).

## Resultado (preencher ao entregar)

✅ **Entregue em 22/09/2026** — [[handoff_2026_09_21_sessao22_filas_tempo_pausa]] · memória em [[SESSAO-22|Execucao/SESSAO-22]] · decisões **D-48** (+complemento: iniciar na fila avança a etapa) e **D-49** (arquivar/excluir usuário — extra pedido na revisão). Migrations **29, 30 e 31** aplicadas com aprovação do dono (integração intacta nas três); manutenções: limite 1 nos 9 setores e 1 card migrado da "Chegada". Critérios de aceite todos verificados (test:banco 2×, tsc, lint, vitest 49/49, build, F-07 em 375/768px, advisors) e validação ao vivo com o dono — incluindo um E2E real de arquivar/reativar/excluir que pegou e corrigiu o E-35 (storage não se apaga por SQL). Regra nova promovida: **regra 17 / RNF-07** ("cada tela requisita só o que mostra").

## Ver também

[[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]] · [[SESSAO-04 - Kanban Nucleo]] · [[SESSAO-05 - Timers e Eventos de Tempo]] · [[SESSAO-23 - Meu Painel 2 - Filas Pessoais Subtarefas e Tempos]]
