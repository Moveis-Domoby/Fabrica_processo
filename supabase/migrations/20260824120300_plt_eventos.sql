-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 04 — EVENTOS (append-only)
-- Sessão: SESSAO-02 · Data: 2026-08-24
--
-- RNF-05 / M-02: o evento é a TABELA-MÃE. Timers, filas, dashboards e
-- produtividade são TODOS derivados daqui. Nada de estado editável.
-- Correção é um evento novo — nunca um UPDATE, nunca um DELETE.
--
-- ⚠️ Esta tabela existente `public.eventos` (log do upsert do Tiny) NÃO é esta.
-- São coisas diferentes e nenhuma toca na outra.
-- ============================================================================

create table if not exists public.plt_eventos (
  id                 bigint generated always as identity primary key,
  card_id            bigint not null references public.plt_cards(id),

  -- Os tipos vêm da demanda da SESSAO-02, nada inventado além dela:
  -- movimentação entre setores e entre etapas, iniciar, finalizar, atestação
  -- de qualidade, divergência, notificação — mais a criação do card.
  tipo               text not null check (tipo in (
                       'card_criado',
                       'movimentacao_setor',
                       'movimentacao_etapa',
                       'execucao_iniciada',
                       'execucao_finalizada',
                       'qualidade_marcada',      -- quem ENTREGA marca (D-09)
                       'qualidade_parecer',      -- quem RECEBE registra o parecer
                       'divergencia_registrada',
                       'notificacao_enviada',
                       'delegacao'
                     )),

  -- Quem fez. NULL quando veio de fora: a API move sem pessoa e sem estado de
  -- qualidade (D-09 / Q-19 ✅ — atestação é gesto exclusivamente humano).
  usuario_id         uuid references public.plt_usuarios(id),
  origem             text not null default 'interface'
                     check (origem in ('interface', 'api', 'automacao')),

  -- De onde para onde
  setor_origem_id    bigint references public.plt_setores(id),
  etapa_origem_id    bigint references public.plt_etapas(id),
  setor_destino_id   bigint references public.plt_setores(id),
  etapa_destino_id   bigint references public.plt_etapas(id),

  -- Qualidade (D-09). Só faz sentido nos tipos de qualidade — restrição abaixo.
  estado_qualidade   text check (estado_qualidade in ('perfeito', 'atencao', 'danificado')),

  -- Liga o parecer do recebedor à marcação do remetente. É este vínculo que
  -- permite calcular divergência sem guardar estado mutável.
  evento_referencia_id bigint references public.plt_eventos(id),

  observacao         text,
  dados              jsonb not null default '{}'::jsonb,

  ocorrido_em        timestamptz not null default now(),
  registrado_em      timestamptz not null default now(),

  constraint plt_eventos_qualidade_coerente check (
    (tipo in ('qualidade_marcada', 'qualidade_parecer') and estado_qualidade is not null)
    or (tipo not in ('qualidade_marcada', 'qualidade_parecer'))
  )
);

comment on table public.plt_eventos is
  'APPEND-ONLY (RNF-05). A tabela-mãe: tempo, fila, produtividade e qualidade são derivados daqui. Correção é evento novo.';
comment on column public.plt_eventos.usuario_id is
  'NULL quando a movimentação veio da API/automação — não há pessoa a quem atribuir.';
comment on column public.plt_eventos.evento_referencia_id is
  'No parecer do recebedor, aponta para a marcação do remetente. Base do cálculo de divergência (D-09).';
comment on column public.plt_eventos.ocorrido_em is
  'Quando aconteceu de verdade. registrado_em é quando chegou ao banco — podem diferir se a API repuser algo atrasado.';

create index if not exists plt_eventos_card_idx on public.plt_eventos (card_id, ocorrido_em);
create index if not exists plt_eventos_tipo_idx on public.plt_eventos (tipo, ocorrido_em);
create index if not exists plt_eventos_usuario_idx
  on public.plt_eventos (usuario_id, ocorrido_em) where usuario_id is not null;
create index if not exists plt_eventos_setor_destino_idx
  on public.plt_eventos (setor_destino_id, ocorrido_em);
create index if not exists plt_eventos_referencia_idx
  on public.plt_eventos (evento_referencia_id) where evento_referencia_id is not null;

-- ----------------------------------------------------------------------------
-- APPEND-ONLY DE VERDADE
--
-- Só RLS não basta: a `service_role` (que o n8n usa) ignora RLS. A trava tem
-- que estar no banco, valendo para todo mundo — inclusive para quem tem a
-- chave mais poderosa. Por isso a guarda é uma trigger.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_evento_imutavel()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception
    'plt_eventos é append-only (RNF-05): % não é permitido. Correção se faz com um evento novo.',
    tg_op
    using errcode = 'restrict_violation';
end;
$$;

comment on function plt_privado.fn_evento_imutavel() is
  'Guarda de append-only. Vale até para service_role, que ignora RLS.';

drop trigger if exists plt_eventos_sem_update on public.plt_eventos;
create trigger plt_eventos_sem_update
  before update on public.plt_eventos
  for each row execute function plt_privado.fn_evento_imutavel();

drop trigger if exists plt_eventos_sem_delete on public.plt_eventos;
create trigger plt_eventos_sem_delete
  before delete on public.plt_eventos
  for each row execute function plt_privado.fn_evento_imutavel();

revoke update, delete, truncate on public.plt_eventos from anon, authenticated;

-- ----------------------------------------------------------------------------
-- PROJEÇÃO DA POSIÇÃO DO CARD
--
-- O card guarda onde está para a tela ser rápida, mas quem manda é o evento.
-- Esta trigger é o único lugar do sistema que escreve a posição.
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
           -- Mudou de etapa: quem estava executando não está mais.
           executor_atual_id = null,
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

  elsif new.tipo in ('qualidade_marcada', 'qualidade_parecer') then
    update public.plt_cards
       set qualidade_atual = new.estado_qualidade
     where id = new.card_id;
  end if;

  return null;
end;
$$;

comment on function plt_privado.fn_projetar_posicao() is
  'Único lugar que escreve a posição do card. Reage a evento inserido; nunca o contrário.';

drop trigger if exists plt_eventos_projetar on public.plt_eventos;
create trigger plt_eventos_projetar
  after insert on public.plt_eventos
  for each row execute function plt_privado.fn_projetar_posicao();
