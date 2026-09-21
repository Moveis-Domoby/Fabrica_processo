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

- [x] 1. Abrir e estudar os 4 mockups + 000-LEIA-ME (régua de qualidade)
- [x] 2. Tokens `--dm-serie-fila`/`--dm-serie-execucao` em `tokens.css` (+ variante escura) e nota no LEIA-ME (dos DOIS locais — reorganização do cofre em andamento)
- [x] 3. Migration 28 (portas de leitura novas) escrita + `test:banco` 2 rodadas verdes — **aplicar depende de aprovação do dono**
- [x] 4. Tela **Visão do dia** codada (andon: 4 heróis, tiles, gargalo, produção por hora, fim de linha; Realtime + polling) — 🟠 validação visual com login pendente
- [x] 5. Tela **Tempo por setor** codada — 🟠 validação visual pendente
- [x] 6. Tela **Pessoas** codada (ranking, cockpit S14, lista detalhada) — 🟠 validação visual pendente
- [x] 7. Tela **Qualidade** codada (100% empilhado, herói, danificados em aberto, divergências) — 🟠 validação visual pendente
- [x] 8. Filtros pill combinados, na URL e persistidos na visualização salva
- [x] 9. Visualizações salvas: formato novo tela+filtros; o antigo (widgets) traduzido por leitura — 🟠 conferir no banco real com as visualizações existentes
- [x] 10. Gate D-32: provado no test:banco (líder só FITAMENTO; operador zero) — 🟠 conferir no navegador com usuário real
- [x] 11. Tooltip em toda marca; sem dois eixos; sem pizza; número-herói antes de gráfico
- [x] 12. Navegação: 4 filhos no pai Dashboards (D-36); `/dashboards` e `/dashboards/geral` redirecionam (rota sem login cai no /entrar — conferido no navegador)
- [x] 13. Temas: claro ✅ (ativa amarela, pílulas brancas) · esmeralda ✅ (ação verde, séries seguem azul/âmbar fixos) · esmeralda-escuro ✅ (tema do dono, telas inteiras) — troca via `data-tema` no DOM, sem tocar o perfil
- [x] 14. Vazamento **ZERO** nas 4 telas: Visão do dia (23 números × 700/900/1280/1920/2400px), Tempo por setor (39–43 × 5 larguras), Pessoas (64 × 700/1280/2400), Qualidade (46 × 700/1280/2400) — sem rolagem horizontal em nenhuma medição
- [x] 15. tsc ✅ · lint ✅ · vitest 47/47 ✅ · build ✅ · test:banco TUDO VERDE (2 rodadas)
- [x] 16. Task list conferida contra a demanda ✅ → aprovada pelo dono em 21/09 → **mesclada na `main` pelo PR #4 (18/09, commit do dono com a reorg do cofre junto)** → handoff linkado no índice, no mapa e resultado preenchido na demanda (21/09)

## Registro contínuo

- [17/09] Branch criada. Task list registrada (a sessão não tem ferramenta de tasks disponível; o espelho vive aqui, conforme regra 7).
- [17/09] Fechamento da S20 feito nesta mesma conversa antes do checkpoint: commit `03b736a` (herança da S20 na demanda da 16, que estava fora do último commit). Autor conferido `contatodomoby` (E-33).
- [17/09] **Migration 28** (`20260917120000_plt_dashboards_verdade.sql`): 8 portas de leitura — `plt_fn_dash_agora` (tiles + linha total; só os 6 setores de produção — PCP é `entrada`), `plt_fn_dash_pcp_dia`, `plt_fn_dash_dia`, `plt_fn_dash_producao_hora`, `plt_fn_dash_fim_de_linha` (o destino do dia é o ÚLTIMO terminal da unidade — lançar ESTOQUE→ROTAS não duplica), `plt_fn_dash_danificados_dia`, `plt_fn_dash_danificados_abertos`, `plt_fn_dash_tendencia_semanas` (só para quem mede a fábrica inteira — a jornada cruza setores). 3 erros pegos pelo `test:banco` e corrigidos: contagem de setores de produção (6, não 7), dupla contagem no fim de linha, e a linha total do agregado vazando para o operador (`WHERE` não corta linha de agregado — tem que ser `HAVING`). TUDO VERDE em 2 rodadas, +9 verificações. **Não aplicada** (regra crítica 2).
- [17/09] **Tokens** `--dm-serie-fila`/`--dm-serie-execucao` (fixos; variante clara nos escuros) + notas no LEIA-ME e no modelo de sistema. Motivo: `--dm-serie-1` segue a ação do tema → no esmeralda seria VERDE, e verde é exclusivo da qualidade.
- [17/09] **Front**: `src/dashboards/` ganhou `painel.ts` (filtros na URL: `?dias&setor&tempo&v`; precedência parâmetro > visualização > padrão), `opcoes.ts`, `componentes/` (Heroi com `.num-heroi`/`.num-tile` por container query, TooltipGrafico, Filtros pill, Visualizacoes) e as portas novas em `api.ts` com `normalizarConfiguracao` (visualização da S10 com `widgets` é traduzida POR LEITURA — nada migra no banco). 4 telas em `src/paginas/dashboards/` (VisaoDoDia com Realtime `plt_cards` + polling 60s; TempoPorSetor; Pessoas com `CartaoMeta` extraído de MeuPainel para `src/metas/CartaoMeta.tsx` e a lista detalhada movida para cá — decisão (b) do dono; Qualidade com delta p.p. vs período anterior). Rotas + menu com 4 filhos; `/dashboards/geral` redireciona. `Dashboards.tsx` da S10 removido.
- [17/09] ⚠️ **Outra frente reorganizando o cofre em paralelo** (dono/Cowork): muitos arquivos `_docs/` modificados/untracked que NÃO são desta sessão — commits sempre por caminho explícito (E-23). A demanda passou a apontar os mockups em `_docs/Plataforma/Inspiracao/dashboards/` (antes `docs/inspiracao/`): a nota dos tokens foi replicada no LEIA-ME do local novo; conteúdo da demanda inalterado.
- [17/09] **Incidente de encoding**: usei `Get-Content -Raw | Set-Content` do PowerShell para trocar imports em 3 páginas e a codificação corrompeu (UTF-8 lido como ANSI → mojibake). Corrigido regravando os arquivos inteiros pela ferramenta de escrita. Registrado como E-34 na memória de aprendizado.
- [17/09] Verificação: `tsc` ✅ · `lint` ✅ (1 erro de pureza do React corrigido: `Date.now()` em render) · Vitest **47/47** ✅ · `build` ✅ (bundle 1,71 MB — DT-ARQ9, sem mudança) · `test:banco` TUDO VERDE.
- [18/09] **E-34, 2º ato**: o dono viu "OlÃ¡, Wallace!" — o corte do CartaoMeta no MeuPainel também tinha passado pelo pipeline do PowerShell (mojibake COMPILA; tsc/lint/build não pegam). Restaurado do commit íntegro via `git show` no Bash + edições reaplicadas; `grep 'Ã' src` zerado. Linha do E-34 completada na memória de aprendizado.
- [18/09] **Migration 28 APLICADA** com aprovação do dono, pela API do Supabase (caminho da S15/S19/S20 — A-15): impressão digital da integração **idêntica** antes = depois (`15152f89…`, 114 colunas); 8 funções DEFINER no ar; advisors = +8 WARN esperados, nada além dos pré-existentes (já herdados pela SESSAO-21). Nota do esquema atualizada.
- [18/09] **Validação ao vivo com o login do dono** (preview): 4 telas com dado real (fila 100% do tempo útil — cards de teste passaram dias parados; PCP 140 a liberar; qualidade SECC/FITAMENTO 100% 🟢, FURAÇÃO 66,7% com 33,3% 🔴), console limpo em todas. Achado e corrigido na hora: eixo Y da tendência cortava "300h" (largura 40→56px). Visualização salva: salvar → aparecer no dropdown → **aplicar de OUTRA tela navega para a tela dela com os filtros** (`?v=2`, bruto+90d restaurados) → excluir. Nenhuma visualização antiga da S10 existia na conta do dono (a tradução por leitura fica coberta pelo `normalizarConfiguracao` testável).
- [18/09] Falso alarme visual durante a troca de tema: screenshot no mesmo instante da troca pegou a transição de 150ms no meio (pílulas "escuras" em fundo claro); o valor computado já era o certo — 2ª captura normal (parente do E-32: medir tela que ainda não pintou não vale).
- [18/09] ⚠️ A reorganização do cofre (outra frente, em andamento AO VIVO) moveu `docs/execucao/` → `_docs/Plataforma/Execucao/` **sem a SESSAO-16.md** (nasceu depois do snapshot dela) e apagou a pasta antiga do working tree. Este arquivo foi recriado AQUI (local novo) a partir do commit `e26f677`; as exclusões da pasta antiga são da reorg e **não** entram nos commits desta sessão (E-23).
