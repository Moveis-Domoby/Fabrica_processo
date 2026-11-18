-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · COMERCIAL: A FUNÇÃO ANTIGA DAS TRANSIÇÕES
-- SAI DO BANCO (SESSAO-54 · DT-BD4 do débito técnico do Comercial)
--
-- fn_dashboard_transitions(p_start, p_end) veio na cópia do Painel de Recompra
-- (migration 20260915120000) e devolve UMA LINHA POR COMPRA com a chave do
-- cliente (o telefone) — dado pessoal que nenhuma tela usa. O gráfico de
-- transições lê fn_dashboard_transitions_summary (o agregado, sem dado
-- pessoal) e o detalhe lê fn_dashboard_transition_clients; as duas FICAM.
--
-- A prova de que nada a chama (18/11/2026, no código):
--   · src/ — nenhuma chamada (só a _summary, em src/comercial/data/queries.ts);
--     o gancho antigo que a usava (useTransitionData.ts) nunca foi trazido
--     para este repositório;
--   · supabase/functions/ — nenhuma chamada;
--   · supabase/migrations/ — só a própria definição (3 versões) e os grants;
--     nenhuma outra função, view, gatilho ou rotina a cita.
-- No banco vivo, a conferência antes de aplicar está no handoff da sessão
-- ("Para ligar com o dono").
--
-- ⚠️ É EXCLUSÃO: aplicar só com o OK do dono. Sem "cascade" de propósito — se
-- algo no banco depender da função, a migration FALHA em vez de levar junto.
-- Para voltar atrás: recriar a função pelo trecho dela na migration
-- 20261016110000_plt_comercial_tela_pronta.sql + os grants da 20260915120000.
-- ============================================================================

set local lock_timeout = '5s';

drop function if exists public.fn_dashboard_transitions(timestamp with time zone, timestamp with time zone);
