---
titulo: n8n — ROTAS ClickUp (migração 2)
tipo: workflow
atualizado: 2026-08-13
tags: [n8n, clickup, rotas, logistica]
---

# 🚚 Migração 2 — Pedido → Tarefa de ROTA no ClickUp

> [!abstract] O que faz
> Cada pedido **novo** no Tiny vira uma tarefa na lista **ROTAS** (`DOMOBY → DPTO LOGÍSTICA → DPTO LOGÍSTICA → ROTAS`), status `a fazer`, com os dados de entrega na descrição. Em produção desde 12/08/2026. Substituiu a automação `ROTAS CLICKUP` do Plugga (desativada).

## O formato do card — herdado do Trello, não do Plugga

O Plugga gravava só o link do WhatsApp na descrição. O usuário pediu o **estilo do card antigo do Trello** (o sistema de rotas mudou; o Trello saiu de uso para rotas). Template confirmado contra o card real do pedido 12878:

```
Título: {pedido} - {bairro entrega} - {bairro} - {previsão}   ← "limpo": campos vazios não deixam traço solto

{nome}
CPF: {cpf}
Endereço: {endereço}, {número}
{bairro}, {cidade}-{UF}
Complemento: {complemento}          ← enriquecido (decisão do usuário)
CONTATO:
{telefone}
wa.me/55{telefone só dígitos}
MAPA:
https://www.google.com/maps/search/{endereço URL-encoded}

OBS:
{obs do pedido}                     ← enriquecido (decisão do usuário)
```

Decisões registradas: nome **limpo** (o bairro de entrega está vazio em 461 de 469 linhas — 98% — e o formato antigo deixava `- -` solto); **Complemento e OBS incluídos** (ajudam o entregador e evitam erro de cobrança na porta).

## A cadeia

```
Sheets · COMPLETO → Montar tarefa ClickUp (Code) → ClickUp · Criar tarefa
```

### Por que o Code lê da API e não da planilha
A saída do `Mapear 49 colunas` tem **apóstrofo de blindagem** (`'1397`) nas colunas de risco — apareceria no card. O Code lê `$('Tiny · pedido.obter')`, o dado cru.

### A trava anti-duplicação — dentro do Code, sem IF
Primeira tentativa foi um node IF (`tipo` equals `inclusao_pedido`) — **caía sempre no false** mesmo com o dado certo (provável espaço invisível ou quebra de linha no editor de expressão). Solução: a checagem foi para dentro do Code. `return []` → o node seguinte simplesmente não roda.

> [!tip] Lição
> Lógica condicional no editor de expressões falha em silêncio. Quando a condição está ao lado de um Code node, colocá-la **dentro** do Code.

Verificado nas duas direções em 12/08: `inclusao_pedido` cria; `atualizacao_pedido` devolve `[]` e o ClickUp mostra *"Node was not executed"* — **que não é erro**, é o esperado.

### Código do node "Montar tarefa ClickUp" (Run Once for All Items)

```js
// Monta a tarefa do ClickUp a partir do retorno cru da API do Tiny.
// Não usa a saída da planilha — lá os valores têm apóstrofo de blindagem.

// --- trava: só cria tarefa em pedido NOVO. Editado no Tiny não vira card. ---
const tipo = $('Normalizar evento').first().json.tipo;
if (tipo !== 'inclusao_pedido') return [];

let p = {};
try {
  p = $('Tiny · pedido.obter').first().json?.retorno?.pedido ?? {};
} catch (e) {
  p = $('Tiny - pedido.obter').first().json?.retorno?.pedido ?? {};
}

const cli = p.cliente || {};
const ent = p.endereco_entrega || {};

const t = (v) => (v === null || v === undefined ? '' : String(v).trim());

const bairro    = t(cli.bairro);
const bairroEnt = t(ent.bairro);

// --- PREVISÃO: dd/mm/yyyy -> ISO. 12:00 em Fortaleza (UTC-3) = 15:00 UTC.
// Fixar meio-dia evita o ClickUp exibir o dia anterior por arredondamento de fuso.
const prev = t(p.data_prevista);
let dueISO = '';
if (/^\d{2}\/\d{2}\/\d{4}$/.test(prev)) {
  const [d, m, y] = prev.split('/').map(Number);
  dueISO = new Date(Date.UTC(y, m - 1, d, 15, 0, 0)).toISOString();
}

// --- NOME: ordem do Trello, sem traços soltos quando um campo está vazio.
const nomeTarefa = [t(p.numero), bairroEnt, bairro, prev].filter(Boolean).join(' - ');

// --- LINKS (mesma regra das fórmulas da aba DADOS) ---
const digitos = t(cli.fone).replace(/\D/g, '');
const whats   = digitos ? 'wa.me/55' + digitos : '';

const enderecoBusca = [t(cli.endereco), t(cli.numero), bairro, t(cli.cidade), t(cli.uf)]
  .filter(Boolean).join(' ');
const maps = enderecoBusca
  ? 'https://www.google.com/maps/search/' + encodeURIComponent(enderecoBusca)
  : '';

// --- DESCRIÇÃO: layout do card do Trello ---
const L = [];
L.push(t(cli.nome));
if (t(cli.cpf_cnpj)) L.push('CPF: ' + t(cli.cpf_cnpj));
L.push('Endereço: ' + [t(cli.endereco), t(cli.numero)].filter(Boolean).join(', '));
L.push([bairro, [t(cli.cidade), t(cli.uf)].filter(Boolean).join('-')].filter(Boolean).join(', '));

if (t(cli.complemento)) L.push('Complemento: ' + t(cli.complemento));

// endereço de entrega, quando existir
if (t(ent.endereco)) {
  L.push('');
  L.push('ENTREGA:');
  L.push([t(ent.endereco), t(ent.numero)].filter(Boolean).join(', '));
  L.push([bairroEnt, [t(ent.cidade), t(ent.uf)].filter(Boolean).join('-')].filter(Boolean).join(', '));
}

L.push('CONTATO:');
if (t(cli.fone)) L.push(t(cli.fone));
if (whats) L.push(whats);
L.push('MAPA:');
if (maps) L.push(maps);

if (t(p.obs)) { L.push(''); L.push('OBS:'); L.push(t(p.obs)); }

return [{ json: {
  nomeTarefa,
  descricao: L.join('\n'),
  dueDate: dueISO,
  pedido: t(p.numero),
}}];
```

### Node "ClickUp · Criar tarefa"

| Campo | Valor |
|---|---|
| Resource / Operation | Task / Create |
| Team · Space · Folder · List | `DOMOBY` · `DPTO LOGÍSTICA` · `DPTO LOGÍSTICA` · `ROTAS` |
| Name | `{{ $json.nomeTarefa }}` |
| Content | `{{ $json.descricao }}` |
| Due Date | `{{ $json.dueDate }}` (ISO string — **não** epoch) |
| Due Date Time | desligado |
| Status | `a fazer` |
| Retry | 3× / 3 s |

PREVISÃO vazia (21 de 469 linhas) → `dueDate` sai `''` e o campo não é enviado.

## Teste que validou (12/08)

Pedido 13046 → tarefa `86ajzfpbg`, nome `13046 - Alecrim - 13/08/2026`, data exibida **qui 13/08** (fuso correto). Card mantido — o caça-duplicatas confirmou que o Plugga não tinha criado o dele.

## Pinned data — como testar sem tocar produção

O teste da trava usou **Edit Output** no `Normalizar evento`, que cria *pinned data* (não altera o código). **Pinned data só vale em execução manual — produção ignora e roda o node de verdade.** Depois do teste, **despinar** (ícone 📌 no painel OUTPUT, ou tecla `p`) e salvar, senão todo teste manual futuro devolve o mesmo pedido antigo.

## Ver também

[[N8N - Visao Geral da Migracao]] · [[N8N - PCP Trello e ClickUp]] · [[FAB - Estrutura de Producao (Trello e ClickUp)]]
