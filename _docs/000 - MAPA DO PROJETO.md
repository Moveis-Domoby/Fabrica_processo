---
titulo: Mapa do Cofre — Domoby (Fábrica + Comercial)
tipo: MOC
atualizado: 2026-09-18
tags: [moc, indice, fabrica, comercial]
---

# 🗺️ Mapa do Cofre — Domoby

> [!abstract] O que é este cofre
> A **memória de longo prazo da Móveis Domoby** — agora unificada. Cada nota é um modelo mental de uma parte da operação: um workflow, um setor, uma integração, uma tela, uma decisão. Antes de mexer em qualquer coisa, o agente lê a nota correspondente. Depois de mexer, atualiza a nota.
>
> **Escopo: a empresa inteira.** A fábrica (automações, processos entre setores, a Plataforma de Produção) **e o comercial** — desde 15–16/09/2026 o Painel de Recompra da loja é o módulo **Comercial** da plataforma (SESSÕES 19–20), e em **17/09/2026 o cofre da loja foi fundido neste** (não existe mais cofre separado; o que sobrou lá é material morto do repo antigo, que morre no cutover).

## A empresa em uma frase

Uma fábrica de **móveis em MDF (e linha industrial com metalurgia própria)** em Natal-RN que vende ~10 pedidos/dia majoritariamente pelo Instagram, produz sob encomenda e entrega com frete próprio — cujo fluxo pedido → produção → entrega roda sobre Tiny ERP + n8n + Supabase + a plataforma própria, e cujo pós-venda (recompra, campanhas WhatsApp via DataCrazy) roda no módulo Comercial da mesma plataforma.

## 🧱 Como o cofre está organizado

| Pasta | O que vive lá | Prefixo |
|---|---|---|
| `Planejamento/` | **os próximos passos e o roadmap** — comece por [[000 - PROXIMOS PASSOS]] | — |
| `Plataforma/` | a Plataforma de Produção: visão, decisões, requisitos, modelo de sistema, memória de aprendizado — e o módulo **Comercial** | `PLT -` |
| `Plataforma/Demandas/` | as demandas de implementação, uma por sessão | `SESSAO-NN` |
| `Plataforma/Execucao/` | a memória de execução técnica de cada sessão do Claude Code (regra 8) | `SESSAO-NN` |
| `Plataforma/Inspiracao/` | mockups-alvo (dashboards da SESSAO-16) | — |
| `Fabrica n8n/` | automações n8n e referências do Tiny ERP | `N8N -` |
| `Supabase-fabrica/` | o banco único da empresa: esquema (fonte da verdade), domínio comercial, Edge Functions, crons | `SUPA -` |
| `Atendimento/` | memória do atendimento humano e fluxos de follow-up no DataCrazy (negócio, não código) | `ATD -` |
| `Handoffs/` | resumo de cada sessão de trabalho para o dono revisar | `handoff_` |
| `Templates/` | modelos para handoff e demanda nova | `TEMPLATE -` |

## 🎯 Planejamento e roadmap (pasta `Planejamento/`)

- [[000 - PROXIMOS PASSOS]] — **a leitura única**: onde estamos, o próximo passo, o que vem depois, o que está com o dono
- [[001 - HANDOFF - Pesquisa e Ideias de Plataformas]] — a pesquisa sobre a empresa + o banco de ideias para os próximos sistemas (estoque, rotas, cargas, custo real, portal do cliente…)
- [[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]] — a orquestração do pacote de 18/09: sessões 22–28 (produção infalível, estoque + Tiny da fábrica, Meu Painel 2.0, chat interno, automações em canvas, rota calculada), com ordem de execução e de-para demanda→sessão

## 🏗️ Plataforma de Produção (pasta `Plataforma/`)

> O projeto principal desde 19/08/2026: substituir o ClickUp da produção por plataforma própria em React, cuja razão de existir é o **controle de tempo e produtividade**. Quem coda é **exclusivamente o Claude Code**, em sessões ordenadas (D-10); o Cowork idealiza e mantém esta memória.

- [[PLT - Visao Geral]] — **comece por aqui**: o fluxo real da fábrica, a dor do tempo, a qualidade em 3 estados
- [[PLT - Decisoes de Produto]] — D-01 em diante: as decisões são lei; contradição → parar e perguntar
- [[PLT - Requisitos]] — catálogo vivo de requisitos (RF/RNF) com status
- [[PLT - Modelo de Sistema]] — o design system e os padrões de UI (fonte única desde a SESSAO-07/D-27)
- [[PLT - Memoria de Aprendizado]] — 🧠 **leitura obrigatória em TODA construção**: erros+correções, acertos, modelos mentais
- [[PLT - Perguntas em Aberto]] — o que está aí **não tem resposta**: pergunte, não invente
- [[PLT - Plano Uniao das Plataformas]] — o plano D-46/D-47 que uniu loja e fábrica (sessões 19–21)
- [[PLT - Modelo de Dados (conceito)]] — o desenho do banco da plataforma explicado em língua de gente (estado da SESSAO-02; verdade técnica em [[SUPA - Esquema do Banco]])
- [[PLT - API Aberta]] — a porta de integrações da plataforma (chave `X-Chave-API`, endpoints, webhooks de saída)
- [[PLT - Entrada Automatica de Pedidos]] — pedido do Tiny vira card no PCP por trigger no banco (D-31)
- [[CLAUDE - Regras do Claude Code (repo)]] — persona + limites; cópia fiel vive como `CLAUDE.md` na raiz do repo (D-10)
- Demandas: [[000 - ORDEM DAS SESSOES]] — **o plano de construção** (status de cada sessão; novas pelo [[TEMPLATE - Demanda]])
- Execução: [[000 - EXECUCAO (indice)]] — as memórias técnicas `SESSAO-NN` do Claude Code (**novas sessões escrevem aqui**, não mais em `docs/` do repo)
- Inspiração: `Plataforma/Inspiracao/dashboards/` — os 4 mockups + regras da SESSAO-16 (`000-LEIA-ME.md`)

## 🛒 Módulo Comercial (ex–Painel de Recompra)

> O pós-venda da loja dentro da plataforma: espelho das vendas do Tiny, taxa de recompra/LTV/sazonalidade, campanhas de reativação por WhatsApp (DataCrazy) com ROI. Banco na fábrica desde a SESSAO-19; front em `/comercial/*` desde a SESSAO-20; **disparo TRAVADO até o cutover** (SESSAO-21).

Modelos mentais (leia primeiro):
- [[PLT - Comercial - Fluxo do Dado]] — do pedido no Tiny até o pixel na tela (estado pós-união)
- [[PLT - Comercial - Identidade do Cliente]] — **a decisão mais consequente do módulo inteiro**
- [[PLT - Comercial - Dicionario de Metricas]] — o que cada número significa ("recorrente" = vida ≥ 2)
- [[PLT - Comercial - Maquina de Estados do Disparo]] — o ciclo de vida de uma campanha + a trava de 3 camadas

Telas, integração e dívidas:
- [[PLT - Comercial - Telas]] — as telas de `/comercial/*`: hooks, RPCs, pegadinhas
- [[PLT - Comercial - Integracao DataCrazy]] — o CRM de disparo: gatilho de ida, webhook de volta, o que muda no cutover
- [[PLT - Comercial - Debito Tecnico]] — índice VIVO de problemas conhecidos (IDs DT-* originais; nunca apagar item)
- [[PLT - Comercial - Legado e Cutover]] — ⚠️ **o guia da SESSAO-21**: o que ainda roda no repo/Supabase antigos e o destino de cada coisa

## 🔌 Automações e migração n8n (pasta `Fabrica n8n/`)

- [[N8N - Visao Geral da Migracao]] — **comece por aqui**: as 7 automações, a arquitetura, o método
- [[N8N - Infraestrutura VPS]] — servidor, Docker, credenciais, webhooks do Tiny
- [[N8N - Workflow Tiny para Planilha]] — migração 1, nó a nó
- [[N8N - Codigo Mapear 49 Colunas]] — o código central, verificado contra 1.982 pedidos
- [[N8N - ROTAS ClickUp]] — migração 2, o card de entrega
- [[N8N - PCP Trello e ClickUp]] — migrações 3 e 4, o (k/n) e a causa da duplicação
- [[N8N - Incidente Credencial Google]] — a queda de 11/08 e a lição sobre OAuth
- [[N8N - Cadastro de Cliente]] — migração 5: formulário do Google → contato no Tiny (aguarda publicação)
- [[N8N - ROTAS Entregue para Tiny]] — **em produção desde 17/08**: "entregue" na ROTAS marca o pedido no Tiny
- [[N8N - Migracao Supabase]] — P15: dupla escrita → backfill → paridade → corte da planilha
- [[N8N - Backfill Historico do Tiny]] — todo o histórico desde 12/03/2025 puxado da API v2 para o Supabase
- [[N8N - Pendencias e Riscos]] — **P1–P15 priorizados** + regras operacionais permanentes

## 📚 Referências do Tiny ERP

- [[N8N - Tiny Modelos Mentais]] — **comece por aqui**: as 4 portas de integração, id vs numero, cadeado vs catraca
- [[N8N - Tiny Integracoes Referencia]] — catálogo completo: endpoints v2, **OAuth v3 e endpoints do domínio comercial (fundidos do cofre da loja em 17/09)**, webhooks, limites, erros
- [[N8N - API Tiny v2 vs v3]] — a decisão de ficar na v2 no n8n e a **regra do dono único** do token v3 (renovador SÓ no projeto antigo da loja até o cutover)

## 🗄️ Supabase — o banco único (pasta `Supabase-fabrica/`)

> [!danger] Regra obrigatória para mexer no banco
> **Antes de escrever qualquer SQL, query ou node que toque o Supabase, a PRIMEIRA coisa a fazer é ler [[SUPA - Esquema do Banco]]** — a fonte da verdade do que existe. Nomes saem de lá, nunca de memória. Alterou o banco? O ciclo é: SQL rodado → `supabase-fabrica-schema.sql` atualizado → nota do esquema atualizada.

- [[SUPA - Visao Geral]] — projeto, endpoints, onde vivem as chaves, quem escreve/lê
- [[SUPA - Esquema do Banco]] — **fonte da verdade**: integração Tiny, tabelas `plt_*` da plataforma e o domínio comercial (migrations 26/27)
- [[SUPA - Comercial - Dominio de Dados]] — o domínio comercial em detalhe: view `vendas_marketing` (D-47), tabelas de disparo, as RPCs com assinaturas, RLS
- [[SUPA - Comercial - Edge Functions]] — as functions do comercial na fábrica, gatilhos e secrets (só nomes)
- [[SUPA - Comercial - Cron e Rotinas]] — ⏰ o que roda sozinho e onde; **a lista exata do cutover** (jobs a criar na fábrica, jobs a desligar no projeto antigo)

## 🗣️ Atendimento — memória de negócio (pasta `Atendimento/`)

> Não descreve código: é a memória do atendimento humano (WhatsApp/Instagram) e a especificação dos fluxos de follow-up no CRM. Veio do cofre da loja em 17/09/2026.

- [[000 - ATENDIMENTO (indice)]] — **comece por aqui**: o que existe e em que ordem ler
- [[ATD - Por que Convertemos Pouco]] · [[ATD - Recepcao e Follow-up]] · [[ATD - FAQ e Respostas Padrao]]
- Equipe: [[ATD - Equipe - Felipe Padrao Ouro]] · [[ATD - Equipe - Gabriel]] · [[ATD - Equipe - Gessica]]
- Follow-up DataCrazy: [[ATD - Follow-up DataCrazy - Anatomia]] · [[ATD - Follow-up DataCrazy - Defeitos]] · [[ATD - Follow-up DataCrazy - Fluxo v2]] · [[ATD - Follow-up DataCrazy - Especificacao Importavel]]

## 🏭 Processos fabris

- [[FAB - Processo Alvo - Um Clique Um Evento]] — a visão-alvo de 13/08 (⚠️ parcialmente revisada em 19/08 — ver [[PLT - Visao Geral]])
- [[FAB - Estrutura de Producao (Trello e ClickUp)]] — a linha real mapeada dos quadros (estrutura confiável, números não)
- *Notas futuras por setor (corte/SECC, CNC, furação, fitamento, metalurgia, montagem, embalagem, estoque) entram aqui conforme o mapeamento avançar*

## 📜 Histórico de sessões (pasta `Handoffs/`)

- [[handoff_2026_09_21_sessao22_filas_tempo_pausa]] — **SESSAO-22** (abre o Bloco 5): filas reais (fim da coluna "Chegada" na produção), tempo de PCP do PEDIDO (D-48), quadros paginados 10+"Ver mais" com a lei nova "cada tela requisita só o que mostra" (regra 17/RNF-07), limite 1 por pessoa + pausa por líder com desconto de tempo — migration 29 escrita e testada, **aguardando o F-08 (aplicação) e o merge**
- [[handoff_2026_09_18_sessao16_dashboards]] — **SESSAO-16**: os dashboards de verdade (D-42) — 4 telas-filhas nos moldes dos mockups (Visão do dia estilo andon com atualização sozinha, Tempo por setor fila×execução, Pessoas com cockpit de metas e a lista detalhada, Qualidade 100% empilhado), migration 28 com 8 portas gateadas, tokens fixos fila/execução, vazamento zero em 700–2400px
- [[handoff_2026_09_16_sessao20_modulo_comercial]] — **SESSAO-20 (União 2)**: o Painel de Recompra recriado como módulo Comercial (rotas `/comercial/*`, trava de disparo em 3 camadas, permissão por módulo, Recharts 3.9.2 fixado)
- [[handoff_2026_09_15_sessao19_banco_comercial]] — **SESSAO-19 (União 1)**: o domínio do recompra no Supabase da fábrica (6 tabelas, `vendas_marketing` como VIEW — D-47, 10 RPCs, dashboards batendo ao centavo)
- [[handoff_2026_09_08_sessao15_logistica_rotas]] — **SESSAO-15**: Logística e ROTAS como módulo (Estoque, Aguardo, Danificados, Programação com mapa, Caminhões)
- [[handoff_2026_09_01_sessao14_meu_painel]] — **SESSAO-14**: Meu Painel com pendências, avisos e cockpit de metas (D-37)
- [[handoff_2026_08_28_sessao13_navegacao]] — **SESSAO-13**: navegação pai→filho, temas, login novo, trilha de atividade (D-40)
- [[handoff_2026_08_28_sessao12_tarefas]] — **SESSAO-12**: afazeres e delegação em 3 modos (fecha o bloco noturno D-26)
- [[handoff_2026_08_28_sessao11_api_rotas]] — **SESSAO-11**: API aberta + webhooks de saída + ROTAS na plataforma (D-33)
- [[handoff_2026_08_28_sessao10_dashboards]] — **SESSAO-10**: dashboards com o tempo em 1º lugar (visual refeito na 16)
- [[handoff_2026_08_28_sessao09_entrada_pedidos]] — **SESSAO-09**: entrada automática de pedidos por trigger (D-31)
- [[handoff_2026_08_28_sessao07_tela_setor]] — **SESSAO-07**: a tela do chão de fábrica (PIN, tempo real, som)
- [[handoff_2026_08_27_sessao06_qualidade]] — **SESSAO-06**: dupla atestação como regra de banco + sino (D-25)
- [[handoff_2026_08_27_sessao05_timers]] — **SESSAO-05**: o tempo medido de verdade (fila vs execução)
- [[handoff_2026_08_27_sessao04_kanban]] — **SESSAO-04**: o kanban núcleo (eventos append-only — D-22)
- [[handoff_2026_08_27_sessao03_autenticacao]] — **SESSAO-03**: login, convites, papéis, PIN de tablet (D-21)
- [[handoff_2026_08_26_sessao02_banco]] — **SESSAO-02**: modelo de domínio em 10 migrations
- [[handoff_2026_08_24_sessao01_fundacao]] — **SESSAO-01**: repositório, app React e design system Domoby
- [[handoff_2026_08_17_automacao_entregue]] — integrações do Tiny + automação ROTAS "entregue" → Tiny
- [[handoff_2026_08_13_migracao_n8n]] — migrações 2–4 no ar, incidente Google, início da 5
- Planos históricos do método: [[PLT - Plano Noturno Sessoes 07-12]] · [[PROMPT - Bloco 1 (Sessoes 01 a 05)]] · [[PROMPT - Bloco 2 (Sessoes 05 a 09)]] · `Handoffs/continuidade_bloco_noturno.md`
- *Novos handoffs vão para `Handoffs/` e devem ser linkados aqui — inclusive os de cada SESSAO-NN*

## 🧩 Templates

- [[TEMPLATE - Handoff de Sessao]] — copiar ao fim de cada sessão de trabalho
- [[TEMPLATE - Demanda]] — copiar ao especificar uma demanda nova da Plataforma

## Como usar este cofre

> [!tip] O ciclo, em quatro passos
> **1.** Antes de alterar algo → ler a nota da área (workflow → `N8N -`; setor → `FAB -`; plataforma → `PLT -` e a `SESSAO-NN`; módulo Comercial → `PLT - Comercial -`; banco → `SUPA -`; atendimento → `ATD -`).
> **2.** Toda decisão de negócio ou de processo vai para a nota da área, não só para a ferramenta. Decisões da plataforma → [[PLT - Decisoes de Produto]] com ID `D-NN`.
> **3.** Todo problema descoberto vai para [[N8N - Pendencias e Riscos]] (automações) ou [[PLT - Comercial - Debito Tecnico]] (comercial) com um ID. Ao corrigir, marcar `✅ resolvido em AAAA-MM-DD` — **sem apagar o item**.
> **4.** Ao fim da sessão: memória técnica em `Plataforma/Execucao/SESSAO-NN.md`, handoff pelo [[TEMPLATE - Handoff de Sessao]] em `Handoffs/`, link aqui no mapa — e [[000 - PROXIMOS PASSOS]] atualizado.

> [!info] O que a IA escreve vs o que o dono escreve
> A IA registra o técnico (o que mudou, por quê, o que quebrou). **O dono registra o de negócio** — o que a equipe reclamou, o que mudou de prioridade, como o processo físico funciona de verdade. Isso a IA não tem como saber, e é o que mais falta neste cofre hoje: o detalhe real de cada setor.

## Estado atual em uma linha

**↪️ Atualizado em 21/09/2026 (SESSAO-16 entregue):** os dashboards de verdade estão no ar — as 4 telas-filhas do pai Dashboards (Visão do dia/andon, Tempo por setor, Pessoas, Qualidade) nos moldes dos mockups da D-42, com a migration 28 aplicada (8 portas de leitura gateadas — D-32), os tokens fixos de fila/execução, visualizações salvas por tela+filtros e vazamento zero medido em 700–2400px; validada ao vivo com o dono e **mesclada na `main` pelo PR #4 em 18/09**. **Próxima: SESSAO-22 (Bloco 5)**, com a 21 (cutover) na janela do dono.

**↪️ 18/09/2026 (nasce o Bloco 5):** o dono trouxe o maior pacote de demandas desde a fundação, orquestrado em [[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]]: **SESSÕES 22–28** (filas reais + tempo de PCP + paginação · Meu Painel 2.0 com subtarefas · estoque núcleo com Pedidos em aguardo e cancelamentos · integração NOVA com o Tiny da fábrica · chat interno · automações em canvas, que absorve a 17 · rota calculada OSRM). Ordem decidida: **16 → 22…28**, com a 21 (cutover) na janela do dono. Todas as demandas `📐 prontas para code`, com as perguntas ao dono embutidas.

**↪️ 17/09/2026 (reorganização do cofre):** os dois cofres viraram UM — o `_Docs` da loja foi destrinchado e fundido aqui (domínio de dados → `SUPA - Comercial -*`, Tiny v3 → referência do Tiny, módulo → `PLT - Comercial -*`, atendimento → `Atendimento/`), a pasta `docs/` do repo foi absorvida (`execucao/` → `Plataforma/Execucao/`, mockups → `Plataforma/Inspiracao/`, notas soltas → `PLT -`), e nasceu `Planejamento/` com [[000 - PROXIMOS PASSOS]]. Estado do produto: SESSÕES 19–20 entregues (módulo Comercial no ar com disparo travado). **Próxima: SESSAO-16 (dashboards), depois SESSAO-21 (cutover).**

**↪️ 16/09/2026 (SESSAO-20 entregue):** o Painel de Recompra virou o módulo Comercial dentro da plataforma (40 arquivos portados, rotas `/comercial/*`, trava de disparo em 3 camadas até o cutover), navegação reorganizada com permissão por módulo, migration 27 aplicada, temas esmeralda e tokens de série que a SESSAO-16 herda com Recharts 3.9.2.

## Estados anteriores em uma linha

**↪️ 15/09/2026 (SESSAO-19 entregue — abre o bloco União D-46/D-47):** o domínio do Painel de Recompra passou a viver no Supabase da fábrica — 6 tabelas + `vendas_marketing` como VIEW, 10 RPCs com dashboards batendo ao centavo, permissão por módulo, 6 Edge Functions no ar SEM cron (o renovador do token segue só no projeto antigo até o cutover).

**↪️ 08/09/2026 (SESSAO-15 entregue):** Logística e ROTAS viraram módulo de verdade (Estoque com ID, Pedidos em aguardo, Danificados, Programação de caminhão com mapa — D-38/D-39/D-45); migration 25 aplicada, Edge `geocodificar` no ar; branch mesclada na main e publicada em 15/09.

**↪️ 01/09/2026 (SESSAO-14 entregue):** o Meu Painel no ar (pendências, avisos, cockpit de metas — D-37); migrations 23/24 aplicadas; achado E-24 (blindagem do backfill desfeita e devolvida; ~163 cards históricos aguardam decisão de limpeza).

**↪️ 28/08/2026 (SESSAO-13 + bloco 3 definido):** a reforma da casca (navegação pai→filho, 8 temas, login novo, log de tudo — D-36/D-40/D-41); o bloco noturno D-26 tinha somado as sessões 07/09→12; nasceram as demandas 13–16 da reforma, com automações→17 e admin→18 em standby.
