-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 07 — VISÕES DE TEMPO
-- Sessão: SESSAO-02 · Data: 2026-08-26
--
-- D-02, palavras do dono: "tempo total por etapa, independente se está na fila
-- ou não; conta o tempo parado na fila entre cada etapa e outro tempo na etapa
-- em si; na dash mostra um comparativo somando esses dois tempos."
--
-- Detalhamento de 24/08: o TEMPO DE FILA PERTENCE AO SETOR, nunca a uma pessoa
-- (na fila o card ainda não está direcionado a ninguém) — fila longa = gargalo
-- = sinal de contratação. O TEMPO DE EXECUÇÃO pertence a quem iniciou/finalizou.
--
-- São VISÕES, não tabelas: tempo é derivado de evento (M-02). A dashboard de
-- verdade é a SESSAO-08 e o refinamento dos timers é a SESSAO-05 — aqui fica a
-- definição do cálculo, no lugar onde ela não se perde.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · Permanências — quanto tempo o card passou em cada etapa
--
-- O intervalo vai de um evento de posição até o PRÓXIMO evento de posição do
-- mesmo card. A permanência ainda aberta conta até agora.
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
  p.saiu_em,
  (p.saiu_em is null)                                as em_andamento,
  coalesce(p.saiu_em, now()) - p.entrou_em           as duracao,
  coalesce(et.eh_fila, false)                        as eh_fila
from posicoes p
left join public.plt_etapas et on et.id = p.etapa_id;

comment on view public.plt_vw_permanencias is
  'Tempo do card em cada etapa (D-02). eh_fila separa o tempo que pertence ao SETOR do tempo de trabalho.';

-- ----------------------------------------------------------------------------
-- 2 · Execuções — o tempo que tem dono
--
-- Do "iniciar" ao "finalizar" seguinte do mesmo card. Guardamos quem iniciou E
-- quem finalizou porque nem sempre é a mesma pessoa — e inventar uma regra de
-- atribuição aqui seria decidir produto sem o dono (D-04 segue adiada).
-- ----------------------------------------------------------------------------
create or replace view public.plt_vw_execucoes as
with marcos as (
  select
    e.id,
    e.card_id,
    e.tipo,
    e.usuario_id,
    e.setor_origem_id,
    e.etapa_origem_id,
    e.ocorrido_em,
    lead(e.tipo)        over (partition by e.card_id order by e.ocorrido_em, e.id) as proximo_tipo,
    lead(e.usuario_id)  over (partition by e.card_id order by e.ocorrido_em, e.id) as proximo_usuario,
    lead(e.ocorrido_em) over (partition by e.card_id order by e.ocorrido_em, e.id) as proximo_em
  from public.plt_eventos e
  where e.tipo in ('execucao_iniciada', 'execucao_finalizada')
)
select
  m.id                as evento_inicio_id,
  m.card_id,
  c.setor_atual_id    as setor_id,
  c.etapa_atual_id    as etapa_id,
  m.usuario_id        as usuario_inicio_id,
  case when m.proximo_tipo = 'execucao_finalizada' then m.proximo_usuario end as usuario_fim_id,
  m.ocorrido_em       as iniciou_em,
  case when m.proximo_tipo = 'execucao_finalizada' then m.proximo_em end      as finalizou_em,
  (m.proximo_tipo is distinct from 'execucao_finalizada')                     as em_andamento,
  coalesce(
    case when m.proximo_tipo = 'execucao_finalizada' then m.proximo_em end,
    now()
  ) - m.ocorrido_em   as duracao
from marcos m
join public.plt_cards c on c.id = m.card_id
where m.tipo = 'execucao_iniciada';

comment on view public.plt_vw_execucoes is
  'Tempo de execução, o tempo que tem dono (D-02). Guarda quem iniciou e quem finalizou — podem ser pessoas diferentes.';

-- ----------------------------------------------------------------------------
-- 3 · As visões respeitam o RLS de quem consulta
--
-- Sem isto, uma view pertence a quem a criou e enxerga as tabelas com os olhos
-- DELE — furando as políticas da migration 08. `security_invoker` faz a view
-- ler com os olhos de quem chama, que é o que a gente quer.
-- ----------------------------------------------------------------------------
alter view public.plt_vw_permanencias set (security_invoker = on);
alter view public.plt_vw_execucoes set (security_invoker = on);
