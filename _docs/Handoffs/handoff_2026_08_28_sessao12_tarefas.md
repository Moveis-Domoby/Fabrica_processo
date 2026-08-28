---
titulo: Handoff — SESSAO-12 Tarefas e Delegação
tipo: handoff
data: 2026-08-28
atualizado: 2026-08-28
tags: [handoff, sessao, plataforma, tarefas, delegacao, d-34]
---

# 📋 Handoff — SESSAO-12 · Tarefas e Delegação (D-34) — a última do bloco noturno

**Branch:** `sessao-12-tarefas` (mesclada na `main` — bloco noturno D-26)
**Banco:** migrations **20 e 21** aplicadas em 28/08 (integração intacta)
**Demanda:** [[SESSAO-12 - Tarefas e Delegacao]] · **Memória:** `docs/execucao/SESSAO-12.md`
**Decisão que rege:** [[PLT - Decisoes de Produto#D-34|D-34]] — 3 modos por setor; sorteio SÓ entre logados; tarefa avulsa sem timer obrigatório; **delegação organiza, não trava**.

## 1. O que foi feito

- **Modo de delegação por setor** (Estrutura, no painel de cada setor): **Desativada** (card sem dono na fila — o padrão) · **Direta** (líder/admin atribui) · **Aleatória** (sorteio). Trocar num setor não afeta os outros.
- **Sorteio na chegada** (trigger, modo aleatória): só entre gente ativa do setor **com a plataforma aberta agora** (heartbeat de presença dos últimos 15 min), escolhendo quem tem **menos afazeres abertos**; empate vai para quem está há mais tempo sem receber. Ninguém logado → o card espera sem dono (sortear quem não veio seria dado-ficção). O sorteado é avisado no sino.
- **Delegação é evento append-only** (tipo `delegacao`: quem delegou, para quem, quando, modo) → `plt_cards.responsavel_id` é projeção. Reatribuir registra as duas. Delegação direta só por líder do setor do card ou admin (o banco valida). **Mudar de setor zera a delegação** (o afazer era daquele time).
- **Página Afazeres** (menu de todos — D-06, funciona no celular e no tablet): **Meus afazeres** (cards sob minha responsabilidade + tarefas avulsas, com atalho para o quadro) · **Nova tarefa avulsa** (operador cria para si; líder/admin delega a alguém do setor) · **Afazeres do time** (líder/admin: carga aberta por pessoa + reatribuição de cards por seleção).
- **Tarefa avulsa com timer OPCIONAL**: "Iniciar tempo" só se a pessoa quiser; concluir sem iniciar é normal.
- Tela do setor (tablet) mostra **"para {nome}"** no card delegado.
- **Presença**: heartbeat gravado no login e a cada 5 min (`plt_presencas`), silencioso.

## 2. O incidente que virou lição (E-20) — importante você saber

Na verificação descobri que a coluna `modo_delegacao` **JÁ EXISTIA no banco**, criada por **outra sessão de trabalho** (há um segundo servidor de desenvolvimento rodando nesta pasta) com desenho DIFERENTE (sem o modo "desativada", padrão "direta"). O `if not exists` da minha migration pulou em silêncio — e o front quebraria ao salvar. A **migration 21** alinhou tudo ao desenho da D-34 (3 modos, padrão conservador "desativada"; os setores que estavam no default alheio "direta" — escolha de ninguém — voltaram a "desativada"). Se essa outra sessão era sua e o "direta em tudo" era intencional, é um clique por setor para voltar.

## 3. Verificação executada

| Critério da demanda | Resultado |
|---|---|
| Setor aleatório: 5 cards → 2 membros, balanceado | ✅ `test:banco`: 5 chegadas com 2 logados → distribuição 3/2 (diferença ≤ 1); quem não estava logado nunca recebeu |
| Líder reatribui e o histórico mostra as duas delegações | ✅ `test:banco` (2 eventos, projeção = a última) + **navegador contra o banco real**: card 13192 delegado ao Operador Teste Um pela tela, carga subiu para "1 aberto(s)" |
| "Meus afazeres" reflete na hora, no celular e no tablet | ✅ navegador: tarefa criada apareceu em Meus afazeres → Iniciar tempo → Concluir (sumiu); polling 15s + invalidação nos gestos; card delegado aparece com "para {nome}" no tablet |
| Modo trocado por setor sem afetar os demais | ✅ `test:banco` (CNC desativado não sorteia com SECC aleatório) + navegador: SECC → "Aleatória" salvo pela tela (check novo aceitou) e revertido |
| PR + handoff | ✅ merge direto (D-20/D-26) · este documento |

Mais: `test:banco` TUDO VERDE (2 rodadas, **+7 verificações**) · tsc · lint · Vitest 23/23 · build ok · migrations 20+21 aplicadas · advisors: **os mesmos 16 WARN esperados** (nenhum endpoint novo) · console limpo na verificação de tela.

## 4. Como validar (do zero)

1. **Estrutura** → SECC → "Delegação dos cards que chegam" → **Aleatória**.
2. Abra a plataforma com dois operadores (a presença conta ao entrar) → mova cards para o SECC → cada chegada é sorteada balanceando a carga; o sorteado ganha aviso no sino.
3. **Afazeres** → crie uma tarefa avulsa → ela aparece em Meus afazeres → "Iniciar tempo" (opcional) → "Concluir".
4. Como líder/admin, em **Afazeres do time**: veja a carga por pessoa e reatribua um card pela seleção — a linha do tempo do card mostra as delegações.
5. Volte o modo do setor para "Desativada" — chegadas ficam sem dono.

## 5. Decisões provisórias (para você confirmar)

- **Padrão do modo = "desativada"** (comportamento de sempre; delegação é opt-in) — ver o incidente E-20 acima.
- **"Logado agora" = visto nos últimos 15 minutos** (heartbeat de 5 min). Sem check-in formal (você descartou o gesto extra).
- **Balanceamento determinístico** (menos abertos → mais tempo sem receber) em vez de sorteio randômico puro: auditável e "justo" no sentido da demanda.
- **Quadro desktop não mostra o responsável no cartão** nesta rodada (o tablet mostra; o líder tem a visão do time) — se quiser lá também, é pequeno.

## 6. Notas do cofre atualizadas

[[SUPA - Esquema do Banco]] (migrations 20/21) · [[PLT - Memoria de Aprendizado]] (**E-20**) · [[000 - ORDEM DAS SESSOES]] · [[000 - MAPA DO PROJETO]] · [[SESSAO-12 - Tarefas e Delegacao]] (status) · [[PLT - Modelo de Sistema]].

## Ver também

[[SESSAO-12 - Tarefas e Delegacao]] · [[handoff_2026_08_28_sessao11_api_rotas]] · [[PLT - Plano Noturno Sessoes 07-12]] · `_docs/Handoffs/continuidade_bloco_noturno.md` (o fechamento do bloco)
