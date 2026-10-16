-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 84 — ÍNDICES DAS CÓPIAS DO TINY E
-- OS 2 REPETIDOS (SESSAO-32 · §1.6 · dívida 8 da lei · D-138: "Pode aplicar")
--
-- 1. As 4 ligações sem índice nas cópias do Tiny (contas a receber e notas
--    fiscais, por cliente e por pedido) — só índice; o n8n grava igual.
-- 2. Os 2 índices repetidos (o mesmo índice duas vezes — cada gravação pagava
--    os dois): sai idx_membros_lista (= idx_membros_lista_id; 0 usos) e sai
--    plt_cards_pedido_uq (= plt_cards_pedido_unico; os dois únicos com o mesmo
--    filtro). Como migration NOVA, depois das que os criam: a reaplicação geral
--    recria e logo em seguida retira — fica coerente.
-- Em produção, criados/retirados ANTES com CONCURRENTLY (sem travar); aqui com
-- IF [NOT] EXISTS.
-- ============================================================================

set local lock_timeout = '5s';

create index if not exists contas_receber_cliente_id_idx on public.contas_receber (cliente_id);
create index if not exists contas_receber_pedido_id_idx  on public.contas_receber (pedido_id);
create index if not exists notas_fiscais_cliente_id_idx  on public.notas_fiscais (cliente_id);
create index if not exists notas_fiscais_pedido_id_idx   on public.notas_fiscais (pedido_id);

drop index if exists public.idx_membros_lista;
drop index if exists public.plt_cards_pedido_uq;
