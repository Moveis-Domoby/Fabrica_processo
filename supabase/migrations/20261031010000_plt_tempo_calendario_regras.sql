-- ============================================================================
-- SESSAO-42 · F2 (30–31/10/2026) — O TEMPO CERTO: o calendário da fábrica, as
-- regras de tempo válido por setor e as portas de Configurações → Controle de
-- tempo (uma por aba). Pedido do dono (29/10) + as 17 respostas (30/10) na
-- demanda.
--
-- (1) O CALENDÁRIO: o expediente da semana em faixas (o almoço é o buraco
--     entre duas — 07:30–12:00 e 13:00–18:00), as EXCEÇÕES por dia (feriado,
--     dia trabalhado com horário, dia parado — da fábrica toda ou de um setor;
--     os feriados nacionais de 2026 e 2027 já vêm) e a HORA EXTRA autorizada
--     (líder do setor ou admin; do setor inteiro ou de uma pessoa).
-- (2) A RÉGUA TEM UM DONO (M-04): `fn_tempo_janelas` devolve as janelas que
--     contam; `fn_tempo_util` (mesma assinatura — as portas antigas acertam
--     sozinhas) e o cálculo único (próxima migration) leem dela; `fn_tempo_corte`
--     dá o "fim do expediente" de um trecho (a pausa sozinha — regra 2).
-- (3) AS REGRAS POR SETOR (mínimo, teto, longo para o modelo, voltas,
--     retrabalho, gesto de admin, pular a execução, lote, faixa da média,
--     janela do tempo padrão) e a data oficial (26/10/2026).
-- (4) A EQUIPE NO PAINEL (titular/apoio e a letra na TV) e os MODELOS (as cores
--     do mesmo móvel juntas — sugerido pelo sistema, confirmado pelo admin).
-- (5) A FILA DE RECÁLCULO (o pedido; o processamento é da próxima migration).
--
-- Configuração é régua de medição, não medição (D-29): editável, com trilha
-- (antes/depois) em plt_logs_atividade; os fatos nunca mudam (RNF-05).
-- Aditiva: tabelas e funções novas; `fn_tempo_util` mantém a assinatura e o
-- significado (fora do horário não conta), agora com exceções e hora extra.
-- Dado: o horário 07:30–18:00 de cada setor vira duas faixas (com o OK do dono,
-- aplicado junto com a migration).
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · A configuração global e as regras por setor
-- ----------------------------------------------------------------------------
create table if not exists public.plt_tempo_config (
  id              smallint primary key default 1 check (id = 1),
  -- resposta 11 do dono: o que saiu do setor antes disto é "teste"
  data_oficial    date not null default date '2026-10-26',
  -- até onde o recálculo completo volta (o uso real começou em 19/10)
  recalcular_desde date not null default date '2026-10-19',
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid references public.plt_usuarios(id)
);
insert into public.plt_tempo_config (id) values (1) on conflict (id) do nothing;
comment on table public.plt_tempo_config is
  'SESSAO-42 (F2): o que vale para a fábrica toda no tempo — a data oficial (passagem que saiu antes dela é teste, fora de tudo) e de onde o recálculo completo começa. Uma linha só.';

create table if not exists public.plt_tempo_regras (
  setor_id              bigint primary key references public.plt_setores(id),
  minimo_min            integer not null default 3  check (minimo_min between 0 and 120),
  teto_min              integer check (teto_min is null or teto_min between 10 and 1440),
  fator_longo           numeric(4,2) not null default 3 check (fator_longo between 1.2 and 20),
  base_minima           integer not null default 5 check (base_minima between 2 and 100),
  pausar_fim_expediente boolean not null default true,
  sem_resposta_min      integer not null default 15 check (sem_resposta_min between 5 and 240),
  volta_rapida_min      integer not null default 5 check (volta_rapida_min between 0 and 60),
  retrabalho_fora       boolean not null default true,
  admin_fora            boolean not null default true,
  avisar_pulo           boolean not null default false,
  permite_lote          boolean not null default false,
  faixa_media_pct       integer not null default 10 check (faixa_media_pct between 1 and 50),
  janela_padrao_dias    integer not null default 90 check (janela_padrao_dias between 7 and 730),
  atualizado_em         timestamptz not null default now(),
  atualizado_por        uuid references public.plt_usuarios(id)
);
comment on table public.plt_tempo_regras is
  'SESSAO-42 (F2): as regras de tempo válido de cada setor de produção — passagem mínima, teto útil (nulo = sem teto), longa demais (fator × mediana do modelo com base mínima), pausar sozinho no fim do expediente, aviso sem resposta vira pausa, volta rápida para a fila = clique errado, retrabalho e gesto de admin fora da média, avisar quando pular a execução, montar em lote, faixa "na média" e janela do tempo padrão. O aviso de card esquecido segue em plt_setores.aviso_esquecido_min.';

-- valores iniciais da demanda: a MONTAGEM com teto de 4 h, o aviso de pular e o lote
insert into public.plt_tempo_regras (setor_id, teto_min, avisar_pulo, permite_lote)
select s.id,
       case when s.codigo = 'montagem' then 240 end,
       s.codigo = 'montagem',
       s.codigo = 'montagem'
  from public.plt_setores s
 where s.papel_no_fluxo = 'producao'
on conflict (setor_id) do nothing;

-- ----------------------------------------------------------------------------
-- 2 · As exceções do calendário e a hora extra
-- ----------------------------------------------------------------------------
create table if not exists public.plt_tempo_excecoes (
  id           bigint generated always as identity primary key,
  -- nulo = a fábrica toda; a exceção do setor vence a da fábrica no mesmo dia
  setor_id     bigint references public.plt_setores(id),
  dia          date not null,
  tipo         text not null check (tipo in ('feriado', 'trabalhado', 'parado')),
  descricao    text not null default '' check (length(descricao) <= 120),
  -- só no "trabalhado": [["07:30","12:00"],["13:00","18:00"]]
  faixas       jsonb not null default '[]'::jsonb check (jsonb_typeof(faixas) = 'array'),
  criado_por   uuid references public.plt_usuarios(id),
  criado_em    timestamptz not null default now(),
  arquivado_em timestamptz,
  arquivado_por uuid references public.plt_usuarios(id),
  constraint plt_tempo_excecoes_trabalhado_ck
    check (tipo <> 'trabalhado' or jsonb_array_length(faixas) between 1 and 6)
);
create unique index if not exists plt_tempo_excecoes_dia_uk
  on public.plt_tempo_excecoes (coalesce(setor_id, 0), dia) where arquivado_em is null;
create index if not exists plt_tempo_excecoes_dia_idx
  on public.plt_tempo_excecoes (dia) where arquivado_em is null;
create index if not exists plt_tempo_excecoes_setor_idx on public.plt_tempo_excecoes (setor_id);
create index if not exists plt_tempo_excecoes_criado_por_idx on public.plt_tempo_excecoes (criado_por);
create index if not exists plt_tempo_excecoes_arquivado_por_idx on public.plt_tempo_excecoes (arquivado_por);
comment on table public.plt_tempo_excecoes is
  'SESSAO-42 (F2): o dia diferente do calendário — feriado (não conta), dia trabalhado (conta só as faixas dele — ex.: um sábado liberado), dia parado (não conta). Nulo no setor = a fábrica toda; a do setor vence a da fábrica. Remover = arquivar (a trilha guarda).';

-- os feriados NACIONAIS de 2026 e 2027 (os de Natal/RN o admin cadastra)
insert into public.plt_tempo_excecoes (setor_id, dia, tipo, descricao)
select null, x.dia, 'feriado', x.nome
  from (values
    (date '2026-01-01', 'Confraternização Universal'), (date '2026-04-03', 'Sexta-feira Santa'),
    (date '2026-04-21', 'Tiradentes'), (date '2026-05-01', 'Dia do Trabalho'),
    (date '2026-09-07', 'Independência do Brasil'), (date '2026-10-12', 'Nossa Senhora Aparecida'),
    (date '2026-11-02', 'Finados'), (date '2026-11-15', 'Proclamação da República'),
    (date '2026-11-20', 'Dia da Consciência Negra'), (date '2026-12-25', 'Natal'),
    (date '2027-01-01', 'Confraternização Universal'), (date '2027-03-26', 'Sexta-feira Santa'),
    (date '2027-04-21', 'Tiradentes'), (date '2027-05-01', 'Dia do Trabalho'),
    (date '2027-09-07', 'Independência do Brasil'), (date '2027-10-12', 'Nossa Senhora Aparecida'),
    (date '2027-11-02', 'Finados'), (date '2027-11-15', 'Proclamação da República'),
    (date '2027-11-20', 'Dia da Consciência Negra'), (date '2027-12-25', 'Natal')
  ) as x(dia, nome)
 where not exists (select 1 from public.plt_tempo_excecoes e
                    where e.setor_id is null and e.dia = x.dia and e.arquivado_em is null);

create table if not exists public.plt_tempo_horas_extras (
  id            bigint generated always as identity primary key,
  setor_id      bigint not null references public.plt_setores(id),
  -- nulo = o setor inteiro; senão só aquela pessoa
  usuario_id    uuid references public.plt_usuarios(id),
  inicio        timestamptz not null,
  fim           timestamptz not null,
  motivo        text not null default '' check (length(motivo) <= 200),
  criado_por    uuid references public.plt_usuarios(id),
  criado_em     timestamptz not null default now(),
  cancelada_em  timestamptz,
  cancelada_por uuid references public.plt_usuarios(id),
  constraint plt_tempo_horas_extras_janela_ck
    check (fim > inicio and fim - inicio <= interval '16 hours')
);
create index if not exists plt_tempo_horas_extras_setor_idx
  on public.plt_tempo_horas_extras (setor_id, inicio) where cancelada_em is null;
create index if not exists plt_tempo_horas_extras_lista_idx
  on public.plt_tempo_horas_extras (inicio desc, id desc);
create index if not exists plt_tempo_horas_extras_usuario_idx on public.plt_tempo_horas_extras (usuario_id);
create index if not exists plt_tempo_horas_extras_criado_por_idx on public.plt_tempo_horas_extras (criado_por);
create index if not exists plt_tempo_horas_extras_cancelada_por_idx on public.plt_tempo_horas_extras (cancelada_por);
comment on table public.plt_tempo_horas_extras is
  'SESSAO-42 (F2 · resposta 3): a hora extra AUTORIZADA (líder do setor ou admin) — dentro dela o tempo conta, e a pausa sozinha do fim do expediente acontece no fim dela. Do setor inteiro (usuario_id nulo) ou de uma pessoa. Cancelar não apaga (a trilha guarda).';

-- ----------------------------------------------------------------------------
-- 3 · A equipe no painel e os modelos
-- ----------------------------------------------------------------------------
create table if not exists public.plt_tempo_equipe (
  setor_id      bigint not null references public.plt_setores(id),
  usuario_id    uuid not null references public.plt_usuarios(id),
  papel         text not null check (papel in ('titular', 'apoio')),
  letra         text not null check (letra ~ '^[A-Z]{1,2}$'),
  atualizado_em timestamptz not null default now(),
  primary key (setor_id, usuario_id)
);
create unique index if not exists plt_tempo_equipe_letra_uk on public.plt_tempo_equipe (setor_id, letra);
create index if not exists plt_tempo_equipe_usuario_idx on public.plt_tempo_equipe (usuario_id);
comment on table public.plt_tempo_equipe is
  'SESSAO-42 (F2): quem aparece no painel de tempos de cada setor — titular ou apoio — e a LETRA que a TV mostra no lugar do nome (única no setor).';

-- equipe inicial (demanda): na MONTAGEM, Franklin e Franklinildo titulares, os
-- demais do setor apoio; letras A, B, C… na ordem de cadastro (o admin troca)
insert into public.plt_tempo_equipe (setor_id, usuario_id, papel, letra)
select x.setor_id, x.usuario_id, x.papel,
       case when x.n <= 26 then chr(64 + x.n::int) else chr(64 + ((x.n - 1) / 26)::int) || chr(65 + ((x.n - 1) % 26)::int) end
  from (
    select us.setor_id, u.id as usuario_id,
           case when s.codigo = 'montagem' and lower(split_part(btrim(u.nome), ' ', 1)) in ('franklin', 'franklinildo')
                then 'titular' else 'apoio' end as papel,
           row_number() over (partition by us.setor_id order by u.criado_em, u.id) as n
      from public.plt_usuario_setores us
      join public.plt_usuarios u on u.id = us.usuario_id
      join public.plt_setores s on s.id = us.setor_id
     where s.papel_no_fluxo = 'producao' and u.ativo and not u.conta_tablet and u.arquivado_em is null
       and u.papel <> 'logistica'
  ) x
on conflict do nothing;

create table if not exists public.plt_tempo_modelos (
  id            bigint generated always as identity primary key,
  nome          text not null check (length(btrim(nome)) between 1 and 160),
  confirmado    boolean not null default false,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  arquivado_em  timestamptz
);
create index if not exists plt_tempo_modelos_vivos_idx
  on public.plt_tempo_modelos (confirmado, nome) where arquivado_em is null;
comment on table public.plt_tempo_modelos is
  'SESSAO-42 (F2 · resposta 13): o MODELO de móvel no tempo padrão — as cores do mesmo móvel são o mesmo modelo. Nasce sugerido pelo sistema (confirmado = falso); o admin confirma, junta ou separa em Configurações → Controle de tempo → Modelos.';

create table if not exists public.plt_tempo_modelo_chaves (
  chave      text primary key,
  modelo_id  bigint not null references public.plt_tempo_modelos(id),
  exemplo    text not null default '',
  criado_em  timestamptz not null default now()
);
create index if not exists plt_tempo_modelo_chaves_modelo_idx on public.plt_tempo_modelo_chaves (modelo_id);
comment on table public.plt_tempo_modelo_chaves is
  'SESSAO-42 (F2): de que modelo é cada móvel — a chave é o nome limpo do móvel (sem número de pedido, sem "(n/m)", sem parênteses e sem a cor — fn_tempo_modelo_chave). Juntar = apontar as chaves para o mesmo modelo; separar = uma chave para um modelo novo.';

-- ----------------------------------------------------------------------------
-- 4 · A fila de recálculo (o processamento em lotes é da próxima migration)
-- ----------------------------------------------------------------------------
create table if not exists public.plt_tempo_recalculos (
  id            bigint generated always as identity primary key,
  de            timestamptz not null,
  ate           timestamptz not null,
  setor_id      bigint references public.plt_setores(id),
  -- 'tudo' refaz os cards; 'modelo' (juntar/separar) e 'regras' só reclassificam
  alcance       text not null default 'tudo' check (alcance in ('tudo', 'classificar')),
  motivo        text not null default '' check (length(motivo) <= 200),
  pedido_por    uuid references public.plt_usuarios(id),
  criado_em     timestamptz not null default now(),
  iniciado_em   timestamptz,
  concluido_em  timestamptz,
  total         integer,
  feitos        integer not null default 0,
  cursor_card   bigint not null default 0,
  erro          text,
  constraint plt_tempo_recalculos_periodo_ck check (ate >= de)
);
create index if not exists plt_tempo_recalculos_pendente_idx
  on public.plt_tempo_recalculos (id) where concluido_em is null;
create index if not exists plt_tempo_recalculos_lista_idx on public.plt_tempo_recalculos (criado_em desc, id desc);
create index if not exists plt_tempo_recalculos_setor_idx on public.plt_tempo_recalculos (setor_id);
create index if not exists plt_tempo_recalculos_pedido_por_idx on public.plt_tempo_recalculos (pedido_por);
comment on table public.plt_tempo_recalculos is
  'SESSAO-42 (F3 · regra 19): o pedido de recálculo — mudou calendário, horário, hora extra, regra ou modelo, o período afetado é refeito sozinho, em lotes (despertador por fato), com progresso (feitos/total) ao vivo. Os fatos nunca mudam.';

-- fechadas ao navegador: tudo passa pelas portas
alter table public.plt_tempo_config        enable row level security;
alter table public.plt_tempo_regras        enable row level security;
alter table public.plt_tempo_excecoes      enable row level security;
alter table public.plt_tempo_horas_extras  enable row level security;
alter table public.plt_tempo_equipe        enable row level security;
alter table public.plt_tempo_modelos       enable row level security;
alter table public.plt_tempo_modelo_chaves enable row level security;
alter table public.plt_tempo_recalculos    enable row level security;
revoke all on public.plt_tempo_config, public.plt_tempo_regras, public.plt_tempo_excecoes,
              public.plt_tempo_horas_extras, public.plt_tempo_equipe, public.plt_tempo_modelos,
              public.plt_tempo_modelo_chaves, public.plt_tempo_recalculos
  from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5 · O expediente da semana em faixas (dado — com o OK do dono): a faixa única
--     07:30–18:00 de hoje vira 07:30–12:00 e 13:00–18:00 (almoço 12–13 —
--     resposta 1). Setor SEM horário continua contando o dia inteiro (D-29) —
--     em produção todos os setores já têm o horário.
-- ----------------------------------------------------------------------------
insert into public.plt_horarios_funcionamento (escopo, setor_id, dia_semana, hora_inicio, hora_fim)
select 'setor', h.setor_id, h.dia_semana, x.ini, x.fim
  from public.plt_horarios_funcionamento h
  cross join (values (time '07:30', time '12:00'), (time '13:00', time '18:00')) as x(ini, fim)
 where h.escopo = 'setor' and h.hora_inicio = time '07:30' and h.hora_fim = time '18:00';
delete from public.plt_horarios_funcionamento h
 where h.escopo = 'setor' and h.hora_inicio = time '07:30' and h.hora_fim = time '18:00';

-- ----------------------------------------------------------------------------
-- 6 · As regras lidas com os padrões (setor sem linha = os padrões da demanda)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tempo_regra(p_setor_id bigint)
returns public.plt_tempo_regras
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select r from public.plt_tempo_regras r where r.setor_id = p_setor_id),
    row(p_setor_id, 3, null, 3, 5, true, 15, 5, true, true, false, false, 10, 90, now(), null)::public.plt_tempo_regras);
$$;
comment on function plt_privado.fn_tempo_regra(bigint) is
  'SESSAO-42: as regras de tempo de um setor (a linha de plt_tempo_regras, ou os padrões da demanda se o setor não tem linha).';

-- ----------------------------------------------------------------------------
-- 7 · A RÉGUA: as janelas que contam (um dono só — M-04)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tempo_janelas(
  p_setor_id   bigint,
  p_de         timestamptz,
  p_ate        timestamptz,
  p_usuario_id uuid default null
)
returns tstzmultirange
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with dias as (
    select d::date as dia
      from generate_series((p_de at time zone 'America/Fortaleza')::date,
                           (p_ate at time zone 'America/Fortaleza')::date,
                           interval '1 day') as d
     where p_ate > p_de
  ),
  -- a exceção do dia: a do setor vence a da fábrica
  exc as (
    select distinct on (d.dia) d.dia, e.tipo, e.faixas
      from dias d
      join public.plt_tempo_excecoes e
        on e.dia = d.dia and e.arquivado_em is null
       and (e.setor_id = p_setor_id or e.setor_id is null)
     order by d.dia, (e.setor_id is null), e.id desc
  ),
  tem as (
    select exists (select 1 from public.plt_horarios_funcionamento h
                    where h.escopo = 'setor' and h.setor_id = p_setor_id) as horario
  ),
  base as (
    -- o expediente da semana (as faixas do dia), nos dias sem exceção
    select tstzrange((d.dia + h.hora_inicio) at time zone 'America/Fortaleza',
                     (d.dia + h.hora_fim)    at time zone 'America/Fortaleza') as r
      from dias d
      join public.plt_horarios_funcionamento h
        on h.escopo = 'setor' and h.setor_id = p_setor_id
       and h.dia_semana = extract(dow from d.dia)::int
     where not exists (select 1 from exc where exc.dia = d.dia)
    union all
    -- setor sem horário nenhum: o dia inteiro conta (como sempre — D-29)
    select tstzrange(d.dia::timestamp at time zone 'America/Fortaleza',
                     (d.dia + 1)::timestamp at time zone 'America/Fortaleza')
      from dias d, tem
     where not tem.horario and not exists (select 1 from exc where exc.dia = d.dia)
    union all
    -- o dia trabalhado: só as faixas dele
    select tstzrange((exc.dia + (f.v ->> 0)::time) at time zone 'America/Fortaleza',
                     (exc.dia + (f.v ->> 1)::time) at time zone 'America/Fortaleza')
      from exc
      cross join lateral jsonb_array_elements(exc.faixas) as f(v)
     where exc.tipo = 'trabalhado' and (f.v ->> 1)::time > (f.v ->> 0)::time
  ),
  -- a hora extra autorizada (do setor; e da pessoa, quando a conta é dela)
  extras as (
    select tstzrange(x.inicio, x.fim) as r
      from public.plt_tempo_horas_extras x
     where x.setor_id = p_setor_id and x.cancelada_em is null
       and (x.usuario_id is null or x.usuario_id = p_usuario_id)
       and x.inicio < p_ate and x.fim > p_de
  ),
  pausas as (
    select coalesce(range_agg(tstzrange(pp.inicio, coalesce(pp.fim, now()))), '{}'::tstzmultirange) as mr
      from public.plt_pausas_tempo pp
     where ((pp.escopo = 'setor' and pp.setor_id = p_setor_id)
         or (p_usuario_id is not null and pp.escopo = 'usuario' and pp.usuario_id = p_usuario_id))
       and pp.inicio < p_ate and coalesce(pp.fim, now()) > p_de
  )
  select case when p_ate <= p_de then '{}'::tstzmultirange else
    ((coalesce((select range_agg(u.r) from (select r from base union all select r from extras) u
                 where not isempty(u.r)), '{}'::tstzmultirange)
      * tstzmultirange(tstzrange(p_de, p_ate)))
     - (select mr from pausas)) end;
$$;
comment on function plt_privado.fn_tempo_janelas(bigint, timestamptz, timestamptz, uuid) is
  'SESSAO-42 (F2 · regras 1 e 3): as janelas em que o tempo CONTA entre p_de e p_ate — o expediente do setor no dia (as faixas da semana; o almoço é o buraco entre elas) ou, no dia com exceção, a exceção (a do setor vence a da fábrica: feriado/parado = nada; trabalhado = as faixas dele); + a hora extra autorizada (do setor e, com p_usuario_id, a da pessoa); − as pausas de setor (e da pessoa). Setor sem horário nenhum conta o dia inteiro. Fuso America/Fortaleza fixo (sem horário de verão). O dono único da régua (M-04): fn_tempo_util, o corte e o cálculo único leem daqui.';
revoke all on function plt_privado.fn_tempo_janelas(bigint, timestamptz, timestamptz, uuid) from public, anon, authenticated;

-- a soma de um multirange, em segundos
create or replace function plt_privado.fn_tempo_segundos(p_mr tstzmultirange)
returns numeric
language sql
immutable
as $$
  select coalesce(sum(extract(epoch from upper(r) - lower(r))), 0)::numeric
    from unnest(coalesce(p_mr, '{}'::tstzmultirange)) as r;
$$;
revoke all on function plt_privado.fn_tempo_segundos(tstzmultirange) from public, anon, authenticated;

-- as janelas da fábrica (a pessoa "à deriva" não está em setor nenhum): a união
-- das janelas dos setores de produção
create or replace function plt_privado.fn_tempo_janelas_fabrica(p_de timestamptz, p_ate timestamptz, p_usuario_id uuid default null)
returns tstzmultirange
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(range_agg(j.r), '{}'::tstzmultirange)
    from public.plt_setores s
    cross join lateral unnest(plt_privado.fn_tempo_janelas(s.id, p_de, p_ate, p_usuario_id)) as j(r)
   where s.ativo and s.papel_no_fluxo = 'producao';
$$;
revoke all on function plt_privado.fn_tempo_janelas_fabrica(timestamptz, timestamptz, uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 8 · fn_tempo_util — mesma assinatura e mesmo significado (D-29), agora pela
--     régua: as janelas do setor (com exceções e hora extra) ∩ o horário da
--     pessoa (se ela tiver) − pausas de setor e de pessoa
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tempo_util(
  p_inicio     timestamptz,
  p_fim        timestamptz,
  p_setor_id   bigint,
  p_usuario_id uuid
)
returns interval
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_fim  timestamptz := coalesce(p_fim, now());
  v_mr   tstzmultirange;
  v_pess tstzmultirange;
begin
  if p_inicio is null or v_fim <= p_inicio then
    return interval '0';
  end if;
  v_mr := plt_privado.fn_tempo_janelas(p_setor_id, p_inicio, v_fim, p_usuario_id);
  -- o horário da PESSOA (D-29), quando ela tem: interseção, como sempre
  if p_usuario_id is not null
     and exists (select 1 from public.plt_horarios_funcionamento h
                  where h.escopo = 'usuario' and h.usuario_id = p_usuario_id) then
    select coalesce(range_agg(tstzrange((d.dia + h.hora_inicio) at time zone 'America/Fortaleza',
                                        (d.dia + h.hora_fim) at time zone 'America/Fortaleza')),
                    '{}'::tstzmultirange)
      into v_pess
      from (select g::date as dia
              from generate_series((p_inicio at time zone 'America/Fortaleza')::date,
                                   (v_fim at time zone 'America/Fortaleza')::date, interval '1 day') g) d
      join public.plt_horarios_funcionamento h
        on h.escopo = 'usuario' and h.usuario_id = p_usuario_id
       and h.dia_semana = extract(dow from d.dia)::int;
    v_mr := v_mr * v_pess;
  end if;
  return make_interval(secs => plt_privado.fn_tempo_segundos(v_mr)::double precision);
end;
$$;
comment on function plt_privado.fn_tempo_util(timestamptz, timestamptz, bigint, uuid) is
  'D-29 ↪️ SESSAO-42: o tempo que CONTA num intervalo — as janelas do setor pela régua única (fn_tempo_janelas: expediente em faixas, exceções do calendário, hora extra autorizada, pausas de setor/pessoa) ∩ o horário da pessoa (se ela tiver). Nunca altera eventos.';
revoke all on function plt_privado.fn_tempo_util(timestamptz, timestamptz, bigint, uuid) from public, anon;
grant execute on function plt_privado.fn_tempo_util(timestamptz, timestamptz, bigint, uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 9 · O CORTE do fim do expediente (regra 2): até quando um trecho que começou
--     em p_inicio pode contar. = o fim da última janela do DIA em que começou
--     (a hora extra entra junto; o almoço não corta); começou depois do fim do
--     expediente do dia → o começo da próxima janela (não conta nada). Nulo =
--     o setor não pausa sozinho (ou não tem janela nos próximos 10 dias).
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tempo_corte(
  p_setor_id   bigint,
  p_inicio     timestamptz,
  p_usuario_id uuid default null
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_dia   date := (p_inicio at time zone 'America/Fortaleza')::date;
  v_corte timestamptz;
  r       tstzrange;
begin
  if p_setor_id is null or p_inicio is null
     or not (plt_privado.fn_tempo_regra(p_setor_id)).pausar_fim_expediente then
    return null;
  end if;
  for r in
    select x from unnest(plt_privado.fn_tempo_janelas(p_setor_id, p_inicio, p_inicio + interval '10 days', p_usuario_id)) as x
     order by lower(x)
  loop
    if (lower(r) at time zone 'America/Fortaleza')::date <= v_dia then
      v_corte := upper(r);              -- ainda o mesmo dia: o fim vai para depois
    elsif v_corte is null then
      return lower(r);                  -- nada mais conta no dia: corta já no começo da próxima
    else
      return v_corte;
    end if;
  end loop;
  return v_corte;
end;
$$;
comment on function plt_privado.fn_tempo_corte(bigint, timestamptz, uuid) is
  'SESSAO-42 (regra 2): o instante em que o trecho que começou em p_inicio é pausado sozinho — o fim da última janela do dia (com hora extra; o almoço não corta); se começou depois do expediente do dia, o começo da próxima janela (não conta nada). Nulo = o setor não pausa sozinho. Ao vivo vira o fato "Fim do expediente"; no passado é só conta (nunca fato retroativo).';
revoke all on function plt_privado.fn_tempo_corte(bigint, timestamptz, uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 10 · O modelo de um móvel pelo nome (resposta 13 — sugerido; o admin ajusta)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tempo_modelo_nome(p_nome text)
returns text
language plpgsql
immutable
as $$
declare
  v       text := coalesce(p_nome, '');
  v_seg   text;
  v_saida text[] := '{}';
  v_cores constant text :=
    '\m(branc[oa]|pret[oa]|off ?white|offwhite|white|black|cinza|grafite|chumbo|freij[oó]|carvalho|nogueira|amadeirad[oa]|cumaru|r[uú]stic[oa]|mel|tabaco|imbuia|cedro|marrom|bege|areia|ros[ae]|azul|verde|vermelh[oa]|amarel[oa]|natural|castanho|avel[aã]|jequitib[aá]|ip[eê]|demoli[cç][aã]o|champagne|fendi|nude|caramelo|chocolate|gelo|p[eé]rola|prata|dourad[oa]|cobre|savana|canela|aveia|jade|terracota|mostarda|petr[oó]leo|lil[aá]s|cappuccino|capuccino|marfim|creme|nero|[oô]nix|tit[aâ]nio|wood|cinamomo|louro|ameixa|teca|anis|malva|menta)\M';
begin
  -- o número do pedido no começo ("13028 - ")
  v := regexp_replace(v, '^\s*\d+\s*-\s*', '');
  -- o contador "(1/2)" e qualquer observação entre parênteses
  v := regexp_replace(v, '\([^)]*\)', '', 'g');
  -- a cor: o pedaço entre " - " que só tem nome de cor (ex.: "Branco/Freijó")
  foreach v_seg in array regexp_split_to_array(v, '\s+-\s+') loop
    if btrim(regexp_replace(lower(v_seg), v_cores || '|[/&+,]|\me\M', '', 'g')) <> '' then
      v_saida := v_saida || btrim(v_seg);
    end if;
  end loop;
  v := array_to_string(v_saida, ' - ');
  v := btrim(regexp_replace(v, '\s+', ' ', 'g'));
  return nullif(v, '');
end;
$$;
comment on function plt_privado.fn_tempo_modelo_nome(text) is
  'SESSAO-42 (regra 17): o nome do MODELO a partir do nome do móvel — sem o número do pedido, sem "(n/m)", sem parênteses e sem o pedaço que é só a cor. Sugestão: o admin confirma, junta ou separa em Configurações.';

create or replace function plt_privado.fn_tempo_modelo_chave(p_nome text)
returns text
language sql
immutable
as $$
  select nullif(lower(translate(coalesce(plt_privado.fn_tempo_modelo_nome(p_nome), ''),
                                'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
                                'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')), '');
$$;
revoke all on function plt_privado.fn_tempo_modelo_nome(text) from public, anon, authenticated;
revoke all on function plt_privado.fn_tempo_modelo_chave(text) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 11 · Trilha, recálculo e quem pode o quê
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tempo_trilha(p_acao text, p_contexto jsonb)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (plt_privado.fn_usuario_atual(), p_acao, coalesce(p_contexto, '{}'::jsonb));
$$;
revoke all on function plt_privado.fn_tempo_trilha(text, jsonb) from public, anon, authenticated;

-- os setores em que a pessoa logada registra hora extra: admin, todos os de
-- produção; o líder, os que ele lidera
create or replace function plt_privado.fn_tempo_setores_hora_extra()
returns bigint[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(s.id order by s.ordem, s.id), '{}')
    from public.plt_setores s
   where s.ativo and s.papel_no_fluxo = 'producao'
     and (plt_privado.fn_eh_admin()
          or s.id in (select plt_privado.fn_setores_que_lidero()));
$$;
revoke all on function plt_privado.fn_tempo_setores_hora_extra() from public, anon, authenticated;

create or replace function plt_privado.fn_tempo_so_admin()
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not plt_privado.fn_eh_admin() then
    raise exception 'Só um administrador mexe nas regras de tempo.' using errcode = 'insufficient_privilege';
  end if;
end;
$$;
revoke all on function plt_privado.fn_tempo_so_admin() from public, anon, authenticated;

-- o despertador do recálculo: existe só enquanto há pedido na fila (Lei §4 —
-- o trabalho nasce do fato; sem fila, nada acorda)
create or replace function plt_privado.fn_tempo_recalculo_armar()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job bigint;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    return;
  end if;
  perform pg_advisory_xact_lock(hashtext('plt-tempo-recalculo'));
  select j.jobid into v_job from cron.job j where j.jobname = 'plt-tempo-recalculo';
  if exists (select 1 from public.plt_tempo_recalculos r where r.concluido_em is null) then
    if v_job is null then
      perform cron.schedule('plt-tempo-recalculo', '* * * * *', 'select plt_privado.fn_tempo_recalculo_processar()');
    end if;
  elsif v_job is not null then
    perform cron.unschedule(v_job);
  end if;
end;
$$;
comment on function plt_privado.fn_tempo_recalculo_armar() is
  'SESSAO-42 (regra 19): liga o despertador do recálculo (um lote por minuto) só enquanto há pedido na fila; fila vazia, desliga. Sem pg_cron (bateria), não faz nada — quem testa chama o processamento direto.';
revoke all on function plt_privado.fn_tempo_recalculo_armar() from public, anon, authenticated;

create or replace function plt_privado.fn_tempo_pedir_recalculo(
  p_de timestamptz, p_ate timestamptz, p_setor_id bigint, p_alcance text, p_motivo text
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_desde timestamptz;
  v_id    bigint;
  v_de    timestamptz;
  v_ate   timestamptz := least(coalesce(p_ate, now()), now());
begin
  select c.recalcular_desde::timestamp at time zone 'America/Fortaleza' into v_desde
    from public.plt_tempo_config c where c.id = 1;
  v_de := greatest(coalesce(p_de, v_desde), coalesce(v_desde, p_de));
  if v_ate < v_de then
    return null; -- o período mudado é futuro (ou antes do uso real): nada a refazer
  end if;
  perform pg_advisory_xact_lock(hashtext('plt-tempo-recalculo'));
  -- um pedido parecido que ainda não começou só cresce (rajada de mudanças = um recálculo)
  update public.plt_tempo_recalculos r
     set de = least(r.de, v_de), ate = greatest(r.ate, v_ate),
         alcance = case when r.alcance = 'tudo' or p_alcance = 'tudo' then 'tudo' else 'classificar' end,
         motivo = left(r.motivo || '; ' || coalesce(p_motivo, ''), 200)
   where r.id = (select x.id from public.plt_tempo_recalculos x
                  where x.concluido_em is null and x.iniciado_em is null
                    and x.setor_id is not distinct from p_setor_id
                  order by x.id desc limit 1)
  returning r.id into v_id;
  if v_id is null then
    insert into public.plt_tempo_recalculos (de, ate, setor_id, alcance, motivo, pedido_por)
      values (v_de, v_ate, p_setor_id, coalesce(p_alcance, 'tudo'), left(coalesce(p_motivo, ''), 200),
              plt_privado.fn_usuario_atual())
      returning id into v_id;
  end if;
  perform plt_privado.fn_tempo_recalculo_armar();
  perform plt_privado.fn_avisar('tempos');
  return v_id;
end;
$$;
comment on function plt_privado.fn_tempo_pedir_recalculo(timestamptz, timestamptz, bigint, text, text) is
  'SESSAO-42 (regra 19): pede o recálculo de um período (só o que já aconteceu, desde plt_tempo_config.recalcular_desde); um pedido parecido ainda na fila só cresce. Liga o despertador.';
revoke all on function plt_privado.fn_tempo_pedir_recalculo(timestamptz, timestamptz, bigint, text, text) from public, anon, authenticated;

-- o calendário (ou o horário, ou a hora extra) mudou: refazer o período
-- (a migration da origem acrescenta: remarcar o corte dos cards rodando)
create or replace function plt_privado.fn_tempo_calendario_mudou(
  p_setor_id bigint, p_de timestamptz, p_ate timestamptz, p_motivo text
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return plt_privado.fn_tempo_pedir_recalculo(p_de, p_ate, p_setor_id, 'tudo', p_motivo);
end;
$$;
revoke all on function plt_privado.fn_tempo_calendario_mudou(bigint, timestamptz, timestamptz, text) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 12 · Aba EXPEDIENTE E INTERVALOS — uma porta para ler, uma para salvar
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_tempo_expediente()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform plt_privado.fn_tempo_so_admin();
  return jsonb_build_object('setores', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', s.id, 'nome', s.nome, 'papel', s.papel_no_fluxo,
             'faixas', coalesce((
               select jsonb_agg(jsonb_build_array(h.dia_semana, to_char(h.hora_inicio, 'HH24:MI'), to_char(h.hora_fim, 'HH24:MI'))
                                order by h.dia_semana, h.hora_inicio)
                 from public.plt_horarios_funcionamento h
                where h.escopo = 'setor' and h.setor_id = s.id), '[]'::jsonb))
           order by case s.papel_no_fluxo when 'entrada' then 0 when 'producao' then 1 else 2 end, s.ordem, s.id)
      from public.plt_setores s
     where s.ativo), '[]'::jsonb));
end;
$$;
comment on function public.plt_fn_tempo_expediente() is
  'SESSAO-42 (F2 · aba Expediente e intervalos): os setores ativos com as faixas da semana [dia (0 = domingo), início, fim]. Só admin. Uma requisição.';

create or replace function public.plt_fn_tempo_expediente_salvar(
  p_setor_id bigint, p_faixas jsonb, p_copiar_para_todos boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_alvos  bigint[];
  v_alvo   bigint;
  v_antes  jsonb;
  v_f      jsonb;
  v_dia    integer;
  v_ini    time;
  v_fim    time;
  v_n      integer := 0;
begin
  perform plt_privado.fn_tempo_so_admin();
  if p_faixas is null or jsonb_typeof(p_faixas) <> 'array' or jsonb_array_length(p_faixas) > 70 then
    raise exception 'Mande as faixas da semana (dia, início, fim).' using errcode = 'invalid_parameter_value';
  end if;
  if not exists (select 1 from public.plt_setores s where s.id = p_setor_id and s.ativo) then
    raise exception 'Setor % não existe.', p_setor_id using errcode = 'no_data_found';
  end if;
  -- cada faixa válida e sem sobrepor outra do mesmo dia
  for v_f in select * from jsonb_array_elements(p_faixas) loop
    begin
      v_dia := (v_f ->> 0)::int; v_ini := (v_f ->> 1)::time; v_fim := (v_f ->> 2)::time;
    exception when others then
      raise exception 'Faixa inválida: use o dia (0 a 6) e as horas no formato 07:30.' using errcode = 'invalid_parameter_value';
    end;
    if v_dia not between 0 and 6 or v_fim <= v_ini then
      raise exception 'Cada faixa termina depois de começar (ex.: 07:30 às 12:00).' using errcode = 'invalid_parameter_value';
    end if;
  end loop;
  if exists (
    select 1
      from jsonb_array_elements(p_faixas) with ordinality a(v, i), jsonb_array_elements(p_faixas) with ordinality b(v, j)
     where a.i < b.j and (a.v ->> 0) = (b.v ->> 0)
       and (a.v ->> 1)::time < (b.v ->> 2)::time and (b.v ->> 1)::time < (a.v ->> 2)::time) then
    raise exception 'Duas faixas do mesmo dia se sobrepõem — o intervalo (almoço) é o espaço entre elas.' using errcode = 'invalid_parameter_value';
  end if;

  v_alvos := case when coalesce(p_copiar_para_todos, false)
                  then (select array_agg(s.id) from public.plt_setores s
                         where s.ativo and s.papel_no_fluxo in ('entrada', 'producao'))
                  else array[p_setor_id] end;
  foreach v_alvo in array v_alvos loop
    select coalesce(jsonb_agg(jsonb_build_array(h.dia_semana, to_char(h.hora_inicio, 'HH24:MI'), to_char(h.hora_fim, 'HH24:MI'))
                              order by h.dia_semana, h.hora_inicio), '[]'::jsonb)
      into v_antes
      from public.plt_horarios_funcionamento h where h.escopo = 'setor' and h.setor_id = v_alvo;
    delete from public.plt_horarios_funcionamento h where h.escopo = 'setor' and h.setor_id = v_alvo;
    insert into public.plt_horarios_funcionamento (escopo, setor_id, dia_semana, hora_inicio, hora_fim)
      select 'setor', v_alvo, (f ->> 0)::int, (f ->> 1)::time, (f ->> 2)::time
        from jsonb_array_elements(p_faixas) f;
    perform plt_privado.fn_tempo_trilha('tempo_expediente_alterado',
      jsonb_build_object('setor_id', v_alvo, 'antes', v_antes, 'depois', p_faixas));
    -- o horário vale para o passado também: refaz desde o começo do uso real
    perform plt_privado.fn_tempo_calendario_mudou(v_alvo, null, now(), 'Expediente alterado');
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('setores', v_n);
end;
$$;
comment on function public.plt_fn_tempo_expediente_salvar(bigint, jsonb, boolean) is
  'SESSAO-42 (F2): grava as faixas da semana de um setor (ou copia para todos os de produção e o PCP) — [[dia, "HH:MM", "HH:MM"], …]; o intervalo é o espaço entre duas faixas. Trilha antes/depois e pede o recálculo. Só admin.';

-- ----------------------------------------------------------------------------
-- 13 · Aba CALENDÁRIO
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_tempo_calendario(p_de date, p_ate date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform plt_privado.fn_tempo_so_admin();
  if p_de is null or p_ate is null or p_ate < p_de or p_ate - p_de > 400 then
    raise exception 'Escolha um período de até 400 dias.' using errcode = 'invalid_parameter_value';
  end if;
  return jsonb_build_object(
    'excecoes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e.id, 'setor_id', e.setor_id, 'setor', s.nome, 'dia', e.dia, 'tipo', e.tipo,
               'descricao', e.descricao, 'faixas', e.faixas, 'por', u.nome)
             order by e.dia, e.setor_id nulls first)
        from public.plt_tempo_excecoes e
        left join public.plt_setores s on s.id = e.setor_id
        left join public.plt_usuarios u on u.id = e.criado_por
       where e.arquivado_em is null and e.dia between p_de and p_ate), '[]'::jsonb),
    'setores', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome) order by s.ordem, s.id)
        from public.plt_setores s
       where s.ativo and s.papel_no_fluxo in ('entrada', 'producao')), '[]'::jsonb));
end;
$$;
comment on function public.plt_fn_tempo_calendario(date, date) is
  'SESSAO-42 (F2 · aba Calendário): as exceções do período (feriado, dia trabalhado com faixas, dia parado — da fábrica ou de um setor) e os setores para escolher. Só admin; até 400 dias.';

create or replace function public.plt_fn_tempo_excecao_salvar(
  p_id bigint, p_setor_id bigint, p_dia date, p_tipo text, p_descricao text, p_faixas jsonb default '[]'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_antes public.plt_tempo_excecoes%rowtype;
  v_id    bigint;
  v_f     jsonb;
  v_ok    boolean;
  v_dia_antes date;
begin
  perform plt_privado.fn_tempo_so_admin();
  if p_dia is null or p_tipo is null or p_tipo not in ('feriado', 'trabalhado', 'parado') then
    raise exception 'Diga o dia e se é feriado, dia trabalhado ou dia parado.' using errcode = 'invalid_parameter_value';
  end if;
  if p_setor_id is not null and not exists (select 1 from public.plt_setores s where s.id = p_setor_id and s.ativo) then
    raise exception 'Setor % não existe.', p_setor_id using errcode = 'no_data_found';
  end if;
  if p_tipo = 'trabalhado' then
    if p_faixas is null or jsonb_typeof(p_faixas) <> 'array' or jsonb_array_length(p_faixas) not between 1 and 6 then
      raise exception 'O dia trabalhado precisa do horário (de 1 a 6 faixas).' using errcode = 'invalid_parameter_value';
    end if;
    for v_f in select * from jsonb_array_elements(p_faixas) loop
      begin
        v_ok := (v_f ->> 1)::time > (v_f ->> 0)::time;
      exception when others then
        v_ok := false;
      end;
      if not coalesce(v_ok, false) then
        raise exception 'Cada faixa termina depois de começar (ex.: 07:30 às 12:00).' using errcode = 'invalid_parameter_value';
      end if;
    end loop;
  end if;
  if p_id is not null then
    select * into v_antes from public.plt_tempo_excecoes where id = p_id and arquivado_em is null for update;
    if v_antes.id is null then
      raise exception 'Esta exceção não existe mais.' using errcode = 'no_data_found';
    end if;
    update public.plt_tempo_excecoes set arquivado_em = now(), arquivado_por = plt_privado.fn_usuario_atual()
     where id = p_id;
    v_dia_antes := v_antes.dia;
  end if;
  if exists (select 1 from public.plt_tempo_excecoes e
              where e.arquivado_em is null and e.dia = p_dia and e.setor_id is not distinct from p_setor_id) then
    raise exception 'Este dia já tem uma exceção para %. Edite a que existe.',
      coalesce((select s.nome from public.plt_setores s where s.id = p_setor_id), 'a fábrica toda')
      using errcode = 'unique_violation';
  end if;
  insert into public.plt_tempo_excecoes (setor_id, dia, tipo, descricao, faixas, criado_por)
    values (p_setor_id, p_dia, p_tipo, left(btrim(coalesce(p_descricao, '')), 120),
            case when p_tipo = 'trabalhado' then p_faixas else '[]'::jsonb end, plt_privado.fn_usuario_atual())
    returning id into v_id;
  perform plt_privado.fn_tempo_trilha('tempo_calendario_alterado', jsonb_build_object(
    'antes', case when v_antes.id is null then null else to_jsonb(v_antes) - 'arquivado_em' - 'arquivado_por' end,
    'depois', jsonb_build_object('id', v_id, 'setor_id', p_setor_id, 'dia', p_dia, 'tipo', p_tipo,
                                 'descricao', p_descricao, 'faixas', p_faixas)));
  perform plt_privado.fn_tempo_calendario_mudou(p_setor_id,
    (least(p_dia, coalesce(v_dia_antes, p_dia))::timestamp at time zone 'America/Fortaleza'),
    ((greatest(p_dia, coalesce(v_dia_antes, p_dia)) + 1)::timestamp at time zone 'America/Fortaleza'),
    'Calendário alterado');
  return v_id;
end;
$$;
comment on function public.plt_fn_tempo_excecao_salvar(bigint, bigint, date, text, text, jsonb) is
  'SESSAO-42 (F2): cria (p_id nulo) ou troca uma exceção do calendário — feriado, dia trabalhado (com as faixas) ou dia parado; da fábrica (setor nulo) ou de um setor. Trocar = arquivar a antiga e criar a nova (a trilha guarda as duas). Pede o recálculo do dia. Só admin.';

create or replace function public.plt_fn_tempo_excecao_remover(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_antes public.plt_tempo_excecoes%rowtype;
begin
  perform plt_privado.fn_tempo_so_admin();
  update public.plt_tempo_excecoes set arquivado_em = now(), arquivado_por = plt_privado.fn_usuario_atual()
   where id = p_id and arquivado_em is null
  returning * into v_antes;
  if v_antes.id is null then
    return; -- já removida: nada a fazer
  end if;
  perform plt_privado.fn_tempo_trilha('tempo_calendario_alterado',
    jsonb_build_object('antes', to_jsonb(v_antes) - 'arquivado_em' - 'arquivado_por', 'depois', null));
  perform plt_privado.fn_tempo_calendario_mudou(v_antes.setor_id,
    v_antes.dia::timestamp at time zone 'America/Fortaleza',
    (v_antes.dia + 1)::timestamp at time zone 'America/Fortaleza', 'Calendário alterado');
end;
$$;

-- ----------------------------------------------------------------------------
-- 14 · Aba HORA EXTRA — o líder vê só esta aba e só os seus setores
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_tempo_horas_extras(
  p_limite integer default 30, p_antes_em timestamptz default null, p_antes_id bigint default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_setores bigint[] := plt_privado.fn_tempo_setores_hora_extra();
  v_lim     integer := least(greatest(coalesce(p_limite, 30), 1), 100);
  v_itens   jsonb;
  v_n       integer;
begin
  if cardinality(v_setores) = 0 then
    raise exception 'A hora extra é registrada pelo líder do setor ou por um administrador.'
      using errcode = 'insufficient_privilege';
  end if;
  select coalesce(jsonb_agg(x.j order by x.inicio desc, x.id desc), '[]'::jsonb), count(*)
    into v_itens, v_n
    from (
      select h.inicio, h.id, jsonb_build_object(
               'id', h.id, 'setor_id', h.setor_id, 'setor', s.nome, 'usuario_id', h.usuario_id,
               'pessoa', p.nome, 'inicio', h.inicio, 'fim', h.fim, 'motivo', h.motivo,
               'por', c.nome, 'criado_em', h.criado_em, 'cancelada_em', h.cancelada_em) as j
        from public.plt_tempo_horas_extras h
        join public.plt_setores s on s.id = h.setor_id
        left join public.plt_usuarios p on p.id = h.usuario_id
        left join public.plt_usuarios c on c.id = h.criado_por
       where h.setor_id = any (v_setores)
         and (p_antes_em is null or (h.inicio, h.id) < (p_antes_em, coalesce(p_antes_id, 9223372036854775807)))
       order by h.inicio desc, h.id desc
       limit v_lim + 1) x;
  return jsonb_build_object(
    'itens', case when v_n > v_lim then v_itens - v_lim else v_itens end,
    'tem_mais', v_n > v_lim,
    'setores', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome) order by s.ordem, s.id)
                           from public.plt_setores s where s.id = any (v_setores)), '[]'::jsonb),
    'pessoas', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome, 'setores', x.setores) order by x.nome)
        from (select u.id, u.nome, array_agg(us.setor_id order by us.setor_id) as setores
                from public.plt_usuario_setores us
                join public.plt_usuarios u on u.id = us.usuario_id
               where us.setor_id = any (v_setores) and u.ativo and not u.conta_tablet and u.arquivado_em is null
               group by u.id, u.nome) x), '[]'::jsonb),
    'admin', plt_privado.fn_eh_admin());
end;
$$;
comment on function public.plt_fn_tempo_horas_extras(integer, timestamptz, bigint) is
  'SESSAO-42 (F2 · aba Hora extra): as horas extras dos setores que a pessoa pode autorizar (admin: todos; líder: os seus), da mais nova para a mais antiga, por cursor (início, id), teto 100; + os setores e as pessoas deles para o formulário. Uma requisição.';

create or replace function public.plt_fn_tempo_hora_extra_salvar(
  p_setor_id bigint, p_usuario_id uuid, p_inicio timestamptz, p_fim timestamptz, p_motivo text default ''
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
begin
  if p_setor_id is null or not (p_setor_id = any (plt_privado.fn_tempo_setores_hora_extra())) then
    raise exception 'Hora extra deste setor é autorizada pelo líder dele ou por um administrador.'
      using errcode = 'insufficient_privilege';
  end if;
  if p_inicio is null or p_fim is null or p_fim <= p_inicio then
    raise exception 'A hora extra termina depois de começar.' using errcode = 'invalid_parameter_value';
  end if;
  if p_fim - p_inicio > interval '16 hours' then
    raise exception 'Uma hora extra tem no máximo 16 horas — divida em duas.' using errcode = 'invalid_parameter_value';
  end if;
  if p_usuario_id is not null and not exists (
       select 1 from public.plt_usuarios u where u.id = p_usuario_id and u.ativo and not u.conta_tablet) then
    raise exception 'Pessoa não encontrada.' using errcode = 'no_data_found';
  end if;
  insert into public.plt_tempo_horas_extras (setor_id, usuario_id, inicio, fim, motivo, criado_por)
    values (p_setor_id, p_usuario_id, p_inicio, p_fim, left(btrim(coalesce(p_motivo, '')), 200), plt_privado.fn_usuario_atual())
    returning id into v_id;
  perform plt_privado.fn_tempo_trilha('tempo_hora_extra_registrada', jsonb_build_object(
    'antes', null, 'depois', jsonb_build_object('id', v_id, 'setor_id', p_setor_id, 'usuario_id', p_usuario_id,
                                                'inicio', p_inicio, 'fim', p_fim, 'motivo', p_motivo)));
  perform plt_privado.fn_tempo_calendario_mudou(p_setor_id, p_inicio, p_fim, 'Hora extra registrada');
  return v_id;
end;
$$;
comment on function public.plt_fn_tempo_hora_extra_salvar(bigint, uuid, timestamptz, timestamptz, text) is
  'SESSAO-42 (F2 · resposta 3): registra a hora extra autorizada — do setor inteiro (pessoa nula) ou de uma pessoa; até 16 h. Líder do setor ou admin. Trilha e recálculo do período (e, ao vivo, o corte dos cards rodando passa para o fim dela).';

create or replace function public.plt_fn_tempo_hora_extra_cancelar(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_h public.plt_tempo_horas_extras%rowtype;
begin
  select * into v_h from public.plt_tempo_horas_extras where id = p_id for update;
  if v_h.id is null then
    raise exception 'Hora extra não encontrada.' using errcode = 'no_data_found';
  end if;
  if not (v_h.setor_id = any (plt_privado.fn_tempo_setores_hora_extra())) then
    raise exception 'Hora extra deste setor é do líder dele ou de um administrador.' using errcode = 'insufficient_privilege';
  end if;
  if v_h.cancelada_em is not null then
    return;
  end if;
  update public.plt_tempo_horas_extras set cancelada_em = now(), cancelada_por = plt_privado.fn_usuario_atual()
   where id = p_id;
  perform plt_privado.fn_tempo_trilha('tempo_hora_extra_cancelada',
    jsonb_build_object('antes', to_jsonb(v_h), 'depois', null));
  perform plt_privado.fn_tempo_calendario_mudou(v_h.setor_id, v_h.inicio, v_h.fim, 'Hora extra cancelada');
end;
$$;

-- ----------------------------------------------------------------------------
-- 15 · Aba REGRAS POR SETOR (+ a data oficial)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_tempo_regras()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform plt_privado.fn_tempo_so_admin();
  return jsonb_build_object(
    'config', (select jsonb_build_object('data_oficial', c.data_oficial, 'recalcular_desde', c.recalcular_desde)
                 from public.plt_tempo_config c where c.id = 1),
    'setores', coalesce((
      select jsonb_agg(jsonb_build_object(
               'setor_id', s.id, 'nome', s.nome, 'aviso_esquecido_min', s.aviso_esquecido_min)
               || (to_jsonb(plt_privado.fn_tempo_regra(s.id)) - 'setor_id' - 'atualizado_em' - 'atualizado_por')
             order by s.ordem, s.id)
        from public.plt_setores s
       where s.ativo and s.papel_no_fluxo = 'producao'), '[]'::jsonb));
end;
$$;
comment on function public.plt_fn_tempo_regras() is
  'SESSAO-42 (F2 · aba Regras por setor): a data oficial e, por setor de produção, as regras de tempo válido + o aviso de card esquecido. Só admin. Uma requisição.';

create or replace function public.plt_fn_tempo_regras_salvar(p_setor_id bigint, p_regras jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_antes  jsonb;
  v_depois jsonb;
  v_aviso_antes integer;
  v_r      public.plt_tempo_regras;
  v_chave  text;
begin
  perform plt_privado.fn_tempo_so_admin();
  if not exists (select 1 from public.plt_setores s where s.id = p_setor_id and s.papel_no_fluxo = 'producao') then
    raise exception 'As regras de tempo são dos setores de produção.' using errcode = 'invalid_parameter_value';
  end if;
  if p_regras is null or jsonb_typeof(p_regras) <> 'object' then
    raise exception 'Mande as regras a mudar.' using errcode = 'invalid_parameter_value';
  end if;
  for v_chave in select jsonb_object_keys(p_regras) loop
    if v_chave not in ('minimo_min', 'teto_min', 'fator_longo', 'base_minima', 'pausar_fim_expediente',
                       'sem_resposta_min', 'volta_rapida_min', 'retrabalho_fora', 'admin_fora', 'avisar_pulo',
                       'permite_lote', 'faixa_media_pct', 'janela_padrao_dias', 'aviso_esquecido_min') then
      raise exception 'Regra desconhecida: %.', v_chave using errcode = 'invalid_parameter_value';
    end if;
  end loop;
  insert into public.plt_tempo_regras (setor_id) values (p_setor_id) on conflict (setor_id) do nothing;
  select to_jsonb(r) - 'atualizado_em' - 'atualizado_por', s.aviso_esquecido_min
    into v_antes, v_aviso_antes
    from public.plt_tempo_regras r join public.plt_setores s on s.id = r.setor_id
   where r.setor_id = p_setor_id for update of r;
  begin
    update public.plt_tempo_regras r set
      minimo_min            = case when p_regras ? 'minimo_min' then (p_regras ->> 'minimo_min')::int else r.minimo_min end,
      teto_min              = case when p_regras ? 'teto_min' then (p_regras ->> 'teto_min')::int else r.teto_min end,
      fator_longo           = case when p_regras ? 'fator_longo' then (p_regras ->> 'fator_longo')::numeric else r.fator_longo end,
      base_minima           = case when p_regras ? 'base_minima' then (p_regras ->> 'base_minima')::int else r.base_minima end,
      pausar_fim_expediente = case when p_regras ? 'pausar_fim_expediente' then (p_regras ->> 'pausar_fim_expediente')::boolean else r.pausar_fim_expediente end,
      sem_resposta_min      = case when p_regras ? 'sem_resposta_min' then (p_regras ->> 'sem_resposta_min')::int else r.sem_resposta_min end,
      volta_rapida_min      = case when p_regras ? 'volta_rapida_min' then (p_regras ->> 'volta_rapida_min')::int else r.volta_rapida_min end,
      retrabalho_fora       = case when p_regras ? 'retrabalho_fora' then (p_regras ->> 'retrabalho_fora')::boolean else r.retrabalho_fora end,
      admin_fora            = case when p_regras ? 'admin_fora' then (p_regras ->> 'admin_fora')::boolean else r.admin_fora end,
      avisar_pulo           = case when p_regras ? 'avisar_pulo' then (p_regras ->> 'avisar_pulo')::boolean else r.avisar_pulo end,
      permite_lote          = case when p_regras ? 'permite_lote' then (p_regras ->> 'permite_lote')::boolean else r.permite_lote end,
      faixa_media_pct       = case when p_regras ? 'faixa_media_pct' then (p_regras ->> 'faixa_media_pct')::int else r.faixa_media_pct end,
      janela_padrao_dias    = case when p_regras ? 'janela_padrao_dias' then (p_regras ->> 'janela_padrao_dias')::int else r.janela_padrao_dias end,
      atualizado_em = now(), atualizado_por = plt_privado.fn_usuario_atual()
     where r.setor_id = p_setor_id
    returning r.* into v_r;
    if p_regras ? 'aviso_esquecido_min' then
      update public.plt_setores set aviso_esquecido_min = (p_regras ->> 'aviso_esquecido_min')::int
       where id = p_setor_id;
    end if;
  exception
    when check_violation then
      raise exception 'Algum valor está fora do permitido (ex.: o aviso de card esquecido vai de 10 a 1440 minutos; o fator, de 1,2 a 20).'
        using errcode = 'check_violation';
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'Algum valor não é um número válido.' using errcode = 'invalid_parameter_value';
  end;
  v_depois := to_jsonb(v_r) - 'atualizado_em' - 'atualizado_por';
  perform plt_privado.fn_tempo_trilha('tempo_regras_alteradas', jsonb_build_object(
    'setor_id', p_setor_id,
    'antes', v_antes || jsonb_build_object('aviso_esquecido_min', v_aviso_antes),
    'depois', v_depois || jsonb_build_object('aviso_esquecido_min',
                (select s.aviso_esquecido_min from public.plt_setores s where s.id = p_setor_id))));
  -- só as regras de CONTA pedem recálculo (o lote e os avisos valem do gesto em diante)
  if exists (select 1 from jsonb_object_keys(p_regras) k
              where k not in ('permite_lote', 'avisar_pulo', 'aviso_esquecido_min', 'sem_resposta_min')) then
    perform plt_privado.fn_tempo_pedir_recalculo(null, now(), p_setor_id,
      case when exists (select 1 from jsonb_object_keys(p_regras) k
                         where k in ('pausar_fim_expediente', 'volta_rapida_min')) then 'tudo' else 'classificar' end,
      'Regras alteradas');
  end if;
  return v_depois;
end;
$$;
comment on function public.plt_fn_tempo_regras_salvar(bigint, jsonb) is
  'SESSAO-42 (F2): muda as regras de tempo de um setor (só as chaves mandadas) e o aviso de card esquecido. Trilha antes/depois; as regras de conta pedem o recálculo (o que muda trecho refaz tudo; o resto só reclassifica). Só admin.';

create or replace function public.plt_fn_tempo_config_salvar(p_data_oficial date)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_antes date;
begin
  perform plt_privado.fn_tempo_so_admin();
  if p_data_oficial is null or p_data_oficial < date '2026-01-01' or p_data_oficial > current_date then
    raise exception 'A data oficial é um dia de 2026 em diante, até hoje.' using errcode = 'invalid_parameter_value';
  end if;
  select data_oficial into v_antes from public.plt_tempo_config where id = 1 for update;
  if v_antes = p_data_oficial then
    return;
  end if;
  update public.plt_tempo_config set data_oficial = p_data_oficial, atualizado_em = now(),
         atualizado_por = plt_privado.fn_usuario_atual()
   where id = 1;
  perform plt_privado.fn_tempo_trilha('tempo_regras_alteradas',
    jsonb_build_object('antes', jsonb_build_object('data_oficial', v_antes),
                       'depois', jsonb_build_object('data_oficial', p_data_oficial)));
  perform plt_privado.fn_tempo_pedir_recalculo(null, now(), null, 'classificar', 'Data oficial alterada');
end;
$$;

-- ----------------------------------------------------------------------------
-- 16 · Aba EQUIPE NO PAINEL
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_tempo_equipe(p_setor_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform plt_privado.fn_tempo_so_admin();
  return jsonb_build_object(
    'setores', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome) order by s.ordem, s.id)
                           from public.plt_setores s where s.ativo and s.papel_no_fluxo = 'producao'), '[]'::jsonb),
    'pessoas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'usuario_id', u.id, 'nome', u.nome, 'foto', u.foto_caminho,
               'papel', e.papel, 'letra', e.letra,
               'do_setor', exists (select 1 from public.plt_usuario_setores us
                                    where us.usuario_id = u.id and us.setor_id = p_setor_id))
             order by e.papel nulls last, e.letra nulls last, u.nome)
        from public.plt_usuarios u
        left join public.plt_tempo_equipe e on e.usuario_id = u.id and e.setor_id = p_setor_id
       where u.ativo and not u.conta_tablet and u.arquivado_em is null and u.papel <> 'logistica'
         and (e.usuario_id is not null
              or exists (select 1 from public.plt_usuario_setores us
                          where us.usuario_id = u.id and us.setor_id = p_setor_id)
              or u.papel = 'admin' or u.pode_auxiliar)), '[]'::jsonb));
end;
$$;
comment on function public.plt_fn_tempo_equipe(bigint) is
  'SESSAO-42 (F2 · aba Equipe no painel): as pessoas que podem aparecer no painel do setor (do setor, admins e quem pode auxiliar) com o papel (titular/apoio) e a letra da TV. Só admin. Uma requisição por setor escolhido.';

create or replace function public.plt_fn_tempo_equipe_salvar(
  p_setor_id bigint, p_usuario_id uuid, p_papel text, p_letra text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_antes jsonb;
  v_letra text := upper(btrim(coalesce(p_letra, '')));
begin
  perform plt_privado.fn_tempo_so_admin();
  if not exists (select 1 from public.plt_setores s where s.id = p_setor_id and s.papel_no_fluxo = 'producao') then
    raise exception 'O painel de tempos é dos setores de produção.' using errcode = 'invalid_parameter_value';
  end if;
  select to_jsonb(e) into v_antes from public.plt_tempo_equipe e
   where e.setor_id = p_setor_id and e.usuario_id = p_usuario_id for update;
  if p_papel is null then
    delete from public.plt_tempo_equipe where setor_id = p_setor_id and usuario_id = p_usuario_id;
  else
    if p_papel not in ('titular', 'apoio') then
      raise exception 'O papel no painel é titular ou apoio.' using errcode = 'invalid_parameter_value';
    end if;
    if v_letra = '' then
      -- a letra que já era dela, ou a primeira livre no setor
      v_letra := coalesce(v_antes ->> 'letra', (
        select x.l
          from (select chr(64 + g) as l, g from generate_series(1, 26) g) x
         where not exists (select 1 from public.plt_tempo_equipe e
                            where e.setor_id = p_setor_id and e.letra = x.l and e.usuario_id <> p_usuario_id)
         order by x.g limit 1), '');
    end if;
    if v_letra !~ '^[A-Z]{1,2}$' then
      raise exception 'A letra da TV é uma ou duas letras (A a Z).' using errcode = 'invalid_parameter_value';
    end if;
    if exists (select 1 from public.plt_tempo_equipe e
                where e.setor_id = p_setor_id and e.letra = v_letra and e.usuario_id <> p_usuario_id) then
      raise exception 'A letra % já é de outra pessoa neste setor.', v_letra using errcode = 'unique_violation';
    end if;
    insert into public.plt_tempo_equipe (setor_id, usuario_id, papel, letra)
      values (p_setor_id, p_usuario_id, p_papel, v_letra)
      on conflict (setor_id, usuario_id) do update set papel = excluded.papel, letra = excluded.letra, atualizado_em = now();
  end if;
  perform plt_privado.fn_tempo_trilha('tempo_equipe_alterada', jsonb_build_object(
    'setor_id', p_setor_id, 'usuario_id', p_usuario_id, 'antes', v_antes,
    'depois', case when p_papel is null then null
                   else jsonb_build_object('papel', p_papel, 'letra', v_letra) end));
  return jsonb_build_object('papel', p_papel, 'letra', case when p_papel is null then null else v_letra end);
end;
$$;
comment on function public.plt_fn_tempo_equipe_salvar(bigint, uuid, text, text) is
  'SESSAO-42 (F2): põe (titular/apoio, com a letra da TV — sem letra, a que já era dela ou a primeira livre) ou tira (papel nulo) uma pessoa do painel do setor. A letra é única no setor. Trilha. Só admin.';

-- ----------------------------------------------------------------------------
-- 17 · Aba RECÁLCULO — os pedidos com o progresso; e o recálculo à mão
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_tempo_recalculos(p_limite integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform plt_privado.fn_tempo_so_admin();
  return jsonb_build_object('itens', coalesce((
    select jsonb_agg(x.j order by x.criado_em desc, x.id desc)
      from (select r.criado_em, r.id, jsonb_build_object(
                     'id', r.id, 'de', r.de, 'ate', r.ate, 'setor', s.nome, 'alcance', r.alcance,
                     'motivo', r.motivo, 'por', u.nome, 'criado_em', r.criado_em, 'iniciado_em', r.iniciado_em,
                     'concluido_em', r.concluido_em, 'total', r.total, 'feitos', r.feitos, 'erro', r.erro) as j
              from public.plt_tempo_recalculos r
              left join public.plt_setores s on s.id = r.setor_id
              left join public.plt_usuarios u on u.id = r.pedido_por
             order by r.criado_em desc, r.id desc
             limit least(greatest(coalesce(p_limite, 20), 1), 100)) x), '[]'::jsonb));
end;
$$;
comment on function public.plt_fn_tempo_recalculos(integer) is
  'SESSAO-42 (F2 · aba Recálculo): os pedidos de recálculo, do mais novo, com o progresso (feitos/total). Ao vivo pela área "tempos". Só admin.';

create or replace function public.plt_fn_tempo_recalcular(p_de date, p_ate date, p_setor_id bigint default null)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
begin
  perform plt_privado.fn_tempo_so_admin();
  if p_de is null or p_ate is null or p_ate < p_de then
    raise exception 'Escolha o período a recalcular.' using errcode = 'invalid_parameter_value';
  end if;
  v_id := plt_privado.fn_tempo_pedir_recalculo(p_de::timestamp at time zone 'America/Fortaleza',
                                               (p_ate + 1)::timestamp at time zone 'America/Fortaleza',
                                               p_setor_id, 'tudo', 'Pedido à mão');
  perform plt_privado.fn_tempo_trilha('tempo_recalculo_pedido',
    jsonb_build_object('de', p_de, 'ate', p_ate, 'setor_id', p_setor_id, 'recalculo_id', v_id));
  return v_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 18 · Permissões das portas
-- ----------------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'plt_fn_tempo_expediente()',
    'plt_fn_tempo_expediente_salvar(bigint, jsonb, boolean)',
    'plt_fn_tempo_calendario(date, date)',
    'plt_fn_tempo_excecao_salvar(bigint, bigint, date, text, text, jsonb)',
    'plt_fn_tempo_excecao_remover(bigint)',
    'plt_fn_tempo_horas_extras(integer, timestamptz, bigint)',
    'plt_fn_tempo_hora_extra_salvar(bigint, uuid, timestamptz, timestamptz, text)',
    'plt_fn_tempo_hora_extra_cancelar(bigint)',
    'plt_fn_tempo_regras()',
    'plt_fn_tempo_regras_salvar(bigint, jsonb)',
    'plt_fn_tempo_config_salvar(date)',
    'plt_fn_tempo_equipe(bigint)',
    'plt_fn_tempo_equipe_salvar(bigint, uuid, text, text)',
    'plt_fn_tempo_recalculos(integer)',
    'plt_fn_tempo_recalcular(date, date, bigint)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;
