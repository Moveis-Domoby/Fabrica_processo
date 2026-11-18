---
id: D-199
aliases: [D-199]
titulo: "FILTROS NA PROGRAMAÇÃO DE CAMINHÃO — a lista para programar com busca, situação, previsão, cidade, bairro e ordens novas; \"Já programadas\" com busca, caminhão e dia"
tipo: decisao
data: 2026-10-27
status: vigente
revisa: []
revisada_por: []
complementa: []
area: [logistica-rotas]
tags: [decisao, area/logistica-rotas]
---
# D-199 · FILTROS NA PROGRAMAÇÃO DE CAMINHÃO — a lista para programar com busca, situação, previsão, cidade, bairro e ordens novas; "Já programadas" com busca, caminhão e dia (27/10/2026, pedido do dono — SESSAO-41)

**Pedido do dono:** *"Na tela de programação de um caminhão, adicione alguns filtros variados também, seja por ordenar por ordem alfabética e tudo mais"*. Respostas: os quatro filtros (busca por texto, situação do pedido, cidade e bairro, previsão de entrega); as ordens cliente de A a Z / Z a A, mais peças primeiro, pedido mais novo / mais antigo; **nas duas abas**; subir junto com o ajuste do card esquecido. Depois: *"Nao aguarde minha aprovação para nada, apenas suba, nao estarei em casa para aprovar, entao suba e eu testo em produçao mesmo"*.

- **Programar (os pedidos sem rota):** busca (nº do pedido que começa com — também "pedido N" e "#N"; senão cliente, endereço, bairro, cidade ou móvel que contém, sem acento e sem maiúscula), **situação** (prontos · em produção · ainda no PCP), **previsão de entrega** (atrasados · para hoje · esta semana · próximos 15 dias · sem previsão), **cidade** e **bairro** (sem cidade escolhida, o bairro aparece com a cidade — "Centro · Parnamirim" — e escolhê-lo escolhe a cidade junto; trocar a cidade solta o bairro). Cada opção diz quantos pedidos há.
- **Ordenar por:** dia de entrega mais perto (o padrão) · mais perto (da rota ou da fábrica) · cliente de A a Z · cliente de Z a A · mais peças primeiro · pedido mais novo primeiro · pedido mais antigo primeiro (pela data do pedido) · número do pedido.
- **O pedido já marcado para a rota não sai dela quando um filtro o esconde da lista.**
- **Já programadas:** busca, caminhão e dia. A busca traz a **rota inteira** que tem o pedido (ou a parada avulsa — título, endereço, observação) que bate: o mapa e a ordem das paradas não se quebram. A ordem das paradas continua a da rota.
- Quem filtra e ordena é o **servidor** (a busca acha o pedido mesmo fora dos 200 que a lista mostra), numa requisição só por tela — as opções e os "quantos" vêm junto.
- ⏳ **PROVISÓRIAS (escolha do Claude — confirmar):** (a) "esta semana" = domingo a sábado, como o calendário da Programação (inclui o atrasado do começo da semana); (b) os "quantos" das opções contam todos os pedidos sem rota (não mudam com os outros filtros — a opção nunca some); (c) a busca de "Já programadas" traz a rota inteira, não só o pedido que bateu.
