-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 01 — PESSOAS
-- Sessão: SESSAO-02 · Data: 2026-08-24
--
-- Prefixo `plt_` em tudo. NENHUMA tabela existente da integração (clientes,
-- pedidos, pedido_itens, eventos, gp_pcp_processados) é alterada aqui.
--
-- Idempotente: pode rodar duas vezes seguidas sem erro.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · plt_usuarios — as pessoas da fábrica
--
-- O vínculo com o Supabase Auth é OPCIONAL de propósito (D-06): o operador que
-- só usa o tablet compartilhado do setor se identifica por PIN e pode não ter
-- conta de login nenhuma. Quem usa o celular pessoal ganha `auth_user_id`.
-- A mecânica de login e de PIN é a SESSAO-03 — aqui só existe o lugar.
--
-- `pin_hash` guarda HASH, nunca o PIN. Regra crítica 4 da casa: credencial não
-- entra em lugar nenhum em texto puro.
-- ----------------------------------------------------------------------------
create table if not exists public.plt_usuarios (
  id             uuid primary key default gen_random_uuid(),
  auth_user_id   uuid unique,                    -- null = pessoa sem login próprio
  nome           text not null,
  email          text,
  telefone       text,
  papel          text not null default 'operador'
                 check (papel in ('operador', 'lider', 'admin')),
  pin_hash       text,                           -- hash do PIN do tablet (SESSAO-03)
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

comment on table public.plt_usuarios is
  'Pessoas da plataforma. auth_user_id é opcional: operador de tablet compartilhado pode não ter login (D-06).';
comment on column public.plt_usuarios.papel is
  'Três níveis de navegação (RF-24): operador vê o simples, líder vê o setor completo, admin vê tudo.';
comment on column public.plt_usuarios.pin_hash is
  'HASH do PIN, nunca o PIN. Preenchido na SESSAO-03.';

create unique index if not exists plt_usuarios_email_uq
  on public.plt_usuarios (lower(email)) where email is not null and email <> '';
create index if not exists plt_usuarios_papel_idx on public.plt_usuarios (papel) where ativo;

-- ----------------------------------------------------------------------------
-- 2 · plt_usuario_setores — quem trabalha em qual setor
--
-- Uma pessoa pode estar em mais de um setor (a fábrica é pequena e as pessoas
-- circulam). `lider_do_setor` é o que dá visão completa daquele setor a quem
-- não é admin.
-- ----------------------------------------------------------------------------
create table if not exists public.plt_usuario_setores (
  usuario_id      uuid not null references public.plt_usuarios(id) on delete cascade,
  setor_id        bigint not null,               -- FK criada na migration 02
  lider_do_setor  boolean not null default false,
  criado_em       timestamptz not null default now(),
  primary key (usuario_id, setor_id)
);

comment on table public.plt_usuario_setores is
  'Vínculo pessoa ↔ setor (RF-21). lider_do_setor dá a visão completa daquele setor.';

create index if not exists plt_usuario_setores_setor_idx
  on public.plt_usuario_setores (setor_id);

-- ----------------------------------------------------------------------------
-- 3 · Manutenção de `atualizado_em`
-- Uma função só, reaproveitada por todas as tabelas da plataforma.
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_marcar_atualizacao()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

comment on function public.plt_fn_marcar_atualizacao() is
  'Trigger genérica: mantém atualizado_em em dia nas tabelas plt_*.';

drop trigger if exists plt_usuarios_atualizacao on public.plt_usuarios;
create trigger plt_usuarios_atualizacao
  before update on public.plt_usuarios
  for each row execute function public.plt_fn_marcar_atualizacao();
