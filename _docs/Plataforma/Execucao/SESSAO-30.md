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

As 8 da demanda (§5), com o retrato de hoje e uma recomendação em cada.

## Respostas do dono (08/10) — palavras dele, resumidas só onde não muda o sentido

1. *"Se está entregue no Tiny, aqui deve estar como entregue também; para ser entregue no Tiny é porque a peça do pedido não existe mais no galpão e não deve mais estar nada referente a ele em aberto aqui."* → Tiny "Entregue" fecha TUDO do pedido aqui, onde a peça estiver (produção, aguardo, ROTAS, PCP). ↩️ minha recomendação era avisar.
2. *"Se o pedido for cancelado ou devolvido e o móvel já estiver montado, não tem essa de logística confirmar, o produto automaticamente já deve ir para o estoque."*
3. Entregador: login próprio; *"iremos cadastrar ele apenas como ROTAS, então rotas deve ser uma permissão na criação de usuário"*; a única coisa que ele vê é a tela das entregas do dia; quem programa a rota **define quais usuários recebem a rota (mais de um por vez)**; **mini mapa**; pedidos na ordem de entrega (do mais perto ao mais longe); botões por pedido: **Comentário · Entregue · Não entregue · Pedido devolvido · WhatsApp · endereço no mapa · lista de produtos**; o card mostra cliente, nº do pedido, **quantidade de VOLUMES** (≠ produtos — no Tiny há produto com mais de um volume, montado na entrega), endereço e **observações** — inclusive um **detalhe da entrega** cadastrado ao programar o caminhão ou em "Já programadas" (ex.: "cliente só pode receber depois das 10h"). O card atual de ROTAS → Entregas (print do 13176) já tem os dados: *"coloque apenas o botão e ajuste a visualização para tablet e celular"*. **Entregue** abre um menu em cima para anexar **comprovante de pagamento** (PDF, Word, imagem e outros formatos de comprovante) + **observação opcional**; comprovante **opcional**; e **um botão de anexar fora da entrega também**.
4. Comprovante **não é obrigatório**.
5. **Não entregue** com **motivo escolhido numa lista**; os motivos se cadastram em **Configurações, junto de etiquetas e campos customizados**; já semear vários curtos ("Cliente estava ausente", "Endereço errado", "Caminhão quebrou", "Entrega reagendada"…). O pedido volta para "Programar".
6. **Quem desfaz é o entregador**, e desfaz **no Tiny também** (*"a comunicação deve ser imediata entre os dois"*); **só as entregas do dia**; o desfazer também pede **motivo da lista** (ex.: o cliente ligou para devolver e foram buscar).
7. Pode arquivar a 502. E: *"revise todos os pedidos que estão em PCP também … pedido entregue no Tiny não deve mais aparecer como aberto para o PCP"*; **no PCP, um seletor simples de status do pedido — "Entregue, Em rota, Concluído" — só para o super admin**; e **seleção em massa para arquivar** (*"eu preciso dela zerada"*).
8. *"Não vamos desligar por enquanto, coloque um fluxo bifurcado"*: entregue no Tiny → avisa a plataforma; entregue no ClickUp → avisa o Tiny, que avisa a plataforma; entregue na plataforma → avisa o Tiny; o ClickUp só avisa, nunca recebe.

## Respostas da 2ª rodada (08/10) — o OK para codar

*"1a, 2 sim marcador Devolvido, 3 não mexe, 4 cria"* → (1) "Pedido devolvido" pelo entregador não mexe no Tiny; (2) devolução no Tiny = o marcador "Devolvido", reage como o cancelamento; (3) o seletor de situação do PCP não mexe no Tiny; (4) criar a tarefa no ClickUp. Escolhas do Claude aceitas em silêncio: quem programa escolhe a equipe do caminhão (logística e admin); o botão de anexar fora da entrega; comprovante foto/imagem/PDF/Word até 10 MB.

**Decisões registradas:** D-113 (entregue dos dois lados; Tiny entregue fecha tudo; fluxo bifurcado; desfazer pelo entregador) · D-114 (cancelado/devolvido pronto → estoque sozinho, inclusive da ROTAS; marcador "Devolvido") · D-115 (entregador) · D-116 (motivos) · D-117 (PCP do super admin) · D-118 (reservados em venda até a entrega, ↩️ D-86). ↩️ marcas na D-33, D-45, D-86.

**ClickUp (08/10):** criada a tarefa **"Produção - Situação do pedido e arquivar em massa no PCP"** (id 17tya50fm4p, lista PRODUÇÃO, responsável o dono) → **FAZENDO**; **"Rotas - Entregue nos dois lados (plataforma e Tiny)"** → **FAZENDO** (a etapa 1 começa por ela: entregue no Tiny fecha tudo + limpeza).

**Ordem combinada:** (1) zerar a plataforma — regra "entregue no Tiny fecha tudo", limpeza com prévia, seletor de situação e arquivar em massa no PCP, 502 → (2) estoque (números prontos, reservado até a entrega, raio-x) → (3) PCP numa chamada → (4) entregue nos dois lados (n8n bifurcado, desfazer, não entregue, devolvido, motivos) → (5) entregador (tipo de usuário, equipe do caminhão, detalhe da entrega, tela, comprovante) → (6) ao vivo, listas, ensaio completo e o pedido real.

## Etapa 1 — zerar a plataforma (08/10)

**Banco — migration 56 `20261008120000_plt_entregue_fecha_tudo.sql`** (só funções; nenhuma tabela, nenhuma coluna; reaplicável):
- `fn_validar_api` recriada por inteiro (a partir da 51): `pedido_entregue` sem pessoa só passa com a flag `plt.entrega_maquinaria` (M-14).
- `plt_privado.fn_fechar_tempo_aberto(card, obs)` — movimentação para a fila do setor, origem `api` (a receita da manutenção de 27/09).
- `plt_privado.fn_fechar_pedido(card, usuario, origem, obs, fonte)` — **a regra única de "entregue"** (M-04): entrega uma vez; cada peça viva → tempo fechado + `card_arquivado` motivo `entregue` (com `entrega_evento_id`); peça do estoque reservada pela venda → `card_arquivado` motivo `venda` (não vai ao Tiny — regra do `fn_tiny_estoque_marcar`); card do pedido que nunca foi às ROTAS → `card_arquivado` (sai do PCP); o lançado fica (registro em ROTAS → Entregas / Já programadas). Card arquivado sem nada vivo → nada.
- `fn_reagir_pedido` recriada por inteiro a partir da **migration 25** (a versão viva — E-24): virou "Entregue" (normalizado — E-25) → `fn_fechar_pedido(card, null, 'api', 'Entregue no Tiny.', 'tiny')`.
- Super admin: `fn_concluir_pedido` (viva → aguardo por `movimentacao_setor` origem `api` com o super admin como autor; faltante → nasce no aguardo, usando a peça reservada pela venda quando há — `peca_alocada` reservada, sem Tiny), `fn_arquivar_pedido` (peças e card; reserva desfeita motivo `pedido_arquivado` — não vai ao Tiny), porta **`plt_fn_pcp_ajustar_pedidos(ids[], acao, obs)`** (≤ 300, subtransação por pedido, um resultado por pedido, 1 linha `pcp_pedidos_ajustados` na trilha com o ajuste e os NÚMEROS dos pedidos).
- **`plt_fn_pcp_todos_pedidos(busca, antes_numero, limite)`** — cursor pelo número (índice único de `pedidos.numero`), página cortada antes das laterais, `situacao_plataforma`, `tem_mais`, total com teto de 10.000 só na 1ª página; gate da logística.
- Harness: bloco 56 (21 verificações) + 2 testes antigos atualizados para a regra nova (S23: "a unidade segue viva" → ↩️ D-113 nenhuma fica viva; D-75: o caso "encerrado com peça por liberar" passou a ser montado com "Não entregue", o 924300). **770 ✔, 2 rodadas, integração intacta.**

**Tela:** PCP — botão "Selecionar pedidos" (só super admin), caixinha de 44 px nos cards de "aguardando liberação" e nas linhas de "Todos os pedidos" (só pedido com card), "Marcar os N da tela", barra fixa com "Mudar a situação para" (Concluído · Em rota · Entregue) + Aplicar + Arquivar + Desmarcar, confirmação com o que acontece e "por quê (opcional)", modal com o que ficou como estava. "Todos os pedidos": `useInfiniteQuery` por cursor, busca adiada 300 ms e só com 2+ letras, rótulo "Na plataforma: …". Auditoria: "Ajustou pedidos no PCP (super admin)" + rótulos do contexto. `tsc` ✔ · lint ✔ · `npm test` 146 ✔ · build ✔ (JS principal 1.852,72 kB / 505,71 kB gzip — a divisão por tela é da S32).

**Limpeza — `supabase/manutencao/2026-10-08_fechar_pedidos_entregues_no_tiny.sql`** (prévia no topo; fecha com `fn_fechar_pedido` fonte `tiny`; arquiva a 502).

**Ensaio A-11 no banco real (08/10 ~04:15 UTC, migration 56 + limpeza numa transação → ROLLBACK, script no scratchpad):** 287 pedidos fechados · 285 entregas novas (2 já tinham) · 277 arquivamentos motivo `entregue` (13 peças + 264 cards do PCP) · 1 tempo aberto fechado (13272, MONTAGEM) · 502 arquivada · **0 avisos no sino · fila do estoque do Tiny intocada** · sobra 0 peça viva e 0 card no PCP de pedido entregue. Porta nova "Todos os pedidos": **11 ms no banco** (EXPLAIN ANALYZE; ~100 ms com a ida e volta daqui), busca "silva" ~130 ms com a ida e volta, 2ª página ~107 ms (a antiga: 3,2 s). 1ª chamada fria 2 s (compilação + leitura de disco na transação de ensaio).
- **Dívida registrada (busca por nome com volume ×100):** a busca por nome varre `clientes` com `ilike` — rápida hoje (~5.500 pedidos); com ×100 pediria índice de trigramas em `clientes` (tabela da integração — só com o OK do dono). A página sem busca e por número continua no índice.

### Etapa 1 no ar (08/10, com o OK do dono — *"pode"*)

- **Migration 56 aplicada** ~04:18 UTC, sozinha (`--so`): integração **idêntica** (digital `e2109f3a…`, 65 colunas, linhas idênticas: clientes 10.763 · pedidos 5.511 · pedido_itens 8.250 · eventos 14.010 · gp 1).
- **Limpeza rodada** 04:19:42 UTC, numa transação: **287 pedidos fechados** · 285 entregas novas · 277 arquivamentos motivo `entregue` (13 peças + 264 cards do PCP) · 1 tempo fechado (13272) · **502 arquivada** · 0 avisos no sino · 0 entrega em dobro · sobra 0. Igual ao ensaio. ⚠️ **E-87** (coluna `criada_em` escrita como `criado_em` na conferência) e **E-88** (o script foi rodado 2× — a 2ª não gravou nada, idempotente; a contagem dela enganou: "23"); filtro da manutenção ajustado.
- **Conferência da tela com o dono logado (preview 5173):** "Todos os pedidos" — digitar "1360" letra a letra = **1 consulta** (`plt_fn_pcp_todos_pedidos`, ~260 ms com a ida e volta); seleção com caixinha de 44 px; "Entregue" aplicado no 13612 (já fechado) → a porta respondeu numa chamada e a tela mostrou "Este pedido está arquivado — traga de volta antes." (1 linha `pcp_pedidos_ajustados` na trilha). Corrigidos na hora: plural ("1 pedido ficaram") e a descrição "os outros foram ajustados" com 0 ajustados; **barra compacta no celular** (148 px, acima do balão do chat, sem sobreposição); 375 e 768 sem nada passando da borda.
- ⚠️ **Achado para a etapa 6 (PCP dentro da lei):** depois do ajuste, a invalidação de `['cards']` releu o quadro e a reposição mesmo com a aba "Todos os pedidos" aberta — as consultas do quadro rodam em qualquer aba (fere o "dado escondido só no clique"); + uma leitura direta de `plt_cards` (etiquetas). Corrige-se na etapa 6.
- **Publicado:** `main` avançada para **c040a3a** (avanço direto, autor `contatodomoby`); branch também enviada ao GitHub.

## Ordem do dono à noite (08/10 ~01:40 Natal) — trabalho autônomo

*"Você não irá realizar a sessão 31, mas sim outra sessão de Claude Code; por enquanto, rode um /compact e guarde na sua memória toda a execução atual, já deixe o handoff pré-feito para não perder o contexto e siga para todas as outras etapas da sessão 30 sem me perguntar mais, vou dormir, fique trabalhando."*

→ Vale como OK, nesta conversa, para **aplicar banco e publicar o site ao fim de cada etapa testada** (precedente: D-26). Fica para o dono de manhã: **a prova com 1 pedido real indo ao Tiny** (muda pedido de verdade) e desligar qualquer coisa do ClickUp. O /compact é comando do dono (não roda daqui); a memória foi salva no cofre, na memória do Claude (`sessao-30-em-andamento`) e no handoff em rascunho ([[handoff_2026_10_08_sessao30_producao_ponta_a_ponta]]).

## Retrato complementar (08/10, só leitura, depois das respostas)

- **Volumes:** o cadastro do Tiny da fábrica tem `produtos.raw->>'qtd_volumes'` (o pedido não traz volume). Acabados ativos: 166 com 1, **12 com 2**, 84 vazios/0 (contar como 1).
- **PCP:** 287 cards de pedido vivos no PCP com o pedido **"Entregue" no Tiny** (275 com peça por liberar, 8 com peça viva — escondidos do quadro desde a S23, mas abertos), 9 cancelados, 1 enviado, 43 "preparando envio".

## Etapa 2 — estoque (08/10, madrugada, trabalho autônomo)

**Banco — migration 57 `20261008130000_plt_estoque_numeros_prontos.sql`** (gerada no scratchpad por `gerar_m57.py` a partir de `m57_template.sql` + os corpos VIVOS das migrations 42/45/56 recortados e emendados — E-24):
- **Tabela nova `public.plt_estoque_numeros`** (uma linha por produto do catálogo): `livres`, `reservadas_estoque`, `prontas_pedido`, `producao_sem_dono`, `producao_de_pedido`, `vendidos_90d`, `cortes_90d`, `posicao`, `vendas_em`, `saldo_tiny`, `reservado_tiny`, `lido_em`, `origem_leitura`, `evento_leitura_id`, `atualizado_em`. RLS ligada, sem política, revogada de todos — só as portas leem (D-119).
- **A regra única da peça (raio-x 5 / M-04):** `fn_estoque_produto_da_peca` (personalizado → nenhum; sem pedido → o produto da peça; com pedido → `fn_produto_do_item`) e `fn_estoque_categoria` (livre · reservada_estoque · **pronta_pedido = peça de pedido em QUALQUER fim de linha — aguardo e ROTAS até a entrega (D-118)** · producao_sem_dono · producao_de_pedido). `fn_estoque_contar(produto)` = a contagem ao vivo pelas mesmas regras.
- **Mantida no mesmo gesto:** gatilhos de instrução em `plt_cards` (insert/update/delete, tabelas de transição) somam e subtraem por diferença; só os produtos tocados. **De madrugada:** `fn_recalcular_minimos` (cron `plt-estoque-minimos`, 07:40 UTC) passou a rodar antes `fn_estoque_vendas_atualizar` (vendas de 90 dias, posição, cortes) e `fn_estoque_numeros_recontar` (recontagem completa com trava; devolve quantas linhas corrigiu). As portas de Configurações (Top X, cobertura, corte) já chamavam `fn_recalcular_minimos` → o ranking anda também quando a configuração muda (D-119).
- **Leitura do Tiny:** `fn_leitura_tiny` (a regra de leitura do aviso, uma só), `fn_leituras_tiny` refeita sobre ela, `fn_estoque_numeros_leitura(evento)` e `fn_estoque_leituras_recarregar()`; `plt_fn_tiny_estoque_aviso` e `plt_fn_tiny_estoque_leitura` recriadas POR INTEIRO da 42 com `returning id` + a linha da projeção.
- **Portas recriadas na mesma forma (drop + create + grants):** `plt_fn_estoque_produtos`, `plt_fn_estoque_configuracoes`, `plt_fn_estoque_resumo` (= a soma da lista — raio-x 5); `fn_estoque_por_produto`, `fn_minimo_efetivo`, `fn_sugestoes_minimo`, `fn_reservados_producao` lendo a projeção; `fn_estoque_reservas_loja` com a lista literal de situações (usa o índice) + `fn_situacao_reserva_estoque`.
- **Raio-x 1:** `fn_validar_chegada_estoque` vale para toda origem (tela, API, automação, maquinaria) e para o `card_criado` direto no fim de linha; só a marca `plt.ajuste_super_admin` (D-117) passa. `fn_concluir_pedido` liga essa marca (guardando e devolvendo o valor anterior).
- **Raio-x 2:** `fn_validar_api` — peça livre do ESTOQUE (fora de etapa DANIFICADO) só sai com a marca `plt.estoque_maquinaria`, para toda origem, até o motor; `fn_estoque_baixar_pecas` e `fn_fechar_pedido` ligam a marca (guardam e devolvem).
- **Raio-x 6 (ampliado):** a peça livre no ESTOQUE **sem produto do catálogo** (a personalizada — `fn_produto_do_item` já devolve nulo para ela — e a de SKU fora do catálogo; nenhuma das duas entra em número nenhum): `plt_fn_estoque_personalizadas(antes_id, limite)` por cursor (índice parcial `plt_cards_livre_sem_produto_idx`) e `plt_fn_estoque_baixar_personalizada(card, motivo)` (motivo obrigatório; `card_arquivado` motivo `baixa_manual`, `fora_do_catalogo`, `personalizada`; recusa a do catálogo e a danificada).
- Índices: `plt_cards_unidade_livre_produto_idx`, `plt_cards_unidade_pedido_sku_idx`, `plt_estoque_numeros_posicao_idx`, `plt_cards_livre_sem_produto_idx`.
- **Harness:** cenários antigos que montavam peça de pedido no ESTOQUE por API/criação (legado pré-regra) passaram a ligar a marca do ajuste; gatilhos SÓ DO TESTE (`teste_eventos_leitura_projecao`, `teste_itens_vendas_madrugada`, `teste_pedidos_vendas_madrugada`) fazem o papel da porta e da madrugada para os blocos antigos; o **bloco 57** os desliga para provar: projeção = contagem ao vivo gesto a gesto; reservados 1 → 2 → 2 em ROTAS → 0 entregue; resumo = soma da lista; recontagem acha 0 e corrige deriva forçada; raio-x 1 (API, automação, card criado no aguardo sem pedido); raio-x 2 (admin e evento direto recusados, baixa passa); raio-x 6 (lista com o pedido de origem, a fora do catálogo também, baixa); aviso do Tiny pela porta atualiza a linha; venda nova não mexe no ranking até a madrugada; privilégios. **788 ✔, TUDO VERDE.**

**Tela:** Estoque → Top X: botão "Peças sob medida e fora do catálogo" (só carrega ao abrir; cursor, "Ver mais"; "Dar baixa" com motivo obrigatório). A explicação do Estoque diz que a peça de pedido conta como reservada em venda até a entrega, inclusive na ROTAS. Corrigida a chave repetida "fechado" dos dois modais do Top X (aviso do React). `tsc` ✔ · lint ✔ · `npm test` 146 ✔ · build ✔.

**Ensaio A-11 no banco real (migration 57 numa transação → ROLLBACK):** migration 1,2 s · recontagem depois = 0 · 537 linhas (3.344 livres, 18 reservadas no galpão, 2 prontas de pedido, 7 em produção de pedido, 124 no ranking, 487 com leitura do Tiny) · 0 evento novo · **lista, filtros, busca, insumos e configurações IDÊNTICOS antes × depois**; o resumo mudou só no que não pertence a cartão nenhum: "móveis reservados" 20 → 19 (uma lâmpada, insumo, no aguardo do 13215) e "móveis em produção" 9 → 7 (2 mesas sem SKU do 13177) — é o raio-x 5. **Tempo no servidor** (medido dentro do banco, sem a ida e volta de ~90 ms daqui): lista Top X ~700 → **~21 ms**, busca ~650 → ~21 ms, configurações ~370 → ~8 ms, resumo ~900 → **~13 ms**, peças fora do catálogo ~2 ms; madrugada (`fn_recalcular_minimos`) ~0,6 s. **Catálogo ×100** (53 mil produtos a mais, no ensaio): lista ~550 ms, busca ~340, resumo ~390, configurações ~125 → **dívida 13 registrada na lei** (as portas ainda montam a página a partir do catálogo inteiro; crescer pedidos/peças/eventos não pesa mais).
- Perfil: os pedaços (`fn_estoque_por_produto` 10,6 ms, reservas da loja 5,5, sugestões 6,2, reservados p/ produção 1,0) e o plano genérico (como a função roda) ~23 ms.

**No ar (08/10 ~05:08 UTC):** migration 57 aplicada sozinha (`--so`): integração **idêntica** (digital `e2109f3a…`). Conferência: 537 linhas, **0 deriva** contra a contagem ao vivo, os 4 índices, o cron da madrugada intacto. Tela conferida no preview (lista nova abre; vazia hoje — não há peça fora do catálogo parada; sem erro novo no console). **Publicado:** `main` → **1330762**, Vercel ✔. ClickUp: comentário de entrega em "Reservado em venda até a entrega" (17tya50fm3m).
- Decisão nova: **D-119** (números prontos; ranking de madrugada e na troca da configuração) — tomada pelo Claude sob a ordem noturna; o dono pode revisar.
- "Pedidos em aguardo" segue mostrando só o que está fisicamente no aguardo; a "Visão do dia" não tem número de reservados (só o tempo parado no ESTOQUE) — D-118 atendida no Estoque (cartão, detalhe, filtros e resumo).
- Achado: avisos de chave repetida do React com ids numéricos (3405…3413, 74137, 172000…) vindos de OUTRA tela visitada antes (não do Estoque — recarregado, limpo). Conferir no PCP na etapa 3/6.
