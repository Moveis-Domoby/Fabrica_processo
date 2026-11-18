---
id: D-80
aliases: [D-80, D-080]
titulo: "Um fluxo só no n8n para o Tiny da fábrica (catálogo + estoque); a carga avulsa do saldo morre"
tipo: decisao
data: 2026-09-30
status: vigente
revisa: []
revisada_por: []
complementa: []
area: [tiny-n8n]
tags: [decisao, area/tiny-n8n]
---
# D-80 · Um fluxo só no n8n para o Tiny da fábrica (catálogo + estoque); a carga avulsa do saldo morre (30/09/2026)

**Decidido (dono, 30/09):** *"eu não quero vários fluxos para a mesma coisa, quero 1 único que faz o trabalho completinho sem erro"*.

- O workflow do Tiny da FÁBRICA vira **"Domoby · Tiny FÁBRICA → produtos e estoque (fluxo único)"**: o catálogo segue igual (a cada 15 min + varredura 03:15); o aviso de estoque (mesmo endereço — da fábrica e da loja) chama a plataforma; a cada minuto a fila lê o Tiny e grava o ajuste; às 04:00 a varredura do estoque. O workflow "carga do saldo (rodar 1×)" **sai** (a varredura faz o papel dele).
- O aviso de estoque deixa de disparar a releitura do cadastro (o produto novo entra pelo ciclo de 15 min).
- O n8n guarda só as execuções com erro (a fila roda a cada minuto); o que foi feito fica na plataforma (trilha + Configurações → Tiny).

**↪️ 30/09/2026 (mesma madrugada) — sob demanda, sem relógio no n8n:** o dono, vendo o gatilho de 1 em 1 minuto: *"você não tá nem doido de deixar alguma coisa rodando no meu n8n a cada 1 minuto para requisitar várias coisas, calma paizão, melhora isso daí"*. Decidido: **o n8n não tem relógio para o estoque.** Quem chama o fluxo é o relógio INTERNO do banco (o mesmo da reserva da venda), e só quando o sincronismo está ligado, há produto esperando na fila e nenhum lote está em andamento — fila vazia não gera execução no n8n nem consulta ao Tiny. A varredura das 04:00 também passou para o banco. No n8n sobram só os relógios do catálogo que já existiam (15 min e 03:15). Técnico: migration 43.
