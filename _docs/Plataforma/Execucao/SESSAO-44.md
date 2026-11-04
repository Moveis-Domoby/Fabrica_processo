---
titulo: "SESSAO-44 — memória de execução"
tipo: execucao
data: 2026-11-04
tags: [plataforma, execucao, sessao-44]
---

# SESSAO-44 — Entrega que volta do Tiny e itens novos no PCP (execução)

## Task list (espelha a demanda)

- [x] F1 · Acertar o 13797 (reler → OK do dono → conta da liberação + fato de trilha → equipe libera 4, 5 e 6) — rodado 04/11; falta só o gesto da equipe
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

### 04/11 ~00:13 (Brasília) — F1 rodada com o OK do dono ("Pode rodar")
- Script rodado pelo conector (03:13:31 UTC): todas as conferências passaram (nada tinha mudado desde o raio-x); fato de trilha **14548234** (`pedido_atualizado`, origem `api`, os 3 itens novos no `dados`); a marca `liberado_completo_em` do card 14542142 ficou **vazia** → o pedido voltou ao quadro do PCP (não arquivado, sem stand-by).
- Peças intactas: 14542143 (528, seq 1, MONTAGEM), 14542153 (454, seq 2) e 14542161 (452, seq 3), ambas em PEDIDOS EM AGUARDO (a aba da expedição). Nada arquivado.
- Janela de liberação conferida como admin, sem gravar (A-133, `rollback`): `ja_liberadas` = seq 1, 2, 3; sugestões só para **4** (327, peça 14541255, 2 iguais), **5** (567, peça 14541837, 1) e **6** (566, peça 14542013, 3); nenhuma reservada; `em_producao` vazio.
- Tropeço sem dano: a 1ª conferência da janela usou o id da pessoa no `sub` — a porta recusou; o certo é o `auth_user_id` (A-133).
- Falta: a equipe liberar as vagas 4, 5 e 6 na janela (gesto deles).
