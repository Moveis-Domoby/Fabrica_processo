---
id: D-176
aliases: [D-176]
titulo: "O PAINEL DE MOTIVOS: os maiores problemas da fábrica e das rotas, do maior para o menor"
tipo: decisao
data: 2026-10-21
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-032 - Dashboards foco pesado em tempo so lider e admin|D-32]]", "[[D-042 - Dashboards guiados por imagem docs inspiracao dashboards e|D-42]]", "[[D-164 - Motivos de pausa ESPECIAIS Faltou peca Maquina quebrou|D-164]]", "[[D-169 - O stand-by no PCP|D-169]]", "[[D-116 - Motivos de nao entregue e de desfazer a entrega|D-116]]"]
area: [tempos-paineis, logistica-rotas]
tags: [decisao, area/tempos-paineis, area/logistica-rotas]
---
# D-176 · O PAINEL DE MOTIVOS: os maiores problemas da fábrica e das rotas, do maior para o menor (21/10/2026, pedido do dono — SESSAO-39) — ↪️ D-32/D-42/D-164/D-169/D-116

**Pedido do dono:** *"Em dashboards, crie uma dash para medir as questões da fábrica e rotas, motivos de não entregas, motivos de pausa e todos os motivos dessa forma, é uma medição para metrificar quais são os maiores problemas em cada um desses pontos."* **Resposta (21/10):** entram **Produção** (pausas, paradas e saídas do setor), **PCP** (stand-by), **Rotas** (não entrega, devolução, entrega desfeita) e **Qualidade** (atenção/danificado).

- **Onde:** Dashboards → **Motivos** (`/dashboards/motivos`), com o filtro de período (Hoje/7/30/90 dias), o de setor e as visualizações salvas, como os outros painéis.
- **Quem vê ([[D-032 - Dashboards foco pesado em tempo so lider e admin|D-32]]):** líder (os setores de produção que lidera) e admin (tudo). O PCP e as rotas aparecem para quem vê esses setores no painel (o admin; o líder do PCP/das ROTAS). Com um setor de produção escolhido no filtro, o PCP e as rotas saem.
- **O que mede (⏳ PROVISÓRIAS — escolhas do Claude):**
  1. **Pausas e paradas:** vezes = os gestos; **tempo = o tempo ÚTIL parado de cada pessoa** (só o expediente do setor — a mesma régua dos outros painéis; quem ajudava conta também — horas-pessoa paradas). Por motivo, por setor e por pessoa. O motivo especial ([[D-164 - Motivos de pausa ESPECIAIS Faltou peca Maquina quebrou|D-164]]) aparece marcado "especial · não conta para a pessoa".
  2. **Saídas do setor (tablet):** por motivo (sem o detalhe), com o tempo útil até a pessoa entrar de novo ("Fim do turno" fica perto de zero — a noite está fora do expediente).
  3. **Mover ([[D-173 - O botao MOVER do card a lideranca manda qualquer card|D-173]]):** por motivo e "de onde para onde".
  4. **Stand-by:** por motivo, com o tempo útil segurado (os que ainda estão contam até agora) e quantos estão segurados agora. *(O tempo útil de cada stand-by encerrado vem no próprio registro da saída, escrito na hora em que o pedido sai — o painel só soma; como o de cada pausa e de cada saída do setor, guardado quando termina. Lei de desempenho.)*
  5. **Rotas:** não entrega por motivo, por caminhão e por quem marcou (com "X% de N tentativas" — entregues + não entregues no período); devolução e entrega desfeita por motivo.
  6. **Qualidade:** por setor de origem, as peças com atenção e danificadas e as divergências (quem recebeu discordou).
  7. O "Outro" escrito na hora fica num grupo só ("Outro (escrito na hora)"); o detalhe mostra cada texto.
- **O clique num motivo** abre cada vez que ele aconteceu (quando, quem, onde, o card, o motivo escrito, o tempo), 20 por vez com "Ver mais" (cursor); o card abre a janela dele.
- **Desenho ([[D-042 - Dashboards guiados por imagem docs inspiracao dashboards e|D-42]]):** números-herói no topo (mais tempo parado, em stand-by agora, não entregues, peças com problema), ranking com barra de um matiz só (o azul de espera), rótulo direto, o maior problema primeiro.

**Descartadas:** gráficos de pizza (proibidos pela régua dos painéis); um painel por área (o dono pediu "uma dash"); contar só as vezes (o tempo parado é a medida que mostra o tamanho do problema).
