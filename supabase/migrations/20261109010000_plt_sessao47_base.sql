-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · SESSAO-47 · a BASE das três frentes
-- (09/11/2026 — pedido adiantado no Tiny que ainda falta produzir, a data real
-- da entrega e a configuração do painel de tempos)
--
-- O que as três migrations seguintes (20261109020000 — Tiny/PCP/Expedição,
-- 20261109030000 — a entrega, 20261109040000 — o painel de tempos) dividem:
--
--   1. Os FATOS novos (o check dos tipos recriado UMA vez, aqui — E-19/E-159):
--        pedido_volta_pcp      a logística devolveu ao PCP o pedido que o Tiny
--                              levou adiante, pedindo ao Tiny a situação de antes
--        pedido_volta_pcp_fim  a marca acima acabou (o Tiny confirmou, mudou para
--                              outra situação ou o pedido foi entregue)
--        entrega_dia_corrigido o administrador corrigiu o dia em que a entrega
--                              aconteceu de fato (a entrega não se edita — RNF-05)
--   2. A MARCA "devolvido ao PCP pela plataforma" no card do pedido (projeção,
--      no molde do stand-by): volta_pcp_em + volta_pcp_situacao.
--   3. A regra única do PCP diante do Tiny (D-132 + a marca):
--        fn_tiny_adiantou(situação)          → Faturado, Pronto para envio, Enviado
--        fn_fora_do_pcp(situação, volta_em)  → o pedido NÃO aparece no PCP
--
-- 100% aditiva: nenhuma porta muda aqui; nada em tabela da integração.
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · Os fatos novos
-- ----------------------------------------------------------------------------
alter table public.plt_eventos drop constraint if exists plt_eventos_tipo_check;
alter table public.plt_eventos add constraint plt_eventos_tipo_check check (tipo = any (array[
  'card_criado', 'movimentacao_setor', 'movimentacao_etapa', 'execucao_iniciada', 'execucao_finalizada',
  'execucao_pausada', 'execucao_retomada', 'qualidade_marcada', 'qualidade_parecer', 'divergencia_registrada',
  'notificacao_enviada', 'delegacao', 'estorno', 'pedido_atualizado', 'pedido_cancelado', 'card_arquivado',
  'pedido_entregue', 'pedido_lancado_rotas', 'unidade_desvinculada', 'peca_alocada', 'peca_reservada',
  'peca_reserva_desfeita', 'estoque_reserva_avaliada', 'etiqueta_adicionada', 'etiqueta_removida',
  'card_desarquivado', 'entrega_desfeita', 'entrega_nao_realizada', 'pedido_devolvido', 'comentario_adicionado',
  'anexo_adicionado', 'devolucao_decidida', 'ajuste_aberto', 'ajuste_concluido', 'avulso_concluido',
  'card_editado', 'responsavel_adicionado', 'responsavel_removido', 'anexo_removido', 'comentario_editado',
  'comentario_apagado', 'auxilio_iniciado', 'auxilio_pausado', 'auxilio_retomado', 'auxilio_encerrado',
  'prioridade_definida', 'responsavel_setor_definido', 'pedido_standby_entrou', 'pedido_standby_saiu',
  'data_entrega_alterada', 'peca_vinculada', 'tempo_decisao', 'pedido_itens_alterados',
  -- SESSAO-47: a volta ao PCP do pedido que o Tiny levou adiante, e o dia real da entrega
  'pedido_volta_pcp', 'pedido_volta_pcp_fim', 'entrega_dia_corrigido'
]::text[])) not valid;
alter table public.plt_eventos validate constraint plt_eventos_tipo_check;

-- ----------------------------------------------------------------------------
-- 2 · A marca "devolvido ao PCP pela plataforma" (projeção no card do pedido)
-- ----------------------------------------------------------------------------
alter table public.plt_cards add column if not exists volta_pcp_em timestamptz;
alter table public.plt_cards add column if not exists volta_pcp_situacao text;

alter table public.plt_cards drop constraint if exists plt_cards_volta_pcp_ck;
alter table public.plt_cards add constraint plt_cards_volta_pcp_ck check (
  (volta_pcp_em is null and volta_pcp_situacao is null)
  or (volta_pcp_em is not null and volta_pcp_situacao in ('aberto', 'preparando_envio'))
) not valid;
alter table public.plt_cards validate constraint plt_cards_volta_pcp_ck;

comment on column public.plt_cards.volta_pcp_em is
  'SESSAO-47: desde quando a plataforma devolveu ao PCP o pedido que o Tiny tinha levado adiante (Faturado, Pronto para envio, Enviado). Projeção do fato pedido_volta_pcp; nulo = sem a marca. Vale até o Tiny mostrar outra situação (fato pedido_volta_pcp_fim).';
comment on column public.plt_cards.volta_pcp_situacao is
  'SESSAO-47: a situação pedida ao Tiny junto com a volta ao PCP — ''aberto'' ou ''preparando_envio'' (os nomes da API do Tiny).';

-- ----------------------------------------------------------------------------
-- 3 · A regra única do PCP diante do Tiny
-- ----------------------------------------------------------------------------
-- As três situações em que o Tiny "levou o pedido adiante" e a fábrica ainda
-- pode ter o que produzir (resposta 3 do dono, 09/11). Entregue, Não entregue
-- e Cancelado têm caminho próprio e ficam de fora.
create or replace function plt_privado.fn_tiny_adiantou(p_situacao text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select plt_privado.fn_situacao_normalizada(p_situacao) in ('faturado', 'pronto_para_envio', 'enviado');
$$;

comment on function plt_privado.fn_tiny_adiantou(text) is
  'SESSAO-47: o Tiny levou o pedido adiante — Faturado, Pronto para envio ou Enviado. É o recorte da D-132 em que a plataforma pode devolver o pedido ao PCP (Entregue, Não entregue e Cancelado ficam de fora).';

-- A regra do PCP (D-132) com a marca: o pedido adiantado no Tiny fica FORA do
-- PCP, a não ser que a plataforma o tenha devolvido e o Tiny ainda não tenha
-- mostrado outra situação. Nas outras situações, vale a D-132 como sempre — a
-- marca nunca segura no PCP um pedido entregue, não entregue ou cancelado.
create or replace function plt_privado.fn_fora_do_pcp(p_situacao text, p_volta_em timestamptz)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select case when plt_privado.fn_tiny_adiantou(p_situacao) then p_volta_em is null
              else plt_privado.fn_tiny_tirou_do_pcp(p_situacao) end;
$$;

comment on function plt_privado.fn_fora_do_pcp(text, timestamptz) is
  'SESSAO-47: a regra única do PCP diante do Tiny — D-132 (fn_tiny_tirou_do_pcp) mais a marca de devolvido ao PCP (plt_cards.volta_pcp_em). Todas as portas do PCP leem daqui (D-75: painel = quadro).';

revoke all on function plt_privado.fn_tiny_adiantou(text) from public, anon, authenticated;
revoke all on function plt_privado.fn_fora_do_pcp(text, timestamptz) from public, anon, authenticated;
