---
titulo: Supabase Fábrica — Esquema do Banco (FONTE DA VERDADE)
tipo: esquema
atualizado: 2026-08-26
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
| `tipo` | text (`inclusao_pedido` / `atualizacao_pedido` / `backfill`) |
| `tiny_id` / `numero` | bigint / integer |
| `situacao` | text |
| `recebido_em` | timestamptz default now() |

## Função `fn_upsert_pedido(p jsonb, p_tipo text, p_tiny_id bigint, p_origem text) → bigint`

A **única porta de escrita** do banco. `security definer`, execute **revogado** de anon/authenticated — só a service_role chama.

O que faz, em uma transação: resolve/atualiza o cliente (por `cpf_cnpj`, fallback nome+fone, senão cria) → upsert do pedido por `numero` (**`coalesce`: campo novo vazio NÃO apaga valor existente** — por isso webhook e backfill convivem em qualquer ordem) → apaga e regrava os itens → insere no log `eventos` → devolve o `id` do pedido.

Chamada: `POST {URL}/rest/v1/rpc/fn_upsert_pedido` com body `{"p": <retorno.pedido cru>, "p_tipo": "...", "p_tiny_id": 123, "p_origem": "webhook"}`.

## Tabelas da Plataforma de Produção (prefixo `plt_`) — aplicadas em 26/08/2026

> [!info] Onde está o DDL
> O SQL executável **não é duplicado aqui**: vive versionado e testado no repositório, em `supabase/migrations/*.sql` (10 migrations). O modelo explicado em português está em `docs/modelo-de-dados.md`. Duplicar criaria uma segunda fonte de verdade que envelhece sozinha (M-04). Esta seção é o **inventário**: o que existe e onde achar.

Aplicado na SESSAO-02, com as tabelas da integração conferidas antes e depois — **estrutura com impressão digital idêntica e contagens intactas** (clientes 119 · pedidos 118 · pedido_itens 191 · eventos 448 · gp 1).

| Tabela | O que guarda |
|---|---|
| `plt_usuarios` | pessoas; `auth_user_id` **opcional** (operador de tablet pode não ter login — D-06); `pin_hash` guarda HASH. **↪️ SESSAO-03 (26/08, D-21):** ganhou `cpf` (obrigatório, **SELECT revogado da API**), `usuario` (login por usuário OU e-mail), `matricula` (`MDM-XXX-NNN`, gerada por trigger `fn_gerar_matricula`), `senha_padrao` (troca obrigatória no 1º login), `convite_token` (**SELECT revogado**) e `convite_usado_em`. Escrita pelo navegador: **só `update(nome, telefone)`** — o resto passa pela Edge Function |
| `plt_usuario_setores` | vínculo pessoa ↔ setor, com `lider_do_setor` |
| `plt_setores` | setores; `papel_no_fluxo` = `entrada`/`producao`/`terminal` — índice único garante **uma só entrada** (D-13) |
| `plt_etapas` | etapas internas de cada setor. **SEM SEED** (D-14). `eh_fila` marca onde o card espera sem dono |
| `plt_cards` | cards `pedido`/`unidade` (D-01). FK para `pedidos(id)`. ⚠️ **sem FK para `pedido_itens`** — ver aviso |
| `plt_eventos` | **APPEND-ONLY** (RNF-05). A tabela-mãe: tempo, fila e qualidade derivam daqui |
| `plt_notificacoes` | avisos a líder/admin (D-09 / Q-18) |
| `plt_tarefas` | afazeres e delegação (RF-40 a RF-43) |
| `plt_visualizacoes` | painéis salvos (RF-33) |

**Visões** (derivadas de evento, nada guardado — todas com `security_invoker = on`):
`plt_vw_permanencias` (tempo por etapa; `eh_fila` separa o que é do SETOR) · `plt_vw_execucoes` (o tempo que tem dono) · `plt_vw_qualidade_transicoes` (dupla atestação da D-09 com divergência calculada).

**Schema `plt_privado`** — 8 funções, **fora da API REST de propósito**: `fn_marcar_atualizacao`, `fn_evento_imutavel`, `fn_projetar_posicao`, `fn_usuario_atual`, `fn_eh_admin`, `fn_setores_do_usuario`, `fn_eh_lider_de` e (SESSAO-03) `fn_gerar_matricula` + sequence `matricula_seq`. O Supabase publica o schema `public` inteiro como API; função criada lá vira endpoint `/rest/v1/rpc` sem ninguém pedir.

**Edge Function `autenticacao`** (SESSAO-03 — a primeira do projeto): `entrar` (usuário OU e-mail) · `criar-usuario` (admin/líder; senha padrão via segredo `PLT_SENHA_PADRAO`) · `convite-info` · `trocar-senha` (obrigatória no 1º login) · `pin-definir` · `pin-verificar` (PBKDF2). Código versionado em `supabase/functions/autenticacao/index.ts` no repo.

**21 políticas de RLS**: operador vê os setores dele, líder vê o setor completo, admin vê tudo. `plt_eventos` **não tem política de UPDATE nem de DELETE**.

> [!danger] Dois avisos que valem ouro
> **1.** `plt_cards` **não** tem foreign key para `pedido_itens`, e isso é decisão, não esquecimento: `fn_upsert_pedido` faz `delete from pedido_itens` e regrava tudo a **cada** atualização de pedido vinda do Tiny. Uma FK apontando para lá faria **toda atualização de pedido falhar em produção**. O item é guardado como snapshot. **Não "conserte" isso.**
> **2.** O append-only de `plt_eventos` é garantido por **trigger**, não por RLS — porque a `service_role` (a chave que o n8n usa) **ignora RLS**. Testado no banco real: `UPDATE` e `DELETE` recusados.

## O que NÃO existe (para ninguém inventar)

↩️ **Revisado em 26/08/2026:** com a SESSAO-02 aplicada, agora existem sim views, triggers, um schema a mais (`plt_privado`), funções e policies — **todos da plataforma, com prefixo `plt_`**, listados na seção acima. O que continua valendo: **nada disso toca as tabelas da integração**, e do lado da integração continua não havendo view, trigger, policy, bucket de storage nem edge function. A tabela de usuários agora existe (`plt_usuarios`), da plataforma. Os pedidos da **GreenPallets NÃO entram em `pedidos`/`clientes`** — só o controle de dedup em `gp_pcp_processados` (escopo decidido em 17/08: conta GP alimenta apenas cards da PCP). Se algo disso mudar, registrar AQUI.

## Ver também

[[SUPA - Visao Geral]] · `supabase-fabrica-schema.sql` (o DDL executável, nesta pasta) · [[N8N - Migracao Supabase]]
