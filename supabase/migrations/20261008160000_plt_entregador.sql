-- ============================================================================
-- SESSAO-30 · etapa 5 — o entregador (D-115)
--
-- 1. O ENTREGADOR é uma pessoa ligada à ROTAS com o módulo "entregas" e SEM o
--    módulo da fábrica: vê só "Entregas do dia". As portas da logística
--    (fn_pode_ver_expedicao, fn_eh_logistica) passam a exigir o módulo da
--    fábrica de quem não é admin (todos os de hoje têm — conferido).
-- 2. A EQUIPE de cada caminhão no dia (um ou mais entregadores), escolhida por
--    quem programa (logística/admin).
-- 3. O DETALHE da entrega na programação ("cliente só recebe depois das 10h").
-- 4. A tela "Entregas do dia" numa requisição: os caminhões do dia da pessoa,
--    as entregas na ordem salva, com cliente, endereço + ponto do mapa,
--    móveis, VOLUMES (cadastro do Tiny; vazio = 1), observação, detalhe,
--    comprovantes e comentários.
-- 5. Os gestos da entrega (entregue, não entregue, devolvido, desfazer,
--    comentário, comprovante) abrem também ao entregador da equipe do caminhão.
-- 6. ANEXOS (base genérica — a SESSAO-31 usa no card): o arquivo sobe direto
--    ao armário PRIVADO (storage), o banco registra; leitura por link assinado.
-- 7. ↩️ E-89: desfazer só a entrega feita por gente (a do Tiny se mexe lá);
--    "Entregue" tocado duas vezes pela mesma pessoa = uma entrega só.
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · Fatos novos: comentário e anexo (lista inteira — a da migration 59 + 2)
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
      'card_criado', 'movimentacao_setor', 'movimentacao_etapa',
      'execucao_iniciada', 'execucao_finalizada', 'execucao_pausada', 'execucao_retomada',
      'qualidade_marcada', 'qualidade_parecer', 'divergencia_registrada', 'notificacao_enviada',
      'delegacao', 'estorno', 'pedido_atualizado', 'pedido_cancelado', 'card_arquivado',
      'pedido_entregue', 'pedido_lancado_rotas', 'unidade_desvinculada', 'peca_alocada',
      'peca_reservada', 'peca_reserva_desfeita', 'estoque_reserva_avaliada',
      'etiqueta_adicionada', 'etiqueta_removida', 'card_desarquivado',
      'entrega_desfeita', 'entrega_nao_realizada', 'pedido_devolvido',
      'comentario_adicionado',     -- SESSAO-30 (D-115): comentário no card (o entregador, a logística)
      'anexo_adicionado'           -- SESSAO-30 (D-115): comprovante/arquivo no card
    )) not valid;
end;
$$;
alter table public.plt_eventos validate constraint plt_eventos_tipo_check;

-- ----------------------------------------------------------------------------
-- 2 · Quem é quem: logística (com o módulo da fábrica) × entregador
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_pode_ver_expedicao()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select plt_privado.fn_eh_admin()
      or exists (
           select 1
             from public.plt_usuario_setores us
             join public.plt_usuarios u on u.id = us.usuario_id
             join public.plt_setores s on s.id = us.setor_id
            where u.auth_user_id = auth.uid()
              and u.ativo
              -- SESSAO-30: o entregador (módulo "entregas" sem o da fábrica) não é logística
              and not ('entregas' = any (u.modulos) and not 'fabrica' = any (u.modulos))
              and s.papel_no_fluxo in ('entrada', 'terminal')
         );
$$;

comment on function plt_privado.fn_pode_ver_expedicao() is
  'Expedição/logística (D-01/D-22): admin, gente da entrada (PCP) e dos terminais COM o módulo da fábrica. SESSAO-30 (D-115): o entregador (módulo "entregas" sem a fábrica) fica de fora — ele vê só as entregas do dia.';

-- Quem é logística (recriada POR INTEIRO a partir da migration 20260908120000): + o módulo da fábrica.
create or replace function plt_privado.fn_eh_logistica(p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.plt_usuarios u
                  where u.id = p_usuario and u.ativo and u.papel = 'admin')
      or exists (select 1
                   from public.plt_usuario_setores us
                   join public.plt_usuarios u on u.id = us.usuario_id and u.ativo
                   join public.plt_setores  s on s.id = us.setor_id
                  where us.usuario_id = p_usuario
                    -- SESSAO-30: o entregador (módulo entregas sem o da fábrica) não é logística
                    and not ('entregas' = any (u.modulos) and not 'fabrica' = any (u.modulos))
                    and s.papel_no_fluxo in ('entrada', 'terminal'));
$$;

create or replace function plt_privado.fn_eh_entregador(p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.plt_usuarios u
                  where u.id = p_usuario and u.ativo and 'entregas' = any (u.modulos));
$$;

comment on function plt_privado.fn_eh_entregador(uuid) is
  'SESSAO-30 (D-115): a pessoa tem o módulo "entregas" (o entregador; o admin pode ter também).';

-- Tornar (ou deixar de ser) entregador — o admin, na Equipe.
create or replace function public.plt_fn_usuario_entregador(p_usuario_id uuid, p_entregador boolean)
returns text[]
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_u      public.plt_usuarios%rowtype;
  v_rotas  bigint;
  v_mods   text[];
begin
  if not plt_privado.fn_eh_admin() then
    raise exception 'Definir o entregador é gesto de admin.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_u from public.plt_usuarios where id = p_usuario_id for update;
  if not found then
    raise exception 'Pessoa não encontrada.' using errcode = 'no_data_found';
  end if;
  if v_u.papel = 'admin' and p_entregador then
    raise exception 'O admin já vê tudo — o tipo entregador é para quem só faz entregas.' using errcode = 'check_violation';
  end if;
  select s.id into v_rotas from public.plt_setores s where s.codigo = 'rotas';
  if p_entregador then
    v_mods := array['entregas'];
    insert into public.plt_usuario_setores (usuario_id, setor_id)
      select v_u.id, v_rotas where v_rotas is not null
    on conflict do nothing;
  else
    v_mods := array_remove(coalesce(v_u.modulos, '{}'::text[]), 'entregas');
    if not ('fabrica' = any (v_mods)) then
      v_mods := array_append(v_mods, 'fabrica');
    end if;
  end if;
  update public.plt_usuarios set modulos = v_mods where id = v_u.id;
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (plt_privado.fn_usuario_atual(), case when p_entregador then 'usuario_virou_entregador' else 'usuario_deixou_entregador' end,
            jsonb_build_object('usuario_id', v_u.id, 'nome', v_u.nome, 'modulos', to_jsonb(v_mods)));
  return v_mods;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3 · A equipe de cada caminhão no dia (D-115)
-- ----------------------------------------------------------------------------
create table if not exists public.plt_programacao_equipes (
  data_entrega  date   not null,
  caminhao_id   bigint not null references public.plt_caminhoes (id),
  usuario_id    uuid   not null references public.plt_usuarios (id),
  definido_por  uuid references public.plt_usuarios (id),
  definido_em   timestamptz not null default now(),
  primary key (data_entrega, caminhao_id, usuario_id)
);
create index if not exists plt_programacao_equipes_usuario_idx on public.plt_programacao_equipes (usuario_id, data_entrega);
create index if not exists plt_programacao_equipes_caminhao_idx on public.plt_programacao_equipes (caminhao_id);
alter table public.plt_programacao_equipes enable row level security;
revoke all on table public.plt_programacao_equipes from public, anon, authenticated;
comment on table public.plt_programacao_equipes is
  'SESSAO-30 (D-115): quem leva o caminhão naquele dia (um ou mais entregadores) — escolhido por quem programa. Só pelas portas.';

-- Quem pode ser escolhido: entregador ou gente da ROTAS, ativo.
create or replace function public.plt_fn_entregadores()
returns table (id uuid, nome text, foto_caminho text, entregador boolean)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.id, u.nome, u.foto_caminho, 'entregas' = any (u.modulos)
    from public.plt_usuarios u
   where plt_privado.fn_pode_ver_expedicao()
     and u.ativo
     and ('entregas' = any (u.modulos)
          or exists (select 1 from public.plt_usuario_setores us join public.plt_setores s on s.id = us.setor_id
                      where us.usuario_id = u.id and s.codigo = 'rotas'))
   order by ('entregas' = any (u.modulos)) desc, u.nome
   limit 200;
$$;

create or replace function public.plt_fn_equipes_do_dia(p_data date)
returns table (caminhao_id bigint, usuario_id uuid, nome text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select e.caminhao_id, e.usuario_id, u.nome
    from public.plt_programacao_equipes e
    join public.plt_usuarios u on u.id = e.usuario_id
   where plt_privado.fn_pode_ver_expedicao() and e.data_entrega = p_data
   order by e.caminhao_id, u.nome;
$$;

create or replace function public.plt_fn_equipe_definir(p_data date, p_caminhao_id bigint, p_usuarios uuid[])
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quem uuid;
  v_n    integer;
begin
  v_quem := plt_privado.fn_usuario_atual();
  if v_quem is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Escolher a equipe do caminhão é gesto da logística ou de admin.' using errcode = 'insufficient_privilege';
  end if;
  if p_data is null or p_caminhao_id is null then
    raise exception 'Escolha o dia e o caminhão.' using errcode = 'check_violation';
  end if;
  if coalesce(array_length(p_usuarios, 1), 0) > 10 then
    raise exception 'No máximo 10 pessoas por caminhão.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from unnest(coalesce(p_usuarios, '{}'::uuid[])) x
              where not exists (select 1 from public.plt_usuarios u where u.id = x and u.ativo)) then
    raise exception 'Alguém escolhido não está ativo na plataforma.' using errcode = 'check_violation';
  end if;
  delete from public.plt_programacao_equipes
   where data_entrega = p_data and caminhao_id = p_caminhao_id
     and not (usuario_id = any (coalesce(p_usuarios, '{}'::uuid[])));
  insert into public.plt_programacao_equipes (data_entrega, caminhao_id, usuario_id, definido_por)
    select p_data, p_caminhao_id, x, v_quem from unnest(coalesce(p_usuarios, '{}'::uuid[])) x
  on conflict do nothing;
  select count(*)::int into v_n from public.plt_programacao_equipes where data_entrega = p_data and caminhao_id = p_caminhao_id;
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_quem, 'equipe_caminhao_definida',
            jsonb_build_object('data', p_data, 'caminhao_id', p_caminhao_id, 'usuarios', to_jsonb(coalesce(p_usuarios, '{}'::uuid[]))));
  return v_n;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4 · O detalhe da entrega, na programação
-- ----------------------------------------------------------------------------
alter table public.plt_programacoes add column if not exists detalhe text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'plt_programacoes_detalhe_ck') then
    alter table public.plt_programacoes add constraint plt_programacoes_detalhe_ck
      check (detalhe is null or char_length(detalhe) <= 300);
  end if;
end;
$$;
comment on column public.plt_programacoes.detalhe is
  'SESSAO-30 (D-115): o detalhe da entrega escrito por quem programa ("cliente só recebe depois das 10h") — o entregador vê no card.';

create or replace function public.plt_fn_programacao_detalhe(p_card_id bigint, p_detalhe text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Escrever o detalhe da entrega é gesto da logística ou de admin.' using errcode = 'insufficient_privilege';
  end if;
  if char_length(coalesce(p_detalhe, '')) > 300 then
    raise exception 'O detalhe da entrega tem no máximo 300 letras.' using errcode = 'check_violation';
  end if;
  update public.plt_programacoes set detalhe = nullif(btrim(p_detalhe), '') where card_id = p_card_id;
  if not found then
    raise exception 'Este pedido não está programado.' using errcode = 'no_data_found';
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5 · Quem mexe na entrega: logística/admin OU o entregador da equipe do
--     caminhão em que o pedido está programado
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_pode_mexer_entrega(p_card_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select plt_privado.fn_pode_ver_expedicao()
      or exists (select 1
                   from public.plt_programacoes pr
                   join public.plt_programacao_equipes eq
                     on eq.data_entrega = pr.data_entrega and eq.caminhao_id = pr.caminhao_id
                  where pr.card_id = p_card_id
                    and eq.usuario_id = plt_privado.fn_usuario_atual());
$$;

-- ----------------------------------------------------------------------------
-- 6 · Anexos (comprovante) — base genérica; o arquivo mora no armário privado
-- ----------------------------------------------------------------------------
create table if not exists public.plt_anexos (
  id            bigint generated always as identity primary key,
  card_id       bigint not null references public.plt_cards (id),
  tipo          text not null default 'comprovante',
  caminho       text not null unique,
  nome_arquivo  text not null,
  mime          text not null,
  tamanho       integer not null,
  enviado_por   uuid references public.plt_usuarios (id),
  enviado_em    timestamptz not null default now(),
  removido_em   timestamptz,
  removido_por  uuid references public.plt_usuarios (id),
  constraint plt_anexos_tipo_ck check (tipo in ('comprovante', 'foto', 'documento')),
  constraint plt_anexos_tamanho_ck check (tamanho between 1 and 10485760)
);
create index if not exists plt_anexos_card_idx on public.plt_anexos (card_id) where removido_em is null;
create index if not exists plt_anexos_enviado_por_idx on public.plt_anexos (enviado_por);
create index if not exists plt_anexos_removido_por_idx on public.plt_anexos (removido_por);
alter table public.plt_anexos enable row level security;
revoke all on table public.plt_anexos from public, anon, authenticated;
comment on table public.plt_anexos is
  'SESSAO-30 (D-115): anexos do card (o comprovante de pagamento da entrega; base para a SESSAO-31). O arquivo fica no armário PRIVADO plt-anexos (caminho = <card_id>/<uuid>-<nome>); aqui só o registro. Remoção marca removido_em — nada se apaga.';

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('plt-anexos', 'plt-anexos', false, 10485760,
            array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf',
                  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                  'application/vnd.oasis.opendocument.text'])
    on conflict (id) do update
      set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

    drop policy if exists plt_anexos_enviar on storage.objects;
    create policy plt_anexos_enviar on storage.objects
      for insert to authenticated
      with check (bucket_id = 'plt-anexos'
                  and (storage.foldername(name))[1] ~ '^[0-9]+$'
                  and (select plt_privado.fn_pode_mexer_entrega(((storage.foldername(name))[1])::bigint)));
    drop policy if exists plt_anexos_ler on storage.objects;
    create policy plt_anexos_ler on storage.objects
      for select to authenticated
      using (bucket_id = 'plt-anexos'
             and (storage.foldername(name))[1] ~ '^[0-9]+$'
             and (select plt_privado.fn_pode_mexer_entrega(((storage.foldername(name))[1])::bigint)));
  end if;
end;
$$;

create or replace function public.plt_fn_anexo_registrar(
  p_card_id      bigint,
  p_caminho      text,
  p_nome_arquivo text,
  p_mime         text,
  p_tamanho      integer,
  p_tipo         text default 'comprovante'
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
  v_id      bigint;
  v_existe  boolean;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null or not plt_privado.fn_pode_mexer_entrega(p_card_id) then
    raise exception 'Anexar comprovante é gesto do entregador do caminhão, da logística ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;
  if p_caminho is null or split_part(p_caminho, '/', 1) <> p_card_id::text then
    raise exception 'O arquivo não é deste pedido.' using errcode = 'check_violation';
  end if;
  if coalesce(p_tamanho, 0) not between 1 and 10485760 then
    raise exception 'O arquivo tem no máximo 10 MB.' using errcode = 'check_violation';
  end if;
  if to_regclass('storage.objects') is not null then
    -- dinâmico: onde não há armário (o teste), a consulta nem é montada
    execute 'select exists (select 1 from storage.objects o where o.bucket_id = $1 and o.name = $2)'
      into v_existe using 'plt-anexos', p_caminho;
    if not v_existe then
      raise exception 'O arquivo não chegou ao armário — envie de novo.' using errcode = 'no_data_found';
    end if;
  end if;
  insert into public.plt_anexos (card_id, tipo, caminho, nome_arquivo, mime, tamanho, enviado_por)
    values (p_card_id, coalesce(p_tipo, 'comprovante'), p_caminho, left(coalesce(nullif(btrim(p_nome_arquivo), ''), 'arquivo'), 200),
            left(coalesce(p_mime, 'application/octet-stream'), 100), p_tamanho, v_usuario)
  on conflict (caminho) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.plt_anexos where caminho = p_caminho;   -- o toque repetido
    return v_id;
  end if;
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
    values (p_card_id, 'anexo_adicionado', v_usuario, 'interface',
            left(coalesce(nullif(btrim(p_nome_arquivo), ''), 'arquivo'), 200),
            jsonb_build_object('anexo_id', v_id, 'tipo', coalesce(p_tipo, 'comprovante'), 'mime', p_mime, 'tamanho', p_tamanho));
  return v_id;
end;
$$;

create or replace function public.plt_fn_anexos(p_card_id bigint)
returns table (id bigint, tipo text, caminho text, nome_arquivo text, mime text, tamanho integer,
               enviado_por_nome text, enviado_em timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select a.id, a.tipo, a.caminho, a.nome_arquivo, a.mime, a.tamanho, u.nome, a.enviado_em
    from public.plt_anexos a
    left join public.plt_usuarios u on u.id = a.enviado_por
   where plt_privado.fn_pode_mexer_entrega(p_card_id)
     and a.card_id = p_card_id and a.removido_em is null
   order by a.enviado_em desc
   limit 50;
$$;

-- ----------------------------------------------------------------------------
-- 7 · Comentário no card (o entregador e a logística)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_card_comentar(p_card_id bigint, p_texto text)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
  v_id      bigint;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null or not plt_privado.fn_pode_mexer_entrega(p_card_id) then
    raise exception 'Comentar nesta entrega é gesto do entregador do caminhão, da logística ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;
  if char_length(btrim(coalesce(p_texto, ''))) not between 1 and 1000 then
    raise exception 'Escreva o comentário (até 1000 letras).' using errcode = 'check_violation';
  end if;
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao)
    values (p_card_id, 'comentario_adicionado', v_usuario, 'interface', btrim(p_texto))
    returning id into v_id;
  return v_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 8 · "Entregas do dia" numa requisição (D-115; Lei §2)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_entregas_do_dia(p_data date default null, p_caminhao_id bigint default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario   uuid;
  v_logistica boolean;
  v_data      date;
  v_caminhoes jsonb;
  v_caminhao  bigint;
  v_entregas  jsonb;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null then
    raise exception 'Entre na plataforma para ver as entregas.' using errcode = 'insufficient_privilege';
  end if;
  v_logistica := plt_privado.fn_pode_ver_expedicao();
  if not v_logistica and not plt_privado.fn_eh_entregador(v_usuario) then
    raise exception 'As entregas do dia são do entregador e da logística.' using errcode = 'insufficient_privilege';
  end if;
  v_data := coalesce(p_data, (now() at time zone 'America/Fortaleza')::date);

  -- Os caminhões do dia: a logística vê todos os programados; o entregador, os da equipe dele.
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome, 'placa', x.placa, 'foto', x.foto_caminho,
                                               'equipe', x.equipe, 'entregas', x.n) order by x.nome), '[]'::jsonb)
    into v_caminhoes
    from (
      select cam.id, cam.nome, cam.placa, cam.foto_caminho, count(pr.id)::int as n,
             coalesce((select jsonb_agg(u.nome order by u.nome)
                         from public.plt_programacao_equipes eq join public.plt_usuarios u on u.id = eq.usuario_id
                        where eq.data_entrega = v_data and eq.caminhao_id = cam.id), '[]'::jsonb) as equipe
        from public.plt_caminhoes cam
        join public.plt_programacoes pr on pr.caminhao_id = cam.id and pr.data_entrega = v_data
       where v_logistica
          or exists (select 1 from public.plt_programacao_equipes eq
                      where eq.data_entrega = v_data and eq.caminhao_id = cam.id and eq.usuario_id = v_usuario)
       group by cam.id
    ) x;

  select (c ->> 'id')::bigint into v_caminhao
    from jsonb_array_elements(v_caminhoes) c
   where p_caminhao_id is null or (c ->> 'id')::bigint = p_caminhao_id
   limit 1;

  select coalesce(jsonb_agg(e order by (e ->> 'posicao')::int), '[]'::jsonb) into v_entregas
    from (
      select jsonb_build_object(
               'posicao', row_number() over (order by pr.ordem nulls last, p.numero),
               'card_id', pc.id, 'pedido_id', p.id, 'numero', p.numero,
               'cliente_nome', coalesce(c.nome, ''), 'telefone', c.fone,
               'endereco', c.endereco, 'numero_endereco', c.numero, 'complemento', c.complemento,
               'bairro', c.bairro, 'cidade', c.cidade, 'uf', c.uf,
               'latitude', g.latitude, 'longitude', g.longitude,
               'obs', p.obs, 'detalhe', pr.detalhe, 'data_prevista', p.data_prevista,
               'itens', coalesce(i.itens, '[]'::jsonb), 'unidades', coalesce(i.unidades, 0),
               'volumes', coalesce(i.volumes, 0),
               'entregue_em', ent.ocorrido_em, 'entregue_por', ue.nome,
               'entregue_por_gente', ent.usuario_id is not null,
               'comprovantes', (select count(*) from public.plt_anexos a where a.card_id = pc.id and a.removido_em is null),
               'comentarios', coalesce((select jsonb_agg(jsonb_build_object('texto', cm.observacao, 'por', uc.nome, 'em', cm.ocorrido_em)
                                                         order by cm.id desc)
                                          from (select * from public.plt_eventos ev
                                                 where ev.card_id = pc.id and ev.tipo = 'comentario_adicionado'
                                                 order by ev.id desc limit 5) cm
                                          left join public.plt_usuarios uc on uc.id = cm.usuario_id), '[]'::jsonb)
             ) as e
        from public.plt_programacoes pr
        join public.plt_cards pc on pc.id = pr.card_id and pc.tipo = 'pedido'
        join public.pedidos p on p.id = pc.pedido_id
        left join public.clientes c on c.id = p.cliente_id
        left join public.plt_geocache g
               on g.chave = md5(lower(plt_privado.fn_endereco_geocodificavel(c.endereco, c.numero, c.bairro, c.cidade, c.uf, c.cep)))
        left join public.plt_eventos ent on ent.id = pc.entrega_evento_id
        left join public.plt_usuarios ue on ue.id = ent.usuario_id
        left join lateral (
          -- D-63: o frete não aparece; os volumes vêm do cadastro do Tiny (vazio ou 0 = 1 por móvel).
          select jsonb_agg(jsonb_build_object('descricao', coalesce(nullif(btrim(v.descricao), ''), 'Item sem descrição'),
                                              'quantidade', v.unidades,
                                              'volumes', v.unidades * x.vol) order by v.seq) as itens,
                 sum(v.unidades)::int as unidades,
                 sum(v.unidades * x.vol)::int as volumes
            from plt_privado.vw_itens_producao v
            cross join lateral (
              select greatest(coalesce(nullif(regexp_replace(coalesce(pr2.raw ->> 'qtd_volumes', ''), '[^0-9]', '', 'g'), '')::int, 1), 1) as vol
                from (select plt_privado.fn_produto_do_item(v.codigo, v.descricao) as tiny_id) t
                left join public.produtos pr2 on pr2.tiny_id = t.tiny_id
            ) x
           where v.pedido_id = p.id and not v.eh_frete and v.unidades > 0
        ) i on true
       where pr.data_entrega = v_data and pr.caminhao_id = v_caminhao
         and pc.arquivado_em is null
    ) s;

  return jsonb_build_object('data', v_data, 'caminhao_id', v_caminhao, 'caminhoes', v_caminhoes,
                            'entregas', v_entregas, 'sou_logistica', v_logistica);
end;
$$;

comment on function public.plt_fn_entregas_do_dia(date, bigint) is
  'SESSAO-30 (D-115): a tela do entregador numa requisição — os caminhões do dia (o entregador vê os da equipe dele; a logística, todos), as entregas na ordem salva (D-109) com cliente, endereço e ponto, móveis e VOLUMES (cadastro do Tiny; vazio = 1), observação, detalhe da entrega, comprovantes e os últimos comentários.';

-- ----------------------------------------------------------------------------
-- 9 · Recriadas (versão viva + o que muda)
-- ----------------------------------------------------------------------------
-- Registrar a entrega (recriada POR INTEIRO a partir da migration 59): + idempotente.
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
    -- SESSAO-30 (Lei §10): o mesmo toque repetido (a rede que volta, o dedo
    -- que toca duas vezes) = uma entrega só — devolve a que já existe.
    if exists (select 1 from public.plt_eventos e
                where e.id = v_card.entrega_evento_id and e.usuario_id = v_usuario
                  and e.ocorrido_em > now() - interval '10 minutes') then
      return v_card.entrega_evento_id;
    end if;
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

-- Desfazer a entrega (recriada POR INTEIRO a partir da migration 59): + E-89.
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
  -- E-89: só a entrega feita por gente aqui se desfaz — a que veio do Tiny
  -- (assinada "Sistema") se mexe lá (o Tiny avisa a plataforma).
  if v_entrega.usuario_id is null then
    raise exception 'Esta entrega veio do Tiny — para desfazer, mude a situação no Tiny.' using errcode = 'check_violation';
  end if;
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

-- "Já programadas" (recriada POR INTEIRO a partir da migration 59): + o detalhe da
-- entrega (forma nova → drop + create — E-17).
drop function if exists public.plt_fn_programadas(boolean, date, bigint, integer, integer);
create function public.plt_fn_programadas(
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
  detalhe                 text,
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
           ent.ocorrido_em               as entregue_em,
           pr.detalhe
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
         b.ordem, b.entregue_em, b.detalhe,
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

-- ----------------------------------------------------------------------------
-- 10 · Permissões
-- ----------------------------------------------------------------------------
revoke all on function plt_privado.fn_eh_entregador(uuid) from public, anon, authenticated;
revoke all on function plt_privado.fn_pode_mexer_entrega(bigint) from public, anon;
-- a política do armário chama fn_pode_mexer_entrega como quem está logado
grant execute on function plt_privado.fn_pode_mexer_entrega(bigint) to authenticated;
grant usage on schema plt_privado to authenticated;
revoke all on function public.plt_fn_usuario_entregador(uuid, boolean) from public, anon;
grant execute on function public.plt_fn_usuario_entregador(uuid, boolean) to authenticated;
revoke all on function public.plt_fn_entregadores() from public, anon;
grant execute on function public.plt_fn_entregadores() to authenticated;
revoke all on function public.plt_fn_equipes_do_dia(date) from public, anon;
grant execute on function public.plt_fn_equipes_do_dia(date) to authenticated;
revoke all on function public.plt_fn_equipe_definir(date, bigint, uuid[]) from public, anon;
grant execute on function public.plt_fn_equipe_definir(date, bigint, uuid[]) to authenticated;
revoke all on function public.plt_fn_programacao_detalhe(bigint, text) from public, anon;
grant execute on function public.plt_fn_programacao_detalhe(bigint, text) to authenticated;
revoke all on function public.plt_fn_anexo_registrar(bigint, text, text, text, integer, text) from public, anon;
grant execute on function public.plt_fn_anexo_registrar(bigint, text, text, text, integer, text) to authenticated;
revoke all on function public.plt_fn_anexos(bigint) from public, anon;
grant execute on function public.plt_fn_anexos(bigint) to authenticated;
revoke all on function public.plt_fn_card_comentar(bigint, text) from public, anon;
grant execute on function public.plt_fn_card_comentar(bigint, text) to authenticated;
revoke all on function public.plt_fn_entregas_do_dia(date, bigint) from public, anon;
grant execute on function public.plt_fn_entregas_do_dia(date, bigint) to authenticated;
revoke all on function public.plt_fn_programadas(boolean, date, bigint, integer, integer) from public, anon;
grant execute on function public.plt_fn_programadas(boolean, date, bigint, integer, integer) to authenticated;
