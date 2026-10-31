---
titulo: SESSAO-42 — antes × depois dos tempos por setor (dados reais)
tipo: dados
data: 2026-10-31
tags: [execucao, sessao-42, tempo, dados]
---

# SESSAO-42 — antes × depois dos tempos por setor (dados reais)

Cópia **só de leitura** do banco real (sessão travada em leitura; lida em 31/10/2026 01:13 de Natal — 1.047 cards, 4.052 fatos, 762 trechos de presença), carregada no banco local com as migrations de produção. **Antes** = como as telas contavam até hoje; **depois** = as 4 migrations da SESSAO-42 aplicadas na cópia (o recálculo desde 19/10 levou ~17 s no PGlite). Período: o que começou (antes) ou saiu (depois) a partir de 26/10, a data oficial.

| Setor | Móveis (antes) | Card — relógio corrido (h) | Dashboards (h) | Tempos por pessoa (h) | Passagens | Válidas | A conferir | Retrabalho | Gesto de admin | Sem registro | Ainda no setor | Tempo do móvel, válidas (h) | Mediana do móvel (min) | Pessoas, trabalhando (h) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SECC | 15 | 32,7 | 19,2 | 32,4 | 33 | 12 | 0 | 6 | 0 | 14 | 1 | 12,3 | 18 | 15,6 |
| CNC | 10 | 21,6 | 8,1 | 22,5 | 14 | 8 | 2 | 0 | 0 | 3 | 1 | 7,0 | 31 | 7,6 |
| FITAMENTO | 30 | 59,7 | 19,2 | 64,8 | 54 | 22 | 8 | 9 | 0 | 14 | 1 | 11,1 | 11 | 17,6 |
| FURAÇÃO | 37 | 16,3 | 16,3 | 6,6 | 46 | 31 | 2 | 7 | 0 | 6 | 0 | 4,6 | 7 | 6,0 |
| MONTAGEM | 98 | 90,2 | 76,7 | 96,0 | 161 | 83 | 1 | 14 | 4 | 15 | 44 | 62,9 | 40 | 78,1 |
| LIMPEZA E EMBALAGEM | 87 | 88,7 | 54,5 | 85,1 | 201 | 77 | 4 | 6 | 0 | 39 | 75 | 45,2 | 28 | 52,6 |

- **Dias-pessoa acima da jornada:** antes, **16 de 46** passavam de 10 h de "trabalhando"; depois, **0 de 44** passam da jornada (07:30–12:00 + 13:00–18:00 = 9h30; o maior dia, 9,2 h).
- **Os casos da demanda, com o dado real:** card 14541133 (o do almoço) **108 min** na Montagem (antes 168); card 14541253 (o armário esquecido) **46 min** (antes 876); card 14542036 (o Fitamento rodando desde 16:27) **93 min** (antes sem fim).
- **Leitura:** a diferença maior está no FITAMENTO (59,7 h no card → 11,1 h válidas) e no SECC (32,7 → 12,3): cards rodando à noite e no almoço; "Sem registro" alto no SECC, Fitamento e Limpeza = cards arrastados adiante sem ninguém iniciar (só a Montagem avisa).
