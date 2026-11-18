---
id: D-115
aliases: [D-115]
titulo: "O entregador: usuário só de ROTAS, a tela das entregas do dia, a equipe de cada caminhão e o card com volumes"
tipo: decisao
data: 2026-10-08
status: revisada
revisa: []
revisada_por: ["[[D-128 - Varias rotas por dia no mesmo caminhao cada rota com o seu|D-128]]", "[[D-129 - Devolucao o entregador nao marca mais Pedido devolvido|D-129]]"]
complementa: ["[[D-039 - ROTAS programacao de caminhao com mapa e sugestao caminhoes|D-39]]", "[[D-109 - A ordem das paradas a sugestao e a do mais perto mas qualquer|D-109]]", "[[D-111 - A Programacao em duas abas Programar e Ja programadas itens|D-111]]"]
area: [logistica-rotas]
tags: [decisao, area/logistica-rotas]
---
# D-115 · O entregador: usuário só de ROTAS, a tela das entregas do dia, a equipe de cada caminhão e o card com volumes (08/10/2026) — ↪️ D-39/D-109/D-111

**↩️ revisada em 2026-10-14 ([[D-128 - Varias rotas por dia no mesmo caminhao cada rota com o seu|D-128]]/D-129):** o botão "Pedido devolvido" sai da tela do entregador; a equipe passa a ser de cada rota do dia.


**Decidido (respostas 3 e 4 do dono, 08/10):**

- **Login próprio** (o sistema de login muda no futuro). Na criação de usuário existe o tipo **ROTAS (entregador)**: ele vê **só a tela das entregas do dia** — nada mais da plataforma.
- **Quem programa a rota escolhe quem a recebe** — **um ou mais usuários** por caminhão naquele dia (decidido pelo Claude: quem pode programar, ou seja, logística e admin; o dono disse *"algum admin irá liberar o caminhão para ele"*).
- **A tela:** mini mapa da rota do dia; os pedidos na ordem de entrega (a ordem salva da rota — do mais perto ao mais longe); o card de ROTAS → Entregas que já existe (*"já sana bem todos os dados"*), ajustado para celular e tablet, com: cliente, nº do pedido, **quantidade de VOLUMES** (≠ produtos — o cadastro do Tiny diz quantos volumes cada produto tem; vazio conta 1), endereço, observações do pedido e o **detalhe da entrega** (escrito ao programar ou em "Já programadas" — ex.: "cliente só pode receber depois das 10h"), a lista de produtos; botões **Comentário · Entregue · Não entregue · Pedido devolvido · Anexar comprovante · WhatsApp · Mapa**.
- **Entregue** abre um painel em cima com o **comprovante de pagamento** (PDF, Word, imagem e outros formatos de comprovante) e uma **observação** — os dois **opcionais** (resposta 4: não é obrigatório). Anexar comprovante também existe **fora da entrega** (um botão no card, a qualquer hora — entendimento do Claude, dito ao dono).
