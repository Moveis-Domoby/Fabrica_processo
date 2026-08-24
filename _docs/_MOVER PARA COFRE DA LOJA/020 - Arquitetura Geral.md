---
titulo: Arquitetura Geral
tipo: arquitetura
atualizado: 2026-08-06
tags: [arquitetura, visao-geral]
---

# 🏗️ Arquitetura Geral

## Diagrama de camadas

```
┌──────────────────────────────────────────────────────────────┐
│  ERP TINY (OLIST)          │  CRM DATACRAZY                   │
│  API v3 · OAuth2 · REST    │  Automação de WhatsApp           │
└─────────────┬──────────────┴──────────────┬───────────────────┘
              │ pull (cron)                 │ push/pull (webhook)
              ▼                             ▼
┌──────────────────────────────────────────────────────────────┐
│  SUPABASE EDGE FUNCTIONS (Deno)                              │
│  tiny-auth-refresh · tiny-historico-mkt                      │
│  tiny-incremental-sync · tiny-auditoria-sync                 │
│  enviar-proximo-disparo · disparar-membro-individual         │
│  processar-timers-disparo · verificar-vendas-disparo         │
│  webhook-datacrazy-resposta                                  │
└─────────────┬────────────────────────────────────────────────┘
              │ service_role
              ▼
┌──────────────────────────────────────────────────────────────┐
│  POSTGRES (Supabase)                                         │
│  ┌── DOMÍNIO ANALÍTICO ──────┐  ┌── DOMÍNIO OPERACIONAL ──┐  │
│  │ vendas_marketing          │  │ listas_disparo          │  │
│  │ vw_clientes_consolidados  │  │ listas_disparo_membros  │  │
│  │ fn_dashboard_*            │  │ listas_disparo_eventos  │  │
│  │ fn_filter_customers       │  │ vw_scorecards_lista     │  │
│  └───────────────────────────┘  │ webhook_eventos_crm     │  │
│  ┌── INFRA DE SYNC ──────────┐  │ tarifas_mensagem_whats. │  │
│  │ tiny_auth · tiny_sync_st. │  └─────────────────────────┘  │
│  │ tick_*() + pg_cron/pg_net │                               │
│  └───────────────────────────┘                               │
└─────────────┬────────────────────────────────────────────────┘
              │ PostgREST + RPC (chave anon)
              ▼
┌──────────────────────────────────────────────────────────────┐
│  FRONT — React 19 + TypeScript + Vite + Tailwind             │
│  App.tsx (view: 'main' | 'dashboard' | 'listas')             │
│   ├─ FilterBar → KPICards → CustomersTable                   │
│   ├─ AnalyticsDashboard → 6 painéis + 2 tabelas              │
│   └─ ListasDisparoDetalhe → campanhas                        │
└──────────────────────────────────────────────────────────────┘
```

## Roteamento

**Não há router.** `src/App.tsx` mantém `view: 'main' | 'dashboard' | 'listas'` em `useState` e alterna com CSS. O dashboard permanece **montado mas oculto** (`opacity` / `pointerEvents`) — evita remount, ao custo de manter tudo em memória.

Consequência: não há URLs compartilháveis, nem estado de filtro na URL, nem histórico de navegação do browser.

## As duas camadas de dados (⚠️ incoerência estrutural)

Existem **dois padrões concorrentes** de acesso a dados no front:

### Camada A — `src/data/queries.ts` (react-query) ✅
`QueryClient` global em `main.tsx`: `staleTime 5min`, `gcTime 10min`, `refetchOnWindowFocus: false`, `retry: 1`. Os 4 hooks sobrescrevem para `staleTime 30s`.

| Hook | RPC |
|---|---|
| `useTopItemsOverallQuery` | `fn_dashboard_top_items_overall` |
| `useItemsDataQuery` | `fn_dashboard_items` |
| `useTransitionsSummaryQuery` | `fn_dashboard_transitions_summary` |
| `useTransitionsClientsQuery` | `fn_dashboard_transition_clients` |

Ponto positivo: as `queryKey` usam **strings ISO**, não objetos `Date` — o cache funciona de verdade.

### Camada B — `src/hooks/*.ts` (useState + useEffect cru) ⚠️
Sem cache, sem dedupe, sem `AbortController`, sem guarda de race condition.

`useCustomersPaginated`, `useScorecardsData`, `useRevenueChartData`, `usePurchaseFrequencyData`, `useTopClientsData`, `useFilterOptions`, `useDisparosData`, `usePeriodFilter`.

> [!bug] Consequência prática
> Dois componentes que chamam `useScorecardsData` com os mesmos parâmetros fazem **duas requisições**. E `useCustomersPaginated` depende do objeto `filters` inteiro — cada tecla digitada na busca recria a identidade do objeto e dispara a RPC mais cara do sistema. Sem debounce em lugar nenhum.

## Código morto confirmado

Nenhum import em todo o `src/`:

| Arquivo | O que era |
|---|---|
| `src/hooks/useDashboardData.ts` | carregava `vendas_marketing` inteira, de 1000 em 1000 |
| `src/hooks/useCustomerFilters.ts` | o motor de filtros client-side legado (~250 linhas) |
| `src/hooks/useItemsData.ts` | duplicata sem cache de `useItemsDataQuery` |
| `src/hooks/useTopItemsOverallData.ts` | idem |
| `src/hooks/useTransitionData.ts` | chama a RPC legada `fn_dashboard_transitions` (com PII) |
| `src/lib/datacrazy/client.ts` | classe REST do DataCrazy inteira |
| `src/components/ListasDisparo/ListasDisparoMain.tsx` | tela-índice de campanhas, órfã **e** quebrada |
| dependência `@tanstack/react-virtual` | declarada, nunca usada |

> [!note] Por que isso importa
> `useCustomerFilters.ts` define defaults **diferentes** dos que `App.tsx` usa de verdade (`dateFilter: 'specificMonth'` vs `'all'`). Quem ler o hook morto vai entender o sistema errado. Ver [[TELA - Filtros]].

## Tema dark/light

```tsx
const [theme, setTheme] = useState<'light'|'dark'>('dark');
useEffect(() => {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}, [theme]);
```

- Tailwind em modo `class`. Paleta em variáveis CSS HSL em `src/index.css`: `--background --foreground --card --primary --muted --accent --destructive --border --input --ring --radius`, definidas em `:root` (claro) e `.dark` (escuro).
- Primária: teal/esmeralda — `165 80% 32%` claro / `165 90% 45%` escuro.
- Recharts consome as mesmas variáveis (`stroke="hsl(var(--primary))"`), então os gráficos trocam de tema junto.

**Problemas:** sem persistência (`localStorage` não é usado em lugar nenhum do `src/`), sem detecção de `prefers-color-scheme`, sem script anti-FOUC, não é contexto (prop drilling). E cores hardcoded fora do sistema em vários gráficos (`hsl(142,71%,45%)`, `text-orange-400`, `text-purple-400`) que não respondem ao tema.

## Tratamento de erro

`ErrorBoundary` isolando o dashboard e o bloco principal. `react-hot-toast` configurado no `App.tsx` — mas o módulo de disparo usa `alert()`/`window.confirm()` nativos em vez dele.

## Ver também

- [[030 - Stack e Convencoes]]
- [[MM - Fluxo do Dado]]
- [[BD - Visao Geral]]
