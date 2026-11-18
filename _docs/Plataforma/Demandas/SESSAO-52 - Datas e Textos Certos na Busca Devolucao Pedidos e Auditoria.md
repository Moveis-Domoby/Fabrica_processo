---
titulo: "SESSAO-52 — Datas e textos certos na busca, na devolução, na lista de pedidos e na Auditoria"
tipo: demanda
status: ⏳ pronta no ramo, esperando o dono (18/11/2026 — mesa da fila; nada no banco de produção, nada na main)
data: 2026-11-18
atualizado: 2026-11-18
origem: achados fora do escopo registrados no handoff da SESSAO-47 (item 6 das pendências). Pedido gravado pela fila do Escritório em `_escritorio/handoffs/sessao-52-datas-e-textos-certos-prompt-claude-code.md`.
revisa: ↩️ D-283 item 5 (a lista de pedidos mostrava a hora do fim do expediente quando o dia era escolhido) · ↩️ D-289 item 10 (o antes/depois da configuração do painel aparecia com os nomes internos) · ↪️ cumpre D-276 item 4 (a data escolhida vale em toda a plataforma), D-278 (o dia passado aparece sem hora), D-134 (a lista diz o dia e a hora em que foi dado como entregue), D-27/D-95 (nada de código na tela)
tags: [plataforma, demanda, pedidos, busca, devolucao, auditoria, entregas]
---

# 🎯 SESSAO-52 — Datas e textos certos na busca, na devolução, na lista de pedidos e na Auditoria

> **Não linkada na Ordem das Sessões** (regra desta leva: as notas grandes do cofre estão com a SESSAO-49 — a dieta da documentação).

## O que é

Quatro defeitos achados na SESSAO-47 e deixados para depois. Não pedem decisão do dono — a regra já existe: desde a SESSAO-47, **uma data de entrega só** vale em toda a plataforma, o dia real guardado no card do pedido; e código interno nunca aparece na tela.

## Requisitos cobertos

RF da rastreabilidade (a busca geral), da área Pedidos, da devolução e da Auditoria — sem requisito novo: é correção do que já existe.

## Decisões que regem esta demanda

- **D-276** — a data da entrega é uma só (a projeção no card do pedido) e vale em toda a plataforma; o dia é sempre o do fuso da fábrica.
- **D-278** — a entrega marcada num dia passado aparece como "no dia dd/mm/aaaa", sem hora (a hora guardada é a do fim do expediente).
- **D-281** — a correção do dia é um registro novo; a entrega original não é editada.
- **D-134** — a linha da lista de Pedidos diz o dia e a hora em que o pedido foi dado como entregue, e por quem.
- **D-188** — a busca geral diz onde cada card está ("Entregue em dd/mm").
- **D-129** — a telinha "Decidir situação" da devolução traz o histórico da entrega.
- **D-27 / D-95** — nada de código interno em texto de interface; a Auditoria fala em frase de gente.
- **D-283 item 5** e **D-289 item 10** (provisórias da SESSAO-47) registravam os defeitos 3 e 4 como limitação conhecida — esta demanda as revisa.

## Comportamento esperado

1. **Busca geral** — a peça (e o card do pedido) que saiu com a entrega diz "Entregue em dd/mm" pelo **dia real da entrega**, o mesmo da ficha — não pelo dia em que a peça foi arquivada (o dia do registro). Entrega marcada hoje como "entregue ontem" → a busca diz ontem. Dia corrigido pelo admin → a busca diz o dia corrigido.
2. **Detalhe da devolução** ("Decidir situação") — no histórico da entrega, a linha "Entregue" mostra o **dia vigente**: se o admin corrigiu a data, aparece o dia corrigido, não o antigo. Quando o dia foi escolhido ou corrigido, aparece só o dia (sem a hora do fim do expediente).
3. **Lista de pedidos** — entrega registrada no próprio dia: "Entregue dd/mm/aaaa às hh:mm por Fulano", como sempre. Dia escolhido ("Marcar como entregue no dia…") ou corrigido: **"Entregue no dia dd/mm/aaaa por Fulano"**, sem a hora do fim do expediente, e com a hora real do registro à mão ("registrado em … às …"), igual à ficha.
4. **Auditoria** — a linha "Mudou a configuração do painel de tempos" mostra o antes e o depois **em português do galpão** ("Gráfico da TV: barras com o total"), nunca com os nomes internos das opções. Vale também para os registros antigos (a tradução é feita na leitura; a trilha não é reescrita).

## Fora do escopo

- Rotas (Programação, Expedição, Entregas do dia), Comercial, dashboards e configurações — são de outras mesas desta leva.
- Qualquer mudança de regra da entrega (quem pode corrigir, o que o Tiny recebe, o desfazer).
- Reescrever registros antigos da trilha.
- As notas grandes do cofre (Decisões de Produto, Memória de Aprendizado, Esquema do Banco, Lei de Desempenho, Mapa do Projeto, Ordem das Sessões, Próximos Passos) — o que for para elas fica no diário e na seção "Para entrar nas notas depois da dieta" do handoff.

## Critérios de aceite

- [x] Os 4 pontos corrigidos, cada um com teste (de tela ou do banco) que prova a regra da data única. *(bateria: 20 conferências; telas: 15 testes)*
- [x] Nenhuma tela nova fazendo leitura a mais (lei de desempenho). *(a lista de pedidos trocou de porta, não ganhou chamada)*
- [x] Celular (375) e tablet (768) sem rolagem lateral nas telas tocadas. *(medido nas 4 telas, com dados de exemplo)*

## Notas para o Claude Code

- **O dono está dormindo:** sem perguntas de negócio; o que faltar vira decisão provisória registrada no diário e no handoff. `bloqueado` só se depender de decisão de produto que ainda não existe.
- **Banco:** só em arquivo de migration (sem acesso ao banco vivo); cada função recriada a partir da última versão nas migrations; numeração a partir de `20261118100000_`; faixas novas na bateria de testes, ditas no reporte; o que precisar ser conferido no banco vivo vai para "Para ligar com o dono".
- **Pontos de partida:** `src/busca/ondeEsta.ts` e a porta da busca; `src/pedidos/PaginaPedidos.tsx`; `src/auditoria/rotulos.ts`.
- **Ciclo do CLAUDE.md:** task list espelhando a demanda; diário contínuo em `Execucao/SESSAO-52.md`; commits pequenos; lint, build e testes (falha que já existia, só registrar); plano ×100 das portas novas ou tocadas, quando der para medir.
- **Nada, em hipótese alguma:** push, merge, trocar para a main, aplicar migration, publicar, n8n, credencial.
- **Handoff em `_docs/Handoffs/`** com: como testar passo a passo; "Para ligar com o dono" (as migrations a aplicar, em ordem, com conferência antes e depois); as decisões provisórias; "Para entrar nas notas depois da dieta".

## Leitura da sessão

Lido antes de codar (18/11, madrugada): o CLAUDE.md da mesa; o pedido (duas vezes); o handoff da SESSAO-47 (de onde os achados vêm) e a demanda/diário da SESSAO-51 (a última entregue); a Memória de Aprendizado e a Lei de Desempenho (inteiras, por leitura delegada com devolução das lições e do checklist que tocam este trabalho); as Decisões de Produto (inteiras, idem — D-27, D-95, D-107, D-129, D-134, D-188, D-276…D-289, D-324, D-328) e as Perguntas em Aberto (nenhuma toca o assunto); o template da demanda; e, no código, a última versão de cada função tocada (`plt_fn_busca_cards` em `20261111010000`, `plt_fn_devolucao_detalhe` em `20261027040000`, `plt_fn_pedidos_lista` em `20261116020000`, a entrega no dia real em `20261109030000`, a configuração do painel em `20261109040000`). O Esquema do Banco foi consultado pelos `create`/`alter` das migrations (as colunas usadas: `plt_cards.entrega_em`, `entrega_evento_id`, `parcial_em`, `parcial_evento_id`; `plt_eventos.ocorrido_em`, `registrado_em`, `evento_referencia_id`, `dados`).

## Tarefas no ClickUp (lista PRODUÇÃO do DPTO TI)

- [Pedidos - Datas e textos certos na busca, na devolução, na lista de pedidos e na Auditoria](https://app.clickup.com/t/17tya50wqt4) — a mesa da fila **não mexe no ClickUp** (regra do modo fila): quem move e conclui é o dono.

## Resultado (18/11/2026, madrugada)

- **Feito, no ramo `sessao-52-datas-e-textos-certos`** (nada no banco de produção, nada na main, ClickUp não tocado): os 4 pontos, com as provas do banco (20 ✔; bateria inteira 1.893 ✔ + 1 ✘ conhecido, o painel de vendas), os testes das telas, o ensaio ×100 e 12 fotos. Handoff: [[handoff_2026_11_18_sessao52_datas_e_textos_certos]] · diário: `Execucao/SESSAO-52.md`.
- **O que mudou de rota:** a lista de pedidos não ganhou coluna na porta antiga (tabela fixa que cinco migrations recriam) — ganhou a porta `plt_fn_pedidos_pagina`, que devolve a mesma lista com a hora do registro. Migration `20261118100000` (só leitura), **a aplicar antes de publicar o site**.
- **Pende do dono:** aplicar a migration e publicar; confirmar as decisões provisórias; os achados fora do escopo (a ficha com a correção para o mesmo dia do registro; o card do pedido entregue na busca; os outros antes/depois da Auditoria).
