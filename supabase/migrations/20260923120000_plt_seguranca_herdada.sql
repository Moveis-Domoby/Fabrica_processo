-- =============================================================================
-- Migration 32 · SESSAO-21 (fechamento) · 23/09/2026
-- Os apontamentos de segurança HERDADOS da SESSAO-20 (advisors do Supabase,
-- vindos da frente do backfill e da do "vigia" — não do Comercial).
-- Aprovação do dono na conversa de 23/09: "se nenhuma [automação] tiver, pode
-- realizar os ajustes".
--
-- Conferido ANTES de escrever (F-08):
--   • fn_pedido_por_numero_nf(integer) — SECURITY DEFINER, devolve só o id
--     interno de um pedido a partir do nº da NF (sem dado de cliente), e era
--     executável por anon/authenticated via /rest/v1/rpc. Quem usa de verdade:
--     plt_privado.fn_vincular_conta_receber (SECURITY DEFINER — roda como a
--     dona, não depende do grant de anon). Nenhum dos 4 workflows principais do
--     n8n a chama (conferidos pelo dono e pelo Claude em 23/09), nenhum código
--     do repo, e 0 chamadas pela API nas últimas 24h (logs do Supabase; a mesma
--     consulta viu 66 chamadas da fn_upsert_pedido). → revogar de public/anon/
--     authenticated; manter service_role (o n8n usa a chave de serviço).
--   • fn_backfill_conta_mapear(jsonb) e fn_vig_touch() — sem search_path fixo
--     (mesma classe do E-11). A primeira é SQL puro sobre o payload (usada por
--     fn_backfill_aplicar e fn_vincular_conta_receber); a segunda é o gatilho
--     vig_touch da vig_conhecimento_vendas (só carimba atualizado_em). Fixar o
--     search_path não muda comportamento.
--   • vig_conhecimento_vendas com RLS ligado e nenhuma policy — INTENCIONAL
--     (tabela do Atendimento, lida só com a chave de serviço, como a
--     tiny_auth). Nada a fazer.
--
-- Idempotente e tolerante: cada objeto é tocado só se existir (to_regprocedure)
-- — o harness de testes pode não ter os objetos das outras frentes.
-- =============================================================================

do $$
begin
  if to_regprocedure('public.fn_pedido_por_numero_nf(integer)') is not null then
    revoke execute on function public.fn_pedido_por_numero_nf(integer) from public, anon, authenticated;
    grant execute on function public.fn_pedido_por_numero_nf(integer) to service_role;
  end if;

  if to_regprocedure('public.fn_backfill_conta_mapear(jsonb)') is not null then
    alter function public.fn_backfill_conta_mapear(jsonb) set search_path = public, pg_temp;
  end if;

  if to_regprocedure('public.fn_vig_touch()') is not null then
    alter function public.fn_vig_touch() set search_path = public, pg_temp;
  end if;
end $$;
