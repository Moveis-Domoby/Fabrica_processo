---
titulo: "SESSAO-19 — União 1: Banco do Comercial na fábrica"
tipo: demanda
status: "✅ entregue — ↪️ corrigido em 18/11 na revisão das pendências (antes: pronta para code)"
data: 2026-09-15
atualizado: 2026-09-15
tags: [plataforma, demanda, uniao, comercial, banco]
---

# 🎯 SESSAO-19 — União 1: Banco do Comercial na fábrica

## O que é

Trazer o domínio do Painel de Recompra para o Supabase da fábrica (`axnzldwgwsmepukdiljx`): schema, functions e dados — **sem front nesta sessão**. Cobre as fases F1–F3 de [[PLT - Plano Uniao das Plataformas]].

## Decisões que regem esta demanda

**D-46** (a união), **D-47** (reutilizar antes de criar — `vendas_marketing` vira view sobre `pedidos`), D-19/regra 2 (nada aplicado no banco sem OK explícito do dono), regra 4 (nenhum segredo em chat/nota/código), RNF-05 (eventos append-only).

## Comportamento esperado

1. **Migration** (arquivo em `supabase/migrations/`, padrão `plt_*` de nomenclatura de arquivo da casa) com: as 6 tabelas (`listas_disparo`, `listas_disparo_membros`, `listas_disparo_eventos`, `webhook_eventos_crm`, `tarifas_mensagem_whatsapp`, `tiny_auth`) em DDL idêntico ao do banco vivo do recompra; a view de compatibilidade `vendas_marketing`; as views `vw_clientes_consolidados` e `vw_scorecards_lista`; as 10 RPCs do recompra copiadas sem alteração; a coluna `plt_usuarios.modulos text[] not null default '{}'` com seed (`{fabrica}` para todos; `{fabrica,comercial}` para admins); helper `plt_privado.fn_tem_modulo(text)`; RLS no padrão da casa nas 6 tabelas (módulo `comercial` ou admin; nada de `USING (true)`).
2. **A view `vendas_marketing` reproduz o shape exato da tabela original** — validar coluna a coluna contra o banco do recompra, inclusive `itens_comprados` (usar `pedidos.raw` se alguma RPC depender do formato bruto do Tiny) e `data_compra` (meia-noite America/Sao_Paulo, como no original).
3. **Deploy das 6 Edge Functions** (código-fonte em `Planilha de recompra/supabase/functions/`, sem fork): `enviar-proximo-disparo`, `processar-timers-disparo`, `verificar-vendas-disparo`, `disparar-membro-individual`, `webhook-datacrazy-resposta`, `tiny-auth-refresh`. O dono configura os 4 secrets no dashboard. **Nenhum cron é agendado nesta sessão.**
4. **Carga de dados** das 6 tabelas a partir do banco vivo do recompra, byte a byte, sem transformação.

## Fora do escopo

Front (SESSAO-20). Cutover, crons, DataCrazy, exclusão do projeto antigo (SESSAO-21). Consolidação `vendas_marketing`×`pedidos` além da view. Qualquer alteração nas tabelas existentes da fábrica além da coluna `modulos`. Qualquer disparo de WhatsApp.

## Critérios de aceite

- [x] Migration testada no harness local (`npm run test:banco`) antes de qualquer conversa sobre aplicar. — ↪️ *18/11: relatado como testado no handoff; não dá para reconferir só lendo*
- [x] Aplicação no banco de produção só após OK explícito do dono na conversa. — ↪️ *18/11: conferido no código/banco — aplicada em 15/09 com o OK (Ordem)*
- [x] Contagem das 6 tabelas idêntica origem×destino após a carga (na data da carga). — ↪️ *18/11: relatado como testado no handoff; não dá para reconferir só lendo*
- [x] As 8 RPCs de dashboard + `fn_filter_customers` retornam, na fábrica, os **mesmos números** do projeto antigo (comparação mês a mês; tolerância zero fora do delta de sync do dia). — ↪️ *18/11: relatado como testado no handoff; não dá para reconferir só lendo*
- [x] RLS ativa nas 6 tabelas; anon key **não** lê nem escreve nenhuma delas; usuário sem módulo `comercial` não lê nada; admin lê tudo. — ↪️ *18/11: relatado como testado no handoff; não dá para reconferir só lendo (conferida no banco: a função das notas não responde a quem não fez login)*
- [-] `tiny-auth-refresh` deployada mas **sem cron** — o renovador continua rodando SÓ no projeto antigo até o cutover (risco 1 do plano). — ↪️ *18/11: superado — o cutover (SESSAO-21) passou o renovador para a fábrica: a rotina de 3 em 3 h está ativa no banco*
- [x] `SUPA - Esquema do Banco.md` e `supabase-fabrica-schema.sql` atualizados. — ↪️ *18/11: relatado como testado no handoff; não dá para reconferir só lendo*

## Notas para o Claude Code

Ler [[PLT - Plano Uniao das Plataformas]] inteiro antes de codar. DDL e corpo das RPCs saem do **banco vivo** do recompra (dump de schema), nunca de memória. Ler também o cofre do recompra (`Planilha de recompra/_Docs/000 - MAPA DO PROJETO.md`, `BD - RPCs.md`, `BD - Seguranca e RLS.md`, `MM - Identidade do Cliente.md`) — as armadilhas de lá valem aqui (telefone sem normalizar, situações do Tiny, refresh_token de 24h).

## Resultado (preencher ao entregar)

**Entregue em 15/09/2026** — [[handoff_2026_09_15_sessao19_banco_comercial]] · memória de execução em `docs/execucao/SESSAO-19.md`.

- Migration 26 (`20260915120000_plt_comercial_banco.sql`) aplicada com autorização do dono: 6 tabelas em DDL idêntico, view `vendas_marketing` sobre `pedidos`+`clientes` (D-47), `vw_clientes_consolidados` + `vw_scorecards_lista`, 10 RPCs copiadas, `plt_usuarios.modulos` com seed, `fn_tem_modulo`, RLS por módulo (`tiny_auth` sem policy de propósito — token é segredo de máquina). Impressão digital da integração intacta.
- 6 Edge Functions deployadas, **nenhum cron agendado**; `tiny-auth-refresh` com verify_jwt ligado até o cutover (risco 1).
- Carga das 6 tabelas servidor→servidor com **checksum idêntico 6/6** (o token do Tiny nunca passou por chat — script `supabase/manutencao/2026-09-15_carga_comercial.mjs`, reutilizável no delta da S21).
- Validação: `revenue_chart`/`items`/`top_items` **byte a byte idênticos** ao projeto antigo (com corte do delta do dia); `scorecards` com receita e pedidos idênticos ao centavo e diferença de exatamente 2 clientes = deriva histórica documentada (10 pedidos, 0,19%); `vw_scorecards_lista` idêntica; anon key recusada em tudo.
