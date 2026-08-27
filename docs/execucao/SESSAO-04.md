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

- [ ] T1 · Branch `sessao-04-kanban-nucleo` criada
- [ ] T2 · Cofre atualizado: D-22 (respostas de hoje), ORDEM → 🔨, demanda anotada, Q-21 adiada
- [ ] T3 · Migration 13: leitura de pedidos/itens para o kanban (funções security definer, fora do alcance de anon) + testes `test:banco`
- [ ] T4 · Quadro PCP: card por pedido (criado manualmente a partir de pedido do Tiny sem card), com itens
- [ ] T5 · Liberação: pedido → cards de unidade (k/n), parcial ou completa, destino por unidade, unidades do mesmo pedido podem ir para setores diferentes
- [ ] T6 · Quadros de setor: etapas internas como colunas + coluna "Chegada", cards de unidade
- [ ] T7 · Movimentação: drag-and-drop (desktop) E botão "Mover para…" (tablet) — grava evento append-only com autor, origem, destino, timestamp
- [ ] T8 · Card de unidade mostra: pedido de origem, produto, (k/n), etapa atual, tempo na etapa (contador simples)
- [ ] T9 · Visão de expedição: por pedido, unidades chegadas vs total — pedido completo/incompleto evidente
- [ ] T10 · Gestão de setores e etapas em /administracao: criar/renomear/ordenar/desativar (nunca apagar); admin + líder do setor
- [ ] T11 · Verificação: critérios de aceite um a um + F-07 (tsc, lint, testes, viewport celular E tablet) + screenshots
- [ ] T12 · Handoff em `_docs/Handoffs/` + memória de aprendizado + revisão do dono

## Critérios de aceite (da demanda)

- [ ] Pedido com 3 itens liberado no PCP gera 3 cards de unidade nas etapas escolhidas.
- [ ] Mover card grava evento com autor, origem, destino e timestamp.
- [ ] Visão de expedição mostra 2 de 3 unidades chegadas → pedido incompleto.
- [ ] Funciona em tablet (botão "mover para…") e desktop (drag-and-drop).
- [ ] Revisão do dono (PR dispensado — D-20) + handoff.

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
