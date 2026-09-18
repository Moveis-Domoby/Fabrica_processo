---
titulo: "PLANO — Bloco 5: Produção, Estoque, Chat e Automações"
tipo: plano
data: 2026-09-18
atualizado: 2026-09-18
tags: [planejamento, roadmap, bloco-5, estoque, producao, chat, automacao]
---

# 🗺️ PLANO — Bloco 5: Produção, Estoque, Chat e Automações

> [!abstract] O que é esta nota
> A orquestração do pacote de demandas que o dono trouxe em 18/09/2026 (Cowork), quebrado em **7 sessões** (SESSAO-22 → SESSAO-28) no padrão da casa, com ordem de execução, dependências e o de-para completo demanda→sessão. Cada sessão é uma conversa do Claude Code sob as regras de [[CLAUDE - Regras do Claude Code (repo)]] — **sempre com o checkpoint de perguntas ao dono antes de codar**, task list espelho, memória de execução, erros/acertos anotados na hora e checklist de validação final marcado.

## Ordem de execução (decidida com o dono em 18/09)

**SESSAO-16 (Dashboards, já 📐) → 22 → 23 → 24 → 25 → 26 → 27 → 28.** A SESSAO-21 (cutover) roda **na janela que o dono definir** — não bloqueia o bloco. SESSAO-08 (publicação) e SESSAO-18 (painel admin) seguem como estavam.

| Ordem | Sessão | Por que nesta posição |
|---|---|---|
| 1ª | [[SESSAO-22 - Producao - Filas Reais Tempo de PCP e Paginacao]] | Conserta as dores vivas do kanban (coluna "Chegada", tempo de PCP zerado, quadros sem paginação) e cria a **regra nova de sistema** ("cada tela requisita só o que mostra") que todas as sessões seguintes obedecem. Também endurece a execução (1 pedido por vez + pausa por líder) — a "produção infalível" começa aqui |
| 2ª | [[SESSAO-23 - Meu Painel 2 - Filas Pessoais Subtarefas e Tempos]] | Meu Painel com as três filas, subtarefas e tempos com visibilidade certa. Vem depois da 22 (herda a regra de requisição) e depois da 16 (reaproveita o padrão de gráficos para o gráfico privado) |
| 3ª | [[SESSAO-24 - Estoque Nucleo - Aguardo Cancelamentos e Alocacao]] | O coração do bloco: Concluir produção → Pedidos em aguardo (Ver pedidos/Ver itens), os 3 fluxos de cancelamento, estoque sem dono e sugestão de alocação no PCP. Tudo interno — nenhuma dependência externa |
| 4ª | [[SESSAO-25 - Integracao Tiny Fabrica - Estoque e Minimos]] | Integração NOVA com o Tiny da fábrica (hoje só loja + GreenPallets). Precisa da 24 pronta: o estoque que o Tiny alimenta e a venda da loja debita é o da 24. Depende do dono: conta/plano/token |
| 5ª | [[SESSAO-26 - Chat Interno]] | Independente das demais — entra depois do trilho de estoque para não interromper a sequência produção→estoque. Balão global + `/inicio/chat` + aniversários (campo novo data de nascimento) |
| 6ª | [[SESSAO-27 - Automacoes em Canvas]] | **Absorve a SESSAO-17.** Vem depois da 22 (gatilho por etapa pressupõe filas reais) e idealmente depois da 24 (mais alvos úteis para mover/etiquetar). Revisa a D-03 (mover card automático) |
| 7ª | [[SESSAO-28 - Rota Calculada no Mapa]] | Isolada (só toca ROTAS). OSRM grátis, partida na fábrica; interdições do dia registradas como evolução paga futura |

## De-para: cada pedido do dono → onde vive

| Pedido (18/09) | Sessão |
|---|---|
| Remover colunas "chegada" das pipelines de produção (filas reais: "a fitar", "a montar"…) | 22 |
| Tempo no PCP bugado no card ("0:11 em pcp" para pedidos que ficaram dias) | 22 (causa raiz já diagnosticada: liberação grava criação+movimentação no mesmo instante; o tempo verdadeiro vive no card de pedido) |
| Paginação em PCP e produção: 10 cards por etapa + "ver mais", otimizada | 22 |
| Regra do sistema: "cada tela deve requisitar apenas o que ela mostra" | 22 (promovida ao CLAUDE do repo + Modelo de Sistema; vale para todas as sessões dali em diante) |
| Uma pessoa não pega dois pedidos de uma vez; líder pode pausar execução (urgências) | 22 (revisa D-24/Q-17) |
| Demandas subidas aparecem no Meu Painel: "Delegados a mim" / "Meus afazeres" / "Fila de prioridade" (ordem de cadastro, reordenável) | 23 |
| Meus afazeres: tempo só para mim + gráfico privado em dashboards | 23 |
| Delegados a mim: tempo visível a líderes do setor e admins | 23 |
| Subtarefas em todas as tarefas | 23 |
| "Qualidade a atestar" sai do painel → vira Delegados a mim com delegante "Sistema" | 23 |
| "Avisos recentes" sai do painel → botão "Ver todos" dentro das notificações | 23 |
| Botão "Concluir produção" em todos os cards → "Pedidos em aguardo" (não Estoque), com "Ver pedidos" e "Ver itens" | 24 |
| Cancelamentos: PCP→aba "Cancelados"; em produção→tag "pedido cancelado" e conclusão vai direto a estoque; pronto→estoque sem dono | 24 |
| Estoque sem dono como sugestão de alocação no PCP (mesma cor/dimensões); vai e volta com o pedido | 24 |
| Lançar produto em estoque pela plataforma, sem Tiny | 24 |
| Venda na loja (Tiny) debita item lançado pela fábrica | 25 |
| Estoque mínimo do cadastro do Tiny da fábrica; saldo + sinalização de necessidade de produção | 25 |
| Tela de sugestão de mínimo pelo último trimestre (melhoria) | 25 |
| Lançamento de estoque no Tiny da fábrica alimenta o app (integração nova) | 25 |
| Chat interno: filha de Início + balão arrastável com badge; canais, particulares, avisos gerais, aniversários automáticos | 26 |
| Tela de automação em canvas: gatilho "pedido iniciado na etapa X do setor Y"; mover card, excluir card, etiqueta (etiquetas em Configurações) | 27 |
| Rota calculada no mapa partindo da fábrica (contramão/sinalização; interdição = evolução) | 28 |

## Decisões que o bloco vai revisar (registrar D-NN em cada sessão, com o dono)

- **D-24** (limite de execuções: padrão vira 1) e **Q-17** (pausa por líder volta) — S22.
- **D-37** (Meu Painel perde "Qualidade a atestar" e "Avisos recentes") — S23.
- **D-45** (o "Concluir" muda de destino: Pedidos em aguardo) e **D-22**/**Q-23** (nasce o estoque sem dono e o lançamento manual) — S24.
- **D-03** (mover card automaticamente por gatilho passa a existir, desligado por padrão) — S27.
- **D-39** (a linha vira rota calculada OSRM; segue grátis e sem chave; interdições/trânsito = evolução paga futura) — S28.

## Avisos ao Claude Code (valem para o bloco inteiro)

1. **Ritual inalterado**: leituras obrigatórias na ordem do [[CLAUDE - Regras do Claude Code (repo)]], demanda lida 2×, e o checkpoint (a) entendimento ≤15 linhas + (b) dúvidas de negócio + (c) decisões técnicas **antes de codar — só seguir com o OK do dono**. Cada demanda traz sua seção "Perguntar ao dono" pronta.
2. **Task list espelho da demanda**, conferida item a item no fim; **memória de execução** em `Plataforma/Execucao/SESSAO-NN.md` escrita enquanto executa; **todo erro e acerto** vira E-NN/A-NN na [[PLT - Memoria de Aprendizado]] na hora; **checklist de validação final marcado** (test:banco 2×, tsc, lint, vitest, build, F-07, checkpoint F-08 antes de aplicar no banco, advisors, handoff).
3. **Regra nova a partir da S22**: *cada tela requisita apenas o que ela mostra*. Nenhuma sessão do bloco entrega tela que baixa mais do que exibe.
4. Eventos **append-only** sempre (RNF-05/M-02): cancelamento, estoque, pausa, etiqueta, chat — tudo é evento novo com projeção; nada se apaga ("excluir" = arquivar).
5. **Tokens do Tiny nunca em chat/print/nota** (E-03) — vale em dobro na S25, que cria conta nova.
6. A [[SESSAO-17 - Automacoes Internas]] foi **absorvida pela 27**; a [[SESSAO-18 - Painel Admin Completo]] continua em standby.

## Ver também

[[000 - PROXIMOS PASSOS]] · [[000 - ORDEM DAS SESSOES]] · [[PLT - Decisoes de Produto]] · [[PLT - Memoria de Aprendizado]] · [[PLT - Perguntas em Aberto]]
