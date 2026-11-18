---
titulo: "Mapa — Tempos e Painéis"
tipo: mapa
area: tempos-paineis
atualizado: 2026-11-18
tags: [mapa, moc, area/tempos-paineis]
---

# 🗺️ MOC - Tempos e Paineis

> A razão de existir da plataforma: **medir o tempo de verdade**. Tempo de fila (do setor) e de execução (da pessoa), o "tempo certo" (calendário da fábrica, pausa sozinha no fim do expediente, cálculo único gravado no fato), os motivos de pausa, a tela Tempos de produção (com o histórico do Trello), a Visão do dia, o painel de motivos e as metas.

**No código:** `src/dashboards/` · `src/paginas/dashboards/` · `src/paginas/ControleTempo.tsx` · `src/paginas/controleTempo/` · `src/metas/`

**Notas da área:** [[000-LEIA-ME]]

**Perguntas em aberto:** nenhuma registrada para a área — [[PLT - Perguntas em Aberto]]

## Últimas sessões da área (a mais nova primeiro)

- **47** · [[SESSAO-47 - Pedido Adiantado no Tiny Data Real da Entrega Comprovantes e Painel de Tempos]] · [[handoff_2026_11_09_sessao47_pedido_adiantado_entrega_comprovantes_tempos|handoff]]
- **43** · [[SESSAO-43 - Tela Tempos de Producao Modo TV e Historico do Trello]] · [[handoff_2026_11_05_sessao43_tempos_producao_modo_tv|handoff]]
- **42** · [[SESSAO-42 - Tempo Certo - Calendario Regras e Calculo Unico]] · [[handoff_2026_10_31_sessao42_tempo_certo|handoff]]
- **39** · [[SESSAO-39 - Calendario das Rotas Painel de Motivos Google Maps e Mover]] · [[handoff_2026_10_22_sessao39_calendario_motivos_mover|handoff]]
- **38** · [[SESSAO-38 - Bateria de Ajustes - Cards Rotas Expedicao Stand-by e Login]] · [[handoff_2026_10_21_sessao38_bateria_ajustes|handoff]]
- **36** · [[SESSAO-36 - Tablet 2.0 - Login por Setor Auxiliares e Tempos por Pessoa]] · [[handoff_2026_10_18_sessao36_tablet_2_0|handoff]]
- **16** · [[SESSAO-16 - Dashboards de Verdade]] · [[handoff_2026_09_18_sessao16_dashboards|handoff]]
- **10** · [[SESSAO-10 - Dashboards e Visualizacoes Salvas]] · [[handoff_2026_08_28_sessao10_dashboards|handoff]]
- **05** · [[SESSAO-05 - Timers e Eventos de Tempo]] · [[handoff_2026_08_27_sessao05_timers|handoff]]

<!-- gerado:inicio -->
## Decisões vigentes (11)

- [[D-002 - Timer dois contadores por etapa dash compara e soma|D-2]] · Timer: dois contadores por etapa, dash compara e soma
- [[D-029 - Controle de tempo pelo admin horario de funcionamento pausas|D-29]] · Controle de tempo pelo admin: horário de funcionamento, pausas manuais e correção…
- [[D-042 - Dashboards guiados por imagem docs inspiracao dashboards e|D-42]] · Dashboards guiados por imagem: docs/inspiracao/dashboards/ é a régua
- [[D-094 - Bonificacao descartada|D-94]] · Bonificação descartada
- [[D-164 - Motivos de pausa ESPECIAIS Faltou peca Maquina quebrou|D-164]] · Motivos de pausa ESPECIAIS: "Faltou peça", "Máquina quebrou" e "Pausa solicitada por um…
- [[D-176 - O PAINEL DE MOTIVOS os maiores problemas da fabrica e|D-176]] · O PAINEL DE MOTIVOS: os maiores problemas da fábrica e das rotas, do maior para o menor
- [[D-197 - Sem card so 5 minutos contam como trabalho a tela segue|D-197]] · SEM CARD, SÓ 5 MINUTOS CONTAM COMO TRABALHO — a tela segue mostrando "trabalhando" até…
- [[D-198 - O CARD ESQUECIDO na MONTAGEM 2 h rodando sem parar perguntam|D-198]] · O CARD ESQUECIDO: na MONTAGEM, 2 h rodando sem parar perguntam "ainda tem alguém neste…
- [[D-203 - O TEMPO CERTO o calendario da fabrica a pausa sozinha no fim|D-203]] · O TEMPO CERTO: o calendário da fábrica, a pausa sozinha no fim do expediente, as regras…
- [[D-268 - A Visao do dia conta o que o QUADRO mostra a fila e a coluna|D-268]] · A Visão do dia conta o que o QUADRO mostra: a fila é a coluna da fila (com o card…
- [[D-284 - Configurar painel em Tempos de producao uma configuracao|D-284]] · "Configurar painel" em Tempos de produção: uma configuração só, do admin, que vale para…

## Provisórias ⏳ — valem até o dono dizer o contrário (25)

- [[D-165 - O que nao contar o tempo quer dizer com precisao|D-165]] · O que "não contar o tempo" quer dizer, com precisão
- [[D-166 - O tempo do CARD nao muda com a pausa especial|D-166]] · O tempo do CARD não muda com a pausa especial
- [[D-167 - O TEMPO UTIL do card so o expediente do setor o PCP nao tem|D-167]] · O TEMPO ÚTIL do card: só o expediente do setor; o PCP não tem fila
- [[D-168 - O PCP ganha horario de expediente|D-168]] · O PCP ganha horário de expediente
- [[D-172 - A regua do tempo util vem na abertura do app Lei 2 8|D-172]] · A régua do tempo útil vem na abertura do app — Lei §2/§8
- [[D-204 - O que e o fim do expediente de um trecho|D-204]] · O que é o "fim do expediente" de um trecho
- [[D-205 - O trabalho simultaneo da mesma pessoa e dividido a forma|D-205]] · O trabalho simultâneo da mesma pessoa é dividido (a forma geral da resposta 12)
- [[D-206 - Retrabalho quais passagens saem da media|D-206]] · Retrabalho: quais passagens saem da média
- [[D-207 - Gesto de administrador|D-207]] · Gesto de administrador
- [[D-208 - A data oficial tira so das MEDIAS o tempo da pessoa conta|D-208]] · A data oficial tira só das MÉDIAS; o tempo da pessoa conta
- [[D-209 - Os dias da conta|D-209]] · Os dias da conta
- [[D-210 - O modelo sugerido pelo nome|D-210]] · O modelo sugerido pelo nome
- [[D-211 - Pequenas escolhas da tela e da regra|D-211]] · Pequenas escolhas da tela e da regra
- [[D-225 - Sem ranking nas abas internas ficam os Melhores tempos e|D-225]] · Sem ranking nas abas internas; ficam os "Melhores tempos" e o "Melhor da semana"
- [[D-226 - O que entra nas contas da tela Tempos de producao|D-226]] · O que entra nas contas da tela Tempos de produção
- [[D-227 - Quem ve o que na tela de tempos|D-227]] · Quem vê o quê na tela de tempos
- [[D-228 - A conferencia do historico do Trello e a lista Motivos|D-228]] · A conferência do histórico do Trello e a lista "Motivos de conferência"
- [[D-229 - A carga do historico do Trello|D-229]] · A carga do histórico do Trello
- [[D-232 - Tempo por setor mora dentro de Tempos de producao|D-232]] · "Tempo por setor" mora dentro de Tempos de produção
- [[D-233 - Periodos longos com 100 vezes o movimento de hoje passam|D-233]] · Períodos longos com 100 vezes o movimento de hoje passam do tempo-limite
- [[D-285 - So o admin ve o botao Configurar painel e so ele salva|D-285]] · Só o admin vê o botão "Configurar painel" e só ele salva
- [[D-286 - Tres tipos de grafico empilhadas por montador barras e linhas|D-286]] · Três tipos de gráfico: empilhadas por montador, barras e linhas
- [[D-287 - Dupla com um desligado aparece como a letra ou o nome de quem|D-287]] · Dupla com um desligado aparece como a letra (ou o nome) de quem está ligado + "Outros"
- [[D-288 - A linha do tempo padrao virou uma marca na linha do dia|D-288]] · A "linha do tempo padrão" virou uma marca na linha do dia da aba Dia
- [[D-289 - Detalhes da configuracao do painel|D-289]] · Detalhes da configuração do painel

## Revisadas por outra (4) — só para a história

[[D-004 - Produtividade e bonificacao|D-4]] · [[D-024 - Execucao varios cards por pessoa com limite configuravel|D-24]] · [[D-032 - Dashboards foco pesado em tempo so lider e admin|D-32]] · [[D-048 - Execucao um por vez com pausa por lider tempo de PCP e|D-48]]

## Onde mais ler (só o que a demanda tocar)

- **Banco:** [[Banco - Tempos e Paineis]]
- **Lições:** [[Memoria - Desempenho e Tempo Real]] · [[Memoria - Regras de Negocio - Producao PCP Estoque e Rotas 1]] · [[Memoria - Regras de Negocio - Producao PCP Estoque e Rotas 2]] · [[Memoria - Regras de Negocio - Producao PCP Estoque e Rotas 3]]
- **Design:** [[Design - Kanban Execucao e Qualidade]]
<!-- gerado:fim -->
