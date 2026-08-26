-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 06 — TAREFAS E VISUALIZAÇÕES
-- Sessão: SESSAO-02 · Data: 2026-08-24
--
-- Aqui existe só o LUGAR de guardar. O comportamento de tarefas e delegação é
-- a SESSAO-09; o de dashboards é a SESSAO-08. Nada de regra de negócio agora.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · plt_tarefas — "meus afazeres" e "afazeres do time" (RF-40 a RF-43)
--
-- A tarefa pode estar amarrada a um card, a um setor, ou a nada (recado solto).
-- `delegacao` registra COMO o responsável foi escolhido — é o que permite ver
-- depois se o sorteio (RF-41) distribui bem ou concentra em quem já está cheio.
-- ----------------------------------------------------------------------------
create table if not exists public.plt_tarefas (
  id             bigint generated always as identity primary key,
  titulo         text not null,
  descricao      text,
  card_id        bigint references public.plt_cards(id) on delete cascade,
  setor_id       bigint references public.plt_setores(id) on delete set null,
  responsavel_id uuid references public.plt_usuarios(id) on delete set null,
  criada_por_id  uuid references public.plt_usuarios(id) on delete set null,
  delegacao      text not null default 'direta'
                 check (delegacao in ('direta', 'aleatoria')),
  situacao       text not null default 'aberta'
                 check (situacao in ('aberta', 'em_andamento', 'concluida')),
  prazo          timestamptz,
  concluida_em   timestamptz,
  criada_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

comment on table public.plt_tarefas is
  'Tarefas e delegação (RF-40 a RF-43). O comportamento é a SESSAO-09 — aqui só o lugar de guardar.';
comment on column public.plt_tarefas.delegacao is
  'Como o responsável foi escolhido. Guardar isso é o que permite auditar depois se o sorteio distribui bem.';

create index if not exists plt_tarefas_responsavel_idx
  on public.plt_tarefas (responsavel_id, situacao) where situacao <> 'concluida';
create index if not exists plt_tarefas_setor_idx
  on public.plt_tarefas (setor_id, situacao) where situacao <> 'concluida';

drop trigger if exists plt_tarefas_atualizacao on public.plt_tarefas;
create trigger plt_tarefas_atualizacao
  before update on public.plt_tarefas
  for each row execute function public.plt_fn_marcar_atualizacao();

-- ----------------------------------------------------------------------------
-- 2 · plt_visualizacoes — painéis personalizados salvos (RF-32, RF-33)
--
-- `configuracao` é jsonb de propósito: o formato do painel vai mudar muito
-- entre a SESSAO-08 e o uso real, e migrar coluna a cada ajuste de gráfico
-- seria atrito puro. O que precisa ser consultável (dono, escopo) é coluna.
-- ----------------------------------------------------------------------------
create table if not exists public.plt_visualizacoes (
  id             bigint generated always as identity primary key,
  usuario_id     uuid references public.plt_usuarios(id) on delete cascade,
  nome           text not null,
  escopo         text not null default 'pessoal'
                 check (escopo in ('pessoal', 'setor', 'global')),
  setor_id       bigint references public.plt_setores(id) on delete cascade,
  configuracao   jsonb not null default '{}'::jsonb,
  padrao         boolean not null default false,
  criada_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),

  -- Visualização de escopo 'setor' precisa dizer de qual setor.
  constraint plt_visualizacoes_escopo_coerente check (
    (escopo = 'setor' and setor_id is not null)
    or (escopo <> 'setor' and setor_id is null)
  )
);

comment on table public.plt_visualizacoes is
  'Visualizações personalizadas salvas (RF-33), com troca fácil entre elas. Formato do painel vive em configuracao jsonb.';

create index if not exists plt_visualizacoes_usuario_idx
  on public.plt_visualizacoes (usuario_id, nome);

-- Uma visualização padrão por pessoa, no máximo.
create unique index if not exists plt_visualizacoes_padrao_uq
  on public.plt_visualizacoes (usuario_id) where padrao;

drop trigger if exists plt_visualizacoes_atualizacao on public.plt_visualizacoes;
create trigger plt_visualizacoes_atualizacao
  before update on public.plt_visualizacoes
  for each row execute function public.plt_fn_marcar_atualizacao();
