---
id: D-111
aliases: [D-111]
titulo: "A Programação em duas abas — \"Programar\" e \"Já programadas\"; itens sempre à vista; ordenar a lista; marcou, sobe e se arrasta; cada caminhão com a sua cor; o trecho aceso"
tipo: decisao
data: 2026-10-03
status: revisada
revisa: ["[[D-109 - A ordem das paradas a sugestao e a do mais perto mas qualquer|D-109]]", "[[D-110 - O mapa da Programacao mostra tambem a rota JA PROGRAMADA|D-110]]"]
revisada_por: ["[[D-128 - Varias rotas por dia no mesmo caminhao cada rota com o seu|D-128]]", "[[D-159 - O mapa da rota So a ida e So a volta o Programar sem espaco|D-159]]"]
complementa: []
area: [logistica-rotas]
tags: [decisao, area/logistica-rotas]
---
# D-111 · A Programação em duas abas — "Programar" e "Já programadas"; itens sempre à vista; ordenar a lista; marcou, sobe e se arrasta; cada caminhão com a sua cor; o trecho aceso (03/10/2026) — ↩️ revisa a D-109 (botões) e a D-110 (lugar)

**↩️ revisada em 2026-10-14 ([[D-128 - Varias rotas por dia no mesmo caminhao cada rota com o seu|D-128]]):** o caminhão pode fazer várias rotas no mesmo dia, cada uma com ordem e equipe próprias.


**Pedidos do dono depois de testar a rota com a carga de teste (03/10), com as respostas às dúvidas:**
- *"coloque uma opção de ver todas as programações já realizadas"* + *"quando altero o dia lá em cima … troque isso para uma aba filha de programação que mora dentro da tela mesmo chamada 'Já programadas'"* → a tela ganha duas abas filhas (na URL): **Programar** e **Já programadas**. O "dia lá em cima" saiu — o dia se escolhe ao programar. Em "Já programadas": **só as não entregues** (por dia e por caminhão, o dia mais perto primeiro), com o botão **"Ver entregues"** (resposta: *"Apenas as não entregues, mas coloque o botão de ver entregues"*); paginada no servidor ("Ver mais").
- *"se eu selecionar diferentes caminhões, eles ficam sem prioridade visual além da imagem e ficam separados"* → **cada caminhão tem a sua cor** (faixa do grupo, contorno das paradas, linha no mapa) e as entregas dele ficam **juntas, na ordem da rota**. Escolher um caminhão acende a rota dele; **os outros caminhões do mesmo dia ficam transparentes** no mapa.
- *"no momento em que estou programando … uma ordem de prioridade por dia de entrega … porém deixe uma setinha para … ordenar por mais próximos e assim por diante"* → a lista "Sem programação" vem pelo **dia de entrega mais perto** (sem previsão no fim); o "Ordenar por" troca para **"Mais perto"** — *"se algum pedido já foi selecionado, o mais perto sempre vai ser o mais perto do que está selecionado até o mais distante; se nada estiver selecionado, é o mais perto da fábrica"* — ou **número do pedido**.
- *"eu devo conseguir sempre ver quais itens vão em cada pedido"* → todo pedido mostra **os móveis com a quantidade** (o frete não aparece — [[D-063 - Frete nao vira peca de producao o resto nasce no PCP e o PCP|D-63]]), e a rota e cada caminhão mostram o **total de peças**.
- *"quando eu selecionar um pedido para entrar na rota, ele deve subir e ficar acima de todos como já selecionado, podendo arrastar ele pra cima ou pra baixo pra recalcular"* → marcar **sobe** o pedido para o bloco **"Na rota"**, numerado, onde a ordem se **arrasta** (alça de 44 px; mouse, dedo e teclado) e a rota recalcula. ↩️ Os botões de subir/descer da [[D-109 - A ordem das paradas a sugestao e a do mais perto mas qualquer|D-109]] saíram; "Salvar ordem"/"Voltar à sugestão" continuam (no caminhão, em "Já programadas").
- *"a linha da rota está sem prioridade visual … quando eu selecionar uma linha de rota, a outra fica mais transparente"* → resposta: **escolher um trecho**. A linha ganhou cor forte com contorno branco; tocar num trecho (no mapa ou no painel) **acende só ele**, o resto fica transparente, e o canto do mapa mostra **km e tempo daquele trecho**; tocar de novo volta à rota inteira.
- *"senti que a plataforma ficou um pouco pesada e lenta nessa aba"* → medido: o banco responde em ~20 ms; o peso era a rota recalculada a cada mudança (2–4 s, com a linha sumindo e a reta tracejada piscando), a tela inteira (mapa incluso) redesenhando a cada clique e o programar fazendo uma chamada por pedido. Agora: **a linha anterior fica na tela** (esmaecida) até a nova chegar, espera menor, o mapa só redesenha quando o que ele mostra muda, e **programar é uma chamada só** (o banco programa e salva a ordem juntos, tudo ou nada).

**Descartadas:** caminhos alternativos "como o Google" (o serviço gratuito só oferece alternativa para trecho de dois pontos, e cada trecho viraria uma consulta a mais); manter os botões de subir/descer junto com o arrasto; trazer as entregues sempre (só quando pedir).
