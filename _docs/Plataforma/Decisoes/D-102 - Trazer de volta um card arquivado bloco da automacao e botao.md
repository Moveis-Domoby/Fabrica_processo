---
id: D-102
aliases: [D-102]
titulo: "\"Trazer de volta\" um card arquivado — bloco da automação e botão do admin"
tipo: decisao
data: 2026-10-01
status: vigente
revisa: []
revisada_por: []
complementa: []
area: [kanban-producao, painel-chat-automacoes]
tags: [decisao, area/kanban-producao, area/painel-chat-automacoes]
---
# D-102 · "Trazer de volta" um card arquivado — bloco da automação e botão do admin (01/10/2026)

**Decidido (resposta 4 do dono):** *"Sim, a automação deve ter um nó de trazer de volta também"*.

- Evento novo `card_desarquivado` (o arquivar deixa de ser só ida): o card volta para onde estava (o arquivamento nunca mudou a posição). A peça livre que volta ao ESTOQUE volta a contar no Tiny ([[D-077 - A plataforma manda no Tiny entrada baixa e contagem daqui|D-77]]).
- **Bloco "Trazer de volta"** no canvas (com o gatilho "O card foi arquivado") e **botão "Trazer de volta"** no histórico das execuções, onde uma automação arquivou (o admin desfaz à mão).
