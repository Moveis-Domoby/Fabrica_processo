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
