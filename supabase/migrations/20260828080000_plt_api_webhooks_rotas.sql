-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 19 — API, WEBHOOKS E ROTAS
-- Sessão: SESSAO-11 · Data: 2026-08-28 (bloco noturno D-26)
--
-- Três assuntos (demanda revisada pela D-33 — a ponte ClickUp morreu):
--
--   1. CHAVES DE API (Q-50 ✅): chave opaca gerada no admin — no banco vive só
--      o hash sha256 + um prefixo de identificação; escopos leitura/escrita;
--      revogar corta na hora. A Edge Function `api` é quem confere.
--   2. WEBHOOKS DE SAÍDA (RF-52): assinatura de tipos de evento com URL de
--      destino; trigger ENFILEIRA (append em plt_webhook_entregas) e o POST
--      sai por pg_net disparado por pg_cron — os dois guardados por
--      existência (o Postgres dos testes não os tem).
--   3. ROTAS DENTRO DA PLATAFORMA (D-33): a entrega é por PEDIDO COMPLETO
--      ("mesmo que tenha 30 unidades, não vamos entregar 10") — plt_fn_rotas
--      lista as entregas com endereço/contato (exceção deliberada de dado
--      pessoal, gate da logística) e plt_fn_registrar_entrega marca o gesto.
--      ⚠️ Marcar entregue AQUI não toca o Tiny — a automação ClickUp→Tiny em
--      produção não se toca (regra crítica 3); ligar os dois é decisão futura.
--
-- Mais o "excluir" da API (D-03): ARQUIVAMENTO LÓGICO — evento card_arquivado
-- → projeção arquivado_em → as leituras filtram. Nada some da história.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · Vocabulário novo de eventos
-- ----------------------------------------------------------------------------
do $$
declare
  v_nome text;
begin
  select conname into v_nome
    from pg_constraint
   where conrelid = 'public.plt_eventos'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%card_criado%';
  if v_nome is not null then
    execute format('alter table public.plt_eventos drop constraint %I', v_nome);
  end if;
  alter table public.plt_eventos add constraint plt_eventos_tipo_check
    check (tipo in (
      'card_criado',
      'movimentacao_setor',
      'movimentacao_etapa',
      'execucao_iniciada',
      'execucao_finalizada',
      'qualidade_marcada',
      'qualidade_parecer',
      'divergencia_registrada',
      'notificacao_enviada',
      'delegacao',
      'estorno',
      'pedido_atualizado',
      'pedido_cancelado',
      'card_arquivado',      -- SESSAO-11: o "excluir" da API/admin, sem apagar nada
      'pedido_entregue'      -- SESSAO-11: o gesto da logística no módulo de ROTAS
    )) not valid;
    -- NOT VALID: reaplicação idempotente num banco que já viveu migrations
    -- futuras — a migration mais nova do check é quem valida tudo.
end;
$$;

-- ----------------------------------------------------------------------------
-- 2 · Arquivamento lógico: coluna de projeção + validação + projeção
-- ----------------------------------------------------------------------------
alter table public.plt_cards
  add column if not exists arquivado_em timestamptz;

comment on column public.plt_cards.arquivado_em is
  'SESSAO-11: projeção do evento card_arquivado (o "excluir" da API/admin). Card arquivado some das telas; a história fica.';

create index if not exists plt_cards_arquivado_idx
  on public.plt_cards (setor_atual_id) where arquivado_em is null;

-- Quem pode arquivar/entregar: validação BEFORE (vale para todo escritor — M-14).
create or replace function plt_privado.fn_validar_api()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_papel text;
  v_logistica boolean;
begin
  if new.tipo = 'card_arquivado' then
    -- Arquivar é gesto de integração (API) ou de admin — nunca do operador.
    if new.origem <> 'api' then
      select u.papel into v_papel from public.plt_usuarios u
       where u.id = new.usuario_id and u.ativo;
      if coalesce(v_papel, '') <> 'admin' then
        raise exception 'Arquivar card é gesto de admin ou da integração.'
          using errcode = 'insufficient_privilege';
      end if;
    end if;

  elsif new.tipo = 'pedido_entregue' then
    -- Entregar é gesto HUMANO da logística (admin, entrada — o PCP é a
    -- logística — ou terminal).
    if new.usuario_id is null then
      raise exception 'Registrar entrega é gesto de pessoa — é preciso dizer quem entregou.'
        using errcode = 'check_violation';
    end if;
    select u.papel into v_papel from public.plt_usuarios u
     where u.id = new.usuario_id and u.ativo;
    select exists (
      select 1 from public.plt_usuario_setores us
        join public.plt_setores s on s.id = us.setor_id
       where us.usuario_id = new.usuario_id
         and s.papel_no_fluxo in ('entrada', 'terminal')
    ) into v_logistica;
    if coalesce(v_papel, '') <> 'admin' and not v_logistica then
      raise exception 'Registrar entrega é gesto da logística (PCP/terminais) ou de admin.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function plt_privado.fn_validar_api() from public, anon, authenticated;

drop trigger if exists plt_eventos_validar_api on public.plt_eventos;
create trigger plt_eventos_validar_api
  before insert on public.plt_eventos
  for each row execute function plt_privado.fn_validar_api();

-- A projeção ganha o arquivamento (recriada por inteiro — mesma da migration 14
-- + o elsif novo).
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
           -- Mudou de lugar: execução aberta encerra sozinha (D-24).
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

  elsif new.tipo = 'estorno' then
    update public.plt_cards
       set executor_atual_id = plt_privado.fn_executor_pelo_log(new.card_id)
     where id = new.card_id;

  elsif new.tipo in ('qualidade_marcada', 'qualidade_parecer') then
    update public.plt_cards
       set qualidade_atual = new.estado_qualidade
     where id = new.card_id;

  elsif new.tipo = 'card_arquivado' then
    -- SESSAO-11: o "excluir" lógico — a linha fica, as telas filtram.
    update public.plt_cards
       set arquivado_em = new.ocorrido_em,
           executor_atual_id = null
     where id = new.card_id;
  end if;

  return null;
end;
$$;

comment on function plt_privado.fn_projetar_posicao() is
  'Único lugar que escreve a posição do card. Reage a evento inserido; nunca o contrário. Desde a SESSAO-11 projeta também o arquivamento.';

-- As leituras passam a ignorar arquivados (mesma forma → replace direto).
create or replace function public.plt_fn_pedidos_kanban(
  p_busca            text     default null,
  p_somente_sem_card boolean  default false,
  p_ids              bigint[] default null,
  p_limite           integer  default 20,
  p_deslocamento     integer  default 0
)
returns table (
  pedido_id       bigint,
  numero          integer,
  cliente_nome    text,
  data_pedido     date,
  data_prevista   date,
  situacao        text,
  total_itens     integer,
  total_unidades  integer,
  tem_card        boolean,
  unidades_liberadas integer,
  alterado_apos_liberacao boolean,
  contagem_total  bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id                                as pedido_id,
         p.numero,
         coalesce(c.nome, '')                as cliente_nome,
         p.data_pedido,
         p.data_prevista,
         p.situacao,
         coalesce(i.total_itens, 0)          as total_itens,
         coalesce(i.total_unidades, 0)       as total_unidades,
         (pc.id is not null)                 as tem_card,
         coalesce(u.liberadas, 0)            as unidades_liberadas,
         exists (select 1 from public.plt_eventos e
                  where e.card_id = pc.id and e.tipo = 'pedido_atualizado')
                                             as alterado_apos_liberacao,
         count(*) over ()                    as contagem_total
    from public.pedidos p
    left join public.clientes c on c.id = p.cliente_id
    left join lateral (
      select count(*)::int as total_itens,
             coalesce(sum(case when round(pi.quantidade) >= 1
                               then round(pi.quantidade)::int else 0 end), 0)::int
               as total_unidades
        from public.pedido_itens pi
       where pi.pedido_id = p.id
    ) i on true
    left join lateral (
      select count(*)::int as liberadas
        from public.plt_cards cu
       where cu.pedido_id = p.id and cu.tipo = 'unidade'
         and cu.arquivado_em is null
    ) u on true
    left join public.plt_cards pc
           on pc.pedido_id = p.id and pc.tipo = 'pedido' and pc.arquivado_em is null
   where plt_privado.fn_usuario_atual() is not null
     and (p_ids is null or p.id = any (p_ids))
     and (not coalesce(p_somente_sem_card, false) or pc.id is null)
     and (p_busca is null or btrim(p_busca) = ''
          or p.numero::text like btrim(p_busca) || '%'
          or c.nome ilike '%' || btrim(p_busca) || '%')
   order by p.data_pedido desc nulls last, p.numero desc
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

create or replace function public.plt_fn_expedicao_kanban(
  p_busca         text    default null,
  p_limite        integer default 20,
  p_deslocamento  integer default 0
)
returns table (
  pedido_id            bigint,
  numero               integer,
  cliente_nome         text,
  data_prevista        date,
  situacao             text,
  total_unidades       integer,
  unidades_liberadas   integer,
  unidades_no_terminal integer,
  alterado_apos_liberacao boolean,
  contagem_total       bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id                          as pedido_id,
         p.numero,
         coalesce(c.nome, '')          as cliente_nome,
         p.data_prevista,
         p.situacao,
         coalesce(i.total_unidades, 0) as total_unidades,
         coalesce(u.liberadas, 0)      as unidades_liberadas,
         coalesce(u.no_terminal, 0)    as unidades_no_terminal,
         exists (select 1 from public.plt_eventos e
                  where e.card_id = pc.id and e.tipo = 'pedido_atualizado')
                                       as alterado_apos_liberacao,
         count(*) over ()              as contagem_total
    from public.pedidos p
    join public.plt_cards pc
      on pc.pedido_id = p.id and pc.tipo = 'pedido' and pc.arquivado_em is null
    left join public.clientes c on c.id = p.cliente_id
    left join lateral (
      select coalesce(sum(case when round(pi.quantidade) >= 1
                               then round(pi.quantidade)::int else 0 end), 0)::int
               as total_unidades
        from public.pedido_itens pi
       where pi.pedido_id = p.id
    ) i on true
    left join lateral (
      select count(*)::int as liberadas,
             count(*) filter (where cu.concluido_em is not null)::int as no_terminal
        from public.plt_cards cu
       where cu.pedido_id = p.id and cu.tipo = 'unidade'
         and cu.arquivado_em is null
    ) u on true
   where plt_privado.fn_pode_ver_expedicao()
     and (p_busca is null or btrim(p_busca) = ''
          or p.numero::text like btrim(p_busca) || '%'
          or c.nome ilike '%' || btrim(p_busca) || '%')
   order by p.data_prevista asc nulls last, p.numero desc
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

create or replace function public.plt_fn_pedido_unidades(p_pedido_id bigint)
returns table (
  card_id         bigint,
  item_seq        integer,
  item_codigo     text,
  item_descricao  text,
  indice_unidade  integer,
  total_unidades  integer,
  setor_id        bigint,
  setor_nome      text,
  setor_terminal  boolean,
  etapa_nome      text,
  desde           timestamptz,
  concluido_em    timestamptz,
  qualidade_atual text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select cu.id            as card_id,
         cu.item_seq,
         cu.item_codigo,
         cu.item_descricao,
         cu.indice_unidade,
         cu.total_unidades,
         s.id             as setor_id,
         s.nome           as setor_nome,
         (s.papel_no_fluxo = 'terminal') as setor_terminal,
         e.nome           as etapa_nome,
         cu.desde,
         cu.concluido_em,
         cu.qualidade_atual
    from public.plt_cards cu
    left join public.plt_setores s on s.id = cu.setor_atual_id
    left join public.plt_etapas  e on e.id = cu.etapa_atual_id
   where plt_privado.fn_pode_ver_expedicao()
     and cu.pedido_id = p_pedido_id
     and cu.tipo = 'unidade'
     and cu.arquivado_em is null
   order by cu.item_seq, cu.indice_unidade;
$$;

-- ----------------------------------------------------------------------------
-- 3 · Chaves de API (Q-50 ✅) — só o admin enxerga e gere; o valor NUNCA fica
-- ----------------------------------------------------------------------------
create table if not exists public.plt_chaves_api (
  id           bigint generated always as identity primary key,
  nome         text not null,
  -- sha256 hex da chave completa; o valor em claro é mostrado UMA vez na criação
  hash         text not null unique,
  prefixo      text not null,
  escopo       text not null default 'escrita' check (escopo in ('leitura', 'escrita')),
  criada_por   uuid references public.plt_usuarios(id),
  criada_em    timestamptz not null default now(),
  revogada_em  timestamptz,
  ultimo_uso_em timestamptz
);

comment on table public.plt_chaves_api is
  'Chaves da API aberta (SESSAO-11/Q-50). Só o hash vive aqui; revogada_em corta o acesso na hora. Quem confere é a Edge Function `api`.';

alter table public.plt_chaves_api enable row level security;

drop policy if exists plt_chaves_api_admin on public.plt_chaves_api;
create policy plt_chaves_api_admin on public.plt_chaves_api
  for all to authenticated
  using (plt_privado.fn_eh_admin())
  with check (plt_privado.fn_eh_admin());

-- ----------------------------------------------------------------------------
-- 4 · Webhooks de saída (RF-52) — assinatura de eventos + fila de entregas
-- ----------------------------------------------------------------------------
create table if not exists public.plt_webhooks (
  id          bigint generated always as identity primary key,
  nome        text not null,
  url         text not null,
  -- tipos de evento assinados (ex.: {card_criado, movimentacao_setor})
  eventos     text[] not null default '{}',
  -- opcional: assina o corpo com HMAC sha256 no header X-Assinatura
  segredo     text,
  ativo       boolean not null default true,
  criado_por  uuid references public.plt_usuarios(id),
  criado_em   timestamptz not null default now()
);

comment on table public.plt_webhooks is
  'Webhooks de saída (RF-52): o n8n (ou qualquer sistema) assina tipos de evento e recebe POST na URL. Destino é genérico — a ponte ClickUp morreu (D-33).';

create table if not exists public.plt_webhook_entregas (
  id            bigint generated always as identity primary key,
  webhook_id    bigint not null references public.plt_webhooks(id) on delete cascade,
  evento_id     bigint not null references public.plt_eventos(id),
  payload       jsonb not null,
  situacao      text not null default 'pendente'
                check (situacao in ('pendente', 'enviada', 'falha')),
  tentativas    integer not null default 0,
  ultimo_erro   text,
  criada_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.plt_webhook_entregas is
  'Fila de entrega dos webhooks: o trigger enfileira, pg_cron+pg_net despacham. "enviada" = POST disparado (fire-and-forget nesta fase).';

create index if not exists plt_webhook_entregas_pendentes_idx
  on public.plt_webhook_entregas (situacao, criada_em) where situacao = 'pendente';

alter table public.plt_webhooks          enable row level security;
alter table public.plt_webhook_entregas  enable row level security;

drop policy if exists plt_webhooks_admin on public.plt_webhooks;
create policy plt_webhooks_admin on public.plt_webhooks
  for all to authenticated
  using (plt_privado.fn_eh_admin())
  with check (plt_privado.fn_eh_admin());

drop policy if exists plt_webhook_entregas_admin on public.plt_webhook_entregas;
create policy plt_webhook_entregas_admin on public.plt_webhook_entregas
  for select to authenticated
  using (plt_privado.fn_eh_admin());

-- O trigger que ENFILEIRA (após o evento existir; payload pequeno e completo).
create or replace function plt_privado.fn_enfileirar_webhooks()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  w record;
  v_payload jsonb;
begin
  for w in select * from public.plt_webhooks
            where ativo and new.tipo = any (eventos)
  loop
    if v_payload is null then
      select jsonb_build_object(
               'evento_id', new.id,
               'tipo', new.tipo,
               'ocorrido_em', new.ocorrido_em,
               'origem', new.origem,
               'card_id', new.card_id,
               'setor_origem', so.nome,
               'setor_destino', sd.nome,
               'estado_qualidade', new.estado_qualidade,
               'observacao', new.observacao,
               'dados', new.dados,
               'card', case when c.id is not null then jsonb_build_object(
                 'tipo', c.tipo,
                 'pedido_numero', p.numero,
                 'item_codigo', c.item_codigo,
                 'item_descricao', c.item_descricao,
                 'indice_unidade', c.indice_unidade,
                 'total_unidades', c.total_unidades
               ) end)
        into v_payload
        from (select 1) um
        left join public.plt_cards c on c.id = new.card_id
        left join public.pedidos p on p.id = c.pedido_id
        left join public.plt_setores so on so.id = new.setor_origem_id
        left join public.plt_setores sd on sd.id = new.setor_destino_id;
    end if;
    insert into public.plt_webhook_entregas (webhook_id, evento_id, payload)
         values (w.id, new.id, v_payload);
  end loop;
  return null;
end;
$$;

revoke all on function plt_privado.fn_enfileirar_webhooks() from public, anon, authenticated;

drop trigger if exists plt_eventos_webhooks on public.plt_eventos;
create trigger plt_eventos_webhooks
  after insert on public.plt_eventos
  for each row execute function plt_privado.fn_enfileirar_webhooks();

-- O DESPACHO: pg_net faz o POST async; pg_cron chama a cada minuto.
-- Guardado por existência — o Postgres dos testes não tem as extensões.
create or replace function plt_privado.fn_despachar_webhooks()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  v_headers jsonb;
  v_total integer := 0;
begin
  if to_regproc('net.http_post') is null then
    return 0; -- sem pg_net não há como postar (ambiente de teste)
  end if;

  for r in
    select en.id, en.payload, w.url, w.segredo
      from public.plt_webhook_entregas en
      join public.plt_webhooks w on w.id = en.webhook_id and w.ativo
     where en.situacao = 'pendente' and en.tentativas < 5
     order by en.criada_em
     limit 50
  loop
    v_headers := jsonb_build_object('Content-Type', 'application/json');
    if r.segredo is not null and r.segredo <> '' then
      v_headers := v_headers || jsonb_build_object(
        'X-Assinatura',
        encode(extensions.hmac(r.payload::text::bytea, r.segredo::bytea, 'sha256'), 'hex'));
    end if;

    begin
      perform net.http_post(url := r.url, body := r.payload, headers := v_headers);
      update public.plt_webhook_entregas
         set situacao = 'enviada', tentativas = tentativas + 1, atualizado_em = now()
       where id = r.id;
      v_total := v_total + 1;
    exception when others then
      update public.plt_webhook_entregas
         set situacao = case when tentativas + 1 >= 5 then 'falha' else 'pendente' end,
             tentativas = tentativas + 1,
             ultimo_erro = sqlerrm,
             atualizado_em = now()
       where id = r.id;
    end;
  end loop;

  return v_total;
end;
$$;

comment on function plt_privado.fn_despachar_webhooks() is
  'Despacha as entregas pendentes via pg_net (fire-and-forget, até 5 tentativas). Chamada pelo pg_cron a cada minuto.';

revoke all on function plt_privado.fn_despachar_webhooks() from public, anon, authenticated;

-- Extensões e agendamento — só onde existem (produção).
do $$
begin
  begin
    if exists (select 1 from pg_available_extensions where name = 'pg_net') then
      create extension if not exists pg_net;
    end if;
    if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
      create extension if not exists pg_cron;
    end if;
  exception when others then
    raise notice 'extensões de webhook não habilitadas aqui: %', sqlerrm;
  end;

  begin
    if exists (select 1 from pg_extension where extname = 'pg_cron') then
      if not exists (select 1 from cron.job where jobname = 'plt-webhooks-despachar') then
        perform cron.schedule('plt-webhooks-despachar', '* * * * *',
                              'select plt_privado.fn_despachar_webhooks()');
      end if;
    end if;
  exception when others then
    raise notice 'agendamento do despacho não criado aqui: %', sqlerrm;
  end;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5 · ROTAS na plataforma (D-33): entregas por PEDIDO COMPLETO
--
-- ⚠️ Exceção DELIBERADA de dado pessoal: a entrega precisa de endereço e
-- contato (é o que o card do ClickUp já mostra hoje ao entregador). O gate é
-- o da logística: admin, entrada (o PCP É a logística — D-22) e terminais.
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_rotas(
  p_situacao      text default null, -- 'aguardando' | 'pronta' | 'entregue'
  p_busca         text default null,
  p_limite        integer default 20,
  p_deslocamento  integer default 0
)
returns table (
  card_id           bigint,
  pedido_id         bigint,
  numero            integer,
  cliente_nome      text,
  telefone          text,
  endereco          text,
  numero_endereco   text,
  complemento       text,
  bairro            text,
  cidade            text,
  uf                text,
  obs               text,
  data_prevista     date,
  total_unidades    integer,
  unidades_em_rotas integer,
  situacao_entrega  text,
  entregue_em       timestamptz,
  entregue_por      text,
  contagem_total    bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with rotas as (
    select s.id from public.plt_setores s where s.codigo = 'rotas'
  ),
  base as (
    select pc.id                        as card_id,
           p.id                         as pedido_id,
           p.numero,
           coalesce(c.nome, '')         as cliente_nome,
           c.fone                       as telefone,
           c.endereco,
           c.numero                     as numero_endereco,
           c.complemento,
           c.bairro,
           c.cidade,
           c.uf,
           p.obs,
           p.data_prevista,
           coalesce(i.total_unidades, 0) as total_unidades,
           coalesce(u.em_rotas, 0)       as unidades_em_rotas,
           ent.ocorrido_em               as entregue_em,
           ent_nome.nome                 as entregue_por
      from public.plt_cards pc
      join public.pedidos p on p.id = pc.pedido_id
      left join public.clientes c on c.id = p.cliente_id
      left join lateral (
        select coalesce(sum(case when round(pi.quantidade) >= 1
                                 then round(pi.quantidade)::int else 0 end), 0)::int
                 as total_unidades
          from public.pedido_itens pi
         where pi.pedido_id = p.id
      ) i on true
      left join lateral (
        select count(*)::int as em_rotas
          from public.plt_cards cu
         where cu.pedido_id = p.id and cu.tipo = 'unidade'
           and cu.arquivado_em is null
           and cu.setor_atual_id in (select id from rotas)
      ) u on true
      left join lateral (
        select e.ocorrido_em, e.usuario_id
          from public.plt_eventos e
         where e.card_id = pc.id and e.tipo = 'pedido_entregue'
         order by e.ocorrido_em desc limit 1
      ) ent on true
      left join public.plt_usuarios ent_nome on ent_nome.id = ent.usuario_id
     where pc.tipo = 'pedido' and pc.arquivado_em is null
       and coalesce(u.em_rotas, 0) > 0
  )
  select b.card_id,
         b.pedido_id,
         b.numero,
         b.cliente_nome,
         b.telefone,
         b.endereco,
         b.numero_endereco,
         b.complemento,
         b.bairro,
         b.cidade,
         b.uf,
         b.obs,
         b.data_prevista,
         b.total_unidades,
         b.unidades_em_rotas,
         case
           when b.entregue_em is not null then 'entregue'
           when b.total_unidades > 0 and b.unidades_em_rotas >= b.total_unidades then 'pronta'
           else 'aguardando'
         end as situacao_entrega,
         b.entregue_em,
         b.entregue_por,
         count(*) over () as contagem_total
    from base b
   where plt_privado.fn_pode_ver_expedicao()
     and (p_situacao is null or
          case
            when b.entregue_em is not null then 'entregue'
            when b.total_unidades > 0 and b.unidades_em_rotas >= b.total_unidades then 'pronta'
            else 'aguardando'
          end = p_situacao)
     and (p_busca is null or btrim(p_busca) = ''
          or b.numero::text like btrim(p_busca) || '%'
          or b.cliente_nome ilike '%' || btrim(p_busca) || '%')
   order by (b.entregue_em is not null), b.data_prevista asc nulls last, b.numero
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_rotas(text, text, integer, integer) is
  'ROTAS na plataforma (SESSAO-11/D-33): entregas por PEDIDO COMPLETO, com endereço/contato (exceção deliberada — gate da logística: admin/entrada/terminais). Endpoint de propósito.';

-- O gesto: registrar a entrega (por pedido inteiro — D-33).
create or replace function public.plt_fn_registrar_entrega(
  p_card_id    bigint,
  p_observacao text default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
  v_card    public.plt_cards%rowtype;
  v_total   integer;
  v_em_rotas integer;
  v_evento_id bigint;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null then
    raise exception 'Só usuário ativo da plataforma registra entrega.' using errcode = 'insufficient_privilege';
  end if;
  if not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Registrar entrega é gesto da logística (PCP/terminais) ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_card from public.plt_cards where id = p_card_id and tipo = 'pedido';
  if not found then
    raise exception 'Card de pedido % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  if exists (select 1 from public.plt_eventos e
              where e.card_id = p_card_id and e.tipo = 'pedido_entregue') then
    raise exception 'Este pedido já foi registrado como entregue.' using errcode = 'check_violation';
  end if;

  select coalesce(sum(case when round(pi.quantidade) >= 1
                           then round(pi.quantidade)::int else 0 end), 0)::int
    into v_total
    from public.pedido_itens pi where pi.pedido_id = v_card.pedido_id;
  select count(*)::int into v_em_rotas
    from public.plt_cards cu
    join public.plt_setores s on s.id = cu.setor_atual_id
   where cu.pedido_id = v_card.pedido_id and cu.tipo = 'unidade'
     and cu.arquivado_em is null and s.codigo = 'rotas';

  -- D-33: "não vamos entregar 10 móveis se ele pediu 30" — só pedido completo.
  if v_total = 0 or v_em_rotas < v_total then
    raise exception 'A entrega sai por pedido completo: % de % unidade(s) na ROTAS.', v_em_rotas, v_total
      using errcode = 'check_violation';
  end if;

  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
       values (p_card_id, 'pedido_entregue', v_usuario, 'interface',
               nullif(btrim(p_observacao), ''),
               jsonb_build_object('unidades', v_em_rotas))
    returning id into v_evento_id;

  return v_evento_id;
end;
$$;

comment on function public.plt_fn_registrar_entrega(bigint, text) is
  'Registra a entrega do PEDIDO COMPLETO (SESSAO-11/D-33). NÃO toca o Tiny — a automação ClickUp→Tiny em produção segue intocada; ligar os dois é decisão futura do dono.';

-- ----------------------------------------------------------------------------
-- 6 · Quem executa o quê (E-11) — +2 WARN esperados (rotas e entrega): total 16
-- ----------------------------------------------------------------------------
revoke all on function public.plt_fn_rotas(text, text, integer, integer)   from public, anon;
revoke all on function public.plt_fn_registrar_entrega(bigint, text)       from public, anon;
grant execute on function public.plt_fn_rotas(text, text, integer, integer) to authenticated;
grant execute on function public.plt_fn_registrar_entrega(bigint, text)     to authenticated;
