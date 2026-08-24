---
titulo: INT — Edge Functions
tipo: integracao
atualizado: 2026-08-06
tags: [integracao, edge-function, deno, supabase]
---

# ⚡ INT — Edge Functions

Nove funções Deno em `supabase/functions/`. Duas famílias: **sync com o Tiny** e **operação de disparo**.

---

## Família A — Sincronização com o Tiny ERP

### `tiny-auth-refresh`
Renova o par de tokens OAuth em `tiny_auth`.

> [!danger] Função mais crítica do sistema inteiro
> O refresh token do Tiny vale **24h**. Se esta função falhar por mais de um dia, a integração morre e **exige reautorização manual por um humano**. Ver [[INT - Tiny ERP Olist]].
>
> **Verificar:** ela renova proativamente (a cada ~3h) ou só sob demanda? Ela **sobrescreve** o `refresh_token` com o valor da última resposta? Há alerta se a última renovação passar de 12h?

### `tiny-historico-mkt` (18 KB — a maior)
Carga histórica completa. Chamada por `tick_historico_tiny()` com `{"modo":"historico"}`.

Mantém o ponteiro de retomada em `tiny_sync_state`:

| Coluna | Papel |
|---|---|
| `modo` | PK, texto livre — valor conhecido: `'historico'` |
| `data_inicial` | ⚠️ guardada como **`varchar`**, não `date` |
| `offset_atual` | onde parou |
| `concluido` | quando `true`, `tick_historico_tiny()` chama `cron.unschedule('tiny-historico-loop')` |
| `total_pedidos_tiny` | total esperado |
| `ultima_execucao` | timestamp |

> [!warning] `modo` é texto livre sem ENUM nem CHECK — **um typo cria um estado de sync fantasma**.

### `tiny-incremental-sync`
Modo de regime: traz só o que mudou. Usa `dataAtualizacao` da API v3.

⚠️ A semântica exata de `dataAtualizacao` (ponto único vs "a partir de") **não está documentada pelo Tiny**. Vale confirmar empiricamente o que esta função assume.

### `tiny-auditoria-sync` (12,7 KB)
Reconciliação — recaptura períodos para corrigir divergências. É o "job de reconciliação" que a boa prática recomenda ter mesmo com webhooks.

### O padrão comum das três de sync

```
1. Ler access_token de tiny_auth
2. GET /pedidos  (listagem paginada, limit/offset)
3. Para CADA pedido → GET /pedidos/{id}   ← o N+1 obrigatório, os itens só vivem no detalhe
4. UPSERT em vendas_marketing por numero_pedido
5. Atualizar tiny_sync_state
```

Timeout de `300000 ms` (5 min) configurado no `net.http_post` das funções `tick_*`.

> [!tip] Checklist ao mexer em qualquer uma delas
> - Respeita `X-RateLimit-Remaining`? (o limite é **por conta**, compartilhado com as integrações de marketplace do cliente)
> - Trata 429 **e** 503 com backoff exponencial + jitter?
> - Qual filtro de `situacao` usa? Confira contra a tabela de códigos em [[INT - Tiny ERP Olist]] — `7` é "Pronto Envio", não "Entregue"
> - Normaliza o telefone antes de gravar? **Hoje não normaliza** — é a causa-raiz descrita em [[MM - Identidade do Cliente]]

---

## Família B — Operação de disparo

Ver o fluxo completo em [[MM - Maquina de Estados do Disparo]].

### `enviar-proximo-disparo` — motor da fila
**Gatilho:** cron `* * * * *` (a cada minuto)

1. `SELECT listas_disparo WHERE status = 'disparando'`
2. Para cada lista: `podeEnviar = !ultimo_envio_em || (agora − ultimo_envio_em) >= intervalo × 1000`
3. Próximo membro: `status='aguardando_envio'`, `.order('criado_em' asc).limit(1)`
4. **Sem próximo** → lista vira `em_andamento` + evento `lista_encerrada` ("Fila de envio concluída")
5. `POST` no `DATACRAZY_WEBHOOK_TRIGGER_URL`
6. Falha → empilha em `erros[]` e `continue` **sem tocar em `ultimo_envio_em`**
7. Sucesso → UPDATE membro (`data_envio`, `prazo_resposta_limite`, `status='aguardando_resposta'`) + UPDATE `ultimo_envio_em` + evento `envio_registrado`

**Retorno:** `{listas_verificadas, envios_realizados, listas_concluidas, erros[]}` — sempre HTTP 200.

> [!bug] A fila trava no contato com erro
> Como `ultimo_envio_em` não avança na falha, o **mesmo contato é retentado indefinidamente** e ninguém atrás dele é enviado. Sem contador de tentativas, sem dead-letter.

> [!bug] Ordenação não-determinística
> Ordena por `criado_em ASC`, mas todos os membros de um `.insert()` em lote compartilham praticamente o mesmo `now()`. **Sem desempate por `id`, a ordem entre empates é indefinida.**

### `disparar-membro-individual` — envio manual
**Gatilho:** HTTP do browser via `supabase.functions.invoke(...)` no botão "Enviar" da linha.

Valida `POST` (senão 405), exige `membro_id` (400), busca membro (404), exige `status === 'aguardando_envio'` (senão 409), busca `janela_resposta_dias` (404), `POST` no DataCrazy (502 em falha), UPDATE do membro, evento `envio_registrado`.

**Diferenças vs. a fila:** não atualiza `ultimo_envio_em`, não checa o status da lista.

> [!danger] Provavelmente quebrada por CORS
> É a **única** function chamada direto do browser, e **nenhuma das 9 define `Access-Control-Allow-Origin` nem trata `OPTIONS`**. O preflight cai no `req.method !== "POST"` → `405` sem headers CORS → o browser aborta.
> **O botão "Enviar" por linha deve estar inoperante em produção.** Ver [[DT - Indice de Problemas Conhecidos|DT-D3]].

### `processar-timers-disparo` — timer de resposta
**Gatilho:** cron `0 * * * *`

`SELECT` membros `aguardando_resposta` com `prazo_resposta_limite < now` → `perdido / sem_resposta_no_prazo` + evento `timer_resposta_expirado`.

> [!note] Nota arquitetural deixada no próprio código
> O timer de **resultado** foi **deliberadamente removido** desta função e vive só em `verificar-vendas-disparo`, para não marcar perda de quem já comprou antes da sincronização do Tiny rodar. **O comentário pede explicitamente que não seja reintroduzido.** Respeitar.

### `verificar-vendas-disparo` — atribuição de venda
**Gatilho:** cron `30 * * * *` (30 min depois do timer, para dar tempo do incremental-sync)

1. Membros em `respondido_aguardando_resultado`
2. `timerExpirou = prazo_resultado_limite < agora`
3. `SELECT vendas_marketing` com `data_compra` entre `data_resposta` e `prazo_resultado_limite`
4. **Match por telefone em JavaScript**, normalizado dos dois lados
5. Achou → `ganho`, `valor_ganho = Σ valor_pedido`, `id_negocio_crm = numero_pedido` da mais antiga
6. Não achou + expirou → `perdido / prazo_resultado_expirado`

> [!danger] DOIS BUGS GRAVES AQUI
>
> **① Contradiz a própria especificação.** O cabeçalho afirma: *"enquanto o prazo não expirou, não faz nada — tenta de novo no próximo ciclo, mesmo que já exista uma venda registrada"*, justificando isso por querer **somar todas as compras da janela**. Mas o código avalia `if (vendasDoTelefone.length > 0)` **antes** de `if (!timerExpirou)`.
> **Resultado:** o membro é fechado como `ganho` no primeiro ciclo em que aparecer uma venda, e **todas as compras posteriores dentro dos 7 dias são perdidas** do `valor_ganho`. Receita e ROI ficam **subestimados**.
>
> **② Puxa `vendas_marketing` sem filtro de telefone no SQL.** Filtra só por data e faz o match em JS. Além de O(N×M), está sujeito ao **teto de ~1000 linhas do PostgREST**: numa loja com volume, as vendas do cliente podem simplesmente não vir no recorte, e o membro é fechado como **perdido tendo comprado**.
> Deveria ser `.eq('telefone_cliente', ...)` ou `.in()` sobre os telefones dos membros.

### `webhook-datacrazy-resposta`
Detalhado em [[INT - DataCrazy]].

---

## Padrões transversais (e o que falta)

| Aspecto | Estado |
|---|---|
| **CORS** | ❌ nenhuma function define headers |
| **Retry / dead-letter** | ❌ inexistente |
| **`try/catch` por item** | ❌ só `try` global em 2 funções |
| **`.limit()` nos loops de cron** | ❌ ausente — backlog grande estoura o wall-clock e o ciclo recomeça do zero |
| **Compare-and-swap no UPDATE** | ❌ ausente — risco de mensagem duplicada |
| **Log de execução em tabela** | ❌ inexistente (só `webhook_eventos_crm`, para o inbound) |
| **Erros visíveis** | ❌ acumulados em `erros[]` e devolvidos com HTTP 200; o `pg_cron` descarta a resposta |
| Validação de método | ⚠️ parcial (`disparar-membro-individual` e `verificar-vendas-disparo` sim; as outras não) |
| Guarda de idempotência por status | ✅ presente no webhook |
| Índices parciais para as queries de cron | ✅ bem desenhados |

> [!danger] Código duplicado entre functions
> `normalizarTelefone` está reimplementada em **4 functions + `src/lib/utils/phone.ts`**; `formatarTelefoneDataCrazy` em **3**; `addDiasUteisSemDomingo` em **3**.
> As regras hoje são equivalentes (`>= 12` vs `> 11`), mas **a atribuição de venda depende dos dois lados normalizarem igual** — uma divergência futura quebra silenciosamente. Extrair para `supabase/functions/_shared/`.

## Ver também

- [[BD - Cron e pg net]] · [[INT - Tiny ERP Olist]] · [[INT - DataCrazy]] · [[MM - Maquina de Estados do Disparo]]
