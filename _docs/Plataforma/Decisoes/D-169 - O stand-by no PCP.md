---
id: D-169
aliases: [D-169]
titulo: "O STAND-BY no PCP"
tipo: decisao
data: 2026-10-21
status: provisoria
revisa: []
revisada_por: []
complementa: []
area: [pcp, kanban-producao]
tags: [decisao, area/pcp, area/kanban-producao, provisoria]
---
# D-169 · ⏳ PROVISÓRIA (escolha do Claude — confirmar com o dono) — O STAND-BY no PCP (21/10/2026, pedido do dono)

**Pedido do dono:** *"Na tela inicial do PCP, TODO card deve ter a opção de colocar em STAND-BY, selecionando um MOTIVO (os motivos são criados nas configurações também; motivo obrigatório para colocar em stand-by, e vai para a minha AUDITORIA). PCP ganha também uma nova SUB-ABA para manter esses pedidos em stand-by; de lá eles devem poder ser LANÇADOS DIRETO PARA AS ENTREGAS, ou VOLTAR para aguardando liberação (só volta a aparecer nas rotas se não estiver em stand-by). Pedidos em stand-by também NÃO contam tempo."*

- **Onde:** o botão de stand-by fica em cada card de **"Aguardando liberação"** (ícone de pausa redondo, ao lado de abrir o card). A reposição de estoque não tem stand-by (tem o "Não produzir").
- **Motivo obrigatório:** da lista **Configurações → Utilitários → Motivos de stand-by** (nasceram seis: aguardando pagamento, cliente pediu para segurar, aguardando confirmação do cliente, aguardando medidas ou projeto, produto já pronto no estoque, entrega a combinar) **ou "Outro", escrito**. Nunca "especial" (isso é só da pausa). O motivo vai para a **Auditoria** (o "por quê" da linha "Pôs o pedido em stand-by").
- **Quem:** quem edita o card do pedido — PCP/logística, o líder e o admin ([[D-125 - O card avulso quem cria como termina vinculo etiquetas quem|D-125]] item 7).
- **A aba nova "Stand-by"** do PCP (`?aba=standby`) mostra cada pedido segurado com o motivo, desde quando, quem pôs, o tempo útil no PCP (parado) e os dois caminhos.
- **Pedido parcialmente liberado** também entra: sai de "Aguardando liberação" e o relógio do PCP para; **as peças já liberadas seguem na produção** normalmente.
- **Pedido programado para uma entrega não entra** em stand-by sem antes sair da programação (nada some calado de "Já programadas").
- **Não conta tempo:** o tempo útil do pedido no PCP desconta todos os períodos de stand-by (os fechados ficam guardados no card).
- O Tiny continua mandando ([[D-132 - O PCP segue o Tiny pedido Faturado Pronto para envio|D-132]]): se ele levar o pedido adiante, o pedido sai também da aba Stand-by.
