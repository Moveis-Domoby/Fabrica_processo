---
titulo: "SESSAO-19 — União 1: Banco do Comercial na fábrica"
tipo: demanda
status: pronta para code
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

- [ ] Migration testada no harness local (`npm run test:banco`) antes de qualquer conversa sobre aplicar.
- [ ] Aplicação no banco de produção só após OK explícito do dono na conversa.
- [ ] Contagem das 6 tabelas idêntica origem×destino após a carga (na data da carga).
- [ ] As 8 RPCs de dashboard + `fn_filter_customers` retornam, na fábrica, os **mesmos números** do projeto antigo (comparação mês a mês; tolerância zero fora do delta de sync do dia).
- [ ] RLS ativa nas 6 tabelas; anon key **não** lê nem escreve nenhuma delas; usuário sem módulo `comercial` não lê nada; admin lê tudo.
- [ ] `tiny-auth-refresh` deployada mas **sem cron** — o renovador continua rodando SÓ no projeto antigo até o cutover (risco 1 do plano).
- [ ] `SUPA - Esquema do Banco.md` e `supabase-fabrica-schema.sql` atualizados.

## Notas para o Claude Code

Ler [[PLT - Plano Uniao das Plataformas]] inteiro antes de codar. DDL e corpo das RPCs saem do **banco vivo** do recompra (dump de schema), nunca de memória. Ler também o cofre do recompra (`Planilha de recompra/_Docs/000 - MAPA DO PROJETO.md`, `BD - RPCs.md`, `BD - Seguranca e RLS.md`, `MM - Identidade do Cliente.md`) — as armadilhas de lá valem aqui (telefone sem normalizar, situações do Tiny, refresh_token de 24h).

## Resultado (preencher ao entregar)

*—*
