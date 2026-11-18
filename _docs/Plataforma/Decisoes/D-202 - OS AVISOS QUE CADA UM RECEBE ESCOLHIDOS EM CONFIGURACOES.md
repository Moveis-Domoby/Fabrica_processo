---
id: D-202
aliases: [D-202]
titulo: "OS AVISOS QUE CADA UM RECEBE, ESCOLHIDOS EM CONFIGURAÇÕES → AVISOS; os erros de automação ganham aviso; o administrador não recebe nem decide a própria troca de senha"
tipo: decisao
data: 2026-10-28
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-191 - ESQUECI MINHA SENHA LIBERADO POR UM ADMINISTRADOR aviso|D-191]]", "[[D-200 - O PEDIDO DE TROCA DE SENHA PARA E-MAIL SEM CADASTRO AVISA|D-200]]"]
area: [painel-chat-automacoes, acesso-usuarios]
tags: [decisao, area/painel-chat-automacoes, area/acesso-usuarios]
---
# D-202 · OS AVISOS QUE CADA UM RECEBE, ESCOLHIDOS EM CONFIGURAÇÕES → AVISOS; os erros de automação ganham aviso; o administrador não recebe nem decide a própria troca de senha (28/10/2026, pedido do dono) — ↪️ D-191 e D-200

**Pedido do dono:** *"Pode corrigir os dois, inclusive, aproveitando que você irá realizar modificações dentro dos sinos, crie uma tela em configurações para editar as notificações com todos os avisos possíveis, para que o usuário possa editar os avisos que ele deseja receber, quero remover alguns desnecessários para mim e colocar outros que são necessários como notificações de erros de automação e coisas do tipo que eu devo estar ciente."*

**Decidido (respostas do dono, 28/10):**

- **A tela:** Configurações → **Avisos** (para quem vê Configurações: liderança e administradores; atalho também no sino). Todos os avisos da plataforma, por assunto — Produção e qualidade · Expedição e estoque · Pedidos e Tiny · Cards e afazeres · Acesso · Erros de automação e integrações —, cada um com liga/desliga, a frase do que ele é e **quantos chegaram nos últimos 30 dias** (para ver o que mais enche o sino). Mostra só os avisos que podem chegar para aquela pessoa.
- **Quem edita:** cada um, os próprios; **o administrador escolhe também os de qualquer pessoa** (resposta: *"Cada um + admin edita todos"*) — "De quem" no alto da tela.
- **Os urgentes ficam sempre ligados** (resposta): o pedido de troca de senha e "ainda tem alguém neste card?" aparecem travados ("Sempre ligado").
- **Desligado = o aviso não nasce** para a pessoa (nem no sino, nem no aviso urgente). Ligar de novo volta a chegar dali em diante.
- **Os erros de automação e integrações** vão para os administradores; **ligados por padrão só para o super admin** — os outros administradores ligam se quiserem (resposta). Os de antes: o Tiny desistiu de um item, erro numa automação do n8n, a conexão com o Tiny da fábrica caiu, a lista do Tiny veio incompleta, o Tiny não aceitou a situação de um pedido. **Os novos** (resposta: os três): **uma automação da plataforma falhou**, **o estoque parou de ir para o Tiny** (5 tentativas) e **um aviso para uma integração não foi entregue** (5 tentativas). O mesmo erro não repete o aviso dentro de 1 hora (o estoque, 1 dia); a Auditoria registra todos.
- **Os dois achados do ajuste da senha, corrigidos:** o sino não mostra mais a barrinha de rolagem para o lado; **o administrador que pede a troca de senha não recebe o próprio aviso, não vê o próprio pedido na lista e não consegue liberá-lo** — outro administrador decide.

**Como ficou (técnico):** migration `20261028030000` — `plt_usuarios.avisos jsonb` (a escolha; nula = padrão; fora da API); `plt_privado.fn_avisos_catalogo()` (o catálogo: tipo, assunto, nome, frase, público, obrigatório, erro — aviso novo = uma linha); `fn_aviso_publico_de`, `fn_aviso_ligado`; o gatilho **`plt_notificacoes_filtrar`** (antes de gravar — vale para todo produtor de aviso); `fn_alertar_erro` (o corpo de `fn_tiny_alertar`, com o tipo e para os administradores — `fn_tiny_alertar` virou um caso dele); `plt_fn_tiny_pedido_resultado` (o laço do aviso para os administradores); os gatilhos de fato `plt_automacao_execucoes_falhou`, `plt_tiny_estoque_fila_parou`, `plt_webhook_entregas_falhou`; `plt_fn_senha_solicitar/pedidos/decidir` (a própria troca); as portas `plt_fn_avisos(pessoa)` e `plt_fn_aviso_definir(tipo, ligado, pessoa)`; o índice `plt_notificacoes_destinatario_idx`. Tela: `src/paginas/ConfigAvisos.tsx`, `src/notificacoes/preferencias.ts`, o sino (atalho e sem rolagem lateral), o destino dos erros novos (estoque → Configurações → Estoque; integração → API e integrações).

**Descartadas:** filtrar no sino (o aviso nasceria e contaria no banco — e o urgente da tela abriria igual); uma tabela de preferências (a escolha cabe no cadastro da pessoa — "nada de tabela nova"); deixar desligar os urgentes (ninguém responderia).
