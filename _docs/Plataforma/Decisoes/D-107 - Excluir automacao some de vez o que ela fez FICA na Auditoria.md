---
id: D-107
aliases: [D-107]
titulo: "Excluir automação: some de vez; o que ela fez FICA na Auditoria, marcado \"automação excluída\""
tipo: decisao
data: 2026-10-02
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-099 - A automacao pode mover o card sozinha e serve para tudo quem|D-99]]"]
area: [painel-chat-automacoes, auditoria-logs]
tags: [decisao, area/painel-chat-automacoes, area/auditoria-logs]
---
# D-107 · Excluir automação: some de vez; o que ela fez FICA na Auditoria, marcado "automação excluída" (02/10/2026) — ↪️ D-99

**Pedido do dono (02/10, noite):** *"deixe um botão para excluir automação"*; perguntado sobre o histórico de execuções: *"fica na auditoria com uma tagzinha de automação excluída"*.

- Botão **Excluir** (lixeira) na barra do editor, com o "tem certeza?" na própria barra (*"Excluir de vez? Ela some; o que ela fez fica na Auditoria."*). Só o super admin (garantido no banco).
- A automação **sai de vez** (some da lista, inclusive das arquivadas). Se estava ligada, para no mesmo gesto; quem estava **esperando** para continuar **para** ali.
- **O histórico fica:** as execuções continuam guardadas (com o nome da automação), e na **Auditoria** toda linha dela — criou, ligou, rodou, os gestos que ela fez nos cards e a própria exclusão — ganha a etiqueta vermelha **"Automação excluída"**. A trilha não é reescrita (é imutável): a marca é calculada na leitura.
- Exemplo de fábrica que o dono excluir **não volta** numa reaplicação do banco.

**Descartadas:** só excluir automação que nunca rodou (como as etiquetas — o dono quis excluir as de teste, que rodaram); apagar o histórico junto (o dono quer o rastro na Auditoria).
