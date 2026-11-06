-- ============================================================================
-- Ajuste do dono (06/11/2026 — cabeçalhos compactos, 6ª volta), DUAS partes:
--  (1) o Modo TV ao vivo para a pessoa; (2) a TV escolhe o DIA que mostra.
--
-- (1) O botão
-- "Modo TV" acima do "Modo tablet" aparece AO VIVO para quem ganhou a
-- permissão de transmitir — sem recarregar a página.
--
-- Recriada POR INTEIRO da versão viva (20261105040000_plt_tempos_producao_modo_tv):
-- a única mudança é o sinal no fim — o evento "perfil" no canal privado da
-- pessoa (o mesmo do chat e do sino, plt-chat-u:<id>); a tela dela relê o
-- perfil (a porta de abertura) e o botão aparece/some. O sinal não leva dado
-- sensível: só os módulos novos, que a própria pessoa já pode ler.
-- Lei §4: trabalho nasce do fato (o gesto do admin), nada de relógio.
-- ============================================================================

create or replace function public.plt_fn_usuario_modo_tv(p_usuario_id uuid, p_ligado boolean, p_so_tv boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_u    public.plt_usuarios%rowtype;
  v_mods text[];
begin
  if not plt_privado.fn_eh_admin() then
    raise exception 'Ligar o Modo TV é gesto de administrador.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_u from public.plt_usuarios u where u.id = p_usuario_id for update;
  if v_u.id is null then
    raise exception 'Pessoa não encontrada.' using errcode = 'no_data_found';
  end if;
  if v_u.conta_tablet then
    raise exception 'A conta do tablet não abre o Modo TV.' using errcode = 'check_violation';
  end if;
  v_mods := array_remove(coalesce(v_u.modulos, '{}'), 'tv');
  if coalesce(p_ligado, false) and coalesce(p_so_tv, false) then
    if v_u.papel = 'admin' then
      raise exception 'Um administrador não pode ser conta só da TV.' using errcode = 'check_violation';
    end if;
    v_mods := array['tv'];
  elsif coalesce(p_ligado, false) then
    if not (v_mods && array['fabrica', 'comercial', 'entregas']::text[]) then
      v_mods := array['fabrica'] || v_mods;
    end if;
    v_mods := v_mods || 'tv'::text;
  elsif not (v_mods && array['fabrica', 'comercial', 'entregas']::text[]) then
    v_mods := array['fabrica'] || v_mods;   -- desligou a conta só da TV: volta a ser da fábrica
  end if;
  update public.plt_usuarios set modulos = v_mods where id = v_u.id;
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (plt_privado.fn_usuario_atual(), 'usuario_modo_tv',
            jsonb_build_object('usuario_id', v_u.id, 'nome', v_u.nome, 'ligado', coalesce(p_ligado, false),
                               'so_tv', coalesce(p_ligado, false) and coalesce(p_so_tv, false),
                               'antes', to_jsonb(v_u.modulos), 'modulos', to_jsonb(v_mods)));
  -- 06/11: a tela da pessoa fica sabendo na hora (o botão Modo TV aparece/some).
  perform plt_privado.fn_chat_sinal(v_u.id, 'perfil', jsonb_build_object('modulos', to_jsonb(v_mods)));
  return jsonb_build_object('modulos', to_jsonb(v_mods));
end;
$$;
comment on function public.plt_fn_usuario_modo_tv(uuid, boolean, boolean) is
  'SESSAO-43 (F3): liga/desliga a permissão Modo TV de uma pessoa (o módulo "tv"); p_so_tv = a conta SÓ da TV (módulos = {tv} — entra direto na TV e não abre outra tela). Só admin; trilha usuario_modo_tv. 06/11: avisa a pessoa ao vivo (evento "perfil" no canal dela).';
revoke all on function public.plt_fn_usuario_modo_tv(uuid, boolean, boolean) from public, anon;
grant execute on function public.plt_fn_usuario_modo_tv(uuid, boolean, boolean) to authenticated;

-- ============================================================================
-- (2) O Modo TV escolhe o dia (pedido do dono, 06/11: "coloque um botão de
-- alternar entre os dias"). Recriada da versão viva (20261105040000) com
-- p_dia (sem ele, hoje — idêntico ao de antes): "hoje" vira o dia escolhido
-- (montados, médias de 30 dias e do mês, gráfico de 14 dias e a semana do
-- melhor, tudo até aquele dia). Dia futuro recusado; no máximo 400 dias atrás.
-- Devolve 'pode_trocar_dia' (a tela só mostra as setas quando a porta sabe —
-- o site pode subir antes do banco sem botão quebrado) e 'e_hoje'.
-- A versão de 1 parâmetro sai: com as duas, a API não saberia qual chamar.
-- ============================================================================
drop function if exists public.plt_fn_modo_tv(bigint);

create or replace function public.plt_fn_modo_tv(p_setor_id bigint default null, p_dia date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu    uuid := plt_privado.fn_usuario_atual();
  v_hoje_real date := (now() at time zone 'America/Fortaleza')::date;
  -- 06/11: o dia que a TV mostra (sem p_dia, hoje — o de sempre)
  v_hoje  date := coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date);
  v_seg   date := date_trunc('week', coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date))::date;
  v_mes   date := date_trunc('month', coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date))::date;
  v_de    date;
  v_setor bigint;
  v_nome  text;
  v_u30   integer;
  v_umes  integer;
  v_ret   jsonb;
begin
  if v_eu is null then
    raise exception 'Entre na plataforma para abrir o Modo TV.' using errcode = 'insufficient_privilege';
  end if;
  if not (plt_privado.fn_tem_modo_tv(v_eu) or plt_privado.fn_eh_admin()) then
    raise exception 'O Modo TV é liberado por um administrador na Gestão da equipe.' using errcode = 'insufficient_privilege';
  end if;
  if v_hoje > v_hoje_real then
    raise exception 'A TV não mostra dias que ainda não chegaram.' using errcode = 'invalid_parameter_value';
  end if;
  if v_hoje < v_hoje_real - 400 then
    raise exception 'A TV volta no máximo 400 dias.' using errcode = 'invalid_parameter_value';
  end if;
  select s.id, s.nome into v_setor, v_nome
    from public.plt_setores s
   where s.papel_no_fluxo = 'producao' and s.ativo
   order by (s.id = p_setor_id) desc, ('montagem' = any (plt_privado.fn_tempo_palavras(s.nome))) desc, s.ordem, s.id
   limit 1;
  if v_setor is null then
    raise exception 'Não há setor de produção para a TV.' using errcode = 'no_data_found';
  end if;
  v_de := least(v_hoje - 29, v_mes, v_seg);
  v_u30 := plt_privado.fn_tempos_dias_uteis(v_setor, v_hoje - 29, v_hoje, true);
  v_umes := plt_privado.fn_tempos_dias_uteis(v_setor, v_mes, v_hoje, true);

  with le as (
    select e.usuario_id, e.letra from public.plt_tempo_equipe e where e.setor_id = v_setor
  ),
  b0 as (
    select m.dia, m.modelo_id, m.execucao_s, m.situacao, m.montado, m.montadores, m.chave
      from plt_privado.vw_tempo_montagens m
     where m.setor_id = v_setor and m.dia between v_de and v_hoje
  ),
  -- as letras de cada equipe calculadas UMA vez por chave (não por móvel)
  k as (
    select x.chave,
           case when cardinality(x.montadores) = 0 then 'Sem montador'
                when exists (select 1 from unnest(x.montadores) p where p not in (select usuario_id from le)) then 'Outros'
                else (select string_agg(le.letra, ' + ' order by le.letra) from unnest(x.montadores) p join le on le.usuario_id = p)
           end as letras,
           case when cardinality(x.montadores) = 1 then x.montadores[1] end as sozinho
      from (select distinct on (b0.chave) b0.chave, b0.montadores from b0) x
  ),
  b as (
    select b0.dia, b0.modelo_id, b0.execucao_s, b0.situacao, b0.montado, k.letras, k.sozinho
      from b0 join k on k.chave = b0.chave
  ),
  num as (
    select count(*) filter (where b.montado and b.dia = v_hoje) as hoje,
           count(*) filter (where b.montado and b.dia >= v_hoje - 29) as n30,
           count(*) filter (where b.montado and b.dia >= v_mes) as mes,
           percentile_cont(0.5) within group (order by b.execucao_s) filter (where b.situacao = 'valida' and b.dia = v_hoje) as med_hoje,
           percentile_cont(0.5) within group (order by b.execucao_s) filter (where b.situacao = 'valida' and b.dia >= v_hoje - 29) as med_30
      from b
  ),
  ind as (   -- a coluna dos montadores: quem montou SOZINHO, pela letra
    select le.letra,
           count(*) filter (where b.montado and b.dia = v_hoje) as hoje,
           percentile_cont(0.5) within group (order by b.execucao_s) filter (where b.situacao = 'valida' and b.dia = v_hoje) as med_hoje,
           count(*) filter (where b.montado and b.dia >= v_hoje - 29) as n30,
           count(distinct b.dia) filter (where b.montado and b.dia >= v_hoje - 29) as dias30
      from b join le on le.usuario_id = b.sozinho
     where b.dia >= v_hoje - 29
     group by le.letra
  ),
  graf as (
    select b.dia, b.letras, count(*) as n from b
     where b.montado and b.dia >= v_hoje - 13 group by b.dia, b.letras
  ),
  melhor as (
    select b.letras, mo.nome as modelo, b.execucao_s, h.mediana_s
      from b
      join public.plt_tempo_padrao_historico h on h.setor_id = v_setor and h.modelo_id = b.modelo_id and h.n >= 3
      join public.plt_tempo_modelos mo on mo.id = b.modelo_id
     where b.situacao = 'valida' and b.dia >= v_seg and b.letras not in ('Sem montador', 'Outros')
     order by b.execucao_s / nullif(h.mediana_s, 0) asc nulls last, b.execucao_s asc
     limit 1
  )
  select jsonb_build_object(
    'setor', jsonb_build_object('id', v_setor, 'nome', v_nome),
    'setores', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome) order by s.ordem, s.id)
                           from public.plt_setores s where s.papel_no_fluxo = 'producao' and s.ativo), '[]'::jsonb),
    'hoje', v_hoje,
    -- 06/11: a tela só mostra as setas de trocar o dia quando a porta sabe (esta versão)
    'pode_trocar_dia', true,
    'e_hoje', v_hoje = v_hoje_real,
    'montados_hoje', num.hoje,
    'n30', num.n30, 'dias_uteis_30', v_u30,
    'media_30', case when v_u30 > 0 then round(num.n30::numeric / v_u30, 1) end,
    'montados_mes', num.mes, 'dias_uteis_mes', v_umes,
    'media_mes', case when v_umes > 0 then round(num.mes::numeric / v_umes, 1) end,
    'tempo_medio_hoje_s', round(num.med_hoje::numeric),
    'mediana_30_s', round(num.med_30::numeric),
    'dados_ate', (select max(m.dia) from plt_privado.vw_tempo_montagens m
                   where m.setor_id = v_setor and m.montado
                     and m.dia <= v_hoje and m.dia >= v_hoje - 400),
    'montadores', coalesce((select jsonb_agg(jsonb_build_object(
                     'letra', i.letra, 'hoje', i.hoje, 'mediana_hoje_s', round(i.med_hoje::numeric),
                     'ritmo', case when i.dias30 > 0 then round(i.n30::numeric / i.dias30, 1) end)
                   order by i.letra) from ind i where i.n30 > 0 or i.hoje > 0), '[]'::jsonb),
    'grafico', jsonb_build_object(
       'dias', (select jsonb_agg(jsonb_build_object(
                  'dia', d::date,
                  'total', coalesce((select sum(g.n) from graf g where g.dia = d::date), 0),
                  'partes', coalesce((select jsonb_object_agg(g.letras, g.n) from graf g where g.dia = d::date), '{}'::jsonb))
                  order by d)
                  from generate_series(v_hoje - 13, v_hoje, interval '1 day') d),
       'series', coalesce((select jsonb_agg(x.letras order by x.ordem, x.letras)
                             from (select g.letras, case when g.letras = 'Outros' then 2 when g.letras = 'Sem montador' then 3
                                                         when g.letras like '% + %' then 1 else 0 end as ordem
                                     from graf g group by g.letras) x), '[]'::jsonb)),
    'melhor_semana', (select jsonb_build_object('letras', m.letras, 'modelo', m.modelo,
                                                'tempo_s', round(m.execucao_s), 'padrao_s', round(m.mediana_s)) from melhor m))
    into v_ret
    from num;
  return v_ret;
end;
$$;
comment on function public.plt_fn_modo_tv(bigint, date) is
  'SESSAO-43 (F3): o Modo TV de um setor (sem setor: a Montagem) — montados no dia, média por dia útil em 30 dias, montados no mês e por dia útil, tempo médio do dia (mediana) e dos 30 dias, a coluna dos montadores que montaram SOZINHOS (letra, no dia, mediana, ritmo), os 14 dias empilhados por letras, o melhor da semana contra o padrão e até quando há dado. SÓ LETRAS — nunca nome, foto, etiqueta. Quem tem o Modo TV ou admin. 06/11: p_dia escolhe o dia (sem ele, hoje; nada no futuro; até 400 dias atrás).';
revoke all on function public.plt_fn_modo_tv(bigint, date) from public, anon;
grant execute on function public.plt_fn_modo_tv(bigint, date) to authenticated;
