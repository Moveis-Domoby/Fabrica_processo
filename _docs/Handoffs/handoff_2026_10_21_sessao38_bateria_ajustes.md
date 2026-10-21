---
titulo: Handoff — 2026-10-21 · SESSAO-38 (bateria de ajustes: cards, rotas, expedição, stand-by, pausas e login)
tipo: handoff
data: 2026-10-21
atualizado: 2026-10-21
tags: [handoff, sessao, sessao-38, kanban, pcp, rotas, expedicao, login]
---

# 📋 Handoff — SESSAO-38 · Bateria de ajustes e melhorias (21/10/2026)

> Demanda: [[SESSAO-38 - Bateria de Ajustes - Cards Rotas Expedicao Stand-by e Login]]. Sessão noturna ditada pelo dono e executada SEM perguntas: um supervisor (Claude) dividiu os 13 pedidos em 5 frentes, cada uma numa cópia isolada do repositório, juntou tudo numa branch de integração, conferiu e **publicou em 21/10 às ~11h40 (horário de Natal)** — a sessão ficou parada várias horas no meio por limite de uso. Diários: [[SESSAO-38-cards]] · [[SESSAO-38-logistica]] · [[SESSAO-38-casca]] · [[SESSAO-38-pausa-especial]] · [[SESSAO-38-tempo-standby]] · [[SESSAO-38]] (supervisor).

## 1. Objetivo da sessão

Os 13 pedidos do dono (texto fiel na demanda): prazo colorido no card e janela do card preenchida (início, vencimento, prioridade urgente/atenção/comum, responsáveis por setor, campos em branco, tempo útil em PCP só no expediente), card de produção sem cliente, organizador da fila por ícone, rotas para qualquer pedido + mapa só ida/só volta, Programação sem espaço vazio, equipe só de entregadores, notificações fecham com qualquer clique, Pedidos em aguardo absorvido pela Expedição com filtros, stand-by no PCP com motivo, cards do PCP padronizados, motivos de pausa especiais, menu com Pedidos abaixo de Rotas e login por nome de usuário.

## 2. O que foi feito (tudo NO AR)

**Banco — 6 migrations aplicadas (`--so`, integração do Tiny idêntica em todas):**
- `20261022010000_plt_card_prioridade_prazo_ordem` (cards): `plt_cards.prioridade` e `responsaveis_setor` (eventos `prioridade_definida`, `responsavel_setor_definido`), `plt_privado.vw_card_ordem`, portas `plt_fn_card_prioridade` e `plt_fn_card_responsavel_setor`, `p_ordem` em `plt_fn_quadro_setor`/`plt_fn_quadro_coluna`/`plt_fn_pcp_quadro`, `p_prioridade` no avulso, janela com prazo/prioridade/responsáveis; quadro do setor sem o nome do cliente; etiqueta "PRIORIDADE" (id 5) arquivada.
- `20261022020000_plt_rotas_qualquer_pedido` + `20261022020100_plt_entregue_confirmado_expedicao` (logística): `vw_pedido_prontidao`, `vw_pedidos_vivos`, `vw_pedidos_para_rota` (a regra única de candidato a rota), `plt_fn_expedicao` (página + 5 contagens numa requisição), equipe só de entregador, "Entregue" de pedido não pronto pede confirmação (`p_confirmar_incompleto`) e fecha tudo como o caminho do Tiny, textos "Pedidos em aguardo" → "Expedição", Pedidos mostra "Em rota".
- `20261022040000_plt_pausa_especial` + `…040001_…indices` (pausa especial): `plt_motivos.especial`, motivos 72 "Faltou peça", 73 "Máquina quebrou", 74 "Pausa solicitada por um líder", projeção `plt_pessoa_pausas`, estado `especial` no agregado diário (não conta como ausente).
- `20261022050010_plt_tempo_util_standby` (tempo útil + stand-by): `plt_cards.standby_*`, eventos `pedido_standby_entrou/saiu`, portas `plt_fn_pcp_standby`/`plt_fn_pcp_standby_sair`/`plt_fn_regua_tempo`, motivos de stand-by (6), PCP fora dos candidatos de rota quando em stand-by, régua do expediente na abertura do app; **PCP ganhou expediente seg–sex 07:30–18:00**.

**Edge Function:** `autenticacao` **v16** (usuário sem acento/espaço/maiúscula, trava de tentativas na senha, conta de tablet fora da senha, PIN aceita usuário, devolve o usuário para o aparelho lembrar).

**Front (main `b030e9c`, Vercel ✅):** cards com prazo colorido (amarelo de verdade, tokens próprios) e bolinha de prioridade, urgente sempre primeiro, botão de ordem só com ícone (quadros, tablet e PCP), janela do card nova, card do PCP refeito (`CartaoPedidoPcp`), stand-by (botão, janela de motivo, aba própria, motivos em Utilitários), tempo útil em todo relógio de card, Expedição com 5 quadradinhos e "Peça por peça", tela Pedidos em aguardo removida (endereço antigo leva à Expedição), Programação sem espaço vazio e mapa Rota inteira / Só a ida / Só a volta, notificações em portal com fechamento por qualquer toque, menu com Pedidos abaixo de Rotas, login lembra o usuário.

## 3. Decisões tomadas (todas ⏳ provisórias — confirmar com o dono)

D-150…D-155 (cards), D-156…D-159 (logística), D-161…D-163 (casca), D-164…D-166 (pausa especial), D-167…D-172 (tempo útil e stand-by) em [[PLT - Decisoes de Produto]]. As que mais pedem o olho do dono:

| Decisão | O que ficou | Para o dono confirmar |
|---|---|---|
| D-150 | Prioridade mora no pedido; todas as peças leem dela | — |
| D-154 | Ordem padrão = prioridade, depois o mais antigo; na alfabética do PCP vale o nome do cliente | ok? |
| D-156 (revisada) | "Entregue" de pedido ainda em produção pede confirmação e encerra tudo dele | ok? |
| D-158 | Equipe do caminhão só com quem é do tipo entregador (Vinícius Marcolino está numa equipe e NÃO é entregador — aparece com "desmarque") | cadastrar Vinícius como entregador? |
| D-165 | Pausa especial: o tempo parado vai para "não conta" (não vira ausente) | ok? |
| D-167 | Card em execução fora do expediente CONTA (hora extra) — inclusive card esquecido rodando à noite | ou deve parar quando a pessoa sai? |
| D-168 | PCP com expediente seg–sex 07:30–18:00 | horário certo? |
| D-170 | "Lançar para as entregas" (do stand-by) conclui as peças que estavam no PCP sem produzir; recusa se houver peça na produção | ok? |

## 4. Bugs

**Resolvidos:** notificações não fechavam fora da barra lateral (o fundo invisível ficava preso dentro dela — E-48 de novo); entrada por usuário não lembrava ninguém e o PIN só aceitava e-mail; 13622 (apagado no Tiny) ainda aparecia na Expedição.
**Descobertos (não corrigidos — dívidas):** o bloco "SESSAO-33 · o fluxo do n8n … ponta a ponta" da bateria falha das 00h às 06h (a fábrica fica fora do lote de madrugada — teste depende do relógio, A-100); o teste "o dono toca no botão" da tela de API falha só na suíte inteira (instável, pré-existente).

## 5. Arquivos alterados

Ver `git log bd75dd2..b030e9c` (37 commits, 5 frentes + integração). Principais: `src/kanban/*` (prazo, prioridade, MarcasDoCard, CartaoUnidade, tempoUtil, ModalStandby, janela), `src/paginas/PCP.tsx`, `Expedicao.tsx`, `Rotas.tsx`, `EntregasDoDia.tsx`, `src/rotas/*`, `src/notificacoes/SinoNotificacoes.tsx`, `src/paginas/Entrar.tsx`, `src/paginas/Utilitarios.tsx`, `src/paginas/dashboards/TemposPessoas.tsx`, `supabase/functions/autenticacao/index.ts`, 6 migrations, bateria (+~110 verificações).

## 6. Impacto nos números visíveis

- **Tempos dos cards ficaram menores**: só contam o expediente (ex.: fila do CNC de 23h05 → 10h30). Os painéis (dashboards) continuam com a conta de antes.
- **Expedição**: deixou de mostrar o 13622 (apagado no Tiny); eram 41 não entregues às 03h de 21/10 e 42 no fim da manhã, com os pedidos novos do dia.
- **Programação → Sem programação**: passou a listar ~37 pedidos (todos os vivos), não só os prontos lançados.
- **Tempos por pessoa**: pausa especial sai de "ausente" e vai para "não conta".

## 7. Notas do cofre atualizadas

[[PLT - Decisoes de Produto]] · [[PLT - Memoria de Aprendizado]] · [[SUPA - Esquema do Banco]] · [[PLT - Lei de Desempenho e Escala]] · [[000 - ORDEM DAS SESSOES]] · [[000 - MAPA DO PROJETO]] · diários `Execucao/SESSAO-38*`.

## 8. Como testar (roteiro do dono — em https://sistema-domoby.vercel.app, logado)

> Gestos que gravam e como desfazer estão ao lado. Não marque "Entregue" em pedido real.

1. **Prazo colorido** — Fábrica → Controle de produção → Montagem: cada card tem a data no canto (verde > 3 dias, **amarela** 2–3, vermelha piscando ≤ 1 dia/hoje/atrasado). Passe o mouse: "faltam N dias".
2. **Sem cliente no card** — no mesmo quadro, o card mostra "Pedido N", o móvel e o tempo — sem nome do cliente. Abrindo o card, o cliente aparece na janela.
3. **Janela do card** — abra um card de pedido: Datas (Início = dia do pedido no Tiny, Vencimento = entrega do vendedor, só leitura), Prioridade (Urgente/Atenção/Comum), Responsáveis por setor ("Pegou" quem iniciou; "Definir quem pega no próximo setor"), Campos "Sem campos personalizados".
4. **Prioridade + urgente primeiro** — na janela, marque **Urgente**: o card ganha borda e bolinha vermelhas e vai para o topo da coluna em todos os setores onde o pedido tem peça. Troque para **Atenção** (bolinha amarela) e volte para **Comum** (desfaz).
5. **Organizar a fila** — o botão de ícone no canto do quadro (e do PCP) alterna: prioridade → data de entrega → alfabética. Urgente fica em cima em qualquer ordem. A escolha fica lembrada no aparelho.
6. **Cards do PCP** — PCP → Pedidos aguardando liberação: cards do mesmo tamanho, aviso de estoque pequeno ("N no estoque"), data e tempo à direita, bolinhas de prioridade embaixo.
7. **Tempo útil** — abra um card que passou a noite na fila → Tempo e histórico: o bloco do PCP diz só "Tempo útil em PCP"; a fila dos setores conta só 07:30–18:00. Fora do expediente o relógio do card mostra a lua "fora do expediente".
8. **Stand-by** — PCP → Aguardando liberação → no card, o botão redondo de stand-by → escolha "Aguardando pagamento" → Pôr em stand-by: o pedido sai da aba e aparece na aba **Stand-by** (motivo, desde, por quem). Ele some de Rotas → Programação e aparece na Expedição com o selo "Stand-by". **Desfazer:** aba Stand-by → "Devolver para aguardando liberação". (O "Lançar para as entregas" cria peças prontas de verdade — só use em pedido que realmente não vai à produção.) Super admin → Auditoria mostra o gesto com o motivo.
9. **Motivos** — Configurações → Utilitários: aba "Motivos de stand-by" (6 motivos) e "Motivos de pausa" com a marca **Especial** (Faltou peça, Máquina quebrou, Pausa solicitada por um líder).
10. **Pausa especial** — pause um card de teste com "Máquina quebrou" e retome: em Dashboards → Tempos por pessoa, o líder vê "Parado · não conta" e o tempo não entra em "ausente". O funcionário não vê diferença.
11. **Rotas para qualquer pedido** — Rotas → Programação → Programar: a lista mostra pedidos prontos, em produção e ainda no PCP (selo em cada um). Marque dois: a caixa "Na rota" aparece colada à lista, sem espaço vazio. **Desfazer:** "Limpar" (nada grava antes de "Programar").
12. **Mapa só ida / só volta** — com pedidos marcados (ou em Já programadas), use os botões no canto do mapa: "Só a ida" e "Só a volta" mostram só aquela parte, com km e minutos.
13. **Equipe** — Já programadas → Equipe: só entregadores; quem não é aparece com "não é entregador — desmarque". Cancelar não grava.
14. **Expedição** — Logística → Expedição: 5 quadradinhos (todos não entregues · com rota · sem rota · prontos · em produção); clicar filtra. O endereço antigo de Pedidos em aguardo cai aqui.
15. **Notificações** — abra o sino e clique em qualquer lugar (menu, quadro, mapa, balão do chat): fecha na hora e o clique vale.
16. **Menu** — Fábrica: Controle de produção → Logística → Rotas → **Pedidos**.
17. **Login por usuário** — saia e entre com **wallace** + sua senha; na próxima vez o campo já vem com "wallace". O e-mail continua valendo. "Entrar com usuário e PIN" aceita o usuário.

## 9. Ficou pendente

- O dono confirmar as decisões provisórias (tabela acima) — em especial o horário do PCP, o card esquecido rodando à noite e o Vinícius como entregador.
- Testes ao vivo que o supervisor não pôde fazer logado (o navegador do app perdeu o login e o Chrome não estava conectado): a conferência foi feita por uma vitrine local com as telas reais e dados reais (sem acesso ao banco pelo navegador) + conferência no banco agindo como o dono, sem gravar. O roteiro acima cobre o que falta ver na tela de verdade.
- Dívidas: teste da bateria dependente do relógio (A-100) e o teste instável da tela de API.
- ClickUp: as 18 tarefas seguem em FAZENDO com o comentário de entrega — quem conclui é o dono.
