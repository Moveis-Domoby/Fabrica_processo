---
id: D-170
aliases: [D-170]
titulo: "\"Lançar direto para as entregas\" e \"Devolver\""
tipo: decisao
data: 2026-10-21
status: provisoria
revisa: []
revisada_por: []
complementa: []
area: [logistica-rotas]
tags: [decisao, area/logistica-rotas, provisoria]
---
# D-170 · ⏳ PROVISÓRIA (escolha do Claude — confirmar com o dono) — "Lançar direto para as entregas" e "Devolver" (21/10/2026)

- **Lançar para as entregas** = sair do stand-by e **as peças que ainda faltam ficam prontas na Expedição, sem passar pela produção** (a peça do estoque reservada pela venda é usada quando há) — a mesma maquinaria do "Concluído" do super admin ([[D-117 - PCP do super admin seletor de situacao do pedido e arquivar|D-117]]). O pedido fica "Pronto" e entra nos candidatos de rota (Programação). Pede confirmação (dois toques).
- **Recusado com peça na produção:** se alguma peça do pedido está num setor de produção, o lançar é recusado com a frase "N peças deste pedido estão na produção — espere ficarem prontas ou devolva o pedido para aguardando liberação" (a peça não é arrancada da produção).
- **Devolver para aguardando liberação** = sair do stand-by e voltar ao quadro de sempre (e às rotas).
