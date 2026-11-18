---
id: D-70
aliases: [D-70, D-070]
titulo: "O estoque dos acabados é a CONTAGEM da logística (entrada, baixa e contagem manual) — o Tiny sai da conta"
tipo: decisao
data: 2026-09-28
status: vigente
revisa: ["[[D-054 - O fluxo do estoque so peca pronta perfeita e sem pedido|D-54]]", "[[D-055 - O numero do estoque o do Tiny menos o que a loja ja vendeu|D-55]]"]
revisada_por: []
complementa: []
area: [estoque]
tags: [decisao, area/estoque]
---
# D-70 · O estoque dos acabados é a CONTAGEM da logística (entrada, baixa e contagem manual) — o Tiny sai da conta (28/09/2026) — ↩️ revisa a D-54 e a D-55

**↪️ 30/09/2026 ([[D-076 - O Tiny sobe a plataforma vale o saldo SOMADO das duas|D-76]]…[[D-079 - Ponto de partida ligar copia uma vez o saldo do Tiny tudo|D-79]]):** a contagem continua sendo o número, mas agora **conversa com o Tiny** (sincronismo ligado pelo admin): o Tiny acima sobe a plataforma, os gestos daqui deixam o Tiny igual, e a venda reserva a peça.

**Contexto (diagnóstico de 28/09, só leitura no banco real):** o número dos acabados era "saldo do Tiny − pedidos da loja em aberto" ([[D-055 - O numero do estoque o do Tiny menos o que a loja ja vendeu|D-55]]). Mas o aviso de estoque do Tiny não chega na saída da venda nem no "pronto" dos móveis — 9 avisos na vida toda, nenhum de móvel, o último em 25/09; 45 pedidos saíram da reserva sem aviso ([[Memoria - Tiny n8n e Integracoes 1#A-25|A-25]]). Só 19 dos 168 fabricados tinham saldo positivo e 57 viravam "necessidade extrema" sem pedido nenhum (o negativo do Tiny — P16). O dono, vendo a tela: *"porque nenhum produto está em estoque?"*.

**Decidido (pedido do dono na conversa, 28/09):** *"deve ter um botão de 'cadastrar produto ao estoque' … a logística irá dar baixa manual na quantidade de itens em estoque por enquanto"*.

- **O número de cada produto acabado (F/S/variação) = as peças livres no ESTOQUE** — a contagem da plataforma. A logística (e o admin) **cadastra** (entrada), **dá baixa** (sai a mais antiga primeiro) ou **confere a contagem** (o sistema acerta a diferença). Por baixo, cada peça é um card `unidade` sem pedido, com o produto do catálogo, direto no ESTOQUE — a mesma peça que a reposição e o pedido cancelado já deixam lá. Tudo por evento append-only (RNF-05); a baixa é o `card_arquivado` com o motivo, e a logística passa a poder arquivar peça livre do ESTOQUE.
- **Consequência boa, sem nada novo:** a sugestão do PCP na liberação ("há N no estoque — usar?", [[D-062 - A sugestao do estoque na liberacao o que e peca igual e quem|D-62]]) enxerga as peças cadastradas.
- **O Tiny sai da conta dos acabados** — fica nos insumos (M/K) e como referência no detalhe do produto. Os pedidos da loja em aberto **não descontam mais** o número (o pedido vira peça pela produção ou pela alocação do PCP). Acaba a "necessidade extrema" (↩️ D-55: o negativo era do Tiny).
- **A reposição automática** (ainda desligada) passa a olhar a contagem da plataforma e o mínimo efetivo; depois de um ciclo, reabre com **movimento novo do estoque** do produto (antes: leitura nova do Tiny). ⚠️ Antes de ligar, a logística precisa ter contado o estoque — senão todo produto com mínimo pede reposição.
- ↩️ **[[D-054 - O fluxo do estoque so peca pronta perfeita e sem pedido|D-54]]:** "não existe lançamento manual direto no ESTOQUE" deixa de valer — agora existe, pela logística/admin, só peça pronta e em perfeito estado (o ESTOQUE continua só com peça 🟢 e sem dono). "Por enquanto" (palavra do dono): quando o fluxo do galpão estiver todo na plataforma, a entrada vem da produção.
