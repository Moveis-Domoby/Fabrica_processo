---
id: D-340
aliases: [D-340]
titulo: "A lista de pedidos ganha uma porta nova no banco com a hora do registro"
tipo: decisao
data: 2026-11-18
status: provisoria
revisa: []
revisada_por: []
complementa: ["[[D-283 - Detalhes da entrega no dia real|D-283]]"]
area: [logistica-rotas]
tags: [decisao, area/logistica-rotas, provisoria]
---
# D-340 · ⏳ PROVISÓRIA — A lista de pedidos ganha uma porta nova no banco com a hora do registro (18/11/2026, SESSAO-52)

A lista de pedidos passou a ler por uma **porta nova** — a mesma lista de sempre + a hora em que a entrega foi registrada — em vez de ganhar uma coluna na porta antiga.

*Alternativa descartada:* acrescentar a coluna na porta de sempre. A porta antiga devolve uma tabela fixa que cinco atualizações antigas recriam; ganhar coluna obrigaria a mexer nas cinco e quebraria a reaplicação nos testes. A porta nova não mexe em nada antigo, e o site que está no ar segue funcionando com o banco novo. Origem: P52-1 da SESSAO-52 ([[handoff_2026_11_18_sessao52_datas_e_textos_certos|handoff]]).

**Por que provisória:** Escolha da sessão, feita sem o dono na conversa (fila do Escritório). Vale até o dono confirmar ou mudar.
