---
id: D-186
aliases: [D-186]
titulo: "LANÇAR QUALQUER MÓVEL PARA PRODUÇÃO, A QUALQUER MOMENTO — o mesmo ícone da fábrica em todo cartão do Estoque"
tipo: decisao
data: 2026-10-23
status: vigente
revisa: ["[[D-087 - Liga desliga da reposicao automatica no Painel admin agendar|D-87]]", "[[D-089 - A lapidacao ao vivo do Estoque|D-89]]", "[[D-054 - O fluxo do estoque so peca pronta perfeita e sem pedido|D-54]]"]
revisada_por: []
complementa: []
area: [estoque, pcp]
tags: [decisao, area/estoque, area/pcp]
---
# D-186 · LANÇAR QUALQUER MÓVEL PARA PRODUÇÃO, A QUALQUER MOMENTO — o mesmo ícone da fábrica em todo cartão do Estoque (23/10/2026, pedido do dono — SESSAO-40) — ↩️ revisa a D-87 e a D-89 (o botão só com a automática desligada e o produto em necessidade) e a regra "uma reposição aberta por produto" da D-54 para o gesto da logística

**Pedido do dono:** *"Na parte de estoque, coloque um botão para lançar para produção mesmo estando com o estoque mínimo já suprido, coloque para lançar qualquer produto a qualquer momento, pode ser da mesma maneira do ícone vermelho."*

- **O ícone:** o MESMO da fábrica ao lado do "Mínimo", em **todo** móvel da aba dos acabados, para quem mexe no estoque (logística e admin): **vermelho pulando** quando falta peça e a reposição automática está desligada (o chamado da produção, como antes); **discreto** (cinza) no resto — no mínimo, fora do Top X, sem mínimo, com a automática ligada. No detalhe do produto (tocar na foto), o botão por extenso **"Lançar para produção"** ao lado de Entrada/Baixa/Contagem.
- **O lançamento:** o mesmo de antes (quantidade de 1 a 500, nasce no PCP → Reabastecimento, o PCP decide, parada 2 dias úteis sai sozinha — [[D-085 - Reposicao parada 2 dias uteis da FABRICA seg sex no PCP sai|D-85]]). A quantidade proposta é o que falta para o mínimo; sem falta, **1**. O texto diz quando nada falta ("a reposição nasce no PCP do mesmo jeito").
- **⏳ PROVISÓRIA (escolha do Claude):** se o produto **já tem uma reposição esperando no PCP**, a nova nasce **ao lado** (outro card de reabastecimento) — "a qualquer momento" vale também aí. A automática segue com UMA aberta por produto (ela não cria outra enquanto houver qualquer reposição aberta). O clique duplo (ou a rede que cai e volta) **não** cria duas: cada abertura do lançamento leva uma chave do gesto (Lei §10) e o mesmo toque devolve o card já criado.
- **Compatível:** sem a chave (o site de antes), a regra antiga (uma aberta por produto) continua.

**Descartadas:** somar as unidades na reposição que já está no PCP (mudaria o prazo de 2 dias úteis da parte antiga e exigiria um fato novo de "ampliar"); um botão grande por extenso em cada cartão (o dono pediu "da mesma maneira do ícone vermelho").
