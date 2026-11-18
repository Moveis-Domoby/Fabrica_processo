---
id: D-129
aliases: [D-129]
titulo: "Devolução: o entregador não marca mais \"Pedido devolvido\"; a LOGÍSTICA marca, as peças ficam \"Em decisão pós devolução\" e a logística decide"
tipo: decisao
data: 2026-10-13
status: vigente
revisa: ["[[D-114 - Cancelado ou devolvido com o movel pronto vai SOZINHO para|D-114]]", "[[D-115 - O entregador usuario so de ROTAS a tela das entregas do dia|D-115]]", "[[D-124 - O marcador Devolvido do Tiny NAO e cancelamento a fabrica|D-124]]"]
revisada_por: []
complementa: []
area: [logistica-rotas, expedicao]
tags: [decisao, area/logistica-rotas, area/expedicao]
---
# D-129 · Devolução: o entregador não marca mais "Pedido devolvido"; a LOGÍSTICA marca, as peças ficam "Em decisão pós devolução" e a logística decide (13–14/10/2026, pedido do dono) — ↩️ revisa a D-114, a D-115 e a D-124

**Pedido do dono:** *"remova o botão pedido devolvido, me contaram hoje que o entregador não pode ter esse controle nas mãos, uma vez que sempre que o pedido é devolvido, a fábrica não cadastra em estoque logo em seguida, primeiro o produto volta para a loja para tentar renegociar com o cliente"* · *"no estoque apareça mais uma linha caso o produto seja devolvido e esse produto fica aguardando decisão da logística … além da linha de reservado para produção, reservado para venda, será adicionada a linha de 'Em decisão pós devolução'"* · *"siga essa do botão para a logística, a própria recebe uma notificação e aparece uma telinha de 'Decidir situação' para que a logística apenas receba o mini relatório com o motivo … e decida o que fazer, devolver ao estoque, reenviar produto, realocar peça para outro pedido e opções do tipo"* · *"se chegou danificada, vai para danificados, devolução de peça já entregue pode ocorrer também"*.

- **O entregador perde o botão "Pedido devolvido"** (a tela dele fica com Comentário · Entregue · Não entregue · Comprovante · WhatsApp · Mapa). O "Não entregue" fica como está.
- **A logística (e o admin) marca "Pedido devolvido"**, com motivo (lista própria em Utilitários) e observação — em ROTAS → Entregas (pedido na ROTAS) e na janela completa do pedido no PCP (inclusive **pedido já entregue**). O Tiny não muda.
- As peças do pedido ficam **"Em decisão pós devolução"** — continuam do pedido, saem da ROTAS e da programação, e aparecem no **Estoque** numa linha nova ao lado de "reservados em venda" e "reservados para produção". A logística recebe **um aviso no sino** que abre a telinha **"Decidir situação"**: o mini relatório (pedido, cliente, quem marcou e quando, o motivo, a observação, o histórico da entrega — não entregue com motivo, comentários do entregador, comprovantes — e as peças) e as decisões, peça por peça ou todas:
  - **Reenviar ao cliente** — a peça volta com o pedido para "Programar" nas ROTAS (pedido já entregue: a entrega é reaberta só na plataforma; o Tiny não muda);
  - **Devolver ao estoque** — vira peça livre no ESTOQUE da fábrica;
  - **Realocar para outro pedido** — a peça passa a ser de outro pedido vivo do mesmo produto, pronta em Pedidos em aguardo;
  - **Danificada → Danificados**;
  - **Liberar para o estoque da loja** — sai das contas do galpão da fábrica, registrado "foi para a loja" (o Tiny não muda);
  - **Mandar para ajuste** — abre um ajuste de peça ([[D-130 - O ajuste de peca um card avulso de ajuste que leva a peca|D-130]]).
- **O marcador "Devolvido" do Tiny não faz nada** ([[D-124 - O marcador Devolvido do Tiny NAO e cancelamento a fabrica|D-124]] mantida): quem marca a devolução na plataforma é a logística.
- Cancelado no Tiny com móvel pronto continua indo **sozinho** ao ESTOQUE ([[D-114 - Cancelado ou devolvido com o movel pronto vai SOZINHO para|D-114]] nessa parte) — exceto a peça que já está em decisão: essa espera a decisão da logística.
