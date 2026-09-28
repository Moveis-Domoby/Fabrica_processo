---
titulo: "PLANO — Integração COMPLETA com o Tiny da fábrica (peças, insumos, estrutura e corte)"
tipo: plano
data: 2026-09-27
atualizado: 2026-09-27
tags: [planejamento, tiny, integracao, estoque, pecas, insumos, cnc, plano-de-corte, api]
---

# 🏭 PLANO — Integração COMPLETA com o Tiny da fábrica

> [!abstract] Por que este plano existe
> Pedido do dono em 27/09/2026: *"em algum ponto muito breve não vamos mais trabalhar só com os produtos finais, mas com o que faz sentido para a produção por completo — peças, insumos e tudo mais. Uma máquina CNC não sabe o que é uma penteadeira, mas ela corta todas as peças que montam a penteadeira a partir do plano de corte."*
> Ou seja: a plataforma precisa enxergar a fábrica **no nível de peça e insumo**, não de móvel. E **toda alteração no Tiny da fábrica precisa chegar aqui**, não só as de hoje.
> Esta nota é o levantamento (o que a API do Tiny oferece de verdade, conferido na doc em 27/09), o diagnóstico do que temos, e o plano em ondas. **Não é demanda de sessão** — as demandas nascem daqui.

## 1. Onde estamos hoje (23/09, em produção)

| Temos | Não temos |
|---|---|
| Catálogo `produtos` com **487 itens** de **todas as classes** (F fabricado, M matéria-prima, S simples, K kit, V variação) | **Estrutura (BOM)**: quais peças e insumos formam cada móvel |
| Produto **novo** entra sozinho em ≤15 min (`produtos.pesquisa` + `dataCriacao` → `produto.obter`) | **Alteração** só é vista na **varredura das 03:15** (até ~24 h de atraso) |
| **Webhook de lançamentos de estoque** ligado: manda `{idProduto, sku, nome, saldo}` a cada movimentação | **Saldo por depósito/empresa** (hoje vem o consolidado do grupo) |
| Eventos append-only em `eventos` (`produto_fabrica`, `estoque_fabrica`) | **Movimento** de estoque (entrada/saída/balanço, quantidade, autor, origem) — o webhook só manda o saldo final |
| Carga inicial de saldo rodada (SESSAO-25) | **Ordens de produção**: existem 300+ no Tiny e a API v2 **só cria**, não lista |
| | **Plano de corte** (hoje nasce num plugin do SketchUp, fora do Tiny) |

**O buraco central:** hoje a fábrica é vista como "móvel pronto". Para CNC/SECC, o que importa é **peça** (`1469 x 299 x 15,5 - A07`) e **insumo** (MDF m², fita de borda, parafuso) — e o elo entre móvel e peça é a **estrutura**, que ainda não trazemos.

## 2. O que o Tiny oferece de verdade (conferido na doc em 27/09/2026)

### 2.1 API v2 (a que usamos hoje — token estático)

| Endpoint | Serve para | Observação crítica |
|---|---|---|
| `produtos.pesquisa.php` | listar; filtros `pesquisa`, `situacao` (A/I/E), **`dataCriacao`**, `pagina` (100/pág.) | **Não tem filtro por data de ALTERAÇÃO** — é essa a raiz do atraso de hoje |
| `produto.obter.php` | cadastro completo: `classe_produto`, `estoque_minimo/maximo`, `tipoVariacao`, `variacoes[]`, `kit[]`, preços, NCM, dimensões | 1 requisição por produto |
| **`produto.obter.estrutura.php`** | **a ESTRUTURA**: `produto.estrutura[]` com `id`, `codigo`, `nome`, **`quantidade`** por componente | 🎯 **é isto que liga móvel → peças e insumos**. 1 req por produto fabricado (169 hoje) |
| `produto.obter.estoque.php` | `saldo`, `saldoReservado`, **`depositos[]`** com `nome`, `saldo`, **`empresa`**, `desconsiderar` | 🎯 **resolve a dúvida do consolidado**: dá para separar fábrica × loja pelo campo `empresa` |
| `lista.atualizacoes.produtos` | fila de **produtos alterados** desde `dataAlteracao` | ⚠️ exige a extensão **"API para estoque em tempo real"** e **consome a fila ao ler** ("registros já obtidos serão removidos da fila e marcados como processados") |
| `lista.atualizacoes.estoque` | fila de **saldos alterados**, com `saldo`, `saldoReservado`, `depositos[]`, `data_alteracao` | mesma extensão e mesma pegadinha da fila que se consome |
| `produto.atualizar.estoque.php` · `produto.alterar.php` · `produto.incluir.php` | escrever no Tiny | só se um dia a plataforma virar origem |
| `gerar.ordem.producao.pedido.php` | **criar** ordem de produção a partir de um pedido (`lancarEstoque` S/N) | **não existe listar/obter/finalizar OP na v2** |
| Webhooks de conta | vendas · pedidos enviados · **lançamentos de estoque** · NF | **não existe webhook de produto**; payload de estoque já capturado (só saldo final) |

### 2.2 API v3 (OAuth) — o que ela tem a mais e que muda o jogo

| Recurso v3 | Por que importa aqui |
|---|---|
| `GET /produtos` com **`dataAlteracao`** (e `dataCriacao`, `situacao`, `limit`/`offset`) | 🎯 **detectar QUALQUER alteração sem extensão paga e sem fila que se consome** — é o caminho limpo para "cada fio alterado chega aqui" |
| `GET /produtos/{id}` traz **`producao`** (componentes **e etapas**), `kit[]`, `estoque` (mínimo, máximo, quantidade, localização), `precos`, `dimensoes`, `fornecedores`, `tributacao`, `anexos`, `variacoes` | a estrutura vem **junto do cadastro**, com **etapas de produção** — que a v2 não entrega |
| **`GET /estoque/{idProduto}/logs-movimentacao`** — filtros `dataInicio`/`dataFim`, **`tipo` (E/S/B)**, `idDeposito`, paginado | 🎯 **o movimento com autoria e origem** — resolve "quem mexeu, quanto e por quê", que o webhook não dá |
| `GET /depositos` e `GET /depositos/{id}` | separar **fábrica × loja** de forma explícita |
| `GET/POST /listas-de-precos`, `/categorias`, `/marcas` | custo/preço por lista, organização do catálogo |
| `PUT /produtos/{id}`, `PUT /estoque/{idProduto}` | escrita, se a plataforma virar origem de algum dado |
| Webhooks | **iguais aos da conta** — a v3 **não** tem webhook por aplicativo ("não é possível criar webhooks específicos por aplicativo") |

**Custo de adotar a v3 na conta da fábrica:** criar um **aplicativo na própria conta** (app é por conta), autorizar, e manter o ciclo OAuth — access ~4 h, refresh ~24 h **que rotaciona a cada uso**. ⚠️ **Regra do dono único** ([[N8N - API Tiny v2 vs v3]]): **um só renovador por credencial**. Hoje o renovador do token v3 **da loja** roda no Supabase da fábrica (pós-cutover). O app da fábrica seria uma **segunda credencial**, com **seu próprio renovador** — precisa nascer com a mesma disciplina (uma linha em `tiny_auth` por conta, um cron por conta).

### 2.3 O caminho recomendado

**v2 continua para o que já funciona; a v3 entra SÓ para o que ela resolve melhor** — e o critério é objetivo:

| Necessidade | Caminho recomendado | Por quê |
|---|---|---|
| Alteração de cadastro em minutos | **v3 `GET /produtos?dataAlteracao=`** | sem extensão paga, sem fila que se consome, sem 441 requisições por ciclo |
| Estrutura (BOM) + etapas | **v3 `GET /produtos/{id}`** (`producao`) · fallback v2 `produto.obter.estrutura.php` | v3 traz componentes **e** etapas |
| Saldo por depósito/empresa | v2 `produto.obter.estoque.php` (já sabemos que traz `depositos[].empresa`) **ou** v3 | v2 já serve; v3 é mais limpo |
| Movimento com autor e origem | **v3 `/estoque/{id}/logs-movimentacao`** | não existe equivalente na v2 |
| Aviso imediato de movimentação | **webhook de conta** (já ligado) | é a campainha; o detalhe vem por API |

> [!warning] Alternativa sem v3 (plano B)
> Instalar a extensão **"API para estoque em tempo real"** e usar `lista.atualizacoes.produtos` / `lista.atualizacoes.estoque`. Funciona, mas: **custo da extensão** (confirmar na loja da conta) e **a fila se consome ao ler** — uma falha do n8n depois da leitura perde a alteração. Se for por aqui, a gravação no banco tem que ser a **primeira** coisa após a leitura, sempre.

## 3. O modelo de dados proposto (peça e insumo como cidadãos de primeira classe)

Seguindo a regra do banco enxuto (**antes de criar tabela, ver se uma existente resolve**):

| Tabela | Situação | Conteúdo |
|---|---|---|
| **`produtos`** | ✅ já existe | peça, insumo, móvel e kit **já estão todos aqui** — o que separa é `classe` (M/F/S/K/V). Nada de tabela nova para "peças" |
| **`produto_estrutura`** (nova, inevitável) | a criar | `produto_id` (o móvel) × `componente_id` (peça/insumo) × `quantidade` × `unidade` — mais `origem` e `atualizado_em`. É a única forma de responder "o que a CNC corta para uma penteadeira" |
| **`eventos`** | ✅ já existe | continua recebendo `produto_fabrica` e `estoque_fabrica`; ganha `estoque_movimento_fabrica` (com tipo/quantidade/autor/origem) quando puxarmos os logs |
| **Saldo** | decidir na SESSAO-25 | colunas em `produtos` (saldo consolidado) **+** saldo por depósito, se o dono quiser fábrica × loja separados |

Com isso, "estoque de peças" e "estoque de insumos" **não são módulos novos**: são a mesma tela filtrada por classe, com o saldo que já chega.

## 4. O plano em 5 ondas

### Onda 1 — Nenhuma alteração passa despercebida *(a mais urgente)*
- Trocar o gatilho de "produto novo" por **"produto alterado"**: ciclo de 10–15 min consultando **v3 `GET /produtos?dataAlteracao=` (janela sobreposta)** e, para cada id retornado, gravar pelo `fn_upsert_produto`.
- A varredura das 03:15 continua como **rede de segurança**, não como caminho principal.
- Fica igual para: preço, mínimo, unidade, descrição, situação, categoria — **qualquer campo**.
- **Pré-requisito:** app v3 na conta da fábrica + renovador próprio (§2.2). Sem ele, plano B com a extensão.

### Onda 2 — A estrutura (o elo móvel → peça → insumo)
- Puxar `producao`/`estrutura` dos **169 fabricados** e gravar em `produto_estrutura` (uma carga inicial de ~3 min a 55 req/min; depois só quando o produto mudar).
- Entrega imediata: **explosão de um pedido em peças e insumos** — "este pedido precisa de 37 peças e 4,1 m² de MDF branco".
- Abre a porta para: necessidade de compra de insumo, custo real por móvel e o consumo que hoje deixa peça negativa (P16).

### Onda 3 — Estoque de verdade, com movimento e depósito
- Saldo **por depósito/empresa** (fábrica × loja separados, se o dono quiser).
- **Logs de movimentação** (v3) com tipo, quantidade, autor e origem → a plataforma passa a saber *por que* o saldo mudou (OP, venda, balanço, ajuste manual).
- Com isso o **saldo negativo das peças** (P16) deixa de ser mistério: dá para mostrar exatamente qual OP consumiu sem entrada.

### Onda 4 — Produção no nível de peça
- Card de produção deixa de ser só "móvel" e passa a poder ser **lote de peças** (a CNC corta peças de vários pedidos juntos).
- Consumo de insumo na conclusão da etapa (baixa por estrutura), em vez de depender da OP do Tiny.
- **Decisão grande aqui:** a OP do Tiny continua sendo a dona da baixa de estoque, ou a plataforma passa a ser? (Ver perguntas.)

### Onda 5 — Plano de corte (SketchUp → CNC/SECC)
- Hoje o plano nasce num **plugin do SketchUp**, fora do Tiny. Precisamos ver o plugin de perto para saber o que ele exporta.
- Alvo: a plataforma recebe/gera a lista de peças de um lote e entrega **no formato que cada máquina lê** — JSON/CSV para a CNC (ou o formato nativo do software dela) e uma lista de corte para a SECC.
- Ordem natural: **depois da onda 2** (sem estrutura não há lista de peças confiável).
- ⚠️ Esta onda é a de maior incerteza: depende do modelo da CNC, do software que a alimenta e do que o plugin exporta.

## 5. O que precisa de você (dono)

1. **v3 na conta da fábrica:** posso criar o aplicativo (scopes de produtos e estoque) e montar o renovador próprio? É o que destrava as ondas 1, 2 e 3 de forma limpa. Alternativa: instalar a extensão paga e ficar na v2 — quanto custa na sua conta?
2. **Quem é o dono da baixa de estoque de peça/insumo**: a Ordem de Produção do Tiny (como hoje) ou a plataforma? Isso decide a onda 4 e é o que hoje causa o saldo negativo.
3. **Estrutura atualizada?** As estruturas dos 169 fabricados no Tiny estão corretas e completas hoje, ou muitas estão desatualizadas/vazias? (Vi uma: o 327 tem 13 componentes bem descritos.)
4. **Plano de corte:** qual o plugin do SketchUp, e o que ele exporta (arquivo, formato)? A CNC lê o quê — G-code, DXF, XML de nesting, ou o software próprio dela?
5. **Peças cortadas entram em estoque?** Hoje o Tiny baixa peça pela estrutura mas ninguém dá entrada (P16). No desenho novo, peça cortada vira saldo positivo na plataforma?
6. **Insumo com unidade "louca"** (`1`, `cento`, `galão`, e 30 sem unidade): dá para padronizar no cadastro do Tiny, ou a plataforma converte?

## 6. Riscos e limites conhecidos

| Item | Nota |
|---|---|
| Cota da API | 60 req/min **por conta** (Evoluir), compartilhada entre v2, v3 e qualquer app. Toda onda nova divide o mesmo bolo — por isso "alteração por data" vale mais que varredura |
| Fila que se consome (plano B) | `lista.atualizacoes.*` perde o registro se o n8n falhar depois da leitura |
| OAuth v3 | access ~4 h, refresh ~24 h rotativo: **um renovador por credencial**, sempre |
| Ordens de produção | a API **só cria**; listar/finalizar continua sendo tela do Tiny — se a OP for peça central do fluxo, isso vira limite real |
| Sem alerta de erro (P1) | com 7+ integrações, seguir sem vigia é o maior risco operacional do conjunto |
| Sem sandbox | todo teste é em produção (A-11) |

## Ver também

[[N8N - Tiny Fabrica Produtos para Banco]] · [[N8N - Tiny Fabrica - Estudo do Cadastro]] · [[N8N - Tiny Integracoes Referencia]] · [[N8N - API Tiny v2 vs v3]] · [[SESSAO-25 - Integracao Tiny Fabrica - Estoque e Minimos]] · [[N8N - Pendencias e Riscos]] (P1, P16)
