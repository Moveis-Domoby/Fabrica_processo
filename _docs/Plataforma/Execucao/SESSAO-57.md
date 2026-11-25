---
titulo: Diário de execução — SESSAO-57 · o pino certo
tipo: execucao
data: 2026-11-24
tags: [execucao, sessao-57, rotas, mapa, geocodificacao]
---

# Diário — SESSAO-57 · O pino certo (24/11/2026, madrugada — fila do Escritório)

Demanda: [[SESSAO-57 - O Pino Certo]] · Handoff: [[handoff_2026_11_24_sessao57_pino_certo]]

Mesa: worktree `sessao-57-pino-certo`, nascida do ramo da 56 (`1e338a2`). Número 57 conferido livre em todas as worktrees e ramos.

## Task list (espelho da demanda)

1. ✅ Frente 1 — `candidatosGeoapify` (modo livre) marca o lugar (bairro/cidade) e o separa da rua/casa.
2. ✅ Frente 1 — rua reconhecível no texto digitado exige nome parecido (≥ 0,75).
3. ✅ Frente 1 — `geocodificar` responde `resolvido: false` + `aproximado` + `lugar`; não grava como rua.
4. ✅ Frente 1 — decisão do cache (abaixo).
5. ✅ Frente 1 — as três janelas: aviso âmbar, Salvar travado até arrastar ou "Salvar assim mesmo".
6. ✅ Frente 1 — o 13961 como teste.
7. ✅ Frente 2 — pino não arrastado pede confirmação.
8. ✅ Frente 2 — pino longe do CEP (1,5 km), chamada leve `{ conferir: { cep } }`, serviço fora não bloqueia.
9. ✅ Frente 3 — "N pedidos com o pino a conferir" em Já programadas, toque filtra, sem leitura a mais.
10. ✅ Testes, lint, build; validação no navegador; demanda, diário, handoff, reporte.

## Decisões técnicas

- **Sem migration.** Nada no banco muda: o lugar aproximado do endereço digitado vai para a própria linha do cache (`fonte = 'aprox_bairro' | 'aprox_cidade'`, `resolvido = false`, o ponto do lugar só para registro). A frente 3 conta na tela.
- **Cache do endereço digitado:** as chaves `avulsa:` **não leem mais o cache** — a busca digitada é um toque da pessoa e procura sempre. Motivo: a versão de antes gravou o lugar como se fosse a rua (o próprio 13961 está gravado assim — fonte `geoapify`, resolvido); ler o cache devolveria o ponto errado com cara de achado. O resultado continua gravado (serve de registro/diagnóstico). Custo: uma consulta à Geoapify por toque em "Achar no mapa".
- **Tipos de lugar da Geoapify:** suburb, district, postcode → bairro; city, county → cidade; state, country, unknown → descartados no modo livre. Amenity entra como "rua" (o nome é conferido quando há rua no texto).
- **Rua reconhecível no texto:** o 1º pedaço antes da vírgula começa pelo tipo do logradouro (Rua, Av., Travessa…, com as abreviações de sempre); o número do fim sai ("125", "nº 125", "s/n"). Sem rua reconhecível (um lugar, uma referência): vale a 1ª rua/casa que vier, como antes.
- **Escolha do lugar:** o 1º lugar que a Geoapify devolveu (ela ordena pela relevância).
- **Conferência do CEP:** `pontoParaConferir` em `fluxo.ts` usa o mesmo `peloCep` dos degraus (o serviço de CEP gratuito, sem chave); CEP geral (…000) ou torto = sem conferência. Na tela, a conferência só roda no clique de salvar e guarda o ponto de cada CEP enquanto a janela está aberta.
- **Quando confere:** só quando há pino NOVO (na parada avulsa em edição, o pino que já estava salvo não pergunta; no "Editar endereço", o pino do banco intocado não pergunta).
- **Frente 3:** "o ponto aproximado da cidade" = o ponto dos pedidos aproximados que a própria lista trouxe (a busca devolve o mesmo ponto para toda a cidade). Contam os programados de hoje (dia da fábrica) em diante. O toque mostra as **rotas inteiras** que têm um pino a conferir (como a busca da aba — o mapa e a ordem não se quebram, e "Salvar ordem" nunca vê uma rota pela metade).
- **O cartão** do pedido marcado à mão no centro da cidade ganha o aviso âmbar "O pino foi salvo no centro da cidade, não na casa — confira o ponto" com "Ajustar o pino"; a janela aberta dali trata o ponto como aproximado (salvar sem mover pergunta).

## Arquivos

- `supabase/functions/geocodificar/busca.ts` — `lugar` no candidato; `NivelDoLugar`, `LugarAproximado`; `ruaDoTextoLivre`; `escolherLivre`; Geoapify e Photon marcam o lugar.
- `supabase/functions/geocodificar/fluxo.ts` — consulta `aproximado`; `cepDeRua`, `pontoParaConferir`.
- `supabase/functions/geocodificar/index.ts` — `{ conferir: { cep } }`; `aproximado`/`lugar` na resposta; `avulsa:` sem cache; fonte `aprox_*` com `resolvido = false`.
- `src/rotas/api.ts` — `PontoAchado`, `acharPontoDoEndereco` com o aproximado, `pontoDoCepParaConferir`.
- `src/rotas/conferirPino.ts` (novo) — textos, CEP de rua, `useConferirPino`.
- `src/rotas/AvisosDoPino.tsx` (novo) — `AvisoRuaNaoAchada`, `PerguntaNoRodape`.
- `src/rotas/ModalParadaAvulsa.tsx`, `ModalPontoNoMapa.tsx`, `JanelaEnderecoPedido.tsx` — frentes 1 e 2.
- `src/rotas/pinoAConferir.ts` (novo), `AbaJaProgramadas.tsx`, `CartaoPedido.tsx` — frente 3.
- Testes: `src/rotas/pinoCerto.test.ts` (novo), `pinoCerto.telas.test.tsx` (novo), `buscaGeoapify.test.ts` (2 testes ajustados ao contrato novo: o digitado que só acha o bairro deixou de ser "achou").

## Comandos e ocorrências

- `tsc --noEmit` e `npm run lint`: limpos.
- 1ª bateria completa: 1 falha por tempo (5 s) no 1º teste de tela novo — a máquina carregada; os blocos de tela novos ganharam 20 s de limite (os outros da casa já sofrem disso, ver a 56).
- **Armadilha (de novo):** script Python com aspas dentro de heredoc quebra no bash desta máquina — escrever o script num arquivo; e o Python no Windows grava CRLF em modo texto (corrigido de volta para LF antes do commit).
- O print sem caminho do navegador cai na raiz da mesa — mover para a pasta de telas e passar o caminho completo.

## Validação no navegador

Site local (porta 5187) contra o banco de produção, usuário de teste. A função nova **não está publicada**: a resposta dela foi simulada **só dentro do navegador** (interceptando a chamada à função, nada foi ao banco) para ver as telas. Na aba Programar (montagem — nada é gravado até programar): parada avulsa "TESTE AGENTE pino certo" com o endereço do 13961 → aviso âmbar, Salvar travado; "Salvar assim mesmo" libera; Salvar → "O pino está a 4,9 km do CEP…" com Voltar / Salvar assim mesmo; computador, 375 e 768 sem rolagem lateral. Cancelado no fim (nada ficou). "Ajustar o pino" sem mover: provado pelos testes (não havia pedido aproximado na lista, e salvar num pedido real é proibido). Já programadas: nenhum pedido com o pino a conferir na lista de agora — os de 24/11 já foram todos marcados à mão e nenhum aproximado sobrou para reconhecer o centro de Natal (limite da conta na tela, ver o handoff).

## Lições (para a Memória de Aprendizado depois da dieta)

- L1 — Resposta "de lugar" de um geocodificador nunca é "achou": todo modo de busca precisa separar rua de lugar, inclusive o "livre", senão a tela mostra o pino com cara de certo.
- L2 — Cache de busca gravado com regra errada contamina as consultas seguintes; quando a regra muda, o cache daquela classe de chave precisa ser ignorado ou versionado.
- L3 — Conta feita "na tela" depende do que a tela tem: reconhecer "o centro da cidade" pelos aproximados da própria lista falha quando não sobra nenhum aproximado nela.
- L4 — Para ver na tela uma função ainda não publicada, simular a resposta dela dentro do navegador de teste (interceptar a chamada) — sem tocar no banco.

## Bateria final

- Build limpo. Bateria completa: 803 de 804 — a única falha foi por tempo esgotado numa janela do quadro que esta sessão não tocou (a do card no PCP); rodada isolada junto com os testes de tela novos, passa (13 de 13). Instabilidade da máquina carregada, a mesma da 56.

## Validação dos endereços um por um, no site publicado (24/11, ~03:00 Brasília — pedido do dono)

Pedido do dono: *"realize testes no navegador para validar se os endereços estão indo corretamente para o local correto, valide um por um usando a api nova de pesquisa de endereço"*. Site publicado (sistema-domoby.vercel.app), logado como o dono, função `geocodificar` versão 15 no ar.

**Como foi feito (nada de pedido alterado):** os 30 pedidos de "Sem programação" + os 6 programados de 23–24/11 (34 endereços distintos). Para cada um: (1) o ponto gravado em `plt_geocache` (leitura); (2) a função nova chamada pelo navegador, com a sessão do dono, com o endereço do pedido e chave `avulsa:` (só registro — essas chaves não são lidas pela função desde a 57; ficaram 34 linhas `avulsa:` no cache); (3) `{ conferir: { cep } }` na função; (4) o ponto do CEP consultado daqui do PC no mesmo serviço de CEP (só o CEP), para ter a referência independente.

**Achados:**
1. **O serviço de CEP responde HTTP 429 à função** (registro: 5 de 5 já às 03:xx UTC, antes do teste; 61 de 62 durante). Efeito: o degrau do CEP nunca funciona → rua que a Geoapify não acha cai direto no **centro da cidade**; e a conferência "pino longe do CEP" (frente 2 da 57) **nunca pergunta** (sempre `conferir: null`). Do PC o mesmo serviço responde normal → é limite por servidor, como o Photon/Nominatim.
2. **A busca nova acha a rua em 18 de 34; 16 caem no centro da cidade** (Natal -5.805398,-35.2080905 / Parnamirim -5.9153334,-35.2679913). Vários deles têm ponto de rua bom gravado antes pelo Photon (13177, 13888, 13925, 13960 — 0,0 a 0,6 km do CEP): **pedido novo parecido hoje cairia no centro**.
3. **Os pontos gravados de rua estão certos:** todos os `geoapify`/`photon`/`manual` ficaram a ≤ 0,7 km do ponto do CEP, menos 13984 (Av. Abel Cabral, 1,1 km — avenida longa, plausível). Os 6 programados: 13959, 13960, 13961, 13962, 13976 a ≤ 0,1 km; 13840 está exatamente no ponto do CEP, mas o CEP é da Rua São José, não da José de Souza Cruz (confirmar com o cliente, como a 57 já dizia).
4. **8 pedidos sem programação estão no centro da cidade** (`aprox_cidade`): 13964 (6,2 km do CEP), 13971 (6,4), 13969 (5,6), 13957 (3,7), 13979 (2,2), 13975 (1,1), 13977 (Extremoz, CEP geral) e 13952 (área rural de Macaíba, 0,3 — aceitável).
5. **A aba Programar não avisa desses 8:** `plt_fn_programacao_candidatos` (a lista "Sem programação", recriada na SESSAO-50) **não devolve `geo_aproximado`, `geo_manual` nem `cep`** — o cartão mostra "Acertar o ponto no mapa" como se o ponto fosse de rua (print do 13964 na conversa), e a nova tentativa de 7 dias do ponto da cidade (`precisaGeocodificar`) não dispara nessa aba. Em "Já programadas" (`plt_fn_programadas`) o aviso existe.

**Nada foi corrigido** — fica para o dono decidir: (a) a lista "Sem programação" passar a mandar o aviso de ponto aproximado (atualização do banco pequena); (b) o degrau do CEP com outro serviço (ViaCEP não dá ponto; BrasilAPI v2 dá ponto às vezes) ou a busca do CEP pela própria Geoapify (`postcode` + cidade); (c) acertar os 8 pinos na tela.

- L5 — Serviço gratuito chamado do servidor corta por limite sem aviso **também no degrau de apoio** (CEP): a falha visível da 56 cobre só o buscador principal; o degrau que falha em silêncio rebaixa o resultado para "centro da cidade" sem ninguém saber.
- L6 — Toda lista que mostra cartão de pedido precisa trazer os mesmos campos do cartão (aqui `geo_aproximado`): duas portas para o mesmo cartão divergem quando uma é recriada e a outra não.

## Ajuste de 24/11 — a aba Programar sabe que o ponto é aproximado (resposta do dono: "Sim, corrija")

- **Branch:** `ajuste-pino-aproximado-programar` (criada a partir da main local; o cofre modificado e não commitado de antes ficou como estava).
- **Migration (escrita, NÃO aplicada):** `supabase/migrations/20261124130000_plt_candidatos_ponto_aproximado.sql` — recria `plt_fn_programacao_candidatos` por **extração** da versão vigente (`20261112060000_plt_editar_endereco.sql:1392-1594`, conferida igual à do banco vivo pelo `pg_get_functiondef`) e acrescenta: `ee.cep` na base e, em cada item, `cep`, `geo_manual` (`fonte = 'manual'`) e `geo_aproximado` (o que vem depois de `aprox_`) — a mesma regra de `plt_fn_programadas`. `create or replace`: assinatura e grants iguais (revoke anon / grant authenticated da `20261027080000`). Sem tabela, índice, leitura nova ou mudança no site (o tipo `PedidoProgramacao` já tinha os três campos opcionais e o `listarCandidatos` repassa o JSON).
- **Efeito esperado depois de aplicar:** o cartão da aba Programar mostra o aviso âmbar "ponto aproximado · Ajustar o pino" nos 8 pedidos do centro da cidade; "Ajustar o pino" confere o pino contra o CEP; a nova tentativa de 7 dias do ponto da cidade passa a valer nessa aba. "N pedidos com o pino a conferir" continua contando só os programados (a 57 decidiu assim).
- **Teste novo na bateria do banco** (`supabase/testes/testar-migrations.mjs`, bloco "Ajuste 24/11", escopo próprio, em transação desfeita): o mesmo pedido com o cache `aprox_cidade` → `geo_aproximado = 'cidade'`; `manual` → `geo_manual = true`; `geoapify` → nenhum dos dois; o `cep` = o da visão de endereço; a porta segue só para quem tem login.
- **Armadilha para a frente da SESSAO-53 (ainda não aplicada):** ela recria esta mesma porta a partir da `20261112060000` — ao entrar, precisa levar as três chaves junto, ou o aviso some de novo (anotado também no cabeçalho da migration).
- L7 — Antes de recriar uma porta por extração, conferir **todas** as frentes abertas que recriam a mesma porta (`grep` nas worktrees do Escritório): a última a aplicar ganha, e a outra perde o que acrescentou em silêncio.
- **Bateria do banco (`npm run test:banco`, 24/11):** o bloco novo **3 de 3 verdes**; 1 vermelho que já existia antes (anotado no diário da SESSAO-56): "Dashboard: as 7 portas novas = as antigas em 8 períodos" — Comercial, nada a ver com esta porta.
- **APLICADA em 24/11 com o OK do dono ("Sim, aplique")** — `npm run banco:aplicar -- --confirmar --so 20261124130000_plt_candidatos_ponto_aproximado.sql`: aplicada, integração do Tiny idêntica (estrutura e linhas). Nada mais reaplicado.
- **Conferência no banco vivo** (porta chamada como um admin, transação desfeita): os sem programação no centro da cidade agora vêm com `geo_aproximado = 'cidade'` — 13952, 13969, 13977, 13979 e três novos do dia (13988, 13993, 13995); os marcados à mão vêm com `geo_manual = true` (13918, 13962); o CEP vem em todos. Dos 8 da validação, a logística já acertou à mão às ~08:20 de 24/11 o 13957 (~0,05 km do CEP), o 13964 (~0,02 km) e o 13971 (~0,22 km) e programou os três para 24/11; o **13975** foi programado para 25/11 **ainda no centro de Parnamirim** (em "Já programadas" ele aparece com o aviso e na conta de "pino a conferir").
- **Não vi a tela no site:** o navegador do app caiu no login e o Chrome do dono estava desconectado (senha não se digita). O site não mudou: o cartão é o mesmo que já mostra o aviso em "Já programadas" e o teste de tela do cartão com `geo_aproximado` está verde.

## Os pinos acertados (24/11, pedido do dono: "Arrume o pino … ENTÃO ARRUMA")

Gravados pela mesma porta da tela (`plt_fn_geo_marcar`, como o usuário do dono — o registro de atividade guarda o ponto de antes de cada um). Ponto escolhido daqui do PC, por bases abertas (OpenStreetMap pelo Nominatim/Photon/Overpass, ViaCEP para o CEP oficial da rua e o serviço de CEP para o ponto do CEP). As ruas têm 300–600 m e os números passam disso (1035, 1570): a numeração não é métrica — o pino vai **sobre a rua certa, no ponto mais perto do CEP** (a navegação do entregador é sempre pelo endereço; o pino só ordena a rota).

| Pedido | Endereço | Ponto gravado | Como |
|---|---|---|---|
| 13975 (sai 25/11) | R. Francisco Altevi Wanderley 538, Passagem de Areia, Parnamirim | -5.913877, -35.280165 | ponta da rua (510 m no mapa) mais perto do CEP |
| 13969 | R. Manoel Bandeira de Moura 224, Encanto Verde, Parnamirim | -5.8662932, -35.2582866 | ponto do CEP da rua (a rua não está no mapa; o bairro fica a 140 m) |
| 13979 | R. Santo Apolo 587, Dix-Sept Rosado, Natal | -5.813043, -35.226311 | sobre a rua, no CEP |
| 13988 | R. Ten. Petronilo Diogo Silva 422, Bom Pastor, Natal | -5.8135697, -35.2439482 | sobre a rua, no CEP |
| 13993 | R. Tamirim 395, Planalto, Natal | -5.854155, -35.265337 | sobre a rua, a 85 m do CEP |
| 13995 | R. da Saudade 1035, Lagoa Nova, Natal | -5.821268, -35.204550 | sobre a rua, no CEP |
| 13952 | Área rural de Macaíba — complemento "condomínio Fazenda Real 1 e 2" | -5.866902, -35.454536 | o condomínio no mapa (~11 km a oeste do ponto antigo) |
| 13977 | R. São Miguel 278, "São Miguel Arcanjo", Extremoz (CEP geral) | -5.695285, -35.301748 | **palpite**: há duas R. São Miguel em Extremoz; a de Canaã fica a 1,4 km da igreja de São Miguel Arcanjo (a outra, em Redinha Nova, a ~9 km) — confirmar com o cliente |

- **13840 não foi mexido — o pino está certo.** Correção do que escrevi antes: pelo ViaCEP (Correios), o CEP 59014-430 **é** da Rua José de Souza Cruz, Mãe Luiza; o serviço de CEP e o mapa ainda chamam a mesma rua pelo nome antigo, "Rua São José" (o ponto do CEP fica a 4 m dela). O pino salvo à mão está sobre a rua.
- Sobraram com ponto da cidade só 13894 e 13910, de rotas de 14 e 16/11 (já passadas).
- L8 — O serviço de CEP pode trazer o nome **antigo** da rua: "o CEP é de outra rua" precisa ser conferido no ViaCEP (o nome dos Correios) antes de dizer que o endereço está errado.

## O CEP pelo navegador (24–25/11 — o dono: "Sim, resolva")

- **O problema:** o serviço de CEP gratuito responde HTTP 429 a todas as chamadas da função (servidor compartilhado, limite por endereço de rede). Do PC ele responde normal e aceita chamada direta do navegador (CORS `*`, conferido com `curl -H Origin`).
- **Alternativas testadas daqui (24/11):** BrasilAPI v2 devolve só o centro da cidade (-5.795,-35.209 para todo CEP de Natal; -5.9156,-35.2628 para Parnamirim) — não serve; ViaCEP dá o nome oficial da rua (útil para conferir — o 13840), sem ponto.
- **A forma:** `src/rotas/cepNoNavegador.ts` (novo) — o navegador consulta o CEP (tempo limite 4 s, uma vez por CEP na sessão, a falha não fica guardada) e `geocodificar()` manda a resposta no item (`cep`); a função (`respostaDoNavegador` em `fluxo.ts`) só usa se for do MESMO CEP do endereço, senão pergunta pelo servidor como antes. A conferência do pino (`pontoDoCepParaConferir`) pergunta pelo navegador primeiro e cai na função se falhar. `cepNoTexto` passou a ler o CEP com ponto ("59.014-430", o formato do cadastro do Tiny) — mora agora em `cepNoNavegador.ts` (o `conferirPino.ts` reexporta).
- **Compatível nos dois sentidos:** o site de antes não manda `cep` (a função faz como antes); a função de antes ignora o `cep` que o site novo manda.
- **Testes:** `src/rotas/cepNoNavegador.test.ts` (novo, 11 casos — o 13975 com a resposta real do serviço); vitest de `src/rotas` 34 arquivos / 312 testes verdes; `tsc -b` limpo; eslint limpo. (A 1ª rodada do vitest inteiro pegou por engano a worktree antiga `.claude/worktrees/sessao-46…` — falhas de lá, e um teste de tela por tempo com a máquina carregada; refeito com `--exclude ".claude/**"`.)
- **NÃO publicado ainda:** a publicação da função pelo conector foi barrada pelo controle de permissões (produção) e o login da ferramenta de linha de comando da Supabase não existe nesta máquina — esperando o OK explícito do dono. O site também não subiu (branch `ajuste-cep-pelo-navegador`).
- L9 — `vitest run --root <repo>` sem `--exclude ".claude/**"` roda também os testes das worktrees guardadas dentro da pasta.
