---
id: D-65
aliases: [D-65, D-065]
titulo: "Chat interno: canais, particulares e Avisos gerais — quem cria, quem escreve, quem lê"
tipo: decisao
data: 2026-09-27
status: revisada
revisa: []
revisada_por: ["[[D-131 - Mensagens podem ser editadas e apagadas no card e no chat|D-131]]"]
complementa: []
area: [painel-chat-automacoes]
tags: [decisao, area/painel-chat-automacoes]
---
# D-65 · Chat interno: canais, particulares e Avisos gerais — quem cria, quem escreve, quem lê (27/09/2026)

**↩️ revisada em 2026-10-14 ([[D-131 - Mensagens podem ser editadas e apagadas no card e no chat|D-131]]):** a mensagem pode ser editada e apagada pelo autor; admin/super admin veem as apagadas nas conversas a que têm acesso (a particular dos outros continua fechada).


**Decidido (respostas do dono no início da SESSAO-26):**

- **Três tipos de conversa:** canal de grupo, particular (1:1 com qualquer colega) e **Avisos gerais** (uma conversa da empresa inteira — todo cadastro participa, inclusive quem chega depois, sem herdar "não lidas" antigas).
- **Canal: só líder e admin criam** (resposta 2). **Quem cria administra** — muda o nome, põe e tira pessoas; o admin da plataforma que estiver no canal também administra. Ninguém tira a si mesmo.
- **Avisos gerais: o admin escreve sempre e decide QUEM MAIS escreve** (resposta 3 — lista configurável na própria conversa, "Quem escreve"); os demais só leem.
- **Cada um lê só as conversas de que participa — nem o admin lê particular ou canal alheio**, nem pela API (RLS por participação + canal de websocket privado).
- **Guardar para sempre** (resposta 4). Mensagem é **só inserção**: não se edita nem se apaga (histórico simples e honesto); quem sai de um canal não é apagado — a saída fica marcada.
- **Conta de tablet do setor participa normalmente** (resposta 5) — na prática ela vive no `/tablet`, onde o chat não aparece.
- **Trilha ([[D-040 - Auditoria total toda atividade de usuario gera log persistido|D-40]]):** canal criado/renomeado, pessoa posta/tirada, quem escreve nos avisos, aviso publicado e data de nascimento alterada. **Mensagem comum e abertura de particular NÃO vão para a trilha** — a própria mensagem já é o registro, e a trilha mostraria aos admins quem conversa com quem. Conteúdo, nunca.
- Mensagem nova **não** vai para o sino (o sino é dos avisos do sistema); quem avisa é o badge do balão.

**Descartadas:** todos criarem canal; líderes escreverem nos avisos por padrão; admin lendo tudo (auditoria de conversa); apagar/editar mensagem.
