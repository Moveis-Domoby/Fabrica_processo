---
titulo: "SESSAO-21 — União 3: Cutover e desligamento do projeto antigo"
tipo: demanda
status: rascunho
data: 2026-09-15
atualizado: 2026-09-15
tags: [plataforma, demanda, uniao, cutover]
---

# 🎯 SESSAO-21 — União 3: Cutover e desligamento do projeto antigo

## O que é

A troca de guarda: o módulo Comercial da fábrica assume a operação, o projeto Supabase antigo (`kfkcumjepnxnnzyvmxfo`) entra em quarentena e, ao final dela, é excluído. Fases F5–F7 de [[PLT - Plano Uniao das Plataformas]].

## Decisões que regem esta demanda

**D-46** (união; painel antigo não desliga antes da validação do dono; sem disparos até concluir), riscos 1 e 2 do plano (token do Tiny e disparo duplicado — um projeto por vez, sempre).

## Comportamento esperado

1. **F5 — Validação em paralelo**: dono usa o módulo novo; comparação final de dashboards antigo×novo; checklist de paridade assinado pelo dono na conversa.
2. **F6 — Cutover em janela única** (ordem exata, cada passo confirmado antes do seguinte):
   1. Desagendar os 6 crons no projeto antigo (`cron.unschedule`).
   2. Delta final de dados das 6 tabelas (o que mudou desde a carga da SESSAO-19), com contagens conferidas.
   3. Agendar os 4 crons na fábrica (modelo em `cron_agendamentos.sql` do recompra, URL/anon key da fábrica).
   4. Dono troca a URL do webhook de resposta no DataCrazy para a function da fábrica.
   5. Disparar `tiny-auth-refresh` manualmente na fábrica e confirmar `tiny_auth.updated_at` avançando **só** lá.
3. **F7 — Quarentena e exclusão**: painel antigo fica no ar como espelho congelado; após 2–4 semanas sem incidente (dono decide a data), dump final de backup do projeto antigo guardado no cofre, projeto **pausado** e depois **excluído**.

## Fora do escopo

Qualquer feature nova. Consolidação `vendas_marketing`×`pedidos` além da view. Desligar o front antigo antes da palavra do dono.

## Critérios de aceite

- [ ] Nenhuma janela em que crons de disparo ou o renovador do token estejam ativos nos dois projetos ao mesmo tempo.
- [ ] Primeira lista de disparo real pós-cutover roda com sucesso ponta a ponta (envio → resposta via webhook → verificação de venda) no banco da fábrica.
- [ ] Token do Tiny renovando só na fábrica por pelo menos 24h após o cutover, sem falha.
- [ ] Backup final do projeto antigo salvo e referenciado no handoff antes de pausar/excluir.
- [ ] `000 - MAPA DO PROJETO.md` e o cofre do recompra recebem a nota de encerramento (para onde tudo foi).

## Notas para o Claude Code

Ler [[PLT - Plano Uniao das Plataformas]]. Depende das SESSÕES 19 e 20 entregues e validadas. Cada passo do cutover é irreversível ou sensível — **executar um por vez, com confirmação do dono na conversa**.

## Resultado (preencher ao entregar)

*—*
