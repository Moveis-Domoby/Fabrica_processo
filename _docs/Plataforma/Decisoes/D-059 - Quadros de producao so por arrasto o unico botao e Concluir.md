---
id: D-59
aliases: [D-59, D-059]
titulo: "Quadros de produção só por arrasto; o único botão é \"Concluir produção\", na LIMPEZA E EMBALAGEM"
tipo: decisao
data: 2026-09-27
status: revisada
revisa: ["[[D-024 - Execucao varios cards por pessoa com limite configuravel|D-24]]", "[[D-048 - Execucao um por vez com pausa por lider tempo de PCP e|D-48]]", "[[D-003 - Destino do card manual hoje automacao via API amanha|D-3]]"]
revisada_por: ["[[D-125 - O card avulso quem cria como termina vinculo etiquetas quem|D-125]]", "[[D-127 - A LIMPEZA E EMBALAGEM conclui pela etapa EXPEDICAO o botao|D-127]]", "[[D-173 - O botao MOVER do card a lideranca manda qualquer card|D-173]]"]
complementa: []
area: [kanban-producao]
tags: [decisao, area/kanban-producao]
---
# D-59 · Quadros de produção só por arrasto; o único botão é "Concluir produção", na LIMPEZA E EMBALAGEM (27/09/2026) — ↩️ revisa a D-24, a D-48 e a D-03

**↩️ revisada em 2026-10-14 ([[D-125 - O card avulso quem cria como termina vinculo etiquetas quem|D-125]]/D-127):** o "Concluir produção" sai da LIMPEZA E EMBALAGEM (concluir = soltar na EXPEDIÇÃO); o botão "Concluir" fica só no card avulso; Pausar/Retomar voltam dentro da janela do card e arrastar para PARADO um card em execução pede o motivo.

**↩️ revisada em 2026-10-21 ([[D-173 - O botao MOVER do card a lideranca manda qualquer card|D-173]]):** o **Mover** volta — só para a liderança (líder de qualquer setor, admin, super admin), na janela do card, para a FILA de qualquer setor de produção, com motivo obrigatório. O arrasto continua sendo o gesto da equipe.


**Decidido (resposta a1 do dono, depois de um alinhamento com a equipe da fábrica):** *"um móvel só vira móvel na parte de montagem; até a montagem ele é um plano de corte dividido em várias peças de outros móveis até. Então, por enquanto, vamos remover todos os botões, eles preferem que tudo seja arrastando, é mais rápido. Se o cara mover de 'a montar' para 'montando', esse card já deve ser instantaneamente iniciado, não o contrário; se ele mover para 'montado', o card já deve ir para o próximo setor, que é limpeza e embalagem. O único lugar que terá o botão de concluir é no setor de limpeza e embalagem: todos os móveis que vão para estoque passam por ele e eles que movem para estoque, seja móvel para estoque de fato, ou móvel já reservado por algum pedido."* E: *"já existe a etapa de fila, início e conclusão em todos os setores."*

- **Soltar o card na etapa de INÍCIO** (a próxima depois da fila — a mesma regra da [[D-048 - Execucao um por vez com pausa por lider tempo de PCP e|D-48]]↪️) **inicia o tempo de quem arrastou**, na mesma hora. O limite de 1 por pessoa (D-48) e o parecer de quem recebe ([[D-009 - Qualidade em 3 estados em TODA transicao com dupla atestacao|D-09]]) continuam valendo.
- **Soltar numa etapa que ENCAMINHA** (com nome de setor, ou CONCLUÍDO — [[D-060 - Rotas das etapas etapa com nome de setor leva ao setor|D-60]]) **leva o card ao setor dela**, pedindo a marcação 🟢🟡🔴 de quem entrega (D-09 é lei).
- **Soltar em qualquer outra etapa** (PARADO, a própria fila…) só move — e fecha o tempo de quem executava (regra que já existia).
- **"Concluir produção"** é o único botão dos quadros e só existe na **LIMPEZA E EMBALAGEM**: peça de pedido vivo → **Pedidos em aguardo**; peça sem pedido (reposição) ou de pedido cancelado → **ESTOQUE, sem dono** ([[D-058 - O lugar da peca pronta com pedido Pedidos em aguardo|D-58]]). Só 🟢.
- **Modo tablet** também vira quadro de arrastar, com botão grande; ao soltar ou concluir, pede o **PIN** de quem fez ([[D-006 - Dispositivos tablet PC fixo por setor E celular pessoal|D-06]]/SESSAO-07).
- **Saem dos quadros** os botões Iniciar, Pausar, Retomar, Finalizar, Assumir e Mover. ↩️ **[[D-024 - Execucao varios cards por pessoa com limite configuravel|D-24]]:** "iniciar é obrigatório" continua — o gesto agora é soltar na coluna de início; o "assumir" (transferência) sai por ora. ↩️ **D-48:** a pausa do líder sai junto com os botões — arrastar para PARADO ou para a fila fecha o tempo (as regras e os eventos de pausa continuam no banco). ↩️ **[[D-003 - Destino do card manual hoje automacao via API amanha|D-03]]:** o destino continua manual — quem decide é quem arrasta; a etapa que encaminha só poupa o segundo gesto.
- Decidido pelo Claude e avisado ao dono (pode corrigir): tablet por arrasto com PIN; etapa chamada ESTOQUE não encaminha (quem leva ao fim de linha é o Concluir).

**Descartadas:** manter os botões ao lado do arrasto (a equipe prefere só arrastar); concluir em todos os setores (só a LIMPEZA E EMBALAGEM leva ao fim de linha); cadastrar marca nova "etapa que inicia" (a estrutura fila → início já existia — [[Memoria - Processo de Sessao Cofre e Dono#E-44|E-44]]).
