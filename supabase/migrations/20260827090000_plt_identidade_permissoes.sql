-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 12 — PERMISSÕES DA MATRÍCULA
-- Sessão: SESSAO-03 · Data: 2026-08-27 · Correção do E-14
--
-- O bootstrap do primeiro admin falhou com "permission denied for schema
-- plt_privado": a trigger fn_gerar_matricula NÃO era security definer, então
-- rodava com o privilégio de quem insere — a service_role, que nunca recebeu
-- USAGE no schema plt_privado (a migration 01 só deu a authenticated).
--
-- Correção em duas camadas:
--   1. a função vira SECURITY DEFINER (como as demais de plt_privado) — a
--      sequence é alcançável não importa quem dispare o insert;
--   2. a service_role ganha USAGE explícito no schema e na sequence, para a
--      intenção ficar escrita, não implícita.
--
-- ⚠️ O teste local (PGlite) roda como superusuário e NÃO pega erro de
-- permissão — permissão só se prova no banco real. Idempotente.
-- ============================================================================

alter function plt_privado.fn_gerar_matricula() security definer;

grant usage on schema plt_privado to service_role;
grant usage on sequence plt_privado.matricula_seq to service_role;
