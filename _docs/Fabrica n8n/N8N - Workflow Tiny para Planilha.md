---
titulo: n8n — Workflow Tiny → Planilha (migração 1)
tipo: workflow
atualizado: 2026-08-13
tags: [n8n, tiny, google-sheets, workflow]
---

# 📥 Migração 1 — Tiny → Planilha COMPLETO

> [!abstract] O que faz
> Cada pedido criado **ou editado** no Tiny vira/atualiza uma linha de 49 colunas na aba **COMPLETO** da planilha *Integração Domoby - Tinny* (ID `1h0yvlKfWXdSte5rfFHAVNfVXMuloE3coe3TdTnkBopw`). Em produção desde 11/08/2026. Substituiu a automação equivalente do Plugga, que foi **desativada** (não apagada).

## A planilha — quem escreve o quê

| Aba | Origem | n8n mexe? |
|---|---|---|
| **COMPLETO** | única aba escrita pela automação — 49 colunas, 1 linha por pedido | **Sim** |
| DADOS | fórmula sobre COMPLETO (espelho + links Maps/WhatsApp + ITENS 1..9 via ARRAYFORMULA em `AO2`) | Não |
| OPERADORA | fórmula sobre DADOS (achata itens, marcador k/n) | Não |
| PCP | fórmula sobre OPERADORA + DADOS — lista de produção, 1 linha por unidade | Não |
| BACKUP | histórico congelado (4.490 linhas, sem cabeçalho) | Não |

As abas derivadas continuam funcionando sozinhas desde que as linhas entrem por baixo e os cabeçalhos não sejam renomeados.

## Os nós

```
Webhook Tiny → Normalizar evento → Inclusão ou atualização → Tiny · pedido.obter
                                                                    ↓
              Sheets · COMPLETO ← Mapear 49 colunas ← Retorno OK?
```

### 1 · Webhook Tiny
POST, path `dda37d71-027e-4766-963d-e86b1e015865` (o **mesmo UUID** que já estava no Tiny — a URL nunca mudou, não houve janela de corte). Respond: **Immediately** (`onReceived`) — o Tiny exige 200 ou reenvia até 10×.

> [!warning] O webhook não é assinado
> A única proteção é o path ser um UUID longo. E como o 200 é imediato, **o Tiny nunca reenvia** — se o processamento falhar depois, o evento só existe dentro da execução com erro do n8n (ver [[N8N - Incidente Credencial Google]]).

### 2 · Normalizar evento (Code)
Aceita o payload como JSON puro ou form-urlencoded e extrai `{tipo, id, numero, situacao, cnpj}`.

> [!danger] `dados.id` ≠ `dados.numero`
> `id` é o identificador interno do Tiny (vai na chamada da API). `numero` é o número do pedido que aparece na planilha (ex.: 13046). Confundir os dois já causou um teste errado.

```js
const saida = [];
for (const item of $input.all()) {
  let b = item.json.body ?? item.json;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) {} }
  if (b && typeof b.dados === "string") { try { b = JSON.parse(b.dados); } catch (e) {} }
  if (b && b.payload) b = b.payload;
  const d = b?.dados ?? {};
  saida.push({ json: {
    tipo: b?.tipo ?? "",
    id: d.id ?? "",
    numero: d.numero ?? "",
    situacao: d.codigoSituacao ?? "",
    cnpj: b?.cnpj ?? "",
  }});
}
return saida;
```

⚠️ **Nunca renomear este node** — os Codes dos ramos ClickUp/Trello o referenciam por nome (`$('Normalizar evento')`).

### 3 · Inclusão ou atualização de um pedido (IF)
`tipo` **contains** `_pedido` AND `id` is not empty. Passa `inclusao_pedido` **e** `atualizacao_pedido`.

> [!info] Decisão revista durante a implantação
> O plano original era só `inclusao_pedido` (réplica do Plugga). Foi mudado ao descobrir que o Plugga nunca atualizava linha — o caso do **pedido 13026** provou produção fabricando por medida errada (planilha dizia 136 cm, Tiny dizia 120). Consequências: pedido editado no Tiny atualiza a planilha sozinho, e `SITUAÇÃO` evolui de verdade (inclusive para Cancelado).

### 4 · Tiny · pedido.obter (HTTP Request)
POST `https://api.tiny.com.br/api2/pedido.obter.php`, form-urlencoded: `token`, `id={{ $json.id }}`, `formato=JSON`. Retry 3× / 5 s. `neverError: true`, timeout 20 s.
O webhook manda um payload enxuto (~8 das 49 colunas) — por isso esta segunda etapa é obrigatória.
⚠️ **Nunca renomear** — referenciado por nome nos ramos.

### 5 · Retorno OK? (IF)
`{{ $json.retorno.status }}` equals `OK`.

### 6 · Mapear 49 colunas (Code)
O coração. Verificado contra **1.982 pedidos reais**: 47 colunas 100% idênticas; as únicas divergências (SKU e QUANT. PRODUTOS) são casos em que **o n8n está certo e o Plugga errado**. Código completo em [[N8N - Codigo Mapear 49 Colunas]].

### 7 · Sheets · COMPLETO (Google Sheets)
| Campo | Valor |
|---|---|
| Credential | `Google Service Account account` |
| Operation | **Append or Update Row** |
| Column to match on | **`PEDIDO tiny`** |
| Cell Format | **Let Google Sheets Format** (`USER_ENTERED`) |
| Handling extra data | **Error** |
| Retry | 3× / 3 s |

> [!danger] Três resets conhecidos
> Trocar o **Document ID** ou a **credencial** reseta "Column to match on" e as Options. Sempre reconferir os três.
> **Cell Format = Raw** (o padrão!) gravaria o apóstrofo de blindagem literalmente na célula.

## As decisões de dados (o porquê)

- **`USER_ENTERED` + apóstrofo inicial** nas colunas de risco: no modo USER_ENTERED o Sheets consome o apóstrofo e trata o valor como texto literal. Resolve ao mesmo tempo: `1, 1, 1` virando data, SKU `061` perdendo o zero, e DATA/PREVISÃO continuando datas nativas.
- **Uma linha por pedido, itens concatenados**, todas as 49 colunas na saída (inclusive as mortas) — para não quebrar fórmula existente.
- **Sem fallback de endereço de entrega** — o Plugga deixa vazio quando não há; replicado.
- `TOTAL` = `TOTAL 2` = `total_pedido` (líquido); `VALOR TOTAL` = `total_produtos` (bruto). Em pedidos < 11.000 a relação era outra — cuidado ao analisar histórico.

## Bugs do Plugga que esta migração corrigiu

| Bug | Escala |
|---|---|
| SKU perdia zeros à esquerda (`061` → `61`) | 160 de 1.982 pedidos (8,1%) |
| QUANT. PRODUTOS corrompida como data (`1, 1, 1` → `1, 1, 2001`) | 95 de 107 pedidos de 3 itens |
| Linha nunca atualizada (SITUAÇÃO congelada, rastreio 100% vazio, edição no Tiny ignorada) | caso provado: pedido 13026 |

## ↪️ 01/10/2026 — passar o número do cadastro do cliente ao banco (SESSAO-29, D-98) — A COLAR PELO DONO

O aviso de venda traz `dados.idContato` (o cadastro do cliente no Tiny) e o `pedido.obter` **não** traz (A-43). O banco já aceita o número desde a migration 49 (`fn_upsert_pedido(..., p_tiny_id_contato)`); falta o fluxo repassar. No n8n, fluxo **"Principal - Tiny → planilha / banco / clickup / trello"** — **sem renomear nenhum nó**:

1. **"Normalizar evento"** (Code): logo **abaixo** da linha `cnpj: b?.cnpj ?? "",` acrescentar:
   ```js
   id_contato: d.idContato ?? "",
   ```
2. **"Montar payload Supabase"** (Code): logo **abaixo** da linha `p_origem: 'webhook',` acrescentar:
   ```js
   p_tiny_id_contato: Number(ev.id_contato) || null,
   ```
3. **"Supabase · upsert pedido"** (HTTP): o campo JSON do corpo (em modo *Expression*) passa a ser — **sem `=` na frente** (o `=` só existe no JSON exportado; colado no editor viraria texto e quebraria o corpo):
   ```
   {{ JSON.stringify({ p: $json.p, p_tipo: $json.p_tipo, p_tiny_id: $json.p_tiny_id, p_origem: $json.p_origem, p_tiny_id_contato: $json.p_tiny_id_contato }) }}
   ```
4. Salvar e publicar. Conferência: no próximo pedido, `clientes.tiny_id_contato` do cliente preenchido (cliente novo nasce com ele); na execução do n8n, o corpo do nó 3 mostra `p_tiny_id_contato` com número.

> Conferido com o espelho do cofre (o nó 2 e o 3 em `Supabase-fabrica/n8n-ramo-supabase.json`; o nó 1 na seção 2 acima). O n8n pediu login no navegador do app em 01/10 à noite — o objeto vivo NÃO foi conferido (A-44); se o código do nó estiver diferente, o dono manda print e o trecho é ajustado.

Se o aviso não trouxer o número (vazio/0), vai nulo e o banco segue pelos outros caminhos (CPF → o cliente que o pedido já tem → nome+fone) — nada quebra.

## Ver também

[[N8N - Visao Geral da Migracao]] · [[N8N - Codigo Mapear 49 Colunas]] · [[N8N - Incidente Credencial Google]] · [[N8N - API Tiny v2 vs v3]]
