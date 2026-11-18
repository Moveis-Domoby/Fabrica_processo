---
id: D-143
aliases: [D-143]
titulo: "Tiny completo: o plano aprovado inteiro; o que o Tiny não avisa, de hora em hora só das 8h às 20h; a baixa por etapa na próxima sessão"
tipo: decisao
data: 2026-10-16
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-142 - Integracao completa com o Tiny as 6 perguntas do plano|D-142]]"]
area: [tiny-n8n]
tags: [decisao, area/tiny-n8n]
---
# D-143 · Tiny completo: o plano aprovado inteiro; o que o Tiny não avisa, de hora em hora só das 8h às 20h; a baixa por etapa na próxima sessão (16/10/2026) — ↪️ D-142, regra 18

**Respostas do dono (16/10, noite, pelo celular)** ao plano da Etapa B da [[SESSAO-33 - Tiny Completo - Todos os Dados Atualizados por Evento]]:

1. **Plano aprovado inteiro** — as duas partes: (a) com a conexão de hoje (API v2, as duas contas): a carga completa, a cascata na hora a partir da venda (a nota, o cliente e as contas do pedido), os avisos de nota autorizada e pedido enviado, a conferência "bateu com o Tiny", o alerta de erro, as estruturas ligadas e a lista das unidades em Configurações; (b) a API nova (v3) na conta da fábrica, com o renovador próprio (um por credencial) e a ponte segura (a automação nunca vê a chave).
2. **O que o Tiny não avisa (produtos e clientes alterados) → uma consulta por hora, só entre 8h e 20h** (horário da fábrica). **Exceção registrada à Lei de Desempenho** (§13 — a lei proíbe relógio que acorda para ver se há trabalho): o Tiny não avisa esses dados; a consulta "o que mudou desde a última vez" custa uma chamada quando nada mudou; fora do horário nada roda — o que mudar à noite entra na primeira consulta das 8h ou na conferência da madrugada. Quando a API nova da fábrica estiver ligada, ela **substitui** a consulta de 15 em 15 minutos dos produtos novos do fluxo da fábrica.
3. **A baixa dos insumos por etapa** (o liga/desliga "Reduzir os insumos de acordo com a conclusão dos setores de produção?", nasce desligado) → **próxima sessão**, amarrando **cada insumo ao setor que o consome** (configura uma vez por insumo e vale para todos os móveis — o Tiny não liga componente a etapa: as etapas da estrutura na API nova são só nomes).
4. **Liberações executadas na mesma noite:** a imagem de teste do comprovante no pedido 13622 retirada pelo caminho normal; a rolagem das conferências da Auditoria aplicada no banco; o login com a mensagem de pessoa desativada publicado.
5. **As rotinas de minuto em minuto** ([[D-141 - As respostas do dono sobre o que ficou da SESSAO-32 e|D-141]], item 2) → **próxima sessão** (proposta do plano, não contestada).
6. **"Para de me perguntar, só faz, eu não tô em casa"** — com o dono fora, a sessão segue sem perguntas: o que precisa de banco ou n8n novo sai pronto em arquivo para ligar em casa; em produção, só o que ele já liberou (regra 2).
