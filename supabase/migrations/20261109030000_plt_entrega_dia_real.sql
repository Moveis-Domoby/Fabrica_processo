-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · SESSAO-47 · BLOCO B — O DIA REAL DA ENTREGA
-- (09/11/2026 — pedido do dono: "deve aparecer também um botão de alterar a
-- data da entrega para o dia que foi entregue de fato … se a data for alterada,
-- isso deve refletir em toda a plataforma, inclusive no calendário das rotas")
--
-- O que muda:
--
--   1. A DATA QUE VALE é uma projeção no card do pedido: plt_cards.entrega_em
--      (o instante em que a entrega aconteceu de fato), mantida SÓ pelo gatilho
--      dos fatos — pedido_entregue liga, entrega_desfeita desliga,
--      entrega_dia_corrigido corrige. O dia é sempre o do fuso da fábrica
--      (plt_privado.fn_dia_da_entrega — uma função só).
--   2. REGISTRAR com o dia: plt_fn_registrar_entrega ganha p_dia (padrão nulo =
--      hoje, como sempre — o site publicado segue funcionando). Nunca um dia que
--      ainda não chegou, nunca antes de o pedido chegar à plataforma: conferido
--      AQUI, no banco. O fato pedido_entregue nasce com ocorrido_em no dia
--      escolhido (o fim do expediente daquele dia, pelo calendário da fábrica) e
--      registrado_em = agora. Só ESSE fato carrega o dia real: as peças, o tempo
--      aberto e o card saem em AGORA, como sempre.
--   3. O que era "quando foi REGISTRADA" passa a ler registrado_em: o toque
--      repetido (10 min), o "desfazer do dia" (quem marcou hoje "entregue ontem"
--      ainda desfaz hoje), a situação de antes nos avisos do Tiny e a janela que
--      acha as peças que saíram com a entrega.
--   4. CORRIGIR DEPOIS — só o administrador, por FATO NOVO
--      (plt_fn_entrega_corrigir_dia → entrega_dia_corrigido, com o dia de antes
--      e o novo). A entrega não se edita (RNF-05).
--   5. TODO LEITOR pela mesma data: lista de pedidos, ficha, ROTAS → Entregas,
--      Já programadas, Entregas do dia, calendário das rotas (o entregue no dia
--      REAL, com o "programado para" quando difere) e o número de entregas do
--      painel de motivos (as vigentes pelo dia real — antes contava fatos,
--      inclusive os desfeitos).
--
-- O Tiny não muda: a situação "Entregue" segue indo como hoje; a data não vai.
--
-- Funções recriadas por EXTRAÇÃO da versão vigente (o último create nas
-- migrations), com trocas exatas e contadas. Assinaturas novas:
--   plt_fn_registrar_entrega(bigint, text, boolean)   → + date        (padrão nulo)
--   plt_privado.fn_fechar_pedido(bigint, uuid, text, text, text) → + timestamptz (padrão nulo)
-- Retornos em tabela não mudam de forma; os jsonb só ganham chaves.
-- Nada em tabela da integração. Sem relógio novo. Reaplicável.
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · A data que vale: a projeção no card do pedido
-- ----------------------------------------------------------------------------
alter table public.plt_cards add column if not exists entrega_em timestamptz;

comment on column public.plt_cards.entrega_em is
  'SESSAO-47: QUANDO a entrega vigente do pedido aconteceu de fato (o dia real, no fuso da fábrica: plt_privado.fn_dia_da_entrega). Projeção dos fatos: pedido_entregue liga (o ocorrido_em dele), entrega_desfeita desliga, entrega_dia_corrigido corrige. Nulo = sem entrega vigente. Não escreva à mão. Quando ela foi REGISTRADA é o registrado_em do fato (plt_cards.entrega_evento_id).';

-- filtro e ordenação de toda leitura "por dia de entrega" (calendário, entregas
-- do dia, números por dia) — só os pedidos entregues (Lei §7.2: parcial)
create index if not exists plt_cards_entrega_em_idx
  on public.plt_cards (entrega_em) where entrega_em is not null;

-- ----------------------------------------------------------------------------
-- 2 · Uma função só para "o dia da entrega" e o instante de um dia escolhido
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_dia_da_entrega(p_em timestamptz)
returns date
language sql
immutable
set search_path = public, pg_temp
as $$
  select (p_em at time zone 'America/Fortaleza')::date;
$$;

comment on function plt_privado.fn_dia_da_entrega(timestamptz) is
  'SESSAO-47: o DIA de uma entrega — sempre no fuso da fábrica (America/Fortaleza, fixo). Um dono para a regra: toda tela que mostra "entregue no dia X" converte por aqui. Filtro por período usa os limites do dia direto na coluna (plt_cards.entrega_em), para andar no índice.';

-- O instante que o fato da entrega guarda para um DIA escolhido — e a regra do
-- dia, num lugar só (registrar e corrigir leem daqui):
--   · dia futuro: recusado · antes de o pedido chegar à plataforma: recusado;
--   · hoje: agora;
--   · dia passado: o FIM DO EXPEDIENTE daquele dia, pela régua da SESSAO-42 (o
--     expediente da fábrica = a união dos setores de produção, com as exceções
--     do calendário e a hora extra); sem expediente naquele dia (domingo,
--     feriado, fábrica sem horário cadastrado) = 18:00. Nunca fora do dia
--     escolhido, nunca antes da chegada do pedido, nunca depois de agora.
create or replace function plt_privado.fn_entrega_instante(p_dia date, p_chegou_em timestamptz)
returns timestamptz
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_hoje   date := (now() at time zone 'America/Fortaleza')::date;
  v_chegou date := (p_chegou_em at time zone 'America/Fortaleza')::date;
  v_ini    timestamptz;
  v_fim    timestamptz;
  v_inst   timestamptz;
begin
  if p_dia is null then
    raise exception 'Escolha o dia em que a entrega aconteceu.' using errcode = 'check_violation';
  end if;
  if p_dia > v_hoje then
    raise exception 'Esse dia ainda não chegou — a entrega só pode ser marcada até hoje (%).', to_char(v_hoje, 'DD/MM/YYYY')
      using errcode = 'check_violation';
  end if;
  if v_chegou is not null and p_dia < v_chegou then
    raise exception 'Este pedido chegou à plataforma em % — a entrega não pode ser marcada antes disso.', to_char(v_chegou, 'DD/MM/YYYY')
      using errcode = 'check_violation';
  end if;
  if p_dia = v_hoje then
    return now();
  end if;

  v_ini := p_dia::timestamp at time zone 'America/Fortaleza';
  v_fim := (p_dia + 1)::timestamp at time zone 'America/Fortaleza';
  select max(upper(j.r)) into v_inst
    from unnest(plt_privado.fn_tempo_janelas_fabrica(v_ini, v_fim)) as j(r);
  -- sem expediente no dia, ou "o dia inteiro conta" (setor sem horário): 18:00
  if v_inst is null or v_inst >= v_fim then
    v_inst := (p_dia + time '18:00') at time zone 'America/Fortaleza';
  end if;
  -- o pedido chegou naquele mesmo dia, depois do expediente: a própria chegada
  if p_chegou_em is not null and v_inst < p_chegou_em then
    v_inst := p_chegou_em;
  end if;
  return least(v_inst, v_fim - interval '1 second', now());
end;
$$;

comment on function plt_privado.fn_entrega_instante(date, timestamptz) is
  'SESSAO-47: a regra do DIA da entrega e o instante que o fato guarda — nunca um dia que ainda não chegou, nunca antes de o pedido chegar à plataforma (recusa com a explicação); hoje = agora; dia passado = o fim do expediente da fábrica naquele dia (fn_tempo_janelas_fabrica: expediente, exceções, hora extra), ou 18:00 sem expediente. Um dono para a regra: plt_fn_registrar_entrega e plt_fn_entrega_corrigir_dia.';

revoke all on function plt_privado.fn_dia_da_entrega(timestamptz) from public, anon, authenticated;
revoke all on function plt_privado.fn_entrega_instante(date, timestamptz) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3 · A guarda no fato: nunca um dia futuro; a correção só pela porta
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_validar_entrega_dia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hoje date := (now() at time zone 'America/Fortaleza')::date;
  v_card public.plt_cards%rowtype;
  v_novo timestamptz;
begin
  if new.tipo = 'pedido_entregue' then
    if (new.ocorrido_em at time zone 'America/Fortaleza')::date > v_hoje then
      raise exception 'A entrega não pode ficar num dia que ainda não chegou.' using errcode = 'check_violation';
    end if;
    return new;
  end if;

  -- entrega_dia_corrigido: só pela porta do administrador (a maquinaria liga a marca)
  if coalesce(current_setting('plt.entrega_maquinaria', true), '') <> 'on' then
    raise exception 'O dia da entrega se corrige na ficha do pedido — é gesto do administrador.'
      using errcode = 'insufficient_privilege';
  end if;
  select * into v_card from public.plt_cards where id = new.card_id;
  if not found or v_card.tipo <> 'pedido' or v_card.entrega_evento_id is null
     or new.evento_referencia_id is distinct from v_card.entrega_evento_id then
    raise exception 'A correção do dia precisa apontar a entrega que está valendo.' using errcode = 'check_violation';
  end if;
  v_novo := nullif(new.dados ->> 'entregue_em', '')::timestamptz;
  if v_novo is null then
    raise exception 'A correção do dia precisa dizer o dia novo.' using errcode = 'check_violation';
  end if;
  if (v_novo at time zone 'America/Fortaleza')::date > v_hoje then
    raise exception 'A entrega não pode ficar num dia que ainda não chegou.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

comment on function plt_privado.fn_validar_entrega_dia() is
  'SESSAO-47: a guarda do dia da entrega no próprio fato — pedido_entregue nunca num dia futuro (fuso da fábrica); entrega_dia_corrigido só pela porta do administrador (marca plt.entrega_maquinaria), apontando a entrega vigente e com o instante novo (dados.entregue_em) até hoje.';

revoke all on function plt_privado.fn_validar_entrega_dia() from public, anon, authenticated;

drop trigger if exists plt_eventos_validar_entrega_dia on public.plt_eventos;
create trigger plt_eventos_validar_entrega_dia
  before insert on public.plt_eventos
  for each row
  when (new.tipo in ('pedido_entregue', 'entrega_dia_corrigido'))
  execute function plt_privado.fn_validar_entrega_dia();

-- ----------------------------------------------------------------------------
-- 4 · A projeção: o fato manda, o card guarda (M-13)
-- ----------------------------------------------------------------------------
-- (recriada da 20261008150000: + entrega_em e a correção do dia)
create or replace function plt_privado.fn_projetar_entrega()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.tipo = 'pedido_entregue' then
    update public.plt_cards
       set entrega_evento_id = new.id, entrega_em = new.ocorrido_em
     where id = new.card_id;
  elsif new.tipo = 'entrega_desfeita' then
    update public.plt_cards
       set entrega_evento_id = null, entrega_em = null
     where id = new.card_id;
  elsif new.tipo = 'entrega_dia_corrigido' then
    -- só a correção da entrega VIGENTE vale (a guarda do fato já confere)
    update public.plt_cards
       set entrega_em = (new.dados ->> 'entregue_em')::timestamptz
     where id = new.card_id and entrega_evento_id = new.evento_referencia_id;
  end if;
  return null;
end;
$$;

drop trigger if exists plt_eventos_projetar_entrega on public.plt_eventos;
create trigger plt_eventos_projetar_entrega
  after insert on public.plt_eventos
  for each row
  when (new.tipo in ('pedido_entregue', 'entrega_desfeita', 'entrega_dia_corrigido'))
  execute function plt_privado.fn_projetar_entrega();

-- A história: o dia de cada entrega vigente = o do fato dela, ou o da última
-- correção que aponta para ela. Reaplicável (só mexe no que estiver diferente).
update public.plt_cards c
   set entrega_em = x.em
  from (
    select pc.id,
           coalesce((select (k.dados ->> 'entregue_em')::timestamptz
                       from public.plt_eventos k
                      where k.evento_referencia_id = pc.entrega_evento_id
                        and k.tipo = 'entrega_dia_corrigido'
                      order by k.id desc
                      limit 1),
                    e.ocorrido_em) as em
      from public.plt_cards pc
      join public.plt_eventos e on e.id = pc.entrega_evento_id
     where pc.entrega_evento_id is not null
  ) x
 where c.id = x.id
   and c.entrega_em is distinct from x.em;

update public.plt_cards
   set entrega_em = null
 where entrega_evento_id is null and entrega_em is not null;

-- ----------------------------------------------------------------------------
-- 5 · Fechar o pedido: o fato da entrega pode nascer no dia real
-- ----------------------------------------------------------------------------
-- (recriada da 20261022020100_plt_entregue_confirmado_expedicao.sql:118-248: + p_ocorrido_em — assinatura nova, a de 5 sai)
drop function if exists plt_privado.fn_fechar_pedido(bigint, uuid, text, text, text);
create or replace function plt_privado.fn_fechar_pedido(
  p_card_pedido_id bigint,
  p_usuario        uuid,
  p_origem         text,
  p_observacao     text,
  p_fonte          text,
  -- SESSAO-47: quando a entrega aconteceu de fato (nulo = agora, como sempre —
  -- a reação ao Tiny e o super admin não mandam). Só o fato pedido_entregue o usa.
  p_ocorrido_em    timestamptz default null
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
    -- SESSAO-47: só ESTE fato carrega o dia real (ocorrido_em = quando a entrega
    -- aconteceu; registrado_em = agora). As peças, o tempo aberto e o card saem
    -- em AGORA, como sempre — nada fica com intervalo negativo nem fora de ordem.
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados, ocorrido_em)
      values (v_card.id, 'pedido_entregue', p_usuario, p_origem,
              nullif(btrim(p_observacao), ''),
              jsonb_build_object('fonte', p_fonte, 'numero', v_numero,
                                 'situacao_tiny', v_situacao, 'unidades', v_vivas,
                                 'lancado_rotas', v_card.lancado_rotas_em is not null)
                || case when p_ocorrido_em is null then '{}'::jsonb
                        else jsonb_build_object(
                               'dia_escolhido', (p_ocorrido_em at time zone 'America/Fortaleza')::date,
                               'registrado_dia', (now() at time zone 'America/Fortaleza')::date) end,
              coalesce(p_ocorrido_em, now()))
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

comment on function plt_privado.fn_fechar_pedido(bigint, uuid, text, text, text, timestamptz) is
  'SESSAO-30 (D-113) ↪️ SESSAO-47: fecha TUDO do pedido — o fato pedido_entregue (se ainda não há entrega vigente), cada peça viva sai de toda conta (o tempo aberto fecha antes), a peça do estoque reservada sai junto e o card que nunca foi às ROTAS sai do PCP. p_ocorrido_em (padrão nulo = agora) é quando a entrega aconteceu de fato: só o fato da entrega o carrega (com dia_escolhido e registrado_dia na trilha); as consequências nascem agora.';
revoke all on function plt_privado.fn_fechar_pedido(bigint, uuid, text, text, text, timestamptz) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6 · Registrar a entrega — com o dia em que ela aconteceu de fato
-- ----------------------------------------------------------------------------
-- (recriada da 20261022020100_plt_entregue_confirmado_expedicao.sql:29-111: + p_dia — assinatura nova, a de 3 sai; o site
-- publicado chama com os 3 parâmetros de antes e cai nesta, com o dia nulo)
drop function if exists public.plt_fn_registrar_entrega(bigint, text, boolean);
create or replace function public.plt_fn_registrar_entrega(
  p_card_id              bigint,
  p_observacao           text    default null,
  -- SESSAO-38 (↩️ D-156): a pessoa confirmou que entrega mesmo com o pedido
  -- ainda aparecendo em produção na fábrica (o site antigo não manda → falso).
  p_confirmar_incompleto boolean default false,
  -- SESSAO-47: o dia em que a entrega aconteceu de fato (nulo = hoje, como
  -- sempre — o site antigo não manda). Nunca um dia que ainda não chegou,
  -- nunca antes de o pedido chegar à plataforma (o banco confere).
  p_dia                  date    default null
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
  v_hoje     date := (now() at time zone 'America/Fortaleza')::date;
  v_quando   timestamptz;
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
  -- SESSAO-47: o dia escolhido — a regra mora em fn_entrega_instante (nunca
  -- futuro, nunca antes da chegada; dia passado = o fim do expediente dele).
  -- Sem dia, ou hoje: agora, como sempre.
  if p_dia is not null and p_dia <> v_hoje then
    v_quando := plt_privado.fn_entrega_instante(p_dia, v_card.criado_em);
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
                  -- SESSAO-47: pelo REGISTRO (a entrega marcada num dia passado
                  -- tem o ocorrido_em lá atrás)
                  and e.registrado_em > now() - interval '10 minutes') then
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

  -- SESSAO-47: a trilha diz o dia escolhido e o dia em que foi registrado
  if v_quando is not null then
    v_obs := concat_ws(' — ', nullif(btrim(v_obs), ''),
                       format('Marcado como entregue no dia %s (registrado em %s).',
                              to_char(p_dia, 'DD/MM/YYYY'), to_char(v_hoje, 'DD/MM/YYYY')));
  end if;
  v_ret := plt_privado.fn_fechar_pedido(p_card_id, v_usuario, 'interface', v_obs, 'plataforma', v_quando);
  perform plt_privado.fn_tiny_pedido_enfileirar(v_card.pedido_id, 'entregue', 'entregue');
  return (v_ret ->> 'entrega_evento_id')::bigint;
end;
$$;

comment on function public.plt_fn_registrar_entrega(bigint, text, boolean, date) is
  'D-33/D-113 ↪️ SESSAO-47: registra a entrega do pedido inteiro (logística, entregador do caminhão ou admin) e fecha tudo dele; o Tiny recebe a situação Entregue pela fila. p_dia = o dia em que a entrega aconteceu de fato (nulo ou hoje = agora): nunca um dia que ainda não chegou, nunca antes de o pedido chegar à plataforma; dia passado guarda o fim do expediente daquele dia. O mesmo toque repetido (10 min, pela hora do registro) devolve a entrega que já existe. A data não vai ao Tiny.';
revoke all on function public.plt_fn_registrar_entrega(bigint, text, boolean, date) from public, anon;
grant execute on function public.plt_fn_registrar_entrega(bigint, text, boolean, date) to authenticated;

-- ----------------------------------------------------------------------------
-- 7 · Entrega parcial: o toque repetido conta pelo registro (o dia é o do registro)
-- ----------------------------------------------------------------------------
-- (recriada da 20261027040000_plt_rotas_endereco_data_parcial.sql:290-469 — mesma assinatura e retorno)
create or replace function public.plt_fn_entrega_parcial(
  p_card_id              bigint,
  p_entregues            bigint[],
  p_motivo_id            bigint default null,
  p_observacao           text default null,
  p_confirmar_incompleto boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario  uuid;
  v_card     public.plt_cards%rowtype;
  v_numero   integer;
  v_motivo   text;
  v_obs      text;
  v_vivas    bigint[];
  v_entregue bigint[];
  v_voltou   bigint[];
  v_prontas  integer;
  v_entrega  bigint;
  v_dev      bigint;
  v_evento   bigint;
  v_marca_e  text;
  v_marca_d  text;
  v_tempos   integer := 0;
  v_avisados integer;
  r          record;
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
  select p.numero into v_numero from public.pedidos p where p.id = v_card.pedido_id;

  -- Lei §10: o mesmo toque repetido (a rede que volta) = uma entrega só
  if v_card.entrega_evento_id is not null then
    if exists (select 1 from public.plt_eventos e
                where e.id = v_card.entrega_evento_id and e.usuario_id = v_usuario
                  and coalesce((e.dados ->> 'parcial')::boolean, false)
                  -- SESSAO-47: pelo REGISTRO (o administrador pode corrigir o dia depois)
                  and e.registrado_em > now() - interval '10 minutes') then
      return jsonb_build_object('entrega_evento_id', v_card.entrega_evento_id, 'repetido', true);
    end if;
    raise exception 'Este pedido já foi registrado como entregue.' using errcode = 'check_violation';
  end if;
  if v_card.devolucao_evento_id is not null then
    raise exception 'Este pedido está em decisão pós devolução — decida a situação das peças antes de entregar.'
      using errcode = 'check_violation';
  end if;
  if plt_privado.fn_pedido_cancelado(v_card.pedido_id) then
    raise exception 'Este pedido foi cancelado no Tiny — não se entrega.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.plt_cards s where s.reservada_pedido_id = v_card.pedido_id and s.arquivado_em is null) then
    raise exception 'Este pedido leva peça reservada do estoque — a entrega parcial dele é com a logística (use Entregue ou Pedido devolvido).'
      using errcode = 'check_violation';
  end if;

  -- o motivo (da lista) e/ou a observação — pelo menos um dos dois
  if p_motivo_id is not null then
    select m.texto into v_motivo from public.plt_motivos m
     where m.id = p_motivo_id and m.tipo = 'entrega_parcial' and m.ativo;
    if v_motivo is null then
      raise exception 'Esse motivo não vale para entrega parcial.' using errcode = 'check_violation';
    end if;
  end if;
  v_obs := nullif(btrim(coalesce(p_observacao, '')), '');
  if v_motivo is null and v_obs is null then
    raise exception 'Diga por que a entrega foi parcial: escolha um motivo ou escreva uma observação.'
      using errcode = 'check_violation';
  end if;

  -- as peças vivas do pedido (as que estão para entregar)
  select array_agg(u.id order by u.id) into v_vivas
    from public.plt_cards u
   where u.pedido_id = v_card.pedido_id and u.tipo = 'unidade' and u.arquivado_em is null;
  select array_agg(x order by x) into v_entregue
    from unnest(coalesce(p_entregues, '{}'::bigint[])) x where x = any (coalesce(v_vivas, '{}'::bigint[]));
  if v_entregue is null then
    raise exception 'Marque o que foi entregue (para nada entregue, use "Não entregue").' using errcode = 'check_violation';
  end if;
  select array_agg(x order by x) into v_voltou
    from unnest(v_vivas) x where not (x = any (v_entregue));
  if v_voltou is null then
    raise exception 'Todas as peças foram marcadas como entregues — use "Entregue".' using errcode = 'check_violation';
  end if;

  -- a plataforma pode estar atrasada (a peça não foi arrastada): pede a
  -- confirmação, como no "Entregue" (↩️ D-156)
  select count(*)::int into v_prontas
    from public.plt_cards cu
    join public.plt_setores s on s.id = cu.setor_atual_id
   where cu.id = any (v_vivas) and s.papel_no_fluxo = 'terminal' and s.codigo <> 'devolucao';
  if v_prontas < array_length(v_vivas, 1) and not coalesce(p_confirmar_incompleto, false) then
    raise exception 'Este pedido ainda aparece em produção na fábrica (% de % peças prontas). Confirmar a entrega encerra tudo dele.', v_prontas, array_length(v_vivas, 1)
      using errcode = 'check_violation';
  end if;

  select s.id into v_dev from public.plt_setores s where s.codigo = 'devolucao';
  if v_dev is null then
    raise exception 'O lugar "Em decisão pós devolução" não está cadastrado — fale com o admin.' using errcode = 'no_data_found';
  end if;

  v_marca_e := current_setting('plt.entrega_maquinaria', true);
  v_marca_d := current_setting('plt.devolucao_maquinaria', true);
  perform set_config('plt.entrega_maquinaria', 'on', true);
  perform set_config('plt.devolucao_maquinaria', 'on', true);

  -- (1) a entrega — do pedido, marcada PARCIAL (o Tiny não é chamado)
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
    values (v_card.id, 'pedido_entregue', v_usuario, 'interface',
            concat_ws(' — ', 'Entrega parcial: ' || array_length(v_entregue, 1) || ' de ' || array_length(v_vivas, 1) || ' peça(s)',
                      v_motivo, v_obs),
            jsonb_build_object('fonte', 'plataforma', 'numero', v_numero, 'parcial', true,
                               'entregues', to_jsonb(v_entregue), 'voltaram', to_jsonb(v_voltou),
                               'unidades', array_length(v_vivas, 1), 'prontas', v_prontas,
                               'motivo_id', p_motivo_id, 'motivo', v_motivo, 'observacao', v_obs,
                               'lancado_rotas', v_card.lancado_rotas_em is not null))
    returning id into v_entrega;

  -- (2) as peças entregues saem de toda conta — o tempo aberto fecha antes
  for r in select c.id from public.plt_cards c where c.id = any (v_entregue) order by c.id for update
  loop
    if plt_privado.fn_fechar_tempo_aberto(r.id, 'O pedido foi entregue: o tempo aberto fecha antes de a peça sair.') then
      v_tempos := v_tempos + 1;
    end if;
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
      values (r.id, 'card_arquivado', v_usuario, 'interface',
              'Pedido ' || coalesce(v_numero::text, '') || ' entregue em parte — a peça foi entregue.',
              jsonb_build_object('motivo', 'entregue', 'entrega_evento_id', v_entrega,
                                 'parcial', true, 'fonte', 'plataforma', 'numero', v_numero));
  end loop;

  -- (3) as que voltaram: "Em decisão pós devolução" — a logística decide (D-129)
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
    values (v_card.id, 'pedido_devolvido', v_usuario, 'interface',
            'Voltou da entrega parcial' || coalesce(' — ' || v_motivo, '') || coalesce(' — ' || v_obs, ''),
            jsonb_build_object('fonte', 'plataforma', 'numero', v_numero, 'motivo_id', p_motivo_id,
                               'motivo', coalesce(v_motivo, 'Entrega parcial'), 'observacao', v_obs,
                               'entregue', true, 'entrega_evento_id', v_entrega, 'entrega_parcial', true,
                               'pecas', to_jsonb(v_voltou)))
    returning id into v_evento;
  for r in
    select c.id, c.setor_atual_id, c.etapa_atual_id from public.plt_cards c
     where c.id = any (v_voltou) order by c.id for update
  loop
    perform plt_privado.fn_fechar_tempo_aberto(r.id, 'A peça voltou da entrega: o tempo aberto fecha antes.');
    insert into public.plt_eventos
        (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id, setor_destino_id, observacao, dados)
      values (r.id, 'movimentacao_setor', v_usuario, 'interface', r.setor_atual_id, r.etapa_atual_id, v_dev,
              'Voltou da entrega parcial — a peça espera a decisão da logística.',
              jsonb_build_object('motivo', 'devolucao', 'devolucao_evento_id', v_evento, 'entrega_parcial', true));
  end loop;

  perform set_config('plt.entrega_maquinaria', coalesce(v_marca_e, ''), true);
  perform set_config('plt.devolucao_maquinaria', coalesce(v_marca_d, ''), true);

  v_avisados := plt_privado.fn_avisar_logistica(
    v_evento, v_card.id, 'devolucao_decidir',
    'Pedido ' || coalesce(v_numero::text, '') || ' entregue em parte — decidir a situação',
    (select u.nome from public.plt_usuarios u where u.id = v_usuario) || ' entregou o pedido '
      || coalesce(v_numero::text, '') || ' em parte (' || array_length(v_entregue, 1) || ' de '
      || array_length(v_vivas, 1) || ')' || coalesce(' — ' || v_motivo, '') || '. '
      || array_length(v_voltou, 1) || ' peça(s) voltaram e esperam a decisão em Estoque → Em decisão pós devolução.',
    v_usuario);

  return jsonb_build_object('entrega_evento_id', v_entrega, 'devolucao_evento_id', v_evento,
                            'entregues', array_length(v_entregue, 1), 'voltaram', array_length(v_voltou, 1),
                            'tempos_fechados', v_tempos, 'avisados', v_avisados);
end;
$$;

-- ----------------------------------------------------------------------------
-- 8 · Desfazer e reabrir: "do dia" é o dia em que a entrega foi REGISTRADA
-- ----------------------------------------------------------------------------
-- (recriada da 20261104010000_plt_itens_novos_reabrir_entrega.sql:488-573 — mesma assinatura e retorno)
create or replace function plt_privado.fn_reabrir_entrega(
  p_card_id bigint, p_usuario uuid, p_origem text, p_observacao text, p_dados jsonb,
  p_voltar_estoque boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card       public.plt_cards%rowtype;
  v_entrega    public.plt_eventos%rowtype;
  v_desfeita   bigint;
  v_marca_e    text;
  v_marca_m    text;
  v_voltaram   integer := 0;
  v_reservadas integer := 0;
  v_ficaram    integer := 0;
  r            record;
begin
  select * into v_card from public.plt_cards where id = p_card_id and tipo = 'pedido' for update;
  if not found or v_card.entrega_evento_id is null then
    return jsonb_build_object('reabriu', false, 'motivo', 'nao_entregue');
  end if;
  select * into v_entrega from public.plt_eventos where id = v_card.entrega_evento_id;

  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
    values (v_card.id, 'entrega_desfeita', p_usuario, p_origem, nullif(btrim(p_observacao), ''),
            coalesce(p_dados, '{}'::jsonb) || jsonb_build_object('entrega_evento_id', v_entrega.id))
    returning id into v_desfeita;

  v_marca_e := current_setting('plt.entrega_maquinaria', true);
  v_marca_m := current_setting('plt.estoque_maquinaria', true);
  perform set_config('plt.entrega_maquinaria', 'on', true);
  perform set_config('plt.estoque_maquinaria', 'on', true);

  -- As peças que saíram com ESTA entrega (o arquivar nasce na mesma transação
  -- da entrega: o índice por tipo e hora acha só elas).
  -- SESSAO-47: a hora é a do REGISTRO da entrega — as peças saem em "agora"
  -- mesmo quando a entrega foi marcada num dia passado.
  for r in
    select distinct on (c.id) c.id, c.setor_atual_id, c.etapa_atual_id, c.pedido_id as dono, a.dados as arq
      from public.plt_eventos a
      join public.plt_cards c on c.id = a.card_id
     where a.tipo = 'card_arquivado'
       and a.ocorrido_em between v_entrega.registrado_em - interval '1 minute'
                             and v_entrega.registrado_em + interval '10 minutes'
       and (a.dados ->> 'entrega_evento_id')::bigint = v_entrega.id
       and c.arquivado_em is not null
     order by c.id, a.id desc
  loop
    if r.dono is null and r.arq ->> 'motivo' = 'venda' and not p_voltar_estoque then
      v_ficaram := v_ficaram + 1;
      continue;
    end if;
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id, observacao, dados)
      values (r.id, 'card_desarquivado', p_usuario, p_origem, r.setor_atual_id, r.etapa_atual_id,
              'A entrega foi reaberta — a peça voltou.',
              jsonb_build_object('motivo', 'entrega_desfeita', 'entrega_evento_id', v_entrega.id));
    v_voltaram := v_voltaram + 1;

    -- A peça do estoque volta reservada ao mesmo pedido e à mesma vaga.
    if r.dono is null and r.arq ->> 'motivo' = 'venda'
       and nullif(r.arq ->> 'pedido_id', '') is not null
       and exists (select 1 from public.plt_cards c
                     join public.plt_setores s on s.id = c.setor_atual_id and s.codigo = 'estoque'
                    where c.id = r.id and c.reservada_pedido_id is null) then
      insert into public.plt_eventos (card_id, tipo, origem, setor_origem_id, observacao, dados)
        values (r.id, 'peca_reservada', 'automacao', r.setor_atual_id,
                format('A entrega do pedido %s foi reaberta — a peça volta reservada para ele.',
                       r.arq ->> 'numero'),
                jsonb_build_object('pedido_id', (r.arq ->> 'pedido_id')::bigint,
                                   'numero', (r.arq ->> 'numero')::int,
                                   'card_pedido_id', v_card.id,
                                   'item_seq', (r.arq ->> 'item_seq')::int,
                                   'indice_unidade', (r.arq ->> 'indice_unidade')::int,
                                   'produto_tiny_id', (r.arq ->> 'produto_tiny_id')::bigint,
                                   'reaberta', true));
      v_reservadas := v_reservadas + 1;
    end if;
  end loop;

  perform set_config('plt.entrega_maquinaria', coalesce(v_marca_e, ''), true);
  perform set_config('plt.estoque_maquinaria', coalesce(v_marca_m, ''), true);
  return jsonb_build_object('reabriu', true, 'evento_id', v_desfeita, 'entrega_evento_id', v_entrega.id,
                            'pecas_voltaram', v_voltaram, 'pecas_reservadas', v_reservadas,
                            'pecas_do_estoque_ficaram', v_ficaram);
end;
$$;

-- (recriada da 20261104010000_plt_itens_novos_reabrir_entrega.sql:581-681 — mesma assinatura e retorno)
create or replace function public.plt_fn_entrega_desfazer(p_card_id bigint, p_motivo_id bigint, p_observacao text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario  uuid;
  v_admin    boolean;
  v_card     public.plt_cards%rowtype;
  v_entrega  public.plt_eventos%rowtype;
  v_motivo   text;
  v_numero   integer;
  v_situacao text;
  v_anterior text;
  v_antes    text;
  v_enviar   boolean;
  v_reabriu  jsonb;
  v_tiny     text := 'nao_enviado';
begin
  v_usuario := plt_privado.fn_usuario_atual();
  v_admin := plt_privado.fn_eh_admin();
  if v_usuario is null or not (v_admin or plt_privado.fn_pode_mexer_entrega(p_card_id)) then
    raise exception 'Desfazer a entrega é gesto do entregador do caminhão, da logística ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;
  select m.texto into v_motivo from public.plt_motivos m
   where m.id = p_motivo_id and m.tipo = 'desfazer_entrega' and m.ativo;
  if v_motivo is null then
    raise exception 'Escolha o motivo de desfazer a entrega.' using errcode = 'check_violation';
  end if;
  select * into v_card from public.plt_cards where id = p_card_id and tipo = 'pedido' for update;
  if not found or v_card.entrega_evento_id is null then
    raise exception 'Este pedido não está entregue.' using errcode = 'check_violation';
  end if;
  select * into v_entrega from public.plt_eventos where id = v_card.entrega_evento_id;
  -- SESSAO-41 (D-195): a parcial já mandou as peças que voltaram para a logística
  if coalesce((v_entrega.dados ->> 'parcial')::boolean, false) then
    raise exception 'A entrega parcial não se desfaz por aqui — as peças que voltaram já estão com a logística (Decidir situação).'
      using errcode = 'check_violation';
  end if;
  -- E-89: o desfazer do dia é da entrega feita por gente aqui, no mesmo dia.
  -- SESSAO-44 (frente 4): o administrador reabre qualquer dia e a do Tiny.
  -- SESSAO-47: "do dia" = o dia em que a entrega foi REGISTRADA (não o dia
  -- escolhido): quem marcou hoje "entregue ontem" ainda desfaz hoje.
  if not v_admin then
    if v_entrega.usuario_id is null then
      raise exception 'Esta entrega veio do Tiny — só um administrador pode reabrir.' using errcode = 'check_violation';
    end if;
    if (v_entrega.registrado_em at time zone 'America/Fortaleza')::date
       <> (now() at time zone 'America/Fortaleza')::date then
      raise exception 'Só dá para desfazer a entrega no mesmo dia em que ela foi registrada — depois disso, só um administrador pode reabrir.'
        using errcode = 'check_violation';
    end if;
  end if;

  -- A situação para devolver ao Tiny: a de antes da entrega. A entrega do Tiny
  -- guardou o próprio "Entregue" — a de antes sai do registro dos avisos dele.
  select p.numero, p.situacao into v_numero, v_situacao from public.pedidos p where p.id = v_card.pedido_id;
  if v_entrega.usuario_id is null then
    select e.situacao into v_anterior
      from public.eventos e
     where e.numero = v_numero and e.recebido_em <= v_entrega.registrado_em
       and plt_privado.fn_situacao_normalizada(e.situacao) not in ('entregue', 'cancelado')
     order by e.recebido_em desc, e.id desc
     limit 1;
  else
    v_anterior := v_entrega.dados ->> 'situacao_tiny';
  end if;
  v_antes := plt_privado.fn_tiny_situacao_api(coalesce(v_anterior, 'entregue'));
  -- SESSAO-44: o Tiny só recebe a volta se ainda estiver "Entregue". A entrega
  -- feita aqui mandou o "Entregue" pela fila e o aviso de volta do Tiny pode
  -- não ter chegado: a situação de antes da entrega (ou a fila ainda por
  -- enviar) também conta como "ainda Entregue". Se o Tiny foi para outra
  -- situação, nada vai.
  v_enviar := plt_privado.fn_situacao_normalizada(v_situacao) = 'entregue'
              or (v_entrega.usuario_id is not null
                  and plt_privado.fn_situacao_normalizada(v_situacao)
                      is not distinct from plt_privado.fn_situacao_normalizada(v_entrega.dados ->> 'situacao_tiny'))
              or exists (select 1 from public.plt_tiny_pedido_fila f
                          where f.pedido_id = v_card.pedido_id
                            and f.atualizado_em > coalesce(f.enviado_em, '-infinity'::timestamptz)
                            and f.parado_em is null);

  v_reabriu := plt_privado.fn_reabrir_entrega(
    v_card.id, v_usuario, 'interface',
    v_motivo || coalesce(' — ' || nullif(btrim(p_observacao), ''), ''),
    jsonb_build_object('motivo_id', p_motivo_id, 'motivo', v_motivo,
                       'situacao_tiny_volta', case when v_enviar then v_antes end,
                       'reabertura', case when v_entrega.usuario_id is null
                                            or (v_entrega.registrado_em at time zone 'America/Fortaleza')::date
                                               <> (now() at time zone 'America/Fortaleza')::date
                                          then 'admin' end),
    true);

  if v_enviar then
    v_tiny := plt_privado.fn_tiny_pedido_enfileirar(v_card.pedido_id, v_antes, 'desfeita');
  end if;
  return jsonb_build_object('desfeita', true, 'pecas_voltaram', v_reabriu -> 'pecas_voltaram',
                            'pecas_reservadas', v_reabriu -> 'pecas_reservadas',
                            'tiny', v_tiny, 'situacao_tiny', case when v_enviar then v_antes end);
end;
$$;

-- ----------------------------------------------------------------------------
-- 9 · Corrigir o dia depois de registrada — só o administrador, por fato novo
-- ----------------------------------------------------------------------------
-- A entrega não se edita (RNF-05): a correção é o fato entrega_dia_corrigido no
-- card do pedido, apontando a entrega vigente, com o dia de antes e o novo. O
-- fato da correção acontece AGORA (ocorrido_em); o instante novo da entrega vai
-- em dados.entregue_em e a projeção o leva ao card. A mesma regra de dia do
-- registrar (fn_entrega_instante). O mesmo dia de novo = nada (idempotente).
-- O motivo é opcional. Todo fato gera log (gatilho plt_eventos_logar — D-40).
create or replace function public.plt_fn_entrega_corrigir_dia(
  p_card_id bigint,
  p_dia     date,
  p_motivo  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
  v_card    public.plt_cards%rowtype;
  v_entrega public.plt_eventos%rowtype;
  v_numero  integer;
  v_antes   date;
  v_quando  timestamptz;
  v_motivo  text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_evento  bigint;
  v_marca   text;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null or not plt_privado.fn_eh_admin() then
    raise exception 'Alterar a data da entrega é gesto do administrador.' using errcode = 'insufficient_privilege';
  end if;
  if char_length(coalesce(v_motivo, '')) > 300 then
    raise exception 'O motivo ficou comprido demais — resuma em até 300 letras.' using errcode = 'check_violation';
  end if;
  select * into v_card from public.plt_cards where id = p_card_id and tipo = 'pedido' for update;
  if not found or v_card.entrega_evento_id is null then
    raise exception 'Este pedido não está entregue — não há data de entrega para alterar.' using errcode = 'check_violation';
  end if;
  select * into v_entrega from public.plt_eventos where id = v_card.entrega_evento_id;
  select p.numero into v_numero from public.pedidos p where p.id = v_card.pedido_id;

  -- a regra do dia (nunca futuro, nunca antes da chegada) e o instante novo
  v_quando := plt_privado.fn_entrega_instante(p_dia, v_card.criado_em);
  v_antes := plt_privado.fn_dia_da_entrega(coalesce(v_card.entrega_em, v_entrega.ocorrido_em));
  if p_dia = v_antes then
    return jsonb_build_object('mudou', false, 'dia', v_antes, 'entregue_em', v_card.entrega_em);
  end if;

  v_marca := current_setting('plt.entrega_maquinaria', true);
  perform set_config('plt.entrega_maquinaria', 'on', true);
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, evento_referencia_id, observacao, dados)
    values (v_card.id, 'entrega_dia_corrigido', v_usuario, 'interface', v_entrega.id,
            format('Dia da entrega corrigido de %s para %s.', to_char(v_antes, 'DD/MM/YYYY'), to_char(p_dia, 'DD/MM/YYYY'))
              || coalesce(' Motivo: ' || v_motivo, ''),
            jsonb_build_object('antes', v_antes, 'depois', p_dia, 'entregue_em', v_quando,
                               'motivo', v_motivo, 'numero', v_numero, 'entrega_evento_id', v_entrega.id))
    returning id into v_evento;
  perform set_config('plt.entrega_maquinaria', coalesce(v_marca, ''), true);

  -- ao vivo: o fato num card de pedido já avisa o PCP e os painéis; as rotas
  -- (entregas do dia, calendário) ouvem o canal delas
  perform plt_privado.fn_avisar('rotas');

  return jsonb_build_object('mudou', true, 'evento_id', v_evento, 'antes', v_antes, 'dia', p_dia,
                            'entregue_em', v_quando);
end;
$$;

comment on function public.plt_fn_entrega_corrigir_dia(bigint, date, text) is
  'SESSAO-47: o administrador corrige o DIA em que a entrega aconteceu de fato, na ficha do pedido — por fato novo (entrega_dia_corrigido, com o dia de antes e o novo; a entrega não se edita). Nunca um dia que ainda não chegou, nunca antes de o pedido chegar à plataforma. O mesmo dia de novo não faz nada. O motivo é opcional. O Tiny não muda.';

revoke all on function public.plt_fn_entrega_corrigir_dia(bigint, date, text) from public, anon;
grant execute on function public.plt_fn_entrega_corrigir_dia(bigint, date, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 10 · Os leitores: todos pela mesma data (a projeção do card)
-- ----------------------------------------------------------------------------
-- 10.1 · Pedidos → a lista (recriada da 20261027040000_plt_rotas_endereco_data_parcial.sql:1543-1726 — mesma assinatura e retorno)
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
    select p.id, p.numero, p.cliente_id, p.data_pedido, plt_privado.fn_data_entrega(p.id, p.data_prevista) as data_prevista, p.situacao,
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
           -- ↪️ SESSAO-47: … a não ser que a logística o tenha devolvido ao PCP
           when plt_privado.fn_fora_do_pcp(nu.situacao, pc.volta_pcp_em) then 'tiny'
           else 'pcp'
         end                                     as situacao_plataforma,
         -- SESSAO-47: o dia REAL da entrega (a projeção do card)
         pc.entrega_em                           as entregue_em,
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

-- 10.2 · A ficha do pedido (recriada da 20261027040000_plt_rotas_endereco_data_parcial.sql:1950-2120 — o jsonb só ganha chaves)
CREATE OR REPLACE FUNCTION public.plt_fn_pcp_pedido_detalhe(p_pedido_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_p    public.pedidos%rowtype;
  v_c    public.clientes%rowtype;
  v_card public.plt_cards%rowtype;
  v_ent  public.plt_eventos%rowtype;
  v_prog public.plt_programacoes%rowtype;
  v_sit  text;
  v_tot  integer;
  v_lib  integer;
  v_pro  integer;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'O detalhe do pedido é da logística (PCP/terminais) ou de admin.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_p from public.pedidos where id = p_pedido_id;
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'no_data_found';
  end if;
  select * into v_c from public.clientes where id = v_p.cliente_id;
  select * into v_card from public.plt_cards where pedido_id = v_p.id and tipo = 'pedido';
  if v_card.entrega_evento_id is not null then
    select * into v_ent from public.plt_eventos where id = v_card.entrega_evento_id;
  end if;
  if v_card.id is not null then
    select * into v_prog from public.plt_programacoes where card_id = v_card.id;
  end if;

  -- A situação na plataforma — a mesma regra de "Todos os pedidos".
  select coalesce(sum(v.unidades), 0)::int into v_tot
    from plt_privado.vw_itens_producao v where v.pedido_id = v_p.id;
  select count(*)::int, count(*) filter (where s.papel_no_fluxo = 'terminal' or u.concluido_em is not null)::int
    into v_lib, v_pro
    from public.plt_cards u
    left join public.plt_setores s on s.id = u.setor_atual_id
   where u.pedido_id = v_p.id and u.tipo = 'unidade' and u.arquivado_em is null;
  v_sit := case
             when v_card.id is null then 'sem_card'
             when v_card.devolucao_evento_id is not null then 'devolvido'  -- SESSAO-31 (D-129)
             when v_card.entrega_evento_id is not null then 'entregue'
             when v_card.arquivado_em is not null then 'arquivado'
             when v_card.lancado_rotas_em is not null then 'em_rota'
             when v_tot > 0 and v_pro >= v_tot then 'aguardo'
             when v_lib > 0 then 'producao'
             else 'pcp'
           end;

  return jsonb_build_object(
    -- SESSAO-31 (D-129): a devolução em decisão (o resto vem da porta da decisão).
    'devolucao', case when v_card.devolucao_evento_id is not null then (
      select jsonb_build_object('evento_id', d.id, 'quando', d.ocorrido_em,
               'quem', (select u.nome from public.plt_usuarios u where u.id = d.usuario_id),
               'motivo', d.dados ->> 'motivo', 'observacao', d.dados ->> 'observacao',
               'entregue', coalesce((d.dados ->> 'entregue')::boolean, false))
        from public.plt_eventos d where d.id = v_card.devolucao_evento_id) end,
    'pedido', jsonb_build_object(
      'id', v_p.id, 'numero', v_p.numero, 'situacao', v_p.situacao, 'origem', v_p.origem,
      'data_pedido', v_p.data_pedido, 'data_prevista', plt_privado.fn_data_entrega(v_p.id, v_p.data_prevista),
      -- SESSAO-41 (D-194): a data do Tiny e se a da plataforma está valendo
      'data_prevista_tiny', v_p.data_prevista,
      'data_alterada', plt_privado.fn_data_entrega(v_p.id, v_p.data_prevista) is distinct from v_p.data_prevista,
      'data_faturamento', nullif(v_p.raw ->> 'data_faturamento', ''),
      'data_envio', nullif(v_p.raw ->> 'data_envio', ''),
      'data_entrega_tiny', nullif(v_p.raw ->> 'data_entrega', ''),
      'total_produtos', v_p.total_produtos, 'valor_frete', v_p.valor_frete,
      'valor_desconto', nullif(v_p.raw ->> 'valor_desconto', ''),
      'outras_despesas', nullif(v_p.raw ->> 'outras_despesas', ''),
      'total_pedido', v_p.total_pedido,
      'forma_pagamento', v_p.forma_pagamento, 'meio_pagamento', v_p.meio_pagamento,
      'condicao_pagamento', nullif(v_p.raw ->> 'condicao_pagamento', ''),
      'qtd_parcelas', v_p.qtd_parcelas,
      'parcelas', coalesce((select jsonb_agg(jsonb_build_object(
                     'data', nullif(x -> 'parcela' ->> 'data', ''), 'dias', nullif(x -> 'parcela' ->> 'dias', ''),
                     'valor', nullif(x -> 'parcela' ->> 'valor', ''),
                     'forma', nullif(x -> 'parcela' ->> 'forma_pagamento', ''),
                     'meio', nullif(x -> 'parcela' ->> 'meio_pagamento', ''),
                     'obs', nullif(x -> 'parcela' ->> 'obs', '')) order by o)
                   from jsonb_array_elements(case when jsonb_typeof(v_p.parcelas) = 'array' then v_p.parcelas else '[]'::jsonb end)
                        with ordinality as t(x, o)), '[]'::jsonb),
      'obs', v_p.obs, 'obs_interna', v_p.obs_interna, 'marcadores', to_jsonb(coalesce(v_p.marcadores, '{}'::text[])),
      'vendedor', v_p.vendedor, 'ecommerce', v_p.ecommerce, 'numero_ecommerce', nullif(v_p.raw ->> 'numero_ecommerce', ''),
      'forma_envio', v_p.forma_envio, 'forma_frete', nullif(v_p.raw ->> 'forma_frete', ''),
      'transportador', nullif(v_p.raw ->> 'nome_transportador', ''),
      'codigo_rastreamento', v_p.codigo_rastreamento, 'url_rastreamento', v_p.url_rastreamento,
      'atualizado_em', v_p.atualizado_em),
    'cliente', jsonb_build_object(
      'nome', v_c.nome, 'fone', v_c.fone, 'email', v_c.email, 'documento', v_c.cpf_cnpj,
      'endereco', v_c.endereco, 'numero', v_c.numero, 'complemento', v_c.complemento,
      'bairro', v_c.bairro, 'cidade', v_c.cidade, 'uf', v_c.uf, 'cep', v_c.cep),
    -- SESSAO-41 (D-193): ONDE ENTREGAR (o endereço de entrega do Tiny, quando há)
    'endereco_entrega', (select to_jsonb(ee) - 'pedido_id' from plt_privado.vw_endereco_entrega ee
                          where ee.pedido_id = v_p.id),
    'plataforma', jsonb_build_object(
      'card_id', v_card.id, 'situacao', v_sit, 'total_unidades', v_tot,
      'lancado_rotas_em', v_card.lancado_rotas_em, 'arquivado_em', v_card.arquivado_em,
      'liberado_completo_em', v_card.liberado_completo_em,
      -- SESSAO-47: quando o pedido chegou à plataforma (o limite do dia da entrega)
      'chegou_em', v_card.criado_em),
    'programacao', case when v_prog.id is null then null else jsonb_build_object(
      'data', v_prog.data_entrega, 'rota', v_prog.rota, 'ordem', v_prog.ordem, 'detalhe', v_prog.detalhe,
      'caminhao', (select cam.nome || coalesce(' · ' || cam.placa, '') from public.plt_caminhoes cam where cam.id = v_prog.caminhao_id),
      'equipe', coalesce((select jsonb_agg(u.nome order by u.nome)
                            from public.plt_programacao_equipes eq join public.plt_usuarios u on u.id = eq.usuario_id
                           where eq.data_entrega = v_prog.data_entrega and eq.caminhao_id = v_prog.caminhao_id
                             and eq.rota = v_prog.rota), '[]'::jsonb)) end,
    'entrega', case when v_ent.id is null then null else jsonb_build_object(
      -- SESSAO-47: "em" = o dia REAL da entrega (a projeção do card — com a
      -- correção do administrador, se houve); "registrada_em" = quando ela foi
      -- registrada (o desfazer do dia conta por aqui)
      'em', v_card.entrega_em, 'por', (select u.nome from public.plt_usuarios u where u.id = v_ent.usuario_id),
      'registrada_em', v_ent.registrado_em,
      'correcao', (select jsonb_build_object(
                            'em', k.ocorrido_em,
                            'por', (select u.nome from public.plt_usuarios u where u.id = k.usuario_id),
                            'antes', k.dados ->> 'antes', 'depois', k.dados ->> 'depois',
                            'motivo', k.dados ->> 'motivo')
                     from public.plt_eventos k
                    where k.evento_referencia_id = v_ent.id and k.tipo = 'entrega_dia_corrigido'
                    order by k.id desc
                    limit 1),
      'por_gente', v_ent.usuario_id is not null, 'observacao', v_ent.observacao,
      'fonte', coalesce(v_ent.dados ->> 'fonte', case when v_ent.usuario_id is null then 'tiny' else 'plataforma' end),
      -- SESSAO-41 (D-195): a entrega parcial
      'parcial', coalesce((v_ent.dados ->> 'parcial')::boolean, false),
      'pecas_entregues', jsonb_array_length(coalesce(v_ent.dados -> 'entregues', '[]'::jsonb)),
      'pecas_voltaram', jsonb_array_length(coalesce(v_ent.dados -> 'voltaram', '[]'::jsonb))) end,
    'itens', coalesce((select jsonb_agg(jsonb_build_object(
                'seq', i.seq, 'codigo', i.codigo, 'descricao', i.descricao, 'unidade', i.unidade,
                'quantidade', i.quantidade, 'valor_unitario', i.valor_unitario,
                'valor_total', round(coalesce(i.quantidade, 0) * coalesce(i.valor_unitario, 0), 2),
                'unidades_producao', coalesce(v.unidades, 0), 'eh_frete', coalesce(v.eh_frete, false)) order by i.seq)
              from public.pedido_itens i
              left join plt_privado.vw_itens_producao v on v.pedido_id = i.pedido_id and v.seq = i.seq
             where i.pedido_id = v_p.id), '[]'::jsonb),
    'unidades', coalesce((select jsonb_agg(jsonb_build_object(
                'card_id', u.id, 'descricao', u.item_descricao, 'indice', u.indice_unidade, 'total', u.total_unidades,
                'setor', s.nome, 'etapa', e.nome, 'desde', u.desde, 'concluido_em', u.concluido_em,
                'qualidade', u.qualidade_atual, 'arquivado_em', u.arquivado_em,
                'motivo_saida', (select a.dados ->> 'motivo' from public.plt_eventos a
                                  where a.card_id = u.id and a.tipo = 'card_arquivado' order by a.id desc limit 1))
                order by u.item_seq, u.indice_unidade)
              from public.plt_cards u
              left join public.plt_setores s on s.id = u.setor_atual_id
              left join public.plt_etapas e on e.id = u.etapa_atual_id
             where u.tipo = 'unidade' and u.pedido_id = v_p.id), '[]'::jsonb),
    'contas_receber', coalesce((select jsonb_agg(jsonb_build_object(
                'vencimento', cr.data_vencimento, 'valor', cr.valor, 'saldo', cr.saldo, 'situacao', cr.situacao,
                'liquidacao', cr.data_liquidacao, 'forma', cr.forma_recebimento, 'meio', cr.meio_recebimento,
                'historico', cr.historico) order by cr.data_vencimento)
              from public.contas_receber cr where cr.pedido_id = v_p.id), '[]'::jsonb),
    -- ↪️ D-122: "conferidas em" = a última busca das contas no Tiny (a conferência
    -- diária; antes dela, a carga do histórico) — pelo índice da fila (recurso,
    -- chave): a 1ª página da busca, uma linha; só sem ela (antes da 1ª rodada ou
    -- no meio de uma) as poucas linhas da busca — nunca a tabela de contas (Lei §6)
    'contas_receber_ate', coalesce(
       (select f.processado_em from public.tiny_fila f
         where f.recurso = 'cr_pesquisa' and f.chave = 'pente-fino-cr:p1' and f.status = 'ok'),
       (select max(f.processado_em) from public.tiny_fila f
         where f.recurso = 'cr_pesquisa' and f.status = 'ok')),
    'notas_fiscais', coalesce((select jsonb_agg(jsonb_build_object(
                'numero', nf.numero, 'serie', nf.serie, 'emissao', nf.data_emissao,
                'situacao', coalesce(nf.descricao_situacao, nf.situacao), 'valor', nf.valor_nota) order by nf.data_emissao)
              from public.notas_fiscais nf where nf.pedido_id = v_p.id), '[]'::jsonb),
    'anexos', case when v_card.id is null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object(
                'id', a.id, 'tipo', a.tipo, 'nome', a.nome_arquivo, 'mime', a.mime, 'tamanho', a.tamanho,
                'caminho', a.caminho, 'por', u.nome, 'em', a.enviado_em) order by a.enviado_em desc)
              from public.plt_anexos a left join public.plt_usuarios u on u.id = a.enviado_por
             where a.card_id = v_card.id and a.removido_em is null), '[]'::jsonb) end,
    'historico', case when v_card.id is null then '[]'::jsonb else coalesce((select jsonb_agg(h order by (h ->> 'id')::bigint desc) from (
                select jsonb_build_object(
                  'id', ev.id, 'tipo', ev.tipo, 'em', ev.ocorrido_em, 'por', u.nome, 'origem', ev.origem,
                  -- SESSAO-47: quando o fato foi gravado (a entrega marcada num dia passado)
                  'registrado_em', ev.registrado_em,
                  'observacao', ev.observacao, 'motivo', ev.dados ->> 'motivo',
                  'setor', (select s.nome from public.plt_setores s where s.id = ev.setor_destino_id)) as h
                  from public.plt_eventos ev
                  left join public.plt_usuarios u on u.id = ev.usuario_id
                 where ev.card_id = v_card.id
                 order by ev.id desc
                 limit 80) z), '[]'::jsonb) end
  );
end;
$function$;

-- 10.3 · ROTAS → Entregas (recriada da 20261106030000_plt_numeros_que_batem.sql:56-154 — mesma assinatura e retorno)
CREATE OR REPLACE FUNCTION public.plt_fn_rotas(p_situacao text DEFAULT NULL::text, p_busca text DEFAULT NULL::text, p_limite integer DEFAULT 20, p_deslocamento integer DEFAULT 0)
 RETURNS TABLE(card_id bigint, pedido_id bigint, numero integer, cliente_nome text, telefone text, endereco text, numero_endereco text, complemento text, bairro text, cidade text, uf text, obs text, data_prevista date, total_unidades integer, unidades_em_rotas integer, situacao_entrega text, entregue_em timestamp with time zone, entregue_por text, lancado_em timestamp with time zone, programacao_data date, caminhao_id bigint, caminhao_nome text, caminhao_placa text, caminhao_foto text, estado text, unidades_prontas integer, unidades_liberadas integer, contagem_total bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with rotas as (
    select s.id from public.plt_setores s where s.codigo = 'rotas'
  ),
  base as (
    select pc.id                        as card_id,
           p.id                         as pedido_id,
           p.numero,
           coalesce(c.nome, '')         as cliente_nome,
           c.fone                       as telefone,
           ee.endereco,
           ee.numero                     as numero_endereco,
           ee.complemento,
           ee.bairro,
           ee.cidade,
           ee.uf,
           p.obs,
           plt_privado.fn_data_entrega(p.id, p.data_prevista) as data_prevista,
           coalesce(pp.total_unidades, 0) as total_unidades,
           coalesce(u.em_rotas, 0)       as unidades_em_rotas,
           -- SESSAO-47: o dia REAL da entrega (a projeção do card)
           pc.entrega_em                 as entregue_em,
           ent_nome.nome                 as entregue_por,
           pc.lancado_rotas_em           as lancado_em,
           pr.data_entrega               as programacao_data,
           cam.id                        as caminhao_id,
           cam.nome                      as caminhao_nome,
           cam.placa                     as caminhao_placa,
           cam.foto_caminho              as caminhao_foto,
           pp.estado,
           coalesce(pp.unidades_prontas, 0)   as unidades_prontas,
           coalesce(pp.unidades_liberadas, 0) as unidades_liberadas
      from public.plt_cards pc
      join public.pedidos p on p.id = pc.pedido_id
      left join public.clientes c on c.id = p.cliente_id
      left join plt_privado.vw_endereco_entrega ee on ee.pedido_id = p.id
      left join plt_privado.vw_pedido_prontidao pp on pp.card_id = pc.id
      left join plt_privado.vw_pedidos_para_rota cand on cand.card_id = pc.id
      left join lateral (
        select count(*)::int as em_rotas
          from public.plt_cards cu
         where cu.pedido_id = p.id and cu.tipo = 'unidade'
           and cu.arquivado_em is null
           and cu.setor_atual_id in (select id from rotas)
      ) u on true
      left join lateral (
        select e.ocorrido_em, e.usuario_id
          from public.plt_eventos e
         where e.id = pc.entrega_evento_id
         order by e.ocorrido_em desc limit 1
      ) ent on true
      left join public.plt_usuarios ent_nome on ent_nome.id = ent.usuario_id
      left join public.plt_programacoes pr on pr.card_id = pc.id
      left join public.plt_caminhoes cam on cam.id = pr.caminhao_id
     where pc.tipo = 'pedido' and pc.arquivado_em is null
       -- só a situação pedida (o entregue não varre o "a entregar" e vice-versa)
       and (p_situacao is null
            or (p_situacao = 'entregue') = (pc.entrega_evento_id is not null))
       -- D-45 (o lançado) + SESSAO-38 (D-156): o programado e o candidato pronto
       and (pc.lancado_rotas_em is not null
            or pr.card_id is not null
            or (cand.card_id is not null and cand.pronto))
       -- ↪️ 06/11/2026 (D-267): o "a entregar" é de pedido que ainda existe no
       -- Tiny — o cancelado (ou excluído) lá sai daqui na hora, mesmo lançado ou
       -- programado (a entrega dele é recusada; a Programação e a Expedição já
       -- o tiram pela regra do vivo). O que já foi entregue fica no histórico.
       -- (o "começa com canc" na frente poupa a função por linha — E-166)
       and (pc.entrega_evento_id is not null
            or (not (lower(coalesce(p.situacao, '')) like 'canc%'
                     and plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado')
                and not exists (select 1 from public.plt_pedidos_excluidos_tiny x
                                 where x.pedido_id = p.id)))
  )
  select b.card_id, b.pedido_id, b.numero, b.cliente_nome, b.telefone,
         b.endereco, b.numero_endereco, b.complemento, b.bairro, b.cidade, b.uf,
         b.obs, b.data_prevista, b.total_unidades, b.unidades_em_rotas,
         case when b.entregue_em is not null then 'entregue' else 'pronta' end as situacao_entrega,
         b.entregue_em, b.entregue_por, b.lancado_em,
         b.programacao_data, b.caminhao_id, b.caminhao_nome, b.caminhao_placa, b.caminhao_foto,
         case when b.entregue_em is not null then 'entregue' else b.estado end as estado,
         b.unidades_prontas, b.unidades_liberadas,
         count(*) over () as contagem_total
    from base b
   where plt_privado.fn_pode_ver_expedicao()
     and (p_situacao is null
          or (case when b.entregue_em is not null then 'entregue' else 'pronta' end) = p_situacao)
     and (p_busca is null or btrim(p_busca) = ''
          or b.numero::text like btrim(p_busca) || '%'
          or b.cliente_nome ilike '%' || btrim(p_busca) || '%')
   order by (b.entregue_em is not null),
            coalesce(b.programacao_data, b.data_prevista) asc nulls last,
            b.numero
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$function$;

-- 10.4 · Já programadas (recriada da 20261105020000_plt_rotas_ponto_aproximado.sql:109-236 — mesma assinatura e retorno)
CREATE OR REPLACE FUNCTION public.plt_fn_programadas(p_entregues boolean DEFAULT false, p_data date DEFAULT NULL::date, p_caminhao_id bigint DEFAULT NULL::bigint, p_limite integer DEFAULT 50, p_deslocamento integer DEFAULT 0, p_busca text DEFAULT NULL::text)
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
           -- SESSAO-47: o dia REAL da entrega (a projeção do card)
           pc.entrega_em                 as entregue_em,
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

-- 10.5 · Entregas do dia (recriada da 20261105010000_plt_rotas_mapa_expedicao_pcp.sql:227-350 — o jsonb só ganha chaves)
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

-- 10.6 · O calendário das rotas (recriada da 20261106030000_plt_numeros_que_batem.sql:648-805 — o jsonb só ganha chaves)
CREATE OR REPLACE FUNCTION public.plt_fn_rotas_calendario(p_de date, p_ate date, p_por_dia integer DEFAULT 30, p_deslocamento integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
 -- ↪️ SESSAO-47: o plano SEMPRE sob medida para o período pedido. Sem isto, da 6ª
 -- chamada em diante na mesma conexão o plpgsql passa a usar o plano genérico
 -- (que não sabe o período) e a porta sai de ~1 s para dezenas de segundos com
 -- o volume ×100 (achado no ajuste de 06/11; já era assim antes desta sessão).
 SET plan_cache_mode TO 'force_custom_plan'
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
       and v.pedido_id in (select px.id from public.pedidos px where px.data_prevista between p_de and p_ate
                           union all select d.pedido_id from public.plt_pedido_datas d)
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

-- 10.7 · O painel de motivos (recriada da 20261106030000_plt_numeros_que_batem.sql:437-643 — mesma assinatura e retorno)
create or replace function public.plt_fn_dash_motivos(
  p_de       timestamptz,
  p_ate      timestamptz,
  p_setor_id bigint default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  a           record;
  v_producao  jsonb := null;
  v_pcp       jsonb := null;
  v_rotas     jsonb := null;
  v_qualidade jsonb := null;
begin
  if p_de is null or p_ate is null or p_ate <= p_de then
    raise exception 'Diga o período do painel.' using errcode = 'check_violation';
  end if;
  if p_ate - p_de > interval '400 days' then
    raise exception 'O painel mostra no máximo um ano por vez.' using errcode = 'check_violation';
  end if;
  select * into a from plt_privado.fn_motivos_alcance(p_setor_id);

  -- ---- PRODUÇÃO ------------------------------------------------------------
  if cardinality(a.producao) > 0 then
    with pausas as (
      -- cada linha = uma pessoa parada (o executor, quem ajudava, o PARADO);
      -- vezes = os gestos; tempo = o útil de cada pessoa (horas-pessoa paradas)
      -- (o tempo útil vem guardado; só a parada ainda aberta é calculada agora)
      select pp.evento_id, pp.usuario_id, pp.especial, pp.setor_id,
             case when pp.motivo_id is not null then 'id:' || pp.motivo_id else 'outro' end as chave,
             coalesce(m.texto, 'Outro (escrito na hora)') as motivo,
             coalesce(pp.segundos_uteis,
                      extract(epoch from plt_privado.fn_tempo_util(pp.inicio, now(), pp.setor_id, pp.usuario_id))::bigint) as seg
        from public.plt_pessoa_pausas pp
        left join public.plt_motivos m on m.id = pp.motivo_id
       where pp.inicio >= p_de and pp.inicio < p_ate
         and pp.setor_id = any (a.producao)
    ), saidas as (
      -- a saída do setor pelo tablet: o tempo útil até a pessoa entrar de novo
      -- (guardado na projeção; só a saída ainda aberta é calculada agora)
      select s.evento_id as id, s.usuario_id, s.setor_id,
             coalesce(nullif(btrim(split_part(s.motivo, ' — ', 1)), ''), 'Sem motivo') as motivo,
             coalesce(s.segundos_uteis,
                      extract(epoch from plt_privado.fn_tempo_util(s.inicio, now(), s.setor_id, s.usuario_id))::bigint) as seg
        from public.plt_presenca_saidas s
       where s.inicio >= p_de and s.inicio < p_ate
         and s.setor_id = any (a.producao)
    ), mover as (
      select e.id, e.setor_origem_id, e.setor_destino_id,
             case when (e.dados ->> 'motivo_id') is not null then 'id:' || (e.dados ->> 'motivo_id') else 'outro' end as chave,
             coalesce(m.texto, 'Outro (escrito na hora)') as motivo
        from public.plt_eventos e
        left join public.plt_motivos m on m.id = (e.dados ->> 'motivo_id')::bigint
       where (e.dados ->> 'como') = 'mover_para_fila'
         and e.ocorrido_em >= p_de and e.ocorrido_em < p_ate
         and (e.setor_origem_id = any (a.producao) or e.setor_destino_id = any (a.producao))
    )
    select jsonb_build_object(
      'pausas', coalesce((select jsonb_agg(to_jsonb(x) order by x.segundos desc, x.vezes desc, x.motivo)
                            from (select chave, max(motivo) as motivo, bool_or(especial) as especial,
                                         count(distinct evento_id)::int as vezes,
                                         coalesce(sum(seg), 0)::bigint as segundos
                                    from pausas group by chave) x), '[]'::jsonb),
      'pausas_por_setor', coalesce((select jsonb_agg(to_jsonb(x) order by x.segundos desc, x.vezes desc)
                            from (select p.setor_id, max(s.nome) as setor, count(distinct p.evento_id)::int as vezes,
                                         coalesce(sum(p.seg), 0)::bigint as segundos
                                    from pausas p join public.plt_setores s on s.id = p.setor_id
                                   group by p.setor_id) x), '[]'::jsonb),
      'pausas_por_pessoa', coalesce((select jsonb_agg(to_jsonb(x) order by x.segundos desc, x.vezes desc)
                            from (select p.usuario_id, max(u.nome) as nome, count(distinct p.evento_id)::int as vezes,
                                         coalesce(sum(p.seg), 0)::bigint as segundos
                                    from pausas p join public.plt_usuarios u on u.id = p.usuario_id
                                   group by p.usuario_id
                                   order by segundos desc, vezes desc limit 10) x), '[]'::jsonb),
      'saidas', coalesce((select jsonb_agg(to_jsonb(x) order by x.segundos desc, x.vezes desc, x.motivo)
                            from (select 'txt:' || lower(motivo) as chave, max(motivo) as motivo,
                                         count(*)::int as vezes, coalesce(sum(seg), 0)::bigint as segundos
                                    from saidas group by lower(motivo)) x), '[]'::jsonb),
      'mover', coalesce((select jsonb_agg(to_jsonb(x) order by x.vezes desc, x.motivo)
                            from (select chave, max(motivo) as motivo, count(*)::int as vezes
                                    from mover group by chave) x), '[]'::jsonb),
      'mover_caminhos', coalesce((select jsonb_agg(to_jsonb(x) order by x.vezes desc, x.de, x.para)
                            from (select so.nome as de, sd.nome as para, count(*)::int as vezes
                                    from mover mv
                                    join public.plt_setores so on so.id = mv.setor_origem_id
                                    join public.plt_setores sd on sd.id = mv.setor_destino_id
                                   group by so.nome, sd.nome
                                   order by vezes desc limit 10) x), '[]'::jsonb)
    ) into v_producao;

    -- ---- QUALIDADE (a marcação de saída — D-09/D-126) ----------------------
    with marcas as (
      select e.id, e.setor_origem_id as setor_id, e.estado_qualidade as estado
        from public.plt_eventos e
       where e.tipo = 'qualidade_marcada' and e.ocorrido_em >= p_de and e.ocorrido_em < p_ate
         and e.setor_origem_id = any (a.producao)
    ), divergencias as (
      select m.setor_id, count(*)::int as n
        from public.plt_eventos pa
        join marcas m on m.id = pa.evento_referencia_id
       where pa.tipo = 'qualidade_parecer' and pa.estado_qualidade is distinct from m.estado
       group by m.setor_id
    )
    select jsonb_build_object(
      'por_setor', coalesce(jsonb_agg(to_jsonb(x) order by x.danificado desc, x.atencao desc, x.setor), '[]'::jsonb))
      into v_qualidade
      from (select m.setor_id, max(s.nome) as setor,
                   count(*)::int as marcadas,
                   count(*) filter (where m.estado = 'atencao')::int as atencao,
                   count(*) filter (where m.estado = 'danificado')::int as danificado,
                   coalesce(max(d.n), 0)::int as divergencias
              from marcas m
              join public.plt_setores s on s.id = m.setor_id
              left join divergencias d on d.setor_id = m.setor_id
             group by m.setor_id
            having count(*) filter (where m.estado in ('atencao', 'danificado')) > 0
                or coalesce(max(d.n), 0) > 0) x;
  end if;

  -- ---- PCP: o stand-by (D-169) ----------------------------------------------
  if a.ver_pcp then
    -- ↪️ 06/11/2026 (D-269): a aba Stand-by do PCP, lida UMA vez — o "em stand-by
    -- agora" e o "ainda segurado" de cada motivo saem dela
    with na as materialized (
      select v.standby_evento_id from plt_privado.vw_standby_na_aba v
    ),
    sb as (
      select e.id,
             case when (e.dados ->> 'motivo_id') is not null then 'id:' || (e.dados ->> 'motivo_id') else 'outro' end as chave,
             coalesce(m.texto, 'Outro (escrito na hora)') as motivo,
             (sai.ocorrido_em is null and e.id in (select na.standby_evento_id from na)) as agora,
             -- o útil vem no fato da saída (1d); só o aberto e o antigo calculam agora
             coalesce(sai.seg,
                      extract(epoch from plt_privado.fn_tempo_util(e.ocorrido_em, coalesce(sai.ocorrido_em, now()),
                                                                   a.pcp_id, null))::bigint) as seg
        from public.plt_eventos e
        left join public.plt_motivos m on m.id = (e.dados ->> 'motivo_id')::bigint
        left join lateral (
          select s.ocorrido_em, (s.dados ->> 'segundos_uteis')::bigint as seg
            from public.plt_eventos s
           where s.evento_referencia_id = e.id and s.tipo = 'pedido_standby_saiu'
           order by s.id limit 1
        ) sai on true
       where e.tipo = 'pedido_standby_entrou' and e.ocorrido_em >= p_de and e.ocorrido_em < p_ate
    )
    select jsonb_build_object(
      'standby', coalesce((select jsonb_agg(to_jsonb(x) order by x.segundos desc, x.vezes desc, x.motivo)
                             from (select chave, max(motivo) as motivo, count(*)::int as vezes,
                                          count(*) filter (where agora)::int as agora,
                                          coalesce(sum(seg), 0)::bigint as segundos
                                     from sb group by chave) x), '[]'::jsonb),
      -- ↪️ 06/11/2026 (D-269): o mesmo número da aba Stand-by do PCP
      'em_standby_agora', (select count(*)::int from na)
    ) into v_pcp;
  end if;

  -- ---- ROTAS: não entrega, devolução e entrega desfeita (D-116/D-129) --------
  if a.ver_rotas then
    with f as (
      select e.id, e.tipo, e.usuario_id, e.origem,
             (e.dados ->> 'caminhao_id')::bigint as caminhao_id,
             case when (e.dados ->> 'motivo_id') is not null then 'id:' || (e.dados ->> 'motivo_id')
                  when e.origem = 'automacao' then 'tiny'
                  when e.dados ->> 'motivo' = 'reentrega' then 'reentrega'
                  else 'outro' end as chave,
             coalesce(m.texto,
                      case when e.origem = 'automacao' then 'Marcado no Tiny'
                           when e.dados ->> 'motivo' = 'reentrega' then 'Reentrega'
                           else 'Outro (escrito na hora)' end) as motivo
        from public.plt_eventos e
        left join public.plt_motivos m on m.id = (e.dados ->> 'motivo_id')::bigint
       where e.tipo in ('entrega_nao_realizada', 'pedido_devolvido', 'entrega_desfeita')
         and e.ocorrido_em >= p_de and e.ocorrido_em < p_ate
    )
    select jsonb_build_object(
      'nao_entregue', coalesce((select jsonb_agg(to_jsonb(x) order by x.vezes desc, x.motivo)
                       from (select chave, max(motivo) as motivo, count(*)::int as vezes
                               from f where tipo = 'entrega_nao_realizada' group by chave) x), '[]'::jsonb),
      'devolucao', coalesce((select jsonb_agg(to_jsonb(x) order by x.vezes desc, x.motivo)
                       from (select chave, max(motivo) as motivo, count(*)::int as vezes
                               from f where tipo = 'pedido_devolvido' group by chave) x), '[]'::jsonb),
      'desfeita', coalesce((select jsonb_agg(to_jsonb(x) order by x.vezes desc, x.motivo)
                       from (select chave, max(motivo) as motivo, count(*)::int as vezes
                               from f where tipo = 'entrega_desfeita' group by chave) x), '[]'::jsonb),
      'por_caminhao', coalesce((select jsonb_agg(to_jsonb(x) order by x.vezes desc, x.caminhao)
                       from (select f.caminhao_id, max(c.nome) as caminhao, count(*)::int as vezes
                               from f join public.plt_caminhoes c on c.id = f.caminhao_id
                              where f.tipo = 'entrega_nao_realizada' group by f.caminhao_id) x), '[]'::jsonb),
      'por_pessoa', coalesce((select jsonb_agg(to_jsonb(x) order by x.vezes desc, x.nome)
                       from (select f.usuario_id, max(u.nome) as nome, count(*)::int as vezes
                               from f join public.plt_usuarios u on u.id = f.usuario_id
                              where f.tipo = 'entrega_nao_realizada' group by f.usuario_id
                              order by vezes desc limit 10) x), '[]'::jsonb),
      -- SESSAO-47: as entregas VIGENTES pelo dia real (a projeção do card, pelo
      -- índice dela) — antes contava os fatos, inclusive os desfeitos
      'entregues', (select count(*)::int from public.plt_cards pc
                     where pc.entrega_em >= p_de and pc.entrega_em < p_ate)
    ) into v_rotas;
  end if;

  return jsonb_build_object(
    'de', p_de, 'ate', p_ate, 'setor_id', p_setor_id,
    'producao', v_producao, 'qualidade', v_qualidade, 'pcp', v_pcp, 'rotas', v_rotas);
end;
$$;
