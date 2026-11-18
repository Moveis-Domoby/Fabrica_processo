---
id: D-269
aliases: [D-269]
titulo: "O cancelamento no Tiny FECHA o stand-by do pedido, na hora do cancelamento; o painel de Motivos conta \"em stand-by agora\" igual à aba Stand-by do PCP"
tipo: decisao
data: 2026-11-06
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-169 - O stand-by no PCP|D-169]]", "[[D-171 - Onde o pedido em stand-by aparece|D-171]]", "[[D-176 - O PAINEL DE MOTIVOS os maiores problemas da fabrica e|D-176]]"]
area: [pcp, tiny-n8n]
tags: [decisao, area/pcp, area/tiny-n8n]
---
# D-269 · ✅ DECIDIDA pelo dono — O cancelamento no Tiny FECHA o stand-by do pedido, na hora do cancelamento; o painel de Motivos conta "em stand-by agora" igual à aba Stand-by do PCP (06/11/2026) — ↪️ D-169, D-171, D-176

**Achado (varredura de 06/11):** Motivos dizia 7 em stand-by; o PCP e a Expedição, 6. O 13649 entrou em stand-by em 22/10 e foi cancelado no Tiny em 28/10 — o stand-by ficou aberto para sempre: a aba o escondia, o painel o contava e o tempo dele seguia crescendo no ranking ("ainda segurado").

**Decidido (resposta do dono, 06/11):** *"Cancelado fecha o stand-by"*. Quando o Tiny cancela um pedido em stand-by, o stand-by fecha sozinho, na hora do cancelamento, com o registro do porquê ("Pedido cancelado no Tiny — o stand-by fechou sozinho"). O 13649 fecha com a hora do cancelamento (28/10). O painel conta "em stand-by agora" e o "ainda segurado" de cada motivo com a regra da aba.

**Descartada:** só acertar a conta do painel (o 13649 seguiria aberto por dentro, somando tempo no ranking).

**Como ficou (técnico):** migration `20261106030000` — fato `pedido_standby_saiu` com `destino = 'cancelado'`, origem automação, puxado pelo gatilho `plt_eventos_zz_standby_cancelado` (no fato `pedido_cancelado`); a validação aceita esse destino só da automação e com o pedido cancelado de fato; o aberto de antes fecha na migration (`retroativo`). Regra da aba: `plt_privado.vw_standby_na_aba` (o mesmo filtro do quadro do PCP). Nada se edita (RNF-05).
**Fica para depois (não pedido):** o pedido que o Tiny leva adiante (faturado, pronto para envio, enviado) em stand-by sai da aba ([[D-169 - O stand-by no PCP|D-169]]) mas o stand-by segue aberto por dentro — hoje não há nenhum.
