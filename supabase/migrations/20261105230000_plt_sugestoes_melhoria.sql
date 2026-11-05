-- ============================================================================
-- SESSAO-46 · Tech → Sugestão de melhoria (D-260…D-266)
--
-- Qualquer pessoa sugere (bolinha em toda tela, fora do /tablet): arquivo
-- obrigatório, tipo (bug / melhoria / novidade), texto de 30+ letras e o nível
-- de necessidade de 1 a 10. A sugestão cai em "Solicitações" e anda num quadro
-- que todos acompanham — Solicitações · Backlog · Fazendo · Finalizada ·
-- Recusada —, e SÓ o super admin move (resposta 1 do dono). Ao chegar em
-- Finalizada, quem sugeriu recebe o aviso "pronta para testar" e a pendência
-- no Meu painel; em Recusada, o aviso com o motivo (obrigatório — resposta 2).
-- Testou: aprova, ou devolve com uma sugestão nova ligada à anterior (o
-- formulário inteiro de novo — resposta 3).
--
--   · plt_sugestoes        — a sugestão (o que a tela lê: projeção — M-13);
--   · plt_sugestao_fatos   — o que aconteceu com ela (APPEND-ONLY — RNF-05);
--     o gatilho dos fatos mantém a projeção, a pendência e os avisos (M-01);
--   · armário privado 'plt-sugestoes' — os arquivos (até 50 MB, qualquer
--     formato), na pasta de quem envia; todos os logados leem;
--   · 'plt-aviso:sugestoes' — o quadro ao vivo por websocket (Lei §4);
--   · portas: plt_fn_sugestao_criar / _mover / _aprovar / _detalhe e
--     plt_fn_sugestoes_quadro (cursor por coluna — Lei §6).
--
-- 100% aditiva: não recria função nem visão de ninguém (a SESSAO-43 corre em
-- paralelo). A pendência de teste é uma tarefa do Sistema da própria pessoa
-- (já vem na abertura do app e fica ao vivo pelo canal dela).
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · A sugestão (projeção)
-- ----------------------------------------------------------------------------
create table if not exists public.plt_sugestoes (
  id                bigint generated always as identity primary key,
  autor_id          uuid not null references public.plt_usuarios(id),
  tipo              text not null,
  texto             text not null,
  nivel             smallint not null,
  anexos            jsonb not null default '[]'::jsonb,
  coluna            text not null default 'solicitacoes',
  movida_em         timestamptz not null default now(),
  motivo_recusa     text,
  teste             text,
  testada_em        timestamptz,
  origem_id         bigint references public.plt_sugestoes(id),
  devolvida_para_id bigint references public.plt_sugestoes(id),
  tarefa_id         bigint references public.plt_tarefas(id) on delete set null,
  chave             text,
  criada_em         timestamptz not null default now(),
  constraint plt_sugestoes_tipo_ck check (tipo in ('bug', 'melhoria', 'novidade')),
  constraint plt_sugestoes_texto_ck check (char_length(btrim(texto)) between 30 and 4000),
  constraint plt_sugestoes_nivel_ck check (nivel between 1 and 10),
  constraint plt_sugestoes_coluna_ck
    check (coluna in ('solicitacoes', 'backlog', 'fazendo', 'finalizada', 'recusada')),
  constraint plt_sugestoes_teste_ck check (teste is null or teste in ('aguardando', 'aprovada', 'devolvida')),
  constraint plt_sugestoes_anexos_ck
    check (jsonb_typeof(anexos) = 'array' and jsonb_array_length(anexos) between 1 and 10),
  constraint plt_sugestoes_chave_ck check (chave is null or char_length(chave) between 8 and 80)
);

comment on table public.plt_sugestoes is
  'SESSAO-46 (D-260): sugestões de melhoria (Tech). PROJEÇÃO — a coluna, o teste e a recusa são escritos SÓ pelo gatilho dos fatos (plt_sugestao_fatos). Fechada à API: só as portas plt_fn_sugest*.';
comment on column public.plt_sugestoes.tipo is 'bug | melhoria | novidade ("implementação nova" na tela).';
comment on column public.plt_sugestoes.nivel is 'Nível de necessidade, 1 (pode esperar) a 10 (urgente) — escolhido por quem sugere.';
comment on column public.plt_sugestoes.anexos is
  'Os arquivos no armário plt-sugestoes: [{caminho, nome, mime, tamanho, duracao_s}] — de 1 a 10; nunca mudam depois do envio.';
comment on column public.plt_sugestoes.coluna is
  'solicitacoes (a fila — toda sugestão nasce aqui) | backlog | fazendo | finalizada | recusada. Só o super admin move (D-261).';
comment on column public.plt_sugestoes.teste is
  'Em Finalizada: aguardando (quem sugeriu ainda não testou) | aprovada | devolvida (voltou com a sugestão devolvida_para_id). Fora de Finalizada: nulo.';
comment on column public.plt_sugestoes.origem_id is 'A sugestão anterior, quando esta é a devolução depois do teste (D-263).';
comment on column public.plt_sugestoes.tarefa_id is
  'A pendência "Testar a sugestão #N" (tarefa do Sistema de quem sugeriu) enquanto o teste está aberto.';
comment on column public.plt_sugestoes.chave is 'Idempotência do envio (o toque repetido não cria outra sugestão — Lei §10).';

-- As colunas abertas: maior nível primeiro, a mais antiga primeiro (cursor).
create index if not exists plt_sugestoes_abertas_idx
  on public.plt_sugestoes (coluna, (-nivel), id)
  where coluna in ('solicitacoes', 'backlog', 'fazendo');
-- As fechadas: a mais recente primeiro (cursor).
create index if not exists plt_sugestoes_fechadas_idx
  on public.plt_sugestoes (coluna, movida_em desc, id desc)
  where coluna in ('finalizada', 'recusada');
create index if not exists plt_sugestoes_autor_idx on public.plt_sugestoes (autor_id, criada_em desc);
create index if not exists plt_sugestoes_origem_idx on public.plt_sugestoes (origem_id) where origem_id is not null;
create index if not exists plt_sugestoes_devolvida_idx
  on public.plt_sugestoes (devolvida_para_id) where devolvida_para_id is not null;
create index if not exists plt_sugestoes_tarefa_idx on public.plt_sugestoes (tarefa_id) where tarefa_id is not null;
create unique index if not exists plt_sugestoes_chave_uq
  on public.plt_sugestoes (autor_id, chave) where chave is not null;

alter table public.plt_sugestoes enable row level security;
revoke all on public.plt_sugestoes from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2 · O que aconteceu com ela (append-only)
-- ----------------------------------------------------------------------------
create table if not exists public.plt_sugestao_fatos (
  id             bigint generated always as identity primary key,
  sugestao_id    bigint not null references public.plt_sugestoes(id),
  tipo           text not null,
  de             text,
  para           text,
  motivo         text,
  relacionada_id bigint references public.plt_sugestoes(id),
  autor_id       uuid references public.plt_usuarios(id),
  criado_em      timestamptz not null default now(),
  constraint plt_sugestao_fatos_tipo_ck check (tipo in ('criada', 'movida', 'aprovada', 'devolvida'))
);

comment on table public.plt_sugestao_fatos is
  'SESSAO-46 (D-260): a história de cada sugestão — criada, movida (de→para, motivo da recusa), aprovada, devolvida (relacionada_id = a nova). APPEND-ONLY por gatilho (vale até para a service_role — M-14).';

create index if not exists plt_sugestao_fatos_sugestao_idx on public.plt_sugestao_fatos (sugestao_id, id);
create index if not exists plt_sugestao_fatos_autor_idx on public.plt_sugestao_fatos (autor_id) where autor_id is not null;
create index if not exists plt_sugestao_fatos_relacionada_idx
  on public.plt_sugestao_fatos (relacionada_id) where relacionada_id is not null;

alter table public.plt_sugestao_fatos enable row level security;
revoke all on public.plt_sugestao_fatos from public, anon, authenticated;

create or replace function plt_privado.fn_sugestao_fato_imutavel()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'A história da sugestão não se edita nem se apaga — o que mudou vira um fato novo.'
    using errcode = 'check_violation';
end;
$$;
revoke all on function plt_privado.fn_sugestao_fato_imutavel() from public, anon, authenticated;

drop trigger if exists plt_sugestao_fatos_imutavel on public.plt_sugestao_fatos;
create trigger plt_sugestao_fatos_imutavel
  before update or delete on public.plt_sugestao_fatos
  for each row execute function plt_privado.fn_sugestao_fato_imutavel();

-- ----------------------------------------------------------------------------
-- 3 · O armário dos arquivos (privado; a pasta é de quem envia)
-- ----------------------------------------------------------------------------
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('plt-sugestoes', 'plt-sugestoes', false, 52428800, null)
    on conflict (id) do update
      set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = null;

    drop policy if exists plt_sugestoes_enviar on storage.objects;
    create policy plt_sugestoes_enviar on storage.objects
      for insert to authenticated
      with check (bucket_id = 'plt-sugestoes'
                  and (storage.foldername(name))[1] = (select plt_privado.fn_usuario_atual())::text);
    drop policy if exists plt_sugestoes_ler on storage.objects;
    create policy plt_sugestoes_ler on storage.objects
      for select to authenticated
      using (bucket_id = 'plt-sugestoes' and (select plt_privado.fn_usuario_atual()) is not null);
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4 · Ao vivo: o tópico do quadro (todo logado ouve; o aviso não leva dado)
--     Política própria — não recria plt_privado.fn_aviso_pode_ouvir (a 43).
-- ----------------------------------------------------------------------------
do $$
begin
  if to_regclass('realtime.messages') is not null
     and to_regprocedure('realtime.topic()') is not null then
    execute 'drop policy if exists plt_sugestoes_ouvir on realtime.messages';
    execute $sql$
      create policy plt_sugestoes_ouvir on realtime.messages
        for select to authenticated
        using (realtime.messages.extension = 'broadcast'
               and realtime.topic() = 'plt-aviso:sugestoes'
               and (select plt_privado.fn_usuario_atual()) is not null)
    $sql$;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5 · Ajudantes
-- ----------------------------------------------------------------------------
-- O texto numa linha só, cortado com reticências (cartão, aviso, pendência).
create or replace function plt_privado.fn_sugestao_resumo(p_texto text, p_max integer)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
           when char_length(t) <= p_max then t
           else rtrim(left(t, p_max - 1)) || '…'
         end
    from (select btrim(regexp_replace(coalesce(p_texto, ''), '\s+', ' ', 'g')) as t) x;
$$;
revoke all on function plt_privado.fn_sugestao_resumo(text, integer) from public, anon, authenticated;

-- Que tipo de arquivo é (o ícone do cartão).
create or replace function plt_privado.fn_sugestao_tipo_arquivo(p_mime text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
           when p_mime like 'image/%' then 'imagem'
           when p_mime like 'video/%' then 'video'
           when p_mime like 'audio/%' then 'audio'
           else 'arquivo'
         end;
$$;
revoke all on function plt_privado.fn_sugestao_tipo_arquivo(text) from public, anon, authenticated;

-- A trilha de atividade (D-40) dos gestos das sugestões.
create or replace function plt_privado.fn_sugestao_trilha(p_acao text, p_contexto jsonb)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.plt_logs_atividade (usuario_id, acao, rota, contexto)
  values (plt_privado.fn_usuario_atual(), p_acao, '/tech/sugestao-de-melhoria', coalesce(p_contexto, '{}'::jsonb));
$$;
revoke all on function plt_privado.fn_sugestao_trilha(text, jsonb) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6 · O gatilho dos fatos: projeção, pendência de teste, avisos e o "mudou"
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_sugestao_fato_aplicar()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_s        public.plt_sugestoes%rowtype;
  v_resumo   text;
  v_tarefa   bigint;
  v_sistema  text := coalesce(current_setting('plt.tarefa_sistema', true), '');
begin
  select * into v_s from public.plt_sugestoes where id = new.sugestao_id;
  v_resumo := plt_privado.fn_sugestao_resumo(v_s.texto, 120);

  if new.tipo <> 'criada' then
    -- Qualquer passo depois do envio fecha a pendência de teste que estiver aberta
    -- (tarefa do Sistema: só a maquinaria mexe — fn_validar_tarefa).
    if v_s.tarefa_id is not null then
      perform set_config('plt.tarefa_sistema', '1', true);
      update public.plt_tarefas
         set situacao = 'concluida', concluida_em = coalesce(concluida_em, new.criado_em)
       where id = v_s.tarefa_id and situacao <> 'concluida';
      perform set_config('plt.tarefa_sistema', v_sistema, true);
    end if;

    if new.tipo = 'movida' then
      update public.plt_sugestoes
         set coluna        = new.para,
             movida_em     = new.criado_em,
             motivo_recusa = case when new.para = 'recusada' then new.motivo end,
             teste         = case when new.para = 'finalizada' then 'aguardando' end,
             testada_em    = null,
             tarefa_id     = null
       where id = v_s.id;

      if new.para = 'finalizada' then
        perform set_config('plt.tarefa_sistema', '1', true);
        insert into public.plt_tarefas (titulo, descricao, responsavel_id, origem, privada, delegacao, situacao)
        values ('Testar a sugestão #' || v_s.id,
                'Já está no sistema: "' || plt_privado.fn_sugestao_resumo(v_s.texto, 300)
                  || '". Teste e aprove — ou devolva com uma nova sugestão.',
                v_s.autor_id, 'sistema', true, 'direta', 'aberta')
        returning id into v_tarefa;
        perform set_config('plt.tarefa_sistema', v_sistema, true);
        update public.plt_sugestoes set tarefa_id = v_tarefa where id = v_s.id;

        insert into public.plt_notificacoes (destinatario_id, tipo, titulo, corpo)
        values (v_s.autor_id, 'sugestao_testar',
                'Sugestão #' || v_s.id || ' pronta para testar',
                'Já está no sistema: "' || v_resumo || '". Teste e aprove — ou devolva com uma nova sugestão.');
      elsif new.para = 'recusada' then
        insert into public.plt_notificacoes (destinatario_id, tipo, titulo, corpo)
        values (v_s.autor_id, 'sugestao_recusada',
                'Sugestão #' || v_s.id || ' recusada',
                'Motivo: ' || coalesce(new.motivo, '—') || ' · Sua sugestão: "' || v_resumo || '"');
      end if;
    elsif new.tipo = 'aprovada' then
      update public.plt_sugestoes
         set teste = 'aprovada', testada_em = new.criado_em, tarefa_id = null
       where id = v_s.id;
    elsif new.tipo = 'devolvida' then
      update public.plt_sugestoes
         set teste = 'devolvida', testada_em = new.criado_em,
             devolvida_para_id = new.relacionada_id, tarefa_id = null
       where id = v_s.id;
    end if;
  end if;

  perform plt_privado.fn_avisar('sugestoes');
  return null;
end;
$$;
revoke all on function plt_privado.fn_sugestao_fato_aplicar() from public, anon, authenticated;

drop trigger if exists plt_sugestao_fatos_aplicar on public.plt_sugestao_fatos;
create trigger plt_sugestao_fatos_aplicar
  after insert on public.plt_sugestao_fatos
  for each row execute function plt_privado.fn_sugestao_fato_aplicar();

-- ----------------------------------------------------------------------------
-- 7 · Porta: enviar (e devolver depois do teste)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_sugestao_criar(
  p_tipo      text,
  p_texto     text,
  p_nivel     integer,
  p_anexos    jsonb,
  p_origem_id bigint default null,
  p_chave     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu       uuid := plt_privado.fn_usuario_atual();
  v_texto    text := btrim(coalesce(p_texto, ''));
  v_chave    text := nullif(btrim(coalesce(p_chave, '')), '');
  v_id       bigint;
  v_origem   public.plt_sugestoes%rowtype;
  v_a        jsonb;
  v_limpos   jsonb := '[]'::jsonb;
  v_caminhos text[] := '{}';
  v_caminho  text;
  v_tamanho  bigint;
  v_duracao  numeric;
  v_existe   boolean;
begin
  if v_eu is null then
    raise exception 'Entre na plataforma para sugerir.' using errcode = 'insufficient_privilege';
  end if;

  -- O toque repetido (rede que cai e volta) devolve a mesma sugestão.
  if v_chave is not null then
    select s.id into v_id from public.plt_sugestoes s where s.autor_id = v_eu and s.chave = v_chave;
    if v_id is not null then
      return jsonb_build_object('id', v_id, 'repetido', true);
    end if;
  end if;

  if p_tipo is null or p_tipo not in ('bug', 'melhoria', 'novidade') then
    raise exception 'Diga se é um bug, uma melhoria ou uma implementação nova.' using errcode = 'check_violation';
  end if;
  if char_length(v_texto) < 30 then
    raise exception 'Escreva pelo menos 30 letras contando o que você quer (faltam %).', 30 - char_length(v_texto)
      using errcode = 'check_violation';
  end if;
  if char_length(v_texto) > 4000 then
    raise exception 'O texto passou de 4.000 letras — resuma, e o detalhe vai no arquivo.' using errcode = 'check_violation';
  end if;
  if p_nivel is null or p_nivel not between 1 and 10 then
    raise exception 'Escolha o nível de necessidade, de 1 a 10.' using errcode = 'check_violation';
  end if;
  if p_anexos is null or jsonb_typeof(p_anexos) <> 'array' or jsonb_array_length(p_anexos) = 0 then
    raise exception 'Mande pelo menos um arquivo: um print, um áudio, um vídeo ou outro arquivo.'
      using errcode = 'check_violation';
  end if;
  if jsonb_array_length(p_anexos) > 10 then
    raise exception 'Até 10 arquivos por sugestão.' using errcode = 'check_violation';
  end if;

  for v_a in select value from jsonb_array_elements(p_anexos) loop
    v_caminho := v_a ->> 'caminho';
    if v_caminho is null or v_caminho !~ ('^' || v_eu::text || '/[A-Za-z0-9._-]{1,200}$') then
      raise exception 'Um dos arquivos não está na sua pasta — envie de novo.' using errcode = 'check_violation';
    end if;
    if v_caminho = any (v_caminhos) then
      continue;
    end if;
    begin
      v_tamanho := (v_a ->> 'tamanho')::bigint;
      v_duracao := nullif(v_a ->> 'duracao_s', '')::numeric;
    exception when others then
      raise exception 'Um dos arquivos veio com tamanho ou duração estranhos — envie de novo.'
        using errcode = 'check_violation';
    end;
    if v_tamanho is null or v_tamanho not between 1 and 52428800 then
      raise exception 'Cada arquivo pode ter até 50 MB.' using errcode = 'check_violation';
    end if;
    if v_duracao is not null and v_duracao not between 0 and 3600 then
      raise exception 'O áudio ou vídeo passou de uma hora.' using errcode = 'check_violation';
    end if;
    if to_regclass('storage.objects') is not null then
      -- dinâmico: onde não há armário (o teste), a consulta nem é montada
      execute 'select exists (select 1 from storage.objects o where o.bucket_id = $1 and o.name = $2)'
        into v_existe using 'plt-sugestoes', v_caminho;
      if not v_existe then
        raise exception 'Um dos arquivos não chegou — envie de novo.' using errcode = 'no_data_found';
      end if;
    end if;
    v_caminhos := v_caminhos || v_caminho;
    v_limpos := v_limpos || jsonb_build_array(jsonb_build_object(
      'caminho', v_caminho,
      'nome', left(coalesce(nullif(btrim(v_a ->> 'nome'), ''), 'arquivo'), 200),
      'mime', left(coalesce(nullif(btrim(split_part(v_a ->> 'mime', ';', 1)), ''), 'application/octet-stream'), 100),
      'tamanho', v_tamanho,
      'duracao_s', case when v_duracao is null then null else round(v_duracao) end));
  end loop;

  if p_origem_id is not null then
    select * into v_origem from public.plt_sugestoes where id = p_origem_id for update;
    if not found then
      raise exception 'A sugestão anterior não existe.' using errcode = 'no_data_found';
    end if;
    if v_origem.autor_id <> v_eu then
      raise exception 'Só quem sugeriu devolve a sugestão depois do teste.' using errcode = 'insufficient_privilege';
    end if;
    if v_origem.coluna <> 'finalizada' or v_origem.teste is distinct from 'aguardando' then
      raise exception 'Esta sugestão não está esperando o seu teste.' using errcode = 'check_violation';
    end if;
  end if;

  begin
    insert into public.plt_sugestoes (autor_id, tipo, texto, nivel, anexos, origem_id, chave)
    values (v_eu, p_tipo, v_texto, p_nivel, v_limpos, p_origem_id, v_chave)
    returning id into v_id;
  exception when unique_violation then
    -- dois toques ao mesmo tempo com a mesma chave: vale o primeiro
    select s.id into v_id from public.plt_sugestoes s where s.autor_id = v_eu and s.chave = v_chave;
    return jsonb_build_object('id', v_id, 'repetido', true);
  end;

  insert into public.plt_sugestao_fatos (sugestao_id, tipo, para, relacionada_id, autor_id)
  values (v_id, 'criada', 'solicitacoes', p_origem_id, v_eu);
  if p_origem_id is not null then
    insert into public.plt_sugestao_fatos (sugestao_id, tipo, relacionada_id, autor_id)
    values (p_origem_id, 'devolvida', v_id, v_eu);
  end if;

  perform plt_privado.fn_sugestao_trilha(
    case when p_origem_id is null then 'sugestao_enviada' else 'sugestao_devolvida' end,
    jsonb_build_object('sugestao_id', v_id, 'tipo', p_tipo, 'nivel', p_nivel, 'origem_id', p_origem_id,
                       'arquivos', jsonb_array_length(v_limpos)));

  return jsonb_build_object('id', v_id, 'repetido', false);
end;
$$;

comment on function public.plt_fn_sugestao_criar(text, text, integer, jsonb, bigint, text) is
  'SESSAO-46 (D-260/D-263): envia a sugestão (arquivo 1–10, tipo, texto 30+, nível 1–10) — ou, com p_origem_id, devolve a finalizada que esperava o teste de quem sugeriu. Idempotente por p_chave.';

-- ----------------------------------------------------------------------------
-- 8 · Porta: mover (só o super admin — D-261; recusa com motivo — D-262)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_sugestao_mover(p_id bigint, p_para text, p_motivo text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_s      public.plt_sugestoes%rowtype;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  if not plt_privado.fn_eh_super_admin() then
    raise exception 'Só o dono do sistema move as sugestões no quadro.' using errcode = 'insufficient_privilege';
  end if;
  if p_para is null or p_para not in ('solicitacoes', 'backlog', 'fazendo', 'finalizada', 'recusada') then
    raise exception 'Coluna desconhecida.' using errcode = 'check_violation';
  end if;
  select * into v_s from public.plt_sugestoes where id = p_id for update;
  if not found then
    raise exception 'Esta sugestão não existe.' using errcode = 'no_data_found';
  end if;
  if v_s.coluna = p_para then
    return jsonb_build_object('id', v_s.id, 'coluna', v_s.coluna, 'repetido', true);
  end if;
  if p_para = 'recusada' and (v_motivo is null or char_length(v_motivo) < 5) then
    raise exception 'Escreva o motivo da recusa (pelo menos 5 letras) — ele vai no aviso para quem sugeriu.'
      using errcode = 'check_violation';
  end if;
  if char_length(coalesce(v_motivo, '')) > 500 then
    raise exception 'O motivo passou de 500 letras — resuma.' using errcode = 'check_violation';
  end if;

  insert into public.plt_sugestao_fatos (sugestao_id, tipo, de, para, motivo, autor_id)
  values (v_s.id, 'movida', v_s.coluna, p_para,
          case when p_para = 'recusada' then v_motivo end, plt_privado.fn_usuario_atual());

  perform plt_privado.fn_sugestao_trilha('sugestao_movida',
    jsonb_build_object('sugestao_id', v_s.id, 'de', v_s.coluna, 'para', p_para));

  return jsonb_build_object('id', v_s.id, 'coluna', p_para, 'repetido', false);
end;
$$;

comment on function public.plt_fn_sugestao_mover(bigint, text, text) is
  'SESSAO-46 (D-261/D-262): o super admin move a sugestão entre as colunas; Finalizada avisa e abre a pendência de teste; Recusada exige o motivo, que vai no aviso.';

-- ----------------------------------------------------------------------------
-- 9 · Porta: aprovar depois do teste (só quem sugeriu)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_sugestao_aprovar(p_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu uuid := plt_privado.fn_usuario_atual();
  v_s  public.plt_sugestoes%rowtype;
begin
  if v_eu is null then
    raise exception 'Entre na plataforma para aprovar.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_s from public.plt_sugestoes where id = p_id for update;
  if not found then
    raise exception 'Esta sugestão não existe.' using errcode = 'no_data_found';
  end if;
  if v_s.autor_id <> v_eu then
    raise exception 'Só quem sugeriu aprova depois de testar.' using errcode = 'insufficient_privilege';
  end if;
  if v_s.teste = 'aprovada' then
    return jsonb_build_object('id', v_s.id, 'repetido', true);
  end if;
  if v_s.coluna <> 'finalizada' or v_s.teste is distinct from 'aguardando' then
    raise exception 'Esta sugestão não está esperando o seu teste.' using errcode = 'check_violation';
  end if;

  insert into public.plt_sugestao_fatos (sugestao_id, tipo, autor_id) values (v_s.id, 'aprovada', v_eu);
  perform plt_privado.fn_sugestao_trilha('sugestao_aprovada', jsonb_build_object('sugestao_id', v_s.id));
  return jsonb_build_object('id', v_s.id, 'repetido', false);
end;
$$;

comment on function public.plt_fn_sugestao_aprovar(bigint) is
  'SESSAO-46 (D-263): quem sugeriu testou e aprovou — a pendência fecha e o cartão mostra "aprovada".';

-- ----------------------------------------------------------------------------
-- 10 · Porta: o quadro (uma página por coluna, por cursor — Lei §6)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_sugestoes_pagina(
  p_coluna    text,
  p_cursor    jsonb,
  p_lim       integer,
  p_eu        uuid,
  p_com_total boolean
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_ids   bigint[];
  v_mais  boolean;
  v_itens jsonb;
  v_ult   public.plt_sugestoes%rowtype;
  v_prox  jsonb;
  v_total integer;
begin
  -- A página nasce primeiro, só pelo índice da coluna (E-172); os dados, só dela.
  if p_coluna in ('solicitacoes', 'backlog', 'fazendo') then
    if p_cursor is null then
      select array_agg(x.id order by x.o, x.id) into v_ids
        from (select s.id, -s.nivel as o from public.plt_sugestoes s
               where s.coluna = p_coluna
                 and s.coluna in ('solicitacoes', 'backlog', 'fazendo')
               order by -s.nivel, s.id
               limit p_lim + 1) x;
    else
      select array_agg(x.id order by x.o, x.id) into v_ids
        from (select s.id, -s.nivel as o from public.plt_sugestoes s
               where s.coluna = p_coluna
                 and s.coluna in ('solicitacoes', 'backlog', 'fazendo')
                 and (-s.nivel, s.id) > (-((p_cursor ->> 'nivel')::integer), (p_cursor ->> 'id')::bigint)
               order by -s.nivel, s.id
               limit p_lim + 1) x;
    end if;
  else
    if p_cursor is null then
      select array_agg(x.id order by x.movida_em desc, x.id desc) into v_ids
        from (select s.id, s.movida_em from public.plt_sugestoes s
               where s.coluna = p_coluna
                 and s.coluna in ('finalizada', 'recusada')
               order by s.movida_em desc, s.id desc
               limit p_lim + 1) x;
    else
      select array_agg(x.id order by x.movida_em desc, x.id desc) into v_ids
        from (select s.id, s.movida_em from public.plt_sugestoes s
               where s.coluna = p_coluna
                 and s.coluna in ('finalizada', 'recusada')
                 and (s.movida_em, s.id) < ((p_cursor ->> 'movida_em')::timestamptz, (p_cursor ->> 'id')::bigint)
               order by s.movida_em desc, s.id desc
               limit p_lim + 1) x;
    end if;
  end if;

  v_ids := coalesce(v_ids, '{}');
  v_mais := cardinality(v_ids) > p_lim;
  if v_mais then
    v_ids := v_ids[1:p_lim];
    select * into v_ult from public.plt_sugestoes where id = v_ids[p_lim];
    v_prox := case when p_coluna in ('solicitacoes', 'backlog', 'fazendo')
                   then jsonb_build_object('nivel', v_ult.nivel, 'id', v_ult.id)
                   else jsonb_build_object('movida_em', v_ult.movida_em, 'id', v_ult.id) end;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id,
           'tipo', s.tipo,
           'nivel', s.nivel,
           'resumo', plt_privado.fn_sugestao_resumo(s.texto, 160),
           'autor_nome', u.nome,
           'minha', s.autor_id = p_eu,
           'criada_em', s.criada_em,
           'movida_em', s.movida_em,
           'arquivos', jsonb_array_length(s.anexos),
           'tipos_arquivo', (select coalesce(jsonb_agg(distinct plt_privado.fn_sugestao_tipo_arquivo(a ->> 'mime')), '[]'::jsonb)
                               from jsonb_array_elements(s.anexos) a),
           'teste', s.teste,
           'origem_id', s.origem_id,
           'devolvida_para_id', s.devolvida_para_id,
           'motivo_recusa', plt_privado.fn_sugestao_resumo(s.motivo_recusa, 140))
         order by o.ord), '[]'::jsonb)
    into v_itens
    from unnest(v_ids) with ordinality as o(id, ord)
    join public.plt_sugestoes s on s.id = o.id
    left join public.plt_usuarios u on u.id = s.autor_id;

  if p_com_total then
    select count(*)::integer into v_total from public.plt_sugestoes s where s.coluna = p_coluna;
  end if;

  return jsonb_build_object('coluna', p_coluna, 'total', v_total, 'itens', v_itens, 'proximo', v_prox);
end;
$$;
revoke all on function plt_privado.fn_sugestoes_pagina(text, jsonb, integer, uuid, boolean) from public, anon, authenticated;

create or replace function public.plt_fn_sugestoes_quadro(
  p_coluna text default null,
  p_cursor jsonb default null,
  p_limite integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu      uuid := plt_privado.fn_usuario_atual();
  v_lim     integer := least(greatest(coalesce(p_limite, 20), 1), 50);
  v_colunas text[] := array['solicitacoes', 'backlog', 'fazendo', 'finalizada', 'recusada'];
  v_c       text;
  v_lista   jsonb := '[]'::jsonb;
begin
  if v_eu is null then
    raise exception 'Entre na plataforma para ver as sugestões.' using errcode = 'insufficient_privilege';
  end if;
  if p_coluna is not null and not (p_coluna = any (v_colunas)) then
    raise exception 'Coluna desconhecida.' using errcode = 'check_violation';
  end if;
  if p_cursor is not null and p_coluna is null then
    raise exception 'O "ver mais" é de uma coluna só.' using errcode = 'check_violation';
  end if;

  foreach v_c in array v_colunas loop
    continue when p_coluna is not null and v_c <> p_coluna;
    v_lista := v_lista || jsonb_build_array(
      plt_privado.fn_sugestoes_pagina(v_c, p_cursor, v_lim, v_eu, p_coluna is null));
  end loop;

  return jsonb_build_object('colunas', v_lista, 'eu_movo', plt_privado.fn_eh_super_admin());
end;
$$;

comment on function public.plt_fn_sugestoes_quadro(text, jsonb, integer) is
  'SESSAO-46: o quadro das sugestões numa requisição — a 1ª página (até 50) e o total de cada coluna; com p_coluna + p_cursor, o "Ver mais" daquela coluna. eu_movo = super admin.';

-- ----------------------------------------------------------------------------
-- 11 · Porta: a ficha (no clique — Lei §3)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_sugestao_detalhe(p_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu  uuid := plt_privado.fn_usuario_atual();
  v_s   public.plt_sugestoes%rowtype;
  v_ret jsonb;
begin
  if v_eu is null then
    raise exception 'Entre na plataforma para ver a sugestão.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_s from public.plt_sugestoes where id = p_id;
  if not found then
    raise exception 'Esta sugestão não existe.' using errcode = 'no_data_found';
  end if;

  select jsonb_build_object(
           'id', v_s.id,
           'tipo', v_s.tipo,
           'texto', v_s.texto,
           'nivel', v_s.nivel,
           'coluna', v_s.coluna,
           'criada_em', v_s.criada_em,
           'movida_em', v_s.movida_em,
           'motivo_recusa', v_s.motivo_recusa,
           'teste', v_s.teste,
           'testada_em', v_s.testada_em,
           'anexos', v_s.anexos,
           'autor', jsonb_build_object('id', u.id, 'nome', u.nome, 'foto_caminho', u.foto_caminho),
           'minha', v_s.autor_id = v_eu,
           'eu_movo', plt_privado.fn_eh_super_admin(),
           'posso_testar', v_s.autor_id = v_eu and v_s.coluna = 'finalizada' and v_s.teste = 'aguardando',
           'origem', (select jsonb_build_object('id', o.id, 'resumo', plt_privado.fn_sugestao_resumo(o.texto, 140),
                                                'coluna', o.coluna, 'tipo', o.tipo, 'nivel', o.nivel)
                        from public.plt_sugestoes o where o.id = v_s.origem_id),
           'devolvida_para', (select jsonb_build_object('id', d.id, 'resumo', plt_privado.fn_sugestao_resumo(d.texto, 140),
                                                        'coluna', d.coluna)
                                from public.plt_sugestoes d where d.id = v_s.devolvida_para_id),
           'historico', (select coalesce(jsonb_agg(jsonb_build_object(
                                   'tipo', f.tipo, 'de', f.de, 'para', f.para, 'motivo', f.motivo,
                                   'relacionada_id', f.relacionada_id, 'autor_nome', fu.nome, 'quando', f.criado_em)
                                 order by f.id), '[]'::jsonb)
                           from public.plt_sugestao_fatos f
                           left join public.plt_usuarios fu on fu.id = f.autor_id
                          where f.sugestao_id = v_s.id))
    into v_ret
    from public.plt_usuarios u
   where u.id = v_s.autor_id;

  return v_ret;
end;
$$;

comment on function public.plt_fn_sugestao_detalhe(bigint) is
  'SESSAO-46: a ficha da sugestão — texto inteiro, arquivos, quem sugeriu, a anterior e a devolução, a história; posso_testar = sou quem sugeriu e ela espera o meu teste.';

-- ----------------------------------------------------------------------------
-- 12 · Permissões das portas (só quem tem login)
-- ----------------------------------------------------------------------------
revoke all on function public.plt_fn_sugestao_criar(text, text, integer, jsonb, bigint, text) from public, anon;
revoke all on function public.plt_fn_sugestao_mover(bigint, text, text) from public, anon;
revoke all on function public.plt_fn_sugestao_aprovar(bigint) from public, anon;
revoke all on function public.plt_fn_sugestoes_quadro(text, jsonb, integer) from public, anon;
revoke all on function public.plt_fn_sugestao_detalhe(bigint) from public, anon;
grant execute on function public.plt_fn_sugestao_criar(text, text, integer, jsonb, bigint, text) to authenticated;
grant execute on function public.plt_fn_sugestao_mover(bigint, text, text) to authenticated;
grant execute on function public.plt_fn_sugestao_aprovar(bigint) to authenticated;
grant execute on function public.plt_fn_sugestoes_quadro(text, jsonb, integer) to authenticated;
grant execute on function public.plt_fn_sugestao_detalhe(bigint) to authenticated;
