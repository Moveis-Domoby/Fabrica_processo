---
id: D-193
aliases: [D-193]
titulo: "O ENDEREÇO DE ENTREGA DO PEDIDO vale na logística, inteiro; sem ele, o do cadastro"
tipo: decisao
data: 2026-10-27
status: vigente
revisa: []
revisada_por: []
complementa: []
area: [logistica-rotas]
tags: [decisao, area/logistica-rotas]
---
# D-193 · O ENDEREÇO DE ENTREGA DO PEDIDO vale na logística, inteiro; sem ele, o do cadastro (27/10/2026, pedido do dono com vídeo — SESSAO-41)

**Pedido do dono (vídeo do pedido 13660):** *"o que importa para a logística é o endereço de entrega e não o endereço de cadastro… quando não tiver endereço diferente do endereço do cadastro você usa esse endereço como o endereço de entrega; caso tenha endereço de entrega você usa esse endereço aqui"*.

- O Tiny já mandava o endereço de entrega (`pedidos.endereco_entrega`, 191 pedidos — todos com cidade e estado); nenhuma tela o usava. Agora a Programação (o ponto do mapa), Já programadas, as entregas do dia, a lista da ROTAS, o calendário, a decisão da devolução e a ficha do pedido usam **o endereço de entrega INTEIRO** quando ele existe (nunca misturado com o número/bairro do cadastro); sem ele, o do cadastro. A ficha mostra os dois.
- O ponto no mapa do endereço novo é procurado sozinho também em "Já programadas" (o pedido já programado que passou a usar o endereço de entrega).
