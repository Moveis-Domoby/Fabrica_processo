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
