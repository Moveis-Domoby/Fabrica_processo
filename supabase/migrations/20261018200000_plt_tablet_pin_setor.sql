-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 95 — TABLET 2.0, parte 1:
-- o PIN DO SETOR e a identificação da pessoa SÓ PELO PIN (SESSAO-36 · D-146)
--
-- O que nasce aqui:
--   1. plt_setor_pins — o PIN de cada setor (SÓ hash; tabela fechada: RLS sem
--      política e acesso revogado — nem admin lê pelo navegador; quem escreve é
--      a Edge Function `autenticacao`, com a chave de serviço, e a mudança fica
--      na trilha — D-40).
--   2. plt_pin_tentativas — a trava de tentativa e erro dos PINs (por chave:
--      aparelho/IP ou pessoa). Fechada como acima.
--   3. plt_usuarios ganha: `pin_busca` (hash determinístico de BUSCA do PIN,
--      com segredo que mora no banco — padrão da cópia de fotos do Tiny:
--      o segredo nasce aqui e nunca passa por chat/repo/env), `conta_tablet`
--      (a conta de dispositivo do setor — D-06/D-146) e `pode_auxiliar`
--      (o liga/desliga do auxílio em outros setores — D-146 resposta 7).
--      ⚠️ E-50/D-68: plt_usuarios é lida POR COLUNA — `pin_busca` NÃO ganha
--      grant (ilegível pelo navegador); `conta_tablet` e `pode_auxiliar` sim.
--   4. CPF deixa de ser obrigatório SÓ para a conta de tablet (ela não é uma
--      pessoa); a matrícula dela nasce com o prefixo 000.
--
-- Nada aqui toca as tabelas da integração.
-- Idempotente: pode rodar duas vezes seguidas sem erro.
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · plt_setor_pins — o PIN do setor (hash, nunca o valor)
-- ----------------------------------------------------------------------------
create table if not exists public.plt_setor_pins (
  setor_id      bigint primary key references public.plt_setores(id) on delete cascade,
  pin_hash      text not null,            -- pbkdf2$iterações$sal$hash (o mesmo formato do PIN de pessoa)
  pin_busca     text not null,            -- HMAC determinística p/ achar o setor pelo PIN digitado
  alterado_por  uuid references public.plt_usuarios(id),
  alterado_em   timestamptz not null default now()
);

comment on table public.plt_setor_pins is
  'SESSAO-36 (D-146): o PIN de entrada do tablet de cada setor. Só hash; escrita só pela função de autenticação (admin, com trilha). Tabela fechada: nem o navegador nem o admin leem direto.';

create unique index if not exists plt_setor_pins_busca_uq on public.plt_setor_pins (pin_busca);

alter table public.plt_setor_pins enable row level security;
revoke all on public.plt_setor_pins from anon, authenticated, public;

-- ----------------------------------------------------------------------------
-- 2 · plt_pin_tentativas — a trava de tentativa e erro
--     chave = de onde vem a tentativa ('ip:<endereço>' na tela de entrada;
--     'tablet:<usuario_id da conta>' nas ações por PIN; 'email:<email>' no
--     entrar com e-mail + PIN). A função de autenticação conta e bloqueia.
-- ----------------------------------------------------------------------------
create table if not exists public.plt_pin_tentativas (
  chave          text primary key,
  erros          integer not null default 0,
  janela_inicio  timestamptz not null default now(),
  bloqueado_ate  timestamptz
);

comment on table public.plt_pin_tentativas is
  'SESSAO-36: contador de tentativas erradas de PIN por origem, com bloqueio curto. Só a função de autenticação escreve/lê.';

alter table public.plt_pin_tentativas enable row level security;
revoke all on public.plt_pin_tentativas from anon, authenticated, public;

-- ----------------------------------------------------------------------------
-- 3 · plt_usuarios — pin_busca, conta_tablet, pode_auxiliar
-- ----------------------------------------------------------------------------
alter table public.plt_usuarios add column if not exists pin_busca     text;
alter table public.plt_usuarios add column if not exists conta_tablet  boolean not null default false;
alter table public.plt_usuarios add column if not exists pode_auxiliar boolean not null default false;

comment on column public.plt_usuarios.pin_busca is
  'SESSAO-36: hash determinístico (HMAC com segredo do banco) do PIN, só para ACHAR a pessoa pelo PIN digitado — a conferência continua pelo pin_hash (PBKDF2). Nulo em quem definiu o PIN antes desta sessão (preenchido no próximo acerto). FORA da API (E-50: sem grant).';
comment on column public.plt_usuarios.conta_tablet is
  'SESSAO-36 (D-146 extra 1): a conta de dispositivo do tablet de um setor — não é uma pessoa; nasce sozinha na primeira entrada pelo PIN do setor.';
comment on column public.plt_usuarios.pode_auxiliar is
  'SESSAO-36 (D-146 resposta 7): liga/desliga geral — a pessoa pode auxiliar em cards de OUTROS setores de produção.';

-- o PIN de busca é único (a identificação pelo PIN exige PIN único — D-146 resposta 2);
-- quem definiu o PIN antes desta sessão fica nulo até o próximo acerto, e duplicado
-- histórico é descoberto no uso (hash com sal não revela duplicata parada).
create unique index if not exists plt_usuarios_pin_busca_uq
  on public.plt_usuarios (pin_busca) where pin_busca is not null;

-- leitura por coluna (E-50/D-68): as novas visíveis são só conta_tablet e pode_auxiliar
grant select (conta_tablet, pode_auxiliar) on public.plt_usuarios to authenticated;

-- ----------------------------------------------------------------------------
-- 4 · CPF opcional SÓ para a conta de tablet; matrícula dela com prefixo 000
-- ----------------------------------------------------------------------------
alter table public.plt_usuarios alter column cpf drop not null;

alter table public.plt_usuarios drop constraint if exists plt_usuarios_cpf_presenca_ck;
alter table public.plt_usuarios add constraint plt_usuarios_cpf_presenca_ck
  check (cpf is not null or conta_tablet);

-- fn_gerar_matricula — recriada POR INTEIRO a partir da versão viva (migration
-- 16), com UMA mudança: a conta de tablet não tem CPF e ganha o prefixo 000.
create or replace function plt_privado.fn_gerar_matricula()
returns trigger
language plpgsql
security definer -- migration 12 (E-14): trigger roda com o privilégio de quem insere
set search_path = public, pg_temp
as $$
declare
  v_ordem bigint;
begin
  -- normaliza antes de validar: CPF só dígitos, usuário minúsculo, e-mail minúsculo
  new.cpf     := nullif(regexp_replace(coalesce(new.cpf, ''), '\D', '', 'g'), '');
  new.usuario := lower(trim(coalesce(new.usuario, '')));
  new.email   := lower(trim(coalesce(new.email, '')));

  if new.matricula is null then
    if coalesce(new.conta_tablet, false) and new.cpf is null then
      -- conta de dispositivo (SESSAO-36): sem CPF; a matrícula nasce com 000
      v_ordem := nextval('plt_privado.matricula_seq');
      new.matricula := 'MDM-000-'
        || lpad(v_ordem::text, greatest(3, length(v_ordem::text)), '0');
    else
      -- D-21: matrícula MDM-XXX-NNN depende do CPF.
      if new.cpf is null or new.cpf !~ '^[0-9]{11}$' then
        raise exception 'CPF é obrigatório (11 dígitos) para gerar a matrícula.';
      end if;
      v_ordem := nextval('plt_privado.matricula_seq');
      new.matricula := 'MDM-' || substr(new.cpf, 1, 3) || '-'
        || lpad(v_ordem::text, greatest(3, length(v_ordem::text)), '0');
    end if;
  end if;

  return new;
end;
$$;

comment on function plt_privado.fn_gerar_matricula() is
  'Gera MDM-XXX-NNN no cadastro (D-21) e normaliza cpf/usuario/email. XXX = 3 primeiros dígitos do CPF; conta de tablet (SESSAO-36) não tem CPF e usa 000.';

-- ----------------------------------------------------------------------------
-- 5 · O segredo da busca do PIN nasce NO BANCO (padrão da cópia de fotos do
--     Tiny): a função de autenticação o lê pela chave de serviço; ele nunca
--     passa por chat, repositório ou variável de ambiente.
-- ----------------------------------------------------------------------------
insert into public.plt_webhooks (nome, url, eventos, segredo, ativo)
select 'Autenticação · chave de busca do PIN', 'interno://pin', '{pin_chave}',
       replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), true
 where not exists (
   select 1 from public.plt_webhooks where eventos = '{pin_chave}'::text[]
 );
