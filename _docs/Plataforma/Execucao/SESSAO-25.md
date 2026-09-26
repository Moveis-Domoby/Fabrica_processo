---
titulo: Execução — SESSAO-25 · Estoque da fábrica (Tiny, saldo, mínimos, reposição)
tipo: execucao
data: 2026-09-24
atualizado: 2026-09-26
tags: [execucao, sessao-25, estoque, tiny, bloco-5]
---

# 🔧 Execução — SESSAO-25

**Branch:** `sessao-25-estoque-completo` (criada a partir da `main` em e060506)
**Demanda:** [[SESSAO-25 - Integracao Tiny Fabrica - Estoque e Minimos]] · **Decisões:** D-53 (ordem) + as novas desta sessão
**Regra do working tree:** commit sempre por caminho explícito (E-23). `Claude outputs/` não é desta frente — fica fora.

## Checkpoint de início (24/09) — o que o banco mostrou (consultas SÓ de leitura)

1. **O id do produto NUNCA casa entre loja e fábrica** — cada conta do Tiny tem seus ids: 0 de 8.043 itens vendidos (`pedido_itens.id_produto` × `produtos.tiny_id`). Por SKU casam 7.086 (165 SKUs); 0 SKUs repetidos entre os ativos do catálogo. → a chave entre as contas é o **SKU** (+ filtro de personalizado).
2. **Pedido da loja NÃO gera aviso de estoque da fábrica**: 19 pedidos (27 itens de SKU da fábrica) de 23/09 02:49 a 24/09, e mais 27 pedidos até 26/09 → **zero** avisos. Em 26/09 havia 9 avisos no total, todos de lançamento feito na fábrica (produto de teste + serviços/ferramentas com saldo 0: Capa 15mm, fita de borda, FITAMENTO, Fresa, Corte, Furo 3mm). **Nenhum de móvel.**
3. `produto.obter` (o que o catálogo usa) **não traz saldo** — as chaves do `raw` não têm saldo/depósito.
4. `plt_cards.pedido_id` é NOT NULL (migration 03).
5. O painel do PCP "unidades liberadas no dia" conta todo `card_criado` de unidade.
6. Working tree do Cowork tinha 2 regressões: a P17 sumida de `N8N - Pendencias e Riscos` e a frase do renovador do token voltando ao projeto antigo em `N8N - Tiny Integracoes Referencia`.
7. ESTOQUE hoje (26/09): 6 unidades, **todas com pedido**; 1 🔴 (13215) e 1 🟡 (13203); 3 de pedidos já "Entregue" no Tiny (13196, 13203, 13257 — assunto da SESSAO-29).

## Respostas do dono (26/09/2026 — o OK da sessão)

- **Personalizado:** entra no estoque quando o pedido já produzido é cancelado (fluxo de cancelamento — SESSAO-24); a partir daí uma venda igual dá baixa nele.
- **Sugestão de mínimo:** só os **20 mais vendidos dos últimos 90 dias**, com **rank**; o mais vendido tem que ter mais estoque que o 20º.
- **Q1 (onde guardar o saldo):** gostou de não criar tabela; "se necessário criar as duas colunas, tudo bem — faça o mais profissional, otimizado e rápido".
- **Q2:** duas contas, **sem somar**.
- **Q3 (como o Tiny funciona hoje):** a equipe **cadastra no Tiny o produto pronto** (o estoque sobe); **o pedido de venda da loja já debita o Tiny da fábrica** e o **disponível multiempresa** soma −1. Para a equipe, negativo = necessidade de produção. **Na plataforma não haverá estoque negativo: negativo = "necessidade extrema de produção".**
- **Q4 (Q-63, ID):** o ID é o **SKU** (etiqueta) e a equipe **conta no papel, todo dia**, quantos tem de cada. Continua SKU + quantidade; a ideia é **eliminar o papel**. Saiu pedido → o produto ganha **dois IDs (SKU + nº do pedido), duas etiquetas**, e vira **reservado**.
- **Q5 (carga inicial):** "já rodei um flow no n8n para puxar a carga inicial — vasculhe no banco". → ver achado 8 abaixo.
- **Q6 (alerta do n8n):** "belíssima ideia, mas não agora — entregue o estoque pronto, não se preocupe com n8n".
- **Q7 (item sem dono nascendo no ESTOQUE): NÃO confirmado.** Fluxo novo, nas palavras do dono: no estoque **não fica produto danificado, nem em atenção, nem pronto com pedido definido**; pronto com pedido = **estoque reservado** (não conta positivo no estoque de fato); "sempre que um pedido for gerado, o Tiny já manda a atualização de novo estoque (**valide se é mesmo o caminho**)"; **abaixo do mínimo → o estoque gera no PCP um card de "necessidade de reposição em estoque"**, o PCP decide o rumo; produzido → vai para o estoque aguardar a venda.
- **Q8:** Estoque vira **duas telas**: produtos acabados (F, S, variações) e **matéria-prima/insumos** (M, K — peças, MDF, parafusos) — "já adiantaremos a peça" (o próximo passo é estoque de peça + necessidade de produção de peça com plano de corte).
- **Q9:** pode commitar o trabalho do Cowork (desfazendo as 2 regressões) → feito no commit 0 (1763225).

## Achados depois das respostas (26/09, só leitura)

8. **A carga que rodou foi a do CATÁLOGO, não a do SALDO.** Nos logs da API (23→26/09): só a varredura diária de produtos (`fn_upsert_produto` ~490×/dia às 06:15 UTC), os pedidos e 4 avisos de estoque. Nenhuma coluna/tabela nova, nenhuma chave de saldo no `raw`, nenhum aviso "carga". → **o saldo nunca chegou ao banco**; sem carga, móvel não terá saldo (nenhum aviso de móvel até hoje). Escrito o workflow separado `_docs/Fabrica n8n/domoby-tiny-fabrica-carga-saldo.json` (rodar 1×; grava cada saldo como aviso `estoque_fabrica` com `origem: carga_inicial`, `saldo` e `saldoReservado`).
9. **Validação pedida na Q7: o Tiny NÃO manda atualização quando sai pedido** (46 pedidos da loja desde 23/09, zero avisos). O pedido vira **reserva** no Tiny (tela "reservas" / "total reservado"), e reserva não é lançamento — o webhook só dispara em lançamento. → a plataforma calcula a reserva ela mesma, a partir dos pedidos da loja.

## Desenho (a partir das respostas)

- **Saldo do Tiny = leitura derivada** do último aviso de cada produto em `eventos` (CNPJ da fábrica + tipo estoque) — sem tabela nova, sem coluna nova, sem gatilho em tabela da integração (D-19). Se um dia pesar: 2 colunas em `produtos` (autorizado pelo dono).
- **Disponível = saldo físico lido − reservas abertas** (itens de pedidos da loja ainda não faturados: em aberto / aprovado / preparando envio; não personalizados; SKU exato do produto ativo). É a mesma conta do "disponível" do Tiny, feita com os pedidos que já chegam ao banco. Negativo → mostra 0 + "necessidade extrema (N)". Regra num lugar só (`plt_privado`) para ajustar depois do experimento (ver pendências).
- **Reservado (pronto com pedido)** = unidades com pedido no ESTOQUE. **Livre na plataforma** = unidades sem pedido (vindas da reposição). Nada se soma.
- **Card de reposição** (tipo novo `reposicao`) nasce no **PCP** pela maquinaria (`automacao`) quando disponível < mínimo — um vivo por produto; quantidade = mínimo − disponível (piso 0); depois que um ciclo termina, só gera outro quando chegar leitura nova do Tiny daquele produto. PCP libera as unidades (sem pedido) para a produção; concluída → ESTOQUE, livre. Agendamento (pg_cron) **separado da migration**, ligado só depois da carga conferida (evita enxurrada de cards no 1º minuto).
- **ESTOQUE só recebe peça 🟢** (marcação perfeito) — regra no banco para chegadas humanas.
- **Duas telas** em `/fabrica/logistica/estoque`: Produtos acabados (F/S/V) e Matéria-prima e insumos (M/K) + a Sugestão de mínimo (top 20 com rank).
- **Q-63 fecha:** ID = SKU; reservado = SKU + nº do pedido. O campo livre "ID de produção" sai da tela.
- Sem lançamento manual direto no ESTOQUE (Q7 não confirmada) — a entrada de estoque é o Tiny (cadastro do pronto) e a produção de reposição.

## Task list (espelho da demanda + respostas do dono)

- [ ] 1. Saldo do Tiny derivado dos avisos (`estoque_fabrica`), com CNPJ/tipo conferidos; negativo = 0 na tela, cru no evento
- [ ] 2. Carga inicial: workflow separado entregue (o dono roda) + validação da reserva (API `saldoReservado` × reservas derivadas)
- [ ] 3. Disponível = físico − reservas abertas dos pedidos da loja (SKU, sem personalizado, sem cancelado) — "venda debita"; negativo → necessidade extrema
- [ ] 4. Reservado (pronto com pedido) × livre na plataforma, sem somar; itens com as duas etiquetas (SKU + pedido)
- [ ] 5. Card de reposição no PCP gerado pelo estoque (um vivo por produto), liberação pelo PCP, unidades sem pedido até o ESTOQUE
- [ ] 6. ESTOQUE só recebe peça 🟢 (banco + telas de mover/concluir/danificados)
- [ ] 7. Tela Estoque: Produtos acabados (paginada no servidor, busca, filtros, sinal com ícone + texto) + Matéria-prima e insumos
- [ ] 8. Sugestão de mínimo: top 20 dos 90 dias com rank
- [ ] 9. Cards/unidades sem pedido aparecem certo em quadros, tablet, danificados, afazeres, linha do tempo
- [ ] 10. Migration 36 + test:banco (2 rodadas + cenários) · tsc · lint · test · build · F-07 · ⏸️ checkpoint antes de aplicar · advisors
- [ ] 11. Decisões novas (D-54…) + Requisitos + Esquema do Banco + notas N8N + Modelo de Sistema + memória + handoff

## Log

- 26/09 · branch criada; commit 0 (1763225) com o cofre do Cowork, P17 e frase do renovador restauradas antes (script em scratchpad, conferido com diff e grep de mojibake).
- 26/09 · workflow da carga do saldo escrito e validado (JSON íntegro, 7 nodes, conexões conferidas).
- 26/09 · grafias reais de personalizado no histórico: PERSONALIZADO 172 · PERSONALIZADA 19 · PERSONALIZADP/PERSONALIZADOESTANTE/PERSONALZADO/PERSONLAIZADO 1 cada → regra `person[a-z]{0,6}z` (E-42).
- 26/09 · **migration 36** (`20260926120000_plt_estoque_completo.sql`) escrita: `plt_cards.pedido_id` opcional + `produto_tiny_id` (FK `produtos`) + tipo `reposicao` (check achado pelo conteúdo) + coerência por tipo + 2 índices únicos (reposição aberta por produto; unidade da reposição por k); `plt_privado`: `fn_eh_personalizado`, `fn_situacao_reserva_estoque`, `fn_leituras_tiny`, `fn_estoque_por_produto`, `fn_recalcular_liberacao_reposicao`, `fn_gerar_reposicoes`, `fn_validar_chegada_estoque` (+ trigger BEFORE); `fn_projetar_posicao` e `fn_validar_api` recriadas POR INTEIRO a partir das versões mais novas (33 e 25); portas: `plt_fn_estoque_produtos`, `plt_fn_estoque` (assinatura nova, a antiga dropada — A-12; a chamada antiga por nome continua servindo), `plt_fn_estoque_sugestao_minimo`, `plt_fn_reposicoes_resumo`, `plt_fn_reposicao_unidades`; `plt_fn_cards_pedido_pcp` e `plt_fn_danificados` só com corpo novo (mesma forma — sem E-17). Agendamento da reposição FORA da migration: `supabase/manutencao/2026-09-26_ligar_reposicao_automatica.sql` (prévia + 1ª rodada + cron `*/5`).
- 26/09 · decisão técnica: disponível = `saldo − reservas` CRU (negativo = necessidade extrema); as portas mostram `greatest(…, 0)` (D-53). A quantidade da reposição repõe só até o mínimo (o negativo NÃO entra: aqueles pedidos já têm card no PCP).
- 26/09 · `npm run test:banco` ✅ — 27 cenários novos da S25, tudo verde nas 2 rodadas (commit bed1b8b).
- 26/09 · front (commit e3e0103): Estoque em 3 abas (componente novo `ui/Abas`), PCP com o card de reposição + modal de liberação para os dois tipos, "Reposição de estoque" no lugar de "Pedido …" onde o card não tem pedido, mover/concluir/resolver para o ESTOQUE só oferece 🟢, campo "ID de produção" fora da tela. `tsc` ✅ · `lint` ✅ · `npm test` ✅ 56/56 (+7) · `build` ✅ · mojibake 0.
- 26/09 · pré-aplicação (só leitura, produção): check de tipo = `plt_cards_tipo_check`; **0** cards violam a coerência nova (469 pedido, 29 unidade); o front no ar segue funcionando com a 36 aplicada (a chamada de `plt_fn_estoque` por nome casa com a assinatura nova; colunas antigas mantidas); nenhum cron novo. `npm run banco:aplicar` (sem confirmar) lista as 36. ⏸️ aguardando o OK do dono para aplicar.
