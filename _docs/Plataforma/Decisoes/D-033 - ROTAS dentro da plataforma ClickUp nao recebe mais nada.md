---
id: D-33
aliases: [D-33, D-033]
titulo: "ROTAS dentro da plataforma; ClickUp não recebe mais nada"
tipo: decisao
data: 2026-08-28
status: revisada
revisa: ["[[D-005 - Escopo producao primeiro logistica depois|D-5]]"]
revisada_por: ["[[D-113 - Entregue e um fato so dos dois lados e entregue no Tiny fecha|D-113]]"]
complementa: []
area: [logistica-rotas]
tags: [decisao, area/logistica-rotas]
---
# D-33 · ROTAS dentro da plataforma; ClickUp não recebe mais nada (28/08/2026) — ↩️ revisa a D-05

**↩️ revisada em 2026-10-08 ([[D-113 - Entregue e um fato so dos dois lados e entregue no Tiny fecha|D-113]]):** a entrega passa a ir e voltar do Tiny pelo n8n — o fluxo do ClickUp ganha um segundo ramo (plataforma → Tiny) e o Tiny "Entregue" fecha o pedido aqui. O ClickUp só avisa, nunca recebe.

**Decidido (palavras do dono):** *"rotas será criado aqui dentro também, então nada deve ser pensado mais em criar coisa no ClickUp; n8n também não vai jogar nada aqui por enquanto, já temos todos os dados que precisamos para as rotas da forma que o n8n joga pra gente"*.

- A **ponte ROTAS → ClickUp morre antes de nascer**: nenhuma integração nova cria nada no ClickUp.
- **Módulo básico de rotas nasce na SESSAO-11** (opção B confirmada pelo dono), seguindo a documentação de rotas existente nos `_docs`; onde não houver documentação, seguir o padrão do sistema.
- **Agrupamento por pedido completo:** a entrega sai por pedido inteiro ("mesmo que tenha 30 unidades, não vamos entregar 10 móveis se ele pediu 30").
- A plataforma **nunca lê do Tiny** (Q-52 ✅); a automação ROTAS "entregue" → Tiny **em produção não se toca**.
