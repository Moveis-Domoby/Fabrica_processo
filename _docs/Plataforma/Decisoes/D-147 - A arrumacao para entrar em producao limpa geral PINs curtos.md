---
id: D-147
aliases: [D-147]
titulo: "A arrumação para entrar em produção: limpa geral, PINs curtos, dois níveis novos, pausa por pessoa e o ajudar geral"
tipo: decisao
data: 2026-10-19
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-146 - Tablet 2 0 as 13 respostas provisorias da SESSAO-36|D-146]]", "[[D-048 - Execucao um por vez com pausa por lider tempo de PCP e|D-48]]"]
area: [tablet-tv, acesso-usuarios]
tags: [decisao, area/tablet-tv, area/acesso-usuarios]
---
# D-147 · A arrumação para entrar em produção: limpa geral, PINs curtos, dois níveis novos, pausa por pessoa e o ajudar geral (19/10/2026, dono na conversa) — ↪️ D-146, D-48

O dono, na madrugada de 19/10, arrumou a plataforma para o galpão começar DE VERDADE no mesmo dia:

1. **Limpa geral (rodada uma vez, com OK explícito):** apagados os cards do kanban, todos os eventos de produção, execuções, auxílios, presenças, tempos, avisos, programações de rota e a fila de webhooks; TODOS os PINs (pessoas e setores) zerados. Ficaram intactos: chat, cadastros, pedidos do Tiny, estoque, comercial e a trilha de atividade. O PCP foi repovoado com um card por pedido do Tiny não entregue/não cancelado (51). ⚠️ Exceção registrada ao "evento não se apaga": reset único de dados de teste, não é feature.
2. **PIN de setor = exatamente 2 dígitos; PIN de pessoa = 2 a 4 dígitos.** O dono digita os definitivos à mão. A trava de tentativas (5 erros → espera dobrando) segue valendo — com 2 dígitos são 100 combinações, risco aceito pelo dono.
3. **Nível "Linha de produção"** (`producao`): navega SÓ nos setores de produção — os dela abrem livre; outro setor pede o PIN de entrada daquele setor (conferência no servidor, com trilha); além disso só chat, meus afazeres, avisos e o próprio perfil. PCP, dashboards, configurações, logística e pedidos não existem para ela.
4. **Nível "Logística"** (`logistica`): acompanha a produção SÓ OLHANDO (nenhum gesto de card — recusado no banco e na tela), recebe o módulo de logística inteiro (pedidos, expedição, estoque, aguardo, danificados, rotas) e o painel pessoal completo; sem dashboards, comercial ou configurações. Pode nascer sem vínculo de setor.
5. **A pausa é da PESSOA** (botão geral e painel de pessoas): pausa só a parte dela — o card segue com quem ficou e só aparece Pausado quando o último ativo se pausa. A pausa DO CARD (gesto no card) continua pausando o card e as ajudas juntas ([[D-146 - Tablet 2 0 as 13 respostas provisorias da SESSAO-36|D-146]] resposta 9 fica restrita ao gesto no card).
6. **Botão "Ajudar em tudo"** no topo da coluna em execução (tablet e PC): um gesto entra como auxiliar em TODOS os cards em execução do setor; e o "Pausar geral" ao lado. ⏳ PROVISÓRIA: para isso o limite por pessoa ([[D-048 - Execucao um por vez com pausa por lider tempo de PCP e|D-48]]) deixou de barrar o AUXÍLIO — ele segue contando as ajudas abertas ao INICIAR um card próprio.
7. **Dashboard de tempos detalhada** (pedido na mesma conversa): o card de cada pessoa abre os números POR SETOR (produção × ausente) e a produção por móvel — tempo, tempo parado e os motivos — na mesma requisição; o clique aprofunda (dia a dia, por setor, cada card com pausas e motivos).
