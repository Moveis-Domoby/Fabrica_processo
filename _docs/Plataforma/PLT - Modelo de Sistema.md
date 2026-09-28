---
titulo: PLT — Modelo de Sistema (o design system da plataforma)
tipo: modelo-de-sistema
data: 2026-08-24
atualizado: 2026-09-28
tags: [plataforma, design-system, modelo-de-sistema, ui]
---

# 🧩 PLT — Modelo de Sistema — Plataforma de Produção Domoby

> [!danger] Fonte única do padrão visual (D-27)
> Este documento morava no repositório como `docs/design-system.md` e **migrou para o cofre na SESSAO-07** (D-27): aqui é a fonte única. **Nada se constrói fora do modelo de sistema.** Toda tela nova segue este documento; componente novo só quando não existir equivalente — e entra nesta nota junto com a regra de uso. A antiga rota `/design` do aplicativo foi removida na mesma sessão.

---

## 1. Para quem esta interface é

Antes de qualquer regra visual: **quem mais usa esta plataforma está em pé, no galpão, com as mãos sujas, num tablet compartilhado** (D-06). Isso dita quase tudo o que vem abaixo — botão grande, contraste alto, nada de precisão de mira, nada que dependa de passar o mouse.

Três públicos, três densidades:

| Público | Onde | Densidade |
|---|---|---|
| Operador | tablet do setor / celular pessoal | **baixa** — poucos elementos, alvos de 64px |
| Líder | tablet ou desktop | média — listas com filtro e paginação |
| Admin | desktop | alta — tabelas, cadastros, configuração |

---

## 2. A marca

A logo da Móveis Domoby é **amarelo sobre grafite**. O design system nasce dessa dupla.

- `marca-500` (`#F1C24B`) é o amarelo da logo.
- `grafite-700` (`#5A585C`) é o fundo da logo.
- Componente `<Marca />` reproduz a assinatura tipográfica (Poppins). Quando o arquivo oficial da logo entrar em `public/`, o componente passa a renderizar a imagem sem mudar a API.

### Regra de ouro do amarelo

> **O amarelo é cor de MARCA e de AÇÃO. Nunca é cor de estado.**

O estado "🟡 atenção" da D-09 é renderizado em **âmbar-laranja**, não em amarelo. Dois amarelos com significados diferentes na mesma tela, num galpão com luz ruim, é erro esperando acontecer.

E: **amarelo com texto branco é proibido** — o contraste fica em ~1,8:1, ilegível. Amarelo sempre com `grafite-950` por cima (~10:1).

---

## 3. Tokens

Nenhum hexadecimal solto no código. **Só token.** Eles vivem em `src/estilos/tokens.css` em duas camadas:

1. **Paleta bruta** (`--dm-marca-500`, `--dm-grafite-700`…) — a matéria-prima. Nunca use direto num componente.
2. **Semântica** (`--dm-fundo`, `--dm-texto`, `--dm-acao`…) — é isto que os componentes consomem. Trocar de tema = trocar esta camada, sem tocar em componente nenhum.

O `src/estilos/global.css` mapeia as duas para utilidades do Tailwind.

### Cor semântica → utilidade

| Papel | Utilidade | Quando usar |
|---|---|---|
| Fundo da página | `bg-fundo` | o `body` |
| Cartão / painel | `bg-superficie` | qualquer bloco de conteúdo |
| Realce discreto | `bg-superficie-sutil` | cabeçalho de tabela, linha em hover |
| Texto principal | `text-texto` | conteúdo |
| Texto de apoio | `text-texto-suave` | rótulos, descrições |
| Texto fraco | `text-texto-fraco` | placeholder, legenda |
| Borda | `border-borda` | separadores |
| Borda de campo | `border-borda-forte` | input, select, botão secundário |
| Ação | `bg-acao text-acao-texto` | botão primário (amarelo + grafite) |

### Estados de qualidade (D-09)

| Estado | Token | Cor | Significado na interface |
|---|---|---|---|
| 🟢 perfeito | `perfeito-*` | verde | "Peça em perfeito estado, segue o fluxo normal." |
| 🟡 atenção | `atencao-*` | **âmbar-laranja** | "Levemente danificado, porém ainda dá pra seguir e tentar consertar." |
| 🔴 danificado | `danificado-*` | vermelho | "Danificado — a peça vai para DANIFICADO e a liderança é avisada." |

O texto do 🟡 são **as palavras do dono** (D-09 / Q-16) e está em `src/componentes/ui/estados.ts` como `DESCRICAO_ESTADO`. **Não reescreva** — se precisar mudar, é decisão de produto.

> **Estado nunca é comunicado só por cor.** `<BadgeEstado>` sempre desenha ícone + texto. Daltonismo é comum e o galpão tem iluminação ruim.

### Cores de série dos gráficos (SESSAO-20 — a SESSAO-16 herda)

Gráfico e indicador **nunca** usam cor fixa de paleta (`text-emerald-500`): usam
os tokens de série, que acompanham o tema escolhido no Meu Perfil.

| Token | Papel |
|---|---|
| `serie-1` | **é a cor de AÇÃO do tema** — o número principal acompanha a identidade (amarelo no padrão, esmeralda nos temas esmeralda) |
| `serie-2` … `serie-6` | as demais séries, na ordem de uso; clareiam automaticamente nos temas escuros |
| `serie-fila` / `serie-execucao` | **(SESSAO-16)** o par fila × execução dos dashboards de produção — azul `#2563eb` e âmbar `#b8851e` do LEIA-ME de `docs/inspiracao/dashboards/`, **fixos em todos os temas** (a `serie-1` no esmeralda vira verde, que é exclusivo da qualidade); clareiam nos temas escuros sem mudar de identidade |

Duas regras que vêm de A-08 e M-12:

- **Nenhuma série usa o âmbar-laranja** dos estados de qualidade — 🟡 não pode
  competir com "a segunda barra do gráfico".
- **Estado NUNCA vira série:** ganho/perdido/atenção usam os tokens de qualidade
  (`perfeito-*`, `atencao-*`, `danificado-*`), com ícone + texto.

### Número dentro de cartão: container query, nunca breakpoint (SESSAO-20)

O tamanho do número de um indicador **não pode** depender do breakpoint do
viewport. A sidebar ocupa ~450px: o mesmo viewport "xl" produz cartão de 150px
ou de 300px, e foi assim que o valor vazou/sobrepôs o cartão. O padrão da casa:

- o bloco do número é um **container** (`.num-bloco`) e a fonte escala com a
  largura REAL dele — `.num-curto`, `.num-moeda`, `.num-par` (`clamp(...cqi...)`);
- a grade usa `repeat(auto-fit, minmax(X, 1fr))`, com **X calibrado pelo dado
  mais largo** (o valor em reais com centavos) — largura mínima compatível com o
  conteúdo faz parte da correção;
- o número ancora no rodapé do cartão (`mt-auto`), o que alinha a linha de base
  entre cartões de rótulo curto e longo.

**Proibido** resolver estouro de valor com `truncate`, `overflow-hidden`,
esconder o ícone ou `min-h` fixo: cortar número é perder informação.

### Ajuste a zoom e a tela grande (SESSAO-20)

Largura e altura de painel acompanham a tela: o conteúdo usa
`max-w-[min(100%,110rem)]` (não `max-w-6xl`, que deixava faixa vazia em telas
largas) e altura de gráfico/lista rolável é `clamp(rem, vh, rem)` — nunca px fixo.

### Tipografia

- **Poppins** (500/600/700) — marca e títulos (`font-marca`, aplicada automaticamente em `h1/h2/h3`).
- **Inter** (variável) — corpo, formulários e dados (`font-sans`, padrão do `body`).
- Ambas **embarcadas no build**: a interface não depende da internet do galpão para carregar fonte.
- Números que se comparam em coluna (durações, quantidades) usam `tabular-nums`.

### Alvos de toque (D-06)

| Token | Tamanho | Uso |
|---|---|---|
| `toque-sm` | 36px | ações densas de admin em desktop |
| `toque-md` | **44px** | **mínimo absoluto** de qualquer coisa clicável |
| `toque-lg` | 56px | ações importantes em tablet |
| `toque-galpao` | **64px** | **padrão das ações do operador** |

Elemento visualmente pequeno que precisa ser clicável (ícone) usa a utilidade `.toque-seguro`, que estende a área de toque para 44px sem mudar o desenho.

### Raio e sombra

`rounded-dm` (10px) no geral; `rounded-dm-lg` (14px) em painéis e modais. Sombra só onde há elevação real (modal, notificação, popover) — cartão comum usa borda, não sombra.

---

## 4. Componentes base

Todos em `src/componentes/ui/`, exportados por `@/componentes/ui`.

### `<Botao>`

```tsx
<Botao variante="primaria" tamanho="galpao" icone={<Play />}>Iniciar</Botao>
```

- Variantes: `primaria` (amarelo — a ação da tela), `secundaria` (borda), `fantasma` (sem peso), `perigo` (vermelho).
- **Uma ação primária por bloco de decisão.** Duas primárias na mesma tela = nenhuma primária.
- `perigo` é para **destruir** (excluir, cancelar). **Mover card não é perigo** — mover é fluxo normal.
- `carregando` desabilita e marca `aria-busy`. Nunca deixe um botão de ação sem estado de carregamento em operação que toca a rede.
- No celular, ação principal usa `larguraTotal`.
- **Microinteração padrão (SESSAO-07, pedido do dono):** ao interagir (hover/foco de teclado), o botão sobe ~2px com sombra suave; o clique/toque o "assenta" de volta. É herdada por TODO botão via componente — sutil de propósito, nada além disso. Botão desabilitado não se move.

### `<Campo>`

```tsx
<Campo rotulo="Buscar pedido" prefixo={<Search />} erro={erro} ajuda="..." />
```

- **Rótulo sempre visível.** `rotuloOculto` existe só para casos como busca com ícone em barra compacta — e mesmo assim o rótulo continua no DOM para leitor de tela.
- `ajuda` e `erro` são ligados por `aria-describedby`; `erro` marca `aria-invalid`. Nunca comunique erro só pela borda vermelha.
- Fonte de 16px é obrigatória em campos: abaixo disso o iOS dá zoom sozinho ao focar.

### `<Selecao>`

Preferida ao `<select>` nativo: o nativo não aceita alvo de toque grande nem estilização consistente entre Android e iOS. Use `tamanho="galpao"` em qualquer seleção que o operador toque.

### `<Modal>`

- Trava foco, fecha no ESC e no clique fora.
- **No celular sobe do rodapé** (folha inferior), na zona alcançável pelo polegar; no tablet centraliza.
- Modal é para **uma decisão curta**. Fluxo com mais de um passo merece tela própria.
- Rodapé: no celular a ação primária fica **em cima** (`flex-col-reverse`), porque é a mais alcançável.

### `<BadgeEstado>`

Selo de estado com ícone + texto. Tamanho `galpao` para a tela do operador, `sm` dentro de tabela.

### `<ProvedorNotificacao>` + `useNotificacao()`

```tsx
const notificar = useNotificacao()
notificar({ titulo: 'Card movido', tom: 'perfeito' })
```

- O provedor fica uma vez, na raiz do app.
- **No celular as notificações aparecem no topo** — o rodapé é a zona do polegar e some atrás do teclado. No tablet/desktop, canto inferior direito.
- Notificação é para confirmação passageira. Informação que precisa de ação vai para a tela, não para o toast.

### Lei de requisição (SESSAO-22, pedido do dono) — cada tela requisita só o que mostra

> **"Cada tela deve requisitar apenas o que ela mostra — se a tela não mostra, ela não requisita."**

- Lista, coluna de quadro ou grade pagina **no servidor** (`limite/deslocamento` nas RPCs,
  `range` no PostgREST) — nunca baixa o conjunto inteiro para filtrar/fatiar no cliente.
- O **total** de uma coluna/lista vem de agregado barato: contagem exata na MESMA
  requisição paginada (`count: 'exact'` + `range`), sem trazer linhas a mais.
- **"Ver mais"** busca só a página seguinte daquela coluna, sem recarregar o resto
  (padrão da casa: `useColunasPaginadas`, 10 cards por página nos quadros).
- Filtro que decide o que aparece (ex.: "pedidos abertos" no PCP) vive **no servidor**,
  como coluna projetada ou parâmetro — nunca como filter em cima de um download completo.

### `<Tabela>` — **paginação é padrão, não opção** (RNF-02)

```tsx
<Tabela
  legenda="Cards do setor SECC"
  colunas={COLUNAS}
  dados={dados}
  chaveDe={(c) => c.id}
  porPagina={20}
  tituloCelular={(c) => c.pedido}
/>
```

- `porPagina` padrão = **20**. Nenhuma tela desta plataforma renderiza lista completa sem paginar.
- **Abaixo de `sm` a tabela vira lista de cards empilhados.** Tabela rolando na horizontal é inutilizável com luva e uma mão só.
- Colunas já presentes no `tituloCelular` recebem `ocultarNoCelular: true` para não repetir.
- `legenda` é obrigatória (vira `<caption>` para leitor de tela).
- Números e durações usam `alinhamento: 'direita'` + `tabular-nums`.

---

### Componentes do kanban (SESSAO-04) — `src/kanban/componentes/`

Componentes de DOMÍNIO (não são primitivos de `ui/`, mas seguem as mesmas regras):

- **`<CartaoUnidade>`** — o card (k/n) que percorre os setores. Mostra pedido, produto, (k/n),
  tempo na etapa (`tabular-nums`, atualizado por minuto) e o botão **Mover** (alvo ≥ 44px).
  Estado de qualidade, quando existir, entra via `<BadgeEstado>` — nunca só cor.
- **`<QuadroKanban>`** — colunas por etapa, cada uma **paginada no servidor** (SESSAO-22:
  10 cards + "Ver mais"; o contador da coluna é o total real). A coluna **Chegada**
  (etapa nula) **acabou nos setores de produção** (D-48): card que chega cai na etapa
  fila do setor, resolvida pelo banco — ela só existe no PCP/terminais, em setor de
  produção ainda sem fila cadastrada, ou transitoriamente (com aviso) se sobrou card
  sem etapa. Colunas rolam na horizontal com `snap` no celular (85vw por coluna) e
  largura fixa no desktop. **Dois gestos sempre:** drag-and-drop (`@dnd-kit/core`,
  desktop) E botão "Mover" (tablet) — nenhuma movimentação pode existir só no arrasto.
  **↪️ SESSAO-24 (D-59): revogado nos quadros** — a equipe pediu SÓ arrasto; a alternativa
  acessível passou a ser o **teclado** (espaço + setas, `KeyboardSensor`) e o toque segura
  ~200 ms antes de arrastar. Ver "Quadro por arrasto" abaixo.
- **Modais do PCP** (`ModalNovoPedido`, `ModalLiberarPedido`) e **`ModalMoverCard`** — decisão
  curta em modal (`tamanho="galpao"` quando tem lista); seleção de destino com `<Selecao>`
  `tamanho="galpao"` no fluxo de tablet.

Regra que nasceu aqui: **contador de tempo usa o `desde` projetado do evento** — o front nunca
calcula posição/tempo a partir de estado editável (M-13); o modelo fila/execução completo é da
SESSAO-05.

### Execução e linha do tempo (SESSAO-05)

- **`<CartaoUnidade>` ganhou os gestos do tempo (D-02/D-24):** na fila mostra `Xmin na fila`
  (ícone de relógio; o card há mais tempo esperando na coluna ganha ampulheta + texto em
  `atencao-texto` — nunca só cor, M-12); em execução mostra `Play` + tempo + **quem** executa
  ("você" para o próprio). Botões **Iniciar / Finalizar / Assumir** com `min-h-toque-md` (44px);
  card em execução tem borda `acao-ativa`. **↪️ SESSAO-24 (D-59):** os botões saíram — iniciar
  é soltar na etapa de início; a borda e o "quem executa" continuam.
- **`<ModalLinhaTempo>`** — o histórico legível: um bloco por permanência (setor · etapa) com
  **Fila (do setor)**, **Execução de {pessoa}** e **Total na etapa**; durações via
  `formatarDuracaoMs` (precisão de segundos abaixo de 1min). A lista crua de eventos fica
  colapsada; **evento estornado aparece riscado (`line-through`), nunca some** (RNF-05); o
  painel de estorno só aparece para líder do setor/admin e sempre nomeia o gesto que vai anular.
- **Erro de regra vem do banco e é mostrado como veio** (já em português): limite atingido,
  finalizar sem iniciar etc. — o front não duplica a validação, só exibe (M-04: a regra tem um
  dono, o trigger).
- A montagem dos segmentos é lógica pura em `src/kanban/linha-tempo.ts` — testada em Vitest,
  espelhando as views do banco.

### Pausa por líder e tempo em PCP no card (SESSAO-22 / D-48)

- **Card pausado é estado com ícone + texto, nunca só cor (M-12):** `Pause` + "Pausado há X"
  em `atencao-texto`, com quem executa ao lado. Pausar (líder/admin) aparece ao lado do
  Finalizar; pausado troca os gestos por **Retomar** (no tablet, `galpao` com PIN). O banco
  valida tudo — o front só mostra a mensagem que voltar ("finalize a urgência antes…").
  **↪️ SESSAO-24 (D-59):** Pausar/Retomar saíram dos quadros junto com os botões (arrastar
  para PARADO ou para a fila fecha o tempo); o estado "Pausado há X" continua sendo mostrado.
- **Tempo em PCP no card de unidade é do PEDIDO:** linha discreta "Pedido ficou X em PCP"
  (entrada → liberação completa; "ainda contando" enquanto houver unidade por liberar).
  A linha do tempo repete o número num bloco próprio e desconta as pausas de cada execução
  ("Xmin de pausa descontados").

### Meu Painel 2.0: filas pessoais, subtarefas e o painel privado (SESSAO-23 / D-51)

- **Três separadores** no Meu Painel (contador + até 3 itens clicáveis, mesmo cartão dos
  blocos da S14): *Delegados a mim* (tarefas do Sistema com prefixo "Sistema · ", tarefas
  delegadas e cards de produção delegados), *Meus afazeres* e *Em execução agora*.
- **Fila de prioridade**: lista numerada com **setas ▲▼ de 44px** (mobile-first — nada que
  dependa só de arrastar); a ordem é preferência do usuário (`plt_usuarios.fila_prioridade`)
  e cada item leva a etiqueta da origem ("produção" em amarelo-ação; "meu"/"delegado" em
  cinza). Reordenar grava a lista inteira de chaves (`t:{id}` / `c:{id}`) — nunca dado da tarefa.
- **Checklist de subtarefas** dentro do card da tarefa: linha expansível "Subtarefas 2/5"
  (contador fica `perfeito-*` quando completo), ○/✔ para concluir/reabrir, campo "nova
  subtarefa…" em cada nível (até dois níveis — a regra é do banco, a UI só reflete a recusa).
- **Privacidade da tarefa pessoal**: chip alternável **"privada" (EyeOff) / "visível" (Eye)**
  no card — só na tarefa que a própria pessoa criou para si. Na criação, o checkbox
  "Visível para a liderança" (desmarcado = privada, o padrão da D-51).
- **"Ver todos" no sino**: rodapé do popover leva a `/inicio/avisos` — lista completa
  paginada no servidor (`range` + `count` na mesma consulta, regra 17), filho de Início sem
  item de menu (como o Meu Perfil).
- **Meu desempenho** (`/dashboards/meu-desempenho`, primeiro filho de Dashboards, visível a
  TODO papel logado — o gate do dado é do banco: cada um só recebe o próprio): 4 Heróis de
  KPI, barras empilhadas do tempo em afazeres por dia (`--dm-serie-1` = meus, `--dm-serie-2`
  = delegados — nunca o âmbar da qualidade) e a quebra por tarefa paginada. O cabeçalho diz
  em língua de gente que a página é privada.

**↪️ Revisão do dono (23/09) — o padrão virou PREVIEW:**

- **Clicar na demanda abre o `ModalTarefa`** (em vez de navegar ou expandir o card):
  iniciar/parar o tempo, editar título/descrição, concluir/reabrir, o checklist de
  subtarefas e o chip de privacidade vivem TODOS no modal. O card na tela fica compacto
  (título, chips, contador, linha do timer). "Parar" **descarta a contagem** — o rótulo do
  botão avisa. Tarefa do Sistema no preview só explica e aponta o quadro (o gesto é o parecer).
- **Criar é botão primário no topo da tela**, abrindo modal — nada de formulário fixo no
  meio da página. Em **Meus afazeres** a tarefa nova é sempre PARA MIM (com o checkbox
  "Visível para a liderança"); **delegar mora em Afazeres do time** (filha própria de
  Início, `/inicio/afazeres-do-time`, só líder/admin), com "Para quem" (membro ou
  "Sem dono — qualquer um do setor pega").
- **Avisos têm lixeira**: ícone por aviso **já lido** + "Apagar lidas" (popover do sino e
  tela Avisos). Só o próprio e só o lido — o RLS garante (migration 34); o fato segue em
  `plt_eventos`.
- **Grade de amostras (temas do Meu Perfil)**: colunas por `auto-fill/minmax` calibradas
  pelo NOME mais largo — grade de colunas fixas quebrava o rótulo em zoom (mesma lição
  E-30: quem manda no tamanho é a largura do cartão).
- **Pausar tarefa GUARDA a contagem** (2ª rodada do dono, 23/09): `tempo_acumulado` no
  banco (RPC `plt_fn_tarefa_pausar` — leitura+escrita atômicas), "Iniciar" vira "Retomar",
  e o tempo total = acumulado + segmento aberto, sempre derivado. Na **Fila de prioridade**
  cada linha de tarefa tem **▶ iniciar/retomar** e, com o tempo rodando, **⏸ pausar** e
  **✓ finalizar** (44px, com o total ao lado).
- **Bolinha flutuante "Em execução agora"**: o bloco saiu do grid do painel e virou o
  botão redondo amarelo, meio transparente, fixo no canto de TODAS as telas (some quando
  nada conta tempo; badge com o total). O clique abre o painel rápido: tarefa rodando com
  **Pausar · Concluir · Ver detalhes** (o preview) e execução de produção com link para o
  quadro do setor.
- **Quadro do PCP sem encerrados no Tiny** (`plt_fn_cards_pedido_pcp`): entregue/não
  entregue sai da coluna de pedidos NA CONSULTA (situação normalizada — E-25); cancelado
  fica (aba própria na S24) e as unidades de pedido encerrado seguem normais nos setores.

### Qualidade nas transições (SESSAO-06 / D-09 / D-25)

- **Marcação de estado** (no `ModalMoverCard`, ao sair de setor de produção) e **parecer de
  recebimento** (`<ModalParecer>`) usam o mesmo padrão: **3 botões-rádio empilhados** com
  `<BadgeEstado>` (ícone + texto, nunca só cor — M-12) + a descrição de cada estado, alvo
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

### Menu lateral e tela do setor (SESSAO-07 / D-27 / D-28)

- **`Layout` virou MENU LATERAL:** coluna fixa grafite à esquerda no computador (`lg:`);
  gaveta com overlay atrás do hambúrguer no celular. Sino, usuário e sair vivem no rodapé
  da sidebar (e o sino também na barra fina do celular). A rota `/tablet` renderiza **sem
  navegação nenhuma** — o operador não navega, ele age.
- **`<CartaoTablet>`** (`src/tablet/`) — o card da tela do setor: dados do PRODUTO e nunca
  do cliente (D-28), tempo em fonte grande, etiqueta da etapa, ações em botões `galpao`
  (Iniciar/Finalizar/Receber com 64px; Mover/Fotos/Histórico com 56px). O card há mais
  tempo esperando ganha borda âmbar + ampulheta + texto (nunca só cor — M-12).
  **↪️ SESSAO-24 (D-59): apagado** — o modo tablet usa o `QuadroKanban` com `tamanho="galpao"`
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
- **↪️ A gaveta CONTÉM as duas barras (ajuste de 28/09/2026):** quem desliza é o
  `<aside>`; quem rola na horizontal (abaixo de `lg`), quando as duas não cabem na
  tela, é um envoltório por dentro dele. Teto da gaveta = a largura da tela
  (`max-w-[100vw]`). Fechada, sai inteira e fica **`invisible` depois do deslize**
  (`transition-[translate,visibility]`) — nada dela pega toque nem Tab. **Nunca
  `overflow` no próprio `<aside>`:** o `translate` dele faz dele o bloco de contenção
  do painel `fixed` do sino, que seria cortado. Origem: o teto de 92vw era da gaveta
  de uma barra só (SESSAO-07); com a segunda, ~38–45px da barra 2 ficavam na borda
  esquerda com a gaveta fechada, pegando o toque (E-48).
- **Camadas da gaveta aberta (celular/tablet, ajuste de 28/09/2026 — E-57):** fundo
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
- **Botão Voltar em toda tela** (`<BotaoVoltar>` na casca): volta no histórico; sem
  histórico, vai para `/inicio/meu-painel`.
- **Rotas sempre `/pai/filho`** (lei D-36): o `codigo` de `plt_setores` é o slug de
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
- **Regra nova de front (E-22):** queryKey compartilhada usa SEMPRE o mesmo fetcher da
  API — fetcher local com a mesma chave envenena o cache dos outros consumidores.

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
- **Relato da D-09 no Danificados**: bloco `bg-superficie-sutil` com "X entregou como
  {badge} por {pessoa} · data", a observação entre aspas e, se houve, "Y recebeu como
  {badge}". Resolver reusa o padrão dos **3 botões-rádio empilhados** com `BadgeEstado` +
  `DESCRICAO_ESTADO` (M-12), só quando o destino é outro setor.
- **Botão "Concluir"** (`CartaoUnidade` e `CartaoTablet`): atalho da peça pronta — abre o
  `ModalMoverCard` em `modo="concluir"` (destino fixo ESTOQUE, só a marcação do estado).
  **↪️ SESSAO-24 (D-59):** virou "Concluir produção", só na LIMPEZA E EMBALAGEM, e o destino
  é do banco (pedido vivo → Pedidos em aguardo; sem pedido/cancelado → ESTOQUE).
  O rodapé do card de unidade ficou em **duas linhas**: gestos de tempo (Iniciar/Finalizar/
  Assumir) em cima; estado, histórico, Concluir e Mover embaixo — nada estoura a borda.
- **Mapa de programação** (`MapaProgramacao`, Leaflet + tiles OSM com atribuição): marcadores
  são `CircleMarker` desenhados (sem asset de imagem) — amarelo-marca com o **número da
  parada** dentro (tooltip permanente `.plt-parada`) para os selecionados, âmbar para as
  sugestões; a rota sugerida é uma `Polyline` grafite ligando as paradas na ordem do vizinho
  mais perto (linha reta — nunca chamar de rota "calculada"). Botão **Expandir** vira o
  contêiner em `fixed inset-0` (ESC recolhe) e o mapa recebe `invalidateSize()`. A lógica de
  distância/ordem/sugestão é pura em `src/rotas/proximidade.ts`, testada no Vitest.
- **Seleção da programação**: `label` inteira clicável com `checkbox` (`accent-marca-500`),
  borda `acao-ativa` quando marcado e `atencao-borda` quando é sugestão; barra fixa no rodapé
  da lista (`sticky bottom-2`) com a contagem, a distância da rota e o botão Programar.
- **Caminhões**: grade de cartões com foto (`h-40 object-cover`, ou o ícone de caminhão em
  `superficie-sutil`); exclusão em modal `perigo`; quando o banco recusa (em uso), um segundo
  modal explica e oferece **Arquivar** como primária — o "não" do sistema sempre vem com a
  saída certa.

### Estoque completo e reposição (SESSAO-25 / D-54…D-57)

- **`<Abas>`** (`src/componentes/ui/Abas.tsx` — componente novo): visões diferentes do MESMO
  filho de rota (não são rotas — D-36). `role="tablist"`/`tab` com `aria-selected`, alvo de
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
  **nunca negativo** (D-53); o negativo vira a pílula de necessidade extrema. A lógica do
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

### Quadro por arrasto, fins de linha e cancelados (SESSAO-24 / D-58…D-62)

- **Quadros de produção são SÓ arrasto** (D-59 — pedido da equipe): o `<CartaoUnidade>`
  perdeu Iniciar/Pausar/Retomar/Finalizar/Assumir/Mover; ficaram linha do tempo, fotos e,
  só onde o setor conclui (LIMPEZA E EMBALAGEM — `setorConcluiProducao`), **"Concluir
  produção"**. Alça `GripVertical` avisa que o card se arrasta; botões dentro do card param
  a propagação do teclado para não disparar o arrasto. Mouse: 8px de distância; toque:
  segura ~200 ms (tolerância 8px); **teclado: espaço + setas** — a alternativa acessível.
- **O banco decide o gesto** (`plt_fn_soltar_card`); a tela só sabe antes o que precisa
  perguntar — `src/kanban/arrasto.ts` (espelho de `fn_etapa_inicio`, testado no Vitest):
  soltar no **início** → inicia (o parecer pendente abre antes); soltar em etapa que
  **encaminha** → `ModalMoverCard` modo `encaminhar` (os 3 estados — D-09); o resto → move.
- **Coluna que encaminha:** borda tracejada, sempre vazia, "Solte aqui para mandar para X"
  (o card nunca fica nela). **Coluna de início:** aviso "soltar aqui começa o tempo".
- **`ModalMoverCard`** virou o modal do gesto: `encaminhar` (marcação obrigatória) ou
  `concluir` (só 🟢, já marcado; o texto diz o destino: Pedidos em aguardo, ou ESTOQUE
  sem dono para reposição e pedido cancelado).
- **Modo tablet** (`TelaSetor`): o MESMO `QuadroKanban` com `tamanho="galpao"` (sem
  cliente — D-28); ao soltar ou concluir, o `ModalPinOperador` pergunta quem fez ANTES.
  Os botões do cabeçalho (Trocar setor · Sair) também têm 44px (achado da F-07).
- **Pedidos em aguardo em `<Abas>`:** "Pedidos (n)" · "Produtos reservados (n)"
  (`?aba=produtos`); as contagens vêm de UMA porta (`plt_fn_aguardo_contagens`) e batem
  por construção. Produto reservado: SKU + "Pedido N (k/n)", selo do estado quando não é
  🟢, "veio do estoque", "em aguardo há X". Botões da lista com 44px.
- **PCP em `<Abas>`:** "Aguardando liberação" · "Cancelados" (`?aba=cancelados`) — lista
  paginada (20) com busca, carregada só ao abrir (regra 17); cada pedido mostra quantas
  peças estão em produção, no estoque e nas ROTAS.
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
- **↪️ Ajuste do Frete (D-63, 28/09):** frete/entrega não vira card e some da lista de
  liberação (a regra é do banco — a tela só mostra o que a porta devolve). O **pedido sem
  nada a produzir** (só frete) aparece em Pedidos em aguardo já com o selo "Pedido
  completo" + a pílula de texto **"Nada a produzir"** (`superficie-sutil`, texto — nunca só
  cor), barra de progresso cheia e **sem "Ver unidades"** (não há unidade); o Lançar para
  ROTAS é o de sempre. Na Expedição, "Nada a produzir" entra no lugar de "0 de 0 no fim de
  linha". Teste de componente: `src/paginas/PedidosAguardo.test.tsx`.

### Chat interno (SESSAO-26 / D-65…D-68) — `src/chat/`

- **Balão (`BalaoChat`)**: botão redondo de 56px, `bg-superficie` + borda grafite + sombra (não é o amarelo — não é ação nem marca), ícone de balão e o **badge de não lidas** em `danificado-forte` com número (`99+` a partir de 100 — teto do banco). Nasce **ao lado da bolinha de execução** (88px da direita; no celular, 80px de baixo, acima da faixa do polegar) e **se arrasta** por pointer events (`touch-action: none`; arrasto só depois de 6px — antes é toque). A posição fica no `localStorage` por pessoa (`dm-chat-balao:{id}`), sempre inteira na tela. Some no `/tablet` e na própria tela do Chat.
- **Painel compacto**: ancorado à BORDA DA PÁGINA (lição do sino — nunca no balão, que pode estar em qualquer lugar): no computador `right-4 bottom-4`, 24rem × até 36rem; no celular ocupa a tela abaixo da barra do topo. Cabeçalho com "abrir em tela cheia" (`/inicio/chat?c=`) e fechar (ESC fecha).
- **Lista de conversas**: linha de 56px com avatar (foto/iniciais; `#` para canal; megafone com borda `acao-ativa` para os Avisos gerais), título em negrito quando há não lida, prévia "Você: … / Ana: …" (na particular só o texto), hora ("14:32", "ontem", "27/09") e a pílula de não lidas. Conversa aberta: borda esquerda `acao-ativa`. **5 por página**: a próxima ao rolar até o fim OU no botão "Ver mais conversas" (nada de carregar sozinho).
- **Conversa**: bolhas — a **minha** à direita em `superficie-inversa`/`texto-inverso`; as dos outros à esquerda em `superficie-sutil` com borda, avatar e (canal/avisos) o nome no começo de cada sequência; **aniversário** é um cartão centralizado com `Cake` e borda `acao-ativa`, assinado "Sistema". Separador de dia ("Hoje", "Ontem", "27/09/2026") no fuso de Natal. **10 por página**: "Ver mensagens anteriores" (ou rolar ao topo) traz a página de antes sem pular o que se lê. Compositor: `textarea` que cresce até 128px, **Enter envia / Shift+Enter quebra linha**, botão enviar de 44px. Sem permissão de escrever, o compositor vira uma linha explicando por quê (avisos: "Só quem o admin liberou escreve…").
- **Pessoas / Quem escreve** (`ModalMembros`): lista de 10 em 10 com "Ver mais"; quem administra tira (ícone `UserMinus`, 44px) e põe (seletor com busca no servidor, múltipla escolha com checkbox). Nos Avisos gerais, o mesmo modal lista só quem o admin liberou.
- **Regras de dado (lei do dono — D-67):** um canal de websocket por pessoa + um por conversa aberta, os dois PRIVADOS, geridos por `src/chat/canais.ts` (um canal por tópico com contagem de quem ouve — `supabase.channel(t)` devolve o canal que já existe e sair é assíncrono; reaproveitar um canal "saindo" faz o `subscribe` não fazer nada, calado). **Assina antes de ler** (nada escapa entre ler e ouvir). O cache do chat leva a pessoa na chave e é apagado ao sair da conta. Sinal do websocket muda a lista e o badge **no cache** (`src/chat/cache.ts`, lógica pura testada) — sem reler. `staleTime: Infinity`, sem refetch por foco/reconexão/intervalo.

### Estoque enxuto: Top 20+, contagem da logística, configurações e foto (ajuste de 28/09 / D-70…D-74)

> ↪️ Revisa a seção "Estoque completo e reposição" acima: as abas agora são **Top 20+ · Matéria-prima e insumos · Configurações**; o cartão grande de 4 números e a linha do Tiny saíram do cartão.

- **`<Dica>`** (`src/componentes/ui/Dica.tsx` — componente novo): o **"i" de informação** com o
  balãozinho, no lugar de texto explicativo embaixo de título (pedido do dono). Botão redondo de
  44px com `Info`; abre ao passar o mouse, focar ou tocar; fecha no ESC, ao sair o mouse ou ao
  tocar fora. `role="tooltip"` + `aria-describedby`. **O balão ancora no PAI posicionado** (ponha
  `relative` no cabeçalho) — no celular ele ocupa a largura do cabeçalho e nunca estoura a borda
  (lição da F-07: overlay se ancora na página, não no elemento).
- **`<Abas variante="quadrados">`**: as abas de uma tela como **quadrados de 44px só com o ícone,
  no canto superior direito**, na mesma linha do título. Sobem 2px com sombra ao passar o mouse
  (a microinteração da casa, D-27) e mostram o nome num balãozinho escuro embaixo (`group-hover`/
  `group-focus-visible`, ancorado à direita); a ativa é preenchida (`bg-acao`). O nome também vai
  no `aria-label` — toda aba precisa de ícone. Embaixo do título, uma linha curta diz onde a pessoa
  está ("Top 20+ · os mais vendidos primeiro") — no celular não existe passar o mouse.
- **Cartão de produto com foto** (`CartaoProdutoEstoque`): **a foto em cima** (`h-40`,
  `object-cover`, ou o ícone `Package` em `superficie-sutil`), com o **rank** numa pílula escura no
  canto (1º, 2º…) e o botão de câmera (44px, canto inferior direito) para quem pode trocar;
  embaixo: nome (2 linhas no máximo), SKU e vendas de 90 dias em `text-xs`, o número do estoque em
  `text-xl` com "em estoque", o mínimo em `text-xs` à direita, o sinal (pílula com ícone + texto:
  "Sem estoque" `danificado-*`, "Faltam N para o mínimo" `atencao-*`, "No mínimo" `perfeito-*`,
  sem mínimo e zerado em `superficie-sutil`) e os gestos **Entrada/Baixa** (secundários, 44px).
  Grade `repeat(auto-fill,minmax(14.5rem,1fr))` — quem manda é a largura do conteúdo, não a da
  janela (E-30). **Tocar na foto abre o detalhe** (modal `galpao`): foto grande, números, Entrada/
  Baixa/Contagem, peça por peça (só carrega ao abrir) e a referência do Tiny em `text-xs`.
- **Foto de produto** (`FotoProduto`): reduzida no aparelho antes de subir (`src/lib/imagem.ts` —
  lado maior 1280px, JPEG 0,82; se falhar, sobe a original), gravada na pasta do SKU
  (`pastaDoProduto`, a mesma regra do tablet) e o caminho vai para o produto — a lista traz o
  caminho numa consulta só (nunca listar o storage por cartão).
- **Movimentar estoque** (`ModalMovimentarEstoque`): `FiltroPill` com Entrada · Baixa · Contagem,
  uma frase do que cada uma é, o campo numérico grande e a **prévia antes de confirmar** ("Ficam 5
  no estoque", "Saem 3 peças (de 5 para 2)", "Só há 2 — não dá para dar baixa em 3") — lógica pura
  em `previaMovimento` (Vitest); o botão de confirmar fica desligado enquanto a prévia não vale.
- **Configurações** (`PainelConfiguracoes`): o cartão **Galpão** (capacidade em peças + 4 números:
  peças no estoque, reservadas, soma dos mínimos — com aviso quando passa da capacidade —, soma
  das sugestões); a lista por produto com o rank redondo, a foto pequena, o campo **Mínimo**
  (vazio = o do Tiny, que aparece no placeholder), a **Sugestão** (borda de ação quando difere) e
  "Usar"; **"Usar todas as sugestões"** em dois toques inline (caixa `atencao-*` explicando).

### Controle de tempo do admin (SESSAO-07 / D-29)

- Página `/administracao/tempo` (só admin): horário de funcionamento por setor/pessoa
  (chips de dia da semana + hora início/fim), desligar/religar o tempo agora (pausa
  aberta em faixa âmbar), e a **correção retroativa** em seção emoldurada de vermelho —
  é o "botão de risco", com motivo registrado. Texto da tela repete a regra de ouro:
  nada altera o que já foi registrado; o desconto é só no cálculo.

### Telas do bloco noturno (SESSÕES 09–12)

- **Selos de pedido** (SESSAO-09): "Cancelado no Tiny" em `danificado-fundo/texto` e
  "Alterado no Tiny após a liberação" em `atencao-fundo/texto` — pílula com ícone + texto
  (nunca só cor), no PCP e na Expedição.
- **Dashboards** (SESSAO-10): tabelas com o componente `Tabela` (paginação padrão);
  durações sempre `tabular-nums`, a ÚTIL em destaque e a bruta no `title` (passar o
  mouse); barras de proporção fila/execução em CSS puro (âmbar = fila/gargalo, verde =
  execução) — nenhuma biblioteca de gráfico nova. Chips de widgets e de dias seguem o
  padrão de checkbox-botão (borda `acao-ativa` + `bg-acao` quando ligado).
- **ROTAS** (SESSAO-11): o card de entrega replica o formato do card real do ClickUp
  (cliente, endereço em linha, complemento, OBS, botões WhatsApp/Mapa); "pronta para
  entrega" ganha borda `acao-ativa` e selo amarelo; confirmação de entrega em DOIS
  toques inline (sem modal).
- **Chave de API** (SESSAO-11): o valor aparece UMA vez num painel de borda `acao-ativa`
  com botão Copiar — nunca mais é exibido.
- **Afazeres** (SESSAO-12): "carga por pessoa" em pílulas com contagem `tabular-nums`;
  reatribuição por `Selecao` inline na linha do card; tarefa em andamento com borda
  `acao-ativa`; card delegado no tablet mostra "para {nome}" (ícone + texto).

## 5. Regras de escrita da interface

- **UI 100% em português.**
- **Termos da equipe não se traduzem nem se "arrumam":** SECC, FITAMENTO, FURAÇÃO, PCP, ROTAS, "rota". A interface fala a língua do galpão (regra 12 do `CLAUDE.md`).
- Setores aparecem em **caixa alta**, como no ClickUp que a equipe já usa.
- Mensagem de erro diz **o que fazer**, não só o que quebrou.

## 6. Convenção de nomes no código

- **Domínio e componentes em português:** `Botao`, `Campo`, `variante`, `tamanho`, `carregando`.
- **Convenções do React continuam em inglês:** hooks `use*` (`useNotificacao`), props padrão do DOM (`onClick`, `children`, `className`). Hook é vocabulário do framework, não do negócio — e o lint exige o prefixo.
- Arquivos de componente em `PascalCase.tsx`; utilidades e constantes em `kebab-case.ts`.

## 7. Acessibilidade — o mínimo inegociável

1. Contraste de texto ≥ 4,5:1 (o par amarelo + `grafite-950` resolve o botão primário).
2. Alvo clicável ≥ 44px.
3. Foco sempre visível — o `:focus-visible` global desenha contorno de 3px; **nunca** remova com `outline: none`.
4. Estado nunca só por cor.
5. Todo campo com rótulo associado.
6. Toda ação só-ícone com `aria-label`.

## 8. Estrutura de pastas

```
src/
  componentes/
    ui/            componentes base do design system
    Layout.tsx     casca da aplicação (menu lateral + conteúdo — D-27)
    Marca.tsx      assinatura da marca
  estilos/
    tokens.css     camada 1 (paleta) + camada 2 (semântica)
    global.css     Tailwind, @theme, base e utilidades
  lib/             utilidades puras (cn…)
  paginas/         uma pasta/arquivo por tela
  teste/           setup do Vitest
docs/
  execucao/        memória de execução de cada sessão (regra 8)
_docs/Plataforma/
  PLT - Modelo de Sistema.md   ESTE documento (fonte única — D-27)
```

## 9. O que ainda está em aberto

- **Modo escuro** (Q-30): os tokens já existem em `[data-tema='escuro']` e o `@custom-variant escuro` está definido — falta a decisão do dono e um alternador. Nenhum componente precisa mudar.
- **Logo oficial** em arquivo: hoje `<Marca />` é tipográfica.
- **Densidade da tela do setor**: será calibrada na SESSAO-07, com o tablet real na mão.
