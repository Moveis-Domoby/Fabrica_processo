---
titulo: "Memória de aprendizado — Migrations Aplicador e Ensaio (parte 2 de 2)"
tipo: memoria-tema
tema: migrations
atualizado: 2026-11-18
tags: [memoria, aprendizado, tema/migrations]
---

# 🧠 Memoria - Migrations Aplicador e Ensaio 2

> Lições deste tema, movidas de [[PLT - Memoria de Aprendizado]] em 18/11/2026 sem reescrever. Entrada nova entra **aqui**, na seção do tipo dela, com o id no título (`### E-NNN`); o próximo número livre está no índice.

## 🔴 Erros e correções (E-NN)

### E-19

- [2026-08-28] **E-19** (Claude Code) · Reaplicar as migrations no banco real quebrou: a migration ANTIGA recria o `check` de tipos de evento com a lista da ÉPOCA, e o banco já tinha linhas dos tipos criados por migrations FUTURAS → **correção:** o check das migrations antigas vira `not valid` (valida só linhas novas) e a migration MAIS NOVA do check valida tudo. **Lição: constraint recriada por migration antiga precisa tolerar o futuro que o banco já viveu — o teste de 2 rodadas não pega porque os dados de cenário nascem DEPOIS das rodadas.** ↪️ 21/09 (S22): o **`validate constraint` da migration antiga também muda de casa** — a migration 25 validava a lista da época dela e quebraria a reaplicação num banco com os tipos de pausa; validar é papel exclusivo da migration MAIS NOVA do check.

### E-136

- [2026-10-21] **E-136** (Claude Code, SESSAO-38 · F5) · O [[Memoria - Migrations Aplicador e Ensaio 1#E-81|E-81]] de novo: o bloco da bateria da frente dos cards REAPLICA a migration dela (20261022010000) no meio da bateria — ela recria o quadro do PCP, a janela, o "junto" do quadro e o check dos eventos SEM o stand-by, e o meu bloco (mais abaixo) quebrou com "violates check constraint plt_eventos_tipo_check" → **correção:** o bloco dela reaplica as duas na ordem de produção (a dela e a do stand-by). **Lição: antes de recriar função de outra frente, procurar no harness quem reaplica a migration dela (`MIGRATIONS, '2026…`) — a reaplicação no meio da bateria desfaz quem veio depois.**

### E-137

- [2026-10-21] **E-137** (Claude Code, SESSAO-38 · F5) · O ensaio da migration no banco real (begin → migration com DDL → gestos como a pessoa do PCP → a abertura das 21 pessoas → rollback) durou **~15 s** com as travas da DDL em `plt_cards`: cada chamada daqui ao banco custa ~100 ms de ida e volta e a volta pelas 21 aberturas foi pela rede (madrugada, 03:50 de Natal — ninguém usando; nada gravado, conferido) → **correção:** depois de aplicar, as medidas foram feitas num bloco `DO` dentro do banco ([[Memoria - Acesso Seguranca e Credenciais#A-75|A-75]]: 5× cada porta, `clock_timestamp`), sem DDL aberta. **Lição (primo do [[Memoria - Migrations Aplicador e Ensaio 1#E-66|E-66]]): ensaio com DDL é só a migration + 2–3 conferências; laço de chamadas pela rede e medidas vão para depois de aplicar, num bloco dentro do banco.**

### E-144

- [2026-10-21] **E-144** (Claude Code, SESSAO-39) · O [[Memoria - Migrations Aplicador e Ensaio 1#E-81|E-81]]/E-136 pela terceira vez: recriei o check dos tipos de motivo (o 'mover') e movi o `validate` para a minha migration ([[Memoria - Migrations Aplicador e Ensaio 2#E-19|E-19]]), mas um bloco da bateria da SESSAO-38 REAPLICA a migration do stand-by no meio dos testes — o check voltou sem o 'mover' e o meu bloco quebrou ao cadastrar motivo do Mover ("current transaction is aborted" escondendo a causa) e o F5 acusou o check não validado → **correção:** o bloco que reaplica a do stand-by reaplica também a do Mover logo depois (ordem de produção) e a frase do teste do F5 passou a dizer que cada check é validado pela migration mais nova dele. **Lição (a mesma do [[Memoria - Migrations Aplicador e Ensaio 2#E-136|E-136]], agora regra de partida):** antes de recriar check/função de outra frente, `grep "MIGRATIONS, '2026"` na bateria — quem reaplica a migration dela tem de reaplicar a sua em seguida.

### E-147

- [2026-10-21] **E-147** (Claude Code, SESSAO-39) · O primeiro ensaio ×100 não terminava: a geração dos fatos escolhia "o k-ésimo card/pessoa" com subconsulta `order by id offset k limit 1` POR LINHA (150 mil linhas × varredura) — e os pedidos vivos estavam em ×20, não ×100. → **Correção:** carga sem gatilhos (`session_replication_role = replica`) e as escolhas por JUNÇÃO com tabelas numeradas (`row_number()` + índice) — 200 mil fatos em ~24 s; vivos em ×100 (5.000). **Regra ([[Memoria - Regras de Negocio - Producao PCP Estoque e Rotas 2#A-103|A-103]]):** ensaio de volume gera dados por junção, nunca por subconsulta por linha; conferir a escala de CADA tabela contra o ×100 de hoje.

### E-157

- [2026-10-23] **E-157** (Claude Code, SESSAO-40) · O [[Memoria - Processo de Sessao Cofre e Dono#E-142|E-142]] de novo, agora com PRODUTOS: o bloco novo da bateria usou os produtos `940001/940002` e os SKUs `S40A/S40B` — os mesmos do bloco da "migration 40" (o número da migration virou prefixo de dado de teste lá atrás). O `on conflict do nothing` manteve o produto antigo, com uma reposição aberta de outro bloco, e 3 conferências do lançamento falharam com um card a mais ("3 + 2" virou 6) → **correção:** produtos `1940401/1940402`, SKUs `SX40A/SX40B` e um nome de móvel que só o bloco usa ("Estante Trello 40"), porque a busca pelo nome também esbarrou em "Estante Teste" de outros blocos. **Lição: a faixa reservada na bateria vale para TODO dado de teste — pessoas, produtos, SKUs, números de pedido e até nomes que a busca vai procurar; conferir com `grep` antes que o número/nome está livre no arquivo inteiro.**

## 🟢 Acertos que viraram padrão (A-NN)

### A-10

- [2026-08-26] **A-10** (Claude Code) · **Testar migration contra o esquema REAL de produção antes de aplicar**: carregar o `.sql` da integração num Postgres descartável, rodar as migrations DUAS vezes e comparar uma impressão digital (md5 da estrutura) das tabelas existentes antes/depois. Foi isso que deu confiança para aplicar num banco com integração viva.

### A-73

- [2026-10-17] **A-73** (Claude Code, SESSAO-33) · **Ensaio ×100 ANTES de subir pega o que a bateria não pega.** A bateria provou que tudo funcionava; o ensaio com o volume ×100 (e a carga de 3 milhões de linhas na fila) mostrou que três coisas já falhavam no volume de HOJE — "Pausar" linha a linha, a fila varrendo as pausadas, o painel contando a fila. Padrão: interruptor em vez de marcar linhas; índice na ordem em que a fila lê (`conta, prioridade, id`) com o teto resolvido uma vez; contas prontas mantidas por gatilho de instrução (tabela de transição) e de linha (só quando a situação muda); "quantos aqui" calculado quando o dado chega, não a cada abertura; números de fila com teto ("mais de 10 mil"); consulta "existe?" com `order by … limit 1` para o planejador andar no índice. O programa do ensaio fica em `Execucao/dados/` — reaproveitar.

### A-79

- [2026-10-18] **A-79** (Claude Code, SESSAO-33 — em casa, migration 93) · **Limite que depende da data de hoje se confere na hora da CHAMADA, não só na hora de enfileirar — e resposta que repetir não muda encerra sem barulho.** O plano da loja aceita "os últimos 2 anos" contados de hoje: o piso anda um dia a cada meia-noite, e a fila guarda linhas por horas (a carga leva a noite) — a janela que nasceu no piso de ontem pediria um dia antes do que o Tiny aceita. Padrão: o piso numa função só (`fn_tiny_piso`), aplicado ao enfileirar E na reserva do lote, com a data acertada GRAVADA na linha (a página seguinte e o "quantos aqui" leem a mesma janela que se pediu); o que o Tiny devolve igual a cada tentativa (31 — fora do plano; 403 — o aplicativo sem o módulo) vira resposta final, com o motivo em português e sem sino; o painel tira da comparação o que o Tiny não conta (nem zero, nem "contando…" para sempre) e mostra o motivo onde o dono já olha (os últimos erros); e uma função de acerto, idempotente, conserta o que já estava na fila no mesmo gesto da aplicação. Ao recriar várias funções de uma vez: o md5 do corpo de cada uma no banco contra o do arquivo (programa) e o texto copiado por extração, nunca à mão ([[Memoria - Migrations Aplicador e Ensaio 1#E-24|E-24]]).

### A-86

- [2026-10-21] **A-86** (Claude Code, SESSAO-38 cards) · **Bloco de conversão de dados dentro da migration se prova rodando a MIGRATION DE NOVO na bateria, depois de semear o caso** (a etiqueta "URGENTE" num card): prova a conversão com linha de verdade e a idempotência com dados que as duas rodadas não têm (primo do [[Memoria - Migrations Aplicador e Ensaio 2#E-19|E-19]]/E-41 — o banco real já viveu o que a rodada não viveu).

### A-90

- [2026-10-21] **A-90** (Claude Code, SESSAO-38) · **Mudar a REGRA de uma porta mexe nos testes antigos que amarravam a regra velha** — a bateria acusou só 2 (as mensagens "não foi lançado"); conferir cada vermelho: se é a regra antiga (atualizar com nota ↩️) ou o efeito colateral (consertar). Guardar a função copiada do banco real (md5 do corpo vivo = md5 do arquivo) antes de recriar — as 12 bateram.

### A-97

- [2026-10-21] **A-97** (Claude Code, SESSAO-38 · F5) · **Recriar porta de outra frente por EXTRAÇÃO, nunca à mão:** um gerador (no scratchpad) lê a última `create or replace function` da migration viva, confere o md5 do corpo contra `pg_proc.prosrc` do banco, aplica trocas de texto com contagem exigida (exatamente 1 ocorrência — senão para) e monta a migration nova. Oito portas grandes (a janela do card tem 10 KB) recriadas sem um caractere copiado à mão; depois de aplicar, o md5 de cada corpo no banco bateu com o arquivo. Quando a frente dona avisou "chame, não recrie" (o concluir do pedido), bastou tirar o bloco do gerador e gerar de novo.

### A-131

- [2026-10-31] **A-131** (Claude Code, SESSAO-42) · **Ensaio ×100 sem fatos:** semear as projeções direto com `set session_replication_role = replica` (gatilhos e chaves desligados no semear), `analyze` e medir a 2ª chamada — 300 mil passagens e 600 mil trechos em ~60 s no PGlite.

### A-132

- [2026-10-31] **A-132** (Claude Code, SESSAO-42) · **Banco de desenvolvimento em segundos:** o preâmbulo da bateria + as 122 migrations guardados num retrato do PGlite (`dumpDataDir('gzip')` → `loadDataDir`); cada rodada aplica só as migrations novas (duas vezes) e uma prova `.sql`/`.mjs` — 8 s em vez de ~2 min. Rodar UM bloco da bateria nele: recortar o texto do bloco e executar com `AsyncFunction('bd','conferir','titulo', corpo)`.

### A-199

- [2026-11-09] **A-199** (Claude Code, SESSAO-47) · **Explorador do banco do ensaio já montado:** o ensaio ×100 grava o PGlite em disco; um programa de 40 linhas reabre a pasta e roda as consultas de um arquivo (`--==` separa, mediana de N rodadas, `explain` com tempo). Provar uma hipótese de plano custa 1 minuto em vez dos 6 de remontar — as duas correções de desempenho do bloco A foram escolhidas assim, comparando a regra de antes, a commitada e a candidata no MESMO banco.

### A-203

- [2026-11-09] **A-203** (Claude Code, SESSAO-47) · **A bateria do banco de frentes paralelas se junta por PROGRAMA, não à mão:** as duas frentes põem um bloco novo no mesmo ponto do arquivo e o conflito sai entrelaçado (linhas iguais no meio dos dois blocos). `juntar-bateria.mjs`: tira do arquivo da frente o bloco novo dela, junta o resto em três vias (`git merge-file --diff3`), resolve o único conflito que sobra (a lista de reaplicação — as duas entradas, a nossa antes) e põe o bloco da frente depois dos nossos; no fim, `node --check`. A segunda junção da mesma frente (commits posteriores) sai limpa.

### A-210

- [2026-11-09] **A-210** (Claude Code, SESSAO-47) · **A guarda do plano sob medida tem preço — medir COM e SEM antes de deixá-la.** `plan_cache_mode` posto na função vale também para as funções chamadas por dentro dela (cada uma replaneja a cada linha): no calendário das rotas, 6 semanas levavam 3,0 s com a guarda e 1,2 s sem. Lá, quem fazia o plano genérico desandar era um pré-filtro (`pedido in (os do período união os de data mudada)`) que não tirava linha nenhuma — a condição final já o implicava. Tirado o pré-filtro, 8 chamadas seguidas respondem igual em qualquer ordem de período, e a guarda saiu (migration `20261109050000`). **Ordem do remédio: primeiro achar a consulta que desanda; a guarda é o último recurso.** A bateria amarra a mesma resposta, letra por letra, antes × depois.

### A-211

- [2026-11-09] **A-211** (Claude Code, SESSAO-47) · **Subida num programa só, pronto ANTES de pedir o OK:** (1) confere, só lendo, o md5 do corpo de cada função que será recriada contra o último `create` das migrations já aplicadas (fim de linha normalizado) — para na primeira diferença, antes de escrever; (2) aplica as migrations na ordem pelo aplicador da casa (`--so`, uma transação cada, a integração do Tiny conferida em cada uma; o falso alarme de "linhas mudaram" por um aviso do Tiny no meio não derruba); (3) manda o ramo para a `main`. A conta local do md5 se prova antes num banco de ensaio (o que o Postgres calcula do `prosrc` = o calculado do arquivo). Em 09/11: 31 funções, 31 iguais; 5 migrations; site publicado — num comando.

### A-215

- [2026-11-11] **A-215** (Claude Code, SESSAO-48 · frente 3) · **Procura "por candidato" com o ensaio ×100 antes de fechar a tela (368 → 33 ms típico, 75 ms pior caso):** ler a fila do PCP UMA vez (o índice parcial da fila), os itens de cada pedido pela chave do item (`lateral` — o custo é o tamanho da fila, nunca a popularidade do móvel) e só as primeiras linhas, na ordem, pagam a regra e a conta cara, até o 10º. `setor in (select …)` × `= any(array(…))` muda o índice que o planejador escolhe.

### A-217

- [2026-11-11] **A-217** (Claude Code, SESSAO-48) · **Frentes em paralelo, cada uma na sua cópia (worktree no rascunho), juntadas na ordem dos números:** a base primeiro (o que as outras leem); cada frente com migration reservada, faixa de teste própria (pedidos/produtos) e escopo próprio na bateria; arquivos compartilhados só com acréscimo no FIM (`api.ts`) e a migration na cadeia do bloco 38 logo depois da base; antes de juntar, conferir por programa que nenhuma função é recriada por duas migrations (`sobreposicao.mjs`); conflito na bateria = "as duas acrescentaram no mesmo lugar" → manter as duas em ordem de número ([[Memoria - Git Shell e Windows 1#E-262|E-262]]).

### A-229

- [2026-11-12] **A-229** (Claude Code, SESSAO-50) · **Ensaio com a máquina dividida (três frentes + bateria ao mesmo tempo):** só comparar ANTES × DEPOIS da MESMA rodada, intercalados; número de rodadas diferentes não se compara (a rodada 2 do ×100 do bloco B saiu ~2× mais lenta só por dividir a máquina com a bateria). Para o número final, rodar sozinho.

### A-242

- [2026-11-17] **A-242** (Claude Code, SESSAO-51) · **Porta que "piorou" no ensaio ×100: A/B no MESMO banco antes de concluir.** O ANTES × DEPOIS do ensaio mede em bancos diferentes (entre as duas medidas entram os dados novos e um `analyze`) — o quadro do PCP deu 81 → 96 ms. Trocando só o corpo da função (a versão de antes × a nova, 3 rodadas alternadas, mesmo banco) deu 74–83 ms as duas e +0,3% de blocos lidos. Roteiro: extrair o `CREATE` da função das duas migrations, `bd.exec(corpo)`, medir, trocar, medir.

### E-302

- [2026-11-18] **E-302** (Claude Code, SESSAO-54) · **O bloco novo da bateria usou os ajudantes de outro bloco** (que moram num escopo próprio) e o erro só apareceu no fim de uma rodada de 7 minutos; na troca em massa, um nome novo colidiu com um contador que já existia (mais uma rodada perdida). *Correção:* bloco novo nasce com os seus ajudantes; antes de rodar, buscar cada nome novo no bloco — `node --check` não pega nenhum dos dois.

### E-303

- [2026-11-18] **E-303** (Claude Code, SESSAO-54) · **Remover uma função do banco quebra conferências antigas da bateria** (ela aplica tudo antes de conferir). *Correção:* procurar o nome na bateria inteira ANTES de escrever a migration e ajustar as conferências antigas no mesmo commit, dizendo o porquê.

### A-259

- [2026-11-18] **A-259** (Claude Code, SESSAO-55) · **Ensaio ×100 que se monta sozinho:** carrega o esquema + todas as migrations, reusa a semeadura do ensaio da SESSAO-47 e mede antes × depois; fora do teto, mede leitura por leitura (diz qual pesa).

### E-311

- [2026-11-18] **E-311** (Claude Code, SESSAO-55) · **Ensaio fora da bateria sem os grants que o Supabase dá por padrão ao `authenticated`.** *Correção:* repetir o bloco que concede o esquema `auth` e a leitura de `public` (menos a tabela de usuários).

### E-314

- [2026-11-23] **E-314** (Claude Code, SESSAO-56) · **"Aproveitar" para melhorar o destino da reprogramação quebrou 6 conferências antigas.** *Correção:* a bateria é quem diz o que é contrato; o que a demanda chama de "certo" não se mexe sem o dono.

### E-315

- [2026-11-23] **E-315** (Claude Code, SESSAO-56) · **Assinatura nova (drop + create) × bateria que reaplica migration antiga no meio:** a antiga recria a assinatura velha. *Correção:* reaplicar a nova logo depois, no bloco que a testa.

### A-262

- [2026-11-23] **A-262** (Claude Code, SESSAO-56) · **Regra nova do dono que revisa uma antiga:** as conferências antigas que provavam a regra velha mudam JUNTO, no mesmo commit, com o porquê ao lado. Diferente de "aproveitar": aqui é a resposta do dono.

### E-317

- [2026-11-23] **E-317** (Claude Code, SESSAO-56) · **A bateria reaplica migrations antigas no meio:** a 1ª rodada passou "verde" provando a versão velha da porta. *Correção:* toda porta recriada por uma migration nova é reaplicada no bloco que a testa.

### A-263

- [2026-11-24] **A-263** (Claude Code, subida de 24/11) · **Juntar várias entregas que acrescentam blocos à bateria no mesmo ponto:** o git encaixa o bloco novo *depois do último bloco que já existe* sempre que o contexto bate — a ordem final dos blocos pode sair diferente da ordem dos cherry-picks **sem conflito nenhum**. Conferir a ordem pelos títulos dos blocos no fim e, para cada ramo, procurar o trecho inteiro da versão do próprio ramo no arquivo final (e cada linha que ele acrescentou no meio).
