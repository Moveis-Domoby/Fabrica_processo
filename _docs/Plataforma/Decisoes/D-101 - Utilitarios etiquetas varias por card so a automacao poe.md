---
id: D-101
aliases: [D-101]
titulo: "Utilitários: etiquetas (várias por card, só a automação põe e tira) e campos customizados (peças e pedidos; automação e admin preenchem)"
tipo: decisao
data: 2026-10-01
status: revisada
revisa: []
revisada_por: ["[[D-125 - O card avulso quem cria como termina vinculo etiquetas quem|D-125]]", "[[D-150 - O prazo e a PRIORIDADE do card de producao|D-150]]"]
complementa: []
area: [kanban-producao, painel-chat-automacoes]
tags: [decisao, area/kanban-producao, area/painel-chat-automacoes]
---
# D-101 · Utilitários: etiquetas (várias por card, só a automação põe e tira) e campos customizados (peças e pedidos; automação e admin preenchem) (01/10/2026)

**↩️ revisada em 2026-10-14 ([[D-125 - O card avulso quem cria como termina vinculo etiquetas quem|D-125]]):** quem pode editar o card põe e tira etiqueta; criar etiqueta é de líder e admin (nome repetido recusado); campo customizado vale também em card avulso.


**Decidido (respostas 2 e 3 do dono e as escolhas de 01/10):** *"Crie uma aba na página de admin chamada Utilitários, lá dentro coloque para cadastrar etiquetas e campos customizados"*; etiquetas *"quantas eu quiser colocar, para tirar deve ter o nó de remover etiquetas"*; campos **nas peças, no card do pedido e nos pedidos**, preenchidos **pela automação e pelo admin**.

- **Configurações → Utilitários** (só admin), em abas: **Etiquetas** (nome + uma de 6 cores da paleta das etiquetas — sem verde/âmbar/vermelho da qualidade nem o amarelo da ação) e **Campos customizados** (texto, número, data, lista de opções, sim/não; valem nas peças, nos pedidos ou nos dois). Usado não se exclui — arquiva (a história fica).
- **Etiquetas no card:** várias; quem põe e tira são os blocos "pôr etiqueta" / "tirar etiqueta" (o admin também pode pelo banco). Vínculo por **evento com projeção** ([[Memoria - Modelos Formulas e Possibilidades#M-13|M-13]]): `etiqueta_adicionada`/`etiqueta_removida` → `plt_cards.etiquetas`. Aparecem no quadro, no tablet e no card do pedido do PCP — ícone + nome + cor ([[Memoria - Modelos Formulas e Possibilidades#M-12|M-12]]).
- **"No card do pedido" e "no pedido" são o MESMO valor** (decidido pelo Claude, dito ao dono): um pedido tem um card só no PCP; o valor é guardado pelo pedido — alcança até pedido antigo sem card. Na peça, o valor é da peça. Aparece no card (até 3), no histórico do card (todos, com edição à mão do admin), no card do pedido no PCP e no detalhe do pedido em "Todos os pedidos". A história do valor (quem, antes → depois) vai para a trilha.
