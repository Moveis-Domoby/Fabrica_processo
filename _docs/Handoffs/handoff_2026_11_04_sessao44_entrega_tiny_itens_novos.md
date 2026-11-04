---
titulo: Handoff — SESSAO-44 · entrega que volta do Tiny e itens novos no PCP
tipo: handoff
data: 2026-11-04
tags: [handoff, sessao-44, pedidos, pcp, tiny, rotas, entrega]
---

# 📋 Handoff — SESSAO-44 · Entrega que volta do Tiny e itens novos no PCP (04/11/2026)

Demanda: [[SESSAO-44 - Entrega que Volta do Tiny e Itens Novos no PCP]] · Diário: `_docs/Plataforma/Execucao/SESSAO-44.md`

## 1. Objetivo

Dois defeitos que deixavam pedido errado sem saída — o "Entregue" do Tiny que volta atrás e a plataforma segue encerrada (13787), e os itens que o vendedor acrescenta depois da liberação ficando sem card (13797) — e o acerto dos dois pedidos.

## 2. O que foi feito

| Frente | Situação |
|---|---|
| **1 · 13797** | ✅ **No ar (04/11 00:13)** com o OK do dono: o pedido voltou ao PCP só com as 3 vagas novas (327, 567, 566), fato na trilha, peças 14542143/14542153/14542161 intactas. A janela oferece só 4, 5 e 6, com a sugestão de estoque. **Falta a equipe liberar.** |
| **2 · Itens novos voltam ao PCP** | ✅ escrito e testado — gatilho adiado em `pedidos` (no fim da gravação do Tiny): fato com o que entrou/saiu, conta da liberação refeita, aviso ao PCP; em rota → aviso "Segure a entrega" à logística e o PCP pode liberar o novo; entregue → pendência só dos novos; parcial/devolvido/cancelado → só aviso; item que saiu → nunca arquiva, avisa; a reserva do estoque reavalia o pedido. ✅ **Banco no ar em 04/11 ~00:50** (OK do dono). |
| **3 · Peça ligada ao produto** | ✅ escrito e testado — a vaga é coberta pela peça do mesmo produto (posição desempata) em janela, liberar, conta, concluir pelo super admin, reservas, sugestões, realocar e contagens. Nenhum card antigo renumerado. ✅ banco no ar |
| **4 · Reabrir entrega** | ✅ escrito e testado — admin reabre qualquer dia e a do Tiny ("Reabrir entrega" na ficha), com motivo; a peça do estoque volta **reservada** (o defeito provável estava confirmado); o Tiny só recebe a volta se ainda estiver "Entregue"; a ficha e Entregas do dia explicam por que não dá. ✅ banco no ar · ⏳ site |
| **5 · Volta atrás no Tiny** | ✅ escrito e testado — entrega do Sistema reabre sozinha (uma vez, sem eco ao Tiny); de pessoa só avisa a logística; erro vira alerta. ✅ banco no ar |
| **6 · 13787** | ✅ script escrito (`supabase/manutencao/2026-11-04_pedido_13787_entregue_por_engano.sql`) — ⏳ roda **depois** do banco no ar, com ensaio antes e o OK do dono. |

Arquivos: migration `supabase/migrations/20261104010000_plt_itens_novos_reabrir_entrega.sql`; scripts em `supabase/manutencao/2026-11-04_*`; telas `src/pedidos/FichaDoPedido.tsx`, `src/rotas/ModaisEntrega.tsx`, `src/paginas/EntregasDoDia.tsx`; bateria `supabase/testes/testar-migrations.mjs` (bloco SESSAO-44). **n8n: nada muda.**

## 3. Como testar (roteiro do dono — depois de subir)

**Frente 1 — 13797 (já no ar):** PCP → o pedido 13797 aparece no quadro → abrir → a janela mostra a Mesa L, o Armário Alto e o Armário Baixo como já liberados e oferece só o multiuso, o aéreo 3 portas e o balcão 3 portas, com "usar?" do estoque.

**Frente 2/3 — itens novos:** escolha um pedido de teste já liberado por completo → no Tiny, acrescente um item **no meio** da lista → em até 1 minuto: o pedido volta ao quadro do PCP; a janela oferece só o item novo; as peças que já estavam andando continuam com o mesmo móvel; o sino do PCP avisa "Pedido N ganhou itens no Tiny". Mude só o preço de um item → nada acontece. Tire um item que já tem peça → a peça continua; o sino avisa "item saiu com peça feita".

**Em rota:** pedido lançado para ROTAS → acrescente item no Tiny → volta ao PCP, continua na Programação, a logística recebe "Segure a entrega"; o PCP consegue liberar o novo.

**Frente 4 — reabrir:** como administrador, ficha de um pedido entregue ontem (ou entregue pelo Tiny) → botão **"Reabrir entrega"** → escolher o motivo → o pedido e as peças voltam; se havia peça do estoque, ela volta reservada para o pedido. Como logística, na mesma ficha: em vez do botão, a frase "…só um administrador reabre". Entrega parcial: a frase da parcial.

**Frente 5 — volta do Tiny:** pedido de teste → no Tiny, "Entregue" → a plataforma fecha → no Tiny, "Preparando envio" → em até 1 minuto a entrega reabre e a logística recebe "Pedido N voltou atrás no Tiny". Se a entrega tinha sido registrada **na plataforma** por alguém, nada reabre e chega só o aviso.

**Frente 6 — 13787 (depois de rodar):** a ficha do 13787 deixa de mostrar "entregue"; no PCP aparecem o Armário Aéreo 3 portas e o Balcão 3 portas para liberar; em Pedidos em aguardo aparecem o Armário Aéreo 2 portas e o balcão personalizado, prontos; os dois cards avulsos saem do quadro (ficam no histórico).

## 4. Verificação

- **Bateria do banco 2×:** **1.458 verdes nas duas rodadas** — todos verdes **menos 1 que já falha na main** sem esta sessão ("as 7 portas novas = as antigas", painel de vendas — provado com a bateria rodada na main em separado). Bloco novo: 14 conferências (item no meio, peça repetida barrada, só preço, item que saiu, em rota, volta do Tiny 1× com aviso repetido, peça do estoque volta reservada, admin × logística no Tiny e em outro dia, entrega de pessoa, Tiny já fora de "Entregue" não recebe nada, entregue + item novo = pendência só do novo, privilégios).
- **Front:** tipos e lint limpos, 360 testes verdes, o site compila.
- **Banco real (só leitura):** a conta das vagas do 13797 = 2 ms (+1,3 ms de plano), aquecida.
- **Não verificado ainda:** a atualização aplicada no banco real, os advisors e as telas no site publicado (depois de subir) — screenshot da ficha com "Reabrir entrega" fica para depois da publicação.

## 5. Desempenho (Lei — checklist)

- [x] **Requisições:** nenhuma tela ganhou requisição; a ficha e Entregas do dia decidem o botão/explicação com o que já recebiam.
- [x] **Sem polling, sem `postgres_changes`, sem relógio novo:** a reação aos itens nasce do fato (gatilho adiado na gravação do Tiny); a reavaliação da reserva usa a rodada que já existia.
- [x] **Portas tocadas** (custo por pedido, não cresce com o volume do banco — índices por pedido, por reserva e por código de produto): a conta das vagas 2 ms aquecida no banco real; a rodada das reservas calcula as vagas **uma vez por pedido** (antes seria uma por peça reservada); a sugestão "em produção" calcula uma vez (não por vaga); as contagens do kanban/todos os pedidos ficaram mais baratas (o frete é do próprio card, sem subconsulta).
- [x] **Índices:** a trava de peça virou índice único por (pedido, posição, unidade, código, descrição); o reabrir acha as peças da entrega pelo índice de tipo + hora.
- [x] **Escrita idempotente:** volta do Tiny repetida não reabre duas vezes; reação a itens com a mesma lista não grava nada; scripts de acerto param se algo mudou e não repetem.
- [ ] **Plano ×100 com volume semeado:** não feito nesta sessão (as portas novas custam por pedido); fica registrado como dívida pequena na lei se o dono quiser a medida formal.

## 6. Pendências que precisam do dono

1. ~~OK para subir a atualização do banco~~ ✅ subiu em 04/11 ~00:50; advisors sem nada novo.
2. **OK para publicar o site** (o botão "Reabrir entrega" e as explicações).
3. **OK para rodar o acerto do 13787** (depois do banco no ar; ensaio antes).
4. **ClickUp:** as 6 tarefas da demanda ainda não existem — criar com o OK do dono.
5. **A equipe liberar o 13797** (os 3 móveis novos).
6. **Conferir os pedidos 13620, 13689 e 13699** (entregues aqui e cancelados no Tiny) — fora do escopo, só a lista.
7. Se as 2 peças do estoque do 13787 (SKU 567 e 566) estiverem no galpão: a logística acerta pela contagem.

## 7. Decisões provisórias (no cofre: D-212 a D-216)

- Itens novos: gatilho adiado; em rota libera o que falta; entregue com o Tiny ainda "Entregue" não aparece no quadro do PCP (dívida — o PCP abre pelo aviso); card arquivado sem entrega não reage.
- Reabrir: administrador qualquer dia e a do Tiny; a "situação de antes" da entrega do Tiny vem do registro dos avisos dele (sem registro: "Enviado"); o Tiny só recebe se ainda "Entregue".
- Volta do Tiny: só "Cancelado" é encerramento ("Não entregue" reabre).
- Peça × item pelo produto; nenhum card renumerado.
- 13787: as 2 peças do estoque não voltam; os avulsos viram peças prontas na Expedição (exceção só deste acerto).

## 8. Numeração usada

Migration `20261104010000`; decisões D-212…D-216; aprendizados E-175…E-177, A-133…A-136. Seguinte: D-217 / E-178 / A-137.
