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
- [[PROMPT - Bloco 1 (Sessoes 01 a 05)]] — 🚀 **o prompt pronto para colar no Claude Code** (formato mínimo, D-17: só o caminho — o cofre carrega o resto)
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

**4 de 7 automações migradas e em produção** no n8n, mais a **ROTAS "entregue" → Tiny desde 17/08** (P14 ✅); a 5ª migração aguarda o CSV; **não existe alerta de erro** (P1 — a pendência mais crítica); a **migração da planilha para o Supabase é projeto ativo** (P15); e a **Plataforma de Produção entrou em idealização em 19/08** — 10 decisões (D-01–D-10, com D-04 revisada para alavancagem operacional), sistema de qualidade em 3 estados definido (D-09), regras do Claude Code prontas e **12 sessões de construção propostas** em [[000 - ORDEM DAS SESSOES]], aguardando aprovação da ordem.
