---
titulo: BD — Segurança e RLS
tipo: banco-de-dados
prioridade: critica
atualizado: 2026-08-06
tags: [banco, seguranca, rls, pii, risco]
---

# 🔐 BD — Segurança e RLS

> [!danger] Resumo em uma frase
> O modelo de segurança atual é **"banco aberto atrás de uma chave anon"** — e essa chave está no bundle do Vite, distribuída para o navegador de qualquer visitante.
>
> Isso só é aceitável se a aplicação nunca sair de um perímetro controlado. **Antes de qualquer exposição pública, isto precisa ser resolvido.**

## Estado atual, tabela a tabela

| Tabela | RLS | Policy | O que a chave anon pode fazer |
|---|---|---|---|
| `vendas_marketing` | ✅ ON | `FOR SELECT USING (true)` | **ler tudo** (nomes, telefones, datas, valores) |
| `webhook_eventos_crm` | ✅ ON | `public_read_only` (`SELECT`) | **ler `payload_bruto`** — PII do CRM |
| `listas_disparo` | ✅ ON | `public_full_access` `USING(true) WITH CHECK(true)` | ler, **escrever e apagar** |
| `listas_disparo_membros` | ✅ ON | `public_full_access` | ler, **escrever e apagar** — inclui telefone e snapshots financeiros |
| `listas_disparo_eventos` | ✅ ON | `public_full_access` | o "log imutável" é **editável e deletável** |
| `tarifas_mensagem_whatsapp` | ❌ **OFF** | — | `GRANT ALL TO anon` — pode **alterar tarifas** e distorcer o ROI |
| `tiny_sync_state` | ❌ **OFF** | — | pode marcar `concluido = true` e **parar a sincronização** |
| `tiny_auth` | ✅ ON | **nenhuma policy** | 🔒 **efetivamente bloqueada** — única tabela sensível fechada |

> [!note] A única proteção real é acidental
> `tiny_auth` (que guarda os tokens OAuth do Tiny em **texto puro**) está protegida porque alguém habilitou RLS e **esqueceu de criar a policy**. Funcionou, mas não foi projeto.

## Privilégios default

Definidos no baseline para o role `postgres` no schema `public`:

- **Tabelas:** `SELECT, INSERT, UPDATE, DELETE` para `anon`, `authenticated`, `service_role`
- **Sequences:** `SELECT, USAGE` para os três
- **Routines: `ALL` para os três** ← toda função criada depois fica automaticamente executável por `anon`

Não há uso de `auth.uid()`, `auth.jwt()`, nem qualquer noção de tenant ou usuário em nenhuma policy. **Não há autenticação de usuário no produto.**

## Os cinco riscos concretos

### 🔴 R1 — Base de clientes publicamente legível
`vendas_marketing` com `SELECT USING (true)`. Nome, telefone, data de compra e valor de **toda a carteira** acessíveis com a chave do bundle. Sob a LGPD, telefone + histórico de compra é dado pessoal tratado sem base legal de acesso público.

### 🔴 R2 — Segredos versionados em texto puro
As funções `tick_auditoria_tiny`, `tick_historico_tiny` e `tick_incremental_tiny` embutem o **JWT anon completo** e a URL do projeto (`https://hftyremdlnuzsgfozciv.supabase.co`) **no corpo da função**, dentro do `20260801024816_remote_schema.sql` — portanto no git.

Além disso têm `GRANT ALL TO anon`: qualquer visitante pode chamar `rpc('tick_incremental_tiny')` em loop e **disparar syncs completos contra o Tiny**. Como o rate limit do Tiny é **por conta**, isso derruba também as integrações de marketplace do cliente.

### 🟠 R3 — Módulo de disparo totalmente aberto
Ler, alterar e **apagar** listas, membros e a auditoria inteira — tudo permitido para `anon`. Um visitante pode deletar o histórico de campanhas.

Note a inconsistência: `vendas_marketing` e `webhook_eventos_crm` **estão** restritas a `SELECT`. Só o módulo de disparo ficou aberto.

### 🟠 R4 — Gatilho do DataCrazy sem autenticação
O `POST` para `DATACRAZY_WEBHOOK_TRIGGER_URL` **não leva token** — a URL é o segredo. Quem descobrir dispara mensagens de WhatsApp em nome da conta, gerando custo real.

### 🟡 R5 — Edge Functions sem validação de chamador
`enviar-proximo-disparo` e `processar-timers-disparo` não validam método nem quem chamou. Qualquer `GET` na URL executa um ciclo. A proteção depende inteiramente do `verify_jwt` default do gateway — e **não há `supabase/config.toml` versionado** declarando isso.

## Plano de correção sugerido

> [!success] Ordem recomendada (do mais barato ao mais caro)
>
> **1. Revogar `anon` das funções `tick_*`** — 3 linhas, risco zero:
> ```sql
> REVOKE ALL ON FUNCTION public.tick_incremental_tiny() FROM anon, authenticated;
> REVOKE ALL ON FUNCTION public.tick_historico_tiny()   FROM anon, authenticated;
> REVOKE ALL ON FUNCTION public.tick_auditoria_tiny()   FROM anon, authenticated;
> ```
>
> **2. Mover o JWT das funções `tick_*` para o Vault** e recriar as funções lendo de lá.
>
> **3. Habilitar RLS em `tarifas_mensagem_whatsapp` e `tiny_sync_state`** com policy `SELECT`-only (ou nenhuma).
>
> **4. Restringir o módulo de disparo:** trocar `public_full_access` por `FOR SELECT USING (true)` e mover toda escrita para Edge Functions com `service_role`. Isso exige refatorar `src/lib/disparo/api.ts` — é o passo mais caro, mas é o que fecha R3.
>
> **5. Dropar `fn_dashboard_transitions`** (legada, com PII).
>
> **6. Introduzir autenticação Supabase Auth** e trocar `USING (true)` por policies baseadas em `auth.uid()`. É o passo que resolve R1 de verdade.
>
> **7. Versionar `supabase/config.toml`** declarando `verify_jwt` por função (com `false` apenas para o webhook do DataCrazy).

## Observações menores

- Nenhuma função declara `SET search_path = public` — combinado com `pg_net` instalada em `public`, é o padrão que o linter do Supabase sinaliza como *function search path mutable*. Risco baixo aqui porque todas são `SECURITY INVOKER`.
- `listas_disparo.criado_por` e `tarifas_mensagem_whatsapp.criado_por` são `text` livre, não FKs — **a auditoria de "quem fez" não é confiável**.
- Views executam com privilégios do dono; `vw_clientes_consolidados` deve ser revisada junto com R1.

## Ver também

- [[BD - Visao Geral]] · [[BD - RPCs]] · [[DT - Indice de Problemas Conhecidos]]
