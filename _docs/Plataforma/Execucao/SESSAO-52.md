---
titulo: "Diário — SESSAO-52 · datas e textos certos na busca, na devolução, na lista de pedidos e na Auditoria"
tipo: execucao
data: 2026-11-18
tags: [execucao, sessao-52, pedidos, busca, devolucao, auditoria, entregas]
---

# Diário — SESSAO-52 (18/11/2026, madrugada — mesa da fila do Escritório)

Demanda: [[SESSAO-52 - Datas e Textos Certos na Busca Devolucao Pedidos e Auditoria]] · ramo `sessao-52-datas-e-textos-certos` (worktree própria em `.escritorio/frentes/domoby/`, nascida da main `78e8829`; a pasta principal do dono não foi tocada). Sem o dono na conversa: o entendimento, as dúvidas e as decisões ficam aqui, no handoff e no reporte da fila.

## Partida (~04:00)

- `git status` limpo; o ramo em dia com `origin/main` (`0 0`).
- **Leitura:** CLAUDE.md da mesa; o pedido (duas vezes); o handoff da SESSAO-47 (os achados, item 6 das pendências) e a demanda/diário da SESSAO-51; Decisões de Produto, Perguntas em Aberto, Memória de Aprendizado e Lei de Desempenho **inteiras, por leitura delegada** (dois leitores devolveram as decisões, as lições e o checklist que tocam este trabalho, com o número da linha); no código, o último `create` de cada função tocada.
- **Regras desta leva que mudam o ciclo:** as notas grandes (Decisões, Memória, Esquema do Banco, Lei, Mapa, Ordem das Sessões, Próximos Passos) **não são editadas** — o que iria para elas está nas seções "Para entrar nas notas depois da dieta", aqui e no handoff. A demanda **não** foi linkada na Ordem das Sessões. **ClickUp: não mexi** (regra do modo fila, que vale por cima do pedido).
- **Numeração:** como as outras mesas (53–55, 34, 49) numeram ao mesmo tempo e as notas não são tocadas, as decisões e lições daqui levam rótulo provisório (**P52-n**, **L52-n**) — viram D-NN/E-NN/A-NN quando entrarem nas notas. Migration: `20261118100000` (a faixa da mesa).

## Entendimento (o que seria levado ao dono)

Quatro defeitos, todos de leitura — nenhuma regra nova:
1. A busca geral dizia "Entregue em dd/mm" pelo dia do **arquivamento** da peça (o dia do registro). A data que vale é a do card do pedido (`plt_cards.entrega_em` — D-276).
2. O detalhe da devolução lia `ocorrido_em` do fato `pedido_entregue` — que nunca muda; a correção do admin é outro fato (`entrega_dia_corrigido`). Mostrava o dia antigo.
3. A lista de pedidos recebia só `entregue_em`; com o dia escolhido, a hora é a do fim do expediente (D-278) e a tela a mostrava como se fosse a da entrega (a limitação registrada na D-283 item 5).
4. A Auditoria mostrava `antes`/`depois` da configuração do painel de tempos como JSON cru (`{"grafico_tv":"empilhadas"}` — a limitação registrada na D-289 item 10).

**Dúvidas de negócio:** nenhuma que bloqueie. As escolhas de texto viraram decisões provisórias (abaixo).

## Task list (espelha a demanda)

- [x] 0 · Gravar a demanda no cofre (sem linkar na Ordem das Sessões)
- [x] 1 · Busca geral: "Entregue em" pelo dia real — banco (chave `entregue_em`) + tela + testes
- [x] 2 · Detalhe da devolução: o dia vigente — banco (`quando` + `registrado_em`) + tela + testes
- [x] 3 · Lista de pedidos: só o dia quando escolhido/corrigido, com a hora real do registro — banco (porta `plt_fn_pedidos_pagina`) + tela + testes
- [x] 4 · Auditoria: antes/depois da configuração do painel em português — tela + testes
- [x] Critério: cada ponto com teste da data única (bateria: 20 conferências; telas: 15 testes novos)
- [x] Critério: nenhuma leitura a mais (contado na vitrine: a lista segue com 1 chamada de dados)
- [x] Critério: 375 e 768 sem rolagem lateral (medido nas 4 telas)
- [x] Lint, build, testes; ensaio ×100; diário, handoff, reporte

## Decisões técnicas e provisórias

- **P52-1 · A lista de pedidos ganhou uma porta nova em vez de uma coluna.** `plt_fn_pedidos_lista` devolve uma tabela fixa; cinco migrations (`20261027040000`, `20261109030000`, `20261111010000`, `20261112020000`, `20261116020000`) a recriam com `create or replace` sem derrubar, e a bateria as reaplica no meio (10 pontos). Ganhar coluna quebraria todas essas reaplicações ("cannot change return type") — a mesma razão das D-324/D-328. Em vez de mexer em 5 migrations antigas, criei **`plt_fn_pedidos_pagina`** (mesmos parâmetros): chama a lista de sempre e devolve as mesmas linhas em jsonb, cada uma com `entrega_registrada_em` (subconsulta por chave primária). A lista antiga fica intocada — o site publicado segue funcionando com o banco novo; a tela nova chama a porta nova (uma requisição, como antes). *Alternativa descartada:* mostrar só o dia em todas as linhas (sem banco) — contraria a D-134 ("o dia e a hora em que foi dado como entregue").
- **P52-2 · Quando a hora da entrega vale** (`src/pedidos/horaDaEntrega.ts`): só quando o instante da entrega é o do próprio registro (até 1 minuto de folga). Dia escolhido **ou corrigido** — inclusive corrigido para o mesmo dia do registro — mostra só o dia. Sem a hora do registro (banco de antes), a linha de sempre. ↩️ revisa a D-283 item 5.
- **P52-3 · O texto da lista:** "Entregue no dia 06/11/2026 por Fulano · registrado em 09/11 às 10:32" (o "registrado em" em tom mais suave). Entrega do próprio registro: "Entregue 08/11/2026 às 15:32 por Fulano", como era.
- **P52-4 · O texto do histórico da devolução:** a linha da entrega com o dia escolhido/corrigido mostra só "dd/mm" (as outras linhas seguem "dd/mm, hh:mm"). A ordem do histórico não mudou (pelo instante em que aconteceu).
- **P52-5 · A busca:** a peça (e o card do pedido) arquivada como entregue lê a data única do card do pedido quando a entrega com que saiu é a vigente; quando não é (a entrega em parte que deixou o resto na fábrica, a desfeita), lê o fato dela com a última correção. Fato de arquivamento sem a entrega anotada (não deve existir — o fechar do pedido anota desde a primeira versão) → a tela cai no dia do arquivamento, como antes.
- **P52-6 · A Auditoria traduz na leitura** (D-107 — a trilha não se reescreve): reconhece o registro pelo formato do contexto (`o_que_mudou` + `antes`/`depois` só com chaves do painel) e escreve "Rótulo: valor; …" com as mesmas palavras das frases do banco. O setor de abertura (que no antes/depois é um número) sai da frase que o banco escreveu ("Setor em que a tela abre: X → Y"); sem a frase, "um setor escolhido". ↩️ revisa a D-289 item 10.
- **Fora do escopo, deixado como está:** a ficha do pedido (`quandoFoiEntregue` segue a regra "dia diferente do registro"); a Auditoria continua mostrando como JSON cru o antes/depois **de outros registros** que guardem objetos.

## O que foi feito (arquivos)

**Banco** — `supabase/migrations/20261118100000_plt_datas_e_textos_certos.sql` (só leitura; **não aplicada**), gerada por extração (programa no rascunho: último `create` de cada função em migration de nome menor, trocas exatas e contadas):
- `plt_fn_busca_cards` (da `20261111010000`): 3 trocas — o fato do arquivamento devolve também `entrega_evento_id` (conversão só quando casa — E-106); junção lateral nova `d` (o dia real); chave `entregue_em` só quando há (E-237).
- `plt_fn_devolucao_detalhe` (da `20261027040000`): 2 trocas — `quando` da entrega = a data do card (vigente) ou a última correção do fato, senão `ocorrido_em`; `registrado_em` só na linha da entrega.
- `plt_fn_pedidos_pagina(text, integer, integer, boolean)` — nova, `stable security definer`, `revoke` de `public, anon`, `grant` a `authenticated`.

**Telas**
- `src/busca/api.ts` (+ `entregue_em`), `src/busca/ondeEsta.ts` ("Entregue em" pelo dia real).
- `src/pedidos/horaDaEntrega.ts` (novo — a regra da hora, pura), `src/pedidos/api.ts` (chama `plt_fn_pedidos_pagina`; + `entrega_registrada_em`), `src/pedidos/PaginaPedidos.tsx` (a linha).
- `src/logistica/devolucao.ts` (tipo), `src/logistica/componentes/ModalDecidirDevolucao.tsx` (a linha da entrega).
- `src/auditoria/rotulos.ts` (a tradução do painel de tempos).

**Testes**
- Bateria (`supabase/testes/testar-migrations.mjs`): bloco **SESSAO-52**, 20 conferências, faixa própria — **pedidos 99561–99564** (reservada 99561–99569), **SKU SX52**, **produto do Tiny 1952201**, nomes "Aparador Teste 52"; usuários os de sempre (`E40`). A migration entrou na cadeia de reaplicação (E-81).
- Telas: `src/pedidos/horaDaEntrega.test.ts` (novo, 10), `src/pedidos/PaginaPedidos.test.tsx` (+1), `src/busca/ondeEsta.test.ts` (+1), `src/auditoria/rotulos.test.ts` (+3).

## Verificação

- **Bateria do banco:** antes da sessão 1.872 ✔ / 2 ✘; depois **1.892 ✔ / 2 ✘** — os mesmos dois de sempre: o painel de vendas ("as 7 portas novas = as antigas", A-134) e o fluxo do n8n da SESSAO-33, que fica vermelho de madrugada (E-163 — as duas rodadas foram entre 04:17 e 04:35). A migration nova aparece nas duas rodadas. *(A rodada final, depois da troca da junção por subconsulta na porta da lista, está registrada no fim deste diário.)*
- **Teste de mutação: não rodei** uma bateria sem a migration; o que garante que o bloco prova a mudança é que, sem ela, `plt_fn_pedidos_pagina` não existe e as chaves `entregue_em`/`registrado_em` não nascem.
- **Tipos e lint:** limpos (`tsc -b`, `eslint .`).
- **Testes de tela:** os 15 arquivos das áreas tocadas (128 testes) verdes. A suíte inteira (114 arquivos, 734 testes) rodou três vezes com a máquina dividida com as outras mesas: 6, 3 e 2 falhas, **diferentes a cada rodada**, todas de tempo esgotado e **nenhuma em arquivo tocado**; os arquivos que falharam passam sozinhos (3 arquivos, 9 testes, 5,6 s). Não consegui uma rodada inteira verde nesta máquina carregada.
- **Build:** compila; **JS inicial 233,0 KB** comprimidos em 8 arquivos (teto 250). Pedaços tocados: Pedidos 3,68 KB, busca 3,72 KB, devolução 4,04 KB, Auditoria 7,79 KB (gzip).
- **Vitrine** (a tela de verdade com dados de exemplo; rede e websocket bloqueados; apagada antes do commit): as 4 telas em 375, 768 e 1440 — **sem rolagem lateral em nenhuma** (página = janela; a janela de cima dentro da tela). A lista de Pedidos fez **uma** chamada de dados (`plt_fn_pedidos_pagina`) + a dos setores, que já existia; a busca, uma; a devolução, uma. Fotos em `_docs/Handoffs/imagens/sessao52-*.png` (12).
- **Não conferido:** nada no banco vivo (sem acesso); a tela logada contra o banco de verdade; o md5 do corpo das duas funções recriadas contra o banco vivo (vai em "Para ligar com o dono").

## Ensaio ×100 (Lei §12)

Script e resultado em `Execucao/dados/SESSAO-52 - ensaio x100 das datas certas (…, 2026-11-18)`. Banco PGlite em disco: 562.700 pedidos, 91.569 cards, 61.425 eventos, 15.167 pedidos entregues (3.033 com o dia escolhido ou corrigido; 758 corrigidos), 45.500 peças que saíram com entrega. ANTES × DEPOIS alternados na mesma conexão, mediana da 2ª chamada em diante (9 chamadas — sem degrau na 6ª). A máquina estava dividida com outras mesas: os números absolutos estão inflados; vale a comparação.

| Porta | Antes | Depois |
|---|---|---|
| Busca · o número inteiro de um pedido entregue | 28,0 ms | 35,2 ms |
| Busca · número que começa com "12" (20) | 23,5 | 24,1 |
| Busca · número que começa com "12" (50, o teto) | 20,3 | 16,5 |
| Busca · número que começa com "153" (50) | 27,6 | 23,7 |
| Busca · nome "Estante Basic" (20) | 37,4 | 37,7 |
| Busca · nome "Torre Quente" (50) | 33,6 | 32,3 |
| Devolução · o detalhe de um pedido entregue e corrigido | 13,9 | 15,0 |
| Pedidos · a abertura (20) — lista × página nova | 183,6 | 185,9 |
| Pedidos · "Ver mais" (20) | 8,1 | 9,3 |
| Pedidos · o teto (100) | 204,3 | 220,7 |
| Pedidos · busca "12" | 11.420 | 10.706 |
| Pedidos · busca "Cliente 77" | 12.906 | 12.876 |
| Pedidos · cancelados (20) | 109,0 | 110,6 |

- **A busca e a devolução ficam dentro do teto de 50 ms**; a diferença é ruído (de −19% a +26%, sem direção).
- **A página nova custa a lista + 1 a 16 ms** (o teto de 100 linhas). O que está fora do teto na lista de Pedidos **já estava** (a abertura e a busca dela — as dívidas 24, 25, 29 e 30 da lei; a lista não foi tocada).
- **Planos:** nenhuma varredura sequencial no que a migration acrescenta — a junção da busca anda em `plt_eventos_card_idx`, `plt_cards_pedido_unico`, `plt_eventos_pkey` e `plt_eventos_referencia_idx`; a página nova, em `plt_cards_pkey` e `plt_eventos_pkey`. (Os 108 ms do plano avulso da busca são da amostra que escolhi — 50 peças arquivadas pelo fim da tabela —, não da junção.)
- **Achado do ensaio, corrigido antes do commit final:** a primeira versão da porta da lista juntava `plt_cards` e `plt_eventos` por `left join`; com a estimativa padrão de 1.000 linhas para a função, o plano em escala 1 foi junção por hash com varredura das duas tabelas. Troquei por subconsulta escalar (chave primária a chave primária) — o plano não depende mais da estimativa.

## Checklist de desempenho (Lei §12)

- [x] **Requisições:** nenhuma tela ganhou requisição (a lista trocou de porta, não ganhou chamada).
- [x] **Sem polling, sem `postgres_changes`, sem relógio novo.**
- [x] **Toda porta nova/tocada no ×100:** acima. Fora do teto só o que já estava (a lista de Pedidos).
- [x] **Índices:** nenhum novo; os que as leituras novas usam já existiam. Nenhuma política de RLS nova. **Advisors: não li** (sem acesso ao banco vivo).
- [x] **Listas:** nenhuma lista nova; a página nova herda o teto de 100 da lista.
- [x] **Pacote:** JS inicial 233,0 KB (teto 250).
- [x] **Escrita:** nenhuma escrita nova (a migration só lê).
- [x] **Tablet/celular:** 375 e 768 medidos nas 4 telas.
- [ ] **Dívida nova (para a lei, depois da dieta):** a lista de Pedidos passou a ter duas portas (`plt_fn_pedidos_lista` + `plt_fn_pedidos_pagina`); quando alguém mudar o retorno da lista (derrubando-a nas 5 migrations que a recriam), a coluna `entrega_registrada_em` entra nela e a porta nova sai.

## Erros e lições (para a Memória, depois da dieta)

- **L52-1 (erro, corrigido):** junção com função que devolve tabela dentro de função `language sql` — o planejador estima 1.000 linhas e escolhe hash com varredura das tabelas juntadas. *Correção:* o dado por linha vem por subconsulta escalar na chave primária. Pego pelo ensaio em escala 1 (ler o plano mesmo quando o tempo é bom).
- **L52-2 (erro, corrigido):** script com crases, aspas e `$` em heredoc do shell quebrou ("unexpected EOF") — reincidência da E-56/E-79. *Correção:* todo script desses vai para arquivo pela ferramenta de escrita.
- **L52-3 (acerto):** porta que devolve tabela fixa recriada por migrations antigas sem `drop` não precisa ganhar coluna: uma porta fina por cima (`to_jsonb(linha) || chave nova`), com os mesmos parâmetros, entrega o dado novo sem tocar migration antiga, sem quebrar o site publicado e sem requisição a mais.
- **L52-4 (acerto):** foto de tela sem navegador do app: o Edge sem janela dirigido pelo protocolo de depuração (o `WebSocket` e o `fetch` do próprio Node, sem dependência nova) emula 375/768/1440, mede `scrollWidth` e fotografa — resolve o limite do A-104 (abaixo de ~500 px o Edge cortava).
- **L52-5 (acerto):** vitrine com a rede bloqueada **no primeiro módulo importado** (`fetch` trocado por respostas de exemplo por nome de porta, `WebSocket` trocado por um mudo) deixa montar a tela de verdade com o `.env.local` da mesa sem nenhuma chamada sair para produção; a lista do que a tela pediu fica em `window.__pedidas` (conta as requisições de graça).
- **L52-6 (armadilha):** a suíte inteira de testes de tela oscila quando a máquina está dividida com outras mesas (tempo esgotado em testes diferentes a cada rodada) — separar "meu" de "da máquina" rodando sozinhos os arquivos que falharam.

## Para entrar nas notas depois da dieta

- **Decisões de Produto:** P52-1…P52-6 (acima) como D-NN ⏳ provisórias; marcar ↩️ na D-283 item 5 e na D-289 item 10; acrescentar a busca geral e a decisão da devolução à lista de leitores da D-276.
- **Memória de Aprendizado:** L52-1…L52-6.
- **Esquema do Banco:** a porta nova `plt_fn_pedidos_pagina(text, integer, integer, boolean) → jsonb`; as chaves novas `entregue_em` (em `plt_fn_busca_cards`) e `registrado_em` na linha `pedido_entregue` do histórico (em `plt_fn_devolucao_detalhe`). Nenhuma tabela, coluna, índice, gatilho ou política mudou.
- **Lei de Desempenho:** o bloco "Andamento (SESSAO-52)" com a tabela do ensaio e a dívida nova (duas portas na lista de Pedidos).
- **Mapa do Projeto / Ordem das Sessões:** linkar a demanda e o handoff.

## Achados fora do escopo (não mexi)

1. **Ficha do pedido:** se o admin corrigir a entrega para o **mesmo dia** em que ela foi registrada, a ficha mostra a hora do fim do expediente como se fosse a da entrega (a regra dela olha só "dia diferente"). A lista já trata esse caso. Remédio: a ficha usar `horaDaEntregaVale`.
2. **Busca geral — o card do pedido entregue que ficou nas rotas** (não arquivado: o lançado ou programado fica como registro da entrega): pelo código, ele ainda aparece como "PCP · tudo liberado". Não conferi em tela. Remédio: a busca devolver a data da entrega também para o card do pedido não arquivado.
3. **Auditoria:** outros registros que guardem objetos em `antes`/`depois` seguem aparecendo como JSON cru (o painel de tempos era o caso apontado).
4. **Lista de Pedidos no ×100:** a abertura e a busca seguem fora do teto (dívidas já registradas).

## Rodada final da bateria (~05:00)

Depois da troca da junção por subconsulta na porta da lista: **1.893 ✔ / 1 ✘** — só o painel de vendas (A-134). O fluxo do n8n da SESSAO-33 passou nesta rodada (já fora da janela da madrugada — E-163). Os 20 do bloco SESSAO-52, verdes; a migration nas duas rodadas de aplicação.
