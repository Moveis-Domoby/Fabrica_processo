-- ============================================================================
-- SESSAO-53 — "Entregue em parte" também na Programação, na Expedição e nas
-- Entregas do dia
-- ============================================================================
-- A dívida da D-328, item 1 (SESSAO-51): o pedido entregue em parte já dizia
-- "Entregue em parte (N de M)" na ficha, no card do PCP, na lista de Pedidos e
-- na busca; faltavam a Programação (Programar e Já programadas), a Expedição e
-- as Entregas do dia.
--
-- A forma (escolha da sessão, registrada no diário):
--   · uma regra só — a visão plt_privado.vw_entregue_em_parte (card do pedido → selo): quantas
--     saíram, de quantas, quando, e quantas seguem na fábrica (peças vivas em
--     setor de entrada/produção + produtos ainda sem liberar no PCP) enquanto a
--     decisão que vale é "deixar em produção" e o resto não foi entregue. É a
--     mesma conta da ficha do pedido (fn_parcial_estado). Depois que o resto é
--     entregue o selo some (a regra da lista de Pedidos: vira "Entregue").
--   · cada tela recebe a informação NA PORTA QUE JÁ TINHA (nenhuma requisição
--     nova): as três portas em jsonb só ganham a chave "entregue_em_parte" (que
--     só nasce quando há — E-237); a porta de "Já programadas" devolve tabela e
--     ganha UMA coluna jsonb "entregue_em_parte" (drop + create — E-178; a
--     20261109030000, que a recriava com "create or replace", passou a derrubar
--     a assinatura antes, para a bateria reaplicar tudo sem quebrar; em produção
--     nada muda). Coluna jsonb: o que mais vier a entrar no selo entra nela, sem
--     mudar a forma de novo.
--   · a regra é uma VISÃO (e não uma função chamada linha a linha): o banco a embute na
--     consulta de cada porta e planeja uma vez só; a conta só é feita para o pedido que
--     TEM entrega parcial, pela chave primária do card, só nas linhas da página.
--
-- Recriações por extração das versões vigentes (A-96/A-97/E-170):
--   plt_fn_programacao_candidatos  ← 20261112060000_plt_editar_endereco.sql:1392-1594
--   plt_fn_programadas             ← 20261109030000_plt_entrega_dia_real.sql:1465-1589
--   plt_fn_expedicao               ← 20261109020000_plt_pedido_adiantado_tiny.sql:853-970
--   plt_fn_entregas_do_dia         ← 20261112060000_plt_editar_endereco.sql:884-1057
-- Nada aqui altera tabela, índice, gatilho ou tabela da integração. O selo do
-- endereço alterado em "Já programadas" (D-324) NÃO foi tocado.
-- ============================================================================
set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 0 · A regra única do selo
-- ----------------------------------------------------------------------------
create or replace view plt_privado.vw_entregue_em_parte as
select c.id as card_id,
       jsonb_build_object('entregues', c.parcial_entregues, 'total', c.parcial_total, 'em', c.parcial_em)
       -- o que ainda está na fábrica: só enquanto o pedido segue vivo com "deixar em produção"
       || case when c.entrega_evento_id is null and c.parcial_decisao = 'manter'
               -- (a conta aparece UMA vez: zero vira nulo e a chave nula sai — nada de contar duas vezes)
               then jsonb_strip_nulls(jsonb_build_object('ainda_producao', nullif(
                      ((select count(*)
                          from public.plt_cards u
                          join public.plt_setores s on s.id = u.setor_atual_id
                         where u.pedido_id = c.pedido_id and u.tipo = 'unidade'
                           and u.arquivado_em is null and u.cancelada_em is null
                           and u.destino_pendente_em is null
                           and s.papel_no_fluxo in ('entrada', 'producao'))
                       + (select count(*)
                            from plt_privado.fn_vagas_pedido(c.pedido_id) w
                           where w.card_id is null and w.reserva_card_id is null))::int, 0)))
               else '{}'::jsonb end as selo
  from public.plt_cards c
 where c.tipo = 'pedido'
   and c.parcial_evento_id is not null
   -- depois que o RESTO é entregue, o pedido é "Entregue" (a regra da lista de Pedidos)
   and (c.entrega_evento_id is null or c.entrega_evento_id = c.parcial_evento_id);
comment on view plt_privado.vw_entregue_em_parte is
  'SESSAO-53: o selo "Entregue em parte (N de M)" de um pedido para as telas da logística (Programação, Expedição, Entregas do dia) — por card do pedido: entregues, total, em e, enquanto a decisão é "deixar em produção" e o resto não foi entregue, ainda_producao (peças vivas em entrada/produção + produtos sem liberar no PCP — a conta da ficha). Sem linha = sem entrega parcial, ou o resto já foi entregue. Lida sempre pela chave (card_id).';
revoke all on plt_privado.vw_entregue_em_parte from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 1 · Programação → Programar (recriada de 20261112060000_plt_editar_endereco.sql:1392-1594 — o jsonb só ganha a chave)
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
             )
             -- SESSAO-50 (bloco C): o endereço alterado na plataforma — o selo do cartão,
             -- com o original do Tiny ao lado (a chave só nasce quando há — E-237)
             || case when pe.pedido_id is null then '{}'::jsonb
                     else jsonb_build_object('endereco_plataforma', jsonb_build_object(
                            'original', pe.tiny_original, 'tiny_confirmado_em', pe.tiny_confirmado_em)) end
             -- SESSAO-53: o pedido entregue em parte — "Entregue em parte (N de M)" e quantos seguem na
             -- fábrica (a chave só nasce quando há — E-237)
             || case when ep.card_id is null then '{}'::jsonb
                     else jsonb_build_object('entregue_em_parte', ep.selo) end
             order by pg.posicao)
        from pagina pg
        left join public.plt_geocache g
               on pg.endereco_geocodificavel is not null
              and g.chave = md5(lower(pg.endereco_geocodificavel))
        -- SESSAO-50 (bloco C): só as linhas da página (até 200), pela chave
        left join public.plt_pedido_enderecos pe on pe.pedido_id = pg.pedido_id
        -- SESSAO-53: a regra do selo, pela chave primária do card do pedido (só as linhas da página)
        left join plt_privado.vw_entregue_em_parte ep on ep.card_id = pg.card_id
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

-- ----------------------------------------------------------------------------
-- 2 · Programação → Já programadas (recriada de 20261109030000_plt_entrega_dia_real.sql:1465-1589 — + a coluna
--     entregue_em_parte; forma nova de retorno → drop + create, as mesmas permissões)
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_programadas(boolean, date, bigint, integer, integer, text);
CREATE FUNCTION public.plt_fn_programadas(p_entregues boolean DEFAULT false, p_data date DEFAULT NULL::date, p_caminhao_id bigint DEFAULT NULL::bigint, p_limite integer DEFAULT 50, p_deslocamento integer DEFAULT 0, p_busca text DEFAULT NULL::text)
 RETURNS TABLE(card_id bigint, pedido_id bigint, numero integer, cliente_nome text, endereco text, numero_endereco text, complemento text, bairro text, cidade text, uf text, geo_chave text, latitude double precision, longitude double precision, geo_resolvido boolean, endereco_geocodificavel text, geo_consultado_em timestamp with time zone, cep text, geo_manual boolean, geo_aproximado text, total_unidades integer, itens jsonb, data_prevista date, programacao_data date, caminhao_id bigint, caminhao_nome text, caminhao_placa text, rota integer, ordem integer, entregue_em timestamp with time zone, detalhe text, equipe text[], estado text, unidades_prontas integer, unidades_liberadas integer, contagem_total bigint, entregue_em_parte jsonb)
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
           ee.cep,
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
           -- SESSAO-47: o dia REAL da entrega (a projeção do card)
           pc.entrega_em                 as entregue_em,
           pr.detalhe,
           eq.nomes                      as equipe,
           pp.estado,
           pp.unidades_prontas,
           pp.unidades_liberadas,
           -- SESSAO-53: a marca da entrega parcial (a conta só é feita para quem tem)
           pc.parcial_evento_id
      from public.plt_programacoes pr
      join public.plt_cards pc on pc.id = pr.card_id
      join public.pedidos p on p.id = pc.pedido_id
      left join public.clientes c on c.id = p.cliente_id
      left join plt_privado.vw_endereco_entrega ee on ee.pedido_id = p.id
      left join public.plt_caminhoes cam on cam.id = pr.caminhao_id
      left join plt_privado.vw_pedido_prontidao pp on pp.card_id = pc.id
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
       -- SESSAO-47: entregue = tem entrega vigente (a projeção do card)
       and (case when coalesce(p_entregues, false) then pc.entrega_evento_id is not null
                 else pc.entrega_evento_id is null end)
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
         -- SESSAO-45: o CEP vai junto ao Google Maps (a navegação é SEMPRE pelo endereço);
         -- o ponto marcado à mão e o ponto APROXIMADO (pelo CEP, bairro ou cidade) aparecem no cartão
         b.cep, coalesce(g.fonte = 'manual', false) as geo_manual,
         case when left(g.fonte, 6) = 'aprox_' then substr(g.fonte, 7) end as geo_aproximado,
         b.total_unidades, b.itens, b.data_prevista,
         b.programacao_data, b.caminhao_id, b.caminhao_nome, b.caminhao_placa,
         b.rota, b.ordem, b.entregue_em, b.detalhe,
         coalesce(b.equipe, '{}'::text[]) as equipe,
         b.estado, b.unidades_prontas, b.unidades_liberadas,
         count(*) over () as contagem_total,
         -- SESSAO-53: "Entregue em parte (N de M)" e quantos seguem na fábrica (nulo = não há).
         -- Subconsulta na lista de saída: o banco só a calcula para as linhas que SAEM (depois
         -- da ordem e do limite), e só para o pedido que tem entrega parcial.
         case when b.parcial_evento_id is not null
              then (select ep.selo from plt_privado.vw_entregue_em_parte ep where ep.card_id = b.card_id) end as entregue_em_parte
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

comment on function public.plt_fn_programadas(boolean, date, bigint, integer, integer, text) is
  'As programações (D-111), paginadas: as não entregues (dia mais perto primeiro) ou, com p_entregues, o histórico; por dia, caminhão e rota (D-128), com a equipe, o estado do pedido (D-156), o CEP e o ponto (D-221), o dia real da entrega (SESSAO-47) e a busca que acha a rota inteira (D-199). SESSAO-53: + entregue_em_parte (jsonb; nulo = não há) — "Entregue em parte (N de M)" e quantos seguem na fábrica.';
revoke all on function public.plt_fn_programadas(boolean, date, bigint, integer, integer, text) from public, anon;
grant execute on function public.plt_fn_programadas(boolean, date, bigint, integer, integer, text) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3 · Expedição (recriada de 20261109020000_plt_pedido_adiantado_tiny.sql:853-970 — o jsonb só ganha a chave)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_expedicao(
  p_filtro       text    default 'todos',   -- todos | com_rota | sem_rota | prontos | em_producao | saiu_do_pcp
  p_busca        text    default null,
  p_limite       integer default 20,
  p_deslocamento integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_filtro text    := coalesce(nullif(btrim(p_filtro), ''), 'todos');
  v_busca  text    := nullif(btrim(coalesce(p_busca, '')), '');
  v_limite integer := least(greatest(coalesce(p_limite, 20), 1), 100);
  v_desloc integer := greatest(coalesce(p_deslocamento, 0), 0);
  v_saida  jsonb;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'A Expedição é da logística (PCP/terminais) e do admin.' using errcode = 'insufficient_privilege';
  end if;
  if v_filtro not in ('todos', 'com_rota', 'sem_rota', 'prontos', 'em_producao', 'saiu_do_pcp') then
    raise exception 'Filtro da Expedição desconhecido: %.', v_filtro using errcode = 'check_violation';
  end if;

  with base as materialized (
    select v.card_id, v.pedido_id, v.numero, v.data_prevista, v.situacao,
           v.total_unidades, v.a_entregar, v.unidades_liberadas, v.unidades_prontas,
           v.primeira_pronta_em, v.ultima_pronta_em, v.pronto, v.estado,
           v.lancado_rotas_em, v.devolucao_evento_id,
           v.programacao_data, v.caminhao_id, v.rota,
           coalesce(c.nome, '') as cliente_nome,
           -- SESSAO-38 (D-171): o stand-by fica na Expedição, com a marca
           sb.standby_desde, sb.standby_motivo,
           -- SESSAO-47: a marca de devolvido ao PCP e a regra "adiantado no Tiny com
           -- falta" (plt_privado.vw_pedidos_adiantados_falta, escrita aqui sobre a
           -- linha que já está na mão: o barato primeiro, a função do Tiny por último)
           sb.volta_pcp_em,
           (sb.liberado_completo_em is null and sb.volta_pcp_em is null and v.total_unidades > 0
            and plt_privado.fn_tiny_adiantou(v.situacao)) as saiu_do_pcp
      from plt_privado.vw_pedidos_vivos v
      left join public.clientes c on c.id = v.cliente_id
      left join public.plt_cards sb on sb.id = v.card_id
  ),
  filtrados as (
    select b.*
      from base b
     where (case v_filtro
              when 'todos'       then true
              when 'com_rota'    then b.programacao_data is not null
              when 'sem_rota'    then b.programacao_data is null
              when 'prontos'     then b.pronto
              when 'saiu_do_pcp' then b.saiu_do_pcp
              else                    not b.pronto
            end)
       and (v_busca is null
            or b.numero::text like v_busca || '%'
            or b.cliente_nome ilike '%' || v_busca || '%')
  ),
  pagina as (
    select f.*
      from filtrados f
     order by f.data_prevista asc nulls last, f.numero desc
     limit v_limite offset v_desloc
  )
  select jsonb_build_object(
           'filtro', v_filtro,
           -- SESSAO-47: a ida ao Tiny está ligada? (desligada, os botões de voltar ao PCP ficam apagados)
           'tiny_ligado', plt_privado.fn_tiny_entrega_desde() is not null,
           -- Os números dos filtros: o conjunto inteiro (sem a busca), no mesmo pedido.
           'contagens', (select jsonb_build_object(
                                  'todos',       count(*),
                                  'com_rota',    count(*) filter (where b.programacao_data is not null),
                                  'sem_rota',    count(*) filter (where b.programacao_data is null),
                                  'prontos',     count(*) filter (where b.pronto),
                                  'em_producao', count(*) filter (where not b.pronto),
                                  'saiu_do_pcp', count(*) filter (where b.saiu_do_pcp))
                           from base b),
           'total', (select count(*) from filtrados),
           'itens', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'card_id', pg.card_id, 'pedido_id', pg.pedido_id, 'numero', pg.numero,
                      'cliente_nome', pg.cliente_nome, 'data_prevista', pg.data_prevista,
                      'situacao', pg.situacao,
                      -- SESSAO-47: o Tiny levou o pedido adiante e a plataforma não o devolveu (a janela
                      -- de liberar peça pergunta o que fazer); com falta, o aviso e o que falta liberar
                      'tiny_adiantado', pg.volta_pcp_em is null and plt_privado.fn_tiny_adiantou(pg.situacao),
                      'saiu_do_pcp', case when pg.saiu_do_pcp
                                          then jsonb_build_object('situacao', pg.situacao,
                                                                  'faltam', plt_privado.fn_pedido_faltam(pg.pedido_id)) end,
                      'volta_pcp', case when pg.volta_pcp_em is null then null
                                        else plt_privado.fn_volta_pcp_resumo(pg.card_id) end,
                      'total_unidades', pg.total_unidades, 'a_entregar', pg.a_entregar,
                      'unidades_liberadas', pg.unidades_liberadas, 'unidades_prontas', pg.unidades_prontas,
                      'pronto', pg.pronto, 'estado', pg.estado,
                      'primeira_pronta_em', pg.primeira_pronta_em,
                      'completo_em', case when pg.pronto then pg.ultima_pronta_em end,
                      'lancado', pg.lancado_rotas_em is not null,
                      'em_devolucao', pg.devolucao_evento_id is not null,
                      'standby', case when pg.standby_desde is null then null
                                      else jsonb_build_object('desde', pg.standby_desde, 'motivo', pg.standby_motivo) end,
                      'alterado_apos_liberacao', exists (select 1 from public.plt_eventos e
                                                          where e.card_id = pg.card_id and e.tipo = 'pedido_atualizado'),
                      'programacao', case when pg.programacao_data is null then null
                                          else jsonb_build_object('data', pg.programacao_data,
                                                                  'caminhao_id', pg.caminhao_id,
                                                                  'caminhao_nome', cam.nome,
                                                                  'caminhao_placa', cam.placa,
                                                                  'rota', pg.rota) end)
                    -- SESSAO-53: o pedido entregue em parte — "Entregue em parte (N de M)" e quantos seguem na
                    -- fábrica (a chave só nasce quando há — E-237)
                    || case when ep.card_id is null then '{}'::jsonb
                            else jsonb_build_object('entregue_em_parte', ep.selo) end
                    order by pg.data_prevista asc nulls last, pg.numero desc)
               from pagina pg
               left join public.plt_caminhoes cam on cam.id = pg.caminhao_id
               -- SESSAO-53: a regra do selo, pela chave primária do card do pedido (só as linhas da página)
               left join plt_privado.vw_entregue_em_parte ep on ep.card_id = pg.card_id), '[]'::jsonb)
         )
    into v_saida;
  return v_saida;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4 · Entregas do dia (recriada de 20261112060000_plt_editar_endereco.sql:884-1057 — o jsonb só ganha a chave)
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
  -- SESSAO-47: o que foi entregue NESTE dia de fato, programado para outro
  v_outro_dia jsonb;
  v_ini       timestamptz;
  v_fim       timestamptz;
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
               -- SESSAO-45: o CEP vai ao Google Maps/Waze; o ponto marcado à mão manda na navegação
               'cep', ee.cep, 'geo_manual', coalesce(g.fonte = 'manual', false),
               'obs', p.obs, 'detalhe', pr.detalhe, 'data_prevista', plt_privado.fn_data_entrega(p.id, p.data_prevista),
               'itens', coalesce(i.itens, '[]'::jsonb), 'unidades', coalesce(i.unidades, 0),
               'volumes', coalesce(i.volumes, 0),
               -- SESSAO-38 (D-156): o programado pode ainda estar em produção.
               'estado', pp.estado, 'pronto', coalesce(pp.pronto, true),
               'prontas', coalesce(pp.unidades_prontas, 0), 'a_entregar', coalesce(pp.a_entregar, 0),
               -- SESSAO-47: o dia REAL da entrega (a projeção do card), quando ela
               -- foi REGISTRADA (o "desfazer do dia" conta por aqui) e quando o
               -- pedido chegou à plataforma (o limite do "entregue no dia...")
               'entregue_em', pc.entrega_em, 'entregue_por', ue.nome,
               'entregue_no_dia', plt_privado.fn_dia_da_entrega(pc.entrega_em),
               'entrega_registrada_em', ent.registrado_em,
               'chegou_em', pc.criado_em,
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
             )
             -- SESSAO-53: o pedido entregue em parte — "Entregue em parte (N de M)" e quantos seguem na
             -- fábrica (a chave só nasce quando há — E-237)
             || case when ep.card_id is null then '{}'::jsonb
                     else jsonb_build_object('entregue_em_parte', ep.selo) end
             as e
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
        -- SESSAO-53: a regra do selo, pela chave primária do card do pedido (só as linhas da página)
        left join plt_privado.vw_entregue_em_parte ep on ep.card_id = pc.id
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
  select coalesce(jsonb_agg(plt_privado.fn_parada_json(pa)
                            -- SESSAO-50 (bloco C): quem pode editar — a logística, ou quem pôs a
                            -- parada; só a pendente (a regra da porta de salvar) — o "Editar" da tela
                            || jsonb_build_object('pode_editar', pa.situacao = 'pendente'
                                                  and (v_logistica or pa.criada_por = v_usuario))
                            order by pa.ordem nulls last, pa.id), '[]'::jsonb)
    into v_paradas
    from public.plt_paradas_avulsas pa
   where pa.data_entrega = v_data and pa.caminhao_id = v_caminhao and pa.rota = v_rota and pa.removida_em is null;

  -- SESSAO-47: os pedidos cujo dia REAL de entrega é este, programados para
  -- OUTRO dia (a logística vê todos; o entregador, os das rotas da equipe
  -- dele). A parada continua também na rota em que estava programada — é lá
  -- que quem registrou desfaz. Pelo índice do dia da entrega; teto de 100.
  v_ini := v_data::timestamp at time zone 'America/Fortaleza';
  v_fim := (v_data + 1)::timestamp at time zone 'America/Fortaleza';
  select coalesce(jsonb_agg(x.e order by x.em, x.numero), '[]'::jsonb) into v_outro_dia
    from (
      select pc.entrega_em as em, p.numero,
             jsonb_build_object(
               'card_id', pc.id, 'pedido_id', p.id, 'numero', p.numero,
               'cliente_nome', coalesce(c.nome, ''),
               'entregue_em', pc.entrega_em, 'entrega_registrada_em', ent.registrado_em,
               'entregue_por', ue.nome, 'entregue_por_gente', ent.usuario_id is not null,
               'entrega_parcial', coalesce((ent.dados ->> 'parcial')::boolean, false),
               'programado_para', pr.data_entrega, 'caminhao_nome', cam.nome, 'rota', pr.rota::int) as e
        from public.plt_cards pc
        join public.plt_programacoes pr on pr.card_id = pc.id
        join public.pedidos p on p.id = pc.pedido_id
        left join public.clientes c on c.id = p.cliente_id
        left join public.plt_caminhoes cam on cam.id = pr.caminhao_id
        left join public.plt_eventos ent on ent.id = pc.entrega_evento_id
        left join public.plt_usuarios ue on ue.id = ent.usuario_id
       where pc.tipo = 'pedido'
         and pc.entrega_em >= v_ini and pc.entrega_em < v_fim
         and pr.data_entrega <> v_data
         and (v_logistica
              or exists (select 1 from public.plt_programacao_equipes eq
                          where eq.data_entrega = pr.data_entrega and eq.caminhao_id = pr.caminhao_id
                            and eq.rota = pr.rota and eq.usuario_id = v_usuario))
       order by pc.entrega_em, p.numero
       limit 100
    ) x;

  return jsonb_build_object('data', v_data, 'caminhao_id', v_caminhao, 'rota', v_rota, 'caminhoes', v_caminhoes,
                            'entregas', v_entregas, 'paradas_avulsas', v_paradas, 'sou_logistica', v_logistica,
                            'entregues_de_outro_dia', v_outro_dia);
end;
$function$;
