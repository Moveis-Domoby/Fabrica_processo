---
id: D-87
aliases: [D-87, D-087]
titulo: "Liga/desliga da reposição automática no Painel admin = agendar/desagendar a rotina de verdade; desligada, a logística tem o \"Lançar para produção\""
tipo: decisao
data: 2026-09-30
status: revisada
revisa: []
revisada_por: ["[[D-186 - Lancar qualquer movel para producao a qualquer momento|D-186]]"]
complementa: ["[[D-054 - O fluxo do estoque so peca pronta perfeita e sem pedido|D-54]]"]
area: [pcp, estoque]
tags: [decisao, area/pcp, area/estoque]
---
# D-87 · Liga/desliga da reposição automática no Painel admin = agendar/desagendar a rotina de verdade; desligada, a logística tem o "Lançar para produção" (30/09/2026) — ↪️ o fluxo da reposição da D-54

**Decidido (demanda + resposta 4 do dono):**

- O botão (Painel admin → **Estoque**, só admin) **agenda e desagenda o job no relógio do banco**: desligada, a rotina NÃO existe — nenhuma consulta, nenhuma execução à toa (a lição da migration 43). A situação que a tela mostra é o próprio relógio (o job existe?).
- **Com a automática desligada**, o cartão em necessidade ganha o **"Lançar para produção"**: a logística cria a reposição no PCP à mão (gesto com autor e trilha), quantidade proposta = mínimo − estoque − o que já vem para o estoque, editável. **Com ela ligada, o botão some** (resposta 4: *"não faz nem sentido aparecer"*).
- A automática agora **desconta o que já vem para o estoque** na conta e no tamanho do card (antes não descontava a produção em andamento).
- **Entregue DESLIGADA** — só liga depois da contagem inicial da logística (senão todo o Top X pede reposição de uma vez). ↪️ **01/10 ([[D-090 - Reposicao automatica e escolha da operacao nao pendencia|D-90]]):** ligar ou não é escolha da operação, não pendência do dono.
