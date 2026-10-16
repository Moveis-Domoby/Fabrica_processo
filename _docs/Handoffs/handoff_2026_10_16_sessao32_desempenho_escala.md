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

**Branch:** `sessao-32-desempenho-escala` (cada frente foi à `main` por avanço direto — D-20). **Demanda:** [[SESSAO-32 - Desempenho e Escala - Adequacao de Toda a Plataforma]]. **Banco:** migrations **76 a 82** + a manutenção `2026-10-16_parar_fila_tiny_saldos_gigantes.sql` (integração do Tiny idêntica em todas — `e2109f3a…`). **Bateria do banco:** 970 → **1.013 verificações, tudo verde**; testes de tela 162 → **191**. **Decisão:** D-137.

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

## 4. Critérios de aceite — um a um

| Critério | Situação |
|---|---|
| Primeira abertura = 1 requisição de dados + o websocket pessoal | ✔ conferido no site (só `plt_fn_abertura`) |
| Toda tela abre com 1 requisição; o escondido só no clique | ✔ em parte — 0–1: Meu Painel, Afazeres, Afazeres do time, Chat, Perfil, Avisos, Visão do dia, Pedidos, Cancelados, Expedição, Danificados, Entregas, Setores e etapas, Auditoria, quadros (1), PCP (1); **2–3: painéis Pessoas/Qualidade/Tempo/Meu desempenho, Pedidos em aguardo, Programação, configurações, Automações; Comercial ~10 → dívida 18** |
| Zero `refetchInterval`, zero `setInterval` buscando dado, zero `postgres_changes`; `plt_cards` fora da publicação | ✔ (os `setInterval` que sobraram só contam tempo na tela) |
| Token verificado localmente; políticas lendo do token | **pendente do dono** — gancho pronto (`supabase/pendentes/2026-10-16_gancho_do_token.sql`); falta ligar a chave assimétrica e o gancho no painel |
| JS inicial ≤ 250 KB; cada tela em pedaço próprio; teto no build | ✔ 218 KB; teto de 250 KB na montagem |
| Portas de tela ≤ 50 ms (p95) / painéis ≤ 150 ms com ×100 | ✔ em parte — abertura ~10 ms, Visão do dia ~27 ms, quadro 6–10 ms; **acima: a página do PCP (100–200 ms — dívida 16); Pedidos (busca/cancelados) espera os índices (ensaio ×100 no §7)** |
| Advisors de desempenho zerados ou justificados | ✔ justificados: 4 chaves e 2 repetidos esperando o OK; "sem uso" quase todos desta semana |
| Estatísticas certas, com a causa | ✔ a causa foi o laço da fila do Tiny |
| Nenhum relógio que acorda para ver se há trabalho | **não pago** — medido (~0,35% de um núcleo) e proposto ao dono (mexe no n8n e no disparo — regra 3) |
| Listas que crescem por cursor; teto no banco | ✔ Auditoria e automações por cursor; as outras 22 são limitadas, com teto |
| Teste de carga 40 e ×10 | ✔ §2 |
| Core Web Vitals p75 dos tablets | a medição está no ar; os números chegam com o uso |
| Integração do Tiny idêntica a cada atualização | ✔ em todas (76 a 82) |
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

## 7. Para o OK do dono (tudo pronto em `supabase/pendentes/`)

- **Pedidos — busca por nome e Cancelados:** a porta por caminhos (provada igual: bateria 9 casos/121 linhas; banco real 325 linhas, 0 diferença) + a extensão `pg_trgm` + 3 índices (cancelados parcial; trigramas em `clientes.nome` e `pedidos.vendedor`). Ensaio ×100 (556.800 pedidos, 1.080.000 clientes — banco local): **busca de um cliente 5,6 s → ~45 ms**, **total dos Cancelados 2,8 s → 11 ms**, página dos Cancelados 12–23 → 2–7 ms; termo muito comum fica igual a hoje (a porta olha primeiro os 5.000 pedidos mais recentes). Hoje, com o volume atual, tudo fica parecido (±20–100 ms) — o ganho é para quando crescer. Detalhe: [[SESSAO-32]] § "Ensaio ×100 de Pedidos".
- **Cópias do Tiny e repetidos:** 4 índices (contas a receber e notas fiscais por cliente e por pedido) + retirada de `idx_membros_lista` e `plt_cards_pedido_uq`.
- **Login com as permissões no token:** no painel — chave assimétrica como atual (a antiga fica como "usada antes"; nunca revogar: n8n e rotinas usam) e o gancho do token; depois, as funções de sessão lendo do token (próxima sessão, com ele).
- **Rotinas de minuto em minuto → "nascer do fato":** reservas do estoque, despacho de webhooks, disparo do Comercial e fotos do Tiny. Custam pouco (~0,35% de um núcleo), mas a lei pede. Mexe no n8n e no disparo → decisão do dono.
- **Pergunta de produto:** os insumos cadastrados como "simples" no Tiny (fita, parafusos, cola, suporte…) devem sair da conta de peças?
- **Máquina do banco:** os picos de segundos vêm da máquina gratuita (0,5 GB, processador compartilhado) — mesmo parada. Subir de máquina é custo — decisão do dono.
- **Projeto "Sistema Domoby - Staging"** (pausado na Supabase): é seu e pode ser usado para os ensaios pesados?

## 8. ClickUp (regra 19)

Em **FAZENDO**, nenhuma concluída (quem conclui é o dono):
- [Tempo real por websocket no lugar das atualizações automáticas](https://app.clickup.com/t/17tya50fm3w) — **entregue** (comentário com o que foi feito e como conferir).
- [Pacote dividido por tela](https://app.clickup.com/t/17tya50fm3y) — **entregue** (comentário).
- [Primeira abertura em uma requisição](https://app.clickup.com/t/17tya50fm3v) — abertura entregue; telas com 2–3 leituras seguem (dívida 18).
- [Banco: índices, políticas de acesso e estatísticas](https://app.clickup.com/t/17tya50fm40) — feito o que era do Claude; o resto espera o OK.
- [Listas por cursor](https://app.clickup.com/t/17tya50fm42) — as que crescem entregues; carga no §2.
- Ficam em A FAZER (dependem do dono ou da próxima sessão): [Permissões no token](https://app.clickup.com/t/17tya50fm3x) · [Telas lentas do comercial e gravação do pedido do Tiny](https://app.clickup.com/t/17tya50fm3z) · [Rotinas do banco por evento](https://app.clickup.com/t/17tya50fm41).

## 9. Para a máquina — onde está cada coisa

- **Migrations:** 76 `20261016010000_plt_estoque_tiny_teto_e_tentativa` · 77 `…020000_plt_banco_indices_politicas` · 78 `…030000_plt_abertura_e_ao_vivo` · 79 `…040000_plt_medicao_web` · 80 `…050000_plt_abertura_catalogos` · 81 `…060000_plt_listas_por_cursor` · 82 `…070000_plt_pcp_quadro_numa_leitura` — detalhe em [[SUPA - Esquema do Banco]]. Manutenção: `supabase/manutencao/2026-10-16_parar_fila_tiny_saldos_gigantes.sql`. **Pendentes:** `supabase/pendentes/` (README).
- **Front:** `src/autenticacao/{abertura,inatividade}.ts` · `ProvedorSessao.tsx` · `src/lib/{aoVivo,medicao,versaoNova}.ts` · `src/chat/canais.ts` · `src/navegacao/pedacos.ts` · `src/App.tsx` (telas sob demanda) · `vite.config.ts` (teto) · `vercel.json` (cache) · `src/componentes/AvisoAoVivoPausado.tsx` · telas: Meu Painel, Afazeres, Afazeres do time, Visão do dia, Danificados, Config. do estoque, API, PCP, Auditoria, Automações, lista do Comercial, painel do Comercial.
- **Bateria:** blocos 76 e 78–83 em `supabase/testes/testar-migrations.mjs` (o 83 lê a porta pendente de Pedidos).
- **Scripts de prova (scratchpad da sessão):** `conferir-78/79/81/82/83.mjs`, `carga.mjs`/`carga-nova.mjs`, `visibilidade.mjs`, `medir-pedidos.mjs`, `ensaio-pedidos-x100.mjs`, `foto-pss.mjs`.
- **Aprendizados:** E-101 a E-106 e A-65 a A-68 em [[PLT - Memoria de Aprendizado]].

## Ver também

[[SESSAO-32]] · [[PLT - Lei de Desempenho e Escala]] · [[PLT - Decisoes de Produto]] (D-137) · [[000 - ORDEM DAS SESSOES]] · [[handoff_2026_10_14_sessao31_kanban_completo]]
