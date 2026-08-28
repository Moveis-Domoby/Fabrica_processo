# Plataforma de Produção — Móveis Domoby

Kanban por setor com **controle de tempo e produtividade** — a plataforma própria que substitui o ClickUp da produção.
Este repositório guarda **o código** e, em `_docs/`, **o cofre Obsidian** com toda a memória do projeto.

> **Estado atual:** SESSAO-01 e SESSAO-02 entregues — fundação, design system e **o modelo de dados aplicado no Supabase da fábrica**. Ainda **não há tela de negócio nem autenticação**.

---

## Rodar localmente

Pré-requisito: **Node.js 20 ou superior** (testado no 26).

```bash
npm install
```

```bash
npm run dev
```

Abra **http://localhost:5173**. O padrão visual (modelo de sistema) está documentado em `_docs/Plataforma/PLT - Modelo de Sistema.md` — leitura obrigatória antes de criar tela.

O servidor sobe com `host: true`, então dá para abrir do tablet ou do celular na mesma rede pelo IP da máquina (ex.: `http://192.168.0.10:5173`) — é assim que se testa o que o operador vai ver.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | checagem de tipos + build de produção em `dist/` |
| `npm run preview` | serve o build de produção |
| `npm run test` | testes (Vitest) |
| `npm run test:watch` | testes em modo observador |
| `npm run test:banco` | aplica as migrations num Postgres descartável (dentro do Node) e confere 15 pontos — **não toca em Supabase nenhum** |
| `npm run banco:conferir` | mostra o que está no banco real, **sem escrever nada** |
| `npm run banco:aplicar` | mostra o plano de migrations; só aplica com `-- --confirmar` |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

## Stack (D-15 — escolhida na SESSAO-01, padrão até o fim do projeto)

| Camada | Escolha | Por quê |
|---|---|---|
| Front | **React 19 + TypeScript** | TypeScript elimina a classe de erro mais cara aqui: nome de campo/coluna errado |
| Build | **Vite** | dev instantâneo e build enxuto — importa numa rede de galpão |
| Estilo | **Tailwind CSS v4** com tokens próprios | design system nosso, sem herdar identidade de terceiro |
| Componentes | **Radix UI** (primitivos headless) | acessibilidade (foco, teclado, ARIA) pronta, visual 100% nosso |
| Rotas | **React Router** | padrão da comunidade |
| Estado de servidor | **TanStack Query** | cache/refetch das filas de setor é arquitetura, não detalhe |
| Testes | **Vitest + Testing Library** | mesma engine do Vite |

Trocar qualquer item acima exige uma decisão nova em `_docs/Plataforma/PLT - Decisoes de Produto.md`.

## Estrutura

```
CLAUDE.md              regras de conduta de toda sessão de Claude Code (cópia da nota do cofre)
README.md              este arquivo
docs/
  modelo-de-dados.md   o que o banco guarda e por quê, em português de gente
  execucao/            memória de execução de cada sessão (SESSAO-NN.md)
src/                   o app
supabase/
  migrations/          o schema da plataforma, versionado
  testes/              teste das migrations contra o esquema real da integração
  aplicar-migrations.mjs
_docs/                 cofre Obsidian: decisões, requisitos, demandas, handoffs
```

## Banco

A plataforma vive no **mesmo Supabase que já recebe os pedidos do Tiny** (D-08) — as tabelas novas usam prefixo `plt_` e **nenhuma tabela da integração é alterada**.

Para rodar qualquer coisa contra o banco real, copie `.env.example` para `.env.local` e preencha com os valores do painel. **`.env.local` nunca é versionado, e credencial nunca vai para chat, print ou nota.**

> [!warning]
> Duas coisas que não se "consertam" nesse schema, e o porquê está escrito dentro das migrations:
> **1.** `plt_cards` **não** tem foreign key para `pedido_itens` — a função de upsert do Tiny apaga e regrava os itens a cada atualização, e a FK derrubaria isso em produção.
> **2.** O append-only dos eventos é garantido por **trigger**, não por RLS — porque a chave de serviço ignora RLS.

## Como se trabalha aqui

Leia **`CLAUDE.md`** antes de qualquer coisa. Em resumo:

- **Uma branch por sessão** (`sessao-NN-descricao`), com revisão do dono antes de ir para a `main` (D-20).
- **Nunca se toca no banco de produção** sem aprovação explícita do dono.
- **Nunca se cola credencial** em código, chat ou print.
- **Eventos são append-only** — correção é evento novo, nunca edição.
- Cada sessão executa **uma demanda** de `_docs/Plataforma/Demandas/` e termina com **handoff** em `_docs/Handoffs/`.

## Onde fica a verdade

| Assunto | Nota |
|---|---|
| Decisões de produto (D-01…D-17) | `_docs/Plataforma/PLT - Decisoes de Produto.md` |
| Requisitos (RF/RNF) | `_docs/Plataforma/PLT - Requisitos.md` |
| Ordem das sessões | `_docs/Plataforma/Demandas/000 - ORDEM DAS SESSOES.md` |
| Esquema do banco | `_docs/Supabase-fabrica/SUPA - Esquema do Banco.md` |
| Aprendizado acumulado | `_docs/Plataforma/PLT - Memoria de Aprendizado.md` |
| Modelo de sistema (design system) | `_docs/Plataforma/PLT - Modelo de Sistema.md` |
