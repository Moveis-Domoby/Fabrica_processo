-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 02 — ESTRUTURA (setores e etapas)
-- Sessão: SESSAO-02 · Data: 2026-08-26
--
-- Estrutura em 2 níveis como no ClickUp (D-12): SETORES contêm ETAPAS internas.
-- Os dois são cadastráveis pelo admin — nada de estrutura fixa no código (RF-07).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · plt_setores — o card viaja ENTRE setores
--
-- `papel_no_fluxo` codifica a D-13 sem inventar nada:
--   entrada   → todo pedido entra por aqui; existe UM só (índice único abaixo)
--   producao  → setor comum do meio do caminho
--   terminal  → fim de linha: o card fica parado ou é entregue
--
-- `modo_delegacao` atende a RF-43 (modo personalizável por setor). O
-- comportamento é a SESSAO-12; aqui existe só o lugar de configurar.
-- ----------------------------------------------------------------------------
create table if not exists public.plt_setores (
  id              bigint generated always as identity primary key,
  codigo          text not null unique,          -- slug estável: 'secc', 'fitamento'
  nome            text not null,                 -- como o galpão fala: 'SECC', 'FITAMENTO'
  papel_no_fluxo  text not null default 'producao'
                  check (papel_no_fluxo in ('entrada', 'producao', 'terminal')),
  modo_delegacao  text not null default 'direta'
                  check (modo_delegacao in ('direta', 'aleatoria')),
  ordem           integer not null default 0,
  cor             text,                          -- token do design system, opcional
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

comment on table public.plt_setores is
  'Setores da produção (D-12). O card viaja entre eles. Admin cadastra novos — nada é fixo no código.';
comment on column public.plt_setores.nome is
  'Nome como a equipe fala, sem tradução: SECC, FITAMENTO, FURAÇÃO, PCP (regra 12 do CLAUDE.md).';
comment on column public.plt_setores.papel_no_fluxo is
  'D-13: entrada única (PCP), produção no meio, terminal no fim (o card fica parado ou é entregue).';

-- D-13: entrada é ÚNICA. O banco garante, não a boa vontade de quem cadastra.
create unique index if not exists plt_setores_entrada_unica
  on public.plt_setores (papel_no_fluxo) where papel_no_fluxo = 'entrada';

create index if not exists plt_setores_ordem_idx
  on public.plt_setores (ordem) where ativo;

drop trigger if exists plt_setores_atualizacao on public.plt_setores;
create trigger plt_setores_atualizacao
  before update on public.plt_setores
  for each row execute function plt_privado.fn_marcar_atualizacao();

-- Fecha o vínculo pessoa ↔ setor criado na migration 01.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'plt_usuario_setores_setor_fk'
  ) then
    alter table public.plt_usuario_setores
      add constraint plt_usuario_setores_setor_fk
      foreign key (setor_id) references public.plt_setores(id) on delete cascade;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2 · plt_etapas — as etapas internas DE CADA setor
--
-- ⚠️ D-14, palavras do dono: "cada setor tem suas peculiaridades internas, não
-- apenas aguardando, execução e finalizado". O sistema NÃO impõe trio padrão e
-- NÃO semeia etapa nenhuma — o dono cadastra as dele quando vir a plataforma.
-- Por isso não existe seed de etapas em lugar algum deste repositório.
--
-- Toda etapa cadastrada JÁ NASCE CONTANDO TEMPO: o timer é propriedade da
-- etapa, não uma feature que alguém liga (D-14 / RF-08 / M-11). Por isso não
-- existe coluna "conta_tempo" — não há etapa que não conte.
-- ----------------------------------------------------------------------------
create table if not exists public.plt_etapas (
  id             bigint generated always as identity primary key,
  setor_id       bigint not null references public.plt_setores(id) on delete cascade,
  nome           text not null,
  ordem          integer not null default 0,
  eh_fila        boolean not null default false,
  ativa          boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (setor_id, nome)
);

comment on table public.plt_etapas is
  'Etapas internas de cada setor (D-14). Cadastro livre; NENHUM seed. Toda etapa conta tempo por natureza.';
comment on column public.plt_etapas.eh_fila is
  'Marca a etapa onde o card espera sem dono. D-02: tempo de fila pertence ao SETOR, nunca a uma pessoa.';

create index if not exists plt_etapas_setor_idx
  on public.plt_etapas (setor_id, ordem) where ativa;

drop trigger if exists plt_etapas_atualizacao on public.plt_etapas;
create trigger plt_etapas_atualizacao
  before update on public.plt_etapas
  for each row execute function plt_privado.fn_marcar_atualizacao();

-- Uma etapa de fila por setor, no máximo: se houvesse duas, o tempo de fila do
-- setor ficaria ambíguo e a métrica de gargalo (D-02) perderia sentido.
create unique index if not exists plt_etapas_fila_unica_por_setor
  on public.plt_etapas (setor_id) where eh_fila and ativa;
