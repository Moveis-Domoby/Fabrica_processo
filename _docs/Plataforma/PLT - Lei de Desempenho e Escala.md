---
titulo: "PLT — Lei de Desempenho e Escala"
tipo: regras
data: 2026-10-07
atualizado: 2026-10-16
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

- ↪️ **16/10/2026 (D-143) — a consulta "o que mudou" do Tiny, de hora em hora, só das 8h às 20h.** O Tiny não avisa produtos nem clientes alterados (só vendas e estoque têm aviso); a consulta pergunta "o que mudou desde a última vez" e custa **uma chamada quando nada mudou**; fora do horário nada roda. Dura até o Tiny ter aviso desses dados. Substitui a consulta de 15 em 15 minutos do catálogo da fábrica quando a API nova ligar (dívida 21).

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
- **#11 listas:** "Todos os pedidos" e as peças fora do catálogo por cursor. ~~Restam por deslocamento (dívida 14): ROTAS → Entregas e "Já programadas" com o histórico de entregues~~ ↩️ **paga pela D-120 (08/10, noite):** o entregue saiu da ROTAS e de "Já programadas" — as duas listas só têm o que falta entregar (limitado ao que está vivo; deslocamento justificado, como Pedidos em aguardo / Produtos reservados). O histórico de entregues mora em "Todos os pedidos", que já anda por cursor; a janela completa do pedido é 1 requisição, só no clique (~ms no servidor: lê um pedido por chave).
- **Portas novas** (EXPLAIN/tempo no servidor, banco real): "Entregas do dia" ~4–9 ms; liberação ~5 ms; ROTAS/Já programadas/Programação/Todos os pedidos 2–12 ms lendo a entrega vigente projetada (antes varriam eventos).
- **Pacote:** JS principal 1.852,7 kB / 505,7 kB gz (início da 30) → 1.862,5 kB / 507,1 kB gz (fim); a tela do entregador é pedaço próprio (13,2 kB / 4,0 kB gz) + mini mapa (1,5 kB / 0,8 kB gz). O entregador ainda baixa a casca inteira (dívida #4).
- **Primeira abertura das telas tocadas:** "Entregas do dia" = 1 requisição; janela de liberação = 1; Estoque abre com 3 (configuração, situação da reposição, lista) e o PCP com várias (setores, página do quadro, pedidos, etiquetas, campos) — dívida 15, a porta de abertura de cada tela é da 32.
- **Advisors (08/10, depois da 62):** nenhum item de tipo novo; a chave sem índice criada na 60 foi corrigida na 62 (as 33 FKs antigas seguem — #8).

**Andamento (SESSAO-31, 14/10):**
- **#1 relógios e #2 `postgres_changes` — pagos no quadro do setor e no tablet:** o quadro abre com **1 requisição** (`plt_fn_quadro_setor` — antes 1 por coluna + Chegada + execuções + pedidos + pessoas + campos, cada uma relida a cada 20 s) e fica ao vivo pelo canal privado `plt-aviso:setor_{id}` (um aviso por setor por transação; 1 releitura; recuperação ao reconectar). O tablet deixou de escutar a tabela de cards inteira. "Ver mais" = 1 requisição por cursor. No banco real, com 800 cards num setor: quadro 6,5 ms, Ver mais 4,2 ms. Seguem com relógio (32): sino (sai na etapa F desta sessão), bolinha de execução, Meu Painel, Afazeres, Visão do dia, Expedição, Danificados, Painel admin.
- **#1 relógios — pago também no sino:** o aviso novo chega pelo canal da pessoa (o mesmo do chat) e entra no cache; o relógio de 30 s saiu (os dois sinos da casca dividem o mesmo canal e a mesma consulta).
- **Pausa com motivo:** o motivo é projeção no card — a frente e o quadro leem sem ir buscar (o quadro continua 1 requisição: 4,9 ms na MONTAGEM); a lista de motivos é dado de referência (cache longo, relê quando muda); pausar/parar chegam ao quadro pelo websocket do setor.
- **Janela do card e conversa (telas novas):** abrir = 1 requisição (~2 ms no banco); histórico e anexos no clique; links dos anexos numa chamada só; a conversa pelo canal privado do card (sem releitura; 300 mensagens: 20 ms); a janela e a conversa são pedaços próprios (22,0 + 12,5 kB).
- **#7 RLS dos cards:** `plt_cards_leitura` reescrita com as funções de sessão em `(select …)` (a permissão no token segue para a 32).
- **Pacote:** a aba Lançamento manual é pedaço próprio (20,0 kB / 5,7 kB gz); JS principal 1.894,6 → 1.906,1 kB (516,2 → 519,4 kB gz) com o quadro novo e a frente do card.
- **Ajustes do dono (14/10 noite):** (1) **voltar a uma tela ao vivo** relê o que mudou enquanto a pessoa estava fora — o quadro guardava a leitura da visita anterior para sempre e só ouvia o canal com a tela aberta (`useQuadro`/`useAoVivo`: na 1ª assinatura, a leitura de antes de a tela abrir é relida uma vez); (2) Expedição sem o relógio de 30 s (ao vivo) e só com pedido vivo (4,6 ms); (3) quadro do PCP 26 ms com a regra do Tiny; (4) área Pedidos: lista por cursor (1ª página 38,6 ms, seguinte 25,7 ms), ficha = 1 requisição no clique, Produção (10,8 ms) e Dados do Tiny (4,2 ms) só no clique dos botões, pedaço próprio (39,7 kB) — o JS inicial **caiu** de 1.538 para 1.465 kB (393,6 kB gz); busca por nome e Cancelados acima do teto → dívida 17; (5) aviso de versão nova sem relógio (confere no trocar de tela e ao voltar à aba, no máximo a cada 2 min).
- **Fechamento (14/10, ~04:00):** o carregador antigo do quadro (uma consulta por coluna, com relógio) saiu do código. **Advisors:** nenhum item de tipo novo; as chaves estrangeiras criadas na sessão têm índice (as 33 sem índice são as antigas — #8); os índices "sem uso" subiram de 18 para 34 porque os desta sessão nasceram hoje (telas publicadas há horas). **Pacote do primeiro carregamento:** 1.862,5 kB / 507,1 kB gz (fim da 30) → **1.930,9 kB / 528,8 kB gz** (principal + Supabase + runtime) — a janela (23,7 kB), a conversa (12,5 kB) e o Lançamento manual (14,4 kB) são pedaços próprios; o resto é a dívida #4. **Registro de uso (`pg_stat_statements`):** nenhuma porta nova no topo; a porta do quadro do PCP (pedidos) tem média de 157 ms no histórico — dívida 16.

| 13 | Portas do estoque montam a página a partir do catálogo inteiro (O(catálogo)) — ver o andamento acima. ↪️ **17/10 (SESSAO-33):** entra aqui também a lista **"Unidades fora do padrão"** (Configurações → Móveis, insumos e peças — `plt_fn_produtos_unidades`): hoje 3 ms; com o catálogo ×100 (55 mil produtos) **117–139 ms** no banco local — só o admin, só no clique. Mesmo caminho: a "grafia mais usada" de cada unidade numa linha pronta, mantida no gesto que grava o produto | estoque, Configurações | 32 |
| ~~14~~ | ~~ROTAS → Entregas e "Já programadas" (entregues) por deslocamento~~ — ✔ paga pela D-120 (o entregue saiu da ROTAS; o histórico mora em "Todos os pedidos", por cursor) | ROTAS | 30 |
| 15 | Estoque abre com 3 requisições e o PCP com várias — falta a porta de abertura de cada tela (Lei §2) | Estoque, PCP | 32 |
| 16 | A porta do quadro do PCP (`plt_fn_pedidos_kanban`) com média de 157 ms (máx. 2,3 s) no registro de uso — acima do teto de 50 ms; a 31 tocou o PCP só com a aba nova (Lançamento manual, dentro da lei) | PCP | 32 |
| 17 | Área Pedidos: a busca por nome/vendedor (55 ms) e a lista de Cancelados (41 ms) varrem `pedidos` — com ×100 ficam lentas. **Caminho:** índice parcial dos cancelados e índice de trigramas para a busca, nas tabelas da INTEGRAÇÃO (precisa do OK do dono — regra 10 e extensão nova). **Dono (15/10): "deixe anotado para a sessão 32 otimizar"** — está no §1.6 da SESSAO-32 | Pedidos | 32 |

**Andamento (SESSAO-32, 15–16/10 — noturna; detalhes em [[SESSAO-32]] e no handoff):**
- **#9 estatísticas — paga, com a causa:** um LAÇO na fila do estoque com o Tiny (dois insumos "simples" com saldo enorme criavam uma peça por unidade, estouravam 8 s, desfaziam e voltavam a cada 10 min — ~14,5 milhões de linhas desfeitas em cards/eventos/registros). Parado, impedido de voltar (teto de 500 peças + reserva vencida conta como falha — migration 76) e `ANALYZE`. Teste de carga com 40 pessoas: p95 no servidor **3,8 s (6% de erro) → 384 ms (0 erro)**.
- **#8 — paga em parte (migration 77):** 29 índices de chave estrangeira; as 9 duplas de regras de acesso unidas; `(select …)` em todas as funções de sessão das regras; regras de storage e realtime embrulhadas. **→ Paga com o OK do dono (migration 84, D-138):** as 4 chaves das cópias do Tiny e os 2 repetidos — os avisos de desempenho ficaram só com os "sem uso" (informativo). **#10 — paga:** histórico do cron com limpeza diária (guarda 7 dias).
- **#3 — paga:** a primeira abertura é **1 requisição** (`plt_fn_abertura` — perfil, vínculos, setores, sino, chat, bolinha, catálogos de etiquetas e campos e, na 1ª tela Meu Painel, os dados dele; ~10 ms no servidor, ~10 KB). Conferido no site: 1 requisição de dados, nada mais. Caminho de reserva (as leituras de antes) se a porta falhar.
- **#1 e #2 — pagos:** nenhum relógio buscando dado e nenhum `postgres_changes` no código; `plt_cards` fora da publicação do Realtime. Avisos novos por canal privado: painel, danificados, trabalho da pessoa (no canal dela), tarefas do setor, fila do Tiny (evento próprio) e cada lista do Comercial; reprise do servidor ao entrar no canal (o que veio na abertura não é relido); "ao vivo pausado" + Atualizar quando o canal cai. **#12 — paga:** presença marcada no gesto (navegação e fatos).
- **#4 — paga:** cada tela é pedaço próprio; **JS inicial 505,7 → 218 KB comprimidos** (14 arquivos); **teto de 250 KB na montagem** (falha acima); pré-carregamento na intenção (mouse/foco/dedo no menu); `/assets` com cache de 1 ano. No site: 1ª abertura LCP 1,9 s, 2ª abertura **LCP 0,8 s** (JS todo do cache).
- **#11 — paga nas listas que crescem:** a trilha da Auditoria e o histórico das automações por cursor (antes: deslocamento + contagem da lista inteira a cada página). As outras 22 portas por deslocamento são de listas limitadas (o que está vivo, catálogos) — **deslocamento justificado**; todas com teto no banco (100/200), exceto `plt_fn_meu_tempo_tarefas` (limitada pelo período) e as duas do Comercial (teto global da API, 1.000).
- **#15/#16 PCP — pago em parte:** o quadro do PCP numa leitura (`plt_fn_pcp_quadro`: a página + etiquetas + o resumo do pedido; abrir direto no PCP **6 → 2** requisições). A porta da página ainda leva **100–200 ms** no servidor (a conta das peças do estoque por card) — fica na dívida 16. Estoque segue com 3 (dívida 15).
- **#5 Comercial — a tela pronta (migration 86, D-139):** a tela pronta no banco (pedidos desmontados, vida do cliente, contas do mês) mantida no fato por gatilho à prova de falha — sem relógio; as 11 portas leem dela (mesmo resultado provado). Banco real: Painel no período inteiro 1,5–2,5 s → 3 ms; mês atual 34 → 1,9 ms; top de produtos 220 → 2,9 ms. Abre no mês atual. Seguem: o nº de leituras por tela (dívida 18) e a gravação do pedido do Tiny.
- **#5 Comercial — antes (pago em parte):** o painel não pede mais as vendas de cada um dos 20 maiores clientes uma a uma (lista de telefones numa leitura; **~29 → ~10** requisições). Seguem: os 8 gráficos do painel, clientes consolidados/filtro de clientes e a gravação do pedido do Tiny (dívida #5).
- **#6 — medido, não pago:** o trabalho de fundo custa ~0,35% de um núcleo (relógio do estoque ~95 ms/min, webhooks ~28 ms/min, fotos ~250 ms/5 min). Trocar por "nasce do fato" mexe no n8n e no disparo do Comercial — **proposta ao dono** (regra 3).
- **#7 — preparado:** o gancho do token (`supabase/pendentes/2026-10-16_gancho_do_token.sql`) espera o dono ligar a chave assimétrica e o gancho no painel; as funções de sessão lendo do token vêm depois, com ele.
- **#17 Pedidos — paga (migration 83, OK do dono — D-138):** `pg_trgm` + índice parcial dos cancelados + trigramas no nome do cliente e no vendedor, com a porta por caminhos (mesmo resultado). Banco real: Cancelados 42 → 3–5 ms, busca por nome 30 → 10 ms, por número 28 → 5 ms; ×100 local: busca de um cliente 5,6 s → ~45 ms.
- **Estoque — a fonte do laço fechada (migration 85, D-138):** o "simples" do Tiny mistura revenda e insumo; agora o tipo de cada produto (móvel · insumo · peça) é coluna guardada e a fila do Tiny só aceita móvel — nenhum insumo vira um cartão por unidade (seguia crescendo: ≈4.765 → 5.090 cartões em poucas horas). As portas do estoque leem o tipo guardado (sem regra espalhada); a lista do admin 2–3 ms; abas do estoque ~24 ms.
- **Medir para não adivinhar (§11):** a plataforma mede a própria velocidade em cada abertura (LCP/INP/CLS/FCP/TTFB por aparelho — `plt_medicoes_web`, p75 por `plt_fn_medicoes_web_resumo`); tempo parado: 12 h no modo tablet, 8 h no escritório (sem relógio).

**Andamento (SESSAO-33, 16–17/10 — o Tiny completo; detalhes em [[SESSAO-33]] e no handoff):**
- **Ensaio ×100 antes de subir** (banco local com as 92 atualizações; produção ×100 de cada tabela e **3 milhões de linhas da carga na fila**): a 1ª versão já falhava no volume de HOJE em três pontos — "Pausar" mexia em cada linha da carga (765 ms → ~80 s no ×100), a fila varria as linhas pausadas ao procurar trabalho, e o painel contava a fila a cada abertura (393 ms, acima dos 150 ms). **Corrigido antes de subir:** índice de trabalho por conta e vez; "Pausar" = interruptor (nenhuma linha muda); contas prontas da carga mantidas pelos gatilhos da fila; resumo do mês das contas a pagar mantido no gesto que grava; o "quantos aqui" da conferência calculado quando a contagem chega; números da fila que param em 10 mil; relógio que não acorda pela carga pausada.
- **×100 depois (banco local — teto, não média):** lote do n8n 4–5 ms · "tem trabalho?" 0,4–1 ms · relógio 0,6–0,7 ms · fila antiga 1,8 ms · venda gravada com a carga pausada 1,9 ms · pausar 3,7 ms · retomar 1,1 ms · resposta do Tiny 1,5 ms (detalhe) / 16 ms (página de 100) · **painel da carga 13 ms** · contar 13 ms · estrutura do produto 0,6–1,4 ms. Planos pelo índice certo, sem varredura nas tabelas que crescem (o lote e o "tem trabalho?" pelo índice de trabalho por conta; as que esperam pelo índice próprio; os erros e as páginas das contas a pagar idem). Fora do teto: a lista de unidades fora do padrão (dívida 13) e o "Começar a carga" (dívida 22).
- **Sem relógio novo na tela:** a aba Carga do Tiny lê no abrir e no "Atualizar". A consulta de hora em hora é a exceção registrada (§13 · D-143). O relógio da fila (de minuto em minuto, só com trabalho) e as outras rotinas de minuto viram a próxima sessão (pedido do dono, §4 do pedido de 16/10).
- **Pacote (antes → depois, comprimido):** JS inicial **219,6 → 219,6 KB** (14 arquivos; teto 250); pedaço da Auditoria 4,8 → 7,8 KB, Configurações de produtos 2,6 → 4,1 KB, Integrações 2,9 → 3,7 KB — o que é novo mora no pedaço de cada tela.

| 18 | Telas que ainda abrem com 2–3 leituras (em paralelo): Pessoas, Qualidade, Tempo por setor, Meu desempenho, Pedidos em aguardo, Programação, Equipe, Config. do estoque, API e integrações, Controle de tempo, Caminhões, Automações; Comercial (~10, os gráficos) — falta a porta de cada tela (Lei §2) | painéis, configurações, Comercial | 33 |
| 19 | **A máquina do banco** (plano gratuito: 0,5 GB, processador compartilhado) dá picos de segundos mesmo parada (a lista de Pedidos: 2,6 s numa chamada, 15–36 ms nas seguintes; 0 leitura de disco, JIT desligado) — decisão de custo do dono. ↪️ **16/10 (D-141): fica no plano gratuito por enquanto** — escolha de custo registrada, fora da lista de pendências | infraestrutura | dono |
| 20 | O aviso do trabalho da pessoa relê 3 consultas (tarefas, bolinha, cards delegados) — juntar numa porta. ↪️ 17/10: a 33 virou o Tiny completo (pedido do dono de 16/10) e não tocou essas telas — fica para a próxima que tocar Meu Painel/Afazeres | Meu Painel, Afazeres | próxima que tocar |
| 21 | O fluxo da fábrica no n8n ainda **pergunta ao Tiny a cada 15 min** pelos produtos criados (relógio do n8n, de antes da lei) — sai quando a API nova da fábrica ligar e a consulta de hora em hora (D-143) assumir; a varredura das 03:15 fica como rede de segurança | integração Tiny (fábrica) | 33 → ligar em casa |
| 22 | **"Começar a carga" do Tiny** (Auditoria → Carga do Tiny — `plt_fn_tiny_carga('carregar')`): hoje 50 ms; com o volume ×100 (55 mil produtos, 1 milhão de clientes, 557 mil pedidos) **4,5 s** no banco local — gesto único de escrita do dono, dentro do tempo da requisição (8 s), não é porta de tela. **Caminho, se o catálogo crescer:** a carga semeia um item só e a própria fila o expande em partes | Auditoria | quando crescer |

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
