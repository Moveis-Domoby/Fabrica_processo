---
titulo: SESSAO-45 — Rotas no mapa certo, liberar peça na Expedição e o PCP honesto sobre o estoque
tipo: demanda
data: 2026-11-04
status: entregue (04/11/2026 — no ar)
tags: [demanda, sessao-45, rotas, mapa, google-maps, expedicao, pcp, estoque]
---

# SESSAO-45 — Rotas no mapa certo, liberar peça na Expedição e o PCP honesto sobre o estoque

> Pedido do dono direto na conversa do Claude Code (04/11/2026, noite), com 2 imagens e 1 vídeo. Ordem: *"faça tudo com decisões próprias de acordo com o nosso padrão… não crie tabelas novas no banco… crie apenas colunas em caso de necessidade… cuidado com a otimização… trate diretamente os casos… não edite nenhum dado real que afete a produção… todo teste que você fizer, apague seu rastro depois, inclusive nos logs… só pare quando tudo estiver no ar e conferido com teste de tela"*. Esta nota registra o pedido como a demanda da sessão (não passou pelo Cowork).

## O pedido

**Rotas**
1. **Rota indo com endereço errado para o Google Maps** — em alguns casos, ao criar a rota na Programação, o Google Maps abre um endereço diferente do cadastrado e do que o cliente informou na venda (exemplo: pedido 13784; há outros). O botão do Google Maps não está confiável.
2. **"Endereço não encontrado no mapa"** — aparece em pedidos na Programação; exemplo de uma rota já programada com o endereço *Av Machado de Assis, 400 · bosque das colinas · São José de Mipibu-RN* (o dono citou 13783; o pedido é o **13793**), que como parada avulsa aparece no mapa. Investigar esse e os outros casos.
3. **O layout das rotas já programadas está quebrado** (imagem: o cartão do pedido espremido em uma palavra por linha ao lado dos botões).

**PCP e Expedição**
4. **Voltar produto da Expedição para o PCP por liberação do produto em outro pedido** — um botão na Expedição que abre os campos: *"Qual produto foi liberado?"*, *"O produto foi liberado para um pedido?"* (sim → *"Para qual pedido o produto foi liberado?"*; não → campo para o motivo da substituição) e *"Lançar produto novo com essa tag de pedido para PCP?"*. Preenchido, o pedido volta ao PCP com o produto que saiu, e o produto do pedido novo (ou de outro que já estava lá) é dado como concluído.
5. **PCP mentindo sobre móveis em estoque** — vídeo: o PCP diz "2 no estoque" no pedido 13811 e a janela de liberação oferece 2 peças do estoque reservadas; o Estoque mostra o mesmo móvel com "0 em estoque". Tratar para não se repetir.

## Critérios de aceite (como a sessão leu)

- O Google Maps e o Waze abrem **o endereço do pedido** (o do cliente), nos pedidos e na tela do entregador.
- O 13793 (São José de Mipibu) aparece no mapa; os outros "não encontrados" têm saída na própria tela (marcar o ponto); nenhum ponto errado com cara de certo.
- "Já programadas" sem cartão espremido, em tela larga e no celular.
- O botão da Expedição com as perguntas do dono, o pedido de origem de volta ao PCP e o de destino com a peça pronta — conferido e tudo-ou-nada.
- O PCP e o Estoque dizendo a mesma coisa sobre as peças do estoque.
- Banco, função e site no ar, conferidos na tela; rastro dos testes apagado.

## Tarefas no ClickUp

Nenhuma criada (regra 19: quem cria é o dono; o pedido veio direto na conversa).

## Entrega

[[handoff_2026_11_04_sessao45_rotas_expedicao_pcp]] · diário `_docs/Plataforma/Execucao/SESSAO-45.md`
