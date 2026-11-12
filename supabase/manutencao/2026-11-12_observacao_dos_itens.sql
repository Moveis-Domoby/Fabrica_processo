-- ============================================================================
-- SESSAO-50 · bloco A · O preenchimento dos antigos: a observação do item de
-- cada pedido que já estava no banco (raw.itens[].item.info_adicional →
-- plt_itens_observacao)
--
-- O caso (leitura do banco em 12/11 ~01:30, só leitura): 376 itens em 325
-- pedidos têm observação — 21 deles nos últimos 30 dias —, mediana de 33
-- caracteres, a maior com 162. O gatilho novo guarda tudo o que o Tiny mandar
-- DEPOIS da atualização do banco; o pedido que não mudar nunca passaria por ele
-- — por isso este preenchimento, uma vez, pela MESMA regra do gatilho
-- (plt_privado.fn_itens_observacao_do_raw: a mesma posição, o mesmo texto limpo).
--
-- DOIS MODOS:
--   · ENSAIO (o padrão): conta antes, preenche, conta depois e DESFAZ tudo —
--     termina com um erro proposital que traz o resultado na mensagem (nada é
--     gravado — A-11);
--   · APLICAR (só com o OK do dono): rodar antes, na MESMA sessão,
--       select set_config('plt.acerto_s50_obs', 'aplicar', false);
--     e depois este arquivo. Ao terminar, rodar
--       select set_config('plt.acerto_s50_obs', '', false);
-- Reaplicável: rodar de novo não muda nada (o que já está igual ao Tiny fica
-- como está; o que sobrou sem observação no Tiny sai). Ao aplicar, os quadros
-- de produção com peça viva de um pedido que mudou releem uma vez (o aviso de
-- sempre do setor) e o PCP também.
-- ============================================================================
do $$
declare
  v_aplicar  boolean := coalesce(current_setting('plt.acerto_s50_obs', true), '') = 'aplicar';
  v_antes    jsonb;
  v_depois   jsonb;
  v_ins      integer := 0;
  v_upd      integer := 0;
  v_del      integer := 0;
  v_pedidos  bigint[] := '{}';
  v_avisados integer := 0;
  v_setor    bigint;
begin
  -- 0 · a atualização do banco desta sessão tem de estar no ar
  if to_regclass('public.plt_itens_observacao') is null
     or to_regprocedure('plt_privado.fn_itens_observacao_do_raw(jsonb)') is null then
    raise exception 'Parei: a atualização do banco desta sessão (a observação do item) ainda não foi aplicada.';
  end if;

  -- 1 · antes: o que o Tiny mandou (raw) × o que a plataforma guarda
  with tiny as (
    select p.id as pedido_id, p.numero, p.data_pedido, r.seq, r.texto
      from public.pedidos p
      cross join lateral plt_privado.fn_itens_observacao_do_raw(p.raw) r
     where p.raw is not null
  )
  select jsonb_build_object(
           'itens_com_observacao_no_tiny', (select count(*) from tiny),
           'pedidos_com_observacao_no_tiny', (select count(distinct t.pedido_id) from tiny t),
           'itens_dos_ultimos_30_dias', (select count(*) from tiny t where t.data_pedido >= current_date - 30),
           'mediana_de_caracteres', (select percentile_disc(0.5) within group (order by length(t.texto)) from tiny t),
           'maior_em_caracteres', (select max(length(t.texto)) from tiny t),
           'guardados_na_plataforma', (select count(*) from public.plt_itens_observacao),
           'guardados_iguais_ao_tiny', (select count(*) from tiny t
                                          join public.plt_itens_observacao o
                                            on o.pedido_id = t.pedido_id and o.seq = t.seq and o.texto = t.texto),
           'pedido_13871', (select jsonb_agg(jsonb_build_object('item', t.seq, 'texto', t.texto) order by t.seq)
                              from tiny t where t.numero = 13871))
    into v_antes;

  -- 2 · o preenchimento: insere o que falta, troca o que mudou, tira o que sobrou
  with tiny as (
    select p.id as pedido_id, r.seq, r.texto
      from public.pedidos p
      cross join lateral plt_privado.fn_itens_observacao_do_raw(p.raw) r
     where p.raw is not null
  ),
  saiu as (
    delete from public.plt_itens_observacao o
     where not exists (select 1 from tiny t where t.pedido_id = o.pedido_id and t.seq = o.seq)
    returning o.pedido_id
  ),
  gravou as (
    insert into public.plt_itens_observacao as o (pedido_id, seq, texto)
    select t.pedido_id, t.seq, t.texto from tiny t
    on conflict (pedido_id, seq) do update
       set texto = excluded.texto, atualizado_em = now()
     where o.texto is distinct from excluded.texto
    returning o.pedido_id, (o.xmax = 0) as novo
  )
  select (select count(*) from gravou g where g.novo),
         (select count(*) from gravou g where not g.novo),
         (select count(*) from saiu),
         (select coalesce(array_agg(distinct x.pedido_id), '{}')
            from (select s.pedido_id from saiu s union all select g.pedido_id from gravou g) x)
    into v_ins, v_upd, v_del, v_pedidos;

  -- 3 · os quadros de produção com peça viva de um pedido que mudou releem (e o PCP)
  for v_setor in
    select distinct u.setor_atual_id
      from public.plt_cards u
     where u.pedido_id = any (v_pedidos) and u.tipo = 'unidade'
       and u.arquivado_em is null and u.setor_atual_id is not null
  loop
    perform plt_privado.fn_avisar_setor(v_setor);
    v_avisados := v_avisados + 1;
  end loop;
  if cardinality(v_pedidos) > 0 then
    perform plt_privado.fn_avisar('pcp');
  end if;

  -- 4 · depois
  with tiny as (
    select p.id as pedido_id, r.seq, r.texto
      from public.pedidos p
      cross join lateral plt_privado.fn_itens_observacao_do_raw(p.raw) r
     where p.raw is not null
  )
  select jsonb_build_object(
           'guardados_na_plataforma', (select count(*) from public.plt_itens_observacao),
           'pedidos_na_plataforma', (select count(distinct o.pedido_id) from public.plt_itens_observacao o),
           'guardados_iguais_ao_tiny', (select count(*) from tiny t
                                          join public.plt_itens_observacao o
                                            on o.pedido_id = t.pedido_id and o.seq = t.seq and o.texto = t.texto),
           'pedido_13871', (select jsonb_agg(jsonb_build_object('item', o.seq, 'texto', o.texto) order by o.seq)
                              from public.plt_itens_observacao o
                              join public.pedidos p on p.id = o.pedido_id
                             where p.numero = 13871))
    into v_depois;

  if not v_aplicar then
    raise exception 'ENSAIO (nada gravado): %',
      jsonb_build_object('inseridos', v_ins, 'trocados', v_upd, 'tirados', v_del,
                         'pedidos_mexidos', cardinality(v_pedidos), 'quadros_avisados', v_avisados,
                         'antes', v_antes, 'depois', v_depois)::text;
  end if;
  raise notice 'APLICADO: %',
    jsonb_build_object('inseridos', v_ins, 'trocados', v_upd, 'tirados', v_del,
                       'pedidos_mexidos', cardinality(v_pedidos), 'quadros_avisados', v_avisados,
                       'antes', v_antes, 'depois', v_depois)::text;
end;
$$;
