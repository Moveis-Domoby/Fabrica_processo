-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · COMERCIAL: A TABELA DE CLIENTES ORDENA NO
-- BANCO (SESSAO-54 · DT-G16 do débito técnico do Comercial)
--
-- Antes: a tabela de clientes do Painel de Recompra pedia a página ao banco
-- sempre da compra mais recente para a mais antiga e, no clique de "ordenar
-- por data", invertia só os 50 clientes que já estavam na tela — "mais antiga
-- primeiro" mostrava a página 1 de cabeça para baixo, não os clientes mais
-- antigos do resultado.
--
-- Agora a ordem vai DENTRO dos filtros (a chave "sortOrder": 'asc' | 'desc')
-- e o banco ordena o resultado inteiro antes de paginar.
--   · A assinatura da porta NÃO muda (p_filters jsonb, p_limit, p_offset) —
--     quem já a chama sem a chave recebe exatamente o que recebia: a mais
--     recente primeiro, desempate pela chave do cliente (a prova está na
--     bateria: porta antiga × nova, linha a linha).
--   · A tela nova tolera o banco de antes: ele ignora a chave e devolve a
--     ordem de sempre (a tela segue invertendo a página, como fazia).
--   · O corpo é o da última versão da função nas migrations
--     (20261016110000_plt_comercial_tela_pronta.sql), com três mudanças: a
--     variável v_asc, a leitura da chave e os dois "order by".
--   · Nenhuma tabela, índice, permissão ou dado muda. "create or replace"
--     mantém os grants de sempre (authenticated e service_role).
-- ============================================================================

set local lock_timeout = '5s';

create or replace function public.fn_filter_customers(p_filters jsonb, p_limit integer default 20, p_offset integer default 0)
 returns table(nome_cliente text, telefone_cliente text, quantidade_pedidos integer, faturamento_total numeric, total_itens integer, data_primeira_compra timestamp with time zone, ultima_compra timestamp with time zone, pedidos_vida integer, is_recorrente boolean, total_count bigint)
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
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
    v_digitos text;
    v_ini timestamp with time zone;
    v_fim timestamp with time zone;
    v_asc boolean;
begin
    perform plt_privado.fn_negar_sem_modulo('comercial');
    v_search_query := p_filters->>'searchQuery';
    v_date_filter := p_filters->>'dateFilter';
    if p_filters->>'customDateStart' is not null and p_filters->>'customDateStart' <> '' then
        v_custom_start := (p_filters->>'customDateStart')::timestamp with time zone;
    end if;
    if p_filters->>'customDateEnd' is not null and p_filters->>'customDateEnd' <> '' then
        v_custom_end := (p_filters->>'customDateEnd')::timestamp with time zone;
    end if;
    if v_date_filter = 'specificYear' then
        v_custom_start := date_trunc('year', to_date(p_filters->>'specificYear', 'YYYY'));
        v_custom_end := v_custom_start + interval '1 year' - interval '1 microsecond';
    elsif v_date_filter = 'specificMonth' then
        v_custom_start := date_trunc('month', to_date(p_filters->>'specificMonth', 'YYYY-MM'));
        v_custom_end := v_custom_start + interval '1 month' - interval '1 microsecond';
    elsif v_date_filter = 'specificDay' then
        v_custom_start := date_trunc('day', to_date(p_filters->>'specificDay', 'YYYY-MM-DD'));
        v_custom_end := v_custom_start + interval '1 day' - interval '1 microsecond';
    end if;
    if p_filters ? 'selectedItems' and jsonb_array_length(p_filters->'selectedItems') > 0 and not (p_filters->'selectedItems') @> '["all"]' then
        select array_agg(value) into v_selected_items from jsonb_array_elements_text(p_filters->'selectedItems');
    end if;
    if p_filters ? 'purchaseCount' and jsonb_array_length(p_filters->'purchaseCount') > 0 and not (p_filters->'purchaseCount') @> '["all"]' then
        select array_agg(value) into v_purchase_count from jsonb_array_elements_text(p_filters->'purchaseCount');
    end if;
    if p_filters->>'inactiveBeforeDate' is not null and p_filters->>'inactiveBeforeDate' <> '' then
        v_inactive_before := (p_filters->>'inactiveBeforeDate')::timestamp with time zone;
    end if;
    if p_filters->>'recompraMinDays' is not null and p_filters->>'recompraMinDays' <> '' then
        v_recompra_min := (p_filters->>'recompraMinDays')::integer;
    end if;
    if p_filters->>'recompraMaxDays' is not null and p_filters->>'recompraMaxDays' <> '' then
        v_recompra_max := (p_filters->>'recompraMaxDays')::integer;
    end if;
    if p_filters->>'spendAmount' is not null and p_filters->>'spendAmount' <> '' then
        v_spend_amount := (p_filters->>'spendAmount')::numeric;
    end if;
    v_spend_type := p_filters->>'spendType';
    v_spend_mode := p_filters->>'spendMode';
    -- SESSAO-54 (DT-G16): a ordem pedida pela tabela — 'asc' = a compra mais
    -- antiga primeiro, no resultado INTEIRO; sem a chave (ou qualquer outro
    -- valor), a ordem de sempre (a mais recente primeiro).
    v_asc := lower(coalesce(p_filters->>'sortOrder', 'desc')) = 'asc';
    v_digitos := regexp_replace(coalesce(v_search_query, ''), '\D', '', 'g');
    -- os limites de data resolvidos uma vez: o MESMO recorte do "ou" de 5 ramos de
    -- sempre, escrito de um jeito que o índice da data enxerga ("todo o período" = sem limite)
    if not (v_date_filter = 'all' or v_date_filter is null) then
        v_ini := v_custom_start;
        v_fim := v_custom_end;
    end if;

    -- O período inteiro sem busca nem produto: a tela já está pronta — a vida
    -- de cada cliente É o recorte (mesmos números de sempre, sem somar nada).
    if ((v_date_filter = 'all' or v_date_filter is null) or (v_custom_start is null and v_custom_end is null))
       and coalesce(v_search_query, '') = '' and v_selected_items is null then
        return query
        with f as (
            select c.* from public.plt_comercial_clientes c
             where (v_inactive_before is null or c.ultima_compra <= v_inactive_before)
               and (v_purchase_count is null or (
                    case when '10+' = any(v_purchase_count) and c.pedidos_vida >= 10 then true
                         else c.pedidos_vida::text = any(v_purchase_count)
                    end))
               and (v_recompra_min is null or c.gap_dias >= v_recompra_min)
               and (v_recompra_max is null or c.gap_dias <= v_recompra_max)
               and (v_spend_amount is null or (
                    case when v_spend_type = 'total' then
                        case when v_spend_mode = 'above' then c.faturamento_vida >= v_spend_amount
                             when v_spend_mode = 'below' then c.faturamento_vida <= v_spend_amount
                             else c.faturamento_vida between (v_spend_amount * 0.9) and (v_spend_amount * 1.1)
                        end
                    else
                        case when v_spend_mode = 'above' then (c.faturamento_vida / nullif(c.pedidos_vida, 0)) >= v_spend_amount
                             when v_spend_mode = 'below' then (c.faturamento_vida / nullif(c.pedidos_vida, 0)) <= v_spend_amount
                             else (c.faturamento_vida / nullif(c.pedidos_vida, 0)) between (v_spend_amount * 0.9) and (v_spend_amount * 1.1)
                        end
                    end))
        )
        select f.nome_max, f.telefone_max, f.pedidos_vida, f.faturamento_vida, f.itens_vida::integer,
               f.primeira_compra, f.ultima_compra, f.pedidos_vida, f.pedidos_vida >= 2,
               (select count(*) from f)
          from f
         order by case when v_asc then f.ultima_compra end asc,
                  case when not v_asc then f.ultima_compra end desc,
                  f.cid
         limit p_limit offset p_offset;
        return;
    end if;

    return query
    with period_records as (
        select v.cid, v.nome_cliente, v.telefone_cliente, v.valor_pedido, v.numero_itens, v.data_compra
          from public.plt_comercial_vendas v
         where ((v.data_compra >= coalesce(v_ini, '-infinity'::timestamptz) and v.data_compra <= coalesce(v_fim, 'infinity'::timestamptz))
                or (v_ini is null and v_fim is null and v.data_compra is null))
           and (v_search_query is null or v_search_query = '' or
                v.nome_cliente ilike '%' || v_search_query || '%' or
                (v_digitos <> '' and v.telefone_digitos ilike '%' || v_digitos || '%'))
           and (v_selected_items is null or v.item_nomes && v_selected_items)
    ),
    filtered_clients as (
        select pr.cid,
               max(pr.nome_cliente) as max_nome,
               max(pr.telefone_cliente) as max_telefone,
               count(*) as q_pedidos,
               sum(pr.valor_pedido) as f_total,
               sum(pr.numero_itens) as t_itens,
               max(pr.data_compra) as u_compra_periodo,
               max(ls.pedidos_vida) as p_vida,
               max(ls.primeira_compra) as data_p_compra,
               max(ls.pedidos_vida) >= 2 as is_rec
          from period_records pr
          join public.plt_comercial_clientes ls on ls.cid = pr.cid
         where (v_inactive_before is null or ls.ultima_compra <= v_inactive_before)
           and (v_purchase_count is null or (
                case when '10+' = any(v_purchase_count) and ls.pedidos_vida >= 10 then true
                     else ls.pedidos_vida::text = any(v_purchase_count)
                end))
           and (v_recompra_min is null or ls.gap_dias >= v_recompra_min)
           and (v_recompra_max is null or ls.gap_dias <= v_recompra_max)
           and (v_spend_amount is null or (
                case when v_spend_type = 'total' then
                    case when v_spend_mode = 'above' then ls.faturamento_vida >= v_spend_amount
                         when v_spend_mode = 'below' then ls.faturamento_vida <= v_spend_amount
                         else ls.faturamento_vida between (v_spend_amount * 0.9) and (v_spend_amount * 1.1)
                    end
                else
                    case when v_spend_mode = 'above' then (ls.faturamento_vida / nullif(ls.pedidos_vida, 0)) >= v_spend_amount
                         when v_spend_mode = 'below' then (ls.faturamento_vida / nullif(ls.pedidos_vida, 0)) <= v_spend_amount
                         else (ls.faturamento_vida / nullif(ls.pedidos_vida, 0)) between (v_spend_amount * 0.9) and (v_spend_amount * 1.1)
                    end
                end))
         group by pr.cid
    )
    select max_nome::text, max_telefone::text, q_pedidos::integer, f_total, t_itens::integer, data_p_compra,
           u_compra_periodo, p_vida::integer, is_rec, (select count(*) from filtered_clients)
      from filtered_clients
     order by case when v_asc then u_compra_periodo end asc,
              case when not v_asc then u_compra_periodo end desc,
              cid
     limit p_limit offset p_offset;
end;
$function$;
