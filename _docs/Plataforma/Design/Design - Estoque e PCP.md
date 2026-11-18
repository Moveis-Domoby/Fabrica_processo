---
titulo: "Modelo de sistema — Estoque e PCP"
tipo: design
assunto: estoque
atualizado: 2026-11-18
tags: [plataforma, design-system, modelo-de-sistema, design/estoque]
---

# 🧩 Design - Estoque e PCP

> Parte de [[PLT - Modelo de Sistema]], movida em 18/11/2026 sem reescrever (a numeração das seções é a do documento original). Padrão novo deste assunto entra **aqui**.

### Estoque completo e reposição (SESSAO-25 / D-54…D-57)

- **`<Abas>`** (`src/componentes/ui/Abas.tsx` — componente novo): visões diferentes do MESMO
  filho de rota (não são rotas — [[D-036 - Lei de navegacao hierarquia pai filho pai nunca navega rota|D-36]]). `role="tablist"`/`tab` com `aria-selected`, alvo de
  44px, aba ativa com borda `acao-ativa` + texto forte (nunca só cor), setas ←/→ trocam de
  aba, quebra linha no celular em vez de rolar a página. A aba vive na URL (`?aba=`) — o
  Voltar e o link funcionam. O painel é da tela (`role="tabpanel"`, `id`/`aria-labelledby`
  pelo `idBase`). A SESSAO-24 usa o mesmo componente no "Ver pedidos / Ver itens".
- **Estoque em abas:** *Produtos acabados* · *Matéria-prima e insumos* · *Sugestão de mínimo*.
  O cartão de produto mostra o **sinal** (pílula com ícone + texto: necessidade extrema
  `danificado-*` com `OctagonAlert`, abaixo do mínimo `atencao-*` com `TriangleAlert`, ok
  `perfeito-*`, sem mínimo/sem leitura em `superficie-sutil`), **4 números** em grade
  (Em estoque em destaque · Mínimo (Tiny) · Reservados · Livres na plataforma — nunca
  somados), a linha da leitura do Tiny ("Tiny: 3 − 2 vendidos pela loja ainda sem sair ·
  lido há 2 h (carga inicial)") e "Ver as peças" sob demanda (regra 17). Estoque na tela
  **nunca negativo** ([[D-053 - Estoque na frente a 25 troca de ordem com a 24 e absorve|D-53]]); o negativo vira a pílula de necessidade extrema. A lógica do
  sinal é pura em `src/logistica/estoque.ts` (Vitest).
- **Peça no estoque:** reservada = "Reservada · Pedido N (k/n)" + SKU (as duas etiquetas);
  livre = "Livre · veio da reposição". "Ver todas as peças no ESTOQUE" (inclusive
  personalizada de pedido) só carrega ao abrir.
- **Sugestão de mínimo:** lista numerada (1º…20º) com vendidos em 90 dias e média por semana;
  a cobertura (1/2/4 semanas) é `FiltroPill`; a sugestão que difere do mínimo atual ganha
  borda `acao-ativa`.
- **Card de REPOSIÇÃO no PCP:** borda `acao-ativa`, cabeçalho "Reposição de estoque" com
  `PackagePlus`, produto + SKU, "Em estoque X · mínimo Y", pílula de necessidade extrema
  quando houver, "Repor N unidades · k liberadas"; **"Liberar unidades"** abre o MESMO
  `ModalLiberarPedido` (modo reposição) e **"Não produzir"** arquiva em dois toques inline.
- **Card sem pedido** aparece como **"Reposição de estoque"** onde o card de unidade diria
  "Pedido N" (quadros, tablet, modais, afazeres, Danificados) — helper único
  `src/kanban/rotulos.ts` (`rotuloOrigemCard`).
- **ESTOQUE só com 🟢:** mover/concluir/resolver para o ESTOQUE só oferece "Perfeito estado",
  com a frase da regra ("com defeito, mova para o DANIFICADO do setor"); o banco recusa o
  resto (mensagem mostrada como veio).

### Estoque enxuto: Top 20+, contagem da logística, configurações e foto (ajuste de 28/09 / D-70…D-74)

> ↪️ Revisa a seção "Estoque completo e reposição" acima: as abas agora são **Top 20+ · Matéria-prima e insumos · Configurações**; o cartão grande de 4 números e a linha do Tiny saíram do cartão.

- **`<Dica>`** (`src/componentes/ui/Dica.tsx` — componente novo): o **"i" de informação** com o
  balãozinho, no lugar de texto explicativo embaixo de título (pedido do dono). Botão redondo de
  44px com `Info`; abre ao passar o mouse, focar ou tocar; fecha no ESC, ao sair o mouse ou ao
  tocar fora. `role="tooltip"` + `aria-describedby`. **O balão ancora no PAI posicionado** (ponha
  `relative` no cabeçalho) — no celular ele ocupa a largura do cabeçalho e nunca estoura a borda
  (lição da [[Memoria - Modelos Formulas e Possibilidades#F-7|F-07]]: overlay se ancora na página, não no elemento).
- **`<Abas variante="quadrados">`**: as abas de uma tela como **quadrados de 44px só com o ícone,
  no canto superior direito**, na mesma linha do título. Sobem 2px com sombra ao passar o mouse
  (a microinteração da casa, [[D-027 - Padroes de interface menu lateral modelo de sistema no cofre|D-27]]) e mostram o nome num balãozinho escuro embaixo (`group-hover`/
  `group-focus-visible`, ancorado à direita); a ativa é preenchida (`bg-acao`). O nome também vai
  no `aria-label` — toda aba precisa de ícone. Embaixo do título, uma linha curta diz onde a pessoa
  está ("Top 20+ · os mais vendidos primeiro") — no celular não existe passar o mouse.
- **Cartão de produto com foto** (`CartaoProdutoEstoque`): **a foto em cima** (↩️ 30/09, [[D-081 - As fotos dos produtos vem do Tiny e aparecem inteiras sem|D-81]]:
  quadro **quadrado** `aspect-square`, a foto **inteira** `object-contain` sobre **branco** — nunca
  `object-cover`, que cortava o móvel em pé; sem foto, o ícone `Package` em `superficie-sutil`), com o **rank** numa pílula escura no
  canto (1º, 2º…) e o botão de câmera (44px, canto inferior direito) para quem pode trocar;
  embaixo: nome (2 linhas no máximo), SKU e vendas de 90 dias em `text-xs`, o número do estoque em
  `text-xl` com "em estoque", o mínimo em `text-xs` à direita, o sinal (pílula com ícone + texto:
  "Sem estoque" `danificado-*`, "Faltam N para o mínimo" `atencao-*`, "No mínimo" `perfeito-*`,
  sem mínimo e zerado em `superficie-sutil`) e os gestos **Entrada/Baixa** (secundários, 44px).
  Grade `repeat(auto-fill,minmax(14.5rem,1fr))` — quem manda é a largura do conteúdo, não a da
  janela ([[Memoria - Front Telas e React 1#E-30|E-30]]). **Tocar na foto abre o detalhe** (modal `galpao`): foto grande, números, Entrada/
  Baixa/Contagem, peça por peça (só carrega ao abrir) e a referência do Tiny em `text-xs`.
- **Foto de produto** (`FotoProduto`): reduzida no aparelho antes de subir (`src/lib/imagem.ts` —
  lado maior 1280px, JPEG 0,82; se falhar, sobe a original), gravada na pasta do SKU
  (`pastaDoProduto`, a mesma regra do tablet) e o caminho vai para o produto — a lista traz o
  caminho numa consulta só (nunca listar o storage por cartão). **Mostrar foto de produto (D-81):
  sempre inteira** — `object-contain` sobre `bg-white` (o fundo das fotos do catálogo, em qualquer
  tema); no detalhe, quadrado centralizado (`mx-auto aspect-square w-full max-w-sm sm:max-w-md`);
  nas miniaturas (`size-12`), idem. **Recorte (PNG transparente) sobe com fundo BRANCO** — a
  redução (`reduzirImagem`) pinta o fundo antes do `drawImage` (sem isso, o JPEG saía com fundo
  preto; corrigido em 30/09).
- **Movimentar estoque** (`ModalMovimentarEstoque`): `FiltroPill` com Entrada · Baixa · Contagem,
  uma frase do que cada uma é, o campo numérico grande e a **prévia antes de confirmar** ("Ficam 5
  no estoque", "Saem 3 peças (de 5 para 2)", "Só há 2 — não dá para dar baixa em 3") — lógica pura
  em `previaMovimento` (Vitest); o botão de confirmar fica desligado enquanto a prévia não vale.
- **Configurações** (`PainelConfiguracoes`): o cartão **Galpão** (capacidade em peças + 4 números:
  peças no estoque, reservadas, soma dos mínimos — com aviso quando passa da capacidade —, soma
  das sugestões); a lista por produto com o rank redondo, a foto pequena, o campo **Mínimo**
  (vazio = o do Tiny, que aparece no placeholder), a **Sugestão** (borda de ação quando difere) e
  "Usar"; **"Usar todas as sugestões"** em dois toques inline (caixa `atencao-*` explicando).

### Observação do item, Cancelar e Ocultar no PCP e editar o endereço (SESSAO-50 / D-307…D-324)

- **A faixa da observação do item** (`ObservacaoDoItem`, um desenho só): `p` com filete `border-l-[3px] border-atencao-borda`, fundo `bg-atencao-fundo/50`, ícone `StickyNote` em `text-atencao-forte` + o texto em `text-texto` — é instrução, não alerta (nada de vermelho; nenhuma cor nova). Na capa do card: logo depois do nome do móvel, `text-xs` (no tablet `text-sm`), `line-clamp-2` com o texto inteiro no `title`, `sr-only` "Observação do item: "; marca `data-observacao-item` para medir. Card sem observação fica idêntico (nada reservado). Na janela do card: seção "Observação do item (Tiny)" (a faixa com o texto inteiro), logo acima de Datas, só quando há. Na janela "Liberar unidades": a mesma faixa (em `span` — está dentro do rótulo da caixa) embaixo de cada unidade.
- **Cancelar / Ocultar no card do PCP** (`AcoesSaida` em `PCP.tsx`): no rodapé do card, abaixo do botão de liberar, dois botões `fantasma` lado a lado em grade de 2 colunas (`min-h-toque-md`, `text-texto-suave`): `EyeOff` "Ocultar do PCP" e `Ban` "Cancelar pedido" — discretos, para não competir com "Liberar unidades". Na janela do card do pedido: a faixa `bg-superficie-sutil` "Este pedido não vai ser produzido?" com os dois como `secundaria` (`whitespace-nowrap` — cabe em 375). Na janela "Liberar unidades": a mesma pergunta como linha.
- **O modal de Cancelar/Ocultar** (`ModalSaidaPedido`, `Modal` `md`, pedaço próprio; lê a prévia ao abrir): Cancelar = bloco `danificado` "Isso cancela o pedido **também no Tiny**…" + a lista do que acontece (ícone + frase: sai do PCP, peças em produção esperam a logística, prontas vão ao estoque, reservas soltam) + `perigo` "Cancelar no Tiny e aqui" / `secundaria` "Voltar". Ocultar = a frase ("fica em **Pedidos ocultos** por N dias. O Tiny não muda.") + bloco `atencao` com a pergunta das peças (quantas e onde) e, **com três escolhas de texto longo, os botões um embaixo do outro em todo tamanho** (lado a lado quebravam no tablet — [[Memoria - Front Telas e React 1#E-283|E-283]]): "Ocultar o pedido e as peças" (primária), "Ocultar só o pedido", "Voltar". Já cancelado/oculto: um bloco neutro dizendo onde ele está + "Fechar".
- **As abas "Cancelados" e "Pedidos ocultos"** (no lugar de "Cancelados e removidos"): lista de cartões (`rounded-dm-lg border`), cada um com "Pedido N" + pílula do motivo (`danificado-fundo` com `Ban`/`FileX` — "Cancelado no Tiny", "Cancelado pela plataforma", "Excluído no Tiny"; `superficie-sutil` com `EyeOff` — "Oculto do PCP"), cliente, quem/quando (`text-xs text-texto-suave`), as peças, e um aviso `atencao-fundo` com `AlertTriangle` quando o Tiny não confirmou (ou, no oculto, quando o Tiny o segura fora do quadro). Ações: "Abrir o card" (`fantasma` com texto — o ícone sozinho parecia perdido no celular) e a secundária do caso ("Tentar de novo" / "Recuperar"). Os dias dos ocultos: "Ficam aqui por 30 dias." + "Mudar" (só admin; campo numérico de 44 px, erro em `role="alert"`, `noValidate` — [[Memoria - Testes e Validacao ao Vivo#E-276|E-276]]). Sem total; 20 por vez ao rolar (`MaisAoRolar`).
- **"Incluir pedido no PCP"** (o antigo "Novo pedido", `ModalNovoPedido`): duas seções em `listbox` — "Ocultos do PCP" (pílula `EyeOff` "Oculto em dd/mm", "N produtos para liberar") e "Sem card no kanban" (data e unidades à direita); a escolha marca "✓ escolhido" e o botão do rodapé muda o texto ("Trazer de volta ao PCP" / "Criar card no PCP"). Pagina ao rolar (sem números de página).
- **Editar o endereço do pedido** (`JanelaEnderecoPedido`, pedaço próprio): o formulário (rua, número, complemento, bairro, cidade, UF, CEP) + o mapa com o pino arrastável e "Achar no mapa"; ao salvar, o 2º passo **"Trocar o endereço de entrega do pedido N?"** com o quadro "De:/Para:" (`superficie-sutil`), a pergunta "Deseja salvar também no Tiny?…" e os botões "Salvar na plataforma e no Tiny" (desligado com o porquê embaixo, `Info` + `text-xs`) e "Salvar só na plataforma" (primária) + "Voltar". O selo **"Endereço alterado na plataforma"** (`SeloEnderecoAlterado`, pílula azul com o ícone do pino) e, embaixo, "No Tiny: …" em `texto-suave`. A parada avulsa: "Editar" abre o mesmo formulário de criar, preenchido ("Editar parada avulsa" / "Salvar as mudanças" — acende só quando algo mudou). No mapa, balão com botão de no máximo 240 px ([[Memoria - Front Telas e React 2#A-232|A-232]]).
