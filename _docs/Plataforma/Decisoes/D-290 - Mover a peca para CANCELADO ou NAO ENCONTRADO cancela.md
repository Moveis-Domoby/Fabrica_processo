---
id: D-290
aliases: [D-290]
titulo: "Mover a peça para CANCELADO ou NÃO ENCONTRADO cancela a fabricação: sai da produção na hora, fica alguns dias à vista na coluna e depois é arquivada (recuperável); cancelar a peça não é cancelar o pedido"
tipo: decisao
data: 2026-11-11
status: vigente
revisa: ["[[D-061 - Cancelamento em tres estagios a aba Cancelados guarda|D-61]]"]
revisada_por: []
complementa: ["[[D-075 - O quadrinho do PCP na Visao do dia conta o que o quadro|D-75]]", "[[D-132 - O PCP segue o Tiny pedido Faturado Pronto para envio|D-132]]", "[[D-201 - O PEDIDO NOVO USA PELO PCP A PECA SEM DONO QUE JA ESTA|D-201]]"]
area: [kanban-producao]
tags: [decisao, area/kanban-producao]
---
# D-290 · ✅ DECIDIDA pelo dono — Mover a peça para CANCELADO ou NÃO ENCONTRADO cancela a fabricação: sai da produção na hora, fica alguns dias à vista na coluna e depois é arquivada (recuperável); cancelar a peça não é cancelar o pedido (11/11/2026, SESSAO-48) — ↩️ revisa a D-61 · ↪️ D-75, D-132, D-201

**Pedido do dono (11/11, texto fiel):** *"O móvel aparece que está em produção, no entanto, está em cancelado. Ou seja, não deveria aparecer em produção. Quando for um PEDIDO, pergunta para onde vai mover aquele móvel que seria do pedido que foi cancelado. Caso seja um estoque que foi cancelado a fabricação apenas tire aquele móvel da produção."* · ajuste (01:27): *"Não colocaremos botões, só o mover para cancelado já deve cancelar a peça e ela é excluída depois de 7 dias pra não inflar a coluna com muitos cards, ficando apenas o log de exclusão para recuperarmos caso necessário."* · respostas (01:33): cancelar uma peça não é cancelar o pedido; NÃO ENCONTRADO entra nesta sessão com o mesmo tratamento; a vaga da peça de pedido volta ao PCP com um aviso, e no aviso o PCP pode remover do PCP escolhendo "o pedido foi cancelado", "tirar da linha de produção" (com o que houve) ou "outro motivo"; e investigar a plataforma que recarrega sozinha.

- **Sem botão:** o gesto é mover a peça para a coluna. Vale por qualquer caminho — arrasto no quadro, tablet, Mover, a liberação do PCP direto na coluna, a API.
- **A peça sai da produção na hora:** some do "reservados p/ produção" do Estoque e do Top 20, das contas do PCP e da Expedição; o tempo de fila para de contar; ninguém inicia nem retoma trabalho nela.
- **Na coluna:** "Cancelada em dd/mm · some em N dias" (ou "Não encontrada em …"), no lugar do tempo de fila. Arrastar de volta desfaz.
- **De estoque** (reposição, lançamento manual): só sai da produção. **De pedido vivo:** perde o pedido e a vaga volta ao PCP com o aviso "Peça cancelada na produção" (ou "Peça não encontrada") e o sino do PCP. **De pedido cancelado no Tiny:** sai da produção, sem vaga de volta.
- **NÃO ENCONTRADO** é o mesmo gesto; muda só o motivo gravado.

**Como ficou (técnico):** migration `20261111010000_plt_sessao48_base.sql` — o sinal da etapa (`plt_etapas.cancela_fabricacao` / `cancela_motivo` / `cancela_dias`, ligado uma vez só no CANCELADO e no NÃO ENCONTRADO da LIMPEZA E EMBALAGEM); o gatilho no fato de CHEGADA (`plt_eventos_zz_cancelamento_chegada` → `fn_cancelar_fabricacao` / `fn_retomar_fabricacao`); os fatos `fabricacao_cancelada` / `fabricacao_retomada` (só pela maquinaria — marca `plt.cancelamento_maquinaria`) com a projeção `plt_cards.cancelada_em` / `cancelada_motivo` / `cancelada_pedido_id`; a peça de pedido perde o pedido por `unidade_desvinculada` (a vaga volta pela regra de sempre — `fn_vagas_pedido`); o aviso `plt_cards.pcp_aviso_em` no card do pedido; a regra única do que conta (`fn_estoque_categoria` com 8 argumentos e os 5 leitores) e a do PCP (`fn_fora_do_pcp` com a remoção, em todas as portas — [[D-075 - O quadrinho do PCP na Visao do dia conta o que o quadro|D-75]]).
