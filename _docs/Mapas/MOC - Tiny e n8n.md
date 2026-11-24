---
titulo: "Mapa — Tiny e n8n"
tipo: mapa
area: tiny-n8n
atualizado: 2026-11-18
tags: [mapa, moc, area/tiny-n8n]
---

# 🗺️ MOC - Tiny e n8n

> O Tiny (Olist) é o ERP; o n8n é quem conversa com ele. Pedido, cliente, produto, nota e conta chegam ao banco **por evento** (webhook → fila), o que o Tiny não avisa é relido de hora em hora e na conferência da madrugada. Loja e fábrica são **duas contas** do Tiny; cada credencial tem **um só renovador**. A plataforma lê o próprio banco e devolve ao Tiny o "entregue" e o saldo do estoque.

**No código:** `supabase/functions/` (as funções de borda do Tiny) · `src/paginas/AdminApi.tsx` · os fluxos exportados em `_docs/Fabrica n8n/*.json`

**Notas da área:** [[N8N - API Tiny v2 vs v3]] · [[N8N - Backfill Historico do Tiny]] · [[N8N - Baixa Automatica de Recebimentos]] · [[N8N - Cadastro de Cliente (em andamento)]] · [[N8N - Cadastro de Cliente]] · [[N8N - Codigo Mapear 49 Colunas]] · [[N8N - Incidente Credencial Google]] · [[N8N - Infraestrutura VPS]] · [[N8N - Migracao Supabase]] · [[N8N - PCP Trello e ClickUp]] · [[N8N - Pendencias e Riscos]] · [[N8N - Plataforma para Tiny (situacao do pedido)]] · [[N8N - ROTAS ClickUp]] · [[N8N - ROTAS Entregue para Tiny]] · [[N8N - Tiny - Mapa Completo da API e dos Dados]] · [[N8N - Tiny 2 para PCP]] · [[N8N - Tiny Fabrica - Estudo do Cadastro]] · [[N8N - Tiny Fabrica Produtos para Banco]] · [[N8N - Tiny Integracoes Referencia]] · [[N8N - Tiny Modelos Mentais]] · [[N8N - Visao Geral da Migracao]] · [[N8N - Workflow Tiny para Planilha]] · [[003 - PLANO - Integracao Completa Tiny da Fabrica]] · [[PLT - API Aberta]] · [[PLT - Entrada Automatica de Pedidos]] · [[SUPA - Visao Geral]]

**Perguntas em aberto:** ver a seção "API e integrações" das perguntas em aberto — [[PLT - Perguntas em Aberto]]

## Últimas sessões da área (a mais nova primeiro)

- **50** · [[SESSAO-50 - Observacao do Item Cancelar e Ocultar no PCP e Editar Endereco da Parada]] · [[handoff_2026_11_12_sessao50_observacao_cancelar_ocultar_endereco|handoff]]
- **47** · [[SESSAO-47 - Pedido Adiantado no Tiny Data Real da Entrega Comprovantes e Painel de Tempos]] · [[handoff_2026_11_09_sessao47_pedido_adiantado_entrega_comprovantes_tempos|handoff]]
- **44** · [[SESSAO-44 - Entrega que Volta do Tiny e Itens Novos no PCP]] · [[handoff_2026_11_04_sessao44_entrega_tiny_itens_novos|handoff]]
- **33** · [[SESSAO-33 - Tiny Completo - Todos os Dados Atualizados por Evento]] · [[handoff_2026_10_17_sessao33_tiny_completo|handoff 1]] · [[handoff_2026_10_22_sessao33_o_que_o_tiny_nao_avisa|handoff 2]]
- **29** · [[SESSAO-29 - Reconciliacao Tiny - Pente-fino e Ultimo Pacote Vence]] · [[handoff_2026_10_01_sessao29_reconciliacao_tiny|handoff]]
- **25** · [[SESSAO-25 - Integracao Tiny Fabrica - Estoque e Minimos]] · [[handoff_2026_09_26_sessao25_estoque|handoff]]
- **21** · [[SESSAO-21 - Uniao 3 - Cutover e Desligamento]] · [[handoff_2026_09_22_sessao21_cutover|handoff]]
- **11** · [[SESSAO-11 - API Aberta e Integracao n8n]] · [[handoff_2026_08_28_sessao11_api_rotas|handoff]]
- **09** · [[SESSAO-09 - Entrada de Pedidos via n8n]] · [[handoff_2026_08_28_sessao09_entrada_pedidos|handoff]]

<!-- gerado:inicio -->
## Decisões vigentes (24)

- [[D-031 - Entrada de pedidos a plataforma le o proprio banco sem tocar|D-31]] · Entrada de pedidos: a plataforma lê o próprio banco, sem tocar o n8n
- [[D-050 - Integracao Tiny banco edicao no Tiny edita aqui apagar|D-50]] · Integração Tiny → banco: edição no Tiny edita aqui, apagar no Tiny NÃO apaga aqui (só…
- [[D-076 - O Tiny sobe a plataforma vale o saldo SOMADO das duas|D-76]] · O Tiny sobe a plataforma: vale o saldo SOMADO das duas empresas; Tiny acima → a…
- [[D-077 - A plataforma manda no Tiny entrada baixa e contagem daqui|D-77]] · A plataforma manda no Tiny: entrada, baixa e contagem daqui deixam o Tiny com o número…
- [[D-078 - A venda reserva a peca na hora o pedido segue no PCP|D-78]] · A venda reserva a peça na hora; o pedido segue no PCP, que decide; nada da venda vai ao…
- [[D-079 - Ponto de partida ligar copia uma vez o saldo do Tiny tudo|D-79]] · Ponto de partida: ligar copia uma vez o saldo do Tiny; tudo nasce desligado e só o admin…
- [[D-080 - Um fluxo so no n8n para o Tiny da fabrica catalogo estoque|D-80]] · Um fluxo só no n8n para o Tiny da fábrica (catálogo + estoque); a carga avulsa do saldo…
- [[D-081 - As fotos dos produtos vem do Tiny e aparecem inteiras sem|D-81]] · As fotos dos produtos vêm do Tiny e aparecem inteiras, sem corte
- [[D-082 - A foto do Tiny chega sozinha a plataforma a da camera fica|D-82]] · A foto do Tiny chega sozinha à plataforma — a da câmera fica, a apagada no Tiny também
- [[D-097 - O nome do cliente e gravado sem o codigo no lugar do apostrofo|D-97]] · O nome do cliente é gravado sem o código no lugar do apóstrofo
- [[D-098 - O cliente e achado pelo cadastro do Tiny o fluxo de vendas|D-98]] · O cliente é achado pelo cadastro do Tiny; o fluxo de vendas passa esse número — item C…
- [[D-113 - Entregue e um fato so dos dois lados e entregue no Tiny fecha|D-113]] · "Entregue" é um fato só, dos dois lados — e entregue no Tiny fecha TUDO do pedido aqui
- [[D-122 - As contas a receber voltam do Tiny todo dia na conferencia|D-122]] · As contas a receber voltam do Tiny todo dia, na conferência da madrugada
- [[D-123 - O Entregue vai ao Tiny mora dentro da automacao do Tiny|D-123]] · O "Entregue vai ao Tiny" mora dentro da automação do Tiny que já existia
- [[D-142 - Integracao completa com o Tiny as 6 perguntas do plano|D-142]] · Integração completa com o Tiny: as 6 perguntas do plano respondidas
- [[D-143 - Tiny completo o plano aprovado inteiro o que o Tiny nao avisa|D-143]] · Tiny completo: o plano aprovado inteiro; o que o Tiny não avisa, de hora em hora só das…
- [[D-144 - Os dados proprios da conta da FABRICA no Tiny ficam num|D-144]] · Os dados próprios da conta da FÁBRICA no Tiny ficam num módulo à parte — fora do…
- [[D-145 - A consulta de hora em hora pergunta os produtos alterados|D-145]] · A consulta de hora em hora pergunta os produtos alterados SÓ à fábrica
- [[D-148 - O que o Tiny nao avisa fica em dia pela conferencia|D-148]] · O que o Tiny não avisa fica em dia pela conferência da madrugada; o que foi apagado no…
- [[D-194 - A data de entrega mudada ou removida so na plataforma o tiny|D-194]] · A DATA DE ENTREGA MUDADA OU REMOVIDA SÓ NA PLATAFORMA; o Tiny mudando a data, vale o…
- [[D-269 - O cancelamento no Tiny FECHA o stand-by do pedido na hora|D-269]] · O cancelamento no Tiny FECHA o stand-by do pedido, na hora do cancelamento; o painel de…
- [[D-271 - O pedido que o Tiny levou adiante e ainda tem produto|D-271]] · O pedido que o Tiny levou adiante e ainda tem produto por liberar aparece na Expedição…
- [[D-311 - O pedido excluido no Tiny sai do PCP de vez e segue o caminho|D-311]] · O pedido excluído no Tiny sai do PCP de vez e segue o caminho do cancelado
- [[D-315 - A observacao do item do Tiny na capa do card|D-315]] · A observação do item do Tiny na capa do card

## Provisórias ⏳ — valem até o dono dizer o contrário (10)

- [[D-212 - Itens que o Tiny muda depois da liberacao|D-212]] · Itens que o Tiny muda depois da liberação
- [[D-214 - A volta atras no Tiny|D-214]] · A volta atrás no Tiny
- [[D-216 - O acerto do 13787|D-216]] · O acerto do 13787
- [[D-228 - A conferencia do historico do Trello e a lista Motivos|D-228]] · A conferência do histórico do Trello e a lista "Motivos de conferência"
- [[D-229 - A carga do historico do Trello|D-229]] · A carga do histórico do Trello
- [[D-273 - Quadradinho Saiu do PCP pelo Tiny nos filtros da Expedicao|D-273]] · Quadradinho "Saiu do PCP pelo Tiny" nos filtros da Expedição
- [[D-274 - Com a ida ao Tiny desligada os botoes de voltar ao PCP ficam|D-274]] · Com a ida ao Tiny desligada, os botões de voltar ao PCP ficam apagados, com a explicação
- [[D-320 - Salvar na plataforma e no Tiny fica desligado por enquanto|D-320]] · "Salvar na plataforma e no Tiny" fica desligado por enquanto, com o porquê
- [[D-365 - API e integracoes rele as tres listas numa chamada so|D-365]] · API e integrações relê as três listas numa chamada só
- [[D-380 - A pausa entre consultas a Geoapify e as consultas por endereco|D-380]] · A pausa entre consultas à Geoapify e as consultas por endereço

## Revisadas por outra (3) — só para a história

[[D-011 - API antecipada entrada de pedidos via n8n logo apos o kanban|D-11]] · [[D-124 - O marcador Devolvido do Tiny NAO e cancelamento a fabrica|D-124]] · [[D-140 - SESSAO-32 pedido excluido no Tiny nao existe em nenhum modulo|D-140]]

## Onde mais ler (só o que a demanda tocar)

- **Banco:** [[Banco - Filas e Integracoes Tiny e n8n 1]] · [[Banco - Filas e Integracoes Tiny e n8n 2]] · [[Banco - Integracao Tiny - Pedidos Clientes e Produtos]]
- **Lições:** [[Memoria - Tiny n8n e Integracoes 1]] · [[Memoria - Tiny n8n e Integracoes 2]]
<!-- gerado:fim -->
