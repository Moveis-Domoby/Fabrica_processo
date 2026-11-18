---
id: D-311
aliases: [D-311]
titulo: "O pedido excluído no Tiny sai do PCP de vez e segue o caminho do cancelado"
tipo: decisao
data: 2026-11-12
status: vigente
revisa: ["[[D-140 - SESSAO-32 pedido excluido no Tiny nao existe em nenhum modulo|D-140]]"]
revisada_por: []
complementa: ["[[D-075 - O quadrinho do PCP na Visao do dia conta o que o quadro|D-75]]", "[[D-148 - O que o Tiny nao avisa fica em dia pela conferencia|D-148]]"]
area: [tiny-n8n, pcp]
tags: [decisao, area/tiny-n8n, area/pcp, provisoria-em-parte]
---
# D-311 · ✅ DECIDIDA (a regra é da demanda) + ⏳ PROVISÓRIA (os detalhes) — O pedido excluído no Tiny sai do PCP de vez e segue o caminho do cancelado (12/11/2026, SESSAO-50, bloco B) — ↩️ D-140 (os cards não são mais arquivados) · ↪️ D-75, D-148

1. **Uma regra só:** a regra de "fora do PCP" passou a considerar a lista de excluídos no Tiny (e o cancelado pela plataforma) — quadro, porta antiga, quadrinho do dia, aviso e totais iguais entre si. O 13622 sai sozinho; o 13270 (que não está na lista) fica para o PCP decidir pelos botões novos.
2. **Excluído = cancelado:** o fato `pedido_excluido_tiny` no card do pedido (log + sino da **logística**: *"O pedido 13622 não existe mais no Tiny (foi excluído). Ele saiu do PCP."*); a peça em produção espera a logística, a pronta vai ao ESTOQUE sem dono; o pedido aparece em "Cancelados" com "Excluído no Tiny". ↩️ [[D-140 - SESSAO-32 pedido excluido no Tiny nao existe em nenhum modulo|D-140]]: os cards **não são mais arquivados** (o pedido continua fora da lista de Pedidos, da busca e do Comercial).
3. **Reencontrado:** o pedido que o Tiny volta a achar sai da lista com o fato `pedido_reencontrado_tiny`.
4. **Só a conta da LOJA marca:** o "não localizado" da conta da fábrica é de pedido da outra empresa e não marca nada (antes marcava). Sem relógio novo: a conferência da madrugada de sempre aplica o veredito.
