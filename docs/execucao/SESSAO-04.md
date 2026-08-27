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
