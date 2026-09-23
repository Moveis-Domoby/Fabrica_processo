---
titulo: Comercial — Legado e Cutover
tipo: nota
prioridade: alta
atualizado: 2026-09-22
tags: [comercial, plataforma, uniao, cutover, legado]
---

# 🔌 PLT — Comercial — Legado e Cutover

> [!success] ✅ Cutover executado em 22/09/2026 — [[handoff_2026_09_22_sessao21_cutover]]
> **F5** reconferida e assinada na conversa (jun–set ao centavo) · **F6**: 6 crons do antigo desativados (20:28 UTC) → delta das 6 tabelas idêntico byte a byte (inclui o `tiny_auth` fresco) → renovador ligado na fábrica e provado (21:19–21:20 UTC, só a fábrica avançou) → 3 crons de disparo ligados e provados (~21:30 UTC) → lado da fábrica do webhook DataCrazy validado (401 sem chave). **23/09:** o dono trocou a URL no DataCrazy e a trava do disparo foi aberta (PR #6); backup final **dispensado** pelo dono (nada exclusivo ficou no antigo). **F7: exclusão do projeto antigo marcada pelo dono para 06/10/2026** (os 6 jobs desativados somem junto). Na mesma janela: conferência Tiny × plataforma pedido a pedido (5.360) com 15 pedidos + 2 cadastros corrigidos e a causa-raiz registrada ([[N8N - Pendencias e Riscos]] P17 → [[SESSAO-29 - Reconciliacao Tiny - Pente-fino e Ultimo Pacote Vence]]).
> O quadro abaixo é o plano do cutover, mantido como estava.

> [!info] Origem e estado
> Compilada do cofre da loja (Painel de Recompra) em 17/09/2026, para servir à [[SESSAO-21 - Uniao 3 - Cutover e Desligamento]]. Vale para o módulo Comercial na plataforma da fábrica. Plano-mãe: [[PLT - Plano Uniao das Plataformas]].

> [!danger] O restante do material histórico morre com o repo da loja
> Handoffs antigos, os planos 005/006/007 completos, 010, 030 e o resto do cofre `_Docs/` do recompra **permanecem no repo da loja** (`C:\Users\wccau\Domoby\Planilha de recompra`) e serão arquivados/mortos com ele. O que precisava sobreviver está nas notas `PLT - Comercial - *` desta pasta. No desligamento, o cofre da loja recebe a nota de encerramento ("para onde tudo foi") — critério de aceite da SESSAO-21.

## 1. O que AINDA RODA no repo/Supabase antigos (e o que fazer no cutover)

Projeto antigo: Supabase **`kfkcumjepnxnnzyvmxfo`** + front do recompra. Até o cutover ele é **a produção de verdade** do disparo e da renovação de token.

| O que roda lá | Situação no cutover |
|---|---|
| **6 crons `pg_cron`** (sync: `tick-incremental-tiny`, `tick-auditoria-tiny`; disparo: `enviar-proximo-disparo` `* * * * *`, `processar-timers-disparo` `0 * * * *`, `verificar-vendas-disparo` `30 * * * *`; token: `tiny-auth-refresh` `0 */3 * * *`) | **Desagendar TODOS** (`cron.unschedule`) — passo 1 da janela F6. Depois, agendar os **4** da fábrica (sync não migra) |
| **9 Edge Functions** (as 6 de disparo/token + o trio de sync `tiny-historico-mkt`, `tiny-incremental-sync`, `tiny-auditoria-sync`) | O trio de sync **não migra** (redundante — a fábrica ingere via webhook n8n). As outras 6 já estão deployadas na fábrica desde a S19 |
| **`tiny-auth-refresh` renovando o token do Tiny** | ⚠️ Risco 1 do plano: o refresh **rotaciona** o refresh_token (validade 24h). Exatamente **um** projeto renova por vez — antes do cutover só o antigo, depois só a fábrica. Passo 5 da janela: disparo manual na fábrica e conferir `tiny_auth.updated_at` avançando **só** lá, por ≥24h |
| **Webhook de resposta do DataCrazy** apontando para o projeto antigo | **Dono troca a URL** nas automações para `https://axnzldwgwsmepukdiljx.supabase.co/functions/v1/webhook-datacrazy-resposta` (passo 4) — ver [[PLT - Comercial - Integracao DataCrazy]] |
| **Dados das 6 tabelas de disparo** (`listas_disparo`, `_membros`, `_eventos`, `webhook_eventos_crm`, `tarifas_mensagem_whatsapp`, `tiny_auth`) | **Delta final** desde a carga da S19, com contagens conferidas (passo 2). Baseline da S19/S20: 4 campanhas, 128 membros (checksum `6e4460f5…`), 288 eventos |
| **Front antigo do recompra** | Fica no ar como espelho congelado durante a quarentena (2–4 semanas); só desliga com a palavra do dono. Depois: dump final de backup guardado no cofre → **pausar** → **excluir** o projeto |
| **Tabela `vendas_marketing` + `tiny_sync_state`** | Não migram (a view da fábrica substitui a primeira; a segunda ficou sem função). Morrem com o projeto |

**No lado da fábrica, o que o cutover destrava:**
- A trava de disparo é **uma linha**: `DISPARO_LIBERADO` em `src/comercial/travas.ts` (ver [[PLT - Comercial - Maquina de Estados do Disparo]]).
- Agendar os 4 crons (modelo em `cron_agendamentos.sql` do repo do recompra, trocando URL e anon key pelas da fábrica) — e **versionar o SQL no repo da fábrica** (DT-ARQ5). Ver [[SUPA - Comercial - Cron e Rotinas]].
- Critério de aceite: primeira lista real pós-cutover roda ponta a ponta (envio → resposta via webhook → verificação de venda) no banco da fábrica.

## 2. Pendências conhecidas

- **Secrets**: ✅ já configurados pelo dono na fábrica em 15/09 — `TINY_CLIENT_ID`, `TINY_CLIENT_SECRET`, `DATACRAZY_WEBHOOK_TRIGGER_URL`, `DATACRAZY_WEBHOOK_SECRET` (nomes apenas; **valores nunca em chat/nota/código**). Consequência: as functions de disparo da fábrica são funcionais desde já — daí a trava.
- **Webhook DataCrazy**: reapontamento pendente (passo 4 acima). No Tiny nada muda — o token vive em `tiny_auth`, que migrou com os dados.
- **3 apontamentos de segurança do banco da fábrica herdados pela SESSAO-21** (de outra frente — backfill/vigia, não são do Comercial): `fn_pedido_por_numero_nf` SECURITY DEFINER executável por `anon` 🟠 (responde a quem não tem login — o mais sério); `fn_backfill_conta_mapear` e `fn_vig_touch` sem `search_path` fixo 🟡; `vig_conhecimento_vendas` com RLS ligada e nenhuma policy ⚪ (possivelmente intencional). Decidir com o dono: revogar/fixar/dropar.
- **Congelamento combinado (D-46)**: nenhum disparo em nenhum dos dois painéis até a união concluir; qualquer correção que mude número visível é avisada antes.
- **Screenshots das telas novas**: ficaram parciais na S20 (dispensados pelo dono — validação ao vivo).

## 3. Sessões de ajuste pendentes do plano 007 da loja — o que ainda faz sentido no módulo novo

O plano de sessões da loja executou só as sessões 0 e 1 (`handoff_2026_09_09_sessao0_1.md` (no `_Docs/Handoffs/` do repo antigo da loja — não migrado): DT-F13, F14, F5, F6). As **sessões 2–6 nunca rodaram** e, no essencial, continuam fazendo sentido — agora contra o banco/repo da fábrica:

| Sessão antiga | Escopo | Estado pós-união |
|---|---|---|
| **2 — Segurança mínima** (DT-SEC4, SEC2, BD4, SEC9, SEC8) | RLS, revokes, drop da RPC legada, `security_invoker`, `search_path` | **Encolheu**: SEC4/SEC2 foram superadas pela arquitetura da fábrica. Sobram **DT-BD4** (a `fn_dashboard_transitions` com PII **veio na cópia da S19** — dropar), **DT-SEC8** (`search_path` nas RPCs copiadas) e **DT-SEC9** reavaliada no modelo novo de acesso |
| **3 — Produtos** (DT-BD3, G9, G10 + estratégia) | `produtos_catalogo`, tabela de itens, "Menos Vendidos de verdade" (com zero-vendas), painel de Personalização | **Vale inteira** — e na fábrica pode se apoiar em `pedido_itens`/`pedidos.raw`. As 3 decisões de negócio continuam pendentes (personalizado no ranking; ocorrências × unidades; mesa 160/180 no catálogo). Números de referência da auditoria: ~200 nomes personalizados, 2,8% unidades, 4,6% receita, prêmio +78% |
| **4 — Higiene do repositório** (ARQ2/3/4/7/8/9, D2, D11, BD11) | código morto, lint, bundle, índices | **Encolheu**: o código morto não foi portado (ARQ2, D2 ✅) e ARQ4/ARQ8 morreram com o repo antigo. Sobram **DT-D11** (tipo `ScorecardsLista`), **DT-ARQ3** (react-virtual veio como dependência), **DT-ARQ9** (bundle ~1,7 MB confirmado na S20), **DT-ARQ7** e **DT-BD11** (reavaliar índices no banco novo) |
| **5 — UX de confiabilidade** (U1, U11, F15, G11, G13 + F10, F12, D24) | loading/error em tudo, ordenação server-side, ItemsModal com 4 variantes, "selecionar todos os N", rótulos de período | **Vale inteira** |
| **6 — Identidade do cliente** (BD1, BD7, BD9, G15) | normalização de telefone + índices + trocar a expressão em todas as RPCs de uma vez | **Vale, com adaptação**: `vendas_marketing` agora é view — ver o plano ajustado em [[PLT - Comercial - Identidade do Cliente]]. Impacto medido pequeno (1 par de variantes; ~50 vendas sem telefone; deriva 4.090×4.092 entre bancos) — barato de fazer agora |

As sessões **7–10** (também nunca executadas, adicionadas em 10/09 a pedido do dono) seguem como backlog válido: **7** filtros facetados + 5 filtros novos (DT-F16); **8** tela de disparo — layout/rolagem/KPIs "(parcial)" (DT-D36/D37/D38, D11, D15, D22, D26); **9** paginação estável + seleção multi-página (DT-BD5, G16, F7 — bug de dados **confirmado**: 3 clientes duplicados entre páginas); **10** 10 temas (⚠️ **revisar antes de aplicar**: o tema agora é do design system da plataforma — parte do escopo foi absorvida pela S20) + Auditoria Diária de volta (o botão é um stub proposital; exige a RPC `fn_export_resumo_diario` e uma decisão de formato com o dono). Ordem que a loja sugeria: 9 → 8 → 7 → 3 → 2 → 10 → 4 → 5 → 6. Os DTs correspondentes estão em [[PLT - Comercial - Debito Tecnico]].

**Regras de execução que passam a valer no módulo** (herdadas do protocolo da loja): marcar DTs `✅ resolvido em AAAA-MM-DD` sem apagar; avisar o dono **antes** de qualquer mudança que altere número visível; decisões de negócio são perguntas para o dono.

## 4. Arquitetura antiga (020) — só contexto histórico

O painel da loja era: Tiny ERP (API v3, OAuth2) puxado por **pg_cron + pg_net** chamando 4 Edge Functions de sync/token, gravando na **tabela** `vendas_marketing`; DataCrazy (WhatsApp) entrava por webhook. Um único Postgres/Supabase (`kfkcumjepnxnnzyvmxfo`) com dois domínios — analítico (`vendas_marketing`, `vw_clientes_consolidados`, `fn_dashboard_*`, `fn_filter_customers`) e operacional (`listas_disparo*`, `vw_scorecards_lista`, `webhook_eventos_crm`, `tarifas_mensagem_whatsapp`) — mais a infra de sync (`tiny_auth`, `tiny_sync_state`, `tick_*()`). O front React 19 + Vite + Tailwind falava **PostgREST/RPC com a chave anon** (RLS aberta, `USING (true)`), **sem router** — um `useState` de view (`main`/`dashboard`/`listas`) alternava telas com CSS, o dashboard ficava montado e oculto; sem URLs compartilháveis. Duas camadas de dados conviviam (react-query em 4 hooks; useEffect cru no resto), com código morto catalogado (5 hooks, cliente REST do DataCrazy, `ListasDisparoMain`). Tema claro/escuro por classe, primária verde-esmeralda, sem persistência. Dessa arquitetura, a união **preservou** o domínio operacional (DDL idêntico), as RPCs (verbatim) e os 40 arquivos vivos do front; **substituiu** a ingestão (webhook n8n da fábrica), o modelo de acesso (login + módulos) e o roteamento (rotas `/comercial/*`); e **descartou** o sync próprio, o acesso anon e o código morto.

## Ver também

- [[SESSAO-21 - Uniao 3 - Cutover e Desligamento]] · [[PLT - Plano Uniao das Plataformas]] · [[handoff_2026_09_16_sessao20_modulo_comercial]]
- [[PLT - Comercial - Debito Tecnico]] · [[PLT - Comercial - Maquina de Estados do Disparo]] · [[PLT - Comercial - Integracao DataCrazy]]
- [[SUPA - Comercial - Dominio de Dados]] · [[SUPA - Comercial - Edge Functions]] · [[SUPA - Comercial - Cron e Rotinas]] · [[000 - MAPA DO PROJETO]]
