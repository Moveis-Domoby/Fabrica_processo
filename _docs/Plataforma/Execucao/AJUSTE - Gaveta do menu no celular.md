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
**Branch:** `ajuste-gaveta-menu-celular` — criada da `main` em 98c17b5 (= `origin/main`), na worktree `.claude/worktrees/suspicious-lederberg-5645e1`.
**Sem banco:** nenhuma consulta, nenhuma migration.

## Task list (espelha o pedido)

1. [x] Ritual: CLAUDE.md, memória de aprendizado, decisões (D-01…D-62), modelo de sistema, ordem das sessões, handoff da S24, perguntas em aberto, visão, requisitos, mapa. (Esquema do banco fora: não há SQL.)
2. [x] Reproduzir e medir o defeito em 375px.
3. [x] Achar a causa.
4. [x] Levar entendimento + decisões ao dono e ter o OK → **"Conter + invisível"** (28/09).
5. [ ] Corrigir: gaveta fechada 100% fora da tela, em qualquer largura e com qualquer nome de usuário.
6. [ ] Gaveta aberta: as duas barras cabem ou rolam no celular.
7. [ ] Computador (`lg`) intacto.
8. [ ] Navegador em 375 e 768: nenhum ponto da borda esquerda do conteúdo cai em link do menu com a gaveta fechada; abrir e fechar a gaveta.
9. [ ] `tsc` · `lint` · `test` · `build`.
10. [ ] Modelo de Sistema — navegação em duas barras (SESSAO-13).
11. [ ] Memória de aprendizado — E-48.
12. [ ] Handoff + mapa + índice de execução; marcar o achado da S24 como resolvido.
13. [ ] Revisão do dono → merge na `main` só com o OK (D-20).

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
