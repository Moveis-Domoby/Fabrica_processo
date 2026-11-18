---
id: D-68
aliases: [D-68, D-068]
titulo: "Dados sensíveis do cadastro fora da API"
tipo: decisao
data: 2026-09-27
status: vigente
revisa: []
revisada_por: []
complementa: []
area: [acesso-usuarios]
tags: [decisao, area/acesso-usuarios]
---
# D-68 · Dados sensíveis do cadastro fora da API (27/09/2026)

**Decidido (resposta 6 do dono — "a"):** o navegador passa a ler de `plt_usuarios` **só as colunas de trabalho**. **CPF, hash do PIN, token de convite e data de nascimento ficam fora da API.** Achado da SESSAO-26 ([[Memoria - Acesso Seguranca e Credenciais#E-50|E-50]]): o grant de TABELA que o Supabase dá por padrão anulava os `revoke` por coluna da S03 — qualquer pessoa logada lia CPF, PIN e convite de todos.

- **Regra permanente:** coluna nova em `plt_usuarios` só fica legível pelo navegador com `grant select (coluna)` explícito; dado pessoal novo nasce fora da API e é lido por porta própria (como a data de nascimento).
