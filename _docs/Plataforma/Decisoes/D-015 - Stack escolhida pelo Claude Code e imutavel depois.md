---
id: D-15
aliases: [D-15, D-015]
titulo: "Stack escolhida pelo Claude Code, e imutável depois"
tipo: decisao
data: 2026-08-24
status: vigente
revisa: []
revisada_por: []
complementa: []
area: [publicacao-infra, processo]
tags: [decisao, area/publicacao-infra, area/processo]
---
# D-15 · Stack escolhida pelo Claude Code, e imutável depois (24/08/2026)

**Decidido:** o dono não tem preferência técnica (*"deixe ele escolher a mais assertiva e seguir esse padrão até o fim"*). O Claude Code escolhe a stack do front na Sessão 01, **justifica a escolha**, e ela vira **padrão até o fim do projeto** — trocar depois exige decisão nova aqui. Recomendação registrada do Cowork: **React + Vite + TypeScript + Tailwind** (padrão de mercado, integra nativamente com Supabase, TypeScript reduz erro bobo, Tailwind facilita o design system próprio).

**↪️ Confirmação da stack (24/08/2026 — SESSAO-01):** o Claude Code escolheu e justificou. **React 19 + TypeScript + Vite + Tailwind CSS v4 + Radix UI (primitivos) + React Router + TanStack Query**, testes em Vitest + Testing Library, `npm` como gerenciador. Justificativa curta: TypeScript corta a classe de erro mais cara do projeto (nome de campo/coluna errado — [[Memoria - Tiny n8n e Integracoes 1#E-5|E-05]]); Vite dá build enxuto e dev instantâneo, o que importa na rede do galpão; Tailwind com tokens próprios permite design system Domoby sem herdar identidade de terceiro; Radix entrega acessibilidade (foco, teclado, ARIA) pronta, que é onde componente caseiro erra feio; TanStack Query entrou já na fundação porque cache de fila de setor é arquitetura, não detalhe. **A partir daqui é padrão até o fim do projeto** — trocar exige decisão nova aqui. Detalhes e alternativas descartadas no handoff [[handoff_2026_08_24_sessao01_fundacao]].

**Banco de desenvolvimento (mesma data):** todo o desenvolvimento roda num **projeto Supabase novo, exclusivo de dev**. O Supabase de produção ([[D-008 - Banco o mesmo Supabase da fabrica|D-08]]) só recebe migrations já testadas, com aprovação explícita do dono — a integração do Tiny está no ar nele.
