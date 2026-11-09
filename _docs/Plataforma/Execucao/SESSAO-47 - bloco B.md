---
titulo: Diário de execução — SESSAO-47 · BLOCO B (a entrega: o dia real e vários comprovantes)
tipo: execucao
data: 2026-11-09
tags: [execucao, sessao-47, entregas, rotas, comprovantes, calendario]
---

# Diário — SESSAO-47 · Bloco B (09/11/2026)

Demanda: [[SESSAO-47 - Pedido Adiantado no Tiny Data Real da Entrega Comprovantes e Painel de Tempos]] — frentes 5 e 6.
Diário do supervisor (Bloco A e a base): [[SESSAO-47]].
Frente de implementação aberta pelo supervisor numa cópia isolada do repositório (ramo `worktree-agent-a2603ed15e06deb58`), com o brief `brief-bloco-B.md`.

## Partida (09/11, ~18:05 de Natal)

- A cópia nasceu no commit da `main` (`067d8ee`), **atrás** do ramo da sessão: faltavam a migration de 06/11 (`20261106030000`), a base da SESSAO-47 (`20261109010000`) e o diário do supervisor — as três coisas de que o brief depende. Conferido que `067d8ee` é ancestral de `7347451` (a ponta do ramo da sessão) e avancei o MEU ramo por *fast-forward* (`merge --ff-only 7347451`) — nada foi tocado fora da minha cópia.
- `npm ci` na cópia (sem junção para a pasta principal).
- Linha de base da bateria na minha cópia, antes de qualquer mudança: **1544 verdes, 1 vermelho** (o antigo — "Dashboard: as 7 portas novas = as antigas em 8 períodos"), ~70 s.
- Leitura: brief, CLAUDE.md, a demanda (2×), o diário do supervisor, a Lei de Desempenho §1–§13, o Modelo de Sistema (tokens, componentes, logística/rotas, área Pedidos, calendário, cabeçalho), as decisões D-113, D-115, D-120, D-121, D-156 (com a revisão do supervisor), D-194, D-195, D-213, D-214, D-267, D-270 e as lições citadas (E-17, E-19, E-24, E-41, E-65, E-70, E-89, E-103, E-110, E-120, E-142, E-157, E-159, E-161, E-163, E-165, E-170, E-172, E-176, E-178, E-192).

## Task list (espelha a demanda — Bloco B)

**Frente 5 — "Marcar como entregue no dia…"**
1. Banco: a data que vale projetada no card do pedido (`plt_cards.entrega_em`), por gatilho.
2. Banco: registrar a entrega com o dia (nunca futuro, nunca antes da chegada; fim do expediente no dia passado).
3. Banco: toque repetido e "desfazer do dia" pelo instante do REGISTRO.
4. Banco: correção do dia só do admin, por fato novo, com log e aviso ao vivo.
5. Banco: todos os leitores pela mesma data (lista de pedidos, ficha, rotas, já programadas, entregas do dia, calendário com "programado para", número de entregas do painel de motivos).
6. Telas: os três botões ("Confirmar entrega", "Ainda não", "Marcar como entregue no dia...") na Rotas e nas Entregas do dia; a inconsistência da imagem.
7. Telas: o dia em tudo (ficha, lista, Entregas do dia, calendário) e "Alterar a data da entrega" só para o admin.

**Frente 6 — Vários comprovantes de uma vez**
8. Um componente só: até 10, cada um sobe sozinho, falha não derruba os outros, tentar de novo só o que falhou.
9. Nos três lugares: painel do "Entregue", "Comprovante" do card, ficha do pedido.

**Geral**
10. Bloco novo na bateria + a migration na cadeia de reaplicação; bateria 2×.
11. Tipos, lint, testes de tela, pacote.
12. Ensaio ×100 das portas tocadas.
13. Checklist do §12 da lei; diário; commits.

## Mapa do que existia (conferido por extração da versão vigente — `viva.mjs`)

| Função | Vigente em | O que muda |
|---|---|---|
| `plt_fn_registrar_entrega` | `20261022020100:29` | + `p_dia`; toque repetido pelo registro |
| `plt_privado.fn_fechar_pedido` | `20261022020100:118` | + `p_ocorrido_em` (padrão nulo) |
| `plt_fn_entrega_parcial` | `20261027040000:290` | toque repetido pelo registro |
| `plt_fn_entrega_desfazer` | `20261104010000:581` | "do dia" e a situação de antes pelo registro |
| `plt_privado.fn_reabrir_entrega` | `20261104010000:488` | acha as peças pela hora do REGISTRO da entrega |
| `plt_privado.fn_projetar_entrega` | `20261008150000:88` | projeta também `entrega_em` |
| `plt_fn_rotas` | `20261106030000:56` | `entregue_em` pela projeção |
| `plt_fn_entregas_do_dia` | `20261105010000:227` | dia real, registro, chegada, "de outro dia" |
| `plt_fn_programadas` | `20261105020000:109` | `entregue_em` pela projeção |
| `plt_fn_rotas_calendario` | `20261106030000:648` | o entregue no dia real + `programado_para` |
| `plt_fn_dash_motivos` | `20261106030000:437` | `entregues` = vigentes pelo dia real |
| `plt_fn_pcp_pedido_detalhe` | `20261027040000:1950` | `entrega.em` pela projeção + registro, correção, chegada |
| `plt_fn_pedidos_lista` | `20261027040000:1543` | `entregue_em` pela projeção + a regra do PCP com a marca |
| `plt_fn_rotas_do_dia` | `20261014140000:471` | **nada** (só conta; não lê data) — não recriada |

## Frente 5 · banco — `supabase/migrations/20261109030000_plt_entrega_dia_real.sql` (2.160 linhas)

Montada por programa (`scratchpad/s47B/montar-migration.mjs`): cada função recriada sai da versão vigente (`viva.mjs`) e recebe **trocas exatas, cada uma conferindo quantas vezes casou**; as partes novas (coluna, índice, regra do dia, guarda, projeção, preenchimento, a porta do administrador) foram escritas à mão em `scratchpad/s47B/partes/`. Conferência independente depois de montar: `comparar.mjs` extrai cada função ANTES × DEPOIS e mostra só as linhas trocadas — bateu com o pretendido, o resto é idêntico byte a byte.

### O que a migration faz, na ordem

1. **`plt_cards.entrega_em timestamptz`** (nula = sem entrega vigente) + índice parcial `plt_cards_entrega_em_idx (entrega_em) where entrega_em is not null`.
2. **`plt_privado.fn_dia_da_entrega(timestamptz) → date`** — a função única do dia (fuso `America/Fortaleza`). **`plt_privado.fn_entrega_instante(p_dia, p_chegou_em) → timestamptz`** — a regra do dia num lugar só (registrar e corrigir leem daqui): futuro → recusa; antes da chegada (`plt_cards.criado_em` no fuso da fábrica) → recusa; hoje → agora; dia passado → o fim do expediente da fábrica naquele dia (`fn_tempo_janelas_fabrica` — a união dos setores de produção, com exceções do calendário e hora extra), 18:00 sem expediente; nunca fora do dia, nunca antes da chegada, nunca depois de agora.
3. **A guarda no fato** — gatilho `plt_eventos_validar_entrega_dia` (antes de inserir, só nos dois tipos): `pedido_entregue` nunca num dia futuro; `entrega_dia_corrigido` só pela porta (marca `plt.entrega_maquinaria`), apontando a entrega vigente e com o instante novo até hoje.
4. **A projeção** — `fn_projetar_entrega` recriada (+ `entrega_em`, + o tipo `entrega_dia_corrigido` no gatilho) e o **preenchimento** da história (o dia de cada entrega vigente = o do fato, ou o da última correção que aponta para ela; quem não tem entrega fica sem dia). Reaplicável.
5. **`fn_fechar_pedido`** + `p_ocorrido_em timestamptz default null` (a de 5 parâmetros sai): só o fato `pedido_entregue` usa o instante; `dados` ganha `dia_escolhido` e `registrado_dia`.
6. **`plt_fn_registrar_entrega`** + `p_dia date default null` (a de 3 sai): com dia ≠ hoje pede o instante à regra; a observação do fato ganha "Marcado como entregue no dia X (registrado em Y)"; o toque repetido passa a olhar `registrado_em`.
7. **`plt_fn_entrega_parcial`**: toque repetido por `registrado_em`.
8. **`fn_reabrir_entrega`** (a janela que acha as peças ancora no `registrado_em` da entrega) e **`plt_fn_entrega_desfazer`** ("do dia" e a situação de antes pelo `registrado_em`; a mensagem diz "no mesmo dia em que ela foi registrada").
9. **`plt_fn_entrega_corrigir_dia(p_card_id, p_dia, p_motivo default null) → jsonb`** (nova; só admin): fato `entrega_dia_corrigido` com `evento_referencia_id` = a entrega e `dados {antes, depois, entregue_em, motivo, numero, entrega_evento_id}`; mesmo dia = `{mudou: false}`; avisa `rotas`.
10. **Os leitores**: `plt_fn_pedidos_lista` (`entregue_em` = `pc.entrega_em`; e `fn_fora_do_pcp(situação, volta_pcp_em)` no lugar de `fn_tiny_tirou_do_pcp`), `plt_fn_pcp_pedido_detalhe` (`entrega.em` pela projeção; + `entrega.registrada_em`, `entrega.correcao {em, por, antes, depois, motivo}`, `plataforma.chegou_em`, `historico[].registrado_em`), `plt_fn_rotas`, `plt_fn_programadas` (sem a subconsulta do fato — uma leitura a menos por linha), `plt_fn_entregas_do_dia` (cada parada: `entregue_em` real, `entregue_no_dia`, `entrega_registrada_em`, `chegou_em`; e a lista nova `entregues_de_outro_dia`), `plt_fn_rotas_calendario` (a parte 1 dividida: "na rota" no dia programado; "entregue" no dia real, com `programado_para`), `plt_fn_dash_motivos` (`rotas.entregues` = vigentes pelo dia real).

### Decisões técnicas (banco)

- **A projeção estende `fn_projetar_entrega`** (uma atualização só do card por fato, um dono para a regra) em vez de um gatilho ao lado. A reaplicação de uma migration antiga recriaria a versão velha — por isso a nova entrou na cadeia de reaplicação do bloco 38.
- **O fato da correção acontece AGORA** (`ocorrido_em` = agora) e leva o instante novo da entrega em `dados.entregue_em`; a projeção lê de lá. Assim a trilha mostra "09/11 15:02 — Dia da entrega corrigido de 08/11 para 07/11 — Fulano", e não um fato que parece ter acontecido antes da própria entrega.
- **A regra do dia mora em UMA função** (`fn_entrega_instante`) — registrar e corrigir não repetem as checagens (M-04).
- **A hora do dia passado é a da FÁBRICA** (união dos setores de produção): a ROTAS não tem expediente próprio cadastrado e a demanda fala em "calendário da fábrica". Sem janela no dia, ou quando a régua devolve "o dia inteiro" (setor sem horário cadastrado), vale 18:00.
- **Filtro por dia sempre nos limites do dia direto na coluna** (`entrega_em >= início do dia e < início do dia seguinte`, no fuso da fábrica) — a função do dia só converte o que a tela mostra (função com `set search_path` não é embutida pelo planejador — E-65 — e esconderia o índice).
- **Nenhuma restrição amarrando `entrega_evento_id` e `entrega_em`**: a migration antiga reaplicada (rodada 2 da bateria, aplicador em modo "tudo") recria por instantes a projeção velha; a restrição quebraria qualquer entrega nesse intervalo. O par é mantido pelo gatilho (uma atualização só) e refeito pelo preenchimento a cada aplicação.
- **`plt_fn_devolucao_detalhe` e `plt_fn_busca_cards` NÃO foram recriadas** (fora da minha lista) — ver "Pendências".
- **Retornos em tabela não mudaram de forma** (`plt_fn_rotas`, `plt_fn_programadas`, `plt_fn_pedidos_lista`): por isso a Rotas não recebe a chegada do pedido (o campo do dia fica sem limite mínimo lá — o banco recusa com a explicação) e a lista de pedidos não sabe quando a entrega foi registrada.

### A bateria (`supabase/testes/testar-migrations.mjs`)

- **Bloco novo no fim** (`{ // SESSAO-47 · Bloco B`), numa transação desfeita, **34 conferências**: o dia (amanhã, antes da chegada, o dia da chegada, hoje, sem dia pelo site publicado), a hora (fim do expediente 17:15, feriado 18:00, hora extra 19:40, a chegada depois do expediente), só o fato da entrega no dia real (a peça em execução fecha agora; trechos e passagens sem intervalo negativo), toque repetido pelo registro, desfazer do dia pelo registro (entregador desfaz hoje a "entregue ontem"; a registrada ontem só o admin), todos os leitores, a entrega do Tiny e a parcial, a correção (logística e entregador recusados; fato novo; entrega intacta; log; aviso ao vivo; mesmo dia = nada), inserções diretas recusadas, a migration de novo duas vezes com a projeção estragada à mão, a lista com o pedido devolvido ao PCP, privilégios e assinaturas antigas fora. Portas chamadas como `authenticated` com `request.jwt.claim.sub` e ponto de volta (E-103/E-161). Faixa: usuários `…924801–924803`, pedidos `97201–97211`, nomes "47B", produto `1947201`/`SX47B`, setor `m47b`.
- **A migration na cadeia de reaplicação do bloco 38**, depois da base.
- ⚠️ **Cinco linhas de blocos ANTIGOS mudaram** (o brief só previa o bloco novo e a cadeia — avisar o supervisor), todas porque a regra mudou por decisão da demanda ou a assinatura mudou:
  1. bloco 56 (`has_function_privilege` de `fn_fechar_pedido`): a assinatura nova, de 6 parâmetros (E-120);
  2. bloco SESSAO-30 ("entrega de ontem: não se desfaz") e 3. bloco SESSAO-44 ("Outro dia: só o admin"): a entrega de teste "de outro dia" era simulada só pelo `ocorrido_em`; agora o "do dia" conta pelo registro, então o teste passa a gravar também o `registrado_em` de dois dias atrás;
  4. bloco SESSAO-39 ("no dia da rota: o programado na rota e o entregue"): o entregue não fica mais no dia programado — a conferência passou a exigir que ele NÃO esteja lá (o dia real é provado no bloco novo);
  5. bloco SESSAO-39 ("com 1 por dia vem uma barra e o total 2"): o dia 13 ficou com um pedido só; a paginação por dia passou a ser provada no dia 15 (o sem rota e o stand-by).
- Resultado depois da frente 5 · banco: **1578 verdes, 1 vermelho** (o antigo do dashboard) — eram 1544 + 34 novas.

