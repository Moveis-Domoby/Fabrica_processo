-- ============================================================================
-- SESSAO-55 · item 1 — o trabalho DA PESSOA numa leitura (dívida 20 da Lei §14)
-- ============================================================================
-- O aviso do trabalho da pessoa (canal pessoal, evento 'meu_trabalho') fazia a
-- tela reler 3 consultas — as tarefas, a bolinha (execuções abertas) e os cards
-- delegados — e, no Meu Painel, mais as tarefas do Sistema; nos Meus afazeres,
-- mais as subtarefas (para o "2/5") e, em cascata, o número dos pedidos.
--
-- plt_fn_meu_trabalho(p_tela, p_abrir) devolve numa chamada só o que a tela
-- que está aberta mostra:
--   · 'bolha'    — as tarefas e as execuções abertas (a bolinha percorre a
--                  plataforma inteira; é só isso que ela mostra);
--   · 'painel'   — + os cards delegados e as tarefas do Sistema dos setores da
--                  pessoa; com p_abrir (a tela abrindo sem nada guardado), a
--                  fila de prioridade e a 1ª página das metas;
--   · 'afazeres' — + os cards delegados, o contador de subtarefas de cada tarefa
--                  (pronto do banco — Lei §3.4) e o número dos pedidos dos cards.
--
-- NADA de regra nova: cada pedaço é a MESMA leitura de antes (as mesmas colunas
-- e os mesmos filtros de plt_fn_abertura e das consultas da tela). A porta é
-- security invoker — a RLS de plt_tarefas e plt_cards decide como sempre (a
-- tarefa pessoal privada continua só do dono — D-51/D-95); as portas chamadas
-- por dentro (plt_fn_minhas_execucoes, plt_fn_metas_painel, plt_fn_pedidos_kanban)
-- seguem com os gates delas.
--
-- Função NOVA (nenhuma recriada). Só leitura: STABLE.
-- ============================================================================
set local lock_timeout = '5s';

create or replace function public.plt_fn_meu_trabalho(p_tela text default 'bolha', p_abrir boolean default false)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id      uuid;
  v_tela    text := case when p_tela in ('painel', 'afazeres') then p_tela else 'bolha' end;
  v_setores bigint[];
  v_tarefas jsonb;
  v_maes    bigint[];
  v_cards   jsonb;
  v_pedidos bigint[];
  v_ret     jsonb;
begin
  select u.id into v_id
    from public.plt_usuarios u
   where u.auth_user_id = (select auth.uid()) and u.ativo
   limit 1;

  v_ret := jsonb_build_object(
    'agora_ms', floor(extract(epoch from clock_timestamp()) * 1000)::bigint,
    'tela', v_tela);
  if v_id is null then
    return v_ret || jsonb_build_object('tarefas', '[]'::jsonb, 'execucoes', '[]'::jsonb);
  end if;

  -- as tarefas abertas da pessoa (a mesma leitura da abertura do app)
  select coalesce(jsonb_agg(to_jsonb(t) order by t.criada_em, t.id), '[]'::jsonb),
         coalesce(array_agg(t.id), '{}')
    into v_tarefas, v_maes
    from (select tt.id, tt.titulo, tt.descricao, tt.card_id, tt.setor_id, tt.responsavel_id, tt.criada_por_id,
                 tt.delegacao, tt.situacao, tt.prazo, tt.iniciada_em, tt.concluida_em, tt.criada_em,
                 tt.tarefa_mae_id, tt.origem, tt.evento_referencia_id, tt.privada, tt.tempo_acumulado
            from public.plt_tarefas tt
           where tt.responsavel_id = v_id and tt.situacao <> 'concluida' and tt.tarefa_mae_id is null) t;

  v_ret := v_ret || jsonb_build_object(
    'tarefas', v_tarefas,
    'execucoes', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.iniciou_em, x.evento_inicio_id)
        from public.plt_fn_minhas_execucoes() x), '[]'::jsonb));

  if v_tela = 'bolha' then
    return v_ret;
  end if;

  -- os cards delegados à pessoa (Meu Painel e Meus afazeres mostram os mesmos)
  select coalesce(jsonb_agg(to_jsonb(c) order by c.desde nulls last, c.id), '[]'::jsonb),
         coalesce(array_agg(distinct c.pedido_id) filter (where c.pedido_id is not null), '{}')
    into v_cards, v_pedidos
    from (select cc.id, cc.tipo, cc.pedido_id, cc.card_pai_id, cc.item_seq, cc.item_codigo, cc.item_descricao,
                 cc.indice_unidade, cc.total_unidades, cc.setor_atual_id, cc.etapa_atual_id, cc.desde,
                 cc.executor_atual_id, cc.responsavel_id, cc.delegado_em, cc.qualidade_atual, cc.concluido_em,
                 cc.pausado_em, cc.liberado_completo_em, cc.produto_tiny_id, cc.etiquetas, cc.parecer_pendente_id
            from public.plt_cards cc
           where cc.responsavel_id = v_id and cc.concluido_em is null and cc.arquivado_em is null) c;
  v_ret := v_ret || jsonb_build_object('cards', v_cards);

  if v_tela = 'painel' then
    select coalesce(array_agg(us.setor_id order by us.setor_id), '{}') into v_setores
      from public.plt_usuario_setores us where us.usuario_id = v_id;
    v_ret := v_ret || jsonb_build_object(
      'setores_chave', array_to_string(v_setores, ','),
      'tarefas_sistema', case when cardinality(v_setores) = 0 then '[]'::jsonb else coalesce((
        select jsonb_agg(to_jsonb(t) order by t.criada_em, t.id)
          from (select tt.id, tt.titulo, tt.descricao, tt.card_id, tt.setor_id, tt.responsavel_id, tt.criada_por_id,
                       tt.delegacao, tt.situacao, tt.prazo, tt.iniciada_em, tt.concluida_em, tt.criada_em,
                       tt.tarefa_mae_id, tt.origem, tt.evento_referencia_id, tt.privada, tt.tempo_acumulado
                  from public.plt_tarefas tt
                 where tt.origem = 'sistema' and tt.setor_id = any (v_setores) and tt.situacao <> 'concluida') t), '[]'::jsonb) end);
    -- a tela abrindo sem nada guardado: a ordem da fila e a 1ª página das metas
    -- (quem já tem os dois guardados não pede de novo — o aviso não os relê)
    if p_abrir then
      v_ret := v_ret || jsonb_build_object(
        'fila_prioridade', coalesce((select u.fila_prioridade from public.plt_usuarios u where u.id = v_id), '[]'::jsonb),
        'metas', coalesce((
          select jsonb_agg(to_jsonb(m) - 'ordinality' order by m.ordinality)
            from public.plt_fn_metas_painel(false, 20, 0) with ordinality as m), '[]'::jsonb));
    end if;
  else
    -- Meus afazeres: o "2/5" de cada tarefa, pronto (antes a tela baixava todas
    -- as subtarefas para contar), e o número do pedido de cada card (antes uma
    -- 2ª leitura em cascata, depois dos cards)
    v_ret := v_ret || jsonb_build_object(
      'subtarefas', case when cardinality(v_maes) = 0 then '[]'::jsonb else coalesce((
        select jsonb_agg(jsonb_build_object('mae_id', s.mae_id, 'total', s.total, 'feitas', s.feitas) order by s.mae_id)
          from (select st.tarefa_mae_id as mae_id, count(*) as total,
                       count(*) filter (where st.situacao = 'concluida') as feitas
                  from public.plt_tarefas st
                 where st.tarefa_mae_id = any (v_maes)
                 group by st.tarefa_mae_id) s), '[]'::jsonb) end,
      'pedidos', case when cardinality(v_pedidos) = 0 then '[]'::jsonb else coalesce((
        select jsonb_agg(jsonb_build_object('pedido_id', p.pedido_id, 'numero', p.numero) order by p.pedido_id)
          from public.plt_fn_pedidos_kanban(null, false, v_pedidos, 100, 0) p), '[]'::jsonb) end);
  end if;

  return v_ret;
end;
$$;

comment on function public.plt_fn_meu_trabalho(text, boolean) is
  'SESSAO-55 (Lei §2 — dívida 20): o trabalho da pessoa numa leitura — as tarefas abertas e as execuções abertas (a bolinha); p_tela = painel soma os cards delegados e as tarefas do Sistema dos setores dela (com p_abrir, a fila de prioridade e a 1ª página das metas); p_tela = afazeres soma os cards delegados, o contador de subtarefas por tarefa e o número dos pedidos dos cards. Security invoker: a RLS decide como nas leituras de antes.';

revoke all on function public.plt_fn_meu_trabalho(text, boolean) from public, anon;
grant execute on function public.plt_fn_meu_trabalho(text, boolean) to authenticated;

-- fim do item 1 da SESSAO-55
