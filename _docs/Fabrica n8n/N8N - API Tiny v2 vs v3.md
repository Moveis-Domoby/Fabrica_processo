---
titulo: n8n — API Tiny v2 vs v3 (decisão)
tipo: decisao
atualizado: 2026-09-17
tags: [tiny, api, v2, v3, oauth, decisao]
---

# ⚖️ API do Tiny — v2 hoje, v3 se preciso

> [!abstract] Decisão (12/08/2026)
> **Os workflows do n8n permanecem na API v2.** Reavaliar se a Olist publicar data de descontinuação ou se aparecerem 401/403 em massa nas Executions.

> [!info] Atualização 17/09/2026 — a união mudou ONDE a v3 vive, não a decisão
> O painel de recompra virou o **módulo Comercial da plataforma da fábrica** (banco movido ao Supabase da fábrica na SESSAO-19; front na SESSAO-20 — [[handoff_2026_09_16_sessao20_modulo_comercial]]). **O cron renovador do token v3, porém, continua rodando SOMENTE no projeto Supabase antigo da loja** até o cutover da [[SESSAO-21 - Uniao 3 - Cutover e Desligamento]]. A regra do dono único (abaixo) permanece intacta e vale para o n8n, para o projeto da fábrica e para qualquer script. Os detalhes operacionais do OAuth v3 que estavam na nota `INT - Tiny ERP Olist` da loja foram fundidos em [[N8N - Tiny Integracoes Referencia]] (§3.5–3.9).

## A posição oficial da Olist

> "A API V2 continuará funcional **sem data estimada para descontinuação**, mas **não receberá mais atualizações ou novos recursos**."
> — https://tiny.com.br/api-docs/api

Modo manutenção: não morre amanhã, mas está congelada. Expectativa do usuário (razoável): se forem desligar, avisam com antecedência — o risco real é a **degradação silenciosa** (campo que não aparece, bug não corrigido), não o desligamento surpresa.

## Por que NÃO migrar para v3 agora

| | v2 (em uso no n8n) | v3 |
|---|---|---|
| Autenticação | token estático | OAuth2 |
| Access token | não expira | **~4 horas** |
| Refresh token | — | **~24 horas, rotaciona a cada uso** |
| Se ficar parado | nada | integração morre, reautorização manual |

É a mesma classe de falha do incidente de 11/08 ([[N8N - Incidente Credencial Google]]), com janela de 24 h em vez de 7 dias. Migrar sem necessidade = adicionar uma peça móvel de autenticação no caminho crítico de vendas.

## ⚠️ O ponto cego — o webhook

Toda a arquitetura depende do webhook **"Notificações de vendas"**, documentado sob **API 2.0**. **Não foi encontrada documentação de webhook equivalente na v3** (o que existe lá é uma "API de Gatilhos", outra coisa). Se a v2 for desligada, **verificar isto primeiro** — sem webhook não há migração simples, há reescrita para polling.

## 🧰 Ativo já existente — o refresh loop do Supabase

O projeto do painel de recompra da loja (hoje o **módulo Comercial** da plataforma — ver atualização no topo) **já roda a v3 em produção**: um **cron de 3 em 3 horas renovando o refresh token**, que segue no projeto Supabase antigo da loja até a SESSAO-21. Se um dia o n8n precisar da v3, a parte cara já está pronta — o n8n só precisaria **ler** o access token vigente do Supabase antes de cada chamada.

> [!danger] Regra do dono único (obrigatória)
> O refresh token da v3 **rotaciona** — cada renovação invalida a anterior. **Só o cron do Supabase renova.** O n8n (e qualquer outra aplicação) apenas **lê**. Dois renovadores independentes se derrubam mutuamente e quebram as duas aplicações ao mesmo tempo.
>
> 🆕 17/09/2026: com a união em andamento, isso vale explicitamente também para o **projeto Supabase da fábrica** — até a SESSAO-21 mover o renovador oficialmente, nada fora do cron antigo da loja toca o endpoint de token. Ver [[SUPA - Comercial - Cron e Rotinas]].

A verificar quando for o momento: se o app v3 do painel tem escopo para ler pedidos, ou se precisa de app separado (limite de 5 apps por conta).

## Tamanho do serviço, se um dia for necessário

Mexe em **dois nodes**: `Tiny · pedido.obter` (endpoint v3 + token lido do Supabase) e `Mapear 49 colunas` (traduzir o payload). Webhook, planilha, ClickUp e Trello não mudam. ~Meio dia de trabalho.

## Mitigações no lugar da migração

1. **Alerta de erro** ([[N8N - Pendencias e Riscos]]) — pega desligamento, revogação e API fora do ar, avisados ou não.
2. **Tirar o token v2 do JSON do workflow** → env var no compose (`TINY_TOKEN`) e `{{ $env.TINY_TOKEN }}` no node (se bloquear: `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`).
3. Conferir qual e-mail recebe os comunicados da Olist e se alguém o lê.
4. Vigiar: anúncio de descontinuação · 401/403 em massa.
