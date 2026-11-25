---
titulo: "Modelo de sistema — Logistica ROTAS e Pedidos"
tipo: design
assunto: logistica
atualizado: 2026-11-18
tags: [plataforma, design-system, modelo-de-sistema, design/logistica]
---

# 🧩 Design - Logistica ROTAS e Pedidos

> Parte de [[PLT - Modelo de Sistema]], movida em 18/11/2026 sem reescrever (a numeração das seções é a do documento original). Padrão novo deste assunto entra **aqui**.

### Logística, ROTAS e caminhões (SESSAO-15 / D-38 / D-39 / D-45)

- **Telas de lista da logística** (`Estoque`, `Pedidos em aguardo`, `Danificados`, `ROTAS → Entregas`):
  o mesmo esqueleto — título com ícone, texto curto explicando a regra, `Campo` de busca,
  lista de cartões (`rounded-dm-lg border bg-superficie p-4`) paginada no SERVIDOR com
  `Paginacao` solta (a `Tabela` pagina no cliente — não serve para porta paginada). Gesto
  irreversível em **dois toques inline** ("Lançar para ROTAS" → "Sim, lançar"; "Arquivar" →
  "Sim, arquivar"), nunca modal. Gate da logística vive no banco; o hook
  `useAcessoLogistica` só evita tela vazia.
- **Edição inline do ID de produção** (Estoque): o valor vira `Campo` no lugar, com Gravar/
  Cancelar (ESC cancela, Enter grava) — sem modal para um campo só.
- **Relato da [[D-009 - Qualidade em 3 estados em TODA transicao com dupla atestacao|D-09]] no Danificados**: bloco `bg-superficie-sutil` com "X entregou como
  {badge} por {pessoa} · data", a observação entre aspas e, se houve, "Y recebeu como
  {badge}". Resolver reusa o padrão dos **3 botões-rádio empilhados** com `BadgeEstado` +
  `DESCRICAO_ESTADO` ([[Memoria - Modelos Formulas e Possibilidades#M-12|M-12]]), só quando o destino é outro setor.
- **Botão "Concluir"** (`CartaoUnidade` e `CartaoTablet`): atalho da peça pronta — abre o
  `ModalMoverCard` em `modo="concluir"` (destino fixo ESTOQUE, só a marcação do estado).
  **↪️ SESSAO-24 ([[D-059 - Quadros de producao so por arrasto o unico botao e Concluir|D-59]]):** virou "Concluir produção", só na LIMPEZA E EMBALAGEM, e o destino
  é do banco (pedido vivo → Pedidos em aguardo; sem pedido/cancelado → ESTOQUE).
  O rodapé do card de unidade ficou em **duas linhas**: gestos de tempo (Iniciar/Finalizar/
  Assumir) em cima; estado, histórico, Concluir e Mover embaixo — nada estoura a borda.
- **Mapa de programação** (`MapaProgramacao`, Leaflet + tiles OSM com atribuição): marcadores
  são `CircleMarker` desenhados (sem asset de imagem) — amarelo-marca com o **número da
  parada** dentro (tooltip permanente `.plt-parada`) para os selecionados, âmbar para as
  sugestões; a rota sugerida é uma `Polyline` grafite ligando as paradas na ordem do vizinho
  mais perto (linha reta — nunca chamar de rota "calculada" — ↩️ caiu na SESSAO-28, ver abaixo). Botão **Expandir** vira o
  contêiner em `fixed inset-0` (ESC recolhe) e o mapa recebe `invalidateSize()`. A lógica de
  distância/ordem/sugestão é pura em `src/rotas/proximidade.ts`, testada no Vitest.
  **↪️ SESSAO-28 ([[D-108 - A rota da Programacao e calculada PELAS RUAS parte da fabrica|D-108]]…[[D-110 - O mapa da Programacao mostra tambem a rota JA PROGRAMADA|D-110]]) — a linha AGORA É calculada:** a rota é pelas ruas (serviço
  gratuito de rotas, chamado pela Edge Function `calcular-rota`), da **fábrica à fábrica** — a
  fábrica é um `CircleMarker` grafite com "F" branco (`.plt-fabrica`), as paradas numeradas como
  antes (o número é o da lista). Linha pelas ruas = `Polyline` grafite contínua (peso 4); sem
  ela (calculando, serviço fora, sem caminho) = linha reta **tracejada** (`dashArray 6 8`) com o
  aviso na tela. As duas `Polyline` levam `key` diferente — sem ela o React reaproveita a camada
  e o Leaflet mescla o estilo (a rota herdava o tracejado). O mapa só reenquadra quando o
  CONJUNTO de pontos muda, e ao expandir/recolher (`invalidateSize` + reenquadrar). O resumo do
  canto (`left-14`) nunca cobre o + / − do zoom. A tela inteira vem por `React.lazy` (o Leaflet
  fora do pacote principal).
- **Painel da rota** (`PainelRota`): "F · Saída da fábrica" → paradas numeradas com o trecho que
  chega a cada uma ("da fábrica: 12,9 km · 16 min" / "da parada anterior: …") → "F · Volta à
  fábrica"; total no topo ("31,9 km · 42 min dirigindo · ida e volta da fábrica"); aviso fixo
  em `superficie-sutil` com ícone: *"Sugestão inicial: sem trânsito ao vivo nem interdições do
  dia. O tempo é só dirigindo, sem as paradas das entregas."*; falha em `atencao-fundo` com
  ícone. Parada sem ponto fica na lista (bolinha cinza, "sem ponto no mapa — fora da conta da
  rota") e pode ser movida. Subir/descer = `Botao` secundário só com ícone (44px) e
  `aria-label` com o número do pedido; **"Voltar à sugestão"** (fantasma) e **"Salvar ordem"**
  (primária) só aparecem quando há o que fazer.
- **Escolha do que o mapa mostra** (D-110): grupo `role="group"` de `Botao` com `aria-pressed`
  — "Montando agora (N)" + um por caminhão do dia ("Baú … · 3 parada(s)", ícone de caminhão);
  o ativo é primária. Nome comprido quebra linha DENTRO do botão: `style={{ height: 'auto' }}` +
  `min-h-toque-md` (o juntador de classes não reconhece a altura da casa `h-toque-*` como
  conflito de `h-auto` — classe sozinha não vence).
  **↪️ Ajustes de 03/10 ([[D-111 - A Programacao em duas abas Programar e Ja programadas itens|D-111]]):** o mapa recebe `rotas[]` — cada rota com a sua cor (a do
  caminhão, `corDoCaminhao`, ou `COR_MONTAGEM` azul na montagem), a linha cortada em TRECHOS
  (`separarTrechos`) com contorno branco (peso 9) sob a cor (peso 5); tocar num trecho acende só
  ele (os outros a 18%) e o resumo do canto vira "Trecho 1ª parada → 2ª parada: 6,2 km · 7 min";
  rota de outro caminhão do mesmo dia = `esmaecida` (linha a 28%, paradas pequenas sem número);
  enquanto a rota nova é calculada, a de antes fica a 45% (`recalculando`). O mapa é `memo` e
  `isolate` (as camadas do Leaflet não passam por cima da barra fixa nem das bolhas).
- **Abas da Programação** (D-111): `<Abas>` com "Programar" e "Já programadas" (`?aba=`; o
  caminhão escolhido em `?dia=&caminhao=`). Duas colunas só pelo CONTAINER (`@container` +
  `@3xl:`), nunca pela janela ([[Memoria - Front Telas e React 1#E-30|E-30]]/E-85); numa coluna só: "Na rota" → mapa → lista (Programar)
  e mapa primeiro (Já programadas). A barra de Programar fica fixa no rodapé da aba inteira.
- **Cartão do pedido** (`CartaoPedido`, memo): número, peças, previsão, cliente, endereço e a lista
  dos MÓVEIS com a quantidade (ícone de caixa, `1×` em negrito); o frete nunca aparece.
- **Ordem por arrasto** (`ListaArrastavel`, dnd-kit sortable — ↩️ os botões de subir/descer da
  [[D-109 - A ordem das paradas a sugestao e a do mais perto mas qualquer|D-109]]): alça de 44 px à esquerda, mesmos sensores do kanban (mouse 8 px, toque 200 ms, teclado).
  No "Na rota" o cartão é `div` (tocar nele não tira o pedido — só a caixinha).
- **Grupo de caminhão** (Já programadas): faixa de 8 px na cor do caminhão, foto (ou o ícone no
  fundo da cor), nome · placa, "N paradas · P peças · km · tempo"; o escolhido com `ring`; "Ver no
  mapa" nos outros; "Voltar à sugestão"/"Salvar ordem" no cabeçalho do escolhido.
- **Seleção da programação**: `label` inteira clicável com `checkbox` (`accent-marca-500`),
  borda `acao-ativa` quando marcado e `atencao-borda` quando é sugestão; barra fixa no rodapé
  da lista (`sticky bottom-2`) com a contagem, a distância da rota e o botão Programar.
- **Caminhões**: grade de cartões com foto (`h-40 object-cover`, ou o ícone de caminhão em
  `superficie-sutil`); exclusão em modal `perigo`; quando o banco recusa (em uso), um segundo
  modal explica e oferece **Arquivar** como primária — o "não" do sistema sempre vem com a
  saída certa.

### Área Pedidos (14/10 noite — D-134) — `src/pedidos/`

- **Lista leve, ficha por clique:** cada pedido é uma linha (`rounded-dm-lg border bg-superficie`) com o que se lê de relance — número, data, a situação do Tiny (bolinha + texto), a da plataforma (pílula com borda), cliente, "Vendido por …", até 3 marcadores, o valor à direita e o andamento ("Entregue 14/10/2026 às 15:32 por Kaio", "3/14 peças prontas", "Cancelado em …"). Tocar abre a **ficha** logo abaixo (borda `borda-forte` + sombra suave); a seta de 44 px também abre/fecha. Cursor ao rolar (`MaisAoRolar`); `?pedido=N` abre direto.
- **Revelação gradual:** a ficha mostra primeiro o **resumo** em 4 blocos (`bg-superficie-sutil/60`: Cliente · Venda · Valor · Entrega) e uma fileira de **botões-pílula** (`rounded-full border`, ícone + texto + seta, `aria-expanded`; aberto = borda `acao-ativa` e fundo `acao/10`) — Itens e pagamento · Produção · Entrega e comprovante · Dados do Tiny · Histórico. Cada botão abre o seu painel (`rounded-dm-lg border border-borda/70`), que entra suave (`starting:opacity-0 starting:-translate-y-1`, sem efeito para quem pede menos movimento); os pesados só buscam no clique.
- **Produção:** "N peças · X prontas · Yh de trabalho", as pessoas em pílulas com o tempo de cada uma; cada peça numa linha (seta que gira) que abre a sua história — setor · etapa · pessoa · início → fim · tempo (pausa).
- **Dados do Tiny:** o registro inteiro em pares "campo: valor" (`dl` em 2 colunas); grupos e listas viram blocos com uma linha-guia à esquerda; os nomes dos campos só ficam legíveis ("nome_vendedor" → "Nome vendedor"), sem tradução inventada; o vazio não aparece; o pedido vem aberto, cliente/notas/contas abrem no clique.
- **Comprovante:** em "Entrega e comprovante", cada arquivo com quem e quando; "Ver" pede o link curto no clique — imagem aparece ali mesmo (`max-h-96`), PDF abre noutra aba.
- **Texto do Tiny (15/10):** a pílula da plataforma só quando difere da situação do Tiny; valor que o Tiny manda em código vira palavra (`valorDoTiny`: "credito" → "Crédito"; o escrito à mão fica); nome de campo com acento e sigla (`rotuloDoCampo`); dinheiro só em campo de valor (código nunca); cancelado depois de entregue: "Foi entregue, depois cancelado" (sem o verde) — a situação do Tiny é rótulo ("Cancelado"), compara-se sem caixa. No celular, o resumo da ficha fica em 2 colunas.

### Calendário, Google Maps/Waze, Mover e o painel de motivos (SESSAO-39 / D-173…D-176)

- **Calendário** (`src/rotas/AbaCalendario.tsx`, contas em `src/rotas/calendario.ts`): a terceira aba de Rotas → Programação, **reto como o ClickUp** (↩️ 22/10, 2ª volta — o dono achou a 1ª "muito redonda e confusa": nada de círculo, pílula nem grupo dentro do dia). Barra do topo — `Hoje` · ‹ › · o período por extenso ("18 a 24 de outubro de 2026") · Semana | Mês num **controle reto** (`rounded-sm`, divisória entre as duas, a escolhida em `bg-acao`). **A legenda é filtro:** quadradinho de cor (`size-3`, sem arredondar) + nome + total, `aria-pressed`; desligada = riscada e apagada (`opacity-40`). Semana: uma grade com contorno fino e **sete colunas iguais** por *container* (`@4xl:grid-cols-7`, linhas `border-borda` entre os dias); cabeçalho do dia **numa linha só** (`whitespace-nowrap`): dia curto (SEG) + "19 out" + a contagem à direita, fundo `superficie-sutil`; **o hoje = o cabeçalho em `bg-acao`** e a coluna com `bg-acao/5` (o "· hoje" escrito só aparece estreito; o leitor de tela ouve sempre). **A barra:** uma linha — **nº do pedido em negrito · bairro** (o bairro trunca; o texto inteiro no `title`) —, tom claro da situação + faixa forte de 3 px à esquerda, `rounded-[3px]`; altura 28 px na grade larga, 36 px empilhada (toque). Cores da situação: sem rota = `etiqueta-cinza`, na rota = `info`, entregue = `perfeito`, não entregue = `danificado`, stand-by = `etiqueta-rosa`. "+ N pedidos" em texto (busca o resto do dia no clique). Mês: grade de 6 semanas com linhas finas, o número do dia em texto (hoje: na cor de ação + "· hoje" e uma risca de 2 px no topo da célula), 3 barras compactas (24 px) e "+ N pedidos" (abre a semana); estreito, quadradinhos de cor + o total. Estreito (celular), os dias viram uma lista. **Tocar no pedido abre o detalhe** num `Modal tamanho="galpao"` (no celular sobe do rodapé): título "Pedido 13704" + "bairro · situação"; um quadro `dl` no tom da situação com a faixa à esquerda (situação com o quadradinho, dia da rota ou a previsão, previsão do vendedor, caminhão com o quadradinho na cor dele + rota + parada, recado, motivo) e, embaixo, a **`FichaDoPedido`** da área Pedidos carregada por `lazy` (o código só baixa no primeiro toque); rodapé "Abrir a janela do pedido" (secundário) e "Ver a rota" (primário, só no programado). **Colunas como planilha** (`src/rotas/larguraColunas.ts` — `useLargurasDasColunas`): a grade usa `grid-cols-(--colunas)` com a variável vinda do gancho (iguais = `repeat(7, minmax(0,1fr))`; mexidas = px por coluna e a grade `w-max` dentro de `overflow-x-auto`); a **divisória** (`role="separator"`, 12 px sobre a borda direita do cabeçalho do dia, `cursor-col-resize`, `touch-none`, uma linha `info-forte` de 2 px que acende no hover/foco/arrasto) arrasta com captura do ponteiro (mínimo 80, máximo 640 px; o cursor da página vira `col-resize` durante o arrasto); **dois cliques = a coluna em `max-content` por um instante (`flushSync`), mede e fixa** — o ajuste exato ao maior texto sem conta de fonte; setas ±16 px (Shift 3×) e Enter pelo teclado. Apertar sem arrastar não muda nada (o 1º clique de um "dois cliques" não pode mexer na tela). À direita da legenda: a dica "Arraste a divisória…" ou o botão **"Colunas iguais"** (ícone `Columns3`), na mesma largura em que as colunas viram grade (a raiz do calendário é `@container`). Larguras no `localStorage` (`domoby.calendario.colunas.semana|mes`), lidas com `try/catch`.
- **Abrir a rota fora** (`src/rotas/BotoesNavegacao.tsx`, links em `src/rotas/navegacao.ts`): `BotaoRotaGoogleMaps` (ícone `Route`; uma parte = "Abrir a rota no Google Maps"; várias = "Google Maps · Paradas 1 a 6") e `BotoesParada` (Google Maps e Waze, ícone `Navigation`, na grade dos botões do card da entrega). Link = `<a target="_blank">` envolvendo o `Botao` (o padrão do WhatsApp). Em "Já programadas" o botão fica **numa linha própria** abaixo do cabeçalho do caminhão (no cabeçalho ele espremia o nome).
- **Mover** (`src/kanban/componentes/ModalMoverParaFila.tsx`): o desenho da casa para escolha — setores em botões grandes em grade (o próprio setor diz "Volta para a fila daqui" ou fica apagado "O card já está na fila daqui"), o bloco do estado da peça (os 3 botões-rádio com `BadgeEstado`) só quando o setor de origem pede, os motivos em botões + "Outro", o detalhe, e o primário que diz o destino ("Mover para MONTAGEM"). Aviso âmbar quando há alguém executando. No tablet, `tamanho="galpao"` e o PIN antes (como o Pausar).
- **Painel de motivos** (`src/paginas/dashboards/Motivos.tsx`): 4 `Heroi` no topo (o tempo no jeito curto dos mockups — "6h40"); cada área num cartão `Secao` (ícone + pergunta em língua de fábrica + uma linha do que mede); `Ranking` = lista numerada com o rótulo direto na ponta ("6h 40min · 14 vezes"), marca discreta em pílula (`especial · não conta para a pessoa`, `2 ainda segurados`) e a barra fina de **um matiz só** (`--dm-serie-fila`), cada linha é botão (abre as ocorrências num `Modal`, 20 por vez, "Ver mais"); `RankingSimples` (por setor/pessoa/caminhão) sem clique. Qualidade por setor em linhas com ícone + texto dos estados ([[Memoria - Modelos Formulas e Possibilidades#M-12|M-12]]).

### Tablet que não cai, quadro com rolagem na coluna, senha, entrega parcial, parada avulsa, endereço e data (SESSAO-41 / D-189…D-196)

- **Quadro com rolagem na coluna** (`useAlturaAteOFim` em `src/kanban/componentes/alturaDoQuadro.ts`): o quadro mede o próprio topo e vai até o pé da janela (menos 52 px no PC, 20 px no tablet; mínimo 320); a coluna é `min-h-0`, o painel `max-h-full`, o cabeçalho `shrink-0` e a lista `overflow-y-auto overscroll-contain`. Usa a MESMA referência da mãozinha (`propsDoQuadro.ref`). Quadro de colunas novo segue o mesmo esqueleto.
- **Pessoas no tablet** (`presencaDeAgora` em `src/tablet/presenca.ts`): o estado que o banco manda anda com o relógio de tela (carência de 15 min → ausente → some com 1 h) — a régua é a mesma do banco.
- **"Esqueci minha senha"** (`RecuperarSenha.tsx`, lógica em `trocaDeSenha.ts`): um campo de e-mail e UM botão por vez — "Trocar minha senha" (confere) → liberado: os dois campos da senha nova; não liberado: só "Solicitar troca"; a resposta do pedido é sempre a mesma mensagem (`role="status"`, fundo informativo). O segredo do aparelho vive no `localStorage` (try/catch).
- **Aviso urgente do administrador** (`AlertaTrocaSenha.tsx`): `Modal` que abre sozinho (o aviso do sino de tipo `senha_pedido` não lido) ou por `?senhas=1`; cada pedido num cartão `atencao` com a foto, o usuário e a hora, e os dois botões grandes "Liberar troca" / "Não liberar"; "Decidir depois" fecha até chegar outro. Lê o MESMO cache do sino.
- **Entrega parcial** (`ModalEntregaParcial.tsx`): as peças em caixas de marcar grandes (todas marcadas de início), o resumo "N entregue(s) · M volta(m)", os motivos como os botões-rádio da "Não entregue" (tocar de novo desmarca) e a observação; a confirmação de "ainda em produção" aparece DENTRO do modal (fundo `atencao`), sem outro modal. "em parte" vira uma pílula `atencao` na lista dos entregues.
- **Data de entrega na ficha** (`DataDeEntrega.tsx`): um quadradinho com a data, "mudada na plataforma (no Tiny: …)" quando vale, e o botão "Mudar a data de entrega" (só para quem tem a logística) que abre a data + "Salvar a data" / "Remover a data" / "Cancelar" no lugar — sem modal para um campo só.
- **Onde entregar**: o rótulo diz "Para onde — endereço de entrega do pedido" quando é o do Tiny; o do cadastro aparece embaixo, menor.
- **Parada avulsa**: ver o que a frente da tela registrou no diário da SESSAO-41 (o marcador próprio no mapa, o cartão da parada, o modo "Escolha o momento da parada" do entregador).

### Entrega parcial que mantém a produção e "Mover para o PCP" (SESSAO-51 / D-325…D-334)

- **A janela da entrega parcial em dois grupos** (`ModalEntregaParcial`, refeita; uma leitura ao abrir): `fieldset` "Saíram para a entrega" (`Truck`; as prontas, MARCADAS; a frase "o que ficar desmarcado voltou: espera a decisão da logística") e `fieldset` "Ainda na fábrica" (`Factory`; as peças em produção, DESMARCADAS, com "SETOR · ETAPA" em `text-xs text-texto-suave` embaixo do nome; "Marque só se foi entregue mesmo"; e a linha "+ N produto(s) ainda no PCP, sem liberar"). A conta numa linha neutra ("2 entregues · 3 ainda na fábrica") e a pergunta **"E o que ainda está na fábrica?"** com duas opções em cartão-rádio (`OpcaoFabrica`: borda `acao-ativa` + fundo `acao/10` na escolhida): "Deixar em produção" (vem marcada; o texto diz o que segue onde) e "Limpar da produção" (o que sai e "dá para voltar atrás em PCP → Entregas parciais"). Quem não pode limpar (entregador) vê só a primeira (rádio desligado, marcado) e a nota "Tirar da produção é com a logística — ela pode fazer isso depois." Sem nada na fábrica, a janela de antes.
- **A aba "Entregas parciais"** (`AbaEntregasParciais`, pedaço próprio): o mesmo cartão das abas "Cancelados"/"Pedidos ocultos" — "Pedido N" + pílula `atencao` com `PackageCheck` "Entregue em parte (N de M)", cliente, "Entrega parcial em … · decidido por … em …" (`text-xs`), a decisão que vale numa frase ("Seguem em produção: 2 peças · 1 produto no PCP" / "Retiradas da produção: 2 peças"), "Abrir o card" (`fantasma`) e **um botão só, o contrário da decisão** (`secundaria`, `RotateCcw`): "Revogar e remover da linha de produção" / "Revogar e voltar tudo para a produção". Filtro por número ou cliente; 20 por vez ao rolar (`MaisAoRolar`).
- **A janela do revogar** (`ModalRevogarParcial`, pedaço próprio; lê a prévia ao abrir): o pedido e a decisão de agora; a pergunta com a lista do que sai (`Factory` + nome (k/n) — SETOR · ETAPA; "alguém trabalha nela: o tempo fecha agora" em `danificado-texto`) ou do que volta (`ArrowRight` + "volta para SETOR · ETAPA"; a etapa que sumiu em `TriangleAlert` "A etapa X não existe mais — a peça volta para a primeira etapa ativa do setor"); o bloco neutro do que fica ("1 peça já está pronta e fica (PEDIDOS EM AGUARDO)…"); "Nada é apagado: dá para voltar atrás de novo aqui mesmo." Botões: primária com o texto do gesto + `secundaria` "Voltar".
- **Na ficha do pedido:** o quadro `info` (borda `info-borda`, fundo `info-fundo/40`) "Entregue em parte (N de M)" + a pílula "K ainda em produção" (pílula, não "· K": no celular a linha quebra), quando e quem, a decisão e o mesmo botão (ou "Não dá mais para revogar: o porquê"). No card do PCP: a pílula `info` "Entregue em parte (N de M)".
- **Botão de texto longo** (os do revogar): `className="h-auto! min-h-toque-md py-2 whitespace-normal"` — o `Botao` fixa a altura e a junção de classes não troca a altura da casa; com o `!` ele cresce quando o texto quebra no celular ([[Memoria - Front Telas e React 2#A-240|A-240]]).
- **"PCP" dentro do "Mover"** (↩️ ajuste do dono, 17/11 — um botão só): a janela "Mover para a fila de um setor" (`ModalMoverParaFila`), quando recebe `aoEscolherPcp` (admin, fora do tablet, peça viva em setor de produção — `mostraVoltarPcp`), ganha **"PCP" como a PRIMEIRA opção** da grade "Para a fila de" (o mesmo botão de escolha, com `PackageOpen` + "Volta como vaga do pedido ou vira reposição de estoque" em `text-xs`); escolher fecha esta janela e abre a do PCP. Na janela do card não há botão à parte.
- **A janela "Mover para o PCP"** (`ModalVoltarPcp`, pedaço próprio; lê a prévia ao abrir): a peça (nome k/n, pedido, SETOR · ETAPA); o aviso `atencao` "X está trabalhando nela — o tempo dele fecha agora."; **"O que acontece com ela?"** com duas escolhas em cartão-rádio (`Escolha`: ícone + título + o que acontece; a recusada fica apagada com o porquê do banco no lugar do texto; a única possível já vem marcada): "Voltar para o PCP" (`PackageOpen`) e "Virar reposição de estoque" (`Boxes`). Depois de escolher: "Motivo" em botões de alternar (`aria-pressed`; 2 colunas no tablet, 1 no celular) — "(opcional)" na reposição — e "Observação" (pelo menos um dos dois no "Voltar"). Primária com o nome do gesto.
- **O selo da peça que voltou** no card do pedido do PCP: pílula `atencao` com `Undo2` "1 voltou da produção: motivo — estava em SETOR · ETAPA" / "1 virou reposição de estoque — estava em …" (`textoSeloVolta`). No card da reposição que veio da produção: a linha `info-texto` com `Undo2` "Veio da produção — era do pedido N, estava em SETOR · ETAPA".
- **"Usar a mesma peça"** em "Liberar unidades": dentro da unidade, o cartão `atencao-borda` com a caixa MARCADA, `Undo2` e "Usar a mesma peça (estava em SETOR · ETAPA)" + "Ela voltou da produção — motivo. A mesma peça volta, com a história dela, para a coluna escolhida abaixo."; setor e etapa já escolhidos (quando ainda existem); desmarcada, a frase "nasce uma peça nova e a antiga continua guardada" e as sugestões de sempre.

**Sessões 53 e 56 (18 e 23/11):**
- **`SeloEntregueEmParte`** (`src/rotas/`, SESSAO-53 — [[D-346 - Depois que o resto e entregue o selo Entregue em parte some|D-346]]…): a pílula "Entregue em parte (N de M)" + "K ainda em produção" quando há, na Programação (Programar e Já programadas), na Expedição e nas Entregas do dia — o mesmo desenho do selo do PCP e da pílula da ficha. Some quando o resto é entregue.
- **O aviso âmbar do cartão com dois botões** (SESSAO-56): quando a busca de endereço não responde, o cartão do pedido mostra o aviso `atencao` com "Marcar no mapa" e "Tentar de novo" — no lugar do "procurando no mapa…" sem fim. Padrão reutilizável para serviço externo que falha.
- **A faixa de serviço fora** (`FaixaBuscaFora`, SESSAO-56): faixa no topo de Rotas dizendo que a busca de endereço está fora e desde quando; some sozinha quando a busca volta. Padrão reutilizável para qualquer dependência externa.
- **A atribuição "Powered by Geoapify"** nos mapas e ao lado da busca de endereço (exigência do serviço).

**SESSAO-57 (24/11):**
- **A pergunta no rodapé da janela** (`PerguntaNoRodape`, `src/rotas/AvisosDoPino.tsx`): antes de salvar, o rodapé troca os botões por um aviso âmbar com a pergunta e **Voltar** / **Salvar assim mesmo** ("Você não moveu o pino…", "O pino está a X km do CEP…"). Padrão reutilizável para conferência que não bloqueia.
- **O aviso de rua não achada** (`AvisoRuaNaoAchada`): aviso âmbar acima do mapa ("Não achei a rua no mapa — o pino está no bairro …"), com "Salvar assim mesmo" que só libera o botão; o Salvar fica travado até arrastar o pino.
- **"N pedidos com o pino a conferir"** em Já programadas: botão âmbar que filtra as rotas inteiras; o cartão marcado à mão no centro da cidade ganha o aviso com "Ajustar o pino".

