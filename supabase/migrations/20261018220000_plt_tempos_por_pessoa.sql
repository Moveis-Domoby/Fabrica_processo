-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 97 — TABLET 2.0, parte 3:
-- A DASHBOARD DE TEMPOS POR PESSOA (SESSAO-36 · D-146 resposta 12)
--
-- Duas portas de leitura:
--   plt_fn_tempos_pessoas         — um scorecard por pessoa (estado de agora +
--                                   produção/ausente/à deriva no período), lendo
--                                   SÓ o agregado diário e o segmento aberto
--                                   (nunca varre eventos — Lei §7.1);
--   plt_fn_tempos_pessoa_detalhe  — o detalhe de UMA pessoa, no clique: dia a
--                                   dia, por setor e os cards do período (estes
--                                   saem das views de execução/auxílio — leitura
--                                   pequena, só sob demanda).
--
-- Quem vê (resposta 12): líderes e admins veem todo mundo; o funcionário vê só
-- o próprio. Dias no fuso de America/Fortaleza.
-- Nada aqui toca as tabelas da integração. Idempotente.
-- ============================================================================

set local lock_timeout = '5s';

-- o viewer vê todo mundo? (admin, papel líder ou líder de algum setor)
create or replace function plt_privado.fn_tempos_ve_todos()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select plt_privado.fn_eh_admin()
      or exists (select 1 from public.plt_usuarios u
                  where u.id = plt_privado.fn_usuario_atual() and u.papel = 'lider')
      or exists (select 1 from public.plt_usuario_setores us
                  where us.usuario_id = plt_privado.fn_usuario_atual() and us.lider_do_setor);
$$;

revoke all on function plt_privado.fn_tempos_ve_todos() from public, anon, authenticated;

-- o que o segmento ABERTO da pessoa soma dentro do período (o agregado só tem
-- o fechado); ausente/deriva com o mesmo teto de 12 h do fechamento
create or replace function plt_privado.fn_tempos_aberto(
  p_usuario uuid, p_de timestamptz, p_ate timestamptz
)
returns table (estado text, setor_id bigint, segundos bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.estado, s.setor_id,
         greatest(0, floor(extract(epoch from
           least(coalesce(case when s.estado in ('ausente', 'deriva')
                               then least(now(), s.inicio + interval '12 hours')
                               else now() end, now()), p_ate)
           - greatest(s.inicio, p_de))))::bigint
    from public.plt_presenca_segmentos s
   where s.usuario_id = p_usuario and s.fim is null
     and s.inicio < p_ate;
$$;

revoke all on function plt_privado.fn_tempos_aberto(uuid, timestamptz, timestamptz) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- O scorecard por pessoa
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_tempos_pessoas(
  p_de           date default null,   -- dia inicial (Fortaleza); nulo = hoje − 6
  p_ate          date default null,   -- dia final; nulo = hoje
  p_limite       integer default 50,
  p_deslocamento integer default 0
)
returns table (
  usuario_id    uuid,
  nome          text,
  foto_caminho  text,
  papel         text,
  estado        text,         -- trabalhando · ausente · deriva · nulo (fora)
  estado_desde  timestamptz,
  estado_setor_id bigint,
  producao_s    bigint,
  ausente_s     bigint,
  deriva_s      bigint,
  por_setor     jsonb,        -- [{setor_id, nome, segundos}] da produção
  contagem_total integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu       uuid := plt_privado.fn_usuario_atual();
  v_todos    boolean;
  v_de       date;
  v_ate      date;
  v_de_ts    timestamptz;
  v_ate_ts   timestamptz;
  v_limite   integer := least(greatest(coalesce(p_limite, 50), 1), 100);
  v_desloc   integer := greatest(coalesce(p_deslocamento, 0), 0);
begin
  if v_eu is null then
    raise exception 'Entre na plataforma primeiro.' using errcode = 'insufficient_privilege';
  end if;
  v_todos := plt_privado.fn_tempos_ve_todos();
  v_ate := coalesce(p_ate, (now() at time zone 'America/Fortaleza')::date);
  v_de  := coalesce(p_de, v_ate - 6);
  if v_de > v_ate then
    raise exception 'O começo do período vem antes do fim.' using errcode = 'check_violation';
  end if;
  if v_ate - v_de > 92 then
    raise exception 'O período da dashboard vai até 3 meses por vez.' using errcode = 'check_violation';
  end if;
  v_de_ts  := (v_de::timestamp at time zone 'America/Fortaleza');
  v_ate_ts := ((v_ate + 1)::timestamp at time zone 'America/Fortaleza');

  return query
  with pessoas as (
    select u.id, u.nome, u.foto_caminho, u.papel,
           count(*) over ()::integer as total
      from public.plt_usuarios u
     where u.ativo and not u.conta_tablet
       and (v_todos or u.id = v_eu)
     order by u.nome, u.id
     limit v_limite offset v_desloc
  ),
  fechado as (
    select t.usuario_id, t.estado, t.setor_id, sum(t.segundos)::bigint as segundos
      from public.plt_tempos_pessoa_dia t
      join pessoas p on p.id = t.usuario_id
     where t.dia between v_de and v_ate
     group by 1, 2, 3
  ),
  aberto as (
    select p.id as usuario_id, a.estado, a.setor_id, a.segundos
      from pessoas p
      cross join lateral plt_privado.fn_tempos_aberto(p.id, v_de_ts, v_ate_ts) a
     where a.segundos > 0
  ),
  tudo as (
    select * from fechado
    union all
    select * from aberto
  ),
  somas as (
    select t.usuario_id,
           coalesce(sum(t.segundos) filter (where t.estado = 'trabalhando'), 0)::bigint as producao_s,
           coalesce(sum(t.segundos) filter (where t.estado = 'ausente'), 0)::bigint as ausente_s,
           coalesce(sum(t.segundos) filter (where t.estado = 'deriva'), 0)::bigint as deriva_s
      from tudo t
     group by 1
  ),
  setores as (
    select t.usuario_id,
           jsonb_agg(jsonb_build_object('setor_id', t.setor_id, 'nome', s.nome, 'segundos', t.seg)
                     order by t.seg desc) as por_setor
      from (select t2.usuario_id, t2.setor_id, sum(t2.segundos)::bigint as seg
              from tudo t2
             where t2.estado = 'trabalhando' and t2.setor_id is not null
             group by 1, 2) t
      join public.plt_setores s on s.id = t.setor_id
     group by 1
  )
  select p.id, p.nome, p.foto_caminho, p.papel,
         seg.estado, seg.inicio, seg.setor_id,
         coalesce(so.producao_s, 0), coalesce(so.ausente_s, 0), coalesce(so.deriva_s, 0),
         coalesce(st.por_setor, '[]'::jsonb),
         p.total
    from pessoas p
    left join public.plt_presenca_segmentos seg
           on seg.usuario_id = p.id and seg.fim is null
    left join somas so on so.usuario_id = p.id
    left join setores st on st.usuario_id = p.id
   order by p.nome, p.id;
end;
$$;

comment on function public.plt_fn_tempos_pessoas(date, date, integer, integer) is
  'SESSAO-36 (D-146 resp. 12): o scorecard de tempos por pessoa — estado de agora + produção/ausente/à deriva no período, do agregado diário (nunca varre eventos). Líder/admin veem todos; o funcionário só o próprio. Lista limitada (as pessoas da casa) — deslocamento justificado.';

-- ----------------------------------------------------------------------------
-- O detalhe de UMA pessoa (no clique do scorecard)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_tempos_pessoa_detalhe(
  p_usuario uuid,
  p_de      date default null,
  p_ate     date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu     uuid := plt_privado.fn_usuario_atual();
  v_de     date;
  v_ate    date;
  v_de_ts  timestamptz;
  v_ate_ts timestamptz;
begin
  if v_eu is null then
    raise exception 'Entre na plataforma primeiro.' using errcode = 'insufficient_privilege';
  end if;
  if p_usuario is distinct from v_eu and not plt_privado.fn_tempos_ve_todos() then
    raise exception 'Cada um vê o próprio tempo; o de todos é visão da liderança.' using errcode = 'insufficient_privilege';
  end if;
  v_ate := coalesce(p_ate, (now() at time zone 'America/Fortaleza')::date);
  v_de  := coalesce(p_de, v_ate - 6);
  if v_de > v_ate or v_ate - v_de > 92 then
    raise exception 'Período inválido (até 3 meses por vez).' using errcode = 'check_violation';
  end if;
  v_de_ts  := (v_de::timestamp at time zone 'America/Fortaleza');
  v_ate_ts := ((v_ate + 1)::timestamp at time zone 'America/Fortaleza');

  return jsonb_build_object(
    'usuario', (select jsonb_build_object('id', u.id, 'nome', u.nome, 'foto_caminho', u.foto_caminho, 'papel', u.papel)
                  from public.plt_usuarios u where u.id = p_usuario),
    'estado', (select jsonb_build_object('estado', s.estado, 'desde', s.inicio, 'setor_id', s.setor_id)
                 from public.plt_presenca_segmentos s
                where s.usuario_id = p_usuario and s.fim is null),
    'dias', coalesce((
      select jsonb_agg(jsonb_build_object('dia', d.dia,
               'producao_s', d.producao_s, 'ausente_s', d.ausente_s, 'deriva_s', d.deriva_s)
             order by d.dia)
        from (select t.dia,
                     coalesce(sum(t.segundos) filter (where t.estado = 'trabalhando'), 0)::bigint as producao_s,
                     coalesce(sum(t.segundos) filter (where t.estado = 'ausente'), 0)::bigint as ausente_s,
                     coalesce(sum(t.segundos) filter (where t.estado = 'deriva'), 0)::bigint as deriva_s
                from public.plt_tempos_pessoa_dia t
               where t.usuario_id = p_usuario and t.dia between v_de and v_ate
               group by t.dia) d), '[]'::jsonb),
    'aberto', coalesce((
      select jsonb_agg(jsonb_build_object('estado', a.estado, 'setor_id', a.setor_id, 'segundos', a.segundos))
        from plt_privado.fn_tempos_aberto(p_usuario, v_de_ts, v_ate_ts) a
       where a.segundos > 0), '[]'::jsonb),
    'por_setor', coalesce((
      select jsonb_agg(jsonb_build_object('setor_id', x.setor_id, 'nome', s.nome, 'segundos', x.seg)
             order by x.seg desc)
        from (select t.setor_id, sum(t.segundos)::bigint as seg
                from public.plt_tempos_pessoa_dia t
               where t.usuario_id = p_usuario and t.dia between v_de and v_ate
                 and t.estado = 'trabalhando' and t.setor_id is not null
               group by t.setor_id) x
        join public.plt_setores s on s.id = x.setor_id), '[]'::jsonb),
    -- os cards do período (leitura pequena, só no clique): execuções fechadas
    -- e auxílios da pessoa, com setor e duração
    'execucoes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'card_id', v.card_id, 'setor_id', v.setor_id, 'etapa_id', v.etapa_id,
               'iniciou_em', v.iniciou_em, 'finalizou_em', v.finalizou_em,
               'em_andamento', v.em_andamento,
               'segundos', floor(extract(epoch from v.duracao))::bigint,
               'rotulo', plt_privado.fn_card_rotulo(v.card_id))
             order by v.iniciou_em desc)
        from (select * from public.plt_vw_execucoes vv
               where vv.usuario_inicio_id = p_usuario
                 and vv.iniciou_em < v_ate_ts
                 and coalesce(vv.finalizou_em, now()) >= v_de_ts
               order by vv.iniciou_em desc limit 100) v), '[]'::jsonb),
    'auxilios', coalesce((
      select jsonb_agg(jsonb_build_object(
               'card_id', a.card_id, 'setor_id', a.setor_id,
               'iniciado_em', a.iniciado_em, 'encerrado_em', a.encerrado_em,
               'segundos', a.segundos + case when a.ultimo_inicio is null then 0
                 else greatest(0, floor(extract(epoch from now() - a.ultimo_inicio)))::bigint end,
               'rotulo', plt_privado.fn_card_rotulo(a.card_id))
             order by a.iniciado_em desc)
        from (select * from public.plt_auxilios aa
               where aa.usuario_id = p_usuario
                 and aa.iniciado_em < v_ate_ts
                 and coalesce(aa.encerrado_em, now()) >= v_de_ts
               order by aa.iniciado_em desc limit 100) a), '[]'::jsonb)
  );
end;
$$;

comment on function public.plt_fn_tempos_pessoa_detalhe(uuid, date, date) is
  'SESSAO-36: o detalhe da pessoa na dashboard de tempos — dia a dia e por setor do agregado; os cards (execuções e auxílios) só no clique. O próprio, ou líder/admin.';

revoke all on function public.plt_fn_tempos_pessoas(date, date, integer, integer) from public, anon;
revoke all on function public.plt_fn_tempos_pessoa_detalhe(uuid, date, date) from public, anon;
grant execute on function public.plt_fn_tempos_pessoas(date, date, integer, integer) to authenticated;
grant execute on function public.plt_fn_tempos_pessoa_detalhe(uuid, date, date) to authenticated;

-- ----------------------------------------------------------------------------
-- O liga/desliga "pode auxiliar" (D-146 resposta 7) é gesto de ADMIN, com
-- trilha — por porta própria (a coluna não ganha update direto: o grant por
-- coluna não distingue a própria linha, e ninguém se autopromove).
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_usuario_pode_auxiliar(p_usuario uuid, p_pode boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not plt_privado.fn_eh_admin() then
    raise exception 'Permitir auxiliar em outros setores é gesto de admin.' using errcode = 'insufficient_privilege';
  end if;
  update public.plt_usuarios
     set pode_auxiliar = coalesce(p_pode, false)
   where id = p_usuario and not conta_tablet;
  if not found then
    raise exception 'Pessoa não encontrada.' using errcode = 'no_data_found';
  end if;
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (plt_privado.fn_usuario_atual(), 'pode_auxiliar_alterado',
            jsonb_build_object('usuario_id', p_usuario, 'pode', coalesce(p_pode, false)));
end;
$$;

revoke all on function public.plt_fn_usuario_pode_auxiliar(uuid, boolean) from public, anon;
grant execute on function public.plt_fn_usuario_pode_auxiliar(uuid, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- A FOTO nos painéis que mostram gente (D-146 — "foto em todos os ícones"):
-- o painel Pessoas e a produção do pedido passam a trazer a foto — a tela
-- nunca faz uma segunda consulta para isso (Lei §2).
-- ----------------------------------------------------------------------------

-- plt_fn_dash_tempos_pessoa — recriada a partir da versão viva (migration das
-- filas/pausa), com UMA coluna a mais: a foto. Muda a forma → drop + create
-- (A-12) e os grants refeitos.
drop function if exists public.plt_fn_dash_tempos_pessoa(timestamptz, timestamptz, bigint);
create function public.plt_fn_dash_tempos_pessoa(
  p_de       timestamptz,
  p_ate      timestamptz,
  p_setor_id bigint default null
)
returns table (
  usuario_id     uuid,
  usuario_nome   text,
  matricula      text,
  foto_caminho   text,
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
         u.foto_caminho,
         count(*)::int                         as execucoes,
         count(distinct v.card_id)::int        as cards_atendidos,
         sum((cl.fim - cl.ini) - pz.bruta)     as tempo_bruto,
         sum(plt_privado.fn_tempo_util(cl.ini, cl.fim, v.setor_id, v.usuario_inicio_id) - pz.util)
                                               as tempo_util
    from public.plt_vw_execucoes v
    join public.plt_usuarios u on u.id = v.usuario_inicio_id
    cross join lateral (
      select greatest(v.iniciou_em, p_de) as ini,
             least(coalesce(v.finalizou_em, now()), p_ate) as fim
    ) cl
    cross join lateral (
      select coalesce(sum(px.fim - px.ini), interval '0') as bruta,
             coalesce(sum(plt_privado.fn_tempo_util(px.ini, px.fim, v.setor_id, v.usuario_inicio_id)), interval '0') as util
        from plt_privado.fn_pausas_execucao(v.evento_inicio_id, cl.ini, cl.fim) px
    ) pz
   where v.setor_id in (select plt_privado.fn_setores_dashboard())
     and (p_setor_id is null or v.setor_id = p_setor_id)
     and cl.fim > cl.ini
   group by u.id, u.nome, u.matricula, u.foto_caminho
   order by tempo_util desc nulls last;
$$;

revoke all on function public.plt_fn_dash_tempos_pessoa(timestamptz, timestamptz, bigint) from public, anon;
grant execute on function public.plt_fn_dash_tempos_pessoa(timestamptz, timestamptz, bigint) to authenticated;

-- plt_fn_pedido_producao — recriada a partir da versão viva (migration da área
-- Pedidos), com a FOTO nas execuções e no resumo por pessoa (jsonb: chaves a
-- mais, mesma forma — o site publicado não quebra).
create or replace function public.plt_fn_pedido_producao(p_pedido_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_card_pedido bigint;
  v_ids         bigint[];
  v_resultado   jsonb;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'A produção do pedido é da logística (PCP, fins de linha) e do admin.'
      using errcode = 'insufficient_privilege';
  end if;

  select c.id into v_card_pedido from public.plt_cards c where c.pedido_id = p_pedido_id and c.tipo = 'pedido';
  -- As peças do pedido — também as que o cancelamento deixou sem dono (card_pai).
  select coalesce(array_agg(c.id order by c.item_seq, c.indice_unidade, c.id), '{}')
    into v_ids
    from public.plt_cards c
   where c.tipo = 'unidade'
     and (c.pedido_id = p_pedido_id or (v_card_pedido is not null and c.card_pai_id = v_card_pedido));

  with execucoes as (
    select x.card_id, x.iniciou_em, x.finalizou_em, x.em_andamento,
           extract(epoch from coalesce(x.duracao, interval '0'))::bigint     as segundos,
           extract(epoch from coalesce(x.pausa_total, interval '0'))::bigint as pausa_segundos,
           s.nome as setor, e.nome as etapa,
           coalesce(ui.nome, uf.nome) as pessoa,
           -- SESSAO-36: a foto de quem trabalhou (D-146)
           coalesce(ui.foto_caminho, uf.foto_caminho) as foto,
           coalesce(x.usuario_inicio_id, x.usuario_fim_id) as pessoa_id
      from public.plt_vw_execucoes x
      left join public.plt_setores s on s.id = x.setor_id
      left join public.plt_etapas  e on e.id = x.etapa_id
      left join public.plt_usuarios ui on ui.id = x.usuario_inicio_id
      left join public.plt_usuarios uf on uf.id = x.usuario_fim_id
     where x.card_id = any(v_ids)
  ),
  saidas as (
    select distinct on (ev.card_id) ev.card_id, ev.dados ->> 'motivo' as motivo
      from public.plt_eventos ev
     where ev.card_id = any(v_ids) and ev.tipo = 'card_arquivado'
     order by ev.card_id, ev.id desc
  ),
  pecas as (
    select c.id, c.item_seq, c.item_codigo, c.item_descricao, c.indice_unidade, c.total_unidades,
           c.concluido_em, c.arquivado_em, c.qualidade_atual, c.pedido_id is null as perdeu_pedido,
           s.nome as setor, s.papel_no_fluxo, e.nome as etapa, c.desde, sa.motivo as motivo_saida,
           coalesce((select jsonb_agg(jsonb_build_object(
                       'setor', x.setor, 'etapa', x.etapa, 'pessoa', x.pessoa, 'foto', x.foto,
                       'iniciou_em', x.iniciou_em, 'finalizou_em', x.finalizou_em,
                       'em_andamento', x.em_andamento, 'segundos', x.segundos,
                       'pausa_segundos', x.pausa_segundos) order by x.iniciou_em)
                       from execucoes x where x.card_id = c.id), '[]'::jsonb) as execucoes,
           coalesce((select sum(x.segundos) from execucoes x where x.card_id = c.id), 0)::bigint as segundos
      from public.plt_cards c
      left join public.plt_setores s on s.id = c.setor_atual_id
      left join public.plt_etapas  e on e.id = c.etapa_atual_id
      left join saidas sa on sa.card_id = c.id
     where c.id = any(v_ids)
  )
  select jsonb_build_object(
    'pecas', coalesce((select jsonb_agg(jsonb_build_object(
                'card_id', p.id, 'item_seq', p.item_seq, 'codigo', p.item_codigo,
                'descricao', p.item_descricao, 'indice', p.indice_unidade, 'total', p.total_unidades,
                'setor', p.setor, 'etapa', p.etapa, 'no_fim_de_linha', p.papel_no_fluxo = 'terminal',
                'desde', p.desde, 'concluido_em', p.concluido_em, 'arquivado_em', p.arquivado_em,
                'motivo_saida', p.motivo_saida, 'qualidade', p.qualidade_atual,
                'perdeu_pedido', p.perdeu_pedido, 'segundos', p.segundos, 'execucoes', p.execucoes)
              order by p.item_seq, p.indice_unidade, p.id) from pecas p), '[]'::jsonb),
    'pessoas', coalesce((select jsonb_agg(jsonb_build_object('nome', t.pessoa, 'foto', t.foto,
                                                             'segundos', t.segundos,
                                                             'execucoes', t.execucoes)
                                          order by t.segundos desc)
                           from (select x.pessoa, max(x.foto) as foto,
                                        sum(x.segundos)::bigint as segundos, count(*)::int as execucoes
                                   from execucoes x where x.pessoa is not null group by x.pessoa) t), '[]'::jsonb),
    'segundos', coalesce((select sum(x.segundos) from execucoes x), 0)::bigint
  ) into v_resultado;
  return v_resultado;
end;
$$;

comment on function public.plt_fn_pedido_producao(bigint) is
  'D-134 (14/10): a produção do pedido, no clique — cada peça, onde está ou como saiu, e cada execução (setor, etapa, quem, tempo com pausas descontadas); o resumo por pessoa e o total. SESSAO-36 (D-146): com a FOTO de quem trabalhou. Gate da logística.';
