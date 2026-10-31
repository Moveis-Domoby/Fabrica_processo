-- ============================================================================
-- SESSAO-42 · F4 (31/10/2026) — OS RELÓGIOS DE HOJE NO CÁLCULO ÚNICO.
--
-- O mesmo móvel tem de mostrar o mesmo tempo no card, na janela, em Pessoas,
-- em Tempos por pessoa e em Meu desempenho; nenhum dia-pessoa passa da jornada
-- sem hora extra; nada de fn_tempo_util por linha a cada abertura (Lei §7.1).
-- Todas as portas abaixo mantêm a ASSINATURA e o FORMATO da resposta (o site
-- de antes segue funcionando) e trocam só a fonte: as projeções do cálculo
-- único (trechos, passagens, resumos). O que está RODANDO agora soma na
-- leitura (fn_tempo_trecho_agora_s — as janelas até agora ou o corte, dividido
-- pelos trechos abertos da pessoa).
--
--   · plt_fn_tempos_pessoas / plt_fn_tempos_pessoa_detalhe (Tempos por pessoa):
--     trabalhando = o esforço dos trechos (cada minuto uma vez só); ausente,
--     especial e à deriva só dentro das janelas (plt_tempo_resumo_pessoa_dia).
--   · plt_fn_dash_tempos_pessoa / plt_fn_dash_execucoes (Pessoas), plt_fn_meu_
--     desempenho (Meu desempenho), plt_fn_metas_painel (meta de tempo útil):
--     dos trechos.
--   · plt_fn_dash_tempos_setor / _item / plt_fn_dash_tendencia_semanas (Tempo
--     por setor — fica no ar até a SESSAO-43 absorvê-la): das passagens.
--   · fn_quadro_junto (+ 'tempos' — o card do quadro) e plt_fn_card_janela
--     (+ 'tempo' — a janela): o tempo do móvel no setor, já fechado, e de
--     quando o trecho aberto começou (o aparelho soma o vivo pela régua).
--   · plt_fn_card_historico (nova): os fatos + as passagens e os trechos do
--     card — "Tempo e histórico" numa requisição, com os números do banco.
--   · A Visão do dia não tinha relógio de execução (só contagens) — não muda.
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · O que um trecho vale AGORA (o fechado vem pronto; o aberto, até agora
--     ou o corte, nas janelas, dividido pelos trechos abertos da pessoa)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tempo_trecho_agora_s(p_t public.plt_tempo_trechos)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when p_t.descartado then 0
    when p_t.fim is not null then p_t.segundos
    else plt_privado.fn_tempo_segundos(plt_privado.fn_tempo_janelas(
           p_t.setor_id, p_t.inicio,
           greatest(p_t.inicio, least(now(), coalesce(p_t.corte, 'infinity'::timestamptz))), p_t.usuario_id))
         / greatest(1, (select count(*) from public.plt_tempo_trechos x
                         where x.usuario_id = p_t.usuario_id and x.fim is null and not x.descartado))
  end;
$$;
comment on function plt_privado.fn_tempo_trecho_agora_s(public.plt_tempo_trechos) is
  'SESSAO-42 (F4): os segundos que um trecho vale agora — o fechado, o que o cálculo gravou; o aberto, as janelas do início até agora (ou o corte do fim do expediente), dividido pelos trechos abertos da pessoa (regra 6).';
revoke all on function plt_privado.fn_tempo_trecho_agora_s(public.plt_tempo_trechos) from public, anon, authenticated;

-- os estados da pessoa por dia (o resumo, desdobrado)
create or replace function plt_privado.fn_tempo_pessoa_estados(p_usuario uuid, p_de date, p_ate date)
returns table (dia date, estado text, setor_id bigint, segundos bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select r.dia, x.estado, r.setor_id, floor(x.s)::bigint
    from public.plt_tempo_resumo_pessoa_dia r
    cross join lateral (values ('trabalhando', r.trabalhando_s), ('ausente', r.ausente_s),
                               ('deriva', r.deriva_s), ('especial', r.especial_s)) as x(estado, s)
   where r.usuario_id = p_usuario and r.dia between p_de and p_ate and x.s > 0;
$$;
revoke all on function plt_privado.fn_tempo_pessoa_estados(uuid, date, date) from public, anon, authenticated;

-- o trabalho da pessoa por card e setor no período (execução e auxílio), com o
-- parado e os motivos da pausa da PESSOA (plt_pessoa_pausas, útil guardado)
create or replace function plt_privado.fn_tempo_trabalho_da_pessoa(p_usuario uuid, p_de date, p_ate date)
returns table (passagem_id bigint, card_id bigint, setor_id bigint, etapa_id bigint, auxiliar boolean,
               iniciou_em timestamptz, finalizou_em timestamptz, em_andamento boolean, segundos bigint,
               pausado_s bigint, motivos jsonb, especial_s bigint, motivos_especiais jsonb, motivo_aberto text,
               especial_aberto boolean)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with t as (
    select t.*, plt_privado.fn_tempo_trecho_agora_s(t) as s
      from public.plt_tempo_trechos t
     where t.usuario_id = p_usuario and t.dia between p_de and p_ate and not t.descartado
  ),
  g as (
    select t.passagem_id, t.card_id, t.setor_id, max(t.etapa_id) as etapa_id, bool_and(t.papel = 'auxilio') as auxiliar,
           min(t.inicio) as ini, case when bool_or(t.fim is null) then null else max(t.fim) end as fim,
           bool_or(t.fim is null) as andamento, floor(sum(t.s))::bigint as seg
      from t
     group by t.passagem_id, t.card_id, t.setor_id
  )
  select g.passagem_id, g.card_id, g.setor_id, g.etapa_id, g.auxiliar, g.ini, g.fim, g.andamento, g.seg,
         pz.pausado_s, pz.motivos, pz.especial_s, pz.motivos_especiais, pz.motivo_aberto, pz.especial_aberto
    from g
    cross join lateral (
      select coalesce(floor(sum(coalesce(pp.segundos_uteis, extract(epoch from now() - pp.inicio)))), 0)::bigint as pausado_s,
             coalesce(jsonb_agg(distinct coalesce(nullif(e.dados ->> 'motivo', ''), m.texto))
                        filter (where coalesce(nullif(e.dados ->> 'motivo', ''), m.texto) is not null), '[]'::jsonb) as motivos,
             coalesce(floor(sum(coalesce(pp.segundos_uteis, extract(epoch from now() - pp.inicio))) filter (where pp.especial)), 0)::bigint as especial_s,
             coalesce(jsonb_agg(distinct m.texto) filter (where pp.especial and m.texto is not null), '[]'::jsonb) as motivos_especiais,
             max(coalesce(nullif(e.dados ->> 'motivo', ''), m.texto)) filter (where pp.fim is null) as motivo_aberto,
             coalesce(bool_or(pp.especial) filter (where pp.fim is null), false) as especial_aberto
        from public.plt_pessoa_pausas pp
        left join public.plt_eventos e on e.id = pp.evento_id
        left join public.plt_motivos m on m.id = pp.motivo_id
       where pp.usuario_id = p_usuario and pp.card_id = g.card_id
         and pp.inicio >= g.ini and pp.inicio < coalesce(g.fim, now())
         and (pp.setor_id is null or pp.setor_id = g.setor_id)
    ) pz;
$$;
comment on function plt_privado.fn_tempo_trabalho_da_pessoa(uuid, date, date) is
  'SESSAO-42 (F4): o trabalho de uma pessoa no período, por card e setor (a passagem) — o esforço (trechos divididos, o aberto até agora), se foi só auxílio, de quando a quando, e o parado dela no card com os motivos (o especial à parte).';
revoke all on function plt_privado.fn_tempo_trabalho_da_pessoa(uuid, date, date) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2 · fn_tempos_aberto — mesma assinatura; o trecho de presença ABERTO só nas
--     janelas (o "trabalhando" dele vem dos trechos rodando, já divididos)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tempos_aberto(
  p_usuario uuid, p_de timestamptz, p_ate timestamptz
)
returns table (estado text, setor_id bigint, segundos bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select pt.estado,
         s.setor_id,
         floor(plt_privado.fn_tempo_segundos(case when s.setor_id is null
                 then plt_privado.fn_tempo_janelas_fabrica(w.a, w.b, p_usuario)
                 else plt_privado.fn_tempo_janelas(s.setor_id, w.a, w.b, p_usuario) end))::bigint
    from public.plt_presenca_segmentos s
   cross join lateral plt_privado.fn_presenca_partes(s.estado, s.especial, s.carencia, s.inicio, now()) pt
   cross join lateral (select greatest(pt.inicio, p_de) as a, least(pt.fim, p_ate) as b) w
   where s.usuario_id = p_usuario and s.fim is null and s.estado <> 'trabalhando'
     and w.b > w.a
  union all
  select 'trabalhando', t.setor_id, floor(plt_privado.fn_tempo_trecho_agora_s(t))::bigint
    from public.plt_tempo_trechos t
   where t.usuario_id = p_usuario and t.fim is null and not t.descartado
     and t.inicio < p_ate and t.inicio >= p_de;
$$;
comment on function plt_privado.fn_tempos_aberto(uuid, timestamptz, timestamptz) is
  'SESSAO-41 ↪️ SESSAO-42: o que está ABERTO agora na conta da pessoa — a presença (ausente, carência, especial, à deriva) só dentro das janelas, e os trechos rodando (o trabalhando, já dividido). O fechado vem do resumo por dia.';

-- ----------------------------------------------------------------------------
-- 3 · Tempos por pessoa — recriada da versão viva (20261027010000_plt_tablet_presenca_pin.sql): o resumo e o
--     trabalho por card do cálculo único
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.plt_fn_tempos_pessoas(p_de date DEFAULT NULL::date, p_ate date DEFAULT NULL::date, p_limite integer DEFAULT 50, p_deslocamento integer DEFAULT 0)
 RETURNS TABLE(usuario_id uuid, nome text, foto_caminho text, papel text, estado text, estado_desde timestamp with time zone, estado_setor_id bigint, producao_s bigint, ausente_s bigint, deriva_s bigint, por_setor jsonb, contagem_total integer, especial_s bigint, estado_especial boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    -- SESSAO-42: o resumo do cálculo único (trabalhando = esforço; o resto só nas janelas)
    select t.usuario_id, t.estado, t.setor_id, sum(t.segundos)::bigint as segundos
      from pessoas p
      cross join lateral (select p.id as usuario_id, e.estado, e.setor_id, e.segundos
                            from plt_privado.fn_tempo_pessoa_estados(p.id, v_de, v_ate) e) t
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
           coalesce(sum(t.segundos) filter (where t.estado = 'deriva'), 0)::bigint as deriva_s,
           coalesce(sum(t.segundos) filter (where t.estado = 'especial'), 0)::bigint as especial_s
      from tudo t
     group by 1
  ),
  -- a produção por MÓVEL (execuções e auxílios da pessoa no período, com o
  -- tempo parado e os motivos) — tudo clipado ao período
  -- SESSAO-42: a produção por MÓVEL do cálculo único (o esforço por card e
  -- setor, com o parado e os motivos da pessoa)
  cards_tudo as (
    select p.id as usuario_id, w.setor_id, w.card_id, w.segundos, w.pausado_s, w.em_andamento, w.auxiliar,
           w.motivos, w.especial_s, w.motivos_especiais
      from pessoas p
      cross join lateral plt_privado.fn_tempo_trabalho_da_pessoa(p.id, v_de, v_ate) w
  ),
  cards_por_setor as (
    select c.usuario_id, c.setor_id,
           jsonb_agg(jsonb_build_object(
             'card_id', c.card_id,
             'rotulo', plt_privado.fn_card_rotulo(c.card_id),
             'segundos', c.segundos, 'pausado_s', c.pausado_s,
             'em_andamento', c.em_andamento, 'auxiliar', c.auxiliar,
             'motivos', c.motivos,
             -- SESSAO-38: o "não conta" só para quem vê todos
             'especial_s', case when v_todos then c.especial_s else 0 end,
             'motivos_especiais', case when v_todos then c.motivos_especiais else '[]'::jsonb end)
           order by c.segundos desc) as cards
      from (select ct.*, row_number() over (partition by ct.usuario_id order by ct.segundos desc) as n
              from cards_tudo ct) c
     where c.n <= 30  -- teto do card da pessoa; o resto vive no detalhe
     group by 1, 2
  ),
  setores as (
    select t.usuario_id,
           jsonb_agg(jsonb_build_object(
             'setor_id', t.setor_id, 'nome', s.nome,
             'producao_s', t.producao_s, 'ausente_s', t.ausente_s,
             'especial_s', case when v_todos then t.especial_s else 0 end,
             'cards', coalesce(cs.cards, '[]'::jsonb))
           order by t.producao_s desc, t.ausente_s desc) as por_setor
      from (select t2.usuario_id, t2.setor_id,
                   coalesce(sum(t2.segundos) filter (where t2.estado = 'trabalhando'), 0)::bigint as producao_s,
                   coalesce(sum(t2.segundos) filter (where t2.estado = 'ausente'), 0)::bigint as ausente_s,
                   coalesce(sum(t2.segundos) filter (where t2.estado = 'especial'), 0)::bigint as especial_s
              from tudo t2
             where t2.setor_id is not null
             group by 1, 2) t
      join public.plt_setores s on s.id = t.setor_id
      left join cards_por_setor cs on cs.usuario_id = t.usuario_id and cs.setor_id = t.setor_id
     group by 1
  )
  select p.id, p.nome, p.foto_caminho, p.papel,
         plt_privado.fn_presenca_estado_efetivo(seg.estado, seg.carencia, seg.inicio, now()),
         case when plt_privado.fn_presenca_estado_efetivo(seg.estado, seg.carencia, seg.inicio, now()) is not null then seg.inicio end,
         case when plt_privado.fn_presenca_estado_efetivo(seg.estado, seg.carencia, seg.inicio, now()) is not null then seg.setor_id end,
         coalesce(so.producao_s, 0), coalesce(so.ausente_s, 0), coalesce(so.deriva_s, 0),
         coalesce(st.por_setor, '[]'::jsonb),
         p.total,
         case when v_todos then coalesce(so.especial_s, 0) else 0 end,
         v_todos and coalesce(seg.especial, false) and plt_privado.fn_presenca_estado_efetivo(seg.estado, seg.carencia, seg.inicio, now()) is not distinct from 'ausente'
    from pessoas p
    left join public.plt_presenca_segmentos seg
           on seg.usuario_id = p.id and seg.fim is null
    left join somas so on so.usuario_id = p.id
    left join setores st on st.usuario_id = p.id
   order by p.nome, p.id;
end;
$function$;

-- ----------------------------------------------------------------------------
-- 4 · O detalhe da pessoa — recriado da versão viva (20261027010000_plt_tablet_presenca_pin.sql)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.plt_fn_tempos_pessoa_detalhe(p_usuario uuid, p_de date DEFAULT NULL::date, p_ate date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_eu     uuid := plt_privado.fn_usuario_atual();
  v_todos  boolean;
  v_de     date;
  v_ate    date;
  v_de_ts  timestamptz;
  v_ate_ts timestamptz;
begin
  if v_eu is null then
    raise exception 'Entre na plataforma primeiro.' using errcode = 'insufficient_privilege';
  end if;
  v_todos := plt_privado.fn_tempos_ve_todos();
  if p_usuario is distinct from v_eu and not v_todos then
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
    'estado', (select jsonb_build_object('estado', ef.estado, 'desde', s.inicio, 'setor_id', s.setor_id,
                                         'especial', v_todos and s.especial and ef.estado = 'ausente')
                 from public.plt_presenca_segmentos s
                 cross join lateral (select plt_privado.fn_presenca_estado_efetivo(s.estado, s.carencia, s.inicio, now()) as estado) ef
                where s.usuario_id = p_usuario and s.fim is null and ef.estado is not null),
    'dias', coalesce((
      select jsonb_agg(jsonb_build_object('dia', d.dia,
               'producao_s', d.producao_s, 'ausente_s', d.ausente_s, 'deriva_s', d.deriva_s,
               'especial_s', case when v_todos then d.especial_s else 0 end)
             order by d.dia)
        from (select t.dia,
                     coalesce(sum(t.segundos) filter (where t.estado = 'trabalhando'), 0)::bigint as producao_s,
                     coalesce(sum(t.segundos) filter (where t.estado = 'ausente'), 0)::bigint as ausente_s,
                     coalesce(sum(t.segundos) filter (where t.estado = 'deriva'), 0)::bigint as deriva_s,
                     coalesce(sum(t.segundos) filter (where t.estado = 'especial'), 0)::bigint as especial_s
                from plt_privado.fn_tempo_pessoa_estados(p_usuario, v_de, v_ate) t
               group by t.dia) d), '[]'::jsonb),
    'aberto', coalesce((
      select jsonb_agg(jsonb_build_object('estado', a.estado, 'setor_id', a.setor_id, 'segundos', a.segundos))
        from plt_privado.fn_tempos_aberto(p_usuario, v_de_ts, v_ate_ts) a
       where a.segundos > 0 and (v_todos or a.estado <> 'especial')), '[]'::jsonb),
    -- por setor: produção × ausente (agregado + trecho aberto) + o especial à parte
    'por_setor', coalesce((
      select jsonb_agg(jsonb_build_object('setor_id', x.setor_id, 'nome', s.nome,
               'producao_s', x.producao_s, 'ausente_s', x.ausente_s,
               'especial_s', case when v_todos then x.especial_s else 0 end)
             order by x.producao_s desc, x.ausente_s desc)
        from (select t.setor_id,
                     coalesce(sum(t.segundos) filter (where t.estado = 'trabalhando'), 0)::bigint as producao_s,
                     coalesce(sum(t.segundos) filter (where t.estado = 'ausente'), 0)::bigint as ausente_s,
                     coalesce(sum(t.segundos) filter (where t.estado = 'especial'), 0)::bigint as especial_s
                from (select d.estado, d.setor_id, d.segundos
                        from plt_privado.fn_tempo_pessoa_estados(p_usuario, v_de, v_ate) d
                      union all
                      select a.estado, a.setor_id, a.segundos
                        from plt_privado.fn_tempos_aberto(p_usuario, v_de_ts, v_ate_ts) a
                       where a.segundos > 0) t
               where t.setor_id is not null
               group by t.setor_id) x
        join public.plt_setores s on s.id = x.setor_id), '[]'::jsonb),
    -- os cards do período: execuções com o tempo parado e os motivos
    -- SESSAO-42: os cards do período pelo cálculo único (o esforço por card e
    -- setor, com o parado e os motivos da pessoa)
    'execucoes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'card_id', w.card_id, 'setor_id', w.setor_id, 'etapa_id', w.etapa_id,
               'setor', (select s.nome from public.plt_setores s where s.id = w.setor_id),
               'iniciou_em', w.iniciou_em, 'finalizou_em', w.finalizou_em,
               'em_andamento', w.em_andamento,
               'segundos', w.segundos, 'pausado_s', w.pausado_s, 'motivos', w.motivos,
               'especial_s', case when v_todos then w.especial_s else 0 end,
               'motivos_especiais', case when v_todos then w.motivos_especiais else '[]'::jsonb end,
               'rotulo', plt_privado.fn_card_rotulo(w.card_id))
             order by w.iniciou_em desc)
        from (select * from plt_privado.fn_tempo_trabalho_da_pessoa(p_usuario, v_de, v_ate) x
               where not x.auxiliar order by x.iniciou_em desc limit 100) w), '[]'::jsonb),
    'auxilios', coalesce((
      select jsonb_agg(jsonb_build_object(
               'card_id', w.card_id, 'setor_id', w.setor_id,
               'setor', (select s.nome from public.plt_setores s where s.id = w.setor_id),
               'iniciado_em', w.iniciou_em, 'encerrado_em', w.finalizou_em,
               'segundos', w.segundos,
               'motivo', w.motivo_aberto,
               'motivo_especial', v_todos and w.especial_aberto,
               'rotulo', plt_privado.fn_card_rotulo(w.card_id))
             order by w.iniciou_em desc)
        from (select * from plt_privado.fn_tempo_trabalho_da_pessoa(p_usuario, v_de, v_ate) x
               where x.auxiliar order by x.iniciou_em desc limit 100) w), '[]'::jsonb)
  );
end;
$function$;

-- ----------------------------------------------------------------------------
-- 5 · PESSOAS (dashboard da liderança) — mesma assinatura; dos trechos
--     tempo_bruto = o relógio até o corte; tempo_util = o esforço (dividido)
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
  select u.id                                   as usuario_id,
         u.nome                                 as usuario_nome,
         u.matricula,
         u.foto_caminho,
         count(distinct t.passagem_id)::int     as execucoes,
         count(distinct t.card_id)::int         as cards_atendidos,
         make_interval(secs => sum(extract(epoch from
           greatest(t.inicio, least(coalesce(t.fim, now()), coalesce(t.corte, 'infinity'::timestamptz))) - t.inicio))::double precision)
                                                as tempo_bruto,
         make_interval(secs => sum(plt_privado.fn_tempo_trecho_agora_s(t))::double precision)
                                                as tempo_util
    from public.plt_tempo_trechos t
    join public.plt_usuarios u on u.id = t.usuario_id
    join public.plt_tempo_passagens ps on ps.id = t.passagem_id
   where t.setor_id in (select plt_privado.fn_setores_dashboard())
     and (p_setor_id is null or t.setor_id = p_setor_id)
     and t.inicio >= p_de and t.inicio < p_ate
     and not t.descartado and ps.situacao <> 'descartada'
   group by u.id, u.nome, u.matricula, u.foto_caminho
   order by tempo_util desc nulls last;
$$;
comment on function public.plt_fn_dash_tempos_pessoa(timestamptz, timestamptz, bigint) is
  'SESSAO-42 (F4): Pessoas — por pessoa, nos setores que quem pergunta vê: passagens em que trabalhou, cards, o relógio até o corte (bruto) e o ESFORÇO do cálculo único (útil — dividido, o aberto até agora).';

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
  select t.inicio_evento_id,
         t.card_id,
         p.numero                          as pedido_numero,
         c.item_codigo,
         c.item_descricao,
         c.indice_unidade,
         c.total_unidades,
         t.setor_id,
         s.nome                            as setor_nome,
         e.nome                            as etapa_nome,
         ui.nome                           as executor_nome,
         uf.nome                           as finalizador_nome,
         t.inicio                          as iniciou_em,
         t.fim                             as finalizou_em,
         t.fim is null                     as em_andamento,
         case t.fim_tipo when 'finalizado' then 'finalizada' when 'transferencia' then 'transferencia'
                         when 'pausa' then 'pausa' when 'fim_expediente' then 'fim_expediente'
                         when 'sem_resposta' then 'sem_resposta' when 'esquecido' then 'pausa'
                         else 'movimentacao' end as encerramento,
         greatest(t.inicio, least(coalesce(t.fim, now()), coalesce(t.corte, 'infinity'::timestamptz))) - t.inicio
                                           as duracao_bruta,
         make_interval(secs => plt_privado.fn_tempo_trecho_agora_s(t)::double precision) as duracao_util,
         count(*) over ()                  as contagem_total
    from public.plt_tempo_trechos t
    join public.plt_cards c on c.id = t.card_id
    left join public.pedidos p on p.id = c.pedido_id
    left join public.plt_setores s on s.id = t.setor_id
    left join public.plt_etapas  e on e.id = t.etapa_id
    left join public.plt_usuarios ui on ui.id = t.usuario_id
    left join public.plt_eventos fe on fe.id = t.fim_evento_id
    left join public.plt_usuarios uf on uf.id = fe.usuario_id
   where t.papel = 'execucao' and not t.descartado
     and t.setor_id in (select plt_privado.fn_setores_dashboard())
     and (p_setor_id is null or t.setor_id = p_setor_id)
     and (p_usuario_id is null or t.usuario_id = p_usuario_id)
     and t.inicio >= p_de and t.inicio < p_ate
   order by t.inicio desc
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;
comment on function public.plt_fn_dash_execucoes(timestamptz, timestamptz, bigint, uuid, integer, integer) is
  'SESSAO-42 (F4): as execuções (os trechos de execução do cálculo único — o clique errado fica de fora), da mais nova; útil = o esforço (dividido, o aberto até agora); o encerramento diz como o trecho terminou (inclusive o fim do expediente).';

-- ----------------------------------------------------------------------------
-- 6 · MEU DESEMPENHO — mesma assinatura; a execução dos trechos da pessoa
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_meu_desempenho(
  p_de  timestamptz,
  p_ate timestamptz
)
returns table (
  execucoes            integer,
  execucoes_finalizadas integer,
  tempo_execucao       interval,
  media_execucao       interval,
  cards_distintos      integer,
  tarefas_concluidas   integer,
  tempo_afazeres       interval,
  pareceres_dados      integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with eu as (
    select plt_privado.fn_usuario_atual() as id
  ),
  exec as (
    select count(distinct t.passagem_id)::int as execucoes,
           count(distinct t.passagem_id) filter (where ps.desfecho = 'concluida')::int as finalizadas,
           make_interval(secs => coalesce(sum(plt_privado.fn_tempo_trecho_agora_s(t)), 0)::double precision) as tempo,
           count(distinct t.card_id)::int as cards
      from public.plt_tempo_trechos t
      join public.plt_tempo_passagens ps on ps.id = t.passagem_id, eu
     where eu.id is not null
       and t.usuario_id = eu.id and not t.descartado and ps.situacao <> 'descartada'
       and t.inicio >= p_de
       and t.inicio <  p_ate
  ),
  tar as (
    select count(*) filter (where t.concluida_em >= p_de and t.concluida_em < p_ate)::int as concluidas,
           coalesce(sum(
             t.tempo_acumulado
               + case when t.iniciada_em is not null
                      then coalesce(t.concluida_em, now()) - t.iniciada_em
                      else interval '0' end
           ) filter (where coalesce(t.iniciada_em, t.concluida_em, t.atualizado_em) >= p_de
                       and coalesce(t.iniciada_em, t.concluida_em, t.atualizado_em) <  p_ate
                       and (t.iniciada_em is not null or t.tempo_acumulado > interval '0')),
             interval '0') as tempo
      from public.plt_tarefas t, eu
     where eu.id is not null
       and t.responsavel_id = eu.id
  ),
  par as (
    select count(*)::int as dados
      from public.plt_eventos e, eu
     where eu.id is not null
       and e.tipo = 'qualidade_parecer'
       and e.usuario_id = eu.id
       and e.ocorrido_em >= p_de
       and e.ocorrido_em <  p_ate
  )
  select exec.execucoes,
         exec.finalizadas,
         exec.tempo,
         case when exec.execucoes > 0 then exec.tempo / exec.execucoes end as media_execucao,
         exec.cards,
         tar.concluidas,
         tar.tempo,
         par.dados
    from exec, tar, par
   where (select id from eu) is not null;
$$;

-- ----------------------------------------------------------------------------
-- 7 · TEMPO POR SETOR (até a SESSAO-43 absorver) — mesmas assinaturas; das
--     passagens que SAÍRAM do setor no período (o dia é o da saída)
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
  with r as (
    select x.setor_id,
           sum(x.fila_s) as fila_s, sum(x.execucao_s) as exec_s, sum(x.execucao_validas_s) as validas_s,
           sum(x.n_total)::int as n, sum(x.n_validas)::int as validas
      from public.plt_tempo_resumo_modelo_dia x
     where x.dia between (p_de at time zone 'America/Fortaleza')::date and (p_ate at time zone 'America/Fortaleza')::date
       and x.setor_id in (select plt_privado.fn_setores_dashboard())
     group by x.setor_id
  )
  select s.id, s.nome,
         make_interval(secs => coalesce(r.fila_s, 0)::double precision),
         make_interval(secs => coalesce(r.fila_s, 0)::double precision),
         make_interval(secs => coalesce(r.exec_s, 0)::double precision),
         make_interval(secs => coalesce(r.validas_s, 0)::double precision),
         make_interval(secs => (coalesce(r.fila_s, 0) + coalesce(r.validas_s, 0))::double precision),
         coalesce(r.n, 0), coalesce(r.validas, 0)
    from public.plt_setores s
    left join r on r.setor_id = s.id
   where s.id in (select plt_privado.fn_setores_dashboard())
     and s.ativo
   order by s.ordem, s.id;
$$;
comment on function public.plt_fn_dash_tempos_setor(timestamptz, timestamptz) is
  'SESSAO-42 (F4): Tempo por setor do cálculo único — das passagens que saíram no período: fila útil, tempo do móvel de todas (bruta) e das VÁLIDAS (útil), passagens e válidas (no lugar de "finalizadas"). Fica no ar até a SESSAO-43 absorver a tela.';

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
         count(distinct ps.card_id)::int       as unidades,
         make_interval(secs => sum(ps.execucao_s)::double precision) as tempo_util,
         make_interval(secs => (sum(ps.execucao_s) / greatest(count(distinct ps.card_id), 1))::double precision)
                                               as media_por_unidade
    from public.plt_tempo_passagens ps
    join public.plt_cards c on c.id = ps.card_id
   where ps.setor_id in (select plt_privado.fn_setores_dashboard())
     and ps.dia between (p_de at time zone 'America/Fortaleza')::date and (p_ate at time zone 'America/Fortaleza')::date
     and ps.situacao = 'valida'
     -- SESSAO-31 (D-125): o card avulso não é item de produto
     and c.tipo <> 'avulso'
   group by c.item_codigo
   order by tempo_util desc nulls last;
$$;

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
    -- a PRIMEIRA chegada ao fim de linha vinda de fora dos terminais (S24)
    select c.id as card_id,
           min((e.ocorrido_em at time zone 'America/Fortaleza'))::date as chegou_dia
      from public.plt_cards c
      join public.plt_eventos e on e.card_id = c.id and e.tipo = 'movimentacao_setor'
      join public.plt_setores s on s.id = e.setor_destino_id and s.papel_no_fluxo = 'terminal'
      left join public.plt_setores so on so.id = e.setor_origem_id
     where c.tipo = 'unidade'
       and coalesce(so.papel_no_fluxo, '') <> 'terminal'
       and e.ocorrido_em >= (select min(sm.inicio) from semanas sm)::timestamp at time zone 'America/Fortaleza'
     group by c.id
  ),
  jornadas as (
    -- SESSAO-42: a jornada do móvel pelo cálculo único (fila + tempo do móvel de cada setor)
    select co.card_id,
           date_trunc('week', co.chegou_dia)::date as semana,
           (select coalesce(sum(ps.fila_s + ps.execucao_s), 0) from public.plt_tempo_passagens ps
             where ps.card_id = co.card_id and ps.saida_em is not null and ps.situacao <> 'teste') as total_s
      from concluidos co
     where date_trunc('week', co.chegou_dia)::date in (select inicio from semanas)
  )
  select w.inicio                          as semana_inicio,
         count(j.card_id)::int             as unidades,
         make_interval(secs => avg(j.total_s)::double precision) as media_total
    from semanas w
    left join jornadas j on j.semana = w.inicio
   where (select completo from alcance)
   group by w.inicio
   order by w.inicio;
$$;

-- ----------------------------------------------------------------------------
-- 8 · "TEMPO E HISTÓRICO" numa requisição: os fatos (a porta de sempre) + as
--     passagens e os trechos do card (os números do banco)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_card_historico(p_card_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not plt_privado.fn_pode_ver_card(p_card_id) then
    raise exception 'Você não vê este card.' using errcode = 'insufficient_privilege';
  end if;
  return jsonb_build_object(
    'eventos', coalesce((select jsonb_agg(to_jsonb(x)) from public.plt_fn_linha_tempo_card(p_card_id) x), '[]'::jsonb),
    'passagens', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', ps.id, 'setor_id', ps.setor_id, 'entrada_em', ps.entrada_em, 'saida_em', ps.saida_em,
               'fila_s', round(ps.fila_s), 'execucao_s', round(ps.execucao_s), 'execucao_fechada_s', round(ps.execucao_fechada_s),
               'parado_s', round(ps.parado_s), 'total_s', round(ps.total_s), 'esforco_s', round(ps.esforco_s),
               'situacao', ps.situacao, 'motivo', ps.motivo, 'desfecho', ps.desfecho, 'lote', ps.lote,
               'modelo', m.nome)
             order by ps.entrada_em)
        from public.plt_tempo_passagens ps
        left join public.plt_tempo_modelos m on m.id = ps.modelo_id
       where ps.card_id = p_card_id), '[]'::jsonb),
    'trechos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.inicio_evento_id, 'passagem_id', t.passagem_id, 'usuario_id', t.usuario_id, 'papel', t.papel,
               'inicio', t.inicio, 'fim', t.fim, 'fim_tipo', t.fim_tipo, 'corte', t.corte,
               'segundos', round(t.segundos), 'util_s', round(t.util_s), 'descartado', t.descartado)
             order by t.inicio)
        from public.plt_tempo_trechos t
       where t.card_id = p_card_id), '[]'::jsonb));
end;
$$;
comment on function public.plt_fn_card_historico(bigint) is
  'SESSAO-42 (F4): "Tempo e histórico" do card numa requisição — os fatos (a porta plt_fn_linha_tempo_card, com a permissão dela) e as passagens e os trechos do cálculo único (fila, tempo do móvel, parado, situação; cada trecho com o corte e o descarte).';
revoke all on function public.plt_fn_card_historico(bigint) from public, anon;
grant execute on function public.plt_fn_card_historico(bigint) to authenticated;

-- ----------------------------------------------------------------------------
-- 9 · As metas — recriada da versão viva (20261014150000_plt_card_avulso.sql): a meta de tempo útil pelo esforço
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_metas_painel(
  p_incluir_encerradas boolean default false,
  p_limite             integer default 20,
  p_deslocamento       integer default 0
)
returns table (
  meta_id         bigint,
  titulo          text,
  indicador       text,
  periodo         text,
  alvo            numeric,
  usuario_id      uuid,
  usuario_nome    text,
  setor_id        bigint,
  setor_nome      text,
  etapa_id        bigint,
  etapa_nome      text,
  criada_por_id   uuid,
  criada_por_nome text,
  encerrada_em    timestamptz,
  janela_inicio   timestamptz,
  janela_fim      timestamptz,
  progresso       numeric,
  contagem_total  bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with eu as (
    select plt_privado.fn_usuario_atual() as id
  ),
  visiveis as (
    select m.*
      from public.plt_metas m
     where plt_privado.fn_eh_admin()
        or m.usuario_id = (select id from eu)
        or m.setor_id in (select plt_privado.fn_setores_do_usuario())
        or m.criada_por_id = (select id from eu)
        or (m.usuario_id is not null and exists (
              select 1 from public.plt_usuario_setores us
               where us.usuario_id = m.usuario_id
                 and plt_privado.fn_eh_lider_de(us.setor_id)))
  )
  select m.id                                   as meta_id,
         m.titulo,
         m.indicador,
         m.periodo,
         m.alvo,
         m.usuario_id,
         du.nome                                as usuario_nome,
         m.setor_id,
         ds.nome                                as setor_nome,
         m.etapa_id,
         de.nome                                as etapa_nome,
         m.criada_por_id,
         cr.nome                                as criada_por_nome,
         m.encerrada_em,
         j.inicio                               as janela_inicio,
         j.fim                                  as janela_fim,
         pr.progresso,
         count(*) over ()                       as contagem_total
    from visiveis m
    left join public.plt_usuarios du on du.id = m.usuario_id
    left join public.plt_setores  ds on ds.id = m.setor_id
    left join public.plt_etapas   de on de.id = m.etapa_id
    left join public.plt_usuarios cr on cr.id = m.criada_por_id
    cross join lateral (
      select case m.periodo
               when 'diaria'  then date_trunc('day',   now() at time zone 'America/Fortaleza')
               when 'semanal' then date_trunc('week',  now() at time zone 'America/Fortaleza')
               else                date_trunc('month', now() at time zone 'America/Fortaleza')
             end as ini_local
    ) jl
    cross join lateral (
      select jl.ini_local at time zone 'America/Fortaleza' as inicio,
             (jl.ini_local + case m.periodo
                               when 'diaria'  then interval '1 day'
                               when 'semanal' then interval '7 days'
                               else                interval '1 month'
                             end) at time zone 'America/Fortaleza' as fim
    ) j
    cross join lateral (
      select case m.indicador
        -- unidades = execuções ENCERRADAS na janela; com etapa mirada (D-45),
        -- só as daquela etapa
        when 'unidades' then coalesce((
          select count(*)::numeric
            from public.plt_vw_execucoes v
           where v.finalizou_em >= j.inicio and v.finalizou_em < j.fim
             and (m.etapa_id is null or v.etapa_id = m.etapa_id)
             -- SESSAO-31 (D-125): o card avulso não é unidade produzida.
             and not exists (select 1 from public.plt_cards ca where ca.id = v.card_id and ca.tipo = 'avulso')
             and ((m.usuario_id is not null and v.usuario_inicio_id = m.usuario_id)
               or (m.setor_id   is not null and v.setor_id = m.setor_id))), 0)
        when 'tarefas' then coalesce((
          select count(*)::numeric
            from public.plt_tarefas t
           where t.situacao = 'concluida'
             and t.concluida_em >= j.inicio and t.concluida_em < j.fim
             and ((m.usuario_id is not null and t.responsavel_id = m.usuario_id)
               or (m.setor_id   is not null and t.setor_id = m.setor_id))), 0)
        else coalesce((
          -- SESSAO-42: o esforço do cálculo único (trechos; o aberto até agora)
          select round((sum(plt_privado.fn_tempo_trecho_agora_s(t)) / 3600)::numeric, 2)
            from public.plt_tempo_trechos t
           where t.inicio >= j.inicio and t.inicio < j.fim and not t.descartado
             and ((m.usuario_id is not null and t.usuario_id = m.usuario_id)
               or (m.setor_id   is not null and t.setor_id = m.setor_id))), 0)
      end as progresso
    ) pr
   where (p_incluir_encerradas or m.encerrada_em is null)
   order by (m.encerrada_em is not null),
            case m.periodo when 'diaria' then 1 when 'semanal' then 2 else 3 end,
            m.criada_em desc
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

-- ----------------------------------------------------------------------------
-- 10 · O CARD (quadro e janela): o tempo do móvel no setor — o que já fechou
--      vem pronto; do trecho aberto, de quando começou, o corte e por quanto
--      ele se divide (o lote) — o aparelho soma o vivo pela régua (D-172)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tempo_card_vivo(p_card_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
           'setor_id', ps.setor_id,
           'fechado_s', round(ps.execucao_fechada_s),
           'fila_s', round(ps.fila_s),
           'desde', ab.desde,
           'corte', ab.corte,
           'dividir', greatest(1, coalesce(ab.n, 1)),
           'usuario_id', ab.usuario_id,
           'lote', ab.lote)
    from public.plt_tempo_passagens ps
    left join lateral (
      select t.inicio as desde, t.corte, t.usuario_id, t.lote,
             (select count(*) from public.plt_tempo_trechos x
               where x.usuario_id = t.usuario_id and x.fim is null and not x.descartado) as n
        from public.plt_tempo_trechos t
       where t.passagem_id = ps.id and t.fim is null and not t.descartado and t.papel = 'execucao'
       order by t.inicio desc
       limit 1
    ) ab on true
   where ps.card_id = p_card_id and ps.saida_em is null
   order by ps.entrada_em desc
   limit 1;
$$;
comment on function plt_privado.fn_tempo_card_vivo(bigint) is
  'SESSAO-42 (F4): o tempo do móvel no setor para o card e a janela — fechado_s (os trechos que já fecharam, com a divisão), e do trecho de execução aberto: desde, corte (o fim do expediente) por quanto dividir (os trechos abertos da pessoa) e o lote (o mesmo valor nos cards montados juntos). O aparelho soma útil(desde → agora, até o corte) / dividir.';
revoke all on function plt_privado.fn_tempo_card_vivo(bigint) from public, anon, authenticated;

-- fn_quadro_junto — recriada da versão viva (20261027040000_plt_rotas_endereco_data_parcial.sql) + 'tempos'
CREATE OR REPLACE FUNCTION plt_privado.fn_quadro_junto(p_ids bigint[])
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select jsonb_build_object(
    -- SESSAO-42: o tempo do móvel no setor (o fechado do cálculo único + de
    -- quando o trecho aberto começou; o aparelho soma o vivo pela régua)
    'tempos', coalesce((
      select jsonb_object_agg(ps.card_id, plt_privado.fn_tempo_card_vivo(ps.card_id))
        from public.plt_tempo_passagens ps
       where ps.card_id = any (p_ids) and ps.saida_em is null), '{}'::jsonb),
    'execucoes', coalesce((
      select jsonb_agg(jsonb_build_object('evento_inicio_id', v.evento_inicio_id, 'card_id', v.card_id,
                                          'usuario_inicio_id', v.usuario_inicio_id, 'iniciou_em', v.iniciou_em))
        from public.plt_vw_execucoes v
       where v.card_id = any (p_ids) and v.em_andamento), '[]'::jsonb),
    'auxilios', coalesce((
      select jsonb_agg(jsonb_build_object('card_id', a.card_id, 'usuario_id', a.usuario_id,
                                          'iniciado_em', a.iniciado_em, 'pausado_em', a.pausado_em,
                                          'pausa_motivo', a.pausa_motivo, 'segundos', a.segundos,
                                          'ultimo_inicio', a.ultimo_inicio))
        from public.plt_auxilios a
       where a.card_id = any (p_ids) and a.encerrado_em is null), '[]'::jsonb),
    'pessoas', coalesce((
      select jsonb_object_agg(u.id, jsonb_build_object('nome', u.nome, 'foto', u.foto_caminho))
        from public.plt_usuarios u
       where u.id in (select c.executor_atual_id from public.plt_cards c where c.id = any (p_ids)
                      union select unnest(c.responsaveis) from public.plt_cards c where c.id = any (p_ids)
                      union select unnest(c.auxiliares) from public.plt_cards c where c.id = any (p_ids)
                      union select e.usuario_id from public.plt_cards c join public.plt_eventos e on e.id = c.parecer_pendente_id
                             where c.id = any (p_ids))), '{}'::jsonb),
    'pedidos', coalesce((
      select jsonb_object_agg(p.id, jsonb_build_object(
               'pedido_id', p.id, 'numero', p.numero,
               'situacao', p.situacao, 'data_prevista', plt_privado.fn_data_entrega(p.id, p.data_prevista), 'data_pedido', p.data_pedido,
               'entrou_pcp_em', (select min(e.ocorrido_em) from public.plt_eventos e where e.card_id = pc.id and e.tipo = 'card_criado'),
               'liberado_completo_em', pc.liberado_completo_em,
               -- SESSAO-38 (D-167): o relógio do PCP do pedido desconta o stand-by
               'standby_desde', pc.standby_desde, 'standby_periodos', pc.standby_periodos))
        from public.pedidos p
        left join public.plt_cards pc on pc.pedido_id = p.id and pc.tipo = 'pedido'
       where p.id in (select c.pedido_id from public.plt_cards c where c.id = any (p_ids) and c.pedido_id is not null)), '{}'::jsonb),
    'valores', coalesce((
      select jsonb_agg(jsonb_build_object('campo_id', v.campo_id, 'card_id', v.card_id, 'valor', v.valor))
        from public.plt_campos_valores v
       where v.card_id = any (p_ids)), '[]'::jsonb)
  );
$function$;

-- plt_fn_card_janela — recriada da versão viva (20261027040000_plt_rotas_endereco_data_parcial.sql) + 'tempo'
CREATE OR REPLACE FUNCTION public.plt_fn_card_janela(p_card_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_card     public.plt_cards%rowtype;
  v_editar   boolean;
  v_pessoas  uuid[];
  v_eu       uuid := plt_privado.fn_usuario_atual();
  v_admin    boolean := plt_privado.fn_eh_admin();
  v_pcp      boolean := plt_privado.fn_pode_ver_expedicao();
  v_ids      bigint[];
  v_feitos   bigint[];
  v_planeja  boolean;
  v_setores  jsonb;
  v_pedido   public.pedidos%rowtype;
  v_prio     record;
begin
  select * into v_card from public.plt_cards where id = p_card_id;
  if not found then
    raise exception 'Card % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  if not plt_privado.fn_pode_anexar(p_card_id) then
    raise exception 'Você não vê este card.' using errcode = 'insufficient_privilege';
  end if;
  v_editar := plt_privado.fn_pode_editar_card(p_card_id);
  select * into v_pedido from public.pedidos where id = v_card.pedido_id;
  select v.prioridade, v.prioridade_herdada into v_prio from plt_privado.vw_card_ordem v where v.id = p_card_id;

  -- Os cards cuja história conta: o próprio; no card do pedido, as peças dele;
  -- na reposição, as peças que ela gerou.
  v_ids := case v_card.tipo
             when 'pedido' then coalesce((select array_agg(u.id) from public.plt_cards u
                                           where u.pedido_id = v_card.pedido_id and u.tipo = 'unidade'), '{}')
             when 'reposicao' then coalesce((select array_agg(u.id) from public.plt_cards u
                                              where u.card_pai_id = v_card.id and u.tipo = 'unidade'), '{}')
             else array[v_card.id]
           end;
  v_feitos := case when v_card.tipo in ('unidade', 'avulso') then plt_privado.fn_setores_executados(p_card_id) else '{}' end;
  -- Definir o responsável dos próximos setores (D-152): admin, PCP/logística,
  -- o líder do setor do card (o líder do setor escolhido também — linha a linha).
  v_planeja := v_card.tipo in ('unidade', 'avulso') and v_card.arquivado_em is null and v_eu is not null;

  with fatos as (
    select coalesce(e.setor_origem_id, e.setor_destino_id) as setor_id, e.tipo, e.usuario_id, min(e.ocorrido_em) as primeiro
      from public.plt_eventos e
     where e.card_id = any (v_ids)
       and e.tipo in ('execucao_iniciada', 'auxilio_iniciado')
       and e.usuario_id is not null
       and not exists (select 1 from public.plt_eventos x where x.tipo = 'estorno' and x.evento_referencia_id = e.id)
     group by 1, 2, 3
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'setor_id', s.id, 'setor_nome', s.nome, 'ordem', s.ordem,
           'executaram', coalesce((select jsonb_agg(f.usuario_id order by f.primeiro)
                                     from fatos f where f.setor_id = s.id and f.tipo = 'execucao_iniciada'), '[]'::jsonb),
           'auxiliaram', coalesce((select jsonb_agg(f.usuario_id order by f.primeiro)
                                     from fatos f where f.setor_id = s.id and f.tipo = 'auxilio_iniciado'
                                      and not exists (select 1 from fatos g where g.setor_id = s.id and g.tipo = 'execucao_iniciada'
                                                       and g.usuario_id = f.usuario_id)), '[]'::jsonb),
           'planejados', coalesce(v_card.responsaveis_setor -> s.id::text, '[]'::jsonb),
           'executado', exists (select 1 from fatos f where f.setor_id = s.id),
           'atual', s.id = v_card.setor_atual_id,
           'pode_planejar', v_planeja and not (s.id = any (v_feitos))
                            and (v_admin or v_pcp
                                 or (v_card.setor_atual_id is not null and plt_privado.fn_eh_lider_de(v_card.setor_atual_id))
                                 or plt_privado.fn_eh_lider_de(s.id))
         ) order by s.ordem, s.id), '[]'::jsonb)
    into v_setores
    from public.plt_setores s
   where s.ativo and s.papel_no_fluxo = 'producao';

  v_pessoas := array_remove(v_card.responsaveis || v_card.criado_por_id || v_card.executor_atual_id, null)
               || v_card.auxiliares
               || coalesce((select array_agg(distinct x::uuid)
                              from jsonb_array_elements(v_setores) s
                              cross join lateral jsonb_array_elements_text((s -> 'executaram') || (s -> 'auxiliaram') || (s -> 'planejados')) as t(x)),
                           '{}');

  return jsonb_build_object(
    'card', plt_privado.fn_quadro_cards(array[p_card_id]) -> 0,
    'arquivado_em', v_card.arquivado_em,
    'criado_em', v_card.criado_em,
    'setor', (select jsonb_build_object('id', s.id, 'nome', s.nome, 'codigo', s.codigo, 'papel_no_fluxo', s.papel_no_fluxo)
                from public.plt_setores s where s.id = v_card.setor_atual_id),
    'etapa', (select jsonb_build_object('id', e.id, 'nome', e.nome, 'eh_fila', e.eh_fila)
                from public.plt_etapas e where e.id = v_card.etapa_atual_id),
    'execucao', (select jsonb_build_object('usuario_id', v.usuario_inicio_id, 'iniciou_em', v.iniciou_em)
                   from public.plt_vw_execucoes v where v.card_id = p_card_id and v.em_andamento
                  order by v.iniciou_em desc limit 1),
    -- SESSAO-42: o tempo do móvel no setor pelo cálculo único
    'tempo', plt_privado.fn_tempo_card_vivo(p_card_id),
    'auxilios', coalesce((
      select jsonb_agg(jsonb_build_object('usuario_id', a.usuario_id, 'iniciado_em', a.iniciado_em,
                                          'pausado_em', a.pausado_em, 'pausa_motivo', a.pausa_motivo,
                                          'segundos', a.segundos, 'ultimo_inicio', a.ultimo_inicio)
             order by a.iniciado_em)
        from public.plt_auxilios a
       where a.card_id = p_card_id and a.encerrado_em is null), '[]'::jsonb),
    'pessoas', coalesce((select jsonb_object_agg(u.id, jsonb_build_object('nome', u.nome, 'foto', u.foto_caminho))
                           from public.plt_usuarios u where u.id = any (v_pessoas)), '{}'::jsonb),
    'pedido', case when v_pedido.id is null then null else
                jsonb_build_object('pedido_id', v_pedido.id, 'numero', v_pedido.numero,
                                   'cliente_nome', coalesce((select cl.nome from public.clientes cl where cl.id = v_pedido.cliente_id), ''),
                                   'situacao', v_pedido.situacao, 'data_prevista', plt_privado.fn_data_entrega(v_pedido.id, v_pedido.data_prevista),
                                   'data_pedido', v_pedido.data_pedido)
                -- SESSAO-38 (D-167): a entrada no PCP, a liberação e o stand-by — o
                -- "Tempo útil em PCP" do histórico
                || plt_privado.fn_pcp_tempo_do_pedido(v_pedido.id) end,
    -- SESSAO-38 (D-150): o prazo — do pedido no Tiny (início = a data do
    -- pedido, vencimento = a data de entrega do vendedor) ou, sem pedido, o
    -- digitado no card.
    'prazo', case when v_pedido.id is not null
                  then jsonb_build_object('inicio', v_pedido.data_pedido, 'vencimento', plt_privado.fn_data_entrega(v_pedido.id, v_pedido.data_prevista), 'do_pedido', true)
                  else jsonb_build_object('inicio', v_card.inicio_em, 'vencimento', v_card.vence_em, 'do_pedido', false) end,
    'prioridade', jsonb_build_object('valor', coalesce(v_prio.prioridade, 'comum'),
                                     'do_pedido', coalesce(v_prio.prioridade_herdada, false) and v_card.pedido_id is not null,
                                     'da_reposicao', coalesce(v_prio.prioridade_herdada, false) and v_card.pedido_id is null),
    'responsaveis_por_setor', v_setores,
    'campos', coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'nome', f.nome, 'tipo', f.tipo, 'opcoes', f.opcoes,
                                          'em_pecas', f.em_pecas, 'em_pedidos', f.em_pedidos, 'em_avulsos', f.em_avulsos,
                                          'arquivado_em', f.arquivado_em,
                                          'valor', (select vv.valor from public.plt_campos_valores vv
                                                     where vv.campo_id = f.id
                                                       and ((v_card.tipo = 'pedido' and vv.pedido_id = v_card.pedido_id)
                                                            or (v_card.tipo <> 'pedido' and vv.card_id = v_card.id))))
                       order by f.nome)
        from public.plt_campos f
       where f.arquivado_em is null
         and case v_card.tipo when 'avulso' then f.em_avulsos
                              when 'pedido' then f.em_pedidos
                              else f.em_pecas end), '[]'::jsonb),
    'etiquetas', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'nome', t.nome, 'cor', t.cor,
                                                               'arquivada_em', t.arquivada_em) order by t.nome)
                             from public.plt_etiquetas t), '[]'::jsonb),
    'permissoes', jsonb_build_object(
      'editar', v_editar and v_card.arquivado_em is null,
      'editar_nome', v_editar and v_card.tipo = 'avulso' and v_card.arquivado_em is null,
      'concluir', v_card.tipo = 'avulso' and v_card.arquivado_em is null
                  and (v_editar or v_card.setor_atual_id in (select plt_privado.fn_setores_do_usuario())
                       or v_admin),
      'anexar', v_card.arquivado_em is null,
      'ver_removidos', v_admin,
      'pausar', v_card.executor_atual_id is not null and v_card.pausado_em is null and v_card.arquivado_em is null
                and (v_card.executor_atual_id = v_eu or v_admin
                     or v_eu = any (v_card.auxiliares)
                     or (v_card.setor_atual_id is not null and plt_privado.fn_eh_lider_de(v_card.setor_atual_id))),
      'retomar', v_card.pausado_em is not null and v_card.arquivado_em is null
                 and (v_card.executor_atual_id = v_eu or v_admin
                      or (v_card.setor_atual_id is not null and plt_privado.fn_eh_lider_de(v_card.setor_atual_id))),
      'auxiliar', v_card.executor_atual_id is not null and v_card.arquivado_em is null
                  and v_card.concluido_em is null,
      'sair_auxilio', v_eu = any (v_card.auxiliares),
      -- SESSAO-38 (D-151): mudar a prioridade (na peça, muda a do pedido)
      'priorizar', v_card.arquivado_em is null and plt_privado.fn_pode_priorizar(p_card_id)
                   and (v_card.tipo <> 'unidade' or v_card.pedido_id is not null or v_card.card_pai_id is not null),
      -- as datas do card de pedido vêm do Tiny: não se editam aqui
      'editar_datas', v_editar and v_card.arquivado_em is null and v_pedido.id is null)
  );
end;
$function$;
