---
titulo: Plataforma — Requisitos
tipo: requisitos
data: 2026-08-19
atualizado: 2026-09-27
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
| RF-09 | Entrada única pelo PCP; saídas terminais ESTOQUE (parado) ou ROTAS (entregue) (D-13) | ↪️ D-58 (27/09): três fins de linha — Pedidos em aguardo (peça de pedido), ESTOQUE (só sem dono), ROTAS (pedido lançado) |
| RF-77 | Quadros de produção só por arrasto (D-59): soltar na etapa de início inicia o tempo de quem arrastou (limite 1 por pessoa e parecer seguem valendo); soltar em etapa que encaminha leva ao setor dela com a marcação 🟢🟡🔴; outra etapa só move; modo tablet igual, com PIN ao soltar | ✅ entregue (SESSAO-24) |
| RF-78 | Rotas das etapas (D-60): etapa com nome de setor e CONCLUÍDO levam ao setor configurado; editável em Setores e etapas ("manda para"); etapa nova com nome de setor já nasce com a rota | ✅ entregue (SESSAO-24) |
| RF-79 | "Concluir produção" só na LIMPEZA E EMBALAGEM (D-59): peça de pedido vivo → Pedidos em aguardo; sem pedido ou de pedido cancelado → ESTOQUE sem dono; só 🟢 | ✅ entregue (SESSAO-24) |

## Tempo e produtividade (a razão de existir)

| ID | Requisito | Status |
|---|---|---|
| RF-10 | Timer automático por card por etapa: tempo de fila + tempo de execução, sem gesto extra além do clique de mover/iniciar/finalizar (D-02) | 💡 registrado |
| RF-11 | Contabilização por movimentação de usuário: usuário moveu o card para a etapa → +1 para ele e abre o timer daquela etapa | 💡 registrado |
| RF-12 | Histórico de eventos imutável e auditável (mantido mesmo com bonificação adiada — D-04) | 💡 registrado |
| RF-13 | Regras anti-manipulação, pesos por produto, contestação e ranking de bonificação | ⏸️ adiado (D-04 revisada) |
| RF-14 | Tempo parado no estoque como métrica de primeira classe | 💡 registrado |
| RF-15 | Execução um por vez: limite padrão de 1 card em execução por pessoa por setor, configurável por líder do setor/admin; líder pode **pausar** uma execução (urgência) — pausado não conta tempo nem ocupa o limite, e retomar passa pela mesma trava (D-48) | ✅ entregue (SESSAO-22) |
| RF-16 | Tempo em PCP é do PEDIDO: da entrada no PCP até a liberação completa; tempo de aguardo do pedido completo até o lançamento — ambos derivados de eventos, insumo futuro do cálculo de tempo de entrega (D-48) | ✅ entregue (SESSAO-22) |

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
| RF-26 | Arquivar usuário (tudo fica no nome dele; pendências realocadas ao líder direto; reversível) e excluir de fato (só cadastro sem história — a história não se apaga); só admin (D-49) | ✅ entregue (SESSAO-22) |
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
| RF-44 | Meu Painel em três filas: Delegados a mim (tarefas + cards) · Meus afazeres · Fila de prioridade em ordem de cadastro, reordenável e persistente por usuário — só exibição (D-51) | ✅ entregue (SESSAO-23) |
| RF-45 | Subtarefas na mesma tabela (`tarefa_mae_id`), até dois níveis, com concluir/reabrir e contador na mãe; tudo logado (D-51) | ✅ entregue (SESSAO-23) |
| RF-46 | Tarefa pessoal privada por padrão — invisível a líder/admin até o dono torná-la pública (criação/edição); garantido por RLS, não só na UI (D-51) | ✅ entregue (SESSAO-23) |
| RF-47 | Pendência de parecer de qualidade vira tarefa do "Sistema" no setor recebedor; o parecer a conclui sozinho; fora da fila de prioridade, com aviso no sino (D-51) | ✅ entregue (SESSAO-23) |
| RF-48 | Painel pessoal "Meu desempenho": tempo em afazeres por dia e por tarefa + KPIs, tudo gateado ao próprio no banco (D-51) | ✅ entregue (SESSAO-23) |

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
| RF-70 | Módulo de estoque (fase 2 — D-07): peças, produtos montados para venda/despacho, reposição | ✅ entregue (SESSAO-25) — acabados + matéria-prima/insumos; o estoque de PEÇA com plano de corte é o próximo passo (D-57) |
| RF-71 | Saldo do Tiny da fábrica dentro da plataforma: leitura derivada do último aviso de estoque de cada produto (webhook ou carga inicial), CNPJ conferido, sem tabela nova (D-55) | ✅ entregue (SESSAO-25) |
| RF-72 | Disponível = saldo lido − itens de pedidos da loja ainda abertos (sem personalizado, sem cancelado, por SKU); nunca negativo na tela — negativo vira "necessidade extrema" (D-53/D-55) | ✅ entregue (SESSAO-25) |
| RF-73 | Peça pronta COM pedido = reservada (SKU + pedido); SEM pedido = livre; nunca somadas ao Tiny (D-54/D-56) | ✅ entregue (SESSAO-25) |
| RF-74 | Abaixo do mínimo do Tiny, o estoque gera no PCP o card de REPOSIÇÃO (um ciclo vivo por produto); o PCP libera as unidades ou "Não produzir"; pronta, a peça fica livre no estoque (D-54) | ✅ entregue (SESSAO-25) — geração automática ligada à parte, com o OK do dono |
| RF-75 | O ESTOQUE só recebe peça 🟢 — regra no banco e nas telas de mover/concluir/resolver (D-54) | ✅ entregue (SESSAO-25) |
| RF-76 | Tela de Estoque em abas (acabados · matéria-prima e insumos · sugestão de mínimo top 20 com rank), paginada no servidor, com busca e sinal por ícone + texto (D-57) | ✅ entregue (SESSAO-25) |
| RF-87 | Pedidos em aguardo é o LUGAR da peça pronta de pedido (D-58), com as abas "Pedidos" e "Produtos reservados" — paginadas no servidor, contadores de uma porta só (batem por construção); o painel conta "concluídas" só a chegada vinda da produção | ✅ entregue (SESSAO-24) |
| RF-88 | Cancelamento em 3 estágios (D-61): no PCP → aba Cancelados do PCP (paginada, sob demanda, para sempre); em produção → etiqueta "Pedido cancelado" e conclui para o ESTOQUE sem dono; pronto → vai sozinho ao ESTOQUE sem dono (produto pelo SKU) | ✅ entregue (SESSAO-24) |
| RF-89 | Sugestão do estoque na liberação (D-62): "peça igual" (SKU; personalizado = SKU + descrição idêntica; sem SKU = descrição), desmarcada por padrão; PCP/logística e admin aceitam; aceitar faz a unidade nascer em Pedidos em aguardo | ✅ entregue (SESSAO-24) |

## Requisitos não-funcionais

| ID | Requisito | Status |
|---|---|---|
| RNF-01 | React + design system próprio documentado; toda implementação nova segue o padrão | 💡 registrado |
| RNF-02 | Paginação obrigatória em telas com muitos dados — regra do doc de estilização | 💡 registrado |
| RNF-03 | Banco: mesmo Supabase da fábrica (D-08) | 💡 registrado |
| RNF-04 | Quem coda: exclusivamente o Claude Code, em sessões ordenadas (D-10), sob as regras de [[CLAUDE - Regras do Claude Code (repo)]] | 💡 registrado |
| RNF-05 | Eventos append-only: movimentação nunca é sobrescrita, só acrescentada (D-04) | 💡 registrado |
| RNF-06 | Plataforma publicada numa URL estável, acessível dos tablets/celulares do galpão, com deploy repetível (D-23 — SESSAO-08) | 💡 registrado |
| RNF-07 | **Lei de requisição (pedido do dono, SESSAO-22): cada tela requisita apenas o que mostra** — paginação no servidor, total por agregado barato, "Ver mais" busca só a próxima página; baixar o conjunto inteiro para filtrar no cliente é proibido (regra 17 do CLAUDE + Modelo de Sistema) | ✅ entregue (SESSAO-22) |

## Ver também

[[PLT - Visao Geral]] · [[PLT - Decisoes de Produto]] · [[PLT - Perguntas em Aberto]] · [[000 - ORDEM DAS SESSOES]]
