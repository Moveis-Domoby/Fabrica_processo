---
id: D-98
aliases: [D-98, D-098]
titulo: "O cliente é achado pelo cadastro do Tiny; o fluxo de vendas passa esse número — item C da SESSAO-29"
tipo: decisao
data: 2026-10-01
status: vigente
revisa: []
revisada_por: []
complementa: []
area: [tiny-n8n]
tags: [decisao, area/tiny-n8n]
---
# D-98 · O cliente é achado pelo cadastro do Tiny; o fluxo de vendas passa esse número (01/10/2026) — item C da SESSAO-29

**Achado (só leitura, 01/10):** o pedido que o Tiny devolve (`pedido.obter`) **não traz o número do cadastro do cliente** — só nome, CPF, telefone e endereço; o número só vem no **aviso de venda**, e o fluxo de vendas do n8n o descartava. E o nome que vem no pedido é o **atual** do cadastro (4.932 de 4.932 pedidos da carga histórica batem com o cadastro).

**Decidido:** o cliente do pedido é achado nesta ordem — **1)** o número do cadastro do Tiny (quando o aviso traz); **2)** o CPF/CNPJ; **3)** o cliente que o pedido **já tem**, quando nada prova que é outra pessoa (sem CPF dos dois lados e sem número de cadastro que contradiga) — é o contato renomeado no Tiny; **4)** nome + telefone; **5)** cliente novo. O CPF nunca é copiado para um cliente se já pertence a outro. Resposta 1 do dono sobre a mudança no fluxo de vendas: *"Você gera para mim e eu edito o fluxo"* — o passo a passo está no handoff; **o banco já aceita o número** (sem ele, os passos 2–5 seguem valendo).

**Consequência:** reprocessar um pedido de cliente sem CPF renomeado no Tiny não cria mais cliente duplicado; um pedido **novo** desse cliente só deixa de duplicar quando o fluxo de vendas passar o número do cadastro.
