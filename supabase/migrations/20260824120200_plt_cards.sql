-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 03 — CARDS
-- Sessão: SESSAO-02 · Data: 2026-08-24
--
-- D-01, card híbrido: o PCP enxerga o PEDIDO inteiro para decidir; ao liberar,
-- cada móvel vira UM CARD POR UNIDADE (o (k/n) de hoje) que percorre os setores
-- sozinho. As unidades se reencontram no fim de linha (D-13).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ⚠️ LIÇÃO CARA, LEIA ANTES DE MEXER
--
-- NÃO existe foreign key daqui para `public.pedido_itens` — e isso é decisão,
-- não esquecimento. A função `fn_upsert_pedido` (a única porta de escrita do
-- banco da integração) faz `delete from pedido_itens where pedido_id = ...`
-- e regrava tudo a CADA atualização de pedido vinda do Tiny. Uma FK apontando
-- para lá faria toda atualização de pedido falhar em produção.
--
-- Por isso o item fica gravado como SNAPSHOT (`item_seq`, `item_codigo`,
-- `item_descricao`): o card sobrevive à regravação dos itens.
-- A FK para `public.pedidos` é segura — o upsert atualiza, nunca apaga pedido.
-- ----------------------------------------------------------------------------

create table if not exists public.plt_cards (
  id                bigint generated always as identity primary key,

  -- Que tipo de card é este (D-01)
  tipo              text not null
                    check (tipo in ('pedido', 'unidade')),

  -- Vínculo com o pedido que o Tiny já gravou via n8n (D-08)
  pedido_id         bigint not null references public.pedidos(id),

  -- Card de unidade: de qual item do pedido ele saiu, e qual unidade é (k/n)
  card_pai_id       bigint references public.plt_cards(id) on delete cascade,
  item_seq          integer,                  -- pedido_itens.seq — SEM FK (ver aviso acima)
  item_codigo       text,                     -- snapshot do SKU
  item_descricao    text,                     -- snapshot da descrição
  indice_unidade    integer,                  -- o "k" de (k/n)
  total_unidades    integer,                  -- o "n" de (k/n)

  -- Posição atual: PROJEÇÃO do último evento, mantida por trigger.
  -- Ninguém escreve nestas colunas à mão — a verdade é plt_eventos (M-02).
  setor_atual_id    bigint references public.plt_setores(id),
  etapa_atual_id    bigint references public.plt_etapas(id),
  desde             timestamptz,              -- quando chegou na etapa atual
  executor_atual_id uuid references public.plt_usuarios(id),

  -- Último estado de qualidade conhecido (D-09), também projetado de evento
  qualidade_atual   text
                    check (qualidade_atual in ('perfeito', 'atencao', 'danificado')),

  concluido_em      timestamptz,              -- chegou a um setor terminal (D-13)
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),

  -- Um card de unidade tem que dizer qual unidade é; um card de pedido, não.
  constraint plt_cards_unidade_coerente check (
    (tipo = 'unidade' and indice_unidade is not null and total_unidades is not null)
    or (tipo = 'pedido' and indice_unidade is null and total_unidades is null)
  )
);

comment on table public.plt_cards is
  'Cards do kanban (D-01). tipo=pedido é o que o PCP enxerga; tipo=unidade é o (k/n) que percorre os setores.';
comment on column public.plt_cards.item_seq is
  'pedido_itens.seq. SEM foreign key de propósito: fn_upsert_pedido apaga e regrava os itens a cada atualização.';
comment on column public.plt_cards.setor_atual_id is
  'Projeção do último evento de movimentação. Não escreva à mão — a verdade vive em plt_eventos (RNF-05).';
comment on column public.plt_cards.desde is
  'Início da permanência na etapa atual. É daqui que sai o "parado há X" das telas.';

create index if not exists plt_cards_pedido_idx on public.plt_cards (pedido_id);
create index if not exists plt_cards_pai_idx on public.plt_cards (card_pai_id);
create index if not exists plt_cards_posicao_idx
  on public.plt_cards (setor_atual_id, etapa_atual_id) where concluido_em is null;
create index if not exists plt_cards_executor_idx
  on public.plt_cards (executor_atual_id) where concluido_em is null;

-- Uma unidade só existe uma vez por (pedido, item, k).
create unique index if not exists plt_cards_unidade_uq
  on public.plt_cards (pedido_id, item_seq, indice_unidade)
  where tipo = 'unidade';

-- Um card de pedido só existe uma vez por pedido.
create unique index if not exists plt_cards_pedido_uq
  on public.plt_cards (pedido_id) where tipo = 'pedido';

drop trigger if exists plt_cards_atualizacao on public.plt_cards;
create trigger plt_cards_atualizacao
  before update on public.plt_cards
  for each row execute function public.plt_fn_marcar_atualizacao();
