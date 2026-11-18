---
id: D-174
aliases: [D-174]
titulo: "A rota no GOOGLE MAPS e no WAZE: o link oficial, sem custo, na ordem da plataforma; o entregador vê a mesma ordem da logística"
tipo: decisao
data: 2026-10-21
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-108 - A rota da Programacao e calculada PELAS RUAS parte da fabrica|D-108]]", "[[D-109 - A ordem das paradas a sugestao e a do mais perto mas qualquer|D-109]]", "[[D-115 - O entregador usuario so de ROTAS a tela das entregas do dia|D-115]]"]
area: [logistica-rotas]
tags: [decisao, area/logistica-rotas]
---
# D-174 · A rota no GOOGLE MAPS e no WAZE: o link oficial, sem custo, na ordem da plataforma; o entregador vê a mesma ordem da logística (21/10/2026, pedido do dono — SESSAO-39) — ↪️ D-108/D-109/D-115

**Pedido do dono:** *"Em rotas, precisamos também levar a rota já montada para o google maps ou para o waze, analise se é possível encontrar uma api gratuita ou se é possível apenas colocar um botão com link de redirecionamento com rota montada exatamente como foi feito na plataforma."*

- **O que existe (pesquisado na documentação oficial, 21/10):** o Google Maps tem um **link oficial** ("Maps URLs") que abre a rota com origem, destino e paradas **na ordem dada**, **sem chave e sem custo**; limite de **9 paradas intermediárias por link** (3 no navegador do celular, sem o aplicativo). As APIs de rota do Google são pagas e não são necessárias para isto. O **Waze aceita UM destino por link** (várias paradas dá erro, segundo a própria documentação).
- **Decidido (levado ao dono na conversa, sem objeção):**
  1. **"Abrir a rota no Google Maps"** na rota escolhida de "Já programadas" (sai da fábrica, as paradas na ordem DA TELA — com o rascunho, se houver — e volta à fábrica) e na tela do entregador (**de onde o aparelho está**, as entregas que faltam, na ordem, e a volta à fábrica).
  2. **Rota com mais de 9 paradas sai em partes equilibradas** ("Paradas 1 a 6", "Paradas 7 a 10 e a volta"), cada parte começando onde a anterior terminou — nunca uma parte só com a volta.
  3. **Em cada entrega, "Google Maps" e "Waze"** já navegando até ela (no lugar do antigo "Mapa", que só mostrava o ponto).
  4. A parada vai pela **coordenada** que a plataforma usou; a sem ponto no mapa, pelo **endereço escrito**.
  5. **A mesma ordem para todos:** antes, sem ordem salva, o entregador via as paradas pela numeração do pedido — e o Google abriria noutra ordem. Agora as entregas do dia trazem a ordem salva e a tela numera como "Já programadas" (a salva ou, sem ela, a sugestão do mais perto a partir da fábrica).
- **Conferido em 21/10:** o link aberto no Google Maps montou "Fábrica Domoby → 4 paradas na ordem → Fábrica Domoby" (57 min de carro). **A conferir no celular do entregador:** o limite de 9 paradas vale no aplicativo; sem o aplicativo, o navegador do celular aceita 3.

**Descartadas:** a API paga de rotas do Google (desnecessária para abrir a rota); o Waze com a rota inteira (não existe); otimizar a ordem pelo Google (a ordem é a da plataforma — a decisão é humana, [[D-039 - ROTAS programacao de caminhao com mapa e sugestao caminhoes|D-39]]/D-109).
