---
id: D-221
aliases: [D-221]
titulo: "A rota vai SEMPRE pelo endereço do cliente; o ponto é só do mapa da rota (e se acerta à mão); \"endereço não encontrado\" deixa de existir"
tipo: decisao
data: 2026-11-05
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-217 - O Google Maps e o Waze vao pelo ENDERECO do pedido o ponto|D-217]]", "[[D-218 - A busca de endereco confere o BAIRRO e o CEP o que ela nao|D-218]]"]
area: [logistica-rotas]
tags: [decisao, area/logistica-rotas]
---
# D-221 · ✅ DECIDIDA pelo dono — A rota vai SEMPRE pelo endereço do cliente; o ponto é só do mapa da rota (e se acerta à mão); "endereço não encontrado" deixa de existir (05/11/2026, ajuste da SESSAO-45) — ↪️ D-217, D-218

**Pedido do dono (05/11):** *"a rota precisa do endereço exato do cliente, não do ponto marcado; o ponto pode servir para ajuste caso necessário, mas não pode acontecer o caso de endereço não encontrado"*.
1. **Google Maps e Waze** (a rota inteira, uma parada, a tela do entregador, a parada avulsa): **sempre o endereço escrito** — rua, número, bairro, cidade, UF e CEP (na parada avulsa, o endereço digitado). Nem o ponto marcado à mão nem o pino da avulsa mandam no link (substitui a [[D-217 - O Google Maps e o Waze vao pelo ENDERECO do pedido o ponto|D-217]], item 2). O ponto só vai quando não há rua escrita nenhuma.
2. **O ponto da plataforma** serve ao **mapa da rota** (onde a parada aparece, a ordem sugerida, a distância) — é ele que a logística acerta à mão ("Acertar o ponto no mapa"; o marcado à mão segue valendo para todo pedido do mesmo endereço e nunca é trocado pela busca).
3. **A busca nunca termina em "não encontrado"** (substitui a [[D-218 - A busca de endereco confere o BAIRRO e o CEP o que ela nao|D-218]], a parte do "não achei"): quando a rua não se acha (ou fica ambígua), ela desce em **degraus** — **o ponto do CEP** (serviço de CEP gratuito, sem chave; só vale na cidade e UF do pedido e com a rua ou o bairro do CEP batendo), **o centro do bairro**, **o centro da cidade** (os dois pelo mapa aberto). Antes de virar ponto aproximado, o ponto do CEP/bairro serve de **âncora**: a rua com o nome do pedido perto dele (1,5 km do CEP, 2 km do bairro) é a certa e vira ponto de rua. O degrau fica gravado na coluna que já existia (a fonte do ponto: `aprox_cep`/`aprox_bairro`/`aprox_cidade`) — nenhuma tabela, nenhuma coluna.
4. O cartão do pedido diz **"Ponto aproximado no mapa (pelo CEP / pelo bairro / pelo centro da cidade) · acertar"**. Só se nem a cidade for reconhecida fica "Ainda sem ponto no mapa da rota — o Google Maps vai pelo endereço", com "Marcar no mapa".
5. O "não encontrado" gravado antes é procurado de novo **uma vez** (o que foi consultado antes de 05/11 03:00 UTC), conforme a Programação é aberta.

↪️ **Correção do dono (05/11, manhã):** *"não tem essa de bairro e centro da cidade, NO MÁXIMO a rua é aceitável, mas deve ter um aviso na tela para que eles mesmos possam ajustar manualmente quando for esses casos — 'Endereço aproximado para a cidade da entrega, ajustar o pino do mapa'"*. Os itens 3 e 4 passam a ser:
- **3′.** O ponto é **de rua** ou é o **da cidade com aviso** — **nunca o centro do bairro** nem o ponto solto do CEP. O ponto do CEP e o centro do bairro servem **só de âncora** para achar a rua de mesmo nome perto deles (vira ponto de rua); o ponto do CEP da **própria rua** do pedido vale como ponto de rua (fonte `cep`). Sem rua: o centro da cidade (fonte `aprox_cidade`).
- **4′.** No ponto da cidade, o cartão mostra o aviso **"Endereço aproximado para a cidade da entrega, ajustar o pino do mapa"** (em destaque) com o botão **"Ajustar o pino"** (a janela do mapa); quem não é da logística vê o aviso sem o botão. O ponto marcado à mão some com o aviso. O ponto da cidade é procurado de novo depois de 7 dias; o que a 1ª versão gravou pelo bairro/CEP (`aprox_bairro`/`aprox_cep`) é refeito na hora.
