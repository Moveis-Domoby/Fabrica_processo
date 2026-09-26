---
titulo: n8n — Tiny da Fábrica: estudo do cadastro de produtos (base para a integração)
tipo: estudo
data: 2026-09-21
atualizado: 2026-09-21
tags: [n8n, tiny, fabrica, produtos, estoque, integracao, sessao-25]
---

# 🔎 Tiny da Fábrica — estudo do cadastro (21/09/2026)

> [!abstract] O que é
> Levantamento feito no navegador, logado na conta da fábrica, **somente leitura** (nada foi alterado, instalado ou salvo). Serve de insumo para a automação n8n "produto cadastrado no Tiny da fábrica → banco" e para a [[SESSAO-25 - Integracao Tiny Fabrica - Estoque e Minimos]]. Complementa [[N8N - Tiny Integracoes Referencia]] e [[N8N - API Tiny v2 vs v3]].

## 1. A conta

| Item | Valor |
|---|---|
| Usuário de login | `lojadomoby` (nome engana: **é a fábrica**, confirmado pelo dono em 21/09) |
| Empresa na multiempresa | **FábricaDomoby — CNPJ 27.556.613/0001-66** (matriz) |
| Empresa conectada | MOVEIS DOMOBY LTDA — **27.556.613/0002-47** (a loja) |
| Plano | **Evoluir** (aparece na loja de extensões) → API v2 com 60 req/min (confirmar pelo header `x-limit-api`) |
| Extensão Webhooks | **disponível, GRÁTIS, NÃO instalada** (não aparece "Webhooks" em Configurações → Geral) |
| Token API | tela existe em Configurações → Geral → **Token API** (gerar e colar direto no compose como `TINY3_TOKEN`, nunca em chat — E-03) |
| Depósito | "Geral" (padrão) |

## 2. Onde os produtos ficam e como estão classificados

Cadastros → Produtos (`erp.olist.com/produtos`). **428 produtos ativos**, todos tipo `P`. O que distingue é a **classe** (`classeProduto` na listagem interna; na API v2 é o campo `classe_produto`):

| Classe | Rótulo na tela | Qtd | O que é na Domoby | Tem SKU? |
|---|---|---|---|---|
| **F** | fabricado | 166 | **os móveis** (Armário, Estante, Mesa, Aparador…) — o que interessa ao estoque da plataforma | 151 sim / 15 sem |
| **M** | matéria-prima | 181 | **peças cortadas** (`1469 x 299 x 15,5 - A07`, unidade `Pç`) + insumos (MDF m², fita de borda, parafusos, dobradiças, filme stretch) | 96 / 85 sem |
| **S** | simples | 53 | revenda (cadeiras Tramontina/Tiffany, arame, cantoneira…) | 19 / 34 sem |
| **K** | kit | 27 | caixas de insumo (`CX DE PARAFUSOS 4x16 - 1000 unid`, corrediças) | 3 / 24 sem |
| **V** | com variação | 1 | `Mesa/escrivaninha Close` (pai, SKU 2026) → filhos por cor (ex.: Branco = SKU **193**) | — |

Outros achados do cadastro:
- **Estoque mínimo existe e é usado**: campo `estoqueMinimo` (v2: `estoque_minimo`) preenchido em **48 produtos**, todos fabricados (ex.: 327 = 4, 1406 = 5, 419 = 4). ✅ Responde a pergunta 3 da SESSAO-25: **o mínimo vem do Tiny**, não precisa de plano B.
- **Fabricado tem Estrutura (BOM) e "Gerar ordem de produção = Sim"** (aba *mais → produção*). Ex.: 327 Armário multiuso = 13 componentes (MDF branco 15mm 3,97 m², MDF 3mm 1,10 m², fita 30,13 m, 120 parafusos, 6 dobradiças…), custo 322,42.
- Unidades **sujas** (`Und`, `Unidad`, `un`, `Pç`, `pç`, `Caixa `, `M²`/`M2`, 29 vazias) → normalizar no banco, nunca comparar string crua (mesma lição do E-25).
- 15 fabricados **sem SKU** (ex.: `Mesa executiva industrial PLUS…`) → não casam com nada; a chave tem que ser o **id do Tiny**, SKU é atributo.
- 6 produtos com `gerenciarEstoque = N`.
- Ritmo: 194 produtos alterados em ago/2026, 19 em set/2026 — o cadastro está vivo.

## 3. Como o estoque de acabado ENTRA hoje (achado mais importante)

A fábrica **já usa Ordens de Produção do Tiny** (Suprimentos → Ordens de produção): **303 OPs, todas finalizadas**, numeradas (306 é a mais recente), 1 SKU por OP com quantidade (ex.: OP 290 = 10× 327).
Ao finalizar a OP, o Tiny lança **entrada no estoque do acabado** — no extrato do produto aparece `Tipo: OP 240, Entrada 1,00` — e baixa os componentes da estrutura (por isso **dezenas de peças `M` estão com saldo negativo**: consomem sem nunca ter entrada).
Também: **cadastrar um produto gera um lançamento** `Balanço — "Produto incluído Saldo:0,00"`. Ou seja, o webhook "Lançamentos de estoque" provavelmente dispara também na criação do produto (a confirmar com evento real — F-05).

## 4. ⚠️ Multiempresa: o estoque da fábrica já é visto pela loja

Configuração da FábricaDomoby (lida, não alterada):
- Envia dados para a loja (0002-47) ✅ · **"Considerar estoque desta empresa" = LIGADO** (estoque da fábrica soma no saldo dos canais de venda da loja).
- **Estoque retornado pela API = "De todas as empresas do grupo"** → `produto.obter.estoque` com o token da fábrica devolve o saldo **consolidado** (fábrica + loja), não só o da fábrica. A reconciliação da SESSAO-25 tem que levar isso em conta (ou o dono muda para "Apenas desta empresa").
- Kits: "Saldo final do kit".
- **Sincronização automática de produtos DESLIGADA** (cadastro da fábrica não vai sozinho para a loja). Regra de vínculo marcada: "SKU, GTIN ou descrição". Campos compartilhados: localização, **estoque mín/máx**, fornecedor, origem.

## 5. SKU fábrica × SKU vendido na loja (conferido no Supabase)

- 151 SKUs de fabricados → **132 aparecem em vendas da loja nos últimos 180 dias** (`pedido_itens.codigo`). O código é compartilhado entre as contas.
- **Mas a loja reusa o SKU para PERSONALIZADO**: SKU 327 na fábrica = "Armário multiuso **2 portas** 1.87×63"; na loja o item mais vendido com 327 é "PERSONALIZADO Armário multiuso **1 porta** 1.82×45". Casar venda → estoque **só por SKU debitaria o produto errado**. Filtro mínimo: descrição da venda sem "PERSONALIZADO".
- 46 SKUs vendidos não existem como fabricado ativo (ex.: **193**, que é **filho de variação** — não aparece na listagem plana; 486/229/469 são classe S; 270/450/454 personalizados).

## 6. Desenho adotado → [[N8N - Tiny Fabrica Produtos para Banco]]

↪️ **Revisado em 21/09 (mesmo dia):** a proposta inicial de polling em `lista.atualizacoes.produtos` foi **descartada** — a doc oficial diz que exige a extensão paga "API para estoque em tempo real" e que a lista **se consome ao ler** (falha depois da leitura = produto perdido). Adotado: `produtos.pesquisa` com `dataCriacao` (janela de 3 h a cada 15 min) + `produto.obter` + varredura diária + webhook de estoque só capturando o payload. Detalhe e implantação na nota do workflow.

## 7. Respostas do dono (21/09)

1. Traz **todos os tipos** de produto para o banco.
2. Extensão Webhooks **instalada** pelo dono. A tela tem só: vendas, pedidos enviados, lançamentos de estoque, NF autorizadas — **sem webhook de produto**.
3. **Estoque é um só** — o que a loja vende é o que a fábrica produz; consolidado na API está certo.
4. Personalizado: a fábrica produz sob encomenda e envia no pedido → **não debita estoque**.
5. Saldo negativo **está errado** → [[N8N - Pendencias e Riscos#P16]].

## Ver também

[[SESSAO-25 - Integracao Tiny Fabrica - Estoque e Minimos]] · [[N8N - Tiny 2 para PCP]] (padrão de workflow separado + claim-first) · [[N8N - Tiny Integracoes Referencia]] · [[N8N - Pendencias e Riscos]] (P1 alerta de erro)
