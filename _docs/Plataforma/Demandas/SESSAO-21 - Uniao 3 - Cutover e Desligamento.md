---
titulo: "SESSAO-21 — União 3: Cutover e desligamento do projeto antigo"
tipo: demanda
status: entregue — aceite em curso
data: 2026-09-15
atualizado: 2026-09-22
tags: [plataforma, demanda, uniao, cutover]
---

# 🎯 SESSAO-21 — União 3: Cutover e desligamento do projeto antigo

> ✅ **Promovida a 📐 em 21/09/2026 (Cowork):** o dono confirmou a **validação F5** — vem usando o módulo Comercial novo lado a lado com o painel antigo e os números batem. A sessão ainda abre com uma reconferência rápida de paridade (a F5 é assinada NA CONVERSA antes de qualquer desligamento), mas a validação de uso já aconteceu.
> **Janela decidida pelo dono: logo após o handoff da SESSAO-22** (🔨 em execução em 21/09) — nunca em paralelo com outra sessão mexendo no mesmo banco (lição E-20). O dono precisa estar presente durante a janela: cada passo do cutover é confirmado um a um, e o passo 4 (trocar a URL do webhook no DataCrazy) é dele.

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

- [x] Nenhuma janela em que crons de disparo ou o renovador do token estejam ativos nos dois projetos ao mesmo tempo. *(22/09: antigo desativado 20:28 UTC; o primeiro job na fábrica nasceu 21:19 UTC — 51 min sem NENHUM ativo, dentro da validade do refresh.)*
- [ ] Primeira lista de disparo real pós-cutover roda com sucesso ponta a ponta (envio → resposta via webhook → verificação de venda) no banco da fábrica. *(23/09: o dono trocou a URL no DataCrazy e a trava foi aberta — PR #6; a 1ª lista real ele roda quando for usar, e **pediu para não ficar como pendência**: "vou lembrar disso se der erro")*
- [ ] Token do Tiny renovando só na fábrica por pelo menos 24h após o cutover, sem falha. *(em curso: renovação manual 21:20 UTC ✅; 1ª automática 23/09 00:00:01 UTC ✅; conferir as seguintes até 21:20 UTC de 23/09)*
- [ ] Backup final do projeto antigo salvo e referenciado no handoff antes de pausar/excluir. *(**dispensado pelo dono em 23/09**: os dados de clientes estão no Tiny e as 6 tabelas do disparo já estão na fábrica, idênticas byte a byte — nada exclusivo ficou no projeto antigo; falta só a data de pausar/excluir)*
- [x] `000 - MAPA DO PROJETO.md` e o cofre do recompra recebem a nota de encerramento (para onde tudo foi). *(22/09)*

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

> [!success] ✅ Resolvido em 23/09/2026 — migration 32 (`20260923120000_plt_seguranca_herdada.sql`)
> Dono: *"analise as principais [automações]; se nenhuma tiver, pode realizar os ajustes"*. Nenhum dos 4 workflows principais do n8n chama a função; o único uso é interno (`plt_privado.fn_vincular_conta_receber`, SECURITY DEFINER); 0 chamadas pela API em 24h (consulta de controle viu 66 da `fn_upsert_pedido`). Aplicado: EXECUTE revogado de `public`/`anon`/`authenticated` na `fn_pedido_por_numero_nf` (sonda anônima → 401) e `search_path` fixo nas duas. `vig_conhecimento_vendas`: mantida como está (intencional). Test:banco 2 rodadas ✔, impressão digital idêntica, advisors limpos desses 3.

**O que fazer (original):** perguntar ao dono se essas funções ainda são usadas (o backfill
já terminou) e então **revogar o execute do `anon`** na primeira, **fixar o
`search_path`** nas duas, ou **dropar** o que estiver morto. Nada disso é do
domínio Comercial — mas é o tipo de coisa que, com ~30 logins entrando, não deve
ficar esquecida.

## Notas para o Claude Code

Ler [[PLT - Plano Uniao das Plataformas]]. Depende das SESSÕES 19 e 20 entregues e validadas. Cada passo do cutover é irreversível ou sensível — **executar um por vez, com confirmação do dono na conversa**.

## Resultado (preencher ao entregar)

**Entregue em 22/09/2026** — [[handoff_2026_09_22_sessao21_cutover]] · memória: `_docs/Plataforma/Execucao/SESSAO-21.md` · branch `sessao-21-cutover` (PR para revisão do dono).

- **F5:** reconferida (junho–setembro ao centavo; 6 tabelas com delta explicado) e assinada na conversa.
- **F6:** executada com uma mudança de ordem pedida pelo dono ("comece pelo renovador"): desativar os 6 do antigo → delta → **renovador na fábrica + renovação manual** (o passo 5 veio antes do 3b) → 3 crons de disparo → lado da fábrica do webhook DataCrazy validado. Achado que ditou a ordem fina: os syncs do antigo **renovavam o token sozinhos em 401** (A-18) — por isso saíram junto com o renovador.
- **Pendências do dono (atualizadas em 23/09):** ✅ PR #5 mesclado · ✅ URL do DataCrazy trocada · ✅ trava aberta ([PR #6](https://github.com/Moveis-Domoby/Fabrica_processo/pull/6), a pedido do dono) · 1ª lista real: o dono roda quando for usar (não é pendência) · backup final dispensado pelo dono · **em aberto:** manter ou apagar os 6 jobs desativados do antigo (explicado ao dono), data da F7, os 3 apontamentos de segurança e as 4 perguntas da SESSAO-29.
- **Extra pedido pelo dono na janela:** conferência Tiny × plataforma pedido a pedido — setembro (206) e histórico (5.360): 15 pedidos + 2 cadastros corrigidos com ensaio e guarda; causa-raiz registrada (P17) e virou a [[SESSAO-29 - Reconciliacao Tiny - Pente-fino e Ultimo Pacote Vence]] (🔶).
