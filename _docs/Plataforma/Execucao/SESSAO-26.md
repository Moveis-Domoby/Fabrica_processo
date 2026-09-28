---
titulo: Execução — SESSAO-26 · Chat interno
tipo: execucao
data: 2026-09-27
atualizado: 2026-09-27
tags: [execucao, sessao-26, chat, aniversarios, realtime, bloco-5]
---

# 🔧 Execução — SESSAO-26 · Chat interno

**Branch:** `sessao-26-chat-interno` (nascida da `main` em 62ba2f7 = `origin/main`), numa **worktree própria**: `C:\Users\wccau\Domoby\Domoby - Fabrica - sessao-26` — a pasta principal está com a SESSAO-24 trabalhando em paralelo (branch dela, arquivos não commitados). Dev server desta frente: porta **5175** (`.claude/launch.json` local, `--strictPort`).
**Demanda:** [[SESSAO-26 - Chat Interno]] (lida 2×) · handoff anterior lido: [[handoff_2026_09_26_sessao25_estoque]] · memória de execução da 24 lida (para convivência).
**Regra do working tree:** commit sempre por caminho explícito (E-23).

## Convivência com a SESSAO-24 (combinado por mensagem entre sessões, 27/09)

- **Aplicador reaplica TODAS as migrations da pasta.** A 24 escreveu a migration 37 e EDITOU a 29 (tirou o `validate` do check de tipos) e a 36 (`not valid` + `drop` do `plt_fn_estoque`). Minha pasta não tem nada disso.
- **Protocolo:** minha migration é a **38** (`20260927180000_plt_chat_interno.sql`, ordena depois da 37) e **100% ADITIVA** — só objetos novos; nada de redefinir função/view/check/grant de 01–37. Se a 37 for aplicada ANTES da 38: aplico **só o arquivo da 38** (mesma transação, mesma conferência de impressão digital), nunca o aplicador completo da minha pasta. Se a 38 for antes: a reaplicação 01–37 da 24 não desfaz nada meu. Cada uma avisa a outra antes/depois de aplicar.
- **Armadilha que as duas viram:** a migration 11 faz `revoke insert, update, delete on plt_usuarios from authenticated` — revogar o privilégio da tabela derruba também os grants por coluna; as 22/33 re-concedem só as delas. Um `grant update (data_nascimento)` meu sumiria na reaplicação → **data de nascimento por RPC security definer**.
- **Numeração no cofre:** S24 = D-58…D-64, E-44/E-45 (usados), A-25+, M-15 (usado), RF-77…RF-89, Q-69+. **S26 = D-65…D-69, E-50…E-59, A-30…A-39, M-20+, RF-90…RF-99, Q-75+.**
- **Arquivos em comum:** `Layout.tsx` (a 24 mexe 1–3 linhas na visibilidade da Logística; eu no grupo Início e no fim do componente), `testar-migrations.mjs` (os dois blocos antes de `titulo('Resumo')`), índices do cofre. Quem mesclar por último resolve e roda o `test:banco` 2× com 37+38 juntas.

## Checkpoint de início — o que o código e o banco mostraram (consultas SÓ de leitura)

1. **Banco (27/09):** 3 usuários, todos admin, ativos, com login — **nenhuma conta de tablet cadastrada ainda**. `realtime.send` existe. pg_cron com 5 jobs (`plt-webhooks-despachar` + os 4 do Comercial; a reposição ainda não foi ligada). Publicação `supabase_realtime` só com `plt_cards`. Fuso do banco: UTC (as telas usam America/Fortaleza).
2. **Precedentes de tempo real:** `plt_cards` por `postgres_changes` (VisaoDoDia, MeuPainel, TelaSetor) + polling de segurança. O sino (`SinoNotificacoes`) é só polling de 30s.
3. **Bolinha flutuante da S23** (`BolhaExecucao`): `fixed right-4 bottom-20 sm:bottom-6`, `z-40` — mesmo canto do balão; precisa convivência.
4. **Log (D-40):** `plt_logs_atividade` (ação em texto livre, sem check) + `plt_fn_registrar_log` e triggers por tabela. O trigger `fn_logar_usuario` lista campos fixos (não vou recriá-lo — protocolo aditivo).
5. **Contas de tablet:** conta normal de `plt_usuarios` (a sessão é do dispositivo); não existe marca que a distinga.
6. **🚨 Achado de segurança (fora do escopo, levado ao dono):** em produção o `authenticated` tem **SELECT na tabela inteira** `plt_usuarios` (default do Supabase) — e grant de tabela anula os `revoke select (cpf, convite_token, pin_hash)` por coluna (regra do Postgres). Ensaio A-11 no banco real (nada gravado), como `authenticated`: `linhas=3 cpf_legivel=3 pin_hash_legivel=1 convite_token_legivel=3`. O harness não pega (no PGlite o `authenticated` não tem grant de tabela — E-14 de novo). A data de nascimento nasceria igualmente exposta.

## Respostas do dono (27/09/2026 — o OK da sessão)

1. Aniversário: **só no grupo** (Avisos gerais); o texto proposto está bom — *"🎉 Hoje é aniversário de {nome}! Parabéns — toda a Domoby deseja um ótimo dia."*
2. Criar canais: **só líder e admin** (quem cria administra).
3. Avisos gerais: **o admin edita quem pode escrever** (lista configurável; admin sempre escreve).
4. Retenção: **para sempre**.
5. Conta de tablet: **participa normalmente** (nada a fazer; não existe nenhuma hoje).
6. Segurança: **corrigir já** na migration desta sessão (CPF, hash do PIN, token de convite e a data de nascimento fora da API).
7. **OK para aplicar a migration 38 em produção** depois dos testes.

**Adendo do dono (lei desta sessão):** *"a comunicação deve ser por websockets, não deve ter consulta de leitura ao banco, apenas de post; a única leitura deve ser da paginação para consultar mensagens antigas, até 10 mensagens por paginação, até 5 conversas por paginação também, até rolar o scroll e requisitar mais; leia todo o banco para não inventar nada e não criar nada inútil nem pesado; faça de forma extremamente otimizada e funcional."*

## Leitura do banco para o desenho (27/09, só leitura + ensaios com rollback)

- 37 tabelas em `public` — **nenhuma serve para conversa/mensagem** (`plt_notificacoes` é aviso do sistema por destinatário; `plt_tarefas` é afazer) → as 3 tabelas novas da demanda se justificam (D-47).
- `realtime.send(payload, event, topic, private)` existe, **não é security definer** e **engole qualquer erro** (vira WARNING) — broadcast que falha some calado; a prova é contar linhas em `realtime.messages` num ensaio.
- `realtime.messages`: dona `supabase_realtime_admin`, RLS ligado, **zero políticas** (nenhum canal privado funciona hoje).
- Ensaio A-11 (rollback): o `postgres` tem BYPASSRLS, **cria política em `realtime.messages`** e o `realtime.send` grava a linha.
- supabase-js 2.112.4: repassa o token da sessão ao Realtime sozinho (INITIAL_SESSION/SIGNED_IN/TOKEN_REFRESHED) e aceita `config: { private: true }`.
- `plt_usuarios`: 21 colunas; nenhuma view nem função INVOKER lê `cpf`/`pin_hash`/`convite_token`; nenhuma migration concede SELECT de tabela (o grant vem do default do Supabase) → trocar para grant por coluna não é desfeito por reaplicação.

## Desenho (a partir das respostas + do adendo)

- **Websocket = Broadcast do banco, canal PRIVADO** (não `postgres_changes`): no `postgres_changes` o Realtime LÊ o banco para checar o RLS de cada assinante a cada mudança (N leituras por mensagem); no Broadcast a autorização é UMA vez, na entrada do canal (política em `realtime.messages`), e o gatilho da mensagem só empurra. Por isso **a publicação `supabase_realtime` NÃO ganha tabela** (↩️ a nota da demanda previa isso — o adendo do dono pede o caminho mais leve).
  - Tópico da conversa `plt-chat-c:{id}` — a mensagem inteira; assinado SÓ enquanto a conversa está aberta (1 por conversa aberta; fechou, sai).
  - Tópico da pessoa `plt-chat-u:{uuid}` — um sinal pequeno (conversa, id, autor, prévia de 80 caracteres, hora) para o badge e a lista; 1 por pessoa logada. Também leva `lida` (sincroniza outra aba/aparelho), `entrou`/`saiu`/`renomeada`/`permissao`.
- **Leituras (só paginação):** lista de conversas 5 por página (cursor por atividade; a 1ª página traz o total de não lidas — é a única leitura na abertura do app, e é ela que acende o badge); mensagens 10 por página (cursor por id, "anteriores" ao rolar para cima); pessoas e membros 10 por página ao rolar. **Nada de polling, nada de refetch ao focar.** Reconexão do websocket (pode ter perdido sinal) → reler só a 1ª página.
- **Escritas (POST):** enviar (devolve a mensagem — o remetente não relê), marcar como lida, abrir particular, criar/renomear canal, pôr/tirar membro, definir quem escreve nos avisos, data de nascimento.
- **Tabelas:** `plt_chat_conversas` (canal/particular/avisos; na conversa só o nome muda — gatilho), `plt_chat_participantes` (papel `membro`/`administrador`/`escritor`, ponteiro `ultima_lida_id`, `saiu_em` em vez de apagar), `plt_chat_mensagens` (**só inserção** — gatilho recusa editar/apagar até para a chave de serviço; `sobre_usuario_id` só no aniversário, sem FK, para não travar a exclusão D-49).
- **Avisos gerais:** 1 conversa semeada; TODO usuário tem linha de participante (backfill + gatilho novo no cadastro, com o ponteiro na última mensagem — quem chega não herda "não lidas" antigas). Escreve: admin sempre + papel `escritor` (o admin liga/desliga).
- **Segurança (resposta 6):** `revoke select` da tabela `plt_usuarios` (anon/authenticated) + `grant select` por coluna em todas MENOS `cpf`, `pin_hash`, `convite_token` e `data_nascimento`. Data de nascimento: RPCs `plt_fn_definir_nascimento`/`plt_fn_ler_nascimento` (o próprio ou admin), com log sem o valor.
- **Aniversário:** `plt_privado.fn_chat_publicar_aniversarios(p_dia)` + job `plt-chat-aniversarios` às 08:00 de Natal (11:00 UTC), 1 por pessoa por dia (índice único), 29/02 → 28/02 em ano não bissexto, só ativos.
- **Log (D-40):** canal criado/renomeado, membro posto/tirado, quem escreve nos avisos, aviso publicado, data de nascimento alterada. Mensagem comum e abertura de particular NÃO logam (a mensagem já é o registro; o log mostraria a admins quem conversa com quem). Conteúdo nunca.

## Task list (espelho da demanda + respostas + adendo)

- [x] 1. Migration 38 aditiva: 3 tabelas + RLS por participação + imutabilidade + avisos semeados/participação automática + RPCs (lista 5, mensagens 10, membros 10, enviar, lida, particular, canal, membros, escritores) + broadcast privado + política de `realtime.messages` + data de nascimento + correção de segurança de `plt_usuarios` + aniversário com pg_cron
- [x] 2. `test:banco` 2 rodadas com os cenários do chat (389 ✔) + teste da 38 POR CIMA da 37 (446 ✔)
- [x] 3. Front: `/inicio/chat` (lista à esquerda, conversa à direita; celular uma coisa por vez) + filho "Chat" em Início
- [x] 4. Balão global arrastável (pointer events, posição por pessoa no aparelho), badge, painel compacto; fora do `/tablet` e da tela do Chat; ao lado da bolinha de execução
- [x] 5. Canais (só líder/admin criam; quem cria administra), particulares, avisos (admin define quem escreve)
- [x] 6. Websocket: 1 canal da pessoa + 1 por conversa aberta; assina antes de ler; zero leitura fora das páginas; reconexão relê só a 1ª página — provado no teste de integração (conta leituras e canais) e AO VIVO no Realtime do projeto (broadcast do banco chega em 167 ms; sem login, canal privado recusado)
- [x] 7. Data de nascimento no Meu Perfil (próprio) e na Gestão da equipe (admin)
- [~] 8. Validação: tsc ✔ · lint ✔ · test ✔ 72 · build ✔ · mojibake 0 · ensaio A-11 ✔ · F-08 ✔ · aplicada SÓ a 38 ✔ · advisors ✔ · **F-07 visual (375/768, arrasto no toque) e o teste com duas contas: PENDENTES com o dono** — a sessão não pode entrar com senha de ninguém na autenticação de produção; o app sobe no 5175 sem erro e, deslogado, não faz nenhuma chamada ao Supabase
- [x] 9. Cofre: D-65…D-68, RF-90…RF-95, Esquema do Banco, Modelo de Sistema, memória (E-50 promovida, E-51, E-52), demanda, ORDEM/MAPA/PRÓXIMOS PASSOS, regra 10 dos dois CLAUDE.md, handoff

## O merge (27–28/09) — o dono: "valide, mescle na main, avise a outra sessão e faça todo teste, crie usuário se necessário para simular conversa"

- **Criar usuário e entrar com senha: recusado pela regra de segurança** (a autenticação é o Supabase de produção, fora da máquina — nem com a autorização do dono) e **as contas de Guilherme e Parizot são pessoas reais** (não se age por elas). Pedido ao dono: entrar com a conta dele em `localhost:5175` e com um usuário de teste criado por ele ("Teste Chat (apagar)") em `127.0.0.1:5175` — endereços diferentes = sessões separadas no mesmo painel (os dois respondem 200).
- A **SESSAO-24 mesclou antes** (`98c17b5`, enviado; Vercel publicando) → esta frente mescla por último: `git merge origin/main` na branch — conflitos em MAPA, PRÓXIMOS PASSOS, ORDEM, Decisões, Memória, Modelo de Sistema, Esquema e harness; Layout e Requisitos juntaram sozinhos. Resolução por script (regra por arquivo, a 24 primeiro; ORDEM: linha 25 dela + 26 desta; PRÓXIMOS: uma seção "Agora" com as duas entregas; nota da numeração ajustada — a 24 usou D-58…D-62). Conferido: nenhum marcador, nenhuma duplicata de E-NN, zero mojibake novo.
- **No código juntado:** `test:banco` 01…38 em 2 rodadas ✅ **446**; `tsc` ✅; `lint` ✅; `npm test` ✅ **80**; `build` ✅. Commit do merge `a6ff33c` (8 à frente de `origin/main`, entra por avanço direto). O 5175 serve o código juntado sem erro.
- ⚠️ A pasta principal está na `main` com mudanças NÃO commitadas de outra frente (plano de integração do Tiny: MAPA, PRÓXIMOS PASSOS e um "003 - PLANO…") — nada dela entra aqui; o `main` local de lá não é mexido (o envio vai direto da branch para `origin/main`).

## Validação ao vivo (28/09) — o dono logado nas duas abas

O dono: *"Faça tudo, desde a criação do usuário até o teste de tela; eu logo aqui com minha conta, você cria os usuários e vai testar."* Criar conta e entrar com senha seguem bloqueados para a sessão (explicado ao dono); ele entrou com a PRÓPRIA conta em `localhost:5175` e em `127.0.0.1:5175` (origens diferentes = duas sessões). Resultados, medidos com `PerformanceObserver` (A-30), no §2b do handoff: abrir o app = 1 chamada do chat; criar canal → a outra aba relê a lista 1× pelo sinal; mensagem da aba A chega na B **sem leitura** (canal privado com o JWT real) e vice-versa; 11 envios = 11 POST e zero leitura; reabrir = 1 página, anteriores = +1; renomear chega sozinho; arrasto real com o mouse, persistido e restaurado ao padrão; 375/768/1280; `/tablet` sem balão; Equipe e Meu Perfil normais depois da leitura por coluna; console limpo.
- **Achados corrigidos na hora** (`afb2c30`): **E-53** (lista relida 2× ao criar canal — fica só o sinal), **E-54** (conversa cortada no celular — `grid-cols-1`; botões 36 → 44px). Registrados na memória de aprendizado com o **A-30** (como medir requisições ao vivo; duas origens para duas sessões).
- Não testado ao vivo, de propósito: não lida por OUTRA pessoa (as duas abas eram o dono) e o parabéns (seria aniversário falso para os sócios) — cobertos pelos testes automáticos e pelo ensaio no banco real.
- Artefato de teste: canal "Teste do chat (pode ignorar) - renomeado" (conversa 2), só com o dono, 13 mensagens — conversa não se apaga; oferecido ao dono tirá-lo do canal (some da lista).

## Mapa do merge com a SESSAO-24 (o que a 24 informou no fim, 27/09)

A 24 (branch `sessao-24-producao-concluida-cancelamentos`, local, sem push) está pronta esperando a conferência de telas. Não mexeu em schema depois da 37, nem no aplicador, nem no `CLAUDE.md`; rodou só manutenção de dado (arquivou por evento as unidades 518 e 537, de pedidos entregues no Tiny). A 38 não a afeta (o front dela só lê `id`, `nome` e o `COLUNAS_PERFIL`). Conflitos esperados — **manter os dois lados, a 24 primeiro**:

| Arquivo | 24 | 26 |
|---|---|---|
| `src/componentes/Layout.tsx` | linha do `ehDeTerminal` (inclui `aguardo`) | grupo Início, `ProvedorChat`, `BalaoChat` — sem sobreposição |
| `supabase/testes/testar-migrations.mjs` | 3 checks antigos do seed (10 setores) + bloco S24 antes do Resumo | simulador do Realtime no topo + bloco S26 antes do Resumo |
| Decisões | D-58…D-62 no fim | D-65…D-68 no fim |
| Requisitos | RF-77/78/79/87/88/89 | seção nova "Comunicação interna" (RF-90…95) |
| Memória | E-44/45/46, M-15/M-16 | E-50/51/52 |
| Modelo de Sistema | seção nova antes de "Controle de tempo" | seção nova antes de "Controle de tempo" |
| ORDEM / MAPA / PRÓXIMOS PASSOS | linha 25 + entradas de 27/09 | linha 26 + entradas de 27/09 |

Depois de juntar: `npm run test:banco` (2 rodadas) com a 37 e a 38 — a combinação já passou aqui com 446 verificações.

## Conferência contra a demanda (2ª leitura, no fim)

| Critério de aceite | Como foi provado | Situação |
|---|---|---|
| `/inicio/chat` no desktop e no celular; balão em toda tela logada (menos `/tablet`), arrastável, posição guardada | código + testes da posição (limite, padrão) + teste de integração (balão, badge, painel) | ✅ código · ⏳ visual com o dono |
| Canal, particular e avisos; quem não participa não lê nada, nem pela API (papel simulado) | harness `set role authenticated` + ensaio no banco real + canal privado recusado ao vivo | ✅ |
| Mensagem aparece sem recarregar; badge sobe | broadcast real (167 ms) + linhas de broadcast por participante no ensaio + teste de integração | ✅ · ⏳ duas contas ao vivo |
| Aba Network: fechado = só a lista; abrir = 1 assinatura + 1 página; fechar desinscreve | teste de integração que conta leituras e canais | ✅ · ⏳ conferir ao vivo |
| Data de nascimento (próprio e admin); parabéns no dia (forjando a data) | harness + ensaio no banco real com data forjada | ✅ · ⏳ na tela |
| Histórico por cursor | harness + teste de integração | ✅ |
| Canal criado e aviso geral na trilha; conteúdo fora | harness | ✅ |
| Decisões registradas | D-65…D-68 | ✅ |

## Log

- 27/09 · leitura obrigatória completa; aviso à SESSAO-24 e protocolo fechado; worktree + branch criadas; `.env.local` copiado (sem exibir) e `npm install`.
- 27/09 · checkpoint acima; entendimento e perguntas enviados ao dono — **aguardando o OK para codar**.
- 27/09 · `npm run test:banco` de linha de base na worktree (sem mudança nenhuma): ✅ verde — 21 tabelas plt_, 3 visões, 43 políticas.
- 27/09 · **a SESSAO-24 aplicou a migration 37 em produção** (aplicador completo da branch dela, 1..37 ✔; integração idêntica, impressão digital `e2109f3a…`, 65 colunas; 21 tabelas, 3 visões, 43 políticas, **10 setores** — entrou o terminal `aguardo` —, 46 etapas; + as manutenções dela: 20 etapas com `setor_destino_id`, 3 peças arquivadas, 2 para o aguardo). As 29/36/37 aplicadas são exatamente as do commit `df2109a`. **Consequência para esta frente: caso (b) do protocolo — a 38 será aplicada SOZINHA (só o arquivo), nunca pelo aplicador completo desta pasta; e antes disso ela é testada por cima da 37 (migrations do `df2109a` + a 38 no PGlite).**
- 27/09 · respostas do dono recebidas (acima) + adendo do websocket. Leitura do banco para o desenho (acima) com 2 ensaios A-11 (rollback): (1) `authenticated` lê CPF/PIN/convite — **E-50 registrado na memória de aprendizado na hora**; (2) `postgres` cria política em `realtime.messages` e `realtime.send` grava.
- 27/09 · **migration 38** escrita: `supabase/migrations/20260927180000_plt_chat_interno.sql`. Decisões técnicas no próprio arquivo: sem `criada_por` na conversa (quem cria o canal = participante `administrador`; nada que ninguém mostra — banco enxuto); `sobre_usuario_id` sem FK (a exclusão D-49 não pode esbarrar em mensagem imutável); índice único do aniversário por `(pessoa, dia em Natal)` (`timezone(text, timestamptz)` é IMMUTABLE — conferido no PGlite); `#variable_conflict use_column` nas portas `returns table` (as colunas de saída têm nomes de coluna de tabela); teto de página NO BANCO (5 conversas, 10 mensagens/membros — pedir 50 devolve o teto); o total de não lidas só na 1ª página, com teto 100 por conversa.
- 27/09 · harness: simulador do Realtime no ambiente (schema `realtime` com `messages`, `send()`, `topic()` — a linha é a prova do broadcast) + bloco SESSAO-26 antes do Resumo (pessoas `chat.*`, sessões `…c00N`). 1ª rodada: 2 falhas **do teste** (a 2ª página não selecionava `pode_escrever`/`administra`; consulta pedia `id` em vez de `conversa_id`) → corrigidas. **`npm run test:banco` ✅ 389 verificações, 0 falha** (24 tabelas plt_, 3 visões, 46 políticas).
- 27/09 · commit `fa5fed4` (migration 38 + harness).
- 27/09 · **teste da 38 POR CIMA da 37** (pasta temporária `_combinado_tmp/`, fora do git: migrations do `df2109a` + 38, harness `b99316b` da 24 + meu simulador e meus cenários, manutenções do `b99316b`): 1ª montagem quebrou por **E-51** (`replace` com `$$`) e depois por falta das manutenções que o harness da 24 lê → corrigido → **✅ 446 verificações, 0 falha, 2 rodadas**.
- 27/09 · **ensaio A-11 da 38 no banco real** (script `ensaio-38.mjs` no scratchpad da sessão; begin → 38 → provas → ROLLBACK): 3 tabelas; Avisos gerais com 3/3 cadastros; segurança (authenticated não lê cpf/pin/convite/nascimento, lê as de trabalho; anon nada; `select count(cpf)` como authenticated = permission denied); política `plt_chat_ouvir`; job `0 11 * * *`; admin A publica → 1 linha no canal da conversa + 3 sinais (= ativos) + log sem conteúdo; admin B: 1ª página com 1 não lida e total 1; entrada no websocket emulada como o Realtime faz (papel authenticated + `request.jwt.claims` + `realtime.topic`): B entra no próprio canal e no da conversa, NÃO no de A; aniversário forjado → 1 parabéns, não repete; digital idêntica; depois do rollback nada ficou. ✅
- 27/09 · aplicador ganhou `--so <arquivo>` (aplica só aquela migration, com a mesma transação e a mesma conferência da integração). Prova a seco: plano "SÓ 20260927180000_plt_chat_interno.sql".
- 27/09 · S24 avisada antes → **migration 38 APLICADA em produção** (`npm run banco:aplicar -- --confirmar --so 20260927180000_plt_chat_interno.sql`): integração estrutura e linhas **idênticas** (digital `e2109f3a…`, 65 colunas; clientes 10.699 · pedidos 5.410 · itens 8.093 · eventos 8.473 · gp 1); 24 tabelas · 3 visões · 46 políticas · 10 setores · 46 etapas. Conferido depois: cpf/pin/convite/nascimento NÃO legíveis, nome sim; Avisos gerais 1 com 3 participantes; job ativo; política ativa; objetos da 37 intactos. S24 avisada depois.
- 27/09 · advisors: segurança — nenhum ERROR; +13 WARN `authenticated_security_definer_function_executable` (as 11 portas do chat + ler/definir nascimento — endpoints de propósito, E-11); o resto pré-existente. Desempenho — INFO FK `plt_chat_mensagens_autor_id_fkey` sem índice (só pesaria na exclusão D-49, rara; índice custaria escrita a cada mensagem — deixado, como os outros 28 da casa) e INFO índice novo ainda não usado.
- 27/09 · commits `ef6dd06` (aplicador `--so`) e `b53e33a` (cofre).
- 27/09 · **front** (`src/chat/*`, `src/paginas/Chat.tsx`, Layout, App, Meu Perfil, Equipe, `perfil/api.ts`). Decisões técnicas: **registro de canais** (`canais.ts`) — `supabase.channel(t)` devolve o canal existente e sair é assíncrono (lido no código do realtime-js 2.112.4: `channel()` acha por tópico; `subscribe` num canal que não está fechado não faz nada) → um canal por tópico com contagem, saída adiada 1,5 s, canal novo só depois do antigo sair; **assina antes de ler** (a leitura espera o SUBSCRIBED, com desistência em 4 s); **cache com a pessoa na chave** + apagado ao desmontar (o `sair()` não limpa cache); efeito do provedor depende de `perfil.id`/papel, não do objeto (trocar tema recriava o `perfil`); `set-state-in-effect` respeitada (estado só em callbacks; conversa monta com `key`); leitura extra só em 3 casos, todos de página: 1ª página ao abrir o app, reler a 1ª ao cair o websocket ou ao aparecer conversa fora das páginas carregadas.
- 27/09 · `tsc` ✔ · `lint` ✔ · `test` ✔ (71 → 72 com o de integração) · `build` ✔ · mojibake 0. O **teste de integração** (`chat.integracao.test.tsx`, Supabase simulado contando leituras e canais) pegou o plural "mensagems" no nome acessível do balão → **E-52** registrado e corrigido. Commits `b6d9201` e `4d87ff1`.
- 27/09 · navegador: o painel de preview quebra a linha de comando com espaço no argumento (`'C:\Program' não é reconhecido`) → configuração `plataforma-sessao-26` no `launch.json` da pasta principal (ignorado pelo git) apontando para a junção sem espaço `C:\Users\wccau\Domoby\s26` → worktree. Servidor no 5175 com o código desta branch (conferido pelo fonte servido); tela de login sem erro de console; deslogado, zero chamada ao Supabase e nenhum balão. **Sem login não há como ver as telas logadas** — a sessão não entra com senha de ninguém na autenticação de produção.
- 27/09 · **prova ao vivo do websocket** (`ensaio-websocket.mjs` no scratchpad; chave de serviço lida do `.env.local`, nunca impressa): cliente em canal PRIVADO de tópico descartável recebeu o `realtime.send` feito no banco em **167 ms**; cliente anônimo tentando entrar em `plt-chat-c:1` (Avisos gerais) → **CHANNEL_ERROR "Unauthorized: You do not have permissions to read from this Channel topic"**. Nada do chat foi gravado.
- 27/09 · cofre: D-65…D-68, RF-90…RF-95, Esquema do Banco, Modelo de Sistema, demanda (Resultado), ORDEM/MAPA/PRÓXIMOS PASSOS, E-50 promovida à regra 10 dos dois `CLAUDE.md` (+ o `--so`), handoff.
