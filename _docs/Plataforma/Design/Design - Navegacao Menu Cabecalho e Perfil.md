---
titulo: "Modelo de sistema — Navegacao Menu Cabecalho e Perfil"
tipo: design
assunto: navegacao
atualizado: 2026-11-18
tags: [plataforma, design-system, modelo-de-sistema, design/navegacao]
---

# 🧩 Design - Navegacao Menu Cabecalho e Perfil

> Parte de [[PLT - Modelo de Sistema]], movida em 18/11/2026 sem reescrever (a numeração das seções é a do documento original). Padrão novo deste assunto entra **aqui**.

### Menu lateral e tela do setor (SESSAO-07 / D-27 / D-28)

- **`Layout` virou MENU LATERAL:** coluna fixa grafite à esquerda no computador (`lg:`);
  gaveta com overlay atrás do hambúrguer no celular. Sino, usuário e sair vivem no rodapé
  da sidebar (e o sino também na barra fina do celular). A rota `/tablet` renderiza **sem
  navegação nenhuma** — o operador não navega, ele age.
- **`<CartaoTablet>`** (`src/tablet/`) — o card da tela do setor: dados do PRODUTO e nunca
  do cliente ([[D-028 - Card do operador dados do produto espaco de imagens som|D-28]]), tempo em fonte grande, etiqueta da etapa, ações em botões `galpao`
  (Iniciar/Finalizar/Receber com 64px; Mover/Fotos/Histórico com 56px). O card há mais
  tempo esperando ganha borda âmbar + ampulheta + texto (nunca só cor — [[Memoria - Modelos Formulas e Possibilidades#M-12|M-12]]).
  **↪️ SESSAO-24 ([[D-059 - Quadros de producao so por arrasto o unico botao e Concluir|D-59]]): apagado** — o modo tablet usa o `QuadroKanban` com `tamanho="galpao"`
  (sem cliente), e o PIN é pedido ao soltar/concluir.
- **`<ModalPinOperador>`** — o "quem é você?" de toda ação no tablet: o operador toca no
  PRÓPRIO NOME (lista dos membros do setor) e digita o PIN num **teclado na tela** — o
  ciclo inteiro sem teclado do sistema. A conferência é da Edge Function; o resultado vira
  o AUTOR do gesto (`p_operador_id` nas RPCs; `usuario_id` nos inserts).
- **Som de chegada** (`src/tablet/som.ts`): dois toques curtos de senoide em volume baixo
  ("mínimo e um pouco opaco" — palavras do dono), gerados por WebAudio, sem arquivo e sem
  rede. O primeiro toque na tela libera o áudio do navegador.
- **`<ModalImagensProduto>`** — o espaço de imagens da peça (D-28): galeria por SKU
  (bucket `plt-imagens`, caminho `produtos/{codigo}/…`); admin/líder anexa e remove,
  operador vê. É onde a futura biblioteca de peças pluga.
- **Tempo real:** mudanças em `plt_cards` chegam por Supabase Realtime e invalidam as
  queries; o polling de 20s continua como rede de segurança.

### Navegação em duas barras, temas e Meu Perfil (SESSAO-13 / D-36 / D-41)

- **A sidebar virou DUAS barras lado a lado** (pedido do dono na revisão da SESSAO-13,
  substituindo o dropdown em cascata): a **barra 1** lista os PAIS (Início · Controle de
  Produção · Logística · ROTAS · Dashboards · Administração) — clicar num pai **nunca
  navega**, apenas mostra os filhos dele na **barra 2**, um menu ao lado do menu. Cada
  barra tem o próprio botão de recolher e os dois estados ficam lembrados
  (`localStorage`). Barra 1 recolhida vira trilho de ícones; clicar num ícone abre a
  barra 2 com os filhos. No celular, a gaveta carrega as duas barras.
- **↪️ 14/10 noite ([[D-135 - Ajustes de tela do dono|D-135]]) — hierarquia e nomes da barra 2:** o **pai** de seção é legível (`text-sm font-semibold text-grafite-50`, alvo de 44 px, seta de recolher) — nada de caixa alta miúda apagada; os **filhos** ficam debaixo dele numa **linha-guia** (`ml-3 border-l border-grafite-600`), um tom mais suave (`text-grafite-200`), o ativo em `bg-menu-ativo` e negrito. **Um padrão só de nome** em todos os grupos: primeira letra maiúscula, o resto minúsculo, siglas da casa inteiras — os setores passam por `nomeNoMenu` ("LIMPEZA E EMBALAGEM" → "Limpeza e embalagem", "PCP" fica) — o nome guardado no banco não muda. Fábrica: Controle de produção · Pedidos · Logística · Rotas.
- **↪️ 15/10 — gaveta do celular:** com o painel de itens aberto, a barra 1 vira **trilho de ícones** (`useTelaPequena`, < 1024 px) e a barra 2 fica `w-60` (`lg:w-52` no computador) — os nomes não quebram.
- **↪️ A gaveta CONTÉM as duas barras (ajuste de 28/09/2026):** quem desliza é o
  `<aside>`; quem rola na horizontal (abaixo de `lg`), quando as duas não cabem na
  tela, é um envoltório por dentro dele. Teto da gaveta = a largura da tela
  (`max-w-[100vw]`). Fechada, sai inteira e fica **`invisible` depois do deslize**
  (`transition-[translate,visibility]`) — nada dela pega toque nem Tab. **Nunca
  `overflow` no próprio `<aside>`:** o `translate` dele faz dele o bloco de contenção
  do painel `fixed` do sino, que seria cortado. Origem: o teto de 92vw era da gaveta
  de uma barra só (SESSAO-07); com a segunda, ~38–45px da barra 2 ficavam na borda
  esquerda com a gaveta fechada, pegando o toque ([[Memoria - Front Telas e React 1#E-48|E-48]]).
- **Camadas da gaveta aberta (celular/tablet, ajuste de 28/09/2026 — [[Memoria - Front Telas e React 1#E-57|E-57]]):** fundo
  escuro e gaveta em **`z-[55]`** — acima das bolhas flutuantes (balão do chat e
  bolinha de execução, `z-40`) e dos painéis delas (`z-50`), que vêm DEPOIS no DOM e
  por isso venciam o empate; abaixo dos avisos passageiros (`z-[60]`). No computador a
  coluna fica em `lg:z-50`, abaixo das janelas (Modal). A escala da casa: 30 barra do
  celular · 40 bolhas e fundos · 50 painéis, gaveta no computador e janelas · 55
  gaveta aberta no celular/tablet · 60 avisos. Menu aberto = tudo da página por
  baixo do escuro.
- **Sino no topo** da barra 1, junto à logo; painel de avisos **ancorado à borda
  ESQUERDA da página** (prop `painelLado` do `<SinoNotificacoes>`), com `max-h` da
  viewport — nunca cortado. No rodapé: **Modo tablet** (botão fixo), bloco do usuário
  (abre o Meu Perfil), **Configurações** (também abre o Meu Perfil — as configurações
  pessoais vivem lá) e Sair.
  **↪️ 06/11 (cabeçalhos compactos): o sino desceu para o RODAPÉ**, ao lado do nome, junto do mini menu `⋯` (`MenuDoUsuario`: Buscar card · Tema · Sair); o painel abre de baixo (`painelLado="esquerda-baixo"`). No topo da barra 1 ficam só a logo e o recolher.
- **Botão Voltar em toda tela** (`<BotaoVoltar>` na casca): volta no histórico; sem
  histórico, vai para `/inicio/meu-painel`.
  **↪️ 06/11:** o voltar saiu da casca e virou a **setinha à esquerda do título**, dentro do `<CabecalhoDaTela>` (`src/componentes/BotaoVoltar.tsx`) — toda tela da casca tem o cabeçalho, logo tem o voltar.
- **Rotas sempre `/pai/filho`** (lei [[D-036 - Lei de navegacao hierarquia pai filho pai nunca navega rota|D-36]]): o `codigo` de `plt_setores` é o slug de
  `/producao/{codigo}`; terminais moram em `/logistica/estoque` e `/rotas/entregas` —
  helper único em `src/navegacao/rotas.ts` (`rotaDoSetor`). Rotas antigas redirecionam.
- **8 temas Domoby** (claro · gelo · areia · dourado · ardósia · grafite · escuro ·
  meia-noite) na camada semântica de `tokens.css`, aplicados por `data-tema`; catálogo e
  aplicação em `src/perfil/tema.ts` (anti-flash via localStorage; o perfil confirma). A
  família escura compartilha os estados de qualidade escuros e `color-scheme: dark`.
  **Regra de sempre:** amarelo é marca/ação em TODOS os temas; estados nunca só por cor.
- **Meu Perfil** (`/inicio/meu-perfil`): foto (bucket `plt-imagens`, pasta
  `perfis/{id}/`), dados cadastrais (login/e-mail via Edge Function), senha (exige a
  atual) e o seletor de temas com amostras. **Login** em tela dividida: logo metálica
  (`<Marca sobre="metalico">`, gradiente dourado) sobre grafite à esquerda, formulário à
  direita; empilha no celular.
- **Regra nova de front ([[Memoria - Regras de Negocio - Producao PCP Estoque e Rotas 1#E-22|E-22]]):** queryKey compartilhada usa SEMPRE o mesmo fetcher da
  API — fetcher local com a mesma chave envenena o cache dos outros consumidores.

### A plataforma como aplicativo (12/11 — D-306)

- `public/manifest.webmanifest` + `<link rel="manifest">` e `<link rel="apple-touch-icon">` no `index.html`: nome "Sistema Domoby" / "Domoby", janela própria, início em "/", barra #5A585C, abertura #f7f7f8. Ícones em `public/icones/` (`domoby-192/512.png` com os cantos arredondados e fundo transparente; `domoby-mascara-192/512.png` em quadrado cheio com o desenho a 80% — a zona segura do ícone adaptável) e `public/apple-touch-icon.png` (180, quadrado cheio). O desenho é o do `favicon.svg` (o "d" em Poppins 700 branco, a bolinha #F1C24B, o grafite #5A585C) — para refazer, a receita está na memória ([[Memoria - Acesso Seguranca e Credenciais#A-222|A-222]]). Sem service worker.
- Em janela própria não existe a barra do navegador: o botão de voltar de cada tela ([[D-036 - Lei de navegacao hierarquia pai filho pai nunca navega rota|D-36]]) e o aviso de versão nova (abaixo) cobrem a navegação e a atualização.
- **"Atualizar" no cabeçalho do tablet** (`BotaoAtualizarTela` em `src/tablet/`, [[D-306 - A plataforma abre como aplicativo um icone uma janela|D-306]].5): `Botao` fantasma com `RefreshCw` + "Atualizar", o primeiro do grupo da direita (Atualizar · Trocar setor · pessoas · Sair), 44 px como os vizinhos; ao tocar vira "Atualizando…" com o giro e desligado (`carregando`) até a página ir embora. O grupo da direita do cabeçalho tem `flex-wrap justify-end`: no celular (375) os botões descem para uma 2ª linha em vez de empurrar o "Sair" para fora.

### Aviso de versão nova (14/10 noite — D-135)

- `AvisoVersaoNova` (`src/componentes/`): cartão discreto no canto inferior esquerdo (acima da barra do celular), "Saiu uma versão nova da plataforma" + botão "Atualizar". Aparece na casca e no tablet; a próxima troca de tela já recarrega sozinha.
- ↪️ **SESSAO-48 (frente 5 — [[D-303 - A versao e o codigo e documentacao nao publica a mudanca|D-303]]…[[D-305 - A trilha diz por que a pagina abriu|D-305]]):** a versão é o código montado (o mesmo código = a mesma versão; só documentação não publica). **Escritório:** a troca de tela recarrega, como antes. **Tablet e TV:** só no momento seguro — sem janela aberta e 1 minuto sem toque; o aviso ganha a linha "Ela se atualiza sozinha depois de 1 minuto sem uso." Botão "Atualizar" com 44 px no escritório (era 36) e 64 px no tablet e na TV. **Pedaço sumido:** "Atualizando a plataforma…" por cima da tela e uma recarga só por versão; se falhar de novo (ou sem internet), só o aviso com "Atualizar". **Auditoria:** a abertura vira "Abriu a plataforma — <porquê>" (versão nova, sozinha ou pelo botão · faltava uma parte da versão anterior · troca de setor no tablet · a aba tinha sido descartada pelo navegador · atualizou a página · abriu pelo endereço · voltou), com os detalhes em português.

### Lançar qualquer produto, o filtro dos quadros e a busca geral (SESSAO-40 / D-186…D-188)

- **O ícone de lançar no cartão do estoque** (`CartaoProdutoEstoque`): o `Factory` ao lado do "Mínimo", com alvo de 44 px, em **todo** móvel para quem mexe no estoque — `animate-bounce text-danificado-forte` quando o produto pede produção (falta peça e a automática desligada; `aria-label` "… precisa de produção — lançar para produção"), `text-texto-fraco` (acende no hover/foco) no resto ("Lançar … para produção"). No detalhe do produto, o botão secundário por extenso "Lançar para produção" (a linha inteira da grade de gestos). O lançamento manda uma chave por abertura (`chaveDoGesto`) e uma trava de envio (`useRef`) — o clique duplo não manda dois.
- **`<FiltroDoQuadro>`** (`src/kanban/componentes/FiltroDoQuadro.tsx`) + **`useFiltroDoQuadro()`** (`src/kanban/filtroQuadro.ts`): o campo do topo dos quadros (à esquerda do botão da ordem da fila; no PCP, ao lado dele em cada aba) — `Campo` `type="search"` com o rótulo oculto, ícone `ListFilter`, placeholder "Filtrar: nº do pedido ou nome do móvel", o "x" de 44 px (e o Esc) limpa; `tamanho="galpao"` no tablet. O texto mora no endereço (`?filtro=`, `replace`), vai ao servidor depois de 300 ms parado com 2+ caracteres. Filtrado, cada coluna diz embaixo do título "**N cards batem com o filtro**" / "nenhum card bate com o filtro" (`ListFilter` + texto) e o subtítulo da tela diz o total com o filtro como foi digitado; lista vazia do PCP: `<NadaBateComOFiltro>`. **A barra do topo fica na mesma posição com o quadro abrindo ou aberto** (o campo não perde o foco quando o quadro do filtro novo chega) e a consulta mantém o quadro anterior do MESMO setor na tela até o novo chegar (`placeholderData` só quando o setor é o mesmo — [[Memoria - Regras de Negocio - Producao PCP Estoque e Rotas 1#E-96|E-96]]).
- **A busca geral** (`src/busca/`): `BotaoBuscaGeral` — a lupa (`Search`, 44 px, o mesmo desenho do sino) ao lado do sino na barra 1 do menu (com o atalho **Ctrl+K / ⌘K** — só essa escuta o teclado) e na barra do celular; não aparece sem o módulo fábrica nem no tablet. `BuscaGeral` (pedaço próprio, `lazy`): `Modal tamanho="galpao"` (no celular sobe do rodapé) "Buscar card", o campo preso no topo enquanto a lista rola, a linha de ajuda ("2 números ou mais… 3 letras ou mais"), "Buscando…", a lista e "Ver mais". **Cada resultado** é uma linha (`rounded-dm-lg border`) com o ícone do tipo (`ClipboardList` pedido · `Package` peça · `PackagePlus` reposição · `SquarePen` avulso), a origem em `text-xs` ("Pedido 13721", "Reposição de estoque (no PCP)", "Card avulso"), o nome com o (k/n) e a **pílula de onde está** (`MapPin` + texto; tons: `perfeito` pronta/estoque/entregue, `info` setor/rotas, `atencao` PCP aguardando/stand-by/devolução, neutro o que saiu) e o selo "Pedido cancelado" (`Ban`) — tocar abre a janela do card (`useAbrirCard`); à direita, separado por uma linha, o atalho `LayoutGrid` de 48 px "abrir o quadro do setor já filtrado" (só setor de produção e PCP com o pedido ainda lá). O texto do lugar é lógica pura (`ondeEsta`, Vitest).
  **↪️ 06/11:** a lupa saiu da barra 1 (quase cobria a logo) — está no mini menu do rodapé e na barra do celular; a janela é montada UMA vez na casca (`BuscaGeralNaCasca`, que também escuta o Ctrl+K).

### Cabeçalho da tela e menu compacto (ajuste de 06/11/2026)

Pedido do dono, com o print da MONTAGEM: *"diminuir o tamanho desses headers e coisas assim de TODAS AS TELAS, SEM EXCEÇÃO"*.

- **`<CabecalhoDaTela>`** (`src/componentes/CabecalhoDaTela.tsx`) — o topo de **toda** tela da casca, numa linha: setinha de voltar · ícone opcional (20 px) · título `h1` (`text-lg sm:text-xl` — um terço menor que o antigo `text-2xl sm:text-3xl`) · selo opcional · o **?** (`Dica compacta` com `CircleHelp`) · as ações/controles à direita (`children`, `flex-wrap`: descem só quando não cabem; um item com `mr-auto` puxa os anteriores para junto do título). **O texto explicativo nunca fica embaixo do título** — vai para o **?** (`ajuda`, com `rotuloAjuda` em língua de gente). Status que precisa ser visto sem clicar (andamento do dia, aviso de uso) pode ficar visível ao lado. Tela nova nasce com ele; nada de `h1` solto.
- **Tela do setor:** nome · ? · Etapas do setor · filtro (`mr-auto`) · ordem da fila encostada à direita — a linha única; o `QuadroKanban` não recebe mais `filtro`/`aoMudarOrdem` ali (o PCP e o tablet seguem passando).
- **Títulos de seção (`h2`)**: `text-base` (eram `text-lg`) — o título da tela (20 px) manda na hierarquia.
- **Menu lateral:** barra 1 com 208 px (`w-52`; trilho `w-16`), barra 2 com 184 px no computador (`lg:w-46`; `w-56` na gaveta); letra de 13 px (`text-[0.8125rem]`); itens com **36 px só no mouse** (`[@media(pointer:fine)]:min-h-9`) — no toque, os 44 px de sempre ([[D-006 - Dispositivos tablet PC fixo por setor E celular pessoal|D-06]]).
- **Rodapé da barra 1:** Modo tablet · [foto + nome + matrícula] · sino (`compacto`, 36 px) · **`⋯` mini menu** (`MenuDoUsuario`): painel em portal, `fixed`, posicionado pelo botão (acima dele; com o menu recolhido, ao lado), Esc / toque fora (captura) / trocar de tela fecham; dentro: Buscar card (Ctrl K), os temas em lista (`TemasDoMenu` — `radiogroup` de amostra + nome) e Sair da conta. Camada 58.
- **Modo TV e topo do modo tablet ficam como estavam** (decisão do dono em 06/11: a TV é lida de longe; o tablet é do chão de fábrica).
- **↪️ 2ª volta (06/11, com o dono olhando):** o mini menu segue as cores da **barra lateral** (`menu-superficie` + `bg-grafite-700`, que cada tema retinta), não as da página; os temas ficam **escondidos dentro de "Tema"** (o item abre/fecha a lista, `aria-expanded`, uma coluna — nomes inteiros). Barra 2 com **196 px** (`lg:w-49`): a 184 "Controle de produção" e "Limpeza e embalagem" quebravam. Rodapé apertado (avatar 28 px, sino e `⋯` 32 px) para a matrícula caber inteira.
- **↪️ 3ª volta (06/11):** **na tela estreita (< 1024 px), a setinha, o nome da tela e o ? sobem para a barra escura do topo** — a casca guarda a vaga (`VagaDoTitulo`, `src/componentes/vagaDoTitulo.ts`) e o `CabecalhoDaTela` vai para lá por portal (`naBarra`: letra 16–18 px, `truncate`, `Dica tom="menu"`); na página fica só a linha das ações (nada, se a tela não tem ação). Sem título na vaga, a barra mostra a logo (`peer-[:not(:empty)]:hidden`). **Um sino e uma lupa por tela:** na tela estreita, só os da barra de cima (o rodapé da gaveta fica com o nome e o `⋯` só com Tema e Sair); no computador (sem barra de cima), os do rodapé da barra lateral.
- **↪️ 4ª volta (06/11 — "a barra escura de cima fica… deixe isso como padrão em toda a plataforma"): a barra escura de cima existe em TODA tela, celular e computador**, mais baixa (44 px: `min-h-11 py-1`, botões de 36 px com alvo de 44): ☰ (só onde o menu é gaveta) · [setinha · nome da tela · ?] · lupa · sino. **A lupa e o sino moram só nela** — o rodapé da barra lateral tem o nome e o `⋯` (Tema · Sair). No editor das automações a barra só aparece no celular. O painel do sino abre logo abaixo da barra (`top-12`).
- **Estoque compacto (06/11):** a busca do catálogo (rótulo só no leitor de tela) e o "Cadastrar produto ao estoque" subiram para a linha das abas, na página (o texto da busca e o "cadastrando" moram no `Estoque` e descem ao `PainelTop20` por props); embaixo, só o "Mostrar".
- **↪️ 5ª volta (06/11):** **Todos os pedidos / Cancelados** — a busca (rótulo só no leitor de tela), o "Marcar os N da tela" e o "Selecionar pedidos" numa linha só, na linha das ações. **Programação → Programar** — o "Adicionar parada avulsa" mora UMA vez, no topo do mapa ("Mapa" à esquerda, o botão + o `i` com "como montar a rota" à direita; a legenda do mapa embaixo em `text-xs`); saiu de baixo do mapa e do cabeçalho da rota programada; "Sem programação (N)" ganhou o `i` no lugar do parágrafo. **Texto de apoio no título dentro da barra escura** (o total "(5.724)", a data, o cadeado): `APOIO_NA_BARRA` troca as cores "suave"/"fraca" pelo cinza claro da barra — só no `h1` e no selo (o balão do ? segue com as cores da página).
- **↪️ 6ª volta (06/11) — o padrão visual mudou em 5 pontos:**
  - **Títulos (`h1`/`h2`/`h3`) na letra do sistema (Inter, semibold)** — "a fonte dos nomes dos setores e abas está destoante, feia". A Poppins fica só na marca (`<Marca>`), no Modo TV e no topo do tablet. Título de janela (`Modal`) também em Inter.
  - **Barra de rolagem fina** em toda a plataforma (`scrollbar-width: thin`, cor do texto suave a 40%); na barra lateral e na barra escura, no grafite delas (`.menu-superficie`).
  - **Traço leve sob a linha das ações** de toda tela (o `header` das ações do `CabecalhoDaTela`: `border-b border-borda/50 pb-3`) — separa busca/abas/botões dos dados. Busca de lista mora nessa linha (Estoque, Todos os pedidos, Expedição, Entregas), rótulo só no leitor de tela.
  - **Botões flutuantes** (`.botao-flutuante`; o "em execução" é `.botao-flutuante-discreto`, no máximo 60%): passam por cima da barra lateral (no computador a coluna desceu para a camada 30; as bolhas são 40) e seguem a transparência escolhida no mini menu ("Botões flutuantes", faixa de 30 a 100%, guardada no aparelho — `src/lib/opacidadeFlutuantes.ts`, aplicada no `main.tsx` antes do 1º quadro); ao passar o mouse, focar ou abrir, ficam inteiros.
  - **"Modo TV"** acima do "Modo tablet" no rodapé da barra lateral, para quem tem a permissão de transmitir e outros acessos (`temModoTv && !ehSoTv`); aparece AO VIVO: o banco manda `perfil` no canal da pessoa ao ligar/desligar o Modo TV e a casca relê o perfil.
- **Login (06/11):** ~~um cartão só, centralizado~~ **↪️ 2ª volta: a TELA INTEIRA dividida ao meio** ("volta isso a ser uma tela grande… gostei desse padrão, deixe ele") — metade grafite da marca (logo `xl`, "Sistema Domoby") e metade clara com o formulário centralizado (`max-w-md`, título `text-2xl`); no celular a faixa da marca em cima; "Entrar" + `i` com as explicações; "Esqueci minha senha · Entrar com PIN" numa linha; "Modo tablet do setor" depois de um traço leve. O nome "Plataforma de Produção" virou **"Sistema Domoby"** em toda parte (login, barra lateral, rodapé, título da aba do navegador).
- **↪️ 9ª–11ª voltas (06/11):**
  - **A linha das ações fica PRESA no topo** (do `md` para cima): `md:sticky md:top-11 md:z-20 md:-mt-3 md:bg-fundo md:pt-3` no `header` das ações do `CabecalhoDaTela`; a altura de tudo o que está preso (barra + linha) vai para `--dm-topo-fixo` no `html` (medida por `ResizeObserver`) — quem também gruda (as colunas do mapa da Programação) usa `top-[calc(var(--dm-topo-fixo,2.75rem)+0.75rem)]`. No celular não gruda (a linha pode ter 2–3 andares).
  - **Sem rodapé com a marca** em tela nenhuma ("não é necessário a marca acompanhar todo o sistema").
  - **Transparência dos botões flutuantes de 0 a 100, de 1 em 1**, numa vista própria do mini menu (o "⋯" → Botões flutuantes): o número grande, − / + de 1%, e a **faixa da casa** (`.faixa-domoby`: trilho fino, a parte cheia em `--dm-menu-destaque` pela variável `--faixa-cheia`, bolinha clara com contorno). **Em 0% somem de vez** (`html[data-flutuantes-ocultos]` → `display:none !important` — o `!important` porque o `inline-flex` do botão é utilidade e vence a camada base).
  - **Card do caminhão em "Já programadas":** o bloco do nome com base de 18rem (`basis-72`) — sem espaço, os botões descem; todos os botões do caminhão escolhido numa fileira só embaixo.
  - **Modo TV:** a seleção do setor é a `Selecao` da casa (não a lista nativa do navegador); o relógio com segundos (`RelogioTv`, pedaço próprio que só redesenha a si mesmo, acertado no começo de cada segundo); **trocar o dia** (‹ › e "Voltar para hoje", discretos; fora de hoje os textos dizem "no dia") — as setas só aparecem quando a porta responde `pode_trocar_dia` (a porta nova; o site pode subir antes do banco sem botão quebrado).
- **Mapa da Programação em tela cheia (06/11):** o "Expandir" abre uma camada própria (portal, `fixed inset-0 z-[57]` — acima da gaveta 55, das bolhas e da barra escura) com o MESMO mapa (o nó muda de lugar, sem recriar) e só "Ver pedidos (N)" + "Recolher o mapa" + o zoom; "Ver pedidos" é um painel curto dentro da camada (nº · endereço · data de entrega, na ordem da rota); Esc fecha o painel e depois recolhe; a página de trás não rola. A coluna do mapa gruda abaixo da barra escura e cabe na tela; no Programar o painel da rota é `compacto` (paradas · peças · km · tempo; ida e volta numa linha; o aviso "sem trânsito" no `i`).
