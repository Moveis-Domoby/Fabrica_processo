---
titulo: "Memória de aprendizado — Banco e SQL (parte 2 de 2)"
tipo: memoria-tema
tema: banco-sql
atualizado: 2026-11-25
tags: [memoria, aprendizado, tema/banco-sql]
---

# 🧠 Memoria - Banco e SQL 2

> Lições deste tema, movidas de [[PLT - Memoria de Aprendizado]] em 18/11/2026 sem reescrever. Entrada nova entra **aqui**, na seção do tipo dela, com o id no título (`### E-NNN`); o próximo número livre está no índice.

## 🔴 Erros e correções (E-NN)

### E-234

- [2026-11-06] **E-234** (Claude Code, números que batem) · `alter table plt_eventos disable trigger …` dentro da transação da bateria → "cannot ALTER TABLE because it has pending trigger events" (o gatilho ADIADO do tempo tinha fato pendente) → **correção:** o estado "de antes da migration" (stand-by aberto em pedido cancelado, como o 13649) semeado direto com `session_replication_role = replica` — a situação e o fato, sem gatilho nenhum. **Lição: em `plt_eventos` não se liga/desliga gatilho no meio da transação; semeia-se o estado.**

## 🟢 Acertos que viraram padrão (A-NN)

### A-47

- [2026-10-02] **A-47** (Claude Code, SESSAO-27) · **Reação "na hora" sem fila e sem relógio: gatilho ADIADO (`create constraint trigger … deferrable initially deferred`).** Ele dispara no COMMIT, depois de TODOS os comandos do gesto (a porta do arrasto que grava mover + iniciar não é atropelada no meio), o que ele grava dispara em cascata no mesmo commit (a profundidade no `dados` do evento corta o ciclo), e um `begin … exception` por passo faz a falha virar registro sem desfazer o gesto da pessoa nem a gravação do Tiny. Ensaiado primeiro num PGlite descartável (scratchpad) e depois provado no harness (cadeia de 2, ciclo barrado na 6ª, pedido do Tiny gravando com automação quebrada). **Quando usar:** consequência que precisa do estado FINAL do gesto; para trabalho caro ou externo, continua valendo a fila com relógio.

### A-21

- [2026-09-23] **A-21** (Claude Code) · **RLS se prova no PGlite com `set role authenticated`:** o harness roda como superusuário (que ignora RLS — [[Memoria - Banco e SQL 1#E-14|E-14]]), mas basta conceder os grants que o Supabase dá por padrão (`grant select… to authenticated`) e trocar de papel (`set role authenticated` + `request.jwt.claim.sub`) para as policies valerem de verdade — foi assim que a S23 provou que admin não lê tarefa privada alheia, ANTES do banco real. No banco real, o mesmo teste vira ensaio [[Memoria - Testes e Validacao ao Vivo#A-11|A-11]] (`set_config('role','authenticated',true)` dentro de um `do $$` que termina em `raise exception`): zero linha gravada. Grants/`search_path` continuam se provando só no banco real (E-14 segue valendo para permissão de objeto).

### A-12

- [2026-08-28] **A-12** (Claude Code) · **Mudar assinatura de função Postgres é DROP + CREATE**: adicionar parâmetro com default a uma função existente via `create or replace` cria uma SOBRECARGA (as duas convivem e o PostgREST se confunde) — dropar a assinatura antiga e refazer os grants. Pego no desenho da migration 16, antes de doer.

### A-15

- [2026-09-15] **A-15** (Claude Code) · **Sem rota IPv6, o host direto do Postgres do Supabase (`db.<ref>.supabase.co`) não resolve** — foi por isso que a S15 e a S19 aplicaram pela API. Alternativa de máquina: o session pooler IPv4 (`aws-N-<região>.pooler.supabase.com`, usuário `postgres.<ref>`) — o script de carga da S19 deriva sozinho. Credencial continua fatiada à mão ([[Memoria - Acesso Seguranca e Credenciais#E-12|E-12]]) e jamais impressa.

### A-65

- [2026-10-16] **A-65** (Claude Code, SESSAO-32, retrato) · **Laço escondido se acha pela conta de linhas: `n_tup_ins` × linhas vivas.** Em `pg_stat_user_tables`, cards/eventos/registros tinham ~14,5 milhões de inserções para poucos milhares de linhas vivas — números quase iguais nas três tabelas = um mesmo gesto que grava as três e é DESFEITO, em laço. Era a fila do estoque com o Tiny: insumo "simples" com saldo enorme (fita 22.878,58 m) criava uma peça por unidade, estourava 8 s, desfazia e voltava a cada 10 min (a reserva vencida não contava como tentativa). Efeitos colaterais da mesma causa: estatísticas do planejador erradas (o `ANALYZE` corrigiu na hora — o teste de carga de 40 pessoas foi de p95 3,8 s para 384 ms), WAL enorme e processador gasto. Receita: conferir `n_tup_ins`/`n_tup_del` contra `n_live_tup` no retrato de toda sessão de desempenho; desproporção = procurar o gesto que é desfeito.

### A-80

- [2026-10-18] **A-80** (Claude Code, SESSAO-36) · **Três regras do harness que o bloco novo precisa saber antes de nascer.** (1) O bloco 78 imita o grant padrão do Supabase dando SELECT em TODAS as tabelas de `public` ao `authenticated` — depois dele, `has_table_privilege` não prova "tabela fechada"; a prova é **RLS ligada com ZERO políticas** (`pg_class.relrowsecurity` + `pg_policies`), e no banco real o `revoke` da migration completa. (2) `deveRecusarExec` dentro de `begin … rollback` aborta a transação inteira (25P02) nas recusas esperadas — bloco com recusas roda SEM transação, com prefixo próprio nos dados (como os blocos antigos). (3) Os testes antigos amarram a MENSAGEM das recusas por regex (ex.: `/gesto de quem executa/`) — quem recria uma função de guarda mantém o trecho amarrado dentro da mensagem nova, senão o vermelho é do texto, não da regra.

### A-81

- [2026-10-19] **A-81** (Claude Code) · Cenário novo na bateria: (a) unidades de pedido reaproveitado COLIDEM no único (pedido, item, índice) — use índices próprios do bloco; (b) o relógio do teste abre e fecha trechos de presença no MESMO instante (0 s) — quando a conferência precisa de números, SEMEIE o agregado diário à mão (o caminho fato→agregado já tem prova própria); (c) com mais de 100 usuários na bateria, porta paginada exige calcular o deslocamento até a página da pessoa.

### A-96

- [2026-10-21] **A-96** (Claude Code, SESSAO-38 · F4) · **Antes de recriar "por inteiro" uma função viva, comparar o md5 do corpo no banco (`md5(prosrc)`) com o corpo do arquivo base** (script que recorta entre os `$$`). Bateram as 7 — nenhuma frente tinha mexido direto em produção; se uma não batesse, recriar a partir do arquivo desfaria o ajuste dela ([[Memoria - Migrations Aplicador e Ensaio 1#E-24|E-24]]). Barato, só leitura, e vale para toda migration que recria função de outra.

### A-112

- [2026-10-23] **A-112** (Claude Code, SESSAO-40) · **Busca por texto normalizado: GUARDAR a régua no registro (coluna gerada) e pôr o trigrama nela — nunca o trigrama numa EXPRESSÃO com função de `SET`.** O índice de trigramas sobre `fn_nome_comparavel(…)` achava os 7 mil candidatos depressa, mas o RECHECK chamava a função (com `SET` — não embutida, [[Memoria - Desempenho e Tempo Real#E-65|E-65]]) linha a linha: 184 ms só nisso no ×100; com 2 letras, varredura com a função: 1,9 s. Com `nome_busca text generated always as (fn_nome_comparavel(…)) stored` + `gin (nome_busca gin_trgm_ops)`, a leitura só compara texto: a busca caiu para 14–26 ms. Antes de criar a coluna gerada, conferido que TODA escrita na tabela lista as colunas ([[Memoria - Tiny n8n e Integracoes 2#A-69|A-69]]). E o nome pede 3 letras (o trigrama não ajuda com 2).

### A-114

- [2026-10-23] **A-114** (Claude Code, SESSAO-40) · **Filtro de um quadro com várias colunas: resolver o conjunto UMA vez e passar os ids para as colunas.** Com a regra do filtro dentro da página e do total de cada coluna, o quadro de 8 colunas fazia 16 varreduras do setor com a regra — 300–900 ms no ×100 (pior que o quadro sem filtro, 190 ms). Com `fn_quadro_filtrados(setor, texto) → bigint[]` (nulo = sem filtro; vazio = nada bate) calculado uma vez na porta e `id = any(...)` na página/total, o quadro filtrado ficou SEMPRE mais rápido que o inteiro (57–142 ms). Junto: guardar "o que o servidor aplicou" na resposta (`filtro`) para a tela saber se o que está desenhado já é do filtro novo (o som de card novo do tablet não toca ao limpar o filtro).

### A-116

- [2026-10-27] **A-116** (Claude Code, SESSAO-41) · **Recriar 30+ funções sem erro de cópia:** script (node + pg, sessão `default_transaction_read_only`) que grava `pg_get_functiondef` das funções vivas em arquivos no rascunho, sem imprimir; outro script monta a migration com trocas EXATAS, cada uma dizendo quantas vezes deve casar (casou diferente → para). Para regra repetida em muitas portas (o campo de endereço `c.x → ee.x`, a data `p.data_prevista → fn(...)`), regex com marcador para não trocar duas vezes e com o nome de coluna preservado na lista do SELECT.

### A-120

- [2026-10-27] **A-120** (Claude Code, SESSAO-41 · ajuste) · **Prazo sem relógio que acorda para ver (Lei §4):** o prazo mora na linha (`esquecido_vence_em`, índice parcial) e o banco mantém **um** agendamento do pg_cron marcado para o MINUTO do próximo prazo (`'M H D Mês *'` em UTC), remarcado no fato por gatilho e no fim de cada disparo; sem prazo, nenhum agendamento. Um trinco (`pg_advisory_xact_lock`) em volta do "qual o próximo?" impede dois gestos simultâneos de deixar o despertador para depois do card mais antigo. Só chama o `cron.schedule` quando o minuto muda.

### A-126

- [2026-10-28] **A-126** (Claude Code, ajuste 28/10 · avisos) · **Preferência de aviso = um FILTRO na entrada da tabela** (gatilho `before insert` em `plt_notificacoes` que devolve nulo quando a pessoa desligou): vale para os ~20 produtores de aviso de hoje e os de amanhã sem tocar em nenhum; o catálogo é uma função `values` (aviso novo = uma linha); a escolha é um `jsonb` no cadastro só com o que difere do padrão (igual ao padrão sai da chave); o tipo fora do catálogo passa (nada some sem querer); o obrigatório ignora a escolha gravada.

### A-127

- [2026-10-28] **A-127** (Claude Code, ajuste 28/10 · avisos) · **Aviso "opcional para uns, padrão para outros" = o produtor manda para TODOS que podem receber e o filtro decide** (o erro vai a todo administrador; o padrão é ligado só para o super admin). Erro que nasce do FATO: gatilho `after update of <coluna> … when (new.x = 'falhou')` + o `old` conferido na função (mexer de novo na linha não repete) + a chave com intervalo (o mesmo erro numa hora = um aviso, a Auditoria guarda todos).

### A-128

- [2026-10-31] **A-128** (Claude Code, SESSAO-42) · **Projeção refeita UMA vez por gesto:** gatilho de RESTRIÇÃO adiado (`create constraint trigger … deferrable initially deferred`) em `plt_eventos` + a trava no `set_config` local (card → quantos fatos já entraram na conta). O soltar gera de 2 a 5 fatos e o card é refeito uma vez, no fim da transação; nos testes, `set constraints all immediate` faz disparar a cada comando.

### A-139

- [2026-11-04] **A-139** (Claude Code, SESSAO-45) · **Apagar o rastro de teste de tela nos registros de atividade** (pedido do dono): a tabela tem trava contra apagar; numa MESMA transação, `alter table … disable trigger <trava>` → `delete` só dos ids conferidos (usuário, ação, rota e horário do teste) → `enable trigger` → commit; conferir que a trava ficou ligada. Antes, anotar o 1º id do teste (a navegação do teste gera 1 registro por tela).

### A-145

- [2026-11-05] **A-145** (Claude Code, SESSAO-43) · **Tabela pronta para painel de período = um fato por linha + uma linha por pessoa, mantida por gatilho de COMANDO:** gatilhos `for each statement` com tabela de transição (`referencing new table as novas` / `old table as velhas` — um por evento) chamam UMA refação por comando com os ids tocados (o recálculo do card mexe em várias passagens de uma vez); a refação faz `insert … on conflict do update … where (colunas) is distinct from (excluded…)` (não reescreve o que não mudou — e não briga com outra transação como o "apaga e regrava") e tira o que deixou de valer. O gatilho de comando roda DEPOIS dos de linha (a equipe já está pronta). Teste que prova: a tabela pronta = a origem, com `except` nos dois sentidos, inclusive com o card refeito do zero. Custo no gesto ×100: +4 ms.

### A-147

- [2026-11-05] **A-147** (Claude Code, SESSAO-43) · **O plano de dentro de uma função plpgsql:** copiar a consulta da função (do `with` até o `into`) trocando as variáveis pelos valores — as de nome mais LONGO primeiro (`v_desl` antes de `v_de`) — e rodar `explain (analyze)`; ordenar os nós por tempo × voltas mostra na hora a subconsulta repetida ("loops=50"). O `explain` da chamada da função só mostra "Function Scan".

### A-148

- [2026-11-05] **A-148** (Claude Code, SESSAO-43) · **Regra nova validada por simulação antes do SQL:** a carga do Trello foi simulada em Python sobre o arquivo real (janelas com almoço, corte, lote, mínimo/teto, longo para o modelo) e os números conferidos com os da demanda (813 válidas, mediana ~44, média ~54) ANTES de escrever a função; no banco deram 815 · 43,3 · 52,1 — e a diferença (lotes reais 9, não 15) já estava explicada.

### A-197

- [2026-11-06] **A-197** (Claude Code, números que batem) · **Espera em horas de expediente sem mudar o retorno da porta:** `lido_em − espera` = o instante da chegada (o `now()` é o mesmo na transação da leitura) e a tela aplica a régua do quadro (`tempoUtilMs`, [[D-172 - A regua do tempo util vem na abertura do app Lei 2 8|D-172]]) — nenhuma coluna nova, nenhum `drop function` (o "cannot change return type" das migrations antigas reaplicadas — [[Memoria - Migrations Aplicador e Ensaio 1#E-178|E-178]] — nem aparece). E o fecho de um fato por outro (o cancelamento fecha o stand-by) vai num **gatilho próprio** com `when (new.tipo = …)`, com as MESMAS guardas da validação — a reação grande ao pedido não é tocada e a gravação do Tiny nunca cai por ele.

### A-201

- [2026-11-09] **A-201** (Claude Code, SESSAO-47) · **Três blocos independentes = base comum commitada ANTES de abrir as frentes:** o check dos tipos de fato recriado uma vez com os tipos das três, as colunas e a regra que duas frentes leem, e a única função que duas frentes precisariam recriar entregue a UM dono (que usa a regra da base). Cada frente com faixa própria de dados de teste, número próprio de migration e diário próprio — a junção só esbarra na lista de reaplicação e no ponto de inserção dos blocos da bateria.

### A-205

- [2026-11-09] **A-205** (Claude Code, SESSAO-47 · frente da entrega) · **Porta `plpgsql` que trava da 6ª chamada em diante na mesma conexão (o plano genérico não sabe o período): `SET plan_cache_mode TO 'force_custom_plan'` na definição da função, só nela.** A bateria amarra o `proconfig` e 8 chamadas seguidas iguais. (O achado era do ajuste de 06/11; entrou quando a função foi recriada por outro motivo.)

### A-209

- [2026-11-09] **A-209** (Claude Code, SESSAO-47 · frente do painel) · **O ensaio mede a 6ª chamada, não a 2ª — e antes × depois INTERCALADOS na mesma conexão.** O banco guarda o plano das consultas de cada função `plpgsql` e, da 6ª chamada em diante na mesma conexão (a API reaproveita conexões — acontece de verdade), pode trocar para um plano genérico que não conhece o período nem os filtros: a aba Montadores ia de ~120 ms para ~3.150 ms, a Dia de 25 para 90 ms. Uma sonda de 10 chamadas seguidas mostra o degrau; o remédio é `set plan_cache_mode = force_custom_plan` na função (as 7 portas de tempos). E medir a versão de antes recriada com outro nome, alternando com a nova, tira o ruído da máquina (outra frente rodando a bateria triplicava os dois lados).

### A-216

- [2026-11-11] **A-216** (Claude Code, SESSAO-48 · frente 2) · **Lista que cresce sem fim e junta duas fontes (removidos + cancelados):** cada metade anda pelo seu índice, na ordem, num laço que para quando enche a página; o cursor é (quando, id); sem total quando a tela não precisa (Lei §6.4); o filtro raro vai pelos candidatos do próprio filtro (o nº pelas faixas do índice do número; o nome pelos trigramas). 2–19 ms com 560 mil pedidos.

### E-295

- [2026-11-18] **E-295** (Claude Code, SESSAO-52) · **Junção com função que devolve tabela dentro de função `language sql`:** o planejador estima 1.000 linhas e escolhe hash com varredura das tabelas juntadas. *Correção:* o dado por linha vem por subconsulta escalar na chave primária. Pego pelo ensaio em escala 1 — ler o plano mesmo quando o tempo é bom.

### A-247

- [2026-11-18] **A-247** (Claude Code, SESSAO-52) · **A porta fina por cima da tabela fixa:** porta que devolve tabela fixa recriada por migrations antigas sem `drop` não precisa ganhar coluna — uma porta fina por cima (`to_jsonb(linha) || chave nova`), com os mesmos parâmetros, entrega o dado novo sem tocar migration antiga, sem quebrar o site publicado e sem requisição a mais.

### E-300

- [2026-11-18] **E-300** (Claude Code, SESSAO-53) · **Expressão repetida num `case` sobre subconsulta faz o banco contar duas vezes** (o ensaio mostrou a conta dobrada no plano). *Correção:* `nullif` + `jsonb_strip_nulls` — a conta sai uma vez só.

### A-252

- [2026-11-18] **A-252** (Claude Code, SESSAO-54) · **Opção nova como chave do JSON de filtros:** porta que recebe os filtros em JSON ganha a opção nova como chave — a assinatura não muda, o site velho segue servido e a tela nova tolera o banco velho (a subida deixa de depender da ordem banco → site).

### A-257

- [2026-11-18] **A-257** (Claude Code, SESSAO-55) · **Provar "igual ao de antes" no banco:** `select (porta -> 'pedaço') is not distinct from (leitura antiga)` numa chamada só, como `authenticated`, pessoa por pessoa; `now()` é o mesmo na transação — o período se confere ao microssegundo.

### E-309

- [2026-11-18] **E-309** (Claude Code, SESSAO-55) · **`jsonb -> 'chave'` de valor nulo é o nulo do JSON, não NULL** — a comparação errava. *Correção:* `nullif(…, 'null'::jsonb)` na comparação.

### A-261

- [2026-11-23] **A-261** (Claude Code, SESSAO-56) · **Estado pequeno de serviço numa linha reservada de tabela que já existe** (banco enxuto) — e ele viaja na resposta da própria chamada, sem leitura nova.

### A-267

- [2026-11-25] **A-267** (Claude Code, cofre em dia de 25/11) · **O arquivo do esquema é carregado pela bateria do banco — o que é da plataforma entra nele só em comentário.** Ele é o retrato da integração que os testes rodam antes das migrations; pôr ali o corpo de uma função da plataforma faria a bateria criá-la antes da hora. *Forma:* uma seção numerada por subida, com cada atualização **na ordem em que foi aplicada em produção** (a ordem sai do relatório da publicação, não do nome do arquivo — ver [[Memoria - Migrations Aplicador e Ensaio 2#E-328|E-328]]) e a assinatura do que foi criado, recriado ou removido; o corpo mora na migration.
