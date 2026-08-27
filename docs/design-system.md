# Design System — Plataforma de Produção Domoby

> Documento de estilização do repositório (RNF-01). **Toda tela nova segue este documento.**
> Componente novo só quando não existir equivalente aqui — e componente novo entra nesta página junto com a regra de uso.
> A versão viva e clicável está em **`/design`** (`npm run dev` → http://localhost:5173/design).

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
- **`<QuadroKanban>`** — colunas por etapa + a coluna fixa **Chegada** (etapa nula). Colunas
  rolam na horizontal com `snap` no celular (85vw por coluna) e largura fixa no desktop.
  **Dois gestos sempre:** drag-and-drop (`@dnd-kit/core`, desktop) E botão "Mover" (tablet) —
  nenhuma movimentação pode existir só no arrasto.
- **Modais do PCP** (`ModalNovoPedido`, `ModalLiberarPedido`) e **`ModalMoverCard`** — decisão
  curta em modal (`tamanho="galpao"` quando tem lista); seleção de destino com `<Selecao>`
  `tamanho="galpao"` no fluxo de tablet.

Regra que nasceu aqui: **contador de tempo usa o `desde` projetado do evento** — o front nunca
calcula posição/tempo a partir de estado editável (M-13); o modelo fila/execução completo é da
SESSAO-05.

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
    ui/            componentes base do design system (o que /design mostra)
    Layout.tsx     casca da aplicação (topo grafite + navegação)
    Marca.tsx      assinatura da marca
  estilos/
    tokens.css     camada 1 (paleta) + camada 2 (semântica)
    global.css     Tailwind, @theme, base e utilidades
  lib/             utilidades puras (cn…)
  paginas/         uma pasta/arquivo por tela
  teste/           setup do Vitest
docs/
  design-system.md este documento
  execucao/        memória de execução de cada sessão (regra 8)
```

## 9. O que ainda está em aberto

- **Modo escuro** (Q-30): os tokens já existem em `[data-tema='escuro']` e o `@custom-variant escuro` está definido — falta a decisão do dono e um alternador. Nenhum componente precisa mudar.
- **Logo oficial** em arquivo: hoje `<Marca />` é tipográfica.
- **Densidade da tela do setor**: será calibrada na SESSAO-07, com o tablet real na mão.
