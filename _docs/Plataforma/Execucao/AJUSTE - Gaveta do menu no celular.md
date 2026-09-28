---
titulo: Execução — Ajuste · Gaveta do menu no celular (faixa da barra 2 com a gaveta fechada)
tipo: execucao
data: 2026-09-28
atualizado: 2026-09-28
tags: [execucao, ajuste, navegacao, gaveta, celular, layout]
---

# 🔧 Execução — Ajuste · Gaveta do menu no celular

**Origem:** achado fora do escopo da F-07 da SESSAO-24 (27/09, 375px) — [[handoff_2026_09_27_sessao24_producao_concluida]] §4. Não foi introduzido pela S24: já existia na `main`.
**Pedido do dono (28/09):** a gaveta fechada tem que ficar 100% fora da tela em qualquer largura, sem quebrar a gaveta aberta (as duas barras precisam caber/rolar no celular) nem o computador (`lg:sticky`); conferir no navegador em 375 e 768; registrar no Modelo de Sistema e na memória de aprendizado.
**Branch:** `ajuste-gaveta-menu-celular` — criada da `main` em 98c17b5 (= `origin/main`), na worktree `.claude/worktrees/suspicious-lederberg-5645e1`; **rebaseada sobre `origin/main` fcf1af1** (SESSAO-26 mesclada) no meio do caminho.
**Sem banco:** nenhuma consulta, nenhuma migration.

## Task list (espelha o pedido)

1. [x] Ritual: CLAUDE.md, memória de aprendizado, decisões (D-01…D-62), modelo de sistema, ordem das sessões, handoff da S24, perguntas em aberto, visão, requisitos, mapa. (Esquema do banco fora: não há SQL.)
2. [x] Reproduzir e medir o defeito em 375px.
3. [x] Achar a causa.
4. [x] Levar entendimento + decisões ao dono e ter o OK → **"Conter + invisível"** (28/09).
5. [x] Corrigir: gaveta fechada 100% fora da tela, em qualquer largura e com qualquer nome de usuário.
6. [x] Gaveta aberta: as duas barras cabem ou rolam no celular.
7. [x] Computador (`lg`) intacto.
8. [x] Navegador em 375 e 768 (tela real, dono logado): nenhum ponto da borda esquerda do conteúdo cai em link do menu com a gaveta fechada; abrir e fechar a gaveta.
9. [x] `tsc` · `lint` · `test` · `build` (antes e depois de trazer a S26).
10. [x] Modelo de Sistema — navegação em duas barras (SESSAO-13).
11. [x] Memória de aprendizado — E-48 (+ ↪️ F-07).
12. [x] Handoff + mapa + índice de execução; marcar o achado da S24 como resolvido.
13. [x] Revisão do dono → merge na `main` só com o OK (D-20). → OK do dono ("Pode juntar e publicar", 28/09).
14. [x] **E-57 (achado da SESSAO-26, com o OK do dono — "Apagar junto")**: com o menu aberto, o balão do chat e a bolinha de execução ficam sob o fundo escuro.

## Ambiente

- Worktree sem `node_modules`/`.env.local`: `.env.local` copiado da pasta principal **sem exibir** (36 linhas) e `npm ci` (373 pacotes, 30 s).
- Preview `plataforma` (5173) sobe desta worktree — conferido na linha de comando do processo (`…\suspicious-lederberg-5645e1\node_modules\.bin\..\vite\bin\vite.js`). A SESSAO-26 roda em paralelo na 5175 (outra pasta).
- Sem o dono logado, a medição foi numa **réplica fiel da gaveta** (mesmo HTML/classes do `Layout.tsx`, injetada por JS na tela de login com viewport emulado em 375×812 — nada no código).

## Diagnóstico (28/09)

- **Reproduzido na réplica:** aside `x=-345 w=345`; barra 1 `w=240`; barra 2 encolheu para `w=150` e vai até **+45px**; `elementFromPoint` em x = 1…44 cai em PCP/FITAMENTO/Expedição/"Controle de Produção" — o toque vai para o menu.
- **Causa:** a gaveta tem teto `max-w-[92vw]` (345px no 375), mas as duas barras juntas não ficam menores que **~382–390px** — os itens flex encolhem só até o mínimo do conteúdo: a barra 1 para em `min(240, 180 + largura do nome)` (a linha do usuário: avatar + nome `truncate`, que não quebra, + Configurações + Sair; a matrícula quebra no hífen), a barra 2 para na palavra mais longa ("EMBALAGEM"/"Programação", 150px). O excedente transborda a caixa do aside, e o `-translate-x-full` desloca −100% da largura da CAIXA — o que transborda fica na tela, com `z-50` por cima do conteúdo.
- **Varia com o nome do usuário:** nome curto (o do dono) → barra 1 com 232 → sobra ~38px (a medida da F-07); nome longo → 240 → 45px. Some a partir de ~420–490px de largura; em 768 não acontece (as barras cabem inteiras: 448 < 706).
- **Origem:** o teto de 92vw nasceu na SESSAO-07, com UMA barra (240 < 92vw em qualquer celular); a SESSAO-13 pôs a segunda barra ao lado sem rever o teto.
- **Mesma família, outro caminho:** o painel do sino (`fixed left-3 w-80`) tem o **aside como bloco de contenção** — o `translate` do aside (Tailwind v4 usa a propriedade `translate`; `getComputedStyle(aside).translate = "0px"`, não `none`) cria bloco de contenção para descendentes `fixed`. Com o painel aberto e só a barra 1 (240px), fechar a gaveta (toque no fundo escuro) deixa o painel em `-228..92` — **92px na tela** (medido na réplica).

## Alternativas medidas na réplica (375px)

| Alternativa | Fechada | Aberta | Painel do sino |
|---|---|---|---|
| Hoje (92vw, sem envoltório) | ❌ 28 pontos da borda caem no menu | barra 2 desenhada até 390 (a tela corta 15px de respiro) | inteiro |
| `overflow-hidden` no próprio aside | ✅ | ❌ esconde o que passa de 345 | ❌ **cortado** (`elementFromPoint(300,120)` = página) |
| Envoltório rolável + teto 92vw | ✅ nenhum ponto | rola 45px — nomes da barra 2 cortados até rolar | inteiro |
| **Envoltório rolável + teto 100vw** | ✅ nenhum ponto | rola 15px; visual igual ao de hoje | inteiro |

- `min-w-0` na barra 2 (sugestão do pedido): ela iria a ~105–113px e cortaria "EMBALAGEM"/"Programação" (o nav rola sozinho no eixo x por ter `overflow-y-auto`) — descartada.

## Decisões (OK do dono: "Conter + invisível", 28/09)

1. **A gaveta contém as barras:** um envoltório `flex h-full overflow-x-auto lg:overflow-visible` dentro do aside. Quem desliza é o aside; quem rola é o envoltório. O overflow NUNCA vai no aside: por causa do `translate`, ele é o bloco de contenção do painel `fixed` do sino — o envoltório fica entre os dois e não corta o painel.
2. **Teto `max-w-[92vw]` → `max-w-[100vw]`:** com 92%, a barra 2 perderia ~45px para a rolagem; com 100%, a gaveta aberta fica como hoje (no 375 a barra 2 já cobre a faixa escura da direita). Fecha no X ou tocando num item.
3. **Fechada = invisível depois do deslize:** `invisible`/`visible` + `transition-[translate,visibility]` — `visibility` fica "visível" durante a transição e só vira `hidden` no fim, então o deslize de fechar continua aparecendo. Pega o painel do sino e tira os links escondidos do Tab. `lg:visible` no computador.

## Log

- 28/09 · ritual lido; branch `ajuste-gaveta-menu-celular` criada da `main` (98c17b5); ambiente preparado; defeito reproduzido e medido na réplica; alternativas medidas; proposta levada ao dono → OK "Conter + invisível".
- 28/09 · **código** (`Layout.tsx`, só o `<aside>`): envoltório `flex h-full overflow-x-auto lg:overflow-visible`; aside `max-w-[100vw] transition-[translate,visibility]`, `visible translate-x-0` × `invisible -translate-x-full`, `lg:visible`. `tsc` ✅ · `lint` ✅ · `test` 64/64 ✅ · `build` ✅. Classes conferidas no CSS final (A-07) — todas lá. Commit `cb2f17e`.
- 28/09 · **réplica com a marcação nova:** 375 fechada 0 pontos no menu (nome curto e longo), aberta rola 8/16px; painel do sino + gaveta fechando → `hidden`, 0 pontos (antes 92px); 768 e 1280 ok. ⚠️ Com o painel do navegador oculto, **transição não anda** (fica em `t=0`): a primeira sonda do sino deu "visível e parado" — não era defeito; a prova é `getAnimations().forEach(a => a.finish())` e medir o estado final (E-32 de novo; registrado na ↪️ F-07).
- 28/09 · cofre (modelo de sistema, E-48 + ↪️ F-07, esta memória, handoff, índices, achado da S24 ✅). Commit `ee427ca`. Merge simulado com a `sessao-26-chat-interno`: sem conflito.
- 28/09 · **avisos das outras frentes (SendMessage):** a sessão do "Frete fora da produção" (branch `ajuste-itens-fora-da-producao`, migration 39) renumerou os IDs dela para E-55/E-56/A-31 — o E-48 fica comigo; a SESSAO-26 foi mesclada (`origin/main` 3503d77 → fcf1af1) e pediu para rodar tudo de novo depois de trazer a `main` (o `Layout.tsx` ganhou `ProvedorChat`/`BalaoChat`), e registrou o **E-57** (balão do chat e bolinha de execução acesos por cima do fundo escuro da gaveta aberta no tablet) como pendente do dono, com o conserto natural no `Layout`.
- 28/09 · **rebase sobre `origin/main` fcf1af1** (os 2 commits locais, nunca enviados): limpo → `3b118a4` (código) + `ed4ecc1` (cofre). Ordem dos IDs na memória: E-47, **E-48**, E-50…E-58. `tsc` ✅ · `lint` ✅ · `test` **80/80** (a S26 trouxe testes) ✅ · `build` ✅. Sem dependência nova.
- 28/09 · **F-07 na tela real (dono logado; o login demorou: primeiro foi feito fora do painel embutido):**
  - 375, Meu painel, fechada: aside `-375..0`, `hidden`; **0 de 527** pontos (x 0–60) no menu; título em x=16; sem rolagem lateral.
  - 375, **Pedidos em aguardo** (a tela do relato; barra 2 = Fábrica, 13 itens), fechada: **0 de 527**; "Aqui fica a peça…" começa em x=16 e o toque no começo dele cai no próprio texto.
  - Prova por partes (transição desligada só na sonda): **original reconstituído** (teto 92vw, barras direto no aside, visível) → gaveta 345, barra 2 até **+38px**, **323 pontos no menu** — a medição do relato; só o envoltório (100vw ou 92vw) → 0; só o invisível → 0; restaurado → 0.
  - 375, aberta pelo ≡ (handler real): aside `0..375`, barra 1 `0..233`, barra 2 `233..383`, rola 8px; os 13 itens inteiros (texto mais à direita em x=359); toque em "LIMPEZA E EMBALAGEM" cai no link. Print ok. Fechada pelo X: durante o deslize `visible` (translate + visibility rodando), no fim `-375..0`, `hidden`, sem fundo escuro, 0 pontos.
  - 375, sino: gaveta só com a barra 1 (240) → painel `12..332` **inteiro** (passa da caixa e não é cortado — o envoltório não o corta); fechar pelo fundo escuro com o painel aberto → painel em `-228..92` mas `hidden`, 0 pontos. Preferência da barra 2 devolvida (a chave criada no teste foi removida).
  - 768: fechada `-448..0`, `hidden`, 0 de 589; aberta 240 + 208 sem rolagem, toque na faixa escura fecha. Print ok (mostra o E-57: balão e bolinha acesos por cima do escuro — medido: balão `z-40` recebe o toque).
  - 1280: `sticky`, visível, `translate 0`, envoltório `visible`, barras 240 + 208, conteúdo em 448, painel do sino inteiro. (Ao trocar a janela de 375 para 1280 as transições ficaram em `t=0` — painel oculto; terminadas, tudo certo.) Console sem erro.
- 28/09 · a `origin/main` andou de novo (96207bc: plano da integração completa com o Tiny da fábrica, **regra 12c do dono — na conversa, português de gente, sem código** — e material de `Claude outputs/`); nenhum arquivo de código mudou. **Segundo rebase:** conflito só na memória de aprendizado (o E-49 da regra nova entrou no mesmo lugar do meu E-48) → resolvido mantendo os dois, em ordem (E-47, E-48, E-49, E-50…). Branch 3 à frente, 0 atrás. Daqui em diante, mensagens ao dono sem ID, hash, branch, migration nem caminho de arquivo (as notas continuam com os códigos).
- 28/09 · **respostas do dono:** apagar as bolhas junto (E-57) e juntar e publicar.
- 28/09 · **E-57 — camadas:** a escala da casa é 30 (barra do celular) · 40 (fundo da gaveta, balão do chat, bolinha, fundos de painel e do Modal) · 50 (gaveta, painéis das bolhas, painel do sino, conteúdo do Modal, Selecao) · 60 (avisos). Subir só o fundo para 50 resolveria as bolhas, mas o **painel do chat** (`z-50`, depois da gaveta no DOM) ficaria por cima do menu aberto. → fundo e gaveta em **`z-[55]`** abaixo de `lg` (acima de 40/50, abaixo dos avisos 60) e **`lg:z-50`** no computador (lá a coluna precisa seguir abaixo das janelas). Nada abre janela a partir da gaveta, então 55 não esconde Modal. `tsc` ✅ · `lint` ✅ · `test` 80/80 ✅ · `build` ✅; `.z-\[55\]` e `.lg\:z-50` (no bloco de `64rem`) no CSS final. Commit "menu aberto no celular/tablet fica acima das bolhas".
- 28/09 · **E-57 na tela real:** 768 — menu fechado: balão e bolinha respondem; menu aberto: fundo e gaveta com z 55, o toque no centro do balão e da bolinha cai no fundo escuro (fecha o menu), o meio da barra 2 é do menu; print ok (bolhas apagadas). Painel do chat aberto (`353..737 × 432..1008`) + menu aberto: o ponto de sobreposição (420, 492) cai no MENU e o resto do chat no fundo escuro; chat e menu fechados de novo. 375 — fechada 0 pontos na borda; aberta, balão e bolinha por baixo do menu. 1280 — `z-index 50`, `sticky`, visível, balão funciona.
- 28/09 · **3 erros 500 no console** (vistos uma vez): registros do Supabase (só leitura) mostram que às 13:00:16Z a sessão do Frete aplicou a migration 39; a DDL segurou locks e três leituras do preview (`plt_vw_execucoes`, `plt_fn_pedidos_aguardo`, `plt_fn_aguardo_contagens`) esperaram e caíram por `statement timeout` (57014) às 13:00:26–27 → 500. Transitório e alheio a este ajuste (só CSS): recarregadas depois, Pedidos em aguardo (11 chamadas) e Meu painel (13) sem nenhuma falha. Sessão do Frete avisada.
