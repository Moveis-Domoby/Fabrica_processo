-- ============================================================================
-- SESSAO-30 · etapa 3 — o PCP numa chamada (raio-x 3 e 4; Lei de Desempenho)
--
-- 1. A liberação do PCP vira UM gesto no banco: `plt_fn_pcp_liberar(card,
--    unidades)` — usar a peça do estoque (a sugestão) e mandar as outras para
--    a produção, tudo numa transação (tudo ou nada). Antes era um laço no
--    navegador: 3 chamadas por peça, sem transação (parava no meio).
--    Idempotente: a unidade que já foi liberada é pulada e contada — o toque
--    repetido e a rede que volta não duplicam nem dão erro.
-- 2. Raio-x 3 (Q-72, escolha do dono em 06/10): o PCP libera só para SETOR DE
--    PRODUÇÃO. ESTOQUE, Pedidos em aguardo e ROTAS não são destino de
--    liberação — a peça pronta do estoque vai pela sugestão "usar?" (nasce
--    pronta no aguardo). Vale para TODA origem (tela, API, automação): o
--    gatilho `fn_validar_saida_pcp` recusa a unidade que sai do PCP para um
--    fim de linha; só o ajuste do super admin (D-117) passa. ↩️ D-63: "a
--    cadeira de estoque pode ir direto para Pedidos em aguardo" — agora vai
--    pela sugestão do estoque (ou pela LIMPEZA E EMBALAGEM → "Concluir
--    produção"); na história, o PCP nunca liberou para o aguardo (0 de 33).
-- 3. A janela de liberação abre com UMA requisição: `plt_fn_pcp_liberacao
--    (card)` devolve os itens em unidades, as já liberadas e as sugestões do
--    estoque (antes: 3 a 4 chamadas).
-- 4. A sugestão do estoque olha só as peças candidatas (o produto dos itens,
--    pelo índice das peças livres por produto, e as sem produto do catálogo,
--    pelo índice delas) — antes varria toda peça livre do ESTOQUE.
--    (Recriada POR INTEIRO a partir da migration 42 — mesma forma.)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · Raio-x 3: a unidade sai do PCP só para setor de produção (toda origem)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_validar_saida_pcp()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_papel_atual   text;
  v_papel_destino text;
begin
  if new.tipo <> 'movimentacao_setor'
     or coalesce(current_setting('plt.ajuste_super_admin', true), '') = 'on' then
    return new;
  end if;
  select s.papel_no_fluxo into v_papel_atual
    from public.plt_cards c
    join public.plt_setores s on s.id = c.setor_atual_id
   where c.id = new.card_id and c.tipo = 'unidade';
  if coalesce(v_papel_atual, '') <> 'entrada' then
    return new;
  end if;
  select s.papel_no_fluxo into v_papel_destino from public.plt_setores s where s.id = new.setor_destino_id;
  if coalesce(v_papel_destino, '') <> 'producao' then
    raise exception 'O PCP libera a peça para um setor de produção. Peça pronta do estoque vai pela sugestão "usar?" — ela nasce pronta em Pedidos em aguardo.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

comment on function plt_privado.fn_validar_saida_pcp() is
  'SESSAO-30 (raio-x 3): a unidade que está no PCP só sai para setor de produção — vale para toda origem; o ajuste do super admin (D-117) passa. A peça pronta do estoque entra pela sugestão (plt_fn_alocar_peca), que cria a unidade direto no aguardo.';

drop trigger if exists plt_eventos_validar_saida_pcp on public.plt_eventos;
create trigger plt_eventos_validar_saida_pcp
  before insert on public.plt_eventos
  for each row execute function plt_privado.fn_validar_saida_pcp();

-- ----------------------------------------------------------------------------
-- 2 · A sugestão do estoque (recriada POR INTEIRO a partir da migration 42;
--     só o CTE `livres` mudou — candidatas pelo índice)
-- ----------------------------------------------------------------------------
-- A sugestão do estoque na liberação (recriada POR INTEIRO a partir da
-- migration 42 — mesma forma; só as candidatas mudaram).
create or replace function public.plt_fn_sugestoes_alocacao(p_card_id bigint)
returns table (
  item_seq           integer,
  indice_unidade     integer,
  total_unidades     integer,
  peca_card_id       bigint,
  peca_origem        text,
  peca_origem_numero integer,
  pecas_iguais       integer,
  reservada          boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with alvo as (
    select pc.id, pc.pedido_id
      from public.plt_cards pc
     where pc.id = p_card_id
       and pc.tipo = 'pedido'
       and pc.arquivado_em is null
       and pc.lancado_rotas_em is null
       and plt_privado.fn_pode_ver_expedicao()
       and not plt_privado.fn_pedido_cancelado(pc.pedido_id)
  ),
  itens as (
    -- D-63: frete não é vaga (vw_itens_producao: unidades = 0).
    select v.seq, v.unidades as n,
           plt_privado.fn_chave_peca(plt_privado.fn_produto_do_item(v.codigo, v.descricao),
                                     v.codigo, v.descricao) as chave
      from plt_privado.vw_itens_producao v
      join alvo a on a.pedido_id = v.pedido_id
     where v.unidades >= 1
  ),
  vagas as (
    select i.seq, k.k, i.n, i.chave
      from itens i
      cross join lateral generate_series(1, i.n) as k(k)
     where not exists (
       select 1 from public.plt_cards u, alvo a
        where u.pedido_id = a.pedido_id and u.tipo = 'unidade'
          and u.item_seq = i.seq and u.indice_unidade = k.k)
  ),
  -- D-78: a peça que a venda reservou para ESTA vaga.
  reservas as (
    select c.id, c.card_pai_id, c.reservada_item_seq as seq, c.reservada_indice as k
      from public.plt_cards c
      join alvo a on a.pedido_id = c.reservada_pedido_id
     where c.tipo = 'unidade' and c.pedido_id is null and c.arquivado_em is null
  ),
  vagas_livres as (
    select v.*, row_number() over (partition by v.chave order by v.seq, v.k) as ordem
      from vagas v
     where not exists (select 1 from reservas r where r.seq = v.seq and r.k = v.k)
  ),
  -- SESSAO-30: só as peças CANDIDATAS — do produto dos itens (índice das
  -- livres por produto) e as sem produto do catálogo (índice delas; a chave
  -- delas é SKU + descrição). A chave e a contagem por chave não mudam.
  produtos_itens as (
    select distinct plt_privado.fn_produto_do_item(v.codigo, v.descricao) as produto
      from plt_privado.vw_itens_producao v
      join alvo a on a.pedido_id = v.pedido_id
     where v.unidades >= 1
  ),
  candidatas as (
    select c.* from public.plt_cards c
     where c.tipo = 'unidade' and c.arquivado_em is null and c.pedido_id is null
       and c.produto_tiny_id in (select pi.produto from produtos_itens pi where pi.produto is not null)
    union all
    select c.* from public.plt_cards c
     where c.tipo = 'unidade' and c.arquivado_em is null and c.pedido_id is null
       and c.produto_tiny_id is null
  ),
  livres as (
    select c.id, c.desde, c.card_pai_id,
           plt_privado.fn_chave_peca(c.produto_tiny_id, c.item_codigo, c.item_descricao) as chave
      from candidatas c
      join public.plt_setores s on s.id = c.setor_atual_id and s.codigo = 'estoque'
     where exists (select 1 from alvo)
       and c.reservada_pedido_id is null
       and coalesce(c.qualidade_atual, 'perfeito') = 'perfeito'
  ),
  pecas as (
    select l.*,
           row_number() over (partition by l.chave order by l.desde, l.id) as ordem,
           count(*) over (partition by l.chave)                             as iguais
      from livres l
  ),
  escolhas as (
    select v.seq, v.k, v.n, r.id as peca, r.card_pai_id,
           (select count(*) from reservas) + coalesce((select max(p.iguais) from pecas p where p.chave = v.chave), 0) as iguais,
           true as reservada
      from vagas v
      join reservas r on r.seq = v.seq and r.k = v.k
    union all
    select v.seq, v.k, v.n, p.id, p.card_pai_id, p.iguais, false
      from vagas_livres v
      join pecas p on p.chave = v.chave and p.ordem = v.ordem
  )
  select e.seq,
         e.k,
         e.n,
         e.peca,
         case when pai.tipo = 'reposicao' then 'reposicao'
              when pai.tipo = 'pedido'    then 'cancelamento'
              else 'manual' end,
         case when pai.tipo = 'pedido' then ped.numero end,
         e.iguais::int,
         e.reservada
    from escolhas e
    left join public.plt_cards pai on pai.id = e.card_pai_id
    left join public.pedidos ped on ped.id = pai.pedido_id
   order by e.seq, e.k;
$$;

-- ----------------------------------------------------------------------------
-- 3 · A janela de liberação numa requisição
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_pcp_liberacao(p_card_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_card public.plt_cards%rowtype;
  v_itens jsonb;
  v_ja    jsonb;
  v_sug   jsonb := '[]'::jsonb;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Liberar é gesto do PCP/logística ou de admin.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_card from public.plt_cards c
   where c.id = p_card_id and c.tipo in ('pedido', 'reposicao');
  if not found then
    raise exception 'Este card não existe.' using errcode = 'no_data_found';
  end if;

  if v_card.tipo = 'reposicao' then
    v_itens := jsonb_build_array(jsonb_build_object(
      'seq', 1, 'codigo', v_card.item_codigo, 'descricao', v_card.item_descricao,
      'unidades', coalesce(v_card.total_unidades, 0)));
    select coalesce(jsonb_agg(jsonb_build_object('item_seq', u.item_seq, 'indice_unidade', u.indice_unidade)
                              order by u.indice_unidade), '[]'::jsonb)
      into v_ja
      from public.plt_cards u
     where u.card_pai_id = v_card.id and u.tipo = 'unidade' and u.pedido_id is null;
  else
    -- D-63: frete não vira unidade (vw_itens_producao).
    select coalesce(jsonb_agg(jsonb_build_object('seq', v.seq, 'codigo', v.codigo,
                                                 'descricao', v.descricao, 'unidades', v.unidades)
                              order by v.seq), '[]'::jsonb)
      into v_itens
      from plt_privado.vw_itens_producao v
     where v.pedido_id = v_card.pedido_id and v.unidades >= 1;
    select coalesce(jsonb_agg(jsonb_build_object('item_seq', u.item_seq, 'indice_unidade', u.indice_unidade)
                              order by u.item_seq, u.indice_unidade), '[]'::jsonb)
      into v_ja
      from public.plt_cards u
     where u.pedido_id = v_card.pedido_id and u.tipo = 'unidade';
    select coalesce(jsonb_agg(to_jsonb(s) order by s.item_seq, s.indice_unidade), '[]'::jsonb)
      into v_sug
      from public.plt_fn_sugestoes_alocacao(v_card.id) s;
  end if;

  return jsonb_build_object('itens', v_itens, 'ja_liberadas', v_ja, 'sugestoes', v_sug);
end;
$$;

comment on function public.plt_fn_pcp_liberacao(bigint) is
  'SESSAO-30 (Lei de Desempenho — 1 requisição por janela): o que a janela de liberação do PCP mostra — os itens em unidades (sem frete — D-63), as unidades já liberadas e as sugestões do estoque (D-62/D-78). Pedido ou reposição. Gate da logística.';

-- ----------------------------------------------------------------------------
-- 4 · A liberação numa transação (tudo ou nada; idempotente por unidade)
--     p_unidades: [{item_seq, indice_unidade, peca_card_id} |
--                  {item_seq, indice_unidade, setor_id, etapa_id?}]
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_pcp_liberar(p_card_id bigint, p_unidades jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario   uuid;
  v_card      public.plt_cards%rowtype;
  v_pcp       bigint;
  v_u         jsonb;
  v_seq       integer;
  v_k         integer;
  v_peca      bigint;
  v_setor     bigint;
  v_etapa     bigint;
  v_codigo    text;
  v_desc      text;
  v_n         integer;
  v_novo      bigint;
  v_alocadas  integer := 0;
  v_liberadas integer := 0;
  v_puladas   integer := 0;
  v_cards     bigint[] := '{}';
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Liberar é gesto do PCP/logística ou de admin.' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_unidades) is distinct from 'array' or jsonb_array_length(p_unidades) = 0 then
    raise exception 'Selecione pelo menos uma unidade para liberar.' using errcode = 'check_violation';
  end if;
  if jsonb_array_length(p_unidades) > 500 then
    raise exception 'No máximo 500 unidades por vez.' using errcode = 'check_violation';
  end if;

  -- A trava do card do pedido/reposição: duas pessoas liberando o mesmo
  -- pedido ao mesmo tempo esperam uma pela outra (a segunda pula o que a
  -- primeira já liberou).
  select * into v_card from public.plt_cards c
   where c.id = p_card_id and c.tipo in ('pedido', 'reposicao') and c.arquivado_em is null
   for update;
  if not found then
    raise exception 'Este card não está mais no PCP (pode ter sido arquivado).' using errcode = 'no_data_found';
  end if;
  if v_card.tipo = 'pedido' and v_card.lancado_rotas_em is not null then
    raise exception 'Este pedido já foi lançado para ROTAS.' using errcode = 'check_violation';
  end if;
  select s.id into v_pcp from public.plt_setores s where s.codigo = 'pcp';

  -- 1º as peças do estoque (a sugestão aceita): a unidade nasce pronta no aguardo.
  for v_u in select x from jsonb_array_elements(p_unidades) x where x ? 'peca_card_id' loop
    v_seq  := (v_u ->> 'item_seq')::int;
    v_k    := (v_u ->> 'indice_unidade')::int;
    v_peca := (v_u ->> 'peca_card_id')::bigint;
    if v_card.tipo <> 'pedido' then
      raise exception 'A reposição não usa peça do estoque.' using errcode = 'check_violation';
    end if;
    if exists (select 1 from public.plt_cards u
                where u.pedido_id = v_card.pedido_id and u.tipo = 'unidade'
                  and u.item_seq = v_seq and u.indice_unidade = v_k) then
      v_puladas := v_puladas + 1;
      continue;
    end if;
    v_novo := public.plt_fn_alocar_peca(v_card.id, v_seq, v_k, v_peca);
    v_cards := v_cards || v_novo;
    v_alocadas := v_alocadas + 1;
  end loop;

  -- 2º as que vão para a produção (raio-x 3: só setor de produção).
  for v_u in select x from jsonb_array_elements(p_unidades) x where not (x ? 'peca_card_id') loop
    v_seq   := (v_u ->> 'item_seq')::int;
    v_k     := (v_u ->> 'indice_unidade')::int;
    v_setor := nullif(v_u ->> 'setor_id', '')::bigint;
    v_etapa := nullif(nullif(v_u ->> 'etapa_id', ''), '0')::bigint;
    if v_setor is null
       or not exists (select 1 from public.plt_setores s
                       where s.id = v_setor and s.ativo and s.papel_no_fluxo = 'producao') then
      raise exception 'O PCP libera a peça para um setor de produção. Peça pronta do estoque vai pela sugestão "usar?" — ela nasce pronta em Pedidos em aguardo.'
        using errcode = 'check_violation';
    end if;
    if v_etapa is not null
       and not exists (select 1 from public.plt_etapas e where e.id = v_etapa and e.setor_id = v_setor and e.ativa) then
      raise exception 'A etapa escolhida não é deste setor (ou foi desativada).' using errcode = 'check_violation';
    end if;

    if v_card.tipo = 'reposicao' then
      v_codigo := v_card.item_codigo;
      v_desc   := v_card.item_descricao;
      v_n      := v_card.total_unidades;
      if v_seq is distinct from 1 or v_k is null or v_k < 1 or v_k > coalesce(v_n, 0) then
        raise exception 'Esta unidade não existe na reposição.' using errcode = 'check_violation';
      end if;
      if exists (select 1 from public.plt_cards u
                  where u.card_pai_id = v_card.id and u.tipo = 'unidade' and u.indice_unidade = v_k) then
        v_puladas := v_puladas + 1;
        continue;
      end if;
    else
      v_n := null;
      select v.codigo, v.descricao, v.unidades into v_codigo, v_desc, v_n
        from plt_privado.vw_itens_producao v
       where v.pedido_id = v_card.pedido_id and v.seq = v_seq and v.unidades >= 1;
      if v_n is null or v_k is null or v_k < 1 or v_k > v_n then
        raise exception 'Esta unidade não existe no pedido.' using errcode = 'check_violation';
      end if;
      if exists (select 1 from public.plt_cards u
                  where u.pedido_id = v_card.pedido_id and u.tipo = 'unidade'
                    and u.item_seq = v_seq and u.indice_unidade = v_k) then
        v_puladas := v_puladas + 1;
        continue;
      end if;
    end if;

    insert into public.plt_cards
        (tipo, pedido_id, produto_tiny_id, card_pai_id, item_seq, item_codigo, item_descricao,
         indice_unidade, total_unidades, setor_atual_id)
      values
        ('unidade', case when v_card.tipo = 'pedido' then v_card.pedido_id end,
         case when v_card.tipo = 'reposicao' then v_card.produto_tiny_id end,
         v_card.id, v_seq, v_codigo, v_desc, v_k, v_n, v_pcp)
      returning id into v_novo;
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_destino_id)
      values (v_novo, 'card_criado', v_usuario, 'interface', v_pcp);
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, setor_destino_id, etapa_destino_id)
      values (v_novo, 'movimentacao_setor', v_usuario, 'interface', v_pcp, v_setor, v_etapa);
    v_cards := v_cards || v_novo;
    v_liberadas := v_liberadas + 1;
  end loop;

  return jsonb_build_object('alocadas', v_alocadas, 'liberadas', v_liberadas,
                            'ja_liberadas', v_puladas, 'cards', to_jsonb(v_cards));
end;
$$;

comment on function public.plt_fn_pcp_liberar(bigint, jsonb) is
  'SESSAO-30 (raio-x 3 + Lei de Desempenho): a liberação inteira do PCP numa transação — usar a peça do estoque (plt_fn_alocar_peca: nasce pronta no aguardo) e mandar as outras para um SETOR DE PRODUÇÃO (card_criado no PCP + movimentacao_setor, autor = quem liberou). Tudo ou nada; a unidade já liberada é pulada (idempotente). Pedido ou reposição. Gate da logística.';

revoke all on function plt_privado.fn_validar_saida_pcp() from public, anon, authenticated;
revoke all on function public.plt_fn_pcp_liberacao(bigint) from public, anon;
grant execute on function public.plt_fn_pcp_liberacao(bigint) to authenticated;
revoke all on function public.plt_fn_pcp_liberar(bigint, jsonb) from public, anon;
grant execute on function public.plt_fn_pcp_liberar(bigint, jsonb) to authenticated;
