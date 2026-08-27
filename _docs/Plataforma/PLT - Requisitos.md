---
titulo: Plataforma — Requisitos
tipo: requisitos
data: 2026-08-19
atualizado: 2026-08-24
tags: [plataforma, requisitos, backlog]
---

# 📋 PLT — Requisitos da Plataforma

> [!abstract] Como usar
> O catálogo vivo de requisitos, registrado a partir da idealização do dono em 19/08/2026. Status: `💡 registrado` → `🔍 refinado` (debatido e detalhado) → `📐 especificado` (coberto por uma SESSAO-NN em `Demandas/`) → `✅ entregue` · `⏸️ adiado`. Nenhum requisito vira código sem passar por refinamento — as dúvidas de cada um estão em [[PLT - Perguntas em Aberto]].

## Núcleo — Kanban e fluxo

| ID | Requisito | Status |
|---|---|---|
| RF-01 | Kanban estilo ClickUp: quadros, etapas (colunas), cards, movimentação drag-and-drop | 💡 registrado |
| RF-02 | Card híbrido: pedido no PCP → cards por unidade nos setores → reagrupamento na expedição (D-01) | 💡 registrado |
| RF-03 | Entrada automática de pedido: pedido cadastrado no Tiny cria o card no PCP (via n8n + API) | 💡 registrado |
| RF-04 | Movimentação manual entre etapas; destino decidido por quem finaliza (D-03) | 💡 registrado |
| RF-05 | Estados dentro da etapa: na fila → iniciado → finalizado (D-02) | 💡 registrado |
| RF-06 | Automações internas fáceis de configurar, estilo ClickUp ("quando X acontecer, faça Y") — sem depender de dev | 💡 registrado |
| RF-07 | Estrutura em 2 níveis como o ClickUp: setores contendo etapas internas; admin cadastra novos setores e novas etapas dentro de cada setor (D-12) | 💡 registrado |
| RF-08 | Toda etapa interna cadastrada nasce com **timer próprio automático** — card que chega nela conta tempo ali, sem configuração extra; sistema NÃO impõe etapas padrão (D-14) | 💡 registrado |
| RF-09 | Entrada única pelo PCP; saídas terminais ESTOQUE (parado) ou ROTAS (entregue) (D-13) | 💡 registrado |

## Tempo e produtividade (a razão de existir)

| ID | Requisito | Status |
|---|---|---|
| RF-10 | Timer automático por card por etapa: tempo de fila + tempo de execução, sem gesto extra além do clique de mover/iniciar/finalizar (D-02) | 💡 registrado |
| RF-11 | Contabilização por movimentação de usuário: usuário moveu o card para a etapa → +1 para ele e abre o timer daquela etapa | 💡 registrado |
| RF-12 | Histórico de eventos imutável e auditável (mantido mesmo com bonificação adiada — D-04) | 💡 registrado |
| RF-13 | Regras anti-manipulação, pesos por produto, contestação e ranking de bonificação | ⏸️ adiado (D-04 revisada) |
| RF-14 | Tempo parado no estoque como métrica de primeira classe | 💡 registrado |

## Qualidade nas transições (D-09)

| ID | Requisito | Status |
|---|---|---|
| RF-80 | Ao mover card para outro setor, marcação **obrigatória** de estado: 🟢 perfeito · 🟡 atenção · 🔴 danificado | 💡 registrado |
| RF-81 | Ao receber, **antes de iniciar qualquer etapa**: "O setor X marcou como Y — você concorda?" com registro do parecer do recebedor | 💡 registrado |
| RF-82 | Divergência: recebedor define novo estado → notifica líder → peça em **pausa momentânea** até o líder resolver | 💡 registrado |
| RF-83 | Concordância com 🔴: card vai para DANIFICADO | 💡 registrado |
| RF-84 | Notificação automática a líder/admin em divergência, 🟡 ou 🔴 — com o relato exato do que aconteceu (D-09 complemento 24/08; substitui a escolha manual) | 💡 registrado |
| RF-86 | Movimentação via API não exige estado de qualidade — atestação é gesto exclusivamente humano (D-09 complemento) | 💡 registrado |
| RF-85 | Toda decisão de qualidade entre etapas reflete na dashboard (qualidade por setor, divergências, origem dos danos) | 💡 registrado |

## Pessoas, perfis e permissões

| ID | Requisito | Status |
|---|---|---|
| RF-20 | Login por cadastro de usuário; configurações internas só por admin/líder | 💡 registrado |
| RF-21 | Convite para setor e gerenciamento de permissões pelo admin/líder | 💡 registrado |
| RF-22 | Visualização por setor — perfil configurável (operador vê a fila do seu setor) | 💡 registrado |
| RF-23 | Visualização por usuário — perfil configurável | 💡 registrado |
| RF-24 | Três níveis de navegação: simples (setor) · completa (líder) · total (admin geral) | 💡 registrado |
| RF-25 | Operação em tablet/PC fixo por setor com identificação rápida + celular pessoal (D-06) | 💡 registrado |

## Dashboards e visualizações

| ID | Requisito | Status |
|---|---|---|
| RF-30 | Dashboard de produtividade: por setor, por usuário, por item produzido, por tempo parado no estoque | 💡 registrado |
| RF-31 | Comparativo fila vs execução por etapa, com soma dos dois (D-02) | 💡 registrado |
| RF-32 | Painel personalizável: o usuário escolhe itens e período de análise | 💡 registrado |
| RF-33 | Visualizações personalizadas salvas no banco, com troca fácil entre elas | 💡 registrado |

## Tarefas e delegação

| ID | Requisito | Status |
|---|---|---|
| RF-40 | Meus afazeres / afazeres do time | 💡 registrado |
| RF-41 | Delegação aleatória: item entra no setor → sorteia responsável no time | 💡 registrado |
| RF-42 | Delegação direta: líder/admin define quem executa | 💡 registrado |
| RF-43 | Modo de delegação personalizável por setor | 💡 registrado |

## API e integrações

| ID | Requisito | Status |
|---|---|---|
| RF-50 | API aberta: criar, editar, mover e excluir cards em qualquer etapa (D-03) | 💡 registrado |
| RF-51 | n8n como intermediador principal (Tiny → plataforma; plataforma → ClickUp ROTAS na transição — D-05) | 💡 registrado |
| RF-52 | Webhooks de saída: eventos da plataforma notificam sistemas externos | 💡 registrado |

## Admin e estoque

| ID | Requisito | Status |
|---|---|---|
| RF-60 | Painel admin COMPLETO e bem estruturado (usuários, setores, etapas, permissões, automações, API keys) | 💡 registrado |
| RF-70 | Módulo de estoque (fase 2 — D-07): peças, produtos montados para venda/despacho, reposição | 💡 registrado |

## Requisitos não-funcionais

| ID | Requisito | Status |
|---|---|---|
| RNF-01 | React + design system próprio documentado; toda implementação nova segue o padrão | 💡 registrado |
| RNF-02 | Paginação obrigatória em telas com muitos dados — regra do doc de estilização | 💡 registrado |
| RNF-03 | Banco: mesmo Supabase da fábrica (D-08) | 💡 registrado |
| RNF-04 | Quem coda: exclusivamente o Claude Code, em sessões ordenadas (D-10), sob as regras de [[CLAUDE - Regras do Claude Code (repo)]] | 💡 registrado |
| RNF-05 | Eventos append-only: movimentação nunca é sobrescrita, só acrescentada (D-04) | 💡 registrado |
| RNF-06 | Plataforma publicada numa URL estável, acessível dos tablets/celulares do galpão, com deploy repetível (D-23 — SESSAO-14) | 💡 registrado |

## Ver também

[[PLT - Visao Geral]] · [[PLT - Decisoes de Produto]] · [[PLT - Perguntas em Aberto]] · [[000 - ORDEM DAS SESSOES]]
