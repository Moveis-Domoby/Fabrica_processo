---
id: D-203
aliases: [D-203]
titulo: "O TEMPO CERTO: o calendário da fábrica, a pausa sozinha no fim do expediente, as regras de tempo válido e um cálculo único para todas as telas"
tipo: decisao
data: 2026-10-30
status: vigente
revisa: ["[[D-167 - O TEMPO UTIL do card so o expediente do setor o PCP nao tem|D-167]]"]
revisada_por: []
complementa: ["[[D-029 - Controle de tempo pelo admin horario de funcionamento pausas|D-29]]", "[[D-048 - Execucao um por vez com pausa por lider tempo de PCP e|D-48]]", "[[D-165 - O que nao contar o tempo quer dizer com precisao|D-165]]", "[[D-197 - Sem card so 5 minutos contam como trabalho a tela segue|D-197]]", "[[D-198 - O CARD ESQUECIDO na MONTAGEM 2 h rodando sem parar perguntam|D-198]]", "[[D-202 - OS AVISOS QUE CADA UM RECEBE ESCOLHIDOS EM CONFIGURACOES|D-202]]"]
area: [tempos-paineis]
tags: [decisao, area/tempos-paineis]
---
# D-203 · O TEMPO CERTO: o calendário da fábrica, a pausa sozinha no fim do expediente, as regras de tempo válido e um cálculo único para todas as telas (30/10/2026 — as 17 respostas do dono; SESSAO-42) — ↩️ revisa a D-167 (a hora extra não autorizada deixa de contar), ↪️ D-29, D-48, D-165, D-197, D-198, D-202

**Pedido do dono (29/10):** um painel de revisão do tempo de montagem e dos tempos de cada setor, com as regras controladas em Configurações — *"atualmente os dados estão todos errados"*; tratar o card esquecido de um dia para o outro, as idas e voltas, e os dados irreais que já estão no banco. As respostas (30/10, no relatório do plano), todas "de acordo" com a recomendação, menos as com texto do dono:

1. **Almoço** 12:00–13:00 em todos os setores; o café não sai da conta.
2. **Sábado** fora do expediente — liberado dia a dia no calendário.
3. **Hora extra** só conta quando o líder (ou o admin) autoriza.
4. **Pausa sozinha no fim do expediente**, em todos os setores, motivo "Fim do expediente".
5. De manhã, o card arrastado para a frente **sem retomar**: os minutos da manhã não contam.
6. O aviso de card esquecido **sem resposta em 15 min** vira pausa no instante do aviso.
7. Mínimo de **3 min**, teto de **4 h** na Montagem, "**3 vezes a mediana** do modelo" (com pelo menos 5 de base) — revistos depois de 2 semanas de dado limpo.
8. Volta para a fila em até **5 min** = clique errado; volta para setor anterior = **retrabalho**, fora da média.
9. O operador **pode pular** a execução — *"mas isso envia uma notificação aos admins, essa notificação deve poder ser desligada"*.
10. **Gestos de administrador** fora das médias.
11. **Dados oficiais a partir de 26/10/2026.**
12. **Montar em lote** (2+ iguais juntos, tempo dividido): só na Montagem e só com o mesmo modelo.
13. **As cores do mesmo móvel** são o mesmo modelo no tempo padrão.
14. **Mediana** no lugar da média; "na média" = até 10%.
15–17. (SESSAO-43) histórico do Trello importado e marcado; a TV fica como está (só tema e organização); o Modo TV em paralelo, com permissão própria.

**Como ficou:** Configurações → Controle de tempo em 7 abas (Expediente e intervalos · Calendário · Hora extra · Regras por setor · Equipe no painel · Modelos · Recálculo); o card rodando é pausado sozinho no fim da janela do setor (ou da hora extra) e quem estava nele sai do setor; o aviso sem resposta pausa; "Montar juntos" na fila da Montagem; o aviso "Móvel pulou a montagem" em Configurações → Avisos; e o **cálculo único** (trechos, passagens, tempo padrão por modelo, resumos por dia) que o card, a janela, Tempos por pessoa, Pessoas, Meu desempenho, as metas e Tempo por setor passam a ler — recalculado desde 19/10. Técnico: migrations `20261031010000…040000`; ver [[SUPA - Esquema do Banco]] e o diário [[SESSAO-42]].
