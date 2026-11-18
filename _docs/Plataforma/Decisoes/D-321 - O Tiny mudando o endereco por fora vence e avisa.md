---
id: D-321
aliases: [D-321]
titulo: "O Tiny mudando o endereço por fora vence e avisa"
tipo: decisao
data: 2026-11-12
status: provisoria
revisa: []
revisada_por: []
complementa: ["[[D-319 - Editar o endereco de entrega do pedido com o original do Tiny|D-319]]"]
area: [logistica-rotas]
tags: [decisao, area/logistica-rotas, provisoria]
---
# D-321 · ⏳ PROVISÓRIA — O Tiny mudando o endereço por fora vence e avisa (12/11/2026, SESSAO-50 — a regra é provisória da demanda; os detalhes são escolhas da sessão) — ↪️ D-319

1. **Mudou de verdade no Tiny** (o endereço de entrega do pedido **ou o cadastro do cliente** — a maioria dos pedidos usa o do cadastro): fato `endereco_entrega_tiny_substituido`, a marca da plataforma sai e o sino toca para a logística.
2. **Chegou igual ao que a plataforma pediu:** fato `endereco_entrega_tiny_confirmado`, sem aviso. Comparar é comparar o resumo (sem acento, sem maiúscula, sem espaço; o CEP só com os números) — "RUA DAS FLORES" / "59075000" é confirmação de "Rua das Flores" / "59075-000".
