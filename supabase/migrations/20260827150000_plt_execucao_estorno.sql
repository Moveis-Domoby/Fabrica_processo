-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 14 — EXECUÇÃO, ESTORNO E LIMITE
-- Sessão: SESSAO-05 · Data: 2026-08-27
--
-- A razão de existir da plataforma (D-02/D-24): o tempo é medido como
-- subproduto dos cliques. Chegou na etapa → fila (do SETOR, sem dono).
-- Iniciar → fecha a fila, abre a execução (de quem clicou). Finalizar →
-- fecha a execução. Mover com execução aberta → encerra sozinho (D-24).
--
-- As REGRAS vivem em TRIGGER, não em RLS nem no front: a service_role (n8n)
-- ignora RLS (M-14), e regra que precisa valer para todo mundo mora no banco.
--
-- O que entra aqui:
--   1. limite de execuções por pessoa por setor (D-24) — coluna em plt_setores
--   2. tipo de evento `estorno` (correção visível, nunca edição — RNF-05)
--   3. validações de execução/estorno por trigger
--   4. projeção: transferência troca o executor; estorno recomputa
--   5. plt_vw_execucoes reescrita: fecha em finalizada, transferência OU
--      movimentação; ignora estornados; setor/etapa da ÉPOCA da execução
--   6. RPCs: plt_fn_linha_tempo_card (leitura) e plt_fn_estornar_evento
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · Limite de execuções simultâneas por pessoa, por setor (D-24)
-- NULL = sem limite (o padrão de nascença). O admin configura em /estrutura.
-- ----------------------------------------------------------------------------
alter table public.plt_setores
  add column if not exists limite_execucoes_por_pessoa integer
  check (limite_execucoes_por_pessoa is null or limite_execucoes_por_pessoa > 0);

comment on column public.plt_setores.limite_execucoes_por_pessoa is
  'D-24: quantos cards a MESMA pessoa pode ter em execução neste setor ao mesmo tempo. NULL = sem limite (padrão).';

-- ----------------------------------------------------------------------------
-- 2 · O tipo `estorno` entra no vocabulário de eventos
--
-- Estorno NÃO apaga nada (RNF-05): é um evento novo que aponta o evento
-- anulado pelo `evento_referencia_id` (o mesmo mecanismo do parecer de
-- qualidade). O anulado continua na linha do tempo, riscado.
-- ----------------------------------------------------------------------------
do $$
declare
  v_nome text;
begin
  -- O CHECK de tipo é o único constraint que menciona 'card_criado'.
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
      'qualidade_marcada',
      'qualidade_parecer',
      'divergencia_registrada',
      'notificacao_enviada',
      'delegacao',
      'estorno'
    ));
end;
$$;

-- ----------------------------------------------------------------------------
-- 3 · Helpers de estorno (schema privado — maquinaria, não endpoint; E-11)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_evento_estornado(p_evento_id bigint)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.plt_eventos x
     where x.tipo = 'estorno' and x.evento_referencia_id = p_evento_id
  );
$$;

comment on function plt_privado.fn_evento_estornado(bigint) is
  'true quando já existe um evento de estorno apontando para este evento.';

-- Quem é o executor do card segundo o LOG (ignorando estornados)?
-- Usado para reprojetar o executor depois de um estorno (M-13: o estado
-- guardado é projeção; o evento é a verdade).
create or replace function plt_privado.fn_executor_pelo_log(p_card_id bigint)
returns uuid
language sql
stable
set search_path = public, pg_temp
as $$
  with ultima_chegada as (
    select p.ocorrido_em, p.id
      from public.plt_eventos p
     where p.card_id = p_card_id
       and p.tipo in ('card_criado', 'movimentacao_setor', 'movimentacao_etapa')
     order by p.ocorrido_em desc, p.id desc
     limit 1
  )
  select i.usuario_id
    from public.plt_eventos i
    cross join ultima_chegada uc
   where i.card_id = p_card_id
     and i.tipo = 'execucao_iniciada'
     and (i.ocorrido_em, i.id) > (uc.ocorrido_em, uc.id)
     and not plt_privado.fn_evento_estornado(i.id)
     and not exists (
       -- uma finalização válida DEPOIS deste início encerra a execução
       select 1 from public.plt_eventos f
        where f.card_id = p_card_id
          and f.tipo = 'execucao_finalizada'
          and (f.ocorrido_em, f.id) > (i.ocorrido_em, i.id)
          and not plt_privado.fn_evento_estornado(f.id)
     )
   order by i.ocorrido_em desc, i.id desc
   limit 1;
$$;

comment on function plt_privado.fn_executor_pelo_log(bigint) is
  'Executor atual derivado só dos eventos válidos da permanência atual — a fonte para reprojetar depois de estorno.';

-- ----------------------------------------------------------------------------
-- 4 · Validação dos eventos de execução e estorno (BEFORE INSERT)
--
-- D-24, e vale para TODO escritor (interface, API, automação):
--   · execução é gesto de PESSOA — usuario_id obrigatório (D-02: o tempo de
--     execução pertence a quem iniciou/finalizou);
--   · iniciar: card precisa estar num setor e não concluído (D-13: fim de
--     linha não executa); a mesma pessoa não inicia o mesmo card duas vezes;
--     iniciar por OUTRA pessoa é transferência (fecha para um, abre para o
--     outro — a projeção e a view cuidam disso);
--   · limite por setor (D-24): pessoa no teto não pega mais um;
--   · finalizar: só com execução aberta (iniciar é obrigatório — D-24);
--   · estorno: só do ÚLTIMO gesto de execução válido do card (correção se faz
--     do mais novo para o mais velho), por líder do setor do card ou admin.
--
-- O trigger também PREENCHE setor/etapa de origem quando vierem vazios, para
-- a linha do tempo saber ONDE a execução aconteceu mesmo em eventos da API.
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
begin
  if new.tipo not in ('execucao_iniciada', 'execucao_finalizada', 'estorno') then
    return new;
  end if;

  select * into v_card from public.plt_cards where id = new.card_id;
  if not found then
    raise exception 'Card % não existe.', new.card_id using errcode = 'foreign_key_violation';
  end if;

  if new.usuario_id is null then
    raise exception 'Iniciar, finalizar e estornar são gestos de pessoa: usuario_id é obrigatório (D-02/D-24).'
      using errcode = 'check_violation';
  end if;

  -- Onde o gesto aconteceu: o setor/etapa ATUAL do card, se quem inseriu não disse.
  if new.tipo in ('execucao_iniciada', 'execucao_finalizada') then
    new.setor_origem_id := coalesce(new.setor_origem_id, v_card.setor_atual_id);
    new.etapa_origem_id := coalesce(new.etapa_origem_id, v_card.etapa_atual_id);
  end if;

  if new.tipo = 'execucao_iniciada' then
    if v_card.setor_atual_id is null then
      raise exception 'Este card ainda não está em nenhum setor — não há o que iniciar.'
        using errcode = 'check_violation';
    end if;
    if v_card.concluido_em is not null then
      raise exception 'Card concluído (fim de linha — D-13) não entra em execução.'
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
         and c.id <> new.card_id;
      if v_em_execucao >= v_limite then
        raise exception 'Limite do setor atingido (D-24): esta pessoa já tem % card(s) em execução aqui (máximo %).',
          v_em_execucao, v_limite
          using errcode = 'check_violation';
      end if;
    end if;

  elsif new.tipo = 'execucao_finalizada' then
    if v_card.executor_atual_id is null then
      raise exception 'Iniciar é obrigatório antes de finalizar (D-24) — este card não está em execução.'
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
      raise exception 'Só gestos de execução (iniciar/finalizar) podem ser estornados. Movimentação errada se corrige movendo de novo.'
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
      raise exception 'Estorno é gesto de líder do setor ou de admin (SESSAO-05/D-24).'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

comment on function plt_privado.fn_validar_execucao() is
  'Regras da D-24 valendo para todo escritor (a service_role ignora RLS — M-14): iniciar obrigatório, limite por setor, estorno só líder/admin e só do último gesto.';

drop trigger if exists plt_eventos_validar_execucao on public.plt_eventos;
create trigger plt_eventos_validar_execucao
  before insert on public.plt_eventos
  for each row execute function plt_privado.fn_validar_execucao();

-- ----------------------------------------------------------------------------
-- 5 · Projeção: transferência e estorno
--
-- fn_projetar_posicao (migration 04) já zera o executor na movimentação e na
-- finalização, e grava quem iniciou. O que muda:
--   · execucao_iniciada por OUTRA pessoa = transferência (D-24) — o UPDATE de
--     executor que já existia resolve; nada a mudar.
--   · estorno → o executor volta a ser o que o LOG válido diz (M-13).
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_projetar_posicao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_terminal boolean;
begin
  if new.tipo in ('card_criado', 'movimentacao_setor', 'movimentacao_etapa') then
    select s.papel_no_fluxo = 'terminal'
      into v_terminal
      from public.plt_setores s
     where s.id = new.setor_destino_id;

    update public.plt_cards
       set setor_atual_id = coalesce(new.setor_destino_id, setor_atual_id),
           etapa_atual_id = new.etapa_destino_id,
           desde          = new.ocorrido_em,
           -- Mudou de lugar: execução aberta encerra sozinha (D-24).
           executor_atual_id = null,
           concluido_em   = case when coalesce(v_terminal, false)
                                 then new.ocorrido_em else concluido_em end
     where id = new.card_id;

  elsif new.tipo = 'execucao_iniciada' then
    -- Iniciar num card já em execução por OUTRA pessoa = transferência (D-24):
    -- fecha para um, abre para o outro — a view corta o tempo neste instante.
    update public.plt_cards
       set executor_atual_id = new.usuario_id
     where id = new.card_id;

  elsif new.tipo = 'execucao_finalizada' then
    update public.plt_cards
       set executor_atual_id = null
     where id = new.card_id;

  elsif new.tipo = 'estorno' then
    -- O estado guardado é projeção; o evento é a verdade (M-13): depois de um
    -- estorno, o executor volta a ser o que o log válido disser.
    update public.plt_cards
       set executor_atual_id = plt_privado.fn_executor_pelo_log(new.card_id)
     where id = new.card_id;

  elsif new.tipo in ('qualidade_marcada', 'qualidade_parecer') then
    update public.plt_cards
       set qualidade_atual = new.estado_qualidade
     where id = new.card_id;
  end if;

  return null;
end;
$$;

comment on function plt_privado.fn_projetar_posicao() is
  'Único lugar que escreve a posição do card. Reage a evento inserido; nunca o contrário.';

-- ----------------------------------------------------------------------------
-- 6 · plt_vw_execucoes, agora com a D-24 inteira
--
-- Uma execução começa no `execucao_iniciada` válido e termina no PRÓXIMO marco
-- válido do card, seja ele qual for:
--   execucao_finalizada  → encerramento 'finalizada' (com quem finalizou)
--   execucao_iniciada    → 'transferencia' (outra pessoa assumiu — D-24)
--   movimentação         → 'movimentacao' (mover encerra sozinho — D-24)
--   nada ainda           → em andamento, conta até agora
--
-- Eventos estornados não existem para esta view. O setor/etapa é o DA ÉPOCA
-- (setor_origem_id preenchido pelo trigger de validação), com fallback no
-- último evento de posição — nunca a posição atual do card, que já pode ser outra.
-- ----------------------------------------------------------------------------
-- A forma da view muda (colunas novas) — `create or replace` não faz isso.
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
  coalesce(m.proximo_em, now()) - m.ocorrido_em as duracao
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
where m.tipo = 'execucao_iniciada';

comment on view public.plt_vw_execucoes is
  'Tempo de execução, o tempo que tem dono (D-02/D-24). Fecha em finalizada, transferência ou movimentação; ignora estornados; setor/etapa da época.';

alter view public.plt_vw_execucoes set (security_invoker = on);

-- ----------------------------------------------------------------------------
-- 7 · Linha do tempo do card — a porta de leitura (endpoint de propósito, E-11)
--
-- O RLS por setor deixaria o operador ver só o pedaço do histórico que passou
-- pelos setores dele. A linha do tempo é do CARD inteiro: quem pode ver o card
-- hoje (mesma regra do RLS de plt_cards) vê a história completa dele.
-- Nomes em vez de ids; zero dado do cliente além do que o card já mostra.
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_linha_tempo_card(p_card_id bigint)
returns table (
  evento_id            bigint,
  tipo                 text,
  ocorrido_em          timestamptz,
  usuario_id           uuid,
  usuario_nome         text,
  setor_origem_id      bigint,
  setor_origem_nome    text,
  etapa_origem_nome    text,
  setor_destino_id     bigint,
  setor_destino_nome   text,
  etapa_destino_nome   text,
  etapa_destino_eh_fila boolean,
  estado_qualidade     text,
  observacao           text,
  origem               text,
  evento_referencia_id bigint,
  estornado            boolean,
  dados                jsonb
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select e.id                as evento_id,
         e.tipo,
         e.ocorrido_em,
         e.usuario_id,
         u.nome              as usuario_nome,
         e.setor_origem_id,
         so.nome             as setor_origem_nome,
         eo.nome             as etapa_origem_nome,
         e.setor_destino_id,
         sd.nome             as setor_destino_nome,
         ed.nome             as etapa_destino_nome,
         coalesce(ed.eh_fila, false) as etapa_destino_eh_fila,
         e.estado_qualidade,
         e.observacao,
         e.origem,
         e.evento_referencia_id,
         plt_privado.fn_evento_estornado(e.id) as estornado,
         e.dados
    from public.plt_eventos e
    left join public.plt_usuarios u  on u.id  = e.usuario_id
    left join public.plt_setores  so on so.id = e.setor_origem_id
    left join public.plt_etapas   eo on eo.id = e.etapa_origem_id
    left join public.plt_setores  sd on sd.id = e.setor_destino_id
    left join public.plt_etapas   ed on ed.id = e.etapa_destino_id
   where e.card_id = p_card_id
     and exists (
       select 1 from public.plt_cards c
        where c.id = p_card_id
          and (
            plt_privado.fn_eh_admin()
            or c.setor_atual_id in (select plt_privado.fn_setores_do_usuario())
            or c.executor_atual_id = plt_privado.fn_usuario_atual()
            or plt_privado.fn_pode_ver_expedicao()
          )
     )
   order by e.ocorrido_em, e.id;
$$;

comment on function public.plt_fn_linha_tempo_card(bigint) is
  'Linha do tempo completa de um card (SESSAO-05). Endpoint REST de propósito — gate: quem pode ver o card (ou a expedição) vê a história inteira dele.';

-- ----------------------------------------------------------------------------
-- 8 · Estornar — o gesto do líder/admin (endpoint de propósito, E-11)
--
-- RPC em vez de INSERT direto porque o RLS de INSERT em eventos exige vínculo
-- com o setor — e o admin estorna em setor onde não trabalha. O gate de
-- verdade (líder do setor do card ou admin, só o último gesto) vive no
-- trigger de validação e vale para qualquer caminho de escrita.
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_estornar_evento(
  p_evento_id  bigint,
  p_observacao text default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
  v_card_id bigint;
  v_novo_id bigint;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null then
    raise exception 'Só usuário ativo da plataforma estorna.' using errcode = 'insufficient_privilege';
  end if;

  select e.card_id into v_card_id from public.plt_eventos e where e.id = p_evento_id;
  if v_card_id is null then
    raise exception 'Evento % não existe.', p_evento_id using errcode = 'no_data_found';
  end if;

  insert into public.plt_eventos
      (card_id, tipo, usuario_id, origem, evento_referencia_id, observacao)
    values
      (v_card_id, 'estorno', v_usuario, 'interface', p_evento_id, nullif(btrim(p_observacao), ''))
    returning id into v_novo_id;

  return v_novo_id;
end;
$$;

comment on function public.plt_fn_estornar_evento(bigint, text) is
  'Estorna um gesto de execução (SESSAO-05/D-24): evento novo que anula sem apagar. Gate real no trigger de validação — líder do setor do card ou admin, só o último gesto.';

-- ----------------------------------------------------------------------------
-- 9 · Quem executa o quê (E-11: nada exposto além do combinado)
-- ----------------------------------------------------------------------------
revoke all on function plt_privado.fn_evento_estornado(bigint)              from public, anon;
revoke all on function plt_privado.fn_executor_pelo_log(bigint)             from public, anon;
revoke all on function plt_privado.fn_validar_execucao()                    from public, anon, authenticated;
revoke all on function public.plt_fn_linha_tempo_card(bigint)               from public, anon;
revoke all on function public.plt_fn_estornar_evento(bigint, text)          from public, anon;

-- As views (security_invoker) e o trigger avaliam estas funções com o papel de
-- quem consulta — authenticated precisa poder executá-las.
grant execute on function plt_privado.fn_evento_estornado(bigint)   to authenticated;
grant execute on function plt_privado.fn_executor_pelo_log(bigint)  to authenticated;
grant execute on function public.plt_fn_linha_tempo_card(bigint)    to authenticated;
grant execute on function public.plt_fn_estornar_evento(bigint, text) to authenticated;
