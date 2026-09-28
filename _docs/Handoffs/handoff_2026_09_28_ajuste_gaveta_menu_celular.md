---
titulo: Handoff — Ajuste · Gaveta do menu no celular (a faixa da barra 2 com a gaveta fechada)
tipo: handoff
data: 2026-09-28
atualizado: 2026-09-28
tags: [handoff, ajuste, navegacao, gaveta, celular, layout, e-48]
---

# 📋 Handoff — Ajuste · Gaveta do menu no celular

**Branch:** `ajuste-gaveta-menu-celular` (criada da `main` em 98c17b5) — **aguardando a sua revisão para ir à `main`** (D-20).
**Origem:** achado fora do escopo da F-07 da SESSAO-24 ([[handoff_2026_09_27_sessao24_producao_concluida]] §4) — já existia na `main`; nasceu na SESSAO-13.
**Memória:** [[AJUSTE - Gaveta do menu no celular]] · **Aprendizado:** E-48 (+ ↪️ na F-07)
**Banco:** nada — nenhuma consulta, nenhuma migration.

## 1. Objetivo

No celular (375px), com o menu **fechado**, uma faixa de ~38px da segunda barra ficava por cima da borda esquerda da página: letras cortadas à esquerda, o texto da página começando cortado ("ui fica a peça…") e **o toque indo para o menu** em vez da página. Pedido: a gaveta fechada tem que sair **inteira** da tela em qualquer largura, sem quebrar a gaveta aberta (as duas barras cabem ou rolam) nem o computador.

## 2. O que foi feito

### A causa
A gaveta tinha um teto de **92% da tela** (345px num celular de 375). As duas barras juntas não ficam menores que **~382–390px**: a primeira para no tamanho da linha do usuário (o nome não quebra) e a segunda na palavra mais longa ("EMBALAGEM"). O que passava de 345px ficava **pendurado para fora da gaveta**, e fechar empurrava só a gaveta (a largura dela), não o pedaço pendurado. A sobra dependia do nome de quem está logado (~38px com o seu; 45px com um nome longo). O teto de 92% era de quando o menu tinha uma barra só (SESSAO-07); a segunda barra veio na SESSAO-13.

Mesmo defeito por outro caminho: se o **painel do sino** estivesse aberto quando a gaveta fechava, sobravam **92px** dele na tela.

### Front (`src/componentes/Layout.tsx`, só o trecho da gaveta)
- **A gaveta passa a conter as duas barras:** uma camada por dentro dela **rola para o lado** no celular quando as barras não cabem (no 375 são uns 8–16px). Fechada, ela sai inteira da tela, com qualquer nome e em qualquer largura.
- **Teto de 92% → 100% da tela:** a gaveta aberta fica como a de hoje (no 375 a segunda barra já cobria a faixa escura da direita). Fecha no X ou tocando num item.
- **Fechada = invisível** depois do deslize (o deslize de fechar continua aparecendo): nada dela pega toque nem entra no Tab — inclusive o painel do sino.
- **Computador (`lg`) igual:** coluna fixa, visível, sem rolagem.

## 3. Decisões tomadas (seu OK: "Conter + invisível")

| Decisão | Alternativa descartada | Por quê |
|---|---|---|
| Camada rolável **por dentro** da gaveta | `overflow-hidden` na própria gaveta | Testado: cortava o painel do sino (o deslize da gaveta faz dela o "chão" do painel) e esconderia parte da segunda barra (E-30) |
| Teto = a tela inteira (100%) | Manter 92% com a rolagem | Com 92%, a segunda barra perderia ~45px para a rolagem — nomes cortados até rolar |
| Gaveta fechada **invisível** | Só tirar da tela | Pega o painel do sino (desenhado fora da caixa da gaveta) e tira os links escondidos do Tab |
| Manter as duas barras com os nomes no celular | Barra 1 virar trilho de ícones no celular | Mudaria o visual do menu no celular; você escolheu manter |
| — | `min-w-0` na segunda barra | Ela iria a ~105px e cortaria "EMBALAGEM"/"Programação" |

## 4. Bugs e aprendizados

- **E-48** na [[PLT - Memoria de Aprendizado]]: o que sai da tela por deslize tem que **conter** o próprio conteúdo (o deslize move a caixa, não o que transborda); deslize num ancestral vira o "chão" de todo painel fixo de dentro (e corta junto); fechado = invisível, não só fora da tela.
- **F-07 ↪️:** a conferência de celular ganhou "com a gaveta FECHADA, a borda esquerda é da página" (`elementFromPoint` de x = 0 a ~60).

## 5. Arquivos alterados

```
src/componentes/Layout.tsx                                        (o <aside> da gaveta)
_docs/Plataforma/PLT - Modelo de Sistema.md                       (navegação em duas barras: ↪️ a gaveta contém as barras)
_docs/Plataforma/PLT - Memoria de Aprendizado.md                  (E-48 + ↪️ F-07)
_docs/Plataforma/Execucao/AJUSTE - Gaveta do menu no celular.md   (nova — memória de execução)
_docs/Plataforma/Execucao/000 - EXECUCAO (indice).md              (link)
_docs/Handoffs/handoff_2026_09_27_sessao24_producao_concluida.md  (achado marcado ✅)
_docs/Handoffs/handoff_2026_09_28_ajuste_gaveta_menu_celular.md   (este)
_docs/000 - MAPA DO PROJETO.md                                    (link)
```

## 6. Impacto nos números visíveis

Nenhum — só a casca da navegação no celular/tablet.

## 7. Notas do cofre atualizadas

- [[PLT - Modelo de Sistema]] — "Navegação em duas barras" (↪️ a gaveta contém as barras; nunca overflow no próprio aside)
- [[PLT - Memoria de Aprendizado]] — E-48, ↪️ F-07
- [[000 - EXECUCAO (indice)]] · [[000 - MAPA DO PROJETO]] · [[handoff_2026_09_27_sessao24_producao_concluida]] (achado ✅)

## 8. Ficou pendente

### Aguardando decisão sua
1. **Revisar e autorizar o merge na `main`** (D-20). ⚠️ A SESSAO-26 (chat) mexe no `Layout.tsx` em outros trechos (imports, filho "Chat", provedor e balão) — o merge dela depois deste não deve conflitar, mas ela precisa trazer a `main` nova antes de mesclar.

## 9. Como validar (passo a passo)

1. No celular (ou no navegador em modo celular, 375px), entre na plataforma com o menu **fechado**: a borda esquerda da página não tem mais a faixa escura com letras cortadas, e o texto começa inteiro ("Aqui fica a peça…").
2. Toque bem na beirada esquerda da página (em cima de um card ou de um texto): o toque vai para a página, não abre item do menu.
3. Abra o menu (≡): as duas barras aparecem lado a lado como antes; se a segunda barra estiver um pouco cortada na direita, arraste o menu para o lado — ele rola. Feche no X: some por inteiro.
4. Com o menu aberto e a segunda barra recolhida (o « ao lado do título dela), toque no sino da gaveta e depois no fundo escuro à direita para fechar: nada do painel fica na tela.
5. No computador: o menu lateral fica igual (as duas barras, recolher, o sino).

## 10. Verificação executada

| O quê | Resultado |
|---|---|
| `npx tsc -b` · `npm run lint` · `npm test` · `npm run build` | ✅ · ✅ · ✅ 64/64 · ✅ (o aviso de chunk grande já existia) |
| Classes novas no CSS final (A-07) | ✅ `max-w-[100vw]`, `transition-[translate,visibility]`, `invisible`/`visible`/`lg:visible`, `overflow-x-auto`/`lg:overflow-visible` |
| Réplica fiel da gaveta (mesmas classes), 375px, fechada | ✅ nenhum ponto de x = 0…60 cai no menu (antes: 28 de 28), com nome curto e longo; `visibility: hidden` |
| Réplica, 375px, aberta | ✅ barra 1 0..233 · barra 2 233..383 (nome curto) — rola 8px; nome longo rola 16px |
| Réplica, painel do sino aberto + gaveta fechando | ✅ antes sobravam 92px; agora `hidden`, nenhum ponto pega toque; durante o deslize segue visível |
| Réplica, 768px | ✅ fechada: nada na tela; aberta: 240 + 208, sem rolagem, faixa escura de 320px |
| Réplica, computador (1280px) | ✅ `sticky`, visível, sem rolagem, painel do sino inteiro |
| **Tela real, logado (375 e 768)** | ⏳ aguardando o seu login no painel do navegador |
