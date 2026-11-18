---
id: D-212
aliases: [D-212]
titulo: "Itens que o Tiny muda depois da liberação"
tipo: decisao
data: 2026-11-04
status: provisoria
revisa: []
revisada_por: []
complementa: []
area: [pcp, tiny-n8n]
tags: [decisao, area/pcp, area/tiny-n8n, provisoria]
---
# D-212 · ⏳ PROVISÓRIA — Itens que o Tiny muda depois da liberação (04/11/2026)

Respostas do dono de 03/11 (fechadas) + o que a SESSAO-44 escolheu onde a demanda não dizia:
1. **Como a plataforma percebe:** um gatilho ADIADO em `pedidos` (roda no fim da gravação do Tiny, com os itens já regravados) compara os itens de produção de antes e de agora **por produto e quantidade** — preço, observação, ordem da lista e frete não contam. Escolhido o gatilho (o preferido da demanda), não um trecho na porta de gravação do n8n.
2. **Entrou item:** fato novo na trilha (o que entrou e o que saiu), a conta da liberação é refeita (o pedido volta ao quadro do PCP só com as vagas novas; o que está em andamento não muda) e o PCP recebe aviso no sino (público novo "PCP": quem é do setor de entrada e os administradores).
3. **Em rota:** volta ao PCP, segue na rota, a logística recebe "Segure a entrega". O PCP pode liberar a vaga nova mesmo com o pedido lançado (antes a liberação recusava pedido lançado para ROTAS — agora recusa só quando não falta nada).
4. **Já entregue (inteira):** a entrega reabre **só na plataforma** (o Tiny não muda) e fica a pendência só dos itens novos — o que ficou com o cliente segue entregue. ⚠️ Se o Tiny continuar "Entregue", o quadro do PCP não mostra o pedido (a regra "Entregue no Tiny sai do PCP" vale); o PCP abre pelo aviso. Fica como dívida.
5. **Entrega parcial, devolvido e cancelado:** nada reabre sozinho; fato na trilha e aviso (PCP e logística).
6. **Item que saiu ou diminuiu com peça já criada:** nunca arquiva; o PCP recebe "item saiu com peça feita" e decide.
7. **Card arquivado sem entrega** (limpeza, arquivado à mão): o Tiny reler os itens não faz nada.
8. **Reserva do estoque:** o pedido que ganhou itens é avaliado de novo (só as vagas ainda sem peça e sem reserva) — antes, só na chegada.
