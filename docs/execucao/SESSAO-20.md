# Memória de execução — SESSAO-20 · União 2: Módulo Comercial no front

**Branch:** `sessao-20-uniao-modulo-comercial` · **Início:** 2026-09-15
**Demanda:** `_docs/Plataforma/Demandas/SESSAO-20 - Uniao 2 - Modulo Comercial no Front.md` (lida 2x)
**Decisões que regem:** D-46, D-36, D-27, D-40, D-41, D-47 · regra crítica 2 (nada no banco sem OK) · congelamento de disparo (D-46 risco 3)

## Task list (espelho da demanda, item a item — marcar SÓ quando feito)

- [ ] **0. Fechar a exposição da `vendas_marketing` (opção A, escolhida pelo dono)**
  - [x] 0.1 Verificar o estado real no banco ANTES de codar (ver "Achado" abaixo)
  - [x] 0.2 Conferir leituras diretas do front do recompra (4 arquivos vivos leem view direto)
  - [x] 0.3 Migration 27: revoke select de `vendas_marketing`/`vw_clientes_consolidados` p/ authenticated; 10 RPCs → SECURITY DEFINER com gate que NEGA (raise); RPCs novas p/ as leituras diretas; grants das 3 views só leitura
  - [x] 0.4 Harness `test:banco` 2 rodadas com verificações novas da S20 (12 verificações novas — TUDO VERDE 2x)
  - [ ] 0.5 Aplicar SÓ com OK explícito do dono nesta conversa → depois advisors + espelho `.sql` + nota
- [ ] **1. Navegação**
  - [ ] 1.1 Pai "Fábrica" com Controle de Produção, Logística, ROTAS (`/fabrica/producao/:setor`, `/fabrica/logistica/*`, `/fabrica/rotas/*`)
  - [ ] 1.2 Redirects de TODAS as rotas atuais (bookmark de tablet não quebra; `/tablet` intocada)
  - [ ] 1.3 "Administração" → rótulo "Painel admin" (rotas intactas)
  - [ ] 1.4 Grupos visíveis conforme `plt_usuarios.modulos` (admin vê tudo); sem `fabrica` → esconder também Dashboards e botão Modo tablet (resposta do dono, item 3)
- [ ] **2. Módulo Comercial em `src/comercial/` (porte 1:1)**
  - [ ] 2.1 Painel principal `/comercial/recompra` (FilterBar + KPIs + CustomersTable)
  - [ ] 2.2 Dashboard analítico `/comercial/dashboard` (Recharts)
  - [ ] 2.3 Listas de Disparo `/comercial/listas` e `/comercial/listas/:id` (criar, adicionar, auditoria, scorecards)
  - [ ] 2.4 Mesmos textos, fluxos e IDs de teste (`btn-disparar-lista`, `btn-confirmar-disparo`, …)
  - [ ] 2.5 Código morto NÃO portado: `useCustomerFilters`, `useDashboardData`, `useItemsData`, `useTopItemsOverallData`, `useTransitionData`, `lib/datacrazy/client.ts`, `ListasDisparoMain.tsx`
  - [ ] 2.6 Leituras diretas de view viram as RPCs novas com gate (consequência do 0)
- [ ] **3. Trava de disparo** — `DISPARO_LIBERADO = false`; botões de disparo individual/fila/iniciar fila desabilitados com explicação; NENHUMA chamada a `disparar-membro-individual`/`enviar-proximo-disparo` na sessão inteira; conferir no fim: `listas_disparo_eventos` sem evento de envio e `listas_disparo_membros` com os mesmos 128 registros/status
- [ ] **4. Paleta** — temas esmeralda claro/escuro no `tokens.css` (camada semântica) + check de `plt_usuarios.tema` ampliado por migration (resposta do dono, item 1)
- [ ] **5. Client e dependências** — client `@/lib/supabase` da fábrica; deps EXATAS do recompra (ver decisões); Tailwind v3→v4 só na build
- [ ] **6. Criação de usuário concede `fabrica`** (resposta do dono, item 2) — Edge Function `autenticacao`; deploy é passo separado com OK
- [ ] **7. Critérios de aceite conferidos um a um** + screenshot de cada tela nova
- [ ] **8. Handoff + cofre** (memória de aprendizado, esquema, `.sql`, índice, mapa) — versão do Recharts registrada p/ a SESSAO-16

## Respostas do dono (15/09, nesta conversa)

1. Item 0 = **opção A** (revogar leitura das views p/ authenticated; RPCs SECURITY DEFINER negando; leituras diretas viram RPC).
2. Temas esmeralda entram; a regra do banco (`check` de `plt_usuarios.tema`) é alterada para aceitá-los.
3. Criação de usuário passa a conceder `fabrica` (entra na sessão).
4. Sem `fabrica`: esconder grupo Fábrica, **Dashboards e o botão Modo tablet** também.
5. Edições soltas do cofre → 1º commit da branch (feito: `1375a0b`).

## Achado do item 0 (corrige o diagnóstico da demanda)

A view `vendas_marketing` **já tem gate**: `WHERE plt_privado.fn_tem_modulo('comercial')` (migration 26; conferido em produção por `pg_get_viewdef` + teste com JWT simulado — operador sem módulo: 0 linhas e scorecards zerados; admin: 5.303 linhas). O texto da demanda ("a view não tem nenhum gate") partiu de avaliação que não viu o WHERE. O que existe de verdade:

- RPCs/view devolvem **vazio/zero** em vez de **negar** (o critério de aceite pede negação);
- ACL das 3 views com privilégio total p/ authenticated (default do Postgres; inofensivo na prática — `is_updatable = NO` nas 3 — mas sujeira);
- view sem `security_barrier` (risco teórico; some com a revogação do A).

Não há vazamento interno em aberto hoje. O A entra como negação explícita + camada extra. Registrar no handoff e no resultado da demanda.

## Leituras diretas de view no front do recompra (viram RPC no porte)

- `hooks/useTopClientsData.ts` → `vw_clientes_consolidados` (2x: ≥2 pedidos, order pedidos+faturamento, limit 50; order faturamento, limit 20) + `vendas_marketing` (itens dos 20 "Recordes", eq telefone OU eq nome)
- `hooks/useFilterOptions.ts` → `vw_clientes_consolidados` (max total_pedidos, limit 1)
- `components/CustomerLifetimeModal.tsx` → `vendas_marketing` (in variantes de telefone; fallback ilike nome; order data_compra asc)
- `components/ItemsModal.tsx` → `vendas_marketing` (eq telefone; itens_comprados + data_compra)
- `components/ListasDropdown.tsx` e `ListasDisparoDetalhe.tsx` → `vw_scorecards_lista` **fica como leitura direta** (security_invoker sobre tabelas com RLS de módulo); grant vira só SELECT

Desenho das RPCs novas (SECURITY DEFINER, gate negando, execute revogado de public/anon):
- `fn_clientes_consolidados(p_min_pedidos int default null, p_ordem text default 'pedidos', p_limit int default 50)` → shape da `vw_clientes_consolidados`
- `fn_vendas_cliente(p_telefones text[] default null, p_nome_exato text default null, p_nome_parcial text default null)` → shape da `vendas_marketing`, order data_compra asc

## Decisões técnicas da sessão

- **Recharts `3.9.2` EXATO** (o que o painel antigo roda hoje — gráficos idênticos por construção; a SESSAO-16 herda). Demais deps também exatas do recompra: date-fns 4.4.0, papaparse 5.5.4, @tanstack/react-virtual 3.14.9, react-hot-toast 2.6.0.
- Temas novos: `esmeralda` (claro) e `esmeralda-escuro` — padrão de nome do catálogo D-41.
- Migration 27 = `20260915180000_plt_comercial_gate_rpcs_temas.sql` (item 0 + check do tema).
- `vw_scorecards_lista` continua exposta (RLS de módulo cobre); só o grant enxugado.

## Log de execução (cronológico — escrever NA HORA)

- 15/09 · Leitura obrigatória completa (CLAUDE.md, memória de aprendizado, decisões, visão, requisitos, índice+demanda 2x, handoff da 19, plano da união, modelo de sistema, esquema do banco, mapa; cofre do recompra: mapa, MM disparo, TELA Filtros, PAINEL Gráficos, DT índice, CLAUDE.md de lá).
- 15/09 · Item 0 verificado ao vivo no banco real ANTES de codar: leituras de catálogo + bloco com `raise exception` proposital (padrão A-11, nada gravado). Achado registrado acima; opção A aprovada pelo dono.
- 15/09 · Branch criada; cofre pendente commitado (`1375a0b`).
- 15/09 · Migration 27 escrita: `20260915180000_plt_comercial_gate_negacao_temas.sql` — helper `plt_privado.fn_negar_sem_modulo` (raise 42501, mensagem sem código interno — D-27); ACL das 3 views enxuta (authenticated perde `vendas_marketing`/`vw_clientes_consolidados`; `vw_scorecards_lista` só SELECT); 10 RPCs recriadas SECURITY DEFINER com `PERFORM fn_negar_sem_modulo('comercial')` no topo (corpo intacto; `fn_vendas_disparo_por_telefone` era `language sql` → virou plpgsql com RETURN QUERY do MESMO select); 2 portas novas `fn_clientes_consolidados` e `fn_vendas_cliente` (sem critério = vazio); check de `tema` com os 10 (esmeralda, esmeralda-escuro). SEM security_barrier (de propósito: com o grant revogado só RPC lê a view, e barrier mataria pushdown).
- 15/09 · Lição E-19 aplicada: o check de tema da migration 22 virou `not valid` (reaplicação num banco que já viveu os temas da 27 não pode quebrar).
- 15/09 · Harness: +12 verificações da S20 (definer nas 12, ACL, negação sem módulo nas 3 portas, números idênticos com módulo, recorte/ordem das portas novas, máquina passa, temas). 1ª rodada pegou asserção MINHA errada (a view consolidada enxerga os pedidos do cenário do kanban — o teste esperava 1 linha); corrigido o TESTE (recorte+ordem+cliente da S19), não a RPC. **TUDO VERDE 2 rodadas.**
- 15/09 · ⏸️ Aplicação da migration 27 AGUARDA OK do dono (regra crítica 2). Seguindo para o front enquanto isso.
- 15/09 · **Porte do front**: 40 arquivos vivos copiados verbatim p/ `src/comercial/` (components/hooks/data/lib — estrutura do recompra preservada; 7 mortos NÃO portados). Adaptador `comercial/lib/supabase.ts` re-exporta o client da fábrica — ZERO mudança de import nos portados. Edições cirúrgicas: trava de disparo (`travas.ts` + `btn-disparar-lista`/`btn-confirmar-disparo`/Enviar individual desabilitados com tooltip + guarda em `handleRegistrarEnvio` e `iniciarFila` — cinto e suspensório) e as 4 leituras diretas de view religadas às RPCs novas (`fn_clientes_consolidados`, `fn_vendas_cliente`) em useTopClientsData/useFilterOptions/CustomerLifetimeModal/ItemsModal.
- 15/09 · Páginas do módulo: `PainelRecompra` (o view main do App.tsx do recompra; view-state→rotas; alternador Sol/Lua saiu — tema é o do Meu Perfil/D-41, decisão registrada p/ o handoff), `DashboardComercial`, `ListasDisparoIndice` (cola mínima da rota /comercial/listas — mesma consulta do dropdown), `ListaDetalhe`.
- 15/09 · Navegação: App.tsx com `/fabrica/producao/:codigo`, `/fabrica/logistica/*`, `/fabrica/rotas/*`, `/comercial/*` (guard `RotaModulo` — sem módulo, redirect ao Meu painel); redirects de TODAS as antigas (`/producao/:codigo` param-aware, `/logistica/*` e `/rotas/*` por prefixo, `/pcp`, `/expedicao`, `/setores/:id`); `/tablet` intocada. `rotaDoSetor` atualizado (fonte única). Layout: pai **Fábrica** (seções Controle de Produção/Logística/ROTAS na barra 2 — barra 2 ganhou seções com título), pai **Comercial** (Painel de Recompra/Dashboard/Listas), "Administração"→**"Painel admin"** (só rótulo), Dashboards e botão Modo tablet escondidos sem módulo `fabrica` (resposta do dono item 3). `Perfil` ganhou `modulos` + helper `temModulo` (espelho do fn_tem_modulo).
- 15/09 · Temas: `esmeralda`/`esmeralda-escuro` em tokens.css (camada semântica; ação = verde c/ contraste ≥4,5:1; escuro entra na família color-scheme dark); catálogo 8→10 em perfil/tema.ts. Vocabulário shadcn do porte (`bg-background`, `text-primary`…) virou ALIAS da camada semântica no `@theme` do global.css — porte 1:1 sem reescrever className; CSS próprio do recompra (transition-colors, scrollbar, fadeSlideDown) escopado em `.comercial`.
- 15/09 · Deps EXATAS no package.json: recharts 3.9.2 · date-fns 4.4.0 · papaparse 5.5.4 · @tanstack/react-virtual 3.14.9 · react-hot-toast 2.6.0 (+@types/papaparse 5.5.2). `npm install` ok.
- 15/09 · Edge Function `autenticacao`: criar-usuario grava `modulos: ['fabrica']` (item 2 do dono) — código versionado; **deploy aguarda OK** (regra 2).
- 15/09 · ESLint: override documentado p/ `src/comercial/**` (código portado, oxlint na origem; refatorar é proibido — os achados já são DT-* no cofre de lá). `tsc` ✅ · `lint` ✅ · `vitest` 47/47 ✅ (novos: trava fechada + iniciarFila recusa; temModulo; rotaDoSetor) · `build` ✅ (bundle ~1,68 MB — DT-ARQ9 do recompra, catalogado; sem refatorar).
