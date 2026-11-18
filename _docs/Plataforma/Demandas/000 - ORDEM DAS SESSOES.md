---
titulo: Ordem das Sessões de Construção
tipo: indice
data: 2026-08-19
atualizado: 2026-11-18
tags: [plataforma, demandas, sessoes, roadmap]
---

# 🧭 Ordem das Sessões de Construção

> [!abstract] Como funciona ([[D-010 - Metodo de trabalho sessoes Claude Code ordenadas CLAUDE md|D-10]])
> Cada sessão é **uma conversa separada do Claude Code** que executa UMA demanda, na ordem abaixo, sob as regras de [[CLAUDE - Regras do Claude Code (repo)]]. O dono acompanha cada sessão e volta ao Cowork entre elas para refinar as próximas. Uma sessão só começa quando sua demanda estiver `📐 pronta para code` (dúvidas de negócio resolvidas) e a anterior tiver handoff revisado.
>
> ⚠️ **Desde 27/08/2026, número = ordem** (pedido do dono no complemento da [[D-023 - Replanejamento da jornada a partir da 5 posicao|D-23]]; isto revisa o [[Memoria - Modelos Formulas e Possibilidades#M-9|M-09]]).
>
> **De-para das renumerações** (para ler handoffs e decisões antigas):
> - 27/08 (D-23): Dashboards 08→**10** · Tarefas 09→**12** · API completa 10→**11** · Automações 11→13 · Admin 12→14 · Entrada n8n 13→**09** · Publicação 14→**08**.
> - 28/08 ([[D-035 - Plataforma funcional primeiro externo em standby Bloco 3|D-35]] — bloco 3, a reforma): **Automações 13→17 · Painel Admin 14→18**; as novas **13–16 são a reforma** ([[D-036 - Lei de navegacao hierarquia pai filho pai nunca navega rota|D-36]]…[[D-042 - Dashboards guiados por imagem docs inspiracao dashboards e|D-42]]), com checkpoint por sessão.
> - 15/09 ([[D-046 - Uniao das Plataformas o Painel de Recompra vira o modulo|D-46]] — bloco União): entram as **SESSÕES 19–21 (União das Plataformas)**. Ordem real de execução: **16 → 19 (pode correr em paralelo com a 16) → 20 → 21**; 17 e 18 seguem em standby. A 20 só começa com a 16 entregue — as duas mexem em `App.tsx`, `Layout.tsx` e `tokens.css`. ↩️ Revisa a nota de 15/09 que dizia "19–21 antes das 16–18" (ver D-46).
> - 18/09 (**Bloco 5** — [[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]]): entram as **SESSÕES 22–28** (produção, estoque, chat, automações, rota). Ordem decidida com o dono: **16 → 22 → 23 → 24 → 25 → 26 → 27 → 28** ↩️ **revisada em 24/09 ([[D-053 - Estoque na frente a 25 troca de ordem com a 24 e absorve|D-53]]): 16 → 22 → 23 → 25 → 24 → 26 → 27 → 28** — a 25 (estoque) passou na frente por urgência do dono, e o estoque-base saiu da 24 para ela; a **21 roda na janela que o dono definir** (não bloqueia o bloco). A **17 foi absorvida pela 27** (o builder virou canvas); a 18 segue em standby.
> - 07/10 (**Bloco 6** — [[004 - PLANO - Bloco 6 - Producao de Ponta a Ponta e Kanban Completo]]): entram as **SESSÕES 30–31** — o caminho da peça de ponta a ponta (pedido, reabastecimento e entrega) e o kanban completo (card avulso e janela do card). Ordem: **30 → 31** (a base de anexos nasce na 30; as duas mexem no PCP e no quadro — em paralelo só com worktree pedida pelo dono). ↪️ 07/10: entra a **SESSÃO 32 — desempenho e escala** (a [[PLT - Lei de Desempenho e Escala]], regra 18), **depois da 31** por decisão do dono; a 30 e a 31 já seguem a lei em tudo o que tocam. E a **regra 19**: cada sessão move as suas tarefas do ClickUp para FAZENDO e nunca as conclui — o dono conclui.
> ↪️ **18/11/2026 (SESSAO-49):** esta tabela ficou **curta** — uma linha por sessão, com o status e o handoff. O resumo longo de cada linha (a "entrega em uma frase", as dependências e as notas ↪️ acumuladas, inclusive as de 18/11) está, inteiro e sem reescrever, em [[Ordem das Sessoes - resumos longos ate 18-11-2026]]; o que a sessão entrega está na própria demanda. As decisões citadas aqui: [[PLT - Decisoes de Produto]].

| Ordem | Sessão | Status |
|---|---|---|
| 1º | [[SESSAO-01 - Fundacao do Repo e Design System]] | ✅ entregue · [[handoff_2026_08_24_sessao01_fundacao\|handoff]] |
| 2º | [[SESSAO-02 - Banco e Dominio no Supabase]] | ✅ entregue · [[handoff_2026_08_26_sessao02_banco\|handoff]] |
| 3º | [[SESSAO-03 - Autenticacao Perfis e Permissoes]] | ✅ entregue · [[handoff_2026_08_27_sessao03_autenticacao\|handoff]] |
| 4º | [[SESSAO-04 - Kanban Nucleo]] | ✅ entregue · [[handoff_2026_08_27_sessao04_kanban\|handoff]] |
| 5º | [[SESSAO-05 - Timers e Eventos de Tempo]] | ✅ entregue · [[handoff_2026_08_27_sessao05_timers\|handoff]] |
| 6º | [[SESSAO-06 - Qualidade nas Transicoes]] | ✅ entregue · [[handoff_2026_08_27_sessao06_qualidade\|handoff]] |
| 7º | [[SESSAO-07 - Tela do Setor Tablet]] | ✅ entregue · [[handoff_2026_08_28_sessao07_tela_setor\|handoff]] |
| 8º | [[SESSAO-08 - Publicacao no Ar]] | ✅ entregue — fechada em 16/10 ([[D-141 - As respostas do dono sobre o que ficou da SESSAO-32 e\|D-141]]) |
| 9º | [[SESSAO-09 - Entrada de Pedidos via n8n]] | ✅ entregue · [[handoff_2026_08_28_sessao09_entrada_pedidos\|handoff]] |
| 10º | [[SESSAO-10 - Dashboards e Visualizacoes Salvas]] | ✅ entregue · [[handoff_2026_08_28_sessao10_dashboards\|handoff]] |
| 11º | [[SESSAO-11 - API Aberta e Integracao n8n]] | ✅ entregue · [[handoff_2026_08_28_sessao11_api_rotas\|handoff]] |
| 12º | [[SESSAO-12 - Tarefas e Delegacao]] | ✅ entregue · [[handoff_2026_08_28_sessao12_tarefas\|handoff]] |
| 13º | [[SESSAO-13 - Navegacao Perfil e Identidade]] | ✅ entregue · [[handoff_2026_08_28_sessao13_navegacao\|handoff]] |
| 14º | [[SESSAO-14 - Meu Painel e Metas]] | ✅ entregue · [[handoff_2026_09_01_sessao14_meu_painel\|handoff]] |
| 15º | [[SESSAO-15 - Logistica e ROTAS com Caminhoes]] | ✅ entregue · [[handoff_2026_09_08_sessao15_logistica_rotas\|handoff]] |
| 16º | [[SESSAO-16 - Dashboards de Verdade]] | ✅ entregue · [[handoff_2026_09_18_sessao16_dashboards\|handoff]] |
| 17º | [[SESSAO-17 - Automacoes Internas]] | 🔁 absorvida pela |
| 18º | [[SESSAO-18 - Painel Admin Completo]] | ⏸️ standby |
| 19º ⏫ | [[SESSAO-19 - Uniao 1 - Banco do Comercial na Fabrica]] | ✅ entregue · [[handoff_2026_09_15_sessao19_banco_comercial\|handoff]] |
| 20º ⏫ | [[SESSAO-20 - Uniao 2 - Modulo Comercial no Front]] | ✅ entregue · [[handoff_2026_09_16_sessao20_modulo_comercial\|handoff]] |
| 21º ⏫ | [[SESSAO-21 - Uniao 3 - Cutover e Desligamento]] | ✅ entregue · [[handoff_2026_09_22_sessao21_cutover\|handoff]] |
| 22º 🆕 | [[SESSAO-22 - Producao - Filas Reais Tempo de PCP e Paginacao]] | ✅ entregue · [[handoff_2026_09_21_sessao22_filas_tempo_pausa\|handoff]] |
| 23º 🆕 | [[SESSAO-23 - Meu Painel 2 - Filas Pessoais Subtarefas e Tempos]] | ✅ entregue · [[handoff_2026_09_23_sessao23_meu_painel_2\|handoff]] |
| **24ª na fila** (arquivo 25) 🆕⏫ | [[SESSAO-25 - Integracao Tiny Fabrica - Estoque e Minimos]] | ✅ entregue · [[handoff_2026_09_26_sessao25_estoque\|handoff]] |
| **25ª na fila** (arquivo 24) 🆕 | [[SESSAO-24 - Estoque Nucleo - Aguardo Cancelamentos e Alocacao]] | ✅ entregue · [[handoff_2026_09_27_sessao24_producao_concluida\|handoff]] |
| 26º 🆕 | [[SESSAO-26 - Chat Interno]] | ✅ entregue · [[handoff_2026_09_27_sessao26_chat\|handoff]] |
| 27º 🆕 | [[SESSAO-27 - Automacoes em Canvas]] | ✅ entregue · [[handoff_2026_10_02_sessao27_automacoes_canvas\|handoff]] |
| 28º 🆕 | [[SESSAO-28 - Rota Calculada no Mapa]] | ✅ entregue · [[handoff_2026_10_02_sessao28_rota_calculada\|handoff]] |
| 29º 🆕 | [[SESSAO-29 - Reconciliacao Tiny - Pente-fino e Ultimo Pacote Vence]] | ✅ entregue · [[handoff_2026_10_01_sessao29_reconciliacao_tiny\|handoff]] |
| 30º 🆕 | [[SESSAO-30 - Producao de Ponta a Ponta - Pedido Reabastecimento e Entrega]] | ✅ entregue · [[handoff_2026_10_08_sessao30_producao_ponta_a_ponta\|handoff]] |
| 31º 🆕 | [[SESSAO-31 - Kanban Completo - Card Avulso Janela do Card Anexos e Conversa]] | ✅ entregue · [[handoff_2026_10_14_sessao31_kanban_completo\|handoff]] |
| 32º 🆕 | [[SESSAO-32 - Desempenho e Escala - Adequacao de Toda a Plataforma]] | ✅ entregue · [[handoff_2026_10_16_sessao32_desempenho_escala\|handoff]] |
| 33º 🆕 | [[SESSAO-33 - Tiny Completo - Todos os Dados Atualizados por Evento]] | 📦 entregue em arquivo · [[handoff_2026_10_17_sessao33_tiny_completo\|handoff 1]] · [[handoff_2026_10_22_sessao33_o_que_o_tiny_nao_avisa\|handoff 2]] |
| 34º 🆕 | *(a mapear com o dono)* Rotinas do banco por evento, sem relógio | 📝 a mapear |
| 35º 🆕 | *(a mapear com o dono)* Baixa dos insumos por etapa | 📝 a mapear |
| 36º 🆕⏫ | [[SESSAO-36 - Tablet 2.0 - Login por Setor Auxiliares e Tempos por Pessoa]] | ✅ ENTREGUE E NO AR · [[handoff_2026_10_18_sessao36_tablet_2_0\|handoff]] |
| 37º ⚡ | *(sem arquivo — ditada ao vivo pelo dono, 19/10)* | ✅ ENTREGUE E NO AR na mesma madrugada |
| 38º ⚡ | [[SESSAO-38 - Bateria de Ajustes - Cards Rotas Expedicao Stand-by e Login]] | ✅ ENTREGUE E NO AR · [[handoff_2026_10_21_sessao38_bateria_ajustes\|handoff]] |
| 39º ⚡ | [[SESSAO-39 - Calendario das Rotas Painel de Motivos Google Maps e Mover]] | ✅ no ar · [[handoff_2026_10_22_sessao39_calendario_motivos_mover\|handoff]] |
| 40º ⚡ | [[SESSAO-40 - Lancar Qualquer Produto Filtro por Pedido e Busca Geral]] | ✅ no ar · [[handoff_2026_10_23_sessao40_lancar_filtro_busca\|handoff]] |
| 41º ⚡ | [[SESSAO-41 - Rotas Entrega Parcial Parada Avulsa Senha Tablet e Quadro]] | ✅ no ar · [[handoff_2026_10_27_sessao41_rotas_senha_tablet_quadro\|handoff]] |
| 42º 🆕 | [[SESSAO-42 - Tempo Certo - Calendario Regras e Calculo Unico]] | ✅ no ar · [[handoff_2026_10_31_sessao42_tempo_certo\|handoff]] |
| 43º 🆕 | [[SESSAO-43 - Tela Tempos de Producao Modo TV e Historico do Trello]] | ✅ NO AR · [[handoff_2026_11_05_sessao43_tempos_producao_modo_tv\|handoff]] |
| 44º ⏫ | [[SESSAO-44 - Entrega que Volta do Tiny e Itens Novos no PCP]] | ✅ entregue · [[handoff_2026_11_04_sessao44_entrega_tiny_itens_novos\|handoff]] |
| 45º ⏫ | [[SESSAO-45 - Rotas no Mapa Certo Liberar Peca na Expedicao e PCP Honesto]] | ✅ entregue e no ar · [[handoff_2026_11_04_sessao45_rotas_expedicao_pcp\|handoff]] |
| 46º 🆕 | [[SESSAO-46 - Tech - Sugestao de Melhoria]] | ✅ entregue · [[handoff_2026_11_05_sessao46_tech_sugestoes\|handoff]] |
| 47º 🆕 | [[SESSAO-47 - Pedido Adiantado no Tiny Data Real da Entrega Comprovantes e Painel de Tempos]] | ✅ entregue e no ar · [[handoff_2026_11_09_sessao47_pedido_adiantado_entrega_comprovantes_tempos\|handoff]] |
| 48º ⏫ | [[SESSAO-48 - Cancelar Fabricacao de Verdade - Peca de Pedido Pergunta o Destino]] | ✅ entregue e no ar · [[handoff_2026_11_11_cowork_sessao48_cancelamento_e_recargas\|handoff 1]] · [[handoff_2026_11_11_sessao48_cancelar_fabricacao_recargas\|handoff 2]] |
| 49º ⏫ | [[SESSAO-49 - Dieta da Documentacao - Cofre no Padrao de Mapas do Obsidian]] | 📦 entregue na branch (18/11) — espera a revisão do dono · [[handoff_2026_11_18_sessao49_dieta_da_documentacao\|handoff]] |
| 50º ⏫ | [[SESSAO-50 - Observacao do Item Cancelar e Ocultar no PCP e Editar Endereco da Parada]] | ✅ entregue e no ar · [[handoff_2026_11_12_sessao50_observacao_cancelar_ocultar_endereco\|handoff]] |
| 51º ⏫ | [[SESSAO-51 - Entrega Parcial Mantem a Producao e Mover Card para o PCP]] | ✅ no ar · [[handoff_2026_11_17_sessao51_entrega_parcial_mover_pcp\|handoff]] |

**Depois:** BOM/insumos (chapas MDF) e custo por móvel · migração dos cards vivos (Q-25) · app/fluxo do motorista (↪️ a tela do entregador entra na SESSAO-30) · central de notificações com preferências (o resto da antiga 17). ↪️ **18/11:** a **central de notificações com preferências já existe** (Configurações → Avisos, [[D-202 - OS AVISOS QUE CADA UM RECEBE ESCOLHIDOS EM CONFIGURACOES|D-202]]) e a **tela do entregador** está no ar desde a SESSAO-30; seguem futuros: BOM/insumos e custo por móvel, e a Q-25 (superada na prática pela limpa de 19/10 — falta o dono fechar).

**Ajustes fora da numeração:** ajuste de 28/10 (sem arquivo — ditado ao vivo pelo dono) — ✅ entregue e publicado em 28/10/2026 ([[handoff_2026_10_28_ajuste_senha_reposicao]]; diário [[AJUSTE-2026-10-28]]; migrations 20261028010000/020000; [[D-200 - O PEDIDO DE TROCA DE SENHA PARA E-MAIL SEM CADASTRO AVISA|D-200]] o aviso da troca de senha, [[D-201 - O PEDIDO NOVO USA PELO PCP A PECA SEM DONO QUE JA ESTA|D-201]] a peça em produção ligada ao pedido novo pelo PCP) · [[AJUSTE - Estoque 2 - Top X, necessidade de producao e sugestao por dias uteis]] — ✅ entregue e publicado em 30/09/2026 ([[handoff_2026_09_30_ajuste_estoque_2]]; migrations 45/47/48; [[D-083 - O Top X manda no estoque e o tamanho da pagina e so ele tem|D-83]]…[[D-089 - A lapidacao ao vivo do Estoque|D-89]], revisando [[D-071 - Top 20 a tela do estoque abre pelos 20 mais vendidos|D-71]]/D-72 e o fluxo da reposição da [[D-054 - O fluxo do estoque so peca pronta perfeita e sem pedido|D-54]]; reposição automática DESLIGADA até a contagem inicial).

## Regras deste índice

- Status possíveis: `🔶 rascunho` → `📐 pronta para code` → `🔨 em execução` → `✅ entregue (handoff linkado)` (e `⏸️ standby/adiada` · `🔁 absorvida`).
- ⚠️ **24/09 ([[D-053 - Estoque na frente a 25 troca de ordem com a 24 e absorve|D-53]]):** os **números 24 e 25 continuam nos nomes dos arquivos** (evita quebrar dezenas de links), mas a **ordem de execução é 25 → 24**. Onde número e ordem divergirem, **vale a coluna Ordem desta tabela**.
- Reordenar é permitido ATÉ a sessão virar `🔨` — depois disso, mudança de ordem é decisão registrada em [[PLT - Decisoes de Produto]].
- Toda sessão entregue linka aqui o handoff correspondente de `Handoffs/`.
- Descoberta no meio de uma sessão que muda outra demanda → atualizar o arquivo da demanda afetada na hora (regra 8 do [[CLAUDE - Regras do Claude Code (repo)]]) — e a lição vai para [[PLT - Memoria de Aprendizado]].

## Ver também

[[PLT - Visao Geral]] · [[PLT - Decisoes de Produto]] · [[PLT - Requisitos]] · [[PLT - Memoria de Aprendizado]] · [[TEMPLATE - Demanda]] · [[PLT - Plano Uniao das Plataformas]] · [[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]] · [[004 - PLANO - Bloco 6 - Producao de Ponta a Ponta e Kanban Completo]]
