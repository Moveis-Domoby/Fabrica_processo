-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 75 — A ÁREA "PEDIDOS"
-- Ajustes do dono (14/10/2026, noite) · Decisão: D-134
--
--   "Remova de PCP a aba de todos os pedidos e jogue essa aba como rota filha
--    de um novo pai chamado 'Pedidos' … a filha que mostra todos os pedidos com
--    todos os dados, sem exceção: dados de produção, dados comerciais, quem
--    fechou essa venda, quem produziu cada produto com tempo de execução em
--    cada etapa e pessoa que participou, com o dia da entrega e o horário que
--    foi dado como entregue … com botões ocultando dados pesados que são
--    revelados com cliques, porém de forma gradativa. Vai também a rota filha
--    'Cancelados', que mostra todos os pedidos cancelados da história da
--    empresa de forma paginada, com TODOS os dados fornecidos pelo Tiny."
--
--   Três portas, cada uma só no gesto que mostra o que ela traz (Lei §3):
--   1. plt_fn_pedidos_lista — a lista (Todos os pedidos e Cancelados), por
--      CURSOR (número), 20 por vez: o que a linha mostra — cliente, valor, quem
--      vendeu, situação no Tiny e na plataforma, peças prontas, entregue em
--      (dia e hora, por quem). O total vem só na primeira página.
--   2. plt_fn_pedido_producao — no clique em "Produção": cada peça (também as
--      que perderam o pedido no cancelamento — card_pai), onde está ou como
--      saiu, e cada execução: setor, etapa, quem, início, fim, tempo (pausas
--      descontadas); o resumo por pessoa.
--   3. plt_fn_pedido_tiny — no clique em "Dados do Tiny": tudo o que o Tiny
--      mandou do pedido (o registro inteiro), do cliente, das notas fiscais e
--      das contas a receber.
--   O resto da ficha (comercial, entrega, comprovante, histórico) já vem numa
--   requisição pela janela completa do pedido (plt_fn_pcp_pedido_detalhe —
--   D-120), aberta no clique na linha.
--
-- Gate de todas: quem vê a logística (fn_pode_ver_expedicao — PCP, fins de
-- linha, admin). Nada aqui altera as tabelas da integração.
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · A lista (Todos os pedidos · Cancelados), por cursor
-- ----------------------------------------------------------------------------
-- SESSAO-38 (E-17): a 20261022020100 muda a forma da lista (colunas da programação) — drop antes.
drop function if exists public.plt_fn_pedidos_lista(text, integer, integer, boolean);
create or replace function public.plt_fn_pedidos_lista(
  p_busca        text    default null,
  p_antes_numero integer default null,
  p_limite       integer default 20,
  p_cancelados   boolean default false
)
returns table (
  pedido_id           bigint,
  numero              integer,
  cliente_nome        text,
  data_pedido         date,
  data_prevista       date,
  situacao            text,
  total_pedido        numeric,
  vendedor            text,
  marcadores          text[],
  total_unidades      integer,
  unidades_liberadas  integer,
  unidades_prontas    integer,
  card_id             bigint,
  situacao_plataforma text,
  entregue_em         timestamptz,
  entregue_por        text,
  entregue_fonte      text,
  entregue_tiny       text,
  cancelado_em        timestamptz,
  tem_mais            boolean,
  contagem_total      integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with cfg as (
    select least(greatest(coalesce(p_limite, 20), 1), 100) as limite,
           nullif(btrim(coalesce(p_busca, '')), '')       as busca
  ),
  pagina as (
    select p.id, p.numero, p.cliente_id, p.data_pedido, p.data_prevista, p.situacao,
           p.total_pedido, p.vendedor, p.marcadores, nullif(p.raw ->> 'data_entrega', '') as entregue_tiny,
           c.nome as cliente_nome
      from public.pedidos p
      left join public.clientes c on c.id = p.cliente_id
      cross join cfg
     where plt_privado.fn_usuario_atual() is not null
       and plt_privado.fn_pode_ver_expedicao()
       and (p_antes_numero is null or p.numero < p_antes_numero)
       and (not coalesce(p_cancelados, false)
            or plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado')
       and (cfg.busca is null
            or p.numero::text like cfg.busca || '%'
            or c.nome ilike '%' || cfg.busca || '%'
            or p.vendedor ilike '%' || cfg.busca || '%')
     order by p.numero desc
     limit (select limite + 1 from cfg)
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
           when pc.id is null then 'sem_card'
           when pc.devolucao_evento_id is not null then 'devolvido'
           when pc.entrega_evento_id is not null then 'entregue'
           when pc.arquivado_em is not null then 'arquivado'
           when pc.lancado_rotas_em is not null then 'em_rota'
           when coalesce(i.total_unidades, 0) > 0 and coalesce(u.prontas, 0) >= i.total_unidades then 'aguardo'
           when coalesce(u.liberadas, 0) > 0 then 'producao'
           -- D-132: o Tiny já levou adiante e nada foi liberado — segue o Tiny.
           when plt_privado.fn_tiny_tirou_do_pcp(nu.situacao) then 'tiny'
           else 'pcp'
         end                                     as situacao_plataforma,
         ent.ocorrido_em                         as entregue_em,
         ue.nome                                 as entregue_por,
         case when ent.id is null then null
              else coalesce(ent.dados ->> 'fonte', case when ent.usuario_id is null then 'tiny' else 'plataforma' end)
         end                                     as entregue_fonte,
         nu.entregue_tiny,
         canc.ocorrido_em                        as cancelado_em,
         (select count(*) from pagina) > (select limite from cfg) as tem_mais,
         case when p_antes_numero is null then (
           select count(*)::int from (
             select 1
               from public.pedidos p2
               left join public.clientes c2 on c2.id = p2.cliente_id
               cross join cfg
              where (not coalesce(p_cancelados, false)
                     or plt_privado.fn_situacao_normalizada(p2.situacao) = 'cancelado')
                and (cfg.busca is null
                     or p2.numero::text like cfg.busca || '%'
                     or c2.nome ilike '%' || cfg.busca || '%'
                     or p2.vendedor ilike '%' || cfg.busca || '%')
              limit 10001) x
         ) end                                   as contagem_total
    from numerada nu
    left join public.plt_cards pc on pc.pedido_id = nu.id and pc.tipo = 'pedido'
    left join public.plt_eventos ent on ent.id = pc.entrega_evento_id
    left join public.plt_usuarios ue on ue.id = ent.usuario_id
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
    ) u on true
   where nu.n <= (select limite from cfg)
   order by nu.numero desc;
$$;

comment on function public.plt_fn_pedidos_lista(text, integer, integer, boolean) is
  'D-134 (14/10): Pedidos → Todos os pedidos (e Cancelados, p_cancelados) — por cursor (número < p_antes_numero), 20 por vez; a linha: cliente, valor, quem vendeu, marcadores, situação no Tiny e na plataforma (+ "tiny": o Tiny levou adiante sem nada liberado — D-132), peças liberadas/prontas, entregue em/por/fonte, cancelado em. Total só na 1ª página (até 10.001). Gate da logística.';

-- ----------------------------------------------------------------------------
-- 2 · A produção do pedido (no clique)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_pedido_producao(p_pedido_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_card_pedido bigint;
  v_ids         bigint[];
  v_resultado   jsonb;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'A produção do pedido é da logística (PCP, fins de linha) e do admin.'
      using errcode = 'insufficient_privilege';
  end if;

  select c.id into v_card_pedido from public.plt_cards c where c.pedido_id = p_pedido_id and c.tipo = 'pedido';
  -- As peças do pedido — também as que o cancelamento deixou sem dono (card_pai).
  select coalesce(array_agg(c.id order by c.item_seq, c.indice_unidade, c.id), '{}')
    into v_ids
    from public.plt_cards c
   where c.tipo = 'unidade'
     and (c.pedido_id = p_pedido_id or (v_card_pedido is not null and c.card_pai_id = v_card_pedido));

  with execucoes as (
    select x.card_id, x.iniciou_em, x.finalizou_em, x.em_andamento,
           extract(epoch from coalesce(x.duracao, interval '0'))::bigint     as segundos,
           extract(epoch from coalesce(x.pausa_total, interval '0'))::bigint as pausa_segundos,
           s.nome as setor, e.nome as etapa,
           coalesce(ui.nome, uf.nome) as pessoa,
           coalesce(x.usuario_inicio_id, x.usuario_fim_id) as pessoa_id
      from public.plt_vw_execucoes x
      left join public.plt_setores s on s.id = x.setor_id
      left join public.plt_etapas  e on e.id = x.etapa_id
      left join public.plt_usuarios ui on ui.id = x.usuario_inicio_id
      left join public.plt_usuarios uf on uf.id = x.usuario_fim_id
     where x.card_id = any(v_ids)
  ),
  saidas as (
    select distinct on (ev.card_id) ev.card_id, ev.dados ->> 'motivo' as motivo
      from public.plt_eventos ev
     where ev.card_id = any(v_ids) and ev.tipo = 'card_arquivado'
     order by ev.card_id, ev.id desc
  ),
  pecas as (
    select c.id, c.item_seq, c.item_codigo, c.item_descricao, c.indice_unidade, c.total_unidades,
           c.concluido_em, c.arquivado_em, c.qualidade_atual, c.pedido_id is null as perdeu_pedido,
           s.nome as setor, s.papel_no_fluxo, e.nome as etapa, c.desde, sa.motivo as motivo_saida,
           coalesce((select jsonb_agg(jsonb_build_object(
                       'setor', x.setor, 'etapa', x.etapa, 'pessoa', x.pessoa,
                       'iniciou_em', x.iniciou_em, 'finalizou_em', x.finalizou_em,
                       'em_andamento', x.em_andamento, 'segundos', x.segundos,
                       'pausa_segundos', x.pausa_segundos) order by x.iniciou_em)
                       from execucoes x where x.card_id = c.id), '[]'::jsonb) as execucoes,
           coalesce((select sum(x.segundos) from execucoes x where x.card_id = c.id), 0)::bigint as segundos
      from public.plt_cards c
      left join public.plt_setores s on s.id = c.setor_atual_id
      left join public.plt_etapas  e on e.id = c.etapa_atual_id
      left join saidas sa on sa.card_id = c.id
     where c.id = any(v_ids)
  )
  select jsonb_build_object(
    'pecas', coalesce((select jsonb_agg(jsonb_build_object(
                'card_id', p.id, 'item_seq', p.item_seq, 'codigo', p.item_codigo,
                'descricao', p.item_descricao, 'indice', p.indice_unidade, 'total', p.total_unidades,
                'setor', p.setor, 'etapa', p.etapa, 'no_fim_de_linha', p.papel_no_fluxo = 'terminal',
                'desde', p.desde, 'concluido_em', p.concluido_em, 'arquivado_em', p.arquivado_em,
                'motivo_saida', p.motivo_saida, 'qualidade', p.qualidade_atual,
                'perdeu_pedido', p.perdeu_pedido, 'segundos', p.segundos, 'execucoes', p.execucoes)
              order by p.item_seq, p.indice_unidade, p.id) from pecas p), '[]'::jsonb),
    'pessoas', coalesce((select jsonb_agg(jsonb_build_object('nome', t.pessoa, 'segundos', t.segundos,
                                                             'execucoes', t.execucoes)
                                          order by t.segundos desc)
                           from (select x.pessoa, sum(x.segundos)::bigint as segundos, count(*)::int as execucoes
                                   from execucoes x where x.pessoa is not null group by x.pessoa) t), '[]'::jsonb),
    'segundos', coalesce((select sum(x.segundos) from execucoes x), 0)::bigint
  ) into v_resultado;
  return v_resultado;
end;
$$;

comment on function public.plt_fn_pedido_producao(bigint) is
  'D-134 (14/10): a produção do pedido, no clique — cada peça (também as que o cancelamento deixou sem dono, pelo card_pai), onde está ou como saiu, e cada execução (setor, etapa, quem, início, fim, segundos com as pausas descontadas); o resumo por pessoa e o total. Gate da logística.';

-- ----------------------------------------------------------------------------
-- 3 · Tudo o que o Tiny mandou do pedido (no clique)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_pedido_tiny(p_pedido_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_resultado jsonb;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Os dados do Tiny do pedido são da logística (PCP, fins de linha) e do admin.'
      using errcode = 'insufficient_privilege';
  end if;
  select jsonb_build_object(
           'pedido', p.raw,
           'atualizado_em', p.atualizado_em,
           'cliente', c.raw,
           'notas_fiscais', coalesce((select jsonb_agg(nf.raw order by nf.data_emissao, nf.id)
                                        from public.notas_fiscais nf where nf.pedido_id = p.id), '[]'::jsonb),
           'contas_receber', coalesce((select jsonb_agg(cr.raw order by cr.data_vencimento, cr.id)
                                         from public.contas_receber cr where cr.pedido_id = p.id), '[]'::jsonb))
    into v_resultado
    from public.pedidos p
    left join public.clientes c on c.id = p.cliente_id
   where p.id = p_pedido_id;
  if v_resultado is null then
    raise exception 'Pedido % não existe.', p_pedido_id using errcode = 'no_data_found';
  end if;
  return v_resultado;
end;
$$;

comment on function public.plt_fn_pedido_tiny(bigint) is
  'D-134 (14/10): no clique em "Dados do Tiny" — o registro inteiro que o Tiny mandou do pedido, do cliente, das notas fiscais e das contas a receber. Gate da logística.';

-- ----------------------------------------------------------------------------
-- 4 · Quem chama o quê
-- ----------------------------------------------------------------------------
revoke all on function public.plt_fn_pedidos_lista(text, integer, integer, boolean) from public, anon;
revoke all on function public.plt_fn_pedido_producao(bigint)                        from public, anon;
revoke all on function public.plt_fn_pedido_tiny(bigint)                            from public, anon;
grant execute on function public.plt_fn_pedidos_lista(text, integer, integer, boolean) to authenticated;
grant execute on function public.plt_fn_pedido_producao(bigint)                        to authenticated;
grant execute on function public.plt_fn_pedido_tiny(bigint)                            to authenticated;
