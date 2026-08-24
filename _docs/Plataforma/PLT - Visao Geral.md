---
titulo: Plataforma de Produção — Visão Geral
tipo: visao
data: 2026-08-19
atualizado: 2026-08-24
tags: [plataforma, visao, producao, tempo, produtividade, react]
---

# 🏗️ PLT — Visão Geral da Plataforma de Produção

> [!abstract] O que é este documento
> A **memória de idealização da plataforma própria de produção da Domoby** — um sistema estilo ClickUp, feito sob medida, cuja razão de existir é a dor que nenhuma ferramenta atual mede: **controle de tempo e produtividade**. Registrado a partir das conversas com o dono em 19/08/2026. Requisitos detalhados em [[PLT - Requisitos]], decisões em [[PLT - Decisoes de Produto]], dúvidas em [[PLT - Perguntas em Aberto]], plano de construção em [[000 - ORDEM DAS SESSOES]].

## O fluxo real da fábrica (entendimento de 19/08/2026, nas palavras do dono)

1. **Pedido é cadastrado no Tiny** assim que é vendido.
2. O pedido **cai SEMPRE no PCP**.
3. **O PCP é totalmente manual — e deve continuar sendo.** É uma tomada de decisão humana e rápida que considera N fatores: como está o estoque, se as máquinas estão funcionando, se os funcionários vieram trabalhar.
4. O PCP decide **para qual etapa o card vai** (CNC, SECC, montagem, limpeza…) e o move.
5. Ao ser movido, o card é **transferido para o respectivo setor**.
6. No setor, o card **entra na fila** → o processo é **iniciado** → **finalizado**. Ao finalizar, **o próprio setor decide o próximo destino** — de novo, decisão manual.
7. Quando o pedido é vendido, é preciso ter **controle de estoque**: quais peças existem, quais produtos já estão montados para venda/despacho, o que precisa repor (a plataforma cuidará disso — fase 2).
8. O ClickUp/Trello **já atende bem a linha de produção** — com uma exceção crítica.

## A dor que justifica a plataforma

> **Controle de tempo.** A fábrica não tem noção alguma de produtividade por setor, de tempo em cada etapa, de quem produz mais ou menos.

**Como a medição será usada (D-04 revisada em 19/08):** por enquanto, como **alavancagem operacional** — melhorar cada setor por si só, com a contribuição dos colaboradores. Bonificação/meritocracia ainda será debatida e decidida no futuro; a arquitetura preserva o histórico completo (eventos append-only) para que essa porta continue aberta.

**A quem pertence cada tempo (D-02 detalhada em 24/08):** o tempo de **fila é do setor/etapa** — na fila o card não está direcionado a ninguém, e fila longa = gargalo = sinal de contratação. O tempo de **execução é da pessoa** que iniciou/finalizou. O objetivo do fluxo: **tempo de produção por item, por setor e por pessoa**.

## Qualidade em toda transição (D-09 — pedido da equipe)

O estado físico da peça **impacta completamente o andamento entre setores** — e um setor pode atestar "está bom" apenas para prejudicar o próximo. Por isso, toda movimentação entre setores tem **dupla atestação**:

- Quem **entrega** marca obrigatoriamente: 🟢 perfeito estado · 🟡 estado de atenção · 🔴 danificado. Sem foto obrigatória (revisão de 24/08).
- Quem **recebe**, antes de iniciar qualquer trabalho, responde *"O setor X marcou como Y — você concorda?"* e registra o próprio parecer.
- **Sem fluxo de disputa/pausa por enquanto** (revisão de 24/08): divergência de parecer não trava a peça — vira registro que alimenta a dashboard. 🔴 confirmado vai para DANIFICADO.
- **Toda decisão de qualidade aparece na dashboard.**

## ⚠️ Revisão da visão "um clique, um evento" (13/08)

A nota [[FAB - Processo Alvo - Um Clique Um Evento]] dizia que "o roteiro é do produto, ninguém decide para onde vai". **O entendimento de 19/08 revisa isso:** a decisão de destino É humana e É valiosa (PCP e setores decidem por fatores que nenhum sistema enxerga hoje — máquina quebrada, faltas, estoque). O que permanece da visão original:

- **Um clique = um evento** continua valendo para o REGISTRO: mover o card é o gesto único, e todo o resto (fechar timer, abrir fila do próximo setor, contabilizar, notificar) é consequência automática. A atestação de qualidade (D-09) entra nesse mesmo gesto.
- A automação do DESTINO fica para o futuro, quando os padrões estiverem melhor definidos — e será possível via **API aberta** (D-03), sem mudar o núcleo.
- Automatizamos as **consequências**, não as **decisões**.

## O que a plataforma é

Uma **réplica funcional do ClickUp**, sob medida, com:

- Kanban por setor com **timer automático por card por etapa** (fila + execução, ver D-02)
- **Qualidade em 3 estados com dupla atestação** em toda transição (D-09)
- **Produtividade por usuário**: quem move/executa é contabilizado (alavancagem operacional — D-04)
- **Perfis e permissões configuráveis**: operador vê o simples, líder vê o completo do setor, admin vê tudo
- **Dashboards** de produtividade e qualidade (setor, usuário, item, tempo parado) com **visualizações personalizadas salvas**
- **Controle de tarefas** com delegação aleatória ou direta
- **API aberta** para o n8n orquestrar integrações (Tiny → plataforma, plataforma → ClickUp ROTAS…)
- **Painel admin completo**
- Fase 2: **módulo de estoque** nativo (D-07)

## Stack, papéis e método de trabalho

| Item | Definição |
|---|---|
| Front | **React**, com **design system próprio documentado** desde o dia 1 (cada implementação nova segue o padrão — inclui regras de paginação, densidade, componentes) |
| Banco | **Mesmo Supabase da fábrica** (D-08) — a plataforma nasce sobre o banco que já recebe pedidos do Tiny via n8n (P15) |
| Integrações | **n8n como intermediador** universal, consumindo a API aberta da plataforma |
| Quem ideia/arquiteta | Cowork (estas notas são a memória) |
| Quem coda | **Exclusivamente o Claude Code** — em **sessões separadas por ordem de implementação** (D-10), cada uma com demanda própria em `Demandas/`, acompanhada pelo dono |
| Conduta do Claude Code | [[CLAUDE - Regras do Claude Code (repo)]] — copiar como `CLAUDE.md` para a raiz do repositório na Sessão 01 |

## Escopo do lançamento (D-05)

**Produção primeiro**: PCP → setores → estoque/expedição. A logística (ROTAS) continua no ClickUp até a plataforma amadurecer; o n8n faz a ponte entre os dois mundos durante a transição — inclusive preservando a automação em produção ROTAS "entregue" → Tiny.

## Ver também

[[PLT - Requisitos]] · [[PLT - Decisoes de Produto]] · [[PLT - Perguntas em Aberto]] · [[000 - ORDEM DAS SESSOES]] · [[FAB - Processo Alvo - Um Clique Um Evento]] · [[FAB - Estrutura de Producao (Trello e ClickUp)]] · [[SUPA - Esquema do Banco]] · [[001 - HANDOFF - Pesquisa e Ideias de Plataformas]]
