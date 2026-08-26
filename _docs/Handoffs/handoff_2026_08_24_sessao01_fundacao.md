---
titulo: Handoff — SESSAO-01 Fundação do Repo e Design System
tipo: handoff
data: 2026-08-24
atualizado: 2026-08-24
tags: [handoff, sessao, plataforma, design-system]
---

# 📋 Handoff — SESSAO-01 · Fundação do Repo e Design System

**Branch:** `sessao-01-fundacao` · **Repositório:** `contatodomoby/Fabrica_processo`
**Demanda:** [[SESSAO-01 - Fundacao do Repo e Design System]] · **Memória de execução:** `docs/execucao/SESSAO-01.md`

## 1. Objetivo da sessão

Criar a fundação do repositório da plataforma: app React rodando e **design system documentado** — a base de estilização que todas as sessões seguintes vão seguir (RNF-01). Nada de tela de negócio.

No checkpoint de abertura o dono definiu, nas palavras dele: *"construa dentro da pasta atual domoby-fabrica, junto ao \_docs, porém não dentro da pasta \_docs"* e *"a paleta de cores domoby é amarelo assim como a logo"*. A stack ficou por conta do Claude Code, como manda a D-15.

## 2. O que foi feito

### Front

- **App React 19 + TypeScript + Vite** na raiz do repositório, ao lado de `_docs/`.
- **Tokens do design system** em `src/estilos/tokens.css`, em duas camadas: paleta bruta (amarelo Domoby `#F1C24B` + grafite `#5A585C`, ambos tirados da logo) e camada semântica (`--dm-fundo`, `--dm-acao`, `--dm-texto`…). Trocar tema = trocar a camada semântica, sem tocar em componente.
- **As 3 cores de qualidade da D-09** já nascem como token: `perfeito-*`, `atencao-*`, `danificado-*`.
- **Tema escuro preparado** (`[data-tema='escuro']`) mas **não habilitado** — Q-30 segue em aberto.
- **Componentes base** em `src/componentes/ui/`: `Botao`, `Campo`, `Selecao`, `Modal`, `Notificacao` (toast), `BadgeEstado`, `Tabela` e `Paginacao`.
- **`Tabela` com paginação embutida por padrão** (20 itens) — RNF-02 virou propriedade do componente, não disciplina de quem usa. Abaixo de 640px ela vira lista de cards.
- **Página `/design`** mostrando tudo vivo e clicável.
- **`docs/design-system.md`** — quando usar cada componente, regra de paginação, densidade por público, acessibilidade de chão de fábrica, convenção de nomes.
- **`CLAUDE.md` na raiz**, cópia fiel da nota do cofre.
- **`README.md`** com clone → instalar → rodar.
- **8 testes** (Vitest + Testing Library) cobrindo paginação, estado de carregamento do botão e a regra "estado nunca só por cor".

### Banco

Nada. Fora do escopo desta demanda — e **nenhum SQL foi escrito ou aplicado em lugar nenhum**.

### Edge Functions

Nada.

## 3. Decisões tomadas

| Decisão | Alternativa descartada | Por quê |
|---|---|---|
| React 19 + TS + Vite (D-15) | Next.js | a plataforma é app interno atrás de login; SSR/SEO não paga o próprio custo |
| Tailwind v4 com tokens próprios | shadcn/ui, MUI | ambos trazem identidade visual de terceiro; a Domoby tem a dela |
| Radix UI só como primitivo | escrever modal/select do zero | acessibilidade (foco, teclado, ARIA) é onde componente caseiro erra feio |
| TanStack Query já na fundação | adicionar quando precisar | cache de fila de setor é arquitetura; enfiar depois é refatoração cara |
| **Amarelo da marca = ação; 🟡 de qualidade = âmbar-laranja** | usar o mesmo amarelo nos dois | dois amarelos com sentidos diferentes num galpão de luz ruim é erro esperando acontecer |
| Amarelo sempre com texto grafite | amarelo com texto branco | branco sobre amarelo dá ~1,8:1 de contraste — ilegível |
| Tabela vira cards no celular | tabela com rolagem horizontal | rolar tabela de lado com luva e uma mão só não funciona (D-06) |
| Fontes embarcadas no build | Google Fonts por link | a interface não pode depender da internet do galpão |
| Hook `useNotificacao` (e não `usarNotificacao`) | tudo em português | `use*` é convenção do React e o lint exige; domínio e interface seguem 100% em português |

## 4. Bugs

### Resolvidos
Nenhum — repositório novo.

### Descobertos
Nenhum problema de produção. Duas armadilhas de ferramenta encontradas e registradas na memória de aprendizado (E-09 e A-07).

## 5. Arquivos alterados

```
CLAUDE.md  README.md  .gitignore  .prettierrc  .prettierignore  .npmrc
package.json  package-lock.json
tsconfig.json  tsconfig.app.json  tsconfig.node.json
vite.config.ts  eslint.config.js  index.html  public/favicon.svg
docs/design-system.md
docs/execucao/SESSAO-01.md
src/main.tsx  src/App.tsx
src/estilos/tokens.css  src/estilos/global.css
src/lib/cn.ts
src/componentes/Layout.tsx  src/componentes/Marca.tsx
src/componentes/ui/{Botao,Campo,Selecao,Modal,Notificacao,BadgeEstado,Tabela,Paginacao}.tsx
src/componentes/ui/{estados,notificacao-contexto,index}.ts
src/componentes/ui/{Botao,BadgeEstado,Tabela}.test.tsx
src/paginas/Inicio.tsx  src/paginas/DesignSystem.tsx
src/teste/setup.ts
```

## 6. Impacto nos números visíveis

Nenhum. Não há dashboard nem dado real nesta entrega — os dados da tabela de exemplo são fictícios e existem só para provar que a paginação funciona.

## 7. Notas do cofre atualizadas

- [[CLAUDE - Regras do Claude Code (repo)]] — caminho do cofre corrigido (era `C:\Users\wccau\Domoby - fabrica\_docs\`, o real é `C:\Users\wccau\Domoby\Domoby - fabrica\_docs\`)
- [[PROMPT - Bloco 1 (Sessoes 01 a 05)]] — mesmo caminho corrigido
- [[PLT - Memoria de Aprendizado]] — E-09, A-07, A-08, M-12, F-07
- [[PLT - Decisoes de Produto]] — D-15 ganhou a confirmação da stack escolhida
- [[000 - ORDEM DAS SESSOES]] — SESSAO-01 marcada como entregue
- [[000 - MAPA DO PROJETO]] — este handoff linkado

## 8. Ficou pendente

- **Screenshots da `/design`.** O painel de navegador da sessão não estava sendo exibido e a captura falhou. A verificação foi feita medindo o DOM real nos dois viewports (tabela na seção 9). Vale tirar as fotos com o tablet e o celular de verdade — que é o teste que interessa mesmo.
- **Logo oficial em arquivo.** Hoje `<Marca />` reconstrói a assinatura com tipografia (Poppins). Quando o PNG/SVG entrar em `public/`, o componente passa a usá-lo sem mudar a API.
- ~~**Push e PR bloqueados.**~~ ✅ **Resolvido em 24/08:** era a credencial pessoal do GitHub tentando alcançar um repositório privado da conta `contatodomoby`. O dono ajustou o acesso, a branch e a `main` foram publicadas, e **o dono pediu o merge direto na `main`** em vez de PR (desvio consciente da regra crítica 1, registrado na memória de execução). Merge `e977aa4`. Texto original do bloqueio, para histórico: `git push` respondeu `Repository not found` para `https://github.com/contatodomoby/Fabrica_processo.git` — e a `main` local não tem branch de rastreamento, o que indica repositório criado localmente com o remoto adicionado à mão. Os 8 commits estão íntegros na branch `sessao-01-fundacao`; assim que o repositório existir no GitHub (ou a credencial da conta `contatodomoby` estiver no Git Credential Manager), `git push -u origin sessao-01-fundacao` resolve.
- **Proteção da branch `main`** precisa ser ligada no GitHub pelo dono (Settings → Branches → Add rule): não dá para fazer isso pelo código, e é a regra crítica 1 do `CLAUDE.md`.

### Aguardando decisão de negócio

- **Q-30 · Modo escuro:** entra ou não? Os tokens já existem; falta a decisão e um alternador.
- **Q-28 · ROTAS é setor terminal na plataforma?** Precisa de resposta **antes da SESSAO-04**.
- **Projeto Supabase de desenvolvimento** (D-15) precisa existir **antes da SESSAO-02**.

### Próximo passo sugerido

Revisar e aprovar o PR desta branch, ligar a proteção da `main`, criar o projeto Supabase de dev — e então abrir a sessão da [[SESSAO-02 - Banco e Dominio no Supabase]].

## 9. Como validar

Passo a passo, do zero:

```bash
git clone https://github.com/contatodomoby/Fabrica_processo.git
```

```bash
git checkout sessao-01-fundacao
```

```bash
npm install
```

```bash
npm run dev
```

Abra **http://localhost:5173/design** e confira:

| # | O que conferir | Esperado |
|---|---|---|
| 1 | Topo da página | barra grafite com a marca em amarelo, como na logo |
| 2 | Seção "Estados de qualidade" | 3 selos com **ícone + texto**; o de atenção é âmbar-laranja, não amarelo |
| 3 | Texto do estado de atenção | *"Levemente danificado, porém ainda dá pra seguir e tentar consertar"* (palavras do dono, D-09) |
| 4 | Botões | o `galpão` tem 64px de altura — dá para tocar com a lateral do dedo |
| 5 | "Abrir modal" | abre centralizado no desktop; **sobe do rodapé** ao estreitar a janela |
| 6 | "Notificar atenção" | aparece toast âmbar; no celular ele vem do **topo** |
| 7 | Tabela | mostra "Mostrando 1–8 de 27"; **Próxima** vai para 9–16; **Anterior** volta |
| 8 | Estreite a janela abaixo de 640px | a tabela **vira lista de cards** e a página **não rola de lado** |
| 9 | Navegue só pelo teclado (Tab) | todo elemento focado mostra contorno visível |

E, no terminal:

```bash
npm run build && npm run lint && npm run test
```

Esperado: build sem erro, lint limpo, **8 testes passando**.

### Verificação já executada nesta sessão

| Verificação | Resultado |
|---|---|
| `tsc -b` / `lint` / `vitest` | ✅ sem erro · 0 aviso · 8 testes |
| `npm run build` | ✅ JS 409 kB (130 kB gzip), CSS 29 kB (7 kB gzip) |
| Console do navegador | ✅ nenhum erro |
| Tablet 768×1024 | ✅ tabela real; paginação 1–8 → 9–16 de 27 |
| Celular 375×812 | ✅ lista de cards; `scrollWidth` = `clientWidth` = 375 (zero rolagem horizontal) |
| Alvos de toque medidos no DOM | ✅ paginação 44px · botão galpão 64px |
| Botão primário | ✅ `rgb(241,194,75)` com texto `rgb(28,27,30)` — o amarelo da logo, contraste ~10:1 |

## Ver também

[[SESSAO-01 - Fundacao do Repo e Design System]] · [[PLT - Decisoes de Produto]] · [[CLAUDE - Regras do Claude Code (repo)]] · [[000 - ORDEM DAS SESSOES]]
