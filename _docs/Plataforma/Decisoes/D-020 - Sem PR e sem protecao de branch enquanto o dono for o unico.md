---
id: D-20
aliases: [D-20, D-020]
titulo: "Sem PR e sem proteção de branch enquanto o dono for o único"
tipo: decisao
data: 2026-08-26
status: vigente
revisa: []
revisada_por: []
complementa: []
area: [publicacao-infra]
tags: [decisao, area/publicacao-infra]
---
# D-20 · Sem PR e sem proteção de branch enquanto o dono for o único (26/08/2026)

**Decidido (palavras do dono):** *"o github apenas eu estou subindo coisa no projeto, só eu trabalho nele, então tudo bem"*.

- A sessão **continua trabalhando em branch própria** (`sessao-NN-descricao`) — isso não muda, é o que permite conferir o conjunto antes de entrar.
- **A revisão acontece na conversa**, no checkpoint de fim de sessão. Aprovou, o merge na `main` é direto.
- **Proteção de branch no GitHub fica dispensada.**
- **↩️ Isto ajusta a regra crítica 1** do [[CLAUDE - Regras do Claude Code (repo)]] e do `CLAUDE.md` da raiz do repo, que exigiam PR. Os dois arquivos foram atualizados na mesma data.

**Gatilho para voltar atrás:** entrar mais alguém trabalhando no repositório. Aí PR e proteção de `main` voltam, porque o motivo original delas (duas pessoas escrevendo no mesmo lugar) passa a existir.
