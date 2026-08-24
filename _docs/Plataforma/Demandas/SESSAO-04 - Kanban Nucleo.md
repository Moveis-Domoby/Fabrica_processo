---
titulo: "SESSAO-04 — Kanban Núcleo"
tipo: demanda
status: rascunho
data: 2026-08-19
atualizado: 2026-08-19
tags: [plataforma, demanda, sessao]
---

# 🎯 SESSAO-04 — Kanban Núcleo

## O que é

O coração visível: quadros, etapas e cards com movimentação manual — replicando o funcionamento do ClickUp que a equipe já domina, com o modelo híbrido pedido/unidade (D-01).

## Requisitos cobertos

RF-01 · RF-02 · RF-04 · início de RF-03 (criação manual de card; a automática via API vem na SESSAO-10).

## Decisões que regem

D-01 (híbrido) · D-03 (movimentação manual) · D-05 (só produção) · D-09 (a atestação plugará na movimentação — SESSAO-06).

## Comportamento esperado

- **Quadro PCP:** 1 card por **pedido** (criado manualmente nesta fase, com itens). O PCP "libera" o pedido: cada móvel vira um **card de unidade** (k/n) e é enviado à etapa que o PCP escolher — unidades do mesmo pedido podem ir para etapas diferentes.
- **Estrutura em 2 níveis (D-12, como o ClickUp):** **setores** (o card viaja entre eles) contendo **etapas internas** (status dentro do setor). Setores do dia 1 (seed): PCP · SECC · CNC · FITAMENTO · FURAÇÃO · MONTAGEM · LIMPEZA E EMBALAGEM — **METALURGICA não existe ainda** (uso futuro). Admin cadastra novos setores e novas etapas dentro de cada setor (RF-07).
- ⚠️ **Etapas internas nascem VAZIAS (D-14):** não semear, não chutar — o dono cadastra as dele ao ver a plataforma. Toda etapa cadastrada já nasce com **timer próprio** (RF-08).
- **Fim de linha (D-13):** entrada sempre pelo PCP; terminais ESTOQUE (parado) e ROTAS (entregue) — confirmar Q-28 sobre a ROTAS antes de codar.
- **Quadros de setor:** etapas internas como colunas, cards de unidade, drag-and-drop e/ou botão "mover para…" (tablet não arrasta bem — os dois gestos existem).
- **Card de unidade** mostra: pedido de origem, produto, (k/n), etapa atual, tempo na etapa (contador simples nesta sessão; o modelo fila/execução completo é a SESSAO-05).
- **Expedição/reagrupamento:** visão por pedido mostrando quais unidades já chegaram — pedido completo fica evidente (D-01).
- Toda movimentação grava evento append-only com autor (usa a identificação da SESSAO-03).
- Setores e etapas internas: criar/renomear/ordenar/desativar por admin (desativar, nunca apagar — histórico aponta para eles).

## Perguntar ao dono no início da sessão

- Q-26: etapas internas padrão de todo setor ("na fila → em execução → finalizado" + as que o admin criar)?
- Q-27: onde acontece o reagrupamento do pedido no dia 1 (setor ESTOQUE/EXPEDIÇÃO a cadastrar, ou só a visão de pedido completo)?
- Unidade que gera trabalho paralelo (metalurgia + madeira): sub-cards agora ou depois? (Q-21)

## Fora do escopo

Timers fila/execução detalhados (05) · qualidade nas transições (06) · API (10) · automações (11).

## Critérios de aceite

- [ ] Pedido com 3 itens liberado no PCP gera 3 cards de unidade nas etapas escolhidas.
- [ ] Mover card grava evento com autor, origem, destino e timestamp.
- [ ] Visão de expedição mostra 2 de 3 unidades chegadas → pedido incompleto.
- [ ] Funciona em tablet (botão "mover para…") e desktop (drag-and-drop).
- [ ] PR + handoff.
