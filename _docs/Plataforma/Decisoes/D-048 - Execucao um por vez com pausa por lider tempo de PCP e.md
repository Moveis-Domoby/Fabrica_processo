---
id: D-48
aliases: [D-48, D-048]
titulo: "Execução um por vez com pausa por líder; tempo de PCP e de aguardo são do pedido"
tipo: decisao
data: 2026-09-21
status: revisada
revisa: ["[[D-024 - Execucao varios cards por pessoa com limite configuravel|D-24]]"]
revisada_por: ["[[D-059 - Quadros de producao so por arrasto o unico botao e Concluir|D-59]]"]
complementa: []
area: [kanban-producao, tempos-paineis]
tags: [decisao, area/kanban-producao, area/tempos-paineis]
---
# D-48 · Execução um por vez com pausa por líder; tempo de PCP e de aguardo são do pedido (21/09/2026) — ↩️ revisa a D-24 e a Q-17

**↩️ revisada em 2026-09-27 ([[D-059 - Quadros de producao so por arrasto o unico botao e Concluir|D-59]]):** a pausa do líder saiu dos quadros junto com os botões — arrastar para PARADO ou para a fila fecha o tempo. O limite de 1 por pessoa e o "iniciar na fila avança" continuam (agora pelo arrasto).

**↩️ revisada em 2026-10-14 ([[D-125 - O card avulso quem cria como termina vinculo etiquetas quem|D-125]], SESSAO-31):** a pausa volta, **com motivo** (lista "Motivos de pausa" + "Outro"), na **janela do card** (Pausar / Retomar); o **próprio operador** pausa o card dele, o líder/admin o de qualquer um do setor. Soltar no PARADO um card em execução pergunta o motivo (o tempo fecha como antes). Pausado continua sem contar tempo e sem ocupar o limite; retomar com outra execução aberta continua recusado.

**Decidido (respostas do dono no início da SESSAO-22):**

- **Limite de execuções por pessoa: o padrão vira 1** em todos os setores (↩️ revisa a [[D-024 - Execucao varios cards por pessoa com limite configuravel|D-24]], que nascia "sem limite"). Segue **configurável por setor** — e a edição passa a ser permitida a **líderes (do próprio setor) e admins**, nas configurações do setor.
- **Líder pode pausar a execução de alguém** (urgência do dia a dia). ↩️ Isto revisa a Q-17 ("não existe pausa"): a pausa volta, mas como **gesto de gestão do líder/admin**, não como disputa de qualidade. `execucao_pausada`/`execucao_retomada` são eventos append-only; execução pausada **não conta tempo** para a pessoa **nem ocupa o limite** — é o que deixa a urgência entrar.
- **Retomar:** a própria pessoa retoma sozinha, **mas só depois de finalizar a urgência** — retomar com outra execução aberta é recusado pela mesma trava do limite (palavras do dono: *"se a urgência tá aberta pra ele então tá errado, ele tem que concluir a urgência antes de pegar outro"*).
- **Tempo em PCP é do PEDIDO:** o pedido entra no PCP e **só para de contar quando for liberado por completo** (todas as unidades). Cada produto tem o próprio tempo de produção (da liberação em diante). Isto substitui as duas alternativas cogitadas na demanda (até a liberação daquela unidade / da primeira unidade).
- **Tempo de aguardo é do PEDIDO:** com tudo produzido, o pedido conta **tempo de aguardo total** em Pedidos em aguardo — insumo futuro do **cálculo de tempo de entrega**. Todos esses tempos ficam salvos no banco (derivados dos eventos — [[Memoria - Modelos Formulas e Possibilidades#M-2|M-02]]; nada se grava à mão).

**Descartadas:** tempo de PCP por unidade (até a liberação dela ou da primeira); retomada só pelo líder; limite padrão diferente por setor.

**↪️ Complemento (21/09/2026, revisão ao vivo da SESSAO-22 — palavras do dono):** *"quando eu iniciar qualquer card que estiver na fila, ele deve ser automaticamente movido para a próxima etapa; uma etapa pode sim ter mais de 1 execução ao mesmo tempo, um usuário que não pode."*

- **Iniciar na FILA avança sozinho** para a próxima etapa do setor (ordem seguinte, ativa, não-DANIFICADO), com a execução aberta já na etapa nova — [[Memoria - Modelos Formulas e Possibilidades#M-1|M-01]]: o humano decide (iniciar), o sistema executa a consequência (sair da fila). Setor cuja fila é a única etapa: executa na própria fila ([[D-014 - Etapas internas cadastro livre cada uma com timer proprio|D-14]] — etapa não se inventa). Migration 30.
- **O limite de execuções é da PESSOA, nunca da etapa** — confirma o desenho: várias execuções na mesma etapa são normais; a mesma pessoa é que respeita o teto do setor.
