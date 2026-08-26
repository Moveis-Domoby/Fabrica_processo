---
titulo: "SESSAO-02 — Banco e Domínio no Supabase"
tipo: demanda
status: entregue
data: 2026-08-19
atualizado: 2026-08-26
tags: [plataforma, demanda, sessao]
---

# 🎯 SESSAO-02 — Banco e Domínio no Supabase

## O que é

Modelar TODO o domínio da plataforma como migrations SQL versionadas no repo — **sem aplicar nada em produção** (regra crítica 2). O banco é o mesmo Supabase da fábrica (D-08), que já tem `clientes`, `pedidos`, `pedido_itens`, `eventos` da integração P15.

## Requisitos cobertos

RNF-03 · RNF-05 (eventos append-only) · fundação de RF-02, RF-05, RF-10, RF-80–85, RF-33.

## Decisões que regem

D-01 (pedido → unidades → reagrupamento) · D-02 (fila vs execução) · D-04 (histórico auditável) · D-08 (mesmo Supabase) · D-09 (estados de qualidade e pausas).

## Comportamento esperado

- **Ler [[SUPA - Esquema do Banco]] ANTES de qualquer linha de SQL** (regra 10). Tabelas novas com prefixo próprio da plataforma; **nenhuma tabela existente é alterada**.
- Modelar no mínimo: usuários/perfis/papéis; **setores contendo etapas internas** (2 níveis, D-12 — ambos cadastráveis pelo admin, seed com PCP · SECC · CNC · FITAMENTO · FURAÇÃO · MONTAGEM · LIMPEZA E EMBALAGEM) e vínculo usuário↔setor; cards de pedido (PCP) e cards de unidade com vínculo ao pedido do Tiny já existente no banco; **eventos append-only** (movimentação entre setores e entre etapas internas, iniciar, finalizar, atestação de qualidade, divergência, notificação) com quem/quando/de-onde/para-onde; estados de qualidade da transição (marcação do remetente + parecer do recebedor); visualizações salvas de dashboard; tarefas e delegação. Tempo de fila atribuído ao setor, execução à pessoa (D-02).
- RLS coerente com os papéis (operador/líder/admin) — desenho, com políticas nas migrations.
- Diagrama/descrição do modelo em `docs/modelo-de-dados.md` no repo, em linguagem que o dono entende.
- Ciclo do cofre respeitado: as migrations ficam prontas; **a aplicação acontece só com aprovação explícita**, e aí `supabase-fabrica-schema.sql` + [[SUPA - Esquema do Banco]] são atualizados.

## Perguntar ao dono no início da sessão

- Q-28 (como tratar a ROTAS na fase 1) — afeta o seed dos setores terminais.
- Ambiente: **projeto Supabase novo, exclusivo de dev, já decidido (D-15)** — o dono cria e passa as chaves.

## Fora do escopo

Qualquer tela; aplicar em produção; importar dados do ClickUp/Trello (Q-25 em aberto).

## Critérios de aceite

- [x] Migrations rodam do zero num ambiente de teste sem erro, duas vezes seguidas — `npm run test:banco`, contra o esquema REAL da integração.
- [x] Nenhuma tabela/coluna existente da integração alterada — conferido por impressão digital de estrutura e por contagem de linhas, antes e depois de aplicar.
- [x] Evento não pode ser alterado nem apagado — testado **no banco real**; a trava é TRIGGER e não política, porque a service_role ignora RLS.
- [x] `docs/modelo-de-dados.md` legível para não-dev.
- [x] Handoff com o passo a passo de validação: [[handoff_2026_08_26_sessao02_banco]]. ↩️ A aplicação deixou de ser "para quando for aprovada": o dono autorizou e ela **foi feita** nesta sessão (D-19).

---

## Registro de entrega (26/08/2026)

Executada na branch `sessao-02-banco-dominio`. Duas perguntas foram ao dono e viraram decisão: **D-18** (ESTOQUE e ROTAS nascem juntos no seed — responde Q-28) e **D-19** (o Supabase da org Tech, o mesmo da integração do Tiny, é o banco da plataforma e por ora pode receber migrations direto).

**Fora do escopo original que acabou entrando, com autorização:** a aplicação das migrations no banco.
