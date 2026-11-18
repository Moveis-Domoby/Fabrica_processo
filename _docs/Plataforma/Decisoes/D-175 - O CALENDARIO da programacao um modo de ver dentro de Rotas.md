---
id: D-175
aliases: [D-175]
titulo: "O CALENDÁRIO da programação: um modo de ver dentro de Rotas → Programação, no formato do calendário da lista ROTAS do ClickUp"
tipo: decisao
data: 2026-10-21
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-111 - A Programacao em duas abas Programar e Ja programadas itens|D-111]]", "[[D-128 - Varias rotas por dia no mesmo caminhao cada rota com o seu|D-128]]", "[[D-169 - O stand-by no PCP|D-169]]"]
area: [logistica-rotas]
tags: [decisao, area/logistica-rotas]
---
# D-175 · O CALENDÁRIO da programação: um modo de ver dentro de Rotas → Programação, no formato do calendário da lista ROTAS do ClickUp (21/10/2026, pedido do dono com vídeo — SESSAO-39) — ↪️ D-111/D-128/D-169

**Pedido do dono:** *"Para as rotas, coloque uma visualização de calendário para visualizar a programação, analise o vídeo para entender o formato e coloque como um modo de visualização dentro de rotas."* **O vídeo** (celular filmando o monitor, 21/10 15:42): o calendário da lista ROTAS do ClickUp, visão **Semana** (domingo → sábado), "Hoje", setas ‹ ›, o título com o intervalo; uma **barra por pedido** ("nº - bairro - data", às vezes com recado: "ENTRE 13:30 AS 17:00"); a **cor da barra é a situação** (conferido na lista do ClickUp, só leitura: cinza a fazer · azul 1ª/2ª/3ª rota · amarelo rota terceirizada · verde entregue · vermelho cancelado · rosa parado · roxo retirada).

- **Onde:** uma terceira aba de Rotas → Programação: **Programar · Já programadas · Calendário** (`?aba=calendario`; o modo `?ver=mes` e o dia de referência `?ref=` também no endereço).
- **Cada pedido no seu dia, pela regra que as outras telas já usam (⏳ PROVISÓRIA — a tradução do ClickUp para a plataforma, escolha do Claude):**
  - **Na rota** (azul — o "1ª/2ª/3ª rota" do ClickUp): o programado, no dia da programação, com o caminhão e a rota;
  - **Entregue** (verde): o programado e entregue, no dia da rota;
  - **Não entregue** (vermelho — no lugar do "cancelado"): o "não entregue" daquele dia de rota, com o motivo (o pedido volta para "Programar");
  - **Sem rota** (cinza — o "a fazer"): o pedido vivo sem programação, no dia da **previsão de entrega** do vendedor;
  - **Stand-by** (rosa — o "parado"): o pedido segurado pelo PCP, no dia da previsão.
  - Rota terceirizada e retirada **não existem na plataforma** — ficaram fora.
- **Na barra (↩️↩️ 22/10, 2ª volta — pedido do dono: *"Essa visualização está muito redonda e confusa, altere novamente o layout e deixe a possibilidade de ver mais detalhes do pedido caso eu clique no mesmo"*):** a grade é **reta**, como a do ClickUp — sete colunas iguais com linhas finas, o cabeçalho do dia numa linha só ("SEG 19 out", o hoje na cor de ação), **sem** grupos por rota, círculos nem pílulas. **Uma barra de uma linha por pedido: "13704 · Pitimbu"** (o bairro encurta se não couber; o texto inteiro no passar do mouse), no tom claro da situação com a **faixa forte à esquerda**, cantos quase retos. A legenda vira quadradinhos de cor com o nome e o total — **continua filtrando** (tocar esconde/mostra). **Tocar no pedido abre o DETALHE dele** (todas as situações): em cima, na hora, o que o calendário já sabe — situação, dia da rota (ou a previsão, para sem rota e stand-by), a previsão do vendedor, o caminhão (na cor dele), a rota e a parada, o recado da programação e o motivo (não entregue/stand-by); embaixo, **a ficha do pedido** da área Pedidos ([[D-134 - A area PEDIDOS Todos os pedidos sai do PCP e Cancelados sai|D-134]] — cliente com WhatsApp, venda, valor, entrega; e, atrás de botões, itens e pagamento, produção, entrega e comprovante, dados do Tiny e histórico), que pede tudo numa requisição só, no clique. Do detalhe: **"Ver a rota"** (o programado — abre a rota em "Já programadas") e **"Abrir a janela do pedido"**. *(A 1ª volta, de 22/10 de manhã — barra em duas linhas, grupos por rota com a bolinha do caminhão, número do dia em círculo, fim de semana estreito, legenda em pílulas —, foi achada "redonda e confusa" pelo dono e saiu.)*
- **A largura das colunas, como numa planilha (↩️ 22/10, 3º pedido do dono — *"deixe que seja possível estender a coluna no estilo do Sheets e Excel … clicar duas vezes na divisória e ela se ajustar ao tamanho exato do maior texto"*):** a **divisória no cabeçalho de cada dia** se arrasta para alargar/estreitar aquela coluna; **dois cliques** nela ajustam a coluna ao maior texto dela (o maior "nº · bairro" carregado e o cabeçalho); pelo teclado, setas ←/→ e Enter. As colunas começam iguais; depois de mexer, cada uma tem a sua largura (a grade rola para o lado se passar da tela) e **"Colunas iguais"** volta ao começo. Semana e mês têm larguras próprias, **guardadas no aparelho de quem mexeu** (⏳ escolha do Claude: é preferência de quem olha — não muda a tela dos outros). Só onde as colunas viram grade (computador/tablet deitado); no celular os dias seguem em lista.
- **Semana e mês (⏳ escolha do Claude):** a semana como o vídeo (até 30 barras por dia; o resto num "+N" que busca o dia no clique) e o **mês** (a grade de 6 semanas, 3 barras por dia; tocar no dia abre a semana dele) — o ClickUp do vídeo tinha o seletor de visão. No celular, os dias empilham.
- **Fora do calendário, mas avisado:** os pedidos sem rota com a previsão já vencida e os sem previsão — um aviso com "Ver em Programar".
- **Uma requisição por tela** (o período inteiro, até 6 semanas), ao vivo pelos avisos das rotas e do PCP (Lei §1/§4).

**Descartadas:** arrastar o pedido de um dia para outro no calendário (o vídeo não mostra; seria outra forma de reprogramar — fica para o dono pedir); mostrar só os programados (o ClickUp do vídeo mostra também o "a fazer"); a cor pela situação do ClickUp ao pé da letra (terceirizado/retirada/cancelado não existem aqui); o detalhe num desenho novo (a ficha do pedido já existe e é a mesma da área Pedidos — um lugar só para mudar); a rota/caminhão dentro da barra (foi o que deixou a 1ª volta confusa — fica no detalhe).
