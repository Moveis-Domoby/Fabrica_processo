---
id: D-144
aliases: [D-144]
titulo: "Os dados próprios da conta da FÁBRICA no Tiny ficam num módulo à parte — fora do Comercial e da Produção, por enquanto"
tipo: decisao
data: 2026-10-18
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-142 - Integracao completa com o Tiny as 6 perguntas do plano|D-142]]", "[[D-143 - Tiny completo o plano aprovado inteiro o que o Tiny nao avisa|D-143]]"]
area: [tiny-n8n]
tags: [decisao, area/tiny-n8n]
---
# D-144 · Os dados próprios da conta da FÁBRICA no Tiny ficam num módulo à parte — fora do Comercial e da Produção, por enquanto (18/10/2026) — ↪️ D-142, D-143

**Pedido do dono (18/10, vendo a contagem "Bateu com o Tiny?" da carga completa):** *"esse da fábrica deve ficar a parte do comercial e até mesmo da produção por enquanto, deixe apenas ele como um modulo a parte que trabalharemos depois"*.

1. **O que a carga traz da conta da fábrica** (CNPJ da matriz) — contatos (clientes, fornecedores, transportadoras), pedidos de venda, notas fiscais, contas a pagar e a receber, pedidos de compra, depósitos, marcas, categorias, formas de pagamento e de recebimento, listas de preço — **fica só guardado** em `plt_tiny_registros` (`conta = 'fabrica'`). **Nunca** entra em `pedidos`, `clientes`, `notas_fiscais` ou `contas_receber` (são da loja e alimentam o Comercial e a Produção) nem aparece em tela do Comercial ou da Produção. **Já é assim** (conferido no código em 18/10: `fn_tiny_fila_resposta` só manda às rotinas de sempre o que é da loja; o resto da fábrica vai para os registros).
2. **Onde aparece hoje:** só na Auditoria → Carga do Tiny (as contagens, para o super admin).
3. **Depois:** um **módulo próprio da fábrica**, desenhado com o dono numa sessão futura (o que mostrar e para quem).
4. **Fica como estava** (decisões anteriores, entendimento do Claude — o dono corrige se quiser diferente): os **produtos e o estoque** da fábrica (o catálogo da plataforma desde 23/09 — [[D-077 - A plataforma manda no Tiny entrada baixa e contagem daqui|D-77]], [[D-138 - SESSAO-32 o OK dos indices e os insumos separados dos moveis|D-138]]) e a **estrutura dos móveis** em Configurações ([[D-142 - Integracao completa com o Tiny as 6 perguntas do plano|D-142]]) — são do processo de produção, não dos registros comerciais da fábrica.

**Para quem codar:** nenhuma porta do Comercial ou da Produção lê `plt_tiny_registros` com `conta = 'fabrica'`; a ponte entre as contas continua só pelo produto (SKU — [[Memoria - Tiny n8n e Integracoes 1#A-22|A-22]]).
