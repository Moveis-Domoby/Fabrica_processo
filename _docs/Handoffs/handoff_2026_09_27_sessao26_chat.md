---
titulo: Handoff — SESSAO-26 · Chat interno (websocket privado, leitura só por página, aniversários)
tipo: handoff
data: 2026-09-27
atualizado: 2026-09-28
tags: [handoff, sessao, plataforma, bloco-5, chat, websocket, seguranca, d-65, d-66, d-67, d-68]
---

# 📋 Handoff — SESSAO-26 · Chat interno (D-65…D-68)

**Branch:** `sessao-26-chat-interno` — numa **worktree própria** (`C:\Users\wccau\Domoby\Domoby - Fabrica - sessao-26`), porque a SESSAO-24 rodou **ao mesmo tempo** na pasta principal. **Validada ao vivo com você logado e mesclada na `main` em 28/09 (D-20)** — `origin/main` = `3503d77`, publicado pelo Vercel sem erro —, depois de trazer a `main` com a SESSAO-24 (446 verificações do banco e 80 testes no código juntado).
**Banco:** migration **38 APLICADA em 27/09** com o seu OK (resposta 7) — **sozinha** (`npm run banco:aplicar -- --confirmar --so 20260927180000_plt_chat_interno.sql`), porque a 24 aplicou a 37 antes e reaplicar tudo desta pasta desfaria a dela. Integração do Tiny com estrutura e linhas **idênticas** antes/depois (digital `e2109f3a…`, 65 colunas).
**Demanda:** [[SESSAO-26 - Chat Interno]] · **Memória:** `_docs/Plataforma/Execucao/SESSAO-26.md` · **Decisões novas:** D-65, D-66, D-67, D-68 (suas respostas + o adendo do websocket)

## 1. O que foi feito

- **O chat, com duas portas.** `Início → Chat` (lista à esquerda, conversa à direita; no celular, uma coisa por vez) e o **balão** no canto inferior direito de toda tela logada — com o número de não lidas, **arrastável** com o dedo ou o mouse (a posição fica guardada, por pessoa, no aparelho). Tocou, abre um painel pequeno sem sair da tela. O balão não aparece no `/tablet` nem na própria tela do Chat, e nasce **ao lado** da bolinha de "em execução" (as duas nunca se cobrem).
- **Três tipos de conversa (D-65):** **canais** (só líder e admin criam; quem cria administra — muda o nome, põe e tira pessoas), **particulares** (conversa a dois com qualquer colega) e os **Avisos gerais** (todos leem; o admin escreve sempre e escolhe, no botão "Quem escreve", quem mais pode escrever). **Ninguém lê conversa de que não participa — nem o admin**, nem pela API.
- **Aniversário (D-66):** campo **data de nascimento** no Meu Perfil (a própria pessoa) e na Gestão da equipe (ícone de bolo, só admin). No dia, às **08:00**, o Sistema publica nos Avisos gerais: *"🎉 Hoje é aniversário de {nome}! Parabéns — toda a Domoby deseja um ótimo dia."* — uma vez por pessoa (quem nasceu em 29/02 é lembrado em 28/02 nos anos não bissextos).
- **Do jeito que você pediu no adendo (D-67):** a comunicação é **por websocket** — o banco empurra a mensagem; a tela **só lê página**: a lista de **5 em 5** conversas e as mensagens de **10 em 10** (o teto é do banco), a próxima só ao rolar ou tocar em "Ver mais / Ver mensagens anteriores". **Nada de consulta repetida**: com o balão fechado, a única leitura é a 1ª página da lista na abertura do app (é ela que acende o número); abrir uma conversa = 1 canal de websocket + 1 página; fechar = sai do canal. Enviar, marcar como lida, criar canal etc. são só POST.
- **Segurança (D-68 — a sua resposta 6):** descobri que **qualquer pessoa logada conseguia ler, pela API, o CPF, o PIN guardado e o token de convite de todos** (o Supabase libera a tabela inteira por padrão, e isso passava por cima das proteções da S03). Corrigido na mesma migration: o navegador agora lê **só os dados de trabalho**; CPF, PIN, convite e a data de nascimento ficaram fora. Hoje só existem 3 contas (todas admin), então nada vazou para fora da diretoria.
- **Trilha (D-40):** canal criado/renomeado, pessoa posta/tirada, quem escreve nos avisos, aviso publicado e data de nascimento alterada vão para o registro — **sem o conteúdo**. Mensagem comum e abertura de particular não vão (a trilha mostraria aos admins quem conversa com quem).

## 2. Verificação executada

| O quê | Resultado |
|---|---|
| `npm run test:banco` (2 rodadas) | ✅ **389 verificações, 0 falha** — **88 novas do chat**: segurança por coluna (com o grant de tabela do Supabase simulado), Avisos gerais e participação automática, data de nascimento (própria/admin/recusas/trilha sem valor), canal só por líder/admin, particular única por par, enviar (broadcast no canal da conversa + sinal para cada participante, no simulador do Realtime), escritores dos avisos, mensagem imutável, **RLS com papel simulado** (fora do canal = 0 linhas; admin não lê particular), entrada no canal de websocket (só o próprio / só quem participa), lista 5 por página com cursor e total, marcar lida, mensagens 10 por página, teto de 100 não lidas, membros, aniversário (texto, não repete, 29/02) |
| **Teste da 38 POR CIMA da 37 da SESSAO-24** | ✅ **446 verificações** — as migrations e o harness definitivos da 24 + a 38 + os cenários do chat, 2 rodadas |
| **Ensaio no banco real** (aplica a 38 numa transação, prova, desfaz — nada gravado) | ✅ com os usuários reais: Avisos gerais com 3/3 pessoas; CPF/PIN/convite/nascimento negados ao navegador; admin A publica → 1 broadcast na conversa + 1 sinal por pessoa ativa; admin B vê 1 não lida e o total 1; B entra no próprio canal e no da conversa, **não** no de A; aniversário forjado para hoje → 1 parabéns, não repete |
| Aplicação real (só a 38) | ✅ integração idêntica; 24 tabelas · 46 políticas; conferido depois: CPF não legível, job `plt-chat-aniversarios` ativo, objetos da 37 intactos |
| **Websocket AO VIVO no Realtime do projeto** | ✅ broadcast disparado no banco chegou ao cliente em **167 ms** (canal privado); **cliente sem login foi recusado** ao tentar entrar no canal dos Avisos gerais ("Unauthorized…") |
| `npx tsc -b` · `npm run lint` · `npm test` · `npm run build` | ✅ · ✅ · ✅ **72** (15 novos do chat + 1 de integração) · ✅ |
| **Teste de integração do chat** (Supabase simulado contando leituras e canais — o critério da aba Network) | ✅ fechado: 1 canal + 1 leitura (5), leitura só depois de o canal ouvir; sinal sobe o número sem reler; abrir o painel não relê; abrir a conversa: +1 canal + 1 página (10); lida por POST; mensagem nova chega sem reler; fechar sai do canal. **Pegou o plural "mensagems"** no nome do balão (corrigido — E-52) |
| Mojibake (E-34) | ✅ zero |
| Advisors | ✅ nenhum ERROR; +13 WARN esperados (as portas novas — padrão da casa); desempenho: INFO de FK sem índice (deixada de propósito) |
| Navegador | ✅ o app desta branch sobe no **5175** sem erro; deslogado não faz nenhuma chamada ao Supabase nem mostra balão. ⏳ **Telas logadas: com você** — eu não posso entrar com a senha de ninguém |

## 2b. Validação ao vivo (28/09 — você logado em duas abas, `localhost:5175` e `127.0.0.1:5175`)

Medido na própria página (observador de requisições do navegador — o registro de rede do painel não mostra outra origem):

| O quê | Resultado |
|---|---|
| Abrir o app (Meu Painel) | ✅ o chat fez **1** chamada — `plt_fn_chat_conversas` (1ª página); as outras 12 são do painel e do menu |
| Criar canal "Teste do chat (pode ignorar)" na aba A | ✅ na aba B a lista foi relida **1 vez**, sozinha, pelo sinal "entrou" do websocket |
| Aba B abre o canal | ✅ painel sem reler a lista; conversa = **1** página |
| Aba A envia; aba B com a conversa aberta | ✅ **chegou sem recarregar e sem nenhuma leitura na B** (canal privado com o seu login real) — e a resposta da B chegou na A do mesmo jeito |
| 11 mensagens seguidas da A | ✅ A: 11 envios e **nenhuma leitura**; B: as 13 na tela, **zero leitura** |
| Voltar à lista / reabrir / "Ver mensagens anteriores" | ✅ voltar: 0 leitura (a prévia já tinha vindo pelo websocket); reabrir: **1** página (10); anteriores: **+1** página (13, e o botão some) |
| Renomear o canal na A | ✅ o título mudou na B **sozinho**, zero leitura |
| Avisos gerais (admin) | ✅ "Todos leem · você pode escrever"; "Quem escreve": "Por enquanto, só os admins escrevem" (ninguém foi liberado) |
| Nova conversa | ✅ lista de pessoas (só os outros) e busca "gui" → Guilherme, uma leitura por intenção; nenhuma conversa aberta com os sócios |
| Arrastar o balão (mouse real) | ✅ mudou de lugar, **não abriu o painel**, e continuou no mesmo lugar depois de recarregar (depois voltei ao padrão) |
| Celular 375 / tablet 768 / computador 1280 | ✅ depois da correção: nada cortado, sem rolagem lateral, nenhum alvo < 44px; o balão fica ao lado da bolinha de execução sem encostar; o painel ocupa a tela no celular; 2 colunas a partir de 1024px |
| `/tablet` | ✅ sem balão e sem menu |
| Meu Perfil / Gestão da equipe | ✅ seção Aniversário (data vazia — não mexi); a equipe carrega normal depois da correção de segurança; o bolo abre a data pela porta própria (fechado sem salvar) |
| Console | ✅ zero erro nas duas abas |

**3 achados corrigidos na hora** (commit `afb2c30`): (1) criar canal relia a lista **2 vezes** (a tela + o sinal) → fica só o sinal; (2) no celular a conversa da tela do Chat era **cortada à direita** (a coluna da grade crescia até o título) → corrigido; (3) botões do chat com **36px** → 44px.

**Não testado ao vivo, de propósito:** o número de não lidas subindo por mensagem de OUTRA pessoa (as duas abas eram você — mensagem sua não conta) e o parabéns publicado (seria um aniversário falso seu para os sócios). Os dois estão provados nos testes automáticos e no ensaio do banco real. O canal **"Teste do chat (pode ignorar) - renomeado"** (só com você e 13 mensagens de teste) **saiu da sua lista em 28/09**, a seu pedido — ver §4.

## 3. Como validar (10 minutos)

O servidor desta branch está no ar em **http://localhost:5175** (se tiver caído: na pasta da worktree, `npm run dev -- --port 5175`).

1. Abra o 5175 no navegador do painel e **entre com a sua conta**. O balão aparece no canto de baixo, à direita. **Arraste-o** para outro lugar e recarregue a página: ele fica onde você deixou.
2. Toque no balão → o painel abre com os **Avisos gerais**. Abra e escreva *"Teste do chat"* (admin escreve sempre).
3. **Com uma segunda conta** (outro admin, numa janela anônima do seu Chrome, também no 5175): o número do balão sobe **sem recarregar**; abra a conversa e responda — na primeira janela, com a conversa aberta, a resposta chega sozinha.
4. **Aba Network (F12):** com o balão fechado, só aparece `plt_fn_chat_conversas` (uma vez). Abrir uma conversa: `plt_fn_chat_mensagens` uma vez (no WS, o `phx_join` de `plt-chat-c:…`). Fechar: `phx_leave`. Nada se repete sozinho.
5. **Novo canal** (botão na lista) com a outra conta → ela vê o canal aparecer. Em "Pessoas", mude o nome, tire e ponha alguém.
6. **Nova conversa** → escolha a pessoa → conversa particular.
7. **Meu Perfil → Aniversário:** cadastre a sua data. Para ver o parabéns hoje: coloque a data de hoje e rode no SQL do Supabase `select plt_privado.fn_chat_publicar_aniversarios();` (⚠️ vira uma mensagem de verdade nos Avisos gerais — ou espere as 08:00).
8. **Gestão da equipe:** ícone de bolo numa pessoa → data de nascimento pelo admin.
9. **Celular (375px) e tablet (768px):** a lista e a conversa aparecem uma de cada vez no celular; o balão não pode cobrir botão — se cobrir, arraste. No `/tablet`, nada de balão.

## 4. Pendente / decisões para você

> [!info] ↪️ 01/10/2026: o dono **postergou o chat** — os itens em aberto abaixo (botão "Sair do canal", escritores dos Avisos gerais, ver as não lidas com uma 2ª pessoa) saem da lista de pendências e voltam quando ele retomar o chat.

- ✅ **Validada ao vivo (§2b) e mesclada** em 28/09 — `3503d77` na `main`, Vercel ✅. A SESSAO-24 entrou antes; os dois blocos do harness e os índices do cofre foram juntados aqui, e o `test:banco` com a 37 e a 38 juntas passou (446). A SESSAO-24 e as sessões em curso (Frete fora da produção — dona da migration 39 — e gaveta do celular) foram avisadas.
- ✅ **Balão por cima do menu aberto, no tablet** (E-57) — **corrigido em 28/09** pela sessão da gaveta do celular, com o seu OK: com o menu aberto no celular e no tablet, o escurecido e o menu agora ficam por cima do balão do chat, da bolinha de "em execução" e da janelinha do chat. Conferido também daqui, na tela, a 768px: o toque no balão e na bolinha cai no escurecido; com a janelinha do chat aberta, onde ela e o menu se cruzam, o toque cai no menu.
- ✅ **Sua data de nascimento:** cadastrada por você no Meu Perfil em 28/09. Conferido sem ler a data: ficou salva e a trilha registrou a mudança **sem o valor** (só de quem foi). No seu dia, às 08:00, o parabéns sai sozinho nos Avisos gerais.
- ✅ **Canal de teste:** você saiu dele em 28/09, a seu pedido. Como o sistema **não deixa ninguém tirar a si mesmo** de um canal, foi feito direto no banco, do mesmo jeito que o sistema faz (saída marcada + registro na trilha com o motivo + aviso ao vivo para as suas abas). Conferido: o canal sumiu da sua lista sem recarregar; ninguém mais participa dele; as 13 mensagens ficam guardadas (conversa não se apaga), sem ninguém que as veja.
- ⚪ **Para decidir quando quiser:** hoje **ninguém sai sozinho de um canal** — nem quem o administra. Quem administra tira os outros; para sair, a pessoa depende de outro administrador. Se quiser um botão "Sair do canal", vira ajuste numa próxima sessão.
- 🔶 **Escritores dos Avisos gerais:** por ora só os admins escrevem. Se quiser liberar líderes ou outra pessoa: abra os Avisos gerais → "Quem escreve".
- ⚪ Ferramenta nova do banco: `npm run banco:aplicar -- --confirmar --so <arquivo>` aplica **uma** migration (para sessões em paralelo). Virou regra no `CLAUDE.md` (regra 10), junto com a leitura por coluna de `plt_usuarios`.
- ⚪ Limpeza depois da validação: a configuração `plataforma-sessao-26` no `.claude/launch.json` da pasta principal (fora do git) e o atalho de pasta `C:\Users\wccau\Domoby\s26` (o painel não aceita caminho com espaço) — **você decidiu manter** (28/09: "não precisa").
- ⚪ Fora do escopo, apontado pelos advisors do Supabase (já existiam): a proteção contra senha vazada do Auth está desligada; `pg_net` no schema public.

## 5. Arquivos alterados

```
supabase/migrations/20260927180000_plt_chat_interno.sql   (nova — migration 38)
supabase/testes/testar-migrations.mjs                       (simulador do Realtime + 88 verificações da S26)
supabase/aplicar-migrations.mjs                             (opção --so)
src/chat/  (novo)  tipos · api · cache (+teste) · canais · contexto · consultas · ProvedorChat · BalaoChat
                   · posicao · formato (+teste) · chat.integracao.test.tsx
                   · componentes/{AvatarChat, SeletorPessoas, ListaConversas, PainelConversa, ModalMembros, ModaisNovos}
src/paginas/Chat.tsx (nova) · src/App.tsx (rota) · src/componentes/Layout.tsx (filho Chat, provedor, balão)
src/paginas/MeuPerfil.tsx (aniversário) · src/paginas/Equipe.tsx (bolo do admin) · src/perfil/api.ts (ler/definir nascimento)
CLAUDE.md (regra 10)
_docs: D-65…D-68 · RF-90…RF-95 · Esquema do Banco · Modelo de Sistema · Memória (E-50 promovida, E-51…E-54, E-57, E-58, A-30, A-32, A-33)
       · CLAUDE (repo) · demanda 26 · ORDEM · MAPA · PRÓXIMOS PASSOS · Execucao/SESSAO-26.md · este handoff
```

## 6. Notas do cofre atualizadas

[[PLT - Decisoes de Produto]] (D-65…D-68) · [[PLT - Requisitos]] (RF-90…RF-95) · [[SUPA - Esquema do Banco]] (migration 38 + leitura por coluna de `plt_usuarios`) · [[PLT - Modelo de Sistema]] (chat) · [[PLT - Memoria de Aprendizado]] (E-50 → promovida, E-51…E-54, E-57, E-58, A-30, A-32, A-33) · [[CLAUDE - Regras do Claude Code (repo)]] (regra 10) · [[SESSAO-26 - Chat Interno]] · [[000 - ORDEM DAS SESSOES]] · [[000 - MAPA DO PROJETO]] · [[000 - PROXIMOS PASSOS]]

## Ver também

[[handoff_2026_09_26_sessao25_estoque]] · [[SESSAO-24 - Estoque Nucleo - Aguardo Cancelamentos e Alocacao]] · [[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]]
