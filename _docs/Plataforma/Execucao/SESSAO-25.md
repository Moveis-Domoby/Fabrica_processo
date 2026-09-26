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

## Task list (espelho da demanda + respostas do dono) — conferida contra a demanda em 26/09

- [x] 1. Saldo do Tiny derivado dos avisos (`estoque_fabrica`), com CNPJ/tipo conferidos; negativo = 0 na tela, cru no evento
- [x] 2. Carga inicial: workflow separado entregue; **o dono rodou em 26/09** (442 produtos); reserva do Tiny × derivada conferida (não bate — ver achado 10)
- [x] 3. Disponível = físico − reservas abertas dos pedidos da loja (SKU, sem personalizado, sem cancelado) — "venda debita"; negativo → necessidade extrema
- [x] 4. Reservado (pronto com pedido) × livre na plataforma, sem somar; peça com as duas etiquetas (SKU + pedido)
- [x] 5. Card de reposição no PCP gerado pelo estoque (um vivo por produto), liberação pelo PCP, unidades sem pedido até o ESTOQUE — **ligar a geração automática: com o dono** (prévia: 44 cards / 121 unidades)
- [x] 6. ESTOQUE só recebe peça 🟢 (banco + telas de mover/concluir/danificados)
- [x] 7. Tela Estoque: Produtos acabados (paginada no servidor, busca, filtros, sinal com ícone + texto) + Matéria-prima e insumos
- [x] 8. Sugestão de mínimo: top 20 dos 90 dias com rank
- [x] 9. Cards/unidades sem pedido aparecem certo em quadros, tablet, danificados, afazeres, linha do tempo
- [x] 10. Migration 36 + test:banco (2 rodadas + 27 cenários) · tsc · lint · test 56/56 · build · F-07 · checkpoint antes de aplicar (OK do dono) · advisors
- [x] 11. D-54…D-57 + Q-23/Q-63 + RF-70…76 + Esquema do Banco + notas N8N + Modelo de Sistema + memória + demandas 24/25 + ORDEM/MAPA/PRÓXIMOS PASSOS + handoff
- [ ] Critério "lançamento real no Tiny reflete em segundos": com o dono (o Tiny não tem sandbox) — roteiro no handoff

## Log

- 26/09 · branch criada; commit 0 (1763225) com o cofre do Cowork, P17 e frase do renovador restauradas antes (script em scratchpad, conferido com diff e grep de mojibake).
- 26/09 · workflow da carga do saldo escrito e validado (JSON íntegro, 7 nodes, conexões conferidas).
- 26/09 · grafias reais de personalizado no histórico: PERSONALIZADO 172 · PERSONALIZADA 19 · PERSONALIZADP/PERSONALIZADOESTANTE/PERSONALZADO/PERSONLAIZADO 1 cada → regra `person[a-z]{0,6}z` (E-42).
- 26/09 · **migration 36** (`20260926120000_plt_estoque_completo.sql`) escrita: `plt_cards.pedido_id` opcional + `produto_tiny_id` (FK `produtos`) + tipo `reposicao` (check achado pelo conteúdo) + coerência por tipo + 2 índices únicos (reposição aberta por produto; unidade da reposição por k); `plt_privado`: `fn_eh_personalizado`, `fn_situacao_reserva_estoque`, `fn_leituras_tiny`, `fn_estoque_por_produto`, `fn_recalcular_liberacao_reposicao`, `fn_gerar_reposicoes`, `fn_validar_chegada_estoque` (+ trigger BEFORE); `fn_projetar_posicao` e `fn_validar_api` recriadas POR INTEIRO a partir das versões mais novas (33 e 25); portas: `plt_fn_estoque_produtos`, `plt_fn_estoque` (assinatura nova, a antiga dropada — A-12; a chamada antiga por nome continua servindo), `plt_fn_estoque_sugestao_minimo`, `plt_fn_reposicoes_resumo`, `plt_fn_reposicao_unidades`; `plt_fn_cards_pedido_pcp` e `plt_fn_danificados` só com corpo novo (mesma forma — sem E-17). Agendamento da reposição FORA da migration: `supabase/manutencao/2026-09-26_ligar_reposicao_automatica.sql` (prévia + 1ª rodada + cron `*/5`).
- 26/09 · decisão técnica: disponível = `saldo − reservas` CRU (negativo = necessidade extrema); as portas mostram `greatest(…, 0)` (D-53). A quantidade da reposição repõe só até o mínimo (o negativo NÃO entra: aqueles pedidos já têm card no PCP).
- 26/09 · `npm run test:banco` ✅ — 27 cenários novos da S25, tudo verde nas 2 rodadas (commit bed1b8b).
- 26/09 · front (commit e3e0103): Estoque em 3 abas (componente novo `ui/Abas`), PCP com o card de reposição + modal de liberação para os dois tipos, "Reposição de estoque" no lugar de "Pedido …" onde o card não tem pedido, mover/concluir/resolver para o ESTOQUE só oferece 🟢, campo "ID de produção" fora da tela. `tsc` ✅ · `lint` ✅ · `npm test` ✅ 56/56 (+7) · `build` ✅ · mojibake 0.
- 26/09 · pré-aplicação (só leitura, produção): check de tipo = `plt_cards_tipo_check`; **0** cards violam a coerência nova (469 pedido, 29 unidade); o front no ar segue funcionando com a 36 aplicada (a chamada de `plt_fn_estoque` por nome casa com a assinatura nova; colunas antigas mantidas); nenhum cron novo. `npm run banco:aplicar` (sem confirmar) lista as 36. ⏸️ aguardando o OK do dono para aplicar.
- 26/09 · **OK do dono ("aplique, faça os testes completos")**: `npm run banco:aplicar -- --confirmar` → as 36 aplicadas, **integração com estrutura e linhas idênticas**. Advisors: segurança só +4 WARN (portas novas: `plt_fn_estoque_produtos`, `plt_fn_estoque_sugestao_minimo`, `plt_fn_reposicoes_resumo`, `plt_fn_reposicao_unidades`; `plt_fn_estoque` com assinatura nova); desempenho: nada novo além do índice recém-criado.
- 26/09 · carga do saldo (workflow do dono, 21:16–21:26 UTC): **442 avisos / 442 produtos** (`origem: carga_inicial`, saldo + saldoReservado numéricos). Nos logs, o GET dos produtos às 21:16:41 e as gravações ao fim (o n8n só grava depois de consultar todos).
- 26/09 · **ensaio A-11 no banco real** (rollback): leitura simulada do 327 (saldo 1) → tela "repor 3"; gerador 1 card (3 un.) e, de novo, 0; card no quadro do PCP; liberar 1 → `liberadas` 1; `plt_fn_mover_card` 🟡 → ESTOQUE **recusado** ("O ESTOQUE só recebe peça em perfeito estado…"); 🟢 → livres 0 → 1 e a peça na lista de livres. Gate sem usuário: 0 nas 3 portas. (Em produção só existem 3 usuários, todos admin — o gate do operador fica provado no harness; criar operador de teste gastaria número de matrícula, que não volta.)
- 26/09 · **achado 10 (carga):** fabricados com **físico negativo em 93 de 168**; reserva do Tiny = 23.390 un. × 91 dos pedidos abertos — a maior parte em **serviços da própria fábrica** (Corte 12.982, FITAMENTO 6.352, Furo…), e nos móveis reservas sem pedido aberto correspondente (327: 44 × 0). **O aviso manda o FÍSICO** (Corte/Furo/FITAMENTO: aviso 0 × milhares reservados). Decisão técnica mantida: reserva = pedidos da loja em aberto (D-55). Nos 53 produtos com mínimo, as duas contas só divergem em 4 na decisão "abaixo do mínimo". **Prévia da reposição automática: 44 cards, 121 unidades** (37 com físico negativo) → ligar fica com o dono (A-24).
- 26/09 · **telas no navegador** (Vite desta pasta já rodando na 5173, sessão do dono no painel): Estoque 234 acabados / 208 insumos; peças do produto ("Reservada · Pedido 13215 (1/1) · SKU 174"); sugestão top 20 (327 → 15 … 484 → 4, 2 semanas); lista por produto com a carga ("SKU 521 · Necessidade extrema — 14 … Tiny: −12 − 2 vendidos pela loja ainda sem sair · lido há 6 min (carga inicial)"); insumos com "No Tiny está −14 … conta como 0" (a A55 do print do dono). Screenshot do painel expirou (limitação conhecida — A-13/E-32); provas por DOM + banco (F-09).
- 26/09 · **F-07:** 375px e 768px nas 3 abas → sem rolagem lateral; "Ver as peças" e os botões do "Não produzir" estavam com 36px (tamanho `sm`) → viraram o padrão de 44px na hora.
- 26/09 · **E2E da reposição** com o produto de teste do Tiny (947854547, inativo — a maquinaria e a tela o ignoram): card 571 criado por SQL como a maquinaria cria (2 un.) → no PCP (fim da fila — ordem por chegada) → **Liberar 1** pelo modal (CNC, fila "A USINAR" como padrão) → unidade 572 sem pedido, com produto e card pai → **"Não produzir"** (dois toques) tirou o 571 do quadro → no CNC a peça "Reposição de estoque (1/2)" → **Concluir só ofereceu 🟢** → ESTOQUE, livre, com os eventos na ordem e 2 avisos de chegada aos admins → "Todas as peças no ESTOQUE" mostra "Livre · veio da reposição". Limpeza: 572 arquivada por evento (origem `api`); 571 já arquivado pela tela. Os eventos ficam na história com o usuário do dono.
- 26/09 · outras telas tocadas (Danificados, Meus afazeres, Meu Painel, MONTAGEM) abrem sem erro; interceptando o `fetch` nas abas do Estoque: 2 chamadas novas (o resto do cache) e zero falha. O único 401 do console era o meu teste de conexão sem chave.
- 26/09 · **merge na `main` a pedido do dono** ("faz o merge na main"): `main` local = `origin/main` (e060506, sem divergência) → fast-forward para a branch da sessão (mesmo padrão da S23) e push da `main`. Autor dos commits: `contatodomoby` (E-33). A worktree `ajustes-melhorias` (outra frente) segue em e060506 — sincroniza com a `main` nova quando voltar a trabalhar.
