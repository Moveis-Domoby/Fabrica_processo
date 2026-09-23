---
titulo: Ordem das Sessões de Construção
tipo: indice
data: 2026-08-19
atualizado: 2026-09-23
tags: [plataforma, demandas, sessoes, roadmap]
---

# 🧭 Ordem das Sessões de Construção

> [!abstract] Como funciona (D-10)
> Cada sessão é **uma conversa separada do Claude Code** que executa UMA demanda, na ordem abaixo, sob as regras de [[CLAUDE - Regras do Claude Code (repo)]]. O dono acompanha cada sessão e volta ao Cowork entre elas para refinar as próximas. Uma sessão só começa quando sua demanda estiver `📐 pronta para code` (dúvidas de negócio resolvidas) e a anterior tiver handoff revisado.
>
> ⚠️ **Desde 27/08/2026, número = ordem** (pedido do dono no complemento da D-23; isto revisa o M-09).
>
> **De-para das renumerações** (para ler handoffs e decisões antigas):
> - 27/08 (D-23): Dashboards 08→**10** · Tarefas 09→**12** · API completa 10→**11** · Automações 11→13 · Admin 12→14 · Entrada n8n 13→**09** · Publicação 14→**08**.
> - 28/08 (D-35 — bloco 3, a reforma): **Automações 13→17 · Painel Admin 14→18**; as novas **13–16 são a reforma** (D-36…D-42), com checkpoint por sessão.
> - 15/09 (D-46 — bloco União): entram as **SESSÕES 19–21 (União das Plataformas)**. Ordem real de execução: **16 → 19 (pode correr em paralelo com a 16) → 20 → 21**; 17 e 18 seguem em standby. A 20 só começa com a 16 entregue — as duas mexem em `App.tsx`, `Layout.tsx` e `tokens.css`. ↩️ Revisa a nota de 15/09 que dizia "19–21 antes das 16–18" (ver D-46).
> - 18/09 (**Bloco 5** — [[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]]): entram as **SESSÕES 22–28** (produção, estoque, chat, automações, rota). Ordem decidida com o dono: **16 → 22 → 23 → 24 → 25 → 26 → 27 → 28**; a **21 roda na janela que o dono definir** (não bloqueia o bloco). A **17 foi absorvida pela 27** (o builder virou canvas); a 18 segue em standby.

| Ordem | Sessão | Entrega em uma frase | Depende de | Status |
|---|---|---|---|---|
| 1º | [[SESSAO-01 - Fundacao do Repo e Design System]] | Repo + app React rodando + design system documentado | — | ✅ entregue — [[handoff_2026_08_24_sessao01_fundacao]] (mesclada na `main`) |
| 2º | [[SESSAO-02 - Banco e Dominio no Supabase]] | Schema completo da plataforma em migrations — **aplicado no banco em 26/08 com autorização do dono (D-19)** | 01 | ✅ entregue — [[handoff_2026_08_26_sessao02_banco]] |
| 3º | [[SESSAO-03 - Autenticacao Perfis e Permissoes]] | Login, convites, papéis operador/líder/admin | 02 | ✅ entregue — [[handoff_2026_08_27_sessao03_autenticacao]] (mesclada na `main` em 27/08) |
| 4º | [[SESSAO-04 - Kanban Nucleo]] | Quadros, etapas, cards híbridos (pedido→unidades), drag-and-drop | 03 | ✅ entregue — [[handoff_2026_08_27_sessao04_kanban]] |
| 5º | [[SESSAO-05 - Timers e Eventos de Tempo]] | Fila (do setor) vs execução (da pessoa), eventos imutáveis — **a razão de existir** | 04 | ✅ entregue — [[handoff_2026_08_27_sessao05_timers]] (mesclada na `main` em 27/08) |
| 6º | [[SESSAO-06 - Qualidade nas Transicoes]] | 3 estados + dupla marcação, sem disputa (D-09 revisada) | 05 | ✅ entregue — [[handoff_2026_08_27_sessao06_qualidade]] (dúvidas viraram a D-25) |
| 7º | [[SESSAO-07 - Tela do Setor Tablet]] | A tela do chão de fábrica: fila do setor, PIN na tela, tempo real + som — e o prelúdio D-27 | 05, 06 | ✅ entregue — [[handoff_2026_08_28_sessao07_tela_setor]] (bloco noturno D-26) |
| 8º | [[SESSAO-08 - Publicacao no Ar]] | **A plataforma hospedada e acessível dos tablets do galpão** (Q-62/Q-60); encerra a permissão da D-19 | 07 | ⏸️ adiada (D-30 — o dono avisa quando for lançar) |
| 9º | [[SESSAO-09 - Entrada de Pedidos via n8n]] | **Pedido do Tiny vira card no PCP sozinho** — por trigger no banco (D-31) | 04 | ✅ entregue — [[handoff_2026_08_28_sessao09_entrada_pedidos]] (bloco noturno D-26) |
| 10º | [[SESSAO-10 - Dashboards e Visualizacoes Salvas]] | Tempo em 1º lugar (D-32): portas de leitura + views salvas | 06, 07 | ✅ entregue — [[handoff_2026_08_28_sessao10_dashboards]] · **visual rejeitado pelo dono → refeito na 16 (D-42); os dados ficam** |
| 11º | [[SESSAO-11 - API Aberta e Integracao n8n]] | API por chave + webhooks de saída + ROTAS na plataforma (D-33) | 05, 09 | ✅ entregue — [[handoff_2026_08_28_sessao11_api_rotas]] (bloco noturno D-26) |
| 12º | [[SESSAO-12 - Tarefas e Delegacao]] | Meus afazeres/time, delegação em 3 modos (D-34) | 04 | ✅ entregue — [[handoff_2026_08_28_sessao12_tarefas]] (fecha o bloco noturno D-26) |
| 13º | [[SESSAO-13 - Navegacao Perfil e Identidade]] | **A reforma da casca (D-36):** navegação em 2 barras (pai→filho) recolhíveis, rotas `/pai/filho`, voltar em toda tela, sino no topo + popover corrigido, Meu Perfil com 8 temas (D-41), login novo, log de tudo (D-40) | 07, 12 | ✅ entregue — [[handoff_2026_08_28_sessao13_navegacao]] (mesclada na main em 28/08) |
| 14º | [[SESSAO-14 - Meu Painel e Metas]] | Início vira **Meu Painel**: pendências, notificações e cockpit de metas configuráveis em tempo real (D-37) | 13 | ✅ entregue — [[handoff_2026_09_01_sessao14_meu_painel]] (mesclada na main em 01/09) |
| 15º | [[SESSAO-15 - Logistica e ROTAS com Caminhoes]] | Estoque digitável, **Pedidos em aguardo**, Danificados com destino (D-38) e ROTAS com programação de caminhão + mapa (D-39) | 13 | ✅ entregue — [[handoff_2026_09_08_sessao15_logistica_rotas]] (migration 25 aplicada em 08/09; mesclada na main e publicada em 15/09) |
| 16º | [[SESSAO-16 - Dashboards de Verdade]] | Reconstruir os dashboards nos moldes de `_docs/Plataforma/Inspiracao/dashboards/` (D-42) | 13, 14 | ✅ entregue — [[handoff_2026_09_18_sessao16_dashboards]] (migration 28 aplicada em 18/09; validada ao vivo com o dono e **mesclada na `main` pelo PR #4 em 18/09** — D-20). As 4 telas-filhas no ar; visualizações salvas da S10 traduzidas por leitura |
| 17º | [[SESSAO-17 - Automacoes Internas]] | ~~Builder "quando X, faça Y" + central de notificações~~ | — | 🔁 **absorvida pela [[SESSAO-27 - Automacoes em Canvas]]** (18/09); a central de notificações com preferências segue futura |
| 18º | [[SESSAO-18 - Painel Admin Completo]] | Consolidação do admin (revisar escopo: Equipe/Estrutura/Caminhões já entram no dropdown nas 13/15) | — | ⏸️ standby (D-35) |
| 19º ⏫ | [[SESSAO-19 - Uniao 1 - Banco do Comercial na Fabrica]] | Domínio do Painel de Recompra no Supabase da fábrica: 6 tabelas + view `vendas_marketing` sobre `pedidos` (D-47) + RPCs + RLS + carga de dados validada | 15 | ✅ entregue — [[handoff_2026_09_15_sessao19_banco_comercial]] (migration 26 aplicada e carga com checksum idêntico em 15/09; revisada na conversa e mesclada na `main` pelo PR #3 — D-20) |
| 20º ⏫ | [[SESSAO-20 - Uniao 2 - Modulo Comercial no Front]] | Painel de Recompra recriado idêntico como módulo **Comercial**; "Fábrica" vira pai de Produção/Logística/ROTAS; "Administração" → "Painel admin"; permissões por módulo | 19 | ✅ entregue — [[handoff_2026_09_16_sessao20_modulo_comercial]] (migration 27 aplicada em 15/09; revisada na conversa e **mesclada na `main` em 16/09**). Fixou **Recharts 3.9.2** e os tokens de série que a 16 herda |
| 21º ⏫ | [[SESSAO-21 - Uniao 3 - Cutover e Desligamento]] | Cutover dos crons e do webhook DataCrazy, quarentena e exclusão do projeto Supabase antigo | 19, 20 | ✅ entregue — [[handoff_2026_09_22_sessao21_cutover]] (cutover em 22/09: 4 crons e o renovador do token **só na fábrica**, antigo em quarentena; + conferência Tiny×banco dos 5.360 pedidos com 15 corrigidos). **Aceite em curso:** 24h de renovação (1ª automática 23/09 00:00 ✅) e F7 (data do dono; backup dispensado). DataCrazy repontado e trava aberta em 23/09. Entregue pelos PRs #5 e #6 |
| 22º 🆕 | [[SESSAO-22 - Producao - Filas Reais Tempo de PCP e Paginacao]] | Fim da coluna "Chegada", tempo de PCP verdadeiro no card, 10 cards por etapa + "Ver mais", regra "cada tela requisita só o que mostra", 1 pedido por vez + pausa por líder — e os extras da revisão: iniciar na fila avança a etapa (D-48↪️) e arquivar/excluir usuário (D-49) | 16 | ✅ entregue — [[handoff_2026_09_21_sessao22_filas_tempo_pausa]] (migrations 29–31 aplicadas em 21–22/09 com aprovação do dono; validada ao vivo, com E2E real de arquivar/excluir; mesclada na `main` em 22/09 — D-20) |
| 23º 🆕 | [[SESSAO-23 - Meu Painel 2 - Filas Pessoais Subtarefas e Tempos]] | Meu Painel com "Delegados a mim / Meus afazeres / Fila de prioridade" reordenável, subtarefas em 2 níveis, tarefa pessoal privada (D-51), qualidade a atestar vira tarefa do "Sistema", "Ver todos" no sino e o painel pessoal "Meu desempenho" | 22 | ✅ entregue — [[handoff_2026_09_23_sessao23_meu_painel_2]] (migration 33 aplicada em 23/09 com permissão total do dono na conversa; **aguardando a validação logada do dono e o merge — D-20**) |
| 24º 🆕 | [[SESSAO-24 - Estoque Nucleo - Aguardo Cancelamentos e Alocacao]] | "Concluir produção" → Pedidos em aguardo (Ver pedidos/Ver itens), 3 fluxos de cancelamento (aba Cancelados no PCP, tag em produção, estoque sem dono), sugestão de alocação no PCP, lançamento manual | 22 | 📐 pronta para code |
| 25º 🆕 | [[SESSAO-25 - Integracao Tiny Fabrica - Estoque e Minimos]] | Integração NOVA com o Tiny da fábrica: lançamento de estoque alimenta o app, venda da loja debita, mínimo/saldo/necessidade de produção + sugestão de mínimo pelo trimestre | 24 | 📐 pronta para code (depende do dono: conta/plano/token) |
| 26º 🆕 | [[SESSAO-26 - Chat Interno]] | Chat autenticado e enxuto em requisições: `/inicio/chat` + balão arrastável com badge; canais, particulares, avisos gerais, aniversários automáticos (campo novo: data de nascimento) | 22 | 📐 pronta para code |
| 27º 🆕 | [[SESSAO-27 - Automacoes em Canvas]] | Automações em canvas (absorve a 17): gatilho "pedido iniciado na etapa X do setor Y"; ações mover card (revisa D-03), arquivar, etiqueta (etiquetas em Configurações) | 22, 24 | 📐 pronta para code |
| 28º 🆕 | [[SESSAO-28 - Rota Calculada no Mapa]] | Linha da Programação vira rota calculada nas ruas (OSRM, grátis), partindo da fábrica; interdições/trânsito = evolução paga futura | 15 | 📐 pronta para code |
| 29º 🆕 | [[SESSAO-29 - Reconciliacao Tiny - Pente-fino e Ultimo Pacote Vence]] | O banco nunca mais diverge do Tiny em silêncio: pente-fino diário, "o último pacote do Tiny vence", cliente pelo id do contato (P17) | 21 | 📐 pronta para code (23/09 — perguntas respondidas, D-50) — nasceu da conferência da S21; posição no bloco a decidir pelo dono |

**Depois:** BOM/insumos (chapas MDF) e custo por móvel · migração dos cards vivos (Q-25) · app/fluxo do motorista · central de notificações com preferências (o resto da antiga 17).

## Regras deste índice

- Status possíveis: `🔶 rascunho` → `📐 pronta para code` → `🔨 em execução` → `✅ entregue (handoff linkado)` (e `⏸️ standby/adiada` · `🔁 absorvida`).
- Reordenar é permitido ATÉ a sessão virar `🔨` — depois disso, mudança de ordem é decisão registrada em [[PLT - Decisoes de Produto]].
- Toda sessão entregue linka aqui o handoff correspondente de `Handoffs/`.
- Descoberta no meio de uma sessão que muda outra demanda → atualizar o arquivo da demanda afetada na hora (regra 8 do [[CLAUDE - Regras do Claude Code (repo)]]) — e a lição vai para [[PLT - Memoria de Aprendizado]].

## Ver também

[[PLT - Visao Geral]] · [[PLT - Decisoes de Produto]] · [[PLT - Requisitos]] · [[PLT - Memoria de Aprendizado]] · [[TEMPLATE - Demanda]] · [[PLT - Plano Uniao das Plataformas]] · [[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]]
