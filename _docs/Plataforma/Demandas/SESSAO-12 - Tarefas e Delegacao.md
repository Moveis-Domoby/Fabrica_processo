---
titulo: "SESSAO-12 — Tarefas e Delegação"
tipo: demanda
status: entregue
data: 2026-08-19
atualizado: 2026-08-19
tags: [plataforma, demanda, sessao]
---

# 🎯 SESSAO-12 — Tarefas e Delegação

> [!success] ✅ Entregue em 28/08/2026 — [[handoff_2026_08_28_sessao12_tarefas]] (fecha o bloco noturno D-26)
> Executada no desenho da **D-34** (respostas do dono no aval do bloco): 3 modos por setor com padrão "desativada", sorteio balanceado SÓ entre quem está logado (heartbeat de presença), tarefa avulsa com timer opcional, delegação que organiza sem travar. As duas perguntas da demanda foram respondidas no aval (sem check-in formal; timer só se o atarefado quiser).

## O que é

O controle de afazeres: "meus afazeres / afazeres do time", com delegação **aleatória** (o sistema sorteia quando o item entra no setor) ou **direta** (líder/admin escolhe quem faz) — configurável por setor.

## Requisitos cobertos

RF-40 · RF-41 · RF-42 · RF-43.

## Decisões que regem

D-06 (a tarefa aparece onde o operador está: tablet e celular) · D-10.

## Comportamento esperado

- **Meus afazeres:** lista pessoal do operador — cards de unidade delegados a ele + tarefas avulsas. **Afazeres do time:** visão do líder com carga por pessoa.
- **Delegação aleatória (RF-41):** setor configurado como "aleatório" → card que chega é sorteado entre os membros ativos do setor. Regras de sorteio justas (balancear por quantidade aberta) — detalhar com o dono.
- **Delegação direta (RF-42):** líder/admin atribui; reatribuir é permitido e registrado.
- **Configurável por setor (RF-43):** cada setor escolhe o modo (aleatório, direto, ou livre/sem delegação).
- Delegação é evento append-only (quem delegou, para quem, quando, modo).
- Tarefas avulsas (fora do fluxo de cards): criar, delegar, concluir — ex.: "engraxar caixas de cola" (manutenção já vive em card hoje).

## Perguntar ao dono no início da sessão

- O sorteio considera quem está presente no dia? Como o sistema sabe quem veio trabalhar (check-in no tablet)?
- Tarefa avulsa também conta tempo (iniciar/finalizar) ou é só feito/não feito?

## Fora do escopo

Automações "quando X, delegue Y" (11) · notificação externa.

## Critérios de aceite

- [ ] Setor em modo aleatório: 5 cards chegando são distribuídos balanceadamente entre 2 membros.
- [ ] Líder reatribui e o histórico mostra as duas delegações.
- [ ] "Meus afazeres" do operador reflete delegações na hora, no celular e no tablet.
- [ ] Modo de delegação trocado por setor sem afetar os demais.
- [ ] PR + handoff.
