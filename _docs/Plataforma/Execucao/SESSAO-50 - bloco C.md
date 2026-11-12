---
titulo: "Diário — SESSAO-50 · bloco C · editar a parada avulsa e o endereço de entrega do pedido"
tipo: execucao
data: 2026-11-12
tags: [execucao, sessao-50, rotas, logistica, tiny]
---

# Diário — SESSAO-50 · bloco C (frente paralela, 12/11/2026, madrugada)

Demanda: [[SESSAO-50 - Observacao do Item Cancelar e Ocultar no PCP e Editar Endereco da Parada]] (bloco C) · ramo `sessao-50-c-endereco` · cópia isolada `scratchpad/s50/w-c` (worktree nascida da base `7a02c49`). Supervisor: a sessão principal (bloco B). Ferramentas e rascunhos do bloco em `scratchpad/s50/c-ferramentas/`.

Migration reservada: **`20261112060000_plt_editar_endereco.sql`** · faixa de teste: pedidos `99810`–`99849`, produtos `tiny_id` `9980001`…`9980099`.

## Leitura (antes de codar)

CLAUDE.md (regras 10–18 e 20), a demanda duas vezes (pedido, respostas de 01:25 e 01:30, bloco C, fora do escopo, critérios do bloco C e gerais, notas), a base `20261112010000` (os tipos `endereco_entrega_*` já no check; o aviso `endereco_tiny_mudou` já no catálogo, público logística), o diário do supervisor (lições), modelo de sistema (§2–4, 5, 7, Logística/ROTAS, SESSAO-41, SESSAO-39, Área Pedidos), lei de desempenho (§1–4, 6, 7.4, 12), memória E-241…E-269 e A-196…A-222, decisões D-40, D-50, D-93, D-132, D-193, D-194, D-196, D-217, D-218, D-221, diário da SESSAO-41 (as telas da parada avulsa). Coordenação do supervisor (mensagem): `plt_fn_rotas` e `vw_pedidos_vivos_regra` são dele — não recriar; as outras portas de rotas e a `vw_endereco_entrega` são do bloco C.

## O que existia (conferido nas migrations)

- `plt_fn_parada_avulsa_salvar` já edita com `p_id` (logística, ou quem pôs enquanto pendente), mas a logística editava até parada feita, e o registro da edição guardava só o id. `fn_parada_json` (lida por `plt_fn_entregas_do_dia` e `plt_fn_paradas_avulsas`) devolvia `sou_autor` e `situacao`, sem dizer quem pode editar.
- `plt_privado.vw_endereco_entrega` (SESSAO-41, D-193) — o endereço de entrega do Tiny inteiro, senão o do cadastro — lida por: `plt_fn_programacao`, `plt_fn_programacao_candidatos`, `plt_fn_programadas`, `plt_fn_entregas_do_dia`, `plt_fn_rotas` (do supervisor), `plt_fn_rotas_calendario`, `plt_fn_devolucao_detalhe`, `plt_fn_pcp_pedido_detalhe` (a ficha). Programa `c-ferramentas/quem-le-c.mjs` (o `quem-chama` só acha nome com parêntese; visão é lida sem).
- `plt_fn_geo_marcar(chave, endereco, lat, lon)` — logística/admin (`fn_pode_ver_expedicao`), `md5(lower(endereco))` = chave, `fn_endereco_geocodificavel(rua, número, bairro, cidade, UF, CEP)` (o complemento não entra na chave).
- Todo fato já vira registro de atividade sozinho (`fn_logar_evento`: quem, o tipo, o card, o evento) e a Auditoria mostra a observação do fato como o "por quê" (`plt_fn_auditoria` junta pelo `evento_id`).

## Banco — `20261112060000_plt_editar_endereco.sql` (gerada por programa: `c-ferramentas/gerar-c.mjs` + `modelo-060000.sql` + `parada-edicao.sql`)

As funções que já existiam saem da última versão nas migrations (`extrair-sem-c.mjs` — o extrator ignorando a própria migration do bloco, para a geração ser repetível) com trocas de contagem exata:

| Peça | O que muda |
|---|---|
| `plt_pedido_enderecos` (nova) | a projeção: uma linha por pedido com endereço mudado na plataforma — os 7 campos, `tiny_assinatura` (o resumo do endereço do Tiny daquele momento), `tiny_original` (o do Tiny, para o selo), `escolha`, `tiny_confirmado_em`, `evento_id`, quem/quando. RLS ligada, nenhum acesso direto; só o gatilho do fato escreve (M-13). |
| `plt_privado.vw_endereco_tiny` (nova) | a regra do Tiny da D-193, sem mudar uma letra (extraída da `vw_endereco_entrega` e renomeada). |
| `plt_privado.vw_endereco_entrega` | só o corpo: o da plataforma quando existe, senão o do Tiny — as mesmas 9 colunas, na mesma ordem e tipos (E-251; conferido no banco de ensaio). Junção pela chave (`pedido_id`). |
| `fn_endereco_limpo` / `fn_endereco_assinatura` / `fn_endereco_legivel` / `fn_endereco_tiny_motivo` | as peças pequenas: limpar o que se digitou (espaços, UF maiúscula, CEP 00000-000), o resumo para comparar (sem caixa, sem espaço sobrando, CEP só números), o endereço numa linha, o porquê do "salvar no Tiny" desligado. |
| `fn_validar_endereco_entrega` + gatilho | os 4 fatos só pela maquinaria (`plt.endereco_maquinaria`), no card do pedido; alterado/restaurado com pessoa e escolha; os do Tiny só pelo Sistema. |
| `fn_projetar_endereco_entrega` + gatilho | alterado → grava/atualiza a linha; tiny_confirmado → o resumo do Tiny passa a ser o da plataforma e marca a confirmação; restaurado / tiny_substituido → a linha sai. |
| `fn_endereco_mudar` (o miolo) + `plt_fn_pedido_endereco_salvar` / `plt_fn_pedido_endereco_restaurar` | ver abaixo. |
| `plt_fn_pedido_endereco` (leitura da janela) | o que vale, o do Tiny (e de onde veio), quem mudou e quando, o ponto de agora (e se é manual), quem pode e o porquê, o porquê do Tiny desligado (para salvar e para voltar). |
| `fn_endereco_conferir_tiny` + gatilhos `plt_pedidos_endereco_tiny` (pedidos: endereço de entrega ou cliente mudou) e `plt_clientes_endereco_tiny` (clientes: o endereço do cadastro mudou) | o Tiny mudou o endereço por fora → `endereco_entrega_tiny_substituido`, a linha sai, sino `endereco_tiny_mudou` para a logística (`fn_avisar_publico`); o Tiny chegou com o endereço que a plataforma pediu → `endereco_entrega_tiny_confirmado` (a nossa escrita voltando — sem aviso). Blindados: erro vira `automacao_erro` e a gravação do Tiny segue (o molde de `fn_desvincular_por_cancelamento`). |
| `fn_parada_json` | + `pode_editar` (pendente e logística ou quem pôs). |
| `plt_fn_parada_avulsa_salvar` | a edição: só da pendente (para todos); salvar sem mudar nada devolve `repetido` sem registrar; o registro `parada_avulsa_editada` com o antes e o depois só do que mudou (título, endereço, ponto, observação) e a lista "Campos alterados". |
| `plt_fn_pcp_pedido_detalhe` (a ficha) | + `endereco_plataforma` (quando há — E-237): quando, quem, a escolha, a confirmação do Tiny e o original. |
| `plt_fn_programacao_candidatos` (aba Programar) | + `endereco_plataforma` por pedido (quando há): o original e a confirmação — o selo do cartão. Junção pela chave só nas linhas da página (até 200). |

O miolo (`fn_endereco_mudar`): logística/admin (`fn_pode_ver_expedicao` — a mesma de marcar o ponto); pedido sem card recusa; **pedido entregue só o admin (provisória)**; `p_tiny = true` recusado com o porquê (o banco recusa igual à tela); o card do pedido travado (`for update` — dois toques viram um depois do outro); o endereço novo limpo e conferido (rua ≥ 3, cidade ≥ 2, UF 2 letras, CEP 8 números se veio, tamanhos); **igual ao que vale = nada muda** (o toque repetido; só o ponto, se veio, pelo `plt_fn_geo_marcar` de sempre); **igual ao do Tiny = é a volta ao original**; o fato leva o **original do Tiny inteiro** (`fonte` entrega/cadastro, os campos como a regra os lê, o `pedidos.endereco_entrega` cru e o endereço do cadastro), o anterior (com a fonte), o novo, o ponto, a escolha e o resumo do Tiny; o pino vai ao `plt_geocache` como manual **para a chave do endereço que passa a valer** (pelo próprio `plt_fn_geo_marcar` — um dono só para o ponto manual); `fn_avisar('rotas')`.

### Escolhas onde a demanda não diz (o supervisor numera)

- **PROVISÓRIA P1 — a projeção é uma tabela própria e pequena** (`plt_pedido_enderecos`), no molde da `plt_pedido_datas` (D-194), e não colunas no card do pedido: banco enxuto (D-47) — só os pedidos alterados têm linha; 14 colunas quase sempre vazias na tabela mais quente (`plt_cards`) seria "encher linguiça"; a `vw_endereco_entrega` é por pedido (a junção é pela chave primária); a `plt_pedido_datas` é de outra regra, com outro ciclo de vida (juntar as duas misturaria apagamentos).
- **PROVISÓRIA P2 — a regra do Tiny mudou de casa** (`vw_endereco_tiny`), sem mudar uma letra: um dono para "onde entregar segundo o Tiny" (a conferência e a janela leem dela) e um para "onde entregar" (a que todos leem).
- **PROVISÓRIA P3 — o "Tiny mudou por fora" olha também o cadastro do cliente** (gatilho em `clientes`), não só o endereço de entrega do pedido: a maioria dos pedidos usa o endereço do cadastro (D-193); sem esse gatilho, o cadastro mudado no Tiny passaria despercebido.
- **PROVISÓRIA P4 — comparar endereço é comparar o resumo** (sem caixa, sem espaço sobrando, CEP só com os números): o Tiny devolvendo "RUA DAS FLORES" / "59075000" para o que a plataforma pediu como "Rua das Flores" / "59075-000" é confirmação, não mudança (testado).
- **PROVISÓRIA P5 — depois que o Tiny confirmar, "Voltar ao endereço original" é recusado** ("edite o endereço — o original está no histórico"): com o Tiny já no endereço novo, voltar só na plataforma não volta nada. Hoje não acontece (o Tiny está desligado).
- **PROVISÓRIA P6 — escrever de novo o endereço do Tiny na janela = "Voltar ao endereço original"** (o fato `endereco_entrega_restaurado`), e não uma "alteração para o mesmo do Tiny".
- **PROVISÓRIA P7 — pedido sem card na plataforma não muda o endereço aqui** (o fato mora no card do pedido); a janela diz o porquê.
- **PROVISÓRIA P8 — o registro de atividade do endereço do pedido é o do próprio fato** (`fn_logar_evento`); a Auditoria mostra a observação do fato ("de … para … (o Tiny não muda)"). O 1º ensaio gravava um registro a mais e a Auditoria mostraria a mesma linha duas vezes — tirado (ver Lições).
- **PROVISÓRIA P9 — na volta ao original, o botão do Tiny diz "O Tiny já está com o endereço original — só a plataforma volta."** em vez da frase do salvar: enquanto o endereço não foi ao Tiny, o Tiny nunca mudou.
- **PROVISÓRIA P10 (a confirmar com o supervisor) — o selo no cartão de "Já programadas"**: a porta de "Já programadas" (`plt_fn_programadas`) devolve uma TABELA, e a migration `20261109030000` (que a bateria reaplica no bloco da SESSAO-47, depois de todas) a recria com as colunas de antes — mudar o formato quebraria a reaplicação. O cartão de "Já programadas" mostra o endereço novo e o botão "Editar endereço"; o selo e o original aparecem na janela (e na ficha, e nos cartões da aba Programar).

### Fumaça (PGlite em disco, duas rodadas de todas as migrations — `c-ferramentas/fumaca.mjs`)

Tudo aplicado duas vezes sem erro (a 040000, que recria a visão com o corpo antigo, reaplicada por cima e a do bloco C de novo depois). Conferido em `fumaca-1..3.sql`: a leitura da janela (fonte cadastro/entrega, os porquês do Tiny: "Preparando envio" → "O Tiny só deixa…", "Em aberto" → "ainda não está ligado"); "também no Tiny" recusado; salvar só na plataforma (fato com o original inteiro, projeção, ponto manual na chave nova, aviso de rotas); o mesmo toque = nada; 2ª mudança (o anterior = o da plataforma, o original segue o do Tiny); a ficha com o selo; o cadastro mudando no Tiny → substituído + 2 avisos (logística e admin); o Tiny reenviando igual = nada; a nossa escrita voltando (caixa e CEP diferentes) = confirmado, sem aviso; voltar depois de confirmado = recusado; o Tiny mudando de novo = substituído; restaurar (porta) e escrever o original = restaurado; validações (rua, UF, CEP, ponto fora do Brasil, meio ponto); operador recusado; fato solto recusado; conferência quebrada de propósito → o Tiny grava e o alerta de automação sai; parada: edição com antes/depois só do que mudou, toque repetido sem registro, `pode_editar` (logística, entregador na dele, feita = falso), feita não edita (nem a logística), entregador não edita a da logística; as portas das rotas lendo o endereço novo; entregue: logística recusada, admin aceito; permissões (anônimo fora; o miolo e a tabela fechados); as colunas da visão iguais.

## Lições (o supervisor numera)

- Ensaio de banco que reaplica UMA migration antiga por cima de tudo (a 040000) deixa as outras funções que ela recria na versão antiga (as entregas do dia sem as paradas) e o check dos tipos sem os da 50 — o ensaio tem de reaplicar TUDO (duas rodadas, como a bateria). Custou uma rodada de fumaça confusa.
- Todo fato já vira registro de atividade sozinho (`fn_logar_evento`) — porta que grava fato não grava registro com a mesma ação (a Auditoria mostraria duas linhas).
