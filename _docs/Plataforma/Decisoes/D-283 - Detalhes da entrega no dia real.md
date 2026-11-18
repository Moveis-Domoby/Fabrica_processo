---
id: D-283
aliases: [D-283]
titulo: "Detalhes da entrega no dia real"
tipo: decisao
data: 2026-11-09
status: provisoria
revisa: []
revisada_por: []
complementa: []
area: [logistica-rotas]
tags: [decisao, area/logistica-rotas, provisoria]
---
# D-283 · ⏳ PROVISÓRIA (escolhas da sessão onde a demanda não dizia) — Detalhes da entrega no dia real (09/11/2026, SESSAO-47)

1. **O campo do dia começa vazio**; o botão só acende com um dia que vale e passa a dizer "Marcar como entregue em dd/mm/aaaa".
2. **A entrega parcial não ganhou a escolha do dia**: vale no dia em que é registrada; se precisar, o admin corrige depois na ficha.
3. **A entrega que vem do Tiny** continua valendo no momento em que a plataforma recebeu o aviso; o admin também pode corrigir.
4. **Na trilha do pedido**, a entrega marcada num dia passado leva a frase "Marcado como entregue no dia X (registrado em Y)".
5. **Na lista de pedidos**, quando o dia foi escolhido, a hora ao lado é a do fim do expediente (a lista não sabe quando a entrega foi registrada; a ficha diz as duas coisas).
6. **O número de entregas do painel de Motivos** passou a contar as entregas que estão valendo, pelo dia de fato — antes contava os registros, inclusive os desfeitos depois.
7. **Na aba Produção da ficha**, a peça que saiu com a entrega mostra o dia de fato da entrega.
8. **O calendário das rotas passou a ser lido sempre com o plano feito sob medida para o período** (ajuste técnico pedido pelo supervisor — o achado de 06/11: com 100 vezes o movimento, da 6ª leitura em diante na mesma conexão ele levava dezenas de segundos). ↪️ O fecho (migration `20261109050000`, ✅ aplicada em 09/11 ~22:20 com o OK do dono): a causa era um pré-filtro que não tirava linha nenhuma; sem ele a guarda deixa de ser precisa e sai também (ela encarecia os períodos longos).
