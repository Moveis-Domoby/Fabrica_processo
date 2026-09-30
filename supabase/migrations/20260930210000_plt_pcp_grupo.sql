-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 47 — O PCP EM ABAS (rodada do dono
-- em 30/09, no teste ao vivo do Ajuste Estoque 2 — ↪️ D-86):
--
--   "Dentro de PCP, coloque uma nova aí para solicitação de estoque, pedidos
--    aguardando liberação, todos os pedidos. Cancelados deve sair de PCP e
--    virar rota filha de logística."
--
-- O gatilho do pedido: as reposições lançadas à mão ENTRARAM no quadro, mas o
-- quadro ordena do mais antigo para o mais novo e pagina de 10 em 10 — elas
-- caíam na última página, invisíveis. A porta do quadro ganha o p_grupo:
--   · nulo  = tudo, como sempre (o painel da Visão do dia continua batendo — D-75);
--   · 'reposicao' = só as solicitações de estoque (a aba nova);
--   · 'pedido'    = só os pedidos aguardando liberação.
-- A aba "Todos os pedidos" usa a porta que já existia (plt_fn_pedidos_kanban);
-- os Cancelados continuam na porta deles (plt_fn_pedidos_cancelados) — só a
-- tela muda de lugar. Nada mais muda.
--
-- A-12: parâmetro novo com default via CREATE OR REPLACE criaria uma
-- SOBRECARGA — por isso o drop das duas assinaturas antes do create.
-- ============================================================================

set local lock_timeout = '5s';

drop function if exists public.plt_fn_cards_pedido_pcp(integer, integer);
drop function if exists public.plt_fn_cards_pedido_pcp(integer, integer, text);
create function public.plt_fn_cards_pedido_pcp(
  p_limite       integer default 10,
  p_deslocamento integer default 0,
  p_grupo        text    default null   -- null = tudo | 'pedido' | 'reposicao'
)
returns table (
  id                   bigint,
  tipo                 text,
  pedido_id            bigint,
  card_pai_id          bigint,
  item_seq             integer,
  item_codigo          text,
  item_descricao       text,
  indice_unidade       integer,
  total_unidades       integer,
  setor_atual_id       bigint,
  etapa_atual_id       bigint,
  desde                timestamptz,
  executor_atual_id    uuid,
  responsavel_id       uuid,
  delegado_em          timestamptz,
  qualidade_atual      text,
  concluido_em         timestamptz,
  pausado_em           timestamptz,
  liberado_completo_em timestamptz,
  contagem_total       bigint
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
     and (p_grupo is null or c.tipo = p_grupo)
     and c.arquivado_em is null
     and c.liberado_completo_em is null
     -- Pedido encerrado no Tiny sai do quadro (S23); CANCELADO vai para a tela
     -- Cancelados (S24, agora na Logística). A reposição não tem pedido: fica
     -- até ser liberada por inteiro, arquivada ou vencer (D-85).
     and (c.tipo = 'reposicao'
          or (p.id is not null
              and plt_privado.fn_situacao_normalizada(p.situacao)
                  not in ('entregue', 'nao_entregue', 'cancelado')
              -- D-63: sem nada a produzir (só frete), o pedido não espera
              -- liberação — vai direto para Pedidos em aguardo.
              and exists (select 1 from plt_privado.vw_itens_producao v
                           where v.pedido_id = p.id and v.unidades > 0)))
   order by c.desde asc nulls last, c.id
   limit least(greatest(coalesce(p_limite, 10), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_cards_pedido_pcp(integer, integer, text) is
  'O quadro do PCP, paginado. p_grupo separa as abas (rodada de 30/09): nulo = tudo (o painel da Visão do dia usa assim — D-75), ''pedido'' = aguardando liberação, ''reposicao'' = solicitações de estoque. Gate: PCP/admin.';

revoke all on function public.plt_fn_cards_pedido_pcp(integer, integer, text) from public, anon;
grant execute on function public.plt_fn_cards_pedido_pcp(integer, integer, text) to authenticated;
