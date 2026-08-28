---
titulo: "SESSAO-09 — Entrada de Pedidos via n8n (API mínima)"
tipo: demanda
status: entregue
data: 2026-08-24
atualizado: 2026-08-24
tags: [plataforma, demanda, sessao, api, n8n]
---

# 🎯 SESSAO-09 — Entrada de Pedidos via n8n (API mínima)

> [!success] ✅ Entregue em 28/08/2026 (bloco noturno D-26) — [[handoff_2026_08_28_sessao09_entrada_pedidos]]
> **↩️ Executada no desenho da D-31** (resposta do dono no aval do bloco): em vez de endpoint chamado pelo n8n, a plataforma **lê o próprio banco** — trigger à prova de falha em `pedidos` cria/reage instantaneamente. O critério "chave inválida recusada" ficou N/A (não existe porta HTTP nesta fase; documentado em `docs/entrada-de-pedidos.md`).

> [!info] Por que esta sessão existe (D-11)
> O dono quer dado real fluindo desde cedo: **pedido novo no Tiny vira card no PCP sozinho**, com o n8n empurrando para a plataforma (a plataforma NÃO busca nada no Tiny — só recebe). É a antiga primeira metade da SESSAO-11, antecipada. ~~Executa logo após a SESSAO-04 (Kanban).~~ A API completa (CRUD, webhooks de saída, ponte ROTAS) continua na SESSAO-11, mais tarde.
>
> **↩️ Reposicionada em 27/08/2026 (D-23):** a antecipação caiu — enquanto a plataforma não está no ar, a criação manual de card no PCP (entregue na SESSAO-04) atende. Esta sessão agora **executa logo após a SESSAO-08 (Publicação no Ar)**, quando criar card na mão para ~10 pedidos/dia viraria fardo de verdade. O conteúdo abaixo continua valendo como está.

## O que é

O caminho de entrada: endpoint(s) autenticado(s) que o n8n chama quando o pedido entra/atualiza no Tiny, criando/atualizando o card de pedido no PCP.

## Requisitos cobertos

RF-03 (completo) · RF-50 (parcial: só entrada) · RF-51 (parcial).

## Decisões que regem

D-11 (n8n empurra; plataforma recebe) · D-08 (o pedido já chega ao Supabase via P15 — avaliar com o dono se o card nasce por trigger no banco ou por chamada do n8n ao endpoint; documentar a escolha e o porquê) · D-01 (card de pedido no PCP; unidades só quando o PCP liberar) · regras críticas 2–4 do CLAUDE.md.

## Comportamento esperado

- **Endpoint de entrada** com chave de API simples (gerada manualmente nesta fase; a gestão completa de chaves fica para a SESSAO-11/12): criar card de pedido no PCP com os dados que o n8n já tem (número, cliente, itens, previsão, observações).
- **Idempotente:** o mesmo pedido chegando duas vezes (reenvio do Tiny/n8n) NÃO duplica card — atualiza o existente. (Lição E-01/A-03 do cofre: o Tiny reenvia webhooks.)
- **Atualização de pedido** (cliente editou no Tiny): card do PCP reflete; se as unidades já foram liberadas, registrar o conflito de forma visível no card (não sobrescrever silenciosamente o que já está em produção — foi exatamente o bug do pedido 13026 no Plugga).
- **Cancelamento:** comportamento mínimo a confirmar com o dono na sessão (Q-24) — sugestão: card marcado "cancelado", sem sumir.
- Eventos de criação/atualização via API registram autor "integração n8n" (append-only).
- Workflow n8n de exemplo documentado (nó a nó, sem credencial) para o dono plugar no fluxo Tiny existente.

## Perguntar ao dono no início da sessão

- Trigger no banco vs chamada do n8n (documentar prós/contras medidos — X-03 da memória).
- Q-24 (cancelamento) — comportamento mínimo desta fase.
- Quais campos do pedido o PCP precisa ver no card (aproveitar as 49 colunas já mapeadas? só um subconjunto?).

## Fora do escopo

Webhooks de saída · CRUD completo via API · ponte ROTAS · gestão de chaves no admin (tudo isso é SESSAO-11) · mover cards via API entre setores (depende da Q-19 de qualidade).

## Critérios de aceite

- [ ] Pedido de teste entrando pelo fluxo Tiny/n8n aparece como card no PCP sem toque humano.
- [ ] O mesmo evento reenviado 3x resulta em 1 card só.
- [ ] Edição de pedido no Tiny atualiza o card; com unidades liberadas, o conflito fica visível.
- [ ] Chave inválida → recusado e logado.
- [ ] PR + handoff + memória de aprendizado atualizada.
