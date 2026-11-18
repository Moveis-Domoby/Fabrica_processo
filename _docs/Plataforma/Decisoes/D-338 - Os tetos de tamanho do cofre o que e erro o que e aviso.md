---
id: D-338
aliases: [D-338]
titulo: "Os tetos de tamanho do cofre: o que é erro, o que é aviso e o que não se cobra"
tipo: decisao
data: 2026-11-18
status: provisoria
revisa: []
revisada_por: []
complementa: ["[[D-336 - A leitura por camadas obrigatoria ate 40 KB o mapa da area|D-336]]"]
area: [processo]
tags: [decisao, area/processo, provisoria]
---
# D-338 · ⏳ PROVISÓRIA — Os tetos de tamanho do cofre: o que é erro, o que é aviso e o que não se cobra (18/11/2026, SESSAO-49) — ↪️ D-336

| O quê | Teto | Passou do teto |
|---|---|---|
| Camada 1 (`CLAUDE.md` + Regras de Ouro) | 40 KB (10 + 30) | **erro** |
| Mapa de área e o Mapa do Projeto | 15 KB | **erro** |
| Índice gerado (decisões, lições, banco) | 60 KB | aviso |
| Nota de decisão | 8 KB | aviso |
| Nota temática (lições, banco, design, dívidas da lei) | 30 KB | aviso |
| Demanda | 25 KB | aviso |
| Handoff | 15 KB | aviso |
| Diário de execução | 30 KB | aviso |

1. **O índice gerado tem teto próprio (60 KB)** — uma linha por decisão não cabe em 15 KB com 291 decisões. Ele não é leitura obrigatória.
2. **"Não reescrever" vence o teto:** nota que não cabe sem mexer no texto fica como está e vira aviso.
3. **Tema ou domínio grande demais vira partes numeradas** ("… 1", "… 2"), em ordem de data. Entrada nova entra na última parte; parte que encher ganha a seguinte.
4. **História não é cobrada:** demandas, handoffs e diários de antes de 18/11/2026 aparecem só como contagem.
5. **Erro do verificador** (não entrega): ligação quebrada ou nota solta nas notas vivas, camada 1 ou mapa acima do teto, decisão com frontmatter inválido, lista gerada desatualizada. O resto é aviso.
6. **Ligação para um trecho que não existe dentro da nota** (a nota abre, o trecho não) é aviso.

**Por que provisória:** os tetos de 40/15/8/30/25/15/30 KB são os da demanda; o teto do índice, a regra das partes e a separação erro × aviso são da sessão.
