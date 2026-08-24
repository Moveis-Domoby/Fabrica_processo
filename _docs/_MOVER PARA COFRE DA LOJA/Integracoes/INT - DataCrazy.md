---
titulo: INT — DataCrazy (CRM de disparo)
tipo: integracao
atualizado: 2026-08-06
tags: [integracao, datacrazy, crm, whatsapp, webhook]
---

# 💬 INT — DataCrazy (CRM)

> [!abstract] O papel dele
> O DataCrazy é quem **realmente envia** as mensagens de WhatsApp. Nosso sistema não envia nada — ele **aciona uma automação** no DataCrazy via webhook, e recebe de volta os eventos de resposta e erro por outro webhook.

## Divisão de responsabilidade

| Fato                   | Quem é a autoridade                                                    |
| ---------------------- | ---------------------------------------------------------------------- |
| A mensagem foi enviada | **nós** (após HTTP 200 do gatilho)                                     |
| O cliente respondeu    | **DataCrazy** (webhook inbound)                                        |
| Houve erro de envio    | **DataCrazy** (webhook inbound)                                        |
| O texto da mensagem    | **DataCrazy** — o template vive na automação, não no nosso banco       |
| O cliente **comprou**  | **Tiny ERP** via `vendas_marketing` — ⚠️ o DataCrazy não informa venda |

---

## 📤 Saída — gatilho da automação

**Endpoint:** variável de ambiente `DATACRAZY_WEBHOOK_TRIGGER_URL` (o gatilho "Requisição HTTP (Webhook)" da automação no DataCrazy).

**Usado por:** `enviar-proximo-disparo` e `disparar-membro-individual`.

**Chamada:** `POST`, header apenas `Content-Type: application/json` — **sem token**. A URL *é* o segredo.

**Payload:**
```json
{
  "nome":      "<nome_cliente>",
  "telefone":  "+55 (74) 99933-4788",
  "membro_id": "<uuid do membro>",
  "lista_id":  "<uuid da lista>"
}
```

**Formatação do telefone** (`formatarTelefoneDataCrazy`, duplicada nas duas functions):
1. remove não-dígitos
2. remove DDI `55` se `startsWith('55') && length > 11`
3. 11 dígitos → `+55 (DD) NNNNN-NNNN`
4. 10 dígitos → `+55 (DD) NNNN-NNNN`
5. fallback → `+55<digits>`

> [!bug] A "Mensagem Utilizada" nunca é enviada
> O payload contém apenas `nome`, `telefone`, `membro_id`, `lista_id`. **O template vive na automação do DataCrazy.**
>
> O textarea "Mensagem Utilizada" na sidebar e o botão "Salvar" são **puramente documentais** — mas a UI sugere fortemente o contrário. É a confusão de produto mais provável deste módulo. Ou renomear para "Registro da mensagem (documental)", ou passar o texto no payload e ajustar a automação.

> [!warning] Gatilho sem autenticação
> Quem descobrir a URL **dispara mensagens em nome da conta**, gerando custo real. É o modelo de segurança do próprio DataCrazy ("URL secreta"), mas vale registrar como risco. Ver [[BD - Seguranca e RLS|R4]].

---

## 📥 Entrada — webhook de resposta

**Function:** `supabase/functions/webhook-datacrazy-resposta/index.ts`

**Autenticação:** header `x-api-key` comparado com `DATACRAZY_WEBHOOK_SECRET`. Divergência → `401`. Método ≠ POST → `405`.

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

### Processamento, passo a passo

1. Lê o corpo bruto. JSON inválido → grava `webhook_eventos_crm` com `tipo:'payload_invalido'` e devolve `400`.
2. Normaliza o telefone.
3. **Log imutável ANTES de processar:** INSERT em `webhook_eventos_crm` (`processado: false`), guardando `logRow.id`. ✅ Bom padrão.
4. **Resolve o membro:** primeiro por `membro_id`; fallback por `lista_id` + telefone normalizado. Não achou → `404 membro_nao_encontrado`.
5. **Guarda de idempotência:** os três eventos exigem `membro.status === 'aguardando_resposta'`. Caso contrário grava "Ignorado: membro já estava em status X" e devolve `200 {ok:true, ignorado:true}`. ✅ Bom padrão.
6. **Transições:**

| `event` | Efeito |
|---|---|
| `resposta_recebida` | lê `janela_resultado_dias` (fallback 7), calcula `prazo_resultado_limite = agora + N dias corridos`, grava `data_resposta` e `status='respondido_aguardando_resultado'`; evento `resposta_recebida` |
| `sem_resposta` | `perdido` / `sem_resposta_no_prazo` / `data_resultado`; evento `timer_resposta_expirado` |
| `erro_envio` | `perdido` / `erro_envio_mensagem` / `data_resultado`; evento `erro_envio_mensagem` com o `motivo_erro` na descrição |
| qualquer outro | log + `400 evento_desconhecido` |

7. `marcarLogProcessado(logId, null)` → `processado: true`, `processado_em`. Retorna `200`.

> [!bug] Corrida com o cron de timers
> `processar-timers-disparo` (cron horário) e este webhook fecham o **mesmo estado**. Se o cron chegar primeiro, o membro sai de `aguardando_resposta` e uma `resposta_recebida` legítima que chegue logo depois é **descartada** pela guarda do passo 5.
>
> **Cliente que responde no limite do prazo vira perda.** O comentário em `processar-timers-disparo` já reconhece esse tipo de disputa para o timer de *resultado*, mas não para o de *resposta*.
>
> **Correção sugerida:** dar uma margem de tolerância ao cron (ex.: só expirar quem passou do prazo há mais de 1h), ou aceitar `resposta_recebida` para quem foi perdido por `sem_resposta_no_prazo` há pouco tempo, revertendo o estado.

> [!warning] Esta function precisa de `--no-verify-jwt`
> O DataCrazy não envia JWT do Supabase. Ela precisa estar declarada com `verify_jwt = false` no `config.toml` — que **não está versionado**. Confirmar em produção.

---

## 🪦 `src/lib/datacrazy/client.ts` — código morto

Classe REST completa que **não é importada em lugar nenhum**:

```ts
class DataCrazyClient {
  constructor(token: string, baseUrl: string)
  private fetchApi(path, options, maxRetries = 3)
  async getLeadsByList(listId)                 // GET /leads?filter[lists]=<id>
  async getWonBusinesses(createdAtGreaterOrEqual)  // GET /businesses?filter[status]=won&...
}
```

- Auth: `Authorization: Bearer <token>`
- Retry: em HTTP 429 lê `Retry-After` (default 10s), dorme e retenta até 3×
- `204` → `null`

> [!info] O que essa classe revela sobre o desenho original
> A intenção era **sincronizar leads e negócios direto pela API REST do DataCrazy**. Esse caminho foi trocado por webhooks e a classe virou morta.
>
> Isso explica três resquícios que confundem quem lê o schema hoje:
> - o status `sincronizada` em `status_lista_disparo`
> - o motivo `negocio_perdido_crm` em `motivo_perda_membro`
> - o evento `leads_sincronizados` em `tipo_evento_disparo`
> - as colunas `id_lista_crm`, `tag_crm`, `sincronizado_em`, `id_lead_crm`
>
> **Nenhum deles é produzido por código algum.** Ver [[DT - Indice de Problemas Conhecidos|DT-D14]].

> [!tip] Se um dia voltarmos à API REST
> `getWonBusinesses` resolveria uma limitação real: hoje só atribuímos venda a quem **respondeu** (ver [[MM - Maquina de Estados do Disparo]]). Se o DataCrazy souber de negócios ganhos que não passaram por resposta, essa seria a fonte.

## Ver também

- [[MM - Maquina de Estados do Disparo]] · [[TELA - Listas de Disparo]] · [[INT - Edge Functions]] · [[BD - Tabelas de Disparo]]
