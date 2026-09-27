---
titulo: Próximos Passos — o plano em uma página
tipo: indice
atualizado: 2026-09-27
tags: [planejamento, roadmap, indice]
---

# 🎯 Próximos Passos — o plano em uma página

> [!abstract] O que é esta nota
> A leitura única de planejamento do projeto: **onde estamos, qual é o próximo passo, o que vem depois e o que está esperando você**. Ela não substitui as demandas — resume e aponta. Detalhe de execução vive em [[000 - ORDEM DAS SESSOES]]; o novo bloco em [[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]]; ideias de longo prazo em [[001 - HANDOFF - Pesquisa e Ideias de Plataformas]].
> **Regra de manutenção:** toda sessão entregue ou decisão nova atualiza esta nota junto com o mapa.

## Onde estamos (23/09/2026)

Entregues nesta semana: a [[SESSAO-22 - Producao - Filas Reais Tempo de PCP e Paginacao]] (21–22/09), a [[SESSAO-21 - Uniao 3 - Cutover e Desligamento]] (22–23/09) e a **[[SESSAO-23 - Meu Painel 2 - Filas Pessoais Subtarefas e Tempos]]** (23/09, [[handoff_2026_09_23_sessao23_meu_painel_2]]) — o Meu Painel 2.0 com as três filas, subtarefas, tarefa privada, tarefa do Sistema e o painel pessoal "Meu desempenho"; migration 33 aplicada com permissão total do dono.

## ▶️ Agora: SESSAO-24 entregue (conferir e mesclar) · SESSAO-26 em execução · ligar a reposição quando o dono decidir

- **SESSAO-24 (Produção concluída, cancelamentos e alocação):** ✅ **entregue em 27/09** — [[handoff_2026_09_27_sessao24_producao_concluida]]. Quadros **só por arrasto** (D-59/D-60), **Pedidos em aguardo como lugar** e ESTOQUE só sem dono (D-58), aba **Cancelados** no PCP (D-61), **sugestão do estoque** na liberação (D-62). Migration 37 aplicada com o seu OK. **Com você:** (1) conferir as telas pelo roteiro do handoff (§9) e **mesclar na `main`** (= publicar); (2) **Q-69** — a peça 🔴 502 do 13215; (3) **Q-70** — as unidades 518 e 537 de pedidos já entregues no Tiny.
- **Em execução em paralelo:** [[SESSAO-26 - Chat Interno]] (outra pasta; a migration 38 dela entra depois do seu OK).

- **SESSAO-25 (Estoque completo):** ✅ **entregue em 26/09** — [[handoff_2026_09_26_sessao25_estoque]]. Migration 36 aplicada, carga do saldo rodada (442 produtos), telas validadas. **Com você:** (1) validar no roteiro do handoff e fazer um lançamento real no Tiny; (2) **decidir ligar a reposição automática** (1ª rodada: 44 cards / 121 unidades no PCP); (3) ✅ mesclada na `main` em 26/09. ⚠️ O físico dos móveis no Tiny está negativo em 93 de 168 — vale conferir o 327 na aba "reservas" do Tiny.

## (histórico) SESSAO-25 (Estoque completo) — ⏫ passou na frente da 24 (D-53)

- **SESSAO-23:** ✅ validada ao vivo em 2 rodadas de ajustes com o dono e **mesclada na `main` em 24/09** — detalhe no [[handoff_2026_09_23_sessao23_meu_painel_2]]. Bônus entregues: D-52 (admin sem setor), PCP sem encerrados do Tiny (161 → 37) e o achado do pedido 13257 (reforça a urgência da SESSAO-29).
- **Cutover (SESSAO-21):** ✅ DataCrazy repontado e ✅ trava do disparo aberta em 23/09 (PR #6). **Exclusão do projeto antigo: 06/10/2026**. Detalhe: [[handoff_2026_09_22_sessao21_cutover]].
- **Próxima de construção:** [[SESSAO-25 - Integracao Tiny Fabrica - Estoque e Minimos]] — **o estoque inteiro numa sessão só**. Em 24/09 o dono pediu urgência: a **25 trocou de lugar com a 24** e o estoque-base (item sem dono, lançamento manual, tela) **saiu da 24 e foi para a 25** (D-53). A 24 ficou com as consequências de produção e cancelamento e roda depois.
- **Metade da 25 já está entregue, fora de sessão (21–23/09):** integração com o **Tiny da fábrica no ar** — catálogo de 487 produtos no banco, produto novo entra sozinho a cada 15 min, varredura diária e **webhook de lançamentos de estoque ligado e testado** (manda o saldo resultante). Detalhe: [[N8N - Tiny Fabrica Produtos para Banco]] e [[N8N - Tiny Fabrica - Estudo do Cadastro]].
- **Nova (🔶 rascunho, 4 perguntas suas):** [[SESSAO-29 - Reconciliacao Tiny - Pente-fino e Ultimo Pacote Vence]] — a correção de raiz da deriva Tiny × banco achada na conferência de 22/09 (P17). Recomendo encaixar cedo: sem ela, a deriva volta.

## ⏭️ Depois: o resto do Bloco 5, na ordem (decidida em 18/09)

**22 → 23 → 25 → 24 → 26 → 27 → 28** (ordem revisada em 24/09 — D-53) — plano completo com o de-para demanda→sessão em [[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]]:

1. ✅ [[SESSAO-22 - Producao - Filas Reais Tempo de PCP e Paginacao]] (entregue 22/09) — fim da coluna "Chegada", tempo de PCP verdadeiro, 10 cards por etapa + "Ver mais", regra nova *"cada tela requisita só o que mostra"*, 1 pedido por vez + pausa por líder.
2. ✅ [[SESSAO-23 - Meu Painel 2 - Filas Pessoais Subtarefas e Tempos]] (entregue 23/09) — as três filas com a Fila de prioridade reordenável, subtarefas em 2 níveis, tarefa privada (D-51), tarefa do Sistema no lugar do bloco de qualidade, "Ver todos" no sino e o painel pessoal Meu desempenho.
3. ✅ ⏫ [[SESSAO-25 - Integracao Tiny Fabrica - Estoque e Minimos]] (entregue 26/09) — **o estoque inteiro**: saldo vindo do Tiny (integração já no ar), item com pedido × sem dono, lançamento manual, tela com saldo/mínimo/necessidade, venda da loja debita, sugestão de mínimo pelo trimestre.
4. ✅ [[SESSAO-24 - Estoque Nucleo - Aguardo Cancelamentos e Alocacao]] (entregue 27/09) — com o desenho novo do dono: quadros só por arrasto, "Concluir produção" só na LIMPEZA E EMBALAGEM → Pedidos em aguardo (abas Pedidos/Produtos reservados), os 3 fluxos de cancelamento e a sugestão do estoque no PCP.
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
2. ✅ **Conta Tiny da fábrica resolvida (21–23/09):** conta FábricaDomoby, plano Evoluir, token no compose do n8n, integração no ar. **Fica com você:** o saldo negativo das peças no Tiny (P16 — decidido: na plataforma vira 0; a correção no Tiny é sua) e as 6 perguntas do início da SESSAO-25.
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
