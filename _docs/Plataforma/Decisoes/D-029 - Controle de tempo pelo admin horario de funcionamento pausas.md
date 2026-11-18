---
id: D-29
aliases: [D-29, D-029]
titulo: "Controle de tempo pelo admin: horário de funcionamento, pausas manuais e correção retroativa"
tipo: decisao
data: 2026-08-28
status: vigente
revisa: []
revisada_por: []
complementa: []
area: [tempos-paineis]
tags: [decisao, area/tempos-paineis]
---
# D-29 · Controle de tempo pelo admin: horário de funcionamento, pausas manuais e correção retroativa (28/08/2026)

**Decidido (pedido novo do dono no início do bloco — "4 extra"):**

- Admin configura **horário de funcionamento por setor E por usuário** nas configurações de admin → fora do horário, os timers não contam.
- **Botões de controle direto:** desligar o tempo de um setor ou de uma pessoa AGORA, até religar manualmente.
- **Botão de correção retroativa** ("esqueci de desligar, mas ontem tal setor não funcionou"): admin marca um período passado de setor/pessoa como não contado.
- **Nada disso altera o dado registrado** — o tempo executado até então é fixo; eventos continuam append-only e o desconto acontece só no cálculo derivado ([[Memoria - Modelos Formulas e Possibilidades#M-13|M-13]]).
