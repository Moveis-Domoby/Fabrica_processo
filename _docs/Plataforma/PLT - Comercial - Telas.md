---
titulo: Comercial — Telas
tipo: nota
atualizado: 2026-09-17
tags: [comercial, plataforma, tela, front, referencia]
---

# 🖥️ PLT — Comercial — Telas (referência condensada)

> [!info] Origem e estado
> Condensa as 5 notas de telas do cofre da loja (Painel Principal, Filtros, Dashboard, Gráficos do Dashboard, Listas de Disparo), migradas em 17/09/2026. Vale para o módulo Comercial na plataforma da fábrica: os **40 arquivos vivos** do recompra foram copiados **verbatim** para `src/comercial/` na SESSAO-20 (os 7 mortos catalogados ficaram de fora), com um adaptador de 1 linha entregando o client Supabase da fábrica — nenhum import interno foi tocado. Bugs listados aqui carregam o ID DT-* do [[PLT - Comercial - Debito Tecnico]].

## Rotas (novas na SESSAO-20 — o view-state do App.tsx antigo virou rota)

| Rota | Tela |
|---|---|
| `/comercial/recompra` | Painel de Recompra (FilterBar → KPICards → CustomersTable) |
| `/comercial/dashboard` | Dashboard Analytics |
| `/comercial/listas` | Listas de Disparo |
| `/comercial/listas/:id` | Detalhe da lista (`ListasDisparoDetalhe`) |

Sem o módulo `comercial` no usuário, o grupo some do menu e a URL direta **redireciona** (D-36). Temas: o módulo usa os tokens da casa (revisão de UI da S20 — séries de gráfico em `--dm-serie-1..6`, container queries nos KPIs); os temas `esmeralda`/`esmeralda-escuro` entraram no design system (catálogo 8 → 10).

> [!note] Mudança de acesso a dados (S20)
> O front antigo lia views por PostgREST direto com chave anon. Na fábrica, `authenticated` perdeu o SELECT direto de `vendas_marketing` e `vw_clientes_consolidados`; essas leituras passaram pelas **portas gateadas `fn_clientes_consolidados` e `fn_vendas_cliente`** (afeta, por inferência, `useTopClientsData` e os modais que liam a view — conferir no código ao mexer). As 10 RPCs são SECURITY DEFINER com `fn_negar_sem_modulo`. Tabelas `listas_disparo_*` seguem via PostgREST, agora sob RLS de módulo.

---

## 1. Painel de Recompra (`/comercial/recompra`)

**Composição:** `FilterBar` → `KPICards` → `CustomersTable` (`src/comercial/.../CustomersTable.tsx`).

**Dados:** `useCustomersPaginated(page, pageSize=50, filters)` → RPC **`fn_filter_customers(p_filters jsonb, p_limit, p_offset)`** — um round-trip devolve linhas + `total_count` (repetido em cada linha, DT-BD10). KPIs: `useScorecardsData` → **`fn_dashboard_scorecards(p_filters)`**, mesmo jsonb da tabela desde a Fase E (DT-F1/F3 ✅). Ambos os hooks em react-query com `AbortSignal` e queryKey serializada desde 2026-09-09 (DT-F5/F6 ✅); busca com debounce de 350ms (`useDebouncedValue` → `effectiveFilters` no antigo `App.tsx`).

**Colunas:** Nome (`MAX(nome_cliente)`) · Telefone · Compra no Período (`MAX(data_compra)` do período; ordenável) · Total Vida (`COUNT(*)` lifetime, badge → `CustomerLifetimeModal`) · Disparos (`disparosMap[normalizePhone(tel)]` via `useDisparosData` sobre `listas_disparo_membros`) · Itens (`SUM(numero_itens)` no período — **unidades**) · Faturamento (`SUM(valor_pedido)` no período) · Ações ("Ver Itens" → `ItemsModal`). `quantidade_pedidos` (pedidos no período) é retornado pela RPC e **nunca exibido**. Mobile: cards com 4 mini-stats.

**Paginação:** `pageSize=50` fixo; `page` reseta ao mudar filtros (DT-F2 ✅); ordenação por `ultima_compra` conforme `sortOrder` (DT-F4 ✅), **mas só client-side sobre os 50 da página** (DT-G16 aberto).

**Pegadinhas abertas:**
- 🟠 A RPC repete clientes entre páginas: `ORDER BY u_compra_periodo DESC` **sem desempate** (DT-BD5; 3 duplicados entre pág. 1↔2 confirmados em produção 10/09). É por isso que "selecionar tudo" parece pré-marcar itens na página seguinte.
- 🟠 "Selecionar todos" só marca a página atual (DT-F7); `selectedIds` persiste entre páginas.
- 🟡 Sem "limpar filtros" e sem persistência de estado em URL/localStorage (DT-F10).
- ⚪ `colSpan={8}` errado em modo seleção; `key={idx}` nas linhas (DT-F12).

**Modais:**
- `CustomerLifetimeModal` — busca **4 variantes do telefone** (bruto, só dígitos, sem `55`, com `55`) com fallback `ilike` por nome (pode misturar homônimos; `select('*')` sem limite — DT-F11). A existência das 4 variantes é a prova da base não normalizada ([[PLT - Comercial - Identidade do Cliente]]).
- `ItemsModal` — chave de cache corrigida em 2026-09-08 (DT-F8 ✅), mas ainda: busca só por `eq(telefone_cliente)` exato (cliente sem telefone vê "Nenhum item"); refaz o recorte de período **em JavaScript** por prefixo de string UTC; `custom` só aplica com início E fim (DT-F15).
- `DisparosPopover` inline (badge Disparos); seleção múltipla → `CriarListaModal` / `AdicionarListaModal`.

## 2. Filtros (FilterBar)

**Estado real:** `useState<FilterState>` inline no componente-raiz do módulo (no recompra era `App.tsx`), passado por prop. Defaults: `dateFilter:'all'`, `selectedItems:['all']`, `purchaseCount:['all']`, `spendType:'total'`, `spendMode:'above'`. *(O hook morto `useCustomerFilters.ts`, com defaults divergentes, não foi portado.)*

**Os 10 filtros**, enviados como **um único JSONB** (`p_filters`) e resolvidos 100% server-side em `fn_filter_customers`:

| Filtro | Campos | Semântica |
|---|---|---|
| Pesquisar | `searchQuery` | nome `ILIKE %q%` OU, **só se o termo tiver dígitos**, telefone só-dígitos (DT-F13 ✅ 2026-09-09) |
| Data da Compra | `dateFilter` + `customDateStart/End`, `specificYear/Month/Day` | recorta os pedidos "do período"; 5 modos + navegadores ‹ › |
| Itens Comprados | `selectedItems[]` | clientes que compraram ≥1 dos itens **no período** |
| Qtd. Compras | `purchaseCount[]` | por **pedidos de vida** |
| Inativo antes de | `inactiveBeforeDate` | última compra **de vida** anterior à data |
| Tempo de Recompra | `recompraMinDays/MaxDays` | dias entre a **1ª e a 2ª** compra de vida (`LEAD()`; DT-BD2 ✅) |
| Filtro de Gasto | `spendAmount` + `spendType` (`total`\|`average`) + `spendMode` (`above`\|`around` ±10%\|`below`) | compara gasto de vida ou ticket de vida |

**Opções dos dropdowns** (`useFilterOptions`, roda 1× no mount, **não reage aos filtros** — facetamento ficou na Sessão 7 do plano antigo): itens de `fn_dashboard_top_items_overall(null,null)` (desde DT-G2 ✅ retorna o catálogo inteiro, ~938); qtd. de compras derivada do máximo de `vw_clientes_consolidados` (dropdown pode ganhar 80 opções). A RPC trata o valor `'10+'` que a UI nunca produz — código morto no SQL.

**Pegadinhas abertas:** `dateFilter:'custom'` vazio devolve **tudo** (o motor legado devolvia nada); "Selecionar Todos" no MultiSelect dispara o caminho mais caro da RPC (`jsonb_array_elements` × array de centenas de itens por linha).

## 3. Dashboard Analytics (`/comercial/dashboard`)

**Container:** `AnalyticsDashboard`. **Não há filtro global** — cada bloco tem `usePeriodFilter` próprio com default diferente (DT-G13): ScorecardsRow `all` · RevenueChart `6m` · SeasonalityHeatmap `6m` · TopItemsPanel seletor de mês próprio · PurchaseFrequencyChart `all` · TransitionChart `3m` · Top 50/Recordes sem período (vida inteira). Dois números na mesma tela podem responder a janelas diferentes sem indicação. `usePeriodFilter` nunca produz teto superior fora de `custom` (`endCutoff=null` — pedidos com data futura entram, DT-G14).

**Gráficos:** Recharts (versão fixada pela SESSAO-16, 3.9.2) nos 4 cartesianos; `SeasonalityHeatmap` e `TopItemsPanel` são HTML/CSS puro. Cores via tokens da casa desde a revisão da S20.

Painel a painel (hook → RPC → pegadinhas):

| Painel | Hook | RPC | Pegadinhas |
|---|---|---|---|
| **ScorecardsRow** (6 cards, `AnimatedNumber`) | `useScorecardsData` (react-query) | `fn_dashboard_scorecards` | Taxa Recompra híbrida (numerador vida, denominador período) — infla janelas curtas |
| **RevenueChart** (linha + `ReferenceLine` no melhor mês) | `useRevenueChartData` | `fn_dashboard_revenue_chart` (`TO_CHAR 'YYYY-MM'`) | meses vazios preenchidos com 0 (DT-G6 ✅); tooltip mostra pedidos (DT-G7 ✅); bucket mensal em **UTC** |
| **SeasonalityHeatmap** (produto × mês, Top 1/3/5) | `useItemsDataQuery` (react-query, staleTime 30s) | `fn_dashboard_items` | `quantidade` = **ocorrências**, não unidades (rótulo corrigido DT-G4 ✅); RPC **sem LIMIT** — milhares de linhas para exibir 3/mês (DT-BD6); meses sem dado desaparecem da régua |
| **TopItemsPanel** (Top 30 mais/menos) | `useTopItemsOverallQuery` (react-query) | `fn_dashboard_top_items_overall` | "Menos comprados" ainda é o fundo do ranking de **vendidos** — itens com zero venda invisíveis (estrutural; Sessão 3 do plano antigo); `maxItemCount` compartilhado põe as barras do "menos" no piso de 6% (DT-G9); `availableMonths` fabricada — últimos 12 meses do calendário, histórico anterior inacessível (DT-G10) |
| **PurchaseFrequencyChart** (2 BarCharts + tabela) | `usePurchaseFrequencyData` | `fn_dashboard_purchase_frequency` | `LIMIT 15` silencioso (DT-BD8); segmentação por período, não por vida; ticket médio corrigido (DT-G5 ✅) |
| **TransitionChart** (barras clicáveis → `TransitionHistoryModal`) | `useTransitionsSummaryQuery` / drill-down `useTransitionsClientsQuery` | `fn_dashboard_transitions_summary` / `fn_dashboard_transition_clients` | `EXTRACT(DAY)` trunca horas (DT-BD7); semântica do período incide na compra de **chegada** (DT-G8); drill-down exibe nome mas agrupa por telefone — `client_id` instável e PII reintroduzida; `page` do modal nunca reseta; chips default `[2,3,4,5]` não reconciliados |
| **Top 50 Recompradores / Clientes Recordes** (inline) | `useTopClientsData` (roda 1× no mount, sem cache) | leitura de `vw_clientes_consolidados` (na fábrica, via porta gateada) | "Recordes" é Top **20** e os stats somam só os 20 exibidos, sem indicar (DT-G11); sem filtro de período; herdam a identidade duplicada; coluna Top Produtos agregada no cliente desde DT-G3 ✅ |

**Transversais:** 🔶 `loading` ainda descartado por parte dos componentes — durante o fetch aparecem zeros/"Sem dados suficientes" (DT-U1 parcial); falha de API renderiza KPIs zerados sem aviso (DT-U11); duas camadas de dados concorrentes react-query × useEffect cru, sem dedupe (DT-ARQ1); sem virtualização (DT-ARQ3); bundle ~1,7 MB com Recharts inteiro (DT-ARQ9).

## 4. Listas de Disparo (`/comercial/listas`, `/comercial/listas/:id`)

Comportamento e estados: [[PLT - Comercial - Maquina de Estados do Disparo]] — **inclusive a trava de disparo em 3 camadas ativa até o cutover** (botões `btn-disparar-lista`/"Enviar" desabilitados com explicação).

**Fluxo:** seleção na CustomersTable → `CriarListaModal` (separa `validData` ≥8 dígitos de `semTelefone`, ignorados com aviso; divide em N partes opcionalmente) → mensagem de referência (⚠️ **nunca enviada ao DataCrazy** — renomeada com aviso, DT-D10 ✅) → `DispararModal` (intervalo com toggle seg/min, custo por mensagem default 0,35, mínimo 10s) → `iniciarFila` → cron envia 1 contato/lista/ciclo → timers → `encerrarLista` (fecha pendentes como `perdido/lista_encerrada_manualmente`; UI read-only). `DELETE` em `listas_disparo` cascateia membros e eventos.

**`ListasDisparoDetalhe.tsx`** (~611 linhas) — a tela central: `fetchData()` (com spinner: lista + `vw_scorecards_lista` + membros + eventos) e `fetchDataSilent()` (polling de 8s enquanto `disparando`/`em_andamento`; **não recarrega eventos** — DT-D15). Renderiza título editável, **9 scorecards** (Membros, Enviados, Erros Envio, Resposta %, Conversão %, Custo, Receita, Ticket Médio, ROI %) em `grid-cols-8` (ROI cai sozinho na 2ª linha, DT-D26), tabela de membros com `CountdownTimer` (decorativo), barra de progresso, export CSV via `Papa.unparse` (delimitador `;`). IDs de teste: `btn-finalizar-disparo`, `btn-disparar-lista`, `btn-parar-contagem`.

**Camada de API** (`src/comercial/lib/disparo/api.ts` — PostgREST direto, sem RPC): `criarListaRascunho` (defaults `janela_resposta_dias:3`, `janela_resultado_dias:7`, `custo_disparo:0`; upsert com `ignoreDuplicates` desde DT-D8 ✅) · `adicionarMembrosALista` (valida telefone desde DT-D9 ✅) · `salvarMensagem` (sem evento) · `iniciarFila` · `finalizarDisparo` · `encerrarLista` · `removerMembrosDaListaBulk`. `registrarEnvio`/`registrarResposta`/`removerMembroDaLista` nunca são chamadas (substituídas pelas Edge Functions).

**Outros componentes:** `AdicionarListaModal` (não exclui listas `encerrada` do select) · `AuditoriaModal` (timeline, exibe `tipo_evento` cru) · `MembroAuditoriaModal` (grid de 4 datas + valor ganho) · `ListasDropdown` (2 queries casadas em JS, O(N×M)). *(`ListasDisparoMain.tsx`, órfão e quebrado — DT-D2 — não foi portado.)*

**Pegadinhas abertas:** tipo `ScorecardsLista` com 3 nomes de campo errados → `undefined` silencioso nos cards (DT-D11); ROI −100%/Conversão 0% em campanha em andamento parecem prejuízo consolidado (planejado "ROI (parcial)", Sessão 8 antiga); polling sobrescreve a edição da mensagem (`prev || …` — limpar o textarea faz o texto antigo voltar em 8s, DT-D16); divisão em N partes pode produzir menos de N listas (`Math.ceil`, DT-D18); validações usam `filteredData` em vez de `validData` (DT-D19); eventos do front sem `membro_id` (DT-D33); `normalizarTelefone` duplicada 5× (DT-D34); `alert()`/`confirm()` nativos (DT-D24); `useDisparosData` sem paginação — badges truncam em ~1000 linhas (DT-D22); tipos de evento semanticamente errados (`iniciarFila` grava `envio_registrado`, DT-D12); `encerrado_em`/`filtros_aplicados` nunca preenchidos (DT-D13); resquícios do desenho abandonado (`sincronizada`, `negocio_perdido_crm`, `id_lista_crm`, `tag_crm` — DT-D14); cabeçalho sticky sobrepõe linha ao rolar e o card da mensagem cobre o botão de encerrar (prints de 10/09; IDs DT-D37/D38 planejados e nunca registrados).

## Ver também

- [[PLT - Comercial - Dicionario de Metricas]] · [[PLT - Comercial - Maquina de Estados do Disparo]] · [[PLT - Comercial - Debito Tecnico]]
- [[SUPA - Comercial - Dominio de Dados]] · [[handoff_2026_09_16_sessao20_modulo_comercial]]
