---
id: D-85
aliases: [D-85, D-085]
titulo: "Reposição parada 2 dias úteis da FÁBRICA (seg–sex) no PCP sai sozinha — o Sistema assina; parcial vence só a parte parada"
tipo: decisao
data: 2026-09-30
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-076 - O Tiny sobe a plataforma vale o saldo SOMADO das duas|D-76]]"]
area: [pcp, estoque]
tags: [decisao, area/pcp, area/estoque]
---
# D-85 · Reposição parada 2 dias úteis da FÁBRICA (seg–sex) no PCP sai sozinha — o Sistema assina; parcial vence só a parte parada (30/09/2026) — ↪️ a segunda saída, ao lado do "estoque coberto" da D-76

**Decidido (demanda + resposta 7 do dono):** se em 2 dias úteis o que está no PCP não sair para a produção, a parte parada sai do PCP e deixa de contar como reservada — vale igual para a reposição lançada à mão.

- **O prazo:** vence à meia-noite (de Fortaleza) depois do 2º dia útil da fábrica (seg–sex) seguinte à criação — criada na segunda vence quinta 00:00; criada na sexta ou no sábado, o fim de semana não conta. Sem feriados.
- **Parcial:** o que já entrou na produção segue produzindo e contando; só a parte parada vence. A saída é por **evento** (origem da integração, sem pessoa — o Sistema assina), nada se apaga.
- **Depois de vencida, a necessidade volta sozinha** — sem exigir movimento novo do estoque (diferente do "Não produzir" do PCP, que continua exigindo).
- **Dupla garantia:** as contas da tela já ignoram a parte vencida na hora; uma rotina leve de hora em hora (`plt-estoque-vencimentos`) faz a saída oficial. A rotina é **independente** do liga/desliga da reposição automática (a manual também vence).
