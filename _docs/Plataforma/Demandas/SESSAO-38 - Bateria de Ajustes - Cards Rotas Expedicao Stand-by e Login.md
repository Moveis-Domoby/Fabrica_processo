---
titulo: SESSAO-38 — Bateria de ajustes e melhorias (cards, rotas, expedição, stand-by, pausas e login)
tipo: demanda
data: 2026-10-21
status: ✅ entregue e no ar (21/10/2026) — handoff_2026_10_21_sessao38_bateria_ajustes
tags: [plataforma, demandas, kanban, pcp, rotas, expedicao, login]
---

# SESSAO-38 — Bateria de ajustes e melhorias (21/10/2026)

> Ditada pelo dono na conversa, em 21/10/2026 de madrugada, para rodar sozinha durante a noite: um supervisor (Claude) dividiu os pedidos em frentes, cada frente numa cópia isolada do repositório, e no fim o supervisor juntou tudo, conferiu e testou. **Nenhuma pergunta ao dono** — escolhas sensatas registradas como provisórias.

## O pedido do dono (resumo fiel)

1. **Card de produção de todo pedido mostra a data de entrega** (a que o vendedor coloca no Tiny), só a data, mudando de cor: **verde** com mais de 3 dias; **amarela** com 2 ou 3 dias; **vermelha bem chamativa** com 1 dia ou no próprio dia. A janela do card responde com os dados que já existem:
   1. **Início** = data em que o pedido foi criado no Tiny;
   2. **Vencimento** = data de entrega do vendedor;
   3. **Prioridade** deixa de ser etiqueta: o PCP define a qualquer momento (inclusive ao criar o card) — **Urgente** (sempre primeiro em todos os setores, independente do filtro, bolinha vermelha), **Atenção** (bolinha amarela), senão **comum** (bolinha verde);
   4. **Responsáveis**: lista de quem pegou o card em cada setor; líder/admin define o responsável do próximo; ninguém edita o que já foi executado;
   5. **Campos**: podem ficar em branco;
   6. **Tempo e histórico**: o PCP não tem fila — mostra só **"Tempo útil em PCP"**; todo tempo do card respeita o horário do setor (fora do expediente, sem hora extra, o tempo para — mesmo na fila).
2. O card do pedido **em produção não mostra o nome do cliente**.
3. Em todo o kanban e no PCP, um **organizador da fila** por **data de entrega**, **prioridade** (Urgente > Atenção > normal) e **ordem alfabética** (letras > números > símbolos) — troca por clique num **ícone**, sem texto.
4. **Rotas**: qualquer pedido pode ser programado a qualquer momento (pronto, em produção ou parado no PCP); o já programado aparece só em "Já programadas". No mapa, em vez de escolher um trecho entre dois pedidos, escolher **só a ida** ou **só a volta**.
5. **Programação**: sem o espaço vazio entre "Na rota" e "Sem programação" — "Na rota" aparece quando algo é marcado e cresce enquanto a outra lista diminui.
6. **Equipe do caminhão**: só quem é de fato entregador.
7. **Notificações**: qualquer clique em qualquer lugar fecha na hora.
8. **Pedidos em aguardo deixa de existir**: as rotas respondem a todos os pedidos; a **Expedição** ganha filtros de um clique — todos os não entregues · com rota programada · sem rota programada · prontos · ainda em produção.
9. **Stand-by no PCP**: todo card do PCP pode ir para stand-by com **motivo obrigatório** (motivos nas configurações; vai para a auditoria); aba própria no PCP; de lá, **lançar direto para as entregas** ou **devolver para aguardando liberação**; em stand-by não aparece nas rotas e **não conta tempo**.
10. **PCP**: cards do mesmo tamanho e com desenho melhor (o aviso de peça no estoque não aumenta o card; o lado direito não fica só com o cronômetro).
11. **Motivos de pausa especiais** que param o tempo do funcionário (sem aviso para ele): Faltou peça, Máquina quebrou, Pausa solicitada por um líder; marca "especial" ao criar/editar motivo.
12. **Menu**: o grupo Pedidos logo abaixo do grupo Rotas.
13. **Login** com nome de usuário e senha (sem digitar o e-mail toda vez).

## As frentes

| Frente | Itens | Ramo | Numeração reservada |
|---|---|---|---|
| F1 — Cards | 1.1–1.5, 2, 3, 10 | `sessao-38-cards` | D-150…D-155 · E-120…E-124 · A-85…A-88 · migrations `202610220100xx` |
| F2 — Logística | 4, 5, 6, 8 | `sessao-38-logistica` | D-156…D-160 · E-125…E-129 · A-89…A-92 · `202610220200xx` |
| F3 — Casca | 7, 12, 13 | `sessao-38-casca` | D-161…D-163 · E-130…E-132 · A-93…A-94 · `202610220300xx` |
| F4 — Pausa especial | 11 | `sessao-38-pausa-especial` | D-164…D-166 · E-133…E-135 · A-95…A-96 · `202610220400xx` |
| F5 — Tempo útil + stand-by | 1.6, 9 | `sessao-38-tempo-standby` | D-167…D-172 · E-136…E-140 · A-97…A-99 · `202610220500xx` |

F5 roda depois das outras (mexe no mesmo quadro do PCP, nas mesmas regras de rota e no mesmo motor de tempo).

## Tarefas no ClickUp (lista PRODUÇÃO do DPTO TI)

Prazo com cor (17tya50jn2t) · Janela do card preenchida (17tya50jn2u) · Prioridade (17tya50jn2v) · Responsáveis por setor (17tya50jn2w) · Tempo útil em PCP (17tya50jn2x) · Sem nome do cliente (17tya50jn2y) · Ordenar a fila (17tya50jn2z) · Cards do PCP (17tya50jn30) · Stand-by (17tya50jn31) · Pausa especial (17tya50jn32) · Rotas para qualquer pedido (17tya50jn33) · Mapa ida/volta (17tya50jn34) · Programação sem espaço vazio (17tya50jn35) · Só entregadores (17tya50jn36) · Expedição com filtros (17tya50jn37) · Notificações fecham com clique (17tya50jn38) · Menu Pedidos abaixo de Rotas (17tya50jn39) · Login por usuário (17tya50jn3a).

## Fora do escopo

Tudo o que não está acima. Nada no n8n (só leitura). Nada no Tiny.
