---
titulo: "Diário — SESSAO-56 · busca de endereço pela Geoapify, tela que avisa quando a busca falha e ordem da rota que não se mexe sozinha"
tipo: execucao
data: 2026-11-23
tags: [execucao, sessao-56, rotas, mapa, geocodificacao, ordem-da-rota]
---

# Diário — SESSAO-56 (23/11/2026, noite — fila do Escritório, sem o dono na conversa)

Demanda: [[SESSAO-56 - Busca de Endereco pela Geoapify e Tela que Avisa]] · ramo `sessao-56-busca-geoapify-ordem-da-rota` (mesa própria da fila, nascida da main `78e8829`; a pasta principal do dono não é tocada).

## Partida

- `git status` limpo; o ramo está em dia com a `origin/main` (0 à frente, 0 atrás).
- **O número 56 está livre** na main: a última demanda lá é a 51; 52 a 55 só existem nos ramos da fila de 18/11 (nenhum na main ainda).
- A demanda não estava no git: gravada nesta mesa com o texto do pedido, o frontmatter do modelo (status `em desenvolvimento`), a "Leitura da sessão" e os links do ClickUp. **A Ordem das Sessões não foi tocada** (a linha da 56 já foi posta pelo Cowork na pasta principal).
- **A dieta da documentação (SESSAO-49) não está na main** → pelo pedido da fila, NÃO se editam Decisões de Produto, Memória de Aprendizado, Esquema do Banco, Lei de Desempenho, Mapa do Projeto, Ordem das Sessões nem Próximos Passos. Decisões provisórias, lições e mudanças de esquema ficam AQUI e na seção "Para entrar nas notas depois da dieta" do handoff — por isso levam rótulo (P1, L1…), não número D-/E-/A- (os números se dão quando entrarem nas notas).
- **ClickUp:** o modo fila manda não mexer (o dono cuida) — as duas tarefas ficam como estão; os links estão na demanda.
- **Banco vivo não lido e nada aplicado/publicado** (regra da fila). O diagnóstico da demanda (recusas desde 19/11, rotas sem ordem salva) vale como fato.
- **A chave da Geoapify** não foi pedida, procurada nem escrita em lugar nenhum; nenhuma consulta de verdade à Geoapify saiu desta mesa.

## Linha de base (antes de mexer)

- `npm test` (vitest): 718 verdes, **1 vermelho que já existia** — `src/paginas/Estrutura.test.tsx` ("o CANCELADO e o NÃO ENCONTRADO mostram a escolha…": não acha o rótulo "Em quantos dias a peça cancelada some…").
- `npm run test:banco`: **2 vermelhos que já existiam** — "Dashboard: as 7 portas novas = as antigas em 8 períodos" (Comercial) e "a previsão vencida que aparece na grade não conta como fora do calendário" (calendário das rotas; depende do dia de hoje).
- `tsc -b`: limpo.

## Task list (espelha a demanda)

**Bloco A — busca de endereço**
1. Frente 1 · Geoapify como buscador principal na função `geocodificar`: chave pelo segredo; busca estruturada (+ texto para o endereço digitado); adaptador `candidatosGeoapify` com teste; a escolha continua a de sempre; ordem Geoapify → Photon de reserva; Nominatim fora; degraus pela Geoapify (Photon de reserva), CEP como está; pausa ~250 ms; 429 = tentar depois; fonte `geoapify`; registro com "Geoapify" no texto; sem subir as versões da busca.
2. Frente 2 · a tela usa o `tentar_depois`: aviso âmbar com "Marcar no mapa" e "Tentar de novo" (só aquela chave); erro da chamada inteira dá o mesmo aviso; sem relógio; vale em Programar, Já programadas, janela do mapa, parada avulsa e janela de editar endereço.
3. Frente 3 · a plataforma sabe quando a busca está fora (sem tabela nova) e a tela de Rotas mostra a faixa "fora desde…", que some sozinha; (opcional) aviso no sino.
4. Frente 4 · "Powered by Geoapify" nos mapas e na busca de endereço.

**Bloco B — a ordem da rota não se mexe sozinha**
5. B1 · na montagem a ordem é sempre uma lista guardada; tirar só remove; incluir = inserção mais barata (provisória), sem ponto vai para o fim e fica; Programar grava sempre a ordem; "Salvar ordem" grava a ordem da tela mesmo igual à sugestão; "Voltar à sugestão" continua.
6. B2 · tirar/reprogramar/remover parada em "Já programadas" e no entregador: só o item sai; rota sem ordem salva ganha a ordem que a tela mostrava no MESMO gesto (uma chamada); rascunho não salvo segue pendente; o entregador vê a mesma ordem.
7. B3 · NÃO se executa aqui: só o roteiro e a consulta de conferência, em "Para ligar com o dono".

**Geral**
8. tsc, lint, vitest, build, bateria (faixas novas), plano ×100 das portas tocadas, 375/768; diário; handoff com "como testar", "para ligar com o dono", as provisórias e "para entrar nas notas depois da dieta"; reporte da fila.

## Entendimento, dúvidas e decisões técnicas (no lugar do "espere o OK": o dono não está na conversa)

**Entendimento.** (A) Os dois buscadores gratuitos sem chave passaram a recusar o servidor; a função troca o principal pela Geoapify (chave da Domoby), deixa o Photon de reserva, tira o Nominatim, e a tela deixa de mentir "procurando…" — avisa, oferece marcar à mão e tentar de novo, e mostra desde quando a busca está fora. (B) A sugestão do mais perto só PROPÕE; a ordem que apareceu na tela é a que vale — tirar, reprogramar ou um ponto que chega depois não mexem no resto; toda rota passa a nascer com a ordem salva.

**Dúvidas de negócio:** nenhuma que trave — o que faltou virou provisória (lista no fim).

**Decisões técnicas** (as principais; o porquê de cada uma está no diário abaixo): o fluxo da busca num arquivo próprio e testável (`fluxo.ts`, rede injetada); o estado "busca fora" numa linha reservada do próprio cache do mapa (sem tabela nova e sem migration no bloco A); a faixa chega na resposta da própria função (nenhuma leitura a mais ao abrir Rotas); disjuntor na função e na tela; a ordem que fica vai junto no gesto de tirar (as três portas ganham um parâmetro opcional — compatível com o site antigo).

## Diário

### Frente 1 · Geoapify (função `geocodificar`)

- **Formato da Geoapify conferido na documentação** (`apidocs.geoapify.com/docs/geocoding/forward-geocoding`, lida em 23/11): `GET https://api.geoapify.com/v1/geocode/search`, chave em `apiKey`; estruturados `housenumber, street, postcode, city, state, country` (**não se mistura `text` com os estruturados**); `filter=rect:lon1,lat1,lon2,lat2 | countrycode:br` (vários com `|`, lógica E); `bias=proximity:lon,lat`; `format=json` → `{ results: [...], query }`; `result_type` ∈ unknown, amenity, building, street, suburb, district, postcode, city, county, state, country; `rank.confidence` 0–1 e `match_type`. A página não diz os códigos de erro — a função trata qualquer HTTP não-2xx e o tempo esgotado como "recusou".
- `busca.ts`: `consultasGeoapify` (1ª a estruturada; 2ª o texto com o bairro — só se a 1ª não bastar; o endereço digitado vai em `text` com a caixa do RN), `consultaGeoapifyBairro`, `consultaGeoapifyCidade` (`type=city`) e o adaptador `candidatosGeoapify(corpo, modo)` — `rua` (descarta o que não é rua nem casa: quando a Geoapify não acha a rua ela devolve a cidade), `lugar` (bairro/cidade dos degraus) e `livre` (o digitado: o que vier). `Candidato.fonte` ganhou `geoapify`. **A escolha não mudou** (`escolher`/`escolherPerto`/`escolherLugar`).
- `fluxo.ts` (novo): `procurarEndereco(endereco, ambiente)` — Geoapify; só se ela NÃO responder (sem chave, HTTP de erro, tempo esgotado) o Photon; os dois sem responder = `erro` ("tentar depois", nada gravado). Resposta vazia da Geoapify é "não achei" de verdade — o Photon não é chamado. Recusa de chave/cota (401/403/429) vale para o resto da chamada (os endereços seguintes vão direto à reserva).
- `index.ts`: saiu o Nominatim (código, pausa de 1 hora e a pausa de 1,1 s); pausa de 250 ms; tempo limite de 6 s por consulta; **disjuntor**: nenhum buscador respondeu a um endereço → os seguintes da mesma chamada voltam `tentar_depois` sem consultar (antes, cada um esperava os dois buscadores recusarem).
- **Segredo:** a chave vai na URL da Geoapify — nenhuma mensagem de erro leva a URL (só "Geoapify HTTP 429"); o `catch` passou a registrar o NOME do erro, não a mensagem. Teste prova que a chave e o endereço não aparecem em mensagem nenhuma.
- **Sem migration:** `plt_geocache.fonte` é texto livre (sem check) — a fonte nova não pede mudança de esquema. As versões da busca (`VERSAO_BUSCA`/`VERSAO_DEGRAUS`) não subiram.
- **P1 (provisória):** o "não achei" gravado leva `fonte = 'geoapify'` (antes `photon`) — a coluna diz quem procurou.
- Testes: `src/rotas/buscaGeoapify.test.ts` (26) — adaptador, consultas, a rua de mesmo nome noutro bairro recusada, a ordem dos buscadores, o Nominatim nunca chamado, a chave fora das mensagens. Os 27 de `buscaEndereco.test.ts` seguem verdes.

### Frente 2 · a tela não fica mais "procurando" para sempre

- `src/rotas/estadoDaBusca.ts` (novo): o que a tela sabe da busca nesta visita — `semResposta`, `foraDesde`, `tentando`, `voltou` — num estado só para as duas abas, os cartões e a faixa (fora do React Query: não é dado para guardar, é o resultado da última tentativa).
- `api.ts`: `geocodificar` devolve `{ resultados, foraDesde }` e cada resultado traz `tentar_depois`; `acharPontoDoEndereco` separa "não achei" (`null`) de "não respondeu" (erro `BuscaSemResposta`) — antes os dois voltavam `null` e as janelas diziam "não achei" com a busca fora.
- `useGeocodificarFaltantes`: "tentar depois" (ou a chamada inteira falhando) liga o aviso e **desliga os lotes seguintes** (disjuntor — antes a tela seguia pedindo de 5 em 5 a um serviço fora; e marcava a chave como "já pedida", sem nunca mais tentar). Tenta de novo ao **reabrir a aba** (as abas de Rotas remontam ao trocar) e no botão. **A aba Programar passou a usar o mesmo gancho** (tinha uma cópia do código).
- `CartaoPedido`: sem ponto + busca sem resposta → aviso âmbar com **"Marcar no mapa"** (a janela de sempre) e **"Tentar de novo"** (pede só aquela chave; voltou → o aviso some de todos os cartões, a lista relê e os outros endereços voltam a ser procurados sozinhos).
- Janelas de busca digitada (parada avulsa, ponto no mapa, editar endereço): o texto do "falhou" virou o da demanda.
- **"Voltar à aba do navegador":** a casa não tem esse gatilho geral (cada tela que precisa cuida do seu) → não criei um; fica o reabrir a aba de Rotas e o botão (a demanda diz "se já houver").
- Testes: `src/rotas/estadoDaBusca.test.tsx` (11).

### Frente 3 · ninguém fica 4 dias sem saber

- **Sem tabela nova e sem migration:** a função guarda desde quando a busca está fora numa **linha reservada do próprio cache do mapa** (`plt_geocache`, chave `estado:busca-de-endereco`, o dado no campo livre `rota`, `fonte = 'estado'`). Lida na MESMA consulta que já lê o cache dos endereços pedidos; **gravada só nas viradas** (caiu / voltou) — `proximoEstado` em `fluxo.ts`, testado.
- **A faixa chega na resposta da própria busca** (`busca.fora_desde`) → abrir Rotas não faz leitura nenhuma a mais. `FaixaBuscaFora` no topo da Programação: "A busca de endereço está fora desde 19/11 às 13:56. Os pontos novos precisam ser marcados à mão." Some quando uma consulta volta a responder.
- **P2 (provisória):** a faixa aparece para quem tem ponto novo a procurar (é a consulta dele que traz o estado); quem abre Rotas com tudo já marcado não a vê. "Fora desde" começa a contar da 1ª recusa DEPOIS de publicar (a queda de 19/11 não foi gravada em lugar nenhum).
- **O aviso no sino (opcional) NÃO entrou:** o sino é gravado por portas do banco, e a função da busca fala com o banco pela chave de serviço — faltaria uma porta nova só para isto (mudança de esquema fora do que o pedido autoriza). Fica como possibilidade.

### Frente 4 · atribuição

- `atribuicaoMapa.tsx` (novo): um texto só para os três mapas (Programação, pino da parada/do pedido, mini-mapa das Entregas do dia) — "© OpenStreetMap | Powered by Geoapify" — e a linha "Busca de endereço: Powered by Geoapify" sob o "Achar no mapa" das três janelas.

### Bloco B · B1 — a ordem mostrada vira a ordem da rota

- `rotaRuas.ts`: `inserirNaRota(ordem, novo)` — o novo entra onde a volta (fábrica → paradas → fábrica, em linha reta) aumenta menos; empate (com uma parada só, antes ou depois dá a mesma volta) → a ida mais curta (o mais perto da fábrica primeiro); sem ponto → no fim.
- `AbaProgramar`: o rascunho é SEMPRE uma lista (acabou o `null` = "sugestão recalculada"). Tirar = filtra; incluir (pedido ou parada avulsa) = `inserirNaRota`; "Voltar à sugestão" = a sugestão vira a lista; **Programar manda sempre a ordem** (acabou o `ordem = null` "porque ninguém mexeu").
- `AbaJaProgramadas`: "Salvar ordem" manda sempre a ordem da tela (acabou o "lista vazia = volta ao automático" e o aviso "a rota voltou à ordem sugerida"); "Voltar à sugestão" vira rascunho para a pessoa ver e salvar; **a rota que ainda tem item sem ordem salva oferece o "Salvar ordem"** (é o caminho manual da B3).
- **P3 (provisória):** o texto da montagem quando a ordem difere da sugestão — "Ordem da montagem (diferente da sugestão) — ela não muda sozinha" (era "Ordem ajustada à mão", que deixaria de ser verdade: a inserção mais barata nem sempre coincide com "o mais perto primeiro").
- O banco continua aceitando a lista vazia no "Salvar ordem" (o site de antes ainda manda, até o site novo subir) — só a tela nova deixou de mandar.

### Bloco B · B2 — tirar da rota não mexe no resto

- **Migration `20261124100000_plt_ordem_da_rota_nao_muda.sql` (só em arquivo — NÃO aplicada):**
  - `plt_privado.fn_rota_ordem_que_fica(dia, caminhão, rota, itens)` — nova, fora da API: confere que tudo o que a tela mandou ainda está na rota (senão "a rota mudou noutra tela"), completa com o que a rota tem e a tela não mostrou (a página que ainda não veio — depois, na ordem que tinha) e grava pela `fn_rota_aplicar_ordem` de sempre (o entregador continua sem poder trocar a ordem dos pedidos);
  - `plt_fn_desprogramar_entrega(card, p_ordem_fica)`, `plt_fn_parada_avulsa_remover(id, p_ordem_fica)`, `plt_fn_programar_entrega(card, dia, caminhão, rota, p_ordem_origem)` — recriadas POR INTEIRO da última versão nas migrations (20261008150000, 20261027050000, 20261022020000), com o parâmetro opcional no fim. **A assinatura antiga sai (drop)**; sem a lista, respondem como antes → o site de antes segue funcionando entre a migration e o site novo.
  - **Não mudam:** `plt_fn_ordenar_rota`, `plt_fn_rota_ordenar`, `fn_rota_aplicar_ordem`, `plt_fn_programar_rota`, nenhuma tabela, coluna ou índice.
- **Um gesto = uma chamada:** a ordem que fica vai junto no tirar (`ordemQueFica` em `paradasAvulsas.ts` — a ordem que a tela mostrava SEM o rascunho não salvo, que segue pendente no "Salvar ordem").
- **L2 (erro meu, corrigido na hora):** na 1ª versão o pedido que ENTRAVA numa rota ganhava "o fim guardado" (rota vazia = ordem 1; com ordem = a seguinte). Quebrou 6 conferências antigas da bateria (as da regra "mudar de rota zera a ordem") e ia além da demanda, que diz que isso "está certo para a rota nova". **Voltei atrás:** o destino segue como era; só a ORIGEM ganha a ordem que fica. O que sobra disso está nas pendências (dois pedidos reprogramados para a mesma rota se ordenam entre si pela sugestão até alguém salvar — e a tela agora oferece o "Salvar ordem" nesse caso).
- **L3 (armadilha da bateria):** a bateria reaplica a `20261027050000` no meio (linha ~16228), o que recria a porta ANTIGA de tirar a parada ao lado da nova ("function … is not unique"). A migration da 56 passou a ser reaplicada logo depois dela, lá.
- **Bateria:** bloco "SESSAO-56 · B" no fim, **faixa pedidos 956101–956108, caminhão TST5656, entregador …5631 (CPF 56700000001)** — 28 conferências verdes: tirar com a ordem que fica; a rota antiga sem ordem ganha a ordem no gesto; o site de antes (sem a lista) como era; lista que não bate → recusa e nada sai; página parcial; reprogramar (origem intacta, mesma rota = nada); parada avulsa (logística e entregador — que não consegue trocar a ordem dos pedidos de carona); toque repetido; rota que esvazia; assinaturas antigas fora, permissões; **plano da leitura com 20 mil paradas: 0,8 ms pelo índice da rota** (orçamento da porta: 50 ms); as programações têm o índice (dia, caminhão, rota).
- Testes de tela: `src/rotas/ordemQueNaoMuda.test.ts` (16) — os critérios de aceite do bloco B na lógica pura (5 pedidos, tirar o 3º; o longe em 1º continua 1º; incluir não muda a ordem relativa; sem ponto fica no fim e não pula quando o ponto chega; "Voltar à sugestão"; a ordem que fica com e sem ordem salva, com parada avulsa).

### B3 · não executada (como o pedido manda)

Só o roteiro e a consulta de conferência, no handoff ("Para ligar com o dono", passo 6).

## Verificação final

- `tsc -b` limpo · `npm run lint` limpo · `npm run build` ok.
- `npm test`: 770 testes; **53 novos** (26 + 11 + 16). Numa rodada completa falha 1 teste por tempo (o da linha de base — `Estrutura.test.tsx` — ou `JanelaSaidaPcp.test.tsx`; os dois passam sozinhos: é carga da máquina, não é desta sessão).
- `npm run test:banco`: 1900 verdes; os **2 vermelhos são os da linha de base** (Dashboard do Comercial; previsão vencida do calendário).
- **Validação no navegador: NÃO feita.** A mesa tem `.env.local`, mas ele aponta para o banco de produção e a tela pede login (sem o dono não há quem entre); os estados novos (aviso, faixa) dependem da função ainda não publicada. Ficou só o que os testes de tela (jsdom) provam; **375/768 não foi medido** — está no "como testar" do handoff.

## Checklist de desempenho (Lei) — o que esta sessão tocou

- 1 requisição por tela: abrir Rotas não ganhou leitura nenhuma (o estado da busca vem na resposta da própria busca; a faixa não consulta nada).
- Sem relógio e sem polling: a busca que falha para de insistir; tenta de novo só em gesto (reabrir a aba, botão).
- Chamada externa com tempo limite (6 s), disjuntor dentro da chamada e na tela; nova tentativa é do usuário (sem espera crescente automática — não há repetição automática).
- Um gesto = uma chamada no tirar/reprogramar/remover parada (a ordem vai junto).
- Porta tocada com leitura por índice (plano medido com volume); nenhuma tabela/índice novo.
- **Não medido:** o plano no banco VIVO (sem acesso) e LCP/INP da tela (sem navegador).

## Provisórias (para o dono confirmar — em português de gente no handoff)

- P1 · o "não achei" gravado diz que quem procurou foi a Geoapify.
- P2 · a faixa de "busca fora" só na tela de Rotas, para quem tem ponto novo a procurar; conta a partir da 1ª recusa depois de publicar.
- P3 · o texto da montagem quando a ordem difere da sugestão.
- P4 · os textos dos avisos (os da demanda, ao pé da letra) e a pausa de 250 ms entre consultas.
- P5 · incluir na montagem = inserção mais barata (da demanda); empate = o mais perto da fábrica primeiro.
- P6 · a numeração sem buracos só na tela (o banco pode guardar 1, 3, 4).
- P7 · tirar com a página incompleta: o que a tela não mostrava fica depois, na ordem que tinha (em vez de recusar).
- P8 · a 2ª consulta à Geoapify (texto com o bairro) quando a estruturada não basta — até 2 consultas por endereço, mais os degraus.

## Lições (para a Memória de Aprendizado, quando a dieta entrar)

- L1 · serviço gratuito sem chave chamado do servidor pode ser cortado sem aviso; toda dependência externa precisa de uma falha VISÍVEL na tela, não silenciosa (a da demanda).
- L2 · "aproveitar" para melhorar o destino da reprogramação quebrou 6 conferências antigas — a bateria é quem diz o que é contrato; o que a demanda chama de "certo" não se mexe.
- L3 · assinatura nova (drop + create) × bateria que reaplica migration antiga no meio: reaplicar a nova logo depois.
- L4 · chave de serviço externo na URL: nenhuma mensagem de erro pode levar a URL (nem `e.message`) — registrar só o nome do buscador e o código.
- L5 · estado pequeno de serviço cabe numa linha reservada de tabela que já existe (banco enxuto) — e pode viajar na resposta da própria chamada, sem leitura nova.
- L6 · script grande com aspas simples não vai por heredoc no shell desta máquina (EOF inesperado): gravar o arquivo e rodar.
