-- ============================================================================
-- SESSAO-41 · filtros da Programação de caminhão (27/10/2026) — D-199
--
-- Pedido do dono: "Na tela de programação de um caminhão, adicione alguns
-- filtros variados também, seja por ordenar por ordem alfabética e tudo mais".
-- Respostas do dono:
--   · na lista para PROGRAMAR (os pedidos sem rota): busca por texto (cliente,
--     nº do pedido, bairro, cidade, móvel), situação (pronto / em produção /
--     no PCP), cidade e bairro, previsão de entrega (atrasados, hoje, esta
--     semana, próximos 15 dias, sem previsão);
--   · ordens novas: cliente de A a Z e de Z a A, mais peças primeiro, pedido
--     mais novo e mais antigo (pela data do pedido) — junto das de antes;
--   · nas DUAS abas: em "Já programadas", a busca e o filtro por caminhão e
--     por dia (a ordem das paradas segue a da rota).
--
-- Quem filtra e ordena é o SERVIDOR (regras 17/18 — a busca acha o pedido
-- mesmo fora dos 200 que a lista mostra). Uma requisição por tela: a porta
-- nova da aba Programar devolve, junto com a página, o total, as contagens e
-- as cidades/bairros dos pedidos (as opções dos filtros). "Mais perto" segue na
-- tela (depende da rota que se monta).
--
-- Aditiva e compatível com o site de antes: a porta da aba Programar é NOVA
-- (a de antes fica como está); `plt_fn_programadas` só GANHA `p_busca`
-- (drop + create — o site de antes chama pelos nomes, sem ela).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · a aba Programar: os pedidos sem programação, filtrados e ordenados
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_programacao_candidatos(
  p_busca text default null,
  p_estado text default null,
  p_cidade text default null,
  p_bairro text default null,
  p_previsao text default null,
  p_ordem text default null,
  p_limite integer default 200
)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  with base as (
    -- o MESMO conjunto de plt_fn_programacao(…, p_so_sem_programacao => true)
    select v.card_id,
           v.pedido_id,
           v.numero,
           coalesce(c.nome, '')         as cliente_nome,
           ee.endereco,
           ee.numero                     as numero_endereco,
           ee.complemento,
           ee.bairro,
           ee.cidade,
           ee.uf,
           plt_privado.fn_endereco_geocodificavel(
             ee.endereco, ee.numero, ee.bairro, ee.cidade, ee.uf, ee.cep) as endereco_geocodificavel,
           v.total_unidades,
           coalesce(i.itens, '[]'::jsonb) as itens,
           i.descricoes,
           v.data_prevista,
           p.data_pedido,
           v.lancado_rotas_em            as lancado_em,
           v.estado,
           v.unidades_prontas,
           v.unidades_liberadas,
           -- as chaves dos filtros e da ordem (sem acento, minúscula)
           plt_privado.fn_nome_comparavel(ee.cidade) as cidade_chave,
           plt_privado.fn_nome_comparavel(ee.bairro) as bairro_chave,
           lower(translate(coalesce(c.nome, ''),
                           'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
                           'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')) as cliente_ordem
      from plt_privado.vw_pedidos_para_rota v
      join public.pedidos p on p.id = v.pedido_id
      left join public.clientes c on c.id = v.cliente_id
      left join plt_privado.vw_endereco_entrega ee on ee.pedido_id = v.pedido_id
      left join lateral (
        -- D-63: frete não conta nem aparece; os móveis com a quantidade.
        select jsonb_agg(jsonb_build_object('descricao', coalesce(nullif(btrim(it.descricao), ''), 'Item sem descrição'),
                                            'quantidade', it.unidades) order by it.seq)
                 filter (where not it.eh_frete and it.unidades > 0) as itens,
               string_agg(it.descricao, '|') filter (where not it.eh_frete and it.unidades > 0) as descricoes
          from plt_privado.vw_itens_producao it where it.pedido_id = v.pedido_id
      ) i on true
     where v.programacao_data is null
       and plt_privado.fn_pode_ver_expedicao()
  ),
  -- o dia de hoje na fábrica (Natal, sem horário de verão); a semana é a do
  -- calendário da Programação: domingo a sábado
  dia as (
    select d.hoje,
           d.hoje - extract(dow from d.hoje)::int as domingo
      from (select (now() at time zone 'America/Fortaleza')::date as hoje) d
  ),
  -- o texto da busca como nos quadros (SESSAO-40): só dígitos (ou "pedido N",
  -- "#N") = o número que começa com; senão o nome que contém, sem acento
  f as (select * from plt_privado.fn_filtro_do_quadro(p_busca)),
  filtro as (
    select nullif(plt_privado.fn_nome_comparavel(p_cidade), '') as cidade,
           nullif(plt_privado.fn_nome_comparavel(p_bairro), '') as bairro
  ),
  filtrados as (
    select b.*
      from base b, dia, f, filtro fl
     where (p_estado is null or b.estado = p_estado)
       and (fl.cidade is null or b.cidade_chave = fl.cidade)
       and (fl.bairro is null or b.bairro_chave = fl.bairro)
       and (case p_previsao
              when 'atrasados' then b.data_prevista < dia.hoje
              when 'hoje'      then b.data_prevista = dia.hoje
              when 'semana'    then b.data_prevista between dia.domingo and dia.domingo + 6
              when 'quinze'    then b.data_prevista between dia.hoje and dia.hoje + 14
              when 'sem'       then b.data_prevista is null
              else true
            end)
       and (not f.ativo
            or (f.numero is not null and b.numero::text like f.numero || '%')
            or (f.nome is not null
                and plt_privado.fn_nome_comparavel(
                      concat_ws('|', b.cliente_nome, b.endereco, b.bairro, b.cidade, b.descricoes))
                    like '%' || f.nome || '%'))
  ),
  pagina as (
    select x.*, row_number() over (order by
             -- cliente de A a Z / de Z a A (o pedido sem cliente vai para o fim)
             case when p_ordem in ('cliente_az', 'cliente_za') then x.cliente_ordem = '' end,
             case when p_ordem = 'cliente_az' then x.cliente_ordem end asc,
             case when p_ordem = 'cliente_za' then x.cliente_ordem end desc,
             -- mais peças primeiro
             case when p_ordem = 'pecas' then x.total_unidades end desc,
             -- pela data do pedido (sem data, no fim)
             case when p_ordem = 'mais_novo' then x.data_pedido end desc nulls last,
             case when p_ordem = 'mais_novo' then x.numero end desc,
             case when p_ordem = 'mais_antigo' then x.data_pedido end asc nulls last,
             case when p_ordem = 'numero' then x.numero end asc,
             -- o de sempre (e o desempate): o dia de entrega mais perto
             x.data_prevista asc nulls last,
             x.numero) as posicao
      from filtrados x
     order by posicao
     limit least(greatest(coalesce(p_limite, 200), 1), 200)
  )
  select jsonb_build_object(
    'itens', coalesce((
      select jsonb_agg(jsonb_build_object(
               'card_id', pg.card_id,
               'pedido_id', pg.pedido_id,
               'numero', pg.numero,
               'cliente_nome', pg.cliente_nome,
               'endereco', pg.endereco,
               'numero_endereco', pg.numero_endereco,
               'complemento', pg.complemento,
               'bairro', pg.bairro,
               'cidade', pg.cidade,
               'uf', pg.uf,
               'endereco_geocodificavel', pg.endereco_geocodificavel,
               'geo_chave', case when pg.endereco_geocodificavel is null then null
                                 else md5(lower(pg.endereco_geocodificavel)) end,
               'latitude', g.latitude,
               'longitude', g.longitude,
               'geo_resolvido', g.resolvido,
               'geo_consultado_em', g.consultado_em,
               'total_unidades', pg.total_unidades,
               'itens', pg.itens,
               'data_prevista', pg.data_prevista,
               'data_pedido', pg.data_pedido,
               'lancado_em', pg.lancado_em,
               'programacao_data', null,
               'caminhao_id', null,
               'caminhao_nome', null,
               'ordem', null,
               'estado', pg.estado,
               'unidades_prontas', pg.unidades_prontas,
               'unidades_liberadas', pg.unidades_liberadas
             ) order by pg.posicao)
        from pagina pg
        left join public.plt_geocache g
               on pg.endereco_geocodificavel is not null
              and g.chave = md5(lower(pg.endereco_geocodificavel))
    ), '[]'::jsonb),
    'total', (select count(*) from filtrados),
    'total_geral', (select count(*) from base),
    -- quantos há de cada (sobre TODOS os sem programação — as opções não somem)
    'contagens', (
      select jsonb_build_object(
               'pronto',      count(*) filter (where b.estado = 'pronto'),
               'em_producao', count(*) filter (where b.estado = 'em_producao'),
               'no_pcp',      count(*) filter (where b.estado = 'no_pcp'),
               'atrasados',   count(*) filter (where b.data_prevista < dia.hoje),
               'hoje',        count(*) filter (where b.data_prevista = dia.hoje),
               'semana',      count(*) filter (where b.data_prevista between dia.domingo and dia.domingo + 6),
               'quinze',      count(*) filter (where b.data_prevista between dia.hoje and dia.hoje + 14),
               'sem',         count(*) filter (where b.data_prevista is null))
        from base b, dia
    ),
    -- as cidades dos pedidos (a grafia mais comum de cada uma)
    'cidades', coalesce((
      select jsonb_agg(jsonb_build_object('cidade', c.cidade, 'uf', c.uf, 'n', c.n)
                       order by c.n desc, c.cidade)
        from (select mode() within group (order by b.cidade) as cidade,
                     mode() within group (order by b.uf) as uf,
                     count(*) as n
                from base b
               where b.cidade_chave <> ''
               group by b.cidade_chave) c
    ), '[]'::jsonb),
    -- os bairros (da cidade escolhida, ou de todas — cada um com a sua cidade)
    'bairros', coalesce((
      select jsonb_agg(jsonb_build_object('bairro', x.bairro, 'cidade', x.cidade, 'n', x.n)
                       order by x.bairro_ordem, x.cidade)
        from (select mode() within group (order by b.bairro) as bairro,
                     mode() within group (order by b.cidade) as cidade,
                     min(b.bairro_chave) as bairro_ordem,
                     count(*) as n
                from base b, filtro fl
               where b.bairro_chave <> ''
                 and (fl.cidade is null or b.cidade_chave = fl.cidade)
               group by b.cidade_chave, b.bairro_chave
               order by min(b.bairro_chave)
               limit 300) x
    ), '[]'::jsonb)
  );
$function$;

comment on function public.plt_fn_programacao_candidatos(text, text, text, text, text, text, integer) is
  'SESSAO-41 · D-199: a aba Programar — os pedidos sem programação (o conjunto de plt_fn_programacao com p_so_sem_programacao), filtrados no servidor (busca: nº do pedido que começa com, ou cliente/endereço/bairro/cidade/móvel que contém, sem acento; situação; cidade; bairro; previsão atrasados|hoje|semana (domingo a sábado)|quinze|sem) e ordenados (entrega|numero|cliente_az|cliente_za|pecas|mais_novo|mais_antigo), até 200. Devolve {itens, total, total_geral, contagens, cidades, bairros} numa requisição só.';

revoke all on function public.plt_fn_programacao_candidatos(text, text, text, text, text, text, integer) from public, anon;
grant execute on function public.plt_fn_programacao_candidatos(text, text, text, text, text, text, integer) to authenticated;

-- ----------------------------------------------------------------------------
-- 2 · "Já programadas": a busca acha a ROTA (a rota inteira aparece — o mapa
--     e a ordem das paradas não se quebram); caminhão e dia já eram filtros
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_programadas(boolean, date, bigint, integer, integer);
CREATE OR REPLACE FUNCTION public.plt_fn_programadas(p_entregues boolean DEFAULT false, p_data date DEFAULT NULL::date, p_caminhao_id bigint DEFAULT NULL::bigint, p_limite integer DEFAULT 50, p_deslocamento integer DEFAULT 0, p_busca text DEFAULT NULL::text)
 RETURNS TABLE(card_id bigint, pedido_id bigint, numero integer, cliente_nome text, endereco text, numero_endereco text, complemento text, bairro text, cidade text, uf text, geo_chave text, latitude double precision, longitude double precision, geo_resolvido boolean, endereco_geocodificavel text, geo_consultado_em timestamp with time zone, total_unidades integer, itens jsonb, data_prevista date, programacao_data date, caminhao_id bigint, caminhao_nome text, caminhao_placa text, rota integer, ordem integer, entregue_em timestamp with time zone, detalhe text, equipe text[], estado text, unidades_prontas integer, unidades_liberadas integer, contagem_total bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with base as (
    select pc.id                         as card_id,
           p.id                          as pedido_id,
           p.numero,
           coalesce(c.nome, '')          as cliente_nome,
           ee.endereco,
           ee.numero                      as numero_endereco,
           ee.complemento,
           ee.bairro,
           ee.cidade,
           ee.uf,
           plt_privado.fn_endereco_geocodificavel(
             ee.endereco, ee.numero, ee.bairro, ee.cidade, ee.uf, ee.cep) as endereco_geocodificavel,
           coalesce(i.total_unidades, 0) as total_unidades,
           coalesce(i.itens, '[]'::jsonb) as itens,
           plt_privado.fn_data_entrega(p.id, p.data_prevista) as data_prevista,
           pr.data_entrega               as programacao_data,
           cam.id                        as caminhao_id,
           cam.nome                      as caminhao_nome,
           cam.placa                     as caminhao_placa,
           pr.rota::int                  as rota,
           pr.ordem,
           ent.ocorrido_em               as entregue_em,
           pr.detalhe,
           eq.nomes                      as equipe,
           pp.estado,
           pp.unidades_prontas,
           pp.unidades_liberadas
      from public.plt_programacoes pr
      join public.plt_cards pc on pc.id = pr.card_id
      join public.pedidos p on p.id = pc.pedido_id
      left join public.clientes c on c.id = p.cliente_id
      left join plt_privado.vw_endereco_entrega ee on ee.pedido_id = p.id
      left join public.plt_caminhoes cam on cam.id = pr.caminhao_id
      left join plt_privado.vw_pedido_prontidao pp on pp.card_id = pc.id
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
      -- SESSAO-37 (pedido do dono, 19/10): a equipe da rota aparece no card
      left join lateral (
        select array_agg(u.nome order by u.nome) as nomes
          from public.plt_programacao_equipes pe
          join public.plt_usuarios u on u.id = pe.usuario_id
         where pe.data_entrega = pr.data_entrega
           and pe.caminhao_id = pr.caminhao_id
           and pe.rota = pr.rota
      ) eq on true
     where pc.tipo = 'pedido'
       -- SESSAO-38: o card que saiu com a entrega (pedido nunca lançado) ainda
       -- conta no histórico das entregues
       and (pc.arquivado_em is null
            or (coalesce(p_entregues, false) and pc.entrega_evento_id is not null))
       and (p_data is null or pr.data_entrega = p_data)
       and (p_caminhao_id is null or pr.caminhao_id = p_caminhao_id)
       and (case when coalesce(p_entregues, false) then ent.ocorrido_em is not null
                 else ent.ocorrido_em is null end)
  ),
  -- SESSAO-41 · D-199: a busca (como nos quadros — nº do pedido que começa com,
  -- ou o nome que contém, sem acento) acha a ROTA: o pedido que bate (cliente,
  -- endereço, bairro, cidade, móvel) ou a parada avulsa dela (título, endereço,
  -- observação) — e a rota aparece INTEIRA (mapa e ordem não se quebram).
  f as (select * from plt_privado.fn_filtro_do_quadro(p_busca)),
  rotas_que_batem as (
    select b.programacao_data, b.caminhao_id, b.rota
      from base b, f
     where f.ativo
       and ((f.numero is not null and b.numero::text like f.numero || '%')
            or (f.nome is not null
                and plt_privado.fn_nome_comparavel(concat_ws('|',
                      b.cliente_nome, b.endereco, b.bairro, b.cidade,
                      (select string_agg(x.item->>'descricao', '|')
                         from jsonb_array_elements(b.itens) as x(item))))
                    like '%' || f.nome || '%'))
    union
    select pa.data_entrega, pa.caminhao_id, pa.rota::int
      from public.plt_paradas_avulsas pa, f
     where f.nome is not null
       and pa.removida_em is null
       and (p_data is null or pa.data_entrega = p_data)
       and (p_caminhao_id is null or pa.caminhao_id = p_caminhao_id)
       and plt_privado.fn_nome_comparavel(concat_ws('|', pa.titulo, pa.endereco, pa.observacao))
           like '%' || f.nome || '%'
  )
  select b.card_id, b.pedido_id, b.numero, b.cliente_nome,
         b.endereco, b.numero_endereco, b.complemento, b.bairro, b.cidade, b.uf,
         case when b.endereco_geocodificavel is null then null
              else md5(lower(b.endereco_geocodificavel)) end as geo_chave,
         g.latitude, g.longitude, g.resolvido as geo_resolvido,
         b.endereco_geocodificavel, g.consultado_em as geo_consultado_em,
         b.total_unidades, b.itens, b.data_prevista,
         b.programacao_data, b.caminhao_id, b.caminhao_nome, b.caminhao_placa,
         b.rota, b.ordem, b.entregue_em, b.detalhe,
         coalesce(b.equipe, '{}'::text[]) as equipe,
         b.estado, b.unidades_prontas, b.unidades_liberadas,
         count(*) over () as contagem_total
    from base b
    left join public.plt_geocache g
           on b.endereco_geocodificavel is not null
          and g.chave = md5(lower(b.endereco_geocodificavel))
   where plt_privado.fn_pode_ver_expedicao()
     and (not (select f.ativo from f)
          or (b.programacao_data, b.caminhao_id, b.rota) in (select * from rotas_que_batem))
   order by case when coalesce(p_entregues, false) then null else b.programacao_data end asc,
            case when coalesce(p_entregues, false) then b.programacao_data end desc,
            b.caminhao_nome, b.caminhao_id, b.rota, b.ordem nulls last, b.numero
   limit least(greatest(coalesce(p_limite, 50), 1), 200)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$function$;

revoke all on function public.plt_fn_programadas(boolean, date, bigint, integer, integer, text) from public, anon;
grant execute on function public.plt_fn_programadas(boolean, date, bigint, integer, integer, text) to authenticated;
