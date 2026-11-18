---
titulo: "Modelo de sistema — Kanban Execucao e Qualidade"
tipo: design
assunto: kanban
atualizado: 2026-11-18
tags: [plataforma, design-system, modelo-de-sistema, design/kanban]
---

# 🧩 Design - Kanban Execucao e Qualidade

> Parte de [[PLT - Modelo de Sistema]], movida em 18/11/2026 sem reescrever (a numeração das seções é a do documento original). Padrão novo deste assunto entra **aqui**.

### Componentes do kanban (SESSAO-04) — `src/kanban/componentes/`

Componentes de DOMÍNIO (não são primitivos de `ui/`, mas seguem as mesmas regras):

- **`<CartaoUnidade>`** — o card (k/n) que percorre os setores. Mostra pedido, produto, (k/n),
  tempo na etapa (`tabular-nums`, atualizado por minuto) e o botão **Mover** (alvo ≥ 44px).
  Estado de qualidade, quando existir, entra via `<BadgeEstado>` — nunca só cor.
- **`<QuadroKanban>`** — colunas por etapa, cada uma **paginada no servidor** (SESSAO-22:
  10 cards + "Ver mais"; o contador da coluna é o total real). A coluna **Chegada**
  (etapa nula) **acabou nos setores de produção** ([[D-048 - Execucao um por vez com pausa por lider tempo de PCP e|D-48]]): card que chega cai na etapa
  fila do setor, resolvida pelo banco — ela só existe no PCP/terminais, em setor de
  produção ainda sem fila cadastrada, ou transitoriamente (com aviso) se sobrou card
  sem etapa. Colunas rolam na horizontal com `snap` no celular (85vw por coluna) e
  largura fixa no desktop. **Dois gestos sempre:** drag-and-drop (`@dnd-kit/core`,
  desktop) E botão "Mover" (tablet) — nenhuma movimentação pode existir só no arrasto.
  **↪️ SESSAO-24 ([[D-059 - Quadros de producao so por arrasto o unico botao e Concluir|D-59]]): revogado nos quadros** — a equipe pediu SÓ arrasto; a alternativa
  acessível passou a ser o **teclado** (espaço + setas, `KeyboardSensor`) e o toque segura
  ~200 ms antes de arrastar. Ver "Quadro por arrasto" abaixo.
- **Modais do PCP** (`ModalNovoPedido`, `ModalLiberarPedido`) e **`ModalMoverCard`** — decisão
  curta em modal (`tamanho="galpao"` quando tem lista); seleção de destino com `<Selecao>`
  `tamanho="galpao"` no fluxo de tablet.

Regra que nasceu aqui: **contador de tempo usa o `desde` projetado do evento** — o front nunca
calcula posição/tempo a partir de estado editável ([[Memoria - Modelos Formulas e Possibilidades#M-13|M-13]]); o modelo fila/execução completo é da
SESSAO-05.

### Execução e linha do tempo (SESSAO-05)

- **`<CartaoUnidade>` ganhou os gestos do tempo ([[D-002 - Timer dois contadores por etapa dash compara e soma|D-02]]/D-24):** na fila mostra `Xmin na fila`
  (ícone de relógio; o card há mais tempo esperando na coluna ganha ampulheta + texto em
  `atencao-texto` — nunca só cor, [[Memoria - Modelos Formulas e Possibilidades#M-12|M-12]]); em execução mostra `Play` + tempo + **quem** executa
  ("você" para o próprio). Botões **Iniciar / Finalizar / Assumir** com `min-h-toque-md` (44px);
  card em execução tem borda `acao-ativa`. **↪️ SESSAO-24 ([[D-059 - Quadros de producao so por arrasto o unico botao e Concluir|D-59]]):** os botões saíram — iniciar
  é soltar na etapa de início; a borda e o "quem executa" continuam.
- **`<ModalLinhaTempo>`** — o histórico legível: um bloco por permanência (setor · etapa) com
  **Fila (do setor)**, **Execução de {pessoa}** e **Total na etapa**; durações via
  `formatarDuracaoMs` (precisão de segundos abaixo de 1min). A lista crua de eventos fica
  colapsada; **evento estornado aparece riscado (`line-through`), nunca some** (RNF-05); o
  painel de estorno só aparece para líder do setor/admin e sempre nomeia o gesto que vai anular.
- **Erro de regra vem do banco e é mostrado como veio** (já em português): limite atingido,
  finalizar sem iniciar etc. — o front não duplica a validação, só exibe ([[Memoria - Modelos Formulas e Possibilidades#M-4|M-04]]: a regra tem um
  dono, o trigger).
- A montagem dos segmentos é lógica pura em `src/kanban/linha-tempo.ts` — testada em Vitest,
  espelhando as views do banco.

### Pausa por líder e tempo em PCP no card (SESSAO-22 / D-48)

- **Card pausado é estado com ícone + texto, nunca só cor ([[Memoria - Modelos Formulas e Possibilidades#M-12|M-12]]):** `Pause` + "Pausado há X"
  em `atencao-texto`, com quem executa ao lado. Pausar (líder/admin) aparece ao lado do
  Finalizar; pausado troca os gestos por **Retomar** (no tablet, `galpao` com PIN). O banco
  valida tudo — o front só mostra a mensagem que voltar ("finalize a urgência antes…").
  **↪️ SESSAO-24 ([[D-059 - Quadros de producao so por arrasto o unico botao e Concluir|D-59]]):** Pausar/Retomar saíram dos quadros junto com os botões (arrastar
  para PARADO ou para a fila fecha o tempo); o estado "Pausado há X" continua sendo mostrado.
  **↪️ SESSAO-31 ([[D-125 - O card avulso quem cria como termina vinculo etiquetas quem|D-125]]):** Pausar/Retomar voltam **na janela do card** (no tablet, com PIN) e
  pedem o motivo; a frente mostra **"Pausado · motivo · há X"** e, no card solto na etapa que
  pede o motivo, **"Parado · motivo · há X"** (`Pause` + `atencao-texto`, `break-words`).
- **Tempo em PCP no card de unidade é do PEDIDO:** linha discreta "Pedido ficou X em PCP"
  (entrada → liberação completa; "ainda contando" enquanto houver unidade por liberar).
  A linha do tempo repete o número num bloco próprio e desconta as pausas de cada execução
  ("Xmin de pausa descontados").

### Qualidade nas transições (SESSAO-06 / D-09 / D-25)

- **Marcação de estado** (no `ModalMoverCard`, ao sair de setor de produção) e **parecer de
  recebimento** (`<ModalParecer>`) usam o mesmo padrão: **3 botões-rádio empilhados** com
  `<BadgeEstado>` (ícone + texto, nunca só cor — [[Memoria - Modelos Formulas e Possibilidades#M-12|M-12]]) + a descrição de cada estado, alvo
  `min-h-toque-lg` (56px). O texto do 🟡 é o do dono (Q-16) e **não se reescreve**.
- No parecer, a opção que repete a marcação de quem entregou ganha o rótulo **"Concordo com
  {SETOR}"**; escolher diferente mostra o aviso de divergência ANTES de confirmar (âmbar, sem
  tom de bronca — divergir é gesto legítimo).
- **`<CartaoUnidade>` com parecer pendente** mostra a faixa "{SETOR} entregou como {estado} —
  confirme ao iniciar" e o Iniciar abre a confirmação primeiro (o banco também trava).
  **↪️ SESSAO-24:** soltar o card na etapa de início abre o parecer primeiro.
- **Coluna DANIFICADO** (`eh_danificado`) ganha selo vermelho `danificado-fundo/texto` no
  cabeçalho, como a fila ganha o selo `info`.
- **`<SinoNotificacoes>`** (`src/notificacoes/`): sino no topo com contador de não lidas;
  painel **fixo, ancorado à borda direita da PÁGINA** (nunca no próprio sino — o menu quebra de
  linha e o sino pode estar à esquerda; ancorar nele estoura a tela no celular). Aviso não lido
  tem fundo `superficie-sutil` + "Toque para marcar como lida".

### Quadro por arrasto, fins de linha e cancelados (SESSAO-24 / D-58…D-62)

- **Quadros de produção são SÓ arrasto** ([[D-059 - Quadros de producao so por arrasto o unico botao e Concluir|D-59]] — pedido da equipe): o `<CartaoUnidade>`
  perdeu Iniciar/Pausar/Retomar/Finalizar/Assumir/Mover; ficaram linha do tempo, fotos e,
  só onde o setor conclui (LIMPEZA E EMBALAGEM — `setorConcluiProducao`), **"Concluir
  produção"**. Alça `GripVertical` avisa que o card se arrasta; botões dentro do card param
  a propagação do teclado para não disparar o arrasto. Mouse: 8px de distância; toque:
  segura ~200 ms (tolerância 8px); **teclado: espaço + setas** — a alternativa acessível.
- **O banco decide o gesto** (`plt_fn_soltar_card`); a tela só sabe antes o que precisa
  perguntar — `src/kanban/arrasto.ts` (espelho de `fn_etapa_inicio`, testado no Vitest):
  soltar no **início** → inicia (o parecer pendente abre antes); soltar em etapa que
  **encaminha** → `ModalMoverCard` modo `encaminhar` (os 3 estados — [[D-009 - Qualidade em 3 estados em TODA transicao com dupla atestacao|D-09]]); o resto → move.
- **Coluna que encaminha:** borda tracejada, sempre vazia, "Solte aqui para mandar para X"
  (o card nunca fica nela). **Coluna de início:** aviso "soltar aqui começa o tempo" (**↪️ 06/11:** no computador, só o ícone `Play` verde ao lado do número — o texto fica no leitor de tela e no `title`; o tablet segue com o texto).
- **`ModalMoverCard`** virou o modal do gesto: `encaminhar` (marcação obrigatória) ou
  `concluir` (só 🟢, já marcado; o texto diz o destino: Pedidos em aguardo, ou ESTOQUE
  sem dono para reposição e pedido cancelado).
- **Modo tablet** (`TelaSetor`): o MESMO `QuadroKanban` com `tamanho="galpao"` (sem
  cliente — [[D-028 - Card do operador dados do produto espaco de imagens som|D-28]]); ao soltar ou concluir, o `ModalPinOperador` pergunta quem fez ANTES.
  Os botões do cabeçalho (Trocar setor · Sair) também têm 44px (achado da [[Memoria - Modelos Formulas e Possibilidades#F-7|F-07]]).
- **Pedidos em aguardo em `<Abas>`:** "Pedidos (n)" · "Produtos reservados (n)"
  (`?aba=produtos`); as contagens vêm de UMA porta (`plt_fn_aguardo_contagens`) e batem
  por construção. Produto reservado: SKU + "Pedido N (k/n)", selo do estado quando não é
  🟢, "veio do estoque", "em aguardo há X". Botões da lista com 44px.
- **PCP em `<Abas>`:** "Reabastecimento" · "Pedidos aguardando liberação" · "Stand-by" ·
  **"Cancelados e removidos"** (`?aba=cancelados` — ↩️ SESSAO-48/D-299: voltou para dentro do
  PCP; de 14/10 a 11/11 levava para Pedidos → Cancelados) · "Lançamento manual". A aba
  "Cancelados e removidos" é lista por cursor (20, anda ao rolar, **sem o total** — Lei §6.4)
  com o filtro dos quadros, carregada só ao abrir (regra 17); cada linha: "Removido do PCP"
  (`PackageX`, âmbar) e/ou "Cancelado no Tiny" (`Ban`, vermelho), o motivo + o texto, quem e
  quando, as peças que seguem (em produção · prontas · no estoque · esperando a decisão da
  logística) e **"Devolver ao PCP"** (`Undo2`, secundário, só quando o pedido volta de verdade);
  no rodapé, o atalho para a história inteira em Pedidos → Cancelados.
- **Etiqueta "Pedido cancelado — pronta, vai para o estoque"** no card de unidade em
  produção (`danificado-*` com `Ban` — ícone + texto, nunca só cor).
- **Liberar com sugestão do estoque** (`ModalLiberarPedido`): por linha, "Há N igual(is)
  no estoque, sem dono — usar?" com checkbox **desmarcado por padrão** e a origem da peça;
  o aceito é alocado, o resto segue para a produção.
- **Setores e etapas:** chip "manda para X" na etapa e seletor "Soltar o card em {etapa}
  manda para" (a opção sem rota é "Fica no setor (não manda)"); etapa nova com nome de setor avisa a rota que vai
  nascer com ela.
- **Estoque:** a reservada que está no aguardo mostra "· em Pedidos em aguardo"; a livre
  de cancelamento mostra "Livre · veio do pedido N, que foi cancelado".
- **↪️ Ajuste do Frete ([[D-063 - Frete nao vira peca de producao o resto nasce no PCP e o PCP|D-63]], 28/09):** frete/entrega não vira card e some da lista de
  liberação (a regra é do banco — a tela só mostra o que a porta devolve). O **pedido sem
  nada a produzir** (só frete) aparece em Pedidos em aguardo já com o selo "Pedido
  completo" + a pílula de texto **"Nada a produzir"** (`superficie-sutil`, texto — nunca só
  cor), barra de progresso cheia e **sem "Ver unidades"** (não há unidade); o Lançar para
  ROTAS é o de sempre. Na Expedição, "Nada a produzir" entra no lugar de "0 de 0 no fim de
  linha". Teste de componente: `src/paginas/PedidosAguardo.test.tsx`.

### Controle de tempo do admin (SESSAO-07 / D-29)

- Página `/administracao/tempo` (só admin): horário de funcionamento por setor/pessoa
  (chips de dia da semana + hora início/fim), desligar/religar o tempo agora (pausa
  aberta em faixa âmbar), e a **correção retroativa** em seção emoldurada de vermelho —
  é o "botão de risco", com motivo registrado. Texto da tela repete a regra de ouro:
  nada altera o que já foi registrado; o desconto é só no cálculo.

### Kanban completo (SESSAO-31 / D-125…D-131) — `src/kanban/{janela,lancamento}/`

- **O quadro numa requisição:** `useQuadro(setorId)` (`src/kanban/useQuadro.ts`) é o padrão de quadro — assina o canal do setor **antes** de ler, 1 releitura por aviso, recuperação ao reconectar, `moverOtimista` no soltar, "Ver mais" por coluna (cursor). Quadro novo nasce com ele; nunca consulta por coluna nem relógio. **↪️ 14/10 noite ([[D-135 - Ajustes de tela do dono|D-135]]):** ao assinar, a leitura guardada de antes de a tela abrir é relida uma vez (o que mudou enquanto a pessoa estava fora — vale para toda tela com `useAoVivo`).
- **As colunas (↪️ 14/10 noite — D-135):** a coluna é uma faixa de altura cheia (solta-se o card em qualquer altura), mas o **painel** dela (`bg-superficie-sutil/40`, borda `borda/40`; tracejada quando leva ou conclui) **só cresce com card** — vazia, é só o cabeçalho; entre as colunas, **uma linha fina e clara** (`divide-x divide-borda/40` no contêiner); **nada no meio** da coluna ("Vazio"/"Solte aqui" saíram) — o que a coluna faz fica no topo ("soltar aqui começa o tempo", "→ leva para X", "conclui a produção"). Enquanto o quadro abre: o **esqueleto** das colunas (`EsqueletoDoQuadro`) e nenhum aviso. O **"Concluir"** só aparece no card avulso.
- **A mãozinha (15/10 — D-135):** o rolador do quadro recebe `useArrastarParaOLado()` (`src/kanban/componentes/arrastarQuadro.ts`): no mouse, o botão do **meio** em qualquer ponto ou o **esquerdo no fundo** (fora de card, botão, link, campo) corre as colunas; `cursor-grab` / `cursor-grabbing select-none`; a dica "Para ver as outras colunas…" só com `pointer: fine`; no toque, a rolagem do dedo. O card só se arrasta com o **botão esquerdo** (`SensorDoMouse` no lugar do `MouseSensor` — o da biblioteca pega também o do meio). Quadro novo com rolagem lateral nasce com os dois.
  **↪️ 06/11 (pedido do dono — "é inútil"):** a dica "Para ver as outras colunas…" saiu do quadro; a explicação mora no **?** do cabeçalho da tela do setor. A mãozinha continua.
- **Abrir um card de qualquer tela:** `useAbrirCard()` põe `?card=<id>` no endereço; `<JanelaDoCardNaUrl>` (montado na casca e no tablet com `modo="tablet"`) desenha a `<JanelaDoCard>` — um componente só. Clicar ≠ arrastar (o clique do fim do arrasto é ignorado); Enter abre, Espaço pega. No sino, o destino do aviso pode ser um card.
- **A janela:** `Modal tamanho="tela"`; à esquerda o card (cabeçalho: onde está · nome · estado com ícone + texto · vínculo; propriedades em grade de 2 colunas com o lápis de quem pode editar; descrição; tempo e histórico **no clique**; anexos **no clique**); à direita a **conversa** (`colunaDireita`). No tablet só para ver e sem cliente ([[D-028 - Card do operador dados do produto espaco de imagens som|D-28]]), exceto Pausar/Retomar com PIN.
- **Anexos** (`AnexosDoCard`, `GravadorDeAudio`): imagem com miniatura, PDF abre no navegador, áudio com `<audio>`; enviar por botão, arrastar e soltar, câmera (`capture`) e gravar (até 5 min, para sozinho); tirado = some, o admin vê com "Mostrar os tirados".
- **Conversa do card** (`ConversaDoCard`): bolhas como o chat, 10 por página com "Ver anteriores", filtro de duas pílulas (`radiogroup` "Mostrar") **Só conversa | Tudo** (os fatos do card em língua de gente, `texto-suave` e menor), compositor com **@menção** (lista do servidor, espera 300 ms, 2 letras), "editada" / "Mensagem apagada" (o admin vê o texto, riscado). O **cartão de menção** no chat particular segue o desenho do cartão de aniversário: "📌 mencionou você no card …", o trecho e o botão **Abrir card**.
- **Lançamento manual** (aba do PCP, pedaço próprio): `Novo card` primário; criação rápida (nome + Enter) com atalhos em pílula (responsável · datas · prioridade/etiqueta) e "Mais detalhes"; `FiltroPill` **Mostrar** A lançar · Em produção · Concluídos; seletores de pessoa e de etiqueta reaproveitáveis em `lancamento/Seletores.tsx`. **↪️ 14/10 noite:** cada avulso é um **card comum** em grade (`sm:grid-cols-2 lg:grid-cols-3`, como o card do pedido no PCP): título e vencimento em cima, onde está e quem executa no meio, "Lançar para a produção" (ou "Concluir") na largura toda embaixo.
- **Frente do card** (`CartaoUnidade`): só o que o card tem — título do avulso (até 2 linhas), `EtiquetasDoCard`, rostos dos responsáveis (até 3 + "+N", nome no texto acessível), vencimento com `CalendarClock`/`TriangleAlert` + texto ("Venceu em dd/mm — atrasado", "Vence hoje"), o botãozinho da descrição (`<Dica icone>` com `AlignLeft` — passar o mouse / tocar), vínculo em linha pequena, contadores `Paperclip`/`MessageSquare`, selo do ajuste (`Wrench` + "Ajuste · vai para …"). Tudo projetado no card — a frente nunca faz consulta.
- **Escolher um motivo (padrão da casa — ↪️ 14/10 noite):** o desenho do `ModalMotivoEntrega` — os motivos em **botões grandes em grade** (`sm:grid-cols-2`, `aria-pressed`; o escolhido com borda `acao-ativa` e fundo `acao/15`), "Outro" é mais um botão (pede o texto), o campo "Detalhe (opcional)" embaixo e as ações no fim do formulário. `ModalMotivoPausa` segue esse desenho (Pausar na janela; Parar ao soltar na etapa que pede o motivo); o subtítulo diz QUAL card ("Armário (1/2) · Pedido 13622"). Os motivos de pausa têm aba própria em Utilitários.
- **Setores e etapas:** as chaves do estado da peça (enviar/receber × tipo de card) e, na etapa, a rota "Conclui a produção" e a caixinha **"Parar aqui pede o motivo"**; pílulas de etapa: "manda para …", "conclui a produção" (`perfeito-*`), "pede o motivo" (`atencao-*`, `Pause`). **↪️ 15/10:** o bloco das etapas é um *container* e o desenho segue a largura **dele** (não a da janela — as barras do menu comem espaço): largo (`@4xl`) → **grade alinhada** (nome · para onde manda · motivo · ações; linhas em `grid-cols-subgrid`) com cabeçalho; médio (`@md`) → nome e ações em cima, seleção e caixinha embaixo (lado a lado a partir de `@lg`); estreito → empilhado (nome, seleção, caixinha, ações por último à direita), com o rótulo de cada controle (`Selecao classeRotulo="@4xl:sr-only"`). As pílulas da linha descem inteiras e terminam em "…" sem espaço (`max-w-full` + `truncate`). **Padrão para lista com controles por linha:** grade alinhada por *container query*, nunca por largura de janela. A `Selecao` mostra o escolhido **numa linha** (o longo termina em "…").

### Cancelar a fabricação de verdade (SESSAO-48 / D-290…)

- **A coluna que cancela** (o CANCELADO e o NÃO ENCONTRADO da LIMPEZA E EMBALAGEM — `etapa.cancela_fabricacao`): no topo, como o "conclui a produção", a linha `Ban` (vermelho) + "tira da produção · some em N dias". Nunca é a etapa de início (`etapaDeInicio` e `fn_etapa_inicio` a pulam).
- **O cartão da peça cancelada** (`CartaoUnidade`, regra em `src/kanban/cancelada.ts`): no lugar do tempo de fila, `Ban` (ou `SearchX` para "Não encontrada") + "Cancelada em dd/mm" em `danificado-texto` e, em `texto-suave`, "· some em N dias" / "· some amanhã" / "· some hoje" (dias de calendário até a coluna deixar de mostrar). A origem diz "Era do pedido N" (`rotuloOrigemCard` — vale para o cartão, a janela e a busca). Cada pedaço da linha em `whitespace-nowrap` (quebra entre os pedaços, nunca no meio).
- **A peça de pedido cancelado esperando a decisão** (`card.destino_pendente_em`): a etiqueta de sempre do pedido cancelado com `Hourglass` + "Pedido cancelado — esperando decisão da logística" (a antiga, `Ban` + "… pronta, vai para o estoque", segue para quem não tem a marca).
- **Setores e etapas:** "Cancela a fabricação" e "Peça não encontrada" são escolhas da MESMA lista de "Manda para" (com "Fica no setor", "Conclui a produção" e os setores); escolhida uma delas, a caixinha "Parar aqui pede o motivo" dá lugar a "Some da coluna em [7] dias" (campo numérico de 44 px, 1 a 90, salva ao sair do campo ou no Enter, erro em `role="alert"`). Fora da edição, a pílula `danificado` "cancela a fabricação" / "peça não encontrada · tira da produção".
- **A janela do card** da peça cancelada: a pílula `Ban` "Cancelada em dd/mm" no topo e um bloco `danificado` (`role="status"`) que diz o que houve, de qual pedido era e como desfazer; com a peça já tirada da coluna, o botão secundário **"Recuperar a peça"** (só admin, nunca no tablet).
- **Busca geral:** a peça cancelada diz onde está ("LIMPEZA E EMBALAGEM · CANCELADO — fabricação cancelada em dd/mm", tom `danificado`) ou quando saiu da coluna ("Fabricação cancelada — saiu da coluna em dd/mm"). O pedido removido do PCP diz "Removido do PCP em dd/mm" (tom neutro) e o atalho leva à aba "Cancelados e removidos"; na lista de Pedidos ele aparece "Removido do PCP" mesmo com peça em produção ([[D-300 - Remover do PCP so a parte do PCP muda|D-300]]).
- **O selo da peça cancelada no PCP** (`SeloPecaCancelada` em `PCP.tsx`, frente 2): no card do pedido em "Aguardando liberação" e em Stand-by, pílula `danificado` com `Ban` (ou `SearchX`) + "Peça cancelada na produção" / "Peça não encontrada" / "N peças canceladas na produção" — é um **botão** (`toque-seguro`: 44 px de alvo sem mudar o desenho) que abre a janela; lido de `pedido_resumo.aviso_cancelada` (sem requisição a mais). O sino do PCP abre a mesma janela (`?aviso=<card>`).
- **A janela "O que aconteceu?"** (`ModalPecaCancelada`, pedaço próprio): lê uma vez ao abrir e esquece ao fechar. Topo: o bloco do aviso (vermelho, com ícone; "já resolvido" em verde; "removido por X" neutro). "Peças que saíram da produção (N)": cada uma com `Ban`/`SearchX`, nome (k/n) · SKU e, em `texto-suave`, a coluna · setor · quem · quando. "O que o pedido ainda tem": em produção (onde), prontas, "Vagas para liberar no PCP: X de Y". Rodapé: a explicação curta das duas saídas + **"Remover do PCP"** (secundário, `PackageX`) e **"Produzir de novo"** (primário, `RotateCcw`). O 2º passo, "Remover do PCP": "Por que o pedido sai do PCP?" com os 3 motivos em botões grandes (o desenho da casa para escolher um motivo); "O pedido foi cancelado" mostra "Cancele também no Tiny."; os outros dois pedem o texto ("O que houve?" / o motivo, 3 letras ou mais, conferido na tela e no banco); aviso âmbar com as peças que seguem ("Este pedido ainda tem 1 peça em A LIMPAR. Para cancelar a fabricação dela, mova para CANCELADO."); "Voltar" + "Remover do PCP".
- **A janela "Para onde vai este móvel?"** (`ModalDestinoPedidoCancelado`, frente 3 — o molde é a "Decidir situação" da devolução; `tamanho="galpao"`, no celular sobe do rodapé; pedaço próprio aberto pelo `?destino=` do Estoque em qualquer aba): o resumo (o pedido, quando cancelou, quantos móveis estavam em produção, a pílula "Cancelado no Tiny"); **"Todas de uma vez"** (3 botões com `aria-pressed`; "Passar para outro pedido" desligado com o porquê quando nem todos têm pedido); por móvel: nome (k/n), SKU, onde está e desde quando espera, quem trabalha nele, o selo de danificada, os 3 botões-rádio (`Boxes` "Seguir para o estoque" · `Replace` "Passar para outro pedido" · `Ban` "Cancelar a fabricação", com o check quando marcado) e, em "Passar para outro pedido", "Para qual pedido" com os pedidos em botões (nº · cliente, "previsto dd/mm · N vagas deste móvel", "em stand-by"; a vaga tomada por outro móvel da janela fica desligada e diz isso). Rodapé sempre à vista: "Fechar" + "Aplicar a decisão"; "Já decidido" mostra o que aconteceu, quem e quando.
