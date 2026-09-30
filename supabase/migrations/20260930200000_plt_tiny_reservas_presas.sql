-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 46 — AS RESERVAS PRESAS DO TINY
-- Ajuste pedido pelo dono em 2026-09-30 (conversa) · ↪️ D-76 / RF-108
--
-- O "disponível multiempresa" que a equipe olha no Tiny é saldo − reservado, e
-- o reservado do Tiny guarda reserva de pedido que já saiu (567: 23 reservadas,
-- nenhum pedido aberto → disponível −21). O líder da logística já limpou
-- algumas no balanço de 29/09 (327: 44 → 0; 174: 17 → 0). O dono pediu a
-- lista para a equipe terminar a limpeza NO TINY: por produto acabado, o que
-- o Tiny reserva × as unidades de pedidos ainda abertos no banco.
--
-- Uma porta de leitura só (paginada no servidor — regra 17), a partir da
-- leitura mais nova do Tiny que traz o reservado (a leitura da fila ou a
-- carga). Nada muda em nenhuma tabela nem em função existente.
-- ============================================================================

create or replace function public.plt_fn_tiny_reservas_presas(
  p_limite       integer default 10,
  p_deslocamento integer default 0
)
returns table (
  tiny_id         bigint,
  codigo          text,
  descricao       text,
  saldo_tiny      numeric,
  reservado_tiny  numeric,
  pedidos_abertos numeric,
  presas          numeric,
  lido_em         timestamptz,
  contagem_total  bigint,
  total_presas    numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with leituras as (
    -- a leitura mais nova que traz o reservado (leitura da fila ou carga)
    select distinct on (x.tiny_id) x.*
      from (
        select (e.payload -> 'dados' ->> 'idProduto')::bigint                         as tiny_id,
               plt_privado.fn_tiny_numero(e.payload -> 'dados' ->> 'saldo')           as saldo,
               plt_privado.fn_tiny_numero(e.payload -> 'dados' ->> 'saldoReservado')  as reservado,
               e.recebido_em,
               e.id
          from public.eventos e
         where e.tipo = 'estoque_fabrica'
           and e.payload ->> 'cnpj' = '27556613000166'
           and e.payload ->> 'origem' in ('leitura', 'carga_inicial')
           and (e.payload -> 'dados' ->> 'idProduto') ~ '^[0-9]+$'
      ) x
     where x.reservado is not null
     order by x.tiny_id, x.id desc
  ),
  abertos as (
    -- unidades de pedidos da loja que ainda não saíram (o que o Tiny DEVIA reservar)
    select pi.codigo, sum(pi.quantidade) as quantidade
      from public.pedidos p
      join public.pedido_itens pi on pi.pedido_id = p.id
     where plt_privado.fn_situacao_normalizada(p.situacao) not in ('entregue', 'nao_entregue', 'cancelado')
       and not plt_privado.fn_eh_personalizado(pi.descricao)
       and pi.codigo is not null
     group by pi.codigo
  ),
  presas as (
    select pr.tiny_id, pr.codigo, pr.descricao, l.saldo, l.reservado,
           coalesce(a.quantidade, 0)               as abertos,
           l.reservado - coalesce(a.quantidade, 0) as presas,
           l.recebido_em
      from leituras l
      join public.produtos pr on pr.tiny_id = l.tiny_id
      left join abertos a on a.codigo = pr.codigo
     where pr.situacao = 'A'
       and coalesce(pr.classe, '') in ('F', 'S', 'V')
       and not plt_privado.fn_eh_personalizado(pr.descricao)
       -- serviço do Tiny (Corte, Furo, Fitamento…) não é móvel: a reserva
       -- dele não mexe no disponível que a equipe olha (achado na 1ª leitura
       -- real: 8 serviços com 22 mil "reservas")
       and coalesce(pr.raw ->> 'tipo', 'P') <> 'S'
       -- sem SKU não dá para comparar com os pedidos (o pedido chega por SKU)
       and pr.codigo is not null
       and l.reservado > coalesce(a.quantidade, 0)
  )
  select p.tiny_id, p.codigo, p.descricao, p.saldo, p.reservado, p.abertos, p.presas, p.recebido_em,
         count(*) over (), sum(p.presas) over ()
    from presas p
   where plt_privado.fn_pode_ver_expedicao()
   order by p.presas desc, p.codigo nulls last, p.tiny_id
   limit least(greatest(coalesce(p_limite, 10), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_tiny_reservas_presas(integer, integer) is
  'Reservas presas no Tiny (↪️ D-76): por produto acabado, o que o Tiny reserva (leitura mais nova) × as unidades de pedidos da loja ainda abertos no banco — a sobra é reserva de pedido que já saiu e derruba o "disponível multiempresa". Para a equipe limpar NO TINY. Paginada; gate da logística.';

revoke all on function public.plt_fn_tiny_reservas_presas(integer, integer) from public, anon;
grant execute on function public.plt_fn_tiny_reservas_presas(integer, integer) to authenticated;
