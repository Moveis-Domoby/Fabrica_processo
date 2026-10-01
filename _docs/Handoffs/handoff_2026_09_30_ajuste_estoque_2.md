---
titulo: Handoff — Ajuste Estoque 2 · Top X, mínimo automático por dias úteis, PCP em abas
tipo: handoff
data: 2026-09-30
atualizado: 2026-09-30
tags: [handoff, ajuste, estoque, pcp, logistica, d-83, d-84, d-85, d-86, d-87, d-88, d-89]
---

# 📋 Handoff — Ajuste Estoque 2 (30/09/2026)

**Branch:** `ajuste-estoque-2` (pasta principal) — **mesclada na `main` e PUBLICADA em 30/09** (três levas, autor `contatodomoby`)
**Banco:** migrations **45, 47 e 48** aplicadas em 30/09, cada uma sozinha (`--so`), integração do Tiny idêntica antes/depois (`e2109f3a…`, 65 colunas) — a 46 (reservas presas) é da frente do sincronismo
**Memória:** [[AJUSTE - Estoque 2]] · **Decisões:** D-83…D-89 (↩️ D-71/D-72; ↪️ D-54/D-62/D-86) · **Requisitos:** RF-110…RF-114
**Demanda:** [[AJUSTE - Estoque 2 - Top X, necessidade de producao e sugestao por dias uteis]]

## 1. O que você pediu

**Na demanda (30/09):** sai a capacidade do galpão; o **Top X** (1–50) vira a régua e a página do estoque — só ele tem mínimo; sugestão por **dias úteis**; **mínimo automático** que trava ao editar; **corte de pedido fora do comum**; filtro Todos/Necessidade/Reservados; cartão novo; reposição parada **2 dias úteis** sai do PCP sozinha; **liga/desliga de verdade** no Painel admin; entrega desligada.

**Nas rodadas ao vivo (você logado, 30/09):** o cartão Galpão com os **seis números**; filtros na linha da busca; **Top X e o quadro do Tiny no Painel admin → Estoque**; Galpão/Tiny **recolhíveis**; o **ícone vermelho pulando** no lugar do botão de lançar; câmera só no detalhe; Tiny de referência ao lado do mínimo; e o **PCP em três abas** (Reabastecimento · Pedidos aguardando liberação · Todos os pedidos), **Cancelados na Logística**, detalhe de produção por pedido, **bolinha de cor do status do Tiny**, entregue = tudo liberado (visual), selo de **peça no estoque** no card e **paginação por rolagem**.

## 2. Como ficou (em língua de gente)

- **Estoque (logística):** UMA lista pelos mais vendidos, X por página; filtro de 4 posições (Todos · Necessidade de produção · Reservados para produção · Com estoque); cartão com o número GRANDE, reservados p/ produção e em venda, aviso de pedido grande fora da conta, a **bolinha vermelha** que abre a decisão do pedido no PCP e o **ícone vermelho** que lança para produção (automática desligada). Configurações: cobertura (1–8 semanas) e o mínimo automático/travado, com o sugerido do Tiny ao lado.
- **Painel admin → Estoque (só admin):** reposição automática (liga/desliga que cria/remove a rotina de verdade — **desligada**), **Top X**, **corte** (padrão 10) e o **quadro do Tiny** (sincronismo, fila, erros, reservas presas, ligar/desligar). ⚠️ A logística não vê mais o quadro do Tiny — se quiser devolver só a visão, é ajuste pequeno.
- **PCP:** Reabastecimento na primeira aba (nunca mais solicitação invisível atrás dos pedidos); quadro só de pedidos com o selo verde quando o galpão atende; Todos os pedidos com busca, status colorido do Tiny e o olhinho do detalhe (busca ao abrir, esquece ao fechar); Cancelados em **Fábrica → Logística → Cancelados**.
- **A conta nova do mínimo:** vendidos em 90 dias (sem o pedido gigante) ÷ dias úteis de venda da loja (seg–sáb) × 6 × semanas de cobertura, teto no fim — o exemplo do armário bate (15 para 2 semanas). Mínimo acompanha sozinho (recalcula a cada troca + de madrugada); editou, travou.
- **Reposição parada 2 dias úteis da fábrica (seg–sex) no PCP sai sozinha** (o Sistema assina; parcial, só a parte parada; a necessidade volta sem exigir movimento novo). Vale também para a lançada à mão.

## 3. Decisões que tomei (você pode mudar)

| Decisão | Alternativa descartada | Por quê |
|---|---|---|
| Vencimento: leitura ignora a parte vencida NA HORA + rotina horária faz o evento | Só rotina (cartão mentiria entre rodadas) ou só leitura (o PCP veria o card vencido) | Os números nunca mentem e o quadro se limpa sozinho |
| Rotina do vencimento independente do liga/desliga | Amarrá-la à automática | A reposição manual também vence (sua resposta 7) |
| Mínimos antigos entraram no AUTOMÁTICO | Travá-los como estavam | Você decidiu que o padrão é acompanhar a sugestão; editar de novo trava |
| Produto que sai do Top X fica com o mínimo adormecido | Apagar o valor | Nada se perde; voltando ao Top X, vale de novo |
| Peça de PEDIDO em produção aparece no número, mas não abate a NECESSIDADE | Abater | Ela vai embora com o pedido — não abastece o galpão |
| Detalhe de produção busca ao abrir e ESQUECE ao fechar | Guardar no cache | Seu pedido literal; nada de requisição à toa (regra 17) |
| "Todos os pedidos" pela porta de resumo que já existia | Porta nova | Zero banco novo; busca e páginas já prontas |

## 4. Verificação

| O quê | Resultado |
|---|---|
| Testes do banco | ✅ **621 verificações, TUDO VERDE** (com os blocos das frentes do sincronismo e das fotos; migrations aplicadas 2× no harness) |
| Tipos · lint · testes de tela · build | ✅ · ✅ · ✅ 83/83 · ✅ (em cada leva publicada) |
| Aplicação no banco real | ✅ 45, 47 e 48, cada uma sozinha; integração idêntica nas três; advisors só com o esperado |
| Pós-aplicação no banco real | ✅ relógios certos (vencimento horário, recálculo 04:40, **reposição automática AUSENTE**), 61 mínimos no automático, portas só para logado |
| Telas com você logado | ✅ você dirigiu 6 rodadas ao vivo — cada ajuste conferido na tela na hora (lançamento manual, abas do PCP, selos, detalhe do pedido, bolinhas de status) |
| Celular (375) e tablet (768) | ✅ sem rolagem lateral nas telas do Estoque e Configurações |
| Sincronismo com o Tiny após a 45 | ✅ conferido pela frente dona: fila 0, parados 0, leitura de ponta a ponta em 23 s |
| ⚠️ Incidente (corrigido em minutos) | A 45 aplicada antes das telas publicadas quebrou Configurações no site — lição E-73: **aplicar banco e publicar telas é um gesto só** |

## 5. Ficou com você

- 🔶 **Contagem inicial da logística** (a maior parte segue em 0) — e só depois decidir **ligar a reposição automática** (Painel admin → Estoque).
- 🔶 **Os pedidos presos no quadro com "entregue no Tiny"**: é o aviso que o Tiny não mandou (P17) — não há status mais novo no banco. Recomendo a **[[SESSAO-29 - Reconciliacao Tiny - Pente-fino e Ultimo Pacote Vence]] como próxima** (mata isso de vez); enquanto isso, salvar o pedido no Tiny reenvia o aviso e ele some daqui na hora (visto ao vivo: 33 → 30 durante a sessão).
- ⚪ Você deixou **Top X = 30** e **cobertura = 1 semana** nos seus testes — valem para a equipe; mude quando quiser.
- ⚪ A logística não vê mais o quadro do Tiny (foi para o admin) — me chame se quiser devolver a visão sem os botões.
- ⚪ O raio-x de 29/09 está registrado como pendência (Q-72), sem nenhuma correção.

## 6. Arquivos

```
supabase/migrations/20260930190000_plt_estoque_top_x_dias_uteis.sql   (45 — aplicada)
supabase/migrations/20260930210000_plt_pcp_grupo.sql                  (47 — aplicada)
supabase/migrations/20260930220000_plt_pcp_pecas_estoque.sql          (48 — aplicada)
supabase/migrations/20260928180000_plt_estoque_contagem_top20.sql     (40: drops E-17)
supabase/testes/testar-migrations.mjs                                 (blocos 45 e 47/48; antigos na regra nova)
src/logistica/{api,estoque(+teste)}.ts · componentes/{PainelTop20,PainelConfiguracoes,
    CartaoProdutoEstoque,ModalProdutoEstoque}.tsx (SeloSinal saiu)
src/paginas/{Estoque,AdminEstoque(nova),PCP,Cancelados(nova)}.tsx · src/App.tsx · src/componentes/Layout.tsx
src/kanban/{api,tipos,situacao}.ts
_docs: demanda (respostas e o pedido do Galpão) · D-83…D-89 · RF-110…RF-114 · Q-72 ·
       memória (E-73, A-42, ↪️ E-34) · esquema (45) · execução · mapa · próximos passos · este handoff
```

## Ver também

[[handoff_2026_09_30_estoque_sincronizado_tiny]] · [[handoff_2026_09_28_ajuste_estoque_contagem_top20]] · [[PLT - Decisoes de Produto]] · [[PLT - Perguntas em Aberto]]
