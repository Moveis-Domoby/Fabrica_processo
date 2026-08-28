-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 20 — TAREFAS E DELEGAÇÃO
-- Sessão: SESSAO-12 · Data: 2026-08-28 (bloco noturno D-26 — a última do bloco)
--
-- D-34 (respostas do dono): delegação por setor em TRÊS modos —
--   · desativada  → card chega sem dono e fica na fila;
--   · direta      → líder/admin atribui (reatribuir é permitido e registrado);
--   · aleatoria   → o sistema sorteia ENTRE QUEM ESTÁ LOGADO na plataforma
--                   naquele momento, balanceando por carga aberta.
--
-- A delegação é EVENTO append-only (tipo `delegacao`, no vocabulário desde a
-- SESSAO-02): quem delegou, para quem, quando, modo — a reatribuição registra
-- as duas. `plt_cards.responsavel_id` é PROJEÇÃO (M-13). E ela ORGANIZA, não
-- trava (D-34): nenhuma regra de execução olha o responsável.
--
-- Presença: o front grava um heartbeat em plt_presencas; "logado agora" =
-- visto nos últimos 15 minutos. Sem candidato presente, o card fica sem dono
-- (sortear quem não veio seria dado-ficção — M-03).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · Estruturas
-- ----------------------------------------------------------------------------
alter table public.plt_setores
  add column if not exists modo_delegacao text not null default 'desativada'
  check (modo_delegacao in ('desativada', 'direta', 'aleatoria'));

comment on column public.plt_setores.modo_delegacao is
  'D-34/RF-43: como o card que chega ganha dono — desativada (fila sem dono), direta (líder atribui) ou aleatoria (sorteio entre logados).';

alter table public.plt_cards
  add column if not exists responsavel_id uuid references public.plt_usuarios(id);

comment on column public.plt_cards.responsavel_id is
  'D-34: projeção do último evento de delegação (M-13). ORGANIZA o trabalho — não trava gesto nenhum.';

create index if not exists plt_cards_responsavel_idx
  on public.plt_cards (responsavel_id)
  where responsavel_id is not null and concluido_em is null and arquivado_em is null;

create table if not exists public.plt_presencas (
  usuario_id uuid primary key references public.plt_usuarios(id) on delete cascade,
  visto_em   timestamptz not null default now()
);

comment on table public.plt_presencas is
  'Heartbeat de quem está com a plataforma aberta (SESSAO-12/D-34). "Logado agora" = visto_em nos últimos 15 min. Base do sorteio aleatório.';

alter table public.plt_presencas enable row level security;

drop policy if exists plt_presencas_leitura on public.plt_presencas;
create policy plt_presencas_leitura on public.plt_presencas
  for select to authenticated using (true);

drop policy if exists plt_presencas_propria on public.plt_presencas;
create policy plt_presencas_propria on public.plt_presencas
  for all to authenticated
  using (usuario_id = plt_privado.fn_usuario_atual())
  with check (usuario_id = plt_privado.fn_usuario_atual());

-- Timer OPCIONAL da tarefa avulsa (D-34: só conta se o atarefado quiser).
alter table public.plt_tarefas
  add column if not exists iniciada_em timestamptz;

comment on column public.plt_tarefas.iniciada_em is
  'D-34: o timer da tarefa avulsa é opcional — só grava se a pessoa tocar "Iniciar tempo". Concluir sem iniciar é normal.';

-- ----------------------------------------------------------------------------
-- 2 · Validação do evento de delegação (BEFORE — vale para todo escritor)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_validar_delegacao()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card   public.plt_cards%rowtype;
  v_papel  text;
  v_lider  boolean;
  v_resp   uuid;
begin
  if new.tipo <> 'delegacao' then
    return new;
  end if;

  select * into v_card from public.plt_cards where id = new.card_id;
  if not found then
    raise exception 'Card % não existe.', new.card_id using errcode = 'foreign_key_violation';
  end if;

  -- Para quem vai (null = tirar o dono). Sempre gente ativa.
  v_resp := nullif(new.dados ->> 'responsavel_id', '')::uuid;
  if v_resp is not null and not exists (
    select 1 from public.plt_usuarios u where u.id = v_resp and u.ativo
  ) then
    raise exception 'O responsável indicado não é um usuário ativo.' using errcode = 'check_violation';
  end if;

  -- Sorteio é da automação; atribuição direta é gesto de líder do setor do
  -- card (ou admin) — RF-42/D-34.
  if new.origem <> 'automacao' then
    if new.usuario_id is null then
      raise exception 'Delegar é gesto de pessoa — é preciso dizer quem delegou.'
        using errcode = 'check_violation';
    end if;
    select u.papel into v_papel from public.plt_usuarios u
     where u.id = new.usuario_id and u.ativo;
    select coalesce(bool_or(us.lider_do_setor), false) into v_lider
      from public.plt_usuario_setores us
     where us.usuario_id = new.usuario_id
       and us.setor_id = v_card.setor_atual_id;
    if coalesce(v_papel, '') <> 'admin' and not v_lider then
      raise exception 'Delegar card é gesto do líder do setor ou de admin.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function plt_privado.fn_validar_delegacao() from public, anon, authenticated;

drop trigger if exists plt_eventos_validar_delegacao on public.plt_eventos;
create trigger plt_eventos_validar_delegacao
  before insert on public.plt_eventos
  for each row execute function plt_privado.fn_validar_delegacao();

-- ----------------------------------------------------------------------------
-- 3 · Projeção: o evento de delegação escreve o responsável (M-13)
--     (função recriada por inteiro — a da migration 19 + o elsif novo)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_projetar_posicao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_terminal boolean;
begin
  if new.tipo in ('card_criado', 'movimentacao_setor', 'movimentacao_etapa') then
    select s.papel_no_fluxo = 'terminal'
      into v_terminal
      from public.plt_setores s
     where s.id = new.setor_destino_id;

    update public.plt_cards
       set setor_atual_id = coalesce(new.setor_destino_id, setor_atual_id),
           etapa_atual_id = new.etapa_destino_id,
           desde          = new.ocorrido_em,
           -- Mudou de lugar: execução aberta encerra sozinha (D-24) e o dono
           -- da delegação zera quando muda de SETOR (o afazer era daquele time).
           executor_atual_id = null,
           responsavel_id = case when new.tipo = 'movimentacao_setor'
                                 then null else responsavel_id end,
           concluido_em   = case when coalesce(v_terminal, false)
                                 then new.ocorrido_em else concluido_em end
     where id = new.card_id;

  elsif new.tipo = 'execucao_iniciada' then
    update public.plt_cards
       set executor_atual_id = new.usuario_id
     where id = new.card_id;

  elsif new.tipo = 'execucao_finalizada' then
    update public.plt_cards
       set executor_atual_id = null
     where id = new.card_id;

  elsif new.tipo = 'estorno' then
    update public.plt_cards
       set executor_atual_id = plt_privado.fn_executor_pelo_log(new.card_id)
     where id = new.card_id;

  elsif new.tipo in ('qualidade_marcada', 'qualidade_parecer') then
    update public.plt_cards
       set qualidade_atual = new.estado_qualidade
     where id = new.card_id;

  elsif new.tipo = 'card_arquivado' then
    update public.plt_cards
       set arquivado_em = new.ocorrido_em,
           executor_atual_id = null
     where id = new.card_id;

  elsif new.tipo = 'delegacao' then
    -- SESSAO-12 (D-34): o responsável é projeção do último evento de delegação.
    update public.plt_cards
       set responsavel_id = nullif(new.dados ->> 'responsavel_id', '')::uuid
     where id = new.card_id;
  end if;

  return null;
end;
$$;

comment on function plt_privado.fn_projetar_posicao() is
  'Único lugar que escreve a posição do card. Reage a evento inserido; nunca o contrário. Projeta também arquivamento (S11) e responsável (S12).';

-- ----------------------------------------------------------------------------
-- 4 · Sorteio automático na chegada (AFTER — modo aleatoria, D-34)
--
-- Candidatos: gente ATIVA vinculada ao setor, com presença viva (15 min).
-- Balanceamento: menos afazeres abertos (cards + tarefas); empate → há mais
-- tempo sem receber. Sem candidato presente → card fica sem dono.
-- Roda depois da projeção (ordem alfabética dos triggers: p… < s…).
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_sortear_delegacao()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_modo  text;
  v_setor bigint;
  v_sorteado uuid;
  v_nome  text;
  v_evento_id bigint;
begin
  if new.tipo not in ('movimentacao_setor', 'card_criado') then
    return null;
  end if;
  v_setor := new.setor_destino_id;
  if v_setor is null then
    return null;
  end if;

  select s.modo_delegacao into v_modo from public.plt_setores s where s.id = v_setor;
  if v_modo is distinct from 'aleatoria' then
    return null;
  end if;

  select us.usuario_id into v_sorteado
    from public.plt_usuario_setores us
    join public.plt_usuarios u  on u.id = us.usuario_id and u.ativo
    join public.plt_presencas pr on pr.usuario_id = us.usuario_id
                                and pr.visto_em > now() - interval '15 minutes'
    left join lateral (
      select (select count(*) from public.plt_cards c
               where c.responsavel_id = us.usuario_id
                 and c.concluido_em is null and c.arquivado_em is null)
           + (select count(*) from public.plt_tarefas t
               where t.responsavel_id = us.usuario_id and t.situacao <> 'concluida')
             as abertos
    ) carga on true
   where us.setor_id = v_setor
   order by carga.abertos asc, pr.visto_em asc
   limit 1;

  if v_sorteado is null then
    return null; -- ninguém logado: o card espera na fila sem dono (M-03)
  end if;

  insert into public.plt_eventos (card_id, tipo, origem, dados)
       values (new.card_id, 'delegacao', 'automacao',
               jsonb_build_object('responsavel_id', v_sorteado, 'modo', 'aleatoria'))
    returning id into v_evento_id;

  -- O sorteado fica sabendo no sino.
  select u.nome into v_nome from public.plt_usuarios u where u.id = v_sorteado;
  insert into public.plt_notificacoes (destinatario_id, evento_id, card_id, tipo, titulo, corpo)
       values (v_sorteado, v_evento_id, new.card_id, 'delegacao',
               'Um afazer chegou para você',
               'O sorteio do setor colocou um card sob sua responsabilidade. Ele está na sua lista de afazeres.');

  return null;
end;
$$;

revoke all on function plt_privado.fn_sortear_delegacao() from public, anon, authenticated;

drop trigger if exists plt_eventos_sortear_delegacao on public.plt_eventos;
create trigger plt_eventos_sortear_delegacao
  after insert on public.plt_eventos
  for each row execute function plt_privado.fn_sortear_delegacao();

-- ----------------------------------------------------------------------------
-- 5 · Aviso ao delegado na atribuição DIRETA (o sorteio já avisa acima)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_avisar_delegado()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_resp uuid;
  v_autor text;
begin
  if new.tipo <> 'delegacao' or new.origem = 'automacao' then
    return null;
  end if;
  v_resp := nullif(new.dados ->> 'responsavel_id', '')::uuid;
  if v_resp is null or v_resp = new.usuario_id then
    return null; -- tirar o dono (ou delegar a si mesmo) não gera aviso
  end if;
  select u.nome into v_autor from public.plt_usuarios u where u.id = new.usuario_id;
  insert into public.plt_notificacoes (destinatario_id, evento_id, card_id, tipo, titulo, corpo)
       values (v_resp, new.id, new.card_id, 'delegacao',
               'Um afazer chegou para você',
               coalesce(v_autor, 'A liderança') || ' colocou um card sob sua responsabilidade. Ele está na sua lista de afazeres.');
  return null;
end;
$$;

revoke all on function plt_privado.fn_avisar_delegado() from public, anon, authenticated;

drop trigger if exists plt_eventos_avisar_delegado on public.plt_eventos;
create trigger plt_eventos_avisar_delegado
  after insert on public.plt_eventos
  for each row execute function plt_privado.fn_avisar_delegado();
