---
titulo: "Banco — Integracao Tiny - Pedidos Clientes e Produtos"
tipo: esquema-dominio
dominio: integracao-tiny
atualizado: 2026-11-18
tags: [supabase, banco-de-dados, esquema, dominio/integracao-tiny]
---

# 🧬 Banco - Integracao Tiny - Pedidos Clientes e Produtos

> Parte do esquema do banco, movida de [[SUPA - Esquema do Banco]] em 18/11/2026 sem reescrever (os blocos estão na ordem em que foram escritos — do mais antigo ao mais novo). **Os nomes de tabela, coluna e função saem daqui, nunca de memória.** Mudou o banco → o bloco novo entra no fim da nota do domínio.

## Tabela `clientes`

Identidade do cliente: `cpf_cnpj` quando existe (índice único parcial); fallback nome+fone (resolvido dentro da função de upsert).

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | bigint identity **PK** | |
| `cpf_cnpj` | text | único quando não vazio (`clientes_cpf_cnpj_uq`, índice parcial) |
| `nome` | text not null default '' | |
| `fone` | text | indexado (`clientes_fone_idx`) |
| `email` | text | |
| `endereco` / `numero` / `complemento` / `bairro` / `cidade` / `uf` / `cep` / `rg` | text | `numero` e `cep` são TEXTO de propósito (preserva "S/N", máscara de CEP) |
| `tiny_id_contato` | bigint | `dados.idContato` do webhook, quando capturado |
| `criado_em` / `atualizado_em` | timestamptz default now() | |

## Tabela `pedidos`

Chave natural: **`numero`** (unique). `tiny_id` = id interno do Tiny — único quando presente (`pedidos_tiny_id_uq`), **NULL nos pedidos do backfill** (a planilha nunca guardou).

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | bigint identity **PK** | |
| `tiny_id` | bigint | id interno do Tiny — o que a API `pedido.alterar.situacao` exige |
| `numero` | integer **unique not null** | número visível (13093…) |
| `cliente_id` | bigint FK → `clientes.id` | |
| `situacao` | text | código v2: `aberto`, `aprovado`, `preparando_envio`, `faturado`, `pronto_envio`, `enviado`, `entregue`, `nao_entregue`, `cancelado` — indexado |
| `data_pedido` / `data_prevista` | date | convertidas de dd/mm/yyyy na função |
| `total_produtos` | numeric(12,2) | = "VALOR TOTAL" da planilha (bruto) |
| `total_pedido` | numeric(12,2) | = "TOTAL"/"TOTAL 2" (líquido) |
| `valor_frete` | numeric(12,2) | |
| `forma_pagamento` / `meio_pagamento` / `forma_envio` | text | |
| `qtd_parcelas` | integer | |
| `parcelas` | jsonb | array cru da API |
| `marcadores` | text[] | descrições extraídas |
| `obs` / `obs_interna` | text | |
| `endereco_entrega` | jsonb | quase sempre vazio (sem fallback — igual ao Plugga) |
| `codigo_rastreamento` / `url_rastreamento` | text | |
| `vendedor` / `ecommerce` | text | `nome_vendedor` / `nome_ecommerce` da API |
| `raw` | jsonb | **o `retorno.pedido` INTEIRO da API** — nada se perde |
| `origem` | text default 'webhook' | `webhook` | `backfill` | `pente_fino` (🆕 01/10 — pedido que só a conferência diária achou; entra no PCP se vivo — [[D-096 - O pedido vivo que so a conferencia achou entra no PCP\|D-96]]). Nunca muda depois de nascer |
| `criado_em` / `atualizado_em` | timestamptz | |

Índices: `pedidos_situacao_idx`, `pedidos_data_idx` (data_pedido), `pedidos_cliente_idx`.

## Tabela `pedido_itens`

Uma linha por item. **PK composta (`pedido_id`, `seq`)** · FK `pedido_id` → `pedidos.id` **on delete cascade**.

| Coluna | Tipo | Observação |
|---|---|---|
| `pedido_id` | bigint | |
| `seq` | integer | ordem do item no pedido (1, 2, 3…) |
| `id_produto` | bigint | id do produto no Tiny |
| `codigo` | text | **SKU em texto — "061" fica "061"**, indexado (`pedido_itens_codigo_idx`) |
| `descricao` / `unidade` | text | |
| `quantidade` | numeric(10,2) | |
| `valor_unitario` | numeric(12,2) | |

Na atualização de um pedido, os itens são **apagados e regravados** (o payload da API sempre traz todos).

## Tabela `gp_pcp_processados` — ✅ aplicada (conferida no banco em 26/08/2026, 1 linha)

Controle do **polling da GreenPallets** (conta Tiny parceira, plano Crescer, sem webhook). O workflow agendado tenta inserir cada pedido aqui ANTES de criar os cards ("claim-first" com `Prefer: resolution=ignore-duplicates`): inseriu → pedido novo, cria cards; resposta vazia → já processado, ignora. **Para reprocessar um pedido de propósito: apagar a linha dele.**

| Coluna | Tipo | Observação |
|---|---|---|
| `tiny_id` | bigint **PK** | id interno do pedido na conta GreenPallets |
| `numero` | integer not null | número visível na conta GP |
| `processado_em` | timestamptz default now() | |

RLS ligado, sem policies (padrão da casa). ✏️ **Quando o dono rodar o §7 do `.sql`, trocar este aviso por "aplicado em AAAA-MM-DD".**

## Tabela `eventos`

Log permanente de cada chamada de upsert (o n8n poda execuções em 7 dias; isto fica).

| Coluna | Tipo |
|---|---|
| `id` | bigint identity PK |
| `tipo` | text (`inclusao_pedido` / `atualizacao_pedido` / `backfill` / `produto_fabrica` / `estoque_fabrica`) |
| `tiny_id` / `numero` | bigint / integer |
| `situacao` | text |
| `recebido_em` | timestamptz default now() |
| `payload` | jsonb — 🆕 21/09/2026 (migration 23): corpo cru quando o formato não é documentado. Nulo nos eventos de pedido |

🆕 01/10/2026 (SESSAO-29, migration 49): tipo **`pente_fino`** — UMA linha por rodada da conferência diária com o Tiny, com o resumo em `payload` (`rodada`, `estado` concluida/interrompida, `motivo`, `inicio`, `fim`, `janela_dias`, `paginas_busca`, `relidos`, `mudaram`, `novos`, `nao_encontrados`, `falhas`, `pendentes`, `pedidos` [{numero, campos}]); `numero`/`tiny_id` nulos. A releitura de cada pedido NÃO escreve linha aqui (só o aviso de venda escreve, como sempre).

Tipos novos desde 21/09: **`produto_fabrica`** (cada produto novo/alterado do Tiny da fábrica, gravado por `fn_upsert_produto`) · **`estoque_fabrica`** (webhook "lançamentos de estoque" do Tiny da fábrica, corpo inteiro em `payload`).

## Tabela `produtos` — ✅ aplicada em 2026-09-21 (migration 23)

Catálogo de produtos da Domoby, espelho do **Tiny da FÁBRICA** (FábricaDomoby, CNPJ 27.556.613/0001-66) — **todas as classes**. Escrita só pelo n8n (`domoby-tiny-fabrica-produtos.json`) via `fn_upsert_produto`. RLS ligado sem policy (só service_role). Detalhe: [[N8N - Tiny Fabrica Produtos para Banco]].

| Coluna | Tipo | Observação |
|---|---|---|
| `tiny_id` | bigint **PK** | id interno do produto no Tiny da fábrica |
| `codigo` | text | SKU — **nulo/repetido permitido** (15 fabricados sem SKU; loja reusa SKU em personalizado). Indexado (`produtos_codigo_idx`) |
| `descricao` | text not null default '' | `nome` no Tiny |
| `classe` | text | `classe_produto`: **F** fabricado · **M** matéria-prima · **S** simples · **K** kit · **V** com variação |
| `tipo_variacao` | text | N normal · P pai · V filho |
| `id_produto_pai` | bigint | quando `tipo_variacao = 'V'` |
| `unidade` | text | **já normalizada** na função: un, pc, m, m2, cx, kg, l, par, rolo, chapa, min |
| `estoque_minimo` / `estoque_maximo` | numeric(14,4) | vêm do cadastro do Tiny (48 fabricados com mínimo em 21/09) |
| `situacao` | text | A ativo · I inativo |
| `raw` | jsonb | o `retorno.produto` INTEIRO do `produto.obter` (preço, NCM, GTIN, variações, kit…) |
| `criado_em` / `atualizado_em` | timestamptz | `atualizado_em` só muda quando o `raw` muda |
| `minimo_plataforma` | numeric(14,4) | 🆕 28/09/2026 (migration 40 da plataforma, [[D-072 - Minimo e capacidade do galpao na plataforma a sugestao\|D-72]]): o mínimo definido NA PLATAFORMA (aba Configurações do Estoque); **nulo = vale `estoque_minimo`** (o do Tiny). Check `produtos_minimo_plataforma_ck` (≥ 0). Escrito só por `plt_fn_estoque_definir_minimo`/`plt_fn_estoque_aplicar_sugestoes` — o `fn_upsert_produto` grava só a lista explícita dele e nunca toca |
| `imagem_caminho` | text | 🆕 28/09/2026 (migration 40, [[D-073 - Foto de cada produto no estoque so a logistica e o admin\|D-73]]): a foto (capa) do produto no bucket `plt-imagens`, pasta `produtos/{sku}/…` (a biblioteca do tablet — [[D-028 - Card do operador dados do produto espaco de imagens som\|D-28]]; sem SKU: `produtos/tiny-{tiny_id}/…`). Escrito só por `plt_fn_estoque_definir_imagem` (logística/admin). **30/09/2026 ([[D-081 - As fotos dos produtos vem do Tiny e aparecem inteiras sem\|D-81]]):** preenchido em 144 produtos com a foto do Tiny — o link vem em `raw->'anexos'[].anexo` (S3 público do Tiny); `raw->'imagens_externas'` vem vazio em todos |
| `imagem_tiny` | text | 🆕 30/09/2026 (migration 44, [[D-082 - A foto do Tiny chega sozinha a plataforma a da camera fica\|D-82]]): o link do Tiny (1º anexo) da foto copiada em `imagem_caminho`. **Nulo = foto posta pela câmera (ou sem foto) — o Tiny nunca a troca.** Escrito só por `plt_fn_foto_tiny_definir` (a cópia automática) e zerado por `plt_fn_estoque_definir_imagem` (a câmera). As 144 da carga de 30/09 nasceram marcadas |
| `minimo_travado` | boolean not null default false | 🆕 30/09/2026 (migration 45, [[D-084 - Sugestao por dias uteis de VENDA loja seg sab e minimo\|D-84]]): **true = mínimo editado à mão** (não acompanha a sugestão até `plt_fn_estoque_minimo_automatico`). false = automático: `plt_privado.fn_recalcular_minimos` (cron diário `plt-estoque-minimos` + trocas de Top X/cobertura/corte) grava a sugestão em `minimo_plataforma` para quem está no Top X. ⚠️ Desde a 45, `minimo_plataforma` é o ÚNICO mínimo dos acabados e só vale DENTRO do Top X (`estoque_minimo` do Tiny virou referência — [[D-083 - O Top X manda no estoque e o tamanho da pagina e so ele tem\|D-83]]); nos insumos o coalesce continua |
| `tipo_estoque` | text | 🆕 16/10/2026 (migration 85 da plataforma, [[D-138 - SESSAO-32 o OK dos indices e os insumos separados dos moveis\|D-138]]): o tipo no estoque **definido à mão** pelo admin (`movel` · `insumo` · `peca`; check `produtos_tipo_estoque_ck`); **nulo = automático**. Escrito só por `plt_fn_produto_definir_tipo` (Configurações → Móveis, insumos e peças) — o `fn_upsert_produto` nunca toca |
| `tipo_estoque_efetivo` | text **gerada e guardada** | 🆕 16/10/2026 (migration 85): `coalesce(tipo_estoque, plt_privado.fn_tipo_estoque_automatico(classe, unidade, raw))` — refeita sozinha a cada gravação do n8n. Automático: F/V = móvel; S = móvel só com NCM do capítulo 94 (`raw->>'ncm'`), senão insumo; M com unidade `pc` (peças cortadas) = peça; o resto = insumo. **Todas as contas de móvel do estoque leem esta coluna** (não mais `classe in ('F','S','V')`). ⚠️ Mudar a regra = recriar a função E `update public.produtos set tipo_estoque = tipo_estoque` |

## Função `fn_upsert_produto(p jsonb) → bigint` — ✅ aplicada em 2026-09-21

`POST {URL}/rest/v1/rpc/fn_upsert_produto` com body `{"p": <retorno.produto cru>}`. SECURITY DEFINER, `search_path=public`, execute só para `service_role`. Idempotente; **só grava quando o `raw` mudou** e, quando grava, registra 1 linha em `eventos` (`tipo = 'produto_fabrica'`, `tiny_id` = id do produto, `situacao`).

## Função `fn_upsert_pedido(p jsonb, p_tipo text, p_tiny_id bigint, p_origem text) → bigint`

A **única porta de escrita** do banco. `security definer`, execute **revogado** de anon/authenticated — só a service_role chama.

O que faz, em uma transação: resolve/atualiza o cliente (por `cpf_cnpj`, fallback nome+fone, senão cria) → upsert do pedido por `numero` (**`coalesce`: campo novo vazio NÃO apaga valor existente** — por isso webhook e backfill convivem em qualquer ordem) → apaga e regrava os itens → insere no log `eventos` → devolve o `id` do pedido.

Chamada: `POST {URL}/rest/v1/rpc/fn_upsert_pedido` com body `{"p": <retorno.pedido cru>, "p_tipo": "...", "p_tiny_id": 123, "p_origem": "webhook"}`.

> [!important] ↪️ 01/10/2026 — SESSAO-29 (migration 49 da plataforma): a função mudou
> **Assinatura nova:** `fn_upsert_pedido(p jsonb, p_tipo text, p_tiny_id bigint, p_origem text, p_tiny_id_contato bigint default null)` — a de 4 parâmetros foi DROPADA ([[Memoria - Banco e SQL 2#A-12|A-12]]); o n8n chama por nome e cai na nova. `p_tiny_id_contato` = `dados.idContato` do aviso de venda (o `pedido.obter` NÃO traz o id do contato — [[Memoria - Tiny n8n e Integracoes 1#A-43|A-43]]).
> - **Cliente** ([[D-098 - O cliente e achado pelo cadastro do Tiny o fluxo de vendas|D-98]]): id do contato → CPF/CNPJ → o cliente que o pedido JÁ tem (sem CPF dos dois lados e sem id que contradiga) → nome+fone → cria. Preenche `tiny_id_contato` quando vazio; nunca copia um CPF que já é de outro cliente; **nome sem entidade HTML** (`plt_privado.fn_texto_sem_entidades` — [[D-097 - O nome do cliente e gravado sem o codigo no lugar do apostrofo|D-97]]). Só regrava o cliente quando algum dado dele muda.
> - **Pedido** ([[D-050 - Integracao Tiny banco edicao no Tiny edita aqui apagar|D-50]]): `coalesce` de sempre ("edição edita, apagar não apaga") — EXCETO `obs`/`obs_interna`, que seguem o Tiny quando a chave vem (vazio = limpa; chave ausente = mantém). `marcadores` e `qtd_parcelas` seguem o Tiny como antes.
> - **Grava só o que mudou:** pedido existente só é regravado quando muda uma coluna, o cliente ou o `raw`; os itens só quando é pedido novo ou os itens mudaram. O que mudou fica em `current_setting('domoby.pedido_mudancas')` (local à transação: `["situacao","obs",…]`, `["novo"]`, `["cliente"]`, `["outros"]` = só o raw).
> - **Log:** o aviso (`inclusao_pedido`/`atualizacao_pedido`/`backfill`) continua gravando 1 linha em `eventos` por chamada; a conferência (`p_tipo = 'pente_fino'`) não grava por pedido — o resumo da rodada é uma linha só.

## ⭐ Migration 22 — Backfill histórico do Tiny (28/08/2026)

Arquivo executável: `22_backfill_tiny.sql` (nesta pasta).
Detalhe completo: [[N8N - Backfill Historico do Tiny]].

### ⚠️ Os gatilhos sobre `pedidos` mudaram (D-43)

O gatilho único `plt_pedidos_reagir` **não existe mais**. Agora são dois:

| Gatilho | Quando | Guarda |
|---|---|---|
| `plt_pedidos_reagir_insercao` | AFTER INSERT | `WHEN origem = 'webhook' AND situacao NOT IN ('entregue','nao_entregue','cancelado')` |
| `plt_pedidos_reagir_atualizacao` | AFTER UPDATE | sem guarda (UPDATE nunca cria card) |

Ambos executam `plt_privado.fn_reagir_pedido()`, **cujo corpo NÃO foi alterado**
— ele pertence às migrations 18/21 do repo. São dois porque `tg_op` não pode ser
usado dentro de um `WHEN`.

🚨 **Claude Code:** a migration 22 do repo tem que espelhar esses dois gatilhos.
Se alguma migration futura recriar `plt_pedidos_reagir` do jeito antigo, a
blindagem some em silêncio e o próximo backfill enche o PCP.

> ↪️ **01/09/2026 (SESSAO-14):** aconteceu exatamente isso — a reaplicação da
> S13 tinha ressuscitado o gatilho antigo e ~163 cards históricos entraram no
> PCP ([[Memoria - Migrations Aplicador e Ensaio 1#E-24|E-24]]). O espelho agora existe: **migration 24 do repo**
> (`20260901121000_plt_gatilhos_pedidos_espelho.sql`), aplicada em 01/09 —
> reaplicar o repo inteiro passou a terminar com os 2 gatilhos certos.
> A limpeza dos 163 cards aguarda decisão do dono.

### Tabela `tiny_fila`

Uma linha = uma chamada a fazer na API v2 do Tiny. Auto-expansível: um item
`*_pesquisa` enfileira os detalhes que achou **e** a página seguinte.

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | bigint identity **PK** | |
| `recurso` | text | `pedidos_pesquisa` · `pedido` · `contatos_pesquisa` · `contato` · `nf_pesquisa` · `nota_fiscal` · `cr_pesquisa` · `conta_receber` (check) |
| `chave` | text | id interno do Tiny, ou rótulo da janela (`2025-03:p2`) |
| `referencia` | text | nº do pedido/NF/nome — só leitura humana |
| `params` | jsonb default '{}' | `{dataInicial, dataFinal, pagina, janela}` |
| `prioridade` | smallint default 5 | 1→8, define a ordem de trabalho |
| `status` | text | `pendente` · `processando` · `ok` · `erro` · `vazio` (check) |
| `tentativas` | smallint | encerra em `erro` na 4ª |
| `erro` | text | |
| `criado_em` / `reservado_em` / `processado_em` | timestamptz | |

Único em `(recurso, chave)` — reenfileirar o mesmo id nunca duplica.

> ↪️ **01/10/2026 (SESSAO-29):** a fila voltou a trabalhar — é a **conferência diária** (pente-fino). As linhas dela têm `params.rodada`; a releitura guarda `params.mudou` (lista do que mudou) e `params.numero`; a linha da busca é `pedidos_pesquisa`/`pente-fino:p1` (+ `pente-fino:p2…`), com `params.resumo_em` quando a rodada fecha. O fluxo do n8n não tem mais relógio: **reabrir linha à mão exige `select plt_privado.fn_tiny_fila_acordar();`** depois.
Índices: `tiny_fila_trabalho_idx` (parcial, `status='pendente'`), `tiny_fila_status_idx`.

> ↪️ **17/10/2026 (SESSAO-33, migration 89 — ✅ aplicada em 17/10/2026):** a fila passa a ser de **tudo** o que vem do Tiny, nas **duas contas** e na API nova: colunas novas **`conta`** (`loja` padrão · `fabrica`) e **`nao_antes`** (espera da nova tentativa / do limite do Tiny); `recurso` com **29 tipos**; único **`(conta, recurso, chave)`**; status de sempre (`pendente` · `processando` · `ok` · `erro` · `vazio`); **prioridade 9 = a contagem e a carga do dono** (o "Pausar" é o interruptor `plt_tiny_controle.carga_pausada`: a fila deixa de pegar a 9, sem mexer nas linhas). `params` ganha as marcas `censo`/`carga` (a rodada do gesto), `origem` (`cascata` · `carga` · `censo` · `mudancas` · `busca`), `registros`/`numero_paginas`/`total`/`soma`, `aqui`/`aqui_em` (a contagem). Índices depois da 89: `tiny_fila_trabalho_conta_idx (conta, prioridade, id)` parcial `pendente` (substitui `tiny_fila_trabalho_idx`), `tiny_fila_status_idx`, `tiny_fila_conta_chave_uq`, `tiny_fila_erro_idx`, `tiny_fila_espera_idx`, `tiny_fila_cp_carga_idx`, `tiny_fila_censo_idx` e (migration 90) `tiny_fila_rodada_idx`. Gatilhos: `plt_tiny_fila_carga_novos`, `plt_tiny_fila_carga_mudanca`, `plt_tiny_fila_carga_apagados` (as contas prontas da carga em `plt_tiny_carga_contagem`).

> ↪️ **18/10/2026 (SESSAO-33, migration 93 — ✅ aplicada em 18/10 ~17:28 UTC):** `vazio` passa a cobrir também o que o Tiny **nunca** vai responder àquela linha — **"fora do período do plano"** (código 31: o plano da loja só filtra os últimos 2 anos) e **"sem permissão no aplicativo"** (403 da API nova) —, com o motivo em português em `erro` (começa por "fora do período do plano" ou "sem permissão no aplicativo"). As datas de `params` (`dataInicial`/`data_ini_emissao`) nascem no piso do plano da conta (`plt_privado.fn_tiny_piso`) e são acertadas de novo na reserva do lote (a data acertada fica gravada).

### Tabela `notas_fiscais`

`id` PK · `tiny_id` **unique** · `tipo_nota` · `serie` · `numero` ·
`chave_acesso` · `data_emissao` · `data_saida` · `situacao` ·
`descricao_situacao` · `valor_nota` · `valor_frete` · `valor_desconto` ·
`numero_pedido` (indexado) · `pedido_id` FK → `pedidos.id` · `cliente_id` FK →
`clientes.id` · `raw` jsonb · `criado_em` / `atualizado_em`.

### Tabela `contas_receber`

`id` PK · `tiny_id` **unique** · `numero_documento` · `numero_pedido`
(indexado) · `pedido_id` FK · `cliente_id` FK · `historico` · `categoria` ·
`data_emissao` · `data_vencimento` (indexado) · `data_liquidacao` · `valor` ·
`saldo` · `situacao` (indexado) · `forma_recebimento` · `meio_recebimento` ·
`raw` jsonb · `criado_em` / `atualizado_em`.

### Colunas novas em `clientes`

`raw` jsonb (o `retorno.contato` inteiro) · `tipo_pessoa` · `inscricao_estadual`
· `fantasia`.

### Funções novas

| Função | Faz |
|---|---|
| `fn_fila_proximos(p_limite integer)` | reserva o próximo lote (`FOR UPDATE SKIP LOCKED`); devolve para a fila o que ficou `processando` há mais de 15 min |
| `fn_backfill_aplicar(p_fila_id bigint, p_recurso text, p_payload jsonb)` | busca → enfileira o achado; detalhe → grava na tabela certa; fecha a linha da fila **na mesma transação** |
| `fn_backfill_falha(p_fila_id bigint, p_erro text, p_terminal boolean)` | devolve pra fila (até 4 tentativas) ou encerra como `vazio` |

Todas `security definer`, execute revogado de anon/authenticated, concedido só a
`service_role`. **O n8n não conhece nenhuma tabela** — chama essas três mais a
`fn_upsert_pedido`.

> [!note] `origem` decide se vira card
> No `on conflict` de `fn_upsert_pedido` a coluna `origem` **não é atualizada**.
> Pedido que nasceu `webhook` continua `webhook` para sempre, mesmo relido pelo
> backfill. É isso que faz a blindagem [[D-043 - Meu Perfil nome de login editavel pelo proprio e-mail tambem|D-43]] ser estável.

## ⚠️ Correção de 08/09/2026 — a coluna `pedidos.situacao`

Esta nota afirmava que `situacao` guarda o **código v2** (`aberto`, `entregue`,
`preparando_envio`). **Está errado.** `pedido.obter` devolve a **DESCRIÇÃO**, e
`fn_upsert_pedido` grava sem transformar. Os valores reais no banco são:

`Entregue` · `Preparando envio` · `Cancelado` · `Em aberto` ·
`Pronto para envio` · `Faturado` · `Não entregue`

Vale para as duas origens (`webhook` e `backfill`) — as duas passam pelo mesmo
`pedido.obter`. O código v2 minúsculo só existe em `codigoSituacao`, no payload
do webhook, que não é o que a função grava.

**Todo filtro por situação neste banco usa a descrição.** Quem comparar com
`'entregue'` minúsculo não acha nada.
