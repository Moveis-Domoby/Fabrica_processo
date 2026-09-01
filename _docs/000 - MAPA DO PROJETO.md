---
titulo: Mapa do Cofre — Fábrica Domoby
tipo: MOC
atualizado: 2026-08-19
tags: [moc, indice, fabrica]
---

# 🗺️ Mapa do Cofre — Fábrica Domoby

> [!abstract] O que é este cofre
> A **memória de longo prazo dos processos fabris da Móveis Domoby**. Cada nota é um modelo mental de uma parte da operação: um workflow, um setor, uma integração, uma decisão. Antes de mexer em qualquer coisa, o agente lê a nota correspondente. Depois de mexer, atualiza a nota.
>
> **Escopo:** exclusivamente a fábrica — automações, processos entre setores (corte, furo, fitagem, montagem, embalagem, estoque…), e as plataformas a construir (controle de estoque, acompanhamento do caminhão, controle de rotas, calculadora de cargas, mapeamento de processos).
> O **painel de recompra** pertence ao cofre da loja — o que era dele aqui está em `_MOVER PARA COFRE DA LOJA/`, aguardando o usuário transferir.

## A fábrica em uma frase

Uma fábrica de **móveis em MDF (e linha industrial com metalurgia própria)** em Natal-RN que vende ~10 pedidos/dia majoritariamente pelo Instagram, produz sob encomenda com previsão de entrega, e entrega com frete próprio na região metropolitana — cujo fluxo pedido → produção → entrega roda sobre Tiny ERP + n8n + planilha + ClickUp/Trello.

## 🚀 Visão e roadmap

- [[001 - HANDOFF - Pesquisa e Ideias de Plataformas]] — **a pesquisa sobre a empresa + o banco de ideias generosas** para os próximos sistemas (estoque, rotas, cargas, tempos, custo real, portal do cliente…)

## 🏗️ Plataforma de Produção — em idealização (pasta `Plataforma/`)

> O projeto principal a partir de 19/08/2026: substituir o ClickUp da produção por uma plataforma própria em React cuja razão de existir é o **controle de tempo e produtividade** (por ora como alavancagem operacional — D-04 revisada). Quem coda é **exclusivamente o Claude Code**, em sessões ordenadas (D-10); o Cowork idealiza e mantém esta memória.

- [[PLT - Visao Geral]] — **comece por aqui**: o fluxo real da fábrica (19/08), a dor do tempo, a qualidade em 3 estados e a revisão da visão "um clique um evento"
- [[PLT - Decisoes de Produto]] — D-01 a D-17: card híbrido, timer fila (do setor) + execução (da pessoa), movimentação manual, medição como alavancagem (↩️), escopo, dispositivos, estoque fase 2, Supabase, qualidade 3 estados sem disputa (↩️), método de sessões, API de entrada antecipada, setores do ClickUp em 2 níveis, entrada/saídas do fluxo, etapas com timer próprio sem seed, stack, bloco 1
- [[PLT - Requisitos]] — catálogo vivo de requisitos (RF/RNF) com status
- [[PLT - Perguntas em Aberto]] — a entrevista de descoberta: respondidas viram decisões, abertas guiam a próxima conversa
- [[CLAUDE - Regras do Claude Code (repo)]] — persona + limites críticos/moderados/básicos; **copiar como `CLAUDE.md` para a raiz do repo na Sessão 01**
- [[PLT - Memoria de Aprendizado]] — 🧠 **leitura obrigatória em TODA construção** (Claude Code e Cowork): erros+correções, acertos, modelos mentais, fórmulas, possibilidades — alimentada na hora, em 1 linha por entrada
- [[000 - ORDEM DAS SESSOES]] — **o plano de construção**: 13 sessões de Claude Code, em ordem de dependência
- [[PROMPT - Bloco 1 (Sessoes 01 a 05)]] — o prompt do Bloco 1 (✅ encerrado na SESSAO-04; o restante foi replanejado pela D-23)
- [[PROMPT - Bloco 2 (Sessoes 05 a 09)]] — prompt do Bloco 2 (05 e 06 ✅ entregues)
- [[PLT - Plano Noturno Sessoes 07-12]] — 🌙 **o plano da vez (D-26/D-27)**: sessões 07→12 em execução autônoma encadeada — dúvidas todas no início, zero perguntas durante, decisões provisórias logadas, encadeamento automático de conversas
- **Bloco 3 — a reforma (D-35):** Sessões **13→16** com checkpoint por sessão — navegação pai→filho (D-36), Meu Painel + metas (D-37), Logística/ROTAS com caminhões (D-38/D-39), dashboards guiados pelos mockups de `docs/inspiracao/dashboards/` no repo (D-42); automações e admin renumeradas **17/18 (standby)**
- Demandas de implementação vivem em `Plataforma/Demandas/` (`SESSAO-NN - *.md`; template para novas: [[TEMPLATE - Demanda]])

## 🔌 Automações e migração n8n

- [[N8N - Visao Geral da Migracao]] — **comece por aqui**: as 7 automações, a arquitetura, o método
- [[N8N - Infraestrutura VPS]] — servidor, Docker, credenciais, webhooks do Tiny
- [[N8N - Workflow Tiny para Planilha]] — migração 1, nó a nó
- [[N8N - Codigo Mapear 49 Colunas]] — o código central, verificado contra 1.982 pedidos
- [[N8N - ROTAS ClickUp]] — migração 2, o card de entrega
- [[N8N - PCP Trello e ClickUp]] — migrações 3 e 4, o (k/n) e a causa da duplicação
- [[N8N - Incidente Credencial Google]] — a queda de 11/08 e a lição sobre OAuth
- [[N8N - API Tiny v2 vs v3]] — a decisão de ficar na v2 e a **regra do dono único** do token v3
- [[N8N - Cadastro de Cliente (em andamento)]] — migração 5, bloqueada aguardando o CSV
- [[N8N - ROTAS Entregue para Tiny]] — **em produção desde 17/08**: card movido para "entregue" na ROTAS marca o pedido como Entregue no Tiny — a primeira no sentido ClickUp → Tiny
- [[N8N - Migracao Supabase]] — **P15 em execução**: dupla escrita → backfill → paridade → corte da planilha

## 🗄️ Supabase — banco da fábrica (pasta `Supabase-fabrica/`)

> [!danger] Regra obrigatória para mexer no banco
> **Antes de escrever qualquer SQL, query ou node que toque o Supabase da fábrica, a PRIMEIRA coisa a fazer é ler [[SUPA - Esquema do Banco]]** — a fonte da verdade do que existe (tabelas, colunas, função, RLS). Nomes saem de lá, nunca de memória ou suposição: **nada de inventar tabela, coluna ou função "que provavelmente existe"**. Alterou o banco? O ciclo é: SQL rodado → `supabase-fabrica-schema.sql` atualizado → nota do esquema atualizada.

- [[SUPA - Visao Geral]] — projeto, endpoints, onde vivem as chaves, quem escreve/lê, convenções PostgREST
- [[SUPA - Esquema do Banco]] — **fonte da verdade**: clientes, pedidos, pedido_itens, eventos, `fn_upsert_pedido` (aplicado em 17/08)
- Tudo que for relacionado a este Supabase — endpoints novos, tabelas novas, rotas, decisões — entra na pasta `Supabase-fabrica/`, prefixo `SUPA -`
- ⚠️ Este banco é também o escolhido para a **Plataforma de Produção** (decisão D-08 em [[PLT - Decisoes de Produto]])

## 📚 Referências do Tiny (pesquisa 14/08/2026)

- [[N8N - Tiny Modelos Mentais]] — **comece por aqui**: as 4 portas de integração, id vs numero, strings v2 vs números v3, cadeado vs catraca
- [[N8N - Tiny Integracoes Referencia]] — catálogo completo: todos os endpoints v2, OAuth da v3, webhooks, limites do plano Impulsione, códigos de erro

## 🏭 Processos fabris

- [[FAB - Processo Alvo - Um Clique Um Evento]] — a visão-alvo de 13/08 (⚠️ **parcialmente revisada em 19/08** — a decisão de destino é humana; ver [[PLT - Visao Geral]])
- [[FAB - Estrutura de Producao (Trello e ClickUp)]] — a linha real mapeada dos quadros (⚠️ estrutura confiável, números não)
- *Notas futuras por setor (corte/SECC, CNC, furação, fitamento, metalurgia, montagem, embalagem, estoque) entram aqui conforme o mapeamento avançar*

## 🔧 Pendências e riscos

- [[N8N - Pendencias e Riscos]] — **P1–P13 priorizados** + regras operacionais permanentes

## 📜 Histórico de sessões

- [[handoff_2026_08_28_sessao13_navegacao]] — **SESSAO-13 da Plataforma (abre o Bloco 3 — a reforma)**: navegação em duas barras laterais (pais → filhos, cada uma recolhível), rotas todas em `/pai/filho` com redirecionamentos, Meu Perfil com 8 temas Domoby e foto, login com logo metálica, e a trilha de atividade append-only registrando tudo (D-40); migration 22 aplicada e Edge Function v3 no ar com autorização do dono
- [[handoff_2026_08_28_sessao12_tarefas]] — **SESSAO-12 da Plataforma (fecha o bloco noturno D-26)**: afazeres meus/do time, delegação em 3 modos por setor com sorteio balanceado só entre quem está logado, tarefa avulsa com timer opcional, aviso ao delegado no sino — e o incidente E-20 (coluna criada por outra sessão com desenho divergente, alinhada pela migration 21)
- [[handoff_2026_08_28_sessao11_api_rotas]] — **SESSAO-11 da Plataforma (bloco noturno D-26)**: a API aberta no ar (Edge Function com chave própria, escopos, revogação instantânea; exclusão = arquivamento lógico), webhooks de saída com fila + pg_net/pg_cron testados de ponta a ponta, e as ROTAS dentro da plataforma (D-33) — entrega por pedido completo com o formato do card real, sem tocar ClickUp nem Tiny
- [[handoff_2026_08_28_sessao10_dashboards]] — **SESSAO-10 da Plataforma (bloco noturno D-26)**: dashboards com o tempo em primeiro lugar (D-32) — lista detalhada de execuções com duração bruta e útil (D-29 descontando horário/pausas), fila vs execução por setor somadas (D-02), pessoa, item, qualidade por setor e estoque; visualizações salvas por usuário; gate no banco (líder só vê o próprio setor)
- [[handoff_2026_08_28_sessao09_entrada_pedidos]] — **SESSAO-09 da Plataforma (bloco noturno D-26)**: pedido novo do Tiny vira card no PCP sozinho — trigger à prova de falha no próprio banco (D-31), idempotente; edição pós-liberação e cancelamento viram eventos e selos visíveis, admins avisados quando cancela com produção em andamento
- [[handoff_2026_08_28_sessao07_tela_setor]] — **SESSAO-07 da Plataforma (bloco noturno D-26)**: a tela do chão de fábrica — fila do setor em tela cheia com PIN por teclado na tela (autor do gesto = operador identificado), tempo real + som discreto, imagens por produto; e o prelúdio D-27 (menu lateral, modelo de sistema no cofre, microinteração, UI e banco sem códigos internos) + controle de tempo do admin (D-29)
- [[handoff_2026_08_27_sessao06_qualidade]] — **SESSAO-06 da Plataforma**: a dupla atestação da D-09 virando regra de banco — marcação 🟢🟡🔴 obrigatória ao sair de produção, parecer de recebimento antes do Iniciar, 🔴 vai sozinho para a etapa DANIFICADO (criada pelo sistema), notificações automáticas a líderes dos dois setores + admins com o relato exato, e o sino no topo (D-25)
- [[handoff_2026_08_27_sessao05_timers]] — **SESSAO-05 da Plataforma**: o tempo medido de verdade — Iniciar/Finalizar/Assumir no card, fila do setor vs execução da pessoa, linha do tempo por etapa com autores, estorno visível (líder/admin) e limite configurável de execuções por pessoa/setor (D-24)
- [[handoff_2026_08_27_sessao04_kanban]] — **SESSAO-04 da Plataforma**: o kanban núcleo — PCP libera pedidos reais do Tiny em unidades (k/n), quadros de setor com drag-and-drop + botão Mover, expedição/reagrupamento, cadastro de setores e etapas; toda movimentação é evento append-only com autor (D-22)
- [[handoff_2026_08_27_sessao03_autenticacao]] — **SESSAO-03 da Plataforma**: login por usuário/e-mail, convites por WhatsApp, matrícula MDM automática, troca de senha obrigatória, papéis operador/líder/admin com bloqueio por URL, PIN de tablet (D-21)
- [[handoff_2026_08_26_sessao02_banco]] — **SESSAO-02 da Plataforma**: modelo de domínio em 10 migrations, aplicado no Supabase da fábrica (9 tabelas plt_*, eventos append-only, RLS por papel)
- [[handoff_2026_08_24_sessao01_fundacao]] — **SESSAO-01 da Plataforma**: repositório, app React e design system Domoby (amarelo sobre grafite) na branch `sessao-01-fundacao`
- [[handoff_2026_08_17_automacao_entregue]] — pesquisa completa das integrações do Tiny + projeto da automação ROTAS "entregue" → Tiny
- [[handoff_2026_08_13_migracao_n8n]] — migrações 2–4 no ar, incidente Google, início da 5
- *Novos handoffs vão para `Handoffs/` e devem ser linkados aqui — inclusive os de cada SESSAO-NN da Plataforma*

## 🧩 Templates

- [[TEMPLATE - Handoff de Sessao]] — copiar ao fim de cada sessão de trabalho
- [[TEMPLATE - Demanda]] — copiar ao especificar uma demanda nova da Plataforma

## Como usar este cofre

> [!tip] O ciclo, em quatro passos
> **1.** Antes de alterar algo → ler a nota da área (mexer num workflow → nota `N8N -`; num setor → nota `FAB -`; na plataforma → notas `PLT -` e a `SESSAO-NN` correspondente).
> **2.** Toda decisão de negócio ou de processo vai para a nota da área, não só para a ferramenta. Decisões da plataforma → [[PLT - Decisoes de Produto]] com ID `D-NN`.
> **3.** Todo problema descoberto vai para [[N8N - Pendencias e Riscos]] com um ID (P14, P15…). Ao corrigir, marcar `✅ resolvido em AAAA-MM-DD` — **sem apagar o item**.
> **4.** Ao fim da sessão, preencher o [[TEMPLATE - Handoff de Sessao]] em `Handoffs/` e linkar aqui.

> [!info] O que a IA escreve vs o que o dono escreve
> A IA registra o técnico (o que mudou, por quê, o que quebrou). **O dono registra o de negócio** — o que a equipe reclamou, o que mudou de prioridade, como o processo físico funciona de verdade. Isso a IA não tem como saber, e é o que mais falta neste cofre hoje: o detalhe real de cada setor.

## Estado atual em uma linha

**↪️ Atualizado em 28/08/2026 (madrugada — SESSAO-13 entregue):** a reforma começou — a **SESSAO-13** trocou a casca inteira (navegação em duas barras pai→filho, rotas `/pai/filho`, Meu Perfil com 8 temas, login novo, log de toda atividade — D-36/D-40/D-41/D-43), com migration 22 aplicada e Edge Function v3 no ar; branch `sessao-13-navegacao` **aguarda revisão e merge do dono**. Próxima: SESSAO-14 (Meu Painel + metas). Pendências do dono: trocar a senha do admin (ficou no chat!), confirmar decisões provisórias do handoff da 13.

## Estado anterior em uma linha (28/08, noite)

**↪️ 28/08/2026 (noite — revisão do dono + bloco 3 definido):** o dono usou a plataforma, rejeitou a navegação e os dashboards, e nasceu o **Bloco 3 — a reforma (D-35…D-42)**: SESSAO-13 (sidebar pai→filho, rotas `/pai/filho`, Meu Perfil com 8 temas, login novo, log de toda atividade) → 14 (Meu Painel + cockpit de metas) → 15 (Logística: Estoque/Aguardo/Danificados + ROTAS com caminhões e mapa) → 16 (dashboards refeitos sobre os mockups de `docs/inspiracao/dashboards/`), **com checkpoint por sessão** (D-26 encerrada — regra crítica 2 na íntegra). **Tudo externo em standby** (automações→17, admin→18, publicação segue D-30). Demandas 13–16 `📐 prontas`; prompt entregue no chat (D-17). Pendências do checklist da manhã que continuam com o dono: trocar a senha do admin, contas dos tablets, modo de delegação por setor.

## Estado anterior em uma linha

**↪️ Atualizado em 28/08/2026 (bloco noturno D-26 encerrado):** a Plataforma de Produção tem **11 sessões entregues** — o bloco noturno somou a tela do setor em tablet (PIN na tela, tempo real + som), a entrada automática de pedidos por trigger, os dashboards de tempo (com descontos de horário/pausa — D-29), a API aberta com webhooks, as ROTAS dentro da plataforma (D-33) e os afazeres com delegação (D-34); decisões D-28…D-34 registradas; **revisão da manhã pendente** — checklist em `Handoffs/continuidade_bloco_noturno.md`. Ficam: publicação no ar (D-30 — o dono avisa), automações internas (13) e painel admin (14). A linha antiga abaixo descreve o estado até a SESSAO-06.
