---
titulo: "Memória de aprendizado — Publicacao Vercel e Funcoes"
tipo: memoria-tema
tema: publicacao
atualizado: 2026-11-18
tags: [memoria, aprendizado, tema/publicacao]
---

# 🧠 Memoria - Publicacao Vercel e Funcoes

> Lições deste tema, movidas de [[PLT - Memoria de Aprendizado]] em 18/11/2026 sem reescrever. Entrada nova entra **aqui**, na seção do tipo dela, com o id no título (`### E-NNN`); o próximo número livre está no índice.

## 🔴 Erros e correções (E-NN)

### E-84

- [2026-10-03] **E-84** (Claude Code, ajustes da SESSAO-28) · O [[Memoria - Regras de Negocio - Producao PCP Estoque e Rotas 1#E-15|E-15]] de novo, numa Edge Function: a regex de tirar acento (a faixa dos acentos combinantes, escrita com escape unicode) passou pela ferramenta de edição e o arquivo saiu com os caracteres combinantes LITERAIS — funcionaria, mas invisível e frágil → **correção:** reescrito sem escape (`charCodeAt(0) < 0x300 || > 0x36f`) e conferido contando caracteres combinantes no arquivo (0). **Lição: o E-15 vale para todo arquivo — faixa de Unicode se escreve por código de caractere, nunca por escape unicode passando pela ferramenta (nem dentro de texto de memória: a 1ª versão DESTA linha, por script, quebrou pelo mesmo motivo).**

### E-268

- [2026-11-11] **E-268** (Claude Code, SESSAO-48 · na subida) · A 1ª publicação da sessão FALHOU na Vercel antes de montar ("Deployment failed", com o link para a página de configuração de projeto): o `ignoreCommand` do `vercel.json` tinha **363 caracteres** e o esquema da Vercel aceita **no máximo 256** (`buildCommand` e `installCommand` também). A prova da frente 5 rodou o COMANDO num clone raso, mas ninguém validou o ARQUIVO contra o esquema; o site seguiu na versão anterior por ~4 min (a Vercel não troca o que está no ar quando a publicação falha). → **Correção:** a lógica foi para `scripts/vercel-pular-documentacao.sh` e o `vercel.json` só chama `sh scripts/vercel-pular-documentacao.sh` (39 caracteres) — a 2ª publicação entrou. **Lição:** mexeu no `vercel.json` → conferir cada campo contra `https://openapi.vercel.sh/vercel.json` (o esquema oficial, lido por programa) antes de publicar; comando longo mora em roteiro.

## 🟢 Acertos que viraram padrão (A-NN)

### A-94

- [2026-10-21] **A-94** (Claude Code, SESSAO-38 casca) · **Publicar Edge Function pelo conector sem atropelar nada:** (1) `get_edge_function` ANTES e comparar com o arquivo do repo (a 15 publicada = repo, só o fim de linha final) — senão publica-se por cima de uma versão mais nova; (2) conferir de novo a versão logo antes de publicar; (3) depois, `get_edge_function` e comparar o texto publicado com o do repo **byte a byte** (script: `json.loads` da resposta → `files[0].content == arquivo`) — o conteúdo vai inteiro dentro da chamada e um caractere errado derrubaria a entrada de todo mundo; (4) sondar só casos que não abrem sessão (ação desconhecida, usuário que não existe, formato inválido) com a chave pública lida do `.env.local` sem imprimir. Tipos sem Deno na máquina: `tsc` com um `shim.d.ts` (Deno + o módulo `npm:` apontando para o `node_modules`).

### A-150

- [2026-11-06] **A-150** (Claude Code, SESSAO-43) · **"Publicado" só quando o pacote novo está no endereço, não quando o status do commit fica verde:** no Vercel o status do commit fica `success` com a PRÉVIA; a PRODUÇÃO é outro deploy, uns 30 s depois, e até lá `sistema-domoby.vercel.app` serve o pacote antigo (com cache `HIT`). Conferir: `gh api repos/<org>/<repo>/deployments` (o de ambiente "Production" do commit) + baixar o `index-*.js` que o `/` carrega e procurar as rotas novas. Tela logada: o navegador do app cai em "Entrar" e a senha é do dono — a conferência fica nas portas pelo banco como o admin ([[Memoria - Acesso Seguranca e Credenciais#A-75|A-75]]) e na tela pelo dono.

### A-213

- [2026-11-11] **A-213** (Claude Code, SESSAO-48 · frente 5) · **Provar o `ignoreCommand` da Vercel sem tocar na Vercel nem no repositório:** clone RASO (`--depth=10`, como o da Vercel) no rascunho + `env -C <clone> VERCEL_GIT_PREVIOUS_SHA=<commit> sh -c "<o comando do vercel.json>"` contra commits reais (só cofre → 0 pula; código → 1 monta; 1ª publicação do ramo e commit fora do clone → 1 monta). Sem `cd`, sem worktree nova.

### A-220

- [2026-11-11] **A-220** (Claude Code, SESSAO-48 · regra da casa promovida ao CLAUDE.md) · **Subir para a main é publicar o site** (a Vercel monta a cada envio): commit de código na main só no momento combinado com o dono — a regra 2 já pede o OK para publicar. Com o pulo da documentação no ar ([[D-303 - A versao e o codigo e documentacao nao publica a mudanca|D-303]], depois do OK), o cofre pode subir a qualquer hora sem publicar nada.

### A-235

- [2026-11-12] **A-235** (Claude Code, SESSAO-50 · na subida) · **A publicação conferida pelo próprio arquivo de versão:** logo depois do envio, o `versao.json` do site ainda era o antigo (a troca se espalha pelas bordas da Vercel em ~1 min) e um pedaço do código antigo já dava 404; minutos depois, o `versao.json` vivo = o da montagem local (`62953bf3f155`) e os pedaços novos respondem 200. Conferir sempre as duas coisas (a versão e um pedaço novo) antes de dizer "no ar".

### A-243

- [2026-11-17] **A-243** (Claude Code, SESSAO-51) · **Cada envio para a main gera DUAS publicações na Vercel** (dois status no commit, dois projetos olhando o repositório). O primeiro "Deployment has completed" NÃO é o site no ar — a espera que parou no primeiro sucesso leu a versão ANTERIOR (o `versao.json` ainda velho, `X-Vercel-Cache: HIT`). Conferir: todos os status do commit em sucesso **e** o `versao.json` vivo igual ao da montagem local (`dist/versao.json`) — esse é o "está no ar".
