---
titulo: Plataforma — Requisitos
tipo: requisitos
data: 2026-08-19
atualizado: 2026-10-01
tags: [plataforma, requisitos, backlog]
---

# 📋 PLT — Requisitos da Plataforma

> [!abstract] Como usar
> O catálogo vivo de requisitos, registrado a partir da idealização do dono em 19/08/2026. Status: `💡 registrado` → `🔍 refinado` (debatido e detalhado) → `📐 especificado` (coberto por uma SESSAO-NN em `Demandas/`) → `✅ entregue` · `⏸️ adiado`. Nenhum requisito vira código sem passar por refinamento — as dúvidas de cada um estão em [[PLT - Perguntas em Aberto]].

## Núcleo — Kanban e fluxo

| ID | Requisito | Status |
|---|---|---|
| RF-01 | Kanban estilo ClickUp: quadros, etapas (colunas), cards, movimentação drag-and-drop | 💡 registrado |
| RF-02 | Card híbrido: pedido no PCP → cards por unidade nos setores → reagrupamento na expedição (D-01) | 💡 registrado · ↪️ D-63 (28/09): frete/entrega não vira unidade nem conta para o pedido completo (regra única: a descrição); o resto nasce no PCP e o PCP escolhe o lugar; pedido sem nada a produzir vai direto para Pedidos em aguardo |
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
| RF-115 | Conferência diária com o Tiny (D-50): às 3h relê a busca do Tiny dos últimos 60 dias + os pedidos não terminados, pelo fluxo de carga do n8n acordado pelo banco só com trabalho; observações acompanham o Tiny, o resto "edição edita, apagar não apaga"; grava só o que mudou; uma linha por rodada no log (relidos, diferentes, quais e o quê); pedido vivo nunca avisado entra no PCP (D-96) | ✅ entregue (SESSAO-29 — migration 49) |
| RF-116 | Cliente pelo cadastro do Tiny (D-98): número do cadastro → CPF → o cliente que o pedido já tem → nome+fone; contato renomeado não duplica cliente; CPF nunca colide; nome sem código HTML (D-97) | ✅ entregue (SESSAO-29 — migration 49) · o número do cadastro no aviso de venda depende do dono colar a mudança no fluxo de vendas do n8n |

## Admin e estoque

| ID | Requisito | Status |
|---|---|---|
| RF-60 | Painel admin COMPLETO e bem estruturado (usuários, setores, etapas, permissões, automações, API keys) | 💡 registrado |
| RF-117 | Auditoria no Painel admin (D-95): a trilha de tudo (entradas/saídas, telas, movimentações, execuções, qualidade, estoque, ROTAS, tarefas, cadastros, chat sem mensagens) com quem, quando, onde, o quê e porquê; filtros e páginas no servidor; tarefa privada fora; aba das conferências com o Tiny (e, no futuro, os erros do n8n) | ✅ entregue (SESSAO-29 — migration 50 + tela) |
| RF-70 | Módulo de estoque (fase 2 — D-07): peças, produtos montados para venda/despacho, reposição | ✅ entregue (SESSAO-25) — acabados + matéria-prima/insumos; o estoque de PEÇA com plano de corte é o próximo passo (D-57) |
| RF-71 | Saldo do Tiny da fábrica dentro da plataforma: leitura derivada do último aviso de estoque de cada produto (webhook ou carga inicial), CNPJ conferido, sem tabela nova (D-55) | ✅ entregue (SESSAO-25) |
| RF-72 | Disponível = saldo lido − itens de pedidos da loja ainda abertos (sem personalizado, sem cancelado, por SKU); nunca negativo na tela — negativo vira "necessidade extrema" (D-53/D-55) | ✅ entregue (SESSAO-25) — ↩️ 28/09 (D-70): vale só para insumos; nos acabados o número é a contagem da logística (RF-100) |
| RF-73 | Peça pronta COM pedido = reservada (SKU + pedido); SEM pedido = livre; nunca somadas ao Tiny (D-54/D-56) | ✅ entregue (SESSAO-25) |
| RF-74 | Abaixo do mínimo do Tiny, o estoque gera no PCP o card de REPOSIÇÃO (um ciclo vivo por produto); o PCP libera as unidades ou "Não produzir"; pronta, a peça fica livre no estoque (D-54) | ✅ entregue (SESSAO-25) — geração automática ligada à parte, com o OK do dono |
| RF-75 | O ESTOQUE só recebe peça 🟢 — regra no banco e nas telas de mover/concluir/resolver (D-54) | ✅ entregue (SESSAO-25) |
| RF-76 | Tela de Estoque em abas (acabados · matéria-prima e insumos · sugestão de mínimo top 20 com rank), paginada no servidor, com busca e sinal por ícone + texto (D-57) | ✅ entregue (SESSAO-25) — ↪️ 28/09: abas Top 20+ · insumos · Configurações (RF-101/RF-102) |
| RF-100 | O número dos acabados é a CONTAGEM da logística (D-70): cadastrar produto ao estoque (entrada), baixa (sai a mais antiga) e contagem (acerta a diferença) — peças livres no ESTOQUE por evento, gate da logística/admin, trilha; a peça cadastrada entra na sugestão do PCP na liberação | ✅ entregue (ajuste de 28/09) |
| RF-101 | Top 20+ (D-71): a tela abre pelos 20 mais vendidos dos 90 dias (rank), depois o que tem estoque; o resto em "Ver os outros produtos" e na busca pelo catálogo; paginado no servidor | ✅ entregue (ajuste de 28/09) |
| RF-102 | Configurações do estoque (D-72): capacidade do galpão, mínimo por produto editável na plataforma (vazio = o do Tiny), sugestão de mínimo que cabe no galpão (encolhe proporcional, rank preservado), "usar" por linha e "usar todas" | ✅ entregue (ajuste de 28/09) |
| RF-103 | Foto de cada produto (D-73): capa na biblioteca por SKU, reduzida no aparelho; só logística/admin cadastram; aparece em destaque no cartão e ampliada no detalhe | ✅ entregue (ajuste de 28/09) |
| RF-104 | Estoque enxuto (D-74): "i" com balão no lugar do texto, abas em quadrados no canto superior direito, cartão com a foto em destaque e valores menores; peças e referência do Tiny no detalhe | ✅ entregue (ajuste de 28/09) |
| RF-105 | Tiny → plataforma (D-76): cada aviso de estoque (fábrica ou loja, pelo SKU) põe o produto numa fila; a leitura do saldo SOMADO das duas empresas sobe a plataforma quando o Tiny está acima (livres + reservadas); abaixo, nada; com o mínimo coberto, a reposição ainda no PCP sem nada liberado é arquivada; releitura de todos às 04:00 | ✅ entregue (ajuste de 30/09) |
| RF-106 | Plataforma → Tiny (D-77): entrada/baixa/contagem, arquivar peça livre, chegada/saída do ESTOQUE, peça livre usada em pedido e PCP que manda produzir a unidade reservada deixam o Tiny com as peças livres (balanço no depósito Fábrica da loja; sem ele, Geral da fábrica); fila por produto, 5 falhas → para e aparece em Configurações | ✅ entregue (ajuste de 30/09) |
| RF-107 | Venda reserva a peça (D-78): pedido novo com peça pronta reserva na hora; o PCP vê a peça marcada e decide (usar → aguardo; produzir → a peça volta e o Tiny recebe); cancelado desfaz; faturado em diante consome; contagem física conta as reservadas | ✅ entregue (ajuste de 30/09) |
| RF-108 | Chave e situação do sincronismo (D-79/D-80): Configurações do Estoque → Tiny — ↪️ desde a rodada do dono de 30/09, **Painel admin → Estoque** (ligado desde, fila, última leitura, parados com o erro, últimos ajustes); só o admin liga (copia o Tiny uma vez) e desliga; um fluxo único no n8n para o Tiny da fábrica · ↪️ 30/09: + **a lista das reservas presas no Tiny** (por móvel, o que o Tiny reserva × os pedidos abertos — o que a equipe limpa lá; paginada no servidor) | ✅ entregue (ajuste de 30/09; ligado 30/09 01:30; a lista na mesma manhã — migration 46) |
| RF-109 | Foto do produto acompanha o Tiny (D-82): produto novo com foto no Tiny, ou foto principal trocada no Tiny, ganha a cópia na plataforma sozinho (reduzida, fundo branco, cópia antiga fora da biblioteca); foto da câmera nunca é trocada; foto apagada no Tiny fica a última; o relógio do banco só chama a função com foto para copiar; falha espera 24 h e fica no histórico | ✅ entregue (ajuste de 30/09 — migration 44 + função `fotos-tiny`, ligado) |
| RF-110 | Top X (D-83): configurável de 1 a 50 na tela do Estoque (logística/admin, valor único, com trilha), é o tamanho da página (1ª = 1º ao Xº) e a régua do mínimo — só o Top X tem mínimo e pede reposição; a lista é UMA pelo ranking (o "ver os outros" morreu); a capacidade do galpão saiu de uso; o cartão Galpão virou seis números (móveis em estoque · insumos por unidade · insumos por m² · prontos reservados · peças em produção · móveis em produção) | ✅ entregue (Ajuste Estoque 2, 30/09 — migration 45 aplicada; publicado) |
| RF-111 | Mínimo automático por dias úteis (D-84): sugestão = vendidos 90 d (com o corte) ÷ dias úteis de venda (loja seg–sáb) × 6 × cobertura (1–8 semanas), teto no fim; o mínimo acompanha sozinho (recalcula nas trocas + 1×/dia), editar trava, "voltar ao automático" solta; corte de pedido fora do comum no Painel admin (padrão 10) tira a linha do ranking E da sugestão, com aviso no cartão | ✅ entregue (Ajuste Estoque 2, 30/09 — migration 45 aplicada; publicado) |
| RF-112 | Filtro e cartão novos do Estoque (D-86): filtro de 4 posições no topo (Todos · Necessidade de produção · Reservados para produção · Com estoque), paginado no servidor; cartão com em estoque em destaque, reservados p/ produção (tudo que está em produção), reservados em venda (um número: galpão + aguardo) e a bolinha vermelha que abre a decisão do pedido no PCP; sem os selos "Sem estoque"/"Faltam N" | ✅ entregue (Ajuste Estoque 2, 30/09 — migration 45 aplicada; publicado) |
| RF-113 | Vencimento e liga/desliga da reposição (D-85/D-87): reposição parada 2 dias úteis da fábrica (seg–sex) no PCP sai por evento (Sistema assina; parcial vence só a parte parada; a necessidade volta sem exigir movimento); liga/desliga no Painel admin agenda/desagenda o job (desligada = nada roda); desligada, o cartão em necessidade tem o ícone vermelho de "Lançar para produção" (autor + trilha); entregue desligada | ✅ entregue (Ajuste Estoque 2, 30/09 — migration 45 aplicada; publicado) |
| RF-114 | PCP em três abas (D-88): Reabastecimento (as reposições, na hora) · Pedidos aguardando liberação (só pedidos, com o selo verde "N peças no estoque" quando o galpão atende — migration 48) · Todos os pedidos (lista completa com busca, bolinha de cor da situação do Tiny, entregue mostra tudo liberado, olhinho abre o detalhe de produção que busca ao abrir e esquece ao fechar); Cancelados virou tela da Logística; paginação por rolagem; Top X e o quadro do Tiny no Painel admin → Estoque (D-89) | ✅ entregue (Ajuste Estoque 2, 30/09 — migrations 47/48 aplicadas; publicado) |
| RF-87 | Pedidos em aguardo é o LUGAR da peça pronta de pedido (D-58), com as abas "Pedidos" e "Produtos reservados" — paginadas no servidor, contadores de uma porta só (batem por construção); o painel conta "concluídas" só a chegada vinda da produção | ✅ entregue (SESSAO-24) |
| RF-88 | Cancelamento em 3 estágios (D-61): no PCP → aba Cancelados do PCP (paginada, sob demanda, para sempre); em produção → etiqueta "Pedido cancelado" e conclui para o ESTOQUE sem dono; pronto → vai sozinho ao ESTOQUE sem dono (produto pelo SKU) | ✅ entregue (SESSAO-24) |
| RF-89 | Sugestão do estoque na liberação (D-62): "peça igual" (SKU; personalizado = SKU + descrição idêntica; sem SKU = descrição), desmarcada por padrão; PCP/logística e admin aceitam; aceitar faz a unidade nascer em Pedidos em aguardo | ✅ entregue (SESSAO-24) |

## Comunicação interna (chat)

| ID | Requisito | Status |
|---|---|---|
| RF-90 | Chat interno com duas portas: `Início → Chat` (lista à esquerda, conversa à direita; no celular uma coisa por vez) e o balão arrastável em toda tela logada (fora do `/tablet`), com o badge de não lidas e posição guardada por pessoa no aparelho (D-65) | ✅ entregue (SESSAO-26) |
| RF-91 | Canais de grupo (só líder/admin criam; quem cria administra), particulares 1:1 e Avisos gerais (todos leem; o admin escreve e define quem mais escreve) (D-65) | ✅ entregue (SESSAO-26) |
| RF-92 | Cada um lê só as conversas de que participa — RLS por participação e canal de websocket privado; nem admin lê conversa alheia, nem pela API (D-65) | ✅ entregue (SESSAO-26) |
| RF-93 | Comunicação por websocket (Broadcast do banco, canal privado); leitura só por página — 5 conversas e 10 mensagens, a próxima ao rolar; sem polling (D-67) | ✅ entregue (SESSAO-26) |
| RF-94 | Data de nascimento no cadastro (própria no Meu Perfil, qualquer uma pelo admin) e parabéns automático nos Avisos gerais às 08:00 de Natal (D-66) | ✅ entregue (SESSAO-26) |
| RF-95 | Dados sensíveis do cadastro (CPF, PIN, convite, data de nascimento) fora da API — leitura por coluna em `plt_usuarios` (D-68) | ✅ entregue (SESSAO-26) |

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
| RNF-08 | **O banco espelha o Tiny em até 24h** (P17/D-50): o que o aviso de venda não traz (marcador sozinho, contato renomeado, campo apagado, pedido que nunca chegou) é corrigido pela conferência da madrugada, e a divergência vira número visível (Auditoria) | ✅ entregue (SESSAO-29) |

## Ver também

[[PLT - Visao Geral]] · [[PLT - Decisoes de Produto]] · [[PLT - Perguntas em Aberto]] · [[000 - ORDEM DAS SESSOES]]
