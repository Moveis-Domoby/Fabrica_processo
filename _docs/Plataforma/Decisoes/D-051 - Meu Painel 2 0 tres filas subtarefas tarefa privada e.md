---
id: D-51
aliases: [D-51, D-051]
titulo: "Meu Painel 2.0: três filas, subtarefas, tarefa privada e o painel pessoal"
tipo: decisao
data: 2026-09-23
status: vigente
revisa: ["[[D-037 - Tela inicial Meu Painel com cockpit de metas configuraveis|D-37]]", "[[D-032 - Dashboards foco pesado em tempo so lider e admin|D-32]]"]
revisada_por: []
complementa: []
area: [painel-chat-automacoes]
tags: [decisao, area/painel-chat-automacoes]
---
# D-51 · Meu Painel 2.0: três filas, subtarefas, tarefa privada e o painel pessoal (23/09/2026) — ↩️ revisa a D-37 e complementa a D-32

**Decidido (respostas do dono no início da SESSAO-23):**

- **O Meu Painel se reorganiza em três separadores:** *Delegados a mim* (tarefas de outros ou do Sistema + cards de produção delegados — resposta do dono: *"deixe que os delegados a mim entrem também, se eu não gostar eu mudo"*), *Meus afazeres* (tarefas que eu criei para mim) e a **Fila de prioridade** — a união dos dois em ordem de cadastro, **reordenável pelo próprio usuário** (a posição é preferência de exibição dele, persiste no cadastro e não muda prazo, dono nem dado de tarefa — [[Memoria - Modelos Formulas e Possibilidades#M-4|M-04]]).
- **"Qualidade a atestar" e "Avisos recentes" saem do painel** (↩️ revisa a [[D-037 - Tela inicial Meu Painel com cockpit de metas configuraveis|D-37]]): a pendência de parecer vira **tarefa do "Sistema"** no setor recebedor (dar o parecer a conclui sozinha; sem usuário fantasma) e os avisos vivem no sino, que ganhou **"Ver todos"** com o histórico paginado no servidor.
- **Tarefa do Sistema NÃO entra na Fila de prioridade** (*"se é tarefa do sistema é coisa rápida"*) — mas **gera notificação** no sino dos membros do setor recebedor.
- **Subtarefas: até DOIS níveis** (tarefa → subtarefa → subtarefa da subtarefa), na MESMA tabela; mais níveis só se a produção pedir.
- **Tarefa pessoal nasce PRIVADA** — nem líder, nem admin a enxergam (nem o conteúdo, nem o tempo, **nem pela API** — garantido por RLS). O dono pode **torná-la pública na criação ou na edição**; pública, ela ganha as dependências de uma tarefa comum. Reatribuída a outra pessoa, deixa de ser pessoal e vira pública sozinha. A fila de prioridade de alguém, portanto, é visível à gestão **só no que for tarefa delegada** — as pessoais não aparecem.
- **Tempo:** o de *meus afazeres* é só do próprio; o de *delegados* é visível ao próprio + líderes do setor + admins. Timer segue o existente (`iniciada_em`), derivado, nunca digitado.
- **Painel pessoal em Dashboards** (*"Meu desempenho"* — complementa a [[D-032 - Dashboards foco pesado em tempo so lider e admin|D-32]]: operador segue sem ver dashboard de GESTÃO, mas todo usuário vê **o próprio** painel): tempo em afazeres por dia e **por tarefa** (resposta 4) + KPIs de desempenho **apenas do próprio** — *"para que ele possa entender também onde melhorar"*.

**Descartadas:** fila de prioridade 100% secreta (o dono quis a gestão enxergando o que é delegado); um nível só de subtarefa; tarefa do sistema dentro da fila.
