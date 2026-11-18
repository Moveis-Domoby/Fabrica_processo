---
id: D-11
aliases: [D-11, D-011]
titulo: "API antecipada: entrada de pedidos via n8n logo após o kanban"
tipo: decisao
data: 2026-08-24
status: revisada
revisa: []
revisada_por: ["[[D-023 - Replanejamento da jornada a partir da 5 posicao|D-23]]"]
complementa: []
area: [tiny-n8n]
tags: [decisao, area/tiny-n8n]
---
# D-11 · API antecipada: entrada de pedidos via n8n logo após o kanban (24/08/2026)

**Decidido:** o dono quer a API **já no início** — mas no formato mais simples: **a plataforma recebendo dados do n8n** (n8n chama a API; a plataforma não busca nada no Tiny). Para isso a antiga SESSAO-11 foi dividida: a **[[SESSAO-09 - Entrada de Pedidos via n8n]]** (só o caminho de entrada Tiny → n8n → card no PCP) é executada logo após o kanban, e a SESSAO-11 (API completa: CRUD, webhooks de saída, ponte ROTAS) fica mais tarde. A partir daí, todos os testes das sessões seguintes rodam com **pedido real fluindo sozinho**. Ordem oficial em [[000 - ORDEM DAS SESSOES]] — **o número da sessão é ID, não ordem**.
