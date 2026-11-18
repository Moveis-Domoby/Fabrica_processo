---
id: D-319
aliases: [D-319]
titulo: "Editar o endereço de entrega do pedido, com o original do Tiny guardado e a pergunta \"salvar também no Tiny?\""
tipo: decisao
data: 2026-11-12
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-193 - O ENDERECO DE ENTREGA DO PEDIDO vale na logistica inteiro sem|D-193]]", "[[D-194 - A data de entrega mudada ou removida so na plataforma o tiny|D-194]]"]
area: [logistica-rotas]
tags: [decisao, area/logistica-rotas]
---
# D-319 · ✅ DECIDIDA pelo dono (12/11/2026, 01:25 e 01:30) — Editar o endereço de entrega do pedido, com o original do Tiny guardado e a pergunta "salvar também no Tiny?" (SESSAO-50, bloco C) — ↪️ D-193, D-194

*"Editar endereço de entrega mesmo e corrigindo no pino no mapa."* · *"Quando ele editar, deve gerar uma pergunta, mas o endereço original que veio do Tiny ainda continua no banco como log para recuperar caso necessário."* · *"A pergunta é se ele deseja salvar também no Tiny."*

1. **"Editar endereço"** (Rotas — Programar, Já programadas, o mapa —, Entregas do dia e a ficha do pedido): rua, número, complemento, bairro, cidade, UF, CEP e o pino. Ao salvar, a janela mostra **de/para** e pergunta se salva também no Tiny ("Salvar só na plataforma" / "Salvar na plataforma e no Tiny").
2. **O original do Tiny fica guardado** no fato `endereco_entrega_alterado` (o endereço inteiro, de onde veio — entrega ou cadastro —, o anterior, o novo, o ponto e a escolha); **"Voltar ao endereço original"** restaura (fato `endereco_entrega_restaurado`). Mexer só no pino continua sendo o "Salvar o ponto" de sempre, sem pergunta.
3. **O endereço novo vale em todo lugar** (Rotas, mapa, Entregas do dia e o link do Google Maps/Waze do entregador, ficha, candidatos e filtros de cidade e bairro): a regra única de "onde entregar" (`vw_endereco_entrega`) prefere o da plataforma. Onde ele aparece, o selo **"Endereço alterado na plataforma"** e, ao lado, o que está no Tiny.

**Como ficou (técnico):** `plt_fn_pedido_endereco` (a janela numa leitura), `plt_fn_pedido_endereco_salvar`, `plt_fn_pedido_endereco_restaurar`; a projeção em `plt_pedido_enderecos` (uma linha por pedido alterado); `vw_endereco_tiny` (a regra antiga, sem mudar uma letra) e `vw_endereco_entrega` (só o corpo). Telas: `JanelaEnderecoPedido`, `SeloEnderecoAlterado`. Migration `20261112060000_plt_editar_endereco.sql`.
