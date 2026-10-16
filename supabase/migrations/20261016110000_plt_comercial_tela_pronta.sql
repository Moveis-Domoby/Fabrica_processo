-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 86 — COMERCIAL: A TELA PRONTA NO
-- BANCO (SESSAO-32 · dívida 5 da lei · pedido do dono em 16/10/2026)
--
-- "Vi que o módulo comercial ainda está bem lento, ele está carregando todos
-- os pedidos de uma única vez (…) ajuste também para que a ida ao banco
-- quando o filtro for todo o período, a tela já esteja montada lá e me
-- devolva de forma quase instantânea".
--
-- Antes: vendas_marketing era VIEW — cada leitura do Comercial abria os
-- 5.568 pedidos inteiros (o JSON completo do Tiny, ~14 MB) para tirar nome,
-- itens e data (3,3 s só a view), e o "intervalo da 1ª para a 2ª compra"
-- comparava cada cliente com todos os pedidos (cresce ao quadrado). No site:
-- Painel de Recompra 1,8–2,4 s por leitura, todas sobre o período inteiro.
--
-- Agora a tela fica PRONTA no banco e se atualiza no FATO — a gravação do
-- pedido (n8n → fn_upsert_pedido) e a troca do telefone do cliente. Os
-- gatilhos seguem o padrão dos da plataforma em pedidos: à prova de falha —
-- um erro aqui NUNCA derruba a gravação do Tiny; o pedido vai para
-- plt_comercial_pendentes e a próxima gravação refaz.
--   · plt_comercial_vendas   — um pedido por linha, já desmontado (as mesmas
--     colunas da vendas_marketing + a chave do cliente, os nomes dos itens
--     como as portas sempre leram, a ordem da compra na vida do cliente e a
--     data da compra anterior);
--   · plt_comercial_clientes — a vida de cada cliente (pedidos, faturamento,
--     itens, 1ª/última compra, intervalo da 1ª para a 2ª);
--   · plt_comercial_mes / plt_comercial_itens_mes — faturamento, pedidos e
--     itens por mês (gráficos do período inteiro e dos meses fechados).
-- vendas_marketing e vw_clientes_consolidados continuam com as MESMAS colunas
-- e o mesmo gate — agora lendo a tela pronta. As 11 portas do Comercial que
-- liam a view passam a ler as tabelas prontas; o "período inteiro sem busca
-- nem produto" sai direto da vida de cada cliente. Mesmo resultado: bateria
-- (bloco 86, porta antiga × nova) e banco real numa transação desfeita.
-- Nada muda nas colunas da integração (só os gatilhos novos em pedidos e
-- clientes, como os da plataforma que já existem lá).
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · As tabelas prontas (só a plataforma escreve; ninguém lê direto)
-- ----------------------------------------------------------------------------
create table if not exists public.plt_comercial_vendas (
  pedido_id            bigint primary key,            -- pedidos.id
  id                   uuid not null,                 -- md5('vendas_marketing:' || numero)
  numero_pedido        varchar not null,
  nome_cliente         varchar,                       -- snapshot raw->'cliente'->>'nome', SEM trim
  telefone_cliente     varchar,                       -- clientes.fone, senão o celular do cadastro
  cid                  text,                          -- a chave do cliente (telefone, senão o nome)
  telefone_digitos     text,                          -- só os dígitos (a busca por telefone)
  telefone_normalizado text,                          -- sem o 55 (a atribuição do disparo)
  data_compra          timestamptz,                   -- meia-noite de São Paulo do data_pedido
  mes                  text,                          -- 'YYYY-MM' da data_compra
  valor_pedido         numeric(10,2),
  numero_itens         integer not null default 0,
  itens_comprados      jsonb not null default '[]'::jsonb,
  item_nomes           text[] not null default '{}',  -- um nome por item (repete), como as portas leem
  ordem_cliente        integer,                       -- 1ª, 2ª… compra do cliente (por data)
  data_anterior        timestamptz,                   -- a data da compra anterior do mesmo cliente
  created_at           timestamptz
);

comment on table public.plt_comercial_vendas is
  'SESSAO-32 (migration 86): a vendas_marketing PRONTA — um pedido por linha, desmontado uma vez na gravação (gatilho em pedidos/clientes). Só a plataforma escreve; a view vendas_marketing e as portas do Comercial leem daqui.';

create index if not exists plt_comercial_vendas_data_idx      on public.plt_comercial_vendas (data_compra);
create index if not exists plt_comercial_vendas_cid_idx       on public.plt_comercial_vendas (cid, data_compra);
create index if not exists plt_comercial_vendas_cid_nulo_idx  on public.plt_comercial_vendas (pedido_id) where cid is null;
create index if not exists plt_comercial_vendas_sem_data_idx  on public.plt_comercial_vendas (pedido_id) where mes is null;
create index if not exists plt_comercial_vendas_fone_idx      on public.plt_comercial_vendas (telefone_cliente);
create index if not exists plt_comercial_vendas_nome_idx      on public.plt_comercial_vendas (nome_cliente);
create index if not exists plt_comercial_vendas_nome_trgm_idx on public.plt_comercial_vendas using gin (nome_cliente extensions.gin_trgm_ops);
create index if not exists plt_comercial_vendas_disparo_idx   on public.plt_comercial_vendas (telefone_normalizado, data_compra);
create index if not exists plt_comercial_vendas_itens_idx     on public.plt_comercial_vendas using gin (item_nomes);
create index if not exists plt_comercial_vendas_ordem_idx     on public.plt_comercial_vendas (ordem_cliente, data_compra) where ordem_cliente > 1;

create table if not exists public.plt_comercial_clientes (
  cid               text primary key,
  nome_max          text,
  telefone_max      text,
  pedidos_vida      integer not null,
  faturamento_vida  numeric,
  itens_vida        bigint not null default 0,
  primeira_compra   timestamptz,
  ultima_compra     timestamptz,
  gap_dias          numeric                           -- dias da 1ª para a 2ª compra (nulo com 1 compra)
);

comment on table public.plt_comercial_clientes is
  'SESSAO-32 (migration 86): a vida de cada cliente do Comercial (chave = telefone, senão o nome) — refeita no fato a cada pedido do cliente. O "período inteiro" do Painel de Recompra sai daqui.';

create index if not exists plt_comercial_clientes_ultima_idx  on public.plt_comercial_clientes (ultima_compra desc, cid);
create index if not exists plt_comercial_clientes_pedidos_idx on public.plt_comercial_clientes (pedidos_vida desc, faturamento_vida desc, cid);
create index if not exists plt_comercial_clientes_fat_idx     on public.plt_comercial_clientes (faturamento_vida desc nulls last, pedidos_vida desc, cid);

create table if not exists public.plt_comercial_mes (
  mes      text primary key,                          -- 'YYYY-MM'
  receita  numeric not null default 0,
  pedidos  integer not null default 0
);

create table if not exists public.plt_comercial_itens_mes (
  mes         text not null,
  item_nome   text not null,
  quantidade  integer not null default 0,
  primary key (mes, item_nome)
);

create table if not exists public.plt_comercial_pendentes (
  pedido_id   bigint primary key,
  erro        text,
  tentativas  integer not null default 0,
  em          timestamptz not null default now()
);

comment on table public.plt_comercial_pendentes is
  'SESSAO-32 (migration 86): pedido cuja tela pronta do Comercial não deu para refazer na gravação (o gatilho nunca derruba o Tiny). A próxima gravação de pedido refaz (até 5 tentativas); fn_comercial_reconstruir refaz tudo.';

alter table public.plt_comercial_vendas    enable row level security;
alter table public.plt_comercial_clientes  enable row level security;
alter table public.plt_comercial_mes       enable row level security;
alter table public.plt_comercial_itens_mes enable row level security;
alter table public.plt_comercial_pendentes enable row level security;
revoke all on public.plt_comercial_vendas, public.plt_comercial_clientes, public.plt_comercial_mes,
              public.plt_comercial_itens_mes, public.plt_comercial_pendentes from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2 · A maquinaria (plt_privado — ninguém de fora executa)
-- ----------------------------------------------------------------------------

-- Os nomes dos itens exatamente como as portas do recompra sempre leram: a
-- cascata de caminhos, o texto JSON e o TRIM das aspas; um por item (repete).
create or replace function plt_privado.fn_comercial_itens_nomes(p_itens jsonb)
returns text[]
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(trim(both '"' from x.i_name) order by x.ord), '{}'::text[])
    from (
      select e.ord,
             coalesce(
               nullif(jsonb_path_query_first(e.item, '$.item.produto.descricao')::text, 'null'),
               nullif(jsonb_path_query_first(e.item, '$.item.produto.nome')::text, 'null'),
               nullif(jsonb_path_query_first(e.item, '$.produto.descricao')::text, 'null'),
               nullif(jsonb_path_query_first(e.item, '$.produto.nome')::text, 'null'),
               nullif(jsonb_path_query_first(e.item, '$.item.descricao')::text, 'null'),
               nullif(jsonb_path_query_first(e.item, '$.item.nome')::text, 'null'),
               nullif(jsonb_path_query_first(e.item, '$.descricao')::text, 'null'),
               nullif(jsonb_path_query_first(e.item, '$.nome')::text, 'null'),
               nullif(jsonb_path_query_first(e.item, '$.name')::text, 'null'),
               case when jsonb_typeof(e.item) = 'string' then e.item::text else null end
             ) as i_name
        from jsonb_array_elements(
               case
                 when jsonb_typeof(p_itens) = 'array' then p_itens
                 when jsonb_typeof(p_itens) = 'string' and (p_itens #>> '{}') like '[%' then (p_itens #>> '{}')::jsonb
                 else '[]'::jsonb
               end) with ordinality as e(item, ord)
    ) x
   where x.i_name is not null and x.i_name <> 'null';
$$;

-- A linha da venda, com as MESMAS expressões da view vendas_marketing de
-- sempre (migration 26). p_ids nulo = todos os pedidos (a reconstrução).
create or replace function plt_privado.fn_comercial_vendas_de(p_ids bigint[])
returns table (
  pedido_id bigint, id uuid, numero_pedido varchar, nome_cliente varchar, telefone_cliente varchar,
  cid text, telefone_digitos text, telefone_normalizado text, data_compra timestamptz, mes text,
  valor_pedido numeric(10,2), numero_itens integer, itens_comprados jsonb, item_nomes text[], created_at timestamptz
)
language sql
stable
set search_path = public, pg_temp
as $$
  select b.pedido_id, b.id, b.numero_pedido, b.nome_cliente, b.telefone_cliente,
         coalesce(nullif(trim(b.telefone_cliente), ''), b.nome_cliente::text),
         regexp_replace(b.telefone_cliente, '\D', '', 'g'),
         case
           when length(regexp_replace(coalesce(b.telefone_cliente, ''), '\D', '', 'g')) > 11
                and regexp_replace(coalesce(b.telefone_cliente, ''), '\D', '', 'g') like '55%'
             then substring(regexp_replace(coalesce(b.telefone_cliente, ''), '\D', '', 'g') from 3)
           else regexp_replace(coalesce(b.telefone_cliente, ''), '\D', '', 'g')
         end,
         b.data_compra,
         to_char(b.data_compra at time zone 'America/Sao_Paulo', 'YYYY-MM'),
         b.valor_pedido, b.numero_itens, b.itens_comprados,
         plt_privado.fn_comercial_itens_nomes(b.itens_comprados),
         b.created_at
    from (
      select p.id                                                           as pedido_id,
             md5('vendas_marketing:' || p.numero)::uuid                     as id,
             p.numero::varchar                                              as numero_pedido,
             (p.raw->'cliente'->>'nome')::varchar                           as nome_cliente,
             coalesce(nullif(trim(c.fone), ''),
                      nullif(trim(c.raw->>'celular'), ''))::varchar         as telefone_cliente,
             (p.data_pedido::timestamp) at time zone 'America/Sao_Paulo'    as data_compra,
             p.total_pedido::numeric(10,2)                                  as valor_pedido,
             coalesce(jsonb_array_length(p.raw->'itens'), 0)::integer       as numero_itens,
             coalesce(
               (select jsonb_agg(jsonb_build_object(
                         'produto',       jsonb_build_object('descricao', e->'item'->>'descricao'),
                         'quantidade',    (e->'item'->>'quantidade')::numeric,
                         'valorUnitario', (e->'item'->>'valor_unitario')::numeric))
                  from jsonb_array_elements(p.raw->'itens') e),
               '[]'::jsonb)                                                 as itens_comprados,
             p.criado_em                                                    as created_at
        from public.pedidos p
        left join public.clientes c on c.id = p.cliente_id
       where p_ids is null or p.id = any(p_ids)
    ) b;
$$;

-- A ordem de cada compra na vida do cliente e a data da anterior (o que as
-- portas de transição calculavam a cada leitura).
create or replace function plt_privado.fn_comercial_sequencia(p_cids text[], p_nulo boolean)
returns void
language sql
set search_path = public, pg_temp
as $$
  with s as (
    select v.pedido_id,
           row_number() over w  as ordem,
           lag(v.data_compra) over w as anterior
      from public.plt_comercial_vendas v
     where v.cid = any(p_cids) or (p_nulo and v.cid is null)
    window w as (partition by v.cid order by v.data_compra, v.pedido_id)
  )
  update public.plt_comercial_vendas v
     set ordem_cliente = s.ordem, data_anterior = s.anterior
    from s
   where v.pedido_id = s.pedido_id
     and (v.ordem_cliente is distinct from s.ordem::int or v.data_anterior is distinct from s.anterior);
$$;

-- A vida dos clientes indicados (some quem ficou sem pedido).
create or replace function plt_privado.fn_comercial_clientes_refazer(p_cids text[])
returns void
language sql
set search_path = public, pg_temp
as $$
  delete from public.plt_comercial_clientes c
   where c.cid = any(p_cids)
     and not exists (select 1 from public.plt_comercial_vendas v where v.cid = c.cid);
  insert into public.plt_comercial_clientes as c
         (cid, nome_max, telefone_max, pedidos_vida, faturamento_vida, itens_vida, primeira_compra, ultima_compra, gap_dias)
  select v.cid, max(v.nome_cliente::text), max(v.telefone_cliente::text), count(*), sum(v.valor_pedido),
         coalesce(sum(v.numero_itens), 0), min(v.data_compra), max(v.data_compra),
         max(extract(day from (v.data_compra - v.data_anterior))) filter (where v.ordem_cliente = 2)
    from public.plt_comercial_vendas v
   where v.cid = any(p_cids)
   group by v.cid
  on conflict (cid) do update
     set nome_max = excluded.nome_max, telefone_max = excluded.telefone_max,
         pedidos_vida = excluded.pedidos_vida, faturamento_vida = excluded.faturamento_vida,
         itens_vida = excluded.itens_vida, primeira_compra = excluded.primeira_compra,
         ultima_compra = excluded.ultima_compra, gap_dias = excluded.gap_dias;
$$;

-- Soma (p_sinal = 1) ou tira (-1) um pedido das contas do mês e dos itens do mês.
create or replace function plt_privado.fn_comercial_mes_aplicar(p_mes text, p_valor numeric, p_itens text[], p_sinal integer)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if p_mes is null then
    return;
  end if;
  insert into public.plt_comercial_mes as m (mes, receita, pedidos)
  values (p_mes, coalesce(p_valor, 0) * p_sinal, p_sinal)
  on conflict (mes) do update
     set receita = m.receita + excluded.receita, pedidos = m.pedidos + excluded.pedidos;
  delete from public.plt_comercial_mes where mes = p_mes and pedidos <= 0;

  if coalesce(array_length(p_itens, 1), 0) > 0 then
    -- ordem fixa por nome: duas gravações ao mesmo tempo nunca se travam em cruz
    insert into public.plt_comercial_itens_mes as i (mes, item_nome, quantidade)
    select p_mes, n, (count(*) * p_sinal)::integer
      from unnest(p_itens) as n
     group by n
     order by n
    on conflict (mes, item_nome) do update set quantidade = i.quantidade + excluded.quantidade;
    delete from public.plt_comercial_itens_mes
     where mes = p_mes and item_nome = any(p_itens) and quantidade <= 0;
  end if;
end;
$$;

-- Refaz a tela pronta de UM pedido (inserido, mudado ou apagado).
create or replace function plt_privado.fn_comercial_refazer_pedido(p_pedido_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_antes  public.plt_comercial_vendas%rowtype;
  v_novo   record;
  v_cids   text[] := '{}';
  v_nulo   boolean := false;
begin
  select * into v_antes from public.plt_comercial_vendas where pedido_id = p_pedido_id;
  if found then
    perform plt_privado.fn_comercial_mes_aplicar(v_antes.mes, v_antes.valor_pedido, v_antes.item_nomes, -1);
    if v_antes.cid is null then v_nulo := true; else v_cids := v_cids || v_antes.cid; end if;
    delete from public.plt_comercial_vendas where pedido_id = p_pedido_id;
  end if;

  select * into v_novo from plt_privado.fn_comercial_vendas_de(array[p_pedido_id]);
  if found then
    insert into public.plt_comercial_vendas
           (pedido_id, id, numero_pedido, nome_cliente, telefone_cliente, cid, telefone_digitos, telefone_normalizado,
            data_compra, mes, valor_pedido, numero_itens, itens_comprados, item_nomes, created_at)
    values (v_novo.pedido_id, v_novo.id, v_novo.numero_pedido, v_novo.nome_cliente, v_novo.telefone_cliente,
            v_novo.cid, v_novo.telefone_digitos, v_novo.telefone_normalizado, v_novo.data_compra, v_novo.mes,
            v_novo.valor_pedido, v_novo.numero_itens, v_novo.itens_comprados, v_novo.item_nomes, v_novo.created_at);
    perform plt_privado.fn_comercial_mes_aplicar(v_novo.mes, v_novo.valor_pedido, v_novo.item_nomes, 1);
    if v_novo.cid is null then v_nulo := true; elsif not (v_novo.cid = any(v_cids)) then v_cids := v_cids || v_novo.cid; end if;
  end if;

  if coalesce(array_length(v_cids, 1), 0) > 0 or v_nulo then
    perform plt_privado.fn_comercial_sequencia(v_cids, v_nulo);
    perform plt_privado.fn_comercial_clientes_refazer(v_cids);
  end if;
  -- refeito: se estava anotado como pendente, deixa de estar
  delete from public.plt_comercial_pendentes where pedido_id = p_pedido_id;
end;
$$;

-- O que ficou pendente de uma falha anterior: cada um no seu próprio bloco
-- (um pedido que insiste em falhar nunca contamina os outros).
create or replace function plt_privado.fn_comercial_refazer_pendentes(p_max integer)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r     record;
  v_ok  integer := 0;
begin
  for r in
    select pedido_id from public.plt_comercial_pendentes
     where tentativas < 5
     order by em
     limit greatest(coalesce(p_max, 5), 1)
     for update skip locked
  loop
    begin
      perform plt_privado.fn_comercial_refazer_pedido(r.pedido_id);
      delete from public.plt_comercial_pendentes where pedido_id = r.pedido_id;
      v_ok := v_ok + 1;
    exception when others then
      update public.plt_comercial_pendentes
         set erro = left(sqlerrm, 500), tentativas = tentativas + 1, em = now()
       where pedido_id = r.pedido_id;
    end;
  end loop;
  return v_ok;
end;
$$;

-- Anota um pedido para refazer depois — nunca levanta erro.
create or replace function plt_privado.fn_comercial_anotar_pendente(p_pedido_id bigint, p_erro text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.plt_comercial_pendentes (pedido_id, erro)
  values (p_pedido_id, left(p_erro, 500))
  on conflict (pedido_id) do update set erro = excluded.erro, em = now();
exception when others then
  raise warning 'Comercial: não deu para anotar o pedido % para refazer: %', p_pedido_id, sqlerrm;
end;
$$;

-- O gatilho dos pedidos — À PROVA DE FALHA: nada aqui derruba a gravação do Tiny.
create or replace function plt_privado.fn_comercial_pedido_mudou()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint := case when tg_op = 'DELETE' then old.id else new.id end;
begin
  begin
    perform plt_privado.fn_comercial_refazer_pedido(v_id);
  exception when others then
    perform plt_privado.fn_comercial_anotar_pendente(v_id, sqlerrm);
  end;
  begin
    if exists (select 1 from public.plt_comercial_pendentes where tentativas < 5 and pedido_id <> v_id) then
      perform plt_privado.fn_comercial_refazer_pendentes(3);
    end if;
  exception when others then
    raise warning 'Comercial: pendentes não refeitos agora: %', sqlerrm;
  end;
  return null;
end;
$$;

-- O gatilho do cliente: mudou o telefone (fone ou celular) → os pedidos dele
-- mudam de chave. Cada pedido no seu bloco; nunca derruba a gravação.
create or replace function plt_privado.fn_comercial_cliente_mudou()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
begin
  for r in select p.id from public.pedidos p where p.cliente_id = new.id loop
    begin
      perform plt_privado.fn_comercial_refazer_pedido(r.id);
    exception when others then
      perform plt_privado.fn_comercial_anotar_pendente(r.id, sqlerrm);
    end;
  end loop;
  return null;
exception when others then
  raise warning 'Comercial: cliente % não refeito agora: %', new.id, sqlerrm;
  return null;
end;
$$;

-- Refaz TUDO a partir dos pedidos (a carga inicial e o conserto geral).
create or replace function plt_privado.fn_comercial_reconstruir()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer;
begin
  delete from public.plt_comercial_itens_mes;
  delete from public.plt_comercial_mes;
  delete from public.plt_comercial_clientes;
  delete from public.plt_comercial_vendas;

  insert into public.plt_comercial_vendas
         (pedido_id, id, numero_pedido, nome_cliente, telefone_cliente, cid, telefone_digitos, telefone_normalizado,
          data_compra, mes, valor_pedido, numero_itens, itens_comprados, item_nomes, created_at)
  select b.pedido_id, b.id, b.numero_pedido, b.nome_cliente, b.telefone_cliente, b.cid, b.telefone_digitos,
         b.telefone_normalizado, b.data_compra, b.mes, b.valor_pedido, b.numero_itens, b.itens_comprados,
         b.item_nomes, b.created_at
    from plt_privado.fn_comercial_vendas_de(null) b;
  get diagnostics v_n = row_count;

  with s as (
    select v.pedido_id, row_number() over w as ordem, lag(v.data_compra) over w as anterior
      from public.plt_comercial_vendas v
    window w as (partition by v.cid order by v.data_compra, v.pedido_id)
  )
  update public.plt_comercial_vendas v
     set ordem_cliente = s.ordem, data_anterior = s.anterior
    from s where v.pedido_id = s.pedido_id;

  insert into public.plt_comercial_clientes
         (cid, nome_max, telefone_max, pedidos_vida, faturamento_vida, itens_vida, primeira_compra, ultima_compra, gap_dias)
  select v.cid, max(v.nome_cliente::text), max(v.telefone_cliente::text), count(*), sum(v.valor_pedido),
         coalesce(sum(v.numero_itens), 0), min(v.data_compra), max(v.data_compra),
         max(extract(day from (v.data_compra - v.data_anterior))) filter (where v.ordem_cliente = 2)
    from public.plt_comercial_vendas v
   where v.cid is not null
   group by v.cid;

  insert into public.plt_comercial_mes (mes, receita, pedidos)
  select v.mes, coalesce(sum(v.valor_pedido), 0), count(*)
    from public.plt_comercial_vendas v
   where v.mes is not null
   group by v.mes;

  insert into public.plt_comercial_itens_mes (mes, item_nome, quantidade)
  select v.mes, n, count(*)
    from public.plt_comercial_vendas v
   cross join lateral unnest(v.item_nomes) as n
   where v.mes is not null
   group by v.mes, n;

  delete from public.plt_comercial_pendentes;
  return v_n;
end;
$$;

-- Confere a tela pronta contra os pedidos (0 = idêntica). Só leitura; para a
-- bateria, a conferência depois de aplicar e a manutenção.
create or replace function plt_privado.fn_comercial_conferir()
returns table (parte text, diferencas bigint)
language sql
stable
set search_path = public, pg_temp
as $$
  with base as (
    select b.*, row_number() over w as ordem, lag(b.data_compra) over w as anterior
      from plt_privado.fn_comercial_vendas_de(null) b
    window w as (partition by b.cid order by b.data_compra, b.pedido_id)
  ),
  cli as (
    select b.cid, max(b.nome_cliente::text) as nome_max, max(b.telefone_cliente::text) as telefone_max,
           count(*)::int as pedidos_vida, sum(b.valor_pedido) as faturamento_vida,
           coalesce(sum(b.numero_itens), 0)::bigint as itens_vida, min(b.data_compra) as primeira_compra,
           max(b.data_compra) as ultima_compra,
           max(extract(day from (b.data_compra - b.anterior))) filter (where b.ordem = 2) as gap_dias
      from base b where b.cid is not null group by b.cid
  ),
  mes as (
    select b.mes, coalesce(sum(b.valor_pedido), 0) as receita, count(*)::int as pedidos
      from base b where b.mes is not null group by b.mes
  ),
  itm as (
    select b.mes, n as item_nome, count(*)::int as quantidade
      from base b cross join lateral unnest(b.item_nomes) as n where b.mes is not null group by b.mes, n
  )
  select 'vendas', count(*)
    from base b full join public.plt_comercial_vendas v on v.pedido_id = b.pedido_id
   where b.pedido_id is null or v.pedido_id is null
      or (b.id, b.numero_pedido, b.nome_cliente, b.telefone_cliente, b.cid, b.telefone_digitos, b.telefone_normalizado,
          b.data_compra, b.mes, b.valor_pedido, b.numero_itens, b.itens_comprados, b.item_nomes, b.ordem::int,
          b.anterior, b.created_at)
         is distinct from
         (v.id, v.numero_pedido, v.nome_cliente, v.telefone_cliente, v.cid, v.telefone_digitos, v.telefone_normalizado,
          v.data_compra, v.mes, v.valor_pedido, v.numero_itens, v.itens_comprados, v.item_nomes, v.ordem_cliente,
          v.data_anterior, v.created_at)
  union all
  select 'clientes', count(*)
    from cli f full join public.plt_comercial_clientes c on c.cid = f.cid
   where f.cid is null or c.cid is null
      or (f.nome_max, f.telefone_max, f.pedidos_vida, f.faturamento_vida, f.itens_vida, f.primeira_compra,
          f.ultima_compra, f.gap_dias)
         is distinct from
         (c.nome_max, c.telefone_max, c.pedidos_vida, c.faturamento_vida, c.itens_vida, c.primeira_compra,
          c.ultima_compra, c.gap_dias)
  union all
  select 'meses', count(*)
    from mes f full join public.plt_comercial_mes m on m.mes = f.mes
   where f.mes is null or m.mes is null or (f.receita, f.pedidos) is distinct from (m.receita, m.pedidos)
  union all
  select 'itens_por_mes', count(*)
    from itm f full join public.plt_comercial_itens_mes i on i.mes = f.mes and i.item_nome = f.item_nome
   where f.mes is null or i.mes is null or f.quantidade is distinct from i.quantidade
  union all
  select 'pendentes', count(*) from public.plt_comercial_pendentes;
$$;

-- Um intervalo [início, fim] que cobre meses INTEIROS de São Paulo? (as datas
-- de compra são sempre meia-noite de São Paulo). Devolve o 1º e o último mês
-- (nulo = aberto); nenhuma linha = não cobre meses inteiros.
create or replace function plt_privado.fn_comercial_meses_inteiros(p_start timestamptz, p_end timestamptz)
returns table (mes_ini text, mes_fim text)
language sql
stable
set search_path = public, pg_temp
as $$
  with d as (
    select case when p_start is null then null
                else (p_start at time zone 'America/Sao_Paulo')::date
                     + case when (p_start at time zone 'America/Sao_Paulo')::time > time '00:00' then 1 else 0 end
           end as d_ini,
           case when p_end is null then null else (p_end at time zone 'America/Sao_Paulo')::date end as d_fim
  )
  select to_char(d.d_ini, 'YYYY-MM'), to_char(d.d_fim, 'YYYY-MM')
    from d
   where (d.d_ini is null or extract(day from d.d_ini) = 1)
     and (d.d_fim is null or extract(day from (d.d_fim + 1)) = 1);
$$;

revoke all on function plt_privado.fn_comercial_itens_nomes(jsonb)                       from public, anon, authenticated;
revoke all on function plt_privado.fn_comercial_vendas_de(bigint[])                      from public, anon, authenticated;
revoke all on function plt_privado.fn_comercial_sequencia(text[], boolean)               from public, anon, authenticated;
revoke all on function plt_privado.fn_comercial_clientes_refazer(text[])                 from public, anon, authenticated;
revoke all on function plt_privado.fn_comercial_mes_aplicar(text, numeric, text[], integer) from public, anon, authenticated;
revoke all on function plt_privado.fn_comercial_refazer_pedido(bigint)                   from public, anon, authenticated;
revoke all on function plt_privado.fn_comercial_refazer_pendentes(integer)               from public, anon, authenticated;
revoke all on function plt_privado.fn_comercial_anotar_pendente(bigint, text)            from public, anon, authenticated;
revoke all on function plt_privado.fn_comercial_pedido_mudou()                           from public, anon, authenticated;
revoke all on function plt_privado.fn_comercial_cliente_mudou()                          from public, anon, authenticated;
revoke all on function plt_privado.fn_comercial_reconstruir()                            from public, anon, authenticated;
revoke all on function plt_privado.fn_comercial_conferir()                               from public, anon, authenticated;
revoke all on function plt_privado.fn_comercial_meses_inteiros(timestamptz, timestamptz) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3 · As views de sempre, lendo a tela pronta (mesmas colunas, mesmo gate)
-- ----------------------------------------------------------------------------
create or replace view public.vendas_marketing as
select v.id, v.numero_pedido, v.nome_cliente, v.telefone_cliente, v.data_compra,
       v.valor_pedido, v.numero_itens, v.itens_comprados, v.created_at
  from public.plt_comercial_vendas v
 where (select plt_privado.fn_tem_modulo('comercial'));

comment on view public.vendas_marketing is
  'View de compatibilidade do módulo Comercial (D-47): o shape da tabela-fato do recompra. Desde a migration 86 (SESSAO-32) lê a tela pronta plt_comercial_vendas (desmontada na gravação do pedido). Gate de módulo no WHERE.';

create or replace view public.vw_clientes_consolidados
with (security_invoker = on) as
select c.cid                    as id_cliente,
       c.nome_max               as nome_cliente,
       c.telefone_max           as telefone_cliente,
       c.pedidos_vida::bigint   as total_pedidos,
       c.faturamento_vida       as faturamento_total,
       c.itens_vida             as total_itens,
       c.primeira_compra,
       c.ultima_compra
  from public.plt_comercial_clientes c
 where (select plt_privado.fn_tem_modulo('comercial'))
union all
-- pedidos sem telefone nem nome viram um "cliente" sem chave, como sempre foi
select null::text, max(v.nome_cliente::text), max(v.telefone_cliente::text), count(*), sum(v.valor_pedido),
       sum(v.numero_itens), min(v.data_compra), max(v.data_compra)
  from public.plt_comercial_vendas v
 where v.cid is null and (select plt_privado.fn_tem_modulo('comercial'))
having count(*) > 0;

-- ----------------------------------------------------------------------------
-- 4 · As portas do Comercial lendo a tela pronta (mesma assinatura, mesmo
--     resultado; desempate fixo onde a ordem antiga era sorteio)
-- ----------------------------------------------------------------------------
create or replace function public.fn_filter_customers(p_filters jsonb, p_limit integer default 20, p_offset integer default 0)
 returns table(nome_cliente text, telefone_cliente text, quantidade_pedidos integer, faturamento_total numeric, total_itens integer, data_primeira_compra timestamp with time zone, ultima_compra timestamp with time zone, pedidos_vida integer, is_recorrente boolean, total_count bigint)
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
    v_search_query text;
    v_date_filter text;
    v_custom_start timestamp with time zone;
    v_custom_end timestamp with time zone;
    v_selected_items text[];
    v_purchase_count text[];
    v_inactive_before timestamp with time zone;
    v_recompra_min integer;
    v_recompra_max integer;
    v_spend_amount numeric;
    v_spend_type text;
    v_spend_mode text;
    v_digitos text;
begin
    perform plt_privado.fn_negar_sem_modulo('comercial');
    v_search_query := p_filters->>'searchQuery';
    v_date_filter := p_filters->>'dateFilter';
    if p_filters->>'customDateStart' is not null and p_filters->>'customDateStart' <> '' then
        v_custom_start := (p_filters->>'customDateStart')::timestamp with time zone;
    end if;
    if p_filters->>'customDateEnd' is not null and p_filters->>'customDateEnd' <> '' then
        v_custom_end := (p_filters->>'customDateEnd')::timestamp with time zone;
    end if;
    if v_date_filter = 'specificYear' then
        v_custom_start := date_trunc('year', to_date(p_filters->>'specificYear', 'YYYY'));
        v_custom_end := v_custom_start + interval '1 year' - interval '1 microsecond';
    elsif v_date_filter = 'specificMonth' then
        v_custom_start := date_trunc('month', to_date(p_filters->>'specificMonth', 'YYYY-MM'));
        v_custom_end := v_custom_start + interval '1 month' - interval '1 microsecond';
    elsif v_date_filter = 'specificDay' then
        v_custom_start := date_trunc('day', to_date(p_filters->>'specificDay', 'YYYY-MM-DD'));
        v_custom_end := v_custom_start + interval '1 day' - interval '1 microsecond';
    end if;
    if p_filters ? 'selectedItems' and jsonb_array_length(p_filters->'selectedItems') > 0 and not (p_filters->'selectedItems') @> '["all"]' then
        select array_agg(value) into v_selected_items from jsonb_array_elements_text(p_filters->'selectedItems');
    end if;
    if p_filters ? 'purchaseCount' and jsonb_array_length(p_filters->'purchaseCount') > 0 and not (p_filters->'purchaseCount') @> '["all"]' then
        select array_agg(value) into v_purchase_count from jsonb_array_elements_text(p_filters->'purchaseCount');
    end if;
    if p_filters->>'inactiveBeforeDate' is not null and p_filters->>'inactiveBeforeDate' <> '' then
        v_inactive_before := (p_filters->>'inactiveBeforeDate')::timestamp with time zone;
    end if;
    if p_filters->>'recompraMinDays' is not null and p_filters->>'recompraMinDays' <> '' then
        v_recompra_min := (p_filters->>'recompraMinDays')::integer;
    end if;
    if p_filters->>'recompraMaxDays' is not null and p_filters->>'recompraMaxDays' <> '' then
        v_recompra_max := (p_filters->>'recompraMaxDays')::integer;
    end if;
    if p_filters->>'spendAmount' is not null and p_filters->>'spendAmount' <> '' then
        v_spend_amount := (p_filters->>'spendAmount')::numeric;
    end if;
    v_spend_type := p_filters->>'spendType';
    v_spend_mode := p_filters->>'spendMode';
    v_digitos := regexp_replace(coalesce(v_search_query, ''), '\D', '', 'g');

    -- O período inteiro sem busca nem produto: a tela já está pronta — a vida
    -- de cada cliente É o recorte (mesmos números de sempre, sem somar nada).
    if ((v_date_filter = 'all' or v_date_filter is null) or (v_custom_start is null and v_custom_end is null))
       and coalesce(v_search_query, '') = '' and v_selected_items is null then
        return query
        with f as (
            select c.* from public.plt_comercial_clientes c
             where (v_inactive_before is null or c.ultima_compra <= v_inactive_before)
               and (v_purchase_count is null or (
                    case when '10+' = any(v_purchase_count) and c.pedidos_vida >= 10 then true
                         else c.pedidos_vida::text = any(v_purchase_count)
                    end))
               and (v_recompra_min is null or c.gap_dias >= v_recompra_min)
               and (v_recompra_max is null or c.gap_dias <= v_recompra_max)
               and (v_spend_amount is null or (
                    case when v_spend_type = 'total' then
                        case when v_spend_mode = 'above' then c.faturamento_vida >= v_spend_amount
                             when v_spend_mode = 'below' then c.faturamento_vida <= v_spend_amount
                             else c.faturamento_vida between (v_spend_amount * 0.9) and (v_spend_amount * 1.1)
                        end
                    else
                        case when v_spend_mode = 'above' then (c.faturamento_vida / nullif(c.pedidos_vida, 0)) >= v_spend_amount
                             when v_spend_mode = 'below' then (c.faturamento_vida / nullif(c.pedidos_vida, 0)) <= v_spend_amount
                             else (c.faturamento_vida / nullif(c.pedidos_vida, 0)) between (v_spend_amount * 0.9) and (v_spend_amount * 1.1)
                        end
                    end))
        )
        select f.nome_max, f.telefone_max, f.pedidos_vida, f.faturamento_vida, f.itens_vida::integer,
               f.primeira_compra, f.ultima_compra, f.pedidos_vida, f.pedidos_vida >= 2,
               (select count(*) from f)
          from f
         order by f.ultima_compra desc, f.cid
         limit p_limit offset p_offset;
        return;
    end if;

    return query
    with period_records as (
        select v.cid, v.nome_cliente, v.telefone_cliente, v.valor_pedido, v.numero_itens, v.data_compra
          from public.plt_comercial_vendas v
         where (
                (v_date_filter = 'all' or v_date_filter is null) or
                (v_custom_start is null and v_custom_end is null) or
                (v_custom_start is not null and v_custom_end is null and v.data_compra >= v_custom_start) or
                (v_custom_start is null and v_custom_end is not null and v.data_compra <= v_custom_end) or
                (v_custom_start is not null and v_custom_end is not null and v.data_compra between v_custom_start and v_custom_end)
               )
           and (v_search_query is null or v_search_query = '' or
                v.nome_cliente ilike '%' || v_search_query || '%' or
                (v_digitos <> '' and v.telefone_digitos ilike '%' || v_digitos || '%'))
           and (v_selected_items is null or v.item_nomes && v_selected_items)
    ),
    filtered_clients as (
        select pr.cid,
               max(pr.nome_cliente) as max_nome,
               max(pr.telefone_cliente) as max_telefone,
               count(*) as q_pedidos,
               sum(pr.valor_pedido) as f_total,
               sum(pr.numero_itens) as t_itens,
               max(pr.data_compra) as u_compra_periodo,
               max(ls.pedidos_vida) as p_vida,
               max(ls.primeira_compra) as data_p_compra,
               max(ls.pedidos_vida) >= 2 as is_rec
          from period_records pr
          join public.plt_comercial_clientes ls on ls.cid = pr.cid
         where (v_inactive_before is null or ls.ultima_compra <= v_inactive_before)
           and (v_purchase_count is null or (
                case when '10+' = any(v_purchase_count) and ls.pedidos_vida >= 10 then true
                     else ls.pedidos_vida::text = any(v_purchase_count)
                end))
           and (v_recompra_min is null or ls.gap_dias >= v_recompra_min)
           and (v_recompra_max is null or ls.gap_dias <= v_recompra_max)
           and (v_spend_amount is null or (
                case when v_spend_type = 'total' then
                    case when v_spend_mode = 'above' then ls.faturamento_vida >= v_spend_amount
                         when v_spend_mode = 'below' then ls.faturamento_vida <= v_spend_amount
                         else ls.faturamento_vida between (v_spend_amount * 0.9) and (v_spend_amount * 1.1)
                    end
                else
                    case when v_spend_mode = 'above' then (ls.faturamento_vida / nullif(ls.pedidos_vida, 0)) >= v_spend_amount
                         when v_spend_mode = 'below' then (ls.faturamento_vida / nullif(ls.pedidos_vida, 0)) <= v_spend_amount
                         else (ls.faturamento_vida / nullif(ls.pedidos_vida, 0)) between (v_spend_amount * 0.9) and (v_spend_amount * 1.1)
                    end
                end))
         group by pr.cid
    )
    select max_nome::text, max_telefone::text, q_pedidos::integer, f_total, t_itens::integer, data_p_compra,
           u_compra_periodo, p_vida::integer, is_rec, (select count(*) from filtered_clients)
      from filtered_clients
     order by u_compra_periodo desc, cid
     limit p_limit offset p_offset;
end;
$function$;

create or replace function public.fn_dashboard_scorecards(p_filters jsonb default '{}'::jsonb)
 returns table(total_revenue numeric, total_orders integer, total_clients integer, recurrents integer, recurrence_rate numeric, avg_ticket numeric)
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
    v_search_query text;
    v_date_filter text;
    v_custom_start timestamp with time zone;
    v_custom_end timestamp with time zone;
    v_selected_items text[];
    v_purchase_count text[];
    v_inactive_before timestamp with time zone;
    v_recompra_min integer;
    v_recompra_max integer;
    v_spend_amount numeric;
    v_spend_type text;
    v_spend_mode text;
    v_digitos text;
    v_total_revenue numeric;
    v_total_orders integer;
    v_total_clients integer;
    v_recurrents integer;
    v_recurrence_rate numeric;
    v_avg_ticket numeric;
begin
    perform plt_privado.fn_negar_sem_modulo('comercial');
    v_search_query := p_filters->>'searchQuery';
    v_date_filter := p_filters->>'dateFilter';
    if p_filters->>'customDateStart' is not null and p_filters->>'customDateStart' <> '' then
        v_custom_start := (p_filters->>'customDateStart')::timestamp with time zone;
    end if;
    if p_filters->>'customDateEnd' is not null and p_filters->>'customDateEnd' <> '' then
        v_custom_end := (p_filters->>'customDateEnd')::timestamp with time zone;
    end if;
    if v_date_filter = 'specificYear' then
        v_custom_start := date_trunc('year', to_date(p_filters->>'specificYear', 'YYYY'));
        v_custom_end := v_custom_start + interval '1 year' - interval '1 microsecond';
    elsif v_date_filter = 'specificMonth' then
        v_custom_start := date_trunc('month', to_date(p_filters->>'specificMonth', 'YYYY-MM'));
        v_custom_end := v_custom_start + interval '1 month' - interval '1 microsecond';
    elsif v_date_filter = 'specificDay' then
        v_custom_start := date_trunc('day', to_date(p_filters->>'specificDay', 'YYYY-MM-DD'));
        v_custom_end := v_custom_start + interval '1 day' - interval '1 microsecond';
    end if;
    if p_filters ? 'selectedItems' and jsonb_array_length(p_filters->'selectedItems') > 0 and not (p_filters->'selectedItems') @> '["all"]' then
        select array_agg(value) into v_selected_items from jsonb_array_elements_text(p_filters->'selectedItems');
    end if;
    if p_filters ? 'purchaseCount' and jsonb_array_length(p_filters->'purchaseCount') > 0 and not (p_filters->'purchaseCount') @> '["all"]' then
        select array_agg(value) into v_purchase_count from jsonb_array_elements_text(p_filters->'purchaseCount');
    end if;
    if p_filters->>'inactiveBeforeDate' is not null and p_filters->>'inactiveBeforeDate' <> '' then
        v_inactive_before := (p_filters->>'inactiveBeforeDate')::timestamp with time zone;
    end if;
    if p_filters->>'recompraMinDays' is not null and p_filters->>'recompraMinDays' <> '' then
        v_recompra_min := (p_filters->>'recompraMinDays')::integer;
    end if;
    if p_filters->>'recompraMaxDays' is not null and p_filters->>'recompraMaxDays' <> '' then
        v_recompra_max := (p_filters->>'recompraMaxDays')::integer;
    end if;
    if p_filters->>'spendAmount' is not null and p_filters->>'spendAmount' <> '' then
        v_spend_amount := (p_filters->>'spendAmount')::numeric;
    end if;
    v_spend_type := p_filters->>'spendType';
    v_spend_mode := p_filters->>'spendMode';
    v_digitos := regexp_replace(coalesce(v_search_query, ''), '\D', '', 'g');

    if ((v_date_filter = 'all' or v_date_filter is null) or (v_custom_start is null and v_custom_end is null))
       and coalesce(v_search_query, '') = '' and v_selected_items is null then
        -- o período inteiro: os totais saem da vida de cada cliente, já pronta
        select coalesce(sum(c.faturamento_vida), 0),
               coalesce(sum(c.pedidos_vida), 0)::integer,
               count(*)::integer,
               count(*) filter (where c.pedidos_vida >= 2)::integer
          into v_total_revenue, v_total_orders, v_total_clients, v_recurrents
          from public.plt_comercial_clientes c
         where (v_inactive_before is null or c.ultima_compra <= v_inactive_before)
           and (v_purchase_count is null or (
                case when '10+' = any(v_purchase_count) and c.pedidos_vida >= 10 then true
                     else c.pedidos_vida::text = any(v_purchase_count)
                end))
           and (v_recompra_min is null or c.gap_dias >= v_recompra_min)
           and (v_recompra_max is null or c.gap_dias <= v_recompra_max)
           and (v_spend_amount is null or (
                case when v_spend_type = 'total' then
                    case when v_spend_mode = 'above' then c.faturamento_vida >= v_spend_amount
                         when v_spend_mode = 'below' then c.faturamento_vida <= v_spend_amount
                         else c.faturamento_vida between (v_spend_amount * 0.9) and (v_spend_amount * 1.1)
                    end
                else
                    case when v_spend_mode = 'above' then (c.faturamento_vida / nullif(c.pedidos_vida, 0)) >= v_spend_amount
                         when v_spend_mode = 'below' then (c.faturamento_vida / nullif(c.pedidos_vida, 0)) <= v_spend_amount
                         else (c.faturamento_vida / nullif(c.pedidos_vida, 0)) between (v_spend_amount * 0.9) and (v_spend_amount * 1.1)
                    end
                end));
    else
        with period_records as (
            select v.cid, v.valor_pedido
              from public.plt_comercial_vendas v
             where (
                    (v_date_filter = 'all' or v_date_filter is null) or
                    (v_custom_start is null and v_custom_end is null) or
                    (v_custom_start is not null and v_custom_end is null and v.data_compra >= v_custom_start) or
                    (v_custom_start is null and v_custom_end is not null and v.data_compra <= v_custom_end) or
                    (v_custom_start is not null and v_custom_end is not null and v.data_compra between v_custom_start and v_custom_end)
                   )
               and (v_search_query is null or v_search_query = '' or
                    v.nome_cliente ilike '%' || v_search_query || '%' or
                    (v_digitos <> '' and v.telefone_digitos ilike '%' || v_digitos || '%'))
               and (v_selected_items is null or v.item_nomes && v_selected_items)
        ),
        filtered_clients as (
            select pr.cid, count(*) as q_pedidos, sum(pr.valor_pedido) as f_total, max(ls.pedidos_vida) as p_vida
              from period_records pr
              join public.plt_comercial_clientes ls on ls.cid = pr.cid
             where (v_inactive_before is null or ls.ultima_compra <= v_inactive_before)
               and (v_purchase_count is null or (
                    case when '10+' = any(v_purchase_count) and ls.pedidos_vida >= 10 then true
                         else ls.pedidos_vida::text = any(v_purchase_count)
                    end))
               and (v_recompra_min is null or ls.gap_dias >= v_recompra_min)
               and (v_recompra_max is null or ls.gap_dias <= v_recompra_max)
               and (v_spend_amount is null or (
                    case when v_spend_type = 'total' then
                        case when v_spend_mode = 'above' then ls.faturamento_vida >= v_spend_amount
                             when v_spend_mode = 'below' then ls.faturamento_vida <= v_spend_amount
                             else ls.faturamento_vida between (v_spend_amount * 0.9) and (v_spend_amount * 1.1)
                        end
                    else
                        case when v_spend_mode = 'above' then (ls.faturamento_vida / nullif(ls.pedidos_vida, 0)) >= v_spend_amount
                             when v_spend_mode = 'below' then (ls.faturamento_vida / nullif(ls.pedidos_vida, 0)) <= v_spend_amount
                             else (ls.faturamento_vida / nullif(ls.pedidos_vida, 0)) between (v_spend_amount * 0.9) and (v_spend_amount * 1.1)
                        end
                    end))
             group by pr.cid
        )
        select coalesce(sum(f_total), 0), coalesce(sum(q_pedidos), 0)::integer, count(*)::integer,
               count(*) filter (where p_vida >= 2)::integer
          into v_total_revenue, v_total_orders, v_total_clients, v_recurrents
          from filtered_clients;
    end if;

    if v_total_clients > 0 then
        v_recurrence_rate := (v_recurrents::numeric / v_total_clients::numeric) * 100.0;
    else
        v_recurrence_rate := 0;
    end if;
    if v_total_orders > 0 then
        v_avg_ticket := v_total_revenue / v_total_orders::numeric;
    else
        v_avg_ticket := 0;
    end if;

    return query select v_total_revenue, v_total_orders, v_total_clients, v_recurrents, v_recurrence_rate, v_avg_ticket;
end;
$function$;

create or replace function public.fn_dashboard_revenue_chart(p_start timestamp with time zone default null::timestamp with time zone, p_end timestamp with time zone default null::timestamp with time zone)
 returns table(month_str text, revenue numeric, orders integer)
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
    v_mes_ini text;
    v_mes_fim text;
begin
    perform plt_privado.fn_negar_sem_modulo('comercial');
    select m.mes_ini, m.mes_fim into v_mes_ini, v_mes_fim from plt_privado.fn_comercial_meses_inteiros(p_start, p_end) m;
    if found then
        -- meses inteiros (o período todo, 1/3/6/12 meses): a conta do mês já está pronta
        return query
        select x.mes, x.receita, x.pedidos
          from (
            select m.mes, m.receita, m.pedidos
              from public.plt_comercial_mes m
             where (v_mes_ini is null or m.mes >= v_mes_ini)
               and (v_mes_fim is null or m.mes <= v_mes_fim)
               and m.pedidos > 0
            union all
            -- o período inteiro inclui os pedidos sem data (o "mês" vazio de sempre)
            select null::text, sum(v.valor_pedido), count(*)::integer
              from public.plt_comercial_vendas v
             where p_start is null and p_end is null and v.mes is null
            having count(*) > 0
          ) x
         order by x.mes;
        return;
    end if;
    return query
    select v.mes, sum(v.valor_pedido), count(*)::integer
      from public.plt_comercial_vendas v
     where (p_start is null or v.data_compra >= p_start)
       and (p_end is null or v.data_compra <= p_end)
     group by v.mes
     order by v.mes asc;
end;
$function$;

create or replace function public.fn_dashboard_top_items_overall(p_start timestamp with time zone default null::timestamp with time zone, p_end timestamp with time zone default null::timestamp with time zone)
 returns table(item_name text, quantidade integer)
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
    v_mes_ini text;
    v_mes_fim text;
begin
    perform plt_privado.fn_negar_sem_modulo('comercial');
    select m.mes_ini, m.mes_fim into v_mes_ini, v_mes_fim from plt_privado.fn_comercial_meses_inteiros(p_start, p_end) m;
    if found then
        return query
        select x.item_nome, sum(x.q)::integer as total
          from (
            select i.item_nome, i.quantidade as q
              from public.plt_comercial_itens_mes i
             where (v_mes_ini is null or i.mes >= v_mes_ini)
               and (v_mes_fim is null or i.mes <= v_mes_fim)
            union all
            select n, 1
              from public.plt_comercial_vendas v
             cross join lateral unnest(v.item_nomes) as n
             where p_start is null and p_end is null and v.mes is null
          ) x
         group by x.item_nome
        having sum(x.q) > 0
         order by total desc, x.item_nome;
        return;
    end if;
    return query
    select n, count(*)::integer as q
      from public.plt_comercial_vendas v
     cross join lateral unnest(v.item_nomes) as n
     where (p_start is null or v.data_compra >= p_start)
       and (p_end is null or v.data_compra <= p_end)
     group by n
     order by q desc, n;
end;
$function$;

create or replace function public.fn_dashboard_items(p_start timestamp with time zone default null::timestamp with time zone, p_end timestamp with time zone default null::timestamp with time zone)
 returns table(month_str text, item_name text, quantidade integer)
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
    v_mes_ini text;
    v_mes_fim text;
begin
    perform plt_privado.fn_negar_sem_modulo('comercial');
    select m.mes_ini, m.mes_fim into v_mes_ini, v_mes_fim from plt_privado.fn_comercial_meses_inteiros(p_start, p_end) m;
    if found then
        return query
        select x.mes, x.item_nome, x.q
          from (
            select i.mes, i.item_nome, i.quantidade as q
              from public.plt_comercial_itens_mes i
             where (v_mes_ini is null or i.mes >= v_mes_ini)
               and (v_mes_fim is null or i.mes <= v_mes_fim)
               and i.quantidade > 0
            union all
            select null::text, n, count(*)::integer
              from public.plt_comercial_vendas v
             cross join lateral unnest(v.item_nomes) as n
             where p_start is null and p_end is null and v.mes is null
             group by n
          ) x
         order by x.mes asc, x.q desc, x.item_nome;
        return;
    end if;
    return query
    select v.mes, n, count(*)::integer as q
      from public.plt_comercial_vendas v
     cross join lateral unnest(v.item_nomes) as n
     where (p_start is null or v.data_compra >= p_start)
       and (p_end is null or v.data_compra <= p_end)
     group by v.mes, n
     order by v.mes asc, q desc, n;
end;
$function$;

create or replace function public.fn_dashboard_purchase_frequency(p_start timestamp with time zone default null::timestamp with time zone, p_end timestamp with time zone default null::timestamp with time zone)
 returns table(pedidos_count integer, faturamento_total numeric, clientes_count integer)
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
    perform plt_privado.fn_negar_sem_modulo('comercial');
    if p_start is null and p_end is null then
        -- o período inteiro: a vida de cada cliente já está pronta
        return query
        with por_cliente as (
            select c.pedidos_vida::bigint as qtd, c.faturamento_vida as fat, 1 as conta
              from public.plt_comercial_clientes c
            union all
            select count(*), sum(v.valor_pedido), 0
              from public.plt_comercial_vendas v
             where v.cid is null
            having count(*) > 0
        )
        select p.qtd::integer, sum(p.fat), sum(p.conta)::integer
          from por_cliente p
         group by p.qtd
         order by p.qtd asc
         limit 15;
        return;
    end if;
    return query
    with client_period_stats as (
        select v.cid as client_id, count(*) as qtd_pedidos, sum(v.valor_pedido) as faturamento
          from public.plt_comercial_vendas v
         where (p_start is null or v.data_compra >= p_start)
           and (p_end is null or v.data_compra <= p_end)
         group by v.cid
    )
    select qtd_pedidos::integer, sum(faturamento), count(client_id)::integer
      from client_period_stats
     group by qtd_pedidos
     order by qtd_pedidos asc
     limit 15;
end;
$function$;

create or replace function public.fn_dashboard_transitions_summary(p_start timestamp with time zone default null::timestamp with time zone, p_end timestamp with time zone default null::timestamp with time zone)
 returns table(purchase_number integer, avg_days numeric, client_count integer)
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
    perform plt_privado.fn_negar_sem_modulo('comercial');
    return query
    select v.ordem_cliente,
           avg(extract(day from (v.data_compra - v.data_anterior)))::numeric,
           count(distinct v.cid)::integer
      from public.plt_comercial_vendas v
     where v.ordem_cliente > 1
       and (p_start is null or v.data_compra >= p_start)
       and (p_end is null or v.data_compra <= p_end)
     group by v.ordem_cliente
     order by v.ordem_cliente asc;
end;
$function$;

create or replace function public.fn_dashboard_transition_clients(p_purchase_number integer, p_start timestamp with time zone default null::timestamp with time zone, p_end timestamp with time zone default null::timestamp with time zone, p_limit integer default 20, p_offset integer default 0)
 returns table(client_id text, days_since_last integer, prev_date timestamp with time zone, curr_date timestamp with time zone)
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
    perform plt_privado.fn_negar_sem_modulo('comercial');
    return query
    select coalesce(nullif(trim(v.nome_cliente), ''), v.telefone_cliente::text),
           extract(day from (v.data_compra - v.data_anterior))::integer as dias,
           v.data_anterior,
           v.data_compra
      from public.plt_comercial_vendas v
     where v.ordem_cliente = p_purchase_number
       and (p_start is null or v.data_compra >= p_start)
       and (p_end is null or v.data_compra <= p_end)
     order by dias asc, v.data_compra, v.pedido_id
     limit p_limit offset p_offset;
end;
$function$;

create or replace function public.fn_dashboard_transitions(p_start timestamp with time zone default null::timestamp with time zone, p_end timestamp with time zone default null::timestamp with time zone)
 returns table(client_id text, purchase_number integer, days_since_last integer)
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
    perform plt_privado.fn_negar_sem_modulo('comercial');
    return query
    select v.cid, v.ordem_cliente, extract(day from (v.data_compra - v.data_anterior))::integer
      from public.plt_comercial_vendas v
     where v.ordem_cliente > 1
       and (p_start is null or v.data_compra >= p_start)
       and (p_end is null or v.data_compra <= p_end);
end;
$function$;

create or replace function public.fn_clientes_consolidados(p_min_pedidos integer default null::integer, p_ordem text default 'pedidos'::text, p_limit integer default 50)
 returns table(id_cliente text, nome_cliente text, telefone_cliente text, total_pedidos bigint, faturamento_total numeric, total_itens bigint, primeira_compra timestamp with time zone, ultima_compra timestamp with time zone)
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
    v_lim integer := least(coalesce(p_limit, 50), 1000);
begin
    perform plt_privado.fn_negar_sem_modulo('comercial');
    -- a vida de cada cliente já está pronta: o topo sai pelo índice da ordem
    -- pedida (+ o "cliente sem chave", se existir) e a ordem final é a de sempre
    if p_ordem = 'faturamento' then
        return query
        with topo as (
            (select c.cid, c.nome_max, c.telefone_max, c.pedidos_vida::bigint as tp, c.faturamento_vida as fat,
                    c.itens_vida, c.primeira_compra, c.ultima_compra
               from public.plt_comercial_clientes c
              where p_min_pedidos is null or c.pedidos_vida >= p_min_pedidos
              order by c.faturamento_vida desc nulls last, c.pedidos_vida desc, c.cid
              limit v_lim)
            union all
            (select null::text, max(v.nome_cliente::text), max(v.telefone_cliente::text), count(*), sum(v.valor_pedido),
                    sum(v.numero_itens), min(v.data_compra), max(v.data_compra)
               from public.plt_comercial_vendas v
              where v.cid is null
             having count(*) > 0 and (p_min_pedidos is null or count(*) >= p_min_pedidos))
        )
        select * from topo
         order by topo.fat desc nulls last, topo.tp desc, topo.fat desc, topo.cid
         limit v_lim;
    else
        return query
        with topo as (
            (select c.cid, c.nome_max, c.telefone_max, c.pedidos_vida::bigint as tp, c.faturamento_vida as fat,
                    c.itens_vida, c.primeira_compra, c.ultima_compra
               from public.plt_comercial_clientes c
              where p_min_pedidos is null or c.pedidos_vida >= p_min_pedidos
              order by c.pedidos_vida desc, c.faturamento_vida desc, c.cid
              limit v_lim)
            union all
            (select null::text, max(v.nome_cliente::text), max(v.telefone_cliente::text), count(*), sum(v.valor_pedido),
                    sum(v.numero_itens), min(v.data_compra), max(v.data_compra)
               from public.plt_comercial_vendas v
              where v.cid is null
             having count(*) > 0 and (p_min_pedidos is null or count(*) >= p_min_pedidos))
        )
        select * from topo
         order by topo.tp desc, topo.fat desc, topo.cid
         limit v_lim;
    end if;
end;
$function$;

create or replace function public.fn_vendas_disparo_por_telefone(p_telefone_normalizado text, p_inicio timestamp with time zone, p_fim timestamp with time zone)
 returns table(numero_pedido character varying, telefone_cliente character varying, data_compra timestamp with time zone, valor_pedido numeric)
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  perform plt_privado.fn_negar_sem_modulo('comercial');
  return query
  select v.numero_pedido, v.telefone_cliente, v.data_compra, v.valor_pedido
    from public.plt_comercial_vendas v
   where v.data_compra >= p_inicio
     and v.data_compra <= p_fim
     and v.telefone_normalizado = p_telefone_normalizado
   order by v.data_compra asc, v.pedido_id;
end;
$function$;

-- ----------------------------------------------------------------------------
-- 5 · Os gatilhos (o FATO): a gravação do pedido e a troca do telefone do
--     cliente refazem só o que mudou. Criados ANTES da carga: a tela nasce
--     sem buraco (a gravação que chegar durante a carga espera por ela).
-- ----------------------------------------------------------------------------
drop trigger if exists plt_pedidos_comercial_ins_del on public.pedidos;
create trigger plt_pedidos_comercial_ins_del
  after insert or delete on public.pedidos
  for each row execute function plt_privado.fn_comercial_pedido_mudou();

drop trigger if exists plt_pedidos_comercial_upd on public.pedidos;
create trigger plt_pedidos_comercial_upd
  after update on public.pedidos
  for each row
  when (old.numero is distinct from new.numero
        or old.cliente_id is distinct from new.cliente_id
        or old.data_pedido is distinct from new.data_pedido
        or old.total_pedido is distinct from new.total_pedido
        or old.criado_em is distinct from new.criado_em
        or (old.raw -> 'cliente' ->> 'nome') is distinct from (new.raw -> 'cliente' ->> 'nome')
        or (old.raw -> 'itens') is distinct from (new.raw -> 'itens'))
  execute function plt_privado.fn_comercial_pedido_mudou();

drop trigger if exists plt_clientes_comercial on public.clientes;
create trigger plt_clientes_comercial
  after update on public.clientes
  for each row
  when (coalesce(nullif(trim(old.fone), ''), nullif(trim(old.raw ->> 'celular'), ''))
        is distinct from coalesce(nullif(trim(new.fone), ''), nullif(trim(new.raw ->> 'celular'), '')))
  execute function plt_privado.fn_comercial_cliente_mudou();

-- ----------------------------------------------------------------------------
-- 6 · A carga: a tela pronta nasce de todos os pedidos de hoje
-- ----------------------------------------------------------------------------
do $$
begin
  perform plt_privado.fn_comercial_reconstruir();
end;
$$;

analyze public.plt_comercial_vendas;
analyze public.plt_comercial_clientes;
analyze public.plt_comercial_mes;
analyze public.plt_comercial_itens_mes;
