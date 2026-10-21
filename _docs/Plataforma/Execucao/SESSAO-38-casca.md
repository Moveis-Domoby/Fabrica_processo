---
titulo: SESSAO-38 · frente Casca — menu, notificações e entrada por nome de usuário
tipo: execucao
data: 2026-10-22
branch: sessao-38-casca
---

# SESSAO-38 · Casca (frente F3 do lote noturno)

> Lote noturno autônomo coordenado por um supervisor (o dono não está — nada de perguntas; escolhas provisórias registradas). Worktree própria; nada em `main`, nada de push.
> Numeração reservada: D-161…D-163 · E-130…E-132 · A-93…A-94 · migrations `202610220300xx` (nenhuma foi necessária).

## Tarefas (espelho do pedido)

1. [x] Menu: o grupo **Pedidos** (Todos os pedidos · Cancelados) passa para logo abaixo de **Rotas** — só o bloco movido (a outra frente tira "Pedidos em aguardo" da Logística no mesmo arquivo).
2. [x] Notificações: qualquer toque/clique fora do painel fecha na hora (barra lateral, página, mapa, balão do chat, janelas); dentro do painel segue funcionando; o sino alterna; Esc fecha; o clique que fecha não se perde.
3. [x] Entrada: achar por que o dono ainda digita o e-mail toda vez e corrigir a causa (correção do supervisor: o login por usuário já existe desde a SESSAO-03).

## Diário

### Preparação
- `.env.local` copiado da pasta principal (sem imprimir), `npm ci`, branch `sessao-38-casca` a partir da `main` (bd75dd2).
- Lidos: CLAUDE.md, a Memória de Aprendizado inteira, D-36/D-40/D-68/D-134/D-137/D-141/D-146/D-147, o código do menu, do sino, da tela de entrada e da função `autenticacao`.

### Item 1 — menu
- `src/componentes/Layout.tsx`: o objeto da seção `Pedidos` saiu de antes de `Logística` e foi para depois de `Rotas` (com o comentário da D-134 + D-161). Diff de 19 linhas, longe da linha "Pedidos em aguardo" (5 linhas de contexto entre os dois trechos — o merge com a outra frente não conflita).
- O arquivo já estava fora do prettier na `main` (conferido pela versão do HEAD): NÃO formatado, para o diff ficar mínimo.

### Item 2 — notificações
- **Causa do painel que não fechava:** o fechamento era um "fundo invisível" `fixed inset-0` DENTRO do `aside` do menu. O `translate` do aside (no computador também — `lg:translate-x-0` ainda é transform) faz dele o bloco de contenção de todo `fixed` de dentro (E-48): o fundo cobria só a barra lateral. Clicar na página, no mapa, no balão do chat não fechava nada. E, onde cobria, ele "comia" o clique.
- **Correção (`src/notificacoes/SinoNotificacoes.tsx`):**
  - fundo invisível removido;
  - escuta de `pointerdown` na **fase de captura da janela** (`window.addEventListener(..., true)`) só enquanto o painel está aberto: roda antes de qualquer outro (o Leaflet e quem chama `stopPropagation` não impedem), sem `preventDefault` — o toque segue para o elemento tocado;
  - toque dentro do painel ou no próprio sino é ignorado (o sino alterna pelo clique dele);
  - Esc fecha e devolve o foco ao sino;
  - o painel vai para o fim do `body` por **portal** (fora do aside: o `fixed` volta a ser da janela), camada `z-[58]` — acima da gaveta do celular (55) e do seletor de tema (56), abaixo dos avisos passageiros (60);
  - trocar de tela fecha sozinho — o "aberto" é derivado (`abertoEm === pathname`), sem efeito que mexe em estado (regra do lint da casa).
- Teste novo `src/notificacoes/SinoNotificacoes.test.tsx` (5 cenários: sino alterna; toque fora fecha e o clique chega ao botão tocado; fecha sobre elemento que segura o evento — o "mapa"; toque dentro não fecha; Esc fecha). Verde.

### Item 3 — entrada por nome de usuário (re-escopo do supervisor)
- **Correção do supervisor no meio do trabalho:** o login por usuário já existe desde a SESSAO-03 (D-21). Não criar mecanismo paralelo nem coluna — achar por que o dono ainda digita o e-mail e corrigir a causa.
- **Levantamento no banco real (só leitura):**
  - `plt_usuarios.usuario` é `not null`, único por `lower(usuario)`, formato `^[a-z0-9._-]{3,32}$` — os 16 ativos (fora as 5 contas de tablet) têm usuário. **Nenhum preenchimento necessário.** O do dono (super admin) é `wallace`.
  - Nenhum e-mail com maiúscula/espaço; e-mail da plataforma = e-mail da conta de acesso em todos.
  - Trilha: o dono entrou **19 vezes em 7 dias** (30 entradas no total) — a sessão cai com o tempo parado (8 h, D-137) e ele recomeça do zero a cada vez.
  - Meu Perfil e Equipe (lista + caneta) já mostram e editam o usuário.
  - ⚠️ E-130: uma consulta com nome de coluna de memória (`registrado_em`) quebrou — corrigida com grep (`criado_em`).
- **Causa encontrada:** a tela de entrada não lembrava ninguém; campos sem `name` (o gerenciador de senhas do navegador preenchia mal); o caminho "e-mail + PIN" só aceitava e-mail; nada ensinava o próprio usuário a quem entrava pelo e-mail. A busca no servidor também era exata (`eq` no texto minúsculo): "João Lucas" não achava `joaolucas`.
- **Função `autenticacao` (repo = v15 publicada, conferido antes — só o fim de linha final diferia):**
  - `lerIdentificador`: com "@" e-mail minúsculo; sem "@" usuário minúsculo sem acento (faixa 0x300–0x36f por código de caractere — E-15/E-84) e sem espaço. Testado à parte com script (6 casos verdes).
  - `entrar`: trava de tentativas (a mesma `plt_pin_tentativas`), chave `login:<coluna>:<valor>` — vale exista ou não a pessoa (não entrega cadastro); `conta_tablet` recusada com a mensagem genérica; `contexto.via` na trilha; devolve `usuario`.
  - `entrar-pin`: aceita `identificador` (usuário ou e-mail) e ainda o `email` do site antigo; trava `email:`/`usuario:`; mensagens sem "só e-mail"; devolve `usuario`.
  - Tipos conferidos com `tsc` + shim (o único erro, linha do `chaveBuscaCache`, já existia na v15).
- **Site:**
  - `src/autenticacao/ultimoLogin.ts` (novo): `lerUltimoLogin`/`lembrarLogin` em `localStorage` com try/catch (chave `domoby:ultimo-login`; nunca senha/PIN).
  - `src/autenticacao/api.ts`: `entrar` e `entrarPin` devolvem `{ usuario }`; `entrarPin(identificador, pin)` manda `identificador` e `email` (compatível com a v15).
  - `src/paginas/Entrar.tsx`: o campo "Usuário ou e-mail" é o mesmo nos dois jeitos (senha e PIN), com `name="username"`/`autocomplete="username"`; senha `name="password"`/`current-password`; abre preenchido com o último usuário do aparelho (o `?u=` do convite vence) e o cursor na senha; "Entrar com usuário e PIN"; textos sem "e-mail obrigatório".
  - `src/paginas/MeuPerfil.tsx`: a ajuda do campo diz que é com ele que se entra; trocar o próprio usuário atualiza o lembrado no aparelho. `src/paginas/equipe/EditarUsuario.tsx`: ajuda no campo.
  - `src/paginas/Entrar.test.tsx`: 4 cenários novos (PIN com usuário; guarda o usuário devolvido mesmo entrando por e-mail; abre preenchido com foco na senha; `name`/`autocomplete`) + os antigos ajustados. Stub de `localStorage` como em `inatividade.test.ts` (o Node novo põe um próprio, vazio).
- **Publicação:** versão conferida de novo (15) logo antes; publicada **v16** pelo conector (`verify_jwt` mantido ligado); texto publicado comparado com o repo byte a byte — **idêntico** (52.521 caracteres). Sondas (sem abrir sessão de ninguém): ação desconhecida 400; usuário inexistente "Sonda Sessao Trinta Oito" → 401 genérico e a trava gravou `login:usuario:sondasessaotrintaoito` (a busca sem espaço/maiúscula funcionando); corpo antigo do PIN (`email`) → 401 novo texto; PIN com usuário inexistente → 401; tablet com PIN mal formado → 400 (inalterado). Ficaram 3 linhas de contador da sonda em `plt_pin_tentativas` (chaves de identificadores falsos, sem pessoa) — inofensivas, não apagadas (produção).
- **Banco:** nenhuma migration (banco enxuto — a coluna existia e estava preenchida).

### Verificação final
- `npm run build` verde (JS inicial 222,5 KB comprimidos — teto 250); `npm run lint` limpo; `npm test` 39 arquivos / 214 testes verdes; `npm run test:banco` TUDO VERDE (sem bloco novo — nada de banco mudou).
- Mojibake: `grep -E 'Ã§|Ã£|Ã©|Ã­|Ãµ|Ã¡|â€'` em `src` e `supabase/functions` vazio.
- Prettier: os arquivos tocados que já estavam fora do formato na `main` (Layout, Entrar, api, MeuPerfil, EditarUsuario) **não** foram formatados, para o diff ficar só no que mudou.

### Checklist de desempenho (Lei)
- Nenhuma requisição nova em tela: o sino continua com a mesma leitura; a escuta de toque só existe com o painel aberto (nada de relógio). A entrada continua 1 chamada; lembrar o usuário é local (zero requisição).
- Sem tabela/índice novo; a trava usa a chave primária de `plt_pin_tentativas` (1 leitura + 1 escrita só quando erra).
- JS inicial dentro do teto (222,5 KB).

### Decisões e aprendizados
- D-161 (menu), D-162 (notificações, com a escolha provisória de fechar ao trocar de tela), D-163 (entrada sem e-mail — causa, escolhas provisórias e risco aceito).
- E-130 (nome de coluna de memória), E-131 (o fundo invisível preso no aside), A-93 (achar por que o jeito bom não pegou), A-94 (publicar função pelo conector com conferência byte a byte).
