-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 34 — APAGAR AVISOS LIDOS
-- Sessão: SESSAO-23 (ajustes do dono, 23/09) · Data: 2026-09-24
--
-- Pedido do dono: lixeira em cada notificação JÁ LIDA e o "Apagar lidas".
-- O aviso é estado de leitura, não história — o FATO que o gerou continua
-- imutável em plt_eventos (notificacao_enviada, append-only). Por isso apagar
-- é permitido, mas só o PRÓPRIO aviso e só depois de lido: aviso não lido não
-- se apaga (ninguém "limpa" o que ainda não viu).
-- ============================================================================

drop policy if exists plt_notificacoes_apaga_lidas on public.plt_notificacoes;
create policy plt_notificacoes_apaga_lidas on public.plt_notificacoes
  for delete to authenticated
  using (
    destinatario_id = plt_privado.fn_usuario_atual()
    and lida_em is not null
  );

comment on policy plt_notificacoes_apaga_lidas on public.plt_notificacoes is
  'SESSAO-23 (23/09): cada um apaga os próprios avisos, e só os já lidos. O fato segue em plt_eventos.';
