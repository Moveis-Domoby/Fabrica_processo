---
titulo: PLT — Comercial: integração DataCrazy (CRM de disparo WhatsApp)
tipo: nota
atualizado: 2026-09-17
tags: [plataforma, comercial, datacrazy, crm, whatsapp, webhook, disparo]
---

# 💬 PLT — Comercial · Integração DataCrazy

> [!info] Origem e estado (17/09/2026)
> Reescrita a partir da `INT - DataCrazy` do cofre do Painel de Recompra, atualizada para o estado pós-união: o painel virou o **módulo Comercial** da plataforma (banco na SESSAO-19, front na SESSAO-20 — [[handoff_2026_09_16_sessao20_modulo_comercial]]). **Nenhum disparo sai da plataforma hoje**: a trava de 3 camadas da SESSAO-20 está ativa até o cutover da SESSAO-21, e o webhook de resposta do DataCrazy ainda aponta para o projeto Supabase antigo da loja.

## O que é e qual o papel dele

O **DataCrazy** é o CRM que **realmente envia** as mensagens de WhatsApp das campanhas de recompra. O módulo Comercial não envia mensagem nenhuma — ele **aciona uma automação** no DataCrazy via webhook de saída, e recebe de volta os eventos (resposta do cliente, ausência de resposta, erro de envio) por um webhook de entrada. O **texto da mensagem vive na automação do DataCrazy**, não no nosso banco.

### Divisão de responsabilidade

| Fato | Quem é a autoridade |
|---|---|
| A mensagem foi enviada | **nós** (após HTTP 200 do gatilho) |
| O cliente respondeu | **DataCrazy** (webhook de entrada) |
| Houve erro de envio | **DataCrazy** (webhook de entrada) |
| O texto da mensagem | **DataCrazy** — o template vive na automação |
| O cliente **comprou** | **Tiny ERP** via `vendas_marketing` — ⚠️ o DataCrazy não informa venda (ver [[N8N - Tiny Integracoes Referencia]]) |

---

## 📤 Ida — como o módulo Comercial dispara uma campanha

O operador monta uma **lista de disparo** (telas `/comercial/listas` e `/comercial/listas/:id`) e, membro a membro ou em fila, o front chama as Edge Functions **`enviar-proximo-disparo`** e **`disparar-membro-individual`** (ver [[SUPA - Comercial - Edge Functions]]). Cada uma faz um `POST` para a URL do gatilho da automação no DataCrazy:

- **Endpoint:** secret/variável de ambiente **`DATACRAZY_WEBHOOK_TRIGGER_URL`** (o gatilho "Requisição HTTP (Webhook)" da automação). Nunca colar a URL em nota — **a URL é o segredo**.
- **Chamada:** `POST`, header apenas `Content-Type: application/json` — **sem token**.
- **Payload:**

```json
{
  "nome":      "<nome_cliente>",
  "telefone":  "+55 (DD) NNNNN-NNNN",
  "membro_id": "<uuid do membro>",
  "lista_id":  "<uuid da lista>"
}
```

- **Formatação do telefone** (`formatarTelefoneDataCrazy`, duplicada nas duas functions): remove não-dígitos → remove DDI `55` quando `startsWith('55') && length > 11` → 11 dígitos vira `+55 (DD) NNNNN-NNNN`, 10 dígitos vira `+55 (DD) NNNN-NNNN` → fallback `+55<digits>`.

> [!bug] A "Mensagem Utilizada" nunca é enviada
> O payload contém apenas `nome`, `telefone`, `membro_id`, `lista_id`. O textarea "Mensagem Utilizada" na sidebar da lista e o botão "Salvar" são **puramente documentais** — o template real vive na automação do DataCrazy. A UI sugere o contrário; é a confusão de produto mais provável do módulo. Opções registradas: renomear para "Registro da mensagem (documental)" ou passar o texto no payload e ajustar a automação.

> [!warning] Gatilho sem autenticação
> Quem descobrir a `DATACRAZY_WEBHOOK_TRIGGER_URL` **dispara mensagens em nome da conta**, com custo real. É o modelo de segurança do próprio DataCrazy ("URL secreta"), mas fica registrado como risco herdado.

---

## 🔒 A trava de disparo em 3 camadas (SESSAO-20, D-46)

Enquanto o projeto antigo da loja ainda é o ambiente "quente", a plataforma **não pode disparar** — senão haveria dois sistemas capazes de mandar WhatsApp para os mesmos clientes. A SESSAO-20 instalou uma trava em três camadas, e verificou no DOM e nos logs que **nenhuma chamada saiu**:

1. **Constante:** `DISPARO_LIBERADO = false` em `src/comercial/travas.ts`.
2. **UI:** botões de disparo desabilitados com texto explicativo (ex.: `btn-disparar-lista`).
3. **Guarda de código:** verificação dentro de `handleRegistrarEnvio` e `iniciarFila` — mesmo um clique forçado ou um caminho esquecido não dispara.

Destravar na SESSAO-21 é **uma linha** (a constante da camada 1). As tabelas `listas_disparo_*` já vivem no banco da fábrica desde a SESSAO-19 (128 membros, checksum de status idêntico ao da carga, conferido na S20).

---

## 📥 Volta — webhook de resposta do DataCrazy

**Function:** `webhook-datacrazy-resposta` (código em `supabase/functions/webhook-datacrazy-resposta/index.ts`).

- **Autenticação:** header `x-api-key` comparado com o secret **`DATACRAZY_WEBHOOK_SECRET`**. Divergiu → `401`. Método ≠ POST → `405`.
- **Deploy:** precisa de **`verify_jwt = false`** (o DataCrazy não envia JWT do Supabase). No cofre da loja isso estava confirmado em produção (08/09/2026), mas o `config.toml` versionado não declarava o bloco `[functions.webhook-datacrazy-resposta]` — **conferir isso no deploy da fábrica no cutover**.

**Payload esperado:**

```ts
{
  event: "resposta_recebida" | "sem_resposta" | "erro_envio",
  membro_id?: string,
  lista_id?:  string,
  telefone?:  string,
  motivo_erro?: string,
  data_evento?: string   // ISO; default = agora
}
```

**Processamento:** log imutável em `webhook_eventos_crm` **antes** de processar (`processado: false`); resolve o membro por `membro_id`, com fallback `lista_id` + telefone normalizado (não achou → `404`); **guarda de idempotência** — os três eventos exigem `status === 'aguardando_resposta'`, caso contrário registra "ignorado" e devolve `200 {ok:true, ignorado:true}`. Transições:

| `event` | Efeito |
|---|---|
| `resposta_recebida` | calcula `prazo_resultado_limite` a partir de `janela_resultado_dias` (fallback 7), grava `data_resposta`, `status='respondido_aguardando_resultado'` |
| `sem_resposta` | `perdido` / `sem_resposta_no_prazo` |
| `erro_envio` | `perdido` / `erro_envio_mensagem` (com `motivo_erro` na descrição) |
| outro | log + `400 evento_desconhecido` |

> [!bug] Corrida conhecida com o cron de timers
> `processar-timers-disparo` (cron horário — ver [[SUPA - Comercial - Cron e Rotinas]]) e este webhook fecham o **mesmo estado**. Se o cron expira o membro primeiro, uma `resposta_recebida` legítima que chegue logo depois é descartada pela guarda de idempotência — **cliente que responde no limite do prazo vira perda**. Correções sugeridas (herdadas, não implementadas): margem de tolerância no cron (~1h) ou aceitar `resposta_recebida` de quem acabou de ser perdido por `sem_resposta_no_prazo`, revertendo o estado.

---

## 🔁 O que muda no cutover (SESSAO-21, pendente)

A [[SESSAO-21 - Uniao 3 - Cutover e Desligamento]] fará a virada. Pelo que está registrado até aqui, o cutover envolve, no que toca ao DataCrazy:

1. **Repontar o webhook de resposta** no DataCrazy: a URL configurada na automação deixa de ser a function do projeto Supabase antigo da loja e passa a ser a `webhook-datacrazy-resposta` do projeto da fábrica. É reconfiguração **manual** na automação do DataCrazy.
2. Garantir no projeto da fábrica: function deployada com `verify_jwt = false` e secrets **`DATACRAZY_WEBHOOK_SECRET`** e **`DATACRAZY_WEBHOOK_TRIGGER_URL`** configurados (só os nomes aqui; valores no gerenciador de secrets).
3. **Liberar a trava:** `DISPARO_LIBERADO = true` (uma linha, camada 1 acima).
4. Desligar o projeto antigo da loja — o que inclui o cron renovador do token Tiny v3, que até lá é o **único renovador** (regra do dono único — [[N8N - API Tiny v2 vs v3]]).

> [!question] Incertezas a resolver na SESSAO-21 (não afirmadas em nenhum handoff)
> - Se as functions de disparo (`enviar-proximo-disparo`, `disparar-membro-individual`, `webhook-datacrazy-resposta`, `processar-timers-disparo`) **já estão deployadas** no Supabase da fábrica ou só existem no projeto antigo — os handoffs S19/S20 documentam banco e front, não o deploy dessas functions. Ver [[SUPA - Comercial - Edge Functions]].
> - A ordem exata da virada (repontar webhook antes ou depois de liberar a trava) e a janela sem recepção de eventos durante o repontamento.

---

## 🪦 Nota histórica — o cliente REST morto

O código portado carrega `src/lib/datacrazy/client.ts`, uma classe REST completa (`getLeadsByList`, `getWonBusinesses`, auth Bearer, retry em 429 com `Retry-After`) que **não é importada em lugar nenhum**. O desenho original era sincronizar leads e negócios pela API REST do DataCrazy; foi trocado por webhooks. Isso explica resquícios no schema que nenhum código produz: o status `sincronizada`, o motivo `negocio_perdido_crm`, o evento `leads_sincronizados` e as colunas `id_lista_crm`, `tag_crm`, `sincronizado_em`, `id_lead_crm`.

Se um dia voltar a API REST: `getWonBusinesses` resolveria uma limitação real — hoje só se atribui venda a quem **respondeu**; negócios ganhos sem resposta prévia não são capturados.

## Ver também

[[000 - MAPA DO PROJETO]] · [[handoff_2026_09_16_sessao20_modulo_comercial]] · [[SUPA - Comercial - Edge Functions]] · [[SUPA - Comercial - Cron e Rotinas]] · [[N8N - Tiny Integracoes Referencia]] · [[N8N - API Tiny v2 vs v3]]
