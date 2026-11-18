---
id: D-126
aliases: [D-126]
titulo: "A marcação do estado da peça (perfeito/atenção/danificado) vira CONFIGURAÇÃO — por setor, por tipo de card, no envio e no recebimento; nasce tudo desligado"
tipo: decisao
data: 2026-10-13
status: vigente
revisa: ["[[D-009 - Qualidade em 3 estados em TODA transicao com dupla atestacao|D-9]]", "[[D-025 - Qualidade nas transicoes detalhes de execucao|D-25]]", "[[D-054 - O fluxo do estoque so peca pronta perfeita e sem pedido|D-54]]", "[[D-058 - O lugar da peca pronta com pedido Pedidos em aguardo|D-58]]"]
revisada_por: []
complementa: []
area: [kanban-producao]
tags: [decisao, area/kanban-producao]
---
# D-126 · A marcação do estado da peça (perfeito/atenção/danificado) vira CONFIGURAÇÃO — por setor, por tipo de card, no envio e no recebimento; nasce tudo desligado (13–14/10/2026, pedido do dono) — ↩️ revisa a D-09, a D-25, a D-54 e a D-58

**Pedido do dono:** *"remova essa marcação, deixe como uma opção de ligar e desligar e para quais tipos de card deve ser ligado ou desligado, para qual setor também"* · *"deve ter a opção de confirmar situação no envio e no recebimento, pode ser que eles queiram colocar para que um setor declare que a peça saiu em perfeito estado, mas que outro setor não precise confirmar o estado de chegada, então isso deve ser bem personalizado"*.

- Cada setor tem **duas chaves**, cada uma com os **tipos de card** em que vale (peça de pedido, peça de reposição/estoque, avulso): **"Pedir o estado ao enviar"** (quem tira a peça do setor marca) e **"Pedir o estado ao receber"** (o setor confirma o estado na chegada, antes de começar). As duas são independentes: um setor pode declarar a saída sem que o próximo precise confirmar a chegada, e vice-versa.
- **Tudo nasce desligado** (*"remover a solicitação de estado da peça"*): sem chave ligada, mover, encaminhar e concluir não perguntam nada.
- Quando as duas pontas marcam, a divergência continua indo para a dashboard e o aviso aos líderes/admins ([[D-009 - Qualidade em 3 estados em TODA transicao com dupla atestacao|D-09]]/D-25) continua saindo para 🟡, 🔴 e divergência. Danificado continua indo para DANIFICADO.
- **Os fins de linha** (ESTOQUE, Pedidos em aguardo) continuam recusando peça marcada 🟡 ou 🔴; **peça sem marcação entra normalmente** (antes, "só peça 🟢").
- Quem configura: **admin** (Configurações → Setores e etapas) — decisão provisória do Claude (a qualidade entre setores é exatamente o ponto em que um setor pode prejudicar o outro — D-09; por isso não ficou com o líder do próprio setor).
- ↩️ **D-09** (lei — "obrigatório marcar em TODA transição"): o dono revogou a obrigatoriedade; a dupla atestação passa a existir **onde ele ligar**.
