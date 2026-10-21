-- ============================================================================
-- SESSAO-38 · F5 — o TEMPO ÚTIL do card (só o expediente do setor; o PCP não
-- tem fila) + o STAND-BY no PCP (pedido do dono, 21/10/2026)
--
-- O que nasce (D-167…D-172 — ⏳ provisórias, escolhas do Claude):
--   1. plt_cards ganha a projeção do stand-by do card do PEDIDO:
--      standby_desde (nulo = fora), standby_motivo, standby_evento_id (o fato
--      que abriu) e standby_periodos (os períodos FECHADOS [{ini, fim}] — o
--      relógio do PCP desconta). Escrita SÓ pelo gatilho próprio
--      plt_eventos_projetar_standby (M-13) — a fn_projetar_card não muda.
--   2. Dois fatos novos (append-only — RNF-05): pedido_standby_entrou (o motivo
--      na observação: é o "por quê" da Auditoria) e pedido_standby_saiu
--      (dados.destino = aguardando | entregas). Guarda BEFORE para todo
--      escritor (M-14).
--   3. Motivos de stand-by (plt_motivos, tipo 'standby' — banco enxuto),
--      cadastrados em Configurações → Utilitários; nunca "especiais".
--   4. As portas do gesto: plt_fn_pcp_standby (entrar, com motivo
--      obrigatório) e plt_fn_pcp_standby_sair ('aguardando' = volta a
--      aguardar liberação; 'entregas' = as peças que faltam ficam prontas na
--      Expedição pulando a produção — a maquinaria do "Concluído" do super
--      admin, D-117 — e o pedido vira candidato de rota).
--   5. O PCP: "Aguardando liberação" (e o quadrinho da Visão do dia — D-75)
--      sem o stand-by; o grupo novo 'standby' é a aba nova. A Expedição
--      continua com eles (com a marca); os candidatos de rota
--      (vw_pedidos_para_rota) ficam sem eles.
--   6. A régua do tempo (plt_fn_regua_tempo): o horário de cada setor e as
--      pausas de setor — vem na abertura do app; o card conta só o expediente.
--   7. O PCP ganha o horário do setor de produção de menor ordem (uma vez, só
--      se não tiver nenhum) — sem horário ele contaria 24 h × 7 (D-29).
--
-- Compatível com o site publicado e com o da integração: colunas novas nulas/
-- padrão; nenhuma porta muda de nome, parâmetros ou forma (só ganham chaves
-- dentro de jsonb); as recriadas partem da versão VIVA (md5 conferido —
-- A-79). Nada nas tabelas da integração.
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · A projeção do stand-by no card do pedido
-- ----------------------------------------------------------------------------
alter table public.plt_cards add column if not exists standby_desde timestamptz;
alter table public.plt_cards add column if not exists standby_motivo text;
alter table public.plt_cards add column if not exists standby_evento_id bigint references public.plt_eventos(id);
alter table public.plt_cards add column if not exists standby_periodos jsonb not null default '[]'::jsonb;

comment on column public.plt_cards.standby_desde is
  'SESSAO-38 (D-169): o card do PEDIDO está em stand-by desde quando (nulo = fora). Projeção do fato pedido_standby_entrou/saiu — escrita só pelo gatilho.';
comment on column public.plt_cards.standby_motivo is
  'SESSAO-38 (D-169): o motivo do stand-by aberto (o texto do fato). Projeção.';
comment on column public.plt_cards.standby_evento_id is
  'SESSAO-38 (D-169): o fato que abriu o stand-by atual (a saída aponta para ele). Projeção.';
comment on column public.plt_cards.standby_periodos is
  'SESSAO-38 (D-167/D-169): os períodos de stand-by já FECHADOS, [{ini, fim}] — o tempo em PCP do pedido desconta todos. Projeção.';

-- Lei §7.2: a aba Stand-by lê por aqui; a chave estrangeira tem índice.
create index if not exists plt_cards_pcp_standby_idx
  on public.plt_cards (desde, id)
  where tipo = 'pedido' and standby_desde is not null and arquivado_em is null;
create index if not exists plt_cards_standby_evento_idx
  on public.plt_cards (standby_evento_id)
  where standby_evento_id is not null;

-- ----------------------------------------------------------------------------
-- 2 · Os tipos de evento (+ os dois do stand-by) — recriado POR INTEIRO a
--     partir da versão viva (migration dos cards, 20261022010000). E-19: só
--     ESTA valida (o validate saiu daquela).
-- ----------------------------------------------------------------------------
do $$
declare
  v_nome text;
begin
  select conname into v_nome
    from pg_constraint
   where conrelid = 'public.plt_eventos'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%card_criado%';
  if v_nome is not null then
    execute format('alter table public.plt_eventos drop constraint %I', v_nome);
  end if;
  alter table public.plt_eventos add constraint plt_eventos_tipo_check
    check (tipo in (
      'card_criado', 'movimentacao_setor', 'movimentacao_etapa',
      'execucao_iniciada', 'execucao_finalizada', 'execucao_pausada', 'execucao_retomada',
      'qualidade_marcada', 'qualidade_parecer', 'divergencia_registrada', 'notificacao_enviada',
      'delegacao', 'estorno', 'pedido_atualizado', 'pedido_cancelado', 'card_arquivado',
      'pedido_entregue', 'pedido_lancado_rotas', 'unidade_desvinculada', 'peca_alocada',
      'peca_reservada', 'peca_reserva_desfeita', 'estoque_reserva_avaliada',
      'etiqueta_adicionada', 'etiqueta_removida', 'card_desarquivado',
      'entrega_desfeita', 'entrega_nao_realizada',
      'pedido_devolvido',
      'comentario_adicionado', 'anexo_adicionado',
      'devolucao_decidida', 'ajuste_aberto', 'ajuste_concluido',
      'avulso_concluido', 'card_editado',
      'responsavel_adicionado', 'responsavel_removido',
      'anexo_removido', 'comentario_editado', 'comentario_apagado',
      'auxilio_iniciado', 'auxilio_pausado', 'auxilio_retomado', 'auxilio_encerrado',
      'prioridade_definida', 'responsavel_setor_definido',
      -- SESSAO-38 (D-169): o stand-by do pedido no PCP
      'pedido_standby_entrou', 'pedido_standby_saiu'
    )) not valid;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3 · Os motivos de stand-by (Configurações → Utilitários) — o check recriado
--     a partir da versão viva (migration da presença), not valid; o validate
--     mora no fim DESTA (E-19 — saiu daquela).
-- ----------------------------------------------------------------------------
alter table public.plt_motivos drop constraint if exists plt_motivos_tipo_ck;
alter table public.plt_motivos add constraint plt_motivos_tipo_ck
  check (tipo in ('nao_entregue', 'desfazer_entrega', 'devolucao', 'pausa', 'saida', 'standby'))
  not valid;

insert into public.plt_motivos (tipo, texto, ordem)
select x.tipo, x.texto, x.ordem
  from (values
    ('standby', 'Aguardando pagamento', 10),
    ('standby', 'Cliente pediu para segurar', 20),
    ('standby', 'Aguardando confirmação do cliente', 30),
    ('standby', 'Aguardando medidas ou projeto', 40),
    ('standby', 'Produto já pronto no estoque', 50),
    ('standby', 'Entrega a combinar', 60)
  ) as x(tipo, texto, ordem)
 where not exists (select 1 from public.plt_motivos m
                    where m.tipo = x.tipo and lower(btrim(m.texto)) = lower(btrim(x.texto)));

-- ----------------------------------------------------------------------------
-- 4 · A guarda dos fatos do stand-by (BEFORE — vale para todo escritor, M-14)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_validar_standby()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card public.plt_cards%rowtype;
begin
  select * into v_card from public.plt_cards where id = new.card_id;
  if not found or v_card.tipo <> 'pedido' then
    raise exception 'Só o card do pedido entra em stand-by.' using errcode = 'check_violation';
  end if;
  if new.tipo = 'pedido_standby_entrou' then
    if v_card.standby_desde is not null then
      raise exception 'Este pedido já está em stand-by.' using errcode = 'check_violation';
    end if;
    if new.usuario_id is null then
      raise exception 'O stand-by é gesto de pessoa — é preciso dizer quem pôs.' using errcode = 'check_violation';
    end if;
    if nullif(btrim(coalesce(new.observacao, '')), '') is null then
      raise exception 'O stand-by pede o motivo.' using errcode = 'check_violation';
    end if;
  else
    if v_card.standby_desde is null then
      raise exception 'Este pedido não está em stand-by.' using errcode = 'check_violation';
    end if;
    if new.evento_referencia_id is distinct from v_card.standby_evento_id then
      raise exception 'A saída do stand-by precisa apontar o stand-by aberto.' using errcode = 'check_violation';
    end if;
    if coalesce(new.dados ->> 'destino', '') not in ('aguardando', 'entregas') then
      raise exception 'Para onde o pedido vai ao sair do stand-by: aguardando liberação ou as entregas.'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists plt_eventos_validar_standby on public.plt_eventos;
create trigger plt_eventos_validar_standby
  before insert on public.plt_eventos
  for each row
  when (new.tipo in ('pedido_standby_entrou', 'pedido_standby_saiu'))
  execute function plt_privado.fn_validar_standby();

-- ----------------------------------------------------------------------------
-- 5 · A projeção (M-13): o fato escreve o card do pedido
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_projetar_standby()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.tipo = 'pedido_standby_entrou' then
    update public.plt_cards
       set standby_desde = new.ocorrido_em,
           standby_motivo = new.observacao,
           standby_evento_id = new.id
     where id = new.card_id;
  else
    update public.plt_cards
       set standby_periodos = coalesce(standby_periodos, '[]'::jsonb)
                              || jsonb_build_array(jsonb_build_object('ini', standby_desde, 'fim', new.ocorrido_em)),
           standby_desde = null,
           standby_motivo = null,
           standby_evento_id = null
     where id = new.card_id and standby_desde is not null;
  end if;
  return null;
end;
$$;

drop trigger if exists plt_eventos_projetar_standby on public.plt_eventos;
create trigger plt_eventos_projetar_standby
  after insert on public.plt_eventos
  for each row
  when (new.tipo in ('pedido_standby_entrou', 'pedido_standby_saiu'))
  execute function plt_privado.fn_projetar_standby();

-- ----------------------------------------------------------------------------
-- 6 · O tempo em PCP do pedido, numa regra só (a janela do card lê daqui)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_pcp_tempo_do_pedido(p_pedido_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select jsonb_build_object(
             'entrou_pcp_em', (select min(e.ocorrido_em) from public.plt_eventos e
                                where e.card_id = pc.id and e.tipo = 'card_criado'),
             'liberado_completo_em', pc.liberado_completo_em,
             'standby_desde', pc.standby_desde,
             'standby_motivo', pc.standby_motivo,
             'standby_periodos', pc.standby_periodos)
      from public.plt_cards pc
     where pc.pedido_id = p_pedido_id and pc.tipo = 'pedido'), '{}'::jsonb);
$$;

comment on function plt_privado.fn_pcp_tempo_do_pedido(bigint) is
  'SESSAO-38 (D-167): o que o relógio do PCP do pedido precisa — a entrada no PCP, a liberação completa, o stand-by aberto e os fechados.';

-- ----------------------------------------------------------------------------
-- 7 · A régua do tempo (D-167/D-172): o horário de cada setor e as pausas de
--     setor (abertas ou que terminaram há menos de 120 dias), no fuso da
--     fábrica (America/Fortaleza = UTC−3 fixo, sem horário de verão). O card
--     conta no aparelho só o que cai no expediente (o mesmo que fn_tempo_util
--     faz nas dashboards); a régua vem na abertura do app.
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_regua_tempo()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when plt_privado.fn_usuario_atual() is null then null else jsonb_build_object(
    'fuso_min', -180,
    'janelas', coalesce((
      select jsonb_agg(jsonb_build_array(h.setor_id, h.dia_semana,
                                         to_char(h.hora_inicio, 'HH24:MI:SS'), to_char(h.hora_fim, 'HH24:MI:SS'))
                       order by h.setor_id, h.dia_semana, h.hora_inicio)
        from public.plt_horarios_funcionamento h
       where h.escopo = 'setor'), '[]'::jsonb),
    'pausas', coalesce((
      select jsonb_agg(jsonb_build_array(x.setor_id, x.inicio, x.fim) order by x.inicio)
        from (select p.setor_id, p.inicio, p.fim
                from public.plt_pausas_tempo p
               where p.escopo = 'setor'
                 and (p.fim is null or p.fim > now() - interval '120 days')
               order by p.inicio desc
               limit 500) x), '[]'::jsonb)) end;
$$;

comment on function public.plt_fn_regua_tempo() is
  'SESSAO-38 (D-167/D-172): a régua do tempo útil — janelas de cada setor [setor, dia (0 = domingo), início, fim] e pausas de setor [setor, início, fim|nulo] dos últimos 120 dias, fuso −180 min. Vem na abertura (plt_fn_abertura → regua_tempo); esta porta é a releitura.';

-- ----------------------------------------------------------------------------
-- 8 · O gesto: pôr em stand-by (motivo obrigatório — da lista ou "Outro")
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_pcp_standby(
  p_card_id   bigint,
  p_motivo_id bigint default null,
  p_texto     text   default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu     uuid := plt_privado.fn_usuario_atual();
  v_card   public.plt_cards%rowtype;
  v_pedido public.pedidos%rowtype;
  v_prog   date;
  v_motivo text;
begin
  if v_eu is null then
    raise exception 'Só usuário ativo da plataforma põe pedido em stand-by.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_card from public.plt_cards where id = p_card_id for update;
  if not found then
    raise exception 'Card % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  if v_card.tipo <> 'pedido' then
    raise exception 'Só o card do pedido vai para stand-by.' using errcode = 'check_violation';
  end if;
  -- D-125 item 7: o card de pedido é do PCP/logística, do líder e do admin.
  if not plt_privado.fn_pode_editar_card(p_card_id) then
    raise exception 'Pôr em stand-by é gesto do PCP/logística, do líder ou do admin.'
      using errcode = 'insufficient_privilege';
  end if;
  if v_card.standby_desde is not null then
    return jsonb_build_object('feito', false, 'motivo', 'ja_em_standby');
  end if;
  if v_card.arquivado_em is not null then
    raise exception 'Este pedido está arquivado.' using errcode = 'check_violation';
  end if;
  if v_card.liberado_completo_em is not null then
    raise exception 'Este pedido já foi liberado por inteiro — não está mais aguardando no PCP.'
      using errcode = 'check_violation';
  end if;
  if v_card.entrega_evento_id is not null then
    raise exception 'Este pedido já foi entregue.' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.plt_setores s
                  where s.id = v_card.setor_atual_id and s.papel_no_fluxo = 'entrada') then
    raise exception 'O stand-by é do pedido que está no PCP.' using errcode = 'check_violation';
  end if;
  select * into v_pedido from public.pedidos where id = v_card.pedido_id;
  if v_pedido.id is null or plt_privado.fn_tiny_tirou_do_pcp(v_pedido.situacao) then
    raise exception 'O Tiny já levou este pedido adiante — ele não espera no PCP.' using errcode = 'check_violation';
  end if;
  -- D-171: a rota não leva pedido em stand-by — o programado sai da
  -- programação antes (nada some calado de "Já programadas").
  select pr.data_entrega into v_prog from public.plt_programacoes pr where pr.card_id = v_card.id;
  if v_prog is not null then
    raise exception 'Este pedido está programado para a entrega de % — tire da programação antes de pôr em stand-by.',
      to_char(v_prog, 'DD/MM') using errcode = 'check_violation';
  end if;
  v_motivo := plt_privado.fn_motivo_da_lista('standby', p_motivo_id, p_texto);

  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, observacao, dados)
    values (v_card.id, 'pedido_standby_entrou', v_eu, 'interface', v_card.setor_atual_id, v_motivo,
            jsonb_build_object('motivo_id', p_motivo_id, 'motivo', v_motivo, 'numero', v_pedido.numero));

  return jsonb_build_object('feito', true, 'numero', v_pedido.numero, 'motivo', v_motivo);
end;
$$;

comment on function public.plt_fn_pcp_standby(bigint, bigint, text) is
  'SESSAO-38 (D-169): põe o pedido do PCP em stand-by com o motivo (lista "standby" ou "Outro" escrito — obrigatório). Sai de "Aguardando liberação" e dos candidatos de rota; o relógio do PCP para. Idempotente (já em stand-by → feito=false). Gate: quem edita o card de pedido.';

-- ----------------------------------------------------------------------------
-- 9 · O gesto: tirar do stand-by — 'aguardando' (volta a aguardar liberação)
--     ou 'entregas' (as peças que faltam ficam prontas na Expedição, pulando
--     a produção — a maquinaria do "Concluído", D-117/D-170)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_pcp_standby_sair(
  p_card_id    bigint,
  p_destino    text,
  p_observacao text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu       uuid := plt_privado.fn_usuario_atual();
  v_card     public.plt_cards%rowtype;
  v_numero   integer;
  v_producao integer;
  v_obs      text := nullif(left(btrim(coalesce(p_observacao, '')), 200), '');
  v_res      jsonb := '{}'::jsonb;
  v_marca    text;
begin
  if v_eu is null then
    raise exception 'Só usuário ativo da plataforma tira pedido do stand-by.' using errcode = 'insufficient_privilege';
  end if;
  if p_destino is null or p_destino not in ('aguardando', 'entregas') then
    raise exception 'Escolha para onde o pedido vai: aguardando liberação ou as entregas.' using errcode = 'check_violation';
  end if;
  select * into v_card from public.plt_cards where id = p_card_id for update;
  if not found or v_card.tipo <> 'pedido' then
    raise exception 'Card de pedido % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  if not plt_privado.fn_pode_editar_card(p_card_id) then
    raise exception 'Tirar do stand-by é gesto do PCP/logística, do líder ou do admin.'
      using errcode = 'insufficient_privilege';
  end if;
  if v_card.standby_desde is null then
    raise exception 'Este pedido não está em stand-by.' using errcode = 'check_violation';
  end if;
  if v_card.arquivado_em is not null then
    raise exception 'Este pedido está arquivado.' using errcode = 'check_violation';
  end if;
  select p.numero into v_numero from public.pedidos p where p.id = v_card.pedido_id;

  if p_destino = 'entregas' then
    if plt_privado.fn_pedido_cancelado(v_card.pedido_id) then
      raise exception 'Este pedido foi cancelado no Tiny — não vai para as entregas.' using errcode = 'check_violation';
    end if;
    -- D-170: a peça que está na produção não é arrancada de lá.
    select count(*)::int into v_producao
      from public.plt_cards u
      join public.plt_setores s on s.id = u.setor_atual_id and s.papel_no_fluxo = 'producao'
     where u.pedido_id = v_card.pedido_id and u.tipo = 'unidade' and u.arquivado_em is null;
    if v_producao > 0 then
      raise exception '% deste pedido % na produção — espere ficar pronto ou devolva o pedido para aguardando liberação.',
        case when v_producao = 1 then '1 peça' else v_producao || ' peças' end,
        case when v_producao = 1 then 'está' else 'estão' end
        using errcode = 'check_violation';
    end if;
  end if;

  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, observacao,
                                  evento_referencia_id, dados)
    values (v_card.id, 'pedido_standby_saiu', v_eu, 'interface', v_card.setor_atual_id,
            coalesce(v_obs, case p_destino when 'entregas' then 'Lançado direto para as entregas.'
                                           else 'Devolvido para aguardando liberação.' end),
            v_card.standby_evento_id,
            jsonb_build_object('destino', p_destino, 'numero', v_numero,
                               'motivo_do_standby', v_card.standby_motivo));

  if p_destino = 'entregas' then
    v_marca := current_setting('plt.concluir_standby', true);
    perform set_config('plt.concluir_standby', 'on', true);
    v_res := plt_privado.fn_concluir_pedido(v_card.id, v_eu);
    perform set_config('plt.concluir_standby', coalesce(v_marca, ''), true);
  end if;

  return jsonb_build_object('feito', true, 'destino', p_destino, 'numero', v_numero) || v_res;
end;
$$;

comment on function public.plt_fn_pcp_standby_sair(bigint, text, text) is
  'SESSAO-38 (D-169/D-170): tira o pedido do stand-by — aguardando (volta ao quadro "Aguardando liberação" e aos candidatos de rota) ou entregas (as peças que faltam nascem prontas na Expedição, usando a peça do estoque reservada pela venda quando há — fn_concluir_pedido; recusado com peça na produção). Gate: quem edita o card de pedido.';

-- ----------------------------------------------------------------------------
-- 10 · O horário do PCP (D-168): o do setor de produção de menor ordem, uma
--      vez, só se o PCP não tiver nenhum. O admin muda em Controle de tempo.
-- ----------------------------------------------------------------------------
insert into public.plt_horarios_funcionamento (escopo, setor_id, dia_semana, hora_inicio, hora_fim)
select 'setor', pcp.id, h.dia_semana, h.hora_inicio, h.hora_fim
  from public.plt_setores pcp
  cross join lateral (
    select s.id from public.plt_setores s
     where s.papel_no_fluxo = 'producao' and s.ativo
     order by s.ordem, s.id
     limit 1
  ) ref
  join public.plt_horarios_funcionamento h on h.escopo = 'setor' and h.setor_id = ref.id
 where pcp.codigo = 'pcp'
   and not exists (select 1 from public.plt_horarios_funcionamento x
                    where x.escopo = 'setor' and x.setor_id = pcp.id);

-- ----------------------------------------------------------------------------
-- 11 · Os candidatos da ROTA (a regra única de F2): + fora do stand-by (D-171)
-- ----------------------------------------------------------------------------
create or replace view plt_privado.vw_pedidos_para_rota as
select v.*
  from plt_privado.vw_pedidos_vivos v
 where v.devolucao_evento_id is null
   -- SESSAO-38 (D-171): o pedido em stand-by não entra em rota
   and not exists (select 1 from public.plt_cards sb
                    where sb.id = v.card_id and sb.standby_desde is not null);

comment on view plt_privado.vw_pedidos_para_rota is
  'SESSAO-38 (D-156/D-171): os pedidos que podem entrar numa rota — os vivos (vw_pedidos_vivos) fora da decisão pós devolução e fora do stand-by. Regra ÚNICA dos candidatos: plt_fn_programacao, plt_fn_rotas e plt_fn_programar_entrega leem daqui.';

revoke all on plt_privado.vw_pedidos_para_rota from public, anon, authenticated;

-- ============================================================================
-- 12 · As portas que mostram o pedido — recriadas POR INTEIRO a partir da
--      versão VIVA (md5 do corpo conferido no banco antes — A-79), cada uma
--      com a mesma assinatura. O que muda em cada uma está no comentário.
-- ============================================================================

-- 12a · plt_fn_cards_pedido_pcp (viva: migration 74) — + o grupo 'standby'; os outros sem o stand-by
create or replace function public.plt_fn_cards_pedido_pcp(
  p_limite       integer default 10,
  p_deslocamento integer default 0,
  p_grupo        text    default null   -- null = tudo | 'pedido' | 'reposicao'
)
returns table (
  id                   bigint,
  tipo                 text,
  pedido_id            bigint,
  card_pai_id          bigint,
  item_seq             integer,
  item_codigo          text,
  item_descricao       text,
  indice_unidade       integer,
  total_unidades       integer,
  setor_atual_id       bigint,
  etapa_atual_id       bigint,
  desde                timestamptz,
  executor_atual_id    uuid,
  responsavel_id       uuid,
  delegado_em          timestamptz,
  qualidade_atual      text,
  concluido_em         timestamptz,
  pausado_em           timestamptz,
  liberado_completo_em timestamptz,
  pecas_estoque        integer,
  contagem_total       bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id, c.tipo, c.pedido_id, c.card_pai_id, c.item_seq, c.item_codigo,
         c.item_descricao, c.indice_unidade, c.total_unidades, c.setor_atual_id,
         c.etapa_atual_id, c.desde, c.executor_atual_id, c.responsavel_id,
         c.delegado_em, c.qualidade_atual, c.concluido_em, c.pausado_em,
         c.liberado_completo_em,
         pe.n as pecas_estoque,
         count(*) over ()::bigint as contagem_total
    from public.plt_cards c
    join public.plt_setores s on s.id = c.setor_atual_id and s.papel_no_fluxo = 'entrada'
    left join public.pedidos p on p.id = c.pedido_id
    cross join lateral (
      select case when c.tipo <> 'pedido' then 0 else (
        select count(*)::int
          from public.plt_cards u
          join public.plt_setores se on se.id = u.setor_atual_id and se.codigo = 'estoque'
         where u.tipo = 'unidade' and u.pedido_id is null and u.arquivado_em is null
           and (u.reservada_pedido_id = c.pedido_id
                or (u.reservada_pedido_id is null
                    and u.item_codigo is not null
                    and not plt_privado.fn_eh_personalizado(u.item_descricao)
                    and exists (select 1 from public.pedido_itens pi
                                 where pi.pedido_id = c.pedido_id
                                   and pi.codigo = u.item_codigo
                                   and not plt_privado.fn_eh_personalizado(pi.descricao))))
      ) end as n
    ) pe
   where plt_privado.fn_usuario_atual() is not null
     and (
       plt_privado.fn_eh_admin()
       or c.setor_atual_id in (select plt_privado.fn_setores_do_usuario())
     )
     and c.tipo in ('pedido', 'reposicao')
     -- SESSAO-38 (D-169): o grupo 'standby' é a aba nova; os outros ficam sem ele
     and (case when p_grupo = 'standby' then c.tipo = 'pedido' and c.standby_desde is not null
               else (p_grupo is null or c.tipo = p_grupo) and c.standby_desde is null end)
     and c.arquivado_em is null
     and c.liberado_completo_em is null
     -- D-132 (14/10): o pedido que o Tiny já levou adiante (faturado, pronto
     -- para envio, enviado, entregue, não entregue, cancelado) sai do quadro e
     -- segue o Tiny; o CANCELADO mora em Pedidos → Cancelados. A reposição não
     -- tem pedido: fica até ser liberada por inteiro, arquivada ou vencer (D-85).
     and (c.tipo = 'reposicao'
          or (p.id is not null
              and not plt_privado.fn_tiny_tirou_do_pcp(p.situacao)
              -- D-63: sem nada a produzir (só frete), o pedido não espera
              -- liberação — vai direto para Pedidos em aguardo.
              and exists (select 1 from plt_privado.vw_itens_producao v
                           where v.pedido_id = p.id and v.unidades > 0)))
   order by c.desde asc nulls last, c.id
   limit least(greatest(coalesce(p_limite, 10), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

-- 12b · plt_fn_pcp_quadro (viva: migration dos cards) — o mesmo filtro com o grupo 'standby' + o stand-by no resumo
create or replace function public.plt_fn_pcp_quadro(
  p_limite       integer default 10,
  p_deslocamento integer default 0,
  p_grupo        text    default null,   -- null = tudo | 'pedido' | 'reposicao'
  p_ordem        text    default null    -- prioridade (padrão) | entrega | alfabetica
)
returns table (
  id                   bigint,
  tipo                 text,
  pedido_id            bigint,
  card_pai_id          bigint,
  item_seq             integer,
  item_codigo          text,
  item_descricao       text,
  indice_unidade       integer,
  total_unidades       integer,
  setor_atual_id       bigint,
  etapa_atual_id       bigint,
  desde                timestamptz,
  executor_atual_id    uuid,
  responsavel_id       uuid,
  delegado_em          timestamptz,
  qualidade_atual      text,
  concluido_em         timestamptz,
  pausado_em           timestamptz,
  liberado_completo_em timestamptz,
  pecas_estoque        integer,
  contagem_total       bigint,
  etiquetas            bigint[],
  pedido_resumo        jsonb,
  prioridade           text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with m as (select plt_privado.fn_ordem_do_quadro(p_ordem) as modo),
  base as (
    select c.id, c.desde, c.prioridade, p.numero, p.data_prevista,
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
    cross join lateral (
      select case when c.tipo <> 'pedido' then 0 else (
        select count(*)::int
          from public.plt_cards u
          join public.plt_setores se on se.id = u.setor_atual_id and se.codigo = 'estoque'
         where u.tipo = 'unidade' and u.pedido_id is null and u.arquivado_em is null
           and (u.reservada_pedido_id = c.pedido_id
                or (u.reservada_pedido_id is null
                    and u.item_codigo is not null
                    and not plt_privado.fn_eh_personalizado(u.item_descricao)
                    and exists (select 1 from public.pedido_itens pi
                                 where pi.pedido_id = c.pedido_id
                                   and pi.codigo = u.item_codigo
                                   and not plt_privado.fn_eh_personalizado(pi.descricao))))
      ) end as n
    ) pe
   order by pg.ord;
$$;

-- 12c · plt_fn_dash_pcp_dia (viva: migration 74) — sem o stand-by (o mesmo conjunto do quadro)
create or replace function public.plt_fn_dash_pcp_dia(
  p_dia date default null
)
returns table (
  pedidos_a_liberar       integer,
  unidades_liberadas_dia  integer,
  espera_mais_antiga      interval
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with dia as (
    select (coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date)::timestamp
            at time zone 'America/Fortaleza') as ini
  ),
  pcp as (
    select s.id from public.plt_setores s where s.codigo = 'pcp'
  ),
  -- D-75: os cards que o quadro do PCP mostra — o MESMO filtro de
  -- plt_fn_cards_pedido_pcp, sem o gate por pessoa do quadro (o do painel
  -- fica no fim). D-132: a regra do Tiny é a mesma função dos dois.
  quadro as (
    select c.id, c.desde
      from public.plt_cards c
      join public.plt_setores s on s.id = c.setor_atual_id and s.papel_no_fluxo = 'entrada'
      left join public.pedidos p on p.id = c.pedido_id
     where c.tipo in ('pedido', 'reposicao')
       and c.arquivado_em is null
       and c.liberado_completo_em is null
       -- SESSAO-38 (D-171): o pedido em stand-by não está aguardando liberação
       and c.standby_desde is null
       and (c.tipo = 'reposicao'
            or (p.id is not null
                and not plt_privado.fn_tiny_tirou_do_pcp(p.situacao)
                and exists (select 1 from plt_privado.vw_itens_producao v
                             where v.pedido_id = p.id and v.unidades > 0)))
  )
  select
    (select count(*)::int from quadro)             as pedidos_a_liberar,
    -- como estava (o dono não pediu mudança): toda unidade criada no dia
    (select count(*)::int
       from public.plt_eventos e
       join public.plt_cards c on c.id = e.card_id
      where e.tipo = 'card_criado'
        and c.tipo = 'unidade'
        and e.ocorrido_em >= (select ini from dia)
        and e.ocorrido_em <  (select ini from dia) + interval '1 day')
                                                   as unidades_liberadas_dia,
    (select max(now() - q.desde) from quadro q)    as espera_mais_antiga
   where (select id from pcp) in (select plt_privado.fn_setores_dashboard());
$$;

-- 12d · plt_fn_expedicao (viva: migration da logística) — + a marca do stand-by em cada pedido
create or replace function public.plt_fn_expedicao(
  p_filtro       text    default 'todos',   -- todos | com_rota | sem_rota | prontos | em_producao
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
  if v_filtro not in ('todos', 'com_rota', 'sem_rota', 'prontos', 'em_producao') then
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
           sb.standby_desde, sb.standby_motivo
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
           -- Os números dos filtros: o conjunto inteiro (sem a busca), no mesmo pedido.
           'contagens', (select jsonb_build_object(
                                  'todos',       count(*),
                                  'com_rota',    count(*) filter (where b.programacao_data is not null),
                                  'sem_rota',    count(*) filter (where b.programacao_data is null),
                                  'prontos',     count(*) filter (where b.pronto),
                                  'em_producao', count(*) filter (where not b.pronto))
                           from base b),
           'total', (select count(*) from filtrados),
           'itens', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'card_id', pg.card_id, 'pedido_id', pg.pedido_id, 'numero', pg.numero,
                      'cliente_nome', pg.cliente_nome, 'data_prevista', pg.data_prevista,
                      'situacao', pg.situacao,
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
                    order by pg.data_prevista asc nulls last, pg.numero desc)
               from pagina pg
               left join public.plt_caminhoes cam on cam.id = pg.caminhao_id), '[]'::jsonb)
         )
    into v_saida;
  return v_saida;
end;
$$;

-- 12e · fn_quadro_junto (viva: migration dos cards) — + o stand-by do pedido
create or replace function plt_privado.fn_quadro_junto(p_ids bigint[])
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'execucoes', coalesce((
      select jsonb_agg(jsonb_build_object('evento_inicio_id', v.evento_inicio_id, 'card_id', v.card_id,
                                          'usuario_inicio_id', v.usuario_inicio_id, 'iniciou_em', v.iniciou_em))
        from public.plt_vw_execucoes v
       where v.card_id = any (p_ids) and v.em_andamento), '[]'::jsonb),
    'auxilios', coalesce((
      select jsonb_agg(jsonb_build_object('card_id', a.card_id, 'usuario_id', a.usuario_id,
                                          'iniciado_em', a.iniciado_em, 'pausado_em', a.pausado_em,
                                          'pausa_motivo', a.pausa_motivo, 'segundos', a.segundos,
                                          'ultimo_inicio', a.ultimo_inicio))
        from public.plt_auxilios a
       where a.card_id = any (p_ids) and a.encerrado_em is null), '[]'::jsonb),
    'pessoas', coalesce((
      select jsonb_object_agg(u.id, jsonb_build_object('nome', u.nome, 'foto', u.foto_caminho))
        from public.plt_usuarios u
       where u.id in (select c.executor_atual_id from public.plt_cards c where c.id = any (p_ids)
                      union select unnest(c.responsaveis) from public.plt_cards c where c.id = any (p_ids)
                      union select unnest(c.auxiliares) from public.plt_cards c where c.id = any (p_ids)
                      union select e.usuario_id from public.plt_cards c join public.plt_eventos e on e.id = c.parecer_pendente_id
                             where c.id = any (p_ids))), '{}'::jsonb),
    'pedidos', coalesce((
      select jsonb_object_agg(p.id, jsonb_build_object(
               'pedido_id', p.id, 'numero', p.numero,
               'situacao', p.situacao, 'data_prevista', p.data_prevista, 'data_pedido', p.data_pedido,
               'entrou_pcp_em', (select min(e.ocorrido_em) from public.plt_eventos e where e.card_id = pc.id and e.tipo = 'card_criado'),
               'liberado_completo_em', pc.liberado_completo_em,
               -- SESSAO-38 (D-167): o relógio do PCP do pedido desconta o stand-by
               'standby_desde', pc.standby_desde, 'standby_periodos', pc.standby_periodos))
        from public.pedidos p
        left join public.plt_cards pc on pc.pedido_id = p.id and pc.tipo = 'pedido'
       where p.id in (select c.pedido_id from public.plt_cards c where c.id = any (p_ids) and c.pedido_id is not null)), '{}'::jsonb),
    'valores', coalesce((
      select jsonb_agg(jsonb_build_object('campo_id', v.campo_id, 'card_id', v.card_id, 'valor', v.valor))
        from public.plt_campos_valores v
       where v.card_id = any (p_ids)), '[]'::jsonb)
  );
$$;

-- 12f · plt_fn_card_janela (viva: migration dos cards) — + o tempo do PCP do pedido
create or replace function public.plt_fn_card_janela(p_card_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_card     public.plt_cards%rowtype;
  v_editar   boolean;
  v_pessoas  uuid[];
  v_eu       uuid := plt_privado.fn_usuario_atual();
  v_admin    boolean := plt_privado.fn_eh_admin();
  v_pcp      boolean := plt_privado.fn_pode_ver_expedicao();
  v_ids      bigint[];
  v_feitos   bigint[];
  v_planeja  boolean;
  v_setores  jsonb;
  v_pedido   public.pedidos%rowtype;
  v_prio     record;
begin
  select * into v_card from public.plt_cards where id = p_card_id;
  if not found then
    raise exception 'Card % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  if not plt_privado.fn_pode_anexar(p_card_id) then
    raise exception 'Você não vê este card.' using errcode = 'insufficient_privilege';
  end if;
  v_editar := plt_privado.fn_pode_editar_card(p_card_id);
  select * into v_pedido from public.pedidos where id = v_card.pedido_id;
  select v.prioridade, v.prioridade_herdada into v_prio from plt_privado.vw_card_ordem v where v.id = p_card_id;

  -- Os cards cuja história conta: o próprio; no card do pedido, as peças dele;
  -- na reposição, as peças que ela gerou.
  v_ids := case v_card.tipo
             when 'pedido' then coalesce((select array_agg(u.id) from public.plt_cards u
                                           where u.pedido_id = v_card.pedido_id and u.tipo = 'unidade'), '{}')
             when 'reposicao' then coalesce((select array_agg(u.id) from public.plt_cards u
                                              where u.card_pai_id = v_card.id and u.tipo = 'unidade'), '{}')
             else array[v_card.id]
           end;
  v_feitos := case when v_card.tipo in ('unidade', 'avulso') then plt_privado.fn_setores_executados(p_card_id) else '{}' end;
  -- Definir o responsável dos próximos setores (D-152): admin, PCP/logística,
  -- o líder do setor do card (o líder do setor escolhido também — linha a linha).
  v_planeja := v_card.tipo in ('unidade', 'avulso') and v_card.arquivado_em is null and v_eu is not null;

  with fatos as (
    select coalesce(e.setor_origem_id, e.setor_destino_id) as setor_id, e.tipo, e.usuario_id, min(e.ocorrido_em) as primeiro
      from public.plt_eventos e
     where e.card_id = any (v_ids)
       and e.tipo in ('execucao_iniciada', 'auxilio_iniciado')
       and e.usuario_id is not null
       and not exists (select 1 from public.plt_eventos x where x.tipo = 'estorno' and x.evento_referencia_id = e.id)
     group by 1, 2, 3
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'setor_id', s.id, 'setor_nome', s.nome, 'ordem', s.ordem,
           'executaram', coalesce((select jsonb_agg(f.usuario_id order by f.primeiro)
                                     from fatos f where f.setor_id = s.id and f.tipo = 'execucao_iniciada'), '[]'::jsonb),
           'auxiliaram', coalesce((select jsonb_agg(f.usuario_id order by f.primeiro)
                                     from fatos f where f.setor_id = s.id and f.tipo = 'auxilio_iniciado'
                                      and not exists (select 1 from fatos g where g.setor_id = s.id and g.tipo = 'execucao_iniciada'
                                                       and g.usuario_id = f.usuario_id)), '[]'::jsonb),
           'planejados', coalesce(v_card.responsaveis_setor -> s.id::text, '[]'::jsonb),
           'executado', exists (select 1 from fatos f where f.setor_id = s.id),
           'atual', s.id = v_card.setor_atual_id,
           'pode_planejar', v_planeja and not (s.id = any (v_feitos))
                            and (v_admin or v_pcp
                                 or (v_card.setor_atual_id is not null and plt_privado.fn_eh_lider_de(v_card.setor_atual_id))
                                 or plt_privado.fn_eh_lider_de(s.id))
         ) order by s.ordem, s.id), '[]'::jsonb)
    into v_setores
    from public.plt_setores s
   where s.ativo and s.papel_no_fluxo = 'producao';

  v_pessoas := array_remove(v_card.responsaveis || v_card.criado_por_id || v_card.executor_atual_id, null)
               || v_card.auxiliares
               || coalesce((select array_agg(distinct x::uuid)
                              from jsonb_array_elements(v_setores) s
                              cross join lateral jsonb_array_elements_text((s -> 'executaram') || (s -> 'auxiliaram') || (s -> 'planejados')) as t(x)),
                           '{}');

  return jsonb_build_object(
    'card', plt_privado.fn_quadro_cards(array[p_card_id]) -> 0,
    'arquivado_em', v_card.arquivado_em,
    'criado_em', v_card.criado_em,
    'setor', (select jsonb_build_object('id', s.id, 'nome', s.nome, 'codigo', s.codigo, 'papel_no_fluxo', s.papel_no_fluxo)
                from public.plt_setores s where s.id = v_card.setor_atual_id),
    'etapa', (select jsonb_build_object('id', e.id, 'nome', e.nome, 'eh_fila', e.eh_fila)
                from public.plt_etapas e where e.id = v_card.etapa_atual_id),
    'execucao', (select jsonb_build_object('usuario_id', v.usuario_inicio_id, 'iniciou_em', v.iniciou_em)
                   from public.plt_vw_execucoes v where v.card_id = p_card_id and v.em_andamento
                  order by v.iniciou_em desc limit 1),
    'auxilios', coalesce((
      select jsonb_agg(jsonb_build_object('usuario_id', a.usuario_id, 'iniciado_em', a.iniciado_em,
                                          'pausado_em', a.pausado_em, 'pausa_motivo', a.pausa_motivo,
                                          'segundos', a.segundos, 'ultimo_inicio', a.ultimo_inicio)
             order by a.iniciado_em)
        from public.plt_auxilios a
       where a.card_id = p_card_id and a.encerrado_em is null), '[]'::jsonb),
    'pessoas', coalesce((select jsonb_object_agg(u.id, jsonb_build_object('nome', u.nome, 'foto', u.foto_caminho))
                           from public.plt_usuarios u where u.id = any (v_pessoas)), '{}'::jsonb),
    'pedido', case when v_pedido.id is null then null else
                jsonb_build_object('pedido_id', v_pedido.id, 'numero', v_pedido.numero,
                                   'cliente_nome', coalesce((select cl.nome from public.clientes cl where cl.id = v_pedido.cliente_id), ''),
                                   'situacao', v_pedido.situacao, 'data_prevista', v_pedido.data_prevista,
                                   'data_pedido', v_pedido.data_pedido)
                -- SESSAO-38 (D-167): a entrada no PCP, a liberação e o stand-by — o
                -- "Tempo útil em PCP" do histórico
                || plt_privado.fn_pcp_tempo_do_pedido(v_pedido.id) end,
    -- SESSAO-38 (D-150): o prazo — do pedido no Tiny (início = a data do
    -- pedido, vencimento = a data de entrega do vendedor) ou, sem pedido, o
    -- digitado no card.
    'prazo', case when v_pedido.id is not null
                  then jsonb_build_object('inicio', v_pedido.data_pedido, 'vencimento', v_pedido.data_prevista, 'do_pedido', true)
                  else jsonb_build_object('inicio', v_card.inicio_em, 'vencimento', v_card.vence_em, 'do_pedido', false) end,
    'prioridade', jsonb_build_object('valor', coalesce(v_prio.prioridade, 'comum'),
                                     'do_pedido', coalesce(v_prio.prioridade_herdada, false) and v_card.pedido_id is not null,
                                     'da_reposicao', coalesce(v_prio.prioridade_herdada, false) and v_card.pedido_id is null),
    'responsaveis_por_setor', v_setores,
    'campos', coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'nome', f.nome, 'tipo', f.tipo, 'opcoes', f.opcoes,
                                          'em_pecas', f.em_pecas, 'em_pedidos', f.em_pedidos, 'em_avulsos', f.em_avulsos,
                                          'arquivado_em', f.arquivado_em,
                                          'valor', (select vv.valor from public.plt_campos_valores vv
                                                     where vv.campo_id = f.id
                                                       and ((v_card.tipo = 'pedido' and vv.pedido_id = v_card.pedido_id)
                                                            or (v_card.tipo <> 'pedido' and vv.card_id = v_card.id))))
                       order by f.nome)
        from public.plt_campos f
       where f.arquivado_em is null
         and case v_card.tipo when 'avulso' then f.em_avulsos
                              when 'pedido' then f.em_pedidos
                              else f.em_pecas end), '[]'::jsonb),
    'etiquetas', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'nome', t.nome, 'cor', t.cor,
                                                               'arquivada_em', t.arquivada_em) order by t.nome)
                             from public.plt_etiquetas t), '[]'::jsonb),
    'permissoes', jsonb_build_object(
      'editar', v_editar and v_card.arquivado_em is null,
      'editar_nome', v_editar and v_card.tipo = 'avulso' and v_card.arquivado_em is null,
      'concluir', v_card.tipo = 'avulso' and v_card.arquivado_em is null
                  and (v_editar or v_card.setor_atual_id in (select plt_privado.fn_setores_do_usuario())
                       or v_admin),
      'anexar', v_card.arquivado_em is null,
      'ver_removidos', v_admin,
      'pausar', v_card.executor_atual_id is not null and v_card.pausado_em is null and v_card.arquivado_em is null
                and (v_card.executor_atual_id = v_eu or v_admin
                     or v_eu = any (v_card.auxiliares)
                     or (v_card.setor_atual_id is not null and plt_privado.fn_eh_lider_de(v_card.setor_atual_id))),
      'retomar', v_card.pausado_em is not null and v_card.arquivado_em is null
                 and (v_card.executor_atual_id = v_eu or v_admin
                      or (v_card.setor_atual_id is not null and plt_privado.fn_eh_lider_de(v_card.setor_atual_id))),
      'auxiliar', v_card.executor_atual_id is not null and v_card.arquivado_em is null
                  and v_card.concluido_em is null,
      'sair_auxilio', v_eu = any (v_card.auxiliares),
      -- SESSAO-38 (D-151): mudar a prioridade (na peça, muda a do pedido)
      'priorizar', v_card.arquivado_em is null and plt_privado.fn_pode_priorizar(p_card_id)
                   and (v_card.tipo <> 'unidade' or v_card.pedido_id is not null or v_card.card_pai_id is not null),
      -- as datas do card de pedido vêm do Tiny: não se editam aqui
      'editar_datas', v_editar and v_card.arquivado_em is null and v_pedido.id is null)
  );
end;
$$;

-- 12g · plt_fn_abertura (viva: migration da presença) — + a régua do tempo
create or replace function public.plt_fn_abertura(p_rota text default null, p_meu_painel boolean default false)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id      uuid;
  v_perfil  jsonb;
  v_setores bigint[];
  v_ret     jsonb;
begin
  select u.id,
         jsonb_build_object(
           'id', u.id, 'nome', u.nome, 'usuario', u.usuario, 'email', u.email, 'telefone', u.telefone,
           'matricula', u.matricula, 'papel', u.papel, 'senha_padrao', u.senha_padrao, 'ativo', u.ativo,
           'arquivado_em', u.arquivado_em, 'tema', u.tema, 'foto_caminho', u.foto_caminho,
           'modulos', u.modulos, 'super_admin', u.super_admin,
           -- SESSAO-36: a conta de tablet vive só no /tablet; o liga/desliga do auxílio
           'conta_tablet', u.conta_tablet, 'pode_auxiliar', u.pode_auxiliar)
    into v_id, v_perfil
    from public.plt_usuarios u
   where u.auth_user_id = auth.uid() and u.ativo
   limit 1;

  -- O instante da leitura: o canal pessoal entra pedindo a reprise desde aqui
  -- (nada que saia entre ler e ouvir se perde).
  v_ret := jsonb_build_object('agora_ms', floor(extract(epoch from clock_timestamp()) * 1000)::bigint);
  if v_id is null then
    return v_ret || jsonb_build_object('perfil', null, 'vinculos', '[]'::jsonb);
  end if;

  if p_rota is not null and length(p_rota) > 300 then
    p_rota := left(p_rota, 300);
  end if;

  select coalesce(array_agg(us.setor_id order by us.setor_id), '{}') into v_setores
    from public.plt_usuario_setores us where us.usuario_id = v_id;

  v_ret := v_ret || jsonb_build_object(
    'perfil', v_perfil,
    'vinculos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'setor_id', us.setor_id, 'lider_do_setor', us.lider_do_setor,
               'setor', case when s.id is null then null
                             else jsonb_build_object('id', s.id, 'nome', s.nome, 'codigo', s.codigo) end)
             order by us.setor_id)
        from public.plt_usuario_setores us
        left join public.plt_setores s on s.id = us.setor_id
       where us.usuario_id = v_id), '[]'::jsonb),
    'setores', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'codigo', s.codigo, 'nome', s.nome, 'papel_no_fluxo', s.papel_no_fluxo,
               'ordem', s.ordem, 'ativo', s.ativo, 'limite_execucoes_por_pessoa', s.limite_execucoes_por_pessoa,
               'modo_delegacao', s.modo_delegacao, 'qualidade_envio_tipos', s.qualidade_envio_tipos,
               'qualidade_recebimento_tipos', s.qualidade_recebimento_tipos)
             order by s.ordem, s.id)
        from public.plt_setores s where s.ativo), '[]'::jsonb),
    'avisos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', a.id, 'tipo', a.tipo, 'titulo', a.titulo, 'corpo', a.corpo, 'card_id', a.card_id,
               'lida_em', a.lida_em, 'criada_em', a.criada_em)
             order by a.criada_em desc, a.id desc)
        from (select n.id, n.tipo, n.titulo, n.corpo, n.card_id, n.lida_em, n.criada_em
                from public.plt_notificacoes n
               where n.destinatario_id = v_id
               order by n.criada_em desc, n.id desc limit 20) a), '[]'::jsonb),
    'conversas', coalesce((
      select jsonb_agg(to_jsonb(c) - 'ordinality' order by c.ordinality)
        from public.plt_fn_chat_conversas(null::timestamptz, null::bigint, 5, null::bigint) with ordinality as c), '[]'::jsonb),
    'tarefas', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.criada_em, t.id)
        from (select tt.id, tt.titulo, tt.descricao, tt.card_id, tt.setor_id, tt.responsavel_id, tt.criada_por_id,
                     tt.delegacao, tt.situacao, tt.prazo, tt.iniciada_em, tt.concluida_em, tt.criada_em,
                     tt.tarefa_mae_id, tt.origem, tt.evento_referencia_id, tt.privada, tt.tempo_acumulado
                from public.plt_tarefas tt
               where tt.responsavel_id = v_id and tt.situacao <> 'concluida' and tt.tarefa_mae_id is null) t), '[]'::jsonb),
    'execucoes', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.iniciou_em, x.evento_inicio_id)
        from public.plt_fn_minhas_execucoes() x), '[]'::jsonb),
    -- SESSAO-38 (D-172): a régua do tempo útil (o horário de cada setor e as
    -- pausas de setor) — o card conta só o expediente, no aparelho
    'regua_tempo', public.plt_fn_regua_tempo(),
    -- migration 80: os catálogos que os quadros, o PCP, os pedidos e a janela
    -- do card usam (antes: 2 leituras a mais ao abrir qualquer um deles)
    'etiquetas', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'nome', e.nome, 'cor', e.cor, 'arquivada_em', e.arquivada_em)
             order by e.nome)
        from public.plt_etiquetas e), '[]'::jsonb),
    'campos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'nome', c.nome, 'tipo', c.tipo, 'opcoes', c.opcoes, 'em_pecas', c.em_pecas,
               'em_pedidos', c.em_pedidos, 'em_avulsos', c.em_avulsos, 'arquivado_em', c.arquivado_em)
             order by c.nome)
        from public.plt_campos c), '[]'::jsonb));

  if p_meu_painel then
    v_ret := v_ret || jsonb_build_object('meu_painel', jsonb_build_object(
      'cards', coalesce((
        select jsonb_agg(to_jsonb(c) order by c.desde nulls last, c.id)
          from (select cc.id, cc.tipo, cc.pedido_id, cc.card_pai_id, cc.item_seq, cc.item_codigo, cc.item_descricao,
                       cc.indice_unidade, cc.total_unidades, cc.setor_atual_id, cc.etapa_atual_id, cc.desde,
                       cc.executor_atual_id, cc.responsavel_id, cc.delegado_em, cc.qualidade_atual, cc.concluido_em,
                       cc.pausado_em, cc.liberado_completo_em, cc.produto_tiny_id, cc.etiquetas, cc.parecer_pendente_id
                  from public.plt_cards cc
                 where cc.responsavel_id = v_id and cc.concluido_em is null and cc.arquivado_em is null) c), '[]'::jsonb),
      'setores_chave', array_to_string(v_setores, ','),
      'tarefas_sistema', case when cardinality(v_setores) = 0 then '[]'::jsonb else coalesce((
        select jsonb_agg(to_jsonb(t) order by t.criada_em, t.id)
          from (select tt.id, tt.titulo, tt.descricao, tt.card_id, tt.setor_id, tt.responsavel_id, tt.criada_por_id,
                       tt.delegacao, tt.situacao, tt.prazo, tt.iniciada_em, tt.concluida_em, tt.criada_em,
                       tt.tarefa_mae_id, tt.origem, tt.evento_referencia_id, tt.privada, tt.tempo_acumulado
                  from public.plt_tarefas tt
                 where tt.origem = 'sistema' and tt.setor_id = any (v_setores) and tt.situacao <> 'concluida') t), '[]'::jsonb) end,
      'fila_prioridade', coalesce((select u.fila_prioridade from public.plt_usuarios u where u.id = v_id), '[]'::jsonb),
      'metas', coalesce((
        select jsonb_agg(to_jsonb(m) - 'ordinality' order by m.ordinality)
          from public.plt_fn_metas_painel(false, 20, 0) with ordinality as m), '[]'::jsonb)));
  end if;

  -- O gesto de abrir: o registro da navegação da 1ª rota (que já carimba a
  -- presença) — o que a casca gravava em duas requisições a mais. Sem rota é a
  -- releitura do perfil depois de um gesto (editar o perfil, o tema): nada a
  -- gravar — a presença já veio do próprio gesto.
  if p_rota is not null and length(btrim(p_rota)) > 0 then
    perform public.plt_fn_registrar_log('navegacao', p_rota, '{}'::jsonb);
  end if;

  return v_ret;
end;
$$;

-- 12h · plt_fn_motivo_salvar (viva: migration da pausa especial) — + o tipo standby
create or replace function public.plt_fn_motivo_salvar(
  p_id       bigint,
  p_tipo     text,
  p_texto    text,
  p_ordem    integer default null,
  p_ativo    boolean default true,
  p_especial boolean default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id       bigint;
  v_especial boolean;
begin
  if not plt_privado.fn_eh_admin() then
    raise exception 'Cadastrar motivo é gesto de admin.' using errcode = 'insufficient_privilege';
  end if;
  -- SESSAO-38 (D-169): + os motivos de stand-by
  if p_tipo not in ('nao_entregue', 'desfazer_entrega', 'devolucao', 'pausa', 'saida', 'standby') then
    raise exception 'Tipo de motivo desconhecido.' using errcode = 'check_violation';
  end if;
  if char_length(btrim(coalesce(p_texto, ''))) not between 2 and 80 then
    raise exception 'O motivo precisa ter de 2 a 80 letras — uma frase curta.' using errcode = 'check_violation';
  end if;
  if coalesce(p_especial, false) and p_tipo <> 'pausa' then
    raise exception 'Só motivo de pausa pode ser especial.' using errcode = 'check_violation';
  end if;
  if p_id is null then
    insert into public.plt_motivos (tipo, texto, ordem, ativo, especial)
      values (p_tipo, btrim(p_texto), coalesce(p_ordem, 100), coalesce(p_ativo, true), coalesce(p_especial, false))
      returning id, especial into v_id, v_especial;
  else
    update public.plt_motivos
       set texto = btrim(p_texto), ordem = coalesce(p_ordem, ordem), ativo = coalesce(p_ativo, ativo),
           especial = coalesce(p_especial, especial),
           atualizado_em = now()
     where id = p_id and tipo = p_tipo
     returning id, especial into v_id, v_especial;
    if v_id is null then
      raise exception 'Motivo não encontrado.' using errcode = 'no_data_found';
    end if;
  end if;
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (plt_privado.fn_usuario_atual(), 'motivo_salvo',
            jsonb_build_object('motivo_id', v_id, 'tipo', p_tipo, 'texto', btrim(p_texto),
                               'ativo', coalesce(p_ativo, true), 'especial', v_especial));
  return v_id;
exception when unique_violation then
  raise exception 'Já existe esse motivo.' using errcode = 'unique_violation';
end;
$$;

-- 12i · fn_concluir_pedido (viva: migration 59) — o texto da história quando vem do stand-by
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
  -- SESSAO-38 (D-170): o "lançar para as entregas" do stand-by usa a mesma
  -- maquinaria — só o texto da história muda
  v_standby boolean := coalesce(current_setting('plt.concluir_standby', true), '') = 'on';
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
    raise exception 'Pedidos em aguardo não está cadastrado — fale com o admin.' using errcode = 'no_data_found';
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
        perform plt_privado.fn_fechar_tempo_aberto(v_u.id, (case when v_standby then 'Lançado para as entregas a partir do stand-by: o tempo aberto fecha antes.' else 'Concluído pelo super admin: o tempo aberto fecha antes.' end));
        select * into v_u from public.plt_cards where id = v_u.id;
        insert into public.plt_eventos
            (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id,
             setor_destino_id, etapa_destino_id, observacao, dados)
          values
            (v_u.id, 'movimentacao_setor', p_usuario, 'api', v_u.setor_atual_id, v_u.etapa_atual_id,
             v_aguardo, null, (case when v_standby then 'Lançado para as entregas a partir do stand-by (pulou a produção).' else 'Concluído pelo super admin (ajuste da plataforma).' end),
             jsonb_build_object(case when v_standby then 'standby_entregas' else 'ajuste_super_admin' end, true, 'numero', v_numero));
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
                       then (case when v_standby then 'Lançado para as entregas a partir do stand-by — usou a peça do estoque reservada para o pedido.' else 'Concluído pelo super admin — usou a peça do estoque reservada para o pedido.' end)
                       else (case when v_standby then 'Lançado para as entregas a partir do stand-by — a peça nasce pronta (pulou a produção).' else 'Concluído pelo super admin — a peça nasce pronta (ajuste da plataforma).' end) end,
                  jsonb_build_object(case when v_standby then 'standby_entregas' else 'ajuste_super_admin' end, true, 'numero', v_numero)
                  || case when v_peca.id is not null
                          then jsonb_build_object('alocada_de', v_peca.id, 'reservada', true)
                          else '{}'::jsonb end);

        if v_peca.id is not null then
          insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, observacao, dados)
            values (v_peca.id, 'peca_alocada', p_usuario, 'api', v_peca.setor_atual_id,
                    'Usada pelo pedido ' || coalesce(v_numero::text, '')
                      || format((case when v_standby then ' (%s/%s) — lançado para as entregas a partir do stand-by.' else ' (%s/%s) — concluído pelo super admin.' end), k, it.unidades),
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

-- ----------------------------------------------------------------------------
-- 13 · Os checks novos validam tudo (E-19: o validate mora SEMPRE na migration
--      mais nova do check — saiu da dos cards e da da presença)
-- ----------------------------------------------------------------------------
alter table public.plt_eventos validate constraint plt_eventos_tipo_check;
alter table public.plt_motivos validate constraint plt_motivos_tipo_ck;

-- ----------------------------------------------------------------------------
-- 14 · Permissões (E-11: plt_privado fora da API)
-- ----------------------------------------------------------------------------
revoke all on function plt_privado.fn_validar_standby()            from public, anon, authenticated;
revoke all on function plt_privado.fn_projetar_standby()           from public, anon, authenticated;
revoke all on function plt_privado.fn_pcp_tempo_do_pedido(bigint)  from public, anon, authenticated;
revoke all on function plt_privado.fn_concluir_pedido(bigint, uuid) from public, anon, authenticated;
revoke all on function plt_privado.fn_quadro_junto(bigint[])       from public, anon, authenticated;

revoke all on function public.plt_fn_regua_tempo()                          from public, anon;
revoke all on function public.plt_fn_pcp_standby(bigint, bigint, text)      from public, anon;
revoke all on function public.plt_fn_pcp_standby_sair(bigint, text, text)   from public, anon;
revoke all on function public.plt_fn_cards_pedido_pcp(integer, integer, text)        from public, anon;
revoke all on function public.plt_fn_pcp_quadro(integer, integer, text, text)        from public, anon;
revoke all on function public.plt_fn_dash_pcp_dia(date)                              from public, anon;
revoke all on function public.plt_fn_expedicao(text, text, integer, integer)         from public, anon;
revoke all on function public.plt_fn_card_janela(bigint)                             from public, anon;
revoke all on function public.plt_fn_abertura(text, boolean)                         from public, anon;
revoke all on function public.plt_fn_motivo_salvar(bigint, text, text, integer, boolean, boolean) from public, anon;

grant execute on function public.plt_fn_regua_tempo()                        to authenticated;
grant execute on function public.plt_fn_pcp_standby(bigint, bigint, text)    to authenticated;
grant execute on function public.plt_fn_pcp_standby_sair(bigint, text, text) to authenticated;
grant execute on function public.plt_fn_cards_pedido_pcp(integer, integer, text)        to authenticated;
grant execute on function public.plt_fn_pcp_quadro(integer, integer, text, text)        to authenticated;
grant execute on function public.plt_fn_dash_pcp_dia(date)                              to authenticated;
grant execute on function public.plt_fn_expedicao(text, text, integer, integer)         to authenticated;
grant execute on function public.plt_fn_card_janela(bigint)                             to authenticated;
grant execute on function public.plt_fn_abertura(text, boolean)                         to authenticated;
grant execute on function public.plt_fn_motivo_salvar(bigint, text, text, integer, boolean, boolean) to authenticated;
