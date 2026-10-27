-- ============================================================================
-- SESSAO-41 · F5 (D-196) — a PARADA AVULSA na rota (pedido do dono, 26–27/10):
--
--   "adicionar parada avulsa na rota durante a hora da programação, ou até
--   mesmo quando estiver em rota, o próprio entregador, ou a pessoa
--   responsável por controlar as rotas… durante a programação coloque a opção
--   de digitar um endereço também e ele aparece pinado no mapa e no quadrinho
--   … que agora não será mais pedidos programados, mas sim rota programada".
--
-- Respostas do dono (27/10): a parada tem título curto, endereço (o pino no
-- mapa, ajustável), observação e "Feita / Não feita"; o ENTREGADOR põe a dele
-- na rota do dia e a arrasta para o momento exato em que vai parar — o resto
-- da ordem ele não mexe (só a logística no computador e os admins).
--
-- A parada não é pedido: não tem card, não entra em estoque, Tiny nem
-- Expedição — mora na rota (dia + caminhão + rota) e divide a ORDEM com os
-- pedidos (a mesma coluna ordem, nas duas tabelas). Nada aqui altera tabela
-- da integração.
-- ============================================================================
set local lock_timeout = '5s';

create table if not exists public.plt_paradas_avulsas (
  id               bigint generated always as identity primary key,
  data_entrega     date not null,
  caminhao_id      bigint not null references public.plt_caminhoes(id),
  rota             smallint not null default 1 check (rota between 1 and 20),
  ordem            integer,
  titulo           text not null check (char_length(btrim(titulo)) between 2 and 80),
  endereco         text not null check (char_length(btrim(endereco)) between 3 and 300),
  latitude         double precision check (latitude between -90 and 90),
  longitude        double precision check (longitude between -180 and 180),
  observacao       text check (char_length(observacao) <= 300),
  situacao         text not null default 'pendente' check (situacao in ('pendente', 'feita', 'nao_feita')),
  criada_por       uuid not null references public.plt_usuarios(id),
  criada_em        timestamptz not null default now(),
  chave_criacao    uuid unique,
  concluida_por    uuid references public.plt_usuarios(id),
  concluida_em     timestamptz,
  nao_feita_motivo text check (char_length(nao_feita_motivo) <= 200),
  removida_por     uuid references public.plt_usuarios(id),
  removida_em      timestamptz
);

comment on table public.plt_paradas_avulsas is
  'SESSAO-41 (D-196): a PARADA AVULSA da rota (buscar material, levar peça, passar num endereço) — título, endereço com o pino ajustável, observação, Feita/Não feita. Mora na rota (dia + caminhão + rota) e divide a ORDEM com os pedidos (plt_programacoes.ordem). Removida = removida_em (nada se apaga). Escrita só pelas portas; RLS sem regra.';

create index if not exists plt_paradas_avulsas_rota_idx
  on public.plt_paradas_avulsas (data_entrega, caminhao_id, rota) where removida_em is null;
create index if not exists plt_paradas_avulsas_caminhao_idx on public.plt_paradas_avulsas (caminhao_id);
create index if not exists plt_paradas_avulsas_criada_por_idx on public.plt_paradas_avulsas (criada_por);
create index if not exists plt_paradas_avulsas_concluida_por_idx on public.plt_paradas_avulsas (concluida_por)
  where concluida_por is not null;
create index if not exists plt_paradas_avulsas_removida_por_idx on public.plt_paradas_avulsas (removida_por)
  where removida_por is not null;

alter table public.plt_paradas_avulsas enable row level security;
revoke all on public.plt_paradas_avulsas from anon, authenticated, public;

-- ----------------------------------------------------------------------------
-- Quem mexe: a logística (qualquer rota) ou o entregador DA EQUIPE da rota
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_na_equipe_da_rota(p_data date, p_caminhao_id bigint, p_rota integer)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.plt_programacao_equipes eq
                  where eq.data_entrega = p_data and eq.caminhao_id = p_caminhao_id and eq.rota = p_rota
                    and eq.usuario_id = plt_privado.fn_usuario_atual());
$$;

revoke all on function plt_privado.fn_na_equipe_da_rota(date, bigint, integer) from public, anon, authenticated;

-- A ORDEM da rota com pedidos e paradas: [{"t":"p","id":<card>} | {"t":"a","id":<parada>}]
-- O conjunto precisa ser o da rota (nem a mais, nem a menos — a rota mudou
-- noutra tela, recusa). O entregador só muda o lugar das paradas DELE.
create or replace function plt_privado.fn_rota_aplicar_ordem(
  p_data date, p_caminhao_id bigint, p_rota integer, p_itens jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu        uuid := plt_privado.fn_usuario_atual();
  v_logistica boolean := plt_privado.fn_pode_ver_expedicao();
  v_tem       text[];
  v_vem       text[];
  v_antes     text[];
  v_depois    text[];
  v_item      record;
begin
  -- o que a rota tem agora (pedido ainda não entregue + parada não removida)
  select coalesce(array_agg(k order by k), '{}') into v_tem from (
    select 'p' || pr.card_id as k from public.plt_programacoes pr
      join public.plt_cards pc on pc.id = pr.card_id
     where pr.data_entrega = p_data and pr.caminhao_id = p_caminhao_id and pr.rota = p_rota
       and pc.entrega_evento_id is null
    union all
    select 'a' || pa.id from public.plt_paradas_avulsas pa
     where pa.data_entrega = p_data and pa.caminhao_id = p_caminhao_id and pa.rota = p_rota and pa.removida_em is null
  ) x;
  select coalesce(array_agg(k order by k), '{}') into v_vem
    from (select (e ->> 't') || (e ->> 'id') as k from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) e) x;
  if v_tem <> v_vem then
    raise exception 'A rota mudou noutra tela — atualize e arrume a ordem de novo.' using errcode = 'check_violation';
  end if;

  if not v_logistica then
    -- o entregador: a ordem do que NÃO é parada dele fica como estava (quem tem ordem salva)
    select coalesce(array_agg(k order by o, k), '{}') into v_antes from (
      select 'p' || pr.card_id as k, pr.ordem as o from public.plt_programacoes pr
        join public.plt_cards pc on pc.id = pr.card_id
       where pr.data_entrega = p_data and pr.caminhao_id = p_caminhao_id and pr.rota = p_rota
         and pc.entrega_evento_id is null and pr.ordem is not null
      union all
      select 'a' || pa.id, pa.ordem from public.plt_paradas_avulsas pa
       where pa.data_entrega = p_data and pa.caminhao_id = p_caminhao_id and pa.rota = p_rota
         and pa.removida_em is null and pa.ordem is not null
         and not (pa.criada_por = v_eu and pa.situacao = 'pendente')
    ) x;
    select coalesce(array_agg(k order by i), '{}') into v_depois from (
      select (e ->> 't') || (e ->> 'id') as k, i
        from jsonb_array_elements(p_itens) with ordinality as t(e, i)
    ) x where x.k = any (v_antes);
    if v_antes <> v_depois then
      raise exception 'A ordem dos pedidos é da logística — o entregador só muda o lugar da parada que ele pôs.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  for v_item in
    select e ->> 't' as t, (e ->> 'id')::bigint as id, i::int as i
      from jsonb_array_elements(p_itens) with ordinality as t(e, i)
  loop
    if v_item.t = 'p' then
      update public.plt_programacoes set ordem = v_item.i
       where card_id = v_item.id and ordem is distinct from v_item.i;
    else
      update public.plt_paradas_avulsas set ordem = v_item.i
       where id = v_item.id and ordem is distinct from v_item.i;
    end if;
  end loop;
  perform plt_privado.fn_avisar('rotas');
end;
$$;

revoke all on function plt_privado.fn_rota_aplicar_ordem(date, bigint, integer, jsonb) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- As portas
-- ----------------------------------------------------------------------------
-- Pôr (p_id nulo) ou editar uma parada. p_ordem (opcional) = a ordem inteira
-- da rota com a parada nova no lugar de {"t":"nova"}; sem ela, vai para o fim.
create or replace function public.plt_fn_parada_avulsa_salvar(
  p_id          bigint,
  p_data        date,
  p_caminhao_id bigint,
  p_rota        integer,
  p_titulo      text,
  p_endereco    text,
  p_latitude    double precision default null,
  p_longitude   double precision default null,
  p_observacao  text default null,
  p_ordem       jsonb default null,
  p_chave       uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu        uuid := plt_privado.fn_usuario_atual();
  v_logistica boolean := plt_privado.fn_pode_ver_expedicao();
  v_p         public.plt_paradas_avulsas%rowtype;
  v_id        bigint;
  v_rota      integer := coalesce(p_rota, 1);
  v_ordem     jsonb;
begin
  if v_eu is null then
    raise exception 'Entre na plataforma primeiro.' using errcode = 'insufficient_privilege';
  end if;

  if p_id is null then
    -- o mesmo toque repetido (a rede que volta) = a mesma parada
    if p_chave is not null then
      select * into v_p from public.plt_paradas_avulsas where chave_criacao = p_chave;
      if v_p.id is not null then
        return jsonb_build_object('id', v_p.id, 'repetido', true);
      end if;
    end if;
    if not v_logistica then
      if not plt_privado.fn_na_equipe_da_rota(p_data, p_caminhao_id, v_rota) then
        raise exception 'Parada avulsa é da logística ou de quem está na equipe dessa rota.' using errcode = 'insufficient_privilege';
      end if;
      if p_data <> (now() at time zone 'America/Fortaleza')::date then
        raise exception 'O entregador põe parada só na rota de hoje.' using errcode = 'check_violation';
      end if;
    end if;
    if not exists (select 1 from public.plt_caminhoes c where c.id = p_caminhao_id and c.arquivado_em is null) then
      raise exception 'Caminhão não encontrado.' using errcode = 'no_data_found';
    end if;
    insert into public.plt_paradas_avulsas
        (data_entrega, caminhao_id, rota, titulo, endereco, latitude, longitude, observacao, criada_por, chave_criacao, ordem)
      values (p_data, p_caminhao_id, v_rota, btrim(p_titulo), btrim(p_endereco), p_latitude, p_longitude,
              nullif(btrim(coalesce(p_observacao, '')), ''), v_eu, p_chave,
              (select coalesce(max(o), 0) + 1 from (
                 select pr.ordem as o from public.plt_programacoes pr
                  where pr.data_entrega = p_data and pr.caminhao_id = p_caminhao_id and pr.rota = v_rota
                 union all
                 select pa.ordem from public.plt_paradas_avulsas pa
                  where pa.data_entrega = p_data and pa.caminhao_id = p_caminhao_id and pa.rota = v_rota and pa.removida_em is null) x))
      returning id into v_id;
    insert into public.plt_logs_atividade (usuario_id, acao, contexto)
      values (v_eu, 'parada_avulsa_criada',
              jsonb_build_object('parada_id', v_id, 'data', p_data, 'caminhao_id', p_caminhao_id, 'rota', v_rota));
    if p_ordem is not null then
      select jsonb_agg(case when e ->> 't' = 'nova' then jsonb_build_object('t', 'a', 'id', v_id) else e end order by i)
        into v_ordem
        from jsonb_array_elements(p_ordem) with ordinality as t(e, i);
      perform plt_privado.fn_rota_aplicar_ordem(p_data, p_caminhao_id, v_rota, v_ordem);
    end if;
  else
    select * into v_p from public.plt_paradas_avulsas where id = p_id and removida_em is null for update;
    if v_p.id is null then
      raise exception 'Parada não encontrada.' using errcode = 'no_data_found';
    end if;
    if not v_logistica and not (v_p.criada_por = v_eu and v_p.situacao = 'pendente') then
      raise exception 'Só a logística (ou quem pôs a parada, antes de fazê-la) edita a parada.' using errcode = 'insufficient_privilege';
    end if;
    update public.plt_paradas_avulsas
       set titulo = btrim(p_titulo), endereco = btrim(p_endereco),
           latitude = p_latitude, longitude = p_longitude,
           observacao = nullif(btrim(coalesce(p_observacao, '')), '')
     where id = p_id;
    v_id := p_id;
    insert into public.plt_logs_atividade (usuario_id, acao, contexto)
      values (v_eu, 'parada_avulsa_editada', jsonb_build_object('parada_id', v_id));
  end if;
  perform plt_privado.fn_avisar('rotas');
  return jsonb_build_object('id', v_id, 'repetido', false);
end;
$$;

comment on function public.plt_fn_parada_avulsa_salvar(bigint, date, bigint, integer, text, text, double precision, double precision, text, jsonb, uuid) is
  'SESSAO-41 (D-196): põe (p_id nulo) ou edita a parada avulsa. A logística em qualquer rota; o entregador só na rota de HOJE em que está na equipe (e edita só a dele, pendente). p_ordem = a ordem da rota com {"t":"nova"} no lugar da parada nova; sem ela, vai para o fim. A chave do gesto evita parada dobrada.';

-- A ordem da rota (pedidos + paradas)
create or replace function public.plt_fn_rota_ordenar(
  p_data date, p_caminhao_id bigint, p_rota integer, p_itens jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if plt_privado.fn_usuario_atual() is null
     or not (plt_privado.fn_pode_ver_expedicao() or plt_privado.fn_na_equipe_da_rota(p_data, p_caminhao_id, p_rota)) then
    raise exception 'A ordem da rota é da logística (o entregador só muda o lugar da parada dele).' using errcode = 'insufficient_privilege';
  end if;
  perform plt_privado.fn_rota_aplicar_ordem(p_data, p_caminhao_id, p_rota, p_itens);
end;
$$;

comment on function public.plt_fn_rota_ordenar(date, bigint, integer, jsonb) is
  'SESSAO-41 (D-196): salva a ORDEM da rota com pedidos e paradas avulsas ([{"t":"p","id":card} | {"t":"a","id":parada}]). A logística em qualquer rota; o entregador da equipe só muda o lugar das paradas DELE (o banco confere).';

-- Feita / Não feita
create or replace function public.plt_fn_parada_avulsa_concluir(p_id bigint, p_feita boolean, p_motivo text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu uuid := plt_privado.fn_usuario_atual();
  v_p  public.plt_paradas_avulsas%rowtype;
begin
  select * into v_p from public.plt_paradas_avulsas where id = p_id and removida_em is null for update;
  if v_p.id is null then
    raise exception 'Parada não encontrada.' using errcode = 'no_data_found';
  end if;
  if v_eu is null or not (plt_privado.fn_pode_ver_expedicao()
                          or plt_privado.fn_na_equipe_da_rota(v_p.data_entrega, v_p.caminhao_id, v_p.rota)) then
    raise exception 'Marcar a parada é da equipe da rota ou da logística.' using errcode = 'insufficient_privilege';
  end if;
  if p_feita is null then
    -- desfazer: volta a pendente
    update public.plt_paradas_avulsas
       set situacao = 'pendente', concluida_por = null, concluida_em = null, nao_feita_motivo = null
     where id = p_id;
  else
    update public.plt_paradas_avulsas
       set situacao = case when p_feita then 'feita' else 'nao_feita' end,
           concluida_por = v_eu, concluida_em = now(),
           nao_feita_motivo = case when p_feita then null else nullif(btrim(coalesce(p_motivo, '')), '') end
     where id = p_id;
  end if;
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_eu, 'parada_avulsa_' || case when p_feita is null then 'reaberta' when p_feita then 'feita' else 'nao_feita' end,
            jsonb_build_object('parada_id', p_id));
  perform plt_privado.fn_avisar('rotas');
  return jsonb_build_object('id', p_id, 'situacao', case when p_feita is null then 'pendente' when p_feita then 'feita' else 'nao_feita' end);
end;
$$;

-- Remover (nada se apaga: fica removida, com quem e quando)
create or replace function public.plt_fn_parada_avulsa_remover(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu uuid := plt_privado.fn_usuario_atual();
  v_p  public.plt_paradas_avulsas%rowtype;
begin
  select * into v_p from public.plt_paradas_avulsas where id = p_id and removida_em is null for update;
  if v_p.id is null then
    return; -- o toque repetido
  end if;
  if v_eu is null or not (plt_privado.fn_pode_ver_expedicao() or (v_p.criada_por = v_eu and v_p.situacao = 'pendente')) then
    raise exception 'Só a logística (ou quem pôs a parada, antes de fazê-la) a tira da rota.' using errcode = 'insufficient_privilege';
  end if;
  update public.plt_paradas_avulsas set removida_por = v_eu, removida_em = now() where id = p_id;
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_eu, 'parada_avulsa_removida', jsonb_build_object('parada_id', p_id));
  perform plt_privado.fn_avisar('rotas');
end;
$$;

-- As paradas de um período (a aba "Já programadas" da logística — leve: só as
-- vivas de poucos dias)
create or replace function public.plt_fn_paradas_avulsas(p_de date, p_ate date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'As paradas da rota são da logística.' using errcode = 'insufficient_privilege';
  end if;
  if p_ate - p_de > 62 then
    raise exception 'Até dois meses por vez.' using errcode = 'check_violation';
  end if;
  return coalesce((
    select jsonb_agg(plt_privado.fn_parada_json(pa) order by pa.data_entrega, pa.caminhao_id, pa.rota, pa.ordem nulls last, pa.id)
      from public.plt_paradas_avulsas pa
     where pa.data_entrega between p_de and p_ate and pa.removida_em is null), '[]'::jsonb);
end;
$$;

create or replace function plt_privado.fn_parada_json(pa public.plt_paradas_avulsas)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', pa.id, 'data', pa.data_entrega, 'caminhao_id', pa.caminhao_id, 'rota', pa.rota, 'ordem', pa.ordem,
    'titulo', pa.titulo, 'endereco', pa.endereco, 'latitude', pa.latitude, 'longitude', pa.longitude,
    'observacao', pa.observacao, 'situacao', pa.situacao,
    'criada_por', (select u.nome from public.plt_usuarios u where u.id = pa.criada_por),
    'sou_autor', pa.criada_por = plt_privado.fn_usuario_atual(),
    'concluida_em', pa.concluida_em, 'nao_feita_motivo', pa.nao_feita_motivo);
$$;

revoke all on function plt_privado.fn_parada_json(public.plt_paradas_avulsas) from public, anon, authenticated;

-- Programar a rota COM as paradas avulsas (a aba Programar): os pedidos como
-- antes (plt_fn_programar_rota) + as paradas novas + a ordem inteira, numa
-- transação. p_paradas: [{"k":<chave da tela>,"titulo","endereco","latitude","longitude","observacao"}]
-- p_ordem: [{"t":"p","id":<card>} | {"t":"n","k":<chave da tela>}]
create or replace function public.plt_fn_programar_rota_paradas(
  p_data        date,
  p_caminhao_id bigint,
  p_rota        integer,
  p_card_ids    bigint[],
  p_paradas     jsonb,
  p_ordem       jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu     uuid := plt_privado.fn_usuario_atual();
  v_mapa   jsonb := '{}'::jsonb;
  v_par    jsonb;
  v_id     bigint;
  v_ordem  jsonb;
  v_resto  jsonb;
begin
  if v_eu is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Programar a rota é da logística.' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(array_length(p_card_ids, 1), 0) > 0 then
    perform public.plt_fn_programar_rota(p_data, p_caminhao_id, p_card_ids, null::bigint[], p_rota);
  end if;
  for v_par in select * from jsonb_array_elements(coalesce(p_paradas, '[]'::jsonb))
  loop
    v_id := (public.plt_fn_parada_avulsa_salvar(
      null, p_data, p_caminhao_id, p_rota, v_par ->> 'titulo', v_par ->> 'endereco',
      (v_par ->> 'latitude')::double precision, (v_par ->> 'longitude')::double precision,
      v_par ->> 'observacao', null, null) ->> 'id')::bigint;
    v_mapa := v_mapa || jsonb_build_object(v_par ->> 'k', v_id);
  end loop;
  if p_ordem is not null and jsonb_array_length(p_ordem) > 0 then
    -- a ordem da tela (o novo + o que a rota já tinha, que vai depois, na ordem dele)
    select jsonb_agg(case when e ->> 't' = 'n' then jsonb_build_object('t', 'a', 'id', (v_mapa ->> (e ->> 'k'))::bigint)
                          else e end order by i)
      into v_ordem
      from jsonb_array_elements(p_ordem) with ordinality as t(e, i);
    select coalesce(jsonb_agg(x.e order by x.o nulls last, x.k), '[]'::jsonb) into v_resto from (
      select jsonb_build_object('t', 'p', 'id', pr.card_id) as e, pr.ordem as o, 'p' || pr.card_id as k
        from public.plt_programacoes pr join public.plt_cards pc on pc.id = pr.card_id
       where pr.data_entrega = p_data and pr.caminhao_id = p_caminhao_id and pr.rota = p_rota
         and pc.entrega_evento_id is null and not (pr.card_id = any (coalesce(p_card_ids, '{}'::bigint[])))
      union all
      select jsonb_build_object('t', 'a', 'id', pa.id), pa.ordem, 'a' || pa.id
        from public.plt_paradas_avulsas pa
       where pa.data_entrega = p_data and pa.caminhao_id = p_caminhao_id and pa.rota = p_rota
         and pa.removida_em is null and not exists (select 1 from jsonb_each_text(v_mapa) m where m.value::bigint = pa.id)
    ) x;
    perform plt_privado.fn_rota_aplicar_ordem(p_data, p_caminhao_id, p_rota, v_ordem || v_resto);
  end if;
  return jsonb_build_object('paradas', v_mapa);
end;
$$;

comment on function public.plt_fn_programar_rota_paradas(date, bigint, integer, bigint[], jsonb, jsonb) is
  'SESSAO-41 (D-196): a aba Programar com parada avulsa — programa os pedidos (como plt_fn_programar_rota), põe as paradas novas e salva a ordem da tela (o que a rota já tinha vai depois), tudo numa transação.';

revoke all on function public.plt_fn_parada_avulsa_salvar(bigint, date, bigint, integer, text, text, double precision, double precision, text, jsonb, uuid) from public, anon;
revoke all on function public.plt_fn_rota_ordenar(date, bigint, integer, jsonb) from public, anon;
revoke all on function public.plt_fn_parada_avulsa_concluir(bigint, boolean, text) from public, anon;
revoke all on function public.plt_fn_parada_avulsa_remover(bigint) from public, anon;
revoke all on function public.plt_fn_paradas_avulsas(date, date) from public, anon;
revoke all on function public.plt_fn_programar_rota_paradas(date, bigint, integer, bigint[], jsonb, jsonb) from public, anon;
grant execute on function public.plt_fn_parada_avulsa_salvar(bigint, date, bigint, integer, text, text, double precision, double precision, text, jsonb, uuid) to authenticated;
grant execute on function public.plt_fn_rota_ordenar(date, bigint, integer, jsonb) to authenticated;
grant execute on function public.plt_fn_parada_avulsa_concluir(bigint, boolean, text) to authenticated;
grant execute on function public.plt_fn_parada_avulsa_remover(bigint) to authenticated;
grant execute on function public.plt_fn_paradas_avulsas(date, date) to authenticated;
grant execute on function public.plt_fn_programar_rota_paradas(date, bigint, integer, bigint[], jsonb, jsonb) to authenticated;

-- ----------------------------------------------------------------------------
-- As entregas do dia (o entregador) — recriada da versão da migration
-- 20261027040000: + as paradas avulsas da rota (paradas_avulsas)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.plt_fn_entregas_do_dia(p_data date DEFAULT NULL::date, p_caminhao_id bigint DEFAULT NULL::bigint, p_rota integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_usuario   uuid;
  v_logistica boolean;
  v_data      date;
  v_caminhoes jsonb;
  v_caminhao  bigint;
  v_rota      integer;
  v_entregas  jsonb;
  v_paradas   jsonb;
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

  -- As rotas do dia: a logística vê todas as programadas; o entregador, as da
  -- equipe dele (SESSAO-31 · D-128: a equipe é de cada rota).
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'rota', x.rota, 'nome', x.nome, 'placa', x.placa,
                                               'foto', x.foto_caminho, 'equipe', x.equipe, 'entregas', x.n)
                            order by x.nome, x.id, x.rota), '[]'::jsonb)
    into v_caminhoes
    from (
      select cam.id, cam.nome, cam.placa, cam.foto_caminho, pr.rota::int as rota, count(pr.id)::int as n,
             coalesce((select jsonb_agg(u.nome order by u.nome)
                         from public.plt_programacao_equipes eq join public.plt_usuarios u on u.id = eq.usuario_id
                        where eq.data_entrega = v_data and eq.caminhao_id = cam.id and eq.rota = pr.rota), '[]'::jsonb) as equipe
        from public.plt_caminhoes cam
        join public.plt_programacoes pr on pr.caminhao_id = cam.id and pr.data_entrega = v_data
       where v_logistica
          or exists (select 1 from public.plt_programacao_equipes eq
                      where eq.data_entrega = v_data and eq.caminhao_id = cam.id and eq.rota = pr.rota
                        and eq.usuario_id = v_usuario)
       group by cam.id, pr.rota
    ) x;

  select (t.c ->> 'id')::bigint, (t.c ->> 'rota')::int into v_caminhao, v_rota
    from jsonb_array_elements(v_caminhoes) with ordinality as t(c, i)
   where (p_caminhao_id is null or (t.c ->> 'id')::bigint = p_caminhao_id)
     and (p_rota is null or (t.c ->> 'rota')::int = p_rota)
   order by t.i
   limit 1;

  select coalesce(jsonb_agg(e order by (e ->> 'posicao')::int), '[]'::jsonb) into v_entregas
    from (
      select jsonb_build_object(
               'posicao', row_number() over (order by pr.ordem nulls last, p.numero),
               -- SESSAO-39 (D-174): a ordem salva — a tela numera como "Já programadas"
               'ordem', pr.ordem,
               'card_id', pc.id, 'pedido_id', p.id, 'numero', p.numero,
               'cliente_nome', coalesce(c.nome, ''), 'telefone', c.fone,
               'endereco', ee.endereco, 'numero_endereco', ee.numero, 'complemento', ee.complemento,
               'bairro', ee.bairro, 'cidade', ee.cidade, 'uf', ee.uf,
               'latitude', g.latitude, 'longitude', g.longitude,
               'obs', p.obs, 'detalhe', pr.detalhe, 'data_prevista', plt_privado.fn_data_entrega(p.id, p.data_prevista),
               'itens', coalesce(i.itens, '[]'::jsonb), 'unidades', coalesce(i.unidades, 0),
               'volumes', coalesce(i.volumes, 0),
               -- SESSAO-38 (D-156): o programado pode ainda estar em produção.
               'estado', pp.estado, 'pronto', coalesce(pp.pronto, true),
               'prontas', coalesce(pp.unidades_prontas, 0), 'a_entregar', coalesce(pp.a_entregar, 0),
               'entregue_em', ent.ocorrido_em, 'entregue_por', ue.nome,
               -- SESSAO-41 (D-195): a entrega foi PARCIAL
               'entrega_parcial', coalesce((ent.dados ->> 'parcial')::boolean, false),
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
      left join plt_privado.vw_endereco_entrega ee on ee.pedido_id = p.id
        left join public.plt_geocache g
               on g.chave = md5(lower(plt_privado.fn_endereco_geocodificavel(ee.endereco, ee.numero, ee.bairro, ee.cidade, ee.uf, ee.cep)))
        left join public.plt_eventos ent on ent.id = pc.entrega_evento_id
        left join public.plt_usuarios ue on ue.id = ent.usuario_id
        left join plt_privado.vw_pedido_prontidao pp on pp.card_id = pc.id
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
       where pr.data_entrega = v_data and pr.caminhao_id = v_caminhao and pr.rota = v_rota
         -- SESSAO-38 (ajuste): a entrega do dia aparece mesmo quando o card saiu com ela
         and (pc.arquivado_em is null or pc.entrega_evento_id is not null)
    ) s;

  -- SESSAO-41 (D-196): as paradas avulsas da rota, na mesma ordem dos pedidos
  select coalesce(jsonb_agg(plt_privado.fn_parada_json(pa) order by pa.ordem nulls last, pa.id), '[]'::jsonb)
    into v_paradas
    from public.plt_paradas_avulsas pa
   where pa.data_entrega = v_data and pa.caminhao_id = v_caminhao and pa.rota = v_rota and pa.removida_em is null;

  return jsonb_build_object('data', v_data, 'caminhao_id', v_caminhao, 'rota', v_rota, 'caminhoes', v_caminhoes,
                            'entregas', v_entregas, 'paradas_avulsas', v_paradas, 'sou_logistica', v_logistica);
end;
$function$;
