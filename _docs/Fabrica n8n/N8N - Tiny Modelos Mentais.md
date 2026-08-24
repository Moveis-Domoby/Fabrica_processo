---
titulo: n8n — Tiny: modelos mentais de integração
tipo: modelo-mental
atualizado: 2026-08-17
tags: [n8n, tiny, api, modelo-mental]
---

# Tiny (Olist) · MODELOS MENTAIS de integração

**Data:** 14/08/2026 · Pesquisa verificada contra a documentação oficial (`tiny.com.br/api-docs`, `api-docs.erp.olist.com`, `ajuda.olist.com`)
**Contexto:** Domoby, plano **Impulsione** (antigo Evoluir)

> Este documento é o "mapa". O irmão dele, [[N8N - Tiny Integracoes Referencia]],
> é o "território" — endpoints, parâmetros e payloads literais. Leia este primeiro.

---

## Modelo mental 1 — O Tiny tem QUATRO portas de integração, não uma

```
                    ┌─────────────────────────────────────────────┐
                    │                TINY ERP                     │
                    │                                             │
  VOCÊ CHAMA ───►   │  Porta 1 · API v2  (token estático, POST)   │
  VOCÊ CHAMA ───►   │  Porta 2 · API v3  (OAuth2 via Aplicativo)  │
  TINY CHAMA ◄───   │  Porta 3 · Webhooks de conta (tela config)  │
  TINY CHAMA ◄───   │  Porta 4 · Webhooks de e-commerce           │
                    │            (só integradores homologados)    │
                    └─────────────────────────────────────────────┘
```

- **Porta 1 (API v2)** — você faz a pergunta, o Tiny responde. Token fixo que nunca expira. É a que a Domoby usa em produção hoje (`pedido.obter`). Congelada, mas sem data de morte.
- **Porta 2 (API v3)** — mesmo papel da v2, mas moderna: REST/JSON, OAuth2, escopos. Exige criar um **Aplicativo** dentro do próprio ERP (é isso que as pessoas chamam de "api interna do tiny"). Preço: ciclo de vida de token frágil (4h/24h, rotativo).
- **Porta 3 (Webhooks de conta)** — o Tiny avisa você. É a tela Configurações → Outras configurações → Webhooks. **É a mesma para v2 e v3** — migrar de API não muda nada aqui. É o que alimenta o workflow da planilha hoje.
- **Porta 4 (Webhooks de e-commerce)** — parecem com a 3 na doc, mas são para plataformas homologadas no hub da Olist (Shopee, Nuvemshop…). **Não é um caminho para o n8n interno.** Só serve para confundir leitura de doc — os payloads `situacao_pedido`, `estoque` etc. dessa seção não são os que chegam para você.

⚠️ A pegadinha clássica: a doc tem DUAS seções de webhook (`api2-webhooks-tiny` = porta 3; `api2-webhooks` = porta 4). Payload de uma não vale para a outra.

## Modelo mental 2 — Webhook do Tiny é campainha, não carteiro

O evento de vendas entrega só `tipo`, `id`, `numero`, `codigoSituacao` e um resumo do cliente — **~8 das 49 colunas**. Ele toca a campainha; quem busca a encomenda é você, chamando `pedido.obter` (v2) na sequência.

**Corolário:** toda automação "Tiny → fora" tem sempre 2 passos: webhook (campainha) + API (busca). Isso já está encarnado no workflow em produção.

**O inverso também vale:** automação "fora → Tiny" (como ClickUp → entregue) é sempre API pura — webhooks não recebem nada, só emitem.

## Modelo mental 3 — `id` ≠ `numero` (a confusão que mais custa horas)

| Campo | O que é | Onde se usa |
|---|---|---|
| `dados.id` / `pedido.id` | ID **interno** do Tiny (ex.: 1053632359) | Toda chamada de API (`pedido.obter`, `pedido.alterar.situacao`) |
| `dados.numero` / `pedido.numero` | Número **visível** do pedido (ex.: 13046) | Planilha, nome de card, comunicação humana |

O card do ClickUp carrega o `numero` (está no nome da tarefa). A API de alterar situação exige o `id`. **Por isso a automação ClickUp → Tiny precisa de um passo de tradução no meio: `pedidos.pesquisa.php?numero=X` → pega o `id`.**

## Modelo mental 4 — Situação de pedido: strings na v2, números na v3

A MESMA situação tem dois vocabulários, um por API:

| Situação | v2 (string) | v3 (int) |
|---|---|---|
| Em aberto | `aberto` | 0 |
| Faturado | `faturado` | 1 |
| Cancelado | `cancelado` | 2 |
| Aprovado | `aprovado` | 3 |
| Preparando envio | `preparando_envio` | 4 |
| Enviado | `enviado` | 5 |
| **Entregue** | **`entregue`** | **6** |
| Pronto para envio | `pronto_envio` | 7 |
| Dados incompletos | — | 8 |
| Não entregue | `nao_entregue` | 9 |

Note que a ordem numérica da v3 **não** segue a ordem lógica do funil. Nunca deduza o código — consulte a tabela.

O `codigoSituacao` que chega no webhook de vendas é o **textual da v2** (`"entregue"`), não número.

## Modelo mental 5 — Autenticação: v2 é cadeado, v3 é catraca

- **v2**: um token estático = um cadeado com uma chave. Quem tem a chave entra, para sempre, com acesso total. Risco: vazamento (já aconteceu uma vez, via print — token foi trocado). Custo operacional: zero.
- **v3**: OAuth2 = catraca com crachá que expira. Access token vive **4h**; refresh token vive **24h** e **rotaciona a cada uso** (o novo mata o anterior). Ficou 24h sem renovar? Reautorização **manual, no navegador**. Custo operacional: um renovador rodando 24/7, para sempre.

**Regra de ouro da v3 (se um dia for usada):** só pode existir **UM renovador de token na empresa inteira**. Hoje ele já existe — o cron do Supabase do painel de recompra (renova a cada 3h). Qualquer workflow do n8n que use v3 deve **ler** o token do Supabase, jamais renovar por conta própria. Dois renovadores se matam mutuamente (rotação!) e derrubam as duas aplicações.

## Modelo mental 6 — Quando usar qual porta (árvore de decisão)

```
Preciso REAGIR a algo que aconteceu no Tiny?
└─► Porta 3 (webhook de conta) + Porta 1 (pedido.obter para completar os dados)

Preciso LER ou ESCREVER no Tiny a partir de fora?
├─ A v2 tem o endpoint?  ──► SIM (99% dos casos) ──► Porta 1 (v2, token fixo)
└─ Só existe na v3 (depósitos, ordens de serviço/compra, orçamentos…)?
   └─► Porta 2 (v3), lendo o access token do Supabase — NUNCA renovando
```

Justificativa de continuar na v2 (decisão de 12/08, [[N8N - API Tiny v2 vs v3]]): a v2 está congelada mas sem data de descontinuação, e tudo que a operação precisa — inclusive **alterar situação de pedido** — existe nela. Migrar hoje trocaria um token imortal por uma catraca de 24h no caminho crítico de vendas.

## Modelo mental 7 — Limites do plano Impulsione (≈ Evoluir na doc)

- **60 requisições/minuto** (v2 e v3 têm cotas separadas, mas ambas 60/min nesse plano; na v3, 60 leitura + 60 escrita).
- **Concorrência na v2**: no máximo ¼ do limite = **15 chamadas simultâneas**. Estourou → `codigo_erro 11`.
- Estourou o minuto → `codigo_erro 6` ("API bloqueada momentaneamente"). É bloqueio de janela, não ban — retry na próxima janela resolve.
- O header `x-limit-api` da resposta diz o limite real da conta — vale conferir na primeira chamada em produção (a doc ainda usa os nomes antigos de plano).
- Escala da Domoby: ~78 eventos/dia ≈ 1 a cada 18 min. **Os limites são irrelevantes na prática** — só importam em correções retroativas em massa (aí: lotes com pausa).

## Modelo mental 8 — Confiabilidade: cada perna tem um contrato diferente

| Perna | Contrato | Consequência |
|---|---|---|
| Tiny → n8n (webhook) | Exige HTTP 200; sem 200, reenvia **até 10×** (+5 min progressivo); **não assinado** | Responder 200 imediato (`onReceived`); segurança = URL com UUID secreto |
| ClickUp → n8n (webhook API) | Retry **5×** por evento; endpoint lento (>7s) ou com falha vira `failing`; 100 falhas → **suspenso** (silêncio total); assinado com HMAC `X-Signature` | Responder rápido; monitorar; evento perdido não volta |
| n8n → Tiny (API v2) | Erro vem no corpo (`retorno.status = "Erro"` + `codigo_erro`), HTTP quase sempre 200 | IF de verificação **obrigatório** — o node HTTP não "faila" sozinho; sem IF, erro passa em silêncio |

O terceiro ponto é o mais traiçoeiro: **na v2, sucesso HTTP ≠ sucesso da operação.** Sempre conferir `retorno.status`.

## Modelo mental 9 — O ecossistema em uma figura (estado atual + a nova automação)

```
 TINY ERP ──webhook vendas──► n8n ──pedido.obter──► TINY
                               │
                               ├──► Sheets COMPLETO (49 col) ─► DADOS ─► OPERADORA ─► PCP
                               ├──► ClickUp · ROTAS  (card de entrega, só inclusão)
                               ├──► ClickUp · PCP    (1 tarefa por unidade)
                               └──► Trello  · PCP    (idem, sairá de uso)

 NOVO (este projeto):
 ClickUp ROTAS · card → "entregue" ──webhook──► n8n ──pedidos.pesquisa──► id
                                                 └──pedido.alterar.situacao (entregue)──► TINY
                                                                                            │
                                    (o Tiny então dispara atualizacao_pedido, que        ◄──┘
                                     atualiza SITUAÇÃO na planilha sozinho — bônus, não loop)
```

A seta de volta é importante: marcar entregue via API **dispara o webhook de vendas**, o workflow existente roda `atualizacao_pedido` e a coluna SITUAÇÃO da planilha vira "Entregue" **de graça**. Não há loop: o ramo do ClickUp só cria card em `inclusao_pedido`, e a nova automação só reage a mudança de status no ClickUp — nenhum dos dois se realimenta.

## Ver também

[[N8N - Tiny Integracoes Referencia]] · [[N8N - API Tiny v2 vs v3]] · [[N8N - ROTAS Entregue para Tiny]] · [[N8N - Visao Geral da Migracao]]
