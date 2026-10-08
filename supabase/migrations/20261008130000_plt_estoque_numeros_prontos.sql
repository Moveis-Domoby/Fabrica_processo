-- ============================================================================
-- Migration 57 · Os números do estoque PRONTOS no banco (projeção por produto)
-- + "reservado em venda" até a ENTREGA + as correções 1, 2, 5 e 6 do raio-x
-- (SESSAO-30, etapa 2 — D-118, Q-72, regra 18)
-- ============================================================================
-- Por quê: as portas do estoque contavam TUDO a cada abertura de tela
-- (cards, pedidos, itens e 5 mil leituras do Tiny com JSON) — 1,1 a 1,6 s com
-- só 4 mil cards (máx. 3,9 s). A lei de desempenho manda: leitura pesada e
-- repetida vira PROJEÇÃO mantida no mesmo gesto (M-13), e a projeção é a
-- única fonte dos números (M-04).
--
-- O que nasce:
--   1. public.plt_estoque_numeros — UMA linha por produto: peças livres no
--      ESTOQUE, reservadas pela venda, prontas de pedido (aguardo + ROTAS até
--      a entrega — D-118), em produção sem dono e de pedido; vendas de 90
--      dias, cortes e a posição no ranking; a última leitura do Tiny.
--   2. A regra ÚNICA da peça (M-04, raio-x 5): fn_estoque_produto_da_peca (de
--      que produto ela é) + fn_estoque_categoria (em que número ela entra).
--      O gatilho de plt_cards soma/subtrai no mesmo gesto (por comando, com
--      as tabelas de transição); a recontagem completa usa as MESMAS regras.
--   3. A recontagem completa (deriva corrigida) e as vendas de 90 dias rodam
--      na rotina de madrugada que já existia (plt-estoque-minimos, 04:40) e a
--      cada troca de Top X / cobertura / corte. ↩️ Até aqui o ranking mudava
--      a cada venda; passa a ser o da madrugada, como o mínimo automático já
--      era (D-119).
--   4. A leitura do Tiny entra na linha do produto no mesmo gesto que a grava
--      (as duas portas do n8n recriadas — só com a linha nova).
--   5. As portas e as regras do estoque passam a ler a projeção (mesma forma).
--   6. Raio-x: (1) a chegada aos fins de linha vale para TODA origem e também
--      para card criado direto lá; (2) peça livre do ESTOQUE só sai pela baixa
--      do estoque (a maquinaria liga a marca); (5) uma regra só — resumo = a
--      soma da lista; (6) peça personalizada livre ganha lista e baixa.
--
-- Nenhuma tabela da integração é tocada. Reaplicável.
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · A projeção
-- ----------------------------------------------------------------------------
create table if not exists public.plt_estoque_numeros (
  produto_tiny_id     bigint primary key references public.produtos (tiny_id),
  livres              integer not null default 0,
  reservadas_estoque  integer not null default 0,
  prontas_pedido      integer not null default 0,
  producao_sem_dono   integer not null default 0,
  producao_de_pedido  integer not null default 0,
  vendidos_90d        numeric not null default 0,
  cortes_90d          integer not null default 0,
  posicao             integer,
  vendas_em           timestamptz,
  saldo_tiny          numeric,
  reservado_tiny      numeric,
  lido_em             timestamptz,
  origem_leitura      text,
  evento_leitura_id   bigint,
  atualizado_em       timestamptz not null default now()
);

comment on table public.plt_estoque_numeros is
  'SESSAO-30 (regra 18, D-118): os números do estoque PRONTOS, uma linha por produto — mantidos no mesmo gesto (gatilho de plt_cards, leitura do Tiny) e recontados de madrugada. As portas do estoque leem só daqui (M-04). Escrita só pela maquinaria.';
comment on column public.plt_estoque_numeros.prontas_pedido is
  'D-118: unidades de pedido prontas — em Pedidos em aguardo e nas ROTAS (programadas, no caminhão) até a entrega. Com as reservadas_estoque, é o "reservados em venda".';
comment on column public.plt_estoque_numeros.posicao is
  'Posição no ranking das vendas de 90 dias (com o corte de pedido grande — D-84); nula = não vendeu. Recalculada de madrugada e a cada troca de Top X/cobertura/corte (D-119).';

alter table public.plt_estoque_numeros enable row level security;
revoke all on table public.plt_estoque_numeros from anon, authenticated;

-- Índices das contas por produto (só o que está vivo — regra 18 §7.2).
create index if not exists plt_cards_unidade_livre_produto_idx
  on public.plt_cards (produto_tiny_id)
  where tipo = 'unidade' and arquivado_em is null and pedido_id is null;
create index if not exists plt_cards_unidade_pedido_sku_idx
  on public.plt_cards (item_codigo)
  where tipo = 'unidade' and arquivado_em is null and pedido_id is not null;
create index if not exists plt_estoque_numeros_posicao_idx
  on public.plt_estoque_numeros (posicao) where posicao is not null;

-- ----------------------------------------------------------------------------
-- 2 · A regra única da peça (M-04 — raio-x 5)
-- ----------------------------------------------------------------------------

-- De que produto do catálogo a peça é: a sem pedido, pelo produto dela; a de
-- pedido, pelo SKU do item (o produto ativo de menor id — fn_produto_do_item).
-- Personalizada não é o produto do catálogo (fn_eh_personalizado).
create or replace function plt_privado.fn_estoque_produto_da_peca(
  p_pedido_id bigint, p_produto bigint, p_codigo text, p_descricao text)
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
           when plt_privado.fn_eh_personalizado(p_descricao) then null
           when p_pedido_id is null then p_produto
           else plt_privado.fn_produto_do_item(p_codigo, p_descricao)
         end;
$$;

-- Em que número a peça entra (nulo = em nenhum).
create or replace function plt_privado.fn_estoque_categoria(
  p_pedido_id bigint, p_reservada_pedido_id bigint, p_concluido_em timestamptz,
  p_arquivado_em timestamptz, p_setor_codigo text, p_setor_papel text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
           when p_arquivado_em is not null then null
           when p_pedido_id is null and p_setor_codigo = 'estoque'
             then case when p_reservada_pedido_id is null then 'livre' else 'reservada_estoque' end
           -- pronta de pedido = num fim de linha (aguardo; ROTAS até a entrega — D-118;
           -- o ESTOQUE só tem peça de pedido no legado de antes da D-58)
           when p_pedido_id is not null and p_setor_papel = 'terminal' then 'pronta_pedido'
           when p_concluido_em is null and p_setor_papel is distinct from 'terminal'
             then case when p_pedido_id is null then 'producao_sem_dono' else 'producao_de_pedido' end
         end;
$$;

-- A contagem AO VIVO de um produto pelas mesmas regras (usada pela baixa e
-- pela contagem sob a trava do produto, e pela conferência).
create or replace function plt_privado.fn_estoque_contar(p_produto bigint)
returns table (livres integer, reservadas_estoque integer, prontas_pedido integer,
               producao_sem_dono integer, producao_de_pedido integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with dono as (
    select pr.codigo
      from public.produtos pr
     where pr.tiny_id = p_produto
       and pr.codigo is not null
       and pr.tiny_id = (select min(p2.tiny_id) from public.produtos p2
                          where p2.codigo = pr.codigo and p2.situacao = 'A')
  ),
  pecas as (
    select c.pedido_id, c.reservada_pedido_id, c.concluido_em, c.arquivado_em, c.setor_atual_id
      from public.plt_cards c
     where c.tipo = 'unidade' and c.arquivado_em is null and c.pedido_id is null
       and c.produto_tiny_id = p_produto
       and not plt_privado.fn_eh_personalizado(c.item_descricao)
    union all
    select c.pedido_id, c.reservada_pedido_id, c.concluido_em, c.arquivado_em, c.setor_atual_id
      from public.plt_cards c, dono d
     where c.tipo = 'unidade' and c.arquivado_em is null and c.pedido_id is not null
       and c.item_codigo = d.codigo
       and not plt_privado.fn_eh_personalizado(c.item_descricao)
  ),
  cat as (
    select plt_privado.fn_estoque_categoria(p.pedido_id, p.reservada_pedido_id, p.concluido_em,
                                            p.arquivado_em, s.codigo, s.papel_no_fluxo) as categoria
      from pecas p left join public.plt_setores s on s.id = p.setor_atual_id
  )
  select count(*) filter (where categoria = 'livre')::int,
         count(*) filter (where categoria = 'reservada_estoque')::int,
         count(*) filter (where categoria = 'pronta_pedido')::int,
         count(*) filter (where categoria = 'producao_sem_dono')::int,
         count(*) filter (where categoria = 'producao_de_pedido')::int
    from cat;
$$;

-- As peças no ESTOQUE de um produto (recriada da 42 — mesma forma): a mesma
-- regra da projeção (livres × reservadas pela venda), contada ao vivo.
create or replace function plt_privado.fn_estoque_pecas(p_produto_tiny_id bigint)
returns table (livres integer, reservadas integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select x.livres, x.reservadas_estoque from plt_privado.fn_estoque_contar(p_produto_tiny_id) x;
$$;

-- ----------------------------------------------------------------------------
-- 3 · O gatilho: cada mudança de peça soma/subtrai no número do produto, no
--     MESMO gesto. Por comando (tabelas de transição): a peça que mudou de
--     número sai de um (-1) e entra no outro (+1); a que não mudou se anula.
--     Atualização por soma: concorrência segura (a linha do produto é travada
--     só no instante da soma; a ordem pelo id evita impasse).
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_estoque_numeros_cards()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.plt_estoque_numeros as n
        (produto_tiny_id, livres, reservadas_estoque, prontas_pedido, producao_sem_dono, producao_de_pedido, atualizado_em)
    select x.produto,
           coalesce(sum(x.d) filter (where x.categoria = 'livre'), 0),
           coalesce(sum(x.d) filter (where x.categoria = 'reservada_estoque'), 0),
           coalesce(sum(x.d) filter (where x.categoria = 'pronta_pedido'), 0),
           coalesce(sum(x.d) filter (where x.categoria = 'producao_sem_dono'), 0),
           coalesce(sum(x.d) filter (where x.categoria = 'producao_de_pedido'), 0),
           now()
      from (select plt_privado.fn_estoque_produto_da_peca(c.pedido_id, c.produto_tiny_id, c.item_codigo, c.item_descricao) as produto,
                   plt_privado.fn_estoque_categoria(c.pedido_id, c.reservada_pedido_id, c.concluido_em, c.arquivado_em,
                                                    s.codigo, s.papel_no_fluxo) as categoria,
                   1 as d
              from novos c left join public.plt_setores s on s.id = c.setor_atual_id
             where c.tipo = 'unidade') x
     where x.produto is not null and x.categoria is not null
     group by x.produto
     order by x.produto
    on conflict (produto_tiny_id) do update
       set livres             = n.livres             + excluded.livres,
           reservadas_estoque = n.reservadas_estoque + excluded.reservadas_estoque,
           prontas_pedido     = n.prontas_pedido     + excluded.prontas_pedido,
           producao_sem_dono  = n.producao_sem_dono  + excluded.producao_sem_dono,
           producao_de_pedido = n.producao_de_pedido + excluded.producao_de_pedido,
           atualizado_em      = now();

  elsif tg_op = 'DELETE' then
    insert into public.plt_estoque_numeros as n
        (produto_tiny_id, livres, reservadas_estoque, prontas_pedido, producao_sem_dono, producao_de_pedido, atualizado_em)
    select x.produto,
           coalesce(sum(x.d) filter (where x.categoria = 'livre'), 0),
           coalesce(sum(x.d) filter (where x.categoria = 'reservada_estoque'), 0),
           coalesce(sum(x.d) filter (where x.categoria = 'pronta_pedido'), 0),
           coalesce(sum(x.d) filter (where x.categoria = 'producao_sem_dono'), 0),
           coalesce(sum(x.d) filter (where x.categoria = 'producao_de_pedido'), 0),
           now()
      from (select plt_privado.fn_estoque_produto_da_peca(c.pedido_id, c.produto_tiny_id, c.item_codigo, c.item_descricao) as produto,
                   plt_privado.fn_estoque_categoria(c.pedido_id, c.reservada_pedido_id, c.concluido_em, c.arquivado_em,
                                                    s.codigo, s.papel_no_fluxo) as categoria,
                   -1 as d
              from velhos c left join public.plt_setores s on s.id = c.setor_atual_id
             where c.tipo = 'unidade') x
     where x.produto is not null and x.categoria is not null
     group by x.produto
     order by x.produto
    on conflict (produto_tiny_id) do update
       set livres             = n.livres             + excluded.livres,
           reservadas_estoque = n.reservadas_estoque + excluded.reservadas_estoque,
           prontas_pedido     = n.prontas_pedido     + excluded.prontas_pedido,
           producao_sem_dono  = n.producao_sem_dono  + excluded.producao_sem_dono,
           producao_de_pedido = n.producao_de_pedido + excluded.producao_de_pedido,
           atualizado_em      = now();

  else
    insert into public.plt_estoque_numeros as n
        (produto_tiny_id, livres, reservadas_estoque, prontas_pedido, producao_sem_dono, producao_de_pedido, atualizado_em)
    select x.produto,
           coalesce(sum(x.d) filter (where x.categoria = 'livre'), 0),
           coalesce(sum(x.d) filter (where x.categoria = 'reservada_estoque'), 0),
           coalesce(sum(x.d) filter (where x.categoria = 'pronta_pedido'), 0),
           coalesce(sum(x.d) filter (where x.categoria = 'producao_sem_dono'), 0),
           coalesce(sum(x.d) filter (where x.categoria = 'producao_de_pedido'), 0),
           now()
      from (select plt_privado.fn_estoque_produto_da_peca(c.pedido_id, c.produto_tiny_id, c.item_codigo, c.item_descricao) as produto,
                   plt_privado.fn_estoque_categoria(c.pedido_id, c.reservada_pedido_id, c.concluido_em, c.arquivado_em,
                                                    s.codigo, s.papel_no_fluxo) as categoria,
                   1 as d
              from novos c left join public.plt_setores s on s.id = c.setor_atual_id
             where c.tipo = 'unidade'
            union all
            select plt_privado.fn_estoque_produto_da_peca(c.pedido_id, c.produto_tiny_id, c.item_codigo, c.item_descricao),
                   plt_privado.fn_estoque_categoria(c.pedido_id, c.reservada_pedido_id, c.concluido_em, c.arquivado_em,
                                                    s.codigo, s.papel_no_fluxo),
                   -1
              from velhos c left join public.plt_setores s on s.id = c.setor_atual_id
             where c.tipo = 'unidade') x
     where x.produto is not null and x.categoria is not null
     group by x.produto
    having coalesce(sum(x.d) filter (where x.categoria = 'livre'), 0) <> 0
        or coalesce(sum(x.d) filter (where x.categoria = 'reservada_estoque'), 0) <> 0
        or coalesce(sum(x.d) filter (where x.categoria = 'pronta_pedido'), 0) <> 0
        or coalesce(sum(x.d) filter (where x.categoria = 'producao_sem_dono'), 0) <> 0
        or coalesce(sum(x.d) filter (where x.categoria = 'producao_de_pedido'), 0) <> 0
     order by x.produto
    on conflict (produto_tiny_id) do update
       set livres             = n.livres             + excluded.livres,
           reservadas_estoque = n.reservadas_estoque + excluded.reservadas_estoque,
           prontas_pedido     = n.prontas_pedido     + excluded.prontas_pedido,
           producao_sem_dono  = n.producao_sem_dono  + excluded.producao_sem_dono,
           producao_de_pedido = n.producao_de_pedido + excluded.producao_de_pedido,
           atualizado_em      = now();
  end if;
  return null;
end;
$$;

drop trigger if exists plt_cards_estoque_numeros_ins on public.plt_cards;
create trigger plt_cards_estoque_numeros_ins
  after insert on public.plt_cards
  referencing new table as novos
  for each statement execute function plt_privado.fn_estoque_numeros_cards();
drop trigger if exists plt_cards_estoque_numeros_upd on public.plt_cards;
create trigger plt_cards_estoque_numeros_upd
  after update on public.plt_cards
  referencing old table as velhos new table as novos
  for each statement execute function plt_privado.fn_estoque_numeros_cards();
drop trigger if exists plt_cards_estoque_numeros_del on public.plt_cards;
create trigger plt_cards_estoque_numeros_del
  after delete on public.plt_cards
  referencing old table as velhos
  for each statement execute function plt_privado.fn_estoque_numeros_cards();

-- ----------------------------------------------------------------------------
-- 4 · A recontagem completa (as MESMAS regras) — devolve quantos produtos
--     estavam com o número errado (deriva corrigida). Trava a projeção em modo
--     exclusivo: as telas seguem lendo; quem soma espera os milissegundos dela.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_estoque_numeros_recontar()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer;
begin
  lock table public.plt_estoque_numeros in exclusive mode;
  insert into public.plt_estoque_numeros (produto_tiny_id)
  select pr.tiny_id from public.produtos pr
  on conflict (produto_tiny_id) do nothing;

  with contagem as (
    select x.produto,
           count(*) filter (where x.categoria = 'livre')::int              as livres,
           count(*) filter (where x.categoria = 'reservada_estoque')::int  as reservadas_estoque,
           count(*) filter (where x.categoria = 'pronta_pedido')::int      as prontas_pedido,
           count(*) filter (where x.categoria = 'producao_sem_dono')::int  as producao_sem_dono,
           count(*) filter (where x.categoria = 'producao_de_pedido')::int as producao_de_pedido
      from (select plt_privado.fn_estoque_produto_da_peca(c.pedido_id, c.produto_tiny_id, c.item_codigo, c.item_descricao) as produto,
                   plt_privado.fn_estoque_categoria(c.pedido_id, c.reservada_pedido_id, c.concluido_em, c.arquivado_em,
                                                    s.codigo, s.papel_no_fluxo) as categoria
              from public.plt_cards c
              left join public.plt_setores s on s.id = c.setor_atual_id
             where c.tipo = 'unidade' and c.arquivado_em is null) x
     where x.produto is not null and x.categoria is not null
     group by x.produto
  ),
  alvo as (
    select n.produto_tiny_id,
           coalesce(c.livres, 0) as livres, coalesce(c.reservadas_estoque, 0) as reservadas_estoque,
           coalesce(c.prontas_pedido, 0) as prontas_pedido, coalesce(c.producao_sem_dono, 0) as producao_sem_dono,
           coalesce(c.producao_de_pedido, 0) as producao_de_pedido
      from public.plt_estoque_numeros n
      left join contagem c on c.produto = n.produto_tiny_id
  )
  update public.plt_estoque_numeros n
     set livres = a.livres, reservadas_estoque = a.reservadas_estoque, prontas_pedido = a.prontas_pedido,
         producao_sem_dono = a.producao_sem_dono, producao_de_pedido = a.producao_de_pedido,
         atualizado_em = now()
    from alvo a
   where n.produto_tiny_id = a.produto_tiny_id
     and (n.livres, n.reservadas_estoque, n.prontas_pedido, n.producao_sem_dono, n.producao_de_pedido)
         is distinct from (a.livres, a.reservadas_estoque, a.prontas_pedido, a.producao_sem_dono, a.producao_de_pedido);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

comment on function plt_privado.fn_estoque_numeros_recontar() is
  'SESSAO-30: recontagem completa dos números das peças pelas MESMAS regras do gatilho (fn_estoque_produto_da_peca + fn_estoque_categoria). Devolve quantos produtos estavam diferentes. Roda de madrugada (fn_recalcular_minimos) e na aplicação.';

-- As vendas de 90 dias, os cortes e a posição no ranking — de madrugada e a
-- cada troca de Top X / cobertura / corte (D-119). A regra continua a mesma
-- (fn_vendas_90d / fn_estoque_cortes_90d).
create or replace function plt_privado.fn_estoque_vendas_atualizar()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer;
begin
  insert into public.plt_estoque_numeros (produto_tiny_id)
  select pr.tiny_id from public.produtos pr
  on conflict (produto_tiny_id) do nothing;

  with v as (select * from plt_privado.fn_vendas_90d()),
       c as (select * from plt_privado.fn_estoque_cortes_90d())
  update public.plt_estoque_numeros n
     set vendidos_90d = coalesce(v.vendidos, 0),
         posicao      = v.posicao,
         cortes_90d   = coalesce(c.cortes, 0),
         vendas_em    = now()
    from public.produtos pr
    left join v on v.tiny_id = pr.tiny_id
    left join c on c.tiny_id = pr.tiny_id
   where n.produto_tiny_id = pr.tiny_id;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5 · A leitura do Tiny: UMA regra de leitura do aviso (a de sempre, da
--     fn_leituras_tiny) e a linha do produto atualizada no mesmo gesto.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_leitura_tiny(p_payload jsonb, p_recebido_em timestamptz, p_evento_id bigint)
returns table (tiny_id bigint, saldo numeric, reservado_tiny numeric, lido_em timestamptz, origem text, evento_id bigint)
language sql
immutable
set search_path = public, pg_temp
as $$
  select x.tiny_id, x.saldo, x.reservado_tiny, p_recebido_em, x.origem, p_evento_id
    from (
      select case when (p_payload -> 'dados' ->> 'idProduto') ~ '^[0-9]+$'
                  then (p_payload -> 'dados' ->> 'idProduto')::bigint end            as tiny_id,
             case when replace(p_payload -> 'dados' ->> 'saldo', ',', '.') ~ '^-?[0-9]+(\.[0-9]+)?$'
                  then replace(p_payload -> 'dados' ->> 'saldo', ',', '.')::numeric end as saldo,
             case when replace(p_payload -> 'dados' ->> 'saldoReservado', ',', '.') ~ '^-?[0-9]+(\.[0-9]+)?$'
                  then replace(p_payload -> 'dados' ->> 'saldoReservado', ',', '.')::numeric end as reservado_tiny,
             coalesce(nullif(p_payload ->> 'origem', ''), 'webhook')                as origem
    ) x
   where p_payload ->> 'cnpj' = '27556613000166'
     and p_payload ->> 'tipo' = 'estoque'
     and x.tiny_id is not null and x.saldo is not null;
$$;

create or replace function plt_privado.fn_leituras_tiny()
returns table (
  tiny_id        bigint,
  saldo          numeric,
  reservado_tiny numeric,
  lido_em        timestamptz,
  origem         text,
  evento_id      bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select distinct on (l.tiny_id)
         l.tiny_id, l.saldo, l.reservado_tiny, l.lido_em, l.origem, l.evento_id
    from public.eventos e
   cross join lateral plt_privado.fn_leitura_tiny(e.payload, e.recebido_em, e.id) l
   where e.tipo = 'estoque_fabrica'
   order by l.tiny_id, l.lido_em desc, l.evento_id desc;
$$;

comment on function plt_privado.fn_leituras_tiny() is
  'SESSAO-25: o último aviso estoque_fabrica de cada produto (CNPJ da fábrica) — varre todos os avisos. SESSAO-30: usada só para (re)carregar a projeção; as telas leem plt_estoque_numeros.';

create or replace function plt_privado.fn_estoque_numeros_leitura(p_evento_id bigint)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.plt_estoque_numeros as n
      (produto_tiny_id, saldo_tiny, reservado_tiny, lido_em, origem_leitura, evento_leitura_id, atualizado_em)
  select l.tiny_id, l.saldo, l.reservado_tiny, l.lido_em, l.origem, l.evento_id, now()
    from public.eventos e
   cross join lateral plt_privado.fn_leitura_tiny(e.payload, e.recebido_em, e.id) l
    join public.produtos pr on pr.tiny_id = l.tiny_id
   where e.id = p_evento_id and e.tipo = 'estoque_fabrica'
  on conflict (produto_tiny_id) do update
     set saldo_tiny = excluded.saldo_tiny, reservado_tiny = excluded.reservado_tiny,
         lido_em = excluded.lido_em, origem_leitura = excluded.origem_leitura,
         evento_leitura_id = excluded.evento_leitura_id, atualizado_em = now()
   where n.lido_em is null
      or (excluded.lido_em, excluded.evento_leitura_id) > (n.lido_em, n.evento_leitura_id);
$$;

create or replace function plt_privado.fn_estoque_leituras_recarregar()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer;
begin
  insert into public.plt_estoque_numeros as n
      (produto_tiny_id, saldo_tiny, reservado_tiny, lido_em, origem_leitura, evento_leitura_id)
  select l.tiny_id, l.saldo, l.reservado_tiny, l.lido_em, l.origem, l.evento_id
    from plt_privado.fn_leituras_tiny() l
    join public.produtos pr on pr.tiny_id = l.tiny_id
  on conflict (produto_tiny_id) do update
     set saldo_tiny = excluded.saldo_tiny, reservado_tiny = excluded.reservado_tiny,
         lido_em = excluded.lido_em, origem_leitura = excluded.origem_leitura,
         evento_leitura_id = excluded.evento_leitura_id
   where (n.lido_em, n.evento_leitura_id) is distinct from (excluded.lido_em, excluded.evento_leitura_id);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- O aviso de estoque do Tiny (recriada POR INTEIRO a partir da migration 42 —
-- só a linha da projeção é nova).
create or replace function public.plt_fn_tiny_estoque_aviso(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cnpj    text;
  v_dados   jsonb;
  v_produto bigint;
  v_fila    boolean := false;
  v_evento  bigint;
begin
  insert into public.eventos (tipo, payload) values ('estoque_fabrica', coalesce(p, '{}'::jsonb))
    returning id into v_evento;
  -- SESSAO-30: a leitura entra na linha do produto no mesmo gesto (projeção).
  perform plt_privado.fn_estoque_numeros_leitura(v_evento);

  v_cnpj  := regexp_replace(coalesce(p ->> 'cnpj', ''), '[^0-9]', '', 'g');
  v_dados := coalesce(p -> 'dados', '{}'::jsonb);
  if v_cnpj = '27556613000166' then
    -- conta da FÁBRICA: o id do produto é o do catálogo
    if (v_dados ->> 'idProduto') ~ '^[0-9]+$' then
      select pr.tiny_id into v_produto
        from public.produtos pr where pr.tiny_id = (v_dados ->> 'idProduto')::bigint;
    end if;
  elsif v_cnpj <> '' then
    -- outra empresa do grupo (a loja): os ids não casam entre contas — pelo SKU (A-22)
    v_produto := plt_privado.fn_produto_do_item(nullif(btrim(v_dados ->> 'sku'), ''), v_dados ->> 'nome');
  end if;

  if v_produto is not null then
    v_fila := plt_privado.fn_tiny_estoque_enfileirar(v_produto, false, 'aviso');
  end if;
  return jsonb_build_object('registrado', true, 'produto_tiny_id', v_produto, 'na_fila', v_fila);
end;
$$;

-- A leitura do Tiny pelo n8n (recriada POR INTEIRO a partir da migration 42 —
-- só a linha da projeção é nova).
create or replace function public.plt_fn_tiny_estoque_leitura(
  p_produto_tiny_id bigint,
  p_versao          integer,
  p_resposta        jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fila       public.plt_tiny_estoque_fila%rowtype;
  v_ret        jsonb;
  v_prod       jsonb;
  v_saldo      numeric;
  v_tiny       integer;
  v_livres     integer;
  v_reservadas integer;
  v_alvo       integer;
  v_dep        jsonb;
  v_dep_saldo  numeric;
  v_conta      text;
  v_deposito   text;
  v_id         bigint;
  v_qtd        numeric;
  v_tipo       text;
  v_sku        text;
  v_n          integer;
  v_evento_leitura bigint;
begin
  select * into v_fila from public.plt_tiny_estoque_fila
   where produto_tiny_id = p_produto_tiny_id for update;
  if not found then
    return jsonb_build_object('acao', 'nada', 'motivo', 'fora_da_fila');
  end if;

  v_ret := coalesce(p_resposta -> 'retorno', p_resposta);
  if coalesce(v_ret ->> 'status', '') <> 'OK' or v_ret -> 'produto' is null then
    perform plt_privado.fn_tiny_estoque_falhou(p_produto_tiny_id,
      'Leitura do Tiny: ' || left(coalesce((v_ret -> 'erros')::text, v_ret::text, 'sem resposta'), 400));
    return jsonb_build_object('acao', 'nada', 'motivo', 'erro_na_leitura');
  end if;

  v_prod  := v_ret -> 'produto';
  v_saldo := plt_privado.fn_tiny_numero(v_prod ->> 'saldo');
  if v_saldo is null then
    perform plt_privado.fn_tiny_estoque_falhou(p_produto_tiny_id, 'Leitura do Tiny sem saldo.');
    return jsonb_build_object('acao', 'nada', 'motivo', 'erro_na_leitura');
  end if;
  select pr.codigo into v_sku from public.produtos pr where pr.tiny_id = p_produto_tiny_id;

  -- A leitura fica guardada no mesmo formato da carga (o detalhe do produto
  -- mostra "o que o Tiny diz" a partir dela).
  insert into public.eventos (tipo, tiny_id, payload)
    values ('estoque_fabrica', p_produto_tiny_id,
            jsonb_build_object(
              'cnpj', '27556613000166', 'tipo', 'estoque', 'origem', 'leitura',
              'motivo', v_fila.motivo,
              'dados', jsonb_build_object(
                'idProduto', p_produto_tiny_id, 'sku', coalesce(v_prod ->> 'codigo', v_sku),
                'nome', v_prod ->> 'nome', 'saldo', v_saldo,
                'saldoReservado', plt_privado.fn_tiny_numero(v_prod ->> 'saldoReservado'),
                'depositos', coalesce(v_prod -> 'depositos', '[]'::jsonb))))
    returning id into v_evento_leitura;
  -- SESSAO-30: a leitura entra na linha do produto no mesmo gesto (projeção).
  perform plt_privado.fn_estoque_numeros_leitura(v_evento_leitura);

  perform pg_advisory_xact_lock(hashtextextended('plt_estoque_produto:' || p_produto_tiny_id, 0));
  select x.livres, x.reservadas into v_livres, v_reservadas
    from plt_privado.fn_estoque_pecas(p_produto_tiny_id) x;
  v_tiny := greatest(floor(v_saldo), 0)::int;   -- negativo no Tiny = nada no galpão (D-53)

  -- (1) PONTO DE PARTIDA: as livres ficam com o saldo do Tiny (menos as
  --     reservadas, que também estão no galpão).
  if v_fila.copiar then
    v_alvo := greatest(v_tiny - v_reservadas, 0);
    if v_alvo > v_livres then
      perform plt_privado.fn_estoque_criar_pecas(p_produto_tiny_id, v_alvo - v_livres, null, 'api',
        'Ponto de partida: o saldo do Tiny.',
        jsonb_build_object('motivo', 'tiny_copia', 'produto_tiny_id', p_produto_tiny_id, 'sku', v_sku,
                           'saldo_tiny', v_saldo, 'antes', v_livres, 'depois', v_alvo));
    elsif v_alvo < v_livres then
      perform plt_privado.fn_estoque_baixar_pecas(p_produto_tiny_id, v_livres - v_alvo, null, 'api',
        'Ponto de partida: o saldo do Tiny.',
        jsonb_build_object('motivo', 'tiny_copia', 'produto_tiny_id', p_produto_tiny_id, 'sku', v_sku,
                           'saldo_tiny', v_saldo, 'antes', v_livres, 'depois', v_alvo));
    end if;
    perform plt_privado.fn_tiny_estoque_concluir(p_produto_tiny_id, p_versao, true);
    return jsonb_build_object('acao', 'nada', 'motivo', 'copiado', 'livres', v_alvo, 'tiny', v_saldo);
  end if;

  -- (2) A PLATAFORMA MANDA: o Tiny fica com as livres (o número da tela).
  if v_fila.enviar then
    if v_saldo = v_livres then
      perform plt_privado.fn_tiny_estoque_concluir(p_produto_tiny_id, p_versao);
      return jsonb_build_object('acao', 'nada', 'motivo', 'ja_igual', 'livres', v_livres);
    end if;
    -- O depósito "Fábrica" da empresa da loja é onde as peças prontas estão e
    -- onde a venda baixa; sem ele (ou sem o id do produto na loja), o Geral
    -- da fábrica. A SOMA das duas empresas fica igual às livres.
    select d -> 'deposito' into v_dep
      from jsonb_array_elements(coalesce(v_prod -> 'depositos', '[]'::jsonb)) d
     where d -> 'deposito' ->> 'empresa' = 'lojadomoby' and d -> 'deposito' ->> 'nome' = 'Fábrica'
     limit 1;
    v_id := case when v_dep is not null then plt_privado.fn_tiny_id_loja(v_sku) end;
    if v_dep is not null and v_id is not null then
      v_conta := 'loja';
      v_deposito := 'Fábrica';
    else
      select d -> 'deposito' into v_dep
        from jsonb_array_elements(coalesce(v_prod -> 'depositos', '[]'::jsonb)) d
       where d -> 'deposito' ->> 'nome' = 'Geral'
         and coalesce(d -> 'deposito' ->> 'empresa', '') <> 'lojadomoby'
       limit 1;
      v_conta := 'fabrica';
      v_deposito := 'Geral';
      v_id := p_produto_tiny_id;
    end if;
    v_dep_saldo := coalesce(plt_privado.fn_tiny_numero(v_dep ->> 'saldo'), 0);
    v_qtd := v_dep_saldo + (v_livres - v_saldo);
    if v_qtd >= 0 then
      v_tipo := 'B';                        -- balanço: o depósito passa a ter v_qtd
    else
      v_tipo := 'S';                        -- balanço negativo não é aceito: saída da diferença
      v_qtd := v_saldo - v_livres;
    end if;
    return jsonb_build_object(
      'acao', 'ajustar', 'conta', v_conta, 'id_produto', v_id, 'deposito', v_deposito,
      'tipo', v_tipo, 'quantidade', v_qtd, 'sku', v_sku,
      'tiny_antes', v_saldo, 'tiny_depois', v_livres,
      'estoque', jsonb_build_object('estoque', jsonb_build_object(
         'idProduto', v_id, 'tipo', v_tipo, 'quantidade', v_qtd, 'deposito', v_deposito,
         'observacoes', left(format('Plataforma Domoby: estoque = %s', v_livres), 100))));
  end if;

  -- (3) LER: Tiny acima do que está no galpão pela plataforma → sobe (D-76).
  if v_tiny > v_livres + v_reservadas then
    v_n := v_tiny - v_livres - v_reservadas;
    perform plt_privado.fn_estoque_criar_pecas(p_produto_tiny_id, v_n, null, 'api',
      'Entrou pelo Tiny.',
      jsonb_build_object('motivo', 'tiny', 'produto_tiny_id', p_produto_tiny_id, 'sku', v_sku,
                         'saldo_tiny', v_saldo, 'antes', v_livres, 'depois', v_livres + v_n,
                         'quantidade', v_n));
    perform plt_privado.fn_estoque_reposicao_coberta(p_produto_tiny_id);
  end if;
  perform plt_privado.fn_tiny_estoque_concluir(p_produto_tiny_id, p_versao);
  return jsonb_build_object('acao', 'nada', 'motivo', case when v_n > 0 then 'subiu' else 'sem_mudanca' end,
                            'entraram', coalesce(v_n, 0), 'tiny', v_saldo);
end;
$$;

-- ----------------------------------------------------------------------------
-- 6 · As regras do estoque lendo a projeção (mesma forma — quem chama não muda)
-- ----------------------------------------------------------------------------

-- Os pedidos da loja que ainda seguram estoque no Tiny (só os insumos usam): o
-- filtro pela descrição gravada usa o índice da situação; a regra continua
-- sendo fn_situacao_reserva_estoque.
create or replace function plt_privado.fn_estoque_reservas_loja()
returns table (tiny_id bigint, quantidade numeric)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select plt_privado.fn_produto_do_item(pi.codigo, pi.descricao), sum(pi.quantidade)
    from public.pedidos p
    join public.pedido_itens pi on pi.pedido_id = p.id
   where p.situacao in ('Em aberto', 'Aberto', 'Aprovado', 'Preparando envio',
                        'em_aberto', 'aberto', 'aprovado', 'preparando_envio')
     and plt_privado.fn_situacao_reserva_estoque(p.situacao)
     and not plt_privado.fn_eh_personalizado(pi.descricao)
   group by 1;
$$;

create or replace function plt_privado.fn_estoque_por_produto()
returns table (
  tiny_id              bigint,
  codigo               text,
  descricao            text,
  classe               text,
  unidade              text,
  situacao             text,
  minimo               numeric,
  saldo_tiny           numeric,
  reservado_tiny       numeric,
  lido_em              timestamptz,
  origem_leitura       text,
  evento_leitura_id    bigint,
  reservas_loja        numeric,
  disponivel           numeric,
  prontos_reservados   integer,
  prontos_livres       integer,
  reposicao_card_id    bigint,
  reposicao_estado     text,
  reposicao_quantidade integer,
  reposicao_liberadas  integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with cfg as (
    select plt_privado.fn_estoque_top_x() as top_x
  ),
  reservas as (
    select r.tiny_id, r.quantidade from plt_privado.fn_estoque_reservas_loja() r where r.tiny_id is not null
  ),
  reposicao as (
    select distinct on (rc.produto_tiny_id)
           rc.produto_tiny_id as tiny_id,
           rc.id              as card_id,
           rc.total_unidades  as quantidade,
           u.liberadas,
           case
             when u.em_producao > 0                then 'em_producao'
             when rc.arquivado_em is not null      then 'arquivada'
             when rc.liberado_completo_em is null  then 'no_pcp'
             else 'concluida'
           end                as estado
      from public.plt_cards rc
      left join lateral (
        select count(*)::int as liberadas,
               count(*) filter (where cu.arquivado_em is null and cu.concluido_em is null)::int as em_producao
          from public.plt_cards cu
         where cu.card_pai_id = rc.id and cu.tipo = 'unidade'
      ) u on true
     where rc.tipo = 'reposicao'
     order by rc.produto_tiny_id, rc.id desc
  )
  select pr.tiny_id,
         pr.codigo,
         pr.descricao,
         pr.classe,
         pr.unidade,
         pr.situacao,
         -- D-83: acabado = mínimo da plataforma, só no Top X; insumo = plataforma, senão o do Tiny.
         case when coalesce(pr.classe, '') in ('F', 'S', 'V')
              then case when n.posicao is not null and n.posicao <= cfg.top_x then pr.minimo_plataforma end
              else coalesce(pr.minimo_plataforma, pr.estoque_minimo) end      as minimo,
         n.saldo_tiny,
         n.reservado_tiny,
         n.lido_em,
         n.origem_leitura,
         n.evento_leitura_id,
         coalesce(r.quantidade, 0)                                           as reservas_loja,
         case when coalesce(pr.classe, '') in ('F', 'S', 'V')
              then coalesce(n.livres, 0)::numeric
              when n.saldo_tiny is not null
              then n.saldo_tiny - coalesce(r.quantidade, 0) end               as disponivel,
         -- D-118: reservados em venda = prontas de pedido (aguardo + ROTAS até a
         -- entrega) + as peças do estoque reservadas pela venda.
         coalesce(n.prontas_pedido, 0) + coalesce(n.reservadas_estoque, 0)   as prontos_reservados,
         coalesce(n.livres, 0)                                               as prontos_livres,
         rp.card_id,
         rp.estado,
         rp.quantidade,
         rp.liberadas
    from public.produtos pr
    cross join cfg
    left join public.plt_estoque_numeros n on n.produto_tiny_id = pr.tiny_id
    left join reservas  r  on r.tiny_id  = pr.tiny_id
    left join reposicao rp on rp.tiny_id = pr.tiny_id;
$$;

comment on function plt_privado.fn_estoque_por_produto() is
  'A base do estoque por produto (mesma forma). SESSAO-30: lê a projeção plt_estoque_numeros (M-04) — acabados: número = peças livres; reservados em venda = prontas de pedido no aguardo e nas ROTAS até a entrega (D-118) + reservadas pela venda; mínimo só no Top X (D-83). Insumos: a leitura do Tiny − os pedidos da loja abertos.';

-- O mínimo efetivo pela posição da projeção (a mesma regra da D-83).
create or replace function plt_privado.fn_minimo_efetivo(p_tiny_id bigint)
returns numeric language sql stable security definer set search_path = public, pg_temp as $$
  select case
           when coalesce(pr.classe, '') in ('F', 'S', 'V') then
             case when n.posicao is not null and n.posicao <= plt_privado.fn_estoque_top_x()
                  then pr.minimo_plataforma end
           else coalesce(pr.minimo_plataforma, pr.estoque_minimo)
         end
    from public.produtos pr
    left join public.plt_estoque_numeros n on n.produto_tiny_id = pr.tiny_id
   where pr.tiny_id = p_tiny_id;
$$;

-- A sugestão de mínimo do Top X (D-84) pelas vendas da projeção — a fórmula é
-- a mesma: vendidos ÷ dias úteis de venda × 6 × semanas, teto no fim.
create or replace function plt_privado.fn_sugestoes_minimo(p_semanas integer default null)
returns table (tiny_id bigint, vendidos numeric, posicao integer, media_semana numeric, sugestao integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with cfg as (
    select plt_privado.fn_dias_uteis_venda_90d()                                  as dias_uteis,
           least(greatest(coalesce(p_semanas, plt_privado.fn_estoque_cobertura()), 1), 8) as semanas,
           plt_privado.fn_estoque_top_x()                                         as top_x
  )
  select n.produto_tiny_id, n.vendidos_90d, n.posicao,
         round(n.vendidos_90d / cfg.dias_uteis * 6, 1)                    as media_semana,
         ceil(n.vendidos_90d / cfg.dias_uteis * 6 * cfg.semanas)::int     as sugestao
    from public.plt_estoque_numeros n
    cross join cfg
   where n.posicao is not null and n.posicao <= cfg.top_x;
$$;

-- Reservados para produção (D-86) pela projeção + a reposição parada no PCP
-- dentro do prazo (lida ao vivo — muda com o relógio do prazo, D-85).
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

-- O mínimo automático (recriada POR INTEIRO a partir da migration 45): antes
-- de gravar as sugestões, atualiza as vendas e reconta a projeção.
create or replace function plt_privado.fn_recalcular_minimos()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer;
begin
  -- SESSAO-30 (D-119): as vendas de 90 dias e a posição no ranking ficam
  -- prontas na projeção; a recontagem completa corrige qualquer deriva.
  perform plt_privado.fn_estoque_vendas_atualizar();
  perform plt_privado.fn_estoque_numeros_recontar();
  with mudou as (
    update public.produtos pr
       set minimo_plataforma = s.sugestao::numeric
      from plt_privado.fn_sugestoes_minimo(null) s
     where pr.tiny_id = s.tiny_id
       and not pr.minimo_travado
       and pr.minimo_plataforma is distinct from s.sugestao::numeric
    returning pr.tiny_id
  )
  select count(*)::int into v_n from mudou;
  return v_n;
end;
$$;

-- ----------------------------------------------------------------------------
-- 7 · As portas da tela (mesma forma) lendo a projeção
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_estoque_produtos(text, text, text, integer, integer);
create function public.plt_fn_estoque_produtos(
  p_grupo        text    default 'acabados',
  p_busca        text    default null,
  p_filtro       text    default null,
  p_limite       integer default 20,
  p_deslocamento integer default 0
)
returns table (
  tiny_id                 bigint,
  codigo                  text,
  descricao               text,
  classe                  text,
  unidade                 text,
  imagem_caminho          text,
  posicao                 integer,
  vendidos_90d            numeric,
  cortes                  integer,
  no_top                  boolean,
  minimo                  numeric,
  minimo_tiny             numeric,
  minimo_travado          boolean,
  sugestao                integer,
  em_estoque              numeric,
  reservados_venda        integer,
  reservadas_estoque      integer,
  reservados_producao     integer,
  em_necessidade          boolean,
  repor_sugerido          integer,
  pendente_card_id        bigint,
  pendente_pedido_numero  integer,
  saldo_tiny              numeric,
  lido_em                 timestamptz,
  origem_leitura          text,
  reposicao_estado        text,
  contagem_total          bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with cfg as (
    select plt_privado.fn_estoque_top_x() as top_x
  ),
  -- A bolinha vermelha (D-86): a reserva mais antiga cujo pedido ainda espera
  -- a decisão do PCP (card do pedido vivo e não liberado por inteiro).
  pendentes as (
    select distinct on (c.produto_tiny_id)
           c.produto_tiny_id as tiny_id,
           cp.id             as card_id,
           p.numero          as pedido_numero
      from public.plt_cards c
      join public.plt_setores s on s.id = c.setor_atual_id and s.codigo = 'estoque'
      join public.plt_cards cp on cp.pedido_id = c.reservada_pedido_id
                              and cp.tipo = 'pedido' and cp.arquivado_em is null
                              and cp.liberado_completo_em is null
      join public.pedidos p on p.id = c.reservada_pedido_id
     where c.tipo = 'unidade' and c.pedido_id is null and c.arquivado_em is null
       and c.reservada_pedido_id is not null and c.produto_tiny_id is not null
     order by c.produto_tiny_id, c.reservada_em
  ),
  base as (
    select b.tiny_id, b.codigo, b.descricao, b.classe, b.unidade, b.minimo, b.disponivel,
           b.saldo_tiny, b.lido_em, b.origem_leitura, b.prontos_reservados, b.reposicao_estado,
           pr.imagem_caminho, pr.estoque_minimo as minimo_tiny, pr.minimo_travado,
           n.posicao, n.vendidos_90d as vendidos,
           coalesce(n.cortes_90d, 0)                                                    as cortes_,
           sg.sugestao                                                                  as sugestao_,
           (n.posicao is not null and n.posicao <= cfg.top_x)                           as no_top_,
           coalesce(n.reservadas_estoque, 0)                                            as reservadas_estoque_,
           coalesce(rp.exibicao, 0)                                                     as reservados_producao_,
           coalesce(rp.para_estoque, 0)                                                 as para_estoque_,
           (coalesce(b.minimo, 0) > 0
              and coalesce(b.disponivel, 0) + coalesce(rp.para_estoque, 0) < b.minimo)  as em_necessidade_,
           case when coalesce(b.minimo, 0) > 0
                then greatest(ceil(b.minimo - greatest(coalesce(b.disponivel, 0), 0)
                                   - coalesce(rp.para_estoque, 0))::int, 0)
                else 0 end                                                              as repor_sugerido_,
           pd.card_id                                                                   as pendente_card_,
           pd.pedido_numero                                                             as pendente_numero_,
           case when b.disponivel is not null then greatest(b.disponivel, 0) end        as em_estoque_
      from plt_privado.fn_estoque_por_produto() b
      join public.produtos pr on pr.tiny_id = b.tiny_id
      cross join cfg
      left join public.plt_estoque_numeros n          on n.produto_tiny_id = b.tiny_id
      left join plt_privado.fn_sugestoes_minimo(null) sg on sg.tiny_id = b.tiny_id
      left join plt_privado.fn_reservados_producao() rp on rp.tiny_id = b.tiny_id
      left join pendentes   pd on pd.tiny_id = b.tiny_id
     where b.situacao = 'A'
       and case when coalesce(p_grupo, 'acabados') = 'insumos'
                then b.classe in ('M', 'K')
                else coalesce(b.classe, '') in ('F', 'S', 'V')
           end
  ),
  visivel as (
    select b.*
      from base b
     where plt_privado.fn_pode_ver_expedicao()
       and (p_busca is null or btrim(p_busca) = ''
            or b.descricao ilike '%' || btrim(p_busca) || '%'
            or b.codigo ilike btrim(p_busca) || '%')
  )
  select f.tiny_id,
         f.codigo,
         f.descricao,
         f.classe,
         f.unidade,
         f.imagem_caminho,
         f.posicao,
         coalesce(f.vendidos, 0),
         f.cortes_,
         coalesce(f.no_top_, false),
         f.minimo,
         f.minimo_tiny,
         f.minimo_travado,
         f.sugestao_,
         f.em_estoque_,
         f.prontos_reservados,
         f.reservadas_estoque_,
         f.reservados_producao_,
         f.em_necessidade_,
         f.repor_sugerido_,
         f.pendente_card_,
         f.pendente_numero_,
         f.saldo_tiny,
         f.lido_em,
         f.origem_leitura,
         f.reposicao_estado,
         count(*) over ()
    from visivel f
   where case
           when coalesce(p_grupo, 'acabados') = 'insumos'
             then coalesce(p_filtro, '') <> 'sem_leitura' or f.saldo_tiny is null
           when p_busca is not null and btrim(p_busca) <> '' then true
           when p_filtro = 'necessidade'         then f.em_necessidade_
           when p_filtro = 'reservados_producao' then f.reservados_producao_ > 0
           when p_filtro = 'com_estoque'         then coalesce(f.em_estoque_, 0) > 0
           else true
         end
   order by (coalesce(p_grupo, 'acabados') = 'insumos' and coalesce(f.em_estoque_, 0) > 0) desc,
            f.posicao nulls last,
            f.descricao,
            f.tiny_id
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_estoque_produtos(text, text, text, integer, integer) is
  'Estoque por produto (D-83/D-86). SESSAO-30: lê a projeção plt_estoque_numeros (os números prontos — regra 18); reservados em venda vão até a entrega (D-118). Acabados: UMA lista pelo ranking (Top X é o tamanho da página — deslocamento justificado: lista pequena e limitada); insumos: Tiny, com estoque primeiro. Gate da logística.';

revoke all on function public.plt_fn_estoque_produtos(text, text, text, integer, integer) from public, anon;
grant execute on function public.plt_fn_estoque_produtos(text, text, text, integer, integer) to authenticated;

drop function if exists public.plt_fn_estoque_configuracoes(text, integer, integer);
create function public.plt_fn_estoque_configuracoes(
  p_busca        text    default null,
  p_limite       integer default 20,
  p_deslocamento integer default 0
)
returns table (
  tiny_id              bigint,
  codigo               text,
  descricao            text,
  imagem_caminho       text,
  posicao              integer,
  vendidos_90d         numeric,
  cortes               integer,
  no_top               boolean,
  media_semana         numeric,
  minimo               numeric,
  minimo_tiny          numeric,
  minimo_travado       boolean,
  sugestao             integer,
  em_estoque           integer,
  contagem_total       bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with cfg as (
    select plt_privado.fn_estoque_top_x() as top_x
  )
  select pr.tiny_id,
         pr.codigo,
         pr.descricao,
         pr.imagem_caminho,
         n.posicao,
         coalesce(n.vendidos_90d, 0),
         coalesce(n.cortes_90d, 0),
         (n.posicao is not null and n.posicao <= cfg.top_x),
         s.media_semana,
         case when n.posicao is not null and n.posicao <= cfg.top_x
              then pr.minimo_plataforma end,
         pr.estoque_minimo,
         pr.minimo_travado,
         s.sugestao,
         coalesce(n.livres, 0),
         count(*) over ()
    from public.produtos pr
    cross join cfg
    left join public.plt_estoque_numeros n          on n.produto_tiny_id = pr.tiny_id
    left join plt_privado.fn_sugestoes_minimo(null) s on s.tiny_id = pr.tiny_id
   where plt_privado.fn_pode_ver_expedicao()
     and pr.situacao = 'A'
     and coalesce(pr.classe, '') in ('F', 'S', 'V')
     and (p_busca is null or btrim(p_busca) = ''
          or pr.descricao ilike '%' || btrim(p_busca) || '%'
          or pr.codigo ilike btrim(p_busca) || '%')
   order by n.posicao nulls last, pr.descricao, pr.tiny_id
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_estoque_configuracoes(text, integer, integer) is
  'Aba Configurações do Estoque (D-84) — SESSAO-30: lê a projeção (posição, vendas, cortes, peças livres). Gate da logística.';

revoke all on function public.plt_fn_estoque_configuracoes(text, integer, integer) from public, anon;
grant execute on function public.plt_fn_estoque_configuracoes(text, integer, integer) to authenticated;

-- O resumo do galpão (mesma forma) = a SOMA da lista (raio-x 5): os números
-- dos acabados ativos vêm da projeção (as mesmas peças que os cartões contam).
drop function if exists public.plt_fn_estoque_resumo();
create function public.plt_fn_estoque_resumo()
returns table (
  moveis_estoque    integer,
  pecas_unidades    numeric,
  pecas_m2          numeric,
  moveis_reservados integer,
  pecas_producao    integer,
  moveis_producao   integer,
  soma_minimos      numeric,
  produtos_abaixo   integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with base as (
    select b.tiny_id, b.classe, b.unidade, b.minimo, b.disponivel, b.prontos_reservados
      from plt_privado.fn_estoque_por_produto() b
     where b.situacao = 'A'
  ),
  acabados as (
    select b.*, coalesce(n.producao_sem_dono, 0) as producao_sem_dono,
           coalesce(n.producao_de_pedido, 0) as producao_de_pedido,
           coalesce(rp.para_estoque, 0) as para_estoque
      from base b
      left join public.plt_estoque_numeros n on n.produto_tiny_id = b.tiny_id
      left join plt_privado.fn_reservados_producao() rp on rp.tiny_id = b.tiny_id
     where coalesce(b.classe, '') in ('F', 'S', 'V')
  ),
  insumos as (
    select b.unidade, greatest(coalesce(b.disponivel, 0), 0) as quantidade
      from base b where b.classe in ('M', 'K')
  )
  select (select coalesce(sum(a.disponivel), 0)::int from acabados a),
         (select coalesce(sum(i.quantidade), 0) from insumos i
           where lower(coalesce(i.unidade, '')) not in ('m2', 'm²', 'm^2')),
         (select coalesce(sum(i.quantidade), 0) from insumos i
           where lower(coalesce(i.unidade, '')) in ('m2', 'm²', 'm^2')),
         (select coalesce(sum(a.prontos_reservados), 0)::int from acabados a),
         (select coalesce(sum(a.producao_sem_dono), 0)::int from acabados a),
         (select coalesce(sum(a.producao_de_pedido), 0)::int from acabados a),
         (select coalesce(sum(a.minimo), 0) from acabados a),
         (select count(*)::int from acabados a
           where coalesce(a.minimo, 0) > 0 and a.disponivel + a.para_estoque < a.minimo)
   where plt_privado.fn_pode_ver_expedicao();
$$;

comment on function public.plt_fn_estoque_resumo() is
  'Resumo do galpão (pedido do dono 30/09) — SESSAO-30: a soma da lista (raio-x 5), pela projeção: móveis em estoque (livres), insumos por unidade e m², móveis prontos reservados (aguardo + ROTAS até a entrega + reservados pela venda — D-118), peças em produção sem dono, móveis em produção de pedidos, soma dos mínimos do Top X e produtos em necessidade.';

revoke all on function public.plt_fn_estoque_resumo() from public, anon;
grant execute on function public.plt_fn_estoque_resumo() to authenticated;

-- ----------------------------------------------------------------------------
-- 8 · Raio-x 6: a peça personalizada livre no ESTOQUE ganha lista e baixa (a
--     regra do personalizado: não é o produto do catálogo; casa por SKU +
--     descrição na sugestão do PCP — D-62). Lista por cursor (id), baixa por
--     peça com motivo, pela marca da maquinaria (raio-x 2).
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_estoque_personalizadas(
  p_antes_id bigint  default null,
  p_limite   integer default 20
)
returns table (
  card_id        bigint,
  item_codigo    text,
  item_descricao text,
  origem_numero  integer,
  desde          timestamptz,
  tem_mais       boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with pagina as (
    select c.id, c.item_codigo, c.item_descricao, c.desde, c.card_pai_id
      from public.plt_cards c
      join public.plt_setores s on s.id = c.setor_atual_id and s.codigo = 'estoque'
     where plt_privado.fn_pode_ver_expedicao()
       and c.tipo = 'unidade' and c.pedido_id is null and c.arquivado_em is null
       and plt_privado.fn_eh_personalizado(c.item_descricao)
       and (p_antes_id is null or c.id < p_antes_id)
     order by c.id desc
     limit least(greatest(coalesce(p_limite, 20), 1), 100) + 1
  )
  select p.id, p.item_codigo, p.item_descricao,
         (select pd.numero from public.plt_cards pai join public.pedidos pd on pd.id = pai.pedido_id
           where pai.id = p.card_pai_id),
         p.desde,
         (select count(*) from pagina) > least(greatest(coalesce(p_limite, 20), 1), 100)
    from pagina p
   order by p.id desc
   limit least(greatest(coalesce(p_limite, 20), 1), 100);
$$;

create or replace function public.plt_fn_estoque_baixar_personalizada(p_card_id bigint, p_observacao text)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
  v_card    public.plt_cards%rowtype;
  v_evento  bigint;
  v_marca   text;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Dar baixa no estoque é gesto da logística ou de admin.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_card from public.plt_cards c where c.id = p_card_id for update;
  if not found or v_card.tipo <> 'unidade' or v_card.pedido_id is not null or v_card.arquivado_em is not null
     or not exists (select 1 from public.plt_setores s where s.id = v_card.setor_atual_id and s.codigo = 'estoque')
     or not plt_privado.fn_eh_personalizado(v_card.item_descricao) then
    raise exception 'Esta peça não é uma peça personalizada livre no ESTOQUE.' using errcode = 'check_violation';
  end if;
  if nullif(btrim(p_observacao), '') is null then
    raise exception 'Diga o motivo da baixa.' using errcode = 'check_violation';
  end if;
  v_marca := current_setting('plt.estoque_maquinaria', true);
  perform set_config('plt.estoque_maquinaria', 'on', true);
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, observacao, dados)
    values (v_card.id, 'card_arquivado', v_usuario, 'interface', v_card.setor_atual_id,
            btrim(p_observacao), jsonb_build_object('motivo', 'baixa_manual', 'personalizada', true))
    returning id into v_evento;
  perform set_config('plt.estoque_maquinaria', coalesce(v_marca, ''), true);
  return v_evento;
end;
$$;

revoke all on function public.plt_fn_estoque_personalizadas(bigint, integer) from public, anon;
grant execute on function public.plt_fn_estoque_personalizadas(bigint, integer) to authenticated;
revoke all on function public.plt_fn_estoque_baixar_personalizada(bigint, text) from public, anon;
grant execute on function public.plt_fn_estoque_baixar_personalizada(bigint, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 9 · Raio-x 1: a chegada aos fins de linha vale para TODA origem (tela, API,
--     automação, maquinaria) e também para o card CRIADO direto lá. Só o
--     ajuste do super admin (D-117, marca de sessão) passa por cima.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_validar_chegada_estoque()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_destino   text;
  v_estado    text;
  v_card      public.plt_cards%rowtype;
  v_cancelado boolean;
begin
  if new.tipo not in ('movimentacao_setor', 'card_criado')
     or coalesce(current_setting('plt.ajuste_super_admin', true), '') = 'on' then
    return new;
  end if;
  select s.codigo into v_destino from public.plt_setores s where s.id = new.setor_destino_id;
  if v_destino is null or v_destino not in ('estoque', 'aguardo') then
    return new;
  end if;

  select * into v_card from public.plt_cards where id = new.card_id;

  -- A marcação da própria transição manda; sem ela (saída de PCP/terminal),
  -- vale o último estado conhecido da peça.
  if new.evento_referencia_id is not null then
    select e.estado_qualidade into v_estado
      from public.plt_eventos e
     where e.id = new.evento_referencia_id and e.tipo = 'qualidade_marcada';
  end if;
  if v_estado is null then
    v_estado := v_card.qualidade_atual;
  end if;
  if v_estado in ('atencao', 'danificado') then
    if v_destino = 'estoque' then
      raise exception 'O ESTOQUE só recebe peça em perfeito estado. Peça em atenção ou danificada vai para o DANIFICADO do setor.'
        using errcode = 'check_violation';
    end if;
    raise exception 'Pedidos em aguardo só recebe peça em perfeito estado. Peça em atenção ou danificada vai para o DANIFICADO do setor.'
      using errcode = 'check_violation';
  end if;

  -- SESSAO-24 (b4 do dono): "estoque só fica como local final de peça sem dono".
  v_cancelado := v_card.pedido_id is not null and plt_privado.fn_pedido_cancelado(v_card.pedido_id);
  if v_destino = 'aguardo' then
    if v_card.pedido_id is null then
      raise exception 'Pedidos em aguardo recebe só peça de pedido — peça sem dono vai para o ESTOQUE.'
        using errcode = 'check_violation';
    end if;
    if v_cancelado then
      raise exception 'O pedido desta peça foi cancelado no Tiny — ela vai para o ESTOQUE, sem dono.'
        using errcode = 'check_violation';
    end if;
  elsif v_card.pedido_id is not null and not v_cancelado then
    raise exception 'Peça de pedido vai para Pedidos em aguardo — o ESTOQUE recebe só peça sem dono.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

comment on function plt_privado.fn_validar_chegada_estoque() is
  'Os fins de linha: só peça 🟢; ESTOQUE só com peça sem dono (ou de pedido cancelado, que perde o pedido na chegada); Pedidos em aguardo só com peça de pedido vivo. SESSAO-30 (raio-x 1): vale para TODA origem e para card criado direto lá; só o ajuste do super admin (D-117) passa.';

-- A validação dos gestos (recriada POR INTEIRO a partir da migration 56):
-- + raio-x 2.
create or replace function plt_privado.fn_validar_api()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_papel text;
  v_logistica boolean;
  v_danificado boolean;
  v_reposicao boolean;
  v_livre_no_estoque boolean;
begin
  if new.tipo = 'card_arquivado' then
    -- SESSAO-30 (raio-x 2): peça livre do ESTOQUE só sai pela BAIXA do estoque
    -- (ordem de entrada, trava por produto, motivo e o Tiny junto) — vale
    -- para toda origem, até para o motor; a maquinaria liga a marca. A peça
    -- no DANIFICADO segue saindo pelos Danificados.
    if coalesce(current_setting('plt.estoque_maquinaria', true), '') <> 'on'
       and exists (select 1 from public.plt_cards c
                     join public.plt_setores s on s.id = c.setor_atual_id and s.codigo = 'estoque'
                     left join public.plt_etapas e on e.id = c.etapa_atual_id
                    where c.id = new.card_id and c.tipo = 'unidade' and c.pedido_id is null
                      and not coalesce(e.eh_danificado, false)) then
      raise exception 'Peça do ESTOQUE sai pela baixa do estoque (Estoque → o produto → Baixa): com o motivo, a ordem de entrada e o Tiny junto.'
        using errcode = 'check_violation';
    end if;
    -- SESSAO-27 (D-99): o motor das automações arquiva (o super admin montou e ligou).
    if plt_privado.fn_evento_do_motor(new.origem, new.dados) then
      return new;
    end if;
    if new.origem <> 'api' then
      select u.papel into v_papel from public.plt_usuarios u
       where u.id = new.usuario_id and u.ativo;
      if coalesce(v_papel, '') <> 'admin' then
        -- SESSAO-15 (D-45): a logística arquiva peça que está em DANIFICADO.
        select exists (
          select 1 from public.plt_cards c
            join public.plt_etapas e on e.id = c.etapa_atual_id
           where c.id = new.card_id and e.eh_danificado
        ) into v_danificado;
        -- SESSAO-25: e o card de REPOSIÇÃO (o PCP decide não produzir).
        select exists (
          select 1 from public.plt_cards c
           where c.id = new.card_id and c.tipo = 'reposicao'
        ) into v_reposicao;
        -- D-70 (28/09): e dá BAIXA em peça livre do ESTOQUE (a contagem é dela).
        select exists (
          select 1 from public.plt_cards c
            join public.plt_setores s on s.id = c.setor_atual_id and s.codigo = 'estoque'
           where c.id = new.card_id and c.tipo = 'unidade' and c.pedido_id is null
        ) into v_livre_no_estoque;
        if not ((coalesce(v_danificado, false) or coalesce(v_reposicao, false)
                 or coalesce(v_livre_no_estoque, false))
                and plt_privado.fn_eh_logistica(new.usuario_id)) then
          raise exception 'Arquivar card é gesto de admin ou da integração — a logística arquiva só peças em DANIFICADO, cards de reposição e dá baixa em peça livre do ESTOQUE.'
            using errcode = 'insufficient_privilege';
        end if;
      end if;
    end if;

  elsif new.tipo = 'pedido_entregue' then
    if new.usuario_id is null then
      -- SESSAO-30 (D-113): o Tiny ficou "Entregue" — quem registra é o Sistema,
      -- pela maquinaria (fn_fechar_pedido). Fora dela, entrega é gesto de pessoa.
      if coalesce(current_setting('plt.entrega_maquinaria', true), '') = 'on' then
        return new;
      end if;
      raise exception 'Registrar entrega é gesto de pessoa — é preciso dizer quem entregou.'
        using errcode = 'check_violation';
    end if;
    select u.papel into v_papel from public.plt_usuarios u
     where u.id = new.usuario_id and u.ativo;
    select exists (
      select 1 from public.plt_usuario_setores us
        join public.plt_setores s on s.id = us.setor_id
       where us.usuario_id = new.usuario_id
         and s.papel_no_fluxo in ('entrada', 'terminal')
    ) into v_logistica;
    if coalesce(v_papel, '') <> 'admin' and not v_logistica then
      raise exception 'Registrar entrega é gesto da logística (PCP/terminais) ou de admin.'
        using errcode = 'insufficient_privilege';
    end if;

  elsif new.tipo = 'pedido_lancado_rotas' then
    -- SESSAO-15 (D-45): lançar é gesto HUMANO da logística, no card de PEDIDO.
    if new.usuario_id is null then
      raise exception 'Lançar para ROTAS é gesto de pessoa — é preciso dizer quem lançou.'
        using errcode = 'check_violation';
    end if;
    if not plt_privado.fn_eh_logistica(new.usuario_id) then
      raise exception 'Lançar para ROTAS é gesto da logística (PCP/terminais) ou de admin.'
        using errcode = 'insufficient_privilege';
    end if;
    if not exists (select 1 from public.plt_cards c where c.id = new.card_id and c.tipo = 'pedido') then
      raise exception 'Só o card de pedido pode ser lançado para ROTAS.'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

-- A baixa das peças livres (recriada POR INTEIRO a partir da migration 42):
-- + a marca da maquinaria (raio-x 2).
create or replace function plt_privado.fn_estoque_baixar_pecas(
  p_produto_tiny_id bigint,
  p_quantidade      integer,
  p_usuario         uuid,
  p_origem          text,
  p_observacao      text,
  p_dados           jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_estoque bigint;
  v_n       integer := 0;
  v_marca   text;
  r         record;
begin
  if coalesce(p_quantidade, 0) < 1 then
    return 0;
  end if;
  select s.id into v_estoque from public.plt_setores s where s.codigo = 'estoque';
  -- SESSAO-30 (raio-x 2): a baixa oficial é quem pode tirar peça livre do ESTOQUE.
  v_marca := current_setting('plt.estoque_maquinaria', true);
  perform set_config('plt.estoque_maquinaria', 'on', true);
  for r in
    select c.id
      from public.plt_cards c
     where c.tipo = 'unidade' and c.pedido_id is null and c.arquivado_em is null
       and c.reservada_pedido_id is null
       and c.produto_tiny_id = p_produto_tiny_id and c.setor_atual_id = v_estoque
       and not plt_privado.fn_eh_personalizado(c.item_descricao)
     order by c.desde asc nulls first, c.id
     limit p_quantidade
       for update
  loop
    insert into public.plt_eventos
        (card_id, tipo, usuario_id, origem, setor_origem_id, observacao, dados)
      values
        (r.id, 'card_arquivado', p_usuario, p_origem, v_estoque, p_observacao, coalesce(p_dados, '{}'::jsonb));
    v_n := v_n + 1;
  end loop;
  perform set_config('plt.estoque_maquinaria', coalesce(v_marca, ''), true);
  return v_n;
end;
$$;

-- Fechar o pedido entregue (recriada POR INTEIRO a partir da migration 56):
-- + as marcas da maquinaria guardadas e devolvidas.
create or replace function plt_privado.fn_fechar_pedido(
  p_card_pedido_id bigint,
  p_usuario        uuid,
  p_origem         text,
  p_observacao     text,
  p_fonte          text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card      public.plt_cards%rowtype;
  v_numero    integer;
  v_situacao  text;
  v_entrega   bigint;
  v_nova      boolean := false;
  v_vivas     integer;
  v_unidades  integer := 0;
  v_tempos    integer := 0;
  v_reservas  integer := 0;
  v_card_saiu boolean := false;
  v_marca_e   text;
  v_marca_m   text;
  r           record;
begin
  select * into v_card from public.plt_cards
   where id = p_card_pedido_id and tipo = 'pedido'
   for update;
  if not found then
    raise exception 'Card de pedido % não existe.', p_card_pedido_id using errcode = 'no_data_found';
  end if;
  select p.numero, p.situacao into v_numero, v_situacao
    from public.pedidos p where p.id = v_card.pedido_id;

  select count(*)::int into v_vivas
    from public.plt_cards u
   where u.pedido_id = v_card.pedido_id and u.tipo = 'unidade' and u.arquivado_em is null;

  -- Card já arquivado e nada vivo: história antiga — nada a fechar.
  if v_card.arquivado_em is not null and v_vivas = 0
     and not exists (select 1 from public.plt_cards s
                      where s.reservada_pedido_id = v_card.pedido_id and s.arquivado_em is null) then
    return jsonb_build_object('fechou', false, 'motivo', 'arquivado', 'numero', v_numero);
  end if;

  v_marca_e := current_setting('plt.entrega_maquinaria', true);
  v_marca_m := current_setting('plt.estoque_maquinaria', true);
  perform set_config('plt.entrega_maquinaria', 'on', true);
  -- SESSAO-30 (raio-x 2): a peça do estoque reservada sai com o pedido.
  perform set_config('plt.estoque_maquinaria', 'on', true);

  select e.id into v_entrega
    from public.plt_eventos e
   where e.card_id = v_card.id and e.tipo = 'pedido_entregue'
   order by e.id desc
   limit 1;
  if v_entrega is null then
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
      values (v_card.id, 'pedido_entregue', p_usuario, p_origem,
              nullif(btrim(p_observacao), ''),
              jsonb_build_object('fonte', p_fonte, 'numero', v_numero,
                                 'situacao_tiny', v_situacao, 'unidades', v_vivas,
                                 'lancado_rotas', v_card.lancado_rotas_em is not null))
      returning id into v_entrega;
    v_nova := true;
  end if;

  -- Cada peça viva do pedido sai de toda conta (estoque, reservas, ROTAS ativa,
  -- Visão do dia) e fica no histórico — o tempo aberto fecha antes.
  for r in
    select c.id from public.plt_cards c
     where c.pedido_id = v_card.pedido_id and c.tipo = 'unidade' and c.arquivado_em is null
     order by c.id
       for update
  loop
    if plt_privado.fn_fechar_tempo_aberto(r.id, 'O pedido foi entregue: o tempo aberto fecha antes de a peça sair.') then
      v_tempos := v_tempos + 1;
    end if;
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
      values (r.id, 'card_arquivado', p_usuario, p_origem,
              'Pedido ' || coalesce(v_numero::text, '') || ' entregue — a peça saiu com ele.',
              jsonb_build_object('motivo', 'entregue', 'entrega_evento_id', v_entrega,
                                 'fonte', p_fonte, 'numero', v_numero));
    v_unidades := v_unidades + 1;
  end loop;

  -- A peça do ESTOQUE reservada pela venda sai com o pedido (motivo "venda" —
  -- a mesma baixa da D-78; não volta ao Tiny, que já baixou na venda).
  for r in
    select c.id, c.setor_atual_id, c.reservada_item_seq, c.reservada_indice, c.produto_tiny_id
      from public.plt_cards c
     where c.reservada_pedido_id = v_card.pedido_id and c.arquivado_em is null
     order by c.id
       for update
  loop
    insert into public.plt_eventos (card_id, tipo, origem, setor_origem_id, observacao, dados)
      values (r.id, 'card_arquivado', 'api', r.setor_atual_id,
              format('Saiu com o pedido %s (entregue).', v_numero),
              jsonb_build_object('motivo', 'venda', 'pedido_id', v_card.pedido_id, 'numero', v_numero,
                                 'item_seq', r.reservada_item_seq, 'indice_unidade', r.reservada_indice,
                                 'produto_tiny_id', r.produto_tiny_id, 'entrega_evento_id', v_entrega));
    v_reservas := v_reservas + 1;
  end loop;

  -- O card do pedido que nunca foi às ROTAS sai do PCP (o lançado fica: é o
  -- registro da entrega em ROTAS → Entregas e em "Já programadas").
  if v_card.lancado_rotas_em is null and v_card.arquivado_em is null then
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
      values (v_card.id, 'card_arquivado', p_usuario, p_origem,
              'Pedido entregue — sai do PCP.',
              jsonb_build_object('motivo', 'entregue', 'entrega_evento_id', v_entrega,
                                 'fonte', p_fonte, 'numero', v_numero));
    v_card_saiu := true;
  end if;

  perform set_config('plt.entrega_maquinaria', coalesce(v_marca_e, ''), true);
  perform set_config('plt.estoque_maquinaria', coalesce(v_marca_m, ''), true);
  return jsonb_build_object('fechou', true, 'numero', v_numero, 'entrega_evento_id', v_entrega,
                            'entrega_nova', v_nova, 'unidades', v_unidades,
                            'tempos_fechados', v_tempos, 'reservas', v_reservas,
                            'card_saiu_do_pcp', v_card_saiu);
end;
$$;

-- "Concluído" do super admin (recriada POR INTEIRO a partir da migration 56):
-- + a marca do ajuste (raio-x 1) e as marcas devolvidas no fim.
create or replace function plt_privado.fn_concluir_pedido(p_card_pedido_id bigint, p_usuario uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card    public.plt_cards%rowtype;
  v_numero  integer;
  v_aguardo bigint;
  v_total   integer;
  v_u       public.plt_cards%rowtype;
  v_peca    public.plt_cards%rowtype;
  v_novo    bigint;
  v_produto bigint;
  v_ja      integer := 0;
  v_movidas integer := 0;
  v_criadas integer := 0;
  v_usadas  integer := 0;
  v_pulados integer := 0;
  v_marca_m text;
  v_marca_a text;
  it        record;
  k         integer;
begin
  select * into v_card from public.plt_cards
   where id = p_card_pedido_id and tipo = 'pedido'
   for update;
  if not found then
    raise exception 'Card de pedido % não existe.', p_card_pedido_id using errcode = 'no_data_found';
  end if;
  if v_card.arquivado_em is not null then
    raise exception 'Este pedido está arquivado.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.plt_eventos e where e.card_id = v_card.id and e.tipo = 'pedido_entregue') then
    raise exception 'Este pedido já foi entregue.' using errcode = 'check_violation';
  end if;
  if v_card.lancado_rotas_em is not null then
    return jsonb_build_object('concluido', false, 'motivo', 'ja_em_rota');
  end if;
  if plt_privado.fn_pedido_cancelado(v_card.pedido_id) then
    raise exception 'Este pedido foi cancelado no Tiny — não dá para concluir.' using errcode = 'check_violation';
  end if;

  select p.numero into v_numero from public.pedidos p where p.id = v_card.pedido_id;
  select s.id into v_aguardo from public.plt_setores s where s.codigo = 'aguardo' and s.ativo;
  if v_aguardo is null then
    raise exception 'Pedidos em aguardo não está cadastrado — fale com o admin.' using errcode = 'no_data_found';
  end if;

  v_total := plt_privado.fn_unidades_do_pedido(v_card.pedido_id);
  if v_total = 0 then
    return jsonb_build_object('concluido', true, 'motivo', 'sem_producao');
  end if;

  v_marca_m := current_setting('plt.estoque_maquinaria', true);
  v_marca_a := current_setting('plt.ajuste_super_admin', true);
  perform set_config('plt.estoque_maquinaria', 'on', true);
  -- SESSAO-30 (raio-x 1): o ajuste do super admin (D-117) passa pela regra
  -- dos fins de linha — ele decide que a peça está pronta.
  perform set_config('plt.ajuste_super_admin', 'on', true);

  for it in
    select v.seq, v.codigo, v.descricao, v.unidades
      from plt_privado.vw_itens_producao v
     where v.pedido_id = v_card.pedido_id and v.unidades >= 1
     order by v.seq
  loop
    for k in 1 .. it.unidades loop
      select * into v_u from public.plt_cards u
       where u.pedido_id = v_card.pedido_id and u.tipo = 'unidade'
         and u.item_seq = it.seq and u.indice_unidade = k
       for update;
      if found then
        if v_u.arquivado_em is not null then
          v_pulados := v_pulados + 1;
          continue;
        end if;
        if v_u.setor_atual_id = v_aguardo then
          v_ja := v_ja + 1;
          continue;
        end if;
        perform plt_privado.fn_fechar_tempo_aberto(v_u.id, 'Concluído pelo super admin: o tempo aberto fecha antes.');
        select * into v_u from public.plt_cards where id = v_u.id;
        insert into public.plt_eventos
            (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id,
             setor_destino_id, etapa_destino_id, observacao, dados)
          values
            (v_u.id, 'movimentacao_setor', p_usuario, 'api', v_u.setor_atual_id, v_u.etapa_atual_id,
             v_aguardo, null, 'Concluído pelo super admin (ajuste da plataforma).',
             jsonb_build_object('ajuste_super_admin', true, 'numero', v_numero));
        v_movidas := v_movidas + 1;
      else
        -- A peça do estoque reservada pela venda para ESTA unidade: usa ela.
        select * into v_peca from public.plt_cards c
         where c.reservada_pedido_id = v_card.pedido_id and c.reservada_item_seq = it.seq
           and c.reservada_indice = k and c.arquivado_em is null
         limit 1
           for update;
        v_produto := case when found then v_peca.produto_tiny_id
                          else plt_privado.fn_produto_do_item(it.codigo, it.descricao) end;

        insert into public.plt_cards
            (tipo, pedido_id, card_pai_id, item_seq, item_codigo, item_descricao,
             indice_unidade, total_unidades, produto_tiny_id, setor_atual_id)
          values
            ('unidade', v_card.pedido_id, v_card.id, it.seq, it.codigo, it.descricao,
             k, it.unidades, v_produto, v_aguardo)
          returning id into v_novo;

        insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_destino_id, observacao, dados)
          values (v_novo, 'card_criado', p_usuario, 'api', v_aguardo,
                  case when v_peca.id is not null
                       then 'Concluído pelo super admin — usou a peça do estoque reservada para o pedido.'
                       else 'Concluído pelo super admin — a peça nasce pronta (ajuste da plataforma).' end,
                  jsonb_build_object('ajuste_super_admin', true, 'numero', v_numero)
                  || case when v_peca.id is not null
                          then jsonb_build_object('alocada_de', v_peca.id, 'reservada', true)
                          else '{}'::jsonb end);

        if v_peca.id is not null then
          insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, observacao, dados)
            values (v_peca.id, 'peca_alocada', p_usuario, 'api', v_peca.setor_atual_id,
                    'Usada pelo pedido ' || coalesce(v_numero::text, '')
                      || format(' (%s/%s) — concluído pelo super admin.', k, it.unidades),
                    jsonb_build_object('pedido_id', v_card.pedido_id, 'numero', v_numero,
                                       'card_pedido_id', v_card.id, 'unidade_card_id', v_novo,
                                       'item_seq', it.seq, 'indice_unidade', k, 'reservada', true));
          v_usadas := v_usadas + 1;
        else
          v_criadas := v_criadas + 1;
        end if;
      end if;
    end loop;
  end loop;

  perform plt_privado.fn_recalcular_liberacao(v_card.pedido_id);
  perform set_config('plt.estoque_maquinaria', coalesce(v_marca_m, ''), true);
  perform set_config('plt.ajuste_super_admin', coalesce(v_marca_a, ''), true);

  return jsonb_build_object('concluido', true, 'numero', v_numero, 'ja_prontas', v_ja,
                            'movidas', v_movidas, 'criadas', v_criadas,
                            'pecas_do_estoque', v_usadas, 'arquivadas_puladas', v_pulados);
end;
$$;

-- ----------------------------------------------------------------------------
-- 10 · Grants da maquinaria (fora da API) e a carga inicial da projeção
-- ----------------------------------------------------------------------------
revoke all on function plt_privado.fn_estoque_produto_da_peca(bigint, bigint, text, text) from public, anon, authenticated;
revoke all on function plt_privado.fn_estoque_categoria(bigint, bigint, timestamptz, timestamptz, text, text) from public, anon, authenticated;
revoke all on function plt_privado.fn_estoque_contar(bigint) from public, anon, authenticated;
revoke all on function plt_privado.fn_estoque_numeros_cards() from public, anon, authenticated;
revoke all on function plt_privado.fn_estoque_numeros_recontar() from public, anon, authenticated;
revoke all on function plt_privado.fn_estoque_vendas_atualizar() from public, anon, authenticated;
revoke all on function plt_privado.fn_leitura_tiny(jsonb, timestamptz, bigint) from public, anon, authenticated;
revoke all on function plt_privado.fn_estoque_numeros_leitura(bigint) from public, anon, authenticated;
revoke all on function plt_privado.fn_estoque_leituras_recarregar() from public, anon, authenticated;
revoke all on function plt_privado.fn_estoque_reservas_loja() from public, anon, authenticated;

do $$
begin
  perform plt_privado.fn_estoque_numeros_recontar();
  perform plt_privado.fn_estoque_vendas_atualizar();
  perform plt_privado.fn_estoque_leituras_recarregar();
end;
$$;
