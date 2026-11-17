-- ============================================================================
-- SESSAO-51 · BLOCO A — a entrega parcial que mantém a produção (com revogar)
-- ============================================================================
-- Pedido do dono (16/11, 22:41): "quando um pedido for lançado para entrega
-- parcial, os produtos que ainda estão em produção continuam em produção, a
-- menos que o responsável queira remover os mesmos da linha… podendo revogar
-- essa decisão em todos os pedidos".
--
-- Frente 1 · a janela separa "Saíram para a entrega" (as prontas — desmarcada =
--   voltou → "Em decisão pós devolução", como hoje — D-195) de "Ainda na
--   fábrica" (as peças em setor de produção + as vagas ainda no PCP — vêm
--   desmarcadas; marcar uma = "foi entregue mesmo", com a confirmação da D-156).
-- Frente 2 · a decisão sobre o que ficou na fábrica:
--   "Deixar em produção" (padrão; o entregador só tem esta) — nada muda nas
--     peças; o pedido NÃO fecha (o pedido_entregue parcial não vira a entrega
--     vigente do card), segue vivo em toda regra (PCP, Expedição, programação) e
--     sai da rota do dia (volta para "Programar", como no "Não entregue");
--   "Limpar da produção" (logística, PCP e admin) — cada peça ganha o fato
--     peca_retirada_entrega_parcial (setor, etapa, posição, pedido, item, k/n),
--     o tempo aberto fecha e ela é arquivada com registro (não perde o pedido);
--     as vagas saem do PCP pela regra única (a marca de remoção com o motivo
--     'entrega_parcial'); o pedido fecha como hoje; sino do PCP.
-- Frente 3 · o revogar ("Entregas parciais" no PCP e a ficha do pedido): o
--   botão contrário à decisão que vale; idas e voltas quantas vezes for preciso.
--
-- A escolha da forma (D-325): o pedido_entregue parcial com "Deixar em
-- produção" não é a entrega vigente do card (entrega_evento_id fica nulo) — o
-- pedido continua vivo em TODA porta sem tocar em nenhuma delas (as dezenas de
-- filtros "entrega_evento_id is null" e a regra única do PCP seguem iguais); a
-- entrega parcial vive nas colunas parcial_* (projeção da base da 51). O
-- "Entregue" normal do resto fecha o pedido e vai ao Tiny, como hoje
-- (D-113/D-276); o "Entregue" no Tiny fecha tudo (D-113 inalterada).
-- Recriações a partir das versões vigentes (A-96/A-97). Nada aqui altera tabela
-- da integração.
-- ============================================================================
set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · A projeção da entrega: a parcial com "Deixar em produção" não fecha o pedido
-- ----------------------------------------------------------------------------
-- (recriada da vigente — 20261109030000_plt_entrega_dia_real.sql)
create or replace function plt_privado.fn_projetar_entrega()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.tipo = 'pedido_entregue' then
    -- SESSAO-51 (D-325): a entrega PARCIAL com "Deixar em produção" não fecha o
    -- pedido — o resto segue vivo em toda regra de pedido vivo (PCP, Expedição,
    -- programação). A entrega parcial fica no card (parcial_*, pela projeção da 51).
    if coalesce(new.dados ->> 'fabrica', '') = 'manter' then
      return null;
    end if;
    update public.plt_cards
       set entrega_evento_id = new.id, entrega_em = new.ocorrido_em
     where id = new.card_id;
  elsif new.tipo = 'entrega_desfeita' then
    update public.plt_cards
       set entrega_evento_id = null, entrega_em = null
     where id = new.card_id;
  elsif new.tipo = 'entrega_dia_corrigido' then
    -- só a correção da entrega VIGENTE vale (a guarda do fato já confere)
    update public.plt_cards
       set entrega_em = (new.dados ->> 'entregue_em')::timestamptz
     where id = new.card_id and entrega_evento_id = new.evento_referencia_id;
  end if;
  return null;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2 · O estado da entrega parcial de um pedido (uma regra só para a ficha, a
--     lista "Entregas parciais", a janela do revogar e o próprio revogar)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_parcial_estado(p_card_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_card      public.plt_cards%rowtype;
  v_p         public.pedidos%rowtype;
  v_cliente   text;
  v_producao  jsonb;
  v_prontas   jsonb;
  v_retiradas jsonb;
  v_n_prod    integer := 0;
  v_n_pront   integer := 0;
  v_n_ret     integer := 0;
  v_vagas     integer := 0;
  v_situacao  text;
  v_porque    text;
begin
  select * into v_card from public.plt_cards where id = p_card_id and tipo = 'pedido';
  if not found or v_card.parcial_evento_id is null then
    return null;
  end if;
  select * into v_p from public.pedidos where id = v_card.pedido_id;
  select cl.nome into v_cliente from public.clientes cl where cl.id = v_p.cliente_id;
  v_situacao := plt_privado.fn_situacao_normalizada(v_p.situacao);

  -- o que ainda está na fábrica: as peças vivas em setor de entrada ou de produção
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', u.id, 'descricao', u.item_descricao, 'indice', u.indice_unidade, 'total', u.total_unidades,
           'setor', s.nome, 'etapa', et.nome, 'trabalhando', u.executor_atual_id is not null)
           order by s.ordem, et.ordem nulls last, u.id), '[]'::jsonb),
         count(*)::int
    into v_producao, v_n_prod
    from public.plt_cards u
    join public.plt_setores s on s.id = u.setor_atual_id
    left join public.plt_etapas et on et.id = u.etapa_atual_id
   where u.pedido_id = v_card.pedido_id and u.tipo = 'unidade' and u.arquivado_em is null
     and u.cancelada_em is null and u.destino_pendente_em is null
     and s.papel_no_fluxo in ('entrada', 'producao');

  -- o que já está pronto (Pedidos em aguardo, a rota, a decisão pós devolução):
  -- o revogar não mexe nelas (D-327)
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', u.id, 'descricao', u.item_descricao, 'indice', u.indice_unidade, 'total', u.total_unidades,
           'onde', s.nome, 'na_rota', s.codigo = 'rotas') order by s.ordem, u.id), '[]'::jsonb),
         count(*)::int
    into v_prontas, v_n_pront
    from public.plt_cards u
    join public.plt_setores s on s.id = u.setor_atual_id
   where u.pedido_id = v_card.pedido_id and u.tipo = 'unidade' and u.arquivado_em is null
     and u.cancelada_em is null and s.papel_no_fluxo = 'terminal';

  -- as que a entrega parcial (ou o revogar) tirou da produção, e para onde voltam:
  -- a mesma etapa; etapa arquivada → a primeira etapa ativa do setor; setor que
  -- não existe mais (ou sem etapa ativa) → vira vaga no PCP (D-327)
  select coalesce(jsonb_agg(x.j order by x.ordem, x.id), '[]'::jsonb), count(*)::int
    into v_retiradas, v_n_ret
    from (
      select u.id, coalesce(sr.ordem, 999) as ordem,
             jsonb_build_object(
               'id', u.id, 'descricao', u.item_descricao, 'indice', u.indice_unidade, 'total', u.total_unidades,
               'setor_id', r.setor_id, 'setor', r.setor, 'etapa_id', r.etapa_id, 'etapa', r.etapa,
               'retirada_em', u.retirada_parcial_em,
               'destino_setor', case when d.ok then sr.nome end,
               'destino_etapa_id', case when d.ok then d.etapa_id end,
               'destino_etapa', case when d.ok then d.etapa end,
               'mudou_etapa', d.ok and d.etapa_id is distinct from r.etapa_id,
               'vira_vaga', not d.ok) as j
        from public.plt_cards u
        cross join lateral (
          select nullif(e.dados ->> 'setor_id', '')::bigint as setor_id, e.dados ->> 'setor' as setor,
                 nullif(e.dados ->> 'etapa_id', '')::bigint as etapa_id, e.dados ->> 'etapa' as etapa
            from public.plt_eventos e where e.id = u.retirada_parcial_evento_id) r
        left join public.plt_setores sr on sr.id = r.setor_id
        cross join lateral (
          select coalesce(sr.ativo, false) and sr.papel_no_fluxo = 'producao' and et.id is not null as ok,
                 et.id as etapa_id, et.nome as etapa
            from (select 1) um
            left join lateral (
              select e2.id, e2.nome
                from public.plt_etapas e2
               where e2.setor_id = r.setor_id and e2.ativa
                 and (e2.id = r.etapa_id or (not coalesce(e2.eh_danificado, false)
                                             and not coalesce(e2.cancela_fabricacao, false)))
               order by (e2.id = r.etapa_id) desc, e2.ordem, e2.id
               limit 1) et on true) d
       where u.pedido_id = v_card.pedido_id and u.tipo = 'unidade'
         and u.retirada_parcial_em is not null and u.arquivado_em is not null
    ) x;

  -- as vagas do pedido ainda sem peça (nem reserva do estoque) — as que estão
  -- (ou estariam) no PCP para liberar
  select count(*)::int into v_vagas
    from plt_privado.fn_vagas_pedido(v_card.pedido_id) w
   where w.card_id is null and w.reserva_card_id is null;

  v_porque := case
    when v_card.parcial_decisao is null then 'Esta entrega parcial não deixou nada na fábrica para decidir.'
    when v_card.entrega_evento_id is not null and v_card.entrega_evento_id <> v_card.parcial_evento_id
      then 'O resto do pedido já foi entregue.'
    when v_card.arquivado_em is not null then 'O pedido foi arquivado.'
    when v_situacao = 'cancelado' or v_card.cancelado_plataforma_em is not null then 'O pedido foi cancelado.'
    when exists (select 1 from public.plt_pedidos_excluidos_tiny x where x.pedido_id = v_p.id)
      then 'O pedido foi excluído no Tiny.'
    when v_situacao in ('entregue', 'nao_entregue') then 'O Tiny marcou o pedido como "' || coalesce(v_p.situacao, '') || '".'
    when v_card.removido_pcp_motivo = 'oculto' then 'O pedido foi ocultado do PCP.'
    when v_card.parcial_decisao = 'manter' and v_n_prod = 0 and v_vagas = 0
      then 'Não sobrou nada na fábrica nem no PCP.'
    when v_card.parcial_decisao = 'limpar' and v_n_ret = 0 and v_vagas = 0
      then 'Não sobrou nada para voltar à produção.'
  end;

  return jsonb_build_object(
    'card_id', v_card.id, 'pedido_id', v_p.id, 'numero', v_p.numero, 'cliente', coalesce(v_cliente, ''),
    'parcial_em', v_card.parcial_em,
    'parcial_por', (select u.nome from public.plt_eventos e join public.plt_usuarios u on u.id = e.usuario_id
                     where e.id = v_card.parcial_evento_id),
    'entregues', v_card.parcial_entregues, 'total', v_card.parcial_total,
    'decisao', v_card.parcial_decisao, 'decisao_em', v_card.parcial_decisao_em,
    'decisao_por', (select u.nome from public.plt_eventos e join public.plt_usuarios u on u.id = e.usuario_id
                     where e.id = v_card.parcial_decisao_evento_id),
    'na_producao', v_producao, 'prontas', v_prontas, 'retiradas', v_retiradas,
    'n_producao', v_n_prod, 'n_prontas', v_n_pront, 'n_retiradas', v_n_ret, 'vagas', v_vagas,
    'fechado', v_card.entrega_evento_id is not null,
    'acao', case v_card.parcial_decisao when 'manter' then 'remover' when 'limpar' then 'voltar' end,
    'pode_revogar', v_porque is null, 'porque_nao', v_porque);
end;
$$;
comment on function plt_privado.fn_parcial_estado(bigint) is
  'SESSAO-51 (bloco A): o estado da entrega parcial de um pedido — o que ainda está na fábrica, o que está pronto, o que a decisão tirou (e para onde volta), as vagas sem peça, a decisão que vale e se dá para revogar (e por que não). Uma regra só para a ficha, a lista, a janela e o revogar.';
revoke all on function plt_privado.fn_parcial_estado(bigint) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3 · A peça sai da produção / volta para ela (a maquinaria do Limpar e do
--     revogar — a marca plt.parcial_maquinaria liga quem chama)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_parcial_retirar_peca(
  p_card_id bigint, p_usuario uuid, p_ref bigint, p_numero integer, p_card_pedido_id bigint,
  p_entrega_evento_id bigint, p_origem_gesto text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r     record;
  v_pos integer;
begin
  select c.id, c.pedido_id, c.setor_atual_id, c.etapa_atual_id, c.item_seq, c.indice_unidade, c.total_unidades,
         c.executor_atual_id, c.desde, s.nome as setor, et.nome as etapa
    into r
    from public.plt_cards c
    left join public.plt_setores s on s.id = c.setor_atual_id
    left join public.plt_etapas et on et.id = c.etapa_atual_id
   where c.id = p_card_id
     for update of c;
  -- a posição na fila da etapa (a ordem de chegada — o quadro ordena por ela)
  select count(*)::int + 1 into v_pos
    from public.plt_cards o
   where o.etapa_atual_id = r.etapa_atual_id and o.arquivado_em is null and o.id <> r.id
     and o.desde < r.desde;
  -- o fato ANTES de fechar o tempo (fechar move a peça para a fila — a etapa de
  -- onde ela saiu fica guardada aqui, para a volta)
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, evento_referencia_id,
                                  setor_origem_id, etapa_origem_id, observacao, dados)
    values (r.id, 'peca_retirada_entrega_parcial', p_usuario, 'interface', p_ref,
            r.setor_atual_id, r.etapa_atual_id,
            format('Saiu da produção (entrega parcial do pedido %s) — estava em %s.', p_numero,
                   concat_ws(' · ', r.setor, r.etapa)),
            jsonb_build_object(
              'motivo', 'entrega_parcial', 'gesto', p_origem_gesto,
              'pedido_id', r.pedido_id, 'numero', p_numero, 'card_pedido_id', p_card_pedido_id,
              'item_seq', r.item_seq, 'indice_unidade', r.indice_unidade, 'total_unidades', r.total_unidades,
              'setor_id', r.setor_atual_id, 'setor', r.setor, 'etapa_id', r.etapa_atual_id, 'etapa', r.etapa,
              'posicao', v_pos, 'desde', r.desde, 'executor_id', r.executor_atual_id,
              'entrega_evento_id', p_entrega_evento_id));
  perform plt_privado.fn_fechar_tempo_aberto(r.id, 'A peça saiu da produção (entrega parcial): o tempo aberto fecha antes.');
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, evento_referencia_id, observacao, dados)
    values (r.id, 'card_arquivado', p_usuario, 'interface', p_ref,
            format('Saiu da produção na entrega parcial do pedido %s — nada é apagado; dá para voltar atrás em PCP → Entregas parciais.', p_numero),
            jsonb_build_object('motivo', 'retirada_entrega_parcial', 'pedido_id', r.pedido_id, 'numero', p_numero,
                               'entrega_evento_id', p_entrega_evento_id));
end;
$$;
revoke all on function plt_privado.fn_parcial_retirar_peca(bigint, uuid, bigint, integer, bigint, bigint, text) from public, anon, authenticated;

create or replace function plt_privado.fn_parcial_voltar_peca(
  p_card_id bigint, p_usuario uuid, p_ref bigint, p_numero integer, p_card_pedido_id bigint, p_destino jsonb)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card    public.plt_cards%rowtype;
  v_etapa   bigint := nullif(p_destino ->> 'destino_etapa_id', '')::bigint;
  v_produto bigint;
begin
  select * into v_card from public.plt_cards where id = p_card_id for update;
  if v_card.id is null or v_card.retirada_parcial_em is null or v_card.arquivado_em is null then
    return 'nada';
  end if;
  if coalesce((p_destino ->> 'vira_vaga')::boolean, false) or v_etapa is null then
    -- o setor não existe mais: a peça fica guardada e a vaga dela reabre no PCP
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, evento_referencia_id, observacao, dados)
      values (v_card.id, 'peca_volta_entrega_parcial', p_usuario, 'interface', p_ref,
              format('O revogar não achou o setor %s — a peça fica guardada e a vaga dela volta ao PCP.',
                     coalesce(p_destino ->> 'setor', '')),
              jsonb_build_object('motivo', 'revogar', 'vira_vaga', true, 'pedido_id', v_card.pedido_id,
                                 'numero', p_numero, 'setor', p_destino ->> 'setor', 'etapa', p_destino ->> 'etapa'));
    if v_card.pedido_id is not null then
      v_produto := coalesce(v_card.produto_tiny_id,
                            plt_privado.fn_produto_do_item(v_card.item_codigo, v_card.item_descricao));
      insert into public.plt_eventos (card_id, tipo, origem, evento_referencia_id, observacao, dados)
        values (v_card.id, 'unidade_desvinculada', 'automacao', p_ref,
                format('O setor da peça não existe mais — ela saiu do pedido %s e a vaga voltou ao PCP.', p_numero),
                jsonb_build_object('motivo', 'entrega_parcial_setor_sumiu', 'pedido_id', v_card.pedido_id,
                                   'numero', p_numero, 'card_pedido_id', p_card_pedido_id,
                                   'produto_tiny_id', v_produto, 'sem_pai', v_produto is not null,
                                   'card_pai_id', case when v_produto is null and v_card.card_pai_id is null
                                                       then p_card_pedido_id end));
    end if;
    return 'vaga';
  end if;
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, evento_referencia_id,
                                  setor_destino_id, etapa_destino_id, observacao, dados)
    values (v_card.id, 'peca_volta_entrega_parcial', p_usuario, 'interface', p_ref,
            nullif(p_destino ->> 'setor_id', '')::bigint, v_etapa,
            format('Voltou para a produção (revogar da entrega parcial do pedido %s): %s%s.', p_numero,
                   concat_ws(' · ', p_destino ->> 'destino_setor', p_destino ->> 'destino_etapa'),
                   case when coalesce((p_destino ->> 'mudou_etapa')::boolean, false)
                        then format(' — a etapa %s não existe mais', coalesce(p_destino ->> 'etapa', '')) else '' end),
            jsonb_build_object('motivo', 'revogar', 'vira_vaga', false, 'pedido_id', v_card.pedido_id,
                               'numero', p_numero, 'etapa_antes', p_destino ->> 'etapa',
                               'etapa', p_destino ->> 'destino_etapa', 'setor', p_destino ->> 'destino_setor',
                               'mudou_etapa', coalesce((p_destino ->> 'mudou_etapa')::boolean, false)));
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, evento_referencia_id,
                                  setor_origem_id, etapa_origem_id, observacao, dados)
    values (v_card.id, 'card_desarquivado', p_usuario, 'interface', p_ref, v_card.setor_atual_id, v_card.etapa_atual_id,
            'O revogar da entrega parcial trouxe a peça de volta (com a história dela).',
            jsonb_build_object('motivo', 'revogar_entrega_parcial'));
  -- na fila da etapa, sem ninguém trabalhando: a fila recomeça a contar agora
  -- (o tempo em que ela ficou fora não conta — D-327); quem for trabalhar aperta "Iniciar"
  insert into public.plt_eventos (card_id, tipo, origem, evento_referencia_id, setor_origem_id, etapa_origem_id,
                                  setor_destino_id, etapa_destino_id, observacao, dados)
    values (v_card.id, 'movimentacao_etapa', 'api', p_ref, v_card.setor_atual_id, v_card.etapa_atual_id,
            v_card.setor_atual_id, v_etapa,
            'Voltou pelo revogar da entrega parcial — espera alguém iniciar.',
            jsonb_build_object('motivo', 'revogar_entrega_parcial'));
  return 'voltou';
end;
$$;
revoke all on function plt_privado.fn_parcial_voltar_peca(bigint, uuid, bigint, integer, bigint, jsonb) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4 · Frente 1 · a janela da entrega parcial: as peças em dois grupos, as vagas
--     ainda no PCP, os motivos e quem pode limpar — numa requisição, ao abrir
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_entrega_parcial_abrir(p_card_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_card    public.plt_cards%rowtype;
  v_pecas   jsonb;
  v_vagas   integer := 0;
  v_motivos jsonb;
  v_recusa  text;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_mexer_entrega(p_card_id) then
    raise exception 'Ver as peças da entrega é da logística, do entregador do caminhão ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;
  select * into v_card from public.plt_cards where id = p_card_id and tipo = 'pedido';
  if not found then
    raise exception 'Card de pedido % não existe.', p_card_id using errcode = 'no_data_found';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', u.id, 'descricao', u.item_descricao, 'item_seq', u.item_seq,
           'indice', u.indice_unidade, 'total', u.total_unidades,
           'pronta', coalesce(s.papel_no_fluxo = 'terminal' and s.codigo <> 'devolucao', false),
           'onde', s.nome, 'setor', s.nome, 'etapa', et.nome)
           order by coalesce(s.papel_no_fluxo = 'terminal' and s.codigo <> 'devolucao', false) desc,
                    u.item_seq, u.indice_unidade, u.id), '[]'::jsonb)
    into v_pecas
    from public.plt_cards u
    left join public.plt_setores s on s.id = u.setor_atual_id
    left join public.plt_etapas et on et.id = u.etapa_atual_id
   where u.pedido_id = v_card.pedido_id and u.tipo = 'unidade' and u.arquivado_em is null;

  select count(*)::int into v_vagas
    from plt_privado.fn_vagas_pedido(v_card.pedido_id) w
   where w.card_id is null and w.reserva_card_id is null;

  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'texto', m.texto) order by m.ordem, m.id), '[]'::jsonb)
    into v_motivos
    from public.plt_motivos m where m.tipo = 'entrega_parcial' and m.ativo;

  v_recusa := case
    when v_card.entrega_evento_id is not null then 'Este pedido já foi registrado como entregue.'
    when v_card.devolucao_evento_id is not null
      then 'Este pedido está em decisão pós devolução — decida a situação das peças antes de entregar.'
    when plt_privado.fn_pedido_cancelado(v_card.pedido_id) then 'Este pedido foi cancelado no Tiny — não se entrega.'
    when exists (select 1 from public.plt_cards s where s.reservada_pedido_id = v_card.pedido_id and s.arquivado_em is null)
      then 'Este pedido leva peça reservada do estoque — a entrega parcial dele é com a logística (use Entregue ou Pedido devolvido).'
  end;

  return jsonb_build_object('pecas', v_pecas, 'vagas', v_vagas, 'motivos', v_motivos,
                            'pode_limpar', plt_privado.fn_pode_ver_expedicao(), 'recusa', v_recusa);
end;
$$;
revoke all on function public.plt_fn_entrega_parcial_abrir(bigint) from public, anon;
grant execute on function public.plt_fn_entrega_parcial_abrir(bigint) to authenticated;

-- ----------------------------------------------------------------------------
-- 5 · Frentes 1 e 2 · o gesto da entrega parcial com a decisão sobre a fábrica.
--     A assinatura antiga (5 argumentos) sai; a nova tem p_fabrica com padrão
--     'manter' — o site de antes chama pelos nomes e cai nela (vale "Deixar em
--     produção"). A-12: assinatura nova = drop + create.
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_entrega_parcial(bigint, bigint[], bigint, text, boolean);
create or replace function public.plt_fn_entrega_parcial(
  p_card_id              bigint,
  p_entregues            bigint[],
  p_motivo_id            bigint default null,
  p_observacao           text default null,
  p_confirmar_incompleto boolean default false,
  p_fabrica              text default 'manter'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario  uuid;
  v_card     public.plt_cards%rowtype;
  v_prog     public.plt_programacoes%rowtype;
  v_numero   integer;
  v_fabrica  text := lower(coalesce(nullif(btrim(p_fabrica), ''), 'manter'));
  v_motivo   text;
  v_obs      text;
  v_pedidas  bigint[];
  v_vivas    bigint[];
  v_prontas  bigint[];
  v_entregue bigint[];
  v_voltou   bigint[];
  v_ficam    bigint[];
  v_vagas    integer := 0;
  v_total    integer := 0;
  v_tem      boolean;
  v_entrega  bigint;
  v_dev      bigint;
  v_evento   bigint;
  v_marca_e  text;
  v_marca_d  text;
  v_marca_p  text;
  v_marca_c  text;
  v_tempos   integer := 0;
  v_retiradas integer := 0;
  v_avisados integer := 0;
  v_saiu_rota boolean := false;
  v_nome     text;
  r          record;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null then
    raise exception 'Só usuário ativo da plataforma registra entrega.' using errcode = 'insufficient_privilege';
  end if;
  select array_agg(x order by x) into v_pedidas from unnest(coalesce(p_entregues, '{}'::bigint[])) x;
  -- Lei §10: o mesmo toque repetido (a rede que volta) = uma entrega só. Vem ANTES
  -- da permissão: com "Deixar em produção" o pedido sai da rota do dia, e o
  -- entregador deixa de ser da equipe dele — o toque repetido dele não muda nada.
  if exists (select 1 from public.plt_cards c
               join public.plt_eventos e on e.id = c.parcial_evento_id
              where c.id = p_card_id and c.tipo = 'pedido' and c.entrega_evento_id is null
                and e.usuario_id = v_usuario and e.registrado_em > now() - interval '10 minutes'
                and e.dados -> 'entregues' = to_jsonb(coalesce(v_pedidas, '{}'::bigint[]))) then
    return jsonb_build_object('entrega_evento_id', (select c.parcial_evento_id from public.plt_cards c where c.id = p_card_id),
                              'repetido', true);
  end if;
  if not plt_privado.fn_pode_mexer_entrega(p_card_id) then
    raise exception 'Registrar entrega é gesto da logística (PCP/terminais), do entregador do caminhão ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;
  if v_fabrica not in ('manter', 'limpar') then
    raise exception 'Escolha o que fazer com o que ainda está na fábrica: deixar em produção ou limpar da produção.'
      using errcode = 'check_violation';
  end if;
  select * into v_card from public.plt_cards where id = p_card_id and tipo = 'pedido' for update;
  if not found then
    raise exception 'Card de pedido % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  select p.numero into v_numero from public.pedidos p where p.id = v_card.pedido_id;

  -- o toque repetido da entrega que FECHOU o pedido (a parcial sem nada na fábrica
  -- ou com "Limpar") — o da que deixou o resto vivo foi conferido acima
  if v_card.entrega_evento_id is not null then
    if exists (select 1 from public.plt_eventos e
                where e.id = v_card.entrega_evento_id and e.usuario_id = v_usuario
                  and coalesce((e.dados ->> 'parcial')::boolean, false)
                  -- SESSAO-47: pelo REGISTRO (o administrador pode corrigir o dia depois)
                  and e.registrado_em > now() - interval '10 minutes') then
      return jsonb_build_object('entrega_evento_id', v_card.entrega_evento_id, 'repetido', true);
    end if;
    raise exception 'Este pedido já foi registrado como entregue.' using errcode = 'check_violation';
  end if;
  if v_card.devolucao_evento_id is not null then
    raise exception 'Este pedido está em decisão pós devolução — decida a situação das peças antes de entregar.'
      using errcode = 'check_violation';
  end if;
  if plt_privado.fn_pedido_cancelado(v_card.pedido_id) then
    raise exception 'Este pedido foi cancelado no Tiny — não se entrega.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.plt_cards s where s.reservada_pedido_id = v_card.pedido_id and s.arquivado_em is null) then
    raise exception 'Este pedido leva peça reservada do estoque — a entrega parcial dele é com a logística (use Entregue ou Pedido devolvido).'
      using errcode = 'check_violation';
  end if;

  -- o motivo (da lista) e/ou a observação — pelo menos um dos dois
  if p_motivo_id is not null then
    select m.texto into v_motivo from public.plt_motivos m
     where m.id = p_motivo_id and m.tipo = 'entrega_parcial' and m.ativo;
    if v_motivo is null then
      raise exception 'Esse motivo não vale para entrega parcial.' using errcode = 'check_violation';
    end if;
  end if;
  v_obs := nullif(btrim(coalesce(p_observacao, '')), '');
  if v_motivo is null and v_obs is null then
    raise exception 'Diga por que a entrega foi parcial: escolha um motivo ou escreva uma observação.'
      using errcode = 'check_violation';
  end if;

  -- as peças vivas do pedido, as prontas (fim de linha, fora da devolução) e as
  -- que ainda estão na fábrica (o resto)
  select array_agg(u.id order by u.id) into v_vivas
    from public.plt_cards u
   where u.pedido_id = v_card.pedido_id and u.tipo = 'unidade' and u.arquivado_em is null;
  select array_agg(u.id order by u.id) into v_prontas
    from public.plt_cards u
    join public.plt_setores s on s.id = u.setor_atual_id
   where u.id = any (coalesce(v_vivas, '{}'::bigint[])) and s.papel_no_fluxo = 'terminal' and s.codigo <> 'devolucao';
  select array_agg(x order by x) into v_entregue
    from unnest(coalesce(v_pedidas, '{}'::bigint[])) x where x = any (coalesce(v_vivas, '{}'::bigint[]));
  if v_entregue is null then
    raise exception 'Marque o que foi entregue (para nada entregue, use "Não entregue").' using errcode = 'check_violation';
  end if;
  -- desmarcada PRONTA = voltou (D-195); desmarcada NA FÁBRICA = segue a decisão (D-325)
  select array_agg(x order by x) into v_voltou
    from unnest(coalesce(v_prontas, '{}'::bigint[])) x where not (x = any (v_entregue));
  select array_agg(x order by x) into v_ficam
    from unnest(coalesce(v_vivas, '{}'::bigint[])) x
   where not (x = any (v_entregue)) and not (x = any (coalesce(v_prontas, '{}'::bigint[])));
  select count(*)::int into v_vagas
    from plt_privado.fn_vagas_pedido(v_card.pedido_id) w
   where w.card_id is null and w.reserva_card_id is null;
  v_tem := v_ficam is not null or v_vagas > 0;
  if v_voltou is null and not v_tem then
    raise exception 'Todas as peças foram marcadas como entregues — use "Entregue".' using errcode = 'check_violation';
  end if;
  if v_tem and v_fabrica = 'limpar' and not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Tirar da produção o que ainda está na fábrica é decisão da logística, do PCP ou do admin. Escolha "Deixar em produção" — a logística pode revogar depois.'
      using errcode = 'insufficient_privilege';
  end if;

  -- marcar como entregue uma peça que a plataforma ainda vê na fábrica: a
  -- plataforma pode estar atrasada — pede a confirmação, como no "Entregue" (D-156)
  if exists (select 1 from unnest(v_entregue) x where not (x = any (coalesce(v_prontas, '{}'::bigint[]))))
     and not coalesce(p_confirmar_incompleto, false) then
    raise exception 'Uma peça marcada como entregue ainda aparece em produção na fábrica (% de % peças prontas). Confirme só se ela foi mesmo entregue.',
      coalesce(array_length(v_prontas, 1), 0), coalesce(array_length(v_vivas, 1), 0)
      using errcode = 'check_violation';
  end if;

  select coalesce(sum(v.unidades), 0)::int into v_total
    from plt_privado.vw_itens_producao v where v.pedido_id = v_card.pedido_id;
  select * into v_prog from public.plt_programacoes where card_id = v_card.id;
  if v_voltou is not null then
    select s.id into v_dev from public.plt_setores s where s.codigo = 'devolucao';
    if v_dev is null then
      raise exception 'O lugar "Em decisão pós devolução" não está cadastrado — fale com o admin.' using errcode = 'no_data_found';
    end if;
  end if;

  v_marca_e := current_setting('plt.entrega_maquinaria', true);
  v_marca_d := current_setting('plt.devolucao_maquinaria', true);
  v_marca_p := current_setting('plt.parcial_maquinaria', true);
  v_marca_c := current_setting('plt.cancelados_maquinaria', true);
  perform set_config('plt.entrega_maquinaria', 'on', true);
  perform set_config('plt.devolucao_maquinaria', 'on', true);
  perform set_config('plt.parcial_maquinaria', 'on', true);

  -- (1) a entrega — do pedido, marcada PARCIAL (o Tiny não é chamado). Com algo
  -- na fábrica, leva a decisão ('fabrica'): "manter" não fecha o pedido
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
    values (v_card.id, 'pedido_entregue', v_usuario, 'interface',
            concat_ws(' — ', 'Entrega parcial: ' || array_length(v_entregue, 1) || ' de ' || array_length(v_vivas, 1) || ' peça(s)',
                      case when v_tem and v_fabrica = 'manter' then 'o que está na fábrica segue em produção'
                           when v_tem then 'o que estava na fábrica saiu da produção' end,
                      v_motivo, v_obs),
            jsonb_build_object('fonte', 'plataforma', 'numero', v_numero, 'parcial', true,
                               'entregues', to_jsonb(v_entregue), 'voltaram', to_jsonb(coalesce(v_voltou, '{}'::bigint[])),
                               'na_fabrica', to_jsonb(coalesce(v_ficam, '{}'::bigint[])), 'vagas_pcp', v_vagas,
                               'unidades', array_length(v_vivas, 1), 'total_pedido', v_total,
                               'prontas', coalesce(array_length(v_prontas, 1), 0),
                               'motivo_id', p_motivo_id, 'motivo', v_motivo, 'observacao', v_obs,
                               'lancado_rotas', v_card.lancado_rotas_em is not null)
              || case when v_tem then jsonb_build_object('fabrica', v_fabrica) else '{}'::jsonb end
              || case when v_tem and v_fabrica = 'manter' and v_prog.card_id is not null
                      then jsonb_build_object('programacao', jsonb_build_object(
                             'data_entrega', v_prog.data_entrega, 'caminhao_id', v_prog.caminhao_id,
                             'rota', v_prog.rota))
                      else '{}'::jsonb end)
    returning id into v_entrega;

  -- (2) as peças entregues saem de toda conta — o tempo aberto fecha antes
  for r in select c.id from public.plt_cards c where c.id = any (v_entregue) order by c.id for update
  loop
    if plt_privado.fn_fechar_tempo_aberto(r.id, 'O pedido foi entregue: o tempo aberto fecha antes de a peça sair.') then
      v_tempos := v_tempos + 1;
    end if;
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
      values (r.id, 'card_arquivado', v_usuario, 'interface',
              'Pedido ' || coalesce(v_numero::text, '') || ' entregue em parte — a peça foi entregue.',
              jsonb_build_object('motivo', 'entregue', 'entrega_evento_id', v_entrega,
                                 'parcial', true, 'fonte', 'plataforma', 'numero', v_numero));
  end loop;

  -- (3) as prontas que voltaram: "Em decisão pós devolução" — a logística decide (D-129)
  if v_voltou is not null then
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
      values (v_card.id, 'pedido_devolvido', v_usuario, 'interface',
              'Voltou da entrega parcial' || coalesce(' — ' || v_motivo, '') || coalesce(' — ' || v_obs, ''),
              jsonb_build_object('fonte', 'plataforma', 'numero', v_numero, 'motivo_id', p_motivo_id,
                                 'motivo', coalesce(v_motivo, 'Entrega parcial'), 'observacao', v_obs,
                                 'entregue', true, 'entrega_evento_id', v_entrega, 'entrega_parcial', true,
                                 'pecas', to_jsonb(v_voltou)))
      returning id into v_evento;
    for r in
      select c.id, c.setor_atual_id, c.etapa_atual_id from public.plt_cards c
       where c.id = any (v_voltou) order by c.id for update
    loop
      perform plt_privado.fn_fechar_tempo_aberto(r.id, 'A peça voltou da entrega: o tempo aberto fecha antes.');
      insert into public.plt_eventos
          (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id, setor_destino_id, observacao, dados)
        values (r.id, 'movimentacao_setor', v_usuario, 'interface', r.setor_atual_id, r.etapa_atual_id, v_dev,
                'Voltou da entrega parcial — a peça espera a decisão da logística.',
                jsonb_build_object('motivo', 'devolucao', 'devolucao_evento_id', v_evento, 'entrega_parcial', true));
    end loop;
  end if;

  -- (4) "Limpar da produção": cada peça na fábrica sai da produção com registro (a
  -- volta guarda setor e etapa); as vagas saem do PCP pela projeção (D-327)
  if v_tem and v_fabrica = 'limpar' then
    perform set_config('plt.cancelados_maquinaria', 'on', true);
    for r in select c.id from public.plt_cards c where c.id = any (coalesce(v_ficam, '{}'::bigint[])) order by c.id
    loop
      perform plt_privado.fn_parcial_retirar_peca(r.id, v_usuario, v_entrega, v_numero, v_card.id, v_entrega, 'entrega_parcial');
      v_retiradas := v_retiradas + 1;
    end loop;
    perform set_config('plt.cancelados_maquinaria', coalesce(v_marca_c, ''), true);
  end if;

  -- (5) "Deixar em produção": o pedido sai da rota do dia e volta para "Programar"
  -- (como no "Não entregue") — o resto será programado quando ficar pronto
  if v_tem and v_fabrica = 'manter' and v_prog.card_id is not null then
    delete from public.plt_programacoes where card_id = v_card.id;
    v_saiu_rota := true;
  end if;

  perform set_config('plt.entrega_maquinaria', coalesce(v_marca_e, ''), true);
  perform set_config('plt.devolucao_maquinaria', coalesce(v_marca_d, ''), true);
  perform set_config('plt.parcial_maquinaria', coalesce(v_marca_p, ''), true);

  select u.nome into v_nome from public.plt_usuarios u where u.id = v_usuario;
  if v_voltou is not null then
    v_avisados := plt_privado.fn_avisar_logistica(
      v_evento, v_card.id, 'devolucao_decidir',
      'Pedido ' || coalesce(v_numero::text, '') || ' entregue em parte — decidir a situação',
      v_nome || ' entregou o pedido ' || coalesce(v_numero::text, '') || ' em parte (' || array_length(v_entregue, 1) || ' de '
        || array_length(v_vivas, 1) || ')' || coalesce(' — ' || v_motivo, '') || '. '
        || array_length(v_voltou, 1) || ' peça(s) voltaram e esperam a decisão em Estoque → Em decisão pós devolução.',
      v_usuario);
  end if;
  if v_tem and v_fabrica = 'limpar' then
    perform plt_privado.fn_avisar_publico(
      'entrega_parcial_retirada', 'pcp', v_entrega, v_card.id,
      'Pedido ' || coalesce(v_numero::text, '') || ' entregue em parte',
      'Pedido ' || coalesce(v_numero::text, '') || ' entregue em parte — '
        || case when v_retiradas = 1 then '1 peça retirada da produção' else v_retiradas || ' peças retiradas da produção' end
        || case when v_vagas = 0 then '' when v_vagas = 1 then ' e 1 produto tirado do PCP' else ' e ' || v_vagas || ' produtos tirados do PCP' end
        || ' por ' || coalesce(v_nome, 'alguém') || '. Dá para voltar atrás em PCP → Entregas parciais.');
  end if;
  if v_tem then
    perform plt_privado.fn_avisar('pcp');
  end if;

  return jsonb_build_object('entrega_evento_id', v_entrega, 'devolucao_evento_id', v_evento,
                            'entregues', array_length(v_entregue, 1),
                            'voltaram', coalesce(array_length(v_voltou, 1), 0),
                            'na_fabrica', coalesce(array_length(v_ficam, 1), 0), 'vagas', v_vagas,
                            'fabrica', case when v_tem then v_fabrica end, 'retiradas', v_retiradas,
                            'saiu_da_rota', v_saiu_rota,
                            'tempos_fechados', v_tempos, 'avisados', v_avisados);
end;
$$;
revoke all on function public.plt_fn_entrega_parcial(bigint, bigint[], bigint, text, boolean, text) from public, anon;
grant execute on function public.plt_fn_entrega_parcial(bigint, bigint[], bigint, text, boolean, text) to authenticated;
comment on function public.plt_fn_entrega_parcial(bigint, bigint[], bigint, text, boolean, text) is
  'SESSAO-41 (D-195) ↪️ SESSAO-51 (D-325): a entrega parcial. As prontas desmarcadas voltam para a decisão da logística; o que ainda está na fábrica (peças em produção e vagas no PCP) segue a decisão: ''manter'' (padrão — o pedido continua vivo e sai da rota do dia) ou ''limpar'' (logística, PCP e admin — as peças saem da produção com registro e o pedido sai do PCP). O Tiny não muda.';

-- ----------------------------------------------------------------------------
-- 6 · Frente 3 · "Entregas parciais": a lista (cursor, busca por número ou
--     cliente, do mais recente para trás, só o que ainda dá para revogar), a
--     janela (lida ao abrir) e o revogar (idempotente pela chave do toque)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_entregas_parciais(
  p_busca     text        default null,
  p_limite    integer     default 20,
  p_depois_em timestamptz default null,
  p_depois_id bigint      default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_lim   integer     := least(greatest(coalesce(p_limite, 20), 1), 100);
  v_ate   timestamptz := coalesce(p_depois_em, 'infinity'::timestamptz);
  v_id    bigint      := coalesce(p_depois_id, 9223372036854775807);
  v_ativo boolean;
  v_num   text;
  v_nome  text;
  v_itens jsonb := '[]'::jsonb;
  v_n     integer := 0;
  v_mais  boolean := false;
  v_e     jsonb;
  r       record;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'As entregas parciais são da logística, do PCP e do admin.' using errcode = 'insufficient_privilege';
  end if;
  select f.ativo, f.numero, f.nome into v_ativo, v_num, v_nome from plt_privado.fn_filtro_do_quadro(p_busca) f;
  v_ativo := coalesce(v_ativo, false);

  -- pelo índice da lista (a decisão mais recente primeiro); as regras baratas do
  -- próprio card cortam antes, e o estado (peças e vagas) só é lido para quem passa
  for r in
    select pc.id, pc.pedido_id, pc.parcial_decisao_em as em
      from public.plt_cards pc
     where pc.parcial_decisao is not null
       and (pc.parcial_decisao_em, pc.id) < (v_ate, v_id)
       and pc.tipo = 'pedido' and pc.arquivado_em is null and pc.cancelado_plataforma_em is null
       and (pc.entrega_evento_id is null or pc.entrega_evento_id = pc.parcial_evento_id)
       and pc.removido_pcp_motivo is distinct from 'oculto'
     order by pc.parcial_decisao_em desc, pc.id desc
  loop
    continue when v_ativo and not plt_privado.fn_pedido_bate_filtro(r.pedido_id, v_num, v_nome);
    v_e := plt_privado.fn_parcial_estado(r.id);
    continue when v_e is null or not coalesce((v_e ->> 'pode_revogar')::boolean, false);
    if v_n >= v_lim then
      v_mais := true;
      exit;
    end if;
    v_itens := v_itens || jsonb_build_array(v_e - 'na_producao' - 'prontas' - 'retiradas'
                                            || jsonb_build_object('cursor_em', r.em));
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('itens', v_itens, 'tem_mais', v_mais);
end;
$$;
revoke all on function public.plt_fn_entregas_parciais(text, integer, timestamptz, bigint) from public, anon;
grant execute on function public.plt_fn_entregas_parciais(text, integer, timestamptz, bigint) to authenticated;

create or replace function public.plt_fn_entrega_parcial_previa(p_card_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_e jsonb;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Revogar a decisão da entrega parcial é da logística, do PCP e do admin.'
      using errcode = 'insufficient_privilege';
  end if;
  v_e := plt_privado.fn_parcial_estado(p_card_id);
  if v_e is null then
    raise exception 'Este pedido não tem entrega parcial.' using errcode = 'no_data_found';
  end if;
  return v_e;
end;
$$;
revoke all on function public.plt_fn_entrega_parcial_previa(bigint) from public, anon;
grant execute on function public.plt_fn_entrega_parcial_previa(bigint) to authenticated;

create or replace function public.plt_fn_entrega_parcial_revogar(p_card_id bigint, p_chave text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
  v_card    public.plt_cards%rowtype;
  v_prog    public.plt_programacoes%rowtype;
  v_e       jsonb;
  v_antes   text;
  v_depois  text;
  v_ev      bigint;
  v_fecha   boolean := false;
  v_reabre  boolean := false;
  v_n       integer := 0;
  v_vagas   integer := 0;
  v_voltaram integer := 0;
  v_viraram integer := 0;
  v_ficam   jsonb;
  v_nome    text;
  v_m_e     text;
  v_m_p     text;
  v_m_c     text;
  v_res     text;
  r         record;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Revogar a decisão da entrega parcial é da logística, do PCP e do admin.'
      using errcode = 'insufficient_privilege';
  end if;
  select * into v_card from public.plt_cards where id = p_card_id and tipo = 'pedido' for update;
  if not found then
    raise exception 'Card de pedido % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  -- um toque, um efeito (Lei §10): a mesma chave devolve o que já foi feito
  if nullif(btrim(coalesce(p_chave, '')), '') is not null then
    select e.id into v_ev from public.plt_eventos e
     where e.card_id = v_card.id and e.tipo = 'entrega_parcial_decisao_revogada' and e.dados ->> 'chave' = p_chave
     limit 1;
    if v_ev is not null then
      return jsonb_build_object('feito', false, 'repetido', true, 'evento_id', v_ev, 'decisao', v_card.parcial_decisao);
    end if;
  end if;
  v_e := plt_privado.fn_parcial_estado(v_card.id);
  if v_e is null then
    raise exception 'Este pedido não tem entrega parcial.' using errcode = 'no_data_found';
  end if;
  if not coalesce((v_e ->> 'pode_revogar')::boolean, false) then
    raise exception 'Não dá para revogar: %', v_e ->> 'porque_nao' using errcode = 'check_violation';
  end if;
  v_antes := v_card.parcial_decisao;
  v_depois := case v_antes when 'manter' then 'limpar' else 'manter' end;
  v_vagas := coalesce((v_e ->> 'vagas')::int, 0);
  select u.nome into v_nome from public.plt_usuarios u where u.id = v_usuario;
  select * into v_prog from public.plt_programacoes where card_id = v_card.id;

  v_m_e := current_setting('plt.entrega_maquinaria', true);
  v_m_p := current_setting('plt.parcial_maquinaria', true);
  v_m_c := current_setting('plt.cancelados_maquinaria', true);
  perform set_config('plt.parcial_maquinaria', 'on', true);
  perform set_config('plt.entrega_maquinaria', 'on', true);
  perform set_config('plt.cancelados_maquinaria', 'on', true);

  if v_depois = 'limpar' then
    -- "Revogar e remover da linha de produção": o Limpar de agora — as peças na
    -- fábrica saem; as prontas e as da rota ficam (D-327); o que ficou no PCP sai
    v_ficam := v_e -> 'prontas';
    -- nada mais vivo depois de tirar as da fábrica: o pedido fecha pela própria
    -- entrega parcial (e a programação dele, se houver, sai junto)
    v_fecha := coalesce((v_e ->> 'n_prontas')::int, 0) = 0;
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
      values (v_card.id, 'entrega_parcial_decisao_revogada', v_usuario, 'interface',
              format('Revogou "deixar em produção": %s saíram da produção%s.',
                     case when (v_e ->> 'n_producao')::int = 1 then '1 peça' else (v_e ->> 'n_producao') || ' peças' end,
                     case when v_vagas = 0 then '' when v_vagas = 1 then ' e 1 produto saiu do PCP'
                          else ' e ' || v_vagas || ' produtos saíram do PCP' end),
              jsonb_build_object('antes', v_antes, 'depois', v_depois, 'chave', nullif(btrim(coalesce(p_chave, '')), ''),
                                 'entrega_evento_id', v_card.parcial_evento_id, 'fecha', v_fecha,
                                 'pecas', (select coalesce(jsonb_agg(x -> 'id'), '[]'::jsonb) from jsonb_array_elements(v_e -> 'na_producao') x),
                                 'ficam', v_ficam, 'vagas', v_vagas,
                                 'programacao_anterior', case when v_fecha and v_prog.card_id is not null
                                   then jsonb_build_object('data_entrega', v_prog.data_entrega,
                                                           'caminhao_id', v_prog.caminhao_id, 'rota', v_prog.rota) end))
      returning id into v_ev;
    for r in select (x ->> 'id')::bigint as id from jsonb_array_elements(v_e -> 'na_producao') x
    loop
      perform plt_privado.fn_parcial_retirar_peca(r.id, v_usuario, v_ev, (v_e ->> 'numero')::int, v_card.id,
                                                  v_card.parcial_evento_id, 'revogar');
      v_n := v_n + 1;
    end loop;
    if v_fecha and v_prog.card_id is not null then
      delete from public.plt_programacoes where card_id = v_card.id;
    end if;
  else
    -- "Revogar e voltar tudo para a produção": cada peça volta a ser a mesma peça,
    -- no mesmo setor e na mesma etapa (ou na primeira ativa); as vagas reabrem no PCP
    v_reabre := v_card.entrega_evento_id is not null and v_card.entrega_evento_id = v_card.parcial_evento_id;
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
      values (v_card.id, 'entrega_parcial_decisao_revogada', v_usuario, 'interface',
              format('Revogou "limpar da produção": %s de volta para a produção%s.',
                     case when (v_e ->> 'n_retiradas')::int = 1 then '1 peça' else (v_e ->> 'n_retiradas') || ' peças' end,
                     case when v_vagas = 0 then '' when v_vagas = 1 then ' e 1 produto de volta ao PCP'
                          else ' e ' || v_vagas || ' produtos de volta ao PCP' end),
              jsonb_build_object('antes', v_antes, 'depois', v_depois, 'chave', nullif(btrim(coalesce(p_chave, '')), ''),
                                 'entrega_evento_id', v_card.parcial_evento_id, 'reabre', v_reabre,
                                 'pecas', v_e -> 'retiradas', 'vagas', v_vagas,
                                 'programacao_anterior', case when v_reabre and v_prog.card_id is not null
                                   then jsonb_build_object('data_entrega', v_prog.data_entrega,
                                                           'caminhao_id', v_prog.caminhao_id, 'rota', v_prog.rota) end))
      returning id into v_ev;
    for r in select (x ->> 'id')::bigint as id, x as destino from jsonb_array_elements(v_e -> 'retiradas') x
    loop
      v_res := plt_privado.fn_parcial_voltar_peca(r.id, v_usuario, v_ev, (v_e ->> 'numero')::int, v_card.id, r.destino);
      if v_res = 'voltou' then
        v_voltaram := v_voltaram + 1;
      elsif v_res = 'vaga' then
        v_viraram := v_viraram + 1;
      end if;
    end loop;
    -- o pedido que a entrega parcial tinha fechado volta a ser programável: a parada
    -- antiga (o dia da entrega parcial) sai da programação, guardada no fato
    if v_reabre and v_prog.card_id is not null then
      delete from public.plt_programacoes where card_id = v_card.id;
    end if;
  end if;

  perform set_config('plt.parcial_maquinaria', coalesce(v_m_p, ''), true);
  perform set_config('plt.entrega_maquinaria', coalesce(v_m_e, ''), true);
  perform set_config('plt.cancelados_maquinaria', coalesce(v_m_c, ''), true);

  perform plt_privado.fn_avisar_publico(
    'entrega_parcial_revogada', 'pcp', v_ev, v_card.id,
    'Pedido ' || (v_e ->> 'numero') || ': decisão da entrega parcial revogada',
    coalesce(v_nome, 'Alguém') || ' revogou a decisão da entrega parcial do pedido ' || (v_e ->> 'numero') || ' — '
      || case when v_depois = 'limpar'
              then case when v_n = 1 then '1 peça saiu da produção' else v_n || ' peças saíram da produção' end
                   || case when v_vagas = 0 then '' when v_vagas = 1 then ' e 1 produto saiu do PCP'
                           else ' e ' || v_vagas || ' produtos saíram do PCP' end
              else case when v_voltaram = 1 then '1 peça voltou para a produção' else v_voltaram || ' peças voltaram para a produção' end
                   || case when v_vagas + v_viraram = 0 then ''
                           when v_vagas + v_viraram = 1 then ' e 1 produto voltou ao PCP'
                           else ' e ' || (v_vagas + v_viraram) || ' produtos voltaram ao PCP' end end || '.');
  perform plt_privado.fn_avisar('pcp');

  return jsonb_build_object('feito', true, 'evento_id', v_ev, 'antes', v_antes, 'decisao', v_depois,
                            'retiradas', v_n, 'voltaram', v_voltaram, 'viraram_vaga', v_viraram,
                            'vagas', v_vagas, 'fechou', v_fecha, 'reabriu', v_reabre,
                            'ficaram', coalesce(jsonb_array_length(v_ficam), 0));
end;
$$;
revoke all on function public.plt_fn_entrega_parcial_revogar(bigint, text) from public, anon;
grant execute on function public.plt_fn_entrega_parcial_revogar(bigint, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 7 · Onde o pedido mostra "Entregue em parte (N de M)": a ficha (com a decisão
--     e o botão), o quadro do PCP e a lista de Pedidos (D-328)
-- ----------------------------------------------------------------------------
-- (recriada da vigente — 20261112060000_plt_editar_endereco.sql)
CREATE OR REPLACE FUNCTION public.plt_fn_pcp_pedido_detalhe(p_pedido_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_p    public.pedidos%rowtype;
  v_c    public.clientes%rowtype;
  v_card public.plt_cards%rowtype;
  v_ent  public.plt_eventos%rowtype;
  v_prog public.plt_programacoes%rowtype;
  v_sit  text;
  v_tot  integer;
  v_lib  integer;
  v_pro  integer;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'O detalhe do pedido é da logística (PCP/terminais) ou de admin.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_p from public.pedidos where id = p_pedido_id;
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'no_data_found';
  end if;
  select * into v_c from public.clientes where id = v_p.cliente_id;
  select * into v_card from public.plt_cards where pedido_id = v_p.id and tipo = 'pedido';
  if v_card.entrega_evento_id is not null then
    select * into v_ent from public.plt_eventos where id = v_card.entrega_evento_id;
  end if;
  if v_card.id is not null then
    select * into v_prog from public.plt_programacoes where card_id = v_card.id;
  end if;

  -- A situação na plataforma — a mesma regra de "Todos os pedidos".
  select coalesce(sum(v.unidades), 0)::int into v_tot
    from plt_privado.vw_itens_producao v where v.pedido_id = v_p.id;
  select count(*)::int, count(*) filter (where s.papel_no_fluxo = 'terminal' or u.concluido_em is not null)::int
    into v_lib, v_pro
    from public.plt_cards u
    left join public.plt_setores s on s.id = u.setor_atual_id
   where u.pedido_id = v_p.id and u.tipo = 'unidade' and u.arquivado_em is null;
  v_sit := case
             when v_card.id is null then 'sem_card'
             when v_card.devolucao_evento_id is not null then 'devolvido'  -- SESSAO-31 (D-129)
             when v_card.entrega_evento_id is not null then 'entregue'
             when v_card.arquivado_em is not null then 'arquivado'
             when v_card.lancado_rotas_em is not null then 'em_rota'
             when v_tot > 0 and v_pro >= v_tot then 'aguardo'
             when v_lib > 0 then 'producao'
             else 'pcp'
           end;

  return jsonb_build_object(
    -- SESSAO-31 (D-129): a devolução em decisão (o resto vem da porta da decisão).
    'devolucao', case when v_card.devolucao_evento_id is not null then (
      select jsonb_build_object('evento_id', d.id, 'quando', d.ocorrido_em,
               'quem', (select u.nome from public.plt_usuarios u where u.id = d.usuario_id),
               'motivo', d.dados ->> 'motivo', 'observacao', d.dados ->> 'observacao',
               'entregue', coalesce((d.dados ->> 'entregue')::boolean, false))
        from public.plt_eventos d where d.id = v_card.devolucao_evento_id) end,
    'pedido', jsonb_build_object(
      'id', v_p.id, 'numero', v_p.numero, 'situacao', v_p.situacao, 'origem', v_p.origem,
      'data_pedido', v_p.data_pedido, 'data_prevista', plt_privado.fn_data_entrega(v_p.id, v_p.data_prevista),
      -- SESSAO-41 (D-194): a data do Tiny e se a da plataforma está valendo
      'data_prevista_tiny', v_p.data_prevista,
      'data_alterada', plt_privado.fn_data_entrega(v_p.id, v_p.data_prevista) is distinct from v_p.data_prevista,
      'data_faturamento', nullif(v_p.raw ->> 'data_faturamento', ''),
      'data_envio', nullif(v_p.raw ->> 'data_envio', ''),
      'data_entrega_tiny', nullif(v_p.raw ->> 'data_entrega', ''),
      'total_produtos', v_p.total_produtos, 'valor_frete', v_p.valor_frete,
      'valor_desconto', nullif(v_p.raw ->> 'valor_desconto', ''),
      'outras_despesas', nullif(v_p.raw ->> 'outras_despesas', ''),
      'total_pedido', v_p.total_pedido,
      'forma_pagamento', v_p.forma_pagamento, 'meio_pagamento', v_p.meio_pagamento,
      'condicao_pagamento', nullif(v_p.raw ->> 'condicao_pagamento', ''),
      'qtd_parcelas', v_p.qtd_parcelas,
      'parcelas', coalesce((select jsonb_agg(jsonb_build_object(
                     'data', nullif(x -> 'parcela' ->> 'data', ''), 'dias', nullif(x -> 'parcela' ->> 'dias', ''),
                     'valor', nullif(x -> 'parcela' ->> 'valor', ''),
                     'forma', nullif(x -> 'parcela' ->> 'forma_pagamento', ''),
                     'meio', nullif(x -> 'parcela' ->> 'meio_pagamento', ''),
                     'obs', nullif(x -> 'parcela' ->> 'obs', '')) order by o)
                   from jsonb_array_elements(case when jsonb_typeof(v_p.parcelas) = 'array' then v_p.parcelas else '[]'::jsonb end)
                        with ordinality as t(x, o)), '[]'::jsonb),
      'obs', v_p.obs, 'obs_interna', v_p.obs_interna, 'marcadores', to_jsonb(coalesce(v_p.marcadores, '{}'::text[])),
      'vendedor', v_p.vendedor, 'ecommerce', v_p.ecommerce, 'numero_ecommerce', nullif(v_p.raw ->> 'numero_ecommerce', ''),
      'forma_envio', v_p.forma_envio, 'forma_frete', nullif(v_p.raw ->> 'forma_frete', ''),
      'transportador', nullif(v_p.raw ->> 'nome_transportador', ''),
      'codigo_rastreamento', v_p.codigo_rastreamento, 'url_rastreamento', v_p.url_rastreamento,
      'atualizado_em', v_p.atualizado_em),
    'cliente', jsonb_build_object(
      'nome', v_c.nome, 'fone', v_c.fone, 'email', v_c.email, 'documento', v_c.cpf_cnpj,
      'endereco', v_c.endereco, 'numero', v_c.numero, 'complemento', v_c.complemento,
      'bairro', v_c.bairro, 'cidade', v_c.cidade, 'uf', v_c.uf, 'cep', v_c.cep),
    -- SESSAO-41 (D-193): ONDE ENTREGAR (o endereço de entrega do Tiny, quando há)
    'endereco_entrega', (select to_jsonb(ee) - 'pedido_id' from plt_privado.vw_endereco_entrega ee
                          where ee.pedido_id = v_p.id),
    'plataforma', jsonb_build_object(
      'card_id', v_card.id, 'situacao', v_sit, 'total_unidades', v_tot,
      'lancado_rotas_em', v_card.lancado_rotas_em, 'arquivado_em', v_card.arquivado_em,
      'liberado_completo_em', v_card.liberado_completo_em,
      -- SESSAO-47: quando o pedido chegou à plataforma (o limite do dia da entrega)
      'chegou_em', v_card.criado_em),
    'programacao', case when v_prog.id is null then null else jsonb_build_object(
      'data', v_prog.data_entrega, 'rota', v_prog.rota, 'ordem', v_prog.ordem, 'detalhe', v_prog.detalhe,
      'caminhao', (select cam.nome || coalesce(' · ' || cam.placa, '') from public.plt_caminhoes cam where cam.id = v_prog.caminhao_id),
      'equipe', coalesce((select jsonb_agg(u.nome order by u.nome)
                            from public.plt_programacao_equipes eq join public.plt_usuarios u on u.id = eq.usuario_id
                           where eq.data_entrega = v_prog.data_entrega and eq.caminhao_id = v_prog.caminhao_id
                             and eq.rota = v_prog.rota), '[]'::jsonb)) end,
    'entrega', case when v_ent.id is null then null else jsonb_build_object(
      -- SESSAO-47: "em" = o dia REAL da entrega (a projeção do card — com a
      -- correção do administrador, se houve); "registrada_em" = quando ela foi
      -- registrada (o desfazer do dia conta por aqui)
      'em', v_card.entrega_em, 'por', (select u.nome from public.plt_usuarios u where u.id = v_ent.usuario_id),
      'registrada_em', v_ent.registrado_em,
      'correcao', (select jsonb_build_object(
                            'em', k.ocorrido_em,
                            'por', (select u.nome from public.plt_usuarios u where u.id = k.usuario_id),
                            'antes', k.dados ->> 'antes', 'depois', k.dados ->> 'depois',
                            'motivo', k.dados ->> 'motivo')
                     from public.plt_eventos k
                    where k.evento_referencia_id = v_ent.id and k.tipo = 'entrega_dia_corrigido'
                    order by k.id desc
                    limit 1),
      'por_gente', v_ent.usuario_id is not null, 'observacao', v_ent.observacao,
      'fonte', coalesce(v_ent.dados ->> 'fonte', case when v_ent.usuario_id is null then 'tiny' else 'plataforma' end),
      -- SESSAO-41 (D-195): a entrega parcial
      'parcial', coalesce((v_ent.dados ->> 'parcial')::boolean, false),
      'pecas_entregues', jsonb_array_length(coalesce(v_ent.dados -> 'entregues', '[]'::jsonb)),
      'pecas_voltaram', jsonb_array_length(coalesce(v_ent.dados -> 'voltaram', '[]'::jsonb))) end,
    'itens', coalesce((select jsonb_agg(jsonb_build_object(
                'seq', i.seq, 'codigo', i.codigo, 'descricao', i.descricao, 'unidade', i.unidade,
                'quantidade', i.quantidade, 'valor_unitario', i.valor_unitario,
                'valor_total', round(coalesce(i.quantidade, 0) * coalesce(i.valor_unitario, 0), 2),
                'unidades_producao', coalesce(v.unidades, 0), 'eh_frete', coalesce(v.eh_frete, false)) order by i.seq)
              from public.pedido_itens i
              left join plt_privado.vw_itens_producao v on v.pedido_id = i.pedido_id and v.seq = i.seq
             where i.pedido_id = v_p.id), '[]'::jsonb),
    'unidades', coalesce((select jsonb_agg(jsonb_build_object(
                'card_id', u.id, 'descricao', u.item_descricao, 'indice', u.indice_unidade, 'total', u.total_unidades,
                'setor', s.nome, 'etapa', e.nome, 'desde', u.desde, 'concluido_em', u.concluido_em,
                'qualidade', u.qualidade_atual, 'arquivado_em', u.arquivado_em,
                'motivo_saida', (select a.dados ->> 'motivo' from public.plt_eventos a
                                  where a.card_id = u.id and a.tipo = 'card_arquivado' order by a.id desc limit 1))
                order by u.item_seq, u.indice_unidade)
              from public.plt_cards u
              left join public.plt_setores s on s.id = u.setor_atual_id
              left join public.plt_etapas e on e.id = u.etapa_atual_id
             where u.tipo = 'unidade' and u.pedido_id = v_p.id), '[]'::jsonb),
    'contas_receber', coalesce((select jsonb_agg(jsonb_build_object(
                'vencimento', cr.data_vencimento, 'valor', cr.valor, 'saldo', cr.saldo, 'situacao', cr.situacao,
                'liquidacao', cr.data_liquidacao, 'forma', cr.forma_recebimento, 'meio', cr.meio_recebimento,
                'historico', cr.historico) order by cr.data_vencimento)
              from public.contas_receber cr where cr.pedido_id = v_p.id), '[]'::jsonb),
    -- ↪️ D-122: "conferidas em" = a última busca das contas no Tiny (a conferência
    -- diária; antes dela, a carga do histórico) — pelo índice da fila (recurso,
    -- chave): a 1ª página da busca, uma linha; só sem ela (antes da 1ª rodada ou
    -- no meio de uma) as poucas linhas da busca — nunca a tabela de contas (Lei §6)
    'contas_receber_ate', coalesce(
       (select f.processado_em from public.tiny_fila f
         where f.recurso = 'cr_pesquisa' and f.chave = 'pente-fino-cr:p1' and f.status = 'ok'),
       (select max(f.processado_em) from public.tiny_fila f
         where f.recurso = 'cr_pesquisa' and f.status = 'ok')),
    'notas_fiscais', coalesce((select jsonb_agg(jsonb_build_object(
                'numero', nf.numero, 'serie', nf.serie, 'emissao', nf.data_emissao,
                'situacao', coalesce(nf.descricao_situacao, nf.situacao), 'valor', nf.valor_nota) order by nf.data_emissao)
              from public.notas_fiscais nf where nf.pedido_id = v_p.id), '[]'::jsonb),
    'anexos', case when v_card.id is null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object(
                'id', a.id, 'tipo', a.tipo, 'nome', a.nome_arquivo, 'mime', a.mime, 'tamanho', a.tamanho,
                'caminho', a.caminho, 'por', u.nome, 'em', a.enviado_em) order by a.enviado_em desc)
              from public.plt_anexos a left join public.plt_usuarios u on u.id = a.enviado_por
             where a.card_id = v_card.id and a.removido_em is null), '[]'::jsonb) end,
    'historico', case when v_card.id is null then '[]'::jsonb else coalesce((select jsonb_agg(h order by (h ->> 'id')::bigint desc) from (
                select jsonb_build_object(
                  'id', ev.id, 'tipo', ev.tipo, 'em', ev.ocorrido_em, 'por', u.nome, 'origem', ev.origem,
                  -- SESSAO-47: quando o fato foi gravado (a entrega marcada num dia passado)
                  'registrado_em', ev.registrado_em,
                  'observacao', ev.observacao, 'motivo', ev.dados ->> 'motivo',
                  'setor', (select s.nome from public.plt_setores s where s.id = ev.setor_destino_id)) as h
                  from public.plt_eventos ev
                  left join public.plt_usuarios u on u.id = ev.usuario_id
                 where ev.card_id = v_card.id
                 order by ev.id desc
                 limit 80) z), '[]'::jsonb) end
  )
  -- SESSAO-50 (bloco C): o endereço alterado na plataforma — o selo da ficha, com o
  -- original do Tiny ao lado (a chave só nasce quando há — E-237)
  || coalesce((select jsonb_build_object('endereco_plataforma', jsonb_build_object(
                        'em', pe.definido_em,
                        'por', (select u.nome from public.plt_usuarios u where u.id = pe.definido_por),
                        'escolha', pe.escolha, 'tiny_confirmado_em', pe.tiny_confirmado_em,
                        'original', pe.tiny_original))
                 from public.plt_pedido_enderecos pe where pe.pedido_id = v_p.id), '{}'::jsonb)
  -- SESSAO-51 (bloco A): a entrega PARCIAL — quantas saíram, o que ainda está na
  -- fábrica, a decisão que vale agora e o botão contrário (a chave só nasce quando há)
  || case when v_card.parcial_evento_id is null then '{}'::jsonb
          else jsonb_build_object('entrega_parcial', plt_privado.fn_parcial_estado(v_card.id)) end;
end;
$function$;

-- (recriada da vigente — 20261112020000_plt_pcp_cancelar_ocultar_excluido.sql)
CREATE OR REPLACE FUNCTION public.plt_fn_pcp_quadro(p_limite integer DEFAULT 10, p_deslocamento integer DEFAULT 0, p_grupo text DEFAULT NULL::text, p_ordem text DEFAULT NULL::text, p_filtro text DEFAULT NULL::text)
 RETURNS TABLE(id bigint, tipo text, pedido_id bigint, card_pai_id bigint, item_seq integer, item_codigo text, item_descricao text, indice_unidade integer, total_unidades integer, setor_atual_id bigint, etapa_atual_id bigint, desde timestamp with time zone, executor_atual_id uuid, responsavel_id uuid, delegado_em timestamp with time zone, qualidade_atual text, concluido_em timestamp with time zone, pausado_em timestamp with time zone, liberado_completo_em timestamp with time zone, pecas_estoque integer, contagem_total bigint, etiquetas bigint[], pedido_resumo jsonb, prioridade text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with m as (select plt_privado.fn_ordem_do_quadro(p_ordem) as modo),
  f as (select * from plt_privado.fn_filtro_do_quadro(p_filtro)),
  base as (
    select c.id, c.desde, c.prioridade, p.numero, plt_privado.fn_data_entrega(p.id, p.data_prevista) as data_prevista,
           lower(translate(btrim(coalesce(case when c.tipo = 'pedido' then cl.nome else c.item_descricao end, '')),
                           'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
                           'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')) as nome
      from public.plt_cards c
      join public.plt_setores s on s.id = c.setor_atual_id and s.papel_no_fluxo = 'entrada'
      left join public.pedidos p on p.id = c.pedido_id
      left join public.clientes cl on cl.id = p.cliente_id
     -- o MESMO filtro de plt_fn_cards_pedido_pcp (D-75: painel = quadro)
     where (select plt_privado.fn_usuario_atual()) is not null
       and ((select plt_privado.fn_eh_admin())
            or c.setor_atual_id in (select plt_privado.fn_setores_do_usuario()))
       and c.tipo in ('pedido', 'reposicao')
       -- SESSAO-38 (D-169): o MESMO filtro de plt_fn_cards_pedido_pcp (o grupo 'standby')
       and (case when p_grupo = 'standby' then c.tipo = 'pedido' and c.standby_desde is not null
                 else (p_grupo is null or c.tipo = p_grupo) and c.standby_desde is null end)
       and c.arquivado_em is null
       and c.liberado_completo_em is null
       and (c.tipo = 'reposicao'
            or (p.id is not null
                -- SESSAO-47: D-132 + a marca de devolvido ao PCP (a regra única)
                and not plt_privado.fn_fora_do_pcp(p.situacao, c.volta_pcp_em, c.removido_pcp_em, c.pedido_id in (select xexc.pedido_id from public.plt_pedidos_excluidos_tiny xexc), c.cancelado_plataforma_em)
                and exists (select 1 from plt_privado.vw_itens_producao v
                             where v.pedido_id = p.id and v.unidades > 0)))
  ),
  chaves as (
    select b.id,
           case (select modo from m)
             when 'prioridade' then case b.prioridade when 'urgente' then 0 when 'atencao' then 1 else 2 end
             else case when b.prioridade = 'urgente' then 0 else 1 end
           end as k1,
           (case (select modo from m)
              when 'entrega' then to_char(coalesce(b.data_prevista, date '9999-12-31'), 'YYYYMMDD')
              when 'alfabetica' then (case when b.nome ~ '^[a-z]' then '0' when b.nome ~ '^[0-9]' then '1' else '2' end) || b.nome
              else '' end) collate "C" as k2,
           case (select modo from m) when 'entrega' then coalesce(b.numero, 2147483647) else 0 end as k3,
           coalesce(b.desde, 'infinity'::timestamptz) as k4,
           count(*) over () as total
      from base b
     -- SESSAO-40 (D-187): o filtro do PCP — o nº do pedido que começa com o
     -- texto, ou o nome que o contém (o cliente no card do pedido; o móvel na
     -- reposição — o mesmo nome da ordem alfabética). O total conta só os que batem.
     where (not (select ativo from f)
            or case when (select numero from f) is not null
                    then b.numero::text like (select numero from f) || '%'
                    else translate(b.nome, ' ' || chr(9) || chr(10) || chr(13), '')
                           like '%' || (select nome from f) || '%' end)
  ),
  pagina as (
    select k.id, k.total, row_number() over (order by k.k1, k.k2, k.k3, k.k4, k.id) as ord
      from chaves k
     order by k.k1, k.k2, k.k3, k.k4, k.id
     limit least(greatest(coalesce(p_limite, 10), 1), 100)
    offset greatest(coalesce(p_deslocamento, 0), 0)
  ),
  resumos as (
    select r.pedido_id, to_jsonb(r) - 'contagem_total' as resumo
      from public.plt_fn_pedidos_kanban(
             null, false,
             coalesce((select array_agg(distinct c.pedido_id)
                         from pagina pg join public.plt_cards c on c.id = pg.id
                        where c.pedido_id is not null), '{}'),
             100, 0) r
  )
  select c.id, c.tipo, c.pedido_id, c.card_pai_id, c.item_seq, c.item_codigo,
         c.item_descricao, c.indice_unidade, c.total_unidades, c.setor_atual_id,
         c.etapa_atual_id, c.desde, c.executor_atual_id, c.responsavel_id,
         c.delegado_em, c.qualidade_atual, c.concluido_em, c.pausado_em,
         c.liberado_completo_em,
         pe.n as pecas_estoque,
         pg.total as contagem_total,
         coalesce(c.etiquetas, '{}'),
         -- SESSAO-38 (D-167/D-169): o stand-by do pedido no resumo (o relógio do
         -- PCP desconta; a aba Stand-by mostra o motivo, desde quando e quem pôs)
         case when c.tipo = 'pedido' then coalesce(r.resumo, '{}'::jsonb) || jsonb_build_object(
                'standby_desde', c.standby_desde, 'standby_motivo', c.standby_motivo,
                'standby_periodos', c.standby_periodos,
                -- SESSAO-45: quantas das peças do estoque já estão RESERVADAS para este pedido
                'pecas_reservadas', pe.r,
                'standby_por', (select u.nome from public.plt_eventos e
                                  join public.plt_usuarios u on u.id = e.usuario_id
                                 where e.id = c.standby_evento_id))
                -- SESSAO-47: o pedido que a logística devolveu ao PCP e o Tiny ainda não mostrou a situação nova
                || case when c.volta_pcp_em is null then '{}'::jsonb
                        else jsonb_build_object('volta_pcp', plt_privado.fn_volta_pcp_resumo(c.id)) end
                -- SESSAO-48 (frente 2): a peça cancelada na produção — o selo e a janela "O que aconteceu?"
                || case when c.pcp_aviso_em is null then '{}'::jsonb
                        else jsonb_build_object('aviso_cancelada', plt_privado.fn_pcp_aviso_resumo(c.id)) end
                -- SESSAO-51 (bloco A): o pedido entregue em parte que segue vivo — "Entregue em parte (N de M)"
                || case when c.parcial_evento_id is null then '{}'::jsonb
                        else jsonb_build_object('entrega_parcial', jsonb_build_object(
                               'entregues', c.parcial_entregues, 'total', c.parcial_total, 'em', c.parcial_em)) end
              else r.resumo end,
         c.prioridade
    from pagina pg
    join public.plt_cards c on c.id = pg.id
    left join resumos r on r.pedido_id = c.pedido_id
    -- as peças do galpão que atendem o pedido (a mesma conta de
    -- plt_fn_cards_pedido_pcp), só para os cards da página
    -- SESSAO-45 (o PCP "mentindo" sobre o estoque — vídeo do dono, 04/11): a conta
    -- antiga somava TODA peça livre do mesmo SKU a TODO pedido que tinha o item, sem
    -- limite — 5 livres apareciam como "5 no estoque" em cada um dos pedidos, mesmo o
    -- que precisa de 1. Agora, por item: no máximo o que ainda FALTA liberar dele, e
    -- as reservadas para ESTE pedido vêm à parte (r) — a tela diz "reservada(s)" e
    -- "livre(s)", as mesmas palavras do cartão do Estoque.
    cross join lateral (
      select case when c.tipo <> 'pedido' then 0
                  else coalesce(sum(least(nec.falta, nec.reservadas + nec.livres)), 0)::int end as n,
             case when c.tipo <> 'pedido' then 0
                  else coalesce(sum(least(nec.falta, nec.reservadas)), 0)::int end as r
        from (
          select greatest(it.unidades - (select count(*) from public.plt_cards u
                                          where u.pedido_id = c.pedido_id and u.tipo = 'unidade'
                                            and u.item_codigo = it.codigo), 0)::int as falta,
                 (select count(*)::int
                    from public.plt_cards u
                    join public.plt_setores se on se.id = u.setor_atual_id and se.codigo = 'estoque'
                   where u.tipo = 'unidade' and u.pedido_id is null and u.arquivado_em is null
                     and u.reservada_pedido_id = c.pedido_id and u.item_codigo = it.codigo) as reservadas,
                 (select count(*)::int
                    from public.plt_cards u
                    join public.plt_setores se on se.id = u.setor_atual_id and se.codigo = 'estoque'
                   where u.tipo = 'unidade' and u.pedido_id is null and u.arquivado_em is null
                     and u.reservada_pedido_id is null and u.item_codigo = it.codigo
                     and not plt_privado.fn_eh_personalizado(u.item_descricao)) as livres
            from (select v.codigo, sum(v.unidades)::int as unidades
                    from plt_privado.vw_itens_producao v
                   where c.tipo = 'pedido' and v.pedido_id = c.pedido_id and v.unidades > 0
                     and v.codigo is not null and not plt_privado.fn_eh_personalizado(v.descricao)
                   group by v.codigo) it
        ) nec
    ) pe
   order by pg.ord;
$function$;

-- (recriada da vigente — 20261112020000_plt_pcp_cancelar_ocultar_excluido.sql)
CREATE OR REPLACE FUNCTION public.plt_fn_pedidos_lista(p_busca text DEFAULT NULL::text, p_antes_numero integer DEFAULT NULL::integer, p_limite integer DEFAULT 20, p_cancelados boolean DEFAULT false)
 RETURNS TABLE(pedido_id bigint, numero integer, cliente_nome text, data_pedido date, data_prevista date, situacao text, total_pedido numeric, vendedor text, marcadores text[], total_unidades integer, unidades_liberadas integer, unidades_prontas integer, card_id bigint, situacao_plataforma text, entregue_em timestamp with time zone, entregue_por text, entregue_fonte text, entregue_tiny text, cancelado_em timestamp with time zone, tem_mais boolean, contagem_total integer, programacao_data date, caminhao_nome text, rota integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
#variable_conflict use_column
declare
  v_lim   integer := least(greatest(coalesce(p_limite, 20), 1), 100);
  v_busca text    := nullif(btrim(coalesce(p_busca, '')), '');
  v_canc  boolean := coalesce(p_cancelados, false);
  -- só dígitos, sem zero na frente: o "número que começa com" vira faixas
  v_num   bigint  := case when nullif(btrim(coalesce(p_busca, '')), '') ~ '^[1-9][0-9]{0,8}$'
                          then btrim(p_busca)::bigint end;
  v_ids   bigint[];
  v_total integer;
  v_teto  bigint;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    return;  -- como antes: sem acesso, lista vazia
  end if;

  -- 1 · a página (limite + 1, para saber se tem mais), por um caminho por caso
  if v_busca is null and not v_canc then
    select coalesce(array_agg(x.id order by x.numero desc), '{}') into v_ids from (
      select p.id, p.numero from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p
       where (p_antes_numero is null or p.numero < p_antes_numero)
       order by p.numero desc limit v_lim + 1) x;
  elsif v_busca is null then
    select coalesce(array_agg(x.id order by x.numero desc), '{}') into v_ids from (
      select p.id, p.numero from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p
       where plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado'
         and (p_antes_numero is null or p.numero < p_antes_numero)
       order by p.numero desc limit v_lim + 1) x;
  else
    -- 1ª tentativa: só os 5.000 números mais recentes, do jeito de sempre (o
    -- filtro com OU, parando na página cheia) — termo COMUM acha a página aí e
    -- para cedo. Achou a página inteira (limite + 1) → é exatamente a de antes:
    -- qualquer outro pedido que case tem número menor que todos da janela.
    v_teto := coalesce(p_antes_numero, (select max(pm.numero) from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) pm) + 1);
    select coalesce(array_agg(x.id order by x.numero desc), '{}') into v_ids from (
      select p.id, p.numero
        from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p
        left join public.clientes c on c.id = p.cliente_id
       where p.numero >= v_teto - 5000
         and p.numero < v_teto
         and (p.numero::text like v_busca || '%'
              or c.nome ilike '%' || v_busca || '%'
              or p.vendedor ilike '%' || v_busca || '%')
         and (not v_canc or plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado')
       order by p.numero desc limit v_lim + 1) x;
  end if;
  -- termo RARO (a janela não encheu a página): os caminhos que os índices usam
  if v_busca is not null and cardinality(v_ids) <= v_lim then
    select coalesce(array_agg(x.id order by x.numero desc), '{}') into v_ids from (
      select p.id, p.numero
        from (-- o número que começa com o texto: só dígitos (sem zero na frente) viram
              -- faixas [x·10^k, (x+1)·10^k) — o índice do número anda em cada uma
              select p1.id
                from generate_series(0, greatest(0, 10 - length(v_busca))) as k(e)
                join (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p1
                  on p1.numero >= v_num * (10::bigint ^ k.e)::bigint
                 and p1.numero <  (v_num + 1) * (10::bigint ^ k.e)::bigint
               where v_num is not null
              union
              select p2.id from public.clientes c2 join (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p2 on p2.cliente_id = c2.id
               where c2.nome ilike '%' || v_busca || '%'
              union
              select p3.id from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p3 where p3.vendedor ilike '%' || v_busca || '%') alvo
        join (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p on p.id = alvo.id
       where (not v_canc or plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado')
         and (p_antes_numero is null or p.numero < p_antes_numero)
       order by p.numero desc limit v_lim + 1) x;
  end if;

  -- 2 · o total, só na 1ª página (até 10.001), pelo mesmo caminho
  if p_antes_numero is null then
    if v_busca is null and not v_canc then
      select count(*)::int into v_total from (select 1 from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p limit 10001) x;
    elsif v_busca is null then
      select count(*)::int into v_total from (
        select 1 from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p
         where plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado' limit 10001) x;
    else
      select count(*)::int into v_total from (
        select 1
          from (select p1.id
                  from generate_series(0, greatest(0, 10 - length(v_busca))) as k(e)
                  join (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p1
                    on p1.numero >= v_num * (10::bigint ^ k.e)::bigint
                   and p1.numero <  (v_num + 1) * (10::bigint ^ k.e)::bigint
                 where v_num is not null
                union
                select p2.id from public.clientes c2 join (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p2 on p2.cliente_id = c2.id
                 where c2.nome ilike '%' || v_busca || '%'
                union
                select p3.id from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p3 where p3.vendedor ilike '%' || v_busca || '%') alvo
          join (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p on p.id = alvo.id
         where (not v_canc or plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado')
         limit 10001) x;
    end if;
  end if;

  -- 3 · o que cada linha mostra — a projeção de sempre, sobre a página achada
  return query
  with pagina as (
    select p.id, p.numero, p.cliente_id, p.data_pedido, plt_privado.fn_data_entrega(p.id, p.data_prevista) as data_prevista, p.situacao,
           p.total_pedido, p.vendedor, p.marcadores, nullif(p.raw ->> 'data_entrega', '') as entregue_tiny,
           c.nome as cliente_nome
      from unnest(v_ids) with ordinality as u(id, ord)
      join (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p on p.id = u.id
      left join public.clientes c on c.id = p.cliente_id
     order by u.ord
  ),
  numerada as (
    select pg.*, row_number() over (order by pg.numero desc) as n from pagina pg
  )
  select nu.id                                   as pedido_id,
         nu.numero,
         coalesce(nu.cliente_nome, '')           as cliente_nome,
         nu.data_pedido,
         nu.data_prevista,
         nu.situacao,
         nu.total_pedido,
         nullif(btrim(coalesce(nu.vendedor, '')), '') as vendedor,
         coalesce(nu.marcadores, '{}')           as marcadores,
         coalesce(i.total_unidades, 0)           as total_unidades,
         coalesce(u.liberadas, 0)                as unidades_liberadas,
         coalesce(u.prontas, 0)                  as unidades_prontas,
         pc.id                                   as card_id,
         case
           when plt_privado.fn_situacao_normalizada(nu.situacao) = 'cancelado' then 'cancelado'
           -- SESSAO-50: cancelado pela plataforma (o Tiny confirma depois)
           when pc.cancelado_plataforma_em is not null then 'cancelado'
           when pc.id is null then 'sem_card'
           when pc.devolucao_evento_id is not null then 'devolvido'
           when pc.entrega_evento_id is not null then 'entregue'
           when pc.arquivado_em is not null then 'arquivado'
           -- SESSAO-38 (↪️ D-156): o PROGRAMADO também está "Em rota" (lançado ou não)
           when pc.lancado_rotas_em is not null or pr.card_id is not null then 'em_rota'
           -- ↪️ SESSAO-48 (frente 2): o PCP tirou o pedido da linha de produção — vale antes de
           -- "aguardando"/"em produção": as peças que seguem não desfazem a remoção
           -- ↪️ SESSAO-51: o "Limpar da produção" da entrega parcial usa a mesma marca (o
           -- motivo 'entrega_parcial') — o pedido segue com o estado de verdade (pronto, em rota…)
           when pc.removido_pcp_em is not null and pc.removido_pcp_motivo is distinct from 'entrega_parcial' then 'removido_pcp'
           when coalesce(i.total_unidades, 0) > 0 and coalesce(u.prontas, 0) >= i.total_unidades then 'aguardo'
           when coalesce(u.liberadas, 0) > 0 then 'producao'
           -- D-132: o Tiny já levou adiante e nada foi liberado — segue o Tiny.
           -- ↪️ SESSAO-47: … a não ser que a logística o tenha devolvido ao PCP
           when plt_privado.fn_fora_do_pcp(nu.situacao, pc.volta_pcp_em, pc.removido_pcp_em, pc.pedido_id in (select xexc.pedido_id from public.plt_pedidos_excluidos_tiny xexc), pc.cancelado_plataforma_em) then 'tiny'
           else 'pcp'
         end                                     as situacao_plataforma,
         -- SESSAO-47: o dia REAL da entrega (a projeção do card)
         -- SESSAO-51: a entrega PARCIAL também aparece — a fechada e a que deixou o resto
         -- em produção (o pedido segue vivo; a fonte diz 'parcial')
         coalesce(pc.entrega_em, case when pc.entrega_evento_id is null then pc.parcial_em end) as entregue_em,
         coalesce(ue.nome, uep.nome)             as entregue_por,
         case when ent.id is null then case when entp.id is not null then 'parcial' end
              when coalesce((ent.dados ->> 'parcial')::boolean, false) then 'parcial'
              else coalesce(ent.dados ->> 'fonte', case when ent.usuario_id is null then 'tiny' else 'plataforma' end)
         end                                     as entregue_fonte,
         nu.entregue_tiny,
         coalesce(canc.ocorrido_em, pc.cancelado_plataforma_em) as cancelado_em,
         (select count(*) from pagina) > v_lim       as tem_mais,
         v_total                                 as contagem_total,
         pr.data_entrega                         as programacao_data,
         cam.nome                                as caminhao_nome,
         pr.rota::int                            as rota
    from numerada nu
    left join public.plt_cards pc on pc.pedido_id = nu.id and pc.tipo = 'pedido'
    left join public.plt_programacoes pr on pr.card_id = pc.id
    left join public.plt_caminhoes cam on cam.id = pr.caminhao_id
    left join public.plt_eventos ent on ent.id = pc.entrega_evento_id
    left join public.plt_usuarios ue on ue.id = ent.usuario_id
    left join public.plt_eventos entp on entp.id = pc.parcial_evento_id and pc.entrega_evento_id is null
    left join public.plt_usuarios uep on uep.id = entp.usuario_id
    left join lateral (
      select min(e.ocorrido_em) as ocorrido_em
        from public.plt_eventos e
       where pc.id is not null and e.card_id = pc.id and e.tipo = 'pedido_cancelado'
    ) canc on true
    left join lateral (
      -- D-63: o frete não conta como unidade.
      select coalesce(sum(v.unidades), 0)::int as total_unidades
        from plt_privado.vw_itens_producao v
       where v.pedido_id = nu.id
    ) i on true
    left join lateral (
      select count(*)::int as liberadas,
             count(*) filter (where cu.concluido_em is not null)::int as prontas
        from public.plt_cards cu
       where cu.tipo = 'unidade'
         and (cu.pedido_id = nu.id or (pc.id is not null and cu.card_pai_id = pc.id))
         and cu.cancelada_em is null   -- SESSAO-48: a peça cancelada perdeu o pedido (a vaga voltou)
    ) u on true
   where nu.n <= v_lim
   order by nu.numero desc;
end;
$function$;

-- ----------------------------------------------------------------------------
-- 8 · A aba "Pedidos ocultos" e o "Incluir pedido no PCP" não mostram o pedido
--     que a entrega parcial tirou do PCP (ele mora em "Entregas parciais")
-- ----------------------------------------------------------------------------
-- (recriada da vigente — 20261112020000_plt_pcp_cancelar_ocultar_excluido.sql)
create or replace function plt_privado.fn_pcp_ocultos_linhas(
  p_busca     text        default null,
  p_limite    integer     default 20,
  p_depois_em timestamptz default null,
  p_depois_id bigint      default null,
  p_todos     boolean     default false
)
returns table (
  card_id         bigint,
  pedido_id       bigint,
  numero          integer,
  cliente_nome    text,
  data_pedido     date,
  situacao        text,
  oculto_em       timestamptz,
  oculto_por      text,
  motivo          text,
  texto           text,
  pecas_ocultadas integer,
  a_liberar       integer,
  fora_pelo_tiny  boolean,
  dias            integer,
  tem_mais        boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_lim   integer     := least(greatest(coalesce(p_limite, 20), 1), 100);
  v_ate   timestamptz := coalesce(p_depois_em, 'infinity'::timestamptz);
  v_id    bigint      := coalesce(p_depois_id, 9223372036854775807);
  v_dias  integer     := plt_privado.fn_ocultos_dias();
  v_desde timestamptz;
  v_ativo boolean;
  v_num   text;
  v_nome  text;
  v_ids   bigint[] := '{}';
  r       record;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    return;
  end if;
  v_desde := case when coalesce(p_todos, false) then '-infinity'::timestamptz
                  else now() - make_interval(days => v_dias) end;
  select f.ativo, f.numero, f.nome into v_ativo, v_num, v_nome from plt_privado.fn_filtro_do_quadro(p_busca) f;
  v_ativo := coalesce(v_ativo, false);

  for r in select pc.id, pc.pedido_id as ped
             from public.plt_cards pc
            where pc.removido_pcp_em is not null
              and pc.removido_pcp_em >= v_desde
              and (pc.removido_pcp_em, pc.id) < (v_ate, v_id)
              and pc.tipo = 'pedido' and pc.arquivado_em is null
              and pc.cancelado_plataforma_em is null
              -- SESSAO-51: o pedido que a entrega parcial tirou do PCP mora em
              -- "Entregas parciais" (o revogar o devolve), não nos ocultos
              and pc.removido_pcp_motivo is distinct from 'entrega_parcial'
            order by pc.removido_pcp_em desc, pc.id desc
  loop
    continue when exists (select 1 from public.plt_pedidos_excluidos_tiny x where x.pedido_id = r.ped);
    continue when v_ativo and not plt_privado.fn_pedido_bate_filtro(r.ped, v_num, v_nome);
    v_ids := v_ids || r.id;
    exit when cardinality(v_ids) > v_lim;
  end loop;

  return query
  select pc.id                         as card_id,
         p.id                          as pedido_id,
         p.numero                      as numero,
         coalesce(cl.nome, '')         as cliente_nome,
         p.data_pedido                 as data_pedido,
         p.situacao                    as situacao,
         pc.removido_pcp_em            as oculto_em,
         ur.nome                       as oculto_por,
         pc.removido_pcp_motivo        as motivo,
         pc.removido_pcp_texto         as texto,
         coalesce((er.dados ->> 'ocultadas')::int, 0) as pecas_ocultadas,
         (select count(*)::int from plt_privado.fn_vagas_pedido(p.id) w
           where w.card_id is null and w.reserva_card_id is null) as a_liberar,
         plt_privado.fn_fora_do_pcp(p.situacao, pc.volta_pcp_em, null, false, null) as fora_pelo_tiny,
         v_dias                        as dias,
         cardinality(v_ids) > v_lim    as tem_mais
    from unnest(v_ids) with ordinality as pg(id, ord)
    join public.plt_cards pc on pc.id = pg.id
    join public.pedidos p on p.id = pc.pedido_id
    left join public.clientes cl on cl.id = p.cliente_id
    left join public.plt_eventos er on er.id = pc.removido_pcp_evento_id
    left join public.plt_usuarios ur on ur.id = er.usuario_id
   where pg.ord <= v_lim
   order by pg.ord;
end;
$$;
