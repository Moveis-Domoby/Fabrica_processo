---
titulo: Execução — SESSAO-31 · Kanban completo (card avulso, janela do card, anexos, conversa, pausa) + os 4 ajustes da equipe
tipo: execucao
data: 2026-10-13
atualizado: 2026-10-14
tags: [execucao, sessao-31, bloco-6, kanban, pcp, avulso, anexos, conversa, pausa, devolucao, rotas, qualidade]
---

# 🔧 Execução — SESSAO-31 · Kanban completo + ajustes da equipe

**Pasta:** a principal (`Domoby - fabrica`), sem worktree (pedido do dono). Nenhuma outra worktree na máquina (`git worktree list` só a principal). **Branch:** `sessao-31-kanban-completo`, criada em 13/10 da `main` depois de avançar a `main` local (estava 35 commits atrás) até `origin/main` = **63e247e** (contém a SESSAO-30 inteira e as respostas do dono de 13/10).
**Demanda:** [[SESSAO-31 - Kanban Completo - Card Avulso Janela do Card Anexos e Conversa]] (lida 2×; §4c e a nota do §9 de 13/10; §11 com as respostas de 13–14/10) · [[PLT - Lei de Desempenho e Escala]] (inteira) · plano [[004 - PLANO - Bloco 6 - Producao de Ponta a Ponta e Kanban Completo]] · handoff da 30 (inteiro, com os ajustes de 08–13/10).
**Numeração (conferida no cofre e nas migrations, 13/10):** migration **66** em diante · **D-125** em diante (usadas D-125…D-131) · **E-91** em diante (E-91 usada) · **A-61** em diante.
**Modo:** sessão noturna por ordem do dono (14/10): *"não me pergunte nada, apenas valide e entregue, faça todos os testes necessários"* — como na SESSAO-30, cada etapa testada é aplicada no banco e publicada no site no mesmo gesto (E-73); lacuna = escolha conservadora registrada como "decisão provisória" no handoff.

## Leituras (13/10)

Regras do repo (inteiras, 18 e 19), Memória de Aprendizado (inteira), Decisões (D-01…D-124), Visão Geral, Requisitos (o que toca o kanban), Ordem das Sessões, Perguntas em Aberto, Esquema do Banco (plataforma até a migration 65), Lei de Desempenho (inteira), Modelo de Sistema (componentes, kanban, chat, utilitários), plano 004, handoff da 30. Mapa do código por dois agentes de leitura (front do kanban; tudo no banco que filtra por tipo de card).

## Retrato de partida (13–14/10, só leitura — `now()` do banco 2026-10-14 01:21 UTC)

- **Marcador "Devolvido" (§4c):** 113 pedidos com o marcador (102 cancelados, 11 entregues no Tiny); 8 com card de pedido vivo — os 8 cancelados no Tiny; **0 peças vivas** desses pedidos; **0 fatos `pedido_devolvido`** (nem do Tiny nem do entregador); **0 peças desvinculadas por devolução**. Tirar a regra não mexe em nada do que existe.
- **LIMPEZA E EMBALAGEM:** etapas A LIMPAR (fila) · LIMPANDO E EMBALANDO · ESTOQUE · EXPEDIÇÃO · CANCELADO · NÃO ENCONTRADO · ENTREGUE, nenhuma com rota. **6 peças vivas na EXPEDIÇÃO** (pedidos 13177 ×5 e 13207 ×1, "preparando envio" no Tiny; 2 delas postas lá em 13/10 — a equipe já está usando o quadro).
- **Etiquetas:** 1 cadastrada, nenhum nome repetido. **Programação:** 19 linhas em 6 pares (dia, caminhão). **Chat:** 17 mensagens.
- **ClickUp (regra 19):** acesso OK. "Kanban - Cartões avulsos", "Kanban - Anexar PDF E imagem" e "Kanban - Pausa de um card com motivo de pausa" **já estavam em FAZENDO** (de antes do Bloco 6); "Frente do card", "Janela do card", "Conversa com menções" e "Desempenho - Quadros, tablet e sino" em A FAZER. Status da lista: a fazer · analisar viabilidade · fazendo · concluído.
- **Código (achados que mudam o que a demanda supunha):** o sino lê a cada 30 s e **não abre nada** no clique; o comentário e o anexo da S30 só valem para quem mexe com entrega (logística/entregador); pausar hoje é só líder/admin (e só pelo banco — nenhuma tela); o quadro do setor faz uma consulta por coluna com relógio de 20 s; o tablet escuta `plt_cards` inteira por `postgres_changes`; o Meu Painel também (é da S32); `plt_cards_leitura` chama `fn_eh_admin`/`fn_usuario_atual` sem `(select …)`; não existe remoção de anexo nem índice feito para a consulta das colunas.

## Respostas do dono (13–14/10) → D-125…D-131

Ver [[PLT - Decisoes de Produto]]. Resumo: D-125 (avulso), D-126 (marcação configurável), D-127 (EXPEDIÇÃO conclui), D-128 (várias rotas por dia), D-129 (devolução decidida pela logística), D-130 (ajuste de peça), D-131 (editar/apagar mensagem).

## Task list (espelho da demanda + ajustes) — ordem de entrega

**Etapa A — marcação configurável, EXPEDIÇÃO conclui, marcador "Devolvido"**
- [x] A1 · D-126: chaves por setor "pedir o estado ao enviar" / "ao receber", cada uma com os tipos de card; tudo desligado; validação no banco (mover/encaminhar/concluir/parecer) e na tela (o modal só pergunta quando a chave manda); fins de linha recusam só 🟡/🔴
- [x] A2 · Configurações → Setores e etapas: a tela das chaves (admin)
- [x] A3 · D-127: rota "concluir a produção" na etapa (EXPEDIÇÃO da LIMPEZA E EMBALAGEM); soltar = concluir; sai o botão "Concluir produção"; avulso só move
- [x] A4 · As 6 peças da EXPEDIÇÃO → Pedidos em aguardo (manutenção por evento, prévia no handoff)
- [x] A5 · §4c: o marcador "Devolvido" sai de `fn_pedido_cancelado` e de `fn_reagir_pedido`; bloco 59 do harness passa a provar o contrário; ensaio desfeito no banco real
- [x] A6 · Botão "Pedido devolvido" sai da tela do entregador (D-129)

**Etapa B — devolução decidida pela logística (D-129) + ajuste de peça (D-130)**
- [x] B1 · Fim de linha interno "DEVOLUÇÕES"; "Pedido devolvido" da logística/admin (ROTAS → Entregas e janela do pedido no PCP, inclusive entregue) com motivo (lista própria em Utilitários) e observação
- [x] B2 · Linha "Em decisão pós devolução" nos números do estoque (projeção por produto) e no cartão do Estoque
- [x] B3 · Aviso no sino para a logística que abre "Decidir situação" (mini relatório + decisões por peça ou todas): reenviar · estoque · realocar · danificados · loja · ajuste
- [x] B4 · Ajuste de peça: setor + destino final; aplicado na EXPEDIÇÃO (ou no Concluir do ajuste)

**Etapa C — várias rotas por dia (D-128)**
- [x] C1 · Banco: rota nº por (dia, caminhão); equipe por rota; ordem por rota; portas da Programação, Já programadas, Entregas do dia e do entregador
- [x] C2 · Telas: Programar escolhe a rota; Já programadas e Entregas do dia mostram as rotas do dia (mapa e km por rota); equipe por rota

**Etapa D — card avulso + frente do card + etiquetas + quadro numa requisição (§1, §2, §4b)**
- [x] D1 · Tipo novo `avulso` em `plt_cards` (título, descrição, vínculo, datas, responsáveis, criador) + toda regra que filtra por tipo revista (o avulso só entra nos tempos)
- [x] D2 · Aba "Lançamento manual" no PCP: Novo card (nome + Enter; atalhos; mais detalhes; ajuste de peça), Mostrar A lançar · Em produção · Concluídos (cursor), lançar para produção
- [x] D3 · Avulso no quadro e no tablet (arrasto, tempo, limite, PIN); "Concluir" só no avulso
- [x] D4 · Frente do card: etiquetas, avatares, vencimento atrasado (ícone + texto), botãozinho da descrição (`Dica`), vínculo, contadores de anexos/mensagens — projetados no card
- [x] D5 · Etiquetas pelas pessoas (evento + projeção, origem interface), criar só líder/admin, nome repetido recusado; campo vale em avulso
- [x] D6 · Quadro do setor e tablet em 1 requisição (porta do quadro: 1ª página de todas as colunas; "Ver mais" por cursor), canal privado por setor (payload mínimo, aplicado no cache), recuperação ao reconectar; zero relógio e zero `postgres_changes` no quadro e no tablet; índice das colunas; RLS dos cards com `(select …)`

**Etapa E — janela do card + anexos + histórico (§3)**
- [x] E1 · Janela para todo card (quadro, PCP, tablet, Meu Painel, sino), link `?card=`, ESC, celular em tela cheia; 1 requisição ao abrir; histórico e anexos só no clique; canal do card só aberto; pedaço próprio do pacote
- [x] E2 · Propriedades editáveis (quem pode — D-125), descrição, tempo, histórico (o `ModalLinhaTempo` vira seção; estorno mantido)
- [x] E3 · Anexos: imagem, PDF, áudio (arquivo e gravação), câmera, arrastar; 25 MB; áudio 5 min; miniatura; remoção por evento (arquivo guardado, admin vê); quem vê = quem vê o card

**Etapa F — conversa + menções + sino ao vivo + editar/apagar (§3, D-131)**
- [x] F1 · Conversa do card (a história do card: mensagem = fato do card), "Só conversa | Tudo", 10 por página por cursor, canal do card, otimista e idempotente
- [x] F2 · @menção (busca com espera, ≥ 2 letras): aviso no sino + cartão "mencionou você" na particular (tipo novo de mensagem, como o aniversário) com "Abrir card"; mencionar a si mesmo não avisa; mencionado passa a ver o card
- [x] F3 · Responsável adicionado recebe aviso no sino
- [x] F4 · Sino sem relógio: aviso novo pelo canal pessoal, aplicado no cache; clicar abre o destino
- [x] F5 · Editar/apagar mensagem no card e no chat (D-131)

**Etapa G — pausa com motivo (§4)**
- [x] G1 · Motivos de pausa em Utilitários (lista + "Outro"); arrastar para PARADO um card em execução pede o motivo; Pausar/Retomar na janela; quem pausa (D-125); motivo na frente e no histórico; regras da D-48 intactas

**Fechamento**
- [x] H1 · Checklist final: `npm run test:banco` 2×, `npx tsc -b`, lint, testes, build, 375/768 px, advisors (segurança e desempenho), `pg_stat_statements`, checklist da lei (§12) com pacote antes/depois, critérios de aceite um a um
- [x] H2 · ClickUp: cada tarefa em FAZENDO ao começar, comentário ao terminar, nunca concluir; os 4 ajustes sem tarefa → handoff
- [x] H3 · Handoff + mapa + próximos passos + ordem das sessões + esquema do banco + lei (§14) + modelo de sistema

## Diário

### 14/10 · Etapa A — estado da peça como chave + EXPEDIÇÃO conclui (no ar ~01:05 Natal)

- **Decisão técnica (Claude):** a confirmação pendente virou **projeção no card** (`plt_cards.parecer_pendente_id`, gatilho `plt_eventos_projetar_parecer` — roda depois da posição pela ordem alfabética) em vez de ser recalculada pela view a cada leitura: o iniciar, o parecer, a tarefa do Sistema e a TELA leem dela (o quadro e o tablet deixaram de fazer as 2 consultas de pendência a cada 20 s). Pendência só nasce na chegada de GENTE vinda de outro setor de produção, quando o setor que recebe pede o estado daquele tipo de card (D-25 mantida: API/automação e saída do PCP não participam). Sem marcação, a pendência é a própria chegada (`movimentacao_setor`) e a confirmação diz "em que estado chegou"; com marcação, é a marcação (divergência como antes). Marcação 🔴 sem confirmação na chegada → DANIFICADO do setor que recebe. Desligar a chave "ao receber" limpa a pendência de quem está no setor (gatilho em `plt_setores`) e fecha a tarefa do Sistema.
- **Decisão técnica:** a rota "conclui a produção" é coluna da etapa (`conclui_producao`, dado do dono — a manutenção marca a EXPEDIÇÃO; reaplicar migration não desfaz edição). `plt_fn_soltar_card` ganhou o ramo "concluído"; `plt_fn_concluir_producao` manteve a assinatura e o padrão 'perfeito' (API/ensaios antigos), mas passa o estado como vem (o arrasto manda nulo quando a chave está desligada).
- **Harness:** os blocos antigos provam a regra antiga — o teste liga as duas chaves para todos os tipos (e no padrão dos setores criados pelos blocos) logo depois das migrations; o **bloco 66** desliga e prova o jeito novo (23 verificações). Ajuste: a mensagem nova manteve "marcar o estado da peça" (os blocos antigos casam por ela). **877 verdes.**
- **Tela:** chaves em Setores e etapas (admin, só setores de produção, "Pedir ao enviar" / "Pedir ao receber" × Peça de pedido / Peça de estoque / Card avulso) e a opção "Conclui a produção" na rota da etapa; o quadro e o tablet só abrem o modal de estado quando o setor pede; a coluna que conclui tem borda tracejada e "conclui a produção"; o "Concluir produção" saiu do cartão (o botão fica para o avulso). Auditoria: "Mudou o estado da peça pedido no setor". Testes da tela 152 → **157**; tsc, lint, build ok. Pacote: 1.877,6 kB / 511,6 kB gz (fim da S30: 1.862,5 / 507,1).
- **Banco real:** ensaio desfeito (migration + manutenção: 0,3 s + 0,3 s, transação de 1,7 s; integração idêntica `e2109f3a…`) → **migration 66 aplicada** (aplicador, `--so`; integração idêntica, 35 tabelas, 49 políticas) → **manutenção `2026-10-14_expedicao_conclui.sql` gravada uma vez** (saída guardada): EXPEDIÇÃO da LIMPEZA E EMBALAGEM conclui; as 6 peças (508, 509, 511–514 — pedidos 13207 e 13177) em Pedidos em aguardo; 0 setores com chave; 24 avisos "Peça pronta em Pedidos em aguardo" (6 peças × admins). **E-92 (achado no ensaio):** um parêntese a mais na manutenção — o ensaio pegou, nada gravado (manutenção não passa pelo harness: ensaio sempre antes).
- **Publicado:** `main` = e4697b7 (Vercel ✔). Conferência visual no site: **pendente com o dono** — o navegador do app não está logado e o Claude não entra com senha.

### 14/10 · Etapa B — devolução decidida pela logística + ajuste de peça (no ar ~01:40 Natal)

- **Decisão técnica (Claude):** "Em decisão pós devolução" é um **fim de linha interno novo** (`plt_setores` código `devolucao`, papel terminal, ordem 86 — tratado como o `aguardo`): a peça devolvida **continua do pedido** e fica lá até a logística decidir. Só entra e sai pela maquinaria (marca `plt.devolucao_maquinaria`, guarda `fn_validar_devolucao`); a única saída manual é a da etapa DANIFICADO. O card do pedido projeta a devolução aberta (`devolucao_evento_id`) e a peça em ajuste o seu destino final (`ajuste_evento_id`, `ajuste_destino`) — gatilho `plt_eventos_projetar_devolucao`.
- **"Pedido devolvido" (D-129):** saiu da tela do entregador (a porta velha `plt_fn_entrega_devolvida` foi apagada); a logística/admin marca em **Entregas** (pedido na ROTAS) e na **janela do pedido no PCP** (pedido já entregue — escolhe quais peças voltaram), com motivo (lista nova "Motivos de devolução" em Utilitários, 7 semeados) e observação. Toque repetido em 10 min = o mesmo efeito. O Tiny não muda. Aviso no sino para admins e logística → tocar abre "Decidir situação" no Estoque (`?devolucao=<card do pedido>`).
- **"Decidir situação":** mini relatório (motivo, quem, quando, histórico das entregas, comprovantes) + decisão por peça ou todas: **reenviar** (reentrega só do que voltou — `fn_unidades_a_entregar`; se a entrega já tinha acontecido, ela é reaberta só na plataforma), **estoque** (sem dono), **realocar** (estoque + uso no pedido escolhido — opções carregadas no clique), **danificados**, **loja** (sai das contas da fábrica) e **ajuste** (setor de produção + destino final, aplicado quando a peça conclui).
- **Marcador "Devolvido" do Tiny (D-124):** deixou de ser cancelamento (`fn_pedido_cancelado` = só cancelado no Tiny; `fn_desvincular_por_cancelamento` e `fn_reagir_pedido` sem o ramo do marcador). Retrato no banco real: 113 pedidos com o marcador, **nenhuma peça viva** deles fora dos cancelados — nada muda no que existe.
- **Estoque:** linha nova `em_devolucao` nos números (gatilhos divididos em update/insert/delete), filtro "Em decisão pós devolução", número no resumo do galpão, linha no cartão (tocar abre as devoluções do produto, lista por cursor) e no detalhe do produto. O PCP ganhou a situação "Em decisão pós devolução".
- **Harness:** a 67 obrigou E-17 numa antiga (`fn_estoque_contar` da 57 muda o retorno → `drop` antes do `create` lá também) e E-19 em três antigas (só a última valida o check de tipos). Blocos 57, 59 e 60 revistos (o devolvido agora é da logística e não vai ao ESTOQUE; o marcador não mexe em nada); **bloco 67** novo (19 verificações). **897 verdes**, rodado de novo antes de aplicar.
- **Tela:** tsc, lint, testes (157), build ok. O sino e a página de Avisos abrem o destino do aviso ("Toque para abrir"); Auditoria com os fatos novos; a mensagem de "peça concluída" diz o destino do ajuste (terceirizado, loja, DANIFICADO). Pacote: 1.894,3 kB / 516,1 kB gz.
- **Banco real:** ensaio desfeito com uma devolução DE VERDADE (pedido 13645, entregue): 1 peça → "Em decisão pós devolução", 4 avisados, toque repetido sem efeito, números do estoque e resumo com 1, lista e detalhe certos, "reenviar" reabriu a entrega e relançou para a ROTAS (peça em ROTAS, pedido sem programação, nada na fila do Tiny), recontagem 0 diferenças antes e depois; `plt_fn_devolucoes` 2,6 ms e o filtro do Estoque 15,7 ms → **migration 67 aplicada** (aplicador `--so`; integração idêntica; 11 setores, 46 etapas).
- **Publicado:** `main` = c6f890a.

### 14/10 · Etapa C — várias rotas por dia no mesmo caminhão (no ar ~01:55 Natal)

- **Decisão técnica (Claude):** a rota é uma coluna da programação (`plt_programacoes.rota`, 1…20, padrão 1 — tudo o que existia virou a Rota 1, sem mexer em linha) e da equipe (`plt_programacao_equipes.rota`, chave passou a (dia, caminhão, rota, pessoa)). Nada de tabela de "rota" à parte: a rota existe enquanto tem pedido programado nela. Índice `(data_entrega, caminhao_id, rota)` no lugar do `(data_entrega, caminhao_id)`.
- **Decisões provisórias (Claude):** (1) sem rota dita, o pedido fica na rota em que já está (mesmo dia e caminhão) ou entra na **última** rota do caminhão no dia — o "entra no fim da rota" de antes; (2) na aba **Programar** a rota que vem marcada é **"Nova rota"** quando o caminhão já tem rota no dia (montar a rota = uma viagem nova), e no **Reprogramar** é a rota em que o pedido já está (ou a última do caminhão); (3) a rota nova já vem com a **equipe da rota anterior** do mesmo caminhão (D-128 — só sugestão; fica na trilha); (4) o nome "Rota N" só aparece na tela quando o caminhão tem mais de uma rota no dia (a janela do pedido no PCP mostra sempre).
- **Portas:** `plt_fn_programar_entrega` / `plt_fn_programar_rota` / `plt_fn_ordenar_rota` / `plt_fn_equipe_definir` / `plt_fn_entregas_do_dia` ganharam a rota (parâmetro integer com padrão — o site de antes continuou funcionando); `plt_fn_programadas` com a coluna `rota`; **`plt_fn_rotas_do_dia(dia)`** nova (cada caminhão+rota com entregas, entregues e equipe) no lugar de `plt_fn_equipes_do_dia` (apagada); `fn_pode_mexer_entrega` = a equipe DA ROTA; a janela do pedido no PCP com a rota e a equipe dela.
- **Tela:** o modal de programar pergunta a rota (as do caminhão no dia, com entregas e equipe, + "Nova rota"; só busca as rotas do dia ao abrir); "Já programadas" agrupa por dia → caminhão → rota (mapa, ordem, "Salvar ordem" e "Equipe" por rota; o link `?rota=`); "Entregas do dia" com um botão por rota; a equipe se escolhe por rota ("troca de turno").
- **Formatação:** as telas tocadas na sessão estavam fora do padrão de formatação da casa (as edições por script) — formatadas (o padrão já valia antes; o arquivo de Setores e etapas já estava fora antes da sessão).
- **Harness:** **bloco 68** (11 verificações) + 3 assinaturas atualizadas nas conferências de permissão dos blocos 54, 55 e 60. **908 verdes.**
- **Banco real:** ensaio desfeito — 19 programações viraram Rota 1, a equipe com a chave nova, as portas velhas fora; o único pedido a entregar foi programado num dia de teste e passado para a Rota 2 (as rotas do dia, "Já programadas" e "Entregas do dia" da Rota 2 certas); `plt_fn_programadas` 3,9 ms, `plt_fn_rotas_do_dia` 7,6 ms, `plt_fn_entregas_do_dia` 3,1 ms → **migration 68 aplicada** (`--so`, integração idêntica).
- **E-93:** usei `cd` de novo para formatar arquivos (a terceira vez — E-74/E-91). O ambiente devolveu a pasta; nada mudou de lugar. Correção: o formatador roda com caminhos absolutos, sem `cd`.
- **Publicado:** `main` = 1d2b982.

### 14/10 · Etapa D — card avulso, frente do card, etiquetas e o quadro numa requisição (no ar ~02:50 Natal)

- **Mapa (dois agentes de leitura):** todo objeto do banco que filtra por tipo de card (≈90, por grupo: quadro, PCP, estoque, painéis, automações, entrega) e o front do kanban (consultas, relógios, `postgres_changes`, componentes) — guardados no rascunho da sessão. Achados que mudaram o desenho: os dois checks do tipo recusavam o avulso; o soltar só iniciava/concluía a peça; a chegada no ESTOQUE/aguardo não olhava o tipo (o avulso entraria no estoque); comentário/anexo só para a logística; `responsavel_id` é a delegação e zera ao mudar de setor; nenhuma integração ouve fatos de card (os 4 webhooks são de filas próprias).
- **Decisões técnicas (Claude):** o avulso é **tipo novo em `plt_cards`** (herda arrasto, tempo, histórico, quadro); as propriedades de todo card são colunas **projetadas de fatos** (`card_editado`, `responsavel_*`, `comentario_*`, `anexo_*`, `avulso_concluido` — gatilho `plt_eventos_projetar_card`); **participantes** (criador + responsáveis + mencionados) entram na leitura dos cards (RLS reescrita com `(select …)`); o vínculo é só referência (o avulso nunca tem pedido nem produto — o check diz isso); o avulso só anda por setores de **produção** (guarda nova); os fatos novos só nascem pelas portas (marca de sessão); Concluir = execução finalizada (se aberta) + `avulso_concluido` + arquivado com motivo "concluido" (vai para Concluídos); a etapa que conclui também conclui o avulso; o avulso fica **fora** de tempos por item e da meta de unidades (D-125).
- **Decisões provisórias:** "líder" para criar card/etiqueta = papel de líder ou marca de líder em algum setor (a mesma regra da tela); quem trabalha no setor também conclui o avulso (além de quem edita) — no tablet com o PIN; a busca de peça para ajuste lista só peça em decisão pós devolução, ESTOQUE (não reservada), aguardo ou já entregue.
- **Quadro numa requisição (Lei §2/§4/§6):** `plt_fn_quadro_setor` (etapas + 1ª página de cada coluna com total + execuções + pessoas + pedidos + valores dos campos + catálogos), `plt_fn_quadro_coluna` (Ver mais por cursor), índice `plt_cards_quadro_idx`, aviso ao vivo `plt-aviso:setor_{id}` (um por setor por transação, também quando as etapas mudam e quando um campo é gravado). No front, `useQuadro` (assina antes de ler; 1 releitura por aviso; recuperação ao reconectar; arrasto otimista; Ver mais por coluna). **Saíram** do quadro e do tablet: 1 consulta por coluna, os relógios de 20 s (colunas e execuções), a tabela de pessoas inteira e a escuta da tabela de cards inteira (`postgres_changes`).
- **Tela:** aba **Lançamento manual** no PCP (pedaço próprio: 20,0 kB / 5,7 kB gz) — Novo card (nome + Enter; atalhos responsável · datas · prioridade/etiqueta; Mais detalhes: descrição, vínculo, lançar já; tipo **Ajuste de peça**), Mostrar A lançar · Em produção · Concluídos, busca, Lançar, Concluir; frente do card (etiquetas, rostos dos responsáveis, vencimento com ícone + texto, botãozinho da descrição, contadores, selo do ajuste, vínculo); "Concluir" do avulso no quadro e no tablet (com PIN); Utilitários: campo "Nos cards avulsos".
- **Harness:** blocos **69** (28) e **70** (7); E-19 em duas antigas (os checks do tipo); 3 testes de tela novos/ajustados. **943 verdes.** Tela: tsc, lint, 158 testes, build. Pacote: 1.906,1 kB / 519,4 kB gz (antes da etapa D: 1.894,6 / 516,2).
- **Banco real:** ensaio desfeito (69 + 70: 0,9 s + 0,1 s; checks validados; criar → quadro → aviso do setor → lista → concluir; **800 avulsos num setor**: quadro **6,5 ms**, Ver mais 4,2 ms, lista 7,7 ms, busca na lista 8,7 ms, busca de peça para ajuste 45 ms, de pedido 21 ms) → **69 e 70 aplicadas** (`--so`, integração idêntica).
- **Publicado:** `main` = ad1669d.

### 14/10 · Etapa E — janela do card e anexos (no ar ~03:05 Natal)

- **Decisões técnicas (Claude):** a janela vive no **endereço** (`?card=<id>`) e é desenhada por um componente só, montado na casca e no tablet — qualquer tela abre um card pondo o parâmetro (quadro, PCP → Lançamento manual, sino). Abrir = **1 requisição** (`plt_fn_card_janela`: o card como o quadro, setor · etapa, execução aberta, pessoas, pedido, campos que valem com os valores, etiquetas, permissões); histórico e anexos **só no clique**; a janela e a conversa são **pedaços próprios** do pacote (22,0 kB / 7,0 kB gz). O histórico de sempre virou seção (`HistoricoDoCard`) — o modal antigo continua para o botão do card. Clicar ≠ arrastar: o clique que o navegador dispara no fim do arrasto é ignorado (300 ms); pelo teclado, **Enter abre** e **Espaço pega** para arrastar.
- **Anexos (D-125 resp. 8):** a base da SESSAO-30 estendida — 25 MB, tipo áudio (com duração, até 5 min), quem vê o card anexa e lê (o entregador segue pela equipe da rota), **remover = fato** `anexo_removido` (some para todos; o admin ainda vê, com quem tirou, inclusive o arquivo no armário). Envio: botão, arrastar e soltar, câmera, **gravar áudio** (o formato do aparelho: webm no Chrome, mp4 no Safari — o tipo vai sem parâmetros). Links de vida curta de todos os anexos mostrados **numa chamada só**.
- **Decisão provisória:** no **tablet** a janela é só para ver e sem dado de cliente (D-28) — mudar, anexar e conversar pelo computador ou pelo celular (o PIN por gesto dentro da janela fica para depois; as portas de anexo já aceitam o operador do PIN).
- **Harness:** **bloco 71** (10 verificações) + 2 testes antigos do anexo revistos (o teto passou a 25 MB). **953 verdes.** Tela: tsc, lint, 158 testes, build; JS principal 1.909,6 kB / 520,7 kB gz.
- **Banco real:** ensaio desfeito (0,6 s; armário com 25 MB e os tipos de áudio; as regras do armário novas; janela do card do pedido e de uma peça certas) — janela **2,1 ms**, histórico 25,6 ms, anexos 1,1 ms → **71 aplicada**.
- **Publicado:** `main` = e8ecc94.

### 14/10 · Etapa F — conversa do card, menções, sino ao vivo, editar/apagar (no ar ~03:20 Natal)

- **Decisões técnicas (Claude):** a mensagem do card é **fato do card** (`comentario_adicionado` — reaproveita o da SESSAO-30); editar e apagar são fatos novos com a referência (`comentario_editado` / `comentario_apagado`); a leitura vem de uma **projeção** (`plt_card_mensagens`), por cursor, 10 por página; o canal privado **`plt-card:{id}`** (só quem vê o card) empurra a mensagem nova e a mudada — a janela assina **antes** de ler e aplica no cache (nada se relê); sai ao fechar. No filtro **"Tudo"**, os fatos do card entram na mesma linha (em língua de gente). A conversa não entra mais na linha do tempo (ela tem porta própria).
- **@menção:** a lista de pessoas busca no servidor (espera 300 ms, 2 letras); quem foi mencionado recebe o **aviso no sino** e o **cartão "📌 mencionou você no card"** na conversa **particular** dos dois (nasce se não existir; para quem mencionou, já nasce lido) com **"Abrir card"**; mencionar a si mesmo não avisa; o mencionado passa a ver o card (participantes).
- **Editar/apagar (D-131):** cada um só a própria (decisão provisória da D-131), no card e **no chat**. No chat a mensagem continua só-inserção para tudo que não for a porta (a guarda aceita só a mudança de texto/editada/apagada pela marca da porta); cada versão anterior fica em `plt_chat_versoes`. Para todos: "editada" / "Mensagem apagada"; o admin vê o texto apagado e as versões **só nas conversas de que participa** (a particular dos outros segue fechada — provado no harness).
- **Sino ao vivo (Lei §4):** aviso novo → sinal `aviso` no canal da pessoa (o mesmo do chat) → entra no cache; o relógio de 30 s saiu; assina antes de ler; ao reconectar, uma releitura.
- **Pendência registrada:** a prévia da conversa na lista do chat (e os 5 últimos comentários na tela do entregador) ainda mostram o texto de antes de apagar/editar até a próxima mensagem — a mensagem em si já aparece certa.
- **Harness:** **bloco 72** (10 verificações) + 2 testes antigos do chat revistos (mensagem só muda pela porta). **963 verdes.** Tela: tsc, lint, **161 testes** (3 novos: conversa e chat no cache), build — a conversa é pedaço próprio (12,5 kB / 4,5 kB gz); o build passou a separar o Supabase num pedaço (o primeiro carregamento continua ~1.925 kB / ~527 kB gz no total).
- **Banco real:** ensaio desfeito (0,5 s; menção → 1 aviso, 1 cartão, os dois ao vivo; 300 mensagens: conversa 20 ms, "Tudo" 3 ms; editar/apagar: o admin vê o texto e 1 versão; chat 6 ms) → **72 aplicada**.
- **Publicado:** `main` = b944aa8.

### 14/10 · Etapa G — pausa com motivo (no ar ~03:45 Natal)

- **Decisões técnicas (Claude):** a etapa ganha a marca **"pede o motivo"** (`plt_etapas.pede_motivo`) — nasce ligada só no **PARADO dos setores de produção** (hoje: MONTAGEM; o ensaio mostrou que o PCP também tinha um PARADO, e lá ninguém executa — ficou de fora) e o admin liga/desliga em Setores e etapas ("Parar aqui pede o motivo"). O motivo é **projetado no card** (`plt_cards.pausa_motivo`) pelos fatos: pausa → motivo; retomar, iniciar, arquivar ou mudar de lugar sem motivo → some. Portas: `plt_fn_card_pausar` (o toque repetido não pausa de novo), `plt_fn_card_retomar`, `plt_fn_card_parar` (o card em execução solto na etapa de parada: o tempo fecha como sempre — D-59 — com o motivo no fato). A trava de quem pausa (`fn_validar_execucao`) aceita agora **o próprio executor** (D-125 resp. 9), além de líder e admin.
- **Tela:** soltar no PARADO um card **em execução** abre "Por que parar?" (lista + "Outro"; no tablet, PIN antes e botões grandes); a janela do card tem **Pausar / Retomar** (pelas permissões que a própria janela traz; **no tablet, com PIN** — exceção à janela "só para ver"); a frente: **"Pausado · motivo · há X"** e **"Parado · motivo · há X"**; Utilitários → Motivos ganhou **"Motivos de pausa"** (cache longo, relê quando a lista muda); o histórico já mostrava a observação do fato — o motivo aparece lá.
- **Harness:** **bloco 73** (7 verificações) + o teste antigo da pausa revisto (o próprio executor pausa). **970 verdes.** Tela: tsc, lint, **162 testes** (1 novo: o arrasto para o PARADO), build (a janela 23,7 kB; o principal + Supabase ≈ 1.919 kB).
- **Banco real:** ensaio desfeito (pausar com motivo → na frente; retomar; parar no PARADO → tempo fechado, motivo no card; quadro da MONTAGEM 4,9 ms; janela 3,4 ms) → **73 aplicada**; conferido depois: só MONTAGEM · PARADO pede o motivo; anônimo fora.

### 14/10 · Etapa H — fechamento (~04:10 Natal)

- **Bateria do banco 2× (970 / 0), tsc, lint, 162 testes, build** — tudo verde. 375/768 px e aba Rede: **pendentes com o dono** (navegador do app sem login; o Claude não entra com senha).
- **Código morto:** o carregador antigo do quadro (`useColunasPaginadas` + `buscarCardsDaEtapa` — uma consulta por coluna, com relógio) saiu; o Modelo de Sistema aponta para `useQuadro`.
- **Advisors:** segurança — nada novo além do padrão da casa (portas `security definer` para logado; anônimo fora; `pg_net` no public, senha vazada desligada — antigos); desempenho — nenhum tipo novo; as 33 FKs sem índice são antigas; "sem uso" 18 → 34 (índices desta sessão, nascidos hoje).
- **`pg_stat_statements`:** nenhuma porta nova no topo; a do quadro do PCP (pedidos) com média 157 ms → **dívida 16** da lei.
- **Pacote do primeiro carregamento:** 1.862,5 / 507,1 kB gz (fim da 30) → 1.930,9 / 528,8 kB gz.
- **Task list × demanda:** A1…G1 conferidos contra os §1–§4c/§4b e os critérios de aceite (tabela no handoff).
- **ClickUp:** as 7 tarefas em FAZENDO, cada uma com comentário; nenhuma concluída. Os 4 ajustes não têm tarefa → handoff.
- **Decisões:** ↩️ anotado na D-48 (a pausa volta com motivo; o próprio operador pausa).
- **Handoff:** [[handoff_2026_10_14_sessao31_kanban_completo]]; mapa, próximos passos, ordem das sessões e o Resultado da demanda atualizados.

## Ajustes do dono — 14/10 noite (depois da entrega)

Pedido do dono (14/10 ~22:40, com vídeo e 7 imagens): *"Muita coisa está ruim ou mal feita, ajuste"*. Diagnóstico antes de codar (vídeo quadro a quadro + banco real, só leitura):
- **Lançar do PCP e não ver no setor sem recarregar:** o banco avisa certo (`plt-aviso:setor_N` recebeu os avisos); o defeito é da tela — o quadro guarda a leitura da última visita (`staleTime: Infinity`) e só ouve o canal enquanto está aberto: o que mudou enquanto a pessoa estava fora nunca chega. `useAoVivo` tem o mesmo buraco (30 s de cache padrão).
- **Mensagem vermelha piscando ao trocar de setor:** é o aviso "Este setor ainda não tem uma etapa de fila" — aparece enquanto `etapas` está vazio (carregando).
- **Colunas esticadas:** o contêiner é `flex` com `align-items: stretch` — toda coluna ganha a altura da maior; o "Vazio"/"Solte aqui…" fica no meio.
- **"Concluir" em todo card:** `QuadroKanban` passa `aoConcluir` para todo card (o filtro de avulso estava só no clique).
- **PCP com pedido "recebido" no Tiny:** o "recebido" do Tiny é do PAGAMENTO; no banco, dos 23 aguardando liberação, 22 estão "Preparando envio" (o estado normal de pedido esperando produção aqui — 36 no total) e 1 "Faturado" (13623). A porta do PCP só tira entregue/não entregue/cancelado.
- **Expedição desatualizada:** a porta lista todo pedido com card de pedido não arquivado (o card do pedido nunca se arquiva depois da liberação) — os entregues (13114, 13108, 13176…) aparecem no topo por previsão antiga.
- **Duas rotas no mesmo dia:** banco e tela aceitam (a regra recebe a rota; nenhuma trava); as 3 entregas de 14/10 foram programadas às 07:52, ~6 h depois de a escolha de rota ir ao ar — a pessoa estava com a versão antiga aberta (não existe aviso de versão nova).
- **Comprovante:** existe na janela do pedido do PCP, mas escondido dentro de "Pagamento".

Lista (espelho do pedido):
- [x] I1 · "Concluir" só no card avulso
- [x] I2 · Quadro sem a mensagem piscando (esqueleto enquanto carrega)
- [x] I3 · Colunas: linha fina entre colunas, fundo mais transparente, cresce só a coluna com card, sem "Vazio"/"Solte aqui"
- [x] I4 · Ao vivo de verdade entre áreas: ao voltar a uma tela, relê o que mudou enquanto estava fora (quadro e telas ao vivo)
- [x] I5 · Janela do motivo de pausa no padrão da plataforma (botões de motivo como os da entrega; nome do card certo)
- [x] I6 · Utilitários: aba própria "Motivos de pausa" (sai de "Motivos da entrega")
- [x] I7 · Lançamento manual em cards comuns (grade, como os pedidos do PCP)
- [x] I8 · Menu: hierarquia clara (pai legível) e nomes padronizados em todos os grupos
- [x] J1 · PCP: pedido Faturado / Pronto para envio / Enviado no Tiny sai do PCP e segue o Tiny
- [x] J2 · Expedição: só pedidos vivos, previsão mais próxima primeiro, ao vivo (sem relógio)
- [x] J3 · Duas rotas no mesmo dia: validar no banco real e na tela; aviso de versão nova da plataforma
- [x] K1 · Pai "Pedidos" no menu da Fábrica: "Todos os pedidos" (sai do PCP) e "Cancelados" (a da Logística vem para cá, com o histórico inteiro)
- [x] K2 · Ficha do pedido com tudo — comercial, produção (quem fez cada peça, tempo por etapa e pessoa), entrega (dia e hora, comprovante), dados do Tiny — revelada aos poucos, por clique

### 14/10 noite · Leva 1 — quadro, pausa, utilitários, lançamento manual, menu (no ar ~23:25 Natal; site 0fcc0c8)

- `QuadroKanban`: `aoConcluir` só para `tipo === 'avulso'`; prop `carregando` → `EsqueletoDoQuadro` (nenhum aviso enquanto as etapas não chegaram); a coluna virou faixa de altura cheia (soltar em qualquer altura) com o **painel** que cresce só com card (`bg-superficie-sutil/40`, borda `/40`, tracejada quando leva/conclui); o contêiner usa `divide-x divide-borda/40` (a linha fina entre colunas); saíram "Vazio" e "Solte aqui…". Teste novo `QuadroKanban.test.tsx` (4).
- **Ao vivo ao voltar:** `useQuadro` — na 1ª assinatura (ou na desistência de 4 s), se a leitura guardada é de ANTES de a tela abrir, `invalidateQueries(refetchType 'none')` e a consulta liga já velha → 1 releitura; `useAoVivo` — na 1ª assinatura, relê cada consulta guardada antes de a tela abrir (que não esteja lendo agora).
- `ModalMotivoPausa` refeito no desenho do `ModalMotivoEntrega` (botões em grade, `aria-pressed`, ações no formulário; subtítulo = nome da peça (k/n) · Pedido N).
- Utilitários: aba **"Motivos de pausa"** (`?aba=pausa`); "Motivos da entrega" fica com não entregue · desfazer · devolvido.
- Lançamento manual: `CartaoDoAvulso` em grade `sm:grid-cols-2 lg:grid-cols-3` (Lançar na largura toda; Concluir).
- Menu: `nomeNoMenu` (siglas PCP/SECC/CNC/MDF/API inteiras; o resto minúsculo com a 1ª maiúscula); seções "Controle de produção", "Rotas"; pai `text-sm font-semibold text-grafite-50`, filhos numa linha-guia (`border-l`); Comercial "Painel de recompra", "Listas de disparo".
- Tela: tsc, lint, **167 testes**, build.

### 14/10 noite · Leva 2 — o PCP segue o Tiny, Expedição viva, versão nova (no ar ~23:45; site bfd12c6)

- **Migration 74** (`20261014200000_plt_pcp_segue_o_tiny.sql`, D-132/D-133): `plt_privado.fn_tiny_tirou_do_pcp(situacao)` (faturado, pronto para envio, enviado, entregue, não entregue, cancelado); `plt_fn_cards_pedido_pcp` e `plt_fn_dash_pcp_dia` leem dela (painel = quadro); `plt_fn_expedicao_kanban` só pedido vivo (`entrega_evento_id` nulo, não encerrado no Tiny; levado adiante só com peça liberada), previsão mais próxima primeiro. Harness **bloco 74** (4) — **974 verdes**.
- Banco real: ensaio desfeito → PCP 23 → **22** (o 13623 Faturado saiu; painel = quadro = 22); Expedição 25 pedidos vivos, a partir dos que vencem hoje, **0 entregues**; tempos: quadro do PCP 26 ms, Expedição 4,6 ms, quadrinho 5,1 ms → **74 aplicada**.
- Expedição: `useAoVivo(['pcp','aguardo','rotas'])` no lugar do `refetchInterval` de 30 s.
- **Duas rotas no mesmo dia:** o banco aceita (bloco 68) e a tela também — teste novo `ModalProgramar.test.tsx` (a Rota 1 do caminhão feita → "Nova rota (Rota 2)" marcada → manda 2). A causa provável: as 3 entregas de 14/10 foram programadas às 07:52, com a versão antiga aberta desde antes da publicação. **Versão nova:** a montagem grava `__VERSAO_APP__` e `versao.json`; `useVersaoNova` confere no trocar de tela e ao voltar à aba (no máximo a cada 2 min — não é relógio) e, sabendo da nova, recarrega na próxima troca de tela; `AvisoVersaoNova` ("Saiu uma versão nova da plataforma · Atualizar") na casca e no tablet.

### 14/10 noite · Leva 3 — a área Pedidos (no ar ~00:00 de 15/10; site 8afd82d)

- **Migration 75** (`20261014210000_plt_pedidos_area.sql`, D-134): `plt_fn_pedidos_lista(busca, antes_numero, limite, cancelados)` (cursor por número; vendedor, valor, marcadores, peças, situação na plataforma + `tiny`/`cancelado`, entregue em/por/fonte, entregue no Tiny, cancelado em; total só na 1ª página, até 10.001); `plt_fn_pedido_producao(pedido)` (peças pelo `pedido_id` ou pelo `card_pai_id` — as que o cancelamento deixou sem dono —, execuções de `plt_vw_execucoes` com setor, etapa, pessoa, segundos e pausa; resumo por pessoa); `plt_fn_pedido_tiny(pedido)` (raw do pedido, do cliente, das notas e das contas). Harness **bloco 75** (6) — **980 verdes**.
- Banco real: ensaio desfeito → 5.561 pedidos (1ª página 38,6 ms, seguinte 25,7 ms), 164 cancelados (40,9 ms), busca por nome 55,5 ms (acima do teto — dívida 17), produção do maior pedido 10,8 ms, Tiny 4,2 ms → **75 aplicada**.
- Tela (pasta nova `src/pedidos/`, pedaço próprio 39,7 kB / 10,6 kB gz): `PaginaPedidos` (Todos/Cancelados; busca com espera; cursor ao rolar; `?pedido=N` abre direto; seleção do super admin), `FichaDoPedido` (nasceu do `PedidoCompleto` do PCP — resumo + 5 botões que revelam: Itens e pagamento · Produção · Entrega e comprovante · Dados do Tiny · Histórico; o comprovante abre ali mesmo, a imagem aparece na ficha), `ProducaoDoPedido`, `DadosDoTiny` (o registro inteiro, campos legíveis, vazio escondido, embrulhos do Tiny desfeitos), `AjustePedidos` (a barra do super admin, comum ao PCP). Saíram: a aba "Todos os pedidos" do PCP, `PedidoCompleto.tsx`, `Cancelados.tsx` (os links antigos levam à área nova). JS inicial **1.538 → 1.465 kB** (393,6 kB gz + Supabase 109,8 + runtime 4,3).
- Tela: tsc, lint, **170 testes** (2 novos da área), build.

### 15/10 · Leva 4 — validação navegando no site (pedido do dono) + a mãozinha do quadro (no ar ~01:55, ~02:15 e ~02:30; site 34cfa47, fab2cbd, a485613)

- **Pedido no meio da validação:** "um botão para arrastar para o lado no kanban, clicando com o mouse no meio, no estilo de mãozinha". `src/kanban/componentes/arrastarQuadro.ts` → `useArrastarParaOLado()` no rolador do quadro: só mouse; botão do **meio** em qualquer ponto, ou o **esquerdo no fundo** (fora de card, botão, link, campo — `NAO_ARRASTA`); captura do ponteiro; `scrollLeft = início − deslocamento`; o `mousedown` do meio com `preventDefault` (sem a rolagem automática do navegador); `cursor-grab` / `cursor-grabbing select-none`; dica "Para ver as outras colunas: segure o fundo do quadro (ou o botão do meio do mouse) e arraste para o lado." só com `pointer: fine`.
- **Achado ao validar (E-99):** o `MouseSensor` da biblioteca de arrastar ativa com qualquer botão menos o direito — com o botão do meio, o card andaria junto com o quadro. → `SensorDoMouse` (só o botão esquerdo) no lugar dele. Conferido no site: botão do meio em cima de um card (com o `mousedown` forçado) correu o quadro 30 px e o card **não** foi pego; nenhuma chamada ao banco. Teste `arrastarQuadro.test.tsx` (5).
- **Menu do celular:** `src/lib/telaPequena.ts` (`useTelaPequena`, < 1024 px) → na gaveta, com o painel de itens aberto, a barra 1 vira trilho de ícones; a barra 2 fica `w-60` (`lg:w-52` no computador). Conferido a 375 px: "Limpeza e embalagem" e "Controle de produção" numa linha.
- **Pedidos:** a pílula da plataforma só quando difere da situação do Tiny (`mesmaSituacao`); cancelado que tinha sido entregue → "Cancelado em 13/10/2026 · tinha sido entregue em 08/10/2026" (13525); resumo da ficha `grid-cols-2 … lg:grid-cols-4` (e o esqueleto); cliente `line-clamp-2`; Produção sem tempo → "Nenhum tempo de trabalho registrado na plataforma" / "sem tempo registrado"; Dados do Tiny: dinheiro só em campo de valor (`CAMPO_DINHEIRO`; `id_*`/`codigo*` nunca), `rotuloDoCampo` com acento (`COM_ACENTO`), siglas e `id_X` → "Código de X"; **`valorDoTiny`** ("credito" → "Crédito", "multiplas" → "Múltiplas"; o escrito à mão, como "CARTÃO - JAMAD - 10X", fica) — valores conferidos no banco; Entrega do cancelado: "Foi entregue, depois cancelado" (sem o verde) / "Não vai para entrega" — a situação do Tiny é rótulo ("Cancelado"; 5.359 Entregue, 164 Cancelado, 36 Preparando envio, 1 Em aberto, 1 Faturado), compara-se sem caixa (E-100).
- **Janela do card:** o nome só no topo da janela (o `h2` repetido saiu); "Renomear" (fantasma) na fileira de cima, quando pode.
- **Utilitários:** a lista única (Motivos de pausa) na largura toda, como as outras abas.
- **Setores e etapas:** o bloco das etapas é um *container* (`@container`) e o desenho segue a largura DELE: **largo** (≥ 56rem, `@4xl`) → grade alinhada (`[minmax(0,1fr)_16rem_13rem_auto]`, linhas em `grid-cols-subgrid`) com cabeçalho "Etapa · Soltar o card aqui manda para · Ao parar aqui"; **médio** (`@md`/`@lg`) → nome e ações em cima, a seleção e a caixinha embaixo (lado a lado a partir de `@lg`); **estreito** (celular) → empilhado: nome, seleção, caixinha e as ações por último, à direita (a 375 px as 4 ações espremiam o nome em ~80 px); as pílulas da etapa descem inteiras e, sem espaço, terminam em "…" ("manda para LIMPEZA E EMBALAGEM" quebrava dentro da pílula); o rótulo da seleção só some na grade (`Selecao` ganhou `classeRotulo`, aqui `@4xl:sr-only`). A 1ª versão (por `sm:`, a largura da janela) espremia o nome em notebook com as duas barras do menu abertas — medido no site: bloco de 974 px a 1.518 px de janela; a `Selecao` mostra o escolhido numa linha (o longo termina em "…"); o teto: "Execução pausada não conta no teto." (pausar não é mais só do líder).
- **Conferido no site** (celular 375 px e computador 1518 px): Cancelados (164), 13525, ficha em 2 colunas, gaveta com trilho, quadro da MONTAGEM (fundo arrastado 569 px; botão do meio 250 px com a mão fechada e de volta), Setores e etapas alinhado, Motivos de pausa na largura toda, janela do card sem o nome repetido, ficha com "Crédito" e "Foi entregue, depois cancelado".
- Tela: tsc, lint, **176 testes**, build (JS inicial 1.468 kB / 394,6 kB gz — +0,2 %). Site: 34cfa47, fab2cbd, a485613, 85d76ef, c2e8628, 1e29c69. Conferido também a 1.280 px (bloco de 735 px → desenho médio) e a 375 px (empilhado, sem rolagem lateral).
