---
id: D-55
aliases: [D-55, D-055]
titulo: "O número do estoque: o do Tiny menos o que a loja já vendeu e ainda não saiu; negativo = \"necessidade extrema\""
tipo: decisao
data: 2026-09-26
status: revisada
revisa: []
revisada_por: ["[[D-070 - O estoque dos acabados e a CONTAGEM da logistica entrada|D-70]]"]
complementa: []
area: [estoque]
tags: [decisao, area/estoque]
---
# D-55 · O número do estoque: o do Tiny menos o que a loja já vendeu e ainda não saiu; negativo = "necessidade extrema" (26/09/2026)

**↩️ revisada em 2026-09-28 ([[D-070 - O estoque dos acabados e a CONTAGEM da logistica entrada|D-70]]):** nos ACABADOS o número passou a ser a contagem da logística (peças livres no ESTOQUE) — o Tiny não avisava a saída da venda nem o pronto dos móveis, e o negativo dele virava falsa "necessidade extrema". Esta regra (Tiny − reservas) segue só para matéria-prima e insumos.

**Decidido (respostas 1, 2 e 3 do dono, SESSAO-25):** *"o pessoal cadastra o produto dentro do Tiny como pronto, o Tiny aumenta a quantidade; quando um pedido de venda é gerado no Tiny da loja, ele já debita automaticamente do Tiny da fábrica … para eles o negativo é necessidade de produção, mas na nossa plataforma não faremos assim, não teremos estoque negativo, quando ficar negativo é porque é necessidade extrema de produção."*

- **Saldo do Tiny = leitura derivada** do último aviso de cada produto (webhook de lançamentos de estoque ou a carga inicial) — **sem tabela e sem coluna nova** (resposta 1: "faça o mais profissional, otimizado e rápido"; o dono autorizou 2 colunas em `produtos` se um dia precisar).
- **Disponível = saldo físico lido − reservas abertas** (itens não personalizados de pedidos da loja em aberto/aprovado/preparando envio, casados por SKU). O Tiny **não avisa** quando sai pedido (46 pedidos, 0 avisos — a reserva não é lançamento); a plataforma faz a conta com os pedidos que já chegam ao banco.
- **Na tela, nunca negativo** ([[D-053 - Estoque na frente a 25 troca de ordem com a 24 e absorve|D-53]]): mostra 0 e a **"necessidade extrema — N vendidos sem estoque"** (ícone + texto).
- **Tiny e plataforma nunca se somam** (resposta 2): "Em estoque" (Tiny) · "Reservados" (prontos com pedido) · "Livres na plataforma" (prontos sem pedido, da reposição).
- **Venda da loja debita** = a reserva derivada acima (a venda nova entra na conta na hora).
- **Personalizado** não reserva nem desconta o produto do catálogo (a loja reusa o SKU com outras medidas). **Exceção (dono, 26/09):** personalizado produzido cujo pedido foi cancelado **vai para o estoque** e, a partir daí, uma venda igual dá baixa nele — fluxo do cancelamento, [[SESSAO-24 - Estoque Nucleo - Aguardo Cancelamentos e Alocacao]].

⚠️ **Achado da carga de 26/09 (para o dono):** o **físico** dos fabricados no Tiny está **negativo em 93 de 168** (venda que baixou sem o "pronto" correspondente) e a **reserva do Tiny não bate com os pedidos abertos** (ex.: 327 com 44 reservados no Tiny × 0 pedidos abertos no banco; serviços da própria fábrica — Corte, Furo, FITAMENTO — com milhares reservados). Por isso a plataforma usa os pedidos abertos, não o `saldoReservado` do Tiny.
