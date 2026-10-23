---
titulo: SESSAO-40 — memória de execução
tipo: execucao
data: 2026-10-23
tags: [plataforma, execucao, estoque, kanban, busca]
---

# SESSAO-40 — memória de execução (sessão noturna, 23/10/2026)

Demanda: [[SESSAO-40 - Lancar Qualquer Produto Filtro por Pedido e Busca Geral]].

## Task list (espelho da demanda)

1. [x] Ler o cofre, a memória e o vídeo
2. [x] Estruturar as demandas da bateria (demanda + ClickUp em FAZENDO)
3. [x] Mapear o código e o banco envolvidos
4. [x] F1 — lançar qualquer produto para produção (banco + tela)
5. [x] F2 — filtro por pedido nos quadros dos setores, no tablet e no PCP (banco + tela)
6. [x] F3 — busca geral de cards (banco + tela)
7. [x] Bateria do banco, tsc/lint/testes, ensaio ×100
8. [x] Testar no navegador logado (e apagar o rastro) — no site publicado (o login do dono era lá)
9. [x] Aplicar em produção (banco + site juntos) e subir para a main
10. [x] Handoff com o roteiro de teste; memória de aprendizado; cofre (decisões, esquema, lei, modelo de sistema, ordem, mapa)

## Diário

### 05:00–05:40 UTC — leitura
- Pasta principal: `main` local estava 13 atrás da origem → `merge --ff-only` (só `.obsidian` modificado, de fora). Três sessões paradas na pasta (idle) — branch `sessao-40-estoque-filtro-busca` criada por `checkout -b`; conferir a branch antes de todo commit (E-113).
- Vídeo: sem ffmpeg na máquina → `imageio-ffmpeg` (quadros a cada 2 s) e, desta vez, a **fala transcrita** com `faster-whisper` (modelo `small`, CPU, int8) no scratchpad — o `av` instalado não aceitava o arquivo direto; a transcrição saiu lendo o WAV em numpy (A-111).
- Lidos: CLAUDE.md, memória de aprendizado inteira, lei de desempenho inteira, modelo de sistema (seções do quadro, estoque, casca), decisões do estoque (D-54…D-89) e dos quadros; dois ajudantes leram o código e os handoffs 30–39.
- Banco (só leitura): setores (PCP 1, SECC 2, CNC 3, FITAMENTO 4, FURAÇÃO 5, MONTAGEM 6, LIMPEZA E EMBALAGEM 7, ESTOQUE 8, PEDIDOS EM AGUARDO 235, EM DECISÃO PÓS DEVOLUÇÃO 239, ROTAS 9); cards por tipo/arquivado; motivos de arquivamento (`entregue`, `contagem`, `venda`, `baixa_manual`, `concluido` do avulso).

### Achados que mudam o desenho
- O "lançar para produção" do Estoque **não** é barrado pelo mínimo no banco — só pela tela (`podeLancar && em_necessidade`). O que barra no banco é **uma reposição aberta por produto** (`plt_cards_reposicao_aberta_uq` + a checagem na porta).
- Já existe a chave do gesto de criar (`plt_cards.chave_criacao`, índice único) — a idempotência do avulso; serve para o lançamento manual.
- `fn_reservados_producao` soma as reposições abertas por produto (aceita várias); `fn_vencer_reposicoes` vence card a card.
- O quadro do setor pagina no servidor em `fn_quadro_pagina` (cursor por chaves da `vw_card_ordem`, que já tem `pedido_numero` e o nome normalizado) e conta em `fn_quadro_total`.
- Não existe busca geral nem filtro por pedido em nenhum quadro.

### 05:40–06:00 UTC — demanda, ClickUp, banco
- Demanda escrita; 3 tarefas no ClickUp (PRODUÇÃO, em FAZENDO, humanizadas): 17tya50k7kr (Estoque), 17tya50k7kt (filtro), 17tya50k7ku (busca).
- Decisão técnica do F1: a reposição manual com a chave do gesto (`chave_criacao`, que já existia para o avulso) passa por fora do índice único da reposição aberta (recriado com `chave_criacao is null`) — a automática segue com UMA aberta; sem a chave (site de antes), a regra antiga. Descartado somar na reposição aberta (mudaria o prazo de 2 dias úteis).
- Funções recriadas por EXTRAÇÃO (`scratchpad/s40/extrair.py` + `gerar.py`): md5 do corpo vivo = arquivo nas 6 (`plt_fn_estoque_lancar_reposicao`, `fn_quadro_pagina`, `fn_quadro_total`, `plt_fn_quadro_setor`, `plt_fn_quadro_coluna`, `plt_fn_pcp_quadro`); cada troca de texto com contagem exigida.
- Bateria: o bloco 38 reaplica a da prioridade e a do stand-by no meio — a minha entra logo depois da do Mover (E-144); as conferências de permissão com a assinatura velha atualizadas (E-120). 1ª rodada: 4 falhas, todas do meu bloco — colisão dos produtos 940001/940002 com o bloco da "migration 40" (E-157) e o PCP lido como logística (o quadro do PCP pede o setor PCP ou admin). 2ª: verde (1.286).

### 06:00–06:40 UTC — telas
- F1: ícone em todo cartão (`pedeProducao` separado de `podeLancar`), botão no detalhe, a chave por abertura e a trava do clique duplo.
- F2: `useFiltroDoQuadro` (endereço) + `FiltroDoQuadro`; `useQuadro(setor, ordem, filtro)` com a chave da consulta incluindo o filtro e o quadro anterior do mesmo setor como espera; a barra do topo do `QuadroKanban` na mesma posição com o quadro abrindo ou aberto (o campo não perde o foco); "N cards batem com o filtro" por coluna; tablet (o som de card novo não toca ao limpar o filtro); PCP (as três abas, páginas recomeçam ao trocar o filtro).
- F3: `src/busca/` — api, `ondeEsta` (puro, Vitest), `BuscaGeral` (lazy, useInfiniteQuery, cursor), `BotaoBuscaGeral` (lupa + Ctrl+K) na casca (menu e barra do celular; só com o módulo fábrica).
- tsc, lint, 291 testes de tela, montagem: JS inicial 223,0 KB.

### 06:40–07:20 UTC — ensaio ×100 e as correções
- 1ª rodada: busca pelo nome 290 ms (2 letras: 1,9 s), número "12" 211 ms; quadro filtrado pelo nome 300–900 ms (pior que o sem filtro, 197 ms). Causas: o recheck do trigrama chamando a função de normalização (com SET) linha a linha; o número montando todos os pedidos que começam com o texto; a regra do filtro rodando em cada coluna.
- Correções: `plt_cards.nome_busca` (coluna gerada) + trigramas (A-112); a busca pelo número andando as faixas de cima para baixo e parando quando enche (A-113); `fn_quadro_filtrados` uma vez por quadro (A-114); o nome com 3 letras.
- Final: busca 5–23 ms; quadro filtrado 57–142 ms (sem filtro 137 ms — dívida 27 nova na lei, anterior); PCP filtrado 60–102 ms; lançar 12 ms. Script e resultado em `Execucao/dados/`.

### 07:20–07:50 UTC — produção
- `npm run banco:aplicar -- --confirmar --so 20261024010000_plt_lancar_filtro_busca.sql` → aplicada; integração idêntica (estrutura e linhas).
- Conferência no banco real como o dono (bloco `DO` com `RAISE`, nada gravado): busca 137 7 ms, estante 1,5 ms, quadro da LIMPEZA 11 ms, filtrado 9 ms, PCP filtrado 6 ms.
- `push origin sessao-40-estoque-filtro-busca:main` (avanço direto, 14b3448 → 437eaca), Vercel success; acertos do teste → 049f5ae, Vercel success. `main` local atualizada por `update-ref` (a pasta segue no ramo da sessão).

### Teste no site publicado (logado como o dono)
- Limpeza filtrada por 13722: 3 cards (1 em A LIMPAR, 2 na EXPEDIÇÃO) — como no vídeo; "ARMÁRIO aéreo": 3; "x" limpa. MONTAGEM aberta por `?filtro=13727`: 1 (MONTANDO).
- Ctrl+K: "13721" → "Entregue em 22/10"; "137" → os 137xx em PCP, Expedição, MONTAGEM, FITAMENTO, LIMPEZA; tocar abre a janela do card; "multiuso" → a reposição no PCP e as peças nos setores.
- Estoque: 30 cartões com o ícone (12 vermelhos, 18 cinza); lançado 1 Armário multiuso com o estoque coberto, com clique duplo de propósito → 1 card só (o aviso saiu 2 vezes → trava no envio); achado no PCP pelo filtro e pela busca; **retirado pelo "Não produzir"** (0 esperando no PCP; o histórico guarda os dois fatos).
- Celular 375 px: lupa ao lado do sino, filtro na largura toda, sem rolagem lateral; a busca sobe de baixo.
- Acertos vistos no teste e publicados: o resumo do quadro com o texto digitado (não o normalizado), o atalho do quadro só para pedido ainda no PCP, o nome do card do pedido, o campo da busca preso no topo, a trava do clique duplo.
- Não testado ao vivo: o modo tablet (entrar nele trocaria a sessão do dono).
