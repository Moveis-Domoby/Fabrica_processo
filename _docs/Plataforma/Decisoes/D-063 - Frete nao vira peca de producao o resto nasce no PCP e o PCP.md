---
id: D-63
aliases: [D-63, D-063]
titulo: "Frete não vira peça de produção; o resto nasce no PCP e o PCP escolhe o lugar; pedido sem nada a produzir vai direto para Pedidos em aguardo"
tipo: decisao
data: 2026-09-28
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-001 - Unidade do card hibrido|D-1]]", "[[D-045 - Logistica e ROTAS unidade pronta lancamento ID de producao|D-45]]"]
area: [pcp]
tags: [decisao, area/pcp]
---
# D-63 · Frete não vira peça de produção; o resto nasce no PCP e o PCP escolhe o lugar; pedido sem nada a produzir vai direto para Pedidos em aguardo (28/09/2026) — ↪️ ajusta a D-01 e a D-45

**Contexto:** achado da [[Memoria - Modelos Formulas e Possibilidades#F-7|F-07]] da SESSAO-24 — o 13215 tinha um card "Frete" (1/1) na LIMPEZA E EMBALAGEM: todo item do pedido com quantidade ≥ 1 virava unidade (a regra do n8n/ClickUp de sempre, copiada na SESSAO-04). Levantamento só de leitura (8.107 itens, 03/2025 → 28/09): fora de móvel, só 4 famílias — frete/entrega, serviço de instalação ("Fechadura (com instalação)", "Passa fio (com instalação)"), revenda pronta (cadeiras, lâmpadas-kit, espelho Adnet, carro de mão, longarinas) e acessório solto (rodízios, puxador); em 90 dias, 44 de 897 pedidos (4,9%) com algum. A classe do catálogo do Tiny e o SKU **não** separam ([[Memoria - Regras de Negocio - Producao PCP Estoque e Rotas 2#A-31|A-31]]).

**Decidido (respostas do dono em 28/09):**

- **Só frete/entrega não vira card** de produção (resposta: *"Frete / entrega"*) — nem conta para o pedido ficar completo. Reconhecido **pela descrição** (resposta: *"Pela descrição"*): a 1ª palavra — "Frete", "Frete cliente", "Entrega".
- **Todo o resto** — cadeira, lâmpada, fechadura, passa-fio, rodízio, espelho… — *"SEMPRE NASCE NO PCP DO JEITO QUE ESTÁ E O PCP DEFINE O LOCAL CORRETO"*: continua virando unidade, e o PCP escolhe o destino na liberação (a cadeira de estoque pode ir direto para Pedidos em aguardo — já funcionava).
- **Cadeira e acessório são produto de estoque:** *"também são vendidos pela loja e devem estar no estoque cadastradas com a quantidade de acordo com o Tiny, se não está assim atualmente, está errado"* — conferido em 28/09: as cadeiras estão em Estoque → Produtos acabados com o número do Tiny; o que ficou para o dono decidir está na Q-71.
- **Pedido sem nada a produzir** (só frete — nunca aconteceu: 0 em 5.410 pedidos): *"Direto p/ Pedidos em aguardo"* — nasce no PCP (entrada única, [[D-013 - Entrada unica e saidas terminais do fluxo|D-13]]), não espera liberação e aparece já completo para a logística lançar para ROTAS. Decidido **na leitura**: se o Tiny acrescentar um móvel, o pedido volta sozinho ao quadro do PCP.
- ↪️ **[[D-001 - Unidade do card hibrido|D-01]]:** "cada móvel vira um card por unidade" — frete/entrega não é móvel e não vira card. ↪️ **[[D-045 - Logistica e ROTAS unidade pronta lancamento ID de producao|D-45]]:** "unidade pronta" e pedido completo contam só unidades de produção.

**↩️ revisada em 2026-10-08 (SESSAO-30, raio-x 3 — escolha do dono em 06/10 de incluir o item):** o PCP libera **só para setor de produção**; ESTOQUE, Pedidos em aguardo e ROTAS não são destino de liberação, para toda origem (o ajuste do super admin — [[D-117 - PCP do super admin seletor de situacao do pedido e arquivar|D-117]] — passa). A peça pronta do estoque (a cadeira de revenda, inclusive) entra pela **sugestão "usar?"**, que a faz nascer pronta no aguardo; sem peça no estoque, vai pela LIMPEZA E EMBALAGEM → "Concluir produção". Na história, o PCP nunca liberou direto para o aguardo (0 de 33 liberações). ✅ **Confirmada pelo dono em 13/10** ([[D-124 - O marcador Devolvido do Tiny NAO e cancelamento a fabrica|D-124]]).

**Como ficou (técnico):** migration 39 — a regra única na view `plt_privado.vw_itens_producao` (eh_frete + unidades; view e não função porque função com `set search_path` não é embutida pelo planner — [[Memoria - Desempenho e Tempo Real#E-65|E-65]]), somada pelas 17 portas que contam unidades; gatilho em `plt_cards` recusa card de unidade de frete para todo escritor ([[Memoria - Modelos Formulas e Possibilidades#M-14|M-14]]); `lock_timeout` de 5 s na aplicação ([[Memoria - Migrations Aplicador e Ensaio 1#E-66|E-66]]); manutenção arquiva o card de frete que nasceu antes da regra (o do 13215 — card de teste, [[Memoria - Modelos Formulas e Possibilidades#M-16|M-16]]).

**Descartadas:** reconhecer pela classe do produto no Tiny (a classe "simples" mistura móvel feito aqui — Penteadeira camarim, 82 vendas — com revenda, e frete não tem SKU); lista editável no admin (tabela nova sem necessidade — [[D-047 - Regra permanente nenhuma tabela nova se uma existente pode|D-47]]); o PCP marcar item a item (+1 gesto por pedido); tirar também revenda, serviço e acessório da produção (o dono quer o PCP decidindo o lugar).

> Numeração: a SESSAO-24 (que rodou em paralelo com a 26) usou [[D-058 - O lugar da peca pronta com pedido Pedidos em aguardo|D-58]]…[[D-062 - A sugestao do estoque na liberacao o que e peca igual e quem|D-62]]; a D-63 é do ajuste do Frete (28/09); a D-64 ficou sem uso.
