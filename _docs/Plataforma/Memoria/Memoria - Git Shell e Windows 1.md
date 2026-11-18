---
titulo: "Memória de aprendizado — Git Shell e Windows (parte 1 de 2)"
tipo: memoria-tema
tema: git-shell
atualizado: 2026-11-18
tags: [memoria, aprendizado, tema/git-shell]
---

# 🧠 Memoria - Git Shell e Windows 1

> Lições deste tema, movidas de [[PLT - Memoria de Aprendizado]] em 18/11/2026 sem reescrever. Entrada nova entra **aqui**, na seção do tipo dela, com o id no título (`### E-NNN`); o próximo número livre está no índice.

## 🔴 Erros e correções (E-NN)

### E-9

- [2026-08-24] **E-09** (Claude Code) · `sed`/`perl` no Git Bash do Windows não casaram padrão contendo a barra invertida de caminho Windows (mangling de argumento do MSYS) e a substituição falhou calada três vezes → **correção:** edição de string com caminho feita via `node -e` usando `String.fromCharCode(92)`; e **sempre conferir o resultado da substituição**, nunca assumir que rodou.

### E-10

- [2026-08-24] **E-10** (Claude Code) · `git push` respondeu `Repository not found` e a leitura óbvia — "o repositório não existe" — estava errada: era a **credencial pessoal do GitHub tentando alcançar um repositório privado de outra conta** (o GitHub responde 404 em vez de 403 de propósito, para não revelar a existência do repo) → **correção:** usuário na URL do remoto (`https://conta@github.com/...`) para o Credential Manager guardar uma credencial por conta, ou convidar a conta pessoal como colaboradora. **Lição geral: 404 de serviço autenticado quase sempre é permissão, não ausência.**

### E-23

- [2026-09-01] **E-23** (Claude Code) · `git add -A` num repositório onde OUTRA frente deixou arquivos soltos no working tree (docs do backfill) varreu trabalho alheio para dentro do commit da sessão → **correção:** `reset --soft` + recommit só com os caminhos da sessão. **Lição: em repo compartilhado entre frentes, commit é sempre por caminho explícito — `add -A` só depois de conferir o `git status`.**

### E-33

- [2026-09-16] **E-33** (Claude Code) · A SESSAO-20 inteira foi mesclada e enviada ao GitHub, mas **o Vercel não publicou**: os commits saíram com a identidade global do Git da máquina (`Wallace <wccauan@gmail.com>`), e o Vercel só publica commit cujo autor é a conta dona do projeto — o último deploy que funcionou foi o merge da S19, feito pelo GitHub com autor `contatodomoby` → **correção:** commit no topo da `main` com autor **e** committer `contatodomoby <contatodomoby@gmail.com>`, sem reescrever o histórico já publicado. **Lição: neste repositório, o que vai para a `main` precisa sair como `contatodomoby` — conferir `git log --format='%an <%ae>'` antes do push; "subiu no GitHub" não é "publicou no Vercel".**

### E-34

- [2026-09-17] **E-34** (Claude Code) · Primo do [[Memoria - Git Shell e Windows 1#E-9|E-09]]/E-15: `Get-Content | Set-Content -Encoding utf8` no PowerShell 5.1 releu arquivo UTF-8 como ANSI e gravou mojibake ("Ã§", "â€”") em 3 telas novas E no MeuPainel — este último passou por tsc/lint/build sem acusar e **o dono viu "OlÃ¡, Wallace!" na tela** (18/09) → **correção:** telas novas regravadas pela ferramenta de edição; MeuPainel restaurado do commit íntegro via `git show` no Bash (redirecionamento byte-fiel) + edições reaplicadas; `grep 'Ã'` no src virou conferência do incidente. **Lição: edição de texto em arquivo UTF-8 não passa pelo pipeline de string do PowerShell — e mojibake compila: a conferência é grep no fonte, não o build.** ↪️ 30/09 (Ajuste Estoque 2): o `grep 'Ã'` sozinho dá falso positivo em texto MAIÚSCULO legítimo ("NÃO", "AÇÃO") — a conferência é pelas DUPLAS quebradas: `grep -E 'Ã§|Ã£|Ã©|Ã­|Ãµ|Ã¡|â€'`.

### E-37

- [2026-09-22] **E-37** (Claude Code) · Com o dono fora, `git push` do repo da fábrica ficou 2+ min parado — o Git Credential Manager abriu a janela de escolher conta/login e ninguém respondeu (primo do [[Memoria - Git Shell e Windows 1#E-10|E-10]]: credencial por conta) → **correção:** push só daquele comando com a credencial do `gh` já logado (conta com WRITE no repo): `git -c credential.helper= -c "credential.helper=!gh auth git-credential" push …`, com `GIT_TERMINAL_PROMPT=0`. **Lição: em sessão sem o dono presente, nada que possa abrir janela de login — conferir `gh repo view … --json viewerPermission` e usar o `gh` como credencial.**

### E-38

- [2026-09-23] **E-38** (Claude Code) · Empurrei 2 commits (migration 32 + docs) para a branch do PR #6 depois de o dono já ter mesclado o PR — o GitHub aceitou o push na branch, mas os commits ficaram FORA da `main`, com a migration já aplicada em produção (risco [[Memoria - Migrations Aplicador e Ensaio 1#E-24|E-24]]: produção sem espelho no repo) → **correção:** cherry-pick dos 2 commits para a branch nova (PR #7) e aviso na descrição do PR #6. **Lição: antes de empurrar mais commits para um PR aberto, conferir `gh pr view N --json state` — o dono pode ter mesclado no meio do caminho.**

### E-45

- [2026-09-27] **E-45** (Claude Code) · Primo do [[Memoria - Git Shell e Windows 1#E-9|E-09]]/E-15: editei um `.tsx` com `node -e "…"` no Bash e o texto novo tinha **template literals** (crases) — o bash fez *command substitution* dentro das aspas duplas e gravou os trechos VAZIOS (`? : ,`), com "command not found" no stderr e o `node` ainda imprimindo "ok" → **correção:** conferido o arquivo na hora (sed) e os trechos regravados pela ferramenta de edição. **Lição: código com crase/`${}` nunca passa por `node -e "…"` no shell — usar a ferramenta de edição (ou script em arquivo); e "ok" do script não prova nada — conferir o arquivo.**

### E-60

- [2026-09-28] **E-60** (Claude Code, ajustes do estoque) · O lado meu do bônus do [[Memoria - Processo de Sessao Cofre e Dono#E-49|E-49]]: para tirar a MINHA linha sem commit do arquivo da memória na pasta principal (que outra sessão estava usando), conferi o `git diff` (só a minha linha) e rodei `git checkout --` no arquivo — entre a conferência e o checkout, a outra sessão gravou a linha dela, e o checkout levou as duas (ela refez, sem dano) → **correção:** trabalho movido para worktree própria; a linha dela voltou pelo commit dela. **Lição: conferir e desfazer não é atômico — em pasta onde outra sessão trabalha, nunca `checkout`/`restore` de arquivo inteiro; tirar só as próprias linhas pela ferramenta de edição, ou pedir à outra sessão.**

### E-69

- [2026-09-30] **E-69** (Claude Code, estoque × Tiny) · Segui a receita antiga das sessões paralelas e criei uma worktree própria para a frente — o dono interrompeu: *"não crie worktree nova, trabalha na principal"* → **correção:** worktree removida (vazia), trabalho na pasta principal numa branch; commits por caminho explícito porque outra sessão (fotos do Tiny) trabalhou na mesma pasta ao mesmo tempo — combinado por mensagem (numeração, arquivos de cada uma, nada de checkout). **Lição: a preferência declarada do dono vale mais que a convenção da casa; com duas sessões na mesma pasta, o protocolo é branch única + commit por caminho + aviso de arquivos, nunca trocar a branch da pasta.**

### E-55

- [2026-09-28] **E-55** (Claude Code, ajuste do Frete) · O [[Memoria - Git Shell e Windows 1#E-9|E-09]] de novo: para limpar a saída de um grep, usei `sed -E 's|C:\Users\…\_docs\||'` — caminho do Windows com barra invertida dentro do padrão → "unterminated `s' command" (só leitura, sem dano) → **correção:** `awk -F'_docs' '{print $2}'`, cortando por um pedaço sem barra. **Lição: caminho do Windows nunca entra em padrão de sed/regex no shell — cortar por um trecho sem barra (awk -F, cut) ou usar a ferramenta de busca.**

### E-56

- [2026-09-28] **E-56** (Claude Code, ajuste do Frete) · Primo do [[Memoria - Regras de Negocio - Producao PCP Estoque e Rotas 1#E-15|E-15]]/E-51: escrevi um script `.mjs` por heredoc no Bash com `\\.`, `\\s`, `\\(` numa regex — o arquivo saiu com UMA barra, e dentro do template literal do JS `\s`/`\(` viram `s`/`(`: o node quebrou com "Unterminated group" (script de leitura, sem dano) → **correção:** script regravado pela ferramenta de edição, sem nenhuma barra invertida (busca por `indexOf`/`startsWith`). **Lição: arquivo com barra invertida não passa por heredoc na ferramenta do shell — escrever com a ferramenta de edição; e, quando der, preferir código que não precise de escape.**

### E-58

- [2026-09-28] **E-58** (Claude Code) · Para ver onde outra sessão tinha inserido entradas nesta memória, rodei `cd` para dentro da worktree dela (em `.claude/worktrees/`) e `git diff` — e o app **adotou a worktree da outra sessão como a minha pasta de trabalho** (aviso de ambiente trocando a pasta principal da sessão); um comando seguinte sem `cd` explícito teria rodado, e escrito, na cópia dela → **correção:** voltei a sessão para a pasta principal (`change_directory`) sem ter escrito nada lá. **Lição: a cópia de outra sessão se olha só com `git -C "<pasta>" …` ou caminho absoluto — nunca `cd` para dentro de `.claude/worktrees/` alheio.**

### E-74

- [2026-10-01] **E-74** (Claude Code, SESSAO-29) · Na leitura inicial rodei `cd` dentro do Bash (primeiro para `_docs/Plataforma`, depois de volta à raiz) e o app **trocou a pasta de trabalho da sessão** para a subpasta — primo do [[Memoria - Git Shell e Windows 1#E-58|E-58]], agora dentro do PRÓPRIO repositório → **correção:** `change_directory` de volta para a raiz (nada foi escrito fora); daí em diante só caminho absoluto e `git -C`. **Lição: nesta casa, nenhum `cd` no shell da sessão — nem para subpasta do mesmo repo.**

### E-77

- [2026-10-01] **E-77** (Claude Code, SESSAO-27) · O [[Memoria - Git Shell e Windows 1#E-74|E-74]] de novo, no dia seguinte a ele ser escrito: na leitura inicial rodei `cd ".../_docs"` dentro de comandos do Bash (para encurtar caminhos) e o app trocou a pasta de trabalho da sessão para `_docs` — duas vezes → **correção:** `change_directory` de volta para a raiz; nada escrito fora; daí em diante só caminho absoluto e `git -C`. **Lição: a regra do E-74 vale também para `cd` "só para ler" dentro de um comando composto — a variável com o caminho (`F="…"; cat "$F"`) resolve o encurtamento sem mudar de pasta.**

### E-79

- [2026-10-02] **E-79** (Claude Code, SESSAO-27) · Mandei um script de troca grande (aspas simples, crases e `${}` de JavaScript) por heredoc direto no terminal Bash da ferramenta — o shell quebrou com "unexpected EOF while looking for matching `''" e nada rodou (a mesma família do E-45/E-56) → **correção:** o script foi escrito em arquivo pela ferramenta de escrita (no scratchpad) e rodado com `node arquivo.mjs`; dali em diante, os patches grandes foram assim (ou em Python curto com `assert` de contagem). **Lição: script com mais de umas linhas e muita aspa vai para ARQUIVO pela ferramenta de escrita — heredoc só para o que é curto e sem aspas misturadas.**

### E-87

- [2026-10-08] **E-87** (Claude Code, SESSAO-30) · O [[Memoria - Tiny n8n e Integracoes 1#E-36|E-36]]/E-46 de novo: na conferência DEPOIS da limpeza de 08/10 em produção, escrevi `plt_notificacoes.criado_em` de memória — a coluna é `criada_em` (feminino, "notificação") e a consulta quebrou (só leitura, depois do commit) → **correção:** nome tirado da migration (`grep` do `create table`). **Lição: o E-36 vale também para a consulta de conferência que vem colada num script de escrita — ela é escrita junto, na pressa; grep do nome antes de rodar QUALQUER SQL contra o banco real.**

### E-88

- [2026-10-08] **E-88** (Claude Code, SESSAO-30) · Rodei o script da limpeza de produção (que GRAVA) e mostrei só o fim da saída (`tail`) — o erro da conferência apareceu e escondeu a linha "COMMIT"; para ler o começo do erro, **rodei o script de novo**. A limpeza já tinha sido gravada; a 2ª rodada não gravou nada só porque a regra é idempotente (conferido no banco: tudo num instante só, 04:19:42, nenhuma entrega em dobro) — mas a contagem dela mentiu ("23 fechados": os lançados ficam com o card vivo e reentravam no filtro) → **correção:** filtro da manutenção ajustado (pedido já entregue sem nada vivo fica de fora) e conferência no banco antes de contar ao dono. **Lição: script que escreve em produção se roda UMA vez, com a saída inteira guardada em arquivo (`> arquivo 2>&1`) — para ler, abre-se o arquivo; nunca se roda de novo "para ver a mensagem". E manutenção idempotente precisa de filtro que também reconheça o que já fez, senão a contagem da 2ª rodada engana.**

### E-91

- [2026-10-13] **E-91** (Claude Code, SESSAO-31) · O [[Memoria - Git Shell e Windows 1#E-74|E-74]]/E-77 pela terceira vez: na leitura inicial rodei `cd ".../_docs" && wc -l …` num comando do Bash (para encurtar os caminhos) — ANTES de reler a memória — e o app trocou a pasta de trabalho da sessão para `_docs` → **correção:** `change_directory` de volta para a raiz; nada foi escrito fora; daí em diante só caminho absoluto (variável `F="…"`) e `git -C`. **Lição: a regra do E-74 vale desde o PRIMEIRO comando da sessão — a memória se lê antes de qualquer `cd`, e o encurtamento é sempre por variável, nunca por `cd`.**

### E-93

- [2026-10-14] **E-93** (Claude Code, SESSAO-31) · O [[Memoria - Git Shell e Windows 1#E-74|E-74]]/E-91 de novo: para formatar os arquivos tocados rodei `cd /c` antes do formatador (para os caminhos ficarem curtos) — o ambiente devolveu a pasta, nada mudou de lugar. → **Correção:** o formatador roda com caminho absoluto (`npx --prefix "<repo>" prettier --write <caminhos absolutos>`), sem `cd`; a regra de nunca usar `cd` vale para TODA ferramenta, não só para git. ↩️ Reincidiu na etapa G (um `cd` antes da bateria do banco): a bateria também roda com `npm --prefix "<repo>" run test:banco` — sem `cd`.

### E-101

- [2026-10-15] **E-101** (Claude Code, SESSAO-32) · O [[Memoria - Git Shell e Windows 1#E-74|E-74]]/E-77/E-91/E-93 pela quinta vez, de novo no PRIMEIRO levantamento e ANTES de reler esta memória: `cd ".../_docs" && wc -l …` num comando do Bash (para encurtar os caminhos) — o app trocou a pasta de trabalho da sessão para `_docs` → **correção:** `change_directory` de volta para a raiz; nada foi escrito fora; daí em diante só caminho absoluto (variável `R="…"`, `git -C`, `npm --prefix`). **Lição: cinco reincidências provam que a lição escrita só aqui não segura — promovida ao CLAUDE.md (regras básicas), que é lido antes do primeiro comando.** → promovida

### E-105

- [2026-10-16] **E-105** (Claude Code, SESSAO-32) · Editei arquivos com Python no Windows abrindo em modo texto padrão — o `

### E-113

- [2026-10-18] **E-113** (Claude Code, SESSAO-33 — em casa) · **Commit na pasta compartilhada caiu no ramo de OUTRA sessão.** Entre dois comandos meus, a sessão do Tablet 2.0 (SESSAO-36) criou e trocou a pasta principal para o ramo `sessao-36-tablet-login-setor`; o meu `merge --ff-only` + `commit` (a 94 e o cofre da [[D-145 - A consulta de hora em hora pergunta os produtos alterados|D-145]]) foram parar no ramo dela, e o `fetch . <ramo-33>:main` foi recusado em silêncio (`-q` escondeu o "non-fast-forward") — o push disse "Everything up-to-date". **Correção:** o commit era filho da main → `update-ref` da main e do ramo da 33 para ele (avanço direto, sem checkout) e push; o ramo da 36 ficou igual à main nova (como se tivesse nascido dela); a sessão da 36 avisada. **Lição: com outra sessão ativa na pasta, nunca `commit` na árvore de trabalho — índice temporário (`GIT_INDEX_FILE` + `read-tree main` + `commit-tree` + `update-ref` com o valor antigo) direto na main; e nunca `-q` em passo que pode ser recusado — conferir `git branch --show-current` e o resultado de cada `update-ref`/push.**

### E-158

- [2026-10-27] **E-158** (Claude Code, SESSAO-41) · `python -I -` com o heredoc VAZIO (sobrou de um rascunho) abre o Python INTERATIVO e segura o comando até o tempo-limite — a saída do fundo foi a 500 KB e o comando teve de ser parado → **correção:** comando refeito sem o heredoc. **Lição: nunca deixar `python -` sem script; e o comando que lê arquivo grande filtra antes de mostrar.**

### E-173

- [2026-10-31] **E-173** (Claude Code, SESSAO-42) · Um comando com dois `python -` e o segundo heredoc VAZIO abriu o interpretador interativo em segundo plano, que gravou 64 MB de erro até ser parado → **correção:** tarefa parada, arquivo apagado. **Lição: um `python -` por comando, sempre com o script; nada de heredoc vazio.**

### E-179

- [2026-11-04] **E-179** (Claude Code, SESSAO-45) · Remendo por script com `d` dentro de heredoc perdeu as barras (a regex virou `d{2}`); e um `sed` para tratar CRLF quebrou o próprio script. → **correção:** regex mexida com a ferramenta de edição; scripts de remendo escritos pelo Write, com a âncora conferida (o script para se a âncora não aparecer exatamente 1 vez).

### E-180

- [2026-11-05] **E-180** (Claude Code, SESSAO-45 · ajuste) · Um `cat > arquivo` SEM heredoc no começo de um comando ficou esperando a entrada — o comando inteiro travou em segundo plano e criou um arquivo vazio FORA do repositório (na pasta de cima). → **correção:** tarefa parada, arquivo apagado, o remendo refeito pela ferramenta de edição. **Lição: `cat >` só com heredoc; comando com `node`/script sempre com `< /dev/null`.**

### E-190

- [2026-11-05] **E-190** (Claude Code, SESSAO-43) · A regra 20 pela sexta vez: abri o comando do `git add` com `cd /c 2>/dev/null;` (sobra de digitação) — o app avisou "Shell cwd was reset" e voltou à pasta da sessão; nada mudou (o resto do comando já usava `git -C`). → **correção:** nenhuma a fazer no repositório; a partir daqui, conferir o começo de todo comando antes de enviar. **Lição: o `cd` escapa até quando não é preciso — o comando começa pela variável do caminho (`R="…"`), nunca por `cd`.**

### E-193

- [2026-11-05] **E-193** (Claude Code, SESSAO-43) · Ao resolver o conflito do merge com a main (a SESSAO-46 escreveu nas Decisões no mesmo lugar que eu), o script tirou os marcadores e, de quebra, juntou TODA linha em branco tripla do arquivo — 8 linhas em branco de decisões antigas sumiram (pego no `git diff` contra as duas pontas antes do commit). → **correção:** o arquivo refeito a partir da versão da main + o meu bloco inteiro colado antes do dela (nada de troca global). **Lição: conflito "os dois acrescentaram no mesmo lugar" se resolve montando o arquivo das duas versões; conferir o `git diff` contra AS DUAS pontas — só as minhas linhas podem aparecer.**

### E-247

- [2026-11-09] **E-247** (Claude Code, SESSAO-47) · Três tropeços de ferramenta na mesma sessão: (1) o `replace` do JavaScript come o `$$` do texto novo (`$$` vira `$`) — texto de função se troca por `split/join`; (2) programa com barra invertida passado por heredoc ou por `sed` chega estragado (o meu `sed` no explorador do ensaio perdeu as barras da expressão e cada bloco rodou UMA vez em vez de oito — a medida saiu sem a 6ª chamada) — programa com escapes vai pela ferramenta de escrita/edição, sempre; (3) comparar `jsonb` como texto falha pela ordem das chaves — canonizar antes. **Lição: depois de mexer num programa de medida, conferir na saída QUANTAS vezes ele rodou.**

### E-249

- [2026-11-09] **E-249** (Claude Code, SESSAO-47) · No fecho, passei um programa de troca de texto por `node -e "…"` (aspas duplas do shell) com crases dentro do texto novo: o shell executou cada trecho entre crases como comando — todos falharam (um era o caminho de um arquivo de configuração, que o shell tentou rodar e parou no erro de sintaxe; nada rodou de verdade) — e a seção do diário foi gravada com buracos no lugar dos nomes → **correção:** refeita pela ferramenta de edição. É a QUARTA vez ([[Memoria - Git Shell e Windows 1#E-45|E-45]], [[Memoria - Git Shell e Windows 1#E-79|E-79]], [[Memoria - Git Shell e Windows 1#E-145|E-145]]). **Lição: texto com crase nunca dentro de aspas duplas do shell — troca em nota se faz com a ferramenta de edição; programa, só em arquivo escrito pela ferramenta de escrita.**

### E-262

- [2026-11-11] **E-262** (Claude Code, SESSAO-48) · Na junção das frentes, o programa que resolve o conflito da bateria casou `=======\n` (preguiçoso) DENTRO das linhas de comentário `// =====…` — juntou pedaços errados. → **Correção:** marcadores presos ao começo da linha (`/^<<<<<<< HEAD\n([\s\S]*?)^=======\n([\s\S]*?)^>>>>>>> ramo\n/gm`), o número de conflitos conferido antes de trocar e "sobrou marcador?" conferido depois; `node --check` no fim.

### E-275

- [2026-11-12] **E-275** (Claude Code, SESSAO-50 · reincidência do [[Memoria - Git Shell e Windows 1#E-247|E-247]]) · `node -` com o programa num heredoc E `< /dev/null` no fim: a entrada virou o `/dev/null`, o programa rodado foi VAZIO e o comando saiu "certo" sem trocar nada. → **Correção:** troca por arquivo de especificação + `trocar.mjs` (contagem exata de cada troca). **Lição:** programa sempre em arquivo; `< /dev/null` só em comando que não lê da entrada.

### E-145

- [2026-10-21] **E-145** (Claude Code, SESSAO-39) · Primo do [[Memoria - Git Shell e Windows 1#E-9|E-09]]/E-15/E-126: troca de texto num `.ts` por `node -e "…"` dentro do Bash com crases e `${…}` do TypeScript — o Bash interpretou as crases como substituição de comando, o node recebeu código quebrado e nada foi gravado (o erro avisou). → **correção:** a troca pela ferramenta de edição. **Regra:** texto com crase ou `${` (template string) nunca passa por `node -e` no Bash — ferramenta de edição ou script em arquivo.

### E-156

- [2026-10-23] **E-156** (Claude Code, SESSAO-40) · O [[Memoria - Tiny n8n e Integracoes 1#E-36|E-36]]/E-46/E-87/E-104/E-130 de novo: antes do teste em produção, para ver quem escuta o gesto, escrevi `plt_automacoes.ativa` de memória — a coluna é `ligada` (e a de arquivo, `arquivada_em`); a consulta de leitura quebrou (sem dano) → **correção:** nomes tirados do `create table` (grep) antes de reescrever. **Lição: o grep do `create table` vale até para a consulta de "quem escuta isto?" feita na pressa antes de um teste.**
