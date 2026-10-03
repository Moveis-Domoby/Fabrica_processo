-- ============================================================================
-- Migration 55 · Programação: itens de cada pedido, "Já programadas" e
-- programar a rota inteira de uma vez (ajustes da SESSAO-28 — D-111)
-- ============================================================================
-- Pedidos do dono depois de testar a rota calculada (03/10):
--   · "eu devo conseguir sempre ver quais itens vão em cada pedido" → a porta
--     do mapa devolve os móveis de cada pedido (sem o frete — D-63);
--   · "ver todas as programações já realizadas" + a aba filha "Já programadas"
--     → porta nova, paginada no servidor, só as não entregues (e as entregues
--     quando a pessoa pede);
--   · a aba "Programar" deixa de trazer os programados do dia → parâmetro novo
--     `p_so_sem_programacao` (o site antigo continua chamando sem ele);
--   · programar N pedidos era N chamadas (uma por pedido) — parte do "pesado e
--     lento" → `plt_fn_programar_rota` faz tudo numa transação só (e a ordem da
--     rota junto, se vier).
--
-- Não toca em tabela nenhuma (nem da integração, nem da plataforma). Reaplicável.
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · A porta do mapa: + `itens`, + `p_so_sem_programacao` (muda de forma e de
--     assinatura → drop das duas formas + create — E-17/A-12)
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_programacao(date, integer, integer);
drop function if exists public.plt_fn_programacao(date, integer, integer, boolean);

create function public.plt_fn_programacao(
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

comment on function public.plt_fn_programacao(date, integer, integer, boolean) is
  'A porta do mapa da Programação (SESSAO-15/D-39): pedidos lançados SEM programação (+ os programados no dia pedido, a não ser com p_so_sem_programacao) com o ponto do cache, a ordem salva (D-109) e os móveis de cada pedido sem o frete (D-111).';

revoke all on function public.plt_fn_programacao(date, integer, integer, boolean) from public, anon;
grant execute on function public.plt_fn_programacao(date, integer, integer, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- 2 · "Já programadas" (D-111): todas as programações, paginadas no servidor —
--     as que ainda não foram entregues (do dia mais perto ao mais longe) ou,
--     quando a pessoa pede, as entregues (da mais recente para trás)
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
         where e.card_id = pc.id and e.tipo = 'pedido_entregue'
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

comment on function public.plt_fn_programadas(boolean, date, bigint, integer, integer) is
  'Já programadas (SESSAO-28 ajustes / D-111): as programações não entregues (dia mais perto primeiro, por caminhão e ordem) ou, com p_entregues, as entregues (mais recentes primeiro); filtro opcional por dia e caminhão; paginada no servidor; gate da logística.';

revoke all on function public.plt_fn_programadas(boolean, date, bigint, integer, integer) from public, anon;
grant execute on function public.plt_fn_programadas(boolean, date, bigint, integer, integer) to authenticated;

-- ----------------------------------------------------------------------------
-- 3 · Programar a rota inteira numa chamada só (D-111): cada pedido pela porta
--     de sempre (as mesmas travas e a mesma trilha) e, se vier, a ordem da rota
--     do caminhão naquele dia. Tudo ou nada — uma falha desfaz o lote inteiro.
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_programar_rota(
  p_data        date,
  p_caminhao_id bigint,
  p_card_ids    bigint[],
  p_ordem       bigint[] default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card bigint;
begin
  if coalesce(cardinality(p_card_ids), 0) = 0 then
    raise exception 'Escolha ao menos um pedido para programar.' using errcode = 'check_violation';
  end if;
  if cardinality(p_card_ids) > 200 then
    raise exception 'Pedidos demais numa programação só.' using errcode = 'check_violation';
  end if;
  foreach v_card in array p_card_ids loop
    perform public.plt_fn_programar_entrega(v_card, p_data, p_caminhao_id);
  end loop;
  if p_ordem is not null then
    perform public.plt_fn_ordenar_rota(p_data, p_caminhao_id, p_ordem);
  end if;
  return cardinality(p_card_ids);
end;
$$;

comment on function public.plt_fn_programar_rota(date, bigint, bigint[], bigint[]) is
  'SESSAO-28 ajustes (D-111): programa vários pedidos no mesmo dia e caminhão numa transação só (cada um pela plt_fn_programar_entrega — mesmas travas e trilha) e, com p_ordem, salva a ordem da rota (plt_fn_ordenar_rota).';

revoke all on function public.plt_fn_programar_rota(date, bigint, bigint[], bigint[]) from public, anon;
grant execute on function public.plt_fn_programar_rota(date, bigint, bigint[], bigint[]) to authenticated;
