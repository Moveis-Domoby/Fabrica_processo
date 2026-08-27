-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 08 — RLS E PERMISSÕES
-- Sessão: SESSAO-02 · Data: 2026-08-26
--
-- Três níveis de navegação (RF-24 / D-06):
--   operador → o simples: os cards dos setores dele
--   líder    → o completo do setor onde é líder
--   admin    → tudo
--
-- A `service_role` (a chave que o n8n usa) IGNORA RLS por natureza do Postgres.
-- Por isso o que precisa valer para todo mundo — o append-only dos eventos —
-- está em trigger, não em política (migration 04).
--
-- O mecanismo de login em si é a SESSAO-03. Aqui fica o desenho do acesso.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · Funções de apoio — em schema PRIVADO, fora da API REST
--
-- O Supabase publica `public` inteiro como API. Estas funções são maquinaria
-- de política de acesso, não endpoint: por isso vivem em `plt_privado`, que
-- não é publicado. `authenticated` recebe permissão de execução porque as
-- políticas rodam com os privilégios de quem consulta.
--
-- São `security definer` para conseguirem ler plt_usuarios sem cair na própria
-- política — senão a política que pergunta "quem é você?" precisaria de outra
-- política para responder, e isso não terminaria nunca.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_usuario_atual()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id
    from public.plt_usuarios u
   where u.auth_user_id = auth.uid()
     and u.ativo
   limit 1;
$$;

comment on function plt_privado.fn_usuario_atual() is
  'Traduz o usuário do Supabase Auth para a pessoa da plataforma. NULL para quem não tem login próprio.';

create or replace function plt_privado.fn_eh_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select u.papel = 'admin' from public.plt_usuarios u
      where u.auth_user_id = auth.uid() and u.ativo limit 1),
    false
  );
$$;

create or replace function plt_privado.fn_setores_do_usuario()
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
     and u.ativo;
$$;

comment on function plt_privado.fn_setores_do_usuario() is
  'Setores em que a pessoa trabalha. Base do "operador vê a fila do seu setor" (RF-22).';

create or replace function plt_privado.fn_eh_lider_de(p_setor_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select us.lider_do_setor
       from public.plt_usuario_setores us
       join public.plt_usuarios u on u.id = us.usuario_id
      where u.auth_user_id = auth.uid()
        and u.ativo
        and us.setor_id = p_setor_id
      limit 1),
    false
  );
$$;

-- ----------------------------------------------------------------------------
-- 2 · Ligar RLS em tudo que é da plataforma
-- ----------------------------------------------------------------------------
alter table public.plt_usuarios         enable row level security;
alter table public.plt_usuario_setores  enable row level security;
alter table public.plt_setores          enable row level security;
alter table public.plt_etapas           enable row level security;
alter table public.plt_cards            enable row level security;
alter table public.plt_eventos          enable row level security;
alter table public.plt_notificacoes     enable row level security;
alter table public.plt_tarefas          enable row level security;
alter table public.plt_visualizacoes    enable row level security;

-- O hash do PIN não é assunto de ninguém além do servidor.
revoke select (pin_hash) on public.plt_usuarios from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3 · Pessoas
-- Nome de colega é informação de trabalho: todo mundo autenticado lê.
-- Mexer em cadastro é do admin (RF-20).
-- ----------------------------------------------------------------------------
drop policy if exists plt_usuarios_leitura on public.plt_usuarios;
create policy plt_usuarios_leitura on public.plt_usuarios
  for select to authenticated
  using (true);

drop policy if exists plt_usuarios_admin_escreve on public.plt_usuarios;
create policy plt_usuarios_admin_escreve on public.plt_usuarios
  for all to authenticated
  using (plt_privado.fn_eh_admin())
  with check (plt_privado.fn_eh_admin());

drop policy if exists plt_usuarios_edita_a_si on public.plt_usuarios;
create policy plt_usuarios_edita_a_si on public.plt_usuarios
  for update to authenticated
  using (id = plt_privado.fn_usuario_atual())
  with check (id = plt_privado.fn_usuario_atual());

drop policy if exists plt_usuario_setores_leitura on public.plt_usuario_setores;
create policy plt_usuario_setores_leitura on public.plt_usuario_setores
  for select to authenticated
  using (true);

drop policy if exists plt_usuario_setores_gestao on public.plt_usuario_setores;
create policy plt_usuario_setores_gestao on public.plt_usuario_setores
  for all to authenticated
  using (plt_privado.fn_eh_admin() or plt_privado.fn_eh_lider_de(setor_id))
  with check (plt_privado.fn_eh_admin() or plt_privado.fn_eh_lider_de(setor_id));

-- ----------------------------------------------------------------------------
-- 4 · Estrutura — todo mundo lê, só o admin cadastra (RF-07)
-- ----------------------------------------------------------------------------
drop policy if exists plt_setores_leitura on public.plt_setores;
create policy plt_setores_leitura on public.plt_setores
  for select to authenticated
  using (true);

drop policy if exists plt_setores_admin on public.plt_setores;
create policy plt_setores_admin on public.plt_setores
  for all to authenticated
  using (plt_privado.fn_eh_admin())
  with check (plt_privado.fn_eh_admin());

drop policy if exists plt_etapas_leitura on public.plt_etapas;
create policy plt_etapas_leitura on public.plt_etapas
  for select to authenticated
  using (true);

-- Líder cadastra as etapas do PRÓPRIO setor; admin, de qualquer um.
drop policy if exists plt_etapas_gestao on public.plt_etapas;
create policy plt_etapas_gestao on public.plt_etapas
  for all to authenticated
  using (plt_privado.fn_eh_admin() or plt_privado.fn_eh_lider_de(setor_id))
  with check (plt_privado.fn_eh_admin() or plt_privado.fn_eh_lider_de(setor_id));

-- ----------------------------------------------------------------------------
-- 5 · Cards
-- Operador enxerga o que está nos setores dele, mais o que ele mesmo executa.
-- Ninguém faz UPDATE de posição à mão: posição é projeção de evento.
-- ----------------------------------------------------------------------------
drop policy if exists plt_cards_leitura on public.plt_cards;
create policy plt_cards_leitura on public.plt_cards
  for select to authenticated
  using (
    plt_privado.fn_eh_admin()
    or setor_atual_id in (select plt_privado.fn_setores_do_usuario())
    or executor_atual_id = plt_privado.fn_usuario_atual()
  );

drop policy if exists plt_cards_criacao on public.plt_cards;
create policy plt_cards_criacao on public.plt_cards
  for insert to authenticated
  with check (
    plt_privado.fn_eh_admin()
    or setor_atual_id in (select plt_privado.fn_setores_do_usuario())
  );

drop policy if exists plt_cards_admin_ajusta on public.plt_cards;
create policy plt_cards_admin_ajusta on public.plt_cards
  for update to authenticated
  using (plt_privado.fn_eh_admin())
  with check (plt_privado.fn_eh_admin());

-- ----------------------------------------------------------------------------
-- 6 · Eventos — lê quem vê o card; escreve quem trabalha nele.
-- NÃO existe política de UPDATE nem de DELETE, de propósito (RNF-05).
-- ----------------------------------------------------------------------------
drop policy if exists plt_eventos_leitura on public.plt_eventos;
create policy plt_eventos_leitura on public.plt_eventos
  for select to authenticated
  using (
    plt_privado.fn_eh_admin()
    or exists (
      select 1 from public.plt_cards c
       where c.id = plt_eventos.card_id
         and (c.setor_atual_id in (select plt_privado.fn_setores_do_usuario())
              or c.executor_atual_id = plt_privado.fn_usuario_atual())
    )
    or setor_origem_id in (select plt_privado.fn_setores_do_usuario())
    or setor_destino_id in (select plt_privado.fn_setores_do_usuario())
  );

drop policy if exists plt_eventos_registro on public.plt_eventos;
create policy plt_eventos_registro on public.plt_eventos
  for insert to authenticated
  with check (
    plt_privado.fn_usuario_atual() is not null
    and (
      plt_privado.fn_eh_admin()
      or setor_origem_id in (select plt_privado.fn_setores_do_usuario())
      or setor_destino_id in (select plt_privado.fn_setores_do_usuario())
    )
  );

-- ----------------------------------------------------------------------------
-- 7 · Notificações — cada um lê e marca como lida só as suas.
-- ----------------------------------------------------------------------------
drop policy if exists plt_notificacoes_proprias on public.plt_notificacoes;
create policy plt_notificacoes_proprias on public.plt_notificacoes
  for select to authenticated
  using (destinatario_id = plt_privado.fn_usuario_atual() or plt_privado.fn_eh_admin());

drop policy if exists plt_notificacoes_marcar_lida on public.plt_notificacoes;
create policy plt_notificacoes_marcar_lida on public.plt_notificacoes
  for update to authenticated
  using (destinatario_id = plt_privado.fn_usuario_atual())
  with check (destinatario_id = plt_privado.fn_usuario_atual());

-- ----------------------------------------------------------------------------
-- 8 · Tarefas — vê o que é seu, o do seu setor, ou tudo se for admin.
-- ----------------------------------------------------------------------------
drop policy if exists plt_tarefas_leitura on public.plt_tarefas;
create policy plt_tarefas_leitura on public.plt_tarefas
  for select to authenticated
  using (
    plt_privado.fn_eh_admin()
    or responsavel_id = plt_privado.fn_usuario_atual()
    or criada_por_id = plt_privado.fn_usuario_atual()
    or setor_id in (select plt_privado.fn_setores_do_usuario())
  );

drop policy if exists plt_tarefas_criacao on public.plt_tarefas;
create policy plt_tarefas_criacao on public.plt_tarefas
  for insert to authenticated
  with check (
    plt_privado.fn_eh_admin()
    or plt_privado.fn_eh_lider_de(setor_id)
    or criada_por_id = plt_privado.fn_usuario_atual()
  );

drop policy if exists plt_tarefas_atualizacao on public.plt_tarefas;
create policy plt_tarefas_atualizacao on public.plt_tarefas
  for update to authenticated
  using (
    plt_privado.fn_eh_admin()
    or responsavel_id = plt_privado.fn_usuario_atual()
    or plt_privado.fn_eh_lider_de(setor_id)
  )
  with check (
    plt_privado.fn_eh_admin()
    or responsavel_id = plt_privado.fn_usuario_atual()
    or plt_privado.fn_eh_lider_de(setor_id)
  );

-- ----------------------------------------------------------------------------
-- 9 · Visualizações salvas — as suas, as do seu setor e as globais.
-- ----------------------------------------------------------------------------
drop policy if exists plt_visualizacoes_leitura on public.plt_visualizacoes;
create policy plt_visualizacoes_leitura on public.plt_visualizacoes
  for select to authenticated
  using (
    plt_privado.fn_eh_admin()
    or usuario_id = plt_privado.fn_usuario_atual()
    or escopo = 'global'
    or (escopo = 'setor' and setor_id in (select plt_privado.fn_setores_do_usuario()))
  );

drop policy if exists plt_visualizacoes_proprias on public.plt_visualizacoes;
create policy plt_visualizacoes_proprias on public.plt_visualizacoes
  for all to authenticated
  using (plt_privado.fn_eh_admin() or usuario_id = plt_privado.fn_usuario_atual())
  with check (plt_privado.fn_eh_admin() or usuario_id = plt_privado.fn_usuario_atual());

-- ----------------------------------------------------------------------------
-- 10 · Quem pode executar a maquinaria
--
-- `authenticated` precisa executar as funções de apoio (as políticas rodam com
-- os privilégios de quem consulta). `anon` e o público geral, não.
-- As funções de trigger não precisam de permissão nenhuma em tempo de execução
-- — o Postgres só confere isso na criação da trigger.
-- ----------------------------------------------------------------------------
revoke all on function plt_privado.fn_usuario_atual()        from public, anon;
revoke all on function plt_privado.fn_eh_admin()             from public, anon;
revoke all on function plt_privado.fn_setores_do_usuario()   from public, anon;
revoke all on function plt_privado.fn_eh_lider_de(bigint)    from public, anon;

grant execute on function plt_privado.fn_usuario_atual()      to authenticated;
grant execute on function plt_privado.fn_eh_admin()           to authenticated;
grant execute on function plt_privado.fn_setores_do_usuario() to authenticated;
grant execute on function plt_privado.fn_eh_lider_de(bigint)  to authenticated;

revoke all on function plt_privado.fn_marcar_atualizacao() from public, anon, authenticated;
revoke all on function plt_privado.fn_evento_imutavel()    from public, anon, authenticated;
revoke all on function plt_privado.fn_projetar_posicao()   from public, anon, authenticated;
