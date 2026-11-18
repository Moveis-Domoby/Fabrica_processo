---
id: D-103
aliases: [D-103]
titulo: "As regras do motor: na hora, no banco, nunca derruba o gesto; cadeia até 5; obedece às regras de uma pessoa; o catálogo de blocos"
tipo: decisao
data: 2026-10-01
status: vigente
revisa: []
revisada_por: []
complementa: []
area: [painel-chat-automacoes]
tags: [decisao, area/painel-chat-automacoes]
---
# D-103 · As regras do motor: na hora, no banco, nunca derruba o gesto; cadeia até 5; obedece às regras de uma pessoa; o catálogo de blocos (01/10/2026)

**Decidido pelo Claude, apresentado ao dono e aceito ("pode fazer"):**

- **Roda no banco, na hora:** um gatilho ADIADO sobre os eventos dispara no fechamento do gesto (depois de tudo o que o gesto gravou — [[Memoria - Banco e SQL 2#A-47|A-47]]); outro sobre a situação do pedido. Sem fila, sem relógio rodando à toa, nada no n8n. **Falha de automação nunca desfaz o gesto da pessoa nem a gravação do Tiny** — vira registro.
- **Cadeia limitada:** automação que dispara outra (que dispara outra…) para em **5**; a 6ª fica "barrada no limite" no histórico. Disjuntor extra: 50 execuções no mesmo gesto.
- **Obedece às regras de uma pessoa:** ESTOQUE só peça 🟢 e sem dono; Pedidos em aguardo só peça de pedido vivo; **o card do pedido não sai do PCP** (vira peças pela liberação); **para as ROTAS só pelo "Lançar para ROTAS"**; etapa que "manda para" outro setor leva o card até lá (como no arrasto). Se a regra recusar, o histórico diz por quê. Mover tira o tempo de quem estava trabalhando (regra de sempre do mover).
- **Só vale para o que acontecer depois de ligar.** O "parado há" conta desde a chegada ou desde que a automação foi ligada — o que for mais novo (ligar não dispara em massa); dispara uma vez por permanência.
- **Toda execução registrada:** o que disparou (card/pedido), a condição avaliada ("o card entrou e continua na etapa" / "já tinha saído"), cada passo com o resultado e o porquê — na tela das automações (paginado) e na Auditoria. Os gestos da automação aparecem como "Automático", com o nome dela como o porquê.
- **Catálogo — QUANDO:** o card entrou numa etapa (ou em qualquer etapa do setor) · alguém começou a trabalhar no card · a peça foi marcada (perfeito/atenção/danificado) · o card ficou parado N horas/dias · o card foi arquivado · etiqueta posta · etiqueta tirada · pedido novo do Tiny · o pedido mudou de situação (de → para) · chamada de fora (n8n/API, pela chave da API). **FAÇA:** só se… (etiqueta, campo, setor, situação do pedido, tipo do card) · mover · pôr etiqueta · tirar etiqueta (ou todas) · preencher/limpar campo · avisar no sino (pessoa, líderes do setor, todos do setor, admins — com {pedido} {produto} {setor} {etapa} {situacao} {automacao}) · chamar endereço de fora (POST assinado com a chave da automação) · esperar (1 min a 30 dias) · arquivar · trazer de volta. Até 20 passos.
- **Exemplos de fábrica, desligados:** "parado há 3 dias avisa o líder" e "peça danificada avisa os admins" (os da antiga SESSAO-17 que cabem; o "pedido completo avisa a expedição" não — esse gatilho não existe ainda).
- **O canvas é feito em casa** (sem biblioteca nova): blocos arrastáveis, ligações em curva, ligar arrastando a bolinha; tudo também por botão ("+" põe o próximo bloco já ligado). No tablet a tela serve para ligar/desligar e ver o histórico.

**Descartadas:** fila com relógio de 1 em 1 minuto para executar (o dono vetou relógio à toa — [[D-080 - Um fluxo so no n8n para o Tiny da fabrica catalogo estoque|D-80]]); travar a automação aos setores de produção e às peças (o dono: "para tudo"); deixar a automação passar por cima das regras do estoque (corromperia o número do galpão).
