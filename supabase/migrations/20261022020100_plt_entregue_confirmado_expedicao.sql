-- ============================================================================
-- SESSAO-38 · F2 · rodada de ajustes do supervisor (21/10/2026)
--
-- 1. "Entregue" com o pedido AINDA EM PRODUÇÃO na plataforma (↩️ D-156, como
--    a D-113): não se trava mais — no campo, o estado da plataforma pode estar
--    atrasado (alguém esqueceu de arrastar a peça). Pede CONFIRMAÇÃO explícita:
--    sem a marca `p_confirmar_incompleto` o banco recusa com a frase da
--    confirmação; com ela, fecha tudo do pedido onde a peça estiver, como o
--    caminho do Tiny (o tempo aberto fecha antes). Parâmetro novo com padrão
--    falso → o site antigo continua com o comportamento de antes.
--    O card do pedido que ainda espera liberação no PCP sai com a entrega (não
--    fica no quadro do PCP); "Entregas do dia" mostra a entrega do dia mesmo
--    assim, para desfazer (o desfazer devolve o card).
-- 2. "Pedidos em aguardo" não é mais tela: os textos que o banco escreve para
--    gente (avisos, recusas, observação do reenvio) passam a dizer "Expedição".
--    Nenhum dado, coluna, setor ou etapa muda de nome; avisos antigos ficam.
-- 3. Área Pedidos: o pedido PROGRAMADO aparece "Em rota" (com dia, caminhão e
--    rota), não "pronto no aguardo" — a lista ganha as colunas da programação.
--
-- Todas recriadas a partir do corpo VIVO (md5 do banco = md5 do arquivo).
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · "Entregue" com confirmação quando o pedido não está pronto
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_registrar_entrega(bigint, text);
create or replace function public.plt_fn_registrar_entrega(
  p_card_id              bigint,
  p_observacao           text    default null,
  -- SESSAO-38 (↩️ D-156): a pessoa confirmou que entrega mesmo com o pedido
  -- ainda aparecendo em produção na fábrica (o site antigo não manda → falso).
  p_confirmar_incompleto boolean default false
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario  uuid;
  v_card     public.plt_cards%rowtype;
  v_total    integer;
  v_em_rotas integer;
  v_ret      jsonb;
  v_obs      text;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null then
    raise exception 'Só usuário ativo da plataforma registra entrega.' using errcode = 'insufficient_privilege';
  end if;
  if not plt_privado.fn_pode_mexer_entrega(p_card_id) then
    raise exception 'Registrar entrega é gesto da logística (PCP/terminais), do entregador do caminhão ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_card from public.plt_cards where id = p_card_id and tipo = 'pedido' for update;
  if not found then
    raise exception 'Card de pedido % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  -- SESSAO-38 (D-156): sem o "lançado para ROTAS" — o pedido programado (ou
  -- pronto) se entrega com as peças onde estiverem no fim de linha. Em
  -- decisão pós devolução não se entrega (a logística decide antes — D-129).
  if v_card.devolucao_evento_id is not null and v_card.entrega_evento_id is null then
    raise exception 'Este pedido está em decisão pós devolução — decida a situação das peças antes de entregar.'
      using errcode = 'check_violation';
  end if;
  if v_card.entrega_evento_id is not null then
    -- SESSAO-30 (Lei §10): o mesmo toque repetido (a rede que volta, o dedo
    -- que toca duas vezes) = uma entrega só — devolve a que já existe.
    if exists (select 1 from public.plt_eventos e
                where e.id = v_card.entrega_evento_id and e.usuario_id = v_usuario
                  and e.ocorrido_em > now() - interval '10 minutes') then
      return v_card.entrega_evento_id;
    end if;
    raise exception 'Este pedido já foi registrado como entregue.' using errcode = 'check_violation';
  end if;
  if plt_privado.fn_pedido_cancelado(v_card.pedido_id) then
    raise exception 'Este pedido foi cancelado no Tiny — não se entrega.' using errcode = 'check_violation';
  end if;

  -- D-63: frete não conta. D-33: entrega por pedido completo — do que falta
  -- entregar (SESSAO-31, D-130: a reentrega depois do ajuste leva só o que voltou).
  v_total := plt_privado.fn_unidades_a_entregar(v_card.pedido_id);
  -- SESSAO-38 (D-156): pronta = no fim de linha (a Expedição ou a ROTAS), fora
  -- da decisão pós devolução — a mesma regra da prontidão (vw_pedido_prontidao).
  select count(*)::int into v_em_rotas
    from public.plt_cards cu
    join public.plt_setores s on s.id = cu.setor_atual_id
   where cu.pedido_id = v_card.pedido_id and cu.tipo = 'unidade'
     and cu.arquivado_em is null and s.papel_no_fluxo = 'terminal' and s.codigo <> 'devolucao';
  v_obs := p_observacao;
  if v_em_rotas < v_total then
    -- ↩️ SESSAO-38 (revisão da D-156, como a D-113): no campo, a plataforma pode
    -- estar atrasada (a peça não foi arrastada). Não trava: pede a confirmação
    -- e, confirmada, fecha tudo do pedido onde a peça estiver (o tempo aberto
    -- fecha antes — fn_fechar_pedido), com a trilha dizendo como estava.
    if not coalesce(p_confirmar_incompleto, false) then
      raise exception 'Este pedido ainda aparece em produção na fábrica (% de % peças prontas). Confirmar a entrega encerra tudo dele.', v_em_rotas, v_total
        using errcode = 'check_violation';
    end if;
    v_obs := concat_ws(' — ', nullif(btrim(p_observacao), ''),
                       format('Entregue com %s de %s peças prontas na plataforma (confirmado por quem entregou).', v_em_rotas, v_total));
  end if;

  v_ret := plt_privado.fn_fechar_pedido(p_card_id, v_usuario, 'interface', v_obs, 'plataforma');
  perform plt_privado.fn_tiny_pedido_enfileirar(v_card.pedido_id, 'entregue', 'entregue');
  return (v_ret ->> 'entrega_evento_id')::bigint;
end;
$$;

comment on function public.plt_fn_registrar_entrega(bigint, text, boolean) is
  'SESSAO-11/30/38: registra a entrega do pedido (fecha tudo + fila do Tiny). SESSAO-38 (↩️ D-156): pedido ainda não pronto na plataforma só com p_confirmar_incompleto = true (a tela pergunta antes); sem a marca, recusa com a frase da confirmação.';
revoke all on function public.plt_fn_registrar_entrega(bigint, text, boolean) from public, anon;
grant execute on function public.plt_fn_registrar_entrega(bigint, text, boolean) to authenticated;

create or replace function plt_privado.fn_fechar_pedido(
  p_card_pedido_id bigint,
  p_usuario        uuid,
  p_origem         text,
  p_observacao     text,
  p_fonte          text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card      public.plt_cards%rowtype;
  v_numero    integer;
  v_situacao  text;
  v_entrega   bigint;
  v_nova      boolean := false;
  v_vivas     integer;
  v_unidades  integer := 0;
  v_tempos    integer := 0;
  v_reservas  integer := 0;
  v_card_saiu boolean := false;
  v_marca_e   text;
  v_marca_m   text;
  r           record;
begin
  select * into v_card from public.plt_cards
   where id = p_card_pedido_id and tipo = 'pedido'
   for update;
  if not found then
    raise exception 'Card de pedido % não existe.', p_card_pedido_id using errcode = 'no_data_found';
  end if;
  select p.numero, p.situacao into v_numero, v_situacao
    from public.pedidos p where p.id = v_card.pedido_id;

  select count(*)::int into v_vivas
    from public.plt_cards u
   where u.pedido_id = v_card.pedido_id and u.tipo = 'unidade' and u.arquivado_em is null;

  -- Card já arquivado e nada vivo: história antiga — nada a fechar.
  if v_card.arquivado_em is not null and v_vivas = 0
     and not exists (select 1 from public.plt_cards s
                      where s.reservada_pedido_id = v_card.pedido_id and s.arquivado_em is null) then
    return jsonb_build_object('fechou', false, 'motivo', 'arquivado', 'numero', v_numero);
  end if;

  v_marca_e := current_setting('plt.entrega_maquinaria', true);
  v_marca_m := current_setting('plt.estoque_maquinaria', true);
  perform set_config('plt.entrega_maquinaria', 'on', true);
  -- SESSAO-30 (raio-x 2): a peça do estoque reservada sai com o pedido.
  perform set_config('plt.estoque_maquinaria', 'on', true);

  -- SESSAO-30 (etapa 4): a entrega VIGENTE (a desfeita não conta).
  v_entrega := v_card.entrega_evento_id;
  if v_entrega is null then
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
      values (v_card.id, 'pedido_entregue', p_usuario, p_origem,
              nullif(btrim(p_observacao), ''),
              jsonb_build_object('fonte', p_fonte, 'numero', v_numero,
                                 'situacao_tiny', v_situacao, 'unidades', v_vivas,
                                 'lancado_rotas', v_card.lancado_rotas_em is not null))
      returning id into v_entrega;
    v_nova := true;
  end if;

  -- Cada peça viva do pedido sai de toda conta (estoque, reservas, ROTAS ativa,
  -- Visão do dia) e fica no histórico — o tempo aberto fecha antes.
  for r in
    select c.id from public.plt_cards c
     where c.pedido_id = v_card.pedido_id and c.tipo = 'unidade' and c.arquivado_em is null
     order by c.id
       for update
  loop
    if plt_privado.fn_fechar_tempo_aberto(r.id, 'O pedido foi entregue: o tempo aberto fecha antes de a peça sair.') then
      v_tempos := v_tempos + 1;
    end if;
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
      values (r.id, 'card_arquivado', p_usuario, p_origem,
              'Pedido ' || coalesce(v_numero::text, '') || ' entregue — a peça saiu com ele.',
              jsonb_build_object('motivo', 'entregue', 'entrega_evento_id', v_entrega,
                                 'fonte', p_fonte, 'numero', v_numero));
    v_unidades := v_unidades + 1;
  end loop;

  -- A peça do ESTOQUE reservada pela venda sai com o pedido (motivo "venda" —
  -- a mesma baixa da D-78; não volta ao Tiny, que já baixou na venda).
  for r in
    select c.id, c.setor_atual_id, c.reservada_item_seq, c.reservada_indice, c.produto_tiny_id
      from public.plt_cards c
     where c.reservada_pedido_id = v_card.pedido_id and c.arquivado_em is null
     order by c.id
       for update
  loop
    insert into public.plt_eventos (card_id, tipo, origem, setor_origem_id, observacao, dados)
      values (r.id, 'card_arquivado', 'api', r.setor_atual_id,
              format('Saiu com o pedido %s (entregue).', v_numero),
              jsonb_build_object('motivo', 'venda', 'pedido_id', v_card.pedido_id, 'numero', v_numero,
                                 'item_seq', r.reservada_item_seq, 'indice_unidade', r.reservada_indice,
                                 'produto_tiny_id', r.produto_tiny_id, 'entrega_evento_id', v_entrega));
    v_reservas := v_reservas + 1;
  end loop;

  -- O card do pedido que nunca foi às ROTAS sai do PCP (o lançado fica: é o
  -- registro da entrega em ROTAS → Entregas e em "Já programadas").
  -- SESSAO-38 (D-156): o PROGRAMADO também fica (a entrega dele aparece em
  -- "Entregas do dia" para desfazer no mesmo dia e no histórico da Programação).
  -- ↩️ SESSAO-38 (ajuste): o card que ainda espera liberação no PCP (entrega
  -- confirmada com o pedido incompleto, ou o Tiny) sai mesmo programado — senão
  -- ficaria no quadro do PCP; "Entregas do dia" e a Programação o mostram assim
  -- mesmo e o desfazer o devolve.
  if v_card.arquivado_em is null
     and ((v_card.lancado_rotas_em is null
           and not exists (select 1 from public.plt_programacoes pr where pr.card_id = v_card.id))
          or (v_card.lancado_rotas_em is null and v_card.liberado_completo_em is null)) then
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
      values (v_card.id, 'card_arquivado', p_usuario, p_origem,
              'Pedido entregue — sai do PCP.',
              jsonb_build_object('motivo', 'entregue', 'entrega_evento_id', v_entrega,
                                 'fonte', p_fonte, 'numero', v_numero));
    v_card_saiu := true;
  end if;

  perform set_config('plt.entrega_maquinaria', coalesce(v_marca_e, ''), true);
  perform set_config('plt.estoque_maquinaria', coalesce(v_marca_m, ''), true);
  return jsonb_build_object('fechou', true, 'numero', v_numero, 'entrega_evento_id', v_entrega,
                            'entrega_nova', v_nova, 'unidades', v_unidades,
                            'tempos_fechados', v_tempos, 'reservas', v_reservas,
                            'card_saiu_do_pcp', v_card_saiu);
end;
$$;

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

-- ----------------------------------------------------------------------------
-- 2 · Os textos que o banco escreve: "Pedidos em aguardo" → "Expedição"
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_reagir_qualidade()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card        public.plt_cards%rowtype;
  v_marc        public.plt_eventos%rowtype;
  v_setor_origem  text;
  v_setor_destino text;
  v_destino_codigo text;
  v_destino_papel  text;
  v_autor         text;
  v_autor_marc    text;
  v_pedido_numero integer;
  v_peca          text;
  v_etapa_danificado bigint;
  v_tipo_aviso    text;
  v_titulo        text;
  v_corpo         text;
  v_destinatarios uuid[];
  v_destinatario  uuid;
  v_divergente    boolean;
begin
  if new.tipo not in ('qualidade_marcada', 'qualidade_parecer', 'movimentacao_setor') then
    return null;
  end if;

  select * into v_card from public.plt_cards where id = new.card_id;
  select p.numero into v_pedido_numero from public.pedidos p where p.id = v_card.pedido_id;
  v_peca := coalesce(v_card.item_descricao, 'Peça')
            || case when v_card.indice_unidade is not null
                    then format(' (%s/%s)', v_card.indice_unidade, v_card.total_unidades)
                    else '' end
            || coalesce(' · Pedido ' || v_pedido_numero, '');

  select s.nome into v_setor_origem  from public.plt_setores s where s.id = new.setor_origem_id;
  select s.nome, s.codigo, s.papel_no_fluxo into v_setor_destino, v_destino_codigo, v_destino_papel
    from public.plt_setores s where s.id = new.setor_destino_id;
  select u.nome into v_autor from public.plt_usuarios u where u.id = new.usuario_id;

  -- ---------- Chegada ----------
  if new.tipo = 'movimentacao_setor' then
    -- SESSAO-31 (D-126): marcada 🔴 por quem entregou e sem confirmação na
    -- chegada (o setor não pede) — a peça vai direto para o DANIFICADO do
    -- setor que recebe (D-09 item 4). O aviso já saiu na marcação.
    if new.evento_referencia_id is not null
       and v_destino_papel = 'producao'
       and v_card.parecer_pendente_id is null
       and v_card.setor_atual_id = new.setor_destino_id then
      select * into v_marc from public.plt_eventos where id = new.evento_referencia_id;
      if v_marc.tipo = 'qualidade_marcada' and v_marc.estado_qualidade = 'danificado' then
        v_etapa_danificado := plt_privado.fn_garantir_etapa_danificado(new.setor_destino_id);
        if v_card.etapa_atual_id is distinct from v_etapa_danificado then
          insert into public.plt_eventos
              (card_id, tipo, usuario_id, origem,
               setor_origem_id, etapa_origem_id, setor_destino_id, etapa_destino_id,
               observacao)
            values
              (new.card_id, 'movimentacao_etapa', new.usuario_id, 'automacao',
               v_card.setor_atual_id, v_card.etapa_atual_id,
               v_card.setor_atual_id, v_etapa_danificado,
               'Consequência automática: a peça foi entregue danificada.');
        end if;
      end if;
      return null;
    end if;

    -- Chegada ao fim de linha avisa os admins (D-25; S24)
    if v_destino_codigo = 'estoque' then
      v_tipo_aviso := 'chegada_estoque';
      if new.dados ->> 'motivo' = 'pedido_cancelado' then
        -- SESSAO-24: a peça pronta do pedido cancelado voltou ao ESTOQUE.
        v_titulo := 'Pedido ' || coalesce(new.dados ->> 'numero', '') || ' cancelado: peça voltou ao ESTOQUE';
        v_corpo  := v_peca || ' estava pronta na Expedição e voltou ao ESTOQUE, sem dono — o pedido '
                    || coalesce(new.dados ->> 'numero', '') || ' foi cancelado no Tiny.';
      else
        v_titulo := 'Peça chegou ao ESTOQUE';
        v_corpo  := v_peca || ' chegou ao ESTOQUE'
                    || coalesce(' vinda de ' || v_setor_origem, '')
                    || coalesce(' por ' || v_autor, '')
                    || case when v_card.qualidade_atual is not null
                            then ', marcada como ' || plt_privado.fn_rotulo_estado(v_card.qualidade_atual)
                            else '' end
                    || '.'
                    || case when v_card.pedido_id is not null
                                 and plt_privado.fn_pedido_cancelado(v_card.pedido_id)
                            then ' O pedido foi cancelado no Tiny: a peça fica no estoque, sem dono.'
                            else '' end;
      end if;
    elsif v_destino_codigo = 'aguardo' then
      -- SESSAO-24: a peça pronta de pedido mora em Pedidos em aguardo. Só a
      -- peça que ACABOU de ficar pronta avisa — chegar de outro fim de linha
      -- (manutenção, ajuste) não é produção nova.
      if exists (select 1 from public.plt_setores so
                  where so.id = new.setor_origem_id and so.papel_no_fluxo = 'terminal') then
        return null;
      end if;
      v_tipo_aviso := 'chegada_aguardo';
      v_titulo := 'Peça pronta na Expedição';
      v_corpo  := v_peca || ' ficou pronta e entrou na Expedição'
                  || coalesce(' vinda de ' || v_setor_origem, '')
                  || coalesce(' por ' || v_autor, '')
                  || '.';
    else
      return null;
    end if;
    select coalesce(array_agg(distinct u.id), '{}') into v_destinatarios
      from public.plt_usuarios u
     where u.ativo and u.papel = 'admin'
       and u.id is distinct from new.usuario_id;

  -- ---------- Marcação 🟡/🔴 de quem entrega (Q-18) ----------
  elsif new.tipo = 'qualidade_marcada' then
    if new.estado_qualidade not in ('atencao', 'danificado') then
      return null;
    end if;
    v_tipo_aviso := 'qualidade_' || new.estado_qualidade;
    v_titulo := 'Peça marcada como ' || plt_privado.fn_rotulo_estado(new.estado_qualidade);
    v_corpo  := coalesce(v_autor, 'Alguém') || coalesce(' (' || v_setor_origem || ')', '')
                || ' marcou a peça como ' || plt_privado.fn_rotulo_estado(new.estado_qualidade)
                || coalesce(' ao mover para ' || v_setor_destino, '')
                || '. ' || v_peca || '.';

  -- ---------- Confirmação: divergência ou 🔴 (Q-18 / RF-83) ----------
  else
    select * into v_marc from public.plt_eventos where id = new.evento_referencia_id;

    -- 🔴 registrado pelo recebedor (confirmado, divergente ou sem marcação):
    -- o card vai para a etapa DANIFICADO do setor onde está (D-09 item 4).
    if new.estado_qualidade = 'danificado' and v_card.setor_atual_id is not null then
      v_etapa_danificado := plt_privado.fn_garantir_etapa_danificado(v_card.setor_atual_id);
      if v_card.etapa_atual_id is distinct from v_etapa_danificado then
        insert into public.plt_eventos
            (card_id, tipo, usuario_id, origem,
             setor_origem_id, etapa_origem_id, setor_destino_id, etapa_destino_id,
             observacao)
          values
            (new.card_id, 'movimentacao_etapa', new.usuario_id, 'automacao',
             v_card.setor_atual_id, v_card.etapa_atual_id,
             v_card.setor_atual_id, v_etapa_danificado,
             'Consequência automática do parecer 🔴 danificado.');
      end if;
    end if;

    if v_marc.tipo is distinct from 'qualidade_marcada' then
      -- SESSAO-31 (D-126): ninguém marcou na saída — o estado é o de quem
      -- recebeu. 🟡/🔴 avisam como uma marcação avisaria.
      if new.estado_qualidade not in ('atencao', 'danificado') then
        return null;
      end if;
      v_tipo_aviso := 'qualidade_' || new.estado_qualidade;
      v_titulo := 'Peça recebida como ' || plt_privado.fn_rotulo_estado(new.estado_qualidade);
      v_corpo  := coalesce(v_autor, 'Quem recebeu') || coalesce(' (' || v_setor_destino || ')', '')
                  || ' registrou ' || plt_privado.fn_rotulo_estado(new.estado_qualidade)
                  || ' ao receber a peça' || coalesce(' vinda de ' || v_setor_origem, '')
                  || '. ' || v_peca || '.'
                  || case when new.estado_qualidade = 'danificado'
                          then ' O card foi para a etapa DANIFICADO.' else '' end;
    else
      v_divergente := v_marc.estado_qualidade is distinct from new.estado_qualidade;
      if not v_divergente and new.estado_qualidade <> 'danificado' then
        -- Concordância em 🟢/🟡 não gera aviso novo: o 🟡 já avisou na marcação.
        return null;
      end if;

      select u.nome into v_autor_marc from public.plt_usuarios u where u.id = v_marc.usuario_id;
      if v_divergente then
        v_tipo_aviso := 'qualidade_divergencia';
        v_titulo := 'Divergência de qualidade entre ' || coalesce(v_setor_origem, 'setores')
                    || ' e ' || coalesce(v_setor_destino, '');
        v_corpo  := coalesce(v_autor_marc, 'Quem entregou') || coalesce(' (' || v_setor_origem || ')', '')
                    || ' marcou ' || plt_privado.fn_rotulo_estado(v_marc.estado_qualidade)
                    || '; ' || coalesce(v_autor, 'quem recebeu') || coalesce(' (' || v_setor_destino || ')', '')
                    || ' registrou ' || plt_privado.fn_rotulo_estado(new.estado_qualidade)
                    || '. ' || v_peca || '.'
                    || case when new.estado_qualidade = 'danificado'
                            then ' O card foi para a etapa DANIFICADO.' else '' end;
      else
        v_tipo_aviso := 'qualidade_danificado';
        v_titulo := 'Dano confirmado no recebimento';
        v_corpo  := coalesce(v_autor, 'Quem recebeu') || coalesce(' (' || v_setor_destino || ')', '')
                    || ' confirmou ' || plt_privado.fn_rotulo_estado('danificado')
                    || coalesce(' na entrega de ' || v_setor_origem, '')
                    || '. ' || v_peca || '. O card foi para a etapa DANIFICADO.';
      end if;
    end if;
  end if;

  -- ---------- Destinatários: líderes dos DOIS setores + admins (D-25) ----------
  if v_destinatarios is null then
    select coalesce(array_agg(distinct pessoa), '{}') into v_destinatarios
      from (
        select u.id as pessoa
          from public.plt_usuarios u
         where u.ativo and u.papel = 'admin'
        union
        select us.usuario_id
          from public.plt_usuario_setores us
          join public.plt_usuarios u on u.id = us.usuario_id and u.ativo
         where us.lider_do_setor
           and us.setor_id in (new.setor_origem_id, new.setor_destino_id)
      ) todos
     where pessoa is distinct from new.usuario_id;
  end if;

  if array_length(v_destinatarios, 1) is null then
    return null;
  end if;

  foreach v_destinatario in array v_destinatarios loop
    insert into public.plt_notificacoes
        (destinatario_id, evento_id, card_id, tipo, titulo, corpo)
      values
        (v_destinatario, new.id, new.card_id, v_tipo_aviso, v_titulo, v_corpo);
  end loop;

  -- O FATO de o aviso ter saído também é história do card.
  insert into public.plt_eventos
      (card_id, tipo, origem, evento_referencia_id,
       setor_origem_id, setor_destino_id, observacao, dados)
    values
      (new.card_id, 'notificacao_enviada', 'automacao', new.id,
       new.setor_origem_id, new.setor_destino_id, v_titulo,
       jsonb_build_object('tipo', v_tipo_aviso, 'destinatarios', to_jsonb(v_destinatarios)));

  return null;
end;
$$;

create or replace function plt_privado.fn_validar_chegada_estoque()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_destino   text;
  v_estado    text;
  v_card      public.plt_cards%rowtype;
  v_cancelado boolean;
begin
  if new.tipo not in ('movimentacao_setor', 'card_criado')
     or coalesce(current_setting('plt.ajuste_super_admin', true), '') = 'on' then
    return new;
  end if;
  select s.codigo into v_destino from public.plt_setores s where s.id = new.setor_destino_id;
  if v_destino is null or v_destino not in ('estoque', 'aguardo') then
    return new;
  end if;

  select * into v_card from public.plt_cards where id = new.card_id;

  -- A marcação da própria transição manda; sem ela (saída de PCP/terminal),
  -- vale o último estado conhecido da peça.
  if new.evento_referencia_id is not null then
    select e.estado_qualidade into v_estado
      from public.plt_eventos e
     where e.id = new.evento_referencia_id and e.tipo = 'qualidade_marcada';
  end if;
  if v_estado is null then
    v_estado := v_card.qualidade_atual;
  end if;
  if v_estado in ('atencao', 'danificado') then
    if v_destino = 'estoque' then
      raise exception 'O ESTOQUE só recebe peça em perfeito estado. Peça em atenção ou danificada vai para o DANIFICADO do setor.'
        using errcode = 'check_violation';
    end if;
    raise exception 'A Expedição só recebe peça em perfeito estado. Peça em atenção ou danificada vai para o DANIFICADO do setor.'
      using errcode = 'check_violation';
  end if;

  -- SESSAO-24 (b4 do dono): "estoque só fica como local final de peça sem dono".
  v_cancelado := v_card.pedido_id is not null and plt_privado.fn_pedido_cancelado(v_card.pedido_id);
  if v_destino = 'aguardo' then
    if v_card.pedido_id is null then
      raise exception 'A Expedição recebe só peça de pedido — peça sem dono vai para o ESTOQUE.'
        using errcode = 'check_violation';
    end if;
    if v_cancelado then
      raise exception 'O pedido desta peça foi cancelado no Tiny — ela vai para o ESTOQUE, sem dono.'
        using errcode = 'check_violation';
    end if;
  elsif v_card.pedido_id is not null and not v_cancelado then
    raise exception 'Peça de pedido vai para a Expedição — o ESTOQUE recebe só peça sem dono.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function plt_privado.fn_concluir_pedido(p_card_pedido_id bigint, p_usuario uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card    public.plt_cards%rowtype;
  v_numero  integer;
  v_aguardo bigint;
  v_total   integer;
  v_u       public.plt_cards%rowtype;
  v_peca    public.plt_cards%rowtype;
  v_novo    bigint;
  v_produto bigint;
  v_ja      integer := 0;
  v_movidas integer := 0;
  v_criadas integer := 0;
  v_usadas  integer := 0;
  v_pulados integer := 0;
  v_marca_m text;
  v_marca_a text;
  it        record;
  k         integer;
begin
  select * into v_card from public.plt_cards
   where id = p_card_pedido_id and tipo = 'pedido'
   for update;
  if not found then
    raise exception 'Card de pedido % não existe.', p_card_pedido_id using errcode = 'no_data_found';
  end if;
  if v_card.arquivado_em is not null then
    raise exception 'Este pedido está arquivado.' using errcode = 'check_violation';
  end if;
  if plt_privado.fn_entregue(v_card.id) then
    raise exception 'Este pedido já foi entregue.' using errcode = 'check_violation';
  end if;
  if v_card.lancado_rotas_em is not null then
    return jsonb_build_object('concluido', false, 'motivo', 'ja_em_rota');
  end if;
  if plt_privado.fn_pedido_cancelado(v_card.pedido_id) then
    raise exception 'Este pedido foi cancelado no Tiny — não dá para concluir.' using errcode = 'check_violation';
  end if;

  select p.numero into v_numero from public.pedidos p where p.id = v_card.pedido_id;
  select s.id into v_aguardo from public.plt_setores s where s.codigo = 'aguardo' and s.ativo;
  if v_aguardo is null then
    raise exception 'O lugar da Expedição (a peça pronta de pedido) não está cadastrado — fale com o admin.' using errcode = 'no_data_found';
  end if;

  v_total := plt_privado.fn_unidades_do_pedido(v_card.pedido_id);
  if v_total = 0 then
    return jsonb_build_object('concluido', true, 'motivo', 'sem_producao');
  end if;

  v_marca_m := current_setting('plt.estoque_maquinaria', true);
  v_marca_a := current_setting('plt.ajuste_super_admin', true);
  perform set_config('plt.estoque_maquinaria', 'on', true);
  -- SESSAO-30 (raio-x 1): o ajuste do super admin (D-117) passa pela regra
  -- dos fins de linha — ele decide que a peça está pronta.
  perform set_config('plt.ajuste_super_admin', 'on', true);

  for it in
    select v.seq, v.codigo, v.descricao, v.unidades
      from plt_privado.vw_itens_producao v
     where v.pedido_id = v_card.pedido_id and v.unidades >= 1
     order by v.seq
  loop
    for k in 1 .. it.unidades loop
      select * into v_u from public.plt_cards u
       where u.pedido_id = v_card.pedido_id and u.tipo = 'unidade'
         and u.item_seq = it.seq and u.indice_unidade = k
       for update;
      if found then
        if v_u.arquivado_em is not null then
          v_pulados := v_pulados + 1;
          continue;
        end if;
        if v_u.setor_atual_id = v_aguardo then
          v_ja := v_ja + 1;
          continue;
        end if;
        perform plt_privado.fn_fechar_tempo_aberto(v_u.id, 'Concluído pelo super admin: o tempo aberto fecha antes.');
        select * into v_u from public.plt_cards where id = v_u.id;
        insert into public.plt_eventos
            (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id,
             setor_destino_id, etapa_destino_id, observacao, dados)
          values
            (v_u.id, 'movimentacao_setor', p_usuario, 'api', v_u.setor_atual_id, v_u.etapa_atual_id,
             v_aguardo, null, 'Concluído pelo super admin (ajuste da plataforma).',
             jsonb_build_object('ajuste_super_admin', true, 'numero', v_numero));
        v_movidas := v_movidas + 1;
      else
        -- A peça do estoque reservada pela venda para ESTA unidade: usa ela.
        select * into v_peca from public.plt_cards c
         where c.reservada_pedido_id = v_card.pedido_id and c.reservada_item_seq = it.seq
           and c.reservada_indice = k and c.arquivado_em is null
         limit 1
           for update;
        v_produto := case when found then v_peca.produto_tiny_id
                          else plt_privado.fn_produto_do_item(it.codigo, it.descricao) end;

        insert into public.plt_cards
            (tipo, pedido_id, card_pai_id, item_seq, item_codigo, item_descricao,
             indice_unidade, total_unidades, produto_tiny_id, setor_atual_id)
          values
            ('unidade', v_card.pedido_id, v_card.id, it.seq, it.codigo, it.descricao,
             k, it.unidades, v_produto, v_aguardo)
          returning id into v_novo;

        insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_destino_id, observacao, dados)
          values (v_novo, 'card_criado', p_usuario, 'api', v_aguardo,
                  case when v_peca.id is not null
                       then 'Concluído pelo super admin — usou a peça do estoque reservada para o pedido.'
                       else 'Concluído pelo super admin — a peça nasce pronta (ajuste da plataforma).' end,
                  jsonb_build_object('ajuste_super_admin', true, 'numero', v_numero)
                  || case when v_peca.id is not null
                          then jsonb_build_object('alocada_de', v_peca.id, 'reservada', true)
                          else '{}'::jsonb end);

        if v_peca.id is not null then
          insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, observacao, dados)
            values (v_peca.id, 'peca_alocada', p_usuario, 'api', v_peca.setor_atual_id,
                    'Usada pelo pedido ' || coalesce(v_numero::text, '')
                      || format(' (%s/%s) — concluído pelo super admin.', k, it.unidades),
                    jsonb_build_object('pedido_id', v_card.pedido_id, 'numero', v_numero,
                                       'card_pedido_id', v_card.id, 'unidade_card_id', v_novo,
                                       'item_seq', it.seq, 'indice_unidade', k, 'reservada', true));
          v_usadas := v_usadas + 1;
        else
          v_criadas := v_criadas + 1;
        end if;
      end if;
    end loop;
  end loop;

  perform plt_privado.fn_recalcular_liberacao(v_card.pedido_id);
  perform set_config('plt.estoque_maquinaria', coalesce(v_marca_m, ''), true);
  perform set_config('plt.ajuste_super_admin', coalesce(v_marca_a, ''), true);

  return jsonb_build_object('concluido', true, 'numero', v_numero, 'ja_prontas', v_ja,
                            'movidas', v_movidas, 'criadas', v_criadas,
                            'pecas_do_estoque', v_usadas, 'arquivadas_puladas', v_pulados);
end;
$$;

create or replace function public.plt_fn_ajuste_abrir(
  p_peca_id       bigint,
  p_setor_id      bigint,
  p_destino_final text,
  p_descricao     text default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
  v_peca    public.plt_cards%rowtype;
  v_onde    text;
  v_setor   public.plt_setores%rowtype;
  v_evento  bigint;
  v_numero  integer;
  v_marca_d text;
  v_marca_e text;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Abrir ajuste de peça é gesto do PCP/logística ou de admin.' using errcode = 'insufficient_privilege';
  end if;
  if p_destino_final not in ('estoque', 'pedido', 'terceirizado', 'loja', 'danificados') then
    raise exception 'Escolha o destino final do ajuste.' using errcode = 'check_violation';
  end if;
  select * into v_setor from public.plt_setores where id = p_setor_id and ativo;
  if not found or v_setor.papel_no_fluxo <> 'producao' then
    raise exception 'O ajuste vai para um setor de produção.' using errcode = 'check_violation';
  end if;
  select * into v_peca from public.plt_cards where id = p_peca_id and tipo = 'unidade' for update;
  if not found then
    raise exception 'Peça % não existe.', p_peca_id using errcode = 'no_data_found';
  end if;
  if v_peca.ajuste_evento_id is not null then
    raise exception 'Esta peça já está em ajuste.' using errcode = 'check_violation';
  end if;
  if p_destino_final = 'pedido' and (v_peca.pedido_id is null or plt_privado.fn_pedido_cancelado(v_peca.pedido_id)) then
    raise exception 'Voltar ao pedido só vale para peça de pedido vivo.' using errcode = 'check_violation';
  end if;
  select s.codigo into v_onde from public.plt_setores s where s.id = v_peca.setor_atual_id;
  if v_peca.arquivado_em is not null then
    -- Já entregue: a peça volta (só a que saiu com uma entrega).
    if (select a.dados ->> 'motivo' from public.plt_eventos a
         where a.card_id = v_peca.id and a.tipo = 'card_arquivado' order by a.id desc limit 1) is distinct from 'entregue' then
      raise exception 'Só peça já entregue, em decisão pós devolução, no ESTOQUE ou na Expedição vai para ajuste.'
        using errcode = 'check_violation';
    end if;
  elsif coalesce(v_onde, '') not in ('devolucao', 'estoque', 'aguardo') then
    raise exception 'Só peça já entregue, em decisão pós devolução, no ESTOQUE ou na Expedição vai para ajuste.'
      using errcode = 'check_violation';
  end if;
  if v_onde = 'estoque' and v_peca.arquivado_em is null and v_peca.reservada_pedido_id is not null then
    raise exception 'Esta peça do estoque está reservada para um pedido.' using errcode = 'check_violation';
  end if;
  select p.numero into v_numero from public.pedidos p where p.id = v_peca.pedido_id;

  v_marca_d := current_setting('plt.devolucao_maquinaria', true);
  v_marca_e := current_setting('plt.entrega_maquinaria', true);
  perform set_config('plt.devolucao_maquinaria', 'on', true);
  perform set_config('plt.entrega_maquinaria', 'on', true);

  if v_peca.arquivado_em is not null then
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id, observacao, dados)
      values (v_peca.id, 'card_desarquivado', v_usuario, 'interface', v_peca.setor_atual_id, v_peca.etapa_atual_id,
              'A peça entregue voltou para ajuste.', jsonb_build_object('motivo', 'ajuste'));
  end if;
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
    values (v_peca.id, 'ajuste_aberto', v_usuario, 'interface',
            coalesce(nullif(btrim(p_descricao), ''), 'Ajuste de peça.'),
            jsonb_build_object('destino_final', p_destino_final, 'setor_id', p_setor_id, 'setor', v_setor.nome,
                               'descricao', nullif(btrim(p_descricao), ''), 'de', coalesce(v_onde, 'entregue'),
                               'numero', v_numero))
    returning id into v_evento;
  insert into public.plt_eventos
      (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id, setor_destino_id, observacao, dados)
    values (v_peca.id, 'movimentacao_setor', v_usuario, 'interface',
            (select c.setor_atual_id from public.plt_cards c where c.id = v_peca.id),
            (select c.etapa_atual_id from public.plt_cards c where c.id = v_peca.id),
            p_setor_id, 'Ajuste de peça: voltou para ' || v_setor.nome || '.',
            jsonb_build_object('ajuste_evento_id', v_evento));

  perform set_config('plt.devolucao_maquinaria', coalesce(v_marca_d, ''), true);
  perform set_config('plt.entrega_maquinaria', coalesce(v_marca_e, ''), true);
  return v_evento;
end;
$$;

create or replace function public.plt_fn_devolucao_decidir(
  p_pecas      bigint[],
  p_decisao    text,
  p_destino    jsonb default '{}'::jsonb,
  p_observacao text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario   uuid;
  v_dev       bigint;
  v_estoque   bigint;
  v_aguardo   bigint;
  v_peca      public.plt_cards%rowtype;
  v_pc        public.plt_cards%rowtype;
  v_numero    integer;
  v_feitas    integer := 0;
  v_repetidas integer := 0;
  v_relancados bigint[] := '{}';
  v_reabertos bigint[] := '{}';
  v_pedidos   bigint[] := '{}';
  v_marca_d   text;
  v_marca_e   text;
  v_extra     jsonb;
  v_etapa     bigint;
  v_id        bigint;
  v_pid       bigint;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Decidir a devolução é gesto da logística ou de admin.' using errcode = 'insufficient_privilege';
  end if;
  if p_decisao not in ('reenviar', 'estoque', 'realocar', 'danificados', 'loja', 'ajuste') then
    raise exception 'Decisão desconhecida.' using errcode = 'check_violation';
  end if;
  if p_pecas is null or array_length(p_pecas, 1) is null or array_length(p_pecas, 1) > 50 then
    raise exception 'Escolha de 1 a 50 peças.' using errcode = 'check_violation';
  end if;
  if p_decisao = 'realocar' and array_length(p_pecas, 1) <> 1 then
    raise exception 'Realocar é uma peça por vez (cada uma vai para uma vaga).' using errcode = 'check_violation';
  end if;
  select s.id into v_dev from public.plt_setores s where s.codigo = 'devolucao';
  select s.id into v_estoque from public.plt_setores s where s.codigo = 'estoque';
  select s.id into v_aguardo from public.plt_setores s where s.codigo = 'aguardo';

  v_marca_d := current_setting('plt.devolucao_maquinaria', true);
  v_marca_e := current_setting('plt.entrega_maquinaria', true);
  perform set_config('plt.devolucao_maquinaria', 'on', true);

  foreach v_id in array p_pecas loop
    select * into v_peca from public.plt_cards where id = v_id and tipo = 'unidade' for update;
    if not found then
      raise exception 'Peça % não existe.', v_id using errcode = 'no_data_found';
    end if;
    if v_peca.arquivado_em is not null or v_peca.setor_atual_id is distinct from v_dev
       or exists (select 1 from public.plt_etapas e where e.id = v_peca.etapa_atual_id and e.eh_danificado) then
      -- Lei §10: o mesmo toque repetido (a mesma decisão, da mesma pessoa, há pouco) = um efeito só.
      if exists (select 1 from public.plt_eventos d
                  where d.card_id = v_id and d.tipo = 'devolucao_decidida' and d.usuario_id = v_usuario
                    and d.dados ->> 'decisao' = p_decisao and d.ocorrido_em > now() - interval '10 minutes') then
        v_repetidas := v_repetidas + 1;
        continue;
      end if;
      raise exception 'A peça % não está mais em decisão pós devolução (alguém pode ter decidido antes).', v_id
        using errcode = 'check_violation';
    end if;
    select * into v_pc from public.plt_cards where pedido_id = v_peca.pedido_id and tipo = 'pedido';
    select p.numero into v_numero from public.pedidos p where p.id = v_peca.pedido_id;
    v_extra := '{}'::jsonb;

    if p_decisao = 'reenviar' then
      if plt_privado.fn_pedido_cancelado(v_peca.pedido_id) then
        raise exception 'O pedido % foi cancelado no Tiny — escolha outro destino para a peça.', v_numero
          using errcode = 'check_violation';
      end if;
      if coalesce(v_peca.qualidade_atual, 'perfeito') <> 'perfeito' then
        raise exception 'Peça marcada com defeito não volta para o cliente — escolha Danificados ou Ajuste.'
          using errcode = 'check_violation';
      end if;
      if v_pc.entrega_evento_id is not null and not (v_pc.id = any (v_reabertos)) then
        perform set_config('plt.entrega_maquinaria', 'on', true);
        perform plt_privado.fn_reabrir_para_reentrega(v_pc.id, v_usuario, 'peça devolvida reenviada ao cliente');
        v_reabertos := array_append(v_reabertos, v_pc.id);
      end if;
      insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id, setor_destino_id, observacao, dados)
        values (v_id, 'movimentacao_setor', v_usuario, 'interface', v_dev, v_peca.etapa_atual_id, v_aguardo,
                'Reenviar ao cliente: a peça voltou para a Expedição.', jsonb_build_object('motivo', 'reenvio'));

    elsif p_decisao in ('estoque', 'realocar') then
      if coalesce(v_peca.qualidade_atual, 'perfeito') <> 'perfeito' then
        raise exception 'Peça marcada com defeito não entra no ESTOQUE — escolha Danificados ou Ajuste.'
          using errcode = 'check_violation';
      end if;
      insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
        values (v_id, 'unidade_desvinculada', v_usuario, 'interface',
                'Devolvida: a peça ficou sem dono — vai para o ESTOQUE.',
                jsonb_build_object('motivo', 'devolucao', 'pedido_id', v_peca.pedido_id, 'numero', v_numero,
                                   'card_pedido_id', v_pc.id,
                                   'produto_tiny_id', plt_privado.fn_produto_do_item(v_peca.item_codigo, v_peca.item_descricao)));
      insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id, setor_destino_id, observacao, dados)
        values (v_id, 'movimentacao_setor', v_usuario, 'interface', v_dev, v_peca.etapa_atual_id, v_estoque,
                'Devolvida: a peça foi para o ESTOQUE, livre.', jsonb_build_object('motivo', 'devolucao'));
      if p_decisao = 'realocar' then
        v_pid := public.plt_fn_alocar_peca((p_destino ->> 'card_pedido_id')::bigint,
                                           (p_destino ->> 'item_seq')::int,
                                           (p_destino ->> 'indice_unidade')::int, v_id);
        v_extra := jsonb_build_object('card_pedido_destino_id', (p_destino ->> 'card_pedido_id')::bigint,
                                      'nova_unidade_id', v_pid,
                                      'numero_destino', (select p.numero from public.plt_cards pc2 join public.pedidos p on p.id = pc2.pedido_id
                                                          where pc2.id = (p_destino ->> 'card_pedido_id')::bigint));
      end if;

    elsif p_decisao = 'danificados' then
      v_etapa := plt_privado.fn_garantir_etapa_danificado(v_dev);
      insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id, setor_destino_id, etapa_destino_id, observacao, dados)
        values (v_id, 'movimentacao_etapa', v_usuario, 'interface', v_dev, v_peca.etapa_atual_id, v_dev, v_etapa,
                'Devolvida danificada — segue pelos Danificados.', jsonb_build_object('motivo', 'devolucao'));

    elsif p_decisao = 'loja' then
      perform set_config('plt.entrega_maquinaria', 'on', true);
      insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
        values (v_id, 'card_arquivado', v_usuario, 'interface',
                'Liberada para o estoque da loja — saiu das contas da fábrica.',
                jsonb_build_object('motivo', 'loja', 'devolucao_evento_id', v_pc.devolucao_evento_id, 'numero', v_numero));

    else -- ajuste
      perform public.plt_fn_ajuste_abrir(v_id, (p_destino ->> 'setor_id')::bigint,
                                         p_destino ->> 'destino_final', p_destino ->> 'descricao');
      v_extra := jsonb_build_object('setor_id', (p_destino ->> 'setor_id')::bigint,
                                    'destino_final', p_destino ->> 'destino_final');
    end if;

    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
      values (v_id, 'devolucao_decidida', v_usuario, 'interface',
              coalesce(nullif(btrim(p_observacao), ''), null),
              jsonb_build_object('decisao', p_decisao, 'devolucao_evento_id', v_pc.devolucao_evento_id,
                                 'card_pedido_id', v_pc.id, 'numero', v_numero) || v_extra);
    v_feitas := v_feitas + 1;
    if not (v_pc.id = any (v_pedidos)) then
      v_pedidos := array_append(v_pedidos, v_pc.id);
    end if;
  end loop;

  perform set_config('plt.devolucao_maquinaria', coalesce(v_marca_d, ''), true);
  perform set_config('plt.entrega_maquinaria', coalesce(v_marca_e, ''), true);

  -- Reenviar: o que falta entregar todo pronto → o pedido volta à ROTAS → Programar.
  if p_decisao = 'reenviar' then
    foreach v_id in array v_pedidos loop
      if plt_privado.fn_relancar_se_completo(v_id) then
        v_relancados := array_append(v_relancados, v_id);
      end if;
    end loop;
  end if;

  return jsonb_build_object('decididas', v_feitas, 'repetidas', v_repetidas,
                            'relancados', to_jsonb(v_relancados), 'reabertos', to_jsonb(v_reabertos));
end;
$$;

-- ----------------------------------------------------------------------------
-- 3 · Área Pedidos: o programado é "Em rota" (com dia, caminhão e rota)
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_pedidos_lista(text, integer, integer, boolean);
CREATE OR REPLACE FUNCTION public.plt_fn_pedidos_lista(p_busca text DEFAULT NULL::text, p_antes_numero integer DEFAULT NULL::integer, p_limite integer DEFAULT 20, p_cancelados boolean DEFAULT false)
 RETURNS TABLE(pedido_id bigint, numero integer, cliente_nome text, data_pedido date, data_prevista date, situacao text, total_pedido numeric, vendedor text, marcadores text[], total_unidades integer, unidades_liberadas integer, unidades_prontas integer, card_id bigint, situacao_plataforma text, entregue_em timestamp with time zone, entregue_por text, entregue_fonte text, entregue_tiny text, cancelado_em timestamp with time zone, tem_mais boolean, contagem_total integer, programacao_data date, caminhao_nome text, rota integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
#variable_conflict use_column
declare
  v_lim   integer := least(greatest(coalesce(p_limite, 20), 1), 100);
  v_busca text    := nullif(btrim(coalesce(p_busca, '')), '');
  v_canc  boolean := coalesce(p_cancelados, false);
  -- só dígitos, sem zero na frente: o "número que começa com" vira faixas
  v_num   bigint  := case when nullif(btrim(coalesce(p_busca, '')), '') ~ '^[1-9][0-9]{0,8}$'
                          then btrim(p_busca)::bigint end;
  v_ids   bigint[];
  v_total integer;
  v_teto  bigint;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    return;  -- como antes: sem acesso, lista vazia
  end if;

  -- 1 · a página (limite + 1, para saber se tem mais), por um caminho por caso
  if v_busca is null and not v_canc then
    select coalesce(array_agg(x.id order by x.numero desc), '{}') into v_ids from (
      select p.id, p.numero from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p
       where (p_antes_numero is null or p.numero < p_antes_numero)
       order by p.numero desc limit v_lim + 1) x;
  elsif v_busca is null then
    select coalesce(array_agg(x.id order by x.numero desc), '{}') into v_ids from (
      select p.id, p.numero from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p
       where plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado'
         and (p_antes_numero is null or p.numero < p_antes_numero)
       order by p.numero desc limit v_lim + 1) x;
  else
    -- 1ª tentativa: só os 5.000 números mais recentes, do jeito de sempre (o
    -- filtro com OU, parando na página cheia) — termo COMUM acha a página aí e
    -- para cedo. Achou a página inteira (limite + 1) → é exatamente a de antes:
    -- qualquer outro pedido que case tem número menor que todos da janela.
    v_teto := coalesce(p_antes_numero, (select max(pm.numero) from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) pm) + 1);
    select coalesce(array_agg(x.id order by x.numero desc), '{}') into v_ids from (
      select p.id, p.numero
        from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p
        left join public.clientes c on c.id = p.cliente_id
       where p.numero >= v_teto - 5000
         and p.numero < v_teto
         and (p.numero::text like v_busca || '%'
              or c.nome ilike '%' || v_busca || '%'
              or p.vendedor ilike '%' || v_busca || '%')
         and (not v_canc or plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado')
       order by p.numero desc limit v_lim + 1) x;
  end if;
  -- termo RARO (a janela não encheu a página): os caminhos que os índices usam
  if v_busca is not null and cardinality(v_ids) <= v_lim then
    select coalesce(array_agg(x.id order by x.numero desc), '{}') into v_ids from (
      select p.id, p.numero
        from (-- o número que começa com o texto: só dígitos (sem zero na frente) viram
              -- faixas [x·10^k, (x+1)·10^k) — o índice do número anda em cada uma
              select p1.id
                from generate_series(0, greatest(0, 10 - length(v_busca))) as k(e)
                join (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p1
                  on p1.numero >= v_num * (10::bigint ^ k.e)::bigint
                 and p1.numero <  (v_num + 1) * (10::bigint ^ k.e)::bigint
               where v_num is not null
              union
              select p2.id from public.clientes c2 join (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p2 on p2.cliente_id = c2.id
               where c2.nome ilike '%' || v_busca || '%'
              union
              select p3.id from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p3 where p3.vendedor ilike '%' || v_busca || '%') alvo
        join (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p on p.id = alvo.id
       where (not v_canc or plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado')
         and (p_antes_numero is null or p.numero < p_antes_numero)
       order by p.numero desc limit v_lim + 1) x;
  end if;

  -- 2 · o total, só na 1ª página (até 10.001), pelo mesmo caminho
  if p_antes_numero is null then
    if v_busca is null and not v_canc then
      select count(*)::int into v_total from (select 1 from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p limit 10001) x;
    elsif v_busca is null then
      select count(*)::int into v_total from (
        select 1 from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p
         where plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado' limit 10001) x;
    else
      select count(*)::int into v_total from (
        select 1
          from (select p1.id
                  from generate_series(0, greatest(0, 10 - length(v_busca))) as k(e)
                  join (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p1
                    on p1.numero >= v_num * (10::bigint ^ k.e)::bigint
                   and p1.numero <  (v_num + 1) * (10::bigint ^ k.e)::bigint
                 where v_num is not null
                union
                select p2.id from public.clientes c2 join (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p2 on p2.cliente_id = c2.id
                 where c2.nome ilike '%' || v_busca || '%'
                union
                select p3.id from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p3 where p3.vendedor ilike '%' || v_busca || '%') alvo
          join (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p on p.id = alvo.id
         where (not v_canc or plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado')
         limit 10001) x;
    end if;
  end if;

  -- 3 · o que cada linha mostra — a projeção de sempre, sobre a página achada
  return query
  with pagina as (
    select p.id, p.numero, p.cliente_id, p.data_pedido, p.data_prevista, p.situacao,
           p.total_pedido, p.vendedor, p.marcadores, nullif(p.raw ->> 'data_entrega', '') as entregue_tiny,
           c.nome as cliente_nome
      from unnest(v_ids) with ordinality as u(id, ord)
      join (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p on p.id = u.id
      left join public.clientes c on c.id = p.cliente_id
     order by u.ord
  ),
  numerada as (
    select pg.*, row_number() over (order by pg.numero desc) as n from pagina pg
  )
  select nu.id                                   as pedido_id,
         nu.numero,
         coalesce(nu.cliente_nome, '')           as cliente_nome,
         nu.data_pedido,
         nu.data_prevista,
         nu.situacao,
         nu.total_pedido,
         nullif(btrim(coalesce(nu.vendedor, '')), '') as vendedor,
         coalesce(nu.marcadores, '{}')           as marcadores,
         coalesce(i.total_unidades, 0)           as total_unidades,
         coalesce(u.liberadas, 0)                as unidades_liberadas,
         coalesce(u.prontas, 0)                  as unidades_prontas,
         pc.id                                   as card_id,
         case
           when plt_privado.fn_situacao_normalizada(nu.situacao) = 'cancelado' then 'cancelado'
           when pc.id is null then 'sem_card'
           when pc.devolucao_evento_id is not null then 'devolvido'
           when pc.entrega_evento_id is not null then 'entregue'
           when pc.arquivado_em is not null then 'arquivado'
           -- SESSAO-38 (↪️ D-156): o PROGRAMADO também está "Em rota" (lançado ou não)
           when pc.lancado_rotas_em is not null or pr.card_id is not null then 'em_rota'
           when coalesce(i.total_unidades, 0) > 0 and coalesce(u.prontas, 0) >= i.total_unidades then 'aguardo'
           when coalesce(u.liberadas, 0) > 0 then 'producao'
           -- D-132: o Tiny já levou adiante e nada foi liberado — segue o Tiny.
           when plt_privado.fn_tiny_tirou_do_pcp(nu.situacao) then 'tiny'
           else 'pcp'
         end                                     as situacao_plataforma,
         ent.ocorrido_em                         as entregue_em,
         ue.nome                                 as entregue_por,
         case when ent.id is null then null
              else coalesce(ent.dados ->> 'fonte', case when ent.usuario_id is null then 'tiny' else 'plataforma' end)
         end                                     as entregue_fonte,
         nu.entregue_tiny,
         canc.ocorrido_em                        as cancelado_em,
         (select count(*) from pagina) > v_lim       as tem_mais,
         v_total                                 as contagem_total,
         pr.data_entrega                         as programacao_data,
         cam.nome                                as caminhao_nome,
         pr.rota::int                            as rota
    from numerada nu
    left join public.plt_cards pc on pc.pedido_id = nu.id and pc.tipo = 'pedido'
    left join public.plt_programacoes pr on pr.card_id = pc.id
    left join public.plt_caminhoes cam on cam.id = pr.caminhao_id
    left join public.plt_eventos ent on ent.id = pc.entrega_evento_id
    left join public.plt_usuarios ue on ue.id = ent.usuario_id
    left join lateral (
      select min(e.ocorrido_em) as ocorrido_em
        from public.plt_eventos e
       where pc.id is not null and e.card_id = pc.id and e.tipo = 'pedido_cancelado'
    ) canc on true
    left join lateral (
      -- D-63: o frete não conta como unidade.
      select coalesce(sum(v.unidades), 0)::int as total_unidades
        from plt_privado.vw_itens_producao v
       where v.pedido_id = nu.id
    ) i on true
    left join lateral (
      select count(*)::int as liberadas,
             count(*) filter (where cu.concluido_em is not null)::int as prontas
        from public.plt_cards cu
       where cu.tipo = 'unidade'
         and (cu.pedido_id = nu.id or (pc.id is not null and cu.card_pai_id = pc.id))
    ) u on true
   where nu.n <= v_lim
   order by nu.numero desc;
end;
$function$;

comment on function public.plt_fn_pedidos_lista(text, integer, integer, boolean) is
  'SESSAO-30/32/38: a lista da área Pedidos por cursor (número). SESSAO-38: o pedido PROGRAMADO é em_rota, com programacao_data/caminhao_nome/rota.';
revoke all on function public.plt_fn_pedidos_lista(text, integer, integer, boolean) from public, anon;
grant execute on function public.plt_fn_pedidos_lista(text, integer, integer, boolean) to authenticated;

