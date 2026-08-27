---
titulo: Handoff — SESSAO-04 Kanban Núcleo
tipo: handoff
data: 2026-08-27
atualizado: 2026-08-27
tags: [handoff, sessao, plataforma, kanban]
---

# 📋 Handoff — SESSAO-04 · Kanban Núcleo

**Branch:** `sessao-04-kanban-nucleo` · **Repositório:** `contatodomoby/Fabrica_processo`
**Banco:** projeto `axnzldwgwsmepukdiljx` (org **Tech**) — o mesmo da integração do Tiny
**Demanda:** [[SESSAO-04 - Kanban Nucleo]] · **Memória de execução:** `docs/execucao/SESSAO-04.md`

## 1. Objetivo da sessão

O coração visível da plataforma: quadros, etapas e cards com movimentação manual, no modelo híbrido da D-01 — o PCP enxerga o **pedido**, libera **unidades (k/n)** que percorrem os setores sozinhas e se reencontram na expedição. As respostas do dono no início viraram a **D-22**: liberação parcial OU completa, destino livre (qualquer setor move para qualquer setor), card de pedido sai do quadro quando 100% liberado, PCP com a tela mais completa, etapas geridas por admin E líder do próprio setor.

## 2. O que foi feito

### Banco (migration 13, aplicada em produção em 27/08 com aprovação)

- **4 funções RPC** — a porta de leitura do kanban (as tabelas da integração continuam sem policy; o navegador nunca as lê direto): `plt_fn_pedidos_kanban` (resumo paginado, com `unidades_liberadas`) · `plt_fn_pedido_itens_kanban` (itens em unidades) · `plt_fn_expedicao_kanban` (reagrupamento) · `plt_fn_pedido_unidades` (onde está cada unidade).
- **Salvaguardas (lição E-11):** security definer + `search_path` fixo, execute revogado de public/anon, **gate por usuário ativo DENTRO da função** (expedição: só admin, gente da entrada ou dos terminais). **Zero dado pessoal/financeiro do cliente** — só número, nome do cliente, datas, situação e itens.
- **(k/n) POR ITEM, como o n8n faz hoje no ClickUp** (A-01 — conferido no código real): n = quantidade arredondada do item, k = 1..n; quantidade < 1 não vira card.
- Advisors depois do DDL: **4 WARN esperados** (as `plt_fn_*` são endpoints de propósito) + os 5 INFO pré-existentes da integração. Integração conferida antes/depois: impressão digital idêntica, contagens intactas.

### Front

- **`/pcp`** — card por pedido; **"Novo card"** busca pedidos reais do Tiny ainda sem card (paginado); **liberação** com destino (setor + etapa opcional) por unidade, atalho "mesmo destino para todas", parcial ou completa. Pedido 100% liberado sai do quadro (segue na Expedição).
- **`/setores/:id`** — etapas internas como colunas + coluna fixa **"Chegada"** (etapa nula — todo setor nasce sem etapas, D-14); **drag-and-drop** (desktop, `@dnd-kit/core`) **E botão "Mover para…"** (tablet, seleção galpão de 64px). Setor terminal exibe "fim de linha".
- **`/expedicao`** — por pedido: "X de Y no fim de linha", barra de progresso, badge "Pedido completo", detalhe de cada unidade (setor · etapa · há quanto tempo · concluída/em produção), busca + paginação.
- **`/estrutura`** — setores (criar/renomear/ordenar/desativar — admin) e etapas por setor (idem — admin + líder do setor; checkbox "é a fila do setor", única por setor). **Nada se apaga**; desativar preserva o histórico.
- **Navegação por papel:** menu e Início ganharam os quadros (operador vê os setores dele; admin vê tudo; PCP/Expedição por vínculo). Card de unidade mostra pedido, produto, (k/n), cliente e **tempo na etapa** (contador simples; fila/execução é a SESSAO-05).

### O princípio que rege tudo

**Mover card = INSERIR EVENTO** (`plt_eventos`, append-only) com autor, origem, destino e timestamp. A posição do card é projeção mantida por trigger no banco — nenhuma tela faz UPDATE de posição. Correção de engano = mover de novo (evento novo).

## 3. Verificação executada (critérios de aceite)

| Critério | Resultado |
|---|---|
| Pedido com 3 itens liberado gera 3 cards de unidade nas etapas escolhidas | ✅ pedido real 13192: SECC/EM CORTE (TESTE) · CNC · FITAMENTO — conferido na tela e por SQL |
| Mover card grava evento com autor, origem, destino e timestamp | ✅ 11 eventos conferidos por SQL: autor MDM-084-001, via `interface`, origem/destino/etapa/timestamp completos |
| Expedição mostra 2 de 3 unidades chegadas → pedido incompleto | ✅ exato: "2 de 3 no fim de linha" + detalhe por unidade (screenshot na conversa) |
| Funciona em tablet (botão "mover para…") e desktop (drag-and-drop) | ✅ drag nos dois sentidos (Chegada↔EM CORTE) e botão Mover (CNC→ESTOQUE, FITAMENTO→ROTAS); F-07: mobile 375px e tablet 768px sem rolagem horizontal, alvos ≥44px |
| Revisão + handoff | ✅ este documento (PR dispensado — D-20); merge aguarda OK do dono |

Mais: `tsc` limpo · lint limpo · testes unitários 8/8 · `test:banco` verde (13 migrations × 2 rodadas, 10 verificações novas da migration 13) · build de produção ok · unidade que chega a terminal ganha `concluido_em` sozinha (trigger).

## 4. Bug encontrado e corrigido na sessão

**E-16** · "Mover" para setor sem etapa quebrava com FK violada: um reset antigo deixava o select de etapa em `''`, e **`Number('') === 0`** — o evento saía com `etapa_destino_id: 0`. Achado **interceptando o corpo real da requisição** no navegador; corrigido com sentinela `'chegada'` em todos os resets + guarda `|| null` na camada de API. Re-testado ✔. Registrado em [[PLT - Memoria de Aprendizado]] (junto com **E-15**, sobre escapes `\uXXXX` decodificados por ferramenta de edição).

## 5. Estado que ficou no banco (teste real, permanente por desenho)

- Card do **pedido 13192** + 3 cards de unidade: 1 na SECC (EM CORTE (TESTE), em produção), 1 no ESTOQUE (concluída), 1 na ROTAS (concluída). **11 eventos** append-only — não se apagam, e está certo assim.
- Etapa **"EM CORTE (TESTE)"** na SECC — quando não servir mais: **desativar** em /estrutura (nunca apagar). O card que está nela pode ser movido normalmente antes.
- Os 2 operadores de teste da SESSAO-03 continuam ativos (SECC) — servem para o dono validar a visão de operador.

## 6. Como validar de novo (do zero)

1. `npm run test:banco` → tudo verde.
2. `npm run dev` → entrar como admin → **PCP** → "Novo card de pedido" → escolher um pedido → "Liberar unidades" (escolher destinos, pode liberar só parte).
3. Abrir o quadro do setor de destino → arrastar entre colunas (desktop) e usar "Mover" (tablet) → mover até ESTOQUE ou ROTAS.
4. **Expedição** → ver "X de Y no fim de linha" e o detalhe em "Ver unidades".
5. **Estrutura** → criar/renomear/ordenar/desativar setores e etapas (marcar uma como fila).
6. Visão de operador: entrar com `operador.teste.um` (SECC) → só SECC no menu/Início; `/pcp`, `/expedicao` e `/estrutura` redirecionam.

## 7. Ficou pendente / limitações conhecidas

- **Ordem dentro da coluna não é persistida** — os cards ordenam por chegada (`desde`). Ordenação manual dentro da etapa, se fizer falta, é decisão futura.
- **Sem tempo fila/execução** (SESSAO-05), **sem qualidade nas transições** (SESSAO-06 — hoje mover entre setores não pergunta estado), **sem entrada automática de pedido** (SESSAO-13).
- **Chunk do build com 740 kB** — funciona, mas é candidato a code-split quando a plataforma crescer.
- **WARN do Supabase Auth "leaked password protection disabled"** (pré-existente, painel do Auth) — decidir se liga; não bloqueia nada.
- Telas atualizam por polling (20–30 s + ao focar); realtime fica para quando a tela do setor (SESSAO-07) pedir.
- Q-30 (modo escuro) e Q-42 (canal de notificações) continuam em aberto.

## 8. Notas do cofre atualizadas

[[PLT - Decisoes de Produto]] (**D-22**) · [[PLT - Perguntas em Aberto]] (**Q-21 ⏸️**) · [[SUPA - Esquema do Banco]] + `supabase-fabrica-schema.sql` (migration 13) · [[SESSAO-04 - Kanban Nucleo]] (respostas de 27/08) · [[PLT - Memoria de Aprendizado]] (**E-15, E-16**) · [[000 - ORDEM DAS SESSOES]] · `docs/design-system.md` (componentes do kanban).

## Ver também

[[SESSAO-04 - Kanban Nucleo]] · [[handoff_2026_08_27_sessao03_autenticacao]] · [[PLT - Decisoes de Produto]] · [[SUPA - Esquema do Banco]]
