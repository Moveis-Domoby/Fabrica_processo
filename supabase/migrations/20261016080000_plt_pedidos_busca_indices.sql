-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 83 — PEDIDOS: A BUSCA POR NOME E OS
-- CANCELADOS PELO ÍNDICE (SESSAO-32 · §1.6 · dívida 17 da lei · D-138: "Pode
-- aplicar" — o dono, 16/10/2026)
--
-- 1. pg_trgm (extensão oficial do Postgres, no esquema extensions) e 3 índices
--    nas tabelas da INTEGRAÇÃO (só índice: nenhuma coluna, nenhum dado muda —
--    o n8n grava igual): cancelados (parcial, por número), trigramas no nome do
--    cliente e no vendedor do pedido. Em produção foram criados ANTES, com
--    CREATE INDEX CONCURRENTLY (sem travar); aqui ficam com IF NOT EXISTS para a
--    reaplicação e a bateria.
-- 2. A porta da lista (plt_fn_pedidos_lista) por caminhos: todos pelo número;
--    cancelados só entre os cancelados (o índice parcial); busca: primeiro os
--    5.000 pedidos mais recentes do jeito de sempre (termo comum para cedo) e,
--    se a página não encher (termo raro), número que começa com o texto (faixas
--    — o índice do número) ∪ clientes cujo nome contém (trigramas) ∪ vendedor
--    que contém (trigramas). Mesmo resultado — bloco 83 da bateria e banco real
--    numa transação desfeita (9 casos com páginas seguintes, 325 linhas, 0
--    diferença). Ensaio ×100 local: busca de um cliente 5,6 s → ~45 ms; total
--    dos Cancelados 2,8 s → 11 ms; termo comum igual.
-- ============================================================================

create extension if not exists pg_trgm with schema extensions;

set local lock_timeout = '5s';

create index if not exists pedidos_cancelados_numero_idx
  on public.pedidos (numero desc)
  where plt_privado.fn_situacao_normalizada(situacao) = 'cancelado';

create index if not exists clientes_nome_trgm_idx
  on public.clientes using gin (nome extensions.gin_trgm_ops);

create index if not exists pedidos_vendedor_trgm_idx
  on public.pedidos using gin (vendedor extensions.gin_trgm_ops);

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
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
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
      select p.id, p.numero from public.pedidos p
       where (p_antes_numero is null or p.numero < p_antes_numero)
       order by p.numero desc limit v_lim + 1) x;
  elsif v_busca is null then
    select coalesce(array_agg(x.id order by x.numero desc), '{}') into v_ids from (
      select p.id, p.numero from public.pedidos p
       where plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado'
         and (p_antes_numero is null or p.numero < p_antes_numero)
       order by p.numero desc limit v_lim + 1) x;
  else
    -- 1ª tentativa: só os 5.000 números mais recentes, do jeito de sempre (o
    -- filtro com OU, parando na página cheia) — termo COMUM acha a página aí e
    -- para cedo. Achou a página inteira (limite + 1) → é exatamente a de antes:
    -- qualquer outro pedido que case tem número menor que todos da janela.
    v_teto := coalesce(p_antes_numero, (select max(pm.numero) from public.pedidos pm) + 1);
    select coalesce(array_agg(x.id order by x.numero desc), '{}') into v_ids from (
      select p.id, p.numero
        from public.pedidos p
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
                join public.pedidos p1
                  on p1.numero >= v_num * (10::bigint ^ k.e)::bigint
                 and p1.numero <  (v_num + 1) * (10::bigint ^ k.e)::bigint
               where v_num is not null
              union
              select p2.id from public.clientes c2 join public.pedidos p2 on p2.cliente_id = c2.id
               where c2.nome ilike '%' || v_busca || '%'
              union
              select p3.id from public.pedidos p3 where p3.vendedor ilike '%' || v_busca || '%') alvo
        join public.pedidos p on p.id = alvo.id
       where (not v_canc or plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado')
         and (p_antes_numero is null or p.numero < p_antes_numero)
       order by p.numero desc limit v_lim + 1) x;
  end if;

  -- 2 · o total, só na 1ª página (até 10.001), pelo mesmo caminho
  if p_antes_numero is null then
    if v_busca is null and not v_canc then
      select count(*)::int into v_total from (select 1 from public.pedidos p limit 10001) x;
    elsif v_busca is null then
      select count(*)::int into v_total from (
        select 1 from public.pedidos p
         where plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado' limit 10001) x;
    else
      select count(*)::int into v_total from (
        select 1
          from (select p1.id
                  from generate_series(0, greatest(0, 10 - length(v_busca))) as k(e)
                  join public.pedidos p1
                    on p1.numero >= v_num * (10::bigint ^ k.e)::bigint
                   and p1.numero <  (v_num + 1) * (10::bigint ^ k.e)::bigint
                 where v_num is not null
                union
                select p2.id from public.clientes c2 join public.pedidos p2 on p2.cliente_id = c2.id
                 where c2.nome ilike '%' || v_busca || '%'
                union
                select p3.id from public.pedidos p3 where p3.vendedor ilike '%' || v_busca || '%') alvo
          join public.pedidos p on p.id = alvo.id
         where (not v_canc or plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado')
         limit 10001) x;
    end if;
  end if;

  -- 3 · o que cada linha mostra — a projeção de sempre, sobre a página achada
  return query
  with pagina as (
    select p.id, p.numero, p.cliente_id, p.data_pedido, p.data_prevista, p.situacao,
           p.total_pedido, p.vendedor, p.marcadores, nullif(p.raw ->> 'data_entrega', '') as entregue_tiny,
           c.nome as cliente_nome
      from unnest(v_ids) with ordinality as u(id, ord)
      join public.pedidos p on p.id = u.id
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
         (select count(*) from pagina) > v_lim       as tem_mais,
         v_total                                 as contagem_total
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
   where nu.n <= v_lim
   order by nu.numero desc;
end;
$$;

comment on function public.plt_fn_pedidos_lista(text, integer, integer, boolean) is
  'D-134 · SESSAO-32: Pedidos → Todos os pedidos (e Cancelados, p_cancelados) — por cursor (número < p_antes_numero), 20 por vez; a página é achada por um caminho por caso (todos pelo número; cancelados só entre os cancelados; busca: número que começa com o texto ∪ clientes cujo nome contém ∪ vendedor que contém) — o jeito que os índices propostos (pendentes, OK do dono) conseguem usar. Mesmo resultado de antes. Total só na 1ª página (até 10.001). Gate da logística.';
