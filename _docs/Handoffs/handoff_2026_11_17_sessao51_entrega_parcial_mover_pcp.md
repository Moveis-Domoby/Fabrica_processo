---
titulo: Handoff — SESSAO-51 · a entrega parcial que mantém a produção (deixar ou limpar, com revogar) e "Mover para o PCP" (a peça volta como vaga do pedido ou vira reposição de estoque)
tipo: handoff
data: 2026-11-17
tags: [handoff, sessao-51, rotas, entrega-parcial, pcp, kanban, reposicao]
---

# 📋 Handoff — SESSAO-51 · Entrega parcial que mantém a produção e "Mover para o PCP" (16–17/11/2026, noite e madrugada)

Demanda: [[SESSAO-51 - Entrega Parcial Mantem a Producao e Mover Card para o PCP]] · Diário: [[SESSAO-51]] · Decisões: D-325…D-334 em [[PLT - Decisoes de Produto]] (↩️ D-195)

> ✅ **NO AR desde 17/11/2026 ~07:20 de Natal**, com o OK do dono na conversa, passo a passo: *"Pode conferir"* (a conferência só lendo — as 14 funções com o corpo esperado, as 16 novas ainda inexistentes, ninguém de fora chamando a entrega parcial de 5 argumentos; a única entrega parcial antiga, o 13869, sem acerto a fazer) e *"Já suba tudo para o site depois que finalizar aí"* → **as 3 atualizações do banco** (07:19; uma transação cada; a integração do Tiny idêntica em estrutura e linhas em cada uma; depois: as 16 portas/regras novas presentes, a entrega parcial só com 6 argumentos, os 6 checks validados, os 2 gatilhos ligados, as 5 sementes de "Volta ao PCP", as portas só para quem está logado) e **o site** (main `f69edaf`; a Vercel publicou; `versao.json` vivo = `08fd15b20888`, o mesmo da montagem local; os pedaços novos respondem 200). Advisors: nada novo além do esperado.

## 1. Objetivo (o pedido do dono, 16/11 22:41)

1. *"Quando um pedido for lançado para entrega parcial, os produtos que ainda estão em produção continuam em produção, a menos que o responsável queira remover os mesmos da linha… podendo revogar essa decisão."*
2. *"Se um card já está em produção e um admin quiser mover o mesmo para PCP novamente, ele deve conseguir, porém selecionando se o produto agora passa a virar reabastecimento de estoque, ou simplesmente volta para PCP por N motivos."*

## 2. O que foi feito

### Bloco A — a entrega parcial que mantém a produção (D-325…D-329)
- **A janela da entrega parcial em dois grupos:** "Saíram para a entrega" (as prontas, marcadas — desmarcada = voltou, vai para a decisão da logística como antes) e "Ainda na fábrica" (as peças em produção, com setor e etapa, desmarcadas — marcar = "foi entregue mesmo") + "N produtos ainda no PCP, sem liberar". Tudo numa leitura ao abrir.
- **"E o que ainda está na fábrica?"** — **"Deixar em produção"** (vem marcada): nada muda nas peças nem no PCP; o pedido segue vivo em toda tela ("Entregue em parte (N de M)"); a parada sai da rota do dia e o pedido volta a ser programado quando o resto ficar pronto; o "Entregue" do resto fecha tudo e vai ao Tiny. **"Limpar da produção"** (só logística, PCP e admin — o entregador vê só a primeira e o banco recusa o limpar dele): cada peça sai do quadro com registro (onde estava, o pedido, o k/n), o tempo aberto fecha, as vagas saem do PCP, o pedido fecha como antes, sino do PCP.
- **A aba "Entregas parciais" no PCP** (e o mesmo na ficha do pedido): só o pedido com decisão que ainda dá para revogar, do mais recente para trás, com busca; **um botão só, o contrário da decisão**: "Revogar e remover da linha de produção" (a peça pronta e a da rota ficam) ou "Revogar e voltar tudo para a produção" (a MESMA peça na MESMA etapa, sem ninguém trabalhando; etapa que sumiu → a primeira ativa do setor, com aviso; setor que sumiu → a vaga volta ao PCP). Ida e volta quantas vezes for preciso; o toque repetido faz um efeito só; a trilha mostra todas as idas e voltas. Sai da lista quando o resto é entregue, o pedido é cancelado/excluído/entregue no Tiny/ocultado ou não sobra nada — e o banco recusa com o porquê.
- **Achado da leitura do código (D-334):** pela regra antiga, um pedido entregue em parte que ainda tinha produto sem liberar **continuava em "Aguardando liberação" no PCP**. A contagem dos pedidos entregues em parte antes desta sessão sai no 1º passo da subida (só leitura, com o OK do dono) — nenhum acerto automático.

### Bloco B — "Mover para o PCP" (D-330…D-333)
- **O botão "Mover para o PCP"** na janela do card, ao lado de "Mover" — só o admin, fora do tablet, em peça viva de setor de produção (nunca em fim de linha, peça cancelada, card avulso, card de ajuste ou peça que espera a logística decidir). O card do quadro não tem menu "⋯" (a demanda supunha um).
- **A janela:** a peça, o pedido, setor · etapa, e o aviso "Fulano está trabalhando nela — o tempo dele fecha agora". Duas escolhas, cada uma com o porquê quando não dá:
  - **"Voltar para o PCP"** (motivo da lista nova "Volta ao PCP" — 5 sementes — e/ou observação): a peça sai do quadro (ao vivo também nas telas abertas), o tempo fecha, a vaga reabre no pedido com o selo **"1 voltou da produção: motivo — estava em SETOR · ETAPA"**.
  - **"Virar reposição de estoque"** (só móvel do catálogo, com o pedido no PCP): a peça perde o pedido, a vaga do pedido reabre (**"1 virou reposição de estoque"**) e nasce 1 reposição no Reabastecimento com a origem ("Veio da produção — era do pedido N…"); ela não vence em 2 dias úteis e não entra na conta da reposição automática enquanto não for liberada.
- **"Usar a mesma peça"** em "Liberar unidades" (do pedido ou da reposição): vem marcada, com a coluna onde a peça parou já escolhida; liberar devolve a MESMA peça (com a história e o k/n); desmarcada nasce uma peça nova e a antiga segue guardada.

### Fotos (vitrine — as telas de verdade com dados de exemplo; pedidos e clientes inventados)

| Foto | O que mostra |
|---|---|
| ![[imagens/sessao51-entrega-parcial-celular-1.jpg]] | A janela da entrega parcial no celular: "Saíram para a entrega" (marcadas) e "Ainda na fábrica" (desmarcadas, com setor e etapa) |
| ![[imagens/sessao51-entrega-parcial-celular-2.jpg]] | … mais abaixo: "Deixar em produção" (marcada) e "Limpar da produção", motivo e observação |
| ![[imagens/sessao51-entrega-parcial-limpar-celular.jpg]] | … com "Limpar da produção" escolhido |
| ![[imagens/sessao51-entrega-parcial-entregador-celular.jpg]] | … como o entregador vê: só "Deixar em produção" e a nota "Tirar da produção é com a logística" |
| ![[imagens/sessao51-entrega-parcial-tablet.jpg]] | A janela no tablet |
| ![[imagens/sessao51-parciais-celular.jpg]] | PCP → "Entregas parciais" no celular (um botão só, o contrário da decisão) |
| ![[imagens/sessao51-parciais-tablet.jpg]] | … no tablet |
| ![[imagens/sessao51-parciais-computador.jpg]] | … no computador |
| ![[imagens/sessao51-revogar-remover-celular.jpg]] | "Revogar e remover": o que sai (e "alguém trabalha nela") e a peça pronta que fica |
| ![[imagens/sessao51-revogar-voltar-celular.jpg]] | "Revogar e voltar tudo": para onde cada peça volta e o aviso da etapa que não existe mais |
| ![[imagens/sessao51-ficha-parcial-celular.jpg]] | A ficha do pedido com "Entregue em parte (1 de 3)", a decisão e o botão |
| ![[imagens/sessao51-ficha-parcial-computador.jpg]] | … no computador |
| ![[imagens/sessao51-janela-mover-celular.jpg]] | O botão "Mover para o PCP" na janela do card (celular) |
| ![[imagens/sessao51-janela-mover-computador.jpg]] | … no computador |
| ![[imagens/sessao51-mover-pcp-celular-1.jpg]] | A janela "Mover para o PCP": quem trabalha, as duas escolhas, o motivo |
| ![[imagens/sessao51-mover-pcp-celular-2.jpg]] | … mais abaixo: os motivos, a observação e o botão |
| ![[imagens/sessao51-mover-pcp-so-reposicao-celular.jpg]] | Pedido fora do PCP: "Voltar" apagado com o porquê; "Virar reposição" já marcada |
| ![[imagens/sessao51-mover-pcp-tablet.jpg]] | A janela no tablet |
| ![[imagens/sessao51-pcp-selo-celular-1.jpg]] | O PCP com o selo "1 voltou da produção: Prioridade mudou — estava em MONTAGEM · MONTANDO" |
| ![[imagens/sessao51-pcp-selo-celular-2.jpg]] | … "Entregue em parte (1 de 3)" e "1 virou reposição de estoque" |
| ![[imagens/sessao51-pcp-selo-computador.jpg]] | … no computador |
| ![[imagens/sessao51-reposicao-origem-celular.jpg]] | Reabastecimento: "Veio da produção — era do pedido 13744, estava em MONTAGEM · A MONTAR" |
| ![[imagens/sessao51-reposicao-origem-computador.jpg]] | … no computador |
| ![[imagens/sessao51-liberar-mesma-peca-celular.jpg]] | "Liberar unidades" com "Usar a mesma peça (estava em MONTAGEM · MONTANDO)" marcada e a coluna escolhida |
| ![[imagens/sessao51-liberar-mesma-peca-tablet.jpg]] | … no tablet |

## 3. Como testar (roteiro do dono — no site, depois de subir)

**Entrega parcial que mantém a produção**
1. Escolha um pedido com uma parte pronta (na rota ou em Pedidos em aguardo) e outra parte ainda na produção (ex.: na MONTAGEM).
2. Em Logística → Rotas → Entregas, abra o pedido e toque em **"Entrega parcial"**. Confira: em cima, "Saíram para a entrega" com as prontas marcadas; embaixo, "Ainda na fábrica" com as da produção desmarcadas, cada uma com o setor e a etapa.
3. Deixe **"Deixar em produção"** marcado, escolha um motivo e registre. Confira: as peças da MONTAGEM continuam no mesmo lugar, com a mesma pessoa e o mesmo tempo; o PCP mostra o pedido com "Entregue em parte"; a parada saiu da rota do dia.
4. Vá ao **PCP → "Entregas parciais"**: o pedido está lá com "Revogar e remover da linha de produção". Toque, confira a janela (o que sai, quem trabalha nela) e confirme: as peças saem dos quadros.
5. Na mesma aba, agora o botão é **"Revogar e voltar tudo para a produção"**. Toque e confirme: as MESMAS peças voltam para as MESMAS etapas, sem ninguém trabalhando (quem for trabalhar aperta "Iniciar").
6. Abra a ficha do pedido (Pedidos → o número): o quadro "Entregue em parte (N de M)" mostra a decisão e o mesmo botão; em "Histórico" estão as idas e voltas.
7. Pelo celular do entregador, numa outra entrega parcial: só aparece "Deixar em produção".

**Mover para o PCP**
1. Como admin, abra uma peça que está num setor de produção (ex.: MONTAGEM). Ao lado de "Mover" aparece **"Mover para o PCP"**.
2. Toque. Escolha **"Voltar para o PCP"**, marque um motivo e confirme. Confira: a peça sumiu do quadro (também no tablet do setor); no PCP o pedido mostra "1 voltou da produção: motivo — estava em …".
3. No PCP, abra **"Liberar unidades"** desse pedido: aparece **"Usar a mesma peça (estava em …)"** marcada, com a coluna já escolhida. Libere: a mesma peça volta para o quadro, com a história dela.
4. Em outra peça, escolha **"Virar reposição de estoque"**: a peça sai do pedido, o pedido mostra "1 virou reposição de estoque" e a aba **Reabastecimento** ganha 1 reposição com "Veio da produção — era do pedido …".
5. Como operador (ou PCP), abra uma peça: o botão "Mover para o PCP" não aparece.

## 4. Verificação (critérios de aceite)

**Bloco A** — bateria do banco, bloco "SESSAO-51 · bloco A" (46 ✔) + telas:
- ✅ Os dois grupos (prontas marcadas, na fábrica desmarcadas com setor e etapa) e a linha "+1 no PCP" (banco + teste da tela + fotos).
- ✅ "Deixar em produção": as peças seguem iguais (setor, etapa, quem trabalha, tempo); a vaga segue no PCP; "Entregue em parte (2 de 5)"; a peça da MONTAGEM pronta vai a Pedidos em aguardo e o pedido volta a ser programável; o "Entregue" do resto fecha e vai para a fila do Tiny.
- ✅ "Limpar da produção": as peças saem arquivadas com registro (fora de quadro e de conta), a vaga sai do PCP, o pedido não aparece em "Pedidos ocultos", o sino avisa; a busca acha o pedido e as peças dizem "Saiu da produção na entrega parcial".
- ✅ Peça pronta desmarcada continua indo para a decisão pós devolução — os testes antigos da entrega parcial (outubro) seguem passando.
- ✅ O entregador não vê "Limpar" e o banco recusa se ele tentar.
- ✅ A aba "Entregas parciais": só o botão contrário; "voltar tudo" devolve as mesmas peças às mesmas etapas e reabre a vaga; "remover" guarda a etapa de AGORA; 3 idas e voltas na trilha; o toque repetido faz um efeito só.
- ✅ Etapa arquivada: a janela avisa e a peça volta para a primeira etapa ativa.
- ✅ O resto entregue tira da lista e o revogar é recusado com a explicação.

**Bloco B** — bloco "SESSAO-51 · bloco B" (35 ✔) + telas:
- ✅ O admin vê "Mover para o PCP" (na janela do card — não há menu "⋯"); o operador e o PCP não veem (o banco recusa); peça pronta, cancelada, avulsa e de ajuste: o botão não aparece e o banco recusa.
- ✅ "Voltar para o PCP": a peça sai do quadro (o quadro aberto recebe o aviso ao vivo), o tempo fecha, a vaga reabre com o selo e o motivo.
- ✅ "Virar reposição": perde o pedido, a vaga reabre, 1 reposição com a origem, não vence em 2 dias úteis, fora da conta automática.
- ✅ "Liberar unidades": "Usar a mesma peça" marcada com a etapa onde parou; liberar devolve a mesma peça com a história; desmarcar cria uma peça nova (a antiga segue guardada).
- ✅ Peça sem pedido só "Voltar"; pedido fora do PCP só "Virar reposição", com a explicação; móvel personalizado só "Voltar".

**Geral**
- ✅ Celular (375) e tablet (768) sem rolagem lateral nas 12 cenas; botões de toque; janelas da casa.
- ✅ Bateria do banco A+B: **1.872 ✔** + os 2 ✘ conhecidos (o painel do Dashboard e o teste do fluxo do n8n que só falha entre 03:10 e 04:40). `tsc -b --force` 0 · lint 0 · vitest do projeto 112 arquivos / 717 testes ✔ · montagem ok. ✅ **Advisors** (17/11 ~07:21, depois de aplicar): nada novo além do esperado — as portas novas no aviso de sempre (`SECURITY DEFINER` executável por quem está logado) e os 5 índices novos "ainda sem uso" (acabaram de nascer); nenhuma chave estrangeira nova sem índice.
- ✅ Lei de desempenho — seção 5.

## 5. Desempenho (Lei — checklist)

- **1 requisição por tela/janela, no clique:** a janela da entrega parcial (antes 2 leituras, agora 1), a aba "Entregas parciais" (pedaço próprio, só com a aba aberta), a prévia do revogar e a do "Mover para o PCP"; a ficha, o card do PCP e "Liberar unidades" ganham o dado novo **na resposta que já tinham**.
- **Listas por cursor:** "Entregas parciais" por (data da decisão, id), índice parcial próprio, 20 por página (teto 100).
- **Ao vivo sem relógio:** o aviso do PCP de sempre (Broadcast); nenhum `refetchInterval`, `setInterval` ou `postgres_changes` novo.
- **Ensaio ×100** ([[SESSAO-51 - ensaio x100 da entrega parcial e do mover para o PCP (resultado, 2026-11-17).txt|resultado]]; 562.700 pedidos): portas novas 10,6–26,3 ms (mediana); "Entregas parciais" 14,3 ms com o plano (854 blocos); gestos: revogar 53 ms, mover 24 ms; as portas de antes sem piora (quadro do PCP: A/B no mesmo banco 74–83 ms as duas versões).
- **Pacote:** JS inicial 238,3 KiB (no ar: 238,2; teto 250); os pedaços novos só no clique (1,7–2,4 KB cada).
- **Dívidas:** nenhuma nova de desempenho (o quadro do PCP segue na dívida 16, sem piora).

## 6. Pendências que precisam do dono

1. ✅ **Subir** — feito em 17/11 ~07:20 com o OK dele (o topo deste handoff).
2. ✅ **As entregas parciais de antes desta sessão** (D-334 — lido na conferência de 17/11, com o OK do dono): **só uma, o 13869** (12/11, 14 peças entregues). As outras 23 a logística já tinha devolvido à produção como ajuste com destino "volta ao pedido" (5 na MONTAGEM, 18 na SECC), e o card segue no PCP com 11 unidades sem liberar — **o estado que a regra nova faz sozinha. Nada a acertar.**
3. ✅ **ClickUp** (17/11 ~07:35, com o OK do dono): [Rotas - Entrega parcial mantém a produção (deixar ou limpar) e aba Entregas parciais com revogar](https://app.clickup.com/t/17tya50w4bw) e [Produção - Mover card de volta ao PCP (vaga do pedido ou reposição de estoque)](https://app.clickup.com/t/17tya50w4bx) — em "fazendo", atribuídas ao dono, com o comentário de entrega; **quem conclui é o dono**.
4. **Confirmar as provisórias** (D-326…D-334, ⏳): quem limpa; a posição da peça que volta (fim da etapa); etapa/setor sumidos; a aba no PCP sem prazo; "remover" não tira a pronta nem a da rota; o botão só para admin e onde ele fica; as 5 sementes de motivo; a reposição que veio da produção (separada, sem vencimento, fora das contas); "Usar a mesma peça" marcada; onde aparece "Entregue em parte" (a Programação, a Expedição e as Entregas do dia ainda não mostram); as entregas parciais antigas sem acerto.
5. **Conferir na tela** (seção 3) — o banco e o site estão no ar; os advisors já foram vistos.

## 7. Programa de subida (pronto e testado — A-211)

`_docs/Plataforma/Execucao/dados/SESSAO-51 - subida (programa, 2026-11-17).mjs` (+ os dois ajudantes ao lado):
- `node "…subida (programa, 2026-11-17).mjs" conferir` — **só leitura**: confere o corpo vivo das **14 funções** que a 51 recria (md5, como o Postgres calcula) e que as **16 novas** ainda não existem; que ninguém de fora chama a entrega parcial de 5 argumentos; e o retrato das entregas parciais de antes desta sessão. **Provado no banco de ensaio:** antes de aplicar, 14/14 iguais e 0 das 16 novas; depois, acusa as 14 e as 16.
- `… banco` — conferir + as 3 atualizações, na ordem, pelo aplicador da casa (`--so`, uma transação cada, a integração do Tiny conferida em cada uma).
- `… site` — manda o ramo para a main do GitHub (a Vercel publica); para se a main tiver andado.

## 8. Notas do cofre atualizadas

[[PLT - Decisoes de Produto]] (D-325…D-334, ↩️ D-195) · [[PLT - Memoria de Aprendizado]] (E-287…E-290, A-236…A-242) · [[PLT - Lei de Desempenho e Escala]] (andamento SESSAO-51) · [[SUPA - Esquema do Banco]] (as 3 atualizações) · [[PLT - Modelo de Sistema]] (as telas novas) · [[000 - ORDEM DAS SESSOES]] · [[000 - MAPA DO PROJETO]] · a demanda (Resultado) · [[SESSAO-51]] (diário).
