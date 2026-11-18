---
titulo: "Memória de aprendizado — Migrations Aplicador e Ensaio (parte 1 de 2)"
tipo: memoria-tema
tema: migrations
atualizado: 2026-11-18
tags: [memoria, aprendizado, tema/migrations]
---

# 🧠 Memoria - Migrations Aplicador e Ensaio 1

> Lições deste tema, movidas de [[PLT - Memoria de Aprendizado]] em 18/11/2026 sem reescrever. Entrada nova entra **aqui**, na seção do tipo dela, com o id no título (`### E-NNN`); o próximo número livre está no índice.

## 🔴 Erros e correções (E-NN)

### E-24

- [2026-09-01] **E-24** (Claude Code) · A reaplicação completa das migrations (S13) **ressuscitou em silêncio** o gatilho antigo de `pedidos` e desfez a blindagem que a frente do backfill tinha aplicado DIRETO no banco — resultado: ~163 cards de pedidos históricos no PCP → **correção:** migration 24 espelha os 2 gatilhos blindados no repo (SESSAO-14). **Lição: ajuste aplicado direto no banco, fora do repo, morre na próxima reaplicação — todo ajuste de produção ganha espelho em migration NO MESMO DIA.**

### E-41

- [2026-09-24] **E-41** (Claude Code) · A migration 35 quebrou SÓ em produção: o `update` de backfill em `plt_tarefas` esbarrou nas tarefas do Sistema que JÁ existiam lá (o trigger de imutabilidade delas recusa UPDATE sem a flag `plt.tarefa_sistema`) — no PGlite as tarefas do sistema só nascem DEPOIS das rodadas, então o teste de 2 rodadas não pega → **correção:** backfill dentro de `do $$` com a flag da maquinaria ligada. **Lição (primo do [[Memoria - Migrations Aplicador e Ensaio 2#E-19|E-19]]): toda migration que atualiza tabela guardada por trigger de imutabilidade/estado precisa usar a mesma flag da maquinaria — o banco real já viveu o futuro que o harness ainda não viveu.** O aplicador roda o arquivo atômico: nada parcial ficou.

### E-46

- [2026-09-27] **E-46** (Claude Code) · O [[Memoria - Tiny n8n e Integracoes 1#E-36|E-36]] de novo: na conferência de leitura antes de aplicar a migration 37, escrevi `plt_vw_execucoes.finalizada_em` de memória — o banco recusou ("column does not exist"; só leitura, sem dano) → **correção:** o nome certo, `finalizou_em`, saiu da própria dica do Postgres e foi conferido na nota do esquema. **Lição: o E-36 não se resolve com boa intenção — antes de mandar QUALQUER consulta ao banco real, grep do nome na nota do esquema (ou na migration); vale até para uma linha de contagem.**

### E-61

- [2026-09-28] **E-61** (Claude Code, ajustes do estoque) · A migration nova quebrou no harness com "syntax error at end of input", sem linha: no `IF … < case when … then 0 else 1 end THEN` do plpgsql, o parser do IF lê a condição até o PRIMEIRO `then` fora de parênteses — o do CASE — e o resto vira lixo → **correção:** o CASE entre parênteses. Achado fatiando a migration por seção sobre as anteriores e depois testando cada construção isolada no PGlite. **Lição: CASE dentro da condição de IF/ELSIF/WHILE do plpgsql vai SEMPRE entre parênteses (no RAISE e na atribuição ele passa); e erro sem posição se acha bisseccionando o arquivo, não relendo.**

### E-81

- [2026-10-02] **E-81** (Claude Code, ajuste da SESSAO-27) · A migration 52 recria a porta da Auditoria (que mora na 51), mas o bloco 51 do harness **reaplica a 51 sozinha** no começo e no fim — a porta voltava à versão sem a marca e o teste "linhas da automação excluída vêm marcadas" falhou (a porta certa nunca chegou a ser testada) → **correção:** o bloco reaplica **51 → 52**, na ordem de produção; verde. **Lição: quando uma migration nova recria função de uma anterior que o harness reaplica no meio, o harness tem de reaplicar as duas na ordem — senão o teste valida a versão velha.**

### E-73

- [2026-09-30] **E-73** (Claude Code, Ajuste Estoque 2) · Apliquei a migration 45 em produção (com o OK do dono) **com as telas correspondentes ainda só na branch** — o site publicado, com as telas VELHAS, quebrou na hora em Estoque → Configurações: o resumo chamava a porta com a assinatura antiga (404) e dois botões chamavam funções dropadas. A frente do sincronismo viu e o dono viu na tela → **correção:** migration das abas (47) aplicada E a main publicada no MESMO passo; o descompasso durou minutos. **Lição: migration que muda assinatura ou derruba porta usada pelo front PUBLICADO só se aplica JUNTO da publicação das telas — aplicar banco e publicar front são UM gesto; se a publicação depende de validação, a aplicação espera com ela.**

### E-59

- [2026-09-28] **E-59** (Claude Code) · No ajuste da gaveta, disse ao dono — e escrevi no handoff, na memória de execução e na memória do Claude — que a sessão do Frete tinha **aplicado** a migration 39 às 13:00: deduzi do `statement:` da migration no `postgres_logs`, logo antes das travas que derrubaram 3 leituras do meu preview (500). Era um **ENSAIO** (transação desfeita com ROLLBACK às 13:00:49; a troca do gatilho em `plt_cards` segurou a AccessExclusiveLock até lá) — a 39 não foi aplicada; a própria frente esclareceu por SendMessage, e nenhuma gravação da integração caiu → **correção:** textos corrigidos no mesmo dia e o dono avisado. **Lição: `statement:` de migration no registro do banco prova que ela RODOU, não que FICOU — ensaio ([[Memoria - Testes e Validacao ao Vivo#A-11|A-11]]) aparece igual; estado de produção só se afirma ao dono depois de conferir no banco (migrations aplicadas / objeto vivo) ou com a frente dona.** (O lado da frente do Frete — ensaio segurando trava — está no [[Memoria - Migrations Aplicador e Ensaio 1#E-66|E-66]] dela, com `lock_timeout`.)

### E-66

- [2026-09-28] **E-66** (Claude Code, ajuste do Frete) · "Desfeito" não é "invisível": meus ensaios da migration 39 no banco real (transação → a migration → medir → ROLLBACK) montavam a troca do gatilho em `plt_cards`, e `DROP/CREATE TRIGGER` pede **trava exclusiva da tabela até o fim da transação**. O ensaio de MEDIÇÃO (EXPLAIN ANALYZE 5× em 10 portas com a mudança montada) segurou `plt_cards` ~33 s (10:00:16–10:00:49): **6 leituras da tela de outra sessão caíram por tempo esgotado** (500) e o Realtime atrasou ~10 s. Nenhuma gravação da integração no período (só o `fn_fila_proximos` do n8n, todos 200 — conferido nos registros do Supabase) → **correção:** a migration passou a abrir com `set local lock_timeout = '5s'` (sem a trava em 5 s, desiste inteira em vez de enfileirar as telas) e a aplicação é UMA transação curta (~0,5 s). **Lição: ensaio com DDL no banco real trava o que a DDL toca até o ROLLBACK — ensaio com DDL é curto (montar, conferir, desfazer); medição longa não carrega DDL aberta (ou roda com lock_timeout, fora do horário de uso); e aviso às sessões paralelas ANTES, como se fosse aplicação.**

### E-107

- [2026-10-16] **E-107** (Claude Code, SESSAO-32) · Na bateria, renomear `vendas_marketing` → `_v26` com `\b…\b` pegou também o texto `'vendas_marketing:'` da chave md5 do pedido — todas as 525 linhas "diferiam". **Correção:** a regra de renomear não toca o nome seguido de `:` (`(?!:)`); renomear objeto em texto de SQL é por referência, nunca por palavra solta.

### E-108

- [2026-10-16] **E-108** (Claude Code, SESSAO-33) · Pelo conector da Supabase, **todo comando com `DROP` fica parado esperando a confirmação do dono e estoura em 60 s** — três tentativas de aplicar a migration 88 (com `begin…commit`, pelo `apply_migration` e até um `drop` numa transação desfeita com `statement_timeout`) morreram assim; nada rodou nem ficou pela metade. `REVOKE` e `ALTER … RENAME` passam. **Correção:** tirar a função antiga da API sem apagar — `ALTER FUNCTION … RENAME` + `SET SCHEMA plt_privado` + `REVOKE` de todos — e deixar o `DROP` para a próxima atualização aplicada em casa pelo aplicador. **Lição: aplicar pelo conector é sem `DROP`; o que precisa apagar vai para o aplicador.**

### E-110

- [2026-10-17] **E-110** (Claude Code, SESSAO-33) · Rodei `prettier --write` junto com os arquivos do site e incluí a bateria (`supabase/testes/testar-migrations.mjs`): ela **não é formatada por convenção** (14 mil linhas de SQL dentro de texto) e o commit saiu com ~18 mil linhas trocadas só de espaço — revisão impossível e conflito certo com as outras frentes. **Correção:** reconstruí o arquivo a partir da versão anterior com só as 9 linhas de verdade (diferença entre a versão anterior formatada e a atual = as mudanças reais) e rodei a bateria de novo. **Lição: formatar só o que a casa já formata (o `src/`); antes de todo commit, `git diff --numstat` — número de linhas fora da proporção do que se mexeu = parar e olhar.**

### E-159

- [2026-10-27] **E-159** (Claude Code, SESSAO-41) · O [[Memoria - Migrations Aplicador e Ensaio 2#E-19|E-19]]/E-144 de novo, duas vezes: (1) a migration nova recriou os checks dos tipos de evento e de motivo com o tipo novo e a bateria quebrou na 2ª aplicação ("check violado") porque a do Mover e a do stand-by ainda VALIDAVAM a lista antiga; (2) a bateria reaplica migrations antigas no meio (bloco 38) e desfazia as portas novas (o quadro sem a presença nova; as entregas do dia sem as paradas) → **correção:** o validate saiu das antigas (comentário ↪️ no lugar) e mora só na mais nova; as 41 entraram na cadeia de reaplicação do bloco 38, na ordem de produção. **Lição: migration que recria check, porta ou visão que outra recria: mover o validate para a mais nova E pôr a nova na cadeia do bloco 38 — conferir com `grep -n "readFile(path.join(MIGRATIONS, '2026102"` antes de rodar.**

### E-165

- [2026-10-27] **E-165** (Claude Code, SESSAO-41 · filtros) · `drop + create` de porta para ganhar um parâmetro (`plt_fn_programadas` + `p_busca`) quebrou a bateria em dois lugares: (1) uma conferência antiga (bloco 55) cita a assinatura velha em `has_function_privilege` → "function does not exist"; (2) o bloco 38 reaplica a migration das rotas, que recria a versão de 5 parâmetros AO LADO da nova (chamada ambígua). → **correção:** a assinatura nova na conferência antiga e a migration nova na cadeia do bloco 38. **Lição: porta com assinatura nova → `grep` da assinatura antiga na bateria + a migration na cadeia de reaplicação.**

### E-170

- [2026-10-31] **E-170** (Claude Code, SESSAO-42) · A extração da "versão viva" de uma função (o script que copia o `create` mais novo das migrations) só procurava `create or replace function` — a viva de `plt_fn_dash_tempos_pessoa` tinha sido recriada com `drop` + `create function` (a da foto) e eu reescrevi a velha; a migration nova falhou com "cannot change return type" → **correção:** o padrão aceita `create function` e as montagens foram refeitas (a da origem conferida por diff vazio). **Lição: a versão viva é o ÚLTIMO `create` de qualquer forma — com e sem `or replace` (é o [[Memoria - Migrations Aplicador e Ensaio 1#E-24|E-24]] de novo, agora no script).**

### E-172

- [2026-10-31] **E-172** (Claude Code, SESSAO-42) · A lista de execuções agrupava todos os trechos do período e contava com `count(*) over ()` antes de paginar: 8,7 s no ensaio ×100 (Pessoas, 1 s; o detalhe, 0,6 s) → **correção:** a PÁGINA primeiro (índice parcial dos inícios, do mais novo), os trechos só dela (índice da execução), o total contado até 1.001 ("mais de mil"); Pessoas do resumo por dia; o fechado somado sem chamar função por linha → 30 ms, 6 ms, 91 ms. **Lição: em porta paginada, a página nasce ANTES de qualquer agrupamento; total exato só se a tela precisa — senão conta até o teto.**

### E-178

- [2026-11-04] **E-178** (Claude Code, SESSAO-45) · Mudei o RETORNO de `plt_fn_programadas` (+ CEP e ponto marcado à mão) e a bateria caiu: ela REAPLICA a migration dos filtros da Programação (20261027080000) depois da nova, e a 080000 só derrubava a assinatura de 5 argumentos — o `create or replace` da de 6 batia no retorno novo ("cannot change return type"). → **correção:** a 080000 passa a derrubar também a de 6 (reaplicável; em produção nada muda) e a nova entra na cadeia de reaplicação do bloco 38. **Lição: quem muda o retorno de uma porta procura TODA migration antiga que a recria (grep do nome em `supabase/migrations`) — a bateria reaplica as antigas.**

### E-191

- [2026-11-05] **E-191** (Claude Code, SESSAO-43) · O banco de ensaio "travou" por mais de 5 min ao aplicar as migrations novas — não travou: o PGlite segura o processo do Node aberto se o script não chama `process.exit` (o retrato saía porque tinha o `exit`). Perdi uma rodada achando que era laço infinito numa migration. → **correção:** `process.exit(0)` no fim do script e marcas de tempo por parte da migration (cada parte em milissegundos). **Lição: script com PGlite termina com `process.exit`; "travou" sem saída nenhuma = medir por partes antes de suspeitar do SQL.**

### E-192

- [2026-11-05] **E-192** (Claude Code, SESSAO-43) · As abas de período da tela Tempos de produção nasceram lendo a UNIÃO das origens (passagens + equipe juntada + Trello) a cada abertura, montando a chave da equipe linha a linha — e o ensaio ×100 só rodou DEPOIS das telas prontas: Período 30 dias 210 ms, Móveis 367 ms (90 dias 1,6 s), Montadores 287 ms (90 dias 1,3 s), Procurar pelo pedido 105 ms. Por dentro: a coluna "por pessoa" da Móveis era uma subconsulta por linha da página — o Postgres colou a CTE usada uma vez só DENTRO dela e releu tudo 50 vezes; a Montadores ordenava as mesmas linhas três vezes; a TV calculava as letras por móvel; a busca pelo pedido podia varrer todas as passagens do setor. → **correção:** tabela pronta de leitura (um móvel por linha, a equipe e a chave prontas, e uma linha por pessoa), mantida por gatilhos de COMANDO nas passagens, na equipe e no Trello ([[Memoria - Banco e SQL 2#A-145|A-145]]); a coluna por pessoa agregada uma vez por modelo e juntada por igualdade; pessoa × modelo numa ordenação só (o melhor de cada pessoa sai do menor tempo por modelo — o padrão é um só por modelo); as letras da TV uma vez por equipe; a busca pelo índice do card. Depois: 30 dias Período 90 · Móveis 59 · Montadores 125 · TV 84 · Conferir 22 · Procurar 5 ms; o gesto de iniciar/soltar +4 ms. Ficou fora: 90 dias ou mais ×100 ([[D-233 - Periodos longos com 100 vezes o movimento de hoje passam|D-233]], dívida na lei). **Lição: o ensaio ×100 vem ANTES da tela, com a porta ainda no papel.**

### E-235

- [2026-11-09] **E-235** (Claude Code, SESSAO-47) · Li o registro inteiro da bateria do banco com a leitura de arquivo (milhares de linhas, ~25 mil tokens jogados fora) para achar um resumo que cabia em 5 linhas → **correção:** a bateria sempre para arquivo e dele só `grep -c '✔'`, `grep -n '✘'` e `tail -5`. **Lição: saída de programa longo não se lê — conta-se e filtra-se.**

### E-238

- [2026-11-09] **E-238** (Claude Code, SESSAO-47) · Escrevi a regra única do PCP (`fn_fora_do_pcp`) chamando duas funções que já existiam, cada uma normalizando a situação de novo. Função SQL imutável **com `set search_path` não é embutida pelo planejador** — cada chamada é uma execução: 5 por linha em vez de 2 → no ensaio ×100 o PCP foi de 84 para 128 ms (porta antiga 211 → 275, quadrinho 70 → 118) → **correção:** um `case` sobre UMA normalização; a bateria amarra que as três regras respondem igual para toda situação. **Lição: função que roda por linha em porta de quadro não compõe outras funções da casa — escreve a lista uma vez e o teste prova que não divergiu; e o ensaio ×100 mede as portas TOCADAS antes do commit, não depois.**

### E-246

- [2026-11-09] **E-246** (Claude Code, SESSAO-47 · frente do painel) · O ensaio ×100 das portas de tempos só media "ontem"; a abertura da tela traz o dia de HOJE, e num dia cheio o banco trocava a busca por card por uma junção que lia a chave inteira dos cards (59 ms; 101 ms com a marca ligada na 1ª versão) → **correção:** busca por linha (`lateral … offset 0`): 32 ms, a mesma resposta. **Lição: ensaiar o caso que a tela ABRE de verdade, não só o caso bonito.** E a 1ª versão cobrava o "Outros" mesmo sem ninguém desligado (+10 ms) → a constante "há alguém desligado?" na frente de cada conta.

### E-248

- [2026-11-09] **E-248** (Claude Code, SESSAO-47) · O app fechou com a frente da entrega ainda rodando: ficaram só na cópia dela, sem registro, o diário até o fim, um ajuste de tela, um teste novo e uma mudança na migration (o pré-filtro do calendário) — e a migration que subiu foi a de antes dessa mudança → **correção:** recolhido pela cópia (`git status`/`diff` na pasta da frente): o ajuste e o teste entraram; a mudança do banco virou migration própria (`20261109050000`), por aplicar. **Lição: frente paralela registra (commit) a cada passo fechado; e antes de subir, o supervisor olha o `git status` de CADA cópia — o que está fora de commit não sobe.**

### E-259

- [2026-11-11] **E-259** (Claude Code, SESSAO-48 · frente 3) · O cancelamento do Tiny passou a gravar dois tipos novos de fato, e os cenários ANTIGOS da bateria (pedidos cancelados com peça em produção, da SESSAO-24 em diante) passaram a gravá-los — as migrations antigas que, reaplicadas, recriam e VALIDAM a lista de tipos (`20261027040000`, `20261031020000`) caíram com "check constraint … is violated by some row". → **Correção:** o ajudante `aceitaDestino48(sql)` acrescenta os tipos à lista só na reaplicação do teste (o molde da 51/SESSAO-30). **Lição:** antes de mexer na reação a um fato do Tiny, procurar na bateria quem reaplica migration com `validate constraint`.

### E-260

- [2026-11-11] **E-260** (Claude Code, SESSAO-48 · frente 2) · A 1ª versão da aba "Cancelados e removidos" saiu da bateria verde e reprovou no ensaio ×100: 1ª página 186 ms (o total sozinho custava ~175 ms) e o filtro pelo número até 4 s — o planejador partia de todos os pedidos cancelados e só no fim ordenava, e não sabe quantos números as faixas `[x·10^k, (x+1)·10^k)` trazem (estimou 435 mil; vieram 111). → **Correção:** sem o total; cada metade anda pelo SEU índice num laço que para quando enche a página; o filtro raro vai pelos candidatos do próprio filtro (pedidos numa lista, depois os cards por `= any`): 2–19 ms. Ver [[Memoria - Banco e SQL 2#A-216|A-216]].

### E-267

- [2026-11-11] **E-267** (Claude Code, SESSAO-48 · frente 3) · PGlite em disco no Windows: remontar o banco do ensaio na MESMA pasta logo depois de apagá-la deu "could not create file base/…: File exists". → **Correção:** pasta nova a cada montagem.

### E-270

- [2026-11-12] **E-270** (Claude Code, SESSAO-50 · bloco B) · A bateria quebrou na REAPLICAÇÃO de uma migration antiga (`20261027040000`): o check de tipos de fato que ela recria recusou os fatos novos que os cenários antigos agora gravam (`pedido_excluido_tiny`, `pedido_reencontrado_tiny` — o excluído no Tiny virou fato). → **Correção:** os 8 tipos novos da 50 somados na lista `aceitaDestino48` da bateria. **Lição:** tipo de fato novo = somar na `aceitaDestino48` no mesmo commit ([[Memoria - Migrations Aplicador e Ensaio 2#E-19|E-19]]/E-259: o `validate` mora na mais nova, mas a reaplicação das antigas recria o check velho por cima de fato novo).

### E-273

- [2026-11-12] **E-273** (Claude Code, SESSAO-50 · ensaio ×100 do bloco B) · O ensaio semeava a observação do item numa tabela que só nasce na base da 50, ANTES de aplicar a base — quebraria depois de minutos de montagem. → **Correção:** a semeadura foi para depois da base; o ensaio rodado com `ESCALA=1` (9 s) antes do ×100. **Lição:** todo ensaio novo roda primeiro com `ESCALA=1`.

### E-274

- [2026-11-12] **E-274** (Claude Code, SESSAO-50 · geração da migration do bloco B) · O gerador extraiu a "versão vigente" de funções do PRÓPRIO arquivo que ele gera (a saída da rodada anterior estava na pasta das migrations) — recriação em cima de recriação; e o marcador que ele procura na base da 48 sumiu quando tirei dela a linha do `validate`. → **Correção:** apagar a saída antes de gerar (só migrations com nome menor que o da gerada contam como vigentes) e o marcador ajustado. **Lição:** gerador que extrai "a última versão" precisa excluir a si mesmo.

### E-280

- [2026-11-12] **E-280** (Claude Code, SESSAO-50 · bloco A) · A 1ª versão da regra "qual observação cada peça mostra" levou o pior caso do quadro da MONTAGEM de 84 para 131 ms no ensaio ×100: o casamento das vagas (`fn_vagas_pedido`) rodava para cada peça de cada coluna. → **Correção:** a peça que cai no 1º passo do casamento se resolve pela chave (a vaga só é calculada quando o retrato da peça difere do item), uma chamada por página — 0 diferenças nas respostas e +0,4 ms. Achado com o explorador de planos no banco do ensaio.

### E-285

- [2026-11-12] **E-285** (Claude Code, SESSAO-50 · bloco C) · A 1ª versão do "quem pode editar a parada" morava dentro da função que monta o JSON de UMA parada (`fn_parada_json`) — rodava uma vez por linha: o ensaio ×100 das paradas do período foi de 36 para 56 ms (+58%); a bateria não pega esse custo. → **Correção:** a regra calculada UMA vez na porta (`pode_editar` nas duas leituras) e a `fn_parada_json` intocada (36 → 38 ms). **Lição:** permissão por linha = calcular uma vez na porta e passar adiante; só o ×100 mostra.

### E-289

- [2026-11-17] **E-289** (Claude Code, SESSAO-51) · O [[Memoria - Migrations Aplicador e Ensaio 1#E-235|E-235]] de novo: li a saída inteira de uma rodada da bateria do banco (centenas de linhas) para achar o resumo do fim. → **Correção:** da bateria só o `tail`/`grep` dos ✘ e do total; a saída inteira fica no arquivo do scratchpad.
