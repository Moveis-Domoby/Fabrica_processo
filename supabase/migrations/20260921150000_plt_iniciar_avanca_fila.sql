-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 30 — INICIAR NA FILA AVANÇA A ETAPA
-- Sessão: SESSAO-22 (ajuste da revisão do dono) · Data: 2026-09-21 · D-48 ↪️
--
-- Pedido do dono na revisão: "quando eu iniciar qualquer card que estiver na
-- fila, ele deve ser automaticamente movido para a próxima etapa". É o M-01
-- puro — o humano decide (iniciar), o sistema executa a consequência (sair da
-- fila). E confirma o desenho do limite: uma ETAPA pode ter várias execuções
-- ao mesmo tempo; quem não pode ter duas é a PESSOA (limite por setor, D-48).
--
-- Mecânica (append-only, RNF-05): dentro da validação do `execucao_iniciada`
-- (BEFORE), quando o card está numa etapa FILA de setor de PRODUÇÃO e existe
-- uma próxima etapa (ordem seguinte, ativa, não-DANIFICADO), nasce ANTES um
-- `movimentacao_etapa` origem `automacao` para ela, datado 1ms ANTES do
-- iniciar (o id do iniciar já foi gerado antes do trigger — a ordem de leitura
-- é sempre (ocorrido_em, id), então o instante decide): a execução abre já na
-- etapa nova e NÃO é encerrada pelo mover (a regra "mover encerra execução"
-- vale para o que vem DEPOIS do iniciar, como sempre). Sem próxima etapa
-- cadastrada, nada se move e a execução corre na própria fila (D-14).
-- ============================================================================

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
  v_eh_fila      boolean;
  v_producao     boolean;
  v_proxima      bigint;
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

    -- D-48 ↪️ (revisão do dono, 21/09): iniciar um card que está na FILA de um
    -- setor de PRODUÇÃO avança para a próxima etapa — o mover nasce ANTES do
    -- iniciar (id menor), então a execução abre já na etapa nova.
    if v_card.etapa_atual_id is not null then
      select e.eh_fila, s.papel_no_fluxo = 'producao'
        into v_eh_fila, v_producao
        from public.plt_etapas e
        join public.plt_setores s on s.id = e.setor_id
       where e.id = v_card.etapa_atual_id;
      if coalesce(v_eh_fila, false) and coalesce(v_producao, false) then
        select e2.id into v_proxima
          from public.plt_etapas e2
          join public.plt_etapas fila on fila.id = v_card.etapa_atual_id
         where e2.setor_id = v_card.setor_atual_id
           and e2.ativa and not e2.eh_danificado and not e2.eh_fila
           and (e2.ordem, e2.id) > (fila.ordem, fila.id)
         order by e2.ordem, e2.id
         limit 1;
        if v_proxima is not null then
          insert into public.plt_eventos
              (card_id, tipo, origem, usuario_id, ocorrido_em,
               setor_origem_id, setor_destino_id, etapa_origem_id, etapa_destino_id)
            values
              (new.card_id, 'movimentacao_etapa', 'automacao', new.usuario_id,
               -- 1ms antes do iniciar: o id do iniciar já nasceu antes deste
               -- trigger — é o instante que garante a ordem certa da leitura.
               new.ocorrido_em - interval '1 millisecond',
               v_card.setor_atual_id, v_card.setor_atual_id,
               v_card.etapa_atual_id, v_proxima);
          -- A projeção já rodou para o mover — o iniciar registra a etapa NOVA.
          select * into v_card from public.plt_cards where id = new.card_id;
          new.setor_origem_id := v_card.setor_atual_id;
          new.etapa_origem_id := v_card.etapa_atual_id;
        end if;
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
  'Regras da D-24/D-48 valendo para todo escritor (M-14): iniciar obrigatório; iniciar na FILA de produção avança sozinho para a próxima etapa (D-48 ↪️); limite por setor ignorando pausados; pausa só por líder/admin; retomada pela mesma trava do limite; estorno só do último gesto.';
