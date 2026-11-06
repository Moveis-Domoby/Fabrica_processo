-- ============================================================================
-- Ajuste do dono (06/11/2026) · pedido do sistema de estoque de peças que assina
-- o aviso de saída "movimentacao_etapa" (cadastro "Estoque de peças - teste"):
--
--   1. o aviso passa a levar a ETAPA de origem e a de destino, com id e nome —
--      até aqui só ia o NOME do setor, e numa movimentação dentro do mesmo
--      setor não dava para saber para qual coluna o card foi:
--        "etapa_origem":  {"id": 29, "nome": "A MONTAR"},
--        "etapa_destino": {"id": 28, "nome": "MONTANDO"}
--      (null quando o evento não tem a etapa — ex.: card que nasce, entrada
--      vinda do PCP sem coluna de origem);
--   2. dentro de "card", ao lado de "item_codigo", vai o "produto_tiny_id" — o
--      produto do Tiny da fábrica. Quando o card não guardou o produto (unidade
--      de pedido antiga), sai o MESMO que o resto da plataforma usa para o item:
--      plt_privado.fn_produto_do_item(código, descrição) — o produto ativo de
--      menor id com aquele código; item personalizado e card sem item → null.
--      (Conferido no banco vivo em 06/11: zero card em que os dois divergem.)
--
-- Só ACRESCENTA chaves: tudo o que o aviso já levava continua igual, no mesmo
-- lugar (setor_origem/setor_destino seguem como nome). Quem já assina os outros
-- tipos (n8n do Tiny, fotos, chave do PIN) recebe duas chaves a mais, nulas.
-- A assinatura (X-Assinatura) é feita sobre o corpo inteiro no despacho — não muda.
--
-- Nenhuma tabela, coluna, gatilho ou permissão nova: só a função do gatilho
-- plt_eventos_webhooks é recriada (create or replace, mesma assinatura), a
-- partir da versão VIVA (pg_get_functiondef de 06/11). Os eventos não são
-- tocados (append-only — RNF-05).
--
-- Custo: a montagem continua acontecendo UMA vez por evento e só quando algum
-- aviso ativo assina aquele tipo; os acréscimos são duas buscas por chave
-- primária (plt_etapas) e, só para card sem produto gravado, uma busca pelo
-- índice do código em produtos.
-- ============================================================================
set local lock_timeout = '5s';

create or replace function plt_privado.fn_enfileirar_webhooks()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  w record;
  v_payload jsonb;
begin
  for w in select * from public.plt_webhooks
            where ativo and new.tipo = any (eventos)
  loop
    if v_payload is null then
      select jsonb_build_object(
               'evento_id', new.id,
               'tipo', new.tipo,
               'ocorrido_em', new.ocorrido_em,
               'origem', new.origem,
               'card_id', new.card_id,
               'setor_origem', so.nome,
               'setor_destino', sd.nome,
               'etapa_origem', case when eo.id is not null
                                 then jsonb_build_object('id', eo.id, 'nome', eo.nome) end,
               'etapa_destino', case when ed.id is not null
                                  then jsonb_build_object('id', ed.id, 'nome', ed.nome) end,
               'estado_qualidade', new.estado_qualidade,
               'observacao', new.observacao,
               'dados', new.dados,
               'card', case when c.id is not null then jsonb_build_object(
                 'tipo', c.tipo,
                 'pedido_numero', p.numero,
                 'item_codigo', c.item_codigo,
                 'produto_tiny_id', coalesce(c.produto_tiny_id,
                                             plt_privado.fn_produto_do_item(c.item_codigo, c.item_descricao)),
                 'item_descricao', c.item_descricao,
                 'indice_unidade', c.indice_unidade,
                 'total_unidades', c.total_unidades
               ) end)
        into v_payload
        from (select 1) um
        left join public.plt_cards c on c.id = new.card_id
        left join public.pedidos p on p.id = c.pedido_id
        left join public.plt_setores so on so.id = new.setor_origem_id
        left join public.plt_setores sd on sd.id = new.setor_destino_id
        left join public.plt_etapas eo on eo.id = new.etapa_origem_id
        left join public.plt_etapas ed on ed.id = new.etapa_destino_id;
    end if;
    insert into public.plt_webhook_entregas (webhook_id, evento_id, payload)
         values (w.id, new.id, v_payload);
  end loop;
  return null;
end;
$$;

revoke all on function plt_privado.fn_enfileirar_webhooks() from public, anon, authenticated;

comment on function plt_privado.fn_enfileirar_webhooks() is
  'Gatilho de plt_eventos: monta o aviso de saída (uma vez por evento) e enfileira uma entrega por webhook ativo que assina o tipo. Desde 06/11/2026 leva etapa_origem/etapa_destino ({id, nome}) e card.produto_tiny_id.';
