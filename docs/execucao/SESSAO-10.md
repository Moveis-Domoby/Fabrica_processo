# Memória de execução — SESSAO-10 · Dashboards e Visualizações Salvas

**Branch:** `sessao-10-dashboards` · **Início:** 2026-08-28 (bloco noturno D-26)
**Demanda:** `_docs/Plataforma/Demandas/SESSAO-10 - Dashboards e Visualizacoes Salvas.md`
**Decisões que regem:** D-02 (fila vs execução + soma) · D-04 (alavancagem, sem ranking) · D-09 (qualidade na dash) · **D-32** (foco pesado em TEMPO; só líder/admin) · **D-29** (descontos de horário/pausa via `fn_tempo_util`).

## Task list (espelho da demanda + D-32)

1. [ ] Migration 18: helper `fn_setores_dashboard` (admin=tudo; líder=setores que lidera; operador=nada) + RPCs de leitura (E-11, endpoints de propósito): execuções DETALHADAS · tempos por setor (fila vs execução, bruto e útil) · por pessoa · por item · qualidade por setor · estoque (RF-14)
2. [ ] Tempo ÚTIL em tudo (D-29): `fn_tempo_util` desconta horário de funcionamento e pausas; bruto mostrado ao lado
3. [ ] Página /dashboards (líder/admin): filtros de período/setor + widgets — foco na LISTA DETALHADA de tempo (pedido do dono)
4. [ ] Fila vs execução por setor, lado a lado e SOMADOS (D-02)
5. [ ] Qualidade por setor: 🟢🟡🔴 entregues, divergências (RF-85)
6. [ ] Tempo parado no estoque (RF-14)
7. [ ] Visualizações salvas (RF-32/33): salvar com nome, alternar, excluir, padrão — por usuário (plt_visualizacoes)
8. [ ] Líder NÃO enxerga dados de outro setor (gate na função, não só na tela); operador não vê dashboards
9. [ ] Toda lista pagina (RNF-02)
10. [ ] Verificação: números batem com soma manual (query no harness + documentada no handoff) · criar→salvar→sair→voltar→alternar · tsc/lint/vitest/test:banco 2x → aplicar → advisors
11. [ ] Task list × demanda · merge na main · handoff + memória + continuidade

## Decisões técnicas

- **RPCs em `public` com gate interno** (padrão E-11 das portas de leitura): as views são `security_invoker` e o RLS por setor esconderia demais/de menos para dashboard — o gate certo é `fn_setores_dashboard()` (D-32). +6 WARN esperados nos advisors (endpoints de propósito) → total 14.
- **Agregados clipam a permanência/execução ao período** (greatest/least) antes de somar — tempo que atravessa a meia-noite do filtro conta só a parte de dentro.
- **Tempo útil por linha chama `fn_tempo_util`** (loop plpgsql): ok para o volume atual; se pesar com dados reais, materializar por dia é a evolução (anotar no handoff).
- **Gráficos sem dependência nova**: barras em CSS (dependência pesada exigiria pergunta — regra 3); tabelas com o componente `Tabela` (paginação padrão).
- **Visualização salva** = `configuracao` jsonb `{widgets: [...], periodoDias | de/ate, setorId}` — escopo pessoal por ora (RLS já pronto).

## Registro contínuo

- [28/08] Branch criada. Views relidas (permanencias/execucoes/qualidade), plt_visualizacoes e RLS conferidos (leitura própria/global/setor; escrita própria/admin).
- [28/08] Migration 18 escrita, testada (bloco novo no harness com 6 verificações: soma bate com a manual, lista detalhada, qualidade, estoque, gate do líder, operador zero) e APLICADA; advisors: 14 WARN esperados. Vazamento evitado no desenho: a subquery do "pedido mais antigo" do estoque ganhou o mesmo gate do agregado.
- [28/08] Front: `src/dashboards/` (parser de interval TESTADO — 6 casos no Vitest; api tipada; página com widgets/visualizações). Rota `/dashboards` no guard de líder + link na sidebar. tsc · lint · Vitest 23/23 · build ok.
- [28/08] Conferência de navegador (a 10 é sessão de verificação visual): página inteira com DADOS REAIS — SECC 4min de execução, execuções nomeadas, qualidade (SECC 🟡1/🔴1, divergência contra 1), estoque 1 peça/1d2h; **D-29 provado de ponta a ponta** (35s brutos → 30s úteis pela pausa de teste da SESSAO-07); visualização "So tempo por setor" salva → reload → alternada com config restaurada; console limpo.

## Task list — conferida ao final: 1✔ 2✔ 3✔ 4✔ 5✔ 6✔ 7✔ 8✔ 9✔ 10✔ 11✔
