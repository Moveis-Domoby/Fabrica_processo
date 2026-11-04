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

### 04/11 ~00:20–02:00 — frentes 2 a 5 (banco e telas), frente 6 escrita
- **Mapa do código vivo** (scratchpad `vivas/dump.mjs`: `pg_get_functiondef` numa sessão só-leitura, sem imprimir corpo): `fn_upsert_pedido` (o `update pedidos` antes de apagar/regravar os itens — confirmado), `fn_reagir_pedido`, `fn_fechar_pedido`, `plt_fn_entrega_desfazer`, reservas, janela/liberar, 16 portas que casavam peça × item por posição.
- **Defeito confirmado (F4):** `fn_projetar_reserva` zera a reserva no `card_arquivado` e o `card_desarquivado` não a devolve — a peça do estoque voltava solta. Corrigido em `fn_reabrir_entrega` (fato `peca_reservada` com o pedido/vaga do fato do arquivar).
- **Reserva (F2):** confirmado que a rodada só avaliava o pedido uma vez (`estoque_reserva_avaliada`) — itens novos nunca eram avaliados. Agora reavalia quando há `pedido_itens_alterados` depois da última avaliação.
- **Migration `20261104010000_plt_itens_novos_reabrir_entrega.sql`** (montada por partes no scratchpad + gerador `vivas/gerar.mjs` com trocas conferidas por contagem — A-97): tipo `pedido_itens_alterados`; `fn_eh_frete` (a view de itens passa a usá-la); `fn_vagas_pedido` (plpgsql, plano guardado) + `fn_vaga_coberta`; índice único por posição → por posição + código + descrição (E-177); `fn_recalcular_liberacao`; `fn_estoque_reservas_rodar` (vagas uma vez por pedido); `fn_aviso_publico_de` (+ 'pcp'), `fn_avisos_catalogo` (+4 avisos), `fn_avisar_publico`; `fn_reabrir_entrega`, `plt_fn_entrega_desfazer` (admin qualquer dia/Tiny; Tiny só se ainda "Entregue"); `fn_tiny_saiu_de_entregue` + ramo novo na `fn_reagir_pedido`; `fn_itens_resumo`, `fn_reagir_itens_pedido` + gatilho adiado `plt_pedidos_zz_itens`; recriadas da viva com trocas: janela, liberar (em rota libera o que falta), alocar, sugestões (estoque e em produção), realocar devolução, concluir pelo super admin, todos os pedidos e kanban (frete do card).
- **Telas:** ficha do pedido ("Reabrir entrega" para admin + explicação; parcial recusada), modal com os textos do reabrir, Entregas do dia (explicação no lugar do botão escondido).
- **Bateria:** bloco SESSAO-44 (14 verificações) + a migration na reaplicação do meio (E-81). Rodadas: 1ª 7 vermelhos (4 = índice único, E-177; 2 = envio ao Tiny quando o aviso de volta não chegou — corrigido; 1 = painel de vendas, **já vermelho na main**, A-134); depois E-175/E-176; 4ª rodada 1.458 verdes + o vermelho antigo.
- **Medida no banco real (só leitura, aquecida, 13797):** a conta das vagas 2 ms + 1,3 ms de plano (fria: 5–8 ms — A-136).
- tsc, lint, vitest (360/360) e build verdes.
- **Frente 6:** `supabase/manutencao/2026-11-04_pedido_13787_entregue_por_engano.sql` escrito (relê e para; reabre sem Tiny e sem as peças do estoque; avulsos → peças prontas em Pedidos em aguardo + avulso arquivado com referência; conferência final 4/2/2). Roda só depois da migration no ar e com o OK do dono — antes, um ensaio que termina em `raise` (A-11).
- Decisões provisórias D-212…D-216 no cofre; aprendizados E-175…E-177, A-134…A-136.

### 04/11 ~02:00 — fechamento do turno
- Gatilho dos itens ignora card arquivado sem entrega (limpeza) — o Tiny reler um pedido antigo não o ressuscita.
- Bateria 2× seguidas: **1.458 verdes** nas duas + o vermelho antigo do painel de vendas (A-134). Build do site ok.
- Handoff escrito (`_docs/Handoffs/handoff_2026_11_04_sessao44_entrega_tiny_itens_novos.md`); a linha da ordem das sessões em "em andamento".
- Cópia da main do rascunho removida (junção tirada antes).
- **Espera o dono:** subir o banco, publicar o site, rodar o 13787 (ensaio antes), criar as tarefas do ClickUp.
