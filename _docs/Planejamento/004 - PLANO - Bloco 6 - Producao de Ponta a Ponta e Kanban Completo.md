---
titulo: "PLANO — Bloco 6: produção de ponta a ponta e kanban completo"
tipo: plano
data: 2026-10-07
atualizado: 2026-10-07
origem: pedido do dono em 06/10/2026, mapeado no Cowork (leitura só de cofre, código, banco e ClickUp — nada alterado)
tags: [planejamento, plano, bloco-6, producao, kanban, pcp, rotas, entrega]
---

# 🗺️ PLANO — Bloco 6: produção de ponta a ponta e kanban completo

> [!abstract] Em uma frase
> O setor de produção funcionando **de ponta a ponta** — pedido, reabastecimento e entrega sem furo — e o **kanban completo**, com card avulso e a janela do card no jeito do ClickUp. **Duas sessões** para o pedido de 06/10, o mínimo possível, como o dono pediu — e uma terceira, de **desempenho e escala** de toda a plataforma, pedida em 07/10.

## O pedido do dono (06/10/2026)

**Fluxo do pedido:** produto lançado como pedido no Tiny → entra no PCP com sugestão de estoque (caso possua) → PCP lança para produção no setor correto → pedido concluído? → vai para Pedidos em aguardo até alguém lançar para as ROTAS → produto fica reservado para venda → quando alguém marca como entregue, deixa de ser reservado.

**Fluxo de reabastecimento:** alguém solicita estoque para produção → entra no PCP, aba Reabastecimento, e é lançado normalmente em produção → quando a produção conclui, fica estocado.

**Lançamento manual:** aba nova no PCP para criar card avulso (com ou sem vínculo a produto/pedido/peça), personalizável como no ClickUp (responsáveis, prioridade como etiqueta/campo, datas), botão de descrição ao passar o mouse, card enxuto; clicar abre a janela do card (descrição, tempo, histórico de produção, edição, anexos de PDF/imagem/áudio) com a conversa ao lado — mencionar avisa a pessoa e manda uma mensagem de aviso no chat dela.

Referências visuais: 3 prints do ClickUp (criação rápida do card · balão da descrição · janela da tarefa com a Atividade ao lado).

## O que o mapeamento achou (06/10, só leitura)

- **Fluxo do pedido:** existe até "Lançar para ROTAS". **Três furos:** (1) ao lançar para ROTAS a peça **deixa de contar como reservada em venda** antes de ser entregue; (2) **"Entregue" daqui não chega ao Tiny** (quem faz é a automação antiga do ClickUp); (3) **"Entregue" no Tiny não fecha nada aqui** — 3 pedidos entregues no Tiny com 6 peças paradas em ROTAS.
- **Reabastecimento:** completo; falta o ensaio de ponta a ponta.
- **Lançamento manual:** tudo novo. Reaproveita etiquetas e campos customizados (S27), chat e websocket (S26), sino, linha do tempo e o quadro por arrasto (S24).
- **ClickUp (lista PRODUÇÃO do DPTO TI)** — itens abertos que entram: "Kanban — Cartões avulsos", "Kanban — Anexar PDF e imagem", "Kanban — Pausa de um card com motivo de pausa", "Rotas — Visualização dos entregadores". Fica fora: "Estoque — Impressor de etiqueta".

## Respostas do dono no Cowork (06/10)

1. **"Entregue" vale dos dois lados** — marcou na plataforma, o Tiny acompanha; marcou no Tiny, a plataforma fecha sozinha.
2. **A janela do card vale para todo card** — avulso, peça de pedido, reposição e card do pedido.
3. **Menção** → aviso no sino **+ cartão de aviso na conversa particular** entre quem mencionou e quem foi mencionado.
4. **Entram também:** as correções do raio-x que mexem no caminho da peça (itens 1 a 6 da Q-72), a pausa com motivo e a tela do entregador. A impressora de etiqueta fica para depois.

## ↪️ 07/10: a Lei de Desempenho e Escala e a terceira sessão

O dono pediu (07/10) que toda solução seja **a mais otimizada do padrão de mercado** — a das plataformas que atendem milhares de usuários —, mesmo quando for mais difícil: primeira abertura em uma requisição, dado só no clique, websocket no lugar de relógio, sessão verificada sem ir ao banco, paginação em tudo, banco impecável. Virou a **regra 18** das regras do Claude Code e a nota [[PLT - Lei de Desempenho e Escala]] (com a pesquisa, os orçamentos e o retrato de hoje). A auditoria achou a plataforma longe disso (35 relógios, 3 telas relendo tudo a cada mudança de card, ~13 requisições na abertura, pacote de 1,8 MB, estoque de 1 a 4 s no banco).

**Decisão do dono (07/10):** as sessões **30 e 31 seguem a lei em tudo o que tocam**; a fundação e o resto da plataforma ficam para a **SESSAO-32, depois das duas**.

E a **regra 19** (pedido do dono, 07/10): o que for mapeado no Cowork vira **tarefa no ClickUp** (lista PRODUÇÃO do DPTO TI, tudo como tarefa, nada como subtarefa); o Claude Code move para **FAZENDO** ao começar e **nunca** para concluído — avisa o dono, que conclui.

## As sessões

| Ordem | Sessão | Entrega em uma frase |
|---|---|---|
| 30º | [[SESSAO-30 - Producao de Ponta a Ponta - Pedido Reabastecimento e Entrega]] | O caminho da peça sem furo: reservado em venda até a entrega, "Entregue" dos dois lados com o Tiny, tela do entregador com comprovante, raio-x 1–6 e o ensaio completo de pedido e reabastecimento |
| 31º | [[SESSAO-31 - Kanban Completo - Card Avulso Janela do Card Anexos e Conversa]] | Todo o kanban: aba Lançamento manual com card avulso, frente enxuta com etiquetas/responsáveis/datas/descrição ao passar o mouse, janela do card para todo card (descrição, tempo, histórico, anexos PDF/imagem/áudio, conversa com menções) e pausa com motivo |
| 32º | [[SESSAO-32 - Desempenho e Escala - Adequacao de Toda a Plataforma]] | A plataforma inteira dentro da lei: abertura em 1 requisição, permissões no token, websocket no lugar dos relógios, pacote dividido, banco ajustado, comercial e gravação do Tiny rápidos, listas por cursor e prova de carga |

**Ordem: 30 → 31 → 32** (a 32 depois das duas — decisão do dono em 07/10). Por quê: (a) o dono pediu primeiro o funcionamento correto do pedido; (b) a **base de anexos nasce na 30** (comprovante de entrega) e a 31 a evolui; (c) as duas mexem no PCP, no quadro e nas portas do kanban — em paralelo, os conflitos seriam certos. Paralelo só se o dono mandar abrir worktree, e aí a 31 começa pela parte sem anexos.

## De-para: pedido do dono → sessão

| Pedido | Sessão |
|---|---|
| Pedido do Tiny → PCP com sugestão de estoque → setor correto → concluído → aguardo → ROTAS | 30 (ensaio + raio-x 3/4/5) |
| Reservado para venda até alguém marcar entregue | 30 (§3.1 e §3.2) |
| Entregue ↔ Tiny | 30 (§3.2) |
| Tela do entregador (ClickUp) | 30 (§3.3) |
| Raio-x 1–6 | 30 (§3.4) |
| Reabastecimento ponta a ponta | 30 (§3.5) |
| Aba Lançamento manual + card avulso + vínculo opcional | 31 (§1) |
| Responsáveis, prioridade como etiqueta/campo, datas, descrição ao passar o mouse, card enxuto | 31 (§2) |
| Janela do card: descrição, tempo, histórico, edição, anexos PDF/imagem/áudio | 31 (§3) |
| Conversa ao lado + menção → sino + aviso no chat | 31 (§3) |
| Pausa com motivo (ClickUp) | 31 (§4) |

## Decisões que vão ser revistas (as sessões registram)

- **D-33/D-45** — a entrega passa a mudar o Tiny e a ser recebida do Tiny (30).
- **D-86** — "reservados em venda" inclui ROTAS até a entrega (30).
- **D-101** — pessoas põem e tiram etiqueta; campo vale em avulso (31).
- **D-59** — Pausar/Retomar voltam, dentro da janela do card; arrastar para PARADO pede o motivo (31).
- **D-22** — existe card de produção que não nasce de pedido nem de reposição (31).

## Tarefas no ClickUp (lista PRODUÇÃO · DPTO TI — tudo como tarefa)

| Sessão | Tarefas |
|---|---|
| 30 | [Produção - Reservado em venda até a entrega](https://app.clickup.com/t/17tya50fm3m) · [Rotas - Entregue nos dois lados (plataforma e Tiny)](https://app.clickup.com/t/17tya50fm3n) · [Rotas - Visualização dos entregadores](https://app.clickup.com/t/17tya50fbqb) · [Produção - Correções do raio-x no caminho da peça](https://app.clickup.com/t/17tya50fm3p) · [Produção - Teste de ponta a ponta do pedido e do reabastecimento](https://app.clickup.com/t/17tya50fm3q) · [Desempenho - Estoque, Pedidos em aguardo, PCP e ROTAS dentro da lei](https://app.clickup.com/t/17tya50fm43) |
| 31 | [Kanban - Cartões avulsos](https://app.clickup.com/t/17tya50fbyc) · [Kanban - Frente do card personalizável](https://app.clickup.com/t/17tya50fm3r) · [Kanban - Janela do card no estilo ClickUp](https://app.clickup.com/t/17tya50fm3t) · [Kanban - Anexar PDF E imagem](https://app.clickup.com/t/17tya50fbzq) · [Kanban - Conversa do card com menções](https://app.clickup.com/t/17tya50fm3u) · [Kanban - Pausa de um card com motivo de pausa](https://app.clickup.com/t/17tya50fc0c) · [Desempenho - Quadros, tablet e sino ao vivo por websocket](https://app.clickup.com/t/17tya50fm44) |
| 32 | [Desempenho - Primeira abertura em uma requisição](https://app.clickup.com/t/17tya50fm3v) · [Desempenho - Permissões no token, sem consultar o banco](https://app.clickup.com/t/17tya50fm3x) · [Desempenho - Tempo real por websocket no lugar das atualizações automáticas](https://app.clickup.com/t/17tya50fm3w) · [Desempenho - Pacote dividido por tela](https://app.clickup.com/t/17tya50fm3y) · [Desempenho - Telas lentas do comercial e gravação do pedido do Tiny](https://app.clickup.com/t/17tya50fm3z) · [Desempenho - Banco: índices, políticas de acesso e estatísticas](https://app.clickup.com/t/17tya50fm40) · [Desempenho - Rotinas do banco por evento, sem relógio](https://app.clickup.com/t/17tya50fm41) · [Desempenho - Listas por cursor](https://app.clickup.com/t/17tya50fm42) |

## Prompt pronto para colar (conversa nova do Claude Code por sessão)

```
Leia e siga: C:\Users\wccau\Domoby\Domoby - fabrica\_docs\Plataforma\CLAUDE - Regras do Claude Code (repo).md

Bloco 6 = Sessões 30 → 31 → 32 (plano em _docs\Planejamento\004 - PLANO - Bloco 6 - Producao de Ponta a Ponta e Kanban Completo.md), uma sessão por vez, checkpoint comigo ao fim de cada.
Comece pela SESSAO-30. Antes de codar, traga entendimento + as perguntas que a demanda lista.
```

Nas conversas seguintes, muda só a última linha: "SESSAO-30 já entregue — comece pela SESSAO-31" (e depois a 32).

## Ver também

[[PLT - Lei de Desempenho e Escala]] · [[000 - ORDEM DAS SESSOES]] · [[000 - PROXIMOS PASSOS]] · [[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]] · [[003 - PLANO - Integracao Completa Tiny da Fabrica]] · [[PLT - Perguntas em Aberto]]
