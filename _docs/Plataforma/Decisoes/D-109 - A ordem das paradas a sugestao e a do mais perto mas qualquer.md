---
id: D-109
aliases: [D-109]
titulo: "A ordem das paradas: a sugestão é a do mais perto, mas qualquer um da logística REORDENA à mão, vê na hora e SALVA"
tipo: decisao
data: 2026-10-02
status: revisada
revisa: []
revisada_por: ["[[D-111 - A Programacao em duas abas Programar e Ja programadas itens|D-111]]"]
complementa: ["[[D-039 - ROTAS programacao de caminhao com mapa e sugestao caminhoes|D-39]]", "[[D-045 - Logistica e ROTAS unidade pronta lancamento ID de producao|D-45]]"]
area: [logistica-rotas]
tags: [decisao, area/logistica-rotas]
---
# D-109 · A ordem das paradas: a sugestão é a do mais perto, mas qualquer um da logística REORDENA à mão, vê na hora e SALVA (02/10/2026) — ↪️ D-39/D-45

**Decidido (resposta 6 do dono):** *"Faça a possibilidade de poder reordenar à mão também, a sugestão de rota é a mais próxima, porém deve sim ser possível alguém alterar as ordens e ver em tempo real clicando em um botão de salvar"*.

- A **sugestão** continua sendo "o mais perto primeiro" — agora **a partir da fábrica** (a 1ª parada é a mais perto da fábrica).
- Quem opera a programação (logística e admin) **sobe/desce paradas** na lista; o mapa redesenha a rota **na hora**, com os quilômetros e o tempo novos.
- **"Salvar ordem"** grava a ordem daquele caminhão naquele dia para todo mundo; **"Voltar à sugestão"** desfaz o ajuste. Na montagem (antes de programar), a ordem mostrada é gravada junto ao clicar em **Programar**; pedido programado depois num caminhão que já tem ordem entra **no fim**.
- **Trocar o dia ou o caminhão** de um pedido tira a ordem dele (ele vai para o fim da rota nova). Salvar a ordem vai para a trilha como UM gesto ("Salvou a ordem das paradas"); depois de entregue, nada muda.

**Descartadas:** arrastar e soltar as paradas (os botões de subir/descer funcionam igual no celular e no tablet do galpão — [[D-006 - Dispositivos tablet PC fixo por setor E celular pessoal|D-06]]); ordem só automática (o dono pediu o ajuste humano); "otimização de rota" automática de verdade (continua fora).

**↩️ revisada em 2026-10-03 ([[D-111 - A Programacao em duas abas Programar e Ja programadas itens|D-111]]):** o dono pediu o ARRASTO (*"podendo arrastar ele pra cima ou pra baixo"*) — os botões de subir/descer saíram; o arrasto funciona com mouse, dedo e teclado.
