-- ============================================================================
-- SESSAO-30 · Manutenção — fechar aqui o que já está "Entregue" no Tiny (D-113)
-- + arquivar a peça 502 (teste, danificada, parada no ESTOQUE — resposta 7)
--
-- O dono (08/10): "se está entregue no Tiny, aqui deve estar como entregue
-- também; para ser entregue no Tiny é porque a peça do pedido não existe mais
-- no galpão e não deve mais estar nada referente a ele em aberto aqui".
--
-- Roda DEPOIS da migration 56 (usa plt_privado.fn_fechar_pedido — a mesma
-- regra que o aviso do Tiny passa a disparar sozinho daqui em diante). Pega
-- todo pedido "Entregue" no Tiny que ainda tem algo aberto aqui: card de
-- pedido vivo, peça viva ou peça do estoque reservada para ele. Inclui os 18
-- da carga de teste das rotas de 03/10 (o handoff da S28 já mandava arquivá-
-- los) e as peças paradas de 13108/13114 (entrega registrada, peça viva).
--
-- Tudo por evento, assinado "Sistema" (origem da integração, fonte Tiny) —
-- nada vai ao Tiny, nada se apaga. Idempotente: rodar de novo não faz nada.
--
-- PASSO 1 (só leitura): a prévia — o que vai ser fechado.
-- PASSO 2: o bloco que fecha (só com o OK do dono).
-- ============================================================================

-- PASSO 1 · prévia (só leitura)
--   with alvo as (
--     select pc.id as card_id, p.numero,
--            pc.arquivado_em is null as card_vivo,
--            pc.lancado_rotas_em is not null as lancado,
--            exists (select 1 from public.plt_eventos e where e.card_id = pc.id and e.tipo = 'pedido_entregue') as ja_entregue,
--            (select count(*) from public.plt_cards u where u.pedido_id = pc.pedido_id and u.tipo = 'unidade' and u.arquivado_em is null) as pecas_vivas,
--            (select count(*) from public.plt_cards r where r.reservada_pedido_id = pc.pedido_id and r.arquivado_em is null) as reservas
--       from public.plt_cards pc
--       join public.pedidos p on p.id = pc.pedido_id
--      where pc.tipo = 'pedido'
--        and plt_privado.fn_situacao_normalizada(p.situacao) = 'entregue'
--   )
--   select count(*) as pedidos, count(*) filter (where card_vivo and not lancado) as saem_do_pcp,
--          count(*) filter (where lancado) as lancados, sum(pecas_vivas) as pecas, sum(reservas) as reservas
--     from alvo
--    where card_vivo or pecas_vivas > 0 or reservas > 0;

-- PASSO 2 · fechar
do $$
declare
  r          record;
  v_res      jsonb;
  v_pedidos  integer := 0;
  v_pecas    integer := 0;
  v_reservas integer := 0;
  v_saiu_pcp integer := 0;
begin
  for r in
    select pc.id as card_id, p.numero
      from public.plt_cards pc
      join public.pedidos p on p.id = pc.pedido_id
     where pc.tipo = 'pedido'
       and plt_privado.fn_situacao_normalizada(p.situacao) = 'entregue'
       -- E-88: o pedido lançado e já entregue fica com o card vivo (é o
       -- registro em ROTAS) — ele não entra de novo numa 2ª rodada.
       and ((pc.arquivado_em is null
             and not exists (select 1 from public.plt_eventos e
                              where e.card_id = pc.id and e.tipo = 'pedido_entregue'))
            or exists (select 1 from public.plt_cards u
                        where u.pedido_id = pc.pedido_id and u.tipo = 'unidade' and u.arquivado_em is null)
            or exists (select 1 from public.plt_cards s
                        where s.reservada_pedido_id = pc.pedido_id and s.arquivado_em is null))
     order by p.numero
  loop
    v_res := plt_privado.fn_fechar_pedido(
               r.card_id, null, 'api',
               'Entregue no Tiny — fechado na limpeza de 08/10 (ordem do dono).', 'tiny');
    if coalesce((v_res ->> 'fechou')::boolean, false) then
      v_pedidos  := v_pedidos + 1;
      v_pecas    := v_pecas + coalesce((v_res ->> 'unidades')::int, 0);
      v_reservas := v_reservas + coalesce((v_res ->> 'reservas')::int, 0);
      v_saiu_pcp := v_saiu_pcp + case when (v_res ->> 'card_saiu_do_pcp')::boolean then 1 else 0 end;
    end if;
  end loop;

  -- A peça 502 (resposta 7 do dono: "pode arquivar") — card de teste da S22,
  -- danificada, de pedido vivo, parada no ESTOQUE (Q-69 / raio-x 1).
  if exists (select 1 from public.plt_cards where id = 502 and arquivado_em is null) then
    insert into public.plt_eventos (card_id, tipo, origem, observacao, dados)
      values (502, 'card_arquivado', 'api',
              'Peça de teste danificada parada no ESTOQUE — arquivada por ordem do dono (08/10).',
              jsonb_build_object('motivo', 'teste', 'manutencao', '2026-10-08_fechar_pedidos_entregues_no_tiny'));
    raise notice 'Peça 502 arquivada.';
  end if;

  raise notice 'Limpeza de 08/10: % pedido(s) fechado(s) — % peça(s) fora das contas, % reserva(s) do estoque, % card(s) saíram do PCP.',
    v_pedidos, v_pecas, v_reservas, v_saiu_pcp;
end;
$$;

-- Conferência (esperado: 0 e 0)
--   select count(*) from public.plt_cards u join public.pedidos p on p.id = u.pedido_id
--    where u.tipo = 'unidade' and u.arquivado_em is null and plt_privado.fn_situacao_normalizada(p.situacao) = 'entregue';
--   select count(*) from public.plt_cards pc join public.pedidos p on p.id = pc.pedido_id
--    where pc.tipo = 'pedido' and pc.arquivado_em is null and pc.lancado_rotas_em is null
--      and plt_privado.fn_situacao_normalizada(p.situacao) = 'entregue';
