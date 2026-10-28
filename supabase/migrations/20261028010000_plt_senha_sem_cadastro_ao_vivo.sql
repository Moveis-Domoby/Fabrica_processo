-- ============================================================================
-- Ajuste de 28/10/2026 (D-200) — o pedido de troca de senha que "não chegava"
--
-- O caso (registros do servidor, 27/10 ~17:50 de Natal): o 1º pedido foi feito
-- com o e-mail digitado errado ("@gmai.com"). Pela D-191 a tela diz sempre a
-- mesma coisa e o e-mail sem cadastro "não faz nada" — então ninguém soube. A
-- pessoa pediu de novo com o e-mail certo quando o administrador tinha saído;
-- ao entrar, o aviso abriu na hora. Parecia que só chegava saindo e entrando.
--
-- Resposta do dono (28/10): corrigir dos dois lados —
--   1. (tela) quem pede vê a sugestão do e-mail certo quando há erro comum;
--   2. (aqui) o pedido para e-mail SEM cadastro ativo avisa os administradores
--      no sino, na hora ("confira com a pessoa") — quem pediu continua vendo a
--      mesma mensagem de sempre (a D-191 segue: ninguém descobre quem tem
--      cadastro); o mesmo e-mail ainda não lido não repete o aviso;
--   3. (aqui) quando um administrador decide, o aviso some NA HORA das outras
--      telas abertas (dos outros administradores e das outras abas): o sinal
--      'senha_decidida' no canal pessoal de cada administrador.
--
-- Recriadas por inteiro a partir da migration 20261027020000 — só o que está
-- marcado com D-200 mudou. Nenhuma tabela nova; nada da integração.
-- ============================================================================
set local lock_timeout = '5s';

create or replace function public.plt_fn_senha_solicitar(p_email text, p_segredo_hash text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pessoa public.plt_usuarios%rowtype;
  v_id     bigint;
  v_admin  record;
  v_email  text;
  v_corpo  text;
begin
  if coalesce(length(p_segredo_hash), 0) < 40 then
    raise exception 'Pedido sem o segredo do aparelho.' using errcode = 'check_violation';
  end if;
  select * into v_pessoa from public.plt_usuarios where id = plt_privado.fn_senha_pessoa(p_email);
  if v_pessoa.id is null then
    -- D-200: e-mail sem cadastro ativo — a tela de quem pediu diz a mesma coisa
    -- de sempre (D-191); os administradores ficam sabendo, para conferir com a
    -- pessoa se ela digitou certo. O mesmo e-mail ainda não lido não repete.
    v_email := left(lower(trim(coalesce(p_email, ''))), 254);
    if v_email = '' then
      return;
    end if;
    v_corpo := 'Alguém pediu a troca de senha com o e-mail ' || v_email
               || ', que não tem cadastro ativo na plataforma. Se for alguém da equipe, '
               || 'confira com a pessoa se o e-mail foi digitado certo.';
    for v_admin in
      select u.id from public.plt_usuarios u
       where u.papel = 'admin' and u.ativo and u.arquivado_em is null and not u.conta_tablet
    loop
      if not exists (select 1 from public.plt_notificacoes n
                      where n.destinatario_id = v_admin.id and n.lida_em is null
                        and n.tipo = 'senha_sem_cadastro' and n.corpo = v_corpo) then
        insert into public.plt_notificacoes (destinatario_id, tipo, titulo, corpo)
          values (v_admin.id, 'senha_sem_cadastro', 'Troca de senha: e-mail sem cadastro', v_corpo);
      end if;
    end loop;
    return;
  end if;

  -- pedir de novo SUBSTITUI o que estava aberto — inclusive o já liberado: um
  -- aparelho novo nunca herda a liberação de outro (precisa de outra decisão)
  update public.plt_senha_pedidos
     set situacao = 'substituido'
   where usuario_id = v_pessoa.id and situacao in ('pendente', 'liberado');

  insert into public.plt_senha_pedidos (usuario_id, segredo_hash)
    values (v_pessoa.id, p_segredo_hash)
    returning id into v_id;

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_pessoa.id, 'senha_pedido', jsonb_build_object('pedido_id', v_id));

  -- o aviso urgente a cada administrador (o sino e o aviso na tela)
  for v_admin in
    select u.id from public.plt_usuarios u
     where u.papel = 'admin' and u.ativo and u.arquivado_em is null and not u.conta_tablet
  loop
    insert into public.plt_notificacoes (destinatario_id, tipo, titulo, corpo)
      values (v_admin.id, 'senha_pedido', 'Pedido urgente: troca de senha',
              v_pessoa.nome || ' (' || coalesce(v_pessoa.usuario, v_pessoa.email) || ') pediu para trocar a senha. '
              || 'Libere só se tiver certeza de que foi a própria pessoa — confirme com ela.');
  end loop;
end;
$$;

comment on function public.plt_fn_senha_solicitar(text, text) is
  'SESSAO-41 (D-191) · SÓ a função de login (chave de serviço): registra o pedido de troca de senha (e-mail cadastrado, ativo, não tablet), substitui o aberto e avisa os administradores. ↪️ D-200 (28/10): e-mail sem cadastro ativo avisa os administradores no sino ("confira com a pessoa"), sem repetir o mesmo e-mail ainda não lido — a tela de quem pediu não muda.';

create or replace function public.plt_fn_senha_decidir(p_pedido_id bigint, p_liberar boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu     uuid := plt_privado.fn_usuario_atual();
  v_pedido public.plt_senha_pedidos%rowtype;
  v_admins uuid[];
  v_admin  uuid;
  v_sem_pendentes boolean;
begin
  if v_eu is null or not plt_privado.fn_eh_admin() then
    raise exception 'Só um administrador decide a troca de senha.' using errcode = 'insufficient_privilege';
  end if;
  if p_liberar is null then
    raise exception 'Diga se libera ou não.' using errcode = 'check_violation';
  end if;
  select * into v_pedido from public.plt_senha_pedidos where id = p_pedido_id for update;
  if v_pedido.id is null then
    raise exception 'Pedido não encontrado.' using errcode = 'no_data_found';
  end if;
  if v_pedido.situacao <> 'pendente' or v_pedido.pedido_em <= now() - interval '24 hours' then
    -- o toque repetido (ou outro admin que decidiu antes) não muda nada
    return jsonb_build_object('situacao', v_pedido.situacao, 'liberado_ate', v_pedido.liberado_ate, 'mudou', false);
  end if;

  update public.plt_senha_pedidos
     set situacao = case when p_liberar then 'liberado' else 'recusado' end,
         decidido_por = v_eu, decidido_em = now(),
         liberado_ate = case when p_liberar then now() + interval '2 hours' end
   where id = p_pedido_id
   returning * into v_pedido;

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_eu, case when p_liberar then 'senha_pedido_liberado' else 'senha_pedido_recusado' end,
            jsonb_build_object('pedido_id', p_pedido_id, 'pessoa_id', v_pedido.usuario_id));

  select coalesce(array_agg(u.id), '{}') into v_admins
    from public.plt_usuarios u
   where u.papel = 'admin' and u.ativo and u.arquivado_em is null and not u.conta_tablet;

  -- sem pedido pendente, o aviso urgente sai de todos os administradores
  -- (D-200: pela caixa de cada um — o índice dos não lidos)
  v_sem_pendentes := not exists (select 1 from public.plt_senha_pedidos
                                  where situacao = 'pendente' and pedido_em > now() - interval '24 hours');
  if v_sem_pendentes then
    update public.plt_notificacoes set lida_em = now()
     where destinatario_id = any (v_admins) and lida_em is null and tipo = 'senha_pedido';
  end if;

  -- D-200: as outras telas abertas ficam sabendo na hora (o aviso some, a lista relê)
  foreach v_admin in array v_admins loop
    perform plt_privado.fn_chat_sinal(v_admin, 'senha_decidida',
      jsonb_build_object('pedido_id', p_pedido_id, 'situacao', v_pedido.situacao,
                         'sem_pendentes', v_sem_pendentes, 'lida_em', now()));
  end loop;

  return jsonb_build_object('situacao', v_pedido.situacao, 'liberado_ate', v_pedido.liberado_ate, 'mudou', true);
end;
$$;

comment on function public.plt_fn_senha_decidir(bigint, boolean) is
  'SESSAO-41 (D-191): o administrador libera (por 2 h, uma troca, só no aparelho que pediu) ou não libera o pedido pendente; repetir não muda nada; sem pendentes, o aviso urgente sai de todos os administradores. Fica na trilha. ↪️ D-200 (28/10): o sinal senha_decidida no canal de cada administrador — as outras telas abertas tiram o aviso e releem a lista na hora.';

revoke all on function public.plt_fn_senha_solicitar(text, text) from public, anon, authenticated;
grant execute on function public.plt_fn_senha_solicitar(text, text) to service_role;
revoke all on function public.plt_fn_senha_decidir(bigint, boolean) from public, anon;
grant execute on function public.plt_fn_senha_decidir(bigint, boolean) to authenticated;
