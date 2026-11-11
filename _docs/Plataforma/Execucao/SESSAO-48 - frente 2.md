---
titulo: Diário de execução — SESSAO-48 · frente 2 (a vaga do pedido volta ao PCP com aviso, e o PCP decide)
tipo: execucao
data: 2026-11-11
tags: [execucao, sessao-48, frente-2, pcp, cancelamento]
---

# Diário — SESSAO-48 · frente 2 (11/11/2026)

Demanda: [[SESSAO-48 - Cancelar Fabricacao de Verdade - Peca de Pedido Pergunta o Destino]] (seção "Frente 2") · diário do supervisor: [[SESSAO-48]].
Cópia isolada (worktree) no ramo `sessao-48-f2-pcp`, nascida do commit base `1999e2d`. Migration reservada: `20261111020000_plt_pcp_aviso_remover.sql`. Faixa de teste: pedidos 97521…, produtos 924821….

## Leitura feita

Brief comum; CLAUDE.md; a demanda (2×: a frente 2, a regra nova, os critérios, as notas); a migration base inteira nas partes da frente 2 (§1 tipos, §3 projeções, §5 a regra única do PCP e as portas, §6 validação/projeção dos fatos, §7 o gesto, §10 o aviso fecha na liberação, §13 recuperar, §14 busca, §15 catálogo); o diário do supervisor (lições); Modelo de Sistema (§4 componentes, "Quadro por arrasto…", "Kanban completo…" — "Escolher um motivo", §5 e §7); Lei de Desempenho §1–§4 e §12; memória (E-178, E-237, E-238, E-239, A-209, E-70, E-81, E-175, E-235, E-249).

## O que achei antes de codar

- **A aba Cancelados do PCP não existe mais na tela**: desde 14/10 (D-134) `?aba=cancelados` do PCP leva para Pedidos → Cancelados (a história inteira, pela `plt_fn_pedidos_lista`). A porta `plt_fn_pedidos_cancelados` (a da antiga aba, SESSAO-24) ficou viva no banco, sem tela, testada só pela bateria (2 conferências antigas).
- A demanda e o brief pedem a aba "Cancelados e removidos" **do PCP** sobre `plt_fn_pedidos_cancelados` → ver **P1**.
- Mudar o retorno da porta mantendo a assinatura quebraria a bateria (E-178: as migrations 20260927120000 e 20260928120000 a recriam na 2ª rodada com o retorno velho). Como a lista cresce sem fim, a Lei §6 pede cursor → assinatura nova `(text, integer, timestamptz, bigint)`; a de 3 argumentos sai no fim da migration; as duas conferências antigas da bateria passaram a chamar a nova (sem o deslocamento).

## Decisões técnicas

- `plt_fn_pcp_aviso(card)` — uma leitura ao abrir: pedido, aviso (o resumo da base), remoção (se houver, com quem), peças canceladas do pedido (pela `cancelada_pedido_id`, também as arquivadas; coluna/quem/quando pelo ÚLTIMO fato `fabricacao_cancelada` — a troca CANCELADO ↔ NÃO ENCONTRADO grava outro; até 100 + o total; `nova` = do aviso de agora), o que o pedido ainda tem (ajudante `plt_privado.fn_pcp_pecas_do_pedido`: em produção × pronta = a régua do fim de linha, onde = setor + etapa) e as vagas (`fn_vagas_pedido`: abertas = sem peça).
- Gestos (`plt_fn_pcp_aviso_resolver`, `plt_fn_pcp_remover`, `plt_fn_pcp_devolver`): pessoa conferida por dentro (`fn_usuario_atual` + `fn_pode_ver_expedicao` — a régua de liberar), card travado (`for update`), idempotentes (sem aviso / já removido / não removido = `feito: false`), fatos com a marca `plt.pcp_aviso_maquinaria` (guardada e devolvida — o molde da base), origem `interface`, autor = a pessoa.
- Remover: motivo ∈ {pedido_cancelado, fora_da_linha, outro}; texto obrigatório (≥ 3 letras) nos dois últimos; recusa arquivado e entregue; devolve `em_producao`, `prontas` e `onde` (a tela avisa); não toca peça, reserva nem Tiny.
- Devolver: devolve `fora_pelo_tiny` (o Tiny manda — D-132: cancelado/faturado… sai da lista de removidos mas não volta ao quadro) para a tela dizer a verdade.
- A aba (`plt_fn_pedidos_cancelados`, nova assinatura): removidos (índice `plt_cards_removido_pcp_idx` da base) + cancelados no Tiny e não removidos (pelo fato `pedido_cancelado`, índice `plt_eventos_tipo_idx`, vale o último fato do card), juntos por "saiu do PCP em" (desc) e card (desc) — cursor `(saiu_em, card_id)`; cada metade anda num laço pelo seu índice e para na página. Sem total (P7). Filtro = o dos quadros (`fn_filtro_do_quadro`: nº que começa com / nome do cliente que contém) — o nº e o nome raro pelos candidatos do próprio filtro (ver o ensaio). Sem acesso = vazia (como a de antes). *(A 1ª versão — uma consulta só, com o total — foi reprovada no ensaio ×100; ver abaixo.)*
- `no_estoque` da aba passou a contar só a peça sem dono que está NO ESTOQUE e não cancelada (a peça com a fabricação cancelada também perde o pedido e guarda o `card_pai_id` — contaria errado).

## Provisórias (o supervisor transforma em decisões)

- **P1 — a aba "Cancelados e removidos" volta para dentro do PCP** (`?aba=cancelados`, que desde 14/10 levava para Pedidos → Cancelados). Por quê: a demanda diz "a aba Cancelados do PCP vira 'Cancelados e removidos'" e "Devolver ao PCP" é gesto do PCP (o precedente é a aba Stand-by). Ela mostra os cancelados no Tiny que passaram pelo PCP (com o card vivo) e os removidos; a história inteira dos cancelados continua em Pedidos → Cancelados (a aba tem o atalho para lá).
- **P2 — a ordem da aba é "quando saiu do PCP"**, o mais recente primeiro (removido: a remoção; cancelado: o último cancelamento vindo do Tiny). Quem acabou de remover acha o pedido no topo.
- **P3 — remover não mexe nas peças reservadas do estoque** para o pedido (a demanda não fala; "só a parte do PCP muda"). Se o Tiny cancelar depois, o caminho de sempre as solta; devolvido, elas continuam reservadas.
- **P4 — o pedido cancelado no Tiny também pode ser removido do PCP** (não muda nada no Tiny; na aba aparece uma vez só). Devolvê-lo tira a marca de removido, mas o Tiny o mantém fora do quadro — a tela diz isso.
- **P5 — "Devolver ao PCP" não reabre o aviso**: o pedido volta a "Aguardando liberação" com as vagas abertas, e o PCP libera pela janela de sempre.
- **P6 — texto obrigatório = 3 letras ou mais** ("O que houve?" e "Outro motivo"), como o "Outro" do stand-by.
- **P7 — a aba "Cancelados e removidos" não mostra o total** (as outras abas do PCP mostram "(N)"): contar a história inteira dos cancelados custava ~175 ms no ensaio ×100 (Lei §6.4 — total só quando a tela precisa); a lista anda ao rolar, 20 por vez.
- **P8 — o filtro pelo nome, quando é raro, acha pelo nome do cliente como ele está gravado** (sem diferença de maiúscula, mas com acento: "jose" não acha "José" por esse caminho — o mesmo jeito da busca de Pedidos → Cancelados). Quando o nome é comum, a conferência é sem acento (a régua do filtro dos quadros). Por quê: o índice de trigramas é do nome gravado; conferir sem acento em todos custaria a varredura que o ensaio reprovou.

## Arquivos

- `supabase/migrations/20261111020000_plt_pcp_aviso_remover.sql` (novo): `plt_privado.fn_pcp_pecas_do_pedido`, `public.plt_fn_pcp_aviso`, `plt_fn_pcp_aviso_resolver`, `plt_fn_pcp_remover`, `plt_fn_pcp_devolver`, `plt_privado.fn_pedido_bate_filtro`, `public.plt_fn_pedidos_cancelados(text, integer, timestamptz, bigint)` (a de `(text, integer, integer)` sai). Nenhuma tabela, coluna ou índice novo (usa os da base e os que já existiam).
- `supabase/testes/testar-migrations.mjs`: bloco "SESSAO-48 · frente 2" (18 conferências, depois do da base), a migration na cadeia do bloco 38 e as 2 conferências antigas da aba Cancelados com a assinatura nova.
- `src/kanban/api.ts` (acréscimos no fim), `src/kanban/avisoPcp.ts` + teste, `src/kanban/componentes/ModalPecaCancelada.tsx` + teste, `src/kanban/componentes/AbaCanceladosRemovidos.tsx` + teste, `src/paginas/PCP.tsx`.
- Este diário.

## Telas

- `src/kanban/api.ts` (só acréscimos, no FIM do arquivo — os tipos da base vêm por `import('./tipos')` ali mesmo, sem mexer no import do topo, para a junção não brigar): `lerAvisoPcp`, `resolverAvisoPcp`, `removerDoPcp`, `devolverAoPcp`, `listarCanceladosRemovidos` e os tipos.
- `src/kanban/avisoPcp.ts` (novo, lógica pura): o texto do selo, os 3 motivos, a conferência do texto obrigatório (3 letras, como o banco), a frase das peças que seguem ("Este pedido ainda tem 1 peça em A LIMPAR. Para cancelar a fabricação dela, mova para CANCELADO." — a da demanda) e o dia/hora curto.
- `src/kanban/componentes/ModalPecaCancelada.tsx` (novo): a janela "O que aconteceu?" — lê ao abrir e esquece ao fechar (D-89; a chave mora debaixo de `['cards']`, então o aviso ao vivo do PCP relê a janela aberta). Topo: o estado do aviso (selo vermelho com ícone, "já resolvido" em verde ou "removido por X" neutro); as peças que saíram (ícone `Ban`/`SearchX` + "Cancelada/Não encontrada na coluna X · setor · por Y · quando", "já saiu da coluna (arquivada)", "antes deste aviso"); "O que o pedido ainda tem" (em produção e onde, prontas e onde, vagas para liberar N de M). Saídas: "Produzir de novo" (primária, só com o aviso aberto) e "Remover do PCP" (secundária) → o passo do motivo no desenho da casa (botões grandes `aria-pressed`, borda `acao-ativa` + `acao/15`), "Cancele também no Tiny." no primeiro, o campo obrigatório nos outros dois (conferência nossa em português — sem o balão do navegador), o aviso âmbar das peças que seguem, "Voltar" e "Remover do PCP". Pedido já removido: só a informação (quem, quando, motivo) e o caminho da aba.
- `src/kanban/componentes/AbaCanceladosRemovidos.tsx` (novo): a aba — filtro dos quadros do PCP (o mesmo `?filtro=`), total na 1ª página, cada linha com "Removido do PCP" (`PackageX`, âmbar) e/ou "Cancelado no Tiny" (`Ban`, vermelho), o motivo + texto, "Removido por X em dd/mm hh:mm" / "Cancelado no Tiny em …", as peças que seguem (em produção · prontas · no estoque sem dono · esperando a decisão da logística), "Abrir o card" e "Devolver ao PCP" (só quando volta de verdade). Rolagem pede a próxima página (cursor). No pé, o atalho para Pedidos → Cancelados (a história inteira).
- `src/paginas/PCP.tsx`: a aba nova (`?aba=cancelados`, pedaço próprio `lazy`, como o Lançamento manual — o `?aba=cancelados` não leva mais para Pedidos → Cancelados); o selo `SeloPecaCancelada` (botão `toque-seguro` — 44 px de alvo sem mudar o desenho; ícone + texto; vermelho `danificado-*`) no card do pedido em "Aguardando liberação" E no card em Stand-by (o pedido segurado também pode ter peça cancelada); `?aviso=<card do pedido>` (o caminho do sino) e o toque no selo abrem a janela (`lazy`, `Suspense` sem esqueleto); fechar tira o `?aviso=`.

## Diário

- Migration escrita; bloco da bateria escrito (`node --check` ok).
- **Bateria 1:** 1678 ✔, 2 ✘ — o vermelho antigo ("Dashboard: as 7 portas novas = as antigas") e um meu: esperei "removido do PCP" na lista de Pedidos para o 97521, mas a regra da base mostra "Em produção" antes de "Removido do PCP" quando o pedido já tem peça liberada (a ordem do `case` em `plt_fn_pedidos_lista`). Correção: a conferência foi para o 97522 (nada liberado). **Observação para o supervisor:** nessa contagem de "liberadas" da lista de Pedidos entram também as peças canceladas (elas guardam o `card_pai_id`) — o pedido com todas as peças canceladas e removido do PCP aparece como "Em produção" na lista de Pedidos.
- Junto: `pode_devolver` passou a ser "removido E o Tiny não o mantém fora" (o botão só aparece quando o pedido volta de verdade); a porta de devolver segue aceitando (inofensiva) e diz `fora_pelo_tiny`.
- **Bateria 2:** 1679 ✔, 1 ✘ (só o antigo). As 17 conferências do bloco da frente 2 verdes; as 2 antigas da aba Cancelados (S24 e D-63) verdes com a assinatura nova.
- Commit do banco (`46dda6c`).
- Telas escritas; `tsc -b` limpo; `eslint` dos 5 arquivos limpo.
- **Tropeço (lição): `vitest run --root "<cópia>" --dir src` roda os testes da PASTA PRINCIPAL** — o `--dir` relativo é resolvido contra a pasta de trabalho do processo (a do dono), não contra o `--root` (`vitest list` mostrou `../../…/Domoby - fabrica/src/...`). Com os arquivos novos só na cópia, deu "No test files found" (nada rodou de errado). Correção: `--dir "<cópia>/src"` (caminho absoluto) — aí lista 86 arquivos da cópia. Vale para o brief comum das outras frentes.
- Testes novos: `src/kanban/avisoPcp.test.ts` (6), `ModalPecaCancelada.test.tsx` (7), `AbaCanceladosRemovidos.test.tsx` (4) — 18 verdes.
- **Suíte inteira:** sem `.env.local` na cópia, 9 arquivos que importam o cliente de verdade caem ao carregar (ambiente, não código); com as variáveis de mentira do build (`VITE_SUPABASE_URL=https://teste.invalid VITE_SUPABASE_ANON_KEY=chave-de-teste-sem-valor`): **86 arquivos / 563 testes verdes**.
- **Montagem:** `JS inicial: 231.4 KB comprimidos em 8 arquivos (teto 250 KB)`; pedaços novos: `ModalPecaCancelada` 3,24 KB gz, `AbaCanceladosRemovidos` 2,33 KB gz; o pedaço do PCP (`ProducaoSetor`) 16,65 KB gz.
- Commit das telas (`18c7f3d`).

### Ensaio ×100 (PGlite, rascunho fora do repositório — `ensaio.mjs` na pasta de rascunho da frente)

Volume: 560 mil pedidos (3% cancelados = 17 mil), 200 mil cards de pedido, 3 mil removidos do PCP, 6.666 fatos `pedido_cancelado` (10% cancelados duas vezes), 200 mil peças, 1,41 milhão de fatos; `analyze`; medição da 1ª, da 2ª e mediana da 6ª à 10ª chamada na mesma conexão (A-209).

**1ª versão (a da bateria 2):** janela 3,3 ms; "Produzir de novo" 16 ms, "Remover" 5 ms, "Devolver" 4 ms; páginas seguintes por cursor ~2 ms — mas **a 1ª página 186 ms** e **os filtros 130–360 ms** (fora do teto de 50 ms). O plano: o planejador partia de TODOS os pedidos cancelados (o índice parcial `pedidos_cancelados_numero_idx`, 17 mil) → card → fato, e só no fim ordenava (estimava 16 linhas; vieram 6.060); e o **total** (contar todos os cancelados com card vivo) custava sozinho ~175 ms.

**Correção (a porta da aba refeita):**
- **sem o total** (Lei §6.4 — a tela não precisa; a lista anda ao rolar) → **P7**;
- cada metade anda pelo SEU índice, na ordem, num laço que para quando enche a página (removidos: `plt_cards_removido_pcp_idx`; cancelados: `plt_eventos_tipo_idx`, cada fato conferido na hora — card vivo, pedido ainda cancelado, último fato do card);
- com filtro, cada metade lê no máximo 150 linhas; se não encheu (filtro raro), os candidatos vêm do próprio filtro — o nº pelas faixas do índice do número (como a lista de Pedidos), o nome pelos trigramas de `clientes.nome` (`clientes_nome_trgm_idx`, 3 letras ou mais; conferido também sem acento). Ajudante novo `plt_privado.fn_pedido_bate_filtro` (fora da API).
- Na tela: o cabeçalho da aba sem o "(N)".

**2ª e 3ª voltas do ensaio (o caminho do filtro):** com o laço na ordem, a página caiu para ~5 ms e o nome para 9–28 ms, mas o **nº levava 1,1 a 4 s**: o planejador não sabe quantos números as faixas `[x·10^k, (x+1)·10^k)` trazem (estimou 435 mil; vieram 111) e juntava TODOS os 200 mil cards de pedido por hash — e o `lateral` não segurou (consulta simples é "achatada" de volta). Correção: os pedidos candidatos numa LISTA primeiro (uma consulta) e os cards deles por `pedido_id = any(lista)` (só pode ir pelo índice). E o **nº vai sempre direto aos candidatos** (sem o laço): com 4 dígitos ou mais, todos os pedidos das faixas; com 2–3 dígitos (muitos números — 11 mil no ×100), só os cancelados das faixas pelo índice parcial `pedidos_cancelados_numero_idx` e os removidos do PCP. O nome (3 letras ou mais) tenta antes o laço (até 150 por metade) e, raro, vai aos trigramas do cliente. Nº com mais de 9 dígitos: lista vazia na hora.

**Resultado final (×100, PGlite; mediana da 6ª à 10ª chamada — a 1ª entre parênteses):**

| Porta / caso | ms |
|---|---|
| Aba, 1ª página (20) | 4,2 (16) |
| Aba, 2ª página pelo cursor | 4,0 |
| Aba, página do fundo | 2,5 |
| Filtro nº inteiro (559944) | 2,3 |
| Filtro nº com 4 dígitos (5590…) | 1,8 |
| Filtro nº com 2 dígitos (55…) | 18,8 |
| Filtro nome raro (cliente 4321) | 10,6 |
| Filtro nome comum (cliente 1) | 11,1 |
| Filtro nº que não existe | 0,7 |
| Filtro nome que não existe | 7,5 |
| Janela "O que aconteceu?" (30 peças canceladas) | 2,8 (11,6) |
| "Produzir de novo" · "Remover do PCP" · "Devolver ao PCP" (uma vez) | 14,1 · 5,1 · 3,9 |

Planos (fora da função, valores literais): o laço dos cancelados = `Index Scan Backward using plt_eventos_tipo_idx` + `Incremental Sort` (0,12 ms para 30); o laço dos removidos = `Bitmap Index Scan on plt_cards_removido_pcp_idx` + top-N (3,4 ms para os 3 mil removidos — cresce com os removidos, não com a história); os cards dos 111 candidatos do nº = `Index Scan using plt_cards_pedido_unico` (`= any`) + `pedidos_pkey` (0,8 ms); os candidatos do nome = `Bitmap Index Scan on clientes_nome_trgm_idx` + `pedidos_cliente_idx` (4,1 ms). Nenhuma varredura de tabela que cresce.

- **Bateria 3** (com a 1ª volta da refeita): 1679 ✔, 2 ✘ — o antigo do Dashboard e um da SESSAO-33 ("o lote do banco → o código do fluxo monta a chamada…"), que **depende do relógio**: das 03:10 às 04:40 (Fortaleza) a conta da fábrica fica fora do lote do Tiny (`fn_tiny_fabrica_em_varredura`) e a linha v2 do teste fica "pendente". Passou nas baterias 1 e 2 (antes das 03:10). Não é desta frente.
- **Bateria 4** (a versão final): 1679 ✔, os mesmos 2 ✘ (Dashboard antigo + SESSAO-33 da madrugada). As **18** conferências da frente 2 verdes (+1: o filtro raro com 155 removidos mais novos).
- Suíte inteira de novo: **86 arquivos / 563 testes verdes**; montagem: `JS inicial: 231.4 KB` (teto 250); `ModalPecaCancelada` 3,24 KB gz, `AbaCanceladosRemovidos` 2,30 KB gz, `ProducaoSetor` 16,73 KB gz.
- Commit da refeita (`3457e82`).
- **Bateria 5** (a versão final, 2ª vez): 1679 ✔, os mesmos 2 ✘ de fora desta frente (Dashboard antigo; SESSAO-33 na janela da madrugada). As 18 da frente 2 verdes.

## Os critérios da demanda (frente 2)

- [x] **Peça de pedido vivo cancelada: a vaga volta ao PCP na hora, o pedido ganha o selo e o sino avisa o PCP.** A vaga, o aviso e o sino são da base (bateria da base); o **selo** é desta frente: `SeloPecaCancelada` no card do pedido (Aguardando liberação e Stand-by), lido de `pedido_resumo.aviso_cancelada` (sem requisição a mais), vermelho com ícone + texto ("Peça cancelada na produção" / "Peça não encontrada" / "N peças …"), botão com alvo de 44 px; texto testado (`avisoPcp.test.ts`).
- [x] **A janela mostra o que aconteceu e oferece "Produzir de novo" e "Remover do PCP" com os três motivos (dois com texto obrigatório).** `plt_fn_pcp_aviso` (bateria: o pedido, o aviso, cada peça com coluna/motivo/quem/quando, o que ainda está em produção e pronto, as vagas; só PCP/logística/admin) + `ModalPecaCancelada` (7 testes). O texto obrigatório é conferido na tela E no banco (bateria: os 3 recusados).
- [x] **Pedido removido sai de todas as portas do PCP, aparece em "Cancelados e removidos" com o motivo, e "Devolver ao PCP" funciona.** Bateria: fora do quadro, da porta antiga e do quadrinho (painel = quadro); na aba com o motivo, o texto, quem e quando; devolvido volta às três portas e sai da lista; tocar duas vezes = um efeito. Tela: `AbaCanceladosRemovidos` (4 testes).
- [x] **Remover não mexe no Tiny nem nas peças já em produção ou prontas (a janela avisa quantas são).** Bateria: as peças (pedido, setor, etapa, fatos) idênticas antes e depois, a fila do Tiny e a situação do pedido iguais; a porta devolve quantas e onde, e a janela diz "Este pedido ainda tem 1 peça em A LIMPAR. Para cancelar a fabricação dela, mova para CANCELADO." (teste).
- Geral: tsc e eslint limpos; vitest 563; montagem 231,4 KB; bateria 2× na versão final (as baterias 4 e 5); ensaio ×100 das 5 portas novas (tabela acima). **Não conferido aqui:** as fotos e a largura de 375/768 no navegador (o supervisor tira) e os advisors (sem acesso ao banco).

## O que fica para o supervisor (na junção e depois)

1. **Arquivos compartilhados que toquei:** `src/kanban/api.ts` (só acréscimos no FIM; os tipos da base por `import('./tipos')` ali, sem mexer no import do topo); `supabase/testes/testar-migrations.mjs` — (a) o bloco "SESSAO-48 · frente 2" logo depois do da base, (b) a migration na cadeia do bloco 38 logo depois da base (as outras frentes vão pôr a delas no mesmo lugar — é só encadear), (c) as 2 conferências antigas da aba Cancelados (S24 ~linha 5150 e D-63 ~linha 6748) chamando a porta sem o deslocamento; `src/paginas/PCP.tsx` (desta frente).
2. **Modelo de Sistema** ainda diz "PCP em `<Abas>`: 'Aguardando liberação' · 'Cancelados' (`?aba=cancelados`)" — atualizar para "Cancelados e removidos" (P1) e registrar o selo e a janela.
3. **Lista de Pedidos (porta da base):** o pedido removido do PCP que já tem peça liberada aparece como "Em produção" (o `case` testa "produção" antes de "removido"), e a conta de "liberadas" ali soma as peças com a fabricação cancelada (elas guardam o `card_pai_id`). Sugestão: pôr "Removido do PCP" antes de "Em produção", ou contar as liberadas sem as canceladas.
4. **Busca geral (porta da base + `src/busca/ondeEsta.ts`):** o pedido removido aparece como "PCP · aguardando liberação" e oferece o atalho para o quadro do PCP, onde ele não está. Sugestão: a porta manda `removido_pcp` só quando há (E-237) e a pílula diz "Removido do PCP", com o atalho para `?aba=cancelados`.
5. **Frente 3:** a metade "cancelados no Tiny" da aba anda pelo fato `pedido_cancelado` do card do pedido — se a reação ao Tiny mudar e deixar de gravar esse fato, a aba deixa de listar o cancelado.
6. `plt_fn_pcp_liberar` não recusa pedido removido (igual ao cancelado no Tiny hoje — só por API ou tela velha); a programação de rota de um pedido removido continua (D-156 deixa rota para pedido ainda no PCP) — a demanda não pede trava.
7. **Tropeço do brief comum:** `vitest run --root "<cópia>" --dir src` roda a pasta PRINCIPAL (o `--dir` relativo é da pasta de trabalho do processo). Usar `--dir "<cópia>/src"`. E a cópia não tem `.env.local`: a suíte inteira precisa das variáveis de mentira do build.
8. **Vermelho da madrugada:** o teste da SESSAO-33 do lote do Tiny falha das 03:10 às 04:40 (a janela da fábrica) — vale avisar quem rodar a bateria nesse horário.
