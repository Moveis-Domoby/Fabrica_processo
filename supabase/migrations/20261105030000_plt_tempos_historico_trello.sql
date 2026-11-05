-- ============================================================================
-- SESSAO-43 · F4 (05/11/2026) — O HISTÓRICO DO TRELLO e as projeções que a
-- tela Tempos de produção lê.
--
-- 1. A EQUIPE de cada passagem (projeção, mantida no mesmo gesto que mede a
--    passagem): quem MONTOU (trecho de execução), quem AJUDOU (só auxílio), o
--    esforço de cada um, se algum trecho foi cortado no fim do expediente (ou
--    pelo card esquecido) e se houve clique errado (volta rápida descartada).
--    A tela lê daqui — nada de juntar trechos a cada abertura (Lei §7.1).
-- 2. O HISTÓRICO DO TRELLO numa tabela PRÓPRIA (as 891 montagens de 13/07 a
--    13/10 — o arquivo do painel antigo). NÃO são fatos da plataforma: nunca
--    entram em plt_eventos. Passam pela MESMA conta da SESSAO-42: as janelas do
--    setor (expediente com almoço, feriado, dia trabalhado) até o corte do fim
--    do dia (regras 1 e 2), o lote dividido (regra 6 — início e fim idênticos),
--    mínimo, teto e "longo para o modelo" (regras 7 e 8). O modelo vem do
--    agrupamento da 42 (a chave limpa do nome); o que não casa fica SEM modelo
--    até o admin ligar o nome (Configurações → Controle de tempo → Modelos).
--    O montador vem da etiqueta casada com a EQUIPE NO PAINEL do setor (titular
--    vence apoio; dois titulares = dupla, o esforço dividido; etiqueta de quem
--    não está na equipe do setor é ignorada).
-- 3. O PADRÃO COM O HISTÓRICO por setor × modelo (a mediana das válidas da
--    plataforma na janela do padrão + as válidas do Trello) — o que a tela usa
--    para comparar quando "incluir histórico do Trello" está ligado. O tempo
--    padrão OFICIAL (plt_tempo_padrao, o da 42) não muda: as regras de hoje
--    continuam lendo só a plataforma.
--
-- A carga é feita UMA vez, pelo script supabase/manutencao/2026-11-05_historico_trello.mjs
-- (com o OK do dono), chamando plt_privado.fn_tempo_trello_carregar — idempotente
-- (rodar de novo não duplica: refaz as contas das mesmas linhas).
-- Nada aqui altera tabela da integração.
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · A EQUIPE de cada passagem
-- ----------------------------------------------------------------------------
create table if not exists public.plt_tempo_passagem_equipe (
  passagem_id   bigint primary key references public.plt_tempo_passagens(id) on delete cascade,
  setor_id      bigint not null references public.plt_setores(id),
  dia           date,
  montadores    uuid[] not null default '{}',     -- quem executou (na ordem em que começou)
  ajudantes     uuid[] not null default '{}',     -- quem só auxiliou
  esforco       jsonb not null default '{}'::jsonb, -- {pessoa: segundos} (o esforço de cada um, já dividido)
  cortado       boolean not null default false,   -- trecho cortado no fim do expediente / sem resposta / esquecido
  clique_errado boolean not null default false    -- trecho descartado (volta rápida para a fila — regra 9)
);
create index if not exists plt_tempo_passagem_equipe_setor_dia_idx on public.plt_tempo_passagem_equipe (setor_id, dia);
comment on table public.plt_tempo_passagem_equipe is
  'SESSAO-43 (F1): PROJEÇÃO por passagem — quem montou (execução), quem ajudou (auxílio), o esforço de cada um, cortado no fim do expediente, clique errado. Escrita SÓ por gatilho no mesmo gesto que mede a passagem (plt_tempo_passagens). Lida pela tela Tempos de produção e pelo Modo TV.';
alter table public.plt_tempo_passagem_equipe enable row level security;
revoke all on public.plt_tempo_passagem_equipe from anon, authenticated;

create or replace function plt_privado.fn_tempo_equipe_refazer(p_passagem_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.plt_tempo_passagem_equipe as q
    (passagem_id, setor_id, dia, montadores, ajudantes, esforco, cortado, clique_errado)
  select p.id, p.setor_id, p.dia,
         coalesce((select array_agg(x.usuario_id order by x.primeiro, x.usuario_id)
                     from (select t.usuario_id, min(t.inicio) as primeiro
                             from public.plt_tempo_trechos t
                            where t.passagem_id = p.id and not t.descartado and t.papel = 'execucao'
                            group by t.usuario_id) x), '{}'),
         coalesce((select array_agg(x.usuario_id order by x.primeiro, x.usuario_id)
                     from (select t.usuario_id, min(t.inicio) as primeiro
                             from public.plt_tempo_trechos t
                            where t.passagem_id = p.id and not t.descartado and t.papel = 'auxilio'
                              and not exists (select 1 from public.plt_tempo_trechos e
                                               where e.passagem_id = p.id and not e.descartado
                                                 and e.papel = 'execucao' and e.usuario_id = t.usuario_id)
                            group by t.usuario_id) x), '{}'),
         coalesce((select jsonb_object_agg(x.usuario_id::text, x.s)
                     from (select t.usuario_id, round(sum(t.segundos)) as s
                             from public.plt_tempo_trechos t
                            where t.passagem_id = p.id and not t.descartado
                            group by t.usuario_id) x), '{}'::jsonb),
         exists (select 1 from public.plt_tempo_trechos t
                  where t.passagem_id = p.id and not t.descartado and t.fim is not null
                    and (t.fim_tipo in ('fim_expediente', 'sem_resposta', 'esquecido')
                         or (t.corte is not null and t.fim > t.corte))),
         exists (select 1 from public.plt_tempo_trechos t where t.passagem_id = p.id and t.descartado)
    from public.plt_tempo_passagens p
   where p.id = p_passagem_id
  on conflict (passagem_id) do update
    set setor_id = excluded.setor_id, dia = excluded.dia, montadores = excluded.montadores,
        ajudantes = excluded.ajudantes, esforco = excluded.esforco, cortado = excluded.cortado,
        clique_errado = excluded.clique_errado
  where (q.setor_id, q.dia, q.montadores, q.ajudantes, q.esforco, q.cortado, q.clique_errado)
        is distinct from (excluded.setor_id, excluded.dia, excluded.montadores, excluded.ajudantes,
                          excluded.esforco, excluded.cortado, excluded.clique_errado);
end;
$$;
comment on function plt_privado.fn_tempo_equipe_refazer(bigint) is
  'SESSAO-43: refaz a equipe de UMA passagem a partir dos trechos dela (índice por passagem) — montadores (execução), ajudantes (só auxílio), esforço de cada um, cortado, clique errado.';
revoke all on function plt_privado.fn_tempo_equipe_refazer(bigint) from public, anon, authenticated;

create or replace function plt_privado.fn_tempo_equipe_fato()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform plt_privado.fn_tempo_equipe_refazer(new.id);
  return null;
end;
$$;
revoke all on function plt_privado.fn_tempo_equipe_fato() from public, anon, authenticated;

-- a passagem é medida (fn_tempo_passagens_medir) DEPOIS dos trechos do card:
-- o gatilho de linha da medição já vê os trechos certos; apagar a passagem
-- (o card refeito) apaga a equipe junto (on delete cascade)
drop trigger if exists plt_tempo_passagens_zz_equipe on public.plt_tempo_passagens;
create trigger plt_tempo_passagens_zz_equipe
  after insert or update of dia, situacao, trechos_n, esforco_s, execucao_s, execucao_bruta_s, setor_id
  on public.plt_tempo_passagens
  for each row execute function plt_privado.fn_tempo_equipe_fato();

-- ----------------------------------------------------------------------------
-- 2 · O HISTÓRICO DO TRELLO
-- ----------------------------------------------------------------------------
create table if not exists public.plt_tempo_trello (
  id             bigint generated always as identity primary key,
  cartao_id      text not null,                   -- o "Card ID" do Trello (a chave da carga idempotente)
  cartao_nome    text not null,                   -- o nome como veio do Trello
  cartao_url     text,
  etiquetas      text[] not null default '{}',    -- as etiquetas como vieram (sem a cor)
  pedido_numero  integer,                         -- o número do pedido no começo do nome ("13028 - …")
  setor_id       bigint not null references public.plt_setores(id),
  inicio         timestamptz not null,
  fim            timestamptz not null,
  dia            date not null,                   -- o dia do FIM, no fuso da fábrica (regra 15)
  modelo_chave   text,                            -- a chave limpa do nome (a mesma régua da 42)
  modelo_id      bigint references public.plt_tempo_modelos(id), -- nulo = sem modelo (o admin liga)
  pessoas        uuid[] not null default '{}',    -- os montadores pela etiqueta
  lote_n         integer not null default 1,      -- cartões com início e fim idênticos (regra 6)
  bruto_s        numeric not null default 0,      -- fim − início em relógio corrido (só para o registro)
  util_s         numeric not null default 0,      -- as janelas do setor até o corte do dia (regras 1 e 2)
  execucao_s     numeric not null default 0,      -- o TEMPO DO MÓVEL: util_s ÷ lote_n
  esforco        jsonb not null default '{}'::jsonb, -- {pessoa: segundos} (a dupla divide)
  cortado        boolean not null default false,  -- o fim passou do corte do dia (a manhã seguinte não conta)
  situacao       text not null default 'valida' check (situacao in ('valida', 'conferir', 'descartada')),
  motivo         text,
  decisao        text check (decisao in ('considerar', 'descartar')),
  decisao_motivo text,
  decidido_por   uuid references public.plt_usuarios(id),
  decidido_em    timestamptz,
  carregado_em   timestamptz not null default now(),
  constraint plt_tempo_trello_cartao_uk unique (cartao_id),
  constraint plt_tempo_trello_periodo_ck check (fim >= inicio)
);
-- a busca da Conferir pelo nome (a mesma régua dos cards — A-112: guardada, com trigramas)
alter table public.plt_tempo_trello
  add column if not exists nome_busca text generated always as (plt_privado.fn_nome_comparavel(cartao_nome)) stored;
create index if not exists plt_tempo_trello_setor_dia_idx on public.plt_tempo_trello (setor_id, dia);
create index if not exists plt_tempo_trello_modelo_idx on public.plt_tempo_trello (setor_id, modelo_id, dia);
create index if not exists plt_tempo_trello_modelo_fk_idx on public.plt_tempo_trello (modelo_id);
create index if not exists plt_tempo_trello_chave_idx on public.plt_tempo_trello (modelo_chave);
create index if not exists plt_tempo_trello_pedido_idx on public.plt_tempo_trello (pedido_numero);
create index if not exists plt_tempo_trello_decidido_idx on public.plt_tempo_trello (decidido_por);
create index if not exists plt_tempo_trello_lote_idx on public.plt_tempo_trello (setor_id, inicio, fim);
create index if not exists plt_tempo_trello_nome_trgm on public.plt_tempo_trello using gin (nome_busca extensions.gin_trgm_ops);
comment on table public.plt_tempo_trello is
  'SESSAO-43 (F4): o HISTÓRICO DO TRELLO (montagens de 13/07 a 13/10/2026), carregado UMA vez — NÃO são fatos da plataforma (nunca em plt_eventos). Mesma conta da 42 (janelas até o corte do dia, lote dividido, mínimo, teto, longo para o modelo). A decisão manual (considerar/descartar) fica na linha e o rastro na trilha (plt_logs_atividade).';
alter table public.plt_tempo_trello enable row level security;
revoke all on public.plt_tempo_trello from anon, authenticated;

-- o padrão COM o histórico (a tela compara com ele quando o histórico está ligado)
create table if not exists public.plt_tempo_padrao_historico (
  setor_id      bigint not null references public.plt_setores(id),
  modelo_id     bigint not null references public.plt_tempo_modelos(id),
  mediana_s     numeric not null,
  p25_s         numeric not null,
  p75_s         numeric not null,
  n             integer not null,
  n_trello      integer not null default 0,
  atualizado_em timestamptz not null default now(),
  primary key (setor_id, modelo_id)
);
create index if not exists plt_tempo_padrao_historico_modelo_idx on public.plt_tempo_padrao_historico (modelo_id);
comment on table public.plt_tempo_padrao_historico is
  'SESSAO-43: o tempo padrão de setor × modelo CONTANDO o histórico do Trello — mediana, P25, P75 e n das válidas da plataforma na janela do padrão (as mesmas do plt_tempo_padrao) + as válidas do Trello. A tela usa este quando "incluir histórico do Trello" está ligado; as regras da plataforma seguem com o oficial.';
alter table public.plt_tempo_padrao_historico enable row level security;
revoke all on public.plt_tempo_padrao_historico from anon, authenticated;

create or replace function plt_privado.fn_tempo_padrao_historico_refazer(p_setor_id bigint, p_modelo_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n   integer;
  v_nt  integer;
  v_p25 numeric;
  v_med numeric;
  v_p75 numeric;
begin
  if p_setor_id is null or p_modelo_id is null then
    return;
  end if;
  with v as (
    select x.execucao_s, false as trello
      from public.plt_tempo_passagens x
     where x.setor_id = p_setor_id and x.modelo_id = p_modelo_id and x.situacao = 'valida'
       and x.dia >= (now() at time zone 'America/Fortaleza')::date
                    - (plt_privado.fn_tempo_regra(p_setor_id)).janela_padrao_dias
    union all
    select t.execucao_s, true
      from public.plt_tempo_trello t
     where t.setor_id = p_setor_id and t.modelo_id = p_modelo_id and t.situacao = 'valida'
  )
  select count(*), count(*) filter (where v.trello),
         percentile_cont(0.25) within group (order by v.execucao_s),
         percentile_cont(0.5)  within group (order by v.execucao_s),
         percentile_cont(0.75) within group (order by v.execucao_s)
    into v_n, v_nt, v_p25, v_med, v_p75
    from v;
  if v_n = 0 then
    delete from public.plt_tempo_padrao_historico where setor_id = p_setor_id and modelo_id = p_modelo_id;
  else
    insert into public.plt_tempo_padrao_historico (setor_id, modelo_id, mediana_s, p25_s, p75_s, n, n_trello, atualizado_em)
      values (p_setor_id, p_modelo_id, round(v_med, 1), round(v_p25, 1), round(v_p75, 1), v_n, v_nt, now())
      on conflict (setor_id, modelo_id) do update
        set mediana_s = excluded.mediana_s, p25_s = excluded.p25_s, p75_s = excluded.p75_s,
            n = excluded.n, n_trello = excluded.n_trello, atualizado_em = now();
  end if;
end;
$$;
revoke all on function plt_privado.fn_tempo_padrao_historico_refazer(bigint, bigint) from public, anon, authenticated;

-- o padrão oficial mudou (a passagem de um modelo fechou) → o com histórico acompanha
create or replace function plt_privado.fn_tempo_padrao_historico_fato()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform plt_privado.fn_tempo_padrao_historico_refazer(new.setor_id, new.modelo_id);
  end if;
  if tg_op in ('UPDATE', 'DELETE') and (tg_op = 'DELETE' or (old.setor_id, old.modelo_id) is distinct from (new.setor_id, new.modelo_id)) then
    perform plt_privado.fn_tempo_padrao_historico_refazer(old.setor_id, old.modelo_id);
  end if;
  return null;
end;
$$;
revoke all on function plt_privado.fn_tempo_padrao_historico_fato() from public, anon, authenticated;
drop trigger if exists plt_tempo_padrao_zz_historico on public.plt_tempo_padrao;
create trigger plt_tempo_padrao_zz_historico
  after insert or update or delete on public.plt_tempo_padrao
  for each row execute function plt_privado.fn_tempo_padrao_historico_fato();

-- as palavras de um nome, sem acento e sem maiúscula ("JOÃO PEDRO" → {joao,pedro})
create or replace function plt_privado.fn_tempo_palavras(p_texto text)
returns text[]
language sql
immutable
as $$
  select coalesce(array_remove(regexp_split_to_array(
           lower(translate(coalesce(p_texto, ''),
                           'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
                           'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')),
           '[^a-z0-9]+'), ''), '{}');
$$;
revoke all on function plt_privado.fn_tempo_palavras(text) from public, anon, authenticated;

-- a pessoa de UMA etiqueta, na equipe do setor: o 1º nome da pessoa tem de
-- estar entre as palavras da etiqueta ("FRANKLIN SILVA" casa com Franklin;
-- "Franklinildo" não); dois candidatos → desempata o 2º nome; ainda dois →
-- ninguém (ambíguo, fica no relatório)
create or replace function plt_privado.fn_tempo_trello_pessoa(p_setor_id bigint, p_etiqueta text)
returns table (usuario_id uuid, papel text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with l as (select plt_privado.fn_tempo_palavras(p_etiqueta) as w),
  c as (
    select e.usuario_id, e.papel, plt_privado.fn_tempo_palavras(u.nome) as p
      from public.plt_tempo_equipe e
      join public.plt_usuarios u on u.id = e.usuario_id
     where e.setor_id = p_setor_id
  ),
  c1 as (select c.* from c, l where cardinality(c.p) > 0 and c.p[1] = any (l.w)),
  c2 as (select c1.* from c1, l where cardinality(c1.p) > 1 and c1.p[2] = any (l.w))
  select usuario_id, papel from c1 where (select count(*) from c1) = 1
  union all
  select usuario_id, papel from c2 where (select count(*) from c1) > 1 and (select count(*) from c2) = 1;
$$;
revoke all on function plt_privado.fn_tempo_trello_pessoa(bigint, text) from public, anon, authenticated;

-- os montadores de um cartão: os titulares encontrados; sem titular, os de apoio
create or replace function plt_privado.fn_tempo_trello_montadores(p_setor_id bigint, p_etiquetas text[])
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with a as (
    select x.usuario_id, x.papel, min(et.ord) as ord
      from unnest(coalesce(p_etiquetas, '{}')) with ordinality as et(txt, ord)
      cross join lateral plt_privado.fn_tempo_trello_pessoa(p_setor_id, et.txt) x
     group by x.usuario_id, x.papel
  )
  select coalesce(
    (select array_agg(a.usuario_id order by a.ord) from a where a.papel = 'titular'),
    (select array_agg(a.usuario_id order by a.ord) from a where a.papel = 'apoio'),
    '{}');
$$;
revoke all on function plt_privado.fn_tempo_trello_montadores(bigint, text[]) from public, anon, authenticated;

-- a CONTA de cada linha (regras 1, 2 e 6): as janelas do setor do início até
-- o corte do dia (a manhã seguinte não conta, como na plataforma), o lote
-- (início e fim idênticos) dividido, e o esforço de cada montador (a dupla divide)
create or replace function plt_privado.fn_tempo_trello_medir(p_setor_id bigint)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer;
begin
  with m as (
    select t.id, t.pessoas,
           extract(epoch from t.fim - t.inicio) as bruto,
           plt_privado.fn_tempo_corte(t.setor_id, t.inicio, null) as corte,
           t.inicio, t.fim, t.setor_id,
           count(*) over (partition by t.setor_id, t.inicio, t.fim) as lote_n
      from public.plt_tempo_trello t
     where t.setor_id = p_setor_id
  ),
  u as (
    select m.*,
           plt_privado.fn_tempo_segundos(plt_privado.fn_tempo_janelas(
             m.setor_id, m.inicio, least(m.fim, coalesce(m.corte, m.fim)), null)) as util
      from m
  )
  update public.plt_tempo_trello t
     set bruto_s    = round(u.bruto::numeric, 3),
         util_s     = round(u.util, 3),
         lote_n     = u.lote_n,
         execucao_s = round(u.util / u.lote_n, 3),
         cortado    = u.corte is not null and u.fim > u.corte,
         esforco    = coalesce((select jsonb_object_agg(p::text, round(u.util / u.lote_n / cardinality(u.pessoas)))
                                  from unnest(u.pessoas) p), '{}'::jsonb)
    from u
   where t.id = u.id;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke all on function plt_privado.fn_tempo_trello_medir(bigint) from public, anon, authenticated;

-- a SITUAÇÃO de cada linha (regras 7, 8 e 14): a decisão manual vence; rápida
-- demais e acima do teto vão para Conferir; "longa para o modelo" = acima de
-- fator × a mediana das do MESMO modelo que passaram no mínimo e no teto (com
-- a base mínima) — a conta do histórico é dele mesmo (o padrão oficial da
-- plataforma não muda); depois o padrão com histórico dos modelos do setor
create or replace function plt_privado.fn_tempo_trello_classificar(p_setor_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r     public.plt_tempo_regras := plt_privado.fn_tempo_regra(p_setor_id);
  v_mod bigint;
begin
  with base as (
    select t.modelo_id,
           count(*) as n,
           percentile_cont(0.5) within group (order by t.execucao_s) as med
      from public.plt_tempo_trello t
     where t.setor_id = p_setor_id and t.modelo_id is not null
       and t.execucao_s >= r.minimo_min * 60
       and (r.teto_min is null or t.execucao_s <= r.teto_min * 60)
       and t.decisao is distinct from 'descartar'
     group by t.modelo_id
  ),
  c as (
    select t.id,
           case
             when t.decisao = 'considerar' then 'valida'
             when t.decisao = 'descartar' then 'descartada'
             when t.execucao_s < r.minimo_min * 60 then 'conferir'
             when r.teto_min is not null and t.execucao_s > r.teto_min * 60 then 'conferir'
             when b.n >= r.base_minima and t.execucao_s > r.fator_longo * b.med then 'conferir'
             else 'valida'
           end as situacao,
           case
             when t.decisao = 'considerar' then 'Considerada à mão'
             when t.decisao = 'descartar' then 'Descartada à mão'
             when t.execucao_s < r.minimo_min * 60 then 'Rápida demais'
             when r.teto_min is not null and t.execucao_s > r.teto_min * 60 then 'Acima do teto do setor'
             when b.n >= r.base_minima and t.execucao_s > r.fator_longo * b.med then 'Longa para o modelo'
           end as motivo
      from public.plt_tempo_trello t
      left join base b on b.modelo_id = t.modelo_id
     where t.setor_id = p_setor_id
  )
  update public.plt_tempo_trello t
     set situacao = c.situacao, motivo = c.motivo
    from c
   where t.id = c.id and (t.situacao, t.motivo) is distinct from (c.situacao, c.motivo);

  for v_mod in
    select distinct t.modelo_id from public.plt_tempo_trello t where t.setor_id = p_setor_id and t.modelo_id is not null
    union
    select h.modelo_id from public.plt_tempo_padrao_historico h where h.setor_id = p_setor_id
  loop
    perform plt_privado.fn_tempo_padrao_historico_refazer(p_setor_id, v_mod);
  end loop;
end;
$$;
revoke all on function plt_privado.fn_tempo_trello_classificar(bigint) from public, anon, authenticated;

-- o nome ligado a um modelo (a chave nova em plt_tempo_modelo_chaves, o
-- juntar ou o separar da aba Modelos) → as linhas do Trello com aquela chave
-- passam para o modelo novo e a situação é refeita (o "longo" lê o modelo)
create or replace function plt_privado.fn_tempo_trello_chave_mudou()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_setores bigint[];
  v_setor   bigint;
begin
  with m as (
    update public.plt_tempo_trello t set modelo_id = new.modelo_id
     where t.modelo_chave = new.chave and t.modelo_id is distinct from new.modelo_id
    returning t.setor_id
  )
  select array_agg(distinct m.setor_id) into v_setores from m;
  foreach v_setor in array coalesce(v_setores, '{}') loop
    perform plt_privado.fn_tempo_trello_classificar(v_setor);
  end loop;
  return null;
end;
$$;
revoke all on function plt_privado.fn_tempo_trello_chave_mudou() from public, anon, authenticated;
drop trigger if exists plt_tempo_modelo_chaves_zz_trello on public.plt_tempo_modelo_chaves;
create trigger plt_tempo_modelo_chaves_zz_trello
  after insert or update of modelo_id on public.plt_tempo_modelo_chaves
  for each row execute function plt_privado.fn_tempo_trello_chave_mudou();

-- as regras do setor mudaram (mínimo, teto, fator, base) → a situação do
-- histórico acompanha (a conta do tempo não muda)
create or replace function plt_privado.fn_tempo_trello_regra_mudou()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.plt_tempo_trello t where t.setor_id = new.setor_id) then
    perform plt_privado.fn_tempo_trello_classificar(new.setor_id);
  end if;
  return null;
end;
$$;
revoke all on function plt_privado.fn_tempo_trello_regra_mudou() from public, anon, authenticated;
drop trigger if exists plt_tempo_regras_zz_trello on public.plt_tempo_regras;
create trigger plt_tempo_regras_zz_trello
  after insert or update on public.plt_tempo_regras
  for each row execute function plt_privado.fn_tempo_trello_regra_mudou();

-- ----------------------------------------------------------------------------
-- 3 · A CARGA (uma vez, pelo script com o OK do dono — idempotente)
--     p_linhas: [{cartao_id, nome, url, etiquetas: [...], inicio, fim}]
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tempo_trello_carregar(p_setor_id bigint, p_linhas jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_antes    integer;
  v_lidas    integer;
  v_unicas   integer;
  v_sabados  integer := 0;
  v_faixas   jsonb;
  v_rel      jsonb;
begin
  if not exists (select 1 from public.plt_setores s where s.id = p_setor_id and s.papel_no_fluxo = 'producao') then
    raise exception 'O histórico do Trello entra num setor de produção.' using errcode = 'invalid_parameter_value';
  end if;
  if jsonb_typeof(p_linhas) is distinct from 'array' then
    raise exception 'As linhas do histórico vêm numa lista.' using errcode = 'invalid_parameter_value';
  end if;
  perform pg_advisory_xact_lock(hashtext('plt-tempo-trello'));
  select count(*) into v_antes from public.plt_tempo_trello where setor_id = p_setor_id;
  v_lidas := jsonb_array_length(p_linhas);

  -- as linhas, uma por cartão (os repetidos do arquivo ficam uma vez)
  create temporary table if not exists pg_temp.trello_carga (
    cartao_id text primary key, nome text, url text, etiquetas text[], inicio timestamptz, fim timestamptz
  ) on commit drop;
  truncate pg_temp.trello_carga;
  insert into pg_temp.trello_carga (cartao_id, nome, url, etiquetas, inicio, fim)
  select distinct on (btrim(l ->> 'cartao_id'))
         btrim(l ->> 'cartao_id'),
         btrim(regexp_replace(l ->> 'nome', '\s+', ' ', 'g')),
         nullif(btrim(coalesce(l ->> 'url', '')), ''),
         coalesce(array(select btrim(regexp_replace(e, '\s*\([^)]*\)\s*$', ''))
                          from jsonb_array_elements_text(coalesce(l -> 'etiquetas', '[]'::jsonb)) e
                         where btrim(e) <> ''), '{}'),
         (l ->> 'inicio')::timestamptz,
         (l ->> 'fim')::timestamptz
    from jsonb_array_elements(p_linhas) l
   where nullif(btrim(coalesce(l ->> 'cartao_id', '')), '') is not null
     and nullif(btrim(coalesce(l ->> 'nome', '')), '') is not null
     and (l ->> 'inicio') is not null and (l ->> 'fim') is not null
     and (l ->> 'fim')::timestamptz >= (l ->> 'inicio')::timestamptz
   order by btrim(l ->> 'cartao_id');
  get diagnostics v_unicas = row_count;

  -- os sábados com montagem no histórico entram como DIA TRABALHADO do setor
  -- (só esses dias), com as faixas de uma sexta do setor (D-NN provisória)
  select coalesce(jsonb_agg(jsonb_build_array(to_char(h.hora_inicio, 'HH24:MI'), to_char(h.hora_fim, 'HH24:MI'))
                            order by h.hora_inicio), '[]'::jsonb)
    into v_faixas
    from public.plt_horarios_funcionamento h
   where h.escopo = 'setor' and h.setor_id = p_setor_id and h.dia_semana = 5;
  if jsonb_array_length(v_faixas) between 1 and 6 then
    with s as (
      select distinct d from (
        select (c.inicio at time zone 'America/Fortaleza')::date as d from pg_temp.trello_carga c
        union select (c.fim at time zone 'America/Fortaleza')::date from pg_temp.trello_carga c
      ) x where extract(dow from d) = 6
    ),
    novos as (
      insert into public.plt_tempo_excecoes (setor_id, dia, tipo, descricao, faixas)
      select p_setor_id, s.d, 'trabalhado', 'Sábado com montagem (histórico do Trello)', v_faixas
        from s
       where not exists (select 1 from public.plt_tempo_excecoes e
                          where e.dia = s.d and e.arquivado_em is null
                            and (e.setor_id = p_setor_id or e.setor_id is null))
      returning 1
    )
    select count(*) into v_sabados from novos;
  end if;

  -- grava (idempotente: o mesmo cartão é atualizado, nunca duplicado; a
  -- decisão manual que já existir fica)
  insert into public.plt_tempo_trello as t
    (cartao_id, cartao_nome, cartao_url, etiquetas, pedido_numero, setor_id, inicio, fim, dia,
     modelo_chave, modelo_id, pessoas)
  select c.cartao_id, c.nome, c.url, c.etiquetas,
         nullif(substring(c.nome from '^\s*(\d{3,7})\s*[-–]'), '')::integer,
         p_setor_id, c.inicio, c.fim, (c.fim at time zone 'America/Fortaleza')::date,
         plt_privado.fn_tempo_modelo_chave(c.nome),
         (select k.modelo_id from public.plt_tempo_modelo_chaves k where k.chave = plt_privado.fn_tempo_modelo_chave(c.nome)),
         plt_privado.fn_tempo_trello_montadores(p_setor_id, c.etiquetas)
    from pg_temp.trello_carga c
  on conflict (cartao_id) do update
    set cartao_nome = excluded.cartao_nome, cartao_url = excluded.cartao_url, etiquetas = excluded.etiquetas,
        pedido_numero = excluded.pedido_numero, setor_id = excluded.setor_id, inicio = excluded.inicio,
        fim = excluded.fim, dia = excluded.dia, modelo_chave = excluded.modelo_chave,
        modelo_id = excluded.modelo_id, pessoas = excluded.pessoas;

  perform plt_privado.fn_tempo_trello_medir(p_setor_id);
  perform plt_privado.fn_tempo_trello_classificar(p_setor_id);

  -- o relatório (vai para a execução da sessão)
  select jsonb_build_object(
    'linhas_lidas', v_lidas,
    'cartoes_unicos', v_unicas,
    'repetidos_no_arquivo', v_lidas - v_unicas,
    'entraram', (select count(*) from public.plt_tempo_trello where setor_id = p_setor_id) - v_antes,
    'ja_existiam', v_antes,
    'total', (select count(*) from public.plt_tempo_trello where setor_id = p_setor_id),
    'validas', (select count(*) from public.plt_tempo_trello where setor_id = p_setor_id and situacao = 'valida'),
    'conferir', (select coalesce(jsonb_object_agg(x.motivo, x.n), '{}'::jsonb)
                   from (select t.motivo, count(*) as n from public.plt_tempo_trello t
                          where t.setor_id = p_setor_id and t.situacao = 'conferir' group by t.motivo) x),
    'mediana_min', (select round((percentile_cont(0.5) within group (order by t.execucao_s) / 60)::numeric, 1)
                      from public.plt_tempo_trello t where t.setor_id = p_setor_id and t.situacao = 'valida'),
    'media_min', (select round(avg(t.execucao_s) / 60, 1)
                    from public.plt_tempo_trello t where t.setor_id = p_setor_id and t.situacao = 'valida'),
    'crua_media_min', (select round(avg(t.bruto_s) / 60, 1) from public.plt_tempo_trello t where t.setor_id = p_setor_id),
    'lotes', (select count(*) from (select 1 from public.plt_tempo_trello t where t.setor_id = p_setor_id and t.lote_n > 1
                                      group by t.inicio, t.fim) g),
    'cartoes_em_lote', (select count(*) from public.plt_tempo_trello t where t.setor_id = p_setor_id and t.lote_n > 1),
    'cortados_no_fim_do_dia', (select count(*) from public.plt_tempo_trello t where t.setor_id = p_setor_id and t.cortado),
    'sabados_trabalhados_criados', v_sabados,
    'sem_montador', (select count(*) from public.plt_tempo_trello t where t.setor_id = p_setor_id and cardinality(t.pessoas) = 0),
    'duplas', (select count(*) from public.plt_tempo_trello t where t.setor_id = p_setor_id and cardinality(t.pessoas) > 1),
    'por_montador', (select coalesce(jsonb_object_agg(x.nome, x.n), '{}'::jsonb)
                       from (select u.nome, count(*) as n from public.plt_tempo_trello t
                               cross join lateral unnest(t.pessoas) p join public.plt_usuarios u on u.id = p
                              where t.setor_id = p_setor_id group by u.nome) x),
    'etiquetas_sem_pessoa', (select coalesce(jsonb_object_agg(x.e, x.n), '{}'::jsonb)
                               from (select e, count(*) as n
                                       from public.plt_tempo_trello t cross join lateral unnest(t.etiquetas) e
                                      where t.setor_id = p_setor_id
                                        and not exists (select 1 from plt_privado.fn_tempo_trello_pessoa(p_setor_id, e))
                                      group by e) x),
    'sem_modelo_cartoes', (select count(*) from public.plt_tempo_trello t where t.setor_id = p_setor_id and t.modelo_id is null),
    'sem_modelo_nomes', (select count(distinct t.modelo_chave) from public.plt_tempo_trello t
                          where t.setor_id = p_setor_id and t.modelo_id is null),
    'de', (select min(t.dia) from public.plt_tempo_trello t where t.setor_id = p_setor_id),
    'ate', (select max(t.dia) from public.plt_tempo_trello t where t.setor_id = p_setor_id))
    into v_rel;

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (plt_privado.fn_usuario_atual(), 'tempo_trello_carregado',
            jsonb_build_object('setor_id', p_setor_id, 'relatorio', v_rel - 'por_montador' - 'etiquetas_sem_pessoa'));
  perform plt_privado.fn_avisar('tempos');
  return v_rel;
end;
$$;
comment on function plt_privado.fn_tempo_trello_carregar(bigint, jsonb) is
  'SESSAO-43 (F4): a carga do histórico do Trello num setor — uma linha por cartão (os repetidos uma vez), idempotente (o mesmo cartão é atualizado, a decisão manual fica), os sábados com montagem como dia trabalhado do setor, o montador pela etiqueta na equipe do painel, o modelo pela chave da 42, a mesma conta (janelas até o corte, lote dividido) e a situação. Devolve o relatório. Fora da API: só o script da manutenção.';
revoke all on function plt_privado.fn_tempo_trello_carregar(bigint, jsonb) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4 · Configurações → Controle de tempo → Modelos: "Nomes do Trello sem
--     modelo" (lista por cursor, só admin) e LIGAR um nome a um modelo
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_tempo_trello_sem_modelo(
  p_limite integer default 30, p_depois_n integer default null, p_depois_chave text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_lim   integer := least(greatest(coalesce(p_limite, 30), 1), 100);
  v_itens jsonb;
  v_n     integer;
begin
  perform plt_privado.fn_tempo_so_admin();
  select coalesce(jsonb_agg(jsonb_build_object('chave', x.chave, 'exemplo', x.exemplo, 'cartoes', x.n,
                                               'sugestao', x.sugestao, 'de', x.de, 'ate', x.ate)
                            order by x.n desc, x.chave), '[]'::jsonb), count(*)
    into v_itens, v_n
    from (
      select g.chave, g.exemplo, g.n, g.de, g.ate, plt_privado.fn_tempo_modelo_nome(g.exemplo) as sugestao
        from (select t.modelo_chave as chave, min(t.cartao_nome) as exemplo, count(*)::int as n,
                     min(t.dia) as de, max(t.dia) as ate
                from public.plt_tempo_trello t
               where t.modelo_id is null and t.modelo_chave is not null
               group by t.modelo_chave) g
       where p_depois_n is null or (g.n, g.chave) < (p_depois_n, coalesce(p_depois_chave, ''))
       order by g.n desc, g.chave
       limit v_lim + 1) x;
  return jsonb_build_object(
    'itens', case when v_n > v_lim then v_itens - v_lim else v_itens end,
    'tem_mais', v_n > v_lim,
    'nomes', (select count(distinct t.modelo_chave) from public.plt_tempo_trello t where t.modelo_id is null and t.modelo_chave is not null),
    'cartoes', (select count(*) from public.plt_tempo_trello t where t.modelo_id is null and t.modelo_chave is not null));
end;
$$;
comment on function public.plt_fn_tempo_trello_sem_modelo(integer, integer, text) is
  'SESSAO-43 (F4): os nomes do histórico do Trello que não casaram com nenhum modelo (a chave limpa, um exemplo, quantos cartões, o período e o nome sugerido), do mais frequente para o menos, por cursor (n, chave), teto 100. Só admin.';

create or replace function public.plt_fn_tempo_trello_ligar(p_chave text, p_modelo_id bigint default null, p_nome_novo text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_exemplo text;
  v_modelo  bigint := p_modelo_id;
  v_n       integer;
begin
  perform plt_privado.fn_tempo_so_admin();
  select min(t.cartao_nome), count(*) into v_exemplo, v_n
    from public.plt_tempo_trello t where t.modelo_chave = p_chave;
  if v_n = 0 then
    raise exception 'Este nome não está no histórico do Trello.' using errcode = 'no_data_found';
  end if;
  if v_modelo is null then
    if length(btrim(coalesce(p_nome_novo, ''))) < 2 then
      raise exception 'Escolha um modelo ou dê um nome ao modelo novo.' using errcode = 'invalid_parameter_value';
    end if;
    insert into public.plt_tempo_modelos (nome, confirmado) values (left(btrim(p_nome_novo), 160), true)
      returning id into v_modelo;
  elsif not exists (select 1 from public.plt_tempo_modelos m where m.id = v_modelo and m.arquivado_em is null) then
    raise exception 'Este modelo não existe mais.' using errcode = 'no_data_found';
  end if;
  -- a chave passa a valer para a plataforma também: card novo com este nome cai no modelo
  insert into public.plt_tempo_modelo_chaves (chave, modelo_id, exemplo)
    values (p_chave, v_modelo, left(v_exemplo, 200))
    on conflict (chave) do update set modelo_id = excluded.modelo_id;
  -- (o gatilho da chave leva as linhas do Trello para o modelo e refaz a situação)
  perform plt_privado.fn_tempo_trilha('tempo_trello_nome_ligado',
    jsonb_build_object('chave', p_chave, 'exemplo', v_exemplo, 'modelo_id', v_modelo, 'cartoes', v_n,
                       'modelo_novo', p_modelo_id is null));
  perform plt_privado.fn_avisar('tempos');
  return jsonb_build_object('modelo_id', v_modelo, 'cartoes', v_n);
end;
$$;
comment on function public.plt_fn_tempo_trello_ligar(text, bigint, text) is
  'SESSAO-43 (F4): liga um nome do histórico do Trello a um modelo (ou cria o modelo, confirmado) — grava a chave em plt_tempo_modelo_chaves (vale para a plataforma também); o gatilho da chave leva as linhas do Trello e refaz a situação e o padrão com histórico. Só admin; trilha tempo_trello_nome_ligado.';

do $$
declare
  f text;
begin
  foreach f in array array[
    'plt_fn_tempo_trello_sem_modelo(integer, integer, text)',
    'plt_fn_tempo_trello_ligar(text, bigint, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5 · Na aplicação: a equipe das passagens que já existem e o padrão com
--     histórico dos modelos que já têm padrão (o histórico do Trello entra
--     depois, pela carga)
-- ----------------------------------------------------------------------------
do $$
declare
  v_id bigint;
  v_k  record;
begin
  for v_id in select p.id from public.plt_tempo_passagens p
               where not exists (select 1 from public.plt_tempo_passagem_equipe q where q.passagem_id = p.id)
  loop
    perform plt_privado.fn_tempo_equipe_refazer(v_id);
  end loop;
  for v_k in select d.setor_id, d.modelo_id from public.plt_tempo_padrao d loop
    perform plt_privado.fn_tempo_padrao_historico_refazer(v_k.setor_id, v_k.modelo_id);
  end loop;
end;
$$;
