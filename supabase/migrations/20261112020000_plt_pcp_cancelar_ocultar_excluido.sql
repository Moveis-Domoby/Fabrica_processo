-- ============================================================================
-- SESSAO-50 · BLOCO B — Cancelar e Ocultar pedido no PCP, e o pedido excluído
-- no Tiny saindo do PCP de vez (frentes 3, 4 e 5)
-- ============================================================================
-- O 13622 foi excluído no Tiny em 08/10 e está na lista de excluídos desde
-- 16/10 — mas a regra do PCP nunca olhou essa lista. A limpeza geral de 19/10
-- recriou o card dele (e o do 13270) como se estivesse vivo; o PCP liberou as
-- peças direto no CANCELADO e, depois do acerto da 48, cada cancelamento
-- devolvia as vagas ao PCP (o laço liberar → cancelar → a vaga volta).
--
-- A regra nova (respostas do dono de 12/11, 01:25 e 01:30):
--   frente 3 · excluído no Tiny = cancelado, pela lista que já existe: sai de
--              todas as portas do PCP (a regra única — D-75), as peças em
--              produção esperam a decisão da logística (a frente 3 da 48), as
--              prontas vão ao ESTOQUE sem dono; a entrada na lista vira fato
--              (pedido_excluido_tiny), com o sino da logística; o pedido
--              reencontrado sai da lista com pedido_reencontrado_tiny;
--   frente 4 · "Cancelar pedido" (pede o cancelamento ao Tiny pela fila de
--              saída e sai do PCP na hora — pedido_cancelado_plataforma) e
--              "Ocultar do PCP" (a remoção da 48 com o motivo 'oculto'; com as
--              peças, se o PCP quiser — card_oculto + desvincular + arquivar);
--              "Pedidos ocultos" por N dias (configuração, padrão 30) e
--              "Recuperar" (as vagas voltam ao PCP; nenhuma peça volta para
--              coluna); "Incluir pedido no PCP" aceita o oculto de qualquer idade;
--   frente 5 · a liberação do PCP não manda para uma coluna que cancela a
--              fabricação (o banco recusa) e o aviso do laço (3 ou mais peças
--              canceladas em 24 h).
--
-- Funções recriadas a partir da última versão das migrations (extração +
-- trocas conferidas uma a uma — E-24/A-97); o md5 do corpo vivo confere-se
-- antes de aplicar (A-96).
-- ============================================================================
set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · A regra única do PCP (D-75) ganha dois motivos para o pedido ficar fora:
--     estar na lista de excluídos no Tiny e ter sido cancelado pela plataforma.
--     Os 12 leitores passam a chamar a de 5 argumentos; a de 3 sai no fim.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_fora_do_pcp(
  p_situacao text, p_volta_em timestamptz, p_removido_em timestamptz,
  p_excluido boolean, p_cancelado_em timestamptz)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select p_removido_em is not null
      -- SESSAO-50: o pedido excluído no Tiny (a lista que já existia) e o cancelado
      -- pela plataforma ("Cancelar pedido" no PCP — sai na hora, sem esperar o Tiny)
      or coalesce(p_excluido, false)
      or p_cancelado_em is not null
      or case plt_privado.fn_situacao_normalizada(p_situacao)
           -- o Tiny levou adiante: fora, a não ser que a plataforma o tenha devolvido
           when 'faturado'          then p_volta_em is null
           when 'pronto_para_envio' then p_volta_em is null
           when 'enviado'           then p_volta_em is null
           -- encerrado no Tiny: fora sempre
           when 'entregue'          then true
           when 'nao_entregue'      then true
           when 'cancelado'         then true
           else false
         end;
$$;
comment on function plt_privado.fn_fora_do_pcp(text, timestamptz, timestamptz, boolean, timestamptz) is
  'A regra única do PCP (D-75/D-132): fora quando removido/oculto do PCP, excluído no Tiny (plt_pedidos_excluidos_tiny), cancelado pela plataforma, encerrado no Tiny ou levado adiante sem a volta da plataforma. Quem chama passa "pedido in (select pedido_id from plt_pedidos_excluidos_tiny)" — um conjunto calculado uma vez — e a projeção cancelado_plataforma_em.';
revoke all on function plt_privado.fn_fora_do_pcp(text, timestamptz, timestamptz, boolean, timestamptz) from public, anon, authenticated;

-- O pedido cancelado é UMA regra (23 leitores: liberar, alocar, sugerir, programar,
-- entregar, o stand-by, a chegada ao estoque…). SESSAO-50: o excluído no Tiny e o
-- cancelado pela plataforma (antes de o Tiny confirmar) também são cancelados.
create or replace function plt_privado.fn_pedido_cancelado(p_pedido_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado'
       from public.pedidos p where p.id = p_pedido_id),
    false)
    or exists (select 1 from public.plt_pedidos_excluidos_tiny x where x.pedido_id = p_pedido_id)
    or exists (select 1 from public.plt_cards c
                where c.pedido_id = p_pedido_id and c.tipo = 'pedido'
                  and c.cancelado_plataforma_em is not null);
$$;

-- os índices das duas marcas novas: o "existe?" por pedido e a lista dos cancelados
create index if not exists plt_cards_cancelado_plataforma_idx
  on public.plt_cards (pedido_id) where cancelado_plataforma_em is not null;
create index if not exists plt_cards_cancelado_plataforma_lista_idx
  on public.plt_cards (cancelado_plataforma_em desc, id desc) where cancelado_plataforma_em is not null;


-- ----------------------------------------------------------------------------
-- 2 · Os fatos novos do bloco B: quem grava (cada maquinaria liga a sua marca —
--     o padrão da casa) e o que projetam (M-13)
-- ----------------------------------------------------------------------------
-- pedido_excluido_tiny / pedido_reencontrado_tiny → a conferência com o Tiny
--   (fn_pedidos_excluidos_aplicar), marca plt.excluido_maquinaria
-- pedido_cancelado_plataforma → a porta "Cancelar pedido", marca plt.pcp_saida_maquinaria
-- card_oculto → a porta "Ocultar do PCP" (a peça que sai junto), a mesma marca
create or replace function plt_privado.fn_validar_fatos_sessao50()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_marca text;
  v_tipo  text;
begin
  v_marca := case when new.tipo in ('pedido_excluido_tiny', 'pedido_reencontrado_tiny')
                  then 'plt.excluido_maquinaria' else 'plt.pcp_saida_maquinaria' end;
  if coalesce(current_setting(v_marca, true), '') <> 'on' then
    raise exception 'Este registro nasce sozinho, pelo gesto na plataforma (Cancelar ou Ocultar no PCP) ou pela conferência com o Tiny — não se grava direto.'
      using errcode = 'check_violation';
  end if;
  select c.tipo into v_tipo from public.plt_cards c where c.id = new.card_id;
  if new.tipo = 'card_oculto' and v_tipo is distinct from 'unidade' then
    raise exception 'Só a peça é ocultada junto com o pedido.' using errcode = 'check_violation';
  end if;
  if new.tipo <> 'card_oculto' and v_tipo is distinct from 'pedido' then
    raise exception 'O cancelamento e a exclusão no Tiny são do card do pedido.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
comment on function plt_privado.fn_validar_fatos_sessao50() is
  'SESSAO-50 (bloco B): os fatos novos (o pedido excluído/reencontrado no Tiny, o cancelamento pela plataforma, a peça ocultada com o pedido) só nascem pela maquinaria, cada uma com a sua marca; e cada um no tipo de card certo.';
revoke all on function plt_privado.fn_validar_fatos_sessao50() from public, anon, authenticated;

drop trigger if exists plt_eventos_validar_sessao50 on public.plt_eventos;
create trigger plt_eventos_validar_sessao50
  before insert on public.plt_eventos
  for each row
  when (new.tipo in ('pedido_excluido_tiny', 'pedido_reencontrado_tiny', 'pedido_cancelado_plataforma', 'card_oculto'))
  execute function plt_privado.fn_validar_fatos_sessao50();

-- A projeção: o cancelamento pela plataforma marca o card do pedido (o nome do
-- gatilho vem ANTES dos "zz" — a reação ao cancelamento e o fecho do stand-by
-- leem a marca na mesma transação); o pedido que sai do PCP fecha o aviso da
-- peça cancelada (o selo some — ele não está mais no PCP).
create or replace function plt_privado.fn_projetar_fatos_sessao50()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.tipo = 'pedido_cancelado_plataforma' then
    update public.plt_cards
       set cancelado_plataforma_em        = coalesce(cancelado_plataforma_em, new.ocorrido_em),
           cancelado_plataforma_evento_id = coalesce(cancelado_plataforma_evento_id, new.id),
           pcp_aviso_em                   = null
     where id = new.card_id;
  elsif new.tipo = 'pedido_excluido_tiny' then
    update public.plt_cards set pcp_aviso_em = null
     where id = new.card_id and pcp_aviso_em is not null;
  end if;
  return null;
end;
$$;
comment on function plt_privado.fn_projetar_fatos_sessao50() is
  'SESSAO-50 (bloco B): a projeção dos fatos novos — pedido_cancelado_plataforma marca cancelado_plataforma_em no card do pedido; o cancelamento e a exclusão no Tiny fecham o aviso da peça cancelada (o pedido saiu do PCP).';
revoke all on function plt_privado.fn_projetar_fatos_sessao50() from public, anon, authenticated;

drop trigger if exists plt_eventos_projetar_sessao50 on public.plt_eventos;
create trigger plt_eventos_projetar_sessao50
  after insert on public.plt_eventos
  for each row
  when (new.tipo in ('pedido_cancelado_plataforma', 'pedido_excluido_tiny'))
  execute function plt_privado.fn_projetar_fatos_sessao50();


-- ----------------------------------------------------------------------------
-- 2b · A remoção do PCP aceita o motivo "oculto" (o Ocultar reaproveita a máquina da 48)
-- ----------------------------------------------------------------------------
-- (recriada da vigente — 20261111010000_plt_sessao48_base.sql (1 definições ao todo))
create or replace function plt_privado.fn_validar_fatos_cancelamento()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_marca text;
  v_tipo  text;
begin
  v_marca := case
               when new.tipo in ('fabricacao_cancelada', 'fabricacao_retomada') then 'plt.cancelamento_maquinaria'
               when new.tipo in ('pcp_aviso_resolvido', 'pedido_removido_pcp', 'pedido_devolvido_pcp') then 'plt.pcp_aviso_maquinaria'
               else 'plt.destino_maquinaria'
             end;
  if coalesce(current_setting(v_marca, true), '') <> 'on' then
    raise exception 'Este registro nasce sozinho, pelo gesto na plataforma (mover a peça, a janela do PCP ou a da logística) — não se grava direto.'
      using errcode = 'check_violation';
  end if;
  select c.tipo into v_tipo from public.plt_cards c where c.id = new.card_id;
  if new.tipo in ('fabricacao_cancelada', 'fabricacao_retomada', 'destino_pendente', 'destino_decidido')
     and v_tipo is distinct from 'unidade' then
    raise exception 'Só a peça tem a fabricação cancelada, retomada ou um destino a decidir.' using errcode = 'check_violation';
  end if;
  if new.tipo in ('pcp_aviso_resolvido', 'pedido_removido_pcp', 'pedido_devolvido_pcp')
     and v_tipo is distinct from 'pedido' then
    raise exception 'O aviso e a remoção do PCP são do card do pedido.' using errcode = 'check_violation';
  end if;
  if new.tipo = 'fabricacao_cancelada'
     and coalesce(new.dados ->> 'motivo', '') not in ('cancelada', 'nao_encontrada') then
    raise exception 'O cancelamento leva o motivo da coluna (cancelada ou não encontrada).' using errcode = 'check_violation';
  end if;
  if new.tipo = 'pedido_removido_pcp'
     and coalesce(new.dados ->> 'motivo', '') not in ('oculto', 'pedido_cancelado', 'fora_da_linha', 'outro') then
    raise exception 'Escolha por que o pedido sai do PCP.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;


-- ----------------------------------------------------------------------------
-- 2c · A reação ao cancelamento vale também para o cancelado pela plataforma e para o excluído no Tiny (a peça em produção espera a decisão da logística; a pronta vai ao ESTOQUE sem dono; sai da programação)
-- ----------------------------------------------------------------------------
-- (recriada da vigente — 20261111030000_plt_cancelado_pergunta_destino.sql (4 definições ao todo))
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
  -- SESSAO-50: o cancelado pela plataforma e o excluído no Tiny seguem o mesmo caminho
  if new.tipo in ('pedido_cancelado', 'pedido_cancelado_plataforma', 'pedido_excluido_tiny') then
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
    v_frase := case when v_devolvido then 'devolvido'
                    when new.tipo = 'pedido_cancelado_plataforma' then 'cancelado pela plataforma'
                    when new.tipo = 'pedido_excluido_tiny' then 'excluído no Tiny'
                    else 'cancelado no Tiny' end;

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
                  'Pedido ' || coalesce(v_numero::text, '') || ' ' || v_frase || ' — o móvel espera a logística decidir para onde vai.',
                  jsonb_build_object('pedido_id', v_pedido_id, 'numero', v_numero, 'card_pedido_id', new.card_id,
                                     'setor', r.setor, 'etapa', r.etapa));
        v_n := v_n + 1;
      end loop;
      perform set_config('plt.destino_maquinaria', v_m, true);
      if v_n > 0 then
        perform plt_privado.fn_avisar_publico(
          'pedido_cancelado_decidir', 'logistica', new.id, new.card_id,
          format('Pedido %s %s com móveis em produção', v_numero, v_frase),
          format('O pedido %s foi %s. %s — decida para onde %s.',
                 v_numero, v_frase,
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
              'Pedido ' || coalesce(v_numero::text, '') || ' cancelado — a peça ficou pronta e entrou no ESTOQUE sem dono.',
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
drop trigger if exists plt_eventos_zz_desvincular_cancelados on public.plt_eventos;
create trigger plt_eventos_zz_desvincular_cancelados
  after insert on public.plt_eventos
  for each row
  when (new.tipo in ('pedido_cancelado', 'pedido_cancelado_plataforma', 'pedido_excluido_tiny', 'movimentacao_setor'))
  execute function plt_privado.fn_desvincular_por_cancelamento();


-- ----------------------------------------------------------------------------
-- 2d · O stand-by aberto fecha também no cancelamento pela plataforma e na exclusão no Tiny (D-269)
-- ----------------------------------------------------------------------------
-- (recriada da vigente — 20261106030000_plt_numeros_que_batem.sql (1 definições ao todo))
create or replace function plt_privado.fn_standby_fechar_no_cancelamento()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card public.plt_cards%rowtype;
begin
  select * into v_card from public.plt_cards where id = new.card_id for update;
  if not found or v_card.tipo <> 'pedido' or v_card.standby_desde is null
     or not plt_privado.fn_pedido_cancelado(v_card.pedido_id) then
    return null;
  end if;
  insert into public.plt_eventos (card_id, tipo, origem, setor_origem_id, observacao,
                                  evento_referencia_id, ocorrido_em, dados)
    values (v_card.id, 'pedido_standby_saiu', 'automacao', v_card.setor_atual_id,
            case new.tipo when 'pedido_cancelado_plataforma' then 'Pedido cancelado pela plataforma — o stand-by fechou sozinho.'
                          when 'pedido_excluido_tiny' then 'Pedido excluído no Tiny — o stand-by fechou sozinho.'
                          else 'Pedido cancelado no Tiny — o stand-by fechou sozinho.' end,
            v_card.standby_evento_id, greatest(new.ocorrido_em, v_card.standby_desde),
            jsonb_build_object('destino', 'cancelado',
                               'numero', (select p.numero from public.pedidos p where p.id = v_card.pedido_id),
                               'motivo_do_standby', v_card.standby_motivo,
                               'cancelamento_evento_id', new.id));
  return null;
end;
$$;
drop trigger if exists plt_eventos_zz_standby_cancelado on public.plt_eventos;
create trigger plt_eventos_zz_standby_cancelado
  after insert on public.plt_eventos
  for each row when (new.tipo in ('pedido_cancelado', 'pedido_cancelado_plataforma', 'pedido_excluido_tiny'))
  execute function plt_privado.fn_standby_fechar_no_cancelamento();


-- ----------------------------------------------------------------------------
-- 3 · A lista de excluídos no Tiny (D-140) vira fato e segue o caminho do
--     cancelado (frente 3). Sem relógio novo: tudo continua na conferência da
--     madrugada que já existe (fn_tiny_pente_fino_resumir chama esta, protegida).
--     ↩️ revisa a D-140 no que ela fazia com os cartões: em vez de arquivar tudo,
--     a peça em produção espera a decisão da logística e a pronta vai ao ESTOQUE
--     sem dono — o pedido aparece em PCP → Cancelados como "Excluído no Tiny".
--     A detecção olha só a conta da LOJA (onde moram os pedidos de venda): um
--     "não localizado" na conta da fábrica não marca nem desmarca nada.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_pedidos_excluidos_aplicar()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_novos     bigint[];
  v_voltaram  bigint[];
  v_id        bigint;
  v_numero    integer;
  v_card      bigint;
  v_evento    bigint;
  v_reservas  integer;
  v_m         text;
  v_me        text;
  v_md        text;
  r           record;
begin
  -- o Tiny (a conta da loja) respondeu que o pedido não existe (erro terminal da releitura)
  with achados as (
    select p.id as pedido_id, p.tiny_id, p.numero, f.erro
      from public.tiny_fila f
      join public.pedidos p on p.tiny_id::text = f.chave
     where f.recurso = 'pedido' and f.status = 'vazio'
       and coalesce(f.conta, 'loja') = 'loja'
       and (f.erro ilike '%não localizad%' or f.erro ilike '%nao localizad%' or f.erro like 'codigo 32:%')
  ),
  gravados as (
    insert into public.plt_pedidos_excluidos_tiny as x (pedido_id, tiny_id, numero, erro)
    select a.pedido_id, a.tiny_id, a.numero, a.erro from achados a
    on conflict (pedido_id) do update set conferido_em = now(), erro = excluded.erro
    returning x.pedido_id, (x.xmax = 0) as novo
  )
  select coalesce(array_agg(g.pedido_id) filter (where g.novo), '{}') into v_novos from gravados g;

  -- achado de novo numa conferência seguinte (na conta da loja): a marcação sai
  with voltaram as (
    delete from public.plt_pedidos_excluidos_tiny x
     using public.pedidos p, public.tiny_fila f
     where p.id = x.pedido_id
       and f.recurso = 'pedido' and f.chave = p.tiny_id::text and f.status = 'ok'
       and coalesce(f.conta, 'loja') = 'loja'
    returning x.pedido_id
  )
  select coalesce(array_agg(v.pedido_id), '{}') into v_voltaram from voltaram v;

  -- a fábrica: quem acabou de ser marcado segue o caminho do cancelado (cada pedido
  -- no seu bloco — um problema num não segura os outros, nem a conferência)
  foreach v_id in array v_novos loop
    begin
      select p.numero into v_numero from public.pedidos p where p.id = v_id;
      select c.id into v_card from public.plt_cards c
       where c.pedido_id = v_id and c.tipo = 'pedido' and c.arquivado_em is null
       order by c.id desc limit 1
         for update;
      if v_card is not null then
        v_m := coalesce(current_setting('plt.excluido_maquinaria', true), '');
        perform set_config('plt.excluido_maquinaria', 'on', true);
        -- o fato: a projeção fecha o aviso do PCP; a reação ao cancelamento põe a peça em
        -- produção esperando a decisão da logística e manda a pronta ao ESTOQUE sem dono;
        -- o stand-by aberto fecha (os gatilhos de sempre, agora também para este fato)
        insert into public.plt_eventos (card_id, tipo, origem, observacao, dados)
          values (v_card, 'pedido_excluido_tiny', 'automacao',
                  format('O pedido %s não existe mais no Tiny (foi excluído) — saiu do PCP.', v_numero),
                  jsonb_build_object('numero', v_numero, 'pedido_id', v_id,
                                     'erro', (select x.erro from public.plt_pedidos_excluidos_tiny x where x.pedido_id = v_id)))
          returning id into v_evento;
        perform set_config('plt.excluido_maquinaria', v_m, true);

        -- as peças do ESTOQUE reservadas para ele voltam a ficar livres (como no cancelamento)
        v_me := coalesce(current_setting('plt.estoque_maquinaria', true), '');
        perform set_config('plt.estoque_maquinaria', 'on', true);
        v_reservas := 0;
        for r in
          select c.id, c.setor_atual_id, c.reservada_item_seq, c.reservada_indice, c.produto_tiny_id
            from public.plt_cards c
           where c.reservada_pedido_id = v_id and c.arquivado_em is null
           order by c.id
             for update
        loop
          insert into public.plt_eventos (card_id, tipo, origem, setor_origem_id, observacao, dados)
            values (r.id, 'peca_reserva_desfeita', 'automacao', r.setor_atual_id,
                    format('O pedido %s foi excluído no Tiny — a peça volta a ficar livre.', v_numero),
                    jsonb_build_object('motivo', 'pedido_excluido_no_tiny', 'pedido_id', v_id,
                                       'numero', v_numero, 'item_seq', r.reservada_item_seq,
                                       'indice_unidade', r.reservada_indice, 'produto_tiny_id', r.produto_tiny_id));
          v_reservas := v_reservas + 1;
        end loop;
        perform set_config('plt.estoque_maquinaria', v_me, true);

        -- o sino da logística (os administradores entram pela régua do público)
        perform plt_privado.fn_avisar_publico(
          'pedido_excluido_no_tiny', 'logistica', v_evento, v_card,
          format('Pedido %s excluído no Tiny', v_numero),
          format('O pedido %s não existe mais no Tiny (foi excluído). Ele saiu do PCP.', v_numero));
        perform plt_privado.fn_avisar('pcp');
      end if;
    exception when others then
      begin
        perform plt_privado.fn_alertar_erro(
          'automacao_erro', 'pedido_excluido:' || v_id,
          format('O pedido %s foi excluído no Tiny e a plataforma não terminou de tirá-lo do PCP', v_numero),
          format('A conferência com o Tiny marcou o pedido %s como excluído, mas a plataforma não conseguiu gravar a saída dele: %s', v_numero, sqlerrm),
          jsonb_build_object('pedido', v_numero, 'pedido_id', v_id, 'erro', sqlerrm),
          interval '1 hour', v_card);
      exception when others then
        raise warning 'Pedido excluído no Tiny (%): a saída do PCP não foi gravada agora: %', v_id, sqlerrm;
      end;
    end;
  end loop;

  -- o reencontrado no Tiny: o fato no card do pedido (a regra do PCP o traz de volta
  -- sozinha — lê a lista) e as peças que esperavam a decisão voltam a ser só dele
  foreach v_id in array v_voltaram loop
    begin
      select p.numero into v_numero from public.pedidos p where p.id = v_id;
      select c.id into v_card from public.plt_cards c
       where c.pedido_id = v_id and c.tipo = 'pedido' and c.arquivado_em is null
       order by c.id desc limit 1;
      if v_card is not null then
        v_m := coalesce(current_setting('plt.excluido_maquinaria', true), '');
        perform set_config('plt.excluido_maquinaria', 'on', true);
        insert into public.plt_eventos (card_id, tipo, origem, observacao, dados)
          values (v_card, 'pedido_reencontrado_tiny', 'automacao',
                  format('O Tiny achou o pedido %s de novo — ele volta a valer.', v_numero),
                  jsonb_build_object('numero', v_numero, 'pedido_id', v_id));
        perform set_config('plt.excluido_maquinaria', v_m, true);
        if not plt_privado.fn_pedido_cancelado(v_id) then
          v_md := coalesce(current_setting('plt.destino_maquinaria', true), '');
          perform set_config('plt.destino_maquinaria', 'on', true);
          for r in
            select u.id, u.setor_atual_id, u.etapa_atual_id
              from public.plt_cards u
             where u.pedido_id = v_id and u.tipo = 'unidade' and u.destino_pendente_em is not null
             order by u.id
               for update
          loop
            insert into public.plt_eventos (card_id, tipo, origem, setor_origem_id, etapa_origem_id, observacao, dados)
              values (r.id, 'destino_decidido', 'automacao', r.setor_atual_id, r.etapa_atual_id,
                      format('O Tiny achou o pedido %s de novo — o móvel segue com ele.', v_numero),
                      jsonb_build_object('destino', 'descancelado', 'automatico', true, 'pedido_id', v_id,
                                         'numero', v_numero, 'motivo', 'pedido_reencontrado_tiny'));
          end loop;
          perform set_config('plt.destino_maquinaria', v_md, true);
        end if;
        perform plt_privado.fn_avisar('pcp');
      end if;
    exception when others then
      raise warning 'Pedido reencontrado no Tiny (%): o fato não foi gravado agora: %', v_id, sqlerrm;
    end;
  end loop;

  -- a tela pronta do Comercial acompanha (o pedido sai / volta)
  foreach v_id in array (v_novos || v_voltaram) loop
    perform plt_privado.fn_comercial_refazer_pedido(v_id);
  end loop;

  -- a trilha (o sistema): quem saiu e quem voltou
  if cardinality(v_novos) > 0 then
    insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    select null, 'pedido_excluido_no_tiny',
           jsonb_build_object('pedidos', jsonb_agg(p.numero order by p.numero), 'motivo', 'a conferência com o Tiny não achou o pedido')
      from public.pedidos p where p.id = any(v_novos);
  end if;
  if cardinality(v_voltaram) > 0 then
    insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    select null, 'pedido_voltou_no_tiny',
           jsonb_build_object('pedidos', jsonb_agg(p.numero order by p.numero), 'motivo', 'a conferência com o Tiny achou o pedido de novo')
      from public.pedidos p where p.id = any(v_voltaram);
  end if;

  return jsonb_build_object(
    'pedidos', coalesce((select jsonb_agg(x.numero order by x.numero desc) from public.plt_pedidos_excluidos_tiny x), '[]'::jsonb),
    'novos', cardinality(v_novos),
    'voltaram', cardinality(v_voltaram));
end;
$$;


-- ----------------------------------------------------------------------------
-- 4 · O pedido vivo (rotas, Expedição, programação) e o "A entregar" deixam de fora o cancelado pela plataforma (o excluído no Tiny já ficava de fora)
-- ----------------------------------------------------------------------------
-- (recriada da vigente — 20261109020000_plt_pedido_adiantado_tiny.sql (3 definições ao todo))
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
  WHERE pc.tipo = 'pedido'::text AND pc.arquivado_em IS NULL AND pc.entrega_evento_id IS NULL AND pc.cancelado_plataforma_em IS NULL AND (plt_privado.fn_situacao_normalizada(p.situacao) <> ALL (ARRAY['entregue'::text, 'nao_entregue'::text, 'cancelado'::text])) AND (NOT plt_privado.fn_tiny_tirou_do_pcp(p.situacao) OR (EXISTS ( SELECT 1
           FROM plt_cards cu
          WHERE cu.pedido_id = p.id AND cu.tipo = 'unidade'::text AND cu.arquivado_em IS NULL)) OR (EXISTS ( SELECT 1
           FROM plt_privado.vw_pedidos_adiantados_falta af
          WHERE af.pedido_id = p.id))) AND NOT (EXISTS ( SELECT 1
           FROM plt_pedidos_excluidos_tiny x
          WHERE x.pedido_id = p.id));

-- (recriada da vigente — 20261109030000_plt_entrega_dia_real.sql (8 definições ao todo))
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
                                 where x.pedido_id = p.id)
                -- SESSAO-50: o cancelado pela plataforma sai na hora (o Tiny confirma depois)
                and pc.cancelado_plataforma_em is null))
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


-- ----------------------------------------------------------------------------
-- 4b · Os 12 leitores da regra única do PCP passam a chamar a de 5 argumentos (o conjunto dos excluídos calculado uma vez; a marca do cancelado pela plataforma)
-- ----------------------------------------------------------------------------
-- (recriada da vigente — 20261111010000_plt_sessao48_base.sql (1 definições ao todo))
create or replace function plt_privado.fn_cancelar_fabricacao(
  p_card_id bigint, p_etapa_id bigint, p_usuario uuid, p_origem text, p_ref bigint)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card   public.plt_cards%rowtype;
  v_etapa  public.plt_etapas%rowtype;
  v_pedido public.pedidos%rowtype;
  v_pc     public.plt_cards%rowtype;
  v_pai    public.plt_cards%rowtype;
  v_setor  text;
  v_volta  boolean := false;
  v_ev     bigint;
  v_m1     text;
  v_m2     text;
  v_quem   text;
  v_nome   text;
  v_produto bigint;
begin
  select * into v_card from public.plt_cards where id = p_card_id for update;
  select * into v_etapa from public.plt_etapas where id = p_etapa_id;
  if v_card.id is null or v_card.tipo <> 'unidade' or not coalesce(v_etapa.cancela_fabricacao, false) then
    return null;
  end if;
  v_produto := coalesce(v_card.produto_tiny_id, plt_privado.fn_produto_do_item(v_card.item_codigo, v_card.item_descricao));
  -- já cancelada pelo mesmo motivo: um efeito só (soltar duas vezes, a API de novo)
  if v_card.cancelada_em is not null and v_card.cancelada_motivo is not distinct from v_etapa.cancela_motivo then
    return null;
  end if;
  select s.nome into v_setor from public.plt_setores s where s.id = v_etapa.setor_id;
  if v_card.pedido_id is not null then
    select * into v_pedido from public.pedidos where id = v_card.pedido_id;
    select * into v_pc from public.plt_cards where pedido_id = v_card.pedido_id and tipo = 'pedido';
    -- a vaga volta ao PCP só com o pedido vivo PARA O PCP (a regra única): o
    -- cancelado no Tiny, o adiantado, o entregue e o removido não recebem aviso
    v_volta := v_pc.id is not null and v_pc.arquivado_em is null and v_pc.entrega_evento_id is null
               and not plt_privado.fn_fora_do_pcp(v_pedido.situacao, v_pc.volta_pcp_em, v_pc.removido_pcp_em, v_pc.pedido_id in (select xexc.pedido_id from public.plt_pedidos_excluidos_tiny xexc), v_pc.cancelado_plataforma_em);
  end if;
  if v_card.card_pai_id is not null then
    select * into v_pai from public.plt_cards where id = v_card.card_pai_id;
  end if;

  v_m1 := coalesce(current_setting('plt.cancelamento_maquinaria', true), '');
  v_m2 := coalesce(current_setting('plt.destino_maquinaria', true), '');

  -- frente 3: a peça de pedido cancelado no Tiny esperando a decisão — a decisão é esta
  if v_card.destino_pendente_em is not null then
    perform set_config('plt.destino_maquinaria', 'on', true);
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, evento_referencia_id, observacao, dados)
      values (v_card.id, 'destino_decidido', p_usuario, p_origem, p_ref,
              'Fabricação cancelada — é o destino do móvel do pedido cancelado.',
              jsonb_build_object('destino', 'cancelar', 'pedido_id', v_card.pedido_id, 'numero', v_pedido.numero));
    perform set_config('plt.destino_maquinaria', v_m2, true);
  end if;

  perform set_config('plt.cancelamento_maquinaria', 'on', true);
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, evento_referencia_id,
                                  setor_origem_id, etapa_origem_id, observacao, dados)
    values (v_card.id, 'fabricacao_cancelada', p_usuario, p_origem, p_ref,
            v_etapa.setor_id, v_etapa.id,
            case v_etapa.cancela_motivo
              when 'nao_encontrada' then 'Peça não encontrada — saiu da produção.'
              else 'Fabricação cancelada — a peça saiu da produção.' end,
            jsonb_build_object(
              'motivo',          v_etapa.cancela_motivo,
              'etapa_id',        v_etapa.id,
              'etapa',           v_etapa.nome,
              'setor_id',        v_etapa.setor_id,
              'setor',           v_setor,
              'pedido_id',       v_card.pedido_id,
              'numero',          v_pedido.numero,
              'card_pedido_id',  v_pc.id,
              'vaga_volta',      v_volta,
              'reposicao_id',    case when v_pai.tipo = 'reposicao' then v_pai.id end,
              'item_seq',        v_card.item_seq,
              'indice_unidade',  v_card.indice_unidade,
              'total_unidades',  v_card.total_unidades,
              'troca',           v_card.cancelada_em is not null))
    returning id into v_ev;
  perform set_config('plt.cancelamento_maquinaria', v_m1, true);

  -- a peça de pedido perde o pedido (a vaga se reabre pela regra de sempre — fn_vagas_pedido);
  -- a de reposição só perde a peça: o pai continua o mesmo e a vaga segue liberada
  if v_card.pedido_id is not null then
    insert into public.plt_eventos (card_id, tipo, origem, evento_referencia_id, observacao, dados)
      values (v_card.id, 'unidade_desvinculada', 'automacao', v_ev,
              'Fabricação cancelada — a peça saiu do pedido ' || coalesce(v_pedido.numero::text, '')
                || case when v_volta then ' e a vaga voltou ao PCP.' else '.' end,
              jsonb_build_object(
                'motivo',          'fabricacao_cancelada',
                'pedido_id',       v_card.pedido_id,
                'numero',          v_pedido.numero,
                'card_pedido_id',  v_pc.id,
                'produto_tiny_id', v_produto,
                -- E-256: a peça do catálogo que perde o pedido deixa de ter o card do pedido
                -- como pai (senão entra na trava "uma peça por vaga" das peças sem pedido e
                -- cancelar de novo a mesma vaga, depois de liberada outra vez, seria recusado);
                -- a de móvel fora do catálogo precisa de um pai (a coerência da peça — E-254):
                -- fica o card do pedido
                'sem_pai',         v_produto is not null,
                'card_pai_id',     case when v_produto is null and v_card.card_pai_id is null then v_pc.id end));
  end if;

  -- o sino do PCP (logística e admin): a vaga voltou
  if v_volta and coalesce(current_setting('plt.cancelamento_sem_aviso', true), '') <> 'on' then
    select u.nome into v_quem from public.plt_usuarios u where u.id = p_usuario;
    v_nome := coalesce(nullif(btrim(v_card.item_descricao), ''), 'A peça');
    perform plt_privado.fn_avisar_publico(
      'peca_cancelada_pcp', 'pcp', v_ev, v_pc.id,
      format('%s · pedido %s',
             case v_etapa.cancela_motivo when 'nao_encontrada' then 'Peça não encontrada' else 'Peça cancelada na produção' end,
             v_pedido.numero),
      format('%s (%s/%s) do pedido %s foi %s na %s%s. A vaga voltou ao PCP.',
             v_nome, v_card.indice_unidade, v_card.total_unidades, v_pedido.numero,
             case v_etapa.cancela_motivo when 'nao_encontrada' then 'marcada como não encontrada' else 'cancelada' end,
             coalesce(v_setor, 'produção'), coalesce(' por ' || v_quem, '')));
  end if;
  if v_volta then
    perform plt_privado.fn_avisar('pcp');
  end if;
  return v_ev;
end;
$$;

-- (recriada da vigente — 20261111010000_plt_sessao48_base.sql (1 definições ao todo))
create or replace function plt_privado.fn_retomar_fabricacao(
  p_card_id bigint, p_usuario uuid, p_origem text, p_ref bigint)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card     public.plt_cards%rowtype;
  v_pedido   public.pedidos%rowtype;
  v_pc       public.plt_cards%rowtype;
  v_producao boolean;
  v_volta    boolean := false;
  v_chave    text;
  v_ev       bigint;
  v_m1       text;
begin
  select * into v_card from public.plt_cards where id = p_card_id for update;
  if v_card.id is null or v_card.tipo <> 'unidade' or v_card.cancelada_em is null then
    return null;
  end if;
  select s.papel_no_fluxo = 'producao' into v_producao from public.plt_setores s where s.id = v_card.setor_atual_id;
  -- volta ao pedido só quando: a peça voltou a uma etapa de PRODUÇÃO, o pedido
  -- segue no PCP e a vaga do mesmo móvel ainda está aberta (nem peça nem reserva
  -- do estoque nela). Senão, volta sem dono (provisória da demanda). A
  -- recuperação pelo admin (frente 4) volta sempre sem dono.
  if v_card.cancelada_pedido_id is not null and v_card.pedido_id is null and coalesce(v_producao, false)
     and coalesce(current_setting('plt.retomada_sem_dono', true), '') <> 'on' then
    select * into v_pedido from public.pedidos where id = v_card.cancelada_pedido_id;
    select * into v_pc from public.plt_cards where pedido_id = v_card.cancelada_pedido_id and tipo = 'pedido';
    v_chave := plt_privado.fn_chave_peca(plt_privado.fn_produto_do_item(v_card.item_codigo, v_card.item_descricao),
                                         v_card.item_codigo, v_card.item_descricao);
    v_volta := v_pc.id is not null and v_pc.arquivado_em is null and v_pc.entrega_evento_id is null
               and not plt_privado.fn_fora_do_pcp(v_pedido.situacao, v_pc.volta_pcp_em, v_pc.removido_pcp_em, v_pc.pedido_id in (select xexc.pedido_id from public.plt_pedidos_excluidos_tiny xexc), v_pc.cancelado_plataforma_em)
               and exists (select 1 from plt_privado.fn_vagas_pedido(v_card.cancelada_pedido_id) w
                            where w.card_id is null and w.reserva_card_id is null and w.chave = v_chave);
  elsif v_card.cancelada_pedido_id is not null then
    select * into v_pedido from public.pedidos where id = v_card.cancelada_pedido_id;
  end if;

  v_m1 := coalesce(current_setting('plt.cancelamento_maquinaria', true), '');
  perform set_config('plt.cancelamento_maquinaria', 'on', true);
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, evento_referencia_id, observacao, dados)
    values (v_card.id, 'fabricacao_retomada', p_usuario, p_origem, p_ref,
            case when v_volta then 'Fabricação retomada — a peça voltou a ser do pedido ' || v_pedido.numero || '.'
                 when v_card.cancelada_pedido_id is not null then 'Fabricação retomada — a peça voltou à produção, sem dono.'
                 else 'Fabricação retomada — a peça voltou à produção.' end,
            jsonb_build_object(
              'motivo_antes',    v_card.cancelada_motivo,
              'cancelada_em',    v_card.cancelada_em,
              'pedido_id',       v_card.cancelada_pedido_id,
              'numero',          v_pedido.numero,
              'volta_ao_pedido', v_volta))
    returning id into v_ev;
  perform set_config('plt.cancelamento_maquinaria', v_m1, true);

  -- a peça volta a ser do pedido ONDE ESTÁ (a maquinaria da D-201: peca_vinculada)
  if v_volta then
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id,
                                    evento_referencia_id, observacao, dados)
      values (v_card.id, 'peca_vinculada', p_usuario, p_origem, v_card.setor_atual_id, v_card.etapa_atual_id, v_ev,
              'A peça voltou a ser do pedido ' || v_pedido.numero || ' ('
                || coalesce(v_card.indice_unidade::text, '?') || '/' || coalesce(v_card.total_unidades::text, '?') || ').',
              jsonb_build_object(
                'pedido_id',      v_card.cancelada_pedido_id,
                'numero',         v_pedido.numero,
                -- o pai volta a ser o card do pedido (a peça do catálogo o tinha perdido — E-256)
                'card_pai_id',    v_pc.id,
                'item_seq',       v_card.item_seq,
                'indice_unidade', v_card.indice_unidade,
                'total_unidades', v_card.total_unidades,
                'item_codigo',    v_card.item_codigo,
                'item_descricao', v_card.item_descricao,
                'retomada',       true));
    perform plt_privado.fn_avisar('pcp');
  end if;
  return v_ev;
end;
$$;

-- (recriada da vigente — 20261111010000_plt_sessao48_base.sql (10 definições ao todo))
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
              and not plt_privado.fn_fora_do_pcp(p.situacao, c.volta_pcp_em, c.removido_pcp_em, c.pedido_id in (select xexc.pedido_id from public.plt_pedidos_excluidos_tiny xexc), c.cancelado_plataforma_em)
              -- D-63: sem nada a produzir (só frete), o pedido não espera
              -- liberação — vai direto para Pedidos em aguardo.
              and exists (select 1 from plt_privado.vw_itens_producao v
                           where v.pedido_id = p.id and v.unidades > 0)))
   order by c.desde asc nulls last, c.id
   limit least(greatest(coalesce(p_limite, 10), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

-- (recriada da vigente — 20261111010000_plt_sessao48_base.sql (7 definições ao todo))
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
                and not plt_privado.fn_fora_do_pcp(p.situacao, c.volta_pcp_em, c.removido_pcp_em, c.pedido_id in (select xexc.pedido_id from public.plt_pedidos_excluidos_tiny xexc), c.cancelado_plataforma_em)
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

-- (recriada da vigente — 20261111030000_plt_cancelado_pergunta_destino.sql (1 definições ao todo))
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
         or plt_privado.fn_fora_do_pcp(v_alvo_p.situacao, v_alvo.volta_pcp_em, v_alvo.removido_pcp_em, v_alvo.pedido_id in (select xexc.pedido_id from public.plt_pedidos_excluidos_tiny xexc), v_alvo.cancelado_plataforma_em)
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

-- (recriada da vigente — 20261111030000_plt_cancelado_pergunta_destino.sql (1 definições ao todo))
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
  -- a fila do PCP: o card do pedido aguardando liberação (o índice parcial
  -- plt_cards_pcp_abertos_idx) — UMA passada para todas as peças, sem juntar o
  -- pedido nem chamar regra por linha (E-238)
  fila_pcp as materialized (
    select pc.id as card_id, pc.pedido_id, pc.desde, pc.standby_desde is not null as standby,
           pc.volta_pcp_em, pc.removido_pcp_em, pc.cancelado_plataforma_em
      from public.plt_cards pc
     where exists (select 1 from moveis)
       and pc.tipo = 'pedido' and pc.liberado_completo_em is null and pc.arquivado_em is null
       -- "= any(array(…))": o setor resolvido uma vez — o índice da fila é usado (no
       -- ensaio ×100, com "in (select …)" o planejador lia os 30 mil cards do PCP)
       and pc.setor_atual_id = any (array(select s.id from public.plt_setores s where s.papel_no_fluxo = 'entrada'))
       and pc.entrega_evento_id is null
       and pc.pedido_id <> v_card.pedido_id
  ),
  -- × os itens com algum dos móveis, pela chave do item (pedido, seq): o custo é o
  -- tamanho da fila, nunca o de quantas vendas o móvel já teve (no ensaio ×100, juntar
  -- pelo índice do SKU lia 113 mil itens dos 10 móveis — o dobro do tempo)
  fila as materialized (
    select q.card_id, q.pedido_id, q.desde, q.standby, q.volta_pcp_em, q.removido_pcp_em, q.cancelado_plataforma_em, i.codigo
      from fila_pcp q
      cross join lateral (
        select pi.codigo from public.pedido_itens pi
         where pi.pedido_id = q.pedido_id
           and pi.codigo in (select m.item_codigo from moveis m)) i
  ),
  cand as (
    select m.chave, z.*
      from moveis m
      cross join lateral (
        select o.card_id, o.pedido_id, o.desde, o.standby, p2.numero, p2.cliente_id, p2.data_prevista, v.vagas
          from (
            -- os que têm ESTE móvel, o que espera há mais tempo no PCP primeiro (a ordem
            -- da fila do PCP; teto de 200 na procura — Lei §6); o "limit" trava a ordem e
            -- só então vêm a regra do PCP e a conta das vagas, linha a linha, até o 10º
            select distinct f.card_id, f.pedido_id, f.desde, f.standby, f.volta_pcp_em, f.removido_pcp_em, f.cancelado_plataforma_em
              from fila f
             where f.codigo = m.item_codigo
             order by f.desde nulls last, f.card_id
             limit 200) o
          cross join lateral (
            select p.numero, p.cliente_id, p.data_prevista, p.situacao
              from public.pedidos p where p.id = o.pedido_id) p2
          cross join lateral (
            select count(*)::int as vagas
              from plt_privado.fn_vagas_pedido(o.pedido_id) w
             where w.card_id is null and w.reserva_card_id is null and w.chave = m.chave) v
         where not plt_privado.fn_fora_do_pcp(p2.situacao, o.volta_pcp_em, o.removido_pcp_em, o.pedido_id in (select xexc.pedido_id from public.plt_pedidos_excluidos_tiny xexc), o.cancelado_plataforma_em)
           and v.vagas > 0
         order by o.desde nulls last, o.card_id
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
                           order by c.desde nulls last, c.card_id) as lista
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
    -- SESSAO-50: o excluído no Tiny e o cancelado pela plataforma também (o rótulo da janela)
    'cancelado', plt_privado.fn_pedido_cancelado(v_p.id),
    'motivo_cancelamento', case when v_card.cancelado_plataforma_em is not null then 'plataforma'
                                when exists (select 1 from public.plt_pedidos_excluidos_tiny x where x.pedido_id = v_p.id) then 'excluido'
                                when plt_privado.fn_situacao_normalizada(v_p.situacao) = 'cancelado' then 'tiny' end,
    'cancelado_em', (select max(e.ocorrido_em) from public.plt_eventos e
                      where e.card_id = v_card.id and e.tipo in ('pedido_cancelado', 'pedido_cancelado_plataforma', 'pedido_excluido_tiny')),
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
                       where e1.card_id = v_card.id and e1.tipo in ('pedido_cancelado', 'pedido_cancelado_plataforma', 'pedido_excluido_tiny')) pp
                join public.plt_eventos d on d.card_id = pp.card_id and d.tipo = 'destino_decidido'
                                         and d.dados ->> 'pedido_id' = v_card.pedido_id::text
                join public.plt_cards c on c.id = d.card_id
                left join public.plt_usuarios u on u.id = d.usuario_id
               order by d.id desc
               limit 50) z), '[]'::jsonb)
  );
end;
$$;

-- (recriada da vigente — 20261111020000_plt_pcp_aviso_remover.sql (1 definições ao todo))
create or replace function public.plt_fn_pcp_devolver(p_card_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu     uuid := plt_privado.fn_usuario_atual();
  v_card   public.plt_cards%rowtype;
  v_pedido public.pedidos%rowtype;
  v_m      text;
begin
  if v_eu is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Devolver ao PCP é gesto do PCP, da logística ou do admin.'
      using errcode = 'insufficient_privilege';
  end if;
  select * into v_card from public.plt_cards where id = p_card_id for update;
  if v_card.id is null or v_card.tipo <> 'pedido' then
    raise exception 'Pedido não encontrado.' using errcode = 'no_data_found';
  end if;
  select * into v_pedido from public.pedidos where id = v_card.pedido_id;
  -- não está removido (ou já foi devolvido): um efeito só
  if v_card.removido_pcp_em is null then
    return jsonb_build_object('feito', false, 'motivo', 'nao_removido', 'numero', v_pedido.numero);
  end if;

  v_m := coalesce(current_setting('plt.pcp_aviso_maquinaria', true), '');
  perform set_config('plt.pcp_aviso_maquinaria', 'on', true);
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, observacao, dados)
    values (v_card.id, 'pedido_devolvido_pcp', v_eu, 'interface', v_card.setor_atual_id,
            case when v_card.removido_pcp_motivo = 'oculto'
                 then 'Recuperado dos pedidos ocultos — volta ao PCP para liberar.'
                 else 'Devolvido ao PCP — volta a aguardar liberação.' end,
            jsonb_build_object('numero', v_pedido.numero, 'removido_em', v_card.removido_pcp_em,
                               'motivo_antes', v_card.removido_pcp_motivo, 'texto_antes', v_card.removido_pcp_texto));
  perform set_config('plt.pcp_aviso_maquinaria', v_m, true);

  return jsonb_build_object(
    'feito', true, 'numero', v_pedido.numero,
    -- o Tiny manda (D-132): cancelado, faturado, entregue… o pedido sai da lista
    -- de removidos mas não volta ao quadro — a tela diz isso
    'fora_pelo_tiny', plt_privado.fn_fora_do_pcp(v_pedido.situacao, v_card.volta_pcp_em, null, v_card.pedido_id in (select xexc.pedido_id from public.plt_pedidos_excluidos_tiny xexc), v_card.cancelado_plataforma_em),
    'situacao', v_pedido.situacao,
    'standby', v_card.standby_desde is not null,
    'liberado_completo', v_card.liberado_completo_em is not null,
    -- SESSAO-50: "volta ao PCP com N produtos para liberar" — as vagas abertas (as peças
    -- ocultadas junto perderam o pedido: as vagas delas reabrem; nenhuma volta para coluna)
    'a_liberar', (select count(*)::int from plt_privado.fn_vagas_pedido(v_card.pedido_id) w
                   where w.card_id is null and w.reserva_card_id is null));
end;
$$;

-- (recriada da vigente — 20261111010000_plt_sessao48_base.sql (8 definições ao todo))
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
                and not plt_privado.fn_fora_do_pcp(p.situacao, c.volta_pcp_em, c.removido_pcp_em, c.pedido_id in (select xexc.pedido_id from public.plt_pedidos_excluidos_tiny xexc), c.cancelado_plataforma_em)
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
                -- SESSAO-48 (frente 2): a peça cancelada na produção — o selo e a janela "O que aconteceu?"
                || case when c.pcp_aviso_em is null then '{}'::jsonb
                        else jsonb_build_object('aviso_cancelada', plt_privado.fn_pcp_aviso_resumo(c.id)) end
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

-- (recriada da vigente — 20261111010000_plt_sessao48_base.sql (3 definições ao todo))
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
  -- SESSAO-48 (frente 2): o pedido que o PCP tirou da linha de produção não espera no PCP
  if v_card.removido_pcp_em is not null then
    raise exception 'Este pedido foi removido do PCP — devolva-o ao PCP (aba Cancelados e removidos) antes de pôr em stand-by.'
      using errcode = 'check_violation';
  end if;
  select * into v_pedido from public.pedidos where id = v_card.pedido_id;
  -- SESSAO-47: a regra única (D-132 + a marca). E a peça liberada com "não lançar
  -- agora" segura o pedido mesmo com o Tiny adiante (Faturado, Pronto para envio,
  -- Enviado) — a porta de liberar peça liga a marca; antes o gesto inteiro caía.
  if v_pedido.id is null
     or (plt_privado.fn_fora_do_pcp(v_pedido.situacao, v_card.volta_pcp_em, v_card.removido_pcp_em, v_card.pedido_id in (select xexc.pedido_id from public.plt_pedidos_excluidos_tiny xexc), v_card.cancelado_plataforma_em)
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

-- (recriada da vigente — 20261111020000_plt_pcp_aviso_remover.sql (3 definições ao todo))
create or replace function public.plt_fn_pedidos_cancelados(
  p_busca     text        default null,
  p_limite    integer     default 20,
  p_depois_em timestamptz default null,  -- o cursor: "saiu em" da última linha mostrada…
  p_depois_id bigint      default null   -- …e o card dela (o desempate)
)
returns table (
  card_id           bigint,
  pedido_id         bigint,
  numero            integer,
  cliente_nome      text,
  data_pedido       date,
  situacao          text,
  cancelado_no_tiny boolean,
  cancelado_em      timestamptz,
  removido_em       timestamptz,
  removido_motivo   text,
  removido_texto    text,
  removido_por      text,
  saiu_em           timestamptz,
  total_unidades    integer,
  em_producao       integer,
  prontas           integer,
  no_estoque        integer,
  esperando_decisao integer,
  pode_devolver     boolean,
  tem_mais          boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_lim    integer     := least(greatest(coalesce(p_limite, 20), 1), 100);
  v_ate    timestamptz := coalesce(p_depois_em, 'infinity'::timestamptz);
  v_id     bigint      := coalesce(p_depois_id, 9223372036854775807);
  v_teto   constant integer := 150;  -- com filtro: quantas linhas cada metade lê antes do caminho do filtro raro
  v_txt    text        := nullif(btrim(coalesce(p_busca, '')), '');
  v_ativo  boolean;
  v_num    text;
  v_nome   text;
  v_numb   bigint;
  v_cabe   boolean;                  -- o nome com 3 letras ou mais: tem o caminho dos trigramas se for raro
  v_raro   boolean := false;         -- vai pelos candidatos do filtro (o nº sempre; o nome raro)
  v_lidas  integer;
  v_ped    bigint;
  r        record;
  v_r_ids  bigint[] := '{}';
  v_r_ch   timestamptz[] := '{}';
  v_c_ids  bigint[] := '{}';
  v_c_ch   timestamptz[] := '{}';
  v_ids    bigint[] := '{}';
  v_chaves timestamptz[] := '{}';
  v_cand   bigint[] := '{}';
begin
  -- como a de antes: sem acesso, lista vazia (a régua de liberar)
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    return;
  end if;
  -- o mesmo filtro dos quadros (D-187): o nº do pedido que começa com o texto,
  -- ou o nome do cliente que o contém (sem acento)
  select f.ativo, f.numero, f.nome into v_ativo, v_num, v_nome from plt_privado.fn_filtro_do_quadro(p_busca) f;
  v_ativo := coalesce(v_ativo, false);
  v_numb  := case when v_num ~ '^[1-9][0-9]{0,8}$' then v_num::bigint end;
  -- nº com mais de 9 dígitos: nenhum pedido tem
  if v_num is not null and v_numb is null then
    return;
  end if;
  -- o nº vai sempre direto aos candidatos (o índice do número); o nome com 3
  -- letras ou mais tenta antes a lista na ordem (o nome comum enche logo)
  v_raro  := v_numb is not null;
  v_cabe  := v_ativo and v_num is null and length(coalesce(v_txt, '')) >= 3;

  -- 1 · os removidos do PCP, na ordem da remoção, até encher a página
  if not v_raro then
    v_lidas := 0;
    for r in select pc.id, pc.removido_pcp_em as chave, pc.pedido_id as ped
               from public.plt_cards pc
              where pc.removido_pcp_em is not null
                and (pc.removido_pcp_em, pc.id) < (v_ate, v_id)
                and pc.tipo = 'pedido' and pc.arquivado_em is null
              order by pc.removido_pcp_em desc, pc.id desc
    loop
      v_lidas := v_lidas + 1;
      if v_cabe and v_lidas > v_teto then
        v_raro := true;
        exit;
      end if;
      continue when v_ativo and not plt_privado.fn_pedido_bate_filtro(r.ped, v_num, v_nome);
      v_r_ids := v_r_ids || r.id;
      v_r_ch  := v_r_ch || r.chave;
      exit when cardinality(v_r_ids) > v_lim;
    end loop;
  end if;

  -- 1 · os cancelados no Tiny (e não removidos), pelo fato pedido_cancelado, do
  -- mais novo para trás — vale o último fato do card (o pedido pode ter voltado
  -- no Tiny e sido cancelado de novo)
  if not v_raro then
    v_lidas := 0;
    for r in select e.id as ev, e.card_id as id, e.ocorrido_em as chave
               from public.plt_eventos e
              where e.tipo = 'pedido_cancelado'
                and e.ocorrido_em <= v_ate
                and (e.ocorrido_em < v_ate or e.card_id < v_id)
              order by e.ocorrido_em desc, e.card_id desc
    loop
      v_lidas := v_lidas + 1;
      if v_cabe and v_lidas > v_teto then
        v_raro := true;
        exit;
      end if;
      v_ped := null;
      select pc.pedido_id into v_ped
        from public.plt_cards pc
        join public.pedidos p on p.id = pc.pedido_id
       where pc.id = r.id and pc.tipo = 'pedido' and pc.arquivado_em is null and pc.removido_pcp_em is null
         and plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado';
      continue when v_ped is null;
      continue when exists (select 1 from public.plt_eventos e2
                             where e2.card_id = r.id and e2.tipo = 'pedido_cancelado'
                               and (e2.ocorrido_em, e2.id) > (r.chave, r.ev));
      continue when v_ativo and not plt_privado.fn_pedido_bate_filtro(v_ped, v_num, v_nome);
      v_c_ids := v_c_ids || r.id;
      v_c_ch  := v_c_ch || r.chave;
      exit when cardinality(v_c_ids) > v_lim;
    end loop;
  end if;

  if not v_raro then
    select coalesce(array_agg(j.id order by j.chave desc, j.id desc), '{}'),
           coalesce(array_agg(j.chave order by j.chave desc, j.id desc), '{}')
      into v_ids, v_chaves
      from (select u.id, u.chave
              from unnest(v_r_ids || v_c_ids, v_r_ch || v_c_ch) as u(id, chave)
             order by u.chave desc, u.id desc
             limit v_lim + 1) j;
  else
    -- 2 · filtro raro: os candidatos vêm do filtro — o nº pelas faixas do índice
    -- do número [x·10^k, (x+1)·10^k); o nome pelos trigramas do nome do cliente
    -- (conferido também sem acento) — e cada um ganha a sua "saída do PCP".
    -- Primeiro os pedidos candidatos (uma lista), depois os cards deles pela
    -- chave (= any): o planejador não sabe quantos números as faixas trazem e,
    -- numa consulta só, juntava TODOS os cards de pedido (ensaio ×100: 1,1 a 4 s)
    if v_numb is not null and length(v_num) >= 4 then
      -- 4 dígitos ou mais: poucos números começam com ele — todos os das faixas
      select coalesce(array_agg(p1.id), '{}') into v_cand
        from generate_series(0, greatest(0, 10 - length(v_num))) as g(e)
        join public.pedidos p1
          on p1.numero >= v_numb * (10::bigint ^ g.e)::bigint
         and p1.numero <  (v_numb + 1) * (10::bigint ^ g.e)::bigint;
    elsif v_numb is not null then
      -- 2–3 dígitos: muitos números — só os cancelados das faixas (o índice
      -- parcial dos cancelados por número) e os removidos do PCP (poucos)
      select coalesce(array_agg(x.id), '{}') into v_cand
        from (select p1.id
                from generate_series(0, greatest(0, 10 - length(v_num))) as g(e)
                join public.pedidos p1
                  on p1.numero >= v_numb * (10::bigint ^ g.e)::bigint
                 and p1.numero <  (v_numb + 1) * (10::bigint ^ g.e)::bigint
                 and plt_privado.fn_situacao_normalizada(p1.situacao) = 'cancelado'
              union
              select pc.pedido_id
                from public.plt_cards pc
                join public.pedidos p3 on p3.id = pc.pedido_id
               where pc.removido_pcp_em is not null and pc.tipo = 'pedido' and pc.arquivado_em is null
                 and p3.numero::text like v_num || '%') x;
    else
      -- o nome: os trigramas do nome do cliente, conferido também sem acento
      select coalesce(array_agg(p2.id), '{}') into v_cand
        from public.clientes c2
        join public.pedidos p2 on p2.cliente_id = c2.id
       where c2.nome ilike '%' || v_txt || '%'
         and plt_privado.fn_nome_comparavel(c2.nome) like '%' || v_nome || '%';
    end if;
    select coalesce(array_agg(x.id order by x.chave desc, x.id desc), '{}'),
           coalesce(array_agg(x.chave order by x.chave desc, x.id desc), '{}')
      into v_ids, v_chaves
      from (
        select k.id, k.chave
          from (
            select pc.id,
                   case when pc.removido_pcp_em is not null then pc.removido_pcp_em
                        when plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado'
                          then (select max(e.ocorrido_em) from public.plt_eventos e
                                 where e.card_id = pc.id and e.tipo = 'pedido_cancelado') end as chave
              from public.plt_cards pc
              join public.pedidos p on p.id = pc.pedido_id
             where pc.pedido_id = any (v_cand) and pc.tipo = 'pedido' and pc.arquivado_em is null
          ) k
         where k.chave is not null and (k.chave, k.id) < (v_ate, v_id)
         order by k.chave desc, k.id desc
         limit v_lim + 1) x;
  end if;

  -- 3 · o que cada linha mostra (só as da página)
  return query
  select pc.id                                                          as card_id,
         p.id                                                           as pedido_id,
         p.numero                                                       as numero,
         coalesce(cl.nome, '')                                          as cliente_nome,
         p.data_pedido                                                  as data_pedido,
         p.situacao                                                     as situacao,
         plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado'  as cancelado_no_tiny,
         case when plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado'
              then canc.em end                                          as cancelado_em,
         pc.removido_pcp_em                                             as removido_em,
         pc.removido_pcp_motivo                                         as removido_motivo,
         pc.removido_pcp_texto                                          as removido_texto,
         ur.nome                                                        as removido_por,
         pg.chave                                                       as saiu_em,
         coalesce(i.total, 0)                                           as total_unidades,
         coalesce(u.em_producao, 0)                                     as em_producao,
         coalesce(u.prontas, 0)                                         as prontas,
         coalesce(d.no_estoque, 0)                                      as no_estoque,
         coalesce(u.esperando, 0)                                       as esperando_decisao,
         -- "Devolver ao PCP" só quando ele volta de verdade: removido, e o Tiny
         -- não o mantém fora (cancelado, faturado, entregue… — D-132)
         pc.removido_pcp_em is not null
           and not plt_privado.fn_fora_do_pcp(p.situacao, pc.volta_pcp_em, null, pc.pedido_id in (select xexc.pedido_id from public.plt_pedidos_excluidos_tiny xexc), pc.cancelado_plataforma_em) as pode_devolver,
         cardinality(v_ids) > v_lim                                     as tem_mais
    from unnest(v_ids, v_chaves) with ordinality as pg(id, chave, ord)
    join public.plt_cards pc on pc.id = pg.id
    join public.pedidos p on p.id = pc.pedido_id
    left join public.clientes cl on cl.id = p.cliente_id
    left join public.plt_eventos er on er.id = pc.removido_pcp_evento_id
    left join public.plt_usuarios ur on ur.id = er.usuario_id
    left join lateral (
      select max(e.ocorrido_em) as em
        from public.plt_eventos e
       where e.card_id = pc.id and e.tipo = 'pedido_cancelado'
    ) canc on true
    left join lateral (
      -- D-63: frete não conta.
      select coalesce(sum(v.unidades), 0)::int as total
        from plt_privado.vw_itens_producao v where v.pedido_id = p.id
    ) i on true
    left join lateral (
      -- peças que ainda carregam o pedido: na produção ou num fim de linha; e as
      -- que esperam a logística decidir o destino (pedido cancelado no Tiny)
      select count(*) filter (where s.papel_no_fluxo <> 'terminal')::int as em_producao,
             count(*) filter (where s.papel_no_fluxo = 'terminal')::int  as prontas,
             count(*) filter (where cu.destino_pendente_em is not null)::int as esperando
        from public.plt_cards cu
        left join public.plt_setores s on s.id = cu.setor_atual_id
       where cu.pedido_id = p.id and cu.tipo = 'unidade' and cu.arquivado_em is null
    ) u on true
    left join lateral (
      -- peças que perderam o pedido e ficaram sem dono NO ESTOQUE (SESSAO-48: a
      -- peça com a fabricação cancelada perde o pedido e não está no estoque)
      select count(*)::int as no_estoque
        from public.plt_cards cu
        join public.plt_setores se on se.id = cu.setor_atual_id and se.codigo = 'estoque'
       where cu.card_pai_id = pc.id and cu.tipo = 'unidade'
         and cu.pedido_id is null and cu.arquivado_em is null and cu.cancelada_em is null
    ) d on true
   where pg.ord <= v_lim
   order by pg.ord;
end;
$$;

-- (recriada da vigente — 20261111010000_plt_sessao48_base.sql (7 definições ao todo))
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
           -- SESSAO-50: cancelado pela plataforma (o Tiny confirma depois)
           when pc.cancelado_plataforma_em is not null then 'cancelado'
           when pc.id is null then 'sem_card'
           when pc.devolucao_evento_id is not null then 'devolvido'
           when pc.entrega_evento_id is not null then 'entregue'
           when pc.arquivado_em is not null then 'arquivado'
           -- SESSAO-38 (↪️ D-156): o PROGRAMADO também está "Em rota" (lançado ou não)
           when pc.lancado_rotas_em is not null or pr.card_id is not null then 'em_rota'
           -- ↪️ SESSAO-48 (frente 2): o PCP tirou o pedido da linha de produção — vale antes de
           -- "aguardando"/"em produção": as peças que seguem não desfazem a remoção
           when pc.removido_pcp_em is not null then 'removido_pcp'
           when coalesce(i.total_unidades, 0) > 0 and coalesce(u.prontas, 0) >= i.total_unidades then 'aguardo'
           when coalesce(u.liberadas, 0) > 0 then 'producao'
           -- D-132: o Tiny já levou adiante e nada foi liberado — segue o Tiny.
           -- ↪️ SESSAO-47: … a não ser que a logística o tenha devolvido ao PCP
           when plt_privado.fn_fora_do_pcp(nu.situacao, pc.volta_pcp_em, pc.removido_pcp_em, pc.pedido_id in (select xexc.pedido_id from public.plt_pedidos_excluidos_tiny xexc), pc.cancelado_plataforma_em) then 'tiny'
           else 'pcp'
         end                                     as situacao_plataforma,
         -- SESSAO-47: o dia REAL da entrega (a projeção do card)
         pc.entrega_em                           as entregue_em,
         ue.nome                                 as entregue_por,
         case when ent.id is null then null
              else coalesce(ent.dados ->> 'fonte', case when ent.usuario_id is null then 'tiny' else 'plataforma' end)
         end                                     as entregue_fonte,
         nu.entregue_tiny,
         coalesce(canc.ocorrido_em, pc.cancelado_plataforma_em) as cancelado_em,
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
         and cu.cancelada_em is null   -- SESSAO-48: a peça cancelada perdeu o pedido (a vaga voltou)
    ) u on true
   where nu.n <= v_lim
   order by nu.numero desc;
end;
$function$;

-- (recriada da vigente — 20261111010000_plt_sessao48_base.sql (3 definições ao todo))
create or replace view plt_privado.vw_standby_na_aba as
  select c.id as card_id, c.standby_evento_id
    from public.plt_cards c
    join public.plt_setores s on s.id = c.setor_atual_id and s.papel_no_fluxo = 'entrada'
    join public.pedidos p on p.id = c.pedido_id
   where c.tipo = 'pedido'
     and c.standby_desde is not null
     and c.arquivado_em is null
     and c.liberado_completo_em is null
     and not plt_privado.fn_fora_do_pcp(p.situacao, c.volta_pcp_em, c.removido_pcp_em, c.pedido_id in (select xexc.pedido_id from public.plt_pedidos_excluidos_tiny xexc), c.cancelado_plataforma_em)   -- SESSAO-47: a regra única
     and exists (select 1 from plt_privado.vw_itens_producao v
                  where v.pedido_id = p.id and v.unidades > 0);


-- ----------------------------------------------------------------------------
-- 4c · A situação "cancelado" no caminho para o Tiny (a fila de saída manda o código da API v2)
-- ----------------------------------------------------------------------------
-- (recriada da vigente — 20261008150000_plt_entregue_nos_dois_lados.sql (1 definições ao todo))
create or replace function plt_privado.fn_tiny_situacao_api(p_situacao text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case plt_privado.fn_situacao_normalizada(p_situacao)
           when 'em_aberto'          then 'aberto'
           when 'aberto'             then 'aberto'
           when 'aprovado'           then 'aprovado'
           when 'preparando_envio'   then 'preparando_envio'
           when 'faturado'           then 'faturado'
           when 'faturado_(atendido)' then 'faturado'
           when 'pronto_para_envio'  then 'pronto_envio'
           when 'pronto_envio'       then 'pronto_envio'
           when 'enviado'            then 'enviado'
           when 'entregue'           then 'enviado'      -- voltar de "entregue" = enviado
           when 'nao_entregue'       then 'nao_entregue'
           when 'cancelado'          then 'cancelado'    -- SESSAO-50: "Cancelar pedido" no PCP
           else 'enviado'
         end;
$$;


-- ----------------------------------------------------------------------------
-- 5 · Frente 4 — os botões "Cancelar pedido" e "Ocultar do PCP" (↩️ revisa a
--     frente 2 da 48: o "Remover do PCP" com três motivos deixa de existir; a
--     máquina dele — o fato pedido_removido_pcp e a projeção removido_pcp_* — é
--     reaproveitada para o Ocultar, com o motivo 'oculto')
-- ----------------------------------------------------------------------------

-- Os dias que o pedido oculto fica na lista "Pedidos ocultos" (padrão 30) — uma
-- configuração, sem número escrito no código. Mora na linha do PCP em plt_setores
-- (o lugar das chaves da casa: a ida ao Tiny mora na linha da ROTAS).
alter table public.plt_setores add column if not exists ocultos_dias integer;
alter table public.plt_setores drop constraint if exists plt_setores_ocultos_dias_ck;
alter table public.plt_setores add constraint plt_setores_ocultos_dias_ck
  check (ocultos_dias is null or ocultos_dias between 1 and 365) not valid;
alter table public.plt_setores validate constraint plt_setores_ocultos_dias_ck;
update public.plt_setores set ocultos_dias = 30 where codigo = 'pcp' and ocultos_dias is null;
comment on column public.plt_setores.ocultos_dias is
  'SESSAO-50 (bloco B): na linha do PCP, quantos dias o pedido ocultado fica na lista "Pedidos ocultos" (padrão 30, de 1 a 365). Depois disso ele só some da lista (filtro na leitura, nada é apagado) e volta só por "Incluir pedido no PCP".';

create or replace function plt_privado.fn_ocultos_dias()
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select s.ocultos_dias from public.plt_setores s where s.codigo = 'pcp'), 30);
$$;
revoke all on function plt_privado.fn_ocultos_dias() from public, anon, authenticated;

create or replace function public.plt_fn_pcp_ocultos_dias(p_dias integer)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu    uuid := plt_privado.fn_usuario_atual();
  v_antes integer := plt_privado.fn_ocultos_dias();
begin
  if v_eu is null or not plt_privado.fn_eh_admin() then
    raise exception 'Mudar quantos dias o pedido oculto fica na lista é gesto do admin.' using errcode = 'insufficient_privilege';
  end if;
  if p_dias is null or p_dias < 1 or p_dias > 365 then
    raise exception 'Escolha de 1 a 365 dias.' using errcode = 'check_violation';
  end if;
  update public.plt_setores set ocultos_dias = p_dias where codigo = 'pcp';
  if v_antes is distinct from p_dias then
    insert into public.plt_logs_atividade (usuario_id, acao, contexto)
      values (v_eu, 'pcp_ocultos_dias', jsonb_build_object('de', v_antes, 'para', p_dias));
  end if;
  perform plt_privado.fn_avisar('pcp');
  return p_dias;
end;
$$;
revoke all on function public.plt_fn_pcp_ocultos_dias(integer) from public, anon;
grant execute on function public.plt_fn_pcp_ocultos_dias(integer) to authenticated;

-- O estado do pedido de cancelamento no Tiny (a fila de saída — o molde é o da
-- volta ao PCP, fn_volta_pcp_resumo): confirmado (o Tiny já mostra Cancelado) ·
-- aceito (o Tiny aceitou; a confirmação chega pelo aviso do Tiny ou pela
-- conferência da madrugada) · esperando · falhando · parado.
create or replace function plt_privado.fn_cancelamento_tiny_estado(p_pedido_id bigint)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
           when plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado' then 'confirmado'
           when f.pedido_id is null or f.motivo <> 'cancelar' then 'aceito'
           when f.parado_em is not null then 'parado'
           when f.ultimo_erro is not null then 'falhando'
           else 'esperando'
         end
    from public.pedidos p
    left join public.plt_tiny_pedido_fila f on f.pedido_id = p.id
   where p.id = p_pedido_id;
$$;
revoke all on function plt_privado.fn_cancelamento_tiny_estado(bigint) from public, anon, authenticated;

-- As peças vivas do pedido e o que acontece com cada uma ao ocultar: a que já
-- está na ROTAS (lançada), a entregue e a pronta de pedido já programado numa
-- rota FICAM (provisória da demanda); a cancelada já perdeu o pedido.
create or replace function plt_privado.fn_pcp_pecas_ocultar(p_card_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with pc as (
    select c.id, c.pedido_id,
           exists (select 1 from public.plt_programacoes pr where pr.card_id = c.id) as programado
      from public.plt_cards c where c.id = p_card_id
  ),
  pecas as (
    select s.nome as setor, s.ordem as s_ordem, s.id as setor_id, et.nome as etapa, et.ordem as e_ordem,
           et.id as etapa_id, s.papel_no_fluxo = 'terminal' as pronta,
           (s.codigo = 'rotas' or u.entrega_evento_id is not null
            or ((select programado from pc) and s.papel_no_fluxo = 'terminal')) as fica,
           count(*)::int as n
      from public.plt_cards u
      left join public.plt_setores s on s.id = u.setor_atual_id
      left join public.plt_etapas et on et.id = u.etapa_atual_id
     where u.pedido_id = (select pedido_id from pc) and u.tipo = 'unidade'
       and u.arquivado_em is null and u.cancelada_em is null
     group by 1, 2, 3, 4, 5, 6, 7, 8
  )
  select jsonb_build_object(
           'ocultaveis', coalesce(sum(p.n) filter (where not p.fica), 0)::int,
           'ficam',      coalesce(sum(p.n) filter (where p.fica), 0)::int,
           'programado', coalesce((select programado from pc), false),
           'onde', coalesce(jsonb_agg(jsonb_build_object('setor', p.setor, 'etapa', p.etapa, 'pronta', p.pronta,
                                                          'fica', p.fica, 'pecas', p.n)
                                      order by p.fica, p.s_ordem nulls last, p.setor_id, p.e_ordem nulls last, p.etapa_id),
                            '[]'::jsonb))
    from pecas p;
$$;
revoke all on function plt_privado.fn_pcp_pecas_ocultar(bigint) from public, anon, authenticated;

-- A leitura dos dois modais (Cancelar e Ocultar): UMA requisição, ao abrir.
create or replace function public.plt_fn_pcp_saida_previa(p_card_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_card public.plt_cards%rowtype;
  v_p    public.pedidos%rowtype;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Cancelar e ocultar pedido é do PCP, da logística ou do admin.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_card from public.plt_cards where id = p_card_id;
  if v_card.id is null or v_card.tipo <> 'pedido' then
    raise exception 'Pedido não encontrado.' using errcode = 'no_data_found';
  end if;
  select * into v_p from public.pedidos where id = v_card.pedido_id;
  return jsonb_build_object(
    'card_id',            v_card.id,
    'pedido_id',          v_p.id,
    'numero',             v_p.numero,
    'cliente',            (select c.nome from public.clientes c where c.id = v_p.cliente_id),
    'situacao',           v_p.situacao,
    'cancelado_no_tiny',  plt_privado.fn_situacao_normalizada(v_p.situacao) = 'cancelado',
    'tiny_ligado',        plt_privado.fn_tiny_entrega_desde() is not null,
    'cancelado_plataforma_em', v_card.cancelado_plataforma_em,
    'tiny_estado',        case when v_card.cancelado_plataforma_em is not null
                               then plt_privado.fn_cancelamento_tiny_estado(v_p.id) end,
    'oculto_em',          v_card.removido_pcp_em,
    'entregue',           v_card.entrega_evento_id is not null,
    'arquivado',          v_card.arquivado_em is not null,
    'ocultos_dias',       plt_privado.fn_ocultos_dias(),
    'pecas',              plt_privado.fn_pcp_pecas_do_pedido(v_p.id),
    'ocultar',            plt_privado.fn_pcp_pecas_ocultar(v_card.id),
    'reservas',           (select count(*)::int from public.plt_cards c
                            where c.reservada_pedido_id = v_p.id and c.arquivado_em is null));
end;
$$;
revoke all on function public.plt_fn_pcp_saida_previa(bigint) from public, anon;
grant execute on function public.plt_fn_pcp_saida_previa(bigint) to authenticated;

-- "Cancelar pedido": cancela também no Tiny (pela fila de saída que já existe —
-- uma vontade por pedido, vale a última) e o pedido sai do PCP NA HORA, sem
-- esperar o Tiny (o fato pedido_cancelado_plataforma e a projeção no card).
-- As peças seguem o caminho do cancelado (a reação de sempre ao fato: a em
-- produção espera a decisão da logística; a pronta vai ao ESTOQUE sem dono);
-- as reservas do estoque soltam. Tocar de novo = um efeito só; com o Tiny
-- parado ou falhando, tocar de novo é o "Tentar de novo".
create or replace function public.plt_fn_pcp_cancelar(p_card_id bigint, p_chave text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu     uuid := plt_privado.fn_usuario_atual();
  v_card   public.plt_cards%rowtype;
  v_p      public.pedidos%rowtype;
  v_pecas  jsonb;
  v_estado text;
  v_fila   text;
  v_ev     bigint;
  v_m      text;
  v_me     text;
  v_res    integer := 0;
  r        record;
begin
  if v_eu is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Cancelar o pedido é gesto do PCP, da logística ou do admin.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_card from public.plt_cards where id = p_card_id for update;
  if v_card.id is null or v_card.tipo <> 'pedido' then
    raise exception 'Pedido não encontrado.' using errcode = 'no_data_found';
  end if;
  select * into v_p from public.pedidos where id = v_card.pedido_id;
  if v_card.entrega_evento_id is not null then
    raise exception 'O pedido % já foi entregue — não dá para cancelar pela plataforma.', v_p.numero
      using errcode = 'check_violation';
  end if;
  if plt_privado.fn_situacao_normalizada(v_p.situacao) = 'cancelado' then
    return jsonb_build_object('feito', false, 'motivo', 'ja_cancelado_no_tiny', 'numero', v_p.numero);
  end if;
  if plt_privado.fn_tiny_entrega_desde() is null then
    raise exception 'A ida ao Tiny está desligada — o cancelamento não chegaria lá. Cancele no Tiny, ou peça a um administrador para ligar "Entregue vai ao Tiny" em Configurações → Caminhões.'
      using errcode = 'check_violation';
  end if;

  -- já cancelado pela plataforma: o mesmo toque de novo não faz nada; com o Tiny
  -- parado ou falhando, é o "Tentar de novo" (o pedido volta para a fila de saída)
  if v_card.cancelado_plataforma_em is not null then
    v_estado := plt_privado.fn_cancelamento_tiny_estado(v_p.id);
    if v_estado in ('parado', 'falhando') then
      v_fila := plt_privado.fn_tiny_pedido_enfileirar(v_p.id, 'cancelado', 'cancelar');
      insert into public.plt_logs_atividade (usuario_id, acao, contexto)
        values (v_eu, 'pedido_cancelamento_reenviado',
                jsonb_build_object('pedido_id', v_p.id, 'numero', v_p.numero, 'estado_antes', v_estado, 'fila', v_fila));
      perform plt_privado.fn_avisar('pcp');
      return jsonb_build_object('feito', true, 'motivo', 'tentar_de_novo', 'numero', v_p.numero, 'tiny', v_fila);
    end if;
    return jsonb_build_object('feito', false, 'motivo', 'ja_cancelado', 'numero', v_p.numero, 'tiny_estado', v_estado);
  end if;

  v_pecas := plt_privado.fn_pcp_pecas_do_pedido(v_p.id);
  v_m := coalesce(current_setting('plt.pcp_saida_maquinaria', true), '');
  perform set_config('plt.pcp_saida_maquinaria', 'on', true);
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, observacao, dados)
    values (v_card.id, 'pedido_cancelado_plataforma', v_eu, 'interface', v_card.setor_atual_id,
            format('Pedido %s cancelado pela plataforma — o cancelamento foi pedido ao Tiny.', v_p.numero),
            jsonb_build_object('numero', v_p.numero, 'pedido_id', v_p.id, 'chave', p_chave,
                               'situacao_antes', v_p.situacao,
                               'em_producao', v_pecas -> 'em_producao', 'prontas', v_pecas -> 'prontas'))
    returning id into v_ev;
  perform set_config('plt.pcp_saida_maquinaria', v_m, true);

  -- as peças do ESTOQUE reservadas para ele voltam a ficar livres (o Tiny, quando
  -- confirmar, faria o mesmo pela releitura das reservas)
  v_me := coalesce(current_setting('plt.estoque_maquinaria', true), '');
  perform set_config('plt.estoque_maquinaria', 'on', true);
  for r in
    select c.id, c.setor_atual_id, c.reservada_item_seq, c.reservada_indice, c.produto_tiny_id
      from public.plt_cards c
     where c.reservada_pedido_id = v_p.id and c.arquivado_em is null
     order by c.id
       for update
  loop
    insert into public.plt_eventos (card_id, tipo, origem, setor_origem_id, observacao, dados)
      values (r.id, 'peca_reserva_desfeita', 'automacao', r.setor_atual_id,
              format('O pedido %s foi cancelado pela plataforma — a peça volta a ficar livre.', v_p.numero),
              jsonb_build_object('motivo', 'pedido_cancelado', 'pedido_id', v_p.id,
                                 'numero', v_p.numero, 'item_seq', r.reservada_item_seq,
                                 'indice_unidade', r.reservada_indice, 'produto_tiny_id', r.produto_tiny_id));
    v_res := v_res + 1;
  end loop;
  perform set_config('plt.estoque_maquinaria', v_me, true);

  -- o Tiny: pela fila de saída (o n8n pede "cancelado" ao Tiny; a resposta volta à fila)
  v_fila := plt_privado.fn_tiny_pedido_enfileirar(v_p.id, 'cancelado', 'cancelar');
  perform plt_privado.fn_avisar('pcp');

  return jsonb_build_object('feito', true, 'numero', v_p.numero, 'tiny', v_fila, 'reservas_soltas', v_res)
         || v_pecas;
end;
$$;
revoke all on function public.plt_fn_pcp_cancelar(bigint, text) from public, anon;
grant execute on function public.plt_fn_pcp_cancelar(bigint, text) to authenticated;

-- "Ocultar do PCP": a remoção da 48 com o motivo 'oculto' — o pedido sai de
-- todas as portas do PCP (D-75) e fica em "Pedidos ocultos" por N dias; o Tiny
-- não muda. "Ocultar o pedido e as peças": cada peça liberada que pode sair
-- (não está na rota nem foi entregue) ganha card_oculto, perde o pedido
-- (unidade_desvinculada — a vaga fica aberta) e é arquivada com registro — sai
-- do quadro e de todas as contas; nada é apagado; as reservas do estoque soltam
-- (provisória da demanda). "Ocultar só o pedido": as peças seguem na produção.
create or replace function public.plt_fn_pcp_ocultar(p_card_id bigint, p_com_pecas boolean default false,
                                                     p_chave text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu        uuid := plt_privado.fn_usuario_atual();
  v_card      public.plt_cards%rowtype;
  v_p         public.pedidos%rowtype;
  v_prog      boolean;
  v_pecas     jsonb;
  v_ev        bigint;
  v_m1        text;
  v_m2        text;
  v_m3        text;
  v_m4        text;
  v_produto   bigint;
  v_ocultadas integer := 0;
  v_res       integer := 0;
  r           record;
begin
  if v_eu is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Ocultar do PCP é gesto do PCP, da logística ou do admin.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_card from public.plt_cards where id = p_card_id for update;
  if v_card.id is null or v_card.tipo <> 'pedido' then
    raise exception 'Pedido não encontrado.' using errcode = 'no_data_found';
  end if;
  select * into v_p from public.pedidos where id = v_card.pedido_id;
  -- já oculto: um efeito só
  if v_card.removido_pcp_em is not null then
    return jsonb_build_object('feito', false, 'motivo', 'ja_oculto', 'numero', v_p.numero);
  end if;
  if v_card.arquivado_em is not null then
    raise exception 'Este pedido está arquivado.' using errcode = 'check_violation';
  end if;
  if v_card.entrega_evento_id is not null then
    raise exception 'Este pedido já foi entregue.' using errcode = 'check_violation';
  end if;
  v_prog := exists (select 1 from public.plt_programacoes pr where pr.card_id = v_card.id);
  v_pecas := plt_privado.fn_pcp_pecas_ocultar(v_card.id);

  v_m1 := coalesce(current_setting('plt.pcp_aviso_maquinaria', true), '');
  perform set_config('plt.pcp_aviso_maquinaria', 'on', true);
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, observacao, dados)
    values (v_card.id, 'pedido_removido_pcp', v_eu, 'interface', v_card.setor_atual_id,
            case when coalesce(p_com_pecas, false) and coalesce((v_pecas ->> 'ocultaveis')::int, 0) > 0
                 then 'Ocultado do PCP com as peças já liberadas — o Tiny não muda.'
                 else 'Ocultado do PCP — o Tiny não muda.' end,
            jsonb_build_object('motivo', 'oculto', 'texto', null, 'numero', v_p.numero,
                               'com_pecas', coalesce(p_com_pecas, false), 'chave', p_chave,
                               'ocultadas', case when coalesce(p_com_pecas, false)
                                                 then coalesce((v_pecas ->> 'ocultaveis')::int, 0) else 0 end,
                               'ficam', case when coalesce(p_com_pecas, false)
                                             then coalesce((v_pecas ->> 'ficam')::int, 0)
                                             else coalesce((v_pecas ->> 'ocultaveis')::int, 0)
                                                  + coalesce((v_pecas ->> 'ficam')::int, 0) end,
                               'aviso_desde', v_card.pcp_aviso_em))
    returning id into v_ev;
  perform set_config('plt.pcp_aviso_maquinaria', v_m1, true);

  if coalesce(p_com_pecas, false) then
    v_m2 := coalesce(current_setting('plt.pcp_saida_maquinaria', true), '');
    v_m3 := coalesce(current_setting('plt.cancelados_maquinaria', true), '');
    v_m4 := coalesce(current_setting('plt.estoque_maquinaria', true), '');
    perform set_config('plt.pcp_saida_maquinaria', 'on', true);
    -- a marca da limpeza das colunas que cancelam: a maquinaria arquiva a peça (a
    -- regra do arquivar — fn_validar_api — pede admin para o gesto de pessoa)
    perform set_config('plt.cancelados_maquinaria', 'on', true);
    for r in
      select u.id, u.setor_atual_id, u.etapa_atual_id, u.card_pai_id, u.item_codigo, u.item_descricao,
             u.produto_tiny_id, s.nome as setor, et.nome as etapa
        from public.plt_cards u
        left join public.plt_setores s on s.id = u.setor_atual_id
        left join public.plt_etapas et on et.id = u.etapa_atual_id
       where u.pedido_id = v_p.id and u.tipo = 'unidade'
         and u.arquivado_em is null and u.cancelada_em is null
         and not (s.codigo = 'rotas' or u.entrega_evento_id is not null
                  or (v_prog and s.papel_no_fluxo = 'terminal'))
       order by u.id
         for update of u
    loop
      perform plt_privado.fn_fechar_tempo_aberto(r.id, 'Peça ocultada com o pedido no PCP: o tempo aberto fecha antes.');
      v_produto := coalesce(r.produto_tiny_id, plt_privado.fn_produto_do_item(r.item_codigo, r.item_descricao));
      insert into public.plt_eventos (card_id, tipo, usuario_id, origem, evento_referencia_id,
                                      setor_origem_id, etapa_origem_id, observacao, dados)
        values (r.id, 'card_oculto', v_eu, 'interface', v_ev, r.setor_atual_id, r.etapa_atual_id,
                format('Ocultada com o pedido %s no PCP.', v_p.numero),
                jsonb_build_object('pedido_id', v_p.id, 'numero', v_p.numero, 'card_pedido_id', v_card.id,
                                   'motivo', 'pedido ocultado no PCP', 'setor', r.setor, 'etapa', r.etapa));
      insert into public.plt_eventos (card_id, tipo, origem, evento_referencia_id, observacao, dados)
        values (r.id, 'unidade_desvinculada', 'automacao', v_ev,
                format('Ocultada com o pedido %s — a peça saiu do pedido (a vaga fica aberta no PCP).', v_p.numero),
                jsonb_build_object(
                  'motivo',          'pedido_ocultado',
                  'pedido_id',       v_p.id,
                  'numero',          v_p.numero,
                  'card_pedido_id',  v_card.id,
                  'produto_tiny_id', v_produto,
                  -- E-254/E-256 (o molde do cancelamento da fabricação)
                  'sem_pai',         v_produto is not null,
                  'card_pai_id',     case when v_produto is null and r.card_pai_id is null then v_card.id end));
      insert into public.plt_eventos (card_id, tipo, usuario_id, origem, evento_referencia_id, observacao, dados)
        values (r.id, 'card_arquivado', v_eu, 'interface', v_ev,
                format('Ocultada com o pedido %s no PCP — saiu do quadro (nada é apagado).', v_p.numero),
                jsonb_build_object('motivo', 'pedido_ocultado_pcp', 'pedido_id', v_p.id, 'numero', v_p.numero));
      v_ocultadas := v_ocultadas + 1;
    end loop;

    perform set_config('plt.estoque_maquinaria', 'on', true);
    for r in
      select c.id, c.setor_atual_id, c.reservada_item_seq, c.reservada_indice, c.produto_tiny_id
        from public.plt_cards c
       where c.reservada_pedido_id = v_p.id and c.arquivado_em is null
       order by c.id
         for update
    loop
      insert into public.plt_eventos (card_id, tipo, origem, setor_origem_id, observacao, dados)
        values (r.id, 'peca_reserva_desfeita', 'automacao', r.setor_atual_id,
                format('O pedido %s foi ocultado no PCP — a peça volta a ficar livre.', v_p.numero),
                jsonb_build_object('motivo', 'pedido_ocultado', 'pedido_id', v_p.id,
                                   'numero', v_p.numero, 'item_seq', r.reservada_item_seq,
                                   'indice_unidade', r.reservada_indice, 'produto_tiny_id', r.produto_tiny_id));
      v_res := v_res + 1;
    end loop;
    perform set_config('plt.estoque_maquinaria', v_m4, true);
    perform set_config('plt.cancelados_maquinaria', v_m3, true);
    perform set_config('plt.pcp_saida_maquinaria', v_m2, true);
  end if;

  perform plt_privado.fn_avisar('pcp');
  return jsonb_build_object('feito', true, 'numero', v_p.numero, 'ocultadas', v_ocultadas,
                            'reservas_soltas', v_res, 'dias', plt_privado.fn_ocultos_dias(),
                            'ficam', plt_privado.fn_pcp_pecas_ocultar(v_card.id));
end;
$$;
revoke all on function public.plt_fn_pcp_ocultar(bigint, boolean, text) from public, anon;
grant execute on function public.plt_fn_pcp_ocultar(bigint, boolean, text) to authenticated;

-- O "Remover do PCP" da 48 deixa de existir: a porta antiga só aceita o 'oculto'
-- (e vira o "Ocultar só o pedido"); os três motivos antigos são recusados com o
-- caminho novo (o site de antes, se ainda aberto em algum aparelho, diz isso).
create or replace function public.plt_fn_pcp_remover(p_card_id bigint, p_motivo text, p_texto text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(p_motivo, '') <> 'oculto' then
    raise exception 'O "Remover do PCP" virou "Cancelar pedido" e "Ocultar do PCP" — atualize a tela e use os botões novos do card do pedido.'
      using errcode = 'check_violation';
  end if;
  return public.plt_fn_pcp_ocultar(p_card_id, false, null);
end;
$$;


-- ----------------------------------------------------------------------------
-- 6 · As duas abas no lugar do "Cancelados e removidos" da 48: "Cancelados" (o
--     do Tiny, o cancelado pela plataforma e o excluído no Tiny, cada um com o
--     seu rótulo) e "Pedidos ocultos" (os dos últimos N dias — filtro na
--     leitura, sem relógio e sem apagar nada). As duas por cursor (quando saiu do
--     PCP, card), sem o total (Lei §6.4 — o molde é a aba da 48, A-216).
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_pcp_cancelados(
  p_busca     text        default null,
  p_limite    integer     default 20,
  p_depois_em timestamptz default null,  -- o cursor: "saiu em" da última linha mostrada…
  p_depois_id bigint      default null   -- …e o card dela (o desempate)
)
returns table (
  card_id           bigint,
  pedido_id         bigint,
  numero            integer,
  cliente_nome      text,
  data_pedido       date,
  situacao          text,
  motivo            text,
  saiu_em           timestamptz,
  cancelado_por     text,
  tiny_estado       text,
  tiny_erro         text,
  total_unidades    integer,
  em_producao       integer,
  prontas           integer,
  no_estoque        integer,
  esperando_decisao integer,
  tem_mais          boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_lim    integer     := least(greatest(coalesce(p_limite, 20), 1), 100);
  v_ate    timestamptz := coalesce(p_depois_em, 'infinity'::timestamptz);
  v_id     bigint      := coalesce(p_depois_id, 9223372036854775807);
  v_teto   constant integer := 150;  -- com filtro: quantas linhas cada parte lê antes do caminho do filtro raro
  v_txt    text        := nullif(btrim(coalesce(p_busca, '')), '');
  v_ativo  boolean;
  v_num    text;
  v_nome   text;
  v_numb   bigint;
  v_cabe   boolean;
  v_raro   boolean := false;
  v_lidas  integer;
  v_ped    bigint;
  r        record;
  v_ids    bigint[] := '{}';
  v_chaves timestamptz[] := '{}';
  v_a_ids  bigint[] := '{}';
  v_a_ch   timestamptz[] := '{}';
  v_cand   bigint[] := '{}';
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    return;
  end if;
  select f.ativo, f.numero, f.nome into v_ativo, v_num, v_nome from plt_privado.fn_filtro_do_quadro(p_busca) f;
  v_ativo := coalesce(v_ativo, false);
  v_numb  := case when v_num ~ '^[1-9][0-9]{0,8}$' then v_num::bigint end;
  if v_num is not null and v_numb is null then
    return;
  end if;
  v_raro := v_numb is not null;
  v_cabe := v_ativo and v_num is null and length(coalesce(v_txt, '')) >= 3;

  -- 1 · os cancelados pela plataforma, na ordem do cancelamento (o índice da lista)
  if not v_raro then
    v_lidas := 0;
    for r in select pc.id, pc.cancelado_plataforma_em as chave, pc.pedido_id as ped
               from public.plt_cards pc
              where pc.cancelado_plataforma_em is not null
                and (pc.cancelado_plataforma_em, pc.id) < (v_ate, v_id)
                and pc.tipo = 'pedido' and pc.arquivado_em is null
              order by pc.cancelado_plataforma_em desc, pc.id desc
    loop
      v_lidas := v_lidas + 1;
      if v_cabe and v_lidas > v_teto then
        v_raro := true;
        exit;
      end if;
      continue when v_ativo and not plt_privado.fn_pedido_bate_filtro(r.ped, v_num, v_nome);
      v_a_ids := v_a_ids || r.id;
      v_a_ch  := v_a_ch || r.chave;
      exit when cardinality(v_a_ids) > v_lim;
    end loop;
  end if;

  -- 2 · os cancelados no Tiny (sem a marca da plataforma — esses já vieram acima),
  --     pelo fato pedido_cancelado, do mais novo para trás; vale o último fato do card
  if not v_raro then
    v_lidas := 0;
    for r in select e.id as ev, e.card_id as id, e.ocorrido_em as chave
               from public.plt_eventos e
              where e.tipo = 'pedido_cancelado'
                and e.ocorrido_em <= v_ate
                and (e.ocorrido_em < v_ate or e.card_id < v_id)
              order by e.ocorrido_em desc, e.card_id desc
    loop
      v_lidas := v_lidas + 1;
      if v_cabe and v_lidas > v_teto * 2 then
        v_raro := true;
        exit;
      end if;
      v_ped := null;
      select pc.pedido_id into v_ped
        from public.plt_cards pc
        join public.pedidos p on p.id = pc.pedido_id
       where pc.id = r.id and pc.tipo = 'pedido' and pc.arquivado_em is null
         and pc.cancelado_plataforma_em is null
         and plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado';
      continue when v_ped is null;
      continue when exists (select 1 from public.plt_eventos e2
                             where e2.card_id = r.id and e2.tipo = 'pedido_cancelado'
                               and (e2.ocorrido_em, e2.id) > (r.chave, r.ev));
      continue when v_ativo and not plt_privado.fn_pedido_bate_filtro(v_ped, v_num, v_nome);
      v_a_ids := v_a_ids || r.id;
      v_a_ch  := v_a_ch || r.chave;
      -- as duas partes juntas passam do que a página pede: dá para cortar
      exit when cardinality(v_a_ids) > 2 * v_lim + 1;
    end loop;
  end if;

  -- 3 · os excluídos no Tiny (a lista é pequena — lê toda): o fato da entrada na
  --     lista, ou a data em que a conferência o achou (os de antes do fato)
  if not v_raro then
    for r in select pc.id, pc.pedido_id as ped,
                    coalesce((select max(e.ocorrido_em) from public.plt_eventos e
                               where e.card_id = pc.id and e.tipo = 'pedido_excluido_tiny'),
                             x.detectado_em) as chave
               from public.plt_pedidos_excluidos_tiny x
               join public.plt_cards pc on pc.pedido_id = x.pedido_id and pc.tipo = 'pedido' and pc.arquivado_em is null
              where pc.cancelado_plataforma_em is null
    loop
      continue when (r.chave, r.id) >= (v_ate, v_id);
      continue when v_ativo and not plt_privado.fn_pedido_bate_filtro(r.ped, v_num, v_nome);
      v_a_ids := v_a_ids || r.id;
      v_a_ch  := v_a_ch || r.chave;
    end loop;
  end if;

  if not v_raro then
    -- as três partes juntas: um card só uma vez (a saída mais recente), na ordem, até a página + 1
    select coalesce(array_agg(k.id order by k.chave desc, k.id desc), '{}'),
           coalesce(array_agg(k.chave order by k.chave desc, k.id desc), '{}')
      into v_ids, v_chaves
      from (select d.id, d.chave
              from (select distinct on (u.id) u.id, u.chave
                      from unnest(v_a_ids, v_a_ch) as u(id, chave)
                     order by u.id, u.chave desc) d
             order by d.chave desc, d.id desc
             limit v_lim + 1) k;
  else
    -- filtro raro: os candidatos vêm do filtro (o nº pelas faixas do índice do
    -- número; o nome pelos trigramas do cliente) — o molde da aba da 48 (A-216)
    if v_numb is not null and length(v_num) >= 4 then
      select coalesce(array_agg(p1.id), '{}') into v_cand
        from generate_series(0, greatest(0, 10 - length(v_num))) as g(e)
        join public.pedidos p1
          on p1.numero >= v_numb * (10::bigint ^ g.e)::bigint
         and p1.numero <  (v_numb + 1) * (10::bigint ^ g.e)::bigint;
    elsif v_numb is not null then
      select coalesce(array_agg(x.id), '{}') into v_cand
        from (select p1.id
                from generate_series(0, greatest(0, 10 - length(v_num))) as g(e)
                join public.pedidos p1
                  on p1.numero >= v_numb * (10::bigint ^ g.e)::bigint
                 and p1.numero <  (v_numb + 1) * (10::bigint ^ g.e)::bigint
                 and plt_privado.fn_situacao_normalizada(p1.situacao) = 'cancelado'
              union
              select pc.pedido_id
                from public.plt_cards pc
                join public.pedidos p3 on p3.id = pc.pedido_id
               where pc.cancelado_plataforma_em is not null and pc.tipo = 'pedido' and pc.arquivado_em is null
                 and p3.numero::text like v_num || '%'
              union
              select xx.pedido_id
                from public.plt_pedidos_excluidos_tiny xx
               where xx.numero::text like v_num || '%') x;
    else
      select coalesce(array_agg(p2.id), '{}') into v_cand
        from public.clientes c2
        join public.pedidos p2 on p2.cliente_id = c2.id
       where c2.nome ilike '%' || v_txt || '%'
         and plt_privado.fn_nome_comparavel(c2.nome) like '%' || v_nome || '%';
    end if;
    select coalesce(array_agg(x.id order by x.chave desc, x.id desc), '{}'),
           coalesce(array_agg(x.chave order by x.chave desc, x.id desc), '{}')
      into v_ids, v_chaves
      from (
        select k.id, k.chave
          from (
            select pc.id,
                   case when pc.cancelado_plataforma_em is not null then pc.cancelado_plataforma_em
                        when xe.pedido_id is not null
                          then coalesce((select max(e.ocorrido_em) from public.plt_eventos e
                                          where e.card_id = pc.id and e.tipo = 'pedido_excluido_tiny'),
                                        xe.detectado_em)
                        when plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado'
                          then (select max(e.ocorrido_em) from public.plt_eventos e
                                 where e.card_id = pc.id and e.tipo = 'pedido_cancelado') end as chave
              from public.plt_cards pc
              join public.pedidos p on p.id = pc.pedido_id
              left join public.plt_pedidos_excluidos_tiny xe on xe.pedido_id = pc.pedido_id
             where pc.pedido_id = any (v_cand) and pc.tipo = 'pedido' and pc.arquivado_em is null
          ) k
         where k.chave is not null and (k.chave, k.id) < (v_ate, v_id)
         order by k.chave desc, k.id desc
         limit v_lim + 1) x;
  end if;

  -- o que cada linha mostra (só as da página)
  return query
  select pc.id                                                          as card_id,
         p.id                                                           as pedido_id,
         p.numero                                                       as numero,
         coalesce(cl.nome, '')                                          as cliente_nome,
         p.data_pedido                                                  as data_pedido,
         p.situacao                                                     as situacao,
         case when pc.cancelado_plataforma_em is not null then 'plataforma'
              when xe.pedido_id is not null then 'excluido'
              else 'tiny' end                                           as motivo,
         pg.chave                                                       as saiu_em,
         ucp.nome                                                       as cancelado_por,
         case when pc.cancelado_plataforma_em is not null
              then plt_privado.fn_cancelamento_tiny_estado(p.id) end   as tiny_estado,
         case when pc.cancelado_plataforma_em is not null and f.motivo = 'cancelar'
              then f.ultimo_erro end                                    as tiny_erro,
         coalesce(i.total, 0)                                           as total_unidades,
         coalesce(u.em_producao, 0)                                     as em_producao,
         coalesce(u.prontas, 0)                                         as prontas,
         coalesce(d.no_estoque, 0)                                      as no_estoque,
         coalesce(u.esperando, 0)                                       as esperando_decisao,
         cardinality(v_ids) > v_lim                                     as tem_mais
    from unnest(v_ids, v_chaves) with ordinality as pg(id, chave, ord)
    join public.plt_cards pc on pc.id = pg.id
    join public.pedidos p on p.id = pc.pedido_id
    left join public.clientes cl on cl.id = p.cliente_id
    left join public.plt_pedidos_excluidos_tiny xe on xe.pedido_id = p.id
    left join public.plt_eventos ecp on ecp.id = pc.cancelado_plataforma_evento_id
    left join public.plt_usuarios ucp on ucp.id = ecp.usuario_id
    left join public.plt_tiny_pedido_fila f on f.pedido_id = p.id
    left join lateral (
      select coalesce(sum(v.unidades), 0)::int as total
        from plt_privado.vw_itens_producao v where v.pedido_id = p.id
    ) i on true
    left join lateral (
      select count(*) filter (where s.papel_no_fluxo <> 'terminal')::int as em_producao,
             count(*) filter (where s.papel_no_fluxo = 'terminal')::int  as prontas,
             count(*) filter (where cu.destino_pendente_em is not null)::int as esperando
        from public.plt_cards cu
        left join public.plt_setores s on s.id = cu.setor_atual_id
       where cu.pedido_id = p.id and cu.tipo = 'unidade' and cu.arquivado_em is null
    ) u on true
    left join lateral (
      select count(*)::int as no_estoque
        from public.plt_cards cu
        join public.plt_setores se on se.id = cu.setor_atual_id and se.codigo = 'estoque'
       where cu.card_pai_id = pc.id and cu.tipo = 'unidade'
         and cu.pedido_id is null and cu.arquivado_em is null and cu.cancelada_em is null
    ) d on true
   where pg.ord <= v_lim
   order by pg.ord;
end;
$$;
revoke all on function public.plt_fn_pcp_cancelados(text, integer, timestamptz, bigint) from public, anon;
grant execute on function public.plt_fn_pcp_cancelados(text, integer, timestamptz, bigint) to authenticated;

-- "Pedidos ocultos": os ocultados dos últimos N dias (a configuração), o mais
-- recente primeiro — pelo índice da remoção (plt_cards_removido_pcp_idx). Com
-- p_todos (o "Incluir pedido no PCP"), de qualquer idade. O cancelado (no Tiny,
-- pela plataforma) e o excluído no Tiny moram em "Cancelados", não aqui. As
-- linhas moram numa função privada (a aba e o "Incluir" leem dela); a porta da
-- aba devolve também os dias da configuração (a aba vazia ainda diz o prazo).
create or replace function plt_privado.fn_pcp_ocultos_linhas(
  p_busca     text        default null,
  p_limite    integer     default 20,
  p_depois_em timestamptz default null,
  p_depois_id bigint      default null,
  p_todos     boolean     default false
)
returns table (
  card_id         bigint,
  pedido_id       bigint,
  numero          integer,
  cliente_nome    text,
  data_pedido     date,
  situacao        text,
  oculto_em       timestamptz,
  oculto_por      text,
  motivo          text,
  texto           text,
  pecas_ocultadas integer,
  a_liberar       integer,
  fora_pelo_tiny  boolean,
  dias            integer,
  tem_mais        boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_lim   integer     := least(greatest(coalesce(p_limite, 20), 1), 100);
  v_ate   timestamptz := coalesce(p_depois_em, 'infinity'::timestamptz);
  v_id    bigint      := coalesce(p_depois_id, 9223372036854775807);
  v_dias  integer     := plt_privado.fn_ocultos_dias();
  v_desde timestamptz;
  v_ativo boolean;
  v_num   text;
  v_nome  text;
  v_ids   bigint[] := '{}';
  r       record;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    return;
  end if;
  v_desde := case when coalesce(p_todos, false) then '-infinity'::timestamptz
                  else now() - make_interval(days => v_dias) end;
  select f.ativo, f.numero, f.nome into v_ativo, v_num, v_nome from plt_privado.fn_filtro_do_quadro(p_busca) f;
  v_ativo := coalesce(v_ativo, false);

  for r in select pc.id, pc.pedido_id as ped
             from public.plt_cards pc
            where pc.removido_pcp_em is not null
              and pc.removido_pcp_em >= v_desde
              and (pc.removido_pcp_em, pc.id) < (v_ate, v_id)
              and pc.tipo = 'pedido' and pc.arquivado_em is null
              and pc.cancelado_plataforma_em is null
            order by pc.removido_pcp_em desc, pc.id desc
  loop
    continue when exists (select 1 from public.plt_pedidos_excluidos_tiny x where x.pedido_id = r.ped);
    continue when v_ativo and not plt_privado.fn_pedido_bate_filtro(r.ped, v_num, v_nome);
    v_ids := v_ids || r.id;
    exit when cardinality(v_ids) > v_lim;
  end loop;

  return query
  select pc.id                         as card_id,
         p.id                          as pedido_id,
         p.numero                      as numero,
         coalesce(cl.nome, '')         as cliente_nome,
         p.data_pedido                 as data_pedido,
         p.situacao                    as situacao,
         pc.removido_pcp_em            as oculto_em,
         ur.nome                       as oculto_por,
         pc.removido_pcp_motivo        as motivo,
         pc.removido_pcp_texto         as texto,
         coalesce((er.dados ->> 'ocultadas')::int, 0) as pecas_ocultadas,
         (select count(*)::int from plt_privado.fn_vagas_pedido(p.id) w
           where w.card_id is null and w.reserva_card_id is null) as a_liberar,
         plt_privado.fn_fora_do_pcp(p.situacao, pc.volta_pcp_em, null, false, null) as fora_pelo_tiny,
         v_dias                        as dias,
         cardinality(v_ids) > v_lim    as tem_mais
    from unnest(v_ids) with ordinality as pg(id, ord)
    join public.plt_cards pc on pc.id = pg.id
    join public.pedidos p on p.id = pc.pedido_id
    left join public.clientes cl on cl.id = p.cliente_id
    left join public.plt_eventos er on er.id = pc.removido_pcp_evento_id
    left join public.plt_usuarios ur on ur.id = er.usuario_id
   where pg.ord <= v_lim
   order by pg.ord;
end;
$$;
revoke all on function plt_privado.fn_pcp_ocultos_linhas(text, integer, timestamptz, bigint, boolean) from public, anon, authenticated;

create or replace function public.plt_fn_pcp_ocultos(
  p_busca     text        default null,
  p_limite    integer     default 20,
  p_depois_em timestamptz default null,
  p_depois_id bigint      default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Os pedidos ocultos são do PCP, da logística ou do admin.' using errcode = 'insufficient_privilege';
  end if;
  return jsonb_build_object(
    'dias', plt_privado.fn_ocultos_dias(),
    'linhas', coalesce((select jsonb_agg(to_jsonb(o) order by o.oculto_em desc, o.card_id desc)
                          from plt_privado.fn_pcp_ocultos_linhas(p_busca, p_limite, p_depois_em, p_depois_id, false) o),
                       '[]'::jsonb));
end;
$$;
revoke all on function public.plt_fn_pcp_ocultos(text, integer, timestamptz, bigint) from public, anon;
grant execute on function public.plt_fn_pcp_ocultos(text, integer, timestamptz, bigint) to authenticated;

-- "Incluir pedido no PCP" (o botão que já existia, para pedido antigo sem card):
-- UMA requisição devolve os ocultos de qualquer idade que batem com a busca (até
-- 5 — recuperar é a mesma coisa da aba; só na 1ª página) e a página dos pedidos
-- sem card. O excluído no Tiny fica fora (não existe mais).
-- Lei §6 (o ensaio ×100 desta sessão: a porta antiga, plt_fn_pedidos_kanban,
-- contava a lista inteira e calculava cada linha antes de cortar a página —
-- segundos com 560 mil pedidos): cursor pelo número (o "mais ao rolar"), sem
-- total, a página achada primeiro (o índice único do número, de cima para
-- baixo, pulando pela chave quem tem card e quem foi excluído no Tiny) e só as
-- linhas da página pagam o que a tela mostra. A busca segue o molde da lista de
-- Pedidos (A-216): a janela dos 5.000 números mais recentes primeiro; termo
-- raro → as faixas do número e os trigramas do nome.
-- SESSAO-50 (provisória): a lista só traz o pedido que o PCP MOSTRARIA (a regra
-- única sem as marcas da plataforma — vivo no Tiny): o card de um pedido já
-- faturado, enviado, entregue ou cancelado nasceria fora do quadro (invisível),
-- e a varredura fica do tamanho da operação, não da história.
create index if not exists pedidos_vivos_pcp_numero_idx
  on public.pedidos (numero desc)
  where coalesce(plt_privado.fn_situacao_normalizada(situacao), '') not in
        ('faturado', 'pronto_para_envio', 'enviado', 'entregue', 'nao_entregue', 'cancelado');

create or replace function public.plt_fn_pcp_incluir_lista(
  p_busca text default null, p_limite integer default 8, p_antes_numero integer default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_lim     integer := least(greatest(coalesce(p_limite, 8), 1), 50);
  v_busca   text    := nullif(btrim(coalesce(p_busca, '')), '');
  v_num     bigint;
  v_teto    bigint;
  v_ids     bigint[] := '{}';
  v_alvo    bigint[] := '{}';
  v_ocultos jsonb := '[]'::jsonb;
  v_sem     jsonb := '[]'::jsonb;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Incluir pedido no PCP é do PCP, da logística ou do admin.' using errcode = 'insufficient_privilege';
  end if;
  -- só dígitos, sem zero na frente: o "número que começa com" vira faixas
  v_num := case when v_busca ~ '^[1-9][0-9]{0,8}$' then v_busca::bigint end;

  if p_antes_numero is null then
    select coalesce(jsonb_agg(to_jsonb(o) - 'tem_mais' - 'dias' order by o.oculto_em desc, o.card_id desc), '[]'::jsonb)
      into v_ocultos
      from plt_privado.fn_pcp_ocultos_linhas(p_busca, 5, null, null, true) o;
  end if;

  -- 1 · a página (limite + 1, para saber se tem mais), por um caminho por caso
  if v_busca is null then
    select coalesce(array_agg(x.id order by x.numero desc), '{}') into v_ids from (
      select p.id, p.numero from public.pedidos p
       where (p_antes_numero is null or p.numero < p_antes_numero)
         and coalesce(plt_privado.fn_situacao_normalizada(p.situacao), '') not in
               ('faturado', 'pronto_para_envio', 'enviado', 'entregue', 'nao_entregue', 'cancelado')
         and not exists (select 1 from public.plt_cards pc where pc.pedido_id = p.id and pc.tipo = 'pedido')
         and not exists (select 1 from public.plt_pedidos_excluidos_tiny x where x.pedido_id = p.id)
       order by p.numero desc limit v_lim + 1) x;
  else
    -- a janela dos 5.000 números mais recentes: termo COMUM acha a página aí e para cedo
    v_teto := coalesce(p_antes_numero, (select max(pm.numero) from public.pedidos pm) + 1);
    select coalesce(array_agg(x.id order by x.numero desc), '{}') into v_ids from (
      select p.id, p.numero
        from public.pedidos p
        left join public.clientes c on c.id = p.cliente_id
       where p.numero >= v_teto - 5000
         and p.numero < v_teto
         and (p.numero::text like v_busca || '%' or c.nome ilike '%' || v_busca || '%')
         and coalesce(plt_privado.fn_situacao_normalizada(p.situacao), '') not in
               ('faturado', 'pronto_para_envio', 'enviado', 'entregue', 'nao_entregue', 'cancelado')
         and not exists (select 1 from public.plt_cards pc where pc.pedido_id = p.id and pc.tipo = 'pedido')
         and not exists (select 1 from public.plt_pedidos_excluidos_tiny x where x.pedido_id = p.id)
       order by p.numero desc limit v_lim + 1) x;
    -- termo RARO (a janela não encheu a página): os caminhos que os índices usam —
    -- primeiro os candidatos (as faixas do número, os trigramas do nome), depois a
    -- página só entre eles (em dois passos: numa consulta só, o planejador andava o
    -- índice parcial inteiro na ordem e cruzava — 700 ms no ensaio ×100)
    if cardinality(v_ids) <= v_lim then
      select coalesce(array_agg(alvo.id), '{}') into v_alvo
        from (select p1.id
                from generate_series(0, greatest(0, 10 - length(v_busca))) as k(e)
                join public.pedidos p1
                  on p1.numero >= v_num * (10::bigint ^ k.e)::bigint
                 and p1.numero <  (v_num + 1) * (10::bigint ^ k.e)::bigint
               where v_num is not null
              union
              select p2.id from public.clientes c2 join public.pedidos p2 on p2.cliente_id = c2.id
               where c2.nome ilike '%' || v_busca || '%') alvo;
      select coalesce(array_agg(x.id order by x.numero desc), '{}') into v_ids from (
        select p.id, p.numero
          from unnest(v_alvo) as u(id)
          join public.pedidos p on p.id = u.id
         where (p_antes_numero is null or p.numero < p_antes_numero)
           and coalesce(plt_privado.fn_situacao_normalizada(p.situacao), '') not in
               ('faturado', 'pronto_para_envio', 'enviado', 'entregue', 'nao_entregue', 'cancelado')
           and not exists (select 1 from public.plt_cards pc where pc.pedido_id = p.id and pc.tipo = 'pedido')
           and not exists (select 1 from public.plt_pedidos_excluidos_tiny x where x.pedido_id = p.id)
         order by p.numero desc limit v_lim + 1) x;
    end if;
  end if;

  -- 2 · o que cada linha mostra — só as da página (o frete não conta: D-63)
  select coalesce(jsonb_agg(jsonb_build_object(
           'pedido_id',      p.id,
           'numero',         p.numero,
           'cliente_nome',   coalesce(c.nome, ''),
           'data_pedido',    p.data_pedido,
           'situacao',       p.situacao,
           'total_itens',    coalesce(i.total_itens, 0),
           'total_unidades', coalesce(i.total_unidades, 0)) order by u.ord), '[]'::jsonb)
    into v_sem
    from unnest(v_ids[1:v_lim]) with ordinality as u(id, ord)
    join public.pedidos p on p.id = u.id
    left join public.clientes c on c.id = p.cliente_id
    left join lateral (
      select count(*)::int as total_itens, coalesce(sum(v.unidades), 0)::int as total_unidades
        from plt_privado.vw_itens_producao v
       where v.pedido_id = p.id) i on true;

  return jsonb_build_object(
    'ocultos',  v_ocultos,
    'sem_card', v_sem,
    -- o cursor do "mais ao rolar": o número da última linha mostrada (null = acabou)
    'proximo',  case when cardinality(v_ids) > v_lim
                     then (select p.numero from public.pedidos p where p.id = v_ids[v_lim]) end);
end;
$$;
revoke all on function public.plt_fn_pcp_incluir_lista(text, integer, integer) from public, anon;
grant execute on function public.plt_fn_pcp_incluir_lista(text, integer, integer) to authenticated;


-- ----------------------------------------------------------------------------
-- 7 · A janela "O que aconteceu?" e o selo: o laço (3 ou mais peças canceladas em 24 h) e o que os botões novos precisam saber
-- ----------------------------------------------------------------------------
-- (recriada da vigente — 20261111010000_plt_sessao48_base.sql (1 definições ao todo))
create or replace function plt_privado.fn_pcp_aviso_resumo(p_card_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
           'desde', pc.pcp_aviso_em,
           'pecas', count(u.id)::int,
           'motivo', case when count(u.id) > 0 and bool_and(u.cancelada_motivo = 'nao_encontrada')
                          then 'nao_encontrada' else 'cancelada' end,
           -- SESSAO-50 (frente 5): o laço — 3 ou mais peças do pedido canceladas em 24 h
           'laco', count(u.id) filter (where u.cancelada_em >= now() - interval '24 hours') >= 3)
    from public.plt_cards pc
    left join public.plt_cards u
           on u.cancelada_pedido_id = pc.pedido_id and u.tipo = 'unidade'
          and u.cancelada_em is not null and u.cancelada_em >= pc.pcp_aviso_em
   where pc.id = p_card_id and pc.pcp_aviso_em is not null
   group by pc.pcp_aviso_em;
$$;

-- (recriada da vigente — 20261111020000_plt_pcp_aviso_remover.sql (1 definições ao todo))
create or replace function public.plt_fn_pcp_aviso(p_card_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_card     public.plt_cards%rowtype;
  v_pedido   public.pedidos%rowtype;
  v_cliente  text;
  v_vagas    integer;
  v_abertas  integer;
  v_lista    jsonb;
  v_total    integer;
  v_por      text;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'O aviso da peça cancelada é do PCP, da logística ou do admin.'
      using errcode = 'insufficient_privilege';
  end if;
  select * into v_card from public.plt_cards where id = p_card_id;
  if v_card.id is null or v_card.tipo <> 'pedido' then
    raise exception 'Pedido não encontrado.' using errcode = 'no_data_found';
  end if;
  select * into v_pedido from public.pedidos where id = v_card.pedido_id;
  select c.nome into v_cliente from public.clientes c where c.id = v_pedido.cliente_id;

  -- as vagas do pedido (a regra de sempre — fn_vagas_pedido): abertas = sem peça
  select count(*)::int, (count(*) filter (where w.card_id is null))::int
    into v_vagas, v_abertas
    from plt_privado.fn_vagas_pedido(v_card.pedido_id) w;

  -- as peças com a fabricação cancelada que eram deste pedido (também as que a
  -- limpeza dos N dias já arquivou): de qual coluna, quem e quando — pelo último
  -- fato fabricacao_cancelada (a troca CANCELADO ↔ NÃO ENCONTRADO grava outro)
  select count(*)::int into v_total
    from public.plt_cards u
   where u.cancelada_pedido_id = v_card.pedido_id and u.tipo = 'unidade' and u.cancelada_em is not null;
  select coalesce(jsonb_agg(x.linha order by x.quando desc, x.id desc), '[]'::jsonb) into v_lista
    from (
      select u.id, coalesce(f.ocorrido_em, u.cancelada_em) as quando,
             jsonb_build_object(
               'card_id',      u.id,
               'descricao',    u.item_descricao,
               'sku',          u.item_codigo,
               'indice',       u.indice_unidade,
               'total',        u.total_unidades,
               'motivo',       u.cancelada_motivo,
               'setor',        coalesce(f.dados ->> 'setor', s.nome),
               'etapa',        coalesce(f.dados ->> 'etapa', et.nome),
               'quem',         uq.nome,
               'quando',       coalesce(f.ocorrido_em, u.cancelada_em),
               'cancelada_em', u.cancelada_em,
               'arquivada',    u.arquivado_em is not null,
               -- a peça é do aviso de agora (cancelada depois que ele abriu)
               'nova',         v_card.pcp_aviso_em is not null and u.cancelada_em >= v_card.pcp_aviso_em) as linha
        from public.plt_cards u
        left join public.plt_setores s on s.id = u.setor_atual_id
        left join public.plt_etapas et on et.id = u.etapa_atual_id
        left join lateral (
          select e.ocorrido_em, e.usuario_id, e.dados
            from public.plt_eventos e
           where e.card_id = u.id and e.tipo = 'fabricacao_cancelada'
           order by e.ocorrido_em desc, e.id desc
           limit 1
        ) f on true
        left join public.plt_usuarios uq on uq.id = f.usuario_id
       where u.cancelada_pedido_id = v_card.pedido_id and u.tipo = 'unidade' and u.cancelada_em is not null
       order by u.cancelada_em desc, u.id desc
       limit 100
    ) x;

  if v_card.removido_pcp_evento_id is not null then
    select uu.nome into v_por
      from public.plt_eventos e
      join public.plt_usuarios uu on uu.id = e.usuario_id
     where e.id = v_card.removido_pcp_evento_id;
  end if;

  return jsonb_build_object(
    'card_id',           v_card.id,
    'pedido_id',         v_card.pedido_id,
    'numero',            v_pedido.numero,
    'cliente',           v_cliente,
    'situacao',          v_pedido.situacao,
    'cancelado_no_tiny', plt_privado.fn_situacao_normalizada(v_pedido.situacao) = 'cancelado',
    -- o aviso aberto (desde quando, quantas peças, o motivo) — nulo quando já foi resolvido
    'aviso',             plt_privado.fn_pcp_aviso_resumo(v_card.id),
    'removido',          case when v_card.removido_pcp_em is null then null
                              else jsonb_build_object('em', v_card.removido_pcp_em,
                                                      'motivo', v_card.removido_pcp_motivo,
                                                      'texto', v_card.removido_pcp_texto,
                                                      'por', v_por) end,
    'liberado_completo', v_card.liberado_completo_em is not null,
    'vagas',             v_vagas,
    'vagas_abertas',     v_abertas,
    'canceladas',        v_lista,
    'canceladas_total',  v_total,
    'pecas',             plt_privado.fn_pcp_pecas_do_pedido(v_card.pedido_id),
    -- SESSAO-50: o laço (3 ou mais em 24 h) e o que "Cancelar pedido" / "Ocultar do PCP" precisam
    'canceladas_24h',    (select count(*)::int from public.plt_cards u
                           where u.cancelada_pedido_id = v_card.pedido_id and u.tipo = 'unidade'
                             and u.cancelada_em >= now() - interval '24 hours'),
    'tiny_ligado',       plt_privado.fn_tiny_entrega_desde() is not null,
    'cancelado_plataforma_em', v_card.cancelado_plataforma_em,
    'excluido_no_tiny',  exists (select 1 from public.plt_pedidos_excluidos_tiny x where x.pedido_id = v_card.pedido_id),
    'ocultos_dias',      plt_privado.fn_ocultos_dias());
end;
$$;


-- ----------------------------------------------------------------------------
-- 8 · Frente 5 — o PCP não libera direto numa coluna que cancela a fabricação (o banco recusa; a janela nem oferece) e a janela "Liberar unidades" mostra a observação do item (bloco A)
-- ----------------------------------------------------------------------------
-- (recriada da vigente — 20261104010000_plt_itens_novos_reabrir_entrega.sql (3 definições ao todo))
CREATE OR REPLACE FUNCTION public.plt_fn_pcp_liberar(p_card_id bigint, p_unidades jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_usuario   uuid;
  v_card      public.plt_cards%rowtype;
  v_pcp       bigint;
  v_u         jsonb;
  v_seq       integer;
  v_k         integer;
  v_peca      bigint;
  v_setor     bigint;
  v_etapa     bigint;
  v_codigo    text;
  v_desc      text;
  v_n         integer;
  v_novo      bigint;
  v_alocadas  integer := 0;
  v_liberadas integer := 0;
  v_vinculadas integer := 0;
  v_puladas   integer := 0;
  v_cards     bigint[] := '{}';
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Liberar é gesto do PCP/logística ou de admin.' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_unidades) is distinct from 'array' or jsonb_array_length(p_unidades) = 0 then
    raise exception 'Selecione pelo menos uma unidade para liberar.' using errcode = 'check_violation';
  end if;
  if jsonb_array_length(p_unidades) > 500 then
    raise exception 'No máximo 500 unidades por vez.' using errcode = 'check_violation';
  end if;

  -- A trava do card do pedido/reposição: duas pessoas liberando o mesmo
  -- pedido ao mesmo tempo esperam uma pela outra (a segunda pula o que a
  -- primeira já liberou).
  select * into v_card from public.plt_cards c
   where c.id = p_card_id and c.tipo in ('pedido', 'reposicao') and c.arquivado_em is null
   for update;
  if not found then
    raise exception 'Este card não está mais no PCP (pode ter sido arquivado).' using errcode = 'no_data_found';
  end if;
  -- SESSAO-44 (frente 2): o pedido em rota que ganhou itens novos no Tiny
  -- volta ao PCP só com o que falta — e só isso se libera.
  if v_card.tipo = 'pedido' and v_card.lancado_rotas_em is not null
     and v_card.liberado_completo_em is not null then
    raise exception 'Este pedido já foi lançado para ROTAS.' using errcode = 'check_violation';
  end if;
  select s.id into v_pcp from public.plt_setores s where s.codigo = 'pcp';

  -- 1º as peças do estoque (a sugestão aceita): a unidade nasce pronta no aguardo.
  for v_u in select x from jsonb_array_elements(p_unidades) x where x ? 'peca_card_id' loop
    v_seq  := (v_u ->> 'item_seq')::int;
    v_k    := (v_u ->> 'indice_unidade')::int;
    v_peca := (v_u ->> 'peca_card_id')::bigint;
    if v_card.tipo <> 'pedido' then
      raise exception 'A reposição não usa peça do estoque.' using errcode = 'check_violation';
    end if;
    if plt_privado.fn_vaga_coberta(v_card.pedido_id, v_seq, v_k) then
      v_puladas := v_puladas + 1;
      continue;
    end if;
    v_novo := public.plt_fn_alocar_peca(v_card.id, v_seq, v_k, v_peca);
    v_cards := v_cards || v_novo;
    v_alocadas := v_alocadas + 1;
  end loop;

  -- D-201: 2º as peças SEM DONO que ainda estão em produção — passam a ser
  -- deste pedido onde estão (setor, etapa, quem trabalha e o tempo seguem).
  for v_u in select x from jsonb_array_elements(p_unidades) x where x ? 'peca_producao_id' loop
    v_seq  := (v_u ->> 'item_seq')::int;
    v_k    := (v_u ->> 'indice_unidade')::int;
    v_peca := (v_u ->> 'peca_producao_id')::bigint;
    if v_card.tipo <> 'pedido' then
      raise exception 'A reposição não usa peça que já está em produção.' using errcode = 'check_violation';
    end if;
    if plt_privado.fn_vaga_coberta(v_card.pedido_id, v_seq, v_k) then
      v_puladas := v_puladas + 1;
      continue;
    end if;
    perform plt_privado.fn_vincular_peca_producao(v_card, v_seq, v_k, v_peca, v_usuario);
    v_cards := v_cards || v_peca;
    v_vinculadas := v_vinculadas + 1;
  end loop;

  -- 3º as que vão para a produção (raio-x 3: só setor de produção).
  for v_u in select x from jsonb_array_elements(p_unidades) x
              where not (x ? 'peca_card_id') and not (x ? 'peca_producao_id') loop
    v_seq   := (v_u ->> 'item_seq')::int;
    v_k     := (v_u ->> 'indice_unidade')::int;
    v_setor := nullif(v_u ->> 'setor_id', '')::bigint;
    v_etapa := nullif(nullif(v_u ->> 'etapa_id', ''), '0')::bigint;
    if v_setor is null
       or not exists (select 1 from public.plt_setores s
                       where s.id = v_setor and s.ativo and s.papel_no_fluxo = 'producao') then
      raise exception 'O PCP libera a peça para um setor de produção. Peça pronta do estoque vai pela sugestão "usar?" — ela nasce pronta em Pedidos em aguardo.'
        using errcode = 'check_violation';
    end if;
    if v_etapa is not null
       and not exists (select 1 from public.plt_etapas e where e.id = v_etapa and e.setor_id = v_setor and e.ativa) then
      raise exception 'A etapa escolhida não é deste setor (ou foi desativada).' using errcode = 'check_violation';
    end if;
    -- SESSAO-50 (frente 5): liberar direto no CANCELADO / NÃO ENCONTRADO virava laço
    -- (libera → cancela → a vaga volta); quem não vai produzir cancela ou oculta o pedido
    if v_etapa is not null
       and exists (select 1 from public.plt_etapas e where e.id = v_etapa and e.cancela_fabricacao) then
      raise exception 'O PCP não libera direto numa coluna que cancela a fabricação. Se o pedido não vai ser produzido, use "Cancelar pedido" ou "Ocultar do PCP".'
        using errcode = 'check_violation';
    end if;

    if v_card.tipo = 'reposicao' then
      v_codigo := v_card.item_codigo;
      v_desc   := v_card.item_descricao;
      v_n      := v_card.total_unidades;
      if v_seq is distinct from 1 or v_k is null or v_k < 1 or v_k > coalesce(v_n, 0) then
        raise exception 'Esta unidade não existe na reposição.' using errcode = 'check_violation';
      end if;
      -- D-201: a vaga da peça que foi para um pedido continua ocupada.
      if exists (select 1 from public.plt_cards u
                  where u.card_pai_id = v_card.id and u.tipo = 'unidade'
                    and u.pedido_id is null and u.indice_unidade = v_k)
         or exists (select 1 from public.plt_cards u
                      join public.plt_eventos e on e.card_id = u.id and e.tipo = 'peca_vinculada'
                     where u.card_pai_id = v_card.id and u.tipo = 'unidade' and u.pedido_id is not null
                       and e.dados ->> 'reposicao_card_id' = v_card.id::text
                       and (e.dados ->> 'vaga_reposicao')::int = v_k) then
        v_puladas := v_puladas + 1;
        continue;
      end if;
    else
      v_n := null;
      select v.codigo, v.descricao, v.unidades into v_codigo, v_desc, v_n
        from plt_privado.vw_itens_producao v
       where v.pedido_id = v_card.pedido_id and v.seq = v_seq and v.unidades >= 1;
      if v_n is null or v_k is null or v_k < 1 or v_k > v_n then
        raise exception 'Esta unidade não existe no pedido.' using errcode = 'check_violation';
      end if;
      if plt_privado.fn_vaga_coberta(v_card.pedido_id, v_seq, v_k) then
        v_puladas := v_puladas + 1;
        continue;
      end if;
    end if;

    insert into public.plt_cards
        (tipo, pedido_id, produto_tiny_id, card_pai_id, item_seq, item_codigo, item_descricao,
         indice_unidade, total_unidades, setor_atual_id)
      values
        ('unidade', case when v_card.tipo = 'pedido' then v_card.pedido_id end,
         case when v_card.tipo = 'reposicao' then v_card.produto_tiny_id end,
         v_card.id, v_seq, v_codigo, v_desc, v_k, v_n, v_pcp)
      returning id into v_novo;
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_destino_id)
      values (v_novo, 'card_criado', v_usuario, 'interface', v_pcp);
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, setor_destino_id, etapa_destino_id)
      values (v_novo, 'movimentacao_setor', v_usuario, 'interface', v_pcp, v_setor, v_etapa);
    v_cards := v_cards || v_novo;
    v_liberadas := v_liberadas + 1;
  end loop;

  -- D-201: a peça ligada não passa pelo PCP — o quadro do PCP fica sabendo pelo pedido.
  if v_vinculadas > 0 then
    perform plt_privado.fn_avisar('pcp');
  end if;

  return jsonb_build_object('alocadas', v_alocadas, 'liberadas', v_liberadas, 'vinculadas', v_vinculadas,
                            'ja_liberadas', v_puladas, 'cards', to_jsonb(v_cards));
end;
$function$
;

-- (recriada da vigente — 20261104010000_plt_itens_novos_reabrir_entrega.sql (3 definições ao todo))
CREATE OR REPLACE FUNCTION public.plt_fn_pcp_liberacao(p_card_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_card public.plt_cards%rowtype;
  v_itens jsonb;
  v_ja    jsonb;
  v_sug   jsonb := '[]'::jsonb;
  v_prod  jsonb := '[]'::jsonb;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Liberar é gesto do PCP/logística ou de admin.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_card from public.plt_cards c
   where c.id = p_card_id and c.tipo in ('pedido', 'reposicao');
  if not found then
    raise exception 'Este card não existe.' using errcode = 'no_data_found';
  end if;

  if v_card.tipo = 'reposicao' then
    v_itens := jsonb_build_array(jsonb_build_object(
      'seq', 1, 'codigo', v_card.item_codigo, 'descricao', v_card.item_descricao,
      'unidades', coalesce(v_card.total_unidades, 0)));
    -- D-201: a peça desta reposição que passou a ser de um pedido segue
    -- ocupando a vaga dela (a reposição só perde a peça).
    select coalesce(jsonb_agg(jsonb_build_object('item_seq', 1, 'indice_unidade', x.k) order by x.k), '[]'::jsonb)
      into v_ja
      from (
        select u.indice_unidade as k
          from public.plt_cards u
         where u.card_pai_id = v_card.id and u.tipo = 'unidade' and u.pedido_id is null
        union
        select (e.dados ->> 'vaga_reposicao')::int
          from public.plt_cards u
          join public.plt_eventos e on e.card_id = u.id and e.tipo = 'peca_vinculada'
         where u.card_pai_id = v_card.id and u.tipo = 'unidade' and u.pedido_id is not null
           and e.dados ->> 'reposicao_card_id' = v_card.id::text
      ) x
     where x.k is not null;
  else
    -- D-63: frete não vira unidade (vw_itens_producao).
    select coalesce(jsonb_agg(jsonb_build_object('seq', v.seq, 'codigo', v.codigo,
                                                 'descricao', v.descricao, 'unidades', v.unidades,
                                                 -- SESSAO-50 (bloco A): a observação do item no Tiny
                                                 'observacao', (select o.texto from public.plt_itens_observacao o
                                                                 where o.pedido_id = v.pedido_id and o.seq = v.seq))
                              order by v.seq), '[]'::jsonb)
      into v_itens
      from plt_privado.vw_itens_producao v
     where v.pedido_id = v_card.pedido_id and v.unidades >= 1;
    -- SESSAO-44 (frente 3): a vaga é coberta pela peça do MESMO produto (a
    -- posição só desempata) — item inserido no meio da lista não troca nada.
    select coalesce(jsonb_agg(jsonb_build_object('item_seq', w.seq, 'indice_unidade', w.indice)
                              order by w.seq, w.indice), '[]'::jsonb)
      into v_ja
      from plt_privado.fn_vagas_pedido(v_card.pedido_id) w
     where w.card_id is not null;
    select coalesce(jsonb_agg(to_jsonb(s) order by s.item_seq, s.indice_unidade), '[]'::jsonb)
      into v_sug
      from public.plt_fn_sugestoes_alocacao(v_card.id) s;
    -- D-201: a peça igual sem dono que ainda está em produção, para o que o estoque não cobre.
    select coalesce(jsonb_agg(to_jsonb(s) order by s.item_seq, s.indice_unidade), '[]'::jsonb)
      into v_prod
      from plt_privado.fn_sugestoes_em_producao(v_card.id, v_sug) s;
  end if;

  return jsonb_build_object('itens', v_itens, 'ja_liberadas', v_ja, 'sugestoes', v_sug, 'em_producao', v_prod);
end;
$function$
;


-- ----------------------------------------------------------------------------
-- 9 · A regra única de 3 argumentos sai (os 12 leitores acima já leem a de 5 — conferido também no banco vivo: nenhum outro chamador)
-- ----------------------------------------------------------------------------
drop function if exists plt_privado.fn_fora_do_pcp(text, timestamptz, timestamptz);
