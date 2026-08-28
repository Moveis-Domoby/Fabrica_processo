# Memória de execução — SESSAO-12 · Tarefas e Delegação

**Branch:** `sessao-12-tarefas` · **Início:** 2026-08-28 (bloco noturno D-26 — a ÚLTIMA do bloco)
**Demanda:** `_docs/Plataforma/Demandas/SESSAO-12 - Tarefas e Delegacao.md`
**Decisões que regem:** **D-34** (3 modos por setor; sorteio SÓ entre logados, balanceado; tarefa avulsa sem timer obrigatório; **delegação organiza, não trava**) · D-06 (aparece no tablet e no celular) · RF-40…43.

## Task list (espelho da demanda + D-34)

1. [ ] Migration 20: `plt_setores.modo_delegacao` (desativada/direta/aleatoria) · `plt_cards.responsavel_id` (projeção do evento `delegacao` — M-13) · `plt_presencas` (heartbeat de quem está logado) · `plt_tarefas.iniciada_em` (timer opcional) · validação da delegação (líder do setor do card ou admin; sorteio só por automação) · sorteio automático na chegada (balanceado por carga aberta, só entre presentes) · aviso ao delegado no sino
2. [ ] Delegação é evento append-only (quem delegou, para quem, quando, modo) — reatribuição registra as duas
3. [ ] Front: heartbeat de presença no ProvedorSessao · página Afazeres (meus afazeres + afazeres do time com carga por pessoa e reatribuição) · tarefas avulsas (criar/delegar/iniciar opcional/concluir) · modo de delegação por setor na Estrutura · responsável visível no card (quadro e tablet)
3b. [ ] "Meus afazeres" reflete na hora no celular e no tablet (invalidação + polling)
4. [ ] Testes: sorteio balanceado (5 cards → 2 membros presentes, diferença ≤ 1) · quem não está logado não é sorteado · reatribuição grava histórico duplo · modo por setor independente · gates
5. [ ] tsc/lint/vitest/test:banco 2x → aplicar → advisors → **verificação de tela** (a 12 é sessão de conferência visual)
6. [ ] Task list × demanda · merge na main · handoff + memória + continuidade FINAL do bloco

## Decisões técnicas

- **Presença = heartbeat**: o front grava `plt_presencas.visto_em` no login e a cada 5 min; "logado agora" = visto nos últimos 15 min. Sorteio sem candidato presente → card fica sem dono (modo desativada de fato) — melhor do que sortear quem não veio (M-03).
- **Balanceamento**: o sorteado é quem tem MENOS afazeres abertos (cards sob responsabilidade + tarefas abertas); empate decide por menos recente. Determinístico e auditável — "regras de sorteio justas" da demanda.
- **Delegação NÃO trava** (D-34): `responsavel_id` é organização; qualquer um do setor continua podendo agir (nenhum trigger de execução olha o responsável).
- **Timer opcional da tarefa avulsa**: `iniciada_em` só se a pessoa tocar "Iniciar tempo"; concluir sem iniciar é normal.

## Registro contínuo

- [28/08] Branch criada. RLS de `plt_tarefas` conferido (criar: admin/líder/próprio; atualizar: admin/responsável/líder — já serve). Tipo de evento `delegacao` existe desde a SESSAO-02.
