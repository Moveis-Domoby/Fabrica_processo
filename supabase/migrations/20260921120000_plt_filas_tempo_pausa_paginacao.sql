-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 29 — FILAS REAIS, TEMPO DE PCP E PAUSA
-- Sessão: SESSAO-22 · Data: 2026-09-21 · Decisão: D-48 (revisa D-24 e Q-17)
--
-- Quatro assuntos, todos derivados de evento (M-02/RNF-05 — nada reescreve
-- história):
--
--   1. FILAS REAIS: evento de chegada em setor de PRODUÇÃO sem etapa de
--      destino é completado NA ESCRITA com a etapa fila (`eh_fila`) do setor —
--      o evento nasce completo e a coluna "Chegada" deixa de existir nesses
--      quadros. PCP e terminais não mudam (a estrutura deles é de outra sessão).
--
--   2. TEMPO DE PCP VERDADEIRO (D-48): o tempo em PCP é do PEDIDO — da entrada
--      no PCP até a liberação COMPLETA (todas as unidades). Projeção nova
--      `plt_cards.liberado_completo_em` (card de pedido), recalculada por
--      trigger a cada liberação/atualização do Tiny; `plt_vw_permanencias`
--      passa a FECHAR a permanência do card de pedido nesse instante.
--
--   3. PAUSA POR LÍDER (D-48): eventos novos `execucao_pausada` e
--      `execucao_retomada` (append-only, com autor e execução referenciada).
--      Execução pausada não conta tempo para a pessoa nem ocupa o limite;
--      retomar passa pela MESMA trava do limite ("finalize a urgência antes").
--      Regras em trigger (M-14); `plt_vw_execucoes` e as portas de dashboard
--      descontam os intervalos pausados.
--
--   4. LIMITE PADRÃO 1 (D-48): setor novo nasce com limite de 1 execução por
--      pessoa; os setores existentes são atualizados por SQL de manutenção
--      (nunca por migration — reaplicar não pode sobrescrever escolha do admin).
--      RPC nova `plt_fn_definir_limite_execucoes` abre a edição ao LÍDER do
--      próprio setor (a policy de plt_setores segue só-admin).
--
-- A paginação dos quadros (10 por etapa + "Ver mais") vive no front, sobre as
-- leituras já existentes com limite/deslocamento — nenhuma porta nova.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · Vocabulário: pausa e retomada entram no check de tipos (E-19: este é o
--     check mais novo — `not valid` aqui, validação de tudo no fim do arquivo)
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
      'card_criado',
      'movimentacao_setor',
      'movimentacao_etapa',
      'execucao_iniciada',
      'execucao_finalizada',
      'execucao_pausada',    -- SESSAO-22 (D-48): líder pausa a execução de alguém
      'execucao_retomada',   -- SESSAO-22 (D-48): a pessoa retoma ao finalizar a urgência
      'qualidade_marcada',
      'qualidade_parecer',
      'divergencia_registrada',
      'notificacao_enviada',
      'delegacao',
      'estorno',
      'pedido_atualizado',
      'pedido_cancelado',
      'card_arquivado',
      'pedido_entregue',
      'pedido_lancado_rotas'
    )) not valid;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2 · Filas reais: a etapa de destino se resolve NA ESCRITA do evento
--
-- Chegada em setor de PRODUÇÃO sem etapa informada → o trigger completa com a
-- etapa fila ativa do setor. O evento nasce completo (views e linha do tempo
-- não precisam adivinhar); a projeção continua sendo a mesma de sempre.
-- Setor de produção SEM fila cadastrada segue com etapa nula — o quadro avisa
-- o líder/admin para cadastrar (D-14: etapa não se inventa).
-- Nome do trigger começa antes dos `plt_eventos_validar_*` de propósito: os
-- BEFORE disparam em ordem alfabética e a etapa precisa estar resolvida antes.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_resolver_etapa_fila()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fila bigint;
begin
  if new.tipo in ('card_criado', 'movimentacao_setor', 'movimentacao_etapa')
     and new.setor_destino_id is not null
     and new.etapa_destino_id is null then
    select e.id into v_fila
      from public.plt_etapas e
      join public.plt_setores s on s.id = e.setor_id
     where e.setor_id = new.setor_destino_id
       and e.eh_fila and e.ativa
       and s.papel_no_fluxo = 'producao'
     order by e.ordem, e.id
     limit 1;
    if v_fila is not null then
      new.etapa_destino_id := v_fila;
    end if;
  end if;
  return new;
end;
$$;

comment on function plt_privado.fn_resolver_etapa_fila() is
  'SESSAO-22: chegada em setor de produção sem etapa cai na etapa fila do setor — resolvido na escrita do evento, para todo escritor.';

drop trigger if exists plt_eventos_resolver_etapa_fila on public.plt_eventos;
create trigger plt_eventos_resolver_etapa_fila
  before insert on public.plt_eventos
  for each row execute function plt_privado.fn_resolver_etapa_fila();

-- ----------------------------------------------------------------------------
-- 3 · Projeções novas em plt_cards
-- ----------------------------------------------------------------------------
alter table public.plt_cards
  add column if not exists pausado_em timestamptz,
  add column if not exists liberado_completo_em timestamptz;

comment on column public.plt_cards.pausado_em is
  'SESSAO-22 (D-48): projeção do evento execucao_pausada — quando a execução aberta deste card foi pausada pelo líder. NULL = não pausado. Pausado não conta tempo nem ocupa o limite.';
comment on column public.plt_cards.liberado_completo_em is
  'SESSAO-22 (D-48): projeção — quando a ÚLTIMA unidade do pedido foi liberada (só card de pedido). É o fim do tempo em PCP e o filtro de "pedidos abertos" do quadro.';

-- O quadro do PCP filtra "pedidos abertos" no servidor (paginação da SESSAO-22).
create index if not exists plt_cards_pcp_abertos_idx
  on public.plt_cards (setor_atual_id, desde)
  where tipo = 'pedido' and liberado_completo_em is null and arquivado_em is null;

-- ----------------------------------------------------------------------------
-- 4 · Liberação completa: recálculo derivado (a mesma regra k/n do kanban)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_recalcular_liberacao(p_pedido_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total     integer;
  v_liberadas integer;
  v_quando    timestamptz;
begin
  -- Total de unidades: a regra REAL do n8n (quantidade arredondada; < 1 não
  -- vira card) — a mesma de plt_fn_pedido_itens_kanban.
  select coalesce(sum(case when round(pi.quantidade) >= 1
                           then round(pi.quantidade)::int else 0 end), 0)::int
    into v_total
    from public.pedido_itens pi
   where pi.pedido_id = p_pedido_id;

  select count(*)::int into v_liberadas
    from public.plt_cards cu
   where cu.pedido_id = p_pedido_id and cu.tipo = 'unidade';

  if v_total > 0 and v_liberadas >= v_total then
    -- O instante da liberação da ÚLTIMA unidade (D-48: fim do tempo em PCP).
    select max(e.ocorrido_em) into v_quando
      from public.plt_eventos e
      join public.plt_cards cu
        on cu.id = e.card_id and cu.tipo = 'unidade' and cu.pedido_id = p_pedido_id
     where e.tipo = 'card_criado';
  else
    v_quando := null;
  end if;

  update public.plt_cards
     set liberado_completo_em = v_quando
   where pedido_id = p_pedido_id and tipo = 'pedido'
     and liberado_completo_em is distinct from v_quando;
end;
$$;

comment on function plt_privado.fn_recalcular_liberacao(bigint) is
  'SESSAO-22 (D-48): recalcula liberado_completo_em do card de pedido — derivado dos eventos e dos itens (regra k/n). Chamada pela projeção; nunca por mão humana.';

-- ----------------------------------------------------------------------------
-- 5 · Projeção: pausa/retomada e a liberação completa
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_projetar_posicao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_terminal boolean;
  v_tipo_card text;
  v_pedido_id bigint;
begin
  if new.tipo in ('card_criado', 'movimentacao_setor', 'movimentacao_etapa') then
    select s.papel_no_fluxo = 'terminal'
      into v_terminal
      from public.plt_setores s
     where s.id = coalesce(new.setor_destino_id,
                           (select c.setor_atual_id from public.plt_cards c where c.id = new.card_id));

    update public.plt_cards
       set setor_atual_id = coalesce(new.setor_destino_id, setor_atual_id),
           etapa_atual_id = new.etapa_destino_id,
           desde          = new.ocorrido_em,
           executor_atual_id = null,
           -- SESSAO-22: mover encerra a execução — e a pausa junto com ela.
           pausado_em     = null,
           responsavel_id = case when new.tipo = 'movimentacao_setor'
                                 then null else responsavel_id end,
           -- SESSAO-15: concluído = está num terminal AGORA (D-13); saiu de
           -- lá (danificado resolvido, ajuste manual), volta a "em produção".
           concluido_em   = case when coalesce(v_terminal, false)
                                 then coalesce(concluido_em, new.ocorrido_em)
                                 else null end
     where id = new.card_id;

    -- SESSAO-22 (D-48): unidade nova liberada → o card de pedido pode ter
    -- acabado de completar a liberação.
    if new.tipo = 'card_criado' then
      select c.tipo, c.pedido_id into v_tipo_card, v_pedido_id
        from public.plt_cards c where c.id = new.card_id;
      if v_tipo_card = 'unidade' and v_pedido_id is not null then
        perform plt_privado.fn_recalcular_liberacao(v_pedido_id);
      end if;
    end if;

  elsif new.tipo = 'execucao_iniciada' then
    -- Iniciar num card já em execução por OUTRA pessoa = transferência (D-24):
    -- fecha para um, abre para o outro — e encerra pausa que houver.
    update public.plt_cards
       set executor_atual_id = new.usuario_id,
           pausado_em = null
     where id = new.card_id;

  elsif new.tipo = 'execucao_finalizada' then
    update public.plt_cards
       set executor_atual_id = null,
           pausado_em = null
     where id = new.card_id;

  elsif new.tipo = 'execucao_pausada' then
    -- SESSAO-22 (D-48): a urgência entra porque o pausado sai do limite.
    update public.plt_cards
       set pausado_em = new.ocorrido_em
     where id = new.card_id;

  elsif new.tipo = 'execucao_retomada' then
    update public.plt_cards
       set pausado_em = null
     where id = new.card_id;

  elsif new.tipo = 'estorno' then
    -- O estado guardado é projeção; o evento é a verdade (M-13). A pausa
    -- pertencia à execução desfeita — zera junto.
    update public.plt_cards
       set executor_atual_id = plt_privado.fn_executor_pelo_log(new.card_id),
           pausado_em = null
     where id = new.card_id;

  elsif new.tipo in ('qualidade_marcada', 'qualidade_parecer') then
    update public.plt_cards
       set qualidade_atual = new.estado_qualidade
     where id = new.card_id;

  elsif new.tipo = 'card_arquivado' then
    update public.plt_cards
       set arquivado_em = new.ocorrido_em,
           executor_atual_id = null,
           pausado_em = null
     where id = new.card_id;

  elsif new.tipo = 'delegacao' then
    update public.plt_cards
       set responsavel_id = nullif(new.dados ->> 'responsavel_id', '')::uuid
     where id = new.card_id;

  elsif new.tipo = 'pedido_lancado_rotas' then
    -- SESSAO-15 (D-45): o card de pedido passa a existir para as ROTAS.
    update public.plt_cards
       set lancado_rotas_em = new.ocorrido_em
     where id = new.card_id;

  elsif new.tipo = 'pedido_atualizado' then
    -- SESSAO-22 (D-48): o Tiny pode ter mudado os itens — o "completo" muda junto.
    select c.pedido_id into v_pedido_id
      from public.plt_cards c where c.id = new.card_id;
    if v_pedido_id is not null then
      perform plt_privado.fn_recalcular_liberacao(v_pedido_id);
    end if;
  end if;

  return null;
end;
$$;

comment on function plt_privado.fn_projetar_posicao() is
  'Único lugar que escreve a posição do card. Reage a evento inserido; nunca o contrário. Projeta pausa/retomada e a liberação completa (S22), arquivamento (S11), responsável (S12), lançamento para ROTAS (S15).';

-- ----------------------------------------------------------------------------
-- 6 · Regras de pausa/retomada + limite ignorando pausados (trigger — M-14)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_validar_execucao()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card         public.plt_cards%rowtype;
  v_limite       integer;
  v_em_execucao  integer;
  v_alvo         public.plt_eventos%rowtype;
  v_ultimo_exec  bigint;
  v_papel        text;
  v_lider        boolean;
  v_referencia   bigint;
begin
  if new.tipo not in ('execucao_iniciada', 'execucao_finalizada', 'estorno',
                      'execucao_pausada', 'execucao_retomada') then
    return new;
  end if;

  select * into v_card from public.plt_cards where id = new.card_id;
  if not found then
    raise exception 'Card % não existe.', new.card_id using errcode = 'foreign_key_violation';
  end if;

  if new.usuario_id is null then
    -- D-02/D-24/D-48: execução (e a gestão dela) é gesto de pessoa.
    raise exception 'Iniciar, finalizar, pausar, retomar e estornar são gestos de pessoa: é preciso dizer quem fez.'
      using errcode = 'check_violation';
  end if;

  -- Onde o gesto aconteceu: o setor/etapa ATUAL do card, se quem inseriu não disse.
  if new.tipo in ('execucao_iniciada', 'execucao_finalizada',
                  'execucao_pausada', 'execucao_retomada') then
    new.setor_origem_id := coalesce(new.setor_origem_id, v_card.setor_atual_id);
    new.etapa_origem_id := coalesce(new.etapa_origem_id, v_card.etapa_atual_id);
  end if;

  if new.tipo = 'execucao_iniciada' then
    if v_card.setor_atual_id is null then
      raise exception 'Este card ainda não está em nenhum setor — não há o que iniciar.'
        using errcode = 'check_violation';
    end if;
    if v_card.concluido_em is not null then
      -- D-13: fim de linha não executa.
      raise exception 'Card concluído (fim de linha) não entra em execução.'
        using errcode = 'check_violation';
    end if;
    if v_card.executor_atual_id = new.usuario_id then
      raise exception 'Esta pessoa já está executando este card.'
        using errcode = 'check_violation';
    end if;

    select s.limite_execucoes_por_pessoa into v_limite
      from public.plt_setores s where s.id = v_card.setor_atual_id;
    if v_limite is not null then
      select count(*) into v_em_execucao
        from public.plt_cards c
       where c.executor_atual_id = new.usuario_id
         and c.setor_atual_id = v_card.setor_atual_id
         and c.id <> new.card_id
         -- D-48: execução pausada não ocupa o limite — é o que deixa a urgência entrar.
         and c.pausado_em is null;
      if v_em_execucao >= v_limite then
        -- D-24/D-48: limite configurável por setor; o padrão agora é 1.
        raise exception 'Limite do setor atingido: esta pessoa já tem % card(s) em execução aqui (máximo %). Finalize o que está aberto antes de pegar outro.',
          v_em_execucao, v_limite
          using errcode = 'check_violation';
      end if;
    end if;

  elsif new.tipo = 'execucao_finalizada' then
    if v_card.executor_atual_id is null then
      -- D-24: finalizar sem iniciar não existe.
      raise exception 'Iniciar é obrigatório antes de finalizar — este card não está em execução.'
        using errcode = 'check_violation';
    end if;

  elsif new.tipo = 'execucao_pausada' then
    -- D-48: só execução aberta se pausa, uma pausa por vez.
    if v_card.executor_atual_id is null then
      raise exception 'Este card não está em execução — não há o que pausar.'
        using errcode = 'check_violation';
    end if;
    if v_card.pausado_em is not null then
      raise exception 'Esta execução já está pausada.'
        using errcode = 'check_violation';
    end if;

    -- Quem pausa: líder do setor ATUAL do card ou admin (D-48).
    select u.papel into v_papel from public.plt_usuarios u
     where u.id = new.usuario_id and u.ativo;
    if v_papel is null then
      raise exception 'Pausar exige um usuário ativo da plataforma.'
        using errcode = 'check_violation';
    end if;
    select coalesce(bool_or(us.lider_do_setor), false) into v_lider
      from public.plt_usuario_setores us
     where us.usuario_id = new.usuario_id
       and us.setor_id = v_card.setor_atual_id;
    if v_papel <> 'admin' and not v_lider then
      raise exception 'Pausar uma execução é gesto de líder do setor ou de admin.'
        using errcode = 'insufficient_privilege';
    end if;

    -- A pausa aponta a execução aberta (o iniciar válido mais recente).
    select e.id into v_referencia
      from public.plt_eventos e
     where e.card_id = new.card_id
       and e.tipo = 'execucao_iniciada'
       and not plt_privado.fn_evento_estornado(e.id)
     order by e.ocorrido_em desc, e.id desc
     limit 1;
    if new.evento_referencia_id is null then
      new.evento_referencia_id := v_referencia;
    elsif new.evento_referencia_id is distinct from v_referencia then
      raise exception 'A pausa precisa apontar a execução aberta deste card.'
        using errcode = 'check_violation';
    end if;

  elsif new.tipo = 'execucao_retomada' then
    if v_card.pausado_em is null then
      raise exception 'Este card não está pausado — não há o que retomar.'
        using errcode = 'check_violation';
    end if;

    -- Quem retoma: o próprio executor, o líder do setor ou admin (D-48).
    select u.papel into v_papel from public.plt_usuarios u
     where u.id = new.usuario_id and u.ativo;
    if v_papel is null then
      raise exception 'Retomar exige um usuário ativo da plataforma.'
        using errcode = 'check_violation';
    end if;
    select coalesce(bool_or(us.lider_do_setor), false) into v_lider
      from public.plt_usuario_setores us
     where us.usuario_id = new.usuario_id
       and us.setor_id = v_card.setor_atual_id;
    if new.usuario_id is distinct from v_card.executor_atual_id
       and v_papel <> 'admin' and not v_lider then
      raise exception 'Retomar é gesto de quem executa o card, do líder do setor ou de admin.'
        using errcode = 'insufficient_privilege';
    end if;

    -- D-48 (palavras do dono): "tem que concluir a urgência antes de pegar
    -- outro" — retomar passa pela MESMA trava do limite, contada para o EXECUTOR.
    select s.limite_execucoes_por_pessoa into v_limite
      from public.plt_setores s where s.id = v_card.setor_atual_id;
    if v_limite is not null then
      select count(*) into v_em_execucao
        from public.plt_cards c
       where c.executor_atual_id = v_card.executor_atual_id
         and c.setor_atual_id = v_card.setor_atual_id
         and c.id <> new.card_id
         and c.pausado_em is null;
      if v_em_execucao >= v_limite then
        raise exception 'Finalize a urgência antes de retomar: esta pessoa já tem % card(s) em execução neste setor (máximo %).',
          v_em_execucao, v_limite
          using errcode = 'check_violation';
      end if;
    end if;

    -- A retomada aponta a pausa que encerra.
    select e.id into v_referencia
      from public.plt_eventos e
     where e.card_id = new.card_id
       and e.tipo = 'execucao_pausada'
     order by e.ocorrido_em desc, e.id desc
     limit 1;
    if new.evento_referencia_id is null then
      new.evento_referencia_id := v_referencia;
    elsif new.evento_referencia_id is distinct from v_referencia then
      raise exception 'A retomada precisa apontar a pausa aberta deste card.'
        using errcode = 'check_violation';
    end if;

  elsif new.tipo = 'estorno' then
    if new.evento_referencia_id is null then
      raise exception 'Estorno precisa apontar o evento estornado (evento_referencia_id).'
        using errcode = 'check_violation';
    end if;

    select * into v_alvo from public.plt_eventos where id = new.evento_referencia_id;
    if not found or v_alvo.card_id <> new.card_id then
      raise exception 'O evento estornado precisa existir e ser do mesmo card.'
        using errcode = 'check_violation';
    end if;
    if v_alvo.tipo not in ('execucao_iniciada', 'execucao_finalizada') then
      raise exception 'Só gestos de execução (iniciar/finalizar) podem ser estornados. Movimentação errada se corrige movendo de novo; pausa errada se corrige retomando.'
        using errcode = 'check_violation';
    end if;
    if plt_privado.fn_evento_estornado(v_alvo.id) then
      raise exception 'Este evento já foi estornado.'
        using errcode = 'check_violation';
    end if;

    -- Só o ÚLTIMO gesto de execução válido é estornável (corrigir é desfazer
    -- do mais novo para o mais velho — mantém a história sempre coerente).
    select e.id into v_ultimo_exec
      from public.plt_eventos e
     where e.card_id = new.card_id
       and e.tipo in ('execucao_iniciada', 'execucao_finalizada')
       and not plt_privado.fn_evento_estornado(e.id)
     order by e.ocorrido_em desc, e.id desc
     limit 1;
    if v_ultimo_exec is distinct from v_alvo.id then
      raise exception 'Só o último gesto de execução do card pode ser estornado — desfaça do mais recente para trás.'
        using errcode = 'check_violation';
    end if;

    -- Quem pode: admin (qualquer setor) ou líder do setor ATUAL do card (D-24).
    select u.papel into v_papel from public.plt_usuarios u
     where u.id = new.usuario_id and u.ativo;
    if v_papel is null then
      raise exception 'Estorno exige um usuário ativo da plataforma.'
        using errcode = 'check_violation';
    end if;
    select coalesce(bool_or(us.lider_do_setor), false) into v_lider
      from public.plt_usuario_setores us
     where us.usuario_id = new.usuario_id
       and us.setor_id = v_card.setor_atual_id;
    if v_papel <> 'admin' and not v_lider then
      -- SESSAO-05/D-24: gate de estorno.
      raise exception 'Estorno é gesto de líder do setor ou de admin.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

comment on function plt_privado.fn_validar_execucao() is
  'Regras da D-24/D-48 valendo para todo escritor (M-14): iniciar obrigatório, limite por setor ignorando pausados, pausa só por líder/admin, retomada pela mesma trava do limite, estorno só do último gesto.';

-- ----------------------------------------------------------------------------
-- 7 · Os intervalos pausados de uma execução (helper — maquinaria, E-11)
--
-- A pausa aponta o iniciar (evento_referencia_id); a retomada aponta a pausa.
-- Devolve cada intervalo pausado JÁ RECORTADO à janela [p_ini, p_fim) — quem
-- soma tempo desconta estes intervalos (bruto: fim-ini; útil: fn_tempo_util).
-- SECURITY INVOKER de propósito (como fn_evento_estornado): a view roda com os
-- olhos de quem consulta.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_pausas_execucao(
  p_evento_inicio_id bigint,
  p_ini              timestamptz,
  p_fim              timestamptz
)
returns table (ini timestamptz, fim timestamptz)
language sql
stable
set search_path = public, pg_temp
as $$
  select greatest(p.ocorrido_em, p_ini)                as ini,
         least(coalesce(r.ocorrido_em, p_fim), p_fim)  as fim
    from public.plt_eventos p
    left join public.plt_eventos r
      on r.tipo = 'execucao_retomada'
     and r.evento_referencia_id = p.id
   where p.tipo = 'execucao_pausada'
     and p.evento_referencia_id = p_evento_inicio_id
     and greatest(p.ocorrido_em, p_ini) < least(coalesce(r.ocorrido_em, p_fim), p_fim);
$$;

comment on function plt_privado.fn_pausas_execucao(bigint, timestamptz, timestamptz) is
  'SESSAO-22 (D-48): intervalos pausados da execução iniciada pelo evento dado, recortados à janela pedida. Pausa sem retomada termina no fim da janela.';

-- ----------------------------------------------------------------------------
-- 8 · plt_vw_execucoes descontando as pausas
--
-- A forma muda (colunas novas pausa_total/pausado_desde) — drop + create
-- (E-17). `duracao` passa a ser o tempo QUE CONTA: do iniciar ao encerramento,
-- MENOS os intervalos pausados (D-48: pausado não conta tempo para a pessoa).
-- ----------------------------------------------------------------------------
drop view if exists public.plt_vw_execucoes;

create view public.plt_vw_execucoes as
with marcos as (
  select
    e.id,
    e.card_id,
    e.tipo,
    e.usuario_id,
    e.setor_origem_id,
    e.etapa_origem_id,
    e.ocorrido_em,
    lead(e.tipo)        over w as proximo_tipo,
    lead(e.usuario_id)  over w as proximo_usuario,
    lead(e.ocorrido_em) over w as proximo_em
  from public.plt_eventos e
  where (
      e.tipo in ('execucao_iniciada', 'execucao_finalizada')
      and not plt_privado.fn_evento_estornado(e.id)
    )
    or e.tipo in ('card_criado', 'movimentacao_setor', 'movimentacao_etapa')
  window w as (partition by e.card_id order by e.ocorrido_em, e.id)
)
select
  m.id                 as evento_inicio_id,
  m.card_id,
  coalesce(m.setor_origem_id, pos.setor_destino_id) as setor_id,
  coalesce(m.etapa_origem_id, pos.etapa_destino_id) as etapa_id,
  m.usuario_id         as usuario_inicio_id,
  case when m.proximo_tipo = 'execucao_finalizada' then m.proximo_usuario end as usuario_fim_id,
  m.ocorrido_em        as iniciou_em,
  m.proximo_em         as finalizou_em,
  case
    when m.proximo_tipo is null                  then null
    when m.proximo_tipo = 'execucao_finalizada'  then 'finalizada'
    when m.proximo_tipo = 'execucao_iniciada'    then 'transferencia'
    else 'movimentacao'
  end                  as encerramento,
  (m.proximo_tipo is null) as em_andamento,
  pz.pausado_desde,
  pz.total             as pausa_total,
  coalesce(m.proximo_em, now()) - m.ocorrido_em - pz.total as duracao
from marcos m
left join lateral (
  select p.setor_destino_id, p.etapa_destino_id
    from public.plt_eventos p
   where p.card_id = m.card_id
     and p.tipo in ('card_criado', 'movimentacao_setor', 'movimentacao_etapa')
     and (p.ocorrido_em, p.id) < (m.ocorrido_em, m.id)
   order by p.ocorrido_em desc, p.id desc
   limit 1
) pos on true
cross join lateral (
  -- Os intervalos pausados desta execução, recortados à janela dela (D-48).
  select coalesce(sum(px.fim - px.ini), interval '0') as total,
         -- Pausa ainda aberta (só faz sentido em execução em andamento).
         case when m.proximo_tipo is null
              then max(px.ini) filter (where px.fim >= now()) end as pausado_desde
    from plt_privado.fn_pausas_execucao(m.id, m.ocorrido_em,
                                        coalesce(m.proximo_em, now())) px
) pz
where m.tipo = 'execucao_iniciada';

comment on view public.plt_vw_execucoes is
  'Tempo de execução, o tempo que tem dono (D-02/D-24/D-48). Fecha em finalizada, transferência ou movimentação; ignora estornados; DESCONTA os intervalos pausados; setor/etapa da época.';

alter view public.plt_vw_execucoes set (security_invoker = on);

-- ----------------------------------------------------------------------------
-- 9 · plt_vw_permanencias: o card de PEDIDO fecha o PCP na liberação completa
--
-- D-48: o tempo em PCP é do pedido — da entrada até a liberação da última
-- unidade. A permanência do card de pedido (que fisicamente nunca sai do PCP)
-- passa a terminar em liberado_completo_em. Mesma forma → create or replace.
-- ----------------------------------------------------------------------------
create or replace view public.plt_vw_permanencias as
with posicoes as (
  select
    e.id,
    e.card_id,
    e.setor_destino_id as setor_id,
    e.etapa_destino_id as etapa_id,
    e.ocorrido_em      as entrou_em,
    lead(e.ocorrido_em) over (partition by e.card_id order by e.ocorrido_em, e.id) as saiu_em
  from public.plt_eventos e
  where e.tipo in ('card_criado', 'movimentacao_setor', 'movimentacao_etapa')
    and e.setor_destino_id is not null
)
select
  p.id            as evento_entrada_id,
  p.card_id,
  p.setor_id,
  p.etapa_id,
  p.entrou_em,
  fim.saiu_em,
  (fim.saiu_em is null)                              as em_andamento,
  coalesce(fim.saiu_em, now()) - p.entrou_em         as duracao,
  coalesce(et.eh_fila, false)                        as eh_fila
from posicoes p
left join public.plt_etapas et on et.id = p.etapa_id
left join public.plt_cards  c  on c.id  = p.card_id
cross join lateral (
  -- D-48 (SESSAO-22): o card de pedido "sai" do PCP quando a última unidade
  -- é liberada — mesmo continuando fisicamente lá.
  select coalesce(p.saiu_em,
                  case when c.tipo = 'pedido' then c.liberado_completo_em end) as saiu_em
) fim;

comment on view public.plt_vw_permanencias is
  'Tempo do card em cada etapa (D-02). eh_fila separa o tempo que pertence ao SETOR. O card de pedido fecha a permanência no PCP na liberação completa (D-48).';

alter view public.plt_vw_permanencias set (security_invoker = on);

-- ----------------------------------------------------------------------------
-- 10 · Portas de dashboard descontando as pausas (D-48) — corpos das
--      migrations 18/25/28 com o desconto; assinaturas e formas intactas.
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_dash_execucoes(
  p_de           timestamptz,
  p_ate          timestamptz,
  p_setor_id     bigint default null,
  p_usuario_id   uuid default null,
  p_limite       integer default 20,
  p_deslocamento integer default 0
)
returns table (
  evento_inicio_id bigint,
  card_id          bigint,
  pedido_numero    integer,
  item_codigo      text,
  item_descricao   text,
  indice_unidade   integer,
  total_unidades   integer,
  setor_id         bigint,
  setor_nome       text,
  etapa_nome       text,
  executor_nome    text,
  finalizador_nome text,
  iniciou_em       timestamptz,
  finalizou_em     timestamptz,
  em_andamento     boolean,
  encerramento     text,
  duracao_bruta    interval,
  duracao_util     interval,
  contagem_total   bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select v.evento_inicio_id,
         v.card_id,
         p.numero                          as pedido_numero,
         c.item_codigo,
         c.item_descricao,
         c.indice_unidade,
         c.total_unidades,
         v.setor_id,
         s.nome                            as setor_nome,
         e.nome                            as etapa_nome,
         ui.nome                           as executor_nome,
         uf.nome                           as finalizador_nome,
         v.iniciou_em,
         v.finalizou_em,
         v.em_andamento,
         v.encerramento,
         -- D-48: a view já desconta a pausa da duração.
         v.duracao                         as duracao_bruta,
         plt_privado.fn_tempo_util(v.iniciou_em, v.finalizou_em, v.setor_id, v.usuario_inicio_id)
           - pz.util                       as duracao_util,
         count(*) over ()                  as contagem_total
    from public.plt_vw_execucoes v
    join public.plt_cards c on c.id = v.card_id
    left join public.pedidos p on p.id = c.pedido_id
    left join public.plt_setores s on s.id = v.setor_id
    left join public.plt_etapas  e on e.id = v.etapa_id
    left join public.plt_usuarios ui on ui.id = v.usuario_inicio_id
    left join public.plt_usuarios uf on uf.id = v.usuario_fim_id
    cross join lateral (
      select coalesce(sum(plt_privado.fn_tempo_util(px.ini, px.fim, v.setor_id, v.usuario_inicio_id)), interval '0') as util
        from plt_privado.fn_pausas_execucao(v.evento_inicio_id, v.iniciou_em,
                                            coalesce(v.finalizou_em, now())) px
    ) pz
   where v.setor_id in (select plt_privado.fn_setores_dashboard())
     and (p_setor_id is null or v.setor_id = p_setor_id)
     and (p_usuario_id is null or v.usuario_inicio_id = p_usuario_id)
     and v.iniciou_em >= p_de and v.iniciou_em < p_ate
   order by v.iniciou_em desc
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_dash_execucoes(timestamptz, timestamptz, bigint, uuid, integer, integer) is
  'Dashboard (SESSAO-10/D-32): a lista detalhada de execuções, com duração bruta e útil (D-29) — ambas descontando pausas (D-48). Endpoint de propósito — gate por setor do dashboard.';

create or replace function public.plt_fn_dash_tempos_setor(
  p_de  timestamptz,
  p_ate timestamptz
)
returns table (
  setor_id        bigint,
  setor_nome      text,
  fila_bruta      interval,
  fila_util       interval,
  execucao_bruta  interval,
  execucao_util   interval,
  total_util      interval,
  execucoes       integer,
  finalizadas     integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with setores_ok as (
    select sd as id from plt_privado.fn_setores_dashboard() sd
  ),
  fila as (
    select pm.setor_id,
           sum(cl.fim - cl.ini)                                           as bruta,
           sum(plt_privado.fn_tempo_util(cl.ini, cl.fim, pm.setor_id, null)) as util
      from public.plt_vw_permanencias pm
      cross join lateral (
        select greatest(pm.entrou_em, p_de) as ini,
               least(coalesce(pm.saiu_em, now()), p_ate) as fim
      ) cl
     where pm.eh_fila
       and pm.setor_id in (select id from setores_ok)
       and cl.fim > cl.ini
     group by pm.setor_id
  ),
  execucao as (
    select v.setor_id,
           sum((cl.fim - cl.ini) - pz.bruta)                              as bruta,
           sum(plt_privado.fn_tempo_util(cl.ini, cl.fim, v.setor_id, v.usuario_inicio_id) - pz.util) as util,
           count(*)::int                                                  as execucoes,
           count(*) filter (where v.encerramento = 'finalizada')::int     as finalizadas
      from public.plt_vw_execucoes v
      cross join lateral (
        select greatest(v.iniciou_em, p_de) as ini,
               least(coalesce(v.finalizou_em, now()), p_ate) as fim
      ) cl
      cross join lateral (
        -- D-48: pausado não conta tempo — desconto recortado ao período.
        select coalesce(sum(px.fim - px.ini), interval '0') as bruta,
               coalesce(sum(plt_privado.fn_tempo_util(px.ini, px.fim, v.setor_id, v.usuario_inicio_id)), interval '0') as util
          from plt_privado.fn_pausas_execucao(v.evento_inicio_id, cl.ini, cl.fim) px
      ) pz
     where v.setor_id in (select id from setores_ok)
       and cl.fim > cl.ini
     group by v.setor_id
  )
  select s.id                                   as setor_id,
         s.nome                                 as setor_nome,
         coalesce(f.bruta, interval '0')        as fila_bruta,
         coalesce(f.util,  interval '0')        as fila_util,
         coalesce(x.bruta, interval '0')        as execucao_bruta,
         coalesce(x.util,  interval '0')        as execucao_util,
         coalesce(f.util, interval '0') + coalesce(x.util, interval '0') as total_util,
         coalesce(x.execucoes, 0)               as execucoes,
         coalesce(x.finalizadas, 0)             as finalizadas
    from public.plt_setores s
    left join fila f     on f.setor_id = s.id
    left join execucao x on x.setor_id = s.id
   where s.id in (select id from setores_ok)
     and s.ativo
   order by s.ordem, s.id;
$$;

comment on function public.plt_fn_dash_tempos_setor(timestamptz, timestamptz) is
  'Dashboard (D-02): fila (do setor) vs execução (da pessoa), bruto e útil (D-29), clipado ao período e descontando pausas (D-48). Gate por setor do dashboard.';

create or replace function public.plt_fn_dash_tempos_pessoa(
  p_de       timestamptz,
  p_ate      timestamptz,
  p_setor_id bigint default null
)
returns table (
  usuario_id     uuid,
  usuario_nome   text,
  matricula      text,
  execucoes      integer,
  cards_atendidos integer,
  tempo_bruto    interval,
  tempo_util     interval
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.id                                  as usuario_id,
         u.nome                                as usuario_nome,
         u.matricula,
         count(*)::int                         as execucoes,
         count(distinct v.card_id)::int        as cards_atendidos,
         sum((cl.fim - cl.ini) - pz.bruta)     as tempo_bruto,
         sum(plt_privado.fn_tempo_util(cl.ini, cl.fim, v.setor_id, v.usuario_inicio_id) - pz.util)
                                               as tempo_util
    from public.plt_vw_execucoes v
    join public.plt_usuarios u on u.id = v.usuario_inicio_id
    cross join lateral (
      select greatest(v.iniciou_em, p_de) as ini,
             least(coalesce(v.finalizou_em, now()), p_ate) as fim
    ) cl
    cross join lateral (
      select coalesce(sum(px.fim - px.ini), interval '0') as bruta,
             coalesce(sum(plt_privado.fn_tempo_util(px.ini, px.fim, v.setor_id, v.usuario_inicio_id)), interval '0') as util
        from plt_privado.fn_pausas_execucao(v.evento_inicio_id, cl.ini, cl.fim) px
    ) pz
   where v.setor_id in (select plt_privado.fn_setores_dashboard())
     and (p_setor_id is null or v.setor_id = p_setor_id)
     and cl.fim > cl.ini
   group by u.id, u.nome, u.matricula
   order by tempo_util desc nulls last;
$$;

comment on function public.plt_fn_dash_tempos_pessoa(timestamptz, timestamptz, bigint) is
  'Dashboard (D-02/D-32): tempo de execução por pessoa (bruto e útil), clipado ao período e descontando pausas (D-48). Gate por setor do dashboard.';

create or replace function public.plt_fn_dash_tempos_item(
  p_de  timestamptz,
  p_ate timestamptz
)
returns table (
  item_codigo    text,
  item_descricao text,
  execucoes      integer,
  unidades       integer,
  tempo_util     interval,
  media_por_unidade interval
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.item_codigo,
         max(c.item_descricao)                 as item_descricao,
         count(*)::int                         as execucoes,
         count(distinct v.card_id)::int        as unidades,
         sum(plt_privado.fn_tempo_util(cl.ini, cl.fim, v.setor_id, v.usuario_inicio_id) - pz.util)
                                               as tempo_util,
         sum(plt_privado.fn_tempo_util(cl.ini, cl.fim, v.setor_id, v.usuario_inicio_id) - pz.util)
           / greatest(count(distinct v.card_id), 1) as media_por_unidade
    from public.plt_vw_execucoes v
    join public.plt_cards c on c.id = v.card_id
    cross join lateral (
      select greatest(v.iniciou_em, p_de) as ini,
             least(coalesce(v.finalizou_em, now()), p_ate) as fim
    ) cl
    cross join lateral (
      select coalesce(sum(plt_privado.fn_tempo_util(px.ini, px.fim, v.setor_id, v.usuario_inicio_id)), interval '0') as util
        from plt_privado.fn_pausas_execucao(v.evento_inicio_id, cl.ini, cl.fim) px
    ) pz
   where v.setor_id in (select plt_privado.fn_setores_dashboard())
     and cl.fim > cl.ini
   group by c.item_codigo
   order by tempo_util desc nulls last;
$$;

comment on function public.plt_fn_dash_tempos_item(timestamptz, timestamptz) is
  'Dashboard (D-32): tempo útil de execução por item, com média por unidade, descontando pausas (D-48). Insumo do futuro tempo-padrão (X-04). Gate por setor do dashboard.';

create or replace function public.plt_fn_dash_tendencia_semanas(
  p_semanas integer default 6
)
returns table (
  semana_inicio date,
  unidades      integer,
  media_total   interval
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with alcance as (
    select not exists (
      select 1 from public.plt_setores s
       where s.ativo
         and s.id not in (select plt_privado.fn_setores_dashboard())
    ) as completo
  ),
  semanas as (
    select date_trunc('week', (now() at time zone 'America/Fortaleza'))::date
           - (n * 7) as inicio
      from generate_series(0, greatest(least(coalesce(p_semanas, 6), 26), 1) - 1) as n
  ),
  concluidos as (
    select c.id as card_id,
           min((e.ocorrido_em at time zone 'America/Fortaleza'))::date as chegou_dia
      from public.plt_cards c
      join public.plt_eventos e on e.card_id = c.id and e.tipo = 'movimentacao_setor'
      join public.plt_setores s on s.id = e.setor_destino_id and s.papel_no_fluxo = 'terminal'
     where c.tipo = 'unidade'
     group by c.id
  ),
  jornadas as (
    select co.card_id,
           date_trunc('week', co.chegou_dia)::date as semana,
           (select coalesce(sum(plt_privado.fn_tempo_util(pm.entrou_em, pm.saiu_em, pm.setor_id, null)), interval '0')
              from public.plt_vw_permanencias pm
             where pm.card_id = co.card_id and pm.eh_fila and pm.saiu_em is not null)
           + (select coalesce(sum(
                 plt_privado.fn_tempo_util(v.iniciou_em, v.finalizou_em, v.setor_id, v.usuario_inicio_id)
                 - (select coalesce(sum(plt_privado.fn_tempo_util(px.ini, px.fim, v.setor_id, v.usuario_inicio_id)), interval '0')
                      from plt_privado.fn_pausas_execucao(v.evento_inicio_id, v.iniciou_em, v.finalizou_em) px)
               ), interval '0')
                from public.plt_vw_execucoes v
               where v.card_id = co.card_id and v.finalizou_em is not null)
           as total_util
      from concluidos co
     where date_trunc('week', co.chegou_dia)::date in (select inicio from semanas)
  )
  select w.inicio                          as semana_inicio,
         count(j.card_id)::int             as unidades,
         avg(j.total_util)                 as media_total
    from semanas w
    left join jornadas j on j.semana = w.inicio
   where (select completo from alcance)
   group by w.inicio
   order by w.inicio;
$$;

comment on function public.plt_fn_dash_tendencia_semanas(integer) is
  'Tempo por setor (SESSAO-16/D-02): média semanal do tempo total útil (fila + execução, descontando pausas — D-48) por unidade concluída. Só para quem mede a fábrica inteira.';

create or replace function public.plt_fn_metas_painel(
  p_incluir_encerradas boolean default false,
  p_limite             integer default 20,
  p_deslocamento       integer default 0
)
returns table (
  meta_id         bigint,
  titulo          text,
  indicador       text,
  periodo         text,
  alvo            numeric,
  usuario_id      uuid,
  usuario_nome    text,
  setor_id        bigint,
  setor_nome      text,
  etapa_id        bigint,
  etapa_nome      text,
  criada_por_id   uuid,
  criada_por_nome text,
  encerrada_em    timestamptz,
  janela_inicio   timestamptz,
  janela_fim      timestamptz,
  progresso       numeric,
  contagem_total  bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with eu as (
    select plt_privado.fn_usuario_atual() as id
  ),
  visiveis as (
    select m.*
      from public.plt_metas m
     where plt_privado.fn_eh_admin()
        or m.usuario_id = (select id from eu)
        or m.setor_id in (select plt_privado.fn_setores_do_usuario())
        or m.criada_por_id = (select id from eu)
        or (m.usuario_id is not null and exists (
              select 1 from public.plt_usuario_setores us
               where us.usuario_id = m.usuario_id
                 and plt_privado.fn_eh_lider_de(us.setor_id)))
  )
  select m.id                                   as meta_id,
         m.titulo,
         m.indicador,
         m.periodo,
         m.alvo,
         m.usuario_id,
         du.nome                                as usuario_nome,
         m.setor_id,
         ds.nome                                as setor_nome,
         m.etapa_id,
         de.nome                                as etapa_nome,
         m.criada_por_id,
         cr.nome                                as criada_por_nome,
         m.encerrada_em,
         j.inicio                               as janela_inicio,
         j.fim                                  as janela_fim,
         pr.progresso,
         count(*) over ()                       as contagem_total
    from visiveis m
    left join public.plt_usuarios du on du.id = m.usuario_id
    left join public.plt_setores  ds on ds.id = m.setor_id
    left join public.plt_etapas   de on de.id = m.etapa_id
    left join public.plt_usuarios cr on cr.id = m.criada_por_id
    cross join lateral (
      select case m.periodo
               when 'diaria'  then date_trunc('day',   now() at time zone 'America/Fortaleza')
               when 'semanal' then date_trunc('week',  now() at time zone 'America/Fortaleza')
               else                date_trunc('month', now() at time zone 'America/Fortaleza')
             end as ini_local
    ) jl
    cross join lateral (
      select jl.ini_local at time zone 'America/Fortaleza' as inicio,
             (jl.ini_local + case m.periodo
                               when 'diaria'  then interval '1 day'
                               when 'semanal' then interval '7 days'
                               else                interval '1 month'
                             end) at time zone 'America/Fortaleza' as fim
    ) j
    cross join lateral (
      select case m.indicador
        -- unidades = execuções ENCERRADAS na janela; com etapa mirada (D-45),
        -- só as daquela etapa
        when 'unidades' then coalesce((
          select count(*)::numeric
            from public.plt_vw_execucoes v
           where v.finalizou_em >= j.inicio and v.finalizou_em < j.fim
             and (m.etapa_id is null or v.etapa_id = m.etapa_id)
             and ((m.usuario_id is not null and v.usuario_inicio_id = m.usuario_id)
               or (m.setor_id   is not null and v.setor_id = m.setor_id))), 0)
        when 'tarefas' then coalesce((
          select count(*)::numeric
            from public.plt_tarefas t
           where t.situacao = 'concluida'
             and t.concluida_em >= j.inicio and t.concluida_em < j.fim
             and ((m.usuario_id is not null and t.responsavel_id = m.usuario_id)
               or (m.setor_id   is not null and t.setor_id = m.setor_id))), 0)
        else coalesce((
          -- tempo_util descontando as pausas recortadas à janela (D-48).
          select round((extract(epoch from sum(
                   plt_privado.fn_tempo_util(
                     greatest(v.iniciou_em, j.inicio),
                     least(coalesce(v.finalizou_em, now()), j.fim),
                     v.setor_id, v.usuario_inicio_id)
                   - (select coalesce(sum(plt_privado.fn_tempo_util(px.ini, px.fim, v.setor_id, v.usuario_inicio_id)), interval '0')
                        from plt_privado.fn_pausas_execucao(
                               v.evento_inicio_id,
                               greatest(v.iniciou_em, j.inicio),
                               least(coalesce(v.finalizou_em, now()), j.fim)) px)
                 )) / 3600)::numeric, 2)
            from public.plt_vw_execucoes v
           where coalesce(v.finalizou_em, now()) > j.inicio
             and v.iniciou_em < j.fim
             and ((m.usuario_id is not null and v.usuario_inicio_id = m.usuario_id)
               or (m.setor_id   is not null and v.setor_id = m.setor_id))), 0)
      end as progresso
    ) pr
   where (p_incluir_encerradas or m.encerrada_em is null)
   order by (m.encerrada_em is not null),
            case m.periodo when 'diaria' then 1 when 'semanal' then 2 else 3 end,
            m.criada_em desc
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_metas_painel(boolean, integer, integer) is
  'Cockpit do Meu Painel (SESSAO-14/D-37; D-45 soma etapa e criador; D-48 desconta pausas do tempo útil). Endpoint de propósito — gate interno.';

-- ----------------------------------------------------------------------------
-- 11 · plt_fn_pedidos_kanban ganha o tempo em PCP do pedido (forma muda →
--      drop + create, E-17; as migrations 13/17 já dropam antes de criar)
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_pedidos_kanban(text, boolean, bigint[], integer, integer);

create or replace function public.plt_fn_pedidos_kanban(
  p_busca            text     default null,
  p_somente_sem_card boolean  default false,
  p_ids              bigint[] default null,
  p_limite           integer  default 20,
  p_deslocamento     integer  default 0
)
returns table (
  pedido_id       bigint,
  numero          integer,
  cliente_nome    text,
  data_pedido     date,
  data_prevista   date,
  situacao        text,
  total_itens     integer,
  total_unidades  integer,
  tem_card        boolean,
  unidades_liberadas integer,
  alterado_apos_liberacao boolean,
  entrou_pcp_em   timestamptz,
  liberado_completo_em timestamptz,
  contagem_total  bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id                                as pedido_id,
         p.numero,
         coalesce(c.nome, '')                as cliente_nome,
         p.data_pedido,
         p.data_prevista,
         p.situacao,
         coalesce(i.total_itens, 0)          as total_itens,
         coalesce(i.total_unidades, 0)       as total_unidades,
         (pc.id is not null)                 as tem_card,
         coalesce(u.liberadas, 0)            as unidades_liberadas,
         -- SESSAO-09: o Tiny mudou o pedido DEPOIS de unidades irem à produção.
         exists (select 1 from public.plt_eventos e
                  where e.card_id = pc.id and e.tipo = 'pedido_atualizado')
                                             as alterado_apos_liberacao,
         -- SESSAO-22 (D-48): o tempo em PCP é do pedido — entrada → liberação completa.
         ev.entrou_pcp_em,
         pc.liberado_completo_em,
         count(*) over ()                    as contagem_total
    from public.pedidos p
    left join public.clientes c on c.id = p.cliente_id
    left join lateral (
      select count(*)::int as total_itens,
             coalesce(sum(case when round(pi.quantidade) >= 1
                               then round(pi.quantidade)::int else 0 end), 0)::int
               as total_unidades
        from public.pedido_itens pi
       where pi.pedido_id = p.id
    ) i on true
    left join lateral (
      select count(*)::int as liberadas
        from public.plt_cards cu
       where cu.pedido_id = p.id and cu.tipo = 'unidade'
    ) u on true
    left join public.plt_cards pc on pc.pedido_id = p.id and pc.tipo = 'pedido'
    left join lateral (
      select min(e.ocorrido_em) as entrou_pcp_em
        from public.plt_eventos e
       where e.card_id = pc.id and e.tipo = 'card_criado'
    ) ev on true
   where plt_privado.fn_usuario_atual() is not null
     and (p_ids is null or p.id = any (p_ids))
     and (not coalesce(p_somente_sem_card, false) or pc.id is null)
     and (p_busca is null or btrim(p_busca) = ''
          or p.numero::text like btrim(p_busca) || '%'
          or c.nome ilike '%' || btrim(p_busca) || '%')
   order by p.data_pedido desc nulls last, p.numero desc
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_pedidos_kanban(text, boolean, bigint[], integer, integer) is
  'Porta de leitura do kanban: resumo de pedidos sem dado pessoal, com o conflito pós-liberação (S09) e o tempo em PCP do pedido (S22/D-48). Endpoint de propósito — gate por usuário ativo.';

-- ----------------------------------------------------------------------------
-- 12 · plt_fn_pedidos_aguardo ganha o tempo de aguardo (D-48: o pedido conta
--      aguardo total — insumo futuro do cálculo de tempo de entrega).
--      Forma muda → drop + create; o drop espelho foi acrescentado à migration 25.
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_pedidos_aguardo(text, integer, integer);

create or replace function public.plt_fn_pedidos_aguardo(
  p_busca        text    default null,
  p_limite       integer default 20,
  p_deslocamento integer default 0
)
returns table (
  card_id                 bigint,
  pedido_id               bigint,
  numero                  integer,
  cliente_nome            text,
  data_prevista           date,
  situacao                text,
  total_unidades          integer,
  unidades_liberadas      integer,
  unidades_prontas        integer,
  completo                boolean,
  alterado_apos_liberacao boolean,
  primeira_pronta_em      timestamptz,
  completo_em             timestamptz,
  contagem_total          bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select pc.id                          as card_id,
         p.id                           as pedido_id,
         p.numero,
         coalesce(c.nome, '')           as cliente_nome,
         p.data_prevista,
         p.situacao,
         coalesce(i.total_unidades, 0)  as total_unidades,
         coalesce(u.liberadas, 0)       as unidades_liberadas,
         coalesce(u.prontas, 0)         as unidades_prontas,
         (coalesce(i.total_unidades, 0) > 0
          and coalesce(u.prontas, 0) >= coalesce(i.total_unidades, 0)) as completo,
         exists (select 1 from public.plt_eventos e
                  where e.card_id = pc.id and e.tipo = 'pedido_atualizado')
                                        as alterado_apos_liberacao,
         -- SESSAO-22 (D-48): desde quando o pedido espera aqui.
         u.primeira_pronta              as primeira_pronta_em,
         case when coalesce(i.total_unidades, 0) > 0
               and coalesce(u.prontas, 0) >= coalesce(i.total_unidades, 0)
              then u.ultima_pronta end  as completo_em,
         count(*) over ()               as contagem_total
    from public.plt_cards pc
    join public.pedidos p on p.id = pc.pedido_id
    left join public.clientes c on c.id = p.cliente_id
    left join lateral (
      select coalesce(sum(case when round(pi.quantidade) >= 1
                               then round(pi.quantidade)::int else 0 end), 0)::int
               as total_unidades
        from public.pedido_itens pi
       where pi.pedido_id = p.id
    ) i on true
    left join lateral (
      -- "pronta" = está num setor TERMINAL agora (D-45)
      select count(*)::int as liberadas,
             count(*) filter (where s.papel_no_fluxo = 'terminal')::int as prontas,
             min(cu.concluido_em) filter (where s.papel_no_fluxo = 'terminal') as primeira_pronta,
             max(cu.concluido_em) filter (where s.papel_no_fluxo = 'terminal') as ultima_pronta
        from public.plt_cards cu
        left join public.plt_setores s on s.id = cu.setor_atual_id
       where cu.pedido_id = p.id and cu.tipo = 'unidade'
         and cu.arquivado_em is null
    ) u on true
   where plt_privado.fn_pode_ver_expedicao()
     and pc.tipo = 'pedido'
     and pc.arquivado_em is null
     and pc.lancado_rotas_em is null
     and coalesce(u.prontas, 0) > 0
     and (p_busca is null or btrim(p_busca) = ''
          or p.numero::text like btrim(p_busca) || '%'
          or c.nome ilike '%' || btrim(p_busca) || '%')
   order by (coalesce(i.total_unidades, 0) > 0
             and coalesce(u.prontas, 0) >= coalesce(i.total_unidades, 0)) desc,
            p.data_prevista asc nulls last, p.numero
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_pedidos_aguardo(text, integer, integer) is
  'Pedidos em aguardo (SESSAO-15/D-38): pedidos com unidade pronta ainda não lançados, com (k/n), completo e o tempo de aguardo (S22/D-48). Gate da logística. Endpoint de propósito.';

-- ----------------------------------------------------------------------------
-- 13 · Limite editável pelo líder do próprio setor (D-48) — RPC com gate e
--      trilha; a policy de plt_setores continua só-admin (nada mais se abre)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_definir_limite_execucoes(
  p_setor_id bigint,
  p_limite   integer
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null then
    raise exception 'Só usuário ativo da plataforma altera o limite de execuções.'
      using errcode = 'insufficient_privilege';
  end if;
  if not (plt_privado.fn_eh_admin() or plt_privado.fn_eh_lider_de(p_setor_id)) then
    raise exception 'Alterar o limite de execuções é gesto do líder do setor ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;
  if p_limite is not null and p_limite < 1 then
    raise exception 'O limite precisa ser um número inteiro maior que zero — ou vazio para sem limite.'
      using errcode = 'check_violation';
  end if;

  update public.plt_setores
     set limite_execucoes_por_pessoa = p_limite
   where id = p_setor_id;
  if not found then
    raise exception 'Setor % não existe.', p_setor_id using errcode = 'no_data_found';
  end if;

  -- D-40: toda atividade gera log.
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_usuario, 'limite_execucoes_alterado',
            jsonb_build_object('setor_id', p_setor_id, 'limite', p_limite));
end;
$$;

comment on function public.plt_fn_definir_limite_execucoes(bigint, integer) is
  'SESSAO-22 (D-48): define o limite de execuções por pessoa do setor. Gate: líder do setor ou admin. NULL = sem limite. Endpoint de propósito.';

-- Setor novo nasce com o padrão 1 (D-48). Os existentes mudam por SQL de
-- manutenção — reaplicar migrations não pode sobrescrever escolha do admin.
alter table public.plt_setores
  alter column limite_execucoes_por_pessoa set default 1;

comment on column public.plt_setores.limite_execucoes_por_pessoa is
  'D-24/D-48: quantos cards a MESMA pessoa pode ter em execução neste setor ao mesmo tempo. Padrão 1 (D-48); NULL = sem limite. Execução pausada não conta.';

-- ----------------------------------------------------------------------------
-- 14 · Projeção retroativa da liberação completa (derivada de eventos —
--      idempotente por natureza; roda em qualquer reaplicação)
-- ----------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in select distinct c.pedido_id
             from public.plt_cards c
            where c.tipo = 'pedido' and c.pedido_id is not null
  loop
    perform plt_privado.fn_recalcular_liberacao(r.pedido_id);
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- 15 · Quem executa o quê (E-11) — e o check mais novo valida a tabela inteira
-- ----------------------------------------------------------------------------
revoke all on function plt_privado.fn_resolver_etapa_fila()                     from public, anon, authenticated;
revoke all on function plt_privado.fn_recalcular_liberacao(bigint)              from public, anon, authenticated;
revoke all on function plt_privado.fn_pausas_execucao(bigint, timestamptz, timestamptz) from public, anon;
revoke all on function public.plt_fn_pedidos_kanban(text, boolean, bigint[], integer, integer) from public, anon;
revoke all on function public.plt_fn_pedidos_aguardo(text, integer, integer)    from public, anon;
revoke all on function public.plt_fn_definir_limite_execucoes(bigint, integer)  from public, anon;

-- A view (security_invoker) avalia o helper com o papel de quem consulta.
grant execute on function plt_privado.fn_pausas_execucao(bigint, timestamptz, timestamptz) to authenticated;
grant execute on function public.plt_fn_pedidos_kanban(text, boolean, bigint[], integer, integer) to authenticated;
grant execute on function public.plt_fn_pedidos_aguardo(text, integer, integer)    to authenticated;
grant execute on function public.plt_fn_definir_limite_execucoes(bigint, integer)  to authenticated;

-- E-19: o check de tipos mais novo valida a tabela inteira.
alter table public.plt_eventos validate constraint plt_eventos_tipo_check;
