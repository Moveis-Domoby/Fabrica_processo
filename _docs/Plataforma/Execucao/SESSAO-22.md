---
titulo: "Execução — SESSAO-22 · Produção: filas reais, tempo de PCP e paginação"
tipo: memoria-execucao
data: 2026-09-21
atualizado: 2026-09-21
tags: [plataforma, execucao, sessao-22, bloco-5]
---

# 🔧 Execução — SESSAO-22

**Branch:** `sessao-22-filas-tempo-paginacao` (criada de `main` em 21/09, topo `f7841b2`).
**Demanda:** [[SESSAO-22 - Producao - Filas Reais Tempo de PCP e Paginacao]] · Plano: [[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]]

## Respostas do dono (21/09 — o OK do checkpoint)

1. **Etapas fila:** todos os setores de produção já têm a sua fila cadastrada — nenhum sem.
2. **Tempo em PCP é do PEDIDO:** pedido com N produtos — cada produto tem seu tempo de produção próprio; o pedido **só para de contar tempo em PCP quando for liberado por completo** (todas as unidades). Depois, em **Pedidos em aguardo**, o pedido conta **tempo de aguardo total** (insumo futuro do cálculo de tempo de entrega). Todos esses tempos ficam salvos no banco (derivados de eventos — M-02).
3. **Pausa:** a pessoa pausada **retoma sozinha**, mas só **quando finalizar o produto que o líder passou na frente**.
4. **Limite 1 em todos os setores**, editável nas configurações do setor — permissão de **líderes e admins**.
5. **Retomar com a urgência ainda aberta é recusado** — tem que concluir a urgência antes de pegar outro (a trava do limite vale para retomar).

## Task list (espelho da demanda — conferida item a item em 21/09)

- [x] 1a. Banco: evento de chegada em setor de produção sem etapa → resolve para a **etapa fila** (trigger BEFORE `fn_resolver_etapa_fila` preenche `etapa_destino_id` — o evento nasce completo)
- [x] 1b. Front: coluna "Chegada" some dos setores de **produção** com fila (fica em PCP/terminais; produção sem fila ou com card órfão → coluna + aviso); ModalMoverCard/ModalLiberarPedido/Danificados defaultam para a fila e escondem "Chegada" nesses destinos
- [x] 1c. Migração dos cards vivos → `supabase/manutencao/2026-09-21_migrar_cards_chegada_para_fila.sql` (evento em lote origem `api`; passos contar/executar/conferir; **testado no test:banco** — contagem real de produção sai na aplicação, F-08)
- [x] 2a. Banco: `plt_cards.liberado_completo_em` (projeção por `fn_recalcular_liberacao`, regra k/n idêntica ao kanban; recompute retroativo na migration); `plt_vw_permanencias` fecha o PCP do pedido nesse instante; `plt_fn_pedidos_kanban` expõe `entrou_pcp_em`/`liberado_completo_em` (DROP+CREATE, E-17)
- [x] 2b. Front: card de unidade mostra "Pedido ficou X em PCP" (com "ainda contando" no parcial); ModalLinhaTempo tem o bloco "Pedido no PCP: X"
- [x] 2c. Pedidos em aguardo: "Completo há X aguardando o lançamento" / "1ª unidade pronta há X" (`primeira_pronta_em`/`completo_em` na RPC — drop na migration 25 espelhado, E-17)
- [x] 3a. Paginação no servidor por coluna: `useColunasPaginadas` (useQueries por página, `count: 'exact'` + `range`, 10/página, "Ver mais" por coluna, contador = total real)
- [x] 3b. PCP paginado: pedidos abertos filtrados no SERVIDOR (`liberado_completo_em is null` + índice parcial) + "Ver mais"; quadro de unidades do PCP nas mesmas colunas paginadas
- [x] 3c. Regra promovida: regra 17 no CLAUDE do repo E na cópia do cofre; seção "Lei de requisição" no Modelo de Sistema; RNF-07 nos Requisitos
- [x] 4a. Default 1 na migration + `manutencao/2026-09-21_limite_execucoes_padrao_1.sql` (existentes); RPC `plt_fn_definir_limite_execucoes` (líder do setor/admin, trilha D-40); Estrutura abre a seção ao líder
- [x] 4b. `execucao_pausada`/`execucao_retomada` no check (valida tudo no fim; `validate` da migration 25 removido — E-19); `fn_validar_execucao` (pausa só líder/admin em execução aberta; referências preenchidas); projeção `pausado_em`
- [x] 4c. Limite ignora pausados (iniciar E retomar); retomar recusado com urgência aberta ("Finalize a urgência antes…" — resposta 5); `plt_vw_execucoes` + 6 portas de dashboard descontam pausas
- [x] 4d. UI: Pausar/Retomar no quadro; Retomar com PIN no tablet; pausado = `Pause` + "Pausado há X" (M-12); linha do tempo mostra pausa/retomada com autor e "Xmin de pausa descontados"
- [x] 5. D-48 registrada; item 2 da demanda atualizado com a resposta do dono; Q-17 revisada via D-48
- [x] 6a. test:banco 2× TUDO VERDE (re-rodado após o espelho ganhar `produtos` de outra frente) · tsc · lint · vitest **49/49** (2 testes novos de pausa) · build ✅ · mojibake zero (E-34)
- [ ] 6b. ⏸️ **F-08**: aplicar migration 29 + 2 manutenções SÓ com aprovação do dono nesta conversa (md5 antes/depois + advisors depois)
- [ ] 6c. F-07 completo (375/768px nas telas de dados) — **depende da migration aplicada**: o front novo lê colunas que ainda não existem em produção; login verificado (console limpo). Alvos ≥44px garantidos por construção (`min-h-toque-md`/`galpao`)
- [x] 6d. Handoff + notas do cofre (Requisitos RF-15/16 + RNF-07; Memória A-16/A-17 + E-19↪️; Modelo de Sistema; índice/mapa/próximos passos)

## Decisões técnicas tomadas

- **DT-1 (etapa fila na escrita):** trigger BEFORE em `plt_eventos` preenche `etapa_destino_id` com a etapa `eh_fila` quando o destino é setor de **produção** e a etapa veio nula — o evento nasce completo; views e projeção ficam coerentes sem retrabalho. PCP e terminais seguem aceitando etapa nula.
- **DT-2 (tempo PCP):** nova projeção `plt_cards.liberado_completo_em` (só card de pedido), escrita por trigger quando a contagem de unidades liberadas alcança o total (mesma regra k/n de `plt_fn_pedido_itens_kanban`, que lê `pedido_itens` como definer). Serve dois usos: fim do tempo em PCP e filtro de "pedidos abertos" no servidor (paginação do PCP).
- **DT-3 (paginação):** consultas por etapa com `limite/deslocamento` (infinite query, 10/página) + RPC de contagem por etapa; o quadro nunca baixa o setor inteiro.
- **DT-4 (pausa):** `evento_referencia_id` da pausa aponta o `execucao_iniciada` aberto; retomada aponta a pausa. `plt_vw_execucoes` recriada descontando os intervalos pausados da `duracao`.
- **DT-5 (lotes/manutenção):** migração dos vivos e limite 1 nos setores existentes vão em `supabase/manutencao/` (padrão S15), testados no `test:banco` antes; o default novo da coluna vai na migration (setor novo nasce com 1).

## Diário (computar TUDO enquanto executa)

- 21/09 · Leituras obrigatórias completas; checkpoint (a)(b)(c) apresentado; dono respondeu as 5 dúvidas (acima) — OK para executar.
- 21/09 · Branch criada. Working tree tinha 2 arquivos soltos de outra frente (`N8N - Tiny Fabrica - Estudo do Cadastro.md`, `PROMPT - Bloco 5`) — não tocar; commits por caminho explícito (E-23).
- 21/09 · **D-48 registrada** em PLT - Decisoes de Produto; demanda (item 2 + status) e índice atualizados. O índice ganhou fora desta sessão a promoção da SESSAO-21 para "pronta para code" (rodará logo após o handoff da S22 — anotado, nada a fazer aqui).
- 21/09 · **Migration 29** (`20260921120000_plt_filas_tempo_pausa_paginacao.sql`): check com `execucao_pausada`/`execucao_retomada` (valida tudo no fim — E-19); trigger `fn_resolver_etapa_fila` (BEFORE, nome ordenado antes dos `validar_*`); colunas `plt_cards.pausado_em` e `liberado_completo_em` + índice parcial do PCP; `fn_recalcular_liberacao` (regra k/n idêntica à do kanban); `fn_projetar_posicao` e `fn_validar_execucao` recriadas (pausa/retomada, limite ignora pausados, retomada revalida o limite para o EXECUTOR, referências preenchidas pelo trigger); helper `fn_pausas_execucao` (INVOKER, como `fn_evento_estornado`); `plt_vw_execucoes` DROP+CREATE com `pausa_total`/`pausado_desde` e `duracao` descontada; `plt_vw_permanencias` fecha o PCP do card de pedido em `liberado_completo_em`; 6 portas recriadas com desconto de pausa (`dash_execucoes/tempos_setor/tempos_pessoa/tempos_item/metas_painel/tendencia_semanas`); `plt_fn_pedidos_kanban` (+`entrou_pcp_em`, `liberado_completo_em`) e `plt_fn_pedidos_aguardo` (+`primeira_pronta_em`, `completo_em`) DROP+CREATE; RPC nova `plt_fn_definir_limite_execucoes` (líder do setor/admin, com trilha D-40); default do limite = 1; recompute retroativo da liberação completa.
- 21/09 · **Edições-espelho na migration 25** (E-17/E-19): `drop function` antes do create de `plt_fn_pedidos_aguardo` e o `validate constraint` final REMOVIDO (mudou de casa para a 29 — reaplicar a 25 num banco com eventos de pausa quebraria).
- 21/09 · **Manutenção** (2 arquivos, padrão S15): `2026-09-21_migrar_cards_chegada_para_fila.sql` (evento em lote origem `api`, só produção COM fila; passos contar/executar/conferir) e `2026-09-21_limite_execucoes_padrao_1.sql` (null→1 nos existentes; fora da migration de propósito — reaplicação não pode sobrescrever escolha do admin).
- 21/09 · **test:banco**: bloco S22 novo no harness (limite padrão + manutenção rodada de verdade; resolver de fila com evento completo; PCP parcial vs completo + retroativo; lote chegada→fila com setor sem fila; pausa com prova aritmética 90−70=20min na view E na porta de dashboard; RPC do limite com gate e log; aguardo). 1º erro meu: usei pedido 999998, que o harness já ocupava → troquei para 999990. **TUDO VERDE em 2 rodadas.**
- 21/09 · **Front** (commit `6de4518`): `useColunasPaginadas` novo (useQueries por página + keepPreviousData); `QuadroKanban` refeito para colunas paginadas (prop `colunas: Map<chave, ColunaPaginada>`; chegada condicional + 2 avisos); `QuadroSetor`/`PCP` migrados (PCP filtra abertos no servidor); pausar/retomar em `api.ts` + `CartaoUnidade` + `CartaoTablet`/`TelaSetor` (PIN, ação `retomar`); tempo em PCP no card e na linha do tempo (`linha-tempo.ts` ganha `pausaMs`/`pausada` com desconto); `Estrutura` usa a RPC do limite e abre a seção ao líder; `PedidosAguardo` mostra o relógio do aguardo; `Danificados`/modais defaultam fila. Chaves de cache: quadro paginado usa `['cards','etapa',setor,tipo,coluna,pagina]` — a `TelaSetor` mantém `['cards','setor',id]` com o MESMO fetcher de sempre (E-22 respeitado; invalidação por prefixo `['cards']` cobre os dois).
- 21/09 · Verificações: tsc ✅ · lint ✅ · vitest 49/49 ✅ (2 testes novos de pausa espelhando o banco) · build ✅ (bundle 1,73MB, DT-ARQ9 sem mudança) · `grep` de mojibake zero (E-34) · test:banco re-rodado ✅ depois de outra frente acrescentar `produtos` ao espelho do schema (estudo da S25 — não conflita).
- 21/09 · **Trabalho paralelo no working tree** (não tocado, E-23): `_docs/CLAUDE.md`, notas N8N do Tiny fábrica, demanda da S21, `SUPA - Esquema do Banco` + `.sql` (tabela `produtos`), `000 - PROXIMOS PASSOS`, pasta `Claude outputs/`. Os commits desta sessão foram sempre por caminho explícito.
- 21/09 · **Pendências para o F-08 (aprovação do dono):** aplicar migration 29 (md5 antes/depois + advisors) → rodar `manutencao/2026-09-21_limite_execucoes_padrao_1.sql` → rodar `manutencao/2026-09-21_migrar_cards_chegada_para_fila.sql` (registrar contagens do passo 1/3 AQUI) → F-07 completo nas telas com dado real.
