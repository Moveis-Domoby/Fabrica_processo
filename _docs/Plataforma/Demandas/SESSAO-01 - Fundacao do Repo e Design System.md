---
titulo: "SESSAO-01 — Fundação do Repo e Design System"
tipo: demanda
status: rascunho
data: 2026-08-19
atualizado: 2026-08-19
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

- [ ] `git clone` → instalar → rodar local funciona seguindo só o README.
- [ ] Página `/design` mostra todos os componentes base, em viewport de celular e de tablet.
- [ ] Tabela de exemplo pagina de verdade (dados fake).
- [ ] `CLAUDE.md` na raiz; main protegida; PR aberto para revisão.
- [ ] Handoff criado em `_docs/Handoffs/` explicando o que existe e como rodar.
