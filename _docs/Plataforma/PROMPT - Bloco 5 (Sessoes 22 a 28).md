---
titulo: "PROMPT — Bloco 5 (Sessões 22→28) para o Claude Code"
tipo: prompt
data: 2026-09-21
atualizado: 2026-09-21
tags: [plataforma, prompt, claude-code, bloco5]
---

# PROMPT — Bloco 5 (Sessões 22→28)

> [!important] Formato dos prompts (D-17)
> Prompt do Claude Code é **mínimo**: só o caminho. Tudo o que ele precisa saber já está no cofre. Uma sessão por conversa, checkpoint com o dono ao fim de cada (D-10).

## Escopo do bloco (18/09/2026 — [[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]])

Sete sessões, na ordem oficial de [[000 - ORDEM DAS SESSOES]]. A história do bloco: **kanban honesto → painel pessoal → estoque de verdade → Tiny da fábrica → conversa → automação → rota real.**

| # | Sessão | Entrega |
|---|---|---|
| 1 | [[SESSAO-22 - Producao - Filas Reais Tempo de PCP e Paginacao]] | filas reais (fim da "Chegada"), tempo de PCP verdadeiro, 10 cards + "Ver mais", regra "cada tela requisita só o que mostra", 1 pedido por vez + pausa por líder |
| 2 | [[SESSAO-23 - Meu Painel 2 - Filas Pessoais Subtarefas e Tempos]] | Delegados a mim / Meus afazeres / Fila de prioridade, subtarefas, tempos com a visibilidade certa |
| 3 | [[SESSAO-24 - Estoque Nucleo - Aguardo Cancelamentos e Alocacao]] | Concluir produção → Pedidos em aguardo (Ver pedidos/Ver itens), 3 fluxos de cancelamento, alocação sugerida no PCP |
| 4 | [[SESSAO-25 - Integracao Tiny Fabrica - Estoque e Minimos]] | integração NOVA: estoque do Tiny da fábrica alimenta o app, venda da loja debita, mínimo/saldo/necessidade |
| 5 | [[SESSAO-26 - Chat Interno]] | `/inicio/chat` + balão arrastável; canais, particulares, avisos gerais, aniversários |
| 6 | [[SESSAO-27 - Automacoes em Canvas]] | canvas de automações (absorve a 17); mover card revisa a D-03 |
| 7 | [[SESSAO-28 - Rota Calculada no Mapa]] | rota OSRM real partindo da fábrica |

A **SESSAO-21 (cutover)** corre fora do bloco, na janela que o dono definir.

⚠️ Cada demanda já traz a seção "Perguntar ao dono no início da sessão" — a sessão abre com entendimento + essas dúvidas e **só coda depois do OK do dono**.

## Prompt pronto para colar (conversa nova por sessão)

```
Leia e siga: C:\Users\wccau\Domoby\Domoby - fabrica\_docs\Plataforma\CLAUDE - Regras do Claude Code (repo).md

Bloco 5 = Sessões 22 → 23 → 24 → 25 → 26 → 27 → 28 (plano em _docs\Planejamento\002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes.md), uma sessão por vez, checkpoint comigo ao fim de cada.
Comece pela SESSAO-22. Antes de codar, traga entendimento + as perguntas que a demanda lista.
```

Nas conversas seguintes, muda só a linha da sessão da vez (ex.: "SESSAO-22 já entregue — comece pela SESSAO-23").

## Ver também

[[000 - ORDEM DAS SESSOES]] · [[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]] · [[PROMPT - Bloco 2 (Sessoes 05 a 09)]] · [[handoff_2026_09_18_sessao16_dashboards]]
