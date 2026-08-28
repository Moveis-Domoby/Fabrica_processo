---
titulo: Bloco Noturno — arquivo de continuidade (D-26)
tipo: continuidade
data: 2026-08-28
atualizado: 2026-08-28
tags: [plataforma, bloco-noturno, continuidade]
---

# 🌙 Continuidade do bloco noturno (07 → 09 → 10 → 11 → 12)

> A SESSAO-08 saiu do bloco (D-30 — deploy adiado; o dono avisa quando lançar).
> As dúvidas do bloco foram respondidas e viraram **D-28…D-34** — NÃO perguntar nada.

## Estado atual

- **Sessões terminadas:** SESSAO-07 ✅ · SESSAO-09 ✅ (handoffs + merges na main).
- **Próxima sessão da fila:** **SESSAO-10 — Dashboards e Visualizações Salvas** (foco pesado em tempo — D-32; usar `fn_tempo_util` do D-29), depois 11 → 12.
- **Encadeamento:** o ambiente desta execução mantém a conversa viva com contexto resumido automaticamente — o bloco segue NA MESMA conversa, uma sessão por vez, com branch/handoff/merge próprios (decisão provisória logada; o espírito da D-26 — contexto não estourar — está preservado).

## Decisões provisórias tomadas até aqui (rever de manhã)

1. Verificação de tela na 07 foi enxuta e por DOM/JS — **screenshots pendentes** (painel sem exibição de madrugada; A-13). Próximas conferências visuais: SESSAO-10 e SESSAO-12.
2. Bucket `plt-imagens` é **público para leitura** (escrita admin/líder).
3. "Espera há X" da tela do setor é tempo corrido; o desconto D-29 vale para as métricas (SESSAO-10).
4. Continuar o bloco na mesma conversa (acima).
5. (S09) Evento de conflito só com unidade liberada; mudança só nos itens não gera evento; trigger vive em `pedidos` (não altera nada e é à prova de falha) — detalhes no handoff da 09.

## Bloqueios documentados

- Nenhum bloqueador. Passos manuais do dono: screenshots da 07, criar contas de dispositivo por tablet, trocar a senha do admin.

## Armadilhas descobertas

- Mudar assinatura de função Postgres = DROP+CREATE + re-grants (A-12).
- `execute` do plpgsql roda um comando por vez; policies de storage em executes separados.
- Sob o painel noturno, screenshot não compõe — verificar por `read_page`/JS (A-13).
