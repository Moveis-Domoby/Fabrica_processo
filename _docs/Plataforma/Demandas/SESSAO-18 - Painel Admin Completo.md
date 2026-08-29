---
titulo: "SESSAO-18 — Painel Admin Completo"
tipo: demanda
status: rascunho
data: 2026-08-19
atualizado: 2026-08-19
tags: [plataforma, demanda, sessao, admin]
---

# 🎯 SESSAO-18 — Painel Admin Completo

> ↪️ **Renumerada em 28/08/2026 (D-35):** era a SESSAO-14; ficou em standby atrás do bloco 3 (a reforma, Sessões 13→16).

## O que é

A consolidação: tudo que foi nascendo espalhado nas sessões 03–11 (usuários, setores, etapas, permissões, chaves de API, automações) ganha um **painel admin único, completo e bem estruturado** (RF-60) — a casa do admin geral.

## Requisitos cobertos

RF-60 · fecha RF-21/24 (gestão) · consolida Q-50 (chaves) e RF-06 (automações).

## Decisões que regem

D-10 · todas as anteriores (este painel administra o que elas criaram).

## Comportamento esperado

- **Seções:** Usuários (convites, papéis, ativação/desativação, PIN) · Setores e membros · Quadros e etapas · Permissões (matriz papel × ação) · Chaves de API e webhooks · Automações · **Auditoria** (busca nos eventos: por card, por usuário, por setor, por período — a lupa do histórico append-only).
- Navegação do admin clara e consistente com o design system; tabelas todas paginadas (RNF-02); ações destrutivas com confirmação e, onde fizer sentido, desativação em vez de exclusão (histórico aponta para tudo).
- Visão de saúde: contadores gerais (usuários ativos, cards em produção, disputas abertas, automações com erro).
- Revisão final de permissões ponta a ponta: cada tela do sistema re-testada contra os 3 papéis.

## Perguntar ao dono no início da sessão

- Ordem de importância das seções (o que o admin abre todo dia fica em cima).
- Existe "super admin" único (você) com poderes acima dos demais admins?

## Fora do escopo

Features novas de produção · módulo de estoque (fase 2 — D-07).

## Critérios de aceite

- [ ] Todas as entidades administráveis têm CRUD completo no painel, sem precisar de banco na mão.
- [ ] Auditoria encontra a história completa de um card e de um usuário em segundos.
- [ ] Matriz de permissões re-testada: nenhum vazamento entre papéis.
- [ ] Nenhuma tabela sem paginação.
- [ ] PR + handoff — e este handoff fecha a fase 1 da plataforma.
