---
titulo: Próximos Passos — o plano em uma página
tipo: indice
atualizado: 2026-09-22
tags: [planejamento, roadmap, indice]
---

# 🎯 Próximos Passos — o plano em uma página

> [!abstract] O que é esta nota
> A leitura única de planejamento do projeto: **onde estamos, qual é o próximo passo, o que vem depois e o que está esperando você**. Ela não substitui as demandas — resume e aponta. Detalhe de execução vive em [[000 - ORDEM DAS SESSOES]]; o novo bloco em [[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]]; ideias de longo prazo em [[001 - HANDOFF - Pesquisa e Ideias de Plataformas]].
> **Regra de manutenção:** toda sessão entregue ou decisão nova atualiza esta nota junto com o mapa.

## Onde estamos (22/09/2026)

Entregues nesta semana: a [[SESSAO-22 - Producao - Filas Reais Tempo de PCP e Paginacao]] (21–22/09) e a [[SESSAO-21 - Uniao 3 - Cutover e Desligamento]] (22/09, [[handoff_2026_09_22_sessao21_cutover]]) — e **concluiu a união com a loja**: o renovador do token do Tiny e os crons do disparo rodam só na fábrica, e o projeto antigo está em quarentena. Em 18/09 o dono trouxe o **Bloco 5**, quebrado em **7 demandas prontas para code** (SESSAO-22 → 28), todas com as perguntas ao dono embutidas para o checkpoint de início de sessão.

## ▶️ Agora: fechar o cutover (gestos seus) e seguir para a SESSAO-23

- **Cutover (SESSAO-21):** ✅ DataCrazy repontado e ✅ trava do disparo aberta em 23/09 (PR #6). **Exclusão do projeto antigo: 06/10/2026** (backup dispensado; os 6 jobs desativados somem junto). Detalhe: [[handoff_2026_09_22_sessao21_cutover]].
- **Próxima de construção:** [[SESSAO-23 - Meu Painel 2 - Filas Pessoais Subtarefas e Tempos]].
- **Nova (🔶 rascunho, 4 perguntas suas):** [[SESSAO-29 - Reconciliacao Tiny - Pente-fino e Ultimo Pacote Vence]] — a correção de raiz da deriva Tiny × banco achada na conferência de 22/09 (P17). Recomendo encaixar cedo: sem ela, a deriva volta.

## ⏭️ Depois: o resto do Bloco 5, na ordem (decidida em 18/09)

**22 → 23 → 24 → 25 → 26 → 27 → 28** — plano completo com o de-para demanda→sessão em [[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]]:

1. ✅ [[SESSAO-22 - Producao - Filas Reais Tempo de PCP e Paginacao]] (entregue 22/09) — fim da coluna "Chegada", tempo de PCP verdadeiro, 10 cards por etapa + "Ver mais", regra nova *"cada tela requisita só o que mostra"*, 1 pedido por vez + pausa por líder.
2. [[SESSAO-23 - Meu Painel 2 - Filas Pessoais Subtarefas e Tempos]] — Delegados a mim / Meus afazeres / Fila de prioridade reordenável, subtarefas, tempos com a visibilidade certa; "Qualidade a atestar" vira tarefa do Sistema; "Avisos recentes" sai do painel.
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
10. SESSAO-29: 3 de 4 respondidas (D-50). Faltam: combinar com a equipe o nome do contato só com o nome (pergunta 4) e marcador removido no Tiny — sai daqui também? (pergunta 5).
11. ~~Trocar o token da API v2 do Tiny~~ — o dono decidiu **não** trocar (23/09).
8. Pendências antigas de 28/08: contas dos tablets e modo de delegação por setor.

## 🔧 Pendências técnicas vivas (fora das sessões)

- **P17** — o webhook de vendas não cobre marcador, contato renomeado nem campo limpo: deriva silenciosa Tiny × banco (acumulado corrigido em 22/09; raiz na SESSAO-29).
- **P1** — não existe alerta de erro nas automações do n8n (a SESSAO-25 propõe resolver junto). **P4** — token do Tiny v2 em texto puro no workflow. Lista completa: [[N8N - Pendencias e Riscos]].
- Débito técnico do módulo Comercial: [[PLT - Comercial - Debito Tecnico]].

## Ver também

[[000 - MAPA DO PROJETO]] · [[000 - ORDEM DAS SESSOES]] · [[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]] · [[PLT - Decisoes de Produto]] · [[PLT - Memoria de Aprendizado]]
