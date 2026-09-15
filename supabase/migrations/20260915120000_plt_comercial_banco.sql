-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 26 — BANCO DO MÓDULO COMERCIAL
-- Sessão: SESSAO-19 (União 1) · Data: 2026-09-15
--
-- Traz o domínio do Painel de Recompra para o banco da fábrica (D-46):
--   · 6 tabelas em DDL idêntico ao banco vivo do recompra (dump de 15/09/2026)
--   · view de compatibilidade `vendas_marketing` sobre pedidos+clientes (D-47:
--     nenhuma tabela nova quando uma existente serve — os pedidos JÁ estão aqui)
--   · views `vw_clientes_consolidados` e `vw_scorecards_lista` copiadas
--   · as 10 RPCs do recompra copiadas com corpo intocado (+ search_path fixado
--     e execute revogado de anon — E-11; os números retornados não mudam)
--   · coluna `plt_usuarios.modulos` com seed (fábrica p/ todos; comercial só
--     no admin — D-46) e helper `plt_privado.fn_tem_modulo`
--   · RLS no padrão da casa nas 6 tabelas — nada de USING (true)
--
-- NENHUMA tabela existente da integração é alterada. A única mudança fora do
-- domínio novo é a coluna `modulos` em plt_usuarios.
-- Idempotente: pode rodar duas vezes seguidas sem erro (o seed roda UMA vez,
-- junto com a criação da coluna).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · Enums do domínio de disparo — exatamente os valores do banco vivo.
-- Guardados por IF NOT EXISTS (E-19): se uma migration futura acrescentar
-- valor, esta aqui não pode "resetar" o tipo ao ser reaplicada.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                  where t.typname = 'status_lista_disparo' and n.nspname = 'public') then
    create type public.status_lista_disparo as enum
      ('rascunho','sincronizada','disparando','em_andamento','encerrada');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                  where t.typname = 'status_membro_disparo' and n.nspname = 'public') then
    create type public.status_membro_disparo as enum
      ('aguardando_envio','aguardando_resposta','respondido_aguardando_resultado','ganho','perdido');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                  where t.typname = 'motivo_perda_membro' and n.nspname = 'public') then
    create type public.motivo_perda_membro as enum
      ('sem_resposta_no_prazo','negocio_perdido_crm','prazo_resultado_expirado','erro_envio_mensagem','lista_encerrada_manualmente');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                  where t.typname = 'tipo_evento_disparo' and n.nspname = 'public') then
    create type public.tipo_evento_disparo as enum
      ('lista_criada','leads_sincronizados','mensagem_definida','envio_registrado','resposta_recebida',
       'negocio_ganho','negocio_perdido','timer_resposta_expirado','timer_resultado_expirado',
       'lista_encerrada','erro_envio_mensagem','lista_renomeada','membros_adicionados','membro_removido','membros_removidos');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                  where t.typname = 'categoria_mensagem_whatsapp' and n.nspname = 'public') then
    create type public.categoria_mensagem_whatsapp as enum ('marketing','utilidade');
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2 · As 6 tabelas — DDL idêntico ao banco vivo do recompra.
-- Inclusive os dois índices redundantes de membros (idx_membros_lista e
-- idx_membros_lista_id): o banco novo espelha o antigo byte a byte; enxugar
-- é decisão para depois da união, não desta migration.
-- ----------------------------------------------------------------------------
create table if not exists public.listas_disparo (
  id                          uuid primary key default gen_random_uuid(),
  nome                        text not null,
  descricao                   text,
  filtros_aplicados           jsonb,
  mensagem_utilizada          text,
  id_lista_crm                text,
  tag_crm                     text,
  status                      public.status_lista_disparo not null default 'rascunho',
  custo_disparo               numeric(12,2) not null default 0,
  janela_resposta_dias        integer not null default 3,
  janela_resultado_dias       integer not null default 7,
  criado_por                  text,
  criado_em                   timestamptz not null default now(),
  sincronizado_em             timestamptz,
  encerrado_em                timestamptz,
  intervalo_disparo_segundos  integer not null default 60,
  ultimo_envio_em             timestamptz,
  categoria_mensagem          public.categoria_mensagem_whatsapp,
  tarifa_aplicada             numeric(10,4)
);

comment on table public.listas_disparo is
  'Campanhas de disparo/recompra vinculadas a uma lista no CRM DataCrazy (módulo Comercial — D-46).';

create table if not exists public.listas_disparo_membros (
  id                      uuid primary key default gen_random_uuid(),
  lista_id                uuid not null references public.listas_disparo(id) on delete cascade,
  cliente_id              uuid,
  telefone                text not null,
  nome_cliente            text,
  id_lead_crm             text,
  snapshot_total_gasto    numeric(12,2),
  snapshot_qtd_compras    integer,
  snapshot_ultima_compra  date,
  status                  public.status_membro_disparo not null default 'aguardando_envio',
  motivo_perda            public.motivo_perda_membro,
  data_envio              timestamptz,
  prazo_resposta_limite   timestamptz,
  data_resposta           timestamptz,
  prazo_resultado_limite  timestamptz,
  data_resultado          timestamptz,
  valor_ganho             numeric(12,2),
  id_negocio_crm          text,
  criado_em               timestamptz not null default now(),
  atualizado_em           timestamptz not null default now(),
  unique (lista_id, telefone)
);

comment on table public.listas_disparo_membros is
  'Contatos de uma lista de disparo, com snapshot e timers de resposta/resultado calculados pela aplicação.';

create index if not exists idx_membros_telefone on public.listas_disparo_membros (telefone);
create index if not exists idx_membros_lista    on public.listas_disparo_membros (lista_id);
create index if not exists idx_membros_lista_id on public.listas_disparo_membros (lista_id);
create index if not exists idx_membros_status   on public.listas_disparo_membros (status);
create index if not exists idx_membros_prazo_resposta on public.listas_disparo_membros (prazo_resposta_limite)
  where status = 'aguardando_resposta';
create index if not exists idx_membros_prazo_resultado on public.listas_disparo_membros (prazo_resultado_limite)
  where status = 'respondido_aguardando_resultado';

create table if not exists public.listas_disparo_eventos (
  id         uuid primary key default gen_random_uuid(),
  lista_id   uuid not null references public.listas_disparo(id) on delete cascade,
  membro_id  uuid references public.listas_disparo_membros(id) on delete set null,
  tipo_evento public.tipo_evento_disparo not null,
  descricao  text,
  payload    jsonb,
  criado_em  timestamptz not null default now()
);

comment on table public.listas_disparo_eventos is
  'Auditoria/log de cada ação relevante da campanha.';

create index if not exists idx_eventos_lista on public.listas_disparo_eventos (lista_id, criado_em desc);

create table if not exists public.webhook_eventos_crm (
  id                    uuid primary key default gen_random_uuid(),
  tipo                  text not null,
  payload_bruto         jsonb not null,
  telefone_identificado text,
  id_negocio_crm        text,
  processado            boolean not null default false,
  erro_processamento    text,
  recebido_em           timestamptz not null default now(),
  processado_em         timestamptz
);

comment on table public.webhook_eventos_crm is
  'Log bruto e imutável de todo payload recebido das automações do DataCrazy, antes do processamento.';

create index if not exists idx_webhook_processado on public.webhook_eventos_crm (processado, recebido_em);

create table if not exists public.tarifas_mensagem_whatsapp (
  id             uuid primary key default gen_random_uuid(),
  categoria      public.categoria_mensagem_whatsapp not null,
  valor_unitario numeric(10,4) not null,
  vigente_desde  timestamptz not null default now(),
  criado_por     text
);

comment on table public.tarifas_mensagem_whatsapp is
  'A tarifa vigente é sempre a linha mais recente de cada categoria.';

create index if not exists idx_tarifas_categoria_data on public.tarifas_mensagem_whatsapp (categoria, vigente_desde desc);

create table if not exists public.tiny_auth (
  id            integer primary key default 1,
  access_token  text not null,
  refresh_token text not null,
  updated_at    timestamptz not null default timezone('utc'::text, now()),
  constraint single_row check (id = 1)
);

comment on table public.tiny_auth is
  'Cofre do token OAuth do Tiny (módulo Comercial). Linha única. SÓ a service_role acessa — RLS ligado sem nenhuma policy, de propósito (regra crítica 4: credencial não aparece para navegador nenhum, nem de admin). O renovador roda em EXATAMENTE UM projeto por vez (risco 1 do plano da união).';

-- ----------------------------------------------------------------------------
-- 3 · plt_usuarios.modulos — permissão de módulo por usuário (D-46).
-- Seed roda UMA vez, junto com a criação da coluna: todos ganham `fabrica`;
-- `comercial` começa só em quem já é admin e vai sendo liberado com o tempo.
-- Reaplicar a migration NÃO re-semeia (um usuário deliberadamente sem módulos
-- não pode voltar a ter `fabrica` sozinho).
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'plt_usuarios' and column_name = 'modulos'
  ) then
    alter table public.plt_usuarios
      add column modulos text[] not null default '{}';
    update public.plt_usuarios
       set modulos = case when papel = 'admin'
                          then array['fabrica','comercial']
                          else array['fabrica'] end;
  end if;
end;
$$;

comment on column public.plt_usuarios.modulos is
  'Módulos liberados para a pessoa (D-46): fabrica, comercial. Vazio = nenhum módulo. Usuário novo nasce sem módulos — quem cria concede.';

-- ----------------------------------------------------------------------------
-- 4 · plt_privado.fn_tem_modulo — o gate de módulo.
--
-- Vale para RLS das tabelas do Comercial E para o WHERE da view
-- vendas_marketing. `auth.uid()` nulo significa contexto de máquina
-- (service_role das Edge Functions, conexão direta do harness/aplicador):
-- passa. O `anon` NUNCA chega até aqui — não tem grant nas tabelas/views nem
-- policy nenhuma; o gate existe para separar pessoa COM módulo de pessoa SEM.
-- Admin sempre passa (D-46).
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tem_modulo(p_modulo text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is null
    or exists (
      select 1
        from public.plt_usuarios u
       where u.auth_user_id = auth.uid()
         and u.ativo
         and (u.papel = 'admin' or p_modulo = any(u.modulos))
    );
$$;

comment on function plt_privado.fn_tem_modulo(text) is
  'A pessoa logada tem o módulo? (admin sempre tem — D-46). auth.uid() nulo = contexto de máquina, passa.';

revoke all on function plt_privado.fn_tem_modulo(text) from public, anon;
grant execute on function plt_privado.fn_tem_modulo(text) to authenticated;

-- ----------------------------------------------------------------------------
-- 5 · RLS das 6 tabelas — módulo `comercial` (ou admin). Nada de USING (true).
--
-- O front do módulo Comercial (SESSAO-20) lê e escreve nessas tabelas com o
-- usuário autenticado — o mesmo comportamento do painel antigo, agora gateado.
-- As Edge Functions seguem pela service_role (ignora RLS por natureza).
-- `anon` não tem policy nenhuma → não lê nem escreve nada.
-- ----------------------------------------------------------------------------
alter table public.listas_disparo            enable row level security;
alter table public.listas_disparo_membros    enable row level security;
alter table public.listas_disparo_eventos    enable row level security;
alter table public.webhook_eventos_crm       enable row level security;
alter table public.tarifas_mensagem_whatsapp enable row level security;
alter table public.tiny_auth                 enable row level security;

-- Cinto e suspensório: além de não ter policy, o anon perde o grant.
revoke all on public.listas_disparo            from anon;
revoke all on public.listas_disparo_membros    from anon;
revoke all on public.listas_disparo_eventos    from anon;
revoke all on public.webhook_eventos_crm       from anon;
revoke all on public.tarifas_mensagem_whatsapp from anon;
revoke all on public.tiny_auth                 from anon, authenticated;

drop policy if exists listas_disparo_comercial on public.listas_disparo;
create policy listas_disparo_comercial on public.listas_disparo
  for all to authenticated
  using (plt_privado.fn_tem_modulo('comercial'))
  with check (plt_privado.fn_tem_modulo('comercial'));

drop policy if exists listas_disparo_membros_comercial on public.listas_disparo_membros;
create policy listas_disparo_membros_comercial on public.listas_disparo_membros
  for all to authenticated
  using (plt_privado.fn_tem_modulo('comercial'))
  with check (plt_privado.fn_tem_modulo('comercial'));

drop policy if exists listas_disparo_eventos_comercial on public.listas_disparo_eventos;
create policy listas_disparo_eventos_comercial on public.listas_disparo_eventos
  for all to authenticated
  using (plt_privado.fn_tem_modulo('comercial'))
  with check (plt_privado.fn_tem_modulo('comercial'));

-- O log do CRM só é ESCRITO pela Edge Function (service_role). Pessoa lê.
drop policy if exists webhook_eventos_crm_comercial_leitura on public.webhook_eventos_crm;
create policy webhook_eventos_crm_comercial_leitura on public.webhook_eventos_crm
  for select to authenticated
  using (plt_privado.fn_tem_modulo('comercial'));

drop policy if exists tarifas_comercial on public.tarifas_mensagem_whatsapp;
create policy tarifas_comercial on public.tarifas_mensagem_whatsapp
  for all to authenticated
  using (plt_privado.fn_tem_modulo('comercial'))
  with check (plt_privado.fn_tem_modulo('comercial'));

-- tiny_auth: NENHUMA policy, de propósito. Token OAuth é segredo de máquina
-- (regra crítica 4) — nem admin lê pelo navegador. Só a service_role acessa.

-- ----------------------------------------------------------------------------
-- 6 · A view de compatibilidade `vendas_marketing` (D-47).
--
-- Reproduz coluna a coluna a tabela-fato do recompra, lendo pedidos+clientes.
-- Verificado no dado vivo em 15/09/2026 (5.302 = 5.302 pedidos):
--   · valor_pedido  = pedidos.total_pedido (líquido) — 18/19 meses ao centavo,
--     o 19º é o delta de sync do dia;
--   · data_compra   = meia-noite America/Sao_Paulo do data_pedido (5.302/5.302);
--   · numero_itens  = nº de LINHAS do array de itens (5.302/5.302);
--   · itens_comprados sai de pedidos.raw->'itens' (preserva espaços nas bordas
--     dos nomes — pedido_itens os perde) no shape que a cascata das RPCs lê
--     por $.produto.descricao;
--   · nome_cliente  = snapshot raw->'cliente'->>'nome' SEM trim (5.294/5.302
--     idênticos ao recompra; clientes.nome divergiria em 1.729 por trim);
--   · telefone_cliente = clientes.fone com fallback para o celular do contato
--     (clientes.raw->>'celular') — mesmos 50 nulos do recompra.
-- Deriva histórica conhecida e documentada: 10 pedidos (0,19%) com nome ou
-- telefone diferente entre os dois pipelines (cliente editado no Tiny em
-- momentos diferentes) — irreprodutível por view, listada na memória de
-- execução da SESSAO-19.
--
-- Tipos em varchar de propósito: fn_vendas_disparo_por_telefone declara
-- RETURNS TABLE(... character varying ...) e o RETURN QUERY quebraria com text.
--
-- A view executa como a DONA (sem security_invoker): é o único jeito de ler
-- `pedidos`/`clientes` (RLS ligado sem policy — o navegador nunca as lê
-- direto). O acesso de pessoa é gateado no próprio WHERE por fn_tem_modulo.
-- Views mudam de forma com drop+create, nunca com replace (E-17).
-- ----------------------------------------------------------------------------
drop view if exists public.vw_clientes_consolidados;
drop view if exists public.vw_scorecards_lista;
drop view if exists public.vendas_marketing;

create view public.vendas_marketing as
select
  md5('vendas_marketing:' || p.numero)::uuid                     as id,
  p.numero::varchar                                              as numero_pedido,
  (p.raw->'cliente'->>'nome')::varchar                           as nome_cliente,
  coalesce(nullif(trim(c.fone), ''),
           nullif(trim(c.raw->>'celular'), ''))::varchar         as telefone_cliente,
  (p.data_pedido::timestamp) at time zone 'America/Sao_Paulo'    as data_compra,
  p.total_pedido::numeric(10,2)                                  as valor_pedido,
  coalesce(jsonb_array_length(p.raw->'itens'), 0)::integer       as numero_itens,
  coalesce(
    (select jsonb_agg(jsonb_build_object(
              'produto',       jsonb_build_object('descricao', e->'item'->>'descricao'),
              'quantidade',    (e->'item'->>'quantidade')::numeric,
              'valorUnitario', (e->'item'->>'valor_unitario')::numeric))
       from jsonb_array_elements(p.raw->'itens') e),
    '[]'::jsonb)                                                 as itens_comprados,
  p.criado_em                                                    as created_at
from public.pedidos p
left join public.clientes c on c.id = p.cliente_id
where plt_privado.fn_tem_modulo('comercial');

comment on view public.vendas_marketing is
  'View de compatibilidade do módulo Comercial (D-47): o shape da tabela-fato do recompra sobre pedidos+clientes. id é uuid determinístico do número do pedido. Gate de módulo no WHERE.';

revoke all on public.vendas_marketing from public, anon;
grant select on public.vendas_marketing to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 7 · Views do recompra, copiadas do banco vivo.
-- security_invoker ligado (padrão da casa): vw_clientes_consolidados herda o
-- gate da vendas_marketing; vw_scorecards_lista cai no RLS das tabelas.
-- ----------------------------------------------------------------------------
create view public.vw_clientes_consolidados
with (security_invoker = on) as
select
  coalesce(nullif(trim(both from telefone_cliente), ''::text), nome_cliente::text) as id_cliente,
  max(nome_cliente::text)     as nome_cliente,
  max(telefone_cliente::text) as telefone_cliente,
  count(id)                   as total_pedidos,
  sum(valor_pedido)           as faturamento_total,
  sum(numero_itens)           as total_itens,
  min(data_compra)            as primeira_compra,
  max(data_compra)            as ultima_compra
from public.vendas_marketing
group by coalesce(nullif(trim(both from telefone_cliente), ''::text), nome_cliente::text);

revoke all on public.vw_clientes_consolidados from public, anon;
grant select on public.vw_clientes_consolidados to authenticated, service_role;

create view public.vw_scorecards_lista
with (security_invoker = on) as
select
  l.id as lista_id,
  l.nome,
  l.status,
  l.custo_disparo,
  count(m.id) as total_membros,
  count(m.id) filter (where m.data_envio is not null and (m.motivo_perda is null or m.motivo_perda <> 'erro_envio_mensagem'::motivo_perda_membro)) as total_enviados,
  count(m.id) filter (where m.data_resposta is not null) as total_respondidos,
  count(m.id) filter (where m.status = 'ganho'::status_membro_disparo) as total_ganhos,
  count(m.id) filter (where m.status = 'perdido'::status_membro_disparo) as total_perdidos,
  count(m.id) filter (where m.status = 'perdido'::status_membro_disparo and m.motivo_perda = 'sem_resposta_no_prazo'::motivo_perda_membro) as total_sem_resposta,
  count(m.id) filter (where m.status = 'perdido'::status_membro_disparo and m.motivo_perda = 'prazo_resultado_expirado'::motivo_perda_membro) as total_expirados_sem_resultado,
  count(m.id) filter (where m.status = 'perdido'::status_membro_disparo and m.motivo_perda = 'negocio_perdido_crm'::motivo_perda_membro) as total_negocio_perdido_crm,
  coalesce(sum(m.valor_ganho) filter (where m.status = 'ganho'::status_membro_disparo), 0::numeric) as receita_gerada,
  round(100.0 * count(m.id) filter (where m.data_resposta is not null)::numeric / nullif(count(m.id) filter (where m.data_envio is not null and (m.motivo_perda is null or m.motivo_perda <> 'erro_envio_mensagem'::motivo_perda_membro)), 0)::numeric, 1) as taxa_resposta_pct,
  round(100.0 * count(m.id) filter (where m.status = 'ganho'::status_membro_disparo)::numeric / nullif(count(m.id) filter (where m.data_envio is not null and (m.motivo_perda is null or m.motivo_perda <> 'erro_envio_mensagem'::motivo_perda_membro)), 0)::numeric, 1) as taxa_conversao_pct,
  case
    when count(m.id) filter (where m.status = 'ganho'::status_membro_disparo) > 0 then round(coalesce(sum(m.valor_ganho) filter (where m.status = 'ganho'::status_membro_disparo), 0::numeric) / count(m.id) filter (where m.status = 'ganho'::status_membro_disparo)::numeric, 2)
    else 0::numeric
  end as ticket_medio,
  case
    when coalesce(l.tarifa_aplicada * count(m.id) filter (where m.data_envio is not null and (m.motivo_perda is null or m.motivo_perda <> 'erro_envio_mensagem'::motivo_perda_membro))::numeric, l.custo_disparo, 0::numeric) > 0::numeric then round((coalesce(sum(m.valor_ganho) filter (where m.status = 'ganho'::status_membro_disparo), 0::numeric) - coalesce(l.tarifa_aplicada * count(m.id) filter (where m.data_envio is not null and (m.motivo_perda is null or m.motivo_perda <> 'erro_envio_mensagem'::motivo_perda_membro))::numeric, l.custo_disparo)) / coalesce(l.tarifa_aplicada * count(m.id) filter (where m.data_envio is not null and (m.motivo_perda is null or m.motivo_perda <> 'erro_envio_mensagem'::motivo_perda_membro))::numeric, l.custo_disparo) * 100::numeric, 1)
    else null::numeric
  end as roi_pct,
  count(m.id) filter (where m.motivo_perda = 'erro_envio_mensagem'::motivo_perda_membro) as total_erros_envio,
  l.tarifa_aplicada,
  coalesce(l.tarifa_aplicada * count(m.id) filter (where m.data_envio is not null and (m.motivo_perda is null or m.motivo_perda <> 'erro_envio_mensagem'::motivo_perda_membro))::numeric, l.custo_disparo, 0::numeric) as custo_total_real
from public.listas_disparo l
left join public.listas_disparo_membros m on m.lista_id = l.id
group by l.id;

revoke all on public.vw_scorecards_lista from public, anon;
grant select on public.vw_scorecards_lista to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 8 · As 10 RPCs do recompra — corpo copiado do banco vivo SEM alteração.
-- Únicos acréscimos (E-11, não mudam nenhum número): SET search_path fixado e,
-- na seção 9, execute revogado de anon/public. Continuam SECURITY INVOKER como
-- na origem: quem chama é o authenticated, que enxerga a view gateada.
-- São endpoints REST de propósito (o front do módulo Comercial as chama).
-- ----------------------------------------------------------------------------

create or replace function public.fn_dashboard_revenue_chart(p_start timestamp with time zone default null::timestamp with time zone, p_end timestamp with time zone default null::timestamp with time zone)
 returns table(month_str text, revenue numeric, orders integer)
 language plpgsql
 set search_path to public, pg_temp
as $function$
BEGIN
    RETURN QUERY
    SELECT
        TO_CHAR(data_compra, 'YYYY-MM') as month_str,
        SUM(valor_pedido) as revenue,
        COUNT(id)::integer as orders
    FROM vendas_marketing
    WHERE (p_start IS NULL OR data_compra >= p_start)
      AND (p_end IS NULL OR data_compra <= p_end)
    GROUP BY TO_CHAR(data_compra, 'YYYY-MM')
    ORDER BY month_str ASC;
END;
$function$;

create or replace function public.fn_dashboard_purchase_frequency(p_start timestamp with time zone default null::timestamp with time zone, p_end timestamp with time zone default null::timestamp with time zone)
 returns table(pedidos_count integer, faturamento_total numeric, clientes_count integer)
 language plpgsql
 set search_path to public, pg_temp
as $function$
BEGIN
    RETURN QUERY
    WITH client_period_stats AS (
        SELECT
            COALESCE(NULLIF(TRIM(telefone_cliente), ''), nome_cliente) as client_id,
            COUNT(id) as qtd_pedidos,
            SUM(valor_pedido) as faturamento
        FROM vendas_marketing
        WHERE (p_start IS NULL OR data_compra >= p_start)
          AND (p_end IS NULL OR data_compra <= p_end)
        GROUP BY COALESCE(NULLIF(TRIM(telefone_cliente), ''), nome_cliente)
    )
    SELECT
        qtd_pedidos::integer as pedidos_count,
        SUM(faturamento) as faturamento_total,
        COUNT(client_id)::integer as clientes_count
    FROM client_period_stats
    GROUP BY qtd_pedidos
    ORDER BY qtd_pedidos ASC
    LIMIT 15;
END;
$function$;

create or replace function public.fn_dashboard_transitions(p_start timestamp with time zone default null::timestamp with time zone, p_end timestamp with time zone default null::timestamp with time zone)
 returns table(client_id text, purchase_number integer, days_since_last integer)
 language plpgsql
 set search_path to public, pg_temp
as $function$
BEGIN
    RETURN QUERY
    WITH ordered_purchases AS (
        SELECT
            COALESCE(NULLIF(TRIM(telefone_cliente), ''), nome_cliente) as cid,
            data_compra,
            ROW_NUMBER() OVER (PARTITION BY COALESCE(NULLIF(TRIM(telefone_cliente), ''), nome_cliente) ORDER BY data_compra ASC) as rn,
            LAG(data_compra) OVER (PARTITION BY COALESCE(NULLIF(TRIM(telefone_cliente), ''), nome_cliente) ORDER BY data_compra ASC) as prev_data
        FROM vendas_marketing
    )
    SELECT
        cid as client_id,
        rn::integer as purchase_number,
        EXTRACT(DAY FROM (data_compra - prev_data))::integer as days_since_last
    FROM ordered_purchases
    WHERE rn > 1
      AND (p_start IS NULL OR data_compra >= p_start)
      AND (p_end IS NULL OR data_compra <= p_end);
END;
$function$;

create or replace function public.fn_dashboard_transitions_summary(p_start timestamp with time zone default null::timestamp with time zone, p_end timestamp with time zone default null::timestamp with time zone)
 returns table(purchase_number integer, avg_days numeric, client_count integer)
 language plpgsql
 set search_path to public, pg_temp
as $function$
BEGIN
    RETURN QUERY
    WITH ordered_purchases AS (
        SELECT
            COALESCE(NULLIF(TRIM(telefone_cliente), ''), nome_cliente) as cid,
            data_compra,
            ROW_NUMBER() OVER (PARTITION BY COALESCE(NULLIF(TRIM(telefone_cliente), ''), nome_cliente) ORDER BY data_compra ASC) as rn,
            LAG(data_compra) OVER (PARTITION BY COALESCE(NULLIF(TRIM(telefone_cliente), ''), nome_cliente) ORDER BY data_compra ASC) as prev_data
        FROM vendas_marketing
    )
    SELECT
        rn::integer as purchase_number,
        AVG(EXTRACT(DAY FROM (data_compra - prev_data)))::numeric as avg_days,
        COUNT(DISTINCT cid)::integer as client_count
    FROM ordered_purchases
    WHERE rn > 1
      AND (p_start IS NULL OR data_compra >= p_start)
      AND (p_end IS NULL OR data_compra <= p_end)
    GROUP BY rn
    ORDER BY rn ASC;
END;
$function$;

create or replace function public.fn_dashboard_transition_clients(p_purchase_number integer, p_start timestamp with time zone default null::timestamp with time zone, p_end timestamp with time zone default null::timestamp with time zone, p_limit integer default 20, p_offset integer default 0)
 returns table(client_id text, days_since_last integer, prev_date timestamp with time zone, curr_date timestamp with time zone)
 language plpgsql
 set search_path to public, pg_temp
as $function$
BEGIN
    RETURN QUERY
    WITH ordered_purchases AS (
        SELECT
            COALESCE(NULLIF(TRIM(nome_cliente), ''), telefone_cliente) as cid,
            data_compra,
            ROW_NUMBER() OVER (PARTITION BY COALESCE(NULLIF(TRIM(telefone_cliente), ''), nome_cliente) ORDER BY data_compra ASC) as rn,
            LAG(data_compra) OVER (PARTITION BY COALESCE(NULLIF(TRIM(telefone_cliente), ''), nome_cliente) ORDER BY data_compra ASC) as prev_data
        FROM vendas_marketing
    )
    SELECT
        cid as client_id,
        EXTRACT(DAY FROM (data_compra - prev_data))::integer as days_since_last,
        prev_data as prev_date,
        data_compra as curr_date
    FROM ordered_purchases
    WHERE rn = p_purchase_number
      AND (p_start IS NULL OR data_compra >= p_start)
      AND (p_end IS NULL OR data_compra <= p_end)
    ORDER BY days_since_last ASC
    LIMIT p_limit OFFSET p_offset;
END;
$function$;

create or replace function public.fn_dashboard_items(p_start timestamp with time zone default null::timestamp with time zone, p_end timestamp with time zone default null::timestamp with time zone)
 returns table(month_str text, item_name text, quantidade integer)
 language plpgsql
 set search_path to public, pg_temp
as $function$
BEGIN
    RETURN QUERY
    WITH exploded_items AS (
        SELECT
            TO_CHAR(v.data_compra, 'YYYY-MM') as m_str,
            COALESCE(
               NULLIF(jsonb_path_query_first(item, '$.item.produto.descricao')::text, 'null'),
               NULLIF(jsonb_path_query_first(item, '$.item.produto.nome')::text, 'null'),
               NULLIF(jsonb_path_query_first(item, '$.produto.descricao')::text, 'null'),
               NULLIF(jsonb_path_query_first(item, '$.produto.nome')::text, 'null'),
               NULLIF(jsonb_path_query_first(item, '$.item.descricao')::text, 'null'),
               NULLIF(jsonb_path_query_first(item, '$.item.nome')::text, 'null'),
               NULLIF(jsonb_path_query_first(item, '$.descricao')::text, 'null'),
               NULLIF(jsonb_path_query_first(item, '$.nome')::text, 'null'),
               NULLIF(jsonb_path_query_first(item, '$.name')::text, 'null'),
               CASE WHEN jsonb_typeof(item) = 'string' THEN item::text ELSE NULL END
            ) as i_name
        FROM vendas_marketing v,
        jsonb_array_elements(
            CASE
                WHEN jsonb_typeof(v.itens_comprados) = 'array' THEN v.itens_comprados
                WHEN jsonb_typeof(v.itens_comprados) = 'string' AND (v.itens_comprados#>>'{}') LIKE '[%' THEN (v.itens_comprados#>>'{}')::jsonb
                ELSE '[]'::jsonb
            END
        ) as item
        WHERE (p_start IS NULL OR v.data_compra >= p_start)
          AND (p_end IS NULL OR v.data_compra <= p_end)
    )
    SELECT
        m_str as month_str,
        TRIM(BOTH '"' FROM i_name) as item_name,
        COUNT(*)::integer as quantidade
    FROM exploded_items
    WHERE i_name IS NOT NULL AND i_name != 'null'
    GROUP BY m_str, TRIM(BOTH '"' FROM i_name)
    ORDER BY m_str ASC, quantidade DESC;
END;
$function$;

create or replace function public.fn_dashboard_top_items_overall(p_start timestamp with time zone default null::timestamp with time zone, p_end timestamp with time zone default null::timestamp with time zone)
 returns table(item_name text, quantidade integer)
 language plpgsql
 set search_path to public, pg_temp
as $function$
BEGIN
    RETURN QUERY
    WITH exploded_items AS (
        SELECT
            COALESCE(
               NULLIF(jsonb_path_query_first(item, '$.item.produto.descricao')::text, 'null'),
               NULLIF(jsonb_path_query_first(item, '$.item.produto.nome')::text, 'null'),
               NULLIF(jsonb_path_query_first(item, '$.produto.descricao')::text, 'null'),
               NULLIF(jsonb_path_query_first(item, '$.produto.nome')::text, 'null'),
               NULLIF(jsonb_path_query_first(item, '$.item.descricao')::text, 'null'),
               NULLIF(jsonb_path_query_first(item, '$.item.nome')::text, 'null'),
               NULLIF(jsonb_path_query_first(item, '$.descricao')::text, 'null'),
               NULLIF(jsonb_path_query_first(item, '$.nome')::text, 'null'),
               NULLIF(jsonb_path_query_first(item, '$.name')::text, 'null'),
               CASE WHEN jsonb_typeof(item) = 'string' THEN item::text ELSE NULL END
            ) as i_name
        FROM vendas_marketing v,
        jsonb_array_elements(
            CASE
                WHEN jsonb_typeof(v.itens_comprados) = 'array' THEN v.itens_comprados
                WHEN jsonb_typeof(v.itens_comprados) = 'string' AND (v.itens_comprados#>>'{}') LIKE '[%' THEN (v.itens_comprados#>>'{}')::jsonb
                ELSE '[]'::jsonb
            END
        ) as item
        WHERE (p_start IS NULL OR v.data_compra >= p_start)
          AND (p_end IS NULL OR v.data_compra <= p_end)
    )
    SELECT
        TRIM(BOTH '"' FROM i_name) as item_name,
        COUNT(*)::integer as quantidade
    FROM exploded_items
    WHERE i_name IS NOT NULL AND i_name != 'null'
    GROUP BY TRIM(BOTH '"' FROM i_name)
    ORDER BY quantidade DESC;
END;
$function$;

create or replace function public.fn_vendas_disparo_por_telefone(p_telefone_normalizado text, p_inicio timestamp with time zone, p_fim timestamp with time zone)
 returns table(numero_pedido character varying, telefone_cliente character varying, data_compra timestamp with time zone, valor_pedido numeric)
 language sql
 stable
 set search_path to public, pg_temp
as $function$
  SELECT v.numero_pedido, v.telefone_cliente, v.data_compra, v.valor_pedido
  FROM public.vendas_marketing v
  WHERE v.data_compra >= p_inicio
    AND v.data_compra <= p_fim
    AND (
      CASE
        WHEN length(regexp_replace(COALESCE(v.telefone_cliente, ''), '\D', '', 'g')) > 11
             AND regexp_replace(COALESCE(v.telefone_cliente, ''), '\D', '', 'g') LIKE '55%'
        THEN substring(regexp_replace(COALESCE(v.telefone_cliente, ''), '\D', '', 'g') FROM 3)
        ELSE regexp_replace(COALESCE(v.telefone_cliente, ''), '\D', '', 'g')
      END
    ) = p_telefone_normalizado
  ORDER BY v.data_compra ASC;
$function$;

create or replace function public.fn_dashboard_scorecards(p_filters jsonb default '{}'::jsonb)
 returns table(total_revenue numeric, total_orders integer, total_clients integer, recurrents integer, recurrence_rate numeric, avg_ticket numeric)
 language plpgsql
 set search_path to public, pg_temp
as $function$
DECLARE
    v_search_query text;
    v_date_filter text;
    v_custom_start timestamp with time zone;
    v_custom_end timestamp with time zone;
    v_selected_items text[];
    v_purchase_count text[];
    v_inactive_before timestamp with time zone;
    v_recompra_min integer;
    v_recompra_max integer;
    v_spend_amount numeric;
    v_spend_type text;
    v_spend_mode text;
    v_total_revenue numeric;
    v_total_orders integer;
    v_total_clients integer;
    v_recurrents integer;
    v_recurrence_rate numeric;
    v_avg_ticket numeric;
BEGIN
    v_search_query := p_filters->>'searchQuery';
    v_date_filter := p_filters->>'dateFilter';
    IF p_filters->>'customDateStart' IS NOT NULL AND p_filters->>'customDateStart' <> '' THEN
        v_custom_start := (p_filters->>'customDateStart')::timestamp with time zone;
    END IF;
    IF p_filters->>'customDateEnd' IS NOT NULL AND p_filters->>'customDateEnd' <> '' THEN
        v_custom_end := (p_filters->>'customDateEnd')::timestamp with time zone;
    END IF;

    IF v_date_filter = 'specificYear' THEN
        v_custom_start := date_trunc('year', to_date(p_filters->>'specificYear', 'YYYY'));
        v_custom_end := v_custom_start + interval '1 year' - interval '1 microsecond';
    ELSIF v_date_filter = 'specificMonth' THEN
        v_custom_start := date_trunc('month', to_date(p_filters->>'specificMonth', 'YYYY-MM'));
        v_custom_end := v_custom_start + interval '1 month' - interval '1 microsecond';
    ELSIF v_date_filter = 'specificDay' THEN
        v_custom_start := date_trunc('day', to_date(p_filters->>'specificDay', 'YYYY-MM-DD'));
        v_custom_end := v_custom_start + interval '1 day' - interval '1 microsecond';
    END IF;

    IF p_filters ? 'selectedItems' AND jsonb_array_length(p_filters->'selectedItems') > 0 AND NOT (p_filters->'selectedItems') @> '["all"]' THEN
        SELECT array_agg(value) INTO v_selected_items FROM jsonb_array_elements_text(p_filters->'selectedItems');
    END IF;

    IF p_filters ? 'purchaseCount' AND jsonb_array_length(p_filters->'purchaseCount') > 0 AND NOT (p_filters->'purchaseCount') @> '["all"]' THEN
        SELECT array_agg(value) INTO v_purchase_count FROM jsonb_array_elements_text(p_filters->'purchaseCount');
    END IF;

    IF p_filters->>'inactiveBeforeDate' IS NOT NULL AND p_filters->>'inactiveBeforeDate' <> '' THEN
        v_inactive_before := (p_filters->>'inactiveBeforeDate')::timestamp with time zone;
    END IF;
    IF p_filters->>'recompraMinDays' IS NOT NULL AND p_filters->>'recompraMinDays' <> '' THEN
        v_recompra_min := (p_filters->>'recompraMinDays')::integer;
    END IF;
    IF p_filters->>'recompraMaxDays' IS NOT NULL AND p_filters->>'recompraMaxDays' <> '' THEN
        v_recompra_max := (p_filters->>'recompraMaxDays')::integer;
    END IF;
    IF p_filters->>'spendAmount' IS NOT NULL AND p_filters->>'spendAmount' <> '' THEN
        v_spend_amount := (p_filters->>'spendAmount')::numeric;
    END IF;
    v_spend_type := p_filters->>'spendType';
    v_spend_mode := p_filters->>'spendMode';

    WITH client_base AS (
        SELECT COALESCE(NULLIF(TRIM(v.telefone_cliente), ''), v.nome_cliente) as cid, v.data_compra, v.valor_pedido
        FROM vendas_marketing v
    ),
    lifetime_stats AS (
        SELECT
            cb.cid,
            COUNT(*) as p_vida,
            MIN(cb.data_compra) as p_compra,
            MAX(cb.data_compra) as u_compra,
            SUM(cb.valor_pedido) as faturamento_total_vida,
            (
                SELECT EXTRACT(DAY FROM (LEAD(v2.data_compra) OVER (ORDER BY v2.data_compra ASC) - v2.data_compra))
                FROM client_base v2
                WHERE v2.cid = cb.cid
                ORDER BY v2.data_compra ASC LIMIT 1
            ) as gap_days
        FROM client_base cb
        GROUP BY cb.cid
    ),
    period_records AS (
        SELECT v.*, COALESCE(NULLIF(TRIM(v.telefone_cliente), ''), v.nome_cliente) as cid
        FROM vendas_marketing v
        WHERE
            (
                (v_date_filter = 'all' OR v_date_filter IS NULL) OR
                (v_custom_start IS NULL AND v_custom_end IS NULL) OR
                (v_custom_start IS NOT NULL AND v_custom_end IS NULL AND v.data_compra >= v_custom_start) OR
                (v_custom_start IS NULL AND v_custom_end IS NOT NULL AND v.data_compra <= v_custom_end) OR
                (v_custom_start IS NOT NULL AND v_custom_end IS NOT NULL AND v.data_compra BETWEEN v_custom_start AND v_custom_end)
            )
            -- [DT-F13] mesmo fix da fn_filter_customers: ramo do telefone só
            -- participa quando o termo tem dígitos
            AND (v_search_query IS NULL OR v_search_query = '' OR
                 v.nome_cliente ILIKE '%' || v_search_query || '%' OR
                 (REGEXP_REPLACE(v_search_query, '\D', '', 'g') <> '' AND
                  REGEXP_REPLACE(v.telefone_cliente, '\D', '', 'g') ILIKE '%' || REGEXP_REPLACE(v_search_query, '\D', '', 'g') || '%')
            )
            AND (v_selected_items IS NULL OR EXISTS (
                SELECT 1 FROM jsonb_array_elements(
                    CASE
                        WHEN jsonb_typeof(v.itens_comprados) = 'array' THEN v.itens_comprados
                        WHEN jsonb_typeof(v.itens_comprados) = 'string' AND (v.itens_comprados#>>'{}') LIKE '[%' THEN (v.itens_comprados#>>'{}')::jsonb
                        ELSE '[]'::jsonb
                    END
                ) elem
                WHERE TRIM(BOTH '"' FROM COALESCE(
                   NULLIF(jsonb_path_query_first(elem, '$.item.produto.descricao')::text, 'null'),
                   NULLIF(jsonb_path_query_first(elem, '$.item.produto.nome')::text, 'null'),
                   NULLIF(jsonb_path_query_first(elem, '$.produto.descricao')::text, 'null'),
                   NULLIF(jsonb_path_query_first(elem, '$.produto.nome')::text, 'null'),
                   NULLIF(jsonb_path_query_first(elem, '$.item.descricao')::text, 'null'),
                   NULLIF(jsonb_path_query_first(elem, '$.item.nome')::text, 'null'),
                   NULLIF(jsonb_path_query_first(elem, '$.descricao')::text, 'null'),
                   NULLIF(jsonb_path_query_first(elem, '$.nome')::text, 'null'),
                   NULLIF(jsonb_path_query_first(elem, '$.name')::text, 'null'),
                   CASE WHEN jsonb_typeof(elem) = 'string' THEN elem::text ELSE NULL END
                )) = ANY(v_selected_items)
            ))
    ),
    filtered_clients AS (
        SELECT
            pr.cid,
            COUNT(*) as q_pedidos,
            SUM(pr.valor_pedido) as f_total,
            MAX(ls.p_vida) as p_vida
        FROM period_records pr
        JOIN lifetime_stats ls ON pr.cid = ls.cid
        WHERE
            (v_inactive_before IS NULL OR ls.u_compra <= v_inactive_before)
            AND (v_purchase_count IS NULL OR (
                CASE WHEN '10+' = ANY(v_purchase_count) AND ls.p_vida >= 10 THEN true
                     ELSE ls.p_vida::text = ANY(v_purchase_count)
                END
            ))
            AND (v_recompra_min IS NULL OR ls.gap_days >= v_recompra_min)
            AND (v_recompra_max IS NULL OR ls.gap_days <= v_recompra_max)
            AND (v_spend_amount IS NULL OR (
                CASE WHEN v_spend_type = 'total' THEN
                    CASE WHEN v_spend_mode = 'above' THEN ls.faturamento_total_vida >= v_spend_amount
                         WHEN v_spend_mode = 'below' THEN ls.faturamento_total_vida <= v_spend_amount
                         ELSE ls.faturamento_total_vida BETWEEN (v_spend_amount * 0.9) AND (v_spend_amount * 1.1)
                    END
                ELSE
                    CASE WHEN v_spend_mode = 'above' THEN (ls.faturamento_total_vida / NULLIF(ls.p_vida, 0)) >= v_spend_amount
                         WHEN v_spend_mode = 'below' THEN (ls.faturamento_total_vida / NULLIF(ls.p_vida, 0)) <= v_spend_amount
                         ELSE (ls.faturamento_total_vida / NULLIF(ls.p_vida, 0)) BETWEEN (v_spend_amount * 0.9) AND (v_spend_amount * 1.1)
                    END
                END
            ))
        GROUP BY pr.cid
    )
    SELECT
        COALESCE(SUM(f_total), 0),
        COALESCE(SUM(q_pedidos), 0)::integer,
        COUNT(*)::integer,
        COUNT(*) FILTER (WHERE p_vida >= 2)::integer
    INTO v_total_revenue, v_total_orders, v_total_clients, v_recurrents
    FROM filtered_clients;

    IF v_total_clients > 0 THEN
        v_recurrence_rate := (v_recurrents::numeric / v_total_clients::numeric) * 100.0;
    ELSE
        v_recurrence_rate := 0;
    END IF;

    IF v_total_orders > 0 THEN
        v_avg_ticket := v_total_revenue / v_total_orders::numeric;
    ELSE
        v_avg_ticket := 0;
    END IF;

    RETURN QUERY SELECT v_total_revenue, v_total_orders, v_total_clients, v_recurrents, v_recurrence_rate, v_avg_ticket;
END;
$function$;

create or replace function public.fn_filter_customers(p_filters jsonb, p_limit integer default 20, p_offset integer default 0)
 returns table(nome_cliente text, telefone_cliente text, quantidade_pedidos integer, faturamento_total numeric, total_itens integer, data_primeira_compra timestamp with time zone, ultima_compra timestamp with time zone, pedidos_vida integer, is_recorrente boolean, total_count bigint)
 language plpgsql
 set search_path to public, pg_temp
as $function$
DECLARE
    v_search_query text;
    v_date_filter text;
    v_custom_start timestamp with time zone;
    v_custom_end timestamp with time zone;
    v_selected_items text[];
    v_purchase_count text[];
    v_inactive_before timestamp with time zone;
    v_recompra_min integer;
    v_recompra_max integer;
    v_spend_amount numeric;
    v_spend_type text;
    v_spend_mode text;
BEGIN
    -- Extract filter variables
    v_search_query := p_filters->>'searchQuery';
    v_date_filter := p_filters->>'dateFilter';
    IF p_filters->>'customDateStart' IS NOT NULL AND p_filters->>'customDateStart' <> '' THEN
        v_custom_start := (p_filters->>'customDateStart')::timestamp with time zone;
    END IF;
    IF p_filters->>'customDateEnd' IS NOT NULL AND p_filters->>'customDateEnd' <> '' THEN
        v_custom_end := (p_filters->>'customDateEnd')::timestamp with time zone;
    END IF;

    -- Handle specific date modes
    IF v_date_filter = 'specificYear' THEN
        v_custom_start := date_trunc('year', to_date(p_filters->>'specificYear', 'YYYY'));
        v_custom_end := v_custom_start + interval '1 year' - interval '1 microsecond';
    ELSIF v_date_filter = 'specificMonth' THEN
        v_custom_start := date_trunc('month', to_date(p_filters->>'specificMonth', 'YYYY-MM'));
        v_custom_end := v_custom_start + interval '1 month' - interval '1 microsecond';
    ELSIF v_date_filter = 'specificDay' THEN
        v_custom_start := date_trunc('day', to_date(p_filters->>'specificDay', 'YYYY-MM-DD'));
        v_custom_end := v_custom_start + interval '1 day' - interval '1 microsecond';
    END IF;

    -- Extract arrays
    IF p_filters ? 'selectedItems' AND jsonb_array_length(p_filters->'selectedItems') > 0 AND NOT (p_filters->'selectedItems') @> '["all"]' THEN
        SELECT array_agg(value) INTO v_selected_items FROM jsonb_array_elements_text(p_filters->'selectedItems');
    END IF;

    IF p_filters ? 'purchaseCount' AND jsonb_array_length(p_filters->'purchaseCount') > 0 AND NOT (p_filters->'purchaseCount') @> '["all"]' THEN
        SELECT array_agg(value) INTO v_purchase_count FROM jsonb_array_elements_text(p_filters->'purchaseCount');
    END IF;

    IF p_filters->>'inactiveBeforeDate' IS NOT NULL AND p_filters->>'inactiveBeforeDate' <> '' THEN
        v_inactive_before := (p_filters->>'inactiveBeforeDate')::timestamp with time zone;
    END IF;
    IF p_filters->>'recompraMinDays' IS NOT NULL AND p_filters->>'recompraMinDays' <> '' THEN
        v_recompra_min := (p_filters->>'recompraMinDays')::integer;
    END IF;
    IF p_filters->>'recompraMaxDays' IS NOT NULL AND p_filters->>'recompraMaxDays' <> '' THEN
        v_recompra_max := (p_filters->>'recompraMaxDays')::integer;
    END IF;
    IF p_filters->>'spendAmount' IS NOT NULL AND p_filters->>'spendAmount' <> '' THEN
        v_spend_amount := (p_filters->>'spendAmount')::numeric;
    END IF;
    v_spend_type := p_filters->>'spendType';
    v_spend_mode := p_filters->>'spendMode';

    RETURN QUERY
    WITH client_base AS (
        SELECT COALESCE(NULLIF(TRIM(v.telefone_cliente), ''), v.nome_cliente) as cid, v.data_compra, v.valor_pedido
        FROM vendas_marketing v
    ),
    lifetime_stats AS (
        -- Calculate lifetime stats for all clients that might match the filters
        SELECT
            cb.cid,
            COUNT(*) as p_vida,
            MIN(cb.data_compra) as p_compra,
            MAX(cb.data_compra) as u_compra,
            SUM(cb.valor_pedido) as faturamento_total_vida,
            (
                -- [DT-BD2, corrigido] nth_value(...,2) usava o frame padrão de window
                -- function (RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW), que na
                -- linha mais antiga (a que o LIMIT 1 externo pega) só contém 1 linha —
                -- nunca havia uma "2a" visível, então dava NULL sempre. LEAD() ignora
                -- frame e sempre olha a próxima linha da partição ordenada.
                SELECT EXTRACT(DAY FROM (LEAD(v2.data_compra) OVER (ORDER BY v2.data_compra ASC) - v2.data_compra))
                FROM client_base v2
                WHERE v2.cid = cb.cid
                ORDER BY v2.data_compra ASC LIMIT 1
            ) as gap_days
        FROM client_base cb
        GROUP BY cb.cid
    ),
    period_records AS (
        SELECT v.*, COALESCE(NULLIF(TRIM(v.telefone_cliente), ''), v.nome_cliente) as cid
        FROM vendas_marketing v
        WHERE
            -- Date Filter (applies to period)
            (
                (v_date_filter = 'all' OR v_date_filter IS NULL) OR
                (v_custom_start IS NULL AND v_custom_end IS NULL) OR
                (v_custom_start IS NOT NULL AND v_custom_end IS NULL AND v.data_compra >= v_custom_start) OR
                (v_custom_start IS NULL AND v_custom_end IS NOT NULL AND v.data_compra <= v_custom_end) OR
                (v_custom_start IS NOT NULL AND v_custom_end IS NOT NULL AND v.data_compra BETWEEN v_custom_start AND v_custom_end)
            )
            -- Search Query
            -- [DT-F13] o ramo do telefone só entra quando o termo tem dígitos;
            -- senão REGEXP_REPLACE(termo) = '' e ILIKE '%%' casaria todo mundo
            AND (v_search_query IS NULL OR v_search_query = '' OR
                 v.nome_cliente ILIKE '%' || v_search_query || '%' OR
                 (REGEXP_REPLACE(v_search_query, '\D', '', 'g') <> '' AND
                  REGEXP_REPLACE(v.telefone_cliente, '\D', '', 'g') ILIKE '%' || REGEXP_REPLACE(v_search_query, '\D', '', 'g') || '%')
            )
            -- Selected Items
            AND (v_selected_items IS NULL OR EXISTS (
                SELECT 1 FROM jsonb_array_elements(
                    CASE
                        WHEN jsonb_typeof(v.itens_comprados) = 'array' THEN v.itens_comprados
                        WHEN jsonb_typeof(v.itens_comprados) = 'string' AND (v.itens_comprados#>>'{}') LIKE '[%' THEN (v.itens_comprados#>>'{}')::jsonb
                        ELSE '[]'::jsonb
                    END
                ) elem
                WHERE TRIM(BOTH '"' FROM COALESCE(
                   NULLIF(jsonb_path_query_first(elem, '$.item.produto.descricao')::text, 'null'),
                   NULLIF(jsonb_path_query_first(elem, '$.item.produto.nome')::text, 'null'),
                   NULLIF(jsonb_path_query_first(elem, '$.produto.descricao')::text, 'null'),
                   NULLIF(jsonb_path_query_first(elem, '$.produto.nome')::text, 'null'),
                   NULLIF(jsonb_path_query_first(elem, '$.item.descricao')::text, 'null'),
                   NULLIF(jsonb_path_query_first(elem, '$.item.nome')::text, 'null'),
                   NULLIF(jsonb_path_query_first(elem, '$.descricao')::text, 'null'),
                   NULLIF(jsonb_path_query_first(elem, '$.nome')::text, 'null'),
                   NULLIF(jsonb_path_query_first(elem, '$.name')::text, 'null'),
                   CASE WHEN jsonb_typeof(elem) = 'string' THEN elem::text ELSE NULL END
                )) = ANY(v_selected_items)
            ))
    ),
    filtered_clients AS (
        SELECT
            pr.cid,
            MAX(pr.nome_cliente) as max_nome,
            MAX(pr.telefone_cliente) as max_telefone,
            COUNT(*) as q_pedidos,
            SUM(pr.valor_pedido) as f_total,
            SUM(pr.numero_itens) as t_itens,
            MAX(pr.data_compra) as u_compra_periodo,
            MAX(ls.p_vida) as p_vida,
            MAX(ls.p_compra) as data_p_compra,
            -- [DT-F14] "recorrente" = 2+ compras NA VIDA, sempre (decisão #4),
            -- igual a fn_dashboard_scorecards. A definição antiga com período
            -- ("1ª compra anterior ao início do período") fazia KPI e badges
            -- da tabela discordarem na mesma tela.
            MAX(ls.p_vida) >= 2 as is_rec
        FROM period_records pr
        JOIN lifetime_stats ls ON pr.cid = ls.cid
        WHERE
            -- Inactive Before
            (v_inactive_before IS NULL OR ls.u_compra <= v_inactive_before)
            -- Purchase Count (Lifetime)
            AND (v_purchase_count IS NULL OR (
                CASE WHEN '10+' = ANY(v_purchase_count) AND ls.p_vida >= 10 THEN true
                     ELSE ls.p_vida::text = ANY(v_purchase_count)
                END
            ))
            -- Recompra Gap
            AND (v_recompra_min IS NULL OR ls.gap_days >= v_recompra_min)
            AND (v_recompra_max IS NULL OR ls.gap_days <= v_recompra_max)
            -- Spend Amount
            AND (v_spend_amount IS NULL OR (
                CASE WHEN v_spend_type = 'total' THEN
                    CASE WHEN v_spend_mode = 'above' THEN ls.faturamento_total_vida >= v_spend_amount
                         WHEN v_spend_mode = 'below' THEN ls.faturamento_total_vida <= v_spend_amount
                         ELSE ls.faturamento_total_vida BETWEEN (v_spend_amount * 0.9) AND (v_spend_amount * 1.1)
                    END
                ELSE
                    CASE WHEN v_spend_mode = 'above' THEN (ls.faturamento_total_vida / NULLIF(ls.p_vida, 0)) >= v_spend_amount
                         WHEN v_spend_mode = 'below' THEN (ls.faturamento_total_vida / NULLIF(ls.p_vida, 0)) <= v_spend_amount
                         ELSE (ls.faturamento_total_vida / NULLIF(ls.p_vida, 0)) BETWEEN (v_spend_amount * 0.9) AND (v_spend_amount * 1.1)
                    END
                END
            ))
        GROUP BY pr.cid
    )
    SELECT
        max_nome,
        max_telefone,
        q_pedidos::integer,
        f_total,
        t_itens::integer,
        data_p_compra,
        u_compra_periodo,
        p_vida::integer,
        is_rec,
        (SELECT COUNT(*) FROM filtered_clients) as total_count
    FROM filtered_clients
    ORDER BY u_compra_periodo DESC
    LIMIT p_limit OFFSET p_offset;
END;
$function$;

-- ----------------------------------------------------------------------------
-- 9 · Permissões das RPCs — endpoint para gente logada, nunca para anon (E-11).
-- A service_role recebe execute explícito: verificar-vendas-disparo chama
-- fn_vendas_disparo_por_telefone pela chave de serviço.
-- ----------------------------------------------------------------------------
revoke all on function public.fn_dashboard_revenue_chart(timestamptz, timestamptz)        from public, anon;
revoke all on function public.fn_dashboard_purchase_frequency(timestamptz, timestamptz)   from public, anon;
revoke all on function public.fn_dashboard_transitions(timestamptz, timestamptz)          from public, anon;
revoke all on function public.fn_dashboard_transitions_summary(timestamptz, timestamptz)  from public, anon;
revoke all on function public.fn_dashboard_transition_clients(integer, timestamptz, timestamptz, integer, integer) from public, anon;
revoke all on function public.fn_dashboard_items(timestamptz, timestamptz)                from public, anon;
revoke all on function public.fn_dashboard_top_items_overall(timestamptz, timestamptz)    from public, anon;
revoke all on function public.fn_dashboard_scorecards(jsonb)                              from public, anon;
revoke all on function public.fn_filter_customers(jsonb, integer, integer)                from public, anon;
revoke all on function public.fn_vendas_disparo_por_telefone(text, timestamptz, timestamptz) from public, anon;

grant execute on function public.fn_dashboard_revenue_chart(timestamptz, timestamptz)        to authenticated, service_role;
grant execute on function public.fn_dashboard_purchase_frequency(timestamptz, timestamptz)   to authenticated, service_role;
grant execute on function public.fn_dashboard_transitions(timestamptz, timestamptz)          to authenticated, service_role;
grant execute on function public.fn_dashboard_transitions_summary(timestamptz, timestamptz)  to authenticated, service_role;
grant execute on function public.fn_dashboard_transition_clients(integer, timestamptz, timestamptz, integer, integer) to authenticated, service_role;
grant execute on function public.fn_dashboard_items(timestamptz, timestamptz)                to authenticated, service_role;
grant execute on function public.fn_dashboard_top_items_overall(timestamptz, timestamptz)    to authenticated, service_role;
grant execute on function public.fn_dashboard_scorecards(jsonb)                              to authenticated, service_role;
grant execute on function public.fn_filter_customers(jsonb, integer, integer)                to authenticated, service_role;
grant execute on function public.fn_vendas_disparo_por_telefone(text, timestamptz, timestamptz) to authenticated, service_role;
