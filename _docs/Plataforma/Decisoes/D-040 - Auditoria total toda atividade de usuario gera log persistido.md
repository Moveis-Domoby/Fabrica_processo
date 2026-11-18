---
id: D-40
aliases: [D-40, D-040]
titulo: "Auditoria total: toda atividade de usuário gera log persistido"
tipo: decisao
data: 2026-08-28
status: vigente
revisa: []
revisada_por: []
complementa: []
area: [auditoria-logs]
tags: [decisao, area/auditoria-logs]
---
# D-40 · Auditoria total: toda atividade de usuário gera log persistido (28/08/2026)

Toda ação de usuário registra **log no banco** (quem, quando, o quê, onde), **append-only**, sem exceção. O registro nasce na SESSAO-13; a consulta admin completa pode vir depois.

**↪️ 01/10/2026 ([[D-095 - Auditoria no Painel admin o rastro de tudo quem quando onde|D-95]]):** a consulta chegou — **Painel admin → Auditoria**, com o porquê de cada gesto e a saída da plataforma também na trilha. **↪️ 01/10 ([[D-100 - O Painel admin vira Configuracoes nasce o Painel super admin|D-100]]):** a Auditoria foi para o **Painel super admin** (só o dono).
