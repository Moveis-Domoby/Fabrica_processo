---
titulo: "SESSAO-50 — Observação do item na capa do card, Cancelar e Ocultar pedido no PCP (com o excluído no Tiny saindo de vez) e editar o endereço de uma parada da rota"
tipo: demanda
status: 📐 pronta para code
data: 2026-11-12
atualizado: 2026-11-12 (01:25 — respostas do dono: o outro caso é o 13270; botões Cancelar e Ocultar no PCP; editar endereço de verdade + pino; pergunta ao salvar e o endereço do Tiny guardado · 01:30 — a pergunta é "salvar também no Tiny?"; peças ocultadas, ao recuperar, voltam como vagas no PCP, não para a coluna)
origem: pedidos do dono de 12/11 (01:10) + vídeo de 11/11 (11:01, pedido 13871). Investigado no Cowork com leitura do banco de produção (12/11, ~01:30) e da documentação da API do Tiny (v2 e v3). Só leitura: nada foi alterado. O código do front não foi lido (sem acesso ao repositório): os caminhos de tela são "a conferir".
revisa: ↩️ a frente 2 da SESSAO-48 — o "Remover do PCP" com três motivos vira o **Ocultar** (e o "Cancelados e removidos" se divide em "Cancelados" e "Pedidos ocultos"). ↪️ usa a fila de saída do Tiny (SESSAO-47), a frente 3 da 48 (destino das peças de pedido cancelado), a D-132, a SESSAO-44 (itens por código) e a SESSAO-41 (paradas avulsas).
tags: [plataforma, demanda, kanban, tiny, pcp, rotas, logistica]
---

# 🎯 SESSAO-50 — Observação do item, Cancelar/Ocultar no PCP e editar o endereço da parada

> **Número:** a 49 (dieta da documentação) já existe. Confira na `000 - ORDEM DAS SESSOES`; se 50 estiver usado, pegue o próximo e corrija o título.
> **Primeiro passo:** esta demanda já está em `_docs/Plataforma/Demandas/` e linkada na Ordem das Sessões. Só confira.
> **Se a SESSAO-49 já estiver na main**, use a rota de leitura nova (seção "Leitura da sessão"). Se não, siga o CLAUDE.md de hoje.
> **Três blocos independentes** (A, B, C), um commit por frente. Se o tempo apertar, a ordem é **B → A → C**.

## O pedido do dono (texto fiel, 12/11)

1. *"Observações que forem adicionadas DENTRO do produto aparecerem na capa do card, analise o vídeo em anexo para entender mais o que estamos querendo falar, o layout do card para esses casos deve ainda continuar organizado e correto."*
2. *"Pedido excluído no tiny há muito tempo mas do nada apareceu no PCP para liberar, o pedido é o 13622, mas tem outros 2 casos la tambem junto a ele."*
3. *"Possibilidade de editar o local de uma parada avulsa ou pedido comum, pois atualmente é necessario excluir a parada avulsa e criar outra, ao inves de apenas editar ela."*

**Respostas do dono (12/11 — fechadas, não perguntar de novo):**
- **Bloco B (01:25):** *"É o 13270 mesmo, mas vamos fazer o seguinte: dentro de PCP a partir de agora tem um botão também de cancelar/ocultar pedido. Se clicar em cancelar, ele cancela no Tiny, porém no momento que clicar aparece um modal pequeno com design próprio perguntando se quer cancelar mesmo e informando que cancelar ali cancela no Tiny também. O ocultar apenas remove ele por completo da lista do PCP, perguntando se ele deseja ocultar também os cards já liberados para produção, caso tenha algum. O ocultar apenas remove ele de PCP, podendo recuperar ele dentro de uma lista de 'Pedidos ocultos', que se apaga depois que o card ficar lá por 1 mês, e o único jeito de recuperar é pelo incluir pedido no PCP, botão que já existe atualmente, que só funciona para pedidos antigos."*
- **Bloco B (01:30):** sobre as peças ocultadas junto com o pedido, ao recuperar, *"voltam todas para PCP, não para a coluna onde estavam."*
- **Bloco C (01:25):** *"Editar endereço de entrega mesmo e corrigindo no pino no mapa."* · *"Quando ele editar, deve gerar uma pergunta, mas o endereço original que veio do Tiny ainda continua no banco como log para recuperar caso necessário."*
- **Bloco C (01:30):** *"A pergunta é se ele deseja salvar também no Tiny."*

---

# BLOCO A · A observação do item na capa do card

## O vídeo (11/11, 11:01)
- O dono mostra a impressão do **pedido 13871** no Tiny: 1 × **Estante Basic 10 nichos – Branca (SKU 420)**. Logo abaixo do nome, a observação do item: **"adicionar rodízios"**. A observação geral do pedido é outra: "Cliente vai pagar na entrega.".
- O mesmo card na MONTAGEM (MONTANDO, Franklin, 42 min) não mostra os rodízios na capa. Dentro do card, Etiquetas está "Nenhuma" e Descrição está "Sem descrição".
- **A informação não existe na plataforma:** o montador só sabe se olhar o papel.

## O que o banco mostra
- A observação chega em `pedidos.raw → itens[].item.info_adicional`. No 13871: `"adicionar rodízios "`, com espaço no fim.
- **`pedido_itens` não guarda esse campo** (pedido_id, seq, id_produto, codigo, descricao, unidade, quantidade, valor_unitario). A observação se perde.
- **Volume:** 376 itens em 325 pedidos têm observação; 21 deles nos últimos 30 dias. Mediana de **33** caracteres; a maior tem **162**.
- **Exemplos:** "adicionar rodízios" · "COM RODINHAS" · "FECHADURA NA PRIMEIRA GAVETA" · "Adicionar uma prateleira removível no vão superior". As longas são de sob medida (medidas, cor, "cliente não quer rodinhas…").

## Frente 1 · Guardar a observação do item
- Coluna nova **`pedido_itens.info_adicional`**, com o texto limpo: sem espaço nas pontas, espaços repetidos viram um, vazio = nulo.
- Todo caminho que grava `pedido_itens` (webhook, conferência da madrugada, backfill) passa a preencher a coluna.
- **Backfill dos 376 itens** a partir de `pedidos.raw`, com contagem antes/depois, **só com o OK do dono**.
- **A observação mudou no Tiny:** o card mostra a nova ao vivo, pelo aviso que o setor já usa. Confira que a reação da **SESSAO-44** não trata uma mudança só de observação como "item novo" (isso não pode reabrir o PCP).
- **Mesmo produto duas vezes com observações diferentes** (2 estantes, só uma com rodízios): cada unidade mostra a **do seu item**, pelo casamento da SESSAO-44. Teste esse caso.

## Frente 2 · Onde aparece
A observação vale para **todas as unidades do item** e aparece em três lugares:
1. **Na capa do card de unidade**, nos quadros de todos os setores (Expedição inclusive) e no card do tablet.
2. **Na janela do card**, numa seção **"Observação do item (Tiny)"** perto de Datas, com o texto inteiro.
3. **No PCP**, na linha do item e na janela **"Liberar unidades"**.

**Não entra:** a observação geral e a interna do pedido, porque não são do móvel.

## O layout da capa (continua organizado)
Ordem na capa:
1. cabeçalho de hoje (Pedido N · data · k/n · menu);
2. nome do móvel (as 2 linhas de hoje);
3. **a faixa da observação**, só quando ela existe:
   - ícone de nota + o texto, com ~12 px;
   - fundo âmbar bem suave com filete à esquerda. É instrução, não alerta: nada de vermelho;
   - **no máximo 2 linhas**, com reticências. A largura do card não muda e nunca há rolagem lateral;
   - o texto inteiro aparece ao passar o mouse e na janela do card. O leitor de tela lê "Observação do item: …";
   - **cor + texto** (M-12);
4. tempo/pausa, responsável e botões, como hoje.

**Regras:**
- Card **sem** observação fica **idêntico** ao de hoje: nenhum espaço reservado.
- Pausado, observação e etiquetas juntos cabem sem sobrepor. Confira em 375, 768 e desktop, nas colunas estreitas.
- Use os tokens e componentes que já existem. Nada de cor nova solta.
- **Lei de desempenho:** a observação vem **na mesma porta** do quadro, do tablet e do PCP — um campo a mais, lido de `pedido_itens`, nunca do `raw`. Nenhuma requisição nova.

---

# BLOCO B · Cancelar e Ocultar pedido no PCP (e o excluído no Tiny saindo de vez)

## A linha do tempo do 13622 (banco de produção, horário de Brasília)

| Quando | Fato |
|---|---|
| 08/10 15:08 | Chegou do Tiny (conta **loja**), "Em aberto", 31 peças. |
| 08/10 21:39 em diante | A conferência com o Tiny recebe **"código 32: Pedido não localizado"**: o pedido foi **excluído no Tiny**. |
| 16/10 03:22 | A plataforma **registrou** a exclusão: o 13622 está em **`plt_pedidos_excluidos_tiny`** (detectado em 16/10, conferido de novo em 11/11). Essa lista já esconde o pedido de 11 leituras (Todos os pedidos, lista de pedidos, Rotas, Comercial, vendas, reservas da loja…). **Mas não do PCP.** |
| 19/10 19:24 | Sem ter como tirar o pedido do PCP, Guilherme liberou as 31 peças **direto na coluna CANCELADO**. |
| 11/11 05:13 | O **acerto da SESSAO-48** cancelou as 30 peças paradas. A regra do PCP não olha a lista de excluídos, então o pedido parecia vivo e **as vagas voltaram ao PCP com o aviso**. **É por isso que ele "apareceu do nada".** |
| 11/11 07:43 e 07:50 | Guilherme liberou de novo, primeiro direto no CANCELADO e depois no A LIMPAR, e arrastou tudo para o CANCELADO. A cada vez, as vagas voltaram. |
| Agora | **91 peças canceladas, 0 vivas, 31 vagas abertas, aviso aceso.** |

**O 13270** (o outro caso que o dono confirmou) é diferente:
- **ele existe no Tiny** ("Preparando envio", conferido em 11/11); chegou em 01/09 e tem 5 de 7 peças sem liberar;
- não está excluído. Ele precisa do botão que o dono pediu (Cancelar ou Ocultar), e quem decide é o PCP, pela tela nova;
- **nenhum acerto automático no 13270.**

## A causa
1. **A regra do PCP ignora a lista de excluídos no Tiny, que já existe.** Nenhuma destas peças consulta `plt_pedidos_excluidos_tiny`: `plt_privado.fn_fora_do_pcp`, `plt_fn_pcp_quadro`, `plt_fn_cards_pedido_pcp`, `plt_fn_dash_pcp_dia`, o aviso da 48 e o acerto da 48.
2. **O PCP deixa liberar direto numa coluna que cancela.** Desde a 48, isso vira laço: liberar → cancela → a vaga volta.
3. **Não há um gesto claro no PCP** para dizer "este pedido não vai ser produzido". O "Remover do PCP" da 48 só aparece dentro do aviso.

## Frente 3 · O excluído no Tiny sai do PCP de vez
- **Uma regra só (D-75):** a regra de "fora do PCP" (`fn_fora_do_pcp` e quem a chama) passa a considerar **"está em `plt_pedidos_excluidos_tiny`"**. Todas as portas do PCP, o aviso da 48 e os totais seguem essa regra.
- **Excluído = mesmo caminho de cancelado no Tiny:**
  - peça em produção segue a **frente 3 da 48** ("esperando decisão" → "Para onde vai este móvel?");
  - peça pronta vai ao ESTOQUE sem dono;
  - o pedido aparece na aba **"Cancelados"** com o rótulo **"Excluído no Tiny"**.
- **A entrada na lista vira fato:** quando `plt_privado.fn_pedidos_excluidos_aplicar` põe um pedido na lista, grava `pedido_excluido_tiny` no card do pedido, com log e aviso no sino para logística e admin: *"O pedido 13622 não existe mais no Tiny (foi excluído). Ele saiu do PCP."*
- **Pedido reencontrado:** confira se `fn_pedidos_excluidos_aplicar` tira da lista o pedido que o Tiny voltar a achar. Se não tirar, faça tirar, com o fato `pedido_reencontrado_tiny`.
- **Confira como a exclusão é detectada:** um "não localizado" na conta errada (fábrica × loja) não pode marcar o pedido. Se a detecção não olhar as duas contas, corrija.
- **Sem relógio novo:** tudo continua na conferência da madrugada que já existe.

## Frente 4 · Os botões **Cancelar** e **Ocultar** no PCP (↩️ revisa a frente 2 da 48)
- **Onde:** em **todo pedido do PCP** (quadro, aba Stand-by e a janela do pedido), um menu ou dois botões: **"Cancelar pedido"** e **"Ocultar do PCP"**.
- **Na janela do aviso da 48** ("O que aconteceu?"), as saídas passam a ser **"Produzir de novo"**, **"Cancelar pedido"** e **"Ocultar do PCP"**.
- **O fim do "Remover do PCP":** o botão com três motivos deixa de existir. A máquina dele (`plt_fn_pcp_remover`, `removido_pcp_*`, `plt_fn_pcp_devolver`) é **reaproveitada para o Ocultar**.

**Quem usa:** a permissão de hoje do PCP (`fn_pode_ver_expedicao`: PCP, logística e admin).

**Os modais:** pequenos, com **design próprio da plataforma** — o componente de modal do sistema, nada de `confirm()` do navegador. Funcionam bem em 375 e 768, com botões de toque.

### Cancelar pedido
- **O modal:** *"Cancelar o pedido 13270? Isso cancela o pedido **também no Tiny**, e não dá para desfazer pela plataforma."* Botões: **"Cancelar no Tiny e aqui"** (destrutivo) e **"Voltar"**.
- **Num toque, uma chamada, idempotente (com chave):**
  1. pede a situação **`cancelado`** ao Tiny pela **fila de saída que já existe** (SESSAO-47). Amplie o check de motivo de `plt_tiny_pedido_fila` e use `fn_tiny_situacao_api`, que já traduz "cancelado" para a API v2;
  2. o pedido **sai do PCP na hora**, sem esperar o Tiny, com o fato `pedido_cancelado_plataforma` (com autor) e a projeção no card do pedido;
  3. as peças em produção entram na **frente 3 da 48** ("Para onde vai este móvel?"), e as prontas vão ao ESTOQUE sem dono, como num cancelamento do Tiny;
  4. log (D-40), Auditoria e sino.
- **O Tiny confirmou:** segue o caminho normal de cancelado. A marca da plataforma fica como trilha.
- **O Tiny recusou ou não respondeu** *(provisória)*:
  - o pedido **continua fora do PCP**, na aba Cancelados;
  - o card mostra o aviso *"O Tiny ainda não confirmou o cancelamento"* e o botão **"Tentar de novo"**;
  - o alerta sai pela porta que já existe.
- **Ida ao Tiny desligada** (a chave da ROTAS): o botão fica desabilitado, com a explicação.
- **Cuidado com a fila:** ela guarda **uma linha por pedido, e vale a última vontade** (SESSAO-47). Confira a interação com um "Entregue" ou um "desfeita" pendente.

### Ocultar do PCP
- **O modal:** *"Ocultar o pedido 13270 do PCP? Ele some da lista do PCP e fica em **Pedidos ocultos** por 30 dias. O Tiny não muda."*
- **Se o pedido tem peças já liberadas**, o modal pergunta: *"Este pedido tem 2 peças já liberadas (1 em A LIMPAR, 1 em PEDIDOS EM AGUARDO). Ocultar também essas peças?"*
  - Botões: **"Ocultar só o pedido"** e **"Ocultar o pedido e as peças"**.
  - A contagem é lida **ao abrir o modal**, numa requisição (`fn_pcp_pecas_do_pedido` já devolve isso).
- **Ocultar o pedido:** `plt_fn_pcp_remover` com o motivo **`oculto`**, no lugar dos três motivos antigos. O pedido sai de todas as portas do PCP (D-75).
- **"Ocultar só o pedido":** as peças já liberadas **seguem na produção** como estão, ainda do pedido.
- **"Ocultar o pedido e as peças":**
  - cada peça recebe o fato `card_oculto` (com o pedido e o motivo "pedido ocultado no PCP"), **perde o pedido** (`unidade_desvinculada`) e é **arquivada com registro**;
  - ela sai do quadro, das contas de produção, do Estoque/Top 20, dos contadores e dos painéis, pela **mesma regra única** que tira a peça cancelada na 48 (`fn_estoque_categoria`);
  - nada é apagado: o admin acha a peça na busca geral e na Auditoria, com o motivo;
  - **peça já programada numa rota ou entregue não é ocultada** *(provisória)*: o modal avisa quantas ficaram e onde;
  - as reservas de estoque do pedido são soltas *(provisória)*.
- **"Pedidos ocultos"** (aba no PCP, no lugar do "removidos" do "Cancelados e removidos"):
  - mostra os ocultos **dos últimos 30 dias**: número, cliente, quem ocultou, quando e quantas peças foram junto;
  - é um **filtro na leitura** (`removido_pcp_em ≥ agora − 30 dias`, com índice), no padrão dos 7 dias da 48. **Sem relógio e sem apagar nada**: depois de 30 dias, o pedido só some da lista;
  - os 30 dias ficam numa configuração (Configurações → Controle do quadro, padrão 30), sem número escrito no código.
- **"Recuperar" — tudo volta como vaga no PCP (resposta do dono, 01:30):**
  - devolve o pedido ao PCP (`plt_fn_pcp_devolver`);
  - **as peças ocultadas junto não voltam para a coluna onde estavam.** Elas continuam arquivadas, e **as vagas delas reabrem no PCP**. A liberação é a de sempre: a janela "Liberar unidades", com as sugestões de estoque e de peça em produção. A conta do PCP já faz isso sozinha, porque peça oculta não é unidade viva do pedido;
  - o resto é reavaliado pelas regras de sempre (D-132, reservas de estoque);
  - a janela de recuperar diz, por exemplo: *"O pedido 13270 volta ao PCP com 7 produtos para liberar."*
- **Depois de 30 dias, o único caminho é "Incluir pedido no PCP"**, o botão que já existe e hoje só funciona para pedidos antigos:
  - ache o botão no front e a porta dele (a lista é `plt_fn_pcp_todos_pedidos`, que já devolve `situacao_plataforma`);
  - passe a aceitar **pedido oculto de qualquer idade**. A lista mostra "Oculto em dd/mm", e incluir faz a mesma recuperação, com as mesmas regras;
  - pedido **excluído no Tiny** continua fora (a lista já o esconde).
- **A aba "Cancelados"** fica só com os cancelados: os do Tiny, os cancelados pela plataforma e os excluídos no Tiny, cada um com o seu rótulo.

## Frente 5 · O PCP não libera direto numa coluna que cancela
- Na janela **"Liberar unidades"**, as etapas com `cancela_fabricacao` (CANCELADO e NÃO ENCONTRADO) **não aparecem como destino**, e **o banco recusa** se alguém tentar por outro caminho.
- No lugar, uma linha: *"Este pedido não vai ser produzido? Use **Cancelar pedido** ou **Ocultar do PCP**."*
- Arrastar uma peça **já liberada** para o CANCELADO continua valendo (é o gesto da 48).
- **Laço** *(provisória)*: se o pedido teve **3 ou mais peças canceladas em 24 h**, o aviso do PCP diz *"As peças deste pedido estão sendo canceladas várias vezes. Se ele não vai ser produzido, cancele ou oculte o pedido."*, com os dois botões.

## O que acontece com os casos de hoje
- **13622:**
  - sai do PCP **sozinho** pela frente 3, porque já está na lista de excluídos, e o aviso apaga;
  - as 91 peças canceladas ficam como estão e somem da coluna pelos 7 dias da 48;
  - **nenhuma manutenção de dado**: só confira depois de publicar. Se algo ficar para trás, um acerto em `supabase/manutencao/`, **só com o OK do dono**.
- **13270:** fica no PCP. O dono (ou o PCP) decide pelo botão novo.
- Depois de publicar: recontar o estoque (`fn_estoque_numeros_recontar`) e conferir o PCP.

---

# BLOCO C · Editar o endereço de uma parada da rota

## O que existe hoje (banco)
- **Parada avulsa:** fica em `plt_paradas_avulsas` (título, endereço, lat/long, observação). A porta **`plt_fn_parada_avulsa_salvar` já sabe editar** (com `p_id`). Pode editar a logística, ou quem criou, enquanto a parada está pendente.
  - **Mas ninguém nunca editou:** o log tem 10 "criada", 5 "removida", 5 "feita" e **0 "editada"**. A tela não oferece editar (a conferir no código).
  - O log da edição grava só o id.
- **Pedido comum:** o endereço vem do Tiny (`plt_privado.vw_endereco_entrega`), e o ponto vem do cache por endereço (`plt_geocache`).
  - Já existe **marcar o ponto à mão** (`plt_fn_geo_marcar`, fonte `manual`, 7 usos, o último em 11/11). Ele vale para o endereço.
  - **Não existe trocar o endereço de entrega de um pedido.**

## Frente 6 · "Editar" na parada avulsa
- Botão **"Editar"** na parada avulsa em todo lugar onde ela aparece: Rotas, mapa da rota e Entregas do dia.
- Abre **o mesmo formulário de criar, já preenchido**: título, endereço com a busca de hoje, **pino arrastável no mapa** e observação. Salva pela porta que já existe (`p_id`).
- **Quem edita:** a regra do banco (logística, ou quem criou, enquanto pendente). Para os outros, o botão não aparece.
- **Log com antes e depois:** endereço, ponto, título e observação, antigos e novos.
- Parada feita ou não feita não edita *(provisória)*.
- Rota, mapa e Entregas do dia abertos mudam na hora (o aviso `rotas` já sai).
- Parada avulsa não existe no Tiny: aqui não há pergunta do Tiny.
- Trocar o dia ou o caminhão: fora desta sessão.

## Frente 7 · "Editar endereço" no pedido (endereço de verdade + pino)
Na parada do pedido (Rotas e mapa) e na ficha do pedido (seção de entrega), o botão **"Editar endereço"** abre:
- **o endereço de entrega editável** (rua, número, complemento, bairro, cidade, UF, CEP), preenchido com o atual e com a mesma busca do formulário da parada avulsa;
- **o mapa com o pino arrastável**, para corrigir o ponto. Mudar só o pino, sem mexer no texto, também vale. Nesse caso, use o `plt_fn_geo_marcar` que já existe, e não há pergunta do Tiny, porque o Tiny não guarda ponto.

**Ao salvar, a pergunta (resposta do dono, 01:30)** — modal próprio, pequeno:
> *"Trocar o endereço de entrega do pedido 13871?*
> *De:* Rua Jacarandá, 55 – Parnamirim/RN
> *Para:* (o novo)
> *Deseja salvar também no Tiny? O endereço original do Tiny fica guardado na plataforma, e você pode voltar a ele quando quiser."*
> **"Salvar na plataforma e no Tiny"** · **"Salvar só na plataforma"** · **"Voltar"**

**No banco (vale para os dois botões):**
- **Fato novo `endereco_entrega_alterado`** no card do pedido. Ele leva:
  - o **endereço original do Tiny, guardado por inteiro**, como chegou;
  - o endereço anterior, o novo e o ponto;
  - o autor, a hora e a escolha ("só plataforma" ou "também no Tiny").
- A projeção no card guarda o endereço vigente da plataforma.
- **Nada do Tiny é apagado nem editado na plataforma:** o fato é o log para recuperar.
- **Uma regra só:** `vw_endereco_entrega` prefere o endereço da plataforma quando ele existe. Assim, todos passam a ler o novo: Rotas, mapa, Entregas do dia, ficha, link do mapa do entregador, impressão da rota, candidatos à programação e filtros de cidade/bairro.
- **O ponto do endereço novo:** vem da busca de sempre ou do pino da tela, que entra no `plt_geocache` como `manual` para a chave do endereço novo.
- **Selo** discreto **"Endereço alterado na plataforma"**, com o original do Tiny visível ao lado.
- **"Voltar ao endereço original"** (fato `endereco_entrega_restaurado`) restaura o original, com a mesma pergunta do Tiny.
- **Quem usa:** logística e admin (a mesma permissão de marcar o ponto).
- Log (D-40) e Auditoria em português.
- **Pedido já entregue:** só o admin edita *(provisória)*.

**"Salvar na plataforma e no Tiny" — atenção ao limite da API do Tiny (documentação lida em 12/11):**
- **API v3** (`PUT /pedidos/{id}`, "Atualizar pedido"): **não aceita endereço de entrega**. Os campos aceitos são `dataPrevista`, `dataEnvio`, `observacoes`, `observacoesInternas`, `pagamento`, `pagamentosIntegrados` e `naturezaOperacao`.
- **API v2** (`pedido.alterar.php`, "Alterar pedido"):
  - **só funciona para pedido "Em aberto" ou "Aprovado"**;
  - **substitui o pedido inteiro** pelo XML enviado (a mesma estrutura da inclusão). Se o envio for incompleto, apaga dados do pedido no Tiny.
- **Antes de construir o botão, prove o caminho:**
  1. confira na documentação atual se há outro caminho para mudar o endereço;
  2. se o único for o v2: **leia o pedido completo do Tiny na hora**, troque **só** o endereço de entrega e devolva o resto **idêntico** (itens, valores, parcelas, marcadores, observações, vendedor…);
  3. **teste num pedido de teste, com o OK do dono, antes de ligar para todos.** Compare o pedido no Tiny antes e depois, campo a campo.
- **Como sai:**
  - pela **fila de saída do Tiny** que já existe, com um motivo novo (`endereco`), idempotente;
  - a plataforma já usa o endereço novo na hora, sem esperar o Tiny;
  - se o Tiny confirmar, grava o fato `endereco_entrega_tiny_confirmado`, e o selo muda para "Endereço alterado (salvo também no Tiny)";
  - se o Tiny recusar, aparece o aviso *"O Tiny não aceitou o endereço novo — ele continua só na plataforma"* e o botão "Tentar de novo".
- **Quando o Tiny não deixa** — situação fora de Em aberto/Aprovado (a maioria dos pedidos na fábrica está em "Preparando envio"), ida ao Tiny desligada, ou caminho não provado no teste:
  - o botão **"Salvar na plataforma e no Tiny"** aparece **desabilitado**, com o porquê em uma linha. Exemplo: *"O Tiny só deixa alterar o endereço de pedido Em aberto ou Aprovado."*;
  - **"Salvar só na plataforma"** continua funcionando.
- **A nossa própria escrita voltando pelo webhook** não conta como "o Tiny mudou o endereço": compare com o endereço pedido.
- **O Tiny mudou o endereço por fora** *(provisória, D-132)*:
  - o do Tiny passa a valer, e a marca da plataforma sai com um fato;
  - o sino avisa a logística: *"O endereço do pedido N mudou no Tiny; o endereço alterado na plataforma deixou de valer."*;
  - o original continua no log.

---

## Fora do escopo
- Observação geral e interna do pedido na capa.
- "Descancelar" pedido pela plataforma.
- Mexer no fluxo do n8n. Se o cancelamento ou o endereço pela fila precisar de mudança lá, pare e peça o OK (regra 3).
- Apagar pedido, peça ou parada do banco: nunca. Tudo é arquivado, oculto ou marcado com fato.
- Trocar o dia ou o caminhão de uma parada avulsa.

## Critérios de aceite

**Bloco A**
- [ ] O 13871 mostra "adicionar rodízios" na capa (quadro, tablet, celular), na janela do card e no PCP.
- [ ] Card sem observação continua idêntico. Com 162 caracteres, fica em 2 linhas com reticências, sem rolagem lateral em 375/768 e sem desalinhar a coluna.
- [ ] Mudar a observação no Tiny muda o card ao vivo e não reabre o PCP.
- [ ] Dois itens do mesmo produto com observações diferentes: cada unidade mostra a sua.
- [ ] Backfill dos 376 itens com contagem antes/depois.

**Bloco B**
- [ ] O 13622 some do PCP sem acerto. Pedido da lista de excluídos aparece em "Cancelados" como "Excluído no Tiny", e o sino avisa.
- [ ] **Cancelar:**
  - o modal próprio avisa que cancela no Tiny;
  - o pedido sai do PCP na hora, e o Tiny passa a "Cancelado";
  - as peças em produção perguntam o destino;
  - com o Tiny falhando, aparecem o aviso e o "Tentar de novo";
  - toque repetido produz um efeito só.
- [ ] **Ocultar:**
  - sem peças, oculta direto; com peças, pergunta e mostra quantas e onde;
  - "Ocultar o pedido e as peças" tira as peças do quadro e das contas;
  - o pedido aparece em "Pedidos ocultos".
- [ ] **Recuperar:**
  - dentro de 30 dias, devolve o pedido ao PCP com **todas** as vagas das peças ocultadas abertas para liberar; nenhuma peça volta para coluna;
  - depois de 30 dias, o pedido some da lista, e "Incluir pedido no PCP" o traz de volta, de qualquer idade.
- [ ] "Liberar unidades" não oferece CANCELADO nem NÃO ENCONTRADO, e o banco recusa. A linha leva aos botões novos.
- [ ] O aviso de laço aparece com 3 ou mais cancelamentos em 24 h.

**Bloco C**
- [ ] A parada avulsa pendente edita endereço, pino, título e observação sem apagar. O log grava antes e depois, e a rota aberta muda na hora.
- [ ] Editar o endereço do pedido mostra de/para e pergunta se salva também no Tiny. O fato guarda o original do Tiny, e o novo aparece em Rotas, mapa, Entregas do dia, ficha e link do entregador.
- [ ] **"Salvar na plataforma e no Tiny":**
  - provado num pedido de teste com o OK do dono (pedido no Tiny idêntico, fora o endereço);
  - desabilitado com o porquê quando o Tiny não deixa;
  - se o Tiny falhar, mostra o aviso e "Tentar de novo".
- [ ] "Voltar ao endereço original" restaura, e mexer só no pino também funciona.
- [ ] Mudança de endereço feita por fora no Tiny vence e avisa. A nossa própria escrita não dispara esse aviso.

**Geral**
- [ ] Celular (375) e tablet (768) sem rolagem lateral; botões com tamanho de toque; modais próprios do sistema.
- [ ] Bateria do banco (regra da casa), tsc, lint, vitest, build e advisors sem nada novo.
- [ ] Lei de desempenho: cada tela em 1 requisição, modais leem só ao abrir, sem relógio novo. O plano ×100 das portas tocadas vai no handoff.

## Notas para o Claude Code
- Recrie toda função a partir da **versão viva** do banco, conferindo o corpo (A-96/A-97). Tipos novos de evento entram no `plt_eventos_tipo_check` (E-19).
- **Onde mora (banco, conferido em 12/11):**
  - **A:** `pedido_itens` e quem grava nela, `pedidos.raw → itens[].item.info_adicional`, as portas do quadro, do tablet e do PCP (`plt_fn_pcp_quadro`, `plt_fn_cards_pedido_pcp`, `plt_fn_pcp_liberacao`) e a reação da SESSAO-44.
  - **B — excluídos:**
    - a lista: `plt_pedidos_excluidos_tiny` (pedido_id, tiny_id, numero, erro, detectado_em, conferido_em; hoje só o 13622), com `plt_privado.fn_pedidos_excluidos_aplicar` e `fn_tiny_aqui`;
    - já respeitam a lista: `plt_fn_pcp_todos_pedidos`, `plt_fn_pedidos_lista`, `plt_fn_rotas`, `plt_fn_pedido_tiny`, `plt_fn_vinculo_buscar`, `plt_fn_tiny_reservas_presas` e as de vendas/estoque;
    - **não respeitam:** `fn_fora_do_pcp` e as portas do PCP.
  - **B — PCP:**
    - portas: `plt_fn_pcp_remover` (motivos `pedido_cancelado|fora_da_linha|outro` → `oculto`), `plt_fn_pcp_devolver`, `plt_fn_pcp_aviso`, `plt_fn_pcp_aviso_resolver`, `fn_pcp_pecas_do_pedido`, `plt_fn_pedidos_cancelados`, `plt_fn_pcp_standby` e `plt_fn_pedido_voltar_pcp` / `fn_pedido_voltar_pcp` (SESSAO-47);
    - colunas de `plt_cards`: `removido_pcp_*`, `cancelada_*`, `pcp_aviso_em` e `destino_pendente_em`;
    - nenhum pedido usa `removido_pcp_em` hoje, então trocar os motivos não exige migrar dado.
  - **B/C — Tiny:**
    - fila de saída: `plt_tiny_pedido_fila` (check de motivo), `fn_tiny_pedido_enfileirar` (devolve `'desligado'`) e `fn_tiny_situacao_api`;
    - endereço: a v2 `pedido.alterar.php` só serve para aberto/aprovado e substitui tudo; a v3 `PUT /pedidos/{id}` não aceita endereço.
  - **C:**
    - paradas: `plt_fn_parada_avulsa_salvar` (já edita) e `plt_fn_paradas_avulsas`;
    - ponto e endereço: `plt_fn_geo_marcar`, `plt_geocache` (chave = md5 do endereço normalizado), `plt_privado.vw_endereco_entrega` e `fn_endereco_geocodificavel`;
    - rotas: `plt_fn_rotas_do_dia`, `plt_fn_programadas`, `plt_fn_programacao_candidatos` e `plt_fn_entregas_do_dia`.
- **Front (a conferir):**
  - cards: `src/kanban/componentes/CartaoUnidade.tsx`, a janela do card e o card do tablet;
  - PCP: `ModalLiberarPedido`, o quadro e as abas do PCP, a janela do aviso da 48 e o botão "Incluir pedido no PCP";
  - rotas: as telas de Rotas e de Entregas do dia e o formulário da parada avulsa.
- **Regra 2:** migration, backfill, qualquer acerto, **o teste de endereço no Tiny** e publicação só com o OK do dono, cada um em passo separado. Subida de código na main publica o site.
- **Decisões a registrar (D-NN, como nota nova se a 49 já entrou):**
  - Cancelar e Ocultar no PCP substituem o "Remover do PCP" (↩️ 48);
  - ocultados ficam 30 dias na lista e depois só voltam por "Incluir pedido no PCP";
  - peças ocultadas voltam como vagas no PCP, nunca para a coluna;
  - excluído no Tiny = cancelado, pela lista que já existe;
  - endereço alterado na plataforma, com o original do Tiny guardado e a pergunta "salvar também no Tiny?".
- **Provisórias a registrar:**
  - Tiny falhou no cancelamento → o pedido fica fora do PCP com "Tentar de novo";
  - peça em rota ou entregue não se oculta;
  - ocultar solta as reservas;
  - os 30 dias numa configuração;
  - a faixa âmbar de 2 linhas;
  - CANCELADO fora do "Liberar unidades";
  - aviso de laço com 3 cancelamentos em 24 h;
  - parada feita não edita;
  - "salvar no Tiny" desabilitado quando o Tiny não deixa;
  - mudança feita por fora no Tiny vence;
  - pedido entregue: só o admin edita o endereço.
- **Com o dono:** português de gente, sem códigos (regra 12c).

## Leitura da sessão
- CLAUDE.md da raiz e as Regras de Ouro (se a 49 já entrou);
- esta demanda;
- a SESSAO-48 (frentes 1–3) e a SESSAO-47 (bloco A, a fila de saída);
- as notas de banco de Integração Tiny, Cards e eventos, PCP e Logística/ROTAS;
- as lições de Tiny/n8n e de front;
- a SESSAO-41 (paradas avulsas) e a SESSAO-44 (itens por código), só as partes citadas.

## Tarefas no ClickUp (lista PRODUÇÃO do DPTO TI)
*A criar com o OK do dono:*
- "Produção - Observação do item do Tiny na capa do card"
- "PCP - Botões Cancelar (no Tiny) e Ocultar pedido, com Pedidos ocultos"
- "PCP - Pedido excluído no Tiny sai do PCP e fim do laço de liberar e cancelar"
- "Rotas - Editar parada avulsa e endereço de entrega do pedido (com opção de salvar no Tiny)"

## Resultado (preencher ao entregar)
*O que foi feito, o que mudou de rota, link do handoff da sessão.*

---

## Prompt para abrir no Claude Code (pasta "Domoby - fabrica")

```
Você é o engenheiro executor da Plataforma de Produção da Móveis Domoby. Atualize a main, siga a ordem de leitura do CLAUDE.md da raiz e execute a demanda "SESSAO-50 — Observação do item na capa do card, Cancelar e Ocultar pedido no PCP e editar o endereço de uma parada da rota" (já está em _docs/Plataforma/Demandas/ e linkada na Ordem das Sessões; confira se o número 50 está livre). Leia duas vezes — as respostas que dei em 12/11 (01:25 e 01:30) valem por cima do resto. Se a SESSAO-49 já estiver na main, use a rota de leitura nova e leia só o que a seção "Leitura da sessão" pede.

As respostas de negócio estão dentro da demanda: não me pergunte nada de negócio; o que faltar vira decisão provisória registrada. Ordem: bloco B, depois A, depois C. Branch nova a partir da main, um commit por frente, push a cada frente. Migration, backfill, qualquer acerto de dado, o teste de salvar endereço no Tiny e publicação só com o meu OK, cada um em passo separado — subida de código na main publica o site.

Ao terminar: o que foi feito, como testar passo a passo (com prints do card do 13871 com "adicionar rodízios" no quadro, no tablet e no celular; do PCP sem o 13622; dos modais de Cancelar e Ocultar, da lista de Pedidos ocultos e de um pedido recuperado com as vagas de volta; da janela "Liberar unidades" sem a coluna CANCELADO; e da edição de uma parada avulsa e do endereço de um pedido com a pergunta do Tiny), as pendências que precisam de mim e as decisões provisórias, em português de gente, sem códigos.
```
