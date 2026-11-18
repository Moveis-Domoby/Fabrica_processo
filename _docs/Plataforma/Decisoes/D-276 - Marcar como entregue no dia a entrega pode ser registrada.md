---
id: D-276
aliases: [D-276]
titulo: "\"Marcar como entregue no dia…\": a entrega pode ser registrada no dia em que aconteceu de fato, nunca num dia que ainda não chegou; a data vale em toda a plataforma e depois só o admin corrige"
tipo: decisao
data: 2026-11-09
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-033 - ROTAS dentro da plataforma ClickUp nao recebe mais nada|D-33]]", "[[D-113 - Entregue e um fato so dos dois lados e entregue no Tiny fecha|D-113]]", "[[D-156 - A rota aceita QUALQUER pedido vivo o Lancar para ROTAS deixa|D-156]]", "[[D-175 - O CALENDARIO da programacao um modo de ver dentro de Rotas|D-175]]"]
area: [logistica-rotas]
tags: [decisao, area/logistica-rotas]
---
# D-276 · ✅ DECIDIDA pelo dono — "Marcar como entregue no dia…": a entrega pode ser registrada no dia em que aconteceu de fato, nunca num dia que ainda não chegou; a data vale em toda a plataforma e depois só o admin corrige (09/11/2026, SESSAO-47) — ↪️ complementa D-33, D-113, D-156, D-175

**Pedido do dono (09/11):** *"Quando for dar um pedido como entregue, deve aparecer também um botão de alterar a data da entrega para o dia que foi entregue de fato… Eu não posso alterar para uma data que ainda não chegou… Não deve ser obrigatório… se a data for alterada, isso deve refletir em toda a plataforma, inclusive no calendário das rotas."*

**Decidido (pedido e respostas 6 a 8):**
1. Depois de tocar em "Entregue" — em ROTAS → Entregas e nas Entregas do dia do entregador — aparecem três botões: **"Confirmar entrega"** (hoje, como sempre), **"Ainda não"** (fecha sem registrar) e **"Marcar como entregue no dia..."** (abre a escolha do dia e confirma já com ele).
2. **Com peças ainda em produção** (o aviso da imagem do dono) o aviso continua na tela, e os dois botões de confirmar valem como o "entregar mesmo assim" de antes. A regra de fechar tudo do pedido não muda.
3. **A data é opcional** (o padrão é hoje) e **nunca é um dia que ainda não chegou** — o limite é hoje no fuso da fábrica, conferido no banco e não só na tela.
4. **A data escolhida vale em toda a plataforma:** ficha do pedido, Entregas do dia, lista de pedidos, calendário das rotas (o entregue aparece no dia real) e os números de entregas por dia.
5. **Corrigir depois: só o admin, na ficha do pedido** ("Alterar a data da entrega"), com a mesma regra de data. A entrega não é editada: a correção é um registro novo com o dia de antes e o novo.
6. **O Tiny** continua recebendo "Entregue" como hoje; a data não vai ao Tiny.

**Como ficou (técnico):** migration `20261109030000`. A data que vale = `plt_cards.entrega_em` (projeção dos fatos `pedido_entregue`, `entrega_desfeita`, `entrega_dia_corrigido` — `fn_projetar_entrega`); o dia sempre por `plt_privado.fn_dia_da_entrega` (fuso `America/Fortaleza`); a regra do dia em `plt_privado.fn_entrega_instante`; `plt_fn_registrar_entrega(…, p_dia date default null)` e `fn_fechar_pedido(…, p_ocorrido_em)`; guarda no fato (`fn_validar_entrega_dia`); `plt_fn_entrega_corrigir_dia(card, dia, motivo)` só admin; leitores pela mesma data: `plt_fn_pedidos_lista`, `plt_fn_pcp_pedido_detalhe`, `plt_fn_rotas`, `plt_fn_programadas`, `plt_fn_entregas_do_dia`, `plt_fn_rotas_calendario`, `plt_fn_dash_motivos`. Telas: `src/rotas/ConfirmarEntrega.tsx` (um componente para os dois lugares), `src/rotas/diaDaEntrega.ts`, `src/pedidos/AlterarDataDaEntrega.tsx`.
