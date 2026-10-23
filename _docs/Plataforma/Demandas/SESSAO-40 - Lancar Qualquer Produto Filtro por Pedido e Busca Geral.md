---
titulo: SESSAO-40 — Lançar qualquer produto para produção, filtro por pedido nos quadros e a busca geral de cards
tipo: demanda
status: ✅ entregue e no ar (23/10/2026) — handoff_2026_10_23_sessao40_lancar_filtro_busca
data: 2026-10-23
atualizado: 2026-10-23
tags: [plataforma, demandas, estoque, kanban, pcp, busca, rastreabilidade]
---

# SESSAO-40 — Lançar qualquer produto, filtro por pedido e a busca geral (23/10/2026)

> Ditada pelo dono na conversa em 23/10/2026, de madrugada, com um vídeo de referência, para rodar como **sessão noturna sem perguntas** ("apenas realize os ajustes sem me perguntar nada, pois eu não estarei acordado"). O dono autorizou na mesma mensagem: testar no navegador logado por ele (mexer, filtrar, e depois apagar o rastro), **aplicar em produção e subir para a main**. Escolhas sensatas registradas como decisões provisórias (D-186…).

## O pedido do dono (texto fiel)

> * Na parte de estoque, coloque um botao para lançar para produção mesmo estando com o estoque mínimo ja suprido, coloque para lançar qualquer produto a qualquer momento, pode ser da mesma maneira do icone vermelho
> * Analise o video em anexo e realize as duas implementações tambem dentro do sistema

## O vídeo de referência

`Downloads/WhatsApp Video 2026-10-22 at 19.05.45.mp4` (54 s, celular filmando o monitor; quadros a cada 2 s + a fala transcrita por um modelo de fala local — `faster-whisper`, no scratchpad). É o **Trello** da equipe (quadro "9 - LOGISTICA": A FAZER · PRIORIDADE MÁXIMA · LIMPANDO/EMBALANDO · ESTOQUE · EXPEDIÇÃO · ENTREGUE) e, no meio, a tela LIMPEZA E EMBALAGEM da plataforma. O dono mostra duas ferramentas do Trello:

1. **O filtro do quadro** ("Filtrar cartões" → palavra-chave): digitando o pedido **13722**, cada coluna mostra só os cartões que batem e diz quantos ("1 cartão corresponde aos filtros" em A FAZER, "3 cartões…" em EXPEDIÇÃO, "0" no resto). Na fala: *"isso facilitaria muito aqui dentro da limpeza e embalagem — em todos os setores você pode colocar isso, esse filtro"*.
2. **A pesquisa geral** (a lupa "Pesquisar" no topo): digitando **13721**, ela acha os cartões em **todos os quadros** e diz onde cada um está ("9 - LOGISTICA: ENTREGUE", "0 - ESTOQUE: MÓVEIS MONTADOS"). Na fala: *"se tivesse também aqui, facilitaria muito para a rastreabilidade dos cards"*.

## As frentes (uma sessão só, na pasta principal)

| Frente | O quê |
|---|---|
| F1 — Estoque | O botão de lançar para produção em **todo** móvel, a qualquer momento (mesmo no mínimo, fora do Top X, com a automática ligada e com uma reposição já esperando no PCP) |
| F2 — Filtro do quadro | Campo de filtro (nº do pedido ou nome do móvel) no quadro de todo setor de produção, no tablet e no PCP — filtrado no servidor, com a contagem por coluna |
| F3 — Busca geral | A lupa ao lado do sino (e Ctrl+K): acha os cards em todos os setores pelo nº do pedido ou nome e diz onde cada um está; tocar abre a janela do card; "abrir o quadro" já filtrado |

## Tarefas no ClickUp (lista PRODUÇÃO do DPTO TI)

Estoque - Lançar qualquer produto (17tya50k7kr) · Kanban - Filtro por pedido (17tya50k7kt) · Busca geral de cards (17tya50k7ku) — criadas pelo Claude em FAZENDO (como nas baterias noturnas 38 e 39); o dono conclui.

## Numeração reservada

D-186…D-195 · E-156…E-165 · A-111…A-118 · migrations `20261024xxxxxx` · faixa de ids de teste da bateria `...4001–4049` (acima das reservas da SESSAO-39, que já foi entregue — evita colisão com sessões paradas na pasta).

## Fora do escopo

Filtro por membro/etiqueta/data (o vídeo usa só a palavra-chave); busca dentro de conversa, anexo ou cliente; mexer no Trello; nada no n8n; nada no Tiny.

## Critérios de aceite

- [x] F1 — Todo móvel da aba dos acabados tem o ícone de lançar (vermelho pulando quando falta peça e a automática está desligada, como hoje; discreto no resto); o lançamento aceita 1–500 e nasce no PCP com autor e trilha, mesmo com o mínimo coberto e com outra reposição do mesmo produto aberta; clique duplo não cria duas.
- [x] F2 — O quadro de cada setor de produção, o tablet e o PCP filtram pelo número do pedido (começa com) ou pelo nome do móvel (contém, sem acento e sem maiúscula); cada coluna mostra o total que bate; "Ver mais" respeita o filtro; ao vivo continua; o filtro vive no endereço (`?filtro=`).
- [x] F3 — A busca geral acha pelo nº do pedido (começa com) e pelo nome, em todos os setores, só o que a pessoa pode ver; cada resultado diz onde está; tocar abre a janela do card; "Ver mais" por cursor; uma requisição por busca (espera 300 ms, mínimo 2 caracteres).
- [x] Lei de desempenho: as portas novas/tocadas medidas no ×100 dentro do teto; nenhuma requisição nova na abertura; nada de relógio nem `postgres_changes`.
- [x] Banco e site no ar juntos (com o OK do dono, dado na própria mensagem); handoff com o roteiro de teste de cada ajuste.
