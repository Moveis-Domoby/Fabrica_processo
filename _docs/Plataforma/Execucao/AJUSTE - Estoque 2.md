---
titulo: Ajuste — Estoque 2 · Top X, necessidade de produção, reservados e sugestão por dias úteis
tipo: execucao
data: 2026-09-30
atualizado: 2026-09-30
tags: [execucao, ajuste, estoque, logistica, pcp, reposicao]
---

# ⚙️ Execução — Ajuste Estoque 2 (30/09/2026)

**Branch:** `ajuste-estoque-2` (pasta principal, criada de `origin/main` e avançada até `2cbb7c9` — contém as migrations 42 e 43 e as fotos do Tiny)
**Demanda:** [[AJUSTE - Estoque 2 - Top X, necessidade de producao e sugestao por dias uteis]]
**Migration:** 45 — `supabase/migrations/20260930190000_*.sql` (a 44 é da sessão das fotos automáticas do Tiny)
**Numeração reservada:** D-83+ · RF-110+ · E-73+ · A-42+ (combinada por mensagem com as sessões "sincronismo Tiny" — que ficou com 43/D-76…D-80/E-69…E-71/A-39/A-40 — e "fotos do Tiny" — que ficou com 44/D-82/A-41/E-72/RF-109; conferir em todas as cópias antes de commitar — A-33)

## Respostas do dono (30/09, na sessão)

1. Loja vende seg–sáb; fábrica funciona seg–sex → sugestão usa dias de venda (seg–sáb, 6/semana); prazo de 2 dias úteis usa dias da fábrica (seg–sex). Sem feriados.
2. Cobertura personalizada: 1 a 8 semanas.
3. Peça de pedido cancelado a caminho do estoque conta como reservada para produção.
4. Botão manual "Lançar para produção" só com a automação desligada.
5. Ordem sempre por venda; filtro novo "Com estoque" (4ª posição).
6. Reservados em venda = um número só (inclui aguardo); bolinha vermelha no cartão quando há pedido esperando decisão do PCP, clicável → decisão no PCP; números de reservados aparecem para todo produto, mesmo fora do Top X. Peça de pedido em produção aparece no número, mas não abate a NECESSIDADE.
7. Vencimento de 2 dias úteis vale também para a reposição manual.

## Decisões técnicas aprovadas no relatório

- Top X e cobertura guardados na linha do setor ESTOQUE em `plt_setores` (padrão da casa); corte de pedido grande e liga/desliga da reposição no Painel admin (página nova `/admin/estoque`).
- Liga/desliga = agendar/desagendar o job no pg_cron (desligado → nenhum job, nenhuma consulta).
- Vencimento: dupla garantia — leitura ignora a parte vencida na hora + rotina leve horária faz o arquivamento oficial (Sistema, origem `api`), independente do liga/desliga (o botão manual também cria reposições).
- Mínimo automático recalcula: ao trocar cobertura/Top X/corte + 1×/dia de madrugada; travado à mão fica fora até "voltar ao automático".
- Produto que sai do Top X: mínimo guardado mas adormecido (mínimo efetivo só dentro do Top X; sem reserva do Tiny nos acabados).
- Partir SEMPRE das versões vigentes das funções (migration 42/43); manter verdes os blocos "Estoque × Tiny" (37) e da 43 (9) do harness.

## Task list

- [ ] 1. Registrar respostas na demanda (feito) + abrir esta execução (feito)
- [ ] 2. Migration 45: configs (top_x, cobertura, corte), trava do mínimo, dias úteis, sugestão nova, mínimo automático + recálculo, filtros/paginação por X, reservados produção/venda, necessidade, vencimento 2 dias úteis, liga/desliga por agendamento, lançamento manual, logs
- [ ] 3. Harness: bloco novo em escopo próprio no fim; 2 rodadas verdes; blocos das outras frentes intactos
- [ ] 4. Telas: PainelTop20 (Top X, filtro 4 posições, cartão novo, bolinha → PCP), PainelConfiguracoes (sai capacidade/"usar todas"; mínimo automático travável; cobertura 1/2/3/personalizada), página nova /admin/estoque, deep-link no PCP
- [ ] 5. tsc · lint · vitest · build · grep mojibake
- [ ] 6. Registrar pendências do raio-x de 29/09 em Perguntas em Aberto / Próximos Passos (sem corrigir)
- [ ] 7. Cofre: decisões D-83+ (↩️ D-71/D-72/D-54), RF-110+, memória na hora, esquema após aplicar
- [ ] 8. Aplicar a 45 no banco real SÓ com aprovação explícita do dono (`--so`), integração conferida antes/depois
- [ ] 9. Validação ao vivo + handoff + mapa + próximos passos

## Diário

- 30/09: ritual completo (demanda 2×, handoffs 28 e 30/09, execuções, memória inteira, D-54/70/71/72/76…81, mapa do código por agente). Branch criada de origin/main e avançada com a 43. Numeração cedida à sessão das fotos (44/D-82/A-41/E-72/RF-109) — fico com 45+/D-83+. Combinado com o sincronismo: quadro Tiny e ModalLiberarPedido intocados; funções compartilhadas partem da versão vigente.
