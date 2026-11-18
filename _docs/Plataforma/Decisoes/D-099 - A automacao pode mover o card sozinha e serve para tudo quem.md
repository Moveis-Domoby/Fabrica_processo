---
id: D-99
aliases: [D-99, D-099]
titulo: "A automação pode mover o card sozinha — e serve \"para tudo\"; quem monta e liga é só o super admin"
tipo: decisao
data: 2026-10-01
status: vigente
revisa: ["[[D-003 - Destino do card manual hoje automacao via API amanha|D-3]]"]
revisada_por: []
complementa: ["[[D-092 - Automacoes so admin cria por ora o modulo e o laboratorio|D-92]]"]
area: [painel-chat-automacoes, kanban-producao]
tags: [decisao, area/painel-chat-automacoes, area/kanban-producao]
---
# D-99 · A automação pode mover o card sozinha — e serve "para tudo"; quem monta e liga é só o super admin (01/10/2026) — ↩️ revisa a D-03, ↪️ D-92

**Decidido (resposta 1 do dono no início da [[SESSAO-27 - Automacoes em Canvas]]):** *"A automação em canvas deve ser para tudo, comercial, api, pedidos, e só eu vou construir essas coisas, então eu vou saber quando ligar"*.

- ↩️ **[[D-003 - Destino do card manual hoje automacao via API amanha|D-03]]:** mover o card automaticamente por gatilho **passa a existir** — com o freio de que a automação é montada por humano (o super admin — [[D-100 - O Painel admin vira Configuracoes nasce o Painel super admin|D-100]]) e **nasce desligada** (garantido no banco, para todo escritor — [[Memoria - Modelos Formulas e Possibilidades#M-14|M-14]]).
- **"Para tudo":** o canvas não se limita à produção — tem gatilhos de card, de pedido do Tiny e de chamada de fora (n8n/API), e ações de card, de pedido, de aviso e de saída para fora (catálogo na [[D-103 - As regras do motor na hora no banco nunca derruba o gesto|D-103]]). O comercial entra pelos gatilhos de pedido + "chamar endereço de fora" (ex.: pedido entregue → n8n → DataCrazy); um bloco próprio de campanha só quando o dono pedir.
- **Sem as travas extras que o Claude propôs** (só setores de produção, só peças): a automação vale para qualquer setor e card, mas **obedece às mesmas regras de uma pessoa** (D-103).
