---
id: D-140
aliases: [D-140]
titulo: "SESSAO-32: pedido excluído no Tiny não existe em nenhum módulo — uma verdade só para fábrica e comercial"
tipo: decisao
data: 2026-10-16
status: revisada
revisa: []
revisada_por: ["[[D-311 - O pedido excluido no Tiny sai do PCP de vez e segue o caminho|D-311]]"]
complementa: []
area: [tiny-n8n]
tags: [decisao, area/tiny-n8n]
---
# D-140 · SESSAO-32: pedido excluído no Tiny não existe em nenhum módulo — uma verdade só para fábrica e comercial (16/10/2026)

**↩️ revisada em 2026-11-12 ([[D-311 - O pedido excluido no Tiny sai do PCP de vez e segue o caminho|D-311]], SESSAO-50):** o excluído no Tiny segue o caminho do CANCELADO — os cards **não são mais arquivados**: o fato `pedido_excluido_tiny` fica no card do pedido (que sai do PCP pela regra única e aparece em "Cancelados" como "Excluído no Tiny"), a peça em produção espera a logística, a pronta vai ao ESTOQUE sem dono; o sino é da logística. Continua fora da lista de Pedidos, da busca e do Comercial. Só a conta da LOJA marca.

**Pedido do dono (16/10, ~06:00 UTC, com print do Tiny × Painel de Recompra):** *"Os valores de outubro no tiny e na plataforma estão diferentes, investigue o motivo e resolva"*. **A causa:** outubro na plataforma 128 pedidos / R$ 149.047,80; no Tiny 127 / R$ 134.995,90 — a diferença é EXATAMENTE o pedido 13622 (Loja Domoby, 29 itens, R$ 14.051,90, "Em aberto", de 08/10), excluído no Tiny entre 08/10 18:08 e 09/10 03:39 UTC. O Tiny não avisa exclusão; a conferência da madrugada pedia o pedido ao Tiny toda noite e ouvia "codigo 32: Pedido não localizado", mas só contava "não encontrados" — o pedido seguia vivo no Comercial, na lista de Pedidos, no PCP e na produção (32 cartões: o do pedido, 8 unidades prontas em aguardo, 21 a montar e 2 paradas na montagem).

**A regra do dono (ao ser perguntado o que fazer com os cartões):** *"Entenda que fábrica e comercial devem reagir às mesmas tabelas, aos mesmos dados e tudo mais, a única diferença é apenas como eles aparecem no front, então se o pedido não existe mais, ele não deve aparecer em nenhum módulo"*. **OK para aplicar:** *"Pode aplicar"*.

1. **Uma verdade só:** a conferência da madrugada marca o pedido que o Tiny diz que não existe mais (e desmarca se uma conferência seguinte o achar). Todos os módulos leem a mesma marcação — nada se apaga dos pedidos.
2. **Some de tudo:** os cartões do pedido saem de todos os quadros (arquivados pela integração, com o motivo no histórico, o tempo aberto fechado, as peças do estoque reservadas para ele liberadas e fora da programação do caminhão); os admins recebem um aviso ("se alguma peça já existe de verdade, dê entrada dela no estoque"); a lista e a busca de Pedidos, o "Todos os pedidos" do PCP, a reserva do estoque pelo vendido, o ranking e os cortes das vendas, o detalhe do pedido, a busca de vínculo, as reservas presas do Tiny e o Comercial não o enxergam mais.
3. **Cancelado ≠ excluído:** o cancelado segue como sempre (aparece em Cancelados, as peças prontas voltam ao estoque sem dono — [[D-124 - O marcador Devolvido do Tiny NAO e cancelamento a fabrica|D-124]]/D-129); o Tiny também conta o cancelado no total da lista dele (o 13559, R$ 850, está nos 127).
4. **Como ficou (16/10 ~06:22 UTC, migration 87 + site):** outubro 127 pedidos · R$ 134.995,90 · 125 clientes = Tiny; o 13622 marcado, os 32 cartões fora dos quadros, 4 admins avisados; busca "13622" em Pedidos = nenhum pedido.
