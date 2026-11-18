---
id: D-131
aliases: [D-131]
titulo: "Mensagens podem ser editadas e apagadas — no card e no chat; a história fica"
tipo: decisao
data: 2026-10-13
status: vigente
revisa: ["[[D-065 - Chat interno canais particulares e Avisos gerais quem cria|D-65]]", "[[D-067 - Chat por websocket leitura so por pagina 10 mensagens 5|D-67]]"]
revisada_por: []
complementa: []
area: [painel-chat-automacoes]
tags: [decisao, area/painel-chat-automacoes]
---
# D-131 · Mensagens podem ser editadas e apagadas — no card e no chat; a história fica (13–14/10/2026, resposta 10 do dono) — ↩️ revisa a D-65 e a D-67

**Decidido:** *"Pode, inclusive a do chat também deve poder, porém o apagar, o super admin e os admins ainda conseguem visualizar sabendo que foi apagada, a história não se apaga"* · *"o admin não vê as particulares, isso é invasão de privacidade, mas as que ele tem acesso, consegue ver normalmente"*.

- **Cada um edita e apaga só a própria mensagem** (decisão provisória do Claude — **✅ confirmada pelo dono em 15/10, [[D-136 - As 6 decisoes provisorias da SESSAO-31 confirmadas pelo dono|D-136]]**), na conversa do card e no chat.
- Mensagem editada mostra **"editada"** para todos; mensagem apagada vira **"Mensagem apagada"** para todos.
- **Admin e super admin** veem o **texto apagado** (com o aviso "apagada") e as **versões anteriores** de uma editada — **só nas conversas a que já têm acesso** (canais em que estão, Avisos gerais, as próprias particulares, e os cards que podem abrir). **A particular dos outros continua fechada** para todo mundo ([[D-065 - Chat interno canais particulares e Avisos gerais quem cria|D-65]]).
- Nada se apaga de verdade: editar e apagar são registros novos (RNF-05).
