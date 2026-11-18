---
id: D-335
aliases: [D-335]
titulo: "Os roteiros do cofre não publicam o site"
tipo: decisao
data: 2026-11-18
status: provisoria
revisa: []
revisada_por: []
complementa: ["[[D-303 - A versao e o codigo e documentacao nao publica a mudanca|D-303]]"]
area: [publicacao-infra, processo]
tags: [decisao, area/publicacao-infra, area/processo, provisoria]
---
# D-335 · ⏳ PROVISÓRIA — Os roteiros do cofre não publicam o site (18/11/2026, SESSAO-49) — ↪️ D-303

O pulo da documentação na Vercel ([[D-303 - A versao e o codigo e documentacao nao publica a mudanca|D-303]]) passa a pular também quando só mudou a pasta `scripts/cofre/` — os roteiros do verificador do cofre. O site não usa nada dessa pasta; sem isto, cada ajuste no verificador montaria o site de novo, sem necessidade.

- **O que muda:** uma linha em `scripts/vercel-pular-documentacao.sh` (a lista do que não conta como código ganha `scripts/cofre`).
- **Efeito único:** a subida que levar esta mudança monta o site uma vez (o próprio roteiro do pulo é código). Daí em diante, mexer no verificador não publica nada.
- **O que NÃO muda:** qualquer outro arquivo fora de `_docs/`, `Claude outputs/`, `*.md` e `scripts/cofre/` continua montando o site.

**Por que provisória:** a demanda de 11/11 não previu o ponto; o dono estava dormindo (modo fila). Para desfazer: tirar `scripts/cofre` da linha.
