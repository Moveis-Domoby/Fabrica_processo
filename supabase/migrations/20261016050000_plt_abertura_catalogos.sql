-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 80 — A ABERTURA TRAZ OS CATÁLOGOS
-- DE ETIQUETAS E CAMPOS (SESSAO-32 · §1.1 · Lei §2)
--
-- Conferido no site (16/10): abrir a plataforma direto num quadro de setor
-- fazia 4 leituras — a abertura, o quadro e os dois catálogos (etiquetas e
-- campos customizados), pequenos e quase parados. Eles passam a vir na
-- abertura, com o mesmo recorte e a mesma ordem das leituras soltas (RLS de
-- quem chama — security invoker). plt_fn_abertura recriada POR INTEIRO a
-- partir da migration 78 (E-24), só com as duas chaves a mais.
-- Nada nas tabelas da integração.
-- ============================================================================

create or replace function public.plt_fn_abertura(p_rota text default null, p_meu_painel boolean default false)
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
begin
  select u.id,
         jsonb_build_object(
           'id', u.id, 'nome', u.nome, 'usuario', u.usuario, 'email', u.email, 'telefone', u.telefone,
           'matricula', u.matricula, 'papel', u.papel, 'senha_padrao', u.senha_padrao, 'ativo', u.ativo,
           'arquivado_em', u.arquivado_em, 'tema', u.tema, 'foto_caminho', u.foto_caminho,
           'modulos', u.modulos, 'super_admin', u.super_admin)
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
    perform public.plt_fn_registrar_log('navegacao', p_rota, '{}'::jsonb);
  end if;

  return v_ret;
end;
$$;

comment on function public.plt_fn_abertura(text, boolean) is
  'SESSAO-32 (Lei §2): a primeira abertura do app numa requisição — perfil, vínculos, setores, os 20 avisos do sino, a 1ª página do chat, a bolinha, os catálogos de etiquetas e campos (migration 80) e (p_meu_painel) os dados do Meu Painel; carimba a presença e registra a navegação da 1ª rota. Security invoker: vê o que as consultas soltas de antes viam (RLS). agora_ms = de quando pedir a reprise do canal pessoal.';
