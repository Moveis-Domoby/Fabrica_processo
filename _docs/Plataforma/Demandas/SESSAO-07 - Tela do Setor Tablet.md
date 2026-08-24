---
titulo: "SESSAO-07 — Tela do Setor (Tablet)"
tipo: demanda
status: rascunho
data: 2026-08-19
atualizado: 2026-08-19
tags: [plataforma, demanda, sessao, ux]
---

# 🎯 SESSAO-07 — Tela do Setor (Tablet)

## O que é

A tela que o chão de fábrica vê o dia inteiro: a fila do setor num tablet/PC fixo, com botões grandes e o mínimo de ruído. É a "navegação simples para os setores" — o operador não navega, ele age.

## Requisitos cobertos

RF-22 · RF-24 (nível "simples") · RF-25 · consolida o uso de RF-05/RF-80/RF-81 no dispositivo real.

## Decisões que regem

D-06 (tablet compartilhado + PIN; mobile-first) · D-02 · D-09.

## Comportamento esperado

- **Modo setor:** dispositivo logado no setor exibe SUA fila em tela cheia — cards ordenados por chegada, com destaque para os que esperam há mais tempo e os pausados por disputa.
- Ações diretas no card, com PIN do operador: **receber (atestação D-09) · iniciar · finalizar · mover (com marcação D-09)**. Fluxo completo em poucos toques, botões dimensionados para dedo.
- O card na fila mostra o essencial (a definir com Q-31 — candidatos: produto, medidas, (k/n), pedido, estado de qualidade na chegada, observação).
- Atualização em tempo real: card novo aparece sem recarregar (som/alerta é a Q-32 — perguntar).
- A mesma experiência funciona no celular pessoal logado (D-06), mostrando o setor do usuário.

## Perguntar ao dono no início da sessão

- Q-31: o que o operador PRECISA ver no card (imagem 3D? medidas? obs?) e o que é ruído.
- Q-32: som/alerta na chegada de card, ou consulta passiva.

## Fora do escopo

Dashboards · telas de líder/admin · tarefas.

## Critérios de aceite

- [ ] Num tablet real (ou viewport equivalente), o ciclo receber → iniciar → finalizar → mover+marcar acontece só com toques, sem teclado além do PIN.
- [ ] Dois operadores no mesmo tablet registram ações com autores distintos.
- [ ] Card novo aparece na fila em tempo real.
- [ ] Card pausado (disputa D-09) é visualmente inconfundível e não deixa iniciar.
- [ ] PR + handoff com screenshots em tablet e celular.
