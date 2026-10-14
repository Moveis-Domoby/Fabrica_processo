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
- [ ] A1 · D-126: chaves por setor "pedir o estado ao enviar" / "ao receber", cada uma com os tipos de card; tudo desligado; validação no banco (mover/encaminhar/concluir/parecer) e na tela (o modal só pergunta quando a chave manda); fins de linha recusam só 🟡/🔴
- [ ] A2 · Configurações → Setores e etapas: a tela das chaves (admin)
- [ ] A3 · D-127: rota "concluir a produção" na etapa (EXPEDIÇÃO da LIMPEZA E EMBALAGEM); soltar = concluir; sai o botão "Concluir produção"; avulso só move
- [ ] A4 · As 6 peças da EXPEDIÇÃO → Pedidos em aguardo (manutenção por evento, prévia no handoff)
- [ ] A5 · §4c: o marcador "Devolvido" sai de `fn_pedido_cancelado` e de `fn_reagir_pedido`; bloco 59 do harness passa a provar o contrário; ensaio desfeito no banco real
- [ ] A6 · Botão "Pedido devolvido" sai da tela do entregador (D-129)

**Etapa B — devolução decidida pela logística (D-129) + ajuste de peça (D-130)**
- [ ] B1 · Fim de linha interno "DEVOLUÇÕES"; "Pedido devolvido" da logística/admin (ROTAS → Entregas e janela do pedido no PCP, inclusive entregue) com motivo (lista própria em Utilitários) e observação
- [ ] B2 · Linha "Em decisão pós devolução" nos números do estoque (projeção por produto) e no cartão do Estoque
- [ ] B3 · Aviso no sino para a logística que abre "Decidir situação" (mini relatório + decisões por peça ou todas): reenviar · estoque · realocar · danificados · loja · ajuste
- [ ] B4 · Ajuste de peça: setor + destino final; aplicado na EXPEDIÇÃO (ou no Concluir do ajuste)

**Etapa C — várias rotas por dia (D-128)**
- [ ] C1 · Banco: rota nº por (dia, caminhão); equipe por rota; ordem por rota; portas da Programação, Já programadas, Entregas do dia e do entregador
- [ ] C2 · Telas: Programar escolhe a rota; Já programadas e Entregas do dia mostram as rotas do dia (mapa e km por rota); equipe por rota

**Etapa D — card avulso + frente do card + etiquetas + quadro numa requisição (§1, §2, §4b)**
- [ ] D1 · Tipo novo `avulso` em `plt_cards` (título, descrição, vínculo, datas, responsáveis, criador) + toda regra que filtra por tipo revista (o avulso só entra nos tempos)
- [ ] D2 · Aba "Lançamento manual" no PCP: Novo card (nome + Enter; atalhos; mais detalhes; ajuste de peça), Mostrar A lançar · Em produção · Concluídos (cursor), lançar para produção
- [ ] D3 · Avulso no quadro e no tablet (arrasto, tempo, limite, PIN); "Concluir" só no avulso
- [ ] D4 · Frente do card: etiquetas, avatares, vencimento atrasado (ícone + texto), botãozinho da descrição (`Dica`), vínculo, contadores de anexos/mensagens — projetados no card
- [ ] D5 · Etiquetas pelas pessoas (evento + projeção, origem interface), criar só líder/admin, nome repetido recusado; campo vale em avulso
- [ ] D6 · Quadro do setor e tablet em 1 requisição (porta do quadro: 1ª página de todas as colunas; "Ver mais" por cursor), canal privado por setor (payload mínimo, aplicado no cache), recuperação ao reconectar; zero relógio e zero `postgres_changes` no quadro e no tablet; índice das colunas; RLS dos cards com `(select …)`

**Etapa E — janela do card + anexos + histórico (§3)**
- [ ] E1 · Janela para todo card (quadro, PCP, tablet, Meu Painel, sino), link `?card=`, ESC, celular em tela cheia; 1 requisição ao abrir; histórico e anexos só no clique; canal do card só aberto; pedaço próprio do pacote
- [ ] E2 · Propriedades editáveis (quem pode — D-125), descrição, tempo, histórico (o `ModalLinhaTempo` vira seção; estorno mantido)
- [ ] E3 · Anexos: imagem, PDF, áudio (arquivo e gravação), câmera, arrastar; 25 MB; áudio 5 min; miniatura; remoção por evento (arquivo guardado, admin vê); quem vê = quem vê o card

**Etapa F — conversa + menções + sino ao vivo + editar/apagar (§3, D-131)**
- [ ] F1 · Conversa do card (a história do card: mensagem = fato do card), "Só conversa | Tudo", 10 por página por cursor, canal do card, otimista e idempotente
- [ ] F2 · @menção (busca com espera, ≥ 2 letras): aviso no sino + cartão "mencionou você" na particular (tipo novo de mensagem, como o aniversário) com "Abrir card"; mencionar a si mesmo não avisa; mencionado passa a ver o card
- [ ] F3 · Responsável adicionado recebe aviso no sino
- [ ] F4 · Sino sem relógio: aviso novo pelo canal pessoal, aplicado no cache; clicar abre o destino
- [ ] F5 · Editar/apagar mensagem no card e no chat (D-131)

**Etapa G — pausa com motivo (§4)**
- [ ] G1 · Motivos de pausa em Utilitários (lista + "Outro"); arrastar para PARADO um card em execução pede o motivo; Pausar/Retomar na janela; quem pausa (D-125); motivo na frente e no histórico; regras da D-48 intactas

**Fechamento**
- [ ] H1 · Checklist final: `npm run test:banco` 2×, `npx tsc -b`, lint, testes, build, 375/768 px, advisors (segurança e desempenho), `pg_stat_statements`, checklist da lei (§12) com pacote antes/depois, critérios de aceite um a um
- [ ] H2 · ClickUp: cada tarefa em FAZENDO ao começar, comentário ao terminar, nunca concluir; os 4 ajustes sem tarefa → handoff
- [ ] H3 · Handoff + mapa + próximos passos + ordem das sessões + esquema do banco + lei (§14) + modelo de sistema

## Diário
