-- ============================================================================
-- SESSAO-30 · etapa 4 — "Entregue" nos dois lados (D-113, D-114, D-116)
--
-- 1. A entrega VIGENTE do pedido vira uma projeção no card do pedido
--    (`plt_cards.entrega_evento_id`): o `pedido_entregue` a liga, o novo fato
--    `entrega_desfeita` a desliga. As portas que perguntavam "existe evento de
--    entrega?" passam a ler a projeção (sem varrer eventos — Lei §7).
-- 2. Registrar a entrega na plataforma FECHA TUDO (a mesma regra do Tiny —
--    fn_fechar_pedido) e, com a chave "Entregue vai ao Tiny" ligada, põe o
--    pedido na FILA do Tiny: o banco chama o n8n NA HORA (pg_net, depois do
--    commit); sem resposta ou com erro, nova tentativa com espera crescente e
--    sorteio, por um relógio que só existe enquanto há pedido esperando e se
--    desagenda sozinho; disjuntor quando o Tiny cai; 8 falhas = parado e aviso.
--    A chave nasce DESLIGADA: a prova com 1 pedido real é do dono.
-- 3. Desfazer a entrega (só no dia, com motivo — D-113/D-116): as peças voltam
--    à ROTAS e o Tiny volta para a situação de antes (pela fila).
-- 4. Não entregue (com motivo): o pedido volta para "Programar"; as peças
--    seguem na ROTAS; o Tiny não muda.
-- 5. Pedido devolvido pelo entregador (D-114, resposta 1a): as peças vão ao
--    ESTOQUE sem dono; o Tiny não muda. O marcador "Devolvido" do Tiny vale
--    como cancelamento; e o cancelado/devolvido com peça na ROTAS (programada
--    ou no caminhão) também vai sozinho ao ESTOQUE.
-- 6. Motivos (D-116): lista cadastrável (Configurações → Utilitários), já
--    semeada com frases curtas.
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · Os fatos novos (lista inteira — a mesma da migration 51 + 3)
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
      'execucao_pausada',
      'execucao_retomada',
      'qualidade_marcada',
      'qualidade_parecer',
      'divergencia_registrada',
      'notificacao_enviada',
      'delegacao',
      'estorno',
      'pedido_atualizado',
      'pedido_cancelado',
      'card_arquivado',
      'pedido_entregue',
      'pedido_lancado_rotas',
      'unidade_desvinculada',
      'peca_alocada',
      'peca_reservada',
      'peca_reserva_desfeita',
      'estoque_reserva_avaliada',
      'etiqueta_adicionada',
      'etiqueta_removida',
      'card_desarquivado',
      'entrega_desfeita',          -- SESSAO-30 (D-113): a entrega do dia foi desfeita
      'entrega_nao_realizada',     -- SESSAO-30 (D-116): não entregue, com motivo
      'pedido_devolvido'           -- SESSAO-30 (D-114): devolvido (entregador ou marcador do Tiny)
    )) not valid;
end;
$$;
alter table public.plt_eventos validate constraint plt_eventos_tipo_check;

-- ----------------------------------------------------------------------------
-- 2 · A entrega vigente, projetada no card do pedido
-- ----------------------------------------------------------------------------
alter table public.plt_cards add column if not exists entrega_evento_id bigint;
comment on column public.plt_cards.entrega_evento_id is
  'SESSAO-30 (D-113): a entrega VIGENTE do pedido (o pedido_entregue que vale). Projeção: o pedido_entregue liga, o entrega_desfeita desliga. Não escreva à mão.';

create or replace function plt_privado.fn_projetar_entrega()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.tipo = 'pedido_entregue' then
    update public.plt_cards set entrega_evento_id = new.id where id = new.card_id;
  elsif new.tipo = 'entrega_desfeita' then
    update public.plt_cards set entrega_evento_id = null where id = new.card_id;
  end if;
  return null;
end;
$$;

drop trigger if exists plt_eventos_projetar_entrega on public.plt_eventos;
create trigger plt_eventos_projetar_entrega
  after insert on public.plt_eventos
  for each row
  when (new.tipo in ('pedido_entregue', 'entrega_desfeita'))
  execute function plt_privado.fn_projetar_entrega();

-- A história: a última entrega de cada pedido, se não foi desfeita depois.
update public.plt_cards c
   set entrega_evento_id = x.id
  from (
    select distinct on (e.card_id) e.card_id, e.id
      from public.plt_eventos e
     where e.tipo = 'pedido_entregue'
     order by e.card_id, e.id desc
  ) x
 where c.id = x.card_id
   and c.entrega_evento_id is distinct from x.id
   and not exists (select 1 from public.plt_eventos d
                    where d.card_id = x.card_id and d.tipo = 'entrega_desfeita' and d.id > x.id);

create or replace function plt_privado.fn_entregue(p_card_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select c.entrega_evento_id is not null from public.plt_cards c where c.id = p_card_id), false);
$$;

-- ----------------------------------------------------------------------------
-- 3 · Motivos (D-116) — "Não entregue" e "Desfazer a entrega"
-- ----------------------------------------------------------------------------
create table if not exists public.plt_motivos (
  id         bigint generated always as identity primary key,
  tipo       text not null,
  texto      text not null,
  ordem      integer not null default 100,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint plt_motivos_tipo_ck check (tipo in ('nao_entregue', 'desfazer_entrega')),
  constraint plt_motivos_texto_ck check (char_length(btrim(texto)) between 2 and 80)
);
create unique index if not exists plt_motivos_tipo_texto_uq on public.plt_motivos (tipo, lower(btrim(texto)));
alter table public.plt_motivos enable row level security;
revoke all on table public.plt_motivos from public, anon, authenticated;
comment on table public.plt_motivos is
  'SESSAO-30 (D-116): motivos curtos de "não entregue" e de "desfazer a entrega", cadastrados em Configurações → Utilitários. Só pelas portas.';

insert into public.plt_motivos (tipo, texto, ordem)
select x.tipo, x.texto, x.ordem
  from (values
    ('nao_entregue', 'Cliente estava ausente', 10),
    ('nao_entregue', 'Endereço errado', 20),
    ('nao_entregue', 'Endereço não encontrado', 30),
    ('nao_entregue', 'Entrega reagendada', 40),
    ('nao_entregue', 'Cliente recusou receber', 50),
    ('nao_entregue', 'Caminhão quebrou', 60),
    ('nao_entregue', 'Faltou tempo na rota', 70),
    ('nao_entregue', 'Sem acesso ao local', 80),
    ('nao_entregue', 'Móvel danificado no transporte', 90),
    ('desfazer_entrega', 'Marquei entregue por engano', 10),
    ('desfazer_entrega', 'Cliente ligou para devolver', 20),
    ('desfazer_entrega', 'Entrega não foi concluída', 30),
    ('desfazer_entrega', 'Pedido trocado na entrega', 40)
  ) as x(tipo, texto, ordem)
 where not exists (select 1 from public.plt_motivos m
                    where m.tipo = x.tipo and lower(btrim(m.texto)) = lower(btrim(x.texto)));

create or replace function public.plt_fn_motivos(p_tipo text, p_todos boolean default false)
returns table (id bigint, tipo text, texto text, ordem integer, ativo boolean)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.id, m.tipo, m.texto, m.ordem, m.ativo
    from public.plt_motivos m
   where plt_privado.fn_usuario_atual() is not null
     and m.tipo = p_tipo
     and (m.ativo or (coalesce(p_todos, false) and plt_privado.fn_eh_admin()))
   order by m.ordem, m.texto
   limit 200;
$$;

create or replace function public.plt_fn_motivo_salvar(
  p_id    bigint,
  p_tipo  text,
  p_texto text,
  p_ordem integer default null,
  p_ativo boolean default true
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
begin
  if not plt_privado.fn_eh_admin() then
    raise exception 'Cadastrar motivo é gesto de admin.' using errcode = 'insufficient_privilege';
  end if;
  if p_tipo not in ('nao_entregue', 'desfazer_entrega') then
    raise exception 'Tipo de motivo desconhecido.' using errcode = 'check_violation';
  end if;
  if char_length(btrim(coalesce(p_texto, ''))) not between 2 and 80 then
    raise exception 'O motivo precisa ter de 2 a 80 letras — uma frase curta.' using errcode = 'check_violation';
  end if;
  if p_id is null then
    insert into public.plt_motivos (tipo, texto, ordem, ativo)
      values (p_tipo, btrim(p_texto), coalesce(p_ordem, 100), coalesce(p_ativo, true))
      returning id into v_id;
  else
    update public.plt_motivos
       set texto = btrim(p_texto), ordem = coalesce(p_ordem, ordem), ativo = coalesce(p_ativo, ativo),
           atualizado_em = now()
     where id = p_id and tipo = p_tipo
     returning id into v_id;
    if v_id is null then
      raise exception 'Motivo não encontrado.' using errcode = 'no_data_found';
    end if;
  end if;
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (plt_privado.fn_usuario_atual(), 'motivo_salvo',
            jsonb_build_object('motivo_id', v_id, 'tipo', p_tipo, 'texto', btrim(p_texto), 'ativo', coalesce(p_ativo, true)));
  return v_id;
exception when unique_violation then
  raise exception 'Já existe esse motivo.' using errcode = 'unique_violation';
end;
$$;

-- ----------------------------------------------------------------------------
-- 4 · A fila do Tiny para a situação do pedido (plataforma → Tiny)
-- ----------------------------------------------------------------------------
-- A chave fica na linha da ROTAS (como a do estoque fica na do ESTOQUE).
alter table public.plt_setores add column if not exists tiny_entrega_desde timestamptz;
alter table public.plt_setores add column if not exists tiny_entrega_ok_em timestamptz;
comment on column public.plt_setores.tiny_entrega_desde is
  'SESSAO-30 (D-113), só na linha da ROTAS: desde quando o "Entregue" da plataforma vai ao Tiny (nulo = desligado).';
comment on column public.plt_setores.tiny_entrega_ok_em is
  'SESSAO-30: a última resposta OK do Tiny para a situação do pedido (o disjuntor olha aqui).';

create table if not exists public.plt_tiny_pedido_fila (
  pedido_id     bigint primary key references public.pedidos (id),
  numero        integer not null,
  tiny_id       bigint,
  situacao      text not null,
  motivo        text not null,
  versao        integer not null default 1,
  tentativas    integer not null default 0,
  proxima_em    timestamptz not null default now(),
  enviado_em    timestamptz,
  ultimo_erro   text,
  parado_em     timestamptz,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint plt_tiny_pedido_fila_motivo_ck check (motivo in ('entregue', 'desfeita'))
);
create index if not exists plt_tiny_pedido_fila_proxima_idx
  on public.plt_tiny_pedido_fila (proxima_em) where parado_em is null;
alter table public.plt_tiny_pedido_fila enable row level security;
revoke all on table public.plt_tiny_pedido_fila from public, anon, authenticated;
comment on table public.plt_tiny_pedido_fila is
  'SESSAO-30 (D-113): o que o Tiny ainda precisa ficar (situação do pedido) — uma linha por pedido, a última vontade vale (versão). Sai quando o Tiny confirma.';

-- O endereço do fluxo no n8n (webhook de produção; o caminho com UUID é o segredo).
insert into public.plt_webhooks (nome, url, eventos, ativo)
select 'n8n · situação do pedido no Tiny',
       'https://n8n.srv1877515.hstgr.cloud/webhook/11118300-48bf-416f-be4d-95a58d0a106b',
       array['tiny_pedido_situacao'],
       true
 where not exists (select 1 from public.plt_webhooks w where 'tiny_pedido_situacao' = any (w.eventos));

-- A situação da API v2 do Tiny a partir do que guardamos (descrição ou código).
create or replace function plt_privado.fn_tiny_situacao_api(p_situacao text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case plt_privado.fn_situacao_normalizada(p_situacao)
           when 'em_aberto'          then 'aberto'
           when 'aberto'             then 'aberto'
           when 'aprovado'           then 'aprovado'
           when 'preparando_envio'   then 'preparando_envio'
           when 'faturado'           then 'faturado'
           when 'faturado_(atendido)' then 'faturado'
           when 'pronto_para_envio'  then 'pronto_envio'
           when 'pronto_envio'       then 'pronto_envio'
           when 'enviado'            then 'enviado'
           when 'entregue'           then 'enviado'      -- voltar de "entregue" = enviado
           when 'nao_entregue'       then 'nao_entregue'
           else 'enviado'
         end;
$$;

create or replace function plt_privado.fn_tiny_entrega_desde()
returns timestamptz
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.tiny_entrega_desde from public.plt_setores s where s.codigo = 'rotas' limit 1;
$$;

-- Disjuntor: 5 pedidos com erro nos últimos 15 min e nenhum OK nesse tempo =
-- o Tiny (ou o n8n) está fora — para de chamar por 15 min.
create or replace function plt_privado.fn_tiny_pedido_pausado()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (select count(*) from public.plt_tiny_pedido_fila f
           where f.ultimo_erro is not null and f.atualizado_em > now() - interval '15 minutes') >= 5
     and coalesce((select s.tiny_entrega_ok_em from public.plt_setores s where s.codigo = 'rotas' limit 1),
                  '-infinity'::timestamptz) < now() - interval '15 minutes';
$$;

-- O relógio de nova tentativa: só existe enquanto há pedido esperando.
create or replace function plt_privado.fn_tiny_pedido_agendar(p_ligar boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job bigint;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    return;
  end if;
  select jobid into v_job from cron.job where jobname = 'plt-tiny-pedido-fila';
  if p_ligar and v_job is null then
    perform cron.schedule('plt-tiny-pedido-fila', '* * * * *', 'select plt_privado.fn_tiny_pedido_relogio()');
  elsif not p_ligar and v_job is not null then
    perform cron.unschedule(v_job);
  end if;
end;
$$;

-- Chama o n8n para UM pedido (pg_net, assíncrono — sai depois do commit).
create or replace function plt_privado.fn_tiny_pedido_chamar(p_pedido_id bigint)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_f   public.plt_tiny_pedido_fila%rowtype;
  v_url text;
begin
  if plt_privado.fn_tiny_entrega_desde() is null then
    return 'desligado';
  end if;
  select * into v_f from public.plt_tiny_pedido_fila where pedido_id = p_pedido_id and parado_em is null for update;
  if not found then
    return 'nada';
  end if;
  if plt_privado.fn_tiny_pedido_pausado() then
    update public.plt_tiny_pedido_fila
       set proxima_em = now() + interval '15 minutes', atualizado_em = now()
     where pedido_id = p_pedido_id;
    perform plt_privado.fn_tiny_pedido_agendar(true);
    return 'pausado';
  end if;
  select w.url into v_url from public.plt_webhooks w
   where w.ativo and 'tiny_pedido_situacao' = any (w.eventos)
   order by w.id limit 1;
  -- a "posse" do envio: sem resposta em 3 min, o relógio manda de novo.
  update public.plt_tiny_pedido_fila
     set enviado_em = now(), proxima_em = now() + interval '3 minutes', atualizado_em = now()
   where pedido_id = p_pedido_id;
  perform plt_privado.fn_tiny_pedido_agendar(true);
  if v_url is null then
    return 'sem_endereco';
  end if;
  if to_regproc('net.http_post') is null then
    return 'sem_pg_net';   -- ambiente de teste
  end if;
  perform net.http_post(
    url     := v_url,
    body    := jsonb_build_object('pedido_id', v_f.pedido_id, 'numero', v_f.numero, 'tiny_id', v_f.tiny_id,
                                  'situacao', v_f.situacao, 'versao', v_f.versao, 'motivo', v_f.motivo),
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 5000);
  return 'chamado';
end;
$$;

-- Põe o pedido na fila (a última vontade vale) e chama na hora.
create or replace function plt_privado.fn_tiny_pedido_enfileirar(p_pedido_id bigint, p_situacao text, p_motivo text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_numero integer;
  v_tiny   bigint;
begin
  if plt_privado.fn_tiny_entrega_desde() is null then
    return 'desligado';
  end if;
  select p.numero, p.tiny_id into v_numero, v_tiny from public.pedidos p where p.id = p_pedido_id;
  if v_numero is null then
    return 'sem_pedido';
  end if;
  insert into public.plt_tiny_pedido_fila as f (pedido_id, numero, tiny_id, situacao, motivo)
    values (p_pedido_id, v_numero, v_tiny, p_situacao, p_motivo)
  on conflict (pedido_id) do update
    set situacao = excluded.situacao, motivo = excluded.motivo, tiny_id = excluded.tiny_id,
        versao = f.versao + 1, tentativas = 0, ultimo_erro = null, parado_em = null,
        proxima_em = now(), atualizado_em = now();
  return plt_privado.fn_tiny_pedido_chamar(p_pedido_id);
end;
$$;

-- O relógio (só existe enquanto há fila): reenvia o que venceu; fila vazia = se desagenda.
create or replace function plt_privado.fn_tiny_pedido_relogio()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r   record;
  v_n integer := 0;
begin
  if plt_privado.fn_tiny_entrega_desde() is null
     or not exists (select 1 from public.plt_tiny_pedido_fila f where f.parado_em is null) then
    perform plt_privado.fn_tiny_pedido_agendar(false);
    return jsonb_build_object('relogio', 'desligado');
  end if;
  for r in
    select f.pedido_id from public.plt_tiny_pedido_fila f
     where f.parado_em is null and f.proxima_em <= now()
     order by f.proxima_em
     limit 20
  loop
    begin
      perform plt_privado.fn_tiny_pedido_chamar(r.pedido_id);
      v_n := v_n + 1;
    exception when others then
      null;   -- um pedido com problema não segura os outros
    end;
  end loop;
  return jsonb_build_object('reenviados', v_n);
end;
$$;

-- A resposta do n8n (só a chave de serviço): OK sai da fila; erro agenda a
-- nova tentativa (1, 2, 4, 8… min, com sorteio, teto de 1 h); 8 erros = parado.
create or replace function public.plt_fn_tiny_pedido_resultado(
  p_pedido_id bigint,
  p_versao    integer,
  p_ok        boolean,
  p_erro      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_f     public.plt_tiny_pedido_fila%rowtype;
  v_admin uuid;
begin
  select * into v_f from public.plt_tiny_pedido_fila where pedido_id = p_pedido_id for update;
  if not found then
    return jsonb_build_object('acao', 'nada', 'motivo', 'fora_da_fila');
  end if;
  if coalesce(p_versao, 0) < v_f.versao then
    return jsonb_build_object('acao', 'nada', 'motivo', 'versao_antiga');
  end if;
  if coalesce(p_ok, false) then
    delete from public.plt_tiny_pedido_fila where pedido_id = p_pedido_id;
    update public.plt_setores set tiny_entrega_ok_em = now() where codigo = 'rotas';
    insert into public.plt_logs_atividade (usuario_id, acao, contexto)
      values (null, 'tiny_situacao_alterada',
              jsonb_build_object('pedido_id', v_f.pedido_id, 'numero', v_f.numero, 'situacao', v_f.situacao,
                                 'motivo', v_f.motivo, 'tentativas', v_f.tentativas + 1));
    if not exists (select 1 from public.plt_tiny_pedido_fila f where f.parado_em is null) then
      perform plt_privado.fn_tiny_pedido_agendar(false);
    end if;
    return jsonb_build_object('acao', 'ok', 'numero', v_f.numero);
  end if;

  if v_f.tentativas + 1 >= 8 then
    update public.plt_tiny_pedido_fila
       set tentativas = tentativas + 1, ultimo_erro = left(coalesce(p_erro, 'erro sem descrição'), 500),
           parado_em = now(), atualizado_em = now()
     where pedido_id = p_pedido_id;
    for v_admin in select u.id from public.plt_usuarios u where u.ativo and u.papel = 'admin' and u.super_admin loop
      insert into public.plt_notificacoes (destinatario_id, card_id, tipo, titulo, corpo)
        values (v_admin, (select c.id from public.plt_cards c where c.pedido_id = v_f.pedido_id and c.tipo = 'pedido'),
                'tiny_pedido_parado',
                'O Tiny não aceitou a situação do pedido ' || v_f.numero,
                'Depois de 8 tentativas o pedido ' || v_f.numero || ' não ficou "' || v_f.situacao
                  || '" no Tiny. Último erro: ' || left(coalesce(p_erro, 'sem descrição'), 200));
    end loop;
    return jsonb_build_object('acao', 'parado', 'numero', v_f.numero);
  end if;
  update public.plt_tiny_pedido_fila
     set tentativas = tentativas + 1, ultimo_erro = left(coalesce(p_erro, 'erro sem descrição'), 500),
         proxima_em = now() + least(power(2, v_f.tentativas) * interval '1 minute', interval '60 minutes')
                                * (0.75 + random() * 0.5),
         atualizado_em = now()
   where pedido_id = p_pedido_id;
  perform plt_privado.fn_tiny_pedido_agendar(true);
  return jsonb_build_object('acao', 'nova_tentativa', 'numero', v_f.numero, 'tentativas', v_f.tentativas + 1);
end;
$$;

-- Super admin: ligar / desligar a chave, ver a fila, mandar de novo o parado.
create or replace function public.plt_fn_tiny_entrega_situacao()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when not plt_privado.fn_eh_admin() then null else jsonb_build_object(
    'ligado_desde', plt_privado.fn_tiny_entrega_desde(),
    'ultimo_ok_em', (select s.tiny_entrega_ok_em from public.plt_setores s where s.codigo = 'rotas' limit 1),
    'pausado', plt_privado.fn_tiny_pedido_pausado(),
    'esperando', (select count(*) from public.plt_tiny_pedido_fila f where f.parado_em is null),
    'parados', coalesce((select jsonb_agg(jsonb_build_object('pedido_id', f.pedido_id, 'numero', f.numero,
                                                             'situacao', f.situacao, 'erro', f.ultimo_erro,
                                                             'parado_em', f.parado_em) order by f.parado_em desc)
                           from (select * from public.plt_tiny_pedido_fila where parado_em is not null
                                  order by parado_em desc limit 20) f), '[]'::jsonb)) end;
$$;

create or replace function public.plt_fn_tiny_entrega_ligar(p_ligar boolean)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not plt_privado.fn_eh_super_admin() then
    raise exception 'Ligar o "Entregue vai ao Tiny" é gesto do super admin.' using errcode = 'insufficient_privilege';
  end if;
  update public.plt_setores
     set tiny_entrega_desde = case when p_ligar then coalesce(tiny_entrega_desde, now()) end
   where codigo = 'rotas';
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (plt_privado.fn_usuario_atual(), case when p_ligar then 'tiny_entrega_ligada' else 'tiny_entrega_desligada' end, '{}'::jsonb);
  if not p_ligar then
    perform plt_privado.fn_tiny_pedido_agendar(false);
  end if;
  return plt_privado.fn_tiny_entrega_desde();
end;
$$;

create or replace function public.plt_fn_tiny_entrega_reenviar(p_pedido_id bigint)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not plt_privado.fn_eh_super_admin() then
    raise exception 'Mandar de novo ao Tiny é gesto do super admin.' using errcode = 'insufficient_privilege';
  end if;
  update public.plt_tiny_pedido_fila
     set parado_em = null, tentativas = 0, ultimo_erro = null, proxima_em = now(), versao = versao + 1,
         atualizado_em = now()
   where pedido_id = p_pedido_id;
  if not found then
    raise exception 'Este pedido não está parado na fila do Tiny.' using errcode = 'no_data_found';
  end if;
  return plt_privado.fn_tiny_pedido_chamar(p_pedido_id);
end;
$$;

-- ----------------------------------------------------------------------------
-- 5 · Cancelado OU devolvido (D-114): o marcador "Devolvido" do Tiny e o
--     "Pedido devolvido" do entregador valem como o cancelamento para a peça.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_pedido_cancelado(p_pedido_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado'
            or exists (select 1 from unnest(coalesce(p.marcadores, '{}'::text[])) m
                        where plt_privado.fn_situacao_normalizada(btrim(m)) = 'devolvido')
            or exists (select 1 from public.plt_cards pc
                         join public.plt_eventos e on e.card_id = pc.id and e.tipo = 'pedido_devolvido'
                        where pc.pedido_id = p.id and pc.tipo = 'pedido')
       from public.pedidos p where p.id = p_pedido_id),
    false);
$$;

comment on function plt_privado.fn_pedido_cancelado(bigint) is
  'O pedido não quer mais a peça: cancelado no Tiny, com o marcador "Devolvido" no Tiny, ou "Pedido devolvido" pelo entregador (SESSAO-30 — D-114).';

-- O cancelamento/devolução tira a peça do pedido (recriada POR INTEIRO a partir
-- da migration 27/09): + o devolvido (D-114) e a peça na ROTAS, + sai da programação.
create or replace function plt_privado.fn_desvincular_por_cancelamento()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pedido_id bigint;
  v_numero    integer;
  v_aguardo   bigint;
  v_estoque   bigint;
  v_rotas     bigint;
  v_devolvido boolean;
  v_frase     text;
  v_codigo    text;
  v_descricao text;
  r           record;
begin
  if new.tipo in ('pedido_cancelado', 'pedido_devolvido') then
    v_devolvido := new.tipo = 'pedido_devolvido';
    select c.pedido_id into v_pedido_id
      from public.plt_cards c where c.id = new.card_id and c.tipo = 'pedido';
    if v_pedido_id is null then
      return null;
    end if;
    select p.numero into v_numero from public.pedidos p where p.id = v_pedido_id;
    select s.id into v_aguardo from public.plt_setores s where s.codigo = 'aguardo';
    select s.id into v_estoque from public.plt_setores s where s.codigo = 'estoque';
    -- SESSAO-30 (D-114): a peça na ROTAS (programada ou no caminhão) também volta.
    select s.id into v_rotas from public.plt_setores s where s.codigo = 'rotas';
    v_frase := case when v_devolvido then 'devolvido' else 'cancelado no Tiny' end;

    for r in
      select u.id, u.setor_atual_id, u.etapa_atual_id, u.item_codigo, u.item_descricao
        from public.plt_cards u
       where u.pedido_id = v_pedido_id
         and u.tipo = 'unidade'
         and u.arquivado_em is null
         and u.setor_atual_id in (v_aguardo, v_estoque, v_rotas)
       order by u.id
    loop
      insert into public.plt_eventos (card_id, tipo, origem, evento_referencia_id, observacao, dados)
        values (r.id, 'unidade_desvinculada', 'automacao', new.id,
                'Pedido ' || coalesce(v_numero::text, '') || ' ' || v_frase || ' — a peça ficou sem dono.',
                jsonb_build_object(
                  'motivo',          case when v_devolvido then 'pedido_devolvido' else 'pedido_cancelado' end,
                  'pedido_id',       v_pedido_id,
                  'numero',          v_numero,
                  'card_pedido_id',  new.card_id,
                  'produto_tiny_id', plt_privado.fn_produto_do_item(r.item_codigo, r.item_descricao)));
      if r.setor_atual_id in (v_aguardo, v_rotas) and v_estoque is not null then
        -- Sem evento_referencia_id de propósito: nas movimentações ele é a
        -- marcação de qualidade da transição (D-09) — aqui não há marcação.
        insert into public.plt_eventos
            (card_id, tipo, origem, setor_origem_id, etapa_origem_id, setor_destino_id,
             observacao, dados)
          values
            (r.id, 'movimentacao_setor', 'automacao', r.setor_atual_id, r.etapa_atual_id, v_estoque,
             'Pedido ' || v_frase || ' — a peça pronta voltou ao ESTOQUE, sem dono.',
             jsonb_build_object('motivo', case when v_devolvido then 'pedido_devolvido' else 'pedido_cancelado' end,
                                'numero', v_numero,
                                'cancelamento_evento_id', new.id));
      end if;
    end loop;
    -- Sai da programação do caminhão (a remoção vai à trilha pelo gatilho dela).
    delete from public.plt_programacoes where card_id = new.card_id;
    return null;
  end if;

  if new.tipo = 'movimentacao_setor' then
    if not exists (select 1 from public.plt_setores s
                    where s.id = new.setor_destino_id and s.codigo = 'estoque') then
      return null;
    end if;
    select c.pedido_id, c.item_codigo, c.item_descricao
      into v_pedido_id, v_codigo, v_descricao
      from public.plt_cards c where c.id = new.card_id and c.tipo = 'unidade';
    if v_pedido_id is null or not plt_privado.fn_pedido_cancelado(v_pedido_id) then
      return null;
    end if;
    select p.numero into v_numero from public.pedidos p where p.id = v_pedido_id;
    insert into public.plt_eventos (card_id, tipo, origem, evento_referencia_id, observacao, dados)
      values (new.card_id, 'unidade_desvinculada', 'automacao', new.id,
              'Pedido ' || coalesce(v_numero::text, '') || ' cancelado no Tiny — a peça ficou pronta e entrou no ESTOQUE sem dono.',
              jsonb_build_object(
                'motivo',          'pedido_cancelado',
                'pedido_id',       v_pedido_id,
                'numero',          v_numero,
                'card_pedido_id',  (select pc.id from public.plt_cards pc
                                     where pc.pedido_id = v_pedido_id and pc.tipo = 'pedido'),
                'produto_tiny_id', plt_privado.fn_produto_do_item(v_codigo, v_descricao)));
  end if;
  return null;
end;
$$;

drop trigger if exists plt_eventos_zz_desvincular_cancelados on public.plt_eventos;
create trigger plt_eventos_zz_desvincular_cancelados
  after insert on public.plt_eventos
  for each row
  when (new.tipo in ('pedido_cancelado', 'pedido_devolvido', 'movimentacao_setor'))
  execute function plt_privado.fn_desvincular_por_cancelamento();

-- A reação ao pedido do Tiny (recriada POR INTEIRO a partir da migration 56):
-- + o marcador "Devolvido" (D-114).
create or replace function plt_privado.fn_reagir_pedido()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card_id       bigint;
  v_setor_pcp     bigint;
  v_liberadas     integer;
  v_cancelou      boolean;
  v_mudou         boolean;
  v_evento_id     bigint;
  v_destinatarios uuid[];
  v_destinatario  uuid;
  v_titulo        text;
  v_corpo         text;
begin
  begin
    if tg_op = 'INSERT' then
      select s.id into v_setor_pcp
        from public.plt_setores s
       where s.papel_no_fluxo = 'entrada' and s.ativo
       order by s.id limit 1;
      if v_setor_pcp is null then
        return null;
      end if;

      insert into public.plt_cards (tipo, pedido_id, setor_atual_id)
           values ('pedido', new.id, v_setor_pcp)
      on conflict do nothing
      returning id into v_card_id;
      if v_card_id is null then
        return null;
      end if;

      insert into public.plt_eventos (card_id, tipo, origem, setor_destino_id, dados)
           values (v_card_id, 'card_criado', 'automacao', v_setor_pcp,
                   jsonb_build_object('fonte', 'tiny', 'numero', new.numero));
      return null;
    end if;

    select c.id into v_card_id
      from public.plt_cards c
     where c.pedido_id = new.id and c.tipo = 'pedido';
    if v_card_id is null then
      return null;
    end if;

    -- SESSAO-30 (D-113): o Tiny ficou "Entregue" — para estar entregue lá, a
    -- peça não existe mais no galpão: nada do pedido fica aberto aqui.
    if plt_privado.fn_situacao_normalizada(new.situacao) = 'entregue'
       and plt_privado.fn_situacao_normalizada(old.situacao) is distinct from 'entregue' then
      perform plt_privado.fn_fechar_pedido(v_card_id, null, 'api', 'Entregue no Tiny.', 'tiny');
      return null;
    end if;

    -- SESSAO-30 (D-114): o marcador "Devolvido" no Tiny vale como cancelamento
    -- (a peça viva vai ao ESTOQUE sem dono — o gatilho do cancelamento faz).
    if exists (select 1 from unnest(coalesce(new.marcadores, '{}'::text[])) m
                where plt_privado.fn_situacao_normalizada(btrim(m)) = 'devolvido')
       and not exists (select 1 from unnest(coalesce(old.marcadores, '{}'::text[])) m
                        where plt_privado.fn_situacao_normalizada(btrim(m)) = 'devolvido')
       and not exists (select 1 from public.plt_eventos e
                        where e.card_id = v_card_id and e.tipo = 'pedido_devolvido') then
      insert into public.plt_eventos (card_id, tipo, origem, observacao, dados)
           values (v_card_id, 'pedido_devolvido', 'automacao', 'Pedido marcado "Devolvido" no Tiny.',
                   jsonb_build_object('fonte', 'tiny', 'numero', new.numero));
      return null;
    end if;

    -- SESSAO-15: "Cancelado" (descrição) e 'cancelado' (código) valem igual.
    v_cancelou := plt_privado.fn_situacao_normalizada(new.situacao) = 'cancelado'
              and plt_privado.fn_situacao_normalizada(old.situacao) <> 'cancelado';
    v_mudou := (old.situacao       is distinct from new.situacao)
            or (old.data_prevista  is distinct from new.data_prevista)
            or (old.total_produtos is distinct from new.total_produtos)
            or (old.total_pedido   is distinct from new.total_pedido)
            or (old.obs            is distinct from new.obs)
            or (old.obs_interna    is distinct from new.obs_interna)
            or (old.forma_envio    is distinct from new.forma_envio);
    if not v_mudou then
      return null;
    end if;

    select count(*)::int into v_liberadas
      from public.plt_cards c
     where c.pedido_id = new.id and c.tipo = 'unidade';

    if v_cancelou then
      insert into public.plt_eventos (card_id, tipo, origem, observacao, dados)
           values (v_card_id, 'pedido_cancelado', 'automacao',
                   'Pedido cancelado no Tiny.',
                   jsonb_build_object('fonte', 'tiny', 'numero', new.numero,
                                      'unidades_liberadas', v_liberadas))
        returning id into v_evento_id;

      if v_liberadas > 0 then
        select coalesce(array_agg(u.id), '{}') into v_destinatarios
          from public.plt_usuarios u
         where u.ativo and u.papel = 'admin';
        v_titulo := 'Pedido ' || new.numero || ' cancelado com produção em andamento';
        v_corpo  := 'O pedido ' || new.numero || ' foi cancelado no Tiny com '
                    || v_liberadas || ' unidade(s) já liberada(s) para produção. '
                    || 'Decida o que fazer com as peças.';
        if array_length(v_destinatarios, 1) is not null then
          foreach v_destinatario in array v_destinatarios loop
            insert into public.plt_notificacoes
                (destinatario_id, evento_id, card_id, tipo, titulo, corpo)
              values
                (v_destinatario, v_evento_id, v_card_id, 'pedido_cancelado', v_titulo, v_corpo);
          end loop;
          insert into public.plt_eventos
              (card_id, tipo, origem, evento_referencia_id, observacao, dados)
            values
              (v_card_id, 'notificacao_enviada', 'automacao', v_evento_id, v_titulo,
               jsonb_build_object('tipo', 'pedido_cancelado',
                                  'destinatarios', to_jsonb(v_destinatarios)));
        end if;
      end if;
      return null;
    end if;

    if v_liberadas > 0 then
      insert into public.plt_eventos (card_id, tipo, origem, dados)
           values (v_card_id, 'pedido_atualizado', 'automacao',
                   jsonb_build_object(
                     'fonte', 'tiny', 'numero', new.numero,
                     'unidades_liberadas', v_liberadas,
                     'situacao_antes',  old.situacao,      'situacao_depois',  new.situacao,
                     'previsao_antes',  old.data_prevista, 'previsao_depois',  new.data_prevista));
    end if;
    return null;

  exception when others then
    raise warning 'plt_reagir_pedido: % — a integração segue intacta', sqlerrm;
    return null;
  end;
end;
$$;

-- Quem traz de volta / põe etiqueta (recriada POR INTEIRO a partir da migration 51):
-- + a peça que volta quando a entrega é desfeita.
create or replace function plt_privado.fn_validar_marcas()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin    boolean;
  v_etiqueta public.plt_etiquetas%rowtype;
  v_card     public.plt_cards%rowtype;
begin
  if new.tipo not in ('etiqueta_adicionada', 'etiqueta_removida', 'card_desarquivado') then
    return new;
  end if;
  select exists (select 1 from public.plt_usuarios u
                  where u.id = new.usuario_id and u.ativo and u.papel = 'admin') into v_admin;
  -- SESSAO-30 (D-113): desfazer a entrega traz as peças de volta pela maquinaria.
  if not plt_privado.fn_evento_do_motor(new.origem, new.dados) and not v_admin
     and not (new.tipo = 'card_desarquivado'
              and coalesce(current_setting('plt.entrega_maquinaria', true), '') = 'on') then
    if new.tipo = 'card_desarquivado' then
      raise exception 'Trazer de volta um card arquivado é gesto do admin ou das automações.'
        using errcode = 'insufficient_privilege';
    end if;
    raise exception 'Etiqueta no card é coisa das automações (ou do admin).'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_card from public.plt_cards where id = new.card_id;
  if new.tipo = 'card_desarquivado' then
    if v_card.arquivado_em is null then
      raise exception 'Este card não está arquivado.' using errcode = 'check_violation';
    end if;
    return new;
  end if;

  select * into v_etiqueta from public.plt_etiquetas where id = nullif(new.dados ->> 'etiqueta_id', '')::bigint;
  if not found then
    raise exception 'Etiqueta não encontrada.' using errcode = 'no_data_found';
  end if;
  if new.tipo = 'etiqueta_adicionada' then
    if v_etiqueta.arquivada_em is not null then
      raise exception 'A etiqueta "%" está arquivada.', v_etiqueta.nome using errcode = 'check_violation';
    end if;
    if v_etiqueta.id = any (v_card.etiquetas) then
      raise exception 'O card já tem a etiqueta "%".', v_etiqueta.nome using errcode = 'check_violation';
    end if;
  elsif not (v_etiqueta.id = any (v_card.etiquetas)) then
    raise exception 'O card não tem a etiqueta "%".', v_etiqueta.nome using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- A validação dos gestos (recriada POR INTEIRO a partir da migration 57):
-- + a maquinaria da entrega arquiva as peças que saem com o pedido.
create or replace function plt_privado.fn_validar_api()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_papel text;
  v_logistica boolean;
  v_danificado boolean;
  v_reposicao boolean;
  v_livre_no_estoque boolean;
begin
  if new.tipo = 'card_arquivado' then
    -- SESSAO-30 (raio-x 2): peça livre do ESTOQUE só sai pela BAIXA do estoque
    -- (ordem de entrada, trava por produto, motivo e o Tiny junto) — vale
    -- para toda origem, até para o motor; a maquinaria liga a marca. A peça
    -- no DANIFICADO segue saindo pelos Danificados.
    if coalesce(current_setting('plt.estoque_maquinaria', true), '') <> 'on'
       and exists (select 1 from public.plt_cards c
                     join public.plt_setores s on s.id = c.setor_atual_id and s.codigo = 'estoque'
                     left join public.plt_etapas e on e.id = c.etapa_atual_id
                    where c.id = new.card_id and c.tipo = 'unidade' and c.pedido_id is null
                      and not coalesce(e.eh_danificado, false)) then
      raise exception 'Peça do ESTOQUE sai pela baixa do estoque (Estoque → o produto → Baixa): com o motivo, a ordem de entrada e o Tiny junto.'
        using errcode = 'check_violation';
    end if;
    -- SESSAO-30 (etapa 4): a entrega registrada por pessoa (logística, entregador)
    -- fecha o pedido pela maquinaria (fn_fechar_pedido liga a marca).
    if coalesce(current_setting('plt.entrega_maquinaria', true), '') = 'on' then
      return new;
    end if;
    -- SESSAO-27 (D-99): o motor das automações arquiva (o super admin montou e ligou).
    if plt_privado.fn_evento_do_motor(new.origem, new.dados) then
      return new;
    end if;
    if new.origem <> 'api' then
      select u.papel into v_papel from public.plt_usuarios u
       where u.id = new.usuario_id and u.ativo;
      if coalesce(v_papel, '') <> 'admin' then
        -- SESSAO-15 (D-45): a logística arquiva peça que está em DANIFICADO.
        select exists (
          select 1 from public.plt_cards c
            join public.plt_etapas e on e.id = c.etapa_atual_id
           where c.id = new.card_id and e.eh_danificado
        ) into v_danificado;
        -- SESSAO-25: e o card de REPOSIÇÃO (o PCP decide não produzir).
        select exists (
          select 1 from public.plt_cards c
           where c.id = new.card_id and c.tipo = 'reposicao'
        ) into v_reposicao;
        -- D-70 (28/09): e dá BAIXA em peça livre do ESTOQUE (a contagem é dela).
        select exists (
          select 1 from public.plt_cards c
            join public.plt_setores s on s.id = c.setor_atual_id and s.codigo = 'estoque'
           where c.id = new.card_id and c.tipo = 'unidade' and c.pedido_id is null
        ) into v_livre_no_estoque;
        if not ((coalesce(v_danificado, false) or coalesce(v_reposicao, false)
                 or coalesce(v_livre_no_estoque, false))
                and plt_privado.fn_eh_logistica(new.usuario_id)) then
          raise exception 'Arquivar card é gesto de admin ou da integração — a logística arquiva só peças em DANIFICADO, cards de reposição e dá baixa em peça livre do ESTOQUE.'
            using errcode = 'insufficient_privilege';
        end if;
      end if;
    end if;

  elsif new.tipo = 'pedido_entregue' then
    if new.usuario_id is null then
      -- SESSAO-30 (D-113): o Tiny ficou "Entregue" — quem registra é o Sistema,
      -- pela maquinaria (fn_fechar_pedido). Fora dela, entrega é gesto de pessoa.
      if coalesce(current_setting('plt.entrega_maquinaria', true), '') = 'on' then
        return new;
      end if;
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

  elsif new.tipo = 'pedido_lancado_rotas' then
    -- SESSAO-15 (D-45): lançar é gesto HUMANO da logística, no card de PEDIDO.
    if new.usuario_id is null then
      raise exception 'Lançar para ROTAS é gesto de pessoa — é preciso dizer quem lançou.'
        using errcode = 'check_violation';
    end if;
    if not plt_privado.fn_eh_logistica(new.usuario_id) then
      raise exception 'Lançar para ROTAS é gesto da logística (PCP/terminais) ou de admin.'
        using errcode = 'insufficient_privilege';
    end if;
    if not exists (select 1 from public.plt_cards c where c.id = new.card_id and c.tipo = 'pedido') then
      raise exception 'Só o card de pedido pode ser lançado para ROTAS.'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6 · Os gestos da entrega (logística/admin; a SESSAO-30 etapa 5 abre ao
--     entregador do caminhão)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_pode_mexer_entrega(p_card_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select plt_privado.fn_pode_ver_expedicao();
$$;

-- Registrar a entrega: fecha TUDO do pedido (a regra do Tiny — D-113) e,
-- com a chave ligada, o Tiny fica "Entregue" pela fila.
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
  v_usuario  uuid;
  v_card     public.plt_cards%rowtype;
  v_total    integer;
  v_em_rotas integer;
  v_ret      jsonb;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null then
    raise exception 'Só usuário ativo da plataforma registra entrega.' using errcode = 'insufficient_privilege';
  end if;
  if not plt_privado.fn_pode_mexer_entrega(p_card_id) then
    raise exception 'Registrar entrega é gesto da logística (PCP/terminais), do entregador do caminhão ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_card from public.plt_cards where id = p_card_id and tipo = 'pedido' for update;
  if not found then
    raise exception 'Card de pedido % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  if v_card.lancado_rotas_em is null then
    raise exception 'Este pedido ainda não foi lançado para ROTAS — lance pelos Pedidos em aguardo.'
      using errcode = 'check_violation';
  end if;
  if v_card.entrega_evento_id is not null then
    raise exception 'Este pedido já foi registrado como entregue.' using errcode = 'check_violation';
  end if;
  if plt_privado.fn_pedido_cancelado(v_card.pedido_id) then
    raise exception 'Este pedido foi cancelado ou devolvido — não se entrega.' using errcode = 'check_violation';
  end if;

  -- D-63: frete não conta (fn_unidades_do_pedido). D-33: entrega por pedido completo.
  v_total := plt_privado.fn_unidades_do_pedido(v_card.pedido_id);
  select count(*)::int into v_em_rotas
    from public.plt_cards cu
    join public.plt_setores s on s.id = cu.setor_atual_id
   where cu.pedido_id = v_card.pedido_id and cu.tipo = 'unidade'
     and cu.arquivado_em is null and s.codigo = 'rotas';
  if v_em_rotas < v_total then
    raise exception 'A entrega sai por pedido completo: % de % unidade(s) na ROTAS.', v_em_rotas, v_total
      using errcode = 'check_violation';
  end if;

  v_ret := plt_privado.fn_fechar_pedido(p_card_id, v_usuario, 'interface', p_observacao, 'plataforma');
  perform plt_privado.fn_tiny_pedido_enfileirar(v_card.pedido_id, 'entregue', 'entregue');
  return (v_ret ->> 'entrega_evento_id')::bigint;
end;
$$;

-- Desfazer a entrega (D-113): só no dia, com motivo; as peças voltam à ROTAS e
-- o Tiny volta para a situação de antes.
create or replace function public.plt_fn_entrega_desfazer(
  p_card_id    bigint,
  p_motivo_id  bigint,
  p_observacao text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario  uuid;
  v_card     public.plt_cards%rowtype;
  v_entrega  public.plt_eventos%rowtype;
  v_motivo   text;
  v_antes    text;
  v_marca    text;
  v_voltaram integer := 0;
  v_tiny     text;
  r          record;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null or not plt_privado.fn_pode_mexer_entrega(p_card_id) then
    raise exception 'Desfazer a entrega é gesto do entregador do caminhão, da logística ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;
  select m.texto into v_motivo from public.plt_motivos m
   where m.id = p_motivo_id and m.tipo = 'desfazer_entrega' and m.ativo;
  if v_motivo is null then
    raise exception 'Escolha o motivo de desfazer a entrega.' using errcode = 'check_violation';
  end if;
  select * into v_card from public.plt_cards where id = p_card_id and tipo = 'pedido' for update;
  if not found or v_card.entrega_evento_id is null then
    raise exception 'Este pedido não está entregue.' using errcode = 'check_violation';
  end if;
  select * into v_entrega from public.plt_eventos where id = v_card.entrega_evento_id;
  if (v_entrega.ocorrido_em at time zone 'America/Fortaleza')::date
     <> (now() at time zone 'America/Fortaleza')::date then
    raise exception 'Só dá para desfazer a entrega no mesmo dia.' using errcode = 'check_violation';
  end if;
  v_antes := plt_privado.fn_tiny_situacao_api(v_entrega.dados ->> 'situacao_tiny');

  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
    values (v_card.id, 'entrega_desfeita', v_usuario, 'interface',
            v_motivo || coalesce(' — ' || nullif(btrim(p_observacao), ''), ''),
            jsonb_build_object('entrega_evento_id', v_entrega.id, 'motivo_id', p_motivo_id, 'motivo', v_motivo,
                               'situacao_tiny_volta', v_antes));

  -- As peças que saíram com ESTA entrega voltam (por evento — nada se apaga).
  v_marca := current_setting('plt.entrega_maquinaria', true);
  perform set_config('plt.entrega_maquinaria', 'on', true);
  for r in
    select c.id, c.setor_atual_id, c.etapa_atual_id
      from public.plt_cards c
     where c.arquivado_em is not null
       and exists (select 1 from public.plt_eventos a
                    where a.card_id = c.id and a.tipo = 'card_arquivado'
                      and (a.dados ->> 'entrega_evento_id')::bigint = v_entrega.id)
     order by c.id
       for update
  loop
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id, observacao, dados)
      values (r.id, 'card_desarquivado', v_usuario, 'interface', r.setor_atual_id, r.etapa_atual_id,
              'A entrega foi desfeita — a peça voltou.',
              jsonb_build_object('motivo', 'entrega_desfeita', 'entrega_evento_id', v_entrega.id));
    v_voltaram := v_voltaram + 1;
  end loop;
  perform set_config('plt.entrega_maquinaria', coalesce(v_marca, ''), true);

  v_tiny := plt_privado.fn_tiny_pedido_enfileirar(v_card.pedido_id, v_antes, 'desfeita');
  return jsonb_build_object('desfeita', true, 'pecas_voltaram', v_voltaram, 'tiny', v_tiny, 'situacao_tiny', v_antes);
end;
$$;

-- Não entregue (D-116): com motivo; volta para "Programar"; o Tiny não muda.
create or replace function public.plt_fn_entrega_nao_realizada(
  p_card_id    bigint,
  p_motivo_id  bigint,
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
  v_motivo  text;
  v_prog    public.plt_programacoes%rowtype;
  v_evento  bigint;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null or not plt_privado.fn_pode_mexer_entrega(p_card_id) then
    raise exception 'Marcar "não entregue" é gesto do entregador do caminhão, da logística ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;
  select m.texto into v_motivo from public.plt_motivos m
   where m.id = p_motivo_id and m.tipo = 'nao_entregue' and m.ativo;
  if v_motivo is null then
    raise exception 'Escolha o motivo de não ter entregue.' using errcode = 'check_violation';
  end if;
  select * into v_card from public.plt_cards where id = p_card_id and tipo = 'pedido' for update;
  if not found or v_card.lancado_rotas_em is null then
    raise exception 'Este pedido não está na ROTAS.' using errcode = 'check_violation';
  end if;
  if v_card.entrega_evento_id is not null then
    raise exception 'Este pedido está como entregue — desfaça a entrega antes.' using errcode = 'check_violation';
  end if;
  select * into v_prog from public.plt_programacoes where card_id = v_card.id;

  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
    values (v_card.id, 'entrega_nao_realizada', v_usuario, 'interface',
            v_motivo || coalesce(' — ' || nullif(btrim(p_observacao), ''), ''),
            jsonb_build_object('motivo_id', p_motivo_id, 'motivo', v_motivo,
                               'data_entrega', v_prog.data_entrega, 'caminhao_id', v_prog.caminhao_id))
    returning id into v_evento;
  -- Volta para "Programar" (a remoção vai à trilha pelo gatilho da programação).
  delete from public.plt_programacoes where card_id = v_card.id;
  return v_evento;
end;
$$;

-- Pedido devolvido pelo entregador (D-114, resposta 1a): as peças vão ao
-- ESTOQUE sem dono (o gatilho do cancelamento faz); o Tiny não muda.
create or replace function public.plt_fn_entrega_devolvida(
  p_card_id    bigint,
  p_observacao text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
  v_card    public.plt_cards%rowtype;
  v_evento  bigint;
  v_numero  integer;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null or not plt_privado.fn_pode_mexer_entrega(p_card_id) then
    raise exception 'Marcar "pedido devolvido" é gesto do entregador do caminhão, da logística ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;
  select * into v_card from public.plt_cards where id = p_card_id and tipo = 'pedido' for update;
  if not found or v_card.lancado_rotas_em is null then
    raise exception 'Este pedido não está na ROTAS.' using errcode = 'check_violation';
  end if;
  if v_card.entrega_evento_id is not null then
    raise exception 'Este pedido está como entregue — desfaça a entrega antes (motivo "Cliente ligou para devolver").'
      using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.plt_eventos e where e.card_id = v_card.id and e.tipo = 'pedido_devolvido') then
    raise exception 'Este pedido já foi marcado como devolvido.' using errcode = 'check_violation';
  end if;
  select p.numero into v_numero from public.pedidos p where p.id = v_card.pedido_id;
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
    values (v_card.id, 'pedido_devolvido', v_usuario, 'interface',
            coalesce(nullif(btrim(p_observacao), ''), 'Pedido devolvido na entrega.'),
            jsonb_build_object('fonte', 'plataforma', 'numero', v_numero))
    returning id into v_evento;
  return jsonb_build_object('devolvido', true, 'evento_id', v_evento,
    'pecas_no_estoque', (select count(*) from public.plt_eventos e
                          where e.tipo = 'unidade_desvinculada' and e.evento_referencia_id = v_evento));
end;
$$;

-- ----------------------------------------------------------------------------
-- 7 · As portas que perguntavam "existe entrega?" passam a ler a entrega
--     vigente (recriadas POR INTEIRO a partir da versão viva de cada uma)
-- ----------------------------------------------------------------------------
-- plt_privado.fn_concluir_pedido — da migration 20261008130000_plt_estoque_numeros_prontos.sql: "existe entrega?" → a entrega vigente.
create or replace function plt_privado.fn_concluir_pedido(p_card_pedido_id bigint, p_usuario uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card    public.plt_cards%rowtype;
  v_numero  integer;
  v_aguardo bigint;
  v_total   integer;
  v_u       public.plt_cards%rowtype;
  v_peca    public.plt_cards%rowtype;
  v_novo    bigint;
  v_produto bigint;
  v_ja      integer := 0;
  v_movidas integer := 0;
  v_criadas integer := 0;
  v_usadas  integer := 0;
  v_pulados integer := 0;
  v_marca_m text;
  v_marca_a text;
  it        record;
  k         integer;
begin
  select * into v_card from public.plt_cards
   where id = p_card_pedido_id and tipo = 'pedido'
   for update;
  if not found then
    raise exception 'Card de pedido % não existe.', p_card_pedido_id using errcode = 'no_data_found';
  end if;
  if v_card.arquivado_em is not null then
    raise exception 'Este pedido está arquivado.' using errcode = 'check_violation';
  end if;
  if plt_privado.fn_entregue(v_card.id) then
    raise exception 'Este pedido já foi entregue.' using errcode = 'check_violation';
  end if;
  if v_card.lancado_rotas_em is not null then
    return jsonb_build_object('concluido', false, 'motivo', 'ja_em_rota');
  end if;
  if plt_privado.fn_pedido_cancelado(v_card.pedido_id) then
    raise exception 'Este pedido foi cancelado no Tiny — não dá para concluir.' using errcode = 'check_violation';
  end if;

  select p.numero into v_numero from public.pedidos p where p.id = v_card.pedido_id;
  select s.id into v_aguardo from public.plt_setores s where s.codigo = 'aguardo' and s.ativo;
  if v_aguardo is null then
    raise exception 'Pedidos em aguardo não está cadastrado — fale com o admin.' using errcode = 'no_data_found';
  end if;

  v_total := plt_privado.fn_unidades_do_pedido(v_card.pedido_id);
  if v_total = 0 then
    return jsonb_build_object('concluido', true, 'motivo', 'sem_producao');
  end if;

  v_marca_m := current_setting('plt.estoque_maquinaria', true);
  v_marca_a := current_setting('plt.ajuste_super_admin', true);
  perform set_config('plt.estoque_maquinaria', 'on', true);
  -- SESSAO-30 (raio-x 1): o ajuste do super admin (D-117) passa pela regra
  -- dos fins de linha — ele decide que a peça está pronta.
  perform set_config('plt.ajuste_super_admin', 'on', true);

  for it in
    select v.seq, v.codigo, v.descricao, v.unidades
      from plt_privado.vw_itens_producao v
     where v.pedido_id = v_card.pedido_id and v.unidades >= 1
     order by v.seq
  loop
    for k in 1 .. it.unidades loop
      select * into v_u from public.plt_cards u
       where u.pedido_id = v_card.pedido_id and u.tipo = 'unidade'
         and u.item_seq = it.seq and u.indice_unidade = k
       for update;
      if found then
        if v_u.arquivado_em is not null then
          v_pulados := v_pulados + 1;
          continue;
        end if;
        if v_u.setor_atual_id = v_aguardo then
          v_ja := v_ja + 1;
          continue;
        end if;
        perform plt_privado.fn_fechar_tempo_aberto(v_u.id, 'Concluído pelo super admin: o tempo aberto fecha antes.');
        select * into v_u from public.plt_cards where id = v_u.id;
        insert into public.plt_eventos
            (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id,
             setor_destino_id, etapa_destino_id, observacao, dados)
          values
            (v_u.id, 'movimentacao_setor', p_usuario, 'api', v_u.setor_atual_id, v_u.etapa_atual_id,
             v_aguardo, null, 'Concluído pelo super admin (ajuste da plataforma).',
             jsonb_build_object('ajuste_super_admin', true, 'numero', v_numero));
        v_movidas := v_movidas + 1;
      else
        -- A peça do estoque reservada pela venda para ESTA unidade: usa ela.
        select * into v_peca from public.plt_cards c
         where c.reservada_pedido_id = v_card.pedido_id and c.reservada_item_seq = it.seq
           and c.reservada_indice = k and c.arquivado_em is null
         limit 1
           for update;
        v_produto := case when found then v_peca.produto_tiny_id
                          else plt_privado.fn_produto_do_item(it.codigo, it.descricao) end;

        insert into public.plt_cards
            (tipo, pedido_id, card_pai_id, item_seq, item_codigo, item_descricao,
             indice_unidade, total_unidades, produto_tiny_id, setor_atual_id)
          values
            ('unidade', v_card.pedido_id, v_card.id, it.seq, it.codigo, it.descricao,
             k, it.unidades, v_produto, v_aguardo)
          returning id into v_novo;

        insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_destino_id, observacao, dados)
          values (v_novo, 'card_criado', p_usuario, 'api', v_aguardo,
                  case when v_peca.id is not null
                       then 'Concluído pelo super admin — usou a peça do estoque reservada para o pedido.'
                       else 'Concluído pelo super admin — a peça nasce pronta (ajuste da plataforma).' end,
                  jsonb_build_object('ajuste_super_admin', true, 'numero', v_numero)
                  || case when v_peca.id is not null
                          then jsonb_build_object('alocada_de', v_peca.id, 'reservada', true)
                          else '{}'::jsonb end);

        if v_peca.id is not null then
          insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, observacao, dados)
            values (v_peca.id, 'peca_alocada', p_usuario, 'api', v_peca.setor_atual_id,
                    'Usada pelo pedido ' || coalesce(v_numero::text, '')
                      || format(' (%s/%s) — concluído pelo super admin.', k, it.unidades),
                    jsonb_build_object('pedido_id', v_card.pedido_id, 'numero', v_numero,
                                       'card_pedido_id', v_card.id, 'unidade_card_id', v_novo,
                                       'item_seq', it.seq, 'indice_unidade', k, 'reservada', true));
          v_usadas := v_usadas + 1;
        else
          v_criadas := v_criadas + 1;
        end if;
      end if;
    end loop;
  end loop;

  perform plt_privado.fn_recalcular_liberacao(v_card.pedido_id);
  perform set_config('plt.estoque_maquinaria', coalesce(v_marca_m, ''), true);
  perform set_config('plt.ajuste_super_admin', coalesce(v_marca_a, ''), true);

  return jsonb_build_object('concluido', true, 'numero', v_numero, 'ja_prontas', v_ja,
                            'movidas', v_movidas, 'criadas', v_criadas,
                            'pecas_do_estoque', v_usadas, 'arquivadas_puladas', v_pulados);
end;
$$;

-- public.plt_fn_desprogramar_entrega — da migration 20260908120000_plt_logistica_rotas_caminhoes.sql: "existe entrega?" → a entrega vigente.
create or replace function public.plt_fn_desprogramar_entrega(p_card_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null then
    raise exception 'Só usuário ativo da plataforma mexe na programação.' using errcode = 'insufficient_privilege';
  end if;
  if not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Mexer na programação é gesto da logística (PCP/terminais) ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;
  if plt_privado.fn_entregue(p_card_id) then
    raise exception 'Este pedido já foi entregue — a programação não muda mais.' using errcode = 'check_violation';
  end if;
  delete from public.plt_programacoes where card_id = p_card_id;
end;
$$;

-- public.plt_fn_lancar_rotas — da migration 20260928120000_plt_itens_fora_da_producao.sql: "existe entrega?" → a entrega vigente.
create or replace function public.plt_fn_lancar_rotas(p_card_id bigint)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario   uuid;
  v_card      public.plt_cards%rowtype;
  v_total     integer;
  v_prontas   integer;
  v_rotas     bigint;
  v_evento_id bigint;
  r           record;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null then
    raise exception 'Só usuário ativo da plataforma lança pedidos para ROTAS.' using errcode = 'insufficient_privilege';
  end if;
  if not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Lançar para ROTAS é gesto da logística (PCP/terminais) ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_card from public.plt_cards
   where id = p_card_id and tipo = 'pedido' and arquivado_em is null;
  if not found then
    raise exception 'Card de pedido % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  if v_card.lancado_rotas_em is not null then
    raise exception 'Este pedido já foi lançado para ROTAS.' using errcode = 'check_violation';
  end if;
  if plt_privado.fn_entregue(p_card_id) then
    raise exception 'Este pedido já foi registrado como entregue.' using errcode = 'check_violation';
  end if;
  if plt_privado.fn_pedido_cancelado(v_card.pedido_id) then
    raise exception 'Este pedido foi cancelado no Tiny — não vai para ROTAS.' using errcode = 'check_violation';
  end if;

  -- D-63: frete não conta (fn_unidades_do_pedido).
  v_total := plt_privado.fn_unidades_do_pedido(v_card.pedido_id);
  select count(*)::int into v_prontas
    from public.plt_cards cu
    join public.plt_setores s on s.id = cu.setor_atual_id
   where cu.pedido_id = v_card.pedido_id and cu.tipo = 'unidade'
     and cu.arquivado_em is null and s.papel_no_fluxo = 'terminal';

  -- D-33/D-45: só pedido COMPLETO vai para as ROTAS. D-63: sem nada a
  -- produzir (só frete), o pedido está completo desde que nasceu.
  if v_prontas < v_total then
    raise exception 'Só pedido completo vai para ROTAS: % de % unidade(s) prontas.', v_prontas, v_total
      using errcode = 'check_violation';
  end if;

  select s.id into v_rotas from public.plt_setores s where s.codigo = 'rotas' and s.ativo;
  if v_rotas is null then
    raise exception 'O setor ROTAS não está cadastrado — cadastre-o antes de lançar.' using errcode = 'no_data_found';
  end if;

  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_destino_id, dados)
       values (p_card_id, 'pedido_lancado_rotas', v_usuario, 'interface', v_rotas,
               jsonb_build_object('unidades', v_total))
    returning id into v_evento_id;

  -- As unidades que estão no ESTOQUE (ou noutro terminal) vão de verdade para
  -- a ROTAS — evento normal de movimentação (D-45); saída de terminal não
  -- exige marcação de qualidade (D-25).
  for r in
    select cu.id, cu.setor_atual_id, cu.etapa_atual_id
      from public.plt_cards cu
     where cu.pedido_id = v_card.pedido_id and cu.tipo = 'unidade'
       and cu.arquivado_em is null and cu.setor_atual_id is distinct from v_rotas
  loop
    insert into public.plt_eventos
        (card_id, tipo, usuario_id, origem,
         setor_origem_id, etapa_origem_id, setor_destino_id, etapa_destino_id,
         observacao, dados)
      values
        (r.id, 'movimentacao_setor', v_usuario, 'interface',
         r.setor_atual_id, r.etapa_atual_id, v_rotas, null,
         'Lançado para ROTAS com o pedido completo.',
         jsonb_build_object('lancamento_evento_id', v_evento_id));
  end loop;

  return v_evento_id;
end;
$$;

-- public.plt_fn_ordenar_rota — da migration 20261004120000_plt_rota_calculada.sql: "existe entrega?" → a entrega vigente.
create or replace function public.plt_fn_ordenar_rota(
  p_data        date,
  p_caminhao_id bigint,
  p_card_ids    bigint[]
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario  uuid;
  v_ids      bigint[] := coalesce(p_card_ids, '{}'::bigint[]);
  v_fora     bigint;
  v_entregue bigint;
  v_paradas  integer;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null then
    raise exception 'Só usuário ativo da plataforma mexe na programação.' using errcode = 'insufficient_privilege';
  end if;
  if not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Mexer na programação é gesto da logística (PCP/terminais) ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;
  if p_data is null or p_caminhao_id is null then
    raise exception 'Diga o dia e o caminhão da rota.' using errcode = 'check_violation';
  end if;
  if cardinality(v_ids) > 200 then
    raise exception 'Rota grande demais para ordenar de uma vez.' using errcode = 'check_violation';
  end if;
  if (select count(distinct x) from unnest(v_ids) x) <> cardinality(v_ids)
     or array_position(v_ids, null) is not null then
    raise exception 'A lista de paradas tem pedido repetido ou vazio.' using errcode = 'check_violation';
  end if;

  -- Todo pedido da lista tem de estar programado NESTE dia e caminhão (se a
  -- lista mudou noutra tela, a pessoa recarrega antes de salvar).
  select x into v_fora
    from unnest(v_ids) x
   where not exists (select 1 from public.plt_programacoes pr
                      where pr.card_id = x and pr.data_entrega = p_data and pr.caminhao_id = p_caminhao_id)
   limit 1;
  if v_fora is not null then
    raise exception 'A rota mudou desde que a tela abriu (um pedido não está mais neste dia e caminhão) — recarregue e salve de novo.'
      using errcode = 'check_violation';
  end if;
  -- D-45: depois de entregue, nada muda.
  select x into v_entregue
    from unnest(v_ids) x
   where plt_privado.fn_entregue(x)
   limit 1;
  if v_entregue is not null then
    raise exception 'Um dos pedidos já foi entregue — a ordem dessa rota não muda mais.' using errcode = 'check_violation';
  end if;

  -- Os da lista ganham a posição; os do mesmo dia/caminhão fora da lista (ou
  -- todos, com a lista vazia = "volta à sugestão") ficam sem ordem. Só a linha
  -- que muda é tocada.
  update public.plt_programacoes pr
     set ordem = l.posicao, atualizado_por_id = v_usuario
    from unnest(v_ids) with ordinality as l(card_id, posicao)
   where pr.card_id = l.card_id
     and pr.ordem is distinct from l.posicao::int;
  update public.plt_programacoes pr
     set ordem = null, atualizado_por_id = v_usuario
   where pr.data_entrega = p_data and pr.caminhao_id = p_caminhao_id
     and pr.ordem is not null
     and not (pr.card_id = any (v_ids));

  select count(*)::int into v_paradas
    from public.plt_programacoes pr
   where pr.data_entrega = p_data and pr.caminhao_id = p_caminhao_id;

  -- D-40: o gesto inteiro vira UMA linha na trilha.
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
  values (v_usuario, 'rota_ordem_salva', jsonb_build_object(
    'data', p_data,
    'caminhao_id', p_caminhao_id,
    'card_ids', to_jsonb(v_ids),
    'paradas', v_paradas,
    'automatica', cardinality(v_ids) = 0));

  return cardinality(v_ids);
end;
$$;

-- public.plt_fn_pcp_todos_pedidos — da migration 20261008120000_plt_entregue_fecha_tudo.sql: "existe entrega?" → a entrega vigente.
create or replace function public.plt_fn_pcp_todos_pedidos(
  p_busca        text    default null,
  p_antes_numero integer default null,
  p_limite       integer default 20
)
returns table (
  pedido_id               bigint,
  numero                  integer,
  cliente_nome            text,
  data_pedido             date,
  data_prevista           date,
  situacao                text,
  total_unidades          integer,
  unidades_liberadas      integer,
  alterado_apos_liberacao boolean,
  card_id                 bigint,
  situacao_plataforma     text,
  tem_mais                boolean,
  contagem_total          integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with cfg as (
    select least(greatest(coalesce(p_limite, 20), 1), 100) as limite,
           nullif(btrim(coalesce(p_busca, '')), '')       as busca
  ),
  pagina as (
    select p.id, p.numero, p.cliente_id, p.data_pedido, p.data_prevista, p.situacao,
           c.nome as cliente_nome
      from public.pedidos p
      left join public.clientes c on c.id = p.cliente_id
      cross join cfg
     where plt_privado.fn_pode_ver_expedicao()
       and (p_antes_numero is null or p.numero < p_antes_numero)
       and (cfg.busca is null
            or p.numero::text like cfg.busca || '%'
            or c.nome ilike '%' || cfg.busca || '%')
     order by p.numero desc
     limit (select limite + 1 from cfg)
  ),
  numerada as (
    select pg.*, row_number() over (order by pg.numero desc) as n from pagina pg
  )
  select nu.id                                   as pedido_id,
         nu.numero,
         coalesce(nu.cliente_nome, '')           as cliente_nome,
         nu.data_pedido,
         nu.data_prevista,
         nu.situacao,
         coalesce(i.total_unidades, 0)           as total_unidades,
         coalesce(u.liberadas, 0)                as unidades_liberadas,
         exists (select 1 from public.plt_eventos e
                  where e.card_id = pc.id and e.tipo = 'pedido_atualizado')
                                                 as alterado_apos_liberacao,
         pc.id                                   as card_id,
         case
           when pc.id is null then 'sem_card'
           when pc.entrega_evento_id is not null then 'entregue'
           when pc.arquivado_em is not null then 'arquivado'
           when pc.lancado_rotas_em is not null then 'em_rota'
           when coalesce(i.total_unidades, 0) > 0 and coalesce(u.prontas, 0) >= i.total_unidades then 'aguardo'
           when coalesce(u.liberadas, 0) > 0 then 'producao'
           else 'pcp'
         end                                     as situacao_plataforma,
         (select count(*) from pagina) > (select limite from cfg) as tem_mais,
         case when p_antes_numero is null then (
           select count(*)::int from (
             select 1
               from public.pedidos p2
               left join public.clientes c2 on c2.id = p2.cliente_id
               cross join cfg
              where cfg.busca is null
                 or p2.numero::text like cfg.busca || '%'
                 or c2.nome ilike '%' || cfg.busca || '%'
              limit 10001) x
         ) end                                   as contagem_total
    from numerada nu
    left join public.plt_cards pc on pc.pedido_id = nu.id and pc.tipo = 'pedido'
    left join lateral (
      -- D-63: o frete não conta como unidade (vw_itens_producao).
      select coalesce(sum(v.unidades), 0)::int as total_unidades
        from plt_privado.vw_itens_producao v
       where v.pedido_id = nu.id
    ) i on true
    left join lateral (
      select count(*) filter (where not exists (select 1 from plt_privado.vw_itens_producao v
                                                 where v.pedido_id = cu.pedido_id and v.seq = cu.item_seq and v.eh_frete))::int
               as liberadas,
             count(*) filter (where cu.arquivado_em is null and s.papel_no_fluxo = 'terminal')::int
               as prontas
        from public.plt_cards cu
        left join public.plt_setores s on s.id = cu.setor_atual_id
       where cu.pedido_id = nu.id and cu.tipo = 'unidade'
    ) u on true
   where nu.n <= (select limite from cfg)
   order by nu.numero desc;
$$;

-- public.plt_fn_programacao — da migration 20261004130000_plt_rotas_programadas_itens.sql: "existe entrega?" → a entrega vigente.
create or replace function public.plt_fn_programacao(
  p_data               date    default null,
  p_limite             integer default 100,
  p_deslocamento       integer default 0,
  p_so_sem_programacao boolean default false
)
returns table (
  card_id                 bigint,
  pedido_id               bigint,
  numero                  integer,
  cliente_nome            text,
  endereco                text,
  numero_endereco         text,
  complemento             text,
  bairro                  text,
  cidade                  text,
  uf                      text,
  endereco_geocodificavel text,
  geo_chave               text,
  latitude                double precision,
  longitude               double precision,
  geo_resolvido           boolean,
  geo_consultado_em       timestamptz,
  total_unidades          integer,
  itens                   jsonb,
  data_prevista           date,
  lancado_em              timestamptz,
  programacao_data        date,
  caminhao_id             bigint,
  caminhao_nome           text,
  ordem                   integer,
  contagem_total          bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with base as (
    select pc.id                        as card_id,
           p.id                         as pedido_id,
           p.numero,
           coalesce(c.nome, '')         as cliente_nome,
           c.endereco,
           c.numero                     as numero_endereco,
           c.complemento,
           c.bairro,
           c.cidade,
           c.uf,
           plt_privado.fn_endereco_geocodificavel(
             c.endereco, c.numero, c.bairro, c.cidade, c.uf, c.cep) as endereco_geocodificavel,
           coalesce(i.total_unidades, 0) as total_unidades,
           coalesce(i.itens, '[]'::jsonb) as itens,
           p.data_prevista,
           pc.lancado_rotas_em           as lancado_em,
           pr.data_entrega               as programacao_data,
           cam.id                        as caminhao_id,
           cam.nome                      as caminhao_nome,
           pr.ordem                      as ordem
      from public.plt_cards pc
      join public.pedidos p on p.id = pc.pedido_id
      left join public.clientes c on c.id = p.cliente_id
      left join lateral (
        -- D-63: frete não conta nem aparece; os móveis com a quantidade.
        select coalesce(sum(v.unidades), 0)::int as total_unidades,
               jsonb_agg(jsonb_build_object('descricao', coalesce(nullif(btrim(v.descricao), ''), 'Item sem descrição'),
                                            'quantidade', v.unidades) order by v.seq)
                 filter (where not v.eh_frete and v.unidades > 0) as itens
          from plt_privado.vw_itens_producao v where v.pedido_id = p.id
      ) i on true
      left join public.plt_programacoes pr on pr.card_id = pc.id
      left join public.plt_caminhoes cam on cam.id = pr.caminhao_id
     where pc.tipo = 'pedido' and pc.arquivado_em is null
       and pc.lancado_rotas_em is not null
       and not pc.entrega_evento_id is not null
  )
  select b.card_id, b.pedido_id, b.numero, b.cliente_nome,
         b.endereco, b.numero_endereco, b.complemento, b.bairro, b.cidade, b.uf,
         b.endereco_geocodificavel,
         case when b.endereco_geocodificavel is null then null
              else md5(lower(b.endereco_geocodificavel)) end as geo_chave,
         g.latitude, g.longitude,
         g.resolvido       as geo_resolvido,
         g.consultado_em   as geo_consultado_em,
         b.total_unidades, b.itens, b.data_prevista, b.lancado_em,
         b.programacao_data, b.caminhao_id, b.caminhao_nome,
         b.ordem,
         count(*) over () as contagem_total
    from base b
    left join public.plt_geocache g
           on b.endereco_geocodificavel is not null
          and g.chave = md5(lower(b.endereco_geocodificavel))
   where plt_privado.fn_pode_ver_expedicao()
     and (b.programacao_data is null
          or (not coalesce(p_so_sem_programacao, false)
              and (p_data is null or b.programacao_data = p_data)))
   order by (b.programacao_data is not null), b.data_prevista asc nulls last, b.numero
   limit least(greatest(coalesce(p_limite, 100), 1), 200)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

-- public.plt_fn_programadas — da migration 20261004130000_plt_rotas_programadas_itens.sql: "existe entrega?" → a entrega vigente.
create or replace function public.plt_fn_programadas(
  p_entregues    boolean default false,
  p_data         date    default null,
  p_caminhao_id  bigint  default null,
  p_limite       integer default 50,
  p_deslocamento integer default 0
)
returns table (
  card_id                 bigint,
  pedido_id               bigint,
  numero                  integer,
  cliente_nome            text,
  endereco                text,
  numero_endereco         text,
  complemento             text,
  bairro                  text,
  cidade                  text,
  uf                      text,
  geo_chave               text,
  latitude                double precision,
  longitude               double precision,
  geo_resolvido           boolean,
  total_unidades          integer,
  itens                   jsonb,
  data_prevista           date,
  programacao_data        date,
  caminhao_id             bigint,
  caminhao_nome           text,
  caminhao_placa          text,
  ordem                   integer,
  entregue_em             timestamptz,
  contagem_total          bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with base as (
    select pc.id                         as card_id,
           p.id                          as pedido_id,
           p.numero,
           coalesce(c.nome, '')          as cliente_nome,
           c.endereco,
           c.numero                      as numero_endereco,
           c.complemento,
           c.bairro,
           c.cidade,
           c.uf,
           plt_privado.fn_endereco_geocodificavel(
             c.endereco, c.numero, c.bairro, c.cidade, c.uf, c.cep) as endereco_geocodificavel,
           coalesce(i.total_unidades, 0) as total_unidades,
           coalesce(i.itens, '[]'::jsonb) as itens,
           p.data_prevista,
           pr.data_entrega               as programacao_data,
           cam.id                        as caminhao_id,
           cam.nome                      as caminhao_nome,
           cam.placa                     as caminhao_placa,
           pr.ordem,
           ent.ocorrido_em               as entregue_em
      from public.plt_programacoes pr
      join public.plt_cards pc on pc.id = pr.card_id
      join public.pedidos p on p.id = pc.pedido_id
      left join public.clientes c on c.id = p.cliente_id
      left join public.plt_caminhoes cam on cam.id = pr.caminhao_id
      left join lateral (
        select e.ocorrido_em from public.plt_eventos e
         where e.id = pc.entrega_evento_id
         order by e.ocorrido_em desc limit 1
      ) ent on true
      left join lateral (
        select coalesce(sum(v.unidades), 0)::int as total_unidades,
               jsonb_agg(jsonb_build_object('descricao', coalesce(nullif(btrim(v.descricao), ''), 'Item sem descrição'),
                                            'quantidade', v.unidades) order by v.seq)
                 filter (where not v.eh_frete and v.unidades > 0) as itens
          from plt_privado.vw_itens_producao v where v.pedido_id = p.id
      ) i on true
     where pc.tipo = 'pedido' and pc.arquivado_em is null
       and (p_data is null or pr.data_entrega = p_data)
       and (p_caminhao_id is null or pr.caminhao_id = p_caminhao_id)
       and (case when coalesce(p_entregues, false) then ent.ocorrido_em is not null
                 else ent.ocorrido_em is null end)
  )
  select b.card_id, b.pedido_id, b.numero, b.cliente_nome,
         b.endereco, b.numero_endereco, b.complemento, b.bairro, b.cidade, b.uf,
         case when b.endereco_geocodificavel is null then null
              else md5(lower(b.endereco_geocodificavel)) end as geo_chave,
         g.latitude, g.longitude, g.resolvido as geo_resolvido,
         b.total_unidades, b.itens, b.data_prevista,
         b.programacao_data, b.caminhao_id, b.caminhao_nome, b.caminhao_placa,
         b.ordem, b.entregue_em,
         count(*) over () as contagem_total
    from base b
    left join public.plt_geocache g
           on b.endereco_geocodificavel is not null
          and g.chave = md5(lower(b.endereco_geocodificavel))
   where plt_privado.fn_pode_ver_expedicao()
   order by case when coalesce(p_entregues, false) then null else b.programacao_data end asc,
            case when coalesce(p_entregues, false) then b.programacao_data end desc,
            b.caminhao_nome, b.caminhao_id, b.ordem nulls last, b.numero
   limit least(greatest(coalesce(p_limite, 50), 1), 200)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

-- public.plt_fn_programar_entrega — da migration 20261004120000_plt_rota_calculada.sql: "existe entrega?" → a entrega vigente.
create or replace function public.plt_fn_programar_entrega(
  p_card_id     bigint,
  p_data        date,
  p_caminhao_id bigint
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
  v_card    public.plt_cards%rowtype;
  v_id      bigint;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null then
    raise exception 'Só usuário ativo da plataforma programa entregas.' using errcode = 'insufficient_privilege';
  end if;
  if not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Programar entrega é gesto da logística (PCP/terminais) ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;
  if p_data is null then
    raise exception 'Escolha o dia da entrega.' using errcode = 'check_violation';
  end if;

  select * into v_card from public.plt_cards
   where id = p_card_id and tipo = 'pedido' and arquivado_em is null;
  if not found then
    raise exception 'Card de pedido % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  if v_card.lancado_rotas_em is null then
    raise exception 'Este pedido ainda não foi lançado para ROTAS.' using errcode = 'check_violation';
  end if;
  -- D-45: reprograma a qualquer instante, nunca depois de entregue.
  if plt_privado.fn_entregue(p_card_id) then
    raise exception 'Este pedido já foi entregue — a programação não muda mais.' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.plt_caminhoes cm
                  where cm.id = p_caminhao_id and cm.arquivado_em is null) then
    raise exception 'Caminhão não encontrado ou arquivado — escolha outro.' using errcode = 'no_data_found';
  end if;

  insert into public.plt_programacoes as pr
         (card_id, data_entrega, caminhao_id, criado_por_id, atualizado_por_id)
       values (p_card_id, p_data, p_caminhao_id, v_usuario, v_usuario)
  on conflict (card_id) do update
     set data_entrega = excluded.data_entrega,
         caminhao_id  = excluded.caminhao_id,
         atualizado_por_id = excluded.atualizado_por_id,
         -- SESSAO-28 (D-109): noutro dia/caminhão a ordem antiga não vale —
         -- a parada vai para o fim da rota nova.
         ordem = case when pr.data_entrega is distinct from excluded.data_entrega
                        or pr.caminhao_id  is distinct from excluded.caminhao_id
                      then null else pr.ordem end
  returning id into v_id;
  return v_id;
end;
$$;

-- public.plt_fn_rotas — da migration 20260928120000_plt_itens_fora_da_producao.sql: "existe entrega?" → a entrega vigente.
create or replace function public.plt_fn_rotas(
  p_situacao      text default null, -- 'pronta' | 'entregue'
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
  lancado_em        timestamptz,
  programacao_data  date,
  caminhao_id       bigint,
  caminhao_nome     text,
  caminhao_placa    text,
  caminhao_foto     text,
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
           ent_nome.nome                 as entregue_por,
           pc.lancado_rotas_em           as lancado_em,
           pr.data_entrega               as programacao_data,
           cam.id                        as caminhao_id,
           cam.nome                      as caminhao_nome,
           cam.placa                     as caminhao_placa,
           cam.foto_caminho              as caminhao_foto
      from public.plt_cards pc
      join public.pedidos p on p.id = pc.pedido_id
      left join public.clientes c on c.id = p.cliente_id
      left join lateral (
        -- D-63: frete não conta.
        select coalesce(sum(v.unidades), 0)::int as total_unidades
          from plt_privado.vw_itens_producao v where v.pedido_id = p.id
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
         where e.id = pc.entrega_evento_id
         order by e.ocorrido_em desc limit 1
      ) ent on true
      left join public.plt_usuarios ent_nome on ent_nome.id = ent.usuario_id
      left join public.plt_programacoes pr on pr.card_id = pc.id
      left join public.plt_caminhoes cam on cam.id = pr.caminhao_id
     where pc.tipo = 'pedido' and pc.arquivado_em is null
       and pc.lancado_rotas_em is not null   -- D-45: só o lançado
  )
  select b.card_id, b.pedido_id, b.numero, b.cliente_nome, b.telefone,
         b.endereco, b.numero_endereco, b.complemento, b.bairro, b.cidade, b.uf,
         b.obs, b.data_prevista, b.total_unidades, b.unidades_em_rotas,
         case when b.entregue_em is not null then 'entregue' else 'pronta' end as situacao_entrega,
         b.entregue_em, b.entregue_por, b.lancado_em,
         b.programacao_data, b.caminhao_id, b.caminhao_nome, b.caminhao_placa, b.caminhao_foto,
         count(*) over () as contagem_total
    from base b
   where plt_privado.fn_pode_ver_expedicao()
     and (p_situacao is null
          or (case when b.entregue_em is not null then 'entregue' else 'pronta' end) = p_situacao)
     and (p_busca is null or btrim(p_busca) = ''
          or b.numero::text like btrim(p_busca) || '%'
          or b.cliente_nome ilike '%' || btrim(p_busca) || '%')
   order by (b.entregue_em is not null),
            coalesce(b.programacao_data, b.data_prevista) asc nulls last,
            b.numero
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

-- plt_privado.fn_fechar_pedido — da migration 20261008130000_plt_estoque_numeros_prontos.sql: a entrega vigente.
create or replace function plt_privado.fn_fechar_pedido(
  p_card_pedido_id bigint,
  p_usuario        uuid,
  p_origem         text,
  p_observacao     text,
  p_fonte          text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card      public.plt_cards%rowtype;
  v_numero    integer;
  v_situacao  text;
  v_entrega   bigint;
  v_nova      boolean := false;
  v_vivas     integer;
  v_unidades  integer := 0;
  v_tempos    integer := 0;
  v_reservas  integer := 0;
  v_card_saiu boolean := false;
  v_marca_e   text;
  v_marca_m   text;
  r           record;
begin
  select * into v_card from public.plt_cards
   where id = p_card_pedido_id and tipo = 'pedido'
   for update;
  if not found then
    raise exception 'Card de pedido % não existe.', p_card_pedido_id using errcode = 'no_data_found';
  end if;
  select p.numero, p.situacao into v_numero, v_situacao
    from public.pedidos p where p.id = v_card.pedido_id;

  select count(*)::int into v_vivas
    from public.plt_cards u
   where u.pedido_id = v_card.pedido_id and u.tipo = 'unidade' and u.arquivado_em is null;

  -- Card já arquivado e nada vivo: história antiga — nada a fechar.
  if v_card.arquivado_em is not null and v_vivas = 0
     and not exists (select 1 from public.plt_cards s
                      where s.reservada_pedido_id = v_card.pedido_id and s.arquivado_em is null) then
    return jsonb_build_object('fechou', false, 'motivo', 'arquivado', 'numero', v_numero);
  end if;

  v_marca_e := current_setting('plt.entrega_maquinaria', true);
  v_marca_m := current_setting('plt.estoque_maquinaria', true);
  perform set_config('plt.entrega_maquinaria', 'on', true);
  -- SESSAO-30 (raio-x 2): a peça do estoque reservada sai com o pedido.
  perform set_config('plt.estoque_maquinaria', 'on', true);

  -- SESSAO-30 (etapa 4): a entrega VIGENTE (a desfeita não conta).
  v_entrega := v_card.entrega_evento_id;
  if v_entrega is null then
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
      values (v_card.id, 'pedido_entregue', p_usuario, p_origem,
              nullif(btrim(p_observacao), ''),
              jsonb_build_object('fonte', p_fonte, 'numero', v_numero,
                                 'situacao_tiny', v_situacao, 'unidades', v_vivas,
                                 'lancado_rotas', v_card.lancado_rotas_em is not null))
      returning id into v_entrega;
    v_nova := true;
  end if;

  -- Cada peça viva do pedido sai de toda conta (estoque, reservas, ROTAS ativa,
  -- Visão do dia) e fica no histórico — o tempo aberto fecha antes.
  for r in
    select c.id from public.plt_cards c
     where c.pedido_id = v_card.pedido_id and c.tipo = 'unidade' and c.arquivado_em is null
     order by c.id
       for update
  loop
    if plt_privado.fn_fechar_tempo_aberto(r.id, 'O pedido foi entregue: o tempo aberto fecha antes de a peça sair.') then
      v_tempos := v_tempos + 1;
    end if;
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
      values (r.id, 'card_arquivado', p_usuario, p_origem,
              'Pedido ' || coalesce(v_numero::text, '') || ' entregue — a peça saiu com ele.',
              jsonb_build_object('motivo', 'entregue', 'entrega_evento_id', v_entrega,
                                 'fonte', p_fonte, 'numero', v_numero));
    v_unidades := v_unidades + 1;
  end loop;

  -- A peça do ESTOQUE reservada pela venda sai com o pedido (motivo "venda" —
  -- a mesma baixa da D-78; não volta ao Tiny, que já baixou na venda).
  for r in
    select c.id, c.setor_atual_id, c.reservada_item_seq, c.reservada_indice, c.produto_tiny_id
      from public.plt_cards c
     where c.reservada_pedido_id = v_card.pedido_id and c.arquivado_em is null
     order by c.id
       for update
  loop
    insert into public.plt_eventos (card_id, tipo, origem, setor_origem_id, observacao, dados)
      values (r.id, 'card_arquivado', 'api', r.setor_atual_id,
              format('Saiu com o pedido %s (entregue).', v_numero),
              jsonb_build_object('motivo', 'venda', 'pedido_id', v_card.pedido_id, 'numero', v_numero,
                                 'item_seq', r.reservada_item_seq, 'indice_unidade', r.reservada_indice,
                                 'produto_tiny_id', r.produto_tiny_id, 'entrega_evento_id', v_entrega));
    v_reservas := v_reservas + 1;
  end loop;

  -- O card do pedido que nunca foi às ROTAS sai do PCP (o lançado fica: é o
  -- registro da entrega em ROTAS → Entregas e em "Já programadas").
  if v_card.lancado_rotas_em is null and v_card.arquivado_em is null then
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
      values (v_card.id, 'card_arquivado', p_usuario, p_origem,
              'Pedido entregue — sai do PCP.',
              jsonb_build_object('motivo', 'entregue', 'entrega_evento_id', v_entrega,
                                 'fonte', p_fonte, 'numero', v_numero));
    v_card_saiu := true;
  end if;

  perform set_config('plt.entrega_maquinaria', coalesce(v_marca_e, ''), true);
  perform set_config('plt.estoque_maquinaria', coalesce(v_marca_m, ''), true);
  return jsonb_build_object('fechou', true, 'numero', v_numero, 'entrega_evento_id', v_entrega,
                            'entrega_nova', v_nova, 'unidades', v_unidades,
                            'tempos_fechados', v_tempos, 'reservas', v_reservas,
                            'card_saiu_do_pcp', v_card_saiu);
end;
$$;

-- ----------------------------------------------------------------------------
-- 8 · Permissões: maquinaria fora da API (E-11); portas para authenticated;
--     o retorno do n8n só com a chave de serviço
-- ----------------------------------------------------------------------------
revoke all on function plt_privado.fn_projetar_entrega()                        from public, anon, authenticated;
revoke all on function plt_privado.fn_entregue(bigint)                          from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_situacao_api(text)                   from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_entrega_desde()                      from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_pedido_pausado()                     from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_pedido_agendar(boolean)              from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_pedido_chamar(bigint)                from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_pedido_enfileirar(bigint, text, text) from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_pedido_relogio()                     from public, anon, authenticated;
revoke all on function plt_privado.fn_pode_mexer_entrega(bigint)                from public, anon, authenticated;
revoke all on function plt_privado.fn_pedido_cancelado(bigint)                  from public, anon, authenticated;

revoke all on function public.plt_fn_motivos(text, boolean)                     from public, anon;
grant execute on function public.plt_fn_motivos(text, boolean)                  to authenticated;
revoke all on function public.plt_fn_motivo_salvar(bigint, text, text, integer, boolean) from public, anon;
grant execute on function public.plt_fn_motivo_salvar(bigint, text, text, integer, boolean) to authenticated;
revoke all on function public.plt_fn_tiny_entrega_situacao()                   from public, anon;
grant execute on function public.plt_fn_tiny_entrega_situacao()                to authenticated;
revoke all on function public.plt_fn_tiny_entrega_ligar(boolean)               from public, anon;
grant execute on function public.plt_fn_tiny_entrega_ligar(boolean)            to authenticated;
revoke all on function public.plt_fn_tiny_entrega_reenviar(bigint)             from public, anon;
grant execute on function public.plt_fn_tiny_entrega_reenviar(bigint)          to authenticated;
revoke all on function public.plt_fn_registrar_entrega(bigint, text)           from public, anon;
grant execute on function public.plt_fn_registrar_entrega(bigint, text)        to authenticated;
revoke all on function public.plt_fn_entrega_desfazer(bigint, bigint, text)    from public, anon;
grant execute on function public.plt_fn_entrega_desfazer(bigint, bigint, text) to authenticated;
revoke all on function public.plt_fn_entrega_nao_realizada(bigint, bigint, text) from public, anon;
grant execute on function public.plt_fn_entrega_nao_realizada(bigint, bigint, text) to authenticated;
revoke all on function public.plt_fn_entrega_devolvida(bigint, text)           from public, anon;
grant execute on function public.plt_fn_entrega_devolvida(bigint, text)        to authenticated;
revoke all on function public.plt_fn_tiny_pedido_resultado(bigint, integer, boolean, text) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.plt_fn_tiny_pedido_resultado(bigint, integer, boolean, text) to service_role;
  end if;
end;
$$;
