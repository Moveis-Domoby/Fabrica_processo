---
id: D-8
aliases: [D-8, D-08, D-008]
titulo: "Banco: o mesmo Supabase da fábrica"
tipo: decisao
data: 2026-08-19
status: vigente
revisa: []
revisada_por: []
complementa: []
area: [publicacao-infra]
tags: [decisao, area/publicacao-infra]
---
# D-8 · Banco: o mesmo Supabase da fábrica (19/08/2026)

**Decidido:** a plataforma nasce sobre o Supabase que já recebe os pedidos do Tiny (P15 — dupla escrita ativa). Card criado automaticamente quando o pedido entra; zero sincronização entre bancos. O schema cresce com as tabelas novas (etapas, eventos de movimentação, usuários, perfis, visualizações salvas). **Regra do cofre continua valendo:** antes de qualquer SQL, ler [[SUPA - Esquema do Banco]].
