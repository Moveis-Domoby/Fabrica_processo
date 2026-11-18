---
id: D-139
aliases: [D-139]
titulo: "SESSAO-32: o Comercial abre no mês atual e o período inteiro vem pronto do banco"
tipo: decisao
data: 2026-10-16
status: vigente
revisa: []
revisada_por: []
complementa: []
area: [comercial]
tags: [decisao, area/comercial]
---
# D-139 · SESSAO-32: o Comercial abre no mês atual e o período inteiro vem pronto do banco (16/10/2026)

**Pedido do dono (16/10, ~04:20 UTC):** *"Vi que o modulo comercial ainda está bem lento, ele está carregando todos os pedidos de uma única vez de forma errônea, ajuste para que a busca inicial seja apenas para o mês atual, não para todo o período, ajuste também para que a ida ao banco quando o filtro for todo o período, a tela já esteja montada lá e me devolva de forma quase instantânea"*. **OK para aplicar:** *"PODE"* (16/10, ~05:28 UTC), depois da prova no banco real; a mudança liga gatilhos na gravação de pedidos e clientes do Tiny (regra 3) — explicado a ele antes.

1. **A primeira busca é do mês atual.** O Painel de Recompra abre em "Do mês" (o atual); no Dashboard, o que abria em "Tudo" (os números do topo, a frequência de compra e o top de produtos) abre no mês atual. Os gráficos de linha do tempo (faturamento por mês e sazonalidade em 6 meses, transições em 3) seguem com o período deles — um mês só não desenha linha. "Todo o período" fica a um toque.
2. **A tela fica pronta no banco.** Os pedidos já desmontados, a vida de cada cliente e as contas por mês ficam guardados e se atualizam no fato — a gravação do pedido pelo n8n e a troca do telefone do cliente (gatilho à prova de falha: um erro ali nunca derruba a gravação do Tiny; o pedido fica anotado e a próxima gravação refaz). O "todo o período" sem busca nem produto sai direto da vida de cada cliente; meses inteiros saem das contas do mês.
3. **Mesmos números.** Provado porta antiga × nova na bateria e no banco real (transação desfeita): 0 diferença em 21 filtros do Painel de Recompra (25.517 linhas) e 7 períodos do Dashboard (17.141 linhas), views idênticas linha a linha, a tela pronta = os pedidos (conferência 0), transação desfeita.
4. **Como ficou:** aplicada em 16/10 ~05:30 UTC + site publicado no mesmo gesto. No banco real, como o dono: Painel de Recompra no mês atual 1,9 ms (126 clientes) e no período inteiro 3 ms (4.264 clientes; antes 1,5–2,5 s); números do período inteiro 1,3 ms (antes 66 ms–2,3 s); top de produtos 2,9 ms (antes 220 ms); maiores clientes 0,6 ms (antes 149 ms). A tela pronta = os 5.568 pedidos (conferência 0); o gatilho testado numa transação desfeita (valor e telefone acompanhados na hora); quem não tem o módulo segue barrado.
