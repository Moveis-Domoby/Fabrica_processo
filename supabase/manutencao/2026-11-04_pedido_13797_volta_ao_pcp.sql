-- ============================================================================
-- SESSAO-44 · Frente 1 — o pedido 13797 volta ao PCP com os 3 itens novos
--
-- O caso (raio-x de 03/11): chegou às 11:42 com 3 itens; às 15:25 o PCP
-- terminou de liberar (3 de 3) e o card do pedido ganhou a marca "liberado por
-- completo". Às 15:41 o vendedor acrescentou 3 itens no Tiny (seq 4, 5 e 6:
-- 327, 567 e 566). A conta da liberação só roda por fato de card — nenhum
-- gatilho em itens do pedido —, então a marca ficou e o pedido sumiu do PCP
-- com 3 móveis sem card. Previsão de entrega: 04/11.
--
-- O acerto (aprovado pelo dono na conversa antes de rodar):
--   1. confere que nada mudou desde o raio-x (senão PARA, sem gravar nada);
--   2. grava o fato de trilha no card do pedido (origem `api`, E-26);
--   3. refaz a conta da liberação (plt_privado.fn_recalcular_liberacao): com
--      3 de 6 unidades, a marca some e o pedido volta ao quadro do PCP.
-- Não cria peça, não mexe nas 3 peças em andamento (14542143, 14542153,
-- 14542161), não reserva estoque: quem libera as vagas 4, 5 e 6 é a equipe, na
-- janela de liberação, com a sugestão de estoque de sempre.
-- Idempotente: rodar de novo, com a marca já vazia, não grava nada.
-- ============================================================================
do $$
declare
  v_pedido_id  bigint := 7954;
  v_card_id    bigint := 14542142;
  v_card       record;
  v_pedido     record;
  v_itens      jsonb;
  v_pecas      jsonb;
  v_divergem   integer;
  v_novos      jsonb;
begin
  select p.id, p.numero, p.situacao into v_pedido
    from public.pedidos p where p.id = v_pedido_id;
  if v_pedido.numero is distinct from 13797 then
    raise exception 'Parei: o pedido % não é o 13797.', v_pedido_id;
  end if;

  select c.id, c.tipo, c.arquivado_em, c.liberado_completo_em, c.standby_desde,
         s.papel_no_fluxo
    into v_card
    from public.plt_cards c
    left join public.plt_setores s on s.id = c.setor_atual_id
   where c.id = v_card_id and c.pedido_id = v_pedido_id and c.tipo = 'pedido';
  if v_card.id is null then
    raise exception 'Parei: o card do pedido % não é o do 13797.', v_card_id;
  end if;
  if v_card.arquivado_em is not null or v_card.papel_no_fluxo is distinct from 'entrada' then
    raise exception 'Parei: o card do pedido saiu do PCP (arquivado %, papel %).',
      v_card.arquivado_em, v_card.papel_no_fluxo;
  end if;
  if plt_privado.fn_tiny_tirou_do_pcp(v_pedido.situacao) then
    raise exception 'Parei: a situação no Tiny (%) tira o pedido do PCP.', v_pedido.situacao;
  end if;

  -- Os itens de hoje: 6, os 3 novos nas posições 4, 5 e 6.
  select jsonb_agg(jsonb_build_object('seq', v.seq, 'codigo', v.codigo,
                                      'descricao', v.descricao, 'unidades', v.unidades)
                   order by v.seq)
    into v_itens
    from plt_privado.vw_itens_producao v where v.pedido_id = v_pedido_id;
  if jsonb_array_length(coalesce(v_itens, '[]')) <> 6
     or (select string_agg(x ->> 'seq' || ':' || coalesce(x ->> 'codigo', '') || 'x' || (x ->> 'unidades'), ','
                           order by (x ->> 'seq')::int)
           from jsonb_array_elements(v_itens) x)
        <> '1:528x1,2:454x1,3:452x1,4:327x1,5:567x1,6:566x1' then
    raise exception 'Parei: os itens do pedido mudaram desde o raio-x: %', v_itens;
  end if;

  -- As peças de hoje: só as 3 de antes, cada uma no produto da sua posição.
  select jsonb_agg(jsonb_build_object('id', c.id, 'seq', c.item_seq, 'codigo', c.item_codigo,
                                      'k', c.indice_unidade, 'arquivado', c.arquivado_em)
                   order by c.id)
    into v_pecas
    from public.plt_cards c where c.pedido_id = v_pedido_id and c.tipo = 'unidade';
  if (select string_agg(x ->> 'id', ',' order by (x ->> 'id')::bigint)
        from jsonb_array_elements(coalesce(v_pecas, '[]')) x)
     is distinct from '14542143,14542153,14542161' then
    raise exception 'Parei: as peças do pedido mudaram desde o raio-x (alguém já liberou?): %', v_pecas;
  end if;
  select count(*)::int into v_divergem
    from public.plt_cards c
    left join public.pedido_itens i on i.pedido_id = c.pedido_id and i.seq = c.item_seq
   where c.pedido_id = v_pedido_id and c.tipo = 'unidade'
     and (i.seq is null or i.codigo is distinct from c.item_codigo or c.item_seq > 3);
  if v_divergem > 0 then
    raise exception 'Parei: % peça(s) não batem com o produto da posição: %', v_divergem, v_pecas;
  end if;

  if v_card.liberado_completo_em is null then
    raise notice 'Nada a fazer: o 13797 já está no PCP (a marca de liberado por completo está vazia).';
    return;
  end if;

  select jsonb_agg(x order by (x ->> 'seq')::int) into v_novos
    from jsonb_array_elements(v_itens) x where (x ->> 'seq')::int > 3;

  insert into public.plt_eventos (card_id, tipo, origem, observacao, dados)
    values (v_card_id, 'pedido_atualizado', 'api',
            'Itens acrescentados no Tiny depois da liberação: o pedido volta ao PCP só com o que falta liberar.',
            jsonb_build_object('manutencao', '2026-11-04_pedido_13797_volta_ao_pcp',
                               'fonte', 'tiny', 'numero', v_pedido.numero,
                               'liberado_completo_antes', v_card.liberado_completo_em,
                               'unidades_liberadas', 3,
                               'itens_novos', v_novos));

  perform plt_privado.fn_recalcular_liberacao(v_pedido_id);

  if (select c.liberado_completo_em from public.plt_cards c where c.id = v_card_id) is not null then
    raise exception 'Parei: a conta da liberação não limpou a marca — nada foi gravado.';
  end if;

  raise notice 'Pronto: o 13797 voltou ao PCP com 3 vagas a liberar (%). Peças intactas: %.',
    v_novos, v_pecas;
end;
$$;

-- Conferência (esperado: liberado_completo_em vazio; 3 peças, as mesmas)
--   select c.id, c.liberado_completo_em from public.plt_cards c where c.id = 14542142;
--   select c.id, c.item_seq, c.item_codigo, c.setor_atual_id from public.plt_cards c
--    where c.pedido_id = 7954 and c.tipo = 'unidade' order by c.id;
