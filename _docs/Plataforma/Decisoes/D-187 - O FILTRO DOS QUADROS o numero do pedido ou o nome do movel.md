---
id: D-187
aliases: [D-187]
titulo: "O FILTRO DOS QUADROS: o número do pedido ou o nome do móvel, em todo quadro de setor, no tablet e no PCP"
tipo: decisao
data: 2026-10-23
status: vigente
revisa: []
revisada_por: []
complementa: []
area: [kanban-producao]
tags: [decisao, area/kanban-producao]
---
# D-187 · O FILTRO DOS QUADROS: o número do pedido ou o nome do móvel, em todo quadro de setor, no tablet e no PCP (23/10/2026, pedido do dono com o vídeo do Trello — SESSAO-40)

**Pedido do dono (vídeo do quadro LOGÍSTICA do Trello, filtro por "13722"):** *"Isso facilitaria muito aqui dentro da limpeza e embalagem. Em todos os setores você pode colocar isso, esse filtro."*

- **Onde:** no topo de **todo quadro de setor de produção** (SECC, CNC, FITAMENTO, FURAÇÃO, MONTAGEM, LIMPEZA E EMBALAGEM), no **modo tablet** e no **PCP** (abas Reabastecimento, Aguardando liberação e Stand-by), à esquerda do botão da ordem da fila. Os fins de linha já tinham busca (Estoque, Expedição, Rotas).
- **O que bate (⏳ PROVISÓRIA — escolha do Claude):** só números (ou "pedido 13722", "#13722") = o **pedido cujo número começa** com eles; letras = o **nome que contém** o texto (o móvel; o card avulso; no PCP, o cliente do pedido ou o móvel da reposição), sem acento, sem maiúscula e sem espaço. Menos de 2 caracteres não filtra. Espera 300 ms parado (Lei §3).
- **No SERVIDOR:** cada coluna vem só com os cards que batem e diz **quantos batem** ("3 cards batem com o filtro" — o "N cartões correspondem aos filtros" do Trello); "Ver mais" com o mesmo filtro; o ao vivo continua. O filtro vive no endereço (`?filtro=`) — o Voltar e o link funcionam, e a busca geral abre o quadro já filtrado. O "x" ou o Esc limpa.

**Descartadas:** filtrar só os 10 cards já carregados na tela (esconderia os da página seguinte — Lei §3 / regra 17); filtro por pessoa, etiqueta e data (o vídeo usa só a palavra-chave).
