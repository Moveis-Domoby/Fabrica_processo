---
titulo: "Memória de execução — SESSAO-01 (Fundação do Repo e Design System)"
sessao: 01
branch: sessao-01-fundacao
data: 2026-08-24
---

# 🧾 Memória de execução — SESSAO-01

> Regra 8 do `CLAUDE.md`: este arquivo é escrito **enquanto** a sessão acontece, não no fim.
>
> **Nota de data:** as entradas abaixo estão marcadas como 2026-08-24 porque seguiram a data das decisões do cofre. A execução em si aconteceu em **25 e 26/08/2026**. O nome do handoff foi mantido como está para não quebrar os links já criados.
> Demanda: `_docs/Plataforma/Demandas/SESSAO-01 - Fundacao do Repo e Design System.md`

## Contexto de entrada

- Repositório já conectado pelo dono: `https://github.com/contatodomoby/Fabrica_processo.git`, branch `main` com o cofre `_docs/` versionado.
- Branch de trabalho: `sessao-01-fundacao` (regra crítica 1 — nunca commitar na main).
- Respostas do dono no checkpoint de abertura:
  - **Local do código:** raiz do repositório atual, ao lado de `_docs/` — nunca dentro de `_docs/`.
  - **Identidade visual:** paleta Domoby, amarelo da logo (amarelo sobre grafite).
  - **Stack:** aprovada ao mandar construir (D-15).

## Task list (espelho da demanda)

- [x] Branch `sessao-01-fundacao`
- [x] `CLAUDE.md` na raiz (cópia fiel da nota do cofre)
- [x] `.gitignore`, Prettier, ESLint
- [x] Scaffold React + TS + Vite rodando local
- [x] Tokens do design system (marca, grafite, qualidade, tipografia, espaçamento, toque)
- [x] Componentes base: Botao, Campo, Selecao, Modal, Notificacao, BadgeEstado, Tabela com paginação
- [x] Página `/design` com todos os componentes vivos
- [x] `docs/design-system.md`
- [x] `README.md`
- [x] Testes (Vitest + Testing Library) — 8 testes, 3 arquivos
- [x] Verificação em viewport de celular (375px) e tablet (768px)
- [x] Handoff em `_docs/Handoffs/` + links no mapa e no índice de sessões
- [x] `PLT - Memoria de Aprendizado` atualizada
- [x] Revisão do dono → **merge na `main`** (o dono aprovou no checkpoint e pediu o merge direto, dispensando o PR nesta sessão) + push da `main` e da branch da sessão.

## Decisões técnicas tomadas nesta sessão

| # | Decisão | Motivo |
|---|---|---|
| T-01 | **React 19 + TypeScript + Vite** | D-15; TypeScript corta a classe de erro mais cara do projeto (nome de campo/coluna errado — ver E-05 da memória) |
| T-02 | **Tailwind CSS v4 com tokens próprios em 2 camadas** | design system nosso; trocar tema = trocar a camada semântica, sem tocar em componente |
| T-03 | **Radix UI como primitivo de modal/select/toast** | acessibilidade (foco, teclado, ARIA) pronta e correta; visual 100% nosso |
| T-04 | **TanStack Query já na fundação** | cache/refetch de fila de setor é arquitetura, não detalhe — enfiar depois seria refatoração cara |
| T-05 | **Amarelo da marca = ação; 🟡 de qualidade = âmbar-laranja** | dois amarelos com sentidos diferentes num galpão de luz ruim é erro esperando acontecer |
| T-06 | **Amarelo sempre com texto grafite-950** | amarelo + branco dá ~1,8:1 de contraste (ilegível); amarelo + grafite dá ~10:1 |
| T-07 | **Tabela vira lista de cards abaixo de 640px** | tabela rolando na horizontal é inutilizável com luva e uma mão só (D-06) |
| T-08 | **Fontes embarcadas no build (Inter + Poppins via fontsource)** | a interface não pode depender da internet do galpão para carregar fonte |
| T-09 | **Domínio em português, convenções do React em inglês** | `useNotificacao` e não `usarNotificacao`: hook é vocabulário do framework; o lint exige o prefixo `use` |
| T-10 | **npm como gerenciador** | pnpm não está instalado na máquina do dono; menos atrito |
| T-11 | **Paginação padrão de 20 itens embutida na `Tabela`** | RNF-02 vira propriedade do componente, não disciplina de quem usa |

## Arquivos criados

```
CLAUDE.md                              cópia da nota do cofre (regras de conduta)
README.md                              como rodar, stack, estrutura
.gitignore .prettierrc .prettierignore .npmrc
package.json package-lock.json
tsconfig.json tsconfig.app.json tsconfig.node.json
vite.config.ts eslint.config.js
index.html public/favicon.svg
docs/design-system.md
docs/execucao/SESSAO-01.md
src/main.tsx src/App.tsx
src/estilos/tokens.css src/estilos/global.css
src/lib/cn.ts
src/componentes/Layout.tsx src/componentes/Marca.tsx
src/componentes/ui/Botao.tsx Campo.tsx Selecao.tsx Modal.tsx
src/componentes/ui/Notificacao.tsx notificacao-contexto.ts
src/componentes/ui/BadgeEstado.tsx estados.ts
src/componentes/ui/Tabela.tsx Paginacao.tsx index.ts
src/componentes/ui/Botao.test.tsx BadgeEstado.test.tsx Tabela.test.tsx
src/paginas/Inicio.tsx src/paginas/DesignSystem.tsx
src/teste/setup.ts
```

## Diário

### 2026-08-24 — Abertura

- Leitura do cofre na ordem obrigatória da seção "Ao iniciar qualquer sessão".
- Checkpoint de entendimento + dúvidas entregue ao dono antes de qualquer código (regra 6).
- Divergência encontrada: as notas apontavam o cofre em `C:\Users\wccau\Domoby - fabrica\_docs\`; o caminho real é `C:\Users\wccau\Domoby\Domoby - fabrica\_docs\`. Corrigido na cópia raiz do `CLAUDE.md` e sincronizado de volta na nota do cofre + no `PROMPT - Bloco 1` (regra "mudou aqui → mudou lá").

### 2026-08-24 — Construção

- Scaffold montado à mão (sem `npm create vite`) para não herdar arquivos de exemplo que teriam que ser apagados depois.
- **Erro e correção — `sed`/`perl` no Git Bash do Windows:** substituição contendo `\` de caminho Windows não casava (mangling de argumento do MSYS). Corrigido fazendo a edição via `node -e` com `String.fromCharCode(92)`. Registrado como E-09 na memória de aprendizado.
- **Erro evitado — classe do Tailwind por interpolação:** a primeira versão da página `/design` montava as amostras de cor com `` `bg-marca-${n}` ``. O gerador do Tailwind varre **texto literal** no código; classe montada em runtime simplesmente não existe no CSS final e a amostra sairia transparente. Reescrito com as 22 classes por extenso. Registrado como A-07.
- **TypeScript 6:** `baseUrl` está depreciado e virou erro — removido; `paths` sozinho já resolve o alias `@/*`. E `noUncheckedSideEffectImports` exigiu `vite/client` em `types` para aceitar `import './estilos/global.css'`.
- **Lint apontou duas coisas reais:**
  1. `usarNotificacao` violava `react-hooks/rules-of-hooks` (hook precisa começar com `use`) → renomeado para `useNotificacao` e a convenção virou regra escrita no `docs/design-system.md` (T-09).
  2. `DESCRICAO_ESTADO` exportado do mesmo arquivo do componente quebrava o fast refresh → constantes e tipo movidos para `src/componentes/ui/estados.ts`.
- **Ajuste no `<Tabela>` após ver no celular:** a versão para celular repetia o cliente (título do card + linha da lista). O `slice(1)` implícito foi trocado por flags explícitas `ocultarNoCelular` / `ocultarNaTabela` na definição da coluna.
- Subconjuntos de fonte reduzidos para latino (Poppins baixava devanágari à toa).

### 2026-08-24 — Verificação

Executado antes de declarar concluído:

| Verificação | Resultado |
|---|---|
| `npx tsc -b` | ✅ sem erros |
| `npm run lint` | ✅ 0 erro, 0 aviso |
| `npm run test` | ✅ 8 testes, 3 arquivos |
| `npm run build` | ✅ build em ~700ms, JS 409 kB (130 kB gzip), CSS 29 kB (7 kB gzip) |
| Console do navegador | ✅ nenhum erro |
| Viewport tablet (768×1024) | ✅ tabela real, paginação 1–8 → 9–16 de 27 funcionando |
| Viewport celular (375×812) | ✅ tabela vira lista de cards, **sem rolagem horizontal** (`scrollWidth` = `clientWidth` = 375) |
| Alvos de toque medidos no DOM | ✅ botão de paginação 44px, botão `galpao` 64px |
| Botão primário | ✅ fundo `rgb(241,194,75)` sobre texto `rgb(28,27,30)` — o amarelo da logo com contraste ~10:1 |

### Pendente para o dono

- **Screenshots da página `/design`**: o painel de navegador desta sessão não estava sendo exibido, então a captura de imagem falhou. A verificação foi feita medindo o DOM real nos dois viewports (tabela acima). As imagens saem em 1 minuto com `npm run dev` aberto no tablet e no celular.
- Projeto Supabase **de desenvolvimento** (D-15) precisa existir antes da SESSAO-02.
- Q-28 (ROTAS é setor terminal na plataforma?) precisa de resposta antes da SESSAO-04.

### 2026-08-24 — Entrega

- 7 commits pequenos na branch `sessao-01-fundacao`, árvore limpa.
- **README validado de verdade:** clone limpo da branch → `npm ci` → `npm run build` → `npm run test` (8 passando). O critério de aceite "clone → instalar → rodar seguindo só o README" está conferido, não presumido.
- **`git push` bloqueado:** `remote: Repository not found` em `https://github.com/contatodomoby/Fabrica_processo.git`. A branch `main` local também não tem tracking, o que indica repositório criado localmente com o remoto adicionado à mão — falta o repositório existir no GitHub com esse nome, ou falta a credencial da conta `contatodomoby` no Git Credential Manager desta máquina. **Nada foi forçado**; os commits estão íntegros e o push é um comando só quando o acesso existir.

### 2026-08-24 — Fechamento

- **Credencial resolvida pelo dono.** O `Repository not found` era a credencial pessoal do GitHub tentando acessar um repositório privado da conta `contatodomoby` — o GitHub responde 404 em vez de 403 de propósito, para não revelar que o repositório existe. Registrado como E-10 na memória de aprendizado.
- **Merge na `main` feito a pedido explícito do dono**, com `--no-ff` (commit `e977aa4`), após `tsc` + `lint` + 8 testes + build verdes na branch e novamente na `main` depois do merge.
- ⚠️ **Desvio consciente da regra crítica 1** (↩️ em 26/08 deixou de ser desvio: o dono dispensou PR e proteção de branch enquanto for o único no repositório — **D-20** — e os dois `CLAUDE.md` foram ajustados) do `CLAUDE.md` ("toda sessão termina em PR"): não houve PR, houve revisão e aprovação do dono no chat seguida de merge. Fica registrado para não virar precedente silencioso — a regra continua valendo nas próximas sessões, salvo pedido explícito igual a este.
- `main` e `sessao-01-fundacao` publicadas em `contatodomoby/Fabrica_processo`.
