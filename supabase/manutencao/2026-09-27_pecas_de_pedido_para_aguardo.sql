-- ============================================================================
-- SESSAO-24 · Manutenção — peças de pedido que ficaram no ESTOQUE vão para
-- Pedidos em aguardo
--
-- Palavras do dono (27/09): "estoque só fica como local final de peça sem
-- dono". Antes da migration 37, a peça pronta de pedido parava no ESTOQUE (a
-- aba Pedidos em aguardo só filtrava). Aqui cada uma vai, por EVENTO, para o
-- lugar dela — origem `api` (o caminho sancionado para lote sem autor — E-26),
-- sem marcação de qualidade (RF-86) e sem aviso (vinda de outro fim de linha
-- não é produção nova). Peça de pedido CANCELADO não se move: ela perde o
-- pedido pela regra da migration 37.
--
-- Idempotente: só move o que ainda está no ESTOQUE com pedido vivo.
-- Rodar só com o OK do dono.
-- ============================================================================

insert into public.plt_eventos
    (card_id, tipo, origem, setor_origem_id, etapa_origem_id, setor_destino_id,
     observacao, dados)
select c.id, 'movimentacao_setor', 'api', c.setor_atual_id, c.etapa_atual_id,
       (select s2.id from public.plt_setores s2 where s2.codigo = 'aguardo'),
       'Peça de pedido: o fim de linha dela agora é Pedidos em aguardo — o ESTOQUE fica só com peça sem dono.',
       jsonb_build_object('manutencao', '2026-09-27_pecas_de_pedido_para_aguardo')
  from public.plt_cards c
  join public.plt_setores s on s.id = c.setor_atual_id and s.codigo = 'estoque'
 where c.tipo = 'unidade'
   and c.pedido_id is not null
   and c.arquivado_em is null
   and not plt_privado.fn_pedido_cancelado(c.pedido_id)
   and exists (select 1 from public.plt_setores s3 where s3.codigo = 'aguardo')
 order by c.id;
