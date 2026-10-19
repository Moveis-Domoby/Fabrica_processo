-- ============================================================================
-- SESSAO-37 · A conta do tablet de um setor não se arquiva nem se exclui
-- (D-147 — achado do dono em 19/10, primeiro dia de produção)
--
-- O que aconteceu: as contas de tablet (uma por setor, nascidas sozinhas na
-- primeira entrada pelo PIN do setor) apareciam na Equipe como se fossem
-- pessoas; três foram arquivadas por engano e os tablets do SECC, da CNC e do
-- FITAMENTO passaram a recusar a entrada ("conta do tablet desativada").
--
-- A tela da Equipe deixou de listá-las; esta trava garante por baixo, para
-- QUALQUER caminho (porta de arquivar, de excluir ou comando direto — M-14):
-- conta de tablet não é arquivada, desativada nem apagada. Manutenção
-- consciente liga a chave de sessão plt.ajuste_conta_tablet = 'on'.
-- ============================================================================

create or replace function plt_privado.fn_proteger_conta_tablet()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(current_setting('plt.ajuste_conta_tablet', true), '') = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    if old.conta_tablet then
      raise exception 'A conta do tablet de um setor não se exclui — ela é do aparelho, não de uma pessoa.'
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  if old.conta_tablet
     and ((new.arquivado_em is not null and old.arquivado_em is null)
          or (old.ativo and not new.ativo)) then
    raise exception 'A conta do tablet de um setor não se arquiva nem se desativa — sem ela o tablet do setor não entra.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function plt_privado.fn_proteger_conta_tablet() from public, anon, authenticated;

drop trigger if exists plt_usuarios_conta_tablet_protegida on public.plt_usuarios;
create trigger plt_usuarios_conta_tablet_protegida
  before update or delete on public.plt_usuarios
  for each row
  execute function plt_privado.fn_proteger_conta_tablet();

comment on function plt_privado.fn_proteger_conta_tablet() is
  'SESSAO-37 (D-147): a conta do tablet de um setor não se arquiva, desativa nem exclui (três foram arquivadas por engano pela Equipe em 19/10 e travaram os tablets). Manutenção consciente: set plt.ajuste_conta_tablet = on.';
