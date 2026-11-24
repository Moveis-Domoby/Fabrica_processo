---
titulo: "Modelo de sistema — Fundamentos Tokens e Componentes Base"
tipo: design
assunto: fundamentos
atualizado: 2026-11-18
tags: [plataforma, design-system, modelo-de-sistema, design/fundamentos]
---

# 🧩 Design - Fundamentos Tokens e Componentes Base

> Parte de [[PLT - Modelo de Sistema]], movida em 18/11/2026 sem reescrever (a numeração das seções é a do documento original). Padrão novo deste assunto entra **aqui**.

## 1. Para quem esta interface é

Antes de qualquer regra visual: **quem mais usa esta plataforma está em pé, no galpão, com as mãos sujas, num tablet compartilhado** ([[D-006 - Dispositivos tablet PC fixo por setor E celular pessoal|D-06]]). Isso dita quase tudo o que vem abaixo — botão grande, contraste alto, nada de precisão de mira, nada que dependa de passar o mouse.

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

O estado "🟡 atenção" da [[D-009 - Qualidade em 3 estados em TODA transicao com dupla atestacao|D-09]] é renderizado em **âmbar-laranja**, não em amarelo. Dois amarelos com significados diferentes na mesma tela, num galpão com luz ruim, é erro esperando acontecer.

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

O texto do 🟡 são **as palavras do dono** ([[D-009 - Qualidade em 3 estados em TODA transicao com dupla atestacao|D-09]] / Q-16) e está em `src/componentes/ui/estados.ts` como `DESCRICAO_ESTADO`. **Não reescreva** — se precisar mudar, é decisão de produto.

> **Estado nunca é comunicado só por cor.** `<BadgeEstado>` sempre desenha ícone + texto. Daltonismo é comum e o galpão tem iluminação ruim.

### Cores de série dos gráficos (SESSAO-20 — a SESSAO-16 herda)

Gráfico e indicador **nunca** usam cor fixa de paleta (`text-emerald-500`): usam
os tokens de série, que acompanham o tema escolhido no Meu Perfil.

| Token | Papel |
|---|---|
| `serie-1` | **é a cor de AÇÃO do tema** — o número principal acompanha a identidade (amarelo no padrão, esmeralda nos temas esmeralda) |
| `serie-2` … `serie-6` | as demais séries, na ordem de uso; clareiam automaticamente nos temas escuros |
| `serie-fila` / `serie-execucao` | **(SESSAO-16)** o par fila × execução dos dashboards de produção — azul `#2563eb` e âmbar `#b8851e` do LEIA-ME de `docs/inspiracao/dashboards/`, **fixos em todos os temas** (a `serie-1` no esmeralda vira verde, que é exclusivo da qualidade); clareiam nos temas escuros sem mudar de identidade |

Duas regras que vêm de [[Memoria - Front Telas e React 1#A-8|A-08]] e [[Memoria - Modelos Formulas e Possibilidades#M-12|M-12]]:

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
- **↪️ 15/10:** na janela do card, o **nome só no topo** (o título da janela) — "Renomear" é um botão fantasma na fileira de cima.
- **↪️ SESSAO-31:** `tamanho="tela"` — a janela grande (a janela do card): ocupa a tela no celular, larga no computador, corpo em duas colunas (`lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]`) que rolam cada uma por si. É a exceção do "uma decisão curta": é uma ficha, com link próprio.

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
  (padrão da casa desde a SESSAO-31: `useQuadro` — o quadro inteiro numa requisição,
  10 cards por coluna, "Ver mais" por cursor e ao vivo pelo canal do setor; o antigo
  `useColunasPaginadas`, uma consulta por coluna com relógio, saiu).
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

## A janela de confirmação (padrão do Comercial — SESSAO-54, [[D-351 - A janela de confirmacao do Comercial pergunta no titulo e|D-351]])

- **Pergunta no título, aviso no corpo** (o que acontece), **"Voltar" + o verbo do gesto** ("Excluir", "Parar o disparo"). Vermelho para destruir (excluir, encerrar, remover); amarelo para "parar". Durante o gesto a janela fica aberta com o botão girando.
- Hoje é um componente só do Comercial (`src/comercial/components/ModalConfirmacao.tsx`); se o dono gostar, sobe para `componentes/ui` numa sessão que possa mexer na casa. Nada de `confirm()`/`alert()` do navegador: aviso é o da casa.
