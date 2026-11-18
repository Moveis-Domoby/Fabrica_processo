---
id: D-320
aliases: [D-320]
titulo: "\"Salvar na plataforma e no Tiny\" fica desligado por enquanto, com o porquê"
tipo: decisao
data: 2026-11-12
status: provisoria
revisa: []
revisada_por: []
complementa: ["[[D-319 - Editar o endereco de entrega do pedido com o original do Tiny|D-319]]"]
area: [tiny-n8n]
tags: [decisao, area/tiny-n8n, provisoria]
---
# D-320 · ⏳ PROVISÓRIA — "Salvar na plataforma e no Tiny" fica desligado por enquanto, com o porquê (12/11/2026, SESSAO-50 — a demanda pede o teste num pedido de teste com o dono acordado) — ↪️ D-319

1. **O botão aparece, desligado, com o porquê em uma linha:** *"O Tiny só deixa alterar o endereço de pedido Em aberto ou Aprovado."* ou *"Salvar no Tiny ainda não está ligado — por enquanto o endereço muda só na plataforma."* O banco recusa a escolha "Tiny" com o mesmo texto.
2. **O caminho que falta** (registrado no diário do bloco C): o fluxo do n8n teria de ler o pedido inteiro e devolvê-lo idêntico menos o endereço (a API nova do Tiny não aceita endereço; a antiga substitui o pedido inteiro e só vale para Em aberto/Aprovado); a fila de saída guarda UMA vontade por pedido (um endereço pendente apagaria um "Entregue" pendente — antes de ligar, uma linha por motivo); e o teste num pedido de teste, com o dono. **A volta já está pronta e testada:** o Tiny devolvendo o endereço pedido grava a confirmação (sem aviso).
