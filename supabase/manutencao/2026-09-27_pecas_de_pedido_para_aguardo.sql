-- ============================================================================
-- SESSAO-24 · Manutenção — as peças de pedido que ficaram no ESTOQUE
--
-- Palavras do dono (27/09): "estoque só fica como local final de peça sem
-- dono" — e, sobre as de pedido já entregue no Tiny, "se já foi entregue, não
-- deve nem aparecer mais aí". Antes da migration 37, a peça pronta de pedido
-- parava no ESTOQUE (a aba Pedidos em aguardo só filtrava). Tudo por EVENTO,
-- origem `api` (o caminho sancionado para lote sem autor — E-26), nada
-- editado à mão:
--   1. pedido já ENTREGUE no Tiny → a peça é ARQUIVADA (some das telas; a
--      história fica) — o mesmo gesto da manutenção de 24/09 (SESSAO-23);
--   2. pedido vivo e peça 🟢 (ou nunca marcada) → Pedidos em aguardo, sem
--      marcação nova e sem aviso (vinda de outro fim de linha não é produção);
--   3. peça 🟡/🔴 de pedido vivo NÃO se move: Pedidos em aguardo só recebe
--      peça perfeita — fica no ESTOQUE para o dono decidir (consertar ou
--      refazer).
-- Peça de pedido CANCELADO no ESTOQUE: nenhuma em 27/09 (conferido antes de
-- rodar); as próximas a regra da migration 37 desvincula sozinha (no
-- cancelamento e na chegada ao ESTOQUE).
--
-- Idempotente: só toca o que ainda está vivo no ESTOQUE com pedido.
-- Rodar só com o OK do dono.
-- ============================================================================

-- 1 · Pedido já entregue no Tiny: a peça some das telas (arquivada por evento).
insert into public.plt_eventos (card_id, tipo, origem, observacao, dados)
select c.id, 'card_arquivado', 'api',
       'Pedido já entregue no Tiny — a peça não aparece mais no ESTOQUE (ordem do dono, 27/09).',
       jsonb_build_object('manutencao', '2026-09-27_pecas_de_pedido_para_aguardo',
                          'pedido', p.numero)
  from public.plt_cards c
  join public.plt_setores s on s.id = c.setor_atual_id and s.codigo = 'estoque'
  join public.pedidos p on p.id = c.pedido_id
 where c.tipo = 'unidade'
   and c.arquivado_em is null
   and plt_privado.fn_situacao_normalizada(p.situacao) = 'entregue'
 order by c.id;

-- 2 · Pedido vivo e peça perfeita: o lugar dela é Pedidos em aguardo.
insert into public.plt_eventos
    (card_id, tipo, origem, setor_origem_id, etapa_origem_id, setor_destino_id,
     observacao, dados)
select c.id, 'movimentacao_setor', 'api', c.setor_atual_id, c.etapa_atual_id,
       (select s2.id from public.plt_setores s2 where s2.codigo = 'aguardo'),
       'Peça de pedido: o fim de linha dela agora é Pedidos em aguardo — o ESTOQUE fica só com peça sem dono.',
       jsonb_build_object('manutencao', '2026-09-27_pecas_de_pedido_para_aguardo')
  from public.plt_cards c
  join public.plt_setores s on s.id = c.setor_atual_id and s.codigo = 'estoque'
  join public.pedidos p on p.id = c.pedido_id
 where c.tipo = 'unidade'
   and c.arquivado_em is null
   and not plt_privado.fn_pedido_cancelado(c.pedido_id)
   and plt_privado.fn_situacao_normalizada(p.situacao) <> 'entregue'
   and coalesce(c.qualidade_atual, 'perfeito') = 'perfeito'
   and exists (select 1 from public.plt_setores s3 where s3.codigo = 'aguardo')
 order by c.id;

-- Conferência (o retrato vai para o handoff):
--   select c.id, p.numero, p.situacao, c.qualidade_atual, s.nome as lugar,
--          c.arquivado_em is not null as arquivada
--     from public.plt_cards c
--     join public.plt_setores s on s.id = c.setor_atual_id
--     join public.pedidos p on p.id = c.pedido_id
--    where c.tipo = 'unidade' and s.codigo in ('estoque', 'aguardo')
--    order by c.id;
