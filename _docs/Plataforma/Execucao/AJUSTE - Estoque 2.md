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

- [x] 1. Registrar respostas na demanda + abrir esta execução
- [x] 2. Migration 45 (`20260930190000_plt_estoque_top_x_dias_uteis.sql`): configs (top_x/cobertura/corte em `plt_setores`), `produtos.minimo_travado`, dias úteis (venda seg–sáb · prazo seg–sex), `fn_vendas_90d` com corte + `fn_estoque_cortes_90d`, `fn_sugestoes_minimo` por dias úteis (só Top X), `fn_minimo_efetivo` + `fn_recalcular_minimos` (cron diário), `fn_reservados_producao` (para_estoque × exibição), `fn_estoque_por_produto`/`fn_gerar_reposicoes`/`fn_estoque_reposicao_coberta` recriadas das vigentes, `fn_vencer_reposicoes` + `fn_reposicao_vence_em` (cron horário), lista/configurações/resumo novos, RPCs de config + travar/automático + lançar manual + ligar/desligar (pg_cron), drops do "usar todas"/capacidade, E-17 na migration 40
- [x] 3. Harness: bloco 45 em escopo próprio (24 verificações); testes antigos (S25/40/42) ajustados à regra nova em combinação com as frentes; **619 ✔ TUDO VERDE** com os blocos 42/43/44/46
- [x] 4. Telas: PainelTop20 refeito (Top X = página, filtro 4 posições ao centro, cartão novo com bolinha → PCP e "Lançar para produção", modal de lançamento), PainelConfiguracoes (galpão de 6 números sem capacidade, cobertura 1/2/3/personalizada 1–8 no servidor, mínimo automático/travado com "voltar ao automático"), Estoque.tsx (aba "Top X" dinâmica), AdminEstoque (nova, /admin/estoque: liga/desliga + corte), PCP com ?liberar= (A-42), SeloSinal removido
- [x] 5. tsc ✔ · eslint ✔ (1 achado do set-state-in-effect corrigido pelo desenho — A-42) · vitest 83/83 ✔ · build ✔ · grep mojibake (duplas quebradas) limpo
- [x] 6. Raio-x de 29/09 registrado como Q-72 em Perguntas em Aberto + apontado nos Próximos Passos (SEM correção)
- [x] 7. Cofre: D-83…D-87 (↩️ D-71/D-72; ↪️ D-54), RF-110…RF-113, memória (A-42 + ↪️ E-34), demanda com as respostas do dono, ordem das sessões
- [ ] 8. Aplicar a 45 no banco real SÓ com aprovação explícita do dono (`--so`), integração conferida antes/depois + advisors + esquema/`.sql` atualizados
- [ ] 9. Validação ao vivo com o dono (F-07 celular/tablet + roteiro) + handoff + mapa + próximos passos finais

## Comandos e resultados

- `node supabase/testes/testar-migrations.mjs` → 1ª rodada: 4 ✘ (grant faltando nas portas públicas; cenário da bolinha com pedido já liberado; chave legada `necessidade_extrema` no evento; teste antigo do Top 20 na regra velha) → corrigidos → **610 ✔**; após o merge da 46: **619 ✔ TUDO VERDE**.
- `tsc -b` ✔ · `eslint src --max-warnings=0` ✔ · `vitest run` 83/83 ✔ (o teste do sinal saiu com os selos; entrou o do corte) · `npm run build` ✔.
- Commits na branch `ajuste-estoque-2`: banco+testes → telas → PCP/admin → merges da main (44, 46) — sempre por caminho explícito (E-23).

## Diário

- 30/09: ritual completo (demanda 2×, handoffs 28 e 30/09, execuções, memória inteira, D-54/70/71/72/76…81, mapa do código por agente). Branch criada de origin/main e avançada com a 43. Numeração cedida à sessão das fotos (44/D-82/A-41/E-72/RF-109) — fico com 45+/D-83+. Combinado com o sincronismo: quadro Tiny e ModalLiberarPedido intocados; funções compartilhadas partem da versão vigente.
- 30/09 (na sessão): o dono remodelou o cartão Galpão no meio da execução (print): saem capacidade e somas, entram os SEIS números — registrado na demanda (§1.1) e na D-83.
- 30/09: colisões de numeração resolvidas por mensagem (44/D-82 ficaram com as fotos; 46 com o sincronismo — a minha é 45, próxima livre 47+); merges da main sem perda (o conflito único do harness = os dois blocos no mesmo ponto; ficaram os dois, 45 antes do 46).
- 30/09: o lint recusou o efeito com estado do atalho da bolinha → desenho novo por consulta + derivação (A-42).
- Pendente: telas logadas e n8n não se validam daqui (sem senha — mesmo caso da 42); a validação ao vivo fica com o dono.
