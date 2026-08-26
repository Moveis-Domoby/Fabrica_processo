---
titulo: "SESSAO-01 — Fundação do Repo e Design System"
tipo: demanda
status: entregue
data: 2026-08-19
atualizado: 2026-08-24
tags: [plataforma, demanda, sessao]
---

# 🎯 SESSAO-01 — Fundação do Repo e Design System

## O que é

Criar o repositório da plataforma com um app React rodando e o **design system documentado** — a base de estilização que TODAS as sessões seguintes vão seguir (RNF-01). Nada de tela de negócio: esta sessão entrega fundação.

## Requisitos cobertos

RNF-01 (design system documentado) · RNF-02 (regra de paginação nasce aqui) · RNF-04 (regras de conduta no repo).

## Decisões que regem

D-06 (mobile-first para o chão de fábrica: tablet + celular) · D-09 (as 3 cores de qualidade 🟢🟡🔴 já nascem como tokens do design system) · D-10 (CLAUDE.md na raiz).

## Comportamento esperado

- Repositório novo, com branch main protegida (trabalho sempre em branch + PR).
- App React inicializado e rodando localmente, com estrutura de pastas documentada.
- **Design system:** tokens (cores — incluindo as 3 de qualidade —, tipografia, espaçamento, tamanhos de toque para tablet), componentes base (botão, input, select, modal, toast/notificação, badge de estado, tabela **com paginação embutida como padrão**), e uma página interna `/design` que exibe todos os componentes vivos.
- **Doc de estilização** no repo (`docs/design-system.md`): quando usar cada componente, regra de paginação, densidade, acessibilidade de chão de fábrica (botão grande, contraste).
- `CLAUDE.md` copiado da nota [[CLAUDE - Regras do Claude Code (repo)]] para a raiz.
- `docs/execucao/SESSAO-01.md` com a memória de execução completa.

## Perguntar ao dono no início da sessão (não decidir sozinho)

- **Stack: escolha do Claude Code (D-15)** — decidir, justificar em 1 parágrafo, registrar, e seguir esse padrão até o fim do projeto. Recomendação do Cowork: React + Vite + TypeScript + Tailwind.
- Nome do repositório e onde hospedar o código (GitHub?).
- Identidade visual: cores da Domoby ou paleta neutra por enquanto? (Q-30 em aberto.)

## Fora do escopo

Banco, autenticação, qualquer tela de negócio, deploy.

## Critérios de aceite

- [x] `git clone` → instalar → rodar local funciona seguindo só o README.
- [x] Página `/design` mostra todos os componentes base, em viewport de celular e de tablet — verificado a 375px (vira lista de cards, sem rolagem horizontal) e a 768px.
- [x] Tabela de exemplo pagina de verdade (27 linhas fictícias, 8 por página) — e coberta por teste automatizado.
- [x] `CLAUDE.md` na raiz; branch revisada e **mesclada na `main`** a pedido do dono (sem PR, desvio consciente registrado). ⚠️ **Proteção da `main` depende do dono ligar no GitHub** (Settings → Branches) — não é possível pelo código.
- [x] Handoff criado: [[handoff_2026_08_24_sessao01_fundacao]].

---

## Registro de entrega (24/08/2026)

Executada na branch `sessao-01-fundacao`. Stack escolhida e justificada conforme D-15 (confirmação registrada em [[PLT - Decisoes de Produto]]). Memória de execução em `docs/execucao/SESSAO-01.md`; handoff em [[handoff_2026_08_24_sessao01_fundacao]].

**Ficou pendente de propósito:** screenshots da `/design` (o painel de navegador da sessão não estava sendo exibido — a verificação foi feita medindo o DOM real nos dois viewports) e a proteção da branch `main`, que só o dono pode ligar no GitHub.
