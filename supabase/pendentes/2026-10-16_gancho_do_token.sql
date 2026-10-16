-- ============================================================================
-- ⏸️ PENDENTE — NÃO APLICAR sem o OK do dono, NA HORA de ligar o gancho no
-- painel da Supabase (Authentication → Hooks → Custom Access Token), com ele.
-- (SESSAO-32 · §1.2 · Lei §5 — "permissões no token, sem ir ao banco")
--
-- O que faz: toda vez que o login emite ou renova o token (a cada ~1 h, ou no
-- tempo configurado no painel), esta função põe NO TOKEN quem a pessoa é na
-- plataforma — o id do cadastro, o papel, se é super admin, se está ativa, os
-- módulos e os setores (com a liderança). Nada pessoal (D-68: sem nome,
-- e-mail, telefone, matrícula). Depois disso, as funções de sessão
-- (fn_usuario_atual, fn_eh_admin, fn_setores_do_usuario, fn_tem_modulo,
-- fn_eh_super_admin) podem ler do token em vez de consultar plt_usuarios a cada
-- linha — o passo seguinte (B3), que vem num arquivo próprio e só depois deste.
--
-- Decisão provisória (para o dono): a pessoa INATIVA não é recusada no login
-- (hoje ela entra no Auth e vê a tela "conta sem aprovação"); o token sai com
-- plt_ativo = false e as regras de acesso negam tudo, como hoje. Se o dono
-- preferir recusar no próprio login, troca-se o bloco marcado (RECUSAR) —
-- a mensagem aparece na tela de entrar.
--
-- Como ligar (com o dono, no painel):
--   1. aplicar este arquivo (banco:aplicar -- --confirmar --so <arquivo>,
--      depois de copiá-lo para supabase/migrations com o número da vez);
--   2. Authentication → Hooks → Custom Access Token → Postgres →
--      schema public, função plt_fn_gancho_token → Ativar;
--   3. sair e entrar de novo: o token novo traz plt_id/plt_papel/… (conferir
--      no site: nada muda para a pessoa — é só o caminho).
-- Desfazer: desligar o gancho no painel (o token volta ao de antes no próximo
-- login/renovação); a função pode ficar.
-- ============================================================================

create or replace function public.plt_fn_gancho_token(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_claims  jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  v_usuario public.plt_usuarios%rowtype;
  v_setores jsonb;
begin
  select u.* into v_usuario
    from public.plt_usuarios u
   where u.auth_user_id = (event ->> 'user_id')::uuid
   limit 1;

  if v_usuario.id is null then
    -- conta do Auth sem cadastro na plataforma: token como sempre, sem acesso
    return jsonb_set(event, '{claims}', v_claims || jsonb_build_object('plt_ativo', false));
  end if;

  -- (RECUSAR) para recusar a pessoa inativa no próprio login, trocar o
  -- "plt_ativo" abaixo por:
  --   if not v_usuario.ativo then
  --     return jsonb_build_object('error', jsonb_build_object(
  --       'http_code', 403, 'message', 'Seu acesso à plataforma está desativado. Fale com o administrador.'));
  --   end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', us.setor_id, 'lider', us.lider_do_setor) order by us.setor_id), '[]'::jsonb)
    into v_setores
    from public.plt_usuario_setores us
   where us.usuario_id = v_usuario.id;

  v_claims := v_claims || jsonb_build_object(
    'plt_id',      v_usuario.id,
    'plt_papel',   v_usuario.papel,
    'plt_super',   coalesce(v_usuario.super_admin, false),
    'plt_ativo',   coalesce(v_usuario.ativo, false),
    'plt_modulos', coalesce(to_jsonb(v_usuario.modulos), '[]'::jsonb),
    'plt_setores', v_setores);

  return jsonb_set(event, '{claims}', v_claims);
end;
$$;

comment on function public.plt_fn_gancho_token(jsonb) is
  'SESSAO-32 (Lei §5): o gancho do token (Custom Access Token Hook) — põe no token o id do cadastro, o papel, super admin, ativo, módulos e setores (com liderança). Nada pessoal (D-68). Só o supabase_auth_admin executa.';

grant usage on schema public to supabase_auth_admin;
grant execute on function public.plt_fn_gancho_token(jsonb) to supabase_auth_admin;
revoke execute on function public.plt_fn_gancho_token(jsonb) from authenticated, anon, public;

-- o papel do Auth lê só o necessário (as regras de acesso de cada tabela)
grant select on public.plt_usuarios to supabase_auth_admin;
grant select on public.plt_usuario_setores to supabase_auth_admin;

drop policy if exists plt_usuarios_gancho_token on public.plt_usuarios;
create policy plt_usuarios_gancho_token on public.plt_usuarios
  as permissive for select to supabase_auth_admin using (true);

drop policy if exists plt_usuario_setores_gancho_token on public.plt_usuario_setores;
create policy plt_usuario_setores_gancho_token on public.plt_usuario_setores
  as permissive for select to supabase_auth_admin using (true);
