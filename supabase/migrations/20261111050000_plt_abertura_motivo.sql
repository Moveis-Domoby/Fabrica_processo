-- ============================================================================
-- SESSAO-48 · frente 5 — a trilha diz POR QUE a página abriu
-- ============================================================================
-- O dono (11/11, 01:33): "de tempos em tempos a plataforma atualiza sozinha do
-- nada e recarrega a tela". A trilha de 10/11 mostrava páginas abrindo de novo
-- (o tablet da CNC às 13:58:39 e às 14:38:39, sem PIN; o do FITAMENTO 5 vezes em
-- 20 s logo depois de uma troca de setor; as Entregas de um entregador umas 8
-- vezes no dia) — mas não dizia o porquê de cada abertura.
--
-- A porta de abertura ganha o 3º argumento, p_contexto: o que a página sabe de
-- como foi aberta — o tipo de carga do navegador (navigate | reload |
-- back_forward | prerender), se a aba tinha sido descartada (o navegador a
-- tirou da memória e a recarregou ao voltar), o motivo da própria plataforma
-- quando foi ela que recarregou (versao_nova | versao_nova_botao |
-- pedaco_sumido | troca_setor) e a versão (o código) da página. Vai no registro
-- que ela já escreve (plt_logs_atividade, ação 'navegacao'), com a marca
-- abertura = true. Só a 1ª abertura de cada página manda o contexto: trocar de
-- conta sem recarregar (entrar de novo, a troca vinda de outra aba) é navegação,
-- não abertura. A Auditoria mostra em português ("Abriu a plataforma — …").
--
-- O banco aceita só o que conhece (lista fechada, versão só em hexadecimal):
-- nada do navegador entra cru na trilha.
--
-- Assinatura nova = drop da velha + create da nova (A-12: com o 3º argumento,
-- um create or replace criaria uma SOBRECARGA). O 3º argumento tem padrão: a
-- tela de antes (2 argumentos) segue funcionando com este banco; a tela nova,
-- se chegar antes da migration, tenta de novo sem ele (src/autenticacao/abertura.ts).
-- Nenhuma função do banco chama esta porta (quem-chama.mjs: ninguém).
--
-- Recriada a partir da vigente (20261022050010_plt_tempo_util_standby.sql, 4 definições ao todo),
-- extração + 3 trocas conferidas (A-97). md5 do corpo de origem: 348b13f75671fbe420c9750cb6d925bc
-- (conferir com md5(prosrc) do banco vivo antes de aplicar — A-96).
-- ============================================================================
set local lock_timeout = '5s';

drop function if exists public.plt_fn_abertura(text, boolean);

-- (recriada da vigente em 20261022050010_plt_tempo_util_standby.sql)
create or replace function public.plt_fn_abertura(
  p_rota text default null, p_meu_painel boolean default false, p_contexto jsonb default null)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id      uuid;
  v_perfil  jsonb;
  v_setores bigint[];
  v_ret     jsonb;
  v_ctx     jsonb := '{}'::jsonb;
begin
  select u.id,
         jsonb_build_object(
           'id', u.id, 'nome', u.nome, 'usuario', u.usuario, 'email', u.email, 'telefone', u.telefone,
           'matricula', u.matricula, 'papel', u.papel, 'senha_padrao', u.senha_padrao, 'ativo', u.ativo,
           'arquivado_em', u.arquivado_em, 'tema', u.tema, 'foto_caminho', u.foto_caminho,
           'modulos', u.modulos, 'super_admin', u.super_admin,
           -- SESSAO-36: a conta de tablet vive só no /tablet; o liga/desliga do auxílio
           'conta_tablet', u.conta_tablet, 'pode_auxiliar', u.pode_auxiliar)
    into v_id, v_perfil
    from public.plt_usuarios u
   where u.auth_user_id = auth.uid() and u.ativo
   limit 1;

  -- O instante da leitura: o canal pessoal entra pedindo a reprise desde aqui
  -- (nada que saia entre ler e ouvir se perde).
  v_ret := jsonb_build_object('agora_ms', floor(extract(epoch from clock_timestamp()) * 1000)::bigint);
  if v_id is null then
    return v_ret || jsonb_build_object('perfil', null, 'vinculos', '[]'::jsonb);
  end if;

  if p_rota is not null and length(p_rota) > 300 then
    p_rota := left(p_rota, 300);
  end if;

  select coalesce(array_agg(us.setor_id order by us.setor_id), '{}') into v_setores
    from public.plt_usuario_setores us where us.usuario_id = v_id;

  v_ret := v_ret || jsonb_build_object(
    'perfil', v_perfil,
    'vinculos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'setor_id', us.setor_id, 'lider_do_setor', us.lider_do_setor,
               'setor', case when s.id is null then null
                             else jsonb_build_object('id', s.id, 'nome', s.nome, 'codigo', s.codigo) end)
             order by us.setor_id)
        from public.plt_usuario_setores us
        left join public.plt_setores s on s.id = us.setor_id
       where us.usuario_id = v_id), '[]'::jsonb),
    'setores', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'codigo', s.codigo, 'nome', s.nome, 'papel_no_fluxo', s.papel_no_fluxo,
               'ordem', s.ordem, 'ativo', s.ativo, 'limite_execucoes_por_pessoa', s.limite_execucoes_por_pessoa,
               'modo_delegacao', s.modo_delegacao, 'qualidade_envio_tipos', s.qualidade_envio_tipos,
               'qualidade_recebimento_tipos', s.qualidade_recebimento_tipos)
             order by s.ordem, s.id)
        from public.plt_setores s where s.ativo), '[]'::jsonb),
    'avisos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', a.id, 'tipo', a.tipo, 'titulo', a.titulo, 'corpo', a.corpo, 'card_id', a.card_id,
               'lida_em', a.lida_em, 'criada_em', a.criada_em)
             order by a.criada_em desc, a.id desc)
        from (select n.id, n.tipo, n.titulo, n.corpo, n.card_id, n.lida_em, n.criada_em
                from public.plt_notificacoes n
               where n.destinatario_id = v_id
               order by n.criada_em desc, n.id desc limit 20) a), '[]'::jsonb),
    'conversas', coalesce((
      select jsonb_agg(to_jsonb(c) - 'ordinality' order by c.ordinality)
        from public.plt_fn_chat_conversas(null::timestamptz, null::bigint, 5, null::bigint) with ordinality as c), '[]'::jsonb),
    'tarefas', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.criada_em, t.id)
        from (select tt.id, tt.titulo, tt.descricao, tt.card_id, tt.setor_id, tt.responsavel_id, tt.criada_por_id,
                     tt.delegacao, tt.situacao, tt.prazo, tt.iniciada_em, tt.concluida_em, tt.criada_em,
                     tt.tarefa_mae_id, tt.origem, tt.evento_referencia_id, tt.privada, tt.tempo_acumulado
                from public.plt_tarefas tt
               where tt.responsavel_id = v_id and tt.situacao <> 'concluida' and tt.tarefa_mae_id is null) t), '[]'::jsonb),
    'execucoes', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.iniciou_em, x.evento_inicio_id)
        from public.plt_fn_minhas_execucoes() x), '[]'::jsonb),
    -- SESSAO-38 (D-172): a régua do tempo útil (o horário de cada setor e as
    -- pausas de setor) — o card conta só o expediente, no aparelho
    'regua_tempo', public.plt_fn_regua_tempo(),
    -- migration 80: os catálogos que os quadros, o PCP, os pedidos e a janela
    -- do card usam (antes: 2 leituras a mais ao abrir qualquer um deles)
    'etiquetas', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'nome', e.nome, 'cor', e.cor, 'arquivada_em', e.arquivada_em)
             order by e.nome)
        from public.plt_etiquetas e), '[]'::jsonb),
    'campos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'nome', c.nome, 'tipo', c.tipo, 'opcoes', c.opcoes, 'em_pecas', c.em_pecas,
               'em_pedidos', c.em_pedidos, 'em_avulsos', c.em_avulsos, 'arquivado_em', c.arquivado_em)
             order by c.nome)
        from public.plt_campos c), '[]'::jsonb));

  if p_meu_painel then
    v_ret := v_ret || jsonb_build_object('meu_painel', jsonb_build_object(
      'cards', coalesce((
        select jsonb_agg(to_jsonb(c) order by c.desde nulls last, c.id)
          from (select cc.id, cc.tipo, cc.pedido_id, cc.card_pai_id, cc.item_seq, cc.item_codigo, cc.item_descricao,
                       cc.indice_unidade, cc.total_unidades, cc.setor_atual_id, cc.etapa_atual_id, cc.desde,
                       cc.executor_atual_id, cc.responsavel_id, cc.delegado_em, cc.qualidade_atual, cc.concluido_em,
                       cc.pausado_em, cc.liberado_completo_em, cc.produto_tiny_id, cc.etiquetas, cc.parecer_pendente_id
                  from public.plt_cards cc
                 where cc.responsavel_id = v_id and cc.concluido_em is null and cc.arquivado_em is null) c), '[]'::jsonb),
      'setores_chave', array_to_string(v_setores, ','),
      'tarefas_sistema', case when cardinality(v_setores) = 0 then '[]'::jsonb else coalesce((
        select jsonb_agg(to_jsonb(t) order by t.criada_em, t.id)
          from (select tt.id, tt.titulo, tt.descricao, tt.card_id, tt.setor_id, tt.responsavel_id, tt.criada_por_id,
                       tt.delegacao, tt.situacao, tt.prazo, tt.iniciada_em, tt.concluida_em, tt.criada_em,
                       tt.tarefa_mae_id, tt.origem, tt.evento_referencia_id, tt.privada, tt.tempo_acumulado
                  from public.plt_tarefas tt
                 where tt.origem = 'sistema' and tt.setor_id = any (v_setores) and tt.situacao <> 'concluida') t), '[]'::jsonb) end,
      'fila_prioridade', coalesce((select u.fila_prioridade from public.plt_usuarios u where u.id = v_id), '[]'::jsonb),
      'metas', coalesce((
        select jsonb_agg(to_jsonb(m) - 'ordinality' order by m.ordinality)
          from public.plt_fn_metas_painel(false, 20, 0) with ordinality as m), '[]'::jsonb)));
  end if;

  -- O gesto de abrir: o registro da navegação da 1ª rota (que já carimba a
  -- presença) — o que a casca gravava em duas requisições a mais. Sem rota é a
  -- releitura do perfil depois de um gesto (editar o perfil, o tema): nada a
  -- gravar — a presença já veio do próprio gesto.
  if p_rota is not null and length(btrim(p_rota)) > 0 then
    -- ↩️ SESSAO-48 (frente 5): a 1ª abertura de cada PÁGINA diz por que abriu —
    -- o navegador (navegou, atualizou, voltou; a aba descartada) e a própria
    -- plataforma (versão nova, pedaço sumido, troca de setor). Só o que o banco
    -- conhece entra na trilha; sem contexto (a tela de antes ou trocar de conta
    -- sem recarregar), '{}' como sempre — não é abertura.
    if jsonb_typeof(p_contexto) = 'object' then
      v_ctx := jsonb_build_object('abertura', true)
        || case when p_contexto->>'carga' in ('navigate', 'reload', 'back_forward', 'prerender')
                then jsonb_build_object('carga', p_contexto->>'carga') else '{}'::jsonb end
        || case when p_contexto->'descartada' = 'true'::jsonb
                then jsonb_build_object('descartada', true) else '{}'::jsonb end
        || case when p_contexto->>'recarga' in ('versao_nova', 'versao_nova_botao', 'pedaco_sumido', 'troca_setor')
                then jsonb_build_object('recarga', p_contexto->>'recarga') else '{}'::jsonb end
        || case when jsonb_typeof(p_contexto->'versao') = 'string' and (p_contexto->>'versao') ~ '^[0-9a-f]{6,40}$'
                then jsonb_build_object('versao', p_contexto->>'versao') else '{}'::jsonb end;
    end if;
    perform public.plt_fn_registrar_log('navegacao', p_rota, v_ctx);
  end if;

  return v_ret;
end;
$$;

comment on function public.plt_fn_abertura(text, boolean, jsonb) is
  'SESSAO-32 (Lei §2): a primeira abertura do app numa requisição — perfil, vínculos, setores, os 20 avisos do sino, a 1ª página do chat, a bolinha, os catálogos de etiquetas e campos, a régua do tempo e (p_meu_painel) os dados do Meu Painel; com rota, grava a navegação da 1ª tela (e a presença). SESSAO-36: o perfil diz se a sessão é a conta de tablet e se a pessoa pode auxiliar. SESSAO-48 (frente 5): p_contexto (só na 1ª abertura de cada página) diz por que a página abriu — carga, aba descartada, o motivo da própria plataforma, a versão — e vai no registro, com abertura = true.';

revoke all on function public.plt_fn_abertura(text, boolean, jsonb) from public, anon;
grant execute on function public.plt_fn_abertura(text, boolean, jsonb) to authenticated;

-- fim da frente 5 da SESSAO-48
