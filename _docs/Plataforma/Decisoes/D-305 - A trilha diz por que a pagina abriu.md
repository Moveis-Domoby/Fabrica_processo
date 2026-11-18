---
id: D-305
aliases: [D-305]
titulo: "A trilha diz por que a página abriu"
tipo: decisao
data: 2026-11-11
status: provisoria
revisa: []
revisada_por: []
complementa: []
area: [auditoria-logs, publicacao-infra]
tags: [decisao, area/auditoria-logs, area/publicacao-infra, provisoria]
---
# D-305 · ⏳ PROVISÓRIA — A trilha diz por que a página abriu (11/11/2026, SESSAO-48 — a regra é da demanda; os detalhes são escolhas da sessão)

1. **Os porquês da plataforma:** versão nova (sozinha), versão nova (tocou em "Atualizar"), pedaço sumido e troca de setor — guardados na aba antes de recarregar, valem 60 s.
2. **Abertura é a página:** só a 1ª abertura registrada de cada página leva a marca; trocar de conta na mesma página (entrar de novo, a troca vinda de outra aba) grava a navegação comum.
3. **O banco só aceita o que conhece** (listas fechadas; a versão em hexadecimal).
4. **Na Auditoria:** "Abriu a plataforma — <porquê>", na ordem plataforma > aba descartada pelo navegador > o que o navegador fez (atualizou, abriu pelo endereço, voltou); a versão fica fora da tela.

**Como ficou (técnico):** `plt_fn_abertura(text, boolean, jsonb)` (a de 2 argumentos sai — [[Memoria - Banco e SQL 2#A-12|A-12]]), migration `20261111050000_plt_abertura_motivo.sql`; `src/lib/recarga.ts`, `src/lib/versaoNova.ts`, `vite.config.ts`, `vercel.json`.
