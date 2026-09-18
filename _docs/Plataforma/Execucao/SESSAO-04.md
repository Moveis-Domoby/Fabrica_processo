# Memória de execução — SESSAO-04 · Kanban Núcleo

> Computar TUDO enquanto executa (regra 8). Branch: `sessao-04-kanban-nucleo`.
> Demanda: `_docs/Plataforma/Demandas/SESSAO-04 - Kanban Nucleo.md` (lida 2x em 27/08/2026).

## Respostas do dono no início da sessão (27/08/2026)

1. **Q-21 (sub-cards de trabalho paralelo):** fica para depois — fora do escopo.
2. **Card de pedido manual = escolher pedido REAL da integração** (todos vêm do Tiny → n8n → banco). Não existe pedido avulso.
3. **Liberação parcial OU completa** — ambas permitidas. PCP trabalha no computador, também é a logística e possivelmente serão admins no futuro; a tela deles pode ser mais completa, até no tablet.
4. **Card de pedido após liberar tudo:** sai do quadro PCP; pedido passa a ser acompanhado na visão de expedição.
5. **Movimentação:** todos podem mover o card que está com eles (no setor deles) para QUALQUER setor. A confirmação de entrada com índice de qualidade é da SESSAO-06 — não construir agora.
6. **Cadastro de etapas:** admin (qualquer setor) E líder (do próprio setor) — mantém o RLS da SESSAO-02.

Decisões técnicas validadas no checkpoint (sem objeção do dono):
- Migration única: leitura enxuta de `pedidos`/`pedido_itens` para o front (sem expor endereço/CPF/fone do cliente), SEM tocar na estrutura das tabelas da integração. Aplicar no banco SÓ com aprovação explícita na hora.
- `@dnd-kit` para drag-and-drop (leve); botão "Mover para…" independente dele.
- Card em setor sem etapa → coluna fixa "Chegada" (só apresentação).
- TanStack Query com refetch periódico + ao focar (sem realtime por ora).
- Telas: `/pcp`, `/setor/:id`, `/expedicao`, gestão de setores/etapas em `/administracao`.

## Task list (espelho da demanda)

- [x] T1 · Branch `sessao-04-kanban-nucleo` criada
- [x] T2 · Cofre atualizado: D-22 (respostas de hoje), ORDEM → 🔨, demanda anotada, Q-21 adiada
- [x] T3 · Migration 13: leitura de pedidos/itens para o kanban (funções security definer, fora do alcance de anon) + testes `test:banco`
- [x] T4 · Quadro PCP: card por pedido (criado manualmente a partir de pedido do Tiny sem card), com itens
- [x] T5 · Liberação: pedido → cards de unidade (k/n), parcial ou completa, destino por unidade, unidades do mesmo pedido podem ir para setores diferentes
- [x] T6 · Quadros de setor: etapas internas como colunas + coluna "Chegada", cards de unidade
- [x] T7 · Movimentação: drag-and-drop (desktop) E botão "Mover para…" (tablet) — grava evento append-only com autor, origem, destino, timestamp
- [x] T8 · Card de unidade mostra: pedido de origem, produto, (k/n), etapa atual, tempo na etapa (contador simples)
- [x] T9 · Visão de expedição: por pedido, unidades chegadas vs total — pedido completo/incompleto evidente
- [x] T10 · Gestão de setores e etapas (/estrutura): criar/renomear/ordenar/desativar (nunca apagar); admin + líder do setor
- [x] T11 · Verificação: critérios de aceite um a um + F-07 (tsc, lint, testes, viewport celular E tablet) + screenshots
- [x] T12 · Handoff em `_docs/Handoffs/` + memória de aprendizado (aguardando só o OK final do dono para o merge)

## Critérios de aceite (da demanda)

- [x] Pedido com 3 itens liberado no PCP gera 3 cards de unidade nas etapas escolhidas. (13192 → SECC, CNC, FITAMENTO)
- [x] Mover card grava evento com autor, origem, destino e timestamp. (11 eventos conferidos por SQL)
- [x] Visão de expedição mostra 2 de 3 unidades chegadas → pedido incompleto. (exatamente "2 de 3 no fim de linha")
- [x] Funciona em tablet (botão "mover para…") e desktop (drag-and-drop). (testado nos dois + viewports F-07)
- [ ] Revisão do dono (PR dispensado — D-20) + handoff. (handoff pronto; merge aguarda OK)

## Diário de execução

- [27/08] Branch criada. Task list montada.
- [27/08] Cofre atualizado: D-22 registrada, ORDEM → 🔨, demanda anotada com as respostas, Q-21 ⏸️ (T2 ✔).
- [27/08] Migration 13 (`20260827120000_plt_leitura_pedidos_kanban.sql`): 4 funções RPC em `public`
  (`plt_fn_pedidos_kanban`, `plt_fn_pedido_itens_kanban`, `plt_fn_expedicao_kanban`, `plt_fn_pedido_unidades`)
  + helper `plt_privado.fn_pode_ver_expedicao`. E-11 aplicada: security definer + search_path fixo,
  revoke de public/anon, grant só authenticated, gate por usuário ativo DENTRO da função.
  Sem dado pessoal/financeiro do cliente. `unidades_liberadas` no resumo porque o RLS esconde do PCP
  as unidades que já viajaram. **Semântica (k/n) confirmada no código real do n8n (A-01): POR ITEM —
  n = quantidade arredondada do item, k = 1..n; quantidade < 1 não vira card.** Testes: 10 verificações
  novas no `testar-migrations.mjs`, tudo verde (13 migrations × 2 rodadas). ⚠️ NÃO aplicada no banco — aguarda aprovação (T3 ✔ no código).
- [27/08] Front (T4–T10): módulo `src/kanban/` (tipos, tempo, api) + componentes
  (`CartaoUnidade`, `QuadroKanban` com @dnd-kit/core, `ModalMoverCard`, `ModalNovoPedido`,
  `ModalLiberarPedido`, `usePedidosDosCards`) + páginas `/pcp`, `/setores/:id`, `/expedicao`,
  `/estrutura` + navegação por papel no Layout/Início + link na Administração.
  Decisões técnicas dentro do código:
  · mover card = INSERT em `plt_eventos`; posição vem da trigger — nenhum UPDATE de posição no front;
  · liberação = card unidade nasce no PCP (card_criado) + movimentacao_setor PCP→destino, na mesma ação
    — assim o RLS aceita (quem insere card precisa do setor DELE) e o evento conta a história verdadeira;
  · pedido 100% liberado é filtrado do quadro PCP (D-22);
  · coluna fixa "Chegada" para etapa nula (D-14: setores nascem sem etapas);
  · Radix Select não aceita valor vazio → sentinela 'chegada';
  · lint react-hooks/set-state-in-effect: reset de modal = ajuste de estado DURANTE o render
    (padrão da doc do React), e linhas da liberação = derivadas com useMemo + mapa de ajustes do usuário.
- [27/08] E-15 anotado na memória de aprendizado (escape \uXXXX decodificado pelo harness ao gravar arquivo).
- [27/08] Verificação: `tsc` limpo · `lint` limpo · `npm test` 8/8 · `test:banco` verde ·
  `npm run build` ok (chunk 740kB — aviso de tamanho, candidato a code-split futuro) ·
  dev server em :5181 (5180 ocupado por outra sessão — config `plataforma-dev-b` adicionada ao launch.json) ·
  `/entrar` renderiza sem erro de console. Fluxos logados dependem da migration aplicada + senha (gesto do dono).
- [27/08] ⏸️ CHECKPOINT: pedida aprovação para aplicar a migration 13 no banco (F-08).
- [27/08] ✅ Dono aprovou. Migration 13 APLICADA em produção (`banco:aplicar -- --confirmar`):
  impressão digital idêntica (9a61b60d...) e contagens intactas (133/133/218/535/1).
  `get_advisors`: 4 WARN nas plt_fn_* = desenho intencional (endpoints de propósito, gate interno);
  5 INFO das tabelas da integração = padrão da casa pré-existente; 1 WARN de leaked password
  protection (auth) pré-existente, anotado como pendência. `.sql` espelho + nota SUPA atualizados.
- [27/08] TESTES NO NAVEGADOR (dono logado como Wallace/admin, dev :5181):
  · card do pedido 13192 (3 itens/3 unidades reais do Tiny) criado no PCP — busca + lista paginada ok;
  · etapa "EM CORTE (TESTE)" criada na SECC via /estrutura (notificação da D-14 correta);
  · liberação: 3 unidades → SECC/EM CORTE (TESTE), CNC, FITAMENTO — pedido saiu do quadro (D-22);
  · eventos conferidos por SQL: autor MDM-084-001, origem/destino/etapa/timestamp, via 'interface';
  · drag-and-drop desktop nos dois sentidos ✔; botão "Mover": CNC→ESTOQUE ✔, FITAMENTO→ROTAS ✔;
  · 🐞 E-16 achado e corrigido no meio do teste (etapa_destino_id: 0 — ver memória de aprendizado);
  · Expedição: "2 de 3 no fim de linha" + detalhe por unidade — critério de aceite exato;
  · banco final: 11 eventos, 2 unidades com concluido_em pela trigger do terminal;
  · F-07: mobile 375px e tablet 768px sem rolagem horizontal e sem alvo <44px; desktop restaurado;
  · tsc/lint/test 8-8/test:banco verdes após a correção.
- [27/08] Estado que ficou no banco (permanente por desenho): card 13192 + 3 unidades
  (SECC em produção, ESTOQUE e ROTAS concluídas), etapa "EM CORTE (TESTE)" na SECC (desativável),
  11 eventos append-only.
- [27/08] ⚠️ Quase-E: editar este arquivo com `Get-Content`/`Set-Content` do PowerShell dobrou o
  encoding (UTF-8 lido como ANSI) — restaurado do git e reeditado com a ferramenta de edição.
  Regra prática: arquivo com acento não passa por pipeline de texto do PowerShell.
- [27/08] Handoff escrito ([[handoff_2026_08_27_sessao04_kanban]]), ORDEM → ✅ entregue,
  mapa do cofre atualizado. Aguardando OK do dono para o merge na main (D-20).
