---
titulo: Execução — SESSAO-32 · Desempenho e escala (adequação de toda a plataforma)
tipo: execucao
data: 2026-10-15
atualizado: 2026-10-15
tags: [execucao, sessao-32, bloco-6, desempenho, escala, banco, front, tempo-real, autenticacao]
---

# 🔧 Execução — SESSAO-32 · Desempenho e escala

**Pasta:** a principal (`Domoby - fabrica`), sem worktree (pedido do dono). `git worktree list`: só a principal. **Branch:** `sessao-32-desempenho-escala`, criada em 15/10 da `main` = `origin/main` = **1b6534c** (fetch pela credencial do `gh`; 0 atrás / 0 à frente — contém a SESSAO-30 e a SESSAO-31 inteiras, com os ajustes e o encerramento de 15/10).
**Demanda:** [[SESSAO-32 - Desempenho e Escala - Adequacao de Toda a Plataforma]] (lida 2×; §1.6 com a dívida 17 a pedido do dono) · [[PLT - Lei de Desempenho e Escala]] (inteira) · handoffs da 30 (inteiro) e da 31 (inteiro, §10 = ajustes de 14–15/10 e as decisões provisórias confirmadas — D-136).
**Numeração (conferida no cofre e nas migrations, 15/10):** migration **76** em diante · **D-137** em diante · **E-101** em diante (E-101 usada) · **A-65** em diante.
**Modo:** ritual completo — (a)(b)(c) ao dono antes de codar; só codar com o OK.

## Leituras (15/10)

Regras do repo (inteiras — 18 e 19), Memória de Aprendizado (inteira), Decisões (D-01…D-17 e as citadas pela demanda: D-43*, D-67, D-68, D-80, D-91; D-113…D-136), Visão Geral, Ordem das Sessões, Perguntas em Aberto, Esquema do Banco (integração + plataforma até a migration 40; o resto por busca quando preciso), Lei de Desempenho (inteira), PROMPT do Bloco 6, handoffs 30 e 31.

\* A demanda cita "D-43 (blindagem dos gatilhos de `pedidos`)", mas a D-43 do arquivo de decisões é o Meu Perfil; a blindagem é a do Esquema do Banco ("⚠️ Os gatilhos sobre `pedidos` mudaram (D-43)" — a numeração da frente do backfill) + E-24/E-25 e a migration 24/25. Lida como: **não regredir a guarda dos gatilhos de `pedidos` nem a impressão digital da integração**.

## Erros da largada

- **E-101** (o `cd` pela quinta vez — antes de reler a memória): `change_directory` de volta à raiz; nada escrito fora. Promovido a **regra 20** do `CLAUDE.md` (raiz e cofre) — e, junto, a cópia do cofre ganhou a frase do ClickUp humanizado que só a raiz tinha (as duas estavam fora de sincronia desde 14/10).
- **E-102** (coluna de memória numa consulta de leitura do retrato: `plt_webhook_entregas.criado_em` → `criada_em`): sem dano; nome tirado da migration.

## Retrato de partida (15/10, só leitura — `now()` do banco 2026-10-15 23:42 UTC)

**Banco** (Supabase "Fabrica", Postgres 17.6, organização "Tech" no **plano gratuito**; banco com 183 MB):

| # (lei §14) | 07/10 | 15/10 |
|---|---|---|
| 2 · `postgres_changes` em `plt_cards` | 3 telas; 233 mil leituras do diário (WAL) | a leitura do WAL pelo Realtime segue no topo do registro de uso: **262.316 chamadas** (+29 mil em 8 dias), 1.960 s somados; **1 assinatura ativa** no momento da medida; a publicação do Realtime ainda tem só `plt_cards` |
| 5 · portas lentas (registro de uso, média desde 17/08) | comercial até 4,3 s; pedido do Tiny 0,85 s (máx. 3,7 s) | comercial: `fn_dashboard_top_items_overall` 1.072 ms (máx. 4,8 s) · `fn_clientes_consolidados` 963 ms (máx. 3,1 s) · `fn_filter_customers` 723 ms (máx. 4,5 s) · `fn_dashboard_items` 586 ms · `fn_dashboard_scorecards` 570 ms (máx. 7,6 s) · `fn_dashboard_transitions_summary` 490 ms · `fn_dashboard_purchase_frequency` 487 ms · `fn_dashboard_revenue_chart` 194 ms · `fn_vendas_cliente` 102 ms (1.531 chamadas). **Pedido do Tiny (`fn_upsert_pedido` de 5 parâmetros, a de hoje): 620 chamadas, média 810 ms, máx. 3,7 s.** PCP (`plt_fn_pedidos_kanban`, dívida 16): 174 ms (840 chamadas, máx. 2,3 s). Pedidos (`plt_fn_pedidos_lista`, dívida 17): **951 ms em 24 chamadas (máx. 2,35 s)**. Ficha do pedido (`plt_fn_pcp_pedido_detalhe`): 734 ms. `plt_vw_execucoes` (leitura direta): 80 ms em 4.323 chamadas (máx. 2,3 s). Estoque: as médias históricas (602–833 ms) misturam as versões antigas — a S30 levou as portas a ~10–20 ms no servidor; resta a dívida 13 (catálogo ×100) |
| 6 · relógios do banco | 3 a cada minuto + fotos a cada 5 min | **igual**: `enviar-proximo-disparo-cron`, `plt-estoque-reservas` (80 ms) e `plt-webhooks-despachar` (20 ms) a cada minuto = 4.320 rodadas/dia; `plt-fotos-tiny` a cada 5 min (288/dia, 144 ms); de hora em hora: `plt-estoque-vencimentos`, `processar-timers-disparo-cron`, `verificar-vendas-disparo-cron`; a cada 3 h: `tiny-auth-refresh-cron` (renovação — é de calendário); diários: aniversários, mínimos, varredura do estoque do Tiny, pente-fino. 12 jobs, 0 falhas em 24 h |
| 7 · permissão consultada a cada chamada | sim | **sim**: as funções de sessão (`fn_usuario_atual`, `fn_eh_admin`, `fn_setores_do_usuario`, `fn_pode_ver_expedicao`, `fn_tem_modulo`, `fn_eh_super_admin`) leem `plt_usuarios` a cada chamada; **43 de 66 políticas** chamam função de sessão sem `(select …)` (heurística por texto); **0** políticas para `public`; nenhum gancho de token no banco. A JWKS do Auth **já publica uma chave ES256** (assimétrica) — falta conferir no painel se ela é a que assina |
| 8 · advisors de desempenho | 33 · 9 · 2 · 18 | **33** chaves estrangeiras sem índice (as mesmas) · **9** políticas permissivas duplicadas (8 tabelas: etapas, horários, pausas, presenças, setores, vínculos, usuários ×2, visualizações) · **2** índices duplicados (`listas_disparo_membros`: `idx_membros_lista` = `idx_membros_lista_id`; `plt_cards`: `plt_cards_pedido_unico` = `plt_cards_pedido_uq`) · **29** sem uso (vários nasceram nas 30/31) |
| 9 · estatísticas | eventos 4 × 4.706; logs 106 × 7.185 | **eventos 160 × 7.744 · logs 642 × 10.975 · cards 4.551 × 6.018.** Achado: o contador do banco registra **~14,5 milhões de linhas inseridas** em cada uma dessas três tabelas (e 14,5 milhões de atualizações em `plt_cards`) — com 7–11 mil vivas e nenhuma apagada: gravações **desfeitas** (ensaios com volume ×100 no banco real, em transação desfeita, é a hipótese forte); ~1.760 limpezas automáticas em cada uma; o diário de mudanças (WAL) acumulou **43 GB** desde 24/07 num banco de 183 MB. O registro de uso não guarda esses ensaios (entradas avulsas são descartadas; `track = top`) |
| 10 · histórico do cron | 30 MB | **44 MB**, 132.870 linhas desde 28/08 (~2.700/dia), sem limpeza |
| 11 · portas por deslocamento | ~20 | **24** funções com deslocamento (`fn_dashboard_transition_clients`, `fn_filter_customers`, `plt_fn_auditoria`, `plt_fn_auditoria_conferencias`, `plt_fn_automacao_execucoes`, `plt_fn_automacoes`, `plt_fn_cards_pedido_pcp`, `plt_fn_chat_membros`, `plt_fn_danificados`, `plt_fn_dash_execucoes`, `plt_fn_estoque`, `plt_fn_estoque_configuracoes`, `plt_fn_estoque_produtos`, `plt_fn_expedicao_kanban`, `plt_fn_metas_painel`, `plt_fn_meu_tempo_tarefas`, `plt_fn_pedidos_aguardo`, `plt_fn_pedidos_cancelados`, `plt_fn_pedidos_kanban`, `plt_fn_produtos_reservados`, `plt_fn_programacao`, `plt_fn_programadas`, `plt_fn_rotas`, `plt_fn_tiny_reservas_presas`) — algumas justificadas (Top X, aguardo, ROTAS limitadas — D-120) |
| 12 · presença | 5 min por aba | `plt_presencas`: 4.399 gravações, 6 linhas (o intervalo no código: ver a varredura do front) |
| 17 · busca e Cancelados em Pedidos | 55 / 41 ms | **quente, numa conexão já usada:** todos 25–91 ms · busca "silva" 37–88 ms · número "136" 42 ms · Cancelados 49–100 ms. Por dentro: a página sai em 4–8 ms; quem pesa é a **contagem** (busca: varre `pedidos` 5.568 + `clientes` 10.800 com `ilike`, 67 ms; Cancelados: `fn_situacao_normalizada` por linha em `pedidos` inteira, 26 ms) — com ×100, segundos. **1ª chamada numa conexão nova: 1.721 ms** (a 2ª, 58 ms); no uso real a média é 951 ms |

- Webhooks de saída: 4 cadastrados, 4 ativos, **fila vazia** (0 entregas guardadas) — o despachante roda 1.440 vezes por dia (70.120 rodadas desde 28/08, 12 ms cada) quase sempre sem trabalho. Tempo real por broadcast: 465 avisos em 24 h (família `plt-aviso`), 2.169 guardados em 7 partições diárias.
- `statement_timeout`: `authenticated` 8 s, `anon` 3 s (por papel); nenhuma porta com o próprio. `jit = off`. Catálogo pequeno (`pg_attribute` 1,7 MB). Conexões do PostgREST no momento: 3.
- Registro de uso: zerado pela última vez em 17/08; 4.875 entradas de 5.000 (3 descartes). **Decisão técnica proposta:** não zerar — tirar uma foto agora e outra no fim; a diferença mostra só o período da sessão. **Foto do início tirada** (15/10 ~23:56 UTC, só leitura, pelo `.env.local` sem imprimir credencial — script no scratchpad, lógica do aplicador): 612 entradas (papéis `authenticated`/`anon`/`service_role` + tudo acima de 1 s somado) em `dados/SESSAO-32 - registro de uso (inicio, 2026-10-15).json`.

**Achado que muda a leitura de tempos:** os ensaios das sessões 30/31 mediram as portas no melhor momento — 5 a 40 ms —, mas o uso real varia muito: várias portas simples (marcar lida, lançar avulso, definir cobertura) têm média de 90–150 ms no registro real e a lista de Pedidos ~1 s. ~~Primeira hipótese: conexão fria~~ → **descartada no mesmo dia:** cada chamada da ferramenta já é uma conexão nova e às vezes sai em 58 ms; a variação aparece até numa conta pura de processador (ver "Fôlego da máquina" abaixo). Seguem a investigar: o fôlego da máquina do plano gratuito e a recarga do esquema do PostgREST a cada DDL (1.050 recargas desde 17/08, cada uma com `pg_timezone_names` de ~413 ms).

Prova da variação no registro real (papel `authenticated`, mínimo · média · máximo): quadro do setor 5 · 39,5 · 414 ms · conversas do chat 2,2 · 21,7 · 723 ms · registrar log 0,5 · 10,6 · 900 ms · quadro do PCP (cards) 2,3 · 56 · 648 ms · metas 2,7 · 26 · 386 ms · Pedidos 41 · 951 · 2.351 ms. O mínimo é o "quente" dos ensaios; a média e o máximo são o que a pessoa sente — o p95 de várias portas passa do teto de 50 ms por causa da variação, não da consulta.

**Fôlego da máquina do banco (plano gratuito, processador compartilhado):** a MESMA conta pura de processador (`count(*)` de 2 milhões em `generate_series`, sem tabela) deu **781 · 722 · 564 · 387 · 307 ms** em 5 rodadas seguidas, e 1.072 ms numa chamada isolada; a lista de Pedidos (busca "silva") deu 1.721 ms, 58 ms e 1.666 ms em três chamadas — cada chamada da ferramenta é uma conexão nova (`application_name = mgmt-api`, idade 0,1 s), então **não é "conexão fria"**: é a máquina variando de fôlego (hipótese forte: crédito de processador do plano gratuito, gasto pelo trabalho de fundo — 3 relógios por minuto, a leitura do WAL pelo `postgres_changes`, a presença, os ensaios). Cortar o trabalho de fundo (a própria lei) devolve fôlego; o teste de carga mede o teto.

**Front (varredura do código por agente de leitura, 15/10 — referências no próprio relato do agente):**
- **Relógios de dados: 23** (21 `refetchInterval` + 2 `setInterval`) — 07/10: 35. Casca 3 (bolinha `BolhaExecucao.tsx:45,51` 30 s ×2; presença `ProvedorSessao.tsx:83` 5 min, inclusive no /tablet, sem pausar com a aba escondida) · Meu Painel 4 (15 s) · Meus afazeres 3 (15 s) · Afazeres do time 1 (15 s, 2 requisições) · Visão do dia 7 (60 s) · Danificados 1 (30 s) · Configurações → Estoque 2 (30 s) · Configurações → API 1 (30 s) · Comercial → lista em disparo 1 (`setInterval` 8 s, 3 requisições em série). Padrão global: `staleTime` 30 s, `refetchOnWindowFocus` false, `refetchOnReconnect` true (reconectar relê tudo com mais de 30 s). Relógios só de interface (`useAgora` 60 s etc.) não vão à rede.
- **`postgres_changes`: 2** — `MeuPainel.tsx:249` e `VisaoDoDia.tsx:96`, `plt_cards` inteira, sem filtro nem espera: 5 e 7 releituras por mudança em qualquer card. Broadcast privado: um `supabase.channel` só (`chat/canais.ts`), tópicos `plt-chat-u`, `plt-chat-c`, `plt-card`, `plt-aviso:setor_{id}` e `plt-aviso:{estoque|aguardo|pcp|rotas}` (`lib/aoVivo.ts`).
- **Primeira abertura (logado, /inicio/meu-painel): 15 requisições HTTP de dados** (14 ao Supabase + `versao.json`; 13 leituras + 2 escritas — presença e log) + 1 websocket com 2 canais. **Cascata:** sessão → `plt_usuarios` → `plt_usuario_setores` em série (`ProvedorSessao.tsx:16-35` — 3 viagens antes de qualquer tela); depois 10 em paralelo; chat e sino só depois do canal assinado. **Duplicadas:** `minhasTarefas` (bolinha × Meu Painel) e a própria linha de `plt_usuarios` (perfil × `fila_prioridade`).
- **Por tela (ao abrir):** Meu Painel 5 · Meus afazeres 2–4 (cascatas) · Afazeres do time 4 · Visão do dia 8 · Meu desempenho 3 · Tempo por setor 4 · Pessoas 4 · Qualidade 4 · Expedição 1 · Danificados 1 · Configurações → Estoque 3 · Configurações → API 3 · Automações 5 · Auditoria 2 · Equipe 2 (todos os usuários e vínculos, sem paginar) · Comercial: Painel de recompra 7 (com "todos os disparados") · **Dashboard até 28** (`useTopClientsData.ts` — N+1 de até 20) · Listas 2 (em série) · Lista 4 (em série) · Estoque Top X 3–4 · Insumos 2 · Configurações do estoque 3 · PCP 4–6 · Pedidos 1 · Pedidos em aguardo 2 · ROTAS Entregas 1 · Programação 2 + lote de geocodificação · Já programadas 2 + N. Toda troca de tela soma +1 log de navegação e quase sempre +1 setores (`staleTime` 30 s).
- **"Quem sou eu":** `getUser` 0 · `getClaims` 0 · `getSession` 1 por carga; perfil + vínculos 1 vez por carga (e de novo ao reconectar, se > 30 s); trocar o tema relê o perfil e grava outro log.
- **Pacote:** `React.lazy` só em Programação, Entregas do dia e Pedidos (+ aninhados: Lançamento manual, janela e conversa do card, mini mapa). **Imediatos ~35 telas** — inclusive todo o Comercial (com `react-hot-toast` e `date-fns/locale`), os painéis com Recharts, o canvas das automações (código próprio) e o `papaparse` inteiro. Leaflet já é sob demanda. `vite.config.ts` sem bloco `build` (sem teto). `@tanstack/react-virtual` instalado e não usado.
- **Deslocamento no front:** 20 portas `plt_*` + 2 do Comercial (`fn_filter_customers`, `fn_dashboard_transition_clients`) + 2 por `range` (Avisos, seletor de pessoas). Já por cursor: Pedidos, chat (conversas e mensagens), conversa do card, coluna do quadro, avulsos, devoluções, personalizadas.
- **Problemas de passagem:** chave `['metas','painel',p]` com dois limites (20 no Meu Painel, 10 em Pessoas — uma tela pode mostrar o cache da outra); a bolinha consulta a cada 30 s mesmo sem nada em execução; o Comercial usa `useEffect` cru sem cache.

**Projetos na conta da Supabase:** além do "Fabrica", existe **"Sistema Domoby - Staging"** (criado em 24/09, **parado**, Postgres 17.6), sem nenhuma menção no cofre nem no repositório — candidato a cópia para os ensaios ×100 e para a carga (religar um projeto gratuito não custa), se o dono confirmar que é dele e que pode ser usado.

**Pacote** (`npm run build`, 15/10): o primeiro carregamento baixa 9 pedaços — principal `index` 1.468,7 kB / 394,8 kB gz · `supabase` 382,6 / 109,8 · `lib` 36,2 / 13,1 · `jsx-runtime` 12,0 / 4,3 · `api` 7,3 / 2,2 · `consultas` 7,2 / 2,6 · `aoVivo` 2,1 / 1,2 · `canais` 1,1 / 0,6 · `sessao-contexto` 0,2 / 0,2 = **1.917,5 kB / 528,6 kB gz** (teto: 250 kB gz → 2,1× acima); CSS 107,7 / 18,9 gz; fontes: Inter com 7 subconjuntos (latin, latin-ext, cirílico, grego, vietnamita…) e Poppins 500/600/700 em woff2 e woff. Pedaços próprios: `rotaRuas` (mapa) 156,7 / 46,5 · `Programacao` 51,4 / 16,0 · `PaginaPedidos` 41,6 / 11,3 · `JanelaDoCard` 23,4 / 7,4 · `AbaLancamentoManual` 14,9 / 4,8 · `EntregasDoDia` 14,5 / 4,2 · `ConversaDoCard` 12,5 / 4,5 · `MiniMapaEntregas` 1,5 / 0,8.

**Cache do site (lei §8):** o site publicado manda os arquivos com nome de impressão digital (`/assets/*`) com `Cache-Control: public, max-age=0, must-revalidate` — o mesmo do `index.html`: a cada abertura o navegador **pergunta de novo por cada pedaço** (9 de JS + CSS + fontes), mesmo já tendo. O `vercel.json` só tem a reescrita para o `index.html`. Conserto barato: cabeçalho `immutable` de 1 ano para `/assets/*` (entra na frente do pacote).

**Edge Functions:** 11 publicadas; com `verify_jwt` ligado: `autenticacao`, `geocodificar`, `calcular-rota`, `enviar-proximo-disparo`, `processar-timers-disparo`, `verificar-vendas-disparo`, `disparar-membro-individual`, `tiny-auth-refresh`; desligado (autenticação própria): `api`, `webhook-datacrazy-resposta`, `fotos-tiny`. ⚠️ Para a troca da chave do login: a verificação embutida (`verify_jwt`) só conhece a chave ANTIGA — as funções chamadas com o token da pessoa precisam verificar por dentro (chave pública) ANTES da troca; e a chave antiga **não pode ser revogada** (as chaves antigas `anon`/`service_role` assinadas com ela são usadas pelo n8n, pelos crons e pelas funções).

**ClickUp (regra 19):** acesso OK; as 8 tarefas da demanda em **a fazer** (nenhuma movida ainda — cada uma vai para FAZENDO quando a frente dela começar).

## Levado ao dono (15/10, fim do retrato) — aguardando o OK

**Perguntas do §3** (o prompt do dono pediu "as 3 perguntas"; o §3 tem 5 — levadas as 3 que só ele decide, com recomendação, e as outras 2 já com a escolha feita, para ele dizer só se discorda):
1. Tempo logado parado — proposta da demanda: 12 h nos tablets, 8 h no escritório. No plano gratuito a Supabase não tem o ajuste (só no pago — conferido na documentação: "Limiting session lifetime… only available on Pro Plans and up"); proposta técnica: o gancho do token recusa a renovação de quem passou do tempo parado (vale no servidor, sem relógio).
2. Medição de velocidade nos aparelhos — recomendação: a própria plataforma mede (sem custo nem cota); alternativa: a da Vercel (pode ter cobrança/limite conforme o plano).
3. Teste de carga — recomendação: a carga pesada (×10) numa cópia (o projeto "Sistema Domoby - Staging", parado, se for do dono e puder ser usado) e, no banco real, só um teste leve numa janela combinada. Os ensaios ×100 também passam para a cópia (as 14,5 milhões de linhas desfeitas).
4. (escolha feita) Painel da Supabase: o dono clica, o Claude guia — na frente do login.
5. (escolha feita) Índices repetidos/sem uso: a lista exata vai ao dono na frente do banco; os 2 repetidos e os sem uso antigos saem com o OK; os recém-nascidos ficam em observação.
- E o pedido do §1.6 (Pedidos): índice parcial + trigramas nas tabelas da integração — antes/depois e OK do dono **antes de aplicar** (pedido explícito dele).

**Achados levados:** o fôlego variável da máquina (plano gratuito), os ensaios ×100 no banco real como causa provável das estatísticas, o teto de 200 conexões ao vivo do plano gratuito (×10 = 400 não cabe — documentação: Free 200, Pro 500), a chave ES256 já publicada, o projeto "Staging" parado.

## Task list (espelho da demanda) — ordem proposta (§6 da demanda), uma frente por vez, publicada e conferida com o dono antes da próxima

**Frente A — banco (§1.6) · ClickUp "Banco: índices, políticas de acesso e estatísticas"**
- [ ] A1 · A variação de tempo no uso real: medir o fôlego da máquina ao longo do dia (conta pura de processador × hora × trabalho de fundo), a recarga do esquema do PostgREST a cada DDL, e cortar primeiro o trabalho de fundo que é nosso (as escutas da tabela de cards inteira, os relógios por minuto, a presença) — o teste de carga mede o teto do plano
- [ ] A2 · Estatísticas: provar por que o planejador erra (gravações desfeitas em massa × limpeza automática), `ANALYZE`, e impedir que volte (ensaios ×100 fora do banco real; ajuste de limpeza/estatística por tabela se preciso)
- [ ] A3 · Índice nas 33 chaves estrangeiras (`create index concurrently`, fora de transação, `lock_timeout`)
- [ ] A4 · As 9 políticas permissivas duplicadas unidas (uma por ação e papel); `(select …)` em todas as que chamam função de sessão (43); `TO authenticated` conferido (hoje 0 para `public`)
- [ ] A5 · Índices: os 2 duplicados e os sem uso antigos — lista ao dono, só com o OK (regra 3)
- [ ] A6 · Histórico do cron com retenção (limpeza do que passou de N dias) e plano de crescimento das tabelas que só aumentam (índice por data; partição quando passar de milhões; retenção do ruído)
- [ ] A7 · `statement_timeout` próprio nas portas de tela
- [ ] A8 · Dívida 17 — Pedidos: índice parcial dos cancelados (situação normalizada) + trigramas para a busca por nome em `pedidos`/`clientes` (tabelas da integração — **confirmar com o dono antes de aplicar**); a contagem sem varrer tudo; EXPLAIN antes/depois com ×100; harness provando o mesmo resultado
- [ ] A9 · Cabeçalho de cache `immutable` para `/assets/*` (barato; pode ir com a frente do pacote)

**Frente B — login (§1.2) · ClickUp "Permissões no token, sem consultar o banco"**
- [ ] B1 · Com o dono no painel: conferir/girar a chave ES256 para "atual" (a antiga fica como "usada antes" — nunca revogar: n8n, crons e funções usam as chaves antigas)
- [ ] B2 · Gancho do token (Custom Access Token Hook) em função do banco: id da plataforma, papel, super admin, setores, módulos, ativo — nada pessoal (D-68); recusa quem está inativo
- [ ] B3 · Funções de sessão e políticas lendo do token, embrulhadas em `(select …)`; nenhuma consulta a `plt_usuarios` para saber papel/setor numa leitura comum
- [ ] B4 · Front: `getClaims()` no lugar de `getUser()`/"quem sou eu"; Edge Functions chamadas pelo navegador verificando localmente (antes da troca da chave)
- [ ] B5 · Mudou papel/setor/ativo → renovação forçada; tempo de inatividade (pergunta 2 — no plano gratuito, pela própria plataforma, sem relógio)

**Frente C — abertura (§1.1) · ClickUp "Primeira abertura em uma requisição"**
- [ ] C1 · Porta de abertura: perfil, setores/vínculos, permissões, menu, sino, chat, bolinha, Meu Painel — 1 requisição, sem cascata
- [ ] C2 · Cada tela restante com 1 requisição (Meu Painel, Afazeres, Afazeres do time, Visão do dia e os painéis, Expedição, Danificados, Painel admin do estoque, Automações, Auditoria, Equipe, Comercial; Estoque e PCP — dívida 15); o resto no clique

**Frente D — ao vivo (§1.3) · ClickUp "Tempo real por websocket no lugar das atualizações automáticas"**
- [ ] D1 · Sai todo relógio que sobrou e os `postgres_changes` que sobraram; `plt_cards` fora da publicação do Realtime
- [ ] D2 · Tópicos privados e estreitos; recuperação ao reconectar; "ao vivo pausado" + "atualizar"
- [ ] D3 · Presença pela Presence do Realtime (ou carimbo no gesto) — fim da gravação periódica

**Frente E — pacote (§1.4) · ClickUp "Pacote dividido por tela"**
- [ ] E1 · `React.lazy` em todas as rotas; Recharts, Leaflet, canvas das automações, Comercial e leitor de planilha só no pedaço que usa; fontes só no subconjunto latino
- [ ] E2 · Teto no build (JS inicial ≤ 250 KB gz — falha acima); pré-carregar o pedaço na intenção (passar o mouse)
- [ ] E3 · Medição real nos aparelhos (pergunta 4)

**Frente F — portas lentas (§1.5) · ClickUp "Telas lentas do comercial e gravação do pedido do Tiny"**
- [ ] F1 · Comercial: projeções/resumos prontos e índices — telas ≤ 50 ms, painéis ≤ 150 ms com ×100; harness provando o mesmo resultado
- [ ] F2 · `fn_upsert_pedido`: enxugar o caminho quente sem regredir a guarda dos gatilhos de `pedidos` nem a impressão digital da integração
- [ ] F3 · Dívidas 13 (estoque × catálogo) e 16 (quadro do PCP)

**Frente G — rotinas (§1.7) · ClickUp "Rotinas do banco por evento, sem relógio"**
- [ ] G1 · Reservas do estoque, despacho de webhooks, disparo do comercial e fotos nascendo do fato (gatilho → fila → chamada); relógio só de calendário
- [ ] G2 · Fila com nova tentativa, espera crescente com sorteio, lugar para o que falhou; chamada externa com tempo limite e disjuntor

**Frente H — listas (§1.8) · ClickUp "Listas por cursor"**
- [ ] H1 · As 24 portas por deslocamento: cursor nas que crescem sem fim (índice composto); deslocamento justificado nas limitadas; teto de página no banco

**Frente I — carga (§1.9) — vai junto do fechamento da tarefa das listas**
- [ ] I1 · 30 tablets + 10 escritórios, folga ×10, nas telas mais usadas (quadros, PCP, Meu Painel, chat) — p95 e erros no handoff (pergunta 5)

**Fechamento**
- [ ] Checklist final da demanda §6 item a item · lei §14 atualizada · handoff + mapa + próximos passos + ordem das sessões · foto do registro de uso do fim × a do início
