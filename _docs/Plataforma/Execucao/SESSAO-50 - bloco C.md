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
| `plt_fn_paradas_avulsas` / `plt_fn_entregas_do_dia` (as duas leituras das paradas) | + `pode_editar` em cada parada, somado na própria leitura: no período (só a logística lê) = pendente; nas entregas do dia = pendente **e** (logística **ou** quem pôs), com o "sou da logística?" que a porta já calcula uma vez. **A `fn_parada_json` NÃO muda** — a 1ª versão pôs a regra lá dentro e o ensaio ×100 mostrou o custo (ver "Ensaio ×100"). |
| `plt_fn_parada_avulsa_salvar` | a edição: só da pendente (para todos); salvar sem mudar nada devolve `repetido` sem registrar; o registro `parada_avulsa_editada` com o antes e o depois só do que mudou (título, endereço, ponto, observação) e a lista "Campos alterados". |
| `plt_fn_pcp_pedido_detalhe` (a ficha) | + `endereco_plataforma` (quando há — E-237): quando, quem, a escolha, a confirmação do Tiny e o original. |
| `plt_fn_programacao_candidatos` (aba Programar) | + `endereco_plataforma` por pedido (quando há): o original e a confirmação — o selo do cartão. Junção pela chave só nas linhas da página (até 200). |

O miolo (`fn_endereco_mudar`): logística/admin (`fn_pode_ver_expedicao` — a mesma de marcar o ponto); pedido sem card recusa; **pedido entregue só o admin (provisória)**; `p_tiny = true` recusado com o porquê (o banco recusa igual à tela); o card do pedido travado (`for update` — dois toques viram um depois do outro); o endereço novo limpo e conferido (rua ≥ 3, cidade ≥ 2, UF 2 letras, CEP 8 números se veio, tamanhos); **igual ao que vale = nada muda** (o toque repetido; só o ponto, se veio, pelo `plt_fn_geo_marcar` de sempre); **igual ao do Tiny = é a volta ao original**; o fato leva o **original do Tiny inteiro** (`fonte` entrega/cadastro, os campos como a regra os lê, o `pedidos.endereco_entrega` cru e o endereço do cadastro), o anterior (com a fonte), o novo, o ponto, a escolha e o resumo do Tiny; o pino vai ao `plt_geocache` como manual **para a chave do endereço que passa a valer** (pelo próprio `plt_fn_geo_marcar` — um dono só para o ponto manual); `fn_avisar('rotas')`.

### Escolhas onde a demanda não diz (o supervisor numera)

- **PROVISÓRIA P1 — a projeção é uma tabela própria e pequena** (`plt_pedido_enderecos`), no molde da `plt_pedido_datas` (D-194), e não colunas no card do pedido: banco enxuto (D-47) — só os pedidos alterados têm linha; 14 colunas quase sempre vazias na tabela mais quente (`plt_cards`) seria "encher linguiça"; a `vw_endereco_entrega` é por pedido (a junção é pela chave primária); a `plt_pedido_datas` é de outra regra, com outro ciclo de vida (juntar as duas misturaria apagamentos).
- **PROVISÓRIA P2 — a regra do Tiny mudou de casa** (`vw_endereco_tiny`), sem mudar uma letra: um dono para "onde entregar segundo o Tiny" (a conferência e a janela leem dela) e um para "onde entregar" (a que todos leem).
- **PROVISÓRIA P3 — o "Tiny mudou por fora" olha também o cadastro do cliente** (gatilho em `clientes`), não só o endereço de entrega do pedido: a maioria dos pedidos usa o endereço do cadastro (D-193); sem esse gatilho, o cadastro mudado no Tiny passaria despercebido.
- **PROVISÓRIA P4 — comparar endereço é comparar o resumo** (cada parte pela régua de nome da casa, `fn_nome_comparavel` — sem acento, sem caixa, sem espaço — e o CEP só com os números): o Tiny devolvendo "RUA DAS FLORES" / "59075000" para o que a plataforma pediu como "Rua das Flores" / "59075-000" é confirmação, não mudança (testado). A 1ª versão usava `lower()`, que depende da língua do banco para letra acentuada ("ACÁCIAS") — trocada pela régua da casa antes da bateria.
- **PROVISÓRIA P5 — depois que o Tiny confirmar, "Voltar ao endereço original" é recusado** ("edite o endereço — o original está no histórico"): com o Tiny já no endereço novo, voltar só na plataforma não volta nada. Hoje não acontece (o Tiny está desligado).
- **PROVISÓRIA P6 — escrever de novo o endereço do Tiny na janela = "Voltar ao endereço original"** (o fato `endereco_entrega_restaurado`), e não uma "alteração para o mesmo do Tiny".
- **PROVISÓRIA P7 — pedido sem card na plataforma não muda o endereço aqui** (o fato mora no card do pedido); a janela diz o porquê.
- **PROVISÓRIA P8 — o registro de atividade do endereço do pedido é o do próprio fato** (`fn_logar_evento`); a Auditoria mostra a observação do fato ("de … para … (o Tiny não muda)"). O 1º ensaio gravava um registro a mais e a Auditoria mostraria a mesma linha duas vezes — tirado (ver Lições).
- **PROVISÓRIA P9 — na volta ao original, o botão do Tiny diz "O Tiny já está com o endereço original — só a plataforma volta."** em vez da frase do salvar: enquanto o endereço não foi ao Tiny, o Tiny nunca mudou.
- **PROVISÓRIA P10 (a confirmar com o supervisor) — o selo no cartão de "Já programadas"**: a porta de "Já programadas" (`plt_fn_programadas`) devolve uma TABELA, e a migration `20261109030000` (que a bateria reaplica no bloco da SESSAO-47, depois de todas) a recria com as colunas de antes — mudar o formato quebraria a reaplicação. O cartão de "Já programadas" mostra o endereço novo e o botão "Editar endereço"; o selo e o original aparecem na janela (e na ficha, e nos cartões da aba Programar).

### Fumaça (PGlite em disco, duas rodadas de todas as migrations — `c-ferramentas/fumaca.mjs`)

Tudo aplicado duas vezes sem erro (a 040000, que recria a visão com o corpo antigo, reaplicada por cima e a do bloco C de novo depois). Conferido em `fumaca-1..3.sql`: a leitura da janela (fonte cadastro/entrega, os porquês do Tiny: "Preparando envio" → "O Tiny só deixa…", "Em aberto" → "ainda não está ligado"); "também no Tiny" recusado; salvar só na plataforma (fato com o original inteiro, projeção, ponto manual na chave nova, aviso de rotas); o mesmo toque = nada; 2ª mudança (o anterior = o da plataforma, o original segue o do Tiny); a ficha com o selo; o cadastro mudando no Tiny → substituído + 2 avisos (logística e admin); o Tiny reenviando igual = nada; a nossa escrita voltando (caixa e CEP diferentes) = confirmado, sem aviso; voltar depois de confirmado = recusado; o Tiny mudando de novo = substituído; restaurar (porta) e escrever o original = restaurado; validações (rua, UF, CEP, ponto fora do Brasil, meio ponto); operador recusado; fato solto recusado; conferência quebrada de propósito → o Tiny grava e o alerta de automação sai; parada: edição com antes/depois só do que mudou, toque repetido sem registro, `pode_editar` (logística, entregador na dele, feita = falso), feita não edita (nem a logística), entregador não edita a da logística; as portas das rotas lendo o endereço novo; entregue: logística recusada, admin aceito; permissões (anônimo fora; o miolo e a tabela fechados); as colunas da visão iguais.

### Bateria do banco (`supabase/testes/testar-migrations.mjs`)

- Bloco novo **"SESSAO-50 · bloco C"** logo antes de `const contar` (escopo próprio, `begin … rollback`; reaplica a base da 50 e a do bloco — duas vezes); a migration do bloco na cadeia do bloco 38, logo depois da base da 50. Programa: `c-ferramentas/inserir-bloco-c.mjs` (o bloco em `bloco-c.js.txt`; troca o bloco inteiro se já estiver lá).
- **45 conferências novas** (parada: edição com antes/depois, aviso de rotas, toque repetido, título/observação, entregador na dele e não na da logística, `pode_editar` nas duas leituras, feita não edita, desfeita volta; endereço: a janela, o operador fora, o Tiny recusado com o porquê, salvar só na plataforma — a regra, o fato com o original inteiro, a projeção, o ponto manual na chave nova, um registro só, o aviso —, o toque repetido, a ficha/Já programadas/entregas do dia/aba Programar com o novo e o selo (só no alterado — E-237), a 2ª mudança, voltar ao original (porta e escrevendo o do Tiny), 6 validações, fato solto recusado (pela API e direto na tabela), entregue só admin; Tiny: o porquê do "Em aberto", o original com o endereço de entrega cru, o reenvio igual, a confirmação sem aviso, voltar depois de confirmado recusado, o Tiny mudando por fora (fato, a marca sai, o sino para logística e admin com a frase da demanda), o cadastro mudando, a blindagem; a forma da visão e as permissões).
- **1ª rodada: 1.757 ✔ e 3 ✘** — 2 meus: o aviso de `rotas` sai uma vez por TRANSAÇÃO (`fn_avisar` marca `plt.avisado_rotas`) e o bloco inteiro é uma transação só; o teste passou a zerar a marca antes do gesto medido. **2ª rodada (12/11 ~03:00 de Natal): 1.759 ✔, 1 ✘ — o vermelho antigo do Dashboard ("as 7 portas novas = as antigas em 8 períodos"), que não é do bloco.** A bateria inteira leva ~2 min nesta máquina.
- **3ª rodada (12/11 ~03:25, com o `pode_editar` já nas duas leituras): 1.758 ✔, 2 ✘ — as 45 do bloco C verdes.** Os 2 vermelhos não são do bloco: o do Dashboard (o mesmo) e o de ponta a ponta do fluxo do n8n da SESSAO-33 ("o lote do banco → o código do fluxo monta a chamada…": `fimV2 = pendente`). Este só falha de madrugada: `fn_tiny_fila_lote` deixa a conta da fábrica inteira de fora entre **03:10 e 04:40 de Fortaleza** (`fn_tiny_fabrica_em_varredura`, a varredura da fábrica), e a rodada caiu dentro da janela; a 2ª rodada (03:00, fora da janela) o tinha verde — o total de conferências é o mesmo (1.760).

## Ensaio ×100 (PGlite em disco — `dados/SESSAO-50 - bloco C - ensaio x100 do endereco e da parada (script|resultado, 2026-11-12)`)

Banco: 562.700 pedidos, 95.169 cards, 15.467 programações, 600 paradas avulsas, **3.643 pedidos com o endereço mudado na plataforma**. ANTES = a visão de onde entregar, a `fn_parada_json` e as 8 portas que a leem, de antes, copiadas para o esquema `antes50c`; antes × depois alternados na mesma conexão (8 de cada; a 6ª chamada e a mediana da 2ª em diante). A migration aplica em 0,0 s e reaplica em 0,0 s.

| Porta (mediana da 2ª em diante, ms) | Antes | Depois | |
|---|---:|---:|---|
| Programar — sem filtro (200, o que a aba abre; 72 com o selo) | 1.587 | 1.625 | +2% |
| Programar — cidade "Natal" (200) | 1.669 | 1.672 | 0% |
| Já programadas — por entregar (1ª página, 50) | 61 | 59 | −3% |
| Já programadas — a busca (50) | 91 | 100 | +10% (a busca acha também o endereço da plataforma) |
| Entregas do dia — hoje (61 paradas, 20 avulsas) | 25,7 | 24,8 | −4% |
| ROTAS → Entregas, a entregar (20) | 2.117 | 1.819 | −14% (ruído) |
| ROTAS → Entregues (20) | 1.530 | 1.516 | −1% |
| Calendário — a semana que abre | 659 | 661 | 0% |
| Ficha do pedido — com endereço mudado (com o selo) | 7,3 | 7,8 | +0,5 ms |
| Ficha do pedido — sem endereço mudado | 1,1 | 1,3 | +0,2 ms |
| Decisão da devolução (o detalhe) | 3,9 | 4,4 | +0,5 ms |
| Paradas avulsas do período (5 dias, 600 paradas) | 35,8 | 38,0 | +6% |

- **A 1ª rodada achou um custo meu: as paradas do período 36 → 56 ms (+58%).** A regra de quem pode editar morava na `fn_parada_json`, que roda POR PARADA e chamava a conferência de permissão (`fn_pode_ver_expedicao`) a cada uma. Saiu de lá: cada leitura soma `pode_editar` com o que ela já sabe uma vez (o período só a logística lê; as entregas do dia já calculam "sou da logística?" e "quem sou"). **2ª rodada: 36 → 38 ms (+6% — só a soma do campo); as entregas do dia 26 → 25.**
- **A porta nova e os gestos (depois):** a janela "Editar endereço" ao abrir **2,0 ms**; salvar só na plataforma **7,0 ms** (máx 24 na 1ª); o mesmo endereço de novo (nada muda) **1,1 ms**; salvar com o pino **3,9 ms**; voltar ao original **2,5 ms**; editar a parada avulsa **1,4 ms**. **Tiny:** o pedido regravado sem mudar o endereço **10,4 ms** (o gatilho nem acorda — `when` no próprio gatilho); o endereço mudou no Tiny (vale o do Tiny + aviso) **8,1 ms**.
- **Planos:** a regra de onde entregar para os 9.418 pedidos vivos sem programação **351 → 374 ms** (+6,5%): uma busca pela chave primária de `plt_pedido_enderecos` por pedido (+21.932 leituras de página em memória), sem varredura; **um pedido (a ficha, a janela): 0,07 ms**, três buscas por índice.
- **Fora do orçamento com 100 vezes o volume, mas iguais antes e depois** (no PGlite): Programar ~1,6 s (dívida 30), o calendário ~660 ms (dívida 29), as listas da ROTAS ~1,5–2 s e a busca de "Já programadas" ~100 ms (o custo da regra do pedido vivo — dívida 24 —, já medido na SESSAO-47). **Nenhuma dívida nova do bloco**; o que o bloco soma é a junção pela chave do endereço da plataforma (+0,5 ms na ficha; +9 ms na busca de "Já programadas", que já estava acima do teto pela dívida 24).

## Telas

**Novos:** `src/rotas/enderecoDoPedido.ts` (as 3 portas e as contas puras: limpar o que se digitou, comparar endereços como o banco compara, o endereço numa linha, o texto da busca, o rótulo da fonte), `src/rotas/JanelaEnderecoPedido.tsx` (a janela), `src/rotas/SeloEnderecoAlterado.tsx` (o selo), `src/rotas/editarParada.ts` (o gesto de editar a parada salva).

**Alterados:** `ModalParadaAvulsa.tsx` (o mesmo formulário de criar, preenchido: "Editar parada avulsa", o mapa já aberto com o pino arrastável, "Salvar as mudanças" só quando algo mudou) · `ParadaAvulsaDoDia.tsx` ("Editar" na pendente, para quem pode — o banco diz) · `paradasAvulsas.ts` (`podeEditarParada`, `dadosDaParada`, `podeEditar` no marcador) · `AbaJaProgramadas.tsx` ("Editar" e "Tirar da rota" na linha da parada; "Editar endereço" no cartão; os dois nos balões do mapa) · `AbaProgramar.tsx` (a parada do rascunho com "Editar"/"Tirar" embaixo do texto; "Editar endereço" nos cartões das duas listas e no balão) · `CartaoPedido.tsx` (o selo com o original e "Editar endereço" ao lado de "Acertar o ponto no mapa"; o botão dentro do `<label>` da caixa de marcar não marca a caixa) · `MapaProgramacao.tsx` ("Editar" no balão da avulsa, "Editar endereço" no do pedido) · `FichaDoPedido.tsx` (os 4 fatos do endereço no histórico; o painel "Entrega e comprovante": "Para onde — endereço alterado na plataforma", o selo com o original, "Editar endereço", "Voltar ao endereço original") · `api.ts` e `auditoria/rotulos.ts` (**só acréscimos no FIM**: `pode_editar` na parada e `endereco_plataforma` no pedido da programação; os rótulos das ações das paradas e do endereço e as chaves do antes/depois na Auditoria).

**A janela "Editar endereço":** uma leitura no clique (sem cache: abre sempre com o de agora) e o código só baixa no clique (pedaço próprio, 12,98 kB / 4,01 kB comprimidos). Etapas: **editar** → texto mudado: **a pergunta** ("Trocar o endereço de entrega do pedido N?", De/Para com a fonte, o ponto, "Deseja salvar também no Tiny?…", "Salvar na plataforma e no Tiny" desligado com o porquê ligado por `aria-describedby`, "Salvar só na plataforma" — o foco já nele —, "Voltar") · só o pino mexeu: **"Salvar o ponto"** pelo `plt_fn_geo_marcar` de sempre, sem pergunta · **"Voltar ao endereço original"** → a mesma pergunta, ao contrário. "Para salvar, falta: …" diz o que falta (rua, cidade, UF, CEP com 8 números); quem não pode (operador, entregue sem ser o admin, pedido sem card) vê o porquê e "Fechar". Salvou → aviso curto, as telas das rotas releem (as chaves da programação, das programadas, das entregas do dia, das rotas e do calendário) e o aviso `rotas` do banco chega às outras telas abertas.

### Escolhas de tela onde a demanda não diz (provisórias — o supervisor numera)

- **P11 — a parada do RASCUNHO** (aba Programar, ainda não programada) se edita na própria tela, sem banco: o rascunho é local até "Programar"; só a parada salva passa pela porta.
- **P12 — no mapa**, "Editar" no balão da parada avulsa (só quem pode) e "Editar endereço" no balão do pedido; o gesto recolhe o mapa de tela cheia antes de abrir a janela (senão ela abriria por baixo da camada da tela cheia). O balão com botão tem largura máxima de 240 px e o mapa anda até ele sair de baixo dos controles do topo — no celular o balão padrão (300 px) passava da borda do mapa e o título ficava embaixo do "Expandir" (visto na vitrine).
- **P13 — na ficha**, "Editar endereço" e "Voltar ao endereço original" moram no painel "Entrega e comprovante"; o "Voltar" só aparece enquanto o Tiny não confirmou (P5); pedido entregue: só o admin vê os botões (a regra do banco).
- **P14 — em "Já programadas"** o selo aparece na janela, não no cartão (P10).

### Conferência visual (vitrine temporária, fora do ramo)

`scratchpad/s50/c-ferramentas/vitrine/` (`vitrine-c.tsx`, `vitrine-c.html`, `vite.vitrine-c.config.ts` — o cache do Vite no rascunho; o banco é de mentira: o `supabase.rpc` devolve os dados de exemplo pelo nome da porta). Endereços: `?ver=cartoes` · `?ver=parada` · `?ver=endereco` · `?ver=endereco&alterado=1` · `?ver=endereco&alterado=1&inicio=restaurar` · `?ver=ficha&alterado=1` · `?ver=mapa`. Medido em **375 × 812, 768 × 1024 e 1280 × 800**: nenhuma rolagem lateral (`scrollWidth = innerWidth` em todas as telas medidas); botões de toque 44 px (cartões, balões, ficha) e 56 px (rodapé das janelas); a janela "Editar endereço" vira folha de baixo no celular, 707 px no tablet e 768 px no computador; a pergunta, 512 px.

### Testes e montagem

- **41 testes novos** (a janela 9, as contas do endereço 9, o formulário da parada 5, a parada do dia 3, o cartão +5, a ficha +6, as paradas +4) — **vitest: 102 arquivos, 673 testes, todos verdes** (com as variáveis do Supabase de mentira — a cópia não tem `.env.local`).
- **tsc** sem erro (os dois tsconfig com `-p`, sem `-b` — ver Lições); **lint** 21 arquivos, 0 erro, 0 aviso (pela API do ESLint com a prova do `any`); **prettier** limpo nos arquivos novos e nos que já eram limpos (E-242).
- **Montagem: JS inicial 232,8 KB comprimidos em 8 arquivos (teto 250 KB) — o mesmo da base**; a Programação 96,23 kB / 27,68 kB comprimidos (+0,04 kB).

### Junção de ensaio com o ramo da sessão (12/11 ~04:00 — nada juntado de verdade)

A junção do ramo do bloco C com `sessao-50-observacao-pcp-endereco` (blocos A e B; `962de38`) feita só em memória (`git merge-tree`) e exportada para o rascunho (`scratchpad/s50/c-juntado`, com a mesma junção do `node_modules`):

- **1 conflito só — a cadeia do bloco 38 na bateria**: as três entradas da 50 juntas, na ordem dos arquivos (`020000` do B, `050000` do A, `060000` do C). O programa `c-ferramentas/resolver-juntada.mjs` faz exatamente isso. O resto (o bloco de testes do C, `src/auditoria/rotulos.ts` com os acréscimos dos dois lados) junta sozinho.
- **Nenhuma função recriada por dois blocos:** as 6 que a `060000` recria (a visão de onde entregar, `plt_fn_paradas_avulsas`, `plt_fn_entregas_do_dia`, `plt_fn_parada_avulsa_salvar`, `plt_fn_pcp_pedido_detalhe`, `plt_fn_programacao_candidatos`) não estão na `020000` nem na `050000`, e a `060000` não usa nada que elas recriam ou apagam (a `fn_fora_do_pcp` de 3 argumentos que o B apaga não aparece nela). A `plt_fn_rotas` do B lê a visão pelo nome — recebe o endereço da plataforma sem mudar nada.
- **Resultado na junção:** bateria **1.791 ✔, 2 ✘** (os mesmos dois de fora do bloco: o Dashboard e o fluxo do n8n na janela da madrugada) — as 45 do C, as do A e as do B verdes juntas; **vitest 108 arquivos, 702 testes verdes**; **tsc** (os dois tsconfig) sem erro; **JS inicial 232,6 KB**.

## Lei de desempenho — o checklist do bloco

- **Requisições:** abrir as telas tocadas não ganha leitura nova — o selo e o `pode_editar` vêm nas leituras que já existiam. A janela = **1 leitura no clique**; salvar = 1 escrita; editar a parada = 1 escrita.
- **Escondido só no clique:** a janela e o código dela.
- **Tempo real:** o aviso `rotas` (canal) sai de cada gesto; as telas abertas releem — sem relógio, sem `postgres_changes`.
- **Banco:** projeção pequena por pedido (só os alterados têm linha), junção pela chave primária; índice na chave estrangeira (`definido_por`); RLS ligada e nenhum acesso direto; os gatilhos do Tiny só acordam quando o endereço (ou o cliente) mudou e nunca derrubam a gravação do Tiny; ×100 medido (acima).
- **Escrita idempotente:** o toque repetido não grava (endereço igual → nada; parada igual → `repetido`, sem registro).
- **Pacote:** JS inicial igual; a janela em pedaço próprio.

## O caminho que falta para ligar "Salvar na plataforma e no Tiny" (para o handoff)

1. **O fluxo do n8n:** a API nova do Tiny (v3) não aceita endereço; a antiga (v2, `pedido.alterar`) só vale para pedido **Em aberto/Aprovado** e **substitui o pedido inteiro** — o fluxo tem de ler o pedido inteiro (`pedido.obter`) e devolver tudo idêntico (itens, valores, parcelas, frete, marcadores, observações, vendedor, forma de envio) menos o endereço de entrega. Mudar fluxo do n8n em produção é ajuste crítico (regra 3).
2. **A fila de saída:** `plt_tiny_pedido_fila` guarda **UMA linha por pedido e vale a última vontade** — um endereço pendente apagaria um "Entregue" pendente (e o contrário). Antes de ligar: uma linha por motivo (ou uma fila própria do endereço).
3. **No banco:** hoje `fn_endereco_mudar` recusa `p_tiny = true` com o porquê de `fn_endereco_tiny_motivo`; ligar = trocar a recusa pelo enfileirar, no mesmo gesto do fato (que já guarda `escolha = 'tiny'`), e a leitura da janela passar a devolver `tiny_salvar.pode = true` para Em aberto/Aprovado. **A volta já está pronta e testada:** o pedido chegando do Tiny com o endereço pedido grava `endereco_entrega_tiny_confirmado` (sem aviso; o selo vira "salvo também no Tiny"); chegando com outro, `endereco_entrega_tiny_substituido` + o sino.
4. **Na tela:** nada a mudar — o botão já lê o `pode` e o porquê da leitura da janela.
5. **O teste:** num pedido de teste Em aberto no Tiny, com o dono acordado — conferir que o pedido volta idêntico menos o endereço.

## Lições (o supervisor numera)

- Teste de "o banco avisou a tela" dentro de um bloco que é UMA transação: o aviso sai uma vez por transação (a marca `plt.avisado_<área>`) — zerar a marca antes do gesto medido, senão o 2º gesto do bloco "não avisa".

- Ensaio de banco que reaplica UMA migration antiga por cima de tudo (a 040000) deixa as outras funções que ela recria na versão antiga (as entregas do dia sem as paradas) e o check dos tipos sem os da 50 — o ensaio tem de reaplicar TUDO (duas rodadas, como a bateria). Custou uma rodada de fumaça confusa.
- Todo fato já vira registro de atividade sozinho (`fn_logar_evento`) — porta que grava fato não grava registro com a mesma ação (a Auditoria mostraria duas linhas).
- **Regra de permissão dentro de uma função que monta o JSON de UMA linha roda por linha** (a `fn_parada_json` chamando `fn_pode_ver_expedicao` a cada parada: +58% no período ×100). A porta calcula a permissão uma vez e soma o campo na própria leitura (`fn_x(linha) || jsonb_build_object(…)`) — e o ×100 antes × depois é o que mostra; a bateria não pega custo.
- **As cópias isoladas (o `node_modules` é a junção da pasta principal) dividem o arquivo de estado do `tsc -b`** (`node_modules/.tmp/tsconfig.*.tsbuildinfo` — às 03:42 ele tinha os arquivos do bloco A, gravado pela pasta principal; antes, o meu `tsc -b --force` da cópia o tinha gravado): numa cópia, `tsc -b` sem `--force` pode dizer "em dia" sem conferir nada, e a conferência de uma frente escreve na pasta principal. Nas cópias: `tsc -p tsconfig.app.json` e `tsc -p tsconfig.node.json` (sem `-b`: confere tudo e não grava estado nenhum); a montagem, `vite build` sozinho. Na pasta principal, depois de juntar: `tsc -b --force` uma vez antes de confiar no verde.
- **A bateria rodada de madrugada tem um vermelho que não é de ninguém:** o teste de ponta a ponta do fluxo do n8n (SESSAO-33) depende do lote da fábrica, que fica de fora entre 03:10 e 04:40 de Fortaleza (a varredura). Rodou nessa janela → `fimV2 = pendente`; fora dela, verde.
- **Balão do Leaflet com botão no celular:** o padrão (até 300 px de texto + margens) passa da borda de um mapa de 341 px e o mapa só anda o bastante para o balão caber na borda — fica embaixo dos controles do topo. `maxWidth` menor e `autoPanPaddingTopLeft` com a altura dos controles (visto na vitrine em 375 px).
- **Botão dentro de `<label>`** (o cartão da aba Programar fica dentro do rótulo da caixa de marcar): o clique no botão também marca a caixa — `preventDefault` + `stopPropagation` no botão; no teste, o nome do botão vem do `aria-label` dele.
