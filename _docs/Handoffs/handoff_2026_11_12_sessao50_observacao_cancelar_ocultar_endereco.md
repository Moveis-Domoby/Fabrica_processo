---
titulo: Handoff — SESSAO-50 · a observação do item na capa do card, Cancelar e Ocultar pedido no PCP (o excluído no Tiny sai de vez) e editar o endereço da parada
tipo: handoff
data: 2026-11-12
tags: [handoff, sessao-50, kanban, pcp, tiny, rotas, logistica, publicacao]
---

# 📋 Handoff — SESSAO-50 · Observação do item, Cancelar/Ocultar no PCP e editar o endereço (12/11/2026, madrugada)

Demanda: [[SESSAO-50 - Observacao do Item Cancelar e Ocultar no PCP e Editar Endereco da Parada]] · Diário: [[SESSAO-50]] (+ [[SESSAO-50 - bloco A]], [[SESSAO-50 - bloco C]]) · Decisões: D-307…D-324 em [[PLT - Decisoes de Produto]]

> ✅ **NO AR desde 12/11/2026 ~04:05 de Natal**, com a permissão que o dono deu na conversa (~02:35: *"Finalize tudo, teste na tela… publique tudo quando validar no final… você tem permissão total"*). Na ordem: a conferência só lendo o banco (31 funções com o corpo esperado, as 33 novas ainda inexistentes, ninguém de fora chamando a regra que muda); **as 4 atualizações do banco** (uma transação cada; a integração do Tiny idêntica em estrutura e linhas); **o preenchimento das observações antigas** depois do ensaio com os mesmos números (376 itens em 325 pedidos; o 13871 com "adicionar rodízios"); **a automação do n8n** que leva a situação ao Tiny passou a aceitar "cancelado" (uma linha; cópia guardada; versão `caaa00ef…` → `e2cb82a8…`, conferida); **o site** (main `abe94ff`; a Vercel publicou; `versao.json` vivo = `62953bf3f155`, o mesmo da montagem local; os pedaços novos respondem); **a recontagem do estoque** (0 produtos mudaram). Advisors: nada novo além do esperado.
>
> ⚠️ **Não feito de propósito:** "Salvar o endereço também no Tiny" fica **desligado, com o porquê** (D-320) — o caminho exige mudar a automação para regravar o pedido inteiro no Tiny e um teste num pedido de teste com o dono acordado.

## 1. Objetivo (o pedido do dono, 12/11)

1. *"Observações que forem adicionadas DENTRO do produto aparecerem na capa do card… o layout do card para esses casos deve ainda continuar organizado e correto."* (vídeo do 13871: "adicionar rodízios" no papel, nada no card)
2. *"Pedido excluído no tiny há muito tempo mas do nada apareceu no PCP para liberar, o pedido é o 13622…"* — e as respostas das 01:25/01:30: botões **Cancelar** (cancela também no Tiny) e **Ocultar** (com "Pedidos ocultos" por 1 mês e o "Incluir pedido no PCP" como único caminho depois); as peças ocultadas, ao recuperar, voltam como vagas no PCP.
3. *"Possibilidade de editar o local de uma parada avulsa ou pedido comum…"* — endereço de verdade + pino; a pergunta "salvar também no Tiny?"; o original do Tiny guardado.

## 2. O que foi feito

### Bloco B — Cancelar e Ocultar no PCP; o excluído no Tiny sai de vez (D-307…D-314)
- **A causa do 13622/13270:** a limpeza geral de 19/10 recriou os cards sem olhar a lista de excluídos; a regra do PCP também não olhava; o acerto da 48 reabriu as vagas. **Sem acerto de dados:** a regra única do PCP passou a considerar a lista — **o 13622 saiu sozinho** (conferido no banco no ar: fora do quadro, em "Cancelados" como "Excluído no Tiny"); **o 13270 continua no PCP** para o PCP decidir pelos botões novos.
- **O excluído = o caminho do cancelado** (↩️ D-140): o fato no card do pedido, a peça em produção espera a logística, a pronta vai ao estoque sem dono, o sino da logística avisa; só o "não localizado" da **conta da loja** marca; o reencontrado sai da lista.
- **"Cancelar pedido"** e **"Ocultar do PCP"** em todo pedido do PCP: no card do quadro, na aba Stand-by, na janela do card do pedido, na janela "O que aconteceu?" e como linha na "Liberar unidades". Modais próprios (a prévia lê numa requisição quantas peças e onde).
- **As abas "Cancelados"** (Tiny / plataforma / excluído, com o estado do Tiny e "Tentar de novo") **e "Pedidos ocultos"** (30 dias — o admin muda ali mesmo —, "Recuperar" com as vagas abertas).
- **"Incluir pedido no PCP"** (era "Novo pedido"): os ocultos de qualquer idade + os pedidos sem card — só os vivos no Tiny —, página a página ao rolar. A porta antiga levava **131 s** com 560 mil pedidos no ensaio; a nova 16–20 ms.
- **Frente 5:** "Liberar unidades" sem CANCELADO e NÃO ENCONTRADO (o banco também recusa) e o aviso do laço (3+ cancelamentos em 24 h).

### Bloco A — a observação do item na capa do card (D-315…D-318)
- Guardada numa tabela da plataforma por item (`plt_itens_observacao`), por gatilho na gravação do pedido; **os 376 itens antigos preenchidos**. Aparece na capa do card (quadros e tablet), na janela do card ("Observação do item (Tiny)") e na "Liberar unidades". Card sem observação idêntico; texto longo em 2 linhas com reticências. Mudar só a observação no Tiny muda o card ao vivo e **não reabre o PCP**.
- **O 13871 já foi entregue (11/11 17:19)** — o card dele não está mais em nenhum quadro; a capa dele recebe "adicionar rodízios" (conferido no banco no ar) e as fotos abaixo mostram como fica. Hoje não há nenhuma peça em produção com observação; a próxima venda com observação aparece sozinha.
- **A Expedição ficou sem a faixa** (ela não desenha card de unidade — D-317).

### Bloco C — editar a parada avulsa e o endereço do pedido (D-319…D-324)
- **Parada avulsa:** "Editar" (Programar, Já programadas, balão do mapa, Entregas do dia) abre o mesmo formulário, preenchido; só a pendente; o registro guarda antes e depois.
- **Endereço do pedido:** "Editar endereço" (Rotas, mapa, Entregas do dia, ficha) com o pino; ao salvar, **de/para + "Deseja salvar também no Tiny?"**; o original do Tiny guardado no fato e **"Voltar ao endereço original"**; o novo vale em todo lugar (rota, mapa, Google Maps/Waze do entregador, ficha); o selo "Endereço alterado na plataforma" + "No Tiny: …". O Tiny mudando por fora vence e avisa.
- **"Salvar na plataforma e no Tiny" desligado** com o porquê (D-320).

### Fotos (vitrine — as telas de verdade com dados de exemplo)
| | |
|---|---|
| ![[imagens/sessao50-13871-computador.png]] | O card do 13871 com "adicionar rodízios" no quadro (computador) |
| ![[imagens/sessao50-13871-tablet.jpg]] | … no tablet |
| ![[imagens/sessao50-13871-celular.jpg]] | … no celular |
| ![[imagens/sessao50-13871-janela-celular.jpg]] | A janela do card com a seção "Observação do item (Tiny)" |
| ![[imagens/sessao50-pcp-computador.png]] | O PCP com os dois botões em cada pedido (sem o 13622) |
| ![[imagens/sessao50-pcp-celular.jpg]] | … no celular |
| ![[imagens/sessao50-cancelar-celular.jpg]] | O modal "Cancelar pedido" |
| ![[imagens/sessao50-ocultar-computador.png]] | O modal "Ocultar do PCP" com a pergunta das peças |
| ![[imagens/sessao50-cancelados-celular.jpg]] | A aba "Cancelados" (plataforma, Tiny, excluído) |
| ![[imagens/sessao50-ocultos-celular.jpg]] | A aba "Pedidos ocultos" |
| ![[imagens/sessao50-recuperar-celular.jpg]] | Recuperar: "volta ao PCP com 3 produtos para liberar" |
| ![[imagens/sessao50-incluir-celular.jpg]] | "Incluir pedido no PCP" com o oculto antigo |
| ![[imagens/sessao50-liberar-sem-cancelado-celular.jpg]] | "Liberar unidades": as colunas da LIMPEZA sem CANCELADO e NÃO ENCONTRADO, e a faixa da observação |
| ![[imagens/sessao50-aviso-laco-celular-2.jpg]] | "O que aconteceu?" com o laço e os três caminhos |
| ![[imagens/sessao50-janela-pedido-celular.jpg]] | A janela do card do pedido com "Ocultar do PCP" e "Cancelar pedido" |
| ![[imagens/sessao50-editar-parada-celular.jpg]] | Editar a parada avulsa |
| ![[imagens/sessao50-editar-endereco-computador.png]] | Editar o endereço do pedido (com o pino) |
| ![[imagens/sessao50-endereco-pergunta-tiny-celular.jpg]] | A pergunta "Deseja salvar também no Tiny?" (o botão do Tiny desligado, com o porquê) |
| ![[imagens/sessao50-rotas-endereco-alterado-celular.jpg]] | O cartão da rota com o selo e o endereço do Tiny ao lado |

## 3. Como testar (roteiro do dono — no site)

1. **PCP → "Pedidos aguardando liberação":** o 13622 não aparece; o 13270 aparece, com "Ocultar do PCP" e "Cancelar pedido" embaixo de "Continuar liberação".
2. **PCP → aba "Cancelados":** o 13622 com a pílula "Excluído no Tiny".
3. **Ocultar:** num pedido de teste (ou no 13270, se for a decisão), "Ocultar do PCP" → a janela pergunta das peças já liberadas (quantas e onde) → "Ocultar o pedido e as peças" ou "Ocultar só o pedido" → ele some do quadro e aparece em **"Pedidos ocultos"**.
4. **Recuperar:** em "Pedidos ocultos", "Recuperar" → a janela diz com quantos produtos ele volta → ele volta a "Aguardando liberação" com as vagas abertas (as peças ocultadas não voltam para a coluna).
5. **"Incluir pedido no PCP"** (botão amarelo no topo): busque o número do oculto — ele aparece em "Ocultos do PCP" com "Oculto em dd/mm".
6. **Cancelar** (⚠️ cancela de verdade no Tiny — só num pedido que deve ser cancelado): "Cancelar pedido" → "Cancelar no Tiny e aqui" → o pedido vai para "Cancelados" na hora; em alguns minutos o Tiny passa a "Cancelado" (o selo "Confirmado no Tiny" aparece na linha). Se o Tiny recusar, aparece o aviso e "Tentar de novo".
7. **Liberar unidades:** escolha a LIMPEZA E EMBALAGEM como destino — a lista de colunas não tem CANCELADO nem NÃO ENCONTRADO.
8. **Observação do item:** a próxima venda com observação no produto mostra a faixa no card (quadro, tablet, celular), na janela do card e na "Liberar unidades". O 13871 já foi entregue (o card dele saiu dos quadros em 11/11); a capa dele recebe "adicionar rodízios" (conferido no banco).
9. **Rotas → Programação:** "Editar" numa parada avulsa pendente; "Editar endereço" num pedido → mude o número → "Salvar o endereço" → a pergunta do Tiny → "Salvar só na plataforma" → o cartão mostra o selo e "No Tiny: …"; "Voltar ao endereço original" desfaz.

## 4. Verificação

- **Bateria do banco (as três partes juntas):** 1.791 ✔ e 2 ✘ — os dois vermelhos de sempre, de ninguém: o do Dashboard ("as 7 portas novas = as antigas em 8 períodos") e o de ponta a ponta do fluxo do n8n que só falha entre 03:10 e 04:40 (E-266). Blocos novos: B (o excluído, cancelar, ocultar, recuperar, incluir paginado, a liberação e o laço), A (12 conferências), C (45).
- **vitest** 108 arquivos / 702 testes ✔ · **tsc** (`-b --force`) 0 erro · **lint** 492 arquivos, 0 erro, 0 aviso (prova: um erro de propósito é pego) · **montagem** ✔.
- **No ar (só leitura no banco, como o dono):** o 13622 fora do quadro e em "Cancelados" (excluído); o 13270 no quadro; 376 observações guardadas em 325 pedidos; a capa do card do 13871 recebe "adicionar rodízios".
- **Telas:** 375, 768 e 1440 sem rolagem lateral em todas as telas novas (vitrine, `scrollWidth = innerWidth`); dois ajustes vistos na vitrine e corrigidos antes de subir (os três botões do "Ocultar" quebravam no tablet; o "Cancelar pedido" da janela quebrava no celular).

## 5. Desempenho (Lei — checklist)

- Nenhuma tela ganhou requisição na abertura; modais e abas leem só no clique; nada de relógio novo (o cancelamento sai pela fila de saída que já existia; os 30 dias são filtro na leitura).
- Ensaio ×100 dos três blocos: ver o andamento da SESSAO-50 na [[PLT - Lei de Desempenho e Escala]] (o "Incluir pedido no PCP" de 131 s para 16–20 ms; o resto igual ou melhor; nenhuma dívida nova).
- JS inicial igual ao que estava no ar (238,2 × 237,8 KiB na mesma régua; teto 250).

## 6. Pendências que precisam do dono

1. **O 13270:** decidir pelo botão — "Cancelar pedido" (cancela também no Tiny) ou "Ocultar do PCP".
2. **"Salvar o endereço também no Tiny":** se quiser ligar, combinar uma hora com o pedido de teste (D-320 tem o caminho: a automação lê e regrava o pedido inteiro; a fila precisa de uma linha por motivo).
3. **As provisórias** (D-308…D-310, D-313, D-314, D-316…D-318, D-320…D-324) — confirmar ou mudar; em especial: os 30 dias mudados na própria aba (D-310), o "Incluir" só com pedidos vivos no Tiny (D-313), a Expedição sem a faixa da observação (D-317) e o selo em "Já programadas" só na janela (D-324).
4. **ClickUp:** as 4 tarefas foram criadas em "fazendo" na lista PRODUÇÃO do DPTO TI, com o comentário do que foi entregue — concluir depois de conferir.
5. **Cancelar de verdade:** a automação do Tiny passou a aceitar "cancelado" nesta madrugada; o primeiro cancelamento real confirma o caminho inteiro (o selo "Confirmado no Tiny" na aba "Cancelados").

## 7. Notas do cofre atualizadas

[[PLT - Decisoes de Produto]] (D-307…D-324; D-140, D-299 e D-300 marcadas como revisadas) · [[PLT - Memoria de Aprendizado]] (E-270…E-286, A-223…A-235) · [[PLT - Lei de Desempenho e Escala]] (andamento) · [[SUPA - Esquema do Banco]] · [[PLT - Modelo de Sistema]] · [[000 - ORDEM DAS SESSOES]] · [[000 - MAPA DO PROJETO]] · a demanda (Resultado e Tarefas no ClickUp).
