---
titulo: PAINEL — Gráficos do Dashboard (referência painel a painel)
tipo: painel
atualizado: 2026-08-06
tags: [painel, grafico, dashboard, referencia]
---

# 📈 PAINEL — Gráficos do Dashboard

Uma seção por painel. Container em [[TELA - Dashboard]].

---

## 1️⃣ ScorecardsRow — 6 cards

| Item | Valor |
|---|---|
| Arquivo | `src/components/Dashboard/ScorecardsRow.tsx` |
| Hook | `useScorecardsData(cutoff, endCutoff)` — useEffect cru |
| RPC | `fn_dashboard_scorecards(p_start, p_end)` |
| Período default | `all` |
| Render | cards com `AnimatedNumber` (rAF, easing cúbico, 900ms) |

| Card | Fórmula |
|---|---|
| Fat. Total (Vida) | `SUM(valor_pedido)` no período |
| Total Pedidos | `COUNT(id)` no período |
| Clientes Únicos | distinct identidade no período |
| Recompradores | clientes do período com vida ≥ 2 |
| Taxa Recompra | `recurrents / total_clients × 100` |
| Ticket Médio | `total_revenue / total_orders` |

> [!bug] Rótulo "Fat. Total (Vida)" mente quando o período muda
> O valor é **sempre do período selecionado**; só coincide com "vida" porque o default é `all`. Trocar a pill para "6 meses" mantém o rótulo "(Vida)".

> [!bug] "Taxa Recompra" é métrica híbrida
> Numerador *lifetime*, denominador *período*. Em janelas curtas ela **infla** — quase todo mundo que compra num mês qualquer já tem ≥2 compras na vida.

---

## 2️⃣ RevenueChart — Evolução de Faturamento

| Item | Valor |
|---|---|
| Hook | `useRevenueChartData(cutoff, endCutoff)` |
| RPC | `fn_dashboard_revenue_chart` → `TO_CHAR(data_compra,'YYYY-MM')`, `SUM`, `COUNT` |
| Período default | `6m` |
| Transformação | `format(parseISO(...), 'MMM/yy', ptBR)`; `bestMonth` via `reduce` |
| Gráfico | `LineChart` + `Line type="monotone"` + `ReferenceLine` no melhor mês |

> [!bug] 🔴 Meses vazios não são preenchidos
> Um mês sem vendas simplesmente **não existe no array**. A linha "pula" de Mai/25 para Jul/25 desenhando uma **reta contínua**, sugerindo faturamento que não houve.
> **Correção:** gerar a série completa de meses e completar com 0.

> [!bug] `orders` é buscado e nunca exibido
> O tooltip faz `{payload[1] && <p>{payload[1].value} pedidos</p>}`, mas há **um único `<Line>`** — `payload[1]` nunca existe. A informação "N pedidos" jamais aparece.

⚠️ Bucket mensal em UTC — vendas noturnas do último dia do mês migram para o mês seguinte.

---

## 3️⃣ SeasonalityHeatmap — Sazonalidade de Produtos

| Item | Valor |
|---|---|
| Hook | **`useItemsDataQuery`** (react-query, `staleTime 30s`) |
| RPC | `fn_dashboard_items(p_start, p_end)` → `(month_str, item_name, quantidade)` |
| Período default | `6m`; seletor Top 1/3/5 |
| Transformação | `Map<mês, Map<item, qtd>>` → sort desc → `slice(0, topN)`; paleta de 10 cores por ordem de inserção do `Set` |
| Gráfico | HTML/CSS (colunas com barras) |

> [!bug] 🔴 `quantidade` NÃO é quantidade vendida
> A migration `20260801042738` trocou `SUM(item_qtd)` por **`COUNT(*)`**. Hoje o número conta **linhas de item (ocorrências)**, não unidades.
> A UI escreve literalmente `{count}× vendido` — **rótulo incorreto**. Um pedido com 10 unidades do mesmo SKU conta **1**.
> Ver [[MM - Dicionario de Metricas]].

> [!bug] Sem `LIMIT` na RPC
> `fn_dashboard_items` devolve **todos** os pares mês×item do período. Com 6 meses e catálogo grande, são milhares de linhas trafegadas para exibir 3 por mês. Deveria ser `ROW_NUMBER() OVER (PARTITION BY mês ORDER BY qtd DESC) <= 5`.

⚠️ Meses sem dados desaparecem (sem preenchimento) — a régua temporal tem buracos silenciosos.

---

## 4️⃣ TopItemsPanel — Top 30 Mais / Menos Comprados

| Item | Valor |
|---|---|
| Hook | **`useTopItemsOverallQuery`** (react-query) |
| RPC | `fn_dashboard_top_items_overall` → `ORDER BY quantidade DESC **LIMIT 300**` |
| Período | `<select>` próprio (`all` ou um mês), **não usa `usePeriodFilter`** |
| Transformação | `topItems = sorted.slice(0,30)`; `bottomItems = sorted.filter(...).reverse().slice(0,30)` |
| Gráfico | HTML/CSS (barras) |

> [!danger] 🔴 "Top 30 Menos Comprados" está estruturalmente errado
> A RPC devolve apenas os **300 itens mais vendidos**. O painel inverte esse array e pega os 30 primeiros → o que é exibido é **"os 30 menos vendidos ENTRE os 300 mais vendidos"**.
>
> Num catálogo de 800 SKUs, os **500 itens realmente encalhados nunca aparecem**. O painel que deveria mostrar o que não vende mostra, na prática, produtos medianos.
>
> **Correção:** RPC separada com `ORDER BY quantidade ASC LIMIT 30`, idealmente com `LEFT JOIN` no catálogo para capturar itens com **zero** vendas — que são justamente os mais relevantes e hoje são invisíveis por construção.

> [!bug] `maxItemCount` compartilhado entre os dois painéis
> Ambos usam `topItems[0][1]` como máximo. O painel "menos comprados" aplica `Math.max(6, ...)` — **todas as barras batem no piso de 6%**, tornando a visualização inútil.

> [!bug] A lista de meses é fabricada, não descoberta
> `availableMonths` gera **os últimos 12 meses do calendário** com um `for`. Comentário no código: *"Preencher últimos 12 meses como fallback já que não temos o array raw"*.
> Meses sem venda aparecem como opção; **dados anteriores a 12 meses ficam inacessíveis**.

⚠️ Mesma inversão de semântica de `quantidade` do heatmap.

---

## 5️⃣ PurchaseFrequencyChart — Comparativo por Frequência de Compra

| Item | Valor |
|---|---|
| Hook | `usePurchaseFrequencyData(cutoff, endCutoff)` |
| RPC | `fn_dashboard_purchase_frequency` → agrupa por cliente no período, depois `GROUP BY qtd_pedidos ASC **LIMIT 15**` |
| Período default | `all` |
| Transformação | `label`, `clientes`, `faturamento`, `ticketMedio` |
| Gráfico | 2 × `BarChart` (um com eixo duplo `yAxisId left/right` + `Legend`) + tabela-resumo |

> [!danger] 🔴 "Ticket Médio" está calculado errado
> ```ts
> ticketMedio = faturamento_total / clientes_count   // ❌ divide por CLIENTES
> ```
> No segmento "3 compras" isso dá **3× o ticket médio real**. O denominador correto é `clientes_count × pedidos_count`.
>
> Como o erro **cresce linearmente com o segmento**, o gráfico sugere que quem compra mais gasta muito mais por pedido. **Isso é artefato do cálculo, não comportamento do cliente** — e é o tipo de gráfico que gera decisão de negócio errada.

> [!bug] `LIMIT 15` silencioso
> Segmentos com mais de 15 compras no período são descartados. **A soma das barras de "Faturamento Total por Segmento" não bate com o card "Fat. Total"** dos Scorecards.

> [!warning] Segmentação é por período, não por vida
> Com `period='all'` (default) coincide com a vida. Ao trocar para "6 meses", um cliente com 10 compras históricas mas 1 no semestre cai no balde **"1 compra"**. Nada na UI avisa.

---

## 6️⃣ TransitionChart — Tempo Médio entre Compras

| Item | Valor |
|---|---|
| Hook | **`useTransitionsSummaryQuery`** (react-query) |
| RPC | `fn_dashboard_transitions_summary(p_start, p_end)` |
| Período default | `3m` |
| Estado local | `selectedTransitions = [2,3,4,5]` (chips de etapa) |
| Transformação | `label = "${n-1}ª → ${n}ª compra"`, `mediaDias = Math.round(avg_days)` |
| Gráfico | `BarChart` com `onClick` na `<Bar>` → `TransitionHistoryModal` |
| Drill-down | `useTransitionsClientsQuery` → `fn_dashboard_transition_clients`, paginação "fetch pageSize+1 para saber se há próxima" |

> [!bug] `EXTRACT(DAY FROM interval)` trunca as horas
> Um gap de 45 dias e 20 horas vira **45**. A média fica **sistematicamente subestimada**.
> Correto: `EXTRACT(EPOCH FROM (...)) / 86400`.

> [!warning] 🔴 A semântica do período é contraintuitiva
> O filtro `data_compra >= p_start` incide sobre a **compra de chegada**. Com o default `3m`, o gráfico responde:
> > *"Dos clientes que fizeram a 2ª compra nos últimos 3 meses, quanto tempo eles levaram."*
>
> E **não** "tempo médio entre compras nos últimos 3 meses". Nenhum texto na UI explica isso — é fonte clássica de "o número não bate".
> **Correção barata:** um tooltip explicando a leitura correta.

> [!bug] Drill-down com identidade inconsistente e PII
> `fn_dashboard_transition_clients` exibe `nome_cliente` mas agrupa por `telefone_cliente` (ver [[BD - RPCs]]). O modal exibe `cliente.client_id` como "nome", **reintroduzindo PII** que a migration `20260801030000` havia removido de propósito.

> [!bug] Detalhes
> - `page` do `TransitionHistoryModal` **nunca reseta**: abrir uma barra, ir até a página 3, fechar e abrir outra mantém `offset = 30`.
> - Chips default `[2,3,4,5]` não são reconciliados com `availableTransitions` — se o período só tem transições 2 e 3, os chips 4 e 5 ficam "selecionados" sem existir.

---

## 7️⃣ Top 50 Recompradores / Clientes Recordes (inline)

| Item | Valor |
|---|---|
| Hook | `useTopClientsData()` — sem parâmetros, roda uma vez no mount |
| Fonte | **view `vw_clientes_consolidados`** via PostgREST direto |
| Query A | `.gte('total_pedidos', 2).order('total_pedidos' desc).order('faturamento_total' desc).limit(50)` |
| Query B | `.order('faturamento_total' desc).limit(20)` |

> [!bug] 🔴 A coluna "Top Produtos" está SEMPRE vazia
> `mapToSummary` faz `topItems: []` com o comentário *"Itens exigiria agregação complexa, omitindo para performance"*. Mas a tabela **renderiza fielmente** a coluna `Top Produtos` com `c.topItems.slice(0,3)` e o contador `+N mais`.
> **Resultado visível: coluna em branco em 100% das linhas.** Ou remover a coluna, ou implementar a agregação.

> [!bug] "Clientes Recordes" é Top 20, não Top 50
> `limit(20)`. E os stats acima da tabela ("Fat. Total / Total Pedidos / Total Itens") são **somas dos 20 exibidos**, não da loja — mas nada indica isso. É fácil ler como total da empresa.

⚠️ **Sem filtro de período** — sempre vida inteira, ao contrário de todo o resto do dashboard. E herdam integralmente o problema de identidade duplicada ([[MM - Identidade do Cliente]]).

---

## 🏆 Ranking: "o gráfico está puxando dado errado"

| # | Onde | Diagnóstico | Confiança |
|---|---|---|---|
| 1 | `KPICards` | ignora 6 dos 10 filtros; contradiz a tabela abaixo | **Alta** |
| 2 | `TopItemsPanel` "Menos Comprados" | é o fundo do top 300, não os menos vendidos | **Alta** |
| 3 | `fn_filter_customers.gap_days` | filtro "Tempo de Recompra" zera o resultado | **Alta** |
| 4 | Identidade sem normalização de telefone | duplica clientes em **toda** RPC | **Alta** |
| 5 | `PurchaseFrequencyChart` Ticket Médio | divide por clientes, não por pedidos | **Alta** |
| 6 | Top 50 — coluna "Top Produtos" | `topItems: []` hardcoded | **Alta** |
| 7 | Heatmap / TopItems — `{count}× vendido` | `quantidade` é ocorrência, não unidade | **Alta** |
| 8 | `ItemsModal` cache | mostra itens do período anterior | **Alta** |
| 9 | `CustomersTable` seta de ordenação | não ordena nada | **Alta** |
| 10 | `RevenueChart` / Heatmap | meses vazios omitidos + bucket UTC vs filtro local | Média-alta |
| 11 | `TransitionChart` | `EXTRACT(DAY)` trunca; semântica do período | Média |
| 12 | `PurchaseFrequencyChart` `LIMIT 15` | soma das barras ≠ faturamento total | Média |
| 13 | `ScorecardsRow` "Fat. Total (Vida)" | rótulo fixo, valor variável | Média |
| 14 | Todos | `loading` descartado → "Sem dados" durante o fetch | Média |

## Ver também

- [[TELA - Dashboard]] · [[BD - RPCs]] · [[MM - Dicionario de Metricas]] · [[DT - Indice de Problemas Conhecidos]]
