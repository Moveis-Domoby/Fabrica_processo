---
titulo: "Memória de aprendizado — Desempenho e Tempo Real"
tipo: memoria-tema
tema: desempenho
atualizado: 2026-11-18
tags: [memoria, aprendizado, tema/desempenho]
---

# 🧠 Memoria - Desempenho e Tempo Real

> Lições deste tema, movidas de [[PLT - Memoria de Aprendizado]] em 18/11/2026 sem reescrever. Entrada nova entra **aqui**, na seção do tipo dela, com o id no título (`### E-NNN`); o próximo número livre está no índice.

## 🔴 Erros e correções (E-NN)

### E-53

- [2026-09-28] **E-53** (Claude Code) · Medido ao vivo: criar canal relia a lista de conversas **duas vezes** — a tela chamava `resetQueries` e o sinal "entrou" do websocket (que o criador também recebe) chamava de novo; idem na 1ª mensagem de uma conversa nova → **correção:** a tela não relê; quem avisa é o sinal (uma fonte só). **Lição ([[Memoria - Modelos Formulas e Possibilidades#M-4|M-04]] aplicado a atualização): quando o websocket já avisa a própria pessoa, a tela não relê por conta própria — e contar requisições ao vivo acha o que o teste unitário não acha.**

### E-65

- [2026-09-28] **E-65** (Claude Code, ajuste do Frete) · Pus a regra "frete não é unidade" numa cadeia de funções pequenas (`fn_unidades_do_pedido` → `fn_unidades_do_item` → `fn_eh_frete` → `fn_normalizar_texto`), todas com `set search_path` (regra da casa) — e **função com SET nunca é embutida pelo planner**: cada item de cada pedido pagava 3 chamadas. O harness passou verde (PGlite não mede tempo), mas o **ensaio no banco real com EXPLAIN ANALYZE** mostrou a aba Pedidos em aguardo de 5 → 245 ms no servidor, o painel do dia de 8 → 193 ms, e a soma dos 242 pedidos de 1 → 51 ms → **correção:** a regra por item foi para a VIEW `plt_privado.vw_itens_producao` (embutida pelo planner, sem custo de chamada), com uma regex ancorada no começo da descrição; função com SET só nos gestos (lançar, entregar, recalcular). Medido de novo: aguardo ~4 → ~7,5 ms, painel ~5 → 7–19 ms, busca em todos os pedidos ~41 → ~57 ms. **Lição: regra que roda por LINHA em porta que varre muitas linhas não mora em função com SET — mora em view ou expressão; e medir no servidor (EXPLAIN ANALYZE antes/depois, em transação desfeita) faz parte do ensaio de toda migration que troca contagem.**

## 🟢 Acertos que viraram padrão (A-NN)

### A-37

- [2026-09-28] **A-37** (Claude Code, ajuste do painel do PCP) · **Medir a porta nova no banco real sem DDL nenhum:** `EXPLAIN (ANALYZE)` do CORPO da função (antigo e novo) como SELECT puro, só leitura — sem `create or replace` dentro de transação desfeita, logo sem a trava que o ensaio do [[Memoria - Migrations Aplicador e Ensaio 1#E-66|E-66]] segurou. Rodar cada um duas vezes: a 1ª execução fria enganou (133 ms × ~5,5 ms quente). Serve quando a função é SQL e o gate (usuário) pode ficar de fora da medição; para provar o gate, ensaio [[Memoria - Testes e Validacao ao Vivo#A-11|A-11]] depois de aplicar.

### A-16

- [2026-09-21] **A-16** (Claude Code) · **Lei de requisição na prática (S22/D-48):** coluna de quadro paginada com UMA consulta por (coluna, página) via `useQueries`, com `count: 'exact'` na PRÓPRIA consulta paginada — o total sai de graça, sem endpoint de contagem; e filtro de tela ("pedidos abertos") vira **projeção no banco** (`liberado_completo_em`), nunca filter sobre download completo. Padrão registrado no Modelo de Sistema.

### A-17

- [2026-09-21] **A-17** (Claude Code) · **Dado que se resolve na ESCRITA fica coerente em todo lugar:** a etapa fila preenchida por trigger BEFORE no próprio evento (em vez de só na projeção) deixou views, linha do tempo e projeção contando a mesma história sem retrabalho — regra derivada no INSERT > regra derivada em N leitores ([[Memoria - Modelos Formulas e Possibilidades#M-4|M-04]] aplicado a evento).

### A-67

- [2026-10-16] **A-67** (Claude Code, SESSAO-32, teste de carga) · **Aviso que muita gente ouve = manada; espalhar com sorteio.** Trocar relógio por websocket corta o volume (40 pessoas: 1.265 → 301 requisições; ×10: 13.269 → 3.331), mas o teste ×10 mostrou o efeito novo: a cada card que muda, TODAS as Visões do dia e PCPs abertos releem no mesmo instante (p50 da Visão do dia 417 ms, do PCP 2,6 s sob a manada). Correção barata e padrão de mercado: a tela espera mais um sorteio (`espalharMs` no `useAoVivo`; 0,7 s no quadro do setor) — a mesma releitura, espalhada; quem fez o gesto já vê na hora (a própria tela relê). O passo seguinte, quando precisar: o aviso levar o dado que mudou (sem releitura) ou a leitura pesada virar projeção pronta.

### A-85

- [2026-10-21] **A-85** (Claude Code, SESSAO-38 cards) · **Paginação por cursor em QUALQUER ordem do servidor: o cliente manda só o id do último card; o banco recalcula as chaves dele.** As chaves de ordem moram numa VISÃO (embutida pelo planejador — [[Memoria - Desempenho e Tempo Real#E-65|E-65]]), cada modo vira a mesma tupla `(k1, k2 collate "C", k3, k4, id)` e o corte é `(…) > (select … from corte)` — a mesma porta serve prioridade, entrega e alfabética, sem offset e sem repetir/pular (provado 2 + 2 + 1 na bateria). Texto de ordem com `collate "C"` sobre o nome normalizado = ordem estável (letras → números → resto por um prefixo de classe).

### A-98

- [2026-10-21] **A-98** (Claude Code, SESSAO-38 · F5) · **Relógio que respeita o horário do setor sem custar requisição:** a régua (horários + pausas de setor, ~2–4 KB) vem na abertura do app e fica em cache (`['regua-tempo']`, sem prazo de validade); um motor puro no aparelho (`src/kanban/tempoUtil.ts` — janelas por dia no fuso fixo da fábrica, interseção/subtração de intervalos) calcula o tempo útil de cada card a cada minuto; o "não conta" (stand-by) e o "conta sempre" (hora extra) entram como listas de intervalos. Sem a régua (banco antigo), o relógio corrido de sempre. Calcular por card no banco (a `fn_tempo_util` com laço por dia e `SET`) custaria por linha em toda porta de quadro ([[Memoria - Desempenho e Tempo Real#E-65|E-65]]).

### A-113

- [2026-10-23] **A-113** (Claude Code, SESSAO-40) · **"Número que começa com" + "o mais novo primeiro" + página pequena = andar as faixas do maior para o menor e PARAR quando enche.** As faixas `[x·10^k, (x+1)·10^k)` são disjuntas e crescentes em k; percorrendo k de cima para baixo, cada uma por `order by numero desc limit (o que falta)` com o cartão juntado pelo índice de `pedido_id`, o executor para cedo — "12" (11 mil pedidos ×100) foi de 211 ms (montar tudo e ordenar) para 10 ms; a página seguinte (cursor recalculado do último) 5 ms. Em `plpgsql`, um laço `for … reverse` com `exit when` cheia.

### A-118

- [2026-10-27] **A-118** (Claude Code, SESSAO-41) · **Regra de tempo SEM relógio:** a carência de 15 min e a saída de 1 h são derivadas na LEITURA (o estado de agora e as partes do trecho aberto vêm de uma função pura) e GRAVADAS no próximo fato da pessoa, no instante certo (no passado). A tela anda com o relógio de tela (`useAgora`) — nada é buscado de novo.

### A-136

- [2026-11-04] **A-136** (Claude Code, SESSAO-44) · **Medir função nova no banco real sem criá-la:** recortar o corpo da migration, trocar o parâmetro pelo valor, e rodar `explain analyze` numa sessão só-leitura **aquecida** (6 execuções antes da medida). A 1ª chamada numa conexão nova custa 4–5× (8 ms × 2 ms) — medir frio engana. Função `language sql` que não vira inline replaneja a cada chamada; `plpgsql` + `return query` guarda o plano.

### A-141

- [2026-11-05] **A-141** (Claude Code, SESSAO-45 · ajuste) · **Ponto pelo CEP (para o degrau da busca):** o serviço gratuito `cep.awesomeapi.com.br/json/<cep>` devolve lat/lng do CEP — na amostra do cache, a mediana a 217 m do ponto de rua (p90 ~800 m) —, mas **limita o uso** (HTTP 429 depois de ~38 consultas seguidas): serve como degrau (poucos endereços por dia), nunca para varrer o cache. A BrasilAPI v2 tem as coordenadas **inúteis** (mediana a 5,5 km) — boa só para nome de rua/bairro. O CEP digitado errado existe: o ponto do CEP só vale com a cidade igual e a rua OU o bairro do CEP batendo com o pedido.

### A-208

- [2026-11-09] **A-208** (Claude Code, SESSAO-47) · **Vitrine, parte 2 — tela cuja chave de cache tem datas que ela mesma calcula:** em vez de adivinhar a chave, o cache responde pelo COMEÇO dela (`queryCache.subscribe` no evento `added` → `setQueryData` na hora; com `staleTime` infinito a tela nem tenta buscar). Para os estados de formulário: `?digita=` (campo de data, pelo setter nativo + evento `input`), `?arquivos=N` (escolhe N arquivos no campo de arquivo por `DataTransfer`), `Texto#2` (o 2º botão que casar) e `?rola=<seletor>`. A janela num estado do meio (2 enviados, 1 falhou) se monta direto com o estado pronto.

### A-250

- [2026-11-18] **A-250** (Claude Code, SESSAO-53) · **Regra por linha em porta de lista = visão embutida, não função SQL com `from`** (a função replaneja a cada chamada). Medir em escala 1 antes do ×100 — o plano já mostra.
