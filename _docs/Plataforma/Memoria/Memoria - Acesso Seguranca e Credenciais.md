---
titulo: "Memória de aprendizado — Acesso Seguranca e Credenciais"
tipo: memoria-tema
tema: acesso
atualizado: 2026-11-18
tags: [memoria, aprendizado, tema/acesso]
---

# 🧠 Memoria - Acesso Seguranca e Credenciais

> Lições deste tema, movidas de [[PLT - Memoria de Aprendizado]] em 18/11/2026 sem reescrever. Entrada nova entra **aqui**, na seção do tipo dela, com o id no título (`### E-NNN`); o próximo número livre está no índice.

## 🔴 Erros e correções (E-NN)

### E-2

- [2026-08-11] **E-02** · OAuth de usuário em fluxo servidor-a-servidor expirou e derrubou produção → **correção:** Service Account para máquina-a-máquina. → promovida

### E-3

- [2026-08-??] **E-03** · Token do Tiny vazou num print e teve que ser trocado → **correção:** credencial nunca em chat/print/nota; colar direto na ferramenta. → promovida

### E-12

- [2026-08-26] **E-12** (Claude Code) · A string de conexão do Postgres não era aceita pelo driver e o erro dizia só `Invalid URL` — a senha continha **`#`**, que em URL começa o fragmento e faz o resto da string sumir **em silêncio** → **correção:** o aplicador de migrations passou a fatiar a string à mão (corte na ÚLTIMA arroba) e entregar a senha crua ao driver, em vez de mandar o dono editar/escapar a própria senha. **Lição geral: credencial não passa por parser de URL; e diagnosticar segredo é conferir FORMA (tem `#`? tem espaço? quantas arrobas?), nunca imprimir conteúdo.**

### E-13

- [2026-08-26] **E-13** (Claude Code) · Primo do [[Memoria - Acesso Seguranca e Credenciais#E-12|E-12]]: valor com `#` em arquivo `.env` é cortado em silêncio por leitores dotenv (o `#` vira comentário) → **correção:** valor com `#`/espaço sempre **entre aspas duplas** no `.env`; em campo de formulário (painel), sempre cru e sem aspas. Documentado no próprio `.env.example`.

### E-50

- [2026-09-27] **E-50** (Claude Code, achado na SESSAO-26 — o erro é da S03) · Os `revoke select (cpf, convite_token, pin_hash)` de `plt_usuarios` **nunca valeram em produção**: o Supabase concede SELECT na TABELA inteira ao `authenticated` por padrão, e no Postgres o grant de tabela passa por cima de revoke por coluna. Ensaio [[Memoria - Testes e Validacao ao Vivo#A-11|A-11]] no banco real, como `authenticated`: CPF 3/3, hash do PIN 1/1, token de convite 3/3 legíveis por qualquer logado. O harness não pegou porque no PGlite o `authenticated` não tem grant de tabela ([[Memoria - Banco e SQL 1#E-14|E-14]] de novo: permissão só se prova no banco real) → **correção:** migration 38 troca para `revoke select` da tabela + `grant select` coluna a coluna (menos as sensíveis e a data de nascimento), com o dono aprovando (resposta 6). **Lição: esconder coluna é `revoke` da TABELA + `grant` das colunas permitidas — e conferir com `has_column_privilege` no banco real; revoke de coluna sozinho é enfeite. Consequência permanente: coluna nova em `plt_usuarios` só é legível pelo navegador com `grant select (coluna)` explícito.** → promovida (regra 10 do CLAUDE.md, junto com o `--so` para sessões em paralelo)

### E-134

- [2026-10-21] **E-134** (Claude Code, SESSAO-38 · F4) · No ensaio no banco real (bloco `DO` com `RAISE`), li `plt_presenca_segmentos` logo depois de `set_config('role','authenticated')` — "permission denied" (a tabela é fechada, como deve) e o ensaio parou antes da prova → **correção:** voltar a `role postgres` antes de cada leitura de conferência e só usar `authenticated` para chamar as portas. **Lição: no ensaio como `authenticated`, trocar de papel é por trecho — porta como a pessoa, conferência como dono.**

### E-160

- [2026-10-27] **E-160** (Claude Code, SESSAO-41) · `recuperarSenha.ts` (a lógica) e `RecuperarSenha.tsx` (a tela) na mesma pasta: no Windows o nome é o mesmo para o sistema — o `tsc` acusou "differs only in casing" e o Vite guardou o arquivo errado em cache (tela de entrada em branco no navegador) → **correção:** a lógica virou `trocaDeSenha.ts` e o servidor de visualização foi reiniciado. **Lição: nunca dois arquivos com o mesmo nome em caixas diferentes; tela em branco depois de renomear = reiniciar o servidor de visualização.**

### E-243

- [2026-11-09] **E-243** (Claude Code, SESSAO-47 · frente da entrega) · O tamanho do pacote inicial medido numa cópia sem `.env.local` saiu **149,5 KB** — errado: sem as variáveis do ambiente o construtor joga fora o cliente do banco inteiro → **correção:** com variáveis de mentira (sem valor nenhum) o número bate com o da pasta principal (231 KB). **Lição: pacote se mede com as variáveis presentes (de mentira, numa cópia isolada).**

## 🟢 Acertos que viraram padrão (A-NN)

### A-50

- [2026-10-02] **A-50** (Claude Code, SESSAO-27) · **Painel do navegador do app escondido não desenha: `requestAnimationFrame` e `ResizeObserver` não disparam até ele pintar** (e a captura de tela dá "não terminou de desenhar"). Medir por script logo após abrir a página pode mostrar o estado de ANTES do primeiro quadro (o canvas "em 100%"). **Como conferir:** tirar uma captura (força o desenho) e só então medir; e não concluir "o código não roda" sem essa prova — com marcas temporárias no console (tiradas antes do commit), a montagem aparecia e o ajuste só vinha depois do desenho.

### A-66

- [2026-10-16] **A-66** (Claude Code, SESSAO-32) · **Banco aplicado → conferência pessoa por pessoa no banco real → só então o site.** Script no scratchpad (`conferir-78.mjs`): para cada pessoa ativa, `begin; set local role authenticated; request.jwt.claims` com a identidade dela → as portas novas (com e sem rota, Visão do dia, bolinha contra a visão antiga) → tempo do servidor por `clock_timestamp()` no mesmo pacote → `rollback` (nada fica gravado). Pegou o [[Memoria - Banco e SQL 1#E-103|E-103]] que o harness não pegava; depois da correção: 6/6 sem erro, abertura p50 11 ms, Visão do dia p50 27 ms, bolinha idêntica à visão antiga. Completa o [[Memoria - Migrations Aplicador e Ensaio 1#E-73|E-73]] (banco e site juntos): entre os dois, a prova como o navegador chama.

### A-75

- [2026-10-17] **A-75** (Claude Code, SESSAO-33 — em casa) · **Conferir porta nova no banco real pelo conector sem gravar nada: bloco `DO` que termina em `RAISE`.** `set_config('request.jwt.claims', …)` + `set local role authenticated` como o dono e depois como outra pessoa; mede-se com `clock_timestamp()`; o `RAISE` no fim devolve o resultado na mensagem e desfaz tudo (não depende de `begin…rollback`, cujo resultado o conector não devolve). **Medir 5× no mesmo bloco:** a 1ª chamada é fria (unidades 84 ms, painel 28 ms) e as seguintes dão o número de verdade (1,6–2,1 ms) — um número só engana. Completa o [[Memoria - Acesso Seguranca e Credenciais#A-66|A-66]] quando não há script à mão.

### A-115

- [2026-10-27] **A-115** (Claude Code, SESSAO-41) · **"A sessão expira" se diagnostica no REGISTRO DO SERVIDOR, não no código.** Os registros do login (auth_logs) mostraram entradas da conta do tablet de minutos em minutos sem nenhuma saída entre elas e só UMA sessão viva no fim do dia; as recusas "sessão não encontrada" vinham da função de login validando o token. Causa: trocar a senha pelo admin derruba todas as sessões da conta (o servidor de login faz isso de propósito) — e a entrada pelo PIN do setor trocava a senha a cada entrada. Remédio padrão para conta de DISPOSITIVO: senha DERIVADA no servidor (HMAC da chave de serviço com o id da conta), estável, nunca guardada; e `signOut({ scope: 'local' })` para sair só do aparelho.

### A-123

- [2026-10-28] **A-123** (Claude Code, ajuste 28/10) · **"O aviso não chegou" se investiga pela LINHA DO TEMPO do servidor antes de mexer no tempo real:** os `edge_logs` (via `query_logs`) trazem em `log_attributes` quem chamou (`request.sb.auth_user`), a sessão (`…jwt.authorization.payload.session_id`), o IP e o caminho de cada requisição — dá para remontar quem estava logado, onde, e o que cada aba fez (recarregou = `plt_fn_abertura`; saiu = `/auth/v1/logout`; o aviso abriu = `plt_fn_senha_pedidos`). Junto com uma leitura do banco (os pedidos e os avisos com as horas) provou que o 1º pedido não existiu (e-mail digitado errado) — o websocket estava certo. Duas aberturas no mesmo segundo depois de um login = duas abas.

### A-207

- [2026-11-09] **A-207** (Claude Code, SESSAO-47 · frente da entrega) · **Cópia isolada sem `.env.local`: testes de tela e montagem rodam com variáveis de mentira** (`VITE_SUPABASE_URL=https://teste.invalid`, `VITE_SUPABASE_ANON_KEY=chave-de-teste-sem-valor`) — nenhum segredo lido, e o pacote sai com o tamanho de verdade.

### A-222

- [2026-11-12] **A-222** (Claude Code, ajuste da SESSAO-48 — a plataforma como aplicativo) · **Ícone de aplicativo sem programa de imagem:** uma página HTML no rascunho que desenha o mesmo SVG do favicon (a fonte Poppins 700 copiada do `node_modules/@fontsource/poppins/files/` para o lado da página) e o Edge sem janela fotografando com `--default-background-color=00000000` (fundo transparente), `--force-device-scale-factor=1` e `--window-size=N,N`. Abaixo de ~500 px o Edge desenha a página mais larga e corta a foto no canto de cima à esquerda ([[Memoria - Front Telas e React 1#E-265|E-265]]) — com o SVG preso em (0,0) e do tamanho N, o corte sai exato (192 e 180 conferidos com `file`). Ícone adaptável do Android ("maskable"): quadrado cheio, desenho a 80% (a bolinha do canto passava da zona segura de 40% do raio). Conferir no site montado (`npm run preview`) carregando cada ícone (`naturalWidth`) e o cartão (`application/manifest+json`).
