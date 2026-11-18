-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · SESSAO-52 — DATAS E TEXTOS CERTOS
-- (18/11/2026 — os achados fora do escopo da SESSAO-47, item 6 das pendências)
--
-- Desde a SESSAO-47 vale UMA data de entrega só em toda a plataforma: o dia real
-- guardado no card do pedido (plt_cards.entrega_em — D-276). Três leitores ainda
-- não a seguiam:
--
--   1. A BUSCA GERAL (plt_fn_busca_cards) dizia "Entregue em dd/mm" pelo dia em que
--      a peça foi ARQUIVADA (o dia do registro). Ganha a chave entregue_em — o dia
--      real da entrega com que o card saiu (só quando há o que dizer).
--   2. O DETALHE DA DEVOLUÇÃO (plt_fn_devolucao_detalhe) mostrava, no histórico, o
--      dia antigo de uma entrega corrigida. A linha da entrega passa a levar o dia
--      vigente e ganha registrado_em (quando ela foi registrada).
--   3. A LISTA DE PEDIDOS não sabia quando a entrega foi registrada, e mostrava a
--      hora do fim do expediente do dia escolhido como se fosse a da entrega. Porta
--      nova, plt_fn_pedidos_pagina: a MESMA lista (plt_fn_pedidos_lista, intocada)
--      com a chave entrega_registrada_em em cada linha — uma requisição, como antes.
--      (A lista devolve uma tabela fixa que migrations antigas recriam sem derrubar;
--      ganhar coluna nela quebraria a reaplicação — a mesma razão da D-324/D-328.)
--
-- Só leitura: nenhuma tabela, coluna, índice, gatilho ou política muda; nenhum
-- dado é escrito. plt_fn_busca_cards e plt_fn_devolucao_detalhe recriadas por
-- EXTRAÇÃO da versão vigente (o último create nas migrations), com trocas exatas
-- e contadas; as assinaturas e as permissões não mudam; os jsonb só ganham chaves
-- (o site publicado segue funcionando com o banco novo). O site novo precisa
-- desta migration ANTES (ele chama plt_fn_pedidos_pagina).
-- Nada em tabela da integração. Sem relógio novo. Reaplicável.
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · A busca geral: "Entregue em" pelo dia real da entrega
-- ----------------------------------------------------------------------------
-- (recriada da vigente em 20261111010000_plt_sessao48_base.sql)
create or replace function public.plt_fn_busca_cards(
  p_texto     text,
  p_depois_id bigint  default null,
  p_limite    integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu      uuid := plt_privado.fn_usuario_atual();
  v_tudo    boolean;
  v_setores bigint[] := '{}';
  v_filtro  record;
  v_numb    bigint;
  v_lim     integer := least(greatest(coalesce(p_limite, 20), 1), 50);
  v_ids     bigint[] := '{}';
  v_parte   bigint[];
  v_mais    boolean;
  v_e       integer;
  v_ini     bigint;
  v_fim     bigint;
  -- o corte (o último mostrado)
  v_c_num   bigint;
  v_c_k3    integer;
  v_c_k4    integer;
  v_c_k5    integer;
  v_c_arq   boolean;
begin
  if v_eu is null then
    raise exception 'Entre na plataforma para buscar.' using errcode = 'insufficient_privilege';
  end if;
  v_tudo := plt_privado.fn_eh_admin() or plt_privado.fn_pode_ver_expedicao();
  if not v_tudo then
    v_setores := array(select plt_privado.fn_setores_do_usuario());
  end if;

  -- A mesma leitura do texto do filtro dos quadros (D-187).
  select * into v_filtro from plt_privado.fn_filtro_do_quadro(p_texto);
  -- E-106: a conversão calculada uma vez, só quando casa.
  v_numb := case when v_filtro.numero ~ '^[1-9][0-9]{0,8}$' then v_filtro.numero::bigint end;
  if v_numb is null and coalesce(length(v_filtro.nome), 0) < 3 then
    return jsonb_build_object('itens', '[]'::jsonb, 'tem_mais', false, 'numero', null);
  end if;

  if coalesce(p_depois_id, 0) > 0 then
    select coalesce(p.numero, 0),
           case c.tipo when 'pedido' then 0 when 'reposicao' then 1 when 'unidade' then 2 else 3 end,
           coalesce(c.item_seq, 0), coalesce(c.indice_unidade, 0), c.arquivado_em is not null
      into v_c_num, v_c_k3, v_c_k4, v_c_k5, v_c_arq
      from public.plt_cards c
      left join public.pedidos p on p.id = c.pedido_id
     where c.id = p_depois_id;
  end if;

  if v_numb is not null then
    -- o NÚMERO: as faixas da maior para a menor; cada uma de trás para a frente
    for v_e in reverse greatest(0, 10 - length(v_filtro.numero)) .. 0 loop
      v_ini := v_numb * (10::bigint ^ v_e)::bigint;
      v_fim := (v_numb + 1) * (10::bigint ^ v_e)::bigint;
      continue when v_c_num is not null and v_ini > v_c_num;  -- faixa toda antes do corte
      select coalesce(array_agg(x.id order by x.numero desc, x.k3, x.k4, x.k5, x.id), '{}')
        into v_parte
        from (select c.id, p.numero,
                     case c.tipo when 'pedido' then 0 when 'reposicao' then 1 when 'unidade' then 2 else 3 end as k3,
                     coalesce(c.item_seq, 0) as k4, coalesce(c.indice_unidade, 0) as k5
                from public.pedidos p
                join public.plt_cards c on c.pedido_id = p.id
               where p.numero >= v_ini and p.numero < v_fim
                 and (v_c_num is null
                      or (-p.numero::bigint,
                          case c.tipo when 'pedido' then 0 when 'reposicao' then 1 when 'unidade' then 2 else 3 end,
                          coalesce(c.item_seq, 0), coalesce(c.indice_unidade, 0), c.id)
                         > (-v_c_num, v_c_k3, v_c_k4, v_c_k5, p_depois_id))
                 and (c.tipo in ('pedido', 'avulso')
                      or (c.tipo = 'unidade' and (c.arquivado_em is null or c.pedido_id is not null or c.cancelada_em is not null))
                      or (c.tipo = 'reposicao' and c.arquivado_em is null and c.liberado_completo_em is null))
                 and (v_tudo
                      or c.setor_atual_id = any (v_setores)
                      or c.executor_atual_id = v_eu
                      or v_eu = any (c.participantes))
               order by p.numero desc, k3, k4, k5, c.id
               limit v_lim + 1 - cardinality(v_ids)) x;
      v_ids := v_ids || v_parte;
      exit when cardinality(v_ids) > v_lim;
    end loop;
  else
    -- o NOME: o vivo primeiro, o card mais novo primeiro (trigramas)
    select coalesce(array_agg(x.id order by x.arq, x.id desc), '{}')
      into v_ids
      from (select c.id, c.arquivado_em is not null as arq
              from public.plt_cards c
             where c.nome_busca like '%' || v_filtro.nome || '%'
               and (p_depois_id is null or v_c_arq is null
                    or (c.arquivado_em is not null, -c.id) > (v_c_arq, -p_depois_id))
               and (c.tipo in ('pedido', 'avulso')
                    or (c.tipo = 'unidade' and (c.arquivado_em is null or c.pedido_id is not null or c.cancelada_em is not null))
                    or (c.tipo = 'reposicao' and c.arquivado_em is null and c.liberado_completo_em is null))
               and (v_tudo
                    or c.setor_atual_id = any (v_setores)
                    or c.executor_atual_id = v_eu
                    or v_eu = any (c.participantes))
             order by c.arquivado_em is not null, c.id desc
             limit v_lim + 1) x;
  end if;

  v_mais := cardinality(v_ids) > v_lim;
  if v_mais then
    v_ids := v_ids[1:v_lim];
  end if;

  return jsonb_build_object(
    'tem_mais', v_mais,
    'numero', v_numb,
    'itens', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'tipo', c.tipo,
               'pedido_id', c.pedido_id, 'pedido_numero', p.numero, 'pedido_situacao', p.situacao,
               'titulo', coalesce(c.titulo, c.item_descricao), 'sku', c.item_codigo,
               'indice', c.indice_unidade, 'total', c.total_unidades,
               'setor_id', s.id, 'setor_nome', s.nome, 'setor_codigo', s.codigo, 'setor_papel', s.papel_no_fluxo,
               'etapa_nome', e.nome,
               'desde', c.desde,
               'arquivado_em', c.arquivado_em, 'arquivado_motivo', a.motivo,
               'liberado_completo_em', c.liberado_completo_em,
               'standby', c.standby_desde is not null,
               'executor', u.nome,
               'rota_dia', r.data_entrega, 'rota_caminhao', r.caminhao, 'rota_numero', r.rota)
             -- SESSAO-48: o pedido removido do PCP (a chave só nasce quando há o que dizer)
             || case when c.removido_pcp_em is null then '{}'::jsonb
                     else jsonb_build_object('removido_pcp_em', c.removido_pcp_em, 'removido_pcp_motivo', c.removido_pcp_motivo) end
             -- SESSAO-48: a peça cancelada (a chave só nasce quando há o que dizer)
             || case when c.cancelada_em is null then '{}'::jsonb
                     else jsonb_build_object('cancelada_em', c.cancelada_em, 'cancelada_motivo', c.cancelada_motivo,
                                             'cancelada_pedido_numero',
                                             (select pp.numero from public.pedidos pp where pp.id = c.cancelada_pedido_id)) end
             -- SESSAO-52: o dia REAL da entrega com que o card saiu (a chave só nasce quando há o que dizer)
             || case when d.em is null then '{}'::jsonb
                     else jsonb_build_object('entregue_em', d.em) end
             order by o.ord)
        from unnest(v_ids) with ordinality as o(id, ord)
        join public.plt_cards c on c.id = o.id
        left join public.pedidos p on p.id = c.pedido_id
        left join public.plt_setores s on s.id = c.setor_atual_id
        left join public.plt_etapas e on e.id = c.etapa_atual_id
        left join public.plt_usuarios u on u.id = c.executor_atual_id
        left join lateral (
          select ev.dados ->> 'motivo' as motivo,
                 -- SESSAO-52: a entrega com que a peça saiu (E-106: a conversão só quando casa)
                 case when (ev.dados ->> 'entrega_evento_id') ~ '^[0-9]{1,18}$'
                      then (ev.dados ->> 'entrega_evento_id')::bigint end as entrega_evento_id
            from public.plt_eventos ev
           where c.arquivado_em is not null and ev.card_id = c.id and ev.tipo = 'card_arquivado'
           order by ev.id desc limit 1
        ) a on true
        -- a rota do pedido (programada no card do pedido), enquanto não entregue
        left join lateral (
          select pr.data_entrega, cm.nome as caminhao, pr.rota
            from public.plt_cards pc
            join public.plt_programacoes pr on pr.card_id = pc.id
            left join public.plt_caminhoes cm on cm.id = pr.caminhao_id
           where c.pedido_id is not null and c.arquivado_em is null
             and pc.pedido_id = c.pedido_id and pc.tipo = 'pedido'
           limit 1
        ) r on true
        -- SESSAO-52 (D-276 item 4 — uma data de entrega só): QUANDO a entrega com que o card
        -- saiu aconteceu de fato. A vigente lê a data única do card do pedido
        -- (plt_cards.entrega_em — já com a correção do administrador); a que não é a vigente
        -- (a entrega em parte que deixou o resto na fábrica, a desfeita) lê o fato dela, com a
        -- última correção. Só para o card arquivado como entregue: no máximo uma página.
        left join lateral (
          select coalesce(
                   (select pc.entrega_em
                      from public.plt_cards pc
                     where pc.pedido_id = c.pedido_id and pc.tipo = 'pedido'
                       and pc.entrega_evento_id = a.entrega_evento_id
                     limit 1),
                   (select coalesce((select (k.dados ->> 'entregue_em')::timestamptz
                                       from public.plt_eventos k
                                      where k.evento_referencia_id = en.id
                                        and k.tipo = 'entrega_dia_corrigido'
                                      order by k.id desc
                                      limit 1),
                                    en.ocorrido_em)
                      from public.plt_eventos en
                     where en.id = a.entrega_evento_id and en.tipo = 'pedido_entregue')) as em
           where a.motivo = 'entregue' and a.entrega_evento_id is not null
        ) d on true), '[]'::jsonb)
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 2 · O detalhe da devolução: a entrega no dia vigente
-- ----------------------------------------------------------------------------
-- (recriada da vigente em 20261027040000_plt_rotas_endereco_data_parcial.sql)
CREATE OR REPLACE FUNCTION public.plt_fn_devolucao_detalhe(p_card_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_card public.plt_cards%rowtype;
  v_p    public.pedidos%rowtype;
  v_d    public.plt_eventos%rowtype;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'A decisão da devolução é da logística ou de admin.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_card from public.plt_cards where id = p_card_id and tipo = 'pedido';
  if not found then
    raise exception 'Card de pedido % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  select * into v_p from public.pedidos where id = v_card.pedido_id;
  if v_card.devolucao_evento_id is not null then
    select * into v_d from public.plt_eventos where id = v_card.devolucao_evento_id;
  else
    -- A última devolução (já decidida) — a tela diz que não há o que decidir.
    select * into v_d from public.plt_eventos
     where card_id = v_card.id and tipo = 'pedido_devolvido' order by id desc limit 1;
  end if;

  return jsonb_build_object(
    'card_id', v_card.id,
    'pedido_id', v_p.id,
    'numero', v_p.numero,
    'situacao_tiny', v_p.situacao,
    'cancelado', plt_privado.fn_pedido_cancelado(v_p.id),
    'cliente', (select jsonb_build_object('nome', c.nome, 'telefone', c.fone, 'cidade', (select ee.cidade from plt_privado.vw_endereco_entrega ee where ee.pedido_id = v_p.id),
                                       'bairro', (select ee.bairro from plt_privado.vw_endereco_entrega ee where ee.pedido_id = v_p.id))
                  from public.clientes c where c.id = v_p.cliente_id),
    'em_decisao', v_card.devolucao_evento_id is not null,
    'devolucao', case when v_d.id is null then null else jsonb_build_object(
        'evento_id', v_d.id, 'quando', v_d.ocorrido_em,
        'quem', (select u.nome from public.plt_usuarios u where u.id = v_d.usuario_id),
        'motivo', v_d.dados ->> 'motivo', 'observacao', v_d.dados ->> 'observacao',
        'entregue', coalesce((v_d.dados ->> 'entregue')::boolean, false)) end,
    -- O histórico da entrega: não entregue (com motivo), entregas e desfeitas,
    -- comentários do entregador e os comprovantes.
    'historico', coalesce((
        select jsonb_agg(h order by h->>'quando' desc)
          from (select jsonb_build_object('tipo', e.tipo,
                         -- SESSAO-52 (D-276 item 4): a entrega aparece no dia VIGENTE — a data única
                         -- do card do pedido (a entrega vigente) ou a última correção do fato
                         'quando', case when e.tipo = 'pedido_entregue'
                                        then coalesce(
                                               case when e.id = v_card.entrega_evento_id then v_card.entrega_em end,
                                               (select (k.dados ->> 'entregue_em')::timestamptz
                                                  from public.plt_eventos k
                                                 where k.evento_referencia_id = e.id
                                                   and k.tipo = 'entrega_dia_corrigido'
                                                 order by k.id desc
                                                 limit 1),
                                               e.ocorrido_em)
                                        else e.ocorrido_em end,
                         'quem', (select u.nome from public.plt_usuarios u where u.id = e.usuario_id),
                         'texto', coalesce(e.dados ->> 'motivo', e.observacao))
                       -- quando a entrega foi REGISTRADA (a tela não mostra a hora do fim do
                       -- expediente de um dia escolhido); a chave só nasce na entrega
                       || case when e.tipo = 'pedido_entregue'
                               then jsonb_build_object('registrado_em', e.registrado_em)
                               else '{}'::jsonb end as h
                  from public.plt_eventos e
                 where e.card_id = v_card.id
                   and e.tipo in ('entrega_nao_realizada', 'pedido_entregue', 'entrega_desfeita',
                                  'comentario_adicionado', 'pedido_devolvido', 'pedido_lancado_rotas')
                 order by e.id desc limit 20) x), '[]'::jsonb),
    'comprovantes', (select count(*)::int from public.plt_anexos a
                      where a.card_id = v_card.id and a.removido_em is null),
    'pecas', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', u.id, 'descricao', u.item_descricao, 'sku', u.item_codigo,
                 'indice', u.indice_unidade, 'total', u.total_unidades,
                 'qualidade', u.qualidade_atual,
                 'danificada', coalesce(e.eh_danificado, false),
                 'em_decisao', s.codigo = 'devolucao' and not coalesce(e.eh_danificado, false),
                 'onde', s.nome,
                 'produto_tiny_id', plt_privado.fn_estoque_produto_da_peca(u.pedido_id, u.produto_tiny_id, u.item_codigo, u.item_descricao))
               order by u.item_seq, u.indice_unidade)
          from public.plt_cards u
          join public.plt_setores s on s.id = u.setor_atual_id
          left join public.plt_etapas e on e.id = u.etapa_atual_id
         where u.pedido_id = v_card.pedido_id and u.tipo = 'unidade' and u.arquivado_em is null
           and s.codigo = 'devolucao'), '[]'::jsonb),
    'decididas', coalesce((
        select jsonb_agg(jsonb_build_object('peca_id', e.card_id, 'decisao', e.dados ->> 'decisao',
                 'quando', e.ocorrido_em, 'quem', (select u.nome from public.plt_usuarios u where u.id = e.usuario_id))
               order by e.id)
          from public.plt_eventos e
         where e.tipo = 'devolucao_decidida' and (e.dados ->> 'devolucao_evento_id')::bigint = v_d.id), '[]'::jsonb)
  );
end;
$function$;

-- ----------------------------------------------------------------------------
-- 3 · A lista de pedidos com a hora em que a entrega foi registrada
-- ----------------------------------------------------------------------------
-- A mesma página da plt_fn_pedidos_lista (os mesmos parâmetros, a mesma guarda —
-- sem acesso, lista vazia —, a mesma ordem), em jsonb, com uma chave a mais por
-- linha: entrega_registrada_em — o registrado_em do fato da entrega que a linha
-- mostra (a vigente; sem ela, a entrega em parte). Até 100 linhas (o teto da
-- lista), duas leituras por chave primária em cada uma.
create or replace function public.plt_fn_pedidos_pagina(
  p_busca        text    default null,
  p_antes_numero integer default null,
  p_limite       integer default 20,
  p_cancelados   boolean default false
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- a hora do registro por subconsulta (chave primária a chave primária): o plano não
  -- depende de quantas linhas o banco acha que a lista devolve
  select coalesce(jsonb_agg(
           to_jsonb(l) || jsonb_build_object('entrega_registrada_em',
             (select ev.registrado_em
                from public.plt_cards pc
                join public.plt_eventos ev on ev.id = coalesce(pc.entrega_evento_id, pc.parcial_evento_id)
               where pc.id = l.card_id))
           order by l.numero desc), '[]'::jsonb)
    from public.plt_fn_pedidos_lista(p_busca, p_antes_numero, p_limite, p_cancelados) l;
$$;

comment on function public.plt_fn_pedidos_pagina(text, integer, integer, boolean) is
  'SESSAO-52: a página da lista de Pedidos que a tela chama — as linhas da plt_fn_pedidos_lista (intocada: a guarda, a busca, o cursor e o total são dela), em jsonb, cada uma com entrega_registrada_em (quando a entrega mostrada foi REGISTRADA; entregue_em é quando ela aconteceu de fato). A tela usa as duas para não mostrar a hora do fim do expediente de um dia escolhido como se fosse a da entrega.';

revoke all on function public.plt_fn_pedidos_pagina(text, integer, integer, boolean) from public, anon;
grant execute on function public.plt_fn_pedidos_pagina(text, integer, integer, boolean) to authenticated;
