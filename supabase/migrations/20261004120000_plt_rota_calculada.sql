-- ============================================================================
-- Migration 54 · Rota calculada no mapa (SESSAO-28 — D-108, D-109, D-110)
-- ============================================================================
-- A linha da Programação deixa de ser reta: a rota pelas ruas (serviço gratuito
-- de rotas, OSRM) parte da fábrica e volta para ela. Esta migration dá ao banco
-- o que a tela precisa para isso:
--
--   1. plt_geocache.rota (jsonb) — o CACHE da rota calculada. Sem tabela nova
--      (D-47): a mesma "gaveta" dos endereços achados no mapa guarda a rota,
--      com chave própria ('rota:carro:<lon,lat;…>') e fonte 'osrm'. Quem
--      escreve é a Edge Function `calcular-rota` (chave de serviço); o
--      navegador só lê (a policy de leitura é a de sempre). A geocodificação
--      não muda nada (as chaves dela são md5 de endereço — nunca colidem).
--   2. plt_programacoes.ordem — a ordem das paradas de UM caminhão num dia,
--      ajustada à mão e salva (D-109). Nula = sem ordem salva (a tela usa a
--      sugestão do mais perto a partir da fábrica). Trocar o dia ou o caminhão
--      de um pedido zera a ordem dele (vai para o fim da rota nova).
--   3. plt_fn_ordenar_rota — o gesto "Salvar ordem": grava a ordem de um
--      caminhão num dia e deixa UMA linha na trilha (D-40). Lista vazia = volta
--      à sugestão automática.
--   4. fn_logar_programacao — mudança SÓ de ordem não vira N linhas de
--      "Reprogramou a entrega" (quem registra é o gesto do item 3).
--   5. plt_fn_programacao — a porta do mapa devolve a ordem salva (muda de
--      forma: drop + create; as migrations 25 e 39 ganharam o drop — E-17).
--
-- Não toca em tabela da integração. Reaplicável (duas rodadas no harness).
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · O cache da rota mora no cache do mapa (D-47)
-- ----------------------------------------------------------------------------
alter table public.plt_geocache add column if not exists rota jsonb;

comment on table public.plt_geocache is
  'Cache do mapa (SESSAO-15/Q-65 + SESSAO-28/D-108). Endereço → ponto: chave = md5 do endereço normalizado (calculada no banco — plt_fn_programacao), fonte nominatim; resolvido=false com consultado_em recente = "sem ponto" (não insistir). Rota pelas ruas: chave = ''rota:carro:'' + os pontos em ordem (lon,lat com 5 casas, separados por ;), fonte osrm, a rota em `rota`; resolvido=false = o serviço não achou caminho. Escrito só pelas Edge Functions (geocodificar, calcular-rota); o navegador só lê.';

comment on column public.plt_geocache.rota is
  'SESSAO-28 (D-108): a rota calculada pelas ruas — {distancia_m, duracao_s, trechos: [{distancia_m, duracao_s}], geometria (linha codificada, precisão 5), servidor}. Nula nas linhas de endereço.';

-- ----------------------------------------------------------------------------
-- 2 · A ordem das paradas (D-109)
-- ----------------------------------------------------------------------------
alter table public.plt_programacoes add column if not exists ordem integer;

alter table public.plt_programacoes drop constraint if exists plt_programacoes_ordem_ck;
alter table public.plt_programacoes
  add constraint plt_programacoes_ordem_ck check (ordem is null or ordem >= 1);

comment on column public.plt_programacoes.ordem is
  'SESSAO-28 (D-109): a posição da parada na rota do caminhão naquele dia, salva à mão ("Salvar ordem"). Nula = sem ordem salva — a tela sugere o mais perto a partir da fábrica. Trocar dia/caminhão zera.';

-- ----------------------------------------------------------------------------
-- 3 · A trilha da programação: mudar SÓ a ordem não é "reprogramar"
--     (recriada por inteiro a partir da migration 25 — só a troca marcada)
-- ----------------------------------------------------------------------------
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
                                'caminhao_id', new.caminhao_id);
  elsif tg_op = 'DELETE' then
    v_acao := 'programacao_removida';
    v_ctx := jsonb_build_object('card_id', old.card_id, 'data', old.data_entrega,
                                'caminhao_id', old.caminhao_id);
  else
    -- SESSAO-28 (D-109): só a ordem mudou → quem registra é o gesto
    -- "Salvar ordem" (plt_fn_ordenar_rota), uma linha para a rota inteira.
    if new.data_entrega is not distinct from old.data_entrega
       and new.caminhao_id is not distinct from old.caminhao_id
       and new.ordem is distinct from old.ordem then
      return null;
    end if;
    v_acao := 'entrega_reprogramada';
    v_ctx := jsonb_strip_nulls(jsonb_build_object(
      'card_id', new.card_id,
      'data_antes',     case when new.data_entrega is distinct from old.data_entrega then old.data_entrega end,
      'data_depois',    case when new.data_entrega is distinct from old.data_entrega then new.data_entrega end,
      'caminhao_antes', case when new.caminhao_id  is distinct from old.caminhao_id  then old.caminhao_id  end,
      'caminhao_depois',case when new.caminhao_id  is distinct from old.caminhao_id  then new.caminhao_id  end));
  end if;

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
  values (plt_privado.fn_usuario_atual(), v_acao, v_ctx);
  return null;
end;
$$;

revoke all on function plt_privado.fn_logar_programacao() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4 · Programar/reprogramar: trocar o dia ou o caminhão zera a ordem
--     (recriada por inteiro a partir da migration 25 — só a troca marcada)
-- ----------------------------------------------------------------------------
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
  if exists (select 1 from public.plt_eventos e
              where e.card_id = p_card_id and e.tipo = 'pedido_entregue') then
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

comment on function public.plt_fn_programar_entrega(bigint, date, bigint) is
  'Programar/reprogramar (SESSAO-15/D-39/D-45): data + caminhão para um pedido lançado e não entregue. Gate da logística; cada mudança vai para a trilha. SESSAO-28 (D-109): trocar dia/caminhão zera a ordem salva.';

-- ----------------------------------------------------------------------------
-- 5 · "Salvar ordem" (D-109): a ordem das paradas de um caminhão num dia
-- ----------------------------------------------------------------------------
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
   where exists (select 1 from public.plt_eventos e where e.card_id = x and e.tipo = 'pedido_entregue')
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

comment on function public.plt_fn_ordenar_rota(date, bigint, bigint[]) is
  'SESSAO-28 (D-109): "Salvar ordem" — grava a ordem das paradas de um caminhão num dia (lista vazia = volta à sugestão automática). Gate da logística; nunca depois de entregue; uma linha na trilha (rota_ordem_salva).';

revoke all on function public.plt_fn_ordenar_rota(date, bigint, bigint[]) from public, anon;
grant execute on function public.plt_fn_ordenar_rota(date, bigint, bigint[]) to authenticated;

-- ----------------------------------------------------------------------------
-- 6 · A porta do mapa devolve a ordem salva (recriada a partir da migration 39,
--     com a coluna `ordem` a mais; muda de forma → drop + create — E-17)
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_programacao(date, integer, integer);

create function public.plt_fn_programacao(
  p_data         date    default null,
  p_limite       integer default 100,
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
  endereco_geocodificavel text,
  geo_chave               text,
  latitude                double precision,
  longitude               double precision,
  geo_resolvido           boolean,
  geo_consultado_em       timestamptz,
  total_unidades          integer,
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
        -- D-63: frete não conta.
        select coalesce(sum(v.unidades), 0)::int as total_unidades
          from plt_privado.vw_itens_producao v where v.pedido_id = p.id
      ) i on true
      left join public.plt_programacoes pr on pr.card_id = pc.id
      left join public.plt_caminhoes cam on cam.id = pr.caminhao_id
     where pc.tipo = 'pedido' and pc.arquivado_em is null
       and pc.lancado_rotas_em is not null
       and not exists (select 1 from public.plt_eventos e
                        where e.card_id = pc.id and e.tipo = 'pedido_entregue')
  )
  select b.card_id, b.pedido_id, b.numero, b.cliente_nome,
         b.endereco, b.numero_endereco, b.complemento, b.bairro, b.cidade, b.uf,
         b.endereco_geocodificavel,
         case when b.endereco_geocodificavel is null then null
              else md5(lower(b.endereco_geocodificavel)) end as geo_chave,
         g.latitude, g.longitude,
         g.resolvido       as geo_resolvido,
         g.consultado_em   as geo_consultado_em,
         b.total_unidades, b.data_prevista, b.lancado_em,
         b.programacao_data, b.caminhao_id, b.caminhao_nome,
         b.ordem,
         count(*) over () as contagem_total
    from base b
    left join public.plt_geocache g
           on b.endereco_geocodificavel is not null
          and g.chave = md5(lower(b.endereco_geocodificavel))
   where plt_privado.fn_pode_ver_expedicao()
     and (b.programacao_data is null or p_data is null or b.programacao_data = p_data)
   order by (b.programacao_data is not null), b.data_prevista asc nulls last, b.numero
   limit least(greatest(coalesce(p_limite, 100), 1), 200)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_programacao(date, integer, integer) is
  'A porta do mapa da Programação (SESSAO-15/D-39): pedidos lançados SEM programação + os programados no dia pedido, com o ponto do cache. SESSAO-28 (D-109/D-110): devolve também a ordem salva de cada parada (nula = sugestão).';

revoke all on function public.plt_fn_programacao(date, integer, integer) from public, anon;
grant execute on function public.plt_fn_programacao(date, integer, integer) to authenticated;
