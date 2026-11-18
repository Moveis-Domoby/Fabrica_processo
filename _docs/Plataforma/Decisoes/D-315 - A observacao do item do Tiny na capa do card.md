---
id: D-315
aliases: [D-315]
titulo: "A observação do item do Tiny na capa do card"
tipo: decisao
data: 2026-11-12
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-063 - Frete nao vira peca de producao o resto nasce no PCP e o PCP|D-63]]", "[[D-075 - O quadrinho do PCP na Visao do dia conta o que o quadro|D-75]]"]
area: [tiny-n8n, kanban-producao]
tags: [decisao, area/tiny-n8n, area/kanban-producao, provisoria-em-parte]
---
# D-315 · ✅ DECIDIDA (a regra é da demanda) + ⏳ PROVISÓRIA (onde mora e a limpeza) — A observação do item do Tiny na capa do card (12/11/2026, SESSAO-50, bloco A) — ↪️ D-63, D-75

1. **Onde mora:** numa tabela da plataforma por item (`plt_itens_observacao (pedido_id, seq)`), escrita por gatilho quando o pedido do Tiny é gravado — a demanda pedia uma coluna nova em `pedido_itens`, mas a estrutura das tabelas da integração não muda (regra 10: o aplicador confere a impressão digital delas).
2. **O texto (provisória):** sem espaço nas pontas, espaços e quebras de linha viram um espaço, entidades de HTML decodificadas, até 2.000 caracteres; vazio = nada. O gatilho só age quando os itens do pedido mudam; se falhar, vira aviso de automação (uma vez por hora) e o pedido do Tiny é gravado igual.
3. **Mudar só a observação no Tiny não reabre o PCP** e o card muda ao vivo (o aviso que os quadros e a janela já usam; nenhum fato novo).
