---
id: D-120
aliases: [D-120]
titulo: "O pedido entregue sai da ROTAS e mora no PCP, com tudo dele num clique"
tipo: decisao
data: 2026-10-08
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-063 - Frete nao vira peca de producao o resto nasce no PCP e o PCP|D-63]]", "[[D-113 - Entregue e um fato so dos dois lados e entregue no Tiny fecha|D-113]]"]
area: [pcp, logistica-rotas]
tags: [decisao, area/pcp, area/logistica-rotas]
---
# D-120 · O pedido entregue sai da ROTAS e mora no PCP, com tudo dele num clique (08/10/2026, pedido do dono) — ↪️ D-63/D-113

**Decidido (pedido do dono, 08/10, noite):** *"Os pedidos entregues devem sumir das rotas também e moram apenas em PCP com TODAS as informações daquele pedido caso eu clique nele, observações, situação de pagamento e tudo mais."*

- **ROTAS → Entregas** mostra **só o que falta entregar** — a escolha "Entregues" saiu da tela. **Programação → Já programadas** também mostra só o que falta entregar.
- **Entregas do dia (a tela do entregador):** o que já foi entregue **sai da lista e do mapa** e fica numa linha recolhida no fim ("Entregues hoje" / "Entregues neste dia"), só para **desfazer no mesmo dia** quem marcou errado ([[D-063 - Frete nao vira peca de producao o resto nasce no PCP e o PCP|D-63]] segue valendo).
- **PCP → Todos os pedidos** é a casa do pedido entregue. O clique no pedido abre a **janela completa**, numa requisição só (Lei §2/§3): situação na plataforma e no Tiny, marcadores, a entrega (quando, quem, de onde, observação), cliente e endereço com telefone e documento, programação e equipe, **pagamento** (forma, meio, condição, parcelas; as contas a receber e o "pago / em aberto" quando a integração as tem), comprovantes, valores, datas, vendedor, envio e rastreio, nota fiscal, **observações** (a do pedido e a interna), itens com valor e unidades de produção, onde está (ou para onde foi) cada peça e a linha do tempo. **Desfazer a entrega** também pode ser feito dali, no mesmo dia, por quem pode.
- **Limite conhecido (avisado ao dono):** o "pago / em aberto" de cada parcela vem das contas a receber copiadas do Tiny, e essa cópia parou em 09/09/2026. A janela diz isso com todas as letras quando não há conta copiada. Voltar a copiar as contas a receber é uma frente separada — **decisão do dono**.
