-- ============================================================================
-- SESSAO-26 · Chat interno — migration 38
--
-- O chat da empresa dentro da plataforma: canais de grupo, conversas
-- particulares, Avisos gerais e aniversários automáticos. Lei desta sessão
-- (adendo do dono, 27/09): "a comunicação deve ser por websockets; nada de
-- leitura ao banco além da paginação — até 10 mensagens e até 5 conversas por
-- página, carregando mais ao rolar".
--
--   1 · plt_usuarios: data de nascimento + a correção de segurança (resposta 6
--       do dono): o navegador passa a ler SÓ as colunas de trabalho — CPF, hash
--       do PIN, token de convite e a data de nascimento ficam fora da API
--   2 · as 3 tabelas do chat (conversas, participantes, mensagens) — mensagem
--       é SÓ inserção, como os eventos
--   3 · Avisos gerais: a conversa da empresa inteira — todo cadastro participa
--   4 · regras num lugar só (plt_privado): quem participa, quem escreve, quem
--       administra, quem pode ouvir um canal de websocket
--   5 · RLS por participação (nem admin lê conversa de que não participa)
--   6 · websocket: Broadcast do banco em canal PRIVADO — a autorização é UMA
--       vez, na entrada do canal (política em realtime.messages); o gatilho da
--       mensagem só empurra. Nada de postgres_changes: lá o Realtime relê o
--       banco para cada assinante a cada mudança — é justamente o peso que o
--       dono proibiu. Por isso a publicação supabase_realtime NÃO muda.
--   7 · as portas (plt_fn_chat_*): leitura só paginada; o resto é POST
--   8 · aniversários: publicação diária nos Avisos gerais (pg_cron 08:00 de
--       Natal) + as portas da data de nascimento (o próprio ou admin)
--   9 · permissões (E-11)
--
-- CONVIVÊNCIA (27/09): a SESSAO-24 aplicou a migration 37 antes desta. Esta
-- migration é 100% ADITIVA — não redefine nenhuma função, view, check ou
-- grant das migrations 01–37; assim a reaplicação 01–37 de outra frente não
-- desfaz nada daqui. E é aplicada SOZINHA (só este arquivo) enquanto a pasta
-- desta frente não tiver a 37.
--
-- Nada aqui toca as tabelas da integração (clientes, pedidos, pedido_itens,
-- eventos, gp_pcp_processados).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · plt_usuarios: data de nascimento + leitura só das colunas de trabalho
-- ----------------------------------------------------------------------------
alter table public.plt_usuarios add column if not exists data_nascimento date;

comment on column public.plt_usuarios.data_nascimento is
  'Data de nascimento (SESSAO-26): no dia, o chat publica os parabéns nos Avisos gerais. Dado pessoal — o navegador não lê a coluna; só pelas portas plt_fn_ler_nascimento/plt_fn_definir_nascimento (a própria pessoa ou o admin).';

-- E-50: o Supabase concede SELECT na TABELA ao authenticated por padrão, e o
-- grant de tabela passa por cima dos "revoke select (cpf, …)" por coluna das
-- migrations 08/11 — em produção CPF, hash do PIN e token de convite estavam
-- legíveis por qualquer pessoa logada. O remédio é tirar o SELECT da tabela e
-- devolver coluna a coluna. Consequência permanente: coluna nova em
-- plt_usuarios só é legível pelo navegador com grant select explícito.
revoke select on public.plt_usuarios from anon, authenticated;
grant select (
  id, auth_user_id, nome, email, telefone, papel, ativo, criado_em, atualizado_em,
  usuario, matricula, senha_padrao, convite_usado_em, tema, foto_caminho, modulos,
  arquivado_em, fila_prioridade
) on public.plt_usuarios to authenticated;

-- ----------------------------------------------------------------------------
-- 2 · As tabelas do chat
-- ----------------------------------------------------------------------------
create table if not exists public.plt_chat_conversas (
  id               bigint generated always as identity primary key,
  tipo             text not null,
  nome             text,
  chave_particular text,
  criada_em        timestamptz not null default now(),
  constraint plt_chat_conversas_tipo_ck check (tipo in ('canal', 'particular', 'avisos')),
  constraint plt_chat_conversas_forma_ck check (
    (tipo = 'particular' and nome is null and chave_particular is not null)
    or (tipo <> 'particular' and chave_particular is null
        and nome is not null and char_length(btrim(nome)) between 1 and 60)
  )
);

comment on table public.plt_chat_conversas is
  'Conversas do chat interno (SESSAO-26): canal de grupo, particular (1:1) ou os Avisos gerais (uma só). Só o nome muda depois de criada; nada se apaga.';
comment on column public.plt_chat_conversas.chave_particular is
  'Particular: os dois ids em ordem ("menor:maior") — garante UMA conversa por par, quem quer que abra primeiro.';

-- uma particular por par; um só Avisos gerais
create unique index if not exists plt_chat_conversas_particular_uq
  on public.plt_chat_conversas (chave_particular) where tipo = 'particular';
create unique index if not exists plt_chat_conversas_avisos_uq
  on public.plt_chat_conversas ((tipo)) where tipo = 'avisos';

create table if not exists public.plt_chat_participantes (
  conversa_id    bigint not null references public.plt_chat_conversas(id),
  usuario_id     uuid   not null references public.plt_usuarios(id) on delete cascade,
  papel          text   not null default 'membro',
  ultima_lida_id bigint not null default 0,
  entrou_em      timestamptz not null default now(),
  saiu_em        timestamptz,
  primary key (conversa_id, usuario_id),
  constraint plt_chat_participantes_papel_ck check (papel in ('membro', 'administrador', 'escritor'))
);

comment on table public.plt_chat_participantes is
  'Quem participa de cada conversa (SESSAO-26) — a regra única de leitura. papel: administrador (quem criou o canal), escritor (Avisos gerais: liberado pelo admin), membro. ultima_lida_id é o ponteiro de leitura ("lida" pode mudar); saiu_em em vez de apagar.';

create index if not exists plt_chat_participantes_usuario_idx
  on public.plt_chat_participantes (usuario_id, conversa_id) where saiu_em is null;

create table if not exists public.plt_chat_mensagens (
  id               bigint generated always as identity primary key,
  conversa_id      bigint not null references public.plt_chat_conversas(id),
  autor_id         uuid references public.plt_usuarios(id),
  tipo             text not null default 'texto',
  texto            text not null,
  sobre_usuario_id uuid,
  criada_em        timestamptz not null default now(),
  constraint plt_chat_mensagens_tipo_ck check (tipo in ('texto', 'aniversario')),
  constraint plt_chat_mensagens_texto_ck check (char_length(texto) between 1 and 2000),
  constraint plt_chat_mensagens_autor_ck check (
    (tipo = 'texto' and autor_id is not null and sobre_usuario_id is null)
    or (tipo = 'aniversario' and autor_id is null and sobre_usuario_id is not null)
  )
);

comment on table public.plt_chat_mensagens is
  'Mensagens do chat (SESSAO-26): SÓ INSERÇÃO — gatilho recusa editar e apagar, até para a chave de serviço. autor_id nulo = o Sistema (aniversário). Conteúdo nunca vai para a trilha de atividade.';
comment on column public.plt_chat_mensagens.sobre_usuario_id is
  'Aniversário: de quem é a data. Sem FK de propósito — excluir um cadastro sem história (D-49) não pode esbarrar numa mensagem que não se apaga.';

-- a página de mensagens (cursor por id) e a última mensagem de cada conversa
create index if not exists plt_chat_mensagens_conversa_idx
  on public.plt_chat_mensagens (conversa_id, id desc);
-- um parabéns por pessoa por dia (dia de Natal)
create unique index if not exists plt_chat_mensagens_aniversario_uq
  on public.plt_chat_mensagens (sobre_usuario_id, ((criada_em at time zone 'America/Fortaleza')::date))
  where tipo = 'aniversario';

-- Mensagem é só inserção (M-14: vale até para quem ignora RLS).
create or replace function plt_privado.fn_chat_mensagem_imutavel()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'Mensagem do chat não se edita nem se apaga — o histórico é simples e honesto.';
end;
$$;

drop trigger if exists plt_chat_mensagens_imutavel on public.plt_chat_mensagens;
create trigger plt_chat_mensagens_imutavel
  before update or delete on public.plt_chat_mensagens
  for each row execute function plt_privado.fn_chat_mensagem_imutavel();

-- Na conversa, só o nome muda; nada se apaga.
create or replace function plt_privado.fn_chat_conversa_guardar()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Conversa do chat não se apaga — o histórico fica.';
  end if;
  if new.tipo is distinct from old.tipo
     or new.chave_particular is distinct from old.chave_particular
     or new.criada_em is distinct from old.criada_em then
    raise exception 'Numa conversa do chat, só o nome muda.';
  end if;
  return new;
end;
$$;

drop trigger if exists plt_chat_conversas_guardar on public.plt_chat_conversas;
create trigger plt_chat_conversas_guardar
  before update or delete on public.plt_chat_conversas
  for each row execute function plt_privado.fn_chat_conversa_guardar();

-- ----------------------------------------------------------------------------
-- 3 · Avisos gerais: a conversa da empresa inteira (infraestrutura, como o
--     DANIFICADO da D-25 — não é chute de estrutura operacional)
-- ----------------------------------------------------------------------------
insert into public.plt_chat_conversas (tipo, nome)
select 'avisos', 'Avisos gerais'
 where not exists (select 1 from public.plt_chat_conversas where tipo = 'avisos');

create or replace function plt_privado.fn_chat_avisos_id()
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id from public.plt_chat_conversas c where c.tipo = 'avisos' limit 1;
$$;

-- Todo cadastro participa dos Avisos gerais, com o ponteiro de leitura na
-- última mensagem: quem chega não herda "não lidas" antigas.
insert into public.plt_chat_participantes (conversa_id, usuario_id, papel, ultima_lida_id)
select plt_privado.fn_chat_avisos_id(), u.id, 'membro',
       coalesce((select max(m.id) from public.plt_chat_mensagens m
                  where m.conversa_id = plt_privado.fn_chat_avisos_id()), 0)
  from public.plt_usuarios u
on conflict (conversa_id, usuario_id) do nothing;

create or replace function plt_privado.fn_chat_entrar_nos_avisos()
returns trigger
security definer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_avisos bigint := plt_privado.fn_chat_avisos_id();
begin
  if v_avisos is not null then
    insert into public.plt_chat_participantes (conversa_id, usuario_id, papel, ultima_lida_id)
    values (v_avisos, new.id, 'membro',
            coalesce((select max(m.id) from public.plt_chat_mensagens m where m.conversa_id = v_avisos), 0))
    on conflict (conversa_id, usuario_id) do nothing;
  end if;
  return null;
end;
$$;

drop trigger if exists plt_usuarios_chat_avisos on public.plt_usuarios;
create trigger plt_usuarios_chat_avisos
  after insert on public.plt_usuarios
  for each row execute function plt_privado.fn_chat_entrar_nos_avisos();

-- ----------------------------------------------------------------------------
-- 4 · As regras, num lugar só
-- ----------------------------------------------------------------------------

-- Participa? A regra ÚNICA de leitura — usada pelo RLS, pela entrada no canal
-- de websocket e pelas portas. Pessoa arquivada não participa de nada
-- (fn_usuario_atual só devolve cadastro ativo).
create or replace function plt_privado.fn_chat_participa(p_conversa_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.plt_chat_participantes p
     where p.conversa_id = p_conversa_id
       and p.usuario_id = plt_privado.fn_usuario_atual()
       and p.saiu_em is null
  );
$$;

-- Pode ouvir este canal de websocket? plt-chat-u:{uuid} é o canal da própria
-- pessoa (os sinais do balão); plt-chat-c:{id} é o de uma conversa (só quem
-- participa). Qualquer outro tópico: não.
create or replace function plt_privado.fn_chat_pode_ouvir(p_topico text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu uuid := plt_privado.fn_usuario_atual();
begin
  if v_eu is null or p_topico is null then
    return false;
  end if;
  if p_topico = 'plt-chat-u:' || v_eu::text then
    return true;
  end if;
  if p_topico ~ '^plt-chat-c:[0-9]{1,18}$' then
    return plt_privado.fn_chat_participa(substring(p_topico from 12)::bigint);
  end if;
  return false;
end;
$$;

-- Líder para o chat (quem cria canais — resposta 2 do dono): admin, papel
-- líder ou líder de algum setor. O mesmo critério do "ehLider" da interface.
create or replace function plt_privado.fn_chat_eh_lider()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.plt_usuarios u
     where u.id = plt_privado.fn_usuario_atual()
       and (u.papel in ('admin', 'lider')
            or exists (select 1 from public.plt_usuario_setores us
                        where us.usuario_id = u.id and us.lider_do_setor))
  );
$$;

-- Pode escrever? Participante ativo, e: nos Avisos gerais só admin ou quem o
-- admin liberou (papel escritor — resposta 3); na particular, a outra pessoa
-- precisa estar ativa (arquivada = conversa só de leitura).
create or replace function plt_privado.fn_chat_pode_escrever(p_conversa_id bigint, p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.plt_chat_participantes p
      join public.plt_chat_conversas c on c.id = p.conversa_id
      join public.plt_usuarios u on u.id = p.usuario_id and u.ativo
     where p.conversa_id = p_conversa_id
       and p.usuario_id = p_usuario
       and p.saiu_em is null
       and case c.tipo
             when 'avisos' then p.papel = 'escritor' or u.papel = 'admin'
             when 'particular' then exists (
               select 1
                 from public.plt_chat_participantes o
                 join public.plt_usuarios ou on ou.id = o.usuario_id and ou.ativo
                where o.conversa_id = c.id and o.usuario_id <> p_usuario and o.saiu_em is null)
             else true
           end
  );
$$;

-- Administra o canal? Quem criou (papel administrador) ou um admin da
-- plataforma que esteja no canal. Só canal tem administração.
create or replace function plt_privado.fn_chat_administra(p_conversa_id bigint, p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.plt_chat_participantes p
      join public.plt_chat_conversas c on c.id = p.conversa_id and c.tipo = 'canal'
      join public.plt_usuarios u on u.id = p.usuario_id and u.ativo
     where p.conversa_id = p_conversa_id
       and p.usuario_id = p_usuario
       and p.saiu_em is null
       and (p.papel = 'administrador' or u.papel = 'admin')
  );
$$;

-- Empurra um sinal pelo websocket, no canal privado da pessoa. Sem Realtime
-- (teste local), não faz nada. ⚠️ realtime.send engole erro (vira WARNING):
-- a prova de que saiu é a linha em realtime.messages.
create or replace function plt_privado.fn_chat_sinal(p_usuario uuid, p_evento text, p_dados jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is not null then
    perform realtime.send(p_dados, p_evento, 'plt-chat-u:' || p_usuario::text, true);
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5 · RLS por participação — quem não participa não lê nada, nem pela API
-- (nem admin). Escrita só pelas portas (security definer).
-- ----------------------------------------------------------------------------
alter table public.plt_chat_conversas     enable row level security;
alter table public.plt_chat_participantes enable row level security;
alter table public.plt_chat_mensagens     enable row level security;

drop policy if exists plt_chat_conversas_leitura on public.plt_chat_conversas;
create policy plt_chat_conversas_leitura on public.plt_chat_conversas
  for select to authenticated
  using (plt_privado.fn_chat_participa(id));

drop policy if exists plt_chat_participantes_leitura on public.plt_chat_participantes;
create policy plt_chat_participantes_leitura on public.plt_chat_participantes
  for select to authenticated
  using (plt_privado.fn_chat_participa(conversa_id));

drop policy if exists plt_chat_mensagens_leitura on public.plt_chat_mensagens;
create policy plt_chat_mensagens_leitura on public.plt_chat_mensagens
  for select to authenticated
  using (plt_privado.fn_chat_participa(conversa_id));

revoke all on public.plt_chat_conversas, public.plt_chat_participantes, public.plt_chat_mensagens
  from anon;
revoke insert, update, delete, truncate, references, trigger
  on public.plt_chat_conversas, public.plt_chat_participantes, public.plt_chat_mensagens
  from authenticated;
grant select on public.plt_chat_conversas, public.plt_chat_participantes, public.plt_chat_mensagens
  to authenticated;

-- ----------------------------------------------------------------------------
-- 6 · Websocket: Broadcast do banco em canal PRIVADO
-- ----------------------------------------------------------------------------

-- 6a · Quem pode ENTRAR num canal (o Realtime confere uma vez, na entrada).
-- Nenhuma política de INSERT: o navegador não transmite nada por esses
-- canais — só o banco empurra.
do $$
begin
  if to_regclass('realtime.messages') is not null
     and to_regprocedure('realtime.topic()') is not null then
    execute 'drop policy if exists plt_chat_ouvir on realtime.messages';
    execute $sql$
      create policy plt_chat_ouvir on realtime.messages
        for select to authenticated
        using (realtime.messages.extension = 'broadcast'
               and plt_privado.fn_chat_pode_ouvir(realtime.topic()))
    $sql$;
  end if;
end;
$$;

-- 6b · Mensagem nova → (1) a mensagem inteira no canal da conversa, para quem
-- está com ela aberta; (2) um sinal pequeno no canal de cada participante
-- ativo (o badge e a lista do balão — prévia de 80 caracteres, sem reler nada).
create or replace function plt_privado.fn_chat_transmitir_mensagem()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tipo       text;
  v_nome       text;
  v_autor_nome text;
  v_autor_foto text;
  v_sinal      jsonb;
  v_destino    uuid;
begin
  if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is null then
    return null;
  end if;

  select c.tipo, c.nome into v_tipo, v_nome
    from public.plt_chat_conversas c where c.id = new.conversa_id;
  select u.nome, u.foto_caminho into v_autor_nome, v_autor_foto
    from public.plt_usuarios u where u.id = new.autor_id;

  perform realtime.send(
    jsonb_build_object(
      'id',          new.id,
      'conversa_id', new.conversa_id,
      'autor_id',    new.autor_id,
      'autor_nome',  coalesce(v_autor_nome, 'Sistema'),
      'autor_foto',  v_autor_foto,
      'tipo',        new.tipo,
      'texto',       new.texto,
      'criada_em',   new.criada_em),
    'mensagem', 'plt-chat-c:' || new.conversa_id, true);

  v_sinal := jsonb_build_object(
    'conversa_id',   new.conversa_id,
    'tipo_conversa', v_tipo,
    'nome_conversa', v_nome,
    'mensagem_id',   new.id,
    'autor_id',      new.autor_id,
    'autor_nome',    coalesce(v_autor_nome, 'Sistema'),
    'autor_foto',    v_autor_foto,
    'previa',        left(new.texto, 80),
    'criada_em',     new.criada_em);

  for v_destino in
    select p.usuario_id
      from public.plt_chat_participantes p
      join public.plt_usuarios u on u.id = p.usuario_id and u.ativo
     where p.conversa_id = new.conversa_id
       and p.saiu_em is null
  loop
    perform realtime.send(v_sinal, 'mensagem', 'plt-chat-u:' || v_destino::text, true);
  end loop;

  return null;
end;
$$;

drop trigger if exists plt_chat_mensagens_transmitir on public.plt_chat_mensagens;
create trigger plt_chat_mensagens_transmitir
  after insert on public.plt_chat_mensagens
  for each row execute function plt_privado.fn_chat_transmitir_mensagem();

-- ----------------------------------------------------------------------------
-- 7 · As portas. Leitura: só paginada (5 conversas / 10 mensagens / 10
-- pessoas por página — o teto é do banco). O resto é POST.
-- ----------------------------------------------------------------------------

-- 7.1 · A lista de conversas, 5 por página, da atividade mais recente para a
-- mais antiga (cursor = atividade + id da última conversa da página anterior).
-- A 1ª página traz também o total de não lidas: é a ÚNICA leitura na abertura
-- do app, e é ela que acende o badge do balão. p_conversa_id busca o resumo de
-- uma conversa só (abrir por link).
create or replace function public.plt_fn_chat_conversas(
  p_antes_em    timestamptz default null,
  p_antes_id    bigint      default null,
  p_limite      integer     default 5,
  p_conversa_id bigint      default null
)
returns table (
  conversa_id       bigint,
  tipo              text,
  titulo            text,
  foto_caminho      text,
  outro_id          uuid,
  outro_ativo       boolean,
  papel             text,
  pode_escrever     boolean,
  administra        boolean,
  membros           integer,
  atividade_em      timestamptz,
  ultima_id         bigint,
  ultima_previa     text,
  ultima_autor_id   uuid,
  ultima_autor_nome text,
  ultima_lida_id    bigint,
  nao_lidas         integer,
  total_nao_lidas   integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_eu    uuid := plt_privado.fn_usuario_atual();
  v_total integer;
begin
  if v_eu is null then
    raise exception 'Sessão sem cadastro ativo na plataforma.' using errcode = 'insufficient_privilege';
  end if;

  if p_antes_em is null and p_conversa_id is null then
    select coalesce(sum(n.qtd), 0)::int into v_total
      from public.plt_chat_participantes p
      cross join lateral (
        select count(*) as qtd
          from (select 1
                  from public.plt_chat_mensagens m
                 where m.conversa_id = p.conversa_id
                   and m.id > p.ultima_lida_id
                   and m.autor_id is distinct from v_eu
                 limit 100) x
      ) n
     where p.usuario_id = v_eu
       and p.saiu_em is null;
  end if;

  return query
  with minhas as (
    select c.id, c.tipo, c.nome, c.criada_em, p.papel, p.ultima_lida_id
      from public.plt_chat_participantes p
      join public.plt_chat_conversas c on c.id = p.conversa_id
     where p.usuario_id = v_eu
       and p.saiu_em is null
       and (p_conversa_id is null or c.id = p_conversa_id)
  ), com_ultima as (
    select mi.id, mi.tipo, mi.nome, mi.papel, mi.ultima_lida_id,
           u.id as u_id, u.texto as u_texto, u.autor_id as u_autor,
           coalesce(u.criada_em, mi.criada_em) as atividade
      from minhas mi
      left join lateral (
        select m.id, m.texto, m.autor_id, m.criada_em
          from public.plt_chat_mensagens m
         where m.conversa_id = mi.id
         order by m.id desc
         limit 1
      ) u on true
     -- particular sem mensagem nenhuma não aparece: ninguém disse nada ainda
     where mi.tipo <> 'particular' or u.id is not null or p_conversa_id is not null
  ), pagina as (
    select cu.*
      from com_ultima cu
     where p_antes_em is null
        or (cu.atividade, cu.id) < (p_antes_em, coalesce(p_antes_id, 0))
     order by cu.atividade desc, cu.id desc
     limit least(greatest(coalesce(p_limite, 5), 1), 5)
  )
  select pg.id,
         pg.tipo,
         case when pg.tipo = 'particular' then o.nome else pg.nome end,
         case when pg.tipo = 'particular' then o.foto_caminho end,
         o.id,
         o.ativo,
         pg.papel,
         plt_privado.fn_chat_pode_escrever(pg.id, v_eu),
         plt_privado.fn_chat_administra(pg.id, v_eu),
         (select count(*)::int from public.plt_chat_participantes x
           where x.conversa_id = pg.id and x.saiu_em is null),
         pg.atividade,
         pg.u_id,
         left(pg.u_texto, 80),
         pg.u_autor,
         case when pg.u_id is not null then coalesce(ua.nome, 'Sistema') end,
         pg.ultima_lida_id,
         (select count(*)::int
            from (select 1
                    from public.plt_chat_mensagens m
                   where m.conversa_id = pg.id
                     and m.id > pg.ultima_lida_id
                     and m.autor_id is distinct from v_eu
                   limit 100) y),
         v_total
    from pagina pg
    left join lateral (
      select u.id, u.nome, u.foto_caminho, u.ativo
        from public.plt_chat_participantes x
        join public.plt_usuarios u on u.id = x.usuario_id
       where pg.tipo = 'particular'
         and x.conversa_id = pg.id
         and x.usuario_id <> v_eu
       limit 1
    ) o on true
    left join public.plt_usuarios ua on ua.id = pg.u_autor
   order by pg.atividade desc, pg.id desc;
end;
$$;

comment on function public.plt_fn_chat_conversas(timestamptz, bigint, integer, bigint) is
  'Lista de conversas do chat, 5 por página (cursor por atividade). A 1ª página traz o total de não lidas (o badge do balão). Só as conversas de que a pessoa participa.';

-- 7.2 · A página de mensagens: as 10 anteriores ao cursor (id), mais nova
-- primeiro. Sem cursor = as 10 últimas.
create or replace function public.plt_fn_chat_mensagens(
  p_conversa_id bigint,
  p_antes_id    bigint  default null,
  p_limite      integer default 10
)
returns table (
  id          bigint,
  conversa_id bigint,
  autor_id    uuid,
  autor_nome  text,
  autor_foto  text,
  tipo        text,
  texto       text,
  criada_em   timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  if not plt_privado.fn_chat_participa(p_conversa_id) then
    raise exception 'Você não participa desta conversa.' using errcode = 'insufficient_privilege';
  end if;

  return query
  select m.id, m.conversa_id, m.autor_id, coalesce(u.nome, 'Sistema'), u.foto_caminho,
         m.tipo, m.texto, m.criada_em
    from public.plt_chat_mensagens m
    left join public.plt_usuarios u on u.id = m.autor_id
   where m.conversa_id = p_conversa_id
     and (p_antes_id is null or m.id < p_antes_id)
   order by m.id desc
   limit least(greatest(coalesce(p_limite, 10), 1), 10);
end;
$$;

-- 7.3 · Enviar (POST). Devolve a mensagem gravada — quem envia não relê nada;
-- os outros recebem pelo websocket. A própria mensagem já conta como lida.
create or replace function public.plt_fn_chat_enviar(p_conversa_id bigint, p_texto text)
returns table (
  id          bigint,
  conversa_id bigint,
  autor_id    uuid,
  autor_nome  text,
  autor_foto  text,
  tipo        text,
  texto       text,
  criada_em   timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_eu    uuid := plt_privado.fn_usuario_atual();
  v_texto text := btrim(coalesce(p_texto, ''));
  v_tipo  text;
  v_msg   public.plt_chat_mensagens;
begin
  if v_eu is null or not plt_privado.fn_chat_participa(p_conversa_id) then
    raise exception 'Você não participa desta conversa.' using errcode = 'insufficient_privilege';
  end if;

  select c.tipo into v_tipo from public.plt_chat_conversas c where c.id = p_conversa_id;

  if not plt_privado.fn_chat_pode_escrever(p_conversa_id, v_eu) then
    if v_tipo = 'avisos' then
      raise exception 'Nos Avisos gerais só escreve quem o admin liberou.'
        using errcode = 'insufficient_privilege';
    end if;
    raise exception 'Esta conversa ficou só de leitura: a outra pessoa não está mais ativa na plataforma.'
      using errcode = 'insufficient_privilege';
  end if;

  if v_texto = '' then
    raise exception 'Escreva a mensagem antes de enviar.' using errcode = 'check_violation';
  end if;
  if char_length(v_texto) > 2000 then
    raise exception 'Mensagem longa demais — o limite é de 2.000 caracteres.' using errcode = 'check_violation';
  end if;

  insert into public.plt_chat_mensagens (conversa_id, autor_id, tipo, texto)
  values (p_conversa_id, v_eu, 'texto', v_texto)
  returning * into v_msg;

  update public.plt_chat_participantes x
     set ultima_lida_id = greatest(x.ultima_lida_id, v_msg.id)
   where x.conversa_id = p_conversa_id
     and x.usuario_id = v_eu;

  -- D-40: aviso geral publicado vai para a trilha — sem o conteúdo.
  if v_tipo = 'avisos' then
    insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_eu, 'chat_aviso_publicado',
            jsonb_build_object('conversa_id', p_conversa_id, 'mensagem_id', v_msg.id));
  end if;

  return query
  select v_msg.id, v_msg.conversa_id, v_msg.autor_id, u.nome, u.foto_caminho,
         v_msg.tipo, v_msg.texto, v_msg.criada_em
    from public.plt_usuarios u
   where u.id = v_eu;
end;
$$;

-- 7.4 · Marcar como lida (POST): o ponteiro só anda para frente. A própria
-- pessoa recebe o sinal "lida" — a outra aba/aparelho dela apaga o badge.
create or replace function public.plt_fn_chat_marcar_lida(p_conversa_id bigint, p_ate_id bigint)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu    uuid := plt_privado.fn_usuario_atual();
  v_antes bigint;
  v_ate   bigint;
  v_novo  bigint;
begin
  if v_eu is null or not plt_privado.fn_chat_participa(p_conversa_id) then
    raise exception 'Você não participa desta conversa.' using errcode = 'insufficient_privilege';
  end if;

  select x.ultima_lida_id into v_antes
    from public.plt_chat_participantes x
   where x.conversa_id = p_conversa_id and x.usuario_id = v_eu;

  select max(m.id) into v_ate
    from public.plt_chat_mensagens m
   where m.conversa_id = p_conversa_id
     and m.id <= coalesce(p_ate_id, 0);

  v_novo := greatest(v_antes, coalesce(v_ate, 0));
  if v_novo > v_antes then
    update public.plt_chat_participantes x
       set ultima_lida_id = v_novo
     where x.conversa_id = p_conversa_id
       and x.usuario_id = v_eu;
    perform plt_privado.fn_chat_sinal(v_eu, 'lida',
      jsonb_build_object('conversa_id', p_conversa_id, 'ultima_lida_id', v_novo));
  end if;

  return v_novo;
end;
$$;

-- 7.5 · Abrir a particular com alguém (POST): a mesma conversa para o par,
-- quem quer que abra primeiro. Não vai para a trilha (mostraria a admins quem
-- conversa com quem) — e ela só aparece na lista quando alguém escrever.
create or replace function public.plt_fn_chat_abrir_particular(p_outro uuid)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu    uuid := plt_privado.fn_usuario_atual();
  v_chave text;
  v_id    bigint;
begin
  if v_eu is null then
    raise exception 'Sessão sem cadastro ativo na plataforma.' using errcode = 'insufficient_privilege';
  end if;
  if p_outro is null or p_outro = v_eu then
    raise exception 'Escolha outra pessoa para conversar.' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.plt_usuarios u where u.id = p_outro and u.ativo) then
    raise exception 'Esta pessoa não está ativa na plataforma.' using errcode = 'check_violation';
  end if;

  v_chave := least(v_eu::text, p_outro::text) || ':' || greatest(v_eu::text, p_outro::text);

  insert into public.plt_chat_conversas (tipo, chave_particular)
  values ('particular', v_chave)
  on conflict (chave_particular) where tipo = 'particular' do nothing
  returning id into v_id;

  if v_id is null then
    select c.id into v_id
      from public.plt_chat_conversas c
     where c.tipo = 'particular' and c.chave_particular = v_chave;
  end if;

  insert into public.plt_chat_participantes (conversa_id, usuario_id)
  values (v_id, v_eu), (v_id, p_outro)
  on conflict (conversa_id, usuario_id) do nothing;

  return v_id;
end;
$$;

-- 7.6 · Criar canal (POST): só líder ou admin (resposta 2); quem cria
-- administra. Cada membro recebe o sinal "entrou" (a lista dele relê a 1ª
-- página e o canal aparece).
create or replace function public.plt_fn_chat_criar_canal(p_nome text, p_membros uuid[] default '{}')
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu     uuid := plt_privado.fn_usuario_atual();
  v_nome   text := btrim(coalesce(p_nome, ''));
  v_id     bigint;
  v_membro uuid;
  v_qtd    integer := 0;
begin
  if v_eu is null or not plt_privado.fn_chat_eh_lider() then
    raise exception 'Criar canal é gesto de líder ou de admin.' using errcode = 'insufficient_privilege';
  end if;
  if char_length(v_nome) not between 1 and 60 then
    raise exception 'Dê um nome ao canal (até 60 caracteres).' using errcode = 'check_violation';
  end if;
  if coalesce(array_length(p_membros, 1), 0) > 200 then
    raise exception 'Muitas pessoas de uma vez — adicione no máximo 200.' using errcode = 'check_violation';
  end if;

  insert into public.plt_chat_conversas (tipo, nome) values ('canal', v_nome)
  returning id into v_id;

  insert into public.plt_chat_participantes (conversa_id, usuario_id, papel)
  values (v_id, v_eu, 'administrador');
  perform plt_privado.fn_chat_sinal(v_eu, 'entrou', jsonb_build_object('conversa_id', v_id));

  for v_membro in
    select distinct u.id
      from unnest(coalesce(p_membros, '{}'::uuid[])) as m(id)
      join public.plt_usuarios u on u.id = m.id and u.ativo
     where u.id <> v_eu
  loop
    insert into public.plt_chat_participantes (conversa_id, usuario_id, papel)
    values (v_id, v_membro, 'membro');
    perform plt_privado.fn_chat_sinal(v_membro, 'entrou', jsonb_build_object('conversa_id', v_id));
    v_qtd := v_qtd + 1;
  end loop;

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
  values (v_eu, 'chat_canal_criado', jsonb_build_object('conversa_id', v_id, 'membros', v_qtd));

  return v_id;
end;
$$;

-- 7.7 · Renomear canal (POST): quem administra.
create or replace function public.plt_fn_chat_renomear_canal(p_conversa_id bigint, p_nome text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu      uuid := plt_privado.fn_usuario_atual();
  v_nome    text := btrim(coalesce(p_nome, ''));
  v_destino uuid;
begin
  if v_eu is null or not plt_privado.fn_chat_administra(p_conversa_id, v_eu) then
    raise exception 'Só quem administra o canal muda o nome.' using errcode = 'insufficient_privilege';
  end if;
  if char_length(v_nome) not between 1 and 60 then
    raise exception 'Dê um nome ao canal (até 60 caracteres).' using errcode = 'check_violation';
  end if;

  update public.plt_chat_conversas c set nome = v_nome where c.id = p_conversa_id;

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
  values (v_eu, 'chat_canal_renomeado', jsonb_build_object('conversa_id', p_conversa_id));

  for v_destino in
    select p.usuario_id from public.plt_chat_participantes p
     where p.conversa_id = p_conversa_id and p.saiu_em is null
  loop
    perform plt_privado.fn_chat_sinal(v_destino, 'renomeada',
      jsonb_build_object('conversa_id', p_conversa_id, 'nome', v_nome));
  end loop;
end;
$$;

-- 7.8 · Membros de uma conversa, 10 por página (quem participa vê). p_papel
-- filtra — nos Avisos gerais, 'escritor' lista quem o admin liberou.
create or replace function public.plt_fn_chat_membros(
  p_conversa_id  bigint,
  p_papel        text    default null,
  p_limite       integer default 10,
  p_deslocamento integer default 0
)
returns table (
  usuario_id   uuid,
  nome         text,
  foto_caminho text,
  papel        text,
  ativo        boolean,
  total        integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  if not plt_privado.fn_chat_participa(p_conversa_id) then
    raise exception 'Você não participa desta conversa.' using errcode = 'insufficient_privilege';
  end if;

  return query
  select u.id, u.nome, u.foto_caminho, x.papel, u.ativo, (count(*) over ())::int
    from public.plt_chat_participantes x
    join public.plt_usuarios u on u.id = x.usuario_id
   where x.conversa_id = p_conversa_id
     and x.saiu_em is null
     and (p_papel is null or x.papel = p_papel)
   order by (x.papel = 'administrador') desc, u.nome, u.id
   limit least(greatest(coalesce(p_limite, 10), 1), 10)
  offset greatest(coalesce(p_deslocamento, 0), 0);
end;
$$;

-- 7.9 · Pôr pessoas no canal (POST): quem administra. Quem já tinha saído
-- volta; quem já está fica como está.
create or replace function public.plt_fn_chat_adicionar_membros(p_conversa_id bigint, p_usuarios uuid[])
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu     uuid := plt_privado.fn_usuario_atual();
  v_membro uuid;
  v_qtd    integer := 0;
begin
  if v_eu is null or not plt_privado.fn_chat_administra(p_conversa_id, v_eu) then
    raise exception 'Só quem administra o canal põe ou tira pessoas.' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(array_length(p_usuarios, 1), 0) > 200 then
    raise exception 'Muitas pessoas de uma vez — adicione no máximo 200.' using errcode = 'check_violation';
  end if;

  for v_membro in
    select distinct u.id
      from unnest(coalesce(p_usuarios, '{}'::uuid[])) as m(id)
      join public.plt_usuarios u on u.id = m.id and u.ativo
     where not exists (
       select 1 from public.plt_chat_participantes x
        where x.conversa_id = p_conversa_id and x.usuario_id = u.id and x.saiu_em is null)
  loop
    insert into public.plt_chat_participantes (conversa_id, usuario_id, papel)
    values (p_conversa_id, v_membro, 'membro')
    on conflict (conversa_id, usuario_id)
    do update set saiu_em = null, entrou_em = now(), papel = 'membro';

    insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_eu, 'chat_membro_adicionado',
            jsonb_build_object('conversa_id', p_conversa_id, 'usuario_id', v_membro));
    perform plt_privado.fn_chat_sinal(v_membro, 'entrou', jsonb_build_object('conversa_id', p_conversa_id));
    v_qtd := v_qtd + 1;
  end loop;

  return v_qtd;
end;
$$;

-- 7.10 · Tirar alguém do canal (POST): quem administra; nunca a si mesmo.
-- Não apaga: marca a saída. A pessoa recebe o sinal "saiu" e perde a leitura.
create or replace function public.plt_fn_chat_remover_membro(p_conversa_id bigint, p_usuario uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu uuid := plt_privado.fn_usuario_atual();
begin
  if v_eu is null or not plt_privado.fn_chat_administra(p_conversa_id, v_eu) then
    raise exception 'Só quem administra o canal põe ou tira pessoas.' using errcode = 'insufficient_privilege';
  end if;
  if p_usuario = v_eu then
    raise exception 'Você não pode tirar a si mesmo do canal.' using errcode = 'check_violation';
  end if;

  update public.plt_chat_participantes x
     set saiu_em = now()
   where x.conversa_id = p_conversa_id
     and x.usuario_id = p_usuario
     and x.saiu_em is null;
  if not found then
    raise exception 'Esta pessoa não está no canal.' using errcode = 'check_violation';
  end if;

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
  values (v_eu, 'chat_membro_removido',
          jsonb_build_object('conversa_id', p_conversa_id, 'usuario_id', p_usuario));
  perform plt_privado.fn_chat_sinal(p_usuario, 'saiu', jsonb_build_object('conversa_id', p_conversa_id));
end;
$$;

-- 7.11 · Quem escreve nos Avisos gerais (POST): só o admin decide
-- (resposta 3). Admin sempre escreve; os demais, se liberados.
create or replace function public.plt_fn_chat_definir_escritor(p_usuario uuid, p_pode boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu     uuid := plt_privado.fn_usuario_atual();
  v_avisos bigint := plt_privado.fn_chat_avisos_id();
begin
  if v_eu is null or not plt_privado.fn_eh_admin() then
    raise exception 'Só o admin decide quem escreve nos Avisos gerais.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.plt_usuarios u where u.id = p_usuario and u.ativo) then
    raise exception 'Esta pessoa não está ativa na plataforma.' using errcode = 'check_violation';
  end if;

  insert into public.plt_chat_participantes (conversa_id, usuario_id, papel)
  values (v_avisos, p_usuario, case when p_pode then 'escritor' else 'membro' end)
  on conflict (conversa_id, usuario_id)
  do update set papel = excluded.papel, saiu_em = null;

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
  values (v_eu, 'chat_escritor_definido',
          jsonb_build_object('conversa_id', v_avisos, 'usuario_id', p_usuario, 'pode_escrever', p_pode));
  perform plt_privado.fn_chat_sinal(p_usuario, 'permissao',
    jsonb_build_object('conversa_id', v_avisos, 'pode_escrever', p_pode));
end;
$$;

-- ----------------------------------------------------------------------------
-- 8 · Aniversários (resposta 1: só nos Avisos gerais, com o texto aprovado)
-- ----------------------------------------------------------------------------

-- 8.1 · Ler a data de nascimento: a própria pessoa ou o admin.
create or replace function public.plt_fn_ler_nascimento(p_usuario uuid default null)
returns date
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu   uuid := plt_privado.fn_usuario_atual();
  v_alvo uuid := coalesce(p_usuario, plt_privado.fn_usuario_atual());
begin
  if v_eu is null or (v_alvo <> v_eu and not plt_privado.fn_eh_admin()) then
    raise exception 'Só a própria pessoa ou o admin vê a data de nascimento.'
      using errcode = 'insufficient_privilege';
  end if;
  return (select u.data_nascimento from public.plt_usuarios u where u.id = v_alvo);
end;
$$;

-- 8.2 · Gravar a data de nascimento (POST): a própria pessoa ou o admin.
-- Vai para a trilha sem o valor (D-40: quem mudou o quê, nunca o dado).
create or replace function public.plt_fn_definir_nascimento(p_usuario uuid, p_data date)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu   uuid := plt_privado.fn_usuario_atual();
  v_alvo uuid := coalesce(p_usuario, plt_privado.fn_usuario_atual());
begin
  if v_eu is null or (v_alvo <> v_eu and not plt_privado.fn_eh_admin()) then
    raise exception 'Só a própria pessoa ou o admin muda a data de nascimento.'
      using errcode = 'insufficient_privilege';
  end if;
  if p_data is not null
     and (p_data < date '1900-01-01' or p_data > (now() at time zone 'America/Fortaleza')::date) then
    raise exception 'Data de nascimento fora do intervalo — confira o dia, o mês e o ano.'
      using errcode = 'check_violation';
  end if;

  update public.plt_usuarios u set data_nascimento = p_data where u.id = v_alvo;
  if not found then
    raise exception 'Cadastro não encontrado.' using errcode = 'check_violation';
  end if;

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
  values (v_eu, 'data_nascimento_alterada', jsonb_build_object('alvo_id', v_alvo));
end;
$$;

-- 8.3 · A publicação do dia: parabéns de cada aniversariante ativo nos Avisos
-- gerais, uma vez por pessoa por dia (o índice único garante). Quem nasceu em
-- 29/02 é lembrado em 28/02 nos anos não bissextos. p_dia existe para testar
-- forjando a data; sem ele, vale o dia de hoje em Natal.
create or replace function plt_privado.fn_chat_publicar_aniversarios(p_dia date default null)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_dia      date := coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date);
  v_hoje     date := (now() at time zone 'America/Fortaleza')::date;
  v_avisos   bigint := plt_privado.fn_chat_avisos_id();
  v_ano      integer := extract(year from coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date))::int;
  v_bissexto boolean;
  v_qtd      integer := 0;
  r          record;
begin
  if v_avisos is null then
    return 0;
  end if;
  v_bissexto := (v_ano % 4 = 0 and v_ano % 100 <> 0) or v_ano % 400 = 0;

  for r in
    select u.id, u.nome
      from public.plt_usuarios u
     where u.ativo
       and u.data_nascimento is not null
       and (
         (extract(month from u.data_nascimento) = extract(month from v_dia)
          and extract(day from u.data_nascimento) = extract(day from v_dia))
         or (not v_bissexto
             and extract(month from v_dia) = 2 and extract(day from v_dia) = 28
             and extract(month from u.data_nascimento) = 2 and extract(day from u.data_nascimento) = 29)
       )
       and not exists (
         select 1 from public.plt_chat_mensagens m
          where m.tipo = 'aniversario'
            and m.sobre_usuario_id = u.id
            and (m.criada_em at time zone 'America/Fortaleza')::date = v_hoje)
     order by u.nome, u.id
  loop
    insert into public.plt_chat_mensagens (conversa_id, autor_id, tipo, texto, sobre_usuario_id)
    values (v_avisos, null, 'aniversario',
            '🎉 Hoje é aniversário de ' || r.nome || '! Parabéns — toda a Domoby deseja um ótimo dia.',
            r.id);
    v_qtd := v_qtd + 1;
  end loop;

  return v_qtd;
end;
$$;

-- 8.4 · Todo dia às 08:00 de Natal (11:00 UTC). pg_cron roda como a dona da
-- função; sem pg_cron (teste local), só não agenda.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if not exists (select 1 from cron.job where jobname = 'plt-chat-aniversarios') then
      perform cron.schedule('plt-chat-aniversarios', '0 11 * * *',
        'select plt_privado.fn_chat_publicar_aniversarios()');
    end if;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 9 · Permissões: maquinaria fora da API (E-11); as duas regras que o RLS e
-- a entrada no canal chamam ficam executáveis por authenticated; as portas
-- são endpoints de propósito.
-- ----------------------------------------------------------------------------
revoke all on function plt_privado.fn_chat_mensagem_imutavel()             from public, anon, authenticated;
revoke all on function plt_privado.fn_chat_conversa_guardar()              from public, anon, authenticated;
revoke all on function plt_privado.fn_chat_avisos_id()                     from public, anon, authenticated;
revoke all on function plt_privado.fn_chat_entrar_nos_avisos()             from public, anon, authenticated;
revoke all on function plt_privado.fn_chat_eh_lider()                      from public, anon, authenticated;
revoke all on function plt_privado.fn_chat_pode_escrever(bigint, uuid)     from public, anon, authenticated;
revoke all on function plt_privado.fn_chat_administra(bigint, uuid)        from public, anon, authenticated;
revoke all on function plt_privado.fn_chat_sinal(uuid, text, jsonb)        from public, anon, authenticated;
revoke all on function plt_privado.fn_chat_transmitir_mensagem()           from public, anon, authenticated;
revoke all on function plt_privado.fn_chat_publicar_aniversarios(date)     from public, anon, authenticated;

revoke all on function plt_privado.fn_chat_participa(bigint)               from public, anon;
revoke all on function plt_privado.fn_chat_pode_ouvir(text)                from public, anon;
grant execute on function plt_privado.fn_chat_participa(bigint)            to authenticated;
grant execute on function plt_privado.fn_chat_pode_ouvir(text)             to authenticated;

revoke all on function public.plt_fn_chat_conversas(timestamptz, bigint, integer, bigint) from public, anon;
revoke all on function public.plt_fn_chat_mensagens(bigint, bigint, integer)             from public, anon;
revoke all on function public.plt_fn_chat_enviar(bigint, text)                           from public, anon;
revoke all on function public.plt_fn_chat_marcar_lida(bigint, bigint)                    from public, anon;
revoke all on function public.plt_fn_chat_abrir_particular(uuid)                         from public, anon;
revoke all on function public.plt_fn_chat_criar_canal(text, uuid[])                      from public, anon;
revoke all on function public.plt_fn_chat_renomear_canal(bigint, text)                   from public, anon;
revoke all on function public.plt_fn_chat_membros(bigint, text, integer, integer)        from public, anon;
revoke all on function public.plt_fn_chat_adicionar_membros(bigint, uuid[])             from public, anon;
revoke all on function public.plt_fn_chat_remover_membro(bigint, uuid)                   from public, anon;
revoke all on function public.plt_fn_chat_definir_escritor(uuid, boolean)                from public, anon;
revoke all on function public.plt_fn_ler_nascimento(uuid)                                from public, anon;
revoke all on function public.plt_fn_definir_nascimento(uuid, date)                      from public, anon;

grant execute on function public.plt_fn_chat_conversas(timestamptz, bigint, integer, bigint) to authenticated;
grant execute on function public.plt_fn_chat_mensagens(bigint, bigint, integer)             to authenticated;
grant execute on function public.plt_fn_chat_enviar(bigint, text)                           to authenticated;
grant execute on function public.plt_fn_chat_marcar_lida(bigint, bigint)                    to authenticated;
grant execute on function public.plt_fn_chat_abrir_particular(uuid)                         to authenticated;
grant execute on function public.plt_fn_chat_criar_canal(text, uuid[])                      to authenticated;
grant execute on function public.plt_fn_chat_renomear_canal(bigint, text)                   to authenticated;
grant execute on function public.plt_fn_chat_membros(bigint, text, integer, integer)        to authenticated;
grant execute on function public.plt_fn_chat_adicionar_membros(bigint, uuid[])             to authenticated;
grant execute on function public.plt_fn_chat_remover_membro(bigint, uuid)                   to authenticated;
grant execute on function public.plt_fn_chat_definir_escritor(uuid, boolean)                to authenticated;
grant execute on function public.plt_fn_ler_nascimento(uuid)                                to authenticated;
grant execute on function public.plt_fn_definir_nascimento(uuid, date)                      to authenticated;

-- A API do Supabase passa a enxergar as portas novas na hora.
notify pgrst, 'reload schema';
