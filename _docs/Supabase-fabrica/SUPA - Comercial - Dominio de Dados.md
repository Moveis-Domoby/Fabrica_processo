---
titulo: SUPA — Comercial — Domínio de Dados
tipo: nota
atualizado: 2026-09-17
tags: [comercial, supabase, banco-de-dados, rls, rpc]
---

# 🛒 SUPA — Comercial — Domínio de Dados

> [!info] Origem e estado
> Migrada do cofre da loja (Painel de Recompra) em **17/09/2026**, consolidando as notas `BD - *` de lá para o estado **pós SESSAO-19/20**. O que vale hoje: o domínio comercial vive **neste banco da fábrica** (migration 26, aplicada em 15/09 — ver [[handoff_2026_09_15_sessao19_banco_comercial]]), com `vendas_marketing` como **VIEW** (D-47) e RLS por módulo. O projeto Supabase antigo da loja (**"Painel de recompra"**, `kfkcumjepnxnnzyvmxfo`) continua **rodando em produção até o cutover (SESSAO-21)** — as seções marcadas como *"estado no projeto antigo"* descrevem ele e morrem no cutover.

Esta nota destrincha o domínio comercial. O restante do banco (`clientes`, `pedidos`, `pedido_itens`, tabelas `plt_*`) está em [[SUPA - Esquema do Banco]] — a fonte da verdade do que existe; nomes saem de lá. Contexto do projeto: [[SUPA - Visao Geral]] · [[PLT - Plano Uniao das Plataformas]] · [[000 - MAPA DO PROJETO]].

Notas irmãs: [[SUPA - Comercial - Edge Functions]] · [[SUPA - Comercial - Cron e Rotinas]].

---

## 1. `vendas_marketing` — agora é VIEW (D-47)

No projeto antigo, `vendas_marketing` é a **tabela-fato** física, alimentada pelas Edge Functions de sync do Tiny. Na fábrica ela **não é tabela**: é uma **view** que reproduz coluna a coluna o mesmo shape sobre `pedidos` + `clientes` (que já têm tudo — "reutilizar antes de criar", D-47).

### Mapeamento coluna a coluna (fábrica)

| Coluna (shape do recompra) | De onde vem na fábrica |
|---|---|
| `id` (uuid) | uuid **determinístico** derivado do número do pedido |
| `numero_pedido` | `pedidos.numero` |
| `nome_cliente` | snapshot `pedidos.raw->'cliente'->>'nome'` — **sem trim**, de propósito |
| `telefone_cliente` | `clientes.fone`, com fallback `clientes.raw->>'celular'` — dado **atual** do cadastro |
| `data_compra` | meia-noite **America/Sao_Paulo** de `pedidos.data_pedido` |
| `valor_pedido` | `pedidos.total_pedido` (o **líquido**) |
| `numero_itens` | derivado dos itens do pedido |
| `itens_comprados` | `pedidos.raw->'itens'`, no shape `{produto:{descricao}, quantidade, valorUnitario}` |
| `created_at` | — (shape preservado) |

A view executa **como a dona** e tem **gate de módulo no WHERE** via `plt_privado.fn_tem_modulo('comercial')` (admin sempre passa; `auth.uid()` nulo = máquina passa). Desde a SESSAO-20, `authenticated` **perdeu o SELECT direto** na view — pessoa só lê por RPC.

### O que muda de verdade em relação à tabela antiga

- **Itens com shape determinístico.** No antigo, `itens_comprados` era um JSONB **sem contrato** (às vezes array, às vezes string contendo array; nome do produto em até 10 caminhos diferentes, cada um precisando de `NULLIF(...,'null')`). Na fábrica a view **gera** o array sempre no mesmo shape — a cascata de 10 caminhos continua existindo no corpo das RPCs (copiadas sem alteração), mas agora só o caminho `$.produto.descricao` é de fato usado.
- **Identidade pelo cadastro atual, não pelo snapshot.** O telefone vem de `clientes` (atual); o recompra guardava o snapshot da época do pedido. Isso causou a **deriva histórica documentada de 10 pedidos (0,19%)** — telefones de 8223/8711 e nomes de 8546, 8611, 8805, 9062, 9159, 9663, 9881, 12538 — com efeito visível de **2 clientes a menos e 2 recorrentes a mais** no dashboard novo. **O número novo é o mais correto** (funde identidades da mesma pessoa). Detalhe: `docs/execucao/SESSAO-19.md`.
- **Não há mais SKU ausente**: o banco da fábrica tem `pedido_itens.codigo` (SKU real) — ver [[SUPA - Esquema do Banco]]. As RPCs copiadas ainda agrupam por descrição textual, mas o dado para evoluir isso existe aqui.

> [!warning] Estado no projeto antigo (válido até o cutover)
> Lá `vendas_marketing` segue sendo tabela física: UNIQUE em `numero_pedido` (chave de idempotência do upsert do sync), `telefone_cliente` nullable, índices duplicados (`idx_vendas_mkt_*` × `idx_vendas_marketing_*`), nenhum índice sobre a expressão de identidade `COALESCE(NULLIF(TRIM(telefone_cliente),''), nome_cliente)` (todo GROUP BY de cliente faz seq scan), nenhum índice GIN sobre `itens_comprados`, e RLS `FOR SELECT USING (true)` — **base inteira legível pela chave anon do bundle**. Tudo isso morre com o projeto antigo.

## 2. As 6 tabelas copiadas (DDL idêntico ao banco vivo, dump de 15/09)

Nasceram na fábrica com **DDL idêntico** — enums, constraints e **até os índices duplicados** de membros vieram junto. Carga servidor→servidor com **checksum idêntico 6/6** (4 listas · 128 membros · 288 eventos · 134 webhooks · 2 tarifas · 1 tiny_auth). O detalhamento abaixo vale portanto para **os dois projetos**; o que difere é só a **segurança** (ver §5).

### `listas_disparo` — a campanha

| Coluna | Tipo | Default / Constraint |
|---|---|---|
| `id` | `uuid` | **PK**, `gen_random_uuid()` |
| `nome` | `text` | NOT NULL |
| `descricao` | `text` | ⚠️ nunca preenchida |
| `filtros_aplicados` | `jsonb` | ⚠️ nunca preenchida — era para guardar o recorte que gerou a lista |
| `mensagem_utilizada` | `text` | documental — **não é enviada ao CRM** (na UI: "Mensagem de Referência") |
| `id_lista_crm` / `tag_crm` | `text` | ⚠️ nunca preenchidas |
| `status` | `status_lista_disparo` | NOT NULL, `'rascunho'` |
| `custo_disparo` | `numeric(12,2)` | NOT NULL, `0` — legado |
| `janela_resposta_dias` | `integer` | NOT NULL, `3` |
| `janela_resultado_dias` | `integer` | NOT NULL, `7` |
| `criado_por` | `text` | texto livre, **não é FK** — auditoria de "quem fez" não confiável |
| `criado_em` | `timestamptz` | NOT NULL, `now()` |
| `sincronizado_em` | `timestamptz` | resquício |
| `encerrado_em` | `timestamptz` | ⚠️ `encerrarLista()` não preenche |
| `intervalo_disparo_segundos` | `integer` | NOT NULL, `60` |
| `ultimo_envio_em` | `timestamptz` | usado pela fila para liberar o próximo envio |
| `categoria_mensagem` | `categoria_mensagem_whatsapp` | ⚠️ nunca preenchida |
| `tarifa_aplicada` | `numeric(10,4)` | fotografada no disparo, não muda retroativamente |

Índices: só a PK.

### `listas_disparo_membros` — o contato dentro da campanha

| Coluna | Tipo | Default / Constraint |
|---|---|---|
| `id` | `uuid` | **PK** |
| `lista_id` | `uuid` | NOT NULL, FK → `listas_disparo(id)` **ON DELETE CASCADE** |
| `cliente_id` | `uuid` | ⚠️ sem FK, sem tabela de destino — coluna órfã (herdada do antigo; **não** aponta para `clientes` da fábrica) |
| `telefone` | `text` | NOT NULL |
| `nome_cliente` | `text` | |
| `id_lead_crm` | `text` | |
| `snapshot_total_gasto` | `numeric(12,2)` | congelado na criação |
| `snapshot_qtd_compras` | `integer` | congelado |
| `snapshot_ultima_compra` | `date` | congelado |
| `status` | `status_membro_disparo` | NOT NULL, `'aguardando_envio'` |
| `motivo_perda` | `motivo_perda_membro` | |
| `data_envio` | `timestamptz` | |
| `prazo_resposta_limite` | `timestamptz` | `data_envio + janela_resposta_dias` (dias úteis sem domingo) |
| `data_resposta` | `timestamptz` | |
| `prazo_resultado_limite` | `timestamptz` | `data_resposta + janela_resultado_dias` (corridos) |
| `data_resultado` | `timestamptz` | |
| `valor_ganho` | `numeric(12,2)` | soma das vendas atribuídas |
| `id_negocio_crm` | `text` | na prática guarda o `numero_pedido` da venda |
| `criado_em` / `atualizado_em` | `timestamptz` | NOT NULL, `now()` — ⚠️ `atualizado_em` sem trigger `BEFORE UPDATE` |

Constraint chave: **`UNIQUE (lista_id, telefone)`**. (O bug do insert em lote que essa constraint derrubava — DT-D8 — foi corrigido no front em 2026-09-08 com upsert `ignoreDuplicates`.)

Índices: `idx_membros_telefone` · `idx_membros_lista` · `idx_membros_lista_id` (🔁 duplicado — veio junto no DDL idêntico) · `idx_membros_status` · e os **dois parciais bem desenhados para os crons de timer**: `idx_membros_prazo_resposta` (`WHERE status='aguardando_resposta'`) e `idx_membros_prazo_resultado` (`WHERE status='respondido_aguardando_resultado'`).

### `listas_disparo_eventos` — log de auditoria da campanha

| Coluna | Tipo | Constraint |
|---|---|---|
| `id` | `uuid` | **PK** |
| `lista_id` | `uuid` | NOT NULL, FK → `listas_disparo` ON DELETE CASCADE |
| `membro_id` | `uuid` | FK → `listas_disparo_membros` ON DELETE SET NULL |
| `tipo_evento` | `tipo_evento_disparo` | NOT NULL |
| `descricao` | `text` | |
| `payload` | `jsonb` | |
| `criado_em` | `timestamptz` | NOT NULL, `now()` |

Índice: `idx_eventos_lista` em `(lista_id, criado_em DESC)`.

### `tarifas_mensagem_whatsapp` — histórico de preço

`id` uuid PK · `categoria` (`categoria_mensagem_whatsapp`, NOT NULL) · `valor_unitario` numeric(10,4) NOT NULL · `vigente_desde` timestamptz NOT NULL `now()` · `criado_por` text. Índice `idx_tarifas_categoria_data` (`categoria, vigente_desde DESC`). A tarifa vigente é a linha mais recente de cada categoria — mas **nenhum código consulta esta tabela** (a tarifa vem digitada à mão no modal de disparo, default 0.35). No antigo ela estava **sem RLS e com GRANT ALL para anon**; na fábrica entrou no padrão da casa (§5).

### `webhook_eventos_crm` — log bruto do DataCrazy

`id` uuid PK · `tipo` text NOT NULL · `payload_bruto` jsonb NOT NULL (contém PII do CRM) · `telefone_identificado` text · `id_negocio_crm` text · `processado` boolean NOT NULL `false` · `erro_processamento` text · `recebido_em` timestamptz NOT NULL `now()` · `processado_em` timestamptz. Índice `idx_webhook_processado` (`processado, recebido_em`) — fila de processamento. Na fábrica: **só leitura** por RLS; quem escreve é a Edge Function `webhook-datacrazy-resposta`.

### `tiny_auth` — cofre do token OAuth v3 do Tiny

Linha **única** (singleton com `CHECK (id = 1)`), guarda o par `access_token`/`refresh_token` em texto puro. Na fábrica: **RLS ligado SEM nenhuma policy, de propósito** — segredo de máquina, **nem admin lê pelo navegador** (regra crítica 4; desvio deliberado do "admin lê tudo", registrado no [[handoff_2026_09_15_sessao19_banco_comercial]]).

> [!warning] O token copiado na carga de 15/09 já pode estar defasado — o renovador do projeto antigo rotaciona a cada ~3h. É esperado e inofensivo: o delta final da SESSAO-21 recopia na janela do cutover. Ver [[SUPA - Comercial - Cron e Rotinas]].

### O que NÃO foi copiado

- **`tiny_sync_state`** (ponteiro de retomada do sync do Tiny) — fica **só no projeto antigo**: a fábrica não roda as functions de sync (a view lê `pedidos`, alimentado pelo pipeline próprio n8n/webhook). Morre no cutover.
- As funções **`tick_*()`** (disparadoras de sync via `pg_net`) — idem, só no antigo. Ver [[SUPA - Comercial - Cron e Rotinas]].

## 3. Enums do domínio (5)

Copiados no DDL idêntico:

| Tipo | Valores |
|---|---|
| `categoria_mensagem_whatsapp` | `marketing`, `utilidade` |
| `status_lista_disparo` | `rascunho`, `sincronizada`, `disparando`, `em_andamento`, `encerrada` |
| `status_membro_disparo` | `aguardando_envio`, `aguardando_resposta`, `respondido_aguardando_resultado`, `ganho`, `perdido` |
| `motivo_perda_membro` | `sem_resposta_no_prazo`, `negocio_perdido_crm`, `prazo_resultado_expirado`, `erro_envio_mensagem`, `lista_encerrada_manualmente` |
| `tipo_evento_disparo` | `lista_criada`, `leads_sincronizados`, `mensagem_definida`, `envio_registrado`, `resposta_recebida`, `negocio_ganho`, `negocio_perdido`, `timer_resposta_expirado`, `timer_resultado_expirado`, `lista_encerrada`, `erro_envio_mensagem` **+ os 4 acrescentados em 2026-09-08 (fix DT-D1)**: `lista_renomeada`, `membros_adicionados`, `membro_removido`, `membros_removidos` |

## 4. Views do domínio

As duas foram **copiadas com `security_invoker`** na fábrica (a `vendas_marketing`, view nova, é o caso especial do §1).

### `vw_clientes_consolidados`

Agrupa `vendas_marketing` por identidade de cliente — `GROUP BY COALESCE(NULLIF(TRIM(telefone_cliente),''), nome_cliente)`. Colunas: `id_cliente` (a expressão de identidade), `nome_cliente`/`telefone_cliente` (`MAX`), `total_pedidos`, `faturamento_total`, `total_itens` (**unidades**), `primeira_compra`, `ultima_compra`. Herda o problema de identidade (telefone não normalizado → mesmo cliente pode aparecer 2×). Desde a SESSAO-20 o front **não a lê direto**: usa a RPC `fn_clientes_consolidados` (§6).

### `vw_scorecards_lista`

KPIs por campanha: `listas_disparo LEFT JOIN listas_disparo_membros`, `GROUP BY` lista. Contagens (`total_membros`, **`total_enviados`** — exclui erros de envio e é o denominador de tudo —, `total_respondidos`, `total_ganhos`/`total_perdidos`, `total_sem_resposta`, `total_expirados_sem_resultado`, `total_negocio_perdido_crm` — sempre 0, ninguém grava esse motivo —, `total_erros_envio`) e métricas (`receita_gerada`, `taxa_resposta_pct`, `taxa_conversao_pct`, `ticket_medio`, **`custo_total_real`** = `COALESCE(tarifa_aplicada × total_enviados, custo_disparo, 0)`, **`roi_pct`** — NULL quando custo = 0, UI mostra "—"; 0% = empate, não prejuízo). Na fábrica ficou **só-SELECT** (RLS de módulo cobre a leitura direta do front). Conferida idêntica ao antigo no md5 (4 listas).

## 5. Segurança e RLS do domínio comercial

### Estado atual (fábrica) — padrão da casa

| Objeto | Regra |
|---|---|
| `listas_disparo`, `listas_disparo_membros`, `listas_disparo_eventos`, `tarifas_mensagem_whatsapp` | RLS: **módulo `comercial` ou admin** (`plt_usuarios.modulos`, gate `plt_privado.fn_tem_modulo`) |
| `webhook_eventos_crm` | idem, **só leitura** — escreve só a Edge Function (service_role) |
| `tiny_auth` | RLS ligado, **zero policies** — só service_role; nem admin |
| `vendas_marketing` (view) | executa como a dona + gate de módulo no WHERE; `authenticated` **sem SELECT direto** desde a S20 |
| `vw_clientes_consolidados` | `authenticated` **sem SELECT direto** — leitura só por RPC |
| `vw_scorecards_lista` | só-SELECT, gate pela RLS de módulo das tabelas-base |
| As 10 RPCs copiadas | **SECURITY DEFINER** desde a S20, com `plt_privado.fn_negar_sem_modulo('comercial')` no topo (**nega com erro 42501**, em vez de devolver vazio); `search_path` fixado; execute **revogado de anon**; contexto de máquina (sem JWT) passa |
| Chave anon | **recusada em tudo** (verificado no harness da S19: 6 tabelas, 3 views, RPCs — leitura e escrita) |

Concessão do módulo: `plt_usuarios.modulos text[]` — seed da S19 deu `fabrica` a todos e `comercial` só ao admin; usuário novo nasce com `['fabrica']` (S20) e `comercial` é concedido à mão.

> [!warning] Estado no projeto antigo (válido até o cutover)
> O modelo lá é **"banco aberto atrás de uma chave anon"** (que está no bundle do front): `vendas_marketing` e `webhook_eventos_crm` legíveis por qualquer um com a chave (`SELECT USING (true)` — nomes, telefones, valores, PII do CRM); as 3 tabelas de disparo com `public_full_access` (**ler, escrever e apagar**, inclusive o "log imutável"); `tarifas_mensagem_whatsapp` e `tiny_sync_state` **sem RLS** com GRANT para anon; `tiny_auth` protegida por acidente (RLS sem policy); funções `tick_*` com `GRANT ALL TO anon` e o **JWT anon embutido no corpo** (mitigado em 2026-09-08: os crons passaram a usar anon key em vez de service_role, mas o desenho segue). Não há autenticação de usuário no produto antigo. **Nada disso deve ser "corrigido" lá — morre no cutover.**

## 6. As RPCs do domínio (10 copiadas + 2 novas)

Todas em `plpgsql`. Corpo **copiado do banco vivo em 15/09 sem alterar uma linha** (S19) — portanto já incluem todos os fixes aplicados na loja até essa data: `gap_days` via `LEAD()` (DT-BD2), busca sem no-op de texto (DT-F13), `is_recorrente` unificado = **2+ pedidos na vida, sempre** (DT-F14, decisão #4), scorecards com `p_filters` completo (DT-F1/F3), `LIMIT 300` removido do top itens (DT-G2), contagem de itens por **ocorrência em pedidos** e não unidades (decisão mantida, DT-G4). Na S20 ganharam o gate SECURITY DEFINER (§5) — **nenhum número mudou**.

| RPC | Assinatura | Retorna / papel |
|---|---|---|
| `fn_filter_customers` | `(p_filters jsonb, p_limit int = 20, p_offset int = 0)` | Motor de segmentação da tabela de clientes: `nome_cliente`, `telefone_cliente`, `quantidade_pedidos`, `faturamento_total`, `total_itens`, `data_primeira_compra`, `ultima_compra`, `pedidos_vida`, `is_recorrente`, `total_count` (em toda linha, para paginar sem 2ª chamada). Chaves de `p_filters`: `searchQuery`, `dateFilter` (+`custom*`/`specific*`), `selectedItems[]`, `purchaseCount[]`, `inactiveBeforeDate`, `recompraMinDays`/`recompraMaxDays`, `spendAmount`+`spendType`+`spendMode` |
| `fn_dashboard_scorecards` | `(p_filters jsonb = '{}')` | KPIs: `total_revenue`, `total_orders`, `total_clients`, `recurrents`, `recurrence_rate`, `avg_ticket` — mesmas CTEs e mesmo `p_filters` da de cima |
| `fn_dashboard_revenue_chart` | `(p_start, p_end)` | `month_str`, `revenue`, `orders` por `YYYY-MM` (meses vazios preenchidos no front) |
| `fn_dashboard_purchase_frequency` | `(p_start, p_end)` | `pedidos_count`, `faturamento_total`, `clientes_count` — quantos clientes fizeram N pedidos |
| `fn_dashboard_items` | `(p_start, p_end)` | `month_str`, `item_name`, `quantidade` (**ocorrências**) — heatmap de sazonalidade |
| `fn_dashboard_top_items_overall` | `(p_start, p_end)` | `item_name`, `quantidade` — top itens e dropdown de produtos (sem LIMIT desde DT-G2) |
| `fn_dashboard_transitions_summary` | `(p_start, p_end)` | `purchase_number`, `avg_days`, `client_count` — agregado sem PII; janelas sobre o histórico inteiro, filtro de período depois (proposital: ordinal real da vida do cliente) |
| `fn_dashboard_transition_clients` | `(p_purchase_number int, p_start, p_end, p_limit int = 20, p_offset int = 0)` | drill-down: `client_id`, `days_since_last`, `prev_date`, `curr_date` |
| `fn_dashboard_transitions` | `(p_start, p_end)` | 🪦 **LEGADA** — uma linha por transição, com telefone. A loja já recomendava dropar; veio na cópia "sem alteração". Na fábrica o risco de PII está mitigado pelo gate de módulo (§5), mas segue candidata a drop |
| `fn_vendas_disparo_por_telefone` | ⚠️ assinatura exata **não documentada nas fontes** (criada na Fase E, 2026-09-08, para a atribuição de venda filtrar por telefone no SQL; era `language sql`, virou plpgsql na S20 com o mesmo SELECT) | vendas de `vendas_marketing` por telefone — consumida por `verificar-vendas-disparo` |

**+2 novas na S20** (substituem as leituras diretas que o front do recompra fazia): `fn_clientes_consolidados(p_min_pedidos, p_ordem, p_limit)` e `fn_vendas_cliente(p_telefones, p_nome_exato, p_nome_parcial)` — **sem critério devolvem vazio**.

### Ressalvas conhecidas que vieram junto (corpo idêntico)

- `fn_filter_customers`: paginação instável — `ORDER BY u_compra_periodo DESC` **sem desempate** (adicionar `, cid` resolve); `gap_days` mede só o intervalo 1ª→2ª compra e a subquery correlacionada roda para todo cliente (DT-BD9/G15).
- `EXTRACT(DAY FROM interval)` **trunca horas** nas transições e no gap (média subestimada) — DT-BD7.
- `fn_dashboard_purchase_frequency`: `LIMIT 15` buckets — truncamento silencioso acima do 15º.
- `fn_dashboard_transition_clients`: rótulo ≠ chave (`client_id` exibido prioriza nome; `PARTITION BY` prioriza telefone) — identificador não estável.
- Sem materialized views: os dashboards refazem window functions e explosão de itens a cada carregamento (na loja era o maior gargalo de leitura; na fábrica a view soma o custo de montar `vendas_marketing` a partir de `pedidos` — desempenho a observar).

## Ver também

[[SUPA - Esquema do Banco]] · [[SUPA - Visao Geral]] · [[SUPA - Comercial - Edge Functions]] · [[SUPA - Comercial - Cron e Rotinas]] · [[handoff_2026_09_15_sessao19_banco_comercial]] · [[PLT - Plano Uniao das Plataformas]] · [[000 - MAPA DO PROJETO]]
