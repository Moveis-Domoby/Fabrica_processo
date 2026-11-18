---
id: D-58
aliases: [D-58, D-058]
titulo: "O lugar da peça pronta: com pedido → Pedidos em aguardo; o ESTOQUE fica só com peça sem dono"
tipo: decisao
data: 2026-09-27
status: revisada
revisa: ["[[D-013 - Entrada unica e saidas terminais do fluxo|D-13]]", "[[D-018 - Fins de linha ESTOQUE e ROTAS nascem juntos|D-18]]", "[[D-038 - Logistica Estoque com ID digitavel sala de Pedidos em aguardo|D-38]]", "[[D-045 - Logistica e ROTAS unidade pronta lancamento ID de producao|D-45]]"]
revisada_por: ["[[D-126 - A marcacao do estado da peca perfeito atencao danificado vira|D-126]]", "[[D-156 - A rota aceita QUALQUER pedido vivo o Lancar para ROTAS deixa|D-156]]"]
complementa: []
area: [expedicao]
tags: [decisao, area/expedicao]
---
# D-58 · O lugar da peça pronta: com pedido → Pedidos em aguardo; o ESTOQUE fica só com peça sem dono (27/09/2026) — ↩️ revisa a D-13, a D-18, a D-38 e a D-45

**Decidido (resposta b4 do dono no início da SESSAO-24):** *"JÁ EXISTE A ABA DE PEDIDOS EM AGUARDO, OS LOCAIS FINAIS NÃO SÃO MAIS ESTOQUE E MUITO MENOS ROTA, ISSO JÁ MUDOU, ESTOQUE SÓ FICA COMO LOCAL FINAL DE PEÇA SEM DONO."*

- **Peça pronta COM pedido termina em Pedidos em aguardo** — a aba que já existia passa a ser o **lugar** da peça (por baixo, um fim de linha interno "PEDIDOS EM AGUARDO"; nenhuma tela nova, nenhuma rota nova). De lá o pedido completo é **lançado para as ROTAS** ([[D-045 - Logistica e ROTAS unidade pronta lancamento ID de producao|D-45]], que segue valendo para o lançamento).
- **O ESTOQUE só recebe peça SEM dono** (reposição, ou peça de pedido cancelado — que perde o pedido na chegada). Peça de pedido vivo mandada ao ESTOQUE é recusada pelo banco com a explicação.
- **Os dois lugares só recebem peça 🟢** (a regra da [[D-054 - O fluxo do estoque so peca pronta perfeita e sem pedido|D-54]] vale para os dois). Pedidos em aguardo só aceita peça de pedido vivo.
- **Painel:** "concluídas do dia" passa a contar só a chegada vinda da **produção** (a mudança entre fins de linha — lançar para ROTAS, cancelamento — não é produção nova; antes o lançamento contava a peça duas vezes). O "fim de linha" do painel ganha Pedidos em aguardo.
- **O que estava no ESTOQUE com pedido em 27/09** (herança): as 🟢 de pedido vivo foram para Pedidos em aguardo; as de pedido **já entregue no Tiny** foram **arquivadas** (dono: *"se já foi entregue, não deve nem aparecer mais aí"*); a 🔴 do 13215 ficou esperando decisão.
- ↩️ **[[D-013 - Entrada unica e saidas terminais do fluxo|D-13]] / [[D-018 - Fins de linha ESTOQUE e ROTAS nascem juntos|D-18]]:** os fins de linha agora são três — Pedidos em aguardo (peça de pedido), ESTOQUE (peça sem dono) e ROTAS (pedido lançado); a entrada única pelo PCP não muda. ↩️ **[[D-038 - Logistica Estoque com ID digitavel sala de Pedidos em aguardo|D-38]]:** a "sala" de Pedidos em aguardo virou lugar. ↩️ **D-45:** "unidade pronta" = chegou a um fim de linha (qualquer um dos três); o lançamento move do aguardo para as ROTAS.

**Descartadas:** manter a peça de pedido no ESTOQUE e só filtrar a aba (era o modelo antigo, que o dono disse que "já mudou"); criar tela ou rota nova para o aguardo.
