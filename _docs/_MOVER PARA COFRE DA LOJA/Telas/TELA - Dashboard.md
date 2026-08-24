---
titulo: TELA — Dashboard Analytics
tipo: tela
atualizado: 2026-08-06
tags: [tela, dashboard, analytics, front]
componente: src/components/AnalyticsDashboard.tsx
---

# 📊 TELA — Dashboard Analytics

**Container:** `src/components/AnalyticsDashboard.tsx`
**Detalhe painel a painel:** [[PAINEL - Graficos do Dashboard]]

## Estrutura

```
AnalyticsDashboard
├── ScorecardsRow            (6 cards)
├── RevenueChart             (linha — evolução de faturamento)
├── SeasonalityHeatmap       (HTML/CSS — produto × mês)
├── TopItemsPanel            (HTML/CSS — Top 30 mais / menos)
├── PurchaseFrequencyChart   (2 barras — segmentos por nº de compras)
├── TransitionChart          (barras — tempo médio entre compras)
├── Tabela Top 50 Recompradores   (inline)
└── Tabela Clientes Recordes      (inline)
```

## ⚠️ Não há filtro global

**Cada bloco tem seu próprio `usePeriodFilter` independente**, com defaults diferentes:

| Painel | Período default |
|---|---|
| `ScorecardsRow` | `all` |
| `RevenueChart` | `6m` |
| `SeasonalityHeatmap` | `6m` |
| `TopItemsPanel` | seletor de **mês** próprio, não usa `usePeriodFilter` |
| `PurchaseFrequencyChart` | `all` |
| `TransitionChart` | `3m` |
| Top 50 / Recordes | **sem período** — sempre vida inteira |

> [!warning] Consequência
> Dois números na mesma tela podem estar respondendo a janelas de tempo completamente diferentes, sem nada indicar isso. Um usuário que compara o "Fat. Total" do scorecard (todo o histórico) com a soma das barras do RevenueChart (6 meses) conclui, corretamente, que "os números não batem".
>
> **Sugestão de produto:** ou um filtro global no topo, ou um rótulo de período visível em cada card.

## `usePeriodFilter(defaultPeriod, defaultEndCutoff = null)`

Produz `{cutoff, endCutoff}`:

| Valor | `cutoff` |
|---|---|
| `1m` | `startOfMonth(hoje)` |
| `3m` | `startOfMonth(hoje − 2m)` |
| `6m` | `startOfMonth(hoje − 5m)` |
| `12m` | `startOfMonth(hoje − 11m)` |
| `all` | `null` |
| `custom` | datas digitadas |

> [!bug] `endCutoff` é `null` exceto em `custom` — **nunca há teto superior**. Pedidos com `data_compra` no futuro (erro de sync) entram em todos os gráficos.

## Biblioteca de gráficos

**Recharts 3.9.2** nos 4 gráficos cartesianos. `SeasonalityHeatmap` e `TopItemsPanel` são **HTML/CSS puro** (barras de progresso), sem biblioteca.

Recharts consome as variáveis de tema (`stroke="hsl(var(--primary))"`), então troca de tema junto. Mas há cores hardcoded fora do sistema em vários pontos (`hsl(142,71%,45%)`, `text-orange-400`, `text-purple-400`) que **não respondem ao tema** e podem ter contraste ruim no claro.

## 🔴 O `loading` é descartado por todos os componentes

Todos os hooks retornam `loading`, e **nenhum componente o usa** (`const { data } = useX()`).

Enquanto carrega, os gráficos mostram "Sem dados suficientes" ou zeros — **exatamente o que o usuário lê como "o gráfico não está puxando os dados"**.

> [!tip] Esta é provavelmente a correção de maior retorno percebido por esforço no dashboard inteiro. Três linhas por componente: `if (loading) return <Skeleton />`.

## Otimizações presentes

1. Agregação no servidor — 8 RPCs devolvem dados prontos em vez de linhas cruas
2. `react-query` em 4 hooks com `staleTime`, `gcTime` e `enabled`
3. Drill-down de transições só busca quando o modal abre
4. `useMemo` em todas as transformações de dados
5. `ErrorBoundary` isolando o dashboard
6. Dashboard permanece **montado mas oculto** — evita remount

## Gargalos remanescentes

1. `fn_dashboard_items` **sem `LIMIT`** — payload de milhares de linhas para exibir 3–5 itens por mês. Deveria usar `ROW_NUMBER() OVER (PARTITION BY mês ORDER BY qtd DESC) <= 5`
2. **Sem índice composto** `(identidade, data_compra)` — todas as window functions fazem sort completo
3. `useTopClientsData` e `useFilterOptions` sem cache (useEffect cru)
4. **Sem virtualização** apesar de `@tanstack/react-virtual` estar instalada
5. `* { transition-colors }` global — custo de estilo em cada hover e render
6. Animações escalonadas com `transitionDelay` por índice (`660 + idx*30`, `700 + idx*18`, `550 + mIdx*60`) — dezenas de transições CSS simultâneas na entrada

## Ver também

- [[PAINEL - Graficos do Dashboard]] · [[MM - Dicionario de Metricas]] · [[BD - RPCs]]
