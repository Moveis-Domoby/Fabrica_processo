---
titulo: Modelo Mental — Dicionário de Métricas
tipo: modelo-mental
atualizado: 2026-08-06
tags: [modelo-mental, metricas, definicoes, glossario]
---

# 📐 MM — Dicionário de Métricas

> [!warning] Regra de ouro
> Três palavras do produto têm **duas definições vivas ao mesmo tempo**: *itens*, *recorrente* e *custo*. Antes de dizer que um número está errado, confira qual definição aquele componente está usando.

---

## 🔴 Termos ambíguos (resolver isso é dívida técnica)

### "Itens" — duas definições

| Onde | O que significa | Fonte |
|---|---|---|
| `vendas_marketing.numero_itens` | **unidades vendidas** | gravado no sync, vindo do Tiny |
| `vw_clientes_consolidados.total_itens` | soma dessas unidades | `SUM(numero_itens)` |
| Coluna "Itens" da tabela de clientes | unidades | `SUM(numero_itens)` no período |
| `fn_dashboard_items.quantidade` | **ocorrências** (linhas de item) | `COUNT(*)` desde a migration `20260801042738` |
| `fn_dashboard_top_items_overall.quantidade` | ocorrências | idem |

**Consequência visível:** o `SeasonalityHeatmap` e o `TopItemsPanel` escrevem literalmente `{count}× vendido` — **rótulo incorreto**. Um pedido com 10 unidades do mesmo SKU conta como **1**.

**Por que mudou:** a migration `20260801042738_change_items_count_logic.sql` trocou `SUM(item_qtd)` por `COUNT(*)` porque os campos de quantidade no JSON do Tiny eram pouco confiáveis (formatos variados, ausência frequente caindo no default `1`). Contar ocorrências é robusto e mede **popularidade**, não volume. A decisão é defensável — o rótulo na UI é que está errado.

> [!todo] Decisão pendente
> Ou renomear o rótulo para "aparece em N pedidos", ou voltar a somar unidades usando `numero_itens`. Escolher uma.

### "Recorrente" — duas definições

| Onde | Definição |
|---|---|
| `fn_dashboard_scorecards.recurrents` | cliente do período cujo **total de pedidos de vida ≥ 2** |
| `fn_filter_customers.is_recorrente` (com período) | **primeira compra anterior ao início do período** |
| `fn_filter_customers.is_recorrente` (sem período) | pedidos de vida ≥ 2 |

Os KPIs do topo e a lista de clientes **podem discordar**.

> [!note] A definição do scorecard é intencional, mas infla janelas curtas
> "Recorrente" pelo histórico completo significa que quase todo mundo que compra num mês qualquer já é recorrente. A **Taxa de Recompra** é, portanto, uma métrica híbrida: numerador *lifetime*, denominador *período*. Em janelas curtas ela tende a 100%.

### "Custo da campanha" — duas definições

| Coluna | Origem |
|---|---|
| `listas_disparo.custo_disparo` | manual, legado |
| `vw_scorecards_lista.custo_total_real` | `COALESCE(tarifa_aplicada × total_enviados, custo_disparo, 0)` |

O `COALESCE` faz o fallback **silenciosamente**. Campanhas antigas e novas não são comparáveis sem olhar se `tarifa_aplicada IS NULL`.

---

## ✅ Métricas do painel principal (KPICards)

Fonte única: `fn_dashboard_scorecards(p_start, p_end)`.

| Card | Fórmula |
|---|---|
| **Total Clientes** | `COUNT(DISTINCT identidade)` no período |
| **Total Pedidos** | `COUNT(id)` no período |
| **Faturamento** | `COALESCE(SUM(valor_pedido), 0)` no período |
| **Novos** | `total_clients − recurrents` |
| **Recorrentes** | clientes do período com `COUNT(id)` de vida ≥ 2 |
| **Taxa de Recompra** | `(recurrents / total_clients) × 100`, 1 casa |

> [!danger] Os KPIs ignoram 6 dos 10 filtros
> `fn_dashboard_scorecards` só aceita `p_start` e `p_end`. **Não recebem** `searchQuery`, `selectedItems`, `purchaseCount`, `inactiveBeforeDate`, `recompraMin/MaxDays` nem `spendAmount/Type/Mode`.
> Filtrar "clientes que compraram Produto X e gastaram acima de R$500" mostra 40 clientes na tabela e **8.412 no card acima dela**. É o descompasso mais visível do produto.

> [!note] "Novos" não é aquisição
> Significa "cliente cuja vida inteira tem exatamente 1 pedido", não "cliente adquirido neste período". O card mede *unicidade de vida*.

---

## ✅ Métricas do Dashboard (ScorecardsRow)

Mesma RPC, com seletor de período próprio (default `all`).

| Card | Fórmula |
|---|---|
| Fat. Total (Vida) | `SUM(valor_pedido)` **no período** — o rótulo "(Vida)" mente quando o período muda |
| Total Pedidos | `COUNT(id)` no período |
| Clientes Únicos | distinct identidade no período |
| Recompradores | clientes do período com vida ≥ 2 |
| Taxa Recompra | `recurrents / total_clients × 100` |
| Ticket Médio | `total_revenue / total_orders` |

---

## ✅ Métricas de campanha (vw_scorecards_lista)

Denominador base — **exclui quem teve erro de envio**:

```sql
total_enviados = count(*) FILTER (
  WHERE data_envio IS NOT NULL
    AND (motivo_perda IS NULL OR motivo_perda <> 'erro_envio_mensagem')
)
```

| Métrica | Fórmula |
|---|---|
| `receita_gerada` | `COALESCE(SUM(valor_ganho) FILTER (status='ganho'), 0)` |
| `custo_total_real` | `COALESCE(tarifa_aplicada × total_enviados, custo_disparo, 0)` |
| `taxa_resposta_pct` | `100 × total_respondidos / NULLIF(total_enviados,0)` |
| `taxa_conversao_pct` | `100 × total_ganhos / NULLIF(total_enviados,0)` |
| `ticket_medio` | `receita_gerada / total_ganhos` (ou `0`) |
| **`roi_pct`** | `(receita − custo) / custo × 100` se `custo > 0`, senão **`NULL`** (UI mostra `—`) |

`roi_pct` é ROI clássico (lucro sobre investimento), **não** retorno bruto. ROI de 0% = empatou.

---

## ⚠️ Métricas com erro de cálculo confirmado

### "Ticket Médio" do PurchaseFrequencyChart

```ts
ticketMedio = faturamento_total / clientes_count   // ❌ divide por CLIENTES
```

No segmento "3 compras" isso dá **3× o ticket médio real**. O denominador correto é `clientes_count × pedidos_count` (ou `faturamento_total / total_pedidos`).

Como o erro cresce linearmente com o segmento, o gráfico sugere que quem compra mais gasta muito mais por pedido — **isso é artefato do cálculo, não comportamento do cliente**.

### "Tempo médio entre compras" — truncamento

`EXTRACT(DAY FROM interval)` descarta as horas. Um intervalo de 45 dias e 20 horas vira 45. A média fica **sistematicamente subestimada**.

Correto: `EXTRACT(EPOCH FROM (...)) / 86400`.

### Semântica do período no TransitionChart

O filtro `data_compra >= p_start` incide sobre a **compra de chegada**. Com o default de 3 meses, o gráfico responde:

> *"Dos clientes que fizeram a 2ª compra nos últimos 3 meses, quanto tempo eles levaram."*

E **não** "tempo médio entre compras nos últimos 3 meses". Nada na UI explica isso — é fonte clássica de "o número não bate".

---

## 📏 Convenções de janela temporal

| Timer | Unidade | Onde |
|---|---|---|
| `janela_resposta_dias` (default 3) | **dias úteis, pulando só domingo** (sábado conta, feriado não é tratado) | `addDiasUteisSemDomingo` |
| `janela_resultado_dias` (default 7) | **dias corridos** | `addDiasCorridos` |
| `intervalo_disparo_segundos` (default 60) | segundos, mas a granularidade real do cron é **1 minuto** | `enviar-proximo-disparo` |

## Ver também

- [[MM - Identidade do Cliente]]
- [[PAINEL - Graficos do Dashboard]]
- [[BD - Views]]
