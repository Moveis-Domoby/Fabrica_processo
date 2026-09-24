-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 35 — PAUSA DE TAREFA + PCP SEM ENCERRADOS
-- Sessão: SESSAO-23 (ajustes do dono, 23/09) · Data: 2026-09-24
--
-- 1 · Pausar tarefa DE VERDADE (pedido do dono: iniciar/pausar/finalizar no
--     Meu Painel): a coluna `tempo_acumulado` guarda os segmentos já corridos;
--     pausar soma o segmento aberto e zera `iniciada_em`; retomar é o iniciar
--     de sempre. O tempo continua DERIVADO (nunca digitado — D-34), e as três
--     portas pessoais passam a somar acumulado + segmento aberto.
-- 2 · Quadro do PCP só com pedidos NÃO encerrados no Tiny (AJUSTE 2 do dono;
--     os 2 casos "Entregue com unidade viva" eram teste e foram concluídos/
--     arquivados por manutenção): a porta nova `plt_fn_cards_pedido_pcp` faz o
--     filtro NA CONSULTA, via fn_situacao_normalizada (E-25) — nada de baixar
--     tudo para filtrar no cliente (regra 17), nada arquivado, nada de mexer
--     nos gatilhos blindados de `pedidos` (D-43). Visão pura, reversível.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · O acumulador da pausa
-- ----------------------------------------------------------------------------
alter table public.plt_tarefas add column if not exists tempo_acumulado interval;
alter table public.plt_tarefas alter column tempo_acumulado set default interval '0';
-- O backfill passa pela FLAG da maquinaria: o banco real já tem tarefas do
-- Sistema, e o trigger de imutabilidade delas recusaria o UPDATE (primo do
-- E-19 — a migration precisa tolerar o futuro que o banco já viveu).
do $$
begin
  perform set_config('plt.tarefa_sistema', '1', true);
  update public.plt_tarefas set tempo_acumulado = interval '0' where tempo_acumulado is null;
  perform set_config('plt.tarefa_sistema', '', true);
end;
$$;
alter table public.plt_tarefas alter column tempo_acumulado set not null;

comment on column public.plt_tarefas.tempo_acumulado is
  'SESSAO-23: soma dos segmentos de timer já pausados. O tempo total da tarefa = tempo_acumulado + (agora − iniciada_em) quando o timer está rodando. Escrito só por plt_fn_tarefa_pausar/concluir — nunca digitado.';

-- ----------------------------------------------------------------------------
-- 2 · Pausar (endpoint de propósito — E-11): soma o segmento e desliga o timer
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_tarefa_pausar(p_tarefa_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu uuid := plt_privado.fn_usuario_atual();
  v_t  public.plt_tarefas%rowtype;
begin
  if v_eu is null then
    raise exception 'Só usuário ativo da plataforma pausa tarefa.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_t from public.plt_tarefas where id = p_tarefa_id;
  if not found then
    raise exception 'Tarefa não encontrada.' using errcode = 'no_data_found';
  end if;
  if v_t.origem = 'sistema' then
    raise exception 'Tarefa do Sistema se resolve registrando o parecer — ela não tem timer.'
      using errcode = 'check_violation';
  end if;
  if v_t.responsavel_id is distinct from v_eu and not plt_privado.fn_eh_admin() then
    raise exception 'Só quem está com a tarefa (ou admin) pausa o tempo dela.'
      using errcode = 'insufficient_privilege';
  end if;
  if v_t.iniciada_em is null then
    raise exception 'Esta tarefa não está com o tempo rodando.' using errcode = 'check_violation';
  end if;
  if v_t.situacao = 'concluida' then
    raise exception 'Tarefa concluída não se pausa.' using errcode = 'check_violation';
  end if;

  update public.plt_tarefas
     set tempo_acumulado = tempo_acumulado + (now() - iniciada_em),
         iniciada_em = null,
         situacao = 'aberta'
   where id = p_tarefa_id;
end;
$$;

comment on function public.plt_fn_tarefa_pausar(bigint) is
  'SESSAO-23: pausa o timer da tarefa GUARDANDO o tempo corrido (tempo_acumulado). Retomar é gravar iniciada_em de novo. Gate: responsável ou admin.';

revoke all on function public.plt_fn_tarefa_pausar(bigint) from public, anon;
grant execute on function public.plt_fn_tarefa_pausar(bigint) to authenticated;

-- ----------------------------------------------------------------------------
-- 3 · As três portas pessoais passam a somar acumulado + segmento aberto.
--     A data de referência da tarefa vira coalesce(iniciada, concluída,
--     atualizada) — a pausada (timer desligado) continua aparecendo.
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_meu_tempo_dias(
  p_de  timestamptz,
  p_ate timestamptz
)
returns table (
  dia            date,
  tarefas        integer,
  tempo_pessoal  interval,
  tempo_delegado interval
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with minhas as (
    select t.*,
           coalesce(t.iniciada_em, t.concluida_em, t.atualizado_em) as referencia,
           t.tempo_acumulado
             + case when t.iniciada_em is not null
                    then coalesce(t.concluida_em, now()) - t.iniciada_em
                    else interval '0' end as duracao
      from public.plt_tarefas t
     where t.responsavel_id is not null
       and t.responsavel_id = plt_privado.fn_usuario_atual()
       and (t.iniciada_em is not null or t.tempo_acumulado > interval '0')
  )
  select (m.referencia at time zone 'America/Fortaleza')::date as dia,
         count(*)::int as tarefas,
         coalesce(sum(m.duracao)
           filter (where m.criada_por_id is not distinct from m.responsavel_id
                     and m.origem = 'pessoa'), interval '0') as tempo_pessoal,
         coalesce(sum(m.duracao)
           filter (where m.criada_por_id is distinct from m.responsavel_id
                      or m.origem <> 'pessoa'), interval '0') as tempo_delegado
    from minhas m
   where m.referencia >= p_de
     and m.referencia <  p_ate
   group by 1
   order by 1;
$$;

create or replace function public.plt_fn_meu_tempo_tarefas(
  p_de           timestamptz,
  p_ate          timestamptz,
  p_limite       integer default 20,
  p_deslocamento integer default 0
)
returns table (
  tarefa_id      bigint,
  titulo         text,
  pessoal        boolean,
  situacao       text,
  iniciada_em    timestamptz,
  concluida_em   timestamptz,
  duracao        interval,
  contagem_total bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with minhas as (
    select t.*,
           coalesce(t.iniciada_em, t.concluida_em, t.atualizado_em) as referencia,
           t.tempo_acumulado
             + case when t.iniciada_em is not null
                    then coalesce(t.concluida_em, now()) - t.iniciada_em
                    else interval '0' end as duracao_total
      from public.plt_tarefas t
     where t.responsavel_id is not null
       and t.responsavel_id = plt_privado.fn_usuario_atual()
       and (t.iniciada_em is not null or t.tempo_acumulado > interval '0')
  )
  select m.id,
         m.titulo,
         (m.criada_por_id is not distinct from m.responsavel_id and m.origem = 'pessoa') as pessoal,
         m.situacao,
         m.iniciada_em,
         m.concluida_em,
         m.duracao_total as duracao,
         count(*) over ()::bigint as contagem_total
    from minhas m
   where m.referencia >= p_de
     and m.referencia <  p_ate
   order by m.duracao_total desc, m.id
   limit greatest(coalesce(p_limite, 20), 1)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

create or replace function public.plt_fn_meu_desempenho(
  p_de  timestamptz,
  p_ate timestamptz
)
returns table (
  execucoes            integer,
  execucoes_finalizadas integer,
  tempo_execucao       interval,
  media_execucao       interval,
  cards_distintos      integer,
  tarefas_concluidas   integer,
  tempo_afazeres       interval,
  pareceres_dados      integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with eu as (
    select plt_privado.fn_usuario_atual() as id
  ),
  exec as (
    select count(*)::int as execucoes,
           count(*) filter (where v.encerramento = 'finalizada')::int as finalizadas,
           coalesce(sum(v.duracao), interval '0') as tempo,
           count(distinct v.card_id)::int as cards
      from public.plt_vw_execucoes v, eu
     where eu.id is not null
       and v.usuario_inicio_id = eu.id
       and v.iniciou_em >= p_de
       and v.iniciou_em <  p_ate
  ),
  tar as (
    select count(*) filter (where t.concluida_em >= p_de and t.concluida_em < p_ate)::int as concluidas,
           coalesce(sum(
             t.tempo_acumulado
               + case when t.iniciada_em is not null
                      then coalesce(t.concluida_em, now()) - t.iniciada_em
                      else interval '0' end
           ) filter (where coalesce(t.iniciada_em, t.concluida_em, t.atualizado_em) >= p_de
                       and coalesce(t.iniciada_em, t.concluida_em, t.atualizado_em) <  p_ate
                       and (t.iniciada_em is not null or t.tempo_acumulado > interval '0')),
             interval '0') as tempo
      from public.plt_tarefas t, eu
     where eu.id is not null
       and t.responsavel_id = eu.id
  ),
  par as (
    select count(*)::int as dados
      from public.plt_eventos e, eu
     where eu.id is not null
       and e.tipo = 'qualidade_parecer'
       and e.usuario_id = eu.id
       and e.ocorrido_em >= p_de
       and e.ocorrido_em <  p_ate
  )
  select exec.execucoes,
         exec.finalizadas,
         exec.tempo,
         case when exec.execucoes > 0 then exec.tempo / exec.execucoes end as media_execucao,
         exec.cards,
         tar.concluidas,
         tar.tempo,
         par.dados
    from exec, tar, par
   where (select id from eu) is not null;
$$;

-- ----------------------------------------------------------------------------
-- 4 · O quadro do PCP sem os pedidos encerrados no Tiny (AJUSTE 2)
--     Porta nova no lugar da leitura direta de plt_cards: o filtro de situação
--     precisa de `pedidos`, que o navegador não lê. Comparação SEMPRE pela
--     normalização (E-25). Cancelados continuam aparecendo (aba própria na
--     SESSAO-24); as UNIDADES de pedido encerrado seguem normais nos setores.
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_cards_pedido_pcp(
  p_limite       integer default 10,
  p_deslocamento integer default 0
)
returns table (
  id bigint,
  tipo text,
  pedido_id bigint,
  card_pai_id bigint,
  item_seq integer,
  item_codigo text,
  item_descricao text,
  indice_unidade integer,
  total_unidades integer,
  setor_atual_id bigint,
  etapa_atual_id bigint,
  desde timestamptz,
  executor_atual_id uuid,
  responsavel_id uuid,
  delegado_em timestamptz,
  qualidade_atual text,
  concluido_em timestamptz,
  pausado_em timestamptz,
  liberado_completo_em timestamptz,
  contagem_total bigint
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
         count(*) over ()::bigint as contagem_total
    from public.plt_cards c
    join public.plt_setores s on s.id = c.setor_atual_id and s.papel_no_fluxo = 'entrada'
    join public.pedidos p on p.id = c.pedido_id
   where plt_privado.fn_usuario_atual() is not null
     and (
       plt_privado.fn_eh_admin()
       or c.setor_atual_id in (select plt_privado.fn_setores_do_usuario())
     )
     and c.tipo = 'pedido'
     and c.arquivado_em is null
     and c.liberado_completo_em is null
     -- Encerrado no Tiny sai do quadro; cancelado fica (aba própria — S24).
     and plt_privado.fn_situacao_normalizada(p.situacao) not in ('entregue', 'nao_entregue')
   order by c.desde asc nulls last, c.id
   limit least(greatest(coalesce(p_limite, 10), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_cards_pedido_pcp(integer, integer) is
  'SESSAO-23 (AJUSTE 2 do dono): a coluna de pedidos do quadro do PCP — abertos (liberado_completo_em nulo) e NÃO encerrados no Tiny, paginada com o total na mesma consulta (regra 17). Endpoint de propósito; gate: admin ou gente do setor de entrada.';

revoke all on function public.plt_fn_cards_pedido_pcp(integer, integer) from public, anon;
grant execute on function public.plt_fn_cards_pedido_pcp(integer, integer) to authenticated;
