---
id: D-201
aliases: [D-201]
titulo: "O PEDIDO NOVO USA, PELO PCP, A PEÇA SEM DONO QUE JÁ ESTÁ EM PRODUÇÃO — da reposição de estoque ou de pedido cancelado; a reposição só perde a peça"
tipo: decisao
data: 2026-10-28
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-062 - A sugestao do estoque na liberacao o que e peca igual e quem|D-62]]", "[[D-054 - O fluxo do estoque so peca pronta perfeita e sem pedido|D-54]]", "[[D-061 - Cancelamento em tres estagios a aba Cancelados guarda|D-61]]"]
area: [pcp]
tags: [decisao, area/pcp]
---
# D-201 · O PEDIDO NOVO USA, PELO PCP, A PEÇA SEM DONO QUE JÁ ESTÁ EM PRODUÇÃO — da reposição de estoque ou de pedido cancelado; a reposição só perde a peça (28/10/2026, pedido do dono) — ↪️ D-62, D-54 e D-61

**Pedido do dono:** *"Quando um pedido de reposição de estoque é lançado e chega um pedido de venda para o móvel que já está em produção como reposição de estoque, precisamos que seja possível lincar o pedido que acabou de chegar com o que já está em produção para reposição de estoque através do PCP mesmo; atualmente é possível liberar apenas o estoque para um pedido novo que chegou, porém deve ser possível também transformar o card do pedido de reposição em um card de pedido de venda através do PCP caso tenha de fato algum já em produção."*

**Decidido (respostas do dono, 28/10):**

- **Onde:** na janela **"Liberar unidades"** do pedido, no PCP — do mesmo jeito da sugestão do estoque ([[D-062 - A sugestao do estoque na liberacao o que e peca igual e quem|D-62]]). O móvel que não tem peça pronta no estoque, mas tem uma **igual sendo produzida sem dono**, ganha **"Há N igual(is) em produção, sem dono — usar?"**, com onde ela está (setor · etapa) e de onde veio. **Vem desmarcada** — o PCP decide.
- **Vale para** a peça da **reposição de estoque** E a peça de **pedido cancelado que segue em produção** (resposta: *"Isso, e peça de cancelado também"*). A peça danificada não entra. "Igual" é a régua de sempre (D-62: o produto pelo SKU; personalizada, SKU + descrição).
- **Mais de uma:** a plataforma escolhe a **mais adiantada** (o setor mais à frente, a etapa mais à frente, há mais tempo ali).
- **Usar = a peça passa a ser deste pedido ONDE ESTÁ:** setor, etapa, quem trabalha nela e o tempo seguem iguais; o card passa a mostrar o pedido, o cliente, o prazo e a prioridade do pedido; pronta, vai para **Pedidos em aguardo** (não para o estoque). Fica na história da peça ("Passou a ser do pedido N (k/n) em MONTAGEM — era da reposição de estoque").
- **Do lado do estoque, a reposição só perde a peça** (resposta: *"Só perde a peça"*): o estoque passa a esperar uma peça a menos; se ficar abaixo do mínimo, a reposição automática ou o botão da logística lançam de novo, como já acontece. A vaga dessa peça na reposição continua contada como liberada (a reposição não pede de novo).
- **O fim do tempo em PCP do pedido** é o instante da ligação (não a criação antiga da peça).

**Como ficou (técnico):** migration `20261028020000` — o fato novo **`peca_vinculada`** (na peça; tipo acrescentado ao check de `plt_eventos`) com projeção própria (`fn_projetar_peca_vinculada`: pedido, pai, item, k/n e o retrato do item vêm do fato; a peça de reposição guarda a reposição como pai, a de cancelado passa a ter o pedido novo como pai); `fn_sugestoes_em_producao` (lida pela janela, na MESMA requisição: `em_producao`); `fn_vincular_peca_producao` (as conferências) chamada por `plt_fn_pcp_liberar` com `{item_seq, indice_unidade, peca_producao_id}`; `fn_recalcular_liberacao` conta a ligação no fim do tempo em PCP; a janela e a liberação da reposição leem a vaga original no fato. O número do estoque troca a peça de "a caminho do estoque" para "de pedido" pela projeção de sempre (`plt_estoque_numeros`).

**Descartadas:** criar um card novo para o pedido e arquivar o da reposição (perderia o tempo, quem está trabalhando e a história da peça); a reposição ganhar uma peça nova sozinha (o dono escolheu "só perde a peça"); selo "N em produção" no cartão do pedido no PCP (mexeria na porta do quadro do PCP — fica para quando o dono pedir); escolher a peça numa lista (a mais adiantada resolve o caso comum).
