-- =============================================================================
-- CRONS DO MÓDULO COMERCIAL — banco da FÁBRICA (axnzldwgwsmepukdiljx)
--
-- Versionado na SESSAO-21 (cutover, 22/09/2026) — resolve o DT-ARQ5: antes
-- deste arquivo o agendamento só existia no repo da loja
-- (`Planilha de recompra/supabase/cron_agendamentos.sql`), de onde veio o modelo.
--
-- São 4 dos 6 jobs do projeto antigo. Os 2 de sync (`tick-incremental-tiny`,
-- `tick-auditoria-tiny`) NÃO migram: a fábrica recebe pedidos pelo webhook do
-- n8n (ver [[SUPA - Comercial - Cron e Rotinas]] §4).
--
-- Placeholders: <PROJECT_REF> e <ANON_KEY>. NUNCA gravar a chave neste arquivo
-- (regra crítica 4). Quem substitui é o script
-- `supabase/manutencao/2026-09-22_agendar_crons_comercial.mjs`, que lê o
-- `.env.local`, confere que a chave é a ANON (não a service_role) e que o job
-- homônimo está desligado no projeto antigo, e agenda UM job por vez.
--
-- A anon key basta para o verify_jwt (ligado nas 4 functions na fábrica); as
-- functions usam a service_role que o próprio runtime injeta.
--
-- Cada bloco começa com `-- @job <nome>` — é assim que o script o encontra.
-- Inspeção:
--   select jobname, schedule, active from cron.job order by jobname;
--   select j.jobname, d.status, d.start_time from cron.job_run_details d
--     join cron.job j using (jobid) order by d.start_time desc limit 20;
-- =============================================================================

-- @job tiny-auth-refresh-cron
-- 🔴 O RENOVADOR DO TOKEN DO TINY — o job mais crítico do sistema. Regra do
-- dono único: nunca ativo em dois projetos ao mesmo tempo. A cada 3h = 8
-- tentativas por dia para um refresh que vale ~24h.
select cron.schedule(
  'tiny-auth-refresh-cron',
  '0 */3 * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/tiny-auth-refresh',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <ANON_KEY>'
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- @job enviar-proximo-disparo-cron
-- Motor da fila de disparo: um contato por lista por ciclo, respeitando
-- `intervalo_disparo_segundos`. Nunca ativo em dois projetos (disparo duplicado).
select cron.schedule(
  'enviar-proximo-disparo-cron',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/enviar-proximo-disparo',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <ANON_KEY>'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- @job processar-timers-disparo-cron
-- Expira membros `aguardando_resposta` com prazo vencido.
select cron.schedule(
  'processar-timers-disparo-cron',
  '0 * * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/processar-timers-disparo',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <ANON_KEY>'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- @job verificar-vendas-disparo-cron
-- Atribuição de venda. O minuto 30 vinha de esperar o sync do Tiny da hora
-- cheia (que não existe na fábrica) — decisão em aberto: mantido até alguém
-- decidir (SUPA - Comercial - Cron e Rotinas §4).
select cron.schedule(
  'verificar-vendas-disparo-cron',
  '30 * * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/verificar-vendas-disparo',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <ANON_KEY>'
    ),
    body    := '{}'::jsonb
  );
  $$
);
