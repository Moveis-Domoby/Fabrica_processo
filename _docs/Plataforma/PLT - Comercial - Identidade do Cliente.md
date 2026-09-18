---
titulo: Comercial — Identidade do Cliente
tipo: nota
prioridade: critica
atualizado: 2026-09-17
tags: [comercial, plataforma, modelo-mental, identidade, causa-raiz]
---

# 👤 PLT — Comercial — Identidade do Cliente

> [!info] Origem e estado
> Migrada do cofre da loja (Painel de Recompra) em 17/09/2026. Vale para o módulo Comercial na plataforma da fábrica — as RPCs foram copiadas **sem alteração** na SESSAO-19, então todo o raciocínio desta nota continua valendo no banco novo. Referências de tabela atualizadas onde coube.

> [!danger] Esta é a decisão mais consequente do sistema inteiro
> **Não existe tabela de clientes no domínio Comercial.** A identidade é derivada em tempo de consulta, e essa escolha é a causa-raiz número 1 dos números que "não batem".
>
> *(Nota da migração: o banco da fábrica tem uma tabela `clientes` do pipeline de produção, que alimenta a view `vendas_marketing` — mas as RPCs do Comercial **não a usam como chave**: seguem derivando a identidade da expressão abaixo. Unificar as duas coisas é decisão futura, fora do escopo da união.)*

## A regra atual

Em **toda** RPC e view do módulo, o cliente é:

```sql
COALESCE(NULLIF(TRIM(telefone_cliente), ''), nome_cliente)
```

Traduzindo: *"o cliente é o telefone dele; se não tiver telefone, é o nome."*

Aplicada em: `vw_clientes_consolidados`, `fn_dashboard_scorecards`, `fn_dashboard_purchase_frequency`, `fn_dashboard_transitions_summary`, `fn_dashboard_transition_clients`, `fn_filter_customers` — todas hoje no banco da fábrica, lendo a view `vendas_marketing` ([[SUPA - Comercial - Dominio de Dados]]).

O diagnóstico de 15/09 confirmou que o **formato de telefone é idêntico nos dois pipelines** (ex.: `(84) 98892-9748`) — a identidade não mudou ao trocar a fonte da view.

## Por que isso quebra

### ① O telefone não é normalizado no agrupamento

Só `TRIM` é aplicado. Nenhuma remoção de máscara, DDI ou espaço.

Se a base tem `84999674564` e `5584999674564`, esses são **dois clientes distintos** para o Postgres.

> [!example] A prova está no próprio código
> `CustomerLifetimeModal.tsx` precisa buscar **4 variantes do mesmo telefone** (bruto, só dígitos, sem `55`, com `55`) para encontrar o histórico de um cliente. Se uma variante bastasse, o código não existiria.

> [!info] 📏 Impacto MEDIDO
> **Auditoria de 2026-09-09 (base da loja):** o risco estrutural é real, mas o impacto da não-normalização era mínimo naquele dia — 4.019 telefones brutos → 4.018 normalizados, **1 único par de variantes**. As 4 variantes do modal eram sintoma de uma base historicamente suja; a base atual está limpa (nada impede a próxima venda de criar variante nova).
>
> **O caso dominante é outro: vendas SEM telefone** (na auditoria, 50 vendas / 32 nomes distintos) — a identidade cai no nome, homônimos se fundem e o LTV distorce (cenário ③ abaixo).
>
> **Verificação da SESSAO-20 (16/09, dois bancos vivos):** clientes 4.090×4.092 e recorrentes 808×806 entre fábrica e loja — a "deriva de identidade" documentada na S19. A correção estrutural (DT-BD1) **não mudará os números de forma visível hoje** — é a hora ideal de fazê-la barato, antes que a base suje de novo. Usar as baselines (auditoria de 09/09 e comparação da S20) para validar o antes/depois.

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

Em `fn_dashboard_transition_clients` (desde a migration `20260801041429` do recompra, portada na S19):

```sql
-- o que é EXIBIDO (nome primeiro):
COALESCE(NULLIF(TRIM(nome_cliente), ''), telefone_cliente) AS cid
-- o que é AGRUPADO (telefone primeiro):
PARTITION BY COALESCE(NULLIF(TRIM(telefone_cliente), ''), nome_cliente)
```

O `client_id` devolvido **não é um identificador estável**: homônimos ficam indistinguíveis e o mesmo cliente aparece com rótulo diferente de outras RPCs.

### ⑤ Não há índice funcional

Nenhum índice cobre a expressão de identidade. Todo `GROUP BY` / `PARTITION BY` sobre ela força **seq scan + sort**. *(Nota da migração: com `vendas_marketing` virando **view**, o plano de execução agora depende dos índices das tabelas-base da fábrica — reavaliar com `EXPLAIN` no banco novo antes de assumir o mesmo custo.)*

### ⑥ A coluna órfã

`listas_disparo_membros.cliente_id uuid` existe, **não tem FK e não aponta para tabela nenhuma**. Resquício de um modelo de cliente planejado e nunca implementado — o DDL foi copiado idêntico para a fábrica (S19), então a coluna órfã veio junto.

## A correção proposta (adaptar ao banco da fábrica)

> [!success] Plano em 3 passos, do menor risco ao maior — **escrito para a tabela do banco antigo**
>
> **Passo 1 — coluna gerada + índice (não quebra nada):**
> ```sql
> ALTER TABLE vendas_marketing
>   ADD COLUMN telefone_normalizado text
>   GENERATED ALWAYS AS (
>     NULLIF(REGEXP_REPLACE(COALESCE(telefone_cliente,''), '\D', '', 'g'), '')
>   ) STORED;
> -- corta o DDI 55 quando o número tem 12+ dígitos
> -- (via função IMMUTABLE se quiser embutir na coluna gerada)
> CREATE INDEX idx_vm_tel_norm ON vendas_marketing (telefone_normalizado);
> CREATE INDEX idx_vm_cid_data ON vendas_marketing (telefone_normalizado, data_compra);
> ```
> ⚠️ **Na fábrica isso não se aplica literalmente**: `vendas_marketing` é uma view. A normalização precisa entrar (a) na definição da view, (b) como coluna gerada na tabela-base do pipeline da fábrica, ou (c) numa função de normalização usada pelas RPCs. Qual das três é decisão da sessão que executar a correção — não decidida ainda.
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
> Esse número é exatamente quanto os KPIs vão mudar. **Comunique antes**, ou a correção vai parecer um bug novo. (Regra 4 da união: qualquer mudança de número visível é avisada antes.)

## Efeito colateral esperado da correção

Quando isso for corrigido, os números do dashboard mudam: menos clientes únicos, mais recompradores, taxa de recompra maior, mais transições no gráfico de intervalo. É o comportamento correto — mas precisa ser **anunciado, não descoberto**. Pelo impacto medido acima, hoje a mudança seria de ≈1 identidade fundida + o efeito dos sem-telefone.

## Ver também

- [[PLT - Comercial - Fluxo do Dado]] · [[PLT - Comercial - Debito Tecnico]] (DT-BD1)
- [[SUPA - Comercial - Dominio de Dados]] · [[PLT - Comercial - Legado e Cutover]] (Sessão 6 do plano antigo)
