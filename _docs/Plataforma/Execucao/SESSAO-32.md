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

## Respostas do dono (15/10, ~21:05 de Natal) → D-137

1 *"Pode ser"* (12 h tablets / 8 h escritório) · 2 *"Pode ser a própria plataforma mesmo"* (medição de velocidade pela plataforma) · 3 *"Pode rodar o teste de carga em produção mesmo, não tem ninguém usando agora à noite, então faça, analise apenas os horários das automações"*. Em seguida: *"Vou sair agora, abre logo o navegador aqui pra que eu possa logar pra você e você testa tudo e me entrega apenas o resultado final após finalizar"* → o navegador do app abriu já logado com a conta dele (Meu Painel); avisado o modo noturno (cada frente testada inteira é aplicada e publicada; o reservado a ele fica pronto e esperando) → *"Vá lá"*.

## Os horários das automações (antes da carga) — e o incidente achado

- **Banco (pg_cron):** os 12 jobs do retrato; de calendário perto da janela: `tiny-auth-refresh-cron` às 00/03/06… UTC (a carga fica longe das 03:00 UTC).
- **n8n (API, só leitura — script `n8n-horarios.mjs` no scratchpad, chave nunca impressa):** 5 fluxos ativos — vendas (aviso), ClickUp ROTAS → Tiny (aviso), "subir banco de dados" (aviso), "Formulário → cadastro de cliente" (planilha; erros antigos sem data), **"Tiny FÁBRICA → produtos e estoque"** (a cada 15 min + 03:15 + avisos) — **todas as últimas execuções com ERRO**.
- **O incidente:** o passo "Supabase · aplicar leitura" (`plt_fn_tiny_estoque_leitura`) estourava o tempo limite (8 s) a cada 4–7 min desde pelo menos 23:28 UTC. Causa provada: dois insumos cadastrados no Tiny como "simples" (S) com saldo enorme — **FITA DE BORDA BRANCO TX 19MM 22.878,58 M** e **Suporte triangular fixa fundo - Oppeano 3.660 UN** (o n8n mostrou o saldo que mandou) — e a regra D-76 "Tiny acima → sobe" criava **uma peça por unidade** (`fn_estoque_criar_pecas` em laço: card + evento + registro por unidade) → >8 s → desfeito; e a reserva da fila (`plt_fn_tiny_estoque_proximos`) **não conta tentativa** → o item voltava a cada 10 min, sem fim (tentativas = 0, a fita na versão 30). **É a causa dos ~14,5 milhões de linhas desfeitas** em cards/eventos/registros (números quase iguais nas três tabelas: card + evento + registro por unidade), das estatísticas erradas, do WAL de 43 GB e de boa parte do processador gasto. Os outros 24 da fila estavam parados por "Produto não localizado" (apagados no Tiny — inofensivos).
- **Estancado em 16/10 ~00:13 UTC:** `supabase/manutencao/2026-10-16_parar_fila_tiny_saldos_gigantes.sql` — o mesmo caminho de 5 falhas (`fn_tiny_estoque_falhou` ×5): os dois PARADOS com o motivo em língua de gente (aparecem em Configurações → Tiny), linha `estoque_tiny_falha` na trilha. Desfazer: limpar `parado_em`/`tentativas` da linha. Conferido: `tentativas` 5, `parado` sim, `reservado_em` nulo nos dois; 26/26 da fila parados → o relógio do banco parou de chamar o n8n.
- **A correção (migration 76 — `20261016010000_plt_estoque_tiny_teto_e_tentativa.sql`):** teto de 500 peças por leitura/ponto de partida (o mesmo da entrada manual) → acima disso o produto para com o motivo e a leitura fica registrada; a reserva que vence (10 min) sem resposta conta como falha (5 = parado). Leitura recriada POR INTEIRO a partir da versão da migration 57 (E-24); proximos a partir da 42; grants iguais (só a chave de serviço). Bloco 76 no harness (saldo 22.878,58 m para sem peça; 3 sobe como sempre; ponto de partida com 3.660 para; 5 reservas vencidas = parado; maquinaria fora da API).
- **Pergunta de produto que fica para o dono (resultado final):** os insumos cadastrados como "simples" no Tiny (fita, parafusos, cola, suporte…) devem sair da conta de peças (ficar só com o número do Tiny, como os insumos)? O teto é a defesa técnica; a classificação é decisão dele.

## Teste de carga (16/10, ~00:19–00:28 UTC = 21:19–21:28 de Natal) — `scratchpad/carga.mjs`

- **Como:** no banco de produção, SÓ LEITURA (`BEGIN READ ONLY`), como `authenticated` com a identidade de pessoas reais (claims — 6 identidades; nenhum dado gravado; presença e log de navegação de fora), pelo pooler em modo transação (o papel do conjunto de conexões do PostgREST), tempo do servidor medido por `clock_timestamp()` dentro da transação; o roteiro de HOJE: tablets (perfil → vínculos em série + quadro; relê quando muda card do setor), Meu Painel (casca + 5; relógios 15 s/30 s; relê 5 a CADA card — a escuta da tabela inteira), Visão do dia (7; 60 s; relê 7 a cada card), PCP (página → pedidos em série), Chat (lista → mensagens). Um card muda de lugar a cada 10 s. Vigia: aborta a rodada com > 25% de erro ou p95 do servidor > 7,5 s em 20 s.
- **Ensaio (7 pessoas, 15 s):** 68 consultas, 0 erro; já apareceram `plt_fn_pedidos_kanban` 682 ms, `plt_fn_cards_pedido_pcp` 352 ms, `plt_vw_execucoes` da bolinha 139–225 ms.
- **Rodada de 40 pessoas (30 tablets + 10 escritório), ANTES das correções: ABORTADA pelo vigia aos 123 s** — 654 requisições (5,3/s), 40 erros (6%: tempo limite de 8 s no quadro ×15, execuções ×13, painéis, metas); servidor p50 6 ms · **p95 3.785 ms** · p99 6.650 ms; na parede p95 **18,6 s**. A linha do tempo: a abertura (0–45 s) saiu bem (p95 6–445 ms); o banco foi afogando no regime, a cada card que mudava (as releituras do Meu Painel e da Visão do dia) — p95 1,4 s → 2,5 s → 5,9 s → 7,4 s.
- **Rodada de 400 pessoas (10×), ANTES das correções:** 274 s, 13.269 requisições (48/s), 314 erros (2,4% — 307 deles na fila de conexão do próprio gerador, "timeout exceeded when trying to connect", nos painéis da Visão do dia; 7 no banco); servidor p50 19 ms · **p95 2.013 ms** · p99 2.426 ms; na parede p95 **18,9 s** (esperando conexão). Os mais pesados: `plt_vw_execucoes` da bolinha (1.542 chamadas, p50 **1.914 ms**), a página do PCP (p50 1.692 ms), os pedidos da página (p95 1.370 ms), o quadro (p95 359 ms, p99 2,8 s).
- **Correções do meio da noite:** migration 76 aplicada (00:30 UTC) + `ANALYZE` do banco inteiro → o planejador passou a saber o tamanho real (eventos 7.744, registros 10.978, cards 6.018, `eventos` 18.383).
- **Rodada de 40 pessoas DEPOIS (00:33 UTC):** 212 s, 1.265 requisições (6/s), **0 erro**; servidor p50 9 ms · **p95 384 ms** · p99 674 ms; na parede p95 **1,1 s**. Seguem acima do teto: execuções da bolinha (p50 234 · p95 668 ms), página do PCP (~600–700 ms), pedidos da página (~400 ms), quadro (p50 47 · p95 311 ms), painéis da Visão do dia (p95 56–210 ms).
- Arquivos (scratchpad): `carga-completo.json/.log`, `carga-fase1-pos-analyze.json/.log`, `carga-analise.mjs`; fotos do registro de uso antes da carga em `registro-antes-da-carga.json`.

## Frente do banco — migration 77 (16/10, ~00:38 UTC)

- **O que entrou:** 29 índices de chave estrangeira (as 4 das cópias do Tiny ficam para o OK do dono); `fn_setores_que_lidero()` e `fn_chat_minhas_conversas()`; as regras de acesso de `public` reescritas (embrulho `(select …)`, `= any (array(select …))`, as 9 duplicadas desfeitas), storage e realtime embrulhados; job `plt-cron-historico-limpar` (04:20 UTC, guarda 7 dias).
- **Prova do mesmo resultado:** `scratchpad/visibilidade.mjs` — para as 6 pessoas ativas × as 32 tabelas com regra: contagem + md5 das chaves visíveis, como `authenticated` em transação só leitura. Antes (fresca, logo antes de aplicar) = depois: **idêntico**. Bateria do banco: 985 verdes com a 77 (as provas de RLS das sessões 03/12/23/26 seguem verdes). A parte do armário de arquivos não roda no PGlite (sem storage) — conferida no banco real (a aplicação é atômica; passou).
- **Aplicação:** `banco:aplicar -- --confirmar --so 20261016020000_plt_banco_indices_politicas.sql` → integração idêntica (estrutura e linhas); 64 políticas em `public`.
- **Advisors depois:** desempenho — chaves sem índice **33 → 4** (contas a receber ×2, notas fiscais ×2), permissivas duplicadas **9 → 0**, índices duplicados 2 (esperam o OK), "sem uso" 58 (29 nasceram agora); segurança — nenhum item que cite as funções novas (os 173 "definer executável" são as portas de sempre).
- **Fica para o OK do dono (pacote "índices"):** os 4 índices de chave estrangeira das cópias do Tiny; os 2 índices repetidos (`listas_disparo_membros`: `idx_membros_lista` = `idx_membros_lista_id`; `plt_cards`: `plt_cards_pedido_unico` = `plt_cards_pedido_uq`); os sem uso antigos; os índices da área Pedidos (cancelados + trigramas em `pedidos`/`clientes`).

## Frentes C e D — abertura numa chamada e telas ao vivo (migration 78 + site, 16/10 ~01:00–01:30 UTC)

- **Banco (migration 78 — `20261016030000_plt_abertura_e_ao_vivo.sql`):** `plt_fn_abertura(rota, meu_painel)` (invoker; perfil, vínculos, setores, 20 avisos, 1ª página do chat, tarefas, bolinha e — na 1ª tela Meu Painel — cards delegados, tarefas do Sistema, fila de prioridade e metas; registra a navegação da 1ª rota, que carimba a presença); `plt_fn_minhas_execucoes()` (a bolinha pela posição do card — mesmo conjunto de `plt_vw_execucoes`); `plt_fn_dash_visao_do_dia()` (as 7 portas numa chamada + o instante da leitura); avisos novos (`painel`, `danificados`, `meu_trabalho` no canal da pessoa, `tarefas` no tópico do setor, `tiny` na fila do estoque, `lista_<id>` do Comercial); presença pelo gesto (navegação e fatos); `plt_cards` fora da publicação do Realtime. Harness: blocos 76 e 78.
- **Site:** a abertura no lugar das 2 leituras do perfil + ~13 das telas (cada pedaço semeado no cache com a chave da tela); caminho de reserva (as 2 leituras de antes) se a porta falhar; cache limpo ao sair (tablet compartilhado); saíram TODOS os relógios de releitura (bolinha 30 s, Meu Painel 15/30 s e a escuta da tabela de cards, Visão do dia 60 s, Afazeres, Afazeres do time, Danificados, Configurações do estoque, Painel da API, lista do Comercial 8 s, presença 5 min, conferida da versão na abertura); "ao vivo pausado" + "Atualizar" quando um canal cai; a espera da Visão do dia cresce na tela sem reler.
- **Achado na conferência do banco real (E-103):** aplicada a 78, a conferência pessoa por pessoa como `authenticated` (`scratchpad/conferir-78.mjs`, transação desfeita) deu "permission denied" para as 6 — a releitura do perfil sem rota chamava um ajudante fechado ao papel; o harness (que chama como dono) passou verde. Corrigido antes de o site subir (ajudante saiu; 78 reaplicada); o harness agora chama as portas novas como o navegador (papel `authenticated` + permissões padrão do Supabase imitadas). Depois: **6/6 sem erro, abertura p50 11 ms (máx. 51), sem o Meu Painel 6–7 ms, Visão do dia p50 27 ms (máx. 58), resposta ~10 KB, bolinha idêntica à visão antiga (2 pessoas com execução aberta)**.
- **No site (aba do dono, logada):** 1ª versão — abertura = 1 requisição, mas as metas eram relidas ~2 s depois (a tela ao vivo conferia o guardado de antes de abrir). Correção publicada: guardado recente + canal entrando → o canal pede a REPRISE dos avisos desde a leitura (hora do banco acertada pela abertura; reprise limitada a 25, o máximo da documentação) e só relê se algo mudou (5 testes novos). Depois: **abertura = 1 requisição de dados, nada mais** (sem conferida de versão, sem "ao vivo pausado"). Ponta a ponta: aviso `meu_trabalho` mandado do banco → a tela releu só as 3 consultas da pessoa em ~0,5 s; aviso `painel` → as metas releram em ~2 s.
- Commits: `7a5bae6` (site + 78), `9801501` (correção da 78), `20ecdbb` (reprise). Publicados na `main` → Vercel `success`. Aplicação: `banco:aplicar -- --confirmar --so 20261016030000_plt_abertura_e_ao_vivo.sql` (duas vezes — a 2ª com a correção), integração idêntica.

## Levantamento tela × requisições no site (16/10 ~01:35 UTC, aba do dono, navegação dentro do app)

Cada troca de tela grava também 1 registro de navegação (a trilha — D-40); os números abaixo são as leituras de DADOS da tela (sem as fotos):
- **0** (vêm do cache semeado pela abertura ou ao vivo): Meu Painel, Meus afazeres, Afazeres do time, Chat, Meu perfil, Danificados, Utilitários.
- **1**: Avisos, Visão do dia (+1 das visualizações salvas — ver), Todos os pedidos, Cancelados (uma leitura de **2,5 s** — a busca/lista que espera o índice do dono), Expedição, Entregas, Setores e etapas, Auditoria.
- **2**: Pedidos em aguardo, Programação, Gestão da equipe, Caminhões.
- **3**: Pessoas, Qualidade, Tempo por setor, Meu desempenho, Estoque, PCP, Config. do estoque, API e integrações, Controle de tempo, Automações.
- **19**: Dashboard do Comercial (a porta de vendas do cliente chamada 11 vezes, uma por cliente da tabela — leitura em cascata).
- Console sem erro nas 35 telas.

## Frente E — pacote dividido por tela (16/10 ~01:45–02:05 UTC)

- **As 34 telas viraram pedaços próprios** (`React.lazy`, um `Suspense` em volta das rotas — a casca fica); no pacote inicial: casca (menu, sino, chat, bolinha) + login. **JS inicial: ~505 KB → 218 KB comprimidos (14 arquivos)**.
- **Teto no build** (`vite.config.ts`, plugin `teto-do-pacote-inicial`): soma a entrada + o que ela importa direto (gzip) e **falha a montagem acima de 250 KB**.
- **Pré-carregamento na intenção** (`src/navegacao/pedacos.ts`): mouse/foco/dedo no item do menu baixa o pedaço; o pedaço da 1ª tela começa a baixar junto com a casca (`main.tsx`).
- **`vite:preloadError`** → recarrega a página uma vez (10 s de guarda): pedaço que sumiu depois de uma atualização.
- **Vercel:** `/assets/*` com `Cache-Control: public, max-age=31536000, immutable` (antes `max-age=0, must-revalidate` — cada abertura revalidava cada arquivo); a regra de SPA não pega mais `/assets/` (arquivo inexistente dá 404 em vez do `index.html`).
- **No site:** 1ª abertura (cache vazio) — 1 requisição de dados, 14 + 5 arquivos de JS, DCL 0,83 s, **LCP 1,9 s**; 2ª abertura — JS todo do cache (1 KB pela rede), DCL 0,11 s, **LCP 0,8 s**. As 32 telas percorridas carregaram o próprio pedaço e mostraram conteúdo; console sem erro. Commit `2d36b8f`.

## Tempo parado — 12 h tablet / 8 h escritório (D-137 item 1; 16/10 ~02:10 UTC)

- `src/autenticacao/inatividade.ts` + `ProvedorSessao`: o último gesto (toque/tecla) fica no aparelho (no máximo 1 gravação/min); a conta é feita **ao abrir, a cada gesto e ao voltar à aba** — sem relógio. "Tablet" = último gesto no modo tablet. Passou → `plt_fn_registrar_log('saiu', …, {motivo: 'ficou parado mais de N h'})` + signOut; ao sair o registro some (a próxima entrada começa do zero). 6 testes. No site: sessão do dono seguiu normal; registro gravado. Não testado o "derrubar" no site (derrubaria a sessão do dono — não posso entrar com a senha dele). Commit `e12e95b`.

## Medição de velocidade pela própria plataforma (D-137 item 2; migration 79; 16/10 ~02:20 UTC)

- **Banco (79 — `20261016040000_plt_medicao_web.sql`):** `plt_medicoes_web` (uma linha por abertura: LCP/INP/CLS/FCP/TTFB, aparelho, modo tablet, versão, conexão; índices por data e pessoa; RLS: só o super admin lê; sem insert direto) + `plt_fn_medir_tela(...)` (definer, em nome de quem está logado; a mesma abertura é completada, a de outra pessoa nunca) + `plt_fn_medicoes_web_resumo(dias)` (p75 por aparelho). Bloco 79 no harness (como o navegador chama). Conferido no banco real: 6/6 sem erro, só o dono enxerga, nada ficou gravado (transação desfeita).
- **Site (`src/lib/medicao.ts`):** `PerformanceObserver` (LCP até o 1º toque, FCP, TTFB, CLS por janelas de 1 s/5 s, INP = o toque mais lento ignorando 1 a cada 50); manda ao sair da aba / fechar (`fetch keepalive`), e na troca de tela se a última medida tem mais de 5 min (tablet que nunca sai da tela). Nunca junto da abertura. Commit `71eaac7`.

## Mais leituras a menos (16/10 ~02:00–02:50 UTC)

- **Comercial — painel sem cascata (commit `01ecba6`):** as vendas dos 20 maiores clientes (top produtos) iam numa leitura POR cliente; a porta `fn_vendas_cliente` aceita a lista de telefones → 1 leitura (+1 por cliente sem telefone). Provado no banco real como o dono (`conferir-comercial-lote.mjs`): 19 clientes com telefone, 73 vendas, **nenhuma diferença**. O painel: ~29 → ~10 leituras (as 8 dos gráficos seguem — dívida).
- **Abertura com os catálogos (migration 80, `dd58ac1`):** etiquetas e campos customizados vêm na abertura (mesmo recorte e ordem — harness: admin/operador/logística). Abrir direto num quadro: 4 → 2 leituras. Conferido no banco real: 6/6 sem erro; abertura p50 ~10 ms (uma leitura fria de 281 ms logo depois da troca da função).
- **A primeira chamada lenta da lista de Pedidos (2,6 s) não é a consulta:** numa conexão nova a mesma lista sai em 36 ms; o `pg_stat_statements` mostra **0 bloco lido do disco** e o JIT está desligado. O banco é a menor máquina do plano gratuito (`shared_buffers` 224 MB, `effective_cache_size` 384 MB, `max_connections` 60 — 0,5 GB, processador compartilhado): os picos de segundos aparecem até com o banco parado. **Recomendação para o dono:** a máquina paga da Supabase (custo) — vai no relatório. O trabalho de fundo medido (2 fotos do registro de uso, 1,7 min): ~0,35% de um núcleo (relógio do estoque ~95 ms/min, webhooks ~28 ms/min, fotos ~250 ms/5 min).
- **Listas que só crescem por cursor (migration 81, `e9af538`):** a trilha da Auditoria e o histórico de cada automação contavam a lista inteira a cada página (`count(*) over ()`) e paginavam por deslocamento → cursor + `tem_mais` + total só na 1ª página (até 10.001, "10.000+") + próxima página ao rolar. As portas antigas saíram (drop). Harness: percorrer todas as páginas pelo cursor = a lista inteira, na ordem (39 navegações em 6 páginas; execuções de 1 em 1). No site: Auditoria "3.037 registros", 30 → 60 linhas ao rolar, sem erro. As outras 22 portas por deslocamento são de listas limitadas (o que está vivo, catálogos) — deslocamento justificado; todas têm teto no banco (100/200), menos `plt_fn_meu_tempo_tarefas` (limitada pelo período) e as duas do Comercial (o teto global da API é 1.000 linhas).
- **O quadro do PCP numa leitura (migration 82, `6a2bdb5`):** `plt_fn_pcp_quadro` = a mesma página de `plt_fn_cards_pedido_pcp` + etiquetas + o resumo de `plt_fn_pedidos_kanban` (uma chamada para os pedidos da página); a porta antiga fica para a Visão do dia. Provado igual linha a linha no harness (44 linhas, 33 com pedido) e **no banco real para as 6 pessoas (0 diferença)**. No site: abrir direto no PCP = abertura + quadro (**6 → 2 leituras**), pedidos e clientes aparecendo.
- **Visualizações salvas dos painéis** lidas uma vez por abertura (só mudam pelo gesto da própria pessoa, que invalida).

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
