---
titulo: "Execução — SESSAO-22 · Produção: filas reais, tempo de PCP e paginação"
tipo: memoria-execucao
data: 2026-09-21
atualizado: 2026-09-21
tags: [plataforma, execucao, sessao-22, bloco-5]
---

# 🔧 Execução — SESSAO-22

**Branch:** `sessao-22-filas-tempo-paginacao` (criada de `main` em 21/09, topo `f7841b2`).
**Demanda:** [[SESSAO-22 - Producao - Filas Reais Tempo de PCP e Paginacao]] · Plano: [[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]]

## Respostas do dono (21/09 — o OK do checkpoint)

1. **Etapas fila:** todos os setores de produção já têm a sua fila cadastrada — nenhum sem.
2. **Tempo em PCP é do PEDIDO:** pedido com N produtos — cada produto tem seu tempo de produção próprio; o pedido **só para de contar tempo em PCP quando for liberado por completo** (todas as unidades). Depois, em **Pedidos em aguardo**, o pedido conta **tempo de aguardo total** (insumo futuro do cálculo de tempo de entrega). Todos esses tempos ficam salvos no banco (derivados de eventos — M-02).
3. **Pausa:** a pessoa pausada **retoma sozinha**, mas só **quando finalizar o produto que o líder passou na frente**.
4. **Limite 1 em todos os setores**, editável nas configurações do setor — permissão de **líderes e admins**.
5. **Retomar com a urgência ainda aberta é recusado** — tem que concluir a urgência antes de pegar outro (a trava do limite vale para retomar).

## Task list (espelho da demanda — conferir item a item no fim)

- [ ] 1a. Banco: evento de chegada em setor de produção sem etapa → resolve para a **etapa fila** (trigger BEFORE preenche `etapa_destino_id`)
- [ ] 1b. Front: coluna "Chegada" some dos setores de **produção** (fica em terminais); aviso quando setor de produção não tem fila; seletores de destino param de oferecer "Chegada" para produção
- [ ] 1c. Migração dos cards vivos com etapa nula → evento `movimentacao_etapa` em lote, origem `api` (SQL de manutenção; contagem antes/depois AQUI)
- [ ] 2a. Banco: tempo em PCP verdadeiro — projeção `liberado_completo_em` no card de pedido + derivação (view/portas) do intervalo entrada→liberação completa; DROP+CREATE onde a forma muda (E-17), inclusive migration antiga
- [ ] 2b. Front: card de unidade/linha do tempo mostram o tempo em PCP verdadeiro; histórico passa a mostrar dias, não "0:11"
- [ ] 2c. Pedidos em aguardo: tempo de aguardo do pedido visível (resposta 2 do dono)
- [ ] 3a. Paginação no servidor por etapa: 10 cards + "Ver mais" (limite/deslocamento); contagem por agregado barato
- [ ] 3b. PCP paginado (pedidos abertos filtrados no servidor via `liberado_completo_em`)
- [ ] 3c. Regra nova "cada tela requisita só o que mostra" promovida: CLAUDE do repo + cópia do cofre + Modelo de Sistema
- [ ] 4a. Limite padrão 1 (default da coluna + manutenção nos setores existentes); edição por líder/admin nas configurações do setor
- [ ] 4b. Eventos `execucao_pausada`/`execucao_retomada` (check novo valida tudo — E-19); validação em `fn_validar_execucao` (M-14); projeção `plt_cards.pausado_em`
- [ ] 4c. Pausado não conta tempo nem ocupa o limite; retomar passa pela trava do limite (resposta 5)
- [ ] 4d. UI: pausar (líder/admin) e retomar; card pausado com ícone + texto (M-12); linha do tempo mostra pausa/retomada
- [ ] 5. Registrar D-48 (revisão D-24/Q-17 + modelo do tempo PCP/aguardo) em PLT - Decisoes de Produto; atualizar item 2 da demanda (resposta do dono difere das 2 alternativas do texto)
- [ ] 6. Checklist final: test:banco 2×, tsc, lint, vitest, build, F-07 (375/768px), ⏸️ F-08 antes de aplicar migration, advisors, requisitos novos em PLT - Requisitos, handoff + notas do cofre

## Decisões técnicas tomadas

- **DT-1 (etapa fila na escrita):** trigger BEFORE em `plt_eventos` preenche `etapa_destino_id` com a etapa `eh_fila` quando o destino é setor de **produção** e a etapa veio nula — o evento nasce completo; views e projeção ficam coerentes sem retrabalho. PCP e terminais seguem aceitando etapa nula.
- **DT-2 (tempo PCP):** nova projeção `plt_cards.liberado_completo_em` (só card de pedido), escrita por trigger quando a contagem de unidades liberadas alcança o total (mesma regra k/n de `plt_fn_pedido_itens_kanban`, que lê `pedido_itens` como definer). Serve dois usos: fim do tempo em PCP e filtro de "pedidos abertos" no servidor (paginação do PCP).
- **DT-3 (paginação):** consultas por etapa com `limite/deslocamento` (infinite query, 10/página) + RPC de contagem por etapa; o quadro nunca baixa o setor inteiro.
- **DT-4 (pausa):** `evento_referencia_id` da pausa aponta o `execucao_iniciada` aberto; retomada aponta a pausa. `plt_vw_execucoes` recriada descontando os intervalos pausados da `duracao`.
- **DT-5 (lotes/manutenção):** migração dos vivos e limite 1 nos setores existentes vão em `supabase/manutencao/` (padrão S15), testados no `test:banco` antes; o default novo da coluna vai na migration (setor novo nasce com 1).

## Diário (computar TUDO enquanto executa)

- 21/09 · Leituras obrigatórias completas; checkpoint (a)(b)(c) apresentado; dono respondeu as 5 dúvidas (acima) — OK para executar.
- 21/09 · Branch criada. Working tree tinha 2 arquivos soltos de outra frente (`N8N - Tiny Fabrica - Estudo do Cadastro.md`, `PROMPT - Bloco 5`) — não tocar; commits por caminho explícito (E-23).
- 21/09 · **D-48 registrada** em PLT - Decisoes de Produto; demanda (item 2 + status) e índice atualizados. O índice ganhou fora desta sessão a promoção da SESSAO-21 para "pronta para code" (rodará logo após o handoff da S22 — anotado, nada a fazer aqui).
- 21/09 · **Migration 29** (`20260921120000_plt_filas_tempo_pausa_paginacao.sql`): check com `execucao_pausada`/`execucao_retomada` (valida tudo no fim — E-19); trigger `fn_resolver_etapa_fila` (BEFORE, nome ordenado antes dos `validar_*`); colunas `plt_cards.pausado_em` e `liberado_completo_em` + índice parcial do PCP; `fn_recalcular_liberacao` (regra k/n idêntica à do kanban); `fn_projetar_posicao` e `fn_validar_execucao` recriadas (pausa/retomada, limite ignora pausados, retomada revalida o limite para o EXECUTOR, referências preenchidas pelo trigger); helper `fn_pausas_execucao` (INVOKER, como `fn_evento_estornado`); `plt_vw_execucoes` DROP+CREATE com `pausa_total`/`pausado_desde` e `duracao` descontada; `plt_vw_permanencias` fecha o PCP do card de pedido em `liberado_completo_em`; 6 portas recriadas com desconto de pausa (`dash_execucoes/tempos_setor/tempos_pessoa/tempos_item/metas_painel/tendencia_semanas`); `plt_fn_pedidos_kanban` (+`entrou_pcp_em`, `liberado_completo_em`) e `plt_fn_pedidos_aguardo` (+`primeira_pronta_em`, `completo_em`) DROP+CREATE; RPC nova `plt_fn_definir_limite_execucoes` (líder do setor/admin, com trilha D-40); default do limite = 1; recompute retroativo da liberação completa.
- 21/09 · **Edições-espelho na migration 25** (E-17/E-19): `drop function` antes do create de `plt_fn_pedidos_aguardo` e o `validate constraint` final REMOVIDO (mudou de casa para a 29 — reaplicar a 25 num banco com eventos de pausa quebraria).
- 21/09 · **Manutenção** (2 arquivos, padrão S15): `2026-09-21_migrar_cards_chegada_para_fila.sql` (evento em lote origem `api`, só produção COM fila; passos contar/executar/conferir) e `2026-09-21_limite_execucoes_padrao_1.sql` (null→1 nos existentes; fora da migration de propósito — reaplicação não pode sobrescrever escolha do admin).
- 21/09 · **test:banco**: bloco S22 novo no harness (limite padrão + manutenção rodada de verdade; resolver de fila com evento completo; PCP parcial vs completo + retroativo; lote chegada→fila com setor sem fila; pausa com prova aritmética 90−70=20min na view E na porta de dashboard; RPC do limite com gate e log; aguardo). 1º erro meu: usei pedido 999998, que o harness já ocupava → troquei para 999990. **TUDO VERDE em 2 rodadas.**
