---
titulo: "Diário — SESSAO-51 · entrega parcial que mantém a produção (com revogar) e mover card da produção de volta ao PCP"
tipo: execucao
data: 2026-11-16
tags: [execucao, sessao-51, rotas, entrega-parcial, pcp, kanban, reposicao]
---

# Diário — SESSAO-51 (16–17/11/2026, noite)

Demanda: [[SESSAO-51 - Entrega Parcial Mantem a Producao e Mover Card para o PCP]] · ramo `sessao-51-entrega-parcial-mover-pcp` (nascido da main `02f1047`, pasta principal — nenhuma outra sessão ativa nela).

## Partida (16/11 ~23:00)

- `fetch` da main: em dia com o GitHub (`0 0`). A demanda estava na pasta, fora do git (colocada antes do pull).
- **O número 51 está livre** em todas as cópias: a ordem da main, a cópia da SESSAO-46 (`.claude/worktrees/`) e todos os ramos remotos. Linkada na [[000 - ORDEM DAS SESSOES]] como `🔨 em execução`.
- A SESSAO-49 (dieta da documentação) **não está na main** (só a demanda) → leitura completa pelo CLAUDE.md de hoje: regras, memória de aprendizado (inteira), decisões (D-01…D-17 e as citadas: D-54, D-85, D-86, D-113, D-130, D-156, D-195, D-201, D-213, D-307…D-314), visão geral, lei de desempenho (§1–§13), modelo de sistema (componentes base, SESSAO-41, 48 e 50), perguntas em aberto (nada aberto sobre isto), handoff e diário da 50; o esquema pelas próprias migrations (a versão vigente de cada função — A-96/A-97).
- **Banco vivo não lido**: a leitura de produção pede a permissão do dono (A-202). A conferência do corpo das funções recriadas contra o banco vivo (md5) entra como o 1º passo do programa de subida, antes de aplicar.
- 23:40 · o dono pediu **silêncio absoluto**; 00:10 (17/11) perguntou "Iai?" — respondido em 5 linhas, sem códigos.

## Numeração (conferida na main, na cópia da 46 e nos ramos remotos)

Decisões **D-325…** · erros **E-287…** · acertos **A-236…** · dívidas da lei **38…** · migrations `20261116010000` (base), `…020000` (bloco A), `…030000` (bloco B).

## Task list (espelha a demanda)

**Bloco A — entrega parcial com o que ainda está na fábrica**
1. Frente 1 · a janela separa "Saíram para a entrega" (prontas, marcadas; desmarcada = voltou → devolução, D-195) de "Ainda na fábrica" (peças em produção com setor e etapa, desmarcadas; "+ N produtos ainda no PCP"); sem nada na fábrica, a janela de antes; motivo e/ou observação; modal da casa em 375/768.
2. Frente 2 · "E o que ainda está na fábrica?": "Deixar em produção" (padrão; o entregador só tem esta — o banco recusa o limpar dele) e "Limpar da produção" (logística, PCP, admin): fato `peca_retirada_entrega_parcial`, tempo fechado, arquivada com registro sem perder o pedido; vagas fora do PCP; sino do PCP. "Deixar": nada muda nas peças; o pedido segue vivo; "Entregue em parte (N de M)"; o "Entregue" do resto fecha e vai ao Tiny; D-113 intacta.
3. Frente 3 · a aba "Entregas parciais" (cursor, busca por número/cliente, do mais recente) e a ficha do pedido; um botão só, o contrário; "Revogar e remover" (a etapa de agora; a pronta e a da rota ficam) e "Revogar e voltar tudo" (a mesma peça na mesma etapa; etapa arquivada → a primeira ativa; setor sumido → vaga); idempotente com chave; trilha; sai da lista quando o resto é entregue, cancelado, excluído, Tiny "Entregue", oculto ou nada sobra — e o banco recusa com o porquê; contar/listar os pedidos entregues em parte antes desta sessão (handoff).

**Bloco B — mover card da produção de volta ao PCP**
4. Frente 4 · "Mover para o PCP" (admin e super admin; peça viva em setor de produção; nunca terminal, cancelada, avulso, ajuste, rota, entregue; o banco recusa nos mesmos casos); a janela com o nome, o pedido, setor · etapa, quem trabalha; "Voltar para o PCP" (motivo da lista nova "Volta ao PCP" e/ou observação) e "Virar reposição de estoque"; peça sem pedido só "Voltar"; pedido fora do PCP só "Virar reposição", com o porquê.
5. Frente 5 · o que acontece: tempo e pausa fecham; fato `card_voltou_pcp`; arquivada com registro; ao vivo; log, Auditoria e sino. "Voltar": a vaga reabre com o selo e o motivo. "Reposição": perde o pedido, a vaga reabre ("1 virou reposição de estoque"), nasce 1 reposição com a origem; não sai em 2 dias úteis nem entra na conta da automática enquanto não liberar. "Liberar unidades": "Usar a mesma peça", marcada, a etapa onde parou sugerida; liberar desarquiva a mesma peça; desmarcada = peça nova.

**Geral**
6. 375/768 sem rolagem lateral; bateria, tsc, lint, vitest, montagem, advisors; Lei (1 requisição por tela/aba, modais no clique, cursor, aviso ao vivo, ×100 das portas tocadas).
7. Decisões (D-325…), memória, lei, esquema, modelo de sistema, ordem, mapa, handoff com prints; ClickUp (criar com o OK do dono — a demanda pede).

## Lições da memória que valem nesta sessão

Regra 20 (nenhum `cd`); conferir o ramo antes de todo commit (E-113); recriar por extração + md5 do vivo (A-96/A-97); assinatura nova = drop + create e `grep` da velha na bateria (A-12/E-120/E-165/E-236); validate do check mora na mais nova (E-19/E-259/E-270); bloco novo da bateria em `{ }` (E-70) com a faixa própria de dados (E-142/E-157); ensaio ×100 antes de fechar a tela (A-73/E-192); botão novo medido em 375 e 768 (E-269/E-283); texto com crase só por arquivo (E-247/E-249); plural por extenso (E-52).

## Diário

- **Como o código está (16/11, lido nas migrations vigentes):**
  - a entrega parcial pegava TODAS as peças vivas; as desmarcadas iam todas para a devolução, até as de MONTAGEM; o pedido fechava (o fato vira a entrega vigente do card);
  - **achado:** o quadro do PCP NÃO filtra pela entrega (a demanda supunha que sim) — com vaga ainda sem liberar, o pedido entregue em parte **continuava em "Aguardando liberação"**; quem fecha o card na entrega completa é o arquivamento do card do pedido que ainda espera liberação (`fn_fechar_pedido`), e a parcial não fazia isso. Conta e lista dos casos antigos vão para o handoff.
  - **achado:** fechar o tempo aberto (`fn_fechar_tempo_aberto`) **move a peça para a fila** da etapa — quem quer guardar "onde a peça estava" grava ANTES de fechar (A-237).
  - a vaga do PCP é a conta itens − peças do pedido, **arquivadas inclusive** (`fn_vagas_pedido`): peça que sai arquivada SEM perder o pedido segue cobrindo a vaga; para a vaga reabrir, a peça perde o pedido (`unidade_desvinculada`, o caminho da 48 e do Ocultar).
- **A forma escolhida para "Deixar em produção" (D-325):** o `pedido_entregue` parcial com `fabrica = 'manter'` não vira a entrega vigente do card (`fn_projetar_entrega` sai cedo) — o pedido continua vivo em TODA porta sem mexer nos ~40 filtros "entrega_evento_id is null" nem na regra única do PCP. A entrega parcial vive nas colunas `parcial_*` (projeção da base). A parada sai da rota do dia (como no "Não entregue") e o pedido volta para "Programar". A outra forma da demanda (reabrir a entrega pelo caminho da D-213) traria de volta as peças ENTREGUES — descartada.
- **"Limpar da produção" (D-327):** as vagas saem do PCP pela marca de remoção que a regra única já lê (`removido_pcp_em`), com o motivo novo `entrega_parcial` — a aba "Pedidos ocultos", o "Incluir pedido no PCP", a lista de Pedidos e a busca não confundem com o oculto. As peças: `peca_retirada_entrega_parcial` (setor, etapa, posição, pedido, item, k/n) → fecha o tempo → `card_arquivado` (motivo `retirada_entrega_parcial`); não perdem o pedido (a vaga segue coberta; a volta devolve a mesma peça).
- **O revogar:** um fato no card do pedido (`entrega_parcial_decisao_revogada`, antes/depois, chave do toque, peças); "remover" = o Limpar de agora (só o que está em setor de entrada/produção; a pronta e a da rota ficam; sem nada vivo depois, o pedido fecha pela própria parcial e a programação sai); "voltar" = cada peça desarquivada e movida para a etapa guardada (a primeira ativa do setor se a guardada foi arquivada; vira vaga se o setor sumiu), sem execução aberta; a marca do PCP sai (as vagas voltam); o pedido que a parcial fechou reabre e a parada antiga sai da programação.
- **A posição na fila (D-326):** o quadro ordena por prioridade e chegada (`desde`) — não há posição guardada à mão. A peça que volta entra com a chegada de agora (a fila recomeça a contar) → fica no fim da etapa. A posição de antes fica no fato, para a trilha.
- **Banco de desenvolvimento** (A-132): retrato do PGlite com as 148 migrations em 2,3 s; cada prova aplica as da 51 duas vezes e roda. **Bloco A: 46 conferências verdes.**
  - E-287 · a prova nova escondeu o erro de verdade (o ajudante trocava de papel sem ponto de volta — o E-161 de novo) → ponto de volta no ajudante.
  - A-236 · com "Deixar em produção" a parada sai da rota e o entregador deixa de ser da equipe dela: o toque repetido dele era recusado pela permissão → o toque repetido é conferido ANTES da permissão (não muda nada, só devolve o que já foi feito).
  - E-288 · o "porquê não dá para revogar" dizia "arquivado" quando o resto tinha sido entregue (a entrega completa arquiva o card do pedido) → a razão mais informativa primeiro.
  - O entregador que registra entrega precisa estar ligado a um setor de fim de linha (a regra antiga da validação dos fatos) — o cenário da prova liga o entregador à ROTAS, como em produção.
- **Telas do bloco A:** `ModalEntregaParcial` (refeito: dois grupos, a pergunta, uma leitura ao abrir pela porta nova `plt_fn_entrega_parcial_abrir` — peças, vagas, motivos e quem pode limpar); `AbaEntregasParciais` + `ModalRevogarParcial` (pedaços próprios, no clique); a ficha do pedido (o quadro da entrega parcial com o mesmo botão); o card do PCP ("Entregue em parte (N de M)"); a lista de Pedidos ("Entregue em parte … · o resto segue na fábrica"); a busca ("Saiu da produção na entrega parcial…", e o pedido leva à aba "Entregas parciais"); rótulos da Auditoria e da linha do tempo. tsc 0, lint 0, vitest das áreas 57 arquivos/416 + 8 novos.
