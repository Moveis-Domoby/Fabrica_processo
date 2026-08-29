---
titulo: "SESSAO-17 — Automações Internas"
tipo: demanda
status: rascunho
data: 2026-08-19
atualizado: 2026-08-19
tags: [plataforma, demanda, sessao, automacao]
---

# 🎯 SESSAO-17 — Automações Internas ("quando X, faça Y")

> ↪️ **Renumerada em 28/08/2026 (D-35):** era a SESSAO-13; ficou em standby atrás do bloco 3 (a reforma, Sessões 13→16).

## O que é

O builder de automações estilo ClickUp, fácil de programar sem dev (RF-06): gatilhos e ações internas configuráveis pelo admin/líder, mais o sistema de notificações que a D-09 e os alertas de parado precisam.

## Requisitos cobertos

RF-06 · complementa RF-82/83/84 (notificações) e a visão de alertas de card parado.

## Decisões que regem

D-03 (automação de DESTINO continua fora — mover card automaticamente por roteiro não entra sem decisão nova; automação aqui é de consequências: notificar, delegar, marcar) · D-10.

## Comportamento esperado

- **Builder visual:** SE [gatilho] E [condições] ENTÃO [ações]. Gatilhos mínimos: card entrou/saiu de etapa · card parado há mais de N horas/dias (fila ou execução) · qualidade marcada (🟢🟡🔴) · disputa aberta/resolvida · pedido completo na expedição. Ações mínimas: notificar (usuário/líder/admin) · delegar (integra RF-41/42) · adicionar etiqueta/observação · disparar webhook (reusa RF-52).
- **Central de notificações** na plataforma (sino + lista), com preferências simples. Canal externo (WhatsApp via n8n — Q-42) vira ação "disparar webhook".
- **Permissões (Q-41):** admin cria globais; líder cria no escopo do próprio setor (confirmar com o dono).
- Execuções de automação são registradas (o quê disparou, o que fez) — depurável quando "a automação não rodou".
- Automações de fábrica sugeridas já criadas como exemplos desativados: "parado > 3 dias → notifica líder" · "pedido completo → notifica expedição" · "🔴 confirmado → notifica admin".

## Perguntar ao dono no início da sessão

- Q-40 (as 3 primeiras automações reais) · Q-41 (quem cria) · Q-42 (canais externos).

## Fora do escopo

Mover card automaticamente por roteiro de produto (precisa de decisão D nova) · editor de código.

## Critérios de aceite

- [ ] Criar "parado > 1h → notificar líder" pela interface, sem código, e vê-la disparar com um card de teste.
- [ ] Notificação chega na central do destinatário certo.
- [ ] Log de execução mostra gatilho, condição avaliada e ação tomada.
- [ ] Líder não cria automação fora do seu setor.
- [ ] PR + handoff.
