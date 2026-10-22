---
titulo: n8n — Tiny — Mapa completo da API e dos dados (v2, v3, avisos, cota, o que temos e o que fazer)
tipo: referencia
data: 2026-10-16
atualizado: 2026-10-17
origem: SESSAO-33, Etapa A (pesquisa em paralelo + inventário do banco, só leitura)
tags: [tiny, api, v2, v3, webhooks, cota, integracao, carga, conferencia, referencia, sessao-33]
---

# 🗺️ Tiny — Mapa completo da API e dos dados

> [!abstract] Para que serve
> A referência da casa para **trazer TODOS os dados do Tiny** e mantê-los em dia (pedido do dono de 16/10 — [[SESSAO-33 - Tiny Completo - Todos os Dados Atualizados por Evento]]). Para cada tipo de dado: em qual API existe e o que vem, como buscar tudo, como saber o que mudou, se o Tiny avisa sozinho, o que já temos hoje, e a recomendação. Complementa (não substitui) [[N8N - Tiny Integracoes Referencia]] e [[N8N - Tiny Modelos Mentais]].
>
> **Regra desta nota:** nada inventado. Cada linha tem fonte (lista no §9). O que não deu para confirmar daqui está marcado **"a conferir"** e entra na lista de conferência em casa (§8).

> [!warning] Como a pesquisa foi feita (16/10/2026)
> A sessão rodou na nuvem com os **sites oficiais do Tiny bloqueados pela política de rede** (tiny.com.br, api-docs.erp.olist.com, ajuda.olist.com, erp.tiny.com.br). As fontes foram:
> - **[spec]** a especificação OpenAPI **oficial** da API v3 (`swagger.json`, "Olist ERP API v3", versão 3.1, servidor `https://api.tiny.com.br/public-api/v3`), espelhada no repositório público github.com/opastorello/olist-mcp-server (commit `66a65eb`, 28/02/2026; o README diz que o arquivo vem da URL oficial `erp.tiny.com.br/public-api/v3/swagger/swagger.json`). SHA-256 `9fe956be…e1610`.
> - **[doc]** trechos das páginas oficiais devolvidos pelo buscador, **com a URL exata** (o índice do buscador pode estar mais velho que a página no ar).
> - **[ajuda]** idem, da Central de Ajuda (ajuda.olist.com).
> - **[banco]** os dados **reais** que o Tiny já mandou e estão guardados no nosso banco (o `raw` de cada cópia), lidos só por contagem e por nome de campo — nenhum dado pessoal (F-05: o formato real vale mais que o documentado).
> - **[cofre]** o que este cofre já conferiu (pesquisas de 14/08 e 27/09, a captura do aviso de estoque em 23/09, a tela de avisos confirmada pelo dono em 21/09).
> - **[3º]** código de terceiros que usa a API (SDKs, n8n, MCP), com repositório, arquivo e linha — fonte secundária: quando discorda da oficial, vale a oficial.
> Relatórios completos (scratchpad da sessão): `A1_v3_por_recurso.md` (a especificação v3 recurso por recurso, 1.058 linhas), `A2_v2_webhooks_limites.md`, `A3_v3_novidades.md`.

---

## 1. As contas, as portas e a cota

**Duas contas do Tiny** (a mesma multiempresa) — cada uma com o seu token da API v2 e a sua cota:

| Conta | O que mora lá | Token no n8n | Quem usa hoje |
|---|---|---|---|
| **Loja** | pedidos de venda, clientes, notas fiscais, contas a receber (e o depósito "Fábrica" da empresa da loja, onde ficam as peças prontas) | `TINY_TOKEN` | fluxo de vendas, a fila "subir banco de dados" (carga histórica + conferência das 3h + contas a receber), "Entregue vai ao Tiny", gravação do estoque da loja |
| **Fábrica** | catálogo (móveis, peças, insumos, kits, variações), estoque da fábrica | `TINY_FABRICA_TOKEN` | o fluxo único da fábrica (catálogo a cada 15 min + 03:15; aviso e fila do estoque; varredura 04:00) |

Fonte: [cofre] [[N8N - Tiny Fabrica Produtos para Banco]], D-76/D-77, A-60. **[banco]** os avisos de estoque chegam com dois CNPJs da mesma raiz (27.556.613): matriz `…/0001-66` (8.002 avisos) e filial `…/0002-47` (1.046) — as duas contas mandam para o mesmo endereço.

**As portas** (modelo mental 1): API v2 (token fixo), API v3 (aplicativo OAuth), avisos da conta (webhooks configurados na tela do Tiny), avisos de e-commerce (só para integração de plataforma). A v3 **não tem aviso próprio** — os avisos são os da conta, os mesmos da v2 [doc api2-webhooks-tiny; 3º A3 §3; spec: nenhuma chave `callbacks`/`webhooks`].

**A cota (o limite crítico):**

| | v2 | v3 |
|---|---|---|
| Plano da Domoby (Impulsione = antigo Evoluir) | **60 chamadas/min** por empresa; concorrência máx. ¼ (15); lotes de 20; **serviços em lote 5/min**; pesquisas de 100 por página; cabeçalho `x-limit-api`; erro 6 = limite do minuto; erro 11 = concorrência [doc api2-limites-api, api2-tabelas-processamento] | **60 leituras + 60 escritas/min por conta**, divididas por todos os aplicativos da conta; máx. 5 aplicativos; "ao ultrapassar, a chamada retorna um erro" [ajuda aplicativos-api-v3, set/2026] |
| Pacote de limite adicional | — | existe desde set/2026 (valor e como contratar: **a conferir**) [3º A3 §4, PRs do changelog do ERP] |
| v2 e v3 dividem a mesma cota? | **nenhuma fonte diz** — tratar como se dividissem (o mais seguro) | idem |
| Cabeçalhos v3 `X-RateLimit-*` / erro 429 | — | só terceiros dizem [3º A3 §5]; tratar 429 e 503 com nova tentativa e espera crescente |

> [!important] A cota é da CONTA, não da integração
> Tudo o que usa o token de uma conta divide os mesmos 60/min daquela conta: o fluxo de vendas, a conferência das 3h, a gravação do estoque, a carga nova. **A carga nunca pode passar de metade da cota** (≤ 30/min por conta) e sempre cede a vez ao que já funciona (§6).

**A v2 segue funcionando**: "continuará funcional sem data estimada para descontinuação, mas não receberá mais atualizações ou novos recursos" [doc api]. Tudo o que é novo (depósitos, logs de movimentação, orçamentos, extratos) só existe na v3.

**Mudança recente que importa:** em **17/09/2026** o campo `estoque` **saiu** da resposta de `GET /produtos/{id}` da v3 — saldo agora só por `GET /estoque/{idProduto}` [3º A3 §4, changelog do ERP]. Nós não lemos saldo pela v3 hoje (lemos pela v2 `produto.obter.estoque`) — nada quebrou aqui.

---

## 2. O que o Tiny AVISA sozinho (de verdade)

| Aviso (tela Configurações → Geral → Outras configurações → Webhooks) | Existe? | O que traz | Ligado hoje? | Fonte |
|---|---|---|---|---|
| **Notificações de vendas** — pedido de venda criado ou alterado (tipos `inclusao_pedido` / `atualizacao_pedido`) | ✅ | `versao, cnpj, tipo, dados {id, numero, data, idPedidoEcommerce, codigoSituacao, descricaoSituacao, idContato, idNotaFiscal, nomeEcommerce, formaEnvio, cliente {nome, cpfCnpj}}` — **campainha, não carteiro**: o pedido inteiro vem depois por `pedido.obter`. Exige HTTP 200; reenvia até 10× (+5 min). **Não avisa exclusão.** Marcador alterado sozinho e contato renomeado **não** disparam (P17) | ✅ conta da loja → fluxo de vendas | [doc api2-webhooks-tiny]; [cofre] P17 |
| **Lançamentos de estoque** — qualquer lançamento (entrada, saída, balanço) | ✅ (capturado ao vivo 23/09) | `{versao "1.0.1", cnpj, tipo "estoque", dados {idProduto, sku, nome, saldo}}` — **só o saldo final** (físico), sem tipo, quantidade nem depósito; o aviso de cada conta vê os depósitos **dela**. Pedido de venda **não** gera aviso (é reserva, não lançamento) | ✅ as duas contas → fluxo da fábrica | [cofre] referência §2.1, A-22, A-25, A-39; [banco] 9.048 avisos guardados, o último hoje 19:38 UTC |
| **Notas fiscais autorizadas** | ✅ (a chave existe na tela — dono, 21/09) | **formato não documentado** — capturar um aviso real antes de construir (F-05) | ❌ (sem consumidor) | [cofre] decisão 2 de 21/09 em [[N8N - Tiny Fabrica Produtos para Banco]]; a página oficial indexada só mostra o de vendas [doc] |
| **Pedidos enviados** (rastreio) | ✅ (idem) | **não documentado** | ⚠️ **ligado na loja apontando para um endereço morto** — 404 e 10 reenvios por aviso (P5) | [cofre] P5 |
| Avisos de **e-commerce** (estoque, produtos, rastreio, NF, preços, situação do pedido, cotação de frete) | ✅, mas **só para integração de plataforma** ("possuir a integração com API da Olist ativa", configurada como integração de testes até a homologação) | — | não se aplica | [doc api2-webhooks]; reenvio: estoque e situação até 15×; NF, rastreio e preço no máx. 2 tentativas |
| Aviso por aplicativo da v3 | ❌ não existe indício | — | — | [spec]; [3º A3 §3] |
| Aviso de **produto** (cadastro), de **contas**, de **notas de entrada**, de **exclusão** | ❌ | — | — | [doc]; [cofre] decisão 2 de 21/09 ("não existe webhook de produto") |

**Consequência honesta:** o Tiny avisa **na hora** só de **venda**, de **estoque** e — se ligarmos — de **nota autorizada** e **pedido enviado**. Todo o resto o Tiny **não avisa**: ou se pergunta "o que mudou desde a última vez" (onde a API tem esse filtro), ou se relê uma janela (onde não tem). §5 diz qual é qual.

---

## 3. Como saber o que mudou — o resumo que decide tudo

| Dado | "Mudou desde…" na API? | Fonte |
|---|---|---|
| Pedidos de venda | ✅ v2 `pedidos.pesquisa` **`dataAtualizacao`** (dd/mm/yyyy hh:mm:ss, horário de Brasília; na prática "atualizado desde") · ✅ v3 `GET /pedidos?dataAtualizacao=` (sem exemplo; a resposta não traz o carimbo — o corte é o horário da consulta) | [doc api2-pedidos-pesquisar]; [3º monitordemargem `tiny_client.py` L58-68, L109-128]; [spec paths./pedidos.get] |
| Contatos (clientes, fornecedores) | ✅ v2 `contatos.pesquisa` **`dataMinimaAtualizacao`** (+ `situacao=Excluido` mostra excluídos) · ✅ v3 `GET /contatos?dataAtualizacao=` | [doc api2-contatos-pesquisar]; [spec paths./contatos.get] |
| Produtos (catálogo, preço, mínimo) | ❌ v2 (só `dataCriacao`; a lista de alterados exige extensão e **se apaga ao ler**) · ✅ **v3 `GET /produtos?dataAlteracao=`** (a listagem traz `dataAlteracao`) | [doc api2-produtos-pesquisar, api2-produtos-alterados]; [spec paths./produtos.get] |
| Estoque | ❌ v2 (a lista de alterados exige extensão e se apaga ao ler) · ❌ v3 (nem listagem: 1 chamada por produto) — **o aviso de estoque é o caminho** | [doc api2-produtos-atualizacoes-estoque]; [spec paths./estoque/{idProduto}] |
| Notas fiscais | ❌ (só janela de emissão/criação + situação) | [doc api2-notas-fiscais-pesquisar]; [spec paths./notas.get] |
| Contas a pagar e a receber | ❌ (só emissão/vencimento + situação; nem data de pagamento) | [doc api2-contas-*-pesquisar]; [spec paths./contas-*.get] |
| Ordens de compra, ordens de serviço, separação, expedição, CRM | ❌ (só criação/emissão/data dos pedidos) | [spec] |
| Cadastros pequenos (vendedores, formas, categorias, listas de preço, tags, depósitos, marcas, usuários) | ❌ — são pequenos: relê-se inteiro | [doc]; [spec] |

---

## 4. Tipo de dado por tipo de dado

Legenda das colunas: **API** (onde existe) · **Buscar tudo** (como e quanto custa) · **O que mudou** · **Avisa?** · **Temos hoje** (banco e n8n, conferido em 16/10 ~20:30 UTC, só leitura) · **Recomendação**. N = nº de registros.

### 4.1 Vendas (conta da loja)

| Dado | API e campos | Buscar tudo | O que mudou | Avisa? | Temos hoje | Recomendação |
|---|---|---|---|---|---|---|
| **Pedidos de venda** | v2 `pedidos.pesquisa` (resumo com `id`) + `pedido.obter` (inteiro: itens, parcelas, marcadores, endereço, cliente, vendedor, forma de envio, `id_nota_fiscal`…) · v3 `/pedidos`, `/pedidos/{id}` (itens só no detalhe; marcadores numa chamada à parte) [doc; spec] | janelas de data de cadastro (exige ao menos um filtro) + 1 detalhe por pedido: ⌈N/100⌉ + N | ✅ `dataAtualizacao` | ✅ **na hora** (vendas) | **5.578 pedidos** (todos com `raw` e id do Tiny, desde 12/03/2025) + **8.379 itens**; aviso de vendas → n8n principal → `fn_upsert_pedido`; **conferência das 3h** (60 dias + os não terminados; marca o excluído — D-140) [banco] | **Não reler o histórico** (já está completo e conferido toda noite). Na carga: provar "bateu" **mês a mês** (contagem no Tiny × aqui) e reler só o que diferir. Manter: aviso + conferência; **em cascata, na hora**: o cliente, a nota e as contas do pedido (§5) |
| **Itens do pedido** | dentro do pedido [doc; spec] | — | com o pedido | com o pedido | 8.379 [banco] | igual |
| **Marcadores** | dentro do `pedido.obter` (v2); v3 numa chamada à parte por pedido [doc; spec] | — | ❌ (marcador sozinho não dispara aviso nem muda o pedido) | ❌ | lista no pedido, corrigida toda noite pela conferência (D-50) [cofre] | igual |
| **Clientes (contatos)** | v2 `contatos.pesquisa` + `contato.obter` (≈ 50 campos: endereços de entrega e cobrança, documentos, vendedor, lista de preço, tipos de contato, pessoas de contato, data de criação/atualização…) · v3 `/contatos` [doc; spec; banco: 52 chaves no `raw`] | `contatos.pesquisa` (pesquisa obrigatória — testar vazio) + 1 detalhe por contato | ✅ `dataMinimaAtualizacao` | ❌ (só junto com uma venda: `idContato` vem no aviso) | **10.809 clientes** (10.569 com o cadastro inteiro do Tiny, lido na carga até **08/09**; 10.682 com o id do Tiny); depois disso só os dados que vêm dentro do pedido (nome, CPF, telefone, endereço) [banco] | Carga: **só os alterados desde 08/09** (filtro de atualização) + os **240** que nasceram só do pedido e nunca tiveram o cadastro lido. Manter: **na hora** quando o cliente compra — pela busca do **CPF/CNPJ que vem no pedido** (2 chamadas; o pedido da v2 não traz o id do contato — A-43 — e o nosso registro do aviso de venda guarda só número e situação, sem o corpo [banco: `eventos.payload` vazio nos 3.187 avisos de venda]); **toda noite**, os alterados no dia |
| **Notas fiscais (saída)** | v2 `notas.fiscais.pesquisa` (tipo E/S, emissão, situação…) + `nota.fiscal.obter` (itens, parcelas, transportador, marcadores, `id_venda`…) · v3 `/notas` (já traz `origem {id, tipo: venda/pedido_compra/…}`) + `/notas/{id}`; XML e link à parte [doc; spec; banco: 57 chaves] | janelas de emissão + 1 detalhe por nota | ❌ | ✅ se ligarmos "notas autorizadas" | **2.913 notas — a última cópia é de 08/09** (carga histórica; desde então **nada**); **2.881 pedidos** apontam a sua nota e **150** apontam uma nota que **não temos** [banco] | Carga: **as notas desde 08/09** (~300). Manter: **na hora** pelo pedido (o pedido traz o id da nota) e pelo aviso de nota autorizada (ligar em casa); **toda noite**, a janela dos últimos 60 dias (pega cancelamento) |
| **Contas a receber** | v2 `contas.receber.pesquisa` (emissão, vencimento, situação aberto/pago/cancelada/parcial, `id_origem` = nota ou pedido) + `conta.receber.obter` (categoria, competência, forma, liquidação…) · v3 `/contas-receber` (+ `/recebimentos`) [doc; spec; banco: 17 chaves] | janelas de emissão + 1 detalhe | ❌ | ❌ | **6.433 contas** (6.398 pagas, 23 abertas, 11 canceladas, 1 parcial), **em dia**: a conferência das 3h traz as emitidas em 60 dias e relê as abertas (D-122) [banco] | Manter; **na hora** quando o pedido fatura: a busca aceita `id_origem` (a nota ou o pedido de origem) — o detalhe da conta **não** traz a origem [banco: 17 chaves, nenhuma de origem], então a cascata busca pelo id da nota do pedido |
| **Vendedores** | v2 `vendedores.pesquisa` (pesquisa obrigatória) · v3 `/vendedores` [doc; spec] | 1–2 páginas | ❌ | ❌ | só o **nome** dentro do pedido [banco] | Guardar a lista (cadastro pequeno), relida toda noite |
| **Orçamentos / propostas comerciais** | só **v3** (seção "Orçamentos": listar, obter, situação, marcadores, gerar venda) — caminhos **a conferir** (entrou depois de fev/2026) [doc menu; 3º A3 §1] | — | a conferir | ❌ | nada | Só se o dono quiser (precisa ampliar a permissão do aplicativo da loja e entrar de novo) |

### 4.2 Catálogo e estoque (conta da fábrica)

| Dado | API e campos | Buscar tudo | O que mudou | Avisa? | Temos hoje | Recomendação |
|---|---|---|---|---|---|---|
| **Produtos** (móveis, peças, insumos, kits, variações) | v2 `produtos.pesquisa` + `produto.obter` (≈ 55 campos: preço, promocional, custo, custo médio, NCM, GTIN, unidade, mínimo/máximo, fornecedor, categoria, marca, anexos/foto, dimensões, `variacoes`, `kit`…) · v3 `/produtos` + `/produtos/{id}` (+ `producao`, `fornecedores`, `seo`…; **sem** datas no detalhe) [doc; spec; banco: 55 chaves] | ⌈N/100⌉ + N | ❌ v2 · ✅ **v3 `dataAlteracao`** | ❌ (o cadastro novo com saldo gera um aviso de estoque — "Balanço · Produto incluído") | **553 produtos** (todas as classes: 186 fabricados · 202 matéria-prima · 130 simples · 34 kits · 1 com variação), cada um com o tipo da plataforma (móvel 201 · insumo 242 · peça 63 ativos — D-138); o fluxo da fábrica **pergunta ao Tiny a cada 15 min** (produtos criados nas últimas 3 h) e relê o catálogo inteiro às 03:15 [banco; cofre] | Com a API nova: **o que mudou** em vez de perguntar a cada 15 min (§5); o produto novo **na hora** pelo aviso de estoque; a varredura da madrugada fica como rede de segurança |
| **Preços** | no produto (preço, promocional, custo, custo médio) [banco] · listas de preço: v2 `listas.precos.pesquisa` + `listas.precos.excecoes` · v3 `/listas-precos` [doc; spec] | listas: poucas páginas + exceções | junto com o produto (v3) | ❌ | preços no `raw` do produto; listas: nada | Guardar as listas e exceções (relidas toda noite) |
| **Estrutura dos móveis** (móvel → peças → insumos, com quantidade) | v2 `produto.obter.estrutura` (`estrutura[] {id_componente, codigo, nome, quantidade}` — **sem etapas**) · v3 `producao {produtos[] {produto, quantidade}, etapas[] (só o NOME de cada etapa)}` no detalhe e em `/fabricado` [doc api2-produtos-estrutura; spec] | 1 chamada por fabricado (186) | ❌ (relê-se) | ❌ | **nada** (o `produto.obter` não traz) [banco] | **Carga já** pela v2 (186 chamadas); as **etapas** pela v3 quando o aplicativo da fábrica existir. ⚠️ **O Tiny não liga componente a etapa** (só lista nomes de etapa) — amarrar insumo → etapa/setor é coisa da plataforma (pergunta ao dono) |
| **Kits** | `kit[]` dentro do produto [banco: 31 com itens] · v3 `/kit` [spec] | — | com o produto | ❌ | ✅ no `raw` | igual |
| **Variações** | `variacoes[]` no produto pai [banco] · v3 idem [spec] | — | com o produto | ❌ | ✅ (pais + filhos) | igual |
| **Estoque por depósito** (saldo, reservado, por empresa) | v2 `produto.obter.estoque` (`saldo`, `saldoReservado` — só com a extensão Reserva de Estoques —, `depositos[] {nome, saldo, empresa, desconsiderar}`) · v3 `/estoque/{id}` (+ `disponivel`, id do depósito) [doc api2-produtos-estoque; spec] | 1 chamada por produto (553) | ❌ (não há listagem nem filtro) | ✅ **na hora** (aviso de estoque, nas duas contas) | móveis: a fila do estoque com o Tiny (D-76…D-80) + varredura 04:00; insumos e peças: o último aviso de cada produto; 9.048 avisos guardados [banco; cofre] | Carga: uma **foto completa** de todos os produtos por depósito; manter pelo aviso (na hora) + a varredura da madrugada |
| **Movimentações de estoque** (quem, quanto, por quê) | só **v3**: "Listar logs de movimentação de estoque (autoria e origem)" — **existe no índice oficial; caminho e filtros a conferir** (entrou depois de jun/2026); a v2 não tem [doc menu; 3º A3 §1; doc api2-produtos-atualizar-estoque] | a conferir | por data (a conferir) | ❌ | nada (o aviso só manda o saldo final) | Com o aplicativo da fábrica: trazer **por data**, toda noite (atraso de até 1 dia) |
| **Depósitos** | só **v3** `GET /depositos`, `/depositos/{id}` (desde a 3.1.2, mar/2026) [doc changelog 3.1.2; 3º diegobentes/olist_erp] | 1 página | ❌ | ❌ | só os nomes dentro das leituras de estoque | Guardar (cadastro pequeno) |
| **Categorias de produto** | v2 `produtos.categorias.arvore` · v3 `/categorias/todas` [doc; spec] | 1 chamada | ❌ | ❌ | o caminho da categoria no produto | Guardar |
| **Marcas, tags, grupos de tags** | v3 `/marcas`; v2/v3 tags e grupos [doc; spec] | poucas páginas | ❌ | ❌ | marca no produto | Guardar |
| **Peças cortadas** (matéria-prima por peça) | são produtos (classe M, unidade pç) [banco: 63 "peça"] | — | — | — | ✅ como "peça" (D-138) | igual; entram no estoque como peça/insumo (D-142) |
| **Unidades** | campo livre no produto [banco] | — | — | — | **valores reais (ativos):** UN 346 · Pç 62 · Caixa 19 · M 16 · (vazio) 12 · Unidad 12 · Und 6 · L 3 · minuto 3 · Rolo 3 · un 3 · PARES 3 · kg 3 · caixa 2 · METROS 2 · "Caixa " 1 · LITRO 1 · metro 1 · M2 1 · pç 1 · Min 1 · PC 1 · Quilog 1 · Mt 1 · Cento 1 · "1" 1 [banco] | A **lista em Configurações** (D-142): as que fogem da grafia padrão e as vazias — a plataforma não converte |

### 4.3 Compras, finanças e o resto (as duas contas)

| Dado | API e campos | Buscar tudo | O que mudou | Avisa? | Temos hoje | Recomendação |
|---|---|---|---|---|---|---|
| **Contas a pagar** | v2 `contas.pagar.pesquisa` (emissão, vencimento, situação aberto/pago/cancelada/parcial) + `conta.pagar.obter` · v3 `/contas-pagar` (+ `idContato`, categoria, forma de pagamento, `/recebimentos` = pagamentos) [doc api2-contas-pagar-pesquisar; spec] | janelas de emissão + 1 detalhe | ❌ | ❌ | **nada** | Carga completa (desde jan/2025, nas duas contas); manter **toda noite**: as emitidas em 60 dias + as que não fecharam (como as a receber) |
| **Notas fiscais de entrada** (compras) e de saída da fábrica | igual às notas (tipo **E**/S) [doc; spec] | janelas + detalhe | ❌ | ✅ se ligar "autorizadas" (só saída) | **nada** da fábrica | Carga completa; manter toda noite (janela de 60 dias) |
| **Pedidos de compra** (ordens de compra) | só **v3** `/ordem-compra` (+ itens e parcelas no detalhe; situação 0 em aberto · 1 atendido · 2 cancelado · 3 em andamento; filtros: criação, fornecedor, situação) [spec; doc v2 sem serviço de OC] | ⌈N/100⌉ + N | ❌ | ❌ | **nada** | Com o aplicativo da fábrica: carga + toda noite (janela + as em aberto) |
| **Ordens de produção** | ❌ **não há como listar nem obter** (v2 e v3 só **geram** a partir de um pedido; a geração nem devolve o id) [doc api2-pedidos-gerar-ordem-producao; spec; 3º A3 §6] | — | — | — | nada | **Não dá** — fica na tela do Tiny (dito ao dono) |
| **Categorias financeiras** (receita/despesa) | só **v3** `/categorias-receita-despesa`; na v2 a categoria vem só como nome dentro de cada conta [doc api2-contas-pagar-incluir; spec] | poucas páginas | ❌ | ❌ | o nome dentro das contas a receber | Com o aplicativo da fábrica |
| **Formas de pagamento / recebimento** | v2 `formas.recebimento.pesquisa` (pagamento = tabela fixa de códigos) · v3 `/formas-pagamento`, `/formas-recebimento` [doc; spec] | 1 página | ❌ | ❌ | forma e meio no pedido e nas contas [banco] | Guardar |
| **Formas de envio / transportadoras** | v2 `formas.envio.pesquisa` · v3 `/formas-envio` (+ formas de frete); transportador = contato do tipo transportador (`/contatos/tipos`) [doc; spec] | 1–2 páginas | ❌ | ❌ | nome no pedido/nota | Guardar |
| **Fornecedores** | são **contatos** (da fábrica, sobretudo) [spec `idContato` em contas a pagar] | como contatos | ✅ como contatos | ❌ | nada da fábrica | Carga + alterados toda noite (fora da tabela de clientes da loja — não misturar com o Comercial) |
| **Separação / expedição** | v2 `separacoes/pesquisar`, `expedicao.pesquisa` (forma de envio obrigatória) · v3 `/separacao`, `/expedicao` [doc; spec] | janelas + detalhe | ❌ | ❌ | nada (a logística mora na plataforma — ROTAS) | Só se a contagem mostrar uso; guardar cru |
| **CRM** (assuntos, estágios) | v2 `crm.pesquisa` · v3 `/crm/*` [doc; spec] | janelas | ❌ | ❌ | nada | Só se a contagem mostrar uso |
| **Ordens de serviço / serviços** | v3 `/ordem-servico`, `/servicos` [spec] | — | ❌ | ❌ | serviços aparecem como produtos tipo S | Só se a contagem mostrar uso |
| **Usuários, intermediadores** | v3 `/usuarios`, `/intermediadores` [spec] | 1 página | ❌ | ❌ | nada | Guardar (com o aplicativo) |
| **Dados da empresa** | v2 `info.php` · v3 `/info` [doc; spec] | 1 | ❌ | ❌ | nada | Guardar (1 por conta) — serve também para conferir **de qual conta** é cada token |
| **Extratos bancários** | só **v3** (novo em set/2026; caminhos a conferir) [3º A3 §4] | — | — | ❌ | nada | Mais tarde, se o dono quiser |

---

## 5. O que fica "na hora" e o que fica "com atraso" — em português

| Quando | O quê | Por quê |
|---|---|---|
| **Na hora** (segundos) | **Pedido de venda** novo ou alterado · **estoque** de qualquer produto (lançamento nas duas contas) · e, em cascata a partir do pedido: **o cliente**, **a nota fiscal** e **as contas a receber** daquele pedido · (ligando os avisos em casa) **nota fiscal autorizada** e **pedido enviado** | é o que o Tiny avisa sozinho; o resto do pedido o banco pede logo em seguida |
| **Com atraso de até 1 hora** (se o dono aprovar esse ritmo no plano da Etapa B — é exceção à lei de desempenho, que proíbe relógio que acorda para ver se há trabalho) | **produtos, peças e insumos** (cadastro, preço, mínimo) · **clientes** alterados sem venda | o Tiny não avisa, mas a API diz "o que mudou desde…": **uma consulta por hora, e quando nada mudou é só essa** |
| **Com atraso de até 1 dia** (a conferência da madrugada) | **contas a pagar** · contas a receber pagas sem venda nova · notas antigas que mudaram · **estrutura dos móveis** · pedidos de compra · movimentações de estoque · cadastros pequenos (vendedores, formas, categorias, listas de preço, depósitos) | o Tiny não avisa **nem** diz o que mudou: é preciso reler uma janela — de madrugada, sem atrapalhar ninguém |
| **Não dá** | **ordens de produção** (o Tiny não deixa listar) · **exclusões** (só a conferência descobre que sumiu — como o pedido 13622, D-140) | limite do próprio Tiny |

> [!success] ↪️ 22/10/2026 — construído e no ar (D-148, migration 107)
> **A conferência dos registros** nasce da conferência da madrugada que já existia (nenhum relógio novo): a lista **completa** de cada tipo, do piso do plano até hoje — da FÁBRICA, pedidos de venda, notas, contas a receber, pedidos de compra (API nova) e o catálogo; das DUAS contas, as contas a pagar mês a mês. Cada item da lista é comparado com o resumo guardado (hash do item): só o novo, o mudado e o que tinha sumido voltam a ser lidos. **Exclusões:** o que temos e a lista completa não trouxe é perguntado um a um — "não localizado" (v2, código 32) ou 404 (API nova) marca **apagado no Tiny** (nada se apaga; visto de novo, volta); o que o Tiny tem mas a lista não mostra fica **fora da lista**. Trava: lista com menos da metade do que temos não marca nada e avisa o dono. **O produto apagado no Tiny some de todas as telas** (como o pedido apagado). Ficam de fora (anotado): os contatos que nunca compraram, os produtos da loja (D-145), as contas a receber da loja (a conferência das 3h de sempre) — [[SESSAO-33]], [[PLT - Decisoes de Produto]] D-148.

---

## 6. A carga inicial — tempo, ritmo e como provar que bateu

**Primeiro passo: a contagem (o "censo").** Antes de trazer, contar: para cada tipo de dado e cada conta, a 1ª e a última página da busca (a v2 devolve `numero_paginas`; a v3 devolve `paginacao.total`) → o total exato de cada coisa no Tiny. Custo: ~2 chamadas por tipo por conta (≈ 60 no total, 2 minutos). Com isso o tempo da carga sai **exato**, não estimado.

**Estimativa antes da contagem** (com o que o banco já mostra):

| Conta | O que entra | Chamadas (aprox.) |
|---|---|---|
| Loja | clientes alterados desde 08/09 (centenas) · notas desde 08/09 (~300) · contas a pagar desde jan/2025 (desconhecido — estimado 1–3 mil) · cadastros pequenos (~50) · prova mês a mês dos pedidos (~40) | **~2–4 mil** |
| Fábrica | estruturas (186) · foto do estoque (553) · fornecedores e contatos (centenas) · contas a pagar e a receber · notas de entrada/saída (desconhecido) · cadastros (~50) · com o aplicativo novo: pedidos de compra, categorias, depósitos, movimentações | **~2–5 mil** |

**Ritmo proposto:** no máximo **30 chamadas por minuto por conta** (metade da cota), **só de madrugada** (22h às 6h, fora da conferência das 3h e das varreduras das 3h15 e 4h da fábrica), **com prioridade sempre para o que já funciona** (venda, conferência, estoque passam na frente na mesma fila) e pausa automática da conta da fábrica enquanto a fila do estoque estiver trabalhando. A 30/min uma madrugada (≈ 6 h úteis) faz ~10 mil chamadas por conta → **a carga cabe em uma noite**, com folga.

**Erro de limite do Tiny** (código 6 na v2; erro na v3): a linha volta para a fila com espera crescente — nunca derruba a carga nem o que já funciona.

**Como provar que bateu:** por tipo e por conta, **quantos no Tiny × quantos aqui** (o censo dá o do Tiny); nos dados com dinheiro (contas, notas), **soma por mês**; nos pedidos, **contagem por mês** desde 03/2025. Diferença vira lista nomeada (o método dos hashes por faixa — A-14 — quando precisar achar quais).

**O que a carga NÃO faz:** não relê os 5.578 pedidos (já estão completos e conferidos toda noite) e não regrava o que está igual (a gravação compara antes — D-50).

---

## 7. O que já temos no n8n (e o que melhorar, não duplicar)

| Automação | O que faz hoje | O que muda na SESSAO-33 (proposta) |
|---|---|---|
| **"subir banco de dados — tiny → supabase"** (a fila genérica, conta da loja) | o banco acorda o fluxo **só quando há trabalho**; ele pega um lote da fila, monta a chamada pelo tipo da linha, chama a v2, devolve ao banco. Foi a carga histórica; hoje é a **conferência das 3h** (pedidos + contas a receber) e tem a 2ª parte "Entregue vai ao Tiny" [cofre: [[N8N - Backfill Historico do Tiny]], A-44, D-122, D-123] | **é esta que vira o trabalhador de tudo**: mais tipos de dado, **as duas contas** (o token escolhido pela linha), a API nova pela ponte segura, e um endereço para os avisos de nota autorizada e pedido enviado |
| **"Tiny FÁBRICA → produtos e estoque (fluxo único)"** | catálogo a cada 15 min + 03:15; aviso de estoque (as duas contas); fila do estoque com o Tiny (o banco acorda) [cofre D-80] | o "a cada 15 min" sai quando a API nova entrar (o "o que mudou" fica na fila, no ritmo aprovado); o resto fica igual |
| **Fluxo de vendas** ("Principal - Tiny → planilha / banco / clickup / trello") | aviso de vendas → `pedido.obter` → planilha, banco, ClickUp, Trello [cofre] | **nada** (os nós `Normalizar evento` e `Tiny · pedido.obter` não se renomeiam) — a cascata (cliente, nota, contas) nasce **no banco**, quando o pedido grava |
| Alerta de erro | **não existe** (P1) | nasce: qualquer erro de qualquer fluxo → aviso no sino do dono + linha na Auditoria |

---

> [!success] ↪️ 17/10/2026 — construído (SESSAO-33 — 📄 pronto em arquivo, liga em casa)
> - **A fila** passou a ser o trabalhador de tudo, nas duas contas, sem fluxo paralelo: `domoby-fila-tiny-completo.json` (o banco monta a chamada e entende a resposta — migrations 89/90) + a ponte `tiny-v3` para a API nova + o webhook dos avisos (notas autorizadas e pedidos enviados) no caminho `5b0fc553…` que o Tiny já chama. O programa `supabase/manutencao/2026-10-17_n8n_fila_tiny_completo.mjs` troca só a 1ª parte do fluxo de hoje e publica (a 2ª parte, a da situação do pedido, fica idêntica).
> - **O alerta de erro** nasceu: `domoby-alerta-erro-automacoes.json` (Error Trigger → sino do dono + Auditoria), ligado nos fluxos da fila, da fábrica e das vendas pelo mesmo programa (`--alerta`).
> - **O fluxo de vendas não muda.** O da fábrica também não, por enquanto: o "a cada 15 min" sai quando a API nova da fábrica ligar e a consulta de hora em hora assumir (dívida 21 da lei).
> - **A escala** foi provada antes de subir (ensaio com 100× o volume de hoje e 3 milhões de linhas da carga na fila): o caminho da fila em milissegundos, "Pausar" como interruptor, o painel lendo contas prontas. Detalhe em [[SESSAO-33]] e no handoff.

## 8. Para conferir em casa (a documentação oficial bloqueada aqui resolve)

1. **A especificação v3 de hoje:** salvar `https://erp.tiny.com.br/public-api/v3/swagger/swagger.json` e comparar com a de fev/2026 (script pronto no scratchpad da sessão — a lista vai no handoff) → caminhos de **movimentações de estoque**, **orçamentos**, **extratos**, "listar estoque dos produtos".
2. **A tela de avisos (webhooks) de cada conta:** quais chaves existem (vendas, estoque, notas autorizadas, pedidos enviados) e para onde apontam.
3. **As extensões e o plano:** "Webhooks", "API para estoque em tempo real", "Reserva de Estoques" — instaladas? (a página da v2 pede "plano Evoluir ou Potencializar" para os avisos).
4. **O limite real de cada conta:** o cabeçalho `x-limit-api` numa chamada com cada token (esperado: 60).
5. **v2 e v3 dividem a cota?** (perguntar ao suporte, se um dia a v3 pesar.)
6. **"Considerar estoque para API"** ligada na conta da fábrica (muda o saldo somado que a API devolve) e o que "desconsiderar" faz num depósito.
7. **Busca vazia:** `produtos.pesquisa`, `contatos.pesquisa` e `vendedores.pesquisa` exigem `pesquisa` — confirmar que vazio devolve tudo (o fluxo da fábrica já usa vazio em produtos com sucesso — 22/09).

## 9. Fontes

- **[spec]** `swagger.json` Olist ERP API v3 3.1 (espelho de 28/02/2026): github.com/opastorello/olist-mcp-server, commit 66a65eb — caminhos citados por `paths./…` e esquemas por `components.schemas.…` (detalhe em `A1_v3_por_recurso.md`).
- **[doc]** https://tiny.com.br/api-docs/api · api2-limites-api · api2-tabelas-processamento · api2-webhooks-tiny · api2-webhooks · api2-webhooks-atualizacao-estoque · api2-webhooks-atualizacao-situacao-pedido · api2-webhooks-envio-nota-fiscal · api2-webhooks-envio-codigo-rastreio · api2-webhooks-envio-preco-produtos · api2-produtos-pesquisar · api2-produtos-alterados · api2-produtos-atualizacoes-estoque · api2-produtos-estoque · api2-produtos-estrutura · api2-produtos-atualizar-estoque · api2-pedidos-pesquisar · api2-pedidos-gerar-ordem-producao · api2-contatos-pesquisar · api2-notas-fiscais-pesquisar · api2-contas-receber-pesquisar · api2-contas-pagar-pesquisar · api2-contas-pagar-incluir · api2-listas-precos-pesquisar · api2-listas-precos-excecoes · api2-vendedores-pesquisar · api2-formas-recebimento-pesquisar · api2-expedicao-pesquisar · api2-separacao-pesquisar · api2-crm-pesquisar · api2-info · https://api-docs.erp.olist.com/changelog/versao-3-1-1 · versao-3-1-2 · /api-reference/pedidos/listar-pedidos (menu) · /documentacao/comecando/criando-um-aplicativo.
- **[ajuda]** https://ajuda.olist.com/hubs-e-plataformas-via-api/aplicativos-api-v3-configuracoes-e-utilizacao (limites v3, 5 aplicativos, cota por conta — set/2026) · /gerenciamento-da-conta/loja-de-extensoes · /producao/ordens-de-producao.
- **[3º]** linkiez/TinyERPv2-SDK (6e02f9d) · frezendejr/monitordemargem (018dbe0) · Joaoaalves/tiny-mirror (7bce821) · mcp-dir/olist-mcp (be6723c, lista de 12/06/2026) · diegobentes/olist_erp (7105fef) · brianpventura/tiny-apps (da6c3f4) · npm `@cloudcommerce/app-tiny-erp@2.63.3`, `@linkiez/tinyerpv3-sdk@2.2.2` · PRs do changelog do ERP (olist/erp-changelog #4, #7, #14, #19, #29, #40 — via busca).
- **[banco]** consultas só de leitura no Supabase da fábrica em 16/10/2026 ~20:30 UTC (contagens, distribuição, nomes de campo do `raw`) — registradas na memória da sessão.
- **[cofre]** [[N8N - Tiny Integracoes Referencia]] · [[N8N - Tiny Modelos Mentais]] · [[N8N - API Tiny v2 vs v3]] · [[N8N - Tiny Fabrica Produtos para Banco]] · [[N8N - Backfill Historico do Tiny]] · [[N8N - Pendencias e Riscos]] · [[003 - PLANO - Integracao Completa Tiny da Fabrica]] · D-50, D-76…D-80, D-98, D-122, D-123, D-138, D-140.

> [!note] O que o plano 003 (27/09) dizia e o que vale hoje
> - "v3 `/estoque/{id}/logs-movimentacao`" → a operação **existe** no índice oficial, mas **não estava** na especificação de fev/2026; caminho e filtros **a conferir**.
> - "v3 `GET /depositos`" → ✅ desde a 3.1.2 (mar/2026).
> - "v3 `GET /produtos/{id}` traz `producao` (componentes **e etapas**)" → ✅, mas as etapas são **só nomes** e **não se ligam aos componentes**.
> - "v3 `dataAlteracao` em produtos" → ✅.
> - "v2 não lista ordens de produção" → ✅ e a v3 também não.
> - "60/min por conta, compartilhado" → ✅ (v3: 60 leituras + 60 escritas; v2: 60).
> - "Webhooks iguais aos da conta; v3 sem webhook por aplicativo" → sem indício de webhook na v3 (a frase exata não foi achada).

## Ver também

[[SESSAO-33 - Tiny Completo - Todos os Dados Atualizados por Evento]] · [[N8N - Tiny Integracoes Referencia]] · [[N8N - Tiny Modelos Mentais]] · [[003 - PLANO - Integracao Completa Tiny da Fabrica]] · [[N8N - Pendencias e Riscos]]
