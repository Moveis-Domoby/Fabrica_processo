---
titulo: Próximos Passos — o plano em uma página
tipo: indice
atualizado: 2026-09-23
tags: [planejamento, roadmap, indice]
---

# 🎯 Próximos Passos — o plano em uma página

> [!abstract] O que é esta nota
> A leitura única de planejamento do projeto: **onde estamos, qual é o próximo passo, o que vem depois e o que está esperando você**. Ela não substitui as demandas — resume e aponta. Detalhe de execução vive em [[000 - ORDEM DAS SESSOES]]; o novo bloco em [[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]]; ideias de longo prazo em [[001 - HANDOFF - Pesquisa e Ideias de Plataformas]].
> **Regra de manutenção:** toda sessão entregue ou decisão nova atualiza esta nota junto com o mapa.

## Onde estamos (23/09/2026)

Entregues nesta semana: a [[SESSAO-22 - Producao - Filas Reais Tempo de PCP e Paginacao]] (21–22/09), a [[SESSAO-21 - Uniao 3 - Cutover e Desligamento]] (22–23/09) e a **[[SESSAO-23 - Meu Painel 2 - Filas Pessoais Subtarefas e Tempos]]** (23/09, [[handoff_2026_09_23_sessao23_meu_painel_2]]) — o Meu Painel 2.0 com as três filas, subtarefas, tarefa privada, tarefa do Sistema e o painel pessoal "Meu desempenho"; migration 33 aplicada com permissão total do dono.

## ▶️ Agora: validar a SESSAO-23 e seguir para a SESSAO-24

- **SESSAO-23:** entregue com o banco aplicado; **falta a sua validação logada e o merge na `main`** (roteiro de 10 minutos no [[handoff_2026_09_23_sessao23_meu_painel_2]]).
- **Cutover (SESSAO-21):** ✅ DataCrazy repontado e ✅ trava do disparo aberta em 23/09 (PR #6). **Exclusão do projeto antigo: 06/10/2026**. Detalhe: [[handoff_2026_09_22_sessao21_cutover]].
- **Próxima de construção:** [[SESSAO-24 - Estoque Nucleo - Aguardo Cancelamentos e Alocacao]].
- **Nova (🔶 rascunho, 4 perguntas suas):** [[SESSAO-29 - Reconciliacao Tiny - Pente-fino e Ultimo Pacote Vence]] — a correção de raiz da deriva Tiny × banco achada na conferência de 22/09 (P17). Recomendo encaixar cedo: sem ela, a deriva volta.

## ⏭️ Depois: o resto do Bloco 5, na ordem (decidida em 18/09)

**22 → 23 → 24 → 25 → 26 → 27 → 28** — plano completo com o de-para demanda→sessão em [[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]]:

1. ✅ [[SESSAO-22 - Producao - Filas Reais Tempo de PCP e Paginacao]] (entregue 22/09) — fim da coluna "Chegada", tempo de PCP verdadeiro, 10 cards por etapa + "Ver mais", regra nova *"cada tela requisita só o que mostra"*, 1 pedido por vez + pausa por líder.
2. ✅ [[SESSAO-23 - Meu Painel 2 - Filas Pessoais Subtarefas e Tempos]] (entregue 23/09) — as três filas com a Fila de prioridade reordenável, subtarefas em 2 níveis, tarefa privada (D-51), tarefa do Sistema no lugar do bloco de qualidade, "Ver todos" no sino e o painel pessoal Meu desempenho.
3. [[SESSAO-24 - Estoque Nucleo - Aguardo Cancelamentos e Alocacao]] — "Concluir produção" → Pedidos em aguardo (Ver pedidos/Ver itens), os 3 fluxos de cancelamento, estoque sem dono + sugestão de alocação no PCP, lançamento manual.
4. [[SESSAO-25 - Integracao Tiny Fabrica - Estoque e Minimos]] — integração **nova** com o Tiny da fábrica: estoque entra sozinho, venda da loja debita, mínimo/saldo/necessidade de produção, sugestão de mínimo pelo trimestre.
5. [[SESSAO-26 - Chat Interno]] — `/inicio/chat` + balão arrastável em toda tela; canais, particulares, avisos gerais, aniversários automáticos.
6. [[SESSAO-27 - Automacoes em Canvas]] — absorve a antiga 17: canvas com gatilho por etapa/setor, mover card (revisa D-03), arquivar, etiquetas.
7. [[SESSAO-28 - Rota Calculada no Mapa]] — rota real nas ruas (OSRM, grátis), partindo da fábrica.

## ⏸️ Em espera (decisão sua)

- [[SESSAO-08 - Publicacao no Ar]] — **você avisa quando quer lançar (D-30).**
- [[SESSAO-18 - Painel Admin Completo]] — standby desde a D-35. (A antiga 17 foi absorvida pela 27.)
- Ajustes herdados da loja no módulo Comercial — triagem em [[PLT - Comercial - Legado e Cutover]].

## 🧭 Depois do Bloco 5 (o horizonte)

- BOM/insumos (chapas MDF) e custo real por móvel · migração dos **cards vivos** do ClickUp (Q-25) · **app/fluxo do motorista** · central de notificações com preferências.
- Banco de ideias completo: [[001 - HANDOFF - Pesquisa e Ideias de Plataformas]] · perguntas sem resposta: [[PLT - Perguntas em Aberto]].

## 🙋 Pendências que estão com VOCÊ (o dono)

1. **Trocar a senha do admin** — ela já vazou em chat duas vezes. (Pendente desde 28/08.)
2. **Conta Tiny da fábrica** (para a SESSAO-25): existe? qual plano? O token vai direto no lugar seguro — nunca em chat (E-03).
3. Decidir a **limpeza dos ~163 cards históricos** do PCP (E-24).
4. **Q-63** — formato do ID de produção (Estoque).
5. Conferir as **decisões provisórias** dos handoffs 13–15 e 19–20.
6. `PLT_GEOCODIFICACAO_CONTATO` (contato do Nominatim, opcional).
7. Avisar quando quiser a **publicação no ar** (SESSAO-08 / D-30).
9. **Cutover (SESSAO-21):** excluir o projeto antigo em **06/10** · (se souber) o vendedor antigo dos pedidos 13183 e 13421 — tudo no [[handoff_2026_09_22_sessao21_cutover]].
10. ✅ SESSAO-29 respondida por inteiro (D-50) — **📐 pronta para code**; só falta você dizer quando ela entra na fila.
11. ~~Trocar o token da API v2 do Tiny~~ — o dono decidiu **não** trocar (23/09).
8. Pendências antigas de 28/08: contas dos tablets e modo de delegação por setor.

## 🔧 Pendências técnicas vivas (fora das sessões)

- **P17** — o webhook de vendas não cobre marcador, contato renomeado nem campo limpo: deriva silenciosa Tiny × banco (acumulado corrigido em 22/09; raiz na SESSAO-29).
- **P1** — não existe alerta de erro nas automações do n8n (a SESSAO-25 propõe resolver junto). **P4** — token do Tiny v2 em texto puro no workflow. Lista completa: [[N8N - Pendencias e Riscos]].
- Débito técnico do módulo Comercial: [[PLT - Comercial - Debito Tecnico]].

## Ver também

[[000 - MAPA DO PROJETO]] · [[000 - ORDEM DAS SESSOES]] · [[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]] · [[PLT - Decisoes de Produto]] · [[PLT - Memoria de Aprendizado]]
