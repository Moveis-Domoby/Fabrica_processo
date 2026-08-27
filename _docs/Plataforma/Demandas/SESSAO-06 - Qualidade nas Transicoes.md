---
titulo: "SESSAO-06 — Qualidade nas Transições"
tipo: demanda
status: rascunho
data: 2026-08-19
atualizado: 2026-08-19
tags: [plataforma, demanda, sessao, qualidade]
---

# 🎯 SESSAO-06 — Qualidade nas Transições (D-09)

## O que é

O sistema de dupla atestação de qualidade pedido pela equipe: o estado físico da peça (🟢🟡🔴) é declarado por quem entrega e conferido por quem recebe — porque "um setor pode dizer que algo está bom apenas para prejudicar o próximo".

## Requisitos cobertos

RF-80 · RF-81 · RF-82 · RF-83 · RF-84 · RF-85 (a parte de dashboard entra na SESSAO-10; aqui os dados nascem certos).

## Decisões que regem

D-09 (o fluxo completo) · D-02 (a pausa não pode sujar os timers) · RNF-05.

## Comportamento esperado (revisado em 24/08 — D-09 revisada: SEM disputa/pausa, SEM foto)

1. **Ao mover** para outro setor: modal obrigatório — 🟢 perfeito estado · 🟡 estado de atenção · 🔴 danificado. Sem marcação, não move. Foto NÃO é obrigatória (nem na saída nem na entrada).
2. **Ao receber**, antes de permitir "iniciar": *"O setor X marcou como 🟡 estado de atenção — você concorda?"* — o recebedor registra o próprio parecer (concorda, ou marca o estado que ele enxerga).
3. **Divergência NÃO trava a peça:** não existe pausa nem fluxo de resolução por enquanto — os dois pareceres ficam registrados e alimentam a dashboard (RF-85). O card segue o recebimento normal.
4. **Fluxo pelo estado confirmado/registrado pelo recebedor:**
   - 🟢 → segue o fluxo padrão.
   - 🟡 → segue o fluxo normalmente (e a notificação automática do item 5 sai sozinha).
   - 🔴 → card vai para a etapa **DANIFICADO**.
5. **Notificação automática (RF-84, definida em 24/08):** divergência entre setores, OU marcação 🟡, OU marcação 🔴 → **líder/admin notificado com exatamente o que aconteceu** (setores envolvidos, quem marcou o quê, os dois pareceres).
6. **Critério do 🟡 escrito na interface de marcação (Q-16 ✅):** *"levemente danificado, porém ainda dá pra seguir e tentar consertar"*.
7. **Movimentação via API não exige estado** (RF-86): atestação de qualidade é gesto exclusivamente humano.
8. Cada atestação, parecer e notificação é **evento append-only** com autor — é isso que alimenta a dashboard de qualidade (RF-85).

## Perguntar ao dono no início da sessão

- A notificação de 🟡/🔴/divergência vai para o líder de qual setor — do que entregou, do que recebeu, ou ambos + admin?

## Fora do escopo

Fluxo de disputa/pausa com resolução do líder (adiado na revisão de 24/08 — se voltar, vira decisão nova) · dashboard de qualidade (08) · notificação externa WhatsApp/e-mail (Q-42).

## Critérios de aceite

- [ ] Impossível mover card entre setores sem marcar estado.
- [ ] Impossível iniciar trabalho sem responder à confirmação de recebimento.
- [ ] Divergência registra os dois pareceres e NÃO trava o card.
- [ ] 🟡, 🔴 e divergência disparam notificação automática a líder/admin com o relato exato.
- [ ] 🔴 confirmado → DANIFICADO; movimento via API passa sem exigir estado.
- [ ] Linha do tempo do card conta a história de qualidade completa.
- [ ] PR + handoff + memória de aprendizado atualizada.
