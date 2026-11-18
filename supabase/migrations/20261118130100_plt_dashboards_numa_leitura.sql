-- ============================================================================
-- SESSAO-55 · item 2 — Pessoas, Qualidade e Meu desempenho numa leitura cada
-- (dívida 18 da Lei §14)
-- ============================================================================
-- Cada tela abria com 2 a 4 leituras em paralelo:
--   · Pessoas        — as visualizações salvas, o ranking, as metas e as execuções;
--   · Qualidade      — as visualizações, o período, o período anterior (o "vs" do
--                      herói) e os danificados em aberto;
--   · Meu desempenho — os números, o tempo por dia e o tempo por tarefa.
-- E, com uma visualização salva no endereço (?v=), a leitura era em CASCATA: a
-- tela precisava primeiro das visualizações para saber o período da segunda.
--
-- As três portas abaixo chamam, por dentro, AS MESMAS portas de sempre
-- (plt_fn_dash_*, plt_fn_meu_*, plt_fn_metas_painel) — os gates e as contas são
-- delas, nada é recalculado aqui: os números saem iguais aos de antes. O que
-- muda é quem resolve o período: a tela manda só o que o endereço diz (dias,
-- setor, visualização) e o banco resolve com a MESMA precedência da tela
-- (endereço > visualização salva > padrão de 7 dias) e devolve o período que
-- usou (de/ate) — as páginas seguintes (no clique) usam esse mesmo período.
--
-- Funções NOVAS (nenhuma recriada). Security invoker; só leitura: STABLE.
-- ============================================================================
set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · Dashboards → Pessoas
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_dash_pessoas_abertura(
  p_dias          numeric default null,   -- o ?dias= do endereço (nulo = não disse)
  p_setor_id      bigint  default null,   -- o ?setor= do endereço
  p_setor_dito    boolean default false,  -- o endereço disse o setor (inclusive "todos")
  p_v             bigint  default null,   -- a visualização salva escolhida (?v=)
  p_visualizacoes boolean default false,  -- a tela ainda não tem as visualizações guardadas
  p_metas         boolean default false,  -- a tela ainda não tem a 1ª página das metas
  p_metas_limite  integer default 10
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id    uuid;
  v_cfg   jsonb;
  v_dias  numeric;
  v_setor bigint;
  v_ate   timestamptz := now();
  v_de    timestamptz;
  v_ret   jsonb;
begin
  select u.id into v_id
    from public.plt_usuarios u
   where u.auth_user_id = (select auth.uid()) and u.ativo
   limit 1;

  if p_v is not null and v_id is not null then
    select vz.configuracao into v_cfg
      from public.plt_visualizacoes vz
     where vz.id = p_v and vz.usuario_id = v_id;
  end if;
  -- a mesma precedência da tela: endereço > visualização salva > padrão
  v_dias := least(case when p_dias > 0 then p_dias
                       when jsonb_typeof(v_cfg -> 'periodoDias') = 'number' then (v_cfg ->> 'periodoDias')::numeric
                       else 7 end, 3660);
  v_setor := case when p_setor_dito then p_setor_id
                  when jsonb_typeof(v_cfg -> 'setorId') = 'number' then (v_cfg ->> 'setorId')::numeric::bigint
                  else null end;
  v_de := v_ate - make_interval(secs => (v_dias * 86400)::double precision);

  v_ret := jsonb_build_object(
    'de', v_de, 'ate', v_ate, 'dias', v_dias, 'setor_id', v_setor,
    'pessoas', coalesce((
      select jsonb_agg(to_jsonb(p) - 'ordinality' order by p.ordinality)
        from public.plt_fn_dash_tempos_pessoa(v_de, v_ate, v_setor) with ordinality as p), '[]'::jsonb),
    'execucoes', coalesce((
      select jsonb_agg(to_jsonb(e) - 'ordinality' order by e.ordinality)
        from public.plt_fn_dash_execucoes(v_de, v_ate, v_setor, null, 20, 0) with ordinality as e), '[]'::jsonb));

  if p_metas then
    v_ret := v_ret || jsonb_build_object('metas', coalesce((
      select jsonb_agg(to_jsonb(m) - 'ordinality' order by m.ordinality)
        from public.plt_fn_metas_painel(false, least(greatest(coalesce(p_metas_limite, 10), 1), 100), 0)
             with ordinality as m), '[]'::jsonb));
  end if;
  if p_visualizacoes then
    v_ret := v_ret || jsonb_build_object('visualizacoes', coalesce((
      select jsonb_agg(jsonb_build_object('id', vz.id, 'nome', vz.nome, 'configuracao', vz.configuracao,
                                          'padrao', vz.padrao) order by vz.nome, vz.id)
        from public.plt_visualizacoes vz
       where vz.usuario_id = v_id), '[]'::jsonb));
  end if;
  return v_ret;
end;
$$;

comment on function public.plt_fn_dash_pessoas_abertura(numeric, bigint, boolean, bigint, boolean, boolean, integer) is
  'SESSAO-55 (Lei §2 — dívida 18): Dashboards → Pessoas numa leitura — o ranking por pessoa e a 1ª página das execuções do período (as mesmas portas plt_fn_dash_tempos_pessoa e plt_fn_dash_execucoes, com os gates delas); a pedido, a 1ª página das metas e as visualizações salvas de quem chama. O período sai do endereço, da visualização salva ou do padrão (7 dias), nessa ordem, e volta em de/ate.';

-- ----------------------------------------------------------------------------
-- 2 · Dashboards → Qualidade
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_dash_qualidade_abertura(
  p_dias          numeric default null,
  p_v             bigint  default null,
  p_visualizacoes boolean default false
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id   uuid;
  v_cfg  jsonb;
  v_dias numeric;
  v_ate  timestamptz := now();
  v_de   timestamptz;
  v_ant  timestamptz;
  v_ret  jsonb;
begin
  select u.id into v_id
    from public.plt_usuarios u
   where u.auth_user_id = (select auth.uid()) and u.ativo
   limit 1;

  if p_v is not null and v_id is not null then
    select vz.configuracao into v_cfg
      from public.plt_visualizacoes vz
     where vz.id = p_v and vz.usuario_id = v_id;
  end if;
  v_dias := least(case when p_dias > 0 then p_dias
                       when jsonb_typeof(v_cfg -> 'periodoDias') = 'number' then (v_cfg ->> 'periodoDias')::numeric
                       else 7 end, 3660);
  v_de  := v_ate - make_interval(secs => (v_dias * 86400)::double precision);
  -- o período imediatamente anterior, do mesmo tamanho (o "vs" do herói)
  v_ant := v_de - make_interval(secs => (v_dias * 86400)::double precision);

  v_ret := jsonb_build_object(
    'de', v_de, 'ate', v_ate, 'dias', v_dias,
    'qualidade', coalesce((
      select jsonb_agg(to_jsonb(q) - 'ordinality' order by q.ordinality)
        from public.plt_fn_dash_qualidade(v_de, v_ate) with ordinality as q), '[]'::jsonb),
    'qualidade_anterior', coalesce((
      select jsonb_agg(to_jsonb(q) - 'ordinality' order by q.ordinality)
        from public.plt_fn_dash_qualidade(v_ant, v_de) with ordinality as q), '[]'::jsonb),
    'danificados_abertos', coalesce((
      select jsonb_agg(to_jsonb(d) - 'ordinality' order by d.ordinality)
        from public.plt_fn_dash_danificados_abertos() with ordinality as d), '[]'::jsonb));

  if p_visualizacoes then
    v_ret := v_ret || jsonb_build_object('visualizacoes', coalesce((
      select jsonb_agg(jsonb_build_object('id', vz.id, 'nome', vz.nome, 'configuracao', vz.configuracao,
                                          'padrao', vz.padrao) order by vz.nome, vz.id)
        from public.plt_visualizacoes vz
       where vz.usuario_id = v_id), '[]'::jsonb));
  end if;
  return v_ret;
end;
$$;

comment on function public.plt_fn_dash_qualidade_abertura(numeric, bigint, boolean) is
  'SESSAO-55 (Lei §2 — dívida 18): Dashboards → Qualidade numa leitura — a qualidade por setor no período e no período anterior do mesmo tamanho (plt_fn_dash_qualidade, duas vezes) e os danificados em aberto (plt_fn_dash_danificados_abertos), com os gates delas; a pedido, as visualizações salvas de quem chama. O período sai do endereço, da visualização salva ou do padrão (7 dias) e volta em de/ate.';

-- ----------------------------------------------------------------------------
-- 3 · Dashboards → Meu desempenho
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_meu_desempenho_abertura(
  p_dias   numeric default 7,
  p_limite integer default 10
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_dias numeric := least(case when p_dias > 0 then p_dias else 7 end, 3660);
  v_ate  timestamptz := now();
  v_de   timestamptz;
begin
  v_de := v_ate - make_interval(secs => (v_dias * 86400)::double precision);
  return jsonb_build_object(
    'de', v_de, 'ate', v_ate, 'dias', v_dias,
    'kpis', (select to_jsonb(k) from public.plt_fn_meu_desempenho(v_de, v_ate) k limit 1),
    'por_dia', coalesce((
      select jsonb_agg(to_jsonb(d) - 'ordinality' order by d.ordinality)
        from public.plt_fn_meu_tempo_dias(v_de, v_ate) with ordinality as d), '[]'::jsonb),
    'por_tarefa', coalesce((
      select jsonb_agg(to_jsonb(t) - 'ordinality' order by t.ordinality)
        from public.plt_fn_meu_tempo_tarefas(v_de, v_ate, least(greatest(coalesce(p_limite, 10), 1), 100), 0)
             with ordinality as t), '[]'::jsonb));
end;
$$;

comment on function public.plt_fn_meu_desempenho_abertura(numeric, integer) is
  'SESSAO-55 (Lei §2 — dívida 18): Dashboards → Meu desempenho numa leitura — os números da pessoa, o tempo por dia e a 1ª página do tempo por tarefa (plt_fn_meu_desempenho, plt_fn_meu_tempo_dias e plt_fn_meu_tempo_tarefas: só o dado de quem chama). O período (últimos p_dias) volta em de/ate.';

revoke all on function public.plt_fn_dash_pessoas_abertura(numeric, bigint, boolean, bigint, boolean, boolean, integer) from public, anon;
revoke all on function public.plt_fn_dash_qualidade_abertura(numeric, bigint, boolean) from public, anon;
revoke all on function public.plt_fn_meu_desempenho_abertura(numeric, integer) from public, anon;
grant execute on function public.plt_fn_dash_pessoas_abertura(numeric, bigint, boolean, bigint, boolean, boolean, integer) to authenticated;
grant execute on function public.plt_fn_dash_qualidade_abertura(numeric, bigint, boolean) to authenticated;
grant execute on function public.plt_fn_meu_desempenho_abertura(numeric, integer) to authenticated;

-- fim do item 2 da SESSAO-55
