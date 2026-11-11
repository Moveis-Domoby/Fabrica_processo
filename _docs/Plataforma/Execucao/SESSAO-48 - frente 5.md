---
titulo: Diário de execução — SESSAO-48 · frente 5 (a plataforma que recarrega sozinha)
tipo: execucao
data: 2026-11-11
tags: [execucao, sessao-48, publicacao, recargas, versao, abertura, tablet, modo-tv, auditoria]
---

# Diário — SESSAO-48 · frente 5 (11/11/2026)

Demanda: [[SESSAO-48 - Cancelar Fabricacao de Verdade - Peca de Pedido Pergunta o Destino]] — **Frente 5**, itens (a) a (e) (o (f), a regra da casa, é do supervisor).
Diário da sessão (o supervisor): [[SESSAO-48]]. Este diário é só da frente 5; quem consolida Decisões, Memória, Esquema, Lei e handoff é o supervisor, a partir daqui.

Cópia temporária isolada (worktree) no ramo `sessao-48-f5-recargas`, nascida do commit base `1999e2d`. Nada de banco de produção (nem leitura — o ambiente barra sem a ordem do dono), Vercel, n8n, ClickUp nem envio (`push`); nenhum `cd`. Migration reservada: `20261111050000_plt_abertura_motivo.sql`. Faixa de teste: pedidos 97551…, produtos 924851… (o bloco da bateria não precisou criar pedido nem produto).

## Partida

- Lido antes de qualquer código: o brief comum e o desta frente, `CLAUDE.md`, a demanda (a frente 5 duas vezes, os critérios de aceite e as notas), o diário do supervisor (as lições que valem), a memória (E-33, E-98, E-103, A-123, A-150), a Lei de Desempenho (§1–§5 e §12), a função de abertura vigente (extraída: `20261022050010_plt_tempo_util_standby.sql`, 4 definições ao todo), a trilha (`plt_fn_registrar_log`, `plt_logs_atividade`), a Auditoria (`plt_fn_auditoria`, `src/paginas/Auditoria.tsx`, `src/auditoria/rotulos.ts`), a medição da plataforma (`plt_fn_medir_tela`, `plt_medicoes_web`), o cliente de sessão (`ProvedorSessao`, `abertura.ts`, `api.ts`, `medicao.ts`), a função `autenticacao` (`tablet-entrar`), a tela do setor, o Modo TV, a casca (`Layout`) e a biblioteca de sessão instalada (`@supabase/auth-js` 2.112.4 — `setSession`, `_recoverAndRefresh`, `_notifyAllSubscribers`, o canal entre abas).
- Documentação pública da Vercel lida (11/11): `vercel.json` → `ignoreCommand`; Configurações do projeto → "Ignored Build Step"; o guia do "Ignored Build Step"; as variáveis de sistema; a "Skew Protection".

## Task list (espelha a frente 5 da demanda)

- [x] (a) Documentação não publica o site: `ignoreCommand` no `vercel.json` (só vale quando chegar à `main`, com o OK do dono).
- [x] (b) A versão é o código, não o commit: nasce dos arquivos montados, vai no `versao.json`; a página sabe a própria versão sem embutir no pedaço de entrada.
- [x] (c) Recarregar só em momento seguro: tablet e TV (sem janela, sem PIN, 1 min sem toque); escritório na troca de tela; pedaço sumido: "Atualizando a plataforma…" e uma recarga só; a proteção contra versões misturadas (Skew Protection) — só pesquisar e perguntar.
- [x] (d) A trilha diz por que a página abriu: tipo de carga, aba descartada, o motivo da própria plataforma; a porta de abertura grava; a Auditoria mostra em português; bloco da bateria + cadeia do bloco 38.
- [x] (e) O laço da troca de setor: a causa pelo código, as consultas para confirmar; a troca recarrega uma vez só e o que não é recarga não vira abertura; o padrão de 40 min.
- [x] Testes de tela (versão nova, a guarda da recarga, o contexto da abertura, o rótulo da Auditoria); tipos, lint, vitest, build; bateria 2×.

## O achado que explica a maior parte das recargas depois de cada publicação

**O commit embutido no pedaço de entrada trocava o nome de 89 dos 215 arquivos a cada commit — até de um commit só de documentação.** A versão era `VERCEL_GIT_COMMIT_SHA` posta no código pelo `define` (`__VERSAO_APP__`), dentro do pedaço de entrada (`index-*.js`). O nome de cada arquivo traz o resumo do conteúdo; 86 pedaços importam a entrada pelo nome, então mudar a entrada muda o nome deles também (em cascata). Provado montando o MESMO código com dois commits fingidos (`VERCEL_GIT_COMMIT_SHA=aaaa…` e `bbbb…`, a configuração de antes): **89 nomes diferentes de 215**.

Consequência: depois de QUALQUER publicação, a página aberta (tablet, escritório) que abrisse uma tela ou janela ainda não carregada (a janela do card no tablet, a busca, qualquer tela do menu) pedia um arquivo que já não existia no ar → `vite:preloadError` → **recarga na hora**, sem aviso. E o aviso de versão nova acendia mesmo sem código novo. Isto, somado às 9 publicações de 09/11 17:34–10/11 00:37 (a maioria só de cofre), é a "plataforma que recarrega sozinha" do lado das publicações.

## (b) A versão é o código montado — `vite.config.ts`

- O plugin `versao-do-app` roda no fim da montagem (`generateBundle`, `order: 'post'` — o index.html e o CSS já estão no pacote): **versão = sha256 dos nomes ordenados de todos os arquivos emitidos (menos `index.html` e `versao.json`) + o conteúdo do index.html, 12 primeiros hexadecimais**. Grava `versao.json` (`{ "versao": … }`, a mesma forma de antes) e escreve `<meta name="domoby-versao" content="…">` no index.html.
- A página sabe a própria versão pelo index.html que a carregou (`versaoDaPagina()` em `src/lib/recarga.ts`), **nunca pelo pedaço de entrada** (a entrada faz parte do resumo — seria circular). O `define` `__VERSAO_APP__` saiu; `src/versao.d.ts` (só declarava ele) foi apagado; `src/lib/medicao.ts` manda `versaoDaPagina()` no `p_versao`.
- A transição: o site de hoje compara o `versao.json` com o commit dele; o primeiro site com esta mudança publica o resumo → as telas abertas veem "versão nova" uma vez e passam para o código novo (no escritório, na troca de tela; no tablet, como hoje, pelo botão).

**Prova (script `s48-f5-rascunho/provar-versao.sh`, montagem sem tsc, 11/11):**

| Montagem | Versão | Nomes diferentes da A (de 215) |
|---|---|---|
| A — o código, commit fingido `aaaa…` | `28ea753f9cca` | — |
| B — o MESMO código, commit `bbbb…` (só documentação mudou) | `28ea753f9cca` | **0** (index.html idêntico) |
| C — muda um pedaço de tela (Caminhões) | `e050b024a037` | 89 (a cascata, inerente aos pedaços que importam a entrada) |
| D — muda só o CSS (uma regra no global.css) | `f7daada4d8f0` | 90 |
| E — muda só o index.html (o título) | `4108dff1635e` | 0 |
| F — de volta ao código da A | `28ea753f9cca` | 0 |

Com a configuração de antes, A e B davam versões `aaaaaaaaaaaa` e `bbbbbbbbbbbb` e **89** nomes diferentes.

## (a) Documentação não publica o site — `vercel.json`

```
if [ -n "$VERCEL_GIT_PREVIOUS_SHA" ] && git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" HEAD -- . ':(exclude)_docs' ':(exclude)Claude outputs' ':(exclude)*.md'; then echo '…montagem pulada…'; exit 0; else echo '…monta.'; exit 1; fi
```

O que a documentação da Vercel diz (11/11):
- saída **0 = pula** (a publicação fica "Canceled"); **1 ou mais = monta**;
- o clone da montagem é **raso, de 10 commits** (`git clone --depth=10`);
- `VERCEL_GIT_PREVIOUS_SHA` = o commit da **última publicação bem-sucedida do projeto naquele ramo**; **vazio na 1ª publicação de um ramo**; só existe quando há um "Ignored Build Step" (é o nosso caso);
- montagem cancelada pelo passo conta na cota diária de publicações (Hobby: 100/dia);
- "se o commit já foi publicado, não nasce publicação nova"; para republicar à mão o mesmo commit, desmarcar **"Use project's Ignore Build Step"** no Redeploy.

Escolhas: compara com a última publicação (não com `HEAD^` — um envio de vários commits cujo último é só de cofre pularia o código dos anteriores); sem commit anterior → monta; commit anterior fora do clone raso ou erro do git → `exit 1` → monta (o normalizador `if/then/else` garante 0 ou 1). `supabase/` continua montando (o resultado sai idêntico — mesma versão, ninguém recarrega; só gasta uma montagem): pôr `supabase/` na lista é decisão do dono.

**Prova local (script `s48-f5-rascunho/provar-ignore.sh`: clone RASO de 10 commits da cópia + `env -C <clone> VERCEL_GIT_PREVIOUS_SHA=… sh -c "<o comando do vercel.json>"`, contra commits reais):**

| Caso | Anterior → atual | Saída |
|---|---|---|
| só cofre desde a última publicação | `fa32700` → `34aa418` (4 arquivos, todos em `_docs/`) | **0 — pula** |
| código + cofre (a base da sessão) | `34aa418` → `1999e2d` (`src/` e `supabase/`) | 1 — monta |
| o mesmo commit (republicar à mão) | `1999e2d` → `1999e2d` | 0 — pula (desmarcar a caixa no Redeploy) |
| 1ª publicação do ramo | (vazio) → `1999e2d` | 1 — monta |
| anterior fora do clone / inexistente | `0123…` → `1999e2d` | 1 — monta (o git dá "bad object") |

**Como provar na Vercel (só depois de chegar à `main`, com o OK do dono):** subir um commit de teste que mexe só numa nota do cofre (ex.: uma linha em `_docs/Plataforma/Execucao/SESSAO-48 - frente 5.md`) → na lista de publicações da Vercel ele aparece **"Canceled"** com a mensagem do passo ("…montagem pulada…") no registro → `https://sistema-domoby.vercel.app/versao.json` segue com a MESMA versão de antes (A-150: conferir no endereço, não no status do commit) e nenhuma tela aberta acende "versão nova".

## (c) Recarregar só em momento seguro

- **Escritório** (`useVersaoNova`, na casca): igual a hoje — sabendo da versão nova, a próxima troca de tela recarrega; agora com o porquê `versao_nova` na trilha.
- **Tablet e TV** (`useRecargaSegura`, em `TelaSetor` e no `ModoTv`): ninguém troca de tela neles, então a versão nova espera o momento seguro — **sem janela aberta (`[role=dialog]`/`[role=alertdialog]`; o PIN é digitado numa janela) e 1 minuto sem toque nem tecla**; com janela aberta, olha de novo a cada 1 minuto. Até lá, o aviso discreto, que no tablet e na TV diz "Ela se atualiza sozinha depois de 1 minuto sem uso." O relógio desse passo só existe com a versão nova já conhecida e não busca dado (olha a tela e recarrega).
- **Quando conferir a versão (gesto ou fato, nunca relógio; no máximo 1 vez a cada 2 min):** no escritório, trocar de tela e voltar à aba (como hoje); **no tablet, também o toque** (antes o tablet só conferia ao voltar à aba — a tela acesa o dia todo nunca sabia da versão nova); **na TV, o aviso do canal do setor ("mudou"), a reconexão e a virada do dia** (a TV não tinha conferida nenhuma, nem aviso).
- **O pedaço que sumiu** (`aoPedacoSumido` em `src/lib/recarga.ts`, ouvido em `src/main.tsx`): mostra "Atualizando a plataforma…" por cima da tela e recarrega **uma vez por versão** (a aba guarda de qual versão saiu); se a mesma versão falhar de novo depois da recarga, ou sem internet (`navigator.onLine` falso), ou sem armazenamento na aba, **não recarrega**: mostra o aviso com o botão "Atualizar" (64 px). Antes: recarga imediata a cada 10 s enquanto falhasse (laço possível) e sem aviso; sem internet, recarregava para a página de erro do navegador.
- **O botão do aviso de versão** passou de 36 px (abaixo do mínimo da casa) para 44 px no escritório e 64 px no tablet e na TV.

**Proteção contra versões misturadas da Vercel (Skew Protection) — só pesquisa, nada ligado:** existe só nos planos **Pro e Enterprise** (não no Hobby); padrão de 12 h no Pro (até a retenção das publicações); precisa de "Enable access to System Environment Variables". **Não é automática para o nosso tipo de site** (Vite puro, sem framework da lista: Next.js, SvelteKit, Qwik, Astro, Nuxt, React Router): seria preciso mandar o id da publicação nos pedidos dos arquivos (`?dpl=` ou cabeçalho) ou pôr o cookie `__vdpl` por um "Routing Middleware" na carga da página. Com ela, a página aberta continua achando os arquivos da versão dela por até 12 h depois de uma publicação de código — o "pedaço sumido" quase não aconteceria. **Pergunta para o dono:** o plano da Vercel é o gratuito (Hobby) ou o Pro? Se for Pro, ligar (e o pequeno middleware) vira decisão dele; se for Hobby, fica como está (a guarda nova e a versão pelo código cobrem a maior parte).

## (d) A trilha diz por que a página abriu

- **Banco — `20261111050000_plt_abertura_motivo.sql`** (gerada por `s48-f5-rascunho/gerar-f5.mjs`: extração da vigente + 3 trocas de contagem exata): `drop function public.plt_fn_abertura(text, boolean)` + `create public.plt_fn_abertura(text, boolean, jsonb default null)` (A-12 — sem sobrecarga), `security invoker` como antes, comentário, `revoke … from public, anon` + `grant … to authenticated`. Com rota e contexto-objeto, o registro `navegacao` que ela já gravava leva `{abertura: true}` + só o que o banco conhece: `carga` ∈ navigate | reload | back_forward | prerender; `descartada` só `true`; `recarga` ∈ versao_nova | versao_nova_botao | pedaco_sumido | troca_setor; `versao` só hexadecimal de 6 a 40. Sem contexto (a tela de antes, ou trocar de conta sem recarregar): `'{}'` como sempre. A chave `motivo` nunca é escrita (viraria o "Por quê" da Auditoria). Nenhuma consulta nova na porta — só monta o jsonb do registro que já existia (o plano ×100 não muda). **md5 do corpo de origem (A-96 — conferir com `md5(prosrc)` do banco vivo antes de aplicar): `348b13f75671fbe420c9750cb6d925bc`.** `quem-chama.mjs`: nenhuma função do banco chama a porta.
- **Cliente — `src/autenticacao/abertura.ts`:** a 1ª abertura registrada de cada PÁGINA manda `p_contexto` = `contextoDaCarga()` (`src/lib/recarga.ts`: o tipo de carga de `performance.getEntriesByType('navigation')[0].type`, `document.wasDiscarded`, o porquê da própria plataforma guardado na aba e a versão). As seguintes na mesma página (entrar de novo depois de sair, a troca de conta vinda de outra aba) não mandam → navegação comum, **não abertura**. Banco ainda sem o 3º argumento (`PGRST202`): tenta de novo sem ele (a tela nova tolera o banco de antes — Lei §7.6). O porquê guardado vale 60 s (uma aba restaurada dias depois não herda motivo velho) e é consumido logo no início do app (`src/main.tsx`).
- **Quem guarda o porquê antes de recarregar:** `recarregar(motivo)` em `src/lib/recarga.ts` — o único caminho de recarga da plataforma: versão nova automática (`versao_nova`), o botão "Atualizar" do aviso (`versao_nova_botao`), o pedaço sumido (`pedaco_sumido`, automático ou o botão do aviso) e a troca de setor (`troca_setor`).
- **Auditoria — `src/auditoria/rotulos.ts`:** a navegação com `abertura` vira "Abriu a plataforma — <porquê>", o mais forte primeiro: a plataforma ("versão nova (atualizou sozinha)", "versão nova (tocou em Atualizar)", "versão nova (faltava uma parte da versão anterior)", "troca de setor no tablet") > "a aba tinha sido descartada pelo navegador" > o navegador ("atualizou a página", "abriu pelo endereço ou por um atalho", "voltou pelo botão de voltar do navegador"). Os Detalhes listam cada fato em português (a versão fica fora: é da máquina). A troca de tela de sempre segue "Abriu a tela". `src/paginas/Auditoria.tsx` passou a mandar o contexto ao rótulo (1 linha). As linhas do topo do `ROTULO_ACAO` (as do supervisor) não foram tocadas.
- **Bateria:** bloco "SESSAO-48 · frente 5" (5 verificações) antes do resumo final, reaplicando a base e a desta frente (duas vezes — idempotente); a desta frente entrou na cadeia do bloco 38 logo depois da base (a do stand-by recria a porta de 2 argumentos ali); as 2 conferências de permissão do bloco 78 trocaram a assinatura para `(text, boolean, jsonb)` (E-120/E-236). Os blocos antigos chamam a porta com 2 argumentos e seguem verdes (o 3º tem padrão e não há sobrecarga). Inserido por `s48-f5-rascunho/inserir-f5.mjs` (âncoras de contagem exata — E-179).

## (e) O laço da troca de setor e as outras aberturas — o que o código mostra

**O que conta como "abertura" na trilha de hoje:** `plt_fn_abertura` só grava (a `navegacao` da 1ª rota) quando chamada COM rota, e o cliente só manda rota na 1ª leitura do perfil de cada conta na página (`abertoPara` em `ProvedorSessao`). Então cada "abertura" de 10/11 é (1) uma página carregada do zero, ou (2) uma conta NOVA na mesma página (o evento `SIGNED_IN` de outra conta, ou qualquer entrada depois de um `SIGNED_OUT`). A renovação do token (`TOKEN_REFRESHED`, a mesma conta) **não** abre de novo: o `idAuth` não muda, a chave `['perfil', idAuth]` não muda, `staleTime: Infinity`, sem releitura por foco/reconexão — e uma releitura do perfil vai sem rota (não grava). Provado em teste (`ProvedorSessao.test.tsx`). Nenhum relógio do código recarrega a página: os únicos `location.reload()` eram o botão do aviso, a troca de tela com versão nova, o pedaço sumido e a troca de setor.

**11:23 — o tablet do FITAMENTO "abriu" 5 vezes em 20 s depois de uma troca de setor (e a FURAÇÃO e a MONTAGEM no mesmo minuto).** O caminho de antes:
1. "Trocar setor" → PIN do destino → `tabletEntrar` → a função `autenticacao/tablet-entrar` grava `tablet_entrou` (uma linha por PIN aceito; ela **não** derruba outras sessões da conta — a senha derivada é a mesma em toda entrada; só na 1ª entrada depois da mudança de 19/10 ou se a chave de serviço mudar) → `supabase.auth.setSession(…)`.
2. `setSession` avisa `SIGNED_IN` (conta do destino) **nesta aba e, pelo canal entre abas do navegador (`BroadcastChannel`), em toda outra aba da plataforma aberta no mesmo aparelho**.
3. Nesta aba: o provedor vê conta nova → `primeira` → `plt_fn_abertura('/tablet')` → **abertura nº 1** (grava antes de a página ir embora: o React desenha na tarefa seguinte e a recarga só troca a página quando o `index.html` novo chega). Em seguida `window.location.reload()` → página nova → **abertura nº 2**.
4. Cada OUTRA aba da plataforma no aparelho recebe o `SIGNED_IN` e abre a conta nova → **+1 abertura por aba** (abas em segundo plano congeladas pelo Android processam o aviso quando acordam — espalha em segundos). A plataforma não tem manifesto de aplicativo (`public/` só tem o `favicon.svg`): o atalho na tela inicial abre uma ABA NOVA a cada toque — abas acumulam.
→ 2 por troca + 1 por aba extra: **5 em 20 s = a troca + 3 abas extras**, ou **várias trocas seguidas no mesmo aparelho** (FITAMENTO → FURAÇÃO → MONTAGEM no mesmo minuto explica os três setores) — as linhas `tablet_entrou` dizem quantas trocas foram.
**Correção:** `TelaSetor` chama `prepararRecarga()` antes do `tabletEntrar`; com a recarga em curso, o provedor (e a medição) **não reagem** à sessão nova; o setor de destino vai direto para o aparelho e `recarregar('troca_setor')` recarrega **uma vez**; PIN errado → `cancelarRecarga()`. A abertura da página nova vai com `{abertura, carga: 'reload', recarga: 'troca_setor'}`. As abas extras ainda trocam de conta (o canal entre abas é da biblioteca), mas **não são mais registradas como abertura** (só a 1ª abertura de cada página leva a marca).

**13:58:39 e 14:38:39 — o tablet da CNC abriu do zero duas vezes, exatos 40 min, sem PIN.** Pelo código: sem PIN = sem `tablet_entrou` → não foi troca de conta por PIN; a renovação do token não abre (acima); nenhum relógio do código recarrega. Sobram: (1) **a página foi carregada de novo por fora da plataforma** — o navegador (aba descartada e recarregada ao acordar a tela), um app de quiosque/navegador do tablet com recarga programada, ou alguém atualizando; o espaçamento exato ao segundo aponta para algo agendado FORA da plataforma; ou (2) a sessão desta aba caiu (`SIGNED_OUT` por falha de renovação com o token vencido) e voltou pela sessão de OUTRA aba do mesmo aparelho (canal entre abas) — uma abertura sem PIN e sem recarga, com a tela "do zero" (o cache é limpo no `SIGNED_OUT`). A trilha nova separa: (1) vem como "Abriu a plataforma — …" com o tipo de carga; (2) vem como navegação comum `/tablet` (no tablet a rota nunca muda: navegação comum em `/tablet` = conta trocada na mesma página).

**As Entregas do Vinícius (umas 8 aberturas no dia).** A tela de Entregas abre Google Maps, Waze e WhatsApp em outro aplicativo (`target="_blank"` nos botões de navegação); com o mapa na frente, o Android tira o navegador da memória e, na volta, a aba é recarregada do zero. Causa mais provável: **aba descartada pelo sistema** — a trilha nova vai mostrar "a aba tinha sido descartada pelo navegador" (ou "atualizou a página"). Não há o que corrigir no código além de a abertura ser barata (1 requisição — já é).

**As consultas para o supervisor confirmar (só SELECT, com o OK do dono; horários em UTC — Natal/Fortaleza = UTC−3; não copiar IP para o chat):**

```sql
-- 1) 10/11 11:20–11:27 (Natal): tudo o que as contas de tablet gravaram — as trocas por PIN
--    (tablet_entrou) e as aberturas (navegacao /tablet), conta por conta
select l.criado_em at time zone 'America/Fortaleza' as hora, u.nome, l.acao, l.rota, l.contexto
  from public.plt_logs_atividade l
  join public.plt_usuarios u on u.id = l.usuario_id
 where u.conta_tablet
   and l.criado_em >= '2026-11-10 14:20:00+00' and l.criado_em < '2026-11-10 14:27:00+00'
 order by l.criado_em, l.id;

-- 2) as PÁGINAS carregadas (uma linha por carga do app — carga_id nasce a cada página nova)
--    das contas de tablet na mesma janela: menos cargas que aberturas = aberturas que não
--    foram página nova (abas extras / troca na mesma página)
select m.criada_em at time zone 'America/Fortaleza' as hora, u.nome, m.carga_id, m.rota, m.aparelho, m.versao
  from public.plt_medicoes_web m
  join public.plt_usuarios u on u.id = m.usuario_id
 where u.conta_tablet
   and m.criada_em >= '2026-11-10 14:20:00+00' and m.criada_em < '2026-11-10 14:45:00+00'
 order by m.criada_em;

-- 3) o tablet da CNC em 10/11 13:30–14:45 (Natal): as duas aberturas e o que veio antes delas
select l.criado_em at time zone 'America/Fortaleza' as hora, l.acao, l.rota, l.contexto
  from public.plt_logs_atividade l
  join public.plt_usuarios u on u.id = l.usuario_id
 where u.conta_tablet and u.nome ilike '%CNC%'
   and l.criado_em >= '2026-11-10 16:30:00+00' and l.criado_em < '2026-11-10 17:45:00+00'
 order by l.criado_em, l.id;

-- 4) as sessões da conta do tablet da CNC (o navegador/app que a abriu) e as renovações de
--    token em 10/11 — renovação colada nas 13:58:39/14:38:39 aponta para a sessão; nenhuma,
--    para recarga por fora (refreshed_at é UTC sem fuso)
select s.id as sessao, s.created_at at time zone 'America/Fortaleza' as criada, s.refreshed_at as renovada_utc, s.user_agent
  from auth.sessions s
  join public.plt_usuarios u on u.auth_user_id = s.user_id
 where u.conta_tablet and u.nome ilike '%CNC%'
 order by s.created_at;
select rt.created_at at time zone 'America/Fortaleza' as hora, rt.session_id, rt.revoked
  from auth.refresh_tokens rt
  join public.plt_usuarios u on u.auth_user_id::text = rt.user_id
 where u.conta_tablet and u.nome ilike '%CNC%'
   and rt.created_at >= '2026-11-10 03:00:00+00' and rt.created_at < '2026-11-11 03:00:00+00'
 order by rt.created_at;

-- 5) o dia do entregador (10/11, Natal): aberturas, trocas de tela e saídas
select l.criado_em at time zone 'America/Fortaleza' as hora, l.acao, l.rota, l.contexto
  from public.plt_logs_atividade l
  join public.plt_usuarios u on u.id = l.usuario_id
 where u.nome ilike 'Vin%cius%'
   and l.criado_em >= '2026-11-10 03:00:00+00' and l.criado_em < '2026-11-11 03:00:00+00'
 order by l.criado_em, l.id;

-- 6) DEPOIS de publicar (alguns dias): o porquê de cada abertura, somado
select coalesce(l.contexto->>'recarga', '—') as pela_plataforma,
       coalesce(l.contexto->>'carga', '—') as navegador,
       coalesce(l.contexto->>'descartada', 'false') as aba_descartada,
       count(*) as aberturas
  from public.plt_logs_atividade l
 where l.acao = 'navegacao' and l.contexto->>'abertura' = 'true'
   and l.criado_em > now() - interval '3 days'
 group by 1, 2, 3
 order by 4 desc;
```

Nos registros do servidor (A-123 — guardados por pouco tempo no plano gratuito; rodar logo): as chamadas `…/rpc/plt_fn_abertura` de 10/11 14:20–14:30 UTC e 16:55–17:40 UTC, com `log_attributes['request.headers.user_agent']` e o `session_id` do token — o mesmo `session_id` várias vezes no mesmo segundo = abas do mesmo aparelho.

## Decisões provisórias (o supervisor numera)

- **P1 — O momento seguro do tablet e da TV:** sem janela aberta (`[role=dialog]`/`[role=alertdialog]`) e 1 minuto sem toque nem tecla; com janela aberta, olha de novo a cada 1 minuto. (A demanda já marcava como provisória.)
- **P2 — Onde a versão é conferida sem relógio:** escritório — trocar de tela e voltar à aba (como antes); tablet — também o toque; TV — o aviso do canal do setor, a reconexão e a virada do dia. No máximo 1 conferida a cada 2 minutos; o `versao.json` é arquivo da CDN (não toca o banco).
- **P3 — A versão pelo código:** sha256 (12 hexadecimais) dos nomes ordenados de todos os arquivos montados + o conteúdo do index.html; vai no `versao.json` e numa `meta` do index.html (a página lê a própria versão dali).
- **P4 — O pedaço sumido:** "Atualizando a plataforma…" e uma recarga por versão (a guarda fica na aba); a mesma versão falhando de novo, sem internet ou sem armazenamento → só o aviso com "Atualizar" (64 px). O aviso vale em toda tela (o mesmo caminho do código), não só no tablet.
- **P5 — Os porquês da plataforma:** `versao_nova` (sozinha: troca de tela no escritório / momento seguro no tablet e na TV), `versao_nova_botao` (a pessoa tocou em "Atualizar" no aviso), `pedaco_sumido` (sozinha ou o botão do aviso), `troca_setor`. O porquê guardado na aba vale 60 s.
- **P6 — Abertura é a página:** só a 1ª abertura registrada de cada página leva a marca `abertura` (mesmo com o contexto vazio); trocar de conta na mesma página (entrar de novo, a troca vinda de outra aba) grava a navegação comum.
- **P7 — O banco só aceita o que conhece** (listas fechadas, versão em hexadecimal); a chave `motivo` nunca entra (é o "Por quê" da Auditoria).
- **P8 — O rótulo da Auditoria:** "Abriu a plataforma — <porquê>", com a ordem plataforma > aba descartada > navegador; os Detalhes mostram cada fato em português; a versão fica fora da tela.
- **P9 — O botão do aviso de versão:** 44 px no escritório (era 36 px), 64 px no tablet e na TV, com a linha "Ela se atualiza sozinha depois de 1 minuto sem uso."
- **P10 — A troca de setor:** a janela do PIN fica "conferindo" até a página recarregar (sem piscar a tela velha) e o setor de destino vai direto para o aparelho (a página nova abre nele).
- **P11 — O que a Vercel pula:** só quando há publicação anterior no ramo e, desde ela, só mudou `_docs/`, `Claude outputs/` ou `*.md`; qualquer dúvida monta. `supabase/` segue montando (decisão do dono se entra na lista).
- **P12 — A página que não foi embora:** pedida a recarga, a página espera 15 s; a troca de setor espera a resposta do PIN até 60 s. Passado isso e ainda viva (algo segurou a recarga — raríssimo), ela volta a reagir à sessão e a poder recarregar de novo, em vez de ficar surda.

## Lições (o supervisor numera na memória)

- **Erro — o vitest da cópia rodou os testes da PASTA PRINCIPAL:** `vitest run --root "<cópia>" --dir src` resolve o `--dir` a partir da pasta de onde o comando roda (a do shell = a pasta principal), não do `--root` — saiu "88 arquivos" com caminhos `…/Domoby - fabrica/src/…`. **Correção:** `--dir "<cópia>/src"` (absoluto). E a cópia não tem `.env.local`: arquivo de teste que importa o cliente real do Supabase cai na importação — rodar com `VITE_SUPABASE_URL=https://teste.invalid VITE_SUPABASE_ANON_KEY=chave-de-teste-sem-valor` na frente. (Nada foi escrito na pasta principal — conferido no `git status` dela.) **Vale avisar as outras frentes.**
- **Acerto — a cascata dos nomes:** pôr qualquer coisa que muda por commit dentro do pedaço de entrada renomeia todo pedaço que importa a entrada (89/215 aqui) — e cada publicação vira "pedaço sumido" nas telas abertas. Provar montando duas vezes e comparando os nomes.
- **Acerto — provar o `ignoreCommand` sem tocar na Vercel nem no repositório do dono:** clone RASO (`--depth=10`) da cópia no rascunho + `env -C <clone> VERCEL_GIT_PREVIOUS_SHA=… sh -c "<comando>"` contra commits reais (sem `cd`, sem worktree nova no repositório).
- **Acerto — o armazenamento do jsdom não se espia pelo protótipo** (`vi.spyOn(Storage.prototype, …)` não pega): `vi.stubGlobal('sessionStorage', …)`.
- **Erro (da bateria, não desta frente) — verificação que depende do relógio:** "SESSAO-33 · o fluxo do n8n … de ponta a ponta" fica vermelha se a bateria roda entre 03:10 e 04:40 de Fortaleza (a janela da varredura da fábrica). Rodar a bateria fora dessa janela, ou o bloco fixar a janela (ex.: `set local` de um relógio de teste), para não confundir com quebra.

## Resultados

- **Bateria do banco, 2×:** 1ª (02:55) — **1667 ✔ / 1 ✘** (o vermelho antigo "Dashboard: as 7 portas novas = as antigas em 8 períodos", que não é desta frente); 2ª (03:13, sobre os commits) — **1666 ✔ / 2 ✘**: o mesmo antigo + "SESSAO-33 · o fluxo do n8n … de ponta a ponta", que **depende do relógio**: entre 03:10 e 04:40 de Fortaleza `plt_privado.fn_tiny_fabrica_em_varredura()` é verdadeira e o lote da fila não pega o item da fábrica (`fimV2: pendente`, só o v3 interpretado) — verde na 1ª, nada desta frente. Nas duas: as 5 do bloco novo verdes e o bloco 78 (a assinatura nova) verde.
- **Telas:** `tsc -b` limpo; `eslint` dos arquivos tocados limpo; vitest **88 arquivos / 576 testes** verdes (com as variáveis de mentira); os novos: `recarga.test.ts` (12), `versaoNova.test.tsx` (6), `abertura.test.ts` (5), `ProvedorSessao.test.tsx` (3), `AvisoVersaoNova.test.tsx` (3) e 2 casos novos no `rotulos.test.ts` (8 ao todo) — 31 testes novos; o `ModoTv.test.tsx` (10) segue verde.
- **Montagem:** "JS inicial: 232.6 KB comprimidos em 8 arquivos (teto 250 KB)" — antes 231.2 KB (+1,4 KB: o registro das recargas e a guarda no pedaço de entrada).
- **Lei de desempenho (checklist):** abertura continua 1 requisição (o contexto vai na mesma; a 2ª só no minuto em que o banco ainda não tiver a migration); nenhuma requisição repetida sozinha — a conferida de versão é gesto/fato, ≤ 1 a cada 2 min, num arquivo da CDN; o relógio do momento seguro só existe com versão nova conhecida e não busca dado; nenhum `postgres_changes`, `refetchInterval` ou `setInterval` novo; a porta de abertura não ganhou consulta (o plano não muda); escrita idempotente não se aplica (só leitura + o registro que já existia).

## Arquivos

- `vercel.json` — o `ignoreCommand`.
- `vite.config.ts` — a versão pelo código (o `define` saiu); `src/versao.d.ts` apagado.
- `src/lib/recarga.ts` (+ teste) — novo: a versão da página, `recarregar(motivo)`, a troca em curso, o contexto da carga, a guarda do pedaço sumido e o aviso.
- `src/lib/versaoNova.ts` (+ teste) — a conferida (gesto/fato), o escritório (troca de tela) e o tablet/TV (momento seguro).
- `src/main.tsx` — o contexto lido cedo; o ouvinte do pedaço sumido.
- `src/componentes/AvisoVersaoNova.tsx` (+ teste) — o porquê no botão; `sozinha`; tamanhos de toque.
- `src/paginas/TelaSetor.tsx` — o momento seguro e a troca de setor com uma recarga só.
- `src/paginas/dashboards/ModoTv.tsx` — o momento seguro, a conferida no fato e o aviso.
- `src/autenticacao/abertura.ts` (+ teste) — o contexto na 1ª abertura; a tolerância ao banco de antes.
- `src/autenticacao/ProvedorSessao.tsx` (+ teste) — não reage à sessão nova com a recarga em curso.
- `src/auditoria/rotulos.ts` (+ teste) — "Abriu a plataforma — …" e os detalhes; `src/paginas/Auditoria.tsx` — 1 linha (o contexto no rótulo).
- `src/lib/medicao.ts` — a versão pela página; não troca de conta com a recarga em curso.
- `supabase/migrations/20261111050000_plt_abertura_motivo.sql` — a porta de abertura com o 3º argumento.
- `supabase/testes/testar-migrations.mjs` — o bloco da frente 5, a cadeia do bloco 38 e a assinatura no bloco 78.
- Rascunho (fora do repositório): `s48-f5-rascunho/gerar-f5.mjs`, `inserir-f5.mjs`, `bloco-f5.mjs`, `provar-versao.sh`, `provar-ignore.sh`, `md5-f5.json`.

## As recargas de 10/11 — o que os registros mostraram (lido em 11/11 ~05:30, só leitura, com o OK do dono)

Consultas do diário da frente 5 (+ a versão e os toques de cada página), rodadas por `subir/recargas-10-11.mjs`, `recargas-cnc-dia.mjs` e `recargas-versoes.mjs` no rascunho da sessão; os registros do servidor (edge logs) do minuto das 11:23 ainda existiam e confirmaram a sequência. **Como ler a medição de página:** cada linha de `plt_medicoes_web` é UMA página carregada (o `carga_id` nasce no carregamento) e a linha só é gravada quando essa página **se esconde ou é descarregada** (a 1ª medida sai ao deixar a aba — nunca junto da abertura), e só se ela chegou a pintar; `interacoes` = quantos toques ela recebeu.

- **FITAMENTO, 10/11 11:23 — um tablet só, quatro trocas de setor por PIN em 64 s** (FITAMENTO 11:23:03 → FURAÇÃO 11:23:37 → MONTAGEM 11:23:46 → FITAMENTO 11:24:06). Cada troca gravava **2 aberturas**: uma na mesma página, logo depois do PIN (a conta nova), e outra na página nova, depois da recarga — a página do PIN some ~0,7–1,2 s depois dele, com os toques do PIN (9, 4 e 14 toques). **Na 1ª troca, mais 3 páginas de fundo** do mesmo aparelho, **nunca tocadas** (0, 0 e 1 toque), recarregaram em sequência ao pegar a conta nova (11:23:17,6 · 17,9 · 22,9) — abas extras abertas no tablet (o atalho da tela inicial abre aba nova a cada toque; a plataforma não tem manifesto de aplicativo). Na 2ª troca, mais 1 aba de fundo; nas outras, nenhuma. Total: **12 "aberturas" em 1 minuto para 4 trocas**. Todas as páginas eram da mesma versão do site (a do dia) — não era página velha de outra publicação. → O que a sessão mudou resolve: a troca recarrega uma vez só e a "abertura" antes da recarga não é mais gravada; a trilha nova diz "troca de setor no tablet". **Fica:** as abas extras no tablet (fechar à mão; o remédio de vez é a plataforma abrir como aplicativo, uma janela só).
- **CNC, 10/11 13:58:39 e 14:38:39 — o navegador recarregando a aba ao acordar a tela.** Nenhum PIN no dia depois das 09:04. Às 13:58:38 o tablet renovou o acesso (o primeiro desde as 10:02 — a tela ficou apagada ~4 h) e às 13:58:39 a página abriu do zero (a página da manhã tinha se escondido às 10:15). Essa página se escondeu às 14:30:27 (tela apagada) e às 14:38:39 outra abriu do zero, sem renovação (o acesso ainda valia); ela se escondeu às 15:26. Os 40 minutos foram coincidência (não houve a das 15:18). Sem PIN, sem recarga da plataforma: é o Android descartando a aba com a tela apagada e recarregando ao acordar. → A trilha nova vai marcar "a aba tinha sido descartada pelo navegador".
- **Entregas (o entregador, 10/11):** **17 páginas carregadas do zero no dia**, todas em Rotas → Entregas no celular, coladas nas entregas (10 entregues, 8 fotos de comprovante, 2 não realizadas — 3 páginas em 74 s às 16:10–16:11). Mesmo motivo: ao abrir o Maps, o Waze, o WhatsApp ou a câmera, o Android tira o navegador da memória e, na volta, a aba recarrega. Nada na plataforma recarrega a tela dele. → A trilha nova vai dizer "aba descartada"/"atualizou"; o remédio de vez é o mesmo (abrir como aplicativo reduz, não zera — o sistema ainda pode descartar).
- **Por conta de tablet em 10/11:** MONTAGEM 22 aberturas (2 PINs), FITAMENTO 15 (3), FURAÇÃO 8 (3), SECC 6 (3), CNC 5 (1).
