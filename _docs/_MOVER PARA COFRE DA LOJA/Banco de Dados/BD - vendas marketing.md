---
titulo: BD — vendas_marketing
tipo: banco-de-dados
prioridade: critica
atualizado: 2026-08-06
tags: [banco, tabela, tabela-fato]
---

# 📊 BD — `vendas_marketing`

> [!abstract] O que é
> A **tabela-fato central**. Espelho desnormalizado de cada pedido vindo do ERP Tiny. É a base de 100% das métricas de recompra e LTV. Se ela estiver errada, tudo está errado.

## Colunas

| Coluna | Tipo | Constraints |
|---|---|---|
| `id` | `uuid` | **PK**, `DEFAULT gen_random_uuid()`, NOT NULL |
| `numero_pedido` | `varchar` | NOT NULL, **UNIQUE** — chave de idempotência do sync |
| `nome_cliente` | `varchar` | NOT NULL |
| `telefone_cliente` | `varchar` | **NULL permitido** ⚠️ |
| `data_compra` | `timestamptz` | NOT NULL |
| `valor_pedido` | `numeric(10,2)` | NOT NULL |
| `numero_itens` | `integer` | NOT NULL — **unidades**, não linhas |
| `itens_comprados` | `jsonb` | NOT NULL — sem contrato fixo ⚠️ |
| `created_at` | `timestamptz` | NOT NULL, `DEFAULT timezone('utc', now())` |

**Sem FKs.** Não há tabela de clientes nem de produtos.

## Índices

| Índice | Colunas | Nota |
|---|---|---|
| `vendas_marketing_pkey` | `id` | |
| `vendas_marketing_numero_pedido_key` | `numero_pedido` | único |
| `idx_vendas_mkt_pedido` | `numero_pedido` | 🔁 redundante com o acima |
| `idx_vendas_marketing_data_compra` | `data_compra` | usado pelos filtros de período |
| `idx_vendas_marketing_telefone` | `telefone_cliente` | |
| `idx_vendas_mkt_telefone` | `telefone_cliente` | 🔁 duplicado |

> [!danger] O índice que falta
> Nenhum índice cobre a expressão de identidade `COALESCE(NULLIF(TRIM(telefone_cliente),''), nome_cliente)`. Todas as window functions de transição e todo `GROUP BY` de cliente fazem **seq scan + sort da tabela inteira**. Ver [[MM - Identidade do Cliente]].

## Quem escreve

Apenas as Edge Functions do Tiny, com `service_role`:
- `tiny-historico-mkt` (carga inicial)
- `tiny-incremental-sync` (regime)
- `tiny-auditoria-sync` (reconciliação)

Upsert por `numero_pedido`. Ver [[INT - Edge Functions]].

## Quem lê

| Consumidor | Como |
|---|---|
| `fn_filter_customers` | RPC — motor da tabela de clientes |
| `fn_dashboard_scorecards` | RPC |
| `fn_dashboard_revenue_chart` | RPC |
| `fn_dashboard_purchase_frequency` | RPC |
| `fn_dashboard_items` / `_top_items_overall` | RPC — explode `itens_comprados` |
| `fn_dashboard_transitions_summary` / `_transition_clients` | RPC — window functions |
| `vw_clientes_consolidados` | view |
| `CustomerLifetimeModal` | PostgREST direto ⚠️ sem paginação |
| `ItemsModal` | PostgREST direto |
| `verificar-vendas-disparo` | Edge Function — atribuição de venda |

## `itens_comprados` — o JSONB sem contrato

O formato **varia entre pedidos** e não é validado na ingestão. Existem dois problemas empilhados:

### ① Às vezes é um array, às vezes é uma string contendo um array

Por isso toda RPC que lê itens tem:

```sql
CASE
  WHEN jsonb_typeof(v.itens_comprados) = 'array'  THEN v.itens_comprados
  WHEN jsonb_typeof(v.itens_comprados) = 'string'
       AND (v.itens_comprados#>>'{}') LIKE '[%'   THEN (v.itens_comprados#>>'{}')::jsonb
  ELSE '[]'::jsonb
END
```

### ② O nome do produto pode estar em 10 caminhos diferentes

Cascata de `COALESCE` na ordem de prioridade:

```
$.item.produto.descricao → $.item.produto.nome → $.produto.descricao
→ $.produto.nome → $.item.descricao → $.item.nome
→ $.descricao → $.nome → $.name → o próprio elemento se for string
```

Cada um envolvido em `NULLIF(..., 'null')` — sem isso, um caminho que **existe com valor JSON null** vira a string literal `'null'`, o `COALESCE` para ali e a linha é descartada. Foi exatamente o bug corrigido pela migration `20260801025709`. Ver [[BD - Migrations]].

A versão JavaScript equivalente está em `src/lib/utils/items.ts` (`extractItemName`, `extractItemValue`, `parseItems`).

### Consequências

- **Nenhum índice GIN** sobre `itens_comprados`. Todo filtro por produto faz *full scan + expansão de array* da tabela inteira. É o caminho mais caro do sistema.
- **O nome do produto é a chave de agrupamento.** Qualquer variação de grafia ou espaço no ERP cria um "produto" novo no relatório.
- **Não existe SKU** em lugar nenhum do modelo — só descrição textual.

> [!success] Correção proposta
> Normalizar numa tabela filha:
> ```sql
> CREATE TABLE vendas_marketing_itens (
>   venda_id   uuid REFERENCES vendas_marketing(id) ON DELETE CASCADE,
>   sku        text,
>   descricao  text NOT NULL,
>   quantidade integer NOT NULL DEFAULT 1,
>   valor_unitario numeric(10,2)
> );
> CREATE INDEX ON vendas_marketing_itens (descricao);
> CREATE INDEX ON vendas_marketing_itens (venda_id);
> ```
> Resolve simultaneamente performance, indexação e a ambiguidade de "itens" descrita em [[MM - Dicionario de Metricas]].

## RLS

`ENABLE ROW LEVEL SECURITY` com a policy `"Permitir leitura para o front-end"` — `FOR SELECT USING (true)`.

Ou seja: **leitura pública**, escrita bloqueada para `anon` (o sync usa `service_role`, que ignora RLS).

> [!warning] A base inteira de nomes, telefones, datas e valores é legível por qualquer um que tenha a chave anon — que está no bundle do Vite. Ver [[BD - Seguranca e RLS]].

## Campos que o TypeScript declara e não existem

`src/types.ts` → `SaleRecord` declara `instagram_cliente: string`. **Essa coluna não existe na tabela.** Também declara `telefone_cliente: string` (não-nulo) quando a coluna é nullable.

## Ver também

- [[MM - Identidade do Cliente]] · [[BD - RPCs]] · [[INT - Tiny ERP Olist]]
