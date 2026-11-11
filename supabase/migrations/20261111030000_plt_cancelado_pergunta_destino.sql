-- ============================================================================
-- SESSAO-48 · FRENTE 3 — pedido cancelado no Tiny PERGUNTA o destino de cada
-- móvel que estava em produção (↩️ revisa a D-61: a peça de pedido em produção
-- não segue mais sozinha para o estoque)
-- ============================================================================
-- O pedido do dono (11/11): "Quando for um PEDIDO, pergunta para onde vai mover
-- aquele móvel que seria do pedido que foi cancelado."
--
-- A regra:
--   · chega do Tiny o cancelamento: a peça PRONTA (Expedição / ESTOQUE / ROTAS)
--     segue indo sozinha ao ESTOQUE sem dono, como sempre; cada peça num setor de
--     PRODUÇÃO (não concluída, não cancelada, não arquivada) ganha o fato
--     destino_pendente ("esperando decisão" — sai do "reservados p/ produção" pela
--     regra única da base) e a logística recebe UM aviso por pedido;
--   · a janela "Para onde vai este móvel?" (uma leitura ao abrir) decide peça por
--     peça ou todas de uma vez: seguir para o estoque (perde o pedido e continua a
--     produção onde está — pronta, entra no ESTOQUE sem dono), passar para outro
--     pedido (a maquinaria da D-201: peca_vinculada) ou cancelar a fabricação (o
--     gesto da frente 1: a peça vai para a coluna que cancela);
--   · ninguém decidiu e a peça chegou ao fim da linha: vale a regra de antes (o
--     ESTOQUE sem dono) e a pendência fecha com um fato que diz isso;
--   · o Tiny "descancelou" antes da decisão: a marca sai (a peça nunca perdeu o pedido);
--   · o PCP usou a peça pendente noutro pedido (a sugestão da D-201): a pendência fecha.
--
-- A função do cancelamento (fn_desvincular_por_cancelamento) é recriada por
-- EXTRAÇÃO da última versão das migrations, com trocas conferidas (E-24/A-97); o
-- resto é novo. Nenhuma tabela nem coluna nova (a base trouxe tudo); um gatilho
-- novo em tabela da integração (public.pedidos — só gatilho, à prova de falha:
-- a gravação do Tiny nunca cai por ele).
-- ============================================================================
set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · O cancelamento do Tiny (o gatilho plt_eventos_zz_desvincular_cancelados,
--     que não muda): a peça PRONTA segue sozinha ao ESTOQUE (como sempre); a peça
--     em PRODUÇÃO espera a decisão da logística (destino_pendente + UM aviso por
--     pedido); e a peça pendente que chega ao ESTOQUE (ninguém decidiu, ficou
--     pronta) fecha a pendência com destino_decidido {estoque, automático}.
-- ----------------------------------------------------------------------------
-- (recriada da vigente em 20261014130000_plt_devolucao_decidida.sql)
create or replace function plt_privado.fn_desvincular_por_cancelamento()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pedido_id bigint;
  v_numero    integer;
  v_aguardo   bigint;
  v_estoque   bigint;
  v_rotas     bigint;
  v_devolvido boolean;
  v_frase     text;
  v_codigo    text;
  v_descricao text;
  r           record;
  v_pendente  timestamptz;   -- SESSAO-48 (frente 3)
  v_m         text;
  v_n         integer := 0;
begin
  -- SESSAO-31 (D-124/D-129): só o cancelamento no Tiny tira a peça do pedido —
  -- o devolvido espera a decisão da logística (Em decisão pós devolução).
  if new.tipo = 'pedido_cancelado' then
    v_devolvido := false;
    select c.pedido_id into v_pedido_id
      from public.plt_cards c where c.id = new.card_id and c.tipo = 'pedido';
    if v_pedido_id is null then
      return null;
    end if;
    select p.numero into v_numero from public.pedidos p where p.id = v_pedido_id;
    select s.id into v_aguardo from public.plt_setores s where s.codigo = 'aguardo';
    select s.id into v_estoque from public.plt_setores s where s.codigo = 'estoque';
    -- SESSAO-30 (D-114): a peça na ROTAS (programada ou no caminhão) também volta.
    select s.id into v_rotas from public.plt_setores s where s.codigo = 'rotas';
    v_frase := case when v_devolvido then 'devolvido' else 'cancelado no Tiny' end;

    for r in
      select u.id, u.setor_atual_id, u.etapa_atual_id, u.item_codigo, u.item_descricao
        from public.plt_cards u
       where u.pedido_id = v_pedido_id
         and u.tipo = 'unidade'
         and u.arquivado_em is null
         and u.setor_atual_id in (v_aguardo, v_estoque, v_rotas)
       order by u.id
    loop
      insert into public.plt_eventos (card_id, tipo, origem, evento_referencia_id, observacao, dados)
        values (r.id, 'unidade_desvinculada', 'automacao', new.id,
                'Pedido ' || coalesce(v_numero::text, '') || ' ' || v_frase || ' — a peça ficou sem dono.',
                jsonb_build_object(
                  'motivo',          case when v_devolvido then 'pedido_devolvido' else 'pedido_cancelado' end,
                  'pedido_id',       v_pedido_id,
                  'numero',          v_numero,
                  'card_pedido_id',  new.card_id,
                  'produto_tiny_id', plt_privado.fn_produto_do_item(r.item_codigo, r.item_descricao)));
      if r.setor_atual_id in (v_aguardo, v_rotas) and v_estoque is not null then
        -- Sem evento_referencia_id de propósito: nas movimentações ele é a
        -- marcação de qualidade da transição (D-09) — aqui não há marcação.
        insert into public.plt_eventos
            (card_id, tipo, origem, setor_origem_id, etapa_origem_id, setor_destino_id,
             observacao, dados)
          values
            (r.id, 'movimentacao_setor', 'automacao', r.setor_atual_id, r.etapa_atual_id, v_estoque,
             'Pedido ' || v_frase || ' — a peça pronta voltou ao ESTOQUE, sem dono.',
             jsonb_build_object('motivo', case when v_devolvido then 'pedido_devolvido' else 'pedido_cancelado' end,
                                'numero', v_numero,
                                'cancelamento_evento_id', new.id));
      end if;
    end loop;

    -- ↩️ SESSAO-48 (frente 3 — revisa a D-61): a peça ainda em PRODUÇÃO não segue
    -- mais sozinha para o estoque — espera a logística decidir (o fato
    -- destino_pendente; sai do "reservados p/ produção" pela regra única) na janela
    -- "Para onde vai este móvel?". UM aviso por pedido. Blindado: se der errado, o
    -- cancelamento vale do mesmo jeito (a peça cai na regra de antes — o ESTOQUE
    -- quando ficar pronta) e o erro vira aviso de automação.
    begin
      v_m := coalesce(current_setting('plt.destino_maquinaria', true), '');
      perform set_config('plt.destino_maquinaria', 'on', true);
      for r in
        select u.id, u.setor_atual_id, u.etapa_atual_id, s.nome as setor, e.nome as etapa
          from public.plt_cards u
          join public.plt_setores s on s.id = u.setor_atual_id and s.papel_no_fluxo = 'producao'
          left join public.plt_etapas e on e.id = u.etapa_atual_id
         where u.pedido_id = v_pedido_id
           and u.tipo = 'unidade'
           and u.arquivado_em is null
           and u.concluido_em is null
           and u.cancelada_em is null
           and u.destino_pendente_em is null
           -- o ajuste de peça já tem o destino final escolhido pelo PCP (D-130)
           and u.ajuste_destino is null
         order by u.id
           for update of u
      loop
        insert into public.plt_eventos (card_id, tipo, origem, evento_referencia_id, setor_origem_id, etapa_origem_id,
                                        observacao, dados)
          values (r.id, 'destino_pendente', 'automacao', new.id, r.setor_atual_id, r.etapa_atual_id,
                  'Pedido ' || coalesce(v_numero::text, '') || ' cancelado no Tiny — o móvel espera a logística decidir para onde vai.',
                  jsonb_build_object('pedido_id', v_pedido_id, 'numero', v_numero, 'card_pedido_id', new.card_id,
                                     'setor', r.setor, 'etapa', r.etapa));
        v_n := v_n + 1;
      end loop;
      perform set_config('plt.destino_maquinaria', v_m, true);
      if v_n > 0 then
        perform plt_privado.fn_avisar_publico(
          'pedido_cancelado_decidir', 'logistica', new.id, new.card_id,
          format('Pedido %s cancelado com móveis em produção', v_numero),
          format('O pedido %s foi cancelado no Tiny. %s — decida para onde %s.',
                 v_numero,
                 case when v_n = 1 then '1 móvel dele está em produção'
                      else v_n || ' móveis dele estão em produção' end,
                 case when v_n = 1 then 'vai' else 'vão' end));
      end if;
    exception when others then
      begin
        perform plt_privado.fn_alertar_erro(
          'automacao_erro', 'destino_pendente:' || v_pedido_id,
          format('Não deu para pôr em decisão os móveis do pedido %s cancelado', v_numero),
          format('O pedido %s foi cancelado no Tiny, mas a plataforma não conseguiu marcar os móveis em produção como "esperando decisão" — eles seguem a regra de antes (o ESTOQUE quando ficarem prontos): %s',
                 v_numero, sqlerrm),
          jsonb_build_object('pedido', v_numero, 'pedido_id', v_pedido_id, 'erro', sqlerrm),
          interval '1 hour', new.card_id);
      exception when others then
        raise warning 'plt_destino_pendente: % — o cancelamento segue valendo', sqlerrm;
      end;
    end;
    -- Sai da programação do caminhão (a remoção vai à trilha pelo gatilho dela).
    delete from public.plt_programacoes where card_id = new.card_id;
    return null;
  end if;

  if new.tipo = 'movimentacao_setor' then
    if not exists (select 1 from public.plt_setores s
                    where s.id = new.setor_destino_id and s.codigo = 'estoque') then
      return null;
    end if;
    select c.pedido_id, c.item_codigo, c.item_descricao, c.destino_pendente_em
      into v_pedido_id, v_codigo, v_descricao, v_pendente
      from public.plt_cards c where c.id = new.card_id and c.tipo = 'unidade';
    if v_pedido_id is null or not plt_privado.fn_pedido_cancelado(v_pedido_id) then
      return null;
    end if;
    select p.numero into v_numero from public.pedidos p where p.id = v_pedido_id;
    -- ↩️ SESSAO-48 (frente 3): ninguém decidiu e o móvel ficou pronto — vale a regra
    -- de antes (o ESTOQUE sem dono; o chão de fábrica não para) e a pendência fecha
    -- com um fato que diz isso.
    if v_pendente is not null then
      v_m := coalesce(current_setting('plt.destino_maquinaria', true), '');
      perform set_config('plt.destino_maquinaria', 'on', true);
      insert into public.plt_eventos (card_id, tipo, origem, evento_referencia_id, observacao, dados)
        values (new.card_id, 'destino_decidido', 'automacao', new.id,
                'Ninguém decidiu o destino e o móvel ficou pronto — entrou no ESTOQUE sem dono, pela regra de antes.',
                jsonb_build_object('destino', 'estoque', 'automatico', true, 'motivo', 'fim_da_linha',
                                   'pedido_id', v_pedido_id, 'numero', v_numero,
                                   'card_pedido_id', (select pc.id from public.plt_cards pc
                                                       where pc.pedido_id = v_pedido_id and pc.tipo = 'pedido')));
      perform set_config('plt.destino_maquinaria', v_m, true);
    end if;
    insert into public.plt_eventos (card_id, tipo, origem, evento_referencia_id, observacao, dados)
      values (new.card_id, 'unidade_desvinculada', 'automacao', new.id,
              'Pedido ' || coalesce(v_numero::text, '') || ' cancelado no Tiny — a peça ficou pronta e entrou no ESTOQUE sem dono.',
              jsonb_build_object(
                'motivo',          'pedido_cancelado',
                'pedido_id',       v_pedido_id,
                'numero',          v_numero,
                'card_pedido_id',  (select pc.id from public.plt_cards pc
                                     where pc.pedido_id = v_pedido_id and pc.tipo = 'pedido'),
                'produto_tiny_id', plt_privado.fn_produto_do_item(v_codigo, v_descricao)));
  end if;
  return null;
end;
$$;

comment on function plt_privado.fn_desvincular_por_cancelamento() is
  'O cancelamento do Tiny (pedido_cancelado): a peça pronta (Expedição, ESTOQUE, ROTAS) perde o pedido e vai ao ESTOQUE sem dono; ↩️ SESSAO-48 (frente 3): a peça em PRODUÇÃO espera a decisão da logística (destino_pendente + um aviso por pedido). A chegada ao ESTOQUE (movimentacao_setor) da peça de pedido cancelado a desvincula — e, se ninguém decidiu, fecha a pendência (destino_decidido estoque, automático).';
revoke all on function plt_privado.fn_desvincular_por_cancelamento() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2 · O Tiny "descancelou" o pedido antes da decisão: a marca sai — a peça nunca
--     perdeu o pedido (provisória da demanda). Gatilho PEQUENO e próprio em
--     public.pedidos (a reação grande ao pedido não é tocada — o molde é o
--     plt_pedidos_volta_pcp da SESSAO-47). À prova de falha: a gravação do Tiny
--     nunca cai por ele; o erro vira aviso de automação para os administradores.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_destino_descancelado()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r   record;
  v_m text;
begin
  if plt_privado.fn_situacao_normalizada(old.situacao) <> 'cancelado'
     or plt_privado.fn_situacao_normalizada(new.situacao) = 'cancelado' then
    return null;
  end if;
  begin
    v_m := coalesce(current_setting('plt.destino_maquinaria', true), '');
    perform set_config('plt.destino_maquinaria', 'on', true);
    -- a trava confere de novo a marca: a logística pode ter decidido no mesmo instante
    for r in
      select u.id, u.setor_atual_id, u.etapa_atual_id
        from public.plt_cards u
       where u.pedido_id = new.id and u.tipo = 'unidade' and u.destino_pendente_em is not null
       order by u.id
         for update
    loop
      insert into public.plt_eventos (card_id, tipo, origem, setor_origem_id, etapa_origem_id, observacao, dados)
        values (r.id, 'destino_decidido', 'automacao', r.setor_atual_id, r.etapa_atual_id,
                format('O pedido %s voltou a valer no Tiny ("%s") — o móvel segue com ele.', new.numero, new.situacao),
                jsonb_build_object('destino', 'descancelado', 'automatico', true, 'pedido_id', new.id,
                                   'numero', new.numero, 'situacao', new.situacao));
    end loop;
    perform set_config('plt.destino_maquinaria', v_m, true);
  exception when others then
    begin
      perform plt_privado.fn_alertar_erro(
        'automacao_erro', 'destino_descancelado:' || new.id,
        format('Não deu para devolver ao pedido %s os móveis que esperavam decisão', new.numero),
        format('O pedido %s voltou a valer no Tiny ("%s"), mas a plataforma não conseguiu tirar a marca de "esperando decisão" dos móveis: %s',
               new.numero, new.situacao, sqlerrm),
        jsonb_build_object('pedido', new.numero, 'pedido_id', new.id, 'erro', sqlerrm),
        interval '1 hour', null);
    exception when others then
      raise warning 'plt_destino_descancelado: % — a integração segue intacta', sqlerrm;
    end;
  end;
  return null;
end;
$$;

comment on function plt_privado.fn_destino_descancelado() is
  'SESSAO-48 (frente 3): o Tiny tirou o pedido de "Cancelado" antes da decisão da logística — cada peça esperando decisão ganha destino_decidido {destino: descancelado} (a marca sai; ela nunca perdeu o pedido). À prova de falha: o erro vira aviso de automação.';
revoke all on function plt_privado.fn_destino_descancelado() from public, anon, authenticated;

drop trigger if exists plt_pedidos_destino_descancelado on public.pedidos;
create trigger plt_pedidos_destino_descancelado
  after update of situacao on public.pedidos
  for each row when (old.situacao is distinct from new.situacao)
  execute function plt_privado.fn_destino_descancelado();

comment on trigger plt_pedidos_destino_descancelado on public.pedidos is
  'SESSAO-48 (frente 3): o Tiny "descancelou" o pedido — as peças esperando a decisão do destino voltam a ser só do pedido (a marca sai). À prova de falha.';

-- ----------------------------------------------------------------------------
-- 3 · A peça pendente passou a ser de outro pedido (a maquinaria da D-201 — o PCP
--     pela janela "Liberar unidades", ou a logística pela janela do destino): a
--     pendência fecha com destino_decidido = outro_pedido. Gatilho pequeno depois
--     do fato peca_vinculada; quem ligou vem da marca plt.destino_via (a janela
--     da logística liga 'logistica'; sem ela, foi o PCP).
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_destino_peca_vinculada()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pend timestamptz;
  v_via  text;
  v_m    text;
begin
  select c.destino_pendente_em into v_pend from public.plt_cards c where c.id = new.card_id;
  if v_pend is null then
    return null;
  end if;
  v_via := coalesce(nullif(current_setting('plt.destino_via', true), ''), 'pcp');
  v_m := coalesce(current_setting('plt.destino_maquinaria', true), '');
  perform set_config('plt.destino_maquinaria', 'on', true);
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, evento_referencia_id, setor_origem_id, etapa_origem_id,
                                  observacao, dados)
    values (new.card_id, 'destino_decidido', new.usuario_id, new.origem, new.id, new.setor_origem_id, new.etapa_origem_id,
            format('Passou para o pedido %s %s — o pedido %s foi cancelado no Tiny.',
                   coalesce(new.dados ->> 'numero', ''),
                   case v_via when 'pcp' then 'pelo PCP' else 'pela logística' end,
                   coalesce(new.dados ->> 'numero_anterior', '')),
            jsonb_build_object(
              'destino',           'outro_pedido',
              'via',               v_via,
              -- o pedido cancelado (o de origem — igual em todo destino_decidido)
              'pedido_id',         nullif(new.dados ->> 'pedido_anterior_id', '')::bigint,
              'numero',            nullif(new.dados ->> 'numero_anterior', '')::int,
              -- o pedido que ganhou a peça
              'pedido_destino_id', nullif(new.dados ->> 'pedido_id', '')::bigint,
              'numero_destino',    nullif(new.dados ->> 'numero', '')::int,
              'item_seq',          nullif(new.dados ->> 'item_seq', '')::int,
              'indice_unidade',    nullif(new.dados ->> 'indice_unidade', '')::int,
              'total_unidades',    nullif(new.dados ->> 'total_unidades', '')::int));
  perform set_config('plt.destino_maquinaria', v_m, true);
  return null;
end;
$$;

comment on function plt_privado.fn_destino_peca_vinculada() is
  'SESSAO-48 (frente 3): depois de peca_vinculada numa peça que esperava a decisão do destino — destino_decidido {destino: outro_pedido, via: pcp | logistica}, com o pedido cancelado (pedido_id) e o que ganhou a peça (pedido_destino_id).';
revoke all on function plt_privado.fn_destino_peca_vinculada() from public, anon, authenticated;

drop trigger if exists plt_eventos_zz_destino_vinculada on public.plt_eventos;
create trigger plt_eventos_zz_destino_vinculada
  after insert on public.plt_eventos
  for each row
  when (new.tipo = 'peca_vinculada')
  execute function plt_privado.fn_destino_peca_vinculada();

-- ----------------------------------------------------------------------------
-- 4 · A janela "Para onde vai este móvel?" — UMA leitura ao abrir (Lei §3): o
--     pedido, as peças esperando decisão (móvel, k/n, setor e etapa, desde quando)
--     e, por móvel, os pedidos VIVOS no PCP que precisam do MESMO móvel com vaga
--     aberta (a régua da D-62 pelo fn_chave_peca; a vaga pelo fn_vagas_pedido; o
--     PCP pela regra única fn_fora_do_pcp) — até 10, o pedido mais antigo
--     primeiro. E o que já foi decidido. Logística e admin (a régua da devolução).
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_destino_pendentes(p_card_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_card  public.plt_cards%rowtype;
  v_p     public.pedidos%rowtype;
  v_pecas jsonb;
  v_cands jsonb;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Decidir para onde vão os móveis de pedido cancelado é da logística ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;
  select * into v_card from public.plt_cards where id = p_card_id;
  -- a peça leva ao pedido dela (o aviso do sino leva ao card do pedido)
  if v_card.tipo = 'unidade' then
    select * into v_card from public.plt_cards where pedido_id = v_card.pedido_id and tipo = 'pedido';
  end if;
  if v_card.id is null or v_card.tipo is distinct from 'pedido' then
    raise exception 'Pedido não encontrado.' using errcode = 'no_data_found';
  end if;
  select * into v_p from public.pedidos where id = v_card.pedido_id;

  with pend as materialized (
    -- as peças esperando decisão (o índice parcial plt_cards_destino_pendente_idx)
    select u.id, u.item_seq, u.indice_unidade, u.total_unidades, u.item_codigo, u.item_descricao,
           u.destino_pendente_em, s.nome as setor, e.nome as etapa, x.nome as executor,
           coalesce(e.eh_danificado, false) or coalesce(u.qualidade_atual, 'perfeito') = 'danificado' as danificada,
           -- a MESMA régua de fn_vincular_peca_producao (D-62)
           plt_privado.fn_chave_peca(coalesce(u.produto_tiny_id,
                                              plt_privado.fn_produto_do_item(u.item_codigo, u.item_descricao)),
                                     u.item_codigo, u.item_descricao) as chave
      from public.plt_cards u
      left join public.plt_setores s on s.id = u.setor_atual_id
      left join public.plt_etapas e on e.id = u.etapa_atual_id
      left join public.plt_usuarios x on x.id = u.executor_atual_id
     where u.pedido_id = v_card.pedido_id and u.tipo = 'unidade'
       and u.destino_pendente_em is not null and u.arquivado_em is null
     order by u.item_seq, u.indice_unidade, u.id
     limit 100
  ),
  -- um móvel por chave (as peças iguais de um pedido dividem a mesma lista); sem
  -- SKU não há candidato — a mesma régua da sugestão do PCP (D-201)
  moveis as (
    select distinct on (p.chave) p.chave, p.item_codigo
      from pend p
     where not p.danificada and p.item_codigo is not null
     order by p.chave, p.id
  ),
  cand as (
    select m.chave, z.*
      from moveis m
      cross join lateral (
        select o.card_id, o.pedido_id, o.numero, o.cliente_id, o.data_prevista, o.data_pedido, o.standby, v.vagas
          from (
            -- os pedidos no PCP (aguardando liberação) que têm o item, do mais antigo
            -- para o mais novo (teto de 200 na procura — Lei §6); o "limit" trava a
            -- ordem antes da conta das vagas, que então para no 10º que serve
            select pc.id as card_id, p2.id as pedido_id, p2.numero, p2.cliente_id, p2.data_prevista,
                   p2.data_pedido, pc.standby_desde is not null as standby
              from public.plt_cards pc
              join public.plt_setores sp on sp.id = pc.setor_atual_id and sp.papel_no_fluxo = 'entrada'
              join public.pedidos p2 on p2.id = pc.pedido_id
             where pc.tipo = 'pedido' and pc.arquivado_em is null and pc.liberado_completo_em is null
               and pc.entrega_evento_id is null
               and pc.pedido_id <> v_card.pedido_id
               and not plt_privado.fn_fora_do_pcp(p2.situacao, pc.volta_pcp_em, pc.removido_pcp_em)
               and exists (select 1 from public.pedido_itens pi
                            where pi.pedido_id = pc.pedido_id and pi.codigo = m.item_codigo)
             order by p2.data_pedido nulls last, p2.numero, pc.id
             limit 200) o
          cross join lateral (
            select count(*)::int as vagas
              from plt_privado.fn_vagas_pedido(o.pedido_id) w
             where w.card_id is null and w.reserva_card_id is null and w.chave = m.chave) v
         where v.vagas > 0
         limit 10) z
  )
  select (select coalesce(jsonb_agg(jsonb_build_object(
                    'id', p.id, 'descricao', p.item_descricao, 'sku', p.item_codigo,
                    'indice', p.indice_unidade, 'total', p.total_unidades,
                    'setor', p.setor, 'etapa', p.etapa, 'desde', p.destino_pendente_em,
                    'executor', p.executor, 'danificada', p.danificada, 'chave', p.chave)
                  order by p.item_seq, p.indice_unidade, p.id), '[]'::jsonb)
            from pend p),
         (select coalesce(jsonb_object_agg(k.chave, k.lista), '{}'::jsonb)
            from (select c.chave,
                         jsonb_agg(jsonb_build_object(
                           'pedido_id', c.pedido_id, 'card_pedido_id', c.card_id, 'numero', c.numero,
                           'cliente_nome', cl.nome,
                           'data_prevista', plt_privado.fn_data_entrega(c.pedido_id, c.data_prevista),
                           'vagas', c.vagas, 'standby', c.standby)
                           order by c.data_pedido nulls last, c.numero, c.card_id) as lista
                    from cand c
                    left join public.clientes cl on cl.id = c.cliente_id
                   group by c.chave) k)
    into v_pecas, v_cands;

  return jsonb_build_object(
    'card_id', v_card.id,
    'pedido_id', v_p.id,
    'numero', v_p.numero,
    'cliente_nome', (select c.nome from public.clientes c where c.id = v_p.cliente_id),
    'situacao_tiny', v_p.situacao,
    'cancelado', plt_privado.fn_situacao_normalizada(v_p.situacao) = 'cancelado',
    'cancelado_em', (select max(e.ocorrido_em) from public.plt_eventos e
                      where e.card_id = v_card.id and e.tipo = 'pedido_cancelado'),
    'pecas', v_pecas,
    'candidatos', v_cands,
    -- o que já foi decidido (as peças que esperaram por este pedido: os fatos
    -- destino_pendente que apontam os cancelamentos dele), o mais novo primeiro
    'decididas', coalesce((
      select jsonb_agg(z.j order by z.id desc)
        from (select d.id, jsonb_build_object(
                       'peca_id', d.card_id, 'descricao', c.item_descricao,
                       'destino', d.dados ->> 'destino', 'via', d.dados ->> 'via',
                       'automatico', coalesce((d.dados ->> 'automatico')::boolean, false),
                       'numero_destino', nullif(d.dados ->> 'numero_destino', '')::int,
                       'quando', d.ocorrido_em, 'quem', u.nome) as j
                from (select distinct e2.card_id
                        from public.plt_eventos e1
                        join public.plt_eventos e2 on e2.evento_referencia_id = e1.id and e2.tipo = 'destino_pendente'
                       where e1.card_id = v_card.id and e1.tipo = 'pedido_cancelado') pp
                join public.plt_eventos d on d.card_id = pp.card_id and d.tipo = 'destino_decidido'
                                         and d.dados ->> 'pedido_id' = v_card.pedido_id::text
                join public.plt_cards c on c.id = d.card_id
                left join public.plt_usuarios u on u.id = d.usuario_id
               order by d.id desc
               limit 50) z), '[]'::jsonb)
  );
end;
$$;

comment on function public.plt_fn_destino_pendentes(bigint) is
  'SESSAO-48 (frente 3): a janela "Para onde vai este móvel?" numa leitura — o pedido cancelado no Tiny, as peças esperando a decisão da logística e, por móvel, até 10 pedidos vivos no PCP com vaga aberta do mesmo móvel (o mais antigo primeiro), e o que já foi decidido. Aceita o card do pedido ou o de uma peça dele. Logística e admin.';
revoke all on function public.plt_fn_destino_pendentes(bigint) from public, anon;
grant execute on function public.plt_fn_destino_pendentes(bigint) to authenticated;

-- ----------------------------------------------------------------------------
-- 5 · A decisão — peça por peça ou todas de uma vez, numa transação:
--     · 'estoque'      → destino_decidido + unidade_desvinculada: a peça perde o
--                        pedido e continua a produção onde está; pronta, o
--                        caminho de sempre a leva ao ESTOQUE sem dono;
--     · 'outro_pedido' → a maquinaria da D-201 (fn_vincular_peca_producao →
--                        peca_vinculada) na 1ª vaga aberta do mesmo móvel no
--                        pedido escolhido; o gatilho da seção 3 fecha a
--                        pendência (via 'logistica');
--     · 'cancelar'     → a peça vai para a coluna que cancela com o motivo
--                        "cancelada" (a do setor dela; senão a da LIMPEZA E
--                        EMBALAGEM), autor = quem decidiu; o gatilho de chegada
--                        da base grava fabricacao_cancelada e fecha a pendência.
--     Idempotente: a peça que já não espera decisão é pulada e relatada.
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_destino_decidir(p_card_id bigint, p_decisoes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu       uuid := plt_privado.fn_usuario_atual();
  v_card     public.plt_cards%rowtype;
  v_numero   integer;
  v_d        jsonb;
  v_id       bigint;
  v_destino  text;
  v_alvo_id  bigint;
  v_alvo     public.plt_cards%rowtype;
  v_alvo_p   public.pedidos%rowtype;
  v_peca     public.plt_cards%rowtype;
  v_chave    text;
  v_seq      integer;
  v_k        integer;
  v_etapa    bigint;
  v_setor    bigint;
  v_coluna   text;
  v_ev       bigint;
  v_m        text;
  v_via      text;
  v_pcp      boolean := false;
  v_feitas   jsonb := '[]'::jsonb;
  v_puladas  jsonb := '[]'::jsonb;
begin
  if v_eu is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Decidir para onde vão os móveis de pedido cancelado é gesto da logística ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_decisoes) is distinct from 'array' or jsonb_array_length(p_decisoes) = 0 then
    raise exception 'Escolha o destino de pelo menos um móvel.' using errcode = 'check_violation';
  end if;
  if jsonb_array_length(p_decisoes) > 100 then
    raise exception 'No máximo 100 móveis por vez.' using errcode = 'check_violation';
  end if;
  -- a trava do pedido cancelado: duas pessoas decidindo ao mesmo tempo esperam
  -- uma pela outra (a segunda pula o que a primeira já decidiu)
  select * into v_card from public.plt_cards where id = p_card_id and tipo = 'pedido' for update;
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'no_data_found';
  end if;
  select p.numero into v_numero from public.pedidos p where p.id = v_card.pedido_id;

  for v_d in select x from jsonb_array_elements(p_decisoes) x loop
    if jsonb_typeof(v_d) is distinct from 'object' or coalesce(v_d ->> 'peca_id', '') !~ '^[1-9][0-9]{0,17}$' then
      raise exception 'Cada decisão diz qual é o móvel.' using errcode = 'check_violation';
    end if;
    v_id := (v_d ->> 'peca_id')::bigint;
    v_destino := v_d ->> 'destino';
    if coalesce(v_destino, '') not in ('estoque', 'outro_pedido', 'cancelar') then
      raise exception 'Escolha o destino: seguir para o estoque, passar para outro pedido ou cancelar a fabricação.'
        using errcode = 'check_violation';
    end if;

    -- 'outro_pedido': a trava do pedido escolhido ANTES da peça — a mesma ordem da
    -- liberação do PCP (pedido → peça), para as duas nunca se esperarem em cruz
    v_alvo := null;
    v_alvo_p := null;
    if v_destino = 'outro_pedido' then
      if coalesce(v_d ->> 'pedido_id', '') !~ '^[1-9][0-9]{0,17}$' then
        raise exception 'Escolha para qual pedido o móvel vai.' using errcode = 'check_violation';
      end if;
      v_alvo_id := (v_d ->> 'pedido_id')::bigint;
      select * into v_alvo from public.plt_cards where pedido_id = v_alvo_id and tipo = 'pedido' for update;
      select * into v_alvo_p from public.pedidos where id = v_alvo_id;
    end if;

    select * into v_peca from public.plt_cards where id = v_id and tipo = 'unidade' for update;
    if not found then
      raise exception 'Móvel % não encontrado.', v_id using errcode = 'no_data_found';
    end if;
    -- já decidida (por outra pessoa, pelo PCP, pelo fim da linha ou porque o Tiny
    -- descancelou): um efeito só — pula e conta o que aconteceu com ela
    if v_peca.destino_pendente_em is null or v_peca.arquivado_em is not null
       or v_peca.pedido_id is distinct from v_card.pedido_id then
      v_puladas := v_puladas || jsonb_build_array(jsonb_build_object(
        'peca_id', v_id,
        'destino', (select d.dados ->> 'destino' from public.plt_eventos d
                     where d.card_id = v_id and d.tipo = 'destino_decidido'
                     order by d.id desc limit 1)));
      continue;
    end if;

    if v_destino = 'estoque' then
      v_m := coalesce(current_setting('plt.destino_maquinaria', true), '');
      perform set_config('plt.destino_maquinaria', 'on', true);
      insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id, observacao, dados)
        values (v_id, 'destino_decidido', v_eu, 'interface', v_peca.setor_atual_id, v_peca.etapa_atual_id,
                format('Pedido %s cancelado no Tiny — a logística decidiu: o móvel segue para o estoque.', v_numero),
                jsonb_build_object('destino', 'estoque', 'pedido_id', v_card.pedido_id, 'numero', v_numero,
                                   'card_pedido_id', v_card.id))
        returning id into v_ev;
      perform set_config('plt.destino_maquinaria', v_m, true);
      insert into public.plt_eventos (card_id, tipo, usuario_id, origem, evento_referencia_id, observacao, dados)
        values (v_id, 'unidade_desvinculada', v_eu, 'interface', v_ev,
                format('Pedido %s cancelado no Tiny — o móvel segue a produção sem dono e, pronto, entra no ESTOQUE.', v_numero),
                jsonb_build_object(
                  'motivo',          'pedido_cancelado',
                  'pedido_id',       v_card.pedido_id,
                  'numero',          v_numero,
                  'card_pedido_id',  v_card.id,
                  'produto_tiny_id', plt_privado.fn_produto_do_item(v_peca.item_codigo, v_peca.item_descricao)));
      v_feitas := v_feitas || jsonb_build_array(jsonb_build_object('peca_id', v_id, 'destino', 'estoque'));

    elsif v_destino = 'outro_pedido' then
      if v_alvo.id is null or v_alvo_p.id is null or v_alvo.arquivado_em is not null
         or v_alvo.entrega_evento_id is not null
         or plt_privado.fn_fora_do_pcp(v_alvo_p.situacao, v_alvo.volta_pcp_em, v_alvo.removido_pcp_em)
         or not exists (select 1 from public.plt_setores s
                         where s.id = v_alvo.setor_atual_id and s.papel_no_fluxo = 'entrada') then
        raise exception 'O pedido % não está mais no PCP — escolha outro destino para o móvel.',
          coalesce(v_alvo_p.numero::text, '') using errcode = 'check_violation';
      end if;
      -- a 1ª vaga aberta do MESMO móvel (a régua de fn_vincular_peca_producao)
      v_chave := plt_privado.fn_chave_peca(coalesce(v_peca.produto_tiny_id,
                                                    plt_privado.fn_produto_do_item(v_peca.item_codigo, v_peca.item_descricao)),
                                           v_peca.item_codigo, v_peca.item_descricao);
      v_seq := null;
      v_k := null;
      select w.seq, w.indice into v_seq, v_k
        from plt_privado.fn_vagas_pedido(v_alvo_id) w
       where w.card_id is null and w.reserva_card_id is null and w.chave = v_chave
       order by w.seq, w.indice
       limit 1;
      if v_seq is null then
        raise exception 'O pedido % não precisa mais deste móvel (a vaga já foi preenchida) — escolha outro destino.',
          v_alvo_p.numero using errcode = 'check_violation';
      end if;
      v_via := coalesce(current_setting('plt.destino_via', true), '');
      perform set_config('plt.destino_via', 'logistica', true);
      perform plt_privado.fn_vincular_peca_producao(v_alvo, v_seq, v_k, v_id, v_eu);
      perform set_config('plt.destino_via', v_via, true);
      v_pcp := true;
      v_feitas := v_feitas || jsonb_build_array(jsonb_build_object(
        'peca_id', v_id, 'destino', 'outro_pedido', 'numero_destino', v_alvo_p.numero,
        'item_seq', v_seq, 'indice_unidade', v_k));

    else  -- 'cancelar'
      v_etapa := null;
      select e.id, e.setor_id into v_etapa, v_setor
        from public.plt_etapas e
       where e.setor_id = v_peca.setor_atual_id and e.ativa
         and e.cancela_fabricacao and e.cancela_motivo = 'cancelada'
       order by e.ordem, e.id
       limit 1;
      if v_etapa is null then
        select e.id, e.setor_id into v_etapa, v_setor
          from public.plt_etapas e
          join public.plt_setores s on s.id = e.setor_id and s.codigo = 'limpeza_embalagem' and s.ativo
         where e.ativa and e.cancela_fabricacao and e.cancela_motivo = 'cancelada'
         order by e.ordem, e.id
         limit 1;
      end if;
      if v_etapa is null then
        raise exception 'Nenhuma coluna cancela a fabricação — em Configurações → Setores e etapas, ligue "cancela a fabricação" no CANCELADO da LIMPEZA E EMBALAGEM.'
          using errcode = 'check_violation';
      end if;
      select s.nome || ' · ' || e.nome into v_coluna
        from public.plt_etapas e join public.plt_setores s on s.id = e.setor_id
       where e.id = v_etapa;
      -- origem 'automacao' + a pessoa: a qualidade da saída de setor de produção não
      -- se pede aqui (D-25 — o móvel não segue a produção); o autor é quem decidiu
      insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id,
                                      setor_destino_id, etapa_destino_id, observacao, dados)
        values (v_id, case when v_setor = v_peca.setor_atual_id then 'movimentacao_etapa' else 'movimentacao_setor' end,
                v_eu, 'automacao', v_peca.setor_atual_id, v_peca.etapa_atual_id, v_setor, v_etapa,
                format('Pedido %s cancelado no Tiny — a logística cancelou a fabricação do móvel.', v_numero),
                jsonb_build_object('como', 'destino_pedido_cancelado', 'pedido_id', v_card.pedido_id,
                                   'numero', v_numero));
      v_feitas := v_feitas || jsonb_build_array(jsonb_build_object('peca_id', v_id, 'destino', 'cancelar',
                                                                    'coluna', v_coluna));
    end if;
  end loop;

  -- D-201: a peça ligada não passa pelo PCP — o quadro do PCP fica sabendo pelo pedido
  if v_pcp then
    perform plt_privado.fn_avisar('pcp');
  end if;

  return jsonb_build_object('numero', v_numero,
                            'decididas', jsonb_array_length(v_feitas),
                            'feitas', v_feitas,
                            'puladas', v_puladas);
end;
$$;

comment on function public.plt_fn_destino_decidir(bigint, jsonb) is
  'SESSAO-48 (frente 3): a logística decide, numa transação, o destino de cada móvel do pedido cancelado no Tiny que esperava a decisão — [{peca_id, destino: estoque | outro_pedido | cancelar, pedido_id?}]. Estoque: perde o pedido e segue a produção; outro pedido: a maquinaria da D-201 (peca_vinculada) na 1ª vaga aberta do mesmo móvel; cancelar: vai para a coluna que cancela (fabricacao_cancelada). Idempotente: a peça já decidida é pulada e relatada. Logística e admin.';
revoke all on function public.plt_fn_destino_decidir(bigint, jsonb) from public, anon;
grant execute on function public.plt_fn_destino_decidir(bigint, jsonb) to authenticated;

-- fim da frente 3 da SESSAO-48
