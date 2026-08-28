-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 18 — PORTAS DE LEITURA DO DASHBOARD
-- Sessão: SESSAO-10 · Data: 2026-08-28 (bloco noturno D-26)
--
-- A colheita do que as sessões 05–07 plantaram (D-02/D-32): TEMPO em primeiro
-- lugar — a lista detalhada de execuções, fila vs execução por setor (lado a
-- lado e somados), por pessoa, por item — mais qualidade por setor (RF-85) e
-- tempo parado no estoque (RF-14).
--
-- Desenho (E-11, endpoints de propósito): funções `security definer` em
-- `public` com gate interno `fn_setores_dashboard()` — admin vê tudo, líder
-- vê SÓ os setores que lidera (D-32), operador não vê nada. O RLS por setor
-- das views não serve de gate aqui (mostraria ao operador o próprio setor).
-- Estas funções somam +6 WARN esperados nos advisors (total 14).
--
-- D-29 em tudo: cada duração sai BRUTA e ÚTIL — a útil desconta horário de
-- funcionamento e pausas via plt_privado.fn_tempo_util. Agregados CLIPAM a
-- permanência/execução ao período pedido antes de somar.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · O gate: quais setores ESTE usuário pode medir (D-32)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_setores_dashboard()
returns setof bigint
language sql
stable
security definer
set search_path = public
as $$
  select s.id from public.plt_setores s
   where plt_privado.fn_eh_admin()
  union
  select us.setor_id
    from public.plt_usuario_setores us
    join public.plt_usuarios u on u.id = us.usuario_id
   where u.auth_user_id = auth.uid()
     and u.ativo
     and us.lider_do_setor;
$$;

comment on function plt_privado.fn_setores_dashboard() is
  'D-32: setores que aparecem no dashboard de quem consulta — admin todos, líder os que lidera, operador nenhum.';

revoke all on function plt_privado.fn_setores_dashboard() from public, anon;
grant execute on function plt_privado.fn_setores_dashboard() to authenticated;

-- ----------------------------------------------------------------------------
-- 2 · A LISTA DETALHADA de execuções — o pedido nº 1 do dono (D-32)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_dash_execucoes(
  p_de           timestamptz,
  p_ate          timestamptz,
  p_setor_id     bigint default null,
  p_usuario_id   uuid default null,
  p_limite       integer default 20,
  p_deslocamento integer default 0
)
returns table (
  evento_inicio_id bigint,
  card_id          bigint,
  pedido_numero    integer,
  item_codigo      text,
  item_descricao   text,
  indice_unidade   integer,
  total_unidades   integer,
  setor_id         bigint,
  setor_nome       text,
  etapa_nome       text,
  executor_nome    text,
  finalizador_nome text,
  iniciou_em       timestamptz,
  finalizou_em     timestamptz,
  em_andamento     boolean,
  encerramento     text,
  duracao_bruta    interval,
  duracao_util     interval,
  contagem_total   bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select v.evento_inicio_id,
         v.card_id,
         p.numero                          as pedido_numero,
         c.item_codigo,
         c.item_descricao,
         c.indice_unidade,
         c.total_unidades,
         v.setor_id,
         s.nome                            as setor_nome,
         e.nome                            as etapa_nome,
         ui.nome                           as executor_nome,
         uf.nome                           as finalizador_nome,
         v.iniciou_em,
         v.finalizou_em,
         v.em_andamento,
         v.encerramento,
         v.duracao                         as duracao_bruta,
         plt_privado.fn_tempo_util(v.iniciou_em, v.finalizou_em, v.setor_id, v.usuario_inicio_id)
                                           as duracao_util,
         count(*) over ()                  as contagem_total
    from public.plt_vw_execucoes v
    join public.plt_cards c on c.id = v.card_id
    left join public.pedidos p on p.id = c.pedido_id
    left join public.plt_setores s on s.id = v.setor_id
    left join public.plt_etapas  e on e.id = v.etapa_id
    left join public.plt_usuarios ui on ui.id = v.usuario_inicio_id
    left join public.plt_usuarios uf on uf.id = v.usuario_fim_id
   where v.setor_id in (select plt_privado.fn_setores_dashboard())
     and (p_setor_id is null or v.setor_id = p_setor_id)
     and (p_usuario_id is null or v.usuario_inicio_id = p_usuario_id)
     and v.iniciou_em >= p_de and v.iniciou_em < p_ate
   order by v.iniciou_em desc
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_dash_execucoes(timestamptz, timestamptz, bigint, uuid, integer, integer) is
  'Dashboard (SESSAO-10/D-32): a lista detalhada de execuções, com duração bruta e útil (D-29). Endpoint de propósito — gate por setor do dashboard.';

-- ----------------------------------------------------------------------------
-- 3 · Fila vs execução por SETOR, lado a lado e somados (D-02)
-- Clip ao período: só a parte da permanência/execução dentro de [de, ate).
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_dash_tempos_setor(
  p_de  timestamptz,
  p_ate timestamptz
)
returns table (
  setor_id        bigint,
  setor_nome      text,
  fila_bruta      interval,
  fila_util       interval,
  execucao_bruta  interval,
  execucao_util   interval,
  total_util      interval,
  execucoes       integer,
  finalizadas     integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with setores_ok as (
    select sd as id from plt_privado.fn_setores_dashboard() sd
  ),
  fila as (
    select pm.setor_id,
           sum(cl.fim - cl.ini)                                           as bruta,
           sum(plt_privado.fn_tempo_util(cl.ini, cl.fim, pm.setor_id, null)) as util
      from public.plt_vw_permanencias pm
      cross join lateral (
        select greatest(pm.entrou_em, p_de) as ini,
               least(coalesce(pm.saiu_em, now()), p_ate) as fim
      ) cl
     where pm.eh_fila
       and pm.setor_id in (select id from setores_ok)
       and cl.fim > cl.ini
     group by pm.setor_id
  ),
  execucao as (
    select v.setor_id,
           sum(cl.fim - cl.ini)                                           as bruta,
           sum(plt_privado.fn_tempo_util(cl.ini, cl.fim, v.setor_id, v.usuario_inicio_id)) as util,
           count(*)::int                                                  as execucoes,
           count(*) filter (where v.encerramento = 'finalizada')::int     as finalizadas
      from public.plt_vw_execucoes v
      cross join lateral (
        select greatest(v.iniciou_em, p_de) as ini,
               least(coalesce(v.finalizou_em, now()), p_ate) as fim
      ) cl
     where v.setor_id in (select id from setores_ok)
       and cl.fim > cl.ini
     group by v.setor_id
  )
  select s.id                                   as setor_id,
         s.nome                                 as setor_nome,
         coalesce(f.bruta, interval '0')        as fila_bruta,
         coalesce(f.util,  interval '0')        as fila_util,
         coalesce(x.bruta, interval '0')        as execucao_bruta,
         coalesce(x.util,  interval '0')        as execucao_util,
         coalesce(f.util, interval '0') + coalesce(x.util, interval '0') as total_util,
         coalesce(x.execucoes, 0)               as execucoes,
         coalesce(x.finalizadas, 0)             as finalizadas
    from public.plt_setores s
    left join fila f     on f.setor_id = s.id
    left join execucao x on x.setor_id = s.id
   where s.id in (select id from setores_ok)
     and s.ativo
   order by s.ordem, s.id;
$$;

comment on function public.plt_fn_dash_tempos_setor(timestamptz, timestamptz) is
  'Dashboard (D-02): fila (do setor) vs execução (da pessoa), lado a lado e somados, bruto e útil (D-29), clipado ao período. Gate por setor do dashboard.';

-- ----------------------------------------------------------------------------
-- 4 · Tempo por PESSOA (execução — o tempo que tem dono)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_dash_tempos_pessoa(
  p_de       timestamptz,
  p_ate      timestamptz,
  p_setor_id bigint default null
)
returns table (
  usuario_id     uuid,
  usuario_nome   text,
  matricula      text,
  execucoes      integer,
  cards_atendidos integer,
  tempo_bruto    interval,
  tempo_util     interval
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.id                                  as usuario_id,
         u.nome                                as usuario_nome,
         u.matricula,
         count(*)::int                         as execucoes,
         count(distinct v.card_id)::int        as cards_atendidos,
         sum(cl.fim - cl.ini)                  as tempo_bruto,
         sum(plt_privado.fn_tempo_util(cl.ini, cl.fim, v.setor_id, v.usuario_inicio_id))
                                               as tempo_util
    from public.plt_vw_execucoes v
    join public.plt_usuarios u on u.id = v.usuario_inicio_id
    cross join lateral (
      select greatest(v.iniciou_em, p_de) as ini,
             least(coalesce(v.finalizou_em, now()), p_ate) as fim
    ) cl
   where v.setor_id in (select plt_privado.fn_setores_dashboard())
     and (p_setor_id is null or v.setor_id = p_setor_id)
     and cl.fim > cl.ini
   group by u.id, u.nome, u.matricula
   order by tempo_util desc nulls last;
$$;

comment on function public.plt_fn_dash_tempos_pessoa(timestamptz, timestamptz, bigint) is
  'Dashboard (D-02/D-32): tempo de execução por pessoa (bruto e útil), clipado ao período. Alavancagem operacional — sem ranking de bonificação (D-04). Gate por setor do dashboard.';

-- ----------------------------------------------------------------------------
-- 5 · Tempo por ITEM produzido
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_dash_tempos_item(
  p_de  timestamptz,
  p_ate timestamptz
)
returns table (
  item_codigo    text,
  item_descricao text,
  execucoes      integer,
  unidades       integer,
  tempo_util     interval,
  media_por_unidade interval
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.item_codigo,
         max(c.item_descricao)                 as item_descricao,
         count(*)::int                         as execucoes,
         count(distinct v.card_id)::int        as unidades,
         sum(plt_privado.fn_tempo_util(cl.ini, cl.fim, v.setor_id, v.usuario_inicio_id))
                                               as tempo_util,
         sum(plt_privado.fn_tempo_util(cl.ini, cl.fim, v.setor_id, v.usuario_inicio_id))
           / greatest(count(distinct v.card_id), 1) as media_por_unidade
    from public.plt_vw_execucoes v
    join public.plt_cards c on c.id = v.card_id
    cross join lateral (
      select greatest(v.iniciou_em, p_de) as ini,
             least(coalesce(v.finalizou_em, now()), p_ate) as fim
    ) cl
   where v.setor_id in (select plt_privado.fn_setores_dashboard())
     and cl.fim > cl.ini
   group by c.item_codigo
   order by tempo_util desc nulls last;
$$;

comment on function public.plt_fn_dash_tempos_item(timestamptz, timestamptz) is
  'Dashboard (D-32): tempo útil de execução por item produzido, com média por unidade. Insumo do futuro tempo-padrão (X-04). Gate por setor do dashboard.';

-- ----------------------------------------------------------------------------
-- 6 · Qualidade por setor (RF-85): o que cada setor ENTREGA e o que aponta
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_dash_qualidade(
  p_de  timestamptz,
  p_ate timestamptz
)
returns table (
  setor_id               bigint,
  setor_nome             text,
  entregues_perfeito     integer,
  entregues_atencao      integer,
  entregues_danificado   integer,
  divergencias_contra    integer,
  pareceres_dados        integer,
  divergencias_apontadas integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with setores_ok as (
    select sd as id from plt_privado.fn_setores_dashboard() sd
  ),
  como_origem as (
    select q.setor_origem_id as setor_id,
           count(*) filter (where q.estado_remetente = 'perfeito')::int   as p,
           count(*) filter (where q.estado_remetente = 'atencao')::int    as a,
           count(*) filter (where q.estado_remetente = 'danificado')::int as d,
           count(*) filter (where q.divergente)::int                      as contra
      from public.plt_vw_qualidade_transicoes q
     where q.marcado_em >= p_de and q.marcado_em < p_ate
     group by q.setor_origem_id
  ),
  como_destino as (
    select q.setor_destino_id as setor_id,
           count(*) filter (where q.evento_parecer_id is not null)::int as pareceres,
           count(*) filter (where q.divergente)::int                    as apontadas
      from public.plt_vw_qualidade_transicoes q
     where q.marcado_em >= p_de and q.marcado_em < p_ate
     group by q.setor_destino_id
  )
  select s.id                          as setor_id,
         s.nome                        as setor_nome,
         coalesce(o.p, 0)              as entregues_perfeito,
         coalesce(o.a, 0)              as entregues_atencao,
         coalesce(o.d, 0)              as entregues_danificado,
         coalesce(o.contra, 0)         as divergencias_contra,
         coalesce(dst.pareceres, 0)    as pareceres_dados,
         coalesce(dst.apontadas, 0)    as divergencias_apontadas
    from public.plt_setores s
    left join como_origem  o   on o.setor_id = s.id
    left join como_destino dst on dst.setor_id = s.id
   where s.id in (select id from setores_ok)
     and s.ativo
   order by s.ordem, s.id;
$$;

comment on function public.plt_fn_dash_qualidade(timestamptz, timestamptz) is
  'Dashboard (RF-85/D-09): por setor, o que entregou (🟢🟡🔴), divergências contra a entrega dele, pareceres dados e divergências apontadas ao receber. Gate por setor do dashboard.';

-- ----------------------------------------------------------------------------
-- 7 · Tempo parado no ESTOQUE (RF-14) — retrato de agora
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_dash_estoque()
returns table (
  cards_parados  integer,
  tempo_medio    interval,
  tempo_maximo   interval,
  mais_antigo_pedido integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with estoque as (
    select s.id from public.plt_setores s where s.codigo = 'estoque'
  )
  select count(*)::int                              as cards_parados,
         avg(now() - c.desde)                       as tempo_medio,
         max(now() - c.desde)                       as tempo_maximo,
         (select p.numero from public.plt_cards c2
            join public.pedidos p on p.id = c2.pedido_id
           where c2.setor_atual_id in (select id from estoque)
             and c2.tipo = 'unidade'
             -- o gate vale também aqui: sem direito ao estoque, nada vaza
             and (select id from estoque) in (select plt_privado.fn_setores_dashboard())
           order by c2.desde asc limit 1)           as mais_antigo_pedido
    from public.plt_cards c
   where c.setor_atual_id in (select id from estoque)
     and c.tipo = 'unidade'
     and (select id from estoque) in (select plt_privado.fn_setores_dashboard());
$$;

comment on function public.plt_fn_dash_estoque() is
  'Dashboard (RF-14): retrato do tempo parado no ESTOQUE agora. Vazio para quem não mede o estoque (D-32).';

-- ----------------------------------------------------------------------------
-- 8 · Quem executa o quê (E-11)
-- ----------------------------------------------------------------------------
revoke all on function public.plt_fn_dash_execucoes(timestamptz, timestamptz, bigint, uuid, integer, integer) from public, anon;
revoke all on function public.plt_fn_dash_tempos_setor(timestamptz, timestamptz)   from public, anon;
revoke all on function public.plt_fn_dash_tempos_pessoa(timestamptz, timestamptz, bigint) from public, anon;
revoke all on function public.plt_fn_dash_tempos_item(timestamptz, timestamptz)    from public, anon;
revoke all on function public.plt_fn_dash_qualidade(timestamptz, timestamptz)      from public, anon;
revoke all on function public.plt_fn_dash_estoque()                                from public, anon;

grant execute on function public.plt_fn_dash_execucoes(timestamptz, timestamptz, bigint, uuid, integer, integer) to authenticated;
grant execute on function public.plt_fn_dash_tempos_setor(timestamptz, timestamptz)   to authenticated;
grant execute on function public.plt_fn_dash_tempos_pessoa(timestamptz, timestamptz, bigint) to authenticated;
grant execute on function public.plt_fn_dash_tempos_item(timestamptz, timestamptz)    to authenticated;
grant execute on function public.plt_fn_dash_qualidade(timestamptz, timestamptz)      to authenticated;
grant execute on function public.plt_fn_dash_estoque()                                to authenticated;
