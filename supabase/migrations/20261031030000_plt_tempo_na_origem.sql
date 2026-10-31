-- ============================================================================
-- SESSAO-42 · F1 (31/10/2026) — O TEMPO CERTO NA ORIGEM (quadro e tablet).
--
-- (a) A PAUSA SOZINHA NO FIM DO EXPEDIENTE (regra 2 · resposta 4): no fim da
--     janela de cada setor (ou da hora extra autorizada), todo card rodando
--     ali é pausado com o motivo "Fim do expediente" — um FATO novo, sem
--     pessoa (origem automação), valendo no instante do fim da janela — e quem
--     estava nele sai do setor. De manhã, quem continua retoma (resposta 5).
-- (b) O AVISO DE CARD ESQUECIDO SEM RESPOSTA (regra 4 · resposta 6): a pergunta
--     "ainda tem alguém?" sem resposta em 15 min vale como "Não" — pausa no
--     instante do aviso, motivo "Sem resposta ao aviso".
--     As duas pelo DESPERTADOR ÚNICO do card esquecido (D-198): o pg_cron
--     marcado no minuto do próximo prazo — agora o menor entre o prazo de 2 h,
--     o fim da pergunta sem resposta e o CORTE dos cards rodando (plt_cards.
--     corte_em, projeção) —, remarcado no fato; sem card rodando, não existe.
-- (c) MONTAR EM LOTE (resposta 12): 2+ cards do MESMO modelo, na fila de um
--     setor que permite o lote (a Montagem), iniciados juntos por quem monta;
--     o limite de 1 por pessoa aceita o lote; o tempo é dividido (regra 6 — o
--     cálculo único já divide). Cada card sai sozinho pelo arrasto, ou o lote
--     inteiro de uma vez.
-- (d) O AVISO "MÓVEL PULOU A MONTAGEM" (regra 11 · resposta 9) entra no
--     catálogo de Configurações → Avisos (desligável por pessoa — D-202); quem
--     o grava é o cálculo único (só no gesto).
--
-- Recriadas da versão viva com trocas exatas: fn_validar_execucao (a pausa
-- automática sem pessoa; o lote no limite), fn_card_esquecido_marcar/armar/
-- disparar, fn_avisos_catalogo (+1 linha), plt_fn_regua_tempo (+ exceções,
-- horas extras e cortes — a régua do aparelho segue a mesma regra).
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · Os motivos de pausa da automação (comuns — não especiais)
-- ----------------------------------------------------------------------------
insert into public.plt_motivos (tipo, texto, ordem)
select 'pausa', x.texto, x.ordem
  from (values ('Fim do expediente', 90), ('Sem resposta ao aviso', 91)) as x(texto, ordem)
 where not exists (select 1 from public.plt_motivos m
                    where m.tipo = 'pausa' and lower(btrim(m.texto)) = lower(x.texto));

-- ----------------------------------------------------------------------------
-- 2 · O lote de um card (o do último iniciar válido) — o limite de 1 por
--     pessoa aceita os cards do mesmo lote
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tempo_lote_do_card(p_card_id bigint)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select nullif(e.dados ->> 'lote', '')
    from public.plt_eventos e
   where e.card_id = p_card_id and e.tipo = 'execucao_iniciada'
     and not exists (select 1 from public.plt_eventos x
                      where x.card_id = p_card_id and x.tipo = 'estorno' and x.evento_referencia_id = e.id)
   order by e.ocorrido_em desc, e.id desc
   limit 1;
$$;
revoke all on function plt_privado.fn_tempo_lote_do_card(bigint) from public, anon, authenticated;

create or replace function plt_privado.fn_tempo_mesmo_lote(p_card_id bigint, p_lote text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_lote is not null and plt_privado.fn_tempo_lote_do_card(p_card_id) is not distinct from p_lote;
$$;
revoke all on function plt_privado.fn_tempo_mesmo_lote(bigint, text) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3 · O corte do card rodando (projeção): até quando ele roda sem ser pausado
-- ----------------------------------------------------------------------------
alter table public.plt_cards add column if not exists corte_em timestamptz;
comment on column public.plt_cards.corte_em is
  'SESSAO-42 (regra 2): o instante em que o card que está rodando é pausado sozinho com "Fim do expediente" — o fim da última janela do dia em que começou a rodar (com a hora extra). Nulo = não roda, ou o setor não pausa sozinho. Mantida pelo gatilho plt_cards_esquecido (e remarcada quando o calendário muda).';
create index if not exists plt_cards_corte_idx on public.plt_cards (corte_em) where corte_em is not null;

-- ----------------------------------------------------------------------------
-- 4 · fn_validar_execucao — recriada da versão viva (20261018210000_plt_presenca_auxiliares.sql): a pausa
--     automática sem pessoa e o lote no limite de 1 por pessoa
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
  v_auxilia      boolean;
  v_referencia   bigint;
  v_eh_fila      boolean;
  v_producao     boolean;
  v_proxima      bigint;
  v_automatica   boolean;
begin
  if new.tipo not in ('execucao_iniciada', 'execucao_finalizada', 'estorno',
                      'execucao_pausada', 'execucao_retomada') then
    return new;
  end if;

  select * into v_card from public.plt_cards where id = new.card_id;
  if not found then
    raise exception 'Card % não existe.', new.card_id using errcode = 'foreign_key_violation';
  end if;

  -- SESSAO-42 (regras 2 e 4): a pausa do FIM DO EXPEDIENTE e a do aviso SEM
  -- RESPOSTA são da automação — sem pessoa no gesto.
  v_automatica := new.tipo = 'execucao_pausada' and new.origem = 'automacao'
                  and (coalesce((new.dados ->> 'fim_expediente')::boolean, false)
                       or coalesce((new.dados ->> 'sem_resposta')::boolean, false));
  if new.usuario_id is null and not v_automatica then
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
    -- SESSAO-36: quem auxilia o card sai do auxílio antes de assumi-lo.
    if exists (select 1 from public.plt_auxilios a
                where a.card_id = new.card_id and a.usuario_id = new.usuario_id and a.encerrado_em is null) then
      raise exception 'Esta pessoa já está no card como auxiliar — para assumir a execução, saia do auxílio antes.'
        using errcode = 'check_violation';
    end if;

    select s.limite_execucoes_por_pessoa into v_limite
      from public.plt_setores s where s.id = v_card.setor_atual_id;
    if v_limite is not null then
      -- SESSAO-36: o que a pessoa tem em andamento no setor = execuções + auxílios.
      select (select count(*) from public.plt_cards c
               where c.executor_atual_id = new.usuario_id
                 and c.setor_atual_id = v_card.setor_atual_id
                 and c.id <> new.card_id
                 -- D-48: execução pausada não ocupa o limite — é o que deixa a urgência entrar.
                 and c.pausado_em is null
                 -- SESSAO-42 (resposta 12): o card do MESMO lote não conta (montar juntos)
                 and not plt_privado.fn_tempo_mesmo_lote(c.id, nullif(new.dados ->> 'lote', '')))
           + (select count(*) from public.plt_auxilios a
                join public.plt_cards c2 on c2.id = a.card_id
               where a.usuario_id = new.usuario_id and a.encerrado_em is null and a.pausado_em is null
                 and c2.setor_atual_id = v_card.setor_atual_id)
        into v_em_execucao;
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
    -- (D-125 resp. 9): e o PRÓPRIO operador, no card que ele executa —
    -- ↩️ SESSAO-36 (D-146): e quem está no card como AUXILIAR.
    select u.papel into v_papel from public.plt_usuarios u
     where u.id = new.usuario_id and u.ativo;
    if v_papel is null and not v_automatica then
      raise exception 'Pausar exige um usuário ativo da plataforma.'
        using errcode = 'check_violation';
    end if;
    select coalesce(bool_or(us.lider_do_setor), false) into v_lider
      from public.plt_usuario_setores us
     where us.usuario_id = new.usuario_id
       and us.setor_id = v_card.setor_atual_id;
    select exists (select 1 from public.plt_auxilios a
                    where a.card_id = new.card_id and a.usuario_id = new.usuario_id
                      and a.encerrado_em is null) into v_auxilia;
    if not v_automatica and v_papel <> 'admin' and not v_lider and not v_auxilia
       and new.usuario_id is distinct from v_card.executor_atual_id then
      raise exception 'Pausar é gesto de quem executa o card, de quem o auxilia, do líder do setor ou de admin.'
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
      select (select count(*) from public.plt_cards c
               where c.executor_atual_id = v_card.executor_atual_id
                 and c.setor_atual_id = v_card.setor_atual_id
                 and c.id <> new.card_id
                 and c.pausado_em is null
                 -- SESSAO-42: de manhã, retomar o lote um card de cada vez
                 and not plt_privado.fn_tempo_mesmo_lote(c.id, plt_privado.fn_tempo_lote_do_card(new.card_id)))
           + (select count(*) from public.plt_auxilios a
                join public.plt_cards c2 on c2.id = a.card_id
               where a.usuario_id = v_card.executor_atual_id and a.encerrado_em is null and a.pausado_em is null
                 and c2.setor_atual_id = v_card.setor_atual_id)
        into v_em_execucao;
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
      raise exception 'Estornar é gesto de líder do setor ou de admin.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5 · A pessoa SAI DO SETOR num instante (o fim do expediente): o trecho de
--     presença fecha ali, o fato 'saida_automatica' leva o instante, e ela
--     deixa de estar em setor (nem "à deriva" — foi para casa)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_presenca_sair_em(p_usuario uuid, p_em timestamptz, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_atual public.plt_presenca_atual%rowtype;
  v_seg   public.plt_presenca_segmentos%rowtype;
  v_parte record;
begin
  select * into v_atual from public.plt_presenca_atual where usuario_id = p_usuario for update;
  if v_atual.usuario_id is null or v_atual.setor_id is null then
    return;
  end if;
  select * into v_seg from public.plt_presenca_segmentos where usuario_id = p_usuario and fim is null for update;
  if v_seg.id is not null then
    if v_seg.inicio < p_em then
      update public.plt_presenca_segmentos set fim = p_em where id = v_seg.id;
      for v_parte in
        select * from plt_privado.fn_presenca_partes(v_seg.estado, v_seg.especial, v_seg.carencia, v_seg.inicio, p_em)
      loop
        perform plt_privado.fn_tempos_dia_somar(p_usuario, v_parte.estado, v_seg.setor_id, v_parte.inicio, v_parte.fim);
      end loop;
    else
      delete from public.plt_presenca_segmentos where id = v_seg.id;
    end if;
  end if;
  insert into public.plt_presenca_eventos (usuario_id, tipo, setor_id, motivo, origem, ocorrido_em)
    values (p_usuario, 'saida_automatica', v_atual.setor_id, left(coalesce(p_motivo, ''), 200), 'automacao', p_em);
  delete from public.plt_presenca_atual where usuario_id = p_usuario;
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (p_usuario, 'setor_saida_automatica',
            jsonb_build_object('setor_id', v_atual.setor_id, 'em', p_em, 'motivo', p_motivo));
  perform plt_privado.fn_avisar('setor_' || v_atual.setor_id);
  perform plt_privado.fn_avisar('tempos');
end;
$$;
comment on function plt_privado.fn_presenca_sair_em(uuid, timestamptz, text) is
  'SESSAO-42 (regra 2): a pessoa sai do setor NUM INSTANTE (o fim do expediente) — fecha o trecho de presença ali (ou apaga o que nasceu depois), grava a saída automática com esse instante e tira a pessoa do setor (nem à deriva).';
revoke all on function plt_privado.fn_presenca_sair_em(uuid, timestamptz, text) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6 · A PAUSA AUTOMÁTICA de um card num instante (fim do expediente, ou o
--     aviso sem resposta): um fato novo, sem pessoa, origem automação
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_card_pausar_automatico(
  p_card_id bigint, p_em timestamptz, p_motivo text, p_marca text, p_dados jsonb default '{}'::jsonb,
  p_sair boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card public.plt_cards%rowtype;
  v_quem uuid[];
  v_u    uuid;
  v_mid  bigint;
begin
  select * into v_card from public.plt_cards where id = p_card_id for update;
  if v_card.id is null or v_card.executor_atual_id is null or v_card.pausado_em is not null
     or v_card.arquivado_em is not null or v_card.concluido_em is not null then
    return false; -- já não roda: nada a pausar
  end if;
  select array_agg(distinct q.x) into v_quem
    from (select v_card.executor_atual_id as x
          union all
          select a.usuario_id from public.plt_auxilios a
           where a.card_id = p_card_id and a.encerrado_em is null) q
   where q.x is not null;
  select m.id into v_mid from public.plt_motivos m
   where m.tipo = 'pausa' and lower(btrim(m.texto)) = lower(p_motivo) order by m.id limit 1;
  -- o trecho de presença de quem estava no card fecha no instante (D-198, A-121)
  perform set_config('plt.presenca_agora', p_em::text, true);
  perform set_config('plt.presenca_quem', array_to_string(coalesce(v_quem, '{}'::uuid[]), ','), true);
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados, ocorrido_em)
    values (p_card_id, 'execucao_pausada', null, 'automacao', p_motivo,
            jsonb_build_object('motivo', p_motivo, 'motivo_id', v_mid, p_marca, true) || coalesce(p_dados, '{}'::jsonb),
            p_em);
  perform set_config('plt.presenca_agora', '', true);
  perform set_config('plt.presenca_quem', '', true);
  foreach v_u in array coalesce(v_quem, '{}'::uuid[]) loop
    if p_sair then
      perform plt_privado.fn_presenca_sair_em(v_u, p_em, p_motivo);
    else
      perform plt_privado.fn_presenca_expirar(v_u, now());
    end if;
  end loop;
  return true;
end;
$$;
comment on function plt_privado.fn_card_pausar_automatico(bigint, timestamptz, text, text, jsonb, boolean) is
  'SESSAO-42 (regras 2 e 4): pausa o card que está rodando NUM INSTANTE (o fim do expediente, ou o aviso de card esquecido sem resposta) — fato novo sem pessoa (origem automação) com o motivo da lista; a presença de quem estava nele fecha ali; no fim do expediente, a pessoa sai do setor.';
revoke all on function plt_privado.fn_card_pausar_automatico(bigint, timestamptz, text, text, jsonb, boolean) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 7 · O despertador único — o prazo do card esquecido, a pergunta sem
--     resposta e o fim do expediente dos cards rodando
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_card_esquecido_marcar()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_min     integer;
  v_rodando boolean;
begin
  -- o gatilho só dispara quando quem executa, a pausa, o setor, o arquivo ou a
  -- conclusão mudaram: rodando agora = começou a rodar agora (iniciar, retomar,
  -- outro executor) → o prazo conta de novo e o corte é o fim do expediente de
  -- hoje; parado = sem prazo, sem pergunta e sem corte
  v_rodando := new.executor_atual_id is not null and new.pausado_em is null
               and new.arquivado_em is null and new.concluido_em is null and new.setor_atual_id is not null;
  if v_rodando then
    select s.aviso_esquecido_min into v_min from public.plt_setores s where s.id = new.setor_atual_id;
  end if;
  if v_min is null then
    new.esquecido_vence_em := null;
    new.esquecido_aviso_em := null;
  else
    new.esquecido_vence_em := now() + make_interval(mins => v_min);
    new.esquecido_aviso_em := null;
  end if;
  -- SESSAO-42 (regra 2): o card rodando é pausado sozinho no fim do expediente
  new.corte_em := case when v_rodando
                       then plt_privado.fn_tempo_corte(new.setor_atual_id, now(), new.executor_atual_id) end;
  return new;
end;
$$;

drop trigger if exists plt_cards_zz_esquecido on public.plt_cards;
create trigger plt_cards_zz_esquecido
  after update on public.plt_cards
  for each row
  when (old.esquecido_vence_em is distinct from new.esquecido_vence_em
        or old.esquecido_aviso_em is distinct from new.esquecido_aviso_em
        or old.corte_em is distinct from new.corte_em)
  execute function plt_privado.fn_card_esquecido_depois();

-- o próximo instante em que o despertador tem trabalho (ou nulo)
create or replace function plt_privado.fn_card_esquecido_proximo()
returns timestamptz
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select least(
    (select min(c.esquecido_vence_em) from public.plt_cards c
      where c.esquecido_vence_em is not null and c.esquecido_aviso_em is null),
    (select min(c.esquecido_aviso_em + make_interval(mins => (plt_privado.fn_tempo_regra(c.setor_atual_id)).sem_resposta_min))
       from public.plt_cards c where c.esquecido_aviso_em is not null),
    (select min(c.corte_em) from public.plt_cards c where c.corte_em is not null));
$$;
revoke all on function plt_privado.fn_card_esquecido_proximo() from public, anon, authenticated;

create or replace function plt_privado.fn_card_esquecido_armar()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prox  timestamptz;
  v_alvo  timestamp;
  v_cron  text;
  v_job   bigint;
  v_sched text;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    return;
  end if;
  -- um de cada vez: dois gestos ao mesmo tempo não deixam o despertador para
  -- depois do card mais antigo (o segundo espera o primeiro e lê o que ele gravou)
  perform pg_advisory_xact_lock(hashtext('plt-card-esquecido'));
  v_prox := plt_privado.fn_card_esquecido_proximo();
  select j.jobid, j.schedule into v_job, v_sched from cron.job j where j.jobname = 'plt-card-esquecido';
  if v_prox is null then
    if v_job is not null then
      perform cron.unschedule(v_job);
    end if;
    return;
  end if;
  -- o minuto (UTC — o relógio do pg_cron) do próximo trabalho, arredondado
  -- para cima; nunca um minuto que já começou
  v_alvo := date_trunc('minute', (greatest(v_prox, now()) at time zone 'UTC') + interval '59.999999 seconds');
  if v_alvo <= (now() at time zone 'UTC') then
    v_alvo := date_trunc('minute', now() at time zone 'UTC') + interval '1 minute';
  end if;
  v_cron := format('%s %s %s %s *', extract(minute from v_alvo)::int, extract(hour from v_alvo)::int,
                   extract(day from v_alvo)::int, extract(month from v_alvo)::int);
  if v_sched is distinct from v_cron then
    perform cron.schedule('plt-card-esquecido', v_cron, 'select plt_privado.fn_card_esquecido_disparar()');
  end if;
end;
$$;
comment on function plt_privado.fn_card_esquecido_armar() is
  'SESSAO-41 (D-198) ↪️ SESSAO-42: marca (ou tira) o ÚNICO agendamento plt-card-esquecido no minuto do próximo trabalho — o prazo do card esquecido, a pergunta sem resposta (regra 4) ou o fim do expediente de um card rodando (regra 2). Sem nada disso, não existe agendamento (Lei §4). Chamado no fato e no fim de cada disparo.';

create or replace function plt_privado.fn_card_esquecido_disparar(p_agora timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card   record;
  v_pessoa uuid;
  v_n      integer := 0;
  v_corpo  text;
begin
  perform pg_advisory_xact_lock(hashtext('plt-card-esquecido'));
  -- os gestos deste disparo não remarcam um a um: remarca uma vez, no fim
  perform set_config('plt.esquecido_disparando', 'on', true);

  -- (1) SESSAO-42 (regra 2): o FIM DO EXPEDIENTE — pausa no instante do corte
  --     e quem estava no card sai do setor
  for v_card in
    select c.id, c.corte_em from public.plt_cards c
     where c.corte_em is not null and c.corte_em <= p_agora
     order by c.corte_em, c.id
     for update of c skip locked
  loop
    if plt_privado.fn_card_pausar_automatico(v_card.id, v_card.corte_em, 'Fim do expediente', 'fim_expediente',
                                             '{}'::jsonb, true) then
      v_n := v_n + 1;
    end if;
  end loop;

  -- (2) SESSAO-42 (regra 4): a pergunta "ainda tem alguém?" SEM RESPOSTA no
  --     prazo do setor vale como "Não" — pausa no instante do aviso
  for v_card in
    select c.id, c.esquecido_aviso_em from public.plt_cards c
     where c.esquecido_aviso_em is not null
       and c.esquecido_aviso_em + make_interval(mins => (plt_privado.fn_tempo_regra(c.setor_atual_id)).sem_resposta_min) <= p_agora
     order by c.esquecido_aviso_em, c.id
     for update of c skip locked
  loop
    if plt_privado.fn_card_pausar_automatico(v_card.id, v_card.esquecido_aviso_em, 'Sem resposta ao aviso', 'sem_resposta',
         jsonb_build_object('card_esquecido', true, 'avisado_em', v_card.esquecido_aviso_em), false) then
      v_n := v_n + 1;
    end if;
  end loop;

  -- (3) D-198: o prazo de 2 h venceu — abre a pergunta no instante do prazo
  for v_card in
    select c.id, c.setor_atual_id, c.executor_atual_id, c.esquecido_vence_em,
           s.nome as setor, s.aviso_esquecido_min as minutos,
           coalesce(nullif(btrim(c.titulo), ''), nullif(btrim(c.item_descricao), ''), 'Card ' || c.id) as nome,
           p.numero as pedido, u.nome as executor
      from public.plt_cards c
      join public.plt_setores s on s.id = c.setor_atual_id
      left join public.pedidos p on p.id = c.pedido_id
      left join public.plt_usuarios u on u.id = c.executor_atual_id
     where c.esquecido_vence_em is not null and c.esquecido_aviso_em is null
       and c.esquecido_vence_em <= p_agora
     order by c.esquecido_vence_em, c.id
     for update of c skip locked
  loop
    update public.plt_cards set esquecido_aviso_em = v_card.esquecido_vence_em where id = v_card.id;
    v_corpo := v_card.nome || coalesce(' · pedido ' || v_card.pedido, '')
               || ' está rodando há '
               || case when coalesce(v_card.minutos, 120) % 60 = 0
                       then (coalesce(v_card.minutos, 120) / 60)::text || ' h'
                       else coalesce(v_card.minutos, 120)::text || ' min' end
               || ' sem parar na ' || v_card.setor
               || coalesce(', com ' || v_card.executor, '')
               || '. Se ninguém está nele, toque em "Não, pausar o card" — o tempo depois do aviso não conta como trabalho.'
               || ' Sem resposta em ' || (plt_privado.fn_tempo_regra(v_card.setor_atual_id)).sem_resposta_min
               || ' min, o card é pausado sozinho.';
    for v_pessoa in
      select v_card.executor_atual_id where v_card.executor_atual_id is not null
      union
      select a.usuario_id from public.plt_auxilios a
       where a.card_id = v_card.id and a.encerrado_em is null
      union
      select u.id from public.plt_usuarios u
       where u.papel = 'admin' and u.ativo and u.arquivado_em is null and not u.conta_tablet
    loop
      insert into public.plt_notificacoes (destinatario_id, card_id, tipo, titulo, corpo)
        values (v_pessoa, v_card.id, 'card_esquecido', 'Urgente: ainda tem alguém neste card?', v_corpo);
    end loop;
    v_n := v_n + 1;
  end loop;

  perform set_config('plt.esquecido_disparando', '', true);
  perform plt_privado.fn_card_esquecido_armar();
  return v_n;
end;
$$;
comment on function plt_privado.fn_card_esquecido_disparar(timestamptz) is
  'SESSAO-41 (D-198) ↪️ SESSAO-42: o despertador acordou — (1) pausa com "Fim do expediente" cada card rodando cujo corte passou (no instante do corte; quem estava nele sai do setor); (2) pausa com "Sem resposta ao aviso" cada pergunta sem resposta no prazo do setor (no instante do aviso); (3) abre a pergunta dos cards cujo prazo de 2 h passou. Depois remarca o próximo. Idempotente.';

-- ----------------------------------------------------------------------------
-- 8 · O calendário mudou: além de refazer o período, o corte dos cards que
--     estão rodando no setor muda (a hora extra empurra a pausa para o fim dela)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tempo_calendario_mudou(
  p_setor_id bigint, p_de timestamptz, p_ate timestamptz, p_motivo text
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
begin
  v_id := plt_privado.fn_tempo_pedir_recalculo(p_de, p_ate, p_setor_id, 'tudo', p_motivo);
  update public.plt_cards c
     -- nunca para trás: o corte que já passou vira o próximo fim de expediente
     -- (no passado a regra é só conta — nenhum fato retroativo)
     set corte_em = greatest(now(), plt_privado.fn_tempo_corte(c.setor_atual_id,
                      coalesce((select max(t.inicio) from public.plt_tempo_trechos t
                                 where t.card_id = c.id and t.fim is null and t.papel = 'execucao'), now()),
                      c.executor_atual_id))
   where c.executor_atual_id is not null and c.pausado_em is null and c.arquivado_em is null
     and c.concluido_em is null and (p_setor_id is null or c.setor_atual_id = p_setor_id);
  perform plt_privado.fn_card_esquecido_armar();
  return v_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 9 · MONTAR EM LOTE (resposta 12): "Montar juntos" e "Concluir o lote"
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_montar_juntos(p_card_ids bigint[], p_operador_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ids    bigint[];
  v_setor  bigint;
  v_quem   uuid;
  v_lote   text := gen_random_uuid()::text;
  v_c      record;
  v_mod    bigint;
  v_modelo bigint;
  v_n      integer := 0;
  v_id     bigint;
begin
  select array_agg(distinct x order by x) into v_ids from unnest(coalesce(p_card_ids, '{}')) x;
  if coalesce(cardinality(v_ids), 0) < 2 or cardinality(v_ids) > 20 then
    raise exception 'Escolha de 2 a 20 cards para montar juntos.' using errcode = 'invalid_parameter_value';
  end if;
  select min(c.setor_atual_id), count(distinct c.setor_atual_id) into v_setor, v_n
    from public.plt_cards c where c.id = any (v_ids);
  if v_n <> 1 then
    raise exception 'Os cards do lote estão em setores diferentes.' using errcode = 'check_violation';
  end if;
  if not (plt_privado.fn_tempo_regra(v_setor)).permite_lote then
    raise exception 'Este setor não monta em lote.' using errcode = 'check_violation';
  end if;
  v_quem := plt_privado.fn_autor_do_gesto(v_setor, p_operador_id);
  if v_quem is null then
    raise exception 'Diga quem vai montar.' using errcode = 'insufficient_privilege';
  end if;
  v_n := 0;
  for v_c in
    select c.id, c.executor_atual_id, c.arquivado_em, c.concluido_em, e.eh_fila,
           coalesce(nullif(btrim(c.item_descricao), ''), nullif(btrim(c.titulo), '')) as nome
      from public.plt_cards c
      left join public.plt_etapas e on e.id = c.etapa_atual_id
     where c.id = any (v_ids)
     order by c.id
     for update of c
  loop
    if v_c.arquivado_em is not null or v_c.concluido_em is not null or not coalesce(v_c.eh_fila, false)
       or v_c.executor_atual_id is not null then
      raise exception 'Só entra no lote card que está na fila do setor, sem ninguém nele.' using errcode = 'check_violation';
    end if;
    v_mod := (plt_privado.fn_tempo_modelo_do_nome(v_c.nome)).o_modelo_id;
    if v_mod is null or (v_modelo is not null and v_mod <> v_modelo) then
      raise exception 'Montar junto é só para móveis do mesmo modelo (a cor pode mudar).' using errcode = 'check_violation';
    end if;
    v_modelo := v_mod;
  end loop;
  -- inicia todos: o iniciar na fila avança para a etapa de início (D-48 ↪️);
  -- o limite de 1 por pessoa aceita os cards do mesmo lote
  foreach v_id in array v_ids loop
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, dados)
      values (v_id, 'execucao_iniciada', v_quem, 'interface',
              jsonb_build_object('lote', v_lote, 'lote_n', cardinality(v_ids)));
  end loop;
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (plt_privado.fn_usuario_atual(), 'montar_juntos',
            jsonb_build_object('lote', v_lote, 'cards', v_ids, 'quem', v_quem, 'setor_id', v_setor));
  return jsonb_build_object('lote', v_lote, 'cards', v_ids, 'quem', v_quem);
end;
$$;
comment on function public.plt_fn_montar_juntos(bigint[], uuid) is
  'SESSAO-42 (F1 · resposta 12): "Montar juntos" — inicia de uma vez 2 a 20 cards do MESMO modelo que estão na fila de um setor que monta em lote (a Montagem), por quem monta (no tablet, o PIN). Os inícios levam o mesmo lote: o limite de 1 por pessoa aceita, e o cálculo único divide o tempo entre eles.';

create or replace function public.plt_fn_lote_soltar(
  p_card_id bigint, p_etapa_destino_id bigint, p_estado_qualidade text default null,
  p_observacao text default null, p_operador_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lote  text := plt_privado.fn_tempo_lote_do_card(p_card_id);
  v_setor bigint;
  v_c     bigint;
  v_n     integer := 0;
begin
  if v_lote is null then
    raise exception 'Este card não está num lote.' using errcode = 'check_violation';
  end if;
  select c.setor_atual_id into v_setor from public.plt_cards c where c.id = p_card_id;
  for v_c in
    select c.id from public.plt_cards c
     where c.setor_atual_id = v_setor and c.executor_atual_id is not null
       and c.arquivado_em is null and c.concluido_em is null
       and plt_privado.fn_tempo_lote_do_card(c.id) = v_lote
     order by (c.id = p_card_id) desc, c.id
  loop
    perform public.plt_fn_soltar_card(v_c, p_etapa_destino_id, p_estado_qualidade, p_observacao, p_operador_id);
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('lote', v_lote, 'cards', v_n);
end;
$$;
comment on function public.plt_fn_lote_soltar(bigint, bigint, text, text, uuid) is
  'SESSAO-42 (F1): "Concluir o lote" — leva para a mesma etapa (com a mesma marcação de estado) todos os cards do lote do card que ainda estão rodando no setor, pelo mesmo arrasto de sempre.';

revoke all on function public.plt_fn_montar_juntos(bigint[], uuid) from public, anon;
grant execute on function public.plt_fn_montar_juntos(bigint[], uuid) to authenticated;
revoke all on function public.plt_fn_lote_soltar(bigint, bigint, text, text, uuid) from public, anon;
grant execute on function public.plt_fn_lote_soltar(bigint, bigint, text, text, uuid) to authenticated;

-- os cards que JÁ rodam na aplicação ganham o corte a partir de AGORA (o
-- próximo fim de expediente): o que passou já é cortado na conta — nunca se
-- grava pausa retroativa (demanda: "no passado a regra 2 é só conta")
update public.plt_cards c
   set corte_em = plt_privado.fn_tempo_corte(c.setor_atual_id, now(), c.executor_atual_id)
 where c.executor_atual_id is not null and c.pausado_em is null and c.arquivado_em is null
   and c.concluido_em is null and c.corte_em is null;

-- ----------------------------------------------------------------------------
-- 10 · O catálogo de avisos — recriado da versão viva (20261028030000_plt_avisos_configuraveis.sql) + o aviso
--      "Móvel pulou a montagem" (desligável por pessoa em Configurações → Avisos)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_avisos_catalogo()
returns table (
  tipo        text,
  grupo       text,
  grupo_nome  text,
  ordem       integer,
  nome        text,
  descricao   text,
  publico     text,
  obrigatorio boolean,
  erro        boolean
)
language sql
immutable
set search_path = public, pg_temp
as $$
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
$$;

-- ----------------------------------------------------------------------------
-- 11 · A régua do aparelho (D-172) ganha o calendário: as exceções (feriado,
--      dia trabalhado, dia parado), as horas extras e quais setores pausam
--      sozinhos no fim do expediente — o relógio vivo do card segue a MESMA
--      regra do banco (o que já fechou vem pronto das projeções)
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
    -- o PCP (o relógio do pedido) e o papel de cada setor (a linha do tempo
    -- não fala em fila onde ninguém "inicia": a entrada e os fins de linha)
    'pcp_setor_id', (select s.id from public.plt_setores s where s.codigo = 'pcp' limit 1),
    'papeis', coalesce((select jsonb_object_agg(s.id::text, s.papel_no_fluxo) from public.plt_setores s), '{}'::jsonb),
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
               limit 500) x), '[]'::jsonb),
    -- SESSAO-42: [setor (nulo = a fábrica), "AAAA-MM-DD", tipo, [[ini, fim], …]]
    'excecoes', coalesce((
      select jsonb_agg(jsonb_build_array(e.setor_id, e.dia, e.tipo, e.faixas) order by e.dia, e.setor_id nulls first)
        from public.plt_tempo_excecoes e
       where e.arquivado_em is null
         and e.dia between (now() at time zone 'America/Fortaleza')::date - 120
                       and (now() at time zone 'America/Fortaleza')::date + 60), '[]'::jsonb),
    -- SESSAO-42: [setor, pessoa (nula = o setor inteiro), início, fim]
    'extras', coalesce((
      select jsonb_agg(jsonb_build_array(x.setor_id, x.usuario_id, x.inicio, x.fim) order by x.inicio)
        from (select h.setor_id, h.usuario_id, h.inicio, h.fim
                from public.plt_tempo_horas_extras h
               where h.cancelada_em is null and h.fim > now() - interval '120 days'
               order by h.inicio desc
               limit 500) x), '[]'::jsonb),
    -- SESSAO-42: os setores que pausam sozinhos no fim do expediente
    'cortes', coalesce((
      select jsonb_object_agg(s.id::text, (plt_privado.fn_tempo_regra(s.id)).pausar_fim_expediente)
        from public.plt_setores s where s.papel_no_fluxo = 'producao'), '{}'::jsonb),
    -- SESSAO-42: os setores que montam em lote ("Montar juntos")
    'lotes', coalesce((
      select jsonb_object_agg(s.id::text, (plt_privado.fn_tempo_regra(s.id)).permite_lote)
        from public.plt_setores s where s.papel_no_fluxo = 'producao'), '{}'::jsonb)) end;
$$;
comment on function public.plt_fn_regua_tempo() is
  'SESSAO-38 (D-172) ↪️ SESSAO-42: a régua do tempo útil para o aparelho, na abertura do app — fuso, PCP, papel de cada setor, as faixas da semana, as pausas de setor (120 dias), as exceções do calendário (120 dias para trás, 60 para a frente), as horas extras (120 dias), quais setores pausam sozinhos no fim do expediente e quais montam em lote.';
