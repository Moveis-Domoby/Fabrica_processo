-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 11 — IDENTIDADE E ACESSO
-- Sessão: SESSAO-03 · Data: 2026-08-26 · Decisão: D-21
--
-- Tudo entra na PRÓPRIA plt_usuarios — o dono pediu explicitamente uma tabela
-- só de usuário ("não crie tables para separar dados de usuários internos"):
-- ela vai crescer com os dados de gestão no futuro.
--
-- NENHUMA tabela da integração (clientes, pedidos, pedido_itens, eventos,
-- gp_pcp_processados) é tocada. Idempotente: roda duas vezes sem erro.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · Campos novos de identidade (D-21)
--
--   cpf            → obrigatório; só dígitos (11). Alimenta a matrícula.
--   usuario        → nome de usuário para login (entra com ele OU com e-mail).
--   matricula      → MDM-XXX-NNN: XXX = 3 primeiros dígitos do CPF,
--                    NNN = ordem de cadastro (001, 002…). Gerada por trigger,
--                    nunca digitada.
--   senha_padrao   → true enquanto a pessoa não trocar a senha de criação.
--                    O front não libera tela nenhuma enquanto for true.
--   convite_token  → o token do link de convite enviado por WhatsApp.
--   convite_usado_em → quando o primeiro acesso se completou.
-- ----------------------------------------------------------------------------
alter table public.plt_usuarios add column if not exists cpf              text;
alter table public.plt_usuarios add column if not exists usuario          text;
alter table public.plt_usuarios add column if not exists matricula        text;
alter table public.plt_usuarios add column if not exists senha_padrao     boolean not null default true;
alter table public.plt_usuarios add column if not exists convite_token    uuid default gen_random_uuid();
alter table public.plt_usuarios add column if not exists convite_usado_em timestamptz;

comment on column public.plt_usuarios.cpf is
  'Obrigatório (D-21). Só dígitos. Leitura revogada da API — dado pessoal; a tela mostra a matrícula.';
comment on column public.plt_usuarios.usuario is
  'Nome de usuário para login (D-21): a pessoa entra com ele OU com o e-mail.';
comment on column public.plt_usuarios.matricula is
  'MDM-XXX-NNN — XXX = 3 primeiros dígitos do CPF, NNN = ordem de cadastro. Gerada por trigger, nunca digitada.';
comment on column public.plt_usuarios.senha_padrao is
  'true = ainda usa a senha de criação; o front exige a troca antes de liberar qualquer tela (D-21).';
comment on column public.plt_usuarios.convite_token is
  'Token do link de convite (WhatsApp). Leitura revogada da API — só o servidor resolve.';

-- Formato garantido no banco, não só na tela.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'plt_usuarios_cpf_formato') then
    alter table public.plt_usuarios
      add constraint plt_usuarios_cpf_formato check (cpf ~ '^[0-9]{11}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'plt_usuarios_usuario_formato') then
    alter table public.plt_usuarios
      add constraint plt_usuarios_usuario_formato check (usuario ~ '^[a-z0-9._-]{3,32}$');
  end if;
end;
$$;

-- A tabela está vazia em produção (conferido na SESSAO-02): dá para exigir já.
alter table public.plt_usuarios alter column cpf     set not null;
alter table public.plt_usuarios alter column usuario set not null;
alter table public.plt_usuarios alter column email   set not null;

create unique index if not exists plt_usuarios_cpf_uq       on public.plt_usuarios (cpf);
create unique index if not exists plt_usuarios_usuario_uq   on public.plt_usuarios (lower(usuario));
create unique index if not exists plt_usuarios_matricula_uq on public.plt_usuarios (matricula);
create unique index if not exists plt_usuarios_convite_uq   on public.plt_usuarios (convite_token)
  where convite_token is not null;

-- ----------------------------------------------------------------------------
-- 2 · Matrícula: gerada pelo banco no cadastro, nunca digitada
--
-- A ordem de cadastro vem de uma sequência — quem foi o primeiro é 001 para
-- sempre, mesmo que alguém seja excluído depois. lpad com greatest: do 1000º
-- usuário em diante a matrícula cresce para 4 dígitos em vez de truncar.
-- ----------------------------------------------------------------------------
create sequence if not exists plt_privado.matricula_seq;

create or replace function plt_privado.fn_gerar_matricula()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_ordem bigint;
begin
  -- normaliza antes de validar: CPF só dígitos, usuário minúsculo, e-mail minúsculo
  new.cpf     := regexp_replace(coalesce(new.cpf, ''), '\D', '', 'g');
  new.usuario := lower(trim(coalesce(new.usuario, '')));
  new.email   := lower(trim(coalesce(new.email, '')));

  if new.matricula is null then
    if new.cpf !~ '^[0-9]{11}$' then
      raise exception 'CPF é obrigatório (11 dígitos) para gerar a matrícula — D-21';
    end if;
    v_ordem := nextval('plt_privado.matricula_seq');
    new.matricula := 'MDM-' || substr(new.cpf, 1, 3) || '-'
      || lpad(v_ordem::text, greatest(3, length(v_ordem::text)), '0');
  end if;

  return new;
end;
$$;

comment on function plt_privado.fn_gerar_matricula() is
  'Gera MDM-XXX-NNN no cadastro (D-21) e normaliza cpf/usuario/email. XXX = 3 primeiros dígitos do CPF; NNN = ordem de cadastro.';

drop trigger if exists plt_usuarios_matricula on public.plt_usuarios;
create trigger plt_usuarios_matricula
  before insert on public.plt_usuarios
  for each row execute function plt_privado.fn_gerar_matricula();

-- ----------------------------------------------------------------------------
-- 3 · O que a API pode ver e mexer em plt_usuarios
--
-- Dado pessoal e material de acesso ficam fora do alcance do navegador:
--   · cpf e convite_token: leitura revogada (pin_hash já era, desde a 08).
--     A tela identifica a pessoa pela MATRÍCULA, que carrega só 3 dígitos.
--   · escrita: criar/excluir usuário e mudar papel/PIN/senha_padrao passam
--     SEMPRE pela Edge Function (service_role) — pelo navegador, a pessoa só
--     edita o próprio nome e telefone (política plt_usuarios_edita_a_si).
--
-- Consequência prática: o front NUNCA usa select('*') em plt_usuarios —
-- coluna revogada derruba o `*` inteiro no PostgREST. Sempre nomear colunas.
-- ----------------------------------------------------------------------------
revoke select (cpf, convite_token) on public.plt_usuarios from anon, authenticated;

revoke insert, update, delete on public.plt_usuarios from authenticated;
grant  update (nome, telefone) on public.plt_usuarios to authenticated;
