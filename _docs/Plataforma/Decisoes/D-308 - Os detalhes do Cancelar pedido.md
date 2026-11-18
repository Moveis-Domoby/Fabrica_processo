---
id: D-308
aliases: [D-308]
titulo: "Os detalhes do \"Cancelar pedido\""
tipo: decisao
data: 2026-11-12
status: provisoria
revisa: []
revisada_por: []
complementa: ["[[D-307 - Cancelar pedido e Ocultar do PCP no lugar do Remover do PCP|D-307]]"]
area: [pcp]
tags: [decisao, area/pcp, provisoria]
---
# D-308 · ⏳ PROVISÓRIA — Os detalhes do "Cancelar pedido" (12/11/2026, SESSAO-50 — o "Tentar de novo" é provisória da demanda; o resto são escolhas da sessão) — ↪️ D-307

1. **O Tiny recusou ou não respondeu:** o pedido **continua fora do PCP**, na aba "Cancelados", com *"O Tiny ainda não confirmou o cancelamento"* (o porquê no título) e **"Tentar de novo"** (põe o pedido de novo na fila de saída e registra quem pediu). Confirmado: o selo "Confirmado no Tiny"; a marca da plataforma fica como trilha.
2. **Ida ao Tiny desligada** ("Entregue vai ao Tiny" em Configurações → Caminhões): o botão fica apagado, com a explicação — sem a ida, o cancelamento não chegaria lá.
3. **Pedido já entregue:** o banco recusa ("não dá para cancelar pela plataforma"). Já cancelado no Tiny: nada a fazer (o modal diz que ele já está em "Cancelados").
4. **A automação do n8n** que leva a situação ao Tiny só deixava passar as situações de entrega: `cancelado` foi somado na lista dela na subida (sem isso a fila reenviaria para sempre).
