-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 45 — AJUSTE ESTOQUE 2:
-- Top X, necessidade de produção, reservados e sugestão por dias úteis
-- Demanda: _docs/Plataforma/Demandas/AJUSTE - Estoque 2 - ... (30/09/2026)
-- Decisões: D-83…D-87 (↩️ D-71/D-72 e o fluxo da reposição da D-54)
--
--   1. Sai a capacidade do galpão da CONTA (a coluna fica, sem uso — pedido do
--      dono); quem limita o estoque é o Top X: só os X mais vendidos têm mínimo.
--   2. Top X (1–50) é o tamanho da página da tela, valor único para a equipe
--      (logística/admin, com trilha — D-40). Guardado no setor ESTOQUE, como a
--      capacidade e a chave do Tiny (D-72/D-78).
--   3. Sugestão de mínimo por DIAS ÚTEIS DE VENDA (loja: seg–sáb — resposta do
--      dono em 30/09): média por dia útil × 6 × semanas de cobertura (1–8),
--      arredondada para cima no fim. Sem encolhimento por capacidade.
--   4. Mínimo AUTOMÁTICO: acompanha a sugestão (recalcula ao trocar cobertura/
--      Top X/corte e 1×/dia); editado à mão TRAVA até "voltar ao automático".
--      O mínimo do Tiny deixa de valer como reserva nos acabados (fica como
--      referência); nos insumos nada muda.
--   5. Corte de pedido fora do comum: linha com mais de X unidades (padrão 10,
--      admin) sai da conta de vendas — ranking E sugestão.
--   6. Reservados para produção (uma regra só — fn_reservados_producao):
--      para o ESTOQUE = reposição no PCP (dentro do prazo) + unidades sem
--      pedido em produção (inclui peça de pedido cancelado a caminho — resposta
--      3); para EXIBIÇÃO soma também as unidades DE PEDIDO em produção
--      (resposta 6). A NECESSIDADE usa só o que vem para o estoque.
--   7. Reposição parada 2 DIAS ÚTEIS da fábrica (seg–sex) no PCP vence: sai por
--      evento (Sistema, origem api, motivo reposicao_vencida); parcial vence só
--      a parte parada (o que entrou na produção segue). Depois de vencida, a
--      necessidade volta sem exigir movimento novo do estoque.
--   8. Liga/desliga da reposição automática = agendar/desagendar o job no
--      pg_cron (desligado: nenhuma rotina, nenhuma consulta). Nasce DESLIGADA.
--      Desligada, a logística tem o "Lançar para produção" manual.
--
-- E-17: plt_fn_estoque_configuracoes/resumo mudam de forma — o drop foi
-- adicionado também na migration 40. plt_fn_estoque_produtos já nasce de drop
-- + create na 42. fn_vendas_90d/fn_sugestoes_minimo/fn_estoque_por_produto/
-- fn_gerar_reposicoes mantêm a forma (create or replace).
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 0 · Pré-requisitos
-- ----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.plt_tiny_estoque_fila') is null then
    raise exception 'A migration 45 precisa da migration 42 (sincronismo do estoque com o Tiny).';
  end if;
  if to_regproc('plt_privado.fn_estoque_relogio') is null then
    raise exception 'A migration 45 precisa da migration 43 (relógio do estoque).';
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 1 · Colunas de configuração (no setor ESTOQUE, padrão da casa — D-72/D-78) e
--     a trava do mínimo automático (em produtos; fn_upsert_produto grava lista
--     explícita de colunas, o Tiny nunca sobrescreve estas).
-- ----------------------------------------------------------------------------
alter table public.plt_setores add column if not exists top_x               integer;
alter table public.plt_setores add column if not exists cobertura_semanas   integer;
alter table public.plt_setores add column if not exists corte_pedido_grande integer;
alter table public.produtos    add column if not exists minimo_travado      boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'plt_setores_top_x_ck') then
    alter table public.plt_setores
      add constraint plt_setores_top_x_ck check (top_x is null or (top_x between 1 and 50));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'plt_setores_cobertura_ck') then
    alter table public.plt_setores
      add constraint plt_setores_cobertura_ck
      check (cobertura_semanas is null or (cobertura_semanas between 1 and 8));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'plt_setores_corte_ck') then
    alter table public.plt_setores
      add constraint plt_setores_corte_ck
      check (corte_pedido_grande is null or (corte_pedido_grande between 1 and 100000));
  end if;
end;
$$;

comment on column public.plt_setores.top_x is
  'Top X do Estoque (D-83): quantos produtos do ranking têm mínimo, e o tamanho da página da tela. Usado só na linha codigo=estoque; nulo = 20.';
comment on column public.plt_setores.cobertura_semanas is
  'Semanas de cobertura da sugestão de mínimo (D-84). Usado só na linha codigo=estoque; nulo = 2.';
comment on column public.plt_setores.corte_pedido_grande is
  'Corte de pedido fora do comum (D-84): linha de pedido com MAIS unidades que isto sai da conta de vendas (ranking e sugestão). Usado só na linha codigo=estoque; nulo = 10.';
comment on column public.produtos.minimo_travado is
  'true = o mínimo foi editado à mão e NÃO acompanha a sugestão (D-84). false = automático: o recálculo escreve minimo_plataforma para quem está no Top X.';

-- Leitores da configuração (1 chamada por consulta, nunca por linha — E-65)
create or replace function plt_privado.fn_estoque_top_x()
returns integer language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select s.top_x from public.plt_setores s where s.codigo = 'estoque' limit 1), 20);
$$;

create or replace function plt_privado.fn_estoque_cobertura()
returns integer language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select s.cobertura_semanas from public.plt_setores s where s.codigo = 'estoque' limit 1), 2);
$$;

create or replace function plt_privado.fn_estoque_corte()
returns integer language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select s.corte_pedido_grande from public.plt_setores s where s.codigo = 'estoque' limit 1), 10);
$$;

-- ----------------------------------------------------------------------------
-- 2 · Dias úteis (respostas do dono, 30/09): a VENDA é da loja (seg–sáb); o
--     PRAZO da reposição é da fábrica (seg–sex). Sem tabela de feriados.
-- ----------------------------------------------------------------------------
-- Quantos dias úteis de venda (seg–sáb) cabem na mesma janela dos 90 dias que
-- fn_vendas_90d usa (data_pedido >= hoje−90, em America/Fortaleza).
create or replace function plt_privado.fn_dias_uteis_venda_90d()
returns integer language sql stable security definer set search_path = public, pg_temp as $$
  select count(*)::int
    from generate_series(
           (now() at time zone 'America/Fortaleza')::date - 90,
           (now() at time zone 'America/Fortaleza')::date,
           interval '1 day') d
   where extract(dow from d) between 1 and 6;   -- 1=segunda … 6=sábado
$$;

-- Quando a reposição criada em p_criado VENCE: à meia-noite (de Fortaleza)
-- depois do 2º dia útil da fábrica (seg–sex) seguinte ao dia da criação.
-- Ex.: criada segunda → conta ter/qua → vence quinta 00:00; criada sexta →
-- conta seg/ter → vence quarta 00:00.
create or replace function plt_privado.fn_reposicao_vence_em(p_criado timestamptz)
returns timestamptz language sql stable security definer set search_path = public, pg_temp as $$
  select (d + 1)::timestamp at time zone 'America/Fortaleza'
    from (
      select dd::date as d,
             row_number() over (order by dd) as n
        from generate_series(
               (p_criado at time zone 'America/Fortaleza')::date + 1,
               (p_criado at time zone 'America/Fortaleza')::date + 14,
               interval '1 day') dd
       where extract(dow from dd) between 1 and 5   -- 1=segunda … 5=sexta
    ) x
   where x.n = 2;
$$;

comment on function plt_privado.fn_reposicao_vence_em(timestamptz) is
  'Fim do prazo de 2 dias úteis da fábrica (seg–sex) para a reposição sair do PCP (D-85). Sem feriados (decisão do dono).';

-- ----------------------------------------------------------------------------
-- 3 · As vendas de 90 dias GANHAM O CORTE (mesma forma — a regra única do
--     ranking e da sugestão): linha com mais unidades que o corte sai da conta
--     como se o pedido não existisse (D-84).
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_vendas_90d()
returns table (tiny_id bigint, codigo text, vendidos numeric, posicao integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with corte as (
    select plt_privado.fn_estoque_corte() as maximo
  ),
  por_sku as (
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
      cross join corte
     where p.data_pedido >= (now() at time zone 'America/Fortaleza')::date - 90
       and plt_privado.fn_situacao_normalizada(p.situacao) <> 'cancelado'
       and not plt_privado.fn_eh_personalizado(pi.descricao)
       and pi.quantidade <= corte.maximo
     group by ps.tiny_id, ps.codigo
  )
  select v.tiny_id, v.codigo, v.vendidos,
         row_number() over (order by v.vendidos desc, v.codigo, v.tiny_id)::int as posicao
    from vendas v
   where v.vendidos > 0;
$$;

comment on function plt_privado.fn_vendas_90d() is
  'Vendas da loja nos últimos 90 dias por produto acabado (SKU, sem cancelado/personalizado), JÁ com o corte de pedido fora do comum (D-84). A regra única do Top X e da sugestão.';

-- Quantas linhas de pedido saíram da conta por produto (o aviso discreto do
-- cartão: "N pedido(s) grande(s) fora da conta").
create or replace function plt_privado.fn_estoque_cortes_90d()
returns table (tiny_id bigint, cortes integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with corte as (
    select plt_privado.fn_estoque_corte() as maximo
  ),
  por_sku as (
    select distinct on (pr.codigo) pr.codigo, pr.tiny_id
      from public.produtos pr
     where pr.codigo is not null and pr.situacao = 'A'
       and coalesce(pr.classe, '') in ('F', 'S', 'V')
     order by pr.codigo, pr.tiny_id
  )
  select ps.tiny_id, count(*)::int as cortes
    from public.pedidos p
    join public.pedido_itens pi on pi.pedido_id = p.id
    join por_sku ps on ps.codigo = pi.codigo
    cross join corte
   where p.data_pedido >= (now() at time zone 'America/Fortaleza')::date - 90
     and plt_privado.fn_situacao_normalizada(p.situacao) <> 'cancelado'
     and not plt_privado.fn_eh_personalizado(pi.descricao)
     and pi.quantidade > corte.maximo
   group by ps.tiny_id;
$$;

-- ----------------------------------------------------------------------------
-- 4 · A sugestão de mínimo por DIAS ÚTEIS (mesma forma): média por dia útil de
--     venda × 6 × semanas, arredondada para cima NO FIM. Só o Top X tem
--     sugestão. p_semanas nulo = a cobertura configurada.
--     Ex. (conferido com o dono): 96 vendidos ÷ 78 dias úteis ≈ 1,23/dia →
--     ×6 ≈ 7,4/semana (mostra 8) → 2 semanas → teto(14,8) = 15.
-- ----------------------------------------------------------------------------
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
  select v.tiny_id, v.vendidos, v.posicao,
         round(v.vendidos / cfg.dias_uteis * 6, 1)                    as media_semana,
         ceil(v.vendidos / cfg.dias_uteis * 6 * cfg.semanas)::int     as sugestao
    from plt_privado.fn_vendas_90d() v
    cross join cfg
   where v.posicao <= cfg.top_x;
$$;

comment on function plt_privado.fn_sugestoes_minimo(integer) is
  'Sugestão de mínimo do Top X por dias úteis de venda (loja seg–sáb — D-84): vendidos ÷ dias úteis × 6 × semanas, teto no fim. Sem capacidade do galpão (↩️ D-72). p_semanas nulo = a cobertura configurada.';

-- ----------------------------------------------------------------------------
-- 5 · O mínimo EFETIVO num lugar só (D-83): acabado = o da plataforma, e SÓ
--     dentro do Top X (o do Tiny deixa de ser reserva); insumo = plataforma,
--     senão o do Tiny (como antes).
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_minimo_efetivo(p_tiny_id bigint)
returns numeric language sql stable security definer set search_path = public, pg_temp as $$
  select case
           when coalesce(pr.classe, '') in ('F', 'S', 'V') then
             case when exists (select 1 from plt_privado.fn_vendas_90d() v
                                where v.tiny_id = pr.tiny_id
                                  and v.posicao <= plt_privado.fn_estoque_top_x())
                  then pr.minimo_plataforma end
           else coalesce(pr.minimo_plataforma, pr.estoque_minimo)
         end
    from public.produtos pr
   where pr.tiny_id = p_tiny_id;
$$;

-- O recálculo do mínimo automático: escreve a sugestão em quem está no Top X e
-- NÃO está travado. Quem saiu do Top X fica com o valor adormecido (nada se
-- apaga); travado à mão não é tocado. Devolve quantos mudaram.
create or replace function plt_privado.fn_recalcular_minimos()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer;
begin
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

comment on function plt_privado.fn_recalcular_minimos() is
  'Mínimo automático (D-84): grava a sugestão do dia em cada produto do Top X que não está travado à mão. Roda 1×/dia (plt-estoque-minimos) e a cada troca de cobertura/Top X/corte.';

-- ----------------------------------------------------------------------------
-- 6 · Reservados para produção — UMA regra (D-86, resposta 6 do dono):
--     · para_estoque  = o que VEM para o estoque: reposição parada no PCP
--       (dentro do prazo) + unidades SEM pedido em produção (reposição
--       liberada, peça de pedido cancelado a caminho — resposta 3).
--     · de_pedidos    = unidades DE PEDIDO em produção (aparecem no número,
--       não abatem a necessidade — elas saem com o pedido).
--     · exibicao      = a soma (o número do cartão).
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_reservados_producao()
returns table (tiny_id bigint, para_estoque integer, de_pedidos integer, pcp_pendentes integer, exibicao integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with por_sku as (
    select distinct on (pr.codigo) pr.codigo, pr.tiny_id
      from public.produtos pr
     where pr.codigo is not null and pr.situacao = 'A'
       and coalesce(pr.classe, '') in ('F', 'S', 'V')
     order by pr.codigo, pr.tiny_id
  ),
  producao as (
    -- unidade viva fora de setor terminal = em produção (inclui parada no PCP
    -- já liberada; exclui ESTOQUE/AGUARDO, que são terminais)
    select c.id, c.pedido_id, c.produto_tiny_id, c.item_codigo, c.item_descricao
      from public.plt_cards c
      join public.plt_setores s on s.id = c.setor_atual_id
     where c.tipo = 'unidade' and c.arquivado_em is null and c.concluido_em is null
       and s.papel_no_fluxo is distinct from 'terminal'
  ),
  soltas as (
    select coalesce(c.produto_tiny_id, ps.tiny_id) as tiny_id, count(*)::int as q
      from producao c
      left join por_sku ps on ps.codigo = c.item_codigo
     where c.pedido_id is null
       and coalesce(c.produto_tiny_id, ps.tiny_id) is not null
       and not plt_privado.fn_eh_personalizado(c.item_descricao)
     group by 1
  ),
  de_pedido as (
    select ps.tiny_id, count(*)::int as q
      from producao c
      join por_sku ps on ps.codigo = c.item_codigo
     where c.pedido_id is not null
       and not plt_privado.fn_eh_personalizado(c.item_descricao)
     group by ps.tiny_id
  ),
  pcp as (
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
    select tiny_id from soltas
    union select tiny_id from de_pedido
    union select tiny_id from pcp
  )
  select k.tiny_id,
         coalesce(s.q, 0) + coalesce(p.q, 0)                      as para_estoque,
         coalesce(d.q, 0)                                          as de_pedidos,
         coalesce(p.q, 0)                                          as pcp_pendentes,
         coalesce(s.q, 0) + coalesce(p.q, 0) + coalesce(d.q, 0)    as exibicao
    from chaves k
    left join soltas    s on s.tiny_id = k.tiny_id
    left join de_pedido d on d.tiny_id = k.tiny_id
    left join pcp       p on p.tiny_id = k.tiny_id;
$$;

comment on function plt_privado.fn_reservados_producao() is
  'Reservados para produção por produto (D-86): para_estoque (reposição no PCP dentro do prazo + unidades sem pedido em produção) abate a necessidade; exibicao soma também as unidades de pedido (o número do cartão).';

-- ----------------------------------------------------------------------------
-- 7 · A base do estoque (recriada POR INTEIRO a partir da migration 42 — mesma
--     forma): o MÍNIMO dos acabados agora é o da plataforma e SÓ no Top X
--     (D-83); o estado da reposição prefere "em produção" quando há unidade
--     rodando. O resto é o da 42.
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
  topx as (
    select v.tiny_id from plt_privado.fn_vendas_90d() v
     where v.posicao <= plt_privado.fn_estoque_top_x()
  ),
  leituras as (
    select * from plt_privado.fn_leituras_tiny()
  ),
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
    select x.tiny_id, sum(x.quantidade)::int as quantidade
      from (
        select ps.tiny_id, count(*)::int as quantidade
          from public.plt_cards c
          join public.plt_setores s on s.id = c.setor_atual_id
                                   and s.papel_no_fluxo = 'terminal' and s.codigo <> 'rotas'
          join por_sku ps on ps.codigo = c.item_codigo
         where c.tipo = 'unidade' and c.pedido_id is not null and c.arquivado_em is null
           and not plt_privado.fn_eh_personalizado(c.item_descricao)
         group by ps.tiny_id
        union all
        select c.produto_tiny_id, count(*)::int
          from public.plt_cards c
         where c.tipo = 'unidade' and c.pedido_id is null and c.arquivado_em is null
           and c.reservada_pedido_id is not null and c.produto_tiny_id is not null
           and c.setor_atual_id in (select id from estoque)
         group by c.produto_tiny_id
      ) x
     group by x.tiny_id
  ),
  livres as (
    select c.produto_tiny_id as tiny_id, count(*)::int as quantidade
      from public.plt_cards c
     where c.tipo = 'unidade' and c.pedido_id is null and c.arquivado_em is null
       and c.reservada_pedido_id is null
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
         -- D-83: acabado = mínimo da plataforma, só no Top X (sem reserva do
         -- Tiny); insumo = plataforma, senão o do Tiny (como antes).
         case when coalesce(pr.classe, '') in ('F', 'S', 'V')
              then case when pr.tiny_id in (select t.tiny_id from topx t)
                        then pr.minimo_plataforma end
              else coalesce(pr.minimo_plataforma, pr.estoque_minimo) end as minimo,
         l.saldo                                                as saldo_tiny,
         l.reservado_tiny,
         l.lido_em,
         l.origem                                               as origem_leitura,
         l.evento_id                                            as evento_leitura_id,
         coalesce(r.quantidade, 0)                              as reservas_loja,
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
  'A base do estoque por produto. Acabados: número = peças livres no ESTOQUE (D-70/D-78) e mínimo = o da plataforma SÓ no Top X (D-83); insumos: Tiny − reservas. Reservados = aguardo + reservadas para venda.';

-- ----------------------------------------------------------------------------
-- 8 · Estoque coberto (recriada da 42): o mínimo agora é o EFETIVO (D-83).
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 9 · Gerar reposições (recriada da 40 — mesma forma):
--     · desconta o que já vem para o estoque (D-86);
--     · um card ABERTO por produto continua bloqueando; unidade em produção
--       NÃO bloqueia mais (a conta desconta);
--     · depois de ciclo DECIDIDO (Não produzir / coberto), continua exigindo
--       movimento novo; depois de ciclo VENCIDO, gera direto (D-85).
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_gerar_reposicoes()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
      left join plt_privado.fn_reservados_producao() rp on rp.tiny_id = b.tiny_id
     where b.situacao = 'A'
       and b.classe in ('F', 'S', 'V')
       and coalesce(b.minimo, 0) > 0
       and b.disponivel + coalesce(rp.para_estoque, 0) < b.minimo
  loop
    -- Um card aberto por produto (a conta já desconta o que está em produção).
    if exists (
         select 1 from public.plt_cards rc
          where rc.tipo = 'reposicao' and rc.produto_tiny_id = r.tiny_id
            and rc.arquivado_em is null and rc.liberado_completo_em is null) then
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
       where rc.tipo = 'reposicao' and rc.produto_tiny_id = r.tiny_id;
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
$$;

comment on function plt_privado.fn_gerar_reposicoes() is
  'Abaixo do mínimo efetivo (Top X — D-83), descontando o que já vem para o estoque (D-86), gera o card de REPOSIÇÃO no PCP. Um card aberto por produto; ciclo decidido exige movimento novo; ciclo vencido reabre sozinho (D-85). Roda só com a automação ligada (job plt-estoque-reposicao).';

-- ----------------------------------------------------------------------------
-- 10 · O VENCIMENTO (D-85): reposição aberta no PCP além do prazo sai por
--      evento — o Sistema assina (origem api, sem usuário). Parcial: o card sai
--      do PCP, mas o que entrou na produção segue produzindo e contando.
-- ----------------------------------------------------------------------------
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

comment on function plt_privado.fn_vencer_reposicoes() is
  'A segunda saída da reposição (D-85): parada 2 dias úteis da fábrica no PCP, sai por evento com o Sistema assinando (origem api). Roda de hora em hora (plt-estoque-vencimentos), independente do liga/desliga da automática (a manual também vence).';

-- ----------------------------------------------------------------------------
-- 11 · A lista por produto (drop + create — a forma mudou): X é o tamanho da
--      página; o recorte "Top 20+ / fora" morre (o catálogo inteiro é UMA
--      lista ordenada pelo ranking); filtros novos; campos novos do cartão.
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_estoque_produtos(text, text, text, integer, integer);
create function public.plt_fn_estoque_produtos(
  p_grupo        text    default 'acabados',  -- 'acabados' | 'insumos'
  p_busca        text    default null,
  p_filtro       text    default null,        -- acabados: null/'todos' | 'necessidade' | 'reservados_producao' | 'com_estoque'; insumos: null | 'sem_leitura'
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
  res_estoque as (
    select c.produto_tiny_id as tiny_id, count(*)::int as quantidade
      from public.plt_cards c
      join public.plt_setores s on s.id = c.setor_atual_id and s.codigo = 'estoque'
     where c.tipo = 'unidade' and c.pedido_id is null and c.arquivado_em is null
       and c.reservada_pedido_id is not null and c.produto_tiny_id is not null
     group by c.produto_tiny_id
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
           v.posicao, v.vendidos,
           ct.cortes                                                                    as cortes_,
           sg.sugestao                                                                  as sugestao_,
           (v.posicao is not null and v.posicao <= cfg.top_x)                           as no_top_,
           coalesce(re.quantidade, 0)                                                   as reservadas_estoque_,
           coalesce(rp.exibicao, 0)                                                     as reservados_producao_,
           coalesce(rp.para_estoque, 0)                                                 as para_estoque_,
           pd.card_id                                                                   as pendente_card_,
           pd.pedido_numero                                                             as pendente_numero_,
           case when b.disponivel is not null then greatest(b.disponivel, 0) end        as em_estoque_
      from plt_privado.fn_estoque_por_produto() b
      join public.produtos pr on pr.tiny_id = b.tiny_id
      cross join cfg
      left join plt_privado.fn_vendas_90d()          v  on v.tiny_id  = b.tiny_id
      left join plt_privado.fn_estoque_cortes_90d()  ct on ct.tiny_id = b.tiny_id
      left join plt_privado.fn_sugestoes_minimo(null) sg on sg.tiny_id = b.tiny_id
      left join plt_privado.fn_reservados_producao() rp on rp.tiny_id = b.tiny_id
      left join res_estoque re on re.tiny_id = b.tiny_id
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
         coalesce(f.cortes_, 0),
         coalesce(f.no_top_, false),
         f.minimo,
         f.minimo_tiny,
         f.minimo_travado,
         f.sugestao_,
         f.em_estoque_,
         f.prontos_reservados,
         f.reservadas_estoque_,
         f.reservados_producao_,
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
           when p_filtro = 'necessidade'
             then coalesce(f.minimo, 0) > 0
              and coalesce(f.em_estoque_, 0) + f.para_estoque_ < f.minimo
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
  'Estoque por produto (D-83/D-86). Acabados: UMA lista pelo ranking de 90 dias (com corte), paginada pelo Top X; filtros necessidade / reservados_producao / com_estoque; a busca varre tudo. Cartão: em estoque, reservados p/ produção (exibição), reservados em venda, bolinha do PCP. Insumos: Tiny, com estoque primeiro. Gate da logística.';

-- ----------------------------------------------------------------------------
-- 12 · Configurações (drop + create — a forma mudou; o drop também entrou na
--      migration 40 — E-17): sem p_semanas (a cobertura agora é configuração),
--      mesma ordem e página do Top X; travado e cortes na linha.
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_estoque_configuracoes(integer, text, integer, integer);
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
  ),
  livres as (
    select c.produto_tiny_id as tiny_id, count(*)::int as quantidade
      from public.plt_cards c
      join public.plt_setores s on s.id = c.setor_atual_id and s.codigo = 'estoque'
     where c.tipo = 'unidade' and c.pedido_id is null and c.arquivado_em is null
       and c.reservada_pedido_id is null and c.produto_tiny_id is not null
       and not plt_privado.fn_eh_personalizado(c.item_descricao)
     group by c.produto_tiny_id
  )
  select pr.tiny_id,
         pr.codigo,
         pr.descricao,
         pr.imagem_caminho,
         v.posicao,
         coalesce(v.vendidos, 0),
         coalesce(ct.cortes, 0),
         (v.posicao is not null and v.posicao <= cfg.top_x),
         s.media_semana,
         case when v.posicao is not null and v.posicao <= cfg.top_x
              then pr.minimo_plataforma end,
         pr.estoque_minimo,
         pr.minimo_travado,
         s.sugestao,
         coalesce(l.quantidade, 0),
         count(*) over ()
    from public.produtos pr
    cross join cfg
    left join plt_privado.fn_vendas_90d()           v  on v.tiny_id  = pr.tiny_id
    left join plt_privado.fn_estoque_cortes_90d()   ct on ct.tiny_id = pr.tiny_id
    left join plt_privado.fn_sugestoes_minimo(null) s  on s.tiny_id  = pr.tiny_id
    left join livres l on l.tiny_id = pr.tiny_id
   where plt_privado.fn_pode_ver_expedicao()
     and pr.situacao = 'A'
     and coalesce(pr.classe, '') in ('F', 'S', 'V')
     and (p_busca is null or btrim(p_busca) = ''
          or pr.descricao ilike '%' || btrim(p_busca) || '%'
          or pr.codigo ilike btrim(p_busca) || '%')
   order by v.posicao nulls last, pr.descricao, pr.tiny_id
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_estoque_configuracoes(text, integer, integer) is
  'Aba Configurações do Estoque (D-84): a mesma ordem e página do Top X; mínimo automático (travado à mão fica marcado), sugestão por dias úteis, o do Tiny só como referência. Fora do Top X, sem mínimo. Gate da logística.';

-- O resumo do galpão remodelado (pedido do dono em 30/09, na sessão): SEIS
-- números, sem capacidade e sem soma das sugestões (↩️ D-72).
--   móveis em estoque · peças (insumos) por unidade · peças (insumos) por m² ·
--   móveis prontos reservados · peças em produção (sem dono, a caminho do
--   estoque) · móveis em produção (de pedidos)
drop function if exists public.plt_fn_estoque_resumo(integer);
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
  with producao as (
    select c.pedido_id
      from public.plt_cards c
      join public.plt_setores s on s.id = c.setor_atual_id
     where c.tipo = 'unidade' and c.arquivado_em is null and c.concluido_em is null
       and s.papel_no_fluxo is distinct from 'terminal'
  ),
  insumos as (
    select b.unidade, greatest(coalesce(b.disponivel, 0), 0) as quantidade
      from plt_privado.fn_estoque_por_produto() b
     where b.situacao = 'A' and b.classe in ('M', 'K')
  )
  select (select count(*)::int
            from public.plt_cards c
            join public.plt_setores s on s.id = c.setor_atual_id and s.codigo = 'estoque'
           where c.tipo = 'unidade' and c.pedido_id is null and c.arquivado_em is null
             and c.reservada_pedido_id is null),
         (select coalesce(sum(i.quantidade), 0) from insumos i
           where lower(coalesce(i.unidade, '')) not in ('m2', 'm²', 'm^2')),
         (select coalesce(sum(i.quantidade), 0) from insumos i
           where lower(coalesce(i.unidade, '')) in ('m2', 'm²', 'm^2')),
         (select count(*)::int
            from public.plt_cards c
            join public.plt_setores s on s.id = c.setor_atual_id
           where c.tipo = 'unidade' and c.arquivado_em is null
             and ((s.codigo = 'aguardo' and c.pedido_id is not null)
                  or (s.codigo = 'estoque' and c.pedido_id is null and c.reservada_pedido_id is not null))),
         (select count(*)::int from producao p where p.pedido_id is null),
         (select count(*)::int from producao p where p.pedido_id is not null),
         (select coalesce(sum(b.minimo), 0)
            from plt_privado.fn_estoque_por_produto() b
           where b.situacao = 'A' and coalesce(b.classe, '') in ('F', 'S', 'V')),
         (select count(*)::int
            from plt_privado.fn_estoque_por_produto() b
            left join plt_privado.fn_reservados_producao() rp on rp.tiny_id = b.tiny_id
           where b.situacao = 'A' and coalesce(b.classe, '') in ('F', 'S', 'V')
             and coalesce(b.minimo, 0) > 0
             and b.disponivel + coalesce(rp.para_estoque, 0) < b.minimo)
   where plt_privado.fn_pode_ver_expedicao();
$$;

comment on function public.plt_fn_estoque_resumo() is
  'Resumo do galpão (pedido do dono 30/09, ↩️ D-72): móveis em estoque (livres), insumos por unidade e por m², móveis prontos reservados, peças em produção (sem dono) e móveis em produção (de pedidos) — mais a soma dos mínimos do Top X e os produtos em necessidade. Sem capacidade.';

-- ----------------------------------------------------------------------------
-- 13 · As configurações — ler e alterar (com a trilha, D-40)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_estoque_config()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when not plt_privado.fn_pode_ver_expedicao() then null else
    jsonb_build_object(
      'top_x',               plt_privado.fn_estoque_top_x(),
      'cobertura_semanas',   plt_privado.fn_estoque_cobertura(),
      'corte_pedido_grande', plt_privado.fn_estoque_corte(),
      'dias_uteis_venda',    plt_privado.fn_dias_uteis_venda_90d())
  end;
$$;

create or replace function public.plt_fn_estoque_definir_top_x(p_top_x integer)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
  v_antes   integer;
  v_recalc  integer;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Alterar o Top X é gesto da logística ou de admin.' using errcode = 'insufficient_privilege';
  end if;
  if p_top_x is null or p_top_x < 1 or p_top_x > 50 then
    raise exception 'O Top X precisa ser um número de 1 a 50.' using errcode = 'check_violation';
  end if;
  v_antes := plt_privado.fn_estoque_top_x();
  update public.plt_setores set top_x = p_top_x where codigo = 'estoque';
  if not found then
    raise exception 'O ESTOQUE não está cadastrado — fale com o admin.' using errcode = 'no_data_found';
  end if;
  v_recalc := plt_privado.fn_recalcular_minimos();
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_usuario, 'estoque_top_x_alterado',
            jsonb_build_object('antes', v_antes, 'depois', p_top_x, 'minimos_recalculados', v_recalc));
end;
$$;

create or replace function public.plt_fn_estoque_definir_cobertura(p_semanas integer)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
  v_antes   integer;
  v_recalc  integer;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Alterar a cobertura é gesto da logística ou de admin.' using errcode = 'insufficient_privilege';
  end if;
  if p_semanas is null or p_semanas < 1 or p_semanas > 8 then
    raise exception 'A cobertura precisa ser de 1 a 8 semanas.' using errcode = 'check_violation';
  end if;
  v_antes := plt_privado.fn_estoque_cobertura();
  update public.plt_setores set cobertura_semanas = p_semanas where codigo = 'estoque';
  if not found then
    raise exception 'O ESTOQUE não está cadastrado — fale com o admin.' using errcode = 'no_data_found';
  end if;
  v_recalc := plt_privado.fn_recalcular_minimos();
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_usuario, 'estoque_cobertura_alterada',
            jsonb_build_object('antes', v_antes, 'depois', p_semanas, 'minimos_recalculados', v_recalc));
end;
$$;

create or replace function public.plt_fn_estoque_definir_corte(p_quantidade integer)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
  v_antes   integer;
  v_recalc  integer;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null or not plt_privado.fn_eh_admin() then
    raise exception 'Alterar o corte de pedido fora do comum é gesto de admin (Painel admin).' using errcode = 'insufficient_privilege';
  end if;
  if p_quantidade is null or p_quantidade < 1 or p_quantidade > 100000 then
    raise exception 'O corte precisa ser um número de 1 a 100000.' using errcode = 'check_violation';
  end if;
  v_antes := plt_privado.fn_estoque_corte();
  update public.plt_setores set corte_pedido_grande = p_quantidade where codigo = 'estoque';
  if not found then
    raise exception 'O ESTOQUE não está cadastrado — fale com o admin.' using errcode = 'no_data_found';
  end if;
  v_recalc := plt_privado.fn_recalcular_minimos();
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_usuario, 'estoque_corte_alterado',
            jsonb_build_object('antes', v_antes, 'depois', p_quantidade, 'minimos_recalculados', v_recalc));
end;
$$;

-- ----------------------------------------------------------------------------
-- 14 · O mínimo (recriada da 40 — mesma assinatura): editar TRAVA (D-84);
--      "voltar ao automático" destrava e recalcula na hora.
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_estoque_definir_minimo(
  p_produto_tiny_id bigint,
  p_minimo          numeric
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
  if p_minimo is null then
    raise exception 'Para o mínimo voltar a acompanhar a sugestão, use "voltar ao automático".'
      using errcode = 'check_violation';
  end if;
  if p_minimo < 0 or p_minimo > 100000 then
    raise exception 'O mínimo precisa ser um número de 0 a 100000.' using errcode = 'check_violation';
  end if;

  select pr.minimo_plataforma, pr.codigo
    into v_antes, v_codigo
    from public.produtos pr where pr.tiny_id = p_produto_tiny_id;
  if not found then
    raise exception 'Produto não encontrado no catálogo.' using errcode = 'no_data_found';
  end if;

  update public.produtos
     set minimo_plataforma = p_minimo, minimo_travado = true
   where tiny_id = p_produto_tiny_id;

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_usuario, 'estoque_minimo_alterado',
            jsonb_build_object('produto_tiny_id', p_produto_tiny_id, 'sku', v_codigo,
                               'antes', v_antes, 'depois', p_minimo, 'travado', true));
end;
$$;

create or replace function public.plt_fn_estoque_minimo_automatico(p_produto_tiny_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario  uuid;
  v_antes    numeric;
  v_codigo   text;
  v_sugestao integer;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Alterar o mínimo do estoque é gesto da logística ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;

  select pr.minimo_plataforma, pr.codigo
    into v_antes, v_codigo
    from public.produtos pr where pr.tiny_id = p_produto_tiny_id;
  if not found then
    raise exception 'Produto não encontrado no catálogo.' using errcode = 'no_data_found';
  end if;

  select s.sugestao into v_sugestao
    from plt_privado.fn_sugestoes_minimo(null) s where s.tiny_id = p_produto_tiny_id;

  update public.produtos
     set minimo_travado    = false,
         minimo_plataforma = coalesce(v_sugestao::numeric, minimo_plataforma)
   where tiny_id = p_produto_tiny_id;

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_usuario, 'estoque_minimo_automatico',
            jsonb_build_object('produto_tiny_id', p_produto_tiny_id, 'sku', v_codigo,
                               'antes', v_antes, 'depois', v_sugestao));
end;
$$;

comment on function public.plt_fn_estoque_minimo_automatico(bigint) is
  '"Voltar ao automático" (D-84): destrava o mínimo do produto e o alinha à sugestão do dia (dentro do Top X; fora, só destrava — o valor fica adormecido).';

-- ----------------------------------------------------------------------------
-- 15 · "Lançar para produção" (D-87): com a automação DESLIGADA, a logística
--      cria a reposição no PCP à mão (gesto humano, com autor).
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_estoque_lancar_reposicao(
  p_produto_tiny_id bigint,
  p_quantidade      integer
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
  v_pcp     bigint;
  v_produto record;
  v_card_id bigint;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Lançar reposição para produção é gesto da logística ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;
  if p_quantidade is null or p_quantidade < 1 or p_quantidade > 500 then
    raise exception 'A quantidade precisa ser de 1 a 500.' using errcode = 'check_violation';
  end if;

  select pr.tiny_id, pr.codigo, pr.descricao into v_produto
    from public.produtos pr
   where pr.tiny_id = p_produto_tiny_id and pr.situacao = 'A'
     and coalesce(pr.classe, '') in ('F', 'S', 'V');
  if not found then
    raise exception 'Produto acabado não encontrado no catálogo.' using errcode = 'no_data_found';
  end if;

  if exists (select 1 from public.plt_cards rc
              where rc.tipo = 'reposicao' and rc.produto_tiny_id = p_produto_tiny_id
                and rc.arquivado_em is null and rc.liberado_completo_em is null) then
    raise exception 'Este produto já tem uma reposição aberta no PCP.' using errcode = 'unique_violation';
  end if;

  select s.id into v_pcp from public.plt_setores s
   where s.papel_no_fluxo = 'entrada' and s.ativo
   order by s.id limit 1;
  if v_pcp is null then
    raise exception 'O PCP não está cadastrado — fale com o admin.' using errcode = 'no_data_found';
  end if;

  insert into public.plt_cards
      (tipo, produto_tiny_id, item_codigo, item_descricao, total_unidades, setor_atual_id)
    values
      ('reposicao', v_produto.tiny_id, v_produto.codigo, v_produto.descricao, p_quantidade, v_pcp)
    returning id into v_card_id;

  insert into public.plt_eventos (card_id, tipo, origem, usuario_id, setor_destino_id, dados)
    values (v_card_id, 'card_criado', 'interface', v_usuario, v_pcp,
            jsonb_build_object('motivo', 'reposicao_manual',
                               'produto_tiny_id', v_produto.tiny_id,
                               'sku', v_produto.codigo,
                               'quantidade', p_quantidade));

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_usuario, 'estoque_reposicao_lancada',
            jsonb_build_object('produto_tiny_id', v_produto.tiny_id, 'sku', v_produto.codigo,
                               'quantidade', p_quantidade, 'card_id', v_card_id));
  return v_card_id;
end;
$$;

comment on function public.plt_fn_estoque_lancar_reposicao(bigint, integer) is
  'O botão "Lançar para produção" (D-87): cria a reposição no PCP à mão, com autor. A tela só o mostra com a automação desligada (resposta 4 do dono); o vencimento de 2 dias úteis vale igual (resposta 7).';

-- ----------------------------------------------------------------------------
-- 16 · Liga/desliga da REPOSIÇÃO AUTOMÁTICA (D-87): o botão agenda/desagenda o
--      job de verdade — desligado, nenhuma rotina roda e nenhuma consulta
--      acontece. Só admin (Painel admin). Nasce DESLIGADA.
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_estoque_reposicao_ligar()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null or not plt_privado.fn_eh_admin() then
    raise exception 'Ligar a reposição automática é gesto de admin.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    return jsonb_build_object('ligada', false, 'motivo', 'sem_pg_cron');
  end if;
  if exists (select 1 from cron.job where jobname = 'plt-estoque-reposicao') then
    return jsonb_build_object('ligada', true, 'ja_estava', true);
  end if;
  perform cron.schedule('plt-estoque-reposicao', '*/5 * * * *',
    'select plt_privado.fn_gerar_reposicoes()');
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_usuario, 'estoque_reposicao_ligada', '{}'::jsonb);
  return jsonb_build_object('ligada', true);
end;
$$;

create or replace function public.plt_fn_estoque_reposicao_desligar()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
  v_job     bigint;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null or not plt_privado.fn_eh_admin() then
    raise exception 'Desligar a reposição automática é gesto de admin.' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    select jobid into v_job from cron.job where jobname = 'plt-estoque-reposicao';
    if v_job is not null then
      perform cron.unschedule(v_job);
      insert into public.plt_logs_atividade (usuario_id, acao, contexto)
        values (v_usuario, 'estoque_reposicao_desligada', '{}'::jsonb);
    end if;
  end if;
  return jsonb_build_object('ligada', false);
end;
$$;

create or replace function public.plt_fn_estoque_reposicao_situacao()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not plt_privado.fn_pode_ver_expedicao() then
    return null;
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    return jsonb_build_object('ligada', false, 'motivo', 'sem_pg_cron');
  end if;
  return jsonb_build_object(
    'ligada', exists (select 1 from cron.job where jobname = 'plt-estoque-reposicao'));
end;
$$;

comment on function public.plt_fn_estoque_reposicao_situacao() is
  'A reposição automática está ligada? (o job plt-estoque-reposicao existe no pg_cron). Leitura da logística; ligar/desligar é do admin.';

-- ----------------------------------------------------------------------------
-- 17 · Saem as portas da capacidade e do "usar todas" (↩️ D-72). A coluna
--      capacidade_pecas FICA (pedido do dono: nada de apagar dado).
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_estoque_aplicar_sugestoes(integer);
drop function if exists public.plt_fn_estoque_definir_capacidade(integer);

-- ----------------------------------------------------------------------------
-- 18 · Agendamentos (só onde existe pg_cron — produção):
--      · vencimento de reposição: de hora em hora (independente do liga/desliga
--        — a reposição manual também vence);
--      · recálculo do mínimo automático: 1×/dia às 04:40 de Fortaleza (07:40 UTC);
--      · garantia de entrega DESLIGADA: o job da reposição automática não
--        existe (se alguém o criou por fora, sai daqui).
-- ----------------------------------------------------------------------------
do $$
declare
  v_job bigint;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if not exists (select 1 from cron.job where jobname = 'plt-estoque-vencimentos') then
      perform cron.schedule('plt-estoque-vencimentos', '10 * * * *',
        'select plt_privado.fn_vencer_reposicoes()');
    end if;
    if not exists (select 1 from cron.job where jobname = 'plt-estoque-minimos') then
      perform cron.schedule('plt-estoque-minimos', '40 7 * * *',
        'select plt_privado.fn_recalcular_minimos()');
    end if;
    select jobid into v_job from cron.job where jobname = 'plt-estoque-reposicao';
    if v_job is not null then
      perform cron.unschedule(v_job);
    end if;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 19 · O primeiro recálculo: os mínimos do Top X entram no automático já
--      (quem foi definido antes desta migration NÃO está travado — o dono
--      decidiu que o padrão é acompanhar a sugestão; editar de novo trava).
-- ----------------------------------------------------------------------------
do $$
begin
  perform plt_privado.fn_recalcular_minimos();
end;
$$;

-- ----------------------------------------------------------------------------
-- 20 · Permissões: maquinaria fora da API (E-11); portas das pessoas para
--      authenticated com gate por dentro (revoga public e anon).
-- ----------------------------------------------------------------------------
revoke all on function plt_privado.fn_estoque_top_x()                       from public, anon, authenticated;
revoke all on function plt_privado.fn_estoque_cobertura()                   from public, anon, authenticated;
revoke all on function plt_privado.fn_estoque_corte()                       from public, anon, authenticated;
revoke all on function plt_privado.fn_dias_uteis_venda_90d()                from public, anon, authenticated;
revoke all on function plt_privado.fn_reposicao_vence_em(timestamptz)       from public, anon, authenticated;
revoke all on function plt_privado.fn_estoque_cortes_90d()                  from public, anon, authenticated;
revoke all on function plt_privado.fn_minimo_efetivo(bigint)                from public, anon, authenticated;
revoke all on function plt_privado.fn_recalcular_minimos()                  from public, anon, authenticated;
revoke all on function plt_privado.fn_reservados_producao()                 from public, anon, authenticated;
revoke all on function plt_privado.fn_vencer_reposicoes()                   from public, anon, authenticated;

revoke all on function public.plt_fn_estoque_produtos(text, text, text, integer, integer) from public, anon;
revoke all on function public.plt_fn_estoque_configuracoes(text, integer, integer)        from public, anon;
revoke all on function public.plt_fn_estoque_resumo()                                     from public, anon;
revoke all on function public.plt_fn_estoque_config()                                     from public, anon;
revoke all on function public.plt_fn_estoque_definir_top_x(integer)                       from public, anon;
revoke all on function public.plt_fn_estoque_definir_cobertura(integer)                   from public, anon;
revoke all on function public.plt_fn_estoque_definir_corte(integer)                       from public, anon;
revoke all on function public.plt_fn_estoque_definir_minimo(bigint, numeric)              from public, anon;
revoke all on function public.plt_fn_estoque_minimo_automatico(bigint)                    from public, anon;
revoke all on function public.plt_fn_estoque_lancar_reposicao(bigint, integer)            from public, anon;
revoke all on function public.plt_fn_estoque_reposicao_ligar()                            from public, anon;
revoke all on function public.plt_fn_estoque_reposicao_desligar()                         from public, anon;
revoke all on function public.plt_fn_estoque_reposicao_situacao()                         from public, anon;

grant execute on function public.plt_fn_estoque_produtos(text, text, text, integer, integer) to authenticated;
grant execute on function public.plt_fn_estoque_configuracoes(text, integer, integer)        to authenticated;
grant execute on function public.plt_fn_estoque_resumo()                                     to authenticated;
grant execute on function public.plt_fn_estoque_config()                                     to authenticated;
grant execute on function public.plt_fn_estoque_definir_top_x(integer)                       to authenticated;
grant execute on function public.plt_fn_estoque_definir_cobertura(integer)                   to authenticated;
grant execute on function public.plt_fn_estoque_definir_corte(integer)                       to authenticated;
grant execute on function public.plt_fn_estoque_definir_minimo(bigint, numeric)              to authenticated;
grant execute on function public.plt_fn_estoque_minimo_automatico(bigint)                    to authenticated;
grant execute on function public.plt_fn_estoque_lancar_reposicao(bigint, integer)            to authenticated;
grant execute on function public.plt_fn_estoque_reposicao_ligar()                            to authenticated;
grant execute on function public.plt_fn_estoque_reposicao_desligar()                         to authenticated;
grant execute on function public.plt_fn_estoque_reposicao_situacao()                         to authenticated;
