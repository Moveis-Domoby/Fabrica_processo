---
id: D-2
aliases: [D-2, D-02, D-002]
titulo: "Timer: dois contadores por etapa, dash compara e soma"
tipo: decisao
data: 2026-08-19
status: vigente
revisa: []
revisada_por: []
complementa: []
area: [tempos-paineis, kanban-producao]
tags: [decisao, area/tempos-paineis, area/kanban-producao]
---
# D-2 · Timer: dois contadores por etapa, dash compara e soma (19/08/2026)

**Decidido (palavras do dono):** "tempo total por etapa, independente se está na fila ou não; conta o tempo parado **na fila entre cada etapa** e **outro tempo na etapa em si**; na dash mostra um comparativo somando esses dois tempos."

Modelo: cada passagem por etapa registra **tempo de fila** (da chegada até o início) e **tempo de execução** (do início ao fim). Dashboards mostram os dois lado a lado e o total somado. Gargalo = fila; produtividade = execução.

**↪️ Detalhamento (24/08/2026):** TODAS as etapas contam o tempo que cada card fica parado nelas, inclusive na fila. **O tempo de fila pertence ao SETOR/etapa, nunca a uma pessoa** — na fila o card ainda não está direcionado a ninguém. O tempo de execução pertence a quem iniciou/finalizou. Propósito declarado: fila longa num setor = **gargalo identificado** = possivelmente contratar mais alguém para o setor. O fluxo, por enquanto, serve para identificar o **tempo de produção por item, por setor e por pessoa**.
