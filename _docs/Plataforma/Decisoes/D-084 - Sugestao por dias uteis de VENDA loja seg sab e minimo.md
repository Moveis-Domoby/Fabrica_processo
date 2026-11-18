---
id: D-84
aliases: [D-84, D-084]
titulo: "Sugestão por dias úteis de VENDA (loja seg–sáb) e mínimo AUTOMÁTICO que trava ao editar; corte de pedido fora do comum"
tipo: decisao
data: 2026-09-30
status: vigente
revisa: ["[[D-072 - Minimo e capacidade do galpao na plataforma a sugestao|D-72]]"]
revisada_por: []
complementa: []
area: [estoque]
tags: [decisao, area/estoque]
---
# D-84 · Sugestão por dias úteis de VENDA (loja seg–sáb) e mínimo AUTOMÁTICO que trava ao editar; corte de pedido fora do comum (30/09/2026) — ↩️ revisa a D-72

**Decidido (demanda + respostas do dono em 30/09):** a loja vende de segunda a sábado; a fábrica funciona de segunda a sexta (resposta 1). Cobertura personalizada de 1 a 8 semanas (resposta 2).

- **Fórmula:** vendidos nos 90 dias ÷ dias úteis de venda decorridos (seg–sáb, ~78) × 6 (os dias úteis de uma semana de venda) × semanas de cobertura (1 · 2 · 3 · personalizada 1–8; padrão 2), **arredondada para cima no fim**. Exemplo conferido com o dono: 96 vendidos → 15 para 2 semanas. Sem tabela de feriados (decisão do dono).
- **Mínimo automático:** acompanha a sugestão sozinho — recalcula ao trocar cobertura/Top X/corte e 1×/dia de madrugada (a janela dos 90 dias anda todo dia). **Editar à mão TRAVA** naquele valor até "voltar ao automático". O "Usar todas as sugestões" morreu. Os mínimos definidos antes desta decisão entraram no automático (editar de novo trava).
- **Corte de pedido fora do comum:** linha de pedido com MAIS unidades que o corte (padrão 10; Painel admin, só admin, com trilha) sai da conta de vendas — **do ranking E da sugestão** — como se o pedido não existisse. O pedido de 23 closets sai. O cartão avisa discreto: "1 pedido grande fora da conta".

**Como ficou (técnico):** migration 45 — `fn_vendas_90d` aplica o corte na fonte (regra única), `fn_sugestoes_minimo` por dias úteis, `produtos.minimo_travado`, `fn_recalcular_minimos` (cron diário `plt-estoque-minimos` + nas trocas de configuração).
