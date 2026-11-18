---
id: D-25
aliases: [D-25, D-025]
titulo: "Qualidade nas transições: detalhes de execução"
tipo: decisao
data: 2026-08-27
status: revisada
revisa: []
revisada_por: ["[[D-126 - A marcacao do estado da peca perfeito atencao danificado vira|D-126]]"]
complementa: []
area: [kanban-producao]
tags: [decisao, area/kanban-producao]
---
# D-25 · Qualidade nas transições: detalhes de execução (27/08/2026)

**Decidido (respostas do dono no início da SESSAO-06):**

- **Notificação de 🟡/🔴/divergência:** vai para os **líderes dos DOIS setores** (o que entregou e o que recebeu) **+ todos os admins**.
- **Etapa DANIFICADO:** o sistema **garante uma etapa especial "DANIFICADO" em cada setor**, criada automaticamente (exceção de sistema à [[D-014 - Etapas internas cadastro livre cada uma com timer proprio|D-14]] — não é chute de etapa operacional, é infraestrutura do fluxo de qualidade).
- **Saída do PCP não é transição de qualidade:** liberar unidade do PCP não exige marcação (a peça ainda nem foi produzida) e a primeira chegada não pede parecer.
- **Chegada em terminal:** ROTAS aceita o registro unilateral de quem entrega. **ESTOQUE notifica os admins e a logística** — como a logística ainda não existe como entidade na plataforma (o PCP é a logística — [[D-022 - Kanban liberacao parcial destino livre PCP com visao completa|D-22]]), notifica os admins e a parte da logística **fica no planejamento** para quando existir.
- **API não participa do fluxo de qualidade:** a única chegada de card por API é em **PCP ou ROTAS** — então chegada via API não exige marcação nem parecer (reafirma RF-86/Q-19).
- **Movimentação de etapa dentro do MESMO setor não exige qualidade** — a [[D-009 - Qualidade em 3 estados em TODA transicao com dupla atestacao|D-09]] vale só para transição entre setores.

**Descartadas:** etapa DANIFICADO cadastrada manualmente pelo dono (letra c); card danificado ficar parado onde está sem etapa própria (letra b).
