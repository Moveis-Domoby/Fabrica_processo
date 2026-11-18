---
id: D-304
aliases: [D-304]
titulo: "O momento seguro de recarregar"
tipo: decisao
data: 2026-11-11
status: provisoria
revisa: []
revisada_por: []
complementa: []
area: [publicacao-infra]
tags: [decisao, area/publicacao-infra, provisoria]
---
# D-304 · ⏳ PROVISÓRIA — O momento seguro de recarregar (11/11/2026, SESSAO-48 — o 1 minuto é da demanda; o resto são escolhas da sessão)

1. **Tablet e TV:** sem janela aberta (o PIN é digitado numa janela) e 1 minuto sem toque nem tecla; com janela aberta, olha de novo a cada minuto. Até lá, o aviso discreto diz "Ela se atualiza sozinha depois de 1 minuto sem uso."
2. **Onde a versão é conferida, sem relógio:** escritório — trocar de tela e voltar à aba (como antes); tablet — também o toque; TV — o aviso do setor, a reconexão e a virada do dia. No máximo uma conferida a cada 2 minutos (o `versao.json` é arquivo da CDN; não toca o banco).
3. **O pedaço sumido:** "Atualizando a plataforma…" e uma recarga por versão; a mesma versão falhando de novo, sem internet ou sem armazenamento → só o aviso com o botão "Atualizar". Vale em toda tela.
4. **O botão do aviso de versão:** 44 px no escritório (era 36 px), 64 px no tablet e na TV.
5. **A troca de setor no tablet** recarrega uma vez só: a janela do PIN fica "conferindo" até a página recarregar e o setor de destino vai direto para o aparelho.
6. **A página que não foi embora** (algo segurou a recarga — raríssimo): passados 15 s (60 s na troca de setor), ela volta a reagir à sessão e a poder recarregar, em vez de ficar surda.
7. **A proteção contra versões misturadas da Vercel (Skew Protection)** existe só nos planos pagos (Pro/Enterprise) e, para um site Vite puro, pede trabalho a mais no código — nada ligado; pergunta ao dono.
