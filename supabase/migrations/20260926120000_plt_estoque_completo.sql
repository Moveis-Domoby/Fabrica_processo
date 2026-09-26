-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 36 — O ESTOQUE COMPLETO
-- Sessão: SESSAO-25 · Data: 2026-09-26
-- Decisões: D-53 (ordem) + as respostas do dono em 26/09 (D-54…D-57)
--
-- O estoque inteiro da fábrica dentro da plataforma — SEM tabela nova:
--
--   1. SALDO DO TINY = LEITURA DERIVADA do último aviso de cada produto em
--      `eventos` (tipo 'estoque_fabrica' — o webhook de lançamentos de estoque
--      ou a carga inicial, mesmo formato). Nada guardado, nenhuma coluna nem
--      gatilho em tabela da integração (D-19, regra do banco enxuto). O aviso
--      manda o SALDO RESULTANTE; o valor cru fica no evento (RNF-05).
--
--   2. DISPONÍVEL = saldo lido − RESERVAS ABERTAS: itens de pedidos da loja
--      ainda não faturados (em aberto / aprovado / preparando envio), casados
--      por SKU — o id do produto NUNCA casa entre a conta da loja e a da
--      fábrica (0 de 8.043 itens, conferido em 24/09) —, fora personalizado e
--      cancelado. É a mesma conta do "disponível" do Tiny (o pedido da loja
--      reserva o estoque da fábrica — resposta 3 do dono), feita com os
--      pedidos que já chegam ao banco: o Tiny NÃO avisa quando sai pedido
--      (46 pedidos, 0 avisos — a reserva não é lançamento). Negativo vira
--      "necessidade extrema de produção"; na tela, 0 (D-53).
--
--   3. RESERVADO = peça pronta COM pedido no ESTOQUE (etiqueta SKU + pedido);
--      LIVRE = peça pronta SEM pedido (veio da reposição). Nunca se somam
--      com o Tiny (resposta 2).
--
--   4. CARD DE REPOSIÇÃO (tipo novo 'reposicao'): o estoque gera no PCP quando
--      o disponível fica abaixo do mínimo do Tiny (resposta 7). Nasce pela
--      maquinaria (origem 'automacao'); o PCP decide o rumo — libera as
--      unidades para a produção (elas nascem SEM pedido) ou arquiva. Pronta,
--      a peça fica LIVRE no ESTOQUE aguardando a venda. Um ciclo vivo por
--      produto; depois de um ciclo, só gera outro com leitura NOVA do Tiny
--      daquele produto (a peça pronta precisa entrar no Tiny primeiro).
--      O agendamento NÃO nasce aqui: liga-se à parte, depois da carga
--      conferida (supabase/manutencao/2026-09-26_ligar_reposicao_automatica.sql).
--
--   5. O ESTOQUE só recebe peça 🟢 (resposta 7: "não ficará mais nenhum
--      produto danificado nem em atenção") — regra no banco (M-14).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0 · Pré-requisito: o catálogo e o payload do Tiny da fábrica (migration 23
--     da integração, aplicada em 21/09; espelhada no supabase-fabrica-schema.sql)
-- ----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.produtos') is null then
    raise exception 'A migration 36 precisa da tabela public.produtos (migration 23 da integração).';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'eventos'
                    and column_name = 'payload') then
    raise exception 'A migration 36 precisa da coluna public.eventos.payload (migration 23 da integração).';
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 1 · O card aprende o que é reposição: pedido opcional, produto do catálogo
-- ----------------------------------------------------------------------------
-- Pedido deixa de ser obrigatório: o card de REPOSIÇÃO e as unidades dele não
-- têm pedido do Tiny. Card de pedido continua exigindo (check abaixo).
alter table public.plt_cards alter column pedido_id drop not null;

-- O produto do catálogo da fábrica (produtos.tiny_id). É a chave da reposição
-- e das peças livres; as unidades de pedido seguem com o snapshot do SKU.
alter table public.plt_cards add column if not exists produto_tiny_id bigint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'plt_cards_produto_fk') then
    alter table public.plt_cards
      add constraint plt_cards_produto_fk
      foreign key (produto_tiny_id) references public.produtos (tiny_id);
  end if;
end;
$$;

create index if not exists plt_cards_produto_idx
  on public.plt_cards (produto_tiny_id) where produto_tiny_id is not null;

comment on column public.plt_cards.produto_tiny_id is
  'SESSAO-25: produto do catálogo da fábrica (produtos.tiny_id) — card de REPOSIÇÃO e as unidades dele. Unidade de pedido usa o snapshot do SKU (o id da loja não casa com o da fábrica).';
comment on column public.plt_cards.pedido_id is
  'Pedido do Tiny (D-08). NULO só no card de REPOSIÇÃO de estoque e nas unidades dele (SESSAO-25).';

-- O tipo ganha 'reposicao'. O check nasceu inline na migration 03 (nome
-- automático) — acha pelo conteúdo, não pelo nome.
do $$
declare
  v_nome text;
begin
  for v_nome in
    select conname from pg_constraint
     where conrelid = 'public.plt_cards'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%tipo%'
       and pg_get_constraintdef(oid) ilike '%''unidade''%'
       and pg_get_constraintdef(oid) not ilike '%indice_unidade%'
  loop
    execute format('alter table public.plt_cards drop constraint %I', v_nome);
  end loop;
  alter table public.plt_cards add constraint plt_cards_tipo_check
    check (tipo in ('pedido', 'unidade', 'reposicao'));
end;
$$;

-- Coerência por tipo (a da migration 03, acrescida da reposição):
--   unidade   → (k/n) e um dono: pedido OU produto da reposição;
--   pedido    → sem (k/n), com pedido;
--   reposicao → sem k, n = quantidade a repor, sem pedido, com produto.
alter table public.plt_cards drop constraint if exists plt_cards_unidade_coerente;
alter table public.plt_cards add constraint plt_cards_unidade_coerente check (
  (tipo = 'unidade' and indice_unidade is not null and total_unidades is not null
     and (pedido_id is not null or produto_tiny_id is not null))
  or (tipo = 'pedido' and indice_unidade is null and total_unidades is null
     and pedido_id is not null)
  or (tipo = 'reposicao' and indice_unidade is null and total_unidades >= 1
     and pedido_id is null and produto_tiny_id is not null)
);

-- Um card de reposição ABERTO no PCP por produto — a maquinaria nunca duplica.
create unique index if not exists plt_cards_reposicao_aberta_uq
  on public.plt_cards (produto_tiny_id)
  where tipo = 'reposicao' and arquivado_em is null and liberado_completo_em is null;

-- A unidade da reposição existe uma vez por (card de reposição, k) — o índice
-- das unidades de pedido (pedido_id, item_seq, k) não vale com pedido nulo.
create unique index if not exists plt_cards_unidade_reposicao_uq
  on public.plt_cards (card_pai_id, indice_unidade)
  where tipo = 'unidade' and pedido_id is null;

-- ----------------------------------------------------------------------------
-- 2 · As regras do estoque, cada uma num lugar só (lição E-25)
-- ----------------------------------------------------------------------------

-- Personalizado: a loja reusa o SKU com outras medidas (327 = armário 2 portas
-- na fábrica; "PERSONALIZADO 1 porta" na loja) — não é o produto do catálogo.
-- Grafias reais no histórico (26/09): PERSONALIZADO, PERSONALIZADA,
-- PERSONALZADO, PERSONLAIZADO, PERSONALIZADP, PERSONALIZADOESTANTE.
create or replace function plt_privado.fn_eh_personalizado(p_descricao text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(p_descricao, '') ~* 'person[a-z]{0,6}z';
$$;

comment on function plt_privado.fn_eh_personalizado(text) is
  'SESSAO-25: item personalizado (SKU reusado com outras medidas) — não é o produto do catálogo, não reserva nem desconta o estoque dele. Regra ÚNICA; cobre as grafias do histórico.';

-- A situação do pedido que ainda SEGURA estoque no Tiny: antes do faturamento.
-- Faturou (a nota lança a saída) ou encerrou → sai da reserva.
create or replace function plt_privado.fn_situacao_reserva_estoque(p_situacao text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select plt_privado.fn_situacao_normalizada(p_situacao)
         in ('em_aberto', 'aberto', 'aprovado', 'preparando_envio');
$$;

comment on function plt_privado.fn_situacao_reserva_estoque(text) is
  'SESSAO-25: pedido da loja em aberto/aprovado/preparando envio ainda reserva o estoque no Tiny (resposta 3 do dono). A lista mora SÓ aqui — conferida contra o saldoReservado da carga inicial.';

-- O último aviso de cada produto: webhook de lançamentos de estoque OU carga
-- inicial (mesmo formato). Webhook de conta não é assinado → confere o CNPJ.
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
  select distinct on (x.tiny_id)
         x.tiny_id, x.saldo, x.reservado_tiny, x.lido_em, x.origem, x.evento_id
    from (
      select case when (e.payload -> 'dados' ->> 'idProduto') ~ '^[0-9]+$'
                  then (e.payload -> 'dados' ->> 'idProduto')::bigint end            as tiny_id,
             case when replace(e.payload -> 'dados' ->> 'saldo', ',', '.') ~ '^-?[0-9]+(\.[0-9]+)?$'
                  then replace(e.payload -> 'dados' ->> 'saldo', ',', '.')::numeric end as saldo,
             case when replace(e.payload -> 'dados' ->> 'saldoReservado', ',', '.') ~ '^-?[0-9]+(\.[0-9]+)?$'
                  then replace(e.payload -> 'dados' ->> 'saldoReservado', ',', '.')::numeric end as reservado_tiny,
             e.recebido_em                                                          as lido_em,
             coalesce(nullif(e.payload ->> 'origem', ''), 'webhook')                as origem,
             e.id                                                                   as evento_id
        from public.eventos e
       where e.tipo = 'estoque_fabrica'
         and e.payload ->> 'cnpj' = '27556613000166'
         and e.payload ->> 'tipo' = 'estoque'
    ) x
   where x.tiny_id is not null and x.saldo is not null
   order by x.tiny_id, x.lido_em desc, x.evento_id desc;
$$;

comment on function plt_privado.fn_leituras_tiny() is
  'SESSAO-25: o saldo do Tiny da fábrica é LEITURA DERIVADA — o último aviso estoque_fabrica de cada produto (webhook ou carga inicial), CNPJ conferido. Nada guardado (M-02/M-13).';

-- O retrato do estoque por produto — a base ÚNICA das telas e da reposição.
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
    select ps.tiny_id, count(*)::int as quantidade
      from public.plt_cards c
      join por_sku ps on ps.codigo = c.item_codigo
     where c.tipo = 'unidade' and c.pedido_id is not null and c.arquivado_em is null
       and c.setor_atual_id in (select id from estoque)
       and not plt_privado.fn_eh_personalizado(c.item_descricao)
     group by ps.tiny_id
  ),
  livres as (
    select c.produto_tiny_id as tiny_id, count(*)::int as quantidade
      from public.plt_cards c
     where c.tipo = 'unidade' and c.pedido_id is null and c.arquivado_em is null
       and c.produto_tiny_id is not null
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
         pr.estoque_minimo                                      as minimo,
         l.saldo                                                as saldo_tiny,
         l.reservado_tiny,
         l.lido_em,
         l.origem                                               as origem_leitura,
         l.evento_id                                            as evento_leitura_id,
         coalesce(r.quantidade, 0)                              as reservas_loja,
         -- Pode ficar negativo: é a "necessidade extrema" (resposta 3 do dono).
         -- A TELA nunca mostra estoque negativo (D-53) — quem corta é a porta.
         case when l.saldo is not null
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
  'SESSAO-25: retrato do estoque por produto do catálogo — saldo lido do Tiny (cru), reservas abertas da loja, disponível = saldo − reservas (negativo = necessidade extrema; as portas mostram 0 — D-53), prontos reservados × livres (nunca somados ao Tiny) e a reposição mais recente. Base única das telas e da maquinaria.';

-- ----------------------------------------------------------------------------
-- 3 · Liberação completa da REPOSIÇÃO (a regra da D-48 para o card sem pedido)
-- ----------------------------------------------------------------------------
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
     where e.tipo = 'card_criado';
  else
    v_quando := null;
  end if;

  update public.plt_cards
     set liberado_completo_em = v_quando
   where id = p_card_id and liberado_completo_em is distinct from v_quando;
end;
$$;

comment on function plt_privado.fn_recalcular_liberacao_reposicao(bigint) is
  'SESSAO-25: liberado_completo_em do card de REPOSIÇÃO (todas as N unidades liberadas) — derivado dos eventos, chamado pela projeção. É o fim do tempo em PCP e o que tira o card do quadro.';

-- ----------------------------------------------------------------------------
-- 4 · Projeção do card (recriada POR INTEIRO a partir da migration 33 — lição
--     E-24: nunca ressuscitar corpo antigo). Novo: unidade da reposição
--     recalcula a liberação do card de reposição.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_projetar_posicao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_terminal boolean;
  v_tipo_card text;
  v_pedido_id bigint;
  v_pai_id    bigint;
begin
  if new.tipo in ('card_criado', 'movimentacao_setor', 'movimentacao_etapa') then
    select s.papel_no_fluxo = 'terminal'
      into v_terminal
      from public.plt_setores s
     where s.id = coalesce(new.setor_destino_id,
                           (select c.setor_atual_id from public.plt_cards c where c.id = new.card_id));

    update public.plt_cards
       set setor_atual_id = coalesce(new.setor_destino_id, setor_atual_id),
           etapa_atual_id = new.etapa_destino_id,
           desde          = new.ocorrido_em,
           executor_atual_id = null,
           -- SESSAO-22: mover encerra a execução — e a pausa junto com ela.
           pausado_em     = null,
           responsavel_id = case when new.tipo = 'movimentacao_setor'
                                 then null else responsavel_id end,
           -- SESSAO-23: o afazer era daquele time — o relógio da delegação zera junto.
           delegado_em    = case when new.tipo = 'movimentacao_setor'
                                 then null else delegado_em end,
           -- SESSAO-15: concluído = está num terminal AGORA (D-13); saiu de
           -- lá (danificado resolvido, ajuste manual), volta a "em produção".
           concluido_em   = case when coalesce(v_terminal, false)
                                 then coalesce(concluido_em, new.ocorrido_em)
                                 else null end
     where id = new.card_id;

    -- SESSAO-22 (D-48): unidade nova liberada → o card de pedido pode ter
    -- acabado de completar a liberação.
    if new.tipo = 'card_criado' then
      select c.tipo, c.pedido_id, c.card_pai_id into v_tipo_card, v_pedido_id, v_pai_id
        from public.plt_cards c where c.id = new.card_id;
      if v_tipo_card = 'unidade' and v_pedido_id is not null then
        perform plt_privado.fn_recalcular_liberacao(v_pedido_id);
      elsif v_tipo_card = 'unidade' and v_pai_id is not null then
        -- SESSAO-25: unidade da REPOSIÇÃO — o card de reposição pode ter
        -- acabado de completar a liberação.
        perform plt_privado.fn_recalcular_liberacao_reposicao(v_pai_id);
      end if;
    end if;

  elsif new.tipo = 'execucao_iniciada' then
    -- Iniciar num card já em execução por OUTRA pessoa = transferência (D-24):
    -- fecha para um, abre para o outro — e encerra pausa que houver.
    update public.plt_cards
       set executor_atual_id = new.usuario_id,
           pausado_em = null
     where id = new.card_id;

  elsif new.tipo = 'execucao_finalizada' then
    update public.plt_cards
       set executor_atual_id = null,
           pausado_em = null
     where id = new.card_id;

  elsif new.tipo = 'execucao_pausada' then
    -- SESSAO-22 (D-48): a urgência entra porque o pausado sai do limite.
    update public.plt_cards
       set pausado_em = new.ocorrido_em
     where id = new.card_id;

  elsif new.tipo = 'execucao_retomada' then
    update public.plt_cards
       set pausado_em = null
     where id = new.card_id;

  elsif new.tipo = 'estorno' then
    -- O estado guardado é projeção; o evento é a verdade (M-13). A pausa
    -- pertencia à execução desfeita — zera junto.
    update public.plt_cards
       set executor_atual_id = plt_privado.fn_executor_pelo_log(new.card_id),
           pausado_em = null
     where id = new.card_id;

  elsif new.tipo in ('qualidade_marcada', 'qualidade_parecer') then
    update public.plt_cards
       set qualidade_atual = new.estado_qualidade
     where id = new.card_id;

  elsif new.tipo = 'card_arquivado' then
    update public.plt_cards
       set arquivado_em = new.ocorrido_em,
           executor_atual_id = null,
           pausado_em = null
     where id = new.card_id;

  elsif new.tipo = 'delegacao' then
    -- SESSAO-23: o relógio da fila de prioridade nasce (ou zera) aqui.
    update public.plt_cards
       set responsavel_id = nullif(new.dados ->> 'responsavel_id', '')::uuid,
           delegado_em = case when nullif(new.dados ->> 'responsavel_id', '') is null
                              then null else new.ocorrido_em end
     where id = new.card_id;

  elsif new.tipo = 'pedido_lancado_rotas' then
    -- SESSAO-15 (D-45): o card de pedido passa a existir para as ROTAS.
    update public.plt_cards
       set lancado_rotas_em = new.ocorrido_em
     where id = new.card_id;

  elsif new.tipo = 'pedido_atualizado' then
    -- SESSAO-22 (D-48): o Tiny pode ter mudado os itens — o "completo" muda junto.
    select c.pedido_id into v_pedido_id
      from public.plt_cards c where c.id = new.card_id;
    if v_pedido_id is not null then
      perform plt_privado.fn_recalcular_liberacao(v_pedido_id);
    end if;
  end if;

  return null;
end;
$$;

comment on function plt_privado.fn_projetar_posicao() is
  'Único lugar que escreve a posição do card. Reage a evento inserido; nunca o contrário. Projeta arquivamento (S11), responsável (S12), lançamento para ROTAS (S15), pausa e liberação completa (S22), delegado_em (S23) e a liberação completa da REPOSIÇÃO (S25).';

-- ----------------------------------------------------------------------------
-- 5 · A maquinaria da reposição: abaixo do mínimo → card no PCP
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
       and b.saldo_tiny is not null          -- sem leitura do Tiny não se decide nada
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

    -- Depois de um ciclo (concluído ou arquivado pelo PCP), só gera de novo com
    -- leitura NOVA do Tiny daquele produto: a peça pronta precisa entrar no
    -- Tiny antes — senão o mesmo "abaixo do mínimo" pediria outra reposição.
    select max(greatest(coalesce(rc.arquivado_em, '-infinity'::timestamptz),
                        coalesce(rc.liberado_completo_em, '-infinity'::timestamptz),
                        coalesce((select max(cu.concluido_em) from public.plt_cards cu
                                   where cu.card_pai_id = rc.id and cu.tipo = 'unidade'),
                                 '-infinity'::timestamptz)))
      into v_fim
      from public.plt_cards rc
     where rc.tipo = 'reposicao' and rc.produto_tiny_id = r.tiny_id;
    if v_fim is not null and r.lido_em <= v_fim then
      continue;
    end if;

    -- Repor até o mínimo. O que passou do zero (vendido sem estoque) NÃO entra:
    -- aqueles pedidos já têm card próprio no PCP — entraria em dobro.
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
                'saldo_tiny',          r.saldo_tiny,
                'reservas_loja',       r.reservas_loja,
                'disponivel',          r.disponivel,
                'necessidade_extrema', greatest(-r.disponivel, 0),
                'quantidade',          v_qtd,
                'leitura_evento_id',   r.evento_leitura_id,
                'leitura_em',          r.lido_em));
    v_gerados := v_gerados + 1;
  end loop;

  return v_gerados;
end;
$$;

comment on function plt_privado.fn_gerar_reposicoes() is
  'SESSAO-25 (resposta 7 do dono): produto do catálogo (F/S/variação) com disponível abaixo do mínimo do Tiny ganha um card de REPOSIÇÃO no PCP (origem automacao). Um ciclo vivo por produto; ciclo encerrado só reabre com leitura nova do Tiny. Quantidade = mínimo − disponível (piso 0). Idempotente. Agendada à parte, depois da carga conferida.';

-- ----------------------------------------------------------------------------
-- 6 · O ESTOQUE só recebe peça 🟢 (resposta 7) — BEFORE, vale para todo
--     escritor humano (M-14). API segue sem qualidade (RF-86).
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_validar_chegada_estoque()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_estoque bigint;
  v_estado  text;
begin
  if new.tipo <> 'movimentacao_setor' or new.origem <> 'interface' then
    return new;
  end if;
  select s.id into v_estoque from public.plt_setores s where s.codigo = 'estoque';
  if v_estoque is null or new.setor_destino_id is distinct from v_estoque then
    return new;
  end if;

  -- A marcação da própria transição manda; sem ela (saída de PCP/terminal),
  -- vale o último estado conhecido da peça.
  if new.evento_referencia_id is not null then
    select e.estado_qualidade into v_estado
      from public.plt_eventos e
     where e.id = new.evento_referencia_id and e.tipo = 'qualidade_marcada';
  end if;
  if v_estado is null then
    select c.qualidade_atual into v_estado from public.plt_cards c where c.id = new.card_id;
  end if;

  if v_estado in ('atencao', 'danificado') then
    raise exception 'O ESTOQUE só recebe peça em perfeito estado. Peça em atenção ou danificada vai para o DANIFICADO do setor.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

comment on function plt_privado.fn_validar_chegada_estoque() is
  'SESSAO-25 (resposta 7 do dono): chegada HUMANA ao ESTOQUE só com a peça 🟢 — marcação da transição, ou o último estado conhecido quando não há marcação. Recusa com a saída certa (DANIFICADO do setor).';

drop trigger if exists plt_eventos_validar_chegada_estoque on public.plt_eventos;
create trigger plt_eventos_validar_chegada_estoque
  before insert on public.plt_eventos
  for each row execute function plt_privado.fn_validar_chegada_estoque();

-- ----------------------------------------------------------------------------
-- 7 · Quem pode arquivar: + o card de REPOSIÇÃO pela logística (o PCP decide
--     o rumo — inclusive não produzir). Recriada POR INTEIRO a partir da
--     migration 25.
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
        if not ((coalesce(v_danificado, false) or coalesce(v_reposicao, false))
                and plt_privado.fn_eh_logistica(new.usuario_id)) then
          raise exception 'Arquivar card é gesto de admin ou da integração — a logística arquiva só peças em DANIFICADO e cards de reposição.'
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
-- 8 · Portas de leitura (endpoints de propósito — padrão plt_fn_*, E-11).
--     Gate da logística dentro de cada uma (admin, PCP, terminais).
-- ----------------------------------------------------------------------------

-- 8.1 · A tela por PRODUTO: acabados (F/S/variação) ou matéria-prima e insumos
--       (M/K). Paginada no servidor com o total na mesma consulta (regra 17).
create or replace function public.plt_fn_estoque_produtos(
  p_grupo        text    default 'acabados',  -- 'acabados' | 'insumos'
  p_busca        text    default null,
  p_filtro       text    default null,        -- null | 'abaixo_minimo' | 'extrema' | 'reservados' | 'livres' | 'sem_leitura'
  p_limite       integer default 20,
  p_deslocamento integer default 0
)
returns table (
  tiny_id              bigint,
  codigo               text,
  descricao            text,
  classe               text,
  unidade              text,
  minimo               numeric,
  saldo_tiny           numeric,
  lido_em              timestamptz,
  origem_leitura       text,
  reservas_loja        numeric,
  em_estoque           numeric,
  necessidade_extrema  numeric,
  abaixo_minimo        boolean,
  repor                numeric,
  prontos_reservados   integer,
  prontos_livres       integer,
  reposicao_card_id    bigint,
  reposicao_estado     text,
  reposicao_quantidade integer,
  reposicao_liberadas  integer,
  contagem_total       bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with base as (
    select b.*,
           case when b.disponivel is not null then greatest(b.disponivel, 0) end            as em_estoque_,
           case when b.disponivel is not null then greatest(-b.disponivel, 0) else 0 end    as extrema_,
           (b.disponivel is not null and coalesce(b.minimo, 0) > 0
              and b.disponivel < b.minimo)                                                  as abaixo_
      from plt_privado.fn_estoque_por_produto() b
     where b.situacao = 'A'
       and case coalesce(p_grupo, 'acabados')
             when 'insumos' then b.classe in ('M', 'K')
             else coalesce(b.classe, '') in ('F', 'S', 'V')
           end
  )
  select b.tiny_id,
         b.codigo,
         b.descricao,
         b.classe,
         b.unidade,
         b.minimo,
         b.saldo_tiny,
         b.lido_em,
         b.origem_leitura,
         b.reservas_loja,
         b.em_estoque_                                                        as em_estoque,
         b.extrema_                                                           as necessidade_extrema,
         b.abaixo_                                                            as abaixo_minimo,
         case when b.abaixo_ then b.minimo - b.em_estoque_ else 0 end         as repor,
         b.prontos_reservados,
         b.prontos_livres,
         b.reposicao_card_id,
         b.reposicao_estado,
         b.reposicao_quantidade,
         b.reposicao_liberadas,
         count(*) over ()                                                     as contagem_total
    from base b
   where plt_privado.fn_pode_ver_expedicao()
     and (p_busca is null or btrim(p_busca) = ''
          or b.descricao ilike '%' || btrim(p_busca) || '%'
          or b.codigo ilike btrim(p_busca) || '%')
     and case coalesce(p_filtro, '')
           when 'abaixo_minimo' then b.abaixo_
           when 'extrema'       then b.extrema_ > 0
           when 'reservados'    then b.prontos_reservados > 0
           when 'livres'        then b.prontos_livres > 0
           when 'sem_leitura'   then b.saldo_tiny is null
           else true
         end
   order by (b.extrema_ > 0) desc,
            b.abaixo_ desc,
            (b.prontos_reservados + b.prontos_livres > 0) desc,
            b.descricao, b.tiny_id
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_estoque_produtos(text, text, text, integer, integer) is
  'SESSAO-25: a tela de Estoque por PRODUTO (acabados F/S/variação ou matéria-prima/insumos M/K): saldo do Tiny, reservas da loja, em estoque (nunca negativo), necessidade extrema, abaixo do mínimo e quanto repor, prontos reservados × livres e a reposição. Paginada no servidor (regra 17). Gate da logística.';

-- 8.2 · As PEÇAS paradas no ESTOQUE: reservadas (com pedido — etiquetas SKU +
--       pedido) e livres (sem pedido — vieram da reposição). Evolui a porta da
--       SESSAO-15 (E-22: nada de leitura paralela); assinatura nova (A-12).
drop function if exists public.plt_fn_estoque(text, integer, integer);

create or replace function public.plt_fn_estoque(
  p_busca           text    default null,
  p_limite          integer default 20,
  p_deslocamento    integer default 0,
  p_produto_tiny_id bigint  default null,
  p_dono            text    default null   -- null | 'pedido' | 'livre'
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
  with estoque as (
    select s.id from public.plt_setores s where s.codigo = 'estoque'
  ),
  alvo as (
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
         case when c.pedido_id is null then c.card_pai_id end          as reposicao_card_id,
         case when c.pedido_id is null then 'reposicao' else 'pedido' end as origem,
         c.id_producao,
         c.qualidade_atual,
         c.desde,
         count(*) over ()                                              as contagem_total
    from public.plt_cards c
    left join public.pedidos p on p.id = c.pedido_id
   where plt_privado.fn_pode_ver_expedicao()
     and c.tipo = 'unidade'
     and c.arquivado_em is null
     and c.setor_atual_id in (select id from estoque)
     and (p_dono is null
          or (p_dono = 'livre'  and c.pedido_id is null)
          or (p_dono = 'pedido' and c.pedido_id is not null))
     and (p_produto_tiny_id is null
          or c.produto_tiny_id = p_produto_tiny_id
          or (c.pedido_id is not null
              and c.item_codigo = (select a.codigo from alvo a)
              and not plt_privado.fn_eh_personalizado(c.item_descricao)))
     and (p_busca is null or btrim(p_busca) = ''
          or c.id_producao ilike '%' || btrim(p_busca) || '%'
          or c.item_descricao ilike '%' || btrim(p_busca) || '%'
          or c.item_codigo ilike btrim(p_busca) || '%'
          or p.numero::text like btrim(p_busca) || '%')
   order by c.desde asc nulls last, c.id
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_estoque(text, integer, integer, bigint, text) is
  'Peças paradas no ESTOQUE (SESSAO-15, evoluída na SESSAO-25): reservadas (com pedido — SKU + nº do pedido) e livres (sem pedido, da reposição), filtráveis por produto e dono. Gate da logística. Endpoint de propósito.';

-- 8.3 · Sugestão de mínimo: os 20 mais vendidos dos últimos 90 dias, com rank
--       (resposta do dono). Sugestão = média semanal × semanas de cobertura
--       escolhidas na tela — cresce com a venda: o 1º nunca fica abaixo do 20º.
create or replace function public.plt_fn_estoque_sugestao_minimo(
  p_semanas integer default 2
)
returns table (
  posicao        integer,
  tiny_id        bigint,
  codigo         text,
  descricao      text,
  vendidos_90d   numeric,
  media_semana   numeric,
  minimo_atual   numeric,
  sugestao       integer,
  em_estoque     numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with por_sku as (
    select distinct on (pr.codigo) pr.codigo, pr.tiny_id, pr.descricao, pr.estoque_minimo
      from public.produtos pr
     where pr.codigo is not null and pr.situacao = 'A'
       and coalesce(pr.classe, '') in ('F', 'S', 'V')
     order by pr.codigo, pr.tiny_id
  ),
  vendas as (
    select ps.tiny_id, ps.codigo, ps.descricao, ps.estoque_minimo,
           sum(pi.quantidade) as vendidos
      from public.pedidos p
      join public.pedido_itens pi on pi.pedido_id = p.id
      join por_sku ps on ps.codigo = pi.codigo
     where p.data_pedido >= (now() at time zone 'America/Fortaleza')::date - 90
       and plt_privado.fn_situacao_normalizada(p.situacao) <> 'cancelado'
       and not plt_privado.fn_eh_personalizado(pi.descricao)
     group by ps.tiny_id, ps.codigo, ps.descricao, ps.estoque_minimo
  ),
  top as (
    select v.*, row_number() over (order by v.vendidos desc, v.codigo)::int as posicao
      from vendas v
  )
  select t.posicao,
         t.tiny_id,
         t.codigo,
         t.descricao,
         t.vendidos                                                        as vendidos_90d,
         round(t.vendidos / (90 / 7.0), 1)                                 as media_semana,
         t.estoque_minimo                                                  as minimo_atual,
         greatest(ceil(t.vendidos / (90 / 7.0)
                       * least(greatest(coalesce(p_semanas, 2), 1), 8))::integer, 1) as sugestao,
         case when b.disponivel is not null then greatest(b.disponivel, 0) end as em_estoque
    from top t
    left join plt_privado.fn_estoque_por_produto() b on b.tiny_id = t.tiny_id
   where plt_privado.fn_pode_ver_expedicao()
     and t.posicao <= 20
   order by t.posicao;
$$;

comment on function public.plt_fn_estoque_sugestao_minimo(integer) is
  'SESSAO-25: sugestão de estoque mínimo para os 20 mais vendidos dos últimos 90 dias (sem personalizado, sem cancelado), com rank: média semanal × semanas de cobertura (1–8, escolha na tela). O dono ajusta o mínimo no Tiny. Gate da logística.';

-- 8.4 · Os cards de reposição do quadro do PCP: produto, quantidade, quanto já
--       foi liberado e a foto do estoque (na criação e agora).
create or replace function public.plt_fn_reposicoes_resumo(p_card_ids bigint[])
returns table (
  card_id               bigint,
  produto_tiny_id       bigint,
  codigo                text,
  descricao             text,
  quantidade            integer,
  liberadas             integer,
  concluidas            integer,
  minimo                numeric,
  disponivel_na_criacao numeric,
  extrema_na_criacao    numeric,
  em_estoque_agora      numeric,
  extrema_agora         numeric,
  criado_em             timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select rc.id,
         rc.produto_tiny_id,
         rc.item_codigo,
         rc.item_descricao,
         rc.total_unidades,
         coalesce(u.liberadas, 0),
         coalesce(u.concluidas, 0),
         b.minimo,
         nullif(ev.dados ->> 'disponivel', '')::numeric,
         coalesce(nullif(ev.dados ->> 'necessidade_extrema', '')::numeric, 0),
         case when b.disponivel is not null then greatest(b.disponivel, 0) end,
         case when b.disponivel is not null then greatest(-b.disponivel, 0) else 0 end,
         ev.ocorrido_em
    from public.plt_cards rc
    left join lateral (
      select count(*)::int as liberadas,
             count(*) filter (where cu.concluido_em is not null)::int as concluidas
        from public.plt_cards cu
       where cu.card_pai_id = rc.id and cu.tipo = 'unidade'
    ) u on true
    left join lateral (
      select e.dados, e.ocorrido_em from public.plt_eventos e
       where e.card_id = rc.id and e.tipo = 'card_criado'
       order by e.id limit 1
    ) ev on true
    left join plt_privado.fn_estoque_por_produto() b on b.tiny_id = rc.produto_tiny_id
   where plt_privado.fn_pode_ver_expedicao()
     and rc.tipo = 'reposicao'
     and rc.id = any (p_card_ids);
$$;

comment on function public.plt_fn_reposicoes_resumo(bigint[]) is
  'SESSAO-25: resumo dos cards de REPOSIÇÃO visíveis (produto, quantidade, liberadas, concluídas, mínimo, disponível na criação e agora, necessidade extrema). Gate da logística.';

-- 8.5 · As unidades já liberadas de um card de reposição (o "já liberada" do
--       modal de liberação; a unidade que foi para outro setor o RLS esconde).
create or replace function public.plt_fn_reposicao_unidades(p_card_id bigint)
returns table (
  card_id         bigint,
  item_seq        integer,
  indice_unidade  integer,
  total_unidades  integer,
  setor_nome      text,
  setor_terminal  boolean,
  concluido_em    timestamptz,
  qualidade_atual text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select cu.id, cu.item_seq, cu.indice_unidade, cu.total_unidades,
         s.nome, (s.papel_no_fluxo = 'terminal'), cu.concluido_em, cu.qualidade_atual
    from public.plt_cards cu
    left join public.plt_setores s on s.id = cu.setor_atual_id
   where plt_privado.fn_pode_ver_expedicao()
     and cu.card_pai_id = p_card_id
     and cu.tipo = 'unidade'
     and cu.pedido_id is null
   order by cu.indice_unidade;
$$;

comment on function public.plt_fn_reposicao_unidades(bigint) is
  'SESSAO-25: unidades de um card de REPOSIÇÃO (onde está cada uma). Gate da logística.';

-- 8.6 · O quadro do PCP passa a trazer também os cards de REPOSIÇÃO (mesma
--       forma de retorno da migration 35 — só o corpo muda).
create or replace function public.plt_fn_cards_pedido_pcp(
  p_limite       integer default 10,
  p_deslocamento integer default 0
)
returns table (
  id bigint,
  tipo text,
  pedido_id bigint,
  card_pai_id bigint,
  item_seq integer,
  item_codigo text,
  item_descricao text,
  indice_unidade integer,
  total_unidades integer,
  setor_atual_id bigint,
  etapa_atual_id bigint,
  desde timestamptz,
  executor_atual_id uuid,
  responsavel_id uuid,
  delegado_em timestamptz,
  qualidade_atual text,
  concluido_em timestamptz,
  pausado_em timestamptz,
  liberado_completo_em timestamptz,
  contagem_total bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id, c.tipo, c.pedido_id, c.card_pai_id, c.item_seq, c.item_codigo,
         c.item_descricao, c.indice_unidade, c.total_unidades, c.setor_atual_id,
         c.etapa_atual_id, c.desde, c.executor_atual_id, c.responsavel_id,
         c.delegado_em, c.qualidade_atual, c.concluido_em, c.pausado_em,
         c.liberado_completo_em,
         count(*) over ()::bigint as contagem_total
    from public.plt_cards c
    join public.plt_setores s on s.id = c.setor_atual_id and s.papel_no_fluxo = 'entrada'
    left join public.pedidos p on p.id = c.pedido_id
   where plt_privado.fn_usuario_atual() is not null
     and (
       plt_privado.fn_eh_admin()
       or c.setor_atual_id in (select plt_privado.fn_setores_do_usuario())
     )
     and c.tipo in ('pedido', 'reposicao')
     and c.arquivado_em is null
     and c.liberado_completo_em is null
     -- Pedido encerrado no Tiny sai do quadro; cancelado fica (aba própria — S24).
     -- A reposição não tem pedido: fica até ser liberada por inteiro ou arquivada.
     and (c.tipo = 'reposicao'
          or (p.id is not null
              and plt_privado.fn_situacao_normalizada(p.situacao) not in ('entregue', 'nao_entregue')))
   order by c.desde asc nulls last, c.id
   limit least(greatest(coalesce(p_limite, 10), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_cards_pedido_pcp(integer, integer) is
  'O quadro do PCP (SESSAO-23, + SESSAO-25): pedidos abertos e não encerrados no Tiny E os cards de REPOSIÇÃO de estoque ainda não liberados por inteiro, paginados com o total na mesma consulta (regra 17). Gate: admin ou gente do setor de entrada.';

-- 8.7 · Danificados: peça da REPOSIÇÃO também quebra — o pedido vira opcional
--       (mesma forma de retorno da migration 25; só a junção muda).
create or replace function public.plt_fn_danificados(
  p_arquivados   boolean default false,
  p_busca        text    default null,
  p_limite       integer default 20,
  p_deslocamento integer default 0
)
returns table (
  card_id           bigint,
  pedido_id         bigint,
  numero            integer,
  item_codigo       text,
  item_descricao    text,
  indice_unidade    integer,
  total_unidades    integer,
  setor_id          bigint,
  setor_nome        text,
  etapa_nome        text,
  qualidade_atual   text,
  desde             timestamptz,
  arquivado_em      timestamptz,
  origem_setor_nome text,
  marcacao_estado   text,
  marcacao_por      text,
  marcacao_obs      text,
  marcado_em        timestamptz,
  parecer_estado    text,
  parecer_por       text,
  parecer_obs       text,
  contagem_total    bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id                 as card_id,
         c.pedido_id,
         p.numero,
         c.item_codigo,
         c.item_descricao,
         c.indice_unidade,
         c.total_unidades,
         s.id                 as setor_id,
         s.nome               as setor_nome,
         e.nome               as etapa_nome,
         c.qualidade_atual,
         c.desde,
         c.arquivado_em,
         so.nome              as origem_setor_nome,
         m.estado_qualidade   as marcacao_estado,
         um.nome              as marcacao_por,
         m.observacao         as marcacao_obs,
         m.ocorrido_em        as marcado_em,
         pr.estado_qualidade  as parecer_estado,
         up.nome              as parecer_por,
         pr.observacao        as parecer_obs,
         count(*) over ()     as contagem_total
    from public.plt_cards c
    join public.plt_etapas  e on e.id = c.etapa_atual_id and e.eh_danificado
    join public.plt_setores s on s.id = c.setor_atual_id
    left join public.pedidos p on p.id = c.pedido_id
    -- o relato da D-09: a última marcação de quem entregou…
    left join lateral (
      select ev.* from public.plt_eventos ev
       where ev.card_id = c.id and ev.tipo = 'qualidade_marcada'
       order by ev.ocorrido_em desc, ev.id desc limit 1
    ) m on true
    left join public.plt_setores  so on so.id = m.setor_origem_id
    left join public.plt_usuarios um on um.id = m.usuario_id
    -- …e o parecer de quem recebeu, quando houve
    left join lateral (
      select ev.* from public.plt_eventos ev
       where ev.tipo = 'qualidade_parecer' and ev.evento_referencia_id = m.id
       order by ev.id desc limit 1
    ) pr on true
    left join public.plt_usuarios up on up.id = pr.usuario_id
   where plt_privado.fn_pode_ver_expedicao()
     and c.tipo = 'unidade'
     and ((coalesce(p_arquivados, false) and c.arquivado_em is not null)
          or (not coalesce(p_arquivados, false) and c.arquivado_em is null))
     and (p_busca is null or btrim(p_busca) = ''
          or p.numero::text like btrim(p_busca) || '%'
          or c.item_descricao ilike '%' || btrim(p_busca) || '%'
          or s.nome ilike '%' || btrim(p_busca) || '%')
   order by case when coalesce(p_arquivados, false) then c.arquivado_em end desc nulls last,
            c.desde asc nulls last, c.id
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

-- ----------------------------------------------------------------------------
-- 9 · Permissões: maquinaria fora da API (E-11); portas para authenticated
-- ----------------------------------------------------------------------------
revoke all on function plt_privado.fn_eh_personalizado(text)                from public, anon, authenticated;
revoke all on function plt_privado.fn_situacao_reserva_estoque(text)        from public, anon, authenticated;
revoke all on function plt_privado.fn_leituras_tiny()                       from public, anon, authenticated;
revoke all on function plt_privado.fn_estoque_por_produto()                 from public, anon, authenticated;
revoke all on function plt_privado.fn_recalcular_liberacao_reposicao(bigint) from public, anon, authenticated;
revoke all on function plt_privado.fn_gerar_reposicoes()                    from public, anon, authenticated;
revoke all on function plt_privado.fn_validar_chegada_estoque()             from public, anon, authenticated;

revoke all on function public.plt_fn_estoque_produtos(text, text, text, integer, integer)   from public, anon;
revoke all on function public.plt_fn_estoque(text, integer, integer, bigint, text)          from public, anon;
revoke all on function public.plt_fn_estoque_sugestao_minimo(integer)                      from public, anon;
revoke all on function public.plt_fn_reposicoes_resumo(bigint[])                           from public, anon;
revoke all on function public.plt_fn_reposicao_unidades(bigint)                            from public, anon;
revoke all on function public.plt_fn_cards_pedido_pcp(integer, integer)                    from public, anon;
revoke all on function public.plt_fn_danificados(boolean, text, integer, integer)          from public, anon;

grant execute on function public.plt_fn_estoque_produtos(text, text, text, integer, integer) to authenticated;
grant execute on function public.plt_fn_estoque(text, integer, integer, bigint, text)        to authenticated;
grant execute on function public.plt_fn_estoque_sugestao_minimo(integer)                    to authenticated;
grant execute on function public.plt_fn_reposicoes_resumo(bigint[])                         to authenticated;
grant execute on function public.plt_fn_reposicao_unidades(bigint)                          to authenticated;
grant execute on function public.plt_fn_cards_pedido_pcp(integer, integer)                  to authenticated;
grant execute on function public.plt_fn_danificados(boolean, text, integer, integer)        to authenticated;
