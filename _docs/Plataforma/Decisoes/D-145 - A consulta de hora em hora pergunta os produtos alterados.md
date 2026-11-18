---
id: D-145
aliases: [D-145]
titulo: "A consulta de hora em hora pergunta os produtos alterados SÓ à fábrica"
tipo: decisao
data: 2026-10-18
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-143 - Tiny completo o plano aprovado inteiro o que o Tiny nao avisa|D-143]]", "[[D-144 - Os dados proprios da conta da FABRICA no Tiny ficam num|D-144]]"]
area: [tiny-n8n]
tags: [decisao, area/tiny-n8n]
---
# D-145 · A consulta de hora em hora pergunta os produtos alterados SÓ à fábrica (18/10/2026) — ↪️ D-143, D-144

**Pedido do dono (18/10):** *"Pode tirar a loja da consulta de produtos alterados de hora em hora. Os produtos vêm da fábrica."*

O aplicativo da API nova da loja é o do Comercial e não tem o módulo Produtos; a pergunta levava 403 toda hora. Desde a 93 ela terminava calada, mas era uma chamada inútil por hora. Dar o módulo exigiria autorizar de novo o aplicativo do Comercial, ou seja, mexer no que funciona. Os produtos da plataforma vêm da fábrica (o catálogo, desde 23/09), e o catálogo da loja segue pela API v2 na carga. Os **contatos** alterados continuam sendo perguntados nas duas contas. Aplicado como a atualização **94**, com o OK do dono na conversa.
