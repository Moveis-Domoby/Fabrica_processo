---
titulo: Próximos Passos — o plano em uma página
tipo: indice
atualizado: 2026-09-18
tags: [planejamento, roadmap, indice]
---

# 🎯 Próximos Passos — o plano em uma página

> [!abstract] O que é esta nota
> A leitura única de planejamento do projeto: **onde estamos, qual é o próximo passo, o que vem depois e o que está esperando você**. Ela não substitui as demandas — resume e aponta. Detalhe de execução vive em [[000 - ORDEM DAS SESSOES]]; o novo bloco em [[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]]; ideias de longo prazo em [[001 - HANDOFF - Pesquisa e Ideias de Plataformas]].
> **Regra de manutenção:** toda sessão entregue ou decisão nova atualiza esta nota junto com o mapa.

## Onde estamos (18/09/2026)

A plataforma da fábrica tem **13 sessões entregues** e absorveu a loja (módulo **Comercial**, sessões 19–20). Em 18/09 o dono trouxe o **Bloco 5** — o maior pacote desde a fundação: produção infalível + estoque (com integração nova ao Tiny da fábrica), Meu Painel 2.0, chat interno, automações em canvas e rota calculada. Foi quebrado em **7 demandas prontas para code** (SESSAO-22 → 28), todas com as perguntas ao dono embutidas para o checkpoint de início de sessão.

## ▶️ O próximo passo: SESSAO-16 — Dashboards de Verdade

- Demanda: [[SESSAO-16 - Dashboards de Verdade]] (📐 pronta para code)
- Reconstruir os dashboards da fábrica nos moldes dos 4 mockups de `_docs/Plataforma/Inspiracao/dashboards/` (D-42), herdando o Recharts 3.9.2 e os tokens de série que a SESSAO-20 fixou.
- Atenção do Claude Code: a `main` já contém a 20 — as duas mexeram em `App.tsx`, `Layout.tsx` e `tokens.css`.

## ⏭️ Depois: o Bloco 5, na ordem (decidida em 18/09)

**22 → 23 → 24 → 25 → 26 → 27 → 28** — plano completo com o de-para demanda→sessão em [[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]]:

1. [[SESSAO-22 - Producao - Filas Reais Tempo de PCP e Paginacao]] — fim da coluna "Chegada", tempo de PCP verdadeiro, 10 cards por etapa + "Ver mais", regra nova *"cada tela requisita só o que mostra"*, 1 pedido por vez + pausa por líder.
2. [[SESSAO-23 - Meu Painel 2 - Filas Pessoais Subtarefas e Tempos]] — Delegados a mim / Meus afazeres / Fila de prioridade reordenável, subtarefas, tempos com a visibilidade certa; "Qualidade a atestar" vira tarefa do Sistema; "Avisos recentes" sai do painel.
3. [[SESSAO-24 - Estoque Nucleo - Aguardo Cancelamentos e Alocacao]] — "Concluir produção" → Pedidos em aguardo (Ver pedidos/Ver itens), os 3 fluxos de cancelamento, estoque sem dono + sugestão de alocação no PCP, lançamento manual.
4. [[SESSAO-25 - Integracao Tiny Fabrica - Estoque e Minimos]] — integração **nova** com o Tiny da fábrica: estoque entra sozinho, venda da loja debita, mínimo/saldo/necessidade de produção, sugestão de mínimo pelo trimestre.
5. [[SESSAO-26 - Chat Interno]] — `/inicio/chat` + balão arrastável em toda tela; canais, particulares, avisos gerais, aniversários automáticos.
6. [[SESSAO-27 - Automacoes em Canvas]] — absorve a antiga 17: canvas com gatilho por etapa/setor, mover card (revisa D-03), arquivar, etiquetas.
7. [[SESSAO-28 - Rota Calculada no Mapa]] — rota real nas ruas (OSRM, grátis), partindo da fábrica.

## 🗓️ Na sua janela: SESSAO-21 — Cutover e desligamento da loja

- [[SESSAO-21 - Uniao 3 - Cutover e Desligamento]] (🔶 rascunho — promover a 📐 antes de executar). **Não bloqueia o Bloco 5**; roda quando você definir a janela. Guia: [[PLT - Comercial - Legado e Cutover]] e [[SUPA - Comercial - Cron e Rotinas]].

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
7. Avisar quando quiser a **publicação no ar** (SESSAO-08 / D-30) e, para o cutover, confirmar a janela.
8. Pendências antigas de 28/08: contas dos tablets e modo de delegação por setor.

## 🔧 Pendências técnicas vivas (fora das sessões)

- **P1** — não existe alerta de erro nas automações do n8n (a SESSAO-25 propõe resolver junto). **P4** — token do Tiny v2 em texto puro no workflow. Lista completa: [[N8N - Pendencias e Riscos]].
- Débito técnico do módulo Comercial: [[PLT - Comercial - Debito Tecnico]].

## Ver também

[[000 - MAPA DO PROJETO]] · [[000 - ORDEM DAS SESSOES]] · [[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]] · [[PLT - Decisoes de Produto]] · [[PLT - Memoria de Aprendizado]]
