---
id: D-124
aliases: [D-124]
titulo: "O marcador \"Devolvido\" do Tiny NÃO é cancelamento — a fábrica ainda tenta recuperar a venda"
tipo: decisao
data: 2026-10-13
status: revisada
revisa: ["[[D-114 - Cancelado ou devolvido com o movel pronto vai SOZINHO para|D-114]]"]
revisada_por: ["[[D-129 - Devolucao o entregador nao marca mais Pedido devolvido|D-129]]"]
complementa: []
area: [expedicao, tiny-n8n]
tags: [decisao, area/expedicao, area/tiny-n8n]
---
# D-124 · O marcador "Devolvido" do Tiny NÃO é cancelamento — a fábrica ainda tenta recuperar a venda (13/10/2026, pedido do dono) — ↩️ revisa a D-114

**Decidido (resposta do dono, 13/10):** *"Sobre essa marcação devolvido, anote para a próxima sessão remover, deixar apenas os outros do jeito que está, pois o devolvido a fábrica ainda tenta recuperar a venda."*

- **Sai** a regra da [[D-114 - Cancelado ou devolvido com o movel pronto vai SOZINHO para|D-114]] de que o marcador **"Devolvido"** no Tiny vale como cancelamento (a peça viva desse pedido ia sozinha ao ESTOQUE sem dono e o pedido passava a contar como cancelado). Pedido com o marcador "Devolvido" volta a ser um pedido como outro qualquer: as peças seguem com ele. **A remoção é da [[SESSAO-31 - Kanban Completo - Card Avulso Janela do Card Anexos e Conversa]]** (§4c da demanda).
- **Fica como está** (o resto da D-114): cancelado no Tiny com móvel pronto — inclusive na ROTAS e no caminhão — vai sozinho ao ESTOQUE.
- **A conferir com o dono no início da SESSAO-31:** o botão **"Pedido devolvido"** do entregador ([[D-115 - O entregador usuario so de ROTAS a tela das entregas do dia|D-115]]) também deixa de mandar os móveis ao ESTOQUE sem dono (para a fábrica tentar recuperar a venda), ou continua como está?
- **Confirmadas pelo dono na mesma resposta ("deixar apenas os outros do jeito que está"):** a ↩️ da [[D-063 - Frete nao vira peca de producao o resto nasce no PCP e o PCP|D-63]] (o PCP libera só para setor de produção; a peça pronta do estoque vai pela sugestão "usar?") e a [[D-119 - Os numeros do estoque ficam PRONTOS no banco o ranking|D-119]] (o ranking das vendas anda de madrugada).
