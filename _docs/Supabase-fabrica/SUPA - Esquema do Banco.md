---
titulo: Supabase Fábrica — Esquema do Banco (FONTE DA VERDADE)
tipo: esquema
atualizado: 2026-08-17
tags: [supabase, fabrica, banco-de-dados, esquema]
---

# 🧬 Supabase Fábrica — Esquema do Banco

> [!danger] REGRA DE OURO — ler antes de mexer
> Esta nota é a **fonte da verdade** do que existe no banco. Antes de escrever qualquer SQL, query, node do n8n ou código que toque este Supabase, **leia esta nota primeiro e use exatamente os nomes que estão aqui** — nada de inventar tabela, coluna ou função "que provavelmente existe".
> Toda alteração no banco segue o ciclo: rodar o SQL no editor → atualizar o arquivo `supabase-fabrica-schema.sql` → **atualizar esta nota**. Se os três não contam a mesma história, esta nota manda.

**Aplicado no projeto em: 2026-08-17** (o dono rodou `supabase-fabrica-schema.sql` completo, sem erros).
Schema Postgres: **`public`** · Todas as tabelas com **RLS ligado e ZERO policies** — anon/authenticated não enxergam nada; só a `service_role` acessa.

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
| `origem` | text default 'webhook' | `webhook` \| `backfill` |
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

## Tabela `gp_pcp_processados` — ⚠️ pendente de rodar o SQL (§7 do .sql)

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
| `tipo` | text (`inclusao_pedido` / `atualizacao_pedido` / `backfill`) |
| `tiny_id` / `numero` | bigint / integer |
| `situacao` | text |
| `recebido_em` | timestamptz default now() |

## Função `fn_upsert_pedido(p jsonb, p_tipo text, p_tiny_id bigint, p_origem text) → bigint`

A **única porta de escrita** do banco. `security definer`, execute **revogado** de anon/authenticated — só a service_role chama.

O que faz, em uma transação: resolve/atualiza o cliente (por `cpf_cnpj`, fallback nome+fone, senão cria) → upsert do pedido por `numero` (**`coalesce`: campo novo vazio NÃO apaga valor existente** — por isso webhook e backfill convivem em qualquer ordem) → apaga e regrava os itens → insere no log `eventos` → devolve o `id` do pedido.

Chamada: `POST {URL}/rest/v1/rpc/fn_upsert_pedido` com body `{"p": <retorno.pedido cru>, "p_tipo": "...", "p_tiny_id": 123, "p_origem": "webhook"}`.

## O que NÃO existe (para ninguém inventar)

Não existem: views, triggers, outros schemas, outras funções além da `fn_upsert_pedido`, policies de RLS, buckets de storage, edge functions. Não existe tabela de usuários — este projeto não tem app com login. Os pedidos da **GreenPallets NÃO entram em `pedidos`/`clientes`** — só o controle de dedup em `gp_pcp_processados` (escopo decidido em 17/08: conta GP alimenta apenas cards da PCP). Se algo disso mudar, registrar AQUI.

## Ver também

[[SUPA - Visao Geral]] · `supabase-fabrica-schema.sql` (o DDL executável, nesta pasta) · [[N8N - Migracao Supabase]]
