---
titulo: PLT - Entrada Automatica de Pedidos
tipo: nota
atualizado: 2026-09-17
tags: [plataforma, integracao, n8n]
---

> [!info] Origem
> Nota absorvida de `docs/entrada-de-pedidos.md` do repo em 17/09/2026 (unificação dos docs no cofre). Escrita na SESSAO-09 (D-31); continua válida. Handoff: [[handoff_2026_08_28_sessao09_entrada_pedidos]] · Memória de execução: [[SESSAO-09]].

# Entrada automática de pedidos (SESSAO-09 · D-31)

## Como funciona

O n8n continua fazendo o que sempre fez (P15): pedido novo/atualizado no Tiny →
`fn_upsert_pedido` → tabelas `pedidos`/`pedido_itens`/`clientes`. **Nada foi
alterado no n8n.**

A novidade é a reação da plataforma, dentro do próprio banco (migration 17):

```
Tiny → n8n → fn_upsert_pedido → INSERT/UPDATE em `pedidos`
                                      │
                        trigger plt_pedidos_reagir (AFTER)
                                      │
        ┌─────────────────────────────┼──────────────────────────────┐
   pedido NOVO                 pedido ATUALIZADO                pedido CANCELADO
   card no PCP na hora         com unidades liberadas →         evento na história;
   (evento card_criado,        evento `pedido_atualizado`       com produção em
   origem automacao)           (selo "Alterado no Tiny…"        andamento, admins
                               no PCP e na Expedição)           são avisados no sino
```

Regras de segurança do desenho:

- **À prova de falha:** o corpo do trigger roda sob `exception when others` —
  qualquer erro vira um `warning` no log e a integração NUNCA quebra.
- **Idempotente:** índice único garante **um card de pedido por pedido**;
  reenvio de webhook não duplica nada e não gera evento de ruído (só mudança
  REAL em situação/previsão/totais/observações conta).
- **Só INSERT cria card:** pedido histórico (anterior à migration) atualizado
  no Tiny não ganha card sozinho — para trazê-lo ao kanban, use o botão
  "Novo card de pedido" no PCP.
- **Cancelamento não apaga nada:** o card fica com o selo "Cancelado no Tiny"
  e a decisão sobre as peças é humana (Q-24).

Limitação conhecida: mudança SÓ nos itens do pedido (sem alterar nenhum campo
do próprio pedido) não gera o evento de conflito — os itens são apagados e
regravados pela integração e não passam por este trigger.

## Alternativa futura: endpoint HTTP

Se um dia outra fonte (fora do fluxo Tiny→n8n→banco) precisar criar pedidos,
o caminho combinado (SESSAO-11) é um endpoint autenticado por chave de API —
**não** um segundo escritor nas tabelas da integração. Até lá, não existe
endpoint de entrada: a porta é o banco, alimentado exclusivamente pelo n8n.
