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

### 6ª volta (06/11) — 14 pedidos de uma vez
Feita em 3 frentes paralelas (subagentes, arquivos separados, sem commit) + a minha:
- **Programação/mapa** (frente): painel da rota `compacto`; coluna do mapa sticky abaixo da barra escura e
  com altura máxima (estava mais alta que a tela — o fim era inalcançável e a barra de baixo cobria);
  mapa expandido = camada de tela inteira com "Recolher o mapa" e "Ver pedidos" (painel curto: nº, endereço,
  data de entrega — `src/rotas/pedidosParaVer.ts` + teste); vale também em "Já programadas".
- **Setores e etapas** (frente): configurações do setor num bloco só (limite · delegação · PIN lado a lado,
  campos do tamanho do conteúdo, salvar ao lado), "Estado da peça" numa linha, títulos de coluna curtos,
  pílulas repetidas fora (seguem para quem só vê), 6 explicações no `i`. Título da tela "Estrutura" →
  "Setores e etapas" (o nome do menu).
- **Telas soltas** (frente): Equipe — matrícula numa linha, setores em pílulas (até 3 + "+N"), título
  "Gestão da equipe"; Configurações → Avisos na largura toda, grupos em cartões lado a lado; Expedição e
  Entregas com a busca na linha das abas.
- **Eu:** login novo; "Sistema Domoby"; títulos em Inter; rolagem fina; traço leve sob as ações;
  bolhas por cima do menu + transparência no mini menu; botão Modo TV ao vivo + o arquivo do banco
  `20261106020000_plt_modo_tv_ao_vivo.sql` (recria `plt_fn_usuario_modo_tv` da versão viva com o sinal
  `perfil` por `fn_chat_sinal`) — **NÃO aplicado** (falta o OK do dono).
- Ensaio do banco (`npm run test:banco`): 2 verificações falham — o Dashboard comercial em 8 períodos e o
  fluxo do n8n de ponta a ponta. **Rodado de novo SEM o arquivo novo: as mesmas 2 falham** — já falhavam
  antes, não são deste ajuste (dívida a olhar à parte).
- Login conferido sem deslogar o dono: aberto em `http://127.0.0.1:5173/entrar` (outra origem = outro
  armazenamento = sem sessão) numa aba própria, fechada depois.
- `eslint src`, `tsc -b`, `vitest --dir src` 66/425 ✅; conferido no navegador: Expedição, Programação (pedido
  marcado, painel enxuto, tela cheia, Ver pedidos, Esc), Setores e etapas, Equipe, Avisos, transparência
  (40% → de volta a 100%), login (computador e celular).

### 7ª volta (06/11) — login em tela inteira
- O dono viu o cartão pequeno do login: *"volta isso a ser uma tela grande… mas eu gostei desse padrão, deixe
  ele, porém em uma tela grande mesmo"* → a tela inteira dividida ao meio (grafite da marca com a logo
  grande | metade clara com o formulário centralizado, `max-w-md`); no celular, a faixa da marca em cima.
  Mantidos: o "i" com as explicações, "Esqueci minha senha · Entrar com PIN" numa linha, o tablet depois do
  traço leve. Conferido por 127.0.0.1 (1440x900 e celular); testes do login 8/8.

### 8ª volta (06/11) — o card do caminhão em "Já programadas" espremido de novo
- O dono: *"o card voltou a ficar com texto quebrado novamente"* (print: "Hyundai HR", "5 paradas · 7 peças ·
  29,5 km…" e "Sem equipe definida" numa tira de uma palavra por linha). Causa: o cabeçalho é `flex-wrap`,
  mas o bloco do nome era `min-w-0 flex-1` (base 0) — encolhia até sumir em vez de os botões descerem; com a
  rota ajustada à mão, "Voltar à sugestão" + "no mapa" + "Equipe" tomavam a linha toda.
- Correção: o bloco do nome com base de 18rem (`basis-72`) — sem espaço, os botões descem; e no caminhão
  escolhido TODOS os botões numa fileira só embaixo (Salvar ordem · Voltar à sugestão · Google Maps ·
  Adicionar parada avulsa · Equipe, em `sm`), o cabeçalho só com nome, números e "no mapa". Conferido a
  1440x900 e no tablet; testes de rotas 135/135.
- Regra (já era a da casa, E-30/padrão de container): bloco de texto ao lado de botões NUNCA com base 0 —
  dar largura mínima ao texto e deixar os botões quebrarem.

### 9ª–11ª voltas (06/11)
- **Transparência:** *"de 0 a 100%, com um modal próprio da plataforma e sem pré-definição de 10 em 10"* →
  vista própria no mini menu (o painel troca de conteúdo: ‹ voltar · número grande · − faixa + · legenda),
  faixa estilizada (`.faixa-domoby`), passo 1. *"Em 0% eles somem de fato, além da opacidade, a
  funcionalidade também"* → `data-flutuantes-ocultos` no `html` em 0% exato → `display:none !important`.
  Armadilha: sem o `!important` a regra (camada base) perdia para o `inline-flex` (camada das utilidades) —
  conferido no navegador: em 0% `display:none`, em 1% `display:flex` e opacidade 0,01. Corrigido também:
  sem nada guardado, a opacidade é 1 (antes `Number(null)` daria 0).
- **Linha das abas presa no topo** (*"trave esse header que possui abas, ele não deve rolar junto"*) →
  sticky do `md` para cima + `--dm-topo-fixo` medido; as colunas do mapa (Programar e Já programadas)
  passaram a grudar abaixo dela. Conferido: rolando 900 px, a linha fica a 44 px do topo e o mapa a 125 px.
- **Rodapé com a marca** saiu (as duas casas: a logada e a sem sessão).
- **Card do caminhão** (Já programadas) espremido de novo → ver 8ª volta.
- **Modo TV:** seleção da casa no lugar da lista nativa; relógio `HH:MM:SS` ao vivo (conferido 04:16:58 →
  04:17:00); trocar o dia — o arquivo do banco pendente virou `20261106020000_plt_modo_tv_ao_vivo_e_dia.sql`
  (ainda **não aplicado**): além do aviso ao vivo, recria `plt_fn_modo_tv(p_setor_id, p_dia)` (sem dia = hoje;
  futuro e >400 dias recusados; devolve `pode_trocar_dia` e `e_hoje`) e **derruba a versão de 1 parâmetro**
  (com as duas, a API não saberia qual chamar). Ensaio do banco: entrou na lista do bloco que reaplica as
  recentes "como em produção" (senão a de 1 parâmetro voltava e dava "is not unique"); conferência nova
  ("a TV escolhe o dia") ✔; só as 2 falhas antigas seguem (Dashboard comercial e fluxo n8n — já falhavam
  sem este ajuste). Armadilha: `create function` não roda duas vezes — tem de ser `create or replace`.
- O site pode ser publicado antes do banco: sem a porta nova, a TV segue mostrando hoje (as setas não
  aparecem) e o botão Modo TV aparece ao recarregar a página.

### 12ª volta (06/11) — varredura de todas as telas, correções e publicação
- O dono: *"ao finalizar tudo, abra todas as telas, sem exceção, e faça diversos testes… se ficou [quebrado],
  resolva e publique; se não, pode publicar"*. Varredura por um agente separado (1440 e 768, ~50 telas e abas,
  sem gravar nada): nenhum erro no console, nenhuma rolagem lateral; achados no handoff
  ([[handoff_2026_11_06_ajuste_cabecalhos_compactos]]).
- Corrigido (3 frentes): faixa dos botões flutuantes reservada (`main pb-24`; barras fixas de baixo `bottom-24`;
  quadros com desconto 100/116); abas e buscas na linha presa (PCP, Controle de tempo, Utilitários,
  Auditoria, Danificados, Peça por peça, Insumos); Trocar senha na barra; títulos = menu; textos (plurais,
  "de" minúsculo nas datas, decimais com vírgula, `prioridade_definida`/`estoque_reserva_avaliada` com nome
  de gente, rótulos da Auditoria, pedaços de tempo que não quebram, filtro "Filtrar: pedido ou móvel").
- NÃO corrigido (banco, de antes, precisa de OK): pedido cancelado em "A entregar" (`plt_fn_rotas` sem
  filtro de cancelado — conferido: só o 13686), Visão do dia × quadros, stand-by 7×6, aviso do calendário.
- Repasse final eu mesmo, tela a tela (título, alerta, rolagem lateral, NaN/undefined): tudo certo; console
  sem erro de verdade (só as marcas "QA-MARK" que a varredura deixou). `eslint`, `tsc`, `vitest` 66/425 ✅.

### Depois da publicação (06/11) — o banco do Modo TV aplicado
- O dono: *"Pode aplicar"*. Antes, conferido no banco vivo: o md5 do corpo de `plt_fn_modo_tv(bigint)` e de
  `plt_fn_usuario_modo_tv` = os da `20261105040000` (a base desta) — ninguém tinha mexido depois.
- `npm --prefix "<repo>" run banco:aplicar -- --confirmar --so 20261106020000_plt_modo_tv_ao_vivo_e_dia.sql`
  → ✔; integração do Tiny idêntica (`e2109f3a…`), linhas idênticas. (Outra sessão — a dos dados que não
  batem — trabalha na mesma pasta; o `--so` garantiu que só esta foi aplicada.)
- Conferido: só `plt_fn_modo_tv(bigint, date)` e `plt_fn_usuario_modo_tv(uuid, boolean, boolean)`, execute só
  `authenticated`; como admin (claims no `request.jwt.claims` + `set local role authenticated`): 05/11 → 24
  montados, `e_hoje` false; sem dia e a chamada antiga de 1 argumento → hoje; amanhã → "A TV não mostra dias
  que ainda não chegaram."; `explain analyze` 35 ms. Na tela local (banco real): ‹ → "Quinta-feira, 5 de
  novembro", 24 montados no dia, "Voltar para hoje" volta, › desabilitada em hoje, console sem erro.
- Não conferido de ponta a ponta: o botão Modo TV aparecendo ao vivo para outra pessoa (precisaria ligar a
  permissão de alguém de verdade). Mesmo caminho do chat/sino.
- `supabase-fabrica-schema.sql` não muda (é o retrato da integração; nada dela foi tocado);
  [[SUPA - Esquema do Banco]] com a entrada "Ajuste de 06/11/2026".
