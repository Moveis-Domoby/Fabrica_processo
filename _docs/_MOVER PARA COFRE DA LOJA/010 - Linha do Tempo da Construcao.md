---
titulo: Linha do Tempo da Construção
tipo: contexto
atualizado: 2026-08-06
tags: [historia, evolucao, contexto]
---

# 📅 Linha do Tempo da Construção

> [!info] Por que esta nota existe
> Entender *a ordem* em que as coisas foram construídas explica quase todas as inconsistências do sistema. Muita coisa que hoje parece "estranha" é resquício de uma fase anterior que nunca foi limpa.

## Fase 1 — O esqueleto visual

**O que foi feito:** layout da tela principal, com paleta de cores completa em dark e light e o toggle de troca de tema. Alguns filtros já apareciam na barra superior, mas **ainda não funcionavam de acordo** — eram controles ligados a lógica incompleta ou a dados que ainda não existiam.

**O que sobrou disso hoje:**
- O sistema de tema via variáveis CSS HSL (`:root` / `.dark`) em `src/index.css`, com a cor primária teal/esmeralda `165 80% 32%` (claro) e `165 90% 45%` (escuro). Ver [[020 - Arquitetura Geral]].
- Os gráficos Recharts consomem essas mesmas variáveis, então trocam de tema junto — bom padrão que sobreviveu.
- ⚠️ O tema **não persiste** (sem `localStorage`), sempre volta pro dark ao recarregar. Ver [[DT - Indice de Problemas Conhecidos|DT-U8]].
- ⚠️ A regra `* { transition-colors }` global veio dessa fase e hoje custa performance em tabelas grandes.

## Fase 2 — O banco e o pipeline do ERP

**O que foi feito:** configuração do Supabase, criação das **Edge Functions** e do **cron job** para trazer todo o histórico de dados da empresa do ERP Tiny (Olist) para dentro do nosso banco.

Isso é o alicerce de tudo: sem a tabela `vendas_marketing` populada, nenhuma métrica existe.

**Componentes criados nesta fase:**
- Tabela [[BD - vendas marketing|`vendas_marketing`]] — espelho desnormalizado de cada pedido.
- Tabelas `tiny_auth` (tokens OAuth) e `tiny_sync_state` (ponteiro de retomada da carga histórica).
- Edge Functions `tiny-auth-refresh`, `tiny-historico-mkt`, `tiny-incremental-sync`, `tiny-auditoria-sync` — ver [[INT - Edge Functions]].
- Funções `tick_*()` no Postgres que chamam as Edge Functions via `pg_net`, agendadas por `pg_cron` — ver [[BD - Cron e pg net]].
- O loop de carga histórica se **auto-desagenda** quando `tiny_sync_state.concluido = true` (`tick_historico_tiny` chama `cron.unschedule('tiny-historico-loop')`).

**Decisões desta fase que ainda pesam:**
- `itens_comprados` foi gravado como **JSONB sem contrato fixo**. Hoje as RPCs precisam de uma cascata de 10 caminhos alternativos para achar o nome de um produto. Ver [[MM - Dicionario de Metricas]] e [[DT - Indice de Problemas Conhecidos|DT-BD3]].
- **Não existe tabela de clientes.** A identidade é derivada em tempo de consulta. Esta é a decisão mais consequente do projeto — ver [[MM - Identidade do Cliente]].
- O telefone foi gravado **sem normalização**, então `84999674564` e `5584999674564` convivem na base como se fossem pessoas diferentes.

## Fase 3 — Metade dos gráficos da dashboard

**O que foi feito:** criação da primeira leva de gráficos do dashboard analítico.

Nasceram aqui os `ScorecardsRow`, `RevenueChart` e as tabelas inline de Top Clientes. O padrão de acesso a dados adotado foi `useState` + `useEffect` cru, sem cache — o que mais tarde entrou em conflito com o `react-query` introduzido na Fase 7.

## Fase 4 — A tela de disparo para o CRM DataCrazy

**O que foi feito:** criação do módulo completo de **Listas de Disparo** — selecionar clientes na tela principal, montar uma campanha, disparar mensagens de WhatsApp através de uma automação no DataCrazy, acompanhar resposta e medir conversão.

Este módulo tem uma arquitetura própria e bem definida:
- 5 enums no Postgres formando uma máquina de estados — ver [[MM - Maquina de Estados do Disparo]].
- 5 Edge Functions dedicadas (fila de envio, timers, atribuição de venda, webhook de resposta, envio manual).
- Uma view de KPIs por campanha (`vw_scorecards_lista`) com cálculo de ROI.

> [!warning] Desenho original abandonado no meio
> A intenção inicial era o sistema **sincronizar leads direto na API REST do DataCrazy** (existe uma classe `DataCrazyClient` completa em `src/lib/datacrazy/client.ts`). Esse caminho foi trocado por **webhooks** e a classe virou código morto.
> Resquícios visíveis até hoje: o status `sincronizada` e o motivo de perda `negocio_perdido_crm` existem nos enums mas **nenhum código os produz**. Ver [[DT - Indice de Problemas Conhecidos|DT-D14]].

## Fase 5 — Ajuste dos filtros (tela principal e dashboard)

**O que foi feito:** os filtros que "não funcionavam de acordo" desde a Fase 1 foram finalmente ligados à lógica correta, tanto na tela principal quanto no dashboard.

Nesta fase os filtros ainda eram **client-side** — o motor era o hook `useCustomerFilters.ts`, que baixava a base e filtrava em JavaScript. Foi o que motivou a Fase 7.

## Fase 6 — Os gráficos restantes

**O que foi feito:** completou-se o layout do dashboard com `SeasonalityHeatmap`, `TopItemsPanel`, `PurchaseFrequencyChart` e `TransitionChart`.

> [!danger] Suspeita registrada pelo dono do produto
> *"Alguns deles acredito que não está puxando os dados da forma correta, iremos revisar isso com o tempo."*
>
> **A suspeita procede e já foi investigada.** Os candidatos concretos estão listados e ranqueados em [[DT - Indice de Problemas Conhecidos]] e detalhados painel a painel em [[PAINEL - Graficos do Dashboard]]. Os três mais graves:
> 1. Os **KPIs do topo ignoram 6 dos 10 filtros** — só respeitam data. A tabela mostra 40 clientes e o card diz 8.412.
> 2. O **"Top 30 Menos Comprados"** é, na verdade, o fundo do Top 300 — os produtos realmente encalhados nunca aparecem.
> 3. O **"Ticket Médio"** do gráfico de frequência divide faturamento por *clientes*, não por *pedidos* — infla linearmente por segmento.

## Fase 7 — Comunicação front ↔ backend (a refatoração de performance)

**Data:** 01/08/2026 · Registro original em [[handoff_2026_08_01]]

**Problema:** o front demorava muito para carregar. O layout estava pesado e a filtragem de milhares de clientes acontecia no navegador.

**O que foi feito:** **100% da lógica de filtros migrou para o banco.**

- Nasceu a RPC [[BD - RPCs|`fn_filter_customers`]] — recebe todos os filtros num único `jsonb`, faz a busca paginada no Postgres e devolve `total_count` embutido em cada linha.
- `useCustomersPaginated` passou a chamar essa RPC em vez de processar arrays em JS.
- `useFilterOptions` passou a popular os dropdowns dinamicamente a partir do banco.
- Toda a métrica de dashboard virou RPC agregada no servidor (`fn_dashboard_*`).
- Correção de PII e volume no gráfico de transições: `fn_dashboard_transitions_summary` (agregado, sem dado pessoal) + `fn_dashboard_transition_clients` (drill-down paginado).

**Bugs enfrentados e resolvidos no caminho** (do handoff original):
1. Timestamp vazio (`''`) quebrando o cast para `timestamp` no Postgres.
2. `PGRST202` — `fn_dashboard_top_rebuyers` não existia no schema cache; trocada por query direta na view.
3. `42803` (ungrouped column) — resolvido criando a CTE intermediária `client_base`.
4. `42703` — o nome real da coluna era `itens_comprados`, não `itens_pedido`.
5. Quantidade de itens passou a somar a coluna `numero_itens` em vez de percorrer o JSON.

> [!bug] Herança desta fase
> A migração deixou **duas camadas de dados concorrentes** vivas ao mesmo tempo: 4 hooks em `src/data/queries.ts` com `react-query` (cache, dedupe) e 9 hooks em `src/hooks/` com `useEffect` cru (sem cache, sem cancelamento). E deixou **5 hooks completamente mortos** que ninguém importa. Ver [[020 - Arquitetura Geral]].

## Próximas fases sugeridas

Não decididas ainda — candidatas em ordem de retorno sobre esforço:

1. **Normalizar a identidade do cliente** (coluna gerada `telefone_normalizado` + índice). Corrige de uma vez `total_clients`, taxa de recompra, frequência de compra e transições. Ver [[MM - Identidade do Cliente]].
2. **Fazer os KPIs respeitarem os filtros** — é o descompasso mais visível na tela.
3. **Fechar a RLS** antes de qualquer exposição pública. Ver [[BD - Seguranca e RLS]].
4. **Normalizar `itens_comprados`** numa tabela filha, resolvendo performance, indexação e ambiguidade de nome de produto de uma vez.
