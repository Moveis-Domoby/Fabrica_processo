---
id: D-130
aliases: [D-130]
titulo: "O ajuste de peça: um card avulso de \"ajuste\" que leva a peça de volta à produção com DESTINO FINAL definido pelo PCP"
tipo: decisao
data: 2026-10-13
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-125 - O card avulso quem cria como termina vinculo etiquetas quem|D-125]]", "[[D-129 - Devolucao o entregador nao marca mais Pedido devolvido|D-129]]"]
area: [kanban-producao]
tags: [decisao, area/kanban-producao]
---
# D-130 · O ajuste de peça: um card avulso de "ajuste" que leva a peça de volta à produção com DESTINO FINAL definido pelo PCP (13–14/10/2026, pedido do dono) — ↪️ D-125/D-129

**Pedido do dono:** *"deve ser criado dentro dos cards avulsos a possibilidade de um card para ajuste de peças, pode ser que a peça tenha ido mal acabada para o cliente e o cliente devolva para a fábrica ajustar ela, essa peça irá ou para limpeza e embalagem ou algo do tipo, isso é decisão do PCP … o PCP pode decidir o destino final após a limpeza e embalagem lançar na etapa expedição; na criação desse tipo de card, o PCP pode definir (vai para o estoque, vai para rotas, terceirizado, entre outros)"*.

- No **Lançamento manual**, "Novo card" tem o tipo **"Ajuste de peça"**: escolhe-se a peça (a que está em decisão pós devolução, no estoque, no aguardo, ou a já entregue de um pedido), o **setor** para onde ela vai e o **destino final**. Também nasce da decisão "Mandar para ajuste" ([[D-129 - Devolucao o entregador nao marca mais Pedido devolvido|D-129]]).
- **A peça é uma só** (decisão do Claude — [[Memoria - Modelos Formulas e Possibilidades#M-2|M-02]]/M-04): o ajuste não cria uma peça nova; a mesma peça (com a história dela) volta à produção, com o selo "Ajuste · destino: …", e aparece na aba Lançamento manual junto com os avulsos.
- **Destino final**, aplicado quando a peça é solta na **EXPEDIÇÃO** da LIMPEZA E EMBALAGEM ([[D-127 - A LIMPEZA E EMBALAGEM conclui pela etapa EXPEDICAO o botao|D-127]]) — ou no "Concluir" do ajuste em qualquer setor: **ESTOQUE** (peça livre) · **volta ao pedido / ROTAS** (Pedidos em aguardo, ou direto para a ROTAS se o pedido já estava lançado; pedido já entregue: reentrega, a entrega reaberta só na plataforma) · **terceirizado** · **loja** (as duas: sai das contas do galpão, registrado) · **Danificados**.
- Sem regra de estado da peça, a não ser a da [[D-126 - A marcacao do estado da peca perfeito atencao danificado vira|D-126]].
