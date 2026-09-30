-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 40 — ESTOQUE: A CONTAGEM É DA
-- LOGÍSTICA, TOP 20+, MÍNIMO E CAPACIDADE NA PLATAFORMA, FOTO DO PRODUTO
-- Ajuste pedido pelo dono em 2026-09-28 (conversa) · Decisões: D-70…D-74
--
-- Por que (o diagnóstico de 28/09, só leitura no banco real):
--   o número dos acabados era "saldo do Tiny − pedidos da loja em aberto" —
--   mas o Tiny não avisa a SAÍDA da venda (45 pedidos saíram da reserva sem
--   aviso) nem o "pronto" dos móveis (9 avisos na vida toda, nenhum de móvel);
--   só 19 dos 168 fabricados tinham saldo positivo e 57 viravam "necessidade
--   extrema" sem pedido nenhum (o negativo do Tiny — P16). O dono: "a logística
--   irá dar baixa manual na quantidade de itens em estoque por enquanto".
--
--   1. O NÚMERO DOS ACABADOS (F/S/variação) = PEÇAS LIVRES NO ESTOQUE — a
--      contagem da plataforma. A logística cadastra (entrada), dá baixa ou
--      confere a contagem; por baixo, cada peça é um card `unidade` sem pedido
--      com o produto do catálogo (a mesma peça que a reposição e o pedido
--      cancelado já deixam no ESTOQUE). Assim a sugestão do PCP ("há N no
--      estoque — usar?") enxerga o que a logística cadastrou, sem nada novo.
--      O Tiny sai da conta dos acabados; segue nos insumos (M/K) e como
--      referência. ↩️ D-54 (agora existe entrada manual) · ↩️ D-55 (o número).
--   2. TOP 20+: a lista abre com os 20 mais vendidos dos últimos 90 dias
--      (rank), depois tudo o que tem estoque; o resto do catálogo fica no
--      "ver os outros" e na busca. As vendas de 90 dias viram UMA função.
--   3. MÍNIMO NA PLATAFORMA (coluna nova em `produtos`, nula = vale o do Tiny)
--      e CAPACIDADE DO GALPÃO (coluna nova em `plt_setores`, no ESTOQUE). A
--      sugestão de mínimo CABE no galpão: se a soma passar, todas encolhem na
--      mesma proporção (arredondamento pelo maior resto — a soma nunca passa
--      e o mais vendido nunca fica com menos que o de baixo).
--   4. FOTO DO PRODUTO: `produtos.imagem_caminho` (a capa, na mesma
--      biblioteca por SKU que o tablet já usa — `produtos/{sku}/…`); só a
--      logística e o admin definem. Política de storage para a logística
--      anexar na pasta `produtos/`.
--   5. A reposição automática (desligada) passa a olhar a contagem da
--      plataforma e o mínimo efetivo; o ciclo reabre com MOVIMENTO novo do
--      estoque do produto (antes: leitura nova do Tiny).
--
-- Nenhuma tabela nova (D-47). Nada em `clientes`/`pedidos`/`pedido_itens`/
-- `eventos`. Nenhuma função recriada pela migration 39 (frete) é tocada aqui.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0 · Pré-requisitos: o catálogo e o ESTOQUE
-- ----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.produtos') is null then
    raise exception 'A migration 40 precisa da tabela public.produtos (migration 23 da integração).';
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 1 · Colunas novas (D-72, D-73) — o catálogo é a casa do produto; o
--     fn_upsert_produto do n8n grava só as colunas dele (lista explícita),
--     então estas duas nunca são sobrescritas pelo Tiny.
-- ----------------------------------------------------------------------------
alter table public.produtos add column if not exists minimo_plataforma numeric(14,4);
alter table public.produtos add column if not exists imagem_caminho text;
alter table public.plt_setores add column if not exists capacidade_pecas integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'produtos_minimo_plataforma_ck') then
    alter table public.produtos
      add constraint produtos_minimo_plataforma_ck
      check (minimo_plataforma is null or minimo_plataforma >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'plt_setores_capacidade_ck') then
    alter table public.plt_setores
      add constraint plt_setores_capacidade_ck
      check (capacidade_pecas is null or capacidade_pecas > 0);
  end if;
end;
$$;

comment on column public.produtos.minimo_plataforma is
  'Estoque mínimo definido NA PLATAFORMA (aba Configurações do Estoque — D-72). Nulo = vale o mínimo do Tiny (estoque_minimo). Escrito só por plt_fn_estoque_definir_minimo/aplicar_sugestoes.';
comment on column public.produtos.imagem_caminho is
  'Foto (capa) do produto no bucket plt-imagens, pasta produtos/{sku}/… (D-73). Definida só pela logística/admin (plt_fn_estoque_definir_imagem).';
comment on column public.plt_setores.capacidade_pecas is
  'Quantas peças cabem (usado no ESTOQUE: a capacidade do galpão — D-72). A sugestão de mínimo nunca passa dela.';

-- ----------------------------------------------------------------------------
-- 2 · As vendas de 90 dias, num lugar só: SKU do catálogo ativo (F/S/V),
--     sem cancelado e sem personalizado — o rank da lista Top 20+ e a base da
--     sugestão de mínimo (antes morava dentro da sugestão).
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_vendas_90d()
returns table (tiny_id bigint, codigo text, vendidos numeric, posicao integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with por_sku as (
    -- SKU → produto ATIVO do catálogo (o SKU não se repete entre os ativos)
    select distinct on (pr.codigo) pr.codigo, pr.tiny_id
      from public.produtos pr
     where pr.codigo is not null and pr.situacao = 'A'
       and coalesce(pr.classe, '') in ('F', 'S', 'V')
     order by pr.codigo, pr.tiny_id
  ),
  vendas as (
    select ps.tiny_id, ps.codigo, sum(pi.quantidade) as vendidos
      from public.pedidos p
      join public.pedido_itens pi on pi.pedido_id = p.id
      join por_sku ps on ps.codigo = pi.codigo
     where p.data_pedido >= (now() at time zone 'America/Fortaleza')::date - 90
       and plt_privado.fn_situacao_normalizada(p.situacao) <> 'cancelado'
       and not plt_privado.fn_eh_personalizado(pi.descricao)
     group by ps.tiny_id, ps.codigo
  )
  select v.tiny_id, v.codigo, v.vendidos,
         row_number() over (order by v.vendidos desc, v.codigo, v.tiny_id)::int as posicao
    from vendas v
   where v.vendidos > 0;
$$;

comment on function plt_privado.fn_vendas_90d() is
  'Vendas da loja nos últimos 90 dias por produto acabado do catálogo (SKU, sem cancelado/personalizado), com o rank. A regra única do Top 20+ e da sugestão de mínimo.';

-- ----------------------------------------------------------------------------
-- 3 · A sugestão de mínimo que CABE no galpão (D-72 — "cuidado aqui").
--     Ideal = média semanal × semanas de cobertura (1 a 8). Sem capacidade, ou
--     se a soma dos ideais arredondados para cima couber, fica o ideal para
--     cima (mínimo 1). Se passar: cota = ideal × capacidade ÷ soma dos
--     ideais; parte inteira para todos e as unidades que sobram vão para os
--     maiores restos (empate: o mais vendido). A soma dá EXATAMENTE a
--     capacidade, e quem vende mais nunca recebe menos que quem vende menos.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_sugestoes_minimo(p_semanas integer default 2)
returns table (tiny_id bigint, vendidos numeric, posicao integer, media_semana numeric, sugestao integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with v as (
    select x.tiny_id, x.vendidos, x.posicao,
           x.vendidos / (90 / 7.0)                                                       as media,
           x.vendidos / (90 / 7.0) * least(greatest(coalesce(p_semanas, 2), 1), 8)      as ideal
      from plt_privado.fn_vendas_90d() x
  ),
  tot as (
    select coalesce(sum(greatest(ceil(v.ideal), 1)), 0) as soma_teto,
           coalesce(sum(v.ideal), 0)                    as soma_ideal
      from v
  ),
  modo as (
    select (c.capacidade_pecas is not null and t.soma_teto > c.capacidade_pecas
            and t.soma_ideal > 0)                      as encolhe,
           c.capacidade_pecas                          as capacidade,
           t.soma_ideal
      from tot t
      left join public.plt_setores c on c.codigo = 'estoque'
  ),
  partes as (
    select v.*,
           case when m.encolhe then v.ideal * m.capacidade / m.soma_ideal end            as cota,
           case when m.encolhe then floor(v.ideal * m.capacidade / m.soma_ideal)::int end as base
      from v cross join modo m
  ),
  sobra as (
    select (select m.capacidade from modo m) - coalesce(sum(p.base), 0) as unidades
      from partes p
  )
  select p.tiny_id, p.vendidos, p.posicao, round(p.media, 1) as media_semana,
         case
           when p.cota is null then greatest(ceil(p.ideal)::int, 1)
           else p.base
                + case when row_number() over (order by (p.cota - p.base) desc, p.posicao)
                            <= (select s.unidades from sobra s)
                       then 1 else 0 end
         end as sugestao
    from partes p;
$$;

comment on function plt_privado.fn_sugestoes_minimo(integer) is
  'Sugestão de mínimo por produto vendido nos 90 dias (média semanal × cobertura), encolhida para a soma caber na capacidade do galpão (D-72). Usada pela aba Configurações e pelo "usar todas".';

-- ----------------------------------------------------------------------------
-- 4 · A base do estoque (recriada POR INTEIRO a partir da migration 37 —
--     mesma forma de retorno): o MÍNIMO é o efetivo (o da plataforma, senão o
--     do Tiny) e o DISPONÍVEL dos acabados é a contagem da plataforma (peças
--     livres no ESTOQUE). Insumos seguem com o Tiny − reservas.
-- ----------------------------------------------------------------------------
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
  with estoque as (
    select s.id from public.plt_setores s where s.codigo = 'estoque'
  ),
  leituras as (
    select * from plt_privado.fn_leituras_tiny()
  ),
  -- SKU → produto ATIVO do catálogo (o SKU não se repete entre os ativos)
  por_sku as (
    select distinct on (pr.codigo) pr.codigo, pr.tiny_id
      from public.produtos pr
     where pr.codigo is not null and pr.situacao = 'A'
     order by pr.codigo, pr.tiny_id
  ),
  reservas as (
    select ps.tiny_id, sum(pi.quantidade) as quantidade
      from public.pedidos p
      join public.pedido_itens pi on pi.pedido_id = p.id
      join por_sku ps on ps.codigo = pi.codigo
     where plt_privado.fn_situacao_reserva_estoque(p.situacao)
       and not plt_privado.fn_eh_personalizado(pi.descricao)
     group by ps.tiny_id
  ),
  reservados as (
    -- SESSAO-24: a peça pronta de pedido mora em Pedidos em aguardo.
    select ps.tiny_id, count(*)::int as quantidade
      from public.plt_cards c
      join public.plt_setores s on s.id = c.setor_atual_id
                               and s.papel_no_fluxo = 'terminal' and s.codigo <> 'rotas'
      join por_sku ps on ps.codigo = c.item_codigo
     where c.tipo = 'unidade' and c.pedido_id is not null and c.arquivado_em is null
       and not plt_privado.fn_eh_personalizado(c.item_descricao)
     group by ps.tiny_id
  ),
  livres as (
    select c.produto_tiny_id as tiny_id, count(*)::int as quantidade
      from public.plt_cards c
     where c.tipo = 'unidade' and c.pedido_id is null and c.arquivado_em is null
       and c.produto_tiny_id is not null
       and not plt_privado.fn_eh_personalizado(c.item_descricao)
       and c.setor_atual_id in (select id from estoque)
     group by c.produto_tiny_id
  ),
  reposicao as (
    select distinct on (rc.produto_tiny_id)
           rc.produto_tiny_id as tiny_id,
           rc.id              as card_id,
           rc.total_unidades  as quantidade,
           u.liberadas,
           case
             when rc.arquivado_em is not null      then 'arquivada'
             when rc.liberado_completo_em is null  then 'no_pcp'
             when u.em_producao > 0                then 'em_producao'
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
         -- D-72: o mínimo da plataforma manda; sem ele, vale o do Tiny.
         coalesce(pr.minimo_plataforma, pr.estoque_minimo)      as minimo,
         l.saldo                                                as saldo_tiny,
         l.reservado_tiny,
         l.lido_em,
         l.origem                                               as origem_leitura,
         l.evento_id                                            as evento_leitura_id,
         coalesce(r.quantidade, 0)                              as reservas_loja,
         -- D-70: nos ACABADOS o número é a contagem da plataforma (peças
         -- livres no ESTOQUE — entrada manual, reposição, pedido cancelado);
         -- nos insumos segue o Tiny − reservas (pode ficar negativo: a tela
         -- nunca mostra negativo — D-53).
         case when coalesce(pr.classe, '') in ('F', 'S', 'V')
              then coalesce(lv.quantidade, 0)::numeric
              when l.saldo is not null
              then l.saldo - coalesce(r.quantidade, 0) end      as disponivel,
         coalesce(rv.quantidade, 0)                             as prontos_reservados,
         coalesce(lv.quantidade, 0)                             as prontos_livres,
         rp.card_id                                             as reposicao_card_id,
         rp.estado                                              as reposicao_estado,
         rp.quantidade                                          as reposicao_quantidade,
         rp.liberadas                                           as reposicao_liberadas
    from public.produtos pr
    left join leituras   l  on l.tiny_id  = pr.tiny_id
    left join reservas   r  on r.tiny_id  = pr.tiny_id
    left join reservados rv on rv.tiny_id = pr.tiny_id
    left join livres     lv on lv.tiny_id = pr.tiny_id
    left join reposicao  rp on rp.tiny_id = pr.tiny_id;
$$;

comment on function plt_privado.fn_estoque_por_produto() is
  'A base única do estoque por produto. Acabados: disponível = peças livres no ESTOQUE (a contagem da plataforma — D-70); insumos: saldo do Tiny − reservas da loja. Mínimo efetivo = o da plataforma, senão o do Tiny (D-72).';

-- ----------------------------------------------------------------------------
-- 5 · A maquinaria da reposição (desligada até o dono ligar) com a contagem
--     da plataforma. O ciclo: um vivo por produto; depois dele, só reabre com
--     MOVIMENTO novo do estoque daquele produto (entrada, baixa, chegada,
--     alocação) — antes era leitura nova do Tiny, que para os acabados não
--     chega mais.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_gerar_reposicoes()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pcp     bigint;
  v_card_id bigint;
  v_qtd     integer;
  v_fim     timestamptz;
  v_mov     timestamptz;
  v_gerados integer := 0;
  r         record;
begin
  select s.id into v_pcp from public.plt_setores s
   where s.papel_no_fluxo = 'entrada' and s.ativo
   order by s.id limit 1;
  if v_pcp is null then
    return 0;
  end if;

  for r in
    select b.*
      from plt_privado.fn_estoque_por_produto() b
     where b.situacao = 'A'
       and b.classe in ('F', 'S', 'V')
       and coalesce(b.minimo, 0) > 0
       and b.disponivel < b.minimo
  loop
    -- Um ciclo vivo por produto: card ainda no PCP, ou unidade dele em produção.
    if exists (
         select 1 from public.plt_cards rc
          where rc.tipo = 'reposicao' and rc.produto_tiny_id = r.tiny_id
            and rc.arquivado_em is null and rc.liberado_completo_em is null)
       or exists (
         select 1 from public.plt_cards u
           join public.plt_cards rc on rc.id = u.card_pai_id
                                   and rc.tipo = 'reposicao' and rc.produto_tiny_id = r.tiny_id
          where u.tipo = 'unidade' and u.arquivado_em is null and u.concluido_em is null) then
      continue;
    end if;

    -- Depois de um ciclo (concluído ou arquivado pelo PCP), só gera de novo
    -- quando o estoque do produto MEXER depois do fim dele — senão o "Não
    -- produzir" do PCP voltaria sozinho a cada rodada.
    select max(greatest(coalesce(rc.arquivado_em, '-infinity'::timestamptz),
                        coalesce(rc.liberado_completo_em, '-infinity'::timestamptz),
                        coalesce((select max(cu.concluido_em) from public.plt_cards cu
                                   where cu.card_pai_id = rc.id and cu.tipo = 'unidade'),
                                 '-infinity'::timestamptz)))
      into v_fim
      from public.plt_cards rc
     where rc.tipo = 'reposicao' and rc.produto_tiny_id = r.tiny_id;
    if v_fim is not null then
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

    -- Repor até o mínimo (a contagem da plataforma nunca é negativa).
    v_qtd := ceil(r.minimo - greatest(r.disponivel, 0))::integer;
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
      continue;   -- outra rodada chegou antes (índice único da reposição aberta)
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
                'quantidade',          v_qtd,
                'saldo_tiny',          r.saldo_tiny,
                'reservas_loja',       r.reservas_loja));
    v_gerados := v_gerados + 1;
  end loop;

  return v_gerados;
end;
$$;

comment on function plt_privado.fn_gerar_reposicoes() is
  'Abaixo do mínimo efetivo, gera o card de REPOSIÇÃO no PCP (origem automacao). Acabados: pela contagem da plataforma (D-70). Um ciclo vivo por produto; depois dele, só com movimento novo do estoque do produto.';

-- ----------------------------------------------------------------------------
-- 6 · Quem pode arquivar (recriada POR INTEIRO a partir da migration 36):
--     + a BAIXA manual da logística — peça livre (sem pedido) no ESTOQUE.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 7 · A lista por produto (drop + create — a forma de retorno mudou, E-17).
--     ACABADOS (Top 20+): os 20 mais vendidos dos 90 dias (rank) + tudo o que
--     tem estoque; o resto do catálogo em p_filtro='fora' e na BUSCA (que
--     varre o catálogo inteiro — é o "ver produtos"). INSUMOS: o que tem
--     estoque primeiro, o resto nas páginas seguintes.
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_estoque_produtos(text, text, text, integer, integer);
create function public.plt_fn_estoque_produtos(
  p_grupo        text    default 'acabados',  -- 'acabados' | 'insumos'
  p_busca        text    default null,
  p_filtro       text    default null,        -- acabados: null (Top 20+) | 'fora' | 'abaixo_minimo' | 'todos'; insumos: null | 'sem_leitura'
  p_limite       integer default 20,
  p_deslocamento integer default 0
)
returns table (
  tiny_id              bigint,
  codigo               text,
  descricao            text,
  classe               text,
  unidade              text,
  imagem_caminho       text,
  posicao              integer,
  vendidos_90d         numeric,
  minimo               numeric,
  minimo_tiny          numeric,
  minimo_definido_aqui boolean,
  em_estoque           numeric,
  reservados           integer,
  abaixo_minimo        boolean,
  repor                numeric,
  saldo_tiny           numeric,
  lido_em              timestamptz,
  origem_leitura       text,
  reposicao_estado     text,
  contagem_total       bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with base as (
    select b.tiny_id, b.codigo, b.descricao, b.classe, b.unidade, b.minimo, b.disponivel,
           b.saldo_tiny, b.lido_em, b.origem_leitura, b.prontos_reservados, b.reposicao_estado,
           pr.imagem_caminho, pr.estoque_minimo as minimo_tiny, pr.minimo_plataforma,
           v.posicao, v.vendidos,
           case when b.disponivel is not null then greatest(b.disponivel, 0) end        as em_estoque_,
           (b.disponivel is not null and coalesce(b.minimo, 0) > 0
              and b.disponivel < b.minimo)                                              as abaixo_
      from plt_privado.fn_estoque_por_produto() b
      join public.produtos pr on pr.tiny_id = b.tiny_id
      left join plt_privado.fn_vendas_90d() v on v.tiny_id = b.tiny_id
     where b.situacao = 'A'
       and case when coalesce(p_grupo, 'acabados') = 'insumos'
                then b.classe in ('M', 'K')
                else coalesce(b.classe, '') in ('F', 'S', 'V')
           end
  ),
  visivel as (
    select b.*,
           (coalesce(b.posicao, 2147483647) <= 20 or coalesce(b.em_estoque_, 0) > 0) as na_lista_
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
         f.minimo,
         f.minimo_tiny,
         f.minimo_plataforma is not null,
         f.em_estoque_,
         f.prontos_reservados,
         f.abaixo_,
         case when f.abaixo_ then f.minimo - coalesce(f.em_estoque_, 0) else 0 end,
         f.saldo_tiny,
         f.lido_em,
         f.origem_leitura,
         f.reposicao_estado,
         count(*) over ()
    from visivel f
   where case
           when coalesce(p_grupo, 'acabados') = 'insumos'
             then coalesce(p_filtro, '') <> 'sem_leitura' or f.saldo_tiny is null
           -- Com busca, procura no catálogo inteiro (o "ver produtos").
           when p_busca is not null and btrim(p_busca) <> '' then true
           when p_filtro = 'fora'          then not f.na_lista_
           when p_filtro = 'abaixo_minimo' then f.abaixo_
           when p_filtro = 'todos'         then true
           else f.na_lista_
         end
   order by (coalesce(p_grupo, 'acabados') = 'insumos' and coalesce(f.em_estoque_, 0) > 0) desc,
            f.posicao nulls last,
            f.descricao,
            f.tiny_id
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_estoque_produtos(text, text, text, integer, integer) is
  'Estoque por produto. Acabados (Top 20+ — D-71): os 20 mais vendidos dos 90 dias + o que tem estoque, pelo rank; ''fora'' = o resto do catálogo; a busca varre tudo. Número = contagem da plataforma (D-70). Insumos: Tiny, com estoque primeiro. Gate da logística.';

-- ----------------------------------------------------------------------------
-- 8 · As PEÇAS no ESTOQUE (mesma forma — só a origem ganha 'manual': peça
--     sem card pai nasceu da entrada manual da logística).
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_estoque(
  p_busca           text    default null,
  p_limite          integer default 20,
  p_deslocamento    integer default 0,
  p_produto_tiny_id bigint  default null,
  p_dono            text    default null
)
returns table (
  card_id           bigint,
  dono              text,
  pedido_id         bigint,
  numero            integer,
  item_codigo       text,
  item_descricao    text,
  indice_unidade    integer,
  total_unidades    integer,
  produto_tiny_id   bigint,
  reposicao_card_id bigint,
  origem            text,
  origem_numero     integer,
  local             text,
  id_producao       text,
  qualidade_atual   text,
  desde             timestamptz,
  contagem_total    bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with alvo as (
    select pr.tiny_id, pr.codigo from public.produtos pr where pr.tiny_id = p_produto_tiny_id
  )
  select c.id                                                          as card_id,
         case when c.pedido_id is null then 'livre' else 'pedido' end  as dono,
         c.pedido_id,
         p.numero,
         c.item_codigo,
         c.item_descricao,
         c.indice_unidade,
         c.total_unidades,
         c.produto_tiny_id,
         case when pai.tipo = 'reposicao' then pai.id end              as reposicao_card_id,
         case when c.pedido_id is not null then 'pedido'
              when pai.tipo = 'reposicao'  then 'reposicao'
              when pai.tipo = 'pedido'     then 'cancelamento'
              else 'manual' end                                        as origem,
         case when c.pedido_id is null and pai.tipo = 'pedido'
              then po.numero end                                       as origem_numero,
         s.codigo                                                      as local,
         c.id_producao,
         c.qualidade_atual,
         c.desde,
         count(*) over ()                                              as contagem_total
    from public.plt_cards c
    join public.plt_setores s on s.id = c.setor_atual_id
    left join public.pedidos p on p.id = c.pedido_id
    left join public.plt_cards pai on pai.id = c.card_pai_id
    left join public.pedidos po on po.id = pai.pedido_id
   where plt_privado.fn_pode_ver_expedicao()
     and c.tipo = 'unidade'
     and c.arquivado_em is null
     and (s.codigo = 'estoque' or (s.codigo = 'aguardo' and c.pedido_id is not null))
     and (p_dono is null
          or (p_dono = 'livre'  and c.pedido_id is null)
          or (p_dono = 'pedido' and c.pedido_id is not null))
     and (p_produto_tiny_id is null
          or (c.produto_tiny_id = p_produto_tiny_id
              and not plt_privado.fn_eh_personalizado(c.item_descricao))
          or (c.pedido_id is not null
              and c.item_codigo = (select a.codigo from alvo a)
              and not plt_privado.fn_eh_personalizado(c.item_descricao)))
     and (p_busca is null or btrim(p_busca) = ''
          or c.id_producao ilike '%' || btrim(p_busca) || '%'
          or c.item_descricao ilike '%' || btrim(p_busca) || '%'
          or c.item_codigo ilike btrim(p_busca) || '%'
          or p.numero::text like btrim(p_busca) || '%'
          or po.numero::text like btrim(p_busca) || '%')
   order by c.desde asc nulls last, c.id
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

-- ----------------------------------------------------------------------------
-- 9 · A sugestão antiga sai (virou a aba Configurações — D-72)
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_estoque_sugestao_minimo(integer);

-- ----------------------------------------------------------------------------
-- 10 · Configurações: por produto acabado — o rank, o mínimo (efetivo, o do
--      Tiny e se foi definido aqui) e a sugestão que cabe no galpão.
-- ----------------------------------------------------------------------------
-- E-17 (migration 45): a forma mudou depois — derruba antes de recriar, senão
-- a reaplicação quebra ("cannot change return type").
drop function if exists public.plt_fn_estoque_configuracoes(integer, text, integer, integer);
drop function if exists public.plt_fn_estoque_configuracoes(text, integer, integer);
create function public.plt_fn_estoque_configuracoes(
  p_semanas      integer default 2,
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
  media_semana         numeric,
  minimo               numeric,
  minimo_tiny          numeric,
  minimo_definido_aqui boolean,
  sugestao             integer,
  em_estoque           integer,
  contagem_total       bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with livres as (
    select c.produto_tiny_id as tiny_id, count(*)::int as quantidade
      from public.plt_cards c
      join public.plt_setores s on s.id = c.setor_atual_id and s.codigo = 'estoque'
     where c.tipo = 'unidade' and c.pedido_id is null and c.arquivado_em is null
       and c.produto_tiny_id is not null
       and not plt_privado.fn_eh_personalizado(c.item_descricao)
     group by c.produto_tiny_id
  )
  select pr.tiny_id,
         pr.codigo,
         pr.descricao,
         pr.imagem_caminho,
         s.posicao,
         coalesce(s.vendidos, 0),
         coalesce(s.media_semana, 0),
         coalesce(pr.minimo_plataforma, pr.estoque_minimo),
         pr.estoque_minimo,
         pr.minimo_plataforma is not null,
         s.sugestao,
         coalesce(l.quantidade, 0),
         count(*) over ()
    from public.produtos pr
    left join plt_privado.fn_sugestoes_minimo(p_semanas) s on s.tiny_id = pr.tiny_id
    left join livres l on l.tiny_id = pr.tiny_id
   where plt_privado.fn_pode_ver_expedicao()
     and pr.situacao = 'A'
     and coalesce(pr.classe, '') in ('F', 'S', 'V')
     and (p_busca is null or btrim(p_busca) = ''
          or pr.descricao ilike '%' || btrim(p_busca) || '%'
          or pr.codigo ilike btrim(p_busca) || '%')
   order by s.posicao nulls last, pr.descricao, pr.tiny_id
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_estoque_configuracoes(integer, text, integer, integer) is
  'Aba Configurações do Estoque (D-72): produtos acabados pelo rank de 90 dias, com o mínimo (efetivo / do Tiny / definido aqui) e a sugestão que cabe na capacidade do galpão. Gate da logística.';

-- O resumo do galpão: capacidade, peças, soma dos mínimos e das sugestões.
-- E-17 (migration 45): a forma mudou depois — derruba antes de recriar.
drop function if exists public.plt_fn_estoque_resumo(integer);
drop function if exists public.plt_fn_estoque_resumo();
create function public.plt_fn_estoque_resumo(p_semanas integer default 2)
returns table (
  capacidade       integer,
  pecas_no_estoque integer,
  pecas_reservadas integer,
  soma_minimos     numeric,
  soma_sugestoes   integer,
  produtos_abaixo  integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (select s.capacidade_pecas from public.plt_setores s where s.codigo = 'estoque' limit 1),
         (select count(*)::int
            from public.plt_cards c
            join public.plt_setores s on s.id = c.setor_atual_id and s.codigo = 'estoque'
           where c.tipo = 'unidade' and c.pedido_id is null and c.arquivado_em is null),
         (select count(*)::int
            from public.plt_cards c
            join public.plt_setores s on s.id = c.setor_atual_id and s.codigo = 'aguardo'
           where c.tipo = 'unidade' and c.pedido_id is not null and c.arquivado_em is null),
         (select coalesce(sum(coalesce(pr.minimo_plataforma, pr.estoque_minimo)), 0)
            from public.produtos pr
           where pr.situacao = 'A' and coalesce(pr.classe, '') in ('F', 'S', 'V')),
         (select coalesce(sum(x.sugestao), 0)::int from plt_privado.fn_sugestoes_minimo(p_semanas) x),
         (select count(*)::int
            from plt_privado.fn_estoque_por_produto() b
           where b.situacao = 'A' and coalesce(b.classe, '') in ('F', 'S', 'V')
             and coalesce(b.minimo, 0) > 0 and b.disponivel < b.minimo)
   where plt_privado.fn_pode_ver_expedicao();
$$;

comment on function public.plt_fn_estoque_resumo(integer) is
  'Resumo do galpão para o Estoque (D-72): capacidade, peças livres no ESTOQUE, peças reservadas em Pedidos em aguardo, soma dos mínimos, soma das sugestões e produtos abaixo do mínimo. Gate da logística.';

-- ----------------------------------------------------------------------------
-- 11 · ENTRADA / BAIXA / CONTAGEM manual da logística (D-70). Cada peça é um
--      card `unidade` sem pedido, com o produto, no ESTOQUE; a baixa arquiva
--      as mais antigas (a primeira que entrou é a primeira que sai). Tudo por
--      evento append-only (RNF-05) — o gatilho de log grava a trilha (D-40).
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_estoque_movimentar(
  p_produto_tiny_id bigint,
  p_operacao        text,             -- 'entrada' | 'baixa' | 'contagem'
  p_quantidade      integer,          -- entrada/baixa: 1–500; contagem: 0–500 (o total contado)
  p_observacao      text default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario  uuid;
  v_produto  public.produtos%rowtype;
  v_estoque  bigint;
  v_atual    integer;
  v_delta    integer;
  v_motivo   text;
  v_obs      text;
  v_lote     bigint;
  v_card     bigint;
  v_dados    jsonb;
  i          integer;
  r          record;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null then
    raise exception 'Só usuário ativo da plataforma movimenta o estoque.'
      using errcode = 'insufficient_privilege';
  end if;
  if not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Movimentar o estoque é gesto da logística ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;
  if p_operacao is null or p_operacao not in ('entrada', 'baixa', 'contagem') then
    raise exception 'Escolha entrada, baixa ou contagem.' using errcode = 'check_violation';
  end if;
  -- O CASE vai entre parênteses: no IF do plpgsql, o primeiro THEN solto
  -- fecha a condição (E-61).
  if p_quantidade is null or p_quantidade > 500
     or p_quantidade < (case when p_operacao = 'contagem' then 0 else 1 end) then
    raise exception 'A quantidade precisa ser um número inteiro de % a 500.',
      case when p_operacao = 'contagem' then 0 else 1 end
      using errcode = 'check_violation';
  end if;

  select * into v_produto from public.produtos where tiny_id = p_produto_tiny_id;
  if not found then
    raise exception 'Produto não encontrado no catálogo.' using errcode = 'no_data_found';
  end if;
  if coalesce(v_produto.situacao, '') <> 'A' then
    raise exception 'Este produto está inativo no Tiny — não entra no estoque.'
      using errcode = 'check_violation';
  end if;
  if coalesce(v_produto.classe, '') not in ('F', 'S', 'V') then
    raise exception 'A contagem daqui é de produto acabado — matéria-prima e insumo seguem pelo Tiny.'
      using errcode = 'check_violation';
  end if;
  if plt_privado.fn_eh_personalizado(v_produto.descricao) then
    raise exception 'Produto personalizado não entra no estoque por aqui.'
      using errcode = 'check_violation';
  end if;

  select s.id into v_estoque from public.plt_setores s where s.codigo = 'estoque' and s.ativo;
  if v_estoque is null then
    raise exception 'O ESTOQUE não está cadastrado — fale com o admin.' using errcode = 'no_data_found';
  end if;

  -- Uma movimentação por vez em cada produto (duas baixas ao mesmo tempo não
  -- pegam a mesma peça).
  perform pg_advisory_xact_lock(hashtextextended('plt_estoque_produto:' || p_produto_tiny_id, 0));

  select count(*)::int into v_atual
    from public.plt_cards c
   where c.tipo = 'unidade' and c.pedido_id is null and c.arquivado_em is null
     and c.produto_tiny_id = p_produto_tiny_id and c.setor_atual_id = v_estoque
     and not plt_privado.fn_eh_personalizado(c.item_descricao);

  v_delta := case p_operacao
               when 'entrada' then p_quantidade
               when 'baixa'   then -p_quantidade
               else p_quantidade - v_atual
             end;
  v_motivo := case p_operacao
                when 'entrada' then 'entrada_manual'
                when 'baixa'   then 'baixa_manual'
                else 'contagem'
              end;
  v_obs := nullif(btrim(coalesce(p_observacao, '')), '');

  if v_delta < 0 and -v_delta > v_atual then
    raise exception 'Só há % deste produto no estoque — não dá para dar baixa em %.', v_atual, -v_delta
      using errcode = 'check_violation';
  end if;

  v_dados := jsonb_strip_nulls(jsonb_build_object(
    'motivo',          v_motivo,
    'produto_tiny_id', p_produto_tiny_id,
    'sku',             v_produto.codigo,
    'quantidade',      abs(v_delta),
    'antes',           v_atual,
    'depois',          v_atual + v_delta,
    'contado',         case when p_operacao = 'contagem' then p_quantidade end));

  if v_delta = 0 then
    -- Contagem conferida e igual: nada muda no estoque, fica o registro (D-40).
    insert into public.plt_logs_atividade (usuario_id, acao, contexto)
      values (v_usuario, 'estoque_contagem_conferida', v_dados);
    return v_atual;
  end if;

  if v_delta > 0 then
    for i in 1 .. v_delta loop
      insert into public.plt_cards
          (tipo, produto_tiny_id, item_codigo, item_descricao,
           indice_unidade, total_unidades, setor_atual_id)
        values
          ('unidade', p_produto_tiny_id, v_produto.codigo, v_produto.descricao,
           i, v_delta, v_estoque)
        returning id into v_card;
      v_lote := coalesce(v_lote, v_card);
      insert into public.plt_eventos
          (card_id, tipo, usuario_id, origem, setor_destino_id, observacao, dados)
        values
          (v_card, 'card_criado', v_usuario, 'interface', v_estoque, v_obs,
           v_dados || jsonb_build_object('lote', v_lote));
    end loop;
  else
    for r in
      select c.id
        from public.plt_cards c
       where c.tipo = 'unidade' and c.pedido_id is null and c.arquivado_em is null
         and c.produto_tiny_id = p_produto_tiny_id and c.setor_atual_id = v_estoque
         and not plt_privado.fn_eh_personalizado(c.item_descricao)
       order by c.desde asc nulls first, c.id
       limit -v_delta
         for update
    loop
      insert into public.plt_eventos
          (card_id, tipo, usuario_id, origem, setor_origem_id, observacao, dados)
        values
          (r.id, 'card_arquivado', v_usuario, 'interface', v_estoque, v_obs, v_dados);
    end loop;
  end if;

  return v_atual + v_delta;
end;
$$;

comment on function public.plt_fn_estoque_movimentar(bigint, text, integer, text) is
  'Entrada / baixa / contagem manual do estoque de um produto acabado (D-70). Entrada cria peças livres no ESTOQUE; baixa arquiva as mais antigas; contagem acerta a diferença. Gate da logística; devolve o total depois.';

-- ----------------------------------------------------------------------------
-- 12 · Mínimo e capacidade (D-72) — com a trilha (D-40)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_estoque_definir_minimo(
  p_produto_tiny_id bigint,
  p_minimo          numeric   -- nulo = volta a valer o mínimo do Tiny
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
  v_antes   numeric;
  v_codigo  text;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null then
    raise exception 'Só usuário ativo da plataforma altera o mínimo.' using errcode = 'insufficient_privilege';
  end if;
  if not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Alterar o mínimo do estoque é gesto da logística ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;
  if p_minimo is not null and (p_minimo < 0 or p_minimo > 100000) then
    raise exception 'O mínimo precisa ser um número de 0 a 100000 — ou vazio para usar o do Tiny.'
      using errcode = 'check_violation';
  end if;

  select coalesce(pr.minimo_plataforma, pr.estoque_minimo), pr.codigo
    into v_antes, v_codigo
    from public.produtos pr where pr.tiny_id = p_produto_tiny_id;
  if not found then
    raise exception 'Produto não encontrado no catálogo.' using errcode = 'no_data_found';
  end if;

  update public.produtos set minimo_plataforma = p_minimo where tiny_id = p_produto_tiny_id;

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_usuario, 'estoque_minimo_alterado',
            jsonb_build_object('produto_tiny_id', p_produto_tiny_id, 'sku', v_codigo,
                               'antes', v_antes, 'depois', p_minimo));
end;
$$;

-- "Usar todas as sugestões": o mínimo de cada acabado vira a sugestão que
-- cabe no galpão; quem não vendeu nada em 90 dias fica sem mínimo (0) — só
-- assim a soma dos mínimos cabe de verdade. Devolve quantos mudaram.
create or replace function public.plt_fn_estoque_aplicar_sugestoes(p_semanas integer default 2)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
  v_n       integer;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null then
    raise exception 'Só usuário ativo da plataforma altera o mínimo.' using errcode = 'insufficient_privilege';
  end if;
  if not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Alterar o mínimo do estoque é gesto da logística ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;

  with sugestoes as (
    select x.tiny_id, x.sugestao from plt_privado.fn_sugestoes_minimo(p_semanas) x
  ),
  alvo as (
    select pr.tiny_id, coalesce(s.sugestao, 0)::numeric as novo
      from public.produtos pr
      left join sugestoes s on s.tiny_id = pr.tiny_id
     where pr.situacao = 'A' and coalesce(pr.classe, '') in ('F', 'S', 'V')
       and (s.tiny_id is not null
            or coalesce(pr.minimo_plataforma, pr.estoque_minimo, 0) > 0)
  ),
  mudou as (
    update public.produtos pr
       set minimo_plataforma = a.novo
      from alvo a
     where pr.tiny_id = a.tiny_id
       and coalesce(pr.minimo_plataforma, pr.estoque_minimo) is distinct from a.novo
    returning pr.tiny_id
  )
  select count(*)::int into v_n from mudou;

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_usuario, 'estoque_sugestoes_aplicadas',
            jsonb_build_object('semanas', least(greatest(coalesce(p_semanas, 2), 1), 8),
                               'produtos_alterados', v_n));
  return v_n;
end;
$$;

create or replace function public.plt_fn_estoque_definir_capacidade(p_capacidade integer)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
  v_antes   integer;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null then
    raise exception 'Só usuário ativo da plataforma altera a capacidade.' using errcode = 'insufficient_privilege';
  end if;
  if not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Alterar a capacidade do galpão é gesto da logística ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;
  if p_capacidade is not null and (p_capacidade < 1 or p_capacidade > 100000) then
    raise exception 'A capacidade precisa ser um número inteiro de 1 a 100000 — ou vazio para não definir.'
      using errcode = 'check_violation';
  end if;

  select s.capacidade_pecas into v_antes from public.plt_setores s where s.codigo = 'estoque';
  update public.plt_setores set capacidade_pecas = p_capacidade where codigo = 'estoque';
  if not found then
    raise exception 'O ESTOQUE não está cadastrado — fale com o admin.' using errcode = 'no_data_found';
  end if;

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_usuario, 'estoque_capacidade_alterada',
            jsonb_build_object('antes', v_antes, 'depois', p_capacidade));
end;
$$;

-- ----------------------------------------------------------------------------
-- 13 · A FOTO do produto (D-73): o caminho no bucket plt-imagens, na pasta
--      produtos/{sku}/ (a mesma biblioteca por SKU do tablet — D-28).
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_estoque_definir_imagem(
  p_produto_tiny_id bigint,
  p_caminho         text      -- nulo = tira a foto do produto (o arquivo fica na biblioteca)
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
  v_codigo  text;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null then
    raise exception 'Só usuário ativo da plataforma troca a foto.' using errcode = 'insufficient_privilege';
  end if;
  if not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Cadastrar a foto do produto é gesto da logística ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;
  if p_caminho is not null
     and (length(p_caminho) > 300 or p_caminho !~ '^produtos/[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$') then
    raise exception 'Caminho de foto inválido.' using errcode = 'check_violation';
  end if;

  update public.produtos set imagem_caminho = p_caminho
   where tiny_id = p_produto_tiny_id
  returning codigo into v_codigo;
  if not found then
    raise exception 'Produto não encontrado no catálogo.' using errcode = 'no_data_found';
  end if;

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_usuario, 'estoque_foto_definida',
            jsonb_build_object('produto_tiny_id', p_produto_tiny_id, 'sku', v_codigo,
                               'caminho', p_caminho));
end;
$$;

-- A logística também anexa foto na pasta produtos/ (D-73). Guardado: o
-- Postgres dos testes não tem o schema storage.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    begin
      execute $pol$drop policy if exists plt_imagens_estoque_logistica on storage.objects$pol$;
      execute $pol$
        create policy plt_imagens_estoque_logistica on storage.objects
          for insert to authenticated
          with check (
            bucket_id = 'plt-imagens'
            and (storage.foldername(name))[1] = 'produtos'
            and plt_privado.fn_pode_ver_expedicao()
          )
      $pol$;
    exception when insufficient_privilege then
      raise notice 'storage: sem privilégio para a política da logística — criar pelo painel (documentado no handoff).';
    end;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 14 · Permissões: maquinaria fora da API (E-11); portas para authenticated
-- ----------------------------------------------------------------------------
revoke all on function plt_privado.fn_vendas_90d()               from public, anon, authenticated;
revoke all on function plt_privado.fn_sugestoes_minimo(integer)  from public, anon, authenticated;

revoke all on function public.plt_fn_estoque_produtos(text, text, text, integer, integer) from public, anon;
revoke all on function public.plt_fn_estoque_configuracoes(integer, text, integer, integer) from public, anon;
revoke all on function public.plt_fn_estoque_resumo(integer)                              from public, anon;
revoke all on function public.plt_fn_estoque_movimentar(bigint, text, integer, text)      from public, anon;
revoke all on function public.plt_fn_estoque_definir_minimo(bigint, numeric)              from public, anon;
revoke all on function public.plt_fn_estoque_aplicar_sugestoes(integer)                   from public, anon;
revoke all on function public.plt_fn_estoque_definir_capacidade(integer)                  from public, anon;
revoke all on function public.plt_fn_estoque_definir_imagem(bigint, text)                 from public, anon;

grant execute on function public.plt_fn_estoque_produtos(text, text, text, integer, integer) to authenticated;
grant execute on function public.plt_fn_estoque_configuracoes(integer, text, integer, integer) to authenticated;
grant execute on function public.plt_fn_estoque_resumo(integer)                              to authenticated;
grant execute on function public.plt_fn_estoque_movimentar(bigint, text, integer, text)      to authenticated;
grant execute on function public.plt_fn_estoque_definir_minimo(bigint, numeric)              to authenticated;
grant execute on function public.plt_fn_estoque_aplicar_sugestoes(integer)                   to authenticated;
grant execute on function public.plt_fn_estoque_definir_capacidade(integer)                  to authenticated;
grant execute on function public.plt_fn_estoque_definir_imagem(bigint, text)                 to authenticated;
