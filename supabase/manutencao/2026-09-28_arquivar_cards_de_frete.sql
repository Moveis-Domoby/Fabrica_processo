-- ============================================================================
-- Ajuste do Frete (D-63) · Manutenção — cards de FRETE que nasceram antes da regra
--
-- Decisão do dono (28/09): "Frete / entrega" não vira card de produção. A
-- migration 39 fecha a porta (gatilho + portas sem frete); este script limpa o
-- que já tinha nascido: em 28/09, só o card "Frete" (1/1) do pedido 13215, na
-- LIMPEZA E EMBALAGEM — card de TESTE (a plataforma ainda não está em uso no
-- galpão; o pedido é real — M-16). Aprovado no plano do ajuste ("Arquivar por
-- evento o card de teste 'Frete' do 13215").
--
-- Tudo por EVENTO, origem `api` (E-26), nada editado à mão — o molde da
-- manutenção de 27/09 (2026-09-27_arquivar_unidades_de_pedidos_entregues.sql):
--   1. card com tempo aberto: movimentação para a FILA do setor — a execução
--      fecha pela regra de sempre e o limite de 1 por pessoa fica livre;
--   2. card_arquivado (some das telas; a história fica).
-- Quem é frete sai da regra única (plt_privado.vw_itens_producao — migration
-- 39), pelo item do pedido a que o card pertence. Idempotente (rodar de novo
-- não faz nada). Depende da migration 39 aplicada.
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
     where c.tipo = 'unidade'
       and c.arquivado_em is null
       and exists (select 1 from plt_privado.vw_itens_producao v
                    where v.pedido_id = c.pedido_id and v.seq = c.item_seq and v.eh_frete)
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
           'Frete não vira card de produção: o tempo aberto fecha antes de arquivar (decisão do dono, 28/09).',
           jsonb_build_object('manutencao', '2026-09-28_arquivar_cards_de_frete'));
    end if;

    insert into public.plt_eventos (card_id, tipo, origem, observacao, dados)
      values (r.id, 'card_arquivado', 'api',
              'Frete não vira card de produção — o pedido fica completo sem ele (decisão do dono, 28/09).',
              jsonb_build_object('manutencao', '2026-09-28_arquivar_cards_de_frete',
                                 'pedido', r.numero));
    v_feitos := v_feitos + 1;
    raise notice 'Card de frete % (pedido %) arquivado.', r.id, r.numero;
  end loop;

  raise notice 'Manutenção terminou: % card(s) de frete arquivado(s).', v_feitos;
end;
$$;

-- Conferência (esperado: 0)
--   select count(*) from public.plt_cards c
--    where c.tipo = 'unidade' and c.arquivado_em is null
--      and exists (select 1 from plt_privado.vw_itens_producao v
--                   where v.pedido_id = c.pedido_id and v.seq = c.item_seq and v.eh_frete);
