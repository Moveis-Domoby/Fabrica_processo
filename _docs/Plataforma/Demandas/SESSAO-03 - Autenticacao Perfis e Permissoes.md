---
titulo: "SESSAO-03 — Autenticação, Perfis e Permissões"
tipo: demanda
status: rascunho
data: 2026-08-19
atualizado: 2026-08-19
tags: [plataforma, demanda, sessao]
---

# 🎯 SESSAO-03 — Autenticação, Perfis e Permissões

## O que é

O sistema de entrada e de papéis: login por cadastro, convites para setor, e os três níveis de navegação (operador → líder → admin). É a fundação de "quem vê o quê" e de "quem fez o quê" — sem isso, nenhum timer tem dono.

## Requisitos cobertos

RF-20 · RF-21 · RF-22 · RF-23 · RF-24 · RF-25 (parcial: identificação rápida preparada).

## Decisões que regem

D-06 (tablet compartilhado + celular pessoal) · D-10.

## Comportamento esperado

- **Cadastro/login de usuário** (RF-20). Autocadastro NÃO dá acesso: a conta só funciona depois que um admin/líder aprova ou convida.
- **Convite para setor** (RF-21): admin/líder convida por e-mail/link; o convidado entra já vinculado ao setor e papel certos.
- **Papéis:** operador (vê a fila do próprio setor, age nos cards), líder (tudo do setor: membros, métricas, aprovações de divergência), admin geral (tudo de todos + configurações).
- **Navegação por papel** (RF-24): menu do operador é mínimo; do líder, completo no escopo do setor; do admin, total.
- **Identificação rápida no tablet compartilhado** (D-06): sessão do setor logada no dispositivo + seleção de operador com PIN ao executar ação. A ação registra o operador, não o "usuário do tablet".
- Gestão de usuários/permissões acessível **só** a admin/líder (RF-20).

## Perguntar ao dono no início da sessão

- Login por e-mail/senha serve para todos? Operadores têm e-mail? (Se não: usuário+PIN criado pelo líder.)
- Quantos usuários na largada (Q-61)?

## Fora do escopo

Telas de kanban; dashboards; painel admin completo (SESSAO-12 consolida — aqui só a gestão mínima de usuários/convites).

## Critérios de aceite

- [ ] Convite → cadastro → login → usuário cai na navegação do seu papel.
- [ ] Operador não acessa telas/rotas de líder nem de admin (testado por URL direta).
- [ ] No modo tablet, duas ações seguidas de operadores diferentes registram autores diferentes.
- [ ] Conta sem aprovação não acessa nada.
- [ ] PR + handoff com matriz papel × permissão documentada.
