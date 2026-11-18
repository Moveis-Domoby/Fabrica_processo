---
id: D-303
aliases: [D-303]
titulo: "A versão é o código e documentação não publica — ⏳ a mudança na Vercel só entra com o OK do dono"
tipo: decisao
data: 2026-11-11
status: provisoria
revisa: []
revisada_por: []
complementa: []
area: [publicacao-infra]
tags: [decisao, area/publicacao-infra, provisoria]
---
# D-303 · ⏳ PROVISÓRIA — A versão é o código e documentação não publica (11/11/2026, SESSAO-48 — a regra é da demanda; a fórmula é escolha da sessão) — ⏳ a mudança na Vercel só entra com o OK do dono

1. **A versão** = um resumo (sha256, 12 caracteres) dos nomes de todos os arquivos montados + o conteúdo do index.html; vai no `versao.json` e numa marca do index.html (a página sabe a própria versão por ali). Montar o mesmo código duas vezes dá a mesma versão; o commit não entra mais no pedaço de entrada (ele renomeava 89 dos 215 arquivos a cada commit — a causa do "pedaço sumido" depois de cada publicação).
2. **A Vercel pula a montagem** só quando há publicação anterior no ramo e, desde ela, só mudou `_docs/`, `Claude outputs/` ou `*.md`; qualquer dúvida monta. `supabase/` segue montando (o dono decide se entra na lista).

↪️ **11/11 (na subida):** o comando mora em `scripts/vercel-pular-documentacao.sh` — o campo `ignoreCommand` do `vercel.json` aceita no máximo 256 caracteres; o comando inteiro (363) derrubou a 1ª publicação na validação ([[Memoria - Publicacao Vercel e Funcoes#E-268|E-268]]). ✅ No ar desde 11/11 ~05:18 (com o OK do dono).
