# AJUSTE — Os números que não batiam entre as telas (06/11/2026)

Origem: a varredura de todas as telas do [[AJUSTE - Cabecalhos compactos e menu lateral]]
(06/11) achou 4 dados que não batem entre telas — todos calculados em funções do banco
e de ANTES daquele ajuste (handoff [[handoff_2026_11_06_ajuste_cabecalhos_compactos]],
seção 4 "Descobertos"). Rodada própria, pedida pela sessão do ajuste dos cabeçalhos,
na pasta principal (sem worktree), com outra sessão ativa na mesma pasta — commit por
índice temporário a partir da `main` (memória [[trabalhar-na-pasta-principal]]).

## As 4 divergências — a causa de cada uma (lida no banco vivo, só leitura)

1. **Pedido 13686 em ROTAS → Entregas → "A entregar"** com os botões de entregar.
   `plt_fn_rotas` inclui todo card de pedido com `lancado_rotas_em` (ou programado, ou
   candidato pronto) e não arquivado — sem olhar o Tiny. O 13686 (só 1 peça) foi
   lançado em 20/10 21:25, cancelado no Tiny em 21/10 16:36; a reação ao cancelamento
   desligou a peça e tirou a programação, mas o lançamento (projeção) ficou. A entrega
   dele é recusada ("Este pedido foi cancelado no Tiny — não se entrega"). Único caso
   hoje (o 13620, cancelado depois de entregue, está em "Entregues" — certo).
2. **Visão do dia × quadros** (`plt_fn_dash_agora` e `plt_fn_dash_dia`):
   - "na fila" = TODA peça sem executor no setor, em qualquer coluna → na Limpeza
     36 (A LIMPAR) + 44 (CANCELADO) + 4 (NÃO ENCONTRADO) = 84; o quadro mostra 38 na
     fila (36 peças + 2 avulsos).
   - só `tipo = 'unidade'` → o card avulso fora (SECC 1×2, Fitamento 7×9, Furação 6×7).
   - "em execução" = executor preenchido → os 3 PAUSADOS (Limpeza 1, Montagem 2) contavam.
   - "espera mais antiga" = `now() − desde` corrido, mostrada com dias; o card no
     quadro mostra horas de expediente pela régua.
   - "aguardando lançamento para ROTAS" = pedido completo não lançado (+ os sem
     produção) — sem olhar a programação: 16 = os 12 candidatos prontos sem rota + 4
     já programados (13814, 13820, 13824, 13825). Desde a D-156 lançar não é passo.
3. **Stand-by 7 (Motivos) × 6 (PCP e Expedição):** o 13649 entrou em stand-by em
   22/10 22:10 e foi cancelado no Tiny em 28/10 12:35 — o stand-by ficou aberto para
   sempre (`standby_desde`), a aba do PCP o esconde (Tiny tirou do PCP) e o painel
   contava `standby_desde is not null`; no ranking, o tempo dele seguia crescendo e
   ele aparecia como "ainda segurado".
4. **Calendário: "Fora do calendário: 6 sem rota com a previsão vencida"** contava todo
   vivo sem rota com previsão < hoje — inclusive os que estão NA grade da semana
   (13795 em 03/11; 13785 e 13815 em 04/11). Fora de verdade: 13716, 13745, 13787 (+ o
   13754 sem previsão).

## O que o dono decidiu (06/11, na conversa — 4 perguntas)

| Pergunta | Resposta |
|---|---|
| Pedido cancelado no Tiny que já estava nas entregas | **Sai da lista** (recomendado); o já entregue fica no histórico → D-267 |
| "Em execução agora" com pausados | **Pausado não aparece** em lugar nenhum do painel → D-268 |
| O que é "na fila" | **Só a coluna da fila, como o quadro** (com o avulso; espera em horas de expediente) → D-268 |
| Stand-by de pedido cancelado | **O cancelamento fecha o stand-by** na hora do cancelamento; o painel conta igual à aba → D-269 |

Sem escolha de produto (seguem o precedente "painel = quadro", D-75): os avulsos na fila,
a espera em horas de expediente, os "prontos esperando rota" pela regra dos candidatos
da Programação (D-156) e o "fora do calendário" só com o que não aparece na grade → D-268/D-270.

## Decisões técnicas

- **Uma migration** (`20261106030000_plt_numeros_que_batem.sql`), as 6 funções recriadas
  a partir da versão VIVA — md5 do corpo conferido contra o último `create` de cada uma
  nas migrations antes de editar (E-24/E-170): todas iguais.
- **Sem mudar retorno de porta nenhuma** (`create or replace`): a tela de antes continua
  funcionando com o banco novo e vice-versa (Lei §7.6) — e sem o "cannot change return
  type" das migrations antigas reaplicadas (E-178).
- A espera em horas de expediente fica **na tela**, com a mesma régua do quadro
  (`tempoUtilMs`, D-172): o banco devolve o tempo corrido; `lido_em − espera` = a chegada
  do card mais antigo da fila (mesmo `now()` da transação). Nenhuma coluna nova.
- Card sem coluna (setor sem etapas) conta como fila (`coalesce(eh_fila, true)`) —
  em produção não há nenhum; nos testes antigos há.
- "Prontos esperando rota" lê `plt_privado.vw_pedidos_para_rota` (pronto e sem
  programação) — um dono para a regra (M-04); a coluna segue `aguardando_lancamento`.
- Stand-by: o fecho pelo cancelamento é um **fato novo** (`pedido_standby_saiu`, origem
  automação, `destino = 'cancelado'`, `ocorrido_em` = a hora do cancelamento) puxado por
  um gatilho próprio (`plt_eventos_zz_standby_cancelado`, `when tipo = 'pedido_cancelado'`)
  — não mexe na reação ao pedido (grande e tocada por várias frentes). A validação aceita
  o destino novo só da automação com o pedido cancelado de fato; o gatilho só age com as
  mesmas duas condições — não derruba a gravação do Tiny. O aberto de antes (13649) fecha
  na própria migration com a hora do cancelamento (`retroativo: true`); reaplicada, não repete.
- A aba Stand-by do PCP virou UMA regra legível (`plt_privado.vw_standby_na_aba`, o mesmo
  filtro do grupo `standby` de `plt_fn_pcp_quadro`); o painel de Motivos conta dela o
  "em stand-by agora" e o "ainda segurado" de cada motivo. O ensaio amarra painel = aba.

## Arquivos

- `supabase/migrations/20261106030000_plt_numeros_que_batem.sql` (novo)
- `supabase/testes/testar-migrations.mjs` — bloco novo no fim ("Números que batem
  (06/11)"); a migration na cadeia de reaplicação do bloco 38 (depois da do Modo TV);
  o teste antigo do retrato de agora (SESSAO-16) com a regra nova.
- `src/paginas/dashboards/VisaoDoDia.tsx` — a espera pela régua; "Pedidos prontos
  esperando rota" (o arquivo foi também formatado pelo Prettier — só forma).

## Diário

- Leitura do cofre (CLAUDE.md, memória, decisões D-01…D-17/D-75/D-156/D-169…D-171,
  lei §1/§7/§12, handoff) e investigação no banco vivo, só leitura.
- 4 perguntas ao dono (tabela acima).
- Bateria 1 (sem o bloco novo): caiu o teste antigo do retrato de agora (a regra velha —
  esperado) + a falha antiga do painel comercial (8 períodos — já falhava).
- Bateria 2: o "entregue continua no histórico" falhou — o pedido de exemplo (só frete)
  ainda esperava liberação no PCP, e a entrega o arquiva (D-156, revisão do supervisor);
  o teste passou a usar um pedido já liberado. E `alter table … disable trigger` dentro
  da transação recusado ("pending trigger events" — o gatilho adiado do tempo): o caso
  "aberto de antes" passou a ser semeado direto (sem gatilho), como o 13649 ficou.
- Bateria 3 e 4 (a versão final): os **12 testes novos verdes**; a única falha é a antiga
  do painel comercial (8 períodos — `fn_dashboard_revenue_chart`, já falhava antes deste
  ajuste e do dos cabeçalhos). A do fluxo do n8n não apareceu nestas rodadas.
- Ensaio ×100 (1ª rodada): as portas tocadas JÁ estavam acima do teto antes desta mudança
  (Visão do dia inteira ~1,6 s; Motivos 30 dias ~0,76 s com 734 stand-by abertos; "A
  entregar" ~2,0 s; calendário ~0,8 s) — dívidas 24/25/26/29 da lei. Esta mudança somava
  +6 ms (retrato de agora), +35 ms ("prontos esperando rota": 363 × 328 ms da conta de
  antes — a regra dos candidatos com a prontidão), +43 ms (Motivos) e +167 ms ("A
  entregar": a função de situação chamada por pedido). Ajustes: a aba lida UMA vez no
  painel de Motivos (CTE `na` materializada) e o "começa com canc" na frente da função
  (E-166) no "A entregar".
- **Achado à parte (não é desta mudança):** no ×100, o calendário TRAVA a partir da 7ª
  chamada na mesma sessão (uma chamada levou 49 s; outra passou de minutos) — o plpgsql
  troca para o plano GENÉRICO depois de 5 execuções. Com `plan_cache_mode =
  force_custom_plan` na função, 9 chamadas seguidas estáveis. No banco real (×1), 9
  chamadas seguidas: 1ª 1,08 s (a 1ª da sessão), depois 29–64 ms — sem travar. Fica
  registrado como dívida na lei (§14) e como proposta ao dono — não entrou aqui.
