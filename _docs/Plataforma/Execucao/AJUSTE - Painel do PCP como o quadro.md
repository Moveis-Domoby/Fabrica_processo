---
titulo: Execução — Ajuste · O quadrinho do PCP na Visão do dia conta o que o quadro do PCP mostra (D-75)
tipo: execucao
data: 2026-09-28
atualizado: 2026-09-28
tags: [execucao, ajuste, dashboards, visao-do-dia, pcp, d-75]
---

# 🔧 Execução — Ajuste · Painel do PCP como o quadro

**Origem:** achado fora do escopo do ajuste do Frete ([[handoff_2026_09_28_ajuste_frete_fora_da_producao]] §4 — "tarefa sugerida"): a Visão do dia dizia "pedidos a liberar" = 226, o quadro do PCP mostrava bem menos. A porta do painel (`plt_fn_dash_pcp_dia`) contava todo card de pedido vivo, não cancelado, com unidade por liberar — inclusive pedido que o Tiny já marca como Entregue/Não entregue. O quadro (`plt_fn_cards_pedido_pcp`) esconde os encerrados no Tiny desde a SESSAO-23 (migration 35) e o painel nunca foi acompanhado.
**Branch:** `ajuste-painel-pcp-como-o-quadro` — criada da `origin/main` em **943ce63** (o Frete tinha acabado de ser mesclado; a worktree do app nasceu em 3e15c5c, 11 commits atrás — trazida por fast-forward antes de tudo).
**Worktree:** `.claude/worktrees/kind-brattain-634593` (sessão própria; a pasta principal não é tocada).
**Numeração reservada** (varredura em TODAS as worktrees — A-33 — em 28/09 ~23:40: maiores D-74, E-66, A-34, Q-71, RF-104; migrations até 20260928180000): migration **41 = `20260928210000_plt_painel_pcp_como_o_quadro.sql`**, **D-75**, **E-67+** e **A-35+** se precisar.

## Task list (espelha a demanda do prompt + as respostas do dono)

1. [x] Leituras obrigatórias (CLAUDE.md, memória de aprendizado, decisões, visão geral, requisitos, ordem das sessões, handoff do Frete, esquema do banco, mapa, perguntas em aberto, modelo de sistema)
2. [x] Confirmar o número atual com consultas SÓ de leitura (nomes tirados da nota do esquema e da migration 39 — E-36/E-46)
3. [x] Levar ao dono, em português de gente, se o painel deve contar só o que o quadro do PCP mostra → **sim** (+ "mais antiga" e reposição — ver respostas)
4. [x] Migration nova recriando `plt_fn_dash_pcp_dia` a partir da versão mais nova (a da 39 — E-24), com o filtro do quadro do PCP
5. [x] Bloco novo no harness + `npm run test:banco` (duas rodadas) verde — 517
6. [x] Conferir "recriada da versão mais nova": diff do corpo 39 × 41 = só as trocas pretendidas
7. [x] Medir no servidor a consulta nova × a antiga (EXPLAIN ANALYZE só de leitura — E-65; sem ensaio com DDL — E-66)
8. [x] Aplicar SÓ com o "pode" do dono: `--so` + `set local lock_timeout = '5s'` (E-66); impressão digital da integração antes = depois
9. [x] Depois de aplicar: painel × quadro no banco real (mesmas portas das telas — E-47) + advisors
10. [x] Cofre: D-75, esquema do banco, modelo de sistema (nota do quadro do PCP), memória de aprendizado (A-35, A-36, A-37), esta memória, índice de execução, handoff, mapa, próximos passos
11. [x] Revisão do dono → merge na `main` (D-20) — *"Pode juntar"* (29/09)

## Leitura no banco real — 28/09 ~23:34 (Natal), só leitura

- **Migration 39 viva:** `plt_privado.vw_itens_producao` existe; `plt_fn_dash_pcp_dia` e `plt_fn_cards_pedido_pcp` já somam da view; o corpo vivo de `plt_fn_dash_pcp_dia` = o da migration 39 (seção 11), md5 `fa716014…`.
- **Painel "a liberar" = 233** — por situação no Tiny: **Entregue 200 · Preparando envio 33**.
- **Quadro do PCP = 33** (33 pedidos, 0 reposição). Aplicado ao painel o filtro de situação do quadro → **33**, e os conjuntos são **idênticos** (0 no painel fora do quadro, 0 no quadro fora do painel).
- **"Mais antiga"** do quadrinho: olha os 250 cards de pedido vivos no PCP (inclusive 14 já liberados por inteiro e os entregues no Tiny) → **31 dias**; só os cards do quadro → **27 dias**. Nenhum card de pedido fora do PCP (0).
- **"Liberadas hoje" = 12**: 7 `entrada_manual` + 1 `contagem` (cadastro direto no ESTOQUE pela logística — card de unidade SEM card pai) e 4 liberações do PCP (3 com destino PCP + 1 alocada direto em Pedidos em aguardo — todas com card pai de pedido).

## Respostas do dono (28/09 — o OK)

- **"A liberar" igual ao quadro do PCP** → *"Sim, igual ao quadro"* (233 → 33 hoje).
- **No mesmo quadrinho:** escolheu **só "Mais antiga"** (passa a olhar só o que o quadro mostra). **"Liberadas hoje" NÃO foi escolhida** — fica como está (segue somando o cadastro direto no estoque); não perguntar de novo, só registrar.
- **Reposição:** *"Sim, conta junto"* — o "a liberar" conta também os cards de reposição, como o quadro já mostra (hoje 0).

**→ D-75:** o quadrinho do PCP da Visão do dia conta o que o quadro do PCP mostra — "a liberar" = os cards do quadro (pedidos vivos no Tiny com peça por liberar + cards de reposição) e "mais antiga" = o mais antigo deles; "liberadas hoje" fica como está.

## Decisões técnicas

- **Mesma regra do quadro, copiada e AMARRADA por teste:** o corpo novo usa exatamente o filtro de `plt_fn_cards_pedido_pcp` (39, seção 6) — setor de entrada, `pedido`/`reposicao`, não arquivado, `liberado_completo_em is null`, pedido não encerrado no Tiny (`fn_situacao_normalizada` not in entregue/não entregue/cancelado) e com unidade de produção (`vw_itens_producao`) — sem o gate por pessoa do quadro (o painel mantém o dele, `fn_setores_dashboard`). O harness passa a exigir painel = quadro (contagem e mais antiga); quem mudar um sem o outro fica vermelho. Não virou regra única compartilhada de propósito: o prompt limita a troca a uma porta e mexer no quadro seria risco sem ganho hoje (anotado no handoff).
- **Nome da coluna fica `pedidos_a_liberar`** (mesma forma de retorno → `create or replace` basta, sem mudança no front); o comentário diz que ela conta os cards do quadro, reposição incluída.
- **`unidades_liberadas_dia` intocada** (resposta do dono).

## Diário

- 28/09 ~23:30 — sessão aberta na worktree do app (3e15c5c). Leituras obrigatórias. A 39 do Frete estava aplicada no banco mas fora da `main`; a sessão do Frete avisou por mensagem que mesclou (943ce63) → `git fetch` (credencial do `gh`) + `merge --ff-only`; branch criada daí.
- `npm ci` na worktree (nasce sem `node_modules`) — 373 pacotes.
- `npm run test:banco` na `main` nova, ANTES de qualquer mudança: **TUDO VERDE, 510 verificações** (a referência de antes).
- Avisos de numeração por mensagem à sessão do Frete e à do estoque (A-33). As duas confirmaram: sem colisão. O Frete lembrou de manter a soma de unidades INLINE da view (nunca `fn_unidades_do_pedido` numa porta que varre — E-65) e apontou os dois testes antigos que o ajuste toca (o do tile na S16 e o do pedido só de frete na D-63). A `main` andou para **34dde06** (só docs do Frete) → `merge --ff-only` de novo.
- **Migration 41** escrita: `supabase/migrations/20260928210000_plt_painel_pcp_como_o_quadro.sql` — abre com `set local lock_timeout = '5s'`; CTE `quadro` = o filtro do quadro (sem o gate por pessoa); `pedidos_a_liberar` = `count(*) from quadro`; `espera_mais_antiga` = `max(now() - desde) from quadro`; `unidades_liberadas_dia` intocada; comentário da função atualizado; revoke/grant reafirmados.
- **Harness:** (a) o teste do tile na S16 ("bate com a conta manual") comparava com a regra ANTIGA escrita à mão → passou a comparar com a porta do quadro (`contagem_total` de `plt_fn_cards_pedido_pcp` — E-47); (b) bloco novo **"D-75"** no fim (pedidos 924301–924305, produto 924390), 7 verificações: antes dos casos o painel já é o quadro (com o 999993 da S23 — "Entregue" com 1 de 2 liberadas — no banco); "Preparando envio" e reposição entram, "Entregue"/"Não entregue"/"Cancelado"/só frete não; +2 no painel = o quadro; "mais antiga" = a do quadro (o entregue mais velho não conta — `desde` forçado a 3000 × 2000 dias); liberado por inteiro sai; "liberadas hoje" = a regra de sempre (mesmo "agora", à prova de meia-noite); "Não produzir" na reposição sai. Painel e quadro lidos NA MESMA consulta (mesmo `now()`, espera comparada ao segundo).
- `npm run test:banco`: **TUDO VERDE, 517** (510 + 7); a 41 roda nas duas rodadas.
- **Teste de mutação** (a 41 tirada da pasta, cópia no rascunho, restaurada com `cmp` idêntico): **5 vermelhos** no bloco D-75 (512 ✔ + 5 ✘) — o teste pega a regra antiga. Curioso: na 1ª conferência os números coincidiram (5 = 5: o antigo contava o 999993 entregue, o quadro contava uma reposição da S25) — só a "mais antiga" denunciou (3 s × 1 s). Coincidência de total esconde conjunto diferente: por isso o bloco confere também QUEM está no quadro.
- **Recriada da versão mais nova (E-24):** diff do corpo 39 × 41 = só a CTE `quadro` nova e as duas colunas; `dia`, `pcp`, `unidades_liberadas_dia` e o gate final idênticos. Filtro da CTE × `plt_fn_cards_pedido_pcp` (39, seção 6): idêntico, menos o gate por pessoa.
- **Medição no servidor, só leitura** (EXPLAIN ANALYZE do corpo como SELECT puro — sem DDL, sem ensaio: E-66): antigo **~5,5 ms** (1ª execução fria 133 ms) → novo **~3,4 ms**; planejamento ~3,5 ms nos dois. O quadro usa `plt_cards_arquivado_idx` (236 cards no PCP) e a view só para os 33 vivos.
- Commit `ff0c23a` (migration + harness + esta memória), autor `contatodomoby`.
- `.env.local` copiado da pasta principal SEM exibir (a worktree nasce sem ele); `npm run banco:aplicar -- --so <41>` sem `--confirmar` = ensaio do aplicador (só leitura): integração `e2109f3a…` (65 colunas), plano = SÓ a 41.
- Prévia ao dono (23:51): "a liberar" 233 → 33; "mais antiga" 31 → 27 dias; liberadas hoje igual; reposição 0 hoje. **Dono: "Pode aplicar".**
- Antes de aplicar: aviso às sessões do Frete e do estoque (E-66 — "como se fosse aplicação"; as duas responderam: nada rodando no banco); `pg_stat_activity` sem transação aberta há mais de 2 s.
- **Aplicada em 28/09 ~23:53 (Natal)**: `npm run banco:aplicar -- --confirmar --so 20260928210000_plt_painel_pcp_como_o_quadro.sql` → ✔; integração do Tiny **estrutura idêntica e linhas idênticas** (clientes 10.706 · pedidos 5.421 · pedido_itens 8.118 · eventos 8.523 · gp 1); 24 tabelas · 3 visões · 46 políticas · 10 setores · 46 etapas.
- **Depois de aplicar, no banco real, pelas portas das telas (E-47)** — bloco `do $$ … raise exception` (A-11: nada gravado; `set_config` local com o login de um admin ativo, sem exibir): **painel 33 = quadro 33**; **mais antiga 27 dias 07:42 = a do quadro** (iguais = verdadeiro); liberadas hoje 12 (igual); corpo vivo = o novo (md5 `62770e80…`, antes `fa716014…`).
- **Advisors:** segurança e desempenho sem nada novo (a porta já constava entre as DEFINER de propósito; o índice duplicado de `plt_cards` é antigo, de outra sessão).
- Conferência de uma frase do handoff antes de afirmar (E-47): o "Pedidos completos aguardando lançamento" do painel e a aba Pedidos em aguardo não olham a situação no Tiny (mesma regra nas duas) — só leitura: hoje os dois dão **0**. Escrito assim no handoff (não "bate", que eu não tinha medido).
- **Cofre:** D-75 (Decisões) · Esquema do Banco (parágrafo da migration 41 + ↪️ na linha do painel da S16 + a linha em branco que faltava entre os parágrafos do Frete e do estoque — dois parágrafos grudados viravam um só no Obsidian) · Modelo de Sistema (↪️ no "Quadro do PCP sem encerrados no Tiny" + o padrão "painel sai da porta da tela") · Memória de Aprendizado (A-35, A-36, A-37 — nenhum erro novo nesta sessão) · índice de Execução · handoff `handoff_2026_09_28_ajuste_painel_pcp_como_o_quadro` · Mapa (↳ sob a S16) · Próximos Passos (item 14 ✅). `supabase-fabrica-schema.sql` não muda (só porta de plataforma — as `plt_` vivem nas migrations).

- 29/09 — revisão na conversa (resumo em português + como conferir na tela); **dono: "Pode juntar"**. Envio para a `main` pela própria branch (`push origin <branch>:main`, avanço direto, credencial do `gh` — a `main` local é da pasta principal, que não se toca), depois de refazer o fetch e conferir `0 N` e o autor `contatodomoby` (E-33).

## Conferência da task list contra a demanda (regra 7)

- Demanda 1 (confirmar o número só com leitura, nomes tirados da nota/migration) → ✅ 233 = 200 Entregue + 33 Preparando envio; quadro 33.
- Demanda 2 (levar ao dono em português de gente) → ✅ três perguntas, sem códigos; respostas registradas acima.
- Demanda 3 (migration nova a partir da versão mais nova, filtro do quadro, harness 2 rodadas, aplicada só com aprovação, `--so`, `lock_timeout` curto) → ✅ todos os itens.
- "Registre na memória de execução e no handoff" → ✅.
- Fora do escopo, não feito de propósito: "liberadas hoje" (o dono não escolheu); regra única compartilhada entre painel e quadro (anotada como alternativa descartada na D-75).
