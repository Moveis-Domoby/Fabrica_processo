---
titulo: SESSAO-41 — diário de execução
tipo: execucao
data: 2026-10-27
tags: [execucao, sessao-41]
---

# SESSAO-41 — diário de execução

Demanda: [[SESSAO-41 - Rotas Entrega Parcial Parada Avulsa Senha Tablet e Quadro]]. Ramo `sessao-41-rotas-senha-tablet-quadro` (pasta principal, sem worktree — pedido do dono). Numeração reservada: D-189…D-199 · E-158…E-169 · A-115…A-124 · migrations `20261027xxxxxx` · ids de teste `...4101–4149`.

## Leitura e diagnóstico (26–27/10)

- Lidos: CLAUDE.md, ordem das sessões, handoff da 40, visão geral, decisões (rotas D-113…D-130, D-146/147, D-156…D-159, D-163, D-174/175, D-150), memória (E e A recentes), lei (§1–§13), perguntas em aberto (nada do escopo).
- Vídeo 1 (quadro): quadros a 1/2 s + fala transcrita (faster-whisper local, scratchpad) — a coluna precisa rolar por dentro.
- Vídeo 2 (endereço): pedido 13660 — o endereço de entrega do Tiny já está em `pedidos.endereco_entrega` (191 pedidos; 9 nos últimos 30 dias); nenhuma porta usa.
- **Tablet "expirando" — a causa (registro do servidor, 26/10):** `tablet-entrar` fazia `admin.updateUserById(password)` a cada entrada → o GoTrue derruba as outras sessões da conta (senha trocada = `Logout` de todas). MONTAGEM: 18 entradas em 26/10, de minutos em minutos a partir das 16:45, sem nenhum `logout` entre elas; 1 sessão viva por conta no fim do dia; 101 × 403 `session_not_found` em `/auth/v1/user` (o `pessoaDoToken` da função) e 32 × 400 `refresh_token_not_found`. E o `signOut()` do site era global (padrão do supabase-js) — "Sair" num tablet derrubava os outros.
- Segurança (só leitura): advisors sem função `anon` executável; **cadastro público do Auth ligado** (`disable_signup=false`); a trava do `tablet-entrar` é por `x-forwarded-for` (forjável) com PIN de setor de 2 dígitos; a trava da senha é na função, mas o `/auth/v1/token` direto não passa por ela.

## F1 — Tablet (D-189)

- Migration `20261027010000_plt_tablet_presenca_pin.sql` (814 linhas; funções recriadas por EXTRAÇÃO da versão viva — `pg_get_functiondef` lido do banco real em modo só-leitura por script no scratchpad): `plt_presenca_segmentos.carencia`; tipo `saida_automatica` em `plt_presenca_eventos`; régua `fn_presenca_estado_efetivo` e `fn_presenca_partes` (SQL puro, embutível); `fn_presenca_expirar` (grava a saída de 1 h no instante certo, no próximo fato); `fn_presenca_auto_entrada` (sessão de conta de tablet + pessoa = entra no setor do tablet em QUALQUER gesto; gatilho agora `when (new.usuario_id is not null)`); recriadas `fn_presenca_recalcular`, `fn_presenca_entrada`, `fn_presenca_saida`, `fn_tempos_aberto`, `plt_fn_tempos_pessoas`, `plt_fn_tempos_pessoa_detalhe`, `plt_fn_quadro_setor` (presenças pela régua + `carencia`).
- Bateria: bloco SESSAO-41 · F1 (11 conferências) + o teste da 36 aceita a carência + a 41 reaplicada depois da 40 no bloco 38 (padrão E-144). **1.299 verdes.**
- Front: `signOut({ scope: 'local' })`; o tablet nunca sai por tempo (`inatividade.ts` + `ProvedorSessao` pela `conta_tablet`); `src/tablet/presenca.ts` (a régua na tela, com o relógio de tela) + testes.
- Função `autenticacao`: `senhaDoTablet` = HMAC-SHA256(chave de serviço, `tablet-sessao-v1:<auth id>`); entra com ela; só se falhar grava uma vez e tenta de novo.
- Erros no caminho: o 1º teste escondia o erro real atrás de "transação abortada" (corrigido com ponto de volta no `logado41`); a 40 reaplicada no meio da bateria desfazia o quadro novo (E-144 de novo — reaplicar a 41 depois); 899 × 900 s (o trecho que cruza a meia-noite soma em dois pedaços arredondados — tolerância de 2 s).

## F2 — Quadro com rolagem na coluna (D-190)

- `src/kanban/componentes/alturaDoQuadro.ts` (`useAlturaAteOFim`): o quadro mede o próprio topo e vai até o pé da janela (menos 52 px no computador — a dica da mãozinha e o respiro da página —, 20 px no tablet); mínimo 320 px; de novo no `resize` e quando o pai muda de tamanho (`ResizeObserver`). Usa a MESMA referência do arrasto para o lado (`propsDoQuadro.ref` — a 1ª versão criava outra e o `ref` sobrescrevia o da mãozinha) e só mede com as colunas desenhadas (o esqueleto não tem a referência).
- `QuadroKanban`: a seção `min-h-0`, o painel `max-h-full min-h-0`, o cabeçalho `shrink-0` e a lista de cards `overflow-y-auto overscroll-contain` (com `aria-label` "Cards da etapa X"); o quadro `overflow-y-hidden` com a altura medida. Vale para o quadro do setor no computador e para o tablet (mesmo componente).
- Conferido numa vitrine TEMPORÁRIA (60 cards, sem login, sem banco — apagada): no computador a página tem a altura da janela (768 = 768), a coluna A MONTAR rola por dentro (5.048 px de lista em 566 visíveis) com o "Ver mais" no fim dela; no celular 375 × 812 idem, sem rolagem lateral da página. Testes de tela do quadro: 79 verdes.

## F3 — Senha liberada por administrador (D-191) e a revisão de segurança (D-192)

- Migration `20261027020000_plt_senha_pedidos.sql`: tabela `plt_senha_pedidos` (pendente → liberado/recusado → usado; substituído ao pedir de novo — um aparelho novo nunca herda liberação); portas de SERVIÇO (só `service_role`): `plt_fn_senha_solicitar` (e-mail exato, ativo, não tablet; avisa cada admin com `tipo='senha_pedido'`; e-mail sem cadastro não faz nada), `plt_fn_senha_situacao` ("liberado" só com o resumo do segredo do aparelho, nas 2 h, sem uso), `plt_fn_senha_conferir`, `plt_fn_senha_usado` (tira da senha padrão); portas dos ADMINS: `plt_fn_senha_pedidos`, `plt_fn_senha_decidir` (2 h; repetir não muda; sem pendentes, os avisos saem de todos).
- Migration `20261027030000_plt_seguranca_permissoes.sql`: o visitante sem escrita nenhuma (INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER e sequências), ninguém do navegador com TRUNCATE, e o mesmo nos privilégios padrão. Auditoria de 27/10 (banco real, só leitura): toda regra de escrita já era `TO authenticated` e conferia a pessoa; `plt_usuarios` só deixa a própria pessoa mudar nome/telefone/foto/tema/fila (nunca papel, super admin, módulos, ativo); as duas funções com SQL montado usam `%L`/`USING` (sem injeção); o login procura por `.eq` (sem injeção); 2 funções invocadoras executáveis pelo visitante são inofensivas (mapeamento puro e gatilho).
- Função `autenticacao`: ações `senha-solicitar` (trava por aparelho e por e-mail: 5 por 15 min — ninguém enche o sino), `senha-situacao`, `senha-trocar` (8 a 72 caracteres, não a padrão, trava por aparelho nos erros); `entrar` recusa texto acima de 254/72; `tablet-entrar` ganha a trava GERAL (30 erros de PIN de setor em 15 min, de qualquer aparelho — o endereço de internet dá para disfarçar). Tipos conferidos com `tsc` num ambiente simulado do Deno (o único aviso já existia antes).
- Front: `src/autenticacao/trocaDeSenha.ts` (o segredo do aparelho no `localStorage`; 1ª versão se chamava `recuperarSenha.ts` e brigava com `RecuperarSenha.tsx` no Windows — renomeado), `RecuperarSenha.tsx` + "Esqueci minha senha" na entrada; `src/notificacoes/AlertaTrocaSenha.tsx` no esqueleto da página para admin (lê o MESMO cache do sino; a lista só no aviso aberto); `destinoDoAviso('senha_pedido') = '?senhas=1'`.
- Bateria: bloco SESSAO-41 · F3 (17 conferências). **1.318 verdes.** Duas conferências (leitura da tabela nova, escritas que as telas usam) ficam para o banco real — a bateria imita os privilégios padrão da Supabase mais aberto que o real.
- Para o dono clicar no painel da Supabase (eu guio): desligar o cadastro público ("Allow new users to sign up"), senha mínima 8.
