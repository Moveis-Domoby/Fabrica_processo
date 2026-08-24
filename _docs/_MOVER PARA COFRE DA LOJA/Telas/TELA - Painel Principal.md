---
titulo: TELA — Painel Principal (Tabela de Clientes)
tipo: tela
atualizado: 2026-08-06
tags: [tela, tabela, clientes, front]
componente: src/components/CustomersTable.tsx
---

# 🖥️ TELA — Painel Principal (Tabela de Clientes)

**Arquivo:** `src/components/CustomersTable.tsx`
**Composição:** [[TELA - Filtros|`FilterBar`]] → `KPICards` → `CustomersTable`

## Origem dos dados

`useCustomersPaginated(page, pageSize = 50, filters)` → RPC **`fn_filter_customers`**.

Um único round-trip devolve **linhas + `total_count`** (subquery repetida em cada linha).

## Colunas (desktop)

| # | Cabeçalho | Campo | Origem SQL |
|---|---|---|---|
| 0 | *(checkbox)* | — | só em `isSelectionMode` |
| 1 | **Nome** | `c.nome` | `MAX(nome_cliente)` |
| 2 | **Telefone** | `formatPhone(c.telefone)` | `MAX(telefone_cliente)` |
| 3 | **Compra no Período** ⇅ | `c.ultima_compra` | `MAX(data_compra)` **do período** |
| 4 | **Total Vida** | `c.pedidos_vida` | `COUNT(*)` lifetime — badge clicável → `CustomerLifetimeModal` |
| 5 | **Disparos** | `disparosMap[normalizePhone(tel)]` | `listas_disparo_membros` via `useDisparosData` |
| 6 | **Itens** | `c.total_itens` | `SUM(numero_itens)` no período — **unidades** |
| 7 | **Faturamento** | `formatCurrency(...)` | `SUM(valor_pedido)` no período |
| 8 | **Ações** | "Ver Itens" | abre `ItemsModal` |

> `quantidade_pedidos` (pedidos **no período**) é retornado pela RPC, mapeado no hook e **nunca exibido**. A tabela mostra apenas pedidos de vida.

**Mobile (`md:hidden`):** cards com Nome, data, telefone e 4 mini-stats (Vida / Disparos / Itens / Faturamento) + botão "Ver Itens do Período".

## Ordenação e paginação

- **Ordenação:** definida **exclusivamente no servidor** (`ORDER BY u_compra_periodo DESC`). No front: `const sortedData = [...data]; // Data already sorted by RPC`.
- **Paginação:** `page` local, `pageSize = 50` fixo. Rodapé "Mostrando X a Y de Z" + Anterior/Próxima. Renderizado só quando `!loading && totalCount > 0`.

## Modais e ações

| Ação | Gatilho | Componente |
|---|---|---|
| Histórico de vida | badge "Total Vida" | `CustomerLifetimeModal` |
| Itens do período | botão "Ver Itens" | `ItemsModal` (elevado ao `App.tsx`) |
| Histórico de disparos | badge "Disparos" | `DisparosPopover` (inline) |
| Seleção múltipla | botão "Listas" | ativa `isSelectionMode` → `CriarListaModal` ou `AdicionarListaModal` |

---

## 🐛 Problemas confirmados

### 🔴 A ordenação é decorativa
`toggleSort()` altera `sortOrder`, o que **só troca o ícone** `ChevronUp`/`ChevronDown`. `sortedData` nunca é ordenado e `sortOrder` **não é enviado à RPC**. Clicar em "Compra no Período" **não muda nada**.

### 🔴 `page` não reseta ao mudar filtros — estado sem saída
Se o usuário está na página 5 (offset 200) e aplica um filtro que reduz o universo para 60 clientes:
1. a RPC devolve 0 linhas
2. `totalCount` vem de `rpcData[0].total_count`, que não existe → `totalCount = 0`
3. o rodapé de paginação **some** (condicional `totalCount > 0`)
4. aparece "Nenhum cliente encontrado"

**Não há como voltar para a página 1 sem recarregar a aplicação.**

**Correção:** `useEffect(() => setPage(1), [filters])`.

### 🟠 "Selecionar todos" seleciona só a página atual
`sortedData` = 50 linhas. Para criar uma lista de disparo a partir de um filtro amplo, o usuário precisa paginar e selecionar de 50 em 50. `selectedIds` **é** preservado entre páginas, mas o botão compara `selectedIds.size === sortedData.length`, dando falsos positivos.

**Correção sugerida:** um "selecionar todos os N resultados do filtro" que chame a RPC sem `limit` só com os identificadores.

### 🟠 Race condition sem guarda
`useCustomersPaginated` não tem `AbortController` nem flag `isMounted`. Digitar rápido na busca pode fazer **uma resposta antiga sobrescrever a nova**.

### 🟠 Sem debounce
Cada tecla na busca recria o objeto `filters` (nova identidade) → dispara `fn_filter_customers` (a RPC mais cara) **e** `fn_dashboard_scorecards`. Uma busca de 12 caracteres = **24 chamadas de RPC pesadas**.

**Correção:** `useDeferredValue` ou debounce de 300ms, e serializar `filters` na dependência.

### 🟡 Detalhes menores
- `colSpan={8}` na linha "Nenhum cliente encontrado" fica errado quando `isSelectionMode` está ativo (9 colunas).
- `key={idx}` nas linhas: ao paginar, o React reaproveita nós de linhas diferentes — o estado dos popovers de disparo pode vazar entre linhas. Usar `key={c.telefone}`.

---

## Modais relacionados

### `CustomerLifetimeModal`
Busca **4 variantes do telefone** (bruto, só dígitos, sem `55`, com `55`) com fallback `ilike('nome_cliente', '%nome%')`.

> [!warning] Dois problemas
> - O fallback por nome **pode misturar homônimos**.
> - `select('*')` sem limite e sem paginação — para clientes com histórico longo, traz `itens_comprados` (JSONB pesado) inteiro.
>
> E a existência das 4 variantes é a **prova** de que a base tem telefones não normalizados. Ver [[MM - Identidade do Cliente]].

### `ItemsModal`
> [!bug] Cache com chave incompleta — bug reproduzível
> ```ts
> const itemsCache: Record<string, any[]> = {};   // módulo, nunca invalidado
> const cacheKey = `${telefone}_${filters?.dateFilter}_${filters?.customDateStart}`;
> ```
> A chave **não inclui** `specificMonth`, `specificDay`, `specificYear` nem `customDateEnd`.
>
> Com `dateFilter='specificMonth'`, navegar de Julho para Agosto reusa a chave `telefone_specificMonth_` e **mostra os itens do mês anterior**.

Também usa `.eq('telefone_cliente', telefone)` **exato** (sem as variantes que o `CustomerLifetimeModal` implementa) — clientes identificados só por nome veem "Nenhum item registrado" sem erro.

E refaz o recorte de período **em JavaScript** (`record.data_compra.startsWith(specificMonth)`), divergindo da lógica do servidor.

## Ver também

- [[TELA - Filtros]] · [[BD - RPCs]] · [[PAINEL - Graficos do Dashboard]] · [[DT - Indice de Problemas Conhecidos]]
