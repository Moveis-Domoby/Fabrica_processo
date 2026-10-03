---
titulo: Mapa do Cofre — Domoby (Fábrica + Comercial)
tipo: MOC
atualizado: 2026-10-03
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
- [[003 - PLANO - Integracao Completa Tiny da Fabrica]] — 🆕 27/09: o caminho para a fábrica no nível de **peça e insumo** (estrutura/BOM, estoque com movimento, plano de corte para CNC/SECC) e o que a API do Tiny oferece de verdade (v2 × v3)
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

> O pós-venda da loja dentro da plataforma: espelho das vendas do Tiny, taxa de recompra/LTV/sazonalidade, campanhas de reativação por WhatsApp (DataCrazy) com ROI. Banco na fábrica desde a SESSAO-19; front em `/comercial/*` desde a SESSAO-20; **cutover feito em 22/09 (SESSAO-21)**: crons e renovador do token só na fábrica, projeto antigo em quarentena — DataCrazy repontado pelo dono e trava do disparo aberta em 23/09.

Modelos mentais (leia primeiro):
- [[PLT - Comercial - Fluxo do Dado]] — do pedido no Tiny até o pixel na tela (estado pós-união)
- [[PLT - Comercial - Identidade do Cliente]] — **a decisão mais consequente do módulo inteiro**
- [[PLT - Comercial - Dicionario de Metricas]] — o que cada número significa ("recorrente" = vida ≥ 2)
- [[PLT - Comercial - Maquina de Estados do Disparo]] — o ciclo de vida de uma campanha + a trava de 3 camadas

Telas, integração e dívidas:
- [[PLT - Comercial - Telas]] — as telas de `/comercial/*`: hooks, RPCs, pegadinhas
- [[PLT - Comercial - Integracao DataCrazy]] — o CRM de disparo: gatilho de ida, webhook de volta, o que muda no cutover
- [[PLT - Comercial - Debito Tecnico]] — índice VIVO de problemas conhecidos (IDs DT-* originais; nunca apagar item)
- [[PLT - Comercial - Legado e Cutover]] — o guia (e o registro) da SESSAO-21: o que rodava no repo/Supabase antigos e para onde cada coisa foi

> [!note] 🏁 Nota de encerramento do Painel de Recompra — para onde tudo foi (22/09/2026)
> **Banco:** as 6 tabelas do disparo e o cofre do token (`tiny_auth`) vivem no Supabase da fábrica (`axnzldwgwsmepukdiljx`); `vendas_marketing` é VIEW sobre `pedidos` ([[SUPA - Comercial - Dominio de Dados]]). **Rotinas:** os 4 crons (renovador do token + 3 do disparo) rodam na fábrica ([[SUPA - Comercial - Cron e Rotinas]]); os 2 syncs do Tiny morreram (a fábrica recebe pedidos pelo webhook do n8n). **Functions:** as 6 úteis na fábrica ([[SUPA - Comercial - Edge Functions]]). **Front:** `/comercial/*` na plataforma. **Conhecimento:** as notas `PLT - Comercial -*` e `SUPA - Comercial -*` deste cofre (o `_Docs` da loja foi fundido aqui em 17/09). **O que sobrou lá:** projeto Supabase `kfkcumjepnxnnzyvmxfo` e o front antigo em **quarentena** (espelho congelado desde 22/09 20:28 UTC) até o dono marcar a data de backup final → pausar → excluir. Handoff: [[handoff_2026_09_22_sessao21_cutover]].

## 🔌 Automações e migração n8n (pasta `Fabrica n8n/`)

- [[N8N - Visao Geral da Migracao]] — **comece por aqui**: as 7 automações, a arquitetura, o método
- [[N8N - Infraestrutura VPS]] — servidor, Docker, credenciais, webhooks do Tiny
- [[N8N - Workflow Tiny para Planilha]] — migração 1, nó a nó
- [[N8N - Codigo Mapear 49 Colunas]] — o código central, verificado contra 1.982 pedidos
- [[N8N - ROTAS ClickUp]] — migração 2, o card de entrega
- [[N8N - PCP Trello e ClickUp]] — migrações 3 e 4, o (k/n) e a causa da duplicação
- [[N8N - Incidente Credencial Google]] — a queda de 11/08 e a lição sobre OAuth
- [[N8N - Cadastro de Cliente]] — migração 5: formulário do Google → contato no Tiny (aguarda publicação)
- [[N8N - Tiny Fabrica Produtos para Banco]] — **em produção desde 23/09**: produto cadastrado no Tiny da FÁBRICA entra no banco sozinho (catálogo de 487) + webhook de lançamentos de estoque capturado
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

- [[handoff_2026_10_02_sessao28_rota_calculada]] — **SESSAO-28 (02/10) — rota calculada no mapa (fecha o Bloco 5):** a linha da Programação virou a **rota pelas ruas**, da **fábrica (Rua Tancredo Neves) à fábrica**, pelo serviço gratuito de rotas (D-108), com **distância e tempo por trecho e totais** e o aviso de sugestão inicial; serviço fora do ar → linha reta tracejada com aviso. A ordem sugerida (o mais perto a partir da fábrica) pode ser **reordenada à mão e salva** (D-109), e o mapa mostra também a **rota de cada caminhão do dia** (D-110). Migration 54 (rota guardada no cache do mapa + ordem das paradas) e a função `calcular-rota` no ar com o OK do dono; aceite com a programação real de 22/09 e a rota conhecida fábrica → Midway Mall (9,5 km × 9,7 km no Google). ↪️ **Ajustes de 03/10** (o dono testou com uma carga de 18 pedidos já entregues no Tiny): abas **Programar** e **Já programadas** (por dia e caminhão, cada caminhão com a sua cor), móveis de cada pedido à vista, marcou → sobe e se arrasta, trecho aceso no mapa, tela mais leve (D-111); a busca de endereços estava bloqueada pelo serviço gratuito — consertada, com um segundo buscador gratuito (D-112).
- [[handoff_2026_10_02_sessao27_automacoes_canvas]] — **SESSAO-27 (02/10) — automações em canvas:** o dono monta no **Painel super admin → Automações** fluxos QUANDO → FAÇA num canvas próprio (arrastar, ligar, "+", zoom), com **"Se… senão"** de duas saídas; o motor roda **na hora**, no fechamento do gesto, obedece às regras de uma pessoa e nunca derruba o gesto nem a gravação do Tiny; cada disparo fica no histórico ("Trazer de volta" onde arquivou). Nasceram **Configurações** (o antigo Painel admin), o **Painel super admin** (só o dono: Automações e Auditoria), **Utilitários** (etiquetas e campos customizados, que aparecem nos cards e nos pedidos) e o seletor de tema no rodapé (D-99…D-106). Migration 51 **aplicada com o OK do dono** (integração idêntica); mesclada na `main` e **publicada no site em 02/10 (04:27 UTC)** com o OK do dono (*"Pode subir em produção"*) — avanço direto, sem mistura (com a Auditoria da S29); **a Edge Function `api` espera o OK**
- [[handoff_2026_10_01_sessao29_reconciliacao_tiny]] — **SESSAO-29 (01/10) — o banco não diverge mais do Tiny em silêncio:** **conferência diária às 3h** (os últimos 60 dias + os não terminados) pelo mesmo fluxo da carga do n8n, agora **acordado pelo banco só quando há trabalho** (o relógio de 1 em 1 minuto saiu — 1.392 execuções vazias/dia); o que muda no Tiny muda aqui, **apagar só apaga as observações**; cliente pelo cadastro do Tiny → CPF → o cliente que o pedido já tem → nome + telefone; **pedido igual não é regravado**; pedido vivo achado só pela conferência entra no PCP; nome sem código no lugar do apóstrofo (D-95…D-98). 1ª conferência real: 611 relidos, 138 diferentes → **2ª: 0**. **Escopo novo do dono: Painel admin → Auditoria** (quem, quando, onde, o quê e por quê, + as conferências com o Tiny). Migrations 49/50 **aplicadas com o OK do dono** (integração idêntica); a tela da Auditoria **espera o "pode subir" dele** para ir à `main`; o fluxo de vendas passa o número do cadastro do cliente desde 01/10 23:20 (colado e publicado pelo dono — P17 ✅); desde 01/10 à noite o Claude **lê o n8n pela API** ([[N8N - Infraestrutura VPS]])
- [[handoff_2026_09_30_ajuste_estoque_2]] — **Ajuste Estoque 2 (30/09)**: o **Top X** (1–50) vira a régua e a página do estoque (só ele tem mínimo — a capacidade do galpão saiu de uso), **mínimo automático por dias úteis de venda** (editar trava), corte de pedido fora do comum, filtro de 4 posições, cartão novo com a **bolinha vermelha** que abre a decisão no PCP, reposição parada **2 dias úteis sai sozinha**, **liga/desliga de verdade** no Painel admin → Estoque (com o Top X, o corte e o quadro do Tiny) — e, das rodadas ao vivo do dono, o **PCP em três abas** (Reabastecimento · Aguardando liberação · Todos os pedidos, com o detalhe de produção sob demanda e a bolinha de cor do status do Tiny) e **Cancelados na Logística** (D-83…D-89). Migrations 45/47/48 aplicadas, **publicado em 30/09**; entregue com a reposição automática DESLIGADA
- [[handoff_2026_09_27_sessao26_chat]] — **SESSAO-26 (Bloco 5 — rodou em paralelo com a 24)**: o chat interno — `Início → Chat` + balão arrastável com badge em toda tela logada; canais (líder/admin criam), particulares e Avisos gerais (o admin define quem escreve); aniversário automático às 08:00; **websocket privado e leitura só por página (5 conversas / 10 mensagens — D-67)**; e a correção de segurança do cadastro (CPF, PIN e convite estavam legíveis por qualquer logado — D-68/E-50). Migration 38 aplicada em 27/09; validada ao vivo e **mesclada na `main` em 28/09**
- [[handoff_2026_09_27_sessao24_producao_concluida]] — **SESSAO-24 (Bloco 5 — depois da 25, D-53)**: o dono mudou o desenho no início — **quadros só por arrasto** (soltar no início inicia o tempo; etapa com nome de setor ou CONCLUÍDO leva ao próximo setor; o único botão é **"Concluir produção", só na LIMPEZA E EMBALAGEM** — D-59/D-60), **Pedidos em aguardo virou o LUGAR** da peça pronta de pedido e o **ESTOQUE ficou só com peça sem dono** (D-58), abas "Pedidos" e "Produtos reservados", cancelamento em 3 estágios com a aba **Cancelados** do PCP (D-61) e a **sugestão do estoque** na liberação (D-62) — migration 37 aplicada e **mesclada na `main` em 27/09** (D-20)
  - ↳ [[handoff_2026_09_28_ajuste_gaveta_menu_celular]] — **ajuste (28/09), achado da F-07 da S24:** com o menu do celular FECHADO, ~38px da segunda barra ficavam na borda esquerda pegando o toque; a gaveta passou a **conter** as duas barras (rola quando não cabem) e fica invisível fechada (E-48); de quebra, com o seu OK, o menu aberto passou a ficar **por cima do balão do chat e da bolinha de execução** (E-57) — só `Layout.tsx`, sem banco; **mesclado na `main` em 28/09** (D-20)
  - ↳ [[handoff_2026_09_28_ajuste_frete_fora_da_producao]] — **ajuste (28/09), achado da F-07 da S24:** o **frete deixou de virar peça de produção** (D-63): regra única pela descrição (numa view — E-65), trava no banco, as 17 contas de peças ajustadas, pedido só de frete direto para Pedidos em aguardo; cadeira e acessório seguem nascendo no PCP (o PCP escolhe o lugar); migration 39 **aplicada com o seu OK** (integração idêntica) e o card de frete do 13215 arquivado — **mesclado na `main` em 28/09** (D-20); perguntas do Tiny respondidas em 29/09 (fica tudo como está) — nada pendente
- [[handoff_2026_09_26_sessao25_estoque]] — **SESSAO-25 (Bloco 5 — passou na frente da 24, D-53)**: o estoque completo — número do Tiny menos o vendido pela loja ainda sem sair (nunca negativo: "necessidade extrema"), reservados × livres, **card de reposição que o estoque gera no PCP** quando fica abaixo do mínimo (D-54), ESTOQUE só com peça 🟢, ID = SKU (D-56), duas telas (acabados · matéria-prima/insumos) + sugestão de mínimo top 20 (D-57), carga do saldo por workflow separado — migration 36 aplicada e mesclada na `main` em 26/09; reposição automática com o dono
  - ↳ [[handoff_2026_09_30_ajuste_fotos_tiny_automaticas]] — **ajuste (30/09), pedido do dono:** a **foto do Tiny chega sozinha** — produto novo com foto em ~20 min, foto trocada no Tiny na manhã seguinte (o Tiny não avisa mudança de produto), reduzida e com fundo branco; **a da câmera fica**, **a apagada no Tiny fica a última**; o banco confere de 5 em 5 min e **só chama a função do servidor quando há foto nova** (nada rodando à toa); o n8n não foi tocado. Migration 44 aplicada, função `fotos-tiny` publicada, ponta a ponta provado em 3 produtos (D-82)
  - ↳ [[handoff_2026_09_30_ajuste_fotos_tiny]] — **ajuste (30/09), pedido do dono:** as **fotos dos produtos vieram do Tiny** — o Tiny manda o link da foto junto com o cadastro, que já estava no banco (não foi preciso abrir o Tiny): **144 produtos, 146 fotos** copiadas para a plataforma com o dono logado (44 MB → 5,7 MB; os 18 recortes com fundo branco); e a foto passou a aparecer **inteira** (quadro quadrado, sem corte — o dono viu o móvel em pé cortado no quadro deitado); a câmera do Estoque também deixou de pintar de preto o fundo de foto recortada. Nada no banco mudou de forma; a **cópia automática** fica como próximo passo (D-81)
  - ↳ [[handoff_2026_09_28_ajuste_estoque_contagem_top20]] — **ajuste urgente (28/09), pedido do dono:** o número dos produtos prontos virou a **contagem da logística** (cadastrar ao estoque, baixa, contagem — o Tiny não avisava a saída da venda: A-25), a tela abre no **Top 20+** (os 20 mais vendidos dos 90 dias + o que tem estoque; o resto na busca), **foto de cada produto** (só logística/admin), **Configurações** com mínimo editável, **capacidade do galpão** e sugestão que cabe nela, "i" no lugar do texto e abas em quadrados no canto (D-70…D-74) — migration 40 aplicada, telas conferidas com o dono logado; **mesclado na `main` em 28/09** (D-20)
- [[handoff_2026_09_23_sessao23_meu_painel_2]] — **SESSAO-23 (Bloco 5)**: o Meu Painel 2.0 (D-51) — três filas com a Fila de prioridade reordenável por usuário, subtarefas em 2 níveis na mesma tabela, tarefa pessoal PRIVADA com "tornar pública", qualidade a atestar virou tarefa do "Sistema" (parecer conclui sozinho), "Ver todos" no sino e o painel pessoal "Meu desempenho" com portas gateadas ao próprio — migration 33 aplicada em 23/09 com permissão total do dono; validação logada + merge com o dono
- [[handoff_2026_09_22_sessao21_cutover]] — **SESSAO-21 (União 3 — o cutover)**: o renovador do token do Tiny e os 3 crons de disparo mudaram para a fábrica (renovação provada só lá), o projeto antigo entrou em quarentena, e a conferência Tiny × plataforma pedido a pedido (5.360) corrigiu 15 pedidos + 2 cadastros e expôs a causa-raiz (P17 → SESSAO-29). Pendências do dono: DataCrazy, trava do disparo, `unschedule` no antigo, data da F7 — entregue por PR
- [[handoff_2026_09_21_sessao22_filas_tempo_pausa]] — **SESSAO-22** (abre o Bloco 5): filas reais (fim da coluna "Chegada" na produção; iniciar na fila avança a etapa — D-48↪️), tempo de PCP do PEDIDO (D-48), quadros paginados 10+"Ver mais" com a lei nova "cada tela requisita só o que mostra" (regra 17/RNF-07), limite 1 por pessoa + pausa por líder com desconto de tempo, e arquivar/excluir usuário com pendências realocadas ao líder (D-49) — migrations 29–31 aplicadas, validada ao vivo e mesclada na `main` em 22/09
- [[handoff_2026_09_18_sessao16_dashboards]] — **SESSAO-16**: os dashboards de verdade (D-42) — 4 telas-filhas nos moldes dos mockups (Visão do dia estilo andon com atualização sozinha, Tempo por setor fila×execução, Pessoas com cockpit de metas e a lista detalhada, Qualidade 100% empilhado), migration 28 com 8 portas gateadas, tokens fixos fila/execução, vazamento zero em 700–2400px
  - ↳ [[handoff_2026_09_28_ajuste_painel_pcp_como_o_quadro]] — **ajuste (28/09), achado do ajuste do Frete:** a Visão do dia dizia **233 "a liberar"** e o quadro do PCP **33** — 200 já estavam "Entregue" no Tiny (o quadro esconde o encerrado desde a S23; o painel nunca acompanhou). Com o seu OK, o quadrinho do PCP passou a contar **o que o quadro mostra**: "a liberar" (reposição inclusa) e "mais antiga" (31 → 27 dias); "liberadas hoje" ficou como estava (D-75). Migration 41 **aplicada com o seu OK** (integração idêntica), conferida no banco real: painel 33 = quadro 33 — **mesclado na `main` em 29/09** (D-20)
  - ↳ [[handoff_2026_09_30_estoque_sincronizado_tiny]] — **ajuste (29–30/09), o vídeo do Guilherme:** o balanço feito no Tiny não aparecia porque o aviso da fábrica só vê o depósito Geral e a equipe olha o **multiempresa** (4 depósitos de 2 empresas). Agora as duas **conversam**: o Tiny acima **sobe a plataforma**, entrada/baixa/contagem daqui **deixam o Tiny igual** (depósito Fábrica da loja), a **venda reserva a peça** na hora e o PCP decide (D-76…D-80); **fluxo único no n8n** para o Tiny da fábrica. Migration 42 **aplicada com o seu OK** (integração idêntica), 554 verificações verdes — **ligado em 30/09 01:30** (fluxo publicado no n8n **sem relógio** — o banco chama só quando há trabalho, migration 43; cópia inicial conferida: 234 produtos, 46 peças, 0 falhas) · ↪️ 30/09 manhã: **lista das reservas presas no Tiny** em Configurações → Tiny (o conflito do 567: o disponível do Tiny é saldo − reservado, e ele guarda reserva de pedido que já saiu — 111 móveis, 814 unidades para a equipe limpar lá; migration 46)
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

**↪️ 02/10/2026 (SESSAO-28 entregue — o Bloco 5 está FECHADO):** a Programação de caminhão mostra a **rota de verdade pelas ruas**, saindo da fábrica e voltando a ela, com quilômetros e tempo de cada trecho; a ordem das paradas é sugerida pelo mais perto e qualquer um da logística ajusta à mão e salva; o mapa mostra também a rota já programada de cada caminhão. Continua sugestão — sem trânsito nem interdições (evolução paga, se um dia o dono quiser).

**↪️ 02/10/2026 (SESSAO-27 entregue):** as **automações em canvas** estão prontas — o dono monta, no Painel super admin, "quando acontecer X, faça Y" (com "Se… senão"), e elas rodam na hora, com histórico. Junto vieram Configurações, o Painel super admin (Automações + Auditoria), os Utilitários (etiquetas e campos customizados) e o seletor de tema. Banco atualizado e **site publicado em 02/10** (com a Auditoria da S29); **com o dono:** quando quiser chamar automação pelo n8n, a publicação da Edge Function. Falta a [[SESSAO-28 - Rota Calculada no Mapa]] para fechar o Bloco 5. Detalhe: [[handoff_2026_10_02_sessao27_automacoes_canvas]].

**↪️ 01/10/2026 (SESSAO-29 entregue):** a **conferência diária com o Tiny** está no ar — às 3h o banco relê os últimos 60 dias e os pedidos não terminados, corrige o que divergiu (só as observações se apagam quando apagadas no Tiny) e registra uma linha por rodada; a 1ª achou 138 diferenças e a 2ª, logo depois, **zero**. O fluxo da carga do n8n passou a ser acordado pelo banco (sem relógio à toa). Escopo novo do dono: **Painel admin → Auditoria** — na branch, à espera da revisão dele para ir ao site. **Com o dono:** o "pode subir" da Auditoria (ele já viu a tela). ✅ O fluxo de vendas do n8n passa o número do cadastro do cliente desde 01/10 23:20 (colado e publicado por ele — [[N8N - Workflow Tiny para Planilha]]) e o Claude passou a ler o n8n pela API, com uma chave que só existe no computador do dono ([[N8N - Infraestrutura VPS]]). Detalhe: [[handoff_2026_10_01_sessao29_reconciliacao_tiny]].

**↪️ 01/10/2026 (revisão das pendências com o dono):** a lista do dono foi passada a limpo em [[000 - PROXIMOS PASSOS]] — rotina da equipe saiu da lista, o que estava feito ganhou ✅ (os cards históricos do PCP foram arquivados em 08/09) e as respostas viraram as decisões **D-90…D-94** (reposição automática é escolha da operação; usuário da fábrica, do comercial e dos dois; automações só pelo admin, como laboratório; endereço do Tiny = endereço de entrega; bonificação descartada). **Próxima: [[SESSAO-29 - Reconciliacao Tiny - Pente-fino e Ultimo Pacote Vence]]**, que o dono roda em 01/10. A contagem inicial do estoque está **a confirmar** (sem registro na plataforma até 01/10 00:30).

**↪️ 30/09/2026 (Ajuste Estoque 2 entregue e publicado — na mesma madrugada do sincronismo com o Tiny e das fotos automáticas):** o estoque passou a ser governado pelo **Top X** (só os X mais vendidos têm mínimo; X é a página da lista), com **mínimo automático por dias úteis de venda** da loja (editar trava; corte de pedido fora do comum no admin), reposição parada **2 dias úteis** saindo do PCP sozinha e **liga/desliga de verdade** da automática (segue **DESLIGADA** até a contagem inicial). O **PCP virou três abas** — Reabastecimento, Pedidos aguardando liberação (com o selo de peça no estoque) e Todos os pedidos (status do Tiny com bolinha de cor, detalhe de produção sob demanda) — e **Cancelados virou tela da Logística**. Painel admin ganhou a página **Estoque** (automática, Top X, corte e o quadro do Tiny). Migrations 45/47/48 aplicadas; 621 verificações verdes; 6 rodadas de lapidação dirigidas pelo dono logado. **Com o dono:** contagem inicial, ligar (ou não) a automática, e a [[SESSAO-29 - Reconciliacao Tiny - Pente-fino e Ultimo Pacote Vence]] recomendada como próxima (os pedidos presos com "entregue no Tiny" são avisos que o Tiny não mandou — P17).

**↪️ 27/09/2026 (SESSAO-26 entregue, em paralelo com a 24 — o chat interno):** a plataforma ganhou o **chat da empresa**: `Início → Chat` (lista à esquerda, conversa à direita) e o **balão arrastável** com o número de não lidas em toda tela logada (fora do tablet). **Canais** (só líder e admin criam; quem cria administra), **particulares** e os **Avisos gerais** (todos leem; o admin escreve e escolhe quem mais escreve); no dia do aniversário, o Sistema publica os parabéns às 08:00. Tudo por **websocket privado** — o banco empurra a mensagem, a tela só lê página (5 conversas, 10 mensagens) —, e **ninguém lê conversa alheia, nem o admin**. Na mesma migration (38, aplicada em 27/09), a **correção de segurança do cadastro**: CPF, hash do PIN e token de convite estavam legíveis por qualquer pessoa logada (D-68). **Validada ao vivo em 28/09** (mensagem de uma aba chegando na outra pelo canal privado, páginas de 10/5, zero leitura extra; 3 achados corrigidos na hora) **e mesclada na `main`** — a 24 e a 26 estão na `main`.

**↪️ 27/09/2026 (SESSAO-24 entregue — produção concluída, cancelamentos e alocação):** depois de um alinhamento com a equipe, o dono pediu **tudo por arrasto**: soltar o card em "MONTANDO" já inicia o tempo de quem arrastou, soltar em etapa com nome de setor ou em CONCLUÍDO leva ao próximo setor (com a marcação 🟢🟡🔴), e o **único botão é "Concluir produção", só na LIMPEZA E EMBALAGEM** — peça de pedido vai para **Pedidos em aguardo** (que virou o lugar dela), peça sem dono vai para o **ESTOQUE** (que ficou só com peça sem dono). As rotas das etapas são editáveis em Setores e etapas. Cancelamento em 3 estágios com a aba **Cancelados** do PCP; na liberação, o PCP vê a **sugestão do estoque** ("há 1 igual — usar?"). Migration 37 aplicada (integração do Tiny idêntica), ensaio no banco real desfeito com tudo certo. Telas conferidas com o dono logado e **mesclada na `main` em 27/09** (Q-69/Q-70 respondidas: a 502 é card de teste; 518 e 537, de pedidos já entregues, arquivadas). **Em paralelo:** SESSAO-26 (chat) em execução.

**↪️ 26/09/2026 (SESSAO-25 entregue — o estoque completo):** a tela de **Estoque** mostra, produto a produto, o número do Tiny da fábrica menos o que a loja já vendeu e ainda não saiu (nunca negativo — o negativo vira **"necessidade extrema"**), os prontos **reservados** (SKU + pedido) e **livres**, o mínimo do Tiny e o sinal com ícone + texto; tem a aba de **matéria-prima e insumos** (o começo do estoque de peça) e a **sugestão de mínimo** (top 20 dos 90 dias com rank). Abaixo do mínimo, o estoque gera no PCP o **card de reposição** (o PCP libera ou "Não produz"); o **ESTOQUE só aceita peça 🟢**. Migration 36 aplicada, carga do saldo rodada (442 produtos), **mesclada na `main` em 26/09 (D-20)**. ⚠️ A carga mostrou que o físico dos móveis no Tiny está **negativo em 93 de 168** — a reposição automática (44 cards na 1ª rodada) espera o OK do dono. **Próxima: SESSAO-24** (concluir produção → aguardo, cancelamentos, alocação).

**↪️ 23/09/2026 (SESSAO-23 entregue — Bloco 5 segue):** o **Meu Painel 2.0** está pronto (D-51): "Delegados a mim / Meus afazeres / Fila de prioridade" reordenável e persistente por usuário, **subtarefas em 2 níveis**, **tarefa pessoal privada** (nem admin lê — provado com papel simulado no harness E por ensaio no banco real), pendência de parecer virou **tarefa do Sistema** que se conclui sozinha com o parecer, o sino ganhou **"Ver todos"** paginado e nasceu o painel privado **Dashboards → Meu desempenho**. Nas rodadas de ajuste do dono (23/09): preview da tarefa em modal, "Nova tarefa" só para mim + delegação em **Afazeres do time** (filha nova), lixeira + "Apagar lidas" nos avisos (migration 34), **pausa que GUARDA o tempo** + botões ▶/⏸/✓ na fila + **bolinha flutuante de execução** (migration 35), **admin sem setor no cadastro (D-52**, Edge Function v10**)** e o **PCP sem os pedidos encerrados no Tiny** (161 → 37; os 2 de teste concluídos/arquivados por evento). Migrations 33–35 aplicadas, tudo validado ao vivo com o dono logado e **mesclado na `main` em 24/09 (D-20)**. **Próxima: SESSAO-25 (Estoque completo)** — em 24/09 ela **trocou de ordem com a 24** e absorveu o estoque-base (D-53); a integração com o **Tiny da fábrica já está no ar desde 23/09** ([[N8N - Tiny Fabrica Produtos para Banco]]) — e o achado do pedido 13257 ("Entregue" no Tiny com unidades em produção) reforça a [[SESSAO-29 - Reconciliacao Tiny - Pente-fino e Ultimo Pacote Vence]].

**↪️ 22/09/2026 (SESSAO-21 entregue — fecha a União D-46):** o cutover aconteceu — o **renovador do token do Tiny** e os **3 crons de disparo** rodam **só na fábrica** (renovação provada às 21:20 UTC, antigo parado), as 6 tabelas do disparo batem byte a byte, e o projeto Supabase antigo da loja está em **quarentena**. Na mesma janela, a conferência Tiny × plataforma (206 pedidos de setembro + os 5.360 do histórico) corrigiu 15 pedidos e 2 cadastros e mostrou que o webhook não cobre tudo — causa-raiz em P17, correção de raiz na [[SESSAO-29 - Reconciliacao Tiny - Pente-fino e Ultimo Pacote Vence]] (🔶). **23/09:** DataCrazy repontado pelo dono, trava do disparo aberta (PR #6), 1ª renovação automática do token ✅. Segurança herdada resolvida (migration 32). **Exclusão do projeto antigo: 06/10.** SESSAO-29 **📐 pronta para code** (D-50). **Próxima de construção: SESSAO-23 (Bloco 5).**

**↪️ Atualizado em 21/09/2026 (SESSAO-16 entregue):** os dashboards de verdade estão no ar — as 4 telas-filhas do pai Dashboards (Visão do dia/andon, Tempo por setor, Pessoas, Qualidade) nos moldes dos mockups da D-42, com a migration 28 aplicada (8 portas de leitura gateadas — D-32), os tokens fixos de fila/execução, visualizações salvas por tela+filtros e vazamento zero medido em 700–2400px; validada ao vivo com o dono e **mesclada na `main` pelo PR #4 em 18/09**. **Próxima: SESSAO-22 (Bloco 5)**, com a 21 (cutover) na janela do dono.

**↪️ 18/09/2026 (nasce o Bloco 5):** o dono trouxe o maior pacote de demandas desde a fundação, orquestrado em [[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]]: **SESSÕES 22–28** (filas reais + tempo de PCP + paginação · Meu Painel 2.0 com subtarefas · estoque núcleo com Pedidos em aguardo e cancelamentos · integração NOVA com o Tiny da fábrica · chat interno · automações em canvas, que absorve a 17 · rota calculada OSRM). Ordem decidida: **16 → 22…28**, com a 21 (cutover) na janela do dono. Todas as demandas `📐 prontas para code`, com as perguntas ao dono embutidas.

**↪️ 17/09/2026 (reorganização do cofre):** os dois cofres viraram UM — o `_Docs` da loja foi destrinchado e fundido aqui (domínio de dados → `SUPA - Comercial -*`, Tiny v3 → referência do Tiny, módulo → `PLT - Comercial -*`, atendimento → `Atendimento/`), a pasta `docs/` do repo foi absorvida (`execucao/` → `Plataforma/Execucao/`, mockups → `Plataforma/Inspiracao/`, notas soltas → `PLT -`), e nasceu `Planejamento/` com [[000 - PROXIMOS PASSOS]]. Estado do produto: SESSÕES 19–20 entregues (módulo Comercial no ar com disparo travado). **Próxima: SESSAO-16 (dashboards), depois SESSAO-21 (cutover).**

**↪️ 16/09/2026 (SESSAO-20 entregue):** o Painel de Recompra virou o módulo Comercial dentro da plataforma (40 arquivos portados, rotas `/comercial/*`, trava de disparo em 3 camadas até o cutover), navegação reorganizada com permissão por módulo, migration 27 aplicada, temas esmeralda e tokens de série que a SESSAO-16 herda com Recharts 3.9.2.

## Estados anteriores em uma linha

**↪️ 15/09/2026 (SESSAO-19 entregue — abre o bloco União D-46/D-47):** o domínio do Painel de Recompra passou a viver no Supabase da fábrica — 6 tabelas + `vendas_marketing` como VIEW, 10 RPCs com dashboards batendo ao centavo, permissão por módulo, 6 Edge Functions no ar SEM cron (o renovador do token segue só no projeto antigo até o cutover).

**↪️ 08/09/2026 (SESSAO-15 entregue):** Logística e ROTAS viraram módulo de verdade (Estoque com ID, Pedidos em aguardo, Danificados, Programação de caminhão com mapa — D-38/D-39/D-45); migration 25 aplicada, Edge `geocodificar` no ar; branch mesclada na main e publicada em 15/09.

**↪️ 01/09/2026 (SESSAO-14 entregue):** o Meu Painel no ar (pendências, avisos, cockpit de metas — D-37); migrations 23/24 aplicadas; achado E-24 (blindagem do backfill desfeita e devolvida; ~163 cards históricos aguardam decisão de limpeza — ✅ arquivados em 08/09, 233 cards).

**↪️ 28/08/2026 (SESSAO-13 + bloco 3 definido):** a reforma da casca (navegação pai→filho, 8 temas, login novo, log de tudo — D-36/D-40/D-41); o bloco noturno D-26 tinha somado as sessões 07/09→12; nasceram as demandas 13–16 da reforma, com automações→17 e admin→18 em standby.
