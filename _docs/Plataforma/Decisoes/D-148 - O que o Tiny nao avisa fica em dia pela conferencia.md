---
id: D-148
aliases: [D-148]
titulo: "O que o Tiny não avisa fica em dia pela conferência da madrugada; o que foi apagado no Tiny é marcado, e o PRODUTO apagado some de todas as telas"
tipo: decisao
data: 2026-10-21
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-140 - SESSAO-32 pedido excluido no Tiny nao existe em nenhum modulo|D-140]]", "[[D-143 - Tiny completo o plano aprovado inteiro o que o Tiny nao avisa|D-143]]", "[[D-144 - Os dados proprios da conta da FABRICA no Tiny ficam num|D-144]]"]
area: [tiny-n8n]
tags: [decisao, area/tiny-n8n]
---
# D-148 · O que o Tiny não avisa fica em dia pela conferência da madrugada; o que foi apagado no Tiny é marcado, e o PRODUTO apagado some de todas as telas (21/10/2026, dono na conversa) — ↪️ D-140, D-143, D-144, regra 18

**Contexto:** a recontagem de 21/10 (Auditoria → Carga do Tiny) mostrou que, 3 dias depois da carga completa, ficam no retrato da carga os dados que o Tiny não avisa nem entram na consulta de hora em hora — os registros próprios da fábrica (pedidos de venda 137 × 135, notas 590 × 589, contas a receber 288 × 287, pedidos de compra 157 × 151) e as contas a pagar das duas contas (loja 579 × 563) — e que o que foi **apagado** no Tiny segue aqui (108 produtos da fábrica, "Produto não localizado"; 89 contas a pagar da fábrica que saíram da busca do Tiny).

**O plano levado ao dono e aprovado** (*"Pode seguir com o plano. Os produtos apagados no Tiny somem de todas as telas, como o pedido apagado."*):

1. **Sem relógio novo:** a conferência da madrugada que já existe (a das 3h — relógio de calendário, Lei §4) passa a pedir ao Tiny a **lista completa** de: pedidos de venda, notas fiscais, contas a receber e pedidos de compra da FÁBRICA; contas a pagar das DUAS contas; e o catálogo da fábrica (só para achar o que sumiu). Hoje ~60 páginas por noite.
2. **Só relê o que mudou:** cada item da lista é comparado com o que está guardado; o que é novo ou mudou (pago, cancelado, valor trocado) é buscado de novo inteiro; o igual não é tocado. A primeira rodada relê todos os detalhes (~5,6 mil chamadas, prioridade baixa) — depois, só o que mudou.
3. **O apagado no Tiny é marcado, nunca apagado aqui:** o que temos e não veio na lista completa é conferido um a um; só quando o Tiny responde que não existe vira "apagado no Tiny". Visto de novo → desmarca sozinho. **Trava:** lista que vem com menos da metade do que temos não marca nada e avisa o dono no sino.
4. **Atraso de até 1 dia** para esses dados (ninguém os vê numa tela ainda — [[D-144 - Os dados proprios da conta da FABRICA no Tiny ficam num|D-144]]); a consulta de hora em hora fica como está ([[D-143 - Tiny completo o plano aprovado inteiro o que o Tiny nao avisa|D-143]]).
5. **O PRODUTO apagado no Tiny some de todas as telas, como o pedido apagado ([[D-140 - SESSAO-32 pedido excluido no Tiny nao existe em nenhum modulo|D-140]]):** Estoque, Configurações (móveis, insumos e peças, unidades fora do padrão, estrutura), buscas; e a plataforma **para de perguntar ao Tiny** por ele (estoque, fotos). Fica guardado e volta se reaparecer no Tiny. Na decisão: 108 produtos (62 peças, 34 insumos, 3 kits, 9 móveis), nenhum com cartão vivo; os 9 móveis estavam parados na fila do estoque com o Tiny desde 20/10.
6. **A renovação do acesso da API nova da fábrica** passa a poder renovar com 30 min de intervalo mínimo (era 2 h) — com o relógio de 3 em 3 h o acesso nunca passa de 3h30 de idade (vale 4 h — [[Memoria - Tiny n8n e Integracoes 1#E-116|E-116]]).

**Fora desta decisão (anotado):** os contatos da loja que nunca compraram; os produtos da loja ([[D-145 - A consulta de hora em hora pergunta os produtos alterados|D-145]]); as contas a receber da loja (a conferência das 3h segue como sempre).
