-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 50 — A AUDITORIA NO PAINEL ADMIN
-- SESSAO-29 (01/10/2026) · D-95 · ↪️ D-40 ("a consulta admin completa pode vir
-- depois" — chegou)
--
-- O dono, nas respostas da SESSAO-29: "crie uma página de auditoria dentro do
-- painel admin; lá dentro iremos colocar para mapear os erros do n8n também
-- futuramente; deve aparecer log de tudo — execução, visualização, clique de
-- entrada, movimentações e coisas do tipo; deve salvar o rastro de quem,
-- quando, onde, porquê, o quê".
--
-- O rastro JÁ é gravado desde a SESSAO-13 (D-40): `plt_logs_atividade` (quem,
-- quando, ação, tela, contexto) — os gatilhos de eventos, tarefas, cadastro,
-- caminhões, programação e estoque, mais a navegação e a entrada pelo
-- navegador. Esta migration NÃO cria tabela (D-47): só as duas portas de
-- LEITURA do admin, paginadas no servidor (regra 17):
--
--   1. `plt_fn_auditoria` — a atividade de todo mundo, uma página por vez, com
--      filtros (pessoa, tipo de ação, período, só sistema/só pessoas, busca —
--      inclusive pelo nº do pedido) e já traduzida para gente: o NOME de quem
--      fez, o pedido do card, os setores/etapas de origem e destino e o
--      PORQUÊ (a observação do evento ou o motivo do gesto). Tarefa pessoal
--      PRIVADA (D-51) não aparece nem para o admin — só para quem a criou.
--   2. `plt_fn_auditoria_conferencias` — a conferência diária com o Tiny
--      (SESSAO-29): a rodada em andamento (quantos já lidos) e o histórico
--      das rodadas (o resumo que fica no log da integração). O lugar onde os
--      erros do n8n vão aparecer no futuro.
--
-- Nada muda em tabela nenhuma. Integração do Tiny intacta.
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · A atividade (quem, quando, onde, o quê e porquê)
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_auditoria(integer, integer, uuid, text[], timestamptz, timestamptz, text, boolean);

create or replace function public.plt_fn_auditoria(
  p_limite       integer     default 30,
  p_deslocamento integer     default 0,
  p_usuario      uuid        default null,   -- uma pessoa
  p_acoes        text[]      default null,   -- um tipo (a tela manda a lista de ações do grupo)
  p_desde        timestamptz default null,
  p_ate          timestamptz default null,
  p_busca        text        default null,   -- texto livre; só dígitos = nº do pedido também
  p_sistema      boolean     default null    -- true = só o Sistema · false = só pessoas · nulo = tudo
)
returns table (
  id             bigint,
  criado_em      timestamptz,
  usuario_id     uuid,
  usuario_nome   text,
  acao           text,
  rota           text,
  contexto       jsonb,
  pedido_numero  integer,
  card_tipo      text,
  setor_origem   text,
  setor_destino  text,
  etapa_origem   text,
  etapa_destino  text,
  motivo         text,
  contagem_total bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_eu     uuid    := plt_privado.fn_usuario_atual();
  v_busca  text    := nullif(btrim(coalesce(p_busca, '')), '');
  v_cards  bigint[];
begin
  if v_eu is null or not plt_privado.fn_eh_admin() then
    raise exception 'A auditoria é só do admin.' using errcode = 'insufficient_privilege';
  end if;
  if v_busca is not null and length(v_busca) > 120 then
    raise exception 'Busca longa demais (até 120 caracteres).';
  end if;
  -- só dígitos: pode ser o nº de um pedido — os cards dele entram na busca
  if v_busca ~ '^[0-9]{3,9}$' then
    select coalesce(array_agg(c.id), '{}') into v_cards
      from public.plt_cards c join public.pedidos p on p.id = c.pedido_id
     where p.numero = v_busca::integer;
  end if;

  return query
  with filtrados as (
    select l.id, l.criado_em, l.usuario_id, l.acao, l.rota, l.contexto
      from public.plt_logs_atividade l
     where (p_usuario is null or l.usuario_id = p_usuario)
       and (p_acoes is null or cardinality(p_acoes) = 0 or l.acao = any (p_acoes))
       and (p_desde is null or l.criado_em >= p_desde)
       and (p_ate is null or l.criado_em < p_ate)
       and (p_sistema is null
            or (p_sistema and l.usuario_id is null)
            or (not p_sistema and l.usuario_id is not null))
       and (v_busca is null
            or l.acao ilike '%' || v_busca || '%'
            or l.rota ilike '%' || v_busca || '%'
            or l.contexto::text ilike '%' || v_busca || '%'
            or (cardinality(v_cards) > 0
                and (case when l.contexto->>'card_id' ~ '^[0-9]+$'
                          then (l.contexto->>'card_id')::bigint end) = any (v_cards)))
       -- D-51: tarefa pessoal PRIVADA não aparece nem para o admin (só para quem a criou)
       and not (l.acao like 'tarefa\_%'
                and exists (select 1 from public.plt_tarefas t
                             where t.id = case when l.contexto->>'tarefa_id' ~ '^[0-9]+$'
                                               then (l.contexto->>'tarefa_id')::bigint end
                               and t.privada
                               and t.criada_por_id is distinct from v_eu))
  ),
  pagina as (
    select f.id, f.criado_em, f.usuario_id, f.acao, f.rota, f.contexto,
           count(*) over () as total
      from filtrados f
     order by f.criado_em desc, f.id desc
     limit least(greatest(coalesce(p_limite, 30), 1), 100)
    offset greatest(coalesce(p_deslocamento, 0), 0)
  )
  select pg.id, pg.criado_em, pg.usuario_id, u.nome, pg.acao, pg.rota, pg.contexto,
         pe.numero, cd.tipo, so.nome, sd.nome, eo.nome, ed.nome,
         coalesce(nullif(btrim(ev.observacao), ''),
                  nullif(btrim(pg.contexto->>'motivo'), ''),
                  nullif(btrim(ev.dados->>'motivo'), '')),
         pg.total
    from pagina pg
    left join public.plt_usuarios u on u.id = pg.usuario_id
    left join public.plt_eventos ev
           on ev.id = case when pg.contexto->>'evento_id' ~ '^[0-9]+$' then (pg.contexto->>'evento_id')::bigint end
    left join public.plt_cards cd
           on cd.id = case when pg.contexto->>'card_id' ~ '^[0-9]+$' then (pg.contexto->>'card_id')::bigint end
    left join public.pedidos pe on pe.id = cd.pedido_id
    left join public.plt_setores so
           on so.id = case when pg.contexto->>'setor_origem_id' ~ '^[0-9]+$' then (pg.contexto->>'setor_origem_id')::bigint end
    left join public.plt_setores sd
           on sd.id = case when pg.contexto->>'setor_destino_id' ~ '^[0-9]+$' then (pg.contexto->>'setor_destino_id')::bigint end
    left join public.plt_etapas eo
           on eo.id = case when pg.contexto->>'etapa_origem_id' ~ '^[0-9]+$' then (pg.contexto->>'etapa_origem_id')::bigint end
    left join public.plt_etapas ed
           on ed.id = case when pg.contexto->>'etapa_destino_id' ~ '^[0-9]+$' then (pg.contexto->>'etapa_destino_id')::bigint end
   order by pg.criado_em desc, pg.id desc;
end;
$$;

comment on function public.plt_fn_auditoria(integer, integer, uuid, text[], timestamptz, timestamptz, text, boolean) is
  'SESSAO-29 (D-95): a auditoria do Painel admin — a trilha de atividade (D-40) paginada no servidor, com filtros e já traduzida (nome, pedido, setores/etapas, motivo). Só admin. Tarefa privada (D-51) fica de fora para quem não a criou.';

-- ----------------------------------------------------------------------------
-- 2 · A conferência diária com o Tiny (SESSAO-29): agora + histórico
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_auditoria_conferencias(
  p_limite       integer default 10,
  p_deslocamento integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_busca    jsonb;
  v_rodada   text;
  v_agora    jsonb;
  v_agendada boolean := null;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_eh_admin() then
    raise exception 'A auditoria é só do admin.' using errcode = 'insufficient_privilege';
  end if;

  select f.params into v_busca from public.tiny_fila f
   where f.recurso = 'pedidos_pesquisa' and f.chave = 'pente-fino:p1';
  v_rodada := v_busca->>'rodada';
  if v_rodada is not null and v_busca->>'resumo_em' is null then
    select jsonb_build_object(
             'rodada',  v_rodada,
             'inicio',  v_busca->>'inicio',
             'motivo',  coalesce(v_busca->>'motivo', 'madrugada'),
             'na_fila', count(*) filter (where x.recurso = 'pedido'),
             'lidos',   count(*) filter (where x.recurso = 'pedido' and x.status in ('ok', 'vazio', 'erro')),
             'mudaram', count(*) filter (where x.recurso = 'pedido' and x.status = 'ok'
                                           and jsonb_array_length(coalesce(x.params->'mudou', '[]'::jsonb)) > 0))
      into v_agora
      from public.tiny_fila x
     where x.params->>'rodada' = v_rodada;
  end if;

  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    v_agendada := exists (select 1 from cron.job where jobname = 'plt-tiny-pente-fino');
  end if;

  return jsonb_build_object(
    'em_andamento', v_agora,
    'agendada',     v_agendada,
    'total',        (select count(*) from public.eventos e where e.tipo = 'pente_fino'),
    'rodadas',      coalesce((
       select jsonb_agg(x.payload || jsonb_build_object('id', x.id, 'registrado_em', x.recebido_em)
                        order by x.id desc)
         from (select e.id, e.recebido_em, e.payload
                 from public.eventos e
                where e.tipo = 'pente_fino'
                order by e.id desc
                limit least(greatest(coalesce(p_limite, 10), 1), 50)
               offset greatest(coalesce(p_deslocamento, 0), 0)) x), '[]'::jsonb));
end;
$$;

comment on function public.plt_fn_auditoria_conferencias(integer, integer) is
  'SESSAO-29 (D-95): a conferência diária com o Tiny na Auditoria — a rodada em andamento e as rodadas encerradas (o resumo gravado no log da integração, tipo pente_fino). Só admin.';

-- ----------------------------------------------------------------------------
-- 3 · Permissões: portas de leitura de propósito (gate de admin por dentro)
-- ----------------------------------------------------------------------------
revoke all on function public.plt_fn_auditoria(integer, integer, uuid, text[], timestamptz, timestamptz, text, boolean) from public, anon;
revoke all on function public.plt_fn_auditoria_conferencias(integer, integer) from public, anon;
grant execute on function public.plt_fn_auditoria(integer, integer, uuid, text[], timestamptz, timestamptz, text, boolean) to authenticated;
grant execute on function public.plt_fn_auditoria_conferencias(integer, integer) to authenticated;
