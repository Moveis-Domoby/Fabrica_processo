---
titulo: Diário de execução — SESSAO-48 (cancelar a fabricação de verdade e a plataforma que recarrega sozinha)
tipo: execucao
data: 2026-11-11
tags: [execucao, sessao-48, producao, cancelamento, pcp, estoque, publicacao, recargas]
---

# Diário — SESSAO-48 (11/11/2026)

Demanda: [[SESSAO-48 - Cancelar Fabricacao de Verdade - Peca de Pedido Pergunta o Destino]] · handoff de entrada: [[handoff_2026_11_11_cowork_sessao48_cancelamento_e_recargas]]
Ramo `sessao-48-cancelar-fabricacao-recargas`, na pasta principal (sem worktree), nascido da `main` `34aa418` (a main local estava 4 commits atrás — só cofre do Cowork; avançada por `fetch origin main:main`).

## Partida (11/11)

- Prompt do dono: atualizar a main, seguir o CLAUDE.md, executar a SESSAO-48 começando pelo handoff do Cowork; **não perguntar negócio** (o que faltar vira provisória registrada); ramo próprio (toda subida para a main publica o site); **migration, o acerto das peças paradas, a mudança na Vercel e a publicação só com o OK dele**; no fim, em português de gente e sem códigos: o que foi feito, como testar com fotos e as pendências.
- Nenhuma outra sessão rodando na pasta (lista de sessões: a 47 parada desde 10/11 00:37). Fica fora dos commits: `_docs/.obsidian/graph.json`, `workspace.json` (estado do Obsidian) e `supabase/.temp/`.
- Leitura feita: CLAUDE.md, memória de aprendizado (fim dos E/A + M/F + buscas por tema), decisões (D-61, D-62, D-75, D-129, D-132, D-201 e as da 47), visão geral, lei de desempenho (§1–§13), modelo de sistema (componentes, kanban, PCP, aviso de versão), esquema (as tabelas `plt_`), ordem das sessões, handoff da 47, o diário da 47 (as lições que valem), perguntas em aberto (nada sobre o tema).
- **Tarefas no ClickUp:** a demanda diz "a criar com o OK do dono" (o Cowork não criou) — não criadas; pedir o OK no fim (regra 19).

## Numeração (conferida na pasta, no ramo da 46 e no remoto)

- Decisões **D-290…** · erros **E-250…** · acertos **A-212…** · dívida da lei **36…**
- Migrations depois de `20261109050000` → `20261111010000…`

## Task list (espelha a demanda)

**Frente 1 — mover para CANCELADO / NÃO ENCONTRADO tira da produção**
1. ⏳ Sinal novo na etapa (`cancela_fabricacao` + motivo), ligado no CANCELADO e no NÃO ENCONTRADO da LIMPEZA E EMBALAGEM; o admin liga/desliga em Setores e etapas, no lugar de "conclui a produção".
2. ⏳ O fato de chegada numa etapa dessas (qualquer caminho: arrasto, tablet, Mover, liberação do PCP) gera `fabricacao_cancelada` (autor, de onde veio, motivo, pedido/reposição) + projeção `cancelada_em`; peça de pedido vivo perde o pedido (`unidade_desvinculada`) e a vaga volta; idempotente.
3. ⏳ A regra única do que conta: peça cancelada sem categoria (Estoque/Top 20), fora dos contadores, do PCP, da Expedição e dos painéis; log, Auditoria, histórico; aviso ao vivo (setor e estoque).
4. ⏳ Na coluna: "Cancelada em dd/mm · some em N dias" (ou "Não encontrada em…") no lugar do tempo de fila; ninguém inicia nem trabalha peça cancelada (banco recusa, tela não oferece).
5. ⏳ Arrastar de volta em 7 dias desfaz (`fabricacao_retomada`): volta a contar; com a vaga ainda aberta volta ao pedido e o aviso some; senão volta sem dono (provisória); reposição só perde a peça (provisória).

**Frente 2 — a vaga volta ao PCP com aviso, e o PCP decide**
6. ⏳ O pedido ganha o selo "Peça cancelada na produção" / "Peça não encontrada" (texto + cor) e o sino avisa logística e admin.
7. ⏳ A janela "O que aconteceu?" (uma leitura ao abrir): as peças canceladas (móvel, k/n, coluna, quem, quando) e o que o pedido ainda tem em produção ou pronto; "Produzir de novo" fecha o aviso; "Remover do PCP" com motivo (pedido cancelado — "Cancele também no Tiny"; tirar da linha de produção — "O que houve?" obrigatório; outro motivo — texto obrigatório).
8. ⏳ "Remover do PCP" no banco: fato `pedido_removido_pcp`, projeção no card, o pedido sai de todas as portas do PCP (regra única), log e Auditoria; aba "Cancelados e removidos" com o motivo e quem; "Devolver ao PCP" (`pedido_devolvido_pcp`); remover não mexe no Tiny nem nas peças em produção/prontas (a janela avisa quantas).

**Frente 3 — pedido cancelado no Tiny pergunta o destino**
9. ⏳ Cancelamento do Tiny com peça em produção (não concluída): marca "esperando decisão" (fato + projeção), sai do "produção de pedido", etiqueta "Pedido cancelado — esperando decisão da logística", sino para logística e admin. A peça pronta segue indo sozinha ao ESTOQUE.
10. ⏳ A janela "Para onde vai este móvel?" (uma leitura ao abrir; peça por peça ou todas): seguir para o estoque · passar para outro pedido (régua da D-62, maquinaria da D-201; desabilitada com o porquê) · cancelar a fabricação (o gesto da frente 1).
11. ⏳ Sem decisão e chegou ao fim da linha → ESTOQUE sem dono e a pendência fecha com fato; pedido "descancelado" antes da decisão → a marca sai e a peça volta ao pedido.

**Frente 4 — a limpeza dos 7 dias e a recuperação**
12. ⏳ As duas colunas só mostram os últimos 7 dias (filtro na leitura, com índice) — mesmo antes da limpeza.
13. ⏳ No 8º dia: `card_arquivado` com o motivo, sem relógio novo (na rotina diária que já existe); nada apagado.
14. ⏳ Recuperar: a peça arquivada na busca geral e na Auditoria com o motivo; o admin recupera (`fabricacao_retomada` + desarquivar) e ela volta para a fila da LIMPEZA E EMBALAGEM; os 7 dias numa configuração.

**Frente 5 — a plataforma que recarrega sozinha**
15. ⏳ (a) Documentação não publica o site (`ignoreCommand` no `vercel.json`) — **só com o OK do dono**.
16. ⏳ (b) A versão é o código (hash do arquivo de entrada no `versao.json`), não o commit.
17. ⏳ (c) Recarregar só em momento seguro no tablet e na TV (sem janela, sem PIN, 1 min sem toque); escritório na troca de tela; pedaço sumido no tablet: "Atualizando a plataforma…" e uma recarga; ver a proteção contra versões misturadas da Vercel (perguntar se for paga).
18. ⏳ (d) A abertura grava o porquê (navigate/reload/back_forward, aba descartada, motivo da própria plataforma) e a Auditoria mostra em português.
19. ⏳ (e) A troca de setor por PIN recarrega uma vez só (reproduzir o laço de 10/11 11:23).
20. ⏳ (f) Regra da casa: subir para a main é publicar (memória + CLAUDE.md).

**Acerto (só com o OK do dono)**
21. ⏳ Manutenção `supabase/manutencao/2026-11-11_cancelado_vira_gesto.sql` ensaiada com contagens antes/depois; aplicada só com o OK; recontar o estoque; conferir a Estante Basic 7 nichos e os móveis afetados.

**Geral**
22. ⏳ Celular 375 e tablet 768 sem rolagem lateral; bateria 2×, tsc, lint, vitest, build, advisors; ensaio ×100 das portas novas/tocadas; cada tela em 1 requisição, sem relógio novo.
23. ⏳ Cofre: decisões provisórias, memória, esquema, lei, modelo de sistema, handoff com fotos, ordem, mapa, resultado na demanda.

## Lições da memória que valem nesta sessão

- Regra 20 (nenhum `cd`); `git branch --show-current` antes de todo commit (E-113); commit por caminho explícito; `git diff --numstat` antes (E-242).
- Função recriada = extração da última versão + md5 do corpo vivo (E-24/A-96/A-97); mudou assinatura → `grep` da velha na bateria inteira (E-120/E-236) e nas migrations que a recriam (E-178); check de tipos: o `validate` mora na mais nova (E-19).
- Bateria sempre para arquivo; dela só contagem e vermelhos (E-235). Bloco novo em `{ }` com faixa própria de ids. `vitest run --root "$R" --dir src` (A-194).
- Chave nova em jsonb que outro teste compara só nasce quando tem o que dizer (E-237). Função por linha em porta de quadro não compõe outras funções da casa (E-238); caso novo em `OU` de visão cita colunas de UMA tabela (E-239). Ensaio ×100 antes da tela, medindo a 6ª chamada (A-209).
- Script com crase/`$` vai em arquivo pela ferramenta de escrita (E-249/E-247); `cat >` só com heredoc (E-180).
- Leitura do banco de produção pode ser barrada pelo ambiente — não contornar (A-202).

## Diário
