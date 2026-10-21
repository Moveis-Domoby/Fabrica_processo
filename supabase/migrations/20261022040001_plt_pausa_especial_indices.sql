-- ============================================================================
-- SESSAO-38 (frente F4) · complemento da pausa especial: índice em TODA chave
-- estrangeira de plt_pessoa_pausas (Lei de desempenho, regra 18f) — os
-- índices parciais da migration anterior cobrem só as paradas abertas; estes
-- cobrem as fechadas (as que só crescem) para as chaves de pessoa e card.
-- Aditiva. Idempotente.
-- ============================================================================

set local lock_timeout = '5s';

create index if not exists plt_pessoa_pausas_usuario_fk_idx
  on public.plt_pessoa_pausas (usuario_id, inicio desc);
create index if not exists plt_pessoa_pausas_card_fk_idx
  on public.plt_pessoa_pausas (card_id);
