# Memória de execução — SESSAO-16 · Dashboards de Verdade

> Regra 8 do CLAUDE.md: computar TUDO enquanto executa. Branch: `sessao-16-dashboards-de-verdade` (criada a partir da `main` com a SESSAO-20 dentro, commit `03b736a`).

## Checkpoint inicial (aprovado pelo dono em 17/09)

Respostas do dono às dúvidas de negócio:

1. **"Unidade concluída hoje" = chegou ao terminal final** (ESTOQUE ou ROTAS) — coerente com D-45.
2. **Lista detalhada de execuções** (o pedido da D-32) → opção **(b)**: vira seção final da tela **Pessoas**, obedecendo os filtros da tela. Apresentada com exemplo antes da escolha.
3. **Tempo por item** → seção na tela **Tempo por setor** (aprovado "pode ser"). **Retrato do estoque** → entra no painel "Fim de linha" da Visão do dia.

Decisões técnicas anunciadas no checkpoint (sem objeção do dono):

- **Tokens próprios `--dm-serie-fila` (#2563eb) e `--dm-serie-execucao` (#b8851e)**, fixos nos valores do LEIA-ME com variante clara nos temas escuros. NÃO usar `--dm-serie-1` para execução: ele segue a cor de ação do tema e no esmeralda vira VERDE, colidindo com o verde exclusivo da qualidade (LEIA-ME regra 2 / A-08). LEIA-ME ganha nota apontando os tokens.
- **Migration 28**: só portas de leitura (functions/views) gateadas por `fn_setores_dashboard` — retrato "agora" por setor, produção por hora, tendência semanal, destinos do fim de linha. Nenhuma tabela nova (D-47). Aplicar SÓ com aprovação explícita (regra crítica 2).
- **Visualizações salvas**: configuração passa a guardar tela + filtros; formato antigo (widgets S10) migrado por leitura, sem migration de dados.
- **Visão do dia** atualiza por Supabase Realtime em `plt_cards` + polling de segurança.
- Rotas: `/dashboards/visao-do-dia` · `/dashboards/tempo-por-setor` · `/dashboards/pessoas` · `/dashboards/qualidade`; `/dashboards/geral` → redirect para visão do dia.

## Task list (espelho da demanda)

- [ ] 1. Abrir e estudar os 4 mockups + 000-LEIA-ME (régua de qualidade) — FEITO na leitura inicial, reconferir ao montar cada tela
- [ ] 2. Tokens `--dm-serie-fila`/`--dm-serie-execucao` em `tokens.css` (+ variante escura) e nota no LEIA-ME
- [ ] 3. Migration 28 (portas de leitura novas) escrita + `test:banco` 2 rodadas verdes
- [ ] 4. Tela **Visão do dia** (andon: 4 heróis, tiles por setor, gargalo, produção por hora, fim de linha) — legível de longe, atualiza sozinha
- [ ] 5. Tela **Tempo por setor** (empilhado fila×execução ordenado do pior, herói "a fila é X%", callout gargalo, tendência 6 semanas, tabela tempo por item)
- [ ] 6. Tela **Pessoas** (ranking + tempo médio/unidade, cockpit de metas reusando S14, lista detalhada de execuções no fim)
- [ ] 7. Tela **Qualidade** (100% empilhado 3 estados com vão 2px, herói % 🟢, danificados em aberto)
- [ ] 8. Filtros pill (período, setor, bruto/útil) combinados e persistidos na visualização salva
- [ ] 9. Visualizações salvas da S10 continuam funcionando (adaptadas + migração de formato por leitura)
- [ ] 10. Gate D-32 intacto (líder só o próprio setor; operador sem acesso) — provado no test:banco/navegador
- [ ] 11. Tooltip em toda marca; sem dois eixos; sem pizza; número-herói antes de gráfico
- [ ] 12. Navegação: 4 filhos no pai Dashboards (D-36), redirects das rotas antigas
- [ ] 13. Temas: testar claro + escuro + esmeralda; nenhum hex cravado em componente
- [ ] 14. Medição objetiva de vazamento (scrollWidth×clientWidth em 700/900/1280/1920/2400) + screenshots lado a lado dos mockups
- [ ] 15. tsc · lint · vitest · build · test:banco (2 rodadas) verdes
- [ ] 16. Conferir task list contra a demanda → revisão do dono → handoff em `_docs/Handoffs/` + memória de aprendizado + índice

## Registro contínuo

- [17/09] Branch criada. Task list registrada (a sessão não tem ferramenta de tasks disponível; o espelho vive aqui, conforme regra 7).
- [17/09] Fechamento da S20 feito nesta mesma conversa antes do checkpoint: commit `03b736a` (herança da S20 na demanda da 16, que estava fora do último commit). Autor conferido `contatodomoby` (E-33).
