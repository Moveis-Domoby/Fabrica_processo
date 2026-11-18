---
id: D-122
aliases: [D-122]
titulo: "As contas a receber voltam do Tiny todo dia, na conferência da madrugada"
tipo: decisao
data: 2026-10-09
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-050 - Integracao Tiny banco edicao no Tiny edita aqui apagar|D-50]]", "[[D-120 - O pedido entregue sai da ROTAS e mora no PCP com tudo dele|D-120]]"]
area: [tiny-n8n]
tags: [decisao, area/tiny-n8n]
---
# D-122 · As contas a receber voltam do Tiny todo dia, na conferência da madrugada (09/10/2026, pedido do dono) — ↪️ D-50/D-120

**Decidido (pedido do dono, 09/10):** *"traga de volta as contas a receber do Tiny"* — e, perguntado, *"pode, e roda já"*.

- As contas a receber (o "pago / em aberto" de cada parcela) tinham vindo **uma vez só**, na carga do histórico (terminou em 09/09/2026). Agora a **conferência diária com o Tiny (3h)** traz também as contas: a busca das contas **emitidas nos últimos 60 dias** (acha as novas) e a **releitura das que ainda não fecharam** (nem pagas nem canceladas), de qualquer idade — é ela que pega o "pago" do dia. A conta que já fechou no Tiny não é relida (dezenas de chamadas por noite, não centenas).
- **O fluxo do n8n não mudou** — ele faz no Tiny a busca que a fila manda.
- A janela do pedido no PCP mostra cada conta como **Pago / Em aberto / Pago em parte / Cancelada**, com a data da última conferência; sem conta e com a conferência em dia, diz que o Tiny não tem conta para o pedido. A Auditoria (super admin) mostra, em cada rodada, quantas contas foram relidas, novas, pagas e em aberto.
- **Limite conhecido:** conta já paga que o Tiny **estorna** depois não é relida sozinha — se acontecer, reabrir a conta na fila e acordar a fila.
