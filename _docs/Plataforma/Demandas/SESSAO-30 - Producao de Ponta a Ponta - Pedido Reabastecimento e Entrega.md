---
titulo: "SESSAO-30 — Produção de ponta a ponta: pedido, reabastecimento e entrega"
tipo: demanda
status: 📐 pronta para code
data: 2026-10-07
atualizado: 2026-10-07
origem: pedido do dono em 06/10/2026, mapeado no Cowork (leitura só de cofre, código, banco e ClickUp — nada alterado)
plano: "[[004 - PLANO - Bloco 6 - Producao de Ponta a Ponta e Kanban Completo]]"
tags: [plataforma, demanda, bloco-6, producao, pcp, estoque, rotas, entrega, tiny, raio-x]
---

# 🎯 SESSAO-30 — Produção de ponta a ponta: pedido, reabastecimento e entrega

> [!important] Leia antes de tudo
> `CLAUDE.md` (ordem de leitura inteira) · **[[PLT - Lei de Desempenho e Escala]] (regra 18 — vale para tudo o que esta sessão tocar; ver §3.6)** · [[004 - PLANO - Bloco 6 - Producao de Ponta a Ponta e Kanban Completo]] · os handoffs [[handoff_2026_09_27_sessao24_producao_concluida]], [[handoff_2026_09_30_estoque_sincronizado_tiny]], [[handoff_2026_09_30_ajuste_estoque_2]], [[handoff_2026_10_01_sessao29_reconciliacao_tiny]], [[handoff_2026_10_02_sessao27_automacoes_canvas]] (o motor tem gatilho em `pedidos`) e [[handoff_2026_10_02_sessao28_rota_calculada]] (programação e ordem da rota) · a **Q-72** em [[PLT - Perguntas em Aberto]] e o documento do projeto "estoque-raio-x-2026-09-29" · [[N8N - ROTAS Entregue para Tiny]] (a automação antiga do ClickUp que hoje marca o Tiny).
> **Primeiro passo:** conferir no git que a `main` contém tudo até a atualização do banco de 03/10 (migration 55) e criar a branch `sessao-30-producao-ponta-a-ponta`. Não criar worktree sem ordem do dono.

## O que é

Fechar o **caminho da peça de ponta a ponta** — do pedido do Tiny até a entrega, e do pedido de reposição até o estoque —, **provar com um ensaio completo** e corrigir os furos achados no mapeamento: a reserva em venda que some quando o pedido vai para ROTAS, o "Entregue" que não conversa com o Tiny, as correções do raio-x que mexem no caminho e a **tela do entregador**.

## 0. Retrato de partida (lido no banco em 06/10/2026, só leitura)

- O fluxo do pedido existe até o **"Lançar para ROTAS"**. O **"Registrar entrega"** (ROTAS → Entregas, dois toques) grava `pedido_entregue` no card do pedido, mas:
  - **não muda o Tiny** — o próprio código avisa em `src/paginas/Rotas.tsx`: *"Marcar 'Entregue' aqui NÃO atualiza o Tiny — a automação do ClickUp que faz isso continua viva"*;
  - **não fecha as unidades**: elas ficam ativas no setor ROTAS para sempre (8 ativas hoje).
- `plt_privado.fn_estoque_por_produto` (CTE `reservados`) conta peça de pedido em fim de linha **exceto `rotas`** → no minuto em que o pedido é lançado para ROTAS, a peça **sai de "reservados em venda"**, mesmo sem ter sido entregue.
- **"Entregue" no Tiny não fecha nada aqui:** os pedidos **13146, 13156 e 13176** estão "Entregue" no Tiny, foram lançados para ROTAS e têm **6 unidades ativas em ROTAS**, sem `pedido_entregue`. Os pedidos 13108 e 13114 têm o evento de entrega e ainda 1 unidade ativa cada em ROTAS.
- Webhooks de saída ativos: só os 3 de fila (estoque do Tiny, fotos, leitura de pedidos). **Nenhum para entrega.**
- **Reabastecimento completo:** Estoque → ícone vermelho "lançar para produção" (ou a reposição automática, hoje desligada — D-90) → PCP aba **Reabastecimento** → liberar → produção por arrasto → "Concluir produção" na LIMPEZA E EMBALAGEM → **ESTOQUE sem dono** → o Tiny acompanha (D-77). Falta só o ensaio de ponta a ponta.
- Storage: só o bucket **`plt-imagens`, público** (fotos de produto). Comprovante de entrega **não pode** ir para lá.
- Visibilidade de card (RLS `plt_cards_leitura`): admin, setores do usuário ou executor atual.

## 1. O mapa — fluxo do pedido

| # | Passo (palavras do dono) | Hoje | Nesta sessão |
|---|---|---|---|
| 1 | Produto lançado como pedido no Tiny | ✅ gatilho no banco cria o card no PCP; a conferência das 3h pega o aviso que o Tiny não mandou (S09/S29/D-96) | só o ensaio |
| 2 | Entra no PCP com sugestão de estoque (caso possua) | ✅ a venda reserva a peça na hora (D-78); selo de peça no estoque no card (D-88); "usar?" na liberação (D-62) | ensaio + raio-x 3, 4 e 5 |
| 3 | PCP lança para produção no setor correto | ✅ o PCP escolhe o setor ao liberar | raio-x 3: liberar **não** manda direto para ESTOQUE/AGUARDO; a liberação vira **uma transação no banco** |
| 4 | Pedido concluído? | ✅ arrasto até a LIMPEZA E EMBALAGEM → "Concluir produção" → Pedidos em aguardo; selo "Pedido completo" | só o ensaio |
| 5 | Vai para Pedidos em aguardo até alguém lançar para as ROTAS | ✅ só pedido completo vai (D-33/D-45) | só o ensaio |
| 6 | Produto fica como reservado para venda | ⚠️ só enquanto está no aguardo — **some ao lançar para ROTAS** | **§3.1** — reservado até "Entregue" |
| 7 | Alguém marca como entregue → deixa de ser reservado | ❌ "Entregue" daqui não vai ao Tiny; "Entregue" do Tiny não fecha aqui; unidades ficam em ROTAS | **§3.2** "Entregue" é um fato só + **§3.3** tela do entregador |

## 2. O mapa — fluxo de reabastecimento

| # | Passo (palavras do dono) | Hoje | Nesta sessão |
|---|---|---|---|
| 1 | Alguém solicita estoque para produção | ✅ ícone vermelho no Estoque (logística/admin) ou reposição automática | ensaio |
| 2 | Entra na tela do PCP, aba Reabastecimento, e é lançado normalmente em produção | ✅ "Liberar unidades" (modo reposição) ou "Não produzir"; parada 2 dias úteis sai sozinha (D-85) | ensaio |
| 3 | Quando a produção concluir, fica estocado normalmente | ✅ ESTOQUE sem dono + Tiny ajustado; a necessidade some | ensaio |

## 3. O que construir

### 3.1 Reservado em venda até a entrega

- **Regra nova:** a peça pronta de pedido conta como **"reservada em venda"** desde que fica pronta (no aguardo, ou peça do estoque reservada pela venda) **até o pedido ser Entregue** — inclusive enquanto está em ROTAS, programada ou no caminhão.
- Vale em todo lugar que mostra o número: cartão do Estoque, filtros, Visão do dia, Pedidos em aguardo (contagens) e o que mais ler "reservados".
- **Um dono para a regra** (M-04): a definição de "reservada em venda" vive num lugar só e todas as portas a usam (o harness amarra lista × resumo × painel, como na D-75).

### 3.2 "Entregue" é um fato só — vale dos dois lados (resposta do dono, 06/10)

- **Marcou aqui** (ROTAS → Entregas ou a tela do entregador) → a plataforma grava a entrega **e manda o Tiny para "Entregue"**, pelo padrão da casa "o banco chama o n8n só quando há trabalho" (fila + aviso — D-80, como a fila do estoque do Tiny). Isso **substitui** a automação antiga do ClickUp ([[N8N - ROTAS Entregue para Tiny]]) — desligá-la **só com o OK do dono**, depois de provado.
- **O Tiny ficou "Entregue"** (aviso da venda ou conferência das 3h) → a plataforma **registra a entrega sozinha** (autor "Sistema", origem Tiny), sem pedir nada a ninguém.
- **Sem eco e sem duplicar:** o que veio do Tiny não volta ao Tiny; o que foi daqui e voltou do Tiny não cria uma segunda entrega (idempotente).
- **As unidades entregues saem de toda conta** (estoque, reservas, ROTAS ativa, Visão do dia) e continuam no **histórico do pedido** — tudo por evento; nada se apaga (RNF-05).
- **Os que já estão errados hoje** (13146, 13156, 13176 e as unidades paradas de 13108/13114): manutenção com **prévia ao dono** antes de rodar.
- O "Entregue" do Tiny com peças **ainda em produção ou no aguardo** na plataforma segue a resposta da pergunta 1 (§5).

### 3.3 Tela do entregador (item do ClickUp "Rotas — Visualização dos entregadores")

- **Para quem:** o entregador, **no celular**. Mostra as entregas **do dia do caminhão dele**, na **ordem salva da rota** (D-109/D-111).
- **Cada entrega:** cliente; endereço com "abrir no mapa"; WhatsApp; **os produtos do pedido** (móveis com a quantidade — o frete nunca aparece, D-63); observação do pedido; botão **"Concluir entrega"** em dois toques; **anexar comprovante** (foto pela câmera, ou imagem/PDF).
- "Concluir entrega" é **o mesmo gesto do §3.2** — o Tiny vai junto.
- **Comprovante:** guardado em lugar **privado** (nunca no bucket público das fotos), ligado ao **card do pedido**; a logística vê o comprovante em ROTAS → Entregas e em Já programadas.
- **A base de anexos nasce aqui, genérica:** anexo pertence a um card; quem enviou, quando, tipo, tamanho; remoção por evento; leitura por link assinado de vida curta; a mesma redução de foto do estoque (`src/lib/imagem.ts`). A [[SESSAO-31 - Kanban Completo - Card Avulso Janela do Card Anexos e Conversa]] **evolui esta base** (PDF/imagem/áudio na janela do card). **Não fazer a janela do card aqui.**

### 3.4 Correções do raio-x que mexem no caminho da peça (Q-72, itens 1 a 6 — o dono escolheu incluir em 06/10)

> ⚠️ **Conferir cada item no código e no banco ANTES de corrigir** — as atualizações do banco de 30/09 a 03/10 (sincronismo com o Tiny, Estoque 2, automações) podem ter mudado o terreno. O que já não existir vira registro na execução, não correção.

1. **Peça danificada de pedido vivo no ESTOQUE** — a regra de chegada (no ESTOQUE só 🟢 e só sem dono) tem que valer para **toda origem** (tela, API, automação), não só para a tela. O card 502 é teste (Q-69) — o destino dele é a pergunta 7.
2. **Baixa por fora do caminho oficial** — arquivar uma peça livre do ESTOQUE (ou gravar evento direto) não pode virar "baixa" sem passar pela porta da movimentação (ordem de entrada, trava por produto, motivo e o Tiny).
3. **Liberar do PCP direto para ESTOQUE/AGUARDO** — proibido: só a sugestão de alocação leva ao aguardo, e só peça pronta. A liberação inteira vira **uma transação no banco** (hoje é um laço no navegador, sem transação).
4. **Origem da peça manual na alocação** — o rótulo diz a origem certa ("entrada manual"), e o tipo do front conhece essa origem.
5. **A regra de "peça livre" em três funções** — vira uma só; os totais do resumo = a soma da lista (harness amarra).
6. **Peça personalizada livre sem saída pela tela** — dar saída (baixa e alocação) seguindo a regra do personalizado (casa por SKU **e** descrição — `plt_privado.fn_eh_personalizado`).

Itens 7 a 10 da Q-72 continuam como pendência registrada (fora desta sessão).

### 3.5 O ensaio de ponta a ponta — o aceite principal

Rodar no **banco real dentro de uma transação desfeita** (padrão A-11 — termina com zero linha) **e** como bloco permanente no harness (`npm run test:banco`). Registrar na execução uma **tabela com os números esperados e os obtidos em cada passo** — *em estoque*, *reservados em venda*, *reservados para produção*, *necessidade*:

1. **Pedido:** pedido de teste com 2 móveis — um com peça livre no estoque, outro sem → card no PCP com o selo → liberar usando a peça no 1º e mandando o 2º para a SECC → arrasto SECC → FURAÇÃO → MONTAGEM → LIMPEZA E EMBALAGEM → "Concluir produção" → aguardo "completo" → lançar para ROTAS (**reservados em venda não muda**) → programar no caminhão → concluir pela tela do entregador, com comprovante → pedido de mudança do Tiny na fila (**reservados em venda cai**).
2. **Volta do Tiny:** pedido lançado para ROTAS → o Tiny fica "Entregue" → a plataforma fecha sozinha, uma vez só.
3. **Reabastecimento:** lançar 2 unidades de um produto do Top X → aba Reabastecimento → liberar → produção → concluir → ESTOQUE + ajuste do Tiny na fila; a necessidade some.
4. **Regressão:** cancelamento nos 3 estágios (D-61) e a reposição parada que vence (D-85) continuam iguais.

### 3.6 Desempenho e escala — as telas e portas que esta sessão toca saem dentro da lei (regra 18)

> Decisão do dono (07/10): as sessões 30 e 31 seguem a [[PLT - Lei de Desempenho e Escala]] **em tudo o que tocam**; o resto da plataforma é a [[SESSAO-32 - Desempenho e Escala - Adequacao de Toda a Plataforma]]. Nesta sessão, o que é tocado e como sai:

- **Números do estoque** — a regra do §3.1 mexe no coração de `fn_estoque_por_produto`, que hoje alimenta portas lentas com só 4 mil cards: `plt_fn_estoque_resumo` 1,6 s em média (máx. 3,5 s), `plt_fn_estoque_produtos` 1,3 s (máx. 3,9 s), `plt_fn_estoque_configuracoes` 1,1 s, `plt_fn_reposicoes_resumo` 0,4 s. Refazer como **projeção por produto** (tabela-resumo mantida por gatilho nos fatos de peça/pedido/entrega: em estoque, reservados em venda, reservados para produção, necessidade) e as portas lendo a projeção — **≤ 50 ms (p95) com volume ×100**, `EXPLAIN (ANALYZE, BUFFERS)` na execução. Um dono para a regra (M-04): a projeção é a única fonte dos números.
- **Sem relógios nas telas tocadas:** saem os `refetchInterval` do Estoque (Top X, 30 s), Pedidos em aguardo (30 s), PCP (20 s, três consultas) e ROTAS → Entregas (30 s). As mudanças chegam por **websocket** (Broadcast privado, tópicos estreitos — ex.: `logistica:estoque`, `logistica:aguardo`, `logistica:rotas`, `setor:{id do PCP}`), com payload mínimo; a tela aplica no cache ou relê **só** a parte afetada; ao reconectar, uma leitura "desde o último evento".
- **Cada tela tocada abre com 1 requisição** (porta da tela) — Estoque, Pedidos em aguardo, PCP, ROTAS → Entregas e a **tela do entregador** (as entregas do dia do caminhão, já com produtos e endereço, numa porta só).
- **Liberação do PCP numa chamada só** (uma transação no banco — junto com o item 3 do raio-x).
- **Comprovante:** sobe **direto para o storage** com link de envio assinado (não passa pelo banco), foto reduzida no aparelho, miniatura no tamanho exibido.
- **"Concluir entrega" otimista e idempotente** (chave por gesto — o motorista sem sinal pode tocar duas vezes; o aviso do Tiny pode chegar duas vezes → uma entrega só).
- **"Entregue" ↔ Tiny** pela fila (sem relógio): chamada ao Tiny com **tempo limite**, nova tentativa com **espera crescente e sorteio**, **disjuntor** quando o Tiny cair; a falha nunca derruba o gesto do entregador.
- **Listas tocadas por cursor** (Entregas, Pedidos em aguardo, Produtos reservados), teto de página no banco.
- **Índices** de toda chave estrangeira, filtro, ordenação e coluna de RLS que as portas novas usarem; advisors de desempenho sem item novo.
- O que ficar fora da lei nas telas tocadas → registrado como dívida no §14 da lei, com o porquê (nunca em silêncio).

## 4. Decisões que regem esta demanda

D-13/D-18 (entrada única, terminais) · **D-33/D-45** (entrega por pedido completo, só o lançado pelo aguardo) · D-58 (lugar da peça pronta) · D-59/D-60 (arrasto e rotas das etapas) · D-61 (cancelamento em 3 estágios) · D-62 (sugestão do estoque) · D-63 (frete fora) · D-70/D-76/D-77/D-78 (estoque e Tiny) · D-80 (um fluxo só no n8n; o banco chama quando há trabalho) · D-83…D-90 (Top X, reservados, reposição) · D-96 (conferência diária) · D-108…D-111 (rota e programação) · RNF-05 · M-04 · M-13 · regra 17 · **regra 18 — [[PLT - Lei de Desempenho e Escala]]** · **regra 19 — tarefas do ClickUp**.
**Vão ser revisadas (registrar D-NN novas com ↩️):** D-33/D-45 — a entrega passa a mudar o Tiny e a ser recebida do Tiny · D-86 — "reservados em venda" inclui ROTAS até a entrega.

## 5. Perguntar ao dono no início da sessão (ritual de sempre; só codar com o OK)

**Já respondidas no Cowork (06/10) — só confirmar:** "Entregue" vale dos dois lados · a janela do card fica para a SESSAO-31 e vale para todo card · os itens 1 a 6 do raio-x entram aqui · a tela do entregador entra aqui · a impressora de etiqueta fica para depois.

**Abertas:**
1. O Tiny marcou "Entregue" e a plataforma ainda tem peças desse pedido **em produção ou no aguardo**: arquivar tudo (como foi feito em 27/09 com os pedidos 13257 e 13236) ou avisar o PCP e deixar uma pessoa decidir?
2. Pedido **cancelado com peça já em ROTAS** (programada ou no caminhão): a peça volta ao ESTOQUE sem dono quando a logística confirmar o retorno? (Hoje nada acontece.)
3. **Entregador:** tem login próprio? Vê só as entregas do caminhão dele no dia? Quem diz quem dirige qual caminhão?
4. **Comprovante obrigatório** para concluir a entrega?
5. **Entrega que não aconteceu** (cliente ausente, endereço errado): registra o motivo e o pedido volta para "Programar"?
6. **"Entregue" marcado por engano:** quem desfaz (líder/admin)? O Tiny volta para a situação anterior junto?
7. **Peça 502** (danificada, de teste) parada no ESTOQUE: arquivar?
8. Quando **desligar a automação antiga do ClickUp** que marca "Entregue" no Tiny? (Recomendação: logo depois do primeiro pedido real provado de ponta a ponta — as duas marcando "Entregue" não fazem mal, mas a antiga precisa sair para o ClickUp deixar de ser caminho.)

## 6. Fora do escopo

Tudo do kanban — card avulso, janela do card, conversa, menções, pausa com motivo ([[SESSAO-31 - Kanban Completo - Card Avulso Janela do Card Anexos e Conversa]]) · impressora de etiqueta · itens 7 a 10 da Q-72 · a integração completa com o Tiny da fábrica ([[003 - PLANO - Integracao Completa Tiny da Fabrica]]) · rota com trânsito/interdições · app nativo do motorista · migração dos cards vivos do ClickUp (Q-25) · a adequação de desempenho das telas que esta sessão **não** toca (primeira abertura, permissões no token, pacote dividido, Meu Painel, Visão do dia etc.) — é a [[SESSAO-32 - Desempenho e Escala - Adequacao de Toda a Plataforma]].

## 7. Critérios de aceite

- [ ] **Ensaio do pedido** (§3.5.1) com a tabela de números passo a passo batendo no banco real (transação desfeita) e no harness.
- [ ] Lançar para ROTAS **não muda** "reservados em venda"; marcar Entregue **baixa** — no cartão do Estoque, nos filtros e na Visão do dia (mesma porta — harness amarra).
- [ ] Entregar aqui → o pedido de mudança do Tiny entra na fila e o Tiny fica "Entregue" — provado com **1 pedido real, com o OK do dono**.
- [ ] Tiny "Entregue" → a plataforma registra sozinha ("Sistema", origem Tiny), uma vez só, sem eco de volta ao Tiny.
- [ ] Os pedidos 13146, 13156 e 13176 e as unidades de 13108/13114 fechados pela manutenção aprovada; **nenhuma unidade de pedido entregue fica ativa em ROTAS**.
- [ ] Tela do entregador a 375 px: entregas do dia na ordem da rota, concluir em dois toques, comprovante por foto/PDF; o arquivo é **privado** (quem não é da logística/admin não abre; link de vida curta).
- [ ] Raio-x 1 a 6: cada correção com teste no harness provando a regra **para toda origem** (tela, API, automação).
- [ ] **Ensaio do reabastecimento** (§3.5.3) batendo.
- [ ] Cancelamento nos 3 estágios e reposição vencida sem regressão.
- [ ] Toda mudança por evento novo; nenhum evento editado ou apagado.
- [ ] Integração do Tiny com **estrutura e linhas idênticas** antes/depois de cada atualização do banco (impressão digital — F-08).
- [ ] Revisões registradas como D-NN novas (↩️ D-33/D-45, ↩️ D-86) e a Q-72 marcada com o que foi corrigido.
- [ ] **Números do estoque ≤ 50 ms (p95) com volume ×100** — plano (`EXPLAIN ANALYZE`) na execução; resumo, lista, configurações e reposição batem entre si (uma fonte só).
- [ ] **Aba Network:** Estoque, Pedidos em aguardo, PCP, ROTAS → Entregas e a tela do entregador abrem com **1 requisição** cada e **nada se repete sozinho**; mudança feita em outra aba aparece sem recarregar.
- [ ] **Busca no código:** nenhum `refetchInterval`/`postgres_changes` nas telas tocadas.
- [ ] Concluir entrega tocado duas vezes, ou com a rede caindo e voltando = **uma** entrega; Tiny fora do ar não trava o entregador (fica na fila e tenta depois).
- [ ] Checklist de desempenho da lei (§12) marcado item a item no handoff, com o tamanho do pacote antes/depois.
- [ ] Tarefas do ClickUp (seção abaixo) movidas para **FAZENDO** ao começar e **nunca** para concluído; o dono avisado de cada uma ao terminar.

## 8. Notas para o Claude Code

- **Evoluir as portas que existem** (`fn_estoque_por_produto`, `plt_fn_rotas`, `plt_fn_registrar_entrega`, `plt_fn_lancar_rotas`, `plt_fn_programadas`, `plt_fn_aguardo_contagens`) — nada de leitura paralela (E-22).
- **Situação do Tiny sempre por `fn_situacao_normalizada`** (E-25) — nunca comparar texto cru.
- **Gatilhos em `pedidos`:** a blindagem da D-43 não pode regredir e já existem 3 gatilhos da plataforma (o motor das automações é o "zzzz", adiado — E-78). Gatilho novo convive com eles; conferir `pg_get_triggerdef` no banco real.
- **n8n:** um fluxo só por assunto, o banco chama quando há trabalho (D-80 / o padrão da fila do estoque, migration 43). Ler a nota da automação antiga do ClickUp para a chamada do Tiny. **Token nunca em chat, código ou nota** (regra 4).
- **Anexos:** bucket privado, RLS por card, link assinado curto, limite de tamanho e de tipo (aqui imagem e PDF; o áudio entra na 31). Desenhar a tabela pensando na 31 (anexo de qualquer card, autor, remoção por evento).
- **Aplicar banco e publicar telas é um gesto só** (E-73). Aplicar só com o OK do dono, sozinha (`--so`) se houver outra frente.
- Ritual completo: (a)(b)(c) antes de codar, task list espelho desta demanda, memória em `_docs/Plataforma/Execucao/SESSAO-30.md` na hora, E-NN/A-NN na memória de aprendizado na hora, handoff em `_docs/Handoffs/`.
- **Checklist final obrigatório, item a item:** `npm run test:banco` (2 rodadas) · `npx tsc -b` · `npm run lint` · `npm test` · `npm run build` · celular 375 px e tablet 768 px · checkpoint antes de aplicar (F-08) · `get_advisors` (segurança **e desempenho**) · **checklist de desempenho da lei (§12)** · `pg_stat_statements` sem porta nova no topo · task list conferida contra a demanda · tarefas do ClickUp em FAZENDO e o dono avisado · handoff + mapa + próximos passos + ordem das sessões.

## Tarefas no ClickUp (regra 19)

Lista **PRODUÇÃO** (DPTO TI). Ao começar cada uma → **FAZENDO**. **Nunca** mover para concluído: ao terminar, avisar o dono na conversa e deixar um comentário curto na tarefa (o que foi entregue e como conferir) — **quem conclui é o dono**.

- [Produção - Reservado em venda até a entrega](https://app.clickup.com/t/17tya50fm3m) — §3.1
- [Rotas - Entregue nos dois lados (plataforma e Tiny)](https://app.clickup.com/t/17tya50fm3n) — §3.2
- [Rotas - Visualização dos entregadores](https://app.clickup.com/t/17tya50fbqb) — §3.3
- [Produção - Correções do raio-x no caminho da peça](https://app.clickup.com/t/17tya50fm3p) — §3.4
- [Produção - Teste de ponta a ponta do pedido e do reabastecimento](https://app.clickup.com/t/17tya50fm3q) — §3.5
- [Desempenho - Estoque, Pedidos em aguardo, PCP e ROTAS dentro da lei](https://app.clickup.com/t/17tya50fm43) — §3.6

## Resultado (preencher ao entregar)

**Entregue em 08/10/2026** — [[handoff_2026_10_08_sessao30_producao_ponta_a_ponta]].

- §3.1 reservado em venda até a entrega ✅ (D-118) · §3.2 "Entregue" dos dois lados ✅ — Tiny → plataforma no ar; plataforma → Tiny pronto, **chave desligada até a prova do dono** (fluxo do n8n como arquivo importável — a chave de acesso do n8n só lê) · §3.3 tela do entregador ✅ (D-115) · §3.4 raio-x 1–6 ✅ (Q-72) · §3.5 ensaio de ponta a ponta ✅ 12/12 no banco real + bloco permanente na bateria · §3.6 lei nas telas tocadas ✅ (ao vivo por websocket, sem relógio; portas novas ≤ 12 ms no banco) — dívidas 13–15 registradas para a 32.
- **Mudou de rota:** o entregador é um módulo ("entregas"), não um papel novo (não mexe na função de login); o caminho plataforma → Tiny é um fluxo próprio no n8n (↩️ D-113); o PCP libera só para produção (↩️ D-63); o ranking das vendas anda de madrugada (D-119).
- **Fica com o dono:** importar o fluxo, ligar a chave e provar com 1 pedido real; confirmar as revisões acima.

## Ver também

[[PLT - Lei de Desempenho e Escala]] · [[004 - PLANO - Bloco 6 - Producao de Ponta a Ponta e Kanban Completo]] · [[SESSAO-32 - Desempenho e Escala - Adequacao de Toda a Plataforma]] · [[SESSAO-31 - Kanban Completo - Card Avulso Janela do Card Anexos e Conversa]] · [[SESSAO-24 - Estoque Nucleo - Aguardo Cancelamentos e Alocacao]] · [[SESSAO-28 - Rota Calculada no Mapa]] · [[PLT - Perguntas em Aberto]]
