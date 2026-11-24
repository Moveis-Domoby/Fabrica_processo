---
titulo: Handoff — SESSAO-56 · a busca de endereço pela Geoapify, a tela que avisa quando a busca falha e a ordem da rota que não se mexe sozinha
tipo: handoff
data: 2026-11-23
tags: [handoff, sessao-56, rotas, mapa, geocodificacao, ordem-da-rota]
---

# 📋 Handoff — SESSAO-56 · Busca de endereço pela Geoapify e ordem da rota que não se mexe sozinha (23/11/2026, noite — fila do Escritório)

Demanda: [[SESSAO-56 - Busca de Endereco pela Geoapify e Tela que Avisa]] · Diário: [[SESSAO-56]]

> ↪️ **AJUSTES DE 23/11 (~23:00 — as respostas do dono):** quem entra numa rota que já existe vai para o lugar mais perto (seção 2b), o aviso no sino com a busca fora há 1 hora (seção 2b), os 2 ajustes da revisão, e o registro do que o dono resolveu (a trava das rotas antigas já FEITA pelo Cowork — seção 4, passo 6). Duas atualizações de banco novas, só em arquivo, que entram logo depois da primeira (seção 4).
>
> ✅ **24/11 (~00:40–00:58) — NO AR pelo Cowork, com o OK do dono:** as 3 atualizações do banco (passos 1, 1b, 1c) e a função `geocodificar` (versão 14, passo 2). **Validado no navegador em 24/11 (~00:40–00:50)** — seção 9. **Falta só publicar o site (passo 4) e a contagem do passo 5 depois.**
>
> ~~⏳ **NADA ESTÁ NO AR.** Tudo está só no ramo `sessao-56-busca-geoapify-ordem-da-rota` desta mesa (os 7 commits da 56 + os dos ajustes, em cima da main `78e8829`): nenhuma atualização de banco aplicada, a função `geocodificar` não foi publicada, o site não foi publicado, nada foi enviado para fora deste PC. A ligação é com o dono, na ordem da seção 4.~~
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
- ~~**O aviso no sino (opcional) não entrou**~~ ↪️ **entrou nos ajustes** (o dono disse "sim" — seção 2b).

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

## 2b. Os ajustes (23/11, ~23:00 — respostas do dono)

### Quem entra numa rota que já existe vai para o lugar mais perto
*"Para esse caso, ele deve entrar no local mais próximo na sequência lógica; caso queiram alterar, é só mudar ele também."*
- **Reprogramar** um pedido para outra rota (outro dia, caminhão ou rota), **programar um pedido sozinho** numa rota que já existe e pôr uma **parada avulsa nova** numa rota que já existe: o item ganha **lugar guardado** onde o caminho (fábrica → paradas → fábrica, em linha reta) aumenta menos — a mesma regra da montagem.
- **Os que já estavam não trocam de ordem entre si**: só abrem espaço, e as posições viram 1, 2, 3….
- **Sem ponto no mapa:** entra no **fim**, com lugar guardado, e não pula quando o ponto chegar. **Rota vazia:** é a 1ª parada. **Rota antiga sem ordem salva:** primeiro fica gravada a ordem que a tela mostrava, depois o novo entra.
- Quem quiser outro lugar arrasta e salva a ordem, como sempre.
- **A montagem com vários pedidos** jogada numa rota que já existe continua como estava: o que já estava fica na ordem dele e o bloco novo entra no fim, na ordem da montagem (provisória).
- Tudo dentro da própria porta de programar/reprogramar/pôr parada — **uma chamada só**. Em "Já programadas", pôr parada deixou de ler a rota inteira antes (uma requisição a menos no clique).

### Aviso no sino quando a busca de endereço passa 1 hora fora
- **Quem recebe:** admin e logística. **Quando:** uma vez por queda, quando a busca está recusando há 1 hora ou mais. **Sem relógio novo:** o aviso nasce na própria chamada da busca que encontra o estado "fora" há ≥ 1 h e ainda não avisado; o "já avisado" fica na mesma linha reservada do cache do mapa. Quando a busca volta, o "já avisado" zera — a próxima queda avisa de novo.
- **Texto:** título "Busca de endereço fora do ar"; *"A busca de endereço está fora desde 19/11 às 13:56. Os pontos novos no mapa precisam ser marcados à mão em Editar endereço."* O toque abre **Rotas → Programação**.
- Dá para desligar por pessoa em **Configurações → Avisos** (grupo Expedição e estoque).
- A busca que **volta** não vira aviso (a faixa de Rotas some sozinha) — provisória.

### Os 2 ajustes da revisão
- O comentário da função da busca aponta o arquivo de testes certo.
- Na montagem, marcar/desmarcar um pedido não faz mais todos os cartões da lista se redesenharem (o gesto ficou estável).

### Banco dos ajustes (só em arquivo — NÃO aplicado)
- `supabase/migrations/20261124110000_plt_entra_no_lugar_mais_perto.sql` — novas `plt_privado.fn_distancia_km` e `plt_privado.fn_rota_inserir` (fora da API); recriadas por inteiro, **mesmas assinaturas**: `plt_fn_programar_entrega` (da 20261124100000), `plt_fn_programar_rota` (da 20261014140000), `plt_fn_programar_rota_paradas` (da 20261027060000) e `plt_fn_parada_avulsa_salvar` (da 20261112060000). Nenhuma tabela, coluna ou índice novo.
- `supabase/migrations/20261124120000_plt_aviso_busca_fora.sql` — `plt_privado.fn_avisos_catalogo` recriada da vigente (20261116010000) + o tipo `busca_endereco_fora`; nova porta de serviço `public.plt_fn_busca_fora_avisar()` (só `service_role`).
- A função `geocodificar` (`fluxo.ts` e `index.ts`) chama a porta nova — **publicar depois da atualização do banco**.

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

11. **(ajustes) Reprogramar para uma rota de 4 paradas.** Em Já programadas, pegue uma rota com 4 paradas em sequência (anote: 1, 2, 3, 4) e "Reprogramar" para ela um pedido cujo endereço fica perto da 2ª/3ª. Ele deve aparecer **no meio** (ex.: 3º), e os 4 de antes **na mesma sequência entre si** (só renumerados). O mesmo com um pedido sem ponto no mapa → ele vai para o **fim**. Para mudar o lugar: arraste e "Salvar ordem".
12. **(ajustes) Programar um pedido sozinho** numa rota que já tem paradas (aba Programar, marque só 1 pedido, escolha o caminhão e a rota que já existe) → ele entra no lugar mais perto, não no fim. Com 2 ou mais marcados, o bloco entra no fim (como antes).
13. **(ajustes) Parada avulsa nova** em Já programadas (e no celular do entregador): ela entra no lugar mais perto do caminho; sem ponto, no fim.
14. **(ajustes) O aviso no sino.** Só aparece com a busca fora de verdade há 1 hora — não vale derrubar a busca; está provado pelos testes (59 min não avisa; 61 avisa uma vez; a 2ª chamada não repete; voltou e caiu de novo, avisa outra vez). Para conferir sem derrubar nada: Configurações → Avisos mostra "Busca de endereço fora do ar" no grupo Expedição e estoque.

**O que já está provado por teste automático:** a regra da Geoapify e a ordem dos buscadores (26 testes), o aviso/“Tentar de novo”/faixa (11), a ordem que não muda (16), e no banco 28 conferências (tirar, reprogramar, parada, entregador, recusas, desempenho). **Ajustes:** +5 testes de tela (o aviso no sino: 59/61 min, a 2ª chamada, voltar e cair; o toque abre Rotas) e, no banco, os blocos "SESSAO-56 (ajustes) · 1" e "· 2" (29 conferências) — reprogramado no meio, sem ponto no fim e sem pular, rota vazia, rota sem ordem salva, ordem salva fora da linha preservada, parada nova, montagem como era, a marca da montagem desligada depois, permissões e o plano com volume; o aviso uma vez por queda, o texto, o público e as permissões. As 6 conferências antigas que provavam "quem muda de rota vai sem lugar" foram ajustadas à regra nova (e as da 56 que diziam "no destino entra sem ordem").
**O que NÃO foi visto no navegador:** nenhuma tela (a mesa só tem acesso ao banco de produção, que pede login) — os passos acima são a primeira vez em tela de verdade, inclusive 375 e 768.

## 4. Para ligar com o dono (nesta ordem, cada passo com o OK dele)

✅ **FEITO (Cowork, 24/11 ~00:40–00:58)** · **1. A atualização do banco** (`20261124100000_plt_ordem_da_rota_nao_muda.sql`), pelo aplicador da casa só com este arquivo (`--so`).
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

✅ **FEITO (Cowork, 24/11)** · **1b. (ajustes) A atualização do banco de "quem entra vai para o lugar mais perto"** (`20261124110000_plt_entra_no_lugar_mais_perto.sql`), **logo depois da 1**, também com `--so`.
- **Antes:** conferir que as 4 funções vivas são as que ela toma por base (`plt_fn_programar_entrega` já na versão do passo 1; `plt_fn_programar_rota`, `plt_fn_programar_rota_paradas` e `plt_fn_parada_avulsa_salvar` iguais às das migrations 20261014140000, 20261027060000 e 20261112060000 — nenhuma outra frente as recriou depois):
```sql
select p.oid::regprocedure as funcao, md5(p.prosrc) as corpo, length(p.prosrc) as tamanho
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('plt_fn_programar_entrega', 'plt_fn_programar_rota', 'plt_fn_programar_rota_paradas', 'plt_fn_parada_avulsa_salvar')
 order by 1;
-- esperado: 4 linhas, uma de cada (a de programar_entrega já com o jsonb no fim)
```
- **Depois:** as mesmas 4 assinaturas (nenhuma a mais) e as novas `plt_privado.fn_rota_inserir` e `plt_privado.fn_distancia_km`:
```sql
select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where (n.nspname = 'public' and p.proname in ('plt_fn_programar_entrega', 'plt_fn_programar_rota', 'plt_fn_programar_rota_paradas', 'plt_fn_parada_avulsa_salvar'))
    or (n.nspname = 'plt_privado' and p.proname in ('fn_rota_inserir', 'fn_distancia_km'))
 order by 1;
-- esperado: 6 linhas
```
  e, num pedido de teste, "Reprogramar" para uma rota que já tem paradas → ele aparece com número guardado (não no fim por falta de ordem).

✅ **FEITO (Cowork, 24/11)** · **1c. (ajustes) A atualização do banco do aviso no sino** (`20261124120000_plt_aviso_busca_fora.sql`), também com `--so`.
- **Antes:** conferir que o catálogo dos avisos vivo é o da 20261116010000 (nenhuma frente o recriou depois — as filas 52 a 55 ainda não estão na main; se alguma entrar antes, juntar os tipos dela com este):
```sql
select count(*) as tipos, bool_or(tipo = 'entrega_parcial_revogada') as tem_a_51, bool_or(tipo = 'busca_endereco_fora') as ja_tem
  from plt_privado.fn_avisos_catalogo();
-- esperado ANTES: tem_a_51 = true, ja_tem = false
```
- **Depois:** a mesma consulta com `ja_tem = true` e um tipo a mais; e `select has_function_privilege('authenticated', 'public.plt_fn_busca_fora_avisar()', 'execute')` = **false** (só a função da busca chama).

✅ **FEITO (Cowork, 24/11 — versão 14)** · **2. Publicar a função `geocodificar`** (os três arquivos: `index.ts`, `busca.ts`, `fluxo.ts`). **Antes do site e depois do 1c** (ela chama a porta do aviso; sem a porta, só registra que não conseguiu avisar e segue). O segredo `PLT_GEOAPIFY_CHAVE` já está lá (o dono pôs em 23/11) — não mexer nele.

✅ **VISTO NA TELA (validação de 24/11, seção 9)** · **3. Teste real de um endereço.** Abrir Rotas → Programar (o site de hoje já serve): os "procurando no mapa…" devem começar a ganhar ponto. Conferir no banco que entrou ponto pela Geoapify:
```sql
select fonte, resolvido, count(*), max(consultado_em)
  from public.plt_geocache
 where consultado_em > now() - interval '1 hour' and chave not like 'rota:%'
 group by 1, 2 order by 4 desc;
-- esperado: linhas com fonte = 'geoapify'
```
E no registro da função: nenhuma linha com "Nominatim"; se aparecer "Geoapify HTTP 401/403", a chave não foi aceita (conferir o nome do segredo). Para **ver o aviso novo** de propósito: só com a busca fora de verdade — não vale a pena derrubar; fica provado pelos testes automáticos.

⏳ **FALTA — com o dono** · **4. Publicar o site** (subir para a main publica) — só depois de 1 e 2.

⏳ **FALTA — depois do 4** · **5. A contagem de pedidos programados sem ponto, antes (do passo 2) e depois (do passo 4):**
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

**6. ✅ B3 — FEITA pelo Cowork no banco vivo em 23/11 ~22:58, com o OK do dono** (o dono respondeu: "travar já no banco; a logística edita na tela").
- Só havia **uma** rota a travar: a do **caminhão 3 (Hyundai HR), rota 1, de 24/11**, 5 pedidos.
- Ordem gravada (a que a tela mostrava): **13840 → 13960 → 13959 → 13962 → 13976** — os 3 últimos ainda estavam sem ponto, por isso no fim, pela numeração.
- Ficou o registro `rota_ordem_salva` com a origem escrita, e o aviso de Rotas foi disparado.
- A rota de 23/11 (4 de 5 entregues) não foi tocada.

## 5. Decisões provisórias (o dono confirma ou muda)

1. **Incluir um pedido na montagem** põe ele no lugar onde o caminho aumenta menos, sem mudar a ordem dos outros (da demanda). Quando dá no mesmo (só uma parada na rota), o mais perto da fábrica vai primeiro.
2. **A numeração sem buracos é só na tela** — no banco pode ficar 1, 3, 4; a tela mostra 1, 2, 3.
3. **A faixa "a busca está fora"** aparece só em Rotas, e para quem tem endereço novo a procurar; o "desde" conta a partir da primeira recusa depois de publicar.
4. **Os textos dos avisos** são os da demanda, ao pé da letra; na montagem, quando a ordem não é a sugerida, o texto ficou "Ordem da montagem (diferente da sugestão) — ela não muda sozinha".
5. **A pausa de 0,25 s** entre consultas à Geoapify; até 2 consultas por endereço (a certeira e, se não bastar, a com o bairro), mais as de bairro/cidade quando a rua não existe.
6. **O "não achei"** fica registrado como procurado pela Geoapify.
7. **Tirar com a lista incompleta na tela** (a rota não coube inteira na página): o que a tela não mostrava fica depois, na ordem que tinha — em vez de recusar o gesto.
8. ~~O aviso no sino não entrou~~ ↪️ entrou nos ajustes (o dono disse "sim").

**Provisórias novas dos ajustes:**

9. **A montagem com vários pedidos** numa rota que já existe continua como estava: o bloco novo entra no fim, na ordem da montagem.
10. **A parada avulsa nova** segue a mesma regra do pedido (lugar mais perto; sem ponto, no fim) — na logística e no celular do entregador (que depois arrasta, como já fazia).
11. **Na montagem, um pedido só** conta como "programar sozinho" (lugar mais perto); dois ou mais, como montagem (no fim).
12. **Dois pedidos no MESMO ponto do mapa** (mesmo endereço): o novo entra junto, logo antes do que já estava lá (a mesma regra de empate da tela).
13. **O aviso de busca fora:** tipo "Busca de endereço fora do ar", no grupo Expedição e estoque, para admin e logística; o toque abre Rotas → Programação.
14. **A busca que volta não vira aviso no sino** (a faixa some sozinha).
15. **A chamada que só leu do cache também avisa**, se encontrar a busca fora há 1 hora ou mais e ainda não avisada.

## 6. Ficou pendente

- ~~Ver as telas no navegador~~ ↪️ **feito em 24/11** (seção 9); ficou sem prova de tela só o que exige rota gravada (ver a seção 9).
- ~~Pedido reprogramado entra na rota de destino sem lugar guardado~~ ↪️ **resolvido nos ajustes** (o dono respondeu: lugar mais perto).
- **A pergunta da faixa "busca fora" para todos** (hoje só aparece para quem tem endereço novo a procurar) **segue aberta** — o dono vai responder.
- **Entregue / não entregue numa rota antiga sem ordem salva** ainda recalcula o que sobra — a B3 já travou a única rota que restava (24/11), então só volta a acontecer com rota nascida pelo site de antes, até o site novo subir.
- ~~A parada avulsa posta numa rota antiga sem ordem entra como 1ª~~ ↪️ resolvido nos ajustes (a ordem da tela é gravada antes e ela entra no lugar mais perto).
- **"Tentar de novo ao voltar à aba do navegador"** não entrou (a casa não tem esse gatilho geral); vale o reabrir a aba de Rotas e o botão.
- **O plano das portas no banco vivo** (só foi medido no banco de teste, com volume).
- **ClickUp:** não mexido (regra da fila) — as duas tarefas seguem com o dono.
- A função `candidatosNominatim` ficou em `busca.ts` só porque os testes antigos da escolha a usam; pode sair numa limpeza.

## 7. Para entrar nas notas depois da dieta

- **[[PLT - Decisoes de Produto]]** (números a dar): buscador principal = Geoapify, Photon de reserva, Nominatim fora (↩️ revisa a D-112 e a parte do buscador da SESSAO-45); a tela avisa e oferece marcar/tentar de novo quando a busca não responde; a faixa de "busca fora"; a sugestão só propõe e a ordem mostrada é a que vale (↩️ revisa a D-109 e a D-111); tirar não reordena; pedido que ganha ponto não muda de lugar; + as 8 provisórias da seção 5.
- **[[PLT - Memoria de Aprendizado]]:** as lições L1–L6 do diário (dependência externa precisa de falha visível; a bateria é quem diz o que é contrato; assinatura nova × bateria que reaplica migration antiga; chave na URL nunca vai para mensagem de erro; estado pequeno numa linha reservada; script com aspas não vai por heredoc nesta máquina).
- **[[SUPA - Esquema do Banco]]** (e `supabase-fabrica-schema.sql`, depois de aplicar): `plt_geocache` — fonte nova `geoapify`, e a linha reservada `estado:busca-de-endereco` (`fonte = 'estado'`, o dado em `rota`: `{fora_desde, avisado}`); as assinaturas novas das três portas e a `plt_privado.fn_rota_ordem_que_fica`. **Ajustes:** `plt_privado.fn_rota_inserir` e `fn_distancia_km`; a marca `plt.rota_montagem` (a montagem não usa o lugar mais perto); `plt_fn_programar_entrega`/`plt_fn_parada_avulsa_salvar` com a inserção; o catálogo dos avisos + `busca_endereco_fora` (Expedição e estoque, logística); a porta de serviço `plt_fn_busca_fora_avisar()`.
- **Ajustes — para as Decisões:** quem entra numa rota que já existe vai para o lugar mais perto (↩️ revisa a D-109, "noutro dia/caminhão vai para o fim"); o aviso no sino com a busca fora há 1 hora; + as provisórias 9–15 da seção 5. **Para a Memória:** as lições L7 e L8 do diário.
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
— ajustes —
supabase/migrations/20261124110000_plt_entra_no_lugar_mais_perto.sql   (novo — NÃO aplicado)
supabase/migrations/20261124120000_plt_aviso_busca_fora.sql           (novo — NÃO aplicado)
supabase/functions/geocodificar/fluxo.ts · index.ts                   (o aviso no sino — NÃO publicada)
supabase/testes/testar-migrations.mjs   (blocos "SESSAO-56 (ajustes)"; 6 conferências antigas ajustadas; reaplicação)
src/rotas/AbaProgramar.tsx · AbaJaProgramadas.tsx · ModalProgramar.tsx · src/paginas/EntregasDoDia.tsx
src/notificacoes/api.ts · src/rotas/buscaGeoapify.test.ts
_docs/Plataforma/Demandas/SESSAO-56 - … .md · _docs/Plataforma/Execucao/SESSAO-56.md · este handoff
```

## 9. Validação no navegador (24/11, ~00:40–00:50 — fila do Escritório)

Site desta mesa rodando local, contra o banco de produção (já com as 3 atualizações e a função nova), entrando com o usuário de teste (enxerga Rotas). Prints em `C:\Users\wccau\.escritorio\telas\domoby\sessao-56c-validar-no-navegador\` (01 a 19). Console: 0 erros.

| Item | Resultado | Prints |
|---|---|---|
| 1. Busca pela Geoapify | ✅ Programar: 9 "procurando no mapa…" → 0 em < 30 s, os 30 pedidos com ponto. Já programadas: 13961 (23/11) e 13959, 13962, 13976 (24/11) ganharam ponto em < 15 s; nenhum "procurando" parado. **13962 (Lagoa Azul) e 13976 (Tirol) caíram no ponto da cidade** ("ajustar o pino") — a logística acerta o pino. | 01, 02, 03 |
| 2. Busca digitada (parada avulsa) | ✅ "Av. Eng. Roberto Freire, Ponta Negra" → pino em Ponta Negra | 04 |
| 3. "Powered by Geoapify" | ✅ rodapé dos mapas (Programar, Já programadas, mini-mapa de Entregas do dia) e embaixo do "Achar no mapa"; sem rolagem lateral em 1366, 768 e 375 | 12, 14, 18 |
| 4. A ordem não se mexe sozinha | ✅ **na montagem** (paradas TESTE AGENTE): arrastar, tirar a 3ª (as outras na mesma sequência, renumeradas), pôr uma nova (entrou no lugar mais perto sem trocar as outras); 375 e 768 iguais. **Sem prova de tela:** rota gravada — a tela não deixa programar rota só com paradas avulsas e programar pedido real é proibido; fica a prova da bateria do banco | 05–08, 11, 13 |
| 5. Montagem com pedidos | ✅ incluir 2 pedidos (sem programar) não trocou as paradas entre si; desmarcar um não reordenou; "Limpar" deixou tudo vazio | 09, 10, 15 |
| 6. Aviso "não respondeu" / faixa "busca fora" / sino | ⚪ não dá para derrubar a busca — provados pelos testes automáticos; Configurações → Avisos mostra "Busca de endereço fora do ar" (grupo Expedição) | 19 |
| 7. Rota de 24/11 do Hyundai HR | ✅ 13840 → 13960 → 13959 → 13962 → 13976, antes e depois dos pontos; igual em Entregas do dia; sem "Salvar ordem" (já gravada). Não tocada | 03, 16, 17, 18 |

**Testes:** lint e build limpos. A bateria de tela teve falhas por tempo esgotado em telas que a 56 não tocou (cada rodada em arquivos diferentes; todas passam isoladas) — instabilidade da máquina carregada, não defeito.

**Veredito: pronto para subir o site (passo 4).** Depois, a contagem do passo 5.
