-- ============================================================================
-- ⏸️ PENDENTE — NÃO APLICAR sem o OK do dono (tabelas da INTEGRAÇÃO do Tiny e
-- retirada de estrutura — regra 3). (SESSAO-32 · §1.6 · dívida 8 da lei)
--
-- O que sobrou dos avisos de desempenho da Supabase (16/10, depois da 82):
--
-- 1. QUATRO ligações sem índice nas cópias do Tiny — buscar as contas a
--    receber e as notas fiscais de um pedido/cliente varre a tabela inteira
--    (a ficha do pedido, "Dados do Tiny", e a conferência diária leem por aí):
--      contas_receber.cliente_id · contas_receber.pedido_id
--      notas_fiscais.cliente_id  · notas_fiscais.pedido_id
--    Só índice: nenhuma coluna, nenhum dado muda; o n8n grava igual.
--
-- 2. DOIS índices repetidos (o mesmo índice duas vezes — cada gravação paga
--    os dois):
--      listas_disparo_membros: idx_membros_lista = idx_membros_lista_id
--        → sai idx_membros_lista (0 usos; o outro, 114) — criado pela migration
--          20260915120000_plt_comercial_banco (a que já anotava os "redundantes")
--      plt_cards: plt_cards_pedido_uq = plt_cards_pedido_unico (os dois únicos,
--        mesmo filtro) → sai plt_cards_pedido_uq (791 usos; o outro, 883.723) —
--        criado pela migration 20260824120200_plt_cards
--    Como migration NOVA (depois das que os criam), a reaplicação geral recria
--    e logo em seguida retira — fica coerente.
--
-- 3. Os "sem uso" (57 no aviso de 16/10): a maioria nasceu nesta semana (os 29
--    das chaves estrangeiras da migration 77 e os das telas novas) — ainda sem
--    uso porque a fábrica quase não usou desde então. NÃO entram aqui: rever
--    depois de 2 semanas de uso real (a lista sai do aviso "unused_index").
--
-- Sem travar: CREATE/DROP INDEX CONCURRENTLY — rodar comando a comando (não
-- pelo aplicador, que abre transação). Desfazer: DROP dos novos / CREATE dos
-- retirados (as definições estão acima).
-- ============================================================================

set lock_timeout = '5s';

create index concurrently if not exists contas_receber_cliente_id_idx on public.contas_receber (cliente_id);
create index concurrently if not exists contas_receber_pedido_id_idx  on public.contas_receber (pedido_id);
create index concurrently if not exists notas_fiscais_cliente_id_idx  on public.notas_fiscais (cliente_id);
create index concurrently if not exists notas_fiscais_pedido_id_idx   on public.notas_fiscais (pedido_id);

drop index concurrently if exists public.idx_membros_lista;
drop index concurrently if exists public.plt_cards_pedido_uq;
