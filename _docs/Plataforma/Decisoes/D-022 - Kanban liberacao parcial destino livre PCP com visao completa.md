---
id: D-22
aliases: [D-22, D-022]
titulo: "Kanban: liberação parcial, destino livre, PCP com visão completa"
tipo: decisao
data: 2026-08-27
status: revisada
revisa: []
revisada_por: ["[[D-054 - O fluxo do estoque so peca pronta perfeita e sem pedido|D-54]]", "[[D-125 - O card avulso quem cria como termina vinculo etiquetas quem|D-125]]"]
complementa: []
area: [kanban-producao]
tags: [decisao, area/kanban-producao]
---
# D-22 · Kanban: liberação parcial, destino livre, PCP com visão completa (27/08/2026)

**↩️ revisada em 2026-10-14 ([[D-125 - O card avulso quem cria como termina vinculo etiquetas quem|D-125]]):** existe card de produção digitado à mão — o card avulso.


**Decidido (respostas do dono no início da SESSAO-04):**

- **Liberação parcial OU completa:** o PCP pode liberar todas as unidades do pedido de uma vez ou só parte agora e o resto depois. Cada unidade liberada vai para o setor que o PCP escolher (unidades do mesmo pedido podem seguir caminhos diferentes — [[D-001 - Unidade do card hibrido|D-01]]).
- **Card de pedido some do quadro PCP quando todas as unidades foram liberadas**; o pedido passa a ser acompanhado na visão de expedição/reagrupamento.
- **Destino livre:** qualquer pessoa pode mover o card que está no setor dela para **qualquer** setor — a confirmação de entrada com o índice de qualidade ([[D-009 - Qualidade em 3 estados em TODA transicao com dupla atestacao|D-09]]) é gesto do setor recebedor e entra na SESSAO-06, não agora.
- **Perfil do PCP:** trabalham no computador na maior parte do tempo, são também a logística e possivelmente serão admins no futuro (talvez sem todas as permissões — decisão para depois). A tela deles pode ser **mais completa**, inclusive no tablet.
- **Origem do card:** todo card de pedido nasce de um **pedido real da integração** (Tiny → n8n → banco). Não existe pedido avulso digitado à mão (produção para estoque continua sendo a Q-23, em aberto).
- **Cadastro de etapas:** admin em qualquer setor E **líder no próprio setor** — como o RLS da SESSAO-02 já previa.
- **Q-21 (sub-cards de trabalho paralelo): fica para depois**, fora do escopo do kanban núcleo.
