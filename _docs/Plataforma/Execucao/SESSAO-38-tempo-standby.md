---
titulo: SESSAO-38 · Frente F5 — Tempo útil do card + Stand-by no PCP (memória de execução)
tipo: execucao
data: 2026-10-21
branch: sessao-38-tempo-standby
fase: B entregue (21–22/10) — desenho da fase A abaixo, com os ajustes do supervisor no §10
---

# SESSAO-38 · F5 — Tempo útil do card (PCP sem fila, só expediente) + Stand-by no PCP

> Lote noturno autônomo (supervisor). Fase A = só leitura do código e do banco de
> produção (consultas de leitura pelo conector) + este desenho. A Fase B começa
> quando o supervisor mandar "IMPLEMENT" com a branch de integração das outras
> frentes (cartão do kanban/PCP/janela do card; rotas/expedição; motivos de
> pausa/tempo por pessoa; menu/login) — merge primeiro, código depois.

## 0. O pedido do dono (traduzido fiel)

**A) Janela do card → "Tempo e histórico".** O bloco do PCP mostra "Fila (do
setor): 0s · Ninguém iniciou aqui — o tempo foi todo de fila" — não faz sentido:
o PCP **não tem fila**; deve ser só **"Tempo útil em PCP"**. E todo tempo que o
card mostra respeita o **horário do SETOR**: fora do expediente, sem ninguém em
hora extra, **o tempo para de contar, até na fila** — conta só horas úteis.
Exceção: alguém trabalhando nele fora do horário (execução/auxílio rodando) —
esse tempo conta.

**B) STAND-BY no PCP.** Na tela inicial do PCP, **todo card** ganha a opção de
pôr em STAND-BY escolhendo um **MOTIVO** (motivos cadastrados nas configurações;
**obrigatório**; vai para a **auditoria** do dono). O PCP ganha uma **sub-aba**
para os pedidos em stand-by; de lá eles podem ser **lançados direto para as
entregas** ou **devolvidos para "aguardando liberação"** (só volta a aparecer
nas rotas se não estiver em stand-by). Pedido em stand-by **não conta tempo**.

## 1. Retrato de partida (banco de produção, só leitura — 21/10 05:34 UTC)

- `plt_setores`: PCP = id 1, `codigo 'pcp'`, `papel_no_fluxo 'entrada'`.
  Produção 2–7, terminais ESTOQUE (8), ROTAS (9), PEDIDOS EM AGUARDO (235),
  EM DECISÃO PÓS DEVOLUÇÃO (239).
- `plt_horarios_funcionamento`: **todos os setores têm seg–sex 07:30–18:00,
  MENOS o PCP (nenhuma linha)** → pela regra da `fn_tempo_util` (D-29),
  "sem horário = funciona o tempo todo": hoje o PCP contaria 24 h × 7.
  Nenhum horário por pessoa.
- `plt_pausas_tempo`: 0 linhas.
- `plt_motivos.tipo` em uso: `nao_entregue, desfazer_entrega, devolucao, pausa, saida`.
- `plt_eventos_tipo_check` (validado): a lista da migration 96 (SESSAO-36),
  termina em `auxilio_*`. Nenhum tipo de stand-by.
- PCP: 18 cards de pedido abertos; 694 cards no total.
- Índice que já serve o quadro do PCP: `plt_cards_pcp_abertos_idx
  (setor_atual_id, desde) where tipo='pedido' and liberado_completo_em is null
  and arquivado_em is null`.

## 2. Como o tempo é contado HOJE (código)

- **Banco:** `plt_privado.fn_tempo_util(ini, fim, setor, usuario)` (migration 16,
  D-29) — janelas do setor ∩ da pessoa, menos pausas do setor/pessoa; fuso
  `America/Fortaleza` (UTC−3 fixo). Usada só pelas dashboards (filas por setor,
  execuções, metas). **Não** é usada por nada que o CARD mostra.
- **Front (tudo no navegador, sem régua de horário):**
  - `src/kanban/linha-tempo.ts` → `montarSegmentos(eventos, agora)`: fila =
    chegada → 1º iniciar; total = chegada → saída; execução = iniciar → fim −
    pausas. Tempo de relógio corrido.
  - `src/kanban/componentes/ModalLinhaTempo.tsx` → `HistoricoDoCard` (também
    usado em "Tempo e histórico" da `JanelaDoCard.tsx`): o bloco por etapa com
    "Fila (do setor)", "Ninguém iniciou aqui — o tempo foi todo de fila",
    "Total na etapa"; e a linha "Pedido no PCP: X" (entrou_pcp_em →
    liberado_completo_em, D-48).
  - `src/kanban/componentes/CartaoUnidade.tsx`: "Pedido ficou X em PCP",
    "X na fila", "Parado · motivo · há X", "Pausado há X", fim de linha "X",
    execução "X · pessoa" — todos `agora − desde`.
  - `src/paginas/PCP.tsx`: o card do pedido mostra `formatarDuracao(card.desde)`.
  - `src/kanban/tempo.ts`: `formatarDuracaoMs` (com dias de 24 h), `useAgora`
    (re-desenho local a cada minuto — não busca dado, não fere a lei).
- A porta da linha do tempo `plt_fn_linha_tempo_card` devolve só eventos.
- O tempo em PCP do pedido não tem consumidor no servidor (nenhuma dashboard
  usa) — só o front.

## 3. Desenho — A) Tempo útil

### 3.1 A regra (uma só, escrita uma vez no front, espelho fiel da `fn_tempo_util`)

**Tempo contado de um trecho em que o card está no setor S** =
`| (janelas_S − pausas_S) ∩ [ini, fim] − stand-by |  ∪  trabalho`

- `janelas_S`: o horário do setor S (sem horário cadastrado = o tempo todo — a
  mesma regra da D-29).
- `pausas_S`: "desligar o setor agora" e as correções retroativas (D-29).
- `trabalho`: execuções abertas (menos as pausas da execução) e auxílios —
  **hora extra conta** (pedido do dono).
- `stand-by`: os períodos em que o pedido esteve em stand-by (só no PCP).

**O que cada mostrador usa:**

| Mostrador | Antes | Depois |
|---|---|---|
| Fila no card ("X na fila"), "Parado · motivo · há X", "Pausado há X", fim de linha | relógio corrido | **útil do setor atual** |
| Execução em andamento ("X · pessoa") | corrido − pausas | **igual** (quem trabalha fora do horário está em hora extra — conta) |
| Card do pedido no PCP (`PCP.tsx`) e "Pedido ficou X em PCP" | corrido | **útil do PCP, menos stand-by** |
| Linha do tempo: Fila (do setor) | corrido | útil (janelas − pausas) até o 1º iniciar |
| Linha do tempo: Total na etapa | corrido | útil ∪ trabalho |
| Linha do tempo: bloco do PCP | Fila/Ninguém iniciou/Total | **só "Tempo útil em PCP: X"** (o do PEDIDO — D-48), com "stand-by: Y fora da conta" quando houve |
| Linha do tempo: blocos de fim de linha (ESTOQUE, AGUARDO, ROTAS, DEVOLUÇÃO) | Fila/Ninguém iniciou | **"Tempo útil em <setor>: X"** (ninguém "inicia" num fim de linha — a mesma falta de sentido do PCP) ⏳ |

Mostrador de tempo útil **em horas** ("29h 10min", sem "dias" de 24 h — um "dia"
de 24 h úteis seriam 2,3 dias de galpão e enganaria) ⏳. Quando o card está
parado fora do expediente, um ícone + texto curto "fora do expediente — o tempo
não anda" (M-12) ⏳. Balão "i" no bloco: "Conta só o horário de expediente do
setor; trabalho fora do horário (hora extra) conta."

### 3.2 O horário do PCP

O PCP não tem horário → hoje contaria 24 × 7. **Escolha (⏳ D-168):** a
migration semeia UMA vez, só se o PCP não tiver nenhuma linha, o horário do
setor de produção de menor ordem (o SECC: seg–sex 07:30–18:00 — o mesmo de
todos os outros setores hoje). O admin muda em Configurações → Controle de
tempo como qualquer setor. Desfazer: apagar as 5 linhas do PCP (o tempo volta
a 24 × 7). Nenhuma regra mágica de "padrão da fábrica" no código — fica dado
visível e editável (M-10).

### 3.3 Como o front recebe a régua sem ferir a lei de desempenho

- **Régua do tempo** = dado de referência pequeno: as janelas de cada setor
  (≤ 11 setores × ≤ 7 dias) + as pausas de setor abertas ou que terminaram há
  menos de 120 dias (teto 500) + o fuso (−180 min). ~2–4 KB.
- `plt_privado.fn_regua_tempo()` (jsonb, uma regra) → entra como chave
  `regua_tempo` na **porta de abertura** (`plt_fn_abertura`, ao lado de
  etiquetas/campos) e é semeada no cache `['regua-tempo']` (`semearCache`);
  `public.plt_fn_regua_tempo()` (a mesma função) é o leitor de reserva da
  consulta, `staleTime: Infinity`. **0 requisição nova por tela.** O
  Controle de tempo invalida `['regua-tempo']` ao salvar; para as outras
  pessoas a régua nova chega na próxima abertura do app ⏳ (mudança de horário
  é rara; sem relógio, sem `postgres_changes`).
- **Motor no cliente:** `src/kanban/tempoUtil.ts` (puro, testado):
  `intervalosUteis(ini, fim, setorId, regua)`, `tempoUtilMs(ini, fim, setorId,
  regua, { trabalho?, excluir? })`, `estaNoExpediente(agora, setorId, regua)`,
  `formatarDuracaoUtil(ms)`; hook `useTempoUtil()` lê `['regua-tempo']`.
  Custo: O(dias do trecho) por card, sem rede — 800 cards re-desenhados por
  minuto custam microssegundos cada. O relógio local (`useAgora`) segue igual.
- `montarSegmentos(eventos, agora, contexto?)` ganha um 3º parâmetro opcional
  (`regua`, `setores` com o papel, `pcp` do pedido) e campos novos
  (`filaUtilMs`, `totalUtilMs`, `papel`, `pcpUtilMs`, `standbyMs`); sem
  contexto devolve o que devolve hoje (os testes antigos seguem valendo).
  Os auxílios entram como "trabalho" (os eventos `auxilio_*` já vêm na porta).
- **O tempo em PCP do pedido** precisa dos períodos de stand-by do pedido →
  vêm prontos na projeção do card do pedido (§4.2) e chegam pelas portas que
  já mostram o pedido: o resumo do pedido do quadro do PCP, o bloco `pedidos`
  do quadro do setor (`fn_quadro_junto`) e o `pedido` da janela do card
  (`plt_fn_card_janela` — hoje sem `entrou_pcp_em`; ganha `entrou_pcp_em`,
  `liberado_completo_em`, `standby_desde`, `standby_periodos`). Só chaves novas
  dentro de jsonb — **nenhuma assinatura/retorno muda** (A-12/E-17 evitados).
- A porta da linha do tempo (`plt_fn_linha_tempo_card`) **não muda**.

### 3.4 O que fica fora (registrado)

- As **dashboards** continuam com a `fn_tempo_util` como está: ela desconta
  também execução fora do horário (o card passa a contar hora extra). Diferença
  consciente, levada ao dono como ponto em aberto — mudar as dashboards é outra
  frente.
- Horário **por pessoa** não entra na fila do card (a fila é do setor — M-08);
  segue valendo nas dashboards.
- Outras telas com "há X" (Expedição, Pedidos em aguardo, Danificados,
  Afazeres) — passam a usar o mesmo motor se couber na Fase B; o que não couber
  vira dívida registrada na lei.

## 4. Desenho — B) Stand-by no PCP

### 4.1 Os fatos (append-only — RNF-05)

Dois tipos novos em `plt_eventos` (no card do PEDIDO):

- `pedido_standby_entrou` — `usuario_id`, `origem 'interface'`,
  `observacao` = o motivo em texto (é o "por quê" que a Auditoria já lê),
  `dados {motivo_id, motivo, numero}`.
- `pedido_standby_saiu` — `evento_referencia_id` = o `entrou`,
  `dados {destino: 'aguardando'|'entregas', numero}`, `observacao` opcional.

O check `plt_eventos_tipo_check` é recriado `not valid` com a lista inteira +
os dois tipos e validado no fim da MINHA migration (a mais nova do check); o
`validate` da migration 96 sai (E-19 ↪️). A trilha (`fn_logar_evento`) grava
sozinha → a **Auditoria** mostra quem, quando e o motivo; rótulos novos em
`src/auditoria/rotulos.ts` ("Pôs o pedido em stand-by", "Tirou o pedido do
stand-by") e no grupo de filtro de cards.

### 4.2 A projeção (banco enxuto — colunas no card do pedido, nenhuma tabela)

`plt_cards` + `standby_desde timestamptz` (nulo = fora), `standby_motivo text`,
`standby_periodos jsonb not null default '[]'` (os períodos FECHADOS
`[{ini, fim}]`). Escritas só pelo gatilho próprio `plt_eventos_projetar_standby`
(AFTER INSERT, por linha, `when tipo in (...)`) → `fn_projetar_standby` — sem
recriar a `fn_projetar_card` (que as frentes do cartão mexem). Índice parcial
`plt_cards_pcp_standby_idx (desde, id) where tipo='pedido' and standby_desde is
not null and arquivado_em is null`. Colunas novas nulas/padrão → o site
publicado não percebe nada.

### 4.3 Os motivos

`plt_motivos` ganha o tipo `standby` (check recriado `not valid` + validate na
minha migration; o validate da 96 sai). Semeados (curtos, editáveis):
"Aguardando pagamento", "Cliente pediu para segurar", "Aguardando confirmação
do cliente", "Aguardando medidas ou projeto", "Produto já pronto no estoque",
"Entrega a combinar". `plt_fn_motivo_salvar` recriada inteira (+ `standby`).
Validação pelo ajudante que já existe, `fn_motivo_da_lista('standby', id,
texto)` — lista **ou "Outro" com o texto escrito**; vazio é recusado (motivo
obrigatório) ⏳ (o mesmo desenho da pausa — D-125). Tela: Configurações →
Utilitários ganha a aba **"Motivos de stand-by"** (padrão `PainelMotivos`;
`TipoMotivo` + `'standby'` em `src/rotas/api.ts`).

### 4.4 As portas (public, security definer, execute só authenticated)

- `plt_fn_pcp_standby(p_card_id, p_motivo_id, p_texto)` — entra. Card de
  pedido, no PCP, vivo (não arquivado, não liberado por completo, o Tiny não o
  levou adiante — `fn_tiny_tirou_do_pcp`), tem o que produzir. **Quem:** a
  mesma regra de editar o card de pedido (`fn_pode_editar_card` — PCP/logística,
  líder, admin — D-125 item 7) ⏳. Já em stand-by → devolve "já está" sem
  gravar de novo (idempotente).
- `plt_fn_pcp_standby_sair(p_card_id, p_destino, p_observacao)`:
  - `'aguardando'` → grava `pedido_standby_saiu` — volta ao quadro
    "Aguardando liberação" e às listas das rotas/expedição.
  - `'entregas'` → **"Lançar direto para as entregas"** ⏳ = a MESMA maquinaria
    do "Em rota" do super admin (D-117): grava a saída, `fn_concluir_pedido`
    (toda peça fica pronta em Pedidos em aguardo — a que faltava nasce pronta,
    usando a peça do estoque reservada pela venda quando há) e
    `plt_fn_lancar_rotas` (vai para ROTAS → aparece em Programação). Tudo numa
    transação (ou tudo, ou nada). **Recusado** quando há peça do pedido viva
    num setor de PRODUÇÃO ("N peças estão na produção — espere ficarem prontas
    ou devolva para aguardando liberação") ⏳ — o "Em rota" do super admin
    arranca a peça da produção; para o PCP isso seria perigoso.
  - Fora do stand-by → recusa com frase de gente (não grava nada).

### 4.5 O quadro e as abas do PCP (o mesmo caminho de sempre)

- `plt_fn_cards_pedido_pcp` (recriada inteira a partir da versão viva depois do
  merge): `p_grupo` ganha `'standby'`; nulo e `'pedido'` passam a excluir
  stand-by. Mesma assinatura. `plt_fn_pcp_quadro` (mesma assinatura) passa
  `standby_desde`, `standby_motivo`, `standby_periodos` e `entrou_pcp_em`
  dentro do `pedido_resumo` (jsonb).
- **Visão do dia** (`plt_fn_dash_pcp_dia`): o quadrinho do PCP conta só o que o
  quadro "Aguardando liberação" mostra — stand-by fora (D-75: painel = quadro;
  a bateria compara os dois conjuntos — A-35/A-36).
- **`PCP.tsx`:** aba nova **"Stand-by"** (`?aba=standby`, entre "Pedidos
  aguardando liberação" e "Lançamento manual"; D-88/D-134 — a aba vive no
  endereço) com contador. Cada cartão: Pedido N, cliente, **motivo**, "em
  stand-by desde dd/mm hh:mm por Fulano", o tempo útil em PCP **parado**, e dois
  botões grandes: **"Lançar para as entregas"** (confirmação dizendo o que vai
  acontecer) e **"Devolver para aguardando liberação"**. No cartão de
  "Aguardando liberação" entra o botão **"Stand-by"** (no lugar que a frente do
  cartão do PCP deixar) → modal de motivo (padrão do `ModalMotivoPausa`).
  Paginação no servidor com "Ver mais" (lista viva e limitada — deslocamento
  justificado, como o quadro). Cada aba pede só o que mostra.
- **Ao vivo:** todo fato no card de pedido já avisa `plt-aviso:pcp`
  (`fn_avisar_eventos`) → o PCP relê `['cards']` (a aba nova usa
  `['cards','pcp-standby',…]`) e a Expedição (que ouve `pcp`) também. O
  "lançar para as entregas" grava `pedido_lancado_rotas` → avisa `rotas`
  (Programação). **Nenhum gatilho de aviso recriado.**

### 4.6 Stand-by fora das rotas

- Expedição (`plt_fn_expedicao_kanban`): `and pc.standby_desde is null` ⏳
  ("só volta a aparecer nas rotas se não estiver em stand-by").
- O ajudante único "candidato a rota" que a frente das rotas está criando
  ganha a mesma condição depois do merge.
- O pedido em stand-by nunca está lançado (o lançar fecha o stand-by antes), então
  Programar/Já programadas não o veem.

### 4.7 Pedido parcialmente liberado ⏳

Pode entrar em stand-by (o dono pediu "todo card"): sai de "Aguardando
liberação" e o relógio do PCP para; **as peças já liberadas seguem na produção**
normalmente (o stand-by é do que falta liberar). Devolver → volta ao quadro com
o que falta. Lançar para as entregas → só quando nenhuma peça estiver num setor
de produção (§4.4).

### 4.8 O Tiny continua mandando

Se o Tiny levar o pedido adiante (faturado, enviado, entregue, cancelado —
D-132), ele sai também da aba Stand-by (o mesmo filtro). Se voltar, volta para
a aba em que estava. Nada vai ao Tiny.

### 4.9 "Não conta tempo"

O relógio do PCP do pedido = útil do PCP de `entrou_pcp_em` até
`liberado_completo_em` (ou agora), **menos** os `standby_periodos` e o stand-by
aberto (`standby_desde` → agora). Mesmo motor da parte A.

## 5. Objetos de banco (Fase B — UMA migration `20261022050010_plt_tempo_util_standby.sql`)

Aditiva e compatível com o site publicado; `set local lock_timeout = '5s'`.

1. `plt_cards`: `standby_desde`, `standby_motivo`, `standby_periodos` + índice
   parcial.
2. `plt_eventos_tipo_check` + 2 tipos (not valid → validate no fim); validate
   da 96 removido.
3. `plt_motivos_tipo_ck` + `standby` (idem) + seed + `plt_fn_motivo_salvar`.
4. `fn_projetar_standby` + gatilho `plt_eventos_projetar_standby`.
5. `plt_fn_pcp_standby`, `plt_fn_pcp_standby_sair`.
6. Recriadas inteiras a partir da versão VIVA depois do merge (mesma
   assinatura): `plt_fn_cards_pedido_pcp`, `plt_fn_pcp_quadro`,
   `plt_fn_dash_pcp_dia`, `plt_fn_expedicao_kanban` (+ o ajudante das rotas),
   `fn_quadro_junto` (pedidos + stand-by), `plt_fn_card_janela` (pedido +
   tempos de PCP + stand-by), `plt_fn_abertura` (+ `regua_tempo`).
7. `plt_privado.fn_regua_tempo()` + `public.plt_fn_regua_tempo()`.
8. Seed do horário do PCP (só se vazio).

Bateria (`test:banco`, bloco novo dentro de `{ }` — E-70; sem prettier — E-110):
entrar/sair, idempotência, motivo obrigatório, quem pode (como `authenticated`
— E-103), stand-by fora do quadro/painel/expedição e dentro da aba, painel =
quadro (conjunto, não só total — A-36), lançar direto (peças no aguardo + ROTAS
+ recusa com peça na produção), devolver, o Tiny tirando, régua (o PCP com
horário semeado), duas rodadas. Prova no banco real sem gravar (bloco `DO` +
`RAISE` — A-75, como `authenticated`, pessoa por pessoa), `EXPLAIN ANALYZE`
×100 das portas tocadas, `get_advisors`.

## 6. Arquivos do front (Fase B)

- novo `src/kanban/tempoUtil.ts` (+ `tempoUtil.test.ts`), `src/kanban/tempo.ts`
  (`formatarDuracaoUtil`), `src/kanban/linha-tempo.ts` (+ testes),
  `src/kanban/componentes/ModalLinhaTempo.tsx` (blocos), `src/kanban/janela/JanelaDoCard.tsx`
  (linha de estado útil + pedido para o histórico), `src/kanban/componentes/CartaoUnidade.tsx`,
  `src/kanban/tipos.ts`, `src/kanban/api.ts` (stand-by), `src/paginas/PCP.tsx`
  (aba + botão), novo `src/kanban/componentes/ModalStandby.tsx`,
  `src/autenticacao/abertura.ts` (semear régua), `src/paginas/ControleTempo.tsx`
  (invalidar régua), `src/paginas/Utilitarios.tsx` + `src/rotas/api.ts`
  (motivos), `src/auditoria/rotulos.ts`.

## 7. Decisões provisórias (a registrar em `PLT - Decisoes de Produto.md`)

- **D-167 ⏳** Tempo útil do card: a régua do setor; fila/espera/pausa/fim de
  linha/PCP só no expediente; execução e auxílio sempre (hora extra); mostrador
  em horas; PCP e fins de linha com "Tempo útil em <setor>"; dashboards como
  estão (diferença registrada).
- **D-168 ⏳** O PCP ganha o horário do setor de produção de menor ordem
  (seg–sex 07:30–18:00), semeado uma vez, editável em Controle de tempo.
- **D-169 ⏳** Stand-by: só card de pedido em "Aguardando liberação" (inclusive
  parcial — as peças liberadas seguem); motivo da lista ou "Outro" com texto,
  obrigatório; quem pode = quem edita o card de pedido; aba própria no PCP.
- **D-170 ⏳** "Lançar direto para as entregas" = o "Em rota" do super admin
  (concluir + lançar para ROTAS → Programação), recusado com peça na produção;
  "Devolver" = volta para aguardando liberação.
- **D-171 ⏳** Stand-by fora da Expedição, dos candidatos a rota e do quadrinho
  da Visão do dia; o Tiny continua mandando (D-132).
- **D-172 ⏳** A régua do tempo vem na abertura (dado de referência); quem não
  é o admin que editou recebe a régua nova na próxima abertura; pausas de setor
  dos últimos 120 dias.

## 8. Riscos

1. **Funções compartilhadas recriadas** (`plt_fn_abertura`, `plt_fn_card_janela`,
   `fn_quadro_junto`, `plt_fn_pcp_quadro`, `plt_fn_cards_pedido_pcp`,
   `plt_fn_expedicao_kanban`) — outras frentes mexem nelas. Remédio: recriar
   SÓ a partir da versão que sair do merge, e a minha migration (prefixo
   `20261022050010`) tem de ordenar DEPOIS das delas; conferir md5 do corpo vivo
   × arquivo depois de aplicar (A-79).
2. **Check de tipos de evento e de motivos:** se outra frente também acrescentar
   tipo, a minha lista tem de ser a união (conferir depois do merge).
3. **"Lançar direto" pela pessoa do PCP** (não super admin): `fn_concluir_pedido`
   grava fatos `origem 'api'` com pessoa; provar no harness e no banco real
   como `authenticated` (E-103) que a guarda (`fn_validar_api`,
   `plt_eventos_validar_saida_pcp`) aceita.
4. **Duas cópias da regra de tempo** (SQL das dashboards × TS do card) — M-04
   ferido de propósito (o card calcula no aparelho para não pagar por card no
   banco); o teste do TS espelha os cenários da `fn_tempo_util`.
5. Régua velha em outras sessões abertas até reabrir (aceito, D-172).
6. Mostrador em horas muda o jeito de ler ("29h" no lugar de "1d 5h") — o dono
   pode preferir outro formato.
7. Seed do horário do PCP muda a dashboard de filas do PCP (passa a contar só
   expediente) — é o pedido do dono, mas é efeito colateral visível.

## 9. Registro da Fase A

- 21/10 ~05:30 UTC: branch `sessao-38-tempo-standby` criada na worktree (a
  partir de `bd75dd2`, igual à `origin/main`). Nada instalado, nada alterado
  fora deste arquivo.
- Lidos: CLAUDE.md, a memória (todos os E/A), D-29, D-48, D-75, D-88, D-95,
  D-116, D-117, D-120, D-125, D-132–D-135, D-146, D-147, a Lei de Desempenho, a
  nota do esquema; as migrations 16 (`fn_tempo_util`), 29 (tempo de PCP), 47/48
  /74/82 (quadro do PCP), 56 (o "Em rota" do super admin), 59 (motivos), 61/78
  (avisos), 68/71 (janela e linha do tempo), 96 (auxílios, abertura, quadro),
  98 (níveis); o front da linha do tempo, do cartão, do PCP, da abertura, do
  ao vivo, dos utilitários e da auditoria.
- Consultas de leitura em produção: setores, horários, pausas, tipos de motivo,
  check de eventos, índices de `plt_cards`, contagens, assinaturas das portas.

## 10. Fase B — o que foi feito (21–22/10, madrugada)

**Ajustes do supervisor ao desenho (valem por cima dos §4.4/§4.6):**
1. O stand-by **fica na Expedição** (todos os filtros) com a marca "Stand-by · motivo"; sai só dos candidatos de rota (`vw_pedidos_para_rota`) e de "Aguardando liberação" (D-171 ajustada).
2. "Lançar para as entregas": não existe mais o "lançar para ROTAS" (frente da logística) — é sair do stand-by + `fn_concluir_pedido` (CHAMADA, não recriada — a frente da logística a recriou com "Expedição" no texto): as peças que faltam nascem prontas na Expedição, o pedido fica "Pronto" e vira candidato de rota. Recusado com peça na produção.
3. `plt_fn_motivo_salvar` recriada a partir da versão da pausa especial (com `p_especial`); stand-by nunca especial (o check da frente F4 já barra).
4. Texto "Pedidos em aguardo" nos meus arquivos: só comentários; o rótulo da Auditoria do endereço antigo virou "Logística · Expedição"; na linha do tempo o lugar aparece como "Expedição" (`nomeDoLugar` da logística).
5. Migration com prefixo `202610220500xx` — `20261022050010_plt_tempo_util_standby.sql`.

**Linha do tempo da fase B:**
- merge da `sessao-38-integracao` (2×: a segunda trouxe a rodada de ajustes da logística, migration 20261022020100). md5 do corpo vivo × arquivo de cada porta recriada conferido ANTES (iguais) e DEPOIS de aplicar (iguais ao meu arquivo).
- Migration montada por EXTRAÇÃO (gerador no scratchpad — A-97): parte própria + 8 portas recriadas com trocas conferidas (1 ocorrência cada).
- E-19: os `validate` do check de eventos (migration dos cards) e do de motivos (migration da presença) mudaram para esta.
- Bateria: bloco F5 (24 verificações, como `authenticated` — E-103) + o bloco 82 compara o resumo sem as chaves `standby_*` + o bloco dos cards reaplica a minha depois da dela (E-136). Resultado: tudo verde menos "SESSAO-33 · o fluxo do n8n … ponta a ponta" — falha também na integração sem a F5 (conferido rodando a bateria da integração numa cópia); depende do horário (a conta da fábrica fica fora da varredura de madrugada) — o supervisor mandou ignorar.
- Ensaio no banco real (transação desfeita): migration 982 ms; a pessoa do PCP pôs o pedido 13215 em stand-by (sumiu de "Aguardando" 16 → 15, apareceu na aba com o motivo e o nome, ficou na Expedição com a marca, saiu da Programação), lançou para as entregas (5 peças nasceram prontas na Expedição, liberado, "pronto"); as 21 pessoas ativas abriram o app sem erro e com a régua. Desfeito (conferido: a coluna nova não existia depois). ⚠️ E-137: durou ~15 s com a trava da DDL.
- **Aplicada** 21/10 ~06:51 UTC (`--so`), integração idêntica. Checks validados; PCP com 5 janelas; 6 motivos.
- Medidas no banco real (bloco DO, como a pessoa do PCP, quente): quadro do PCP ~21 ms, aba Stand-by ~8 ms, Expedição ~13 ms, Programação ~22 ms, régua 0,5 ms, abertura ~7 ms, quadrinho 3,4 ms.
- Front: motor `src/kanban/tempoUtil.ts` (+ testes), `useReguaTempo.ts`, linha do tempo com o contexto (+ testes), `ModalLinhaTempo` (bloco do PCP e dos fins de linha só com "Tempo útil em …"; os outros no tempo útil; balão explicando), `CartaoUnidade` (fila/parado/pausado/fim de linha/"Pedido ficou X em PCP" no tempo útil; "fora do expediente"), `JanelaDoCard` (estado no tempo útil; o pedido em stand-by; o histórico recebe o pedido), `PCP.tsx` (aba Stand-by, botão no card, card do stand-by com lançar/devolver, relógios no tempo útil do PCP), `ModalStandby.tsx`, `abertura.ts` (semeia a régua), `ControleTempo.tsx` (relê a régua), `Utilitarios.tsx` (aba "Motivos de stand-by"), `rotas/api.ts` (tipo à parte `TipoMotivoComStandby` — os modais da entrega intocados), `auditoria/rotulos.ts`, `Expedicao.tsx` + `logistica/api.ts` (a marca).
- build ✓ · lint ✓ · test 46 arquivos / 260 testes ✓ · test:banco ✓ (fora o do horário) · mojibake vazio · JS inicial 222,5 KB.
