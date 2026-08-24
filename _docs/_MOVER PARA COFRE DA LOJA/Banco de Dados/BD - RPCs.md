---
titulo: BD — RPCs (funções)
tipo: banco-de-dados
atualizado: 2026-08-06
tags: [banco, rpc, funcao, referencia]
---

# ⚙️ BD — RPCs

Todas em `LANGUAGE plpgsql`, todas **SECURITY INVOKER**, **nenhuma** declara `SET search_path`.

> [!warning] Privilégio automático
> O baseline define `ALTER DEFAULT PRIVILEGES ... GRANT ALL ON ROUTINES TO anon, authenticated, service_role`. Toda função criada em migration posterior fica **automaticamente executável por `anon`**, mesmo sem `GRANT` explícito.

---

## `fn_filter_customers(p_filters jsonb, p_limit int = 20, p_offset int = 0)`

**A função mais complexa do schema.** Motor de segmentação server-side que substituiu a filtragem no frontend (migration `20260801050500`).

**Retorna:** `nome_cliente`, `telefone_cliente`, `quantidade_pedidos`, `faturamento_total`, `total_itens`, `data_primeira_compra`, `ultima_compra`, `pedidos_vida`, `is_recorrente`, `total_count`

**Consumida por:** `useCustomersPaginated` → [[TELA - Painel Principal]]

### Chaves aceitas em `p_filters`

| Chave | Efeito |
|---|---|
| `searchQuery` | `nome_cliente ILIKE '%q%'` **OU** telefone com dígitos normalizados dos dois lados |
| `dateFilter` | `'all'` \| `'custom'` \| `'specificYear'` \| `'specificMonth'` \| `'specificDay'` |
| `customDateStart` / `customDateEnd` | limites brutos |
| `specificYear` / `specificMonth` / `specificDay` | viram janela fechada via `date_trunc(...) + interval '1 X' - interval '1 microsecond'` |
| `selectedItems[]` | ignorado se vazio ou contiver `"all"`; senão `EXISTS` sobre `jsonb_array_elements` com a cascata de 10 caminhos |
| `purchaseCount[]` | pedidos **de vida**; suporta o bucket `'10+'` (`p_vida >= 10`) — ⚠️ a UI nunca produz `'10+'` |
| `inactiveBeforeDate` | `ultima_compra_lifetime <= data` |
| `recompraMinDays` / `recompraMaxDays` | faixa de `gap_days` — ⚠️ **quebrado, ver abaixo** |
| `spendAmount` + `spendType` + `spendMode` | `total` \| ticket médio; `above` \| `below` \| ±10% |

### Estrutura em CTEs

```
client_base    → identidade + data + valor
lifetime_stats → métricas de vida por cliente (p_vida, p_compra, u_compra,
                 faturamento_total_vida, gap_days)
period_records → pedidos filtrados por data/busca/itens
filtered_clients → JOIN período × vida + filtros de vida + GROUP BY cid
```

`total_count` é devolvido **em toda linha** via `(SELECT COUNT(*) FROM filtered_clients)`, para o front paginar sem segunda chamada. Custo: a CTE completa é paga a cada página.

**Ordenação:** `ORDER BY u_compra_periodo DESC` — **sem critério de desempate**.

### `is_recorrente` tem duas definições

```sql
CASE WHEN v_custom_start IS NOT NULL
     THEN MAX(ls.p_compra) < v_custom_start   -- já era cliente antes do período
     ELSE MAX(ls.p_vida) >= 2                 -- comprou 2+ vezes na vida
END
```

> [!danger] BUG CONFIRMADO — `gap_days` é sempre NULL
> ```sql
> (SELECT EXTRACT(DAY FROM (
>    nth_value(v2.data_compra, 2) OVER (ORDER BY v2.data_compra ASC) - v2.data_compra))
>  FROM client_base v2 WHERE v2.cid = cb.cid
>  ORDER BY v2.data_compra ASC LIMIT 1) as gap_days
> ```
> A window function **não tem cláusula de frame**, então o Postgres aplica o default `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`. Na **primeira** linha — justamente a que o `LIMIT 1` seleciona — o frame contém apenas ela, logo `nth_value(..., 2)` retorna `NULL`.
>
> **Efeito:** `NULL >= v_recompra_min` avalia como `NULL` no `WHERE` = falso. **Usar o filtro "Tempo de Recompra" retorna lista vazia, sempre.**
>
> **Correção:** frame explícito `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`, ou trocar por `LEAD(data_compra) OVER (...)`.
>
> **Bônus:** mesmo funcionando, `gap_days` mede só o intervalo entre a **1ª e a 2ª** compra — não o médio nem o mais recente. Provavelmente não é o que o usuário entende por "dias de recompra".

> [!bug] Paginação instável
> `ORDER BY u_compra_periodo DESC` sem desempate. Clientes com a mesma `MAX(data_compra)` trocam de posição entre páginas → registros duplicados ou omitidos ao navegar. Adicionar `, cid` resolve.

---

## `fn_dashboard_scorecards(p_start timestamptz = NULL, p_end timestamptz = NULL)`

**Retorna:** `total_revenue`, `total_orders`, `total_clients`, `recurrents`, `recurrence_rate`, `avg_ticket`
**Consumida por:** `useScorecardsData` → `KPICards` **e** `ScorecardsRow`

Três blocos:
1. `total_revenue` e `total_orders` **restritos ao período**.
2. `clients_in_period` (distinct no período) × `client_lifetime_orders` (contagem **de toda a vida**, sem filtro). `recurrents` = clientes do período com pedidos *lifetime* ≥ 2.
3. `recurrence_rate` e `avg_ticket` com guarda de divisão por zero.

> [!note] Só aceita data. Nenhum outro filtro. É a causa do descompasso KPI × tabela. Ver [[MM - Dicionario de Metricas]].

---

## `fn_dashboard_revenue_chart(p_start, p_end)`

**Retorna:** `month_str text`, `revenue numeric`, `orders integer`
Agrupa por `TO_CHAR(data_compra, 'YYYY-MM')`, ordena ASC. **Não preenche meses vazios.**

---

## `fn_dashboard_purchase_frequency(p_start, p_end)`

**Retorna:** `pedidos_count`, `faturamento_total`, `clientes_count`

CTE `client_period_stats` agrupa por cliente **dentro do período**; depois reagrupa **por `qtd_pedidos`**, produzindo "quantos clientes fizeram N pedidos e quanto faturaram".

`ORDER BY qtd_pedidos ASC LIMIT 15` — ⚠️ **truncamento silencioso**: segmentos acima do 15º bucket somem do gráfico e do total exibido.

---

## `fn_dashboard_items(p_start, p_end)`

**Retorna:** `month_str`, `item_name`, `quantidade`
**Consumida por:** `useItemsDataQuery` → `SeasonalityHeatmap`

Desembrulha `itens_comprados` (tratando array duplamente serializado) e resolve o nome pela cascata de 10 caminhos. Ver [[BD - vendas marketing]].

**Versão vigente:** `quantidade = COUNT(*)` (ocorrências), agrupado por `(mês, nome do item)`.
⚠️ **Sem `LIMIT`** — devolve todos os pares mês×item do período para exibir 3 a 5 por mês.

---

## `fn_dashboard_top_items_overall(p_start, p_end)`

**Retorna:** `item_name`, `quantidade`
**Consumida por:** `useTopItemsOverallQuery` → `TopItemsPanel`, **e** `useFilterOptions` (dropdown de produtos)

Mesma extração, sem dimensão de mês, `ORDER BY quantidade DESC **LIMIT 300**`. Comentário na migration explicita o motivo: *"Evita limite de 1000 linhas do PostgREST"*.

> [!danger] Esse `LIMIT 300` quebra o painel "Top 30 Menos Comprados"
> A RPC devolve os **300 mais vendidos**; o painel inverte e pega 30 → exibe *"os 30 menos vendidos entre os 300 mais vendidos"*. Num catálogo de 800 SKUs, os 500 realmente encalhados **nunca aparecem**.
> **Correção:** RPC separada com `ORDER BY quantidade ASC LIMIT 30`, idealmente com `LEFT JOIN` no catálogo para pegar itens com zero vendas.

Também limita o dropdown de "Itens Comprados" aos 300 primeiros — itens fora do top 300 **não são filtráveis**.

---

## `fn_dashboard_transitions_summary(p_start, p_end)`

**Retorna:** `purchase_number`, `avg_days`, `client_count`
**Consumida por:** `useTransitionsSummaryQuery` → `TransitionChart`

```sql
ROW_NUMBER() OVER (PARTITION BY <identidade> ORDER BY data_compra ASC) AS rn
LAG(data_compra) OVER (PARTITION BY <identidade> ORDER BY data_compra ASC) AS prev_data
```

Janelas calculadas sobre **todo o histórico**; o filtro de período é aplicado **depois** — isso é **proposital e correto**: garante que `purchase_number` seja o ordinal real na vida do cliente, não o ordinal dentro da janela.

Agrega no servidor: `AVG(EXTRACT(DAY FROM (data_compra − prev_data)))` e `COUNT(DISTINCT cid)` por `rn`. **Zero PII, poucas linhas.**

⚠️ `EXTRACT(DAY FROM interval)` **trunca as horas** → média subestimada. Correto: `EXTRACT(EPOCH FROM (...))/86400`.

---

## `fn_dashboard_transition_clients(p_purchase_number int, p_start, p_end, p_limit int = 20, p_offset int = 0)`

**Retorna (versão vigente):** `client_id`, `days_since_last`, `prev_date`, `curr_date`
**Consumida por:** `useTransitionsClientsQuery` → `TransitionHistoryModal` (drill-down ao clicar numa barra)

Filtra `WHERE rn = p_purchase_number`, ordena por `days_since_last ASC`, pagina.

> [!bug] Rótulo ≠ chave
> ```sql
> COALESCE(NULLIF(TRIM(nome_cliente),''), telefone_cliente) AS cid   -- exibido
> PARTITION BY COALESCE(NULLIF(TRIM(telefone_cliente),''), nome_cliente)  -- agrupado
> ```
> O `client_id` devolvido não é identificador estável. E reintroduz PII (nome) que a migration `20260801030000` havia removido de propósito.

---

## `fn_dashboard_transitions(p_start, p_end)` — 🪦 LEGADA

**Retorna:** `client_id`, `purchase_number`, `days_since_last` — **uma linha por transição, com o telefone**

Substituída conceitualmente em `20260801030000` mas **nunca dropada**. Ainda chamada pelo hook morto `useTransitionData.ts`.

> [!danger] Enquanto existir, é um vazamento de PII e um problema de volume esperando um import. **Dropar.**

---

## Funções de sync — `tick_*()`

`RETURNS void`, sem parâmetros, `GRANT ALL` para `anon`, `authenticated` e `service_role`.

| Função | Comportamento |
|---|---|
| `tick_auditoria_tiny()` | `net.http_post` → `/functions/v1/tiny-auditoria-sync`, timeout 300s |
| `tick_incremental_tiny()` | `net.http_post` → `/functions/v1/tiny-incremental-sync`, timeout 300s |
| `tick_historico_tiny()` | lê `tiny_sync_state.concluido`; se `true`, executa `cron.unschedule('tiny-historico-loop')` e retorna. Senão `net.http_post` → `/functions/v1/tiny-historico-mkt` com `{"modo":"historico"}` |

> [!danger] As três embutem o **JWT anon completo** e a URL do projeto **em texto puro** no corpo da função — portanto no controle de versão. E têm `GRANT ALL TO anon`: qualquer visitante pode chamar `rpc('tick_incremental_tiny')` repetidamente e disparar syncs completos contra o Tiny (custo, rate-limit, e derrubar as integrações de marketplace do cliente).
> Ver [[BD - Seguranca e RLS]].

## Ver também

- [[BD - Migrations]] · [[PAINEL - Graficos do Dashboard]] · [[MM - Dicionario de Metricas]]
