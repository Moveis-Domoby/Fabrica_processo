---
titulo: "Mapa — Estoque"
tipo: mapa
area: estoque
atualizado: 2026-11-18
tags: [mapa, moc, area/estoque]
---

# 🗺️ MOC - Estoque

> O estoque dos móveis acabados e a reposição: só entra **peça pronta, perfeita e sem pedido**; a contagem é da logística; o Top X define a página e quem tem mínimo; abaixo do mínimo o estoque pede reposição ao PCP. O número conversa com o Tiny (saldo somado das duas empresas) e a venda reserva a peça na hora. Insumo, móvel e peça são coisas separadas.

**No código:** `src/paginas/Estoque.tsx` · `src/paginas/AdminEstoque.tsx` · `src/paginas/ClassificacaoProdutos.tsx` · `src/paginas/Danificados.tsx` · `src/logistica/`

**Notas da área:** [[003 - PLANO - Integracao Completa Tiny da Fabrica]] · [[N8N - Tiny Fabrica - Estudo do Cadastro]] · [[N8N - Tiny Fabrica Produtos para Banco]]

**Perguntas em aberto:** Q-72 (o pacote de correções do raio-x do estoque de 29/09 — anotado, sem correção) — [[PLT - Perguntas em Aberto]]

## Últimas sessões da área (a mais nova primeiro)

- **45** · [[SESSAO-45 - Rotas no Mapa Certo Liberar Peca na Expedicao e PCP Honesto]] · [[handoff_2026_11_04_sessao45_rotas_expedicao_pcp|handoff]]
- **40** · [[SESSAO-40 - Lancar Qualquer Produto Filtro por Pedido e Busca Geral]] · [[handoff_2026_10_23_sessao40_lancar_filtro_busca|handoff]]
- **32** · [[SESSAO-32 - Desempenho e Escala - Adequacao de Toda a Plataforma]] · [[handoff_2026_10_16_sessao32_desempenho_escala|handoff]]
- **30** · [[SESSAO-30 - Producao de Ponta a Ponta - Pedido Reabastecimento e Entrega]] · [[handoff_2026_10_08_sessao30_producao_ponta_a_ponta|handoff]]
- **25** · [[SESSAO-25 - Integracao Tiny Fabrica - Estoque e Minimos]] · [[handoff_2026_09_26_sessao25_estoque|handoff]]
- **24** · [[SESSAO-24 - Estoque Nucleo - Aguardo Cancelamentos e Alocacao]] · [[handoff_2026_09_27_sessao24_producao_concluida|handoff]]

<!-- gerado:inicio -->
## Decisões vigentes (19)

- [[D-007 - Estoque modulo da mesma plataforma fase 2|D-7]] · Estoque: módulo da mesma plataforma, fase 2
- [[D-053 - Estoque na frente a 25 troca de ordem com a 24 e absorve|D-53]] · Estoque na frente: a 25 troca de ordem com a 24 e absorve o estoque-base
- [[D-056 - O ID da peca e o SKU reservada ganha a segunda etiqueta a|D-56]] · O ID da peça é o SKU; reservada ganha a segunda etiqueta, a do pedido — fecha a Q-63
- [[D-062 - A sugestao do estoque na liberacao o que e peca igual e quem|D-62]] · A sugestão do estoque na liberação: o que é "peça igual" e quem aceita
- [[D-070 - O estoque dos acabados e a CONTAGEM da logistica entrada|D-70]] · O estoque dos acabados é a CONTAGEM da logística (entrada, baixa e contagem manual) — o…
- [[D-073 - Foto de cada produto no estoque so a logistica e o admin|D-73]] · Foto de cada produto no estoque — só a logística e o admin cadastram
- [[D-074 - Estoque enxuto i no lugar do texto abas em quadrados no canto|D-74]] · Estoque enxuto: "i" no lugar do texto, abas em quadrados no canto superior direito,…
- [[D-076 - O Tiny sobe a plataforma vale o saldo SOMADO das duas|D-76]] · O Tiny sobe a plataforma: vale o saldo SOMADO das duas empresas; Tiny acima → a…
- [[D-077 - A plataforma manda no Tiny entrada baixa e contagem daqui|D-77]] · A plataforma manda no Tiny: entrada, baixa e contagem daqui deixam o Tiny com o número…
- [[D-078 - A venda reserva a peca na hora o pedido segue no PCP|D-78]] · A venda reserva a peça na hora; o pedido segue no PCP, que decide; nada da venda vai ao…
- [[D-079 - Ponto de partida ligar copia uma vez o saldo do Tiny tudo|D-79]] · Ponto de partida: ligar copia uma vez o saldo do Tiny; tudo nasce desligado e só o admin…
- [[D-081 - As fotos dos produtos vem do Tiny e aparecem inteiras sem|D-81]] · As fotos dos produtos vêm do Tiny e aparecem inteiras, sem corte
- [[D-083 - O Top X manda no estoque e o tamanho da pagina e so ele tem|D-83]] · O Top X manda no estoque: é o tamanho da página e só ele tem mínimo; a capacidade do…
- [[D-084 - Sugestao por dias uteis de VENDA loja seg sab e minimo|D-84]] · Sugestão por dias úteis de VENDA (loja seg–sáb) e mínimo AUTOMÁTICO que trava ao editar;…
- [[D-085 - Reposicao parada 2 dias uteis da FABRICA seg sex no PCP sai|D-85]] · Reposição parada 2 dias úteis da FÁBRICA (seg–sex) no PCP sai sozinha — o Sistema…
- [[D-118 - Reservados em venda ate a ENTREGA|D-118]] · Reservados em venda até a ENTREGA
- [[D-119 - Os numeros do estoque ficam PRONTOS no banco o ranking|D-119]] · Os números do estoque ficam PRONTOS no banco; o ranking das vendas anda de madrugada
- [[D-138 - SESSAO-32 o OK dos indices e os insumos separados dos moveis|D-138]] · SESSAO-32: o OK dos índices e os insumos separados dos móveis no estoque
- [[D-186 - Lancar qualquer movel para producao a qualquer momento|D-186]] · LANÇAR QUALQUER MÓVEL PARA PRODUÇÃO, A QUALQUER MOMENTO — o mesmo ícone da fábrica em…

## Provisórias ⏳ — valem até o dono dizer o contrário (1)

- [[D-220 - O PCP e o Estoque falam das mesmas pecas com as mesmas|D-220]] · O PCP e o Estoque falam das mesmas peças com as mesmas palavras

## Revisadas por outra (12) — só para a história

[[D-018 - Fins de linha ESTOQUE e ROTAS nascem juntos|D-18]] · [[D-038 - Logistica Estoque com ID digitavel sala de Pedidos em aguardo|D-38]] · [[D-045 - Logistica e ROTAS unidade pronta lancamento ID de producao|D-45]] · [[D-054 - O fluxo do estoque so peca pronta perfeita e sem pedido|D-54]] · [[D-055 - O numero do estoque o do Tiny menos o que a loja ja vendeu|D-55]] · [[D-057 - Estoque em duas telas sugestao de minimo pelo top 20|D-57]] · [[D-061 - Cancelamento em tres estagios a aba Cancelados guarda|D-61]] · [[D-071 - Top 20 a tela do estoque abre pelos 20 mais vendidos|D-71]] · [[D-072 - Minimo e capacidade do galpao na plataforma a sugestao|D-72]] · [[D-086 - Reservados o cartao mostra TUDO que esta em producao|D-86]] · [[D-087 - Liga desliga da reposicao automatica no Painel admin agendar|D-87]] · [[D-089 - A lapidacao ao vivo do Estoque|D-89]]

## Onde mais ler (só o que a demanda tocar)

- **Banco:** [[Banco - Estoque e Reposicao]]
- **Lições:** [[Memoria - Regras de Negocio - Producao PCP Estoque e Rotas 1]] · [[Memoria - Regras de Negocio - Producao PCP Estoque e Rotas 2]] · [[Memoria - Regras de Negocio - Producao PCP Estoque e Rotas 3]]
- **Design:** [[Design - Estoque e PCP]]
<!-- gerado:fim -->
