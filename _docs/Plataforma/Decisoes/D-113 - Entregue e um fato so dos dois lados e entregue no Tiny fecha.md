---
id: D-113
aliases: [D-113]
titulo: "\"Entregue\" é um fato só, dos dois lados — e entregue no Tiny fecha TUDO do pedido aqui"
tipo: decisao
data: 2026-10-08
status: vigente
revisa: ["[[D-033 - ROTAS dentro da plataforma ClickUp nao recebe mais nada|D-33]]", "[[D-045 - Logistica e ROTAS unidade pronta lancamento ID de producao|D-45]]"]
revisada_por: []
complementa: []
area: [logistica-rotas, tiny-n8n]
tags: [decisao, area/logistica-rotas, area/tiny-n8n]
---
# D-113 · "Entregue" é um fato só, dos dois lados — e entregue no Tiny fecha TUDO do pedido aqui (08/10/2026) — ↩️ revisa a D-33 e a D-45

**Decidido (respostas do dono no início da [[SESSAO-30 - Producao de Ponta a Ponta - Pedido Reabastecimento e Entrega]], 06/10 no Cowork e 08/10 na sessão):**

- *"Se está entregue no Tiny, aqui deve estar como entregue também; para ser entregue no Tiny é porque a peça do pedido não existe mais no galpão e não deve mais estar nada referente a ele em aberto aqui."* → o Tiny ficou "Entregue" (aviso de venda ou conferência das 3h) = a plataforma registra a entrega sozinha (assinada "Sistema", origem Tiny) e **fecha tudo do pedido, onde a peça estiver** — PCP, produção (o tempo aberto é fechado antes), aguardo, ROTAS. Nada volta ao Tiny. ↩️ A recomendação do Claude era avisar e uma pessoa decidir — o dono escolheu fechar.
- **Marcou entregue na plataforma → o Tiny fica "Entregue" na hora** (o banco chama o n8n só quando há entrega — sem relógio); a entrega vale aqui na hora, o Tiny vai depois se estiver fora do ar.
- **Os caminhos (resposta 8 — *"coloque um fluxo bifurcado"*):** Tiny → plataforma (pelo fluxo de vendas que já existe); ClickUp → Tiny → plataforma (o fluxo antigo do ClickUp continua ligado); plataforma → Tiny (caminho novo no MESMO fluxo do ClickUp, como um segundo ramo). **O ClickUp só avisa, nunca recebe.** O fluxo antigo **não será desligado por enquanto** — a equipe ainda dá a entrega pelo ClickUp.
  - ↩️ **08/10 (etapa 4, Claude):** o caminho plataforma → Tiny virou um **fluxo próprio** no n8n ("Plataforma → Tiny (situação do pedido)"), e não um ramo dentro do fluxo do ClickUp: isola o novo do que a equipe usa todo dia (um erro num não derruba o outro) e a chave da API do n8n só lê (o fluxo entra no ar importado, com o dono). A bifurcação dos três caminhos é a mesma. Detalhe: [[N8N - Plataforma para Tiny (situacao do pedido)]].
- **Desfazer (resposta 6):** quem desfaz é **o entregador**, só as entregas **do dia**, escolhendo um **motivo** ([[D-116 - Motivos de nao entregue e de desfazer a entrega|D-116]]); o Tiny volta junto para a situação de antes, na hora.
- **As peças entregues saem de toda conta** (estoque, reservas, ROTAS ativa, Visão do dia) e ficam no histórico — por evento, nada se apaga.
- ↩️ **[[D-033 - ROTAS dentro da plataforma ClickUp nao recebe mais nada|D-33]]** ("a automação ROTAS entregue → Tiny em produção não se toca"; "a plataforma nunca lê do Tiny"): a entrega agora vai e volta do Tiny pelo n8n. ↩️ **[[D-045 - Logistica e ROTAS unidade pronta lancamento ID de producao|D-45]]**: a entrega deixa de ser só um registro interno.
