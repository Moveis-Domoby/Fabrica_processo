---
titulo: "Diário — SESSAO-55 · telas que ainda abriam com mais de uma leitura (Meu Painel/Afazeres, painéis e configurações)"
tipo: execucao
data: 2026-11-18
tags: [execucao, sessao-55, desempenho, dashboards, configuracoes, meu-painel]
---

# Diário — SESSAO-55 (18/11/2026, madrugada — mesa da fila, sem o dono na conversa)

Demanda: [[SESSAO-55 - Telas que Abrem com Uma Leitura Dashboards Configuracoes e Meu Painel]] · ramo `sessao-55-telas-numa-leitura` (worktree própria da fila, nascida da main `78e8829`) · pedido: `_escritorio/handoffs/sessao-55-telas-numa-leitura-prompt-claude-code.md`.

> **Nada saiu deste PC:** nenhum push, nenhuma migration aplicada, nenhum deploy, nada no n8n, nada no ClickUp (regra da fila: o dono cuida das tarefas). **As notas grandes não foram editadas** (regra da leva): o que é delas está na seção "Para entrar nas notas depois da dieta", no fim deste diário e no handoff.

## Partida

- `git status` limpo; ramo certo; `origin/main` = a base.
- **Leitura:** `CLAUDE.md` da mesa; a Lei de Desempenho (§1–§13 e o §14 nas dívidas 18 e 20); o pedido (duas vezes); a abertura do app (`plt_fn_abertura` vigente — `20261111050000`), o modelo de porta de abertura (`plt_fn_tempos_abertura`, D-284) e as telas tocadas, no código. **Decisões de Produto e Memória de Aprendizado (700 KB as duas) foram lidas por inteiro por um ajudante**, que devolveu o resumo do que rege esta sessão (as lições de porta/permissão/bateria e as decisões das telas: D-32, D-51/D-95, D-66/D-68, D-100, D-146/D-147, D-232, D-284; E-11, E-22, E-50, E-103, A-80, A-12…) — eu não as li linha a linha. O Esquema do Banco foi consultado pelas migrations (os nomes de coluna saíram do `create table`/da função vigente, por grep — E-36).
- **Banco vivo: sem acesso** (regra da fila). O que precisa dele está em "Para ligar com o dono".
- **ClickUp:** a ordem da fila ("não mexa") vale por cima do pedido ("se tiver acesso, mova"): não toquei. A tarefa está linkada na demanda.

## Entendimento (o que na conversa seria o "traga e espere o OK")

1. **Escopo:** dar a cada tela a sua porta de abertura (1 requisição): o trabalho da pessoa (Meu Painel/Afazeres/bolinha — dívida 20); Pessoas, Qualidade e Meu desempenho; Equipe, API e integrações, Controle de tempo, Caminhões e Automações (dívida 18). Para quem usa, nada muda na tela.
2. **Fora:** configuração do Estoque, Programação, Pedidos em aguardo, Comercial (ficam na dívida 18) e tudo que é de outra mesa.
3. **Dúvidas de negócio:** nenhuma que travasse — é troca de encanamento, sem regra nova. As escolhas técnicas viraram provisórias (abaixo).
4. **Decisões técnicas tomadas na partida:**
   - **A porta nova só JUNTA as leituras de sempre** (chama as mesmas portas/tabelas por dentro, `security invoker`): os números saem iguais por construção e **nenhuma função existente é recriada** (zero risco de E-17/E-103 nas portas vivas). Nada de "ajuste crítico": só funções novas de leitura; nenhuma tabela, coluna, política ou permissão muda.
   - **`plt_fn_abertura` não foi tocada** (é a porta do login — E-103).
   - **Ordem de subida: banco antes do site.** As migrations só criam função; o site de hoje nem as chama. O site novo chama as portas novas — sem elas, as telas tocadas não abrem. Por isso não há caminho de reserva para o banco velho (o gesto é um só — E-73).

## Task list (espelha a demanda)

- [x] 0 · Gravar o pedido como demanda (sem linkar na Ordem das Sessões).
- [x] 1 · Meu Painel/Afazeres: o aviso do trabalho numa porta (dívida 20).
- [x] 2a · Dashboards → Pessoas numa porta.
- [x] 2b · Dashboards → Qualidade numa porta.
- [x] 2c · Dashboards → Meu desempenho numa porta.
- [x] 2d · "Tempo por setor": conferido — é só redirecionamento (dívida paga pela SESSAO-43).
- [x] 3a · Configurações → Equipe numa porta.
- [x] 3b · Configurações → API e integrações numa porta.
- [x] 3c · Configurações → Controle de tempo: as 7 abas já abriam com 1 leitura cada (SESSAO-42); o bloco "Desligar o tempo" (no clique) fazia 3 → 1.
- [x] 3d · Configurações → Caminhões numa porta.
- [x] 3e · Automações numa porta (a lista e a automação aberta).
- [x] Critérios: 1 requisição por tela (teste de tela), nada escondido antes do clique, nenhum relógio, nenhum `postgres_changes`, números iguais (bateria), ×100 (ensaio).
- [x] lint, build, testes; diário; handoff; reporte.

## O que as telas faziam (lido no código, 18/11)

| Tela | Antes | Depois |
|---|---|---|
| **Aviso do trabalho** fora das telas pessoais (a bolinha) | 2 (tarefas, execuções) | **1** |
| **Aviso do trabalho** no Meu Painel | 4 (tarefas, execuções, cards delegados, tarefas do Sistema) | **1** |
| **Meu Painel** vindo de outra tela | 5 (cards, tarefas do Sistema, fila, metas… a bolinha já tinha 2) | **1** (a fila e a 1ª página das metas vêm juntas) |
| **Meu Painel** como 1ª tela | 0 além da abertura do app | 0 |
| **Meus afazeres** | 4, a dos pedidos **em cascata** (cards → pedidos) e a das subtarefas baixando todas para contar | **1** (o "2/5" vem contado; o número do pedido vem junto) |
| **Pessoas** | 4 (visualizações, ranking, metas, execuções); com `?v=` **em cascata** | **1** |
| **Qualidade** | 4 (visualizações, período, período anterior, danificados); com `?v=` em cascata | **1** |
| **Meu desempenho** | 3 (números, por dia, por tarefa) | **1** |
| **Tempo por setor** | só redireciona para Tempos de produção (SESSAO-43) | — (paga) |
| **Equipe** | 2 (pessoas, vínculos) | **1** |
| **API e integrações** | 3 (chaves, webhooks, entregas) | **1** |
| **Controle de tempo** — as 7 abas | 1 cada (SESSAO-42) | 1 cada (paga) |
| **Controle de tempo** — "Desligar o tempo" (clique) | 3 (nomes, horários, pausas) | **1** |
| **Caminhões** | 2 (lista, situação do "Entregue vai ao Tiny") | **1** |
| **Automações** — lista / automação aberta | 3 (lista ou automação, etapas, pessoas) | **1** |

## Diário

### Banco — 3 migrations, 9 funções NOVAS, nenhuma recriada

- `20261118130000_plt_meu_trabalho_numa_leitura.sql` — `plt_fn_meu_trabalho(p_tela, p_abrir)`: as tarefas abertas e as execuções abertas (a bolinha); `painel` soma os cards delegados e as tarefas do Sistema dos setores da pessoa (com `p_abrir`, a fila de prioridade e a 1ª página das metas); `afazeres` soma os cards, o contador de subtarefas por tarefa e o número dos pedidos dos cards (até 100). As mesmas colunas e filtros de `plt_fn_abertura`.
- `20261118130100_plt_dashboards_numa_leitura.sql` — `plt_fn_dash_pessoas_abertura(p_dias, p_setor_id, p_setor_dito, p_v, p_visualizacoes, p_metas, p_metas_limite)`, `plt_fn_dash_qualidade_abertura(p_dias, p_v, p_visualizacoes)`, `plt_fn_meu_desempenho_abertura(p_dias, p_limite)`. Chamam por dentro `plt_fn_dash_tempos_pessoa`, `plt_fn_dash_execucoes`, `plt_fn_dash_qualidade` (duas vezes), `plt_fn_dash_danificados_abertos`, `plt_fn_meu_desempenho`, `plt_fn_meu_tempo_dias`, `plt_fn_meu_tempo_tarefas`, `plt_fn_metas_painel`. **O período passa a ser resolvido no banco** com a precedência da tela (endereço > visualização salva de quem chama > 7 dias) e volta em `de`/`ate`.
- `20261118130200_plt_configuracoes_numa_leitura.sql` — `plt_fn_equipe_abertura()`, `plt_fn_api_abertura()`, `plt_fn_caminhoes_abertura(p_arquivados, p_tiny)`, `plt_fn_automacoes_abertura(p_id, p_limite, p_deslocamento, p_arquivadas, p_cadastros)`, `plt_fn_tempo_desligar_abertura()`.
- Todas: `security invoker` (a RLS e a leitura por coluna de `plt_usuarios` decidem como na leitura direta), `stable`, `set search_path`, `revoke … from public, anon` + `grant execute … to authenticated`, `set local lock_timeout = '5s'`. **Nenhuma tabela, coluna, índice, política ou grant de tabela muda.** O segredo do webhook e o hash da chave de API não saem (a tela nunca os leu); CPF, PIN, convite e nascimento seguem fora.
- **md5 de função recriada: não se aplica** (nenhuma recriada). A conferir no banco vivo antes de aplicar: que as 9 **não existem** e que as portas chamadas por dentro existem com a assinatura esperada (lista em "Para ligar com o dono").

### Telas

- **`src/afazeres/meuTrabalho.ts` (novo):** uma chave de cache (`['afazeres', 'meu-trabalho', eu]` — sob `['afazeres']`, que todo gesto já invalidava) e um gancho `useMeuTrabalho(recorte, tela)`. A bolinha (`BolhaExecucao`), o balão de sugestões (`BolhaSugestao`), o `MeuPainel` e os `Afazeres` leem a mesma resposta. O módulo sabe qual tela pessoal está aberta e a porta traz só o que ela mostra; a tela que encontra guardado o retrato de outra pede o dela (1 leitura). `abertura.ts` semeia a mesma chave. `useMeuTrabalhoAoVivo` invalida uma chave só.
- **`src/lib/semear.ts` (novo):** `faltaNoCache` — a porta de abertura só traz o pedaço que tem vida própria no cache (metas, visualizações, etapas, pessoas, situação do Tiny) quando ele não existe, foi invalidado ou envelheceu; o pedaço entra com a chave e o formato de sempre (E-22) e a consulta dele liga só depois da porta (acha o dado, não pede de novo; relê no gesto).
- **Dashboards:** `usePainelDash(tela, { comPorta: true })` devolve o `pedido` (o que o endereço diz, cru) e só liga a consulta das visualizações depois de a porta guardá-las. `abrirPessoas`, `abrirQualidade`, `abrirMeuDesempenho` em `dashboards/api.ts`. A chave do cache passou a ser **o que o endereço diz** (dias, setor, visualização), não o instante — antes a chave levava a hora e a tela relia a cada entrada; agora, voltar em menos de 30 s reaproveita.
- **Configurações:** `Equipe` (a mesma função, pela porta), `AdminApi` (uma chave `['api-integracoes']`; o "Atualizar" e cada gesto releem as três listas numa chamada), `Caminhoes` + `CartaoEntregaTiny` (o cartão liga depois da porta), `Automacoes` (`listarAutomacoes`/`buscarAutomacao` chamam a porta e semeiam etapas e pessoas), `DesligarTempo` (a porta semeia nomes, horários e pausas).
- **Código morto tirado:** os buscadores que ficaram sem uso (`meusCards`, `minhasTarefas`, `tarefasDoSistema`, `minhasExecucoesAbertas`, `listarChavesApi`, `listarWebhooks`, `entregasRecentes`, `dashTemposPessoa`, `dashQualidade`, `dashDanificadosAbertos`, `meuDesempenho`, `meuTempoDias`).

### Provas

- **Bateria do banco (`npm run test:banco`):** bloco novo "SESSAO-55" (faixa: usuários `…0551`–`…0556`, CPF `551000000NN`, setor `m55`, pedido `95501`/tiny `7955101`, placas `TST5501/02`) — cada pedaço de cada porta comparado, **no banco e como o navegador chama** (`set role authenticated`, pessoa por pessoa: dono, admin comum, líder, operador, operador sem setor), com a leitura antiga; a precedência do período; a privacidade da tarefa pessoal; a recusa das Automações para quem não é o dono; visitante não chama nenhuma; todas `STABLE` e invoker. Resultado: ver "Resultados".
- **Teste de tela (`src/paginas/umaLeitura.test.tsx`, 14 provas):** as telas de verdade renderizadas com um servidor gravado — **uma chamada à porta de abertura e nenhuma leitura direta de tabela**; o aviso do trabalho relê uma vez (antes 4), sem a fila nem as metas; o Meu Painel como 1ª tela não lê nada.
- **Ensaio ×100** (`dados/SESSAO-55 - ensaio x100 das portas de abertura (script, 2026-11-18).mjs`): o volume da casa (SESSAO-47) + o destas telas ×100; antes × depois de cada tela, 8 chamadas, como `authenticated`; os planos das leituras que as portas fazem direto. Resultado: ver "Resultados".

### Erros e acertos no caminho (viram entradas da Memória — ver o fim)

- O script de edição em heredoc do shell quebrou nas aspas (E-45 de novo, na 1ª tentativa): programa com aspas/crase vai em arquivo.
- O teste das Automações troca o módulo inteiro por um dublê: pôr o argumento novo NA FRENTE (`buscarAutomacao(clienteQuery, id)`) fez o dublê devolver o cliente como id. Argumento novo vai no fim.
- Desenho: consulta "semeada" com validade de 30 s reliria sozinha ao voltar à tela (a porta responde do cache e a consulta dependente está vencida). Nas telas com porta, o pedaço semeado tem validade infinita e quem decide renová-lo é a porta (`faltaNoCache`).
- Bateria: `jsonb -> 'chave'` de um nulo é o nulo do JSON, diferente do NULL da porta — comparar com `nullif(…, 'null'::jsonb)`.
- Bateria: o "iniciar" com hora ANTERIOR à chegada da peça não abre execução (a posição vem do último fato) — a comparação passava vazia dos dois lados; o cenário só valeu quando o iniciar veio depois.
- Ensaio fora da bateria: o PGlite não dá ao papel `authenticated` o que o Supabase dá por padrão (esquema `auth`, leitura das tabelas de `public`) — o ensaio repete os grants do bloco 78 (menos `plt_usuarios`, lida por coluna).
- Rodada completa do vitest com a máquina carregada (outras mesas rodando): 12 testes estouraram os 5 s, em telas que esta sessão não toca; sozinhos, passam.

## Resultados

### Bateria do banco (`npm run test:banco`, 18/11)

- **2.003 ✔ · 1 ✘.** O ✘ é o de sempre: `fn_dashboard_revenue_chart` do Comercial ("as 7 portas novas = as antigas"), que já falha na main (A-134) e esta sessão não toca. O outro vermelho conhecido (o fluxo do n8n da fila do Tiny, instável — E-163/A-100) falhou numa das 4 rodadas e passou nas outras 3.
- **O bloco SESSAO-55: 130 ✔, 0 ✘.** As migrations aplicam duas vezes sem erro (e uma 3ª no bloco). A base antes desta sessão: 1.872 ✔ + os 2 conhecidos (o mesmo número do handoff da SESSAO-51).

### Telas

- `npm run lint`: limpo. `npx tsc -b`: limpo. `npm run build`: ok — **JS inicial 232,9 KB comprimidos em 8 arquivos (teto 250)**; o pedaço de cada tela tocada: Meu desempenho 2,5 KB · Afazeres 2,7 · Qualidade 2,9 · Pessoas 3,3 · Desligar o tempo 3,3 · API 3,7 · Caminhões 3,7 · Meu Painel 3,9 · Equipe 7,5 · Automações 19,0. (O "antes" do pacote não foi medido — a main não foi montada nesta mesa; a mudança é de poucas centenas de bytes por pedaço.)
- `npm test` (vitest), rodada completa final: **114 arquivos, 733 testes, todos verdes** (719 de antes + as 14 provas novas de `umaLeitura.test.tsx`). Uma rodada anterior, com a máquina carregada pela bateria e pelo ensaio, teve 12 estouros de 5 s em telas alheias — sozinhos e na rodada final, passam.

### Ensaio ×100 (PGlite em memória — teto, não média)

Volume: 300 pessoas · 300 mil cards (30 mil delegados) · 300 mil passagens · 87,6 mil tarefas (30 mil subtarefas) · 300 mil fatos · 3 mil visualizações · 300 metas · 100 mil entregas de webhook · 300 caminhões · 4.260 horários · 5 mil pausas · 302 automações · 600 etapas. Resultado inteiro: [[SESSAO-55 - ensaio x100 das portas de abertura (resultado, 2026-11-18).txt|resultado]] · programa: `dados/SESSAO-55 - ensaio x100 das portas de abertura (script, 2026-11-18).mjs`.

| Tela | Leituras antes | Antes — soma: mediana (máx.) | Depois — a porta: mediana (máx.) | Teto | Dentro? |
|---|---|---|---|---|---|
| Aviso do trabalho · a bolinha | 2 | 9,5 (12,2) ms | 9,9 (10,8) ms | 50 | ✅ |
| Aviso do trabalho · no Meu Painel | 4 | 20,3 (25,1) | 14,0 (19,5) | 50 | ✅ |
| Meu Painel abrindo (com a fila e as metas) | 6 | 95,7 (103,3) | 85,2 (95,9) | 150 | ✅ |
| Meus afazeres | 5 | 34,7 (43,2) | 18,5 (20,5) | 50 | ✅ |
| Pessoas · 7 dias, o dono, **com as metas** e as visualizações | 4 | 317,2 (379,5) | 303,5 (317,9) | 150 | ❌ (as metas) |
| Pessoas · 30 dias, o dono, só a tela | 2 | 6,3 (8,0) | 4,9 (5,2) | 150 | ✅ |
| Pessoas · 7 dias, o líder | 2 | 5,0 (6,1) | 3,7 (6,1) | 150 | ✅ |
| Qualidade · 7 dias | 4 | 10,1 (18,8) | 6,3 (6,5) | 150 | ✅ |
| Qualidade · 30 dias | 3 | 8,0 (9,0) | 3,3 (5,1) | 150 | ✅ |
| Meu desempenho · 7 dias | 3 | 307,2 (362,4) | 289,3 (322,1) | 150 | ❌ (o tempo em afazeres) |
| Meu desempenho · 90 dias | 3 | 1.308,7 (1.369,3) | 1.336,8 (1.407,7) | 150 | ❌ (idem) |
| Equipe | 2 | 25,6 (30,0) | 21,3 (23,8) | 50 | ✅ |
| API e integrações | 3 | 79,1 (94,1) | 72,0 (85,2) | 50 | ❌ (as entregas) |
| Caminhões | 2 | 6,8 (8,0) | 5,7 (8,9) | 50 | ✅ |
| Automações · a lista | 3 | 33,8 (44,0) | 26,8 (31,8) | 50 | ✅ |
| Controle de tempo · Desligar o tempo | 3 | 98,9 (109,4) | 95,2 (103,7) | 50 | ❌ (os horários) |

**Leitura honesta:** nenhuma porta nova ficou mais lenta que a soma das leituras de antes (a porta só as junta — o ganho é de viagens ao servidor, não de conta no banco). **11 das 16 medições cabem no teto; as 5 que não cabem já não cabiam antes** — o peso é de uma leitura antiga em cada uma, medida sozinha:
- **as metas** (`plt_fn_metas_painel`, 300 metas para o dono): 292 ms — o progresso de cada meta é calculado ao vivo;
- **o tempo em afazeres** (`plt_fn_meu_tempo_dias` e `plt_fn_meu_tempo_tarefas`): 152 + 154 ms em 7 dias, 717 + 671 ms em 90 dias (190 tarefas com tempo por pessoa);
- **as últimas entregas dos webhooks**: 79 ms — varredura inteira de `plt_webhook_entregas` (100 mil linhas) para ordenar por data; **falta o índice por data**;
- **os horários** (`plt_horarios_funcionamento`, 4.260 linhas): 95 ms e 759 KB — a lista inteira, sem página.

**Planos** (no resultado): as leituras que as portas fazem direto usam índice — tarefas abertas (`plt_tarefas_responsavel_idx`), cards delegados (`plt_cards_responsavel_idx`), tarefas do Sistema (`plt_tarefas_sistema_setor_idx`), contador de subtarefas (`plt_tarefas_mae_idx`), visualizações (`plt_visualizacoes_usuario_idx`). **Uma varredura em tabela que cresce:** `plt_webhook_entregas` (a mesma de antes — dívida abaixo). Listas pequenas de cadastro (pessoas, vínculos, caminhões, etapas, horários, pausas) são lidas inteiras, como antes.

**Tamanho da resposta** (teto 100 KB, ×100): trabalho 47–89 KB · painéis 0,1–11 KB · API 69 KB · Caminhões 33 KB · **Equipe 180 KB · Automações 187 KB · Desligar o tempo 759 KB** (as três são listas inteiras de cadastro, sem página — dívida abaixo).

### Checklist de desempenho (Lei §12)

- [x] **Nº de requisições:** cada tela tocada = 1 (teste de tela, 14 provas); nenhuma repetida sozinha.
- [x] **Busca no código:** nenhum `refetchInterval`, `setInterval` buscando dado ou `postgres_changes` nos arquivos tocados.
- [x] **Toda porta nova:** ensaio ×100 com plano — 11/16 dentro; o que ficou fora está em "Dívidas".
- [x] **Índices:** nenhuma chave nova; a leitura nova (contador de subtarefas) usa o índice que já existe. Advisors: **a conferir no banco vivo** (sem acesso).
- [x] **RLS:** nenhuma política nova; as portas usam `(select auth.uid())`.
- [ ] **Listas por cursor:** as listas de cadastro das telas de configuração seguem inteiras (dívida — fora do pedido).
- [x] **Pacote:** 232,9 KB (teto 250).
- [x] **Escrita idempotente / chamada externa:** não se aplica (só leitura).
- [ ] **Tablet/celular (INP):** não medido em aparelho (a mesa não abre a tela logada).
- [x] **Telas tocadas adequadas:** o que ficou fora está em "Dívidas".

---

# Para entrar nas notas depois da dieta

> As notas grandes não foram editadas nesta leva. Os números (D-NN, E-NN, A-NN, dívida NN) **não foram atribuídos** — outras mesas podem estar usando a mesma faixa; quem levar para as notas numera na hora. O último usado que esta mesa viu: D-334 · E-291 · A-243 · dívida 37.

## → [[PLT - Lei de Desempenho e Escala]] (§14)

**Dívidas pagas (total ou em parte):**
- **Dívida 20 — ✅ paga:** o aviso do trabalho da pessoa relê UMA porta (`plt_fn_meu_trabalho`) — a bolinha, o Meu Painel e os Meus afazeres leem a mesma resposta.
- **Dívida 18 — paga para:** Pessoas, Qualidade, Meu desempenho, Equipe, API e integrações, Caminhões, Automações; **Tempo por setor** (só redireciona desde a SESSAO-43 — já estava paga); **Controle de tempo** (as 7 abas já abriam com 1 leitura cada desde a SESSAO-42; o bloco "Desligar o tempo" foi de 3 para 1).
- **Dívida 18 — segue aberta para:** a configuração do Estoque (mexe com a reposição automática, que a mesa das rotinas pode tocar), Programação e Pedidos em aguardo (outra mesa — a nota de 16/10 diz que "Pedidos em aguardo" saiu), o Comercial (~10 leituras, os gráficos).

**Dívidas novas (achadas pelo ensaio ×100 — todas leituras que já existiam; a porta nova só as junta):**
1. **As metas com muitas metas** — `plt_fn_metas_painel` calcula o progresso de cada meta ao vivo: 292 ms com 300 metas (Pessoas e Meu Painel abrindo). **Caminho:** o progresso como projeção mantida no fato (M-13), ou a 1ª página de metas menor. *Quando:* a próxima que tocar as metas.
2. **O tempo em afazeres do Meu desempenho** — `plt_fn_meu_tempo_dias` e `plt_fn_meu_tempo_tarefas`: ~150 ms cada em 7 dias e ~700 ms em 90 dias com 190 tarefas com tempo por pessoa. **Caminho:** resumo por pessoa × dia mantido no gesto (como o `plt_tempo_resumo_pessoa_dia` da produção). *Quando:* a próxima que tocar o Meu desempenho.
3. **As últimas entregas dos webhooks** — `plt_webhook_entregas` ordenada por data **sem índice**: 79 ms com 100 mil linhas (varredura inteira). **Caminho:** `create index concurrently … on public.plt_webhook_entregas (criada_em desc, id desc)` — é mudança de esquema: precisa do OK do dono (não foi feita nesta leva). E plano de crescimento da tabela (limpeza do entregue antigo — Lei §7.5).
4. **Listas de cadastro sem página nas configurações** (Lei §6.1): a Equipe (180 KB com 300 pessoas), as etapas e as pessoas das Automações (187 KB), os horários do "Desligar o tempo" (4.260 linhas, 95 ms, 759 KB), os caminhões, as chaves e os webhooks. Hoje são pequenas. **Caminho:** página no servidor por cursor; no "Desligar o tempo", trazer só os horários de PESSOA (os de setor moram no editor do expediente — a tela filtra `escopo = 'usuario'` no navegador).
5. **Meus afazeres como 1ª tela do app = 2 requisições** (a abertura do app + a porta do trabalho); antes eram 4, a dos pedidos em cascata. **Caminho:** `plt_fn_abertura` ganhar o retrato dos afazeres (como já tem o do Meu Painel) — não foi feito porque é recriar a porta do login (E-103), fora do pedido.
6. **Os catálogos de etiquetas e de campos têm validade de 5 min**: em qualquer tela que os usa (Automações, quadros, PCP), com o app aberto há mais de 5 min a entrada na tela relê os dois. **Caminho:** validade infinita + invalidação por sinal (Lei §8), como os setores.
7. **Motivos e Visão do dia** (as outras telas de painel que usam as visualizações salvas) seguem lendo as visualizações numa leitura à parte, uma vez por sessão — não estavam na dívida 18 e não foram tocadas.

## → [[PLT - Decisoes de Produto]] (⏳ PROVISÓRIAS — confirmar com o dono)

1. **A porta de abertura junta, não reescreve:** cada porta nova chama as mesmas portas/tabelas que a tela lia (invoker, STABLE) — os números são os de antes por construção e nenhuma função viva foi recriada. *Alternativa descartada:* reescrever as contas dentro da porta (mais rápido no banco, risco de número diferente).
2. **O período dos painéis é resolvido no banco:** a tela manda só o que o endereço diz (dias, setor, visualização salva) e o banco aplica a mesma precedência (endereço > visualização salva de quem chama > 7 dias), com a hora do banco. Acaba a leitura em cascata com `?v=`. A visualização de outra pessoa não vale; período inválido cai no padrão; teto de 3.660 dias.
3. **O guardado dos painéis vale 30 s pelo endereço:** a chave do cache passou a ser o que o endereço diz, não o instante — voltar à tela em menos de 30 s reaproveita (antes relia sempre, porque a chave levava a hora).
4. **O trabalho da pessoa é uma chave só, e a porta traz só o que a tela aberta mostra** (a bolinha: tarefas e execuções; o Meu Painel: + cards delegados e tarefas do Sistema; os Meus afazeres: + cards, contador de subtarefas e número dos pedidos). A fila de prioridade e as metas só vêm quando o Meu Painel abre sem elas guardadas — o aviso não as relê.
5. **O "2/5" das subtarefas vem contado do banco** (Lei §3.4) — os Meus afazeres deixam de baixar todas as subtarefas; o checklist inteiro segue vindo no clique (a janela da tarefa).
6. **O número do pedido dos cards vem na mesma porta** (até 100 pedidos; acima disso, o resto pela leitura de sempre).
7. **As metas de Pessoas ganham chave própria no cache** (`['metas', 'painel-pessoas', página]`): Pessoas mostra 10 por página e o Meu Painel 20, e as duas dividiam a mesma chave (E-22 — uma podia mostrar a página da outra).
8. **API e integrações: uma chave só** — cada gesto e o "Atualizar" releem as três listas numa chamada (antes o "Atualizar" relia só as entregas).
9. **Subida: banco antes do site, no mesmo gesto.** As migrations só criam função (o site de hoje nem as chama); o site novo precisa delas — sem caminho de reserva para o banco velho.
10. **Fora desta leva, de propósito:** índice novo (webhooks), paginação das listas de cadastro, mexer na porta do login.

## → [[PLT - Memoria de Aprendizado]]

**Acertos / padrões (A-NN):**
- **Porta de abertura que semeia:** a porta traz os pedaços com vida própria no cache só quando faltam (`faltaNoCache`), guarda com a chave e o formato de sempre (E-22) e a consulta do pedaço liga só depois da porta (`enabled`), **com validade infinita** — quem decide renovar é a porta. Molde: `src/lib/semear.ts` + `abrirPessoas`.
- **Um retrato por tela na mesma chave:** `useMeuTrabalho(recorte, tela)` — o retrato diz para qual tela foi lido; a tela que acha o retrato de outra pede o dela (1 leitura).
- **Provar "igual ao de antes" no banco:** `select (porta -> 'pedaço') is not distinct from (leitura antiga)` numa chamada só, como `authenticated`, pessoa por pessoa; `now()` é o mesmo na transação — o período se confere ao microssegundo.
- **Teste de tela que conta chamadas:** dublê de `supabase` que grava `rpc` e faz `from` estourar; o cache nasce como o app deixa (setores, etiquetas, campos, validade de 30 s) — `src/paginas/umaLeitura.test.tsx`.
- **Ensaio ×100 que se monta sozinho:** carrega o esquema + todas as migrations, reusa o `semear` da SESSAO-47 e mede antes × depois; fora do teto, mede leitura por leitura (diz qual pesa).

**Erros (E-NN) e a correção:**
- Programa com aspas em heredoc do shell quebra (E-45 de novo) → gravar em arquivo e rodar.
- Argumento novo na FRENTE de uma função que o teste troca por dublê muda o que o dublê recebe → argumento novo vai no fim.
- Consulta semeada com validade curta relê sozinha quando a tela volta (a porta responde do cache; a dependente está vencida) → validade infinita no pedaço semeado.
- `jsonb -> 'chave'` de valor nulo é o nulo do JSON, não NULL → `nullif(…, 'null'::jsonb)` na comparação.
- Fato de "iniciar" com hora anterior à chegada da peça não abre execução (a posição vem do último fato) — a comparação passava vazia dos dois lados → conferir que o cenário tem dado (um ✔ de "tem número de verdade" ao lado do "igual").
- Ensaio fora da bateria sem os grants que o Supabase dá por padrão ao `authenticated` → repetir o bloco 78 (esquema `auth` e leitura de `public`, menos `plt_usuarios`).
- Vitest completo com a máquina carregada: estouros de 5 s em telas alheias → repetir o arquivo sozinho antes de culpar a mudança.

## → [[SUPA - Esquema do Banco]]

9 funções novas em `public` (todas `returns jsonb`, `security invoker`, `stable`, execução só para `authenticated`); **nenhuma tabela, coluna, índice, política ou gatilho**:
`plt_fn_meu_trabalho(text, boolean)` · `plt_fn_dash_pessoas_abertura(numeric, bigint, boolean, bigint, boolean, boolean, integer)` · `plt_fn_dash_qualidade_abertura(numeric, bigint, boolean)` · `plt_fn_meu_desempenho_abertura(numeric, integer)` · `plt_fn_equipe_abertura()` · `plt_fn_api_abertura()` · `plt_fn_caminhoes_abertura(boolean, boolean)` · `plt_fn_automacoes_abertura(bigint, integer, integer, boolean, boolean)` · `plt_fn_tempo_desligar_abertura()`.
Migrations: `20261118130000_plt_meu_trabalho_numa_leitura.sql` · `20261118130100_plt_dashboards_numa_leitura.sql` · `20261118130200_plt_configuracoes_numa_leitura.sql` — **não aplicadas**.

## → [[000 - MAPA DO PROJETO]] · [[000 - ORDEM DAS SESSOES]] · Próximos passos

- Linkar a demanda [[SESSAO-55 - Telas que Abrem com Uma Leitura Dashboards Configuracoes e Meu Painel]], este diário e o handoff `handoff_2026_11_18_sessao55_telas_numa_leitura`.
- Estado: código e migrations **no ramo `sessao-55-telas-numa-leitura`**, nada na main, nada aplicado.
