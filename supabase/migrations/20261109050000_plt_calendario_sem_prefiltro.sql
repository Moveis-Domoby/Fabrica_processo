-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · SESSAO-47 · O FECHO DO CALENDÁRIO DAS ROTAS
-- (09/11/2026 — achado do ensaio ×100 da frente da entrega, depois da subida)
--
-- Só recria plt_fn_rotas_calendario (a mesma assinatura, a MESMA resposta):
--
--   1. Sai o pré-filtro dos pedidos sem rota (`v.pedido_id in (os do período união os
--      de data mudada na plataforma)`). Ele não tirava linha nenhuma — quem passa na
--      data que vale já está num dos dois — e era dele o plano ruim: com o período
--      maior que a semana (o mês), ou no plano genérico da 6ª chamada na mesma
--      conexão, o banco relia a lista dos pedidos do período para CADA pedido vivo
--      (com 100 vezes o movimento, três semanas passavam de 5 minutos).
--   2. Sai a guarda `plan_cache_mode = force_custom_plan` que a 20261109030000 pôs:
--      sem o pré-filtro o plano genérico não desanda (8 chamadas seguidas iguais, em
--      qualquer ordem de período), e a guarda fazia as funções de dentro replanejarem
--      a cada linha (6 semanas: 3,0 s com ela, 1,2 s sem).
--
-- Com o movimento de hoje nada disso se sente (poucos milissegundos nos dois
-- desenhos) — é dívida de escala paga antes de doer. Nenhuma tabela, coluna,
-- índice ou permissão muda; nada da integração. Reaplicável.
-- (recriada da versão vigente em 20261109030000_plt_entrega_dia_real.sql)
-- ============================================================================

set local lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.plt_fn_rotas_calendario(p_de date, p_ate date, p_por_dia integer DEFAULT 30, p_deslocamento integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
 -- ↪️ SESSAO-47 (fecho): SEM a guarda do plano sob medida que a 20261109030000 tinha posto
 -- aqui. Quem fazia o plano genérico desandar era o pré-filtro (ver a parte 3) — ele saiu, e
 -- sem ele 8 chamadas seguidas na mesma conexão respondem no mesmo tempo, em qualquer ordem
 -- de período. A guarda, por sua vez, valia também para as funções chamadas por dentro (cada
 -- uma replanejava a cada linha): com 100 vezes o movimento, 6 semanas levavam 3,0 s com ela
 -- e 1,2 s sem.
AS $function$
declare
  v_por_dia integer := least(greatest(coalesce(p_por_dia, 30), 1), 100);
  v_desloc  integer := greatest(coalesce(p_deslocamento, 0), 0);
  v_hoje    date := (now() at time zone 'America/Fortaleza')::date;
  v_dias    jsonb;
  v_resumo  jsonb;
begin
  if not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'O calendário das rotas é da logística.' using errcode = 'insufficient_privilege';
  end if;
  if p_de is null or p_ate is null or p_ate < p_de then
    raise exception 'Diga o período do calendário (do dia … ao dia …).' using errcode = 'check_violation';
  end if;
  if p_ate - p_de > 41 then
    raise exception 'O calendário mostra no máximo 6 semanas por vez.' using errcode = 'check_violation';
  end if;

  with itens as (
    -- 1) programados que ainda estão NA ROTA: no dia programado
    --    (↪️ SESSAO-47: o entregue saiu daqui — mora no dia REAL, na parte 1b)
    select pr.data_entrega                                   as dia,
           'na_rota'::text                                   as situacao,
           pc.id                                             as card_id,
           p.id                                              as pedido_id,
           p.numero,
           coalesce(nullif(btrim(ee.bairro), ''), nullif(btrim(ee.cidade), '')) as bairro,
           plt_privado.fn_data_entrega(p.id, p.data_prevista) as data_prevista,
           pr.detalhe,
           pr.caminhao_id,
           cam.nome                                          as caminhao_nome,
           pr.rota::int                                      as rota,
           pr.ordem,
           null::text                                        as motivo,
           null::date                                        as programado_para
      from public.plt_programacoes pr
      join public.plt_cards pc on pc.id = pr.card_id and pc.tipo = 'pedido'
      join public.pedidos p on p.id = pc.pedido_id
      left join public.clientes c on c.id = p.cliente_id
      left join plt_privado.vw_endereco_entrega ee on ee.pedido_id = p.id
      left join public.plt_caminhoes cam on cam.id = pr.caminhao_id
     where pr.data_entrega between p_de and p_ate
       and pc.entrega_evento_id is null and pc.arquivado_em is null
    union all
    -- 1b) SESSAO-47: o ENTREGUE (e programado) no dia em que a entrega aconteceu
    --     de fato — pelo índice do dia da entrega. O dia programado vai junto
    --     (a tela escreve "programado para dd/mm" quando difere). O entregue
    --     sem programação continua fora do calendário, como antes.
    select plt_privado.fn_dia_da_entrega(pc.entrega_em),
           'entregue',
           pc.id,
           p.id,
           p.numero,
           coalesce(nullif(btrim(ee.bairro), ''), nullif(btrim(ee.cidade), '')),
           plt_privado.fn_data_entrega(p.id, p.data_prevista),
           pr.detalhe,
           pr.caminhao_id,
           cam.nome,
           pr.rota::int,
           pr.ordem,
           null,
           pr.data_entrega
      from public.plt_cards pc
      join public.plt_programacoes pr on pr.card_id = pc.id
      join public.pedidos p on p.id = pc.pedido_id
      left join plt_privado.vw_endereco_entrega ee on ee.pedido_id = p.id
      left join public.plt_caminhoes cam on cam.id = pr.caminhao_id
     where pc.tipo = 'pedido'
       and pc.entrega_em >= (p_de::timestamp at time zone 'America/Fortaleza')
       and pc.entrega_em <  ((p_ate + 1)::timestamp at time zone 'America/Fortaleza')
    union all
    -- 2) não entregue: o fato do dia da rota (índice próprio pelo dia — a
    --    marcação pode acontecer antes ou depois do dia programado)
    select (e.dados ->> 'data_entrega')::date,
           'nao_entregue',
           e.card_id,
           p.id,
           p.numero,
           coalesce(nullif(btrim(ee.bairro), ''), nullif(btrim(ee.cidade), '')),
           plt_privado.fn_data_entrega(p.id, p.data_prevista) as data_prevista,
           null,
           (e.dados ->> 'caminhao_id')::bigint,
           cam.nome,
           null,
           null,
           coalesce(e.dados ->> 'motivo', e.observacao),
           null
      from public.plt_eventos e
      join public.plt_cards pc on pc.id = e.card_id
      join public.pedidos p on p.id = pc.pedido_id
      left join public.clientes c on c.id = p.cliente_id
      left join plt_privado.vw_endereco_entrega ee on ee.pedido_id = p.id
      left join public.plt_caminhoes cam on cam.id = (e.dados ->> 'caminhao_id')::bigint
     where e.tipo = 'entrega_nao_realizada'
       and e.dados ->> 'data_entrega' between p_de::text and p_ate::text
    union all
    -- 3) sem rota e stand-by: os vivos sem programação, no dia da previsão
    select v.data_prevista,
           case when pc.standby_desde is not null then 'standby' else 'sem_rota' end,
           v.card_id,
           v.pedido_id,
           v.numero,
           coalesce(nullif(btrim(ee.bairro), ''), nullif(btrim(ee.cidade), '')),
           v.data_prevista,
           null,
           null,
           null,
           null,
           null,
           pc.standby_motivo,
           null
      -- a REGRA do vivo, sem a prontidão (o calendário não mostra peça pronta — 1b)
      from plt_privado.vw_pedidos_vivos_regra v
      join public.plt_cards pc on pc.id = v.card_id
      left join public.clientes c on c.id = v.cliente_id
      left join plt_privado.vw_endereco_entrega ee on ee.pedido_id = v.pedido_id
     where v.programacao_data is null
       and v.devolucao_evento_id is null
       -- ↪️ SESSAO-47 (ensaio ×100): saiu daqui o pré-filtro "o pedido está entre os do período
       -- ou entre os de data mudada na plataforma" (`v.pedido_id in (...)`). Ele não tirava
       -- linha nenhuma — quem passa na data que vale, logo abaixo, já está num dos dois —
       -- e era dele o plano ruim: com o período maior que a semana (o mês), ou no plano
       -- genérico da 6ª chamada, o banco relia a lista dos pedidos do período para CADA
       -- pedido vivo. No volume ×100 (a mesma resposta, letra por letra): três semanas de
       -- mais de 5 minutos → ~1,0 s; seis semanas → ~1,2 s; a semana ~0,75 s.
       and v.data_prevista between p_de and p_ate
  ), numerados as (
    select i.*,
           row_number() over (
             partition by i.dia
             order by case i.situacao when 'na_rota' then 1 when 'entregue' then 1
                                      when 'nao_entregue' then 2 when 'sem_rota' then 3 else 4 end,
                      i.caminhao_nome nulls last, i.caminhao_id, i.rota, i.ordem nulls last, i.numero
           ) as n
      from itens i
  ), por_dia as (
    select n.dia,
           count(*)::int as total,
           jsonb_build_object(
             'na_rota',      count(*) filter (where n.situacao = 'na_rota'),
             'entregue',     count(*) filter (where n.situacao = 'entregue'),
             'nao_entregue', count(*) filter (where n.situacao = 'nao_entregue'),
             'sem_rota',     count(*) filter (where n.situacao = 'sem_rota'),
             'standby',      count(*) filter (where n.situacao = 'standby')
           ) as contagem,
           coalesce(jsonb_agg(jsonb_build_object(
                      'situacao', n.situacao, 'card_id', n.card_id, 'pedido_id', n.pedido_id,
                      'numero', n.numero,
                      'bairro', n.bairro, 'previsao', n.data_prevista, 'detalhe', n.detalhe,
                      'caminhao_id', n.caminhao_id, 'caminhao_nome', n.caminhao_nome,
                      'rota', n.rota, 'ordem', n.ordem, 'motivo', n.motivo,
                      -- SESSAO-47: só no entregue — o dia para o qual estava programado
                      'programado_para', n.programado_para)
                    order by n.n)
                    filter (where n.n > v_desloc and n.n <= v_desloc + v_por_dia), '[]'::jsonb) as itens
      from numerados n
     group by n.dia
  )
  select coalesce(jsonb_agg(jsonb_build_object('dia', d.dia, 'total', d.total,
                                               'contagem', d.contagem, 'itens', d.itens)
                            order by d.dia), '[]'::jsonb)
    into v_dias
    from por_dia d;

  -- O que não cabe em dia nenhum da tela: sem rota com a previsão vencida e sem
  -- previsão. O "+N" de um dia (deslocamento > 0) não mostra o aviso — não conta.
  -- ↪️ 06/11/2026 (D-270): a previsão vencida que cai DENTRO do período mostrado
  -- já está na grade (a parte 3 dos itens, com a mesma regra) — não é "fora".
  if v_desloc > 0 then
    v_resumo := jsonb_build_object('atrasados_sem_rota', 0, 'sem_previsao', 0);
  else
    select jsonb_build_object(
             'atrasados_sem_rota', count(*) filter (where v.data_prevista < v_hoje
                                                      and not (v.data_prevista between p_de and p_ate)),
             'sem_previsao',       count(*) filter (where v.data_prevista is null))
      into v_resumo
      from plt_privado.vw_pedidos_vivos_regra v
      join public.plt_cards pc on pc.id = v.card_id
     where v.programacao_data is null
       and v.devolucao_evento_id is null
       and pc.standby_desde is null
       -- só os que contam (o filtro desce até os pedidos)
       and v.pedido_id in (select px.id from public.pedidos px where px.data_prevista < v_hoje or px.data_prevista is null
                           union all select d.pedido_id from public.plt_pedido_datas d)
       and (v.data_prevista < v_hoje or v.data_prevista is null);
  end if;

  return jsonb_build_object('de', p_de, 'ate', p_ate, 'hoje', v_hoje,
                            'por_dia', v_por_dia, 'dias', v_dias, 'fora', v_resumo);
end;
$function$;
