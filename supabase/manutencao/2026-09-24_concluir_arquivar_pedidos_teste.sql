-- ============================================================================
-- MANUTENÇÃO · 24/09/2026 — pedidos de TESTE 13107 e 13196
-- Sessão: SESSAO-23 (ordem do dono, 23/09: "devem ser escondidos e dados como
-- concluídos, eles foram usados pra testes")
--
-- Os dois estão "Entregue" no Tiny mas com a unidade (1/1) viva na FURAÇÃO
-- desde 21/09 — eram teste. O gesto sancionado da casa (RNF-05/E-26): tudo por
-- EVENTO, origem 'api' (lote sem autor), nada editado à mão:
--   1. movimentacao_setor → ESTOQUE  (a unidade fica CONCLUÍDA — terminal)
--   2. card_arquivado                (some das listas; a história fica)
-- Efeito colateral esperado: a chegada em ESTOQUE notifica os admins (D-25) —
-- 2 avisos, um por peça.
-- Rodado em produção em 24/09/2026, logo antes de aplicar a migration 35.
-- ============================================================================

do $$
declare
  v_numero integer;
  v_card   public.plt_cards%rowtype;
  v_estoque bigint;
  v_feitos integer := 0;
begin
  select s.id into v_estoque from public.plt_setores s where s.codigo = 'estoque';

  foreach v_numero in array array[13107, 13196] loop
    select c.* into v_card
      from public.plt_cards c
      join public.pedidos p on p.id = c.pedido_id
     where p.numero = v_numero
       and c.tipo = 'unidade'
       and c.arquivado_em is null
       and c.concluido_em is null
     limit 1;

    if not found then
      raise notice 'Pedido %: nenhuma unidade viva — nada a fazer.', v_numero;
      continue;
    end if;

    insert into public.plt_eventos
        (card_id, tipo, origem, setor_origem_id, etapa_origem_id, setor_destino_id, observacao)
      values
        (v_card.id, 'movimentacao_setor', 'api',
         v_card.setor_atual_id, v_card.etapa_atual_id, v_estoque,
         'Pedido de teste: concluído por manutenção (ordem do dono, 23/09).');

    insert into public.plt_eventos (card_id, tipo, origem, observacao)
      values (v_card.id, 'card_arquivado', 'api',
              'Pedido de teste: arquivado por manutenção (ordem do dono, 23/09).');

    v_feitos := v_feitos + 1;
    raise notice 'Pedido %: unidade % concluída (ESTOQUE) e arquivada.', v_numero, v_card.id;
  end loop;

  raise notice 'Manutenção terminou: % unidade(s) tratada(s).', v_feitos;
end;
$$;

-- Conferência (esperado: 0 unidades vivas de pedidos encerrados no Tiny)
select count(*) as unidades_vivas_de_encerrados
  from public.plt_cards u
  join public.pedidos p on p.id = u.pedido_id
 where u.tipo = 'unidade' and u.arquivado_em is null and u.concluido_em is null
   and plt_privado.fn_situacao_normalizada(p.situacao) in ('entregue', 'nao_entregue');
