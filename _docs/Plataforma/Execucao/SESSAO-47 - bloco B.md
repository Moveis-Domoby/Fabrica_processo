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

### Ajuste pedido pelo supervisor (no meio da sessão): o calendário sempre com o plano sob medida — commit `ef6cf1d`

- O ensaio ×100 do bloco A (do supervisor) mostrou `plt_fn_rotas_calendario` em ~1 s nas 5 primeiras chamadas e **35–76 s da 6ª em diante na mesma conexão**: o plpgsql troca o plano sob medida pelo plano genérico (que não sabe o período). Já era assim antes desta sessão (achado no ajuste de 06/11).
- A função (que é minha) ganhou **`SET plan_cache_mode TO 'force_custom_plan'`** ao lado do `SET search_path` — só nela. O `montar-migration.mjs` faz a troca com contagem (1 ocorrência).
- Bateria: a **35ª conferência** do bloco — o `proconfig` da função (`pg_proc`) traz as duas configurações e 8 chamadas seguidas na mesma conexão respondem igual.
- Resultado: **1579 verdes, 1 vermelho** (o antigo).

## Frente 5 · telas — commits `9b6af65`, `5066210` e `9d08eac`

### Arquivos

| Arquivo | O que é |
|---|---|
| `src/rotas/diaDaEntrega.ts` (novo) | As contas de dia da tela, puras: `hojeNaFabrica`, `diaNaFabrica`, `diaPorExtenso` ("08/11/2026"), `diaCurto` ("08/11"), `problemaDoDia` (amanhã / antes da chegada), `registradaHoje` (o "do dia" do desfazer), `entregueEmOutroDia`. A mesma régua do banco (fuso da fábrica, UTC−3 fixo). |
| `src/rotas/ConfirmarEntrega.tsx` (novo) | **Um componente só** para os dois lugares em que se registra entrega: "Confirmar entrega", "Marcar como entregue no dia..." e "Ainda não"; no modo do dia, o campo "Em que dia foi entregue?" (máximo = hoje; mínimo = a chegada, quando a tela sabe) e o botão "Marcar como entregue em dd/mm/aaaa". Com `aviso` (o pedido que ainda aparece em produção), os dois botões de confirmar valem como o "entregar mesmo assim" de antes. |
| `src/paginas/Rotas.tsx` | A lista da logística usa o componente (tamanho `md`); a entrega leva `{entrega, confirmar, dia}`. |
| `src/paginas/EntregasDoDia.tsx` | O painel do entregador usa o componente (tamanho `lg`, com os comprovantes e a observação como filhos); a lista "Entregues" mostra "entregue em dd/mm" quando o dia real difere do dia da rota, o desfazer conta pelo REGISTRO, e os entregues neste dia que eram de outra rota aparecem com "programado para dd/mm (Caminhão)". |
| `src/rotas/api.ts` | `registrarEntrega({…, dia?})` (só manda `p_dia` quando há dia — o banco de antes segue servindo); `corrigirDiaDaEntrega`; tipos novos (`entregue_no_dia`, `entrega_registrada_em`, `chegou_em`, `EntregueDeOutroDia`, `programado_para`). |
| `src/pedidos/entregaNaFicha.ts` (novo) | Os tipos das chaves novas da ficha (a `DetalhePedido` mora em `src/kanban/api.ts`, do bloco A — estendida aqui, sem tocar lá) e as frases: `quandoFoiEntregue` ("no dia 08/11/2026"), `quandoFoiRegistrada` ("registrado em …"), `fraseDaCorrecao`. |
| `src/pedidos/AlterarDataDaEntrega.tsx` (novo) | O botão "Alterar a data da entrega" e a janela (dia + motivo opcional). Quem usa decide quem vê — a ficha só mostra ao administrador; o banco confere de novo. |
| `src/pedidos/FichaDoPedido.tsx` | "no dia X, registrado em Y por Z"; a frase da correção; o desfazer do dia pelo registro; o botão do administrador; o fato "Dia da entrega corrigido" e o "registrado em …" no histórico. |
| `src/pedidos/ProducaoDoPedido.tsx` | A peça que saiu com a entrega mostra o dia real da entrega. |
| `src/rotas/AbaCalendario.tsx` | O entregue no dia real; a nota do programado (curta na barra — "prog. dd/mm", sem encolher; a frase inteira no `title`/`aria-label` e no detalhe do toque); "Ver a rota" abre o dia programado. |
| `src/dashboards/api.ts` | Só o comentário do campo `rotas.entregues` (o número agora é o das entregas vigentes pelo dia real). |
| Testes | `src/rotas/diaDaEntrega.test.ts`, `src/rotas/ConfirmarEntrega.test.tsx`, `src/rotas/EntregueNasDuasTelas.test.tsx`, `src/pedidos/FichaDoPedido.test.tsx`, `src/rotas/AbaCalendario.test.tsx`. |

### Decisões técnicas (telas)

- **O site publicado segue servindo com o banco novo e o site novo com o banco de antes**: todo campo novo é opcional no tipo e a tela trata a falta (sem `entrega_registrada_em`, o "do dia" cai na hora da entrega, como era; sem `entregues_de_outro_dia`, lista vazia; sem `programado_para`, sem nota). `p_dia` só vai na chamada quando a pessoa escolheu um dia.
- **Uma mutação, três botões**: "Confirmar entrega" manda dia nulo; "Marcar como entregue em …" manda o dia; o "carregando" gira só no botão tocado.
- **A ficha relê uma vez só** depois de corrigir a data (a chave da ficha saiu da lista de invalidação — ela relê pelo `aoMudar`); as outras telas (rotas, programadas, entregas do dia, calendário, lista de pedidos) são invalidadas por sinal.
- **O dia de hoje sem carregar o painel de tempos** (commit `9d08eac`): `hojeNaFabrica` vinha de `src/dashboards/tempos/formato.ts` (arquivo do bloco C); a conta, de uma linha, passou a morar em `diaDaEntrega.ts` — a tela do entregador não baixa mais nada daquele painel e não depende de arquivo de outra frente. Um teste confere que as duas contas dão o mesmo dia.
- **Ajuste pedido pelo supervisor** (commit `5066210`): na barra do calendário a nota saía cortada; ficou "prog. dd/mm" com `shrink-0` (quem encolhe é o bairro).

## Frente 6 · vários comprovantes de uma vez — commit `2d58ff2`

**Sem mudança de banco**: cada arquivo usa a porta de registrar anexo que já existia (`plt_fn_anexo_registrar`, que não repete o mesmo caminho — `on conflict (caminho) do nothing`).

| Arquivo | O que é |
|---|---|
| `src/rotas/enviarComprovantes.ts` (novo) | A lógica, pura e testada: `MAXIMO_COMPROVANTES = 10`; `acrescentarComprovantes` (até 10; o vazio e o documento com mais de 10 MB ficam de fora com o porquê; a foto grande entra porque é reduzida no aparelho; o mesmo arquivo de novo não repete); `enviarComprovantes` (um depois do outro; cada um por si; devolve `{enviados, falharam}`); `porEnviar` (o que falta: o não tentado e o que falhou). |
| `src/rotas/useComprovantes.ts` (novo) | A escolha e o envio de um pedido, para a janela: `abrir(pedido, {arquivos?, depoisDaEntrega?})`, `escolher`, `enviar()`, `fechar()`. Tudo subiu → avisa "N comprovantes anexados ao pedido N" e fecha; algum falhou → a janela fica. |
| `src/rotas/ModalComprovantes.tsx` (novo) | `EscolhaDeComprovantes` (o botão de escolher — `input type=file multiple` — e a lista com o "tirar" e o estado de cada arquivo) e `ModalComprovantes` (a janela: "Anexar N arquivos" / "Tentar de novo o arquivo que falhou" / "Tentar de novo os N que falharam"; "Cancelar" ou "Deixar para depois"). |
| `src/rotas/api.ts` | `anexarComprovante(cardId, arquivo, chave?)`: com a chave do arquivo o caminho no armário é sempre o mesmo — tentar de novo não deixa cópia solta; se o arquivo já tinha subido e só o registro falhou, o armário responde "já existe" e segue-se direto para o registro. `LIMITE_ARQUIVO` exportado. |
| `src/paginas/EntregasDoDia.tsx` | A janela é **da tela** (o card sai da lista quando o pedido é entregue e os comprovantes continuam subindo). O painel do "Entregue" escolhe vários; registrada a entrega, a janela abre e sobe um por um. O "Comprovante" do card abre a mesma janela. A janela antiga de um arquivo só (`ModalAnexar`) saiu. |
| `src/pedidos/FichaDoPedido.tsx` | Botão "Anexar comprovantes" em "Comprovantes e anexos" (antes a ficha só listava e abria) + a mesma janela; cada arquivo que sobe relê a ficha. |
| Testes | `src/rotas/enviarComprovantes.test.ts`, `src/rotas/ModalComprovantes.test.tsx`, + 2 em `EntregueNasDuasTelas.test.tsx` e 1 em `FichaDoPedido.test.tsx`. |

- **A entrega nunca depende do comprovante**: é registrada primeiro, como já era; os arquivos sobem depois.
- **Um por vez, não todos juntos**: no celular com internet fraca falha menos, e a ordem do envio é a da lista (o estado de cada linha: "enviando…", "enviado", "falhou — o porquê").
- **O estado nunca só pela cor**: o texto diz e o ícone acompanha; o resumo ("2 de 3 enviados · 1 não subiu — o porquê está na linha do arquivo") é `role="status"`.
- A janela do card do quadro (`src/kanban/janela/AnexosDoCard.tsx`, do bloco A) **já aceitava vários arquivos** — não foi tocada.
- **Tentar de novo sem cópia solta, provado em teste** (`src/rotas/anexarComprovante.test.ts`, escrito no fechamento): com a chave do arquivo o caminho é sempre o mesmo; se o arquivo já tinha subido e só o registro falhou, o armário responde "já existe" (pelo número 409, pelo código `ResourceAlreadyExists` ou pela frase — as três formas que a biblioteca do armário devolve) e o registro segue; sem a chave, "já existe" continua sendo erro.

## Decisões provisórias tomadas na execução (em língua de gente — o supervisor numera no cofre)

As que a demanda já trazia como provisórias foram cumpridas como escritas (nunca antes da chegada; a hora do dia passado = fim do expediente; a nota "programado para dd/mm"; o "do dia" pelo registro; o motivo opcional; até 10 comprovantes). As de baixo são as que precisei tomar para fechar o que a demanda não dizia.

**O dia da entrega**
1. **A hora que fica guardada num dia passado** é o fim do expediente da fábrica naquele dia — o fim do último turno de qualquer setor de produção, contando hora extra. Em dia sem expediente (domingo, feriado) ou sem horário cadastrado, vale 18:00. Se o pedido chegou à plataforma depois dessa hora naquele mesmo dia, vale a hora da chegada.
2. **"Chegada do pedido à plataforma"** é o momento em que o pedido ganhou o card dele na plataforma.
3. **Escolher o próprio dia de hoje** no calendário é o mesmo que "Confirmar entrega" (a hora é a de agora).
4. **O campo do dia começa vazio**: a pessoa escolhe; o botão só acende com um dia que vale e passa a dizer "Marcar como entregue em dd/mm/aaaa".
5. **Na lista da logística (Rotas → Entregas) o campo do dia não tem data mínima** — essa lista não recebe do banco quando o pedido chegou. Se o dia for anterior à chegada, o banco recusa e a tela mostra a explicação. No painel do entregador e na ficha o campo já limita.
6. **Na trilha do pedido**, a entrega marcada num dia passado leva a frase "Marcado como entregue no dia X (registrado em Y)".
7. **A entrega parcial não ganhou a escolha do dia**: continua valendo no dia em que é registrada; se precisar, o administrador corrige o dia depois, na ficha.
8. **A entrega que vem do Tiny** continua valendo no momento em que a plataforma recebeu o aviso; o administrador também pode corrigir.

**A correção do administrador**
9. **A correção fica registrada como acontecida na hora em que foi feita**, levando dentro dela o dia de antes e o dia novo; a entrega original fica intacta. Na ficha aparece "Dia corrigido por Fulano em … (era dd/mm/aaaa) — motivo".
10. **Corrigir para o mesmo dia não registra nada** (a janela nem deixa salvar).
11. **O motivo tem até 300 letras.**
12. **A hora depois de corrigir** segue a regra 1 (fim do expediente do dia novo; se o dia novo é hoje, a hora de agora).

**Onde o dia aparece**
13. **Entregas do dia → "Entregues neste dia"** junta (a) as paradas da rota já entregues — com "entregue em dd/mm" quando o dia de fato é outro — e (b) os pedidos entregues de fato naquele dia que estavam programados para outro ("programado para dd/mm (Caminhão)"). A logística vê todos; o entregador, só os das rotas da equipe dele. No máximo 100 por dia. O desfazer fica na rota em que o pedido estava programado, não nessa segunda lista.
14. **O pedido entregue fora do dia programado continua na rota em que estava** (como parada já entregue): a rota não muda, só o dia mostrado.
15. **No calendário**, o entregue sem programação continua fora, como antes; no detalhe, "Ver a rota" abre a rota do dia programado; a nota na barra é curta ("prog. dd/mm") e a frase inteira aparece no toque.
16. **Na lista de pedidos**, quando o dia foi escolhido, a hora ao lado é a do fim do expediente (a lista não sabe quando a entrega foi registrada; a ficha diz as duas coisas).
17. **O número de entregas do painel de motivos** passou a contar as entregas que estão valendo, pelo dia de fato — antes contava os registros, inclusive os que foram desfeitos depois.
18. **Na aba Produção da ficha**, a peça que saiu com a entrega mostra o dia de fato da entrega.
19. **A frase de quem não pode desfazer** passou a dizer "Só dá para desfazer a entrega no mesmo dia em que ela foi registrada" / "Foi registrada em outro dia: só um administrador reabre, na ficha do pedido".

**Vários comprovantes**
20. **Passou de 10 na mesma escolha, os excedentes ficam de fora** com o aviso "Até 10 comprovantes por vez — os outros ficaram de fora". Dá para enviar esses e escolher mais depois.
21. **Os arquivos sobem um depois do outro**, não todos juntos (no celular com internet fraca falha menos, e dá para ver o andamento de cada um).
22. **Arquivo vazio e documento (PDF/Word) com mais de 10 MB ficam de fora já na escolha**, com o porquê. **A foto grande entra**, porque é reduzida no próprio aparelho antes de subir.
23. **O mesmo arquivo escolhido duas vezes não repete.**
24. **No "Entregue" do entregador a entrega é registrada primeiro**; os comprovantes sobem em seguida numa janela que mostra cada arquivo. Se algum falhar, a entrega já vale e a janela oferece tentar de novo só o que falhou. Sair da janela vira "Deixar para depois": o que subiu fica no pedido e o que faltou pode ser anexado depois pelo botão "Comprovante".
25. **Arquivo que já subiu não pode mais ser tirado da lista ali** (já está no pedido); o que falhou pode ser tirado ou tentado de novo.
26. **A ficha do pedido ganhou o botão "Anexar comprovantes"** (antes ela só mostrava e abria os comprovantes).

## Erros, acertos e aprendizados (para o supervisor levar à memória de aprendizado — eu não mexo nela)

**Erros**
- **Um `cd` no shell** (regra 20): rodei uma vez `cd "<minha cópia>"; pwd` para conferir a pasta. Não mudou nada (a pasta já era a minha cópia), mas é a regra que não se quebra — daí em diante só caminho absoluto, `git -C`, `npm --prefix`, `npx --prefix`.
- **A demanda lida uma vez inteira, não duas, antes de codar**; a segunda leitura (do bloco B, das respostas do dono e dos critérios de aceite) foi feita no fechamento, conferindo item a item — não achei nada fora do entregue além do que está em "Pendências".
- **O formatador mexeu em três trechos antigos de `src/rotas/api.ts`** que não eram meus (`TipoMotivoComStandby`, `OrdemCandidatos`, `AVISO_PONTO_APROXIMADO`): desfiz à mão. Lição: depois de formatar, conferir `git diff --numstat` — o arquivo que não nasceu formatado sai maior do que a mudança.
- **O número do pacote inicial que eu tinha anotado estava errado** (149,5 KB): a minha cópia não tem as variáveis do ambiente, e sem elas o construtor joga fora o cliente do banco inteiro. Com variáveis de mentira (sem valor nenhum) o número bate com o do supervisor: **231,2 KB**. Lição: medir o pacote sempre com as variáveis presentes.
- **A ficha relia duas vezes depois de corrigir a data** (a invalidação e o `aoMudar`): tirei a chave da ficha da lista.
- **Dois botões "Fechar" na janela dos comprovantes** (o X da janela e o do rodapé): o do rodapé virou "Cancelar" / "Deixar para depois".

**Acertos que valem repetir**
- **Função recriada por programa, com trocas contadas** (`montar-migration.mjs`) e **conferência independente** (`comparar.mjs` mostra só as linhas trocadas): nenhuma função saiu de uma versão velha.
- **Toda regra de dia em UMA função do banco** (`fn_entrega_instante`) e **em UM arquivo da tela** (`diaDaEntrega.ts`), com a mesma régua.
- **Filtro por dia nos limites do dia, direto na coluna** (nunca a função do dia por linha) — é o que deixa o índice trabalhar.
- **Testes antigos que codificam a regra antiga** não se "consertam" afrouxando: cada um passou a provar a regra nova (5 linhas, listadas acima).
- **Janela de envio na TELA, não no card**, quando o card some da lista no meio do gesto.
- **Em cópia isolada sem `.env.local`**, os testes de tela e a montagem rodam com variáveis de mentira (`VITE_SUPABASE_URL=https://teste.invalid`, `VITE_SUPABASE_ANON_KEY=chave-de-teste-sem-valor`) — nenhum segredo lido.

**Aprendizados**
- **O "do dia" de qualquer gesto que se desfaz precisa do instante do REGISTRO**, não do instante do fato, assim que o fato pode nascer no passado. Vale para o desfazer, para o toque repetido e para a janela que acha "as peças que saíram com a entrega" (`fn_reabrir_entrega` achava as peças por uma janela em volta do `ocorrido_em` da entrega — com a entrega "de ontem" não acharia nenhuma).
- **`plan_cache_mode` é configuração por função**: `SET plan_cache_mode TO 'force_custom_plan'` na definição resolve a porta plpgsql cujo plano genérico é ruim, sem tocar no resto.
- **O armário (Storage) diz "já existe" de três jeitos** (`status` 409, `statusCode` '409' ou o código `ResourceAlreadyExists`, e a frase "The resource already exists") — a tela aceita os três.

## Como abrir cada estado novo de tela (para as fotos)

Não tirei fotos (a cópia não tem `.env.local`; quem fotografa é o supervisor). Cada estado abaixo tem um teste de tela que o monta com dados prontos — servem de receita para a vitrine.

**1. Os três botões — `ConfirmarEntrega`** (`src/rotas/ConfirmarEntrega.tsx`; props `numero`, `pergunta?`, `aviso?`, `chegouEm?`, `carregando`, `tamanho`, `aoConfirmar(dia | null)`, `aoCancelar`, `children?`)
- **Na logística** — `/fabrica/rotas/entregas`, aba das entregas, tocar em "Entregue" numa linha "a entregar": `tamanho="md"`, `pergunta="Confirmar a entrega do pedido inteiro?"`. Estados: (a) os três botões; (b) tocar em "Marcar como entregue no dia..." → campo "Em que dia foi entregue?" + botão "Escolha o dia da entrega" (apagado) → com um dia válido vira "Marcar como entregue em dd/mm/aaaa"; (c) dia de amanhã digitado → o erro "Esse dia ainda não chegou…" e o botão apagado; (d) **o aviso da imagem**: pedido com peça ainda em produção (`prontoParaEntregar(estado)` falso — ou o banco pediu a confirmação porque a tela estava velha) → o aviso amarelo no lugar da pergunta ("…em produção na fábrica (0 de 1 peça pronta)…"), com os mesmos três botões. Teste: `src/rotas/EntregueNasDuasTelas.test.tsx` → "ROTAS → Entregas: depois do 'Entregue'".
- **No entregador** — `/entregas/do-dia` (ou a aba embutida na Rotas), tocar em "Entregue" num card: `tamanho="lg"`, com "Anexar comprovantes (opcional)" e "Observação (opcional)" acima dos botões; `chegouEm` = `chegou_em` da parada (o campo do dia limita dos dois lados). Mesmos estados (a)–(d). Teste: mesmo arquivo → "Entregas do dia (o entregador): depois do 'Entregue'".

**2. A lista "Entregues neste dia" — `EntregasDoDia`** (`src/paginas/EntregasDoDia.tsx`), abrir "Entregues hoje (N)":
- parada da rota de hoje marcada hoje como **entregue ontem**: `entregue_no_dia` = ontem, `entrega_registrada_em` = hoje → a linha diz "entregue em dd/mm" e traz **Desfazer**;
- parada **registrada em outro dia**: `entrega_registrada_em` = ontem → no lugar do Desfazer, "Foi registrada em outro dia: só um administrador reabre, na ficha do pedido.";
- **entregue hoje, programado para outro dia**: um item em `entregues_de_outro_dia` (`programado_para`, `caminhao_nome`) → "· programado para dd/mm (Caminhão)".
Teste: "os entregues: a parada marcada hoje como 'entregue ontem' diz o dia…".

**3. A ficha do pedido — `FichaDoPedido`** (`/fabrica/pedidos/todos` → abrir um pedido entregue → "Entrega e comprovante")
- `entrega.em` em dia anterior a `entrega.registrada_em` → "**no dia dd/mm/aaaa, registrado em dd/mm/aaaa às hh:mm** por Fulano" (no resumo do topo e no painel da entrega);
- mesmo dia → o texto de sempre, com a hora;
- `entrega.correcao` preenchida → "Dia corrigido por Fulano em … (era dd/mm/aaaa) — motivo";
- **administrador** (`perfil.papel === 'admin'`) → o botão "**Alterar a data da entrega**"; logística → não aparece;
- a janela `AlterarDataDaEntrega` (props `cardId`, `numero`, `entregueEm`, `chegouEm`, `aoMudar`): "Dia em que foi entregue" (da chegada até hoje) + "Motivo (opcional)" + "Salvar a data" (apagado no mesmo dia, com a ajuda "A entrega já está nesse dia…");
- **histórico**: o fato "Pedido entregue" com o dia em que valeu + "· registrado em …"; o fato novo "**Dia da entrega corrigido**";
- "Comprovantes e anexos" → o botão "**Anexar comprovantes**".
Teste: `src/pedidos/FichaDoPedido.test.tsx` (9 casos, um por estado).

**4. O calendário das rotas — `AbaCalendario`** (`/fabrica/rotas/programacao`, aba do calendário)
- item `situacao: 'entregue'` com `programado_para` ≠ o dia da célula → a barra leva "**prog. dd/mm**" depois do bairro; o `title`/leitor de tela diz "programado para dd/mm";
- tocar na barra → o detalhe com "**Entregue no dia**" + a nota "programado para dd/mm" e "Ver a rota" (abre a rota do dia programado);
- entregue no próprio dia programado, ou ainda na rota → sem nota.
Teste: `src/rotas/AbaCalendario.test.tsx`.

**5. A janela dos comprovantes — `ModalComprovantes`** (`src/rotas/ModalComprovantes.tsx`; prop `envio` = o que `useComprovantes()` devolve)
- **escolhendo**: `envio.abrir({card_id, numero})` → título "Comprovantes — pedido N", botão "Escolher arquivos", rodapé "Cancelar" + "Anexar" (apagado); com arquivos → a lista (nome + tamanho + "Tirar …") e "Anexar N arquivos"; com 10 → "Já são 10 arquivos — o máximo por vez…"; documento de mais de 10 MB / vazio → o aviso amarelo com o nome;
- **enviando**: cada linha "enviando…" (girando) → "enviado" (✓ verde);
- **falhou**: a linha com borda vermelha e "falhou — o porquê", o resumo "2 de 3 enviados · 1 não subiu — o porquê está na linha do arquivo." e o rodapé "Deixar para depois" + "**Tentar de novo o arquivo que falhou**" (ou "Tentar de novo os N que falharam");
- **depois do "Entregue"**: `envio.abrir(pedido, {arquivos, depoisDaEntrega: true})` → a faixa azul "A entrega do pedido N já ficou registrada. Os comprovantes sobem um por um…" e o envio já rodando.
- No painel do "Entregue": `EscolhaDeComprovantes` com `rotulo="Anexar comprovantes (opcional)"` (o botão + a lista dos escolhidos, cada um com o "Tirar").
Teste: `src/rotas/ModalComprovantes.test.tsx` (3 casos) e os dois de comprovantes em `EntregueNasDuasTelas.test.tsx`.

## Pendências e pontos para o supervisor conferir

**Fora dos meus arquivos (achados, não mexidos)**
1. **A busca geral** (`src/busca/ondeEsta.ts` + `plt_fn_busca_cards`) escreve "Entregue em dd/mm" pelo `arquivado_em` da PEÇA — que é o dia do registro, não o dia real. Para a entrega marcada num dia passado, a busca mostra o dia em que foi marcada.
2. **O detalhe da devolução** (`plt_fn_devolucao_detalhe`) mostra no histórico o `ocorrido_em` do fato da entrega: a entrega marcada "no dia X" sai certa (o fato já nasce no dia real); a **corrigida** depois pelo administrador continua mostrando o dia antigo (a correção é outro fato).
3. **A Auditoria** (`src/auditoria/rotulos.ts`) não tem rótulo para `entrega_dia_corrigido` — cai no rótulo automático ("Entrega dia corrigido"). A ficha já escreve "Dia da entrega corrigido".
4. **A lista de pedidos** (`src/pedidos/**` é meu, mas o retorno em tabela de `plt_fn_pedidos_lista` não mudou de forma): mostra o dia real com a hora do fim do expediente. Se o dono quiser "sem hora" quando o dia foi escolhido, a lista precisa receber o instante do registro (coluna nova no retorno = assinatura nova).

**Para conferir**
5. **No celular do entregador**: com a escolha de vários arquivos (`multiple`), o seletor do aparelho continua oferecendo a **câmera**? Pela leitura do comportamento do Chrome no Android (a lista de tipos aceitos tem PDF e Word, então ele usa o seletor clássico, com a câmera) e do Safari no iPhone, sim — mas não testei em aparelho. Se não oferecer, o remédio é pequeno: um botão "Tirar foto" ao lado, como o "Câmera" da janela do card.
6. **A recusa "já existe" do armário** foi lida no código da biblioteca (`@supabase/storage-js`) e coberta em teste com as três formas; não foi exercitada contra o armário de verdade.
7. **Depois de aplicar em produção**: `select count(*) from plt_cards where entrega_evento_id is not null and entrega_em is null` tem de dar 0; o preenchimento encosta no `atualizado_em` dos cards de pedido entregues (o gatilho de atualização roda) — não dispara aviso ao vivo (os gatilhos de aviso do card têm condição própria).
8. **Advisors** (a leitura de produção estava barrada): a porta nova `plt_fn_entrega_corrigir_dia` é `security definer` pública para `authenticated` (o aviso de sempre para porta desse tipo) e o índice novo aparece como "não usado" até a primeira leitura.
9. **Largura de celular (375) e tablet (768)**: os botões usam as alturas de toque da casa e quebram linha (`flex-wrap` / grade de 1 coluna no celular), mas **não vi a tela** — as fotos do supervisor fecham esse critério.
10. **As 5 linhas de blocos antigos da bateria** (listadas acima) — o brief só previa o bloco novo e a cadeia.

