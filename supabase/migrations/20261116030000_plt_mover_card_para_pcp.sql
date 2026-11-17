-- ============================================================================
-- SESSAO-51 · BLOCO B — "Mover para o PCP": a peça em produção volta ao PCP
-- ============================================================================
-- Pedido do dono (16/11, 22:41): "se um card já está em produção e um admin
-- quiser mover o mesmo para PCP novamente, ele deve conseguir, porém
-- selecionando se o produto agora passa a virar reabastecimento de estoque, ou
-- simplesmente volta para PCP por N motivos".
--
-- Frente 4 · a janela (admin e super admin; peça viva em setor de produção —
--   nunca fim de linha, cancelada, avulso, ajuste, rota ou entregue; o banco
--   recusa nos mesmos casos): "Voltar para o PCP" (motivo da lista "Volta ao
--   PCP" e/ou observação) e "Virar reposição de estoque". Peça sem pedido (já
--   de reposição) só volta; pedido fora do PCP só vira reposição.
-- Frente 5 · o tempo aberto fecha; o fato card_voltou_pcp guarda setor, etapa,
--   posição, motivo e escolha; a peça é arquivada com registro (sai do quadro e
--   de toda conta); "Voltar": perde o pedido (unidade_desvinculada — a conta da
--   48) e a vaga reabre no PCP com o selo; "Reposição": perde o pedido, a vaga
--   reabre e nasce 1 reposição de estoque com a origem (um card à parte — a
--   regra só segura UMA aberta por produto para a maquinaria: D-186), que não sai
--   sozinha em 2 dias úteis nem entra na conta da automática enquanto não for
--   liberada. A liberação oferece "Usar a mesma peça" (D-130: a peça é uma só).
-- Recriações a partir das versões vigentes (A-96/A-97). Nada aqui altera tabela
-- da integração.
-- ============================================================================
set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · O estado da peça para o "Mover para o PCP" (uma regra só para a janela e
--     para o gesto): pode ou não, e cada escolha com o porquê
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_voltar_pcp_estado(p_card_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_card     public.plt_cards%rowtype;
  v_setor    public.plt_setores%rowtype;
  v_etapa    public.plt_etapas%rowtype;
  v_p        public.pedidos%rowtype;
  v_pc       public.plt_cards%rowtype;
  v_pai      public.plt_cards%rowtype;
  v_produto  bigint;
  v_catalogo boolean := false;
  v_porque   text;
  v_volta_ok boolean := false;
  v_fora     text;
  v_volta_nao text;
  v_rep_nao  text;
  v_executor text;
begin
  select * into v_card from public.plt_cards where id = p_card_id;
  if v_card.id is null then
    return jsonb_build_object('pode', false, 'porque_nao', 'Peça não encontrada.');
  end if;
  select * into v_setor from public.plt_setores where id = v_card.setor_atual_id;
  select * into v_etapa from public.plt_etapas where id = v_card.etapa_atual_id;
  select u.nome into v_executor from public.plt_usuarios u where u.id = v_card.executor_atual_id;

  v_porque := case
    when v_card.tipo <> 'unidade' then 'Só a peça do quadro volta ao PCP (card avulso e card de pedido não).'
    when v_card.arquivado_em is not null then 'Esta peça não está mais no quadro.'
    when v_card.cancelada_em is not null then 'A fabricação desta peça foi cancelada.'
    when v_card.destino_pendente_em is not null
      then 'O pedido desta peça foi cancelado e ela espera a logística decidir o destino (Estoque → "Para onde vai este móvel?").'
    when v_card.ajuste_destino is not null then 'Peça de ajuste não nasceu no PCP — ela segue o ajuste.'
    when coalesce(v_setor.papel_no_fluxo, '') <> 'producao' then 'Só peça em setor de produção volta ao PCP.'
    when coalesce(v_etapa.cancela_fabricacao, false) then 'A peça está numa coluna que cancela a fabricação.'
  end;

  if v_card.pedido_id is not null then
    select * into v_p from public.pedidos where id = v_card.pedido_id;
    select * into v_pc from public.plt_cards where pedido_id = v_card.pedido_id and tipo = 'pedido';
    v_fora := case
      when v_pc.id is null then 'o pedido não tem card no PCP'
      when plt_privado.fn_pedido_cancelado(v_card.pedido_id) or v_pc.cancelado_plataforma_em is not null then 'foi cancelado'
      when v_pc.entrega_evento_id is not null then 'já foi entregue'
      when v_pc.arquivado_em is not null then 'foi arquivado'
      when v_pc.removido_pcp_motivo = 'oculto' then 'foi ocultado do PCP'
      when v_pc.removido_pcp_em is not null then 'saiu do PCP'
      when plt_privado.fn_fora_do_pcp(v_p.situacao, v_pc.volta_pcp_em, v_pc.removido_pcp_em,
                                      v_pc.pedido_id in (select x.pedido_id from public.plt_pedidos_excluidos_tiny x),
                                      v_pc.cancelado_plataforma_em)
        then 'o Tiny já o levou adiante ("' || coalesce(v_p.situacao, '') || '")'
    end;
    v_volta_ok := v_fora is null;
    if not v_volta_ok then
      v_volta_nao := 'O pedido ' || coalesce(v_p.numero::text, '') || ' ' || v_fora || ' — a peça só pode virar reposição de estoque.';
    end if;
    v_produto := coalesce(v_card.produto_tiny_id, plt_privado.fn_produto_do_item(v_card.item_codigo, v_card.item_descricao));
    select exists (select 1 from public.produtos pr
                    where pr.tiny_id = v_produto and pr.situacao = 'A' and pr.tipo_estoque_efetivo = 'movel')
      into v_catalogo;
    if not v_catalogo then
      v_rep_nao := 'Este móvel não está no catálogo do estoque (personalizado ou fora do Tiny) — ele só pode voltar ao PCP.';
    end if;
  else
    select * into v_pai from public.plt_cards where id = v_card.card_pai_id;
    if v_pai.tipo is distinct from 'reposicao' then
      v_volta_nao := 'Esta peça não é de um pedido nem de uma reposição de estoque.';
    end if;
    v_rep_nao := 'A peça já é de reposição de estoque — use "Voltar para o PCP".';
  end if;
  if v_porque is null and v_volta_nao is not null and v_rep_nao is not null then
    v_porque := v_volta_nao;
  end if;

  return jsonb_build_object(
    'card_id', v_card.id, 'descricao', v_card.item_descricao, 'indice', v_card.indice_unidade,
    'total', v_card.total_unidades, 'pedido_id', v_card.pedido_id, 'numero', v_p.numero,
    'card_pedido_id', v_pc.id, 'reposicao_id', case when v_pai.tipo = 'reposicao' then v_pai.id end,
    'reposicao_viva', v_pai.tipo = 'reposicao' and v_pai.arquivado_em is null,
    'setor_id', v_setor.id, 'setor', v_setor.nome, 'etapa_id', v_etapa.id, 'etapa', v_etapa.nome,
    'executor', v_executor, 'pausado', v_card.pausado_em is not null,
    'produto_tiny_id', v_produto,
    'pode', v_porque is null, 'porque_nao', v_porque,
    'voltar', jsonb_build_object('pode', v_porque is null and v_volta_nao is null, 'porque_nao', v_volta_nao),
    'reposicao', jsonb_build_object('pode', v_porque is null and v_rep_nao is null, 'porque_nao', v_rep_nao));
end;
$$;
revoke all on function plt_privado.fn_voltar_pcp_estado(bigint) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2 · Frente 4 · a janela — lida ao abrir (uma requisição: a peça, onde está,
--     quem trabalha nela, as duas escolhas e os motivos da lista)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_card_voltar_pcp_previa(p_card_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_eh_admin() then
    raise exception 'Mover a peça para o PCP é gesto do administrador.' using errcode = 'insufficient_privilege';
  end if;
  return plt_privado.fn_voltar_pcp_estado(p_card_id)
    || jsonb_build_object('motivos', coalesce((
         select jsonb_agg(jsonb_build_object('id', m.id, 'texto', m.texto) order by m.ordem, m.id)
           from public.plt_motivos m where m.tipo = 'volta_pcp' and m.ativo), '[]'::jsonb));
end;
$$;
revoke all on function public.plt_fn_card_voltar_pcp_previa(bigint) from public, anon;
grant execute on function public.plt_fn_card_voltar_pcp_previa(bigint) to authenticated;

-- ----------------------------------------------------------------------------
-- 3 · Frente 5 · o gesto: um toque, uma chamada idempotente (a chave do toque)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_card_voltar_pcp(
  p_card_id    bigint,
  p_escolha    text,
  p_motivo_id  bigint default null,
  p_observacao text default null,
  p_chave      text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
  v_card    public.plt_cards%rowtype;
  v_e       jsonb;
  v_escolha text := lower(btrim(coalesce(p_escolha, '')));
  v_motivo  text;
  v_obs     text;
  v_chave   text := nullif(btrim(coalesce(p_chave, '')), '');
  v_ev      bigint;
  v_rep     bigint;
  v_rep_nova boolean := false;
  v_prod    record;
  v_pcp     bigint;
  v_pos     integer;
  v_nome    text;
  v_quem    text;
  v_m_v     text;
  v_m_c     text;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null or not plt_privado.fn_eh_admin() then
    raise exception 'Mover a peça para o PCP é gesto do administrador.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_card from public.plt_cards where id = p_card_id for update;
  if v_card.id is null then
    raise exception 'Peça não encontrada.' using errcode = 'no_data_found';
  end if;
  -- o mesmo toque repetido (a rede que volta): um efeito só
  if v_chave is not null then
    select e.id into v_ev from public.plt_eventos e
     where e.card_id = v_card.id and e.tipo = 'card_voltou_pcp' and e.dados ->> 'chave' = v_chave
     limit 1;
    if v_ev is not null then
      return jsonb_build_object('feito', false, 'repetido', true, 'evento_id', v_ev);
    end if;
  end if;
  if v_escolha not in ('voltar', 'reposicao') then
    raise exception 'Escolha: voltar para o PCP ou virar reposição de estoque.' using errcode = 'check_violation';
  end if;
  v_e := plt_privado.fn_voltar_pcp_estado(v_card.id);
  if not coalesce((v_e ->> 'pode')::boolean, false) then
    raise exception '%', v_e ->> 'porque_nao' using errcode = 'check_violation';
  end if;
  if not coalesce((v_e -> v_escolha ->> 'pode')::boolean, false) then
    raise exception '%', v_e -> v_escolha ->> 'porque_nao' using errcode = 'check_violation';
  end if;
  if p_motivo_id is not null then
    select m.texto into v_motivo from public.plt_motivos m
     where m.id = p_motivo_id and m.tipo = 'volta_pcp' and m.ativo;
    if v_motivo is null then
      raise exception 'Esse motivo não vale para a volta ao PCP.' using errcode = 'check_violation';
    end if;
  end if;
  v_obs := nullif(btrim(coalesce(p_observacao, '')), '');
  if v_escolha = 'voltar' and v_motivo is null and v_obs is null then
    raise exception 'Diga por que a peça volta ao PCP: escolha um motivo ou escreva uma observação.'
      using errcode = 'check_violation';
  end if;

  select count(*)::int + 1 into v_pos
    from public.plt_cards o
   where o.etapa_atual_id = v_card.etapa_atual_id and o.arquivado_em is null and o.id <> v_card.id
     and o.desde < v_card.desde;
  select u.nome into v_quem from public.plt_usuarios u where u.id = v_usuario;
  v_nome := coalesce(nullif(btrim(v_card.item_descricao), ''), 'A peça')
            || case when coalesce(v_card.total_unidades, 1) > 1
                    then format(' (%s/%s)', v_card.indice_unidade, v_card.total_unidades) else '' end;

  v_m_v := current_setting('plt.volta_pcp_maquinaria', true);
  v_m_c := current_setting('plt.cancelados_maquinaria', true);
  perform set_config('plt.volta_pcp_maquinaria', 'on', true);
  perform set_config('plt.cancelados_maquinaria', 'on', true);

  -- a reposição de destino: a nova (escolha "reposição", ou a de origem que não existe
  -- mais) — UM card à parte, com a chave do gesto (D-186: a trava "uma aberta por
  -- produto" é só da maquinaria) e a origem guardada
  v_rep := nullif(v_e ->> 'reposicao_id', '')::bigint;
  if v_escolha = 'reposicao' or (v_card.pedido_id is null and not coalesce((v_e ->> 'reposicao_viva')::boolean, false)) then
    select pr.tiny_id, pr.codigo, pr.descricao into v_prod
      from public.produtos pr where pr.tiny_id = nullif(v_e ->> 'produto_tiny_id', '')::bigint;
    select s.id into v_pcp from public.plt_setores s where s.papel_no_fluxo = 'entrada' and s.ativo order by s.id limit 1;
    insert into public.plt_cards
        (tipo, produto_tiny_id, item_codigo, item_descricao, total_unidades, setor_atual_id, chave_criacao,
         reposicao_origem_card_id)
      values
        ('reposicao', v_prod.tiny_id, coalesce(v_prod.codigo, v_card.item_codigo),
         coalesce(v_prod.descricao, v_card.item_descricao), 1, v_pcp, gen_random_uuid(), v_card.id)
      returning id into v_rep;
    insert into public.plt_eventos (card_id, tipo, origem, usuario_id, setor_destino_id, observacao, dados)
      values (v_rep, 'card_criado', 'interface', v_usuario, v_pcp,
              'Veio da produção — ' || case when v_card.pedido_id is not null
                                            then 'era do pedido ' || coalesce(v_e ->> 'numero', '') || ', '
                                            else '' end
                || 'estava em ' || concat_ws(' · ', v_e ->> 'setor', v_e ->> 'etapa') || '.',
              jsonb_build_object('motivo', 'reposicao_da_producao', 'produto_tiny_id', v_prod.tiny_id,
                                 'sku', v_prod.codigo, 'quantidade', 1,
                                 'origem', jsonb_build_object('card_id', v_card.id, 'pedido_id', v_card.pedido_id,
                                                              'numero', (v_e ->> 'numero')::int,
                                                              'setor', v_e ->> 'setor', 'etapa', v_e ->> 'etapa',
                                                              'motivo', v_motivo, 'observacao', v_obs)));
    v_rep_nova := true;
  end if;

  -- o fato ANTES de fechar o tempo (fechar move a peça para a fila — A-237)
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id, observacao, dados)
    values (v_card.id, 'card_voltou_pcp', v_usuario, 'interface', v_card.setor_atual_id, v_card.etapa_atual_id,
            format('%s devolveu ao PCP — estava em %s%s.', coalesce(v_quem, 'Alguém'),
                   concat_ws(' · ', v_e ->> 'setor', v_e ->> 'etapa'),
                   case when v_escolha = 'reposicao' then '; virou reposição de estoque'
                        else coalesce(' (' || coalesce(v_motivo, v_obs) || ')', '') end),
            jsonb_build_object(
              'escolha', v_escolha, 'chave', v_chave, 'motivo_id', p_motivo_id, 'motivo', v_motivo, 'observacao', v_obs,
              'pedido_id', v_card.pedido_id, 'numero', (v_e ->> 'numero')::int,
              'card_pedido_id', nullif(v_e ->> 'card_pedido_id', '')::bigint,
              'item_seq', v_card.item_seq, 'indice_unidade', v_card.indice_unidade,
              'total_unidades', v_card.total_unidades,
              'setor_id', v_card.setor_atual_id, 'setor', v_e ->> 'setor',
              'etapa_id', v_card.etapa_atual_id, 'etapa', v_e ->> 'etapa', 'posicao', v_pos, 'desde', v_card.desde,
              'executor_id', v_card.executor_atual_id, 'executor', v_e ->> 'executor',
              'reposicao_card_id', v_rep, 'reposicao_nova', v_rep_nova))
    returning id into v_ev;
  perform plt_privado.fn_fechar_tempo_aberto(v_card.id, 'A peça voltou ao PCP: o tempo aberto fecha antes.');

  -- a peça perde o pedido (ou a vaga na reposição de origem): a vaga reabre no PCP
  -- (a conta de sempre — fn_vagas_pedido / a da reposição)
  if v_card.pedido_id is not null or v_card.card_pai_id is not null then
    insert into public.plt_eventos (card_id, tipo, origem, evento_referencia_id, observacao, dados)
      values (v_card.id, 'unidade_desvinculada', 'automacao', v_ev,
              case when v_card.pedido_id is not null
                   then 'Voltou ao PCP — a peça saiu do pedido ' || coalesce(v_e ->> 'numero', '') || ' e a vaga reabriu.'
                   else 'Voltou ao PCP — a vaga dela reabriu na reposição de estoque.' end,
              jsonb_build_object('motivo', 'voltou_pcp', 'pedido_id', v_card.pedido_id,
                                 'numero', (v_e ->> 'numero')::int,
                                 'card_pedido_id', nullif(v_e ->> 'card_pedido_id', '')::bigint,
                                 'produto_tiny_id', nullif(v_e ->> 'produto_tiny_id', '')::bigint,
                                 -- E-254/E-256: a do catálogo fica sem pai; a de fora dele guarda o do pedido
                                 'sem_pai', nullif(v_e ->> 'produto_tiny_id', '') is not null,
                                 'card_pai_id', case when nullif(v_e ->> 'produto_tiny_id', '') is null and v_card.card_pai_id is null
                                                     then nullif(v_e ->> 'card_pedido_id', '')::bigint end));
  end if;
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, evento_referencia_id, observacao, dados)
    values (v_card.id, 'card_arquivado', v_usuario, 'interface', v_ev,
            'Voltou ao PCP — saiu do quadro (nada é apagado; o PCP pode liberar a mesma peça de novo).',
            jsonb_build_object('motivo', 'voltou_pcp', 'escolha', v_escolha, 'pedido_id', v_card.pedido_id,
                               'numero', (v_e ->> 'numero')::int, 'reposicao_card_id', v_rep));
  -- a reposição de origem (peça sem pedido) volta a ter a vaga aberta
  if v_card.pedido_id is null and nullif(v_e ->> 'reposicao_id', '') is not null then
    perform plt_privado.fn_recalcular_liberacao_reposicao((v_e ->> 'reposicao_id')::bigint);
  end if;

  perform set_config('plt.volta_pcp_maquinaria', coalesce(v_m_v, ''), true);
  perform set_config('plt.cancelados_maquinaria', coalesce(v_m_c, ''), true);

  -- o sino do PCP (logística, PCP e admin) e o aviso ao vivo das telas
  perform plt_privado.fn_avisar_publico(
    'card_voltou_pcp', 'pcp', v_ev, coalesce(nullif(v_e ->> 'card_pedido_id', '')::bigint, v_rep),
    'Peça devolvida ao PCP' || coalesce(' · pedido ' || (v_e ->> 'numero'), ''),
    coalesce(v_quem, 'Alguém') || ' devolveu ao PCP ' || v_nome
      || coalesce(' do pedido ' || (v_e ->> 'numero'), '')
      || coalesce(' (' || coalesce(v_motivo, v_obs) || ')', '')
      || ' — estava em ' || concat_ws(' · ', v_e ->> 'setor', v_e ->> 'etapa') || '.'
      || case when v_escolha = 'reposicao' then ' Virou reposição de estoque; a vaga do pedido reabriu.'
              when v_card.pedido_id is not null then ' A vaga reabriu no PCP.'
              else ' A vaga reabriu na reposição de estoque.' end);
  perform plt_privado.fn_avisar('pcp');

  return jsonb_build_object('feito', true, 'evento_id', v_ev, 'escolha', v_escolha,
                            'numero', (v_e ->> 'numero')::int, 'reposicao_card_id', v_rep,
                            'reposicao_nova', v_rep_nova);
end;
$$;
revoke all on function public.plt_fn_card_voltar_pcp(bigint, text, bigint, text, text) from public, anon;
grant execute on function public.plt_fn_card_voltar_pcp(bigint, text, bigint, text, text) to authenticated;
comment on function public.plt_fn_card_voltar_pcp(bigint, text, bigint, text, text) is
  'SESSAO-51 (bloco B): "Mover para o PCP" (admin) — a peça em produção sai do quadro arquivada com registro (o tempo fecha antes) e volta ao PCP como vaga do pedido (com motivo) ou vira 1 reposição de estoque (a vaga do pedido reabre). Idempotente pela chave do toque.';

-- ----------------------------------------------------------------------------
-- 4 · O selo no card do pedido do PCP ("1 voltou da produção: Prioridade mudou —
--     estava em MONTAGEM · Montando"; "1 virou reposição de estoque")
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_voltou_producao_resumo(p_pedido_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with v as (
    select c.id, c.voltou_pcp_evento_id, c.voltou_pcp_reposicao_id
      from public.plt_cards c
     where c.voltou_pcp_pedido_id = p_pedido_id and c.voltou_pcp_em is not null
  ),
  u as (select max(v.voltou_pcp_evento_id) as id from v)
  select jsonb_build_object(
           'voltar', (select count(*) from v where v.voltou_pcp_reposicao_id is null),
           'reposicao', (select count(*) from v where v.voltou_pcp_reposicao_id is not null),
           'ultimo', (select jsonb_build_object('escolha', e.dados ->> 'escolha', 'motivo', e.dados ->> 'motivo',
                                                'observacao', e.dados ->> 'observacao', 'setor', e.dados ->> 'setor',
                                                'etapa', e.dados ->> 'etapa', 'em', e.ocorrido_em, 'por', pu.nome)
                        from public.plt_eventos e
                        left join public.plt_usuarios pu on pu.id = e.usuario_id
                       where e.id = (select u.id from u)));
$$;
revoke all on function plt_privado.fn_voltou_producao_resumo(bigint) from public, anon, authenticated;

-- (recriada da vigente — 20261116020000_plt_entrega_parcial_mantem_producao.sql)
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
                -- SESSAO-51 (bloco B): peça deste pedido devolvida ao PCP — "1 voltou da produção" /
                -- "1 virou reposição de estoque" (a chave só nasce quando há — E-237)
                || case when not exists (select 1 from public.plt_cards v
                                          where v.voltou_pcp_pedido_id = c.pedido_id and v.voltou_pcp_em is not null)
                        then '{}'::jsonb
                        else jsonb_build_object('voltou_producao', plt_privado.fn_voltou_producao_resumo(c.pedido_id)) end
              -- SESSAO-51 (bloco B): a reposição que veio da produção diz de onde veio
              when c.reposicao_origem_card_id is not null then coalesce(r.resumo, '{}'::jsonb) || jsonb_build_object(
                'origem_producao', (select e.dados -> 'origem' from public.plt_eventos e
                                     where e.card_id = c.id and e.tipo = 'card_criado' order by e.id limit 1))
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

-- ----------------------------------------------------------------------------
-- 5 · "Liberar unidades": a vaga que tem a mesma peça esperando oferece "Usar a
--     mesma peça" (D-333) — o pedido casa pelo produto (a posição desempata); a
--     reposição, pela ordem das vagas abertas
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_mesma_peca_vagas(p_card_id bigint)
returns table (seq integer, indice integer, j jsonb)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_card public.plt_cards%rowtype;
begin
  select * into v_card from public.plt_cards where id = p_card_id and tipo in ('pedido', 'reposicao');
  if not found then
    return;
  end if;
  if v_card.tipo = 'pedido' then
    if not exists (select 1 from public.plt_cards v
                    where v.voltou_pcp_pedido_id = v_card.pedido_id and v.voltou_pcp_em is not null
                      and v.voltou_pcp_reposicao_id is null) then
      return;
    end if;
    return query
    with vagas as (
      select w.seq, w.indice, w.chave from plt_privado.fn_vagas_pedido(v_card.pedido_id) w
       where w.card_id is null and w.reserva_card_id is null
    ),
    pecas as (
      select v.id, v.item_seq, v.indice_unidade, v.voltou_pcp_evento_id,
             plt_privado.fn_chave_peca(coalesce(v.produto_tiny_id, plt_privado.fn_produto_do_item(v.item_codigo, v.item_descricao)),
                                       v.item_codigo, v.item_descricao) as chave
        from public.plt_cards v
       where v.voltou_pcp_pedido_id = v_card.pedido_id and v.voltou_pcp_em is not null
         and v.voltou_pcp_reposicao_id is null and v.arquivado_em is not null and v.tipo = 'unidade'
    ),
    exatas as (
      select distinct on (va.seq, va.indice) va.seq, va.indice, pe.id
        from vagas va join pecas pe on pe.chave = va.chave and pe.item_seq = va.seq and pe.indice_unidade = va.indice
       order by va.seq, va.indice, pe.id
    ),
    resto_v as (
      select va.seq, va.indice, va.chave, row_number() over (partition by va.chave order by va.seq, va.indice) as n
        from vagas va where not exists (select 1 from exatas e where e.seq = va.seq and e.indice = va.indice)
    ),
    resto_p as (
      select pe.id, pe.chave, row_number() over (partition by pe.chave order by pe.voltou_pcp_evento_id desc, pe.id) as n
        from pecas pe where not exists (select 1 from exatas e where e.id = pe.id)
    ),
    par as (
      select e.seq, e.indice, e.id from exatas e
      union all
      select rv.seq, rv.indice, rp.id from resto_v rv join resto_p rp on rp.chave = rv.chave and rp.n = rv.n
    )
    select par.seq, par.indice, plt_privado.fn_mesma_peca_json(par.id, par.seq, par.indice)
      from par;
  else
    return query
    with abertas as (
      select k.k as indice, row_number() over (order by k.k) as n
        from generate_series(1, coalesce(v_card.total_unidades, 0)) as k(k)
       where not exists (select 1 from public.plt_cards u
                          where u.card_pai_id = v_card.id and u.tipo = 'unidade' and u.pedido_id is null
                            and u.indice_unidade = k.k)
    ),
    pecas as (
      select v.id, row_number() over (order by v.voltou_pcp_evento_id desc, v.id) as n
        from public.plt_cards v
       where v.voltou_pcp_reposicao_id = v_card.id and v.voltou_pcp_em is not null
         and v.arquivado_em is not null and v.tipo = 'unidade'
    )
    select 1, a.indice, plt_privado.fn_mesma_peca_json(p.id, 1, a.indice)
      from abertas a join pecas p on p.n = a.n;
  end if;
end;
$$;
revoke all on function plt_privado.fn_mesma_peca_vagas(bigint) from public, anon, authenticated;

create or replace function plt_privado.fn_mesma_peca_json(p_peca_id bigint, p_seq integer, p_indice integer)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
           'item_seq', p_seq, 'indice_unidade', p_indice, 'peca_card_id', c.id,
           'descricao', c.item_descricao,
           'setor_id', s.id, 'setor', coalesce(s.nome, e.dados ->> 'setor'),
           'etapa_id', et.id, 'etapa', coalesce(et.nome, e.dados ->> 'etapa'),
           -- a sugestão só vale se o setor e a etapa ainda existem (o PCP pode trocar sempre)
           'sugestao_vale', coalesce(s.ativo, false) and s.papel_no_fluxo = 'producao'
                            and (et.id is null or (et.ativa and not coalesce(et.cancela_fabricacao, false))),
           'motivo', e.dados ->> 'motivo', 'observacao', e.dados ->> 'observacao',
           'escolha', e.dados ->> 'escolha', 'voltou_em', e.ocorrido_em)
    from public.plt_cards c
    join public.plt_eventos e on e.id = c.voltou_pcp_evento_id
    left join public.plt_setores s on s.id = nullif(e.dados ->> 'setor_id', '')::bigint
    left join public.plt_etapas et on et.id = nullif(e.dados ->> 'etapa_id', '')::bigint
   where c.id = p_peca_id;
$$;
revoke all on function plt_privado.fn_mesma_peca_json(bigint, integer, integer) from public, anon, authenticated;

-- A mesma peça, de volta (D-130: a peça é uma só): desarquivada com a história, ligada
-- de novo ao pedido (ou à reposição) e ao item com o k/n, na coluna que o PCP escolheu
create or replace function plt_privado.fn_reaproveitar_peca(
  p_card public.plt_cards, p_seq integer, p_indice integer, p_peca_id bigint,
  p_setor_id bigint, p_etapa_id bigint, p_usuario uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_peca   public.plt_cards%rowtype;
  v_codigo text;
  v_desc   text;
  v_n      integer;
  v_numero integer;
  v_setor  text;
  v_etapa  text;
  v_m_v    text;
  v_m_e    text;
begin
  select * into v_peca from public.plt_cards where id = p_peca_id for update;
  if v_peca.id is null or v_peca.tipo <> 'unidade' or v_peca.arquivado_em is null or v_peca.voltou_pcp_em is null then
    raise exception 'Esta peça não está mais esperando no PCP (pode ter sido usada em outra liberação).'
      using errcode = 'check_violation';
  end if;
  if p_card.tipo = 'pedido' then
    if v_peca.voltou_pcp_pedido_id is distinct from p_card.pedido_id or v_peca.voltou_pcp_reposicao_id is not null then
      raise exception 'Esta peça voltou de outro pedido.' using errcode = 'check_violation';
    end if;
    select v.codigo, v.descricao, v.unidades into v_codigo, v_desc, v_n
      from plt_privado.vw_itens_producao v
     where v.pedido_id = p_card.pedido_id and v.seq = p_seq and v.unidades >= 1;
    if v_n is null or p_indice is null or p_indice < 1 or p_indice > v_n then
      raise exception 'Esta unidade não existe no pedido.' using errcode = 'check_violation';
    end if;
    if plt_privado.fn_chave_peca(coalesce(v_peca.produto_tiny_id,
                                          plt_privado.fn_produto_do_item(v_peca.item_codigo, v_peca.item_descricao)),
                                 v_peca.item_codigo, v_peca.item_descricao)
       <> plt_privado.fn_chave_peca(plt_privado.fn_produto_do_item(v_codigo, v_desc), v_codigo, v_desc) then
      raise exception 'A peça que voltou não é igual ao item desta vaga (produto, cor e medidas).'
        using errcode = 'check_violation';
    end if;
    select p.numero into v_numero from public.pedidos p where p.id = p_card.pedido_id;
  else
    if v_peca.voltou_pcp_reposicao_id is distinct from p_card.id then
      raise exception 'Esta peça não é desta reposição.' using errcode = 'check_violation';
    end if;
    v_codigo := p_card.item_codigo;
    v_desc   := p_card.item_descricao;
    v_n      := p_card.total_unidades;
    if p_seq is distinct from 1 or p_indice is null or p_indice < 1 or p_indice > coalesce(v_n, 0) then
      raise exception 'Esta unidade não existe na reposição.' using errcode = 'check_violation';
    end if;
  end if;
  select s.nome into v_setor from public.plt_setores s where s.id = p_setor_id;
  select e.nome into v_etapa from public.plt_etapas e where e.id = p_etapa_id;

  v_m_v := current_setting('plt.volta_pcp_maquinaria', true);
  v_m_e := current_setting('plt.entrega_maquinaria', true);
  perform set_config('plt.volta_pcp_maquinaria', 'on', true);
  -- trazer de volta um card arquivado é da maquinaria (a regra do desarquivar)
  perform set_config('plt.entrega_maquinaria', 'on', true);

  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_destino_id, etapa_destino_id, observacao, dados)
    values (v_peca.id, 'peca_reaproveitada_pcp', p_usuario, 'interface', p_setor_id, p_etapa_id,
            format('O PCP liberou de novo a mesma peça%s — vai para %s.',
                   case when p_card.tipo = 'pedido' then ' para o pedido ' || coalesce(v_numero::text, '')
                        else ' na reposição de estoque' end,
                   concat_ws(' · ', v_setor, v_etapa)),
            jsonb_build_object('card_destino_id', p_card.id, 'tipo_destino', p_card.tipo,
                               'pedido_id', p_card.pedido_id, 'numero', v_numero,
                               'item_seq', p_seq, 'indice_unidade', p_indice, 'total_unidades', v_n,
                               'setor', v_setor, 'etapa', v_etapa, 'voltou_evento_id', v_peca.voltou_pcp_evento_id));
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id, observacao, dados)
    values (v_peca.id, 'card_desarquivado', p_usuario, 'interface', v_peca.setor_atual_id, v_peca.etapa_atual_id,
            'O PCP liberou de novo a mesma peça (com a história dela).',
            jsonb_build_object('motivo', 'reaproveitada_pcp'));
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id, observacao, dados)
    values (v_peca.id, 'peca_vinculada', p_usuario, 'interface', v_peca.setor_atual_id, v_peca.etapa_atual_id,
            case when p_card.tipo = 'pedido'
                 then format('Voltou a ser do pedido %s (%s/%s).', v_numero, p_indice, v_n)
                 else format('Voltou como peça da reposição de estoque (%s/%s).', p_indice, v_n) end,
            jsonb_build_object('pedido_id', p_card.pedido_id, 'numero', v_numero, 'card_pedido_id',
                               case when p_card.tipo = 'pedido' then p_card.id end,
                               'card_pai_id', p_card.id, 'item_seq', p_seq, 'indice_unidade', p_indice,
                               'total_unidades', v_n, 'item_codigo', v_codigo, 'item_descricao', v_desc,
                               'origem', 'volta_pcp'));
  -- para a coluna escolhida (pela API, como o PCP: sem o estado da peça — Q-19)
  if p_setor_id = v_peca.setor_atual_id then
    insert into public.plt_eventos (card_id, tipo, origem, setor_origem_id, etapa_origem_id,
                                    setor_destino_id, etapa_destino_id, observacao, dados)
      values (v_peca.id, 'movimentacao_etapa', 'api', v_peca.setor_atual_id, v_peca.etapa_atual_id,
              p_setor_id, p_etapa_id, 'Liberada de novo pelo PCP — espera alguém iniciar.',
              jsonb_build_object('motivo', 'reaproveitada_pcp', 'por', p_usuario));
  else
    insert into public.plt_eventos (card_id, tipo, origem, setor_origem_id, etapa_origem_id,
                                    setor_destino_id, etapa_destino_id, observacao, dados)
      values (v_peca.id, 'movimentacao_setor', 'api', v_peca.setor_atual_id, v_peca.etapa_atual_id,
              p_setor_id, p_etapa_id, 'Liberada de novo pelo PCP — espera alguém iniciar.',
              jsonb_build_object('motivo', 'reaproveitada_pcp', 'por', p_usuario));
  end if;
  if p_card.tipo = 'reposicao' then
    perform plt_privado.fn_recalcular_liberacao_reposicao(p_card.id);
  end if;

  perform set_config('plt.volta_pcp_maquinaria', coalesce(v_m_v, ''), true);
  perform set_config('plt.entrega_maquinaria', coalesce(v_m_e, ''), true);
end;
$$;
revoke all on function plt_privado.fn_reaproveitar_peca(public.plt_cards, integer, integer, bigint, bigint, bigint, uuid) from public, anon, authenticated;

-- (recriada da vigente — 20261112020000_plt_pcp_cancelar_ocultar_excluido.sql)
CREATE OR REPLACE FUNCTION public.plt_fn_pcp_liberacao(p_card_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_card public.plt_cards%rowtype;
  v_itens jsonb;
  v_ja    jsonb;
  v_sug   jsonb := '[]'::jsonb;
  v_prod  jsonb := '[]'::jsonb;
  v_mesma jsonb := '[]'::jsonb;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Liberar é gesto do PCP/logística ou de admin.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_card from public.plt_cards c
   where c.id = p_card_id and c.tipo in ('pedido', 'reposicao');
  if not found then
    raise exception 'Este card não existe.' using errcode = 'no_data_found';
  end if;

  if v_card.tipo = 'reposicao' then
    v_itens := jsonb_build_array(jsonb_build_object(
      'seq', 1, 'codigo', v_card.item_codigo, 'descricao', v_card.item_descricao,
      'unidades', coalesce(v_card.total_unidades, 0)));
    -- D-201: a peça desta reposição que passou a ser de um pedido segue
    -- ocupando a vaga dela (a reposição só perde a peça).
    select coalesce(jsonb_agg(jsonb_build_object('item_seq', 1, 'indice_unidade', x.k) order by x.k), '[]'::jsonb)
      into v_ja
      from (
        select u.indice_unidade as k
          from public.plt_cards u
         where u.card_pai_id = v_card.id and u.tipo = 'unidade' and u.pedido_id is null
        union
        select (e.dados ->> 'vaga_reposicao')::int
          from public.plt_cards u
          join public.plt_eventos e on e.card_id = u.id and e.tipo = 'peca_vinculada'
         where u.card_pai_id = v_card.id and u.tipo = 'unidade' and u.pedido_id is not null
           and e.dados ->> 'reposicao_card_id' = v_card.id::text
      ) x
     where x.k is not null;
  else
    -- D-63: frete não vira unidade (vw_itens_producao).
    select coalesce(jsonb_agg(jsonb_build_object('seq', v.seq, 'codigo', v.codigo,
                                                 'descricao', v.descricao, 'unidades', v.unidades,
                                                 -- SESSAO-50 (bloco A): a observação do item no Tiny
                                                 'observacao', (select o.texto from public.plt_itens_observacao o
                                                                 where o.pedido_id = v.pedido_id and o.seq = v.seq))
                              order by v.seq), '[]'::jsonb)
      into v_itens
      from plt_privado.vw_itens_producao v
     where v.pedido_id = v_card.pedido_id and v.unidades >= 1;
    -- SESSAO-44 (frente 3): a vaga é coberta pela peça do MESMO produto (a
    -- posição só desempata) — item inserido no meio da lista não troca nada.
    select coalesce(jsonb_agg(jsonb_build_object('item_seq', w.seq, 'indice_unidade', w.indice)
                              order by w.seq, w.indice), '[]'::jsonb)
      into v_ja
      from plt_privado.fn_vagas_pedido(v_card.pedido_id) w
     where w.card_id is not null;
    select coalesce(jsonb_agg(to_jsonb(s) order by s.item_seq, s.indice_unidade), '[]'::jsonb)
      into v_sug
      from public.plt_fn_sugestoes_alocacao(v_card.id) s;
    -- D-201: a peça igual sem dono que ainda está em produção, para o que o estoque não cobre.
    select coalesce(jsonb_agg(to_jsonb(s) order by s.item_seq, s.indice_unidade), '[]'::jsonb)
      into v_prod
      from plt_privado.fn_sugestoes_em_producao(v_card.id, v_sug) s;
  end if;

  -- SESSAO-51 (bloco B · D-333): a peça que voltou da produção ao PCP — "Usar a mesma
  -- peça" na vaga dela (marcada de início; a coluna sugerida é a etapa onde parou)
  select coalesce(jsonb_agg(m.j order by m.seq, m.indice), '[]'::jsonb)
    into v_mesma
    from plt_privado.fn_mesma_peca_vagas(v_card.id) m;

  return jsonb_build_object('itens', v_itens, 'ja_liberadas', v_ja, 'sugestoes', v_sug, 'em_producao', v_prod,
                            'mesma_peca', v_mesma);
end;
$function$
;

-- (recriada da vigente — 20261112020000_plt_pcp_cancelar_ocultar_excluido.sql)
CREATE OR REPLACE FUNCTION public.plt_fn_pcp_liberar(p_card_id bigint, p_unidades jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_usuario   uuid;
  v_card      public.plt_cards%rowtype;
  v_pcp       bigint;
  v_u         jsonb;
  v_seq       integer;
  v_k         integer;
  v_peca      bigint;
  v_setor     bigint;
  v_etapa     bigint;
  v_codigo    text;
  v_desc      text;
  v_n         integer;
  v_novo      bigint;
  v_alocadas  integer := 0;
  v_liberadas integer := 0;
  v_vinculadas integer := 0;
  v_reaproveitadas integer := 0;
  v_puladas   integer := 0;
  v_cards     bigint[] := '{}';
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Liberar é gesto do PCP/logística ou de admin.' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_unidades) is distinct from 'array' or jsonb_array_length(p_unidades) = 0 then
    raise exception 'Selecione pelo menos uma unidade para liberar.' using errcode = 'check_violation';
  end if;
  if jsonb_array_length(p_unidades) > 500 then
    raise exception 'No máximo 500 unidades por vez.' using errcode = 'check_violation';
  end if;

  -- A trava do card do pedido/reposição: duas pessoas liberando o mesmo
  -- pedido ao mesmo tempo esperam uma pela outra (a segunda pula o que a
  -- primeira já liberou).
  select * into v_card from public.plt_cards c
   where c.id = p_card_id and c.tipo in ('pedido', 'reposicao') and c.arquivado_em is null
   for update;
  if not found then
    raise exception 'Este card não está mais no PCP (pode ter sido arquivado).' using errcode = 'no_data_found';
  end if;
  -- SESSAO-44 (frente 2): o pedido em rota que ganhou itens novos no Tiny
  -- volta ao PCP só com o que falta — e só isso se libera.
  if v_card.tipo = 'pedido' and v_card.lancado_rotas_em is not null
     and v_card.liberado_completo_em is not null then
    raise exception 'Este pedido já foi lançado para ROTAS.' using errcode = 'check_violation';
  end if;
  select s.id into v_pcp from public.plt_setores s where s.codigo = 'pcp';

  -- 1º as peças do estoque (a sugestão aceita): a unidade nasce pronta no aguardo.
  for v_u in select x from jsonb_array_elements(p_unidades) x where x ? 'peca_card_id' loop
    v_seq  := (v_u ->> 'item_seq')::int;
    v_k    := (v_u ->> 'indice_unidade')::int;
    v_peca := (v_u ->> 'peca_card_id')::bigint;
    if v_card.tipo <> 'pedido' then
      raise exception 'A reposição não usa peça do estoque.' using errcode = 'check_violation';
    end if;
    if plt_privado.fn_vaga_coberta(v_card.pedido_id, v_seq, v_k) then
      v_puladas := v_puladas + 1;
      continue;
    end if;
    v_novo := public.plt_fn_alocar_peca(v_card.id, v_seq, v_k, v_peca);
    v_cards := v_cards || v_novo;
    v_alocadas := v_alocadas + 1;
  end loop;

  -- D-201: 2º as peças SEM DONO que ainda estão em produção — passam a ser
  -- deste pedido onde estão (setor, etapa, quem trabalha e o tempo seguem).
  for v_u in select x from jsonb_array_elements(p_unidades) x where x ? 'peca_producao_id' loop
    v_seq  := (v_u ->> 'item_seq')::int;
    v_k    := (v_u ->> 'indice_unidade')::int;
    v_peca := (v_u ->> 'peca_producao_id')::bigint;
    if v_card.tipo <> 'pedido' then
      raise exception 'A reposição não usa peça que já está em produção.' using errcode = 'check_violation';
    end if;
    if plt_privado.fn_vaga_coberta(v_card.pedido_id, v_seq, v_k) then
      v_puladas := v_puladas + 1;
      continue;
    end if;
    perform plt_privado.fn_vincular_peca_producao(v_card, v_seq, v_k, v_peca, v_usuario);
    v_cards := v_cards || v_peca;
    v_vinculadas := v_vinculadas + 1;
  end loop;

  -- SESSAO-51 (bloco B · D-333): "Usar a mesma peça" — a peça que voltou da produção
  -- ao PCP é desarquivada (com a história e o k/n) na coluna que o PCP escolheu.
  for v_u in select x from jsonb_array_elements(p_unidades) x where x ? 'peca_volta_id' loop
    v_seq   := (v_u ->> 'item_seq')::int;
    v_k     := (v_u ->> 'indice_unidade')::int;
    v_peca  := (v_u ->> 'peca_volta_id')::bigint;
    v_setor := nullif(v_u ->> 'setor_id', '')::bigint;
    v_etapa := nullif(nullif(v_u ->> 'etapa_id', ''), '0')::bigint;
    if v_setor is null
       or not exists (select 1 from public.plt_setores s
                       where s.id = v_setor and s.ativo and s.papel_no_fluxo = 'producao') then
      raise exception 'A peça volta para um setor de produção.' using errcode = 'check_violation';
    end if;
    if v_etapa is not null
       and not exists (select 1 from public.plt_etapas e where e.id = v_etapa and e.setor_id = v_setor and e.ativa
                          and not coalesce(e.cancela_fabricacao, false)) then
      raise exception 'A etapa escolhida não é deste setor (ou foi desativada).' using errcode = 'check_violation';
    end if;
    if v_card.tipo = 'pedido' then
      if plt_privado.fn_vaga_coberta(v_card.pedido_id, v_seq, v_k) then
        v_puladas := v_puladas + 1;
        continue;
      end if;
    elsif exists (select 1 from public.plt_cards u
                   where u.card_pai_id = v_card.id and u.tipo = 'unidade'
                     and u.pedido_id is null and u.indice_unidade = v_k) then
      v_puladas := v_puladas + 1;
      continue;
    end if;
    perform plt_privado.fn_reaproveitar_peca(v_card, v_seq, v_k, v_peca, v_setor, v_etapa, v_usuario);
    v_cards := v_cards || v_peca;
    v_reaproveitadas := v_reaproveitadas + 1;
  end loop;

  -- 3º as que vão para a produção (raio-x 3: só setor de produção).
  for v_u in select x from jsonb_array_elements(p_unidades) x
              where not (x ? 'peca_card_id') and not (x ? 'peca_producao_id') and not (x ? 'peca_volta_id') loop
    v_seq   := (v_u ->> 'item_seq')::int;
    v_k     := (v_u ->> 'indice_unidade')::int;
    v_setor := nullif(v_u ->> 'setor_id', '')::bigint;
    v_etapa := nullif(nullif(v_u ->> 'etapa_id', ''), '0')::bigint;
    if v_setor is null
       or not exists (select 1 from public.plt_setores s
                       where s.id = v_setor and s.ativo and s.papel_no_fluxo = 'producao') then
      raise exception 'O PCP libera a peça para um setor de produção. Peça pronta do estoque vai pela sugestão "usar?" — ela nasce pronta em Pedidos em aguardo.'
        using errcode = 'check_violation';
    end if;
    if v_etapa is not null
       and not exists (select 1 from public.plt_etapas e where e.id = v_etapa and e.setor_id = v_setor and e.ativa) then
      raise exception 'A etapa escolhida não é deste setor (ou foi desativada).' using errcode = 'check_violation';
    end if;
    -- SESSAO-50 (frente 5): liberar direto no CANCELADO / NÃO ENCONTRADO virava laço
    -- (libera → cancela → a vaga volta); quem não vai produzir cancela ou oculta o pedido
    if v_etapa is not null
       and exists (select 1 from public.plt_etapas e where e.id = v_etapa and e.cancela_fabricacao) then
      raise exception 'O PCP não libera direto numa coluna que cancela a fabricação. Se o pedido não vai ser produzido, use "Cancelar pedido" ou "Ocultar do PCP".'
        using errcode = 'check_violation';
    end if;

    if v_card.tipo = 'reposicao' then
      v_codigo := v_card.item_codigo;
      v_desc   := v_card.item_descricao;
      v_n      := v_card.total_unidades;
      if v_seq is distinct from 1 or v_k is null or v_k < 1 or v_k > coalesce(v_n, 0) then
        raise exception 'Esta unidade não existe na reposição.' using errcode = 'check_violation';
      end if;
      -- D-201: a vaga da peça que foi para um pedido continua ocupada.
      if exists (select 1 from public.plt_cards u
                  where u.card_pai_id = v_card.id and u.tipo = 'unidade'
                    and u.pedido_id is null and u.indice_unidade = v_k)
         or exists (select 1 from public.plt_cards u
                      join public.plt_eventos e on e.card_id = u.id and e.tipo = 'peca_vinculada'
                     where u.card_pai_id = v_card.id and u.tipo = 'unidade' and u.pedido_id is not null
                       and e.dados ->> 'reposicao_card_id' = v_card.id::text
                       and (e.dados ->> 'vaga_reposicao')::int = v_k) then
        v_puladas := v_puladas + 1;
        continue;
      end if;
    else
      v_n := null;
      select v.codigo, v.descricao, v.unidades into v_codigo, v_desc, v_n
        from plt_privado.vw_itens_producao v
       where v.pedido_id = v_card.pedido_id and v.seq = v_seq and v.unidades >= 1;
      if v_n is null or v_k is null or v_k < 1 or v_k > v_n then
        raise exception 'Esta unidade não existe no pedido.' using errcode = 'check_violation';
      end if;
      if plt_privado.fn_vaga_coberta(v_card.pedido_id, v_seq, v_k) then
        v_puladas := v_puladas + 1;
        continue;
      end if;
    end if;

    insert into public.plt_cards
        (tipo, pedido_id, produto_tiny_id, card_pai_id, item_seq, item_codigo, item_descricao,
         indice_unidade, total_unidades, setor_atual_id)
      values
        ('unidade', case when v_card.tipo = 'pedido' then v_card.pedido_id end,
         case when v_card.tipo = 'reposicao' then v_card.produto_tiny_id end,
         v_card.id, v_seq, v_codigo, v_desc, v_k, v_n, v_pcp)
      returning id into v_novo;
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_destino_id)
      values (v_novo, 'card_criado', v_usuario, 'interface', v_pcp);
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, setor_destino_id, etapa_destino_id)
      values (v_novo, 'movimentacao_setor', v_usuario, 'interface', v_pcp, v_setor, v_etapa);
    v_cards := v_cards || v_novo;
    v_liberadas := v_liberadas + 1;
  end loop;

  -- D-201: a peça ligada não passa pelo PCP — o quadro do PCP fica sabendo pelo pedido.
  if v_vinculadas > 0 or v_reaproveitadas > 0 then
    perform plt_privado.fn_avisar('pcp');
  end if;

  return jsonb_build_object('alocadas', v_alocadas, 'liberadas', v_liberadas, 'vinculadas', v_vinculadas,
                            'reaproveitadas', v_reaproveitadas,
                            'ja_liberadas', v_puladas, 'cards', to_jsonb(v_cards));
end;
$function$
;

-- ----------------------------------------------------------------------------
-- 6 · A reposição que veio da produção (D-332): conta a liberação pela peça que
--     voltou; não sai sozinha em 2 dias úteis; não entra na conta da reposição
--     automática (nem o "estoque coberto" a tira) enquanto não for liberada
-- ----------------------------------------------------------------------------
-- (recriada da vigente — 20260926120000_plt_estoque_completo.sql)
create or replace function plt_privado.fn_recalcular_liberacao_reposicao(p_card_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total     integer;
  v_liberadas integer;
  v_quando    timestamptz;
begin
  select c.total_unidades into v_total
    from public.plt_cards c where c.id = p_card_id and c.tipo = 'reposicao';
  if v_total is null then
    return;
  end if;

  select count(*)::int into v_liberadas
    from public.plt_cards cu
   where cu.card_pai_id = p_card_id and cu.tipo = 'unidade';

  if v_liberadas >= v_total then
    select max(e.ocorrido_em) into v_quando
      from public.plt_eventos e
      join public.plt_cards cu on cu.id = e.card_id and cu.tipo = 'unidade' and cu.card_pai_id = p_card_id
     where e.tipo = 'card_criado'
        -- SESSAO-51 (bloco B): a peça que voltou da produção e foi liberada de novo
        -- nesta reposição conta de quando passou a ser dela (como a D-201 no pedido)
        or (e.tipo = 'peca_vinculada' and e.dados ->> 'card_pai_id' = p_card_id::text);
  else
    v_quando := null;
  end if;

  update public.plt_cards
     set liberado_completo_em = v_quando
   where id = p_card_id and liberado_completo_em is distinct from v_quando;
end;
$$;

-- (recriada da vigente — 20260930190000_plt_estoque_top_x_dias_uteis.sql)
create or replace function plt_privado.fn_vencer_reposicoes()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer := 0;
  r   record;
begin
  for r in
    select rc.id, rc.setor_atual_id, rc.produto_tiny_id, rc.total_unidades,
           coalesce(u.liberadas, 0) as liberadas
      from public.plt_cards rc
      left join lateral (
        select count(*)::int as liberadas
          from public.plt_cards cu
         where cu.card_pai_id = rc.id and cu.tipo = 'unidade'
      ) u on true
     where rc.tipo = 'reposicao'
       and rc.arquivado_em is null and rc.liberado_completo_em is null
       and now() >= plt_privado.fn_reposicao_vence_em(rc.criado_em)
       -- SESSAO-51 (D-332): a reposição que veio da produção é uma peça de verdade — não sai sozinha
       and rc.reposicao_origem_card_id is null
  loop
    insert into public.plt_eventos (card_id, tipo, origem, setor_origem_id, observacao, dados)
      values (r.id, 'card_arquivado', 'api', r.setor_atual_id,
              case when r.liberadas > 0
                   then 'Reposição parada há 2 dias úteis no PCP — a parte parada saiu; o que entrou na produção segue.'
                   else 'Reposição parada há 2 dias úteis no PCP — saiu sozinha. Se o produto seguir abaixo do mínimo, a necessidade volta.' end,
              jsonb_build_object('motivo', 'reposicao_vencida',
                                 'produto_tiny_id', r.produto_tiny_id,
                                 'quantidade', r.total_unidades,
                                 'liberadas', r.liberadas,
                                 'vencidas', greatest(r.total_unidades - r.liberadas, 0)));
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- (recriada da vigente — 20261008130000_plt_estoque_numeros_prontos.sql)
create or replace function plt_privado.fn_reservados_producao()
returns table (tiny_id bigint, para_estoque integer, de_pedidos integer, pcp_pendentes integer, exibicao integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with pcp as (
    select rc.produto_tiny_id as tiny_id,
           sum(greatest(rc.total_unidades - u.liberadas, 0))::int as q
      from public.plt_cards rc
      left join lateral (
        select count(*)::int as liberadas
          from public.plt_cards cu
         where cu.card_pai_id = rc.id and cu.tipo = 'unidade'
      ) u on true
     where rc.tipo = 'reposicao'
       and rc.arquivado_em is null and rc.liberado_completo_em is null
       and now() < plt_privado.fn_reposicao_vence_em(rc.criado_em)
       -- SESSAO-51 (D-332): a que veio da produção não entra na conta enquanto não for liberada
       and rc.reposicao_origem_card_id is null
     group by rc.produto_tiny_id
  ),
  chaves as (
    select n.produto_tiny_id as tiny_id from public.plt_estoque_numeros n
     where n.producao_sem_dono > 0 or n.producao_de_pedido > 0
    union
    select p.tiny_id from pcp p
  )
  select k.tiny_id,
         coalesce(n.producao_sem_dono, 0) + coalesce(p.q, 0)                               as para_estoque,
         coalesce(n.producao_de_pedido, 0)                                                 as de_pedidos,
         coalesce(p.q, 0)                                                                  as pcp_pendentes,
         coalesce(n.producao_sem_dono, 0) + coalesce(p.q, 0) + coalesce(n.producao_de_pedido, 0) as exibicao
    from chaves k
    left join public.plt_estoque_numeros n on n.produto_tiny_id = k.tiny_id
    left join pcp p on p.tiny_id = k.tiny_id;
$$;

-- (recriada da vigente — 20261016100000_plt_estoque_movel_insumo_peca.sql)
CREATE OR REPLACE FUNCTION plt_privado.fn_gerar_reposicoes()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_pcp            bigint;
  v_card_id        bigint;
  v_qtd            integer;
  v_fim            timestamptz;
  v_mov            timestamptz;
  v_ultima_vencida boolean;
  v_gerados        integer := 0;
  r                record;
begin
  select s.id into v_pcp from public.plt_setores s
   where s.papel_no_fluxo = 'entrada' and s.ativo
   order by s.id limit 1;
  if v_pcp is null then
    return 0;
  end if;

  for r in
    select b.tiny_id, b.codigo, b.descricao, b.minimo, b.disponivel,
           b.saldo_tiny, b.reservas_loja,
           coalesce(rp.para_estoque, 0) as para_estoque
      from plt_privado.fn_estoque_por_produto() b
      join public.produtos pr on pr.tiny_id = b.tiny_id
      left join plt_privado.fn_reservados_producao() rp on rp.tiny_id = b.tiny_id
     where b.situacao = 'A'
       and pr.tipo_estoque_efetivo = 'movel'
       and coalesce(b.minimo, 0) > 0
       and b.disponivel + coalesce(rp.para_estoque, 0) < b.minimo
  loop
    -- Um card aberto por produto (a conta já desconta o que está em produção).
    if exists (
         select 1 from public.plt_cards rc
          where rc.tipo = 'reposicao' and rc.produto_tiny_id = r.tiny_id
            and rc.arquivado_em is null and rc.liberado_completo_em is null
            -- SESSAO-51 (D-332): a reposição que veio da produção não muda a conta da automática
            and rc.reposicao_origem_card_id is null) then
      continue;
    end if;

    -- Depois de um ciclo DECIDIDO (Não produzir, coberto, liberado/concluído),
    -- só gera de novo com movimento novo do estoque. Se o ÚLTIMO ciclo VENCEU,
    -- a exigência não vale: a necessidade volta sozinha (D-85).
    select (e.dados ->> 'motivo' = 'reposicao_vencida') into v_ultima_vencida
      from public.plt_cards rc
      left join lateral (
        select ev.dados from public.plt_eventos ev
         where ev.card_id = rc.id and ev.tipo = 'card_arquivado'
         order by ev.id desc limit 1
      ) e on true
     where rc.tipo = 'reposicao' and rc.produto_tiny_id = r.tiny_id
       and rc.reposicao_origem_card_id is null
     order by rc.id desc limit 1;
    if coalesce(v_ultima_vencida, false) then
      v_fim := null;
    else
      select max(greatest(coalesce(rc.arquivado_em, '-infinity'::timestamptz),
                          coalesce(rc.liberado_completo_em, '-infinity'::timestamptz),
                          coalesce((select max(cu.concluido_em) from public.plt_cards cu
                                     where cu.card_pai_id = rc.id and cu.tipo = 'unidade'),
                                   '-infinity'::timestamptz)))
        into v_fim
        from public.plt_cards rc
       where rc.tipo = 'reposicao' and rc.produto_tiny_id = r.tiny_id
         and rc.reposicao_origem_card_id is null;
    end if;
    if v_fim is not null and v_fim > '-infinity'::timestamptz then
      select max(e.ocorrido_em) into v_mov
        from public.plt_eventos e
        join public.plt_cards c on c.id = e.card_id
       where c.tipo = 'unidade' and c.produto_tiny_id = r.tiny_id
         and e.tipo in ('card_criado', 'movimentacao_setor', 'card_arquivado',
                        'peca_alocada', 'unidade_desvinculada')
         and e.ocorrido_em > v_fim;
      if v_mov is null then
        continue;
      end if;
    end if;

    v_qtd := ceil(r.minimo - greatest(r.disponivel, 0) - r.para_estoque)::integer;
    if v_qtd < 1 then
      continue;
    end if;

    v_card_id := null;
    insert into public.plt_cards
        (tipo, produto_tiny_id, item_codigo, item_descricao, total_unidades, setor_atual_id)
      values
        ('reposicao', r.tiny_id, r.codigo, r.descricao, v_qtd, v_pcp)
      on conflict do nothing
      returning id into v_card_id;
    if v_card_id is null then
      continue;
    end if;

    insert into public.plt_eventos (card_id, tipo, origem, setor_destino_id, dados)
      values (v_card_id, 'card_criado', 'automacao', v_pcp,
              jsonb_build_object(
                'motivo',              'reposicao_estoque',
                'produto_tiny_id',     r.tiny_id,
                'sku',                 r.codigo,
                'minimo',              r.minimo,
                'em_estoque',          r.disponivel,
                'disponivel',          r.disponivel,
                'necessidade_extrema', 0,
                'reservados_producao', r.para_estoque,
                'quantidade',          v_qtd,
                'saldo_tiny',          r.saldo_tiny,
                'reservas_loja',       r.reservas_loja));
    v_gerados := v_gerados + 1;
  end loop;

  return v_gerados;
end;
$function$;

-- (recriada da vigente — 20260930190000_plt_estoque_top_x_dias_uteis.sql)
create or replace function plt_privado.fn_estoque_reposicao_coberta(p_produto_tiny_id bigint)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_minimo numeric;
  v_livres integer;
  v_n      integer := 0;
  r        record;
begin
  v_minimo := plt_privado.fn_minimo_efetivo(p_produto_tiny_id);
  select x.livres into v_livres from plt_privado.fn_estoque_pecas(p_produto_tiny_id) x;
  if coalesce(v_minimo, 0) <= 0 or coalesce(v_livres, 0) < v_minimo then
    return 0;
  end if;
  for r in
    select rc.id, rc.setor_atual_id
      from public.plt_cards rc
     where rc.tipo = 'reposicao' and rc.produto_tiny_id = p_produto_tiny_id
       and rc.arquivado_em is null and rc.liberado_completo_em is null
       and not exists (select 1 from public.plt_cards u where u.card_pai_id = rc.id and u.tipo = 'unidade')
       -- SESSAO-51 (D-332): a que veio da produção é uma peça de verdade — o estoque coberto não a tira
       and rc.reposicao_origem_card_id is null
  loop
    insert into public.plt_eventos (card_id, tipo, origem, setor_origem_id, observacao, dados)
      values (r.id, 'card_arquivado', 'api', r.setor_atual_id,
              'O estoque chegou ao mínimo pelo Tiny — a reposição não precisa mais ser produzida.',
              jsonb_build_object('motivo', 'estoque_coberto', 'produto_tiny_id', p_produto_tiny_id,
                                 'livres', v_livres, 'minimo', v_minimo));
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
