---
id: D-218
aliases: [D-218]
titulo: "A busca de endereço confere o BAIRRO e o CEP; o que ela não acha (ou acha duvidoso) a logística marca no mapa"
tipo: decisao
data: 2026-11-04
status: provisoria
revisa: []
revisada_por: []
complementa: ["[[D-112 - Busca de enderecos recusa do servico nao e nao existe|D-112]]"]
area: [logistica-rotas]
tags: [decisao, area/logistica-rotas, provisoria]
---
# D-218 · ⏳ PROVISÓRIA — A busca de endereço confere o BAIRRO e o CEP; o que ela não acha (ou acha duvidoso) a logística marca no mapa (04/11/2026, SESSAO-45) — ↪️ D-112, Q-65

1. A busca (servidor) junta vários candidatos e escolhe pelo **nome da rua** (abreviação e título — Vereador × Governador — não separam), **bairro/localidade**, **CEP** (o exato vale muito; o geral da cidade, "-000", não prova nada) e **cidade**. Sem prova do lugar, não serve; a mesma rua em lugares distantes e nada que desempate = **"não achei"** — nunca um ponto errado com cara de certo (o centro do bairro/cidade segue proibido — Q-65). ↪️ **A parte do "não achei" foi substituída pela [[D-221 - A rota vai SEMPRE pelo endereco do cliente o ponto e so|D-221]] (dono, 05/11):** a busca desce em degraus (CEP, bairro, cidade) e o ponto aproximado aparece como aproximado — "não encontrado" não existe mais.
2. **"Marcar no mapa"** (não encontrado) e **"Acertar o ponto no mapa"** (achado) no cartão do pedido da Programação: a janela do pino (a mesma da parada avulsa). O ponto marcado à mão vale para **todo pedido com o mesmo endereço**, **nunca** é trocado pela busca automática e tem "Voltar à busca automática". Gesto da logística/admin, com registro de atividade.
3. Os pontos que a busca antiga gravou são procurados de novo **uma vez** (a partir de 05/11 00:00 UTC), conforme as telas da Programação são abertas — sem ninguém editar nada à mão. Os 6 que tinham ponto errado passam a "não encontrado" e pedem o pino.
