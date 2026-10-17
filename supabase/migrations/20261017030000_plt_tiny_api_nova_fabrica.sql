-- ============================================================================
-- SESSAO-33 · migration 91 — A API NOVA DO TINY NA CONTA DA FÁBRICA, COM O
-- RENOVADOR PRÓPRIO (D-142 resposta 1: "pode criar o aplicativo na conta da
-- fábrica, com o renovador próprio — um renovador por credencial, sempre")
--
-- Banco enxuto (D-47): a credencial da fábrica mora na MESMA tabela da da loja
-- (`tiny_auth`), na linha 2. Conferido em 16/10 (só leitura, código das 11
-- funções e do banco, e o registro de consultas desde 17/08): o único leitor e
-- escritor da tabela é o renovador da loja (`tiny-auth-refresh`), sempre com
-- `id = 1` — a linha 2 não o atrapalha.
--
--   · 1 = LOJA (o Comercial): renovada SÓ pelo `tiny-auth-refresh-cron`.
--   · 2 = FÁBRICA: renovada SÓ pelo `tiny-fabrica-token` (a função nova), pelo
--     relógio próprio dela, agendado no momento em que o dono autoriza.
-- Ninguém mais renova — e quem chama a API nova (a ponte `tiny-v3`) só LÊ; um
-- 401 vira erro e alerta, nunca renovação (A-18).
--
-- O dono autoriza em Configurações → API e integrações → "Ligar a API nova da
-- fábrica" (o navegador vai ao Tiny, ele entra com a conta da fábrica e volta).
-- Os segredos do aplicativo (TINY_FABRICA_CLIENT_ID e _SECRET) ficam só nos
-- segredos das funções da Supabase — postos pelo dono em casa (regra 4).
-- ============================================================================

set local lock_timeout = '5s';

-- a tabela aceita as duas contas (a linha 2 nasce só quando o dono autorizar)
alter table public.tiny_auth drop constraint if exists single_row;
do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.tiny_auth'::regclass and conname = 'tiny_auth_contas_ck') then
    alter table public.tiny_auth add constraint tiny_auth_contas_ck check (id in (1, 2));
  end if;
end $$;

comment on table public.tiny_auth is
  'Tokens OAuth da API v3 do Tiny, uma linha por conta (SESSAO-33, D-142): 1 = LOJA (Comercial) — renovada SÓ pelo tiny-auth-refresh-cron; 2 = FÁBRICA — renovada SÓ pela função tiny-fabrica-token (relógio tiny-fabrica-token-cron). Um renovador por credencial, sempre (E-07, A-18). Sem policy: segredo de máquina, só a chave de serviço.';

-- ----------------------------------------------------------------------------
-- A ponte (tiny-v3) lê o token — só a chave de serviço (a chamada da ponte usa
-- a chave de quem a chamou: o n8n; ninguém mais passa)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_tiny_token_ler(p_conta text)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select a.access_token from public.tiny_auth a
   where a.id = case p_conta when 'loja' then 1 when 'fabrica' then 2 end
$$;

comment on function public.plt_fn_tiny_token_ler(text) is
  'SESSAO-33: o token da API nova da conta (loja | fabrica) para a ponte tiny-v3 — que SÓ LÊ (nunca renova: A-18). Só a chave de serviço.';

-- ----------------------------------------------------------------------------
-- O dono começa a autorização (a função confere aqui, com o login dele, que é
-- o super admin)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_tiny_fabrica_autorizar_preparar()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quem uuid := plt_privado.fn_usuario_atual();
begin
  if v_quem is null or not plt_privado.fn_eh_super_admin() then
    raise exception 'Ligar a API nova do Tiny é gesto do dono.' using errcode = 'insufficient_privilege';
  end if;
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
  values (v_quem, 'tiny_fabrica_autorizacao', jsonb_build_object('etapa', 'iniciada'));
  return jsonb_build_object('ok', true);
end;
$$;

-- ----------------------------------------------------------------------------
-- O renovador da fábrica grava (na autorização e a cada renovação) — e, na
-- primeira vez, agenda o PRÓPRIO relógio (o fato — a autorização — liga o
-- renovador; nada fica agendado à toa antes dela)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_tiny_fabrica_token_gravar(
  p_access text, p_refresh text, p_origem text, p_renovador_url text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_relogio text := 'sem_pg_cron';
begin
  if nullif(p_access, '') is null or nullif(p_refresh, '') is null then
    raise exception 'token vazio' using errcode = 'invalid_parameter_value';
  end if;

  insert into public.tiny_auth (id, access_token, refresh_token, updated_at)
  values (2, p_access, p_refresh, now())
  on conflict (id) do update
     set access_token = excluded.access_token,
         refresh_token = excluded.refresh_token,
         updated_at = now();

  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'tiny-fabrica-token-cron') then
      v_relogio := 'ja_estava';
    elsif nullif(p_renovador_url, '') is not null then
      -- a cada 3 h, 30 min depois do da loja (os dois nunca ao mesmo tempo)
      perform cron.schedule('tiny-fabrica-token-cron', '30 */3 * * *',
        format($c$select net.http_post(url := %L, headers := '{"Content-Type": "application/json"}'::jsonb, body := '{"acao": "renovar"}'::jsonb, timeout_milliseconds := 30000)$c$,
               p_renovador_url));
      v_relogio := 'agendado';
    end if;
  end if;

  if p_origem = 'autorizacao' then
    insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (null, 'tiny_fabrica_autorizacao', jsonb_build_object('etapa', 'ligada', 'relogio', v_relogio));
  end if;
  return jsonb_build_object('ok', true, 'relogio', v_relogio);
end;
$$;

comment on function public.plt_fn_tiny_fabrica_token_gravar(text, text, text, text) is
  'SESSAO-33: o renovador da fábrica (função tiny-fabrica-token) grava a linha 2 da tiny_auth — na autorização do dono e a cada renovação. Na primeira vez agenda o relógio dele (tiny-fabrica-token-cron, 30 */3). Só a chave de serviço.';

-- a renovação reserva a vez: só um renovador por vez e no máximo uma vez a
-- cada 2 h (o relógio é de 3 h; chamada repetida não gira o token à toa)
create or replace function public.plt_fn_tiny_fabrica_renovacao_reservar()
returns text
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.tiny_auth a
     set updated_at = now()
   where a.id = 2
     and a.refresh_token is not null
     and a.updated_at < now() - interval '2 hours'
  returning a.refresh_token
$$;

comment on function public.plt_fn_tiny_fabrica_renovacao_reservar() is
  'SESSAO-33: o renovador da fábrica pega a vez (marca a hora agora) e recebe o refresh token — só se a última renovação tem mais de 2 h. Duas chamadas juntas: só uma recebe. Só a chave de serviço.';

-- a renovação falhou: avisa o dono (a cada 6 h no máximo) — o token de
-- renovação vale ~24 h; perdido, só o dono autorizando de novo
create or replace function public.plt_fn_tiny_fabrica_falha(p_erro text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_perdido boolean := coalesce(p_erro, '') ~* '(invalid_grant|expired|revoked|not active)';
begin
  return jsonb_build_object('avisado', plt_privado.fn_tiny_alertar(
    'tiny_fabrica_token',
    case when v_perdido then 'A API nova da fábrica precisa ser ligada de novo'
         else 'A renovação da API nova da fábrica falhou' end,
    case when v_perdido
         then 'O Tiny não aceitou mais o acesso da conta da fábrica. Em Configurações → API e integrações, toque em "Ligar a API nova da fábrica" e entre de novo com a conta da fábrica.'
         else 'A renovação do acesso da conta da fábrica não deu certo (' || left(coalesce(p_erro, 'sem descrição'), 200) || '). O relógio tenta de novo em 3 h; se repetir, ligue de novo em Configurações → API e integrações.' end,
    jsonb_build_object('origem', 'tiny_fabrica_token', 'erro', left(coalesce(p_erro, ''), 300)),
    interval '6 hours'));
end;
$$;

-- ----------------------------------------------------------------------------
-- Permissões
-- ----------------------------------------------------------------------------
revoke all on function public.plt_fn_tiny_token_ler(text) from public, anon, authenticated;
revoke all on function public.plt_fn_tiny_fabrica_token_gravar(text, text, text, text) from public, anon, authenticated;
revoke all on function public.plt_fn_tiny_fabrica_renovacao_reservar() from public, anon, authenticated;
revoke all on function public.plt_fn_tiny_fabrica_falha(text) from public, anon, authenticated;
revoke all on function public.plt_fn_tiny_fabrica_autorizar_preparar() from public, anon;
grant execute on function public.plt_fn_tiny_fabrica_autorizar_preparar() to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.plt_fn_tiny_token_ler(text) to service_role;
    grant execute on function public.plt_fn_tiny_fabrica_token_gravar(text, text, text, text) to service_role;
    grant execute on function public.plt_fn_tiny_fabrica_renovacao_reservar() to service_role;
    grant execute on function public.plt_fn_tiny_fabrica_falha(text) to service_role;
  end if;
end $$;
