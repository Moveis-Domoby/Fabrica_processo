-- ============================================================================
-- SESSAO-31 · etapa F (§3 · D-125/D-131 · Lei §4): a CONVERSA DO CARD, as
-- MENÇÕES, o SINO ao vivo e EDITAR/APAGAR mensagem (no card e no chat).
--
--  1. A mensagem do card é FATO do card (comentario_adicionado — a história do
--     card); editar e apagar são fatos novos (comentario_editado/apagado, com
--     a referência) — nada se apaga (RNF-05). A leitura vem de uma projeção
--     (plt_card_mensagens), 10 por página por cursor; o canal privado
--     plt-card:{id} empurra a mensagem nova/mudada para quem está com a janela
--     aberta (sem releitura).
--  2. @menção: o mencionado recebe o aviso no sino E um cartão "mencionou você
--     no card" na conversa PARTICULAR entre os dois (nasce se não existir) —
--     tipo novo de mensagem do chat, com o card para abrir. Mencionar a si
--     mesmo não avisa. Quem é mencionado passa a ver o card (participantes).
--  3. Editar e apagar (D-131): cada um só a própria mensagem; editada mostra
--     "editada", apagada vira "Mensagem apagada" para todos; o admin vê o texto
--     apagado e as versões anteriores — SÓ nas conversas a que já tem acesso
--     (a particular dos outros segue fechada). No chat, a mensagem continua
--     só-inserção para tudo que não for a porta de editar/apagar; cada versão
--     anterior fica guardada (plt_chat_versoes).
--  4. O sino ao vivo: aviso novo → sinal no canal da pessoa (o mesmo do chat),
--     aplicado no cache — sai o relógio de 30 s.
-- ============================================================================
set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · A conversa do card: a projeção das mensagens
-- ----------------------------------------------------------------------------
create table if not exists public.plt_card_mensagens (
  evento_id  bigint primary key references public.plt_eventos (id),
  card_id    bigint not null references public.plt_cards (id),
  autor_id   uuid references public.plt_usuarios (id),
  texto      text not null,
  mencoes    uuid[] not null default '{}',
  criada_em  timestamptz not null,
  editada_em timestamptz,
  apagada_em timestamptz
);
create index if not exists plt_card_mensagens_card_idx on public.plt_card_mensagens (card_id, evento_id desc);
create index if not exists plt_card_mensagens_autor_idx on public.plt_card_mensagens (autor_id);
alter table public.plt_card_mensagens enable row level security;
revoke all on table public.plt_card_mensagens from public, anon, authenticated;
comment on table public.plt_card_mensagens is
  'SESSAO-31 (§3 · D-131): a conversa do card — PROJEÇÃO dos fatos comentario_adicionado/editado/apagado (o texto vigente, editada, apagada). A verdade é o fato; leitura só pela porta plt_fn_card_mensagens.';

create or replace function plt_privado.fn_projetar_mensagem_do_card()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_mencoes uuid[];
begin
  if new.tipo = 'comentario_adicionado' then
    select coalesce(array_agg(distinct nullif(m.v, '')::uuid) filter (where nullif(m.v, '') is not null), '{}')
      into v_mencoes
      from jsonb_array_elements_text(coalesce(new.dados -> 'mencoes', '[]'::jsonb)) as m(v);
    insert into public.plt_card_mensagens (evento_id, card_id, autor_id, texto, mencoes, criada_em)
      values (new.id, new.card_id, new.usuario_id, coalesce(new.observacao, ''), v_mencoes, new.ocorrido_em)
    on conflict (evento_id) do nothing;
  elsif new.tipo = 'comentario_editado' then
    update public.plt_card_mensagens
       set texto = coalesce(new.observacao, texto), editada_em = new.ocorrido_em
     where evento_id = new.evento_referencia_id;
  elsif new.tipo = 'comentario_apagado' then
    update public.plt_card_mensagens set apagada_em = new.ocorrido_em where evento_id = new.evento_referencia_id;
  end if;
  return null;
end;
$$;

drop trigger if exists plt_eventos_projetar_mensagem on public.plt_eventos;
create trigger plt_eventos_projetar_mensagem
  after insert on public.plt_eventos
  for each row
  when (new.tipo in ('comentario_adicionado', 'comentario_editado', 'comentario_apagado'))
  execute function plt_privado.fn_projetar_mensagem_do_card();

-- O que já existe (os comentários do entregador — SESSAO-30).
insert into public.plt_card_mensagens (evento_id, card_id, autor_id, texto, mencoes, criada_em)
select e.id, e.card_id, e.usuario_id, coalesce(e.observacao, ''), '{}', e.ocorrido_em
  from public.plt_eventos e
 where e.tipo = 'comentario_adicionado'
on conflict (evento_id) do nothing;

-- A mensagem vai ao vivo para quem está com o card aberto (canal privado do
-- card). Apagada vai sem o texto — o admin vê o texto ao abrir de novo.
create or replace function plt_privado.fn_transmitir_mensagem_do_card()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is null then
    return null;
  end if;
  perform realtime.send(
    jsonb_build_object(
      'id', new.evento_id, 'card_id', new.card_id, 'autor_id', new.autor_id,
      'autor_nome', (select u.nome from public.plt_usuarios u where u.id = new.autor_id),
      'autor_foto', (select u.foto_caminho from public.plt_usuarios u where u.id = new.autor_id),
      'texto', case when new.apagada_em is null then new.texto end,
      'mencoes', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'nome', u.nome))
                             from public.plt_usuarios u where u.id = any (new.mencoes)), '[]'::jsonb),
      'criada_em', new.criada_em, 'editada_em', new.editada_em, 'apagada_em', new.apagada_em),
    case when tg_op = 'INSERT' then 'mensagem' else 'mensagem_mudou' end,
    'plt-card:' || new.card_id, true);
  return null;
end;
$$;

drop trigger if exists plt_card_mensagens_transmitir on public.plt_card_mensagens;
create trigger plt_card_mensagens_transmitir
  after insert or update on public.plt_card_mensagens
  for each row execute function plt_privado.fn_transmitir_mensagem_do_card();

-- Quem ouve o canal do card: quem vê o card (Lei §4 — tópico estreito).
create or replace function plt_privado.fn_card_pode_ouvir(p_topico text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when p_topico ~ '^plt-card:[0-9]{1,18}$'
              then plt_privado.fn_pode_anexar(substring(p_topico from 10)::bigint)
              else false end;
$$;

do $$
begin
  if to_regclass('realtime.messages') is not null
     and to_regprocedure('realtime.topic()') is not null then
    execute 'drop policy if exists plt_card_ouvir on realtime.messages';
    execute $sql$
      create policy plt_card_ouvir on realtime.messages
        for select to authenticated
        using (realtime.messages.extension = 'broadcast'
               and realtime.topic() like 'plt-card:%'
               and (select plt_privado.fn_card_pode_ouvir(realtime.topic())))
    $sql$;
  end if;
end;
$$;

-- A guarda do card (recriada POR INTEIRO a partir da migration 69): + os
-- fatos da conversa só pelas portas.
create or replace function plt_privado.fn_validar_avulso()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tipo  text;
  v_papel text;
begin
  if new.tipo in ('card_editado', 'responsavel_adicionado', 'responsavel_removido',
                  'comentario_adicionado', 'comentario_editado', 'comentario_apagado') then
    if coalesce(current_setting('plt.card_maquinaria', true), '') <> 'on' then
      raise exception 'Mudar o card (e a conversa dele) é pela janela do card.' using errcode = 'insufficient_privilege';
    end if;
    return new;
  end if;

  select c.tipo into v_tipo from public.plt_cards c where c.id = new.card_id;
  if new.tipo = 'avulso_concluido' then
    if v_tipo is distinct from 'avulso' then
      raise exception 'Só o card avulso se conclui pelo Concluir.' using errcode = 'check_violation';
    end if;
    if coalesce(current_setting('plt.avulso_maquinaria', true), '') <> 'on' then
      raise exception 'Concluir o card avulso é pelo botão Concluir.' using errcode = 'insufficient_privilege';
    end if;
    return new;
  end if;

  -- card_criado / movimentacao_setor do avulso: só setores de produção (nasce no PCP).
  if v_tipo is distinct from 'avulso' or new.setor_destino_id is null then
    return new;
  end if;
  select s.papel_no_fluxo into v_papel from public.plt_setores s where s.id = new.setor_destino_id;
  if new.tipo = 'card_criado' and v_papel = 'entrada' then
    return new;
  end if;
  if coalesce(v_papel, '') <> 'producao' then
    raise exception 'O card avulso anda só pelos setores de produção — ele não entra em estoque, aguardo nem ROTAS. Para terminar, use Concluir.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists plt_eventos_validar_avulso on public.plt_eventos;
create trigger plt_eventos_validar_avulso
  before insert on public.plt_eventos
  for each row
  when (new.tipo in ('card_criado', 'movimentacao_setor', 'card_editado', 'responsavel_adicionado',
                     'responsavel_removido', 'avulso_concluido',
                     'comentario_adicionado', 'comentario_editado', 'comentario_apagado'))
  execute function plt_privado.fn_validar_avulso();

-- ----------------------------------------------------------------------------
-- 2 · O chat: o cartão de menção e editar/apagar (D-131)
-- ----------------------------------------------------------------------------
alter table public.plt_chat_mensagens add column if not exists card_id    bigint references public.plt_cards (id);
alter table public.plt_chat_mensagens add column if not exists editada_em timestamptz;
alter table public.plt_chat_mensagens add column if not exists apagada_em timestamptz;
create index if not exists plt_chat_mensagens_card_idx on public.plt_chat_mensagens (card_id) where card_id is not null;
alter table public.plt_chat_mensagens drop constraint if exists plt_chat_mensagens_tipo_ck;
alter table public.plt_chat_mensagens add constraint plt_chat_mensagens_tipo_ck check (tipo in ('texto', 'aniversario', 'mencao'));
alter table public.plt_chat_mensagens drop constraint if exists plt_chat_mensagens_autor_ck;
alter table public.plt_chat_mensagens add constraint plt_chat_mensagens_autor_ck check (
  (tipo = 'texto' and autor_id is not null and sobre_usuario_id is null)
  or (tipo = 'aniversario' and autor_id is null and sobre_usuario_id is not null)
  -- SESSAO-31 (§3): "📌 mencionou você no card" — de quem mencionou, com o card.
  or (tipo = 'mencao' and autor_id is not null and card_id is not null)
);
comment on column public.plt_chat_mensagens.card_id is 'SESSAO-31 (§3): o card da menção (o cartão "mencionou você" abre a janela dele).';
comment on column public.plt_chat_mensagens.editada_em is 'SESSAO-31 (D-131): editada pela porta — a versão anterior fica em plt_chat_versoes.';
comment on column public.plt_chat_mensagens.apagada_em is 'SESSAO-31 (D-131): apagada pela porta — o texto fica (o admin vê nas conversas a que tem acesso); para os outros vira "Mensagem apagada".';

-- As versões anteriores (só inserção — a história não se apaga).
create table if not exists public.plt_chat_versoes (
  id          bigint generated always as identity primary key,
  mensagem_id bigint not null references public.plt_chat_mensagens (id),
  texto       text not null,
  trocada_por uuid references public.plt_usuarios (id),
  trocada_em  timestamptz not null default now()
);
create index if not exists plt_chat_versoes_mensagem_idx on public.plt_chat_versoes (mensagem_id, id);
create index if not exists plt_chat_versoes_por_idx on public.plt_chat_versoes (trocada_por);
alter table public.plt_chat_versoes enable row level security;
revoke all on table public.plt_chat_versoes from public, anon, authenticated;
comment on table public.plt_chat_versoes is
  'SESSAO-31 (D-131): o texto de antes de cada edição de mensagem do chat — só inserção; o admin lê pela porta, só nas conversas de que participa.';

-- A mensagem do chat continua só-inserção (recriada da migration 38): a ÚNICA
-- mudança aceita é a da porta de editar/apagar (texto, editada, apagada).
create or replace function plt_privado.fn_chat_mensagem_imutavel()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE'
     and coalesce(current_setting('plt.chat_maquinaria', true), '') = 'on'
     and new.id = old.id and new.conversa_id = old.conversa_id
     and new.autor_id is not distinct from old.autor_id and new.tipo = old.tipo
     and new.criada_em = old.criada_em and new.card_id is not distinct from old.card_id
     and new.sobre_usuario_id is not distinct from old.sobre_usuario_id then
    return new;
  end if;
  raise exception 'Mensagem do chat só muda pela porta de editar/apagar — e nunca se apaga de verdade.';
end;
$$;

-- O que vai ao vivo (recriada POR INTEIRO a partir da migration 38): + o card
-- da menção; e a mudança (editada/apagada) para quem está com a conversa aberta.
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

  if tg_op = 'UPDATE' then
    perform realtime.send(
      jsonb_build_object(
        'id', new.id, 'conversa_id', new.conversa_id,
        'texto', case when new.apagada_em is null then new.texto end,
        'editada_em', new.editada_em, 'apagada_em', new.apagada_em),
      'mensagem_mudou', 'plt-chat-c:' || new.conversa_id, true);
    return null;
  end if;

  perform realtime.send(
    jsonb_build_object(
      'id',          new.id,
      'conversa_id', new.conversa_id,
      'autor_id',    new.autor_id,
      'autor_nome',  coalesce(v_autor_nome, 'Sistema'),
      'autor_foto',  v_autor_foto,
      'tipo',        new.tipo,
      'texto',       new.texto,
      'card_id',     new.card_id,
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
  after insert or update on public.plt_chat_mensagens
  for each row execute function plt_privado.fn_chat_transmitir_mensagem();

-- As mensagens de uma conversa (recriada a partir da migration 38 — forma
-- nova, drop + create): + editada, apagada, o card da menção. A apagada vem
-- sem o texto — o admin vê o texto (só nas conversas de que participa).
drop function if exists public.plt_fn_chat_mensagens(bigint, bigint, integer);
create function public.plt_fn_chat_mensagens(
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
  criada_em   timestamptz,
  card_id     bigint,
  editada_em  timestamptz,
  apagada_em  timestamptz,
  editada_vezes integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_admin boolean := plt_privado.fn_eh_admin();
begin
  if not plt_privado.fn_chat_participa(p_conversa_id) then
    raise exception 'Você não participa desta conversa.' using errcode = 'insufficient_privilege';
  end if;

  return query
  select m.id, m.conversa_id, m.autor_id, coalesce(u.nome, 'Sistema'), u.foto_caminho,
         m.tipo, case when m.apagada_em is null or v_admin then m.texto end, m.criada_em,
         m.card_id, m.editada_em, m.apagada_em,
         (select count(*)::int from public.plt_chat_versoes v where v.mensagem_id = m.id)
    from public.plt_chat_mensagens m
    left join public.plt_usuarios u on u.id = m.autor_id
   where m.conversa_id = p_conversa_id
     and (p_antes_id is null or m.id < p_antes_id)
   order by m.id desc
   limit least(greatest(coalesce(p_limite, 10), 1), 10);
end;
$$;

-- Editar a própria mensagem (D-131): a versão anterior fica guardada.
create or replace function public.plt_fn_chat_editar(p_mensagem_id bigint, p_texto text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu    uuid := plt_privado.fn_usuario_atual();
  v_msg   public.plt_chat_mensagens%rowtype;
  v_texto text := btrim(coalesce(p_texto, ''));
  v_marca text;
begin
  select * into v_msg from public.plt_chat_mensagens where id = p_mensagem_id for update;
  if not found or not plt_privado.fn_chat_participa(v_msg.conversa_id) then
    raise exception 'Mensagem não encontrada.' using errcode = 'no_data_found';
  end if;
  if v_msg.autor_id is distinct from v_eu or v_msg.tipo <> 'texto' then
    raise exception 'Cada um edita só a própria mensagem.' using errcode = 'insufficient_privilege';
  end if;
  if v_msg.apagada_em is not null then
    raise exception 'Mensagem apagada não se edita.' using errcode = 'check_violation';
  end if;
  if v_texto = '' or char_length(v_texto) > 2000 then
    raise exception 'A mensagem tem de 1 a 2.000 caracteres.' using errcode = 'check_violation';
  end if;
  if v_texto = v_msg.texto then
    return;                                  -- nada mudou: nada se grava
  end if;
  insert into public.plt_chat_versoes (mensagem_id, texto, trocada_por) values (p_mensagem_id, v_msg.texto, v_eu);
  v_marca := current_setting('plt.chat_maquinaria', true);
  perform set_config('plt.chat_maquinaria', 'on', true);
  update public.plt_chat_mensagens set texto = v_texto, editada_em = now() where id = p_mensagem_id;
  perform set_config('plt.chat_maquinaria', coalesce(v_marca, ''), true);
end;
$$;

-- Apagar a própria mensagem (D-131): vira "Mensagem apagada"; o texto fica.
create or replace function public.plt_fn_chat_apagar(p_mensagem_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu    uuid := plt_privado.fn_usuario_atual();
  v_msg   public.plt_chat_mensagens%rowtype;
  v_marca text;
begin
  select * into v_msg from public.plt_chat_mensagens where id = p_mensagem_id for update;
  if not found or not plt_privado.fn_chat_participa(v_msg.conversa_id) then
    raise exception 'Mensagem não encontrada.' using errcode = 'no_data_found';
  end if;
  if v_msg.autor_id is distinct from v_eu or v_msg.tipo not in ('texto', 'mencao') then
    raise exception 'Cada um apaga só a própria mensagem.' using errcode = 'insufficient_privilege';
  end if;
  if v_msg.apagada_em is not null then
    return;
  end if;
  v_marca := current_setting('plt.chat_maquinaria', true);
  perform set_config('plt.chat_maquinaria', 'on', true);
  update public.plt_chat_mensagens set apagada_em = now() where id = p_mensagem_id;
  perform set_config('plt.chat_maquinaria', coalesce(v_marca, ''), true);
end;
$$;

-- As versões anteriores de uma mensagem do chat: só o admin, só onde participa.
create or replace function public.plt_fn_chat_versoes(p_mensagem_id bigint)
returns table (texto text, trocada_por text, trocada_em timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select v.texto, u.nome, v.trocada_em
    from public.plt_chat_versoes v
    join public.plt_chat_mensagens m on m.id = v.mensagem_id
    left join public.plt_usuarios u on u.id = v.trocada_por
   where v.mensagem_id = p_mensagem_id
     and plt_privado.fn_eh_admin()
     and plt_privado.fn_chat_participa(m.conversa_id)
   order by v.id;
$$;

-- A particular entre duas pessoas (a mesma regra de plt_fn_chat_abrir_particular),
-- para a maquinaria da menção.
create or replace function plt_privado.fn_chat_particular(p_um uuid, p_outro uuid)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_chave text := least(p_um::text, p_outro::text) || ':' || greatest(p_um::text, p_outro::text);
  v_id    bigint;
begin
  insert into public.plt_chat_conversas (tipo, chave_particular)
  values ('particular', v_chave)
  on conflict (chave_particular) where tipo = 'particular' do nothing
  returning id into v_id;
  if v_id is null then
    select c.id into v_id from public.plt_chat_conversas c
     where c.tipo = 'particular' and c.chave_particular = v_chave;
  end if;
  insert into public.plt_chat_participantes (conversa_id, usuario_id)
  values (v_id, p_um), (v_id, p_outro)
  on conflict (conversa_id, usuario_id) do nothing;
  return v_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3 · O sino ao vivo (Lei §4): aviso novo → sinal no canal da pessoa (o
--     mesmo do chat, já privado), aplicado no cache sem reler.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_aviso_transmitir()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform plt_privado.fn_chat_sinal(new.destinatario_id, 'aviso',
    jsonb_build_object('id', new.id, 'tipo', new.tipo, 'titulo', new.titulo, 'corpo', new.corpo,
                       'card_id', new.card_id, 'lida_em', new.lida_em, 'criada_em', new.criada_em));
  return null;
end;
$$;

drop trigger if exists plt_notificacoes_transmitir on public.plt_notificacoes;
create trigger plt_notificacoes_transmitir
  after insert on public.plt_notificacoes
  for each row execute function plt_privado.fn_aviso_transmitir();

-- ----------------------------------------------------------------------------
-- 4 · As portas da conversa do card
-- ----------------------------------------------------------------------------
-- Mandar mensagem (recriada a partir da migration 60 — forma nova): quem vê o
-- card (e o entregador da rota) conversa; @menção avisa no sino e na
-- particular; o mesmo toque (p_chave) = uma mensagem só; o PIN do tablet.
drop function if exists public.plt_fn_card_comentar(bigint, text);
create or replace function public.plt_fn_card_comentar(
  p_card_id     bigint,
  p_texto       text,
  p_mencoes     uuid[] default null,
  p_chave       uuid   default null,
  p_operador_id uuid   default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid := plt_privado.fn_usuario_atual();
  v_texto   text := btrim(coalesce(p_texto, ''));
  v_card    public.plt_cards%rowtype;
  v_mencoes uuid[];
  v_evento  bigint;
  v_marca   text;
  v_m       uuid;
  v_nome    text;
  v_rotulo  text;
  v_conversa bigint;
  v_msg     bigint;
begin
  if v_usuario is null or not plt_privado.fn_pode_anexar(p_card_id) then
    raise exception 'Conversar neste card é de quem vê o card (o setor, os responsáveis, a logística) — ou do entregador do caminhão.'
      using errcode = 'insufficient_privilege';
  end if;
  select * into v_card from public.plt_cards where id = p_card_id;
  if p_operador_id is not null then
    v_usuario := plt_privado.fn_autor_do_gesto(v_card.setor_atual_id, p_operador_id);
  end if;
  if char_length(v_texto) = 0 or char_length(v_texto) > 1000 then
    raise exception 'A mensagem tem de 1 a 1.000 letras.' using errcode = 'check_violation';
  end if;
  -- Lei §10: o mesmo toque (clique duplo, rede que volta) = a mesma mensagem.
  if p_chave is not null then
    select e.id into v_evento
      from public.plt_eventos e
     where e.card_id = p_card_id and e.tipo = 'comentario_adicionado' and e.usuario_id = v_usuario
       and e.dados ->> 'chave' = p_chave::text
     limit 1;
    if v_evento is not null then
      return v_evento;
    end if;
  end if;
  -- Os mencionados: ativos, sem repetir, sem a própria pessoa (não se avisa).
  select coalesce(array_agg(distinct x), '{}') into v_mencoes
    from unnest(coalesce(p_mencoes, '{}'::uuid[])) x
   where x <> v_usuario and exists (select 1 from public.plt_usuarios u where u.id = x and u.ativo);
  if coalesce(array_length(v_mencoes, 1), 0) > 10 then
    raise exception 'No máximo 10 pessoas mencionadas por mensagem.' using errcode = 'check_violation';
  end if;

  v_marca := current_setting('plt.card_maquinaria', true);
  perform set_config('plt.card_maquinaria', 'on', true);
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, observacao, dados)
    values (p_card_id, 'comentario_adicionado', v_usuario, 'interface', v_card.setor_atual_id, v_texto,
            jsonb_build_object('chave', p_chave, 'mencoes', to_jsonb(v_mencoes)))
    returning id into v_evento;
  perform set_config('plt.card_maquinaria', coalesce(v_marca, ''), true);

  -- §3: a menção vira aviso no sino E o cartão na particular entre os dois.
  if coalesce(array_length(v_mencoes, 1), 0) > 0 then
    select u.nome into v_nome from public.plt_usuarios u where u.id = v_usuario;
    v_rotulo := left(coalesce(plt_privado.fn_card_rotulo(p_card_id), 'card'), 80);
    foreach v_m in array v_mencoes loop
      insert into public.plt_notificacoes (destinatario_id, evento_id, card_id, tipo, titulo, corpo)
        values (v_m, v_evento, p_card_id, 'card_mencao',
                coalesce(v_nome, 'Alguém') || ' mencionou você no card "' || v_rotulo || '"',
                left(v_texto, 200));
      v_conversa := plt_privado.fn_chat_particular(v_usuario, v_m);
      insert into public.plt_chat_mensagens (conversa_id, autor_id, tipo, texto, card_id)
        values (v_conversa, v_usuario, 'mencao', left('📌 mencionou você no card "' || v_rotulo || '": ' || v_texto, 2000), p_card_id)
        returning id into v_msg;
      -- para quem mencionou, o cartão já nasce lido
      update public.plt_chat_participantes x
         set ultima_lida_id = greatest(x.ultima_lida_id, v_msg)
       where x.conversa_id = v_conversa and x.usuario_id = v_usuario;
    end loop;
  end if;
  return v_evento;
end;
$$;

comment on function public.plt_fn_card_comentar(bigint, text, uuid[], uuid, uuid) is
  'SESSAO-31 (§3): a mensagem na conversa do card — fato do card (comentario_adicionado). @menção: aviso no sino + cartão "mencionou você" na particular dos dois; mencionar a si mesmo não avisa; o mencionado passa a ver o card. p_chave = o mesmo toque devolve a mesma mensagem. p_operador_id = o PIN do tablet.';

-- Editar e apagar a própria mensagem (D-131) — fatos novos, com a referência.
create or replace function public.plt_fn_card_mensagem_editar(p_mensagem_id bigint, p_texto text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu    uuid := plt_privado.fn_usuario_atual();
  v_msg   public.plt_card_mensagens%rowtype;
  v_texto text := btrim(coalesce(p_texto, ''));
  v_marca text;
begin
  select * into v_msg from public.plt_card_mensagens where evento_id = p_mensagem_id;
  if not found or not plt_privado.fn_pode_anexar(v_msg.card_id) then
    raise exception 'Mensagem não encontrada.' using errcode = 'no_data_found';
  end if;
  if v_msg.autor_id is distinct from v_eu then
    raise exception 'Cada um edita só a própria mensagem.' using errcode = 'insufficient_privilege';
  end if;
  if v_msg.apagada_em is not null then
    raise exception 'Mensagem apagada não se edita.' using errcode = 'check_violation';
  end if;
  if char_length(v_texto) = 0 or char_length(v_texto) > 1000 then
    raise exception 'A mensagem tem de 1 a 1.000 letras.' using errcode = 'check_violation';
  end if;
  if v_texto = v_msg.texto then
    return;
  end if;
  v_marca := current_setting('plt.card_maquinaria', true);
  perform set_config('plt.card_maquinaria', 'on', true);
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, evento_referencia_id, observacao, dados)
    values (v_msg.card_id, 'comentario_editado', v_eu, 'interface', p_mensagem_id, v_texto,
            jsonb_build_object('antes', v_msg.texto));
  perform set_config('plt.card_maquinaria', coalesce(v_marca, ''), true);
end;
$$;

create or replace function public.plt_fn_card_mensagem_apagar(p_mensagem_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu    uuid := plt_privado.fn_usuario_atual();
  v_msg   public.plt_card_mensagens%rowtype;
  v_marca text;
begin
  select * into v_msg from public.plt_card_mensagens where evento_id = p_mensagem_id;
  if not found or not plt_privado.fn_pode_anexar(v_msg.card_id) then
    raise exception 'Mensagem não encontrada.' using errcode = 'no_data_found';
  end if;
  if v_msg.autor_id is distinct from v_eu then
    raise exception 'Cada um apaga só a própria mensagem.' using errcode = 'insufficient_privilege';
  end if;
  if v_msg.apagada_em is not null then
    return;
  end if;
  v_marca := current_setting('plt.card_maquinaria', true);
  perform set_config('plt.card_maquinaria', 'on', true);
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, evento_referencia_id)
    values (v_msg.card_id, 'comentario_apagado', v_eu, 'interface', p_mensagem_id);
  perform set_config('plt.card_maquinaria', coalesce(v_marca, ''), true);
end;
$$;

-- A conversa do card, 10 por página por cursor (o mais novo primeiro). Com
-- p_tudo, os fatos do card entram na mesma linha do tempo ("Só conversa | Tudo").
-- Apagada vem sem o texto — o admin vê (quem vê o card).
create or replace function public.plt_fn_card_mensagens(
  p_card_id  bigint,
  p_antes_id bigint  default null,
  p_limite   integer default 10,
  p_tudo     boolean default false
)
returns table (
  id            bigint,
  tipo          text,
  autor_id      uuid,
  autor_nome    text,
  autor_foto    text,
  texto         text,
  mencoes       jsonb,
  criada_em     timestamptz,
  editada_em    timestamptz,
  apagada_em    timestamptz,
  editada_vezes integer,
  resumo        jsonb,
  tem_mais      boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_n     integer := least(greatest(coalesce(p_limite, 10), 1), 20);
  v_admin boolean := plt_privado.fn_eh_admin();
begin
  if not plt_privado.fn_pode_anexar(p_card_id) then
    raise exception 'Você não vê este card.' using errcode = 'insufficient_privilege';
  end if;

  return query
  with linhas as (
    select m.evento_id as id, 'mensagem'::text as tipo, m.autor_id, m.criada_em as quando,
           m.texto, m.mencoes, m.editada_em, m.apagada_em, null::jsonb as resumo
      from public.plt_card_mensagens m
     where m.card_id = p_card_id and (p_antes_id is null or m.evento_id < p_antes_id)
    union all
    select e.id, e.tipo, e.usuario_id, e.ocorrido_em, e.observacao, '{}'::uuid[], null, null,
           jsonb_strip_nulls(jsonb_build_object(
             'setor_origem', so.nome, 'setor_destino', sd.nome, 'etapa_destino', ed.nome,
             'estado', e.estado_qualidade, 'origem', e.origem,
             'etiqueta', (select t.nome from public.plt_etiquetas t where t.id = nullif(e.dados ->> 'etiqueta_id', '')::bigint),
             'responsavel', (select u2.nome from public.plt_usuarios u2 where u2.id = nullif(e.dados ->> 'responsavel_id', '')::uuid),
             'mudancas', e.dados -> 'mudancas'))
      from public.plt_eventos e
      left join public.plt_setores so on so.id = e.setor_origem_id
      left join public.plt_setores sd on sd.id = e.setor_destino_id
      left join public.plt_etapas  ed on ed.id = e.etapa_destino_id
     where coalesce(p_tudo, false)
       and e.card_id = p_card_id and (p_antes_id is null or e.id < p_antes_id)
       and e.tipo not in ('comentario_adicionado', 'comentario_editado', 'comentario_apagado', 'notificacao_enviada')
     order by 1 desc
     limit v_n + 1
  ),
  numeradas as (select l.*, row_number() over (order by l.id desc) as rn from linhas l)
  select x.id, x.tipo, x.autor_id, coalesce(u.nome, 'Sistema'), u.foto_caminho,
         case when x.tipo <> 'mensagem' or x.apagada_em is null or v_admin then x.texto end,
         coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome) order by p.nome)
                     from public.plt_usuarios p where p.id = any (x.mencoes)), '[]'::jsonb),
         x.quando, x.editada_em, x.apagada_em,
         case when x.tipo = 'mensagem'
              then (select count(*)::int from public.plt_eventos v
                     where v.evento_referencia_id = x.id and v.tipo = 'comentario_editado') else 0 end,
         x.resumo,
         (select count(*) from linhas) > v_n
    from numeradas x
    left join public.plt_usuarios u on u.id = x.autor_id
   where x.rn <= v_n
   order by x.id desc;
end;
$$;

comment on function public.plt_fn_card_mensagens(bigint, bigint, integer, boolean) is
  'SESSAO-31 (§3 · D-131): a conversa do card por cursor (10 por página; teto 20); com p_tudo, os fatos do card entram na mesma linha ("Só conversa | Tudo"). Apagada sem o texto — o admin vê.';

-- As versões anteriores de uma mensagem do card: só o admin (que vê o card).
create or replace function public.plt_fn_card_mensagem_versoes(p_mensagem_id bigint)
returns table (texto text, trocada_por text, trocada_em timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select e.dados ->> 'antes', u.nome, e.ocorrido_em
    from public.plt_eventos e
    join public.plt_card_mensagens m on m.evento_id = e.evento_referencia_id
    left join public.plt_usuarios u on u.id = e.usuario_id
   where e.evento_referencia_id = p_mensagem_id and e.tipo = 'comentario_editado'
     and plt_privado.fn_eh_admin() and plt_privado.fn_pode_anexar(m.card_id)
   order by e.id;
$$;

-- ----------------------------------------------------------------------------
-- 5 · Quem chama o quê
-- ----------------------------------------------------------------------------
revoke all on function plt_privado.fn_projetar_mensagem_do_card()   from public, anon, authenticated;
revoke all on function plt_privado.fn_transmitir_mensagem_do_card() from public, anon, authenticated;
revoke all on function plt_privado.fn_chat_particular(uuid, uuid)   from public, anon, authenticated;
revoke all on function plt_privado.fn_aviso_transmitir()            from public, anon, authenticated;
revoke all on function plt_privado.fn_card_pode_ouvir(text)         from public, anon;
-- a regra do Realtime chama como quem está logado
grant execute on function plt_privado.fn_card_pode_ouvir(text)      to authenticated;

revoke all on function public.plt_fn_card_comentar(bigint, text, uuid[], uuid, uuid)        from public, anon;
revoke all on function public.plt_fn_card_mensagem_editar(bigint, text)                     from public, anon;
revoke all on function public.plt_fn_card_mensagem_apagar(bigint)                           from public, anon;
revoke all on function public.plt_fn_card_mensagens(bigint, bigint, integer, boolean)       from public, anon;
revoke all on function public.plt_fn_card_mensagem_versoes(bigint)                          from public, anon;
revoke all on function public.plt_fn_chat_mensagens(bigint, bigint, integer)                from public, anon;
revoke all on function public.plt_fn_chat_editar(bigint, text)                              from public, anon;
revoke all on function public.plt_fn_chat_apagar(bigint)                                    from public, anon;
revoke all on function public.plt_fn_chat_versoes(bigint)                                   from public, anon;
grant execute on function public.plt_fn_card_comentar(bigint, text, uuid[], uuid, uuid)     to authenticated;
grant execute on function public.plt_fn_card_mensagem_editar(bigint, text)                  to authenticated;
grant execute on function public.plt_fn_card_mensagem_apagar(bigint)                        to authenticated;
grant execute on function public.plt_fn_card_mensagens(bigint, bigint, integer, boolean)    to authenticated;
grant execute on function public.plt_fn_card_mensagem_versoes(bigint)                       to authenticated;
grant execute on function public.plt_fn_chat_mensagens(bigint, bigint, integer)             to authenticated;
grant execute on function public.plt_fn_chat_editar(bigint, text)                           to authenticated;
grant execute on function public.plt_fn_chat_apagar(bigint)                                 to authenticated;
grant execute on function public.plt_fn_chat_versoes(bigint)                                to authenticated;
