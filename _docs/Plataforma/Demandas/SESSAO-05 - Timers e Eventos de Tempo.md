---
titulo: "SESSAO-05 — Timers e Eventos de Tempo"
tipo: demanda
status: em execucao
data: 2026-08-19
atualizado: 2026-08-27
tags: [plataforma, demanda, sessao]
---

# 🎯 SESSAO-05 — Timers e Eventos de Tempo

## O que é

A razão de existir da plataforma: o tempo passa a ser medido sozinho, como subproduto dos cliques que a equipe já dá. Nenhum gesto extra além de mover / iniciar / finalizar.

## Requisitos cobertos

RF-05 · RF-10 · RF-11 · RF-12 · RF-14 (base) · RNF-05.

## Decisões que regem

D-02 (fila vs execução, dash compara e soma) · D-04 (alavancagem operacional; histórico auditável) · D-01.

## Comportamento esperado

- **Chegada na etapa** (card movido para lá) abre o **tempo de fila**. **O tempo de fila pertence ao SETOR/etapa, nunca a uma pessoa** (D-02 detalhada em 24/08): na fila o card não está direcionado a ninguém; fila longa = gargalo do setor.
- **"Iniciar"** fecha a fila e abre o **tempo de execução**, registrando quem iniciou.
- **"Finalizar"** fecha a execução, registra quem finalizou, e o card fica pronto para ser movido (a marcação de qualidade da SESSAO-06 entra exatamente aqui depois).
- **Contabilização por movimentação (RF-11):** usuário moveu o card para a etapa → +1 movimentação para ele; iniciar/finalizar contam para quem clicou.
- **Linha do tempo do card:** histórico completo e legível — cada etapa com fila, execução, total e autores.
- Tudo é evento append-only; correção de erro operacional (ex.: finalizou sem querer) é **novo evento de estorno** visível, nunca edição — e só líder pode estornar.
- Card sem "iniciar" por muito tempo é visível na etapa (ordenação/indicador de espera — o alerta automático é automação da SESSAO-13).

## Perguntar ao dono no início da sessão

- Pode existir mais de um card "em execução" por operador ao mesmo tempo? (Provavelmente sim, mas confirmar.)
- "Iniciar" é obrigatório antes de "finalizar", ou o setor pode finalizar direto (tempo de execução zero)?

> ✅ **Respondidas em 27/08/2026 (viraram a [[PLT - Decisoes de Produto#D-24]]):** vários cards por pessoa PODE, com **limite configurável por setor** (padrão sem limite); **iniciar é obrigatório**; mover com execução aberta **encerra a execução automaticamente**; **admin pode tudo** (estorno em qualquer setor, líder no próprio); **transferência entre pessoas** finaliza para um e inicia para o outro, o tempo do produto segue contando.

## Fora do escopo

Qualidade nas transições (06) · dashboards (08) · alertas automáticos (11).

## Critérios de aceite

- [ ] Card que passou por 2 etapas mostra na linha do tempo: fila e execução de cada uma, com autores.
- [ ] Mover sem iniciar → tempo fica todo como fila (ou o comportamento decidido na pergunta acima).
- [ ] Estorno cria evento novo e o original permanece visível.
- [ ] UPDATE/DELETE em evento falham (verificado no banco).
- [ ] PR + handoff.
