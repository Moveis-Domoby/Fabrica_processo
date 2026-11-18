---
titulo: "Memória de aprendizado — Banco e SQL (parte 1 de 2)"
tipo: memoria-tema
tema: banco-sql
atualizado: 2026-11-18
tags: [memoria, aprendizado, tema/banco-sql]
---

# 🧠 Memoria - Banco e SQL 1

> Lições deste tema, movidas de [[PLT - Memoria de Aprendizado]] em 18/11/2026 sem reescrever. Entrada nova entra **aqui**, na seção do tipo dela, com o id no título (`### E-NNN`); o próximo número livre está no índice.

## 🔴 Erros e correções (E-NN)

### E-1

- [2026-08-13] **E-01** · Gatilho de automação em aba de fórmula posicional (DADOS/PCP) duplicava cards → **correção:** gatilho só em dado bruto/evento, nunca em derivado. → promovida

### E-11

- [2026-08-26] **E-11** (Claude Code) · Criei as funções de apoio da plataforma em `public` — e o Supabase **publica o schema `public` inteiro como API REST**, então cada função virou endpoint `/rest/v1/rpc/...` sem ninguém pedir (apontado pelos advisors do próprio Supabase) → **correção:** schema `plt_privado`, fora da API, com `grant execute` só para `authenticated`; e `set search_path` em toda função. **Rodar `get_advisors` depois de todo DDL virou parte do ciclo.**

### E-14

- [2026-08-27] **E-14** (Claude Code) · Bootstrap do 1º admin falhou em produção com `permission denied for schema plt_privado`: trigger que NÃO é security definer roda com o privilégio de **quem insere** (a service_role, sem USAGE no schema privado) → **correção:** migration 12 — `fn_gerar_matricula` virou security definer + grants explícitos. **Lição: o PGlite dos testes roda como superusuário e NÃO pega erro de permissão — permissão só se prova no banco real; função de plt_privado usada por trigger nasce security definer.**

### E-17

- [2026-08-27] **E-17** (Claude Code) · `create or replace view` não muda a FORMA da view (coluna nova/renomeada → "cannot change name of view column") e o teste de idempotência quebrou nas duas pontas → **correção:** view que muda de forma se recria com `drop view if exists` + `create view` — inclusive na migration ANTIGA que a criava, senão a segunda rodada do teste quebra. Pego na hora pelo `test:banco` de duas rodadas ([[Memoria - Migrations Aplicador e Ensaio 2#A-10|A-10]] pagando de novo). **↪️ 28/08 (SESSAO-09): vale IGUAL para FUNÇÃO** — mudar o RETORNO de `plt_fn_pedidos_kanban` quebrou a 2ª rodada ("cannot change return type"); mesmo remédio, drop na migration antiga. Pego de novo pelo teste de duas rodadas. **↪️ 18/10 (SESSAO-36): terceira vez** — `plt_fn_dash_tempos_pessoa` ganhou a coluna da foto e as DUAS migrations antigas que a recriavam quebraram a 2ª rodada (e derrubaram mais cinco em cascata: migration que para no meio deixa de rodar os drops que as seguintes esperam); mesmo remédio nas duas, tudo verde.

### E-21

- [2026-08-28] **E-21** (Claude Code) · Em PL/pgSQL, `v_array || 'texto'` com `v_array text[]` NÃO acrescenta o texto: o Postgres tenta interpretar `'texto'` como LITERAL DE ARRAY e quebra com "malformed array literal" — só em tempo de execução → **correção:** `array_append(v_array, 'texto')` sempre. Pego pelo `test:banco` de duas rodadas antes de chegar perto do banco real ([[Memoria - Migrations Aplicador e Ensaio 2#A-10|A-10]] pagando de novo).

### E-26

- [2026-09-08] **E-26** (Claude Code) · SQL de manutenção arquivou em massa com `origem = 'automacao'` sem pessoa e o trigger `fn_validar_api` recusou (arquivar sem pessoa só com origem `api`) → **correção:** origem `api` — o gesto "da integração" é o caminho sancionado para lote sem autor. **Lição: antes de rodar SQL de lote em produção, passar o mesmo SQL no `test:banco` — os triggers valem para o superusuário também ([[Memoria - Modelos Formulas e Possibilidades#M-14|M-14]]) e teriam pego na hora.**

### E-27

- [2026-09-15] **E-27** (Claude Code) · O harness quebrou com "column c.raw does not exist": o `supabase-fabrica-schema.sql` do cofre NÃO tinha as colunas que o backfill criou em `clientes` direto no banco (primo do [[Memoria - Migrations Aplicador e Ensaio 1#E-24|E-24]]: ajuste sem espelho morre — ou, aqui, nunca chega ao teste) → **correção:** colunas espelhadas no `.sql`; pendência registrada de espelhar também `tiny_fila`/`notas_fiscais`/`contas_receber`. **Lição: o retrato que o harness carrega é parte do contrato — atualizar o espelho É parte de aplicar no banco.**

### E-28

- [2026-09-15] **E-28** (Claude Code) · A demanda mandava fechar um "vazamento" da view `vendas_marketing` que **não existia** — o gate já estava no `WHERE` desde a migration 26; quem avaliou olhou a ACL e o advisor, não a definição da view → **correção:** conferi no objeto vivo (`pg_get_viewdef` + consulta com papel simulado) ANTES de escrever a migration, e o escopo virou o problema real (negar em vez de devolver vazio). **Lição: achado de segurança se confirma no objeto vivo e com o papel do usuário — ACL e advisor sozinhos não contam a história.**

### E-35

- [2026-09-22] **E-35** (Claude Code) · `delete from storage.objects` numa função do banco falhou em produção com "Direct deletion from storage tables is not allowed. Use the Storage API instead" — o Supabase bloqueia escrita direta nas tabelas do storage, e o `has_table_privilege` diz TRUE mesmo assim (o bloqueio é guard, não privilégio) → **correção:** arquivo de storage se apaga pelo Storage API no cliente (melhor esforço antes da RPC); a função do banco não toca storage. **Lição: pego pelo teste E2E de verdade que o dono exigiu — o PGlite não tem storage e nunca pegaria; e "tenho privilégio" não é "posso": plataforma gerenciada guarda as próprias tabelas.**

### E-39

- [2026-09-23] **E-39** (Claude Code) · `update … from lateral (…)` referenciando a tabela-ALVO dentro do lateral quebra ("invalid reference to FROM-clause entry") — o alvo do UPDATE não faz parte do FROM → **correção:** subconsulta `distinct on (card_id)` no FROM e junção pelo id. Pego na hora pelo `test:banco` ([[Memoria - Migrations Aplicador e Ensaio 2#A-10|A-10]] pagando de novo), antes de chegar perto do banco real.

### E-51

- [2026-09-27] **E-51** (Claude Code) · Ao montar o harness COMBINADO (o da SESSAO-24 + os cenários da 26) com `texto.replace(marcador, trecho + marcador)`, o `$$` das funções SQL do trecho virou `$` — no JavaScript, **`$$` no texto de substituição do `replace` significa "um cifrão"** — e o harness quebrou na criação do simulador (primo do [[Memoria - Git Shell e Windows 1#E-9|E-09]]/E-15: camada que interpreta o texto no meio do caminho) → **correção:** substituição por FUNÇÃO (`replace(m, () => trecho + m)`), que insere literal, + conferência de que o `$$` chegou intacto antes de rodar. **Lição: texto com `$` (SQL, shell, template) nunca entra como string de substituição do `replace` — só por função.**

### E-72

- [2026-09-30] **E-72** (Claude Code, fotos do Tiny automáticas) · A migration 44 quebrou no harness com `relation "cron.job" does not exist`: escrevi o agendamento como `if exists (… pg_cron) and not exists (select … from cron.job …) then` — numa condição só, o plpgsql planeja a expressão INTEIRA e não há curto-circuito no planejamento; sem pg_cron (PGlite), o `cron.job` não existe e quebra. A migration 43, ao lado, já fazia certo (IFs aninhados) → **correção:** dois IFs aninhados; o `cron.job` só é planejado dentro do ramo que tem pg_cron. Pego pelo harness antes de chegar perto do banco real ([[Memoria - Migrations Aplicador e Ensaio 2#A-10|A-10]] de novo). **Lição (primo do [[Memoria - Migrations Aplicador e Ensaio 1#E-61|E-61]]): no plpgsql, objeto que pode não existir só aparece DENTRO do ramo que o garante — nunca na mesma condição do teste de existência.**

### E-78

- [2026-10-02] **E-78** (Claude Code, SESSAO-27) · O gatilho ADIADO do motor das automações se chamava `plt_eventos_automacoes` — no fechamento normal do gesto ele roda depois de tudo, mas no ensaio no banco real com `set constraints all immediate` (para o adiado disparar dentro da transação desfeita) ele rodou ANTES da projeção da posição: no mesmo momento, os gatilhos AFTER disparam em ordem ALFABÉTICA e "automacoes" < "projetar". Resultado do ensaio: "o card já tinha saído da etapa" com o card parado nela → **correção:** renomeado para `plt_eventos_zzzz_automacoes` (e `plt_pedidos_zz_automacoes`), migration 51 reaplicada (`--so`, integração idêntica), ensaio repetido: cadeia de 2 concluída em 58 ms; prova permanente no harness (modo imediato forçado). **Lição: gatilho que lê o estado PROJETADO precisa rodar depois do projetor em QUALQUER modo — nome que ordena por último ("zz…") mesmo sendo adiado; e o ensaio no banco real pega o que o harness, no modo de sempre, não pega.**

### E-92

- [2026-10-14] **E-92** (Claude Code, SESSAO-31) · A manutenção SQL da etapa A saiu com um parêntese a mais no `jsonb_build_object(...))` — o harness não roda manutenção, e só o ensaio no banco real (transação desfeita) acusou "syntax error" → **correção:** parêntese tirado, ensaio repetido verde, gravado uma vez. **Lição: script de manutenção não passa pela bateria — o ensaio desfeito no banco real é o único teste dele; nunca gravar manutenção sem o ensaio antes.**

### E-103

- [2026-10-16] **E-103** (Claude Code, SESSAO-32) · A porta de abertura (`plt_fn_abertura`, **security invoker** — roda como quem chama) chamava um ajudante de `plt_privado` com o execute revogado do papel `authenticated` (`fn_carimbar_presenca`, na releitura do perfil SEM rota). O harness passou **verde (996)** porque o PGlite chama tudo como o DONO do banco — privilégio de função não vale para o dono. Aplicada a migration 78 em produção, a conferência pessoa por pessoa como `authenticated` deu **"permission denied" para as 6 pessoas** — pego ANTES de publicar o site (o site velho seguia de pé; ninguém usando, de noite) → **correção:** o ajudante saiu (a presença já vem da navegação e dos fatos), 78 reaplicada, as 6 sem erro; o bloco 78 do harness passou a chamar as portas novas com `set role authenticated` e as permissões padrão do Supabase imitadas (esquema auth + leitura de public, MENOS `plt_usuarios`, que vale por coluna — [[Memoria - Acesso Seguranca e Credenciais#E-50|E-50]]). **Regra:** porta nova *invoker* se prova como `authenticated` — no harness e no banco real, pessoa por pessoa ([[Memoria - Acesso Seguranca e Credenciais#A-66|A-66]]) — antes de o site subir.

### E-104

- [2026-10-16] **E-104** (Claude Code, SESSAO-32) · O [[Memoria - Regras de Negocio - Producao PCP Estoque e Rotas 1#E-102|E-102]] de novo, na mesma noite: `plt_log_atividades` escrito de memória numa consulta de conferência — a tabela é `plt_logs_atividade` (o erro do banco avisou; nada rodou) → **correção:** nome conferido na nota do esquema antes de reescrever a consulta. Consulta de conferência também é SQL: nome sai da nota, nunca da memória.

### E-106

- [2026-10-16] **E-106** (Claude Code, SESSAO-32) · Na lista de Pedidos por caminhos, o "número que começa com" virou faixas de número com `v_busca::bigint` NO `JOIN` e a guarda `v_busca ~ '^[1-9]…$'` no `WHERE` — o Postgres não garante a ordem de avaliação (o `ON` rodou antes do `WHERE`) e a busca "maria" quebrou com "invalid input syntax for type bigint". A bateria do banco não pegou porque a saída longa do PGlite escondeu a falha no `grep` da mesma linha de comando; pegou a prova no banco real (transação desfeita), ANTES de aplicar → **correção:** o número calculado UMA vez no `declare` do plpgsql com `CASE` (que só converte quando casa) e o SQL só compara com a variável (`where v_num is not null`). **Regra:** conversão que pode falhar nunca fica numa condição do `JOIN`/`WHERE` esperando outra condição proteger — calcula antes, com `CASE`, numa variável; e rodar a bateria sozinha (sem `grep` encadeado com outro comando que pode esconder a saída).
` virou `
` na gravação e o git avisou "CRLF will be replaced by LF" em 16 arquivos (o commit saiu normalizado, mas a pasta ficou com finais de linha trocados) → **correção:** `open(..., newline='')` e devolver o final de linha que o arquivo já tinha. Script de edição no Windows sempre com `newline=''`.

### E-130

- [2026-10-21] **E-130** (Claude Code, SESSAO-38 casca) · O [[Memoria - Tiny n8n e Integracoes 1#E-36|E-36]]/E-46/E-87/E-104 de novo, na investigação do login: `plt_logs_atividade.registrado_em` escrito de memória (é o nome da coluna de `plt_eventos`) — a coluna é `criado_em`; a consulta de leitura quebrou (sem dano) → **correção:** nome tirado do `create table` (grep) antes de reescrever. **Lição: cada tabela tem o seu nome de data — `plt_eventos.registrado_em`, `plt_logs_atividade.criado_em`, `plt_notificacoes.criada_em`; grep do `create table` sempre, até na consulta de investigação.**

### E-120

- [2026-10-21] **E-120** (Claude Code, SESSAO-38 cards) · Troquei a assinatura de 4 portas (drop + create com um parâmetro novo) e a bateria parou no meio com "function … does not exist": blocos antigos conferiam permissão com `has_function_privilege('…(assinatura VELHA)')` → **correção:** as 4 linhas antigas passaram a citar a assinatura nova (a regra delas não mudou). **Lição: antes de trocar a assinatura de uma porta, `grep` da assinatura velha na bateria — permissão conferida por assinatura quebra quando a assinatura muda.**

### E-161

- [2026-10-27] **E-161** (Claude Code, SESSAO-41) · O teste novo escondia o erro de verdade: o gesto como `authenticated` falhou, a transação abortou e o `reset role` do `finally` estourou com "current transaction is aborted" por cima → **correção:** o ajudante do teste abre um ponto de volta (`savepoint`) antes, volta a ele no erro e relança com a mensagem real ("O operador identificado não trabalha neste setor…"). **Lição: ajudante de teste que troca de papel dentro da transação da bateria usa ponto de volta — senão o primeiro erro esconde a causa.**

### E-174

- [2026-10-31] **E-174** (Claude Code, SESSAO-42) · A trava "card já refeito nesta transação" comparava o maior número de fato: o movimento automático que o INICIAR cria (na guarda, antes de gravar o iniciar) nasce com número MAIOR que o próprio iniciar — com o gatilho disparando a cada comando (teste), o iniciar era pulado e o trecho não nascia (o teste passou numa rodada e falhou na outra) → **correção:** a trava compara a CONTAGEM de fatos do card. **Lição: número de sequência não é ordem de gravação quando um gatilho BEFORE grava outra linha — para "já vi tudo", contar.**

### E-175

- [2026-11-04] **E-175** (Claude Code, SESSAO-44) · No teste do gatilho ADIADO dos itens, liguei `set constraints … immediate` ANTES da gravação do Tiny: o gatilho rodou no fim do `update pedidos` de DENTRO da função — antes de ela apagar e regravar os itens — e a conta da liberação viu os itens velhos (3 vermelhos e uma cascata “já lançado para ROTAS”). → **correção:** deixar o gatilho adiado e, depois de cada gravação, `set constraints X immediate; set constraints X deferred` — dispara o pendente no ponto que equivale ao COMMIT. **Lição: “immediate” dispara no fim de cada comando, inclusive dos comandos de dentro de uma função; teste de gatilho adiado se faz disparando o pendente depois do gesto inteiro.**

### E-177

- [2026-11-04] **E-177** (Claude Code, SESSAO-44) · Tirei o índice único de peça por (pedido, posição, unidade) para o item inserido no meio poder nascer, e 4 testes antigos caíram em cascata (a peça repetida passou a nascer). → **correção:** o índice virou único por (pedido, posição, unidade, **código, descrição**) — barra a repetida do mesmo produto e deixa nascer a de outro produto na mesma posição. **Lição: antes de tirar uma trava, achar a trava mais estreita que ainda protege o que ela protegia.**

### E-236

- [2026-11-09] **E-236** (Claude Code, SESSAO-47) · `plt_fn_liberar_peca` ganhou um parâmetro (drop da de 5 + create da de 6) e a conferência de permissão do bloco da SESSAO-45 citava a assinatura velha em `has_function_privilege` → a bateria CAIU ali (não é vermelho, é queda) — o [[Memoria - Banco e SQL 1#E-120|E-120]] de novo → **correção:** assinatura nova na conferência. **Lição: mudou a assinatura de uma função → `grep` do nome dela na bateria inteira ANTES da primeira rodada (permissão, `drop`, comentários).**

### E-237

- [2026-11-09] **E-237** (Claude Code, SESSAO-47) · O resumo do pedido no quadro do PCP ganhou a chave `volta_pcp` em TODA linha (nula para quem não tem a marca) e o teste antigo "as 3 leituras de antes continuam iguais" (compara o jsonb inteiro com a porta velha) ficou vermelho → **correção:** a chave só entra quando há a marca (`|| case when … then '{}' else jsonb_build_object(…) end`). **Lição: chave nova em jsonb que outro teste compara por igualdade só nasce quando tem o que dizer — e a tela trata a ausência.**

### E-250

- [2026-11-11] **E-250** (Claude Code, SESSAO-48) · Na migration base, pus o filtro novo (`c.cancelada_em is null`) no `where` da CTE `em_producao` de `fn_sugestoes_em_producao` — ali o `c` é a CTE `candidatas`, que só carrega as colunas que ela mesma escolheu; a função é `language sql`, então a migration inteira caiu na criação ("column c.cancelada_em does not exist") nas duas rodadas da bateria → **correção:** o filtro foi para os dois ramos de `candidatas`, onde o `c` é `plt_cards`. **Lição: antes de pôr condição numa função extraída, conferir a QUE o apelido se refere naquele ponto (tabela ou CTE com colunas escolhidas) — a mesma letra muda de dono dentro da mesma consulta.**

### E-251

- [2026-11-11] **E-251** (Claude Code, SESSAO-48) · Acrescentei uma coluna no fim da visão `vw_card_ordem` (`create or replace view`) para a janela de 7 dias do quadro; na 2ª rodada da bateria, as migrations antigas que recriam a visão com as colunas da época caíram com "cannot drop columns from view" → **correção:** a visão ficou como estava; a porta da coluna lê a data do próprio card, só nas colunas que cancelam (um `case` com a pergunta "esta coluna cancela?" calculada uma vez). **Lição: visão recriada por migration antiga não ganha coluna nova — a reaplicação não consegue tirá-la; ler a coluna da tabela onde ela mora.**

### E-255

- [2026-11-11] **E-255** (Claude Code, SESSAO-48) · A janela dos 7 dias na coluna que cancela lia a data de CADA card por subconsulta (`(select cancelada_em from plt_cards where id = v.id)`) — a página ordena a coluna inteira antes de cortar 10, então eram 5.300 leituras no ×100: o quadro da LIMPEZA foi de 210 para 272 ms → **correção:** os que passaram do prazo saem por um `not in (conjunto)` calculado uma vez pelo índice parcial (vazio fora das colunas que cancelam). **Lição: filtro novo numa porta que ordena e corta nunca é subconsulta por linha — vira conjunto calculado uma vez (o planejador faz um "hashed subplan").**

### E-282

- [2026-11-12] **E-282** (Claude Code, SESSAO-50 · bloco B) · Com o índice parcial novo (pedidos vivos, em ordem de número), a busca RARA do "Incluir" (os candidatos das faixas do número + trigramas do nome numa subconsulta com `union`) virou 278 ms: o planejador preferiu andar o índice parcial INTEIRO na ordem (509 mil linhas) e cruzar com os 111 candidatos. → **Correção:** dois passos — os candidatos num array, depois a página só entre eles (`unnest` + chave primária): 39–41 ms. **Lição:** índice que entrega a ordem "de graça" atrai o planejador mesmo quando o conjunto é pequeno; conjunto pequeno conhecido = materializar antes.

### E-286

- [2026-11-12] **E-286** (Claude Code, SESSAO-50 · bloco C) · Na bateria, o 2º gesto de um bloco "não avisava" a tela de Rotas: o aviso sai UMA vez por transação (`fn_avisar` marca `plt.avisado_<área>`) e o bloco inteiro é uma transação só. → **Correção:** o teste zera a marca antes do gesto medido. **Lição:** teste de "o banco avisou" dentro de uma transação começa zerando a marca da área.

### E-287

- [2026-11-17] **E-287** (Claude Code, SESSAO-51) · O [[Memoria - Banco e SQL 1#E-161|E-161]] de novo: o ajudante novo da prova trocava de papel sem ponto de volta — o gesto falhou, a transação abortou e o `finally` estourou com "current transaction is aborted", escondendo a causa ("Registrar entrega é gesto da logística…"). → **Correção:** `savepoint` antes do gesto, `rollback to` no erro e relança a mensagem real. **Lição:** todo ajudante novo de prova que troca de papel nasce com o ponto de volta — copiar o de um bloco recente, não escrever do zero.

### E-20

- [2026-08-28] **E-20** (Claude Code) · No banco compartilhado, `add column if not exists` PULOU em silêncio uma coluna que outra sessão de trabalho já tinha criado com desenho DIFERENTE (check sem um dos valores, default divergente) — o front quebraria só em produção → **correção:** migration de alinhamento (drop/recreate do check + default). **Lição: depois de aplicar, conferir `column_default` e `pg_get_constraintdef` de todo objeto que "já existia" — `if not exists` cala colisão entre sessões paralelas.**

### E-117

- [2026-10-21] **E-117** (Claude Code, SESSAO-33 — frente "o que o Tiny não avisa") · Para listar quem lê `produtos` no banco real, filtrei o `prosrc` com `~* '(from|join)\s+(public\.)?produtos\b'` — e veio **vazio, sem erro**: na regex do Postgres `\b` é o caractere de retrocesso, não a borda de palavra. Só não virou conclusão errada ("ninguém lê produtos") porque o vazio não fazia sentido → **correção:** borda de palavra no Postgres é **`\y`** (ou `\m`/`\M`); a consulta refeita achou as 43 funções. **Regra:** regex escrita no hábito de outra linguagem num `~` do Postgres se confere com um caso que TEM de casar antes de acreditar no vazio.
