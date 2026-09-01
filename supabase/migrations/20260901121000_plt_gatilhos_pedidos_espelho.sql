-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 24 — ESPELHO DA BLINDAGEM DO PCP
-- Sessão: SESSAO-14 · Data: 2026-09-01
--
-- A frente do backfill do Tiny (28/08, fora do repo) trocou EM PRODUÇÃO o
-- gatilho único plt_pedidos_reagir por DOIS gatilhos com guarda WHEN: pedido
-- histórico (origem <> 'webhook') ou já encerrado NÃO vira card no PCP.
-- A nota do esquema manda o repositório espelhar esse desenho — sem isto, a
-- próxima reaplicação das migrations recriaria o gatilho antigo e a blindagem
-- sumiria em silêncio (e o próximo backfill encheria o PCP de cards).
--
-- O corpo de plt_privado.fn_reagir_pedido() NÃO muda — só as definições de
-- gatilho. São dois porque tg_op não pode ser usado dentro de um WHEN.
-- Este arquivo espelha, à letra, o bloco 1 de
-- _docs/Supabase-fabrica/22_backfill_tiny.sql (aplicado em produção em 28/08).
-- ============================================================================

drop trigger if exists plt_pedidos_reagir on public.pedidos;
drop trigger if exists plt_pedidos_reagir_insercao on public.pedidos;
drop trigger if exists plt_pedidos_reagir_atualizacao on public.pedidos;

create trigger plt_pedidos_reagir_insercao
  after insert on public.pedidos
  for each row
  when (
    new.origem is not distinct from 'webhook'
    and lower(coalesce(new.situacao, '')) not in ('entregue', 'nao_entregue', 'cancelado')
  )
  execute function plt_privado.fn_reagir_pedido();

create trigger plt_pedidos_reagir_atualizacao
  after update on public.pedidos
  for each row
  execute function plt_privado.fn_reagir_pedido();

comment on trigger plt_pedidos_reagir_insercao on public.pedidos is
  'Entrada automática (D-31) com a blindagem do backfill: só venda ao vivo (webhook, não encerrada) vira card no PCP. Espelho do 22_backfill_tiny.sql.';
comment on trigger plt_pedidos_reagir_atualizacao on public.pedidos is
  'Atualização de pedido reage sem guarda — UPDATE nunca cria card. Espelho do 22_backfill_tiny.sql.';
