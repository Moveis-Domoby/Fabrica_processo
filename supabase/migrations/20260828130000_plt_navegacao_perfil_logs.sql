-- ============================================================================
-- SESSAO-13 · Navegação, Perfil e Identidade — migration 22
--
-- 1 · Tema e foto no Meu Perfil (a escolha persiste por usuário; a foto é a
--     própria pessoa que sobe)
-- 2 · Registro de atividade: TODA atividade de usuário gera log no banco,
--     append-only — cobre navegação (via RPC) e toda mutação (via triggers)
-- 3 · Política de storage para a foto de perfil (pasta própria no bucket)
--
-- Nada aqui toca as tabelas da integração (clientes, pedidos, pedido_itens,
-- eventos, gp_pcp_processados).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · plt_usuarios: tema da plataforma + foto de perfil
-- O `add column if not exists` cala colisão com sessões paralelas; por isso
-- default e check são (re)aplicados explicitamente logo em seguida, sempre.
-- ----------------------------------------------------------------------------
alter table public.plt_usuarios add column if not exists tema         text;
alter table public.plt_usuarios add column if not exists foto_caminho text;

alter table public.plt_usuarios alter column tema set default 'claro';
update public.plt_usuarios set tema = 'claro' where tema is null;
alter table public.plt_usuarios alter column tema set not null;

alter table public.plt_usuarios drop constraint if exists plt_usuarios_tema_ck;
alter table public.plt_usuarios add constraint plt_usuarios_tema_ck check (
  tema in ('claro', 'gelo', 'areia', 'dourado', 'ardosia', 'grafite', 'escuro', 'meia-noite')
);

comment on column public.plt_usuarios.tema is
  'Tema visual escolhido no Meu Perfil: 8 esquemas do claro ao escuro, todos amarelo × grafite. Aplica na hora e persiste por usuário.';
comment on column public.plt_usuarios.foto_caminho is
  'Caminho da foto de perfil no bucket plt-imagens (perfis/{id}/…). A própria pessoa sobe a sua; admin troca a de qualquer um.';

-- O navegador já podia editar a própria linha (policy edita_a_si); as colunas
-- liberadas ganham as duas novas. Usuário/e-mail continuam só pela Edge
-- Function (mexem também na conta de auth).
grant update (tema, foto_caminho) on public.plt_usuarios to authenticated;

-- ----------------------------------------------------------------------------
-- 2 · Registro de atividade — quem, quando, o quê, onde. Append-only como os
-- eventos: corrigir é registrar de novo, nunca editar.
-- ----------------------------------------------------------------------------
create table if not exists public.plt_logs_atividade (
  id          bigint generated always as identity primary key,
  usuario_id  uuid references public.plt_usuarios(id),
  acao        text not null,
  rota        text,
  contexto    jsonb not null default '{}'::jsonb,
  criado_em   timestamptz not null default now()
);

comment on table public.plt_logs_atividade is
  'Trilha de auditoria de toda atividade de usuário. APPEND-ONLY por trigger. usuario_id NULL = ação de automação/API sem pessoa.';
comment on column public.plt_logs_atividade.acao is
  'O que aconteceu, em uma palavra-chave (entrou, navegacao, tema_alterado, tipos de evento do kanban…).';
comment on column public.plt_logs_atividade.contexto is
  'Detalhe da ação: ids envolvidos, campos alterados (nunca valores sensíveis).';

create index if not exists plt_logs_atividade_usuario_idx
  on public.plt_logs_atividade (usuario_id, criado_em desc);
create index if not exists plt_logs_atividade_criado_idx
  on public.plt_logs_atividade (criado_em desc);
create index if not exists plt_logs_atividade_acao_idx
  on public.plt_logs_atividade (acao, criado_em desc);

-- Append-only garantido por trigger (vale até para a service_role — M-14).
create or replace function plt_privado.fn_log_imutavel()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'O registro de atividade não pode ser alterado nem apagado — ele é a trilha de auditoria. Correção é um registro novo.';
end;
$$;

drop trigger if exists plt_logs_atividade_imutavel on public.plt_logs_atividade;
create trigger plt_logs_atividade_imutavel
  before update or delete on public.plt_logs_atividade
  for each row execute function plt_privado.fn_log_imutavel();

-- RLS: cada um lê os próprios registros; admin lê tudo (a consulta completa de
-- admin vem em sessão futura). Insere-se apenas em nome próprio; UPDATE/DELETE
-- não têm policy nenhuma (e o trigger barra até quem ignora RLS).
alter table public.plt_logs_atividade enable row level security;

drop policy if exists plt_logs_atividade_leitura on public.plt_logs_atividade;
create policy plt_logs_atividade_leitura on public.plt_logs_atividade
  for select to authenticated
  using (plt_privado.fn_eh_admin() or usuario_id = plt_privado.fn_usuario_atual());

drop policy if exists plt_logs_atividade_grava_proprio on public.plt_logs_atividade;
create policy plt_logs_atividade_grava_proprio on public.plt_logs_atividade
  for insert to authenticated
  with check (usuario_id = plt_privado.fn_usuario_atual());

-- ----------------------------------------------------------------------------
-- 2a · Toda mutação que passa por evento vira log sozinha. plt_eventos já é a
-- verdade do kanban (movimentação, execução, qualidade, delegação…) — copiar a
-- essência para a trilha cobre tudo de uma vez, sem mexer em nenhuma RPC.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_logar_evento()
returns trigger
security definer
language plpgsql
set search_path = public, pg_temp
as $$
begin
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
  values (
    new.usuario_id,
    new.tipo,
    jsonb_strip_nulls(jsonb_build_object(
      'evento_id',        new.id,
      'card_id',          new.card_id,
      'origem',           new.origem,
      'setor_origem_id',  new.setor_origem_id,
      'setor_destino_id', new.setor_destino_id,
      'etapa_origem_id',  new.etapa_origem_id,
      'etapa_destino_id', new.etapa_destino_id,
      'estado_qualidade', new.estado_qualidade
    ))
  );
  return null;
end;
$$;

drop trigger if exists plt_eventos_logar on public.plt_eventos;
create trigger plt_eventos_logar
  after insert on public.plt_eventos
  for each row execute function plt_privado.fn_logar_evento();

-- ----------------------------------------------------------------------------
-- 2b · Tarefas avulsas (não passam por plt_eventos): criada, iniciada,
-- concluída — o gesto vira log com o autor da vez.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_logar_tarefa()
returns trigger
security definer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_acao text;
begin
  if tg_op = 'INSERT' then
    v_acao := 'tarefa_criada';
  elsif new.situacao = 'concluida' and old.situacao is distinct from 'concluida' then
    v_acao := 'tarefa_concluida';
  elsif new.iniciada_em is not null and old.iniciada_em is null then
    v_acao := 'tarefa_iniciada';
  elsif new.responsavel_id is distinct from old.responsavel_id then
    v_acao := 'tarefa_reatribuida';
  else
    v_acao := 'tarefa_atualizada';
  end if;

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
  values (
    plt_privado.fn_usuario_atual(),
    v_acao,
    jsonb_strip_nulls(jsonb_build_object(
      'tarefa_id',      new.id,
      'setor_id',       new.setor_id,
      'responsavel_id', new.responsavel_id
    ))
  );
  return null;
end;
$$;

drop trigger if exists plt_tarefas_logar on public.plt_tarefas;
create trigger plt_tarefas_logar
  after insert or update on public.plt_tarefas
  for each row execute function plt_privado.fn_logar_tarefa();

-- ----------------------------------------------------------------------------
-- 2c · Cadastro de pessoa alterado: registra QUAIS campos mudaram, nunca os
-- valores (senha, PIN e CPF não são assunto de log). Autor: quem está na
-- sessão; alterações vindas do servidor (Edge Function) ficam no id da própria
-- linha quando não há sessão — é a pessoa dona do cadastro.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_logar_usuario()
returns trigger
security definer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_campos text[] := '{}';
begin
  if new.nome         is distinct from old.nome         then v_campos := array_append(v_campos, 'nome'); end if;
  if new.usuario      is distinct from old.usuario      then v_campos := array_append(v_campos, 'usuario'); end if;
  if new.email        is distinct from old.email        then v_campos := array_append(v_campos, 'email'); end if;
  if new.telefone     is distinct from old.telefone     then v_campos := array_append(v_campos, 'telefone'); end if;
  if new.tema         is distinct from old.tema         then v_campos := array_append(v_campos, 'tema'); end if;
  if new.foto_caminho is distinct from old.foto_caminho then v_campos := array_append(v_campos, 'foto'); end if;
  if new.papel        is distinct from old.papel        then v_campos := array_append(v_campos, 'papel'); end if;
  if new.ativo        is distinct from old.ativo        then v_campos := array_append(v_campos, 'ativo'); end if;
  if new.pin_hash     is distinct from old.pin_hash     then v_campos := array_append(v_campos, 'pin'); end if;

  -- Nada relevante mudou (ex.: senha_padrao/convite no fluxo do 1º login).
  if array_length(v_campos, 1) is null then
    return null;
  end if;

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
  values (
    coalesce(plt_privado.fn_usuario_atual(), new.id),
    case when array['tema'] = v_campos then 'tema_alterado' else 'perfil_atualizado' end,
    jsonb_build_object('alvo_id', new.id, 'campos', to_jsonb(v_campos))
  );
  return null;
end;
$$;

drop trigger if exists plt_usuarios_logar on public.plt_usuarios;
create trigger plt_usuarios_logar
  after update on public.plt_usuarios
  for each row execute function plt_privado.fn_logar_usuario();

-- ----------------------------------------------------------------------------
-- 2d · Porta de registro para o navegador: navegação entre telas e gestos que
-- não tocam tabela nenhuma. Endpoint de propósito (mesmo padrão das plt_fn_*):
-- gate por usuário ativo, tamanho limitado, sempre em nome próprio.
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_registrar_log(
  p_acao     text,
  p_rota     text default null,
  p_contexto jsonb default '{}'::jsonb
)
returns void
security definer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid := plt_privado.fn_usuario_atual();
begin
  if v_usuario is null then
    raise exception 'Sessão sem cadastro ativo na plataforma — nada foi registrado.';
  end if;
  if p_acao is null or length(trim(p_acao)) = 0 or length(p_acao) > 80 then
    raise exception 'Informe a ação do registro (até 80 caracteres).';
  end if;
  if p_rota is not null and length(p_rota) > 300 then
    raise exception 'Rota longa demais para o registro.';
  end if;
  if pg_column_size(coalesce(p_contexto, '{}'::jsonb)) > 8192 then
    raise exception 'Contexto grande demais para o registro.';
  end if;

  insert into public.plt_logs_atividade (usuario_id, acao, rota, contexto)
  values (v_usuario, trim(p_acao), p_rota, coalesce(p_contexto, '{}'::jsonb));
end;
$$;

comment on function public.plt_fn_registrar_log(text, text, jsonb) is
  'Registro de atividade vindo do navegador (navegação entre telas etc.). Sempre em nome do usuário da sessão.';

revoke execute on function public.plt_fn_registrar_log(text, text, jsonb) from public, anon;
grant execute on function public.plt_fn_registrar_log(text, text, jsonb) to authenticated;

-- ----------------------------------------------------------------------------
-- 3 · Foto de perfil no bucket plt-imagens: a própria pessoa escreve na SUA
-- pasta (perfis/{id}/…). Admin/líder já escreviam no bucket inteiro pela
-- policy da SESSAO-07. Guardado: o Postgres dos testes não tem schema storage.
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    begin
      execute $pol$drop policy if exists plt_imagens_perfil_proprio on storage.objects$pol$;
      execute $pol$
        create policy plt_imagens_perfil_proprio on storage.objects
          for insert to authenticated
          with check (
            bucket_id = 'plt-imagens'
            and (storage.foldername(name))[1] = 'perfis'
            and (storage.foldername(name))[2] = plt_privado.fn_usuario_atual()::text
          )
      $pol$;

      execute $pol$drop policy if exists plt_imagens_perfil_proprio_troca on storage.objects$pol$;
      execute $pol$
        create policy plt_imagens_perfil_proprio_troca on storage.objects
          for update to authenticated
          using (
            bucket_id = 'plt-imagens'
            and (storage.foldername(name))[1] = 'perfis'
            and (storage.foldername(name))[2] = plt_privado.fn_usuario_atual()::text
          )
      $pol$;

      execute $pol$drop policy if exists plt_imagens_perfil_proprio_remocao on storage.objects$pol$;
      execute $pol$
        create policy plt_imagens_perfil_proprio_remocao on storage.objects
          for delete to authenticated
          using (
            bucket_id = 'plt-imagens'
            and (storage.foldername(name))[1] = 'perfis'
            and (storage.foldername(name))[2] = plt_privado.fn_usuario_atual()::text
          )
      $pol$;
    exception when insufficient_privilege then
      raise notice 'storage: sem privilégio para policies — criar pelo painel (documentado no handoff).';
    end;
  end if;
end;
$$;
