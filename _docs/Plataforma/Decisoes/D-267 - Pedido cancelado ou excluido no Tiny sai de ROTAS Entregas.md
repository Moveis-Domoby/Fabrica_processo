---
id: D-267
aliases: [D-267]
titulo: "Pedido cancelado (ou excluído) no Tiny sai de ROTAS → Entregas → \"A entregar\", mesmo lançado ou programado; o já entregue fica no histórico"
tipo: decisao
data: 2026-11-06
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-045 - Logistica e ROTAS unidade pronta lancamento ID de producao|D-45]]", "[[D-156 - A rota aceita QUALQUER pedido vivo o Lancar para ROTAS deixa|D-156]]", "[[D-140 - SESSAO-32 pedido excluido no Tiny nao existe em nenhum modulo|D-140]]"]
area: [logistica-rotas]
tags: [decisao, area/logistica-rotas]
---
# D-267 · ✅ DECIDIDA pelo dono — Pedido cancelado (ou excluído) no Tiny sai de ROTAS → Entregas → "A entregar", mesmo lançado ou programado; o já entregue fica no histórico (06/11/2026, os números que não batiam) — ↪️ D-45, D-156, D-140

**Achado (varredura de 06/11):** o 13686 foi lançado para as entregas em 20/10 e cancelado no Tiny no dia seguinte; continuava em "A entregar" com os botões de entregar — e a entrega dele é recusada pelo banco. A reação ao cancelamento já tirava a peça e a programação; o "lançado" ficava. A Programação e a Expedição já o escondiam (a regra do pedido vivo).

**Decidido (resposta do dono, 06/11):** *"Sai da lista"*. O cancelado ou excluído no Tiny sai de "A entregar" na hora; o que já tinha sido entregue antes do cancelamento continua em "Entregues" (o 13620).

**Descartada:** ficar na lista com a marca "Cancelado no Tiny" e sem botões.

**Como ficou (técnico):** migration `20261106030000` — `plt_fn_rotas` com `entrega_evento_id is not null or (situação ≠ cancelado e não excluído no Tiny)`. Nada de apagar o lançamento: a porta lê a regra.
