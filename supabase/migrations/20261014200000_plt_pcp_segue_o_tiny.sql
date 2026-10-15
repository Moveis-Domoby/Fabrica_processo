-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 74 — O PCP SEGUE O TINY E A
-- EXPEDIÇÃO SÓ MOSTRA PEDIDO VIVO
-- Ajustes do dono (14/10/2026, noite) · Decisões: D-132 e D-133
--
--   1. "No PCP não faz sentido esses pedidos ainda estarem aqui, sendo que no
--      Tiny eles já estão até como recebido … sempre que um pedido é dado como
--      entregue/recebido ou algo do tipo no Tiny, se ele ainda estiver em PCP,
--      ele deve sumir e seguir a atualização do Tiny."
--      O "recebido" do Tiny é do PAGAMENTO; a situação do pedido é que anda:
--      Em aberto → Preparando envio (o estado normal de pedido esperando
--      produção aqui — 36 em 14/10) → Faturado → Pronto para envio → Enviado →
--      Entregue. Até hoje o PCP só tirava Entregue / Não entregue / Cancelado.
--      Agora também Faturado, Pronto para envio e Enviado: o pedido que o Tiny
--      já levou adiante não espera liberação (D-132). É filtro de LEITURA — se
--      o Tiny voltar a situação, o pedido volta ao PCP; nada se arquiva.
--      Regra única: plt_privado.fn_tiny_tirou_do_pcp(situacao) — o quadro do
--      PCP e o quadrinho da Visão do dia (D-75: painel = quadro) leem dela.
--
--   2. Expedição (imagem 6 do dono: "não faz sentido essa ordenação
--      completamente desatualizada"): a porta listava todo pedido com card de
--      pedido não arquivado — e o card do pedido nunca se arquiva depois da
--      liberação; os entregues de agosto apareciam no topo, com "1 ainda no
--      PCP". Agora só pedido VIVO (D-133): sem entrega registrada, não
--      encerrado no Tiny, e — se o Tiny já o levou adiante — só com alguma
--      peça liberada (o que a fábrica ainda tem nas mãos). Previsão mais
--      próxima primeiro.
--
-- Recriadas POR INTEIRO a partir das versões vivas (E-24): plt_fn_cards_pedido_pcp
-- (migration 48), plt_fn_dash_pcp_dia (migration 41), plt_fn_expedicao_kanban
-- (migration 39). Mesmas assinaturas e formas de retorno. Nada aqui altera as
-- tabelas da integração.
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · A regra única: o Tiny já levou o pedido adiante (não espera liberação)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tiny_tirou_do_pcp(p_situacao text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select plt_privado.fn_situacao_normalizada(p_situacao)
         in ('faturado', 'pronto_para_envio', 'enviado', 'entregue', 'nao_entregue', 'cancelado');
$$;

comment on function plt_privado.fn_tiny_tirou_do_pcp(text) is
  'D-132 (14/10): o pedido que o Tiny já levou adiante não espera liberação no PCP — Faturado, Pronto para envio, Enviado, Entregue, Não entregue, Cancelado. "Preparando envio" é o estado normal de pedido esperando produção aqui: fica. Filtro de leitura (o Tiny voltou → o pedido volta).';

revoke all on function plt_privado.fn_tiny_tirou_do_pcp(text) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2 · O quadro do PCP (recriada POR INTEIRO a partir da migration 48)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_cards_pedido_pcp(
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
     -- D-132 (14/10): o pedido que o Tiny já levou adiante (faturado, pronto
     -- para envio, enviado, entregue, não entregue, cancelado) sai do quadro e
     -- segue o Tiny; o CANCELADO mora em Pedidos → Cancelados. A reposição não
     -- tem pedido: fica até ser liberada por inteiro, arquivada ou vencer (D-85).
     and (c.tipo = 'reposicao'
          or (p.id is not null
              and not plt_privado.fn_tiny_tirou_do_pcp(p.situacao)
              -- D-63: sem nada a produzir (só frete), o pedido não espera
              -- liberação — vai direto para Pedidos em aguardo.
              and exists (select 1 from plt_privado.vw_itens_producao v
                           where v.pedido_id = p.id and v.unidades > 0)))
   order by c.desde asc nulls last, c.id
   limit least(greatest(coalesce(p_limite, 10), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_cards_pedido_pcp(integer, integer, text) is
  'O quadro do PCP, paginado. p_grupo separa as abas (30/09): nulo = tudo (o painel da Visão do dia usa assim — D-75), ''pedido'' = aguardando liberação, ''reposicao'' = reabastecimento. pecas_estoque = peças do galpão que atendem o pedido (reservadas p/ ele + livres de mesmo SKU — D-62/D-78). D-132: o pedido que o Tiny já levou adiante (fn_tiny_tirou_do_pcp) não aparece. Gate: PCP/admin.';

revoke all on function public.plt_fn_cards_pedido_pcp(integer, integer, text) from public, anon;
grant execute on function public.plt_fn_cards_pedido_pcp(integer, integer, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 3 · O quadrinho do PCP na Visão do dia (recriada POR INTEIRO a partir da
--     migration 41) — D-75: o mesmo conjunto do quadro
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_dash_pcp_dia(
  p_dia date default null
)
returns table (
  pedidos_a_liberar       integer,
  unidades_liberadas_dia  integer,
  espera_mais_antiga      interval
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with dia as (
    select (coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date)::timestamp
            at time zone 'America/Fortaleza') as ini
  ),
  pcp as (
    select s.id from public.plt_setores s where s.codigo = 'pcp'
  ),
  -- D-75: os cards que o quadro do PCP mostra — o MESMO filtro de
  -- plt_fn_cards_pedido_pcp, sem o gate por pessoa do quadro (o do painel
  -- fica no fim). D-132: a regra do Tiny é a mesma função dos dois.
  quadro as (
    select c.id, c.desde
      from public.plt_cards c
      join public.plt_setores s on s.id = c.setor_atual_id and s.papel_no_fluxo = 'entrada'
      left join public.pedidos p on p.id = c.pedido_id
     where c.tipo in ('pedido', 'reposicao')
       and c.arquivado_em is null
       and c.liberado_completo_em is null
       and (c.tipo = 'reposicao'
            or (p.id is not null
                and not plt_privado.fn_tiny_tirou_do_pcp(p.situacao)
                and exists (select 1 from plt_privado.vw_itens_producao v
                             where v.pedido_id = p.id and v.unidades > 0)))
  )
  select
    (select count(*)::int from quadro)             as pedidos_a_liberar,
    -- como estava (o dono não pediu mudança): toda unidade criada no dia
    (select count(*)::int
       from public.plt_eventos e
       join public.plt_cards c on c.id = e.card_id
      where e.tipo = 'card_criado'
        and c.tipo = 'unidade'
        and e.ocorrido_em >= (select ini from dia)
        and e.ocorrido_em <  (select ini from dia) + interval '1 day')
                                                   as unidades_liberadas_dia,
    (select max(now() - q.desde) from quadro q)    as espera_mais_antiga
   where (select id from pcp) in (select plt_privado.fn_setores_dashboard());
$$;

comment on function public.plt_fn_dash_pcp_dia(date) is
  'Visão do dia (SESSAO-16; D-75): o tile do PCP — "a liberar" = os cards que o quadro do PCP mostra (pedido que o Tiny ainda não levou adiante — D-132 — com peça por liberar + reposição; o mesmo filtro de plt_fn_cards_pedido_pcp), unidades liberadas no dia e a espera mais antiga entre os cards do quadro. Vazio para quem não mede o PCP (D-32).';

revoke all on function public.plt_fn_dash_pcp_dia(date) from public, anon;
grant execute on function public.plt_fn_dash_pcp_dia(date) to authenticated;

-- ----------------------------------------------------------------------------
-- 4 · A Expedição só com pedido vivo (recriada POR INTEIRO a partir da
--     migration 39) — D-133
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_expedicao_kanban(
  p_busca         text    default null,
  p_limite        integer default 20,
  p_deslocamento  integer default 0
)
returns table (
  pedido_id            bigint,
  numero               integer,
  cliente_nome         text,
  data_prevista        date,
  situacao             text,
  total_unidades       integer,
  unidades_liberadas   integer,
  unidades_no_terminal integer,
  alterado_apos_liberacao boolean,
  contagem_total       bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id                          as pedido_id,
         p.numero,
         coalesce(c.nome, '')          as cliente_nome,
         p.data_prevista,
         p.situacao,
         coalesce(i.total_unidades, 0) as total_unidades,
         coalesce(u.liberadas, 0)      as unidades_liberadas,
         coalesce(u.no_terminal, 0)    as unidades_no_terminal,
         exists (select 1 from public.plt_eventos e
                  where e.card_id = pc.id and e.tipo = 'pedido_atualizado')
                                       as alterado_apos_liberacao,
         count(*) over ()              as contagem_total
    from public.pedidos p
    join public.plt_cards pc
      on pc.pedido_id = p.id and pc.tipo = 'pedido' and pc.arquivado_em is null
    left join public.clientes c on c.id = p.cliente_id
    left join lateral (
      -- D-63: frete não conta.
      select coalesce(sum(v.unidades), 0)::int as total_unidades
          from plt_privado.vw_itens_producao v where v.pedido_id = p.id
    ) i on true
    left join lateral (
      select count(*)::int as liberadas,
             count(*) filter (where cu.concluido_em is not null)::int as no_terminal
        from public.plt_cards cu
       where cu.pedido_id = p.id and cu.tipo = 'unidade'
         and cu.arquivado_em is null
    ) u on true
   where plt_privado.fn_pode_ver_expedicao()
     -- D-133 (14/10): só pedido VIVO — sem entrega registrada na plataforma,
     -- não encerrado no Tiny; o que o Tiny já levou adiante só fica se a
     -- fábrica ainda tem peça dele nas mãos.
     and pc.entrega_evento_id is null
     and plt_privado.fn_situacao_normalizada(p.situacao)
         not in ('entregue', 'nao_entregue', 'cancelado')
     and (not plt_privado.fn_tiny_tirou_do_pcp(p.situacao) or coalesce(u.liberadas, 0) > 0)
     and (p_busca is null or btrim(p_busca) = ''
          or p.numero::text like btrim(p_busca) || '%'
          or c.nome ilike '%' || btrim(p_busca) || '%')
   order by p.data_prevista asc nulls last, p.numero desc
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_expedicao_kanban(text, integer, integer) is
  'Expedição (reagrupamento — D-01/D-13): os pedidos VIVOS (D-133 — sem entrega registrada, não encerrados no Tiny; o que o Tiny já levou adiante só com peça liberada), a previsão mais próxima primeiro, com o progresso das unidades. Gate: logística/admin.';

revoke all on function public.plt_fn_expedicao_kanban(text, integer, integer) from public, anon;
grant execute on function public.plt_fn_expedicao_kanban(text, integer, integer) to authenticated;
