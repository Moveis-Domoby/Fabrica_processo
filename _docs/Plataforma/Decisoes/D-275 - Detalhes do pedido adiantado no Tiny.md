---
id: D-275
aliases: [D-275]
titulo: "Detalhes do pedido adiantado no Tiny"
tipo: decisao
data: 2026-11-09
status: provisoria
revisa: []
revisada_por: []
complementa: []
area: [expedicao]
tags: [decisao, area/expedicao, provisoria]
---
# D-275 · ⏳ PROVISÓRIA (escolhas da sessão onde a demanda não dizia) — Detalhes do pedido adiantado no Tiny (09/11/2026, SESSAO-47)

1. **O adiantado com falta é pedido vivo para as rotas também** (uma regra só de "pedido vivo" serve a Expedição e a Programação — [[D-156 - A rota aceita QUALQUER pedido vivo o Lancar para ROTAS deixa|D-156]]): além de aparecer na Expedição, ele volta a poder ser programado numa rota, como qualquer pedido vivo. O adiantado sem nada por liberar e sem peça na fábrica segue fora, como antes.
2. **A volta ao PCP deixa de valer quando o Tiny sai das três situações adiantadas** — para a situação pedida (confirmou) ou para qualquer outra (mudou lá) — e também quando a entrega do pedido é registrada. Faturado → Enviado (outra adiantada) mantém a volta.
3. **"Faltam N produtos"** = as vagas de produção sem peça, na conta do PCP. A reserva do estoque ainda não é peça: conta como falta até alguém usar.
4. **Quem recebe "ficou na Expedição esperando decisão":** a logística (todo mundo que pode apertar os botões). "Voltou ao PCP" segue indo para o PCP.
5. **Na janela de liberar peça a escolha é obrigatória** quando o pedido está adiantado e o produto volta para a produção (o Confirmar só acende com uma das três). O site de antes, que não pergunta, vale como "deixar como está".
6. **Pedido já devolvido:** o aviso e os botões saem do card na Expedição (ele volta a ser um pedido "ainda no PCP"); enquanto o Tiny não confirma, o card do PCP e o da Expedição mostram "O Tiny ainda não confirmou a mudança".
7. **A fila de saída do Tiny guarda uma vontade por pedido:** pedir a volta substitui um "desfazer entrega" ainda pendente do mesmo pedido, e uma entrega registrada depois substitui a volta pendente.
