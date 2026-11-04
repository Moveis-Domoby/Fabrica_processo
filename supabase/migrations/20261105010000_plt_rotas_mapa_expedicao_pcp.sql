-- ============================================================================
-- SESSAO-45 · Rotas no mapa certo, Expedição devolve a peça e o PCP honesto
-- (04/11/2026, pedido do dono)
--
-- 1 · O PONTO MARCADO À MÃO: a logística acerta no mapa o endereço que a busca
--     não achou (ou achou no lugar errado) — porta plt_fn_geo_marcar, grava em
--     plt_geocache com fonte 'manual' (nenhuma coluna nova: a fonte já existia);
--     a busca automática nunca o substitui. A navegação (Google Maps/Waze) passa
--     a ir pelo ENDEREÇO ESCRITO do pedido (com o CEP) — o ponto só manda quando
--     foi marcado por alguém: plt_fn_programadas e plt_fn_entregas_do_dia
--     devolvem o CEP e geo_manual.
-- 2 · A EXPEDIÇÃO LIBERA A PEÇA PRONTA PARA OUTRO PEDIDO (ou registra a
--     substituição com o motivo): a peça sai do pedido de origem (que volta ao
--     PCP — ou ao stand-by, se o produto não vai para a produção agora), o pedido
--     de destino ganha a unidade PRONTA na vaga dele (a mesma mecânica da peça do
--     estoque e da realocação da devolução), e o PCP é avisado.
--     Portas plt_fn_liberar_peca_destino (a conferência, só leitura) e
--     plt_fn_liberar_peca (o gesto, idempotente pela chave do toque).
-- 3 · O PCP HONESTO SOBRE O ESTOQUE: plt_fn_pcp_quadro conta, por item, só o que
--     ainda falta liberar (antes: TODA peça livre do SKU em todo pedido) e manda à
--     parte quantas estão RESERVADAS para o pedido — a tela usa as palavras do
--     cartão do Estoque.
--
-- Nenhuma tabela nova; nenhuma coluna nova; nada em tabela da integração.
-- Funções recriadas da versão VIVA do banco (pg_get_functiondef, 04/11/2026).
-- ============================================================================
set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · O ponto marcado à mão
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_geo_marcar(
  p_chave text, p_endereco text, p_latitude double precision, p_longitude double precision)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu    uuid := plt_privado.fn_usuario_atual();
  v_antes record;
begin
  if v_eu is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Marcar o ponto no mapa é gesto da logística ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;
  -- a chave é a do endereço do pedido (md5 do endereço normalizado — a mesma das portas)
  if p_chave is null or p_endereco is null or btrim(p_endereco) = ''
     or md5(lower(p_endereco)) <> p_chave then
    raise exception 'O endereço não confere com o do pedido — recarregue a tela e tente de novo.'
      using errcode = 'check_violation';
  end if;
  select g.latitude, g.longitude, g.resolvido, g.fonte into v_antes
    from public.plt_geocache g where g.chave = p_chave;

  if p_latitude is null and p_longitude is null then
    -- "voltar à busca automática": some só o ponto marcado à mão
    delete from public.plt_geocache where chave = p_chave and fonte = 'manual';
  else
    if p_latitude is null or p_longitude is null
       or p_latitude not between -34.0 and 6.0 or p_longitude not between -74.5 and -28.5 then
      raise exception 'Esse ponto está fora do Brasil — confira o pino.' using errcode = 'check_violation';
    end if;
    insert into public.plt_geocache (chave, endereco, latitude, longitude, resolvido, fonte, consultado_em)
      values (p_chave, p_endereco, p_latitude, p_longitude, true, 'manual', now())
    on conflict (chave) do update
      set endereco = excluded.endereco,
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          resolvido = true,
          fonte = 'manual',
          consultado_em = excluded.consultado_em;
  end if;

  -- D-40: toda atividade de usuário gera registro (sem o endereço — dado pessoal)
  insert into public.plt_logs_atividade (usuario_id, acao, rota, contexto)
    values (v_eu, case when p_latitude is null then 'mapa_ponto_desmarcado' else 'mapa_ponto_marcado' end,
            null,
            jsonb_strip_nulls(jsonb_build_object(
              'chave', p_chave,
              'antes', case when v_antes is null then null
                            else jsonb_build_object('latitude', v_antes.latitude, 'longitude', v_antes.longitude,
                                                    'resolvido', v_antes.resolvido, 'fonte', v_antes.fonte) end,
              'depois', case when p_latitude is null then null
                             else jsonb_build_object('latitude', p_latitude, 'longitude', p_longitude) end)));

  -- as telas das rotas abertas releem (Lei §4 — aviso, sem relógio)
  perform plt_privado.fn_avisar('rotas');
  return jsonb_build_object('feito', true, 'manual', p_latitude is not null);
end;
$$;
comment on function public.plt_fn_geo_marcar(text, text, double precision, double precision) is
  'SESSAO-45: a logística marca (ou desmarca — lat/lon nulos) o ponto do endereço de um pedido no mapa. Grava plt_geocache com fonte manual (a busca automática nunca substitui); registra em plt_logs_atividade; avisa a área rotas.';
revoke all on function public.plt_fn_geo_marcar(text, text, double precision, double precision) from public, anon;
grant execute on function public.plt_fn_geo_marcar(text, text, double precision, double precision) to authenticated;

drop function if exists public.plt_fn_programadas(boolean, date, bigint, integer, integer, text);
CREATE FUNCTION public.plt_fn_programadas(p_entregues boolean DEFAULT false, p_data date DEFAULT NULL::date, p_caminhao_id bigint DEFAULT NULL::bigint, p_limite integer DEFAULT 50, p_deslocamento integer DEFAULT 0, p_busca text DEFAULT NULL::text)
 RETURNS TABLE(card_id bigint, pedido_id bigint, numero integer, cliente_nome text, endereco text, numero_endereco text, complemento text, bairro text, cidade text, uf text, geo_chave text, latitude double precision, longitude double precision, geo_resolvido boolean, endereco_geocodificavel text, geo_consultado_em timestamp with time zone, cep text, geo_manual boolean, total_unidades integer, itens jsonb, data_prevista date, programacao_data date, caminhao_id bigint, caminhao_nome text, caminhao_placa text, rota integer, ordem integer, entregue_em timestamp with time zone, detalhe text, equipe text[], estado text, unidades_prontas integer, unidades_liberadas integer, contagem_total bigint)
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
         -- SESSAO-45: o CEP vai junto ao Google Maps; o ponto marcado à mão manda na navegação
         b.cep, coalesce(g.fonte = 'manual', false) as geo_manual,
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
               -- SESSAO-45: o CEP vai ao Google Maps/Waze; o ponto marcado à mão manda na navegação
               'cep', ee.cep, 'geo_manual', coalesce(g.fonte = 'manual', false),
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

-- ----------------------------------------------------------------------------
-- 2 · A Expedição libera a peça pronta para outro pedido
-- ----------------------------------------------------------------------------
-- A conferência (uma regra só — a tela e o gesto usam a mesma): a peça pronta
-- de um pedido vivo e, com o número de destino, a vaga dele que espera ESSE
-- móvel (mesmo produto, cor e medidas) no PCP. Nunca lança erro — devolve o
-- motivo em língua de gente.
create or replace function plt_privado.fn_liberar_peca_avaliar(p_peca_id bigint, p_numero integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_p      public.plt_cards%rowtype;
  v_setor  text;
  v_danif  boolean;
  v_a      public.plt_cards%rowtype;
  v_num_a  integer;
  v_chave  text;
  v_base   jsonb;
  v_pb     public.pedidos%rowtype;
  v_b      public.plt_cards%rowtype;
  v_cli    text;
  v_vaga   record;
  nao      constant jsonb := jsonb_build_object('ok', false);
begin
  select * into v_p from public.plt_cards where id = p_peca_id;
  if not found or v_p.tipo <> 'unidade' then
    return nao || jsonb_build_object('motivo', 'Peça não encontrada.');
  end if;
  if v_p.arquivado_em is not null then
    return nao || jsonb_build_object('motivo', 'Esta peça já saiu (entregue, usada noutro pedido ou arquivada).');
  end if;
  if v_p.pedido_id is null then
    return nao || jsonb_build_object('motivo', 'Esta peça não é de um pedido.');
  end if;
  select s.codigo into v_setor from public.plt_setores s where s.id = v_p.setor_atual_id;
  select coalesce(e.eh_danificado, false) into v_danif from public.plt_etapas e where e.id = v_p.etapa_atual_id;
  if coalesce(v_setor, '') not in ('aguardo', 'rotas') or coalesce(v_danif, false) then
    return nao || jsonb_build_object('motivo', 'Só a peça PRONTA (na Expedição ou já na rota) pode ser liberada.');
  end if;
  if coalesce(v_p.qualidade_atual, 'perfeito') <> 'perfeito' then
    return nao || jsonb_build_object('motivo', 'Só peça em perfeito estado vai para outro pedido.');
  end if;
  select * into v_a from public.plt_cards where pedido_id = v_p.pedido_id and tipo = 'pedido';
  if v_a.id is null or v_a.entrega_evento_id is not null then
    return nao || jsonb_build_object('motivo', 'O pedido desta peça já foi entregue.');
  end if;
  select p.numero into v_num_a from public.pedidos p where p.id = v_p.pedido_id;
  v_chave := plt_privado.fn_chave_peca(
               plt_privado.fn_estoque_produto_da_peca(v_p.pedido_id, v_p.produto_tiny_id, v_p.item_codigo, v_p.item_descricao),
               v_p.item_codigo, v_p.item_descricao);
  v_base := jsonb_build_object('ok', true, 'peca_id', v_p.id, 'descricao', v_p.item_descricao,
                               'indice', v_p.indice_unidade, 'total', v_p.total_unidades,
                               'numero_origem', v_num_a, 'pedido_origem', v_p.pedido_id, 'card_origem', v_a.id);
  if p_numero is null then
    return v_base;
  end if;

  if p_numero = v_num_a then
    return nao || jsonb_build_object('motivo', 'É o mesmo pedido da peça.');
  end if;
  select p.* into v_pb
    from public.pedidos p
    join public.plt_cards c on c.pedido_id = p.id and c.tipo = 'pedido'
   where p.numero = p_numero
   order by (c.arquivado_em is null) desc, p.id desc
   limit 1;
  if v_pb.id is null then
    if exists (select 1 from public.pedidos p where p.numero = p_numero) then
      return nao || jsonb_build_object('motivo', format('O pedido %s ainda não chegou ao PCP.', p_numero));
    end if;
    return nao || jsonb_build_object('motivo', format('Não achei o pedido %s.', p_numero));
  end if;
  select * into v_b from public.plt_cards where pedido_id = v_pb.id and tipo = 'pedido';
  if v_b.arquivado_em is not null or v_b.entrega_evento_id is not null then
    return nao || jsonb_build_object('motivo', format('O pedido %s já foi entregue ou encerrado.', p_numero));
  end if;
  if plt_privado.fn_pedido_cancelado(v_pb.id) then
    return nao || jsonb_build_object('motivo', format('O pedido %s foi cancelado no Tiny.', p_numero));
  end if;
  -- a vaga que espera ESTE móvel; a sem reserva do estoque primeiro
  select w.seq, w.indice, w.total, w.descricao, w.reserva_card_id into v_vaga
    from plt_privado.fn_vagas_pedido(v_pb.id) w
   where w.card_id is null and w.chave = v_chave
   order by (w.reserva_card_id is not null), w.seq, w.indice
   limit 1;
  if v_vaga.seq is null then
    if exists (select 1 from plt_privado.fn_vagas_pedido(v_pb.id) w where w.chave = v_chave) then
      return nao || jsonb_build_object('motivo', format(
        'O pedido %s já tem esse móvel liberado para a produção — a peça só vai para um pedido que ainda espera esse móvel no PCP.',
        p_numero));
    end if;
    return nao || jsonb_build_object('motivo', format(
      'O pedido %s não tem esse móvel (o mesmo produto, cor e medidas).', p_numero));
  end if;
  select coalesce(c.nome, '') into v_cli from public.clientes c where c.id = v_pb.cliente_id;
  return v_base || jsonb_build_object(
    'numero_destino', v_pb.numero, 'pedido_destino', v_pb.id, 'card_destino', v_b.id,
    'cliente_destino', coalesce(v_cli, ''),
    'data_prevista_destino', plt_privado.fn_data_entrega(v_pb.id, v_pb.data_prevista),
    'vaga', jsonb_build_object('item_seq', v_vaga.seq, 'indice_unidade', v_vaga.indice, 'total', v_vaga.total,
                               'descricao', v_vaga.descricao),
    'tinha_reserva', v_vaga.reserva_card_id is not null);
end;
$$;
comment on function plt_privado.fn_liberar_peca_avaliar(bigint, integer) is
  'SESSAO-45: a regra única da liberação de peça pronta na Expedição — a peça (pronta, perfeita, de pedido vivo) e, com o número, a vaga do pedido de destino que espera o mesmo móvel no PCP. Devolve {ok, motivo | dados}.';
revoke all on function plt_privado.fn_liberar_peca_avaliar(bigint, integer) from public, anon, authenticated;

create or replace function public.plt_fn_liberar_peca_destino(p_peca_id bigint, p_numero integer default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Liberar peça para outro pedido é gesto da logística ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;
  return plt_privado.fn_liberar_peca_avaliar(p_peca_id, p_numero);
end;
$$;
comment on function public.plt_fn_liberar_peca_destino(bigint, integer) is
  'SESSAO-45: a conferência da janela "Liberar para outro pedido" da Expedição (só leitura) — a peça e, com o número, o pedido e a vaga de destino ou o motivo de não dar.';
revoke all on function public.plt_fn_liberar_peca_destino(bigint, integer) from public, anon;
grant execute on function public.plt_fn_liberar_peca_destino(bigint, integer) to authenticated;

create or replace function public.plt_fn_liberar_peca(
  p_peca_id bigint, p_para_numero integer, p_motivo text, p_relancar boolean, p_chave text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu      uuid := plt_privado.fn_usuario_atual();
  v_p       public.plt_cards%rowtype;
  v_a       public.plt_cards%rowtype;
  v_av      jsonb;
  v_motivo  text;
  v_tipo    text;
  v_obs     text;
  v_ev      bigint;
  v_novo    bigint;
  v_aguardo bigint;
  v_num_a   integer;
  v_num_b   integer;
  v_b_card  bigint;
  v_b_ped   bigint;
  v_seq     integer;
  v_k       integer;
  v_n       integer;
  v_codigo  text;
  v_desc    text;
  v_marca   text;
  v_prog    date;
  v_pa      public.pedidos%rowtype;
  v_standby boolean := false;
  v_rep     record;
begin
  if v_eu is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Liberar peça para outro pedido é gesto da logística ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;
  if p_chave is null or length(p_chave) < 8 or length(p_chave) > 80 then
    raise exception 'Chave do gesto inválida.' using errcode = 'check_violation';
  end if;
  -- Lei §10: o mesmo toque repetido = um efeito só
  select e.dados into v_rep from public.plt_eventos e
   where e.card_id = p_peca_id and e.tipo = 'unidade_desvinculada' and e.dados ->> 'chave' = p_chave
   limit 1;
  if found then
    return jsonb_build_object('feito', false, 'repetido', true);
  end if;

  select * into v_p from public.plt_cards where id = p_peca_id and tipo = 'unidade' for update;
  if not found then
    raise exception 'Peça não encontrada.' using errcode = 'no_data_found';
  end if;
  -- quem tira peça de um pedido trava o card do pedido (a mesma regra de quem cria — SESSAO-44)
  select * into v_a from public.plt_cards where pedido_id = v_p.pedido_id and tipo = 'pedido' for update;
  v_av := plt_privado.fn_liberar_peca_avaliar(p_peca_id, p_para_numero);
  if not coalesce((v_av ->> 'ok')::boolean, false) then
    raise exception '%', v_av ->> 'motivo' using errcode = 'check_violation';
  end if;

  v_motivo := nullif(btrim(coalesce(p_motivo, '')), '');
  if p_para_numero is null and (v_motivo is null or length(v_motivo) < 3) then
    raise exception 'Diga o motivo da substituição.' using errcode = 'check_violation';
  end if;
  if length(v_motivo) > 300 then
    raise exception 'O motivo fica com até 300 letras.' using errcode = 'check_violation';
  end if;
  if p_relancar is null then
    raise exception 'Diga se o produto volta para a produção deste pedido.' using errcode = 'check_violation';
  end if;
  v_num_a := (v_av ->> 'numero_origem')::int;

  -- "Não lançar agora" = o pedido volta ao PCP em STAND-BY; a rota não leva
  -- pedido em stand-by (D-171) — o programado sai da programação antes.
  if not p_relancar then
    select pr.data_entrega into v_prog from public.plt_programacoes pr where pr.card_id = v_a.id;
    if v_prog is not null then
      raise exception 'O pedido % está programado para a entrega de %: para segurar a produção, tire-o da programação antes — ou escolha que o produto volta para a produção.',
        v_num_a, to_char(v_prog, 'DD/MM') using errcode = 'check_violation';
    end if;
  end if;

  if p_para_numero is not null then
    v_b_card := (v_av ->> 'card_destino')::bigint;
    -- trava o card do destino e confere a vaga de novo (alguém pode ter liberado no meio)
    perform 1 from public.plt_cards where id = v_b_card for update;
    v_av := plt_privado.fn_liberar_peca_avaliar(p_peca_id, p_para_numero);
    if not coalesce((v_av ->> 'ok')::boolean, false) then
      raise exception '%', v_av ->> 'motivo' using errcode = 'check_violation';
    end if;
    v_num_b := (v_av ->> 'numero_destino')::int;
    v_b_ped := (v_av ->> 'pedido_destino')::bigint;
    v_seq := (v_av -> 'vaga' ->> 'item_seq')::int;
    v_k := (v_av -> 'vaga' ->> 'indice_unidade')::int;
    v_n := (v_av -> 'vaga' ->> 'total')::int;
  end if;

  v_tipo := case when p_para_numero is null then 'substituida' else 'liberada_outro_pedido' end;
  v_obs := case when p_para_numero is null
                then format('Estava pronta para o pedido %s e saiu por substituição: %s', v_num_a, v_motivo)
                else format('Estava pronta para o pedido %s e foi liberada para o pedido %s%s', v_num_a, v_num_b,
                            coalesce(' — ' || v_motivo, '')) end;

  -- 1 · a peça perde o pedido de origem — a vaga dele reabre (a projeção refaz a conta da liberação)
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, observacao, dados)
    values (v_p.id, 'unidade_desvinculada', v_eu, 'interface', v_p.setor_atual_id, v_obs,
            jsonb_strip_nulls(jsonb_build_object(
              'motivo', v_tipo, 'chave', p_chave, 'pedido_id', v_p.pedido_id, 'numero', v_num_a,
              'card_pedido_id', v_a.id, 'para_numero', v_num_b, 'para_pedido_id', v_b_ped,
              'texto', v_motivo, 'relancar', p_relancar,
              'produto_tiny_id', plt_privado.fn_produto_do_item(v_p.item_codigo, v_p.item_descricao))))
    returning id into v_ev;

  -- 2 · o pedido de destino ganha a unidade PRONTA na vaga dele (como a peça do estoque — D-62)
  if p_para_numero is not null then
    select s.id into v_aguardo from public.plt_setores s where s.codigo = 'aguardo' and s.ativo;
    if v_aguardo is null then
      raise exception 'A Expedição não está cadastrada — fale com o admin.' using errcode = 'no_data_found';
    end if;
    select v.codigo, v.descricao into v_codigo, v_desc
      from plt_privado.vw_itens_producao v where v.pedido_id = v_b_ped and v.seq = v_seq;
    insert into public.plt_cards
        (tipo, pedido_id, card_pai_id, item_seq, item_codigo, item_descricao,
         indice_unidade, total_unidades, setor_atual_id)
      values
        ('unidade', v_b_ped, v_b_card, v_seq, v_codigo, v_desc, v_k, v_n, v_aguardo)
      returning id into v_novo;
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_destino_id, observacao, dados)
      values (v_novo, 'card_criado', v_eu, 'interface', v_aguardo,
              format('Veio pronta do pedido %s — liberada na Expedição.', v_num_a),
              jsonb_build_object('alocada_de', v_p.id, 'origem_peca', 'pedido', 'de_numero', v_num_a,
                                 'de_pedido_id', (v_av ->> 'pedido_origem')::bigint,
                                 'pedido_id', v_b_ped, 'numero', v_num_b, 'chave', p_chave));
  end if;

  -- 3 · a peça antiga sai das contas (a história dela fica) — pela maquinaria, como a devolução
  v_marca := current_setting('plt.entrega_maquinaria', true);
  perform set_config('plt.entrega_maquinaria', 'on', true);
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
    values (v_p.id, 'card_arquivado', v_eu, 'interface', v_obs,
            jsonb_strip_nulls(jsonb_build_object('motivo', v_tipo, 'chave', p_chave, 'numero', v_num_a,
                                                 'para_numero', v_num_b, 'unidade_card_id', v_novo)));
  perform set_config('plt.entrega_maquinaria', coalesce(v_marca, ''), true);

  -- 4 · o pedido de origem: de volta ao PCP (a vaga reabriu no passo 1) — ou parado em stand-by
  select * into v_pa from public.pedidos where id = (v_av ->> 'pedido_origem')::bigint;
  if not p_relancar then
    perform public.plt_fn_pcp_standby(v_a.id, null,
      left(case when p_para_numero is null
                then format('Produto saiu por substituição (%s) — sem nova produção por enquanto', v_motivo)
                else format('Produto liberado para o pedido %s — sem nova produção por enquanto', v_num_b) end, 300));
    v_standby := true;
  end if;

  -- 5 · o PCP é avisado (o fato do aviso fica no card do pedido de origem)
  perform plt_privado.fn_avisar_publico(
    'pedido_peca_liberada', 'pcp', v_ev, v_a.id,
    format('Pedido %s voltou ao PCP', v_num_a),
    case when p_para_numero is null
         then format('%s saiu do pedido %s por substituição (%s).', coalesce(v_p.item_descricao, 'A peça'), v_num_a, v_motivo)
         else format('%s ficou com o pedido %s.', coalesce(v_p.item_descricao, 'A peça'), v_num_b) end
    || case when v_standby then ' O pedido ficou em stand-by, sem nova produção por enquanto.'
            else ' Libere a produção de novo.' end);

  return jsonb_build_object('feito', true, 'numero_origem', v_num_a, 'numero_destino', v_num_b,
                            'nova_unidade', v_novo, 'standby', v_standby,
                            'tiny_adiante', plt_privado.fn_tiny_tirou_do_pcp(v_pa.situacao));
end;
$$;
comment on function public.plt_fn_liberar_peca(bigint, integer, text, boolean, text) is
  'SESSAO-45 (pedido do dono): na Expedição, a peça pronta de um pedido é liberada para outro (que ganha a unidade pronta na vaga que espera esse móvel no PCP) ou sai por substituição com motivo. O pedido de origem volta ao PCP (p_relancar) ou fica em stand-by; o PCP é avisado. Idempotente pela chave do toque. Gate da logística.';
revoke all on function public.plt_fn_liberar_peca(bigint, integer, text, boolean, text) from public, anon;
grant execute on function public.plt_fn_liberar_peca(bigint, integer, text, boolean, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 3 · O PCP honesto sobre o estoque
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.plt_fn_pcp_quadro(p_limite integer DEFAULT 10, p_deslocamento integer DEFAULT 0, p_grupo text DEFAULT NULL::text, p_ordem text DEFAULT NULL::text, p_filtro text DEFAULT NULL::text)
 RETURNS TABLE(id bigint, tipo text, pedido_id bigint, card_pai_id bigint, item_seq integer, item_codigo text, item_descricao text, indice_unidade integer, total_unidades integer, setor_atual_id bigint, etapa_atual_id bigint, desde timestamp with time zone, executor_atual_id uuid, responsavel_id uuid, delegado_em timestamp with time zone, qualidade_atual text, concluido_em timestamp with time zone, pausado_em timestamp with time zone, liberado_completo_em timestamp with time zone, pecas_estoque integer, contagem_total bigint, etiquetas bigint[], pedido_resumo jsonb, prioridade text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with m as (select plt_privado.fn_ordem_do_quadro(p_ordem) as modo),
  f as (select * from plt_privado.fn_filtro_do_quadro(p_filtro)),
  base as (
    select c.id, c.desde, c.prioridade, p.numero, plt_privado.fn_data_entrega(p.id, p.data_prevista) as data_prevista,
           lower(translate(btrim(coalesce(case when c.tipo = 'pedido' then cl.nome else c.item_descricao end, '')),
                           'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
                           'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')) as nome
      from public.plt_cards c
      join public.plt_setores s on s.id = c.setor_atual_id and s.papel_no_fluxo = 'entrada'
      left join public.pedidos p on p.id = c.pedido_id
      left join public.clientes cl on cl.id = p.cliente_id
     -- o MESMO filtro de plt_fn_cards_pedido_pcp (D-75: painel = quadro)
     where (select plt_privado.fn_usuario_atual()) is not null
       and ((select plt_privado.fn_eh_admin())
            or c.setor_atual_id in (select plt_privado.fn_setores_do_usuario()))
       and c.tipo in ('pedido', 'reposicao')
       -- SESSAO-38 (D-169): o MESMO filtro de plt_fn_cards_pedido_pcp (o grupo 'standby')
       and (case when p_grupo = 'standby' then c.tipo = 'pedido' and c.standby_desde is not null
                 else (p_grupo is null or c.tipo = p_grupo) and c.standby_desde is null end)
       and c.arquivado_em is null
       and c.liberado_completo_em is null
       and (c.tipo = 'reposicao'
            or (p.id is not null
                and not plt_privado.fn_tiny_tirou_do_pcp(p.situacao)
                and exists (select 1 from plt_privado.vw_itens_producao v
                             where v.pedido_id = p.id and v.unidades > 0)))
  ),
  chaves as (
    select b.id,
           case (select modo from m)
             when 'prioridade' then case b.prioridade when 'urgente' then 0 when 'atencao' then 1 else 2 end
             else case when b.prioridade = 'urgente' then 0 else 1 end
           end as k1,
           (case (select modo from m)
              when 'entrega' then to_char(coalesce(b.data_prevista, date '9999-12-31'), 'YYYYMMDD')
              when 'alfabetica' then (case when b.nome ~ '^[a-z]' then '0' when b.nome ~ '^[0-9]' then '1' else '2' end) || b.nome
              else '' end) collate "C" as k2,
           case (select modo from m) when 'entrega' then coalesce(b.numero, 2147483647) else 0 end as k3,
           coalesce(b.desde, 'infinity'::timestamptz) as k4,
           count(*) over () as total
      from base b
     -- SESSAO-40 (D-187): o filtro do PCP — o nº do pedido que começa com o
     -- texto, ou o nome que o contém (o cliente no card do pedido; o móvel na
     -- reposição — o mesmo nome da ordem alfabética). O total conta só os que batem.
     where (not (select ativo from f)
            or case when (select numero from f) is not null
                    then b.numero::text like (select numero from f) || '%'
                    else translate(b.nome, ' ' || chr(9) || chr(10) || chr(13), '')
                           like '%' || (select nome from f) || '%' end)
  ),
  pagina as (
    select k.id, k.total, row_number() over (order by k.k1, k.k2, k.k3, k.k4, k.id) as ord
      from chaves k
     order by k.k1, k.k2, k.k3, k.k4, k.id
     limit least(greatest(coalesce(p_limite, 10), 1), 100)
    offset greatest(coalesce(p_deslocamento, 0), 0)
  ),
  resumos as (
    select r.pedido_id, to_jsonb(r) - 'contagem_total' as resumo
      from public.plt_fn_pedidos_kanban(
             null, false,
             coalesce((select array_agg(distinct c.pedido_id)
                         from pagina pg join public.plt_cards c on c.id = pg.id
                        where c.pedido_id is not null), '{}'),
             100, 0) r
  )
  select c.id, c.tipo, c.pedido_id, c.card_pai_id, c.item_seq, c.item_codigo,
         c.item_descricao, c.indice_unidade, c.total_unidades, c.setor_atual_id,
         c.etapa_atual_id, c.desde, c.executor_atual_id, c.responsavel_id,
         c.delegado_em, c.qualidade_atual, c.concluido_em, c.pausado_em,
         c.liberado_completo_em,
         pe.n as pecas_estoque,
         pg.total as contagem_total,
         coalesce(c.etiquetas, '{}'),
         -- SESSAO-38 (D-167/D-169): o stand-by do pedido no resumo (o relógio do
         -- PCP desconta; a aba Stand-by mostra o motivo, desde quando e quem pôs)
         case when c.tipo = 'pedido' then coalesce(r.resumo, '{}'::jsonb) || jsonb_build_object(
                'standby_desde', c.standby_desde, 'standby_motivo', c.standby_motivo,
                'standby_periodos', c.standby_periodos,
                -- SESSAO-45: quantas das peças do estoque já estão RESERVADAS para este pedido
                'pecas_reservadas', pe.r,
                'standby_por', (select u.nome from public.plt_eventos e
                                  join public.plt_usuarios u on u.id = e.usuario_id
                                 where e.id = c.standby_evento_id))
              else r.resumo end,
         c.prioridade
    from pagina pg
    join public.plt_cards c on c.id = pg.id
    left join resumos r on r.pedido_id = c.pedido_id
    -- as peças do galpão que atendem o pedido (a mesma conta de
    -- plt_fn_cards_pedido_pcp), só para os cards da página
    -- SESSAO-45 (o PCP "mentindo" sobre o estoque — vídeo do dono, 04/11): a conta
    -- antiga somava TODA peça livre do mesmo SKU a TODO pedido que tinha o item, sem
    -- limite — 5 livres apareciam como "5 no estoque" em cada um dos pedidos, mesmo o
    -- que precisa de 1. Agora, por item: no máximo o que ainda FALTA liberar dele, e
    -- as reservadas para ESTE pedido vêm à parte (r) — a tela diz "reservada(s)" e
    -- "livre(s)", as mesmas palavras do cartão do Estoque.
    cross join lateral (
      select case when c.tipo <> 'pedido' then 0
                  else coalesce(sum(least(nec.falta, nec.reservadas + nec.livres)), 0)::int end as n,
             case when c.tipo <> 'pedido' then 0
                  else coalesce(sum(least(nec.falta, nec.reservadas)), 0)::int end as r
        from (
          select greatest(it.unidades - (select count(*) from public.plt_cards u
                                          where u.pedido_id = c.pedido_id and u.tipo = 'unidade'
                                            and u.item_codigo = it.codigo), 0)::int as falta,
                 (select count(*)::int
                    from public.plt_cards u
                    join public.plt_setores se on se.id = u.setor_atual_id and se.codigo = 'estoque'
                   where u.tipo = 'unidade' and u.pedido_id is null and u.arquivado_em is null
                     and u.reservada_pedido_id = c.pedido_id and u.item_codigo = it.codigo) as reservadas,
                 (select count(*)::int
                    from public.plt_cards u
                    join public.plt_setores se on se.id = u.setor_atual_id and se.codigo = 'estoque'
                   where u.tipo = 'unidade' and u.pedido_id is null and u.arquivado_em is null
                     and u.reservada_pedido_id is null and u.item_codigo = it.codigo
                     and not plt_privado.fn_eh_personalizado(u.item_descricao)) as livres
            from (select v.codigo, sum(v.unidades)::int as unidades
                    from plt_privado.vw_itens_producao v
                   where c.tipo = 'pedido' and v.pedido_id = c.pedido_id and v.unidades > 0
                     and v.codigo is not null and not plt_privado.fn_eh_personalizado(v.descricao)
                   group by v.codigo) it
        ) nec
    ) pe
   order by pg.ord;
$function$;

-- O aviso novo no catálogo (Configurações → Avisos)
CREATE OR REPLACE FUNCTION plt_privado.fn_avisos_catalogo()
 RETURNS TABLE(tipo text, grupo text, grupo_nome text, ordem integer, nome text, descricao text, publico text, obrigatorio boolean, erro boolean)
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select * from (values
    ('qualidade_atencao',        'producao',  'Produção e qualidade',             10, 'Peça em atenção',                         'Alguém marcou uma peça com algo a conferir.',                                   'lideranca', false, false),
    ('qualidade_danificado',     'producao',  'Produção e qualidade',             11, 'Peça danificada',                         'Alguém marcou uma peça como danificada.',                                       'lideranca', false, false),
    ('qualidade_divergencia',    'producao',  'Produção e qualidade',             12, 'Estado da peça diferente',                'Quem entregou e quem recebeu marcaram estados diferentes.',                     'lideranca', false, false),
    ('tarefa_sistema',           'producao',  'Produção e qualidade',             13, 'Recebimento para confirmar',              'Uma peça chegou ao setor e espera a confirmação do estado.',                    'todos',     false, false),
    ('card_esquecido',           'producao',  'Produção e qualidade',             14, 'Ainda tem alguém neste card?',            'Card da montagem rodando há 2 horas sem parar.',                                'todos',     true,  false),
    ('execucao_pulada',          'producao',  'Produção e qualidade',             15, 'Móvel pulou a montagem',                  'Um móvel saiu da Montagem (ou de outro setor com o aviso ligado) sem ninguém iniciar.', 'admin',     false, false),
    ('chegada_aguardo',          'expedicao', 'Expedição e estoque',              20, 'Peça pronta na Expedição',                'Cada peça de pedido que fica pronta.',                                          'admin',     false, false),
    ('chegada_estoque',          'expedicao', 'Expedição e estoque',              21, 'Peça entrou no estoque',                  'Cada peça sem dono que entra no estoque.',                                      'admin',     false, false),
    ('devolucao_decidir',        'expedicao', 'Expedição e estoque',              22, 'Pedido devolvido ou entregue em parte',   'Peças esperando a decisão da logística.',                                       'logistica', false, false),
    ('pedido_cancelado',         'pedidos',   'Pedidos e Tiny',                   30, 'Pedido cancelado com produção',           'Cancelado no Tiny com peças já liberadas.',                                     'admin',     false, false),
    ('pedido_excluido_no_tiny',  'pedidos',   'Pedidos e Tiny',                   31, 'Pedido excluído no Tiny',                 'O pedido não existe mais no Tiny e saiu dos quadros.',                          'admin',     false, false),
    ('produto_excluido_no_tiny', 'pedidos',   'Pedidos e Tiny',                   32, 'Produto apagado no Tiny',                 'Apagado no Tiny, mas ainda com peças no quadro.',                               'admin',     false, false),
    ('pedido_itens_novos',      'pedidos',   'Pedidos e Tiny',                   33, 'Itens novos num pedido já liberado', 'O vendedor acrescentou itens no Tiny e o pedido voltou ao PCP só com o que falta.', 'pcp',       false, false),
    ('pedido_itens_sairam',     'pedidos',   'Pedidos e Tiny',                   34, 'Item saiu de um pedido com peça feita', 'O Tiny tirou ou diminuiu um item que já tem peça — nada foi arquivado.',        'pcp',       false, false),
    ('pedido_itens_rota',       'pedidos',   'Pedidos e Tiny',                   35, 'Pedido na rota ganhou itens',       'Segure a entrega: o pedido voltou ao PCP com os itens novos.',                  'logistica', false, false),
    ('tiny_saiu_de_entregue',   'pedidos',   'Pedidos e Tiny',                   36, 'Pedido voltou atrás no Tiny',       'Saiu de "Entregue" no Tiny: a entrega que veio do Tiny reabre; a feita aqui só avisa.', 'logistica', false, false),
    ('pedido_peca_liberada',    'pedidos',   'Pedidos e Tiny',                   37, 'Peça pronta liberada para outro pedido', 'A Expedição deu a peça pronta de um pedido para outro: ele voltou ao PCP para produzir de novo.', 'pcp', false, false),
    ('delegacao',                'cards',     'Cards e afazeres',                 40, 'Um afazer chegou para você',              'Um card foi colocado sob sua responsabilidade.',                                'todos',     false, false),
    ('card_responsavel',         'cards',     'Cards e afazeres',                 41, 'Você virou responsável por um card',      null,                                                                            'todos',     false, false),
    ('card_mencao',              'cards',     'Cards e afazeres',                 42, 'Mencionaram você',                        'Alguém escreveu o seu nome na conversa de um card.',                            'todos',     false, false),
    ('automacao',                'cards',     'Cards e afazeres',                 43, 'Aviso de uma automação',                  'As automações da plataforma que mandam aviso.',                                 'todos',     false, false),
    ('senha_pedido',             'acesso',    'Acesso',                           50, 'Pedido de troca de senha',                'Alguém pediu para trocar a senha.',                                             'admin',     true,  false),
    ('senha_sem_cadastro',       'acesso',    'Acesso',                           51, 'Troca de senha para e-mail sem cadastro', 'Pode ser alguém da equipe que digitou o e-mail errado.',                        'admin',     false, false),
    ('automacao_erro',           'erros',     'Erros de automação e integrações', 60, 'Integração com o Tiny ou o n8n parou',    'O Tiny desistiu de um item, uma automação do n8n deu erro, a conexão com o Tiny da fábrica caiu ou a lista do Tiny veio incompleta.', 'admin', false, true),
    ('tiny_pedido_parado',       'erros',     'Erros de automação e integrações', 61, 'O Tiny não aceitou a situação de um pedido', 'Depois de 8 tentativas, a situação do pedido não mudou lá.',                 'admin',     false, true),
    ('automacao_falhou',         'erros',     'Erros de automação e integrações', 62, 'Uma automação da plataforma falhou',      'Uma automação montada no Super admin parou com erro.',                          'admin',     false, true),
    ('estoque_tiny_parado',      'erros',     'Erros de automação e integrações', 63, 'O estoque parou de ir para o Tiny',       'Depois de 5 tentativas, o saldo de um móvel não foi atualizado no Tiny.',       'admin',     false, true),
    ('webhook_falhou',           'erros',     'Erros de automação e integrações', 64, 'Aviso para uma integração não entregue',  'A plataforma não conseguiu avisar uma integração depois de 5 tentativas.',     'admin',     false, true)
  ) as c(tipo, grupo, grupo_nome, ordem, nome, descricao, publico, obrigatorio, erro);
$function$;
