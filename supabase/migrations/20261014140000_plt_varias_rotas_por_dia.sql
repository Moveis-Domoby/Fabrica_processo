-- ============================================================================
-- SESSAO-31 · etapa C (D-128): várias rotas por dia no mesmo caminhão — cada
-- rota com o seu dia, a sua ordem e a sua equipe.
--
-- Pedido do dono: "deve ser possível programar mais de uma rota por dia, pois
-- lá eles podem fazer 3, 4, ou até mais rotas em um único dia" · "cada
-- programação será definida o próprio dia, a ordem e cada entregador, pode
-- ser que tenha troca de turno no mesmo caminhão e a terceira rota seja outra
-- pessoa".
--
--  1. plt_programacoes.rota (1…20; tudo o que existe vira a Rota 1): o caminhão
--     sai da fábrica, entrega, volta e sai de novo — a ordem das paradas é de
--     cada (dia, caminhão, ROTA).
--  2. plt_programacao_equipes.rota: a equipe é de cada rota (troca de turno no
--     mesmo caminhão). A rota NOVA herda a equipe da rota anterior do mesmo
--     caminhão no dia — só sugestão (decisão provisória do Claude): muda-se à
--     vontade.
--  3. As portas ganham a rota: programar (um pedido / a rota inteira — sem
--     rota = a última do caminhão no dia, o "entra no fim" de antes), ordenar,
--     equipe, "Entregas do dia" (as rotas do dia em que a pessoa está, na
--     ordem), "Já programadas" (coluna rota), as rotas do dia (substitui a
--     equipe do dia), quem mexe na entrega (a equipe DA ROTA) e a janela do
--     pedido no PCP (a equipe da rota dele).
--
-- Funções recriadas POR INTEIRO a partir da versão viva (E-24); assinatura
-- nova = drop + create (E-17). Parâmetro de rota é integer (o literal 2 é
-- integer — smallint não casaria na chamada). lock_timeout curto (E-66).
-- ============================================================================
set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · A rota na programação
-- ----------------------------------------------------------------------------
alter table public.plt_programacoes add column if not exists rota smallint not null default 1;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'plt_programacoes_rota_ck') then
    alter table public.plt_programacoes add constraint plt_programacoes_rota_ck check (rota between 1 and 20);
  end if;
end;
$$;
comment on column public.plt_programacoes.rota is
  'SESSAO-31 (D-128): a rota do caminhão naquele dia (Rota 1, Rota 2… — o caminhão volta à fábrica e sai de novo). A ordem das paradas e a equipe são de cada rota.';

-- A consulta da rota é sempre por (dia, caminhão, rota) — o índice antigo
-- (dia, caminhão) fica coberto pelo novo.
create index if not exists plt_programacoes_rota_idx on public.plt_programacoes (data_entrega, caminhao_id, rota);
drop index if exists public.plt_programacoes_data_idx;

-- ----------------------------------------------------------------------------
-- 2 · A equipe é de cada rota
-- ----------------------------------------------------------------------------
alter table public.plt_programacao_equipes add column if not exists rota smallint not null default 1;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'plt_programacao_equipes_rota_ck') then
    alter table public.plt_programacao_equipes add constraint plt_programacao_equipes_rota_ck check (rota between 1 and 20);
  end if;
  if (select array_length(c.conkey, 1) from pg_constraint c
       where c.conrelid = 'public.plt_programacao_equipes'::regclass and c.contype = 'p') = 3 then
    alter table public.plt_programacao_equipes drop constraint plt_programacao_equipes_pkey;
    alter table public.plt_programacao_equipes
      add constraint plt_programacao_equipes_pkey primary key (data_entrega, caminhao_id, rota, usuario_id);
  end if;
end;
$$;
comment on column public.plt_programacao_equipes.rota is
  'SESSAO-31 (D-128): a rota do caminhão no dia que esta pessoa leva (troca de turno no mesmo caminhão é normal).';

-- ----------------------------------------------------------------------------
-- 3 · Maquinaria: a rota padrão e a equipe herdada
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_rota_padrao(p_data date, p_caminhao_id bigint)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(max(pr.rota), 1)::int
    from public.plt_programacoes pr
   where pr.data_entrega = p_data and pr.caminhao_id = p_caminhao_id;
$$;

comment on function plt_privado.fn_rota_padrao(date, bigint) is
  'SESSAO-31 (D-128): a rota em que o pedido entra quando ninguém diz qual — a última do caminhão naquele dia (ou a 1): o "entra no fim da rota do caminhão" de antes.';

create or replace function plt_privado.fn_equipe_herdar(p_data date, p_caminhao_id bigint, p_rota integer, p_usuario uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_de integer;
  v_n  integer;
begin
  if p_rota <= 1 or exists (select 1 from public.plt_programacao_equipes eq
                             where eq.data_entrega = p_data and eq.caminhao_id = p_caminhao_id and eq.rota = p_rota) then
    return 0;
  end if;
  select max(eq.rota) into v_de
    from public.plt_programacao_equipes eq
   where eq.data_entrega = p_data and eq.caminhao_id = p_caminhao_id and eq.rota < p_rota;
  if v_de is null then
    return 0;
  end if;
  insert into public.plt_programacao_equipes (data_entrega, caminhao_id, rota, usuario_id, definido_por)
    select p_data, p_caminhao_id, p_rota, eq.usuario_id, p_usuario
      from public.plt_programacao_equipes eq
      join public.plt_usuarios u on u.id = eq.usuario_id and u.ativo
     where eq.data_entrega = p_data and eq.caminhao_id = p_caminhao_id and eq.rota = v_de
  on conflict do nothing;
  get diagnostics v_n = row_count;
  if v_n > 0 then
    insert into public.plt_logs_atividade (usuario_id, acao, contexto)
      values (p_usuario, 'equipe_caminhao_definida',
              jsonb_build_object('data', p_data, 'caminhao_id', p_caminhao_id, 'rota', p_rota, 'herdada_da_rota', v_de,
                                 'usuarios', (select to_jsonb(array_agg(eq.usuario_id order by eq.usuario_id))
                                                from public.plt_programacao_equipes eq
                                               where eq.data_entrega = p_data and eq.caminhao_id = p_caminhao_id
                                                 and eq.rota = p_rota)));
  end if;
  return v_n;
end;
$$;

comment on function plt_privado.fn_equipe_herdar(date, bigint, integer, uuid) is
  'SESSAO-31 (D-128): a rota NOVA do caminhão no dia já vem com a equipe da rota anterior dele (sugestão — muda-se em "Equipe"). Só preenche rota sem ninguém; deixa uma linha na trilha.';

-- O registro da programação (recriada POR INTEIRO a partir da migration 54): + a rota.
create or replace function plt_privado.fn_logar_programacao()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_acao text;
  v_ctx  jsonb;
begin
  if tg_op = 'INSERT' then
    v_acao := 'entrega_programada';
    v_ctx := jsonb_build_object('card_id', new.card_id, 'data', new.data_entrega,
                                'caminhao_id', new.caminhao_id, 'rota', new.rota);
  elsif tg_op = 'DELETE' then
    v_acao := 'programacao_removida';
    v_ctx := jsonb_build_object('card_id', old.card_id, 'data', old.data_entrega,
                                'caminhao_id', old.caminhao_id, 'rota', old.rota);
  else
    -- SESSAO-28 (D-109): só a ordem mudou → quem registra é o gesto
    -- "Salvar ordem" (plt_fn_ordenar_rota), uma linha para a rota inteira.
    if new.data_entrega is not distinct from old.data_entrega
       and new.caminhao_id is not distinct from old.caminhao_id
       and new.rota is not distinct from old.rota
       and new.ordem is distinct from old.ordem then
      return null;
    end if;
    v_acao := 'entrega_reprogramada';
    v_ctx := jsonb_strip_nulls(jsonb_build_object(
      'card_id', new.card_id,
      'data_antes',     case when new.data_entrega is distinct from old.data_entrega then old.data_entrega end,
      'data_depois',    case when new.data_entrega is distinct from old.data_entrega then new.data_entrega end,
      'caminhao_antes', case when new.caminhao_id  is distinct from old.caminhao_id  then old.caminhao_id  end,
      'caminhao_depois',case when new.caminhao_id  is distinct from old.caminhao_id  then new.caminhao_id  end,
      -- SESSAO-31 (D-128)
      'rota_antes',     case when new.rota is distinct from old.rota then old.rota end,
      'rota_depois',    case when new.rota is distinct from old.rota then new.rota end));
  end if;

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
  values (plt_privado.fn_usuario_atual(), v_acao, v_ctx);
  return null;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4 · Programar um pedido (recriada POR INTEIRO a partir da migration 59): + a rota
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_programar_entrega(bigint, date, bigint);
create or replace function public.plt_fn_programar_entrega(
  p_card_id     bigint,
  p_data        date,
  p_caminhao_id bigint,
  p_rota        integer default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
  v_card    public.plt_cards%rowtype;
  v_atual   public.plt_programacoes%rowtype;
  v_rota    integer;
  v_nova    boolean;
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

  -- SESSAO-31 (D-128): sem rota dita, o pedido fica na rota em que já está
  -- (mesmo dia e caminhão) ou entra na última rota do caminhão no dia.
  select * into v_atual from public.plt_programacoes where card_id = p_card_id;
  v_rota := coalesce(p_rota,
                     case when v_atual.card_id is not null and v_atual.data_entrega = p_data
                               and v_atual.caminhao_id = p_caminhao_id then v_atual.rota::int end,
                     plt_privado.fn_rota_padrao(p_data, p_caminhao_id));
  if v_rota < 1 or v_rota > 20 then
    raise exception 'A rota vai de 1 a 20 no mesmo dia e caminhão.' using errcode = 'check_violation';
  end if;
  v_nova := not exists (select 1 from public.plt_programacoes pr
                         where pr.data_entrega = p_data and pr.caminhao_id = p_caminhao_id
                           and pr.rota = v_rota and pr.card_id <> p_card_id);

  insert into public.plt_programacoes as pr
         (card_id, data_entrega, caminhao_id, rota, criado_por_id, atualizado_por_id)
       values (p_card_id, p_data, p_caminhao_id, v_rota, v_usuario, v_usuario)
  on conflict (card_id) do update
     set data_entrega = excluded.data_entrega,
         caminhao_id  = excluded.caminhao_id,
         rota         = excluded.rota,
         atualizado_por_id = excluded.atualizado_por_id,
         -- SESSAO-28 (D-109): noutro dia/caminhão (ou noutra rota — D-128) a
         -- ordem antiga não vale — a parada vai para o fim da rota nova.
         ordem = case when pr.data_entrega is distinct from excluded.data_entrega
                        or pr.caminhao_id  is distinct from excluded.caminhao_id
                        or pr.rota         is distinct from excluded.rota
                      then null else pr.ordem end
  returning id into v_id;

  if v_nova then
    perform plt_privado.fn_equipe_herdar(p_data, p_caminhao_id, v_rota, v_usuario);
  end if;
  return v_id;
end;
$$;

comment on function public.plt_fn_programar_entrega(bigint, date, bigint, integer) is
  'Programar ou reprogramar um pedido lançado (D-45: nunca depois de entregue). SESSAO-31 (D-128): + a rota do caminhão no dia (sem rota = a que ele já está no mesmo dia e caminhão, ou a última do caminhão); trocar dia, caminhão ou rota zera a ordem; a rota nova herda a equipe da anterior.';

-- ----------------------------------------------------------------------------
-- 5 · A ordem das paradas é de cada rota (recriada POR INTEIRO a partir da migration 59)
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_ordenar_rota(date, bigint, bigint[]);
create or replace function public.plt_fn_ordenar_rota(
  p_data        date,
  p_caminhao_id bigint,
  p_card_ids    bigint[],
  p_rota        integer default 1
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario  uuid;
  v_ids      bigint[] := coalesce(p_card_ids, '{}'::bigint[]);
  v_rota     integer  := coalesce(p_rota, 1);
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

  -- Todo pedido da lista tem de estar programado NESTE dia, caminhão e rota
  -- (se a lista mudou noutra tela, a pessoa recarrega antes de salvar).
  select x into v_fora
    from unnest(v_ids) x
   where not exists (select 1 from public.plt_programacoes pr
                      where pr.card_id = x and pr.data_entrega = p_data and pr.caminhao_id = p_caminhao_id
                        and pr.rota = v_rota)
   limit 1;
  if v_fora is not null then
    raise exception 'A rota mudou desde que a tela abriu (um pedido não está mais nesta rota) — recarregue e salve de novo.'
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

  -- Os da lista ganham a posição; os da mesma rota fora da lista (ou todos,
  -- com a lista vazia = "volta à sugestão") ficam sem ordem. Só a linha que
  -- muda é tocada.
  update public.plt_programacoes pr
     set ordem = l.posicao, atualizado_por_id = v_usuario
    from unnest(v_ids) with ordinality as l(card_id, posicao)
   where pr.card_id = l.card_id
     and pr.ordem is distinct from l.posicao::int;
  update public.plt_programacoes pr
     set ordem = null, atualizado_por_id = v_usuario
   where pr.data_entrega = p_data and pr.caminhao_id = p_caminhao_id and pr.rota = v_rota
     and pr.ordem is not null
     and not (pr.card_id = any (v_ids));

  select count(*)::int into v_paradas
    from public.plt_programacoes pr
   where pr.data_entrega = p_data and pr.caminhao_id = p_caminhao_id and pr.rota = v_rota;

  -- D-40: o gesto inteiro vira UMA linha na trilha.
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
  values (v_usuario, 'rota_ordem_salva', jsonb_build_object(
    'data', p_data,
    'caminhao_id', p_caminhao_id,
    'rota', v_rota,
    'card_ids', to_jsonb(v_ids),
    'paradas', v_paradas,
    'automatica', cardinality(v_ids) = 0));

  return cardinality(v_ids);
end;
$$;

comment on function public.plt_fn_ordenar_rota(date, bigint, bigint[], integer) is
  'SESSAO-28 (D-109): salva a ordem das paradas (lista vazia = volta à sugestão). SESSAO-31 (D-128): a ordem é de cada rota do caminhão no dia (padrão: Rota 1).';

-- ----------------------------------------------------------------------------
-- 6 · Programar a rota inteira (recriada POR INTEIRO a partir da migration 55): + a rota
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_programar_rota(date, bigint, bigint[], bigint[]);
create or replace function public.plt_fn_programar_rota(
  p_data        date,
  p_caminhao_id bigint,
  p_card_ids    bigint[],
  p_ordem       bigint[] default null,
  p_rota        integer  default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card bigint;
  v_rota integer;
begin
  if coalesce(cardinality(p_card_ids), 0) = 0 then
    raise exception 'Escolha ao menos um pedido para programar.' using errcode = 'check_violation';
  end if;
  if cardinality(p_card_ids) > 200 then
    raise exception 'Pedidos demais numa programação só.' using errcode = 'check_violation';
  end if;
  -- SESSAO-31 (D-128): todos vão para a MESMA rota — a dita, ou a última do
  -- caminhão no dia (decidida uma vez, antes do primeiro entrar).
  v_rota := coalesce(p_rota, plt_privado.fn_rota_padrao(p_data, p_caminhao_id));
  foreach v_card in array p_card_ids loop
    perform public.plt_fn_programar_entrega(v_card, p_data, p_caminhao_id, v_rota);
  end loop;
  if p_ordem is not null then
    perform public.plt_fn_ordenar_rota(p_data, p_caminhao_id, p_ordem, v_rota);
  end if;
  return cardinality(p_card_ids);
end;
$$;

comment on function public.plt_fn_programar_rota(date, bigint, bigint[], bigint[], integer) is
  'SESSAO-28 ajustes (D-111): programa vários pedidos no mesmo dia e caminhão numa transação só e, com p_ordem, salva a ordem da rota. SESSAO-31 (D-128): + a rota (sem rota = a última do caminhão no dia).';

-- ----------------------------------------------------------------------------
-- 7 · A equipe de cada rota (recriada POR INTEIRO a partir da migration 60)
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_equipe_definir(date, bigint, uuid[]);
create or replace function public.plt_fn_equipe_definir(
  p_data        date,
  p_caminhao_id bigint,
  p_usuarios    uuid[],
  p_rota        integer default 1
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quem uuid;
  v_rota integer := coalesce(p_rota, 1);
  v_n    integer;
begin
  v_quem := plt_privado.fn_usuario_atual();
  if v_quem is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Escolher a equipe do caminhão é gesto da logística ou de admin.' using errcode = 'insufficient_privilege';
  end if;
  if p_data is null or p_caminhao_id is null then
    raise exception 'Escolha o dia e o caminhão.' using errcode = 'check_violation';
  end if;
  if v_rota < 1 or v_rota > 20 then
    raise exception 'A rota vai de 1 a 20 no mesmo dia e caminhão.' using errcode = 'check_violation';
  end if;
  if coalesce(array_length(p_usuarios, 1), 0) > 10 then
    raise exception 'No máximo 10 pessoas por rota.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from unnest(coalesce(p_usuarios, '{}'::uuid[])) x
              where not exists (select 1 from public.plt_usuarios u where u.id = x and u.ativo)) then
    raise exception 'Alguém escolhido não está ativo na plataforma.' using errcode = 'check_violation';
  end if;
  delete from public.plt_programacao_equipes
   where data_entrega = p_data and caminhao_id = p_caminhao_id and rota = v_rota
     and not (usuario_id = any (coalesce(p_usuarios, '{}'::uuid[])));
  insert into public.plt_programacao_equipes (data_entrega, caminhao_id, rota, usuario_id, definido_por)
    select p_data, p_caminhao_id, v_rota, x, v_quem from unnest(coalesce(p_usuarios, '{}'::uuid[])) x
  on conflict do nothing;
  select count(*)::int into v_n from public.plt_programacao_equipes
   where data_entrega = p_data and caminhao_id = p_caminhao_id and rota = v_rota;
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_quem, 'equipe_caminhao_definida',
            jsonb_build_object('data', p_data, 'caminhao_id', p_caminhao_id, 'rota', v_rota,
                               'usuarios', to_jsonb(coalesce(p_usuarios, '{}'::uuid[]))));
  return v_n;
end;
$$;

comment on function public.plt_fn_equipe_definir(date, bigint, uuid[], integer) is
  'SESSAO-30 (D-115): quem leva o caminhão no dia. SESSAO-31 (D-128): a equipe é de cada rota (padrão: Rota 1).';

-- ----------------------------------------------------------------------------
-- 8 · As rotas do dia (substitui a "equipe do dia"): cada (caminhão, rota) com
--     as entregas e a equipe — o "Programar" escolhe a rota por ela e a
--     "Equipe" de "Já programadas" lê a equipe dela. Uma requisição, no clique.
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_equipes_do_dia(date);
create or replace function public.plt_fn_rotas_do_dia(p_data date)
returns table (caminhao_id bigint, rota integer, entregas integer, entregues integer, equipe jsonb)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select r.caminhao_id, r.rota::int, r.entregas, r.entregues,
         coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'nome', u.nome) order by u.nome)
                     from public.plt_programacao_equipes eq join public.plt_usuarios u on u.id = eq.usuario_id
                    where eq.data_entrega = p_data and eq.caminhao_id = r.caminhao_id and eq.rota = r.rota), '[]'::jsonb)
    from (select pr.caminhao_id, pr.rota, count(*)::int as entregas,
                 count(*) filter (where pc.entrega_evento_id is not null)::int as entregues
            from public.plt_programacoes pr
            join public.plt_cards pc on pc.id = pr.card_id and pc.tipo = 'pedido' and pc.arquivado_em is null
           where pr.data_entrega = p_data
           group by pr.caminhao_id, pr.rota) r
   where plt_privado.fn_pode_ver_expedicao()
   order by r.caminhao_id, r.rota
   limit 200;
$$;

comment on function public.plt_fn_rotas_do_dia(date) is
  'SESSAO-31 (D-128): as rotas do dia — cada (caminhão, rota) com quantas entregas, quantas já entregues e a equipe [{id, nome}]. Só a logística/admin. Substitui plt_fn_equipes_do_dia.';

-- ----------------------------------------------------------------------------
-- 9 · Quem mexe na entrega: a equipe DA ROTA (recriada POR INTEIRO a partir da migration 60)
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
                    and eq.rota = pr.rota
                  where pr.card_id = p_card_id
                    and eq.usuario_id = plt_privado.fn_usuario_atual());
$$;

-- ----------------------------------------------------------------------------
-- 10 · "Entregas do dia": as ROTAS do dia em que a pessoa está, na ordem
--      (recriada POR INTEIRO a partir da migration 60). A lista continua na
--      chave "caminhoes" (o site de antes lê por ela) — agora um item por
--      (caminhão, rota).
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_entregas_do_dia(date, bigint);
create or replace function public.plt_fn_entregas_do_dia(
  p_data        date    default null,
  p_caminhao_id bigint  default null,
  p_rota        integer default null
)
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
  v_rota      integer;
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
       where pr.data_entrega = v_data and pr.caminhao_id = v_caminhao and pr.rota = v_rota
         and pc.arquivado_em is null
    ) s;

  return jsonb_build_object('data', v_data, 'caminhao_id', v_caminhao, 'rota', v_rota, 'caminhoes', v_caminhoes,
                            'entregas', v_entregas, 'sou_logistica', v_logistica);
end;
$$;

comment on function public.plt_fn_entregas_do_dia(date, bigint, integer) is
  'SESSAO-30 (D-115): a tela do entregador numa requisição — as entregas na ordem salva (D-109) com cliente, endereço e ponto, móveis e VOLUMES, observação, detalhe, comprovantes e os últimos comentários. SESSAO-31 (D-128): a lista "caminhoes" traz um item por ROTA do dia (id do caminhão + rota); o entregador vê as rotas da equipe dele; p_caminhao_id/p_rota escolhem qual.';

-- ----------------------------------------------------------------------------
-- 11 · "Já programadas" com a rota (recriada POR INTEIRO a partir da migration 60)
-- ----------------------------------------------------------------------------
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
  rota                    integer,
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
           pr.rota::int                  as rota,
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
         b.rota, b.ordem, b.entregue_em, b.detalhe,
         count(*) over () as contagem_total
    from base b
    left join public.plt_geocache g
           on b.endereco_geocodificavel is not null
          and g.chave = md5(lower(b.endereco_geocodificavel))
   where plt_privado.fn_pode_ver_expedicao()
   order by case when coalesce(p_entregues, false) then null else b.programacao_data end asc,
            case when coalesce(p_entregues, false) then b.programacao_data end desc,
            b.caminhao_nome, b.caminhao_id, b.rota, b.ordem nulls last, b.numero
   limit least(greatest(coalesce(p_limite, 50), 1), 200)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_programadas(boolean, date, bigint, integer, integer) is
  'SESSAO-28 (D-111): as programações não entregues (ou as entregues), por dia → caminhão → ordem, paginadas no servidor. SESSAO-31 (D-128): + a rota do caminhão no dia (dia → caminhão → ROTA → ordem).';

-- ----------------------------------------------------------------------------
-- 12 · A janela completa do pedido (recriada POR INTEIRO a partir da migration
--      67): a programação diz a rota, e a equipe é a DA ROTA (D-128)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.plt_fn_pcp_pedido_detalhe(p_pedido_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_p    public.pedidos%rowtype;
  v_c    public.clientes%rowtype;
  v_card public.plt_cards%rowtype;
  v_ent  public.plt_eventos%rowtype;
  v_prog public.plt_programacoes%rowtype;
  v_sit  text;
  v_tot  integer;
  v_lib  integer;
  v_pro  integer;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'O detalhe do pedido é da logística (PCP/terminais) ou de admin.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_p from public.pedidos where id = p_pedido_id;
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'no_data_found';
  end if;
  select * into v_c from public.clientes where id = v_p.cliente_id;
  select * into v_card from public.plt_cards where pedido_id = v_p.id and tipo = 'pedido';
  if v_card.entrega_evento_id is not null then
    select * into v_ent from public.plt_eventos where id = v_card.entrega_evento_id;
  end if;
  if v_card.id is not null then
    select * into v_prog from public.plt_programacoes where card_id = v_card.id;
  end if;

  -- A situação na plataforma — a mesma regra de "Todos os pedidos".
  select coalesce(sum(v.unidades), 0)::int into v_tot
    from plt_privado.vw_itens_producao v where v.pedido_id = v_p.id;
  select count(*)::int, count(*) filter (where s.papel_no_fluxo = 'terminal' or u.concluido_em is not null)::int
    into v_lib, v_pro
    from public.plt_cards u
    left join public.plt_setores s on s.id = u.setor_atual_id
   where u.pedido_id = v_p.id and u.tipo = 'unidade' and u.arquivado_em is null;
  v_sit := case
             when v_card.id is null then 'sem_card'
             when v_card.devolucao_evento_id is not null then 'devolvido'  -- SESSAO-31 (D-129)
             when v_card.entrega_evento_id is not null then 'entregue'
             when v_card.arquivado_em is not null then 'arquivado'
             when v_card.lancado_rotas_em is not null then 'em_rota'
             when v_tot > 0 and v_pro >= v_tot then 'aguardo'
             when v_lib > 0 then 'producao'
             else 'pcp'
           end;

  return jsonb_build_object(
    -- SESSAO-31 (D-129): a devolução em decisão (o resto vem da porta da decisão).
    'devolucao', case when v_card.devolucao_evento_id is not null then (
      select jsonb_build_object('evento_id', d.id, 'quando', d.ocorrido_em,
               'quem', (select u.nome from public.plt_usuarios u where u.id = d.usuario_id),
               'motivo', d.dados ->> 'motivo', 'observacao', d.dados ->> 'observacao',
               'entregue', coalesce((d.dados ->> 'entregue')::boolean, false))
        from public.plt_eventos d where d.id = v_card.devolucao_evento_id) end,
    'pedido', jsonb_build_object(
      'id', v_p.id, 'numero', v_p.numero, 'situacao', v_p.situacao, 'origem', v_p.origem,
      'data_pedido', v_p.data_pedido, 'data_prevista', v_p.data_prevista,
      'data_faturamento', nullif(v_p.raw ->> 'data_faturamento', ''),
      'data_envio', nullif(v_p.raw ->> 'data_envio', ''),
      'data_entrega_tiny', nullif(v_p.raw ->> 'data_entrega', ''),
      'total_produtos', v_p.total_produtos, 'valor_frete', v_p.valor_frete,
      'valor_desconto', nullif(v_p.raw ->> 'valor_desconto', ''),
      'outras_despesas', nullif(v_p.raw ->> 'outras_despesas', ''),
      'total_pedido', v_p.total_pedido,
      'forma_pagamento', v_p.forma_pagamento, 'meio_pagamento', v_p.meio_pagamento,
      'condicao_pagamento', nullif(v_p.raw ->> 'condicao_pagamento', ''),
      'qtd_parcelas', v_p.qtd_parcelas,
      'parcelas', coalesce((select jsonb_agg(jsonb_build_object(
                     'data', nullif(x -> 'parcela' ->> 'data', ''), 'dias', nullif(x -> 'parcela' ->> 'dias', ''),
                     'valor', nullif(x -> 'parcela' ->> 'valor', ''),
                     'forma', nullif(x -> 'parcela' ->> 'forma_pagamento', ''),
                     'meio', nullif(x -> 'parcela' ->> 'meio_pagamento', ''),
                     'obs', nullif(x -> 'parcela' ->> 'obs', '')) order by o)
                   from jsonb_array_elements(case when jsonb_typeof(v_p.parcelas) = 'array' then v_p.parcelas else '[]'::jsonb end)
                        with ordinality as t(x, o)), '[]'::jsonb),
      'obs', v_p.obs, 'obs_interna', v_p.obs_interna, 'marcadores', to_jsonb(coalesce(v_p.marcadores, '{}'::text[])),
      'vendedor', v_p.vendedor, 'ecommerce', v_p.ecommerce, 'numero_ecommerce', nullif(v_p.raw ->> 'numero_ecommerce', ''),
      'forma_envio', v_p.forma_envio, 'forma_frete', nullif(v_p.raw ->> 'forma_frete', ''),
      'transportador', nullif(v_p.raw ->> 'nome_transportador', ''),
      'codigo_rastreamento', v_p.codigo_rastreamento, 'url_rastreamento', v_p.url_rastreamento,
      'atualizado_em', v_p.atualizado_em),
    'cliente', jsonb_build_object(
      'nome', v_c.nome, 'fone', v_c.fone, 'email', v_c.email, 'documento', v_c.cpf_cnpj,
      'endereco', v_c.endereco, 'numero', v_c.numero, 'complemento', v_c.complemento,
      'bairro', v_c.bairro, 'cidade', v_c.cidade, 'uf', v_c.uf, 'cep', v_c.cep),
    'plataforma', jsonb_build_object(
      'card_id', v_card.id, 'situacao', v_sit, 'total_unidades', v_tot,
      'lancado_rotas_em', v_card.lancado_rotas_em, 'arquivado_em', v_card.arquivado_em,
      'liberado_completo_em', v_card.liberado_completo_em),
    'programacao', case when v_prog.id is null then null else jsonb_build_object(
      'data', v_prog.data_entrega, 'rota', v_prog.rota, 'ordem', v_prog.ordem, 'detalhe', v_prog.detalhe,
      'caminhao', (select cam.nome || coalesce(' · ' || cam.placa, '') from public.plt_caminhoes cam where cam.id = v_prog.caminhao_id),
      'equipe', coalesce((select jsonb_agg(u.nome order by u.nome)
                            from public.plt_programacao_equipes eq join public.plt_usuarios u on u.id = eq.usuario_id
                           where eq.data_entrega = v_prog.data_entrega and eq.caminhao_id = v_prog.caminhao_id
                             and eq.rota = v_prog.rota), '[]'::jsonb)) end,
    'entrega', case when v_ent.id is null then null else jsonb_build_object(
      'em', v_ent.ocorrido_em, 'por', (select u.nome from public.plt_usuarios u where u.id = v_ent.usuario_id),
      'por_gente', v_ent.usuario_id is not null, 'observacao', v_ent.observacao,
      'fonte', coalesce(v_ent.dados ->> 'fonte', case when v_ent.usuario_id is null then 'tiny' else 'plataforma' end)) end,
    'itens', coalesce((select jsonb_agg(jsonb_build_object(
                'seq', i.seq, 'codigo', i.codigo, 'descricao', i.descricao, 'unidade', i.unidade,
                'quantidade', i.quantidade, 'valor_unitario', i.valor_unitario,
                'valor_total', round(coalesce(i.quantidade, 0) * coalesce(i.valor_unitario, 0), 2),
                'unidades_producao', coalesce(v.unidades, 0), 'eh_frete', coalesce(v.eh_frete, false)) order by i.seq)
              from public.pedido_itens i
              left join plt_privado.vw_itens_producao v on v.pedido_id = i.pedido_id and v.seq = i.seq
             where i.pedido_id = v_p.id), '[]'::jsonb),
    'unidades', coalesce((select jsonb_agg(jsonb_build_object(
                'card_id', u.id, 'descricao', u.item_descricao, 'indice', u.indice_unidade, 'total', u.total_unidades,
                'setor', s.nome, 'etapa', e.nome, 'desde', u.desde, 'concluido_em', u.concluido_em,
                'qualidade', u.qualidade_atual, 'arquivado_em', u.arquivado_em,
                'motivo_saida', (select a.dados ->> 'motivo' from public.plt_eventos a
                                  where a.card_id = u.id and a.tipo = 'card_arquivado' order by a.id desc limit 1))
                order by u.item_seq, u.indice_unidade)
              from public.plt_cards u
              left join public.plt_setores s on s.id = u.setor_atual_id
              left join public.plt_etapas e on e.id = u.etapa_atual_id
             where u.tipo = 'unidade' and u.pedido_id = v_p.id), '[]'::jsonb),
    'contas_receber', coalesce((select jsonb_agg(jsonb_build_object(
                'vencimento', cr.data_vencimento, 'valor', cr.valor, 'saldo', cr.saldo, 'situacao', cr.situacao,
                'liquidacao', cr.data_liquidacao, 'forma', cr.forma_recebimento, 'meio', cr.meio_recebimento,
                'historico', cr.historico) order by cr.data_vencimento)
              from public.contas_receber cr where cr.pedido_id = v_p.id), '[]'::jsonb),
    -- ↪️ D-122: "conferidas em" = a última busca das contas no Tiny (a conferência
    -- diária; antes dela, a carga do histórico) — pelo índice da fila (recurso,
    -- chave): a 1ª página da busca, uma linha; só sem ela (antes da 1ª rodada ou
    -- no meio de uma) as poucas linhas da busca — nunca a tabela de contas (Lei §6)
    'contas_receber_ate', coalesce(
       (select f.processado_em from public.tiny_fila f
         where f.recurso = 'cr_pesquisa' and f.chave = 'pente-fino-cr:p1' and f.status = 'ok'),
       (select max(f.processado_em) from public.tiny_fila f
         where f.recurso = 'cr_pesquisa' and f.status = 'ok')),
    'notas_fiscais', coalesce((select jsonb_agg(jsonb_build_object(
                'numero', nf.numero, 'serie', nf.serie, 'emissao', nf.data_emissao,
                'situacao', coalesce(nf.descricao_situacao, nf.situacao), 'valor', nf.valor_nota) order by nf.data_emissao)
              from public.notas_fiscais nf where nf.pedido_id = v_p.id), '[]'::jsonb),
    'anexos', case when v_card.id is null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object(
                'id', a.id, 'tipo', a.tipo, 'nome', a.nome_arquivo, 'mime', a.mime, 'tamanho', a.tamanho,
                'caminho', a.caminho, 'por', u.nome, 'em', a.enviado_em) order by a.enviado_em desc)
              from public.plt_anexos a left join public.plt_usuarios u on u.id = a.enviado_por
             where a.card_id = v_card.id and a.removido_em is null), '[]'::jsonb) end,
    'historico', case when v_card.id is null then '[]'::jsonb else coalesce((select jsonb_agg(h order by (h ->> 'id')::bigint desc) from (
                select jsonb_build_object(
                  'id', ev.id, 'tipo', ev.tipo, 'em', ev.ocorrido_em, 'por', u.nome, 'origem', ev.origem,
                  'observacao', ev.observacao, 'motivo', ev.dados ->> 'motivo',
                  'setor', (select s.nome from public.plt_setores s where s.id = ev.setor_destino_id)) as h
                  from public.plt_eventos ev
                  left join public.plt_usuarios u on u.id = ev.usuario_id
                 where ev.card_id = v_card.id
                 order by ev.id desc
                 limit 80) z), '[]'::jsonb) end
  );
end;
$function$;

-- ----------------------------------------------------------------------------
-- 13 · Quem chama o quê
-- ----------------------------------------------------------------------------
revoke all on function plt_privado.fn_rota_padrao(date, bigint)                    from public, anon, authenticated;
revoke all on function plt_privado.fn_equipe_herdar(date, bigint, integer, uuid)   from public, anon, authenticated;
revoke all on function plt_privado.fn_logar_programacao()                          from public, anon, authenticated;

revoke all on function public.plt_fn_programar_entrega(bigint, date, bigint, integer)        from public, anon;
revoke all on function public.plt_fn_ordenar_rota(date, bigint, bigint[], integer)           from public, anon;
revoke all on function public.plt_fn_programar_rota(date, bigint, bigint[], bigint[], integer) from public, anon;
revoke all on function public.plt_fn_equipe_definir(date, bigint, uuid[], integer)           from public, anon;
revoke all on function public.plt_fn_rotas_do_dia(date)                                       from public, anon;
revoke all on function public.plt_fn_entregas_do_dia(date, bigint, integer)                  from public, anon;
revoke all on function public.plt_fn_programadas(boolean, date, bigint, integer, integer)    from public, anon;
grant execute on function public.plt_fn_programar_entrega(bigint, date, bigint, integer)        to authenticated;
grant execute on function public.plt_fn_ordenar_rota(date, bigint, bigint[], integer)           to authenticated;
grant execute on function public.plt_fn_programar_rota(date, bigint, bigint[], bigint[], integer) to authenticated;
grant execute on function public.plt_fn_equipe_definir(date, bigint, uuid[], integer)           to authenticated;
grant execute on function public.plt_fn_rotas_do_dia(date)                                       to authenticated;
grant execute on function public.plt_fn_entregas_do_dia(date, bigint, integer)                  to authenticated;
grant execute on function public.plt_fn_programadas(boolean, date, bigint, integer, integer)    to authenticated;
