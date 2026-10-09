---
titulo: "PLT — Lei de Desempenho e Escala"
tipo: regras
data: 2026-10-07
atualizado: 2026-10-07
origem: pedido do dono em 07/10/2026 — "TODAS as rotas devem estar otimizadas ao EXTREMO", pesquisado no Cowork (práticas de plataformas de grande escala + documentação oficial da Supabase, web.dev, TanStack, Stripe, AWS) e auditado no código e no banco (só leitura)
tags: [plataforma, regras, desempenho, escala, banco, front, tempo-real, claude-code]
---

# ⚡ PLT — Lei de Desempenho e Escala

> [!danger] O princípio (palavras do dono, 07/10/2026)
> *"Sempre buscar a solução mais otimizada possível no padrão de mercado … plataformas gigantes que rodam para milhares de usuários extremamente rápido utilizam métodos que o Claude Code pode optar por não utilizar por ser mais difícil, porém é melhor do que a plataforma caindo no futuro. TODAS as rotas devem estar otimizadas ao EXTREMO, coisa de uma única requisição na primeira abertura, se possível; a arquitetura do banco deve estar impecável também."*
>
> **Tradução para o Claude Code:** construa como se a plataforma tivesse **10 mil usuários amanhã**. **"É mais difícil" nunca é motivo para escolher o caminho que não escala.** Atalho só com o OK do dono, registrado como D-NN (§13).

Esta lei é **leitura obrigatória em toda sessão** (regra 18 do [[CLAUDE - Regras do Claude Code (repo)]]) e **evolui a regra 17** ("cada tela requisita só o que mostra"), que continua valendo.

---

## 1. Os orçamentos — os números que mandam

| O quê | Teto | Hoje (07/10) |
|---|---|---|
| **Primeira abertura do app** (logado, cache vazio) | **1 requisição de dados** + o websocket pessoal | ~13 requisições, algumas em cascata |
| **Abrir uma tela** | **1 requisição** (a porta da tela) | 2 a 7 por tela |
| **Abrir aba, modal, gaveta, detalhe, "Ver mais"** | **1 requisição por clique** | em geral ok (regra 17) |
| **Requisições que se repetem sozinhas** | **0** (nada de relógio) | 35 relógios de 15 a 60 s em 15 telas |
| **Porta de tela no banco** (RPC/consulta) | **p95 ≤ 50 ms**; painel agregado ≤ 150 ms; nenhuma > 300 ms — medido com volume **×100** | estoque 1,1–1,6 s (máx. 3,9 s); comercial até 4,3 s |
| **Gesto de escrita no banco** | ≤ 100 ms; a tela responde **na hora** (otimista) | — |
| **Tempo real** (fato no banco → tela) | ≤ 300 ms | chat mediu 167 ms ✅ |
| **Front — Core Web Vitals no p75** (tablet/celular do galpão, 4G) | **LCP ≤ 2,5 s · INP ≤ 200 ms · CLS ≤ 0,1** | não medido |
| **JS inicial** (comprimido) | **≤ 250 KB**; cada tela num pedaço próprio | pacote único de **1,8 MB** sem comprimir; só a Programação separada |
| **Página de lista** | ≤ 50 itens (teto no banco: 100); resposta ≤ 100 KB | — |

> Número fora do teto = **não está pronto**. Medir é parte da entrega (§12).

---

## 2. Primeira abertura — uma requisição

1. **Porta de abertura** (uma RPC): devolve numa chamada só **tudo o que a primeira tela mostra** — perfil, setores/vínculos, permissões, menu, contadores do sino e do chat, a bolinha de execução e os dados do Meu Painel. Hoje são ~13 chamadas (perfil → vínculos **em cascata**, setores, sino, chat, bolinha ×2, painel ×4, presença…).
2. **Sessão sem rede:** o token já está no aparelho; permissões vêm **dentro do token** (§5) — nada de "quem sou eu?" ao banco a cada tela.
3. **Nada em cascata (waterfall):** proibido "busca A, depois busca B com o resultado de A" no navegador. Juntar no servidor, numa porta só. Consultas independentes da mesma tela saem juntas ou, melhor, viram uma porta só.
4. **Uma porta por tela, não uma por componente:** os pedaços da mesma tela leem a mesma resposta (o `select` do TanStack Query recorta o que cada um precisa).
5. HTML, JS, CSS e fontes vêm da CDN (Vercel) com cache eterno por nome com hash — não tocam o banco, mas entram no orçamento de peso (§9).

## 3. Requisição só no clique — o que a tela não mostra, ela não pede

1. **Dado escondido não é buscado:** aba, modal, gaveta, detalhe, popover, "Ver mais" — buscam **no clique**, nunca antes; dado pesado é **esquecido ao fechar** (D-89).
2. **Código pode adiantar, dado não:** ao passar o mouse/focar um link, pode-se pré-carregar o **pedaço de JS** da tela (não toca o banco). Dado do banco, só no clique.
3. **Busca enquanto digita:** espera 300 ms parado, mínimo 2 letras, cancela a anterior, limite de resultados no servidor.
4. **Contadores e números de resumo** vêm prontos do banco (projeção/contador — §7.1), nunca contando lista no navegador.

## 4. Tempo real — empurrar, nunca perguntar de tempo em tempo

**A ordem de escolha:**

1. **Websocket — Supabase Realtime _Broadcast_ em canal PRIVADO** (o padrão da casa; o chat já é assim — D-67). O banco avisa por gatilho (`realtime.send` / `realtime.broadcast_changes`) num **tópico estreito** (`setor:{id}`, `usuario:{id}`, `card:{id}`, `pedido:{id}`); a tela aplica o que veio no cache ou relê **só a parte afetada**.
2. **Long polling ou SSE** — só onde websocket for impossível (ex.: um terceiro que não fala socket) e com o OK do dono.
3. **Polling por intervalo (`refetchInterval`, `setInterval` buscando dado) — PROIBIDO.** Exceção só com D-NN do dono e: intervalo adaptativo, parado com a aba oculta, nunca abaixo de 60 s.

**Regras do websocket:**
- **`postgres_changes` é PROIBIDO em código novo** — a própria Supabase manda usar Broadcast porque o Postgres Changes roda numa linha só e não escala. Hoje 3 telas (Meu Painel, tablet, Visão do dia) escutam a **tabela de cards inteira, sem filtro**: toda mudança em qualquer card faz **todas** as telas abertas relerem, e a leitura do log do banco que isso causa é **a consulta que mais consome o banco** (233 mil execuções).
- Tópico estreito por escopo; evento `entidade_acao` (`card_movido`, `mensagem_criada`); **payload mínimo** (id + o que mudou).
- **Um canal por tópico, reaproveitado** — o modelo é `src/chat/canais.ts`; **sai do canal ao fechar** a tela; trata `SUBSCRIBED`, `CHANNEL_ERROR`, `TIMED_OUT`, `CLOSED`.
- **Assina antes de ler** (nada escapa entre ler e ouvir — lição do chat).
- **Reconexão:** o cliente volta sozinho com espera crescente; ao voltar, faz **uma** leitura de recuperação "desde o último id/horário" (cursor) — nunca recarrega tudo.
- **Canais só privados:** política RLS em `realtime.messages` com índice nas colunas que a política usa; ligar "só canais privados" no projeto.
- **Presença** (quem está online) pela Presence do Realtime ou carimbo no gesto — não por gravação a cada 5 min.

**No banco também — nada de relógio que acorda para ver se tem trabalho.** O trabalho nasce do fato (gatilho → fila → chamada). Relógio só para o que é **de calendário** (parabéns às 08:00, recálculo de madrugada, vencimento por dia útil, conferência das 3h). D-80 já vetava relógio à toa. Hoje acordam **a cada minuto**: reservas do estoque (65 ms × 1.440/dia), despacho de webhooks, disparo do comercial; fotos a cada 5 min.

## 5. Sessão e autenticação — sem ir ao banco quando está tudo certo

1. **Token curto, renovado sozinho enquanto a pessoa usa** (o `supabase-js` renova com o refresh token); sessão **inativa** expira (configurar o tempo de inatividade no Auth). Nada de "renovar a cada X minutos" com relógio próprio.
2. **Chaves de assinatura ASSIMÉTRICAS** (JWT Signing Keys) ligadas no projeto → o token é **verificado localmente** com a chave pública em cache (JWKS): no navegador **`getClaims()`**, nunca `getUser()` por tela; nas Edge Functions, verificação local (`getClaims` ou `jose` com a JWKS) — **sem chamar o servidor de Auth por requisição**. (Com chave simétrica, o `getClaims()` chama o servidor — por isso a troca de chave é pré-requisito.)
3. **Permissões DENTRO do token** (Custom Access Token Hook): id do usuário da plataforma, papel, super admin, setores, módulos (fábrica/comercial — D-91), ativo. Políticas e portas leem do token (`auth.jwt()`), **sem consultar `plt_usuarios` a cada chamada** — hoje `fn_eh_admin`, `fn_setores_do_usuario` e `fn_usuario_atual` consultam a tabela toda vez.
4. **Mudou papel/setor ou desativou alguém** → força a renovação do token (o hook roda na renovação e recusa quem está inativo); para corte imediato em escrita sensível, uma checagem curta de revogação **só no gesto**, nunca na leitura.
5. Perfil completo vem **uma vez** (porta de abertura) e só é relido por sinal ("seu perfil mudou").

## 6. Paginação em tudo que pode crescer

1. **Toda lista que pode passar de 50 itens algum dia** pagina **no servidor** — inclusive as que hoje são pequenas (pessoas, caminhões, etiquetas, automações).
2. **Cursor (keyset) é o padrão** para lista que cresce sem fim (eventos, histórico, auditoria, mensagens, avisos, pedidos, cards de um setor, execuções): `where (ordem, id) < (:ultimo_valor, :ultimo_id) order by ordem desc, id desc limit :n`, com **índice composto** nessas colunas — continua rápido na página 1.000 e não pula/repete item quando entra coisa nova. **Deslocamento (offset)** só em lista pequena e limitada onde "pular para a página 7" é necessário (ex.: Top X). Hoje ~20 portas usam deslocamento.
3. **Teto no banco:** a porta recusa página maior que 100.
4. **Total** só quando a tela mostra o número; em lista enorme, estimado ("mais de 1.000").
5. **Lista longa na tela = rolagem virtual** (`@tanstack/react-virtual` já está no projeto).

## 7. Banco — arquitetura impecável

### 7.1 Modelagem
- **Fato é evento append-only** (RNF-05); **o que a tela lê é projeção** mantida no mesmo gesto (M-13) — a tela nunca reconstrói estado varrendo eventos.
- **Leitura pesada e repetida vira projeção pronta** (coluna, tabela-resumo por produto/setor/pedido, ou view materializada atualizada por evento) — nunca agregação ao vivo sobre tabela que cresce a cada abertura de tela. Ex.: os números do estoque hoje levam **1,3–1,6 s por chamada com só 4 mil cards**; o caminho é uma tabela-resumo por produto mantida por gatilho.
- **Um dono por regra** (M-04). Tipos certos (`timestamptz`; `numeric` para dinheiro; `check`/enum para estado). Campo que vira filtro **não** mora dentro de JSON.
- Chave estrangeira **sempre** com índice.

### 7.2 Índices
- Toda coluna de **filtro, junção, ordenação e de política RLS** tem índice; **composto** na ordem filtro → ordenação; **parcial** para o recorte usado (ex.: `where arquivado_em is null`); **cobrindo** (`include`) quando a tela lê poucas colunas; **BRIN** para data que só cresce em tabela enorme.
- **Nada duplicado nem sem uso** (hoje: 33 chaves estrangeiras sem índice, 2 índices duplicados, 18 sem uso — advisors da Supabase).
- **`EXPLAIN (ANALYZE, BUFFERS)` de toda porta nova ou tocada**, com volume simulado **×100**; sem varredura sequencial em tabela que cresce; plano anexado na execução da sessão.
- **Estatísticas certas:** conferir que o planejador sabe o tamanho real das tabelas — hoje ele acha que `plt_eventos` tem **4** linhas (tem 4.706) e `plt_logs_atividade` **106** (tem 7.185), e escolhe caminhos ruins por isso.

### 7.3 RLS rápida (medições da Supabase: de 100× a 10.000× mais rápido)
- **Função e `auth.*` na política sempre embrulhadas em `(select …)`** — vira uma conta por consulta, não por linha (ex.: `is_admin()` foi de 11.000 ms a 7 ms). Hoje a política de leitura dos cards chama a função de admin **sem** embrulho.
- Política com **`TO authenticated`**, nunca `public`.
- **Uma política permissiva por ação e papel** (hoje 9 tabelas têm duas — as duas rodam em toda consulta).
- Busca em outra tabela: função `security definer` em esquema privado, embrulhada, e comparação **`= any(array(select …))`** — nunca subconsulta correlacionada; coluna da comparação indexada.
- A consulta **também filtra explicitamente** (não depende só da RLS para recortar).

### 7.4 Portas e consultas
- **Uma porta (RPC) por tela**, que devolve **exatamente** o que a tela mostra — colunas nomeadas, nunca `select *`; `STABLE` quando só lê; **sem N+1** (laço que consulta por linha); sem função por linha no `where`.
- **`statement_timeout` próprio** nas portas de tela (o do papel autenticado é 8 s — porta de tela tem que caber em 1 s; se não cabe, o desenho está errado).
- **Escrita em lote numa transação só** (a liberação do PCP hoje é um laço no navegador — SESSAO-30 corrige).
- Trabalho que não precisa estar pronto na resposta vai para **fila** (Supabase Queues/pgmq ou a fila da casa), processado em lote, com nova tentativa e lugar para o que falhou.

### 7.5 Crescimento
- Tabela que só cresce (eventos, logs, execuções de automação, mensagens, `tiny_fila`, histórico do cron) **nasce com plano de crescimento**: índice por data, **partição por mês** quando passar de alguns milhões de linhas (pg_partman), e **limpeza** do que é ruído — o histórico do cron já tem **30 MB** e não para de crescer.
- `pg_stat_statements` conferido no fim de toda sessão: nenhuma porta nova no topo.

### 7.6 Migrações sem derrubar nada
- **Expandir → migrar → contrair:** coluna nova nasce nula; preenche em lotes; depois a regra; só então remove o velho (apagar coluna/dado só pedindo — regra 3).
- Índice em tabela grande: **`create index concurrently`** (fora de transação).
- **`set lock_timeout = '5s'`** nas migrações; `check` novo como `not valid` + `validate` separado (E-19).
- Aplicar banco e publicar telas é **um gesto só** (E-73); a tela nova tolera o banco velho por alguns minutos.

### 7.7 Conexões
- O navegador só fala com o banco pela API (PostgREST/Realtime). Edge Functions e n8n usam o **pooler (Supavisor) em modo transação**; nada de conexão longa parada.

## 8. Cache — o que já foi lido não se lê de novo

- **TanStack Query:** `staleTime` pela natureza do dado — referência (setores, etiquetas, campos, catálogo): horas ou `Infinity` com invalidação por sinal; tela de trabalho: `Infinity` + websocket. **Sem `refetchInterval`, sem `refetchOnWindowFocus`.**
- **Invalidação cirúrgica** pela chave do que mudou (o sinal do websocket diz o quê) — nunca "invalida tudo".
- **Escrita otimista:** a tela muda na hora e desfaz se o banco recusar.
- **Dado de referência com versão:** a porta de abertura manda a versão; o cliente só relê quando ela mudou.
- **Estáticos com hash:** cache eterno (`immutable`) na CDN; `index.html` sem cache.
- **Imagens do storage:** link com cache longo; **miniatura no tamanho exibido** (transformação de imagem do storage) — nunca a foto original numa lista.

## 9. Front-end — rápido no tablet do galpão

- **Código dividido por rota** (`React.lazy` em toda tela) e bibliotecas pesadas (gráficos, mapa, canvas das automações, Comercial, leitor de planilha) **só no pedaço que usa**; **teto de pacote checado no build** (falha acima do teto).
- Importar só o que usa (ícones e funções de data um a um).
- **Lista longa virtualizada**; cartões em `memo`; estado perto de onde é usado; nada recalcula a lista inteira a cada tecla; trabalho pesado fora do clique (`startTransition`/Web Worker) — **INP ≤ 200 ms**.
- **Imagens:** espaço reservado (sem pulo de layout), `loading="lazy"`, WebP/AVIF, no tamanho exibido.
- **Fontes:** só o subconjunto latino, `font-display: swap`, pré-carregar a principal.
- **Medição real no aparelho** (Web Vitals / Speed Insights da Vercel) — vale o p75 dos tablets.

## 10. Escritas, integrações e falhas

- **Todo gesto de escrita é idempotente:** chave de idempotência por gesto — o clique repetido, a rede que cai e volta, o aviso do Tiny que chega duas vezes → **um efeito só** (padrão Stripe).
- **Toda chamada externa** (Tiny, n8n, serviço de rotas, buscador de endereço, WhatsApp) com **tempo limite**; nova tentativa **só se for idempotente**, com **espera crescente e sorteio (jitter)**, limite de tentativas e **numa camada só**; **disjuntor**: serviço fora → para de chamar por um tempo e mostra o aviso (como a rota tracejada da D-108).
- A falha de terceiro **nunca derruba o gesto** do usuário (a fila guarda e tenta depois — D-103).
- **Limite de uso por pessoa** nas portas caras (busca, relatório, exportação) — o banco recusa o excesso.
- **Degradação elegante:** sem websocket, a tela avisa "ao vivo pausado" e oferece **"atualizar"** (um clique = uma leitura) — nunca liga um relógio.

## 11. Medir para não adivinhar

- Toda porta nova: média e máximo no `pg_stat_statements` conferidos no fim da sessão.
- Erro de front e de Edge Function registrado com contexto (sem dado pessoal).
- Alerta de falha nas automações do n8n (pendência P1).
- **Teste de carga antes da publicação definitiva** (SESSAO-08): 30 tablets + 10 escritórios ao mesmo tempo, com **folga ×10**.

## 12. Checklist de desempenho — entra no checklist final de TODA sessão

- [ ] **Aba Network:** primeira abertura e cada tela tocada — nº de requisições dentro do orçamento (§1); **zero** repetidas sozinhas.
- [ ] **Busca no código:** nenhum `refetchInterval`, `setInterval` buscando dado ou `postgres_changes` novo; os da tela tocada foram removidos.
- [ ] **Toda porta nova/tocada:** `EXPLAIN (ANALYZE, BUFFERS)` com volume ×100, sem varredura sequencial em tabela que cresce, dentro do teto (§1) — plano na execução.
- [ ] **Índices** de chave estrangeira, filtro, ordenação e RLS cobertos; advisors de desempenho **sem item novo**.
- [ ] **RLS** com `(select …)`, `TO authenticated`, uma permissiva por ação.
- [ ] **Listas** por cursor (ou deslocamento justificado); teto de página no banco.
- [ ] **Pacote:** tamanho do JS inicial e do pedaço da tela, antes/depois, no handoff.
- [ ] **Escrita idempotente;** chamada externa com tempo limite, espera crescente com sorteio e disjuntor.
- [ ] **Tablet/celular:** nenhuma travada perceptível na tela tocada (INP).
- [ ] **Telas tocadas adequadas** — o que ficou fora da lei está registrado como dívida no §14, com o porquê.

## 13. Exceções

Atalho que fere esta lei **só com o OK do dono**, registrado como **D-NN** com o motivo e a sessão que vai pagar a dívida. Nunca em silêncio. **"É mais difícil" não é motivo.**

## 14. Retrato de 07/10/2026 — as dívidas de hoje (lido no código e no banco, só leitura)

| # | Dívida | Onde | Quem paga |
|---|---|---|---|
| 1 | **35 relógios** de 15 a 60 s em 15 telas | sino, bolinha de execução, Meu Painel, Afazeres, PCP, quadros (cada coluna), tablet, Visão do dia (7), Pedidos em aguardo, Expedição, Danificados, Estoque (Top X), Painel admin do estoque, ROTAS | telas tocadas pela 30/31; o resto a 32 |
| 2 | **`postgres_changes` na tabela de cards inteira, sem filtro** — a consulta que mais consome o banco | Meu Painel, tablet, Visão do dia | 32 (31 se tocar o quadro) |
| 3 | **~13 requisições na primeira abertura**, perfil → vínculos em cascata | casca do app | 32 |
| 4 | **Pacote único de 1,8 MB**; só a Programação separada | build | 32 |
| 5 | **Portas lentas com volume pequeno:** resumo do estoque 1,6 s (máx. 3,5 s), lista do estoque 1,3 s (máx. 3,9 s), configurações 1,1 s, resumo da reposição 0,4 s; comercial: clientes consolidados 1,1 s, filtro de clientes até 4,3 s, painéis 0,5–1 s; gravação do pedido do Tiny 0,85 s (máx. 3,7 s) | estoque, comercial, integração | 32 (30 nas portas de estoque que tocar) |
| 6 | **Relógios do banco a cada minuto** (reservas do estoque, despacho de webhooks, disparo do comercial) e fotos a cada 5 min | pg_cron | 32 |
| 7 | **Permissão consultada na tabela de usuários a cada chamada**; política dos cards com a função de admin sem `(select …)` | RLS | 32 |
| 8 | 33 chaves estrangeiras sem índice · 9 tabelas com duas políticas permissivas · 2 índices duplicados · 18 sem uso | banco | 32 |
| 9 | **Estatísticas erradas** do planejador (eventos 4 × 4.706; logs 106 × 7.185) | banco | 32 |
| 10 | Histórico do cron com 30 MB, sem limpeza | banco | 32 |
| 11 | ~20 portas por deslocamento (offset) | listas | 32 (30/31 nas que tocarem) |
| 12 | Presença gravada a cada 5 min por aba aberta | casca | 32 |

**Andamento (SESSAO-30, 08/10):**
- **#5 estoque — pago em parte.** Os números do estoque ficaram prontos numa linha por produto, mantida no mesmo gesto (D-119). No banco de verdade (tempo do servidor, sem a viagem da rede): lista do Top X **~700 ms → ~21 ms**, busca ~650 → ~21 ms, resumo **~900 → ~13 ms**, configurações ~370 → ~8 ms; lista nova das peças fora do catálogo ~2 ms (índice próprio). Crescer pedidos, peças e eventos **não pesa mais** nessas portas. **Resta (nova dívida 13):** elas ainda montam a página a partir do **catálogo inteiro** — com o catálogo ×100 (53 mil produtos, ensaio de 08/10): lista ~550 ms, busca ~340 ms, resumo ~390 ms, configurações ~125 ms. O catálogo de hoje tem 537 produtos e cresce devagar. **Caminho:** página em duas fases — as chaves da página primeiro, pelo índice da posição na linha pronta (e índice de trigramas para a busca no catálogo, que precisa de OK por ser extensão nova), e as colunas pesadas só para os 20 da página; o resumo como uma linha única mantida no mesmo gesto. Quem paga: 32.
- **#1 relógios — pagos nas telas tocadas pela 30:** Estoque (Top X ×2, insumos), PCP (×3), Pedidos em aguardo (×3), ROTAS → Entregas, Programação (Programar e Já programadas) e a tela nova "Entregas do dia" estão **ao vivo por websocket** (migration 61: o banco empurra "mudou" nos tópicos privados `plt-aviso:estoque|aguardo|pcp|rotas`, um por área por transação, só para quem pode ver; a tela relê só as consultas dela; ao reconectar, uma releitura de recuperação). Provado no preview: um aviso → as 3 consultas do Estoque, nenhuma outra. Os relógios das telas não tocadas (sino, bolinha, Meu Painel, Afazeres, quadros, tablet, Visão do dia, Expedição, Danificados, Painel admin) seguem para a 32.
- **#3/#5 PCP:** cada aba só pede o que mostra (antes o quadro e as solicitações rodavam em qualquer aba); "Todos os pedidos" por cursor (3,2 s → 11 ms); a janela de liberação abre com **1** requisição (antes 3–4) e libera numa chamada (antes 3 por peça); sugestão do estoque ~90 → ~5 ms.
- **#11 listas:** "Todos os pedidos" e as peças fora do catálogo por cursor. **Restam por deslocamento (dívida 14):** ROTAS → Entregas e "Já programadas" com o histórico de entregues (crescem sem fim; ~3–5 ms hoje com 308 entregas) e Pedidos em aguardo / Produtos reservados (limitados ao que está vivo no aguardo — deslocamento justificado).
- **Portas novas** (EXPLAIN/tempo no servidor, banco real): "Entregas do dia" ~4–9 ms; liberação ~5 ms; ROTAS/Já programadas/Programação/Todos os pedidos 2–12 ms lendo a entrega vigente projetada (antes varriam eventos).
- **Pacote:** JS principal 1.852,7 kB / 505,7 kB gz (início da 30) → 1.862,5 kB / 507,1 kB gz (fim); a tela do entregador é pedaço próprio (13,2 kB / 4,0 kB gz) + mini mapa (1,5 kB / 0,8 kB gz). O entregador ainda baixa a casca inteira (dívida #4).
- **Primeira abertura das telas tocadas:** "Entregas do dia" = 1 requisição; janela de liberação = 1; Estoque abre com 3 (configuração, situação da reposição, lista) e o PCP com várias (setores, página do quadro, pedidos, etiquetas, campos) — dívida 15, a porta de abertura de cada tela é da 32.
- **Advisors (08/10, depois da 62):** nenhum item de tipo novo; a chave sem índice criada na 60 foi corrigida na 62 (as 33 FKs antigas seguem — #8).

| 13 | Portas do estoque montam a página a partir do catálogo inteiro (O(catálogo)) — ver o andamento acima | estoque | 32 |
| 14 | ROTAS → Entregas e "Já programadas" (entregues) por deslocamento — o histórico cresce; pagar com cursor por (entregue_em, card) | ROTAS | 32 |
| 15 | Estoque abre com 3 requisições e o PCP com várias — falta a porta de abertura de cada tela (Lei §2) | Estoque, PCP | 32 |

→ As telas tocadas pelas SESSÕES 30 e 31 **já saem dentro da lei**. O resto é a [[SESSAO-32 - Desempenho e Escala - Adequacao de Toda a Plataforma]].

## Fontes

- Supabase — [RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- Supabase — [Introducing JWT Signing Keys](https://supabase.com/blog/jwt-signing-keys) (getClaims × getUser, verificação local)
- Supabase — [Custom Claims & RBAC (Custom Access Token Hook)](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac)
- Supabase — [Realtime: recomendações (Broadcast, canais privados, tópicos)](https://supabase.com/docs/guides/ai-tools/ai-prompts/use-realtime) · [Benchmarks](https://supabase.com/docs/guides/realtime/benchmarks)
- Supabase — [Query Optimization](https://supabase.com/docs/guides/database/query-optimization) · [Timeouts](https://supabase.com/docs/guides/database/postgres/timeouts) · [Queues](https://supabase.com/docs/guides/queues)
- web.dev — [Core Web Vitals](https://web.dev/articles/vitals)
- TanStack Query — [Request Waterfalls](https://tanstack.com/query/latest/docs/framework/react/guides/request-waterfalls)
- Stripe — [Idempotência e novas tentativas](https://stripe.com/blog/idempotency)
- Paginação por cursor — [Readyset: Optimizing SQL Pagination in Postgres](https://blog.readyset.io/optimizing-sql-pagination-in-postgres/)
- Migrações sem parada — [Bytebase: Postgres Schema Migration without Downtime](https://www.bytebase.com/blog/postgres-schema-migration-without-downtime/)
- Partição de tabela que cresce — [Heroku: Handling Very Large Tables in Postgres Using Partitioning](https://www.heroku.com/blog/handling-very-large-tables-in-postgres-using-partitioning)
- Tempo real: polling × long polling × SSE × websocket — [AlgoMaster](https://blog.algomaster.io/p/polling-vs-long-polling-vs-sse-vs-websockets-webhooks)

## Ver também

[[CLAUDE - Regras do Claude Code (repo)]] · [[PLT - Modelo de Sistema]] · [[SUPA - Esquema do Banco]] · [[PLT - Memoria de Aprendizado]] · [[SESSAO-32 - Desempenho e Escala - Adequacao de Toda a Plataforma]]
