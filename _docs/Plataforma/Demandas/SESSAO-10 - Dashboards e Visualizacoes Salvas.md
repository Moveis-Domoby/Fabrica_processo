---
titulo: "SESSAO-10 — Dashboards e Visualizações Salvas"
tipo: demanda
status: entregue
data: 2026-08-19
atualizado: 2026-08-19
tags: [plataforma, demanda, sessao, dashboard]
---

# 🎯 SESSAO-10 — Dashboards e Visualizações Salvas

> [!success] ✅ Entregue em 28/08/2026 (bloco noturno D-26) — [[handoff_2026_08_28_sessao10_dashboards]]
> Executada com o foco da **D-32** (tempo em primeiro lugar, respostas do dono no aval do bloco): lista detalhada de execuções + duração útil (D-29). Operador não vê nada; líder só o próprio setor — gate no banco.

## O que é

A colheita de tudo que as sessões 05–07 plantaram: os dados de tempo e qualidade viram painéis — com o dono podendo montar a própria visualização, salvá-la no banco e alternar entre as salvas.

## Requisitos cobertos

RF-30 · RF-31 · RF-32 · RF-33 · RF-85 · RF-14 · RNF-02.

## Decisões que regem

D-02 (comparativo fila vs execução + soma) · D-04 (leitura de alavancagem operacional, sem ranking de bonificação) · D-09 (qualidade na dash).

## Comportamento esperado

- **Produtividade** por setor, por usuário e por item produzido, no período escolhido (RF-30): volumes finalizados, tempos médios.
- **Fila vs execução** por etapa, lado a lado e somados (D-02) — onde a peça espera vs onde ela é trabalhada.
- **Qualidade (D-09/RF-85):** por setor: quantos 🟢🟡🔴 entregues, quantas divergências recebidas/geradas, resolução das disputas — a visão de "quem entrega dano" que motivou o pedido da equipe.
- **Tempo parado no estoque** (RF-14) como métrica visível.
- **Painel personalizável (RF-32/33):** escolher widgets/métricas e período, **salvar a visualização no banco** com nome, alternar entre salvas facilmente. Visualizações são por usuário.
- Acesso por papel: líder vê o próprio setor; admin vê tudo (operador não vê dashboards nesta fase — confirmar).
- Toda lista/tabela pagina (RNF-02); gráficos seguem o design system.

## Perguntar ao dono no início da sessão

- As 5 métricas que você quer ver TODO dia (define o painel padrão de fábrica).
- Operador vê algo de dashboard (ex.: o próprio desempenho) ou nada por enquanto? (Sensível — D-04.)

## Fora do escopo

Ranking/bonificação (⏸️ D-04) · exportações · métricas de estoque fase 2.

## Critérios de aceite

- [ ] Com dados de teste, os números da dash batem com a soma manual dos eventos (verificação por query documentada no handoff).
- [ ] Criar visualização → salvar → sair → voltar → ela está lá; alternar entre 2 salvas funciona.
- [ ] Painel de qualidade mostra divergências por setor.
- [ ] Líder não enxerga dados de outro setor.
- [ ] PR + handoff.
