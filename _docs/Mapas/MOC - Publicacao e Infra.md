---
titulo: "Mapa — Publicação e Infra"
tipo: mapa
area: publicacao-infra
atualizado: 2026-11-18
tags: [mapa, moc, area/publicacao-infra]
---

# 🗺️ MOC - Publicacao e Infra

> Onde tudo roda: o banco único no Supabase da fábrica (migrations versionadas, aplicadas uma a uma com o OK do dono, bateria local antes), as funções de borda, o site na Vercel (subir código para a main **publica**; documentação não), as rotinas agendadas e a regra de versão/recarga das telas.

**No código:** `supabase/migrations/` · `supabase/testes/` · `supabase/aplicar-migrations.mjs` · `supabase/functions/` · `vercel.json` · `scripts/`

**Notas da área:** [[SUPA - Visao Geral]] · [[N8N - Infraestrutura VPS]] · [[PLT - Lei de Desempenho e Escala]] · [[SUPA - Comercial - Cron e Rotinas]]

**Perguntas em aberto:** ver a seção "Operação e infraestrutura" das perguntas em aberto — [[PLT - Perguntas em Aberto]]

## Últimas sessões da área (a mais nova primeiro)

- **48** · [[SESSAO-48 - Cancelar Fabricacao de Verdade - Peca de Pedido Pergunta o Destino]] · [[handoff_2026_11_11_cowork_sessao48_cancelamento_e_recargas|handoff 1]] · [[handoff_2026_11_11_sessao48_cancelar_fabricacao_recargas|handoff 2]]
- **32** · [[SESSAO-32 - Desempenho e Escala - Adequacao de Toda a Plataforma]] · [[handoff_2026_10_16_sessao32_desempenho_escala|handoff]]
- **08** · [[SESSAO-08 - Publicacao no Ar]]
- **02** · [[SESSAO-02 - Banco e Dominio no Supabase]] · [[handoff_2026_08_26_sessao02_banco|handoff]]
- **01** · [[SESSAO-01 - Fundacao do Repo e Design System]] · [[handoff_2026_08_24_sessao01_fundacao|handoff]]

<!-- gerado:inicio -->
## Decisões vigentes (8)

- [[D-008 - Banco o mesmo Supabase da fabrica|D-8]] · Banco: o mesmo Supabase da fábrica
- [[D-015 - Stack escolhida pelo Claude Code e imutavel depois|D-15]] · Stack escolhida pelo Claude Code, e imutável depois
- [[D-019 - Banco o projeto da org Tech e o de producao e por ora e onde|D-19]] · Banco: o projeto da org Tech é o de produção, e por ora é onde se trabalha
- [[D-020 - Sem PR e sem protecao de branch enquanto o dono for o unico|D-20]] · Sem PR e sem proteção de branch enquanto o dono for o único
- [[D-030 - Publicacao adiada nenhum deploy no bloco noturno|D-30]] · Publicação adiada: nenhum deploy no bloco noturno
- [[D-047 - Regra permanente nenhuma tabela nova se uma existente pode|D-47]] · Regra permanente: nenhuma tabela nova se uma existente pode ser reutilizada
- [[D-138 - SESSAO-32 o OK dos indices e os insumos separados dos moveis|D-138]] · SESSAO-32: o OK dos índices e os insumos separados dos móveis no estoque
- [[D-306 - A plataforma abre como aplicativo um icone uma janela|D-306]] · A plataforma abre como aplicativo: um ícone, uma janela só

## Provisórias ⏳ — valem até o dono dizer o contrário (4)

- [[D-303 - A versao e o codigo e documentacao nao publica a mudanca|D-303]] · A versão é o código e documentação não publica — ⏳ a mudança na Vercel só entra com o OK…
- [[D-304 - O momento seguro de recarregar|D-304]] · O momento seguro de recarregar
- [[D-305 - A trilha diz por que a pagina abriu|D-305]] · A trilha diz por que a página abriu
- [[D-335 - Os roteiros do cofre nao publicam o site|D-335]] · Os roteiros do cofre não publicam o site

## Revisadas por outra (1) — só para a história

[[D-137 - SESSAO-32 as respostas do dono tempo logado medicao nos|D-137]]

## Onde mais ler (só o que a demanda tocar)

- **Banco:** [[Banco - Plataforma - Visao Geral das Tabelas plt]]
- **Lições:** [[Memoria - Banco e SQL 1]] · [[Memoria - Banco e SQL 2]] · [[Memoria - Desempenho e Tempo Real]] · [[Memoria - Git Shell e Windows 1]] · [[Memoria - Git Shell e Windows 2]] · [[Memoria - Migrations Aplicador e Ensaio 1]] · [[Memoria - Migrations Aplicador e Ensaio 2]] · [[Memoria - Publicacao Vercel e Funcoes]] · [[Memoria - Testes e Validacao ao Vivo]]
<!-- gerado:fim -->
