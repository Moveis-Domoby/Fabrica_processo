---
id: D-110
aliases: [D-110]
titulo: "O mapa da Programação mostra também a rota JÁ PROGRAMADA de cada caminhão no dia"
tipo: decisao
data: 2026-10-02
status: revisada
revisa: []
revisada_por: ["[[D-111 - A Programacao em duas abas Programar e Ja programadas itens|D-111]]"]
complementa: ["[[D-039 - ROTAS programacao de caminhao com mapa e sugestao caminhoes|D-39]]"]
area: [logistica-rotas]
tags: [decisao, area/logistica-rotas]
---
# D-110 · O mapa da Programação mostra também a rota JÁ PROGRAMADA de cada caminhão no dia (02/10/2026) — ↪️ D-39

**Decidido (resposta 5 do dono):** *"Sim, faça mostrar"*.

- Além de **"Montando agora"** (os pedidos marcados, como antes), o mapa tem uma escolha por **caminhão programado no dia**: escolher um caminhão mostra a rota dele (fábrica → paradas na ordem salva → fábrica), com distância e tempo, e permite reordenar e salvar ([[D-109 - A ordem das paradas a sugestao e a do mais perto mas qualquer|D-109]]).
- Os dados já chegam na tela junto com a lista (nenhuma consulta nova — regra "cada tela requisita só o que mostra").

**Descartadas:** o mapa só da seleção (a rota calculada sumia no momento em que se confirmava a programação).

**↩️ revisada em 2026-10-03 ([[D-111 - A Programacao em duas abas Programar e Ja programadas itens|D-111]]):** a rota de cada caminhão saiu da aba de montar e foi para a aba filha **"Já programadas"**.
