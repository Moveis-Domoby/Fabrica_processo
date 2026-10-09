-- ============================================================================
-- SESSAO-30 · checklist da Lei (§7.2 — índice em toda chave estrangeira): a
-- tabela nova da equipe do caminhão (migration 60) ganhou a chave "quem
-- definiu" sem índice — o alerta do Supabase apontou (08/10). Tabela pequena;
-- o índice nasce sem travar nada que importe.
-- ============================================================================

set local lock_timeout = '5s';

create index if not exists plt_programacao_equipes_definido_por_idx
  on public.plt_programacao_equipes (definido_por);
