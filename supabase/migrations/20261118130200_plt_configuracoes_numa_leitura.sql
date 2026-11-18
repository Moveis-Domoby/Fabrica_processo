-- ============================================================================
-- SESSAO-55 · item 3 — Configurações: Equipe, API e integrações, Caminhões,
-- Automações e o "Desligar o tempo" do Controle de tempo, numa leitura cada
-- (dívida 18 da Lei §14)
-- ============================================================================
-- Cada tela abria com 2 ou 3 leituras em paralelo:
--   · Equipe             — as pessoas e os vínculos de setor;
--   · API e integrações  — as chaves, os webhooks e as últimas entregas;
--   · Caminhões          — os caminhões e a situação do "Entregue vai ao Tiny";
--   · Automações         — a lista (ou a automação aberta), as etapas e as pessoas;
--   · Controle de tempo  — as abas já abrem com 1 leitura cada (SESSAO-42); o
--                          bloco "Desligar o tempo", aberto no clique, fazia 3
--                          (os nomes, os horários de pessoa e as pausas).
--
-- As portas abaixo são security INVOKER e leem AS MESMAS tabelas, colunas,
-- filtros e ordens que a tela lia direto — a RLS e a permissão por coluna de
-- plt_usuarios (D-66/D-68) decidem igual: quem não via, segue sem ver; nenhum
-- dado pessoal novo sai (só as colunas do perfil que a tela já lia). O que a
-- tela pedia a outra porta (plt_fn_automacoes, plt_fn_automacao,
-- plt_fn_tiny_entrega_situacao) é chamado por dentro, com o gate dela.
--
-- Funções NOVAS (nenhuma recriada). Só leitura: STABLE.
-- ============================================================================
set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · Configurações → Equipe
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_equipe_abertura()
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    -- a conta do tablet de cada setor é do APARELHO, não de uma pessoa (E-114)
    'pessoas', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.nome, p.id)
        from (select u.id, u.nome, u.usuario, u.email, u.telefone, u.matricula, u.papel, u.senha_padrao,
                     u.ativo, u.arquivado_em, u.tema, u.foto_caminho, u.modulos, u.super_admin,
                     u.conta_tablet, u.pode_auxiliar
                from public.plt_usuarios u
               where u.conta_tablet = false) p), '[]'::jsonb),
    'vinculos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'usuario_id', us.usuario_id, 'setor_id', us.setor_id, 'lider_do_setor', us.lider_do_setor,
               'setor', case when s.id is null then null else jsonb_build_object('nome', s.nome) end)
             order by us.usuario_id, us.setor_id)
        from public.plt_usuario_setores us
        left join public.plt_setores s on s.id = us.setor_id), '[]'::jsonb));
$$;

comment on function public.plt_fn_equipe_abertura() is
  'SESSAO-55 (Lei §2 — dívida 18): Configurações → Equipe numa leitura — as pessoas (as colunas do perfil que a tela já lia; sem a conta de tablet) e os vínculos de setor com o nome do setor. Security invoker: a RLS e a permissão por coluna de plt_usuarios decidem como na leitura direta.';

-- ----------------------------------------------------------------------------
-- 2 · Configurações → API e integrações
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_api_abertura()
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'chaves', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'nome', c.nome, 'prefixo', c.prefixo, 'escopo', c.escopo, 'criada_em', c.criada_em,
               'revogada_em', c.revogada_em, 'ultimo_uso_em', c.ultimo_uso_em)
             order by c.criada_em desc, c.id desc)
        from public.plt_chaves_api c), '[]'::jsonb),
    -- o segredo do webhook NUNCA sai (a tela nunca o leu)
    'webhooks', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', w.id, 'nome', w.nome, 'url', w.url, 'eventos', w.eventos, 'ativo', w.ativo,
               'criado_em', w.criado_em)
             order by w.criado_em desc, w.id desc)
        from public.plt_webhooks w), '[]'::jsonb),
    'entregas', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.criada_em desc, e.id desc)
        from (select we.id, we.webhook_id, we.situacao, we.tentativas, we.ultimo_erro, we.criada_em
                from public.plt_webhook_entregas we
               order by we.criada_em desc, we.id desc
               limit 20) e), '[]'::jsonb));
$$;

comment on function public.plt_fn_api_abertura() is
  'SESSAO-55 (Lei §2 — dívida 18): Configurações → API e integrações numa leitura — as chaves de API (sem o hash), os webhooks (sem o segredo) e as 20 últimas entregas. Security invoker: a RLS (só admin) decide como na leitura direta.';

-- ----------------------------------------------------------------------------
-- 3 · Configurações → Caminhões
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_caminhoes_abertura(
  p_arquivados boolean default false,  -- a lista inclui os arquivados
  p_tiny       boolean default true    -- a tela ainda não tem a situação do Tiny guardada
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_ret jsonb;
begin
  v_ret := jsonb_build_object(
    'caminhoes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'nome', c.nome, 'placa', c.placa, 'capacidade', c.capacidade,
               'foto_caminho', c.foto_caminho, 'arquivado_em', c.arquivado_em, 'criado_em', c.criado_em)
             order by c.nome, c.id)
        from public.plt_caminhoes c
       where coalesce(p_arquivados, false) or c.arquivado_em is null), '[]'::jsonb));
  if coalesce(p_tiny, true) then
    -- o cartão "Entregue vai ao Tiny" (nulo para quem não é admin — o gate é dela)
    v_ret := v_ret || jsonb_build_object('tiny_entrega', public.plt_fn_tiny_entrega_situacao());
  end if;
  return v_ret;
end;
$$;

comment on function public.plt_fn_caminhoes_abertura(boolean, boolean) is
  'SESSAO-55 (Lei §2 — dívida 18): Configurações → Caminhões numa leitura — os caminhões (com ou sem os arquivados) e, a pedido, a situação do "Entregue vai ao Tiny" (plt_fn_tiny_entrega_situacao, com o gate dela). Security invoker.';

-- ----------------------------------------------------------------------------
-- 4 · Painel super admin → Automações (a lista, a automação aberta ou — na
--     automação NOVA, que não tem o que ler — só os cadastros dos blocos)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_automacoes_abertura(
  p_id           bigint  default null,   -- com id: a automação aberta no editor; sem: a lista
  p_limite       integer default 30,
  p_deslocamento integer default 0,
  p_arquivadas   boolean default false,
  p_cadastros    boolean default true,   -- a tela ainda não tem as etapas e as pessoas guardadas
  p_so_cadastros boolean default false   -- a automação NOVA aberta direto pelo endereço: só os cadastros
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_ret jsonb;
begin
  -- A automação nova (ainda não existe; nada dela a ler): só os cadastros que os
  -- blocos usam, numa chamada. São as etapas ativas e o nome das pessoas ativas —
  -- o que qualquer pessoa logada já lê direto (a RLS de sempre decide); nenhum
  -- dado de automação sai por aqui, então não há a recusa do super admin.
  if coalesce(p_so_cadastros, false) then
    v_ret := '{}'::jsonb;
  -- as duas portas recusam quem não é o super admin (D-100) — a recusa é delas
  elsif p_id is not null then
    v_ret := jsonb_build_object('automacao', public.plt_fn_automacao(p_id));
  else
    v_ret := jsonb_build_object('lista', coalesce((
      select jsonb_agg(to_jsonb(a) - 'ordinality' order by a.ordinality)
        from public.plt_fn_automacoes(p_limite, p_deslocamento, p_arquivadas) with ordinality as a), '[]'::jsonb));
  end if;
  if coalesce(p_cadastros, true) or coalesce(p_so_cadastros, false) then
    v_ret := v_ret || jsonb_build_object(
      'etapas', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', e.id, 'setor_id', e.setor_id, 'nome', e.nome, 'ordem', e.ordem, 'eh_fila', e.eh_fila,
                 'eh_danificado', e.eh_danificado, 'ativa', e.ativa, 'setor_destino_id', e.setor_destino_id,
                 'conclui_producao', e.conclui_producao, 'pede_motivo', e.pede_motivo,
                 'cancela_fabricacao', e.cancela_fabricacao, 'cancela_motivo', e.cancela_motivo,
                 'cancela_dias', e.cancela_dias)
               order by e.setor_id, e.ordem, e.id)
          from public.plt_etapas e
         where e.ativa), '[]'::jsonb),
      -- a chave do tablet do setor não é gente
      'pessoas', coalesce((
        select jsonb_agg(jsonb_build_object('id', u.id, 'nome', u.nome) order by u.nome, u.id)
          from public.plt_usuarios u
         where u.ativo and u.conta_tablet = false), '[]'::jsonb));
  end if;
  return v_ret;
end;
$$;

comment on function public.plt_fn_automacoes_abertura(bigint, integer, integer, boolean, boolean, boolean) is
  'SESSAO-55 (Lei §2 — dívida 18): Automações numa leitura — a página da lista (plt_fn_automacoes) ou a automação aberta (plt_fn_automacao), com a recusa delas para quem não é o super admin; a pedido, os cadastros que os blocos usam: as etapas ativas e as pessoas ativas (id e nome). Com p_so_cadastros (a automação nova aberta direto pelo endereço), só os cadastros — sem dado de automação nenhum.';

-- ----------------------------------------------------------------------------
-- 5 · Controle de tempo → o bloco "Desligar o tempo" (aberto no clique)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_tempo_desligar_abertura()
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'usuarios', coalesce((
      select jsonb_agg(jsonb_build_object('id', u.id, 'nome', u.nome) order by u.nome, u.id)
        from public.plt_usuarios u
       where u.conta_tablet = false), '[]'::jsonb),
    'horarios', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', h.id, 'escopo', h.escopo, 'setor_id', h.setor_id, 'usuario_id', h.usuario_id,
               'dia_semana', h.dia_semana, 'hora_inicio', h.hora_inicio, 'hora_fim', h.hora_fim)
             order by h.escopo, h.dia_semana, h.hora_inicio, h.id)
        from public.plt_horarios_funcionamento h), '[]'::jsonb),
    'pausas', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.inicio desc, p.id desc)
        from (select pt.id, pt.escopo, pt.setor_id, pt.usuario_id, pt.inicio, pt.fim, pt.retroativa,
                     pt.motivo, pt.criado_por, pt.criado_em
                from public.plt_pausas_tempo pt
               order by pt.inicio desc, pt.id desc
               limit 50) p), '[]'::jsonb));
$$;

comment on function public.plt_fn_tempo_desligar_abertura() is
  'SESSAO-55 (Lei §3 — 1 requisição por clique): o bloco "Desligar o tempo" do Controle de tempo numa leitura — os nomes das pessoas (sem a conta de tablet), os horários de funcionamento e as 50 últimas pausas. Security invoker: a RLS decide como na leitura direta.';

revoke all on function public.plt_fn_equipe_abertura() from public, anon;
revoke all on function public.plt_fn_api_abertura() from public, anon;
revoke all on function public.plt_fn_caminhoes_abertura(boolean, boolean) from public, anon;
revoke all on function public.plt_fn_automacoes_abertura(bigint, integer, integer, boolean, boolean, boolean) from public, anon;
revoke all on function public.plt_fn_tempo_desligar_abertura() from public, anon;
grant execute on function public.plt_fn_equipe_abertura() to authenticated;
grant execute on function public.plt_fn_api_abertura() to authenticated;
grant execute on function public.plt_fn_caminhoes_abertura(boolean, boolean) to authenticated;
grant execute on function public.plt_fn_automacoes_abertura(bigint, integer, integer, boolean, boolean, boolean) to authenticated;
grant execute on function public.plt_fn_tempo_desligar_abertura() to authenticated;

-- fim do item 3 da SESSAO-55
