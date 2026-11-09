-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · SESSAO-47 · BLOCO A (frentes 1 a 4)
-- O PEDIDO QUE O TINY LEVOU ADIANTE E AINDA FALTA PRODUZIR (09/11/2026)
--
-- O bug do 13818: o Tiny ficou "Pronto para envio" (mudança à mão, lá) e a
-- logística liberou as duas peças prontas dele para outros pedidos. O pedido
-- saiu do PCP (D-132: Faturado, Pronto para envio e Enviado não esperam
-- liberação) e TAMBÉM da Expedição (D-133: o adiantado só aparecia com peça na
-- fábrica) — ninguém via o pedido, e o sino dizia "voltou ao PCP".
--
-- A regra da D-132 CONTINUA (resposta 1 do dono). O que entra:
--
--   Frente 1 · a Expedição mostra o pedido "adiantado no Tiny com falta" mesmo
--              com zero peça, com a situação real e o que falta liberar — e um
--              filtro só deles. A regra do pedido VIVO (uma só para a Expedição
--              e as rotas — D-156) ganha o caso: adiantado no Tiny, sem peça
--              viva, mas com vaga por liberar.
--   Frente 2 · a volta ao PCP pela plataforma: uma porta idempotente pede ao
--              Tiny a situação ("aberto" ou "preparando_envio") pela fila de
--              saída que já existia (a do "Entregue dos dois lados") e devolve
--              o pedido ao PCP NA HORA, por um fato (pedido_volta_pcp) com a
--              projeção no card do pedido (volta_pcp_em/_situacao — a base). A
--              marca vale até o Tiny mostrar outra situação: aí um fato a fecha
--              (pedido_volta_pcp_fim) e a D-132 volta a decidir sozinha. Aviso
--              antigo do Tiny que repete a situação adiantada não esconde o
--              pedido. O Tiny recusou → o pedido segue no PCP e o alerta sai
--              pela porta de sempre (tiny_pedido_parado).
--   Frente 3 · liberar a peça pronta com o pedido de origem adiantado: quem
--              libera escolhe, no mesmo gesto, voltar para "Em aberto", voltar
--              para "Preparando envio" ou deixar como está (plt_fn_liberar_peca
--              ganha p_tiny). O "não lançar agora" (stand-by) passa a valer
--              também com o Tiny adiante (antes o gesto inteiro era recusado).
--   Frente 4 · o aviso "voltou ao PCP" só sai quando o pedido voltou; quando
--              não volta, o aviso diz que ele ficou na Expedição esperando
--              decisão, com a situação real.
--
-- Recriadas POR EXTRAÇÃO da versão vigente (o último create nas migrations —
-- E-24/A-97; a conferência com o banco vivo fica para o passo do OK do dono):
--   vw_pedidos_vivos_regra · vw_standby_na_aba · plt_fn_pcp_quadro ·
--   plt_fn_cards_pedido_pcp · plt_fn_dash_pcp_dia · plt_fn_pcp_standby ·
--   plt_fn_expedicao · plt_fn_liberar_peca (assinatura nova, com default — o
--   site de antes segue chamando) · fn_avisos_catalogo.
-- Nada em tabela da integração: em `pedidos` só um gatilho a mais (como os da
-- casa), à prova de falha — a gravação do Tiny nunca cai por ele.
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · A fila de saída do Tiny aceita o motivo novo
-- ----------------------------------------------------------------------------
alter table public.plt_tiny_pedido_fila drop constraint if exists plt_tiny_pedido_fila_motivo_ck;
alter table public.plt_tiny_pedido_fila add constraint plt_tiny_pedido_fila_motivo_ck
  check (motivo in ('entregue', 'desfeita', 'volta_pcp'));

-- A tela do PCP e a da Expedição releem quando a fila anda (o Tiny confirmou,
-- recusou ou desistiu) — sem relógio: nasce do fato (Lei §4).
create or replace function plt_privado.fn_tiny_pedido_fila_avisar()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform plt_privado.fn_avisar('pcp');
  perform plt_privado.fn_avisar('aguardo');
  return null;
end;
$$;

drop trigger if exists plt_tiny_pedido_fila_avisar on public.plt_tiny_pedido_fila;
create trigger plt_tiny_pedido_fila_avisar
  after insert or update or delete on public.plt_tiny_pedido_fila
  for each statement execute function plt_privado.fn_tiny_pedido_fila_avisar();

revoke all on function plt_privado.fn_tiny_pedido_fila_avisar() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2 · A conta do que falta e o retrato da volta
-- ----------------------------------------------------------------------------
-- Quantas vagas de produção do pedido ainda não têm peça — a conta do PCP
-- (fn_vagas_pedido: frete fora, personalizado dentro, a peça do mesmo produto
-- cobre a vaga; a reserva do estoque ainda não é peça).
create or replace function plt_privado.fn_pedido_faltam(p_pedido_id bigint)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::int from plt_privado.fn_vagas_pedido(p_pedido_id) w where w.card_id is null;
$$;

comment on function plt_privado.fn_pedido_faltam(bigint) is
  'SESSAO-47: quantos produtos do pedido ainda faltam liberar (vagas de produção sem peça) — a mesma conta da liberação do PCP.';

-- Como está a volta ao PCP de um pedido devolvido pela plataforma: o que foi
-- pedido ao Tiny e o que a fila de saída diz (esperando, falhando, parado ou
-- aceito — a linha sai da fila quando o Tiny aceita).
create or replace function plt_privado.fn_volta_pcp_resumo(p_card_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
           'desde', c.volta_pcp_em,
           'situacao_pedida', c.volta_pcp_situacao,
           'situacao_tiny', p.situacao,
           'estado', case when f.pedido_id is null or f.motivo <> 'volta_pcp' then 'aceito'
                          when f.parado_em is not null then 'parado'
                          when f.ultimo_erro is not null then 'falhando'
                          else 'esperando' end)
    from public.plt_cards c
    join public.pedidos p on p.id = c.pedido_id
    left join public.plt_tiny_pedido_fila f on f.pedido_id = c.pedido_id
   where c.id = p_card_id and c.volta_pcp_em is not null;
$$;

comment on function plt_privado.fn_volta_pcp_resumo(bigint) is
  'SESSAO-47: o retrato da volta ao PCP de um pedido devolvido pela plataforma — o que foi pedido ao Tiny e como a fila de saída está (esperando · falhando · parado · aceito).';

revoke all on function plt_privado.fn_pedido_faltam(bigint) from public, anon, authenticated;
revoke all on function plt_privado.fn_volta_pcp_resumo(bigint) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3 · A regra única: "adiantado no Tiny com falta"
-- ----------------------------------------------------------------------------
-- O pedido entra aqui quando o card dele está vivo (não arquivado, sem entrega
-- vigente), o Tiny diz Faturado, Pronto para envio ou Enviado, e ainda falta
-- liberar pelo menos uma vaga de produção (a conta do PCP: liberado_completo_em
-- vazio e algum item a produzir). `volta_pcp_em` diz se a plataforma já o
-- devolveu ao PCP. Lida pela Expedição (o aviso e o filtro), pela regra do
-- pedido vivo e pela porta da volta.
create or replace view plt_privado.vw_pedidos_adiantados_falta as
  select pc.id as card_id, pc.pedido_id, p.numero, p.situacao,
         pc.volta_pcp_em, pc.volta_pcp_situacao, pc.standby_desde
    from public.plt_cards pc
    join public.pedidos p on p.id = pc.pedido_id
   where pc.tipo = 'pedido'
     and pc.arquivado_em is null
     and pc.entrega_evento_id is null
     and pc.liberado_completo_em is null
     and plt_privado.fn_tiny_adiantou(p.situacao)
     and exists (select 1 from plt_privado.vw_itens_producao v
                  where v.pedido_id = p.id and v.unidades > 0);

comment on view plt_privado.vw_pedidos_adiantados_falta is
  'SESSAO-47: a regra única do pedido que o Tiny levou adiante (Faturado, Pronto para envio, Enviado) e que ainda tem produto por liberar. volta_pcp_em preenchido = a plataforma já o devolveu ao PCP.';

revoke all on plt_privado.vw_pedidos_adiantados_falta from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4 · A marca por fato: a validação e a projeção
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_validar_volta_pcp()
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
    raise exception 'Só o card do pedido volta ao PCP.' using errcode = 'check_violation';
  end if;
  if new.tipo = 'pedido_volta_pcp' then
    -- a volta só nasce pela porta (a maquinaria liga a marca): ela pede a
    -- situação ao Tiny no mesmo gesto — um fato solto deixaria os dois lados
    -- dizendo coisas diferentes.
    if coalesce(current_setting('plt.volta_pcp_maquinaria', true), '') <> 'on' then
      raise exception 'A volta do pedido ao PCP é feita pela Expedição (os botões "Voltar para…").'
        using errcode = 'insufficient_privilege';
    end if;
    if new.usuario_id is null then
      raise exception 'A volta ao PCP é gesto de pessoa — é preciso dizer quem fez.' using errcode = 'check_violation';
    end if;
    if coalesce(new.dados ->> 'situacao_pedida', '') not in ('aberto', 'preparando_envio') then
      raise exception 'A situação pedida ao Tiny é "Em aberto" ou "Preparando envio".' using errcode = 'check_violation';
    end if;
  else
    if v_card.volta_pcp_em is null then
      raise exception 'Este pedido não tem volta ao PCP em aberto.' using errcode = 'check_violation';
    end if;
    if new.origem <> 'automacao' then
      raise exception 'Quem fecha a volta ao PCP é o Sistema, quando o Tiny muda a situação.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists plt_eventos_validar_volta_pcp on public.plt_eventos;
create trigger plt_eventos_validar_volta_pcp
  before insert on public.plt_eventos
  for each row when (new.tipo in ('pedido_volta_pcp', 'pedido_volta_pcp_fim'))
  execute function plt_privado.fn_validar_volta_pcp();

-- A projeção (M-13): a marca no card do pedido só é escrita daqui. A entrega
-- registrada também a apaga — pedido entregue não tem volta pendente.
create or replace function plt_privado.fn_projetar_volta_pcp()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.tipo = 'pedido_volta_pcp' then
    update public.plt_cards
       set volta_pcp_em = new.ocorrido_em,
           volta_pcp_situacao = new.dados ->> 'situacao_pedida'
     where id = new.card_id;
  else
    update public.plt_cards
       set volta_pcp_em = null,
           volta_pcp_situacao = null
     where id = new.card_id and volta_pcp_em is not null;
  end if;
  return null;
end;
$$;

drop trigger if exists plt_eventos_projetar_volta_pcp on public.plt_eventos;
create trigger plt_eventos_projetar_volta_pcp
  after insert on public.plt_eventos
  for each row when (new.tipo in ('pedido_volta_pcp', 'pedido_volta_pcp_fim', 'pedido_entregue'))
  execute function plt_privado.fn_projetar_volta_pcp();

revoke all on function plt_privado.fn_validar_volta_pcp() from public, anon, authenticated;
revoke all on function plt_privado.fn_projetar_volta_pcp() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5 · A volta ao PCP: o miolo (a Expedição e a janela de liberar peça chamam)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_pedido_voltar_pcp(
  p_card_id bigint, p_situacao text, p_chave text, p_usuario uuid, p_fonte text, p_avisar boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card   public.plt_cards%rowtype;
  v_pedido public.pedidos%rowtype;
  v_faltam integer;
  v_fila   text;
  v_ev     bigint;
  v_nome   text;
  v_marca  text;
begin
  if p_situacao is null or p_situacao not in ('aberto', 'preparando_envio') then
    raise exception 'Escolha para qual situação o pedido volta no Tiny: "Em aberto" ou "Preparando envio".'
      using errcode = 'check_violation';
  end if;
  if p_chave is null or length(p_chave) < 8 or length(p_chave) > 80 then
    raise exception 'Chave do gesto inválida.' using errcode = 'check_violation';
  end if;
  v_nome := case p_situacao when 'aberto' then 'Em aberto' else 'Preparando envio' end;

  select * into v_card from public.plt_cards where id = p_card_id and tipo = 'pedido' for update;
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'no_data_found';
  end if;
  -- Lei §10: o mesmo toque repetido = um efeito só
  if exists (select 1 from public.plt_eventos e
              where e.card_id = v_card.id and e.tipo = 'pedido_volta_pcp' and e.dados ->> 'chave' = p_chave) then
    return jsonb_build_object('feito', false, 'repetido', true);
  end if;
  select * into v_pedido from public.pedidos where id = v_card.pedido_id;
  if v_pedido.id is null then
    raise exception 'Pedido não encontrado.' using errcode = 'no_data_found';
  end if;
  if v_card.arquivado_em is not null then
    raise exception 'O pedido % está arquivado.', v_pedido.numero using errcode = 'check_violation';
  end if;
  if v_card.entrega_evento_id is not null then
    raise exception 'O pedido % já foi entregue.', v_pedido.numero using errcode = 'check_violation';
  end if;
  -- o Tiny já não está adiante (alguém mudou lá no meio do caminho): o pedido
  -- já está no PCP pela regra de sempre — nada a fazer.
  if not plt_privado.fn_tiny_adiantou(v_pedido.situacao) then
    return jsonb_build_object('feito', false, 'motivo', 'tiny_nao_esta_adiante',
                              'numero', v_pedido.numero, 'situacao', v_pedido.situacao);
  end if;
  v_faltam := plt_privado.fn_pedido_faltam(v_pedido.id);
  if v_card.liberado_completo_em is not null or v_faltam = 0 then
    raise exception 'Não falta liberar nada do pedido % — ele não precisa voltar ao PCP.', v_pedido.numero
      using errcode = 'check_violation';
  end if;
  -- já devolvido com a MESMA situação: outro toque (ou outra pessoa) — nada de novo
  if v_card.volta_pcp_em is not null and v_card.volta_pcp_situacao = p_situacao then
    return jsonb_build_object('feito', false, 'motivo', 'ja_devolvido',
                              'numero', v_pedido.numero, 'situacao_pedida', p_situacao);
  end if;
  if plt_privado.fn_tiny_entrega_desde() is null then
    raise exception 'A ida ao Tiny está desligada — por aqui não dá para mudar a situação do pedido lá. Mude no Tiny, ou peça a um administrador para ligar "Entregue vai ao Tiny" em Configurações → Caminhões.'
      using errcode = 'check_violation';
  end if;

  -- 1 · pede a situação ao Tiny pela fila de saída (uma linha por pedido: vale a última vontade)
  v_fila := plt_privado.fn_tiny_pedido_enfileirar(v_pedido.id, p_situacao, 'volta_pcp');
  if v_fila in ('desligado', 'sem_pedido') then
    raise exception 'Não deu para pedir a mudança ao Tiny (%).', v_fila using errcode = 'check_violation';
  end if;

  -- 2 e 3 · o pedido volta ao PCP na hora: o fato com quem fez, a situação de
  -- antes e a pedida; a projeção põe a marca no card (o log sai do fato — D-40)
  v_marca := current_setting('plt.volta_pcp_maquinaria', true);
  perform set_config('plt.volta_pcp_maquinaria', 'on', true);
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, observacao, dados)
    values (v_card.id, 'pedido_volta_pcp', p_usuario, 'interface', v_card.setor_atual_id,
            format('Voltou ao PCP: no Tiny estava "%s" e foi pedido "%s".', v_pedido.situacao, v_nome),
            jsonb_build_object('chave', p_chave, 'numero', v_pedido.numero,
                               'situacao_antes', v_pedido.situacao, 'situacao_pedida', p_situacao,
                               'faltam', v_faltam, 'fonte', coalesce(p_fonte, 'expedicao'),
                               'standby', v_card.standby_desde is not null, 'fila', v_fila))
    returning id into v_ev;
  perform set_config('plt.volta_pcp_maquinaria', coalesce(v_marca, ''), true);

  -- 4 · o PCP é avisado (a janela de liberar peça manda o aviso dela, com a peça)
  if coalesce(p_avisar, true) then
    perform plt_privado.fn_avisar_publico(
      'pedido_voltou_pcp', 'pcp', v_ev, v_card.id,
      format('Pedido %s voltou ao PCP', v_pedido.numero),
      format('A logística devolveu o pedido ao PCP: no Tiny ele estava como %s e passa para %s. %s',
             v_pedido.situacao, v_nome,
             case when v_card.standby_desde is not null
                  then 'Ele segue em stand-by, com ' || v_faltam
                       || case when v_faltam = 1 then ' produto' else ' produtos' end || ' por liberar.'
                  else case when v_faltam = 1 then 'Falta liberar 1 produto.'
                            else 'Faltam liberar ' || v_faltam || ' produtos.' end end));
  end if;
  -- a Expedição e as rotas também releem (o fato no card do pedido já avisa o PCP)
  perform plt_privado.fn_avisar('aguardo');
  perform plt_privado.fn_avisar('rotas');

  return jsonb_build_object('feito', true, 'numero', v_pedido.numero, 'faltam', v_faltam,
                            'situacao_antes', v_pedido.situacao, 'situacao_pedida', p_situacao,
                            'standby', v_card.standby_desde is not null, 'fila', v_fila);
end;
$$;

comment on function plt_privado.fn_pedido_voltar_pcp(bigint, text, text, uuid, text, boolean) is
  'SESSAO-47: o miolo da volta ao PCP do pedido que o Tiny levou adiante — pede a situação ao Tiny pela fila de saída, grava o fato pedido_volta_pcp (a marca no card) e avisa. Idempotente pela chave do toque.';

revoke all on function plt_privado.fn_pedido_voltar_pcp(bigint, text, text, uuid, text, boolean) from public, anon, authenticated;

-- A porta da Expedição (os botões "Voltar para Em aberto (Tiny)" e "Voltar para
-- Preparando envio (Tiny)") — logística e admin, a mesma permissão de liberar peça.
create or replace function public.plt_fn_pedido_voltar_pcp(p_card_id bigint, p_situacao text, p_chave text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu uuid := plt_privado.fn_usuario_atual();
begin
  if v_eu is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Devolver o pedido ao PCP mudando a situação no Tiny é gesto da logística ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;
  return plt_privado.fn_pedido_voltar_pcp(p_card_id, p_situacao, p_chave, v_eu, 'expedicao', true);
end;
$$;

comment on function public.plt_fn_pedido_voltar_pcp(bigint, text, text) is
  'SESSAO-47: a Expedição devolve ao PCP o pedido que o Tiny levou adiante e que ainda tem produto por liberar, pedindo ao Tiny a situação escolhida (aberto | preparando_envio). Logística e admin; idempotente pela chave do toque.';

revoke all on function public.plt_fn_pedido_voltar_pcp(bigint, text, text) from public, anon;
grant execute on function public.plt_fn_pedido_voltar_pcp(bigint, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 6 · O Tiny mudou a situação: a marca fecha e as telas releem
-- ----------------------------------------------------------------------------
-- Gatilho próprio (a reação grande ao pedido não é tocada — o molde do fecho do
-- stand-by pelo cancelamento). A marca só fecha quando o Tiny SAI das três
-- situações adiantadas: a situação pedida (confirmou) ou qualquer outra (mudou
-- lá). O aviso do Tiny que repete a situação adiantada não muda `situacao` e
-- nem dispara. À prova de falha: a gravação do Tiny nunca cai por ele.
create or replace function plt_privado.fn_volta_pcp_tiny()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card public.plt_cards%rowtype;
  v_norm text;
  v_motivo text;
begin
  begin
    select * into v_card from public.plt_cards c where c.pedido_id = new.id and c.tipo = 'pedido';
    if not found then
      return null;
    end if;
    if v_card.volta_pcp_em is not null and not plt_privado.fn_tiny_adiantou(new.situacao) then
      v_norm := plt_privado.fn_situacao_normalizada(new.situacao);
      v_motivo := case
                    when v_card.volta_pcp_situacao = 'aberto' and v_norm in ('aberto', 'em_aberto') then 'tiny_confirmou'
                    when v_card.volta_pcp_situacao = 'preparando_envio' and v_norm = 'preparando_envio' then 'tiny_confirmou'
                    else 'tiny_mudou'
                  end;
      insert into public.plt_eventos (card_id, tipo, origem, observacao, dados)
        values (v_card.id, 'pedido_volta_pcp_fim', 'automacao',
                case when v_motivo = 'tiny_confirmou'
                     then format('O Tiny confirmou a situação "%s".', new.situacao)
                     else format('O Tiny passou para "%s" — a volta ao PCP pedida pela plataforma deixou de valer.', new.situacao) end,
                jsonb_build_object('motivo', v_motivo, 'numero', new.numero, 'situacao', new.situacao,
                                   'situacao_pedida', v_card.volta_pcp_situacao));
    end if;
    -- o pedido pode ter entrado ou saído do PCP e da Expedição: as telas releem
    if v_card.arquivado_em is null and v_card.entrega_evento_id is null then
      perform plt_privado.fn_avisar('pcp');
      perform plt_privado.fn_avisar('aguardo');
    end if;
  exception when others then
    raise warning 'plt_volta_pcp_tiny: % — a integração segue intacta', sqlerrm;
  end;
  return null;
end;
$$;

drop trigger if exists plt_pedidos_volta_pcp on public.pedidos;
create trigger plt_pedidos_volta_pcp
  after update of situacao on public.pedidos
  for each row when (old.situacao is distinct from new.situacao)
  execute function plt_privado.fn_volta_pcp_tiny();

comment on trigger plt_pedidos_volta_pcp on public.pedidos is
  'SESSAO-47: o Tiny mudou a situação — fecha a marca de devolvido ao PCP quando ele sai de Faturado/Pronto para envio/Enviado e manda o PCP e a Expedição relerem. À prova de falha.';

revoke all on function plt_privado.fn_volta_pcp_tiny() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 7 · As portas do PCP leem a regra única — fn_fora_do_pcp (D-132 + a marca de devolvido)
-- ----------------------------------------------------------------------------
-- (recriada da vigente em 20261105010000_plt_rotas_mapa_expedicao_pcp.sql:660-791)
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
                -- SESSAO-47: D-132 + a marca de devolvido ao PCP (a regra única)
                and not plt_privado.fn_fora_do_pcp(p.situacao, c.volta_pcp_em)
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
                -- SESSAO-47: o pedido que a logística devolveu ao PCP e o Tiny ainda não mostrou a situação nova
                || case when c.volta_pcp_em is null then '{}'::jsonb
                        else jsonb_build_object('volta_pcp', plt_privado.fn_volta_pcp_resumo(c.id)) end
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

-- (recriada da vigente em 20261022050010_plt_tempo_util_standby.sql:478-562)
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
              -- SESSAO-47: D-132 + a marca de devolvido ao PCP (a regra única)
              and not plt_privado.fn_fora_do_pcp(p.situacao, c.volta_pcp_em)
              -- D-63: sem nada a produzir (só frete), o pedido não espera
              -- liberação — vai direto para Pedidos em aguardo.
              and exists (select 1 from plt_privado.vw_itens_producao v
                           where v.pedido_id = p.id and v.unidades > 0)))
   order by c.desde asc nulls last, c.id
   limit least(greatest(coalesce(p_limite, 10), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

-- (recriada da vigente em 20261022050010_plt_tempo_util_standby.sql:702-754)
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
                -- SESSAO-47: D-132 + a marca de devolvido ao PCP (painel = quadro — D-75)
                and not plt_privado.fn_fora_do_pcp(p.situacao, c.volta_pcp_em)
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

-- A aba Stand-by (a regra que o painel de Motivos também lê)
-- (recriada da vigente em 20261106030000_plt_numeros_que_batem.sql:419-430)
create or replace view plt_privado.vw_standby_na_aba as
  select c.id as card_id, c.standby_evento_id
    from public.plt_cards c
    join public.plt_setores s on s.id = c.setor_atual_id and s.papel_no_fluxo = 'entrada'
    join public.pedidos p on p.id = c.pedido_id
   where c.tipo = 'pedido'
     and c.standby_desde is not null
     and c.arquivado_em is null
     and c.liberado_completo_em is null
     and not plt_privado.fn_fora_do_pcp(p.situacao, c.volta_pcp_em)   -- SESSAO-47: a regra única
     and exists (select 1 from plt_privado.vw_itens_producao v
                  where v.pedido_id = p.id and v.unidades > 0);

-- (recriada da vigente em 20261022050010_plt_tempo_util_standby.sql:280-348)
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
  -- SESSAO-47: a regra única (D-132 + a marca). E a peça liberada com "não lançar
  -- agora" segura o pedido mesmo com o Tiny adiante (Faturado, Pronto para envio,
  -- Enviado) — a porta de liberar peça liga a marca; antes o gesto inteiro caía.
  if v_pedido.id is null
     or (plt_privado.fn_fora_do_pcp(v_pedido.situacao, v_card.volta_pcp_em)
         and not (coalesce(current_setting('plt.standby_tiny_adiante', true), '') = 'on'
                  and plt_privado.fn_tiny_adiantou(v_pedido.situacao))) then
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

-- ----------------------------------------------------------------------------
-- 8 · O pedido vivo (Expedição e rotas — D-133/D-156) ganha o adiantado com falta
-- ----------------------------------------------------------------------------
-- O que o Tiny levou adiante só ficava com peça viva na fábrica (D-133). Agora fica
-- também quando ainda falta liberar alguma vaga de produção — a regra única acima — é
-- o pedido que sumia do PCP e da Expedição ao mesmo tempo (o 13818). O caso novo só
-- olha o PEDIDO (p.id), para o filtro continuar descendo até a leitura de `pedidos`
-- pela chave (com a coluna do card no filtro, o planejador trocou para varrer todos os
-- pedidos: 0,7 → 3 s no ensaio ×100). As colunas não mudam (create or replace).
-- (recriada da vigente em 20261027040000_plt_rotas_endereco_data_parcial.sql:215-237)
create or replace view plt_privado.vw_pedidos_vivos_regra as
 SELECT pc.id AS card_id,
    p.id AS pedido_id,
    p.numero,
    p.cliente_id,
    CASE WHEN pdx.pedido_id IS NULL THEN p.data_prevista ELSE pdx.data END AS data_prevista,
    p.situacao,
    pc.lancado_rotas_em,
    pc.devolucao_evento_id,
    pr.data_entrega AS programacao_data,
    pr.caminhao_id,
    pr.rota::integer AS rota,
    pr.ordem,
    pr.detalhe
   FROM plt_cards pc
     JOIN pedidos p ON p.id = pc.pedido_id
     LEFT JOIN plt_pedido_datas pdx ON pdx.pedido_id = p.id AND pdx.tiny_data IS NOT DISTINCT FROM p.data_prevista
     LEFT JOIN plt_programacoes pr ON pr.card_id = pc.id
  WHERE pc.tipo = 'pedido'::text AND pc.arquivado_em IS NULL AND pc.entrega_evento_id IS NULL AND (plt_privado.fn_situacao_normalizada(p.situacao) <> ALL (ARRAY['entregue'::text, 'nao_entregue'::text, 'cancelado'::text])) AND (NOT plt_privado.fn_tiny_tirou_do_pcp(p.situacao) OR (EXISTS ( SELECT 1
           FROM plt_cards cu
          WHERE cu.pedido_id = p.id AND cu.tipo = 'unidade'::text AND cu.arquivado_em IS NULL)) OR (EXISTS ( SELECT 1
           FROM plt_privado.vw_pedidos_adiantados_falta af
          WHERE af.pedido_id = p.id))) AND NOT (EXISTS ( SELECT 1
           FROM plt_pedidos_excluidos_tiny x
          WHERE x.pedido_id = p.id));

-- A Expedição: o aviso, o filtro e os números (recriada da vigente em 20261022050010_plt_tempo_util_standby.sql:757-856)
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
                    order by pg.data_prevista asc nulls last, pg.numero desc)
               from pagina pg
               left join public.plt_caminhoes cam on cam.id = pg.caminhao_id), '[]'::jsonb)
         )
    into v_saida;
  return v_saida;
end;
$$;

-- ----------------------------------------------------------------------------
-- 9 · Liberar a peça pronta: o que fazer com o pedido de origem que o Tiny levou adiante
-- ----------------------------------------------------------------------------
-- A assinatura ganha p_tiny (com default: o site de antes segue chamando com 5).
drop function if exists public.plt_fn_liberar_peca(bigint, integer, text, boolean, text);

-- (recriada da vigente em 20261105010000_plt_rotas_mapa_expedicao_pcp.sql:484-651)
create or replace function public.plt_fn_liberar_peca(
  p_peca_id bigint, p_para_numero integer, p_motivo text, p_relancar boolean, p_chave text,
  p_tiny text default null)   -- SESSAO-47: 'aberto' | 'preparando_envio' | 'deixar' (nulo = deixar)
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
  v_tiny      text := nullif(btrim(coalesce(p_tiny, '')), '');
  v_adiantado boolean := false;   -- o Tiny levou o pedido de origem adiante e a plataforma não o devolveu
  v_voltou    boolean := true;    -- o pedido de origem voltou de fato ao PCP
  v_volta     jsonb;
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
  if v_tiny is not null and v_tiny not in ('aberto', 'preparando_envio', 'deixar') then
    raise exception 'Escolha o que fazer com a situação do pedido no Tiny: voltar para "Em aberto", voltar para "Preparando envio" ou deixar como está.'
      using errcode = 'check_violation';
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

  -- 4 · o pedido de origem: de volta ao PCP (a vaga reabriu no passo 1) — ou parado em stand-by.
  -- SESSAO-47: se o Tiny já levou o pedido adiante (Faturado, Pronto para envio,
  -- Enviado) e a plataforma ainda não o devolveu, ele NÃO volta ao PCP sozinho
  -- (D-132). Quem libera escolhe no mesmo gesto: mudar a situação no Tiny e
  -- devolver agora, ou deixar como está (ele fica na Expedição, com o aviso).
  select * into v_pa from public.pedidos where id = (v_av ->> 'pedido_origem')::bigint;
  select * into v_a from public.plt_cards where id = v_a.id;   -- a conta da liberação mudou no passo 1
  v_adiantado := plt_privado.fn_tiny_adiantou(v_pa.situacao) and v_a.volta_pcp_em is null;
  if not p_relancar then
    -- o stand-by vale mesmo com o Tiny adiante: o pedido fica segurado e aparece
    -- na Expedição com o aviso (de lá, os botões o devolvem ao PCP em stand-by)
    perform set_config('plt.standby_tiny_adiante', 'on', true);
    perform public.plt_fn_pcp_standby(v_a.id, null,
      left(case when p_para_numero is null
                then format('Produto saiu por substituição (%s) — sem nova produção por enquanto', v_motivo)
                else format('Produto liberado para o pedido %s — sem nova produção por enquanto', v_num_b) end, 300));
    perform set_config('plt.standby_tiny_adiante', '', true);
    v_standby := true;
    v_voltou := not v_adiantado;
  elsif v_adiantado then
    if v_tiny in ('aberto', 'preparando_envio') then
      -- muda a situação no Tiny e devolve ao PCP agora (o aviso sai daqui, com a peça)
      v_volta := plt_privado.fn_pedido_voltar_pcp(v_a.id, v_tiny, p_chave, v_eu, 'liberar_peca', false);
      v_voltou := true;
    else
      v_voltou := false;
    end if;
  end if;

  -- 5 · o aviso diz a verdade: "voltou ao PCP" só quando o pedido voltou de fato
  if v_voltou then
    perform plt_privado.fn_avisar_publico(
      'pedido_peca_liberada', 'pcp', v_ev, v_a.id,
      format('Pedido %s voltou ao PCP', v_num_a),
      case when p_para_numero is null
           then format('%s saiu do pedido %s por substituição (%s).', coalesce(v_p.item_descricao, 'A peça'), v_num_a, v_motivo)
           else format('%s ficou com o pedido %s.', coalesce(v_p.item_descricao, 'A peça'), v_num_b) end
      || case when v_volta is not null
              then format(' No Tiny ele estava como %s e passa para %s.', v_pa.situacao,
                          case v_tiny when 'aberto' then 'Em aberto' else 'Preparando envio' end)
              else '' end
      || case when v_standby then ' O pedido ficou em stand-by, sem nova produção por enquanto.'
              else ' Libere a produção de novo.' end);
  else
    perform plt_privado.fn_avisar_publico(
      'pedido_adiantado_tiny', 'logistica', v_ev, v_a.id,
      format('Pedido %s ficou na Expedição', v_num_a),
      format('O produto saiu do pedido %s, mas ele está como %s no Tiny e ficou na Expedição esperando decisão.',
             v_num_a, v_pa.situacao)
      || case when v_standby then ' Está em stand-by, sem nova produção por enquanto.' else '' end
      || ' Na Expedição dá para devolvê-lo ao PCP mudando a situação no Tiny.');
  end if;

  return jsonb_build_object('feito', true, 'numero_origem', v_num_a, 'numero_destino', v_num_b,
                            'nova_unidade', v_novo, 'standby', v_standby,
                            'tiny_adiante', plt_privado.fn_tiny_tirou_do_pcp(v_pa.situacao),
                            -- SESSAO-47: o que aconteceu de verdade com o pedido de origem
                            'voltou_ao_pcp', v_voltou,
                            'tiny_situacao', v_pa.situacao,
                            'tiny_pedido', case when v_volta is not null then v_tiny end);
end;
$$;

comment on function public.plt_fn_liberar_peca(bigint, integer, text, boolean, text, text) is
  'SESSAO-45 (D-219) + SESSAO-47: a Expedição libera a peça pronta de um pedido para outro (ou registra a substituição). Com o pedido de origem adiantado no Tiny, p_tiny diz o que fazer no mesmo gesto: ''aberto'' ou ''preparando_envio'' (muda a situação no Tiny e devolve o pedido ao PCP) ou ''deixar'' (o pedido fica na Expedição com o aviso). O aviso "voltou ao PCP" só sai quando o pedido voltou. Idempotente pela chave do toque.';

revoke all on function public.plt_fn_liberar_peca(bigint, integer, text, boolean, text, text) from public, anon;
grant execute on function public.plt_fn_liberar_peca(bigint, integer, text, boolean, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 10 · Os avisos novos no catálogo (Configurações → Avisos)
-- ----------------------------------------------------------------------------
-- (recriada da vigente em 20261105010000_plt_rotas_mapa_expedicao_pcp.sql:794-830)
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
    ('pedido_voltou_pcp',       'pedidos',   'Pedidos e Tiny',                   38, 'Pedido devolvido ao PCP pela logística', 'O Tiny tinha levado o pedido adiante com produto por liberar: a logística mudou a situação lá e ele voltou ao PCP.', 'pcp', false, false),
    ('pedido_adiantado_tiny',   'pedidos',   'Pedidos e Tiny',                   39, 'Pedido adiantado no Tiny ficou na Expedição', 'A peça pronta saiu do pedido, mas o Tiny já o levou adiante: ele ficou na Expedição esperando a decisão.', 'logistica', false, false),
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
