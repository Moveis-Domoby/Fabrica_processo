---
titulo: "PROMPT — Bloco 2 (jornada até a SESSAO-10) para o Claude Code"
tipo: prompt
data: 2026-08-27
atualizado: 2026-08-27
tags: [plataforma, prompt, claude-code, bloco2]
---

# PROMPT — Bloco 2 (jornada até a SESSAO-10)

> [!important] Formato dos prompts (D-17)
> Prompt do Claude Code é **mínimo**: só o caminho. Tudo o que ele precisa saber já está no cofre. Uma sessão por conversa, checkpoint com o dono ao fim de cada (D-10/D-16).

## Escopo do bloco (fechado em 27/08/2026, na entrega da SESSAO-04)

O Bloco 2 **encerra o que restou do Bloco 1** (SESSAO-13 e SESSAO-05, que são pré-requisito de quase tudo) e segue a **ordem oficial** de [[000 - ORDEM DAS SESSOES]] até a API completa:

| # | Sessão | Entrega | Por que nessa posição |
|---|---|---|---|
| 1 | [[SESSAO-13 - Entrada de Pedidos via n8n]] | pedido do Tiny vira card no PCP sozinho | D-11 — daqui em diante todo teste roda com pedido fluindo sozinho |
| 2 | [[SESSAO-05 - Timers e Eventos de Tempo]] | fila (do setor) vs execução (da pessoa) | a razão de existir da plataforma; 06, 07, 08 e 10 dependem dela |
| 3 | [[SESSAO-06 - Qualidade nas Transicoes]] | 3 estados + dupla marcação (D-09) | pluga na movimentação que a SESSAO-04 entregou |
| 4 | [[SESSAO-07 - Tela do Setor Tablet]] | a tela do chão de fábrica (fila, PIN, botões grandes) | depende dos timers |
| 5 | [[SESSAO-08 - Dashboards e Visualizacoes Salvas]] | produtividade + qualidade, views salvas | depende de 06 e 07 |
| 6 | [[SESSAO-09 - Tarefas e Delegacao]] | meus afazeres, delegação aleatória e direta | depende só de 04 |
| 7 | [[SESSAO-10 - API Aberta e Integracao n8n]] | API completa: CRUD/mover, chaves, webhooks, ponte ROTAS | fecha a jornada |

⚠️ **As demandas estão `🔶 rascunho`** — cada sessão abre listando as dúvidas de negócio e só coda depois do OK do dono (foi assim na SESSAO-04 e funcionou). Reordenar dentro do bloco é permitido até a sessão virar `🔨` (regra do índice).

## Prompt pronto para colar (conversa nova por sessão)

```
Leia e siga: C:\Users\wccau\Domoby\Domoby - fabrica\_docs\Plataforma\CLAUDE - Regras do Claude Code (repo).md

Bloco 2 = jornada até a SESSAO-10 (ver PROMPT - Bloco 2 no cofre), uma sessão por vez, checkpoint comigo ao fim de cada.
Comece pela SESSAO-13. Antes de codar, traga entendimento + dúvidas.
```

Nas conversas seguintes, muda só a linha da sessão da vez (ex.: "SESSAO-13 já entregue — comece pela SESSAO-05").

## Ver também

[[000 - ORDEM DAS SESSOES]] · [[PROMPT - Bloco 1 (Sessoes 01 a 05)]] · [[PLT - Decisoes de Produto]] · [[handoff_2026_08_27_sessao04_kanban]]
