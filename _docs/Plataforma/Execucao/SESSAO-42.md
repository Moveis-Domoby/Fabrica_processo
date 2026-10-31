---
titulo: SESSAO-42 — diário de execução
tipo: execucao
data: 2026-10-30
tags: [execucao, sessao-42, tempo]
---

# SESSAO-42 — diário de execução

Demanda: [[SESSAO-42 - Tempo Certo - Calendario Regras e Calculo Unico]]. Ramo `sessao-42-tempo-certo` (pasta principal, sem worktree — pedido do dono), nascido da `main` em `60622ce`; o 1º commit traz a demanda, a SESSAO-43 e a ordem das sessões. Numeração reservada: D-203…D-224 · E-170…E-189 · A-128…A-142 · migrations `20261031xxxxxx` (depois de `20261028030000`) · ids de teste `...4201–4249` (livres — conferido no harness: os de 28/10 usam `...4281–4294`).

Modo: o dono mandou não perguntar nada de negócio (as 17 respostas estão na demanda) — o que faltar vira decisão provisória registrada. Banco de produção, carga de dados e publicação só com o OK dele no fim.

## Task list (espelho da demanda)

1. F2 — calendário (exceções, feriados nacionais 2026–2027), hora extra, regras por setor, equipe no painel, modelos, recálculo — banco + portas (1 por aba) + trilha.
2. F3 — o cálculo único: trechos, passagens (fila/execução/parado útil, esforço, pessoas, modelo, desfecho, situação, motivo), tempo padrão por setor × modelo, resumos por dia (setor × modelo, setor × pessoa); fila de recálculo em lotes; porta e fato da decisão manual; recálculo desde 19/10 na aplicação.
3. F1 — pausa automática no fim do expediente; aviso sem resposta vira pausa; motivos semeados; "pausado — fim do expediente"; montar em lote (quadro e tablet); aviso "Móvel pulou a montagem".
4. F4 — card, janela, Tempos por pessoa, Pessoas, Meu desempenho, Visão do dia, metas e Tempo por setor lendo as projeções; a régua com intervalos, exceções e horas extras.
5. Telas: Configurações → Controle de tempo em 7 abas (PC e celular); líder só vê Hora extra dos seus setores.
6. Bateria (bloco novo, duas rodadas) com os casos reais + cada regra; prova no banco real sem gravar (com o OK do dono); antes × depois por setor.
7. Cofre: decisões provisórias, memória, esquema, lei (checklist §12 + plano de crescimento), handoff; ClickUp (as tarefas propostas pedem o OK do dono para criar).

## Leitura (30–31/10)

- Lidos: CLAUDE.md, a demanda (2×), a ordem das sessões, o handoff do ajuste de 28/10, decisões de tempo (D-29, D-48, D-59, D-146/147, D-164…D-172, D-197/198, D-202), memória (fim + modelos mentais), lei (§1–§13), modelo de sistema (componentes base e Controle de tempo), o esquema (migrations de tempo).
- Mapeados por três leituras paralelas: as telas de tempo do front, as funções de tempo do banco (versão viva de cada uma) e a bateria.
- O conector do Supabase desta sessão aponta outro projeto ("Rag agentes") — a leitura do banco da fábrica é pelo `.env.local` (script só-leitura), e fica para o fim, com o OK do dono.

## Desenho do cálculo único (decisões técnicas)

- **A régua de calendário tem um dono:** `plt_privado.fn_tempo_janelas(setor, de, até, pessoa)` → `tstzmultirange` = expediente da semana (faixas — o almoço é o buraco entre duas) ou, no dia com exceção, a exceção (a do setor vence a da fábrica: feriado/parado = nada; dia trabalhado = as faixas dele) + horas extras (do setor, e da pessoa quando dada) − pausas de setor/pessoa (`plt_pausas_tempo`). Setor sem horário nenhum conta o dia inteiro (como sempre). `fn_tempo_util` passa a usá-la (mesma assinatura — as portas antigas acertam sozinhas).
- **O corte (regra 2) como conta:** `fn_tempo_corte(setor, início, pessoa)` = o fim da última janela do dia em que o trecho começou (com a hora extra junto); começou depois do expediente do dia → o começo da próxima janela (não conta nada). O trecho vale até `min(fim, corte)`. Ao vivo, o mesmo instante vira o fato da pausa.
- **Trecho** = início/retomada da execução (pessoa = quem iniciou) ou do auxílio até a pausa/mover/finalizar/outro iniciar/arquivar; chave = o evento que abriu. **Passagem** = do evento que pôs o card no setor de produção até o que o tirou; chave = o evento de entrada (a decisão manual aponta para ele — estável no recálculo).
- **Divisão (regra 6):** por pessoa, N = trechos dela abertos ao mesmo tempo (qualquer card); cada pedaço vale 1/N. Tempo do móvel = ∫ sobre a união dos trechos do card de max(1/N) das pessoas ativas; esforço = Σ dos trechos divididos.
- **Recalcular por card:** um gatilho de restrição ADIADO (fim da transação) em `plt_eventos` refaz o card uma vez por gesto (o soltar gera 2–5 fatos); os cards das mesmas pessoas que se sobrepõem são refeitos só nos números. Recalcular um período = os cards com fato no período, em lotes (fila + despertador por fato).
