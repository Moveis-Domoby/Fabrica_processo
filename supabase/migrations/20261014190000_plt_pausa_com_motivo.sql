-- ============================================================================
-- SESSAO-31 · etapa G (§4 · D-125 resp. 9 — ↩️ D-59/D-48): PAUSA COM MOTIVO.
--
--  1. Pausar um card em EXECUÇÃO pede o motivo (a lista de Utilitários →
--     "Motivos de pausa", ou "Outro" com texto): a pausa da D-48 (não conta
--     tempo nem ocupa o limite; retomar passa pela trava do limite) — agora
--     o PRÓPRIO operador pausa o card dele; o líder/admin pausa o de qualquer
--     um do setor; retomar: o próprio, o líder, o admin. Pausar/Retomar moram
--     na janela do card (a frente segue sem botões — D-59).
--  2. Arrastar para a etapa de parada (o PARADO — a etapa marca "pede o
--     motivo") um card em execução pergunta o motivo: o tempo fecha como antes
--     (D-59) e o motivo fica no fato e na frente do card ("Parado · motivo").
--  3. O motivo é projetado no card (pausa_motivo) — a frente e o quadro leem
--     sem ir buscar; o histórico tem o fato com o motivo.
-- ============================================================================
set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · A etapa que pede o motivo e o motivo projetado
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'plt_etapas' and column_name = 'pede_motivo') then
    alter table public.plt_etapas add column pede_motivo boolean not null default false;
    -- Nasce ligada nas etapas PARADO de hoje dos setores de PRODUÇÃO (a regra
    -- que o dono descreveu — no PCP ninguém executa); depois é do admin em
    -- Setores e etapas — reaplicar não desfaz a escolha.
    update public.plt_etapas e set pede_motivo = true
     where e.ativa and not e.eh_fila and not e.eh_danificado and e.setor_destino_id is null
       and plt_privado.fn_nome_comparavel(e.nome) = 'parado'
       and exists (select 1 from public.plt_setores s where s.id = e.setor_id and s.papel_no_fluxo = 'producao');
  end if;
end;
$$;
comment on column public.plt_etapas.pede_motivo is
  'SESSAO-31 (§4): soltar aqui um card em execução pede o motivo da parada (o PARADO). O tempo fecha como antes (D-59); o motivo fica no fato e na frente do card.';

alter table public.plt_cards add column if not exists pausa_motivo text;
comment on column public.plt_cards.pausa_motivo is
  'SESSAO-31 (§4): o motivo da pausa (execução pausada) ou da parada (solto no PARADO) — projeção dos fatos; some ao retomar, iniciar ou mudar de lugar sem motivo.';

-- As propriedades do card (recriada POR INTEIRO a partir da migration 69): + o motivo da pausa/parada.
create or replace function plt_privado.fn_projetar_card()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_m   jsonb;
  v_uid uuid;
begin
  if new.tipo = 'card_criado' then
    -- O avulso guarda quem o criou (quem edita e quem vê — D-125).
    update public.plt_cards
       set criado_por_id = new.usuario_id,
           participantes = case when new.usuario_id is null then participantes
                                else (select array_agg(distinct x) from unnest(participantes || new.usuario_id) x) end
     where id = new.card_id and tipo = 'avulso' and criado_por_id is null;

  elsif new.tipo = 'card_editado' then
    v_m := coalesce(new.dados -> 'mudancas', '{}'::jsonb);
    update public.plt_cards
       set titulo       = case when v_m ? 'titulo'      then v_m -> 'titulo' ->> 'depois' else titulo end,
           descricao    = case when v_m ? 'descricao'   then v_m -> 'descricao' ->> 'depois' else descricao end,
           inicio_em    = case when v_m ? 'inicio_em'   then (v_m -> 'inicio_em' ->> 'depois')::date else inicio_em end,
           vence_em     = case when v_m ? 'vence_em'    then (v_m -> 'vence_em' ->> 'depois')::date else vence_em end,
           vinculo_tipo = case when v_m ? 'vinculo'     then v_m -> 'vinculo' -> 'depois' ->> 'tipo' else vinculo_tipo end,
           vinculo_id   = case when v_m ? 'vinculo'     then (v_m -> 'vinculo' -> 'depois' ->> 'id')::bigint else vinculo_id end
     where id = new.card_id;

  elsif new.tipo in ('responsavel_adicionado', 'responsavel_removido') then
    v_uid := nullif(new.dados ->> 'responsavel_id', '')::uuid;
    if new.tipo = 'responsavel_adicionado' then
      update public.plt_cards
         set responsaveis = (select array_agg(distinct x) from unnest(responsaveis || v_uid) x)
       where id = new.card_id;
    else
      update public.plt_cards set responsaveis = array_remove(responsaveis, v_uid) where id = new.card_id;
    end if;
    update public.plt_cards set participantes = plt_privado.fn_participantes_do_card(new.card_id)
     where id = new.card_id;

  elsif new.tipo = 'comentario_adicionado' then
    update public.plt_cards set mensagens_qtd = mensagens_qtd + 1 where id = new.card_id;
    if jsonb_array_length(coalesce(new.dados -> 'mencoes', '[]'::jsonb)) > 0 then
      update public.plt_cards set participantes = plt_privado.fn_participantes_do_card(new.card_id)
       where id = new.card_id;
    end if;

  elsif new.tipo = 'comentario_apagado' then
    update public.plt_cards set mensagens_qtd = greatest(mensagens_qtd - 1, 0) where id = new.card_id;

  elsif new.tipo = 'anexo_adicionado' then
    update public.plt_cards set anexos_qtd = anexos_qtd + 1 where id = new.card_id;

  elsif new.tipo = 'anexo_removido' then
    update public.plt_cards set anexos_qtd = greatest(anexos_qtd - 1, 0) where id = new.card_id;

  elsif new.tipo = 'avulso_concluido' then
    update public.plt_cards set concluido_em = new.ocorrido_em, pausa_motivo = null where id = new.card_id;

  -- SESSAO-31 (§4): o motivo da pausa / da parada.
  elsif new.tipo = 'execucao_pausada' then
    update public.plt_cards
       set pausa_motivo = coalesce(nullif(new.dados ->> 'motivo', ''), nullif(btrim(coalesce(new.observacao, '')), ''))
     where id = new.card_id;
  elsif new.tipo in ('execucao_retomada', 'execucao_iniciada', 'card_arquivado') then
    update public.plt_cards set pausa_motivo = null where id = new.card_id and pausa_motivo is not null;
  elsif new.tipo in ('movimentacao_etapa', 'movimentacao_setor') then
    update public.plt_cards
       set pausa_motivo = nullif(new.dados ->> 'motivo_parada', '')
     where id = new.card_id and pausa_motivo is distinct from nullif(new.dados ->> 'motivo_parada', '');
  end if;
  return null;
end;
$$;

drop trigger if exists plt_eventos_projetar_card on public.plt_eventos;
create trigger plt_eventos_projetar_card
  after insert on public.plt_eventos
  for each row
  when (new.tipo in ('card_criado', 'card_editado', 'responsavel_adicionado', 'responsavel_removido',
                     'comentario_adicionado', 'comentario_apagado', 'anexo_adicionado', 'anexo_removido',
                     'avulso_concluido', 'execucao_pausada', 'execucao_retomada', 'execucao_iniciada',
                     'card_arquivado', 'movimentacao_etapa', 'movimentacao_setor'))
  execute function plt_privado.fn_projetar_card();

-- O motivo das pausas que já estão abertas hoje (sem motivo — fica nulo).
update public.plt_cards c
   set pausa_motivo = (select nullif(btrim(coalesce(ev.observacao, '')), '')
                         from public.plt_eventos ev
                        where ev.card_id = c.id and ev.tipo = 'execucao_pausada'
                        order by ev.id desc limit 1)
 where c.pausado_em is not null and c.pausa_motivo is null;

-- ----------------------------------------------------------------------------
-- 2 · Quem pausa (recriada POR INTEIRO a partir da migration 37): + o próprio
--     operador, no card que ele executa
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
        -- SESSAO-24: o quadro é por arrasto — terminar é arrastar o card adiante.
        raise exception 'Limite do setor atingido: esta pessoa já tem % card(s) em andamento aqui (máximo %). Termine o que está em andamento — arraste-o adiante — antes de pegar outro.',
          v_em_execucao, v_limite
          using errcode = 'check_violation';
      end if;
    end if;

    -- D-48 ↪️ (revisão do dono, 21/09): iniciar um card que está na FILA de um
    -- setor de PRODUÇÃO avança para a etapa de início — o mover nasce ANTES do
    -- iniciar (id menor), então a execução abre já na etapa nova.
    if v_card.etapa_atual_id is not null then
      select e.eh_fila, s.papel_no_fluxo = 'producao'
        into v_eh_fila, v_producao
        from public.plt_etapas e
        join public.plt_setores s on s.id = e.setor_id
       where e.id = v_card.etapa_atual_id;
      if coalesce(v_eh_fila, false) and coalesce(v_producao, false) then
        -- SESSAO-24: a etapa de início tem UM dono (o arrasto usa a mesma).
        v_proxima := plt_privado.fn_etapa_inicio(v_card.setor_atual_id);
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

    -- Quem pausa: líder do setor ATUAL do card ou admin (D-48) — ↩️ SESSAO-31
    -- (D-125 resp. 9): e o PRÓPRIO operador, no card que ele executa.
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
    if v_papel <> 'admin' and not v_lider and new.usuario_id is distinct from v_card.executor_atual_id then
      raise exception 'Pausar é gesto de quem executa o card, do líder do setor ou de admin.'
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

-- ----------------------------------------------------------------------------
-- 3 · O card como o quadro mostra (recriada POR INTEIRO a partir da migration
--     70): + o motivo da pausa
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_quadro_cards(p_ids bigint[])
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'tipo', c.tipo, 'pedido_id', c.pedido_id, 'card_pai_id', c.card_pai_id,
           'item_seq', c.item_seq, 'item_codigo', c.item_codigo, 'item_descricao', c.item_descricao,
           'indice_unidade', c.indice_unidade, 'total_unidades', c.total_unidades,
           'setor_atual_id', c.setor_atual_id, 'etapa_atual_id', c.etapa_atual_id, 'desde', c.desde,
           'executor_atual_id', c.executor_atual_id, 'responsavel_id', c.responsavel_id,
           'delegado_em', c.delegado_em, 'qualidade_atual', c.qualidade_atual, 'concluido_em', c.concluido_em,
           'pausado_em', c.pausado_em, 'liberado_completo_em', c.liberado_completo_em,
           'produto_tiny_id', c.produto_tiny_id, 'etiquetas', c.etiquetas,
           'parecer_pendente_id', c.parecer_pendente_id,
           -- SESSAO-31: a frente do card (D-125 / §2)
           'titulo', c.titulo, 'descricao', left(c.descricao, 600),
           'inicio_em', c.inicio_em, 'vence_em', c.vence_em, 'responsaveis', to_jsonb(c.responsaveis),
           'anexos_qtd', c.anexos_qtd, 'mensagens_qtd', c.mensagens_qtd,
           'vinculo_tipo', c.vinculo_tipo, 'vinculo_id', c.vinculo_id,
           'vinculo_rotulo', case when c.vinculo_tipo is null then null
                                  else plt_privado.fn_vinculo_rotulo(c.vinculo_tipo, c.vinculo_id) end,
           'ajuste_destino', c.ajuste_destino, 'criado_por_id', c.criado_por_id,
           -- SESSAO-31 (§4): o motivo da pausa / da parada, na frente do card
           'pausa_motivo', c.pausa_motivo
         ) order by o.ord), '[]'::jsonb)
    from unnest(p_ids) with ordinality as o(id, ord)
    join public.plt_cards c on c.id = o.id;
$$;

-- ----------------------------------------------------------------------------
-- 3c · O quadro numa requisição (recriada POR INTEIRO a partir da migration
--      70): as etapas dizem quais pedem o motivo
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_quadro_setor(p_setor_id bigint, p_por_coluna integer default 10)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_n       integer := least(greatest(coalesce(p_por_coluna, 10), 1), 50);
  v_colunas jsonb := '[]'::jsonb;
  v_ids     bigint[] := '{}';
  v_pagina  bigint[];
  v_total   integer;
  r         record;
begin
  if not plt_privado.fn_pode_ver_quadro(p_setor_id) then
    raise exception 'Você não vê o quadro deste setor.' using errcode = 'insufficient_privilege';
  end if;

  -- A coluna "Chegada" (sem etapa) e cada etapa ativa, na ordem do setor.
  for r in
    select null::bigint as etapa_id, -1 as ordem, 0::bigint as id
    union all
    select e.id, e.ordem, e.id from public.plt_etapas e where e.setor_id = p_setor_id and e.ativa
    order by 2, 3
  loop
    v_pagina := plt_privado.fn_quadro_pagina(p_setor_id, r.etapa_id, null, null, v_n);
    v_total := plt_privado.fn_quadro_total(p_setor_id, r.etapa_id);
    v_colunas := v_colunas || jsonb_build_array(jsonb_build_object(
                   'etapa_id', r.etapa_id, 'total', v_total, 'cards', plt_privado.fn_quadro_cards(v_pagina)));
    v_ids := v_ids || v_pagina;
  end loop;

  return jsonb_build_object(
    'setor_id', p_setor_id,
    'por_coluna', v_n,
    'etapas', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'setor_id', e.setor_id, 'nome', e.nome, 'ordem', e.ordem,
                                          'eh_fila', e.eh_fila, 'eh_danificado', e.eh_danificado, 'ativa', e.ativa,
                                          'setor_destino_id', e.setor_destino_id, 'conclui_producao', e.conclui_producao,
                                          'pede_motivo', e.pede_motivo)
                       order by e.ordem, e.id)
        from public.plt_etapas e where e.setor_id = p_setor_id and e.ativa), '[]'::jsonb),
    'colunas', v_colunas,
    'etiquetas', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'nome', t.nome, 'cor', t.cor,
                                                               'arquivada_em', t.arquivada_em) order by t.nome)
                             from public.plt_etiquetas t), '[]'::jsonb),
    'campos', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'nome', f.nome, 'tipo', f.tipo, 'opcoes', f.opcoes,
                                                            'em_pecas', f.em_pecas, 'em_pedidos', f.em_pedidos,
                                                            'em_avulsos', f.em_avulsos, 'arquivado_em', f.arquivado_em)
                                         order by f.nome)
                          from public.plt_campos f), '[]'::jsonb)
  ) || plt_privado.fn_quadro_junto(v_ids);
end;
$$;

-- ----------------------------------------------------------------------------
-- 3b · A janela do card (recriada POR INTEIRO a partir da migration 71): +
--      Pausar / Retomar nas permissões
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_card_janela(p_card_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_card    public.plt_cards%rowtype;
  v_editar  boolean;
  v_pessoas uuid[];
begin
  select * into v_card from public.plt_cards where id = p_card_id;
  if not found then
    raise exception 'Card % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  if not plt_privado.fn_pode_anexar(p_card_id) then
    raise exception 'Você não vê este card.' using errcode = 'insufficient_privilege';
  end if;
  v_editar := plt_privado.fn_pode_editar_card(p_card_id);
  v_pessoas := array_remove(v_card.responsaveis || v_card.criado_por_id || v_card.executor_atual_id, null);

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
    'pessoas', coalesce((select jsonb_object_agg(u.id, jsonb_build_object('nome', u.nome, 'foto', u.foto_caminho))
                           from public.plt_usuarios u where u.id = any (v_pessoas)), '{}'::jsonb),
    'pedido', (select jsonb_build_object('pedido_id', p.id, 'numero', p.numero, 'cliente_nome', coalesce(cl.nome, ''),
                                         'situacao', p.situacao, 'data_prevista', p.data_prevista)
                 from public.pedidos p left join public.clientes cl on cl.id = p.cliente_id
                where p.id = v_card.pedido_id),
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
                       or plt_privado.fn_eh_admin()),
      'anexar', v_card.arquivado_em is null,
      'ver_removidos', plt_privado.fn_eh_admin(),
      -- SESSAO-31 (§4 · D-125 resp. 9): pausar — o próprio executor, o líder, o admin.
      'pausar', v_card.executor_atual_id is not null and v_card.pausado_em is null and v_card.arquivado_em is null
                and (v_card.executor_atual_id = plt_privado.fn_usuario_atual() or plt_privado.fn_eh_admin()
                     or (v_card.setor_atual_id is not null and plt_privado.fn_eh_lider_de(v_card.setor_atual_id))),
      'retomar', v_card.pausado_em is not null and v_card.arquivado_em is null
                 and (v_card.executor_atual_id = plt_privado.fn_usuario_atual() or plt_privado.fn_eh_admin()
                      or (v_card.setor_atual_id is not null and plt_privado.fn_eh_lider_de(v_card.setor_atual_id))))
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 4 · As portas da pausa
-- ----------------------------------------------------------------------------
-- O motivo escolhido: um da lista (tipo 'pausa', ativo) ou "Outro" com texto.
create or replace function plt_privado.fn_motivo_de_pausa(p_motivo_id bigint, p_texto text)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_txt text;
begin
  if p_motivo_id is not null then
    select m.texto into v_txt from public.plt_motivos m where m.id = p_motivo_id and m.tipo = 'pausa' and m.ativo;
    if v_txt is null then
      raise exception 'Escolha um motivo da lista (ou "Outro", escrevendo o motivo).' using errcode = 'check_violation';
    end if;
    if nullif(btrim(coalesce(p_texto, '')), '') is not null then
      v_txt := v_txt || ' — ' || left(btrim(p_texto), 200);
    end if;
    return v_txt;
  end if;
  v_txt := nullif(btrim(coalesce(p_texto, '')), '');
  if v_txt is null then
    raise exception 'Diga o motivo da pausa.' using errcode = 'check_violation';
  end if;
  return left(v_txt, 200);
end;
$$;

-- Pausar (a janela do card): o próprio operador, o líder do setor ou o admin.
create or replace function public.plt_fn_card_pausar(
  p_card_id     bigint,
  p_motivo_id   bigint default null,
  p_texto       text   default null,
  p_operador_id uuid   default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card    public.plt_cards%rowtype;
  v_usuario uuid;
  v_motivo  text;
  v_evento  bigint;
begin
  select * into v_card from public.plt_cards where id = p_card_id;
  if not found or v_card.arquivado_em is not null then
    raise exception 'Card % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  if plt_privado.fn_usuario_atual() is null then
    raise exception 'Entre na plataforma para pausar.' using errcode = 'insufficient_privilege';
  end if;
  v_usuario := case when p_operador_id is null then plt_privado.fn_usuario_atual()
                    else plt_privado.fn_autor_do_gesto(v_card.setor_atual_id, p_operador_id) end;
  -- o mesmo toque duas vezes = uma pausa só (Lei §10)
  if v_card.pausado_em is not null then
    return null;
  end if;
  v_motivo := plt_privado.fn_motivo_de_pausa(p_motivo_id, p_texto);
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
    values (p_card_id, 'execucao_pausada', v_usuario, 'interface', v_motivo,
            jsonb_build_object('motivo', v_motivo, 'motivo_id', p_motivo_id))
    returning id into v_evento;
  return v_evento;
end;
$$;

comment on function public.plt_fn_card_pausar(bigint, bigint, text, uuid) is
  'SESSAO-31 (§4 · D-125 resp. 9): pausa o card em execução com o motivo (da lista ou "Outro") — o próprio operador, o líder do setor ou o admin (a trava é do gatilho). Pausado não conta tempo nem ocupa o limite (D-48). p_operador_id = o PIN do tablet.';

create or replace function public.plt_fn_card_retomar(p_card_id bigint, p_operador_id uuid default null)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card    public.plt_cards%rowtype;
  v_usuario uuid;
  v_evento  bigint;
begin
  select * into v_card from public.plt_cards where id = p_card_id;
  if not found or v_card.arquivado_em is not null then
    raise exception 'Card % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  if plt_privado.fn_usuario_atual() is null then
    raise exception 'Entre na plataforma para retomar.' using errcode = 'insufficient_privilege';
  end if;
  if v_card.pausado_em is null then
    return null;                                   -- já está correndo
  end if;
  v_usuario := case when p_operador_id is null then plt_privado.fn_usuario_atual()
                    else plt_privado.fn_autor_do_gesto(v_card.setor_atual_id, p_operador_id) end;
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem)
    values (p_card_id, 'execucao_retomada', v_usuario, 'interface')
    returning id into v_evento;
  return v_evento;
end;
$$;

-- Soltar o card em execução no PARADO (a etapa que pede o motivo): o tempo
-- fecha como sempre (D-59) — o motivo fica no fato e na frente do card.
create or replace function public.plt_fn_card_parar(
  p_card_id     bigint,
  p_etapa_id    bigint,
  p_motivo_id   bigint default null,
  p_texto       text   default null,
  p_operador_id uuid   default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card    public.plt_cards%rowtype;
  v_etapa   public.plt_etapas%rowtype;
  v_usuario uuid;
  v_motivo  text;
  v_evento  bigint;
begin
  select * into v_card from public.plt_cards where id = p_card_id;
  if not found or v_card.arquivado_em is not null then
    raise exception 'Card % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  select * into v_etapa from public.plt_etapas where id = p_etapa_id and ativa;
  if not found or v_etapa.setor_id is distinct from v_card.setor_atual_id or not v_etapa.pede_motivo then
    raise exception 'Solte o card na etapa de parada do próprio quadro.' using errcode = 'check_violation';
  end if;
  if v_etapa.id = v_card.etapa_atual_id then
    raise exception 'O card já está aí.' using errcode = 'check_violation';
  end if;
  v_usuario := plt_privado.fn_autor_do_gesto(v_card.setor_atual_id, p_operador_id);
  v_motivo := plt_privado.fn_motivo_de_pausa(p_motivo_id, p_texto);
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id,
                                  setor_destino_id, etapa_destino_id, observacao, dados)
    values (p_card_id, 'movimentacao_etapa', v_usuario, 'interface', v_card.setor_atual_id, v_card.etapa_atual_id,
            v_card.setor_atual_id, p_etapa_id, v_motivo,
            jsonb_build_object('motivo_parada', v_motivo, 'motivo_id', p_motivo_id))
    returning id into v_evento;
  return v_evento;
end;
$$;

comment on function public.plt_fn_card_parar(bigint, bigint, bigint, text, uuid) is
  'SESSAO-31 (§4): o card em execução solto na etapa de parada (o PARADO, que pede o motivo) — move como sempre (o tempo fecha — D-59), com o motivo no fato e na frente do card.';

-- ----------------------------------------------------------------------------
-- 5 · Quem chama o quê
-- ----------------------------------------------------------------------------
revoke all on function plt_privado.fn_motivo_de_pausa(bigint, text) from public, anon, authenticated;
revoke all on function public.plt_fn_card_pausar(bigint, bigint, text, uuid)        from public, anon;
revoke all on function public.plt_fn_card_retomar(bigint, uuid)                     from public, anon;
revoke all on function public.plt_fn_card_parar(bigint, bigint, bigint, text, uuid) from public, anon;
grant execute on function public.plt_fn_card_pausar(bigint, bigint, text, uuid)        to authenticated;
grant execute on function public.plt_fn_card_retomar(bigint, uuid)                     to authenticated;
grant execute on function public.plt_fn_card_parar(bigint, bigint, bigint, text, uuid) to authenticated;
