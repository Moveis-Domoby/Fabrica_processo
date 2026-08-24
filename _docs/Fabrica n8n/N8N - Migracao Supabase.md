---
titulo: n8n — Migração da planilha para o Supabase (P15)
tipo: projeto
atualizado: 2026-08-17
tags: [n8n, supabase, tiny, migracao, banco-de-dados]
---

# 🗄️ Migração — Planilha → Supabase (P15)

> [!abstract] O que é
> O Supabase vira o **armazenamento canônico** de clientes e pedidos da fábrica, alimentado em tempo real pelo webhook de vendas do Tiny — incluindo o **id interno** que hoje não é persistido em lugar nenhum. Os nós de planilha saem de cena depois da paridade confirmada. Decidido pelo dono em 17/08/2026.

## Decisões de partida (17/08, com o dono)

| Decisão | Escolha | Motivo |
|---|---|---|
| Projeto Supabase | **Novo, dedicado à fábrica** | Isola a base de contatos do app de recompra da loja; a service key do n8n não enxerga dados da loja; uma migração não põe a outra em risco |
| Destino da planilha | **Aposentadoria após paridade** | Confirmado: a equipe opera no ClickUp; a planilha quase não é aberta. Vira arquivo histórico congelado |
| Backfill | **Histórico completo** (~4.940 pedidos, BACKUP + COMPLETO) | É a base de contatos desde o pedido 185 — exatamente o que se quer proteger |
| Método | **Dupla escrita → backfill → paridade → corte** | O mesmo padrão que funcionou nos 4 cortes do Plugga |
| Modelagem | **Normalizada** (clientes / pedidos / pedido_itens) + `raw` jsonb | Acaba com SKU concatenado, quantidade virando data e cliente repetido; o `raw` guarda o payload inteiro para nunca perder nada |
| Escrita no banco | **RPC única `fn_upsert_pedido`** | Uma chamada = transação atômica (cliente + pedido + itens + log). O n8n manda o `retorno.pedido` cru, sem mapear nada |

## Uma percepção importante que saiu da conversa

**Os ramos do ClickUp/Trello NÃO dependem da planilha** — os Codes leem de `$('Tiny · pedido.obter')`, direto da API. O único "consumidor" da planilha era a própria equipe (que agora usa o ClickUp) e as abas derivadas (que alimentavam a PCP antiga). Ou seja: o corte da planilha é **muito menos arriscado** do que parece — nenhuma automação quebra.

## Arquitetura

```
Tiny ──webhook──► n8n ──pedido.obter──► Tiny
                   │
                   ├──► Sheets · COMPLETO          (mantido durante a dupla escrita)
                   ├──► Supabase · fn_upsert_pedido  ◄── NOVO (fase 1)
                   ├──► ClickUp · ROTAS
                   ├──► ClickUp/Trello · PCP
                   └──► (ClickUp ROTAS "entregue" → Tiny lê o tiny_id daqui — fase 4)
```

Esquema completo: **`supabase-fabrica-schema.sql`** (nesta pasta). Resumo:

- `clientes` — identidade por `cpf_cnpj` (índice único parcial), fallback nome+fone. Telefone, e-mail, endereço, `tiny_id_contato`.
- `pedidos` — chave natural `numero` (única), `tiny_id` (único quando presente; NULL no histórico do backfill), situação, datas, totais, parcelas/entrega em jsonb, `marcadores` em array, **`raw` jsonb com o retorno.pedido inteiro**, `origem` (webhook/backfill).
- `pedido_itens` — 1 linha por item, `codigo` (SKU) em **texto** — "061" continua "061" para sempre.
- `eventos` — log permanente de cada webhook processado (o n8n poda execuções em 7 dias; isto não).
- **RLS ligado em tudo, sem policies** — anon key não enxerga nada; só a service_role acessa.

> [!info] Documentação viva do banco
> A partir de 17/08 tudo do Supabase vive na pasta **`Supabase-fabrica/`**: [[SUPA - Visao Geral]] (endpoints, chaves) e [[SUPA - Esquema do Banco]] (fonte da verdade — **ler antes de mexer no banco**). O `.sql` também mora lá.

## FASE 0 · Preparação ✅ CONCLUÍDA em 17/08

1. ~~Criar o projeto novo no Supabase~~ ✅ criado.
2. ~~SQL Editor → rodar `supabase-fabrica-schema.sql` inteiro~~ ✅ **rodado em 17/08, sem erros.**
3. ~~Variáveis no VPS~~ ✅ `SUPABASE_FABRICA_URL`, `SUPABASE_FABRICA_KEY` e `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` no compose, container reiniciado, `printenv` conferido. (Tropeço registrado: as linhas foram coladas primeiro dentro de `volumes:` — o compose acusou "refers to undefined volume"; movidas para `environment:` e validado com `docker compose config`.)
3. No VPS, `/docker/n8n/docker-compose.yml`, bloco `environment:`:
   ```yaml
         - SUPABASE_FABRICA_URL=https://SEU-PROJETO.supabase.co
         - SUPABASE_FABRICA_KEY=a_service_role_key_aqui
   ```
   (Settings → API do projeto novo → **service_role** key. NUNCA a anon.)
   Depois: `cd /docker/n8n && docker compose down && docker compose up -d` e conferir com `docker exec n8n-n8n-1 printenv | grep SUPABASE`.
   ⚠️ Se a expressão `$env` não resolver no node, falta `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` no compose.

## FASE 1 · Dupla escrita ✅ NO AR desde 17/08

Ramo colado, ligado no true do `Retorno OK?` em paralelo ao `Mapear 49 colunas`, primeira execução verde e **dados confirmados no Supabase** (eventos, pedidos, clientes, pedido_itens).

> [!tip] Aviso vermelho que NÃO é erro
> No editor, os campos com `{{ $env.SUPABASE_FABRICA_URL }}` mostram `[ERROR: not accessible via UI, please run node]` em vermelho. É cosmético: o navegador não tem acesso às variáveis de ambiente (segurança — a chave nunca sai do servidor). Em execução resolve normalmente. Vale para todo node que use `$env`.

Dois nodes novos, pendurados no **true do `Retorno OK?`**, em **paralelo** ao `Mapear 49 colunas` (nunca em série — lição da PARTE D do PCP: ramo em série herda dado errado e propaga falha).

### Node A — Code `Montar payload Supabase` (Run Once for All Items)

```js
// Prepara a chamada da RPC. O payload vai CRU — o mapeamento todo é feito no SQL.
// NÃO renomear 'Normalizar evento' — referência por nome.
const ev = $('Normalizar evento').first().json;
const p = $input.first().json?.retorno?.pedido;
if (!p || !p.numero) return [];
return [{ json: {
  p,
  p_tipo: ev.tipo || 'webhook',
  p_tiny_id: Number(ev.id) || Number(p.id) || null,
  p_origem: 'webhook',
}}];
```

### Node B — HTTP Request `Supabase · upsert pedido`

| Campo | Valor |
|---|---|
| Method / URL | POST `{{ $env.SUPABASE_FABRICA_URL }}/rest/v1/rpc/fn_upsert_pedido` |
| Headers | `apikey: {{ $env.SUPABASE_FABRICA_KEY }}` · `Authorization: Bearer {{ $env.SUPABASE_FABRICA_KEY }}` |
| Body (JSON) | `p = {{ $json.p }}` · `p_tipo = {{ $json.p_tipo }}` · `p_tiny_id = {{ $json.p_tiny_id }}` · `p_origem = {{ $json.p_origem }}` |
| Settings | Retry On Fail 3× / 5 s · **Continue On Fail: ON durante a fase de teste** |

Resposta de sucesso: o `id` (bigint) do pedido na tabela. O `Continue On Fail` garante que um soluço do Supabase **não derruba a escrita na planilha** enquanto os dois coexistem — mas exige olhar as Executions (ou o P1 resolvido) para não mascarar falha para sempre. Rodam nas duas pontas: `inclusao_pedido` **e** `atualizacao_pedido` (o upsert absorve os dois).

## FASE 2 · Backfill do histórico (~4.940 pedidos)

1. Exportar as abas **COMPLETO** e **BACKUP** como CSV (Arquivo → Fazer download → CSV, uma por vez).
2. Sessão dedicada com o Claude: script que reconstrói cliente + itens a partir das 49 colunas (a `LISTA DE ITENS DO PEDIDO` tem `Código:`, `Quantidade:` e `Valor unitário:` de cada item — mesma engenharia reversa validada com 1.982 pedidos) e chama `fn_upsert_pedido` com `p_origem='backfill'`.
3. Regras: `tiny_id` fica NULL (planilha não tem); **webhook ganha do backfill** — a função só preenche campo vazio no conflito, então rodar o backfill DEPOIS da dupla escrita estar no ar não sobrescreve nada fresco. Atenção ao regime antigo de TOTAL/TOTAL 2 (pedidos < 11.000 — ver handoff da migração 1).
4. Aproveitar para corrigir na origem os **160 SKUs sem zero** e as **91 quantidades corrompidas** (P10) — no banco eles entram certos, extraídos da LISTA DE ITENS.

## FASE 3 · Paridade (3–5 dias de dupla escrita)

- `select count(*) from pedidos where origem='webhook'` × linhas novas na COMPLETO no mesmo período.
- Amostra de 10 pedidos comparados campo a campo (query pronta no fim do .sql).
- Conferir que `atualizacao_pedido` atualiza `situacao` no banco como atualiza na planilha.

## FASE 4 · Cortes (na ordem, um por vez)

1. **Automação "entregue" passa a ler o banco:** no workflow `ClickUp ROTAS → Tiny`, trocar o node `Tiny · pedidos.pesquisa` por um GET `{{ $env.SUPABASE_FABRICA_URL }}/rest/v1/pedidos?numero=eq.{{ $json.numero }}&select=tiny_id,numero,situacao` (mesmos headers). Menos uma chamada ao Tiny por entrega, e o guard de idempotência continua (situacao vem do banco). Manter o `pedidos.pesquisa` como fallback se `tiny_id` for NULL (pedido do histórico).
2. **Desligar o node `Sheets · COMPLETO`** (desconectar, não apagar) — a planilha congela como arquivo histórico. Reversão: reconectar.
3. Planilha: proteger tudo como somente leitura e renomear para deixar claro que é arquivo (`[ARQUIVO] Integração Domoby - Tinny`).

## Riscos

| Risco | Mitigação |
|---|---|
| Falha silenciosa do ramo Supabase com Continue On Fail ligado | **P1 (alerta de erro) vira pré-requisito do corte da planilha** — enquanto não existir, conferir Executions diariamente |
| Service key vazar (mesma classe do token do Tiny) | Só em `$env`, nunca no body do node; RLS travado limita o estrago da anon key a zero |
| Cliente duplicado (sem CPF, nome digitado diferente) | Fallback nome+fone é conservador: prefere criar a mesclar errado. Dedup por auditoria depois (query por fone) |
| Projeto free tier pausar por inatividade | Não acontece: o webhook escreve várias vezes ao dia |
| Dois "donos" da verdade durante a dupla escrita | Não há conflito: os dois ramos só escrevem, ninguém lê da planilha para decidir nada |

## Ver também

[[N8N - Pendencias e Riscos]] (P15, P10, P1) · [[N8N - Workflow Tiny para Planilha]] · [[N8N - ROTAS Entregue para Tiny]] · [[N8N - API Tiny v2 vs v3]] (regra do dono único do token v3 — **não se aplica aqui**: este projeto novo não mexe com OAuth do Tiny)
