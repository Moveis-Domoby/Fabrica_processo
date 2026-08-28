# Memória de execução — SESSAO-09 · Entrada de Pedidos (por trigger no banco)

**Branch:** `sessao-09-entrada-pedidos` · **Início:** 2026-08-28 (bloco noturno D-26; ordem 07 → **09** → 10 → 11 → 12, com a 08 adiada — D-30)
**Demanda:** `_docs/Plataforma/Demandas/SESSAO-09 - Entrada de Pedidos via n8n.md`
**Decisão que muda o desenho:** **D-31** — o n8n JÁ grava em `pedidos` (P15); a plataforma lê o próprio banco e cria o card instantaneamente por TRIGGER. Nenhum workflow novo no n8n; endpoint HTTP fica só documentado como alternativa futura.

## Task list (espelho da demanda, adaptada à D-31)

1. [ ] Migration 17: card de pedido nasce sozinho no PCP quando o pedido ENTRA em `pedidos` (trigger AFTER INSERT, à prova de falha — NUNCA propaga erro para `fn_upsert_pedido`)
2. [ ] Idempotência: reenvio/atualização NÃO duplica card (índice único parcial: um card de pedido por pedido) — mesmo evento 3x = 1 card
3. [ ] Atualização de pedido com unidades liberadas → conflito VISÍVEL (evento `pedido_atualizado` + selo no PCP e na expedição); sem liberação, o card reflete sozinho (ele lê de `pedidos`) e nada é registrado
4. [ ] Cancelamento (Q-24/D-31): evento `pedido_cancelado`, card marcado e visível (não some); com unidades liberadas → notifica admins
5. [ ] Pedido HISTÓRICO (sem card) atualizado → nada acontece (só INSERT cria card)
6. [ ] Eventos automáticos com `origem='automacao'` e fonte 'tiny' nos dados (autor máquina — a linha do tempo conta)
7. [ ] Funções kanban (`plt_fn_pedidos_kanban`, `plt_fn_expedicao_kanban`) recriadas com `alterado_apos_liberacao` (+ `situacao` na expedição) — drop+create (A-12/E-17)
8. [ ] Front: selos "Cancelado no Tiny" e "Alterado no Tiny após a liberação" no PCP e na expedição; linha do tempo entende os tipos novos; textos "em breve entram sozinhos" atualizados
9. [ ] Documentação `docs/entrada-de-pedidos.md` (como funciona + endpoint alternativo futuro, sem credencial)
10. [ ] Testes: harness ganha o bloco SESSAO-09 (criação automática, 3x sem duplicar, conflito, cancelamento+aviso, histórico intocado) e os testes antigos são ADAPTADOS (o card do cenário mínimo agora nasce sozinho)
11. [ ] tsc · lint · vitest · test:banco 2 rodadas → conferir duplicatas em produção → aplicar → advisors
12. [ ] Task list × demanda · merge na main · handoff + memória de aprendizado + continuidade

## Decisões técnicas

- **Trigger na tabela da integração** (`pedidos`) é o único jeito de ser instantâneo sem tocar o n8n (D-31). O risco real: erro no trigger derrubaria `fn_upsert_pedido` EM PRODUÇÃO. Mitigação: função com bloco `exception when others → raise warning` — a reação da plataforma falha em silêncio (com aviso no log), a integração NUNCA. Testado explicitamente no harness.
- **Um card de pedido por pedido** vira regra de banco: `create unique index ... on plt_cards (pedido_id) where tipo = 'pedido'`. Antes de aplicar, conferir em produção que não há duplicata.
- **`pedido_atualizado` só quando há unidade liberada e algo relevante mudou** (situacao, previsão, totais, obs, forma_envio) — sem liberação o resumo já reflete (lê de `pedidos`); registrar toda edição seria ruído. Limitação documentada: mudança SÓ nos itens (sem mexer nos campos do pedido) não gera o evento — os itens são apagados/regravados pela integração e não passam por este trigger.
- **Cancelamento**: derivar o selo da própria `situacao='cancelado'` (fonte única); o evento marca o instante na história do card; aviso a admins só com produção em andamento.
- Testes antigos adaptados: o "cenário mínimo" agora PROVA a auto-criação em vez de inserir card na mão.

## Registro contínuo

- [28/08] Branch criada. Relidas a demanda (2ª vez do bloco) e [[N8N - PCP Trello e ClickUp]] — o modelo real do card (`{pedido} - {descrição} (k/n)`, quantidade <1 não vira card) JÁ é o que `plt_fn_pedido_itens_kanban` replica; o formato do card do PCP da plataforma segue igual (resposta 9 do dono atendida pelo desenho existente).
- plt_notificacoes.tipo é texto livre — 'pedido_cancelado' entra sem migração extra.
