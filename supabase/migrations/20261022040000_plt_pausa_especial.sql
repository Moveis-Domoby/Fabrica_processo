-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · SESSAO-38 (frente F4) — MOTIVOS DE PAUSA
-- ESPECIAIS: o tempo parado por eles NÃO conta contra o funcionário
-- (D-164 · D-165 · D-166)
--
-- O pedido do dono: "na parte de PARAR um card, crie motivos ESPECIAIS que,
-- quando selecionados, param de contar o tempo para o funcionário. Não mostre
-- nenhum aviso para o funcionário — para ele é um motivo como outro qualquer.
-- São eles: 'Faltou peça', 'Máquina quebrou', 'Pausa solicitada por um líder'.
-- Coloque nos motivos de pausa um 'especial ou não' para quem cria ou edita
-- saber disso."
--
-- O que "o tempo do funcionário" é aqui (o que conta contra ele): a PRESENÇA
-- (migration 96) — trabalhando · ausente · à deriva, um segmento por estado,
-- somado no agregado diário plt_tempos_pessoa_dia. O tempo de execução (as
-- views de execução) JÁ desconta toda pausa, especial ou não — não muda.
-- O que conta CONTRA a pessoa é o "ausente" (no setor, sem nada rodando).
--
-- O que muda:
--   1. plt_motivos.especial (só vale para a lista de pausa) + os 3 motivos
--      semeados (o que já existe com o mesmo nome — sem maiúsculas, acentos e
--      espaços — é marcado em vez de duplicado).
--   2. plt_pessoa_pausas — projeção (escrita só por gatilho) das "paradas" de
--      cada pessoa: o card dela pausado, o auxílio dela pausado, o card que ela
--      executava solto no PARADO com motivo. Cada uma guarda se o motivo era
--      especial NO MOMENTO do gesto.
--   3. A presença ganha a marca: quando a pessoa ficaria "ausente" e a parada
--      MAIS RECENTE dela é especial, o segmento é "ausente especial"
--      (plt_presenca_segmentos.especial) — o quadro e o tablet continuam vendo
--      "ausente" (nada diferente para o funcionário); no agregado diário o
--      trecho vira o estado 'especial' (fora do "ausente").
--   4. As portas da dashboard de tempos mostram o "não conta" SÓ para quem vê
--      todos (líder/admin); o funcionário vê o próprio sem nada especial.
--   5. Configurações → Utilitários: porta própria do admin para listar com a
--      marca (a lista do funcionário NÃO leva a marca) e o salvar com ela.
--
-- Nada aqui toca as tabelas da integração nem o check de tipos de evento.
-- Aditiva e compatível com o site publicado. Idempotente.
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · A marca "especial" nos motivos e os três motivos do dono
-- ----------------------------------------------------------------------------
do $$
declare
  v_txt   text;
  v_ordem integer;
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'plt_motivos' and column_name = 'especial') then
    alter table public.plt_motivos add column especial boolean not null default false;

    -- Semeia UMA vez (reaplicar não desfaz o que o admin escolher depois).
    for v_txt, v_ordem in
      select x.t, x.o from (values ('Faltou peça', 70), ('Máquina quebrou', 80),
                                   ('Pausa solicitada por um líder', 90)) as x(t, o)
    loop
      if exists (select 1 from public.plt_motivos m
                  where m.tipo = 'pausa'
                    and plt_privado.fn_nome_comparavel(m.texto) = plt_privado.fn_nome_comparavel(v_txt)) then
        update public.plt_motivos m
           set especial = true, atualizado_em = now()
         where m.tipo = 'pausa'
           and plt_privado.fn_nome_comparavel(m.texto) = plt_privado.fn_nome_comparavel(v_txt);
      else
        insert into public.plt_motivos (tipo, texto, ordem, ativo, especial)
          values ('pausa', v_txt, v_ordem, true, true);
      end if;
    end loop;
  end if;
end;
$$;

comment on column public.plt_motivos.especial is
  'SESSAO-38 (D-164): só na lista de pausa — enquanto a pessoa estiver parada por este motivo, o tempo NÃO conta contra ela (fora do "ausente"). O funcionário não vê a marca: a lista dele não a traz.';

alter table public.plt_motivos drop constraint if exists plt_motivos_especial_so_pausa_ck;
alter table public.plt_motivos add constraint plt_motivos_especial_so_pausa_ck
  check (not especial or tipo = 'pausa');

-- o motivo (da lista de pausa) é especial AGORA?
create or replace function plt_privado.fn_motivo_especial(p_motivo_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select m.especial from public.plt_motivos m
                    where m.id = p_motivo_id and m.tipo = 'pausa'), false);
$$;

revoke all on function plt_privado.fn_motivo_especial(bigint) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2 · As paradas de cada pessoa (projeção — M-13; escrita só pelos gatilhos)
-- ----------------------------------------------------------------------------
create table if not exists public.plt_pessoa_pausas (
  id          bigint generated always as identity primary key,
  usuario_id  uuid not null references public.plt_usuarios(id) on delete cascade,
  card_id     bigint not null references public.plt_cards(id),
  -- execucao = o card dela pausado · auxilio = o auxílio dela pausado ·
  -- parada = o card que ela executava solto na etapa de parada com motivo
  origem      text not null check (origem in ('execucao', 'auxilio', 'parada')),
  evento_id   bigint not null references public.plt_eventos(id),
  motivo_id   bigint references public.plt_motivos(id),
  -- a marca do motivo NO MOMENTO do gesto (mudar a marca depois não reescreve)
  especial    boolean not null default false,
  inicio      timestamptz not null,
  fim         timestamptz
);

comment on table public.plt_pessoa_pausas is
  'SESSAO-38 (D-165): projeção das paradas de cada pessoa (card pausado, auxílio pausado, card solto no PARADO com motivo), com a marca "especial" do motivo no momento do gesto. A presença lê a mais recente aberta para separar o "ausente" que não conta. Escrita só pelos gatilhos; nenhuma porta do navegador lê.';

create unique index if not exists plt_pessoa_pausas_aberta_uq
  on public.plt_pessoa_pausas (usuario_id, card_id, origem) where fim is null;
create index if not exists plt_pessoa_pausas_pessoa_idx
  on public.plt_pessoa_pausas (usuario_id, inicio desc, id desc) where fim is null;
create index if not exists plt_pessoa_pausas_card_idx
  on public.plt_pessoa_pausas (card_id) where fim is null;
create index if not exists plt_pessoa_pausas_evento_idx
  on public.plt_pessoa_pausas (evento_id);
create index if not exists plt_pessoa_pausas_motivo_idx
  on public.plt_pessoa_pausas (motivo_id) where motivo_id is not null;

alter table public.plt_pessoa_pausas enable row level security;
revoke all on public.plt_pessoa_pausas from anon, authenticated, public;

-- ----------------------------------------------------------------------------
-- 3 · A presença ganha a marca do "ausente especial"
-- ----------------------------------------------------------------------------
alter table public.plt_presenca_segmentos add column if not exists especial boolean not null default false;
comment on column public.plt_presenca_segmentos.especial is
  'SESSAO-38 (D-165): segmento "ausente" cuja parada mais recente da pessoa é por motivo especial — não conta contra ela. O estado continua "ausente" (o quadro e o tablet não mudam); no agregado diário o trecho vira o estado ''especial''.';

-- o agregado diário aceita o estado novo (aditivo — E-19: not valid + validate
-- nesta migration, a mais nova deste check)
do $$
declare
  v_nome text;
begin
  for v_nome in
    select conname from pg_constraint
     where conrelid = 'public.plt_tempos_pessoa_dia'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%trabalhando%'
  loop
    execute format('alter table public.plt_tempos_pessoa_dia drop constraint %I', v_nome);
  end loop;
end;
$$;
alter table public.plt_tempos_pessoa_dia add constraint plt_tempos_pessoa_dia_estado_check
  check (estado in ('trabalhando', 'ausente', 'deriva', 'especial')) not valid;
alter table public.plt_tempos_pessoa_dia validate constraint plt_tempos_pessoa_dia_estado_check;

-- fn_tempos_dia_somar — recriada POR INTEIRO a partir da migration 96: o teto
-- de 12 h por trecho vale também para o "ausente especial" (é ausente).
create or replace function plt_privado.fn_tempos_dia_somar(
  p_usuario uuid, p_estado text, p_setor bigint, p_inicio timestamptz, p_fim timestamptz
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fim    timestamptz := p_fim;
  v_cursor timestamptz := p_inicio;
  v_dia    date;
  v_corte  timestamptz;
  v_seg    bigint;
begin
  if p_estado in ('ausente', 'deriva', 'especial') then
    v_fim := least(v_fim, p_inicio + interval '12 hours');
  end if;
  if v_fim <= v_cursor then
    return;
  end if;
  while v_cursor < v_fim loop
    v_dia := (v_cursor at time zone 'America/Fortaleza')::date;
    v_corte := ((v_dia + 1)::timestamp at time zone 'America/Fortaleza');
    v_seg := floor(extract(epoch from least(v_fim, v_corte) - v_cursor))::bigint;
    if v_seg > 0 then
      insert into public.plt_tempos_pessoa_dia as t (usuario_id, dia, estado, setor_id, segundos)
        values (p_usuario, v_dia, p_estado, p_setor, v_seg)
        on conflict (usuario_id, dia, estado, coalesce(setor_id, 0))
        do update set segundos = t.segundos + excluded.segundos;
    end if;
    v_cursor := least(v_fim, v_corte);
  end loop;
end;
$$;

revoke all on function plt_privado.fn_tempos_dia_somar(uuid, text, bigint, timestamptz, timestamptz) from public, anon, authenticated;

-- fn_presenca_recalcular — recriada POR INTEIRO a partir da migration 96: +
-- a marca especial do "ausente" (a parada aberta MAIS RECENTE da pessoa
-- decide) e o fechamento soma o trecho no estado certo.
create or replace function plt_privado.fn_presenca_recalcular(p_usuario uuid, p_agora timestamptz default now())
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_estado   text;
  v_setor    bigint;
  v_especial boolean := false;
  v_seg      public.plt_presenca_segmentos%rowtype;
  v_atual    public.plt_presenca_atual%rowtype;
begin
  if p_usuario is null then
    return;
  end if;
  if exists (select 1 from public.plt_usuarios u where u.id = p_usuario and u.conta_tablet) then
    return; -- a conta do aparelho não é uma pessoa
  end if;

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
       and v_seg.especial = v_especial then
      return; -- nada mudou
    end if;
    if v_seg.inicio >= p_agora then
      -- trocas no mesmo instante (um gesto que mexe em vários cards): o
      -- segmento de duração zero sai em vez de poluir a história
      delete from public.plt_presenca_segmentos where id = v_seg.id;
    else
      update public.plt_presenca_segmentos set fim = p_agora where id = v_seg.id;
      perform plt_privado.fn_tempos_dia_somar(
        p_usuario,
        case when v_seg.estado = 'ausente' and v_seg.especial then 'especial' else v_seg.estado end,
        v_seg.setor_id, v_seg.inicio, p_agora);
    end if;
    if v_seg.setor_id is not null then
      perform plt_privado.fn_avisar('setor_' || v_seg.setor_id);
    end if;
  end if;

  if v_estado is not null then
    insert into public.plt_presenca_segmentos (usuario_id, estado, setor_id, inicio, especial)
      values (p_usuario, v_estado, v_setor, p_agora, v_especial);
    if v_setor is not null then
      perform plt_privado.fn_avisar('setor_' || v_setor);
    end if;
  end if;
  perform plt_privado.fn_avisar('tempos');
end;
$$;

revoke all on function plt_privado.fn_presenca_recalcular(uuid, timestamptz) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4 · Os gatilhos que mantêm as paradas da pessoa
--     O nome "plt_eventos_pausas_pessoa" ordena ANTES de "plt_eventos_projetar"
--     (gatilhos AFTER rodam em ordem alfabética — E-78): no PARADO, o card ainda
--     tem o executor quando a parada dele é aberta.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_pessoa_pausas_projetar()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card     public.plt_cards%rowtype;
  v_mid      bigint;
  v_texto    text;
  v_pessoas  uuid[] := '{}';
  v_u        uuid;
begin
  select * into v_card from public.plt_cards where id = new.card_id;
  v_texto := new.dados ->> 'motivo_id';
  v_mid := case when v_texto ~ '^[0-9]{1,18}$' then v_texto::bigint end;

  if new.tipo = 'execucao_pausada' then
    -- a parada é de quem EXECUTA o card (o líder pode ser quem pausou)
    if v_card.executor_atual_id is not null then
      update public.plt_pessoa_pausas set fim = new.ocorrido_em
       where card_id = new.card_id and origem = 'execucao' and fim is null;
      insert into public.plt_pessoa_pausas (usuario_id, card_id, origem, evento_id, motivo_id, especial, inicio)
        values (v_card.executor_atual_id, new.card_id, 'execucao', new.id, v_mid,
                plt_privado.fn_motivo_especial(v_mid), new.ocorrido_em);
      v_pessoas := array_append(v_pessoas, v_card.executor_atual_id);
    end if;

  elsif new.tipo = 'auxilio_pausado' then
    if v_mid is null and coalesce(new.dados ->> 'junto_com_o_card', 'false') = 'true' then
      -- pausado junto com o card: o motivo é o da pausa do card (a mais recente)
      select case when e.dados ->> 'motivo_id' ~ '^[0-9]{1,18}$' then (e.dados ->> 'motivo_id')::bigint end
        into v_mid
        from public.plt_eventos e
       where e.card_id = new.card_id and e.tipo = 'execucao_pausada'
       order by e.id desc
       limit 1;
    end if;
    update public.plt_pessoa_pausas set fim = new.ocorrido_em
     where card_id = new.card_id and usuario_id = new.usuario_id and origem = 'auxilio' and fim is null;
    insert into public.plt_pessoa_pausas (usuario_id, card_id, origem, evento_id, motivo_id, especial, inicio)
      values (new.usuario_id, new.card_id, 'auxilio', new.id, v_mid,
              plt_privado.fn_motivo_especial(v_mid), new.ocorrido_em);
    v_pessoas := array_append(v_pessoas, new.usuario_id);

  elsif new.tipo in ('auxilio_retomado', 'auxilio_encerrado') then
    with fechadas as (
      update public.plt_pessoa_pausas set fim = new.ocorrido_em
       where card_id = new.card_id and usuario_id = new.usuario_id and origem = 'auxilio' and fim is null
      returning usuario_id)
    select coalesce(array_agg(usuario_id), '{}') into v_pessoas from fechadas;

  else
    -- retomar, iniciar, finalizar, estornar, arquivar, concluir, mover: as
    -- paradas do CARD acabam (o auxílio tem os fatos próprios, acima)
    with fechadas as (
      update public.plt_pessoa_pausas set fim = new.ocorrido_em
       where card_id = new.card_id and origem in ('execucao', 'parada') and fim is null
      returning usuario_id)
    select coalesce(array_agg(usuario_id), '{}') into v_pessoas from fechadas;

    -- solto no PARADO com motivo (plt_fn_card_parar): a parada é de quem executava
    if new.tipo = 'movimentacao_etapa'
       and nullif(new.dados ->> 'motivo_parada', '') is not null
       and v_card.executor_atual_id is not null then
      insert into public.plt_pessoa_pausas (usuario_id, card_id, origem, evento_id, motivo_id, especial, inicio)
        values (v_card.executor_atual_id, new.card_id, 'parada', new.id, v_mid,
                plt_privado.fn_motivo_especial(v_mid), new.ocorrido_em);
      v_pessoas := array_append(v_pessoas, v_card.executor_atual_id);
    end if;
  end if;

  for v_u in select distinct x from unnest(v_pessoas) x where x is not null loop
    perform plt_privado.fn_presenca_recalcular(v_u);
  end loop;
  return null;
end;
$$;

revoke all on function plt_privado.fn_pessoa_pausas_projetar() from public, anon, authenticated;

drop trigger if exists plt_eventos_pausas_pessoa on public.plt_eventos;
create trigger plt_eventos_pausas_pessoa
  after insert on public.plt_eventos
  for each row
  when (new.tipo in ('execucao_pausada', 'execucao_retomada', 'execucao_iniciada', 'execucao_finalizada',
                     'estorno', 'card_arquivado', 'avulso_concluido',
                     'movimentacao_etapa', 'movimentacao_setor',
                     'auxilio_pausado', 'auxilio_retomado', 'auxilio_encerrado'))
  execute function plt_privado.fn_pessoa_pausas_projetar();

-- Entrar num setor ou sair dele encerra as paradas da pessoa: ela seguiu em
-- frente (o que a prendia não vale para o próximo setor nem para o dia seguinte).
create or replace function plt_privado.fn_pessoa_pausas_presenca()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.plt_pessoa_pausas set fim = new.ocorrido_em
   where usuario_id = new.usuario_id and fim is null;
  return null;
end;
$$;

revoke all on function plt_privado.fn_pessoa_pausas_presenca() from public, anon, authenticated;

drop trigger if exists plt_presenca_eventos_pausas_pessoa on public.plt_presenca_eventos;
create trigger plt_presenca_eventos_pausas_pessoa
  after insert on public.plt_presenca_eventos
  for each row execute function plt_privado.fn_pessoa_pausas_presenca();

-- As paradas abertas AGORA (o card pausado, o auxílio pausado) ganham a linha —
-- o que já foi somado no agregado não muda (não havia motivo especial antes
-- desta migration; o que for marcado depois vale dali em diante — D-165).
insert into public.plt_pessoa_pausas (usuario_id, card_id, origem, evento_id, motivo_id, especial, inicio)
select c.executor_atual_id, c.id, 'execucao', e.id, x.mid, plt_privado.fn_motivo_especial(x.mid), e.ocorrido_em
  from public.plt_cards c
  cross join lateral (select ev.id, ev.ocorrido_em, ev.dados from public.plt_eventos ev
                       where ev.card_id = c.id and ev.tipo = 'execucao_pausada'
                       order by ev.id desc limit 1) e
  cross join lateral (select case when e.dados ->> 'motivo_id' ~ '^[0-9]{1,18}$'
                                  then (e.dados ->> 'motivo_id')::bigint end as mid) x
 where c.pausado_em is not null and c.executor_atual_id is not null and c.arquivado_em is null
   and not exists (select 1 from public.plt_pessoa_pausas h
                    where h.card_id = c.id and h.origem = 'execucao' and h.fim is null);

-- ----------------------------------------------------------------------------
-- 5 · Pausar geral leva o motivo escolhido também no auxílio (a parada do
--     auxílio sabe se é especial). plt_fn_pessoa_pausar recriada POR INTEIRO a
--     partir da migration 96 — só o motivo_id a mais no fato do auxílio.
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_pessoa_pausar(
  p_motivo_id   bigint default null,
  p_texto       text default null,
  p_operador_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pessoa uuid := plt_privado.fn_pessoa_do_gesto(p_operador_id);
  v_motivo text := plt_privado.fn_motivo_da_lista('pausa', p_motivo_id, p_texto);
  v_card   record;
  v_n      integer := 0;
begin
  for v_card in
    select c.id from public.plt_cards c
     where c.executor_atual_id = v_pessoa and c.pausado_em is null
       and c.arquivado_em is null and c.concluido_em is null
  loop
    insert into public.plt_eventos (card_id, tipo, origem, usuario_id, dados)
      values (v_card.id, 'execucao_pausada', 'interface', v_pessoa,
              jsonb_build_object('motivo', v_motivo, 'motivo_id', p_motivo_id, 'pausa_geral', true));
    v_n := v_n + 1;
  end loop;
  for v_card in
    select a.card_id as id from public.plt_auxilios a
     where a.usuario_id = v_pessoa and a.encerrado_em is null and a.pausado_em is null
  loop
    insert into public.plt_eventos (card_id, tipo, origem, usuario_id, dados)
      values (v_card.id, 'auxilio_pausado', 'interface', v_pessoa,
              jsonb_build_object('motivo', v_motivo, 'motivo_id', p_motivo_id, 'pausa_geral', true));
    v_n := v_n + 1;
  end loop;
  perform plt_privado.fn_presenca_recalcular(v_pessoa);
  return v_n;
end;
$$;

revoke all on function public.plt_fn_pessoa_pausar(bigint, text, uuid) from public, anon;
grant execute on function public.plt_fn_pessoa_pausar(bigint, text, uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 6 · Configurações → Utilitários: a lista COM a marca (só admin) e o salvar
--     com a marca. A lista de todos (plt_fn_motivos) NÃO muda — o funcionário
--     não recebe a marca.
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_motivos_config(p_tipo text)
returns table (id bigint, tipo text, texto text, ordem integer, ativo boolean, especial boolean)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not plt_privado.fn_eh_admin() then
    raise exception 'A lista de motivos com as marcas é do admin.' using errcode = 'insufficient_privilege';
  end if;
  return query
    select m.id, m.tipo, m.texto, m.ordem, m.ativo, m.especial
      from public.plt_motivos m
     where m.tipo = p_tipo
     order by m.ordem, m.texto
     limit 200;
end;
$$;

comment on function public.plt_fn_motivos_config(text) is
  'SESSAO-38 (D-164): os motivos de uma lista com os desligados e a marca "especial" — só admin (Configurações → Utilitários). A lista do dia a dia (plt_fn_motivos) não leva a marca.';

revoke all on function public.plt_fn_motivos_config(text) from public, anon;
grant execute on function public.plt_fn_motivos_config(text) to authenticated;

-- plt_fn_motivo_salvar — recriada a partir da versão viva (migration 96) com
-- p_especial a mais (default nulo = não mexe). Assinatura nova → drop + create
-- (A-12); a chamada antiga (5 nomes) do site publicado casa com o default.
drop function if exists public.plt_fn_motivo_salvar(bigint, text, text, integer, boolean);
create or replace function public.plt_fn_motivo_salvar(
  p_id       bigint,
  p_tipo     text,
  p_texto    text,
  p_ordem    integer default null,
  p_ativo    boolean default true,
  p_especial boolean default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id       bigint;
  v_especial boolean;
begin
  if not plt_privado.fn_eh_admin() then
    raise exception 'Cadastrar motivo é gesto de admin.' using errcode = 'insufficient_privilege';
  end if;
  if p_tipo not in ('nao_entregue', 'desfazer_entrega', 'devolucao', 'pausa', 'saida') then
    raise exception 'Tipo de motivo desconhecido.' using errcode = 'check_violation';
  end if;
  if char_length(btrim(coalesce(p_texto, ''))) not between 2 and 80 then
    raise exception 'O motivo precisa ter de 2 a 80 letras — uma frase curta.' using errcode = 'check_violation';
  end if;
  if coalesce(p_especial, false) and p_tipo <> 'pausa' then
    raise exception 'Só motivo de pausa pode ser especial.' using errcode = 'check_violation';
  end if;
  if p_id is null then
    insert into public.plt_motivos (tipo, texto, ordem, ativo, especial)
      values (p_tipo, btrim(p_texto), coalesce(p_ordem, 100), coalesce(p_ativo, true), coalesce(p_especial, false))
      returning id, especial into v_id, v_especial;
  else
    update public.plt_motivos
       set texto = btrim(p_texto), ordem = coalesce(p_ordem, ordem), ativo = coalesce(p_ativo, ativo),
           especial = coalesce(p_especial, especial),
           atualizado_em = now()
     where id = p_id and tipo = p_tipo
     returning id, especial into v_id, v_especial;
    if v_id is null then
      raise exception 'Motivo não encontrado.' using errcode = 'no_data_found';
    end if;
  end if;
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (plt_privado.fn_usuario_atual(), 'motivo_salvo',
            jsonb_build_object('motivo_id', v_id, 'tipo', p_tipo, 'texto', btrim(p_texto),
                               'ativo', coalesce(p_ativo, true), 'especial', v_especial));
  return v_id;
exception when unique_violation then
  raise exception 'Já existe esse motivo.' using errcode = 'unique_violation';
end;
$$;

revoke all on function public.plt_fn_motivo_salvar(bigint, text, text, integer, boolean, boolean) from public, anon;
grant execute on function public.plt_fn_motivo_salvar(bigint, text, text, integer, boolean, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- 7 · A dashboard de tempos: o "não conta" à parte — SÓ para quem vê todos
-- ----------------------------------------------------------------------------
-- o trecho ABERTO: o "ausente especial" sai como 'especial' (recriada POR
-- INTEIRO a partir da migration 97, mesma forma)
create or replace function plt_privado.fn_tempos_aberto(
  p_usuario uuid, p_de timestamptz, p_ate timestamptz
)
returns table (estado text, setor_id bigint, segundos bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when s.estado = 'ausente' and s.especial then 'especial' else s.estado end,
         s.setor_id,
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

-- o scorecard (recriado a partir da migration 98): + especial_s e
-- estado_especial no fim. A forma muda → drop + create (A-12/E-17 — as
-- migrations 97 e 98 ganharam o drop antes do create delas).
drop function if exists public.plt_fn_tempos_pessoas(date, date, integer, integer);
create function public.plt_fn_tempos_pessoas(
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
  ausente_s     bigint,       -- SÓ o ausente que conta (sem o especial)
  deriva_s      bigint,
  por_setor     jsonb,        -- [{setor_id, nome, producao_s, ausente_s, especial_s, cards: [...]}]
  contagem_total integer,
  especial_s    bigint,       -- SESSAO-38: parado por motivo especial (0 para quem não vê todos)
  estado_especial boolean     -- SESSAO-38: o ausente de agora é especial (falso para quem não vê todos)
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
         seg.estado, seg.inicio, seg.setor_id,
         coalesce(so.producao_s, 0), coalesce(so.ausente_s, 0), coalesce(so.deriva_s, 0),
         coalesce(st.por_setor, '[]'::jsonb),
         p.total,
         case when v_todos then coalesce(so.especial_s, 0) else 0 end,
         v_todos and coalesce(seg.especial, false)
    from pessoas p
    left join public.plt_presenca_segmentos seg
           on seg.usuario_id = p.id and seg.fim is null
    left join somas so on so.usuario_id = p.id
    left join setores st on st.usuario_id = p.id
   order by p.nome, p.id;
end;
$$;

comment on function public.plt_fn_tempos_pessoas(date, date, integer, integer) is
  'SESSAO-36/37/38: o scorecard de tempos por pessoa — estado de agora + produção/ausente/à deriva, o detalhe POR SETOR e a produção por móvel (teto de 30 cards). SESSAO-38 (D-165): o tempo parado por motivo ESPECIAL fica fora do ausente (especial_s), visível só para líder/admin. Tudo numa requisição. Líder/admin veem todos; o funcionário só o próprio.';

revoke all on function public.plt_fn_tempos_pessoas(date, date, integer, integer) from public, anon;
grant execute on function public.plt_fn_tempos_pessoas(date, date, integer, integer) to authenticated;

-- O detalhe da pessoa (recriado a partir da migration 98; jsonb — chaves a
-- mais, mesma forma): dia a dia, por setor e o de agora com o "não conta" à
-- parte; cada execução com o parado por motivo especial. Tudo isso SÓ para
-- quem vê todos — o próprio funcionário vê o detalhe sem nada especial.
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
    'estado', (select jsonb_build_object('estado', s.estado, 'desde', s.inicio, 'setor_id', s.setor_id,
                                         'especial', v_todos and s.especial)
                 from public.plt_presenca_segmentos s
                where s.usuario_id = p_usuario and s.fim is null),
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
$$;

comment on function public.plt_fn_tempos_pessoa_detalhe(uuid, date, date) is
  'SESSAO-36/37/38: o detalhe da pessoa na dashboard de tempos — dia a dia, por setor (produção × ausente) e os cards com tempo parado e motivos. SESSAO-38 (D-165): o "não conta" (motivo especial) à parte, só para líder/admin. O próprio, ou líder/admin.';

revoke all on function public.plt_fn_tempos_pessoa_detalhe(uuid, date, date) from public, anon;
grant execute on function public.plt_fn_tempos_pessoa_detalhe(uuid, date, date) to authenticated;
