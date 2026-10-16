-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 79 — A PLATAFORMA MEDE A PRÓPRIA
-- VELOCIDADE (SESSAO-32 · §1.4/E3 · D-137 item 2: "pode ser a própria
-- plataforma mesmo")
--
-- Cada abertura da plataforma, em cada aparelho, mede o que a pessoa sente —
-- quanto a tela demora a aparecer (LCP), quanto o toque demora a responder
-- (INP) e quanto a tela pula (CLS) — e guarda aqui, uma linha por abertura
-- (a mesma linha é atualizada se a medida melhorar de informação). Sem a
-- ferramenta paga da Vercel. Os tetos da Lei: LCP ≤ 2,5 s, INP ≤ 200 ms,
-- CLS ≤ 0,1 no p75 dos tablets.
--
-- Quem lê: o super admin (o dono). Quem grava: a porta, sempre em nome de quem
-- está logado. Crescimento: ~1 linha por abertura (40 pessoas → ~1 mil/dia);
-- índice por data para a leitura do período e a limpeza futura.
-- Nada nas tabelas da integração.
-- ============================================================================

create table if not exists public.plt_medicoes_web (
  carga_id      uuid primary key,
  usuario_id    uuid not null references public.plt_usuarios (id) on delete cascade,
  criada_em     timestamptz not null default now(),
  atualizada_em timestamptz not null default now(),
  rota          text not null,
  aparelho      text not null check (aparelho in ('tablet', 'celular', 'computador')),
  modo_tablet   boolean not null default false,
  lcp_ms        integer check (lcp_ms between 0 and 600000),
  inp_ms        integer check (inp_ms between 0 and 600000),
  cls           numeric(8, 4) check (cls between 0 and 100),
  fcp_ms        integer check (fcp_ms between 0 and 600000),
  ttfb_ms       integer check (ttfb_ms between 0 and 600000),
  interacoes    integer not null default 0 check (interacoes >= 0),
  versao        text,
  conexao       text
);

comment on table public.plt_medicoes_web is
  'SESSAO-32 (D-137): a velocidade sentida em cada abertura da plataforma — LCP, INP, CLS, FCP e TTFB por aparelho. Gravada só por plt_fn_medir_tela (em nome de quem está logado); lida pelo super admin.';

create index if not exists plt_medicoes_web_criada_em_idx on public.plt_medicoes_web (criada_em);
create index if not exists plt_medicoes_web_usuario_idx on public.plt_medicoes_web (usuario_id);

alter table public.plt_medicoes_web enable row level security;
revoke all on public.plt_medicoes_web from public, anon, authenticated;
grant select on public.plt_medicoes_web to authenticated;

drop policy if exists plt_medicoes_web_leitura on public.plt_medicoes_web;
create policy plt_medicoes_web_leitura on public.plt_medicoes_web
  for select to authenticated
  using ((select plt_privado.fn_eh_super_admin()));

-- A porta: grava (ou atualiza) a medida da abertura de quem está logado. Os
-- números chegam do navegador — limitados aqui, nunca confiados.
create or replace function public.plt_fn_medir_tela(
  p_carga       uuid,
  p_rota        text,
  p_aparelho    text,
  p_modo_tablet boolean,
  p_lcp_ms      integer,
  p_inp_ms      integer,
  p_cls         numeric,
  p_fcp_ms      integer,
  p_ttfb_ms     integer,
  p_interacoes  integer,
  p_versao      text,
  p_conexao     text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu uuid := plt_privado.fn_usuario_atual();
  v_ms constant integer := 600000;
begin
  if v_eu is null or p_carga is null then
    return;
  end if;
  insert into public.plt_medicoes_web as m (
    carga_id, usuario_id, rota, aparelho, modo_tablet, lcp_ms, inp_ms, cls, fcp_ms, ttfb_ms,
    interacoes, versao, conexao)
  values (
    p_carga, v_eu,
    left(coalesce(nullif(btrim(p_rota), ''), '/'), 200),
    case when p_aparelho in ('tablet', 'celular', 'computador') then p_aparelho else 'computador' end,
    coalesce(p_modo_tablet, false),
    case when p_lcp_ms  between 0 and v_ms then p_lcp_ms  end,
    case when p_inp_ms  between 0 and v_ms then p_inp_ms  end,
    case when p_cls     between 0 and 100  then round(p_cls, 4) end,
    case when p_fcp_ms  between 0 and v_ms then p_fcp_ms  end,
    case when p_ttfb_ms between 0 and v_ms then p_ttfb_ms end,
    greatest(coalesce(p_interacoes, 0), 0),
    left(p_versao, 40),
    left(p_conexao, 20))
  on conflict (carga_id) do update
     set atualizada_em = now(),
         modo_tablet   = m.modo_tablet or excluded.modo_tablet,
         lcp_ms        = coalesce(excluded.lcp_ms, m.lcp_ms),
         inp_ms        = coalesce(excluded.inp_ms, m.inp_ms),
         cls           = coalesce(excluded.cls, m.cls),
         fcp_ms        = coalesce(excluded.fcp_ms, m.fcp_ms),
         ttfb_ms       = coalesce(excluded.ttfb_ms, m.ttfb_ms),
         interacoes    = greatest(excluded.interacoes, m.interacoes)
   where m.usuario_id = v_eu;  -- a abertura de outra pessoa nunca é sobrescrita
end;
$$;

comment on function public.plt_fn_medir_tela(uuid, text, text, boolean, integer, integer, numeric, integer, integer, integer, text, text) is
  'SESSAO-32 (D-137): a medida de velocidade de UMA abertura da plataforma (carga_id gerado no navegador), em nome de quem está logado; a mesma abertura é atualizada (nunca a de outra pessoa). Números fora da faixa viram vazio.';

-- O resumo para o dono (e para o handoff): p75 por aparelho no período.
create or replace function public.plt_fn_medicoes_web_resumo(p_dias integer default 7)
returns table (
  aparelho text, modo_tablet boolean, aberturas bigint,
  lcp_p75_ms integer, inp_p75_ms integer, cls_p75 numeric, fcp_p75_ms integer, ttfb_p75_ms integer)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select m.aparelho, m.modo_tablet, count(*),
         (percentile_cont(0.75) within group (order by m.lcp_ms))::integer,
         (percentile_cont(0.75) within group (order by m.inp_ms))::integer,
         round((percentile_cont(0.75) within group (order by m.cls))::numeric, 3),
         (percentile_cont(0.75) within group (order by m.fcp_ms))::integer,
         (percentile_cont(0.75) within group (order by m.ttfb_ms))::integer
    from public.plt_medicoes_web m
   where m.criada_em >= now() - make_interval(days => greatest(least(coalesce(p_dias, 7), 90), 1))
   group by m.aparelho, m.modo_tablet
   order by m.aparelho, m.modo_tablet;
$$;

comment on function public.plt_fn_medicoes_web_resumo(integer) is
  'SESSAO-32 (D-137): p75 de LCP/INP/CLS/FCP/TTFB por aparelho nos últimos N dias (1–90). Invoker: só o super admin enxerga linhas (RLS).';

revoke all on function public.plt_fn_medir_tela(uuid, text, text, boolean, integer, integer, numeric, integer, integer, integer, text, text) from public, anon;
grant execute on function public.plt_fn_medir_tela(uuid, text, text, boolean, integer, integer, numeric, integer, integer, integer, text, text) to authenticated;
revoke all on function public.plt_fn_medicoes_web_resumo(integer) from public, anon;
grant execute on function public.plt_fn_medicoes_web_resumo(integer) to authenticated;
