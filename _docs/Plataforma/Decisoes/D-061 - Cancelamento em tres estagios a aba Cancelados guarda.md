---
id: D-61
aliases: [D-61, D-061]
titulo: "Cancelamento em três estágios; a aba Cancelados guarda para sempre; peça inacabada não vai para o estoque"
tipo: decisao
data: 2026-09-27
status: revisada
revisa: []
revisada_por: ["[[D-088 - O PCP em tres abas Reabastecimento Pedidos aguardando|D-88]]", "[[D-290 - Mover a peca para CANCELADO ou NAO ENCONTRADO cancela|D-290]]"]
complementa: []
area: [pcp, estoque]
tags: [decisao, area/pcp, area/estoque]
---
# D-61 · Cancelamento em três estágios; a aba Cancelados guarda para sempre; peça inacabada não vai para o estoque (27/09/2026)

**Decidido (respostas b2 e b3 do dono na SESSAO-24, sobre o desenho da demanda):**

- **Cancelado ainda no PCP** (nada produzido): o pedido sai do quadro do PCP e vai para a **aba Cancelados** do PCP — que **guarda para sempre** (b3), paginada, carregada só ao abrir.
- **Cancelado com peça em produção:** a peça **segue em produção** com a etiqueta **"Pedido cancelado — pronta, vai para o estoque"**; ao ser concluída na LIMPEZA E EMBALAGEM, vai ao **ESTOQUE sem dono**. Nada de estocar peça inacabada (b2): *"a peça continua em produção e logo mais irá para o estoque de peças de fato, não de produtos prontos"* (o estoque de peça é o próximo passo — [[D-057 - Estoque em duas telas sugestao de minimo pelo top 20|D-57]]).
- **Cancelado com peça pronta** (em Pedidos em aguardo): a peça vai **sozinha** ao ESTOQUE, **sem dono** (o produto do catálogo é achado pelo SKU). Personalizado cancelado também vai ao estoque (a exceção da [[D-055 - O numero do estoque o do Tiny menos o que a loja ja vendeu|D-55]]).
- A etiqueta é lida da situação do pedido no Tiny (a mesma fonte do cancelamento) — nada guardado à parte.
- ↩️ **11/11/2026 ([[D-290 - Mover a peca para CANCELADO ou NAO ENCONTRADO cancela|D-290]], SESSAO-48):** a peça de pedido cancelado que está **em produção** não segue mais sozinha para o estoque — ela fica "esperando decisão" e a logística escolhe o destino (seguir para o estoque, passar para outro pedido ou cancelar a fabricação); sem decisão, ao chegar ao fim da linha, vale a regra antiga (ESTOQUE sem dono). A peça **pronta** continua indo sozinha ao ESTOQUE. E mover qualquer peça para CANCELADO ou NÃO ENCONTRADO tira ela da produção na hora.
