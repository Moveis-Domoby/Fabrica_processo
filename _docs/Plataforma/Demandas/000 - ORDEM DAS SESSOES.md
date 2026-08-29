---
titulo: Ordem das Sessões de Construção
tipo: indice
data: 2026-08-19
atualizado: 2026-08-28
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
| 13º | [[SESSAO-13 - Navegacao Perfil e Identidade]] | **A reforma da casca (D-36):** navegação em 2 barras (pai→filho) recolhíveis, rotas `/pai/filho`, voltar em toda tela, sino no topo + popover corrigido, Meu Perfil com 8 temas (D-41), login novo, log de tudo (D-40) | 07, 12 | ✅ entregue — [[handoff_2026_08_28_sessao13_navegacao]] (aguarda revisão/merge do dono) |
| 14º | [[SESSAO-14 - Meu Painel e Metas]] | Início vira **Meu Painel**: pendências, notificações e cockpit de metas configuráveis em tempo real (D-37) | 13 | 📐 pronta para code |
| 15º | [[SESSAO-15 - Logistica e ROTAS com Caminhoes]] | Estoque digitável, **Pedidos em aguardo**, Danificados com destino (D-38) e ROTAS com programação de caminhão + mapa (D-39) | 13 | 📐 pronta para code |
| 16º | [[SESSAO-16 - Dashboards de Verdade]] | Reconstruir os dashboards nos moldes de `docs/inspiracao/dashboards/` (D-42) | 13, 14 | 📐 pronta para code |
| 17º | [[SESSAO-17 - Automacoes Internas]] | Builder "quando X, faça Y" + central de notificações | 11 | ⏸️ standby (D-35) |
| 18º | [[SESSAO-18 - Painel Admin Completo]] | Consolidação do admin (revisar escopo: Equipe/Estrutura/Caminhões já entram no dropdown nas 13/15) | 17 | ⏸️ standby (D-35) |

**Depois:** módulo de estoque completo (fase 2 — D-07), migração dos cards vivos (Q-25), app/fluxo do motorista.

## Regras deste índice

- Status possíveis: `🔶 rascunho` → `📐 pronta para code` → `🔨 em execução` → `✅ entregue (handoff linkado)` (e `⏸️ standby/adiada`).
- Reordenar é permitido ATÉ a sessão virar `🔨` — depois disso, mudança de ordem é decisão registrada em [[PLT - Decisoes de Produto]].
- Toda sessão entregue linka aqui o handoff correspondente de `Handoffs/`.
- Descoberta no meio de uma sessão que muda outra demanda → atualizar o arquivo da demanda afetada na hora (regra 8 do [[CLAUDE - Regras do Claude Code (repo)]]) — e a lição vai para [[PLT - Memoria de Aprendizado]].

## Ver também

[[PLT - Visao Geral]] · [[PLT - Decisoes de Produto]] · [[PLT - Requisitos]] · [[PLT - Memoria de Aprendizado]] · [[TEMPLATE - Demanda]]
