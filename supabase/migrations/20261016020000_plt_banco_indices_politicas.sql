-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 77 — O BANCO ARRUMADO
-- (SESSAO-32 · §1.6 · Lei de Desempenho §7.2/§7.3/§7.5)
--
--   1. Índice nas chaves estrangeiras que não tinham (29). As 4 das cópias do
--      Tiny (contas a receber e notas fiscais) esperam o OK do dono, junto dos
--      índices da área Pedidos (regras 3 e 10 — "me confirme antes de aplicar").
--   2. Regras de acesso (RLS) rápidas, com o MESMO resultado:
--      · toda função de sessão embrulhada em (select …) — uma conta por consulta,
--        não por linha;
--      · pertencer a um conjunto vira `= any (array(select …))` (lei §7.3);
--      · "é líder deste setor" (fn_eh_lider_de, por linha) vira "o setor está
--        entre os que eu lidero" (fn_setores_que_lidero, uma vez por consulta);
--      · "participo da conversa" (fn_chat_participa, por linha) vira "a conversa
--        está entre as minhas" (fn_chat_minhas_conversas, uma vez por consulta);
--      · as 9 regras permissivas DUPLICADAS somem: a regra "ALL" de escrita vira
--        três (inserir · editar · apagar), e a leitura fica com uma regra só.
--      Prova: a "foto do que cada pessoa enxerga" (6 pessoas × 32 tabelas)
--      idêntica antes e depois, no banco real; e a bateria do banco.
--   3. O histórico das rotinas agendadas (cron) com retenção de 7 dias — uma
--      limpeza de calendário por dia, de madrugada (04:20 UTC).
-- Nada nas tabelas da integração.
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · Índices nas chaves estrangeiras (tabelas pequenas — o índice nasce em
--     milissegundos; dentro da transação do aplicador, com lock_timeout)
-- ----------------------------------------------------------------------------
create index if not exists listas_disparo_eventos_membro_idx   on public.listas_disparo_eventos (membro_id);
create index if not exists plt_automacoes_criada_por_idx       on public.plt_automacoes (criada_por);
create index if not exists plt_caminhoes_criado_por_idx        on public.plt_caminhoes (criado_por_id);
create index if not exists plt_campos_criado_por_idx           on public.plt_campos (criado_por);
create index if not exists plt_campos_valores_atualizado_por_idx on public.plt_campos_valores (atualizado_por);
create index if not exists plt_cards_etapa_atual_idx           on public.plt_cards (etapa_atual_id);
create index if not exists plt_chat_mensagens_autor_idx        on public.plt_chat_mensagens (autor_id);
create index if not exists plt_chaves_api_criada_por_idx       on public.plt_chaves_api (criada_por);
create index if not exists plt_etapas_setor_destino_idx        on public.plt_etapas (setor_destino_id);
create index if not exists plt_etiquetas_criada_por_idx        on public.plt_etiquetas (criada_por);
create index if not exists plt_eventos_etapa_destino_idx       on public.plt_eventos (etapa_destino_id);
create index if not exists plt_eventos_etapa_origem_idx        on public.plt_eventos (etapa_origem_id);
create index if not exists plt_eventos_setor_origem_idx        on public.plt_eventos (setor_origem_id);
create index if not exists plt_metas_criada_por_idx            on public.plt_metas (criada_por_id);
create index if not exists plt_metas_encerrada_por_idx         on public.plt_metas (encerrada_por_id);
create index if not exists plt_metas_etapa_idx                 on public.plt_metas (etapa_id);
create index if not exists plt_metas_eventos_usuario_idx       on public.plt_metas_eventos (usuario_id);
create index if not exists plt_notificacoes_card_idx           on public.plt_notificacoes (card_id);
create index if not exists plt_notificacoes_evento_idx         on public.plt_notificacoes (evento_id);
create index if not exists plt_pausas_tempo_criado_por_idx     on public.plt_pausas_tempo (criado_por);
create index if not exists plt_programacoes_atualizado_por_idx on public.plt_programacoes (atualizado_por_id);
create index if not exists plt_programacoes_caminhao_idx       on public.plt_programacoes (caminhao_id);
create index if not exists plt_programacoes_criado_por_idx     on public.plt_programacoes (criado_por_id);
create index if not exists plt_tarefas_card_idx                on public.plt_tarefas (card_id);
create index if not exists plt_tarefas_criada_por_idx          on public.plt_tarefas (criada_por_id);
create index if not exists plt_visualizacoes_setor_idx         on public.plt_visualizacoes (setor_id);
create index if not exists plt_webhook_entregas_evento_idx     on public.plt_webhook_entregas (evento_id);
create index if not exists plt_webhook_entregas_webhook_idx    on public.plt_webhook_entregas (webhook_id);
create index if not exists plt_webhooks_criado_por_idx         on public.plt_webhooks (criado_por);

-- ----------------------------------------------------------------------------
-- 2 · Os conjuntos da sessão (uma conta por consulta, no lugar das funções por
--     linha) — mesma regra de fn_eh_lider_de e de fn_chat_participa
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_setores_que_lidero()
returns setof bigint
language sql
stable
security definer
set search_path = public
as $$
  select us.setor_id
    from public.plt_usuario_setores us
    join public.plt_usuarios u on u.id = us.usuario_id
   where u.auth_user_id = auth.uid()
     and u.ativo
     and us.lider_do_setor;
$$;

comment on function plt_privado.fn_setores_que_lidero() is
  'SESSAO-32: os setores em que a pessoa logada é líder (lider_do_setor no vínculo; pessoa ativa) — a mesma regra de fn_eh_lider_de(setor), mas uma vez por consulta: `setor_id = any (array(select …))` nas regras de acesso.';

create or replace function plt_privado.fn_chat_minhas_conversas()
returns setof bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.conversa_id
    from public.plt_chat_participantes p
   where p.usuario_id = plt_privado.fn_usuario_atual()
     and p.saiu_em is null;
$$;

comment on function plt_privado.fn_chat_minhas_conversas() is
  'SESSAO-32: as conversas de que a pessoa logada participa (sem ter saído) — a mesma regra de fn_chat_participa(conversa), mas uma vez por consulta.';

revoke all on function plt_privado.fn_setores_que_lidero()    from public, anon;
revoke all on function plt_privado.fn_chat_minhas_conversas() from public, anon;
grant execute on function plt_privado.fn_setores_que_lidero()    to authenticated;
grant execute on function plt_privado.fn_chat_minhas_conversas() to authenticated;

-- ----------------------------------------------------------------------------
-- 3 · As regras de acesso — recriadas com o mesmo resultado
-- ----------------------------------------------------------------------------

-- Comercial (módulo) -----------------------------------------------------------
drop policy if exists listas_disparo_comercial on public.listas_disparo;
create policy listas_disparo_comercial on public.listas_disparo for all to authenticated
  using ((select plt_privado.fn_tem_modulo('comercial')))
  with check ((select plt_privado.fn_tem_modulo('comercial')));

drop policy if exists listas_disparo_eventos_comercial on public.listas_disparo_eventos;
create policy listas_disparo_eventos_comercial on public.listas_disparo_eventos for all to authenticated
  using ((select plt_privado.fn_tem_modulo('comercial')))
  with check ((select plt_privado.fn_tem_modulo('comercial')));

drop policy if exists listas_disparo_membros_comercial on public.listas_disparo_membros;
create policy listas_disparo_membros_comercial on public.listas_disparo_membros for all to authenticated
  using ((select plt_privado.fn_tem_modulo('comercial')))
  with check ((select plt_privado.fn_tem_modulo('comercial')));

drop policy if exists tarifas_comercial on public.tarifas_mensagem_whatsapp;
create policy tarifas_comercial on public.tarifas_mensagem_whatsapp for all to authenticated
  using ((select plt_privado.fn_tem_modulo('comercial')))
  with check ((select plt_privado.fn_tem_modulo('comercial')));

drop policy if exists webhook_eventos_crm_comercial_leitura on public.webhook_eventos_crm;
create policy webhook_eventos_crm_comercial_leitura on public.webhook_eventos_crm for select to authenticated
  using ((select plt_privado.fn_tem_modulo('comercial')));

-- Caminhões --------------------------------------------------------------------
drop policy if exists plt_caminhoes_leitura on public.plt_caminhoes;
create policy plt_caminhoes_leitura on public.plt_caminhoes for select to authenticated
  using ((select plt_privado.fn_usuario_atual()) is not null);
drop policy if exists plt_caminhoes_admin_insere on public.plt_caminhoes;
create policy plt_caminhoes_admin_insere on public.plt_caminhoes for insert to authenticated
  with check ((select plt_privado.fn_eh_admin()));
drop policy if exists plt_caminhoes_admin_edita on public.plt_caminhoes;
create policy plt_caminhoes_admin_edita on public.plt_caminhoes for update to authenticated
  using ((select plt_privado.fn_eh_admin()))
  with check ((select plt_privado.fn_eh_admin()));
drop policy if exists plt_caminhoes_admin_exclui on public.plt_caminhoes;
create policy plt_caminhoes_admin_exclui on public.plt_caminhoes for delete to authenticated
  using ((select plt_privado.fn_eh_admin()));

-- Cards ------------------------------------------------------------------------
drop policy if exists plt_cards_leitura on public.plt_cards;
create policy plt_cards_leitura on public.plt_cards for select to authenticated
  using ((select plt_privado.fn_eh_admin())
         or setor_atual_id = any (array(select plt_privado.fn_setores_do_usuario()))
         or executor_atual_id = (select plt_privado.fn_usuario_atual())
         or participantes @> array[(select plt_privado.fn_usuario_atual())]);
drop policy if exists plt_cards_criacao on public.plt_cards;
create policy plt_cards_criacao on public.plt_cards for insert to authenticated
  with check ((select plt_privado.fn_eh_admin())
              or setor_atual_id = any (array(select plt_privado.fn_setores_do_usuario())));
drop policy if exists plt_cards_admin_ajusta on public.plt_cards;
create policy plt_cards_admin_ajusta on public.plt_cards for update to authenticated
  using ((select plt_privado.fn_eh_admin()))
  with check ((select plt_privado.fn_eh_admin()));

-- Chat (as conversas da pessoa, uma vez por consulta) --------------------------
drop policy if exists plt_chat_conversas_leitura on public.plt_chat_conversas;
create policy plt_chat_conversas_leitura on public.plt_chat_conversas for select to authenticated
  using (id = any (array(select plt_privado.fn_chat_minhas_conversas())));
drop policy if exists plt_chat_mensagens_leitura on public.plt_chat_mensagens;
create policy plt_chat_mensagens_leitura on public.plt_chat_mensagens for select to authenticated
  using (conversa_id = any (array(select plt_privado.fn_chat_minhas_conversas())));
drop policy if exists plt_chat_participantes_leitura on public.plt_chat_participantes;
create policy plt_chat_participantes_leitura on public.plt_chat_participantes for select to authenticated
  using (conversa_id = any (array(select plt_privado.fn_chat_minhas_conversas())));

-- Chaves da API e webhooks (admin) ----------------------------------------------
drop policy if exists plt_chaves_api_admin on public.plt_chaves_api;
create policy plt_chaves_api_admin on public.plt_chaves_api for all to authenticated
  using ((select plt_privado.fn_eh_admin()))
  with check ((select plt_privado.fn_eh_admin()));
drop policy if exists plt_webhooks_admin on public.plt_webhooks;
create policy plt_webhooks_admin on public.plt_webhooks for all to authenticated
  using ((select plt_privado.fn_eh_admin()))
  with check ((select plt_privado.fn_eh_admin()));
drop policy if exists plt_webhook_entregas_admin on public.plt_webhook_entregas;
create policy plt_webhook_entregas_admin on public.plt_webhook_entregas for select to authenticated
  using ((select plt_privado.fn_eh_admin()));

-- Etapas: leitura para todos; escrita do admin ou do líder do setor (a regra
-- "ALL" virou três — fim da duplicada na leitura) ------------------------------
drop policy if exists plt_etapas_gestao on public.plt_etapas;
drop policy if exists plt_etapas_gestao_insere on public.plt_etapas;
create policy plt_etapas_gestao_insere on public.plt_etapas for insert to authenticated
  with check ((select plt_privado.fn_eh_admin())
              or setor_id = any (array(select plt_privado.fn_setores_que_lidero())));
drop policy if exists plt_etapas_gestao_edita on public.plt_etapas;
create policy plt_etapas_gestao_edita on public.plt_etapas for update to authenticated
  using ((select plt_privado.fn_eh_admin())
         or setor_id = any (array(select plt_privado.fn_setores_que_lidero())))
  with check ((select plt_privado.fn_eh_admin())
              or setor_id = any (array(select plt_privado.fn_setores_que_lidero())));
drop policy if exists plt_etapas_gestao_exclui on public.plt_etapas;
create policy plt_etapas_gestao_exclui on public.plt_etapas for delete to authenticated
  using ((select plt_privado.fn_eh_admin())
         or setor_id = any (array(select plt_privado.fn_setores_que_lidero())));

-- Eventos (append-only — só inserir e ler) --------------------------------------
drop policy if exists plt_eventos_registro on public.plt_eventos;
create policy plt_eventos_registro on public.plt_eventos for insert to authenticated
  with check ((select plt_privado.fn_usuario_atual()) is not null
              and ((select plt_privado.fn_eh_admin())
                   or setor_origem_id = any (array(select plt_privado.fn_setores_do_usuario()))
                   or setor_destino_id = any (array(select plt_privado.fn_setores_do_usuario()))));
drop policy if exists plt_eventos_leitura on public.plt_eventos;
create policy plt_eventos_leitura on public.plt_eventos for select to authenticated
  using ((select plt_privado.fn_eh_admin())
         or exists (select 1 from public.plt_cards c
                     where c.id = plt_eventos.card_id
                       and (c.setor_atual_id = any (array(select plt_privado.fn_setores_do_usuario()))
                            or c.executor_atual_id = (select plt_privado.fn_usuario_atual())))
         or setor_origem_id = any (array(select plt_privado.fn_setores_do_usuario()))
         or setor_destino_id = any (array(select plt_privado.fn_setores_do_usuario())));

-- Endereços do mapa ---------------------------------------------------------------
drop policy if exists plt_geocache_leitura on public.plt_geocache;
create policy plt_geocache_leitura on public.plt_geocache for select to authenticated
  using ((select plt_privado.fn_usuario_atual()) is not null);

-- Horários e pausas do tempo: leitura para todos; escrita do admin --------------
drop policy if exists plt_horarios_admin on public.plt_horarios_funcionamento;
drop policy if exists plt_horarios_admin_insere on public.plt_horarios_funcionamento;
create policy plt_horarios_admin_insere on public.plt_horarios_funcionamento for insert to authenticated
  with check ((select plt_privado.fn_eh_admin()));
drop policy if exists plt_horarios_admin_edita on public.plt_horarios_funcionamento;
create policy plt_horarios_admin_edita on public.plt_horarios_funcionamento for update to authenticated
  using ((select plt_privado.fn_eh_admin()))
  with check ((select plt_privado.fn_eh_admin()));
drop policy if exists plt_horarios_admin_exclui on public.plt_horarios_funcionamento;
create policy plt_horarios_admin_exclui on public.plt_horarios_funcionamento for delete to authenticated
  using ((select plt_privado.fn_eh_admin()));

drop policy if exists plt_pausas_admin on public.plt_pausas_tempo;
drop policy if exists plt_pausas_admin_insere on public.plt_pausas_tempo;
create policy plt_pausas_admin_insere on public.plt_pausas_tempo for insert to authenticated
  with check ((select plt_privado.fn_eh_admin()));
drop policy if exists plt_pausas_admin_edita on public.plt_pausas_tempo;
create policy plt_pausas_admin_edita on public.plt_pausas_tempo for update to authenticated
  using ((select plt_privado.fn_eh_admin()))
  with check ((select plt_privado.fn_eh_admin()));
drop policy if exists plt_pausas_admin_exclui on public.plt_pausas_tempo;
create policy plt_pausas_admin_exclui on public.plt_pausas_tempo for delete to authenticated
  using ((select plt_privado.fn_eh_admin()));

-- Registro de atividade (append-only por gatilho) -------------------------------
drop policy if exists plt_logs_atividade_grava_proprio on public.plt_logs_atividade;
create policy plt_logs_atividade_grava_proprio on public.plt_logs_atividade for insert to authenticated
  with check (usuario_id = (select plt_privado.fn_usuario_atual()));
drop policy if exists plt_logs_atividade_leitura on public.plt_logs_atividade;
create policy plt_logs_atividade_leitura on public.plt_logs_atividade for select to authenticated
  using ((select plt_privado.fn_eh_super_admin())
         or usuario_id = (select plt_privado.fn_usuario_atual()));

-- Metas -------------------------------------------------------------------------
drop policy if exists plt_metas_leitura on public.plt_metas;
create policy plt_metas_leitura on public.plt_metas for select to authenticated
  using ((select plt_privado.fn_eh_admin())
         or usuario_id = (select plt_privado.fn_usuario_atual())
         or setor_id = any (array(select plt_privado.fn_setores_do_usuario()))
         or criada_por_id = (select plt_privado.fn_usuario_atual())
         or (usuario_id is not null
             and exists (select 1 from public.plt_usuario_setores us
                          where us.usuario_id = plt_metas.usuario_id
                            and us.setor_id = any (array(select plt_privado.fn_setores_que_lidero())))));
drop policy if exists plt_metas_criacao on public.plt_metas;
create policy plt_metas_criacao on public.plt_metas for insert to authenticated
  with check (criada_por_id = (select plt_privado.fn_usuario_atual())
              and ((select plt_privado.fn_eh_admin())
                   or (setor_id is not null and setor_id = any (array(select plt_privado.fn_setores_que_lidero())))
                   or (usuario_id is not null
                       and (usuario_id = (select plt_privado.fn_usuario_atual())
                            or exists (select 1 from public.plt_usuario_setores us
                                        where us.usuario_id = plt_metas.usuario_id
                                          and us.setor_id = any (array(select plt_privado.fn_setores_que_lidero())))))));
drop policy if exists plt_metas_edicao on public.plt_metas;
create policy plt_metas_edicao on public.plt_metas for update to authenticated
  using ((select plt_privado.fn_eh_admin()) or criada_por_id = (select plt_privado.fn_usuario_atual()))
  with check ((select plt_privado.fn_eh_admin()) or criada_por_id = (select plt_privado.fn_usuario_atual()));

-- Avisos (sino) -------------------------------------------------------------------
drop policy if exists plt_notificacoes_proprias on public.plt_notificacoes;
create policy plt_notificacoes_proprias on public.plt_notificacoes for select to authenticated
  using (destinatario_id = (select plt_privado.fn_usuario_atual()) or (select plt_privado.fn_eh_admin()));
drop policy if exists plt_notificacoes_marcar_lida on public.plt_notificacoes;
create policy plt_notificacoes_marcar_lida on public.plt_notificacoes for update to authenticated
  using (destinatario_id = (select plt_privado.fn_usuario_atual()))
  with check (destinatario_id = (select plt_privado.fn_usuario_atual()));
drop policy if exists plt_notificacoes_apaga_lidas on public.plt_notificacoes;
create policy plt_notificacoes_apaga_lidas on public.plt_notificacoes for delete to authenticated
  using (destinatario_id = (select plt_privado.fn_usuario_atual()) and lida_em is not null);

-- Presença: leitura para todos; escrita só da própria ---------------------------
drop policy if exists plt_presencas_propria on public.plt_presencas;
drop policy if exists plt_presencas_propria_insere on public.plt_presencas;
create policy plt_presencas_propria_insere on public.plt_presencas for insert to authenticated
  with check (usuario_id = (select plt_privado.fn_usuario_atual()));
drop policy if exists plt_presencas_propria_edita on public.plt_presencas;
create policy plt_presencas_propria_edita on public.plt_presencas for update to authenticated
  using (usuario_id = (select plt_privado.fn_usuario_atual()))
  with check (usuario_id = (select plt_privado.fn_usuario_atual()));
drop policy if exists plt_presencas_propria_exclui on public.plt_presencas;
create policy plt_presencas_propria_exclui on public.plt_presencas for delete to authenticated
  using (usuario_id = (select plt_privado.fn_usuario_atual()));

-- Programação de entregas ---------------------------------------------------------
drop policy if exists plt_programacoes_leitura on public.plt_programacoes;
create policy plt_programacoes_leitura on public.plt_programacoes for select to authenticated
  using ((select plt_privado.fn_pode_ver_expedicao()));

-- Setores: leitura para todos; escrita do admin ---------------------------------
drop policy if exists plt_setores_admin on public.plt_setores;
drop policy if exists plt_setores_admin_insere on public.plt_setores;
create policy plt_setores_admin_insere on public.plt_setores for insert to authenticated
  with check ((select plt_privado.fn_eh_admin()));
drop policy if exists plt_setores_admin_edita on public.plt_setores;
create policy plt_setores_admin_edita on public.plt_setores for update to authenticated
  using ((select plt_privado.fn_eh_admin()))
  with check ((select plt_privado.fn_eh_admin()));
drop policy if exists plt_setores_admin_exclui on public.plt_setores;
create policy plt_setores_admin_exclui on public.plt_setores for delete to authenticated
  using ((select plt_privado.fn_eh_admin()));

-- Tarefas -----------------------------------------------------------------------
drop policy if exists plt_tarefas_leitura on public.plt_tarefas;
create policy plt_tarefas_leitura on public.plt_tarefas for select to authenticated
  using (responsavel_id = (select plt_privado.fn_usuario_atual())
         or criada_por_id = (select plt_privado.fn_usuario_atual())
         or (not privada
             and ((select plt_privado.fn_eh_admin())
                  or setor_id = any (array(select plt_privado.fn_setores_do_usuario())))));
drop policy if exists plt_tarefas_criacao on public.plt_tarefas;
create policy plt_tarefas_criacao on public.plt_tarefas for insert to authenticated
  with check (origem = 'pessoa'
              and ((select plt_privado.fn_eh_admin())
                   or setor_id = any (array(select plt_privado.fn_setores_que_lidero()))
                   or criada_por_id = (select plt_privado.fn_usuario_atual())));
drop policy if exists plt_tarefas_atualizacao on public.plt_tarefas;
create policy plt_tarefas_atualizacao on public.plt_tarefas for update to authenticated
  using (responsavel_id = (select plt_privado.fn_usuario_atual())
         or (not privada
             and ((select plt_privado.fn_eh_admin())
                  or setor_id = any (array(select plt_privado.fn_setores_que_lidero())))))
  with check (responsavel_id = (select plt_privado.fn_usuario_atual())
              or (not privada
                  and ((select plt_privado.fn_eh_admin())
                       or setor_id = any (array(select plt_privado.fn_setores_que_lidero())))));

-- Vínculos pessoa ↔ setor: leitura para todos; escrita do admin ou do líder -----
drop policy if exists plt_usuario_setores_gestao on public.plt_usuario_setores;
drop policy if exists plt_usuario_setores_gestao_insere on public.plt_usuario_setores;
create policy plt_usuario_setores_gestao_insere on public.plt_usuario_setores for insert to authenticated
  with check ((select plt_privado.fn_eh_admin())
              or setor_id = any (array(select plt_privado.fn_setores_que_lidero())));
drop policy if exists plt_usuario_setores_gestao_edita on public.plt_usuario_setores;
create policy plt_usuario_setores_gestao_edita on public.plt_usuario_setores for update to authenticated
  using ((select plt_privado.fn_eh_admin())
         or setor_id = any (array(select plt_privado.fn_setores_que_lidero())))
  with check ((select plt_privado.fn_eh_admin())
              or setor_id = any (array(select plt_privado.fn_setores_que_lidero())));
drop policy if exists plt_usuario_setores_gestao_exclui on public.plt_usuario_setores;
create policy plt_usuario_setores_gestao_exclui on public.plt_usuario_setores for delete to authenticated
  using ((select plt_privado.fn_eh_admin())
         or setor_id = any (array(select plt_privado.fn_setores_que_lidero())));

-- Pessoas: leitura (por coluna — D-68) para todos; o admin cria/apaga; cada um
-- edita a si mesmo e o admin edita todos (as duas de edição viraram uma) --------
drop policy if exists plt_usuarios_admin_escreve on public.plt_usuarios;
drop policy if exists plt_usuarios_edita_a_si on public.plt_usuarios;
drop policy if exists plt_usuarios_admin_insere on public.plt_usuarios;
create policy plt_usuarios_admin_insere on public.plt_usuarios for insert to authenticated
  with check ((select plt_privado.fn_eh_admin()));
drop policy if exists plt_usuarios_edicao on public.plt_usuarios;
create policy plt_usuarios_edicao on public.plt_usuarios for update to authenticated
  using ((select plt_privado.fn_eh_admin()) or id = (select plt_privado.fn_usuario_atual()))
  with check ((select plt_privado.fn_eh_admin()) or id = (select plt_privado.fn_usuario_atual()));
drop policy if exists plt_usuarios_admin_exclui on public.plt_usuarios;
create policy plt_usuarios_admin_exclui on public.plt_usuarios for delete to authenticated
  using ((select plt_privado.fn_eh_admin()));

-- Painéis salvos: leitura (as minhas, as globais, as do meu setor; o admin vê
-- todas); escrita das minhas (o admin, todas) -----------------------------------
drop policy if exists plt_visualizacoes_leitura on public.plt_visualizacoes;
create policy plt_visualizacoes_leitura on public.plt_visualizacoes for select to authenticated
  using ((select plt_privado.fn_eh_admin())
         or usuario_id = (select plt_privado.fn_usuario_atual())
         or escopo = 'global'
         or (escopo = 'setor' and setor_id = any (array(select plt_privado.fn_setores_do_usuario()))));
drop policy if exists plt_visualizacoes_proprias on public.plt_visualizacoes;
drop policy if exists plt_visualizacoes_proprias_insere on public.plt_visualizacoes;
create policy plt_visualizacoes_proprias_insere on public.plt_visualizacoes for insert to authenticated
  with check ((select plt_privado.fn_eh_admin()) or usuario_id = (select plt_privado.fn_usuario_atual()));
drop policy if exists plt_visualizacoes_proprias_edita on public.plt_visualizacoes;
create policy plt_visualizacoes_proprias_edita on public.plt_visualizacoes for update to authenticated
  using ((select plt_privado.fn_eh_admin()) or usuario_id = (select plt_privado.fn_usuario_atual()))
  with check ((select plt_privado.fn_eh_admin()) or usuario_id = (select plt_privado.fn_usuario_atual()));
drop policy if exists plt_visualizacoes_proprias_exclui on public.plt_visualizacoes;
create policy plt_visualizacoes_proprias_exclui on public.plt_visualizacoes for delete to authenticated
  using ((select plt_privado.fn_eh_admin()) or usuario_id = (select plt_privado.fn_usuario_atual()));

-- Armário de arquivos (storage) e canais ao vivo (realtime) — só onde existem ---
do $$
begin
  if to_regclass('storage.objects') is not null then
    drop policy if exists plt_imagens_escrita on storage.objects;
    create policy plt_imagens_escrita on storage.objects for insert to authenticated
      with check (bucket_id = 'plt-imagens'
                  and ((select plt_privado.fn_eh_admin())
                       or exists (select 1 from public.plt_usuario_setores us
                                   where us.usuario_id = (select plt_privado.fn_usuario_atual())
                                     and us.lider_do_setor)));
    drop policy if exists plt_imagens_remocao on storage.objects;
    create policy plt_imagens_remocao on storage.objects for delete to authenticated
      using (bucket_id = 'plt-imagens'
             and ((select plt_privado.fn_eh_admin())
                  or exists (select 1 from public.plt_usuario_setores us
                              where us.usuario_id = (select plt_privado.fn_usuario_atual())
                                and us.lider_do_setor)));
    drop policy if exists plt_imagens_estoque_logistica on storage.objects;
    create policy plt_imagens_estoque_logistica on storage.objects for insert to authenticated
      with check (bucket_id = 'plt-imagens'
                  and (storage.foldername(name))[1] = 'produtos'
                  and (select plt_privado.fn_pode_ver_expedicao()));
    drop policy if exists plt_imagens_perfil_proprio on storage.objects;
    create policy plt_imagens_perfil_proprio on storage.objects for insert to authenticated
      with check (bucket_id = 'plt-imagens'
                  and (storage.foldername(name))[1] = 'perfis'
                  and (storage.foldername(name))[2] = (select plt_privado.fn_usuario_atual())::text);
    drop policy if exists plt_imagens_perfil_proprio_troca on storage.objects;
    create policy plt_imagens_perfil_proprio_troca on storage.objects for update to authenticated
      using (bucket_id = 'plt-imagens'
             and (storage.foldername(name))[1] = 'perfis'
             and (storage.foldername(name))[2] = (select plt_privado.fn_usuario_atual())::text);
    drop policy if exists plt_imagens_perfil_proprio_remocao on storage.objects;
    create policy plt_imagens_perfil_proprio_remocao on storage.objects for delete to authenticated
      using (bucket_id = 'plt-imagens'
             and (storage.foldername(name))[1] = 'perfis'
             and (storage.foldername(name))[2] = (select plt_privado.fn_usuario_atual())::text);
  end if;
end;
$$;

do $$
begin
  if to_regclass('realtime.messages') is not null
     and to_regprocedure('realtime.topic()') is not null then
    execute 'drop policy if exists plt_chat_ouvir on realtime.messages';
    execute $sql$
      create policy plt_chat_ouvir on realtime.messages
        for select to authenticated
        using (realtime.messages.extension = 'broadcast'
               and (select plt_privado.fn_chat_pode_ouvir(realtime.topic())))
    $sql$;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4 · O histórico das rotinas agendadas guarda 7 dias (limpeza de calendário,
--     uma vez por dia às 04:20 UTC — 01:20 de Natal, longe da renovação do
--     token do Tiny). Só onde existe pg_cron (E-72: o cron.job só aparece
--     dentro do ramo que garante a extensão).
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if not exists (select 1 from cron.job where jobname = 'plt-cron-historico-limpar') then
      perform cron.schedule('plt-cron-historico-limpar', '20 4 * * *',
        $c$delete from cron.job_run_details where end_time < now() - interval '7 days'$c$);
    end if;
  end if;
end;
$$;
