-- ============================================================================
-- SESSAO-41 · F1 (D-189) — o tablet que não cai e a presença das pessoas pelo
-- PIN (pedido do dono, 26–27/10/2026):
--
--   * "o próprio tablet não deve deslogar nunca da conta do setor, ele deve
--     apenas deslogar as pessoas que estão dentro do setor naquele momento
--     depois do tempo informado" — a PESSOA sem nenhum card em execução em
--     nenhum setor: nos primeiros 15 min segue "trabalhando" (a carência entre
--     um card e outro); depois, AUSENTE; com 1 h, SAI do setor sozinha (o fato
--     'saida_automatica', sem motivo de lista — não entra no painel de motivos
--     de saída; o tempo depois dela não conta, nem como "fora de setor").
--   * "assim que o pin for digitado, o sistema já deve reconhecer quem é a
--     pessoa, movimentar o card e logar ela no setor" — QUALQUER gesto feito no
--     tablet com o PIN de uma pessoa a põe no setor do tablet (↩️ D-146 item 7:
--     "mover sozinho não dá entrada" segue valendo só no computador).
--
-- SEM RELÓGIO (Lei §4): os 15 min e a 1 h são DERIVADOS na leitura (o estado de
-- agora e o tempo do trecho aberto) e materializados no próximo fato da pessoa
-- (o gesto seguinte grava a saída automática no instante certo, no passado).
-- A parada DELIBERADA (a pessoa pausou, com motivo) não tem carência: ausente
-- na hora, como antes; a saída de 1 h vale para as duas.
-- Funções recriadas por EXTRAÇÃO da versão viva (pg_get_functiondef em 27/10),
-- com trocas de texto conferidas. Nada aqui altera tabela da integração.
-- ============================================================================
set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · O trecho "ausente sem card" ganha a marca da carência; o fato novo da
--     saída automática.
-- ----------------------------------------------------------------------------
alter table public.plt_presenca_segmentos add column if not exists carencia boolean not null default false;

comment on column public.plt_presenca_segmentos.carencia is
  'SESSAO-41 (D-189): o "ausente" sem card nenhum (não por pausa da pessoa) — os 15 primeiros minutos contam como trabalhando; com 1 h a pessoa sai do setor sozinha. Derivado na leitura (fn_presenca_estado_efetivo / fn_presenca_partes) — sem relógio.';

do $$
declare
  v_nome text;
begin
  for v_nome in
    select conname from pg_constraint
     where conrelid = 'public.plt_presenca_eventos'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%entrada%'
  loop
    execute format('alter table public.plt_presenca_eventos drop constraint %I', v_nome);
  end loop;
end;
$$;
alter table public.plt_presenca_eventos add constraint plt_presenca_eventos_tipo_check
  check (tipo in ('entrada', 'saida', 'saida_automatica')) not valid;
alter table public.plt_presenca_eventos validate constraint plt_presenca_eventos_tipo_check;

-- ----------------------------------------------------------------------------
-- 2 · A régua (um dono só — M-04): o estado de agora, o "desde" e as partes de
--     um trecho. SQL puro, sem SET — o planejador embute (E-65).
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_presenca_estado_efetivo(
  p_estado text, p_carencia boolean, p_inicio timestamptz, p_agora timestamptz
)
returns text
language sql
immutable
as $$
  select case
           when p_estado = 'ausente' and p_agora >= p_inicio + interval '60 minutes' then null
           when p_estado = 'ausente' and p_carencia and p_agora < p_inicio + interval '15 minutes' then 'trabalhando'
           else p_estado
         end;
$$;

comment on function plt_privado.fn_presenca_estado_efetivo(text, boolean, timestamptz, timestamptz) is
  'SESSAO-41 (D-189): o estado de AGORA de um trecho aberto — o ausente sem card é "trabalhando" nos 15 primeiros minutos; ausente (qualquer) com 1 h = fora (nulo: saiu do setor sozinho).';

create or replace function plt_privado.fn_presenca_partes(
  p_estado text, p_especial boolean, p_carencia boolean, p_inicio timestamptz, p_fim timestamptz
)
returns table (estado text, inicio timestamptz, fim timestamptz)
language sql
immutable
as $$
  select x.estado, x.inicio, x.fim
    from (
      select 'trabalhando'::text, p_inicio, p_fim
       where p_estado = 'trabalhando'
      union all
      -- à deriva: o teto de 12 h por trecho (D-146)
      select 'deriva', p_inicio, least(p_fim, p_inicio + interval '12 hours')
       where p_estado = 'deriva'
      union all
      -- a carência: os 15 primeiros minutos sem card contam como trabalhando
      select 'trabalhando', p_inicio, least(p_fim, p_inicio + interval '15 minutes')
       where p_estado = 'ausente' and p_carencia
      union all
      -- o ausente (ou o parado por motivo especial — D-165) vai até 1 h
      select case when p_especial then 'especial' else 'ausente' end,
             case when p_carencia then p_inicio + interval '15 minutes' else p_inicio end,
             least(p_fim, p_inicio + interval '60 minutes')
       where p_estado = 'ausente'
    ) as x(estado, inicio, fim)
   where x.fim > x.inicio;
$$;

comment on function plt_privado.fn_presenca_partes(text, boolean, boolean, timestamptz, timestamptz) is
  'SESSAO-41 (D-189): as partes de um trecho de presença como o tempo CONTA — trabalhando inteiro; à deriva até 12 h; o ausente sem card com os 15 primeiros minutos como trabalhando; o ausente (e o especial) até 1 h (depois, a pessoa saiu do setor). Usada ao fechar o trecho e no trecho aberto.';

revoke all on function plt_privado.fn_presenca_estado_efetivo(text, boolean, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function plt_privado.fn_presenca_partes(text, boolean, boolean, timestamptz, timestamptz) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3 · A saída automática materializada: o trecho ausente com 1 h fecha no
--     instante certo (no passado), o fato 'saida_automatica' é gravado nesse
--     instante e a pessoa deixa de estar em setor (nem "à deriva").
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_presenca_expirar(p_usuario uuid, p_agora timestamptz default now())
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_seg    public.plt_presenca_segmentos%rowtype;
  v_atual  public.plt_presenca_atual%rowtype;
  v_fim    timestamptz;
  v_parte  record;
begin
  select * into v_seg from public.plt_presenca_segmentos
   where usuario_id = p_usuario and fim is null
   for update;
  if v_seg.id is null or v_seg.estado <> 'ausente' or p_agora < v_seg.inicio + interval '60 minutes' then
    return;
  end if;
  v_fim := v_seg.inicio + interval '60 minutes';

  update public.plt_presenca_segmentos set fim = v_fim where id = v_seg.id;
  for v_parte in
    select * from plt_privado.fn_presenca_partes(v_seg.estado, v_seg.especial, v_seg.carencia, v_seg.inicio, v_fim)
  loop
    perform plt_privado.fn_tempos_dia_somar(p_usuario, v_parte.estado, v_seg.setor_id, v_parte.inicio, v_parte.fim);
  end loop;

  select * into v_atual from public.plt_presenca_atual where usuario_id = p_usuario for update;
  if v_atual.usuario_id is not null and v_atual.setor_id is not null then
    insert into public.plt_presenca_eventos (usuario_id, tipo, setor_id, motivo, origem, ocorrido_em)
      values (p_usuario, 'saida_automatica', v_atual.setor_id, '1 h sem card em execução', 'automacao', v_fim);
    delete from public.plt_presenca_atual where usuario_id = p_usuario;
    insert into public.plt_logs_atividade (usuario_id, acao, contexto)
      values (p_usuario, 'setor_saida_automatica',
              jsonb_build_object('setor_id', v_atual.setor_id, 'em', v_fim));
  end if;
  if v_seg.setor_id is not null then
    perform plt_privado.fn_avisar('setor_' || v_seg.setor_id);
  end if;
  perform plt_privado.fn_avisar('tempos');
end;
$$;

revoke all on function plt_privado.fn_presenca_expirar(uuid, timestamptz) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4 · A entrada AUTOMÁTICA: no tablet, qualquer gesto com o PIN de uma pessoa
--     a põe no setor DO TABLET; no computador, como antes (iniciar, retomar e
--     auxiliar — o líder que organiza outro quadro não "entra" nele).
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_presenca_auto_entrada()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_setor        bigint;
  v_setor_tablet bigint;
  v_eh_tablet    boolean := false;
begin
  if new.usuario_id is null then
    return null;
  end if;

  -- SESSAO-41 (D-189): a sessão é a conta de tablet de um setor e o gesto é de
  -- uma pessoa (o PIN) → a pessoa entra no setor do tablet
  select true, us.setor_id into v_eh_tablet, v_setor_tablet
    from public.plt_usuarios t
    left join public.plt_usuario_setores us on us.usuario_id = t.id
   where t.auth_user_id = (select auth.uid()) and t.conta_tablet
   limit 1;
  if coalesce(v_eh_tablet, false) then
    if v_setor_tablet is not null
       and exists (select 1 from public.plt_setores s
                    where s.id = v_setor_tablet and s.ativo and s.papel_no_fluxo = 'producao') then
      perform plt_privado.fn_presenca_entrada(new.usuario_id, v_setor_tablet, 'automacao', null);
    end if;
    return null;
  end if;

  if new.tipo not in ('execucao_iniciada', 'execucao_retomada', 'auxilio_iniciado', 'auxilio_retomado') then
    return null;
  end if;
  select c.setor_atual_id into v_setor from public.plt_cards c where c.id = new.card_id;
  if v_setor is null then
    return null;
  end if;
  if exists (select 1 from public.plt_setores s where s.id = v_setor and s.papel_no_fluxo = 'producao') then
    perform plt_privado.fn_presenca_entrada(new.usuario_id, v_setor, 'automacao', null);
  end if;
  return null;
end;
$$;

drop trigger if exists plt_eventos_zz2_presenca on public.plt_eventos;
create trigger plt_eventos_zz2_presenca
  after insert on public.plt_eventos
  for each row
  when (new.usuario_id is not null)
  execute function plt_privado.fn_presenca_auto_entrada();


-- ----------------------------------------------------------------------------
-- 5 · fn_presenca_recalcular — recriada da versão viva: expira antes, marca a
--     carência e fecha o trecho pelas partes.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION plt_privado.fn_presenca_recalcular(p_usuario uuid, p_agora timestamp with time zone DEFAULT now())
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_estado   text;
  v_setor    bigint;
  v_especial boolean := false;
  v_carencia boolean := false;
  v_parte    record;
  v_seg      public.plt_presenca_segmentos%rowtype;
  v_atual    public.plt_presenca_atual%rowtype;
begin
  if p_usuario is null then
    return;
  end if;
  if exists (select 1 from public.plt_usuarios u where u.id = p_usuario and u.conta_tablet) then
    return; -- a conta do aparelho não é uma pessoa
  end if;

  -- SESSAO-41 (D-189): 1 h ausente = saiu do setor sozinho (materializa no
  -- instante certo, antes de olhar o estado de agora)
  perform plt_privado.fn_presenca_expirar(p_usuario, p_agora);

  select c.setor_atual_id into v_setor
    from public.plt_cards c
   where c.executor_atual_id = p_usuario and c.pausado_em is null
     and c.arquivado_em is null and c.concluido_em is null
   limit 1;
  if v_setor is not null then
    v_estado := 'trabalhando';
  else
    select c.setor_atual_id into v_setor
      from public.plt_auxilios a
      join public.plt_cards c on c.id = a.card_id
     where a.usuario_id = p_usuario and a.encerrado_em is null and a.pausado_em is null
     limit 1;
    if v_setor is not null then
      v_estado := 'trabalhando';
    else
      select * into v_atual from public.plt_presenca_atual where usuario_id = p_usuario;
      if v_atual.usuario_id is not null and v_atual.setor_id is not null then
        v_estado := 'ausente';
        v_setor := v_atual.setor_id;
        -- SESSAO-38 (D-165): parada mais recente por motivo especial → não conta
        v_especial := coalesce((select h.especial from public.plt_pessoa_pausas h
                                 where h.usuario_id = p_usuario and h.fim is null
                                 order by h.inicio desc, h.id desc
                                 limit 1), false);
        -- SESSAO-41 (D-189): sem card nenhum (não é pausa da pessoa) → carência
        v_carencia := not exists (select 1 from public.plt_pessoa_pausas h
                                   where h.usuario_id = p_usuario and h.fim is null);
      elsif v_atual.usuario_id is not null then
        v_estado := 'deriva';
        v_setor := null;
      else
        v_estado := null;
      end if;
    end if;
  end if;

  select * into v_seg from public.plt_presenca_segmentos
   where usuario_id = p_usuario and fim is null
   for update;

  if v_seg.id is not null then
    if v_seg.estado = v_estado and v_seg.setor_id is not distinct from v_setor
       and v_seg.especial = v_especial and v_seg.carencia = v_carencia then
      return; -- nada mudou
    end if;
    if v_seg.inicio >= p_agora then
      -- trocas no mesmo instante (um gesto que mexe em vários cards): o
      -- segmento de duração zero sai em vez de poluir a história
      delete from public.plt_presenca_segmentos where id = v_seg.id;
    else
      update public.plt_presenca_segmentos set fim = p_agora where id = v_seg.id;
      -- SESSAO-41 (D-189): soma pelas partes (carência, teto de 1 h do ausente)
      for v_parte in
        select * from plt_privado.fn_presenca_partes(v_seg.estado, v_seg.especial, v_seg.carencia,
                                                     v_seg.inicio, p_agora)
      loop
        perform plt_privado.fn_tempos_dia_somar(p_usuario, v_parte.estado, v_seg.setor_id,
                                                v_parte.inicio, v_parte.fim);
      end loop;
    end if;
    if v_seg.setor_id is not null then
      perform plt_privado.fn_avisar('setor_' || v_seg.setor_id);
    end if;
  end if;

  if v_estado is not null then
    insert into public.plt_presenca_segmentos (usuario_id, estado, setor_id, inicio, especial, carencia)
      values (p_usuario, v_estado, v_setor, p_agora, v_especial, v_carencia);
    if v_setor is not null then
      perform plt_privado.fn_avisar('setor_' || v_setor);
    end if;
  end if;
  perform plt_privado.fn_avisar('tempos');
end;
$function$;

-- ----------------------------------------------------------------------------
-- 6 · Entrada e saída — recriadas da versão viva: expiram antes.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION plt_privado.fn_presenca_entrada(p_usuario uuid, p_setor bigint, p_origem text DEFAULT 'interface'::text, p_por uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_evento bigint;
  v_pessoa public.plt_usuarios%rowtype;
begin
  select * into v_pessoa from public.plt_usuarios u where u.id = p_usuario and u.ativo;
  if v_pessoa.id is null or v_pessoa.conta_tablet then
    return;
  end if;
  perform plt_privado.fn_presenca_expirar(p_usuario); -- SESSAO-41 (D-189)
  if not exists (select 1 from public.plt_setores s
                  where s.id = p_setor and s.ativo and s.papel_no_fluxo = 'producao') then
    raise exception 'A entrada é num setor de produção ativo.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.plt_presenca_atual a
              where a.usuario_id = p_usuario and a.setor_id = p_setor) then
    return; -- já está neste setor
  end if;

  insert into public.plt_presenca_eventos (usuario_id, tipo, setor_id, origem, por_id)
    values (p_usuario, 'entrada', p_setor, p_origem, p_por)
    returning id into v_evento;
  insert into public.plt_presenca_atual as a (usuario_id, setor_id, desde, evento_id)
    values (p_usuario, p_setor, now(), v_evento)
    on conflict (usuario_id) do update
      set setor_id = excluded.setor_id, desde = excluded.desde, evento_id = excluded.evento_id;

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (p_usuario, 'setor_entrada', jsonb_build_object('setor_id', p_setor, 'origem', p_origem));

  perform plt_privado.fn_presenca_recalcular(p_usuario);
end;
$function$;

CREATE OR REPLACE FUNCTION plt_privado.fn_presenca_saida(p_usuario uuid, p_motivo text, p_origem text DEFAULT 'interface'::text, p_por uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_atual  public.plt_presenca_atual%rowtype;
  v_evento bigint;
begin
  perform plt_privado.fn_presenca_expirar(p_usuario); -- SESSAO-41 (D-189)
  select * into v_atual from public.plt_presenca_atual where usuario_id = p_usuario for update;
  if v_atual.usuario_id is null or v_atual.setor_id is null then
    raise exception 'Esta pessoa não está em nenhum setor — não há de onde sair.' using errcode = 'check_violation';
  end if;

  insert into public.plt_presenca_eventos (usuario_id, tipo, setor_id, motivo, origem, por_id)
    values (p_usuario, 'saida', v_atual.setor_id, left(coalesce(p_motivo, ''), 200), p_origem, p_por)
    returning id into v_evento;
  update public.plt_presenca_atual
     set setor_id = null, desde = now(), evento_id = v_evento
   where usuario_id = p_usuario;

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (p_usuario, 'setor_saida',
            jsonb_build_object('setor_id', v_atual.setor_id, 'motivo', left(coalesce(p_motivo, ''), 200)));

  perform plt_privado.fn_avisar('setor_' || v_atual.setor_id);
  perform plt_privado.fn_presenca_recalcular(p_usuario);
end;
$function$;

-- ----------------------------------------------------------------------------
-- 7 · O trecho ABERTO na dashboard de tempos, pelas partes (mesma forma de
--     antes; agora pode vir em duas linhas — o trabalhando da carência e o
--     ausente —, e quem chama já soma).
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
         greatest(0, floor(extract(epoch from least(pt.fim, p_ate) - greatest(pt.inicio, p_de))))::bigint
    from public.plt_presenca_segmentos s
   cross join lateral plt_privado.fn_presenca_partes(s.estado, s.especial, s.carencia, s.inicio, now()) pt
   where s.usuario_id = p_usuario and s.fim is null
     and s.inicio < p_ate and pt.inicio < p_ate;
$$;

revoke all on function plt_privado.fn_tempos_aberto(uuid, timestamptz, timestamptz) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 8 · A dashboard de tempos — recriadas da versão viva: o estado de agora
--     pela régua (carência e saída de 1 h).
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
           coalesce(sum(t.segundos) filter (where t.estado = 'deriva'), 0)::bigint as deriva_s,
           coalesce(sum(t.segundos) filter (where t.estado = 'especial'), 0)::bigint as especial_s
      from tudo t
     group by 1
  ),
  -- a produção por MÓVEL (execuções e auxílios da pessoa no período, com o
  -- tempo parado e os motivos) — tudo clipado ao período
  cards_exec as (
    select v.usuario_inicio_id as usuario_id, v.setor_id, v.card_id,
           floor(extract(epoch from v.duracao))::bigint as segundos,
           floor(extract(epoch from coalesce(v.pausa_total, interval '0')))::bigint as pausado_s,
           v.em_andamento, false as auxiliar,
           (select coalesce(jsonb_agg(distinct e.dados ->> 'motivo')
                     filter (where nullif(e.dados ->> 'motivo', '') is not null), '[]'::jsonb)
              from public.plt_eventos e
             where e.card_id = v.card_id and e.tipo = 'execucao_pausada'
               and e.ocorrido_em >= v.iniciou_em
               and e.ocorrido_em <= coalesce(v.finalizou_em, now())) as motivos,
           -- SESSAO-38: dos intervalos pausados, os de motivo especial (marca de agora)
           (select coalesce(sum(greatest(0, floor(extract(epoch from
                     least(coalesce(r.ocorrido_em, coalesce(v.finalizou_em, now())), coalesce(v.finalizou_em, now()))
                     - p.ocorrido_em)))), 0)::bigint
              from public.plt_eventos p
              left join public.plt_eventos r on r.tipo = 'execucao_retomada' and r.evento_referencia_id = p.id
              join public.plt_motivos m
                on m.id = (case when p.dados ->> 'motivo_id' ~ '^[0-9]{1,18}$' then (p.dados ->> 'motivo_id')::bigint end)
               and m.tipo = 'pausa' and m.especial
             where p.tipo = 'execucao_pausada' and p.evento_referencia_id = v.evento_inicio_id) as especial_s,
           (select coalesce(jsonb_agg(distinct m.texto), '[]'::jsonb)
              from public.plt_eventos p
              join public.plt_motivos m
                on m.id = (case when p.dados ->> 'motivo_id' ~ '^[0-9]{1,18}$' then (p.dados ->> 'motivo_id')::bigint end)
               and m.tipo = 'pausa' and m.especial
             where p.tipo = 'execucao_pausada' and p.evento_referencia_id = v.evento_inicio_id) as motivos_especiais
      from public.plt_vw_execucoes v
      join pessoas p on p.id = v.usuario_inicio_id
     where v.iniciou_em < v_ate_ts
       and coalesce(v.finalizou_em, now()) >= v_de_ts
  ),
  cards_aux as (
    select a.usuario_id, a.setor_id, a.card_id,
           (a.segundos + case when a.ultimo_inicio is null then 0
             else greatest(0, floor(extract(epoch from now() - a.ultimo_inicio)))::bigint end) as segundos,
           0::bigint as pausado_s,
           (a.encerrado_em is null) as em_andamento, true as auxiliar,
           case when nullif(a.pausa_motivo, '') is null then '[]'::jsonb
                else jsonb_build_array(a.pausa_motivo) end as motivos,
           0::bigint as especial_s,
           '[]'::jsonb as motivos_especiais
      from public.plt_auxilios a
      join pessoas p on p.id = a.usuario_id
     where a.iniciado_em < v_ate_ts
       and coalesce(a.encerrado_em, now()) >= v_de_ts
  ),
  cards_tudo as (
    select * from cards_exec
    union all
    select * from cards_aux
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
                from public.plt_tempos_pessoa_dia t
               where t.usuario_id = p_usuario and t.dia between v_de and v_ate
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
                        from public.plt_tempos_pessoa_dia d
                       where d.usuario_id = p_usuario and d.dia between v_de and v_ate
                      union all
                      select a.estado, a.setor_id, a.segundos
                        from plt_privado.fn_tempos_aberto(p_usuario, v_de_ts, v_ate_ts) a
                       where a.segundos > 0) t
               where t.setor_id is not null
               group by t.setor_id) x
        join public.plt_setores s on s.id = x.setor_id), '[]'::jsonb),
    -- os cards do período: execuções com o tempo parado e os motivos
    'execucoes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'card_id', v.card_id, 'setor_id', v.setor_id, 'etapa_id', v.etapa_id,
               'setor', (select s.nome from public.plt_setores s where s.id = v.setor_id),
               'iniciou_em', v.iniciou_em, 'finalizou_em', v.finalizou_em,
               'em_andamento', v.em_andamento,
               'segundos', floor(extract(epoch from v.duracao))::bigint,
               'pausado_s', floor(extract(epoch from coalesce(v.pausa_total, interval '0')))::bigint,
               'motivos', (select coalesce(jsonb_agg(distinct e.dados ->> 'motivo')
                             filter (where nullif(e.dados ->> 'motivo', '') is not null), '[]'::jsonb)
                             from public.plt_eventos e
                            where e.card_id = v.card_id and e.tipo = 'execucao_pausada'
                              and e.ocorrido_em >= v.iniciou_em
                              and e.ocorrido_em <= coalesce(v.finalizou_em, now())),
               -- SESSAO-38: o parado por motivo especial (marca de agora) — só para quem vê todos
               'especial_s', case when not v_todos then 0 else
                 (select coalesce(sum(greatest(0, floor(extract(epoch from
                           least(coalesce(r.ocorrido_em, coalesce(v.finalizou_em, now())), coalesce(v.finalizou_em, now()))
                           - p.ocorrido_em)))), 0)::bigint
                    from public.plt_eventos p
                    left join public.plt_eventos r on r.tipo = 'execucao_retomada' and r.evento_referencia_id = p.id
                    join public.plt_motivos m
                      on m.id = (case when p.dados ->> 'motivo_id' ~ '^[0-9]{1,18}$' then (p.dados ->> 'motivo_id')::bigint end)
                     and m.tipo = 'pausa' and m.especial
                   where p.tipo = 'execucao_pausada' and p.evento_referencia_id = v.evento_inicio_id) end,
               'motivos_especiais', case when not v_todos then '[]'::jsonb else
                 (select coalesce(jsonb_agg(distinct m.texto), '[]'::jsonb)
                    from public.plt_eventos p
                    join public.plt_motivos m
                      on m.id = (case when p.dados ->> 'motivo_id' ~ '^[0-9]{1,18}$' then (p.dados ->> 'motivo_id')::bigint end)
                     and m.tipo = 'pausa' and m.especial
                   where p.tipo = 'execucao_pausada' and p.evento_referencia_id = v.evento_inicio_id) end,
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
               'setor', (select s.nome from public.plt_setores s where s.id = a.setor_id),
               'iniciado_em', a.iniciado_em, 'encerrado_em', a.encerrado_em,
               'segundos', a.segundos + case when a.ultimo_inicio is null then 0
                 else greatest(0, floor(extract(epoch from now() - a.ultimo_inicio)))::bigint end,
               'motivo', a.pausa_motivo,
               'motivo_especial', v_todos and a.pausado_em is not null
                 and exists (select 1 from public.plt_pessoa_pausas h
                              where h.usuario_id = a.usuario_id and h.card_id = a.card_id
                                and h.origem = 'auxilio' and h.fim is null and h.especial),
               'rotulo', plt_privado.fn_card_rotulo(a.card_id))
             order by a.iniciado_em desc)
        from (select * from public.plt_auxilios aa
               where aa.usuario_id = p_usuario
                 and aa.iniciado_em < v_ate_ts
                 and coalesce(aa.encerrado_em, now()) >= v_de_ts
               order by aa.iniciado_em desc limit 100) a), '[]'::jsonb)
  );
end;
$function$;

-- ----------------------------------------------------------------------------
-- 9 · O quadro do setor — recriado da versão viva: as pessoas presentes pela
--     régua (quem saiu sozinho some; a carência aparece como trabalhando).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.plt_fn_quadro_setor(p_setor_id bigint, p_por_coluna integer DEFAULT 10, p_ordem text DEFAULT NULL::text, p_filtro text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_n       integer := least(greatest(coalesce(p_por_coluna, 10), 1), 50);
  v_ordem   text := plt_privado.fn_ordem_do_quadro(p_ordem);
  v_colunas jsonb := '[]'::jsonb;
  v_ids     bigint[] := '{}';
  v_pagina  bigint[];
  v_total   integer;
  r         record;
  v_so      bigint[];
begin
  if not plt_privado.fn_pode_ver_quadro(p_setor_id) then
    raise exception 'Você não vê o quadro deste setor.' using errcode = 'insufficient_privilege';
  end if;
  -- SESSAO-40 (D-187): os cards do setor que batem com o filtro — UMA vez
  -- (nulo = sem filtro; vazio = nada bate)
  v_so := plt_privado.fn_quadro_filtrados(p_setor_id, p_filtro);

  for r in
    select null::bigint as etapa_id, -1 as ordem, 0::bigint as id
    union all
    select e.id, e.ordem, e.id from public.plt_etapas e where e.setor_id = p_setor_id and e.ativa
    order by 2, 3
  loop
    v_pagina := plt_privado.fn_quadro_pagina(p_setor_id, r.etapa_id, null, null, v_n, v_ordem, v_so);
    v_total := plt_privado.fn_quadro_total(p_setor_id, r.etapa_id, v_so);
    v_colunas := v_colunas || jsonb_build_array(jsonb_build_object(
                   'etapa_id', r.etapa_id, 'total', v_total, 'cards', plt_privado.fn_quadro_cards(v_pagina)));
    v_ids := v_ids || v_pagina;
  end loop;

  return jsonb_build_object(
    'setor_id', p_setor_id,
    'por_coluna', v_n,
    'ordem', v_ordem,
    -- SESSAO-40 (D-187): o filtro que valeu (nulo = o quadro inteiro)
    'filtro', (select case when x.ativo then coalesce(x.numero, x.nome) end
                 from plt_privado.fn_filtro_do_quadro(p_filtro) x),
    'etapas', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'setor_id', e.setor_id, 'nome', e.nome, 'ordem', e.ordem,
                                          'eh_fila', e.eh_fila, 'eh_danificado', e.eh_danificado, 'ativa', e.ativa,
                                          'setor_destino_id', e.setor_destino_id, 'conclui_producao', e.conclui_producao,
                                          'pede_motivo', e.pede_motivo)
                       order by e.ordem, e.id)
        from public.plt_etapas e where e.setor_id = p_setor_id and e.ativa), '[]'::jsonb),
    'colunas', v_colunas,
    'etiquetas', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'nome', t.nome, 'cor', t.cor,
                                                               'arquivada_em', t.arquivada_em) order by t.nome)
                             from public.plt_etiquetas t), '[]'::jsonb),
    'campos', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'nome', f.nome, 'tipo', f.tipo, 'opcoes', f.opcoes,
                                                            'em_pecas', f.em_pecas, 'em_pedidos', f.em_pedidos,
                                                            'em_avulsos', f.em_avulsos, 'arquivado_em', f.arquivado_em)
                                         order by f.nome)
                          from public.plt_campos f), '[]'::jsonb),
    'presencas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'usuario_id', u.id, 'nome', u.nome, 'foto', u.foto_caminho,
               'estado', ef.estado, 'desde', s.inicio, 'carencia', s.carencia)
             order by u.nome)
        from public.plt_presenca_segmentos s
        join public.plt_usuarios u on u.id = s.usuario_id
        cross join lateral (select plt_privado.fn_presenca_estado_efetivo(s.estado, s.carencia, s.inicio, now()) as estado) ef
       where s.fim is null and s.setor_id = p_setor_id and ef.estado is not null), '[]'::jsonb)
  ) || plt_privado.fn_quadro_junto(v_ids);
end;
$function$;
