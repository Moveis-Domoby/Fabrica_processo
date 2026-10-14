-- ============================================================================
-- SESSAO-31 · etapa A · Manutenção — a EXPEDIÇÃO da LIMPEZA E EMBALAGEM passa
-- a CONCLUIR a produção (D-127) e as peças que a equipe já tinha posto lá vão
-- para Pedidos em aguardo.
--
-- Palavras do dono (13–14/10): "o concluir card do setor de limpeza e
-- embalagem deve ser a movimentação para a etapa expedição" · sobre as peças
-- que já estavam na EXPEDIÇÃO: "Okay" (mandar para Pedidos em aguardo).
--
-- É DADO do dono (a rota da etapa — D-60): por isso mora aqui e não na
-- migration (reaplicar migration nunca desfaz edição do admin em Setores e
-- etapas). Tudo por EVENTO, origem `api` (o caminho sancionado para lote sem
-- autor — E-26). Idempotente: só marca a etapa se nenhuma da LIMPEZA E
-- EMBALAGEM conclui ainda, e só move peça viva que ainda está na EXPEDIÇÃO.
-- Retrato de 14/10 00:42 (Natal): 6 peças (pedidos 13177 ×5 e 13207 ×1, os
-- dois "preparando envio" no Tiny, nenhuma marcada), 0 tarefas do Sistema
-- abertas.
-- ============================================================================

set local lock_timeout = '5s';

-- 1 · A EXPEDIÇÃO conclui (só se a LIMPEZA E EMBALAGEM ainda não tem etapa que conclui).
update public.plt_etapas e
   set conclui_producao = true
  from public.plt_setores s
 where s.id = e.setor_id
   and s.codigo = 'limpeza_embalagem'
   and e.nome = 'EXPEDIÇÃO'
   and e.ativa
   and not exists (select 1 from public.plt_etapas x
                    where x.setor_id = s.id and x.conclui_producao);

-- 2 · As peças vivas que já estavam na EXPEDIÇÃO: o lugar delas é Pedidos em
--     aguardo (pedido vivo) — ou o ESTOQUE, sem dono (sem pedido ou cancelado).
insert into public.plt_eventos
    (card_id, tipo, origem, setor_origem_id, etapa_origem_id, setor_destino_id,
     observacao, dados)
select c.id, 'movimentacao_setor', 'api', c.setor_atual_id, c.etapa_atual_id,
       (select s2.id from public.plt_setores s2
         where s2.codigo = case when c.pedido_id is null
                                     or plt_privado.fn_pedido_cancelado(c.pedido_id)
                                then 'estoque' else 'aguardo' end),
       'A EXPEDIÇÃO passou a concluir a produção (pedido do dono, 14/10) — a peça que já estava lá foi concluída.',
       jsonb_build_object('manutencao', '2026-10-14_expedicao_conclui')
  from public.plt_cards c
  join public.plt_etapas e on e.id = c.etapa_atual_id and e.nome = 'EXPEDIÇÃO'
  join public.plt_setores s on s.id = e.setor_id and s.codigo = 'limpeza_embalagem'
 where c.tipo = 'unidade'
   and c.arquivado_em is null
   and c.setor_atual_id = s.id
   and coalesce(c.qualidade_atual, 'perfeito') = 'perfeito'
 order by c.id;

-- Conferência (o retrato vai para o handoff):
--   select c.id, p.numero, s.codigo as lugar from public.plt_cards c
--     join public.plt_setores s on s.id = c.setor_atual_id
--     left join public.pedidos p on p.id = c.pedido_id
--    where c.id in (508, 509, 511, 512, 513, 514);
