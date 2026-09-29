-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 41 — O QUADRINHO DO PCP NA VISÃO
-- DO DIA CONTA O QUE O QUADRO DO PCP MOSTRA
-- Ajuste (achado do ajuste do Frete) · Data: 2026-09-28 · Decisão: D-75
--
--   O painel dizia "a liberar" = 233 e o quadro do PCP mostrava 33. Desde a
--   SESSAO-23 (migration 35) o quadro esconde o pedido que o Tiny já encerrou
--   (entregue, não entregue, cancelado); o painel nunca acompanhou — só tirava
--   o cancelado. Em 28/09, 200 dos 233 estavam "Entregue" no Tiny, e os 33
--   restantes eram exatamente os 33 do quadro.
--
--   Respostas do dono (28/09):
--     1. "a liberar" conta o que o quadro do PCP mostra → "Sim, igual ao quadro";
--     2. a "mais antiga" do mesmo quadrinho também (olhava inclusive pedido
--        entregue no Tiny e pedido já liberado por inteiro: 31 dias × 27 do
--        quadro). "Liberadas hoje" NÃO foi escolhida: fica como está;
--     3. os cards de REPOSIÇÃO entram no "a liberar", como o quadro já mostra
--        → "Sim, conta junto".
--
-- Recriada a partir da versão mais nova (E-24): a da migration 39 (seção 11 —
-- frete fora da conta, vw_itens_producao). Troca SÓ o "a liberar" e a "mais
-- antiga", que passam a olhar exatamente o conjunto de plt_fn_cards_pedido_pcp
-- (39, seção 6) — sem o gate por pessoa do quadro (o painel tem o dele,
-- fn_setores_dashboard, intocado). O harness amarra os dois: painel = quadro.
-- A coluna continua `pedidos_a_liberar` (mesma forma de retorno — create or
-- replace basta e o front não muda), agora com os cards de reposição.
--
-- Nada aqui altera as tabelas da integração (clientes, pedidos, pedido_itens,
-- eventos, gp_pcp_processados, produtos).
-- ============================================================================

-- Aplicação curta e sem fila (E-66): se alguma trava não vier em 5 s, a
-- migration desiste inteira (nada muda) em vez de deixar as telas esperando
-- atrás dela. Vale dentro da transação do aplicador; fora de uma (harness), é
-- só um aviso.
set local lock_timeout = '5s';

create or replace function public.plt_fn_dash_pcp_dia(
  p_dia date default null
)
returns table (
  pedidos_a_liberar       integer,
  unidades_liberadas_dia  integer,
  espera_mais_antiga      interval
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with dia as (
    select (coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date)::timestamp
            at time zone 'America/Fortaleza') as ini
  ),
  pcp as (
    select s.id from public.plt_setores s where s.codigo = 'pcp'
  ),
  -- D-75: os cards que o quadro do PCP mostra — o MESMO filtro de
  -- plt_fn_cards_pedido_pcp (39, seção 6), sem o gate por pessoa do quadro
  -- (o do painel fica no fim). Mudou lá, muda aqui: o harness exige
  -- painel = quadro.
  quadro as (
    select c.id, c.desde
      from public.plt_cards c
      join public.plt_setores s on s.id = c.setor_atual_id and s.papel_no_fluxo = 'entrada'
      left join public.pedidos p on p.id = c.pedido_id
     where c.tipo in ('pedido', 'reposicao')
       and c.arquivado_em is null
       and c.liberado_completo_em is null
       -- Pedido encerrado no Tiny (entregue, não entregue, cancelado) não
       -- espera liberação (S23/S24); sem nada a produzir (só frete) também
       -- não (D-63). A reposição não tem pedido: conta até ser liberada por
       -- inteiro ou arquivada.
       and (c.tipo = 'reposicao'
            or (p.id is not null
                and plt_privado.fn_situacao_normalizada(p.situacao)
                    not in ('entregue', 'nao_entregue', 'cancelado')
                and exists (select 1 from plt_privado.vw_itens_producao v
                             where v.pedido_id = p.id and v.unidades > 0)))
  )
  select
    -- D-75: os cards do quadro — pedido vivo no Tiny com peça por liberar
    -- (frete não é peça — D-63) + card de reposição
    (select count(*)::int from quadro)             as pedidos_a_liberar,
    -- como estava (o dono não pediu mudança): toda unidade criada no dia
    (select count(*)::int
       from public.plt_eventos e
       join public.plt_cards c on c.id = e.card_id
      where e.tipo = 'card_criado'
        and c.tipo = 'unidade'
        and e.ocorrido_em >= (select ini from dia)
        and e.ocorrido_em <  (select ini from dia) + interval '1 day')
                                                   as unidades_liberadas_dia,
    -- D-75: o card do quadro esperando há mais tempo
    (select max(now() - q.desde) from quadro q)    as espera_mais_antiga
   where (select id from pcp) in (select plt_privado.fn_setores_dashboard());
$$;

comment on function public.plt_fn_dash_pcp_dia(date) is
  'Visão do dia (SESSAO-16; D-75): o tile do PCP — "a liberar" = os cards que o quadro do PCP mostra (pedido vivo no Tiny com peça por liberar + reposição; o mesmo filtro de plt_fn_cards_pedido_pcp), unidades liberadas no dia e a espera mais antiga entre os cards do quadro. Vazio para quem não mede o PCP (D-32).';

-- Permissões (E-11): a porta mantém o acesso de sempre (reafirmado aqui).
revoke all on function public.plt_fn_dash_pcp_dia(date) from public, anon;
grant execute on function public.plt_fn_dash_pcp_dia(date) to authenticated;
