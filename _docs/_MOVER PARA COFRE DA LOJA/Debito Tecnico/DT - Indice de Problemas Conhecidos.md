---
titulo: DT — Índice de Problemas Conhecidos
tipo: debito-tecnico
prioridade: critica
atualizado: 2026-08-06
tags: [debito-tecnico, bugs, backlog, indice]
---

# 🔧 DT — Índice de Problemas Conhecidos

> [!abstract] Como usar
> Cada item tem um **ID estável**. Ao corrigir, marque `✅ resolvido em AAAA-MM-DD` em vez de apagar — o histórico de "por que isso estava assim" é o que impede reintroduzir.
> Ao descobrir algo novo, adicione com o próximo ID da família.

**Legenda de severidade:** 🔴 crítico · 🟠 alto · 🟡 médio · ⚪ baixo

---

## 🎯 Os 6 que resolveriam mais dor por menos esforço

| ID | Problema | Esforço |
|---|---|---|
| **DT-BD1** | Identidade do cliente sem normalização de telefone | médio |
| **DT-F1** | KPIs ignoram 6 dos 10 filtros | médio |
| **DT-BD2** | `gap_days` sempre NULL → filtro de recompra zera | baixo |
| **DT-G2** | "Top 30 Menos Comprados" mostra os medianos | baixo |
| **DT-G5** | Ticket Médio dividido por clientes, não por pedidos | baixo |
| **DT-U1** | `loading` descartado → "Sem dados" durante o fetch | baixo |

---

## 🗄️ Família BD — Banco de Dados

| ID          | Sev | Problema                                                                                | Onde                       | Correção                                                                                                                   |
| ----------- | --- | --------------------------------------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **DT-BD1**  | 🔴  | Identidade = telefone bruto, sem normalização. Duplica clientes em **toda** RPC         | todas as RPCs              | coluna gerada `telefone_normalizado` + índice + trocar a expressão em todas de uma vez. Ver [[MM - Identidade do Cliente]] |
| **DT-BD2**  | 🔴  | `gap_days` sempre NULL (window sem frame) → filtro "Tempo de Recompra" retorna vazio    | `fn_filter_customers`      | frame explícito `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`, ou `LEAD()`                                    |
| **DT-BD3**  | 🟠  | `itens_comprados` JSONB sem contrato — 10 caminhos de fallback, sem índice GIN, sem SKU | `vendas_marketing`         | tabela filha `vendas_marketing_itens`. Ver [[BD - vendas marketing]]                                                       |
| **DT-BD4**  | 🟠  | `fn_dashboard_transitions` legada (com PII) nunca dropada                               | migration `20260801030000` | `DROP FUNCTION` + remover `useTransitionData.ts`                                                                           |
| **DT-BD5**  | 🟠  | Paginação instável — `ORDER BY` sem desempate                                           | `fn_filter_customers`      | adicionar `, cid`                                                                                                          |
| **DT-BD6**  | 🟠  | `fn_dashboard_items` sem `LIMIT` — milhares de linhas para exibir 3/mês                 |                            | `ROW_NUMBER() OVER (PARTITION BY mês ...) <= 5`                                                                            |
| **DT-BD7**  | 🟡  | `EXTRACT(DAY FROM interval)` trunca horas — médias subestimadas                         | transitions                | `EXTRACT(EPOCH FROM (...))/86400`                                                                                          |
| **DT-BD8**  | 🟡  | `LIMIT 15` e `LIMIT 300` silenciosos                                                    | freq. compra, top itens    | avisar na UI ou aumentar                                                                                                   |
| **DT-BD9**  | 🟡  | Subquery correlacionada `gap_days` roda para todo cliente mesmo com filtro vazio        | `fn_filter_customers`      | mover para CTE agregada                                                                                                    |
| **DT-BD10** | 🟡  | `total_count` recalculado e repetido em cada linha                                      | `fn_filter_customers`      | aceitável, mas paga a CTE por página                                                                                       |
| **DT-BD11** | ⚪   | 3 pares de índices duplicados                                                           |                            | dropar `idx_vendas_mkt_telefone`, `idx_membros_lista_id`, `idx_vendas_mkt_pedido`                                          |
| **DT-BD12** | ⚪   | `atualizado_em` sem trigger `BEFORE UPDATE`                                             | `listas_disparo_membros`   | criar trigger                                                                                                              |
| **DT-BD13** | ⚪   | `tiny_sync_state.data_inicial` é varchar; `modo` é texto livre sem CHECK                |                            | tipar                                                                                                                      |
| **DT-BD14** | ⚪   | Nenhuma matview — RPCs refazem window functions a cada load                             |                            | matview de transições e itens, refresh no cron                                                                             |

---

## 🔐 Família SEC — Segurança

Detalhes e plano de correção em [[BD - Seguranca e RLS]].

| ID          | Sev | Problema                                                                                                                                        |
| ----------- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **DT-SEC1** | 🔴  | `vendas_marketing` com `SELECT USING(true)` — base de clientes publicamente legível com a chave anon do bundle                                  |
| **DT-SEC2** | 🔴  | JWT anon em texto puro dentro das funções `tick_*`, versionado no git, com `GRANT ALL TO anon` — qualquer visitante dispara syncs contra o Tiny |
| **DT-SEC3** | 🟠  | Módulo de disparo com `public_full_access` — anon pode **apagar** listas, membros e auditoria                                                   |
| **DT-SEC4** | 🟠  | `tarifas_mensagem_whatsapp` e `tiny_sync_state` **sem RLS** + `GRANT ALL TO anon`                                                               |
| **DT-SEC5** | 🟠  | Gatilho do DataCrazy sem token — a URL é o único segredo                                                                                        |
| **DT-SEC6** | 🟡  | Edge Functions de cron sem validação de método/chamador; `config.toml` não versionado                                                           |
| **DT-SEC7** | 🟡  | `webhook_eventos_crm.payload_bruto` (PII do CRM) legível por anon                                                                               |
| **DT-SEC8** | ⚪   | Funções sem `SET search_path`                                                                                                                   |

---

## 📈 Família G — Gráficos e métricas

Detalhes em [[PAINEL - Graficos do Dashboard]].

| ID | Sev | Problema |
|---|---|---|
| **DT-G1** | 🔴 | Ver **DT-F1** — KPIs ignoram filtros |
| **DT-G2** | 🔴 | "Top 30 Menos Comprados" = fundo do top 300; os realmente encalhados nunca aparecem |
| **DT-G3** | 🟠 | Coluna "Top Produtos" do Top 50 sempre vazia (`topItems: []` hardcoded) |
| **DT-G4** | 🟠 | `{count}× vendido` — `quantidade` é ocorrência, não unidade |
| **DT-G5** | 🔴 | Ticket Médio = faturamento / **clientes** (deveria ser / pedidos); erro cresce com o segmento |
| **DT-G6** | 🟠 | `RevenueChart` não preenche meses vazios — linha contínua enganosa |
| **DT-G7** | 🟡 | `orders` buscado e nunca exibido no tooltip (`payload[1]` nunca existe) |
| **DT-G8** | 🟡 | Semântica do período do `TransitionChart` é contraintuitiva e não explicada |
| **DT-G9** | 🟡 | `maxItemCount` compartilhado — barras do "menos comprados" todas no piso de 6% |
| **DT-G10** | 🟡 | `availableMonths` fabricada (12 meses do calendário) — histórico anterior inacessível |
| **DT-G11** | 🟡 | "Clientes Recordes" é Top 20 e os stats são só dos 20 exibidos, sem indicar |
| **DT-G12** | 🟡 | Rótulo "Fat. Total (Vida)" mente quando o período muda |
| **DT-G13** | 🟡 | Cada painel tem período próprio sem indicação visual |
| **DT-G14** | ⚪ | `endCutoff` nulo — pedidos com data futura entram nos gráficos |

---

## 🎛️ Família F — Filtros e tabela principal

Detalhes em [[TELA - Filtros]] e [[TELA - Painel Principal]].

| ID | Sev | Problema |
|---|---|---|
| **DT-F1** | 🔴 | `fn_dashboard_scorecards` só aceita data — KPIs contradizem a tabela |
| **DT-F2** | 🔴 | `page` não reseta ao mudar filtros → **estado sem saída**, só recarregando |
| **DT-F3** | 🔴 | Fuso: KPI calcula limites no fuso local, tabela deixa a RPC calcular em UTC — janelas deslocadas em 3h |
| **DT-F4** | 🟠 | Ordenação da tabela é **decorativa** — só troca o ícone |
| **DT-F5** | 🟠 | Sem debounce — 12 caracteres digitados = 24 RPCs pesadas |
| **DT-F6** | 🟠 | Race condition sem `AbortController` — resposta antiga sobrescreve a nova |
| **DT-F7** | 🟠 | "Selecionar todos" só a página atual (50 de N) |
| **DT-F8** | 🟠 | `ItemsModal` cache com chave incompleta — mostra itens do mês anterior |
| **DT-F9** | 🟡 | Dropdown de itens limitado ao top 300 |
| **DT-F10** | 🟡 | Sem "limpar filtros" e sem persistência (URL/localStorage) |
| **DT-F11** | 🟡 | `CustomerLifetimeModal` — fallback por nome mistura homônimos; `select('*')` sem limite |
| **DT-F12** | ⚪ | `colSpan={8}` errado em modo seleção; `key={idx}` nas linhas |

---

## 📣 Família D — Disparo

Detalhes em [[TELA - Listas de Disparo]] e [[INT - Edge Functions]].

| ID | Sev | Problema |
|---|---|---|
| **DT-D1** | 🔴 | 4 tipos de evento fora do enum → INSERTs falham (`lista_renomeada`, `membros_adicionados`, `membro_removido`, `membros_removidos`) |
| **DT-D3** | 🔴 | Nenhuma Edge Function define CORS → botão "Enviar" individual inoperante |
| **DT-D4** | 🔴 | `verificar-vendas-disparo` fecha como ganho na 1ª venda em vez de esperar a janela — **contradiz o próprio cabeçalho** e subestima receita/ROI |
| **DT-D5** | 🔴 | `verificar-vendas-disparo` carrega `vendas_marketing` sem filtro de telefone no SQL — teto de 1000 linhas fecha como perdido quem comprou |
| **DT-D6** | 🔴 | Duas autoridades fecham "sem resposta" — cliente que responde no limite vira perda |
| **DT-D7** | 🔴 | Sem compare-and-swap no envio → risco de **mensagem duplicada** |
| **DT-D8** | 🟠 | INSERT em lote quebra por telefone duplicado; sobra lista vazia órfã |
| **DT-D9** | 🟠 | `AdicionarListaModal` não valida telefone → membro fantasma |
| **DT-D2** | 🟠 | `ListasDisparoMain` órfão **e** quebrado (`criada_em` vs `criado_em`) |
| **DT-D10** | 🟠 | "Mensagem Utilizada" nunca é enviada ao CRM, mas a UI sugere que sim |
| **DT-D11** | 🟠 | Tipo `ScorecardsLista` com 3 nomes de campo errados — `undefined` silencioso |
| **DT-D20** | 🟠 | Intervalo < 60s é ilusório (granularidade real do cron é 1 min) |
| **DT-D21** | 🟠 | Ordenação da fila não-determinística (`criado_em` empatado, sem desempate) |
| **DT-D30** | 🟠 | Erros invisíveis — `erros[]` com HTTP 200, resposta descartada pelo `pg_cron` |
| **DT-D31** | 🟠 | Sem `.limit()` nos loops de cron — backlog estoura o wall-clock e recomeça do zero |
| **DT-D22** | 🟠 | `useDisparosData` sem paginação — badges truncadas silenciosamente |
| **DT-D12** | 🟡 | Tipos de evento semanticamente errados (`iniciarFila` grava `envio_registrado`) |
| **DT-D13** | 🟡 | `encerrado_em` e `filtros_aplicados` nunca preenchidos |
| **DT-D14** | 🟡 | Resquícios do desenho abandonado: `sincronizada`, `negocio_perdido_crm`, `leads_sincronizados`, `id_lista_crm`, `tag_crm` |
| **DT-D15** | 🟡 | Polling não recarrega eventos |
| **DT-D16** | 🟡 | Polling sobrescreve a edição da mensagem |
| **DT-D18** | 🟡 | Divisão em N partes produz menos de N listas |
| **DT-D19** | 🟡 | Validações usam `filteredData` em vez de `validData` |
| **DT-D33** | 🟡 | Eventos do front nunca têm `membro_id` → auditoria por cliente incompleta |
| **DT-D34** | 🟡 | `normalizarTelefone` duplicada 5×, `formatarTelefoneDataCrazy` 3× — divergência futura quebra a atribuição de venda |
| **DT-D17** | ⚪ | Label "Salvo"/"Salvar" invertido |
| **DT-D24** | ⚪ | `alert()`/`confirm()` nativos apesar do `react-hot-toast` |
| **DT-D25** | ⚪ | `handleRegistrarEnvio` chama `fetchData()` com spinner |
| **DT-D26** | ⚪ | 9 scorecards em `grid-cols-8` |
| **DT-D35** | ⚪ | `addDiasUteisSemDomingo` ignora feriados; roda em UTC |

---

## 🏗️ Família ARQ — Arquitetura e UX

| ID | Sev | Problema |
|---|---|---|
| **DT-U1** | 🟠 | `loading` descartado por todos os componentes do dashboard |
| **DT-ARQ1** | 🟠 | Duas camadas de dados concorrentes (react-query × useEffect cru) — sem dedupe |
| **DT-ARQ2** | 🟡 | 5 hooks + 2 arquivos mortos; `useCustomerFilters` com defaults **divergentes** dos reais, induzindo ao erro |
| **DT-ARQ3** | 🟡 | `@tanstack/react-virtual` instalada e nunca usada; sem virtualização |
| **DT-ARQ4** | 🟡 | Script `supabase:migration:up` aponta para arquivo inexistente |
| **DT-ARQ5** | 🟡 | Jobs `pg_cron` não versionados (`tiny-historico-loop`, incremental, auditoria) |
| **DT-U8** | ⚪ | Tema sem persistência, sem `prefers-color-scheme`, sem anti-FOUC |
| **DT-U9** | ⚪ | `* { transition-colors }` global — custo em cada hover |
| **DT-U10** | ⚪ | Cores hardcoded fora do sistema de tema em vários gráficos |
| **DT-ARQ6** | ⚪ | Sem router — não há URL compartilhável nem histórico do browser |
| **DT-ARQ7** | ⚪ | `SaleRecord.instagram_cliente` e `GroupedCustomer.instagram` declarados; a coluna não existe |

---

## Ver também

- [[000 - MAPA DO PROJETO]] · [[MM - Identidade do Cliente]] · [[BD - Seguranca e RLS]] · [[PAINEL - Graficos do Dashboard]]
