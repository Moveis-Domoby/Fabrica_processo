---
id: D-300
aliases: [D-300]
titulo: "Remover do PCP: só a parte do PCP muda"
tipo: decisao
data: 2026-11-11
status: provisoria
revisa: []
revisada_por: ["[[D-307 - Cancelar pedido e Ocultar do PCP no lugar do Remover do PCP|D-307]]"]
complementa: ["[[D-299 - A aba Cancelados e removidos volta para dentro do PCP|D-299]]"]
area: [pcp]
tags: [decisao, area/pcp, provisoria]
---
# D-300 · ⏳ PROVISÓRIA — Remover do PCP: só a parte do PCP muda (11/11/2026, SESSAO-48 — a regra é da demanda; os detalhes são escolhas da sessão) — ↪️ D-299

1. **Não mexe nas peças reservadas do estoque** para o pedido (a demanda não fala; "só a parte do PCP muda"). Se o Tiny cancelar depois, o caminho de sempre as solta; devolvido, continuam reservadas.
2. **O pedido cancelado no Tiny também pode ser removido** (nada muda no Tiny; na aba aparece uma vez só). Devolvê-lo tira a marca de removido, mas o Tiny o mantém fora do quadro — a tela diz isso, e o botão "Devolver ao PCP" só aparece quando o pedido volta de verdade.
3. **"Devolver ao PCP" não reabre o aviso:** o pedido volta a "Aguardando liberação" com as vagas abertas e o PCP libera pela janela de sempre.
4. **O texto obrigatório** ("O que houve?" e "Outro motivo") tem 3 letras ou mais, como o "Outro" do stand-by.
5. **(supervisor) Removido vale antes de "em produção":** na lista de Pedidos o pedido removido aparece como "Removido do PCP" mesmo com peça dele em produção ou pronta (só "em rota", entregue, devolvido, arquivado e cancelado vêm antes); a peça cancelada nunca conta como liberada. Na busca geral: "Removido do PCP em dd/mm", e o atalho leva à aba "Cancelados e removidos".
