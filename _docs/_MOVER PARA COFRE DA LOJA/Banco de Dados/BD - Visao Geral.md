---
titulo: BD — Visão Geral
tipo: banco-de-dados
atualizado: 2026-08-06
tags: [banco, schema, supabase, postgres]
---

# 🗄️ BD — Visão Geral

- **Projeto Supabase:** `hftyremdlnuzsgfozciv`
- **Schema:** `public`
- **Postgres** via Supabase, acessado do front por **PostgREST + RPC com a chave anon**

## Os três domínios

### 1️⃣ Analítico (BI de recompra)
[[BD - vendas marketing|`vendas_marketing`]] → [[BD - Views|`vw_clientes_consolidados`]] → RPCs `fn_dashboard_*` e `fn_filter_customers`.

### 2️⃣ Operacional (campanhas de disparo)
[[BD - Tabelas de Disparo|`listas_disparo`, `listas_disparo_membros`, `listas_disparo_eventos`]], `tarifas_mensagem_whatsapp`, `webhook_eventos_crm` → view `vw_scorecards_lista`.

### 3️⃣ Infraestrutura de sync
`tiny_auth`, `tiny_sync_state` e as funções `tick_*()` que disparam Edge Functions via `pg_net`. Ver [[BD - Cron e pg net]].

## Inventário de tabelas

| Tabela | Linhas ~ | Domínio | Nota |
|---|---|---|---|
| `vendas_marketing` | grande | analítico | tabela-fato; ver [[BD - vendas marketing]] |
| `listas_disparo` | dezenas | operacional | campanha |
| `listas_disparo_membros` | milhares | operacional | contato numa campanha |
| `listas_disparo_eventos` | milhares | operacional | log de auditoria |
| `tarifas_mensagem_whatsapp` | poucas | operacional | ⚠️ **nunca consultada por código** |
| `webhook_eventos_crm` | milhares | operacional | log bruto do DataCrazy |
| `tiny_auth` | **1** | infra | singleton com `CHECK (id = 1)` |
| `tiny_sync_state` | poucas | infra | ponteiro de retomada |

**Não existe tabela `clientes`.** Isso é intencional e é o ponto mais importante do schema — ver [[MM - Identidade do Cliente]].

## Tipos ENUM customizados

Todos criados no baseline `20260801024816_remote_schema.sql`.

| Tipo | Valores |
|---|---|
| `categoria_mensagem_whatsapp` | `marketing`, `utilidade` |
| `status_lista_disparo` | `rascunho`, `sincronizada`, `disparando`, `em_andamento`, `encerrada` |
| `status_membro_disparo` | `aguardando_envio`, `aguardando_resposta`, `respondido_aguardando_resultado`, `ganho`, `perdido` |
| `motivo_perda_membro` | `sem_resposta_no_prazo`, `negocio_perdido_crm`, `prazo_resultado_expirado`, `erro_envio_mensagem`, `lista_encerrada_manualmente` |
| `tipo_evento_disparo` | `lista_criada`, `leads_sincronizados`, `mensagem_definida`, `envio_registrado`, `resposta_recebida`, `negocio_ganho`, `negocio_perdido`, `timer_resposta_expirado`, `timer_resultado_expirado`, `lista_encerrada`, `erro_envio_mensagem` |

> [!bug] Quatro tipos de evento usados no código NÃO existem no enum
> `lista_renomeada`, `membros_adicionados`, `membro_removido`, `membros_removidos` — os INSERTs falham com `invalid input value for enum`. Ver [[DT - Indice de Problemas Conhecidos|DT-D1]].

## Extensions

| Extension | Schema | Nota |
|---|---|---|
| `pg_cron` | `pg_catalog` | agendamento |
| `pg_net` | `public` | HTTP de dentro do banco. Foi **dropada e recriada** no baseline para movê-la a `public` — o linter do Supabase desaconselha extension em `public` |

`gen_random_uuid()` é usado em 6 tabelas sem `CREATE EXTENSION pgcrypto` explícito — depende do build padrão do Supabase (Postgres 13+).

## Materialized views

**Nenhuma.** As `fn_dashboard_*` refazem `PARTITION BY` e `jsonb_array_elements` sobre a tabela inteira a cada carregamento do dashboard.

> [!tip] Otimização de maior retorno ainda não feita
> Uma matview de transições e outra de itens explodidos, com `REFRESH` no mesmo cron do incremental-sync, resolveria o gargalo de leitura de uma vez.

## Índices redundantes

Três pares duplicados, criados porque a migration `20260801024900` recriou com `IF NOT EXISTS` índices que já existiam sob outro nome:

- `idx_vendas_marketing_telefone` / `idx_vendas_mkt_telefone`
- `idx_membros_lista` / `idx_membros_lista_id`
- `idx_vendas_mkt_pedido` / o índice único implícito de `vendas_marketing_numero_pedido_key`

Custo de escrita sem benefício. Seguro dropar os três da direita.

## Ver também

- [[BD - RPCs]] · [[BD - Views]] · [[BD - Migrations]] · [[BD - Seguranca e RLS]] · [[BD - Cron e pg net]]
