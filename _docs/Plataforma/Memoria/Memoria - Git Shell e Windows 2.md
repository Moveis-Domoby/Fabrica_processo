---
titulo: "Memória de aprendizado — Git Shell e Windows (parte 2 de 2)"
tipo: memoria-tema
tema: git-shell
atualizado: 2026-11-18
tags: [memoria, aprendizado, tema/git-shell]
---

# 🧠 Memoria - Git Shell e Windows 2

> Lições deste tema, movidas de [[PLT - Memoria de Aprendizado]] em 18/11/2026 sem reescrever. Entrada nova entra **aqui**, na seção do tipo dela, com o id no título (`### E-NNN`); o próximo número livre está no índice.

## 🟢 Acertos que viraram padrão (A-NN)

### A-74

- [2026-10-17] **A-74** (Claude Code, SESSAO-33) · **GitHub recusado a sessão inteira (403) → cópia em pacote com o NOME da branch e o arquivo entregue ao dono na conversa.** `git bundle create <arquivo> <branch> ^main` (com `main..HEAD` o pacote sai só com "HEAD" e não restaura pelo nome — conferido); provar a restauração num clone limpo (`git fetch <arquivo> <branch>:<nome>`); enviar o arquivo ao dono (a máquina da nuvem morre e leva os commits). E nunca mandar o fluxo antigo pegar linha nova que ele não sabe montar: a separação por uma marca (`params.origem`) protege o intervalo entre subir o banco e importar o fluxo.

### A-99

- [2026-10-21] **A-99** (Claude Code, SESSAO-38 · F5) · **Ferramenta do shell da worktree isolada recusa comando que "parece" git:** heredoc com `'2-digit'` (o `toLocaleString`) ou `sed`/`grep` com variável no lugar do arquivo foram recusados ("cannot be shown not to be git"). Saída: o patch vai para um arquivo `.py` pela ferramenta de escrita (no scratchpad) e roda com `python arquivo.py <alvo>`; leitura com a ferramenta de leitura; `tar` no Windows com `--force-local` (senão `C:` vira "host remoto").

### A-134

- [2026-11-04] **A-134** (Claude Code, SESSAO-44) · **Falha antiga ou minha? Bateria de CONTROLE na main:** `git worktree add --detach <rascunho>/main_wt main` + junção do `node_modules` (`New-Item -ItemType Junction`) e `node <rascunho>/main_wt/supabase/testes/testar-migrations.mjs` — roda a bateria da main sem tocar na pasta de trabalho. O vermelho do painel de vendas ("as 7 portas novas = as antigas", `fn_dashboard_revenue_chart`) já falha na main em 04/11: não é desta sessão.

### A-149

- [2026-11-05] **A-149** (Claude Code, SESSAO-43) · **Juntar a main de outra frente sem reescrever o ramo já enviado:** `git merge origin/main` no ramo da sessão (nada de rebase + envio forçado); conflitos de "os dois acrescentaram" no cofre e na bateria ficam com os dois blocos, o de numeração menor primeiro ([[Memoria - Git Shell e Windows 1#E-193|E-193]]); depois tipos, lint, testes de tela, pacote e a bateria COMBINADA (as migrations das duas frentes juntas) antes de seguir.

### A-198

- [2026-11-09] **A-198** (Claude Code, SESSAO-47) · **Trabalho parado de outra sessão num ramo local (sem subir) e a demanda nova mexendo nas mesmas funções: construir POR CIMA dele, juntando por encanamento** — `git merge-tree --write-tree` + `commit-tree -p A -p B` + `update-ref <ramo> <novo> <antigo>` + `read-tree HEAD`, sem `checkout` nem tocar a pasta; antes, cópia de segurança do patch e dos arquivos. As notas soltas dessa sessão entram num commit à parte, "como a sessão deixou". Consequência que vai para o handoff: a atualização do banco dela sobe ANTES (ou junto) da nova.

### A-212

- [2026-11-11] **A-212** (Claude Code, SESSAO-48 · frente 5) · **A cascata dos nomes:** qualquer coisa que muda por commit dentro do pedaço de ENTRADA (o commit no `define`) renomeia todo pedaço que importa a entrada — 89 de 215 arquivos a cada commit, até de commit só de documentação; cada publicação virava "pedaço sumido" nas telas abertas e acendia "versão nova" sem código novo. A versão passou a ser um resumo dos nomes montados + o index.html (no `versao.json` e numa `meta` do index.html — a página lê a própria versão dali, nunca da entrada, que seria circular). **Provar montando duas vezes o mesmo código e comparando os nomes.**

## 🔴 Erros e correções (E-NN)

### E-292

- [2026-11-18] **E-292** (Claude Code, SESSAO-49) · Primo do [[Memoria - Git Shell e Windows 1#E-9|E-09]]/E-15, agora no "aqui-documento" do shell: gravei roteiros `.mjs` com `cat > arquivo <<'EOF'` pela ferramenta de shell do app e as barras invertidas chegaram ao arquivo PELA METADE (`\\` virou `\`, `\s` virou `s`, `\d` virou `d`) — uma expressão regular quebrou com erro e outra passou a casar coisa diferente SEM erro nenhum (`/^\s*(…)/` virou `/^s*(…)/`). Em outra tentativa o comando inteiro foi recusado ("unexpected EOF") por causa de aspas dentro do texto → **correção:** roteiro com barra invertida, crase ou aspas se grava pela ferramenta de arquivo (ou se edita por ela), nunca por aqui-documento; e depois de qualquer gravação por shell, conferir o trecho com `grep`. O aqui-documento serve só para texto sem barra invertida.
