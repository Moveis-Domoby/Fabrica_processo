---
titulo: Handoff — SESSAO-10 Dashboards e Visualizações Salvas
tipo: handoff
data: 2026-08-28
atualizado: 2026-08-28
tags: [handoff, sessao, plataforma, dashboards, d-32]
---

# 📋 Handoff — SESSAO-10 · Dashboards e Visualizações Salvas

**Branch:** `sessao-10-dashboards` (mesclada na `main` — bloco noturno D-26)
**Banco:** projeto `axnzldwgwsmepukdiljx` — **migration 18 aplicada em 28/08** (integração intacta)
**Demanda:** [[SESSAO-10 - Dashboards e Visualizacoes Salvas]] · **Memória de execução:** `docs/execucao/SESSAO-10.md`
**Decisões que regem:** D-02 (fila vs execução + soma) · [[PLT - Decisoes de Produto#D-32|D-32]] (foco pesado em TEMPO; só líder/admin) · D-29 (tempo útil) · D-04 (alavancagem, sem ranking).

## 1. O que foi feito

### Banco (migration 18 — 6 portas de leitura + gate)

- **`fn_setores_dashboard`** (privada): admin mede tudo; líder mede SÓ os setores que lidera; operador não mede nada. TODAS as funções abaixo filtram por ela — o gate está no banco, não na tela.
- **`plt_fn_dash_execucoes`** — a **lista detalhada** que você pediu: cada execução com peça, pedido, setor, etapa, quem iniciou/finalizou, início/fim, encerramento e **duração bruta E útil** (a útil desconta horário de funcionamento e pausas — D-29). Paginada no servidor.
- **`plt_fn_dash_tempos_setor`** — fila (do setor) vs execução (das pessoas), lado a lado e **somadas** (D-02), bruto e útil, **clipadas ao período** (só conta a parte dentro do filtro).
- **`plt_fn_dash_tempos_pessoa`** e **`plt_fn_dash_tempos_item`** — tempo útil por pessoa (execuções, peças) e por item (média por unidade — insumo do futuro tempo-padrão).
- **`plt_fn_dash_qualidade`** — por setor: 🟢🟡🔴 entregues, divergências CONTRA a entrega dele ("quem entrega dano"), pareceres dados e divergências apontadas (RF-85).
- **`plt_fn_dash_estoque`** — retrato do tempo parado no ESTOQUE agora (RF-14).
- Advisors: **+6 WARN esperados** (endpoints de propósito, padrão E-11) — total **14** + o do leaked password (pré-existente).

### Front (`/dashboards`, menu do líder/admin)

- Barra do painel: **visualização salva** · período (24h/7/30/90 dias) · setor · chips do que o painel mostra.
- Widgets: fila vs execução por setor (tabela + barra de proporção âmbar/verde) · execuções detalhadas (paginação de servidor) · tempo por pessoa · por item · qualidade por setor · estoque. Duração bruta no `title` (passar o mouse).
- **Visualizações salvas (RF-32/33):** salvar com nome, alternar, atualizar a selecionada, excluir — por usuário (`plt_visualizacoes`, RLS por dono).
- Parser de `interval` do Postgres (`src/dashboards/intervalo.ts`) **testado no Vitest** — número de tempo errado é o que esta plataforma não pode ter.

## 2. Verificação executada

| Critério da demanda | Resultado |
|---|---|
| Números batem com a soma manual dos eventos | ✅ `test:banco`: `plt_fn_dash_tempos_setor` (execução SECC) == `sum(duracao)` direto de `plt_vw_execucoes` (a query espelho está no harness, bloco "Dashboards") |
| Criar visualização → salvar → sair → voltar → está lá; alternar entre 2 | ✅ no navegador contra o banco real: "So tempo por setor" salva → página recarregada → selecionada → config aplicada (widgets restaurados) |
| Painel de qualidade mostra divergências por setor | ✅ dados reais: SECC com 🟡1/🔴1 e 1 divergência contra; FITAMENTO com 1 apontada |
| Líder não enxerga dados de outro setor | ✅ `test:banco`: lider.fita vê SÓ FITAMENTO; operador vê zero linhas |
| PR + handoff | ✅ merge direto (D-20/D-26) · este documento |

Extra que provou o D-29 de ponta a ponta: a execução de teste da SESSAO-07 aparece com **35s brutos → 30s úteis** — o desconto é a pausa de teste criada no Controle de tempo naquela sessão. `test:banco` TUDO VERDE (2 rodadas, +6 verificações) · tsc · lint · **Vitest 23/23** (6 novos do parser) · build ok · console limpo.

## 3. Como validar (do zero)

1. Entre como admin → menu **Dashboards**.
2. Confira "Fila vs execução por setor": SECC com execuções; passe o mouse na duração para ver o bruto.
3. "Execuções detalhadas": as execuções de teste com Wallace e Operador Teste Um — repare no útil < bruto (pausa D-29).
4. Desligue widgets, mude o período, digite um nome → **Salvar** → recarregue → selecione a visualização → o painel volta como estava.
5. Entre como um líder → só o setor dele aparece. Como operador → o menu nem mostra Dashboards (e a URL direta volta ao início).
6. Números na mão: `select sum(duracao) from plt_vw_execucoes where setor_id = (select id from plt_setores where codigo='secc');` — bate com a coluna Execução (bruta) do setor.

## 4. Decisões provisórias (para você confirmar)

- **As "5 métricas de todo dia"**: você pediu foco em tempo e deixou minhas propostas valerem — o painel padrão abre com tudo ligado (setores, execuções, pessoas, itens, qualidade, estoque), 7 dias. Ajuste fino é conversa de 5 min.
- **Sem gráfico de biblioteca**: barras em CSS puro (dependência pesada nova exigiria sua aprovação — regra 3). Se quiser gráficos mais ricos, decidimos juntos depois.
- **`fn_tempo_util` roda por linha** (agregados chamam por execução/permanência): perfeito para o volume atual; com meses de dados reais, o caminho é materializar por dia (anotado, não feito).
- **"Tornar padrão" de visualização** ficou de fora (a coluna existe; o gesto entra quando você sentir falta) — abrir sempre abre no painel padrão de fábrica.

## 5. Notas do cofre atualizadas

[[SUPA - Esquema do Banco]] (migration 18) · [[000 - ORDEM DAS SESSOES]] · [[000 - MAPA DO PROJETO]] · [[SESSAO-10 - Dashboards e Visualizacoes Salvas]] (status).

## Ver também

[[SESSAO-10 - Dashboards e Visualizacoes Salvas]] · [[handoff_2026_08_28_sessao09_entrada_pedidos]] · [[PLT - Plano Noturno Sessoes 07-12]]
