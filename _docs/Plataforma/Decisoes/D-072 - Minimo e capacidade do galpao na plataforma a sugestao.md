---
id: D-72
aliases: [D-72, D-072]
titulo: "Mínimo e capacidade do galpão na plataforma; a sugestão de mínimo CABE no galpão"
tipo: decisao
data: 2026-09-28
status: revisada
revisa: ["[[D-057 - Estoque em duas telas sugestao de minimo pelo top 20|D-57]]"]
revisada_por: ["[[D-083 - O Top X manda no estoque e o tamanho da pagina e so ele tem|D-83]]", "[[D-084 - Sugestao por dias uteis de VENDA loja seg sab e minimo|D-84]]"]
complementa: []
area: [estoque]
tags: [decisao, area/estoque]
---
# D-72 · Mínimo e capacidade do galpão na plataforma; a sugestão de mínimo CABE no galpão (28/09/2026) — ↩️ revisa a decisão 4 da SESSAO-25 e a D-57

**↩️ revisada em 2026-09-30 ([[D-083 - O Top X manda no estoque e o tamanho da pagina e so ele tem|D-83]]/D-84):** a capacidade do galpão **saiu de uso** (a coluna fica guardada) e a sugestão passou a ser por **dias úteis de venda**, sem teto; o mínimo virou **automático** (editar trava) e **só o Top X tem mínimo** — o do Tiny deixou de valer como reserva nos acabados. O "Usar todas as sugestões" morreu. O cartão Galpão virou o painel de seis números (pedido do dono em 30/09).

**Decidido (pedido do dono, 28/09):** *"o mínimo deve ser editável em uma caixinha de configurações … aparecer também a quantidade máxima do galpão; a quantidade mínima sugerida deve se adequar ao tamanho máximo do galpão (cuidado aqui)"*; *"a aba de sugestão de mínimo pode na verdade virar a aba de configurações"*.

- A aba **Sugestão de mínimo vira "Configurações"**: a **capacidade do galpão** (quantas peças cabem) e o **mínimo de cada produto**, editável ali. **Mínimo vazio volta a valer o do Tiny** (↩️ "o mínimo mora no Tiny" da SESSAO-25) — nada se perde, e o que for definido aqui manda.
- **A sugestão** = venda média da semana (90 dias) × cobertura (1, 2 ou 4 semanas). **Se a soma de todas passar da capacidade, todas encolhem na mesma proporção** (arredondamento pelo maior resto): a soma nunca passa da capacidade e **o mais vendido nunca fica com menos que o de baixo**. Quem não vendeu nos 90 dias não tem sugestão.
- **"Usar todas as sugestões"** (dois toques): os mínimos viram as sugestões e quem não vendeu fica **sem mínimo** — só assim a soma dos mínimos cabe de verdade no galpão. Um a um também ("Usar" em cada linha). A tela avisa quando a soma dos mínimos passa da capacidade.
- Decidido pelo Claude (o dono pediu para não perguntar): capacidade em **peças** (não em volume); a sugestão cabe na capacidade inteira (as peças reservadas em Pedidos em aguardo aparecem no resumo, mas não descontam a capacidade); mínimo e capacidade são gesto da **logística e do admin**, com trilha ([[D-040 - Auditoria total toda atividade de usuario gera log persistido|D-40]]).
