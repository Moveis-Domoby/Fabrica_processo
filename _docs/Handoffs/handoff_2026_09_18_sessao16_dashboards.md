---
titulo: Handoff — SESSAO-16 · Dashboards de Verdade
tipo: handoff
data: 2026-09-18
atualizado: 2026-09-18
tags: [handoff, sessao, plataforma, dashboards, d-42]
---

# 📋 Handoff — SESSAO-16 · Dashboards de Verdade (D-42)

**Branch:** `sessao-16-dashboards-de-verdade` — **aguardando sua revisão nesta conversa para o merge** (D-20)
**Banco:** migration **28** (`20260917120000_plt_dashboards_verdade.sql`) **aplicada em 18/09 com seu OK na conversa**, pela API (caminho da S15/S19/S20 — A-15). Impressão digital da integração antes = depois (`15152f89…`, 114 colunas). Advisors: só os **+8 WARN esperados** (endpoints de propósito).
**Demanda:** [[SESSAO-16 - Dashboards de Verdade]] · **Memória:** [[SESSAO-16|Execucao/SESSAO-16]]
**Decisões que regem:** **D-42** (mockups são a régua) · D-32 (tempo em 1º; só líder/admin) · D-02 (fila × execução) · D-29 (tempo útil) · D-27 · D-36 · D-40 · D-47

## 1. O que foi feito

- **As 4 telas-filhas do pai Dashboards** (Q-66: continuam em `/dashboards/...`), nos moldes dos mockups de `_docs/Plataforma/Inspiracao/dashboards/`:
  - **Visão do dia** (`/dashboards/visao-do-dia`) — o andon: 4 números-herói (concluídas com "vs média das últimas 4 [dia da semana]", em execução, na fila com a espera mais antiga, 🔴 danificados nomeados por origem→destino), tile do PCP (a liberar / liberadas hoje), tiles dos 6 setores de produção com o **gargalo gritando** (borda âmbar + badge quando a espera destoa ≥2× da mediana), produção por hora com a linha de média tracejada, e o fim de linha (ROTAS/Estoque/Danificado + aguardando lançamento + retrato do estoque). **Atualiza sozinha**: Realtime em `plt_cards` + polling de 60 s; "atualizado às HH:MM" no topo. Fonte por **container query** (`.num-heroi`/`.num-tile`) — pronta para a TV do galpão.
  - **Tempo por setor** — empilhado horizontal **fila (azul) × execução (âmbar)** somadas no período (D-02), ordenado do pior para o melhor, total na ponta da barra e sublinha "Xh fila · Ymin execução · N finalizadas"; herói **"A fila é X%"**; callout do gargalo (maior fila média por unidade vs mediana); **tendência de 6 semanas** do tempo total por unidade concluída (só p/ quem mede a fábrica toda); tabela de **tempo por item** (sua decisão de 17/09).
  - **Pessoas** — ranking de peças atendidas com **tempo médio/unidade** à direita; **cockpit de metas** reusando o MESMO `CartaoMeta` do Meu Painel (extraído para `src/metas/CartaoMeta.tsx`); e a **lista detalhada de execuções** no fim — sua escolha (b) de 17/09.
  - **Qualidade** — barras 100% com os 3 estados (vão entre segmentos, verde/laranja/vermelho SÓ aqui), herói "Saíram perfeitas X%" com **delta em p.p. vs o período anterior**, **danificados em aberto** (porta nova) e a tabela de divergências (RF-85).
- **Filtros pill na URL** (`?dias=&setor=&tempo=`): trocar de tela não perde filtro, e link é compartilhável. **Visualizações salvas** agora guardam **tela + filtros**; selecionar uma de outra tela **navega até ela**; o formato antigo da S10 (widgets) é **traduzido por leitura** — nenhum dado migrado.
- **Tokens `--dm-serie-fila`/`--dm-serie-execucao`** (o par validado do LEIA-ME), **fixos em todos os temas** — a `serie-1` segue a ação do tema e no esmeralda viraria VERDE, que é exclusivo da qualidade. LEIA-ME e modelo de sistema atualizados.
- **Migration 28 — 8 portas de leitura**, todas gateadas por `fn_setores_dashboard` (D-32), nenhuma tabela nova (D-47): `agora` (tiles + total), `pcp_dia`, `dia` (**concluída = chegou ao terminal final** — sua resposta de 17/09), `producao_hora`, `fim_de_linha` (o destino do dia é o ÚLTIMO terminal — lançar ESTOQUE→ROTAS não duplica), `danificados_dia`, `danificados_abertos`, `tendencia_semanas`.
- **Navegação (D-36):** menu Dashboards com os 4 filhos; `/dashboards` e `/dashboards/geral` redirecionam para a Visão do dia; página única da S10 removida.

## 2. Verificação executada (critérios da demanda)

| Critério | Resultado |
|---|---|
| As 4 telas existem e seguem os mockups | ✅ Validadas ao vivo na sua tela (18/09), com dado real do banco de produção |
| Gate D-32 intacto | ✅ `test:banco`: líder vê só FITAMENTO; operador zero linhas; fim de linha/tendência vazios p/ quem não mede terminais. No navegador: rota sem login → `/entrar` |
| Filtros combinados persistem na visualização salva | ✅ Ao vivo: salvei "Teste S16 - bruto 90d", apliquei da Visão do dia → navegou para a tela certa com bruto+90d restaurados (`?v=2`), excluí ao final |
| Tooltip em toda marca; sem 2 eixos; sem pizza | ✅ Recharts com tooltip da casa em todo gráfico; heróis antes de gráfico; nenhum eixo duplo, nenhuma pizza |
| Visão do dia atualiza sozinha e é legível de longe | ✅ Realtime + polling 60 s; números-herói por container query (`.num-heroi`) |
| Números batem | ✅ `test:banco`: retrato de agora = conta manual dos cards; concluídas do dia = soma por hora = conta manual dos eventos; fim de linha distribui exatamente as concluídas; danificados em aberto = etapa DANIFICADO |
| **Medição de vazamento** | ✅ **ZERO** nas 4 telas: 23–64 números medidos por tela em 700/900/1280/1920/2400px, sem rolagem horizontal |
| **Temas** | ✅ claro (ativa amarela), esmeralda (ação verde; séries seguem azul/âmbar FIXOS) e esmeralda-escuro (seu tema) — troca via `data-tema`, sem tocar seu perfil |

`tsc` ✅ · `lint` ✅ · Vitest **47/47** ✅ · `build` ✅ (bundle 1,71 MB — DT-ARQ9, sem mudança) · `test:banco` **TUDO VERDE em 2 rodadas** (+9 verificações da S16) · console limpo nas 4 telas.

## 3. Como validar (10 minutos)

1. `npm run dev`, entre com seu login e **Ctrl+F5** (o CSS mudou bastante).
2. **Dashboards → Visão do dia:** heróis, tiles (PCP com "a liberar"), produção por hora e fim de linha. De madrugada os números do dia zeram — normal.
3. **Tempo por setor** com "90 dias": FURAÇÃO no topo (16d de fila dos cards de teste), herói "A fila é 100%", tendência ao lado. Alterne **útil/bruto**.
4. **Pessoas:** seu ranking (5 peças · 19s/un), o cockpit de metas ("Nova meta" funciona como no Meu Painel) e a lista detalhada no fim.
5. **Qualidade** com "90 dias": SECC/FITAMENTO 100% 🟢, FURAÇÃO com o 🔴 de 33,3%, danificados em aberto ao lado.
6. **Visualização:** salve um painel com nome, mude de tela, aplique-o pelo seletor — deve voltar à tela dele com os filtros dele.
7. **Tema:** troque para Esmeralda no Meu Perfil — a ação fica verde, mas fila/execução seguem azul/âmbar (de propósito: verde é só da qualidade).

## 4. Pendente / decisões para você

- 🔶 **Merge na `main`**: aguarda seu OK nesta conversa (D-20). Depois dele: índice, mapa e status da demanda atualizados.
- ⚪ **A reorganização do cofre estava acontecendo em paralelo** a esta sessão (mockups e memórias de execução migraram para `_docs/Plataforma/...`). Esta sessão **não commitou nada da reorg** (E-23) — só os arquivos dela, incluindo a memória de execução recriada no local novo (`_docs/Plataforma/Execucao/SESSAO-16.md`, que ficou fora do snapshot da reorg). Duas notas do cofre commitadas por esta sessão carregam 1 linha de caminho da reorg cada (SUPA e a demanda), avisado no commit.
- ⚪ **E-34 (novo na memória de aprendizado):** o pipeline de texto do PowerShell corrompeu acentos em 4 arquivos — você viu o "OlÃ¡" no Meu Painel. Corrigido na hora (restauração byte-fiel do git) e a lição registrada: mojibake compila, a conferência é grep no fonte.
- ⚪ **Deriva conhecida do dado atual:** "A fila é 100%" é real — os cards de agosto/setembro passaram dias parados e as execuções duram segundos. Quando o galpão usar de verdade, os números ganham corpo.
- **Para a SESSAO-21:** nada desta sessão bloqueia o cutover; os advisors pré-existentes (ex.: `fn_pedido_por_numero_nf` aberta a anon) continuam com ela.

## 5. Notas do cofre atualizadas

[[SUPA - Esquema do Banco]] (migration 28) · [[PLT - Modelo de Sistema]] (tokens `serie-fila`/`serie-execucao`) · [[PLT - Memoria de Aprendizado]] (E-34) · LEIA-ME dos mockups (nos dois locais, por causa da reorg) · memória de execução em `_docs/Plataforma/Execucao/SESSAO-16.md`

## Ver também

[[handoff_2026_09_16_sessao20_modulo_comercial]] · [[SESSAO-16 - Dashboards de Verdade]] · [[000 - ORDEM DAS SESSOES]]
