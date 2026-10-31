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

## Banco — o que foi escrito (31/10)

Quatro migrations, todas aplicadas DUAS vezes sem erro no banco de desenvolvimento (PGlite com retrato — `scratchpad/dev.mjs`: o preâmbulo da bateria + as 122 migrations até `20261028030000` guardados com `dumpDataDir`; daí em diante só as novas, em segundos — A-132):

1. `20261031010000_plt_tempo_calendario_regras.sql` (F2) — `plt_tempo_config` (data oficial 26/10, recálculo desde 19/10), `plt_tempo_regras` (Montagem: teto 4 h, avisar pulo, lote), `plt_tempo_excecoes` (+ 20 feriados nacionais 2026–2027), `plt_tempo_horas_extras`, `plt_tempo_equipe` (Franklin/Franklinildo titulares na Montagem, demais apoio, letras pela ordem de cadastro), `plt_tempo_modelos` + `plt_tempo_modelo_chaves`, `plt_tempo_recalculos`; a régua `fn_tempo_janelas` (a exceção do setor vence a da fábrica; setor sem horário conta o dia todo), `fn_tempo_util` pela régua (mesma assinatura), `fn_tempo_corte`, `fn_tempo_modelo_nome/chave`; trilha, recálculo (despertador só com fila), e as portas das abas (expediente, calendário, hora extra, regras + data oficial, equipe, recálculo). Dado: o 07:30–18:00 de cada setor vira 07:30–12:00 + 13:00–18:00.
2. `20261031020000_plt_tempo_calculo_unico.sql` (F3) — o tipo `tempo_decisao` (o validate do check mudou para cá — E-19; tirado da `20261028020000`); `plt_tempo_trechos`, `plt_tempo_passagens`, `plt_tempo_padrao`, `plt_tempo_resumo_modelo_dia`, `plt_tempo_resumo_pessoa_dia`; `fn_tempo_card_trechos` (a máquina de estados dos fatos), `fn_tempo_dividir` (regra 6), `fn_tempo_movel`, `fn_tempo_classificar`, `fn_tempo_passagens_medir`, `fn_tempo_padrao_refazer`, os resumos, `fn_tempo_card_refazer`; o gatilho de RESTRIÇÃO ADIADO `plt_eventos_zzz_tempo` (uma vez por card por transação — mapa card → maior fato já refeito no `set_config` local, A-128); o gatilho imediato na presença; `fn_tempo_periodo_fechar`, `fn_tempo_recalculo_processar`; as portas `plt_fn_tempo_decidir` e as dos modelos; o recálculo desde 19/10 no fim.
3. `20261031030000_plt_tempo_na_origem.sql` (F1) — os motivos "Fim do expediente" e "Sem resposta ao aviso"; `plt_cards.corte_em`; `fn_validar_execucao` recriada da viva (pausa automática sem pessoa; o lote no limite de 1); `fn_presenca_sair_em`, `fn_card_pausar_automatico`; o despertador único (`fn_card_esquecido_marcar/proximo/armar/disparar`) com o corte e a pergunta sem resposta; `fn_tempo_calendario_mudou` remarca o corte (nunca para trás); `plt_fn_montar_juntos`, `plt_fn_lote_soltar`; o catálogo de avisos + `execucao_pulada`; a régua do aparelho com exceções, extras, cortes e lotes. Os cards já rodando na aplicação ganham o corte a partir de AGORA (nada retroativo — A-130).
4. `20261031040000_plt_tempo_telas.sql` (F4) — `fn_tempo_trecho_agora_s`, `fn_tempo_pessoa_estados`, `fn_tempo_trabalho_da_pessoa`, `fn_tempos_aberto` (presença aberta só nas janelas + trechos rodando); recriadas da viva com a fonte trocada: `plt_fn_tempos_pessoas`, `plt_fn_tempos_pessoa_detalhe`, `plt_fn_metas_painel`, `fn_quadro_junto` (+ `tempos`), `plt_fn_card_janela` (+ `tempo`); reescritas (mesma assinatura): `plt_fn_dash_tempos_pessoa` (do resumo), `plt_fn_dash_execucoes` (a página primeiro), `plt_fn_meu_desempenho`, `plt_fn_dash_tempos_setor/_item`, `plt_fn_dash_tendencia_semanas`; nova `plt_fn_card_historico`. A Visão do dia não tinha relógio de execução — não muda.

## Provas no desenvolvimento

- Os casos reais com almoço 12–13: o armário esquecido 47 min (era 876), o card do almoço 1h47, o Fitamento rodando para às 18:00 (1h33, sem fato retroativo), os 4 cards do admin de 21/10 = teste, a volta de 1 min descartada, o pulo da montagem avisa os admins, a decisão manual vence a regra; o gesto com o cálculo junto ~80–90 ms (PGlite).
- Na origem: pausa sozinha no fim do expediente (sem pessoa, no instante, quem estava sai do setor), aviso sem resposta pausa no instante do aviso, lote (recusa modelos diferentes, limite de 1 aceita o lote, tempo dividido: 30 min por móvel, 1 h para a pessoa).
- Ensaio ×100 (100 mil cards, 300 mil passagens, 600 mil trechos, 4.230 dias-pessoa; semeado com `session_replication_role = replica` — A-131), 2ª chamada: Tempos por pessoa 96 ms (90 dias 83), detalhe 91, Pessoas 6, Execuções 30, Tempo por setor 6, por item 27, tendência 5, modelos 51, histórico do card 9, quadro (80 cards) 13, padrão do modelo 3, Meu desempenho 6. Planos sem varredura das tabelas grandes. Antes da correção: Execuções 8,7 s, Pessoas 1 s, detalhe 0,6 s (E-172).

## Erros e correções (31/10)

- E-170: a extração da versão viva só procurava `create or replace function` e pegou uma versão velha de `plt_fn_dash_tempos_pessoa` (a viva foi recriada com `drop` + `create function` — a da foto); a migration nova falhou com "cannot change return type". Correção: o padrão aceita `create function`; refeitas as duas montagens e conferido que a da origem não mudou (diff vazio).
- E-171: semeei o expediente nos setores SEM horário; quebrou 3 testes da D-29 ("sem horário conta tudo"). Em produção todos os setores já têm horário — o semear saiu (fica só a troca da faixa única por duas).
- E-172: a lista de execuções contava o período inteiro (`count(*) over ()` sobre 160 mil trechos) e agrupava antes de paginar: 8,7 s no ×100. Correção: a página primeiro (índice parcial dos inícios), os trechos dela pelo índice da execução, e o total contado até 1.001 ("mais de mil"). Pessoas passou a ler o resumo por dia (1 s → 6 ms); a soma do fechado sem chamar função por linha (detalhe 0,6 s → 91 ms).
- E-173: um `python -` com heredoc VAZIO abriu o interpretador interativo em segundo plano e escreveu 64 MB de erro antes de ser parado. Correção: parado e o arquivo apagado; não juntar dois `python -` num comando.
- A bateria antiga com a regra nova: 12 vermelhos na 1ª rodada — 3 do semear (E-171), 1 do aviso "tempos" a cada card (tirado do refazer — o tópico do setor já avisa), 1 do check validado (as migrations da 42 entraram na sequência de reaplicação do meio da bateria — E-144), 1 da execução partida em trechos (a linha volta a ser a EXECUÇÃO: `execucao_id`), 5 do detalhe/scorecards (a presença passou a gatilho imediato; a pausa que fecha o último trecho entra no card — `<=`), 1 da dash por setor (o teste compara com a soma das passagens — mudança de propósito). 2ª rodada: 1.422 verdes, 2 vermelhos (o detalhe antigo esperava a soma escrita direto no agregado velho — teste ajustado — e o motivo da última pausa).

## Telas (31/10)

- Duas frentes em paralelo (subagentes, mesma pasta, arquivos separados, sem commit — revisadas e commitadas por mim): **Controle de tempo em 7 abas** (`src/paginas/ControleTempo.tsx` + `src/paginas/controleTempo/*`; rota e menu liberados ao líder, que vê só a Hora extra; rótulos da trilha na Auditoria) e **quadro/tablet/janela** (`tempoUtil.ts` espelha `fn_tempo_janelas`/`fn_tempo_corte`; `tempoDoMovelMs`; o card e a janela com o tempo do móvel e a pausa automática; "Tempo e histórico" por `plt_fn_card_historico` com os números das passagens; Montar juntos e Concluir o lote — `lote.ts`, `ModalLevarLote.tsx`; o aviso `execucao_pulada` leva ao card).
- Verificação: tipos e lint limpos; **360 testes de tela** (30 novos); build ok; **JS inicial 228,0 → 232,4 KB** (teto 250).
- Vitrine temporária (A-117 — `vitrine42.html` + `src/vitrine42.tsx`, apagadas): as 7 abas no computador; no celular 375 px sem rolagem lateral e sem botão abaixo de 40 px. Fotos em `Handoffs/imagens/sessao42-*.jpg`.

## Fechamento (31/10)

- **Bateria final: 1.444 verdes, TUDO VERDE** (o bloco novo com 32 conferências; os antigos ajustados à regra nova).
- **Leitura do banco real** (o antes × depois por setor): barrada pelo controle de segurança ("leitura de produção") — o comparador está pronto no rascunho (`copiar-real.mjs` lê em sessão só-leitura; `comparar-real.mjs` carrega no PGlite com as migrations de produção, mede como as telas contam hoje, aplica as 4 da 42 e mede de novo; provado com dado de mentira). Fica para o OK do dono.
- **Nada aplicado, nada publicado, nada na `main`** — esperando o OK do dono. ClickUp: as 9 tarefas da demanda pedem o OK do dono para nascer.
- Handoff: [[handoff_2026_10_31_sessao42_tempo_certo]].

## Subida (31/10, ~01:15–01:30 de Natal — OK do dono: "Ler e subir tudo")

- **Leitura do banco real** (sessão só-leitura): 1.047 cards, 4.052 fatos, 762 trechos de presença → comparador local (antes × depois — [[SESSAO-42 - antes e depois dos tempos]]). Achado no caminho: o comparador usava jornada de 9 h; a real é 9h30 (07:30–12:00 + 13:00–18:00) — nenhum dia acima. Ajuste de passagem na regra da jornada: a carência (os 5 min) também sai quando a presença antiga se sobrepõe aos trechos (bateria 1.444 verdes de novo).
- **Banco:** `20261031010000`, `…020000` (o recálculo desde 19/10), `…030000`, `…040000` — uma a uma pelo aplicador `--so`; integração do Tiny idêntica (`e2109f3a…`, 65 colunas, linhas idênticas) em todas; 70 → 75 tabelas.
- **Conferido no banco real (leitura, como o super admin):** 609 passagens (233 válidas, 17 a conferir, 42 retrabalho, 91 sem registro, 4 de admin, 131 teste, 122 ainda no setor), 373 trechos, 137 modelos, 137 tempos padrão, 90 dias-pessoa; os casos: 14541133 108 min, 14541253 46 min, 14542036 93 min no Fitamento; jornada: 0 acima (maior 9,22 h); `plt-card-esquecido` marcado para 03/11 10:30 UTC (terça 07:30 — o corte do 1 card rodando, depois de Finados); `plt-tempo-recalculo` sem fila (sem agendamento); 11 setores com 10 faixas; o check dos tipos de evento validado; as portas como o dono — Tempos por pessoa, Pessoas, Execuções, Tempo por setor, Meu desempenho, as abas, a régua (com `excecoes/extras/cortes/lotes`), o quadro (com `tempos`) e o histórico — todas respondendo (~100 ms contando a ida e volta da rede).
- **Site:** `main` avançada para `4051c08` (fast-forward, autor contatodomoby) e enviada.
- **Vercel:** `4051c08` publicado ("Vercel – sitema_domoby" success). Quem abrir o site recebe a versão nova (o aviso de versão nova pede para recarregar).
