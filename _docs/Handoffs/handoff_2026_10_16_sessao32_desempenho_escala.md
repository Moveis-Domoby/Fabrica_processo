---
titulo: Handoff — 2026-10-16 · SESSAO-32 · Desempenho e Escala (a plataforma inteira dentro da lei)
tipo: handoff
data: 2026-10-16
atualizado: 2026-10-16
tags: [handoff, sessao, sessao-32, bloco-6, desempenho, escala, banco, websocket, pacote, abertura, cursor, carga]
---

# 📋 Handoff — 16/10/2026 · SESSAO-32 · Desempenho e Escala

> [!success] Entregue em modo noturno — o que dependia só do Claude está no ar; o que é do dono está pronto e esperando
> Ordem do dono (15/10, ~21:10 de Natal): *"Vou sair agora, abre logo o navegador aqui pra que eu possa logar pra você e você testa tudo e me entrega apenas o resultado final após finalizar"* → *"Vá lá"*. Cada frente foi testada inteira (bateria do banco, tipos, estilo, testes de tela, montagem com teto, conferência no banco real pessoa por pessoa como `authenticated`, navegação no site com a conta do dono) e então **aplicada e publicada no mesmo gesto** (E-73). O reservado ao dono (D-137) ficou em `supabase/pendentes/`, com prova e números. Memória técnica completa: [[SESSAO-32]] (`Plataforma/Execucao/SESSAO-32.md`).

**Branch:** `sessao-32-desempenho-escala` (cada frente foi à `main` por avanço direto — D-20). **Demanda:** [[SESSAO-32 - Desempenho e Escala - Adequacao de Toda a Plataforma]]. **Banco:** migrations **76 a 87** (83–87 depois do OK do dono — D-138 a D-140) + a manutenção `2026-10-16_parar_fila_tiny_saldos_gigantes.sql` (integração do Tiny idêntica em todas — `e2109f3a…`). **Bateria do banco:** 970 → **1.013 verificações, tudo verde** (+ o bloco 85 da separação dos insumos, verde); testes de tela 162 → **191**. **Decisões:** D-137 a D-140.

## 1. Objetivo da sessão

Pôr a plataforma inteira dentro da [[PLT - Lei de Desempenho e Escala]]: primeira abertura em 1 requisição, nenhum relógio buscando dado (tudo ao vivo por websocket), pacote dividido por tela, banco com índices/regras de acesso/estatísticas certos, listas que crescem por cursor, permissões no token e a prova de carga — "mudar o caminho, nunca o resultado".

**Respostas do dono (15/10) → D-137:** tempo parado 12 h no tablet / 8 h no escritório; a velocidade medida pela própria plataforma; teste de carga em produção, de noite, fora dos horários das automações. Ficaram com ele: os cliques no painel da Supabase (chave do login e gancho), a retirada de índices e os índices nas tabelas do Tiny.

## 2. O que foi feito — por frente

### Achado do retrato: o laço da fila do estoque com o Tiny ✅ (migration 76 + manutenção)
Dois insumos cadastrados como "simples" no Tiny com saldo enorme (fita de borda 22.878,58 m; suporte 3.660 un) faziam a leitura criar uma peça por unidade, estourar 8 s, desfazer e voltar a cada 10 min — **~14,5 milhões de linhas desfeitas**, estatísticas erradas do planejador, WAL de 43 GB e boa parte do processador. Parados à mão, impedidos de voltar (teto de 500 peças por leitura; a reserva vencida conta como falha → 5 = parado) e `ANALYZE`. Carga de 40 pessoas: **p95 3,8 s (6% de erro) → 384 ms (0 erro)**.

### Frente A — banco ✅ em parte (migration 77)
29 índices de chave estrangeira; as 9 duplas de regras de acesso unidas; `(select …)` em todas as funções de sessão das regras; storage e realtime embrulhados; histórico do cron com limpeza diária (7 dias). Visibilidade provada idêntica (6 pessoas × 32 tabelas, contagem + md5). **Pendente do OK:** 4 índices das cópias do Tiny, 2 repetidos, Pedidos (§7).

### Frentes C e D — abertura numa chamada e tudo ao vivo ✅ (migrations 78 e 80)
- **Abertura = 1 requisição** (`plt_fn_abertura`: perfil, vínculos, setores, sino, chat, bolinha, etiquetas e campos e, na 1ª tela Meu Painel, os dados dele; ~10 ms no servidor, ~10 KB) — antes ~15, três em fila. Caminho de reserva se a porta falhar; cache limpo ao sair (tablet compartilhado).
- **Nenhum relógio buscando dado e nenhuma escuta de tabela inteira:** saíram os da bolinha, Meu Painel, Afazeres, Afazeres do time, Visão do dia, Danificados, Config. do estoque, Painel da API, lista do Comercial, presença e conferida de versão. Avisos novos por canal privado (painel, danificados, trabalho da pessoa, tarefas do setor, fila do Tiny, cada lista do Comercial); `plt_cards` fora da publicação; reprise do servidor ao entrar no canal; "ao vivo pausado" + Atualizar; espera da Visão do dia crescendo na tela sem reler.
- **E-103** pego na conferência do banco real (porta *invoker* chamando ajudante fechado ao papel) — corrigido antes de o site subir; a bateria agora chama como o navegador.

### Frente E — pacote dividido por tela ✅
34 telas em pedaços próprios; **JS inicial ~505 → 218 KB comprimidos**; **teto de 250 KB na montagem**; pré-carregamento na intenção; `/assets` com cache de 1 ano; pedaço sumido depois de atualização recarrega uma vez. No site: LCP 1,9 s na 1ª abertura, **0,8 s na 2ª**.

### Tempo parado e medição da velocidade ✅ (D-137; migration 79)
- **12 h no modo tablet / 8 h no escritório**, sem relógio (a conta no abrir, em cada gesto e ao voltar à aba); a saída fica na trilha com o motivo.
- **A plataforma mede a própria velocidade** em cada abertura (LCP, INP, CLS, FCP, TTFB por aparelho) → `plt_medicoes_web`, p75 por `plt_fn_medicoes_web_resumo` (só o dono lê). Primeira medida real: computador do dono, LCP 2,0 s, TTFB 195 ms.

### Leituras a menos ✅ (migrations 81 e 82)
- **PCP numa leitura** (`plt_fn_pcp_quadro`): abrir direto no PCP **6 → 2** requisições (a página traz etiquetas e o resumo do pedido); provado igual linha a linha (bateria e banco real, 6 pessoas).
- **Comercial:** as vendas dos 20 maiores clientes numa leitura (antes 1 por cliente) — painel **~29 → ~10** requisições; provado igual no banco real.
- **Auditoria e histórico das automações por cursor** (antes contavam a lista inteira a cada página); total só na 1ª página ("10.000+").
- Visualizações salvas dos painéis lidas uma vez por abertura.

### Depois do OK do dono (16/10, ~00:10–00:55 de Natal) ✅ (migrations 83, 84 e 85 — D-138)
- **Pedidos — busca e Cancelados (83):** os 3 índices criados sem travar + a porta por caminhos. No banco real: **Cancelados 42 → 3–5 ms**, busca por nome **30 → 10 ms**, por número **28 → 5 ms**; no ensaio ×100, a busca de um cliente 5,6 s → ~45 ms.
- **Cópias do Tiny e repetidos (84):** os 4 índices de contas a receber e notas fiscais e a retirada dos 2 repetidos. Avisos de desempenho da Supabase: **chaves sem índice 0, repetidos 0, regras duplicadas 0** (sobram só os "sem uso", informativos).
- **Móvel, insumo e peça com as contas separadas (85 + tela nova):** cada produto do Tiny tem um tipo no estoque — automático pelo cadastro do Tiny (fabricado e com variação = móvel; simples = móvel só com o código fiscal de móvel, senão insumo; matéria-prima por peça = peça; o resto = insumo) ou trocado à mão pelo admin em **Configurações → Móveis, insumos e peças** (paginada, com busca e filtros por tipo, classe do Tiny, origem e situação; volta ao automático; fica na auditoria). As contas de **móvel** (Top, mínimo, reposição, contagem da logística, conciliação peça a peça com o Tiny) só olham para móvel; **insumo e peça** ficam na aba Matéria-prima e insumos, contados pelo número do Tiny na unidade do produto, dizendo se é insumo, peça, kit ou matéria-prima. As peças de insumo que já estavam no ESTOQUE **ficam no quadro** e saem da conta dos móveis.
  - **Banco real antes → depois:** 504 produtos ativos = 201 móveis · 240 insumos · 63 peças; **móveis em estoque 4.895 → 130** (eram os insumos inflando); peças em estoque (un.) 210.613 → 241.795,05; m² 25 = 25; aba dos móveis 269 → 201; aba de insumos 235 → 303; Top 30 só com móvel; os 5.090 cartões de insumo (34 produtos) seguem no quadro.
  - **Achado na foto de antes:** a fila do Tiny continuava criando cartões de insumo (≈4.765 no começo da noite → **5.090** na hora de aplicar; 19 insumos na fila) — a fila agora só aceita móvel e os 19 saíram dela.
  - Tempo no servidor: a lista do admin 2–3 ms; as abas do estoque ~24 ms; o retrato do galpão ~15 ms.

### Comercial: a tela pronta no banco ✅ (migration 86 — D-139, pedido do dono)
- **Abre no mês atual:** Painel de Recompra em "Do mês"; no Dashboard, o que abria em "Tudo" abre no mês atual (números do topo, frequência de compra, top de produtos). "Todo o período" a um toque.
- **"Todo o período" quase instantâneo:** a tela fica pronta no banco (os pedidos já desmontados, a vida de cada cliente e as contas do mês), atualizada a cada pedido que o n8n grava — à prova de falha: se der erro ali, o pedido grava normalmente e a tela se corrige na próxima gravação.
- **Números:** no banco real, Painel no mês atual 1,9 ms e no período inteiro 3 ms (antes 1,5–2,5 s); números 1,3–1,6 ms; top de produtos 2,9 ms (antes 220 ms); maiores clientes 0,6 ms (antes 149 ms).
- **No site (conta do dono):** o painel abre no mês atual com a tela inteira em ~1 s (antes ~3,6 s); "Todo o período" volta em ~0,2 s depois da troca (antes ~2,4 s); o Dashboard inteiro em ~1,2 s (antes ~2,1 s).
- **Mesmos números de antes:** bateria (24 filtros do painel, 8 períodos do dashboard, gravações acompanhadas) e banco real numa transação desfeita (0 diferença em 21 filtros e 7 períodos, 42.658 linhas).

### Outubro igual ao Tiny: pedido excluído no Tiny some de todos os módulos ✅ (migration 87 — D-140)
- **Causa:** o pedido 13622 (Loja Domoby, R$ 14.051,90, de 08/10) foi excluído no Tiny; o Tiny não avisa exclusão e a conferência da madrugada só contava "não encontrado". Ele seguia no Comercial (outubro 128 · R$ 149.047,80 × Tiny 127 · R$ 134.995,90), na lista de Pedidos e com 32 cartões na produção.
- **Agora (regra do dono: "se o pedido não existe mais, ele não deve aparecer em nenhum módulo"):** a conferência marca sozinha o pedido que o Tiny diz que não existe (e desmarca se ele voltar); os cartões saem dos quadros (histórico guardado, peças reservadas liberadas) com aviso aos admins; Pedidos, PCP, estoque e Comercial não o enxergam mais.
- **No ar:** outubro = 127 pedidos · R$ 134.995,90 (igual ao Tiny); busca "13622" em Pedidos = nenhum pedido.

### Frente I — prova de carga ✅
| | Antes (15/10, começo da noite) | Antes, depois do `ANALYZE` | **Depois (16/10)** |
|---|---|---|---|
| 40 pessoas — requisições | — (abortada aos 123 s) | 1.265 (6/s) | **301 (1,4/s)** |
| 40 pessoas — erros | 6% | 0 | **0** |
| 40 pessoas — p95 servidor | 3.785 ms | 384 ms | **164 ms** |
| 400 pessoas — requisições | 13.269 (48/s) | — | **3.331 (13/s)** |
| 400 pessoas — erros | 2,4% | — | **0,4%** |
| 400 pessoas — p95 servidor | 2.013 ms | — | **627 ms** |

A 1ª rodada ×10 mostrou a **manada** (todas as Visões do dia e PCPs relendo no mesmo instante a cada card) → cada tela espera um sorteio antes de reler (A-67). A 2ª rodada ×10, 10 min depois, foi **interrompida pela trava na abertura** (p95 7,7 s): o comportamento das telas era o mesmo — o banco (máquina gratuita, 0,5 GB, processador compartilhado) não sustenta ×10 seguido (dívida 19).

## 3. Como testar — passo a passo (para o dono)

1. **Abertura:** abra a plataforma (F5). Com as ferramentas do navegador (Rede), filtre por `supabase`: aparece **uma** leitura (`plt_fn_abertura`) e o websocket. A tela do Meu Painel aparece completa.
2. **Segunda abertura:** feche e abra de novo — fica quase instantânea (os arquivos vêm do aparelho).
3. **Ao vivo:** abra o Meu Painel em dois aparelhos; conclua uma tarefa ou mova um card num deles — o outro atualiza sozinho em 1 a 6 segundos (sem recarregar). Na Visão do dia, a espera do PCP cresce sozinha na tela.
4. **PCP:** abra direto no PCP — os pedidos aparecem com cliente e unidades de uma vez.
5. **Auditoria (super admin):** role até o fim da lista — as próximas linhas chegam sozinhas.
6. **Tempo parado:** num tablet, deixe parado 12 h (ou no computador, 8 h) — ao tocar, a plataforma pede para entrar de novo.
7. **Velocidade dos tablets:** depois de um dia de uso, a medição fica no banco (o Claude tira o p75 por aparelho na próxima sessão).
8. **Tablet (768 px) e celular (375 px):** nada mudou na aparência; confira se tudo segue igual.
9. **Móveis, insumos e peças (admin):** Configurações → Móveis, insumos e peças. Busque um produto (ex.: "bucha"), filtre por Peça (63), troque um produto de tipo e depois toque em "Voltar ao automático" — o aviso confirma cada troca e ela aparece na auditoria.
10. **Estoque → Matéria-prima e insumos:** os insumos e as peças com a quantidade na unidade de cada um (un., m², m…) e o que cada um é (insumo, peça, kit, matéria-prima).
13. **Outubro igual ao Tiny:** Comercial → Painel de Recompra em "Do mês" (out/2026) = 127 pedidos e R$ 134.995,90 — o mesmo total da lista do Tiny em outubro. Pedidos → Todos os pedidos → buscar "13622": nenhum pedido. O sino dos admins tem o aviso "Pedido 13622 excluído no Tiny".
12. **Comercial → Painel de Recompra:** abre em "Do mês" (o atual), na hora. Troque "Data da Compra" para "Todo o período" — a tabela e os números voltam quase instantâneos. No Dashboard, toque em "Tudo" em qualquer cartão.
11. **Estoque → Configurações → Galpão:** "Móveis em estoque" conta só móvel (130 na hora da aplicação — antes 4.895, com os insumos).

## 4. Critérios de aceite — um a um

| Critério | Situação |
|---|---|
| Primeira abertura = 1 requisição de dados + o websocket pessoal | ✔ conferido no site (só `plt_fn_abertura`) |
| Toda tela abre com 1 requisição; o escondido só no clique | ✔ em parte — 0–1: Meu Painel, Afazeres, Afazeres do time, Chat, Perfil, Avisos, Visão do dia, Pedidos, Cancelados, Expedição, Danificados, Entregas, Setores e etapas, Auditoria, quadros (1), PCP (1); **2–3: painéis Pessoas/Qualidade/Tempo/Meu desempenho, Pedidos em aguardo, Programação, configurações, Automações; Comercial ~10 → dívida 18** |
| Zero `refetchInterval`, zero `setInterval` buscando dado, zero `postgres_changes`; `plt_cards` fora da publicação | ✔ (os `setInterval` que sobraram só contam tempo na tela) |
| Token verificado localmente; políticas lendo do token | **pendente do dono** — gancho pronto (`supabase/pendentes/2026-10-16_gancho_do_token.sql`); falta ligar a chave assimétrica e o gancho no painel |
| JS inicial ≤ 250 KB; cada tela em pedaço próprio; teto no build | ✔ 218 KB; teto de 250 KB na montagem |
| Portas de tela ≤ 50 ms (p95) / painéis ≤ 150 ms com ×100 | ✔ em parte — abertura ~10 ms, Visão do dia ~27 ms, quadro 6–10 ms; **acima: a página do PCP (100–200 ms — dívida 16)**; Pedidos com os índices (D-138): Cancelados 3–5 ms, busca 5–10 ms (×100: ~45 ms) |
| Advisors de desempenho zerados ou justificados | ✔ zerados com o OK do dono (chaves sem índice 0, repetidos 0, regras duplicadas 0); sobram os "sem uso" (informativo — quase todos desta semana) |
| Estatísticas certas, com a causa | ✔ a causa foi o laço da fila do Tiny |
| Nenhum relógio que acorda para ver se há trabalho | **não pago** — medido (~0,35% de um núcleo) e proposto ao dono (mexe no n8n e no disparo — regra 3) |
| Listas que crescem por cursor; teto no banco | ✔ Auditoria e automações por cursor; as outras 22 são limitadas, com teto |
| Teste de carga 40 e ×10 | ✔ §2 |
| Core Web Vitals p75 dos tablets | a medição está no ar; os números chegam com o uso |
| Integração do Tiny idêntica a cada atualização | ✔ em todas (76 a 87) |
| §14 da lei atualizado | ✔ andamento da SESSAO-32 + dívidas 18 a 20 |
| ClickUp em FAZENDO, nunca concluído, dono avisado | ✔ §8 |

## 5. Checklist de desempenho da lei (§12)

- [x] **Requisições:** abertura 1; quadros 1; PCP 1 (+ abertura); Visão do dia 1; Auditoria 1 por página; telas restantes na dívida 18.
- [x] **Busca no código:** sem relógio buscando dado, sem `postgres_changes`.
- [x] **Banco real (servidor):** abertura p50 ~10 ms; Visão do dia p50 27 ms; bolinha idêntica à visão antiga; PCP numa leitura igual linha a linha.
- [x] **Índices:** todas as chaves novas com índice; advisors sem item de tipo novo.
- [x] **RLS:** `(select …)` em todas as regras; nenhuma dupla permissiva.
- [x] **Listas:** as que crescem por cursor; teto em todas.
- [x] **Pacote:** 505 → 218 KB (teto na montagem).
- [x] **Ao vivo sem manada:** releituras espalhadas por sorteio.
- [ ] **Tablet/celular (INP real):** a medição está no ar; números com o uso.
- **Registro de uso (`pg_stat_statements`):** foto do início em `Execucao/dados/` e as do meio da noite no scratchpad; o topo depois da noite são as portas antigas do Comercial e do estoque (dívidas 5 e 13).

## 6. Decisões provisórias (o Claude escolheu — dizer sim ou não)

1. **Tempo parado:** "tablet" é o aparelho cujo último toque foi no modo tablet (12 h); o resto, 8 h. Passou → a pessoa entra de novo e a saída fica na auditoria com o motivo.
2. **Medição:** uma linha por abertura, mandada ao sair da aba (ou na troca de tela depois de 5 min); só o dono vê.
3. **Gancho do token:** a pessoa inativa **não é recusada no login** (o token sai marcado como inativo e as regras negam tudo, como hoje) — a alternativa é recusar já no login, com mensagem.
4. **Espalhar as releituras:** painel até 4 s, PCP 1,5 s, logística 1 s, quadro do setor 0,7 s.
5. **Lista de Pedidos por caminhos:** só sobe **junto** com os índices (sozinha deixaria a busca 20–60 ms mais lenta).
6. **Auditoria e histórico das automações:** "Ver mais" ao rolar (sem números de página); acima de 10 mil mostra "10.000+".

## 7. Para o OK do dono (o que sobrou está em `supabase/pendentes/`)

- ✅ **Aplicado com o OK do dono (16/10, D-138) —** **Pedidos — busca por nome e Cancelados:** a porta por caminhos (provada igual: bateria 9 casos/121 linhas; banco real 325 linhas, 0 diferença) + a extensão `pg_trgm` + 3 índices (cancelados parcial; trigramas em `clientes.nome` e `pedidos.vendedor`). Ensaio ×100 (556.800 pedidos, 1.080.000 clientes — banco local): **busca de um cliente 5,6 s → ~45 ms**, **total dos Cancelados 2,8 s → 11 ms**, página dos Cancelados 12–23 → 2–7 ms; termo muito comum fica igual a hoje (a porta olha primeiro os 5.000 pedidos mais recentes). Hoje, com o volume atual, tudo fica parecido (±20–100 ms) — o ganho é para quando crescer. Detalhe: [[SESSAO-32]] § "Ensaio ×100 de Pedidos".
- ✅ **Aplicado (D-138) —** **Cópias do Tiny e repetidos:** 4 índices (contas a receber e notas fiscais por cliente e por pedido) + retirada de `idx_membros_lista` e `plt_cards_pedido_uq`.
- **Login com as permissões no token:** no painel — chave assimétrica como atual (a antiga fica como "usada antes"; nunca revogar: n8n e rotinas usam) e o gancho do token; depois, as funções de sessão lendo do token (próxima sessão, com ele).
- **Rotinas de minuto em minuto → "nascer do fato":** reservas do estoque, despacho de webhooks, disparo do Comercial e fotos do Tiny. Custam pouco (~0,35% de um núcleo), mas a lei pede. Mexe no n8n e no disparo → decisão do dono.
- ✅ **Respondida e aplicada (D-138) —** os insumos saíram da conta dos móveis: contas separadas de móvel × insumo e peça e a tela de Configurações para o admin corrigir o tipo (§2).
- **Para quando chegar a vez dos insumos:** os 5.090 cartões de insumo no quadro do ESTOQUE ficaram parados (o número que vale é o do Tiny, na aba de insumos) — decidir se saem do quadro ou viram outra coisa.
- **Máquina do banco:** os picos de segundos vêm da máquina gratuita (0,5 GB, processador compartilhado) — mesmo parada. Subir de máquina é custo — decisão do dono.
- **Projeto "Sistema Domoby - Staging"** (pausado na Supabase): é seu e pode ser usado para os ensaios pesados?

## 8. ClickUp (regra 19)

Em **FAZENDO**, nenhuma concluída (quem conclui é o dono):
- [Tempo real por websocket no lugar das atualizações automáticas](https://app.clickup.com/t/17tya50fm3w) — **entregue** (comentário com o que foi feito e como conferir).
- [Pacote dividido por tela](https://app.clickup.com/t/17tya50fm3y) — **entregue** (comentário).
- [Primeira abertura em uma requisição](https://app.clickup.com/t/17tya50fm3v) — abertura entregue; telas com 2–3 leituras seguem (dívida 18).
- [Banco: índices, políticas de acesso e estatísticas](https://app.clickup.com/t/17tya50fm40) — **entregue**, com os índices que esperavam o OK aplicados (D-138; comentário com o que foi feito e como conferir).
- [Telas lentas do comercial e gravação do pedido do Tiny](https://app.clickup.com/t/17tya50fm3z) — **em FAZENDO**: o Comercial entregue (comentário com o que foi feito e como conferir); a gravação do pedido do Tiny segue.
- A separação de **móvel, insumo e peça** e a tela de Configurações **não têm tarefa no ClickUp** — o dono decide se cria (regra 19).
- [Listas por cursor](https://app.clickup.com/t/17tya50fm42) — as que crescem entregues; carga no §2.
- Ficam em A FAZER (dependem do dono ou da próxima sessão): [Permissões no token](https://app.clickup.com/t/17tya50fm3x) · [Rotinas do banco por evento](https://app.clickup.com/t/17tya50fm41).

## 9. Para a máquina — onde está cada coisa

- **Migrations:** 76 `20261016010000_plt_estoque_tiny_teto_e_tentativa` · 77 `…020000_plt_banco_indices_politicas` · 78 `…030000_plt_abertura_e_ao_vivo` · 79 `…040000_plt_medicao_web` · 80 `…050000_plt_abertura_catalogos` · 81 `…060000_plt_listas_por_cursor` · 82 `…070000_plt_pcp_quadro_numa_leitura` · 83 `…080000_plt_pedidos_busca_indices` · 84 `…090000_plt_indices_copias_tiny_e_repetidos` · 85 `…100000_plt_estoque_movel_insumo_peca` · 86 `…110000_plt_comercial_tela_pronta` · 87 `…120000_plt_pedido_excluido_no_tiny` — detalhe em [[SUPA - Esquema do Banco]]. Manutenção: `supabase/manutencao/2026-10-16_parar_fila_tiny_saldos_gigantes.sql`. **Pendente:** só o gancho do token em `supabase/pendentes/` (README).
- **Front:** `src/autenticacao/{abertura,inatividade}.ts` · `ProvedorSessao.tsx` · `src/lib/{aoVivo,medicao,versaoNova}.ts` · `src/chat/canais.ts` · `src/navegacao/pedacos.ts` · `src/App.tsx` (telas sob demanda) · `vite.config.ts` (teto) · `vercel.json` (cache) · `src/componentes/AvisoAoVivoPausado.tsx` · telas: Meu Painel, Afazeres, Afazeres do time, Visão do dia, Danificados, Config. do estoque, API, PCP, Auditoria, Automações, lista do Comercial, painel do Comercial · **móvel/insumo/peça:** `src/paginas/ClassificacaoProdutos.tsx`, `src/logistica/classificacao.ts`, `src/logistica/componentes/PainelInsumos.tsx` (o tipo na aba de insumos), rota `/configuracoes/produtos` (App, menu, pré-carregamento, auditoria).
- **Bateria:** blocos 76, 78–83 e 85–87 em `supabase/testes/testar-migrations.mjs` (o 83 compara a porta de Pedidos de antes com a da migration 83; o PGlite carrega `pg_trgm`).
- **Scripts de prova (scratchpad da sessão):** `conferir-78/79/81/82/83/85/86.mjs`, `tempo-85b.mjs`, `upsert-produto.mjs`, `baixar-comercial.mjs`, `plano-mes-86.mjs`, `carga.mjs`/`carga-nova.mjs`, `visibilidade.mjs`, `medir-pedidos.mjs`, `ensaio-pedidos-x100.mjs`, `foto-pss.mjs`.
- **Aprendizados:** E-101 a E-107 e A-65 a A-71 em [[PLT - Memoria de Aprendizado]].

## Ver também

[[SESSAO-32]] · [[PLT - Lei de Desempenho e Escala]] · [[PLT - Decisoes de Produto]] (D-137) · [[000 - ORDEM DAS SESSOES]] · [[handoff_2026_10_14_sessao31_kanban_completo]]
