-- ============================================================================
-- Ajuste do dono (06/11/2026 — cabeçalhos compactos, 6ª volta): o botão
-- "Modo TV" acima do "Modo tablet" aparece AO VIVO para quem ganhou a
-- permissão de transmitir — sem recarregar a página.
--
-- Recriada POR INTEIRO da versão viva (20261105040000_plt_tempos_producao_modo_tv):
-- a única mudança é o sinal no fim — o evento "perfil" no canal privado da
-- pessoa (o mesmo do chat e do sino, plt-chat-u:<id>); a tela dela relê o
-- perfil (a porta de abertura) e o botão aparece/some. O sinal não leva dado
-- sensível: só os módulos novos, que a própria pessoa já pode ler.
-- Lei §4: trabalho nasce do fato (o gesto do admin), nada de relógio.
-- ============================================================================

create or replace function public.plt_fn_usuario_modo_tv(p_usuario_id uuid, p_ligado boolean, p_so_tv boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_u    public.plt_usuarios%rowtype;
  v_mods text[];
begin
  if not plt_privado.fn_eh_admin() then
    raise exception 'Ligar o Modo TV é gesto de administrador.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_u from public.plt_usuarios u where u.id = p_usuario_id for update;
  if v_u.id is null then
    raise exception 'Pessoa não encontrada.' using errcode = 'no_data_found';
  end if;
  if v_u.conta_tablet then
    raise exception 'A conta do tablet não abre o Modo TV.' using errcode = 'check_violation';
  end if;
  v_mods := array_remove(coalesce(v_u.modulos, '{}'), 'tv');
  if coalesce(p_ligado, false) and coalesce(p_so_tv, false) then
    if v_u.papel = 'admin' then
      raise exception 'Um administrador não pode ser conta só da TV.' using errcode = 'check_violation';
    end if;
    v_mods := array['tv'];
  elsif coalesce(p_ligado, false) then
    if not (v_mods && array['fabrica', 'comercial', 'entregas']::text[]) then
      v_mods := array['fabrica'] || v_mods;
    end if;
    v_mods := v_mods || 'tv'::text;
  elsif not (v_mods && array['fabrica', 'comercial', 'entregas']::text[]) then
    v_mods := array['fabrica'] || v_mods;   -- desligou a conta só da TV: volta a ser da fábrica
  end if;
  update public.plt_usuarios set modulos = v_mods where id = v_u.id;
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (plt_privado.fn_usuario_atual(), 'usuario_modo_tv',
            jsonb_build_object('usuario_id', v_u.id, 'nome', v_u.nome, 'ligado', coalesce(p_ligado, false),
                               'so_tv', coalesce(p_ligado, false) and coalesce(p_so_tv, false),
                               'antes', to_jsonb(v_u.modulos), 'modulos', to_jsonb(v_mods)));
  -- 06/11: a tela da pessoa fica sabendo na hora (o botão Modo TV aparece/some).
  perform plt_privado.fn_chat_sinal(v_u.id, 'perfil', jsonb_build_object('modulos', to_jsonb(v_mods)));
  return jsonb_build_object('modulos', to_jsonb(v_mods));
end;
$$;
comment on function public.plt_fn_usuario_modo_tv(uuid, boolean, boolean) is
  'SESSAO-43 (F3): liga/desliga a permissão Modo TV de uma pessoa (o módulo "tv"); p_so_tv = a conta SÓ da TV (módulos = {tv} — entra direto na TV e não abre outra tela). Só admin; trilha usuario_modo_tv. 06/11: avisa a pessoa ao vivo (evento "perfil" no canal dela).';
revoke all on function public.plt_fn_usuario_modo_tv(uuid, boolean, boolean) from public, anon;
grant execute on function public.plt_fn_usuario_modo_tv(uuid, boolean, boolean) to authenticated;
