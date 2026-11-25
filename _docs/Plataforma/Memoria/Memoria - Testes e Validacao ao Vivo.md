---
titulo: "Memória de aprendizado — Testes e Validacao ao Vivo"
tipo: memoria-tema
tema: testes
atualizado: 2026-11-18
tags: [memoria, aprendizado, tema/testes]
---

# 🧠 Memoria - Testes e Validacao ao Vivo

> Lições deste tema, movidas de [[PLT - Memoria de Aprendizado]] em 18/11/2026 sem reescrever. Entrada nova entra **aqui**, na seção do tipo dela, com o id no título (`### E-NNN`); o próximo número livre está no índice.

## 🔴 Erros e correções (E-NN)

### E-18

- [2026-08-27] **E-18** (Claude Code) · Na verificação [[Memoria - Modelos Formulas e Possibilidades#F-7|F-07]] da SESSAO-06, TODO clique via automação (CDP) passou a estourar timeout sob **emulação mobile/tablet** do painel de preview (mouse→touch) — até em elemento fora do drag-and-drop, sem erro de console → **correção:** conferência visual por screenshot + clique disparado por JS só para inspeção; interação de verdade testada em viewport desktop. **Lição: sob emulação touch, clique de automação não prova nada — gesto de toque real se prova em dispositivo real (fica para a SESSAO-07/tablet).** Bônus da mesma rodada F-07: painel ancorado em elemento que muda de lado (sino no menu que quebra linha) estoura a tela — ancorar overlay na BORDA DA PÁGINA, não no elemento.

### E-40

- [2026-09-23] **E-40** (Claude Code) · Na validação ao vivo da S23, o campo de criar subtarefa de 2º nível **não existia até já haver uma filha** (a UI só renderizava o checklist aninhado quando `filhas > 0`) — a primeira sub-subtarefa era impossível de criar → **correção:** botão "detalhar" por subtarefa abre o formulário aninhado sob demanda. **Lição: condição "só mostro se já tem" mata o primeiro cadastro — todo container de criação precisa de um caminho para nascer vazio.** Bônus da mesma rodada: barras do Recharts **não pintam no painel de navegador embutido** (grupo `recharts-bar-rectangle` fica vazio — vale até para as telas da S16 já validadas em produção); prova de dado ali é tooltip/DOM/lista, e prova visual de gráfico é navegador de verdade (primo do [[Memoria - Front Telas e React 1#E-32|E-32]]/A-13).

### E-75

- [2026-10-01] **E-75** (Claude Code, SESSAO-29) · No Tiny (pedido do dono, teste autorizado), cliquei no item "Marcadores" do menu "ações" pela referência do elemento, e a posição devolvida caía sobre **"estornar contas"** na foto seguinte — o menu mistura gesto inofensivo com gesto financeiro (estornar contas/estoque, excluir venda). Conferido na hora: nenhum diálogo aberto, "Edição desabilitada" seguia na tela (nada estornado) e o diálogo que abriu era o dos marcadores → **correção:** daí em diante, no ERP, só clique depois de uma foto nova do menu aberto e confirmação do item sob o ponteiro (ou JS que acha o elemento pelo TEXTO exato e devolve a posição antes). **Lição: em menu de ERP com ação financeira ao lado, clique por referência/coordenada sem foto fresca é proibido — confirmar o alvo antes, sempre.** (Na mesma rodada, a permissão automática da sessão barrou digitar o marcador — parei de editar o Tiny; o resto do aceite saiu do dado real.)

### E-257

- [2026-11-11] **E-257** (Claude Code, SESSAO-48 · frentes 2, 3 e 5) · `vitest run --root "<cópia>" --dir src`, com o shell na pasta principal, rodou os testes da PASTA PRINCIPAL (o `--dir` relativo é resolvido pela pasta de trabalho do processo, não pelo `--root` — os caminhos saíram `…/Domoby - fabrica/src/…`); e a cópia sem `.env.local` derruba na importação todo teste que carrega o cliente real. → **Correção:** na cópia, `--dir "<cópia>/src"` (absoluto) e as variáveis de mentira do build (`VITE_SUPABASE_URL=https://teste.invalid VITE_SUPABASE_ANON_KEY=…`); na pasta principal, `--root "$R" --dir "$R/src"`.

### E-276

- [2026-11-12] **E-276** (Claude Code, SESSAO-50 · frente 4) · O teste do formulário dos dias dos ocultos (campo numérico com máximo) não enviava no jsdom: a validação nativa do navegador barrou o envio de um valor acima do máximo antes de a tela validar e explicar. → **Correção:** `noValidate` no formulário — a tela valida e explica em português (a nativa mostra balão em inglês e não testa).

### E-290

- [2026-11-17] **E-290** (Claude Code, SESSAO-51) · O [[Memoria - Testes e Validacao ao Vivo#A-194|A-194]] de novo: rodei o `vitest` do projeto sem filtro e ele pegou a cópia velha da SESSAO-46 dentro de `.claude/worktrees/` — 16 arquivos / 66 testes "falhando" que não eram da sessão (e mais um minuto perdido). → **Correção:** `npm run test -- --exclude ".claude/**"` (ou `vitest run --root "$R" --dir src`); o `eslint .` também acusa as vitrines locais (`vitrine-s48/`, `vitrine-s50/`) → `--ignore-pattern "vitrine-*/**" --ignore-pattern ".claude/**"`.

### E-141

- [2026-10-21] **E-141** (Claude Code, supervisor da SESSAO-38) · Sem login no navegador do app e com o Chrome desconectado, montei um ambiente local que respondia como a API do Supabase agindo como o dono (token próprio, papel `authenticated` no banco) para testar as telas logadas — o controle de segurança do app **bloqueou** abrir a plataforma por ele (entendeu como contornar o login) → **correção:** ambiente desligado e apagado; o teste visual virou uma **vitrine** local (as telas reais com dados reais pré-carregados no cache, sessão falsa só no desenho, toda chamada ao Supabase recusada pelo próprio navegador) + conferência das portas no banco como o dono, sem gravar ([[Memoria - Acesso Seguranca e Credenciais#A-75|A-75]]). **Lição: tela logada sem o dono = vitrine (sem API) + porta no banco; nunca simular sessão contra a API.**

### E-146

- [2026-10-21] **E-146** (Claude Code, SESSAO-39) · A vitrine local (as telas reais com um banco de mentira — o caminho seguro do [[Memoria - Testes e Validacao ao Vivo#E-141|E-141]]) foi servida com a RAIZ do projeto como raiz do servidor (para o Tailwind achar as classes em `src/`), e o painel de pré-visualização abre a raiz: por um instante carregou o `index.html` do SITE DE VERDADE (`/entrar`, com o cliente real do banco) — nada digitado, nenhuma sessão, mas não devia. → **Correção:** o servidor da vitrine ganhou um desvio que manda toda página que não é a vitrine para ela (`/` e rotas sem ponto → `/vitrine-s39/index.html`). **Regra:** vitrine servida da raiz do projeto sempre com o desvio; conferir a primeira página que o painel abre.

## 🟢 Acertos que viraram padrão (A-NN)

### A-30

- [2026-09-28] **A-30** (Claude Code) · **Contar o que a tela pede ao servidor, ao vivo:** o registro de rede do painel não mostra outra origem (o Supabase) e `performance.getEntriesByType('resource')` para em 250 entradas — no dev o Vite enche isso com os módulos e as chamadas novas somem caladas. O que funciona: `performance.setResourceTimingBufferSize(20000)` + um `PerformanceObserver({ type: 'resource' })` filtrando as RPCs (`/rest/v1/rpc/…`) antes de cada gesto. E para testar tempo real com UMA conta no mesmo navegador: duas origens (`localhost` e `127.0.0.1`) = duas sessões lado a lado.

### A-34

- [2026-09-28] **A-34** (Claude Code, ajustes do estoque) · **Teste de ponta a ponta de upload em produção, sem deixar sujeira:** a imagem de teste nasce num `canvas` no próprio navegador (`toBlob` → `File`), entra no `<input type=file>` escondido por `DataTransfer` + evento `change` ([[Memoria - Modelos Formulas e Possibilidades#F-9|F-09]]), e o caminho real roda inteiro (redução no aparelho, storage, porta do banco, a foto na tela). A limpeza usa o **cliente do próprio app** — `await import('/src/lib/supabase.ts')` no console da página do Vite devolve o MESMO módulo (mesma sessão do dono logado): a porta volta o campo a nulo e o `storage.remove` apaga o arquivo (o banco não deixa apagar storage por SQL — [[Memoria - Banco e SQL 1#E-35|E-35]]). Nenhum token manuseado, nenhuma imagem de teste esquecida na biblioteca do produto. Conferido no banco: capa nula, pasta vazia.

### A-13

- [2026-08-28] **A-13** (Claude Code) · **Verificação de tela sem painel visível**: no bloco noturno o painel de preview não compõe frames (screenshot impossível) — `read_page`/`get_page_text`/JS provam estrutura e comportamento (fluxo do PIN rodou fim a fim assim); screenshot fica documentado como pendência para o dono. Bônus: `execute` do plpgsql roda UM comando por vez — policies em executes separados.

### A-11

- [2026-08-26] **A-11** (Claude Code) · **Testar em produção sem sujar produção**: bloco `do $ ... $` que monta o cenário, mede, e termina com `raise exception` PROPOSITAL — a mensagem carrega o resultado e a exceção desfaz tudo. Zero linha gravada, comportamento provado no banco de verdade. Vale muito quando a tabela é append-only e um registro de teste seria impossível de apagar.

### A-62

- [2026-10-14] **A-62** (Claude Code, SESSAO-31, ajustes da noite) · **Vídeo do dono: quadros a 10 por segundo + procura de cor por programa** (Pillow no scratchpad, recorte da área de conteúdo, contar pixels avermelhados) achou a mensagem que piscava 0,7 s — a 1 quadro por segundo ela passaria. Depois, mosaico de 6 quadros numa imagem só para ver o fluxo inteiro gastando pouco.

### A-104

- [2026-10-22] **A-104** (Claude Code, SESSAO-39) · **Foto inteira de uma tela larga sem depender do tamanho do painel do navegador do app:** o Edge da máquina sem janela — `msedge --headless=new --user-data-dir=<pasta do scratchpad> --window-size=1440,760 --virtual-time-budget=6000 --screenshot=<arquivo.png> <endereço da vitrine>` — dá a foto exata na largura pedida (o painel do app corta/escala quando a tela emulada é maior que ele). Para foto de um gesto (o detalhe aberto), a vitrine lê `?abrir=<nº>&parte=<rótulo>` e toca sozinha. **Limite:** abaixo de ~500 px o Edge sem janela não encolhe (a foto de celular sai cortada) — celular pelo navegador do app no tamanho "mobile".

### A-111

- [2026-10-23] **A-111** (Claude Code, SESSAO-40) · **A fala do vídeo do dono dá para transcrever na máquina, sem serviço de fora:** `faster-whisper` (modelo `small`, CPU, `int8`) instalado no scratchpad (`pip --target`); o `av` que veio junto recusou o arquivo (`metadata_errors`), então o áudio sai em WAV 16 kHz pelo ffmpeg do `imageio-ffmpeg` e entra na transcrição como vetor (`wave` + `numpy`). 54 s de vídeo em ~1 min. A fala disse o que os quadros não diziam ("em todos os setores… esse filtro", "a rastreabilidade dos cards"). Atualiza a memória "ver vídeo quadro a quadro" (áudio dava "não"). Os quadros a cada 2 s seguem para ver a tela.

### A-143

- [2026-11-05] **A-143** (Claude Code, SESSAO-43) · **Foto de tela sem o navegador do app:** o Edge da máquina tira print sozinho (`msedge --headless --screenshot=<arquivo> --window-size=…`), mas só funciona com a saída do comando ENCANADA (`| grep …` — solto, ele fica preso) e com o caminho em barras normais (`cygpath -m`). Os gráficos precisam de `isAnimationActive={false}` — com a animação, a foto sai sem as barras (e o painel escondido do app também não anima).

### A-191

- [2026-11-05] **A-191** (Claude Code, SESSAO-46) · **Pendência pessoal = tarefa do Sistema da pessoa:** "Testar a sugestão #N" nasce em `plt_tarefas` (origem sistema, responsável = quem sugeriu, privada) — chega na abertura do app e fica ao vivo pelo canal da pessoa SEM requisição nova (Meu painel, Afazeres e a bolinha leem o mesmo cache), e ninguém conclui à mão (o gatilho da tarefa do Sistema já barra). Só a maquinaria fecha, com `plt.tarefa_sistema = '1'` guardado e devolvido.

### A-194

- [2026-11-06] **A-194** (Claude Code, ajuste dos cabeçalhos) · **`vitest run` na pasta principal pega a cópia velha da worktree da SESSAO-46** (`.claude/worktrees/…`) e acusa falhas que não são da frente → rodar sempre `vitest run --root "$R" --dir src`. E título de tela que muda de lugar por largura (barra do topo no celular × página no computador): contexto com o ELEMENTO da vaga (guardado por `ref={setEstado}` na casca) + `createPortal` no componente do cabeçalho — sem duplicar o título nem consultar nada.

### A-200

- [2026-11-09] **A-200** (Claude Code, SESSAO-47) · **Vitrine para foto com estados abertos:** a tela real com dados de exemplo no cache, a rede bloqueada no navegador e origem própria (`vitrine.localhost` — o login do dono em `localhost` nem é visto); `?toque=Texto|Texto*` toca os botões sozinha (dentro da janela aberta, se houver; `*` casa pelo começo) e `?foto=1` desliga transição e animação — sem isso o Edge sem janela ([[Memoria - Testes e Validacao ao Vivo#A-143|A-143]]) fotografa o botão escolhido ainda sem cor. O Edge sem janela não desce de ~500 px: a foto de celular (375) vem do navegador do app em tamanho de celular, copiando o arquivo que a captura devolve.

### A-218

- [2026-11-11] **A-218** (Claude Code, SESSAO-48) · **Vitrine com toques automáticos:** para fotografar um estado interno de janela (o 2º passo de "Remover do PCP", a escolha "Passar para outro pedido"), um componente só da vitrine toca nos botões pelo TEXTO (pulando os desligados — o 1º com o texto pode ser o "Todas de uma vez" desligado) e escreve no campo pelo setter nativo + evento `input` (o React ouve o `input`). Nada no código da plataforma muda.

### A-241

- [2026-11-17] **A-241** (Claude Code, SESSAO-51) · **Vitrine com janela sobre janela:** o ajudante que toca nos botões para a foto procura na janela de CIMA — a ÚLTIMA `[role="dialog"]` (a primeira é a do card, embaixo) — e também em `label` (o rádio nativo da casa não tem texto; o rótulo tem). Sem isso a cena "escolher e marcar o motivo" fica parada na 1ª tela.

### A-248

- [2026-11-18] **A-248** (Claude Code, SESSAO-52) · **Foto de tela sem o navegador do app:** o Edge sem janela dirigido pelo protocolo de depuração (o `WebSocket` e o `fetch` do próprio Node, sem dependência nova) emula 375/768/1440, mede `scrollWidth` e fotografa — resolve o corte abaixo de ~500 px.

### A-249

- [2026-11-18] **A-249** (Claude Code, SESSAO-52) · **Vitrine com a rede bloqueada no primeiro módulo importado:** `fetch` trocado por respostas de exemplo por nome de porta e `WebSocket` por um mudo deixam montar a tela de verdade com o `.env.local` da mesa sem nenhuma chamada sair para produção; a lista do que a tela pediu fica em `window.__pedidas` (conta as requisições de graça).

### E-297

- [2026-11-18] **E-297** (Claude Code, SESSAO-52) · **A suíte de testes de tela oscila com a máquina dividida** entre várias mesas (tempo esgotado em testes diferentes a cada rodada). *Correção:* separar "meu" de "da máquina" rodando sozinhos os arquivos que falharam; a rodada que vale é com a máquina livre.

### A-251

- [2026-11-18] **A-251** (Claude Code, SESSAO-53) · **Foto de celular pelo Chrome sem janela:** emulação do aparelho pelo protocolo de depuração, não `--window-size` (que não reduz a largura útil abaixo do mínimo da janela).

### E-301

- [2026-11-18] **E-301** (Claude Code, SESSAO-53) · **Testes de tela com muitos trabalhos em paralelo numa máquina compartilhada** estouram o tempo. *Correção:* menos trabalhos em paralelo (ou a máquina livre) antes de chamar de defeito.

### E-304

- [2026-11-18] **E-304** (Claude Code, SESSAO-54) · **Vitrine em moldura aberta por `file://` no Edge sem janela não carrega a tela de dentro** (fotos em branco, medidas nulas); e decodificar duas vezes o parâmetro transformou `%23` em `#` (o resto virou âncora). *Correção:* a moldura servida pelo mesmo Vite; decodificar uma vez só.

### A-253

- [2026-11-18] **A-253** (Claude Code, SESSAO-54) · **Foto de aviso passageiro:** o tempo virtual do navegador tem de ser menor que os 5 s do aviso (com 9 s o aviso já tinha ido embora na foto, mesmo aparecendo nas medidas).

### E-305

- [2026-11-18] **E-305** (Claude Code, SESSAO-54) · **Rodar os testes de tela junto com a bateria do banco** deu falha falsa (uma espera estourou numa tela que nem era do Comercial); com a máquina livre, tudo verde. *Correção:* uma coisa de cada vez.

### A-258

- [2026-11-18] **A-258** (Claude Code, SESSAO-55) · **Teste de tela que conta chamadas:** dublê de `supabase` que grava `rpc` e faz `from` estourar; o guardado nasce como o app deixa (setores, etiquetas, campos) — `src/paginas/umaLeitura.test.tsx`.

### E-307

- [2026-11-18] **E-307** (Claude Code, SESSAO-55) · **Argumento novo na FRENTE de uma função que o teste troca por dublê** muda o que o dublê recebe. *Correção:* argumento novo vai no fim.

### E-310

- [2026-11-18] **E-310** (Claude Code, SESSAO-55) · **Comparação que passa vazia dos dois lados:** um fato de "iniciar" com hora anterior à chegada da peça não abre execução, e o "igual" passava sem dado. *Correção:* conferir que o cenário tem dado (um ✔ de "tem número de verdade" ao lado do "igual").

### E-312

- [2026-11-18] **E-312** (Claude Code, SESSAO-55) · **Vitest completo com a máquina carregada:** estouros de 5 s em telas alheias. *Correção:* repetir o arquivo sozinho antes de culpar a mudança.

### E-318

- [2026-11-24] **E-318** (Claude Code, SESSAO-56) · **Rota de teste só com paradas avulsas não existe pela tela** (programar exige pedido). *Correção:* validação de ordem "sem mexer em pedido real" se faz na montagem; o que só existe em rota gravada fica com a prova da bateria do banco — dizer isso no pedido da fila antes de mandar "crie uma rota de teste".

### E-319

- [2026-11-24] **E-319** (Claude Code, SESSAO-56) · **`npm test` com servidor + navegador abertos estoura o tempo de 5 s** em telas pesadas (cada rodada falha em arquivos diferentes). *Correção:* rodar a bateria com a máquina livre e conferir as falhas isoladas + `git diff` antes de chamar de defeito.

### A-264

- [2026-11-24] **A-264** (Claude Code, SESSAO-57) · **Ver na tela uma função ainda não publicada:** simular a resposta dela dentro do navegador de teste (interceptar a chamada à função) — nada vai ao banco, e a tela é vista de verdade.

### E-327

- [2026-11-24] **E-327** (Claude Code, ajuste do CEP pelo navegador) · **`vitest run --root <repo>` rodou também os testes das worktrees guardadas dentro da pasta** (`.claude/worktrees/…`) — falhas que não eram desta entrega. *Correção:* `--exclude ".claude/**"`.

### E-330

- [2026-11-25] **E-330** (Claude Code, subida de 25/11) · **A bateria do banco tem uma prova que depende da hora:** "o fluxo do n8n conversa com o banco de ponta a ponta" (SESSAO-33) falha de madrugada — o lote da fila deixa a conta da fábrica de fora na janela de varredura dela (03:10–04:40, hora de Fortaleza), e o item da fábrica não sai no lote (às 03:20 de 25/11: 2.127 verdes, só esta vermelha; na subida de 24/11, de dia, verde). *Correção:* rodar a bateria de dia ou ler a vermelha contra a janela da fábrica antes de chamar de defeito; o certo é a prova fixar a hora (fica como dívida de teste).
