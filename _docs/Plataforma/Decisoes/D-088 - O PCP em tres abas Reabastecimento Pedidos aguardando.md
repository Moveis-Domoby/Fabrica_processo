---
id: D-88
aliases: [D-88, D-088]
titulo: "O PCP em três abas: Reabastecimento · Pedidos aguardando liberação · Todos os pedidos; Cancelados vira tela da Logística"
tipo: decisao
data: 2026-09-30
status: vigente
revisa: ["[[D-061 - Cancelamento em tres estagios a aba Cancelados guarda|D-61]]"]
revisada_por: []
complementa: ["[[D-086 - Reservados o cartao mostra TUDO que esta em producao|D-86]]", "[[D-062 - A sugestao do estoque na liberacao o que e peca igual e quem|D-62]]"]
area: [pcp]
tags: [decisao, area/pcp]
---
# D-88 · O PCP em três abas: Reabastecimento · Pedidos aguardando liberação · Todos os pedidos; Cancelados vira tela da Logística (30/09/2026) — ↪️ D-86/D-62, ↩️ revisa a aba Cancelados da D-61

**Pedido do dono (30/09, no teste ao vivo):** *"Dentro de PCP, coloque uma nova aí para solicitação de estoque, pedidos aguardando liberação, todos os pedidos. Cancelados deve sair de PCP e virar rota filha de logística"* — gatilho: ele lançou reabastecimentos à mão e **não os viu** (o quadro ordena do mais antigo e pagina de 10 em 10: caíram na última página). Depois, pelo print: *"ao invés de solicitação de estoque, mude para reabastecimento"*.

- **Reabastecimento** (1ª aba): só os cards de reposição, na hora — sem se perder atrás dos pedidos.
- **Pedidos aguardando liberação**: o quadro de sempre, agora só com pedidos; cada card ganha o **selo verde "N peças no estoque — dá para usar"** quando o galpão atende o pedido (reservadas p/ ele + livres de mesmo SKU — a régua da [[D-062 - A sugestao do estoque na liberacao o que e peca igual e quem|D-62]]; migration 48).
- **Todos os pedidos**: a lista completa da integração (5.400+), com busca, pela porta de resumo que já existia; **pedido ENTREGUE mostra tudo liberado** (conclusão visual — o número real segue nas outras telas) e cada linha tem a **bolinha de cor da situação do Tiny** + o texto ([[Memoria - Modelos Formulas e Possibilidades#M-12|M-12]]). O **olhinho** abre o detalhe de PRODUÇÃO (itens em unidades, onde está cada unidade, situação, prevista) — **busca só ao abrir e esquece ao fechar** (nada no cache).
- **Cancelados** saiu do PCP e virou **Fábrica → Logística → Cancelados** (mesma porta e tela; link antigo redireciona).
- A seção **"Unidades no PCP" morreu** (*"não sei nem pra que serve isso, remova"*) e a **paginação virou rolagem** nas três listas.
- **O "i" no lugar do texto vira o PADRÃO**: todo texto informativo de tela encostada daqui em diante vira o balão (↪️ [[D-074 - Estoque enxuto i no lugar do texto abas em quadrados no canto|D-74]] vale para a casa toda).

**Como ficou (técnico):** migration 47 (`p_grupo` na porta do quadro — nulo = tudo, o painel [[D-075 - O quadrinho do PCP na Visao do dia conta o que o quadro|D-75]] continua batendo; drop das assinaturas antigas, [[Memoria - Banco e SQL 2#A-12|A-12]]) + migration 48 (`pecas_estoque` na mesma porta, conta por página — regra 17). O quadro parado com pedido já entregue no Tiny é o aviso que o Tiny NÃO mandou (P17) — conferido no banco: não há status mais novo guardado; a correção de raiz é a [[SESSAO-29 - Reconciliacao Tiny - Pente-fino e Ultimo Pacote Vence]] (recomendada como próxima), e qualquer salvamento do pedido no Tiny reenvia o aviso e o tira do quadro na hora.
