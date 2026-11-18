---
id: D-78
aliases: [D-78, D-078]
titulo: "A venda reserva a peça na hora; o pedido segue no PCP, que decide; nada da venda vai ao Tiny"
tipo: decisao
data: 2026-09-30
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-062 - A sugestao do estoque na liberacao o que e peca igual e quem|D-62]]", "[[D-070 - O estoque dos acabados e a CONTAGEM da logistica entrada|D-70]]"]
area: [estoque, tiny-n8n]
tags: [decisao, area/estoque, area/tiny-n8n]
---
# D-78 · A venda reserva a peça na hora; o pedido segue no PCP, que decide; nada da venda vai ao Tiny (30/09/2026) — ↪️ D-62 e D-70

**Decidido (dono, 29–30/09):** *"sempre que um pedido de venda for gerado com o produto daquele sku, a plataforma deve ver e diminuir menos 1 do estoque, isso não deve disparar nada para o tiny"*; e, na pergunta sobre reservar ou só baixar: *"a peça é reservada no estoque para atualizar em tempo real, mas deve aparecer no pcp ainda para ele liberar, se ele não liberar, a peça volta para o estoque e manda o tiny somar mais 1 lá também, o pcp decide a produção completa"*.

- Pedido **novo** da loja (chegou depois de ligar o sincronismo), em aberto/aprovado/preparando envio: cada unidade de produto acabado do catálogo **reserva uma peça livre igual** (a mais antiga) — o número do estoque cai na hora e a peça aparece como "reservada para o pedido N". Uma vez só, na chegada da venda (a peça que entra depois não é reservada para pedido antigo). Frete não reserva ([[D-063 - Frete nao vira peca de producao o resto nasce no PCP e o PCP|D-63]]); personalizado não ([[D-055 - O numero do estoque o do Tiny menos o que a loja ja vendeu|D-55]]).
- No **PCP**, a unidade vem com a peça reservada **já marcada** para usar (↪️ [[D-062 - A sugestao do estoque na liberacao o que e peca igual e quem|D-62]], que vinha desmarcada). Usar → a unidade nasce pronta em Pedidos em aguardo (nada ao Tiny). **Desmarcar e liberar para a produção** → a reserva se desfaz, a peça volta livre e o Tiny recebe de volta ([[D-077 - A plataforma manda no Tiny entrada baixa e contagem daqui|D-77]]).
- **Cancelado** → a reserva se desfaz (sem Tiny). **Item mudou/saiu** → desfaz. **Faturado / pronto para envio / enviado / entregue / não entregue** → a peça saiu com o pedido (baixa "venda", sem Tiny).
- Contagem é **física**: conta as reservadas que ainda estão no galpão; contar menos que elas é recusado.
- Só a plataforma reserva (vale até para a chave de serviço). Depois de cada venda, uma leitura do Tiny só para conferir.
