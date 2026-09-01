---
titulo: Backfill histórico do Tiny → Supabase
tipo: automacao
atualizado: 2026-08-28
tags: [n8n, tiny, supabase, backfill, historico]
---

# 📦 Backfill histórico do Tiny → Supabase

> [!abstract] Em uma frase
> Trazer **todo o histórico da Domoby desde 12/03/2025** — pedidos, contatos,
> notas fiscais e contas a receber — da API v2 do Tiny para o Supabase da
> fábrica, numa fila auto-expansível que o n8n consome no ritmo que quiser,
> pode pausar a qualquer momento e retoma exatamente de onde parou.

**Iniciado em:** 28/08/2026, 23h — janela sem venda/produção até 29/08 às 8h,
com o domingo inteiro de folga se precisar.
**Migration:** 22 (aplicada em 28/08/2026)

> [!important] Isto substitui a FASE 2 de [[N8N - Migracao Supabase]]
> Aquele plano era reconstruir o histórico a partir do **CSV das abas COMPLETO
> e BACKUP** — o que deixava `tiny_id` NULL para sempre, herdava os 160 SKUs sem
> zero e as 91 quantidades corrompidas (P10), e não trazia NF nem financeiro.
> Puxar da API resolve os quatro de uma vez: o `tiny_id` vem, o SKU vem em
> texto certo, a quantidade vem do payload, e `raw` guarda o pedido inteiro.
> **O CSV não é mais necessário.**
>
> Situação encontrada em 28/08: `pedidos` tinha **159 linhas**, todas de
> 10/07/2026 em diante e todas `origem='webhook'`. A FASE 2 nunca chegou a
> rodar — o banco começa do zero.

---

## 1 · O bloqueio que quase passou batido

O gatilho `plt_pedidos_reagir` cria um **card no PCP a cada INSERT em
`pedidos`** (D-31, SESSAO-09). Sem guarda, a carga de ~5.100 pedidos
históricos criaria ~5.100 cards no kanban da Plataforma — que hoje tem 159.

> [!danger] Regra permanente (D-43)
> **Histórico não vira trabalho de produção.** Só entra no quadro o pedido que
> chega pelo webhook (`origem = 'webhook'`) **e** cuja situação ainda está
> viva. Pedido `entregue`, `nao_entregue` ou `cancelado` nunca nasce card,
> venha de onde vier.

Como foi feito: o corpo de `plt_privado.fn_reagir_pedido()` **não foi tocado**
— ele é do repo (migrations 18/21) e reescrevê-lo aqui criaria divergência
entre o banco e o código do Claude Code. A guarda entrou na **cláusula `WHEN`
do gatilho**, que o Postgres avalia antes de chamar a função:

```sql
drop trigger if exists plt_pedidos_reagir on public.pedidos;

create trigger plt_pedidos_reagir_insercao
  after insert on public.pedidos for each row
  when (new.origem is not distinct from 'webhook'
        and lower(coalesce(new.situacao,'')) not in ('entregue','nao_entregue','cancelado'))
  execute function plt_privado.fn_reagir_pedido();

create trigger plt_pedidos_reagir_atualizacao
  after update on public.pedidos for each row
  execute function plt_privado.fn_reagir_pedido();
```

São **dois** gatilhos porque `tg_op` não existe dentro de um `WHEN` — e UPDATE
nunca cria card mesmo, então só o INSERT precisa da guarda.

⚠️ **Para o Claude Code:** se uma migration futura recriar o gatilho
`plt_pedidos_reagir`, a guarda some. A migration 22 do repo tem que espelhar
os dois gatilhos acima.

---

## 2 · A arquitetura: uma fila que se planta sozinha

O problema de fazer isso "na mão" no n8n é a paginação: não dá pra saber
quantas páginas existem antes de pedir a primeira. A solução é não paginar em
loop de workflow — **a fila cresce sozinha**.

```
tiny_fila (61 linhas na semeadura)
   │
   ├─ pedidos_pesquisa 2025-01:p1 ──► worker chama pedidos.pesquisa.php
   │        └─ resposta: 100 pedidos + numero_paginas=3
   │              ├─► enfileira 100 × recurso 'pedido'      (prioridade 2)
   │              └─► enfileira 'pedidos_pesquisa 2025-01:p2' (prioridade 1)
   │
   └─ pedido 1053632359 ──────────► worker chama pedido.obter.php
            └─► fn_upsert_pedido(payload, 'backfill', id, 'backfill')
```

O worker é **um só** e não sabe nada de negócio: ele pega o próximo lote,
monta a chamada certa pelo campo `recurso`, e devolve o resultado para uma das
duas RPCs. Todo o resto é banco.

### Ordem de trabalho (campo `prioridade`)

| Prio | Recurso | Endpoint v2 | Vira |
|---|---|---|---|
| 1 | `pedidos_pesquisa` | `pedidos.pesquisa.php` | itens `pedido` + próxima página |
| 2 | `pedido` | `pedido.obter.php` | `pedidos` + `pedido_itens` + `clientes` |
| 3 | `contatos_pesquisa` | `contatos.pesquisa.php` | itens `contato` + próxima página |
| 4 | `contato` | `contato.obter.php` | enriquece `clientes` (+ `clientes.raw`) |
| 5 | `nf_pesquisa` | `notas.fiscais.pesquisa.php` | itens `nota_fiscal` + próxima página |
| 6 | `nota_fiscal` | `nota.fiscal.obter.php` | `notas_fiscais` |
| 7 | `cr_pesquisa` | `contas.receber.pesquisa.php` | itens `conta_receber` + próxima página |
| 8 | `conta_receber` | `conta.receber.obter.php` | `contas_receber` |

A fila sai sempre por `(prioridade, id)`. Consequência desejada: **os pedidos
terminam primeiro** (é o que mais importa), e NF e financeiro chegam depois —
quando os pedidos já existem, então o vínculo por `numero_pedido` acha o
`pedido_id` na hora de gravar.

### Por que é seguro parar no meio

- `fn_fila_proximos` **reserva** o lote (`status = 'processando'`) com
  `for update skip locked` — duas execuções sobrepostas nunca pegam a mesma linha.
- Execução que morre no meio devolve o lote sozinha depois de **15 minutos**.
- Erro volta pra fila e tenta de novo até **4 vezes**; depois vira `status = 'erro'`
  com a mensagem guardada, e a fila segue sem travar.
- Código de erro **20** (consulta sem registros) e **32** (registro não
  localizado) são tratados como fim de linha, não como falha — não gastam
  tentativa à toa.
- Desligar o workflow no n8n **é** o botão de pausa. Ligar de novo é o retomar.

---

## 3 · O banco (migration 22)

### `tiny_fila` — a fila

| Coluna | Observação |
|---|---|
| `recurso` | um dos 8 da tabela acima |
| `chave` | id interno do Tiny, ou o rótulo da janela (`2025-03:p2`) |
| `referencia` | nº do pedido/NF/nome — só leitura humana |
| `params` | `{dataInicial, dataFinal, pagina, janela}` das buscas |
| `prioridade` | 1 a 8 |
| `status` | `pendente` · `processando` · `ok` · `erro` · `vazio` |
| `tentativas` / `erro` | diagnóstico |
| `reservado_em` / `processado_em` | timestamps |

Único em `(recurso, chave)` — reenfileirar o mesmo id não duplica nada.

### Destinos

- **`pedidos` / `pedido_itens` / `clientes`** — já existiam. A porta continua
  sendo `fn_upsert_pedido`, chamada com `p_origem = 'backfill'`. O `coalesce`
  dela garante que **a carga não apaga nada** que o webhook já tinha gravado.
- **`clientes`** ganhou `raw`, `tipo_pessoa`, `inscricao_estadual`, `fantasia`.
- **`notas_fiscais`** — nova. Chave `tiny_id`, ligação por `numero_pedido` → `pedido_id`.
- **`contas_receber`** — nova. Idem, mais `data_vencimento`, `data_liquidacao`, `saldo`, `situacao`.

Todas com RLS ligado e zero policies — padrão da casa, só `service_role` acessa.
Todas guardam o payload cru em `raw`: **nada do que o Tiny devolveu se perde**,
mesmo o que hoje não tem coluna.

### As três portas do n8n

| Função | Faz |
|---|---|
| `fn_fila_proximos(p_limite)` | reserva e devolve o próximo lote |
| `fn_backfill_aplicar(p_fila_id, p_recurso, p_payload)` | grava (ou enfileira) e fecha a linha |
| `fn_backfill_falha(p_fila_id, p_erro, p_terminal)` | devolve pra fila ou encerra |

O n8n não conhece nenhuma tabela. Ele chama três funções e pronto.

---

## 4 · O workflow n8n

**Arquivo:** `domoby-backfill-tiny.json` · 8 nós, uma linha reta.

```
Cada minuto → Config → Fila·reservar lote → Normalizar lote
           → Montar requisicao Tiny → Tiny·API v2 → Interpretar resposta → Supabase·gravar
```

| Nó | O que faz |
|---|---|
| **Cada minuto** | Schedule Trigger, 1 min |
| **Config** | só `limite` do lote (30) — o único botão de ajuste |
| **Fila · reservar lote** | RPC `fn_fila_proximos` |
| **Normalizar lote** | 1 item por linha da fila (aguenta as 3 formas de resposta) |
| **Montar requisicao Tiny** | monta `url` + `corpo` form-urlencoded cru, **sem o token** |
| **Tiny · API v2** | POST, **batching 1 requisição a cada 1.800 ms**, `neverError` |
| **Interpretar resposta** | traduz para `{rpc, body}` — a única lógica de negócio |
| **Supabase · gravar** | POST `/rest/v1/rpc/{{ $json.rpc }}` |

### Credenciais: nenhuma. Só as variáveis que já existem.

Segue o padrão da casa, igual ao `n8n-ramo-supabase.json` e ao workflow da
GreenPallets — **zero credencial para configurar, zero segredo no JSON**:

| Variável | Onde é usada | Já existe? |
|---|---|---|
| `SUPABASE_FABRICA_URL` | URL dos dois nós de RPC | ✅ (Migração Supabase) |
| `SUPABASE_FABRICA_KEY` | headers `apikey` e `Authorization: Bearer` | ✅ |
| `TINY_TOKEN` | prefixo do corpo do nó Tiny | ⚠️ **conferir — é o passo 1 do P4** |

> [!tip] Por que não o nó nativo do Supabase
> Ele tem 5 ações, todas de linha de tabela (Create / Delete / Get / Get many /
> Update) — **não chama função**. E aqui tudo é função: `fn_upsert_pedido` é a
> porta única de escrita, `fn_fila_proximos` precisa de `FOR UPDATE SKIP LOCKED`
> (impossível com "Update a row" — duas execuções pegariam o mesmo pedido), e
> `fn_backfill_aplicar` grava o dado **e** fecha a linha da fila na mesma
> transação. O "custom Supabase API call" do painel do nó é justamente um HTTP
> Request — que é o que está aqui, com os headers explícitos da casa.

> [!warning] P4 — o token do Tiny
> O nó usa `{{ $env.TINY_TOKEN }}`, e o Code node **não** enxerga o token: quem
> prefixa `token=` é a expressão do próprio nó HTTP, resolvida na hora do
> request. Assim o segredo não aparece nem no dado de execução salvo.
> Conferir antes de rodar:
> ```bash
> docker exec n8n-n8n-1 printenv | grep -E "TINY_TOKEN|SUPABASE_FABRICA"
> ```
> Se `TINY_TOKEN` não aparecer, é o passo 1 do P4 — adicionar ao bloco
> `environment:` do `/docker/n8n/docker-compose.yml` e `docker compose down &&
> docker compose up -d`. A janela sem venda é a hora certa, e isso destrava os
> passos 2 e 3 do P4 (trocar os 3 nós com token literal e regerar o token).

> [!info] O aviso vermelho no editor é cosmético
> Campos com `{{ $env.* }}` mostram `[ERROR: not accessible via UI, please run
> node]`. O navegador não tem acesso às variáveis do servidor — em execução
> resolve normal. Vale para todo nó que usa `$env`.

> [!warning] O ritmo é o `batchInterval`, não o schedule
> `batchSize: 1` + `batchInterval: 1800` = **~33 req/min**. Com `limite = 30`,
> cada execução leva ~54 s e o próximo minuto já está livre.
> O plano Impulsione dá **60/min**: sobra metade da cota para o webhook de
> vendas que continua rodando em paralelo o tempo todo. Para acelerar, baixe o
> intervalo; para aliviar, suba. **Nunca passe de ~55/min.**

**Corpo como string única, NÃO como `raw`.** O nó HTTP do n8n muda o nome do parâmetro
conforme `contentType` + `specifyBody`, e form-urlencoded montado por ele já
deu dor de cabeça antes. O Code node monta a string `token=...&formato=JSON&id=...`
e o nó só entrega. Sem ambiguidade.

**Nenhum segredo no JSON.** O token do Tiny é digitado no nó Config depois de
importar; o Supabase entra pela credencial `Supabase API` do próprio n8n
(host + service_role), que injeta `apikey` e `Authorization` sozinha.

---

## 5 · Operação

### Instalar
1. No VPS: `docker exec n8n-n8n-1 printenv | grep -E "TINY_TOKEN|SUPABASE_FABRICA"`.
   Faltando `TINY_TOKEN` → adicionar no `environment:` do compose e reiniciar (P4).
2. n8n → **Import from File** → `domoby-backfill-tiny.json`
3. **Não há credencial para escolher e nada para preencher.** Se quiser mudar o
   ritmo, só o campo `limite` do nó **Config**.
4. **Execute Workflow** uma vez à mão e conferir o painel (abaixo)
5. **Activate** — daí em diante roda sozinho de minuto em minuto

### Pausar / retomar
Desativar o workflow. O que estava reservado volta para `pendente` sozinho em
15 min. Reativar continua exatamente de onde parou.

### Painel de acompanhamento

```sql
select recurso, status, count(*),
       min(processado_em) as primeiro, max(processado_em) as ultimo
  from tiny_fila group by 1,2 order by 1,2;

select count(*) filter (where status='pendente')    as na_fila,
       count(*) filter (where status='ok')          as prontos,
       count(*) filter (where status='erro')        as com_erro,
       round(count(*) filter (where status='pendente') / 33.0) as minutos_restantes
  from tiny_fila;

select recurso, erro, count(*) from tiny_fila
 where status='erro' group by 1,2 order by 3 desc;
```

### Reprocessar de propósito

```sql
-- um recurso inteiro
update tiny_fila set status='pendente', tentativas=0, erro=null
 where recurso='conta_receber';

-- só o que deu erro
update tiny_fila set status='pendente', tentativas=0, erro=null where status='erro';

-- um pedido específico
update tiny_fila set status='pendente', tentativas=0 where recurso='pedido' and chave='1053632359';
```

### Semear uma janela nova (ex.: se surgir mês faltando)

```sql
insert into tiny_fila (recurso, chave, prioridade, params) values
 ('pedidos_pesquisa','2026-09:p1',1,
  '{"dataInicial":"01/09/2026","dataFinal":"30/09/2026","pagina":1,"janela":"2026-09"}')
on conflict do nothing;
```

---

## 6 · Semeadura inicial (28/08/2026)

61 linhas: **20 janelas mensais** de 01/2025 a 08/2026 × 3 recursos com filtro
de data (pedidos, NF, contas a receber) + 1 primeira página de contatos.

Começa em **janeiro de 2025**, não em março: são 6 requisições a mais e
provam que não existe nada antes de 12/03/2025 em vez de assumir.

**Volume esperado** (estimado do numeramento: 12711→13224 em 49 dias ≈ 10,5
pedidos/dia; 4.943 linhas na planilha COMPLETO+BACKUP em 11/08):

| Recurso | Chamadas estimadas |
|---|---|
| Buscas (todas as páginas) | ~250 |
| `pedido.obter` | ~5.100 |
| `contato.obter` | ~2.000 |
| `nota.fiscal.obter` | ≤ 5.100 |
| `conta.receber.obter` | ~10.000 (1 por parcela) |
| **Total** | **~20.000 → ~11 h a 30/min** |

---

## 7 · O que ainda não é certeza

1. **Nome dos parâmetros de data** em `contas.receber.pesquisa.php` e
   `notas.fiscais.pesquisa.php`. A doc v2 não é explícita. Se o filtro for
   ignorado, as janelas mensais devolvem tudo — sem estrago (a fila é única em
   `(recurso, chave)`), só gasta algumas buscas à toa. **Conferir na primeira
   página processada de cada um.**
2. **A chave do array na resposta** de NF e contas a receber. O Code node não
   confia em nome: pega a primeira chave de `retorno` que é array e desembrulha
   o objeto de dentro. Funciona para os quatro formatos.
3. **A situação real dos pedidos antigos no Tiny.** A automação ROTAS →
   `entregue` só existe desde 17/08/2026. É bem possível que milhares de
   pedidos entregues fisicamente estejam parados como `aberto` ou `aprovado`
   no ERP. Isso **não** afeta a carga (a guarda D-43 barra tudo que é
   `origem <> 'webhook'`), mas afeta o cofre de Pedidos entregues: se ele
   filtrar por `situacao = 'entregue'`, pode mostrar bem menos do que a
   realidade. **Decidir depois de ver a distribuição real:**

```sql
select situacao, count(*), min(data_pedido), max(data_pedido)
  from pedidos group by 1 order by 2 desc;
```

---

## 8 · Ver também

[[SUPA - Esquema do Banco]] · [[N8N - API Tiny v2 vs v3]] ·
[[N8N - Tiny Integracoes Referencia]] · [[N8N - Migracao Supabase]] ·
[[PLT - Decisoes de Produto]] (D-43)


---

## 9 · Lições da implantação

**1. `contentType: 'raw'` no HTTP Request quebra o parse da resposta.**
Descoberto na primeira execução (28/08, 23h): o nó devolveu um objeto de stream
do Node (`_readableState`, `_handle`, buffers) em vez do JSON do Tiny. Não era o
`responseFormat` — é o `HttpRequestV3.node.js`:

```js
else if (bodyContentType === 'raw') {
    requestOptions.json = false;
    requestOptions.useStream = true;   // ← devolve o stream cru
}
else {
    requestOptions.json = true;        // ← todos os outros parseiam
}
```

**A escolha certa para corpo dinâmico em form-urlencoded** é
`Body Content Type = Form Urlencoded` + `Specify Body = Using Single Field`
(`specifyBody: "string"`), com o campo **Body** recebendo a query string pronta
(`campo1=valor1&campo2=valor2`). O n8n faz
`Object.fromEntries(new URLSearchParams(body))` e segue pelo caminho normal, com
`json = true`. É o que os workflows em produção da casa fazem por keypair — só
que assim os campos podem mudar a cada item.

**Regra:** `raw` só quando você realmente quer o corpo intocado e vai tratar o
stream. Para qualquer coisa que espera JSON de volta, nunca.

**2. A primeira resposta do Tiny estava certa o tempo todo.**
Decodificando o buffer do stream: `codigo_erro 20, "A consulta não retornou
registros"` para a janela de janeiro/2025 — exatamente o esperado, já que o
histórico começa em 12/03/2025. O token e os parâmetros estavam corretos desde
o primeiro disparo.
