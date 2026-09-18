---
titulo: Comercial — Dicionário de Métricas
tipo: nota
atualizado: 2026-09-17
tags: [comercial, plataforma, metricas, definicoes, glossario]
---

# 📐 PLT — Comercial — Dicionário de Métricas

> [!info] Origem e estado
> Migrada do cofre da loja (Painel de Recompra) em 17/09/2026. Vale para o módulo Comercial na plataforma da fábrica — as RPCs foram copiadas **sem alteração** na SESSAO-19 e a paridade foi verificada ao centavo na SESSAO-20, então as definições abaixo valem no banco novo.

> [!warning] Regra de ouro
> Duas palavras do produto ainda têm **duas definições vivas ao mesmo tempo**: *itens* e *custo*. Antes de dizer que um número está errado, confira qual definição aquele componente está usando. *("Recorrente" foi unificado em 2026-09-09 — ver abaixo.)*

---

## 🔴 Termos ambíguos (resolver isso é dívida técnica)

### "Itens" — duas definições

| Onde | O que significa | Fonte |
|---|---|---|
| `vendas_marketing.numero_itens` | **unidades vendidas** | vindo do Tiny (hoje via a view sobre o pipeline da fábrica) |
| `vw_clientes_consolidados.total_itens` | soma dessas unidades | `SUM(numero_itens)` |
| Coluna "Itens" da tabela de clientes | unidades | `SUM(numero_itens)` no período |
| `fn_dashboard_items.quantidade` | **ocorrências** (linhas de item) | `COUNT(*)` desde a migration `20260801042738` do recompra |
| `fn_dashboard_top_items_overall.quantidade` | ocorrências | idem |

**Por que mudou:** a migration `20260801042738_change_items_count_logic.sql` trocou `SUM(item_qtd)` por `COUNT(*)` porque os campos de quantidade no JSON do Tiny eram pouco confiáveis (formatos variados, ausência caindo no default `1`). Contar ocorrências é robusto e mede **popularidade**, não volume. A decisão é defensável — e o rótulo da UI foi corrigido em 2026-09-08 (DT-G4: `SeasonalityHeatmap` passou a escrever "Em {count} pedido(s)", contagem mantida por decisão do time).

> [!todo] Decisão de fundo ainda pendente
> Ocorrências × unidades continua sendo uma escolha por métrica. A solução estrutural (tabela de itens + catálogo, DT-BD3) ficou na Sessão 3 do plano antigo — ver [[PLT - Comercial - Legado e Cutover]].

### "Recorrente" — ✅ UMA definição (unificado em 2026-09-09, decisão #4)

**Recorrente = cliente com 2 ou mais pedidos NA VIDA, independente do período filtrado.**

Vale em todos os lugares: `fn_dashboard_scorecards.recurrents` (KPIs e ScorecardsRow) e `fn_filter_customers.is_recorrente` (badges da tabela). Migration `20260909200000` do recompra (DT-F14), portada com o resto na S19; validado na loja: ano 2026 → KPI 558 = tabela 558.

Histórico: até a Fase E existiam duas definições ("recorrente do período" na tabela = 1ª compra anterior ao início do período); a decisão #4 (2026-09-08) escolheu **2+ na vida** e a tabela divergiu do KPI até 2026-09-09 (DT-F14, `handoff_2026_09_09_sessao0_1.md` (no `_Docs/Handoffs/` do repo antigo da loja — não migrado)).

> [!note] A definição unificada infla janelas curtas — comportamento conhecido e aceito
> "Recorrente" pelo histórico completo significa que quase todo mundo que compra num mês qualquer já é recorrente. A **Taxa de Recompra** é, portanto, uma métrica híbrida: numerador *lifetime*, denominador *período*. Em janelas curtas ela tende a 100%.

### "Custo da campanha" — duas definições

| Coluna | Origem |
|---|---|
| `listas_disparo.custo_disparo` | manual, legado |
| `vw_scorecards_lista.custo_total_real` | `COALESCE(tarifa_aplicada × total_enviados, custo_disparo, 0)` |

O `COALESCE` faz o fallback **silenciosamente**. Campanhas antigas e novas não são comparáveis sem olhar se `tarifa_aplicada IS NULL`.

---

## ✅ Métricas do painel principal (KPICards — `/comercial/recompra`)

Fonte única: `fn_dashboard_scorecards(p_filters jsonb)` — desde a Fase E (2026-09-08) recebe o **mesmo objeto de filtros** da tabela.

| Card | Fórmula |
|---|---|
| **Total Clientes** | `COUNT(DISTINCT identidade)` no período |
| **Total Pedidos** | `COUNT(id)` no período |
| **Faturamento** | `COALESCE(SUM(valor_pedido), 0)` no período |
| **Novos** | `total_clients − recurrents` |
| **Recorrentes** | clientes do período com `COUNT(id)` de vida ≥ 2 |
| **Taxa de Recompra** | `(recurrents / total_clients) × 100`, 1 casa |

> [!note] "Novos" não é aquisição
> Significa "cliente cuja vida inteira tem exatamente 1 pedido", não "cliente adquirido neste período". O card mede *unicidade de vida*.

---

## ✅ Métricas do Dashboard (ScorecardsRow — `/comercial/dashboard`)

Mesma RPC, com seletor de período próprio (default `all`).

| Card | Fórmula |
|---|---|
| Fat. Total | `SUM(valor_pedido)` no período — rótulo vira "(Período)" quando o seletor não está em "Tudo" (DT-G12, corrigido 2026-09-08) |
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

> [!warning] ROI em campanha em andamento parece prejuízo consolidado
> Enquanto houver membros abertos, Conversão 0% e ROI −100% são **parciais** — a view está certa (reconciliada em produção em 10/09), o problema é apresentação. Ficou planejado exibir "ROI (parcial)" (Sessão 8 do plano antigo, nunca executada).

---

## ⚠️ Métricas com pegadinha de leitura

### "Tempo médio entre compras" — truncamento (DT-BD7, aberto)

`EXTRACT(DAY FROM interval)` descarta as horas: 45 dias e 20 horas viram 45. A média fica **sistematicamente subestimada**. Correto: `EXTRACT(EPOCH FROM (...)) / 86400`.

### Semântica do período no TransitionChart (DT-G8, aberto)

O filtro `data_compra >= p_start` incide sobre a **compra de chegada**. Com o default de 3 meses, o gráfico responde:

> *"Dos clientes que fizeram a 2ª compra nos últimos 3 meses, quanto tempo eles levaram."*

E **não** "tempo médio entre compras nos últimos 3 meses". Nada na UI explica isso — fonte clássica de "o número não bate".

### Segmentação do PurchaseFrequencyChart é por período, não por vida

Com `period='all'` (default) coincide com a vida. Ao trocar para "6 meses", um cliente com 10 compras históricas mas 1 no semestre cai no balde **"1 compra"**. Nada na UI avisa. *(O erro de cálculo do Ticket Médio do gráfico — dividir por clientes — foi corrigido em 2026-09-08, DT-G5: hoje divide por pedidos do segmento.)*

### `LIMIT 15` silencioso (DT-BD8, aberto)

Segmentos com mais de 15 compras no período são descartados — a soma das barras de faturamento por segmento pode não bater com o card Fat. Total.

---

## 📏 Convenções de janela temporal (módulo de disparo)

| Timer | Unidade | Onde |
|---|---|---|
| `janela_resposta_dias` (default 3) | **dias úteis, pulando só domingo** (sábado conta, feriado não é tratado) | `addDiasUteisSemDomingo` |
| `janela_resultado_dias` (default 7) | **dias corridos** | `addDiasCorridos` |
| `intervalo_disparo_segundos` (default 60) | segundos, mas a granularidade real do cron é **1 minuto** | `enviar-proximo-disparo` |

## Ver também

- [[PLT - Comercial - Identidade do Cliente]] · [[PLT - Comercial - Maquina de Estados do Disparo]]
- [[PLT - Comercial - Telas]] · [[PLT - Comercial - Debito Tecnico]] · [[SUPA - Comercial - Dominio de Dados]]
