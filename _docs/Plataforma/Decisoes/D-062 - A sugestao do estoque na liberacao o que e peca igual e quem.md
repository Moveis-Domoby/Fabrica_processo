---
id: D-62
aliases: [D-62, D-062]
titulo: "A sugestão do estoque na liberação: o que é \"peça igual\" e quem aceita"
tipo: decisao
data: 2026-09-27
status: vigente
revisa: []
revisada_por: []
complementa: []
area: [estoque]
tags: [decisao, area/estoque]
---
# D-62 · A sugestão do estoque na liberação: o que é "peça igual" e quem aceita (27/09/2026)

**Decidido (respostas b1 e b5 do dono na SESSAO-24):**

- **"Peça igual" (b1):** produto do catálogo casa pelo **SKU**; **personalizado** casa por **SKU + descrição idêntica** (sem ligar para maiúsculas, acentos e espaços); item **sem SKU** casa pela descrição idêntica.
- Ao liberar um pedido no PCP, cada linha mostra **"Há N igual(is) no estoque, sem dono — usar?"** — **desmarcado por padrão** (a sugestão nunca decide sozinha). **↪️ 30/09 ([[D-078 - A venda reserva a peca na hora o pedido segue no PCP|D-78]]):** a peça que a VENDA já reservou para a unidade vem **marcada** ("Peça do estoque reservada para este pedido — usar?").
- **Quem aceita (b5):** PCP/logística (*"são a mesma coisa no fim das contas"*) e admin.
- **Aceitar** faz a unidade do pedido nascer **direto em Pedidos em aguardo** (a peça livre sai do ESTOQUE; as duas histórias ficam guardadas). Se o pedido for cancelado depois, a peça volta ao ESTOQUE sem dono ([[D-061 - Cancelamento em tres estagios a aba Cancelados guarda|D-61]]).
