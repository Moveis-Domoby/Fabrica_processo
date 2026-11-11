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

### 3 · O ensaio ×100 (Lei §7.2/§12 — ANTES de fechar a tela, A-209/E-192)

Programa e resultado em `_docs/Plataforma/Execucao/dados/SESSAO-48 - frente 3 - ensaio x100 do destino do pedido cancelado
(script|resultado, 2026-11-11)`. Volume ×100 do retrato (562.700 pedidos, 1,1 milhão de itens, 3.753 pedidos na fila
do PCP, 140 mil fatos) e o pior caso esperado: o cancelado com **30 peças de 10 móveis** (o 13622 tinha 31), um móvel
muito vendido (1 em cada 7 pedidos; 536 na fila) com metade das vagas já cobertas. PGlite em disco, com a máquina
dividida com as outras frentes — os números são o teto.

- **1ª versão** (a procura por móvel juntando o pedido e chamando a regra do PCP linha a linha, e a fila relida para cada
  móvel): a janela **368 ms**. → **2ª** (a fila uma vez só): 85 ms no pior caso — mas, com `setor in (select …)`, o
  planejador lia os 30 mil cards do PCP; com `= any(array(…))` passou a usar o índice da fila, e aí trocou a junção pelos
  itens dos 10 móveis pelo índice do SKU (113 mil itens — 93 ms). → **Final:** a fila do PCP numa passada (o índice
  parcial da fila), os itens de cada pedido da fila pela chave do item (`lateral` — o custo é o tamanho da fila, nunca o
  de quantas vendas o móvel teve), e a regra do PCP + a conta das vagas só nas primeiras linhas, na ordem, até o 10º.
- **Números finais:** janela, caso típico (3 peças de um móvel muito vendido) **33 ms**; pior caso (30 peças, 10 móveis,
  50 candidatos, 13,5 KB) **75 ms** (6ª chamada 68 ms) — o grosso é 1 conta de vagas por candidato (~0,8 ms cada × 50).
  A decisão de 1 peça: estoque 23 ms · outro pedido 16 ms · cancelar 31 ms; **as 30 peças de uma vez: 206 ms** (cada
  peça desvinculada refaz a conta de liberação do pedido cancelado — a maquinaria de sempre). O Tiny cancelando um pedido
  com 10 peças em produção (a gravação inteira, com a reação): 37 ms.
- **Fora do teto (para o supervisor decidir):** o pior caso da janela (75 ms > 50 ms) e as 30 peças de uma vez
  (206 ms > 100 ms). Os dois são raros (a janela abre por clique; 30 peças de uma vez é o caso do 13622) e o custo é a
  conta de vagas da casa (`fn_vagas_pedido`) e a reconta da liberação — não a procura. Com o volume de hoje (×1), a
  janela leva poucos milissegundos.

### 4 · As telas

- **`src/logistica/destino.ts`** — as portas (`detalheDestino`, `decidirDestino`), os tipos, as palavras
  (`ROTULO_DESTINO`, `EXPLICA_DESTINO`, `textoDaDecisao`, `nomeDaPeca`) e a lógica pura: `vagasQueSobram` (a vaga que
  outra peça da janela já escolheu não aparece livre) e `distribuirOutroPedido` ("todas de uma vez" → cada peça no 1º
  pedido com vaga, dividindo as vagas; nulo quando alguma fica sem pedido).
- **`src/logistica/componentes/ModalDestinoPedidoCancelado.tsx`** — a janela "Para onde vai este móvel?" (o molde é a
  "Decidir situação" da devolução): `Modal tamanho="galpao"` (no celular sobe do rodapé), uma leitura ao abrir
  (`gcTime: 0` — esquece ao fechar), o resumo (o pedido, quando cancelou, a pílula "Cancelado no Tiny" com ícone), o
  bloco **"Todas de uma vez"** (3 botões com `aria-pressed`; "Passar para outro pedido" desligado com o porquê quando nem
  todos têm pedido) e, por móvel: nome (k/n), SKU, onde está e desde quando espera, quem está trabalhando nele, o selo de
  danificada, os 3 botões-rádio (ícone + texto + o check quando marcado) e, em "Passar para outro pedido", os pedidos em
  botões (nº · cliente, "previsto dd/mm · N vagas deste móvel", "em stand-by"; a vaga tomada por outro móvel da janela
  fica desligada e diz isso). O rodapé (Fechar · Aplicar a decisão) fica sempre à vista; o aviso do fim diz o que
  aconteceu com cada móvel (e "N móveis já tinham destino — nada mudou neles"); a janela relê sozinha e mostra
  "Já decidido" (o que aconteceu, quem e quando). Recusa do banco = aviso em português, e as escolhas ficam.
- **`src/paginas/Estoque.tsx`** — o gancho do `?destino=` (o caminho do sino): abre a janela em **qualquer aba** e
  fechar tira só o `?destino=`; a janela é um **pedaço próprio** (`lazy`), baixado só quando o endereço pede.
- **Testes:** `destino.test.ts` (7), `ModalDestinoPedidoCancelado.test.tsx` (10), `Estoque.test.tsx` (2).

### 5 · Conferências finais (na cópia)

- **Bateria, 3ª rodada** (depois da leitura otimizada): **1685 ✔ · 2 ✘** — o vermelho antigo do Dashboard e
  "SESSAO-33 · o fluxo do n8n … de ponta a ponta", que **depende do relógio**: `fn_tiny_fila_lote` deixa a conta da
  fábrica de fora na madrugada dela (`fn_tiny_fabrica_em_varredura`) — a rodada começou ~03:10 e o lote não trouxe a
  linha da fábrica; na 2ª rodada (02:58) passou. Nada a ver com a frente (a fila do Tiny não foi tocada).
- **vitest** (com as variáveis de mentira): **86 arquivos, 563 testes ✔**. **tsc** ✔. **lint** dos 6 arquivos ✔.
- **Montagem:** ✔ — **JS inicial: 231.2 KB comprimidos em 8 arquivos (teto 250 KB)**; a janela é um pedaço próprio
  (`ModalDestinoPedidoCancelado` 12,11 kB · 4,03 kB comprimido); o pedaço do Estoque 48,56 kB (12,77 kB comprimido).
- **Não conferido aqui:** a foto da janela no celular (375) e no tablet (768) — o supervisor tira (o desenho não tem
  largura fixa: uma coluna no celular, `sm:grid-cols-3` nas opções, textos que quebram).

## Provisórias (o supervisor transforma em decisões numeradas)

- **P1:** "o mais antigo primeiro" = o pedido que **espera há mais tempo no PCP** (o `desde` do card do pedido — a ordem
  da fila do PCP), não a data da venda: é a ordem que o PCP já usa e é o que deixa a procura parar no 10º.
- **P2:** até **10 pedidos por móvel**; a procura olha no máximo os 200 primeiros da fila que têm o móvel (Lei §6).
- **P3:** peça **sem SKU** não tem candidato ("Passar para outro pedido" desligada) — a mesma régua da sugestão de peça em
  produção do PCP (D-201), que também só procura pelo SKU.
- **P4:** a peça **danificada** também espera a decisão (está em produção), mas não passa para outro pedido (a maquinaria
  recusa) — a janela diz o porquê.
- **P5:** a peça com **ajuste aberto** (D-130) não ganha a marca: o ajuste já tem o destino final escolhido pelo PCP.
- **P6:** todo `destino_decidido` leva `pedido_id` = o pedido **cancelado** (a origem — igual ao que a base grava no
  'cancelar'); o "outro pedido" leva também `pedido_destino_id` / `numero_destino` e `via` ('pcp' | 'logistica').
- **P7:** "Cancelar a fabricação" vai para a coluna que cancela **do setor da peça** (motivo "cancelada"), senão para a da
  LIMPEZA E EMBALAGEM — origem automação + a pessoa: não se pede o estado da peça (ela não segue a produção).
- **P8:** o aviso é **um por pedido**, para o público logística (o catálogo; o admin entra pela régua do público), título
  "Pedido N cancelado com móveis em produção".
- **P9:** **blindagem:** se a marca falhar, o cancelamento vale do mesmo jeito e a peça cai na regra de antes (o ESTOQUE
  quando ficar pronta); o erro vira aviso de automação para os administradores.
- **P10:** "descancelado": a marca sai com o fato (automático); o aviso que já estava no sino fica — aberto, a janela diz
  "Nada esperando decisão" e "Voltou a valer no Tiny". Cancelado de novo, a peça espera de novo.
- **P11:** a leitura aceita também o card de uma **peça** (leva ao pedido dela) — o rótulo do card pode abrir a janela.
- **P12:** "Todas de uma vez → Passar para outro pedido" distribui as peças pelos pedidos (o mais antigo primeiro,
  dividindo as vagas) e fica desligada quando alguma peça ficaria sem pedido.
- **P13:** a janela abre no Estoque pelo `?destino=` em qualquer aba (o `?devolucao=` vive só no Top X).

## Lições (para a memória de aprendizado — o supervisor numera)

- **`vitest run --root "<cópia>" --dir src` com a pasta de trabalho na principal roda os testes da PRINCIPAL** (o `--dir`
  é relativo à pasta de trabalho, não ao `--root`): na cópia, `--dir "<cópia>/src"`. E a cópia não tem `.env.local` —
  sem as variáveis de mentira (`VITE_SUPABASE_URL=https://teste.invalid VITE_SUPABASE_ANON_KEY=…`), 10 arquivos de
  teste caem no `src/lib/supabase.ts`.
- **`eslint <arquivos>` de fora da pasta de trabalho ignora os arquivos e sai com 0** ("File ignored because outside of
  base path" — só aparece sem `--no-warn-ignored`): o lint da cópia vai pela API do ESLint com `cwd` = a cópia
  (`s48/f3/lint.mjs`), conferido com um texto que tem de dar erro.
- **Mudar o que um fato antigo faz muda os cenários antigos da bateria:** o cancelamento passou a gravar tipos novos nos
  blocos da SESSAO-24 em diante, e as migrations antigas reaplicadas que VALIDAM a lista de tipos caíram. Antes de mexer
  numa reação a fato do Tiny, procurar na bateria quem reaplica migration com `validate constraint`.
- **Ensaio ×100 com a porta ainda no papel pegou 368 → 33 ms (típico) / 75 ms (pior caso):** procura "por candidato" lê a
  fila UMA vez, pela chave do item (o custo é o tamanho da fila, não a popularidade do móvel), e só as primeiras linhas,
  na ordem, pagam a regra e a conta cara; `in (select …)` × `= any(array(…))` muda o índice escolhido.
- **PGlite em disco no Windows:** remontar o banco na MESMA pasta logo depois de apagá-la pode dar "could not create file
  base/…: File exists" — usar uma pasta nova.

