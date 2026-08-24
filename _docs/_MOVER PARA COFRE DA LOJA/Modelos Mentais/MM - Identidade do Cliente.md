---
titulo: Modelo Mental — Identidade do Cliente
tipo: modelo-mental
prioridade: critica
atualizado: 2026-08-06
tags: [modelo-mental, identidade, causa-raiz]
---

# 👤 MM — Identidade do Cliente

> [!danger] Esta é a decisão mais consequente do sistema inteiro
> **Não existe tabela `clientes`.** A identidade é derivada em tempo de consulta, e essa escolha é a causa-raiz número 1 dos números que "não batem".

## A regra atual

Em **toda** RPC e view do sistema, o cliente é:

```sql
COALESCE(NULLIF(TRIM(telefone_cliente), ''), nome_cliente)
```

Traduzindo: *"o cliente é o telefone dele; se não tiver telefone, é o nome."*

Aplicada em: `vw_clientes_consolidados`, `fn_dashboard_scorecards`, `fn_dashboard_purchase_frequency`, `fn_dashboard_transitions_summary`, `fn_dashboard_transition_clients`, `fn_filter_customers`.

## Por que isso quebra

### ① O telefone não é normalizado no agrupamento

Só `TRIM` é aplicado. Nenhuma remoção de máscara, DDI ou espaço.

Se a base tem `84999674564` e `5584999674564` — e **ela tem**, prova abaixo — esses são **dois clientes distintos** para o Postgres.

> [!example] A prova está no próprio código
> `CustomerLifetimeModal.tsx` precisa buscar **4 variantes do mesmo telefone** (bruto, só dígitos, sem `55`, com `55`) para encontrar o histórico de um cliente. Se uma variante bastasse, o código não existiria.

**Efeito em cascata:**

| Métrica | O que acontece |
|---|---|
| `total_clients` | **infla** — a mesma pessoa conta 2× |
| `recurrents` | **desinfla** — quem comprou 2× fica com 1 compra em cada identidade |
| Taxa de Recompra | **cai artificialmente** (numerador menor, denominador maior) |
| `fn_dashboard_purchase_frequency` | empurra gente do balde "2 compras" para "1 compra" |
| `fn_dashboard_transitions_summary` | **perde transições inteiras** — sem 2ª compra, não há intervalo |
| LTV / faturamento por cliente | **subestimado**, dividido entre as identidades |

### ② Inconsistência interna: a busca normaliza, o agrupamento não

Dentro da **mesma função** `fn_filter_customers`:

```sql
-- na BUSCA (correto):
REGEXP_REPLACE(telefone_cliente, '\D', '', 'g') ILIKE '%' || digitos || '%'

-- no AGRUPAMENTO (não normaliza):
COALESCE(NULLIF(TRIM(telefone_cliente), ''), nome_cliente)
```

Buscar por um número encontra as duas variantes; agrupar mantém elas separadas.

### ③ Homônimos sem telefone são fundidos

Dois "João Silva" sem telefone viram **um único cliente** com LTV somado. Superestima o LTV desse registro e subestima a contagem de clientes.

### ④ Rótulo ≠ chave no drill-down de transições

Em `fn_dashboard_transition_clients` (após a migration `20260801041429`):

```sql
-- o que é EXIBIDO (nome primeiro):
COALESCE(NULLIF(TRIM(nome_cliente), ''), telefone_cliente) AS cid
-- o que é AGRUPADO (telefone primeiro):
PARTITION BY COALESCE(NULLIF(TRIM(telefone_cliente), ''), nome_cliente)
```

O `client_id` devolvido **não é um identificador estável**: homônimos ficam indistinguíveis e o mesmo cliente aparece com rótulo diferente de outras RPCs.

### ⑤ Não há índice funcional

Nenhum índice cobre a expressão `COALESCE(NULLIF(TRIM(telefone_cliente),''), nome_cliente)`. Todo `GROUP BY` / `PARTITION BY` sobre ela força **seq scan + sort da tabela inteira**. Os índices existentes são apenas `(data_compra)` e `(telefone_cliente)` — este último inútil para a expressão.

### ⑥ A coluna órfã

`listas_disparo_membros.cliente_id uuid` existe, **não tem FK e não aponta para tabela nenhuma**. É resquício de um modelo de cliente que foi planejado e nunca implementado.

## A correção proposta

> [!success] Plano em 3 passos, do menor risco ao maior
>
> **Passo 1 — coluna gerada + índice (não quebra nada):**
> ```sql
> ALTER TABLE vendas_marketing
>   ADD COLUMN telefone_normalizado text
>   GENERATED ALWAYS AS (
>     NULLIF(REGEXP_REPLACE(COALESCE(telefone_cliente,''), '\D', '', 'g'), '')
>   ) STORED;
>
> -- corta o DDI 55 quando o número tem 12+ dígitos
> -- (fazer via função IMMUTABLE se quiser embutir na coluna gerada)
>
> CREATE INDEX idx_vm_tel_norm ON vendas_marketing (telefone_normalizado);
> CREATE INDEX idx_vm_cid_data ON vendas_marketing (telefone_normalizado, data_compra);
> ```
>
> **Passo 2 — trocar a expressão de identidade em TODAS as RPCs de uma vez.**
> Não fazer uma por vez: durante a transição, painéis diferentes discordariam entre si.
>
> **Passo 3 — validar o impacto antes de subir:**
> ```sql
> -- quantos clientes se fundem?
> SELECT count(*) FILTER (WHERE n > 1) AS identidades_duplicadas
> FROM (
>   SELECT telefone_normalizado, count(DISTINCT telefone_cliente) n
>   FROM vendas_marketing
>   WHERE telefone_normalizado IS NOT NULL
>   GROUP BY 1
> ) t;
> ```
> Esse número é exatamente quanto os KPIs vão mudar. **Comunique antes**, ou a correção vai parecer um bug novo.

## Efeito colateral esperado da correção

Quando isso for corrigido, **os números do dashboard vão mudar visivelmente**: menos clientes únicos, mais recompradores, taxa de recompra maior, mais transições no gráfico de intervalo entre compras. É o comportamento correto — mas precisa ser anunciado, não descoberto.

## Ver também

- [[MM - Fluxo do Dado]]
- [[BD - vendas marketing]]
- [[DT - Indice de Problemas Conhecidos]]
