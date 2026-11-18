---
id: D-45
aliases: [D-45, D-045]
titulo: "Logística e ROTAS: unidade pronta, lançamento, ID de produção, danificados, programação e metas completas"
tipo: decisao
data: 2026-09-01
status: revisada
revisa: []
revisada_por: ["[[D-058 - O lugar da peca pronta com pedido Pedidos em aguardo|D-58]]", "[[D-113 - Entregue e um fato so dos dois lados e entregue no Tiny fecha|D-113]]", "[[D-156 - A rota aceita QUALQUER pedido vivo o Lancar para ROTAS deixa|D-156]]"]
complementa: []
area: [logistica-rotas, estoque]
tags: [decisao, area/logistica-rotas, area/estoque]
---
# D-45 · Logística e ROTAS: unidade pronta, lançamento, ID de produção, danificados, programação e metas completas (01/09/2026, registrada em 08/09)

**↩️ revisada em 2026-09-27 ([[D-058 - O lugar da peca pronta com pedido Pedidos em aguardo|D-58]]):** "unidade pronta" = chegou a um dos três fins de linha; o lançamento move as unidades de Pedidos em aguardo para as ROTAS (não mais do ESTOQUE).

**↩️ revisada em 2026-10-08 ([[D-113 - Entregue e um fato so dos dois lados e entregue no Tiny fecha|D-113]]/D-115):** registrar a entrega deixa de ser só interno — vai ao Tiny, volta do Tiny, fecha as peças, e o entregador entrega, desfaz, marca "não entregue" ou "devolvido" pela tela dele.

**Decidido (respostas do dono no início da SESSAO-15, em 01/09; a D-44 pertence à frente do backfill — cofre de Pedidos entregues):**

- **"Unidade pronta" = chegou em setor terminal** (ESTOQUE ou ROTAS). Uma tela de "concluídos" fica para o futuro.
- **Lançar para ROTAS move de verdade:** ao lançar o pedido completo, as unidades que estão no ESTOQUE são movidas para o setor ROTAS por evento normal de movimentação — saem da lista do Estoque e a contagem das ROTAS fecha. **Só o lançado aparece nas ROTAS** (a regra da S11 — "bastava estar no setor ROTAS" — cai).
- **Estoque é lista, não quadro:** a lista da [[D-038 - Logistica Estoque com ID digitavel sala de Pedidos em aguardo|D-38]] SUBSTITUI o quadro kanban do setor ESTOQUE (palavras do dono: *"esse quadro primeiramente que não deveria nem existir"*). **Quem vê e edita o ID de produção:** logística (PCP/terminais) e admin.
- **Danificados:** resolver para outro setor **exige marcar o estado** (a peça pode sair 🟡 ou 🔴 mesmo); as ações ficam com **logística e admin** (líder fora — resposta de 08/09); o botão **"visualizar arquivados" só carrega ao ser clicado**.
- **Programação de caminhão:** reprogramável a qualquer instante, inclusive no dia — **nunca depois de o pedido ser registrado como entregue**; admin tem controle total; quem opera é a logística.
- **Os ~163 cards históricos do PCP** ([[Memoria - Migrations Aplicador e Ensaio 1#E-24|E-24]]): aprovado arquivar em massa (evento `card_arquivado`, exclusão lógica; o histórico fica). ✅ **Feito em 08/09** na SESSAO-15 — 233 cards arquivados (conferido no banco em 01/10).
- **Metas (pendência da S14):** a meta que o líder define para o liderado é **completa** — *"Lucas → concluir X cards na etapa Y em x tempo (opcional)"* — o liderado só pega, executa e finaliza o card, e a meta contabiliza sozinha. Consequências: **edição/encerramento travados para quem criou** (admin mantém tudo; a pessoa manda só nas metas que ela mesma criou) e a meta de unidades ganha **etapa opcional**.
- **Horas úteis:** cada etapa conta o próprio tempo; a pessoa conta do iniciar ao finalizar; cada card carrega o tempo total de produção (PCP → fim de linha); a dashboard mostra a **média por etapa** — insumo registrado para a SESSAO-16. A meta de setor em horas úteis segue contando só execução.

**Descartadas:** só "marcar" o pedido como lançado sem mover as unidades (deixaria o Estoque sujo e a ROTAS inconsistente); manter o quadro kanban do ESTOQUE ao lado da lista.
