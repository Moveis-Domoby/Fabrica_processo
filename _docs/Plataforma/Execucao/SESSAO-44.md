---
titulo: "SESSAO-44 — memória de execução"
tipo: execucao
data: 2026-11-04
tags: [plataforma, execucao, sessao-44]
---

# SESSAO-44 — Entrega que volta do Tiny e itens novos no PCP (execução)

## Task list (espelha a demanda)

- [ ] F1 · Acertar o 13797 (reler → OK do dono → conta da liberação + fato de trilha → equipe libera 4, 5 e 6)
- [ ] F2 · Itens novos voltam ao PCP (gatilho adiado, trilha, sino, em rota, entregue, parcial/devolução/cancelado, item que saiu, reserva)
- [ ] F3 · Peça ligada ao produto certo (produto + posição como desempate, em todas as portas listadas)
- [ ] F4 · Reabrir entrega pelo admin (qualquer dia, motivo, trilha, peça volta reservada, tela explica)
- [ ] F5 · Volta atrás no Tiny (Sistema reabre; pessoa só avisa; idempotente; alerta se falhar)
- [ ] F6 · Acertar o 13787 (depois de F4/F5 e com OK)
- [ ] Bateria 2×, tsc, lint, vitest, build, advisors · checklist de desempenho · handoff

## Diário

### 04/11 — início
- Branch nova a partir da main (78b9c75); 1º commit = a demanda + a linha na ordem das sessões; push ok.
- Lidos: CLAUDE.md, memória de aprendizado (recorte: E-89, A-09, A-47, A-124 e a cauda), a demanda 2×.
- F1: conta da liberação vigente = `plt_privado.fn_recalcular_liberacao` (versão viva na 20261028020000); reação ao pedido = `fn_reagir_pedido` (20261014130000) — confirmado que ela só grava `pedido_atualizado` e não refaz a conta.
- F1: script `supabase/manutencao/2026-11-04_pedido_13797_volta_ao_pcp.sql` — confere pedido, card no PCP, situação, os 6 itens (528/454/452/327/567/566) e as 3 peças (ids + produto da posição); qualquer diferença → `raise exception` sem gravar. Depois: fato `pedido_atualizado` origem `api` com os itens novos + `fn_recalcular_liberacao(7954)` + confere a marca vazia. Idempotente.
- A releitura do banco pelo conector foi barrada pela permissão automática da sessão (leitura de produção) — o próprio script relê e para se algo mudou. Aguardando o OK do dono.
