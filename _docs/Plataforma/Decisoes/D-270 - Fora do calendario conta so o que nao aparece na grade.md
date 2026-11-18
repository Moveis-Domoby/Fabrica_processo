---
id: D-270
aliases: [D-270]
titulo: "\"Fora do calendário\" conta só o que não aparece na grade"
tipo: decisao
data: 2026-11-06
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-175 - O CALENDARIO da programacao um modo de ver dentro de Rotas|D-175]]"]
area: [logistica-rotas]
tags: [decisao, area/logistica-rotas]
---
# D-270 · "Fora do calendário" conta só o que não aparece na grade (06/11/2026) — ↪️ D-175

**Achado (varredura de 06/11):** "Fora do calendário: 6 sem rota com a previsão já vencida" contava também os 3 que estavam na grade da semana (13795 em 03/11; 13785 e 13815 em 04/11).

**Decidido (sem escolha de produto — o aviso diz "fora do calendário"):** conta o sem rota com a previsão vencida **fora do período mostrado** (e o sem previsão, como antes). Na semana de 02 a 08/11: 3 + 1 sem previsão.

**Como ficou (técnico):** migration `20261106030000` — `plt_fn_rotas_calendario`, `fora.atrasados_sem_rota` com `previsão < hoje e fora de [de, até]`.
