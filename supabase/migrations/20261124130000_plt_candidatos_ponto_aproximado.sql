-- ============================================================================
-- Ajuste de 24/11 (validação dos endereços da SESSAO-57, pedido do dono:
-- "Sim, corrija") — a aba "Programar" passa a saber que o ponto é aproximado
-- ============================================================================
-- Na validação dos endereços um por um (24/11, site publicado), 8 pedidos sem
-- programação estavam com o pino no centro da cidade e o cartão da aba
-- "Programar" NÃO avisava: a porta plt_fn_programacao_candidatos (recriada na
-- SESSAO-50) não devolvia geo_aproximado, geo_manual nem cep — as outras duas
-- portas (plt_fn_programacao e plt_fn_programadas) já devolvem. Sem esses
-- campos, na aba "Programar":
--   · o cartão não mostra o aviso "ponto aproximado · Ajustar o pino";
--   · a nova tentativa do ponto da cidade depois de 7 dias não acontece;
--   · "Ajustar o pino" não confere o pino contra o CEP (a SESSAO-57).
--
-- A forma: as três chaves entram em cada item, com a MESMA regra da porta de
-- "Já programadas" (geo_manual = fonte 'manual'; geo_aproximado = o que vem
-- depois de 'aprox_' na fonte). O cache (plt_geocache) já é lido pela chave na
-- página; o CEP vem da visão de endereço que a porta já lia. Nenhuma leitura
-- nova, nenhuma tabela, índice ou permissão mudam (create or replace mantém os
-- grants da 20261027080000).
--
-- Recriação por EXTRAÇÃO da versão vigente:
--   plt_fn_programacao_candidatos ← 20261112060000_plt_editar_endereco.sql:1392-1594
--   (conferida igual à do banco em 24/11 antes de escrever).
-- ATENÇÃO para a frente da SESSAO-53 (ainda não aplicada): ela recria esta
-- mesma porta a partir da 20261112060000 — ao entrar, precisa levar estas três
-- chaves junto, ou o aviso some de novo da aba "Programar".
-- ============================================================================

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
           ee.cep,
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
               -- ajuste 24/11: o CEP, o ponto marcado à mão e o ponto aproximado
               -- (pelo bairro ou pela cidade) — a mesma regra de "Já programadas"
               'cep', pg.cep,
               'geo_manual', coalesce(g.fonte = 'manual', false),
               'geo_aproximado', case when left(g.fonte, 6) = 'aprox_' then substr(g.fonte, 7) end,
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
             )
             -- SESSAO-50 (bloco C): o endereço alterado na plataforma — o selo do cartão,
             -- com o original do Tiny ao lado (a chave só nasce quando há — E-237)
             || case when pe.pedido_id is null then '{}'::jsonb
                     else jsonb_build_object('endereco_plataforma', jsonb_build_object(
                            'original', pe.tiny_original, 'tiny_confirmado_em', pe.tiny_confirmado_em)) end
             order by pg.posicao)
        from pagina pg
        left join public.plt_geocache g
               on pg.endereco_geocodificavel is not null
              and g.chave = md5(lower(pg.endereco_geocodificavel))
        -- SESSAO-50 (bloco C): só as linhas da página (até 200), pela chave
        left join public.plt_pedido_enderecos pe on pe.pedido_id = pg.pedido_id
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
