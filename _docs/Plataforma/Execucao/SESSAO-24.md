---
titulo: Execução — SESSAO-24 · Produção concluída, cancelamentos e alocação (+ o quadro por arrasto)
tipo: execucao
data: 2026-09-27
atualizado: 2026-09-27
tags: [execucao, sessao-24, estoque, aguardo, cancelamento, alocacao, arrasto, bloco-5]
---

# 🔧 Execução — SESSAO-24

**Branch:** `sessao-24-producao-concluida-cancelamentos` (criada da `main` em 62ba2f7, igual a `origin/main`)
**Demanda:** [[SESSAO-24 - Estoque Nucleo - Aguardo Cancelamentos e Alocacao]] · roda depois da 25 (D-53) · handoff da 25 lido antes do desenho
**Regra do working tree:** commit sempre por caminho explícito (E-23). `Claude outputs/` não é desta frente — fica fora.

## Checkpoint de início (26–27/09) — o que o banco mostrou (consultas SÓ de leitura)

1. **Setores:** 9 (PCP entrada · SECC, CNC, FITAMENTO, FURAÇÃO, MONTAGEM, LIMPEZA E EMBALAGEM produção · ESTOQUE e ROTAS terminais). Terminais sem etapas.
2. **Etapas (herança do ClickUp):** todo setor de produção tem **fila → etapa de trabalho → … → CONCLUÍDO**; várias etapas têm **nome de setor** (o jeito do ClickUp de mandar adiante): SECC (A CORTAR · CORTANDO · CENTRO DE FURAÇÃO · FITAMENTO · CONCLUÍDO), CNC (A USINAR · USINANDO · FITAMENTO · CENTRO DE FURAÇÃO · CONCLUÍDO), FITAMENTO (A FITAR · FITANDO · MONTAGEM · CENTRO DE FURAÇÃO · CONCLUÍDO · DANIFICADO), FURAÇÃO (A FURAR · FURANDO · FITAMENTO · MONTAGEM · CONCLUÍDO), MONTAGEM (A MONTAR · MONTANDO · PARADO · LIMPEZA E EMBALAGEM · CONCLUÍDO · DANIFICADO), LIMPEZA E EMBALAGEM (A LIMPAR · LIMPANDO E EMBALANDO · ESTOQUE · EXPEDIÇÃO · CANCELADO · NÃO ENCONTRADO · ENTREGUE). PCP também tem etapas com nome de setor.
3. **Unidades vivas: 27** — ESTOQUE 6 (todas COM pedido: 3 de pedidos já "Entregue" no Tiny, 3 "Preparando envio"; 1 🟡 e 1 🔴 entre elas), ROTAS 8 (entregues), produção 12 (10 na LIMPEZA E EMBALAGEM/etapa EXPEDIÇÃO, "Preparando envio"; 1 CNC e 1 MONTAGEM de pedidos "Entregue"). **Nenhuma peça sem dono.**
4. **Cards de pedido cancelados:** 8 vivos, **todos no quadro do PCP hoje, sem unidade** (vão para a aba Cancelados só com o filtro) + 5 arquivados; 9 com o evento `pedido_cancelado`.
5. **Histórico:** 162 pedidos cancelados (32 nos últimos 90 dias, de 940). Itens de 90 dias: 1.425 — **109 sem SKU (7,6%)**, 74 personalizados, 33 com SKU fora do catálogo ativo.
6. **Achado (painel):** a "concluídas do dia" (`plt_fn_dash_dia`/`plt_fn_dash_producao_hora`) conta TODA chegada de unidade a terminal por dia — o lançamento para ROTAS noutro dia conta a peça de novo: 23 chegadas a terminal, **6 vindas de outro terminal, 2 unidades contadas em mais de um dia**. Com a S24 surgem mais movimentos entre fins de linha (cancelar: aguardo → ESTOQUE) → a contagem passa a valer só para chegada vinda de fora dos terminais.
7. Código: a migration 30 (`fn_validar_execucao`) já define **início = a próxima etapa depois da fila** (ordem seguinte, ativa, não-DANIFICADO); a `plt_vw_execucoes` já encerra a execução em QUALQUER movimentação (de etapa ou setor) — arrastar para fora do trabalho para o relógio sem regra nova.

## Respostas do dono (27/09/2026 — o OK da sessão)

**Rodada 1 (as 5 perguntas + a)):**
- **(a)1 — o quadro por arrasto:** *"um móvel só vira móvel na parte de montagem, até a montagem ele é um plano de corte dividido em várias peças… por enquanto vamos remover todos os botões, eles preferem que tudo seja arrastando, é mais rápido; se o cara mover de 'a montar' para 'montando', esse card já deve ser instantaneamente iniciado, não o contrário; se ele mover para 'montado', o card já deve ir para o próximo setor que é limpeza e embalagem; o único lugar que terá o botão de concluir é no setor de limpeza e embalagem — todos os móveis que vão para estoque passam por ele e eles que movem para estoque, seja móvel para estoque de fato, ou móvel já reservado por algum pedido."*
- **(a)2:** as duas abas de Pedidos em aguardo são **"Pedidos"** e **"Produtos reservados"**.
- **b1 ✅** regra de "peça igual": produto do catálogo pelo SKU; personalizado = SKU + descrição idêntica (sem ligar para maiúsculas/acentos/espaços); sem SKU = descrição idêntica.
- **b2:** nada de estocar inacabada — *"a peça continua em produção e logo mais irá para o estoque de peças de fato, não de produtos prontos"* (o estoque de peça é o próximo passo, D-57).
- **b3 ✅** aba Cancelados guarda para sempre.
- **b4:** *"JÁ EXISTE A ABA DE PEDIDOS EM AGUARDO, OS LOCAIS FINAIS NÃO SÃO MAIS ESTOQUE E MUITO MENOS ROTA, ISSO JÁ MUDOU, ESTOQUE SÓ FICA COMO LOCAL FINAL DE PEÇA SEM DONO"* → peça com pedido termina em **Pedidos em aguardo**; ESTOQUE = só sem dono.
- **b5 ✅** sugestão do estoque: PCP/logística ("são a mesma coisa") e admin.

**Rodada 2 (o arrasto):**
- *"já existe a etapa de fila, início e conclusão em todos os setores"* → usar a estrutura (E-44: eu tinha perguntado o que o código já respondia).
- **Etapa com nome de setor move o card para o setor** ✅.
- **CONCLUÍDO de SECC e CNC → FURAÇÃO; o CONCLUÍDO dos outros setores → sempre o próximo** (SECC e CNC são duas máquinas que cortam a chapa de MDF pelo plano de corte do SketchUp; a CNC também fura, a SECC não).
- **"CENTRO DE FURAÇÃO" → setor FURAÇÃO** ✅.
- Sem resposta explícita (decidido e avisado, dono pode corrigir): **modo tablet** também vira quadro de arrastar com PIN ao soltar; etapas chamadas ESTOQUE não mandam para lugar nenhum (quem leva ao estoque/aguardo é o Concluir); Pausar/Retomar do líder saem com os botões (arrastar para PARADO/fila para o tempo).

## Desenho (a partir das respostas)

- **Pedidos em aguardo vira LUGAR** (setor terminal interno `aguardo`, nome "PEDIDOS EM AGUARDO"): a tela é a aba que já existe — nada novo aparece para o usuário. **ESTOQUE só recebe peça sem dono** (ou de pedido cancelado, que é desvinculada na chegada). Aguardo só recebe peça de pedido vivo. Os dois só com 🟢 (chegada humana — M-14).
- **Arrasto (regra no banco, uma RPC `plt_fn_soltar_card`)**: soltar na **etapa de início** (a próxima depois da fila — mesma regra da migration 30, agora num helper único `fn_etapa_inicio`) **inicia o tempo de quem arrastou** (move + inicia na mesma transação; o limite de 1 por pessoa e o parecer continuam valendo); soltar numa **etapa que encaminha** (coluna nova `plt_etapas.setor_destino_id`) **leva o card ao setor** (com a marcação 🟢🟡🔴 — D-09 é lei); qualquer outra etapa é só mover (fecha a execução — regra que já existia).
- **Rotas das etapas** (dado do dono, não da migration — reaplicar não pode apagar edição do admin): SQL de manutenção semeia as etapas com nome de setor de PRODUÇÃO, CENTRO DE FURAÇÃO → FURAÇÃO e os CONCLUÍDO (SECC/CNC → FURAÇÃO; FITAMENTO → FURAÇÃO; FURAÇÃO → MONTAGEM; MONTAGEM → LIMPEZA E EMBALAGEM). Editável em Setores e etapas ("Manda para").
- **Concluir produção** (só LIMPEZA E EMBALAGEM na tela; RPC `plt_fn_concluir_producao`): pedido vivo → aguardo; sem pedido ou pedido cancelado → ESTOQUE (sem dono). Só 🟢. Reaproveita `plt_fn_mover_card` (mesmas travas, autor do PIN).
- **Cancelamento:** evento novo `unidade_desvinculada` (projeção: `pedido_id` → nulo; produto do catálogo pelo SKU quando não é personalizado). Dispara (a) na chegada ao ESTOQUE de peça de pedido cancelado; (b) no próprio `pedido_cancelado`, para as peças já no aguardo (desvincula + move para o ESTOQUE, origem automação — dentro da blindagem que nunca derruba a integração). Peça em produção segue com o pedido e a etiqueta "Pedido cancelado" (lida da situação do pedido — mesma fonte do evento; nada guardado). Quadro do PCP sem cancelados; aba **Cancelados** (porta nova paginada, carregada ao abrir, para sempre).
- **Alocação:** "peça igual" numa função só (`fn_chave_peca`). Sugestão por vaga (k/n) do pedido na liberação — nunca decide sozinha (desmarcada por padrão). Aceitar = nasce a unidade do pedido direto no aguardo (card novo com o k/n do pedido, `card_criado` com `alocada_de`) e a peça livre é consumida pelo evento `peca_alocada` (projeção: `arquivado_em`) — cada card mantém a própria história, o k/n da reposição não é reescrito, o painel não conta produção de novo. Cancelar o pedido depois → a unidade volta ao ESTOQUE sem dono (fluxo b).
- **Portas da 25 evoluídas:** `fn_estoque_por_produto` (reservados = com pedido em terminal fora da ROTAS), `plt_fn_estoque` (peças do ESTOQUE + reservadas do aguardo; origem reposição/cancelamento), índice único das peças sem pedido ganha o item. `plt_fn_pedidos_aguardo` + `plt_fn_produtos_reservados` + contagens sobre UMA base (`fn_unidades_em_aguardo`) — contadores batem por construção.
- **Painel:** "concluídas" só conta chegada a terminal vinda de fora dos terminais; `plt_fn_dash_estoque` ignora arquivado; "fim de linha" ganha Pedidos em aguardo.

## Task list (espelho da demanda + respostas do dono)

- [ ] 1. Concluir produção só na LIMPEZA E EMBALAGEM (quadro e tablet): pedido vivo → Pedidos em aguardo; sem pedido/cancelado → ESTOQUE sem dono; só 🟢 (revisa D-45)
- [ ] 1b. Quadros de produção só por arrasto: saem os botões; soltar no início inicia; etapa com nome de setor / CONCLUÍDO encaminha (com a marcação); parecer ao soltar; modo tablet vira quadro com PIN ao soltar
- [ ] 1c. Rotas das etapas: coluna + editor em Setores e etapas + manutenção com as regras do dono
- [ ] 2. Pedidos em aguardo com as abas "Pedidos" e "Produtos reservados", paginadas no servidor, contadores batendo
- [ ] 3. Cancelamento nos 3 estágios (PCP → aba Cancelados; em produção → etiqueta + conclui para o estoque sem dono; pronto → estoque sem dono) + aba Cancelados no PCP (paginada, sob demanda, para sempre)
- [ ] 4. Sugestão de alocação na liberação (regra de peça igual; PCP/logística + admin); aceitar → unidade pronta no aguardo; cancelar o pedido → volta ao estoque sem dono
- [ ] 5. Nada da 25 recriado (portas evoluídas, não paralelas); nenhum evento alterado; toda transição é evento novo com projeção
- [ ] 6. Painel: "concluídas" sem dupla contagem; fim de linha com aguardo; tempo no estoque sem arquivados
- [ ] 7. Migration 37 + test:banco (2 rodadas + cenários da S24) · tsc · lint · test · build · F-07 (375/768) · ensaio A-11 · checkpoint antes de aplicar (F-08) · advisors
- [ ] 8. Decisões novas (D-58…) + Requisitos + Esquema do Banco + Modelo de Sistema + memória + demanda + ORDEM/MAPA/PRÓXIMOS PASSOS + handoff

## Log

- 27/09 · branch criada; E-44 e M-15 registrados na memória de aprendizado (pergunta que o código já respondia; o dono pensa em tela).
- 27/09 · **migration 37** (`20260927120000_plt_producao_concluida_cancelamentos.sql`) escrita: tipos novos `unidade_desvinculada` e `peca_alocada` (check `not valid` + validate no fim — E-19); setor terminal `aguardo` ("PEDIDOS EM AGUARDO", ordem 85, só nasce se faltar); `plt_etapas.setor_destino_id` (FK + check: não encaminha para o próprio setor, fila e DANIFICADO nunca); `plt_cards_unidade_coerente` relaxada (unidade sem pedido e sem produto do catálogo vale se tiver card de origem); índice das peças sem pedido ganha `item_seq` (recriado só se ainda não tiver). Helpers em `plt_privado` (execute revogado): `fn_etapa_inicio` (a regra única do início — a migration 30 passou a usá-la), `fn_pedido_cancelado`, `fn_normalizar_texto`, `fn_produto_do_item`, `fn_chave_peca` (b1 do dono), `fn_autor_do_gesto` (gate + operador do PIN), `fn_unidades_em_aguardo` (a base única das abas). Recriadas POR INTEIRO a partir da versão mais nova (E-24): `fn_validar_execucao` (30), `fn_validar_chegada_estoque` (36 — agora cobre os dois fins de linha), `fn_projetar_posicao` (36 + desvinculada/alocada), `fn_reagir_qualidade` (16 + aviso do aguardo e do cancelamento). Gatilho novo `plt_eventos_zz_desvincular_cancelados` (o "zz" é de propósito: AFTER roda em ordem alfabética — depois do aviso, que ainda enxerga o pedido). RPCs novas: `plt_fn_soltar_card`, `plt_fn_concluir_producao`, `plt_fn_sugestoes_alocacao`, `plt_fn_alocar_peca`, `plt_fn_produtos_reservados`, `plt_fn_aguardo_contagens`, `plt_fn_pedidos_cancelados`. Portas evoluídas: `plt_fn_pedidos_aguardo` (mesma forma, base única), `plt_fn_cards_pedido_pcp` (sem cancelados), `fn_estoque_por_produto` (reservados = no aguardo; personalizado fora dos livres), `plt_fn_estoque` (drop+create: `origem_numero`, `local`), `plt_fn_dash_dia`/`_producao_hora`/`_tendencia_semanas` (só chegada vinda de fora dos terminais), `plt_fn_dash_estoque` (sem arquivados).
- 27/09 · decisão técnica: **alocar cria um card novo** (a unidade k/n do pedido nasce no aguardo) e consome a peça livre por evento, em vez de "reescrever" o card livre — reescrever o k/n e o card de origem quebraria a conta da reposição (ela conta as unidades pelo card de origem) e a unicidade das peças sem pedido quando o pedido novo cancelasse. Cada card guarda a própria história; o painel não conta produção de novo (card_criado não é chegada).
- 27/09 · decisão técnica: a etiqueta "Pedido cancelado" da peça em produção é **lida da situação do pedido** (a mesma fonte do evento `pedido_cancelado`), não gravada — nada para dessincronizar (A-23); a desvinculação acontece na CHEGADA ao ESTOQUE (regra no banco — vale para Concluir, Mover, Danificados).
- 27/09 · migrations antigas ajustadas para a reaplicação: 29 perdeu o `validate` do check de tipos (E-19 — quem valida é a 37); 36 cria `plt_cards_unidade_coerente` como `not valid` (a 37 relaxa e valida) e dropa `plt_fn_estoque(text,int,int,bigint,text)` antes de criar (E-17 — a 37 muda a forma).
- 27/09 · manutenções escritas (rodar só com o OK do dono): `2026-09-27_rotas_das_etapas.sql` (só preenche etapa sem rota; testada: rodar de novo não desfaz edição do admin) e `2026-09-27_pecas_de_pedido_para_aguardo.sql` (peça de pedido vivo no ESTOQUE → aguardo por evento origem api; sem aviso; idempotente).
- 27/09 · `npm run test:banco` ✅ — 2 rodadas; 3 cenários antigos ajustados à regra nova (reagrupamento e tarefa do Sistema levavam peça COM pedido ao ESTOQUE pela interface → agora ao aguardo; o seed conta 10 setores e 3 fins de linha) e **54 checks novos da S24** (rotas das etapas, arrasto, concluir, os 3 cancelamentos, alocação com personalizado, contadores das abas, painel, manutenção) — tudo verde na primeira rodada.
