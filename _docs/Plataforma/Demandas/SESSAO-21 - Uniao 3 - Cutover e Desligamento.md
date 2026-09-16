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

## Herdado da SESSAO-20 — 3 apontamentos de segurança do banco (não são do Comercial)

Os advisors do Supabase, conferidos depois de aplicar a migration 27 em 15/09,
mostraram **3 apontamentos que já existiam e vêm de outra frente** (o backfill
histórico do Tiny e a tabela do "vigia"). A SESSAO-20 **não os tocou**, porque
estavam fora do escopo dela — e mexer em objeto de outra frente sem o dono pedir
é exatamente o que a regra 3 proíbe. Ficam aqui para serem decididos:

| O que o Supabase aponta | Em bom português | Risco hoje |
|---|---|---|
| `fn_pedido_por_numero_nf` é SECURITY DEFINER e **executável pelo papel `anon`** | qualquer visitante **sem login** pode chamar essa função pela API e receber o pedido de uma nota fiscal | 🟠 o mais sério dos três: é a única coisa aqui que responde a quem não tem login |
| `fn_backfill_conta_mapear` e `fn_vig_touch` **sem `search_path` fixo** | a função não trava em quais schemas procura o que usa — o caminho pode ser manipulado por quem consiga criar objeto | 🟡 é a mesma classe do E-11, já corrigida em todo o resto da casa |
| `vig_conhecimento_vendas` com **RLS ligado e nenhuma policy** | ninguém lê pelo navegador (nem admin); só a chave de serviço | ⚪ inofensivo — pode até ser intencional, como a `tiny_auth` |

**O que fazer:** perguntar ao dono se essas funções ainda são usadas (o backfill
já terminou) e então **revogar o execute do `anon`** na primeira, **fixar o
`search_path`** nas duas, ou **dropar** o que estiver morto. Nada disso é do
domínio Comercial — mas é o tipo de coisa que, com ~30 logins entrando, não deve
ficar esquecida.

## Notas para o Claude Code

Ler [[PLT - Plano Uniao das Plataformas]]. Depende das SESSÕES 19 e 20 entregues e validadas. Cada passo do cutover é irreversível ou sensível — **executar um por vez, com confirmação do dono na conversa**.

## Resultado (preencher ao entregar)

*—*
