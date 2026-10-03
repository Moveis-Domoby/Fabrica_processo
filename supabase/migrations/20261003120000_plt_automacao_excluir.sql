-- ============================================================================
-- Migration 52 · Excluir automação (ajuste da SESSAO-27, pedido do dono, 02/10/2026)
-- ============================================================================
-- "Deixe um botão para excluir automação" — e, sobre o histórico: "fica na
-- auditoria com uma tagzinha de automação excluída" (D-107).
--
--  · plt_fn_automacao_excluir: só o super admin; quem estava ESPERANDO para
--    continuar PARA (não volta a rodar sem a automação); uma linha na trilha
--    ("automacao_excluida", com o nome); a automação sai de vez.
--  · As execuções FICAM (o histórico detalhado): a chave para a automação passa
--    a aceitar vazio e vira nula na exclusão (automacao_nome guarda o nome).
--  · A Auditoria marca as linhas de automação que já não existe
--    (contexto.automacao_excluida) — a trilha é imutável; a marca é da leitura.
--  · Na 51, os exemplos de fábrica excluídos não voltam numa reaplicação.
--
-- Não toca em tabela da integração. Reaplicável.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · As execuções sobrevivem à automação
-- ----------------------------------------------------------------------------
alter table public.plt_automacao_execucoes alter column automacao_id drop not null;
alter table public.plt_automacao_execucoes drop constraint if exists plt_automacao_execucoes_automacao_id_fkey;
alter table public.plt_automacao_execucoes
  add constraint plt_automacao_execucoes_automacao_id_fkey
  foreign key (automacao_id) references public.plt_automacoes(id) on delete set null;

comment on column public.plt_automacao_execucoes.automacao_id is
  'A automação que disparou. Fica NULA se ela for excluída (migration 52) — o histórico fica, com o nome em automacao_nome.';

-- ----------------------------------------------------------------------------
-- 2 · A porta de excluir
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_automacao_excluir(p_id bigint)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu        uuid := plt_privado.fn_usuario_atual();
  v_auto      public.plt_automacoes%rowtype;
  v_esperando integer;
  v_execucoes integer;
begin
  if v_eu is null or not plt_privado.fn_eh_super_admin() then
    raise exception 'As automações são só do super admin.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_auto from public.plt_automacoes where id = p_id for update;
  if not found then
    raise exception 'Essa automação não existe (ou já foi excluída).' using errcode = 'no_data_found';
  end if;

  -- quem estava esperando para continuar PARA aqui (sem a automação, não volta a rodar)
  update public.plt_automacao_execucoes
     set situacao = 'parou', proximo_passo = null, executar_em = null, atualizada_em = now(),
         avaliacao = coalesce(avaliacao || ' · ', '') || 'a automação foi excluída durante a espera'
   where automacao_id = p_id and situacao = 'esperando';
  get diagnostics v_esperando = row_count;
  select count(*)::integer into v_execucoes from public.plt_automacao_execucoes where automacao_id = p_id;

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
  values (v_eu, 'automacao_excluida', jsonb_strip_nulls(jsonb_build_object(
    'automacao_id', v_auto.id,
    'automacao', v_auto.nome,
    'gatilho', v_auto.gatilho,
    'passos', plt_privado.fn_automacao_contar_passos(v_auto.passos),
    'estava_ligada', v_auto.ligada,
    'execucoes', v_execucoes,
    'esperas_paradas', nullif(v_esperando, 0),
    'motivo', 'Automação "' || v_auto.nome || '" excluída')));

  delete from public.plt_automacoes where id = p_id;
  perform plt_privado.fn_automacoes_relogio_ajustar();
  return v_auto.nome;
end;
$$;

comment on function public.plt_fn_automacao_excluir(bigint) is
  'Ajuste da SESSAO-27 (D-107): exclui a automação de vez (só super admin). As execuções ficam (automacao_id nulo), as esperas param, a trilha ganha "automacao_excluida" e a Auditoria marca as linhas dela.';

revoke all on function public.plt_fn_automacao_excluir(bigint) from public, anon;
grant execute on function public.plt_fn_automacao_excluir(bigint) to authenticated;

-- ----------------------------------------------------------------------------
-- 3 · A Auditoria com a marca "automação excluída" (recriada POR INTEIRO a
--     partir da 51 — mesma forma, só o contexto ganha a marca)
-- ----------------------------------------------------------------------------
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
