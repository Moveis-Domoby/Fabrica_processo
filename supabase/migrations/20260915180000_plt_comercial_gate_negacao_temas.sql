-- ============================================================================
-- SESSAO-20 · migration 27 — Comercial: negação explícita no lugar de "vazio",
-- ACL das views enxuta e os temas esmeralda da união (D-46).
--
-- Contexto (item 0 da demanda, corrigido pela verificação ao vivo de 15/09):
-- a view `vendas_marketing` JÁ nasceu gateada na migration 26 (WHERE
-- plt_privado.fn_tem_modulo('comercial')) — não havia vazamento interno em
-- aberto. O que faltava, e esta migration entrega (opção A, escolhida pelo
-- dono na conversa):
--
--   1. Quem não tem o módulo recebe ERRO, não lista vazia/zerada — as 10 RPCs
--      do Comercial viram SECURITY DEFINER com o gate NEGANDO no topo
--      (`plt_privado.fn_negar_sem_modulo('comercial')`). Corpo das queries
--      intacto: nenhum número muda para quem tem o módulo.
--   2. `vendas_marketing` e `vw_clientes_consolidados` deixam de ser legíveis
--      pelo `authenticated` — o caminho de pessoa passa a ser SÓ RPC (o padrão
--      plt_fn_* da casa). As leituras diretas que o front do recompra fazia
--      viram 2 RPCs novas com o mesmo gate: `fn_clientes_consolidados` e
--      `fn_vendas_cliente`. `vw_scorecards_lista` continua legível
--      (security_invoker sobre tabelas com RLS de módulo), mas só SELECT.
--   3. A ACL padrão do Postgres tinha dado TODOS os privilégios das 3 views ao
--      authenticated (inofensivo — nenhuma aceita escrita — mas sujeira). Fica
--      só o que se usa.
--   4. Temas novos da união: `esmeralda` e `esmeralda-escuro` entram no check
--      de `plt_usuarios.tema` (resposta do dono, 15/09 — item 1). O check da
--      migration 22 virou `not valid` (E-19); este aqui é o que valida tudo.
--
-- A view NÃO ganha security_barrier: com o grant revogado ela só é lida por
-- RPC SECURITY DEFINER, e barrier bloquearia pushdown de predicado sem
-- ganho real de segurança.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · O gate que NEGA — irmão do fn_tem_modulo, para o topo das RPCs.
-- Mensagem em língua de gente (D-27): nada de código interno.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_negar_sem_modulo(p_modulo text)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not plt_privado.fn_tem_modulo(p_modulo) then
    raise exception 'Você não tem acesso ao módulo %. Peça a liberação a um administrador.',
      case p_modulo when 'comercial' then 'Comercial' when 'fabrica' then 'Fábrica' else p_modulo end
      using errcode = '42501';
  end if;
end;
$$;

comment on function plt_privado.fn_negar_sem_modulo(text) is
  'Erro imediato para quem não tem o módulo (D-46). Contexto de máquina (auth.uid() nulo) passa, como no fn_tem_modulo.';

revoke all on function plt_privado.fn_negar_sem_modulo(text) from public, anon;
grant execute on function plt_privado.fn_negar_sem_modulo(text) to authenticated;

-- ----------------------------------------------------------------------------
-- 2 · ACL das views: pessoa não lê view nenhuma do Comercial direto, exceto
-- vw_scorecards_lista (RLS de módulo cobre) — e só SELECT.
-- service_role mantém SELECT (Edge Functions leem pelo service key).
-- ----------------------------------------------------------------------------
revoke all on public.vendas_marketing         from authenticated;
revoke all on public.vw_clientes_consolidados from authenticated;
revoke all on public.vw_scorecards_lista      from authenticated;
grant select on public.vw_scorecards_lista    to authenticated;

revoke all on public.vendas_marketing         from service_role;
revoke all on public.vw_clientes_consolidados from service_role;
revoke all on public.vw_scorecards_lista      from service_role;
grant select on public.vendas_marketing         to service_role;
grant select on public.vw_clientes_consolidados to service_role;
grant select on public.vw_scorecards_lista      to service_role;

-- ----------------------------------------------------------------------------
-- 3 · As 10 RPCs do recompra, agora SECURITY DEFINER com o gate no topo.
-- Corpo das queries copiado da migration 26 SEM alteração — as únicas mudanças
-- são o `security definer` no cabeçalho e o PERFORM do gate após o BEGIN
-- (na fn_vendas_disparo_por_telefone, que era `language sql`, o corpo virou
-- RETURN QUERY do MESMO select, porque sql puro não comporta o gate).
-- DEFINER é o que permite ler a view depois da revogação da seção 2; o gate
-- é quem decide — e a view segue gateada por baixo (cinto e suspensório).
-- ----------------------------------------------------------------------------

create or replace function public.fn_dashboard_revenue_chart(p_start timestamp with time zone default null::timestamp with time zone, p_end timestamp with time zone default null::timestamp with time zone)
 returns table(month_str text, revenue numeric, orders integer)
 language plpgsql
 security definer
 set search_path to public, pg_temp
as $function$
BEGIN
    PERFORM plt_privado.fn_negar_sem_modulo('comercial');
    RETURN QUERY
    SELECT
        TO_CHAR(data_compra, 'YYYY-MM') as month_str,
        SUM(valor_pedido) as revenue,
        COUNT(id)::integer as orders
    FROM vendas_marketing
    WHERE (p_start IS NULL OR data_compra >= p_start)
      AND (p_end IS NULL OR data_compra <= p_end)
    GROUP BY TO_CHAR(data_compra, 'YYYY-MM')
    ORDER BY month_str ASC;
END;
$function$;

create or replace function public.fn_dashboard_purchase_frequency(p_start timestamp with time zone default null::timestamp with time zone, p_end timestamp with time zone default null::timestamp with time zone)
 returns table(pedidos_count integer, faturamento_total numeric, clientes_count integer)
 language plpgsql
 security definer
 set search_path to public, pg_temp
as $function$
BEGIN
    PERFORM plt_privado.fn_negar_sem_modulo('comercial');
    RETURN QUERY
    WITH client_period_stats AS (
        SELECT
            COALESCE(NULLIF(TRIM(telefone_cliente), ''), nome_cliente) as client_id,
            COUNT(id) as qtd_pedidos,
            SUM(valor_pedido) as faturamento
        FROM vendas_marketing
        WHERE (p_start IS NULL OR data_compra >= p_start)
          AND (p_end IS NULL OR data_compra <= p_end)
        GROUP BY COALESCE(NULLIF(TRIM(telefone_cliente), ''), nome_cliente)
    )
    SELECT
        qtd_pedidos::integer as pedidos_count,
        SUM(faturamento) as faturamento_total,
        COUNT(client_id)::integer as clientes_count
    FROM client_period_stats
    GROUP BY qtd_pedidos
    ORDER BY qtd_pedidos ASC
    LIMIT 15;
END;
$function$;

create or replace function public.fn_dashboard_transitions(p_start timestamp with time zone default null::timestamp with time zone, p_end timestamp with time zone default null::timestamp with time zone)
 returns table(client_id text, purchase_number integer, days_since_last integer)
 language plpgsql
 security definer
 set search_path to public, pg_temp
as $function$
BEGIN
    PERFORM plt_privado.fn_negar_sem_modulo('comercial');
    RETURN QUERY
    WITH ordered_purchases AS (
        SELECT
            COALESCE(NULLIF(TRIM(telefone_cliente), ''), nome_cliente) as cid,
            data_compra,
            ROW_NUMBER() OVER (PARTITION BY COALESCE(NULLIF(TRIM(telefone_cliente), ''), nome_cliente) ORDER BY data_compra ASC) as rn,
            LAG(data_compra) OVER (PARTITION BY COALESCE(NULLIF(TRIM(telefone_cliente), ''), nome_cliente) ORDER BY data_compra ASC) as prev_data
        FROM vendas_marketing
    )
    SELECT
        cid as client_id,
        rn::integer as purchase_number,
        EXTRACT(DAY FROM (data_compra - prev_data))::integer as days_since_last
    FROM ordered_purchases
    WHERE rn > 1
      AND (p_start IS NULL OR data_compra >= p_start)
      AND (p_end IS NULL OR data_compra <= p_end);
END;
$function$;

create or replace function public.fn_dashboard_transitions_summary(p_start timestamp with time zone default null::timestamp with time zone, p_end timestamp with time zone default null::timestamp with time zone)
 returns table(purchase_number integer, avg_days numeric, client_count integer)
 language plpgsql
 security definer
 set search_path to public, pg_temp
as $function$
BEGIN
    PERFORM plt_privado.fn_negar_sem_modulo('comercial');
    RETURN QUERY
    WITH ordered_purchases AS (
        SELECT
            COALESCE(NULLIF(TRIM(telefone_cliente), ''), nome_cliente) as cid,
            data_compra,
            ROW_NUMBER() OVER (PARTITION BY COALESCE(NULLIF(TRIM(telefone_cliente), ''), nome_cliente) ORDER BY data_compra ASC) as rn,
            LAG(data_compra) OVER (PARTITION BY COALESCE(NULLIF(TRIM(telefone_cliente), ''), nome_cliente) ORDER BY data_compra ASC) as prev_data
        FROM vendas_marketing
    )
    SELECT
        rn::integer as purchase_number,
        AVG(EXTRACT(DAY FROM (data_compra - prev_data)))::numeric as avg_days,
        COUNT(DISTINCT cid)::integer as client_count
    FROM ordered_purchases
    WHERE rn > 1
      AND (p_start IS NULL OR data_compra >= p_start)
      AND (p_end IS NULL OR data_compra <= p_end)
    GROUP BY rn
    ORDER BY rn ASC;
END;
$function$;

create or replace function public.fn_dashboard_transition_clients(p_purchase_number integer, p_start timestamp with time zone default null::timestamp with time zone, p_end timestamp with time zone default null::timestamp with time zone, p_limit integer default 20, p_offset integer default 0)
 returns table(client_id text, days_since_last integer, prev_date timestamp with time zone, curr_date timestamp with time zone)
 language plpgsql
 security definer
 set search_path to public, pg_temp
as $function$
BEGIN
    PERFORM plt_privado.fn_negar_sem_modulo('comercial');
    RETURN QUERY
    WITH ordered_purchases AS (
        SELECT
            COALESCE(NULLIF(TRIM(nome_cliente), ''), telefone_cliente) as cid,
            data_compra,
            ROW_NUMBER() OVER (PARTITION BY COALESCE(NULLIF(TRIM(telefone_cliente), ''), nome_cliente) ORDER BY data_compra ASC) as rn,
            LAG(data_compra) OVER (PARTITION BY COALESCE(NULLIF(TRIM(telefone_cliente), ''), nome_cliente) ORDER BY data_compra ASC) as prev_data
        FROM vendas_marketing
    )
    SELECT
        cid as client_id,
        EXTRACT(DAY FROM (data_compra - prev_data))::integer as days_since_last,
        prev_data as prev_date,
        data_compra as curr_date
    FROM ordered_purchases
    WHERE rn = p_purchase_number
      AND (p_start IS NULL OR data_compra >= p_start)
      AND (p_end IS NULL OR data_compra <= p_end)
    ORDER BY days_since_last ASC
    LIMIT p_limit OFFSET p_offset;
END;
$function$;

create or replace function public.fn_dashboard_items(p_start timestamp with time zone default null::timestamp with time zone, p_end timestamp with time zone default null::timestamp with time zone)
 returns table(month_str text, item_name text, quantidade integer)
 language plpgsql
 security definer
 set search_path to public, pg_temp
as $function$
BEGIN
    PERFORM plt_privado.fn_negar_sem_modulo('comercial');
    RETURN QUERY
    WITH exploded_items AS (
        SELECT
            TO_CHAR(v.data_compra, 'YYYY-MM') as m_str,
            COALESCE(
               NULLIF(jsonb_path_query_first(item, '$.item.produto.descricao')::text, 'null'),
               NULLIF(jsonb_path_query_first(item, '$.item.produto.nome')::text, 'null'),
               NULLIF(jsonb_path_query_first(item, '$.produto.descricao')::text, 'null'),
               NULLIF(jsonb_path_query_first(item, '$.produto.nome')::text, 'null'),
               NULLIF(jsonb_path_query_first(item, '$.item.descricao')::text, 'null'),
               NULLIF(jsonb_path_query_first(item, '$.item.nome')::text, 'null'),
               NULLIF(jsonb_path_query_first(item, '$.descricao')::text, 'null'),
               NULLIF(jsonb_path_query_first(item, '$.nome')::text, 'null'),
               NULLIF(jsonb_path_query_first(item, '$.name')::text, 'null'),
               CASE WHEN jsonb_typeof(item) = 'string' THEN item::text ELSE NULL END
            ) as i_name
        FROM vendas_marketing v,
        jsonb_array_elements(
            CASE
                WHEN jsonb_typeof(v.itens_comprados) = 'array' THEN v.itens_comprados
                WHEN jsonb_typeof(v.itens_comprados) = 'string' AND (v.itens_comprados#>>'{}') LIKE '[%' THEN (v.itens_comprados#>>'{}')::jsonb
                ELSE '[]'::jsonb
            END
        ) as item
        WHERE (p_start IS NULL OR v.data_compra >= p_start)
          AND (p_end IS NULL OR v.data_compra <= p_end)
    )
    SELECT
        m_str as month_str,
        TRIM(BOTH '"' FROM i_name) as item_name,
        COUNT(*)::integer as quantidade
    FROM exploded_items
    WHERE i_name IS NOT NULL AND i_name != 'null'
    GROUP BY m_str, TRIM(BOTH '"' FROM i_name)
    ORDER BY m_str ASC, quantidade DESC;
END;
$function$;

create or replace function public.fn_dashboard_top_items_overall(p_start timestamp with time zone default null::timestamp with time zone, p_end timestamp with time zone default null::timestamp with time zone)
 returns table(item_name text, quantidade integer)
 language plpgsql
 security definer
 set search_path to public, pg_temp
as $function$
BEGIN
    PERFORM plt_privado.fn_negar_sem_modulo('comercial');
    RETURN QUERY
    WITH exploded_items AS (
        SELECT
            COALESCE(
               NULLIF(jsonb_path_query_first(item, '$.item.produto.descricao')::text, 'null'),
               NULLIF(jsonb_path_query_first(item, '$.item.produto.nome')::text, 'null'),
               NULLIF(jsonb_path_query_first(item, '$.produto.descricao')::text, 'null'),
               NULLIF(jsonb_path_query_first(item, '$.produto.nome')::text, 'null'),
               NULLIF(jsonb_path_query_first(item, '$.item.descricao')::text, 'null'),
               NULLIF(jsonb_path_query_first(item, '$.item.nome')::text, 'null'),
               NULLIF(jsonb_path_query_first(item, '$.descricao')::text, 'null'),
               NULLIF(jsonb_path_query_first(item, '$.nome')::text, 'null'),
               NULLIF(jsonb_path_query_first(item, '$.name')::text, 'null'),
               CASE WHEN jsonb_typeof(item) = 'string' THEN item::text ELSE NULL END
            ) as i_name
        FROM vendas_marketing v,
        jsonb_array_elements(
            CASE
                WHEN jsonb_typeof(v.itens_comprados) = 'array' THEN v.itens_comprados
                WHEN jsonb_typeof(v.itens_comprados) = 'string' AND (v.itens_comprados#>>'{}') LIKE '[%' THEN (v.itens_comprados#>>'{}')::jsonb
                ELSE '[]'::jsonb
            END
        ) as item
        WHERE (p_start IS NULL OR v.data_compra >= p_start)
          AND (p_end IS NULL OR v.data_compra <= p_end)
    )
    SELECT
        TRIM(BOTH '"' FROM i_name) as item_name,
        COUNT(*)::integer as quantidade
    FROM exploded_items
    WHERE i_name IS NOT NULL AND i_name != 'null'
    GROUP BY TRIM(BOTH '"' FROM i_name)
    ORDER BY quantidade DESC;
END;
$function$;

-- Era `language sql`; o gate exige plpgsql. O SELECT é o MESMO, via RETURN QUERY.
create or replace function public.fn_vendas_disparo_por_telefone(p_telefone_normalizado text, p_inicio timestamp with time zone, p_fim timestamp with time zone)
 returns table(numero_pedido character varying, telefone_cliente character varying, data_compra timestamp with time zone, valor_pedido numeric)
 language plpgsql
 stable
 security definer
 set search_path to public, pg_temp
as $function$
BEGIN
  PERFORM plt_privado.fn_negar_sem_modulo('comercial');
  RETURN QUERY
  SELECT v.numero_pedido, v.telefone_cliente, v.data_compra, v.valor_pedido
  FROM public.vendas_marketing v
  WHERE v.data_compra >= p_inicio
    AND v.data_compra <= p_fim
    AND (
      CASE
        WHEN length(regexp_replace(COALESCE(v.telefone_cliente, ''), '\D', '', 'g')) > 11
             AND regexp_replace(COALESCE(v.telefone_cliente, ''), '\D', '', 'g') LIKE '55%'
        THEN substring(regexp_replace(COALESCE(v.telefone_cliente, ''), '\D', '', 'g') FROM 3)
        ELSE regexp_replace(COALESCE(v.telefone_cliente, ''), '\D', '', 'g')
      END
    ) = p_telefone_normalizado
  ORDER BY v.data_compra ASC;
END;
$function$;

create or replace function public.fn_dashboard_scorecards(p_filters jsonb default '{}'::jsonb)
 returns table(total_revenue numeric, total_orders integer, total_clients integer, recurrents integer, recurrence_rate numeric, avg_ticket numeric)
 language plpgsql
 security definer
 set search_path to public, pg_temp
as $function$
DECLARE
    v_search_query text;
    v_date_filter text;
    v_custom_start timestamp with time zone;
    v_custom_end timestamp with time zone;
    v_selected_items text[];
    v_purchase_count text[];
    v_inactive_before timestamp with time zone;
    v_recompra_min integer;
    v_recompra_max integer;
    v_spend_amount numeric;
    v_spend_type text;
    v_spend_mode text;
    v_total_revenue numeric;
    v_total_orders integer;
    v_total_clients integer;
    v_recurrents integer;
    v_recurrence_rate numeric;
    v_avg_ticket numeric;
BEGIN
    PERFORM plt_privado.fn_negar_sem_modulo('comercial');
    v_search_query := p_filters->>'searchQuery';
    v_date_filter := p_filters->>'dateFilter';
    IF p_filters->>'customDateStart' IS NOT NULL AND p_filters->>'customDateStart' <> '' THEN
        v_custom_start := (p_filters->>'customDateStart')::timestamp with time zone;
    END IF;
    IF p_filters->>'customDateEnd' IS NOT NULL AND p_filters->>'customDateEnd' <> '' THEN
        v_custom_end := (p_filters->>'customDateEnd')::timestamp with time zone;
    END IF;

    IF v_date_filter = 'specificYear' THEN
        v_custom_start := date_trunc('year', to_date(p_filters->>'specificYear', 'YYYY'));
        v_custom_end := v_custom_start + interval '1 year' - interval '1 microsecond';
    ELSIF v_date_filter = 'specificMonth' THEN
        v_custom_start := date_trunc('month', to_date(p_filters->>'specificMonth', 'YYYY-MM'));
        v_custom_end := v_custom_start + interval '1 month' - interval '1 microsecond';
    ELSIF v_date_filter = 'specificDay' THEN
        v_custom_start := date_trunc('day', to_date(p_filters->>'specificDay', 'YYYY-MM-DD'));
        v_custom_end := v_custom_start + interval '1 day' - interval '1 microsecond';
    END IF;

    IF p_filters ? 'selectedItems' AND jsonb_array_length(p_filters->'selectedItems') > 0 AND NOT (p_filters->'selectedItems') @> '["all"]' THEN
        SELECT array_agg(value) INTO v_selected_items FROM jsonb_array_elements_text(p_filters->'selectedItems');
    END IF;

    IF p_filters ? 'purchaseCount' AND jsonb_array_length(p_filters->'purchaseCount') > 0 AND NOT (p_filters->'purchaseCount') @> '["all"]' THEN
        SELECT array_agg(value) INTO v_purchase_count FROM jsonb_array_elements_text(p_filters->'purchaseCount');
    END IF;

    IF p_filters->>'inactiveBeforeDate' IS NOT NULL AND p_filters->>'inactiveBeforeDate' <> '' THEN
        v_inactive_before := (p_filters->>'inactiveBeforeDate')::timestamp with time zone;
    END IF;
    IF p_filters->>'recompraMinDays' IS NOT NULL AND p_filters->>'recompraMinDays' <> '' THEN
        v_recompra_min := (p_filters->>'recompraMinDays')::integer;
    END IF;
    IF p_filters->>'recompraMaxDays' IS NOT NULL AND p_filters->>'recompraMaxDays' <> '' THEN
        v_recompra_max := (p_filters->>'recompraMaxDays')::integer;
    END IF;
    IF p_filters->>'spendAmount' IS NOT NULL AND p_filters->>'spendAmount' <> '' THEN
        v_spend_amount := (p_filters->>'spendAmount')::numeric;
    END IF;
    v_spend_type := p_filters->>'spendType';
    v_spend_mode := p_filters->>'spendMode';

    WITH client_base AS (
        SELECT COALESCE(NULLIF(TRIM(v.telefone_cliente), ''), v.nome_cliente) as cid, v.data_compra, v.valor_pedido
        FROM vendas_marketing v
    ),
    lifetime_stats AS (
        SELECT
            cb.cid,
            COUNT(*) as p_vida,
            MIN(cb.data_compra) as p_compra,
            MAX(cb.data_compra) as u_compra,
            SUM(cb.valor_pedido) as faturamento_total_vida,
            (
                SELECT EXTRACT(DAY FROM (LEAD(v2.data_compra) OVER (ORDER BY v2.data_compra ASC) - v2.data_compra))
                FROM client_base v2
                WHERE v2.cid = cb.cid
                ORDER BY v2.data_compra ASC LIMIT 1
            ) as gap_days
        FROM client_base cb
        GROUP BY cb.cid
    ),
    period_records AS (
        SELECT v.*, COALESCE(NULLIF(TRIM(v.telefone_cliente), ''), v.nome_cliente) as cid
        FROM vendas_marketing v
        WHERE
            (
                (v_date_filter = 'all' OR v_date_filter IS NULL) OR
                (v_custom_start IS NULL AND v_custom_end IS NULL) OR
                (v_custom_start IS NOT NULL AND v_custom_end IS NULL AND v.data_compra >= v_custom_start) OR
                (v_custom_start IS NULL AND v_custom_end IS NOT NULL AND v.data_compra <= v_custom_end) OR
                (v_custom_start IS NOT NULL AND v_custom_end IS NOT NULL AND v.data_compra BETWEEN v_custom_start AND v_custom_end)
            )
            -- [DT-F13] mesmo fix da fn_filter_customers: ramo do telefone só
            -- participa quando o termo tem dígitos
            AND (v_search_query IS NULL OR v_search_query = '' OR
                 v.nome_cliente ILIKE '%' || v_search_query || '%' OR
                 (REGEXP_REPLACE(v_search_query, '\D', '', 'g') <> '' AND
                  REGEXP_REPLACE(v.telefone_cliente, '\D', '', 'g') ILIKE '%' || REGEXP_REPLACE(v_search_query, '\D', '', 'g') || '%')
            )
            AND (v_selected_items IS NULL OR EXISTS (
                SELECT 1 FROM jsonb_array_elements(
                    CASE
                        WHEN jsonb_typeof(v.itens_comprados) = 'array' THEN v.itens_comprados
                        WHEN jsonb_typeof(v.itens_comprados) = 'string' AND (v.itens_comprados#>>'{}') LIKE '[%' THEN (v.itens_comprados#>>'{}')::jsonb
                        ELSE '[]'::jsonb
                    END
                ) elem
                WHERE TRIM(BOTH '"' FROM COALESCE(
                   NULLIF(jsonb_path_query_first(elem, '$.item.produto.descricao')::text, 'null'),
                   NULLIF(jsonb_path_query_first(elem, '$.item.produto.nome')::text, 'null'),
                   NULLIF(jsonb_path_query_first(elem, '$.produto.descricao')::text, 'null'),
                   NULLIF(jsonb_path_query_first(elem, '$.produto.nome')::text, 'null'),
                   NULLIF(jsonb_path_query_first(elem, '$.item.descricao')::text, 'null'),
                   NULLIF(jsonb_path_query_first(elem, '$.item.nome')::text, 'null'),
                   NULLIF(jsonb_path_query_first(elem, '$.descricao')::text, 'null'),
                   NULLIF(jsonb_path_query_first(elem, '$.nome')::text, 'null'),
                   NULLIF(jsonb_path_query_first(elem, '$.name')::text, 'null'),
                   CASE WHEN jsonb_typeof(elem) = 'string' THEN elem::text ELSE NULL END
                )) = ANY(v_selected_items)
            ))
    ),
    filtered_clients AS (
        SELECT
            pr.cid,
            COUNT(*) as q_pedidos,
            SUM(pr.valor_pedido) as f_total,
            MAX(ls.p_vida) as p_vida
        FROM period_records pr
        JOIN lifetime_stats ls ON pr.cid = ls.cid
        WHERE
            (v_inactive_before IS NULL OR ls.u_compra <= v_inactive_before)
            AND (v_purchase_count IS NULL OR (
                CASE WHEN '10+' = ANY(v_purchase_count) AND ls.p_vida >= 10 THEN true
                     ELSE ls.p_vida::text = ANY(v_purchase_count)
                END
            ))
            AND (v_recompra_min IS NULL OR ls.gap_days >= v_recompra_min)
            AND (v_recompra_max IS NULL OR ls.gap_days <= v_recompra_max)
            AND (v_spend_amount IS NULL OR (
                CASE WHEN v_spend_type = 'total' THEN
                    CASE WHEN v_spend_mode = 'above' THEN ls.faturamento_total_vida >= v_spend_amount
                         WHEN v_spend_mode = 'below' THEN ls.faturamento_total_vida <= v_spend_amount
                         ELSE ls.faturamento_total_vida BETWEEN (v_spend_amount * 0.9) AND (v_spend_amount * 1.1)
                    END
                ELSE
                    CASE WHEN v_spend_mode = 'above' THEN (ls.faturamento_total_vida / NULLIF(ls.p_vida, 0)) >= v_spend_amount
                         WHEN v_spend_mode = 'below' THEN (ls.faturamento_total_vida / NULLIF(ls.p_vida, 0)) <= v_spend_amount
                         ELSE (ls.faturamento_total_vida / NULLIF(ls.p_vida, 0)) BETWEEN (v_spend_amount * 0.9) AND (v_spend_amount * 1.1)
                    END
                END
            ))
        GROUP BY pr.cid
    )
    SELECT
        COALESCE(SUM(f_total), 0),
        COALESCE(SUM(q_pedidos), 0)::integer,
        COUNT(*)::integer,
        COUNT(*) FILTER (WHERE p_vida >= 2)::integer
    INTO v_total_revenue, v_total_orders, v_total_clients, v_recurrents
    FROM filtered_clients;

    IF v_total_clients > 0 THEN
        v_recurrence_rate := (v_recurrents::numeric / v_total_clients::numeric) * 100.0;
    ELSE
        v_recurrence_rate := 0;
    END IF;

    IF v_total_orders > 0 THEN
        v_avg_ticket := v_total_revenue / v_total_orders::numeric;
    ELSE
        v_avg_ticket := 0;
    END IF;

    RETURN QUERY SELECT v_total_revenue, v_total_orders, v_total_clients, v_recurrents, v_recurrence_rate, v_avg_ticket;
END;
$function$;

create or replace function public.fn_filter_customers(p_filters jsonb, p_limit integer default 20, p_offset integer default 0)
 returns table(nome_cliente text, telefone_cliente text, quantidade_pedidos integer, faturamento_total numeric, total_itens integer, data_primeira_compra timestamp with time zone, ultima_compra timestamp with time zone, pedidos_vida integer, is_recorrente boolean, total_count bigint)
 language plpgsql
 security definer
 set search_path to public, pg_temp
as $function$
DECLARE
    v_search_query text;
    v_date_filter text;
    v_custom_start timestamp with time zone;
    v_custom_end timestamp with time zone;
    v_selected_items text[];
    v_purchase_count text[];
    v_inactive_before timestamp with time zone;
    v_recompra_min integer;
    v_recompra_max integer;
    v_spend_amount numeric;
    v_spend_type text;
    v_spend_mode text;
BEGIN
    PERFORM plt_privado.fn_negar_sem_modulo('comercial');
    -- Extract filter variables
    v_search_query := p_filters->>'searchQuery';
    v_date_filter := p_filters->>'dateFilter';
    IF p_filters->>'customDateStart' IS NOT NULL AND p_filters->>'customDateStart' <> '' THEN
        v_custom_start := (p_filters->>'customDateStart')::timestamp with time zone;
    END IF;
    IF p_filters->>'customDateEnd' IS NOT NULL AND p_filters->>'customDateEnd' <> '' THEN
        v_custom_end := (p_filters->>'customDateEnd')::timestamp with time zone;
    END IF;

    -- Handle specific date modes
    IF v_date_filter = 'specificYear' THEN
        v_custom_start := date_trunc('year', to_date(p_filters->>'specificYear', 'YYYY'));
        v_custom_end := v_custom_start + interval '1 year' - interval '1 microsecond';
    ELSIF v_date_filter = 'specificMonth' THEN
        v_custom_start := date_trunc('month', to_date(p_filters->>'specificMonth', 'YYYY-MM'));
        v_custom_end := v_custom_start + interval '1 month' - interval '1 microsecond';
    ELSIF v_date_filter = 'specificDay' THEN
        v_custom_start := date_trunc('day', to_date(p_filters->>'specificDay', 'YYYY-MM-DD'));
        v_custom_end := v_custom_start + interval '1 day' - interval '1 microsecond';
    END IF;

    -- Extract arrays
    IF p_filters ? 'selectedItems' AND jsonb_array_length(p_filters->'selectedItems') > 0 AND NOT (p_filters->'selectedItems') @> '["all"]' THEN
        SELECT array_agg(value) INTO v_selected_items FROM jsonb_array_elements_text(p_filters->'selectedItems');
    END IF;

    IF p_filters ? 'purchaseCount' AND jsonb_array_length(p_filters->'purchaseCount') > 0 AND NOT (p_filters->'purchaseCount') @> '["all"]' THEN
        SELECT array_agg(value) INTO v_purchase_count FROM jsonb_array_elements_text(p_filters->'purchaseCount');
    END IF;

    IF p_filters->>'inactiveBeforeDate' IS NOT NULL AND p_filters->>'inactiveBeforeDate' <> '' THEN
        v_inactive_before := (p_filters->>'inactiveBeforeDate')::timestamp with time zone;
    END IF;
    IF p_filters->>'recompraMinDays' IS NOT NULL AND p_filters->>'recompraMinDays' <> '' THEN
        v_recompra_min := (p_filters->>'recompraMinDays')::integer;
    END IF;
    IF p_filters->>'recompraMaxDays' IS NOT NULL AND p_filters->>'recompraMaxDays' <> '' THEN
        v_recompra_max := (p_filters->>'recompraMaxDays')::integer;
    END IF;
    IF p_filters->>'spendAmount' IS NOT NULL AND p_filters->>'spendAmount' <> '' THEN
        v_spend_amount := (p_filters->>'spendAmount')::numeric;
    END IF;
    v_spend_type := p_filters->>'spendType';
    v_spend_mode := p_filters->>'spendMode';

    RETURN QUERY
    WITH client_base AS (
        SELECT COALESCE(NULLIF(TRIM(v.telefone_cliente), ''), v.nome_cliente) as cid, v.data_compra, v.valor_pedido
        FROM vendas_marketing v
    ),
    lifetime_stats AS (
        -- Calculate lifetime stats for all clients that might match the filters
        SELECT
            cb.cid,
            COUNT(*) as p_vida,
            MIN(cb.data_compra) as p_compra,
            MAX(cb.data_compra) as u_compra,
            SUM(cb.valor_pedido) as faturamento_total_vida,
            (
                -- [DT-BD2, corrigido] nth_value(...,2) usava o frame padrão de window
                -- function (RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW), que na
                -- linha mais antiga (a que o LIMIT 1 externo pega) só contém 1 linha —
                -- nunca havia uma "2a" visível, então dava NULL sempre. LEAD() ignora
                -- frame e sempre olha a próxima linha da partição ordenada.
                SELECT EXTRACT(DAY FROM (LEAD(v2.data_compra) OVER (ORDER BY v2.data_compra ASC) - v2.data_compra))
                FROM client_base v2
                WHERE v2.cid = cb.cid
                ORDER BY v2.data_compra ASC LIMIT 1
            ) as gap_days
        FROM client_base cb
        GROUP BY cb.cid
    ),
    period_records AS (
        SELECT v.*, COALESCE(NULLIF(TRIM(v.telefone_cliente), ''), v.nome_cliente) as cid
        FROM vendas_marketing v
        WHERE
            -- Date Filter (applies to period)
            (
                (v_date_filter = 'all' OR v_date_filter IS NULL) OR
                (v_custom_start IS NULL AND v_custom_end IS NULL) OR
                (v_custom_start IS NOT NULL AND v_custom_end IS NULL AND v.data_compra >= v_custom_start) OR
                (v_custom_start IS NULL AND v_custom_end IS NOT NULL AND v.data_compra <= v_custom_end) OR
                (v_custom_start IS NOT NULL AND v_custom_end IS NOT NULL AND v.data_compra BETWEEN v_custom_start AND v_custom_end)
            )
            -- Search Query
            -- [DT-F13] o ramo do telefone só entra quando o termo tem dígitos;
            -- senão REGEXP_REPLACE(termo) = '' e ILIKE '%%' casaria todo mundo
            AND (v_search_query IS NULL OR v_search_query = '' OR
                 v.nome_cliente ILIKE '%' || v_search_query || '%' OR
                 (REGEXP_REPLACE(v_search_query, '\D', '', 'g') <> '' AND
                  REGEXP_REPLACE(v.telefone_cliente, '\D', '', 'g') ILIKE '%' || REGEXP_REPLACE(v_search_query, '\D', '', 'g') || '%')
            )
            -- Selected Items
            AND (v_selected_items IS NULL OR EXISTS (
                SELECT 1 FROM jsonb_array_elements(
                    CASE
                        WHEN jsonb_typeof(v.itens_comprados) = 'array' THEN v.itens_comprados
                        WHEN jsonb_typeof(v.itens_comprados) = 'string' AND (v.itens_comprados#>>'{}') LIKE '[%' THEN (v.itens_comprados#>>'{}')::jsonb
                        ELSE '[]'::jsonb
                    END
                ) elem
                WHERE TRIM(BOTH '"' FROM COALESCE(
                   NULLIF(jsonb_path_query_first(elem, '$.item.produto.descricao')::text, 'null'),
                   NULLIF(jsonb_path_query_first(elem, '$.item.produto.nome')::text, 'null'),
                   NULLIF(jsonb_path_query_first(elem, '$.produto.descricao')::text, 'null'),
                   NULLIF(jsonb_path_query_first(elem, '$.produto.nome')::text, 'null'),
                   NULLIF(jsonb_path_query_first(elem, '$.item.descricao')::text, 'null'),
                   NULLIF(jsonb_path_query_first(elem, '$.item.nome')::text, 'null'),
                   NULLIF(jsonb_path_query_first(elem, '$.descricao')::text, 'null'),
                   NULLIF(jsonb_path_query_first(elem, '$.nome')::text, 'null'),
                   NULLIF(jsonb_path_query_first(elem, '$.name')::text, 'null'),
                   CASE WHEN jsonb_typeof(elem) = 'string' THEN elem::text ELSE NULL END
                )) = ANY(v_selected_items)
            ))
    ),
    filtered_clients AS (
        SELECT
            pr.cid,
            MAX(pr.nome_cliente) as max_nome,
            MAX(pr.telefone_cliente) as max_telefone,
            COUNT(*) as q_pedidos,
            SUM(pr.valor_pedido) as f_total,
            SUM(pr.numero_itens) as t_itens,
            MAX(pr.data_compra) as u_compra_periodo,
            MAX(ls.p_vida) as p_vida,
            MAX(ls.p_compra) as data_p_compra,
            -- [DT-F14] "recorrente" = 2+ compras NA VIDA, sempre (decisão #4),
            -- igual a fn_dashboard_scorecards. A definição antiga com período
            -- ("1ª compra anterior ao início do período") fazia KPI e badges
            -- da tabela discordarem na mesma tela.
            MAX(ls.p_vida) >= 2 as is_rec
        FROM period_records pr
        JOIN lifetime_stats ls ON pr.cid = ls.cid
        WHERE
            -- Inactive Before
            (v_inactive_before IS NULL OR ls.u_compra <= v_inactive_before)
            -- Purchase Count (Lifetime)
            AND (v_purchase_count IS NULL OR (
                CASE WHEN '10+' = ANY(v_purchase_count) AND ls.p_vida >= 10 THEN true
                     ELSE ls.p_vida::text = ANY(v_purchase_count)
                END
            ))
            -- Recompra Gap
            AND (v_recompra_min IS NULL OR ls.gap_days >= v_recompra_min)
            AND (v_recompra_max IS NULL OR ls.gap_days <= v_recompra_max)
            -- Spend Amount
            AND (v_spend_amount IS NULL OR (
                CASE WHEN v_spend_type = 'total' THEN
                    CASE WHEN v_spend_mode = 'above' THEN ls.faturamento_total_vida >= v_spend_amount
                         WHEN v_spend_mode = 'below' THEN ls.faturamento_total_vida <= v_spend_amount
                         ELSE ls.faturamento_total_vida BETWEEN (v_spend_amount * 0.9) AND (v_spend_amount * 1.1)
                    END
                ELSE
                    CASE WHEN v_spend_mode = 'above' THEN (ls.faturamento_total_vida / NULLIF(ls.p_vida, 0)) >= v_spend_amount
                         WHEN v_spend_mode = 'below' THEN (ls.faturamento_total_vida / NULLIF(ls.p_vida, 0)) <= v_spend_amount
                         ELSE (ls.faturamento_total_vida / NULLIF(ls.p_vida, 0)) BETWEEN (v_spend_amount * 0.9) AND (v_spend_amount * 1.1)
                    END
                END
            ))
        GROUP BY pr.cid
    )
    SELECT
        max_nome,
        max_telefone,
        q_pedidos::integer,
        f_total,
        t_itens::integer,
        data_p_compra,
        u_compra_periodo,
        p_vida::integer,
        is_rec,
        (SELECT COUNT(*) FROM filtered_clients) as total_count
    FROM filtered_clients
    ORDER BY u_compra_periodo DESC
    LIMIT p_limit OFFSET p_offset;
END;
$function$;

-- ----------------------------------------------------------------------------
-- 4 · As 2 RPCs novas — o que o front do recompra lia DIRETO das views agora
-- passa por porta com gate (mesmo desenho das plt_fn_* da casa).
-- ----------------------------------------------------------------------------

-- Substitui as leituras diretas de vw_clientes_consolidados:
--   · Top 50 Recompradores (p_min_pedidos=2, p_ordem='pedidos',     p_limit=50)
--   · Clientes Recordes    (p_min_pedidos=null, p_ordem='faturamento', p_limit=20)
--   · useFilterOptions     (p_ordem='pedidos', p_limit=1 — só o maior total_pedidos)
create or replace function public.fn_clientes_consolidados(
  p_min_pedidos integer default null,
  p_ordem       text    default 'pedidos',
  p_limit       integer default 50
)
 returns table(
   id_cliente        text,
   nome_cliente      text,
   telefone_cliente  text,
   total_pedidos     bigint,
   faturamento_total numeric,
   total_itens       bigint,
   primeira_compra   timestamp with time zone,
   ultima_compra     timestamp with time zone
 )
 language plpgsql
 stable
 security definer
 set search_path to public, pg_temp
as $function$
BEGIN
  PERFORM plt_privado.fn_negar_sem_modulo('comercial');
  RETURN QUERY
  SELECT c.id_cliente, c.nome_cliente, c.telefone_cliente, c.total_pedidos,
         c.faturamento_total, c.total_itens, c.primeira_compra, c.ultima_compra
  FROM public.vw_clientes_consolidados c
  WHERE (p_min_pedidos IS NULL OR c.total_pedidos >= p_min_pedidos)
  ORDER BY
    CASE WHEN p_ordem = 'faturamento' THEN c.faturamento_total END DESC NULLS LAST,
    c.total_pedidos DESC,
    c.faturamento_total DESC
  LIMIT LEAST(COALESCE(p_limit, 50), 1000);
END;
$function$;

comment on function public.fn_clientes_consolidados(integer, text, integer) is
  'Porta gateada do módulo Comercial sobre vw_clientes_consolidados (SESSAO-20). p_ordem: pedidos (padrão) ou faturamento.';

-- Substitui as leituras diretas de vendas_marketing por cliente:
--   · CustomerLifetimeModal (p_telefones = variantes; fallback p_nome_parcial)
--   · ItemsModal            (p_telefones = [telefone])
--   · useTopClientsData     (p_telefones = [telefone] OU p_nome_exato)
-- Sem critério nenhum, devolve vazio — esta porta não despeja a base inteira.
create or replace function public.fn_vendas_cliente(
  p_telefones    text[] default null,
  p_nome_exato   text   default null,
  p_nome_parcial text   default null
)
 returns table(
   id               uuid,
   numero_pedido    character varying,
   nome_cliente     character varying,
   telefone_cliente character varying,
   data_compra      timestamp with time zone,
   valor_pedido     numeric,
   numero_itens     integer,
   itens_comprados  jsonb,
   created_at       timestamp with time zone
 )
 language plpgsql
 stable
 security definer
 set search_path to public, pg_temp
as $function$
BEGIN
  PERFORM plt_privado.fn_negar_sem_modulo('comercial');
  IF (p_telefones IS NULL OR coalesce(array_length(p_telefones, 1), 0) = 0)
     AND nullif(trim(coalesce(p_nome_exato, '')), '') IS NULL
     AND nullif(trim(coalesce(p_nome_parcial, '')), '') IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT v.id, v.numero_pedido, v.nome_cliente, v.telefone_cliente,
         v.data_compra, v.valor_pedido, v.numero_itens, v.itens_comprados, v.created_at
  FROM public.vendas_marketing v
  WHERE (p_telefones IS NOT NULL AND v.telefone_cliente = ANY(p_telefones))
     OR (nullif(trim(coalesce(p_nome_exato, '')), '') IS NOT NULL AND v.nome_cliente = p_nome_exato)
     OR (nullif(trim(coalesce(p_nome_parcial, '')), '') IS NOT NULL AND v.nome_cliente ILIKE '%' || p_nome_parcial || '%')
  ORDER BY v.data_compra ASC;
END;
$function$;

comment on function public.fn_vendas_cliente(text[], text, text) is
  'Porta gateada do módulo Comercial sobre vendas_marketing por cliente (SESSAO-20): telefones exatos, nome exato ou nome parcial. Sem critério = vazio.';

-- ----------------------------------------------------------------------------
-- 5 · Permissões das RPCs novas — endpoint para gente logada, nunca anon (E-11).
-- ----------------------------------------------------------------------------
revoke all on function public.fn_clientes_consolidados(integer, text, integer) from public, anon;
revoke all on function public.fn_vendas_cliente(text[], text, text)            from public, anon;
grant execute on function public.fn_clientes_consolidados(integer, text, integer) to authenticated, service_role;
grant execute on function public.fn_vendas_cliente(text[], text, text)            to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 6 · Temas esmeralda da união (D-46 / resposta do dono em 15/09): o check de
-- plt_usuarios.tema passa a aceitar os 10. Este é o check que valida tudo
-- (o da migration 22 virou `not valid` — E-19).
-- ----------------------------------------------------------------------------
alter table public.plt_usuarios drop constraint if exists plt_usuarios_tema_ck;
alter table public.plt_usuarios add constraint plt_usuarios_tema_ck check (
  tema in ('claro', 'gelo', 'areia', 'dourado', 'ardosia', 'grafite', 'escuro', 'meia-noite',
           'esmeralda', 'esmeralda-escuro')
);

comment on column public.plt_usuarios.tema is
  'Tema visual escolhido no Meu Perfil: 8 esquemas amarelo × grafite + os 2 verde-esmeralda que vieram do painel de recompra na união (D-46).';
