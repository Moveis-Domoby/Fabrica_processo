---
id: D-141
aliases: [D-141]
titulo: "As respostas do dono sobre o que ficou da SESSAO-32 e as pendências antigas"
tipo: decisao
data: 2026-10-16
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-137 - SESSAO-32 as respostas do dono tempo logado medicao nos|D-137]]", "[[D-030 - Publicacao adiada nenhum deploy no bloco noturno|D-30]]"]
area: [processo]
tags: [decisao, area/processo]
---
# D-141 · As respostas do dono sobre o que ficou da SESSAO-32 e as pendências antigas (16/10/2026) — ↪️ D-137, D-30

**Respostas do dono (16/10, trazidas no início da [[SESSAO-33 - Tiny Completo - Todos os Dados Atualizados por Evento]], com o dono fora de casa, pelo celular):**

1. **A chave nova do login e o gancho do token no painel da Supabase** → o dono faz quando chegar em casa (segue pendente com ele; o Claude guia — [[D-137 - SESSAO-32 as respostas do dono tempo logado medicao nos|D-137]]).
2. **As rotinas que acordam de minuto em minuto passarem a rodar só quando algo acontece** (reservas do estoque, envio de avisos, disparo do Comercial, fotos do Tiny) → **aprovado**. Vira trabalho de sessão — na SESSAO-33 só se couber no fim (§4 da demanda); o disparo do Comercial nunca roda em dois lugares.
3. **A máquina do banco** → **fica no plano gratuito por enquanto**. Sai da lista de pendências (a dívida 19 da [[PLT - Lei de Desempenho e Escala]] fica registrada como escolha de custo do dono).
4. **O projeto de testes pausado na Supabase ("Sistema Domoby - Staging")** → **liberado para os ensaios pesados** (carga, volume ×100).
5. **As 6 escolhas provisórias da SESSAO-32** (§6 do [[handoff_2026_10_16_sessao32_desempenho_escala]]):
   1. Tempo de sessão — tablet 12 h / escritório 8 h → **confirmado**.
   2. Medição de velocidade — uma linha por abertura, só o dono vê → **confirmado**.
   3. Pessoa desativada → **MUDOU: recusar já no login, com mensagem clara** (não deixar entrar e negar tudo depois). O gancho do token em `supabase/pendentes/` passa a recusar a pessoa inativa ao emitir ou renovar o token, com a mensagem em português de gente; **continua só ligando quando o dono fizer os cliques em casa**. O login da plataforma (que hoje responde "usuário ou senha incorretos" também para quem está desativado) passa a dizer, **só para quem acertou a senha**, que o acesso está desativado — quem erra a senha continua sem saber se a conta existe.
   4. Releituras espalhadas — painel 4 s, PCP 1,5 s, logística 1 s, quadro 0,7 s → **confirmado**.
   5. Busca de Pedidos por caminhos junto com os índices → **confirmado** (já aplicada — [[D-138 - SESSAO-32 o OK dos indices e os insumos separados dos moveis|D-138]]).
   6. Auditoria e histórico das automações → **paginação por rolagem**: carrega mais ao rolar, sem números de página, por cursor (regra 18).
6. **Tarefas entregues no ClickUp** → já **concluídas pelo Cowork em 16/10** (25 tarefas: as 7 do kanban completo, os 14 ajustes de 15/10, e tempo real, pacote dividido, banco e listas por cursor). Ficaram abertas: primeira abertura (telas com 2–3 leituras), comercial/gravação do pedido do Tiny e permissões no token.

**Pendências antigas:**
- **Olhar o kanban no tablet** → o dono vê depois (mantém).
- **A imagem de teste do comprovante no pedido 13622** → o dono **autorizou tirar**. É dado de produção: sai pelo caminho normal da plataforma (anexo/comprovante; se for evento, a correção é evento novo — nunca apagar evento, regra 5), mostrando ao dono exatamente o que sai e só executando com o "pode" dele na conversa.
- **Contagem inicial do estoque** → o dono acredita que foi feita, mas **mantém como pendência** (conferir no banco).
- **Publicação no ar** → **já está publicada** (o site está no ar e as sessões publicam nele desde setembro). A [[SESSAO-08 - Publicacao no Ar]] fecha como **entregue** e sai de toda lista de pendências e de "em espera" (↪️ revisa a [[D-030 - Publicacao adiada nenhum deploy no bloco noturno|D-30]]).
- **Cartões de insumo parados no quadro do ESTOQUE** (D-138) → **mantém**; o destino deles volta quando entrar a parte da linha de produção que consome insumo e atualiza o estoque em tempo real.
