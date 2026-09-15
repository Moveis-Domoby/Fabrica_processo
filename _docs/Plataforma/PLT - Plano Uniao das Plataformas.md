---
titulo: Plano — União das Plataformas (Módulo Comercial)
tipo: plano
data: 2026-09-15
atualizado: 2026-09-15
tags: [plataforma, uniao, comercial, banco, migracao]
---

# 🔀 PLT — Plano da União das Plataformas

> [!abstract] O que é
> O **Painel de Recompra** (repo `C:\Users\wccau\Domoby\Planilha de recompra`, Supabase `kfkcumjepnxnnzyvmxfo`) é recriado **idêntico** dentro da Plataforma de Produção como o módulo **Comercial**. Ao final, um único banco (o da fábrica, `axnzldwgwsmepukdiljx`) e um único front. O painel antigo **não é desligado** até o dono validar o novo; o projeto Supabase antigo só é excluído após quarentena.
>
> Decisões que regem este plano: **D-46** (a união em si) e **D-47** (reutilizar antes de criar). Execução em 3 sessões: [[SESSAO-19 - Uniao 1 - Banco do Comercial na Fabrica]] → [[SESSAO-20 - Uniao 2 - Modulo Comercial no Front]] → [[SESSAO-21 - Uniao 3 - Cutover e Desligamento]].

## O diagnóstico que sustenta o plano (verificado ao vivo em 15/09/2026, via Cowork)

- `pedidos` (fábrica) e `vendas_marketing` (recompra) espelham **o mesmo dataset do Tiny**: 5.302 = 5.302 pedidos, 19/19 meses batendo ao centavo na comparação mês a mês — exceto o pedido 13406 (criado no próprio dia 15/09), diferença de R$ 979,00 por timing de sincronização, não por regra.
- **Formato de telefone idêntico** nos dois pipelines (ex.: `(84) 98892-9748`) — a identidade do cliente do recompra (`COALESCE(NULLIF(TRIM(telefone),''), nome)`) não muda ao trocar a fonte.
- O `pedidos` da fábrica recebe **criação E edição** em tempo real via webhook n8n (pedido 13406: criado 12:51, reatualizado 13:17; 350 pedidos com edições registradas; `tiny_fila` zerada). A auditoria de 5 min do recompra é redundante aqui.
- `pedidos.raw` guarda o payload bruto do Tiny — inclusive os itens no mesmo formato que o recompra armazena em `itens_comprados`.
- Nenhum nome de tabela, view, função ou trigger colide entre os dois bancos.
- ⚠️ Advisory crítico no projeto antigo: `tarifas_mensagem_whatsapp` e `tiny_sync_state` estão **sem RLS**, e as demais tabelas têm política `USING (true)` — a anon key dá acesso total. A migração corrige isso.

## Remapeamento do banco — estado final (banco da fábrica)

### Reutilizado (nada nasce — D-47)

| Origem (recompra) | Destino |
|---|---|
| `vendas_marketing` (tabela) | **View de compatibilidade** `vendas_marketing` sobre `pedidos` + `clientes` + `pedido_itens` (ou `pedidos.raw` para o jsonb de itens, se alguma RPC exigir o shape byte a byte). Mesmas colunas: `numero_pedido`, `nome_cliente`, `telefone_cliente`, `data_compra`, `valor_pedido`, `numero_itens`, `itens_comprados`, `id`, `created_at`. |
| `tiny_sync_state` | Não migra — o pipeline de sync do recompra é substituído pelo da fábrica (webhook n8n + `tiny_fila`). |
| Functions `tiny-incremental-sync`, `tiny-auditoria-sync`, `tiny-historico-mkt` + RPCs `tick_incremental_tiny`, `tick_auditoria_tiny`, `tick_historico_tiny` + 2 crons | Não migram — redundantes. |

### Nasce (necessidade real, sem equivalente)

- **6 tabelas**, DDL idêntico ao do recompra (constraints, uniques como `UNIQUE(lista_id, telefone)`, enums, defaults): `listas_disparo`, `listas_disparo_membros`, `listas_disparo_eventos`, `webhook_eventos_crm`, `tarifas_mensagem_whatsapp`, `tiny_auth` (cofre do token OAuth do Tiny — `plt_chaves_api` tem outro propósito e não deve ser distorcida).
- **Views**: `vendas_marketing` (a de compatibilidade), `vw_clientes_consolidados`, `vw_scorecards_lista` (as duas últimas copiadas do recompra).
- **RPCs copiadas sem alteração** (leem `vendas_marketing`, que continua existindo): `fn_dashboard_scorecards`, `fn_dashboard_revenue_chart`, `fn_dashboard_purchase_frequency`, `fn_dashboard_items`, `fn_dashboard_top_items_overall`, `fn_dashboard_transitions`, `fn_dashboard_transitions_summary`, `fn_dashboard_transition_clients`, `fn_filter_customers`, `fn_vendas_disparo_por_telefone`.
- **1 coluna** em `plt_usuarios`: `modulos text[] not null default '{}'` — permissões de módulo (`fabrica`, `comercial`). Seed: todos os usuários existentes recebem `{fabrica}`; `comercial` começa **só no admin** (D-46). Helper `plt_privado.fn_tem_modulo(text)` para RLS e front.
- **RLS no padrão da casa** nas 6 tabelas: leitura/escrita para `authenticated` com módulo `comercial` (admin sempre); Edge Functions seguem via `service_role`. Nada de `USING (true)`.

### Edge Functions (6 de 9) e crons (4 de 6) na fábrica

- Functions: `enviar-proximo-disparo`, `processar-timers-disparo`, `verificar-vendas-disparo`, `disparar-membro-individual`, `webhook-datacrazy-resposta`, `tiny-auth-refresh` (o renovador vai junto — decisão do dono).
- Secrets: ✅ **configurados pelo dono na fábrica em 15/09** — `TINY_CLIENT_ID`, `TINY_CLIENT_SECRET`, `DATACRAZY_WEBHOOK_TRIGGER_URL`, `DATACRAZY_WEBHOOK_SECRET` (valores nunca em chat/nota/código — regra 4). ⚠️ Consequência: as functions de disparo da fábrica estão **funcionais desde já**; sem cron elas não partem sozinhas, mas um clique dispara de verdade. Daí a trava de disparo obrigatória na SESSAO-20, destravada só no cutover.
- `tiny_auth`: fechada no navegador para **todos**, admin inclusive (RLS ligada, nenhuma policy) — só a `service_role` das Edge Functions lê. Confirmado pelo dono em 15/09.
- Crons (agendados **somente no cutover**, ver riscos): `enviar-proximo-disparo-cron` (`* * * * *`), `processar-timers-disparo-cron` (`0 * * * *`), `verificar-vendas-disparo-cron` (`30 * * * *`), `tiny-auth-refresh-cron` (`0 */3 * * *`) — modelo em `supabase/cron_agendamentos.sql` do repo do recompra, trocando URL e anon key pelas da fábrica.

### Reapontamento externo

- **DataCrazy**: no cutover, o dono troca a URL do webhook de resposta nas automações para `https://axnzldwgwsmepukdiljx.supabase.co/functions/v1/webhook-datacrazy-resposta`.
- **Tiny**: nada muda no ERP — o token vive em `tiny_auth`, que migra com os dados.

## ⚠️ Riscos que definem a ordem (não negociar)

1. **Token do Tiny morre se dois projetos renovarem**: o refresh **rotaciona** o refresh_token (validade 24h). `tiny-auth-refresh` roda em **exatamente um** projeto por vez. Antes do cutover: só no antigo. Depois: só na fábrica.
2. **Disparo duplicado**: `enviar-proximo-disparo` ativo nos dois projetos = cliente recebe WhatsApp 2×. Os crons de disparo vivem em exatamente um projeto por vez.
3. **Congelamento combinado (D-46)**: nenhum disparo é realizado em nenhum dos dois painéis até a união concluir. No módulo novo, nada de disparar antes do cutover — e, desde que os secrets entraram (15/09), isso deixou de depender de disciplina: a SESSAO-20 entrega os botões de disparo atrás de uma **trava explícita** (`DISPARO_LIBERADO = false`), que a SESSAO-21 vira no cutover.
4. **Números idênticos**: qualquer correção que mude número visível de dashboard é avisada antes (regra do recompra que passa a valer no módulo).

## Front (SESSAO-20) — resumo

- Todo o `src` do recompra entra como `src/comercial/` (componentes, dashboards Recharts, FilterBar, CustomersTable, módulo Listas de Disparo completo, hooks, `lib/disparo`, `lib/utils`). O view-state interno vira rotas: `/comercial/recompra`, `/comercial/dashboard`, `/comercial/listas` e `/comercial/listas/:id`.
- **Zero reapontamento de dados no código**: tabelas e RPCs mantêm os nomes; só o client Supabase passa a ser o da fábrica.
- Navegação (lei D-36 preservada): grupo **"Fábrica"** vira pai de Controle de Produção, Logística e ROTAS (`/fabrica/producao/:setor`, `/fabrica/logistica/*`, `/fabrica/rotas/*`), com redirects das rotas antigas; **"Administração" → "Painel admin"** (só rótulo); grupos "Fábrica" e "Comercial" visíveis conforme `modulos`/admin.
- Paleta: o verde-esmeralda claro/escuro do recompra entra como **temas novos no design system** (`tokens.css`, camada semântica) — o módulo Comercial respeita a arquitetura da casa e o design system ganha a paleta.
- Dependências novas: `recharts`, `date-fns`, `papaparse`, `@tanstack/react-virtual`, `react-hot-toast` (mantido dentro do módulo para comportamento idêntico; consolidação futura). Adaptar Tailwind v3→v4 (build, não aparência).
- IDs de teste dos botões de disparo preservados (`btn-disparar-lista`, `btn-confirmar-disparo`, etc.).

## Sequência completa

| Fase | O quê | Sessão |
|---|---|---|
| F1 | Migration de schema (6 tabelas + views + RPCs + coluna `modulos` + RLS) — escrita em arquivo, aplicada só com OK do dono | 19 |
| F2 | Deploy das 6 functions + dono configura secrets (crons NÃO agendados) | 19 |
| F3 | Carga das 6 tabelas + validação (contagens, checksums, comparação mês a mês das RPCs de dashboard contra o projeto antigo) | 19 |
| F4 | Front: módulo Comercial, navegação, temas, permissões | 20 |
| F5 | Validação em paralelo (painel antigo intocado; sem disparos) | 21 |
| F6 | Cutover em janela única: desagendar crons no antigo → delta final de dados → agendar crons na fábrica → dono troca URL no DataCrazy → refresh manual do token para confirmar | 21 |
| F7 | Quarentena 2–4 semanas → dump final de backup → pausar → **excluir** o projeto `kfkcumjepnxnnzyvmxfo` | 21 |

## Convivência com a SESSAO-16 (Dashboards de Verdade)

A 16 roda **antes** da 20, e pode correr **em paralelo** com a 19. Regras da convivência (D-46 revisada em 15/09):

- **16 × 19 — sem colisão.** A 16 é só apresentação e não cria migration de dados; a 19 não toca no front. Os namespaces são separados: dashboards da fábrica em `plt_fn_dash_*`, os do Comercial em `fn_dashboard_*`. A 19 não altera o gate da D-32.
- **16 × 20 — colisão real, por isso a ordem.** As duas escrevem em `src/App.tsx` (rotas), `src/componentes/Layout.tsx` (grupos do menu) e `src/estilos/tokens.css` (a 16 define as cores de série dos gráficos; a 20 acrescenta os temas esmeralda). A 20 só começa com a 16 entregue e mesclada.
- **Recharts é fixado pela 16.** A demanda da 16 já aponta Recharts como caminho natural, e o módulo Comercial traz Recharts. A 16 escolhe a versão; a 20 herda — uma entrada no `package.json`, nunca duas bibliotecas de gráfico no mesmo app. Se a 16 escolher outra biblioteca, isso vira decisão registrada antes da 20 começar.
- **Os dashboards da produção não se mexem.** Continuam como quatro telas-filhas do pai **Dashboards**, com os nomes atuais. O pai "Fábrica" criado na 20 recebe apenas Controle de Produção, Logística e ROTAS. O dashboard do Comercial nasce em `/comercial/dashboard`, dentro do próprio módulo — consolidar (ou não) os dois sob o pai Dashboards é **Q-66**, para uma sessão futura.
- **Duas sessões, uma pasta só.** Rodar dois Claude Code ao mesmo tempo em `Domoby - fabrica` faz as duas brigarem pelo working tree (uma branch por vez). Ou executa uma de cada vez, ou cria um `git worktree` separado para a segunda.

## Fontes vivas para conferência

- Repo do recompra: `C:\Users\wccau\Domoby\Planilha de recompra` (código, `supabase/functions/`, `supabase/migrations/`, `supabase/cron_agendamentos.sql`, cofre `_Docs/` próprio — ler `000 - MAPA DO PROJETO.md` de lá antes de portar o front).
- O DDL de referência das 6 tabelas e o corpo das RPCs saem do **banco vivo** do recompra (dump de schema), não da memória.

## Ver também

[[PLT - Decisoes de Produto]] (D-46, D-47) · [[000 - ORDEM DAS SESSOES]] · [[SUPA - Esquema do Banco]] · [[CLAUDE - Regras do Claude Code (repo)]]
