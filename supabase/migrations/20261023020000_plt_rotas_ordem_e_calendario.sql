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
