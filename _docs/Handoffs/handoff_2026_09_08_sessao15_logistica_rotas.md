---
titulo: Handoff — SESSAO-15 Logística e ROTAS com Caminhões
tipo: handoff
data: 2026-09-08
atualizado: 2026-09-08
tags: [handoff, sessao, plataforma, logistica, rotas, caminhoes]
---

# 📋 Handoff — SESSAO-15 · Logística e ROTAS com Caminhões — a 3ª do Bloco 3 (a reforma)

**Branch:** `sessao-15-logistica-rotas` (4 commits; aguarda seu OK para o merge na `main` — D-20)
**Banco:** migration **25** (`20260908120000_plt_logistica_rotas_caminhoes.sql`) aplicada em 08/09 com sua autorização na conversa, pela API do Supabase. Impressão digital da integração antes = depois (`15152f89…`); contagens só cresceram (o backfill estava rodando). **233 cards históricos arquivados** (aprovado por você). **Edge Function `geocodificar` v1** publicada.
**Demanda:** [[SESSAO-15 - Logistica e ROTAS com Caminhoes]] · **Memória:** `docs/execucao/SESSAO-15.md`
**Decisões que regem:** D-38 · D-39 · D-13 · D-33 · D-01 · D-40 · **D-45** (suas respostas de 01/09 e 08/09, registradas nesta sessão)

## 1. O que foi feito

- **Logística → Estoque** (`/logistica/estoque`): virou LISTA (o quadro kanban do ESTOQUE morreu — D-45): produto, (k/n), pedido, SKU, origem, estado, "parado há" e o **ID de produção digitável** (formato livre, único entre peças vivas, buscável sem diferenciar caixa). Edita: logística (PCP/terminais) e admin.
- **Logística → Pedidos em aguardo**: unidades que chegaram em terminal esperam o pedido completar; completo ganha destaque e **Lançar para ROTAS** — o evento `pedido_lancado_rotas` nasce no card do pedido e as unidades **saem do ESTOQUE para o setor ROTAS** de verdade. **Só o lançado aparece nas ROTAS** (a regra da S11 caiu).
- **Logística → Danificados**: tudo em etapa DANIFICADO com o relato da D-09 (quem entregou marcou o quê, quem recebeu concordou ou não) e tempo parado; **Resolvido → destino** (Estoque, ROTAS ou qualquer setor; para outro setor a marcação do estado é obrigatória) e **Arquivar**; **Visualizar arquivados** só carrega ao clicar.
- **ROTAS → Entregas**: só lançados; o card mostra **dia + caminhão (com foto)** ou o link "programar caminhão". **ROTAS → Programação** (filho novo): dia → pedidos sem programação → seleção → **mapa Leaflet/OpenStreetMap** com os pontos, a **ordem de parada sugerida** (vizinho mais perto, linha reta — números nos marcadores e na lista, distância total) e **sugestões de pedidos próximos** (até 5 km, âmbar; clique inclui) → confirmar **data + caminhão**; reprogramar/tirar a qualquer instante até a entrega. Mapa com **Expandir** (tela cheia, ESC fecha). Endereço sem ponto no mapa aparece com aviso e entra na programação normalmente (Q-65).
- **Administração → Caminhões**: cadastro com nome, placa (única), capacidade livre e **foto** (bucket `plt-imagens`, pasta `caminhoes/{id}/`); arquivar/reativar; **excluir caminhão em uso é bloqueado pelo banco e a tela oferece arquivar**.
- **Botão "Concluir" no card** (pedido seu na revisão ao vivo): no quadro do setor e no tablet — a peça pronta vai direto para o ESTOQUE (fim de linha) pedindo só a marcação do estado; entra nos Pedidos em aguardo. O card também foi reorganizado em duas linhas (nada estoura mais a borda).
- **Metas (pendência da S14 → D-45):** edição/encerramento só de quem criou (admin tudo); meta de unidades pode mirar **uma etapa** ("concluir X cards na etapa Y").
- **Correções de produção descobertas:** `pedidos.situacao` guarda a DESCRIÇÃO do Tiny ("Cancelado") — a detecção de cancelamento da S09 nunca disparava e os selos "Cancelado no Tiny" nunca apareciam; agora tudo compara normalizado (banco e front). A guarda do gatilho de inserção ganhou o espelho fiel do que produção já tinha (`translate`). `concluido_em` passou a refletir o terminal ATUAL (unidade que volta para produção deixa de estar "concluída").
- **Geocodificação** (`plt_geocache` + Edge Function `geocodificar`): Nominatim com 1,1 s entre consultas, User-Agent identificado, cache no banco (falhas também, por 7 dias), exige pessoa ativa. Segredo opcional `PLT_GEOCODIFICACAO_CONTATO` (e-mail/site de contato pedido pela política do Nominatim) — defina no painel do Supabase se quiser.

## 2. Verificação executada

| Critério da demanda | Resultado |
|---|---|
| Unidade concluída de pedido incompleto aparece em Pedidos em aguardo; completo → Lançar; após lançar, está nas ROTAS | ✅ ao vivo na sua conta: 13146 apareceu "1 de 2 prontas"; 13176 ficou completo, foi lançado e apareceu nas ROTAS como "pronta para entrega" (as 2 unidades saíram do Estoque para a ROTAS) |
| Estoque busca por ID digitado e permite editar o ID | ✅ ao vivo: `SAP-ALICE-001` gravado (trilha `id_producao_definido` por Wallace) e a busca "alice-0" filtrou só ela |
| Danificado resolvido para um setor volta à fila daquele setor; Estoque/ROTAS idem; arquivado some e fica em evento | ✅ ao vivo: 13107 resolvido → FURAÇÃO como 🟡 (marcação + movimentação); 13183 arquivado (sumiu da lista, apareceu em "arquivados", evento `card_arquivado`). Estoque/ROTAS como destino provados no `test:banco` |
| Programação: 3 pedidos plotam 3 pontos; sugestão lista próximos; confirmar grava data + caminhão e some dos sem-programação | ✅ ao vivo: 13114/13176/13156 geocodificados pelo Nominatim (rota sugerida 6,5 km, paradas 1-3-2), confirmados para hoje com "Baú branco"; 13156 apareceu como sugestão a 2,9 km de 13114; reprogramar 13176 → 09/09 com "Baú cinza" |
| Caminhão com foto aparece na programação; excluir caminhão usado é bloqueado com arquivamento oferecido | ✅ ao vivo: foto subiu (`caminhoes/2/…`) e aparece no card das ROTAS; excluir "Baú cinza" (em uso) → modal "já tem entregas programadas" → arquivado → reativado |
| Tudo em `/logistica/...`, `/rotas/...`, `/admin/caminhoes`, sidebar persistente e voltar | ✅ rotas novas no `App.tsx`; ROTAS ganhou o filho Programação na sidebar |

Mais: `test:banco` 2 rodadas **TUDO VERDE** (+32 verificações da S15; a seção da ROTAS da S11 foi reescrita para a regra nova) · tsc · lint · Vitest **40/40** (+12) · build · advisors: **28 WARN esperados** (endpoints de propósito) + 3 avisos antigos que não são desta sessão (§3) · conferência E-20 pós-aplicação (21 tabelas `plt_`, 42 policies, 2 gatilhos certos em `pedidos`, check validado, policy de metas = criador/admin) · trilha D-40 real da verificação: `pedido_lancado_rotas`, `entrega_programada/reprogramada`, `programacao_removida`, `caminhao_criado/alterado/arquivado/reativado/excluido`, `id_producao_definido`, `card_arquivado`.

## 3. O que você precisa saber

- 🟠 **Os 233 cards arquivados eram mais que os ~163 de 01/09**: desde então, pedidos reais chegaram pelo webhook, foram entregues pelo processo antigo e o card ficou parado no PCP. Ficaram 56 cards vivos no PCP (41 "Preparando envio", 5 "Pronto para envio", 2 "Em aberto", 1 "Faturado" e 7 "Entregue" que têm unidade liberada ou nasceram à mão).
- 🟠 **Os dados do teste ao vivo ficaram registrados** (append-only, tudo com "teste da sessão" nas observações e no nome dos caminhões): 13176 lançado e programado para 09/09 no "Baú cinza"; 13146 com 1 unidade no Estoque; 13107 na FURAÇÃO como 🟡; 13183 arquivada; 13114/13156 lançados e sem programação. Os dois danificados foram montados por SQL em seu nome (marcação 🔴 + parecer 🔴) — o resto foi gesto real na tela.
- **Avisos antigos nos advisors (não são desta sessão):** `fn_vig_touch` sem `search_path` e `vig_conhecimento_vendas` sem policy (frente do Vigia), `pg_net` no schema `public`, proteção de senha vazada desligada no Auth.
- **Nominatim** é serviço público com política de uso: a Edge Function já respeita ritmo e identificação; para ficar 100% dentro da política, defina o contato no segredo `PLT_GEOCODIFICACAO_CONTATO`.
- **Programação em lote grava um pedido por vez** (uma RPC por pedido, no mesmo clique) — se um falhar no meio, os anteriores já ficam gravados; a tela avisa.
- A "rota" do mapa é **sugestão em linha reta** (ordem por vizinho mais perto): roteirização com trânsito está fora do escopo (demanda). A ordem final é do motorista.

## 4. Como validar (5 minutos)

1. Num quadro de setor, clique **Concluir** numa peça → marque o estado → ela aparece em **Logística → Estoque** (defina um ID e busque por ele) e em **Pedidos em aguardo**.
2. Quando o pedido ficar completo, **Lançar para ROTAS** → ele aparece em **ROTAS → Entregas** com "Sem programação — programar caminhão".
3. **ROTAS → Programação**: marque 2–3 pedidos → veja os números da ordem no mapa e na lista, a distância e as sugestões âmbar → **Programar** → dia + caminhão → o card das ROTAS mostra dia e caminhão com foto. Teste **Expandir** no mapa.
4. **Logística → Danificados**: resolva uma peça para um setor (marcando o estado) e arquive outra → **Visualizar arquivados**.
5. **Administração → Caminhões**: tente excluir um caminhão programado → o sistema oferece arquivar.
6. Supabase → `plt_logs_atividade`: cada gesto acima virou linha.

## 5. Pendente / decisões para você

- **Formato definitivo do ID de produção (Q-63)** segue aberto — hoje é texto livre e único.
- **Tela de "concluídos"** que você citou em 01/09 (além de Estoque/ROTAS) não existe ainda — é demanda nova se quiser.
- **Raio da sugestão (5 km)** é constante no código; se quiser configurável no admin, é pequeno.
- **Bundle do front cresceu ~150 kB com o Leaflet** (aviso de chunk >500 kB já existia) — carregar o mapa só na tela de Programação (`React.lazy`) é uma melhoria simples para a próxima sessão.
- **Metas com etapa:** o cartão do Meu Painel mostra "na etapa X" e o modal tem o seletor — vale você olhar se o texto ficou do seu gosto.
- **`22_backfill_tiny.sql` do cofre** ainda tem a guarda antiga (`lower` só); a verdade agora está na migration 25 do repo e no banco — a nota do backfill pode apontar para lá.
- Merge na `main`: aguarda seu OK nesta conversa (D-20).

## 6. Notas do cofre atualizadas

[[PLT - Decisoes de Produto]] (**D-45**) · [[SUPA - Esquema do Banco]] (migration 25) · [[PLT - Modelo de Sistema]] (Logística/ROTAS e o Concluir) · [[PLT - Memoria de Aprendizado]] (**E-25, E-26, F-09**) · [[000 - ORDEM DAS SESSOES]] · [[000 - MAPA DO PROJETO]] · [[SESSAO-15 - Logistica e ROTAS com Caminhoes]] (resultado)

## Ver também

[[SESSAO-15 - Logistica e ROTAS com Caminhoes]] · [[handoff_2026_09_01_sessao14_meu_painel]] · [[SESSAO-16 - Dashboards de Verdade]] (a próxima)
