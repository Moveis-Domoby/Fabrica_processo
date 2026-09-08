-- ============================================================================
-- MANUTENÇÃO (não é migration) · SESSAO-15 · 08/09/2026
-- Arquivar em massa os cards de pedidos HISTÓRICOS que nasceram no PCP quando
-- a reaplicação da S13 ressuscitou o gatilho antigo sem guarda (E-24) e o
-- backfill rodou por cima (~163 cards em 01/09). Aprovado pelo dono em 01/09
-- ("pode remover") e registrado na D-45.
--
-- Critério CONSERVADOR (confirmado no checkpoint de 08/09):
--   · card de PEDIDO vivo (não arquivado)
--   · sem NENHUMA unidade liberada (ninguém produziu nada dele)
--   · nascido por automação (o gatilho — nunca um card criado à mão)
--   · pedido encerrado no Tiny: Entregue / Não entregue / Cancelado
--     (situação NORMALIZADA — o Tiny grava a descrição)
-- Pedido histórico ainda "Em aberto"/"Preparando envio" FICA — pode ser venda viva.
--
-- É exclusão LÓGICA (evento card_arquivado, origem api, sem pessoa — o trigger
-- fn_validar_api só aceita arquivar sem pessoa com origem api; automacao é recusada):
-- nada some da história (RNF-05). Passo 1 conta; passo 2 executa.
-- ============================================================================

-- PASSO 1 · contar (rodar primeiro, mostrar o número ao dono)
select count(*) as cards_a_arquivar
  from public.plt_cards c
  join public.pedidos p on p.id = c.pedido_id
 where c.tipo = 'pedido'
   and c.arquivado_em is null
   and plt_privado.fn_situacao_normalizada(p.situacao) in ('entregue', 'nao_entregue', 'cancelado')
   and not exists (select 1 from public.plt_cards u
                    where u.pedido_id = c.pedido_id and u.tipo = 'unidade')
   and exists (select 1 from public.plt_eventos e
                where e.card_id = c.id and e.tipo = 'card_criado' and e.origem = 'automacao');

-- PASSO 2 · arquivar (só depois do OK)
insert into public.plt_eventos (card_id, tipo, origem, setor_origem_id, observacao, dados)
select c.id, 'card_arquivado', 'api', c.setor_atual_id,
       'Arquivado em massa: pedido histórico já encerrado no Tiny (limpeza do E-24, aprovada na SESSAO-15).',
       jsonb_build_object('motivo', 'limpeza_historico_e24', 'situacao_tiny', p.situacao, 'numero', p.numero)
  from public.plt_cards c
  join public.pedidos p on p.id = c.pedido_id
 where c.tipo = 'pedido'
   and c.arquivado_em is null
   and plt_privado.fn_situacao_normalizada(p.situacao) in ('entregue', 'nao_entregue', 'cancelado')
   and not exists (select 1 from public.plt_cards u
                    where u.pedido_id = c.pedido_id and u.tipo = 'unidade')
   and exists (select 1 from public.plt_eventos e
                where e.card_id = c.id and e.tipo = 'card_criado' and e.origem = 'automacao');
