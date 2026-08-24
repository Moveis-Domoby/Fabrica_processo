---
titulo: Modelo Mental — Fluxo do Dado
tipo: modelo-mental
atualizado: 2026-08-06
tags: [modelo-mental, pipeline, dados]
---

# 🌊 MM — Fluxo do Dado (do pedido no ERP até o pixel na tela)

> [!abstract] A pergunta que esta nota responde
> "Esse número na tela veio de onde?" — siga o caminho abaixo de trás para frente.

## O caminho completo

```
1. Pedido é criado no TINY ERP (venda no site, marketplace ou balcão)
                    ↓
2. tick_incremental_tiny() acorda por pg_cron
                    ↓  pg_net → net.http_post
3. Edge Function tiny-incremental-sync (Deno)
   · pega access_token de tiny_auth
   · GET /pedidos na API v3 (paginado, limit/offset)
   · GET /pedidos/{id} para cada pedido (os ITENS só existem no detalhe)
                    ↓  service_role
4. UPSERT em vendas_marketing (chave de idempotência: numero_pedido)
   · nome_cliente, telefone_cliente, data_compra, valor_pedido
   · numero_itens (unidades), itens_comprados (JSONB livre)
                    ↓
5. RPC agrega no Postgres (fn_dashboard_* / fn_filter_customers)
   · agrupa por COALESCE(NULLIF(TRIM(telefone_cliente),''), nome_cliente)
   · aplica janela de data, calcula window functions
                    ↓  PostgREST, chave anon
6. Hook React busca (react-query OU useEffect cru)
                    ↓
7. useMemo transforma → Recharts / HTML renderiza
```

## Os três modos de sincronização com o Tiny

| Modo | Function | Gatilho | O que faz |
|---|---|---|---|
| **Histórico** | `tiny-historico-mkt` | `tick_historico_tiny()` em loop | Carga inicial completa. Guarda o ponteiro em `tiny_sync_state` (`data_inicial`, `offset_atual`, `concluido`). **Auto-desagenda** o cron quando conclui. |
| **Incremental** | `tiny-incremental-sync` | `tick_incremental_tiny()` | Traz só o que mudou desde a última execução. É o modo de regime. |
| **Auditoria** | `tiny-auditoria-sync` | `tick_auditoria_tiny()` | Reconciliação — recaptura períodos para corrigir divergências. |

Todas com `timeout_milliseconds := 300000` (5 min) no `net.http_post`.

Autenticação separada: `tiny-auth-refresh` renova o par de tokens em `tiny_auth`. Ver [[INT - Tiny ERP Olist]] — o refresh token vale **apenas 24h** e, se expirar, exige reautorização manual por um humano.

## Onde o dado pode se perder ou distorcer

Marcados na ordem do fluxo:

**① No ERP → 4 (ingestão)**
- O telefone entra **como está no ERP**, sem normalização. `84999674564` e `5584999674564` viram dois clientes. Ver [[MM - Identidade do Cliente]].
- `itens_comprados` chega em formatos variados — às vezes array JSON, às vezes uma *string* contendo um array serializado. Por isso as RPCs têm o teste `jsonb_typeof(...) = 'string' AND ... LIKE '[%'`.
- Não há SKU em lugar nenhum do modelo. O produto é identificado **pela descrição textual** — qualquer variação de grafia cria um produto novo no relatório.
- Vendas de marketplace frequentemente chegam sem CPF e com telefone mascarado. Recompra *cross-channel* é estruturalmente difícil de medir aqui.

**② 4 → 5 (agregação no Postgres)**
- A identidade do cliente é **recomputada em toda consulta**, sem índice funcional cobrindo a expressão → seq scan + sort da tabela inteira.
- `EXTRACT(DAY FROM interval)` **trunca as horas**: 29 dias e 23h contam como 29.
- Truncamentos silenciosos: `LIMIT 15` na frequência de compra, `LIMIT 300` no top de itens. O usuário não é avisado de que há cauda além do corte.
- Buckets mensais (`TO_CHAR(data_compra,'YYYY-MM')`) usam o **timezone da sessão do banco (UTC)**.

**③ 5 → 6 (transporte)**
- Limite default de ~1000 linhas do PostgREST em queries diretas sem paginação (`useDisparosData`, `CustomerLifetimeModal`, `verificar-vendas-disparo`).

**④ 6 → 7 (front)**
- Os `KPICards` calculam os limites de data no **fuso local do navegador** e enviam `toISOString()`, enquanto a tabela envia strings (`'2026-08'`) e deixa a RPC recalcular em UTC. **Para o mesmo filtro "do mês", KPI e tabela usam janelas deslocadas em até 3 horas.**
- Meses sem venda simplesmente não existem no array retornado — a linha do `RevenueChart` "pula" o buraco e desenha uma reta contínua, sugerindo faturamento que não houve.
- O estado `loading` é retornado por todos os hooks e **descartado por todos os componentes**. Durante o fetch os gráficos mostram "Sem dados suficientes" — que o usuário lê como "o gráfico não está puxando os dados".

## A regra de ouro para debugar "o número não bate"

> [!tip] Ordem de investigação
> 1. **É filtro?** Os KPIs só recebem data. Se o número do card discorda da tabela, quase sempre é isso.
> 2. **É identidade?** Se o problema é contagem de clientes ou taxa de recompra, suspeite de telefone duplicado antes de qualquer outra coisa.
> 3. **É definição?** "Itens", "recorrente" e "custo" têm cada um **duas definições** vivas no sistema. Ver [[MM - Dicionario de Metricas]].
> 4. **É truncamento?** `LIMIT 15`, `LIMIT 300`, teto de 1000 linhas do PostgREST.
> 5. **É fuso?** Vendas entre 21h e 24h do último dia do mês caem em meses diferentes conforme o componente.

## Ver também

- [[MM - Identidade do Cliente]]
- [[MM - Dicionario de Metricas]]
- [[INT - Edge Functions]]
- [[BD - RPCs]]
