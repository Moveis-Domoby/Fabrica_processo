---
titulo: "SESSAO-53 — \"Entregue em parte\" também na Programação, na Expedição e nas Entregas do dia"
tipo: demanda
status: ✅ no ar em 25/11/2026 — banco e site ligados pela fila, na subida de 25/11
data: 2026-11-18
atualizado: 2026-11-25
origem: a dívida registrada na decisão provisória D-328, item 1, da SESSAO-51 (pedido gravado pelo Escritório em `_escritorio/handoffs/sessao-53-entregue-em-parte-nas-telas-prompt-claude-code.md`)
revisa: ↪️ D-328 item 1 (paga a dívida) · usa D-325 (o pedido entregue em parte segue vivo), D-327 (a decisão e o revogar) · NÃO toca a D-324 (o selo do endereço alterado em "Já programadas")
tags: [plataforma, demanda, rotas, entrega-parcial, programacao, expedicao, entregas-do-dia]
---

# 🎯 SESSAO-53 — "Entregue em parte" também na Programação, na Expedição e nas Entregas do dia

> ↪️ **25/11/2026 — ✅ NO AR.** As duas atualizações do banco (a das três telas, ~04:52, e a nova da aba Programar, ~04:55 — que guarda o aviso do ponto aproximado e acrescenta o selo) foram ligadas pela fila e o site subiu logo depois, pela subida de 25/11 ([[handoff_2026_11_25_subida_atualizada|handoff da subida de 25/11]]). **Falta ver o selo na tela:** em 25/11 não havia nenhum pedido aberto entregue em parte — ele aparece na primeira entrega parcial de verdade. *(O campo de status dizia, até 25/11: "⏳ pronta para subir (18/11/2026 — feita na mesa da fila; nada no banco de produção, nada na main)".)*

> **Não linkada na [[000 - ORDEM DAS SESSOES]]** (regra desta leva: as notas grandes não são editadas pelas mesas da fila — entra depois da dieta da documentação).

## O que é

Hoje o pedido entregue em parte mostra "Entregue em parte (N de M)" na ficha, no card do PCP, na lista de Pedidos e na busca. **Não mostra** na Programação, na Expedição nem nas Entregas do dia — quem programa o resto, quem separa na expedição e quem entrega não vê, na tela em que trabalha, que aquele pedido já teve uma parte entregue. Esta demanda leva a informação a essas três telas.

## Requisitos cobertos

Os da logística/rotas e da entrega parcial já cobertos pelas SESSÕES 41 e 51 (nenhum requisito novo — é a dívida de uma decisão).

## Decisões que regem esta demanda

- **[[D-328 - Onde o pedido mostra Entregue em parte N de M e a parada|D-328]], item 1** — onde o pedido mostra "Entregue em parte (N de M)": as três telas ficaram como dívida. Esta demanda paga.
- **[[D-325 - Na entrega parcial o que ainda esta na fabrica CONTINUA|D-325]] / [[D-327 - Revogar a decisao da entrega parcial quantas vezes for preciso|D-327]]** — o pedido entregue em parte com "deixar em produção" segue vivo (volta a ser programado quando o resto fica pronto); a decisão pode ser revogada.
- **[[D-324 - Em Ja programadas o selo do endereco alterado fica na janela|D-324]]** — o selo do endereço alterado em "Já programadas" fica na janela, não no cartão: **não mexer** (depende de uma escolha do dono).
- Lei de requisição e de desempenho (regras 17 e 18): cada tela continua com 1 requisição.

## Comportamento esperado

- Leve a informação às três telas, **na mesma porta de cada uma**, sem requisição nova. A forma é da sessão (por exemplo, uma porta nova no lugar da antiga, ou a coluna nova com a bateria ajustada). Registrar a escolha.
- O texto e o selo são **os mesmos** das outras telas, inclusive "K ainda em produção" quando houver.

## Fora do escopo

- O selo do endereço alterado em "Já programadas" ([[D-324 - Em Ja programadas o selo do endereco alterado fica na janela|D-324]]).
- A busca geral, a lista de pedidos, a devolução, a Auditoria, o Comercial, os dashboards e as configurações (são de outras mesas desta leva).
- As notas grandes do cofre (Decisões de Produto, Memória de Aprendizado, Esquema do Banco, Lei de Desempenho, Mapa do Projeto, Ordem das Sessões e Próximos Passos): o que for para elas fica no diário [[SESSAO-53]] e na seção "Para entrar nas notas depois da dieta" do handoff.
- Push, merge, aplicar migration, publicar, n8n, credencial.

## Critérios de aceite

- [x] As três telas mostram "Entregue em parte (N de M)" num pedido de teste entregue em parte, iguais às outras.
- [x] Cada tela continua abrindo com 1 requisição; plano ×100 das portas tocadas no handoff.
- [x] A bateria do banco continua reaplicando tudo sem quebrar.
- [x] Celular (375) e tablet (768) sem rolagem lateral.

## Notas para o Claude Code

- **Banco:** só em arquivo de migration (sem acesso ao banco vivo); recriar cada função a partir da última versão nas migrations; numeração a partir de `20261118110000_`; faixas novas na bateria de testes (dizer quais no reporte); o que precisar ser conferido no banco vivo vai para "Para ligar com o dono".
- **Outras mesas trabalham ao mesmo tempo:** a SESSAO-49 (dieta da documentação), a SESSAO-34 (rotinas agendadas do banco) e as SESSÕES 52 a 55 (cada uma na sua área).
- Ciclo do `CLAUDE.md`: task list espelhando a demanda, diário contínuo, commits pequenos, lint, build e testes (falha que já existia antes, só registrar), plano ×100 das portas novas ou tocadas, quando der para medir.
- O dono está dormindo: o que faltar vira decisão provisória, registrada.
- Handoff em `_docs/Handoffs/` com: como testar passo a passo; "Para ligar com o dono" (as migrations a aplicar, em ordem, com conferência antes e depois); as decisões provisórias.

## Leitura da sessão

- `CLAUDE.md` da raiz (regras de conduta) e o do cofre;
- esta demanda (duas vezes);
- [[D-324 - Em Ja programadas o selo do endereco alterado fica na janela|D-324]], [[D-325 - Na entrega parcial o que ainda esta na fabrica CONTINUA|D-325]], [[D-326 - Os detalhes da peca que sai e volta pela entrega parcial|D-326]], [[D-327 - Revogar a decisao da entrega parcial quantas vezes for preciso|D-327]] e [[D-328 - Onde o pedido mostra Entregue em parte N de M e a parada|D-328]] em [[PLT - Decisoes de Produto]];
- o handoff e o diário da SESSAO-51 ([[handoff_2026_11_17_sessao51_entrega_parcial_mover_pcp]], [[SESSAO-51]]);
- as lições sobre mudar o retorno de uma porta ([[Memoria - Banco e SQL 1#E-17|E-17]], [[Memoria - Migrations Aplicador e Ensaio 1#E-170|E-170]], [[Memoria - Migrations Aplicador e Ensaio 1#E-178|E-178]], [[Memoria - Banco e SQL 2#A-197|A-197]]) e a chave que só nasce quando há ([[Memoria - Banco e SQL 1#E-237|E-237]]) em [[PLT - Memoria de Aprendizado]];
- a [[PLT - Lei de Desempenho e Escala]] (uma requisição por tela; a conta só para a página);
- o banco pelas próprias migrations: a versão vigente das portas da Programação, da Expedição e das Entregas do dia e a base da entrega parcial (`20261116010000`, `20261116020000`).

## Tarefas no ClickUp (lista PRODUÇÃO do DPTO TI)

- [Rotas - Entregue em parte também na Programação, na Expedição e nas Entregas do dia](https://app.clickup.com/t/17tya50wqt5) — a mesa da fila **não mexe no ClickUp** (regra do modo fila: o dono cuida das tarefas); mover para "fazendo" e comentar fica com o dono.

## Resultado (preencher ao entregar)

- **Feito no ramo `sessao-53-entregue-em-parte-nas-telas`** (nada no banco de produção, nada na main): a regra única do selo no banco (uma visão), a informação na porta que cada tela já usava (Programar, Já programadas, Expedição, Entregas do dia), um selo só nas telas, 23 provas no banco, 9 testes de tela, o ensaio ×100 e 12 fotos. Handoff: [[handoff_2026_11_18_sessao53_entregue_em_parte_nas_telas]] · diário: [[SESSAO-53]].
- **A forma:** as três portas em jsonb ganharam uma chave; "Já programadas" (tabela) ganhou uma coluna jsonb, com a migration antiga ajustada para a bateria reaplicar tudo.
- **Além do pedido:** a frase longa da lista "Entregues hoje" fazia a tela do celular rolar de lado — agora quebra a linha.
- **De fora (provisório):** o Calendário da Programação e "ROTAS → Entregas".
- **Falta:** o dono subir (handoff, "Para ligar com o dono") e confirmar as 5 provisórias.
