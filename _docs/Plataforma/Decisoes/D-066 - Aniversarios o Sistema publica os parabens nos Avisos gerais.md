---
id: D-66
aliases: [D-66, D-066]
titulo: "Aniversários: o Sistema publica os parabéns nos Avisos gerais"
tipo: decisao
data: 2026-09-27
status: vigente
revisa: []
revisada_por: []
complementa: []
area: [painel-chat-automacoes]
tags: [decisao, area/painel-chat-automacoes]
---
# D-66 · Aniversários: o Sistema publica os parabéns nos Avisos gerais (27/09/2026)

**Decidido (resposta 1 do dono — "só no grupo mesmo, tá boa a mensagem"):**

- Campo novo **data de nascimento** em `plt_usuarios` ([[D-021 - Identidade e acesso uma tabela matricula senha padrao|D-21]]) — a própria pessoa cadastra no Meu Perfil; o admin, na Gestão da equipe. **Só a pessoa e o admin veem a data** (fora da API — [[D-068 - Dados sensiveis do cadastro fora da API|D-68]]).
- No dia, às **08:00 de Natal**, o Sistema publica nos **Avisos gerais**, uma vez por pessoa: *"🎉 Hoje é aniversário de {nome}! Parabéns — toda a Domoby deseja um ótimo dia."* Só pessoas ativas.
- Nascido em **29/02** é lembrado em **28/02** nos anos não bissextos.

**Descartada:** mandar também em particular para a pessoa.
