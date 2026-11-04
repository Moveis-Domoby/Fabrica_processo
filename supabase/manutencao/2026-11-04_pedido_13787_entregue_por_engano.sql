-- ============================================================================
-- SESSAO-44 · Frente 6 — o pedido 13787, "Entregue" por engano
--
-- O caso (raio-x de 03/11): o Tiny avisou "Entregue" às 07:34 e voltou para
-- "Preparando envio" às 08:11; a plataforma fechou o pedido (assinado
-- "Sistema", entrega 14547620), tirou o card do PCP e baixou as 2 peças do
-- estoque reservadas (14541923 — SKU 567, item 1 — e 14541241 — SKU 566,
-- item 3) com motivo "venda", e não reagiu à volta. Ninguém conseguiu reabrir.
-- Enquanto isso o Guilherme fez à mão dois cards avulsos, já concluídos em
-- LIMPEZA E EMBALAGEM: 14542126 (Armário Aéreo 2 portas — o item 2, SKU 423) e
-- 14542123 (o balcão 60 x 86 x 42 PERSONALIZADO — o item 4, sem código).
--
-- O acerto (decisões do dono de 03/11 + provisórias D-216; só com o OK dele):
--   1. relê tudo e PARA se algo mudou (sem gravar nada);
--   2. reabre a entrega por evento (fn_reabrir_entrega) SEM mudar o Tiny (ele
--      já está em "Preparando envio") e SEM trazer de volta as 2 peças do
--      estoque — o dono não sabe onde estão; se estiverem no galpão, a
--      logística acerta pela contagem;
--   3. os itens 1 e 3 (567 e 566) ficam no PCP, para a equipe liberar;
--   4. os dois avulsos viram peças do pedido: nasce a peça de cada item (2 e 4)
--      PRONTA em Pedidos em aguardo (a Expedição), com a referência ao avulso;
--      o avulso já saiu do quadro sozinho no Concluir (o Concluir arquiva) e
--      fica na história — o tempo e a meta do trabalho continuam dele, uma vez
--      só (a peça nova não tem tempo). Exceção só deste acerto: a regra "avulso
--      nunca vira peça" segue valendo, e não existe botão de conversão.
--   5. confere no fim: 4 vagas, 2 prontas na Expedição, 2 no PCP.
-- Idempotente: com a entrega já reaberta e as peças já criadas, não grava nada.
-- Depende da migration 20261104010000 (fn_reabrir_entrega, fn_vagas_pedido).
-- ============================================================================
do $$
declare
  v_pedido_id  bigint := 7944;
  v_card_id    bigint := 14542098;
  v_entrega_id bigint := 14547620;
  v_avulsos    bigint[] := array[14542126, 14542123];
  v_seqs       integer[] := array[2, 4];
  v_pedido     record;
  v_card       public.plt_cards%rowtype;
  v_entrega    public.plt_eventos%rowtype;
  v_itens      text;
  v_aguardo    bigint;
  v_av         public.plt_cards%rowtype;
  v_it         record;
  v_novo       bigint;
  v_res        jsonb;
  v_final      record;
  i            integer;
begin
  select p.id, p.numero, p.situacao into v_pedido from public.pedidos p where p.id = v_pedido_id;
  if v_pedido.numero is distinct from 13787 then
    raise exception 'Parei: o pedido % não é o 13787.', v_pedido_id;
  end if;
  if plt_privado.fn_situacao_normalizada(v_pedido.situacao) in ('entregue', 'cancelado') then
    raise exception 'Parei: o Tiny está em "%" — o acerto parte de o pedido NÃO estar entregue lá.', v_pedido.situacao;
  end if;

  select * into v_card from public.plt_cards where id = v_card_id and pedido_id = v_pedido_id and tipo = 'pedido';
  if not found then
    raise exception 'Parei: o card do pedido % não é o do 13787.', v_card_id;
  end if;

  -- Os 4 itens de hoje (o 4º sem código).
  select string_agg(v.seq || ':' || coalesce(v.codigo, '') || 'x' || v.unidades, ',' order by v.seq)
    into v_itens
    from plt_privado.vw_itens_producao v where v.pedido_id = v_pedido_id;
  if v_itens is distinct from '1:567x1,2:423x1,3:566x1,4:x1' then
    raise exception 'Parei: os itens do pedido mudaram desde o raio-x: %', v_itens;
  end if;

  -- Já feito? (a entrega reaberta e as duas peças nascidas dos avulsos)
  if v_card.entrega_evento_id is null
     and (select count(*) from public.plt_cards u
           where u.pedido_id = v_pedido_id and u.tipo = 'unidade'
             and exists (select 1 from public.plt_eventos e where e.card_id = u.id and e.tipo = 'card_criado'
                           and e.dados ->> 'manutencao' = '2026-11-04_pedido_13787_entregue_por_engano')) = 2 then
    raise notice 'Nada a fazer: o 13787 já foi acertado.';
    return;
  end if;

  if v_card.entrega_evento_id is distinct from v_entrega_id then
    raise exception 'Parei: a entrega vigente do 13787 não é a de 03/11 (%).', v_card.entrega_evento_id;
  end if;
  select * into v_entrega from public.plt_eventos where id = v_entrega_id;
  if v_entrega.usuario_id is not null or v_entrega.tipo <> 'pedido_entregue' then
    raise exception 'Parei: a entrega % não é a do Tiny (assinada "Sistema").', v_entrega_id;
  end if;
  if exists (select 1 from public.plt_cards u where u.pedido_id = v_pedido_id and u.tipo = 'unidade') then
    raise exception 'Parei: o pedido já tem peça (alguém liberou?).';
  end if;
  for i in 1 .. 2 loop
    select * into v_av from public.plt_cards where id = v_avulsos[i];
    -- (o Concluir do avulso também o arquiva — reconferido no banco em 04/11)
    if not found or v_av.tipo <> 'avulso' or v_av.concluido_em is null
       or not exists (select 1 from public.plt_eventos e where e.card_id = v_av.id and e.tipo = 'avulso_concluido')
       or exists (select 1 from public.plt_eventos e where e.card_id = v_av.id and e.tipo = 'card_desarquivado')
       or position('13787' in coalesce(v_av.titulo, '')) = 0 then
      raise exception 'Parei: o avulso % não está como no raio-x (concluído, do 13787).', v_avulsos[i];
    end if;
  end loop;

  select s.id into v_aguardo from public.plt_setores s where s.codigo = 'aguardo' and s.ativo;
  if v_aguardo is null then
    raise exception 'Parei: Pedidos em aguardo não está cadastrado.';
  end if;

  -- 2 · reabrir a entrega (sem o Tiny, sem as peças do estoque)
  v_res := plt_privado.fn_reabrir_entrega(
    v_card_id, null, 'api',
    'Entregue por engano: o Tiny avisou "Entregue" e voltou para "Preparando envio" em 03/11. A entrega foi reaberta; o Tiny não recebe nada (já está em "Preparando envio") e as 2 peças do estoque baixadas não voltam (decisão do dono — se estiverem no galpão, a logística acerta pela contagem).',
    jsonb_build_object('manutencao', '2026-11-04_pedido_13787_entregue_por_engano',
                       'motivo', 'entregue_por_engano', 'fonte', 'tiny', 'tiny', 'nao_muda'),
    false);
  if not coalesce((v_res ->> 'reabriu')::boolean, false) then
    raise exception 'Parei: a entrega não reabriu (%).', v_res;
  end if;

  -- 4 · os avulsos viram as peças dos itens 2 e 4, prontas na Expedição
  for i in 1 .. 2 loop
    select * into v_av from public.plt_cards where id = v_avulsos[i];
    select v.seq, v.codigo, v.descricao, v.unidades into v_it
      from plt_privado.vw_itens_producao v where v.pedido_id = v_pedido_id and v.seq = v_seqs[i];
    insert into public.plt_cards
        (tipo, pedido_id, card_pai_id, item_seq, item_codigo, item_descricao,
         indice_unidade, total_unidades, produto_tiny_id, setor_atual_id)
      values
        ('unidade', v_pedido_id, v_card_id, v_it.seq, v_it.codigo, v_it.descricao,
         1, v_it.unidades, plt_privado.fn_produto_do_item(v_it.codigo, v_it.descricao), v_aguardo)
      returning id into v_novo;
    insert into public.plt_eventos (card_id, tipo, origem, setor_destino_id, observacao, dados)
      values (v_novo, 'card_criado', 'api', v_aguardo,
              format('Era o card avulso %s ("%s"), feito e concluído antes de o pedido voltar — vira a peça do pedido, pronta na Expedição.',
                     v_av.id, v_av.titulo),
              jsonb_build_object('manutencao', '2026-11-04_pedido_13787_entregue_por_engano',
                                 'avulso_card_id', v_av.id, 'pedido_id', v_pedido_id, 'numero', 13787,
                                 'item_seq', v_it.seq, 'excecao', 'avulso_vira_peca_so_neste_acerto'));
    raise notice 'Avulso % → peça % (item %).', v_av.id, v_novo, v_it.seq;
  end loop;

  perform plt_privado.fn_recalcular_liberacao(v_pedido_id);

  -- 5 · a conferência
  select count(*)::int as vagas,
         count(w.card_id)::int as cobertas,
         count(*) filter (where w.card_id is not null
                            and exists (select 1 from public.plt_cards u
                                         where u.id = w.card_id and u.setor_atual_id = v_aguardo))::int as prontas,
         string_agg(w.seq::text, ',' order by w.seq) filter (where w.card_id is null) as no_pcp
    into v_final
    from plt_privado.fn_vagas_pedido(v_pedido_id) w;
  select * into v_card from public.plt_cards where id = v_card_id;
  if v_final.vagas <> 4 or v_final.cobertas <> 2 or v_final.prontas <> 2 or v_final.no_pcp is distinct from '1,3'
     or v_card.entrega_evento_id is not null or v_card.arquivado_em is not null or v_card.liberado_completo_em is not null then
    raise exception 'Parei: a conferência final não bateu (%; card entregue %, arquivado %, liberado %) — nada foi gravado.',
      row_to_json(v_final), v_card.entrega_evento_id, v_card.arquivado_em, v_card.liberado_completo_em;
  end if;
  raise notice 'Pronto: o 13787 reaberto — 4 vagas, 2 prontas na Expedição (itens 2 e 4), itens % no PCP. %',
    v_final.no_pcp, v_res;
end;
$$;
