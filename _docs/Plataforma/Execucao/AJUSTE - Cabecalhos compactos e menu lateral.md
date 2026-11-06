# AJUSTE — Cabeçalhos compactos e menu lateral (06/11/2026)

Pedido do dono (06/11, com print da tela da MONTAGEM): *"faz um tempo que não altero
o layout do sistema, mas vi que isso está bem feio — analisar rota por rota e diminuir
o tamanho desses headers e coisas assim de TODAS AS TELAS, SEM EXCEÇÃO"*. Ramo
`ajuste-cabecalhos-compactos` (a partir da `main` 2e2241a), na pasta principal.

## O pedido, item a item

1. O nome do setor (título da tela) 1/3 menor.
2. O informativo debaixo do título vira um ícone **?** ao lado do nome.
3. "Etapas do setor" e o filtro na mesma linha, sem quebra.
4. O botão da ordem da fila na mesma linha, encostado à direita.
5. Sai a dica "Para ver as outras colunas: segure o fundo do quadro…".
6. Sai o "soltar aqui começa o tempo" — fica só o ícone verde ao lado do número da etapa.
7. Barra lateral um pouco menor, fonte um pouco menor ("só ela toda aberta já toma quase metade da tela").
8. A lupa quase cobre o nome da empresa: lupa, sair e tema vão para um **mini menu** ao
   lado do nome do usuário (embaixo); ao lado do nome ficam o sino e o botão do mini
   menu; no topo fica só o botão de expandir/recolher.

## Respostas do dono às perguntas (06/11)

- **Voltar:** vira uma setinha na mesma linha do título (some a linha só dele) — em toda tela.
- **Linha única:** na tela do setor, título + ? + Etapas do setor + filtro + ordem numa linha só (desce só em tela estreita).
- **Modo TV:** fica como está (lido de longe).
- **Tablet:** fica como está (o topo do modo tablet não muda; o quadro do tablet mantém o texto "soltar aqui começa o tempo").

## Decisões técnicas

- Um componente único de topo de tela (`CabecalhoDaTela`) com: setinha de voltar, ícone
  opcional, título (`text-lg sm:text-xl` — era `text-2xl sm:text-3xl`), selo opcional, o
  **?** (`Dica` com `CircleHelp`) e as ações na mesma linha (`flex-wrap`). A casca
  (`Layout`) deixa de desenhar a linha do Voltar — quem desenha é o cabeçalho de cada tela.
- Títulos de seção (`h2`) `text-lg` → `text-base` (a hierarquia: título 20 px > seção 16 px).
- Menu: barra 1 `w-60` → `w-52`; barra 2 `lg:w-52` → `lg:w-46`; letra `text-sm` → `text-[13px]`;
  itens com 36 px de altura só no mouse (`pointer: fine`) — no toque seguem 44 px (D-06).
- Mini menu do usuário: painel próprio em portal (fixo, ancorado ao botão, Esc / toque fora
  fecha), com Buscar card (Ctrl+K continua), os temas em lista e Sair. A busca e o seu modal
  passam a morar na casca (o modal não pode morrer junto com o mini menu).

## Registro do que foi feito

### Base (eu)
- `src/componentes/CabecalhoDaTela.tsx` (novo) e `src/componentes/BotaoVoltar.tsx` (novo — a setinha;
  saiu de dentro do `Layout`). `Dica` ganhou `compacta` (32 px desenhado, 44 de toque).
- `Layout.tsx`: a linha do Voltar saiu da casca; barra 1 `w-52` (trilho `w-16`), barra 2 `w-56 lg:w-46`;
  letra 13 px (`LETRA_MENU`); itens 36 px só no mouse (`ALTURA_ITEM`); topo = logo + recolher;
  rodapé = Modo tablet · usuário · sino (`compacto`, `painelLado="esquerda-baixo"`) · `MenuDoUsuario`.
- `src/componentes/MenuDoUsuario.tsx` (novo): o mini menu (portal, fixed, Esc/toque fora/troca de tela).
- `src/busca/BotaoBuscaGeral.tsx`: `BuscaGeralNaCasca` (a janela + Ctrl+K, montada uma vez na casca) e
  a lupa do celular só abre; `preCarregarBusca.ts` à parte (regra do lint de recarga rápida).
- `src/perfil/SeletorTemaRapido.tsx`: o seletor em janela virou `TemasDoMenu` (lista de amostras).
- `SinoNotificacoes`: `compacto` e o painel `esquerda-baixo`.
- `QuadroSetor.tsx`: a linha única (nome · ? · Etapas do setor · filtro `mr-auto` · ordem); a tela do PIN
  de setor alheio também ganhou o cabeçalho. `QuadroKanban.tsx`: a dica da mãozinha saiu (o quadro
  ganhou 16 px — desconto de 52 → 36); o início é só o `Play` verde ao lado do número (no tablet,
  `tamanho="galpao"`, o texto continua). Testes do quadro: +2 casos (tablet com texto, dica fora).
- `guardas.tsx`: "Conta sem acesso" `text-2xl` → `text-xl` (fora da casca, sem voltar).

### As três frentes em paralelo (subagentes, sem commit, arquivos separados)
- **Início/Configurações/Admin:** Meu painel, afazeres (meus e do time), Meu perfil (a foto grande desceu
  para o bloco Foto), Avisos, Chat (altura da conversa: desconto 12rem → 9rem), Sugestão de melhoria,
  Equipe, Setores e etapas, Avisos (config.), Controle de tempo, Estoque (config.), Móveis/insumos/peças,
  API, Caminhões, Utilitários, Automações (lista — o editor não foi tocado), Auditoria, Em construção;
  Trocar senha ganhou a setinha só na troca voluntária.
- **Fábrica/Rotas/Pedidos:** PCP, Expedição, Estoque (o "onde estou" de cada aba em negrito no início do ?),
  Danificados, Entregas, Programação, Todos os pedidos/Cancelados (o total segue visível ao lado do título),
  Entregas do dia do entregador (o andamento "N de M entregues" segue visível — é estado, não explicação).
- **Painéis/Comercial:** Meu desempenho (cadeado ao lado do título; Período subiu para a linha do título),
  Tempos por pessoa, Tempos de produção, Visão do dia (data e "atualizado às" seguem visíveis), Pessoas,
  Qualidade, Motivos (o aviso de setor escolhido segue visível); Comercial: Painel de recompra, Listas,
  Dashboard analítico e Detalhe da lista no cabeçalho padrão (os "voltar" próprios saíram — seriam duas
  setas; o lápis de renomear agora sempre visível).
- Títulos de seção `h2` `text-lg` → `text-base` em todos os arquivos tocados (modais e h3 intocados).
- Testes que precisaram do roteador por causa da setinha: Tempos por pessoa, Móveis/insumos/peças.

### Conferência
- `tsc -b` limpo; `eslint src` limpo; `vitest run --dir src` 65 arquivos / 423 testes ✅
  (o `--dir src` é preciso: sem ele o vitest pega a cópia velha da worktree da SESSAO-46 e acusa falhas
  que não são desta frente).
- Auditoria das rotas: toda tela da casca tem `CabecalhoDaTela` (as do comercial via os componentes
  `AnalyticsDashboard` e `ListasDisparoDetalhe`); `h1` soltos só fora da casca (entrar, convite, recuperar
  senha, conta sem acesso), no tablet e na TV — de propósito.

### 2ª volta — o dono olhando (06/11)
- *"O modal deve seguir o tema da aba lateral"* → o mini menu passou a usar `menu-superficie` + grafite
  (as mesmas cores, retintadas por tema, da barra). *"Os temas devem ficar ocultos dentro do ícone de
  tema"* → "Tema" virou um item que abre/fecha a lista (uma coluna; antes, duas colunas cortavam
  "Dour…"/"Esmerald…").
- Medido no navegador: a 184 px a barra 2 quebrava "Controle de produção" (137 px de texto) e "Limpeza e
  embalagem" (159 com o recuo) → **196 px** (`lg:w-49`). A matrícula "MDM-084-001" cortava → avatar 28 px,
  sino e `⋯` 32 px (alvo de 44 mantido), `tracking-tight` → cabe (82/82 px).
- Armadilha: o navegador mostrou a lista de temas com as cores velhas mesmo com o arquivo certo — a recarga
  a quente não trocou o módulo; recarregar a página resolveu (primo do E-32).

### 3ª volta (06/11)
- *"Coloque o nome do setor, o botão de voltar e o ícone informativo para o header principal"* (a barra
  escura do topo da tela estreita) → `VagaDoTitulo` (contexto com o elemento da vaga, guardado pela casca
  por `ref={setVagaTitulo}`) + portal no `CabecalhoDaTela` quando `useTelaPequena()`; `Dica tom="menu"`.
- *"Não devem existir dois ícones de notificações e lupa"* → na tela estreita o rodapé da gaveta não tem
  sino e o mini menu não tem "Buscar card" (ficam na barra de cima); no computador seguem no rodapé.
- Conferido no navegador (tela estreita e 1440 px): FITAMENTO, PCP, Estoque, Meu painel, Painel de
  recompra — título na barra, 1 sino na página, 1 voltar; o ? abre logo abaixo da barra.
- `eslint src` limpo, `tsc -b` limpo, `vitest --dir src` 65/423 ✅.

### 4ª volta (06/11) — a barra escura é o padrão
- O dono pediu "diminua mais o header de cima e bem mais o espaçamento superior do estoque; em outras
  telas você simplesmente exclui o header de cima, deixe isso como padrão". **Entendi ao contrário**
  (tirar a barra) e anunciei; o dono corrigiu na hora: *"A BARRA ESCURA DE CIMA FICA, é o contrário"* —
  nada do plano errado chegou a ser escrito (E-232). O certo: a barra escura existe em toda tela, também
  no computador (onde antes não havia barra — era isso o "em outras telas você exclui").
- Barra: dentro da coluna do conteúdo (sticky, ao lado da barra lateral no computador), 44 px; ☰ só
  abaixo do `lg`; logo só no celular sem título. Lupa e sino só nela (o rodapé da lateral perdeu o sino e
  o mini menu perdeu o "Buscar card" — `preCarregarBusca` voltou para dentro do `BotaoBuscaGeral`).
  Editor das automações: barra só no celular, altura `100dvh-2.75rem`.
- Estoque: busca + Cadastrar + abas numa linha (página), "Mostrar" embaixo; os produtos começam ~120 px
  mais acima no tablet. Busca conferida ("Balcão" acha os balcões; "balcao" sem acento não acha — já era
  assim, regra do servidor, não mexi).
- `eslint src`, `tsc -b`, `vitest --dir src` 65/423 ✅; conferido no navegador a 1440 px e no tablet.

### 5ª volta (06/11)
- *"O botão de parada avulsa, coloque-o pra a parte superior e tire-o da parte de baixo do mapa e remova
  essa descrição também, coloque-a dentro de um ícone informativo ao lado do botão"* → `AbaProgramar`:
  o botão + `Dica` na linha do "Mapa" (topo da coluna do mapa); a caixa de baixo do mapa saiu e o botão
  também saiu do cabeçalho da "Rota programada" (um lugar só). A legenda do mapa, que espremia em 4 linhas
  ao lado do botão, desceu para uma linha `text-xs`. "Sem programação": parágrafo → `i`.
- *"Em todos os pedidos, coloque o selecionar pedidos e o buscar em uma única linha e diminua o tamanho
  dessa parte superior"* → busca (rótulo oculto, `type="search"`), "Marcar os N" e "Selecionar pedidos"
  no `CabecalhoDaTela` (a linha das ações); a linha própria da busca saiu; `gap-4` → `gap-3`.
- Achado na conferência: o total "(5.724)" ao lado do título sumia na barra escura (cor "suave" sobre o
  grafite) → `APOIO_NA_BARRA` remapeia `--dm-texto-suave/fraco` para `grafite-300` no `h1` e no selo
  (`@theme inline`: as utilidades leem a variável direto, então redefinir a variável no elemento basta).
  Conferido: rgb(200,199,202) sobre rgb(90,88,92).
- `eslint src`, `tsc -b`, `vitest --dir src` 65/423 ✅; conferido no navegador (1440 px): Todos os
  pedidos e Programação, o balão do `i` abre logo abaixo da linha do mapa.
