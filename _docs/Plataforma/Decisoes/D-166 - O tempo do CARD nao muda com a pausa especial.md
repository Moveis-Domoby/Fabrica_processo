---
id: D-166
aliases: [D-166]
titulo: "O tempo do CARD não muda com a pausa especial"
tipo: decisao
data: 2026-10-21
status: provisoria
revisa: []
revisada_por: []
complementa: []
area: [tempos-paineis]
tags: [decisao, area/tempos-paineis, provisoria]
---
# D-166 · ⏳ PROVISÓRIA (escolha do Claude — confirmar com o dono) — O tempo do CARD não muda com a pausa especial (21/10/2026, SESSAO-38 · F4)

- A linha do tempo do card e a seção "Tempo e histórico" da janela **não mudaram** (outra frente vai refazer o tempo do card). Hoje o tempo de execução do card já desconta toda pausa; a pausa especial aparece na história como qualquer pausa, com o motivo.
- **Recomendação para a frente do tempo do card:** mostrar a pausa por motivo especial como "parada por causa externa" (máquina, peça, pedido do líder) separada das pausas comuns no total "parado" do card — é tempo que o card esperou por algo de fora, útil para achar gargalo de máquina/abastecimento. A marca está em `plt_motivos.especial` (o motivo do fato está em `dados.motivo_id`); a do momento do gesto está em `plt_pessoa_pausas.especial`.
