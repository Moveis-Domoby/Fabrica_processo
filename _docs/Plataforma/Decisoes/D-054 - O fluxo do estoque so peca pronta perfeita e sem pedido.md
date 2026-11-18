---
id: D-54
aliases: [D-54, D-054]
titulo: "O fluxo do estoque: só peça pronta, perfeita e sem pedido; abaixo do mínimo, o estoque pede REPOSIÇÃO ao PCP"
tipo: decisao
data: 2026-09-26
status: revisada
revisa: ["[[D-022 - Kanban liberacao parcial destino livre PCP com visao completa|D-22]]"]
revisada_por: ["[[D-070 - O estoque dos acabados e a CONTAGEM da logistica entrada|D-70]]", "[[D-126 - A marcacao do estado da peca perfeito atencao danificado vira|D-126]]", "[[D-186 - Lancar qualquer movel para producao a qualquer momento|D-186]]"]
complementa: []
area: [estoque]
tags: [decisao, area/estoque]
---
# D-54 · O fluxo do estoque: só peça pronta, perfeita e sem pedido; abaixo do mínimo, o estoque pede REPOSIÇÃO ao PCP (26/09/2026) — ↩️ revisa a D-22 e fecha a Q-23

**↪️ 30/09/2026 ([[D-085 - Reposicao parada 2 dias uteis da FABRICA seg sex no PCP sai|D-85]]/D-87):** a reposição ganhou a **segunda saída** (parada 2 dias úteis no PCP, sai sozinha — o Sistema assina) e o **liga/desliga no Painel admin** (agendar/desagendar a rotina); desligada, a logística lança à mão. O mínimo que dispara passou a ser o automático do Top X ([[D-083 - O Top X manda no estoque e o tamanho da pagina e so ele tem|D-83]]/D-84), e a conta desconta o que já vem para o estoque ([[D-086 - Reservados o cartao mostra TUDO que esta em producao|D-86]]).

**↩️ revisada em 2026-09-28 ([[D-070 - O estoque dos acabados e a CONTAGEM da logistica entrada|D-70]]):** agora EXISTE entrada manual no ESTOQUE — a logística/admin cadastra, dá baixa e confere a contagem dos acabados ("por enquanto", palavras do dono). O resto desta decisão (ESTOQUE só com peça 🟢 e sem dono; reposição no PCP) segue valendo.

**Decidido (resposta 7 do dono no início da SESSAO-25 — ele NÃO confirmou o item sem dono nascendo direto no ESTOQUE):** *"Dentro dele não ficará mais nenhum produto danificado, nem com estado de atenção, nem produtos prontos com pedido definido; produtos prontos com pedidos definidos serão estoque reservado e não devem contabilizar positivamente no estoque de fato … quando o produto ficar abaixo do estoque mínimo, lançamos para a produção (PCP) um card de 'necessidade de reposição em estoque', esse card que o estoque vai gerar, no fim também é o PCP que vai decidir o rumo dele; assim que o produto for produzido, vai para estoque aguardar a venda."*

- **Estoque de fato = peça pronta, 🟢 e SEM pedido.** Pronta COM pedido = **reservada** (duas etiquetas: SKU + pedido) — aparece à parte, nunca soma.
- **O ESTOQUE só recebe peça 🟢** — regra do banco para chegada humana (trigger `plt_eventos_validar_chegada_estoque`); as telas de mover/concluir/resolver danificado só oferecem 🟢 quando o destino é o ESTOQUE.
- **Card de REPOSIÇÃO** (tipo novo `reposicao` em `plt_cards`): a maquinaria gera no **PCP** quando o disponível de um produto do catálogo fica abaixo do mínimo do Tiny — um ciclo vivo por produto; depois de um ciclo, só reabre com leitura NOVA do Tiny daquele produto (a peça pronta precisa entrar no Tiny antes). Quantidade = mínimo − disponível (o negativo NÃO entra: aqueles pedidos já têm card próprio no PCP). O **PCP decide**: libera as unidades (nascem sem pedido) ou **"Não produzir"** (arquiva). Pronta → fica **livre** no ESTOQUE.
- **[[D-013 - Entrada unica e saidas terminais do fluxo|D-13]] continua valendo** (tudo entra pelo PCP). **↩️ [[D-022 - Kanban liberacao parcial destino livre PCP com visao completa|D-22]] revisada:** existe card no PCP que não nasce de pedido do Tiny — o de reposição, gerado pelo estoque (nunca digitado à mão).
- **Não existe lançamento manual direto no ESTOQUE** (item 5 da demanda original, não confirmado): a entrada de estoque é o Tiny (a equipe cadastra o pronto lá) e a produção de reposição.
- **Q-23 ✅ fechada:** produção para estoque = card de reposição que o estoque gera no PCP.
- A geração automática (pg_cron, a cada 5 min) **é ligada à parte**, com o OK do dono (`supabase/manutencao/2026-09-26_ligar_reposicao_automatica.sql`) — a primeira rodada com a carga de 26/09 criaria 44 cards (121 unidades).

**Descartada:** item sem dono lançado à mão direto no ESTOQUE (não confirmado pelo dono).
