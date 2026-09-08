-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 23 — METAS DO MEU PAINEL
-- Sessão: SESSAO-14 · Data: 2026-09-01 (Bloco 3 — a reforma, D-35)
--
-- O cockpit de metas do Meu Painel (D-37): meta com indicador configurável
-- (unidades concluídas · tarefas concluídas · tempo útil trabalhado), período
-- diário/semanal/mensal e dono pessoa OU setor. O progresso NUNCA é digitado —
-- é calculado dos dados que já existem (execuções, tarefas, tempo útil D-29).
--
-- Regras do dono nesta sessão (respostas de 01/09):
--  · meta de setor é visível a TODOS os membros do setor (edição só líder/admin);
--  · "unidades concluídas" conta TODA execução encerrada — finalizada,
--    transferência e mover sem finalizar (cada execução fechada = 1);
--  · semana começa na SEGUNDA-FEIRA (date_trunc('week') já faz isso) — se a
--    empresa mudar, muda aqui num lugar só.
--
-- Quem cria/edita/encerra (D-37): admin (qualquer), líder (do próprio setor —
-- meta do setor ou de gente do setor), a própria pessoa (meta pessoal). RLS
-- garante no banco, não só na UI. Histórico preservado em plt_metas_eventos
-- (append-only) e tudo entra na trilha de atividade (D-40).
--
-- Nada aqui toca as tabelas da integração (clientes, pedidos, pedido_itens,
-- eventos, gp_pcp_processados).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · A tabela de metas
-- ----------------------------------------------------------------------------
create table if not exists public.plt_metas (
  id               bigint generated always as identity primary key,
  titulo           text,
  indicador        text not null check (indicador in ('unidades', 'tarefas', 'tempo_util')),
  periodo          text not null check (periodo in ('diaria', 'semanal', 'mensal')),
  alvo             numeric(10,2) not null check (alvo > 0),
  -- o dono é UMA pessoa OU UM setor, nunca os dois, nunca nenhum
  usuario_id       uuid   references public.plt_usuarios(id),
  setor_id         bigint references public.plt_setores(id),
  criada_por_id    uuid references public.plt_usuarios(id),
  encerrada_em     timestamptz,
  encerrada_por_id uuid references public.plt_usuarios(id),
  criada_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  constraint plt_metas_dono_ck check (num_nonnulls(usuario_id, setor_id) = 1)
);

comment on table public.plt_metas is
  'Metas do cockpit do Meu Painel (D-37). Progresso calculado de eventos — nunca digitado. Encerrar é marcar encerrada_em; meta não se apaga.';
comment on column public.plt_metas.indicador is
  'unidades = execuções encerradas (qualquer encerramento — resposta do dono 01/09) · tarefas = tarefas concluídas · tempo_util = horas úteis de execução (D-29).';
comment on column public.plt_metas.alvo is
  'Alvo numérico do período: unidades/tarefas em contagem; tempo_util em HORAS.';

create index if not exists plt_metas_usuario_idx
  on public.plt_metas (usuario_id) where encerrada_em is null;
create index if not exists plt_metas_setor_idx
  on public.plt_metas (setor_id) where encerrada_em is null;

drop trigger if exists plt_metas_atualizacao on public.plt_metas;
create trigger plt_metas_atualizacao
  before update on public.plt_metas
  for each row execute function plt_privado.fn_marcar_atualizacao();

-- ----------------------------------------------------------------------------
-- 2 · O histórico da meta — append-only, como todo registro de história aqui
-- ----------------------------------------------------------------------------
create table if not exists public.plt_metas_eventos (
  id          bigint generated always as identity primary key,
  meta_id     bigint not null references public.plt_metas(id),
  tipo        text not null check (tipo in ('meta_criada', 'meta_alterada', 'meta_encerrada')),
  usuario_id  uuid references public.plt_usuarios(id),
  dados       jsonb not null default '{}'::jsonb,
  ocorrido_em timestamptz not null default now()
);

comment on table public.plt_metas_eventos is
  'História de cada meta (criada/alterada/encerrada) com autor e o que mudou. APPEND-ONLY por trigger — correção é registro novo.';

create index if not exists plt_metas_eventos_meta_idx
  on public.plt_metas_eventos (meta_id, ocorrido_em);

create or replace function plt_privado.fn_meta_evento_imutavel()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'O histórico de metas não pode ser alterado nem apagado — correção é um registro novo.';
end;
$$;

revoke all on function plt_privado.fn_meta_evento_imutavel() from public, anon, authenticated;

drop trigger if exists plt_metas_eventos_imutavel on public.plt_metas_eventos;
create trigger plt_metas_eventos_imutavel
  before update or delete on public.plt_metas_eventos
  for each row execute function plt_privado.fn_meta_evento_imutavel();

-- ----------------------------------------------------------------------------
-- 3 · Preparo do gesto (BEFORE): autor de criação/encerramento vem da sessão,
-- e meta encerrada é definitiva — quer meta de novo, cria outra (a história
-- de cada período fica limpa).
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_preparar_meta()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    new.criada_por_id := coalesce(plt_privado.fn_usuario_atual(), new.criada_por_id);
    new.encerrada_em := null;
    new.encerrada_por_id := null;
    return new;
  end if;

  if old.encerrada_em is not null then
    raise exception 'Esta meta já foi encerrada — para continuar medindo, crie uma meta nova.';
  end if;
  if new.encerrada_em is not null then
    new.encerrada_por_id := coalesce(plt_privado.fn_usuario_atual(), new.encerrada_por_id);
  end if;
  -- o dono da meta não muda depois de criada (histórico de progresso mudaria de sentido)
  if new.usuario_id is distinct from old.usuario_id or new.setor_id is distinct from old.setor_id then
    raise exception 'O dono da meta não muda — encerre esta e crie uma nova para outra pessoa ou setor.';
  end if;
  return new;
end;
$$;

revoke all on function plt_privado.fn_preparar_meta() from public, anon, authenticated;

drop trigger if exists plt_metas_preparar on public.plt_metas;
create trigger plt_metas_preparar
  before insert or update on public.plt_metas
  for each row execute function plt_privado.fn_preparar_meta();

-- ----------------------------------------------------------------------------
-- 4 · Todo gesto vira história + trilha de atividade (D-40), numa tacada
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_registrar_meta_evento()
returns trigger
security definer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_tipo  text;
  v_autor uuid;
  v_dados jsonb;
begin
  if tg_op = 'INSERT' then
    v_tipo  := 'meta_criada';
    v_autor := coalesce(plt_privado.fn_usuario_atual(), new.criada_por_id);
    v_dados := jsonb_strip_nulls(jsonb_build_object(
      'titulo',     new.titulo,
      'indicador',  new.indicador,
      'periodo',    new.periodo,
      'alvo',       new.alvo,
      'usuario_id', new.usuario_id,
      'setor_id',   new.setor_id
    ));
  elsif new.encerrada_em is not null and old.encerrada_em is null then
    v_tipo  := 'meta_encerrada';
    v_autor := coalesce(plt_privado.fn_usuario_atual(), new.encerrada_por_id);
    v_dados := jsonb_strip_nulls(jsonb_build_object(
      'indicador', new.indicador,
      'periodo',   new.periodo,
      'alvo',      new.alvo
    ));
  else
    v_tipo  := 'meta_alterada';
    v_autor := plt_privado.fn_usuario_atual();
    v_dados := jsonb_strip_nulls(jsonb_build_object(
      'alvo_antes',       case when new.alvo      is distinct from old.alvo      then old.alvo      end,
      'alvo_depois',      case when new.alvo      is distinct from old.alvo      then new.alvo      end,
      'indicador_antes',  case when new.indicador is distinct from old.indicador then old.indicador end,
      'indicador_depois', case when new.indicador is distinct from old.indicador then new.indicador end,
      'periodo_antes',    case when new.periodo   is distinct from old.periodo   then old.periodo   end,
      'periodo_depois',   case when new.periodo   is distinct from old.periodo   then new.periodo   end,
      'titulo_alterado',  case when new.titulo    is distinct from old.titulo    then true          end
    ));
    -- nada relevante mudou → sem registro vazio
    if v_dados = '{}'::jsonb then
      return null;
    end if;
  end if;

  insert into public.plt_metas_eventos (meta_id, tipo, usuario_id, dados)
  values (new.id, v_tipo, v_autor, coalesce(v_dados, '{}'::jsonb));

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
  values (v_autor, v_tipo, jsonb_strip_nulls(jsonb_build_object(
    'meta_id',    new.id,
    'indicador',  new.indicador,
    'periodo',    new.periodo,
    'usuario_id', new.usuario_id,
    'setor_id',   new.setor_id
  )));
  return null;
end;
$$;

revoke all on function plt_privado.fn_registrar_meta_evento() from public, anon, authenticated;

drop trigger if exists plt_metas_registrar on public.plt_metas;
create trigger plt_metas_registrar
  after insert or update on public.plt_metas
  for each row execute function plt_privado.fn_registrar_meta_evento();

-- ----------------------------------------------------------------------------
-- 5 · RLS — a regra da D-37 vale no banco, não só na UI
-- ----------------------------------------------------------------------------
alter table public.plt_metas enable row level security;
alter table public.plt_metas_eventos enable row level security;

-- LEITURA: admin tudo · a própria pessoa · TODOS os membros do setor dono
-- (resposta do dono 01/09) · líder vê as metas pessoais da gente dos setores
-- que lidera · quem criou vê o que criou.
drop policy if exists plt_metas_leitura on public.plt_metas;
create policy plt_metas_leitura on public.plt_metas
  for select to authenticated
  using (
    plt_privado.fn_eh_admin()
    or usuario_id = plt_privado.fn_usuario_atual()
    or setor_id in (select plt_privado.fn_setores_do_usuario())
    or criada_por_id = plt_privado.fn_usuario_atual()
    or (usuario_id is not null and exists (
          select 1 from public.plt_usuario_setores us
           where us.usuario_id = plt_metas.usuario_id
             and plt_privado.fn_eh_lider_de(us.setor_id)))
  );

-- CRIAÇÃO: admin qualquer · líder para o setor que lidera ou para gente dele ·
-- pessoa para si mesma. Sempre em nome próprio (criada_por_id = quem está aqui).
drop policy if exists plt_metas_criacao on public.plt_metas;
create policy plt_metas_criacao on public.plt_metas
  for insert to authenticated
  with check (
    criada_por_id = plt_privado.fn_usuario_atual()
    and (
      plt_privado.fn_eh_admin()
      or (setor_id is not null and plt_privado.fn_eh_lider_de(setor_id))
      or (usuario_id is not null and (
            usuario_id = plt_privado.fn_usuario_atual()
            or exists (
                 select 1 from public.plt_usuario_setores us
                  where us.usuario_id = plt_metas.usuario_id
                    and plt_privado.fn_eh_lider_de(us.setor_id))))
    )
  );

-- EDIÇÃO/ENCERRAMENTO: a mesma regra da criação (D-37 — "segue a mesma regra");
-- a própria pessoa mexe nas metas pessoais dela, líder nas do território dele.
drop policy if exists plt_metas_edicao on public.plt_metas;
create policy plt_metas_edicao on public.plt_metas
  for update to authenticated
  using (
    plt_privado.fn_eh_admin()
    or (setor_id is not null and plt_privado.fn_eh_lider_de(setor_id))
    or (usuario_id is not null and (
          usuario_id = plt_privado.fn_usuario_atual()
          or exists (
               select 1 from public.plt_usuario_setores us
                where us.usuario_id = plt_metas.usuario_id
                  and plt_privado.fn_eh_lider_de(us.setor_id))))
  )
  with check (
    plt_privado.fn_eh_admin()
    or (setor_id is not null and plt_privado.fn_eh_lider_de(setor_id))
    or (usuario_id is not null and (
          usuario_id = plt_privado.fn_usuario_atual()
          or exists (
               select 1 from public.plt_usuario_setores us
                where us.usuario_id = plt_metas.usuario_id
                  and plt_privado.fn_eh_lider_de(us.setor_id))))
  );

-- DELETE: sem policy nenhuma — meta não se apaga, se encerra (e o histórico fica).

-- Histórico: quem vê a meta vê a história dela (o RLS de plt_metas decide);
-- escrita só pelo trigger (security definer) — nenhuma policy de INSERT.
drop policy if exists plt_metas_eventos_leitura on public.plt_metas_eventos;
create policy plt_metas_eventos_leitura on public.plt_metas_eventos
  for select to authenticated
  using (exists (select 1 from public.plt_metas m where m.id = plt_metas_eventos.meta_id));

-- ----------------------------------------------------------------------------
-- 6 · A porta de leitura do cockpit (padrão da migration 18 — E-11):
-- devolve as metas que ESTE usuário pode ver, cada uma com a janela do período
-- corrente (fuso America/Fortaleza) e o progresso calculado no banco.
-- Endpoint de propósito: +1 WARN esperado nos advisors (total 18).
-- ----------------------------------------------------------------------------
-- E-17: a migration 25 (SESSAO-15) acrescenta a etapa opcional ao retorno —
-- drop + create aqui também, para a segunda rodada do test:banco passar.
drop function if exists public.plt_fn_metas_painel(boolean, integer, integer);

create or replace function public.plt_fn_metas_painel(
  p_incluir_encerradas boolean default false,
  p_limite             integer default 20,
  p_deslocamento       integer default 0
)
returns table (
  meta_id         bigint,
  titulo          text,
  indicador       text,
  periodo         text,
  alvo            numeric,
  usuario_id      uuid,
  usuario_nome    text,
  setor_id        bigint,
  setor_nome      text,
  criada_por_nome text,
  encerrada_em    timestamptz,
  janela_inicio   timestamptz,
  janela_fim      timestamptz,
  progresso       numeric,
  contagem_total  bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with eu as (
    select plt_privado.fn_usuario_atual() as id
  ),
  visiveis as (
    select m.*
      from public.plt_metas m
     where plt_privado.fn_eh_admin()
        or m.usuario_id = (select id from eu)
        or m.setor_id in (select plt_privado.fn_setores_do_usuario())
        or m.criada_por_id = (select id from eu)
        or (m.usuario_id is not null and exists (
              select 1 from public.plt_usuario_setores us
               where us.usuario_id = m.usuario_id
                 and plt_privado.fn_eh_lider_de(us.setor_id)))
  )
  select m.id                                   as meta_id,
         m.titulo,
         m.indicador,
         m.periodo,
         m.alvo,
         m.usuario_id,
         du.nome                                as usuario_nome,
         m.setor_id,
         ds.nome                                as setor_nome,
         cr.nome                                as criada_por_nome,
         m.encerrada_em,
         j.inicio                               as janela_inicio,
         j.fim                                  as janela_fim,
         pr.progresso,
         count(*) over ()                       as contagem_total
    from visiveis m
    left join public.plt_usuarios du on du.id = m.usuario_id
    left join public.plt_setores  ds on ds.id = m.setor_id
    left join public.plt_usuarios cr on cr.id = m.criada_por_id
    -- a janela corrente do período, no fuso da fábrica (semana começa na
    -- segunda — resposta do dono 01/09; mudar o começo da semana é mudar AQUI)
    cross join lateral (
      select case m.periodo
               when 'diaria'  then date_trunc('day',   now() at time zone 'America/Fortaleza')
               when 'semanal' then date_trunc('week',  now() at time zone 'America/Fortaleza')
               else                date_trunc('month', now() at time zone 'America/Fortaleza')
             end as ini_local
    ) jl
    cross join lateral (
      select jl.ini_local at time zone 'America/Fortaleza' as inicio,
             (jl.ini_local + case m.periodo
                               when 'diaria'  then interval '1 day'
                               when 'semanal' then interval '7 days'
                               else                interval '1 month'
                             end) at time zone 'America/Fortaleza' as fim
    ) j
    cross join lateral (
      select case m.indicador
        -- unidades concluídas = execuções ENCERRADAS na janela (qualquer
        -- encerramento: finalizada, transferência ou mover — dono 01/09)
        when 'unidades' then coalesce((
          select count(*)::numeric
            from public.plt_vw_execucoes v
           where v.finalizou_em >= j.inicio and v.finalizou_em < j.fim
             and ((m.usuario_id is not null and v.usuario_inicio_id = m.usuario_id)
               or (m.setor_id   is not null and v.setor_id = m.setor_id))), 0)
        when 'tarefas' then coalesce((
          select count(*)::numeric
            from public.plt_tarefas t
           where t.situacao = 'concluida'
             and t.concluida_em >= j.inicio and t.concluida_em < j.fim
             and ((m.usuario_id is not null and t.responsavel_id = m.usuario_id)
               or (m.setor_id   is not null and t.setor_id = m.setor_id))), 0)
        -- tempo útil (D-29) em HORAS: execuções clipadas à janela, descontando
        -- horário de funcionamento e pausas — a mesma régua dos dashboards
        else coalesce((
          select round((extract(epoch from sum(
                   plt_privado.fn_tempo_util(
                     greatest(v.iniciou_em, j.inicio),
                     least(coalesce(v.finalizou_em, now()), j.fim),
                     v.setor_id, v.usuario_inicio_id))) / 3600)::numeric, 2)
            from public.plt_vw_execucoes v
           where coalesce(v.finalizou_em, now()) > j.inicio
             and v.iniciou_em < j.fim
             and ((m.usuario_id is not null and v.usuario_inicio_id = m.usuario_id)
               or (m.setor_id   is not null and v.setor_id = m.setor_id))), 0)
      end as progresso
    ) pr
   where (p_incluir_encerradas or m.encerrada_em is null)
   order by (m.encerrada_em is not null),
            case m.periodo when 'diaria' then 1 when 'semanal' then 2 else 3 end,
            m.criada_em desc
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_metas_painel(boolean, integer, integer) is
  'Cockpit do Meu Painel (SESSAO-14/D-37): metas visíveis ao usuário com janela corrente (America/Fortaleza) e progresso calculado dos eventos. Endpoint de propósito — gate interno.';

revoke all on function public.plt_fn_metas_painel(boolean, integer, integer) from public, anon;
grant execute on function public.plt_fn_metas_painel(boolean, integer, integer) to authenticated;
