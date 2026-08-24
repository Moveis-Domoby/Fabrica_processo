---
titulo: Stack e Convenções
tipo: referencia
atualizado: 2026-08-06
tags: [stack, dependencias, convencoes]
---

# 🧰 Stack e Convenções

## Identificação

- **Nome do pacote:** `planilha-de-recompra`
- **Projeto Supabase:** `hftyremdlnuzsgfozciv` (ref hardcoded nas funções `tick_*` — ver [[BD - Seguranca e RLS]])
- **Repositório:** git local, com `supabase/` versionado

## Dependências de produção

| Pacote | Versão | Uso no projeto |
|---|---|---|
| `react` / `react-dom` | ^19.2.7 | UI |
| `@supabase/supabase-js` | ^2.110.1 | cliente PostgREST + RPC + `functions.invoke` |
| `@tanstack/react-query` | ^5.101.4 | cache — **só em 4 dos 13 hooks** |
| `@tanstack/react-virtual` | ^3.14.9 | ⚠️ **instalada e nunca usada** |
| `recharts` | ^3.9.2 | os 4 gráficos cartesianos (heatmap e top-itens são HTML/CSS puro) |
| `date-fns` | ^4.4.0 | formatação com locale `ptBR` |
| `papaparse` | ^5.5.4 | export CSV das listas de disparo (delimitador `;`) |
| `react-hot-toast` | ^2.6.0 | toasts — subutilizado |
| `lucide-react` | ^1.23.0 | ícones |
| `clsx` + `tailwind-merge` | — | composição de classes (`cn()` em `src/lib/utils.ts`) |

## Dependências de desenvolvimento

`vite ^8.1.1` · `typescript ~6.0.2` · `tailwindcss ^3.4.19` · `oxlint ^1.71.0` (não ESLint) · `supabase ^2.111.0` (CLI) · `@vitejs/plugin-react ^6.0.3` · `postcss` + `autoprefixer`

## Scripts

```bash
npm run dev                   # vite
npm run build                 # tsc -b && vite build
npm run lint                  # oxlint
npm run preview               # vite preview

npm run supabase:start        # sobe o stack local
npm run supabase:stop
npm run supabase:status
npm run supabase:db:reset
npm run supabase:migration:new
npm run supabase:migration:down
```

> [!warning] Script quebrado
> `supabase:migration:up` aponta para `supabase/migrations/01_server_side_metrics.sql`, arquivo que **não existe** (o nome real é `20260801024900_server_side_metrics.sql`). Usar `supabase db push` no lugar.

## Estrutura de pastas

```
src/
├── App.tsx              # shell, roteamento por estado, tema, estado de filtros
├── main.tsx             # QueryClient global
├── types.ts             # todas as interfaces
├── index.css            # variáveis de tema HSL
├── components/
│   ├── FilterBar.tsx           KPICards.tsx        CustomersTable.tsx
│   ├── AnalyticsDashboard.tsx  ErrorBoundary.tsx   MultiSelectDropdown.tsx
│   ├── CustomerLifetimeModal.tsx  ItemsModal.tsx   TransitionHistoryModal.tsx
│   ├── ListasDropdown.tsx
│   ├── Dashboard/       # 6 painéis do dashboard
│   └── ListasDisparo/   # 7 componentes do módulo de campanhas
├── data/queries.ts      # camada react-query (4 hooks)
├── hooks/               # camada useEffect cru (13 arquivos, 5 mortos)
└── lib/
    ├── supabase.ts      # cliente
    ├── utils.ts         # cn()
    ├── utils/           # client.ts currency.ts items.ts phone.ts
    ├── disparo/         # api.ts timers.ts
    └── datacrazy/       # client.ts (morto)

supabase/
├── functions/           # 9 Edge Functions Deno
├── migrations/          # 8 arquivos SQL
├── cron_agendamentos.sql
└── seed.sql             # ~2,4 MB — não abrir sem necessidade
```

## Convenções observadas no código

- **Idioma:** nomes de tabela, coluna, função SQL e Edge Function em **português**; nomes de componente e hook React em inglês/misto. Manter esse padrão.
- **Migrations:** timestamp `AAAAMMDDHHMMSS_descricao_em_ingles.sql`.
- **RPCs:** prefixo `fn_dashboard_*` para métricas de painel, `fn_filter_*` para segmentação, `tick_*` para disparadores de sync.
- **Views:** prefixo `vw_`.
- **Enums:** `status_*`, `motivo_*`, `tipo_*`, `categoria_*` — todos em `public`.
- **IDs de teste:** vários botões do módulo de disparo têm `id` estável (`btn-disparar-lista`, `btn-confirmar-disparo`, `intervalo-disparo-input`). Preservar ao refatorar.

## Utilitários compartilhados

| Arquivo | Exporta |
|---|---|
| `lib/utils/phone.ts` | `normalizarTelefone` (dígitos, corta DDI `55` se `>11`), `formatPhone` (`(XX) XXXXX-XXXX`) |
| `lib/utils/currency.ts` | `formatCurrency` (BRL) |
| `lib/utils/items.ts` | `extractItemName`, `extractItemValue`, `parseItems` — a versão JS da cascata de caminhos JSON |
| `lib/utils/client.ts` | helpers de identidade de cliente |
| `lib/disparo/timers.ts` | `addDiasUteisSemDomingo`, `addDiasCorridos` |

> [!danger] Duplicação crítica
> `normalizarTelefone` está **reimplementada em 5 lugares** (4 Edge Functions + `lib/utils/phone.ts`) e `formatarTelefoneDataCrazy` em 3. As regras hoje são equivalentes, mas nada garante que continuem — e a atribuição de venda depende dos dois lados normalizarem igual. Ver [[DT - Indice de Problemas Conhecidos|DT-D34]].

## Variáveis de ambiente

Front (`.env.local`, prefixo `VITE_`): URL e chave anon do Supabase.

Edge Functions (secrets do Supabase):
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `DATACRAZY_WEBHOOK_TRIGGER_URL` — a URL de gatilho da automação (é o próprio segredo)
- `DATACRAZY_WEBHOOK_SECRET` — validado no header `x-api-key` do webhook de entrada
- credenciais OAuth do Tiny

> [!warning] Não há `supabase/config.toml` versionado declarando `verify_jwt` por função. O webhook do DataCrazy precisa de `--no-verify-jwt` para funcionar — é o ponto mais provável de divergência entre o repositório e o que está de fato deployado.
