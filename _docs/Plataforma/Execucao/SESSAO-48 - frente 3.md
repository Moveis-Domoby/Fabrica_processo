---
titulo: Diário de execução — SESSAO-48 · frente 3 (pedido cancelado no Tiny pergunta o destino de cada móvel em produção)
tipo: execucao
data: 2026-11-11
tags: [execucao, sessao-48, frente-3, cancelamento, estoque, logistica, pcp]
---

# Diário — SESSAO-48 · frente 3 (11/11/2026)

Demanda: [[SESSAO-48 - Cancelar Fabricacao de Verdade - Peca de Pedido Pergunta o Destino]] (seção "Frente 3") ·
diário do supervisor: [[SESSAO-48]].
Cópia isolada (git worktree) no ramo `sessao-48-f3-destino`, nascida do commit base `1999e2d`. O supervisor junta.

## O que a base já tinha (não refeito)

- Os tipos `destino_pendente` / `destino_decidido`, só pela marca `plt.destino_maquinaria`; a projeção
  `plt_cards.destino_pendente_em` (liga com `destino_pendente`, apaga com `destino_decidido`); o índice
  `plt_cards_destino_pendente_idx (pedido_id) where destino_pendente_em is not null`.
- A regra única do que conta (`fn_estoque_categoria`) já tira a peça com `destino_pendente_em` do "reservados p/ produção".
- `fn_quadro_cards` já manda `destino_pendente_em` no card; o rótulo do card é do supervisor (`CartaoUnidade.tsx`).
- `fn_cancelar_fabricacao` (o gesto da frente 1, pelo fato de CHEGADA numa etapa que cancela) já fecha a pendência
  com `destino_decidido {destino: 'cancelar'}`.
- O aviso `pedido_cancelado_decidir` (público logística) no catálogo; o caminho do sino é
  `/fabrica/logistica/estoque?destino=<card do pedido>` (`src/notificacoes/api.ts`).

## Leitura feita

CLAUDE.md; a demanda (2×, com a seção da frente 3, a regra nova, os critérios e as notas); a migration base inteira;
o diário do supervisor (lições); Modelo de Sistema (§4, quadro por arrasto e cancelados, kanban completo — o padrão
"escolher um motivo", §5, §7); Lei de Desempenho §1–§4 e §12; D-61, D-62, D-129, D-201. Código vivo lido por extração:
`fn_desvincular_por_cancelamento`, `fn_reagir_pedido`, `fn_vincular_peca_producao`, `plt_fn_pcp_liberar`,
`fn_sugestoes_em_producao`, `fn_vagas_pedido`, `fn_chave_peca`, `fn_avisar_publico`, `fn_aviso_publico_de`,
`fn_pode_ver_expedicao`, `plt_fn_devolucao_detalhe` / `_decidir` / `_realocar_opcoes`, `fn_validar_qualidade`,
`fn_projetar_posicao`, `fn_projetar_parecer`, `fn_volta_pcp_tiny` (o molde do gatilho em `pedidos`).

## Diário

### 1 · Banco — a migration `20261111030000_plt_cancelado_pergunta_destino.sql`

Gerada por programa (no rascunho da sessão: `s48/f3/gerar.mjs` + partes `01…06`), lendo as migrations da MINHA cópia:
a função do cancelamento é recriada por EXTRAÇÃO da última versão (`20261014130000_plt_devolucao_decidida.sql`, md5 do
corpo `ef819eb2132b0b5a3642b337376b7746` — conferir contra o banco vivo antes de aplicar, A-96) com 4 trocas de contagem
exata; o resto é novo. Nenhuma tabela, coluna ou tipo de fato novo (a base trouxe tudo).

1. **`plt_privado.fn_desvincular_por_cancelamento`** (o gatilho `plt_eventos_zz_desvincular_cancelados` não muda):
   - no `pedido_cancelado`, o que já fazia fica (a peça PRONTA — Expedição/ESTOQUE/ROTAS — perde o pedido e vai ao
     ESTOQUE sem dono); **novo:** cada peça do pedido num setor de PRODUÇÃO, não arquivada, não concluída, não cancelada,
     ainda sem a marca e **sem ajuste aberto** ganha `destino_pendente` (com a marca da maquinaria; `evento_referencia_id`
     = o fato do cancelamento; trava a peça e confere de novo) e o pedido manda **UM** aviso `pedido_cancelado_decidir`
     (público logística, por `fn_avisar_publico`): *"O pedido 13702 foi cancelado no Tiny. 3 móveis dele estão em
     produção — decida para onde vão."* (singular: "1 móvel dele está em produção — decida para onde vai.");
   - **blindado:** essa parte nova roda num bloco próprio — se der erro, o cancelamento vale do mesmo jeito (a peça cai
     na regra de antes) e o erro vira aviso de automação para os administradores (`fn_alertar_erro`);
   - na chegada ao ESTOQUE da peça de pedido cancelado que ainda espera decisão: antes da desvinculação, o fato
     `destino_decidido {destino: 'estoque', automatico: true, motivo: 'fim_da_linha'}` (origem automação, sem pessoa).
2. **"Descancelado"**: `plt_privado.fn_destino_descancelado()` + gatilho NOVO e pequeno **`plt_pedidos_destino_descancelado`**
   em `public.pedidos` (`after update of situacao … when (old.situacao is distinct from new.situacao)`; o molde é o
   `plt_pedidos_volta_pcp`): a situação normalizada sai de "cancelado" → cada peça pendente ganha
   `destino_decidido {destino: 'descancelado', automatico: true}` (a marca sai; ela nunca perdeu o pedido). À prova de
   falha: o erro vira aviso de automação e a gravação do Tiny passa.
3. **O PCP (ou a janela) usando a peça pendente**: `plt_privado.fn_destino_peca_vinculada()` + gatilho
   **`plt_eventos_zz_destino_vinculada`** (depois de `peca_vinculada`): peça com a marca → `destino_decidido
   {destino: 'outro_pedido', via: 'pcp' | 'logistica', pedido_id (o cancelado), pedido_destino_id, numero_destino}`
   com a pessoa e a origem do fato de ligação. A janela da logística liga `plt.destino_via = 'logistica'` antes de chamar a
   maquinaria; sem a marca, foi o PCP.
4. **Leitura `public.plt_fn_destino_pendentes(p_card_id)`** (aceita o card do pedido OU de uma peça dele): o pedido
   (número, cliente, situação no Tiny, quando cancelou), as peças pendentes (móvel, SKU, k/n, setor, etapa, desde quando,
   quem está trabalhando, danificada, a chave da régua), **`candidatos` por chave** (até 10 pedidos vivos no PCP com vaga
   aberta do MESMO móvel, o mais antigo primeiro — `data_pedido`, depois o número —, com quantas vagas e se está em
   stand-by) e **`decididas`** (o que já aconteceu, até 50). Logística e admin (`fn_pode_ver_expedicao`, a régua da
   devolução).
5. **Escrita `public.plt_fn_destino_decidir(p_card_id, p_decisoes)`** — `[{peca_id, destino, pedido_id?}]`, até 100, numa
   transação: `estoque` → `destino_decidido` + `unidade_desvinculada` (motivo `pedido_cancelado`, apontando a decisão);
   `outro_pedido` → trava o pedido escolhido ANTES da peça (a mesma ordem da liberação do PCP — nunca se esperam em cruz),
   confere que ele está no PCP e acha a 1ª vaga aberta do mesmo móvel (`fn_vagas_pedido`), chama
   `fn_vincular_peca_producao` (as conferências de sempre: peça danificada não vai, etc.) e o gatilho do item 3 fecha a
   pendência; `cancelar` → movimenta para a coluna que cancela com o motivo "cancelada" (a do setor da peça; senão a da
   LIMPEZA E EMBALAGEM), origem `automacao` + a pessoa — o gatilho de chegada da base grava `fabricacao_cancelada` e o
   `destino_decidido 'cancelar'`. A peça que já não espera é **pulada e relatada** (com o último destino dela). Recusas em
   português (destino desconhecido, sem pedido, pedido fora do PCP, pedido que não precisa mais do móvel, nenhuma coluna
   que cancela, quem não é logística/admin).

### 2 · A bateria

- O bloco **"SESSAO-48 · frente 3"** (24 conferências) logo depois do bloco da base, num escopo próprio e dentro de
  `begin … rollback`; reaplica a base e a minha migration no começo. Faixa: pedidos 97531…97541, produtos 924831/924832.
- A migration entrou na cadeia de reaplicação do bloco 38, logo depois da base.
- ⚠️ **Mexi em 3 linhas da bateria FORA do meu bloco** (o supervisor precisa ver ao juntar): o cancelamento do Tiny agora
  grava `destino_pendente`/`destino_decidido` **também nos cenários antigos** (os pedidos cancelados com peça em produção
  dos blocos da SESSAO-24 em diante). As migrations antigas que, reaplicadas, recriam e **validam** a lista de tipos
  (a `20261027040000` e a `20261031020000`) caíam com "check constraint … is violated by some row". Correção no molde
  do que a SESSAO-30 fez com a 51: um ajudante `aceitaDestino48(sql)` (antes do bloco das automações) acrescenta os dois
  tipos à lista **só na reaplicação do teste**; usado no `DEPOIS51` (bloco das automações), na reaplicação da
  `20261027040000` e no laço `m42` do bloco 38. Em produção nada disso existe (cada migration rodou uma vez, antes desses
  fatos); a base, reaplicada no fim de cada cadeia, valida a lista completa.
- **1ª rodada:** caiu no bloco das automações (o erro acima). **2ª rodada:** **1686 ✔ · 1 ✘** — o ✘ é o vermelho antigo
  "Dashboard: as 7 portas novas = as antigas em 8 períodos". A base sozinha tinha 1662 ✔ (+24 = o meu bloco; nenhuma
  conferência antiga mudou de cor).
- Para iterar rápido: uma mini bateria (`s48/f3/mini.mjs`: monta o banco em disco uma vez — 8 s — e roda só o meu bloco).

