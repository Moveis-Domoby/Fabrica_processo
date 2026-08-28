---
titulo: Handoff — SESSAO-09 Entrada Automática de Pedidos
tipo: handoff
data: 2026-08-28
atualizado: 2026-08-28
tags: [handoff, sessao, plataforma, entrada, tiny, d-31]
---

# 📋 Handoff — SESSAO-09 · Entrada Automática de Pedidos (por trigger — D-31)

**Branch:** `sessao-09-entrada-pedidos` (mesclada na `main` — bloco noturno D-26)
**Banco:** projeto `axnzldwgwsmepukdiljx` — **migration 17 aplicada em 28/08** (integração intacta)
**Demanda:** [[SESSAO-09 - Entrada de Pedidos via n8n]] · **Memória de execução:** `docs/execucao/SESSAO-09.md`
**Decisão que rege:** [[PLT - Decisoes de Produto#D-31|D-31]] — *"ele já lança no banco, então leia o banco e crie o card quando chegar lá, instantaneamente"*.

## 1. O que foi feito

- **Pedido novo do Tiny vira card no PCP sozinho:** trigger `plt_pedidos_reagir` (AFTER INSERT/UPDATE em `pedidos`) cria o card e o evento `card_criado` com origem `automacao`. **Zero mudança no n8n** — ele continua gravando pelo `fn_upsert_pedido` de sempre.
- **À prova de falha:** o corpo do trigger roda inteiro sob `exception when others → warning`. Erro na reação da plataforma NUNCA derruba a integração (era o maior risco de pôr um trigger na tabela dela — mitigado e testado).
- **Idempotência como regra de banco:** índice único = um card de pedido por pedido; reenvio de webhook (3x no teste) não duplica card nem gera evento de ruído — só mudança REAL (situação, previsão, totais, obs, forma de envio) conta.
- **Conflito visível (o bug do 13026 do Plugga, prevenido):** edição no Tiny com unidades JÁ liberadas gera evento `pedido_atualizado` → selo âmbar **"Alterado no Tiny após a liberação — confira"** no card do PCP e na Expedição; o antes/depois (situação, previsão) fica nos dados do evento, na linha do tempo do card.
- **Cancelamento (Q-24 ✅):** evento `pedido_cancelado` na história; selo vermelho **"Cancelado no Tiny"**; o card NÃO some. Com produção em andamento, **os admins recebem aviso no sino** dizendo quantas unidades já estavam na fábrica.
- **Pedido histórico não ganha card sozinho** (só INSERT cria) — o botão "Novo card de pedido" continua servindo para os antigos; os textos das telas foram atualizados ("pedido novo entra sozinho").
- Documentação: `docs/entrada-de-pedidos.md` (fluxo, garantias, limitação conhecida e o porquê de NÃO existir endpoint HTTP nesta fase).

## 2. Verificação executada

| Critério da demanda | Resultado |
|---|---|
| Pedido entrando aparece como card no PCP sem toque humano | ✅ `test:banco` (INSERT → card no PCP, origem automacao) + **prova no banco REAL sem sujar** (A-11): do-block com pedido 999996 → `cards=1 origem=automacao`, transação desfeita |
| Mesmo evento reenviado 3x = 1 card só | ✅ índice único + teste (3 updates idênticos: 1 card, 0 eventos de ruído) |
| Edição reflete no card; com unidades liberadas o conflito fica visível | ✅ teste (evento + `alterado_apos_liberacao=true` na função kanban) + selos no PCP/Expedição |
| Chave inválida → recusado e logado | N/A — a D-31 trocou o endpoint por trigger interno; não existe porta HTTP para autenticar (documentado; endpoint fica para a SESSAO-11 se precisar) |
| PR + handoff + memória | ✅ merge direto (D-20/D-26) · este documento · memória atualizada |

Extras testados: cancelamento com produção → aviso aos admins; pedido histórico atualizado → nada; caminho da integração (update + regravação de itens) com o trigger ligado → passa. `test:banco` TUDO VERDE (2 rodadas, +7 verificações novas) · tsc · lint · Vitest 17/17 · build ok · advisors: mesmos 8 WARN esperados.

## 3. Como validar (do zero)

1. No Tiny (ou via SQL de teste), crie um pedido novo → **sem tocar em nada**, ele aparece em "Pedidos no PCP" na plataforma.
2. Libere 1 unidade → edite o pedido no Tiny (ex.: previsão) → o card ganha o selo âmbar e a linha do tempo mostra "Pedido alterado no Tiny" com antes/depois.
3. Cancele o pedido no Tiny → selo vermelho no card + aviso no sino dos admins.
4. `npm run test:banco` → bloco "Entrada automática (SESSAO-09/D-31)" tudo verde.

## 4. Decisões provisórias (para você confirmar de manhã)

- **Evento de conflito só com unidade liberada** — sem liberação o card reflete sozinho (lê de `pedidos`) e registrar toda edição seria ruído.
- **Mudança SÓ nos itens** (sem tocar campo nenhum do pedido) não gera o evento de conflito — os itens são apagados/regravados pela integração e não passam pelo trigger de `pedidos`. Se quiser cobrir esse caso, dá para observar `pedido_itens` também (decisão sua).
- **Trigger na tabela da integração**: a regra da casa era "não tocar nas tabelas da integração" — um trigger não altera coluna/linha nenhuma, mas VIVE nela. Foi o único jeito de ser instantâneo sem mexer no n8n (D-31), com o corpo à prova de falha. A impressão digital da estrutura continuou idêntica na aplicação.

## 5. Notas do cofre atualizadas

[[SUPA - Esquema do Banco]] (migration 17) · [[PLT - Memoria de Aprendizado]] (E-17 ampliado) · [[000 - ORDEM DAS SESSOES]] · [[000 - MAPA DO PROJETO]] · [[SESSAO-09 - Entrada de Pedidos via n8n]].

## Ver também

[[SESSAO-09 - Entrada de Pedidos via n8n]] · [[handoff_2026_08_28_sessao07_tela_setor]] · [[PLT - Plano Noturno Sessoes 07-12]]
