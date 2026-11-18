---
id: D-336
aliases: [D-336]
titulo: "A leitura por camadas: obrigatória até 40 KB, o mapa da área e o resto só por ligação"
tipo: decisao
data: 2026-11-18
status: provisoria
revisa: []
revisada_por: []
complementa: ["[[D-010 - Metodo de trabalho sessoes Claude Code ordenadas CLAUDE md|D-10]]", "[[D-017 - Formato dos prompts do Claude Code minimo so o caminho|D-17]]"]
area: [processo]
tags: [decisao, area/processo, provisoria, provisoria-em-parte]
---
# D-336 · ✅ DECIDIDA pelo dono (o princípio, 11/11) + ⏳ PROVISÓRIA (os números e a forma) — A leitura por camadas: obrigatória até 40 KB, o mapa da área e o resto só por ligação (18/11/2026, SESSAO-49) — ↪️ D-10, D-17

*"O Claude Code [deve ler] apenas o que cada demanda irá exigir, e o documento obrigatório de regras com o formato otimizado — leitura rápida e leve."* (dono, 11/11)

1. **Camada 1 — toda sessão, inteira:** o `CLAUDE.md` da raiz (≤ 10 KB) + as Regras de Ouro (≤ 30 KB). Soma ≤ 40 KB.
2. **Camada 2 — o que a demanda lista** na seção "Leitura da sessão": os mapas das áreas (≤ 15 KB cada) e as notas apontadas.
3. **Camada 3 — só seguindo ligação ou busca:** uma decisão, a nota do banco do domínio, as lições do tema, o design do assunto.
4. **Meta:** ≤ 150 KB lidos antes de codar (era 1,3 MB). O verificador faz a conta (`--leitura`).
5. **Os índices grandes não se leem inteiros** — servem à busca.
6. **Sai a regra "ler tudo antes de codar"** (a ordem de leitura antiga do `CLAUDE.md` e a obrigação de ler a memória e as decisões inteiras). Fica a obrigação de ler a camada 1 inteira e a demanda duas vezes.

**Por que provisória:** o princípio é do dono; os números (40, 15, 150 KB), a escolha do que entrou nas Regras de Ouro e a redação curta das 20 regras são da sessão. O texto completo das regras de antes está guardado, sem mudar, em [[CLAUDE - Regras do Claude Code (repo)]].
