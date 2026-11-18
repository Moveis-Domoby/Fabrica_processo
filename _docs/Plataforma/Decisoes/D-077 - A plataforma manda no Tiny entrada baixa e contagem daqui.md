---
id: D-77
aliases: [D-77, D-077]
titulo: "A plataforma manda no Tiny: entrada, baixa e contagem daqui deixam o Tiny com o número da plataforma; a produção que chega ao estoque também"
tipo: decisao
data: 2026-09-30
status: vigente
revisa: []
revisada_por: []
complementa: []
area: [estoque, tiny-n8n]
tags: [decisao, area/estoque, area/tiny-n8n]
---
# D-77 · A plataforma manda no Tiny: entrada, baixa e contagem daqui deixam o Tiny com o número da plataforma; a produção que chega ao estoque também (30/09/2026)

**Decidido (dono, 29/09):** *"deixe que os botões de dar baixa, entrada e contagem continuem na plataforma, porém eles funcionam como gatilho para atualizar o tiny … demos entrada em estoque de 4 penteadeiras, no tiny estava −2 … ela avisa para o tiny ficar com 4"*; resposta de 30/09 — produção que chega ao estoque: **"a plataforma avisa sozinha"** (a equipe para de lançar no Tiny); saída feita direto no Tiny (avaria, correção): **ignorar — a baixa se dá só pela plataforma**.

- **O Tiny fica com o número da plataforma** (as peças livres — o da tela), por produto, depois de: entrada, baixa, contagem (até a conferida), arquivar peça livre, peça que chega ao / sai do ESTOQUE (produção, cancelamento), peça livre usada num pedido, e o PCP mandar produzir a unidade que tinha peça reservada ([[D-078 - A venda reserva a peca na hora o pedido segue no PCP|D-78]]).
- **Não vão ao Tiny:** o que veio do Tiny, a venda (reserva e consumo — o Tiny já baixa sozinho), a reserva desfeita por cancelamento ou pedido alterado (o Tiny devolve sozinho) e a peça reservada usada no próprio pedido.
- **Onde grava** (decidido pelo Claude, avisado ao dono): balanço no depósito **"Fábrica" da empresa da loja** (onde as peças prontas estão e onde a venda baixa), pela conta da loja; sem ele, no **Geral** da fábrica. A **soma** das duas empresas fica igual à plataforma. Balanço porque é repetível sem dobrar; se ficaria negativo, saída da diferença.
- Uma fila por produto junta vários movimentos seguidos num pedido só ao Tiny (limite de 60 consultas/min da conta). 5 falhas seguidas → o produto para e aparece em Configurações do Estoque; um movimento novo destrava.

**Descartadas:** empurrar cada movimento como entrada/saída relativa (não se conserta sozinho e dobraria em repetição); aceitar as quedas do Tiny (o aviso não diz se foi venda ou avaria — descontaria a venda duas vezes).
