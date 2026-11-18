---
id: D-53
aliases: [D-53, D-053]
titulo: "Estoque na frente: a 25 troca de ordem com a 24 e absorve o estoque-base"
tipo: decisao
data: 2026-09-24
status: vigente
revisa: []
revisada_por: []
complementa: []
area: [estoque]
tags: [decisao, area/estoque]
---
# D-53 · Estoque na frente: a 25 troca de ordem com a 24 e absorve o estoque-base (24/09/2026)

**Pedido do dono:** *"preciso urgentemente dessa sessão do estoque completamente entregue"*.

**Decidido:**
1. **Ordem de execução do Bloco 5 passa a ser 22 → 23 → 25 → 24 → 26 → 27 → 28.** A [[SESSAO-25 - Integracao Tiny Fabrica - Estoque e Minimos]] roda **antes** da [[SESSAO-24 - Estoque Nucleo - Aguardo Cancelamentos e Alocacao]].
2. **O estoque-base migra da 24 para a 25**, para o estoque sair inteiro numa sessão só: **item com pedido × sem dono**, **lançamento manual de estoque** e a **tela de Estoque** (saldo, mínimo, sinalização). A 24 fica com as **consequências**: "Concluir produção" → Pedidos em aguardo, os 3 fluxos de cancelamento e a sugestão de alocação no PCP.
3. **Os números dos arquivos NÃO mudam** (`SESSAO-24`/`SESSAO-25` continuam como estão) — renomear quebraria dezenas de links do cofre. Isto abre **exceção pontual à regra "número = ordem"** da [[D-023 - Replanejamento da jornada a partir da 5 posicao|D-23]]: onde número e ordem divergirem, **vale a coluna Ordem de [[000 - ORDEM DAS SESSOES]]**.
4. **Saldo negativo:** na plataforma é exibido como **0** (*"não existe ter −2 mesas em estoque"*); o valor cru continua no evento. A correção da causa no Tiny fica com o dono ([[N8N - Pendencias e Riscos#P16]]) — **não corrigir por automação**.

**Contexto que tornou isso possível:** entre 21 e 23/09, fora de sessão de código, a **integração com o Tiny da fábrica ficou pronta e em produção** (catálogo `produtos` com 487 itens, `fn_upsert_produto`, workflow n8n ativo e webhook de lançamentos de estoque ligado, com o payload capturado). Ou seja, a parte "externa" da 25 já está feita — sobrou o trabalho dentro da plataforma. Ver [[N8N - Tiny Fabrica Produtos para Banco]].
