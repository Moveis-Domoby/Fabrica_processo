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
  - [x] 0.5 Aplicada em 15/09 com OK do dono ("voce tem meu ok para tudo") → advisors ok, nota do esquema atualizada (`.sql` espelho não muda: a 27 não toca a integração)
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
- 15/09 · **OK do dono ("voce tem meu ok para tudo")** → **migration 27 APLICADA** pela API (`apply_migration`, nome `plt_comercial_gate_negacao_temas`). Impressão digital da integração antes = depois: `7bd6bac6bd896c121995d18676ff82f2` (114 colunas, 8 tabelas). Smoke no banco real (bloco A-11, nada gravado): operador sem módulo → RPC nega com "Você não tem acesso ao módulo Comercial…" e view → permission denied; admin → scorecards R$ 4.386.602,88 · 5.304 pedidos · 4.090 clientes · 808 recorrentes (o delta do dia sobre a S19), portas novas respondem; máquina (sem JWT) passa. Advisors: **o ERROR `security_definer_view` da vendas_marketing SUMIU**; WARNs novos = as 12 RPCs DEFINER (endpoints de propósito, padrão da casa). Pré-existentes de outra frente (não tocar, anotar no handoff): `fn_pedido_por_numero_nf` executável por anon, `fn_backfill_conta_mapear`/`fn_vig_touch` sem search_path, `vig_conhecimento_vendas`.
- 15/09 · **Edge Function `autenticacao` v8 deployada** (verify_jwt ligado, como estava) — criar-usuario grava `modulos: ['fabrica']`.
- 15/09 · Conferência anti-disparo pós-aplicação: `listas_disparo_membros` = 128 (checksum de id+status `6e4460f5…`), `listas_disparo_eventos` = 288 (o total da carga da S19; último evento de 12/09, anterior à carga). NENHUM evento novo. Reconferir no fim da sessão.
- 15/09 · Nota do esquema atualizada (bloco migration 27). Preview local no ar (`localhost:5173` via `.claude/dev-plataforma.cmd` — caminho com espaço quebra o runner; anotado). Aguardando o dono logar no preview p/ validação visual + screenshots.
- 15/09 · **Critério 1 provado no dado vivo** (fábrica × recompra, mesmo instante, corte até 14/09): receita R$ 4.386.602,88 e 5.304 pedidos **ao centavo**; revenue_chart e top_items **md5 idênticos**; clientes 4.090×4.092 e recorrentes 808×806 = a deriva de identidade da S19 (documentada, aviso já dado); transitions diverge pela MESMA deriva (transição depende da identidade). Falta só o lado a lado VISUAL (telas) após o login do dono.
- 15/09 · **Ajustes visuais pedidos pelo dono na revisão ao vivo (ele estava no tema meia-noite):**
  - **Causa raiz de "gráfico sumiu / cores bugadas / reta feiona":** o porte usa variáveis CSS cruas HSL do shadcn (`hsl(var(--primary))` inline no Recharts, `--card`, `--border`, `--muted-foreground`) que o `index.css` do recompra definia; eu portei só os aliases do Tailwind, não as cruas → a linha `hsl(var(--primary))` ficava inválida (sumia) e, no meia-noite, `--color-primary` apontava p/ o amarelo da casa. **Correção:** o alias do `@theme` passou a apontar p/ `hsl(var(--nome))` e as variáveis cruas voltaram, escopadas em `.comercial` (paleta esmeralda do recompra: clara por padrão, escura nos temas escuros da casa). Verificado no DOM: linha `rgb(11,218,166)` 2.5px, `--primary`=`165 90% 45%`. Tailwind e Recharts agora leem a MESMA cor. ↩️ Isto revisa a nota de 15/09 que dizia "vocabulário shadcn virou alias da camada semântica".
  - **KPIs fora de esquadro / números cortados ("409"):** `min-h` iguala alturas; ícone decorativo só em `2xl` (com a sidebar ocupando largura, o ícone espremia o número); fontes responsivas + `tabular-nums`; grid dos scorecards do Dashboard 6-wide só em `2xl`. Conferido: 6 cards a 123px, números completos.
  - **Sensação tátil (cursor):** o Tailwind v4 não põe `cursor:pointer` em `<button>` no preflight — regra global no `@layer base` (vale p/ a casa E p/ o módulo). Conferido no DOM.
  - **Tom do menu por tema:** a sidebar era grafite fixo (S13) e destoava nos temas escuros; retint escopado a `.menu-superficie` p/ meia-noite/escuro/esmeralda-escuro/grafite/ardósia (só as `--dm-grafite-*` da casca). Temas CLAROS intactos (zero regressão).
  - **Setinha de dropdown nas seções da barra 2** (Controle de Produção/Logística/ROTAS): viraram recolhíveis com `ChevronDown` (estado lembrado em localStorage). Conferido abrindo/recolhendo.
  - tsc/lint/vitest 47/47/build verdes de novo. **Validação visual OK** no meia-noite: menu escuro casando, chips e gráficos esmeralda, linha do gráfico renderizando, KPIs alinhados.

## Revisão de UI/UX do dono (16/09) — correção estrutural, sem paliativo

O dono recusou (com razão) a primeira rodada de ajustes: eu tinha tratado
sintoma (truncate, `overflow-hidden`, esconder ícone, `min-h` fixo). Pedido
textual: *"faça uma análise de fato e perceba que há erros de UI/UX, ajuste
isso da forma correta, sem paliativos"*. Análise levantou **4 causas raiz**:

**1. O módulo tinha paleta PARALELA, não o tema da casa.**
Eu havia escopado a paleta esmeralda do recompra em `.comercial`. Resultado:
no tema meia-noite (amarelo × grafite) o Comercial aparecia todo verde — o
tema escolhido em Meu Perfil era ignorado. *Correção:* o vocabulário shadcn
(`--primary`, `--card`, `--border`…) virou **apelido dos tokens semânticos da
casa** em `:root`; os 29 usos inline `hsl(var(--x))` dos gráficos viraram
`var(--x)` e os 2 com alpha viraram `color-mix(in oklab, …)`. Provado no
navegador: `--dm-acao` e `bg-card` mudam nos 4 temas testados (claro #ffffff,
meia-noite #1a1a1f, esmeralda #f3f4f7).

**2. Cores de KPI hardcoded (emerald/orange/blue/purple/yellow).**
20 ocorrências que não obedeciam tema nenhum. *Correção:* nasceram os
**tokens de série** `--dm-serie-1..6` (a demanda manda ESTA sessão fixá-los
para a SESSAO-16 herdar). Série 1 = a cor de AÇÃO do tema; as demais clareiam
nos temas escuros; nenhuma usa o âmbar dos estados de qualidade (D-09).

**3. Vazamento do valor: tamanho por breakpoint de VIEWPORT.**
`text-2xl sm:text-3xl` não sabe a largura do card — a sidebar come ~450px, e o
mesmo viewport "xl" dá card de 150px ou de 300px. *Correção:* o bloco do número
virou **container query** (`.num-bloco` + `clamp(...cqi...)`) e o grid virou
`repeat(auto-fit, minmax(…,1fr))` — colunas pela largura REAL do container, não
pelo breakpoint. O `minmax` é calibrado pelo dado mais largo (R$ com centavos):
largura mínima compatível com o conteúdo é parte da correção, não só encolher
fonte. Paliativos REMOVIDOS: truncate, overflow-hidden, `hidden 2xl` do ícone,
`min-h` fixo. Alinhamento dos números agora é estrutural (`mt-auto` ancorando
no rodapé do card), não `min-h` no rótulo.

**4. Nada acompanhava zoom/tela grande.**
`max-w-6xl` (1152px) estrangulava: em 1920 sobrava faixa vazia. Alturas de
gráfico e listas em px fixos. *Correção:* Layout com `max-w-[min(100%,110rem)]`
(em 1920 o conteúdo passou de 1152 → 1457px) e alturas em `clamp(rem, vh, rem)`
nos 4 gráficos e 5 listas roláveis.

**Verificação objetiva** (script mede `scrollWidth > clientWidth` de cada
número + rolagem horizontal do documento), nas duas telas:
| largura | vazando | rolagem horizontal |
|---|---|---|
| 700px | nenhum | não |
| 900px | nenhum | não |
| 1280px | nenhum | não |
| 1920px | nenhum | não (7 colunas por auto-fit) |

⚠️ **Não consegui provar o redimensionamento do gráfico neste ambiente**: a
janela do preview fica atrás e a página não pinta — provado que o
`ResizeObserver` não dispara NENHUMA vez, nem um observer próprio de teste
(mesma causa dos screenshots que falham e das transições CSS congeladas).
O que o dono viu no zoom-out era o `max-w-6xl`, corrigido. **Pedir confirmação
no uso real.**

`tsc` ✅ · `lint` ✅ · `vitest` 47/47 ✅ · `build` ✅
