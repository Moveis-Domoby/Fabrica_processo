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
