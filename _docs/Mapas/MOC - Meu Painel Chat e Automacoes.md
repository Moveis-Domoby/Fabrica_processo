---
titulo: "Mapa — Meu Painel, Chat e Automações"
tipo: mapa
area: painel-chat-automacoes
atualizado: 2026-11-18
tags: [mapa, moc, area/painel-chat-automacoes]
---

# 🗺️ MOC - Meu Painel Chat e Automacoes

> O que cerca a produção: o Meu Painel (filas pessoais, subtarefas, tarefa privada), os afazeres e a delegação, o chat interno (canais, particulares, Avisos gerais), os avisos que cada um escolhe receber, as automações em canvas ("quando… faça…", "se… senão") e o quadro Tech → Sugestão de melhoria.

**No código:** `src/paginas/MeuPainel.tsx` · `src/afazeres/` · `src/chat/` · `src/notificacoes/` · `src/paginas/ConfigAvisos.tsx` · `src/automacoes/` · `src/tech/`

**Perguntas em aberto:** Q-42 (onde o líder recebe os alertas) — [[PLT - Perguntas em Aberto]]

## Últimas sessões da área (a mais nova primeiro)

- **46** · [[SESSAO-46 - Tech - Sugestao de Melhoria]] · [[handoff_2026_11_05_sessao46_tech_sugestoes|handoff]]
- **31** · [[SESSAO-31 - Kanban Completo - Card Avulso Janela do Card Anexos e Conversa]] · [[handoff_2026_10_14_sessao31_kanban_completo|handoff]]
- **27** · [[SESSAO-27 - Automacoes em Canvas]] · [[handoff_2026_10_02_sessao27_automacoes_canvas|handoff]]
- **26** · [[SESSAO-26 - Chat Interno]] · [[handoff_2026_09_27_sessao26_chat|handoff]]
- **23** · [[SESSAO-23 - Meu Painel 2 - Filas Pessoais Subtarefas e Tempos]] · [[handoff_2026_09_23_sessao23_meu_painel_2|handoff]]
- **17** · [[SESSAO-17 - Automacoes Internas]]
- **14** · [[SESSAO-14 - Meu Painel e Metas]] · [[handoff_2026_09_01_sessao14_meu_painel|handoff]]
- **12** · [[SESSAO-12 - Tarefas e Delegacao]] · [[handoff_2026_08_28_sessao12_tarefas|handoff]]

<!-- gerado:inicio -->
## Decisões vigentes (18)

- [[D-034 - Delegacao 3 modos por setor sorteio entre logados tarefa|D-34]] · Delegação: 3 modos por setor, sorteio entre logados, tarefa avulsa sem timer obrigatório
- [[D-051 - Meu Painel 2 0 tres filas subtarefas tarefa privada e|D-51]] · Meu Painel 2.0: três filas, subtarefas, tarefa privada e o painel pessoal
- [[D-066 - Aniversarios o Sistema publica os parabens nos Avisos gerais|D-66]] · Aniversários: o Sistema publica os parabéns nos Avisos gerais
- [[D-092 - Automacoes so admin cria por ora o modulo e o laboratorio|D-92]] · Automações: só admin cria, por ora; o módulo é o laboratório
- [[D-099 - A automacao pode mover o card sozinha e serve para tudo quem|D-99]] · A automação pode mover o card sozinha — e serve "para tudo"; quem monta e liga é só o…
- [[D-102 - Trazer de volta um card arquivado bloco da automacao e botao|D-102]] · "Trazer de volta" um card arquivado — bloco da automação e botão do admin
- [[D-103 - As regras do motor na hora no banco nunca derruba o gesto|D-103]] · As regras do motor: na hora, no banco, nunca derruba o gesto; cadeia até 5; obedece às…
- [[D-104 - Teste ao vivo com os cards de teste|D-104]] · Teste ao vivo com os cards de teste
- [[D-105 - O editor de uma automacao e uma AREA DE TRABALHO menu|D-105]] · O editor de uma automação é uma ÁREA DE TRABALHO: menu recolhido, canvas na tela toda,…
- [[D-106 - O Se senao a condicao com DUAS saidas cada uma com|D-106]] · O "Se… senão": a condição com DUAS saídas, cada uma com os próprios passos
- [[D-107 - Excluir automacao some de vez o que ela fez FICA na Auditoria|D-107]] · Excluir automação: some de vez; o que ela fez FICA na Auditoria, marcado "automação…
- [[D-131 - Mensagens podem ser editadas e apagadas no card e no chat|D-131]] · Mensagens podem ser editadas e apagadas — no card e no chat; a história fica
- [[D-162 - As notificacoes fecham com qualquer toque fora do painel|D-162]] · As notificações fecham com qualquer toque fora do painel
- [[D-202 - OS AVISOS QUE CADA UM RECEBE ESCOLHIDOS EM CONFIGURACOES|D-202]] · OS AVISOS QUE CADA UM RECEBE, ESCOLHIDOS EM CONFIGURAÇÕES → AVISOS; os erros de…
- [[D-260 - Tech Sugestao de melhoria o quadro que toda a equipe acompanha|D-260]] · Tech → "Sugestão de melhoria": o quadro que toda a equipe acompanha
- [[D-261 - So o dono super admin move os cards do quadro de sugestoes|D-261]] · Só o dono (super admin) move os cards do quadro de sugestões
- [[D-262 - Recusar exige o motivo que vai no aviso para quem sugeriu|D-262]] · Recusar exige o motivo, que vai no aviso para quem sugeriu
- [[D-263 - Finalizada avisa quem sugeriu ele testa e APROVA ou DEVOLVE|D-263]] · Finalizada avisa quem sugeriu; ele testa e APROVA ou DEVOLVE com uma sugestão nova, com…

## Provisórias ⏳ — valem até o dono dizer o contrário (3)

- [[D-264 - A pendencia de teste e uma tarefa do Sistema da pessoa aviso|D-264]] · A pendência de teste é uma tarefa do Sistema da pessoa; aviso e pendência levam à ficha…
- [[D-265 - A bolinha das sugestoes acompanha todo usuario em toda tela|D-265]] · A bolinha das sugestões acompanha todo usuário, em toda tela, menos o modo tablet
- [[D-266 - Ordem e numeros do quadro de sugestoes|D-266]] · Ordem e números do quadro de sugestões

## Revisadas por outra (4) — só para a história

[[D-037 - Tela inicial Meu Painel com cockpit de metas configuraveis|D-37]] · [[D-065 - Chat interno canais particulares e Avisos gerais quem cria|D-65]] · [[D-067 - Chat por websocket leitura so por pagina 10 mensagens 5|D-67]] · [[D-101 - Utilitarios etiquetas varias por card so a automacao poe|D-101]]

## Onde mais ler (só o que a demanda tocar)

- **Banco:** [[Banco - Chat Tarefas Automacoes e Configuracoes]]
- **Lições:** [[Memoria - Front Telas e React 1]] · [[Memoria - Front Telas e React 2]] · [[Memoria - Regras de Negocio - Producao PCP Estoque e Rotas 1]] · [[Memoria - Regras de Negocio - Producao PCP Estoque e Rotas 2]] · [[Memoria - Regras de Negocio - Producao PCP Estoque e Rotas 3]]
- **Design:** [[Design - Meu Painel Chat Automacoes e Tech]]
<!-- gerado:fim -->
