-- ============================================================================
-- SESSAO-41 · F3 (D-191) — "Esqueci minha senha" liberado por um administrador
-- (pedido do dono, 26–27/10/2026):
--
--   "esse botão deve enviar uma notificação para um admin, notificação de
--   urgência, um aviso na tela mesmo com um botão de liberar troca ou de não
--   liberar; se liberar troca para aquele email, a pessoa clica em trocar minha
--   senha, digita o email dela e já direto consegue trocar; se não estiver
--   liberado, aparece apenas o botão de solicitar; se o email não estiver
--   cadastrado, aparece apenas uma mensagem genérica."
--
-- Respostas do dono (27/10): quem libera = os administradores (e o super
-- admin); a liberação vale 2 h, uma troca só, SÓ no aparelho que pediu (o
-- pedido leva o resumo de um segredo que só aquele aparelho tem); a tela diz
-- sempre a mesma coisa — ninguém descobre quem tem cadastro.
--
-- Sem e-mail (a troca é liberada por gente). A tela de entrada não fala com o
-- banco: a função de login (chave de serviço) chama as portas "de serviço"
-- abaixo — fechadas para o navegador. Os administradores decidem por duas
-- portas próprias. Nada aqui altera tabela da integração.
-- ============================================================================
set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · O pedido de troca
-- ----------------------------------------------------------------------------
create table if not exists public.plt_senha_pedidos (
  id            bigint generated always as identity primary key,
  usuario_id    uuid not null references public.plt_usuarios(id) on delete cascade,
  -- o resumo (SHA-256, em base64) do segredo que só o aparelho que pediu tem
  segredo_hash  text not null,
  situacao      text not null default 'pendente'
                check (situacao in ('pendente', 'liberado', 'recusado', 'usado', 'substituido')),
  pedido_em     timestamptz not null default now(),
  decidido_por  uuid references public.plt_usuarios(id),
  decidido_em   timestamptz,
  liberado_ate  timestamptz,
  usado_em      timestamptz
);

comment on table public.plt_senha_pedidos is
  'SESSAO-41 (D-191): os pedidos de "Esqueci minha senha" — pendente → liberado (vale 2 h, uma troca, só no aparelho que pediu) ou recusado; usado ao trocar; substituído quando a pessoa pede de novo. O pendente com mais de 24 h já não aparece para decidir. Escrita só pelas portas; RLS sem regra.';

create index if not exists plt_senha_pedidos_usuario_idx on public.plt_senha_pedidos (usuario_id, id desc);
create index if not exists plt_senha_pedidos_abertos_idx on public.plt_senha_pedidos (pedido_em desc)
  where situacao in ('pendente', 'liberado');
create index if not exists plt_senha_pedidos_decidido_por_idx on public.plt_senha_pedidos (decidido_por)
  where decidido_por is not null;

alter table public.plt_senha_pedidos enable row level security;
revoke all on public.plt_senha_pedidos from anon, authenticated, public;

-- ----------------------------------------------------------------------------
-- 2 · As portas de SERVIÇO (só a função de login, com a chave de serviço)
-- ----------------------------------------------------------------------------
-- a pessoa que pode pedir: e-mail exato (minúsculo), ativa, não é conta de tablet
create or replace function plt_privado.fn_senha_pessoa(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.id
    from public.plt_usuarios u
   where lower(u.email) = lower(trim(coalesce(p_email, '')))
     and u.ativo and u.arquivado_em is null and not u.conta_tablet
     and u.auth_user_id is not null
   limit 1;
$$;

revoke all on function plt_privado.fn_senha_pessoa(text) from public, anon, authenticated;

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
begin
  if coalesce(length(p_segredo_hash), 0) < 40 then
    raise exception 'Pedido sem o segredo do aparelho.' using errcode = 'check_violation';
  end if;
  select * into v_pessoa from public.plt_usuarios where id = plt_privado.fn_senha_pessoa(p_email);
  if v_pessoa.id is null then
    return; -- e-mail sem cadastro: nada acontece (a tela diz sempre a mesma coisa)
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
  'SESSAO-41 (D-191) · SÓ a função de login (chave de serviço): registra o pedido de troca de senha (e-mail cadastrado, ativo, não tablet), substitui o aberto e avisa os administradores. E-mail sem cadastro: não faz nada.';

create or replace function public.plt_fn_senha_situacao(p_email text, p_segredo_hash text)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when exists (
           select 1 from public.plt_senha_pedidos p
            where p.usuario_id = plt_privado.fn_senha_pessoa(p_email)
              and p.segredo_hash = p_segredo_hash
              and p.situacao = 'liberado' and p.liberado_ate > now() and p.usado_em is null)
         then 'liberado' else 'nao_liberado' end;
$$;

comment on function public.plt_fn_senha_situacao(text, text) is
  'SESSAO-41 (D-191) · SÓ a função de login: "liberado" só para o aparelho que pediu (o segredo confere), dentro das 2 h e sem uso; todo o resto é "nao_liberado" (não diz se o e-mail existe).';

create or replace function public.plt_fn_senha_conferir(p_email text, p_segredo_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pedido public.plt_senha_pedidos%rowtype;
  v_auth   uuid;
begin
  select p.* into v_pedido
    from public.plt_senha_pedidos p
   where p.usuario_id = plt_privado.fn_senha_pessoa(p_email)
     and p.segredo_hash = p_segredo_hash
     and p.situacao = 'liberado' and p.liberado_ate > now() and p.usado_em is null
   for update;
  if v_pedido.id is null then
    return null;
  end if;
  select u.auth_user_id into v_auth from public.plt_usuarios u where u.id = v_pedido.usuario_id;
  return jsonb_build_object('pedido_id', v_pedido.id, 'auth_user_id', v_auth);
end;
$$;

create or replace function public.plt_fn_senha_usado(p_pedido_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
begin
  update public.plt_senha_pedidos
     set situacao = 'usado', usado_em = now()
   where id = p_pedido_id and situacao = 'liberado'
   returning usuario_id into v_usuario;
  if v_usuario is null then
    return;
  end if;
  -- quem trocou criou a própria senha (sai da senha padrão, se ainda estava)
  update public.plt_usuarios set senha_padrao = false where id = v_usuario and senha_padrao;
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_usuario, 'senha_trocada_por_pedido', jsonb_build_object('pedido_id', p_pedido_id));
end;
$$;

revoke all on function public.plt_fn_senha_solicitar(text, text) from public, anon, authenticated;
revoke all on function public.plt_fn_senha_situacao(text, text)  from public, anon, authenticated;
revoke all on function public.plt_fn_senha_conferir(text, text)  from public, anon, authenticated;
revoke all on function public.plt_fn_senha_usado(bigint)         from public, anon, authenticated;
grant execute on function public.plt_fn_senha_solicitar(text, text) to service_role;
grant execute on function public.plt_fn_senha_situacao(text, text)  to service_role;
grant execute on function public.plt_fn_senha_conferir(text, text)  to service_role;
grant execute on function public.plt_fn_senha_usado(bigint)         to service_role;

-- ----------------------------------------------------------------------------
-- 3 · As portas dos ADMINISTRADORES: ver os pedidos e decidir
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_senha_pedidos()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not plt_privado.fn_eh_admin() then
    raise exception 'Só um administrador decide a troca de senha.' using errcode = 'insufficient_privilege';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', p.id, 'situacao', p.situacao, 'pedido_em', p.pedido_em,
             'liberado_ate', p.liberado_ate, 'decidido_em', p.decidido_em,
             'decidido_por', d.nome,
             'pessoa', jsonb_build_object('id', u.id, 'nome', u.nome, 'usuario', u.usuario,
                                          'foto', u.foto_caminho, 'papel', u.papel))
           order by (p.situacao = 'pendente') desc, p.pedido_em desc)
      from (select * from public.plt_senha_pedidos s
             where (s.situacao = 'pendente' and s.pedido_em > now() - interval '24 hours')
                or (s.situacao in ('liberado', 'recusado', 'usado') and s.decidido_em > now() - interval '24 hours')
             order by s.pedido_em desc
             limit 20) p
      join public.plt_usuarios u on u.id = p.usuario_id
      left join public.plt_usuarios d on d.id = p.decidido_por), '[]'::jsonb);
end;
$$;

comment on function public.plt_fn_senha_pedidos() is
  'SESSAO-41 (D-191): para os administradores — os pedidos de troca de senha pendentes (até 24 h) e os decididos nas últimas 24 h (até 20), o pendente primeiro.';

create or replace function public.plt_fn_senha_decidir(p_pedido_id bigint, p_liberar boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu     uuid := plt_privado.fn_usuario_atual();
  v_pedido public.plt_senha_pedidos%rowtype;
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

  -- sem pedido pendente, o aviso urgente sai de todos os administradores
  if not exists (select 1 from public.plt_senha_pedidos
                  where situacao = 'pendente' and pedido_em > now() - interval '24 hours') then
    update public.plt_notificacoes set lida_em = now()
     where tipo = 'senha_pedido' and lida_em is null;
  end if;

  return jsonb_build_object('situacao', v_pedido.situacao, 'liberado_ate', v_pedido.liberado_ate, 'mudou', true);
end;
$$;

comment on function public.plt_fn_senha_decidir(bigint, boolean) is
  'SESSAO-41 (D-191): o administrador libera (por 2 h, uma troca, só no aparelho que pediu) ou não libera o pedido pendente; repetir não muda nada; sem pendentes, o aviso urgente sai de todos os administradores. Fica na trilha.';

revoke all on function public.plt_fn_senha_pedidos()                from public, anon;
revoke all on function public.plt_fn_senha_decidir(bigint, boolean) from public, anon;
grant execute on function public.plt_fn_senha_pedidos()                to authenticated;
grant execute on function public.plt_fn_senha_decidir(bigint, boolean) to authenticated;
