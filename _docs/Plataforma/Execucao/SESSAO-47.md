---
titulo: Diário de execução — SESSAO-47 (pedido adiantado no Tiny, data real da entrega, comprovantes, painel de tempos)
tipo: execucao
data: 2026-11-09
tags: [execucao, sessao-47, expedicao, pcp, tiny, entregas, comprovantes, tempos, modo-tv]
---

# Diário — SESSAO-47 (09/11/2026)

Demanda: [[SESSAO-47 - Pedido Adiantado no Tiny Data Real da Entrega Comprovantes e Painel de Tempos]]
Ramo `sessao-47-pedido-adiantado-entrega-comprovantes-tempos`, na pasta principal (sem worktree), nascido da `main` `067d8ee`.

## Partida (09/11, ~17:25 de Natal)

- O 1º prompt dizia "o texto está no documento do projeto" — o texto não existia em lugar nenhum que a sessão alcança (pasta, cofre, Drive, documentos do Claude, ClickUp; no ClickUp só as 5 tarefas do dia). Avisei o dono e segui com a leitura; ~12 min depois ele mandou o 2º prompt: a demanda chegou pelo GitHub (`067d8ee`, a demanda + a linha na Ordem). `fetch`, `main` local avançada por `update-ref` (com o valor antigo), ramo novo.
- **A pasta tinha trabalho parado de outra sessão** ("Corrigir dados que não batem entre telas", 06/11, parada desde 12:21): o código já estava num ramo LOCAL sem envio (`ajuste-numeros-que-batem`, `e7e3143` — a migration `20261106030000_plt_numeros_que_batem.sql`, a bateria e a `VisaoDoDia.tsx`) e as notas do cofre (D-267…D-270, E-233/E-234, A-196/A-197, handoff, diário) soltas na pasta, sem commit. **Não foi aplicada no banco** (o diário dela para antes; a transcrição termina no commit local).
- **Decisão técnica (provisória, para o dono confirmar): a 47 nasce POR CIMA do ajuste de 06/11.** As duas mexem nas mesmas funções do banco — `plt_fn_rotas`, `plt_fn_rotas_calendario` e `plt_fn_dash_motivos` (a data da entrega) — e a de 06/11 tem número menor: se a 47 recriasse essas funções a partir da `main` e a de 06/11 subisse depois, ela desfaria a 47 (E-24). Feito: junção do ramo dela no meu por encanamento (`merge-tree --write-tree` + `commit-tree` com dois pais + `update-ref` + `read-tree HEAD`, sem tocar nos arquivos da pasta — `55bedb2`) e as notas dela registradas como estavam (`1a53c19`). Consequência: **o ajuste de 06/11 sobe ANTES ou JUNTO da 47** (banco e site); o handoff dela segue com "pendências" por preencher.
- Cópia de segurança do que estava solto: `scratchpad/outra-sessao/` (patch + os 3 arquivos novos).
- **Leitura do banco de produção barrada** pela permissão automática da sessão ("Production Reads") — não contornei. Tudo o que depende do banco vivo (conferir o corpo das funções vivas contra as migrations, as situações reais do Tiny, o 13652 e o 13684, a chave da ida ao Tiny) fica para o passo do OK do dono, antes de aplicar. Até lá, a base é o repositório (o último `create` de cada função nas migrations).
- Ficam fora dos commits: `_docs/.obsidian/graph.json` e `workspace.json` (estado do Obsidian) e `supabase/.temp/` (CLI).

## Numeração (conferida na pasta, no ramo da 46 e no remoto)

- Decisões: **D-271…** (a de 06/11 usou até D-270). Erros: **E-235…**. Acertos: **A-198…**.
- Migrations: `20261109010000…` em diante (a última da pasta é `20261106030000`).
- Bateria: bloco novo em `{ }`; faixa de ids e nomes de teste a conferir antes de escrever (E-142/E-157).

## Task list (espelha a demanda)

**Bloco A — pedido adiantado no Tiny com falta**
1. ⏳ F1 · A Expedição mostra o pedido (mesmo com 0 peça), com o aviso da situação real e o quadradinho "Saiu do PCP pelo Tiny".
2. ⏳ F2 · Os dois botões ("Voltar para Em aberto (Tiny)" / "Voltar para Preparando envio (Tiny)"): confirmação de uma frase; uma chamada idempotente — pede ao Tiny pela fila de saída, devolve ao PCP na hora (marca por fato + projeção), fato na trilha + log, aviso ao PCP; a marca vale até o Tiny confirmar; aviso antigo fora de ordem não esconde; falha → "o Tiny ainda não confirmou" + alerta; ida ao Tiny desligada → botões desabilitados com a explicação; stand-by mantido.
3. ⏳ F3 · A janela de liberar peça: situação real + três opções (Em aberto, Preparando envio, Deixar como está), no mesmo gesto e transação; "Não lançar agora" como hoje.
4. ⏳ F4 · Avisos que dizem a verdade ("voltou ao PCP" só quando voltou; senão "ficou na Expedição esperando decisão").

**Bloco B — a entrega**
5. ⏳ F5 · "Confirmar entrega" / "Ainda não" / "Marcar como entregue no dia…" (Rotas e Entregas do dia); nunca futuro (no banco, fuso da fábrica), nunca antes da chegada; fato nasce no dia real (fim do expediente); reflete em tudo (ficha, Entregas do dia, lista, calendário com a nota "programado para dd/mm", números por dia); desfazer "do dia" pelo registro; correção só do admin na ficha, por fato novo, motivo opcional; a data não vai ao Tiny.
6. ⏳ F6 · Vários comprovantes de uma vez (painel do Entregue, "Comprovante" no card, ficha do pedido): até 10, cada um sobe sozinho, falha não derruba os outros, a tela diz qual falhou e deixa tentar só aquele; a entrega antes dos comprovantes; contagens certas.

**Bloco C — painel de tempos**
7. ⏳ F7 · "Configurar painel" (só admin): tipo de gráfico, montadores liga/desliga com letra, nome e foto (desligado → "Outros", totais iguais; dupla = letra do ligado + "Outros"), linha do tempo padrão, abrir já filtrado (setor e período), média ou mediana (rótulo certo), o que a TV mostra; ao vivo pelo canal que a TV já usa; uma linha de configuração + coluna na equipe do painel; a configuração vem na mesma porta de cada aba; log e Auditoria.

**Geral**
8. ⏳ Bateria 2×, tipos, lint, testes de tela, pacote; celular 375 e tablet 768; ensaio ×100 das portas novas/tocadas; advisors (depois de aplicar).
9. ⏳ ClickUp: as 5 tarefas em FAZENDO ao começar cada uma + comentário ao entregar; a 6ª ("Expedição - Aviso de pedido que saiu do PCP pela situação do Tiny") só com o OK do dono.
10. ⏳ Cofre: decisões provisórias, memória, esquema, lei, modelo de sistema, handoff, ordem, mapa.

## Lições da memória que valem nesta sessão (relidas em 09/11)

- Regra 20 (nenhum `cd`); commit por caminho explícito e `git branch --show-current` antes (E-23/E-113); `git diff --numstat` antes de todo commit; a bateria não se formata (E-110).
- Função recriada = extração da versão viva + md5 (E-24/E-170/A-96/A-97/A-116); retorno/assinatura nova = `drop` + `create`, consertar as migrations antigas que a recriam, pôr a nova na cadeia de reaplicação do bloco 38 e `grep` da assinatura velha na bateria (E-17/E-120/E-165/E-178); check recriado: o `validate` mora na migration mais nova (E-19/E-159/E-144).
- Bloco novo da bateria em `{ }`, com faixa própria de ids/nomes (E-70/E-142/E-157); porta `invoker` provada como `authenticated` (E-103/A-66); ajudante que troca de papel usa ponto de volta (E-161).
- Banco e site sobem juntos (E-73/E-143). Pelo conector, nada com `DROP` (E-108) — aplicar pelo aplicador com `--so`.
- Regra por linha não mora em função com `SET` (E-65); ensaio ×100 antes da tela (E-192/A-73); página antes de agrupar (E-172).
- Fato que vale no passado: `ocorrido_em` = quando valeu, `registrado_em` = agora (A-121); horários da mesma transação são iguais — desempate por id (E-176).
- "Só do dia" olha QUEM fez, não só quando (E-89). Valor do Tiny se confere no banco antes de virar regra; comparar normalizado (A-61/E-100).
- Texto: plural por extenso (E-52); nada de aviso com o dado carregando (E-96); gesto que não vale não aparece (E-97); códigos internos nunca na tela (12b).
- Tela logada sem o dono = vitrine + porta no banco; nunca simular sessão contra a API (E-141/A-117); foto pelo Edge sem janela, gráficos sem animação (A-104/A-143); `vitest run --root "$R" --dir src` (A-194).
- Script com crase/`${}` vai em arquivo pela ferramenta de escrita (E-45/E-79/E-145); Python com `newline=''` (E-105).

## Mapa do código (levantado por 3 ajudantes de leitura em 09/11; a "vigente" é o último `create` nas migrations)

### Bloco A
- **Regra do PCP (D-132):** `plt_privado.fn_tiny_tirou_do_pcp(text)` — `20261014200000_plt_pcp_segue_o_tiny.sql:40` (`fn_situacao_normalizada(s) in ('faturado','pronto_para_envio','enviado','entregue','nao_entregue','cancelado')`); `fn_situacao_normalizada` — `20260908120000…:38` (minúsculas, sem acento, espaço → `_`). `pedidos.situacao` guarda a DESCRIÇÃO do Tiny. ⚠️ a conferir no banco vivo: "Faturado (atendido)" normaliza para `faturado_(atendido)`, que não está na lista do PCP (está na `fn_tiny_situacao_api`).
- **Quem lê a regra:** `plt_fn_pcp_quadro` (`20261105010000…:660`, filtro 685–691: não arquivado, `liberado_completo_em is null`, não tirou, com item de produção) · `plt_fn_cards_pedido_pcp` e `plt_fn_dash_pcp_dia` (`20261014200000`; a `dash_pcp_dia` vigente em `20261022050010:702`) · `plt_fn_pcp_standby` (`20261022050010:280` — recusa "O Tiny já levou este pedido adiante") · `plt_privado.vw_standby_na_aba` (`20261106030000`) · `vw_pedidos_vivos_regra` (`20261027040000:215` — o adiantado só fica com peça viva) · `vw_pedidos_vivos` (`20261023020000:201`) · `vw_pedido_prontidao` (`20261022020000:38`) · `plt_fn_pedidos_lista` (`20261027040000:1543`, `situacao_plataforma='tiny'` → "Segue no Tiny") · `plt_fn_expedicao_kanban` (`20261027040000:1842`).
- **Expedição:** porta `plt_fn_expedicao(p_filtro,p_busca,p_limite,p_deslocamento)` — `20261022050010:757` (lê `vw_pedidos_vivos`; devolve `situacao`, `standby`, `alterado_apos_liberacao`; gate `fn_pode_ver_expedicao`). Tela `src/paginas/Expedicao.tsx` (`CartaoExpedicao` 336–487; selos; "Liberar para outro pedido" linha 470); API `src/logistica/api.ts:579` (`PedidoExpedicao`) e `:631` (`listarExpedicao`).
- **Liberar peça (D-219):** tudo em `20261105010000…`: `fn_liberar_peca_avaliar` (359), `plt_fn_liberar_peca_destino` (464), `plt_fn_liberar_peca(p_peca_id,p_para_numero,p_motivo,p_relancar,p_chave)` (484–650; idempotente pela chave no fato `unidade_desvinculada`; passo 4 chama `plt_fn_pcp_standby` quando "não por enquanto" — que RECUSA com o Tiny adiante e desfaz o gesto inteiro; passo 5 avisa sempre "Pedido N voltou ao PCP" por `fn_avisar_publico('pedido_peca_liberada','pcp',…)`; devolve `tiny_adiante`). Tela `src/logistica/componentes/ModalLiberarPeca.tsx` (toast 112–124; pergunta "Lançar produto novo…" 258–272); API `src/logistica/api.ts:776–835`.
- **Volta ao PCP só com o que falta:** `fn_vagas_pedido` (`20261104010000:84`), `fn_recalcular_liberacao` (209), `fn_reagir_itens_pedido` (802, gatilho adiado `plt_pedidos_zz_itens` — não pode abrir "itens novos" na confirmação do Tiny), `fn_reagir_pedido` (1925), `fn_avisar_publico` (446), catálogo de avisos `fn_avisos_catalogo` (`20261105010000:794`), check dos tipos de fato `plt_eventos_tipo_check` (`20261104010000:33–47`; ⚠️ a de 06/11 pode ter recriado — conferir a mais nova).
- **Fila de saída do Tiny (D-113/D-123):** `20261008150000_plt_entregue_nos_dois_lados.sql`: tabela `plt_tiny_pedido_fila` (249; check `motivo in ('entregue','desfeita')`), `fn_tiny_situacao_api` (281), `fn_tiny_pedido_pausado` (315, disjuntor), `fn_tiny_pedido_chamar` (351, `net.http_post` 5 s para o webhook `tiny_pedido_situacao`), `fn_tiny_pedido_enfileirar(pedido, situacao, motivo)` (400; devolve `'desligado'` com `fn_tiny_entrega_desde()` nulo), relógio só com fila (428). Resposta do n8n: `plt_fn_tiny_pedido_resultado(pedido, versao, ok, erro)` — `20261028030000:338` (OK apaga a linha e grava `plt_logs_atividade` `tiny_situacao_alterada`; 8 erros → `parado_em` + aviso `tiny_pedido_parado` aos admins; NÃO atualiza `pedidos.situacao`). n8n: nó "Validar pedido" aceita `aberto` e `preparando_envio`; v2 `pedido.alterar.situacao`.
- **Permissão:** `fn_pode_ver_expedicao()` (`20261019120000:58`) = logística ou admin; front `useAcessoLogistica()` (`src/logistica/acesso.ts`).

### Bloco B
- **Registrar:** `plt_fn_registrar_entrega(p_card_id,p_observacao,p_confirmar_incompleto)` — `20261022020100…:29–116` (toque repetido: `ocorrido_em > now() − 10 min`; chama `fn_fechar_pedido` 118–248 — o fato `pedido_entregue` com `ocorrido_em = now()` — e `fn_tiny_pedido_enfileirar(…,'entregue','entregue')`). Parcial: `plt_fn_entrega_parcial` — `20261027040000:290–475` (insert próprio do `pedido_entregue`, `dados.parcial`). Projeção: `fn_projetar_entrega` (`20261008150000:88–109`) → `plt_cards.entrega_evento_id`. Não há coluna de data: toda tela lê `plt_eventos.ocorrido_em` do fato vigente.
- **Desfazer:** `plt_fn_entrega_desfazer` — `20261104010000:579–681` ("mesmo dia" por `ocorrido_em` em Fortaleza, 626–630 e 666–669; `e.recebido_em <= v_entrega.ocorrido_em` na 639); `fn_reabrir_entrega` (486); `fn_tiny_saiu_de_entregue` (686).
- **Leitores da data:** `plt_fn_pcp_pedido_detalhe` (`20261027040000:1950–2120`, `'entrega' → 'em'`) · `plt_fn_pedidos_lista` (`:1543`, `entregue_em` 1687) · `plt_fn_rotas` (`20261106030000:56–157`) · `plt_fn_entregas_do_dia` (`20261105010000:227–350` — a lista é por `pr.data_entrega`) · `plt_fn_rotas_do_dia` (`20261014140000:471–491`) · `plt_fn_programadas` (`20261105020000:109`, criada com `drop` + `create function`) · `plt_fn_rotas_calendario` (`20261106030000:648+` — o entregue no dia PROGRAMADO) · `plt_fn_dash_motivos` (`20261106030000:437–643`, `entregues` por `ocorrido_em`, conta também as desfeitas). Nenhum outro painel conta entregas (conferidos `dash_dia`, `dash_agora`, `dash_visao_do_dia`, `dash_tendencia_semanas`, `dash_pcp_dia`, Meu painel).
- **Molde de fato novo + data:** `plt_fn_pedido_data_entrega` (`20261027040000:128–209`, fato `data_entrega_alterada`, tabela `plt_pedido_datas`; usa `current_date` — UTC). "Nunca futuro" pelo fuso: `plt_fn_definir_nascimento` (`20260927180000:1094`).
- **Telas:** `src/paginas/Rotas.tsx` (confirmação inline 317–359; `entregarMutacao` 117–137) · `src/paginas/EntregasDoDia.tsx` (`CartaoEntrega` 486–684, `PainelEntregue` 703–812 — entrega e depois comprovante; `ModalAnexar` 876–936; desfazer 409–421/671–676) · `src/pedidos/FichaDoPedido.tsx` (entrega 276/600; `doDia` 508; reabrir 503–519/631–640; anexos 656–697 — hoje só MOSTRA, não envia) · `src/pedidos/PaginaPedidos.tsx:259–291` · `src/rotas/AbaCalendario.tsx`, `calendario.ts`, `AbaJaProgramadas.tsx:687` · `src/rotas/api.ts` (`registrarEntrega` 77–88, `entregueHoje` 260–264, `anexarComprovante` 865–889, `TIPOS_COMPROVANTE` 834, limite 10 MB 836, `linkDoAnexo` 909) · `src/rotas/estadoPedido.ts` (`pedeConfirmacaoDeEntrega`, `fraseEntregaIncompleta`) · `src/rotas/ModaisEntrega.tsx`.
- **Anexos:** tabela `plt_anexos` (`20261008160000:308`, + `20261014170000:24`), armário `plt-anexos` (25 MB), `plt_fn_anexo_registrar` (`20261014170000:97–170`, idempotente pelo caminho, fato `anexo_adicionado`), `plt_fn_anexos` (176). Molde de vários arquivos: `src/tech/ModalSugerir.tsx` (172–204, 273) e `src/kanban/janela/AnexosDoCard.tsx` (já `multiple`, para no 1º erro).
- **Datas no front:** `hojeNaFabrica()` (`src/dashboards/tempos/formato.ts:77`), `Campo type="date"` com `max`.

### Bloco C
- **Tela:** `src/paginas/dashboards/TemposProducao.tsx` (abas preguiçosas `PAINEIS` 44; setor: URL → `localStorage 'domoby:tempos-setor'` → Montagem; período `?p=` padrão `30` fixo na linha 112; aba padrão `dia` na 154; botão Modo TV 181–195; `useAoVivo('setor_N', [['tempos-producao']])` 127). Abas em `src/paginas/dashboards/tempos/` (AbaDia — "linha do dia" em HTML; AbaPeriodo — o único gráfico Recharts da tela, barras empilhadas por equipe, 139–215; AbaMoveis e AbaMontadores — sem gráfico; AbaConferir; `comum.tsx`). API `src/dashboards/tempos/api.ts`; apoio `formato.ts`.
- **Portas (todas em `20261105040000_plt_tempos_producao_modo_tv.sql`):** `plt_fn_tempos_dia` (593), `_periodo` (748), `_moveis` (881), `_modelo_passagens` (1013), `_montadores` (1073), `_conferir` (1226), `_procurar` (1394), `_opcoes`; `fn_tempos_acesso` (476), `fn_tempos_padroes` (542), `fn_tempos_pessoas` (558); projeções `plt_tempo_montagens`/`plt_tempo_montagem_pessoas` (230/266), visão `vw_tempo_montagens` (466). Média × mediana: Dia e Período devolvem as duas; Móveis, Montadores e TV só a mediana.
- **TV:** `src/paginas/dashboards/ModoTv.tsx` (`ouvirCanal('plt-aviso:setor_N')`, evento `mudou` → relê com espera; blocos: 4 números, coluna dos montadores por letra, gráfico de 14 dias, "Melhor da semana", relógio, "Dados até"); porta `plt_fn_modo_tv(p_setor_id,p_dia)` — `20261106020000:79` (letras em 124–145: alguém da equipe sem letra → "Outros"); `fn_aviso_pode_ouvir` (`20261105040000:184`), `fn_avisar`/`fn_avisar_evento` (`20261008170000:56`, `20261016030000:307`).
- **Equipe e regras:** `plt_tempo_equipe` (setor, pessoa, papel, letra — `20261031010000:155`), `plt_fn_tempo_equipe`/`_salvar` (1154/1185), `plt_tempo_config` (linha única, 36), `plt_tempo_regras` (por setor, 49), molde ler/salvar `plt_fn_tempo_regras`/`_regras_salvar` (1019/1043), trilha `fn_tempo_trilha` (537), `fn_tempo_so_admin` (565). Tela da equipe: `src/paginas/controleTempo/AbaEquipe.tsx`.
- **Componentes:** `Modal` (`src/componentes/ui/Modal.tsx`), `Interruptor` (`src/paginas/controleTempo/comum.tsx:8`), `FiltroPill` (`src/dashboards/componentes/Filtros.tsx:10`), `Selecao`, `Abas`, `CabecalhoDaTela`, `Botao`.

## Decisões técnicas

(preencher conforme forem tomadas)

## Diário

- 17:25–18:40 · leitura do cofre (CLAUDE.md, memória inteira, decisões D-01…D-17 e as vizinhas da demanda, visão geral, perguntas em aberto, lei), a demanda, os handoffs da 44 e da 45; mapa do código pelos 3 ajudantes; junção do ajuste de 06/11.
