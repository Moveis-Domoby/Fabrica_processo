---
titulo: "SESSAO-56 — Busca de endereço pela Geoapify, tela que avisa quando a busca falha e ordem da rota que não se mexe sozinha"
tipo: demanda
status: em desenvolvimento
data: 2026-11-23
atualizado: 2026-11-23
origem: relato da logística de 23/11 ("o mapa não está marcando os endereços") e pedido do dono das 21:12 sobre a ordem da rota; diagnóstico e escolhas feitos no Cowork com o dono em 23/11 (a Geoapify foi escolha do dono)
revisa: ↩️ D-112 (buscador) e a parte do buscador da SESSAO-45 · ↩️ D-109 e D-111 (a sugestão só propõe; a ordem mostrada é a que vale)
tags: [plataforma, demanda, rotas, mapa, geocodificacao, ordem-da-rota]
---

# 🎯 SESSAO-56 — Busca de endereço pela Geoapify, tela que avisa quando a busca falha e ordem da rota que não se mexe sozinha

> Mapeada no Cowork em 23/11/2026 com o dono, a partir de um relato da logística: "o mapa da programação de rotas não está marcando os endereços". **Confira se o número 56 está livre** (52–55 estão nos ramos da fila de 18/11).

## O que é

**Dois blocos, executados juntos.** **A:** a busca de endereço (abaixo). **B:** tirar um pedido da rota não reordena os outros (pedido do dono, 23/11 21:12 — seção própria mais abaixo).

**Bloco A —** Desde **19/11 por volta das 13h56 (Brasília)** nenhum endereço novo ganha ponto no mapa. Os pedidos ficam em **"procurando no mapa…"** para sempre, na Programação, em Já programadas, na janela do mapa e na busca da parada avulsa. Esta sessão troca o buscador por um **serviço com chave própria da Domoby (Geoapify)**. A tela também passa a **avisar** quando a busca falha, em vez de ficar procurando para sempre.

## O diagnóstico (lido no banco e no registro da função em 23/11, só leitura)

- A Edge Function `geocodificar` consulta o **Nominatim** e o **Photon** (komoot). O Nominatim responde **HTTP 403** ao servidor desde 03/10 (D-112), e tudo vinha passando pelo Photon.
- **O Photon passou a responder HTTP 403 em 19/11 ~16:56 UTC** e segue recusando: o registro mostra recusas em 21/11 e em 23/11 às 08:32, 08:50, 09:07, 09:33, 09:46 e 10:30–10:32. O serviço CEP (awesomeapi) também já respondeu 429 em 19/11.
- `plt_geocache`: o último ponto gravado por busca é de **19/11 11:15** (`aprox_cidade`). Antes dele, `photon` às 10:32. **Nada depois.** As linhas `osrm` são rotas, não endereços.
- **Comportamento atual que esconde a falha:**
  - quando os dois buscadores recusam, a função devolve `tentar_depois` e não grava nada (correto);
  - a tela (`useGeocodificarFaltantes`) marca a chave como "já pedida nesta visita", **não tenta de novo** e **não mostra nada**. O cartão continua em `geo_resolvido === null` → "procurando no mapa…".
  - Assim a logística não sabe que precisa marcar o pino à mão, e ninguém soube por 4 dias que a busca estava fora.
- **Não é a internet do galpão:** o fundo do mapa carregou no print, e a busca roda no servidor, não no navegador.
- O instance público do Photon avisa que uso pesado é limitado ou bloqueado, sem garantia de disponibilidade. Depender dele (e do Nominatim) a partir de um servidor de nuvem não é confiável.

## A escolha (dono, 23/11 20:58)

**Geoapify**, plano gratuito:
- 3.000 buscas/dia, até 5 por segundo, sem cartão;
- uso comercial em produção permitido, com a atribuição "Powered by Geoapify" perto do mapa (e a do OpenStreetMap, que já existe);
- os dados são do OpenStreetMap: a mesma base que a pontuação de `busca.ts` já conhece (bairro, CEP, cidade).

Descartados: **Google** (proíbe mostrar o resultado num mapa que não seja Google e guardar coordenadas por mais de 30 dias; o nosso mapa é Leaflet/OSM e o cache é permanente), **LocationIQ** (uso comercial "limitado" e cache curto), **OpenCage** (o gratuito é só para teste).

# BLOCO A · Busca de endereço

## Comportamento esperado

### Frente 1 · Geoapify como buscador principal (Edge Function)
- **Chave:** ✅ **o dono já criou a conta (projeto "Api Rotas") e pôs a chave nos segredos das Edge Functions como `PLT_GEOAPIFY_CHAVE`** (23/11 21:12). Leia com `Deno.env.get('PLT_GEOAPIFY_CHAVE')`, **nunca no código**. A chave está sem filtro de IP, de propósito: o servidor das Edge Functions muda de endereço.
- **Busca estruturada:**
  - `https://api.geoapify.com/v1/geocode/search` com `housenumber`, `street`, `postcode`, `city`, `state`, `country` vindos de `partirEndereco`;
  - `filter=countrycode:br` + `bias=proximity:-35.2,-5.8` (a fábrica);
  - `lang=pt`, `format=json`, `limit` ~8.
  - Endereço livre (digitado na parada avulsa / busca da janela): `text=` + `filter=rect:` da caixa do RN (a mesma regra de hoje).
- **Adaptador `candidatosGeoapify(corpo)` em `busca.ts`** (com teste): converte cada resultado para `Candidato`, em `fonte: 'geoapify'`:
  - rua, número e CEP (`postcode`);
  - bairro: `suburb`, e na falta `district`/`quarter`, se vierem;
  - cidade, UF e as coordenadas.
  - Use `rank.confidence`/`result_type` só para descartar o que não é rua nem casa. **A escolha continua com `escolher`/`escolherPerto`** (bairro, CEP, cidade, ambíguo = não achei). Nada de confiar só no 1º resultado.
- **Ordem nova:**
  1. Geoapify;
  2. se a Geoapify **recusar ou falhar** (401/403/429/5xx/timeout), o Photon como reserva. O Photon pode voltar; manter o código dele custa pouco.
  3. **O Nominatim sai** (recusa desde 03/10 e só gastava 1,1 s por endereço).
- **Os degraus (CEP → bairro como âncora → cidade) continuam.**
  - O degrau do bairro e o da cidade passam a usar a Geoapify (`type=city`, ou a busca do bairro com `filter=circle` em volta da cidade), com o Photon de reserva.
  - O serviço de CEP segue como está.
- **Ritmo:** a pausa de 1,1 s era para o Nominatim. Com a Geoapify, respeite **≤ 5 por segundo** (pausa curta, ~250 ms). Assim as 5 por chamada saem bem mais rápido.
- **Cota:** 3.000/dia com cache permanente sobra muito. Mesmo assim, o 429 da Geoapify é "tentar depois" (nada gravado), nunca "não achei".
- **Nova `fonte` `'geoapify'`** no cache. Se houver check na coluna `fonte`, acrescente (migration, com OK). Os pontos `photon`/`manual`/`cep`/`aprox_*` existentes **ficam como estão**. **Não** suba `VERSAO_BUSCA`/`VERSAO_DEGRAUS`: nada do que já foi achado precisa ser refeito.
- **Registro:** o `console.warn` de hoje segue, com a Geoapify no texto ("Geoapify HTTP 429", etc.).

### Frente 2 · A tela não fica mais "procurando" para sempre
- **A função já devolve `tentar_depois`: a tela passa a usá-lo.** Quando a resposta vier com `tentar_depois` para uma chave, o cartão troca "procurando no mapa…" por um aviso em âmbar:
  > *"A busca de endereço não respondeu. Marque o ponto no mapa ou tente de novo."*

  com dois botões:
  - **"Marcar no mapa"**: abre a janela de editar endereço/pino que já existe;
  - **"Tentar de novo"**: libera a chave e pede de novo, só aquela.
- **Erro da chamada inteira** (rede, 401, 5xx): o mesmo aviso nos itens daquele lote. Hoje o erro some sem efeito na tela.
- **Sem relógio novo (regra 18):** nada de tentar de tempos em tempos. Tenta de novo **ao reabrir a tela**, ao **voltar à aba** (se já houver esse gatilho na casa) e no botão.
- Vale para **todo lugar que usa a busca**: Programar, Já programadas, janela do mapa, formulário da parada avulsa e janela de editar endereço do pedido.

### Frente 3 · Ninguém fica 4 dias sem saber
- **A plataforma passa a saber quando a busca está fora**, sem tabela nova se uma existente servir (regra do banco enxuto). Sugestão:
  - a função grava, numa linha de configuração/estado que já exista, a **hora da última recusa** e a **hora do último ponto achado**;
  - a tela de Rotas lê isso junto da leitura que já faz.
- **Quando a última recusa é mais nova que o último ponto achado**, a tela de Rotas mostra uma faixa discreta no topo:
  > *"A busca de endereço está fora desde 19/11 às 13:56. Os pontos novos precisam ser marcados à mão."*

  Some sozinha quando a busca voltar a achar.
- **Opcional, se o sino já tiver um tipo que sirva:** avisar admin/logística **uma vez** quando a busca passar 1 hora recusando. Sem relógio novo: o aviso nasce na própria chamada que recusou.

### Frente 4 · Atribuição
- **"Powered by Geoapify"** (link para geoapify.com) junto da atribuição do mapa:
  - nos mapas que mostram pontos achados pela busca (mapa da Programação, janela do mapa, mini-mapa de Entregas do dia, pino da parada avulsa);
  - no formulário de busca de endereço.
- Discreto, no mesmo estilo do "Leaflet | © OpenStreetMap" que já aparece.

## O que acontece com os endereços parados

- Os endereços que ficaram em "procurando" desde 19/11 **não têm linha no cache** (nada foi gravado). Ganham ponto **sozinhos** na primeira vez que alguém abrir a tela depois da publicação. **Nenhum acerto de dado.**
- Os que a logística já marcou à mão nesse meio-tempo continuam à mão (o `manual` nunca é substituído).
- **Depois de publicar, conferir:**
  - a rota do **Hyundai HR de 23/11** (7 paradas) e as programações de 24/11 em diante, todas com ponto ou com o aviso novo;
  - a contagem de pedidos programados sem ponto, antes e depois.

---

# BLOCO B · A ordem da rota não se mexe sozinha (pedido do dono, 23/11 21:12)

## O pedido, nas palavras do dono
> *"Quando uma rota estiver sendo montada e um dos pontos acabar sendo removido, a rota não deve renovar a ordem dos pinos, apenas manter a que já foi definida, tirando apenas o pino removido e aquele ponto do mapa. Hoje quando alguém remove um endereço da rota, ela recalcula tudo novamente e altera a ordem definida pela logística. A sugestão de rota deve ser mantida, porém toda ordem que for alterada deve se manter, pois às vezes um pedido é mais longe, porém tem um tempo de entrega específico e precisa ir primeiro."*

**A regra que sai disso:**
- a sugestão automática (o mais perto primeiro, a partir da fábrica) continua existindo, **só para propor a ordem inicial** e no botão "Voltar à sugestão";
- **depois que a ordem aparece na tela, nada a reordena sozinho:**
  - tirar um pedido ou uma parada só apaga aquele número e aquele pino;
  - os outros ficam na mesma sequência, renumerados (1, 2, 4 → 1, 2, 3);
  - nada mais muda de lugar.

## Por que hoje recalcula (lido no código e no banco em 23/11)
- **A ordem na tela vem de 3 fontes, nesta precedência** (`ordemDaRota` em `rotaRuas.ts`): o rascunho arrastado → a ordem salva → **a sugestão recalculada na hora**.
- **Enquanto ninguém arrasta, não existe ordem guardada.** A tela mostra a sugestão, calculada de novo a cada mudança da lista.
  - **Montagem (Programar):** `rascunho` começa `null`. Tirar um pedido (`alternar`) recalcula o "mais perto" de todos, e os números trocam. Só quem arrastou antes fica protegido, porque o rascunho filtra o removido.
  - **Ao programar:** `ordem = temSalva || ajustada ? … : null`. Se a montagem não foi arrastada, **o banco grava a rota sem ordem nenhuma**. O "Salvar ordem" igual à sugestão também **apaga** a ordem (`cardIds: []` = "volta ao automático").
  - **Já programadas e entregador:** com a rota sem ordem salva, tirar um pedido (`plt_fn_desprogramar_entrega` apaga a linha) ou reprogramar para outro dia/caminhão faz a tela recalcular a sugestão do que sobrou. Os números trocam também no celular do entregador.
- **No banco, hoje:**
  - as rotas do Hyundai HR de **23/11 e 24/11 (5 pedidos cada) não têm ordem salva nenhuma**;
  - a de 21/11 tem 3 com ordem e 4 sem (os de depois entraram pela sugestão);
  - em 14 dias: 26 "programação removida", 30 "ordem salva".
- **Segundo motivo de reordenação, ligado ao bloco A:** quem está **sem ponto** fica no **fim** da sugestão. Quando o ponto chega, o pedido pula para o meio e empurra os outros. Com a busca de endereço fora desde 19/11, **toda rota sem ordem salva vai se reorganizar** quando a Geoapify encher os pontos. Por isso este bloco precisa entrar junto.
- **A linha no mapa não reordena:** o `calcular-rota` usa o serviço de **rota** (`/route/v1`), que segue a ordem dada. Não é o de "viagem otimizada". Fica como está.

## Comportamento esperado

### Frente B1 · A ordem mostrada vira a ordem da rota
- **Montagem (Programar):**
  - a ordem da tela passa a ser **sempre** uma lista guardada (o rascunho nunca fica `null` depois que há paradas);
  - a sugestão só **propõe**;
  - **tirar** um pedido ou parada só o remove da lista; os outros ficam na mesma sequência.
- **Incluir na montagem** *(provisória, mostrar ao dono no handoff)*: o novo entra **no lugar onde aumenta menos o caminho** (inserção mais barata em linha reta), **sem mudar a ordem relativa dos que já estavam**. Quem quiser a sugestão inteira de novo usa **"Voltar à sugestão"**.
  - Pedido sem ponto entra no **fim** e fica lá: quando o ponto chegar, **não** muda de lugar sozinho.
- **Programar grava sempre a ordem da tela.**
  - Acaba o `ordem = null` "porque ninguém mexeu": a rota nasce com ordem salva.
  - Na rota que já tinha itens continua a regra de hoje: o que já estava fica na ordem dele, e os novos entram no fim, na ordem da montagem.
- **"Salvar ordem" grava a ordem da tela**, mesmo igual à sugestão. Acaba o "lista vazia = volta ao automático" como resultado de salvar.
  - **"Voltar à sugestão" continua:** recalcula, a pessoa vê e salva. O que fica gravado é a sugestão daquele momento, congelada.

### Frente B2 · Tirar da rota não mexe no resto (Já programadas, entregador, Entregas do dia)
- Tirar um pedido da rota, reprogramar para outro dia/caminhão/rota, ou remover uma parada avulsa:
  - **só aquele item sai**;
  - **os outros mantêm a ordem salva**, renumerados na tela (o banco pode guardar com buracos; a tela numera 1, 2, 3…).
- **Rota que ainda não tem ordem salva** (as de hoje):
  - no mesmo gesto de tirar, a ordem que a tela mostrava (menos o que saiu) **é gravada**, para não recalcular depois;
  - de preferência numa porta só no banco, que recebe a ordem que fica. Se for preciso, a de tirar aceita a ordem restante, e o banco confere que bate com o que está na rota, como já faz no "a rota mudou noutra tela".
- **Rascunho não salvo em "Já programadas"** (a pessoa arrastou e não salvou): tirar um item mantém o rascunho sem ele, como hoje, e o "Salvar ordem" continua pendente.
- **O entregador e o link do mapa do entregador** veem a mesma ordem, sem pulo.

### Frente B3 · As rotas já programadas sem ordem
- As rotas de **hoje em diante** sem ordem salva (hoje: as do Hyundai HR de 23/11 e 24/11):
  - **congelar a ordem que a logística vê**, com o OK do dono, como passo separado;
  - **só depois de o bloco A encher os pontos**, porque sem ponto a sugestão de agora está incompleta.
  - Mostre ao dono a lista antes/depois de cada rota.
- Rotas passadas e entregues: não mexer.

## Critérios de aceite (bloco B)
- [ ] Montagem com 5 pedidos sem arrastar: tirar o 3º → os outros ficam 1, 2, 3, 4 na mesma sequência de antes (antes: 1, 2, 4, 5), no mapa e na lista.
- [ ] O mesmo depois de arrastar o mais longe para 1º: ele continua 1º depois de tirar outro.
- [ ] Incluir um pedido na montagem não muda a ordem relativa dos que já estavam.
- [ ] Programar sem arrastar → a rota fica com ordem salva no banco.
- [ ] Em "Já programadas", tirar um pedido de uma rota (com ou sem ordem salva) não muda a sequência dos outros, inclusive no celular do entregador.
- [ ] Reprogramar um pedido para outro dia: na rota de origem, os outros não se mexem.
- [ ] Um pedido sem ponto que ganha ponto depois **não** muda de lugar.
- [ ] "Voltar à sugestão" + "Salvar ordem" grava a sugestão daquele momento, e ela não muda mais sozinha.
- [ ] O banco continua recusando "a rota mudou noutra tela" quando a lista não bate.

## Notas para o Claude Code (bloco B)
- **Código:**
  - `src/rotas/rotaRuas.ts` (`ordemDaRota`, `continuarSugestao`, `ordemSugerida`);
  - `AbaProgramar.tsx` (`rascunho`, `alternar`, `reordenar`, `voltarSugestao`, a mutação de programar);
  - `AbaJaProgramadas.tsx` (`rascunhos`, `salvarOrdem`, `voltarSugestao`, tirar/reprogramar);
  - `paradasAvulsas.ts` (`ordemComONovoNoFim`, `completarOrdem`, `misturarNaOrdem`);
  - a tela do entregador (`naOrdemDaRota`).
- **Banco:**
  - `plt_fn_ordenar_rota` (hoje: `card_ids` vazio = zera a ordem);
  - `plt_privado.fn_rota_aplicar_ordem`;
  - `plt_fn_desprogramar_entrega` (só apaga a linha);
  - `plt_fn_programar_entrega` (zera a ordem ao mudar dia/caminhão/rota; está certo para a rota **nova**);
  - `plt_fn_parada_avulsa_remover`.
  - Recrie a partir da **versão viva**, conferindo o corpo.
- **Decisões a registrar:**
  - ↩️ revisa a D-109 e a D-111: a sugestão só propõe e a ordem mostrada é a que vale;
  - tirar não reordena;
  - pedido que ganha ponto não muda de lugar.
- **Provisórias:** a inclusão pela inserção mais barata; a numeração sem buracos só na tela.
- **Lei de desempenho:** tirar da rota continua **um gesto = uma chamada**.

---

## Fora do escopo

- Trocar o mapa de fundo (continua Leaflet + OpenStreetMap) e o serviço de rota pelas ruas (OSRM). Este responde normal: as linhas `osrm` seguem sendo gravadas até hoje.
- Plano pago da Geoapify ou qualquer outro serviço pago.
- Refazer pontos já achados.
- Autocomplete enquanto digita (a busca continua no "Buscar").

## Critérios de aceite

- [ ] Com a chave no segredo, um endereço novo de Natal ganha ponto de **rua** pela Geoapify (`fonte = 'geoapify'`), com o bairro conferido como hoje.
- [ ] Rua de mesmo nome em outro bairro **não** é aceita (os testes de `busca.ts` continuam passando, com casos novos para o adaptador da Geoapify).
- [ ] Geoapify recusando (simule chave errada) → o Photon tenta. Os dois recusando → nada gravado, e o cartão mostra o aviso com "Marcar no mapa" e "Tentar de novo".
- [ ] "Tentar de novo" pede só aquela chave e, voltando a busca, o ponto aparece sem recarregar a página.
- [ ] A faixa "a busca de endereço está fora desde…" aparece com a busca recusando e some quando ela volta.
- [ ] 5 endereços numa chamada saem em poucos segundos (sem a pausa de 1,1 s).
- [ ] O Nominatim não é mais chamado (registro sem "Nominatim").
- [ ] "Powered by Geoapify" visível nos mapas e na busca, em 375/768 sem rolagem lateral.
- [ ] Depois de publicar: a rota do Hyundai HR de 23/11 e as de 24/11+ sem nenhum "procurando no mapa…" parado.
- [ ] tsc, lint, vitest, build e advisors sem nada novo. Lei de desempenho: nenhuma leitura extra ao abrir Rotas além do que a frente 3 precisar (de preferência dentro da leitura que já existe).

## Notas para o Claude Code

- **Código a ler:**
  - `supabase/functions/geocodificar/index.ts` e `busca.ts`;
  - `src/rotas/api.ts` (`geocodificar`, `precisaGeocodificar`, `acharPontoDoEndereco` — busca digitada, que hoje devolve `null` tanto para "não achei" quanto para "recusou": separe os dois);
  - `src/rotas/useGeocodificarFaltantes.ts`, `CartaoPedido.tsx`, `MapaProgramacao.tsx`, `ModalParadaAvulsa.tsx`, `JanelaEnderecoPedido.tsx`, `ModalPontoNoMapa.tsx`, `MiniMapaEntregas.tsx`.
- **Teste da Geoapify sem gastar cota à toa:** guarde 2 ou 3 respostas reais (de endereços de teste, não de clientes) como amostra para os testes do adaptador.
- **Dado pessoal:** o endereço do cliente não vai para o registro (regra que já existe no `console.warn`).
- **Regra 2 (passos separados, cada um com o OK do dono):**
  1. ~~o dono cria a conta e a chave na Geoapify~~ ✅ feito em 23/11;
  2. ~~pôr o segredo no Supabase~~ ✅ feito pelo dono (`PLT_GEOAPIFY_CHAVE`);
  3. migration (se a `fonte` tiver check);
  4. publicar a função;
  5. publicar o site (subida na main publica).

  **A função antes do site.** O site novo entende o `tentar_depois`, e a função nova continua compatível com o site antigo.
- **Decisões a registrar:**
  - buscador principal = Geoapify, Photon de reserva, Nominatim fora (↩️ revisa a D-112 e a parte do buscador da SESSAO-45);
  - a tela avisa e oferece marcar/tentar de novo quando a busca não responde;
  - faixa de "busca fora".
- **Provisórias a registrar:** os textos dos avisos; a pausa de ~250 ms; a faixa só na tela de Rotas; o aviso no sino (se entrar).
- **Lição a registrar:** serviço gratuito sem chave chamado do servidor pode ser cortado sem aviso. Toda dependência externa precisa de uma falha **visível** na tela, não silenciosa.
- **Com o dono:** português de gente, sem códigos (regra 12c).

## Leitura da sessão

A dieta da documentação (SESSAO-49) **não está na main** → rota de leitura do `CLAUDE.md` de hoje: regras, memória de aprendizado, decisões (D-01…D-17 e as citadas: D-39, D-45, D-108…D-112, D-128, D-174, D-193, D-196), lei de desempenho, modelo de sistema, o esquema pelas próprias migrations (a versão vigente de cada função) e o handoff da SESSAO-51. Pelo pedido da fila, as notas grandes (Decisões, Memória, Esquema, Lei, Mapa, Ordem das Sessões, Próximos Passos) **não são editadas** nesta sessão: o que é delas fica no diário [[SESSAO-56]] e na seção "Para entrar nas notas depois da dieta" do handoff.

## Tarefas no ClickUp

- [Rotas - Busca de endereço pela Geoapify e aviso quando a busca falha](https://app.clickup.com/t/17tya50yc9c) (lista PRODUÇÃO do DPTO TI).
- [Rotas - A ordem definida pela logística não muda ao tirar um pedido](https://app.clickup.com/t/17tya50yc9n) (lista PRODUÇÃO do DPTO TI).

## Resultado (preencher ao entregar)

**Executada em 23/11/2026 (fila do Escritório) — só no ramo `sessao-56-busca-geoapify-ordem-da-rota`; NADA aplicado nem publicado.** Handoff: [[handoff_2026_11_23_sessao56_busca_geoapify_ordem_da_rota]] · Diário: [[SESSAO-56]].

- **Bloco A:** frentes 1 a 4 feitas (Geoapify com o Photon de reserva e o Nominatim fora; o aviso com "Marcar no mapa" e "Tentar de novo"; a faixa de "busca fora" sem tabela nova; "Powered by Geoapify"). O aviso no sino (opcional) não entrou. Sem migration.
- **Bloco B:** B1 e B2 feitas (a ordem da montagem é sempre guardada; Programar e "Salvar ordem" gravam a ordem da tela; tirar, reprogramar e remover parada mandam junto a ordem que fica). Migration `20261124100000` só em arquivo. **B3 não executada** — roteiro no handoff.
- **Falta:** ligar com o dono (banco → função → teste real → site → conferência → B3), ver as telas no navegador (375/768) e confirmar as provisórias.
