---
titulo: BD — Migrations (evolução cronológica)
tipo: banco-de-dados
atualizado: 2026-08-06
tags: [banco, migration, historico, bugs]
---

# 🧬 BD — Migrations

Oito arquivos em `supabase/migrations/`. Lidos em ordem, contam a história do banco.

---

## `20260801024816_remote_schema.sql` — baseline (33 KB)

**Não é um arquivo autoral:** é o `supabase db pull` do estado que já existia em produção.

Estabelece: privilégios default (`ALTER DEFAULT PRIVILEGES` para `anon`/`authenticated`/`service_role`), extensions, os 5 ENUMs, as 8 tabelas com constraints/índices/comentários, as policies de RLS, as 2 views e **todas** as funções `fn_dashboard_*` e `tick_*`.

Detalhe de infraestrutura: `DROP EXTENSION pg_net;` seguido de `CREATE EXTENSION pg_cron WITH SCHEMA pg_catalog;` e `CREATE EXTENSION pg_net WITH SCHEMA public;` — recriação para fixar `pg_net` em `public`.

---

## `20260801024900_server_side_metrics.sql` — replay quase no-op

Cronologicamente 44 segundos depois do dump, mas **conceitualmente anterior**: é o arquivo original que criou as métricas server-side, mantido no histórico. Como o dump já contém tudo, é idempotente (`CREATE OR REPLACE`, `CREATE INDEX IF NOT EXISTS`).

O comentário no cabeçalho — *"Run this in your Supabase SQL Editor"* — confirma que foi escrito para execução manual e depois formalizado.

**Contribuição real:** os índices `idx_vendas_marketing_data_compra`, `idx_vendas_marketing_telefone`, `idx_membros_status`, `idx_membros_lista_id`. Os dois de vendas **duplicam** índices `idx_vendas_mkt_*` que já existiam.

---

## `20260801025709_fix_items_null_bug.sql` — 🐛 BUG 1: itens sumindo do relatório

Altera `fn_dashboard_items` e `fn_dashboard_top_items_overall`.

### O bug

A cascata de resolução do nome era:

```sql
COALESCE(
  jsonb_path_query_first(item, '$.item.produto.descricao')::text,
  jsonb_path_query_first(item, '$.item.produto.nome')::text,
  ...
)
```

`jsonb_path_query_first` devolve **SQL NULL** quando o caminho **não existe** — aí o `COALESCE` avança normalmente. Mas quando o caminho **existe e contém JSON `null`**, ela devolve o valor jsonb `null` e `::text` produz a **string literal `'null'`**, que **não é SQL NULL**.

O `COALESCE` parava ali com `i_name = 'null'`, e a cláusula final `WHERE i_name IS NOT NULL AND i_name != 'null'` **descartava a linha inteira** — em vez de tentar `$.produto.nome`, `$.descricao` etc.

**Resultado:** todo pedido cujo primeiro caminho existisse com valor nulo **desaparecia** do heatmap e do Top Itens, mesmo tendo nome válido em outro campo. Subcontagem silenciosa.

### A correção

Envolver cada um dos 9 caminhos em `NULLIF(..., 'null')`, convertendo a string `'null'` em SQL NULL e deixando o `COALESCE` prosseguir.

> [!note] A assimetria que causou o bug
> Os caminhos de **quantidade** já tinham `NULLIF(..., 'null')` desde a versão original. Só os de **nome** não tinham. Foi um descuido, não um desconhecimento.

---

## `20260801030000_fix_transitions_aggregation_and_pii.sql` — 🐛 BUG 2: volume + PII

Preserva a versão antiga de `fn_dashboard_transitions` num bloco comentado ("Backup da versão antiga caso dê problema") e cria **duas funções novas**.

### Os dois problemas

**① Agregação no lugar errado.** `fn_dashboard_transitions` devolvia **uma linha por transição de compra de todo o banco** e o front agrupava em JavaScript. Além do custo, o PostgREST corta em ~1000 linhas por padrão — **o gráfico de transições estava simplesmente errado em bases grandes**, calculado sobre um recorte arbitrário.

**② PII.** Cada linha carregava `client_id`, que é o **telefone do cliente**. Um gráfico agregado estava trafegando a base de telefones inteira para o navegador.

### A correção

| Nova função | Papel |
|---|---|
| `fn_dashboard_transitions_summary` | só `purchase_number`, `avg_days`, `client_count` agregados no servidor. *"Gráfico: só o agregado por etapa (nenhum dado pessoal)"* |
| `fn_dashboard_transition_clients` | drill-down sob demanda, filtrado por uma etapa e paginado. *"Só quando o usuário clica numa barra"* |

> [!bug] Correção incompleta
> A função legada `fn_dashboard_transitions` **não foi dropada** e o hook `useTransitionData.ts` continua chamando-a. Enquanto esse hook for importado por alguém, o vazamento volta.
> E o mais fundamental: `vendas_marketing` tem policy `FOR SELECT USING (true)`, então **a base completa de nomes e telefones já é publicamente legível** com a chave anon. Blindar a RPC sem blindar a tabela não muda o risco real.

---

## `20260801041429_add_name_to_transition_clients.sql`

Ajuste de UX no drill-down: o `client_id` projetado passa de telefone-primeiro para **nome-primeiro**, com o comentário *"Prioriza nome_cliente. Se não existir, cai pro telefone."* — a lista mostrava números crus e passou a mostrar nomes.

O `PARTITION BY` **não** foi alterado. Daí a assimetria rótulo ≠ chave descrita em [[BD - RPCs]].

Do ponto de vista de PII, é um **recuo parcial** da migration anterior: troca-se um dado pessoal (telefone) por outro (nome).

---

## `20260801042738_change_items_count_logic.sql` — 📏 mudança semântica

Altera `fn_dashboard_items` e `fn_dashboard_top_items_overall`.

Removeu-se a expressão `item_qtd` (cascata sobre `$.item.quantidade` / `$.quantidade` / `$.quantity` / `$.qtd`, default `1`) e a agregação passou de:

```sql
SUM(item_qtd)::integer AS quantidade   -- unidades vendidas
```
para:
```sql
COUNT(*)::integer AS quantidade        -- ocorrências (linhas de pedido)
```

> [!info] Não é correção de bug — é redefinição de métrica
> `quantidade` deixou de significar "unidades vendidas" e passou a significar "em quantos pedidos o produto apareceu".
>
> **Motivação provável:** os campos de quantidade no JSON do Tiny eram pouco confiáveis (formatos variados, ausência frequente caindo no default `1`), tornando o Top Itens instável. Contar ocorrências é robusto e mede **popularidade**, não volume.
>
> **Efeito colateral:** o heatmap e o Top Itens deixaram de ser comparáveis com `vendas_marketing.numero_itens` e `vw_clientes_consolidados.total_itens`, que continuam somando unidades. **Duas noções de "itens" coexistem no produto** — ver [[MM - Dicionario de Metricas]].

---

## `20260801044631_add_dates_to_transition_clients.sql`

`DROP FUNCTION IF EXISTS fn_dashboard_transition_clients(...)` seguido de recriação — o `DROP` é obrigatório porque o **tipo de retorno mudou** (`CREATE OR REPLACE` não permite alterar a assinatura do `RETURNS TABLE`).

Acrescenta `prev_date` e `curr_date`, para que o drill-down mostre as datas das duas compras que formaram o intervalo, não só o número de dias.

---

## `20260801050500_filter_customers_rpc.sql` — a grande refatoração

Cria `fn_filter_customers` — *"add server-side filtering for paginated customers list"*.

É a migração de **maior impacto arquitetural depois do baseline**: move toda a segmentação (busca, período, produtos, contagem de pedidos, inatividade, gap de recompra, faixa de gasto) do navegador para o Postgres, com paginação e `total_count` embutido. Elimina o padrão anterior de baixar `vendas_marketing` inteira para o cliente.

Registro completo da sessão em [[handoff_2026_08_01]].

⚠️ Introduziu o bug do `gap_days` sempre NULL — ver [[BD - RPCs]].

---

## Convenção para as próximas migrations

> [!tip] Padrão a seguir
> - Nome: `AAAAMMDDHHMMSS_descricao_em_ingles.sql`
> - Comentário de cabeçalho explicando **por quê**, não só o quê
> - Se muda o tipo de retorno de uma função → `DROP FUNCTION` explícito antes
> - Se altera semântica de métrica → atualizar [[MM - Dicionario de Metricas]] **na mesma sessão**
> - Se corrige um bug → registrar em [[DT - Indice de Problemas Conhecidos]] com o ID e marcar resolvido
