---
id: D-173
aliases: [D-173]
titulo: "O botão MOVER do card: a liderança manda qualquer card de produção para a FILA de qualquer setor, com motivo obrigatório"
tipo: decisao
data: 2026-10-21
status: vigente
revisa: ["[[D-059 - Quadros de producao so por arrasto o unico botao e Concluir|D-59]]"]
revisada_por: []
complementa: []
area: [kanban-producao]
tags: [decisao, area/kanban-producao]
---
# D-173 · O botão MOVER do card: a liderança manda qualquer card de produção para a FILA de qualquer setor, com motivo obrigatório (21/10/2026, pedido do dono — SESSAO-39) — ↩️ revisa a D-59 (o "Mover" tinha saído dos quadros) para a liderança

**Pedido do dono:** *"Dentro de todos os cards de produção, coloque a possibilidade de dentro dele ter um botão de mover, esse mover pode ser movido para a FILA de qualquer setor a qualquer momento por um líder, admin ou super admin."* **Respostas (21/10, na conversa):** líder de **qualquer** setor (não só do setor que lidera) move qualquer card de produção; o **motivo é obrigatório**, de uma lista própria em Configurações → Utilitários (+ "Outro", escrito), e entra no painel de motivos.

- **Onde:** na janela do card, em todo card de produção (a peça e o card avulso) que está num setor de produção. Não vale para o card do pedido (ele segue pelo PCP), nem para o que já está num fim de linha (Expedição, ESTOQUE, Danificados, ROTAS).
- **Para onde:** a **etapa de fila** de qualquer setor de produção — inclusive o próprio setor ("volta para a fila daqui"), se o card não estiver nela. Setor sem etapa de fila recusa, com o caminho para cadastrar.
- **Quem:** admin (o super admin é admin), o papel líder ou a marca de líder em qualquer setor. O nível logística nunca move ([[D-147 - A arrumacao para entrar em producao limpa geral PINs curtos|D-147]]: só olha). O operador comum não vê o botão.
- **Motivo:** obrigatório — "Motivos do Mover" (aba própria em Utilitários) ou "Outro", escrito; o detalhe opcional entra junto. O motivo fica na observação do fato (o histórico do card mostra) e o id do motivo nos dados (o painel conta).
- **⏳ PROVISÓRIAS (escolhas do Claude, ditas ao dono na conversa sem objeção — confirmar):**
  1. **Os quatro motivos que nascem:** "Retrabalho", "Foi para o setor errado", "Mudança no planejamento", "Peça com defeito" (o admin edita, desliga e cria outros).
  2. **Com alguém trabalhando no card:** o tempo dele fecha na hora (a mesma regra do arrasto — [[D-024 - Execucao varios cards por pessoa com limite configuravel|D-24]]) e quem ajudava sai junto.
  3. **A marcação do estado da peça** (perfeito/atenção/danificado) segue a regra do arrasto ([[D-126 - A marcacao do estado da peca perfeito atencao danificado vira|D-126]]): só quando o setor de onde a peça sai pede ao enviar.
  4. **No tablet:** o botão aparece e pede o PIN; o banco aceita só o PIN de líder ou de admin (o fato sai em nome de quem digitou).
- **Os fatos:** os de sempre — movimentação para outro setor (com a marcação, quando houver) ou de etapa (no mesmo setor), com `dados.como = 'mover_para_fila'`. Nada novo no tipo de evento.

**Descartadas:** só o líder do setor do card (o dono quis qualquer líder); motivo opcional ou sem motivo (o dono quis obrigatório); um tipo de evento novo (a movimentação de sempre já fecha o tempo e as ajudas — um dono por regra).
