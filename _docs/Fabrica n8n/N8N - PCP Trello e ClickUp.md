---
titulo: n8n — PCP Trello e ClickUp (migrações 3 e 4)
tipo: workflow
atualizado: 2026-08-13
tags: [n8n, trello, clickup, pcp, producao]
---

# 🏭 Migrações 3 e 4 — Pedido → Cards de produção (PCP)

> [!abstract] O que fazem
> Cada pedido **novo** no Tiny vira **um card por unidade a produzir** em dois destinos ao mesmo tempo: a lista **PEDIDO** do quadro Trello `1 - PCP` e a lista **PCP** do ClickUp (`DOMOBY → DPTO PRODUÇÃO → DPTO PRODUÇÃO → PCP`, status `pedido`). Em produção desde 12/08/2026. Substituíram duas automações do Plugga (`PCP - DOMMOBY 02` para o Trello e a equivalente do ClickUp), ambas desativadas.
>
> O Trello sairá de uso no futuro — quando sair, basta **apagar o ramo do Trello** sem tocar no resto.

## A diferença fundamental — a PCP é por UNIDADE

As migrações 1 e 2 eram *uma linha por pedido*. Aqui é **uma linha por unidade**: 758 linhas para 468 pedidos na base analisada. Formato do nome:

```
{pedido} - {descrição do item} ({k}/{n})

13046 - Estante semi-colmeia - Branca - 90 x 182 x 30 (1/1)
12587 - Mesa executiva industrial - Base preta e tampo freijó - 136 x 75 x 60 (1/2)
12587 - Mesa executiva industrial - Base preta e tampo freijó - 136 x 75 x 60 (2/2)
```

`n` = quantas vezes o texto aparece **dentro do pedido** (o número do pedido prefixa a string, então o COUNTIF da planilha nunca colide entre pedidos — é isso que permite calcular no n8n sem ler a planilha). 169 das 758 linhas têm `n > 1`.

## Por que os cards duplicavam

Relatado em 12/08: cards duplicados no quadro, sem saber quais.

A aba PCP é 100% fórmula e **posicional**. Pedido antigo editado → a cadeia COMPLETO → DADOS → OPERADORA → PCP recalcula → as linhas abaixo **deslizam** → o gatilho "a cada linha criada/atualizada" do Plugga (que observa posição, não conteúdo) vê dezenas de linhas "novas".

> [!warning] A migração 1 agravou isso
> Até ela, edição de pedido nunca chegava na planilha. Ligar o `atualizacao_pedido` passou a mexer na PCP várias vezes ao dia. **Qualquer automação do Plugga ainda ligada com gatilho em DADOS, OPERADORA ou PCP está duplicando.**

A migração resolve pela raiz: os cards nascem do **evento do pedido**, uma vez, no `inclusao_pedido`. O recálculo da planilha vira irrelevante.

> [!info] O "Criar e atualizar" do ClickUp no Plugga era ilusório
> A chave de casamento era o nome da tarefa — que muda quando o item muda. "Atualização" virava tarefa nova. Era parte do problema, não a solução.

## A arquitetura — ramos paralelos

```
Sheets · COMPLETO ─┬─→ Montar tarefa ClickUp → ClickUp · Criar tarefa      (ROTAS)
                   └─→ Montar cards PCP ─┬─→ Criar Card PCP Trello
                                         └─→ Criar card PCP - clickup
```

> [!danger] Nunca encadear os destinos em série
> A primeira tentativa ligou o ClickUp **na saída do Trello**. Quebra duplo: o ClickUp passaria a receber o objeto do card do Trello (então `{{ $json.nomeCard }}` vem vazio), e falha no Trello impediria o ClickUp. Em paralelo, cada destino lê o mesmo item do Code e falha isolado.

## Verificação — 758/758

Antes de escrever o node, o algoritmo foi rodado offline contra a aba PCP inteira: **758 linhas geradas, 758 reais, 0 diferenças** — incluindo as 169 com `n > 1` e o pedido 12787 (11 unidades, duas linhas idênticas).

> [!danger] Duas armadilhas que a conferência revelou
> 1. **O `ARRUMAR` do Sheets colapsa espaços internos**, não só as pontas: `TRAMONTINA  (8und)` → `TRAMONTINA (8und)`. Sem `replace(/\s+/g, ' ')`, 48 nomes sairiam diferentes.
> 2. **Item com quantidade 0 não vira card** (pedido 12591 tem um). Um `Math.max(1, qtd)` ingênuo criaria card fantasma.

## Código do node "Montar cards PCP" (Run Once for All Items)

```js
// Gera uma linha por UNIDADE a produzir, no formato exato da aba PCP.
// Nome do card = "{pedido} - {descrição} (k/n)"
// Verificado contra as 758 linhas da PCP: 100% idêntico.

const tipo = $('Normalizar evento').first().json.tipo;
if (tipo !== 'inclusao_pedido') return [];

let p = {};
try {
  p = $('Tiny · pedido.obter').first().json?.retorno?.pedido ?? {};
} catch (e) {
  p = $('Tiny - pedido.obter').first().json?.retorno?.pedido ?? {};
}

// ARRUMAR do Sheets colapsa espaços internos, não só as pontas.
const norm = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

const pedido = norm(p.numero);
if (!pedido) return [];

// data de entrega: dd/mm/yyyy -> ISO, meio-dia em Fortaleza
const prev = norm(p.data_prevista);
let dueISO = '';
if (/^\d{2}\/\d{2}\/\d{4}$/.test(prev)) {
  const [d, m, y] = prev.split('/').map(Number);
  dueISO = new Date(Date.UTC(y, m - 1, d, 15, 0, 0)).toISOString();
}

// expande cada item pela quantidade -> uma entrada por unidade
const lista = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const unidades = [];
for (const raw of lista(p.itens)) {
  const i = raw.item || raw;
  const qtd = Math.round(parseFloat(String(i.quantidade ?? '0').replace(',', '.')) || 0);
  if (qtd < 1) continue;                        // item com quantidade 0 não vira card
  const base = `${pedido} - ${norm(i.descricao)}`;
  for (let k = 0; k < qtd; k++) unidades.push(base);
}

// marcador (k/n): n = quantas vezes aquele texto aparece dentro do pedido
const total = {};
for (const u of unidades) total[u] = (total[u] || 0) + 1;

const visto = {};
return unidades.map((u) => {
  visto[u] = (visto[u] || 0) + 1;
  return { json: {
    nomeCard: `${u} (${visto[u]}/${total[u]})`,
    dueDate: dueISO,
    pedido,
  }};
});
```

## Os dois nodes de destino

### Criar Card PCP Trello
| Campo | Valor |
|---|---|
| Resource / Operation | Card / Create |
| List ID | `673cbd3e94b20183518c97ff` (lista PEDIDO do quadro `1 - PCP`, board `673cbce83cb8fa23c48f9bfa`) |
| Name | `{{ $json.nomeCard }}` · Description vazio |
| Due Date | `{{ $json.dueDate }}` |
| Retry | 3× / 3 s |

Como achar um `idList`: abrir card da lista → URL + `.json` → campo `idList` (24 chars; **não** confundir com `idBoard`). Card novo entra no **fim** da lista por padrão (`Position = top` muda).

### Criar card PCP - clickup
| Campo | Valor |
|---|---|
| Team · Space · Folder · List | `DOMOBY` · `DPTO PRODUÇÃO` · `DPTO PRODUÇÃO` · `PCP` |
| Name | `{{ $json.nomeCard }}` |
| Due Date | `{{ $json.dueDate }}` · Due Date Time desligado |
| Status | `pedido` (minúsculas, como no Plugga) |
| Retry | 3× / 3 s |

## Testes que validaram (12/08)

- **Trello**: pedido 13046 → card `YdlT84JO`, nome idêntico à última linha da PCP real, due 13/08.
- **ClickUp**: pedido 13065 (2 unidades) → 2 tarefas criadas, status `pedido`. Confirmado criando em produção.

## Ferramenta — caça-duplicatas do Trello

Workflow separado `FAXINA · Cards duplicados no Trello` (Manual Trigger → HTTP Request → Code), **sem gatilho automático**. GET `https://api.trello.com/1/boards/{idBoard}/cards` com `fields=name,shortUrl,idList&limit=1000`, credencial *Predefined Credential Type → Trello API*. O Code agrupa por nome normalizado e devolve os repetidos com links. Varre o **quadro inteiro** de propósito (duplicata pode ter sido movida de lista). Rodado em 12/08: 57 cards, **nenhuma duplicata**.

> Equivalente para o ClickUp ainda não existe — a lista PCP tem ~1.123 tarefas de histórico. Ver [[N8N - Pendencias e Riscos]].

## Ver também

[[N8N - Visao Geral da Migracao]] · [[FAB - Estrutura de Producao (Trello e ClickUp)]] · [[N8N - ROTAS ClickUp]]
