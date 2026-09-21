---
titulo: Handoff — SESSAO-22 · Produção: filas reais, tempo de PCP e paginação
tipo: handoff
data: 2026-09-21
atualizado: 2026-09-21
tags: [handoff, sessao, plataforma, bloco-5, kanban, tempo, paginacao, d-48]
---

# 📋 Handoff — SESSAO-22 · Produção: filas reais, tempo de PCP e paginação (D-48)

**Branch:** `sessao-22-filas-tempo-paginacao` (2 commits: banco `2f8be0b` + front `6de4518`) — **aguardando sua revisão nesta conversa (D-20)**
**Banco:** migration **29** (`20260921120000_plt_filas_tempo_pausa_paginacao.sql`) **escrita e testada, NÃO aplicada** — aplicar é o checkpoint F-08 desta conversa, junto com 2 SQLs de manutenção (limite 1 nos setores existentes; migração dos cards da "Chegada").
**Demanda:** [[SESSAO-22 - Producao - Filas Reais Tempo de PCP e Paginacao]] · **Memória:** [[SESSAO-22|Execucao/SESSAO-22]]
**Decisões:** **D-48** (nova — revisa D-24 e Q-17; suas 5 respostas de 21/09) · D-02/M-08 · D-14 · D-22/D-31 · RNF-05/M-02 · D-27

## 1. O que foi feito

- **Fim da coluna "Chegada" nos setores de produção.** Evento de chegada sem etapa é completado NA ESCRITA com a etapa fila do setor (trigger novo — vale para interface, API e automação). O quadro não desenha mais a coluna nos setores de produção com fila; os seletores de destino (Mover, Liberar, Danificados) mostram a fila como padrão e nem oferecem "Chegada". PCP e terminais não mudaram. Setor de produção sem fila (hoje: nenhum, você confirmou) ganha aviso pedindo o cadastro.
- **Cards vivos da "Chegada"**: SQL de manutenção pronto (evento `movimentacao_etapa` em lote, origem `api`, com passos contar → executar → conferir) — **testado no test:banco, roda na aplicação com as contagens registradas**.
- **Tempo em PCP verdadeiro (D-48): é do PEDIDO.** Projeção nova `liberado_completo_em` no card de pedido (recalculada a cada liberação e a cada atualização do Tiny, retroativa para o histórico): o relógio vai da entrada no PCP até a liberação da ÚLTIMA unidade. O card de unidade mostra "Pedido ficou X em PCP" (com "ainda contando" no parcial), a linha do tempo ganhou o bloco "Pedido no PCP", e `plt_vw_permanencias` fecha a permanência do pedido nesse instante. **Pedidos em aguardo** ganhou o relógio seguinte: "Completo há X aguardando o lançamento" (o insumo do futuro cálculo de tempo de entrega) e "1ª unidade pronta há X".
- **Paginação nos quadros + lei nova de sistema.** Cada coluna carrega **10 cards** e um "Ver mais (N)" que busca só a próxima página daquela coluna; o contador da coluna é o **total real** (contagem no servidor, na própria consulta paginada). O PCP filtra "pedidos abertos" **no servidor** (pedido 100% liberado sai do quadro sem baixar nada a mais) e pagina pedidos E unidades. A regra que você pediu virou lei escrita: **regra 17 do CLAUDE** (repo + cofre) e seção própria no **Modelo de Sistema** — *"cada tela requisita apenas o que ela mostra"* (RNF-07).
- **Execução: um por vez + pausa por líder (D-48).** Setor novo nasce com **limite 1**; os existentes vão a 1 pela manutenção; líder do setor (e admin) ajusta o teto nas configurações do setor (RPC nova com trilha — D-40). Eventos novos `execucao_pausada`/`execucao_retomada` (append-only, com autor e execução referenciada): **pausado não conta tempo nem ocupa o limite** — é o que deixa a urgência entrar — e **retomar passa pela mesma trava** ("finalize a urgência antes", sua resposta 5); a própria pessoa retoma (resposta 3). Tudo em trigger (M-14). `plt_vw_execucoes` e as **6 portas de tempo** (lista detalhada, tempos por setor/pessoa/item, metas, tendência) **descontam os intervalos pausados**.
- **UI da pausa:** card pausado mostra `⏸ Pausado há X` + quem executa (ícone + texto — M-12); no quadro, o líder tem "Pausar" ao lado do Finalizar; no tablet, o card pausado vira um "Retomar" de 64px com PIN. A linha do tempo lista pausa/retomada com autor e mostra "Xmin de pausa descontados".

## 2. Verificação executada

| O quê | Resultado |
|---|---|
| `npm run test:banco` (2 rodadas + cenários novos da S22) | ✅ TUDO VERDE — inclusive os 2 SQLs de manutenção rodados de verdade no harness, a prova aritmética da pausa (90min de relógio − 70 pausados = 20 contados, na view E na porta de dashboard) e o tempo de PCP parcial/completo/retroativo. Re-rodado depois de outra frente acrescentar `produtos` ao espelho do schema — segue verde |
| `npx tsc -b` · `npm run lint` · `npm test` · `npm run build` | ✅ · ✅ · ✅ **49/47→49** (2 testes novos de pausa) · ✅ (bundle sem mudança relevante) |
| Mojibake (E-34) | ✅ grep zero no `src/` |
| Console do navegador (login) | ✅ limpo |
| **F-07 completo (375/768px nas telas de dados)** | ⏸️ **depende da migration**: o front novo lê colunas que ainda não existem no banco de produção. Alvos ≥44px garantidos por construção (`min-h-toque-md`/`galpao`). Faço a medição logo após a aplicação, nesta conversa |

## 3. O checkpoint desta conversa (F-08) — precisa do seu OK

1. **Aplicar a migration 29** (md5 da integração antes/depois + `get_advisors` depois — +2 WARN esperados: RPC do limite e as portas recriadas seguem o padrão de sempre).
2. **Rodar `manutencao/2026-09-21_limite_execucoes_padrao_1.sql`** — todos os setores com limite 1 (sua resposta 4).
3. **Rodar `manutencao/2026-09-21_migrar_cards_chegada_para_fila.sql`** — contagens antes/depois registradas na memória de execução.
4. F-07 nas telas com dado real + sua validação ao vivo.
5. Merge na `main` com seu OK (D-20).

## 4. Como validar depois da aplicação (10 minutos)

1. `npm run dev`, entre e abra **Fábrica → um setor de produção** (ex.: FITAMENTO): sem coluna "Chegada"; cada coluna com contador real e "Ver mais" quando passar de 10; na aba Network, a carga inicial só traz os cards exibidos.
2. Mova um card para outro setor SEM escolher etapa → ele aparece na **fila** do destino ("A …").
3. Abra a linha do tempo de uma unidade de pedido antigo: o bloco **"Pedido no PCP"** mostra dias, não "0:11". O card mostra "Pedido ficou X em PCP".
4. Com dois cards no mesmo setor: inicie um, tente iniciar o outro → recusa dizendo o que fazer. Como líder, **Pause** o primeiro → o segundo inicia. Tente **Retomar** com o segundo aberto → "finalize a urgência antes". Finalize e retome → o tempo volta a contar; a linha do tempo mostra a pausa descontada.
5. **Logística → Pedidos em aguardo:** pedido completo mostra "Completo há X aguardando o lançamento".
6. **Painel admin → Setores e etapas:** como líder, o campo "Limite de cards em execução por pessoa" do seu setor salva (e aparece na trilha).

## 5. Pendente / decisões para você

- 🔶 **F-08**: os passos do item 3 acima — nada tocou o banco de produção ainda.
- ⚪ **Trabalho paralelo no working tree** (estudo do Tiny fábrica/S25 e demanda da S21): não foi tocado nem commitado por esta sessão (E-23).
- ⚪ **Dashboards "Tempo por setor" e o PCP:** o tempo de PCP do pedido agora existe na view, mas a tela de tempos por setor segue somando só fila (`eh_fila`) × execução — expor o tempo de PCP como métrica própria de dashboard ficou de fora do escopo (posso anotar como melhoria para a S23/S16 se você quiser).
- ⚪ **SESSAO-21 (cutover)** foi promovida a "pronta para code" no índice e roda logo após este handoff, em conversa própria — nada desta sessão a bloqueia.

## 6. Notas do cofre atualizadas

[[PLT - Decisoes de Produto]] (D-48) · [[PLT - Requisitos]] (RF-15, RF-16, RNF-07) · [[PLT - Memoria de Aprendizado]] (A-16, A-17, E-19↪️) · [[PLT - Modelo de Sistema]] (lei de requisição, quadro paginado, pausa/tempo de PCP) · [[CLAUDE - Regras do Claude Code (repo)]] + `CLAUDE.md` do repo (regra 17) · demanda (item 2 com a D-48) · memória de execução em `_docs/Plataforma/Execucao/SESSAO-22.md`

## Ver também

[[handoff_2026_09_18_sessao16_dashboards]] · [[SESSAO-22 - Producao - Filas Reais Tempo de PCP e Paginacao]] · [[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]] · [[000 - ORDEM DAS SESSOES]]
