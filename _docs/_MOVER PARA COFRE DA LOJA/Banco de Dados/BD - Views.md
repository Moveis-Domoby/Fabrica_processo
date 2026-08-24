---
titulo: BD — Views
tipo: banco-de-dados
atualizado: 2026-08-06
tags: [banco, view, kpi]
---

# 👓 BD — Views

Duas views comuns. **Nenhuma materialized view** existe no projeto.

---

## `vw_clientes_consolidados`

Agrupa `vendas_marketing` por identidade de cliente. Criada no baseline e re-emitida idêntica em `20260801024900`.

```sql
GROUP BY COALESCE(NULLIF(TRIM(telefone_cliente), ''), nome_cliente)
```

| Coluna | Expressão |
|---|---|
| `id_cliente` | `COALESCE(NULLIF(TRIM(telefone_cliente),''), nome_cliente)` |
| `nome_cliente` | `MAX(nome_cliente)` |
| `telefone_cliente` | `MAX(telefone_cliente)` |
| `total_pedidos` | `COUNT(id)` |
| `faturamento_total` | `SUM(valor_pedido)` |
| `total_itens` | `SUM(numero_itens)` — **unidades** |
| `primeira_compra` | `MIN(data_compra)` |
| `ultima_compra` | `MAX(data_compra)` |

**Consumida por:** `useTopClientsData` (tabelas Top 50 Recompradores e Clientes Recordes) e `useFilterOptions` (para descobrir o máximo de pedidos e popular o dropdown "Qtd. Compras").

> [!warning] Herda integralmente o problema de identidade
> Como agrupa pela expressão sem normalizar telefone, o mesmo cliente aparece duas vezes na Top 50 se tiver variantes de número. Ver [[MM - Identidade do Cliente]].

> [!note] Views executam com privilégios do dono
> Ao contrário da tabela `vendas_marketing` (que tem RLS `SELECT`-only), a view não respeita as policies da tabela base da mesma forma. Vale revisar ao fechar a segurança.

---

## `vw_scorecards_lista`

KPIs consolidados por campanha. `listas_disparo l LEFT JOIN listas_disparo_membros m`, `GROUP BY l.id`.

O arquivo avulso `update_roi.sql` na raiz do projeto contém **exatamente a mesma definição** — foi o script que introduziu o cálculo de custo baseado em `tarifa_aplicada`, e o baseline já o incorpora. Mantê-lo é redundante mas inofensivo.

### Passthrough
`lista_id`, `nome`, `status`, `custo_disparo`, `tarifa_aplicada`

### Contagens

| Coluna | Definição |
|---|---|
| `total_membros` | `COUNT(m.id)` |
| **`total_enviados`** | `COUNT(*) FILTER (data_envio IS NOT NULL AND (motivo_perda IS NULL OR motivo_perda <> 'erro_envio_mensagem'))` |
| `total_respondidos` | `data_resposta IS NOT NULL` |
| `total_ganhos` / `total_perdidos` | por `status` |
| `total_sem_resposta` | perdido + `sem_resposta_no_prazo` |
| `total_expirados_sem_resultado` | perdido + `prazo_resultado_expirado` |
| `total_negocio_perdido_crm` | perdido + `negocio_perdido_crm` — ⚠️ **sempre 0**, ninguém grava esse motivo |
| `total_erros_envio` | `motivo_perda = 'erro_envio_mensagem'` |

> [!info] `total_enviados` é o denominador de tudo
> Envios com erro **não contam** nem no custo nem no denominador das taxas — exatamente o que o `DispararModal` promete ao usuário ("o custo final descontará os contatos que retornarem erro no envio").

### Métricas calculadas

| Coluna | Fórmula |
|---|---|
| `receita_gerada` | `COALESCE(SUM(valor_ganho) FILTER (status='ganho'), 0)` |
| `taxa_resposta_pct` | `round(100.0 × total_respondidos / NULLIF(total_enviados,0), 1)` |
| `taxa_conversao_pct` | `round(100.0 × total_ganhos / NULLIF(total_enviados,0), 1)` |
| `ticket_medio` | `receita_gerada / total_ganhos` se `> 0`, senão `0` |
| **`custo_total_real`** | `COALESCE(tarifa_aplicada × total_enviados, custo_disparo, 0)` |
| **`roi_pct`** | `round((receita − custo) / custo × 100, 1)` se `custo > 0`, senão **`NULL`** (UI mostra `—`) |

`roi_pct` é ROI clássico — lucro sobre investimento. **0% significa empate**, não prejuízo total.

**Consumida por:** `ListasDropdown.tsx` (badge de leads) e `ListasDisparoDetalhe.tsx` (os 9 scorecards).

> [!bug] O tipo TypeScript mente sobre esta view
> `src/types.ts` → `ScorecardsLista` declara `perdas_sem_resposta`, `perdas_prazo_expirado`, `perdas_crm`. Os nomes reais são `total_sem_resposta`, `total_expirados_sem_resultado`, `total_negocio_perdido_crm`. Qualquer uso desses três campos retorna `undefined` **sem erro de compilação**. Faltam também no tipo: `nome`, `status`, `custo_disparo`, `total_respondidos`, `total_ganhos`, `total_perdidos`.

## Ver também

- [[MM - Dicionario de Metricas]] · [[BD - Tabelas de Disparo]] · [[TELA - Listas de Disparo]]
