-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 81 — AS LISTAS QUE SÓ CRESCEM POR
-- CURSOR (SESSAO-32 · §1.8 · Lei §6)
--
-- A trilha de atividade (Auditoria) e o histórico de cada automação crescem
-- sem fim (a trilha: ~2 mil linhas por dia). As duas portas paginavam por
-- deslocamento E contavam a lista inteira a cada página (count(*) over ()):
-- com um ano de trilha, cada página varreria centenas de milhares de linhas.
-- Agora: CURSOR (a próxima página começa depois da última linha mostrada —
-- índices já existentes por data e por automação), "tem mais" na própria
-- página, e o total só na 1ª página, contado até 10.001 ("10.000+").
-- Mesmo filtro, mesma ordem, mesmas colunas (+ tem_mais) — prova no harness
-- (percorrer todas as páginas = a lista inteira, na ordem).
-- Nada nas tabelas da integração.
-- ============================================================================

drop function if exists public.plt_fn_auditoria(integer, integer, uuid, text[], timestamptz, timestamptz, text, boolean);

create or replace function public.plt_fn_auditoria(
  p_limite    integer     default 30,
  p_antes_em  timestamptz default null,   -- o cursor: a última linha mostrada (data
  p_antes_id  bigint      default null,   -- e id) — nulo = 1ª página
  p_usuario   uuid        default null,   -- uma pessoa
  p_acoes     text[]      default null,   -- um tipo (a tela manda a lista de ações do grupo)
  p_desde     timestamptz default null,
  p_ate       timestamptz default null,
  p_busca     text        default null,   -- texto livre; só dígitos = nº do pedido também
  p_sistema   boolean     default null    -- true = só o Sistema · false = só pessoas · nulo = tudo
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
  tem_mais       boolean,
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
  v_lim    integer := least(greatest(coalesce(p_limite, 30), 1), 100);
  v_total  bigint;
begin
  if v_eu is null or not plt_privado.fn_eh_super_admin() then
    raise exception 'A auditoria é só do super admin.' using errcode = 'insufficient_privilege';
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

  -- O total só na 1ª página, até 10.001 (a tela mostra "10.000+").
  if p_antes_em is null then
    select count(*) into v_total from (
      select 1
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
       limit 10001) x;
  end if;

  return query
  with pagina as (
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
       and (p_antes_em is null
            or (l.criado_em, l.id) < (p_antes_em, coalesce(p_antes_id, 9223372036854775807)))
     order by l.criado_em desc, l.id desc
     limit v_lim + 1
  ),
  numerada as (
    select pa.*, row_number() over (order by pa.criado_em desc, pa.id desc) as n from pagina pa
  )
  select pg.id, pg.criado_em, pg.usuario_id, u.nome, pg.acao, pg.rota,
         -- ajuste da SESSAO-27 (pedido do dono): linha de uma automação que já
         -- não existe ganha a marca "automacao_excluida" (a trilha é imutável —
         -- a marca é calculada na leitura). Vale para as linhas da própria
         -- automação (contexto) e para os gestos dela (dados do evento).
         case when coalesce(pg.contexto->>'automacao_id', ev.dados->>'automacao_id') ~ '^[0-9]+$'
                   and not exists (select 1 from public.plt_automacoes a
                                    where a.id = coalesce(pg.contexto->>'automacao_id', ev.dados->>'automacao_id')::bigint)
              then coalesce(pg.contexto, '{}'::jsonb) || '{"automacao_excluida": true}'::jsonb
              else pg.contexto end,
         pe.numero, cd.tipo, so.nome, sd.nome, eo.nome, ed.nome,
         coalesce(nullif(btrim(ev.observacao), ''),
                  nullif(btrim(pg.contexto->>'motivo'), ''),
                  nullif(btrim(ev.dados->>'motivo'), '')),
         (select count(*) from pagina) > v_lim,
         v_total
    from numerada pg
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
   where pg.n <= v_lim
   order by pg.criado_em desc, pg.id desc;
end;
$$;

comment on function public.plt_fn_auditoria(integer, timestamptz, bigint, uuid, text[], timestamptz, timestamptz, text, boolean) is
  'D-95 · SESSAO-32 (migration 81): a trilha de atividade para o super admin, POR CURSOR (p_antes_em/p_antes_id = a última linha mostrada), 1–100 por vez, com tem_mais; total só na 1ª página (até 10.001). Mesmo filtro e tradução de antes (pessoa, pedido, setores, etapas, motivo; tarefa privada fora).';

revoke all on function public.plt_fn_auditoria(integer, timestamptz, bigint, uuid, text[], timestamptz, timestamptz, text, boolean) from public, anon;
grant execute on function public.plt_fn_auditoria(integer, timestamptz, bigint, uuid, text[], timestamptz, timestamptz, text, boolean) to authenticated;

drop function if exists public.plt_fn_automacao_execucoes(bigint, integer, integer);

create or replace function public.plt_fn_automacao_execucoes(
  p_automacao_id bigint, p_limite integer default 20, p_antes_id bigint default null)
returns table (
  id bigint, gatilho text, situacao text, avaliacao text, resultado jsonb, profundidade integer,
  card_id bigint, card_tipo text, card_arquivado boolean, produto text, unidade text,
  pedido_numero bigint, setor text, etapa text, contexto jsonb, executar_em timestamptz,
  criada_em timestamptz, atualizada_em timestamptz, tem_mais boolean, contagem_total bigint)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_lim   integer := least(greatest(coalesce(p_limite, 20), 1), 100);
  v_total bigint;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_eh_super_admin() then
    raise exception 'As automações são só do super admin.' using errcode = 'insufficient_privilege';
  end if;
  -- o total só na 1ª página, até 10.001
  if p_antes_id is null then
    select count(*) into v_total from (
      select 1 from public.plt_automacao_execucoes t where t.automacao_id = p_automacao_id limit 10001) q;
  end if;
  return query
  with pagina as (
    select pe.* from public.plt_automacao_execucoes pe
     where pe.automacao_id = p_automacao_id
       and (p_antes_id is null or pe.id < p_antes_id)
     order by pe.id desc
     limit v_lim + 1
  ),
  numerada as (
    select pa.*, row_number() over (order by pa.id desc) as n from pagina pa
  )
  select x.id, x.gatilho, x.situacao, x.avaliacao, x.resultado, x.profundidade,
         x.card_id, c.tipo, c.arquivado_em is not null, c.item_descricao,
         case when c.tipo = 'unidade' then c.indice_unidade || '/' || c.total_unidades end,
         p.numero::bigint, s.nome, e.nome, x.contexto, x.executar_em,
         x.criada_em, x.atualizada_em,
         (select count(*) from pagina) > v_lim, v_total
    from numerada x
    left join public.plt_cards c on c.id = x.card_id
    left join public.pedidos p on p.id = coalesce(x.pedido_id, c.pedido_id)
    left join public.plt_setores s on s.id = c.setor_atual_id
    left join public.plt_etapas e on e.id = c.etapa_atual_id
   where x.n <= v_lim
   order by x.id desc;
end;
$$;

comment on function public.plt_fn_automacao_execucoes(bigint, integer, bigint) is
  'D-103 · SESSAO-32 (migration 81): as execuções de uma automação para o super admin, POR CURSOR (p_antes_id = a última mostrada), 1–100 por vez, com tem_mais; total só na 1ª página (até 10.001).';

revoke all on function public.plt_fn_automacao_execucoes(bigint, integer, bigint) from public, anon;
grant execute on function public.plt_fn_automacao_execucoes(bigint, integer, bigint) to authenticated;
