-- ============================================================================
-- SESSAO-41 · F5 (D-196) — acerto da ordem da rota com paradas (achado na
-- revisão da tela, antes de publicar): o conjunto "da rota" contava também o
-- card de pedido ARQUIVADO e ainda programado (ex.: excluído no Tiny) — a tela
-- não o mostra, e salvar a ordem dava sempre "a rota mudou noutra tela". Agora
-- só o pedido vivo (nem entregue, nem arquivado), como nas entregas do dia.
-- Recriadas a partir da migration 20261027050000 (só essa troca).
-- ============================================================================
set local lock_timeout = '5s';

create or replace function plt_privado.fn_rota_aplicar_ordem(
  p_data date, p_caminhao_id bigint, p_rota integer, p_itens jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu        uuid := plt_privado.fn_usuario_atual();
  v_logistica boolean := plt_privado.fn_pode_ver_expedicao();
  v_tem       text[];
  v_vem       text[];
  v_antes     text[];
  v_depois    text[];
  v_item      record;
begin
  -- o que a rota tem agora (pedido ainda não entregue + parada não removida)
  select coalesce(array_agg(k order by k), '{}') into v_tem from (
    select 'p' || pr.card_id as k from public.plt_programacoes pr
      join public.plt_cards pc on pc.id = pr.card_id
     where pr.data_entrega = p_data and pr.caminhao_id = p_caminhao_id and pr.rota = p_rota
       and pc.entrega_evento_id is null and pc.arquivado_em is null
    union all
    select 'a' || pa.id from public.plt_paradas_avulsas pa
     where pa.data_entrega = p_data and pa.caminhao_id = p_caminhao_id and pa.rota = p_rota and pa.removida_em is null
  ) x;
  select coalesce(array_agg(k order by k), '{}') into v_vem
    from (select (e ->> 't') || (e ->> 'id') as k from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) e) x;
  if v_tem <> v_vem then
    raise exception 'A rota mudou noutra tela — atualize e arrume a ordem de novo.' using errcode = 'check_violation';
  end if;

  if not v_logistica then
    -- o entregador: a ordem do que NÃO é parada dele fica como estava (quem tem ordem salva)
    select coalesce(array_agg(k order by o, k), '{}') into v_antes from (
      select 'p' || pr.card_id as k, pr.ordem as o from public.plt_programacoes pr
        join public.plt_cards pc on pc.id = pr.card_id
       where pr.data_entrega = p_data and pr.caminhao_id = p_caminhao_id and pr.rota = p_rota
         and pc.entrega_evento_id is null and pc.arquivado_em is null and pr.ordem is not null
      union all
      select 'a' || pa.id, pa.ordem from public.plt_paradas_avulsas pa
       where pa.data_entrega = p_data and pa.caminhao_id = p_caminhao_id and pa.rota = p_rota
         and pa.removida_em is null and pa.ordem is not null
         and not (pa.criada_por = v_eu and pa.situacao = 'pendente')
    ) x;
    select coalesce(array_agg(k order by i), '{}') into v_depois from (
      select (e ->> 't') || (e ->> 'id') as k, i
        from jsonb_array_elements(p_itens) with ordinality as t(e, i)
    ) x where x.k = any (v_antes);
    if v_antes <> v_depois then
      raise exception 'A ordem dos pedidos é da logística — o entregador só muda o lugar da parada que ele pôs.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  for v_item in
    select e ->> 't' as t, (e ->> 'id')::bigint as id, i::int as i
      from jsonb_array_elements(p_itens) with ordinality as t(e, i)
  loop
    if v_item.t = 'p' then
      update public.plt_programacoes set ordem = v_item.i
       where card_id = v_item.id and ordem is distinct from v_item.i;
    else
      update public.plt_paradas_avulsas set ordem = v_item.i
       where id = v_item.id and ordem is distinct from v_item.i;
    end if;
  end loop;
  perform plt_privado.fn_avisar('rotas');
end;
$$;

create or replace function public.plt_fn_programar_rota_paradas(
  p_data        date,
  p_caminhao_id bigint,
  p_rota        integer,
  p_card_ids    bigint[],
  p_paradas     jsonb,
  p_ordem       jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu     uuid := plt_privado.fn_usuario_atual();
  v_mapa   jsonb := '{}'::jsonb;
  v_par    jsonb;
  v_id     bigint;
  v_ordem  jsonb;
  v_resto  jsonb;
begin
  if v_eu is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Programar a rota é da logística.' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(array_length(p_card_ids, 1), 0) > 0 then
    perform public.plt_fn_programar_rota(p_data, p_caminhao_id, p_card_ids, null::bigint[], p_rota);
  end if;
  for v_par in select * from jsonb_array_elements(coalesce(p_paradas, '[]'::jsonb))
  loop
    v_id := (public.plt_fn_parada_avulsa_salvar(
      null, p_data, p_caminhao_id, p_rota, v_par ->> 'titulo', v_par ->> 'endereco',
      (v_par ->> 'latitude')::double precision, (v_par ->> 'longitude')::double precision,
      v_par ->> 'observacao', null, null) ->> 'id')::bigint;
    v_mapa := v_mapa || jsonb_build_object(v_par ->> 'k', v_id);
  end loop;
  if p_ordem is not null and jsonb_array_length(p_ordem) > 0 then
    -- a ordem da tela (o novo + o que a rota já tinha, que vai depois, na ordem dele)
    select jsonb_agg(case when e ->> 't' = 'n' then jsonb_build_object('t', 'a', 'id', (v_mapa ->> (e ->> 'k'))::bigint)
                          else e end order by i)
      into v_ordem
      from jsonb_array_elements(p_ordem) with ordinality as t(e, i);
    select coalesce(jsonb_agg(x.e order by x.o nulls last, x.k), '[]'::jsonb) into v_resto from (
      select jsonb_build_object('t', 'p', 'id', pr.card_id) as e, pr.ordem as o, 'p' || pr.card_id as k
        from public.plt_programacoes pr join public.plt_cards pc on pc.id = pr.card_id
       where pr.data_entrega = p_data and pr.caminhao_id = p_caminhao_id and pr.rota = p_rota
         and pc.entrega_evento_id is null and pc.arquivado_em is null and not (pr.card_id = any (coalesce(p_card_ids, '{}'::bigint[])))
      union all
      select jsonb_build_object('t', 'a', 'id', pa.id), pa.ordem, 'a' || pa.id
        from public.plt_paradas_avulsas pa
       where pa.data_entrega = p_data and pa.caminhao_id = p_caminhao_id and pa.rota = p_rota
         and pa.removida_em is null and not exists (select 1 from jsonb_each_text(v_mapa) m where m.value::bigint = pa.id)
    ) x;
    perform plt_privado.fn_rota_aplicar_ordem(p_data, p_caminhao_id, p_rota, v_ordem || v_resto);
  end if;
  return jsonb_build_object('paradas', v_mapa);
end;
$$;

revoke all on function plt_privado.fn_rota_aplicar_ordem(date, bigint, integer, jsonb) from public, anon, authenticated;
revoke all on function public.plt_fn_programar_rota_paradas(date, bigint, integer, bigint[], jsonb, jsonb) from public, anon;
grant execute on function public.plt_fn_programar_rota_paradas(date, bigint, integer, bigint[], jsonb, jsonb) to authenticated;
