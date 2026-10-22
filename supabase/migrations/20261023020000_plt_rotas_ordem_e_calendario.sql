-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · SESSAO-39 — ROTAS: A ORDEM DO ENTREGADOR E
-- O CALENDÁRIO DA PROGRAMAÇÃO (D-174 · D-175)
--
-- 1. A ordem do entregador (D-174): "Entregas do dia" passa a receber a ORDEM
--    SALVA de cada parada — a tela numera como "Já programadas" (a ordem salva
--    ou, sem ela, a sugestão do mais perto a partir da fábrica). Antes, sem
--    ordem salva, o entregador via as paradas pela numeração do pedido, e o
--    Google Maps abriria numa ordem diferente da que a logística montou.
--    (plt_fn_entregas_do_dia recriada por extração da versão viva — A-97; md5
--    do corpo vivo conferido = d7047a66229431031646b7ebd3e9f075.)
-- 2. O calendário da programação (D-175): plt_fn_rotas_calendario — uma
--    requisição por semana ou por mês, cada pedido no seu dia na cor da
--    situação — + o índice parcial do "não entregue" pelo dia da rota.
--
-- Nada aqui toca as tabelas da integração. Aditiva e compatível com o site
-- publicado (a chave nova no JSON é ignorada pela tela antiga). Idempotente.
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · Entregas do dia: + a ordem salva de cada parada
-- ----------------------------------------------------------------------------
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
               -- SESSAO-39 (D-174): a ordem salva — a tela numera como "Já programadas"
               'ordem', pr.ordem,
               'card_id', pc.id, 'pedido_id', p.id, 'numero', p.numero,
               'cliente_nome', coalesce(c.nome, ''), 'telefone', c.fone,
               'endereco', c.endereco, 'numero_endereco', c.numero, 'complemento', c.complemento,
               'bairro', c.bairro, 'cidade', c.cidade, 'uf', c.uf,
               'latitude', g.latitude, 'longitude', g.longitude,
               'obs', p.obs, 'detalhe', pr.detalhe, 'data_prevista', p.data_prevista,
               'itens', coalesce(i.itens, '[]'::jsonb), 'unidades', coalesce(i.unidades, 0),
               'volumes', coalesce(i.volumes, 0),
               -- SESSAO-38 (D-156): o programado pode ainda estar em produção.
               'estado', pp.estado, 'pronto', coalesce(pp.pronto, true),
               'prontas', coalesce(pp.unidades_prontas, 0), 'a_entregar', coalesce(pp.a_entregar, 0),
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

  return jsonb_build_object('data', v_data, 'caminhao_id', v_caminhao, 'rota', v_rota, 'caminhoes', v_caminhoes,
                            'entregas', v_entregas, 'sou_logistica', v_logistica);
end;
$$;

comment on function public.plt_fn_entregas_do_dia(date, bigint, integer) is
  'SESSAO-30/31/38: as entregas do dia de uma rota (o entregador vê as da equipe dele; a logística escolhe). SESSAO-39 (D-174): + a ordem salva de cada parada — a tela numera como "Já programadas" (a salva ou a sugestão).';

-- O "não entregue" de cada dia de rota (o calendário busca pelo dia da entrega,
-- não pelo dia do gesto): parcial, só os fatos desse tipo — texto ISO, imutável.
create index if not exists plt_eventos_nao_entregue_dia_idx
  on public.plt_eventos ((dados ->> 'data_entrega'))
  where tipo = 'entrega_nao_realizada';

-- ----------------------------------------------------------------------------
-- 2 · O CALENDÁRIO da programação (D-175) — o modo "Calendário" de Rotas →
--     Programação, no formato do calendário da lista ROTAS do ClickUp que o
--     dono mostrou (semana de domingo a sábado; uma barra por pedido, na cor
--     da situação). Uma requisição por tela (semana ou mês — Lei §1), as
--     barras de cada dia limitadas (o resto em "Ver mais", por dia).
--
--     Cada pedido no seu dia, pela regra que as outras telas da rota já usam:
--       na_rota      — programado (o dia da programação), ainda não entregue;
--       entregue     — programado e entregue (o registro da entrega fica — D-156);
--       nao_entregue — o fato "não entregue" do dia (a programação foi desfeita
--                      e o pedido voltou para "Programar" — D-116);
--       sem_rota     — vivo, candidato à rota, sem programação: no dia da
--                      PREVISÃO de entrega (a do vendedor no Tiny);
--       standby      — vivo, segurado pelo PCP (D-169): no dia da previsão.
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_rotas_calendario(
  p_de           date,
  p_ate          date,
  p_por_dia      integer default 30,
  p_deslocamento integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
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
    -- 1) programados: na rota ou entregue (a mesma regra de "Já programadas")
    select pr.data_entrega                                   as dia,
           case when pc.entrega_evento_id is not null then 'entregue' else 'na_rota' end as situacao,
           pc.id                                             as card_id,
           p.numero,
           coalesce(nullif(btrim(c.bairro), ''), nullif(btrim(c.cidade), '')) as bairro,
           p.data_prevista,
           pr.detalhe,
           pr.caminhao_id,
           cam.nome                                          as caminhao_nome,
           pr.rota::int                                      as rota,
           pr.ordem,
           null::text                                        as motivo
      from public.plt_programacoes pr
      join public.plt_cards pc on pc.id = pr.card_id and pc.tipo = 'pedido'
      join public.pedidos p on p.id = pc.pedido_id
      left join public.clientes c on c.id = p.cliente_id
      left join public.plt_caminhoes cam on cam.id = pr.caminhao_id
     where pr.data_entrega between p_de and p_ate
       and (pc.arquivado_em is null or pc.entrega_evento_id is not null)
    union all
    -- 2) não entregue: o fato do dia da rota (índice próprio pelo dia — a
    --    marcação pode acontecer antes ou depois do dia programado)
    select (e.dados ->> 'data_entrega')::date,
           'nao_entregue',
           e.card_id,
           p.numero,
           coalesce(nullif(btrim(c.bairro), ''), nullif(btrim(c.cidade), '')),
           p.data_prevista,
           null,
           (e.dados ->> 'caminhao_id')::bigint,
           cam.nome,
           null,
           null,
           coalesce(e.dados ->> 'motivo', e.observacao)
      from public.plt_eventos e
      join public.plt_cards pc on pc.id = e.card_id
      join public.pedidos p on p.id = pc.pedido_id
      left join public.clientes c on c.id = p.cliente_id
      left join public.plt_caminhoes cam on cam.id = (e.dados ->> 'caminhao_id')::bigint
     where e.tipo = 'entrega_nao_realizada'
       and e.dados ->> 'data_entrega' between p_de::text and p_ate::text
    union all
    -- 3) sem rota e stand-by: os vivos sem programação, no dia da previsão
    select v.data_prevista,
           case when pc.standby_desde is not null then 'standby' else 'sem_rota' end,
           v.card_id,
           v.numero,
           coalesce(nullif(btrim(c.bairro), ''), nullif(btrim(c.cidade), '')),
           v.data_prevista,
           null,
           null,
           null,
           null,
           null,
           pc.standby_motivo
      from plt_privado.vw_pedidos_vivos v
      join public.plt_cards pc on pc.id = v.card_id
      left join public.clientes c on c.id = v.cliente_id
     where v.programacao_data is null
       and v.devolucao_evento_id is null
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
                      'situacao', n.situacao, 'card_id', n.card_id, 'numero', n.numero,
                      'bairro', n.bairro, 'previsao', n.data_prevista, 'detalhe', n.detalhe,
                      'caminhao_id', n.caminhao_id, 'caminhao_nome', n.caminhao_nome,
                      'rota', n.rota, 'ordem', n.ordem, 'motivo', n.motivo)
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

  -- O que não cabe em dia nenhum da tela: sem rota com a previsão vencida e sem previsão.
  select jsonb_build_object(
           'atrasados_sem_rota', count(*) filter (where v.data_prevista < v_hoje),
           'sem_previsao',       count(*) filter (where v.data_prevista is null))
    into v_resumo
    from plt_privado.vw_pedidos_vivos v
    join public.plt_cards pc on pc.id = v.card_id
   where v.programacao_data is null
     and v.devolucao_evento_id is null
     and pc.standby_desde is null;

  return jsonb_build_object('de', p_de, 'ate', p_ate, 'hoje', v_hoje,
                            'por_dia', v_por_dia, 'dias', v_dias, 'fora', v_resumo);
end;
$$;

comment on function public.plt_fn_rotas_calendario(date, date, integer, integer) is
  'SESSAO-39 (D-175): o calendário da programação (Rotas → Programação → Calendário) — de p_de a p_ate (até 6 semanas), cada pedido no seu dia: na_rota/entregue (dia programado), nao_entregue (o fato do dia), sem_rota/standby (dia da previsão). Por dia: total, contagem por situação e até p_por_dia barras (p_deslocamento = "Ver mais" de um dia). + fora: sem rota com a previsão vencida e sem previsão. Uma requisição por tela; só a logística (fn_pode_ver_expedicao).';

revoke all on function public.plt_fn_rotas_calendario(date, date, integer, integer) from public, anon;
grant execute on function public.plt_fn_rotas_calendario(date, date, integer, integer) to authenticated;
