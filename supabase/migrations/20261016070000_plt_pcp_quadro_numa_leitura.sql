-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 82 — O QUADRO DO PCP NUMA LEITURA
-- (SESSAO-32 · §1.1 · Lei §2/§3 — "nada em cascata"; dívida 15 da lei)
--
-- Conferido no site (16/10): o PCP abria com 3 leituras, duas delas EM FILA
-- (a página de cards → o resumo dos pedidos desses cards → as etiquetas
-- desses cards). A porta nova devolve a MESMA página de plt_fn_cards_pedido_pcp
-- (mesmas linhas, mesma ordem, mesmas colunas) e, em cada linha, as etiquetas
-- do card e o resumo do pedido — o MESMO de plt_fn_pedidos_kanban (chamada
-- uma vez para os pedidos da página). A porta antiga fica como está (a Visão
-- do dia usa). Prova no harness: igual, linha a linha.
-- Nada nas tabelas da integração.
-- ============================================================================

create or replace function public.plt_fn_pcp_quadro(
  p_limite       integer default 10,
  p_deslocamento integer default 0,
  p_grupo        text    default null   -- null = tudo | 'pedido' | 'reposicao'
)
returns table (
  id                   bigint,
  tipo                 text,
  pedido_id            bigint,
  card_pai_id          bigint,
  item_seq             integer,
  item_codigo          text,
  item_descricao       text,
  indice_unidade       integer,
  total_unidades       integer,
  setor_atual_id       bigint,
  etapa_atual_id       bigint,
  desde                timestamptz,
  executor_atual_id    uuid,
  responsavel_id       uuid,
  delegado_em          timestamptz,
  qualidade_atual      text,
  concluido_em         timestamptz,
  pausado_em           timestamptz,
  liberado_completo_em timestamptz,
  pecas_estoque        integer,
  contagem_total       bigint,
  etiquetas            bigint[],
  pedido_resumo        jsonb
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with pagina as (
    select q.*
      from public.plt_fn_cards_pedido_pcp(p_limite, p_deslocamento, p_grupo) with ordinality as q
  ),
  resumos as (
    select k.pedido_id, to_jsonb(k) - 'contagem_total' as resumo
      from public.plt_fn_pedidos_kanban(
             null, false,
             coalesce((select array_agg(distinct pg.pedido_id) from pagina pg where pg.pedido_id is not null), '{}'),
             100, 0) k
  )
  select pg.id, pg.tipo, pg.pedido_id, pg.card_pai_id, pg.item_seq, pg.item_codigo,
         pg.item_descricao, pg.indice_unidade, pg.total_unidades, pg.setor_atual_id,
         pg.etapa_atual_id, pg.desde, pg.executor_atual_id, pg.responsavel_id,
         pg.delegado_em, pg.qualidade_atual, pg.concluido_em, pg.pausado_em,
         pg.liberado_completo_em, pg.pecas_estoque, pg.contagem_total,
         coalesce(c.etiquetas, '{}'),
         r.resumo
    from pagina pg
    left join public.plt_cards c on c.id = pg.id
    left join resumos r on r.pedido_id = pg.pedido_id
   order by pg.ordinality;
$$;

comment on function public.plt_fn_pcp_quadro(integer, integer, text) is
  'SESSAO-32 (Lei §3, dívida 15): o quadro do PCP numa leitura — a mesma página de plt_fn_cards_pedido_pcp (mesmas linhas e ordem) + as etiquetas do card + o resumo do pedido (o mesmo de plt_fn_pedidos_kanban). Gate: o da porta de dentro (PCP/admin).';

revoke all on function public.plt_fn_pcp_quadro(integer, integer, text) from public, anon;
grant execute on function public.plt_fn_pcp_quadro(integer, integer, text) to authenticated;
