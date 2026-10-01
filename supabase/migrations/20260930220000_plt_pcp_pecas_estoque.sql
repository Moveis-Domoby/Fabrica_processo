-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 48 — O QUADRO DO PCP AVISA QUANDO
-- HÁ PEÇA NO ESTOQUE (rodada do dono em 30/09, no teste ao vivo — ↪️ D-62/D-86):
--
--   "O que tiver produto para liberar do estoque aparece com algum sinal de
--    recurso visual."
--
-- A porta do quadro ganha a coluna `pecas_estoque`: para cada card de PEDIDO,
-- quantas peças do galpão podem atendê-lo — as RESERVADAS para este pedido
-- (D-78) + as LIVRES de mesmo SKU de algum item (a régua da sugestão de
-- alocação, D-62; personalizado fica de fora — a sugestão fina mora na
-- liberação). Reposição não tem pedido: 0. Conta feita por página (até 100
-- cards), nada por cartão no navegador (regra 17). Mesma assinatura; só a
-- FORMA muda (drop + create — E-17: a 47 já dropa as duas assinaturas antigas).
-- ============================================================================

set local lock_timeout = '5s';

drop function if exists public.plt_fn_cards_pedido_pcp(integer, integer, text);
create function public.plt_fn_cards_pedido_pcp(
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
  contagem_total       bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id, c.tipo, c.pedido_id, c.card_pai_id, c.item_seq, c.item_codigo,
         c.item_descricao, c.indice_unidade, c.total_unidades, c.setor_atual_id,
         c.etapa_atual_id, c.desde, c.executor_atual_id, c.responsavel_id,
         c.delegado_em, c.qualidade_atual, c.concluido_em, c.pausado_em,
         c.liberado_completo_em,
         pe.n as pecas_estoque,
         count(*) over ()::bigint as contagem_total
    from public.plt_cards c
    join public.plt_setores s on s.id = c.setor_atual_id and s.papel_no_fluxo = 'entrada'
    left join public.pedidos p on p.id = c.pedido_id
    cross join lateral (
      select case when c.tipo <> 'pedido' then 0 else (
        select count(*)::int
          from public.plt_cards u
          join public.plt_setores se on se.id = u.setor_atual_id and se.codigo = 'estoque'
         where u.tipo = 'unidade' and u.pedido_id is null and u.arquivado_em is null
           and (u.reservada_pedido_id = c.pedido_id
                or (u.reservada_pedido_id is null
                    and u.item_codigo is not null
                    and not plt_privado.fn_eh_personalizado(u.item_descricao)
                    and exists (select 1 from public.pedido_itens pi
                                 where pi.pedido_id = c.pedido_id
                                   and pi.codigo = u.item_codigo
                                   and not plt_privado.fn_eh_personalizado(pi.descricao))))
      ) end as n
    ) pe
   where plt_privado.fn_usuario_atual() is not null
     and (
       plt_privado.fn_eh_admin()
       or c.setor_atual_id in (select plt_privado.fn_setores_do_usuario())
     )
     and c.tipo in ('pedido', 'reposicao')
     and (p_grupo is null or c.tipo = p_grupo)
     and c.arquivado_em is null
     and c.liberado_completo_em is null
     -- Pedido encerrado no Tiny sai do quadro (S23); CANCELADO vai para a tela
     -- Cancelados (S24, na Logística). A reposição não tem pedido: fica até
     -- ser liberada por inteiro, arquivada ou vencer (D-85).
     and (c.tipo = 'reposicao'
          or (p.id is not null
              and plt_privado.fn_situacao_normalizada(p.situacao)
                  not in ('entregue', 'nao_entregue', 'cancelado')
              -- D-63: sem nada a produzir (só frete), o pedido não espera
              -- liberação — vai direto para Pedidos em aguardo.
              and exists (select 1 from plt_privado.vw_itens_producao v
                           where v.pedido_id = p.id and v.unidades > 0)))
   order by c.desde asc nulls last, c.id
   limit least(greatest(coalesce(p_limite, 10), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_cards_pedido_pcp(integer, integer, text) is
  'O quadro do PCP, paginado. p_grupo separa as abas (30/09): nulo = tudo (o painel da Visão do dia usa assim — D-75), ''pedido'' = aguardando liberação, ''reposicao'' = reabastecimento. pecas_estoque = peças do galpão que atendem o pedido (reservadas p/ ele + livres de mesmo SKU — D-62/D-78). Gate: PCP/admin.';

revoke all on function public.plt_fn_cards_pedido_pcp(integer, integer, text) from public, anon;
grant execute on function public.plt_fn_cards_pedido_pcp(integer, integer, text) to authenticated;
