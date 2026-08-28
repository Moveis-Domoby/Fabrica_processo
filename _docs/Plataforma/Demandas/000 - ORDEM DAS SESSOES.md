---
titulo: Ordem das Sessões de Construção
tipo: indice
data: 2026-08-19
atualizado: 2026-08-24
tags: [plataforma, demandas, sessoes, roadmap]
---

# 🧭 Ordem das Sessões de Construção

> [!abstract] Como funciona (D-10)
> Cada sessão é **uma conversa separada do Claude Code** que executa UMA demanda, na ordem abaixo, sob as regras de [[CLAUDE - Regras do Claude Code (repo)]]. O dono acompanha cada sessão e volta ao Cowork entre elas para refinar as próximas. Uma sessão só começa quando sua demanda estiver `📐 pronta para code` (dúvidas de negócio resolvidas) e a anterior tiver handoff revisado.
>
> ⚠️ **Desde 27/08/2026, número = ordem** (pedido do dono no complemento da D-23; isto revisa o M-09). A tabela foi reordenada em 24/08 pela D-11, replanejada em 27/08 pela D-23 (nasce a sessão de publicação; entrada via n8n sai da frente) e **renumerada na mesma data** para os números espelharem a ordem. Bloco 2 = 05→09 · Bloco 3 = 10→14.
>
> **De-para da renumeração** (para ler handoffs e decisões antigas): Dashboards 08→**10** · Tarefas 09→**12** · API completa 10→**11** · Automações 11→**13** · Admin 12→**14** · Entrada n8n 13→**09** · Publicação 14→**08** (as sessões 01–07 não mudaram).

| Ordem | Sessão | Entrega em uma frase | Depende de | Status |
|---|---|---|---|---|
| 1º | [[SESSAO-01 - Fundacao do Repo e Design System]] | Repo + app React rodando + design system documentado | — | ✅ entregue — [[handoff_2026_08_24_sessao01_fundacao]] (mesclada na `main`) |
| 2º | [[SESSAO-02 - Banco e Dominio no Supabase]] | Schema completo da plataforma em migrations — **aplicado no banco em 26/08 com autorização do dono (D-19)** | 01 | ✅ entregue — [[handoff_2026_08_26_sessao02_banco]] |
| 3º | [[SESSAO-03 - Autenticacao Perfis e Permissoes]] | Login, convites, papéis operador/líder/admin | 02 | ✅ entregue — [[handoff_2026_08_27_sessao03_autenticacao]] (mesclada na `main` em 27/08) |
| 4º | [[SESSAO-04 - Kanban Nucleo]] | Quadros, etapas, cards híbridos (pedido→unidades), drag-and-drop | 03 | ✅ entregue — [[handoff_2026_08_27_sessao04_kanban]] |
| 5º | [[SESSAO-05 - Timers e Eventos de Tempo]] | Fila (do setor) vs execução (da pessoa), eventos imutáveis — **a razão de existir** | 04 | ✅ entregue — [[handoff_2026_08_27_sessao05_timers]] (merge aguarda OK) |
| 6º | [[SESSAO-06 - Qualidade nas Transicoes]] | 3 estados + dupla marcação, sem disputa (D-09 revisada) | 05 | 🔶 rascunho |
| 7º | [[SESSAO-07 - Tela do Setor Tablet]] | A tela do chão de fábrica: fila do setor, PIN, botões grandes — nasce com a qualidade embutida | 05, 06 | 🔶 rascunho |
| 8º | [[SESSAO-08 - Publicacao no Ar]] | **A plataforma hospedada e acessível dos tablets do galpão** (Q-62/Q-60); encerra a permissão da D-19 | 07 | 🔶 rascunho |
| 9º | [[SESSAO-09 - Entrada de Pedidos via n8n]] | **Pedido do Tiny vira card no PCP sozinho** (n8n empurra) — ↩️ reposicionada pela D-23 | 04 | 🔶 rascunho |
| 10º | [[SESSAO-10 - Dashboards e Visualizacoes Salvas]] | Produtividade + qualidade sobre dados REAIS, comparativo fila/execução, views salvas | 06, 07 | 🔶 rascunho |
| 11º | [[SESSAO-11 - API Aberta e Integracao n8n]] | API completa: CRUD/mover, gestão de chaves, webhooks, ponte ROTAS | 05, 09 | 🔶 rascunho |
| 12º | [[SESSAO-12 - Tarefas e Delegacao]] | Meus afazeres/time, delegação aleatória e direta | 04 | 🔶 rascunho |
| 13º | [[SESSAO-13 - Automacoes Internas]] | Builder "quando X, faça Y" + central de notificações | 11 | 🔶 rascunho |
| 14º | [[SESSAO-14 - Painel Admin Completo]] | Consolidação: gestão total de setores, etapas, usuários, chaves, automações | 13 | 🔶 rascunho |

**Depois:** módulo de estoque (fase 2 — D-07), migração dos cards vivos (Q-25), logística/ROTAS (D-05).

## Regras deste índice

- Status possíveis: `🔶 rascunho` → `📐 pronta para code` → `🔨 em execução` → `✅ entregue (handoff linkado)`.
- Reordenar é permitido ATÉ a sessão virar `🔨` — depois disso, mudança de ordem é decisão registrada em [[PLT - Decisoes de Produto]].
- Toda sessão entregue linka aqui o handoff correspondente de `Handoffs/`.
- Descoberta no meio de uma sessão que muda outra demanda → atualizar o arquivo da demanda afetada na hora (regra 8 do [[CLAUDE - Regras do Claude Code (repo)]]) — e a lição vai para [[PLT - Memoria de Aprendizado]].

## Ver também

[[PLT - Visao Geral]] · [[PLT - Decisoes de Produto]] · [[PLT - Requisitos]] · [[PLT - Memoria de Aprendizado]] · [[TEMPLATE - Demanda]]
