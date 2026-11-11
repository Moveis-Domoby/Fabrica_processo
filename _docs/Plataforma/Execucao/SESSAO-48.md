---
titulo: Diário de execução — SESSAO-48 (cancelar a fabricação de verdade e a plataforma que recarrega sozinha)
tipo: execucao
data: 2026-11-11
tags: [execucao, sessao-48, producao, cancelamento, pcp, estoque, publicacao, recargas]
---

# Diário — SESSAO-48 (11/11/2026)

Demanda: [[SESSAO-48 - Cancelar Fabricacao de Verdade - Peca de Pedido Pergunta o Destino]] · handoff de entrada: [[handoff_2026_11_11_cowork_sessao48_cancelamento_e_recargas]]
Ramo `sessao-48-cancelar-fabricacao-recargas`, na pasta principal (sem worktree), nascido da `main` `34aa418` (a main local estava 4 commits atrás — só cofre do Cowork; avançada por `fetch origin main:main`).

## Partida (11/11)

- Prompt do dono: atualizar a main, seguir o CLAUDE.md, executar a SESSAO-48 começando pelo handoff do Cowork; **não perguntar negócio** (o que faltar vira provisória registrada); ramo próprio (toda subida para a main publica o site); **migration, o acerto das peças paradas, a mudança na Vercel e a publicação só com o OK dele**; no fim, em português de gente e sem códigos: o que foi feito, como testar com fotos e as pendências.
- Nenhuma outra sessão rodando na pasta (lista de sessões: a 47 parada desde 10/11 00:37). Fica fora dos commits: `_docs/.obsidian/graph.json`, `workspace.json` (estado do Obsidian) e `supabase/.temp/`.
- Leitura feita: CLAUDE.md, memória de aprendizado (fim dos E/A + M/F + buscas por tema), decisões (D-61, D-62, D-75, D-129, D-132, D-201 e as da 47), visão geral, lei de desempenho (§1–§13), modelo de sistema (componentes, kanban, PCP, aviso de versão), esquema (as tabelas `plt_`), ordem das sessões, handoff da 47, o diário da 47 (as lições que valem), perguntas em aberto (nada sobre o tema).
- **Tarefas no ClickUp:** a demanda diz "a criar com o OK do dono" (o Cowork não criou) — não criadas; pedir o OK no fim (regra 19).

## Numeração (conferida na pasta, no ramo da 46 e no remoto)

- Decisões **D-290…** · erros **E-250…** · acertos **A-212…** · dívida da lei **36…**
- Migrations depois de `20261109050000` → `20261111010000…`

## Task list (espelha a demanda)

**Frente 1 — mover para CANCELADO / NÃO ENCONTRADO tira da produção**
1. ✅ Sinal novo na etapa (`cancela_fabricacao` + motivo), ligado no CANCELADO e no NÃO ENCONTRADO da LIMPEZA E EMBALAGEM; o admin liga/desliga em Setores e etapas, no lugar de "conclui a produção".
2. ✅ O fato de chegada numa etapa dessas (qualquer caminho: arrasto, tablet, Mover, liberação do PCP) gera `fabricacao_cancelada` (autor, de onde veio, motivo, pedido/reposição) + projeção `cancelada_em`; peça de pedido vivo perde o pedido (`unidade_desvinculada`) e a vaga volta; idempotente.
3. ✅ A regra única do que conta: peça cancelada sem categoria (Estoque/Top 20), fora dos contadores, do PCP, da Expedição e dos painéis; log, Auditoria, histórico; aviso ao vivo (setor e estoque).
4. ✅ Na coluna: "Cancelada em dd/mm · some em N dias" (ou "Não encontrada em…") no lugar do tempo de fila; ninguém inicia nem trabalha peça cancelada (banco recusa, tela não oferece).
5. ✅ Arrastar de volta em 7 dias desfaz (`fabricacao_retomada`): volta a contar; com a vaga ainda aberta volta ao pedido e o aviso some; senão volta sem dono (provisória); reposição só perde a peça (provisória).

**Frente 2 — a vaga volta ao PCP com aviso, e o PCP decide**
6. ✅ O pedido ganha o selo "Peça cancelada na produção" / "Peça não encontrada" (texto + cor) e o sino avisa logística e admin.
7. ✅ A janela "O que aconteceu?" (uma leitura ao abrir): as peças canceladas (móvel, k/n, coluna, quem, quando) e o que o pedido ainda tem em produção ou pronto; "Produzir de novo" fecha o aviso; "Remover do PCP" com motivo (pedido cancelado — "Cancele também no Tiny"; tirar da linha de produção — "O que houve?" obrigatório; outro motivo — texto obrigatório).
8. ✅ "Remover do PCP" no banco: fato `pedido_removido_pcp`, projeção no card, o pedido sai de todas as portas do PCP (regra única), log e Auditoria; aba "Cancelados e removidos" com o motivo e quem; "Devolver ao PCP" (`pedido_devolvido_pcp`); remover não mexe no Tiny nem nas peças em produção/prontas (a janela avisa quantas).

**Frente 3 — pedido cancelado no Tiny pergunta o destino**
9. ✅ Cancelamento do Tiny com peça em produção (não concluída): marca "esperando decisão" (fato + projeção), sai do "produção de pedido", etiqueta "Pedido cancelado — esperando decisão da logística", sino para logística e admin. A peça pronta segue indo sozinha ao ESTOQUE.
10. ✅ A janela "Para onde vai este móvel?" (uma leitura ao abrir; peça por peça ou todas): seguir para o estoque · passar para outro pedido (régua da D-62, maquinaria da D-201; desabilitada com o porquê) · cancelar a fabricação (o gesto da frente 1).
11. ✅ Sem decisão e chegou ao fim da linha → ESTOQUE sem dono e a pendência fecha com fato; pedido "descancelado" antes da decisão → a marca sai e a peça volta ao pedido.

**Frente 4 — a limpeza dos 7 dias e a recuperação**
12. ✅ As duas colunas só mostram os últimos 7 dias (filtro na leitura, com índice) — mesmo antes da limpeza.
13. ✅ No 8º dia: `card_arquivado` com o motivo, sem relógio novo (na rotina diária que já existe); nada apagado.
14. ✅ Recuperar: a peça arquivada na busca geral e na Auditoria com o motivo; o admin recupera (`fabricacao_retomada` + desarquivar) e ela volta para a fila da LIMPEZA E EMBALAGEM; os 7 dias numa configuração.

**Frente 5 — a plataforma que recarrega sozinha**
15. ✅ (a) Documentação não publica o site (`ignoreCommand` no `vercel.json`) — escrito e provado num clone raso; ⏳ **entra na Vercel com a publicação, só com o OK do dono** (e a prova com um commit só de cofre).
16. ✅ (b) A versão é o código (hash do arquivo de entrada no `versao.json`), não o commit.
17. ✅ (c) Recarregar só em momento seguro no tablet e na TV (sem janela, sem PIN, 1 min sem toque); escritório na troca de tela; pedaço sumido no tablet: "Atualizando a plataforma…" e uma recarga; ver a proteção contra versões misturadas da Vercel (perguntar se for paga).
18. ✅ (d) A abertura grava o porquê (navigate/reload/back_forward, aba descartada, motivo da própria plataforma) e a Auditoria mostra em português.
19. ✅ (e) A troca de setor por PIN recarrega uma vez só (reproduzir o laço de 10/11 11:23).
20. ✅ (f) Regra da casa: subir para a main é publicar (memória + CLAUDE.md).

**Acerto (só com o OK do dono)**
21. ✅ Manutenção `supabase/manutencao/2026-11-11_cancelado_vira_gesto.sql` ensaiada com contagens antes/depois; aplicada só com o OK; recontar o estoque; conferir a Estante Basic 7 nichos e os móveis afetados. ⏳ **Rodar no banco só com o OK do dono** (o ensaio que não grava primeiro).

**Geral**
22. ✅ Celular 375 e tablet 768 sem rolagem lateral; bateria 2×, tsc, lint, vitest, build, ⏳ advisors só depois de aplicar (o banco de produção não foi lido nesta sessão); ensaio ×100 das portas novas/tocadas; cada tela em 1 requisição, sem relógio novo.
23. ✅ Cofre: decisões provisórias, memória, esquema, lei, modelo de sistema, handoff com fotos, ordem, mapa, resultado na demanda.

## Lições da memória que valem nesta sessão

- Regra 20 (nenhum `cd`); `git branch --show-current` antes de todo commit (E-113); commit por caminho explícito; `git diff --numstat` antes (E-242).
- Função recriada = extração da última versão + md5 do corpo vivo (E-24/A-96/A-97); mudou assinatura → `grep` da velha na bateria inteira (E-120/E-236) e nas migrations que a recriam (E-178); check de tipos: o `validate` mora na mais nova (E-19).
- Bateria sempre para arquivo; dela só contagem e vermelhos (E-235). Bloco novo em `{ }` com faixa própria de ids. `vitest run --root "$R" --dir src` (A-194).
- Chave nova em jsonb que outro teste compara só nasce quando tem o que dizer (E-237). Função por linha em porta de quadro não compõe outras funções da casa (E-238); caso novo em `OU` de visão cita colunas de UMA tabela (E-239). Ensaio ×100 antes da tela, medindo a 6ª chamada (A-209).
- Script com crase/`$` vai em arquivo pela ferramenta de escrita (E-249/E-247); `cat >` só com heredoc (E-180).
- Leitura do banco de produção pode ser barrada pelo ambiente — não contornar (A-202).

## Diário

- ~01:40 · leitura do cofre e da demanda (2×); main local avançada (4 commits do Cowork); ramo novo na pasta principal.
- ~02:00 · **desenho**: o cancelamento nasce do FATO de chegada (gatilho), para valer por qualquer caminho; a peça de pedido perde o pedido por `unidade_desvinculada` (a vaga volta pela regra de sempre — `fn_vagas_pedido`); o aviso é projeção no card do pedido; a remoção do PCP entra na regra única `fn_fora_do_pcp` (3º argumento); a peça cancelada e a que espera decisão saem da regra única do que conta (`fn_estoque_categoria` com 8 argumentos). Ferramentas no scratchpad: `extrair.mjs` (a última definição de um nome, nome exato), `quem-chama.mjs` (quem chama, pela versão vigente de cada função), `base/gerar.mjs` (partes à mão + funções extraídas com trocas de contagem exata — todas casaram de primeira).
- ~02:10 · **migration base** `20261111010000_plt_sessao48_base.sql` gerada; o `validate` do check dos tipos saiu da `20261109010000` (E-19). Bateria: 3 rodadas com erro meu antes de ficar verde — E-250 (filtro na CTE errada), E-251 (coluna nova em visão que as migrations antigas recriam), E-252 (5º leitor da regra do estoque esquecido), E-253 (check com `in` deixa passar nulo). Commit `1999e2d` (base + o comum das telas: tipos, rótulos da Auditoria e do histórico, os caminhos dos dois avisos novos do sino, "Removido do PCP").
- ~02:15 · **frentes paralelas** em cópias temporárias no scratchpad (`s48-f2` PCP, `s48-f3` destino, `s48-f5` recargas; ramos `sessao-48-f2-pcp`, `…-f3-destino`, `…-f5-recargas`, nascidos de `1999e2d`; `node_modules` por junção), com o brief comum `scratchpad/s48/brief-comum.md`. A frente 5 foi barrada uma vez pelo ambiente por eu ter autorizado leitura do banco de produção no brief — relançada só com o código (as consultas que confirmam ficam para o OK do dono — A-202).
- ~02:30 · **telas das frentes 1 e 4** (eu): cartão ("Cancelada em dd/mm · some em N dias", "Era do pedido N", a etiqueta do pedido cancelado esperando decisão), coluna ("tira da produção · some em N dias"), Setores e etapas (as duas escolhas novas + o prazo em dias), janela do card (o aviso e "Recuperar a peça" para o admin), busca geral (onde a peça cancelada está / quando saiu da coluna). Testes de tela: 558 verdes. O arquivo do acerto `supabase/manutencao/2026-11-11_cancelado_vira_gesto.sql` (ensaio que não grava / aplicar com a marca), provado na bateria. Commit `cf8df98`.
- ~02:40 · **ensaio ×100** (562.700 pedidos; 5.300 peças paradas nas colunas): achou dois defeitos reais e um de desempenho — E-254 (peça antiga sem pai e fora do catálogo ficaria sem nada ao perder o pedido), E-256 (cancelar de novo a mesma vaga esbarrava na trava "uma peça por vaga" das peças sem pedido), E-255 (a janela dos 7 dias lia a data card a card: 210 → 272 ms no quadro da LIMPEZA). Corrigidos (commits `ea7091e`, `58e7c64`); casos novos na bateria. Bateria final da base: **1.665 verdes, 1 vermelho antigo** (o painel de vendas, que já falhava na main).
- **Desempenho (×100, `dados/SESSAO-48 - ensaio x100 do cancelamento da fabricacao`)** — antes × depois da base, rodada com a máquina livre: PCP 84,8 → 84,7 ms · aba Stand-by 8,7 → 8,6 · porta antiga 205 → 206 · quadrinho 71,5 → 72,0 · quadro da LIMPEZA 214 → 212 (depois da correção) · "Ver mais" 58,6 → 59,0 · busca 37 → 39 · lista de pedidos 65 → 65 · janela de liberar 44 → 45. O gesto de cancelar: mediana 52 ms; retomar: 14 ms; o acerto: 5.300 peças em 25–31 s numa transação (no real são 53 → ~0,3 s); a limpeza: 2.650 peças em 87 s (33 ms por peça — cada arquivamento passa pelos gatilhos de sempre; no real, poucas por noite); rodar de novo: 2 ms. Depois do acerto o PCP do ensaio fica mais lento (84 → 140 ms) porque as peças semeadas eram de pedidos SEM itens (o "liberado por inteiro" deles vira nulo e o quadro filtra mais linhas) — estado que o acerto real não cria. As portas que já passavam do teto no ×100 (porta antiga do PCP, quadro da LIMPEZA) já passavam antes desta sessão.
- ~03:00–03:40 · **as frentes entregaram**, cada uma no seu ramo e com o seu diário: [[SESSAO-48 - frente 5]] (a versão pelo código, o pulo da documentação, a recarga em momento seguro, o porquê da abertura, o laço da troca de setor), [[SESSAO-48 - frente 3]] (o destino do móvel do pedido cancelado no Tiny; ensaio ×100 368 → 33 ms, pior caso 75), [[SESSAO-48 - frente 2]] (o selo, "O que aconteceu?", remover/devolver, a aba "Cancelados e removidos"; ensaio ×100 186 ms → 4 ms). **Junção na ordem:** frente 5 (limpa), frente 3 (conflito só na bateria: a cadeia do bloco 38 e os blocos — resolvido por programa com os marcadores presos ao começo da linha, E-262), frente 2 (conflito só na cadeia). Antes: conferido por programa que nenhuma função é recriada por duas migrations (`sobreposicao.mjs` — A-217). Commits `2565cef`, `4a6f1e4`, `303fb36`.
- ~04:00 · **o app fechou** no meio da bateria e da montagem; ao reabrir, o rascunho da sessão mudou de pasta (E-264). Os programas pequenos (subida, acerto, resolvedores) foram copiados para o rascunho novo (`…\5c91cc81118c8f02\…\scratchpad\s48\`); a cópia antiga (com os bancos dos ensaios) ficou em `…\e0216271dda9b13d\…\scratchpad\s48\`. Testes rodados de novo.
- **Tudo junto:** vitest **97 arquivos / 628 testes** verdes; `tsc -b` limpo; lint dos **53** arquivos tocados limpo (rodado com o shell na pasta principal — E-258 não se aplica); montagem **JS inicial 233,2 KB** (teto 250).
- **Achados da frente 2 corrigidos na junção (E-261/D-300):** a lista de Pedidos mostrava "Em produção" para o pedido removido com peça liberada e contava como liberada a peça cancelada que guarda o card do pedido como pai; a busca geral mostrava o removido como "PCP · aguardando liberação". Correção na base (rótulo `removido_pcp` antes de `aguardo`/`producao`, `cancelada_em is null` nas liberadas, a chave `removido_pcp_em` na busca) + a pílula e o atalho em `src/busca/ondeEsta.ts` + 2 conferências novas na bateria (verdes) + 1 teste de tela. Commit `4a38767`.
- **Fotos** (vitrine — `vitrine-s48/`, fora dos commits): cenas novas do PCP (selo, "O que aconteceu?", o 2º passo "Remover do PCP" com toques automáticos — A-218, "Cancelados e removidos") e do destino ("Para onde vai este móvel?", com "Passar para outro pedido" escolhido). As fotos de celular pelo Edge sem janela saíram cortadas (E-265) — refeitas pelo navegador do app (375×812 e 768×1024, sem rolagem lateral: `scrollWidth` = largura).
- **Cofre:** decisões D-299…D-305 (as provisórias das frentes + a correção da lista), memória E-257…E-267 e A-212…A-220, lei (o andamento da sessão + dívidas 36 e 37), modelo de sistema (a aba do PCP, o selo, as duas janelas, a recarga), esquema (as 3 migrations das frentes + a correção), a regra da casa no CLAUDE.md (subir para a main é publicar — A-220), handoff, ordem das sessões, mapa e o "Resultado" da demanda.
- **Programa de subida** (`subir/subir-s48.mjs`, no rascunho): agora acha sozinho as 19 funções novas (da saída do `vigentes-antes`), confere quem chama as QUATRO regras que mudam de assinatura e, no passo `site`, busca a main do GitHub e só envia se ela for ancestral do ramo.
- ~04:41 · **bateria final**, fora da janela da madrugada: **1.714 verdes, 1 vermelho antigo** (o painel de vendas — já falha na `main`); o do lote do Tiny passou (era só o relógio — E-266). As 3 cópias temporárias das frentes removidas (o atalho do `node_modules` solto antes, para não apagar o da pasta principal — conferido: 248 itens antes e depois) e os 3 ramos das frentes apagados (já juntados no ramo da sessão).
- **11/11 ~05:10 · a subida, com o OK do dono ("Sim, sobe tudo"):** a main do GitHub tinha andado (a demanda da SESSAO-49, só cofre, do Cowork) — juntada no ramo (conflito só na linha da ordem das sessões; as duas ficaram). Conferência só lendo o banco: 28 funções + 1 visão iguais, 19 novas inexistentes, 0 problemas, 53 peças nas colunas, 127 em produção. **Banco ~05:12:** as 4 atualizações pelo aplicador (`--so`), integração idêntica em todas. **Acerto ~05:13:** ensaio e aplicar com os mesmos números (53 canceladas; produção 127 → 74; 34 perderam o pedido; só o 13622 com aviso; 6 avisos no sino; a Estante Basic 7 nichos sem as 2 reservadas p/ produção; nenhuma linha do estoque precisou de reconta). **Site:** a 1ª publicação (`ec0aea1`, 05:14) caiu na validação do `vercel.json` — o `ignoreCommand` com 363 caracteres; o esquema da Vercel aceita 256 (E-268; confirmado lendo `https://openapi.vercel.sh/vercel.json`); o comando foi para `scripts/vercel-pular-documentacao.sh` (provado num clone raso: só cofre → 0; código, cofre + código, a pasta do banco, sem publicação anterior e commit fora do clone → 1; um .md fora do cofre → 0) e a 2ª publicação (`5606afd`, 05:18) entrou — `versao.json` = `6243378971b2`.
- **Conferido no ar** (só olhando, com o acesso do dono): PCP (o 13622 com o selo de 30 peças; a aba nova), "O que aconteceu?", as colunas (CANCELADO 49, NÃO ENCONTRADO 4, "some em 7 dias", "Era do pedido N"), o Estoque (a Estante em 1 / mínimo 2, com o sinal de "precisa de produção"), a Auditoria ("Abriu a plataforma — abriu pelo endereço ou por um atalho"). Banco só lendo depois (`subir/conferir-depois.mjs`): tudo no lugar. Advisors: nada novo além do esperado. O retrato da integração (`supabase-fabrica-schema.sql`) ganhou a seção 15 (os gatilhos da plataforma na situação do pedido).
- **05:22 · a prova do "só cofre não publica":** o commit do cofre `5b330e9` foi para a main e a Vercel marcou "Canceled by Ignored Build Step"; o `versao.json` no ar seguiu `6243378971b2`. Critério da frente 5 (a) fechado.
- **~05:30 · as recargas de 10/11 lidas no banco** (só leitura, com o OK do dono — "Sim, pode ler"): FITAMENTO 11:23 = um tablet com 4 trocas de setor por PIN em 64 s (2 aberturas por troca) + 3 abas de fundo nunca tocadas que recarregaram na 1ª troca; CNC 13:58/14:38 = o Android recarregando a aba descartada ao acordar a tela (os 40 min foram coincidência); Entregas = 17 páginas carregadas do zero no dia, coladas no Maps/Waze/WhatsApp/câmera. Detalhe no [[SESSAO-48 - frente 5]] ("As recargas de 10/11 — o que os registros mostraram"); receita em A-221. Sugestão ao dono: fechar as abas extras dos tablets e fazer a plataforma abrir como aplicativo (uma janela só).
