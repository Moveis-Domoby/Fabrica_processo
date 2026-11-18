---
id: D-39
aliases: [D-39, D-039]
titulo: "ROTAS: programação de caminhão com mapa e sugestão; caminhões cadastráveis"
tipo: decisao
data: 2026-08-28
status: revisada
revisa: []
revisada_por: ["[[D-108 - A rota da Programacao e calculada PELAS RUAS parte da fabrica|D-108]]", "[[D-156 - A rota aceita QUALQUER pedido vivo o Lancar para ROTAS deixa|D-156]]"]
complementa: []
area: [logistica-rotas]
tags: [decisao, area/logistica-rotas]
---
# D-39 · ROTAS: programação de caminhão com mapa e sugestão; caminhões cadastráveis (28/08/2026)

**↩️ revisada em 2026-10-02 ([[D-108 - A rota da Programacao e calculada PELAS RUAS parte da fabrica|D-108]]/D-109/D-110):** a linha deixou de ser reta — é a rota pelas ruas (serviço gratuito de rotas), da fábrica à fábrica, com distância e tempo; a ordem sugerida pode ser ajustada à mão e salva; o mapa mostra também a rota programada de cada caminhão. Continua grátis, sem chave e só sugestão.

- ROTAS lista **apenas pedidos prontos** lançados pelos Pedidos em aguardo.
- **Programar caminhão:** escolhe o dia → pedidos sem programação → a seleção abre **mapa lateral** (Leaflet + OpenStreetMap, grátis e sem chave; geocodificação aberta com cache no banco) mostrando a rota selecionada e **sugerindo** pedidos que fazem sentido nela (proximidade). **É só sugestão — a decisão é humana** (princípio de sempre). Confirma com **data + caminhão**.
- **Caminhões:** cadastro em Administração — visualizar, editar, excluir, com foto.
