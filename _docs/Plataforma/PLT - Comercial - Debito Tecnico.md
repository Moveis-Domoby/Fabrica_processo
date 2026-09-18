---
titulo: Comercial — Débito Técnico (Índice de Problemas Conhecidos)
tipo: nota
prioridade: critica
atualizado: 2026-09-17
tags: [comercial, plataforma, debito-tecnico, bugs, backlog, indice]
---

# 🔧 PLT — Comercial — Débito Técnico (índice vivo)

> [!info] Origem e estado
> Migrada do cofre da loja (Painel de Recompra) em 17/09/2026. É o **índice vivo** dos problemas conhecidos do módulo Comercial na plataforma da fábrica — o código foi portado verbatim (SESSAO-20), então quase tudo veio junto.

> [!abstract] Como usar (regra da casa)
> Cada item tem um **ID estável** — os IDs DT-* originais do cofre da loja foram **mantidos, sem renumerar**. Ao corrigir, marque `✅ resolvido em AAAA-MM-DD` **em vez de apagar** — o histórico de "por que isso estava assim" é o que impede reintroduzir. Ao descobrir algo novo, adicione com o próximo ID da família.
>
> Anotações da migração: **[não portado]** = o código/objeto morreu no repo antigo e não existe no módulo novo · **[superado pela união]** = o problema deixou de existir pela arquitetura da fábrica (S19/S20) · **[reavaliar]** = o contexto mudou, conferir no banco/repo novo antes de agir. Itens sem anotação vieram como estavam.

**Legenda de severidade:** 🔴 crítico · 🟠 alto · 🟡 médio · ⚪ baixo

> [!warning] IDs reservados e nunca registrados
> O plano de sessões da loja (ver [[PLT - Comercial - Legado e Cutover]]) reservou **DT-F16** (filtros facetados), **DT-D36** (ROI parcial), **DT-D37** (sticky sobrepõe linha), **DT-D38** (card cobre o botão de encerrar), **DT-U12** (10 temas) e **DT-ARQ10** (Auditoria Diária stub) para as sessões 7–10, que nunca rodaram. Ao registrá-los aqui, usar **esses IDs** — não reaproveitar os números para outra coisa.

---

## 🎯 Ainda abertos com maior dor ÷ esforço

| ID | Problema | Esforço |
|---|---|---|
| **DT-BD5** | Paginação repete clientes de verdade (`ORDER BY` sem desempate — 3 duplicados entre pág. 1↔2 confirmados em produção 10/09) | baixo |
| **DT-BD1** | Identidade do cliente sem normalização de telefone — ver [[PLT - Comercial - Identidade do Cliente]] (na fábrica exige adaptar o plano: `vendas_marketing` é view) | médio |
| **DT-U1 + DT-U11** | `loading` descartado em parte do dashboard + falha de API vira KPIs zerados sem aviso | baixo |
| **DT-D11** | Tipo `ScorecardsLista` com 3 campos errados → `undefined` silencioso nos cards de campanha | baixo |
| **DT-G13** | Cada painel do dashboard tem período próprio sem indicação visual | baixo |

---

## 🗄️ Família BD — Banco de Dados

| ID | Sev | Problema | Onde | Correção |
|---|---|---|---|---|
| **DT-BD1** | 🔴 | Identidade = telefone bruto, sem normalização. Duplica clientes em **toda** RPC. **[reavaliar]** o plano da coluna gerada foi escrito para a tabela do banco antigo; na fábrica `vendas_marketing` é view — a normalização entra na view, na tabela-base ou numa função | todas as RPCs | Ver [[PLT - Comercial - Identidade do Cliente]]; trocar a expressão em todas as RPCs de uma vez |
| **DT-BD2** | 🔴 | ✅ resolvido em 2026-09-08 — `gap_days` sempre NULL (window sem frame) → filtro "Tempo de Recompra" retornava vazio | `fn_filter_customers` | Trocado `nth_value` por `LEAD()` |
| **DT-BD3** | 🟠 | `itens_comprados` JSONB sem contrato — 10 caminhos de fallback, sem SKU. **[reavaliar]** na fábrica existe `pedido_itens` no pipeline de produção — a solução (tabela de itens + catálogo, Sessão 3 antiga) pode se apoiar nela | view `vendas_marketing` | tabela de itens + `produtos_catalogo` |
| **DT-BD4** | 🟠 | `fn_dashboard_transitions` legada (com PII) nunca dropada — ⚠️ **veio junto na cópia da S19** (está na lista de RPCs portadas) | banco da fábrica | `DROP FUNCTION` (o hook morto `useTransitionData.ts` não foi portado) |
| **DT-BD5** | 🟠 | Paginação instável — `ORDER BY u_compra_periodo DESC` sem desempate; duplica/omite clientes entre páginas (confirmado em produção 10/09) | `fn_filter_customers` | adicionar `, cid` |
| **DT-BD6** | 🟠 | `fn_dashboard_items` sem `LIMIT` — milhares de linhas para exibir 3/mês | | `ROW_NUMBER() OVER (PARTITION BY mês ...) <= 5` |
| **DT-BD7** | 🟡 | `EXTRACT(DAY FROM interval)` trunca horas — médias subestimadas | transitions + `gap_days` das 2 RPCs (DT-G15) | `EXTRACT(EPOCH FROM (...))/86400` |
| **DT-BD8** | 🟡 | `LIMIT 15` silencioso na frequência de compra *(o `LIMIT 300` do top de itens saiu no DT-G2)* | freq. compra | avisar na UI ou aumentar |
| **DT-BD9** | 🟡 | Subquery correlacionada `gap_days` roda para todo cliente mesmo com filtro vazio | `fn_filter_customers` (+ scorecards, DT-G15) | mover para CTE agregada |
| **DT-BD10** | 🟡 | `total_count` recalculado e repetido em cada linha | `fn_filter_customers` | aceitável, mas paga a CTE por página |
| **DT-BD11** | ⚪ | 3 pares de índices duplicados. **[reavaliar]** dizia respeito às tabelas do banco antigo; conferir quais índices a S19 recriou | | advisor confirma os pares |
| **DT-BD12** | ⚪ | `atualizado_em` sem trigger `BEFORE UPDATE` | `listas_disparo_membros` | criar trigger |
| **DT-BD13** | ⚪ | ✅ **[superado pela união]** `tiny_sync_state` não migrou — o sync do recompra foi substituído pelo webhook n8n da fábrica (S19) | — | — |
| **DT-BD14** | ⚪ | Nenhuma matview — RPCs refazem window functions a cada load | | matview de transições e itens, refresh no cron |

---

## 🔐 Família SEC — Segurança

A união **reformou o modelo de acesso**: RLS no padrão da casa condicionada ao módulo `comercial`, RPCs SECURITY DEFINER com `fn_negar_sem_modulo` (migrations 26/27), `authenticated` sem SELECT direto nas views, `tiny_auth` fechada para todos no navegador. Os itens abaixo descreviam o **projeto antigo** — que segue no ar até o cutover, com esses problemas vivos lá.

| ID | Sev | Problema |
|---|---|---|
| **DT-SEC1** | 🔴 | ✅ **[superado pela união]** `vendas_marketing` com `SELECT USING(true)` legível por anon — na fábrica a view tem gate de módulo e não há acesso anon. Vivo no projeto antigo até o desligamento |
| **DT-SEC2** | 🔴 | ✅ **[superado pela união]** JWT anon em texto puro nas funções `tick_*` — as `tick_*` **não migraram**. Vivo no projeto antigo até o desligamento |
| **DT-SEC3** | 🟠 | ✅ **[superado pela união]** módulo de disparo com `public_full_access` — na fábrica, RLS por módulo (S19). Vivo no projeto antigo |
| **DT-SEC4** | 🟠 | ✅ **[superado pela união]** `tarifas_mensagem_whatsapp` e `tiny_sync_state` sem RLS — na fábrica a primeira nasceu com RLS padrão e a segunda não migrou. Vivo no projeto antigo |
| **DT-SEC5** | 🟠 | **[reavaliar]** Gatilho do DataCrazy sem token — a URL era o único segredo. A fábrica tem o secret `DATACRAZY_WEBHOOK_SECRET` configurado; **conferir se `webhook-datacrazy-resposta` valida algum segredo** antes de dar por resolvido |
| **DT-SEC6** | 🟡 | **[reavaliar]** Edge Functions de cron sem validação de método/chamador; `config.toml` incompleto — conferir a configuração das 6 functions deployadas na fábrica |
| **DT-SEC7** | 🟡 | **[reavaliar]** `webhook_eventos_crm.payload_bruto` (PII do CRM) legível por anon — na fábrica a tabela nasceu sob RLS padrão (S19); confirmar policies antes de marcar ✅ |
| **DT-SEC8** | ⚪ | Funções sem `SET search_path` — as RPCs foram copiadas **sem alteração**, então o item **veio junto** para a fábrica |
| **DT-SEC9** | 🟠 | **[reavaliar]** `vw_clientes_consolidados` e `vw_scorecards_lista` SECURITY DEFINER (lint 0010). O modelo mudou na S20 (`authenticated` sem SELECT direto; portas gateadas) — reexaminar o advisor no banco da fábrica |

*Apontamentos de segurança **do banco da fábrica** herdados pela SESSAO-21 (não são do Comercial): `fn_pedido_por_numero_nf` executável por `anon` 🟠, `fn_backfill_conta_mapear`/`fn_vig_touch` sem `search_path` 🟡, `vig_conhecimento_vendas` com RLS sem policy ⚪ — ver [[SESSAO-21 - Uniao 3 - Cutover e Desligamento]].*

---

## 📈 Família G — Gráficos e métricas

| ID | Sev | Problema |
|---|---|---|
| **DT-G1** | 🔴 | Ver **DT-F1** — KPIs ignoravam filtros (✅) |
| **DT-G2** | 🔴 | ✅ resolvido em 2026-09-08 — removido o `LIMIT 300` de `fn_dashboard_top_items_overall` (catálogo ~936 itens; retorna todos) |
| **DT-G3** | 🟠 | ✅ resolvido em 2026-09-08 — `useTopClientsData` agrega os itens dos 20 "Recordes" no cliente |
| **DT-G4** | 🟠 | ✅ resolvido em 2026-09-08 — rótulo "Em {count} pedido(s)" no `SeasonalityHeatmap`; contagem mantida (decisão do time) |
| **DT-G5** | 🔴 | ✅ resolvido em 2026-09-08 — `PurchaseFrequencyChart` divide por pedidos do segmento |
| **DT-G6** | 🟠 | ✅ resolvido em 2026-09-08 — `RevenueChart` preenche meses sem venda com 0 (`eachMonthOfInterval`) |
| **DT-G7** | 🟡 | ✅ resolvido em 2026-09-08 — tooltip lê `payload[0].payload.orders` |
| **DT-G8** | 🟡 | Semântica do período do `TransitionChart` é contraintuitiva e não explicada (filtro incide na compra de chegada) |
| **DT-G9** | 🟡 | `maxItemCount` compartilhado — barras do "menos comprados" todas no piso de 6% |
| **DT-G10** | 🟡 | `availableMonths` fabricada (12 meses do calendário) — histórico anterior inacessível |
| **DT-G11** | 🟡 | "Clientes Recordes" é Top 20 e os stats somam só os 20 exibidos, sem indicar |
| **DT-G12** | 🟡 | ✅ resolvido em 2026-09-08 — rótulo vira "Fat. Total (Período)" fora de "Tudo" |
| **DT-G13** | 🟡 | Cada painel tem período próprio sem indicação visual |
| **DT-G14** | ⚪ | `endCutoff` nulo — pedidos com data futura entram nos gráficos |
| **DT-G15** | 🟡 | `fn_dashboard_scorecards` (Fase E) copiou as CTEs de `fn_filter_customers` — herdou a subquery correlacionada de `gap_days` (custo do DT-BD9 cobrado 2×/tela) e o `EXTRACT(DAY)` truncado (DT-BD7 propagado) |
| **DT-G16** | ⚪ | Ordenação da tabela é client-side sobre os 50 da página — "mais antiga primeiro" inverte a página 1, não o resultado global. Correção real: `ORDER BY` parametrizado na RPC (fechar junto o DT-BD5) |

---

## 🎛️ Família F — Filtros e tabela principal

| ID | Sev | Problema |
|---|---|---|
| **DT-F1** | 🔴 | ✅ resolvido em 2026-09-08 — `fn_dashboard_scorecards(p_filters jsonb)` reaproveita as CTEs de `fn_filter_customers` |
| **DT-F2** | 🔴 | ✅ resolvido em 2026-09-08 — `page` reseta para 1 quando `filters` muda |
| **DT-F3** | 🔴 | ✅ resolvido em 2026-09-08 — KPIs mandam os filtros crus e a RPC resolve a data em SQL (mesma correção do DT-F1) |
| **DT-F4** | 🟠 | ✅ resolvido em 2026-09-08 — `sortedData` ordena de fato por `ultima_compra` (mas ver DT-G16) |
| **DT-F5** | 🟠 | ✅ resolvido em 2026-09-09 — debounce de 350ms no `searchQuery` (`useDebouncedValue` + `effectiveFilters`); 21 teclas → 1 chamada por RPC |
| **DT-F6** | 🟠 | ✅ resolvido em 2026-09-09 — `useCustomersPaginated` e `useScorecardsData` em react-query com `AbortSignal` |
| **DT-F7** | 🟠 | "Selecionar todos" só a página atual (50 de N) |
| **DT-F8** | 🟠 | ✅ resolvido em 2026-09-08 — chave de cache do `ItemsModal` inclui todos os campos de data |
| **DT-F9** | 🟡 | ✅ resolvido de quebra em 2026-09-08 pelo DT-G2 — dropdown de itens com o catálogo inteiro (938) |
| **DT-F10** | 🟡 | Sem "limpar filtros" e sem persistência (URL/localStorage) |
| **DT-F11** | 🟡 | `CustomerLifetimeModal` — fallback por nome mistura homônimos; `select('*')` sem limite |
| **DT-F12** | ⚪ | `colSpan={8}` errado em modo seleção; `key={idx}` nas linhas |
| **DT-F13** | 🔴 | ✅ resolvido em 2026-09-09 — busca por texto sem dígitos não filtrava (`ILIKE '%%'` no ramo do telefone); corrigido nas duas RPCs (migration `20260909200000`); validado: termo inexistente → 0, "maria" → 397 |
| **DT-F14** | 🟠 | ✅ resolvido em 2026-09-09 — "recorrente" unificado para **vida ≥ 2 sempre** (mesma migration); validado 558 = 558. Ver [[PLT - Comercial - Dicionario de Metricas]] |
| **DT-F15** | ⚪ | `ItemsModal`: busca só por `eq(telefone_cliente)` exato; `custom` exige início E fim; datas comparadas por prefixo de string UTC |

---

## 📣 Família D — Disparo

| ID | Sev | Problema |
|---|---|---|
| **DT-D1** | 🔴 | ✅ resolvido em 2026-09-08 — 4 valores adicionados ao enum `tipo_evento_disparo` |
| **DT-D2** | 🟠 | ✅ **[não portado]** `ListasDisparoMain` órfão e quebrado ficou no repo antigo (S20 portou só os 40 arquivos vivos) |
| **DT-D3** | 🔴 | ✅ resolvido em 2026-09-08 — CORS + handler OPTIONS em `disparar-membro-individual` |
| **DT-D4** | 🔴 | ✅ resolvido em 2026-09-08 — `verificar-vendas-disparo` checa `timerExpirou` antes de fechar como ganho |
| **DT-D5** | 🔴 | ✅ resolvido em 2026-09-08 — RPC `fn_vendas_disparo_por_telefone` filtra no banco com telefone normalizado |
| **DT-D6** | 🔴 | ✅ resolvido em 2026-09-08 — margem de 1h + compare-and-swap em `processar-timers-disparo` |
| **DT-D7** | 🔴 | ✅ resolvido em 2026-09-08 — UPDATE condicionado a `status='aguardando_envio'` com rollback em falha |
| **DT-D8** | 🟠 | ✅ resolvido em 2026-09-08 — `.upsert(..., {onConflict, ignoreDuplicates: true})` |
| **DT-D9** | 🟠 | ✅ resolvido em 2026-09-08 — `AdicionarListaModal` valida telefone como a `CriarListaModal` |
| **DT-D10** | 🟠 | ✅ resolvido em 2026-09-08 — "Mensagem de Referência" com aviso de que não é enviada automaticamente |
| **DT-D11** | 🟠 | Tipo `ScorecardsLista` com 3 nomes de campo errados — `undefined` silencioso |
| **DT-D12** | 🟡 | Tipos de evento semanticamente errados (`iniciarFila` grava `envio_registrado`) |
| **DT-D13** | 🟡 | `encerrado_em` e `filtros_aplicados` nunca preenchidos |
| **DT-D14** | 🟡 | Resquícios do desenho abandonado: `sincronizada`, `negocio_perdido_crm`, `leads_sincronizados`, `id_lista_crm`, `tag_crm` |
| **DT-D15** | 🟡 | Polling não recarrega eventos |
| **DT-D16** | 🟡 | Polling sobrescreve a edição da mensagem (`prev \|\| …`) |
| **DT-D17** | ⚪ | ✅ resolvido em 2026-09-08 — botão "Salvando..." durante o save |
| **DT-D18** | 🟡 | Divisão em N partes produz menos de N listas (`Math.ceil`) |
| **DT-D19** | 🟡 | Validações usam `filteredData` em vez de `validData` |
| **DT-D20** | 🟠 | Intervalo < 60s é ilusório (granularidade real do cron é 1 min) |
| **DT-D21** | 🟠 | Ordenação da fila não-determinística (`criado_em` empatado, sem desempate) |
| **DT-D22** | 🟠 | `useDisparosData` sem paginação — badges truncadas silenciosamente em ~1000 linhas |
| **DT-D24** | ⚪ | `alert()`/`confirm()` nativos apesar do `react-hot-toast` |
| **DT-D25** | ⚪ | `handleRegistrarEnvio` chama `fetchData()` com spinner |
| **DT-D26** | ⚪ | 9 scorecards em `grid-cols-8` — ROI cai sozinho na 2ª linha |
| **DT-D30** | 🟠 | Erros invisíveis — `erros[]` com HTTP 200, resposta descartada pelo `pg_cron` |
| **DT-D31** | 🟠 | Sem `.limit()` nos loops de cron — backlog estoura o wall-clock e recomeça do zero |
| **DT-D33** | 🟡 | Eventos do front nunca têm `membro_id` → auditoria por cliente incompleta |
| **DT-D34** | 🟡 | `normalizarTelefone` duplicada 5×, `formatarTelefoneDataCrazy` 3× — divergência futura quebra a atribuição de venda |
| **DT-D35** | ⚪ | `addDiasUteisSemDomingo` ignora feriados; roda em UTC |

---

## 🏗️ Família ARQ/U — Arquitetura e UX

| ID | Sev | Problema |
|---|---|---|
| **DT-U1** | 🟠 | 🔶 parcialmente resolvido em 2026-09-08 — `CustomersTable` e a lista "Recompradores" usam `loading`; outros componentes do dashboard ainda descartam |
| **DT-ARQ1** | 🟠 | Duas camadas de dados concorrentes (react-query × useEffect cru) — sem dedupe |
| **DT-ARQ2** | 🟡 | ✅ **[não portado]** os 7 arquivos mortos (hooks, `datacrazy/client.ts` etc.) ficaram no repo antigo (S20) |
| **DT-ARQ3** | 🟡 | `@tanstack/react-virtual` declarada e nunca usada — **veio como dependência do módulo na S20**; sem virtualização |
| **DT-ARQ4** | 🟡 | ✅ **[não portado]** script `supabase:migration:up` quebrado era do `package.json` do repo antigo |
| **DT-ARQ5** | 🟡 | 🔶 Jobs `pg_cron` — na fábrica os 4 crons do Comercial **não estão agendados** (só no cutover); o modelo versionado é o `cron_agendamentos.sql` do repo antigo. Versionar o equivalente no repo da fábrica ao agendar |
| **DT-ARQ6** | ⚪ | ✅ **[superado pela união]** sem router — a SESSAO-20 transformou o view-state em rotas `/comercial/*` |
| **DT-ARQ7** | ⚪ | `SaleRecord.instagram_cliente` e `GroupedCustomer.instagram` declarados; a coluna não existe — **[reavaliar]** conferir se os types portados ainda trazem |
| **DT-ARQ8** | ⚪ | ✅ **[não portado]** config do oxlint era do repo antigo; o lint do repo da fábrica passou limpo na S20 |
| **DT-ARQ9** | ⚪ | Bundle sem code splitting — **confirmado na S20: ~1,7 MB com o Recharts**; fora do escopo da união, segue aberto |
| **DT-U8** | ⚪ | ✅ **[superado pela união]** tema sem persistência/anti-FOUC — o módulo passou a usar o sistema de temas da plataforma (Meu Perfil → Tema; catálogo com esmeralda claro/escuro) |
| **DT-U9** | ⚪ | `* { transition-colors }` global — **[reavaliar]** conferir se o CSS portado manteve |
| **DT-U10** | ⚪ | 🔶 amplamente superado na S20 — gráficos passaram a resolver cores pelos tokens da casa (`--dm-serie-1..6`, `var(--…)`); conferir restos de classes hardcoded fora dos gráficos |
| **DT-U11** | ⚪ | Falha de API renderiza KPIs zerados ("0 clientes / R$ 0,00") sem aviso — hooks fazem `console.error` e seguem |

---

## Ver também

- [[PLT - Comercial - Identidade do Cliente]] · [[PLT - Comercial - Telas]] · [[PLT - Comercial - Legado e Cutover]] (sessões de ajuste pendentes)
- [[SUPA - Comercial - Dominio de Dados]] · [[handoff_2026_09_16_sessao20_modulo_comercial]] · [[000 - MAPA DO PROJETO]]
