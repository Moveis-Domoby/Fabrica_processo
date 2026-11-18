---
id: D-268
aliases: [D-268]
titulo: "A Visão do dia conta o que o QUADRO mostra: a fila é a coluna da fila (com o card avulso), em execução é só quem trabalha agora (o pausado não aparece), a espera em horas de expediente, e \"prontos esperando rota\" são os candidatos da Programação"
tipo: decisao
data: 2026-11-06
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-042 - Dashboards guiados por imagem docs inspiracao dashboards e|D-42]]", "[[D-075 - O quadrinho do PCP na Visao do dia conta o que o quadro|D-75]]", "[[D-156 - A rota aceita QUALQUER pedido vivo o Lancar para ROTAS deixa|D-156]]", "[[D-172 - A regua do tempo util vem na abertura do app Lei 2 8|D-172]]"]
area: [tempos-paineis, kanban-producao]
tags: [decisao, area/tempos-paineis, area/kanban-producao]
---
# D-268 · ✅ DECIDIDA pelo dono — A Visão do dia conta o que o QUADRO mostra: a fila é a coluna da fila (com o card avulso), em execução é só quem trabalha agora (o pausado não aparece), a espera em horas de expediente, e "prontos esperando rota" são os candidatos da Programação (06/11/2026) — ↪️ D-42, D-75, D-156, D-172

**Achado (varredura de 06/11):** Limpeza "na fila 84" com o quadro mostrando 38 (o painel somava as colunas CANCELADO 44 e NÃO ENCONTRADO 4); "em execução agora 3" com os 3 pausados; as filas sem o card avulso (SECC 1×2, Fitamento 7×9, Furação 6×7); a espera mais antiga em dias corridos × o card em horas de expediente; "aguardando lançamento para ROTAS 16" com 4 já programados.

**Decidido (respostas do dono, 06/11):**
- **"Na fila" = só a coluna da fila de cada setor, como o quadro** (*"Só a coluna da fila"*): a peça e o card avulso, sem ninguém trabalhando; as colunas de estacionar (CANCELADO, NÃO ENCONTRADO) não entram em número nenhum do painel. Card ainda sem coluna (setor sem etapas) espera — conta na fila.
- **"Em execução" = só quem está trabalhando agora** (*"Pausado não aparece"*): o pausado não conta em lugar nenhum do painel (nem a pessoa dele em "em N pessoas").
- **A espera mais antiga em horas de expediente**, como o card no quadro (a mesma régua do setor; "29h 10min", sem "dias").
- **"Pedidos prontos esperando rota"** (era "Pedidos completos aguardando lançamento para ROTAS") = os candidatos da Programação prontos e ainda sem programação — desde a [[D-156 - A rota aceita QUALQUER pedido vivo o Lancar para ROTAS deixa|D-156]] o lançamento não é passo; o programado já tem rota.

**Descartadas:** pausados à parte ("3 pausados"); mostrar também "parados em outras colunas".

**Como ficou (técnico):** migration `20261106030000` — `plt_fn_dash_agora` (peça + avulso; fila = `eh_fila`, ou sem coluna; rodando = executor e `pausado_em is null`) e `plt_fn_dash_dia` (`aguardando_lancamento` = `vw_pedidos_para_rota` pronto e sem programação); retornos iguais. A tela converte a espera pela régua (`lido_em − espera` = a chegada do mais antigo). O ensaio amarra painel = quadro e painel = Programação.
