-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 28 — PORTAS DOS DASHBOARDS DE VERDADE
-- Sessão: SESSAO-16 · Data: 2026-09-17
--
-- A reconstrução dos dashboards guiada pelos mockups (D-42) precisa de leituras
-- que a migration 18 não tinha: o RETRATO DE AGORA por setor (andon da Visão do
-- dia), os números do dia (concluídas = chegou ao terminal final — resposta do
-- dono em 17/09), produção por hora com média de referência, destinos do fim de
-- linha, danificados (do dia e em aberto) e a tendência semanal do tempo total
-- por unidade.
--
-- Desenho (E-11, endpoints de propósito, mesmo padrão da migration 18): funções
-- `security definer` em `public` com gate interno `fn_setores_dashboard()` —
-- admin tudo, líder SÓ os setores que lidera (D-32), operador nada. Números de
-- FIM DE LINHA (concluídas, destinos, aguardando lançamento, tendência) só
-- aparecem para quem mede o terminal em questão — líder de setor de produção
-- sem terminal não recebe número da fábrica inteira.
--
-- Nenhuma tabela nova (D-47): tudo deriva de plt_eventos/plt_cards e das views
-- de tempo. Estas funções somam +8 WARN esperados nos advisors.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · O RETRATO DE AGORA por setor de produção — os tiles do andon
--
-- "Na fila" = card de unidade sem execução aberta (na fila o card ainda não é
-- de ninguém — D-02); "em execução" = com executor projetado. A linha com
-- setor_id NULL é o TOTAL (pessoas contadas sem repetir entre setores).
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_dash_agora()
returns table (
  setor_id            bigint,
  setor_nome          text,
  setor_codigo        text,
  na_fila             integer,
  em_execucao         integer,
  pessoas_executando  integer,
  espera_mais_antiga  interval
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with producao_ok as (
    select s.id, s.nome, s.codigo, s.ordem
      from public.plt_setores s
     where s.ativo
       and s.papel_no_fluxo = 'producao'
       and s.id in (select plt_privado.fn_setores_dashboard())
  ),
  vivos as (
    select c.setor_atual_id, c.executor_atual_id, c.desde
      from public.plt_cards c
      join producao_ok s on s.id = c.setor_atual_id
     where c.tipo = 'unidade'
       and c.arquivado_em is null
       and c.concluido_em is null
  )
  select s.id                                              as setor_id,
         s.nome                                            as setor_nome,
         s.codigo                                          as setor_codigo,
         count(v.setor_atual_id) filter (where v.executor_atual_id is null)::int     as na_fila,
         count(v.setor_atual_id) filter (where v.executor_atual_id is not null)::int as em_execucao,
         count(distinct v.executor_atual_id)::int          as pessoas_executando,
         max(now() - v.desde) filter (where v.executor_atual_id is null)
                                                           as espera_mais_antiga
    from producao_ok s
    left join vivos v on v.setor_atual_id = s.id
   group by s.id, s.nome, s.codigo, s.ordem
  union all
  select null, null, null,
         count(*) filter (where v.executor_atual_id is null)::int,
         count(*) filter (where v.executor_atual_id is not null)::int,
         count(distinct v.executor_atual_id)::int,
         max(now() - v.desde) filter (where v.executor_atual_id is null)
    from vivos v
  having exists (select 1 from producao_ok)
   order by setor_id nulls last;
$$;

comment on function public.plt_fn_dash_agora() is
  'Visão do dia (SESSAO-16/D-42): retrato de agora por setor de produção — fila, execuções abertas, pessoas e a espera mais antiga. A linha sem setor é o total. Gate por setor do dashboard (D-32).';

-- ----------------------------------------------------------------------------
-- 2 · O tile do PCP — pedidos a liberar e unidades liberadas no dia
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
  )
  select
    -- pedido ainda com unidade por liberar (cancelado não conta como trabalho)
    (select count(*)::int
       from public.plt_cards pc
       join public.pedidos p on p.id = pc.pedido_id
       left join lateral (
         select coalesce(sum(case when round(pi.quantidade) >= 1
                                  then round(pi.quantidade)::int else 0 end), 0)::int as total
           from public.pedido_itens pi
          where pi.pedido_id = p.id
       ) i on true
       left join lateral (
         select count(*)::int as liberadas
           from public.plt_cards cu
          where cu.pedido_id = p.id and cu.tipo = 'unidade'
            and cu.arquivado_em is null
       ) u on true
      where pc.tipo = 'pedido'
        and pc.arquivado_em is null
        and plt_privado.fn_situacao_normalizada(p.situacao) is distinct from 'cancelado'
        and coalesce(u.liberadas, 0) < coalesce(i.total, 0)) as pedidos_a_liberar,
    (select count(*)::int
       from public.plt_eventos e
       join public.plt_cards c on c.id = e.card_id
      where e.tipo = 'card_criado'
        and c.tipo = 'unidade'
        and e.ocorrido_em >= (select ini from dia)
        and e.ocorrido_em <  (select ini from dia) + interval '1 day')
                                                    as unidades_liberadas_dia,
    (select max(now() - pc.desde)
       from public.plt_cards pc
      where pc.tipo = 'pedido'
        and pc.arquivado_em is null
        and pc.setor_atual_id in (select id from pcp)) as espera_mais_antiga
   where (select id from pcp) in (select plt_privado.fn_setores_dashboard());
$$;

comment on function public.plt_fn_dash_pcp_dia(date) is
  'Visão do dia (SESSAO-16): o tile do PCP — pedidos com unidade por liberar, unidades liberadas no dia e a espera mais antiga. Vazio para quem não mede o PCP (D-32).';

-- ----------------------------------------------------------------------------
-- 3 · Os números do DIA — concluída = chegou ao terminal final (dono, 17/09)
--
-- A média de referência é a das mesmas 4 semanas anteriores (mesmo dia da
-- semana), como no mockup ("vs média das últimas 4 quintas").
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_dash_dia(
  p_dia date default null
)
returns table (
  concluidas_dia          integer,
  media_concluidas_4sem   numeric,
  danificados_dia         integer,
  aguardando_lancamento   integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with setores_ok as (
    select sd as id from plt_privado.fn_setores_dashboard() sd
  ),
  terminais_ok as (
    select s.id from public.plt_setores s
     where s.papel_no_fluxo = 'terminal'
       and s.id in (select id from setores_ok)
  ),
  dia as (
    select (coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date)::timestamp
            at time zone 'America/Fortaleza') as ini
  ),
  chegadas as (
    -- toda chegada de unidade a um terminal que este usuário mede
    select distinct on (e.card_id, ((e.ocorrido_em at time zone 'America/Fortaleza')::date))
           e.card_id,
           (e.ocorrido_em at time zone 'America/Fortaleza')::date as dia_local
      from public.plt_eventos e
      join public.plt_cards c on c.id = e.card_id and c.tipo = 'unidade'
     where e.tipo = 'movimentacao_setor'
       and e.setor_destino_id in (select id from terminais_ok)
  )
  select
    (select count(*)::int from chegadas ch
      where ch.dia_local = (coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date)))
                                                   as concluidas_dia,
    (select round(count(*)::numeric / 4, 1) from chegadas ch
      where ch.dia_local in (
        coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date) - 7,
        coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date) - 14,
        coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date) - 21,
        coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date) - 28))
                                                   as media_concluidas_4sem,
    (select count(distinct e.card_id)::int
       from public.plt_eventos e
       join public.plt_etapas et on et.id = e.etapa_destino_id and et.eh_danificado
      where e.tipo in ('movimentacao_etapa', 'movimentacao_setor')
        and e.setor_destino_id in (select id from setores_ok)
        and e.ocorrido_em >= (select ini from dia)
        and e.ocorrido_em <  (select ini from dia) + interval '1 day')
                                                   as danificados_dia,
    (select count(*)::int
       from public.plt_cards pc
       join public.pedidos p on p.id = pc.pedido_id
       left join lateral (
         select coalesce(sum(case when round(pi.quantidade) >= 1
                                  then round(pi.quantidade)::int else 0 end), 0)::int as total
           from public.pedido_itens pi where pi.pedido_id = p.id
       ) i on true
       left join lateral (
         select count(*) filter (where s.papel_no_fluxo = 'terminal')::int as prontas
           from public.plt_cards cu
           left join public.plt_setores s on s.id = cu.setor_atual_id
          where cu.pedido_id = p.id and cu.tipo = 'unidade' and cu.arquivado_em is null
       ) u on true
      where pc.tipo = 'pedido'
        and pc.arquivado_em is null
        and pc.lancado_rotas_em is null
        and coalesce(i.total, 0) > 0
        and coalesce(u.prontas, 0) >= coalesce(i.total, 0))
                                                   as aguardando_lancamento
   where exists (select 1 from terminais_ok);
$$;

comment on function public.plt_fn_dash_dia(date) is
  'Visão do dia (SESSAO-16): concluídas no dia (= chegou ao terminal final), média das mesmas 4 semanas, danificados do dia e pedidos completos aguardando lançamento. Vazio para quem não mede os terminais (D-32).';

-- ----------------------------------------------------------------------------
-- 4 · Produção por hora — o gráfico de barras do andon, com a linha de média
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_dash_producao_hora(
  p_dia date default null
)
returns table (
  hora        integer,
  concluidas  integer,
  media_4sem  numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with setores_ok as (
    select sd as id from plt_privado.fn_setores_dashboard() sd
  ),
  terminais_ok as (
    select s.id from public.plt_setores s
     where s.papel_no_fluxo = 'terminal'
       and s.id in (select id from setores_ok)
  ),
  alvo as (
    select coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date) as dia
  ),
  chegadas as (
    select distinct on (e.card_id, ((e.ocorrido_em at time zone 'America/Fortaleza')::date))
           e.card_id,
           (e.ocorrido_em at time zone 'America/Fortaleza')::date          as dia_local,
           extract(hour from e.ocorrido_em at time zone 'America/Fortaleza')::int as hora_local
      from public.plt_eventos e
      join public.plt_cards c on c.id = e.card_id and c.tipo = 'unidade'
     where e.tipo = 'movimentacao_setor'
       and e.setor_destino_id in (select id from terminais_ok)
  )
  select h.hora,
         coalesce(hoje.qtd, 0)                as concluidas,
         round(coalesce(ref.qtd, 0) / 4.0, 2) as media_4sem
    from generate_series(0, 23) as h(hora)
    left join lateral (
      select count(*)::int as qtd from chegadas ch
       where ch.dia_local = (select dia from alvo) and ch.hora_local = h.hora
    ) hoje on true
    left join lateral (
      select count(*)::int as qtd from chegadas ch
       where ch.hora_local = h.hora
         and ch.dia_local in ((select dia from alvo) - 7, (select dia from alvo) - 14,
                              (select dia from alvo) - 21, (select dia from alvo) - 28)
    ) ref on true
   where exists (select 1 from terminais_ok)
   order by h.hora;
$$;

comment on function public.plt_fn_dash_producao_hora(date) is
  'Visão do dia (SESSAO-16): unidades concluídas por hora do dia, com a média das mesmas 4 semanas anteriores por hora. Vazio para quem não mede os terminais (D-32).';

-- ----------------------------------------------------------------------------
-- 5 · Fim de linha do dia — para onde as unidades foram
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_dash_fim_de_linha(
  p_dia date default null
)
returns table (
  destino     text,
  quantidade  integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with setores_ok as (
    select sd as id from plt_privado.fn_setores_dashboard() sd
  ),
  dia as (
    select (coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date)::timestamp
            at time zone 'America/Fortaleza') as ini
  ),
  -- o destino da unidade no dia é o ÚLTIMO terminal aonde ela chegou (lançar
  -- para ROTAS move ESTOQUE → ROTAS; contar as duas chegadas duplicaria)
  ultima_chegada as (
    select distinct on (e.card_id)
           e.card_id, s.codigo
      from public.plt_eventos e
      join public.plt_cards c   on c.id = e.card_id and c.tipo = 'unidade'
      join public.plt_setores s on s.id = e.setor_destino_id
                               and s.papel_no_fluxo = 'terminal'
     where e.tipo = 'movimentacao_setor'
       and e.setor_destino_id in (select id from setores_ok)
       and e.ocorrido_em >= (select ini from dia)
       and e.ocorrido_em <  (select ini from dia) + interval '1 day'
     order by e.card_id, e.ocorrido_em desc, e.id desc
  )
  select u.codigo       as destino,
         count(*)::int  as quantidade
    from ultima_chegada u
   group by u.codigo
  union all
  select 'danificado',
         count(distinct e.card_id)::int
    from public.plt_eventos e
    join public.plt_etapas et on et.id = e.etapa_destino_id and et.eh_danificado
   where e.tipo in ('movimentacao_etapa', 'movimentacao_setor')
     and e.setor_destino_id in (select id from setores_ok)
     and e.ocorrido_em >= (select ini from dia)
     and e.ocorrido_em <  (select ini from dia) + interval '1 day'
  having count(*) > 0;
$$;

comment on function public.plt_fn_dash_fim_de_linha(date) is
  'Visão do dia (SESSAO-16): destinos das unidades no dia — ROTAS, ESTOQUE (só os terminais que o usuário mede) e chegadas em DANIFICADO. Gate por setor do dashboard (D-32).';

-- ----------------------------------------------------------------------------
-- 6 · Danificados do dia, nomeados — o subtítulo do herói 🔴
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_dash_danificados_dia(
  p_dia date default null
)
returns table (
  setor_origem_nome  text,
  setor_destino_nome text,
  quantidade         integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with setores_ok as (
    select sd as id from plt_privado.fn_setores_dashboard() sd
  ),
  dia as (
    select (coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date)::timestamp
            at time zone 'America/Fortaleza') as ini
  )
  select so.nome        as setor_origem_nome,
         sd2.nome       as setor_destino_nome,
         count(*)::int  as quantidade
    from public.plt_vw_qualidade_transicoes q
    join public.plt_setores so  on so.id  = q.setor_origem_id
    join public.plt_setores sd2 on sd2.id = q.setor_destino_id
   where coalesce(q.estado_recebedor, q.estado_remetente) = 'danificado'
     and (q.setor_origem_id in (select id from setores_ok)
          or q.setor_destino_id in (select id from setores_ok))
     and q.marcado_em >= (select ini from dia)
     and q.marcado_em <  (select ini from dia) + interval '1 day'
   group by so.nome, sd2.nome
   order by quantidade desc;
$$;

comment on function public.plt_fn_dash_danificados_dia(date) is
  'Visão do dia (SESSAO-16/D-09): as transições do dia cujo estado efetivo (parecer, ou a marcação sem parecer) foi danificado, nomeadas por origem → destino. Gate por setor do dashboard.';

-- ----------------------------------------------------------------------------
-- 7 · Danificados EM ABERTO agora — a lista da tela de Qualidade
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_dash_danificados_abertos()
returns table (
  setor_id        bigint,
  setor_nome      text,
  item_descricao  text,
  quantidade      integer,
  mais_antigo     interval
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.id                              as setor_id,
         s.nome                            as setor_nome,
         coalesce(c.item_descricao, 'Peça sem descrição') as item_descricao,
         count(*)::int                     as quantidade,
         max(now() - c.desde)              as mais_antigo
    from public.plt_cards c
    join public.plt_etapas et on et.id = c.etapa_atual_id and et.eh_danificado
    join public.plt_setores s on s.id = c.setor_atual_id
   where c.tipo = 'unidade'
     and c.arquivado_em is null
     and c.setor_atual_id in (select plt_privado.fn_setores_dashboard())
   group by s.id, s.nome, coalesce(c.item_descricao, 'Peça sem descrição')
   order by max(c.desde) asc;
$$;

comment on function public.plt_fn_dash_danificados_abertos() is
  'Qualidade (SESSAO-16/D-09): o que está na etapa DANIFICADO agora, por setor e peça. Resolver/arquivar vive na Logística → Danificados; aqui é só o retrato. Gate por setor do dashboard.';

-- ----------------------------------------------------------------------------
-- 8 · Tendência semanal — tempo total (fila + execução, útil) por unidade
--     concluída na semana. Como o número é a JORNADA INTEIRA do card por vários
--     setores, só quem mede a fábrica toda recebe (na prática: admin) — um
--     líder de um setor não pode deduzir o tempo dos outros a partir dele.
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_dash_tendencia_semanas(
  p_semanas integer default 6
)
returns table (
  semana_inicio date,
  unidades      integer,
  media_total   interval
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with alcance as (
    -- fábrica inteira: nenhum setor ativo fora do que este usuário mede
    select not exists (
      select 1 from public.plt_setores s
       where s.ativo
         and s.id not in (select plt_privado.fn_setores_dashboard())
    ) as completo
  ),
  semanas as (
    select date_trunc('week', (now() at time zone 'America/Fortaleza'))::date
           - (n * 7) as inicio
      from generate_series(0, greatest(least(coalesce(p_semanas, 6), 26), 1) - 1) as n
  ),
  concluidos as (
    -- a PRIMEIRA chegada de cada unidade a um terminal define a semana dela
    select c.id as card_id,
           min((e.ocorrido_em at time zone 'America/Fortaleza'))::date as chegou_dia
      from public.plt_cards c
      join public.plt_eventos e on e.card_id = c.id and e.tipo = 'movimentacao_setor'
      join public.plt_setores s on s.id = e.setor_destino_id and s.papel_no_fluxo = 'terminal'
     where c.tipo = 'unidade'
     group by c.id
  ),
  jornadas as (
    select co.card_id,
           date_trunc('week', co.chegou_dia)::date as semana,
           (select coalesce(sum(plt_privado.fn_tempo_util(pm.entrou_em, pm.saiu_em, pm.setor_id, null)), interval '0')
              from public.plt_vw_permanencias pm
             where pm.card_id = co.card_id and pm.eh_fila and pm.saiu_em is not null)
           + (select coalesce(sum(plt_privado.fn_tempo_util(v.iniciou_em, v.finalizou_em, v.setor_id, v.usuario_inicio_id)), interval '0')
                from public.plt_vw_execucoes v
               where v.card_id = co.card_id and v.finalizou_em is not null)
           as total_util
      from concluidos co
     where date_trunc('week', co.chegou_dia)::date in (select inicio from semanas)
  )
  select w.inicio                          as semana_inicio,
         count(j.card_id)::int             as unidades,
         avg(j.total_util)                 as media_total
    from semanas w
    left join jornadas j on j.semana = w.inicio
   where (select completo from alcance)
   group by w.inicio
   order by w.inicio;
$$;

comment on function public.plt_fn_dash_tendencia_semanas(integer) is
  'Tempo por setor (SESSAO-16/D-02): média semanal do tempo total útil (fila + execução) por unidade concluída na semana. Só para quem mede a fábrica inteira — a jornada cruza todos os setores.';

-- ----------------------------------------------------------------------------
-- 9 · Quem executa o quê (E-11)
-- ----------------------------------------------------------------------------
revoke all on function public.plt_fn_dash_agora()                        from public, anon;
revoke all on function public.plt_fn_dash_pcp_dia(date)                  from public, anon;
revoke all on function public.plt_fn_dash_dia(date)                      from public, anon;
revoke all on function public.plt_fn_dash_producao_hora(date)            from public, anon;
revoke all on function public.plt_fn_dash_fim_de_linha(date)             from public, anon;
revoke all on function public.plt_fn_dash_danificados_dia(date)          from public, anon;
revoke all on function public.plt_fn_dash_danificados_abertos()          from public, anon;
revoke all on function public.plt_fn_dash_tendencia_semanas(integer)     from public, anon;

grant execute on function public.plt_fn_dash_agora()                     to authenticated;
grant execute on function public.plt_fn_dash_pcp_dia(date)               to authenticated;
grant execute on function public.plt_fn_dash_dia(date)                   to authenticated;
grant execute on function public.plt_fn_dash_producao_hora(date)         to authenticated;
grant execute on function public.plt_fn_dash_fim_de_linha(date)          to authenticated;
grant execute on function public.plt_fn_dash_danificados_dia(date)       to authenticated;
grant execute on function public.plt_fn_dash_danificados_abertos()       to authenticated;
grant execute on function public.plt_fn_dash_tendencia_semanas(integer)  to authenticated;
