---
id: D-75
aliases: [D-75, D-075]
titulo: "O quadrinho do PCP na Visão do dia conta o que o quadro do PCP mostra — reposição inclusa; \"liberadas hoje\" fica como está"
tipo: decisao
data: 2026-09-28
status: revisada
revisa: []
revisada_por: ["[[D-132 - O PCP segue o Tiny pedido Faturado Pronto para envio|D-132]]"]
complementa: ["[[D-042 - Dashboards guiados por imagem docs inspiracao dashboards e|D-42]]"]
area: [pcp]
tags: [decisao, area/pcp]
---
# D-75 · O quadrinho do PCP na Visão do dia conta o que o quadro do PCP mostra — reposição inclusa; "liberadas hoje" fica como está (28/09/2026) — ↪️ ajusta o painel da SESSAO-16 (D-42)

**Contexto (achado do ajuste do Frete, conferido só com leitura no banco real):** a Visão do dia dizia **233 "a liberar"** e o quadro do PCP mostrava **33**. Desde a SESSAO-23 o quadro esconde o pedido que o Tiny já encerrou (entregue, não entregue, cancelado); o painel da SESSAO-16 nunca acompanhou — só tirava o cancelado. Dos 233, **200 estavam "Entregue" no Tiny**; os 33 restantes eram exatamente os do quadro. No mesmo quadrinho, a "mais antiga" olhava também pedido entregue e pedido já liberado por inteiro (31 dias × 27 do quadro) e o "liberadas hoje" somava a entrada manual no ESTOQUE (8 das 12 do dia).

**Decidido (respostas do dono em 28/09):**

- **"A liberar" = o que o quadro do PCP mostra** (*"Sim, igual ao quadro"*): pedido vivo no Tiny com peça por liberar (o frete não é peça — [[D-063 - Frete nao vira peca de producao o resto nasce no PCP e o PCP|D-63]]).
- **A "mais antiga" também** passa a ser a do quadro (escolhida no mesmo quadrinho).
- **Os cards de reposição contam** no "a liberar", como o quadro já mostra (*"Sim, conta junto"*) — hoje não há nenhum (a reposição automática segue desligada).
- **"Liberadas hoje" fica como está** — o dono não escolheu mudar: segue contando toda peça criada no dia, inclusive o cadastro direto no ESTOQUE ([[D-070 - O estoque dos acabados e a CONTAGEM da logistica entrada|D-70]]). Mudar é decisão nova aqui.

**Como ficou (técnico):** migration 41 — `plt_fn_dash_pcp_dia` recriada a partir da versão da 39 ([[Memoria - Migrations Aplicador e Ensaio 1#E-24|E-24]]), com o mesmo filtro de `plt_fn_cards_pedido_pcp` (sem o gate por pessoa; o painel mantém o dele). A coluna segue `pedidos_a_liberar` (mesma forma — a tela não mudou). O harness amarra painel = quadro: quem mudar a regra de um sem a do outro fica vermelho.

**Descartadas:** manter a conta própria do painel (foi ela que se separou do quadro em silêncio); juntar as duas numa regra única compartilhada agora (mexeria no quadro, sem ganho hoje — o teste já amarra os dois).
