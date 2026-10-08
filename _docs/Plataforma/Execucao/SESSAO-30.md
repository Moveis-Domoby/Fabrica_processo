---
titulo: Execução — SESSAO-30 · Produção de ponta a ponta (pedido, reabastecimento e entrega)
tipo: execucao
data: 2026-10-07
atualizado: 2026-10-08
tags: [execucao, sessao-30, bloco-6, producao, estoque, rotas, entrega, tiny, desempenho]
---

# 🔧 Execução — SESSAO-30 · Produção de ponta a ponta

**Pasta:** a principal (`Domoby - fabrica`), sem worktree (pedido do dono). Nenhuma outra sessão ativa na máquina (conferido no início). **Branch:** `sessao-30-producao-ponta-a-ponta`, criada em 07/10 da `main` = `origin/main` (**16e03e5** — contém tudo até a migration 55, a atualização do banco de 03/10).
**Demanda:** [[SESSAO-30 - Producao de Ponta a Ponta - Pedido Reabastecimento e Entrega]] (lida 2×) · [[PLT - Lei de Desempenho e Escala]] (inteira) · plano [[004 - PLANO - Bloco 6 - Producao de Ponta a Ponta e Kanban Completo]].
**Numeração reservada (conferida em todas as cópias — só existe a pasta principal):** migration **56** em diante · **D-113** em diante · **E-86** em diante · **A-57** em diante · **RF-135** em diante · **Q-73** em diante.

## 1º commit — só documentação (07/10)

O que o Cowork gravou em 06–07/10 e não estava no git: demandas 30/31/32, plano 004, a Lei de Desempenho e Escala, o prompt do Bloco 6, as regras 18 e 19 (no cofre e no `CLAUDE.md`), ordem das sessões, próximos passos, mapa e a nota da Q-72 em Perguntas em Aberto. Commit **5176123**.

- **Achado (E-86):** o `000 - PROXIMOS PASSOS` do Cowork partiu de uma cópia de **01/10** (commit 031a735 — a versão com o menor diff, 15 linhas = só o que ele acrescentou) e **desfazia** o registro de 02–03/10: SESSÕES 27, 28 e 29 entregues, P17 resolvido. Mesclado em 3 vias (`git merge-file` cowork × base 031a735 × HEAD): 2 conflitos, resolvidos ficando com o bloco novo do Bloco 6 + a data nova + o cabeçalho "Onde estamos (02/10/2026)" do HEAD; o "▶️ Agora (01/10)" antigo virou "(anterior)". Conferido: o resolvido difere do HEAD só pelo acrescentado.
- Fora do commit: o estado da janela do Obsidian (`.obsidian/graph.json` e `workspace.json` — zoom do grafo e notas abertas).

## Leituras (07–08/10)

CLAUDE (repo + cofre), regras do repo (18 e 19), Memória de Aprendizado (inteira), Decisões (inteiras — até D-112), Visão Geral, Perguntas em Aberto (Q-69, Q-70, Q-72), Ordem das Sessões (diff do Cowork), Esquema do Banco (integração + plataforma até a migration 55), plano 004, prompt do Bloco 6, SESSAO-31 (a parte dos anexos — a base nasce aqui) e SESSAO-32 (o escopo, para não invadir), [[N8N - ROTAS Entregue para Tiny]], handoff da S28 (o último entregue). Código: `src/paginas/Rotas.tsx`, `src/kanban/api.ts` (`liberarUnidades` — o laço no navegador), a busca de relógios (`refetchInterval`/`postgres_changes`) em `src/`, migrations 39 (lançar/entregar/ROTAS/aguardo), 45 (`fn_estoque_por_produto`, `fn_vendas_90d`, `fn_reservados_producao`), 49 (gatilhos de `pedidos`), 25 (`fn_reagir_pedido` — a versão viva), papéis de `plt_usuarios`, `plt_caminhoes`.

## Tarefas do ClickUp (regra 19)

Acesso ao ClickUp **funciona** nesta sessão. As 6 tarefas da demanda estão em **A FAZER** (status da lista: a fazer · analisar viabilidade · fazendo · concluído). Cada uma vai para **FAZENDO** quando o trabalho dela começar (depois do OK do dono) — nunca para concluído. Observação: a tarefa "Rotas - Visualização dos entregadores" (uma das 4 antigas) está **sem responsável**; as outras 5 estão com o dono.

## Retrato de partida (08/10 ~03:00 UTC — só leitura; refeito sobre o de 06/10 da demanda)

| O quê | Demanda (06/10) | Hoje (08/10) |
|---|---|---|
| Pedidos "Entregue" no Tiny, lançados para ROTAS e sem entrega aqui | 3 (13146, 13156, 13176 — 6 peças) | **21**: os 3 + **18 da carga de teste da S28** (03/10, "Carga de teste das rotas pedida pelo dono", lançados pela integração **sem peças**; 11 deles programados em caminhão). Só os 3 têm peças (6, todas na ROTAS) |
| Pedidos com entrega registrada aqui e peça ainda ativa na ROTAS | 13108, 13114 (1 cada) | igual |
| "Entregue" no Tiny com peça **em produção** | — | **13272** (MONTAGEM "MONTANDO" + FURAÇÃO "A FURAR") |
| "Entregue" no Tiny com peça **no aguardo** | — | **13272, 13480, 13538** (1 cada; o 13538 é da carga de teste) |
| Cancelado no Tiny com peça na ROTAS | — | nenhum |

- **n8n (só leitura, pela API, chave nunca impressa):** o fluxo antigo **"Domoby · ClickUp ROTAS → Tiny (entregue)"** está **ATIVO** e rodou várias vezes em 07/10 (a última às 20:59 UTC) — **a equipe ainda marca a entrega no ClickUp**. E o fluxo principal de vendas **ainda cria** o card de ROTAS no ClickUp (e os do PCP no ClickUp/Trello). Consequência: desligar o fluxo antigo antes de a logística passar a entregar pela plataforma faria a entrega parar de chegar ao Tiny.
- **Storage:** só o bucket `plt-imagens`, público. **Realtime:** a publicação tem só `plt_cards`. **Relógios do banco:** `plt-estoque-reservas` e `plt-webhooks-despachar` a cada minuto (dívida 6 da lei — é da S32), fotos a cada 5 min, os demais de calendário.
- **Papéis:** `operador`/`lider`/`admin` — não existe "entregador"; `plt_caminhoes` não tem motorista. "Logística" no banco = admin ou quem é do PCP/fins de linha (`fn_pode_ver_expedicao`/`fn_eh_logistica`).
- **Entregar hoje:** `plt_fn_registrar_entrega` exige o pedido lançado e TODAS as peças na ROTAS; grava `pedido_entregue` no card do pedido e não toca nas peças (por isso ficam ativas na ROTAS para sempre). `fn_reagir_pedido` (gatilho de `pedidos`, à prova de falha) trata cancelamento e "pedido atualizado"; não trata "Entregue".
- **Reservados em venda hoje:** `fn_estoque_por_produto` (CTE `reservados`) conta peça de pedido em fim de linha **menos a ROTAS** + a peça do estoque reservada pela venda.
- **Liberação do PCP hoje:** `liberarUnidades` no navegador = 3 chamadas por peça (cria o card, `card_criado`, `movimentacao_setor`), sem transação, para qualquer setor (inclusive os fins de linha — raio-x 3).
- **Relógios nas telas tocadas:** Estoque (`PainelTop20` ×2, `PainelInsumos`), Pedidos em aguardo (×3), PCP (×3), ROTAS → Entregas (30 s), Já programadas e Programar (Programação).

## Task list (espelho da demanda)

- [ ] T0 · Ritual: leituras, retrato, perguntas e decisões técnicas ao dono — **esperando o OK**
- [ ] T1 · §3.1 Reservado em venda até a entrega — regra num lugar só (aguardo + ROTAS/programada/caminhão + peça do estoque reservada pela venda, até "Entregue"), em todo número que mostra "reservados" (cartão, filtros, Visão do dia, Pedidos em aguardo); D-NN nova revisando a D-86
- [ ] T2 · §3.6 Números do estoque como **projeção por produto** (tabela-resumo mantida no mesmo gesto dos fatos de peça/pedido/entrega + a venda dos 90 dias) e as portas lendo só ela — ≤ 50 ms p95 com volume ×100, `EXPLAIN (ANALYZE, BUFFERS)` aqui; resumo × lista × configurações × reposição batendo (harness amarra)
- [ ] T3 · §3.2 "Entregue" daqui → Tiny pela fila (sem relógio; tempo limite, nova tentativa com espera crescente e sorteio, disjuntor; a falha nunca derruba o gesto) + fluxo no n8n (com o OK do dono)
- [ ] T4 · §3.2 Tiny "Entregue" → a plataforma registra sozinha ("Sistema", origem Tiny), uma vez só, sem eco; caso de peça em produção/aguardo conforme a pergunta 1
- [ ] T5 · §3.2 As peças entregues saem de toda conta (estoque, reservas, ROTAS ativa, Visão do dia) e ficam no histórico — por evento
- [ ] T6 · §3.2 Manutenção dos que já estão errados (prévia ao dono antes de rodar): os 21 pedidos entregues no Tiny e abertos aqui (inclui os 18 da carga de teste, que o handoff da S28 já mandava arquivar) + as peças paradas de 13108/13114
- [ ] T7 · §3.3 Base de anexos genérica (anexo de card; quem, quando, tipo, tamanho; remoção por evento; armário privado; link assinado curto; redução no aparelho) — pensada para a S31
- [ ] T8 · §3.3 Tela do entregador (celular): entregas do dia do caminhão na ordem salva, cliente, endereço + mapa, WhatsApp, móveis com quantidade (sem frete), observação, "Concluir entrega" em dois toques (otimista e idempotente), comprovante por foto/imagem/PDF; 1 requisição na abertura
- [ ] T9 · Comprovante visível para a logística em ROTAS → Entregas e em Já programadas
- [ ] T10 · §3.4 Raio-x 1 a 6 (cada um conferido no código e no banco ANTES de corrigir; o que não existir mais vira registro): 1 ESTOQUE só 🟢 e sem dono para toda origem · 2 baixa só pela porta da movimentação · 3 liberação do PCP sem ir direto a ESTOQUE/AGUARDO, numa transação só · 4 origem "entrada manual" certa (rótulo + tipo do front) · 5 a regra de "peça livre" numa função só (resumo = soma da lista) · 6 personalizado livre com saída pela tela (SKU + descrição)
- [ ] T11 · §3.6 Sem relógios nas telas tocadas → websocket (Broadcast privado, tópicos estreitos, payload mínimo, leitura de recuperação ao reconectar); cada tela tocada abre com 1 requisição
- [ ] T12 · §3.6 Listas tocadas por cursor (Entregas, Pedidos em aguardo, Produtos reservados) com teto de página no banco; índices de FK/filtro/ordenação/RLS; advisors de desempenho sem item novo
- [ ] T13 · §3.5 Ensaio de ponta a ponta (pedido, volta do Tiny, reabastecimento, regressão de cancelamento e reposição vencida) no banco real em transação desfeita + bloco permanente no harness, com a tabela de números esperados × obtidos
- [ ] T14 · Prova com **1 pedido real** de que o Tiny fica "Entregue" (com o OK do dono, na hora)
- [ ] T15 · Decisões novas (revisões da D-33/D-45 e da D-86 + as respostas do dono), Q-72 marcada com o que foi corrigido, Requisitos, Modelo de Sistema, Esquema do Banco, `supabase-fabrica-schema.sql` se tocar a integração
- [ ] T16 · Checklist final: `test:banco` 2 rodadas · `tsc -b` · lint · `npm test` · build · 375 px e 768 px · checkpoint antes de aplicar (impressão digital da integração) · `get_advisors` (segurança e desempenho) · checklist de desempenho da lei (§12) com o pacote antes/depois · `pg_stat_statements` · aba Network · busca por relógios · task list × demanda
- [ ] T17 · ClickUp: cada tarefa em FAZENDO ao começar; ao terminar, aviso ao dono + comentário na tarefa (nunca concluir)
- [ ] T18 · Handoff + mapa + próximos passos + ordem das sessões + resultado da demanda

## Decisões técnicas propostas ao dono (08/10 — esperando o OK)

1. **Números do estoque prontos no banco:** tabela nova e estreita por produto (separada de `produtos`, que o n8n escreve e que mudaria a toda hora), mantida no mesmo gesto de cada fato de peça (criar, mover, concluir, arquivar, reservar, alocar, entregar) e de venda (a contribuição de cada pedido ao "vendidos em 90 dias", gravada no fechamento da gravação do pedido — gatilho adiado e à prova de falha, como o das automações), com reconciliação completa de madrugada (o calendário dos 90 dias anda e a conferência corrige qualquer deriva). As portas da tela leem só a tabela; a posição no ranking sai de uma ordenação sobre ela. Exceção consciente à D-47 (como foi a fila do estoque do Tiny).
2. **"Entregue" daqui → Tiny:** fila própria por pedido (versão, tentativas, próxima tentativa, último erro, parado) alimentada por gatilho no fato `pedido_entregue`; o banco chama o n8n NA HORA (pg_net, só depois do commit); nova tentativa com espera crescente + sorteio por um relógio que só existe enquanto há linha esperando e se desagenda sozinho (o padrão da fila de leitura do Tiny); disjuntor depois de N falhas seguidas; o n8n chama o Tiny com tempo limite e devolve o resultado por porta só da chave de serviço. No n8n: fluxo novo montado a partir das duas chamadas ao Tiny do fluxo antigo (mesma chave), com a entrada trocada; o antigo fica ligado até a decisão da pergunta 8.
3. **Tiny "Entregue" → aqui:** a reação de `pedidos` que já trata o cancelamento ganha o caso "virou Entregue" (recriada a partir da versão viva — E-24/E-25, `fn_situacao_normalizada`); registra a entrega com autor nulo (Sistema), origem da integração e `dados.origem = 'tiny'`; se a entrega já existe, nada; a fila do item 2 ignora o que veio do Tiny (sem eco). Vale para o aviso de venda e para a conferência das 3h.
4. **Peças entregues:** na entrega, cada peça do pedido recebe um evento de saída com o motivo "entregue" ligado à entrega (como a baixa "venda" da D-78) — o filtro universal de "não arquivado" tira a peça de toda conta sem mexer em cada porta; o histórico guarda tudo.
5. **Anexos:** bucket novo **privado** (imagem e PDF nesta sessão; o áudio é da S31), tabela de anexos ligada ao card (quem, quando, tipo, tamanho, caminho, miniatura), remoção por evento, envio direto ao storage por link de envio assinado, leitura por link assinado de poucos minutos, política do storage por card (logística/admin), foto reduzida e miniatura feitas no aparelho.
6. **Tela do entregador:** filha de ROTAS, celular primeiro; uma porta que devolve as entregas do dia do caminhão na ordem salva, com móveis, endereço e comprovantes; "Concluir entrega" com chave por gesto (o toque repetido e a rede que volta = uma entrega só) e atualização otimista.
7. **PCP:** liberação inteira numa porta só, numa transação (tudo ou nada), recusando destino ESTOQUE/AGUARDO (só a sugestão do estoque leva peça pronta ao aguardo).
8. **Ao vivo:** Broadcast privado com tópicos estreitos (estoque, aguardo, rotas, setor do PCP), política em `realtime.messages` para a logística/membros do setor, gatilho que avisa com o mínimo; a tela relê só o pedaço afetado; reconexão = uma leitura de recuperação.
9. **Ordem de trabalho (entregas parciais testáveis):** (a) estoque (resumo pronto + reservado até a entrega + raio-x) → (b) PCP numa chamada → (c) entregue nos dois lados + manutenção → (d) anexos + tela do entregador → (e) ao vivo e listas por cursor nas telas tocadas → (f) ensaio de ponta a ponta + prova com 1 pedido real.

## Perguntas levadas ao dono (08/10)

As 8 da demanda (§5), com o retrato de hoje e uma recomendação em cada — resposta registrada aqui quando vier.
