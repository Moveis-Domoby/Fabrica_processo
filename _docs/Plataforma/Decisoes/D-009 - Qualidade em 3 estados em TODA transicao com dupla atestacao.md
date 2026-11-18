---
id: D-9
aliases: [D-9, D-09, D-009]
titulo: "Qualidade em 3 estados em TODA transição, com dupla atestação"
tipo: decisao
data: 2026-08-19
status: revisada
revisa: []
revisada_por: ["[[D-126 - A marcacao do estado da peca perfeito atencao danificado vira|D-126]]"]
complementa: []
area: [kanban-producao]
tags: [decisao, area/kanban-producao]
---
# D-9 · Qualidade em 3 estados em TODA transição, com dupla atestação (19/08/2026)

**↩️ revisada em 2026-10-14 ([[D-126 - A marcacao do estado da peca perfeito atencao danificado vira|D-126]]):** a marcação deixa de ser obrigatória — vira chave por setor, por tipo de card, no envio e no recebimento; nasce tudo desligado.


**Decidido (pedido da equipe, trazido pelo dono):** o estado físico da peça impacta completamente o andamento entre setores — e **um setor pode dizer que algo está bom apenas para prejudicar o próximo**. Por isso a atestação é **dupla**: quem entrega marca, quem recebe confirma.

**O fluxo:**

1. **Ao mover** o card para outro setor, é **obrigatório** marcar um de 3 estados: 🟢 **perfeito estado** · 🟡 **estado de atenção** · 🔴 **danificado**.
2. **Ao receber**, antes de iniciar qualquer etapa da produção, o setor recebedor vê: *"O setor X marcou como Y — você concorda?"* e registra o próprio parecer.
3. **Se NÃO concorda:** define o novo estado → **notifica um líder** → a peça entra em **pausa momentânea** até o líder resolver.
4. **Se concorda:** 🟢 segue o fluxo padrão · 🔴 vai para DANIFICADO e **notifica líder/admin** · 🟡 pergunta se deseja **seguir o fluxo normal ou notificar o admin**.
5. **Toda decisão entre etapas reflete na dashboard** — qualidade por setor, divergências, quem entrega dano.

**↩️ Revisão (24/08/2026):**

- **Sem foto obrigatória** na saída nem na entrada (Q-15 ✅).
- **Sem fluxo de disputa/pausa por enquanto** (Q-17 ✅): a dupla marcação continua (quem entrega marca, quem recebe registra o próprio parecer), mas divergência **não pausa a peça nem abre resolução formal** — vira registro que alimenta a dashboard. O card segue o fluxo normal de recebimento.
**↪️ Complementos (24/08/2026, segunda rodada):**

- **Notificação (Q-18 ✅):** divergência entre setores, OU marcação 🟡, OU marcação 🔴 → **líder/admin é notificado automaticamente, com exatamente o que aconteceu** (quem marcou o quê, setores envolvidos, os dois pareceres). Isso substitui a escolha manual de 19/08 ("seguir ou notificar") — no 🟡 o card segue o fluxo E a notificação sai sozinha.
- **Critério do 🟡 (Q-16 ✅), nas palavras do dono:** *"levemente danificado, porém ainda dá pra seguir e tentar consertar"* — este texto vai escrito na interface de marcação.
- **API sem estado (Q-19 ✅):** movimentação por API externa **NÃO exige estado de qualidade** — a atestação é um gesto exclusivamente humano. (Proposta do Cowork de estado obrigatório no payload foi descartada pelo dono.)
