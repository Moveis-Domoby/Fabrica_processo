---
titulo: Handoff — 2026-11-24 · a subida que junta as entregas aprovadas
tipo: handoff
data: 2026-11-24
atualizado: 2026-11-24
tags: [handoff, subida]
---

# 📋 Handoff — 24/11/2026 · a subida que junta as entregas aprovadas (fila do Escritório)

> [!danger] ⛔ SUBSTITUÍDA em 25/11 — não subir este ramo
> A main andou depois desta subida (a 57, o ajuste de 24/11 já aplicado no banco, o CEP pelo navegador). A subida que vale é a [[handoff_2026_11_25_subida_atualizada|subida de 25/11]]: ela traz tudo isto por cima da main de 25/11 e acerta a porta da aba Programar (aplicar a atualização da 53 como está aqui apagaria o aviso do ponto aproximado).

Diário técnico: [[SUBIDA-2026-11-24]].

## 1. O que o dono pediu

"Subir para o site tudo o que a fila já entregou e foi aprovado." Como o "subir para o site" junta um ramo por vez na main, a subida vem pronta num ramo só, com o conflito resolvido e testado: a dieta da documentação, o teste do painel do Comercial e as sessões 53, 52, 55, 54 e 56. A 34 fica de fora (tem noite própria com o dono).

## 2. O que foi feito

- **As entregas, juntas e na ordem pedida.** A 56 já estava na main (o gerente da fila juntou e enviou em 24/11, de madrugada) — então veio na base. As outras entraram uma a uma, com as mensagens originais.
- **A bateria do banco** tinha um conflito (todas acrescentaram o seu bloco no mesmo lugar): ficaram os blocos de todos, inteiros, na ordem 53 → 52 → 55 → 54 → 56, cada um conferido linha a linha contra o próprio ramo.
- **O arquivo de regras** ganhou, no fim, o trecho "manda pra fila" que estava só na pasta principal.
- **O cofre no formato novo:** 50 decisões em notas próprias, 42 lições nas notas de tema, o banco por domínio, a parte 4 das dívidas da lei, o design, a Ordem das Sessões e os mapas (detalhe no diário).

## 3. Como testar, passo a passo (depois de ligar — seção 6)

1. **Pedidos → Todos os pedidos:** um pedido entregue num dia escolhido mostra "Entregue no dia dd/mm/aaaa por Fulano · registrado em dd/mm às hh:mm".
2. **Lupa (Ctrl+K):** buscar um pedido entregue — "Entregue em" é o dia real da entrega.
3. **Rotas → Programação (Programar e Já programadas), Expedição e Entregas do dia:** um pedido entregue em parte mostra "Entregue em parte (N de M)" e "K ainda em produção".
4. **Meu painel, Meus afazeres, Dashboards → Pessoas, Qualidade, Meu desempenho; Configurações → Equipe, API e integrações, Caminhões, Automações, Desligar o tempo:** abrem normais (agora com uma leitura cada) — como o dono **e** como um operador.
5. **Comercial → Painel de recompra:** trocar a ordem da tabela de clientes muda a lista inteira e volta para a página 1. **Listas de disparo:** excluir/encerrar/remover pede confirmação numa janela da casa (não mais a do navegador) e avisa no canto. ⚠️ Nunca "Disparar", "Iniciar fila" ou "Parar" numa lista de verdade para testar.
6. **Rotas (a 56, já no ar):** a ordem que a tela mostra não muda sozinha ao tirar/reprogramar; quem entra numa rota que já existe vai para o lugar mais perto.

## 4. Critérios de aceite

- ✅ As entregas na ordem, mensagens preservadas; a 34 fora.
- ✅ O conflito da bateria resolvido com os blocos de todos, inteiros, antes do resumo final.
- ✅ Débito técnico do Comercial na versão da 54; as telas de Rotas com as duas mudanças (53 e 56); o ajuste da 53 na atualização antiga do dia real mantido.
- ✅ O trecho da fila no fim do arquivo de regras, em commit próprio.
- ✅ O cofre no formato da dieta; o verificador com **zero erro** (seção 8).
- ✅ Montagem, revisão de código, testes de tela (825/825) e bateria do banco (2.120 verdes, 0 vermelhos).
- ✅ Navegador: as telas que não dependem do banco novo abriram sem erro (seção 7 do reporte da fila).
- ⏳ A validação das telas que dependem do banco novo — depois do passo 1 da seção 6.

## 5. Decisões que esperam o dono (todas provisórias — valem até ele dizer o contrário)

- **Datas e textos certos (52):** [[D-340 - A lista de pedidos ganha uma porta nova no banco com a hora do|D-340]] a [[D-345 - A Auditoria traduz a configuracao do painel de tempos na hora|D-345]] — a hora só quando é a de verdade, o texto da linha, a devolução só com o dia, a busca pelo dia real, a Auditoria em português.
- **Entregue em parte nas telas (53):** [[D-346 - Depois que o resto e entregue o selo Entregue em parte some|D-346]] a [[D-350 - ROTAS Entregas fica como estava sem o selo novo|D-350]] — o selo some quando o resto é entregue, "ainda em produção" só com o resto em produção, o Calendário sem o selo, "Entregues hoje" com o selo, ROTAS → Entregas igual.
- **Comercial (54):** [[D-351 - A janela de confirmacao do Comercial pergunta no titulo e|D-351]] a [[D-357 - A ordem da tabela de clientes viaja dentro dos filtros|D-357]] — o desenho da janela, os avisos de 5 s, os textos, a página 1 ao trocar a ordem.
- **Telas numa leitura (55):** [[D-358 - A porta de abertura junta as leituras de sempre e nao as|D-358]] a [[D-367 - Ficam de fora de proposito indice novo paginacao dos cadastros|D-367]] — o período resolvido no banco, o guardado de 30 s, o trabalho da pessoa numa leitura, o "2/5" contado no banco, banco antes do site.
- **Busca e ordem da rota (56):** as do pedido do dono são vigentes ([[D-368 - A busca de endereco pela Geoapify Photon de reserva Nominatim|D-368]] a [[D-375 - Aviso no sino quando a busca de endereco passa 1 hora fora|D-375]]); as escolhas da sessão, provisórias: [[D-376 - Incluir um pedido na montagem poe ele onde o caminho aumenta|D-376]] a [[D-389 - A chamada que so leu do guardado tambem avisa a busca fora|D-389]].
- **A dieta (49):** [[D-335 - Os roteiros do cofre nao publicam o site|D-335]] a [[D-339 - O que saiu da frente o Arquivo a Ordem curta e a copia|D-339]].
- **Pergunta aberta da 56:** a faixa "a busca de endereço está fora" aparece só para quem tem endereço novo a procurar — **mostrar para todos?** (o dono ia responder).

## 6. Para ligar com o dono (nesta ordem; cada passo com o OK dele)

> Tudo pelo aplicador da casa, **um arquivo por vez** (`npm run banco:aplicar -- --confirmar --so <arquivo>`), com a conferência de antes e de depois. As consultas completas de cada conferência estão no handoff de cada sessão (ligado em cada passo). Nenhuma das atualizações abaixo recria função que outra delas recria, e nenhuma toca o que a 56 pôs no ar — a ordem entre elas não desfaz nada.

**1. Banco — só as atualizações novas:**

- **1a · a da 53** (`20261118110000_plt_entregue_em_parte_nas_telas.sql`) — [[handoff_2026_11_18_sessao53_entregue_em_parte_nas_telas|handoff da 53]], seção 6.
  - *Antes:* o corpo vivo das 4 portas (Programar, Já programadas, Expedição, Entregas do dia) igual ao das atualizações de onde vieram; a visão nova ainda não existe; "Já programadas" com uma assinatura só; anotar um pedido entregue em parte para olhar depois.
  - *Depois:* a visão existe e ninguém logado a lê direto; "Já programadas" com uma assinatura e a coluna nova; no pedido anotado, as 4 portas dizem o mesmo que a ficha. A atualização antiga do dia real **não** se reaplica (o ajuste dela é só para a bateria).
- **1b · a da 52** (`20261118100000_plt_datas_e_textos_certos.sql`) — [[handoff_2026_11_18_sessao52_datas_e_textos_certos|handoff da 52]], seção 6.
  - *Antes:* o corpo vivo da busca e da devolução igual ao das atualizações de onde vieram; a porta nova da lista de pedidos ainda não existe.
  - *Depois:* a porta nova devolve 20 linhas com a hora do registro e os números batem com a lista antiga; visitante não a chama; a busca devolve o dia real; o site de hoje abre a lista, a busca e a devolução sem erro.
- **1c · as três da 55**, nesta ordem (`20261118130000_plt_meu_trabalho_numa_leitura.sql`, `20261118130100_plt_dashboards_numa_leitura.sql`, `20261118130200_plt_configuracoes_numa_leitura.sql`) — [[handoff_2026_11_18_sessao55_telas_numa_leitura|handoff da 55]], seção 7.
  - *Antes:* as 9 portas novas ainda não existem; as 13 que elas chamam por dentro existem; quem está logado lê as colunas de usuário que elas leem.
  - *Depois:* as 9 existem, só leem, rodam com a permissão de quem chama e visitante não chama; os avisos da Supabase sem item novo.
- **1d · a da ordem dos clientes da 54** (`20261118120100_plt_comercial_clientes_ordem_no_banco.sql`) — [[handoff_2026_11_18_sessao54_comercial_janelas_e_limpeza|handoff da 54]], seção 6, passos 0a e 1.
  - *Antes:* o corpo vivo da função de clientes igual ao de 16/10; guardar as 50 primeiras linhas.
  - *Depois:* as mesmas 50 na mesma ordem; com "mais antiga primeiro", as de compra mais antiga.
  - ⏸️ **A que remove a função antiga das transições fica para OUTRO dia, com OK separado** (é exclusão).
- **1e · as três da 56 — ✅ JÁ FEITAS** (o Cowork aplicou em 24/11 ~00:40–00:58, com o OK do dono, na ordem do handoff dela; a conferência de que o catálogo dos avisos vivo era o da sessão 51 foi feita antes da dos avisos). Nada a fazer; só conferir que continuam lá — [[handoff_2026_11_23_sessao56_busca_geoapify_ordem_da_rota|handoff da 56]], seção 4. Como nenhuma das atualizações 1a–1d mexe no catálogo dos avisos nem nas portas da rota, aplicá-las depois não desfaz a 56.

**2. A chave da Geoapify — ✅ já está lá.** O segredo que a função de busca lê se chama `PLT_GEOAPIFY_CHAVE`, no cofre de segredos das funções da Supabase (o dono pôs em 23/11). Não mexer.

**3. Publicar a função de busca de endereço — ✅ já publicada** (versão 14, 24/11, pelo Cowork). Nada a fazer.

**4. Validação no navegador — um pedido novo da fila, depois do passo 1** (e antes do 5, com o site de testes da mesa, ou logo depois do 5, no site). O roteiro:
1. Pedidos → Todos os pedidos: abre com uma chamada; a linha de entrega com dia escolhido mostra "registrado em".
2. Lupa: um pedido entregue mostra "Entregue em" pelo dia real.
3. Programação (Programar e Já programadas), Expedição, Entregas do dia: o pedido anotado no 1a mostra "Entregue em parte (N de M)" — computador, tablet (768) e celular (390).
4. As 10 telas de uma leitura (Meu painel, Meus afazeres, Pessoas, Qualidade, Meu desempenho, Equipe, API e integrações, Caminhões, Automações, Desligar o tempo): cada uma abre com **uma** chamada de dados (contar na rede) e sem erro de permissão — como o dono e como um operador.
5. Comercial → Painel de recompra: trocar a ordem da tabela de clientes muda a lista inteira e volta à página 1.
6. Comercial → Listas: criar uma lista **"TESTE AGENTE"** com um cliente, remover o membro e excluir a lista pelas janelas novas (nunca "Disparar"/"Iniciar fila"/"Parar"); conferir que a lista sumiu.
7. Rotas: a faixa da busca fora não aparece (a busca está de pé); os pedidos ganham ponto pela Geoapify.

**5. "Subir para o site" deste ramo** — só depois do passo 1 (a lista de pedidos e as telas de uma leitura precisam do banco novo; sem ele, dão erro). O site de hoje funciona com o banco novo, então o passo 1 pode ser feito com calma antes.

**Para desfazer:** o site volta para a versão anterior; as atualizações 1b, 1c e 1d só acrescentam/aceitam coisa nova e podem ficar; a 1a muda a forma de "Já programadas" (o site de antes ignora a coluna nova).

## 7. Desempenho

Nada novo nesta subida além do que cada sessão mediu (andamento das cinco em [[PLT - Lei de Desempenho - Dividas e Andamento 4]]). Montagem: o maior pedaço inicial ~121,8 KB comprimido (a régua da casa soma os arquivos da abertura; as sessões mediram 232–233 KB, teto 250). Dívidas novas registradas: 38 a 47 (das sessões) e 48 (o teste de Tempos de produção que o pedido dava como vermelho — passou nesta rodada; a observar). Dívidas 18 (em parte) e 20 pagas pela 55.

## 8. O cofre

`node scripts/cofre/verificar.mjs` no fim: **✅ zero erro** (os avisos são os de antes: handoffs/diários antigos acima do teto, o índice da memória acima do teto de índice, um número de lição citado que não existe). Notas novas: decisões D-340 a D-389; lições E-295 a E-320 e A-247 a A-262; [[PLT - Lei de Desempenho - Dividas e Andamento 4]]; este handoff e o diário. Próximos livres: **D-390 · E-321 · A-264 · dívida 49** (a A-263 é a lição desta subida).

## 9. Ficou pendente

- Os passos 1, 4 e 5 da seção 6 (com o dono).
- A remoção da função antiga das transições do Comercial (outro dia, OK separado).
- `supabase-fabrica-schema.sql` com as mudanças da 56 (aplicadas) e, depois do passo 1, das outras.
- **A pasta principal do dono tem mudanças sem commit** (no arquivo de regras, na Ordem das Sessões e em outras notas do cofre). Quando este ramo entrar na main, elas vão conflitar com as deste ramo — conferir antes de juntar (o trecho da fila já está aqui).
- Achado no navegador (não vem destas entregas): no celular, com o painel de itens do menu aberto em Entregas do dia, o mapa fica por cima do menu.

### Aguardando decisão do dono
As provisórias da seção 5 e a pergunta da faixa da busca fora.

### Próximo passo sugerido
O passo 1 da seção 6 (banco), depois o pedido da fila de validação no navegador, depois "subir para o site" deste ramo.
