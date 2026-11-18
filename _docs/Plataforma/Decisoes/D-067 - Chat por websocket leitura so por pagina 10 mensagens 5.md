---
id: D-67
aliases: [D-67, D-067]
titulo: "Chat por websocket; leitura só por página — 10 mensagens, 5 conversas"
tipo: decisao
data: 2026-09-27
status: revisada
revisa: []
revisada_por: ["[[D-131 - Mensagens podem ser editadas e apagadas no card e no chat|D-131]]"]
complementa: []
area: [painel-chat-automacoes]
tags: [decisao, area/painel-chat-automacoes]
---
# D-67 · Chat por websocket; leitura só por página — 10 mensagens, 5 conversas (27/09/2026) — ↩️ ajusta as notas técnicas da SESSAO-26

**Decidido (adendo do dono no início da SESSAO-26):** *"a comunicação deve ser por websockets, não deve ter consulta de leitura ao banco, apenas de post; a única leitura deve ser da paginação para consultar mensagens antigas, até 10 mensagens por paginação, até 5 conversas por paginação também, até rolar o scroll e requisitar mais."*

- **Websocket = Broadcast do banco em canal PRIVADO.** A autorização é conferida UMA vez, na entrada do canal (política em `realtime.messages`); o banco empurra cada mensagem. **↩️ Ajusta a nota da demanda** ("a publicação realtime ganha a tabela de mensagens"): no `postgres_changes` o Realtime relê o banco para cada assinante a cada mudança — o peso que o dono proibiu —, então a publicação **não** mudou.
- **Dois canais só:** o da pessoa (sinais do badge e da lista — 1 por login) e o da conversa ABERTA (a mensagem inteira — sai ao fechar).
- **Leitura:** a lista vem de 5 em 5 e as mensagens de 10 em 10 (o teto é do banco), a próxima página só ao rolar ou tocar em "Ver mais/Ver anteriores". A 1ª página da lista é a única leitura na abertura do app (é ela que acende o badge). **Nada de polling, nada de reler ao voltar à aba**; só a queda do websocket relê a 1ª página (pode ter perdido sinal).
- **O resto é POST:** enviar (devolve a mensagem — quem envia não relê), marcar como lida, abrir particular, criar/renomear canal, pôr/tirar pessoa, liberar quem escreve, data de nascimento.
