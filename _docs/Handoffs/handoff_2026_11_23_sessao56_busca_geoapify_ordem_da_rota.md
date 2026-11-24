---
titulo: Handoff — SESSAO-56 · a busca de endereço pela Geoapify, a tela que avisa quando a busca falha e a ordem da rota que não se mexe sozinha
tipo: handoff
data: 2026-11-23
tags: [handoff, sessao-56, rotas, mapa, geocodificacao, ordem-da-rota]
---

# 📋 Handoff — SESSAO-56 · Busca de endereço pela Geoapify e ordem da rota que não se mexe sozinha (23/11/2026, noite — fila do Escritório)

Demanda: [[SESSAO-56 - Busca de Endereco pela Geoapify e Tela que Avisa]] · Diário: [[SESSAO-56]]

> ⏳ **NADA ESTÁ NO AR.** Tudo está só no ramo `sessao-56-busca-geoapify-ordem-da-rota` desta mesa (7 commits em cima da main `78e8829`): nenhuma atualização de banco aplicada, a função `geocodificar` não foi publicada, o site não foi publicado, nada foi enviado para fora deste PC. A ligação é com o dono, na ordem da seção 4.
>
> ⚠️ **O link deste handoff no [[000 - MAPA DO PROJETO]] não foi feito** (o pedido da fila manda não editar as notas grandes enquanto a dieta da documentação não entra) — está na seção 7.

## 1. Objetivo

1. **A logística (23/11):** *"o mapa da programação de rotas não está marcando os endereços"* — desde 19/11 nenhum endereço novo ganha ponto; os pedidos ficam em "procurando no mapa…" para sempre. O dono escolheu a **Geoapify** (23/11 20:58) e já pôs a chave nos segredos.
2. **O dono (23/11 21:12):** *"Quando uma rota estiver sendo montada e um dos pontos acabar sendo removido, a rota não deve renovar a ordem dos pinos, apenas manter a que já foi definida, tirando apenas o pino removido e aquele ponto do mapa. […] A sugestão de rota deve ser mantida, porém toda ordem que for alterada deve se manter, pois às vezes um pedido é mais longe, porém tem um tempo de entrega específico e precisa ir primeiro."*

## 2. O que foi feito

### Bloco A — a busca de endereço

- **A busca passa a ser pela Geoapify** (com a chave da Domoby, lida do segredo — nunca escrita em lugar nenhum). Se a Geoapify recusar ou falhar, o buscador antigo (Photon) ainda tenta, de reserva. O Nominatim saiu. **A regra que escolhe o ponto não mudou**: confere a rua, o bairro, o CEP e a cidade; rua de mesmo nome noutro bairro continua não sendo aceita; rua não achada continua virando o ponto da cidade com o aviso de ajustar o pino.
- **Mais rápido:** a pausa entre consultas caiu de 1,1 s para 0,25 s (o limite da Geoapify é 5 por segundo).
- **A tela não fica mais "procurando no mapa…" para sempre.** Quando a busca não responde, o cartão do pedido mostra em âmbar: *"A busca de endereço não respondeu. Marque o ponto no mapa ou tente de novo."*, com os botões **"Marcar no mapa"** (a janela de sempre) e **"Tentar de novo"** (pede só aquele endereço; se a busca voltou, o aviso some de todos os cartões e os outros endereços voltam a ser procurados sozinhos). Vale em Programar e em Já programadas. Nas janelas de busca digitada (parada avulsa, ponto no mapa, editar endereço) o aviso de "não respondeu" ficou diferente do "não achei".
- **Sem insistência e sem relógio:** a tela para de pedir quando a busca não responde; tenta de novo quando a pessoa reabre a aba ou toca no botão.
- **Ninguém fica 4 dias sem saber:** com a busca fora, o topo de Rotas mostra a faixa *"A busca de endereço está fora desde 19/11 às 13:56. Os pontos novos precisam ser marcados à mão."* — some sozinha quando a busca volta. O "desde quando" fica guardado numa linha reservada do próprio cache do mapa (nenhuma tabela nova, nenhuma atualização de banco para este bloco) e chega na resposta da própria busca (abrir Rotas não faz leitura a mais).
- **"Powered by Geoapify"** no rodapé dos três mapas (ao lado do OpenStreetMap) e embaixo do "Achar no mapa" das janelas.
- **O aviso no sino (opcional) não entrou** — pediria uma porta nova no banco só para isso.

### Bloco B — a ordem da rota não se mexe sozinha

- **Montagem (aba Programar):** a ordem da tela agora é sempre uma lista guardada. **Tirar** um pedido ou parada só o tira — os outros ficam na mesma sequência, renumerados. **Incluir** põe o novo no lugar onde o caminho aumenta menos, sem mudar a ordem dos que já estavam; pedido sem ponto entra no fim e **fica lá** mesmo quando o ponto chega. "Voltar à sugestão" recalcula o mais perto primeiro quando a pessoa quiser.
- **Programar grava sempre a ordem da tela** — acabou a rota que nascia "sem ordem" porque ninguém arrastou.
- **"Salvar ordem" grava a ordem da tela**, mesmo igual à sugestão. "Voltar à sugestão" mostra a sugestão e a pessoa salva — fica guardada a sugestão daquele momento.
- **Já programadas e entregador:** tirar um pedido, reprogramar para outro dia/caminhão/rota ou tirar uma parada avulsa tira **só aquele item**; a ordem dos outros que a tela mostrava vai junto no mesmo gesto e fica gravada. A rota antiga que ainda não tinha ordem salva ganha a ordem nesse gesto — e ela também passou a oferecer o botão "Salvar ordem".
- **A sugestão continua existindo** só para propor (a ordem inicial de quem entra e o "Voltar à sugestão").
- **B3 (congelar a ordem das rotas já programadas) não foi executada** — o roteiro está na seção 4, passo 6.

### Banco (só em arquivo — NÃO aplicado)

`supabase/migrations/20261124100000_plt_ordem_da_rota_nao_muda.sql`:
- nova `plt_privado.fn_rota_ordem_que_fica` (fora da API);
- `plt_fn_desprogramar_entrega`, `plt_fn_parada_avulsa_remover` e `plt_fn_programar_entrega` recriadas por inteiro da última versão nas migrations, com um parâmetro opcional no fim (a ordem que fica) — a assinatura antiga sai; sem a lista respondem como antes (o site de hoje continua funcionando depois da migration);
- nenhuma tabela, coluna ou índice novo. O bloco A não tem migration (a coluna que diz "quem achou" é texto livre).

### Edge Function (alterada — NÃO publicada)

`supabase/functions/geocodificar/`: `busca.ts` (consultas e leitura da Geoapify), `fluxo.ts` (novo — a ordem dos buscadores e dos degraus, testável) e `index.ts` (rede, cache, o estado "busca fora"). Lê `PLT_GEOAPIFY_CHAVE`. A resposta ganhou `busca.fora_desde`; o resto é igual (o site de hoje segue funcionando com a função nova).

## 3. Como testar (depois de ligar — passo a passo)

**No computador e também no celular (375) e no tablet (768) — nada pode rolar para o lado.**

1. **Um pedido novo ganhando ponto.** Rotas → Programação → Programar. Um pedido que estava em "procurando no mapa…" deve ganhar o pino em poucos segundos, sem recarregar. Em Já programadas, o mesmo com as rotas de 23/11 e 24/11.
2. **O aviso "a busca de endereço não respondeu".** (Só dá para ver com a busca fora — ver o passo 3 da seção 4 para simular.) O cartão sem ponto mostra o aviso em âmbar com **"Marcar no mapa"** e **"Tentar de novo"**. "Marcar no mapa" abre a janela do pino; "Tentar de novo" gira e, se a busca voltou, o ponto aparece e os avisos dos outros cartões somem.
3. **A faixa de "busca fora".** Com a busca fora, o topo de Rotas mostra "A busca de endereço está fora desde DD/MM às HH:MM…". Voltando a busca (um "Tentar de novo" que dá certo), a faixa some.
4. **"Powered by Geoapify".** No canto de baixo do mapa da Programação, do mini-mapa das Entregas do dia e do mapa da janela do pino; e embaixo do botão "Achar no mapa" (parada avulsa, ponto no mapa, editar endereço).
5. **Uma rota antes e depois de tirar o 3º pedido.** Programar: marque 5 pedidos (sem arrastar), anote a sequência; desmarque o 3º → os outros ficam na **mesma sequência**, só renumerados (1, 2, 3, 4), na lista e no mapa. Repita arrastando o mais longe para 1º: ele continua 1º.
6. **Incluir não bagunça.** Com 3 na rota, marque mais um: ele entra em algum lugar, mas os 3 seguem na mesma ordem entre si.
7. **Programar sem arrastar** → abra a rota em Já programadas: o botão "Salvar ordem" **não** aparece (ela já nasceu salva).
8. **Já programadas:** numa rota, "Tirar" o 2º pedido → os outros não trocam de lugar. "Reprogramar" um para outro dia → na rota de origem os outros não se mexem. Confira a mesma rota no celular do entregador (Entregas do dia): mesma ordem, sem pulo.
9. **"Voltar à sugestão" + "Salvar ordem"** → a ordem sugerida fica gravada e não muda mais sozinha.
10. **A rota mudou noutra tela:** com a mesma rota aberta em duas abas, tire um pedido numa e tente tirar outro na outra sem atualizar → "a rota mudou noutra tela" (o comum é a tela se atualizar sozinha antes).

**O que já está provado por teste automático:** a regra da Geoapify e a ordem dos buscadores (26 testes), o aviso/“Tentar de novo”/faixa (11), a ordem que não muda (16), e no banco 28 conferências (tirar, reprogramar, parada, entregador, recusas, desempenho).
**O que NÃO foi visto no navegador:** nenhuma tela (a mesa só tem acesso ao banco de produção, que pede login) — os passos acima são a primeira vez em tela de verdade, inclusive 375 e 768.

## 4. Para ligar com o dono (nesta ordem, cada passo com o OK dele)

**1. A atualização do banco** (`20261124100000_plt_ordem_da_rota_nao_muda.sql`), pelo aplicador da casa só com este arquivo (`--so`).
- **Antes:** conferir que as três funções vivas são as que a migration tomou por base (o corpo de cada uma igual ao da última versão nas migrations) e que ninguém mais as chama com a assinatura antiga:
```sql
select p.oid::regprocedure as funcao, md5(p.prosrc) as corpo
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('plt_fn_desprogramar_entrega', 'plt_fn_parada_avulsa_remover', 'plt_fn_programar_entrega')
 order by 1;
-- esperado ANTES: 3 linhas — (bigint), (bigint), (bigint, date, bigint, integer)
```
- **Depois:** as mesmas 3 com as assinaturas novas — `(bigint, jsonb)`, `(bigint, jsonb)`, `(bigint, date, bigint, integer, jsonb)` — e a nova `plt_privado.fn_rota_ordem_que_fica(date, bigint, integer, jsonb)`; no site de hoje, "Tirar" um pedido de teste de uma rota continua funcionando.

**2. Publicar a função `geocodificar`** (os três arquivos: `index.ts`, `busca.ts`, `fluxo.ts`). **Antes do site.** O segredo `PLT_GEOAPIFY_CHAVE` já está lá (o dono pôs em 23/11) — não mexer nele.

**3. Teste real de um endereço.** Abrir Rotas → Programar (o site de hoje já serve): os "procurando no mapa…" devem começar a ganhar ponto. Conferir no banco que entrou ponto pela Geoapify:
```sql
select fonte, resolvido, count(*), max(consultado_em)
  from public.plt_geocache
 where consultado_em > now() - interval '1 hour' and chave not like 'rota:%'
 group by 1, 2 order by 4 desc;
-- esperado: linhas com fonte = 'geoapify'
```
E no registro da função: nenhuma linha com "Nominatim"; se aparecer "Geoapify HTTP 401/403", a chave não foi aceita (conferir o nome do segredo). Para **ver o aviso novo** de propósito: só com a busca fora de verdade — não vale a pena derrubar; fica provado pelos testes automáticos.

**4. Publicar o site** (subir para a main publica) — só depois de 1 e 2.

**5. A contagem de pedidos programados sem ponto, antes (do passo 2) e depois (do passo 4):**
```sql
select count(*) filter (where g.chave is null)                 as nunca_procurados,
       count(*) filter (where g.resolvido is false)            as sem_ponto,
       count(*) filter (where g.resolvido)                     as com_ponto,
       count(*) filter (where g.fonte = 'geoapify')            as pela_geoapify
  from public.plt_programacoes pr
  join public.plt_cards pc on pc.id = pr.card_id and pc.entrega_evento_id is null and pc.arquivado_em is null
  left join plt_privado.vw_endereco_entrega ee on ee.pedido_id = pc.pedido_id
  left join public.plt_geocache g
         on g.chave = md5(lower(plt_privado.fn_endereco_geocodificavel(ee.endereco, ee.numero, ee.bairro, ee.cidade, ee.uf, ee.cep)))
 where pr.data_entrega >= current_date - 1;
-- esperado depois de abrir Rotas: "nunca_procurados" cai para 0 (ou perto disso)
```
Conferir à vista: a rota do Hyundai HR de 23/11 (7 paradas) e as de 24/11 em diante — nenhum "procurando no mapa…" parado.

**6. B3 — congelar a ordem das rotas já programadas que ainda não têm ordem salva.** **Só depois de os pontos chegarem** (passo 5), porque sem ponto a sugestão está incompleta. Quais são:
```sql
select pr.data_entrega, cam.nome as caminhao, pr.rota,
       count(*) as pedidos, count(pr.ordem) as com_ordem_salva,
       string_agg(p.numero::text, ', ' order by pr.ordem nulls last, p.numero) as pedidos_na_ordem_do_banco
  from public.plt_programacoes pr
  join public.plt_cards pc on pc.id = pr.card_id and pc.entrega_evento_id is null and pc.arquivado_em is null
  join public.pedidos p on p.id = pc.pedido_id
  join public.plt_caminhoes cam on cam.id = pr.caminhao_id
 where pr.data_entrega >= current_date
 group by 1, 2, 3
having count(pr.ordem) < count(*)
 order by 1, 2, 3;
```
**O caminho recomendado (sem escrever nada à mão no banco):** com o site novo no ar, a logística abre cada rota dessa lista em Já programadas — a rota sem ordem salva mostra o botão **"Salvar ordem"**; ela confere a sequência na tela (arruma se quiser) e salva. O **antes** é a lista da consulta acima + o print da rota; o **depois** é a mesma consulta voltando vazia e a rota na mesma sequência do print. Assim quem congela é a própria logística, vendo o que está congelando — e o dono vê as duas listas.
Rotas passadas e entregues: não mexer.

## 5. Decisões provisórias (o dono confirma ou muda)

1. **Incluir um pedido na montagem** põe ele no lugar onde o caminho aumenta menos, sem mudar a ordem dos outros (da demanda). Quando dá no mesmo (só uma parada na rota), o mais perto da fábrica vai primeiro.
2. **A numeração sem buracos é só na tela** — no banco pode ficar 1, 3, 4; a tela mostra 1, 2, 3.
3. **A faixa "a busca está fora"** aparece só em Rotas, e para quem tem endereço novo a procurar; o "desde" conta a partir da primeira recusa depois de publicar.
4. **Os textos dos avisos** são os da demanda, ao pé da letra; na montagem, quando a ordem não é a sugerida, o texto ficou "Ordem da montagem (diferente da sugestão) — ela não muda sozinha".
5. **A pausa de 0,25 s** entre consultas à Geoapify; até 2 consultas por endereço (a certeira e, se não bastar, a com o bairro), mais as de bairro/cidade quando a rua não existe.
6. **O "não achei"** fica registrado como procurado pela Geoapify.
7. **Tirar com a lista incompleta na tela** (a rota não coube inteira na página): o que a tela não mostrava fica depois, na ordem que tinha — em vez de recusar o gesto.
8. **O aviso no sino não entrou** (pediria mexer no banco); fica a faixa.

## 6. Ficou pendente

- **Ver as telas no navegador** (computador, 375 e 768) — não foi possível nesta mesa.
- **Pedido reprogramado entra na rota de destino sem lugar guardado** (aparece no fim, como sempre foi — a demanda diz que está certo). Se DOIS forem reprogramados para a mesma rota antes de alguém salvar, eles se ordenam entre si pela sugestão; a rota mostra "Salvar ordem" nesse caso. Dar lugar guardado a quem entra mudaria uma regra antiga (testada) — decisão do dono.
- **Entregue / não entregue numa rota antiga sem ordem salva** ainda recalcula o que sobra — some com a B3 (todas as rotas com ordem salva).
- **A parada avulsa posta numa rota antiga sem ordem** entra como 1ª (já era assim) — também some com a B3.
- **"Tentar de novo ao voltar à aba do navegador"** não entrou (a casa não tem esse gatilho geral); vale o reabrir a aba de Rotas e o botão.
- **O plano das portas no banco vivo** (só foi medido no banco de teste, com volume).
- **ClickUp:** não mexido (regra da fila) — as duas tarefas seguem com o dono.
- A função `candidatosNominatim` ficou em `busca.ts` só porque os testes antigos da escolha a usam; pode sair numa limpeza.

## 7. Para entrar nas notas depois da dieta

- **[[PLT - Decisoes de Produto]]** (números a dar): buscador principal = Geoapify, Photon de reserva, Nominatim fora (↩️ revisa a D-112 e a parte do buscador da SESSAO-45); a tela avisa e oferece marcar/tentar de novo quando a busca não responde; a faixa de "busca fora"; a sugestão só propõe e a ordem mostrada é a que vale (↩️ revisa a D-109 e a D-111); tirar não reordena; pedido que ganha ponto não muda de lugar; + as 8 provisórias da seção 5.
- **[[PLT - Memoria de Aprendizado]]:** as lições L1–L6 do diário (dependência externa precisa de falha visível; a bateria é quem diz o que é contrato; assinatura nova × bateria que reaplica migration antiga; chave na URL nunca vai para mensagem de erro; estado pequeno numa linha reservada; script com aspas não vai por heredoc nesta máquina).
- **[[SUPA - Esquema do Banco]]** (e `supabase-fabrica-schema.sql`, depois de aplicar): `plt_geocache` — fonte nova `geoapify`, e a linha reservada `estado:busca-de-endereco` (`fonte = 'estado'`, o dado em `rota`); as assinaturas novas das três portas e a `plt_privado.fn_rota_ordem_que_fica`.
- **[[PLT - Lei de Desempenho e Escala]]:** nenhuma dívida nova; registrar que a busca de endereço ganhou disjuntor e que o estado dela viaja na própria resposta.
- **[[PLT - Modelo de Sistema]]:** o aviso âmbar do cartão com dois botões e a faixa de serviço fora (padrões reutilizáveis).
- **[[000 - MAPA DO PROJETO]]:** o link deste handoff. **[[000 - ORDEM DAS SESSOES]]:** a linha da 56 já foi posta pelo Cowork na pasta principal — só o status.
- **Segredos das Edge Functions:** `PLT_GEOAPIFY_CHAVE` (existe desde 23/11) passa a ser lida pela `geocodificar`.

## 8. Arquivos alterados

```
supabase/functions/geocodificar/busca.ts            (Geoapify: consultas e leitura da resposta)
supabase/functions/geocodificar/fluxo.ts            (novo — a ordem dos buscadores, os degraus, o estado)
supabase/functions/geocodificar/index.ts            (rede, cache, estado "busca fora"; Nominatim fora)
supabase/migrations/20261124100000_plt_ordem_da_rota_nao_muda.sql   (novo — NÃO aplicado)
supabase/testes/testar-migrations.mjs               (bloco SESSAO-56 · B; reaplicação depois da 20261027050000)
src/rotas/api.ts · estadoDaBusca.ts (novo) · useGeocodificarFaltantes.ts · CartaoPedido.tsx
src/rotas/FaixaBuscaFora.tsx (novo) · atribuicaoMapa.tsx (novo) · src/paginas/Programacao.tsx
src/rotas/MapaProgramacao.tsx · MapaPinoParada.tsx · MiniMapaEntregas.tsx
src/rotas/ModalParadaAvulsa.tsx · ModalPontoNoMapa.tsx · JanelaEnderecoPedido.tsx
src/rotas/rotaRuas.ts · paradasAvulsas.ts · AbaProgramar.tsx · AbaJaProgramadas.tsx
src/rotas/ParadaAvulsaDoDia.tsx · src/paginas/EntregasDoDia.tsx
src/rotas/buscaGeoapify.test.ts · estadoDaBusca.test.tsx · ordemQueNaoMuda.test.ts (novos)
_docs/Plataforma/Demandas/SESSAO-56 - … .md · _docs/Plataforma/Execucao/SESSAO-56.md · este handoff
```
