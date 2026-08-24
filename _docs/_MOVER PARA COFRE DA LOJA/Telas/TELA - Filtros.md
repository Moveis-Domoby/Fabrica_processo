---
titulo: TELA — Sistema de Filtros (FilterBar)
tipo: tela
atualizado: 2026-08-06
tags: [tela, filtros, front]
componente: src/components/FilterBar.tsx
---

# 🎛️ TELA — Sistema de Filtros

**Arquivo:** `src/components/FilterBar.tsx` (17 KB)

## ⚠️ Onde o estado realmente vive

> [!danger] Armadilha de leitura
> Apesar do nome, **`src/hooks/useCustomerFilters.ts` NÃO é usado** — é código morto de ~250 linhas (o motor client-side legado).
>
> O estado real é um `useState<FilterState>` **inline no `App.tsx` (linhas 26–42)**, passado por prop para `FilterBar`, `KPICards`, `CustomersTable` e `ItemsModal`.
>
> Pior: o hook morto define defaults **diferentes** (`dateFilter: 'specificMonth'`, arrays vazios) dos reais. Quem ler o hook entende o sistema errado.

**Defaults reais (`App.tsx`):** `dateFilter: 'all'`, `selectedItems: ['all']`, `purchaseCount: ['all']`, `spendType: 'total'`, `spendMode: 'above'`, mês/dia/ano = hoje.

`usePeriodFilter.ts` **não é usado nesta tela** — é exclusivo do dashboard.

---

## Catálogo completo dos 10 filtros

### Linha 1 (grid de 6 colunas)

| Filtro | Campo(s) | Controle | O que faz |
|---|---|---|---|
| **Pesquisar** | `searchQuery` | input text | Nome (`ILIKE %q%`) **OU** telefone só-dígitos (`REGEXP_REPLACE(telefone,'\D','','g') ILIKE %digitos%`) |
| **Data da Compra** | `dateFilter` + `customDateStart/End`, `specificYear`, `specificMonth`, `specificDay` | select com 5 modos + navegadores ‹ › | Recorta os pedidos "do período" |
| **Itens Comprados** | `selectedItems: string[]` | `MultiSelectDropdown` | Mantém clientes que compraram ≥1 dos itens **no período** |
| **Qtd. Compras** | `purchaseCount: string[]` | `MultiSelectDropdown` | Filtra por **pedidos de vida** |
| **Inativo antes de** | `inactiveBeforeDate` | input date + botão × | Última compra **de vida** anterior à data |

### Linha 2 (avançados)

| Filtro | Campos | O que faz |
|---|---|---|
| **Tempo de Recompra** | `recompraMinDays`, `recompraMaxDays` | dias entre a **1ª e a 2ª** compra de vida |
| **Filtro de Gasto (R$)** | `spendAmount` + `spendType` (`total` \| `average`) + `spendMode` (`above` ↑ \| `around` ±10% \| `below` ↓) | compara `faturamento_total_vida` ou `faturamento_total_vida / p_vida` |

---

## Como os filtros chegam ao backend

Não são query params do PostgREST — vão como **um único JSONB**:

```ts
supabase.rpc('fn_filter_customers', {
  p_filters: {
    searchQuery, dateFilter, customDateStart, customDateEnd,
    specificMonth, specificDay, specificYear, selectedItems,
    purchaseCount, inactiveBeforeDate, recompraMinDays,
    recompraMaxDays, spendAmount, spendType, spendMode
  },
  p_limit: pageSize,
  p_offset: (page - 1) * pageSize
})
```

**100% server-side** na tabela de clientes — os 10 filtros são resolvidos dentro de `fn_filter_customers`.

**Client-side residual (2 pontos):**
1. Dois `useEffect` de *saneamento* no `FilterBar` que removem de `selectedItems`/`purchaseCount` valores ausentes das listas disponíveis.
2. `ItemsModal` refaz o recorte de período **em JavaScript**.

---

## Fonte das opções dos dropdowns

`useFilterOptions.ts`:

| Opção | Fonte | Limitação |
|---|---|---|
| `availableItems` | RPC `fn_dashboard_top_items_overall(null, null)` | ⚠️ **`LIMIT 300`** — itens fora do top 300 **nunca aparecem no filtro** |
| `availablePurchaseCounts` | `vw_clientes_consolidados`, `order('total_pedidos' desc).limit(1)` | gera `['1'..'max']` (fallback 15). Se o maior cliente tem 80 pedidos, o dropdown ganha **80 opções** |

> A RPC tem tratamento especial para o valor `'10+'`, mas **a UI nunca o produz** — código morto no SQL.

---

## 🐛 Problemas confirmados

### 🔴 "Tempo de Recompra" retorna sempre zero clientes
Bug de window function em `fn_filter_customers`: `nth_value(..., 2)` sem cláusula de frame explícita retorna `NULL` na primeira linha, tornando `gap_days` sempre `NULL`. Como `NULL >= v_recompra_min` é `NULL` (= falso no `WHERE`), **todos os clientes são descartados assim que Mín. ou Máx. é preenchido**.

Detalhes e correção em [[BD - RPCs]].

### 🔴 Fuso horário — KPI e tabela discordam
| Componente | Como calcula os limites |
|---|---|
| `KPICards` | **no fuso local do navegador**, envia `toISOString()` |
| `CustomersTable` | envia strings (`'2026-08'`) e a RPC recalcula com `date_trunc` **em UTC** |

**Para o mesmo filtro "do mês", KPI e tabela usam janelas deslocadas em até 3 horas.** Pedidos feitos entre 21h e 24h do último dia do mês caem em meses diferentes nos dois componentes.

### 🔴 Os KPIs ignoram 6 dos 10 filtros
`fn_dashboard_scorecards` só aceita `p_start`/`p_end`. Ver [[MM - Dicionario de Metricas]] — é o descompasso mais visível do produto.

### 🟠 Sem debounce em nada
Ver [[TELA - Painel Principal]].

### 🟠 `dateFilter: 'custom'` vazio mudou de semântica
O motor legado devolvia **nada** quando nenhuma data era preenchida; a RPC devolve **tudo** (`v_custom_start IS NULL AND v_custom_end IS NULL` → passa). Quem lembra do comportamento antigo vai achar que quebrou.

### 🟠 "Selecionar Todos" no MultiSelect é o caminho mais caro do sistema
Dispara `onChange(options)` com até **300 strings**. A RPC então faz, para **cada linha** de `vendas_marketing`, um `jsonb_array_elements` + 10 `jsonb_path_query_first` comparados contra um array de 300 elementos.

### 🟡 Faltam recursos básicos
- Não há **botão "limpar filtros"** global.
- Não há **persistência** do estado (URL ou localStorage) — recarregar perde tudo, e não dá para compartilhar um recorte com um colega.

## Ver também

- [[TELA - Painel Principal]] · [[BD - RPCs]] · [[MM - Dicionario de Metricas]]
