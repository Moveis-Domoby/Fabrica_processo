---
id: D-127
aliases: [D-127]
titulo: "A LIMPEZA E EMBALAGEM conclui pela etapa EXPEDIÇÃO — o botão \"Concluir produção\" sai"
tipo: decisao
data: 2026-10-13
status: vigente
revisa: ["[[D-059 - Quadros de producao so por arrasto o unico botao e Concluir|D-59]]"]
revisada_por: []
complementa: []
area: [kanban-producao]
tags: [decisao, area/kanban-producao]
---
# D-127 · A LIMPEZA E EMBALAGEM conclui pela etapa EXPEDIÇÃO — o botão "Concluir produção" sai (13–14/10/2026, pedido do dono) — ↩️ revisa a D-59

**Pedido do dono:** *"Setor de limpeza e embalagem não deve mais possuir o botão de concluir card, o concluir card do setor de limpeza e embalagem deve ser a movimentação para a etapa expedição."*

- **Soltar a peça na EXPEDIÇÃO** (LIMPEZA E EMBALAGEM) faz o que o botão fazia: peça de pedido vivo → **Pedidos em aguardo**; peça sem pedido (reposição) ou de pedido cancelado → **ESTOQUE, sem dono**. Estado da peça só se a chave da [[D-126 - A marcacao do estado da peca perfeito atencao danificado vira|D-126]] estiver ligada para aquele setor e tipo.
- É **dado** (a rota da etapa, editável em Setores e etapas — [[D-060 - Rotas das etapas etapa com nome de setor leva ao setor|D-60]]): a EXPEDIÇÃO passa a "concluir a produção"; outra etapa pode receber a mesma rota.
- **O "Concluir" fica só no card avulso** ([[D-125 - O card avulso quem cria como termina vinculo etiquetas quem|D-125]]), em qualquer setor. No avulso, soltar na EXPEDIÇÃO só move (ele termina pelo "Concluir") — exceção: o **ajuste de peça** ([[D-130 - O ajuste de peca um card avulso de ajuste que leva a peca|D-130]]) aplica o destino final.
- As **6 peças** que a equipe já tinha posto na EXPEDIÇÃO em 13/10 (pedidos 13177 e 13207) vão para Pedidos em aguardo quando a regra entra (resposta F).
