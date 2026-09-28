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

- [ ] 1. Migration 38 aditiva: 3 tabelas + RLS por participação + imutabilidade + avisos semeados/participação automática + RPCs (lista 5, mensagens 10, membros 10, enviar, lida, particular, canal, membros, escritores) + broadcast privado + política de `realtime.messages` + data de nascimento + correção de segurança de `plt_usuarios` + aniversário com pg_cron
- [ ] 2. `test:banco` 2 rodadas com os cenários do chat (RLS com papel simulado, broadcast no stub, paginação, aniversário, segurança) + teste da 38 POR CIMA da 37 (migrations do `df2109a` + harness `b99316b` da 24)
- [ ] 3. Front: `/inicio/chat` (lista à esquerda, conversa à direita; celular uma coisa por vez) + filho "Chat" em Início
- [ ] 4. Balão global arrastável (pointer events, posição por usuário no aparelho), badge de não lidas, painel compacto; fora do `/tablet` e da própria tela do Chat; convivência com a bolinha de execução
- [ ] 5. Canais (só líder/admin criam; quem cria administra: renomear, pôr/tirar membros), particulares, avisos (admin define quem escreve)
- [ ] 6. Websocket: 1 canal da pessoa + 1 por conversa aberta; zero leitura fora das páginas; reconexão relê só a 1ª página
- [ ] 7. Data de nascimento no Meu Perfil (próprio) e na Gestão da equipe (admin)
- [ ] 8. Validação: tsc · lint · test · build · F-07 (375/768, arrasto no touch, balão sem cobrir ação) · ensaio A-11 no banco real · F-08 (digital antes/depois) · aplicar SÓ a 38 · advisors
- [ ] 9. Cofre: D-65…, RF-90…, Esquema do Banco, Modelo de Sistema, memória (E-50…, A-30…), demanda, ORDEM/MAPA/PRÓXIMOS PASSOS, handoff

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
