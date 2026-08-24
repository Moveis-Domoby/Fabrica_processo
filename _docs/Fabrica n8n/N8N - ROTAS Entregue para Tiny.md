---
titulo: n8n — ROTAS "entregue" → Tiny (automação nova)
tipo: workflow
atualizado: 2026-08-17
tags: [n8n, clickup, tiny, rotas, entregue]
---

# HANDOFF · Automação 5 — ClickUp ROTAS "entregue" → Tiny "entregue"

**Data:** 14/08/2026 · **Status: projetada, ainda não implantada.**
**Arquivo importável:** `domoby-clickup-tiny-entregue.json`
**Referências:** [[N8N - Tiny Integracoes Referencia]] (endpoints) · [[N8N - Tiny Modelos Mentais]] (conceitos) · [[N8N - ROTAS ClickUp]] (a automação que cria os cards)

> **O que faz:** quando alguém move um card para a etapa **entregue** na lista
> **ROTAS** (Space DPTO LOGÍSTICA) do ClickUp, o pedido correspondente é marcado
> como **Entregue** no Tiny. É a primeira automação da casa no sentido
> **ClickUp → Tiny** (todas as anteriores iam do Tiny para fora).

---

## 1. A cadeia

```
ClickUp Trigger · status  (webhook taskStatusUpdated, registrado pelo próprio n8n)
        ↓
Filtrar status "entregue"        (Code — só passa after == "entregue")
        ↓
ClickUp · Obter tarefa           (o webhook não traz nome nem lista — precisa do GET)
        ↓
Validar ROTAS e extrair pedido   (Code — lista == ROTAS + regex do nº no nome do card)
        ↓
Tiny · pedidos.pesquisa          (numero → id interno)          ← tradução obrigatória!
        ↓
Escolher pedido no Tiny          (Code — casa o numero, decide se altera)
        ↓
Tiny · pedido.alterar.situacao   (id + situacao=entregue)
        ↓
Retorno OK?                      (false → Stop and Error, aparece vermelho em Executions)
```

## 2. As 6 decisões de projeto e por quê

**a) Gatilho = webhook da API do ClickUp (node ClickUp Trigger), não Automation "Call webhook".**
A Automation nativa do ClickUp com webhook só existe no plano **Business+** e consome cota mensal de ações. O webhook da API funciona em **qualquer plano**, usa a credencial ClickUp que o n8n já tem (Access Token da migração 2) e ainda entrega `before`/`after` do status. O node registra e gerencia o webhook sozinho ao ativar o workflow.

**b) O número do pedido sai do NOME do card** (`13046 - Alecrim - 13/08/2026` → regex `^\s*(\d+)`).
Os cards da ROTAS são criados pelo nosso próprio workflow com o número na frente — formato garantido por construção. Cards criados à mão sem número na frente são ignorados em silêncio (sem erro).

**c) Tradução numero → id é obrigatória.**
O card carrega o `numero` (13046); a API de alterar situação exige o `id` interno (~1053632xxx). O passo `pedidos.pesquisa.php?numero=` faz a ponte. O Code confere `String(p.numero) === numero` — a pesquisa do Tiny pode devolver mais de um registro, e igualdade exata evita casar 1304 com 13046.

**d) Idempotência no Code, não em IF.**
Se o pedido já está `entregue` (ou `cancelado`), o Code devolve `[]` e o resto do fluxo nem roda — mover o card de novo, ou dois membros moverem quase juntos, não gera chamada repetida nem erro. Mesma técnica da trava anti-duplicação da migração 2 (lição: condição frágil em editor de expressão falha em silêncio; em JavaScript, não).

**e) Pedido cancelado NUNCA vira entregue por automação.**
Se alguém mover o card de um pedido cancelado, a automação se recusa em silêncio. Caso de gente: melhor um card "sem efeito" do que ressuscitar um pedido cancelado no ERP.

**f) Falha do Tiny vira execução VERMELHA de propósito** (node Stop and Error no ramo false do `Retorno OK?`).
Na v2 o HTTP volta 200 até em erro — sem isso, uma recusa do Tiny passaria invisível. Vermelho em Executions é o que o futuro workflow de alerta (pendência P1 de [[N8N - Pendencias e Riscos]]) vai capturar. **Esta automação torna o alerta de erro ainda mais urgente: já são 5 integrações sem vigia.**

## 3. Efeito colateral desejado — a planilha se atualiza sozinha

Marcar `entregue` via API dispara o webhook de vendas (`atualizacao_pedido`) → o workflow existente roda `pedido.obter` → a coluna **SITUAÇÃO** da aba COMPLETO vira "Entregue" sem nenhum node novo.

**Não há loop:** o ramo do ClickUp no workflow da planilha só cria card em `inclusao_pedido`; o `atualizacao_pedido` gerado por esta automação morre na trava. E esta automação só reage a mudança de status **no ClickUp**, que a atualização da planilha não provoca. O ciclo fecha em uma volta.

## 4. Passo a passo de implantação

1. **Importar** `domoby-clickup-tiny-entregue.json` (workflow novo, separado do da planilha).
2. **Node `ClickUp Trigger · status`:** conectar a credencial ClickUp existente e conferir os valores **já preenchidos no JSON** (confirmados por URL real em 17/08):

   | Campo | Valor |
   |---|---|
   | Team (DOMOBY) | `9007001597` |
   | Filters → List ID (ROTAS) | `901327395162` |

   O ID da lista foi extraído da URL do board (`app.clickup.com/9007001597/v/b/6-901327395162-2c` — o número do meio) e confere com o prefixo `sc901327395162` dos ids de status da ROTAS. Com o filtro, o webhook é registrado no ClickUp com `list_id` e eventos de outras listas **nem chegam ao n8n** — zero requisição inútil. O Code continua validando a lista por nome como segunda linha de defesa. ⚠️ O filtro aceita **um nível só** por webhook — só o List ID, sem Space/Folder junto. Se mudar o filtro com o workflow ativo, desativar e reativar para re-registrar o webhook.
3. **Node `ClickUp · Obter tarefa`:** conectar a mesma credencial.
4. **Nos DOIS nodes HTTP do Tiny:** trocar `COLOQUE_O_TOKEN_V2_AQUI` pelo token v2 (Tiny → Configurações → Outras configurações → Token API). Melhor ainda: `{{ $env.TINY_TOKEN }}` se a variável já tiver sido criada no compose.
5. ~~Conferir o nome exato do status na lista ROTAS~~ ✅ **Confirmado por print em 17/08: o status é `ENTREGUE`.** A comparação do filtro é case-insensitive, então a constante `STATUS_ALVO = 'entregue'` já casa — nenhum ajuste necessário. (Se um dia o status for renomeado com acento ou texto extra, aí sim ajustar a constante.)
6. **Ativar o workflow** (é a ativação que registra o webhook no ClickUp).
7. **Testar** com o roteiro da seção 5.
8. Registrar no handoff o resultado do teste.

## 5. Roteiro de teste (sem sujar produção)

1. Criar um pedido de teste no Tiny (ou usar um pedido real já entregue de fato).
2. Conferir que o card correspondente existe na ROTAS (o workflow da planilha cria sozinho).
3. Mover o card para **entregue** no ClickUp.
4. Em Executions: a execução deve mostrar os 7 nodes verdes; no `Tiny · pedido.alterar.situacao`, resposta `{"retorno":{"status_processamento":"3","status":"OK"}}`.
5. No Tiny: pedido com situação **Entregue**.
6. Na planilha, ~segundos depois: **uma segunda execução** (do workflow da planilha, via `atualizacao_pedido`) e a coluna SITUAÇÃO = "Entregue". Isso é o efeito da seção 3 funcionando, não um bug.
7. **Idempotência:** mover o card para outra coluna e de volta para entregue → nova execução termina no `Escolher pedido no Tiny` com saída vazia (nodes seguintes "not executed" — é o esperado, mesma semântica da trava da migração 2).

## 6. Riscos e limitações conhecidos

| Risco | Mitigação |
|---|---|
| Webhook do ClickUp é suspenso após 100 falhas (n8n fora do ar) — e **fica suspenso em silêncio** | Verificação: desativar/reativar o workflow re-registra o webhook. O alerta de erro (pendente) reduziria a janela. Eventos perdidos durante a suspensão **não são reenviados** — conferência manual dos cards movidos no período |
| Resposta do n8n > 7s conta como falha para o ClickUp | O trigger responde imediato por padrão; não colocar processamento antes da resposta |
| Card com nome editado à mão (número removido) | Ignorado em silêncio (decisão b). Se isso incomodar, trocar o `continue` por `throw` no Code de validação |
| Dois cards para o mesmo pedido (duplicata antiga) | Inofensivo: o segundo movimento cai na idempotência |
| `pedidos.pesquisa` sem resultado (pedido apagado no Tiny) | O Code lança erro → execução vermelha → visível |
| Rate limit (60/min) | Volume real ≈ dezenas de entregas/dia. Inatingível fora de mutirão de arrastar cards; mesmo assim, retry do node cobre |
| Alguém move o card por engano | O Tiny vai a `entregue`, e voltar exige mover no Tiny manualmente (a automação não desfaz — unidirecional de propósito). A situação anterior fica registrada no campo `situacaoAnterior` da execução |

## 7. O que esta automação NÃO faz (por decisão)

- Não desfaz nada: mover o card para fora de "entregue" não altera o Tiny.
- Não mexe em nenhuma outra lista além da ROTAS, nem em outros statuses.
- Não escreve na planilha (a atualização da SITUAÇÃO acontece por tabela — via webhook de vendas, seção 3).
- Não cria nem apaga cards.

## 8. Vocabulário de situação (repetido aqui porque é o coração)

O valor enviado ao Tiny é a **string v2** `entregue` (tabela oficial: `aberto`, `aprovado`, `preparando_envio`, `faturado`, `pronto_envio`, `enviado`, `entregue`, `nao_entregue`, `cancelado`). Se um dia migrar para a v3: vira `PUT /pedidos/{id}/situacao` com `{"situacao": 6}` — número, e a numeração **não** segue a ordem do funil.

## 9. Nodes que NÃO podem ser renomeados

`Validar ROTAS e extrair pedido` e `Escolher pedido no Tiny` — são referenciados por nome (`$('...')`) dentro dos Codes e do Stop and Error. Renomear quebra em silêncio (mesma lição da migração 2).

## Ver também

[[N8N - Tiny Integracoes Referencia]] · [[N8N - Tiny Modelos Mentais]] · [[N8N - ROTAS ClickUp]] · [[N8N - Pendencias e Riscos]]
