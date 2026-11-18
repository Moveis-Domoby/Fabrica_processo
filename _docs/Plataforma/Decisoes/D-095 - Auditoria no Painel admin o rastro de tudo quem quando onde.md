---
id: D-95
aliases: [D-95, D-095]
titulo: "Auditoria no Painel admin: o rastro de tudo — quem, quando, onde, o quê e porquê"
tipo: decisao
data: 2026-10-01
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-040 - Auditoria total toda atividade de usuario gera log persistido|D-40]]"]
area: [auditoria-logs]
tags: [decisao, area/auditoria-logs]
---
# D-95 · Auditoria no Painel admin: o rastro de tudo — quem, quando, onde, o quê e porquê (01/10/2026) — ↪️ D-40

**Pedido do dono (respostas da [[SESSAO-29 - Reconciliacao Tiny - Pente-fino e Ultimo Pacote Vence]]):** *"Crie uma página de auditoria dentro do painel admin; lá dentro iremos colocar para mapear os erros do n8n também futuramente; dentro dessa auditoria deve aparecer log de tudo — execução, visualização, clique de entrada, movimentações e coisas do tipo; deve salvar o rastro de quem, quando, onde, porquê, o quê e por aí vai."*

- **Painel admin → Auditoria** (`/admin/auditoria`, só admin) com duas abas: **Atividade** (a trilha que a [[D-040 - Auditoria total toda atividade de usuario gera log persistido|D-40]] grava desde a SESSAO-13 — entradas e saídas, telas abertas, movimentações, execuções, qualidade, pedidos vindos do Tiny, estoque, ROTAS, tarefas, cadastros, chat sem as mensagens, avisos) e **Conferências com o Tiny** (a conferência diária da SESSAO-29: a rodada em andamento e o histórico, com os pedidos que estavam diferentes e o quê).
- Cada linha diz **o quê** (frase de gente, nunca o código), **quem** (o nome; "Sistema" quando é automático), **quando**, **onde** (a tela, ou os setores/etapas de origem → destino) e **por quê** (a observação do gesto ou o motivo, quando há). Detalhes sem ids. Busca pelo nº do pedido acha o que aconteceu com os cards dele.
- Filtros no servidor (pessoa, tipo, período, busca) e uma página por vez (regra 17). A saída da plataforma passou a entrar na trilha.
- **Tarefa pessoal privada ([[D-051 - Meu Painel 2 0 tres filas subtarefas tarefa privada e|D-51]]) não aparece nem para o admin** — a trilha existe no banco, mas a auditoria a esconde de quem não a criou.
- **Os erros do n8n** entram na aba das conferências numa próxima etapa (o dono avisou que vêm "futuramente").
- Decidido pelo Claude (o dono pode mudar): o período abre em "Últimos 7 dias"; 30 linhas por página; nenhuma tabela nova ([[D-047 - Regra permanente nenhuma tabela nova se uma existente pode|D-47]]) — só duas portas de leitura.

**Como ficou (técnico):** migration 50 — `plt_fn_auditoria` (trilha paginada com filtros, já traduzida: nome, pedido do card, setores/etapas, motivo; tarefa privada fora) e `plt_fn_auditoria_conferencias`; tela `src/paginas/Auditoria.tsx`; `ProvedorSessao.sair` registra `saiu`.
