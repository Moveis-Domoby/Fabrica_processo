-- ============================================================================
-- SESSAO-24 · Manutenção — unidades em produção de pedidos já ENTREGUES no Tiny
--
-- OK do dono (27/09): "Arquivar as duas" — a 518 (pedido 13257, MONTAGEM) e a
-- 537 (pedido 13236, CNC, com tempo aberto desde 24/09). É a mesma regra das
-- peças do ESTOQUE ("se já foi entregue, não deve nem aparecer mais aí"). O
-- dono lembrou na mesma conversa: a plataforma ainda não está em uso — os
-- cards são teste; os pedidos são reais.
--
-- Tudo por EVENTO, origem `api` (E-26), nada editado à mão:
--   1. card com tempo aberto: movimentação para a FILA do setor — a execução
--      fecha pela regra de sempre (encerramento = movimentação) e o limite de
--      1 por pessoa fica livre para quem tinha iniciado;
--   2. card_arquivado (some das telas; a história fica).
-- Só as duas que o dono aprovou, e só se continuarem vivas e com o pedido
-- "Entregue". Idempotente (rodar de novo não faz nada).
-- ============================================================================
do $$
declare
  r        record;
  v_fila   bigint;
  v_feitos integer := 0;
begin
  for r in
    select c.id, c.setor_atual_id, c.etapa_atual_id, c.executor_atual_id, p.numero
      from public.plt_cards c
      join public.pedidos p on p.id = c.pedido_id
     where c.id in (518, 537)
       and c.tipo = 'unidade'
       and c.arquivado_em is null
       and plt_privado.fn_situacao_normalizada(p.situacao) = 'entregue'
     order by c.id
  loop
    if r.executor_atual_id is not null then
      select e.id into v_fila
        from public.plt_etapas e
       where e.setor_id = r.setor_atual_id and e.eh_fila and e.ativa
       order by e.ordem, e.id
       limit 1;
      insert into public.plt_eventos
          (card_id, tipo, origem, setor_origem_id, etapa_origem_id,
           setor_destino_id, etapa_destino_id, observacao, dados)
        values
          (r.id, 'movimentacao_etapa', 'api', r.setor_atual_id, r.etapa_atual_id,
           r.setor_atual_id, v_fila,
           'Pedido já entregue no Tiny: o tempo aberto fecha antes de arquivar (ordem do dono, 27/09).',
           jsonb_build_object('manutencao', '2026-09-27_arquivar_unidades_de_pedidos_entregues'));
    end if;

    insert into public.plt_eventos (card_id, tipo, origem, observacao, dados)
      values (r.id, 'card_arquivado', 'api',
              'Pedido já entregue no Tiny — a peça não aparece mais (ordem do dono, 27/09).',
              jsonb_build_object('manutencao', '2026-09-27_arquivar_unidades_de_pedidos_entregues',
                                 'pedido', r.numero));
    v_feitos := v_feitos + 1;
    raise notice 'Unidade % (pedido %) arquivada.', r.id, r.numero;
  end loop;

  raise notice 'Manutenção terminou: % unidade(s) arquivada(s).', v_feitos;
end;
$$;

-- Conferência (esperado: 0 unidades vivas de pedido entregue fora dos fins de linha)
--   select count(*) from public.plt_cards c
--     join public.pedidos p on p.id = c.pedido_id
--     join public.plt_setores s on s.id = c.setor_atual_id
--    where c.tipo = 'unidade' and c.arquivado_em is null and s.papel_no_fluxo <> 'terminal'
--      and plt_privado.fn_situacao_normalizada(p.situacao) = 'entregue';
