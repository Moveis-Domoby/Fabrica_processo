-- ============================================================================
-- SESSAO-45 · ajuste do dono (05/11/2026): "a rota precisa do endereço exato do
-- cliente, não do ponto marcado — o ponto pode servir para ajuste — mas não pode
-- acontecer o caso de endereço não encontrado".
--
-- A navegação (Google Maps/Waze) vai SEMPRE pelo endereço escrito — isso é da
-- tela. Aqui: a busca de endereço (Edge Function geocodificar) passa a descer
-- em DEGRAUS quando não acha a rua — o ponto do CEP, o centro do bairro, o
-- centro da cidade — e grava o degrau na coluna que já existia, plt_geocache.fonte:
--   'aprox_cep' | 'aprox_bairro' | 'aprox_cidade'   (nenhuma tabela, nenhuma coluna)
-- As duas listas da Programação devolvem `geo_aproximado` ('cep' | 'bairro' |
-- 'cidade' | null) — o cartão diz "ponto aproximado" e oferece acertar no mapa —
-- e a de "Programar" passa a devolver também o CEP e o ponto marcado à mão
-- (o link do Google Maps de lá ganha o CEP).
--
-- Forma nova de retorno → drop + create (mesma assinatura de entrada, as mesmas
-- permissões). Recriadas das versões VIVAS (pg_get_functiondef de 05/11).
-- ============================================================================
set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · Programação (aba "Programar")
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_programacao(date, integer, integer, boolean);
CREATE FUNCTION public.plt_fn_programacao(p_data date DEFAULT NULL::date, p_limite integer DEFAULT 100, p_deslocamento integer DEFAULT 0, p_so_sem_programacao boolean DEFAULT false)
 RETURNS TABLE(card_id bigint, pedido_id bigint, numero integer, cliente_nome text, endereco text, numero_endereco text, complemento text, bairro text, cidade text, uf text, endereco_geocodificavel text, geo_chave text, latitude double precision, longitude double precision, geo_resolvido boolean, geo_consultado_em timestamp with time zone, cep text, geo_manual boolean, geo_aproximado text, total_unidades integer, itens jsonb, data_prevista date, lancado_em timestamp with time zone, programacao_data date, caminhao_id bigint, caminhao_nome text, ordem integer, estado text, unidades_prontas integer, unidades_liberadas integer, contagem_total bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with base as (
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
           v.data_prevista,
           v.lancado_rotas_em            as lancado_em,
           v.programacao_data,
           cam.id                        as caminhao_id,
           cam.nome                      as caminhao_nome,
           v.ordem,
           v.estado,
           v.unidades_prontas,
           v.unidades_liberadas
      from plt_privado.vw_pedidos_para_rota v
      left join public.clientes c on c.id = v.cliente_id
      left join plt_privado.vw_endereco_entrega ee on ee.pedido_id = v.pedido_id
      left join lateral (
        -- D-63: frete não conta nem aparece; os móveis com a quantidade.
        select jsonb_agg(jsonb_build_object('descricao', coalesce(nullif(btrim(it.descricao), ''), 'Item sem descrição'),
                                            'quantidade', it.unidades) order by it.seq)
                 filter (where not it.eh_frete and it.unidades > 0) as itens
          from plt_privado.vw_itens_producao it where it.pedido_id = v.pedido_id
      ) i on true
      left join public.plt_caminhoes cam on cam.id = v.caminhao_id
     where v.programacao_data is null
        or (not coalesce(p_so_sem_programacao, false)
            and (p_data is null or v.programacao_data = p_data))
  )
  select b.card_id, b.pedido_id, b.numero, b.cliente_nome,
         b.endereco, b.numero_endereco, b.complemento, b.bairro, b.cidade, b.uf,
         b.endereco_geocodificavel,
         case when b.endereco_geocodificavel is null then null
              else md5(lower(b.endereco_geocodificavel)) end as geo_chave,
         g.latitude, g.longitude,
         g.resolvido       as geo_resolvido,
         g.consultado_em   as geo_consultado_em,
         -- SESSAO-45 · ajuste: o CEP vai junto ao Google Maps; o ponto marcado à
         -- mão e o ponto APROXIMADO (pelo CEP, bairro ou cidade) aparecem no cartão
         b.cep,
         coalesce(g.fonte = 'manual', false) as geo_manual,
         case when left(g.fonte, 6) = 'aprox_' then substr(g.fonte, 7) end as geo_aproximado,
         b.total_unidades, b.itens, b.data_prevista, b.lancado_em,
         b.programacao_data, b.caminhao_id, b.caminhao_nome,
         b.ordem,
         b.estado, b.unidades_prontas, b.unidades_liberadas,
         count(*) over () as contagem_total
    from base b
    left join public.plt_geocache g
           on b.endereco_geocodificavel is not null
          and g.chave = md5(lower(b.endereco_geocodificavel))
   where plt_privado.fn_pode_ver_expedicao()
   order by (b.programacao_data is not null), b.data_prevista asc nulls last, b.numero
   limit least(greatest(coalesce(p_limite, 100), 1), 200)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$function$;

comment on function public.plt_fn_programacao(date, integer, integer, boolean) is
  'SESSAO-15/28/38: os pedidos da Programação — sem programação (sempre) + os programados no dia (a não ser com p_so_sem_programacao). SESSAO-38 (D-156): TODO pedido vivo (vw_pedidos_para_rota), pronto ou não — com estado (pronto | em_producao | no_pcp), prontas e liberadas. SESSAO-45 (D-221): + cep, geo_manual (ponto marcado à mão) e geo_aproximado (cep | bairro | cidade — o ponto veio de um degrau da busca, não da rua).';

revoke all on function public.plt_fn_programacao(date, integer, integer, boolean) from public, anon;
grant execute on function public.plt_fn_programacao(date, integer, integer, boolean) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2 · Já programadas
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_programadas(boolean, date, bigint, integer, integer, text);
CREATE FUNCTION public.plt_fn_programadas(p_entregues boolean DEFAULT false, p_data date DEFAULT NULL::date, p_caminhao_id bigint DEFAULT NULL::bigint, p_limite integer DEFAULT 50, p_deslocamento integer DEFAULT 0, p_busca text DEFAULT NULL::text)
 RETURNS TABLE(card_id bigint, pedido_id bigint, numero integer, cliente_nome text, endereco text, numero_endereco text, complemento text, bairro text, cidade text, uf text, geo_chave text, latitude double precision, longitude double precision, geo_resolvido boolean, endereco_geocodificavel text, geo_consultado_em timestamp with time zone, cep text, geo_manual boolean, geo_aproximado text, total_unidades integer, itens jsonb, data_prevista date, programacao_data date, caminhao_id bigint, caminhao_nome text, caminhao_placa text, rota integer, ordem integer, entregue_em timestamp with time zone, detalhe text, equipe text[], estado text, unidades_prontas integer, unidades_liberadas integer, contagem_total bigint)
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
         -- SESSAO-45: o CEP vai junto ao Google Maps (a navegação é SEMPRE pelo endereço);
         -- o ponto marcado à mão e o ponto APROXIMADO (pelo CEP, bairro ou cidade) aparecem no cartão
         b.cep, coalesce(g.fonte = 'manual', false) as geo_manual,
         case when left(g.fonte, 6) = 'aprox_' then substr(g.fonte, 7) end as geo_aproximado,
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
grant execute on function public.plt_fn_programadas(boolean, date, bigint, integer, integer, text) to authenticated, service_role;
