-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 96 — TABLET 2.0, parte 2:
-- AUXILIARES NO CARD e a PRESENÇA DA PESSOA (trabalhando · ausente · à deriva)
-- (SESSAO-36 · D-146)
--
-- O que nasce aqui:
--   1. AUXÍLIO: fatos novos em plt_eventos (auxilio_iniciado/pausado/retomado/
--      encerrado) — outra pessoa entra num card EM EXECUÇÃO pelo PIN, com tempo
--      PRÓPRIO, sem mexer no tempo do card nem no executor (D-146; o tempo que
--      já existe não quebra). Projeção plt_auxilios + plt_cards.auxiliares.
--      A pausa e o fim do card pausam/encerram os auxílios juntos; concluir
--      fecha o tempo de todos (resposta 8).
--   2. PRESENÇA: a pessoa está em UM setor por vez. Fatos próprios em
--      plt_presenca_eventos (append-only por gatilho — card_id não cabe em
--      plt_eventos); projeções plt_presenca_atual (onde a pessoa está) e
--      plt_presenca_segmentos (trabalhando · ausente · à deriva, um segmento
--      por estado); agregado diário plt_tempos_pessoa_dia mantido no fechamento
--      de cada segmento (a dashboard NUNCA varre eventos — Lei §7.1).
--      Entrada automática: iniciar/retomar/auxiliar num setor onde a pessoa
--      ainda não deu entrada JÁ dá a entrada (D-146/§3 da demanda).
--   3. Motivos de SAÍDA (lista própria em Configurações — resposta 6).
--   4. fn_autor_do_gesto aceita operador de outro setor com "pode auxiliar"
--      (setores sem fronteira); fn_validar_execucao conta auxílios no limite.
--   5. O quadro numa requisição passa a trazer os auxílios e as pessoas
--      presentes no setor (o ícone do canto superior direito do tablet).
--
-- Nada aqui toca as tabelas da integração.
-- Idempotente: pode rodar duas vezes seguidas sem erro.
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · Os fatos novos do AUXÍLIO no check de plt_eventos (E-19: recriado
--     `not valid`; quem valida é o fim DESTA migration — o validate saiu da
--     migration da devolução, que era a mais nova do check)
-- ----------------------------------------------------------------------------
do $$
declare
  v_nome text;
begin
  select conname into v_nome
    from pg_constraint
   where conrelid = 'public.plt_eventos'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%card_criado%';
  if v_nome is not null then
    execute format('alter table public.plt_eventos drop constraint %I', v_nome);
  end if;
  alter table public.plt_eventos add constraint plt_eventos_tipo_check
    check (tipo in (
      'card_criado', 'movimentacao_setor', 'movimentacao_etapa',
      'execucao_iniciada', 'execucao_finalizada', 'execucao_pausada', 'execucao_retomada',
      'qualidade_marcada', 'qualidade_parecer', 'divergencia_registrada', 'notificacao_enviada',
      'delegacao', 'estorno', 'pedido_atualizado', 'pedido_cancelado', 'card_arquivado',
      'pedido_entregue', 'pedido_lancado_rotas', 'unidade_desvinculada', 'peca_alocada',
      'peca_reservada', 'peca_reserva_desfeita', 'estoque_reserva_avaliada',
      'etiqueta_adicionada', 'etiqueta_removida', 'card_desarquivado',
      'entrega_desfeita', 'entrega_nao_realizada',
      'pedido_devolvido',
      'comentario_adicionado', 'anexo_adicionado',
      'devolucao_decidida', 'ajuste_aberto', 'ajuste_concluido',
      'avulso_concluido', 'card_editado',
      'responsavel_adicionado', 'responsavel_removido',
      'anexo_removido', 'comentario_editado', 'comentario_apagado',
      -- SESSAO-36 (D-146): o auxílio — outra pessoa no card em execução,
      -- com tempo próprio; o executor e o tempo do card não mudam
      'auxilio_iniciado', 'auxilio_pausado', 'auxilio_retomado', 'auxilio_encerrado'
    )) not valid;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2 · Motivos de SAÍDA (resposta 6 — lista separada da de pausa)
-- ----------------------------------------------------------------------------
alter table public.plt_motivos drop constraint if exists plt_motivos_tipo_ck;
alter table public.plt_motivos add constraint plt_motivos_tipo_ck
  check (tipo in ('nao_entregue', 'desfazer_entrega', 'devolucao', 'pausa', 'saida'))
  not valid; -- E-19: recriado not valid; o validate fica no fim desta migration (a mais nova do check)
alter table public.plt_motivos validate constraint plt_motivos_tipo_ck;

insert into public.plt_motivos (tipo, texto, ordem)
select x.tipo, x.texto, x.ordem
  from (values
    ('saida', 'Fim do turno', 10),
    ('saida', 'Almoço', 20),
    ('saida', 'Atendimento médico', 30),
    ('saida', 'Serviço fora do galpão', 40),
    ('saida', 'Saída autorizada pelo líder', 50)
  ) as x(tipo, texto, ordem)
 where not exists (select 1 from public.plt_motivos m
                    where m.tipo = x.tipo and lower(btrim(m.texto)) = lower(btrim(x.texto)));

-- recriada POR INTEIRO a partir da versão viva (migration da devolução),
-- só com o tipo novo na lista
create or replace function public.plt_fn_motivo_salvar(
  p_id    bigint,
  p_tipo  text,
  p_texto text,
  p_ordem integer default null,
  p_ativo boolean default true
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
begin
  if not plt_privado.fn_eh_admin() then
    raise exception 'Cadastrar motivo é gesto de admin.' using errcode = 'insufficient_privilege';
  end if;
  -- SESSAO-36: + saída (D-146 resposta 6).
  if p_tipo not in ('nao_entregue', 'desfazer_entrega', 'devolucao', 'pausa', 'saida') then
    raise exception 'Tipo de motivo desconhecido.' using errcode = 'check_violation';
  end if;
  if char_length(btrim(coalesce(p_texto, ''))) not between 2 and 80 then
    raise exception 'O motivo precisa ter de 2 a 80 letras — uma frase curta.' using errcode = 'check_violation';
  end if;
  if p_id is null then
    insert into public.plt_motivos (tipo, texto, ordem, ativo)
      values (p_tipo, btrim(p_texto), coalesce(p_ordem, 100), coalesce(p_ativo, true))
      returning id into v_id;
  else
    update public.plt_motivos
       set texto = btrim(p_texto), ordem = coalesce(p_ordem, ordem), ativo = coalesce(p_ativo, ativo),
           atualizado_em = now()
     where id = p_id and tipo = p_tipo
     returning id into v_id;
    if v_id is null then
      raise exception 'Motivo não encontrado.' using errcode = 'no_data_found';
    end if;
  end if;
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (plt_privado.fn_usuario_atual(), 'motivo_salvo',
            jsonb_build_object('motivo_id', v_id, 'tipo', p_tipo, 'texto', btrim(p_texto), 'ativo', coalesce(p_ativo, true)));
  return v_id;
exception when unique_violation then
  raise exception 'Já existe esse motivo.' using errcode = 'unique_violation';
end;
$$;

-- O motivo escolhido de uma lista qualquer (generaliza a fn_motivo_de_pausa,
-- que continua existindo): um da lista do tipo, ou "Outro" com texto.
create or replace function plt_privado.fn_motivo_da_lista(p_tipo text, p_motivo_id bigint, p_texto text)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_txt text;
begin
  if p_motivo_id is not null then
    select m.texto into v_txt from public.plt_motivos m where m.id = p_motivo_id and m.tipo = p_tipo and m.ativo;
    if v_txt is null then
      raise exception 'Escolha um motivo da lista (ou "Outro", escrevendo o motivo).' using errcode = 'check_violation';
    end if;
    if nullif(btrim(coalesce(p_texto, '')), '') is not null then
      v_txt := v_txt || ' — ' || left(btrim(p_texto), 200);
    end if;
    return v_txt;
  end if;
  v_txt := nullif(btrim(coalesce(p_texto, '')), '');
  if v_txt is null then
    raise exception 'Diga o motivo.' using errcode = 'check_violation';
  end if;
  return left(v_txt, 200);
end;
$$;

revoke all on function plt_privado.fn_motivo_da_lista(text, bigint, text) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3 · A projeção do auxílio (M-13): uma linha por auxílio, com o tempo fechado
--     acumulado — a dashboard e a janela leem daqui, nunca varrem eventos.
-- ----------------------------------------------------------------------------
create table if not exists public.plt_auxilios (
  id                bigint generated always as identity primary key,
  card_id           bigint not null references public.plt_cards(id),
  usuario_id        uuid not null references public.plt_usuarios(id),
  evento_inicio_id  bigint not null unique references public.plt_eventos(id),
  iniciado_em       timestamptz not null,
  -- o começo do trecho aberto de agora (iniciado ou retomado); nulo = pausado/encerrado
  ultimo_inicio     timestamptz,
  pausado_em        timestamptz,
  pausa_motivo      text,
  -- o tempo já fechado (sem as pausas), somado a cada pausa/encerramento
  segundos          bigint not null default 0,
  encerrado_em      timestamptz,
  encerramento      text check (encerramento in ('gesto', 'conclusao', 'movimentacao', 'arquivado', 'saida')),
  setor_id          bigint references public.plt_setores(id)
);

comment on table public.plt_auxilios is
  'SESSAO-36 (D-146): projeção dos fatos de auxílio — o tempo PRÓPRIO de cada pessoa que entrou num card em execução. Escrita só pelo gatilho; leitura pelas portas.';

create unique index if not exists plt_auxilios_aberto_uq
  on public.plt_auxilios (card_id, usuario_id) where encerrado_em is null;
create index if not exists plt_auxilios_card_idx
  on public.plt_auxilios (card_id) where encerrado_em is null;
create index if not exists plt_auxilios_usuario_idx
  on public.plt_auxilios (usuario_id) where encerrado_em is null;

alter table public.plt_auxilios enable row level security;
revoke all on public.plt_auxilios from anon, authenticated, public;

alter table public.plt_cards add column if not exists auxiliares uuid[] not null default '{}';
comment on column public.plt_cards.auxiliares is
  'SESSAO-36: projeção — quem está no card como auxiliar agora (escrita só pelo gatilho do auxílio).';

-- ----------------------------------------------------------------------------
-- 4 · A guarda do auxílio (BEFORE — vale para todo escritor, M-14)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_validar_auxilio()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card    public.plt_cards%rowtype;
  v_aux     public.plt_auxilios%rowtype;
  v_limite  integer;
  v_abertos integer;
  v_pessoa  public.plt_usuarios%rowtype;
  v_papel   text;
  v_lider   boolean;
begin
  if new.tipo not in ('auxilio_iniciado', 'auxilio_pausado', 'auxilio_retomado', 'auxilio_encerrado') then
    return new;
  end if;

  select * into v_card from public.plt_cards where id = new.card_id;
  if not found then
    raise exception 'Card % não existe.', new.card_id using errcode = 'foreign_key_violation';
  end if;
  if new.usuario_id is null then
    raise exception 'Auxiliar é gesto de pessoa: é preciso dizer quem.' using errcode = 'check_violation';
  end if;

  new.setor_origem_id := coalesce(new.setor_origem_id, v_card.setor_atual_id);
  new.etapa_origem_id := coalesce(new.etapa_origem_id, v_card.etapa_atual_id);

  if new.tipo = 'auxilio_iniciado' then
    select * into v_pessoa from public.plt_usuarios u where u.id = new.usuario_id and u.ativo;
    if v_pessoa.id is null then
      raise exception 'Auxiliar exige um usuário ativo da plataforma.' using errcode = 'check_violation';
    end if;
    if v_pessoa.conta_tablet then
      raise exception 'A conta do tablet não trabalha em card — identifique a pessoa pelo PIN.' using errcode = 'check_violation';
    end if;
    if v_card.arquivado_em is not null or v_card.concluido_em is not null then
      raise exception 'Este card já saiu da produção — não há o que auxiliar.' using errcode = 'check_violation';
    end if;
    if v_card.executor_atual_id is null then
      -- D-146: o botão Auxiliar existe no card EM EXECUÇÃO.
      raise exception 'Este card não está em execução — inicie-o em vez de auxiliar.' using errcode = 'check_violation';
    end if;
    if v_card.executor_atual_id = new.usuario_id then
      raise exception 'Esta pessoa já executa este card.' using errcode = 'check_violation';
    end if;
    if exists (select 1 from public.plt_auxilios a
                where a.card_id = new.card_id and a.usuario_id = new.usuario_id and a.encerrado_em is null) then
      raise exception 'Esta pessoa já está auxiliando este card.' using errcode = 'check_violation';
    end if;
    -- Setores sem fronteira (D-146): gente do setor, quem pode auxiliar, ou admin.
    if v_pessoa.papel <> 'admin'
       and not coalesce(v_pessoa.pode_auxiliar, false)
       and not exists (select 1 from public.plt_usuario_setores us
                        where us.usuario_id = new.usuario_id and us.setor_id = v_card.setor_atual_id) then
      raise exception 'Esta pessoa não trabalha neste setor e o cadastro dela não permite auxiliar em outros setores.'
        using errcode = 'insufficient_privilege';
    end if;
    -- O limite por pessoa (D-48) vale também para o auxílio.
    select s.limite_execucoes_por_pessoa into v_limite
      from public.plt_setores s where s.id = v_card.setor_atual_id;
    if v_limite is not null then
      select (select count(*) from public.plt_cards c
               where c.executor_atual_id = new.usuario_id
                 and c.setor_atual_id = v_card.setor_atual_id
                 and c.pausado_em is null)
           + (select count(*) from public.plt_auxilios a
                join public.plt_cards c2 on c2.id = a.card_id
               where a.usuario_id = new.usuario_id and a.encerrado_em is null and a.pausado_em is null
                 and c2.setor_atual_id = v_card.setor_atual_id and a.card_id <> new.card_id)
        into v_abertos;
      if v_abertos >= v_limite then
        raise exception 'Limite do setor atingido: esta pessoa já tem % card(s) em andamento aqui (máximo %).',
          v_abertos, v_limite using errcode = 'check_violation';
      end if;
    end if;

  else
    -- pausar / retomar / encerrar apontam o auxílio aberto da pessoa no card
    select a.* into v_aux from public.plt_auxilios a
     where a.card_id = new.card_id and a.usuario_id = new.usuario_id and a.encerrado_em is null;
    if v_aux.id is null then
      raise exception 'Esta pessoa não está auxiliando este card.' using errcode = 'check_violation';
    end if;
    if new.evento_referencia_id is null then
      new.evento_referencia_id := v_aux.evento_inicio_id;
    end if;
    if new.tipo = 'auxilio_pausado' then
      if v_aux.pausado_em is not null then
        raise exception 'Este auxílio já está pausado.' using errcode = 'check_violation';
      end if;
      if nullif(btrim(coalesce(new.dados ->> 'motivo', '')), '') is null then
        raise exception 'Diga o motivo da pausa.' using errcode = 'check_violation';
      end if;
    elsif new.tipo = 'auxilio_retomado' then
      if v_aux.pausado_em is null then
        raise exception 'Este auxílio não está pausado — não há o que retomar.' using errcode = 'check_violation';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists plt_eventos_validar_auxilio on public.plt_eventos;
create trigger plt_eventos_validar_auxilio
  before insert on public.plt_eventos
  for each row execute function plt_privado.fn_validar_auxilio();

-- ----------------------------------------------------------------------------
-- 5 · A projeção do auxílio (AFTER) — escreve plt_auxilios e plt_cards.auxiliares
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_projetar_auxilio()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_aux public.plt_auxilios%rowtype;
begin
  if new.tipo = 'auxilio_iniciado' then
    insert into public.plt_auxilios
        (card_id, usuario_id, evento_inicio_id, iniciado_em, ultimo_inicio, setor_id)
      values
        (new.card_id, new.usuario_id, new.id, new.ocorrido_em, new.ocorrido_em, new.setor_origem_id);
    update public.plt_cards c
       set auxiliares = array_append(array_remove(c.auxiliares, new.usuario_id), new.usuario_id)
     where c.id = new.card_id;

  elsif new.tipo = 'auxilio_pausado' then
    update public.plt_auxilios a
       set pausado_em = new.ocorrido_em,
           pausa_motivo = left(coalesce(new.dados ->> 'motivo', ''), 200),
           segundos = a.segundos + greatest(0, floor(extract(epoch from new.ocorrido_em - coalesce(a.ultimo_inicio, new.ocorrido_em))))::bigint,
           ultimo_inicio = null
     where a.card_id = new.card_id and a.usuario_id = new.usuario_id and a.encerrado_em is null;

  elsif new.tipo = 'auxilio_retomado' then
    update public.plt_auxilios a
       set pausado_em = null, pausa_motivo = null, ultimo_inicio = new.ocorrido_em
     where a.card_id = new.card_id and a.usuario_id = new.usuario_id and a.encerrado_em is null;

  elsif new.tipo = 'auxilio_encerrado' then
    update public.plt_auxilios a
       set segundos = a.segundos + case when a.ultimo_inicio is null then 0
             else greatest(0, floor(extract(epoch from new.ocorrido_em - a.ultimo_inicio)))::bigint end,
           ultimo_inicio = null,
           encerrado_em = new.ocorrido_em,
           encerramento = coalesce(new.dados ->> 'como', 'gesto')
     where a.card_id = new.card_id and a.usuario_id = new.usuario_id and a.encerrado_em is null
     returning a.* into v_aux;
    update public.plt_cards c
       set auxiliares = array_remove(c.auxiliares, new.usuario_id)
     where c.id = new.card_id;
  end if;

  -- o quadro do setor fica sabendo na hora (uma vez por transação por área)
  if new.setor_origem_id is not null then
    perform plt_privado.fn_avisar('setor_' || new.setor_origem_id);
  end if;
  return null;
end;
$$;

drop trigger if exists plt_eventos_projetar_auxilio on public.plt_eventos;
create trigger plt_eventos_projetar_auxilio
  after insert on public.plt_eventos
  for each row
  when (new.tipo in ('auxilio_iniciado', 'auxilio_pausado', 'auxilio_retomado', 'auxilio_encerrado'))
  execute function plt_privado.fn_projetar_auxilio();

-- ----------------------------------------------------------------------------
-- 6 · O auxílio acompanha o card (resposta 8): o que fecha/pausa a execução do
--     card fecha/pausa os auxílios — por evento novo, nada editado à mão.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_auxilios_acompanhar()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_aux  record;
  v_como text;
begin
  if new.tipo in ('movimentacao_setor', 'movimentacao_etapa') then
    v_como := 'movimentacao';
  elsif new.tipo = 'execucao_finalizada' or new.tipo = 'avulso_concluido' then
    v_como := 'conclusao';
  elsif new.tipo = 'card_arquivado' then
    v_como := 'arquivado';
  end if;

  if v_como is not null then
    for v_aux in
      select a.usuario_id from public.plt_auxilios a
       where a.card_id = new.card_id and a.encerrado_em is null
    loop
      insert into public.plt_eventos (card_id, tipo, origem, usuario_id, ocorrido_em, evento_referencia_id, dados)
        values (new.card_id, 'auxilio_encerrado', 'automacao', v_aux.usuario_id, new.ocorrido_em,
                null, jsonb_build_object('como', v_como));
    end loop;

  elsif new.tipo = 'execucao_pausada' then
    for v_aux in
      select a.usuario_id from public.plt_auxilios a
       where a.card_id = new.card_id and a.encerrado_em is null and a.pausado_em is null
    loop
      insert into public.plt_eventos (card_id, tipo, origem, usuario_id, ocorrido_em, dados)
        values (new.card_id, 'auxilio_pausado', 'automacao', v_aux.usuario_id, new.ocorrido_em,
                jsonb_build_object('motivo', coalesce(new.dados ->> 'motivo', 'Card pausado'), 'junto_com_o_card', true));
    end loop;

  elsif new.tipo = 'execucao_retomada' then
    for v_aux in
      select a.usuario_id from public.plt_auxilios a
       where a.card_id = new.card_id and a.encerrado_em is null and a.pausado_em is not null
         and coalesce((select e.dados ->> 'junto_com_o_card'
                         from public.plt_eventos e
                        where e.id = (select max(e2.id) from public.plt_eventos e2
                                       where e2.card_id = new.card_id and e2.tipo = 'auxilio_pausado'
                                         and e2.usuario_id = a.usuario_id)), 'false') = 'true'
    loop
      insert into public.plt_eventos (card_id, tipo, origem, usuario_id, ocorrido_em)
        values (new.card_id, 'auxilio_retomado', 'automacao', v_aux.usuario_id, new.ocorrido_em);
    end loop;
  end if;

  return null;
end;
$$;

drop trigger if exists plt_eventos_zz1_auxilios on public.plt_eventos;
create trigger plt_eventos_zz1_auxilios
  after insert on public.plt_eventos
  for each row
  when (new.tipo in ('movimentacao_setor', 'movimentacao_etapa', 'execucao_finalizada',
                     'avulso_concluido', 'card_arquivado', 'execucao_pausada', 'execucao_retomada'))
  execute function plt_privado.fn_auxilios_acompanhar();

-- ----------------------------------------------------------------------------
-- 7 · A presença da pessoa — fatos próprios (append-only), projeções e o
--     agregado diário (a dashboard lê o pronto — Lei §7.1)
-- ----------------------------------------------------------------------------
create table if not exists public.plt_presenca_eventos (
  id           bigint generated always as identity primary key,
  usuario_id   uuid not null references public.plt_usuarios(id),
  tipo         text not null check (tipo in ('entrada', 'saida')),
  setor_id     bigint references public.plt_setores(id),
  motivo       text,
  origem       text not null default 'interface' check (origem in ('interface', 'api', 'automacao')),
  por_id       uuid references public.plt_usuarios(id),
  ocorrido_em  timestamptz not null default now()
);

comment on table public.plt_presenca_eventos is
  'SESSAO-36 (D-146): os fatos de presença da pessoa no chão de fábrica — entrada num setor e saída (com motivo). APPEND-ONLY por gatilho (RNF-05); card_id não cabe em plt_eventos, por isso a tabela própria.';

create index if not exists plt_presenca_eventos_usuario_idx
  on public.plt_presenca_eventos (usuario_id, id desc);

alter table public.plt_presenca_eventos enable row level security;
revoke all on public.plt_presenca_eventos from anon, authenticated, public;

create or replace function plt_privado.fn_presenca_evento_imutavel()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'Fato de presença não se edita nem se apaga — correção é um fato novo.'
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists plt_presenca_eventos_imutavel on public.plt_presenca_eventos;
create trigger plt_presenca_eventos_imutavel
  before update or delete on public.plt_presenca_eventos
  for each row execute function plt_privado.fn_presenca_evento_imutavel();

-- onde a pessoa está AGORA: setor preenchido = deu entrada; setor nulo = saiu
-- (à deriva até entrar em outro); sem linha = nunca entrou (não conta nada)
create table if not exists public.plt_presenca_atual (
  usuario_id  uuid primary key references public.plt_usuarios(id) on delete cascade,
  setor_id    bigint references public.plt_setores(id),
  desde       timestamptz not null default now(),
  evento_id   bigint references public.plt_presenca_eventos(id)
);

alter table public.plt_presenca_atual enable row level security;
revoke all on public.plt_presenca_atual from anon, authenticated, public;

-- um segmento por estado (trabalhando · ausente · deriva); fim nulo = o vigente
create table if not exists public.plt_presenca_segmentos (
  id          bigint generated always as identity primary key,
  usuario_id  uuid not null references public.plt_usuarios(id) on delete cascade,
  estado      text not null check (estado in ('trabalhando', 'ausente', 'deriva')),
  setor_id    bigint references public.plt_setores(id),
  inicio      timestamptz not null,
  fim         timestamptz
);

create unique index if not exists plt_presenca_segmentos_aberto_uq
  on public.plt_presenca_segmentos (usuario_id) where fim is null;
create index if not exists plt_presenca_segmentos_usuario_idx
  on public.plt_presenca_segmentos (usuario_id, inicio desc);

alter table public.plt_presenca_segmentos enable row level security;
revoke all on public.plt_presenca_segmentos from anon, authenticated, public;

-- o agregado diário (dia de America/Fortaleza): a dashboard soma daqui
create table if not exists public.plt_tempos_pessoa_dia (
  usuario_id  uuid not null references public.plt_usuarios(id) on delete cascade,
  dia         date not null,
  estado      text not null check (estado in ('trabalhando', 'ausente', 'deriva')),
  setor_id    bigint,
  segundos    bigint not null default 0
);

create unique index if not exists plt_tempos_pessoa_dia_uq
  on public.plt_tempos_pessoa_dia (usuario_id, dia, estado, coalesce(setor_id, 0));
create index if not exists plt_tempos_pessoa_dia_dia_idx
  on public.plt_tempos_pessoa_dia (dia);

alter table public.plt_tempos_pessoa_dia enable row level security;
revoke all on public.plt_tempos_pessoa_dia from anon, authenticated, public;

-- soma um segmento fechado no agregado, dia a dia (Fortaleza); ausente e
-- deriva têm teto de 12 h por segmento (ninguém fica "ausente" a noite inteira
-- — o mesmo teto da sessão do tablet; decisão provisória, D-146)
create or replace function plt_privado.fn_tempos_dia_somar(
  p_usuario uuid, p_estado text, p_setor bigint, p_inicio timestamptz, p_fim timestamptz
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fim    timestamptz := p_fim;
  v_cursor timestamptz := p_inicio;
  v_dia    date;
  v_corte  timestamptz;
  v_seg    bigint;
begin
  if p_estado in ('ausente', 'deriva') then
    v_fim := least(v_fim, p_inicio + interval '12 hours');
  end if;
  if v_fim <= v_cursor then
    return;
  end if;
  while v_cursor < v_fim loop
    v_dia := (v_cursor at time zone 'America/Fortaleza')::date;
    v_corte := ((v_dia + 1)::timestamp at time zone 'America/Fortaleza');
    v_seg := floor(extract(epoch from least(v_fim, v_corte) - v_cursor))::bigint;
    if v_seg > 0 then
      insert into public.plt_tempos_pessoa_dia as t (usuario_id, dia, estado, setor_id, segundos)
        values (p_usuario, v_dia, p_estado, p_setor, v_seg)
        on conflict (usuario_id, dia, estado, coalesce(setor_id, 0))
        do update set segundos = t.segundos + excluded.segundos;
    end if;
    v_cursor := least(v_fim, v_corte);
  end loop;
end;
$$;

revoke all on function plt_privado.fn_tempos_dia_somar(uuid, text, bigint, timestamptz, timestamptz) from public, anon, authenticated;

-- o estado de agora da pessoa, recalculado a cada mudança que importa:
-- trabalhando = execução ou auxílio aberto e não pausado; senão ausente (se deu
-- entrada num setor); senão à deriva (se saiu); senão nada (nunca entrou).
create or replace function plt_privado.fn_presenca_recalcular(p_usuario uuid, p_agora timestamptz default now())
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_estado text;
  v_setor  bigint;
  v_seg    public.plt_presenca_segmentos%rowtype;
  v_atual  public.plt_presenca_atual%rowtype;
begin
  if p_usuario is null then
    return;
  end if;
  if exists (select 1 from public.plt_usuarios u where u.id = p_usuario and u.conta_tablet) then
    return; -- a conta do aparelho não é uma pessoa
  end if;

  select c.setor_atual_id into v_setor
    from public.plt_cards c
   where c.executor_atual_id = p_usuario and c.pausado_em is null
     and c.arquivado_em is null and c.concluido_em is null
   limit 1;
  if v_setor is not null then
    v_estado := 'trabalhando';
  else
    select c.setor_atual_id into v_setor
      from public.plt_auxilios a
      join public.plt_cards c on c.id = a.card_id
     where a.usuario_id = p_usuario and a.encerrado_em is null and a.pausado_em is null
     limit 1;
    if v_setor is not null then
      v_estado := 'trabalhando';
    else
      select * into v_atual from public.plt_presenca_atual where usuario_id = p_usuario;
      if v_atual.usuario_id is not null and v_atual.setor_id is not null then
        v_estado := 'ausente';
        v_setor := v_atual.setor_id;
      elsif v_atual.usuario_id is not null then
        v_estado := 'deriva';
        v_setor := null;
      else
        v_estado := null;
      end if;
    end if;
  end if;

  select * into v_seg from public.plt_presenca_segmentos
   where usuario_id = p_usuario and fim is null
   for update;

  if v_seg.id is not null then
    if v_seg.estado = v_estado and v_seg.setor_id is not distinct from v_setor then
      return; -- nada mudou
    end if;
    if v_seg.inicio >= p_agora then
      -- trocas no mesmo instante (um gesto que mexe em vários cards): o
      -- segmento de duração zero sai em vez de poluir a história
      delete from public.plt_presenca_segmentos where id = v_seg.id;
    else
      update public.plt_presenca_segmentos set fim = p_agora where id = v_seg.id;
      perform plt_privado.fn_tempos_dia_somar(p_usuario, v_seg.estado, v_seg.setor_id, v_seg.inicio, p_agora);
    end if;
    if v_seg.setor_id is not null then
      perform plt_privado.fn_avisar('setor_' || v_seg.setor_id);
    end if;
  end if;

  if v_estado is not null then
    insert into public.plt_presenca_segmentos (usuario_id, estado, setor_id, inicio)
      values (p_usuario, v_estado, v_setor, p_agora);
    if v_setor is not null then
      perform plt_privado.fn_avisar('setor_' || v_setor);
    end if;
  end if;
  perform plt_privado.fn_avisar('tempos');
end;
$$;

revoke all on function plt_privado.fn_presenca_recalcular(uuid, timestamptz) from public, anon, authenticated;

-- a ENTRADA num setor (gesto ou automática) e a SAÍDA (com motivo)
create or replace function plt_privado.fn_presenca_entrada(
  p_usuario uuid, p_setor bigint, p_origem text default 'interface', p_por uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_evento bigint;
  v_pessoa public.plt_usuarios%rowtype;
begin
  select * into v_pessoa from public.plt_usuarios u where u.id = p_usuario and u.ativo;
  if v_pessoa.id is null or v_pessoa.conta_tablet then
    return;
  end if;
  if not exists (select 1 from public.plt_setores s
                  where s.id = p_setor and s.ativo and s.papel_no_fluxo = 'producao') then
    raise exception 'A entrada é num setor de produção ativo.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.plt_presenca_atual a
              where a.usuario_id = p_usuario and a.setor_id = p_setor) then
    return; -- já está neste setor
  end if;

  insert into public.plt_presenca_eventos (usuario_id, tipo, setor_id, origem, por_id)
    values (p_usuario, 'entrada', p_setor, p_origem, p_por)
    returning id into v_evento;
  insert into public.plt_presenca_atual as a (usuario_id, setor_id, desde, evento_id)
    values (p_usuario, p_setor, now(), v_evento)
    on conflict (usuario_id) do update
      set setor_id = excluded.setor_id, desde = excluded.desde, evento_id = excluded.evento_id;

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (p_usuario, 'setor_entrada', jsonb_build_object('setor_id', p_setor, 'origem', p_origem));

  perform plt_privado.fn_presenca_recalcular(p_usuario);
end;
$$;

create or replace function plt_privado.fn_presenca_saida(
  p_usuario uuid, p_motivo text, p_origem text default 'interface', p_por uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_atual  public.plt_presenca_atual%rowtype;
  v_evento bigint;
begin
  select * into v_atual from public.plt_presenca_atual where usuario_id = p_usuario for update;
  if v_atual.usuario_id is null or v_atual.setor_id is null then
    raise exception 'Esta pessoa não está em nenhum setor — não há de onde sair.' using errcode = 'check_violation';
  end if;

  insert into public.plt_presenca_eventos (usuario_id, tipo, setor_id, motivo, origem, por_id)
    values (p_usuario, 'saida', v_atual.setor_id, left(coalesce(p_motivo, ''), 200), p_origem, p_por)
    returning id into v_evento;
  update public.plt_presenca_atual
     set setor_id = null, desde = now(), evento_id = v_evento
   where usuario_id = p_usuario;

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (p_usuario, 'setor_saida',
            jsonb_build_object('setor_id', v_atual.setor_id, 'motivo', left(coalesce(p_motivo, ''), 200)));

  perform plt_privado.fn_avisar('setor_' || v_atual.setor_id);
  perform plt_privado.fn_presenca_recalcular(p_usuario);
end;
$$;

revoke all on function plt_privado.fn_presenca_entrada(uuid, bigint, text, uuid) from public, anon, authenticated;
revoke all on function plt_privado.fn_presenca_saida(uuid, text, text, uuid) from public, anon, authenticated;

-- a entrada AUTOMÁTICA: iniciar/retomar/auxiliar num setor onde a pessoa ainda
-- não deu entrada já faz a entrada (demanda §3; mover sozinho não dá entrada)
create or replace function plt_privado.fn_presenca_auto_entrada()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_setor bigint;
begin
  if new.usuario_id is null then
    return null;
  end if;
  select c.setor_atual_id into v_setor from public.plt_cards c where c.id = new.card_id;
  if v_setor is null then
    return null;
  end if;
  if exists (select 1 from public.plt_setores s where s.id = v_setor and s.papel_no_fluxo = 'producao') then
    perform plt_privado.fn_presenca_entrada(new.usuario_id, v_setor, 'automacao', null);
  end if;
  return null;
end;
$$;

drop trigger if exists plt_eventos_zz2_presenca on public.plt_eventos;
create trigger plt_eventos_zz2_presenca
  after insert on public.plt_eventos
  for each row
  when (new.tipo in ('execucao_iniciada', 'execucao_retomada', 'auxilio_iniciado', 'auxilio_retomado'))
  execute function plt_privado.fn_presenca_auto_entrada();

-- o estado acompanha o card: quem ganhou/perdeu execução recalcula
create or replace function plt_privado.fn_presenca_cards()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.executor_atual_id is not null then
    perform plt_privado.fn_presenca_recalcular(old.executor_atual_id);
  end if;
  if new.executor_atual_id is not null and new.executor_atual_id is distinct from old.executor_atual_id then
    perform plt_privado.fn_presenca_recalcular(new.executor_atual_id);
  end if;
  return null;
end;
$$;

drop trigger if exists plt_cards_zz_presenca on public.plt_cards;
create trigger plt_cards_zz_presenca
  after update on public.plt_cards
  for each row
  when (old.executor_atual_id is distinct from new.executor_atual_id
        or old.pausado_em is distinct from new.pausado_em
        or old.arquivado_em is distinct from new.arquivado_em
        or old.concluido_em is distinct from new.concluido_em
        or old.setor_atual_id is distinct from new.setor_atual_id)
  execute function plt_privado.fn_presenca_cards();

create or replace function plt_privado.fn_presenca_auxilios()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform plt_privado.fn_presenca_recalcular(new.usuario_id);
  return null;
end;
$$;

drop trigger if exists plt_auxilios_zz_presenca on public.plt_auxilios;
create trigger plt_auxilios_zz_presenca
  after insert or update on public.plt_auxilios
  for each row execute function plt_privado.fn_presenca_auxilios();

-- ----------------------------------------------------------------------------
-- 8 · fn_validar_execucao — recriada POR INTEIRO a partir da versão viva
--     (migration da pausa com motivo), com TRÊS mudanças da SESSAO-36:
--     (a) o limite por pessoa conta também os auxílios abertos não pausados;
--     (b) iniciar é recusado a quem está auxiliando o card (saia do auxílio
--         para assumir); (c) pausar o card também é gesto de quem o auxilia.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_validar_execucao()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card         public.plt_cards%rowtype;
  v_limite       integer;
  v_em_execucao  integer;
  v_alvo         public.plt_eventos%rowtype;
  v_ultimo_exec  bigint;
  v_papel        text;
  v_lider        boolean;
  v_auxilia      boolean;
  v_referencia   bigint;
  v_eh_fila      boolean;
  v_producao     boolean;
  v_proxima      bigint;
begin
  if new.tipo not in ('execucao_iniciada', 'execucao_finalizada', 'estorno',
                      'execucao_pausada', 'execucao_retomada') then
    return new;
  end if;

  select * into v_card from public.plt_cards where id = new.card_id;
  if not found then
    raise exception 'Card % não existe.', new.card_id using errcode = 'foreign_key_violation';
  end if;

  if new.usuario_id is null then
    -- D-02/D-24/D-48: execução (e a gestão dela) é gesto de pessoa.
    raise exception 'Iniciar, finalizar, pausar, retomar e estornar são gestos de pessoa: é preciso dizer quem fez.'
      using errcode = 'check_violation';
  end if;

  -- Onde o gesto aconteceu: o setor/etapa ATUAL do card, se quem inseriu não disse.
  if new.tipo in ('execucao_iniciada', 'execucao_finalizada',
                  'execucao_pausada', 'execucao_retomada') then
    new.setor_origem_id := coalesce(new.setor_origem_id, v_card.setor_atual_id);
    new.etapa_origem_id := coalesce(new.etapa_origem_id, v_card.etapa_atual_id);
  end if;

  if new.tipo = 'execucao_iniciada' then
    if v_card.setor_atual_id is null then
      raise exception 'Este card ainda não está em nenhum setor — não há o que iniciar.'
        using errcode = 'check_violation';
    end if;
    if v_card.concluido_em is not null then
      -- D-13: fim de linha não executa.
      raise exception 'Card concluído (fim de linha) não entra em execução.'
        using errcode = 'check_violation';
    end if;
    if v_card.executor_atual_id = new.usuario_id then
      raise exception 'Esta pessoa já está executando este card.'
        using errcode = 'check_violation';
    end if;
    -- SESSAO-36: quem auxilia o card sai do auxílio antes de assumi-lo.
    if exists (select 1 from public.plt_auxilios a
                where a.card_id = new.card_id and a.usuario_id = new.usuario_id and a.encerrado_em is null) then
      raise exception 'Esta pessoa já está no card como auxiliar — para assumir a execução, saia do auxílio antes.'
        using errcode = 'check_violation';
    end if;

    select s.limite_execucoes_por_pessoa into v_limite
      from public.plt_setores s where s.id = v_card.setor_atual_id;
    if v_limite is not null then
      -- SESSAO-36: o que a pessoa tem em andamento no setor = execuções + auxílios.
      select (select count(*) from public.plt_cards c
               where c.executor_atual_id = new.usuario_id
                 and c.setor_atual_id = v_card.setor_atual_id
                 and c.id <> new.card_id
                 -- D-48: execução pausada não ocupa o limite — é o que deixa a urgência entrar.
                 and c.pausado_em is null)
           + (select count(*) from public.plt_auxilios a
                join public.plt_cards c2 on c2.id = a.card_id
               where a.usuario_id = new.usuario_id and a.encerrado_em is null and a.pausado_em is null
                 and c2.setor_atual_id = v_card.setor_atual_id)
        into v_em_execucao;
      if v_em_execucao >= v_limite then
        -- D-24/D-48: limite configurável por setor; o padrão agora é 1.
        -- SESSAO-24: o quadro é por arrasto — terminar é arrastar o card adiante.
        raise exception 'Limite do setor atingido: esta pessoa já tem % card(s) em andamento aqui (máximo %). Termine o que está em andamento — arraste-o adiante — antes de pegar outro.',
          v_em_execucao, v_limite
          using errcode = 'check_violation';
      end if;
    end if;

    -- D-48 ↪️ (revisão do dono, 21/09): iniciar um card que está na FILA de um
    -- setor de PRODUÇÃO avança para a etapa de início — o mover nasce ANTES do
    -- iniciar (id menor), então a execução abre já na etapa nova.
    if v_card.etapa_atual_id is not null then
      select e.eh_fila, s.papel_no_fluxo = 'producao'
        into v_eh_fila, v_producao
        from public.plt_etapas e
        join public.plt_setores s on s.id = e.setor_id
       where e.id = v_card.etapa_atual_id;
      if coalesce(v_eh_fila, false) and coalesce(v_producao, false) then
        -- SESSAO-24: a etapa de início tem UM dono (o arrasto usa a mesma).
        v_proxima := plt_privado.fn_etapa_inicio(v_card.setor_atual_id);
        if v_proxima is not null then
          insert into public.plt_eventos
              (card_id, tipo, origem, usuario_id, ocorrido_em,
               setor_origem_id, setor_destino_id, etapa_origem_id, etapa_destino_id)
            values
              (new.card_id, 'movimentacao_etapa', 'automacao', new.usuario_id,
               -- 1ms antes do iniciar: o id do iniciar já nasceu antes deste
               -- trigger — é o instante que garante a ordem certa da leitura.
               new.ocorrido_em - interval '1 millisecond',
               v_card.setor_atual_id, v_card.setor_atual_id,
               v_card.etapa_atual_id, v_proxima);
          -- A projeção já rodou para o mover — o iniciar registra a etapa NOVA.
          select * into v_card from public.plt_cards where id = new.card_id;
          new.setor_origem_id := v_card.setor_atual_id;
          new.etapa_origem_id := v_card.etapa_atual_id;
        end if;
      end if;
    end if;

  elsif new.tipo = 'execucao_finalizada' then
    if v_card.executor_atual_id is null then
      -- D-24: finalizar sem iniciar não existe.
      raise exception 'Iniciar é obrigatório antes de finalizar — este card não está em execução.'
        using errcode = 'check_violation';
    end if;

  elsif new.tipo = 'execucao_pausada' then
    -- D-48: só execução aberta se pausa, uma pausa por vez.
    if v_card.executor_atual_id is null then
      raise exception 'Este card não está em execução — não há o que pausar.'
        using errcode = 'check_violation';
    end if;
    if v_card.pausado_em is not null then
      raise exception 'Esta execução já está pausada.'
        using errcode = 'check_violation';
    end if;

    -- Quem pausa: líder do setor ATUAL do card ou admin (D-48) — ↩️ SESSAO-31
    -- (D-125 resp. 9): e o PRÓPRIO operador, no card que ele executa —
    -- ↩️ SESSAO-36 (D-146): e quem está no card como AUXILIAR.
    select u.papel into v_papel from public.plt_usuarios u
     where u.id = new.usuario_id and u.ativo;
    if v_papel is null then
      raise exception 'Pausar exige um usuário ativo da plataforma.'
        using errcode = 'check_violation';
    end if;
    select coalesce(bool_or(us.lider_do_setor), false) into v_lider
      from public.plt_usuario_setores us
     where us.usuario_id = new.usuario_id
       and us.setor_id = v_card.setor_atual_id;
    select exists (select 1 from public.plt_auxilios a
                    where a.card_id = new.card_id and a.usuario_id = new.usuario_id
                      and a.encerrado_em is null) into v_auxilia;
    if v_papel <> 'admin' and not v_lider and not v_auxilia
       and new.usuario_id is distinct from v_card.executor_atual_id then
      raise exception 'Pausar é gesto de quem executa o card, de quem o auxilia, do líder do setor ou de admin.'
        using errcode = 'insufficient_privilege';
    end if;

    -- A pausa aponta a execução aberta (o iniciar válido mais recente).
    select e.id into v_referencia
      from public.plt_eventos e
     where e.card_id = new.card_id
       and e.tipo = 'execucao_iniciada'
       and not plt_privado.fn_evento_estornado(e.id)
     order by e.ocorrido_em desc, e.id desc
     limit 1;
    if new.evento_referencia_id is null then
      new.evento_referencia_id := v_referencia;
    elsif new.evento_referencia_id is distinct from v_referencia then
      raise exception 'A pausa precisa apontar a execução aberta deste card.'
        using errcode = 'check_violation';
    end if;

  elsif new.tipo = 'execucao_retomada' then
    if v_card.pausado_em is null then
      raise exception 'Este card não está pausado — não há o que retomar.'
        using errcode = 'check_violation';
    end if;

    -- Quem retoma: o próprio executor, o líder do setor ou admin (D-48).
    select u.papel into v_papel from public.plt_usuarios u
     where u.id = new.usuario_id and u.ativo;
    if v_papel is null then
      raise exception 'Retomar exige um usuário ativo da plataforma.'
        using errcode = 'check_violation';
    end if;
    select coalesce(bool_or(us.lider_do_setor), false) into v_lider
      from public.plt_usuario_setores us
     where us.usuario_id = new.usuario_id
       and us.setor_id = v_card.setor_atual_id;
    if new.usuario_id is distinct from v_card.executor_atual_id
       and v_papel <> 'admin' and not v_lider then
      raise exception 'Retomar é gesto de quem executa o card, do líder do setor ou de admin.'
        using errcode = 'insufficient_privilege';
    end if;

    -- D-48 (palavras do dono): "tem que concluir a urgência antes de pegar
    -- outro" — retomar passa pela MESMA trava do limite, contada para o EXECUTOR.
    select s.limite_execucoes_por_pessoa into v_limite
      from public.plt_setores s where s.id = v_card.setor_atual_id;
    if v_limite is not null then
      select (select count(*) from public.plt_cards c
               where c.executor_atual_id = v_card.executor_atual_id
                 and c.setor_atual_id = v_card.setor_atual_id
                 and c.id <> new.card_id
                 and c.pausado_em is null)
           + (select count(*) from public.plt_auxilios a
                join public.plt_cards c2 on c2.id = a.card_id
               where a.usuario_id = v_card.executor_atual_id and a.encerrado_em is null and a.pausado_em is null
                 and c2.setor_atual_id = v_card.setor_atual_id)
        into v_em_execucao;
      if v_em_execucao >= v_limite then
        raise exception 'Finalize a urgência antes de retomar: esta pessoa já tem % card(s) em execução neste setor (máximo %).',
          v_em_execucao, v_limite
          using errcode = 'check_violation';
      end if;
    end if;

    -- A retomada aponta a pausa que encerra.
    select e.id into v_referencia
      from public.plt_eventos e
     where e.card_id = new.card_id
       and e.tipo = 'execucao_pausada'
     order by e.ocorrido_em desc, e.id desc
     limit 1;
    if new.evento_referencia_id is null then
      new.evento_referencia_id := v_referencia;
    elsif new.evento_referencia_id is distinct from v_referencia then
      raise exception 'A retomada precisa apontar a pausa aberta deste card.'
        using errcode = 'check_violation';
    end if;

  elsif new.tipo = 'estorno' then
    if new.evento_referencia_id is null then
      raise exception 'Estorno precisa apontar o evento estornado (evento_referencia_id).'
        using errcode = 'check_violation';
    end if;

    select * into v_alvo from public.plt_eventos where id = new.evento_referencia_id;
    if not found or v_alvo.card_id <> new.card_id then
      raise exception 'O evento estornado precisa existir e ser do mesmo card.'
        using errcode = 'check_violation';
    end if;
    if v_alvo.tipo not in ('execucao_iniciada', 'execucao_finalizada') then
      raise exception 'Só gestos de execução (iniciar/finalizar) podem ser estornados. Movimentação errada se corrige movendo de novo; pausa errada se corrige retomando.'
        using errcode = 'check_violation';
    end if;
    if plt_privado.fn_evento_estornado(v_alvo.id) then
      raise exception 'Este evento já foi estornado.'
        using errcode = 'check_violation';
    end if;

    -- Só o ÚLTIMO gesto de execução válido é estornável (corrigir é desfazer
    -- do mais novo para o mais velho — mantém a história sempre coerente).
    select e.id into v_ultimo_exec
      from public.plt_eventos e
     where e.card_id = new.card_id
       and e.tipo in ('execucao_iniciada', 'execucao_finalizada')
       and not plt_privado.fn_evento_estornado(e.id)
     order by e.ocorrido_em desc, e.id desc
     limit 1;
    if v_ultimo_exec is distinct from v_alvo.id then
      raise exception 'Só o último gesto de execução do card pode ser estornado — desfaça do mais recente para trás.'
        using errcode = 'check_violation';
    end if;

    -- Quem pode: admin (qualquer setor) ou líder do setor ATUAL do card (D-24).
    select u.papel into v_papel from public.plt_usuarios u
     where u.id = new.usuario_id and u.ativo;
    if v_papel is null then
      raise exception 'Estorno exige um usuário ativo da plataforma.'
        using errcode = 'check_violation';
    end if;
    select coalesce(bool_or(us.lider_do_setor), false) into v_lider
      from public.plt_usuario_setores us
     where us.usuario_id = new.usuario_id
       and us.setor_id = v_card.setor_atual_id;
    if v_papel <> 'admin' and not v_lider then
      -- SESSAO-05/D-24: gate de estorno.
      raise exception 'Estornar é gesto de líder do setor ou de admin.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 9 · fn_autor_do_gesto — recriada POR INTEIRO a partir da versão viva
--     (migration da produção concluída): o operador identificado pelo PIN vale
--     também quando o cadastro dele permite auxiliar em outros setores
--     (setores sem fronteira — D-146).
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_autor_do_gesto(p_setor_id bigint, p_operador_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_sessao uuid;
begin
  v_sessao := plt_privado.fn_usuario_atual();
  if v_sessao is null then
    raise exception 'Só usuário ativo da plataforma move cards.' using errcode = 'insufficient_privilege';
  end if;
  if not (plt_privado.fn_eh_admin()
          or p_setor_id in (select plt_privado.fn_setores_do_usuario())) then
    raise exception 'Você não trabalha no setor deste card.' using errcode = 'insufficient_privilege';
  end if;
  if p_operador_id is null or p_operador_id = v_sessao then
    return v_sessao;
  end if;
  if not exists (select 1 from public.plt_usuarios u where u.id = p_operador_id and u.ativo) then
    raise exception 'Operador não encontrado ou inativo — confira a identificação.'
      using errcode = 'check_violation';
  end if;
  if not (
    exists (select 1 from public.plt_usuarios u where u.id = p_operador_id and u.papel = 'admin')
    or exists (select 1 from public.plt_usuario_setores us
                where us.usuario_id = p_operador_id and us.setor_id = p_setor_id)
    -- SESSAO-36 (D-146): setores sem fronteira — quem pode auxiliar age em
    -- qualquer setor de produção, identificado pelo PIN.
    or exists (select 1 from public.plt_usuarios u
                where u.id = p_operador_id and u.pode_auxiliar)
  ) then
    raise exception 'O operador identificado não trabalha neste setor e o cadastro dele não permite auxiliar em outros setores.'
      using errcode = 'insufficient_privilege';
  end if;
  return p_operador_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 10 · As portas da pessoa e do auxílio
-- ----------------------------------------------------------------------------
-- quem é a pessoa do gesto pessoal: a do PIN (operador) ou a da sessão
create or replace function plt_privado.fn_pessoa_do_gesto(p_operador_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_sessao uuid := plt_privado.fn_usuario_atual();
  v_alvo   uuid := coalesce(p_operador_id, v_sessao);
begin
  if v_sessao is null then
    raise exception 'Entre na plataforma primeiro.' using errcode = 'insufficient_privilege';
  end if;
  if v_alvo is null
     or not exists (select 1 from public.plt_usuarios u
                     where u.id = v_alvo and u.ativo and not u.conta_tablet) then
    raise exception 'Pessoa não encontrada ou inativa — confira a identificação.' using errcode = 'check_violation';
  end if;
  return v_alvo;
end;
$$;

revoke all on function plt_privado.fn_pessoa_do_gesto(uuid) from public, anon, authenticated;

-- AUXILIAR: entrar num card em execução, com tempo próprio (D-146)
create or replace function public.plt_fn_card_auxiliar(
  p_card_id     bigint,
  p_operador_id uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pessoa uuid := plt_privado.fn_pessoa_do_gesto(p_operador_id);
  v_sessao uuid := plt_privado.fn_usuario_atual();
  v_evento bigint;
begin
  insert into public.plt_eventos (card_id, tipo, origem, usuario_id, dados)
    values (p_card_id, 'auxilio_iniciado', 'interface', v_pessoa,
            case when v_sessao is distinct from v_pessoa
                 then jsonb_build_object('por', v_sessao) else '{}'::jsonb end)
    returning id into v_evento;
  return v_evento;
end;
$$;

-- SAIR DO AUXÍLIO: só a pessoa sai; o card segue intacto para quem ficou
create or replace function public.plt_fn_auxilio_encerrar(
  p_card_id     bigint,
  p_operador_id uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pessoa uuid := plt_privado.fn_pessoa_do_gesto(p_operador_id);
  v_evento bigint;
begin
  insert into public.plt_eventos (card_id, tipo, origem, usuario_id, dados)
    values (p_card_id, 'auxilio_encerrado', 'interface', v_pessoa, jsonb_build_object('como', 'gesto'))
    returning id into v_evento;
  return v_evento;
end;
$$;

-- ENTRAR no setor (o "Entrar" do ícone — volta da ausência e da deriva)
create or replace function public.plt_fn_pessoa_entrar(
  p_setor_id    bigint,
  p_operador_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pessoa uuid := plt_privado.fn_pessoa_do_gesto(p_operador_id);
begin
  perform plt_privado.fn_presenca_entrada(v_pessoa, p_setor_id, 'interface', plt_privado.fn_usuario_atual());
end;
$$;

-- PAUSAR TUDO (o "Pausar" do ícone): pausa todos os cards da pessoa com UM
-- motivo; ela fica AUSENTE (mantém a entrada no setor)
create or replace function public.plt_fn_pessoa_pausar(
  p_motivo_id   bigint default null,
  p_texto       text default null,
  p_operador_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pessoa uuid := plt_privado.fn_pessoa_do_gesto(p_operador_id);
  v_motivo text := plt_privado.fn_motivo_da_lista('pausa', p_motivo_id, p_texto);
  v_card   record;
  v_n      integer := 0;
begin
  for v_card in
    select c.id from public.plt_cards c
     where c.executor_atual_id = v_pessoa and c.pausado_em is null
       and c.arquivado_em is null and c.concluido_em is null
  loop
    insert into public.plt_eventos (card_id, tipo, origem, usuario_id, dados)
      values (v_card.id, 'execucao_pausada', 'interface', v_pessoa,
              jsonb_build_object('motivo', v_motivo, 'motivo_id', p_motivo_id, 'pausa_geral', true));
    v_n := v_n + 1;
  end loop;
  for v_card in
    select a.card_id as id from public.plt_auxilios a
     where a.usuario_id = v_pessoa and a.encerrado_em is null and a.pausado_em is null
  loop
    insert into public.plt_eventos (card_id, tipo, origem, usuario_id, dados)
      values (v_card.id, 'auxilio_pausado', 'interface', v_pessoa,
              jsonb_build_object('motivo', v_motivo, 'pausa_geral', true));
    v_n := v_n + 1;
  end loop;
  perform plt_privado.fn_presenca_recalcular(v_pessoa);
  return v_n;
end;
$$;

-- SAIR DO SETOR (o "Sair" do ícone): pausa tudo + encerra a entrada; sem
-- entrada em outro setor, a pessoa fica À DERIVA (motivo da lista de saída)
create or replace function public.plt_fn_pessoa_sair(
  p_motivo_id   bigint default null,
  p_texto       text default null,
  p_operador_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pessoa uuid := plt_privado.fn_pessoa_do_gesto(p_operador_id);
  v_motivo text := plt_privado.fn_motivo_da_lista('saida', p_motivo_id, p_texto);
  v_card   record;
  v_n      integer := 0;
begin
  for v_card in
    select c.id from public.plt_cards c
     where c.executor_atual_id = v_pessoa and c.pausado_em is null
       and c.arquivado_em is null and c.concluido_em is null
  loop
    insert into public.plt_eventos (card_id, tipo, origem, usuario_id, dados)
      values (v_card.id, 'execucao_pausada', 'interface', v_pessoa,
              jsonb_build_object('motivo', v_motivo, 'motivo_id', p_motivo_id, 'saida', true));
    v_n := v_n + 1;
  end loop;
  -- quem estava como auxiliar SAI do card — o card segue intacto para quem ficou
  for v_card in
    select a.card_id as id from public.plt_auxilios a
     where a.usuario_id = v_pessoa and a.encerrado_em is null
  loop
    insert into public.plt_eventos (card_id, tipo, origem, usuario_id, dados)
      values (v_card.id, 'auxilio_encerrado', 'interface', v_pessoa, jsonb_build_object('como', 'saida'));
    v_n := v_n + 1;
  end loop;
  perform plt_privado.fn_presenca_saida(v_pessoa, v_motivo, 'interface', plt_privado.fn_usuario_atual());
  return v_n;
end;
$$;

revoke all on function public.plt_fn_card_auxiliar(bigint, uuid) from public, anon;
revoke all on function public.plt_fn_auxilio_encerrar(bigint, uuid) from public, anon;
revoke all on function public.plt_fn_pessoa_entrar(bigint, uuid) from public, anon;
revoke all on function public.plt_fn_pessoa_pausar(bigint, text, uuid) from public, anon;
revoke all on function public.plt_fn_pessoa_sair(bigint, text, uuid) from public, anon;
grant execute on function public.plt_fn_card_auxiliar(bigint, uuid) to authenticated;
grant execute on function public.plt_fn_auxilio_encerrar(bigint, uuid) to authenticated;
grant execute on function public.plt_fn_pessoa_entrar(bigint, uuid) to authenticated;
grant execute on function public.plt_fn_pessoa_pausar(bigint, text, uuid) to authenticated;
grant execute on function public.plt_fn_pessoa_sair(bigint, text, uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 11 · Avisos: o tópico da dashboard de tempos (estreito; o dado fica na porta)
--      fn_aviso_pode_ouvir recriada POR INTEIRO a partir da versão viva
--      (migration da abertura e ao vivo).
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_aviso_pode_ouvir(p_topico text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
           when p_topico in ('plt-aviso:estoque', 'plt-aviso:aguardo', 'plt-aviso:pcp')
             then plt_privado.fn_pode_ver_expedicao()
           when p_topico = 'plt-aviso:rotas'
             then plt_privado.fn_pode_ver_expedicao()
               or plt_privado.fn_eh_entregador(plt_privado.fn_usuario_atual())
           -- SESSAO-31 (Lei §4): o quadro de um setor — quem vê aquele quadro.
           when p_topico ~ '^plt-aviso:setor_[0-9]{1,18}$'
             then plt_privado.fn_pode_ver_quadro(substring(p_topico from '^plt-aviso:setor_([0-9]+)$')::bigint)
           -- SESSAO-32: o "mudou" dos painéis não leva dado — quem está logado ouve.
           when p_topico = 'plt-aviso:painel'
             then plt_privado.fn_usuario_atual() is not null
           when p_topico = 'plt-aviso:danificados'
             then plt_privado.fn_pode_ver_expedicao()
           -- SESSAO-36: a dashboard de tempos por pessoa — o aviso não leva
           -- dado (a porta gateia o que cada um vê).
           when p_topico = 'plt-aviso:tempos'
             then plt_privado.fn_usuario_atual() is not null
           when p_topico ~ '^plt-aviso:lista_[0-9a-f]{32}$'
             then plt_privado.fn_tem_modulo('comercial')
           else false
         end;
$$;

-- ----------------------------------------------------------------------------
-- 12 · O quadro numa requisição ganha os auxílios e as pessoas do setor
--      (fn_quadro_cards e plt_fn_quadro_setor recriadas POR INTEIRO a partir
--      da versão viva — migration da pausa com motivo; fn_quadro_junto, da do
--      quadro numa requisição)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_quadro_cards(p_ids bigint[])
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'tipo', c.tipo, 'pedido_id', c.pedido_id, 'card_pai_id', c.card_pai_id,
           'item_seq', c.item_seq, 'item_codigo', c.item_codigo, 'item_descricao', c.item_descricao,
           'indice_unidade', c.indice_unidade, 'total_unidades', c.total_unidades,
           'setor_atual_id', c.setor_atual_id, 'etapa_atual_id', c.etapa_atual_id, 'desde', c.desde,
           'executor_atual_id', c.executor_atual_id, 'responsavel_id', c.responsavel_id,
           'delegado_em', c.delegado_em, 'qualidade_atual', c.qualidade_atual, 'concluido_em', c.concluido_em,
           'pausado_em', c.pausado_em, 'liberado_completo_em', c.liberado_completo_em,
           'produto_tiny_id', c.produto_tiny_id, 'etiquetas', c.etiquetas,
           'parecer_pendente_id', c.parecer_pendente_id,
           -- SESSAO-31: a frente do card (D-125 / §2)
           'titulo', c.titulo, 'descricao', left(c.descricao, 600),
           'inicio_em', c.inicio_em, 'vence_em', c.vence_em, 'responsaveis', to_jsonb(c.responsaveis),
           'anexos_qtd', c.anexos_qtd, 'mensagens_qtd', c.mensagens_qtd,
           'vinculo_tipo', c.vinculo_tipo, 'vinculo_id', c.vinculo_id,
           'vinculo_rotulo', case when c.vinculo_tipo is null then null
                                  else plt_privado.fn_vinculo_rotulo(c.vinculo_tipo, c.vinculo_id) end,
           'ajuste_destino', c.ajuste_destino, 'criado_por_id', c.criado_por_id,
           -- SESSAO-31 (§4): o motivo da pausa / da parada, na frente do card
           'pausa_motivo', c.pausa_motivo,
           -- SESSAO-36 (D-146): quem está no card como auxiliar agora
           'auxiliares', to_jsonb(c.auxiliares)
         ) order by o.ord), '[]'::jsonb)
    from unnest(p_ids) with ordinality as o(id, ord)
    join public.plt_cards c on c.id = o.id;
$$;

create or replace function plt_privado.fn_quadro_junto(p_ids bigint[])
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'execucoes', coalesce((
      select jsonb_agg(jsonb_build_object('evento_inicio_id', v.evento_inicio_id, 'card_id', v.card_id,
                                          'usuario_inicio_id', v.usuario_inicio_id, 'iniciou_em', v.iniciou_em))
        from public.plt_vw_execucoes v
       where v.card_id = any (p_ids) and v.em_andamento), '[]'::jsonb),
    -- SESSAO-36: os auxílios abertos dos cards da página (tempo próprio)
    'auxilios', coalesce((
      select jsonb_agg(jsonb_build_object('card_id', a.card_id, 'usuario_id', a.usuario_id,
                                          'iniciado_em', a.iniciado_em, 'pausado_em', a.pausado_em,
                                          'pausa_motivo', a.pausa_motivo, 'segundos', a.segundos,
                                          'ultimo_inicio', a.ultimo_inicio))
        from public.plt_auxilios a
       where a.card_id = any (p_ids) and a.encerrado_em is null), '[]'::jsonb),
    'pessoas', coalesce((
      select jsonb_object_agg(u.id, jsonb_build_object('nome', u.nome, 'foto', u.foto_caminho))
        from public.plt_usuarios u
       where u.id in (select c.executor_atual_id from public.plt_cards c where c.id = any (p_ids)
                      union select unnest(c.responsaveis) from public.plt_cards c where c.id = any (p_ids)
                      union select unnest(c.auxiliares) from public.plt_cards c where c.id = any (p_ids)
                      union select e.usuario_id from public.plt_cards c join public.plt_eventos e on e.id = c.parecer_pendente_id
                             where c.id = any (p_ids))), '{}'::jsonb),
    'pedidos', coalesce((
      select jsonb_object_agg(p.id, jsonb_build_object(
               'pedido_id', p.id, 'numero', p.numero, 'cliente_nome', coalesce(cl.nome, ''),
               'situacao', p.situacao, 'data_prevista', p.data_prevista,
               'entrou_pcp_em', (select min(e.ocorrido_em) from public.plt_eventos e where e.card_id = pc.id and e.tipo = 'card_criado'),
               'liberado_completo_em', pc.liberado_completo_em))
        from public.pedidos p
        left join public.clientes cl on cl.id = p.cliente_id
        left join public.plt_cards pc on pc.pedido_id = p.id and pc.tipo = 'pedido'
       where p.id in (select c.pedido_id from public.plt_cards c where c.id = any (p_ids) and c.pedido_id is not null)), '{}'::jsonb),
    'valores', coalesce((
      select jsonb_agg(jsonb_build_object('campo_id', v.campo_id, 'card_id', v.card_id, 'valor', v.valor))
        from public.plt_campos_valores v
       where v.card_id = any (p_ids)), '[]'::jsonb)
  );
$$;

create or replace function public.plt_fn_quadro_setor(p_setor_id bigint, p_por_coluna integer default 10)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_n       integer := least(greatest(coalesce(p_por_coluna, 10), 1), 50);
  v_colunas jsonb := '[]'::jsonb;
  v_ids     bigint[] := '{}';
  v_pagina  bigint[];
  v_total   integer;
  r         record;
begin
  if not plt_privado.fn_pode_ver_quadro(p_setor_id) then
    raise exception 'Você não vê o quadro deste setor.' using errcode = 'insufficient_privilege';
  end if;

  -- A coluna "Chegada" (sem etapa) e cada etapa ativa, na ordem do setor.
  for r in
    select null::bigint as etapa_id, -1 as ordem, 0::bigint as id
    union all
    select e.id, e.ordem, e.id from public.plt_etapas e where e.setor_id = p_setor_id and e.ativa
    order by 2, 3
  loop
    v_pagina := plt_privado.fn_quadro_pagina(p_setor_id, r.etapa_id, null, null, v_n);
    v_total := plt_privado.fn_quadro_total(p_setor_id, r.etapa_id);
    v_colunas := v_colunas || jsonb_build_array(jsonb_build_object(
                   'etapa_id', r.etapa_id, 'total', v_total, 'cards', plt_privado.fn_quadro_cards(v_pagina)));
    v_ids := v_ids || v_pagina;
  end loop;

  return jsonb_build_object(
    'setor_id', p_setor_id,
    'por_coluna', v_n,
    'etapas', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'setor_id', e.setor_id, 'nome', e.nome, 'ordem', e.ordem,
                                          'eh_fila', e.eh_fila, 'eh_danificado', e.eh_danificado, 'ativa', e.ativa,
                                          'setor_destino_id', e.setor_destino_id, 'conclui_producao', e.conclui_producao,
                                          'pede_motivo', e.pede_motivo)
                       order by e.ordem, e.id)
        from public.plt_etapas e where e.setor_id = p_setor_id and e.ativa), '[]'::jsonb),
    'colunas', v_colunas,
    'etiquetas', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'nome', t.nome, 'cor', t.cor,
                                                               'arquivada_em', t.arquivada_em) order by t.nome)
                             from public.plt_etiquetas t), '[]'::jsonb),
    'campos', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'nome', f.nome, 'tipo', f.tipo, 'opcoes', f.opcoes,
                                                            'em_pecas', f.em_pecas, 'em_pedidos', f.em_pedidos,
                                                            'em_avulsos', f.em_avulsos, 'arquivado_em', f.arquivado_em)
                                         order by f.nome)
                          from public.plt_campos f), '[]'::jsonb),
    -- SESSAO-36 (D-146 resposta 9): as pessoas presentes no setor — o ícone do
    -- canto superior direito do tablet (foto, estado e desde quando)
    'presencas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'usuario_id', u.id, 'nome', u.nome, 'foto', u.foto_caminho,
               'estado', s.estado, 'desde', s.inicio)
             order by u.nome)
        from public.plt_presenca_segmentos s
        join public.plt_usuarios u on u.id = s.usuario_id
       where s.fim is null and s.setor_id = p_setor_id), '[]'::jsonb)
  ) || plt_privado.fn_quadro_junto(v_ids);
end;
$$;

-- ----------------------------------------------------------------------------
-- 13 · A janela do card ganha os auxílios e os gestos de auxiliar
--      (recriada POR INTEIRO a partir da versão viva — migration da pausa)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_card_janela(p_card_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_card    public.plt_cards%rowtype;
  v_editar  boolean;
  v_pessoas uuid[];
  v_eu      uuid := plt_privado.fn_usuario_atual();
begin
  select * into v_card from public.plt_cards where id = p_card_id;
  if not found then
    raise exception 'Card % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  if not plt_privado.fn_pode_anexar(p_card_id) then
    raise exception 'Você não vê este card.' using errcode = 'insufficient_privilege';
  end if;
  v_editar := plt_privado.fn_pode_editar_card(p_card_id);
  v_pessoas := array_remove(v_card.responsaveis || v_card.criado_por_id || v_card.executor_atual_id, null)
               || v_card.auxiliares;

  return jsonb_build_object(
    'card', plt_privado.fn_quadro_cards(array[p_card_id]) -> 0,
    'arquivado_em', v_card.arquivado_em,
    'criado_em', v_card.criado_em,
    'setor', (select jsonb_build_object('id', s.id, 'nome', s.nome, 'codigo', s.codigo, 'papel_no_fluxo', s.papel_no_fluxo)
                from public.plt_setores s where s.id = v_card.setor_atual_id),
    'etapa', (select jsonb_build_object('id', e.id, 'nome', e.nome, 'eh_fila', e.eh_fila)
                from public.plt_etapas e where e.id = v_card.etapa_atual_id),
    'execucao', (select jsonb_build_object('usuario_id', v.usuario_inicio_id, 'iniciou_em', v.iniciou_em)
                   from public.plt_vw_execucoes v where v.card_id = p_card_id and v.em_andamento
                  order by v.iniciou_em desc limit 1),
    -- SESSAO-36: os auxílios abertos (tempo próprio de cada pessoa no card)
    'auxilios', coalesce((
      select jsonb_agg(jsonb_build_object('usuario_id', a.usuario_id, 'iniciado_em', a.iniciado_em,
                                          'pausado_em', a.pausado_em, 'pausa_motivo', a.pausa_motivo,
                                          'segundos', a.segundos, 'ultimo_inicio', a.ultimo_inicio)
             order by a.iniciado_em)
        from public.plt_auxilios a
       where a.card_id = p_card_id and a.encerrado_em is null), '[]'::jsonb),
    'pessoas', coalesce((select jsonb_object_agg(u.id, jsonb_build_object('nome', u.nome, 'foto', u.foto_caminho))
                           from public.plt_usuarios u where u.id = any (v_pessoas)), '{}'::jsonb),
    'pedido', (select jsonb_build_object('pedido_id', p.id, 'numero', p.numero, 'cliente_nome', coalesce(cl.nome, ''),
                                         'situacao', p.situacao, 'data_prevista', p.data_prevista)
                 from public.pedidos p left join public.clientes cl on cl.id = p.cliente_id
                where p.id = v_card.pedido_id),
    'campos', coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'nome', f.nome, 'tipo', f.tipo, 'opcoes', f.opcoes,
                                          'em_pecas', f.em_pecas, 'em_pedidos', f.em_pedidos, 'em_avulsos', f.em_avulsos,
                                          'arquivado_em', f.arquivado_em,
                                          'valor', (select vv.valor from public.plt_campos_valores vv
                                                     where vv.campo_id = f.id
                                                       and ((v_card.tipo = 'pedido' and vv.pedido_id = v_card.pedido_id)
                                                            or (v_card.tipo <> 'pedido' and vv.card_id = v_card.id))))
                       order by f.nome)
        from public.plt_campos f
       where f.arquivado_em is null
         and case v_card.tipo when 'avulso' then f.em_avulsos
                              when 'pedido' then f.em_pedidos
                              else f.em_pecas end), '[]'::jsonb),
    'etiquetas', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'nome', t.nome, 'cor', t.cor,
                                                               'arquivada_em', t.arquivada_em) order by t.nome)
                             from public.plt_etiquetas t), '[]'::jsonb),
    'permissoes', jsonb_build_object(
      'editar', v_editar and v_card.arquivado_em is null,
      'editar_nome', v_editar and v_card.tipo = 'avulso' and v_card.arquivado_em is null,
      'concluir', v_card.tipo = 'avulso' and v_card.arquivado_em is null
                  and (v_editar or v_card.setor_atual_id in (select plt_privado.fn_setores_do_usuario())
                       or plt_privado.fn_eh_admin()),
      'anexar', v_card.arquivado_em is null,
      'ver_removidos', plt_privado.fn_eh_admin(),
      -- SESSAO-31 (§4 · D-125 resp. 9): pausar — o próprio executor, o líder, o
      -- admin — ↩️ SESSAO-36: e quem auxilia o card.
      'pausar', v_card.executor_atual_id is not null and v_card.pausado_em is null and v_card.arquivado_em is null
                and (v_card.executor_atual_id = v_eu or plt_privado.fn_eh_admin()
                     or v_eu = any (v_card.auxiliares)
                     or (v_card.setor_atual_id is not null and plt_privado.fn_eh_lider_de(v_card.setor_atual_id))),
      'retomar', v_card.pausado_em is not null and v_card.arquivado_em is null
                 and (v_card.executor_atual_id = v_eu or plt_privado.fn_eh_admin()
                      or (v_card.setor_atual_id is not null and plt_privado.fn_eh_lider_de(v_card.setor_atual_id))),
      -- SESSAO-36 (D-146): auxiliar — card em execução, por outra pessoa
      'auxiliar', v_card.executor_atual_id is not null and v_card.arquivado_em is null
                  and v_card.concluido_em is null,
      'sair_auxilio', v_eu = any (v_card.auxiliares))
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 14 · A abertura leva as duas colunas novas do perfil (recriada POR INTEIRO a
--      partir da versão viva — migration dos catálogos na abertura)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_abertura(p_rota text default null, p_meu_painel boolean default false)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id      uuid;
  v_perfil  jsonb;
  v_setores bigint[];
  v_ret     jsonb;
begin
  select u.id,
         jsonb_build_object(
           'id', u.id, 'nome', u.nome, 'usuario', u.usuario, 'email', u.email, 'telefone', u.telefone,
           'matricula', u.matricula, 'papel', u.papel, 'senha_padrao', u.senha_padrao, 'ativo', u.ativo,
           'arquivado_em', u.arquivado_em, 'tema', u.tema, 'foto_caminho', u.foto_caminho,
           'modulos', u.modulos, 'super_admin', u.super_admin,
           -- SESSAO-36: a conta de tablet vive só no /tablet; o liga/desliga do auxílio
           'conta_tablet', u.conta_tablet, 'pode_auxiliar', u.pode_auxiliar)
    into v_id, v_perfil
    from public.plt_usuarios u
   where u.auth_user_id = auth.uid() and u.ativo
   limit 1;

  -- O instante da leitura: o canal pessoal entra pedindo a reprise desde aqui
  -- (nada que saia entre ler e ouvir se perde).
  v_ret := jsonb_build_object('agora_ms', floor(extract(epoch from clock_timestamp()) * 1000)::bigint);
  if v_id is null then
    return v_ret || jsonb_build_object('perfil', null, 'vinculos', '[]'::jsonb);
  end if;

  if p_rota is not null and length(p_rota) > 300 then
    p_rota := left(p_rota, 300);
  end if;

  select coalesce(array_agg(us.setor_id order by us.setor_id), '{}') into v_setores
    from public.plt_usuario_setores us where us.usuario_id = v_id;

  v_ret := v_ret || jsonb_build_object(
    'perfil', v_perfil,
    'vinculos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'setor_id', us.setor_id, 'lider_do_setor', us.lider_do_setor,
               'setor', case when s.id is null then null
                             else jsonb_build_object('id', s.id, 'nome', s.nome, 'codigo', s.codigo) end)
             order by us.setor_id)
        from public.plt_usuario_setores us
        left join public.plt_setores s on s.id = us.setor_id
       where us.usuario_id = v_id), '[]'::jsonb),
    'setores', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'codigo', s.codigo, 'nome', s.nome, 'papel_no_fluxo', s.papel_no_fluxo,
               'ordem', s.ordem, 'ativo', s.ativo, 'limite_execucoes_por_pessoa', s.limite_execucoes_por_pessoa,
               'modo_delegacao', s.modo_delegacao, 'qualidade_envio_tipos', s.qualidade_envio_tipos,
               'qualidade_recebimento_tipos', s.qualidade_recebimento_tipos)
             order by s.ordem, s.id)
        from public.plt_setores s where s.ativo), '[]'::jsonb),
    'avisos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', a.id, 'tipo', a.tipo, 'titulo', a.titulo, 'corpo', a.corpo, 'card_id', a.card_id,
               'lida_em', a.lida_em, 'criada_em', a.criada_em)
             order by a.criada_em desc, a.id desc)
        from (select n.id, n.tipo, n.titulo, n.corpo, n.card_id, n.lida_em, n.criada_em
                from public.plt_notificacoes n
               where n.destinatario_id = v_id
               order by n.criada_em desc, n.id desc limit 20) a), '[]'::jsonb),
    'conversas', coalesce((
      select jsonb_agg(to_jsonb(c) - 'ordinality' order by c.ordinality)
        from public.plt_fn_chat_conversas(null::timestamptz, null::bigint, 5, null::bigint) with ordinality as c), '[]'::jsonb),
    'tarefas', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.criada_em, t.id)
        from (select tt.id, tt.titulo, tt.descricao, tt.card_id, tt.setor_id, tt.responsavel_id, tt.criada_por_id,
                     tt.delegacao, tt.situacao, tt.prazo, tt.iniciada_em, tt.concluida_em, tt.criada_em,
                     tt.tarefa_mae_id, tt.origem, tt.evento_referencia_id, tt.privada, tt.tempo_acumulado
                from public.plt_tarefas tt
               where tt.responsavel_id = v_id and tt.situacao <> 'concluida' and tt.tarefa_mae_id is null) t), '[]'::jsonb),
    'execucoes', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.iniciou_em, x.evento_inicio_id)
        from public.plt_fn_minhas_execucoes() x), '[]'::jsonb),
    -- migration 80: os catálogos que os quadros, o PCP, os pedidos e a janela
    -- do card usam (antes: 2 leituras a mais ao abrir qualquer um deles)
    'etiquetas', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'nome', e.nome, 'cor', e.cor, 'arquivada_em', e.arquivada_em)
             order by e.nome)
        from public.plt_etiquetas e), '[]'::jsonb),
    'campos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'nome', c.nome, 'tipo', c.tipo, 'opcoes', c.opcoes, 'em_pecas', c.em_pecas,
               'em_pedidos', c.em_pedidos, 'em_avulsos', c.em_avulsos, 'arquivado_em', c.arquivado_em)
             order by c.nome)
        from public.plt_campos c), '[]'::jsonb));

  if p_meu_painel then
    v_ret := v_ret || jsonb_build_object('meu_painel', jsonb_build_object(
      'cards', coalesce((
        select jsonb_agg(to_jsonb(c) order by c.desde nulls last, c.id)
          from (select cc.id, cc.tipo, cc.pedido_id, cc.card_pai_id, cc.item_seq, cc.item_codigo, cc.item_descricao,
                       cc.indice_unidade, cc.total_unidades, cc.setor_atual_id, cc.etapa_atual_id, cc.desde,
                       cc.executor_atual_id, cc.responsavel_id, cc.delegado_em, cc.qualidade_atual, cc.concluido_em,
                       cc.pausado_em, cc.liberado_completo_em, cc.produto_tiny_id, cc.etiquetas, cc.parecer_pendente_id
                  from public.plt_cards cc
                 where cc.responsavel_id = v_id and cc.concluido_em is null and cc.arquivado_em is null) c), '[]'::jsonb),
      'setores_chave', array_to_string(v_setores, ','),
      'tarefas_sistema', case when cardinality(v_setores) = 0 then '[]'::jsonb else coalesce((
        select jsonb_agg(to_jsonb(t) order by t.criada_em, t.id)
          from (select tt.id, tt.titulo, tt.descricao, tt.card_id, tt.setor_id, tt.responsavel_id, tt.criada_por_id,
                       tt.delegacao, tt.situacao, tt.prazo, tt.iniciada_em, tt.concluida_em, tt.criada_em,
                       tt.tarefa_mae_id, tt.origem, tt.evento_referencia_id, tt.privada, tt.tempo_acumulado
                  from public.plt_tarefas tt
                 where tt.origem = 'sistema' and tt.setor_id = any (v_setores) and tt.situacao <> 'concluida') t), '[]'::jsonb) end,
      'fila_prioridade', coalesce((select u.fila_prioridade from public.plt_usuarios u where u.id = v_id), '[]'::jsonb),
      'metas', coalesce((
        select jsonb_agg(to_jsonb(m) - 'ordinality' order by m.ordinality)
          from public.plt_fn_metas_painel(false, 20, 0) with ordinality as m), '[]'::jsonb)));
  end if;

  -- O gesto de abrir: o registro da navegação da 1ª rota (que já carimba a
  -- presença) — o que a casca gravava em duas requisições a mais. Sem rota é a
  -- releitura do perfil depois de um gesto (editar o perfil, o tema): nada a
  -- gravar — a presença já veio do próprio gesto.
  if p_rota is not null and length(btrim(p_rota)) > 0 then
    perform public.plt_fn_registrar_log('navegacao', p_rota, '{}'::jsonb);
  end if;

  return v_ret;
end;
$$;

comment on function public.plt_fn_abertura(text, boolean) is
  'SESSAO-32 (Lei §2): a primeira abertura do app numa requisição — perfil, vínculos, setores, os 20 avisos do sino, a 1ª página do chat, a bolinha, os catálogos de etiquetas e campos e (p_meu_painel) os dados do Meu Painel. SESSAO-36: o perfil diz se a sessão é a conta de tablet e se a pessoa pode auxiliar.';

-- ----------------------------------------------------------------------------
-- 15 · O check novo valida tudo (E-19: o validate mora SEMPRE na migration
--      mais nova do check — saiu da migration da devolução)
-- ----------------------------------------------------------------------------
alter table public.plt_eventos validate constraint plt_eventos_tipo_check;
