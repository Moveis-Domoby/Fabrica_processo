---
id: D-167
aliases: [D-167]
titulo: "O TEMPO ÚTIL do card: só o expediente do setor; o PCP não tem fila"
tipo: decisao
data: 2026-10-21
status: provisoria
revisa: []
revisada_por: ["[[D-203 - O TEMPO CERTO o calendario da fabrica a pausa sozinha no fim|D-203]]"]
complementa: ["[[D-029 - Controle de tempo pelo admin horario de funcionamento pausas|D-29]]", "[[D-048 - Execucao um por vez com pausa por lider tempo de PCP e|D-48]]"]
area: [tempos-paineis, kanban-producao]
tags: [decisao, area/tempos-paineis, area/kanban-producao, provisoria]
---
# D-167 · ⏳ PROVISÓRIA (escolha do Claude — confirmar com o dono) — O TEMPO ÚTIL do card: só o expediente do setor; o PCP não tem fila (21/10/2026, pedido do dono) — ↪️ D-29, D-48

**↩️ revisada em 2026-10-30 ([[D-203 - O TEMPO CERTO o calendario da fabrica a pausa sozinha no fim|D-203]], SESSAO-42):** a execução fora do expediente **deixa de contar** (resposta 3 do dono: hora extra só quando o líder autoriza); o card rodando é pausado sozinho no fim do expediente; o tempo de cada setor vem pronto do cálculo único.

**Pedido do dono:** *"esses avisos de fila em PCP não fazem sentido na parte de tempo e histórico, já que PCP NÃO tem fila — deve ser só: Tempo útil em PCP. Lembrando que esse card deve sempre respeitar o horário do SETOR: se estiver fora do expediente e ninguém fizer hora extra, ele para de contar o tempo, até na fila — tem que contar só as horas úteis."*

- **Todo relógio de espera do card** conta só o horário de expediente do setor onde ele está: a fila ("X na fila"), o "Parado · motivo · há X", o "Pausado há X", o tempo no fim de linha, o card do pedido no PCP e o "Pedido ficou X em PCP". Fora do horário o relógio para (a frente do card diz "fora do expediente", com ícone).
- **Hora extra conta:** a execução em andamento segue o relógio corrido (quem trabalha fora do horário está trabalhando), e na linha do tempo o "Total na etapa" soma o expediente com o trabalho feito fora dele.
- **Linha do tempo ("Tempo e histórico"):** o bloco do PCP mostra só **"Tempo útil em PCP"** — o do PEDIDO ([[D-048 - Execucao um por vez com pausa por lider tempo de PCP e|D-48]]: da entrada à liberação da última unidade), sem o stand-by; os fins de linha (Expedição, Estoque, ROTAS, devolução) também mostram só "Tempo útil em <lugar>" (ninguém "inicia" ali). Os setores de produção seguem com "Fila (do setor)", as execuções e o total — todos no tempo útil.
- **O mostrador do tempo útil é em horas** ("29h 10min"), sem "dias": um dia de 24 h úteis seriam mais de dois dias de galpão.
- Regra igual à das dashboards (sem horário cadastrado = conta o tempo todo; a pausa do setor desconta), calculada no aparelho a partir da régua que vem na abertura ([[D-172 - A regua do tempo util vem na abertura do app Lei 2 8|D-172]]).
- **Fica como está (registrado):** as dashboards seguem com a conta de sempre — elas descontam também a execução fora do horário (o card agora conta essa hora extra). O horário por pessoa não entra na fila do card (a fila é do setor).
