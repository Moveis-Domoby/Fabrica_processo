---
titulo: INT — Tiny ERP (Olist)
tipo: integracao
prioridade: critica
atualizado: 2026-08-06
tags: [integracao, tiny, olist, erp, api, oauth]
fontes: https://api-docs.erp.olist.com/
---

# 🔌 INT — Tiny ERP (Olist)

> [!abstract] O que é
> ERP em nuvem brasileiro, voltado a pequenos e médios vendedores de e-commerce, com integração nativa a marketplaces (Mercado Livre, Shopee, Amazon, Magalu). **Adquirido pela Olist em 29/10/2021** (valores não divulgados). É a **fonte de verdade de todas as vendas** deste projeto.

## Rebranding em curso — atenção aos dois domínios

O produto está migrando de "Tiny" para "**Olist Tiny**". Isso é visível na infraestrutura:

| Coisa | Domínio |
|---|---|
| Documentação da API v3 | `api-docs.erp.olist.com` |
| **Hosts operacionais** | `api.tiny.com.br`, `erp.tiny.com.br`, `accounts.tiny.com.br` |

**Ambos precisam estar em allowlists/firewall.**

---

## API v3 vs v2

| Aspecto | v2 (legada) | **v3 (a que usamos)** |
|---|---|---|
| Base URL | `https://api.tiny.com.br/api2/` | **`https://api.tiny.com.br/public-api/v3`** |
| Estilo | RPC — um `.php` por operação | REST (`GET /pedidos`, `PUT /pedidos/{id}/situacao`) |
| Auth | token simples na query | **OAuth 2.0** (Keycloak), `Authorization: Bearer` |
| Formato | XML ou JSON | JSON |
| Erros | vinham com HTTP 200 dentro de `{"retorno":{...}}` | códigos HTTP semânticos |
| Paginação | `pagina` (100 fixo) | `limit`/`offset` + objeto `paginacao {limit, offset, total}` |
| Datas | `dd/mm/yyyy` | ISO `yyyy-mm-dd` |

**Status da v2:** *"continuará funcional sem data estimada para descontinuação, mas não receberá mais atualizações"* — congelada, não desligada.

**Versionamento:** o path continua `/v3`; as versões menores (3.1.x) são aditivas. A 3.1.6 (ago/2026) adicionou Orçamentos, sem breaking changes.

> [!warning] Armadilha de base URL
> Exemplos comunitários no GitHub usam `https://erp.tiny.com.br/api/v3/sales/orders`. **A base oficial é `https://api.tiny.com.br/public-api/v3`, com recursos em português.** Não confie em exemplos de terceiros.

---

## 🔑 OAuth 2.0 — o ponto operacional mais crítico

### Onde criar a aplicação
No ERP: **Configurações → aba Geral → Aplicativos → "+ novo aplicativo"**. Informa nome, redirect_uri e permissões por módulo (leitura / incluir-editar / excluir). Recomendação oficial: *"marque o mínimo de opções necessárias"*.

> [!note] Permissões são fixadas no consentimento
> Se você alterar as permissões do app depois, **o usuário precisa refazer o login/consentimento**. Alterações de escopo não se propagam sozinhas.

### Endpoints (realm Keycloak)

```
Authorization: https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/auth
Token:         https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token
```

### Fluxo

```
1. GET .../auth?client_id=&redirect_uri=&scope=openid&response_type=code
2. POST .../token  grant_type=authorization_code &client_id &client_secret &redirect_uri &code
3. Authorization: Bearer {access_token}
4. POST .../token  grant_type=refresh_token &client_id &client_secret &refresh_token
```

### ⏱️ Tempos de vida

| Token | Validade |
|---|---|
| `access_token` | **4 horas** |
| `refresh_token` | **1 dia (24h)** |

> [!danger] A ARMADILHA — refresh token de 24h sem recuperação automática
> Se a integração ficar **mais de 24h sem renovar** — deploy longo, container parado, feriado, cron pausado, falha silenciosa do scheduler — o refresh token **morre e não há recuperação programática**. É obrigatório refazer o fluxo interativo: **um humano com acesso ao ERP precisa clicar e autorizar de novo**. Não existe `client_credentials` documentado para contornar.
>
> **É a principal causa de "a integração parou de funcionar sozinha".**
>
> **Mitigação (nosso `tiny-auth-refresh` deve seguir isso):**
> - Renovar **proativamente a cada ~3h**, não sob demanda
> - Persistir os tokens em `tiny_auth` (já fazemos)
> - **Sempre sobrescrever** o `refresh_token` com o valor da última resposta — o Keycloak tipicamente rotaciona; tratar como rotativo é seguro nos dois cenários
> - **Alertar** se a última renovação bem-sucedida passar de ~12h

*Rotação do refresh token: não confirmada explicitamente na documentação, mas é o comportamento padrão do Keycloak.*

---

## 📦 Endpoints relevantes para recompra

### `GET /pedidos`

| Parâmetro | Nota |
|---|---|
| `dataInicial` / `dataFinal` | sobre a data de **criação** |
| `dataAtualizacao` | valor **único**, sem par final — é o que se usa para sync incremental |
| `situacao` | enum, ver abaixo |
| `cpfCnpj`, `nomeCliente`, `codigoCliente`, `numero` | |
| `numeroPedidoEcommerce`, `idVendedor`, `marcadores[]` | |
| `origemPedido` | `0` = Pedido de Venda, `1` = PDV |
| `limit` / `offset` | default 100 / 0 |

**Resposta:** `{ itens: [...], paginacao: { limit, offset, total } }`. Cada item traz `cliente { id, nome, cpfCnpj, telefone, celular, email, endereco }`, `ecommerce {...}`, `vendedor`, `transportador`.

> [!success] Boa notícia para recompra
> A **listagem já traz `cliente.id` e `cliente.cpfCnpj`**. Análise de RFM (recência/frequência/valor) pode ser feita só com a listagem — sem N chamadas de detalhe.

### `GET /pedidos/{id}` — ⚠️ o padrão N+1 obrigatório

**Os `itens` do pedido não existem na listagem.** SKU, quantidade e valor unitário só aparecem no detalhe.

Exclusivos do detalhe: `itens[]` (com `produto {id, sku, descricao, tipo}`), `valorTotalProdutos`, `valorDesconto`, `valorFrete`, `pagamento`/`parcelas`, `pagamentosIntegrados`, `enderecoEntrega`, `idNotaFiscal`, `dataFaturamento`, `dataEntrega`, `dataEnvio`, `deposito`, `naturezaOperacao`, `observacoes`.

> [!danger] Custo real do backfill
> 10.000 pedidos = **~10.100 requisições** (100 de listagem + 10.000 de detalhe).
> A 30 req/min → **~5,6 horas**. A 120 req/min → ~1,4h.
> É exatamente por isso que existe `tiny_sync_state` com ponteiro de retomada. Ver [[INT - Edge Functions]].

### `GET /contatos` e `/contatos/{id}`

Filtros: `nome`, `codigo`, `situacao`, `cpfCnpj`, `celular`, `dataCriacao`, `dataAtualizacao`.

`situacao`: `B` Ativo · `A` Ativo com acesso · `I` Inativo · `E` Excluído
`tipoPessoa`: `J` Jurídica · `F` Física · `E` Estrangeiro · `X` (não rotulado na doc)

Só no detalhe: `telefoneAdicional`, `dataNascimento`, `sexo`, `profissao`, `emailNfe`, `enderecoCobranca`, `limiteCredito`. Mesmo padrão N+1.

### `GET /produtos`

`situacao`: `A` Ativo · `I` Inativo · `E` Excluído
`tipo`: `K` kit · `S` serviço · `V` variação · `F` fabricado · `M`

⚠️ **Kits e variações distorcem análise por SKU.** Se um kit vendido desmembra ou não em componentes no `itens[]` do pedido **não está documentado** — validar empiricamente contra os dados reais.

### `GET /notas`

Situações da NF: `1` Pendente · `2` Emitida · `3` Cancelada · `4` Enviada Aguardando Recibo · `5` Rejeitada · `6` Autorizada · `7` Emitida DANFE · `8` Registrada · `9` Enviada Aguardando Protocolo · `10` Denegada

O filtro **`idVenda`** é o elo NF ↔ pedido — útil para reconciliar faturamento efetivo contra pedidos criados.

---

## 🚦 Situações de pedido — VALORES CONFIRMADOS

| Código | Rótulo oficial |
|:---:|---|
| **0** | Aberta |
| **1** | Faturada |
| **2** | Cancelada |
| **3** | Aprovada |
| **4** | Preparando Envio |
| **5** | Enviada |
| **6** | Entregue |
| **7** | Pronto Envio |
| **8** | Dados Incompletos |
| **9** | Não Entregue |

> [!danger] CORREÇÃO IMPORTANTE — a suposição comum está errada
> Circula a ideia de que `7` = "atendido/entregue" e `8` = "faturada". **Está invertido:**
> - `7` é **Pronto Envio**, não entregue. **Entregue é `6`.**
> - `8` é **Dados Incompletos**, não faturada. **Faturada é `1`.**
>
> Usar 7 ou 8 com o significado errado **inverteria completamente o funil de vendas** em qualquer análise. Este é o achado mais acionável da pesquisa.

**Recorte sugerido para "venda efetivada":** `situacao IN (1, 3, 4, 5, 6, 7)` — excluindo `0` (Aberta), `8` (Dados Incompletos), `2` (Cancelada) e `9` (Não Entregue). O critério exato depende de a empresa reconhecer receita no faturamento ou na entrega. **Vale alinhar com o financeiro e registrar aqui.**

⚠️ `situacao` é documentado como enum escalar (enquanto `marcadores` é explicitamente array) — provavelmente **não aceita múltiplos valores numa chamada**. Capturar 6 situações exigiria 6 chamadas paginadas. *Não confirmado; validar.*

---

## 🚦 Rate limits

**O limite é POR CONTA, não por aplicativo.** Citação literal: *"Se a conta possuir mais de um aplicativo ativo, eles compartilharão o mesmo limite."*

### Headers em toda resposta

| Header | Significado |
|---|---|
| `X-RateLimit-Limit` | capacidade total por minuto |
| `X-RateLimit-Remaining` | restantes no minuto atual |
| `X-RateLimit-Reset` | segundos até o reset |

### Limites por plano

| Plano | Leitura | Escrita |
|---|---|---|
| Construa / Crescer / Parceiros | 30/min | 30/min |
| Evoluir / Impulsione | 60/min | 60/min |
| Domine | 120/min | 100/min |
| Protagonize / Potencializar | 140/min | 100/min |

### Boas práticas

- **Throttle proativo baseado em header**, não reativo: pausar quando `X-RateLimit-Remaining` cair abaixo de ~10%, dormindo `X-RateLimit-Reset` segundos.
- **Backoff exponencial com jitter** em 429/503 (1s, 2s, 4s… teto 60s).
- **Concorrência 1** (serial) é o mais seguro. Se paralelizar, ~1/4 do teto (a v2 documentava explicitamente esse limite de concorrência).
- **Nunca paralelizar entre aplicativos** da mesma conta.
- Preferir **carga incremental** por `dataAtualizacao` a full-refresh diário.

> [!danger] Um backfill agressivo derruba as integrações de marketplace do cliente
> Como a cota é por conta, um script mal calibrado pode **fazer pedidos do Mercado Livre pararem de entrar no ERP**. Rodar cargas históricas em janelas de baixo movimento.

*O código HTTP literal `429` não aparece reproduzido na documentação oficial acessível (que documenta 400/401/403/404/500/503), mas SDKs comunitários o tratam explicitamente. **Implementar tratando 429 e 503.***

---

## ⚠️ Armadilhas conhecidas

### CPF/CNPJ como chave de cliente
- **Formatação livre** — o campo é string; pode vir `12345678900` ou `123.456.789-00`. **Normalizar sempre** removendo não-dígitos.
- **Frequentemente vazio** em vendas de marketplace (especialmente antes do faturamento). Agrupar ingenuamente colapsa tudo num "cliente fantasma".
- **CPF divergente entre pedido e entrega:** `enderecoEntrega` tem seu **próprio** `cpfCnpj` e `nomeDestinatario`. Presentes, compras corporativas e dropshipping produzem essa divergência.
- **Melhor prática:** usar **`cliente.id`** (inteiro, PK do ERP) como chave canônica, e o CPF normalizado apenas como chave **secundária** para detectar cadastros duplicados no próprio ERP.

### Telefone
Três campos sobrepostos: `telefone`, `celular` e — só no detalhe — `telefoneAdicional`. Nenhum com formato garantido. Normalizar para E.164 com fallback `celular → telefone → telefoneAdicional`.

### Identificação do canal de venda
> [!warning] `origemPedido` NÃO identifica marketplace
> Ele só distingue `0` = Pedido de Venda e `1` = PDV.
>
> **O campo correto é o objeto `ecommerce`:**
> ```json
> "ecommerce": { "id", "nome", "numeroPedidoEcommerce",
>                "numeroPedidoCanalVenda", "canalVenda" }
> ```
> - `ecommerce.nome` → a integração/loja de origem
> - `canalVenda` → o canal propriamente dito
> - `numeroPedidoEcommerce` vs `numeroPedidoCanalVenda` → dois IDs externos distintos (hubs intermediam: o pedido tem número no hub *e* no marketplace final)
>
> **A lista de valores possíveis de `canalVenda` não é documentada** — descobrir com `SELECT DISTINCT` sobre os dados reais. **Não hardcode uma lista de marketplaces.**
>
> Vendas diretas provavelmente vêm com `ecommerce` nulo — tratar como "venda direta/balcão", não como erro.

> [!danger] Recompra cross-channel é estruturalmente difícil aqui
> Um mesmo consumidor comprando no Mercado Livre e depois na loja própria aparece como **dois clientes distintos** se o marketplace mascarar o CPF (prática comum). **Declarar essa limitação na análise** em vez de reportar números falsamente baixos.

### Formatos de data inconsistentes entre recursos
- `/produtos` → `dataCriacao`/`dataAlteracao` com hora (`2023-01-01 10:00:00`)
- `/notas` → `dataInicial`/`dataFinal` só data (`2023-01-01`)
- `/pedidos` → **o formato dos parâmetros não é especificado na doc**

E o nome varia: **`dataAlteracao`** em produtos vs **`dataAtualizacao`** em pedidos e contatos. Fácil de errar em código genérico.

### Janela de data em consultas históricas
**Não há limite documentado**, mas há um teto implícito via `paginacao.total × limit=100`. **Fatiar em janelas mensais ou semanais** de qualquer forma: torna a carga retomável, evita timeouts e mantém o `offset` baixo.

---

## 🪝 Webhooks

**Existem, com limitações relevantes.**

**Configuração:** instalar o aplicativo "Webhooks" na loja de apps do ERP → configurações → ativar e configurar as URLs.

**Eventos:** Vendas (pedido criado ou modificado) · Expedição (situação "enviado") · Estoque (atualizações) · Notas fiscais (autorizadas)

**Payload (referência da v2):**
```json
{ "versao": "1.0.0", "cnpj": "...",
  "tipo": "inclusao_pedido | atualizacao_pedido",
  "dados": { "id", "numero", "data", "situacao", "cliente", ... } }
```

**Retentativa:** o endpoint **deve retornar HTTP 200**. Sem confirmação, *"a Olist enviará o payload até no máximo **10 vezes**, com delay progressivo, aumentando em 5 minutos a cada tentativa"* — ~4,5h de janela total.

> [!danger] Limitações críticas
> 1. **Não é possível registrar URL programaticamente.** A configuração é global por conta, feita na interface do ERP. Todo onboarding exige uma etapa manual.
> 2. **Depende do plano** (Evoluir ou superior, com a extensão instalada). Clientes em planos básicos **não terão webhooks** — a arquitetura precisa suportar fallback por polling.
> 3. **Autenticação/assinatura do payload não documentada.** Assuma que o endpoint é publicamente invocável: proteja com URL de alta entropia e **valide o payload contra a API antes de agir**.

> [!tip] Arquitetura recomendada
> Usar webhook como **gatilho de invalidação**, não como fonte de dados: ao receber, enfileirar o `id` e fazer a leitura autoritativa via `GET /pedidos/{id}`. Resolve simultaneamente a ausência de assinatura, a entrega fora de ordem e o payload resumido.
> Manter um **job de reconciliação por `dataAtualizacao`** rodando a cada ~6h para capturar eventos perdidos — é exatamente o papel do nosso `tiny-auditoria-sync`.

---

## ❓ Itens não confirmados na documentação pública

Registrados para transparência — **validar empiricamente antes de depender deles**:

1. Se o `refresh_token` é rotativo (tratar como se fosse)
2. O código HTTP literal 429
3. Limite máximo de janela de data em `GET /pedidos`
4. Formato exato dos parâmetros de data em `GET /pedidos`
5. Semântica de `dataAtualizacao` (ponto único vs "a partir de") — **relevante, é o campo do nosso sync incremental**
6. Se `situacao` aceita múltiplos valores
7. Lista de valores de `canalVenda` / `ecommerce.nome`
8. Rótulos de `statusCrm` (`L`,`P`,`C`,`I`) e `tipoPessoa = X`
9. Se kits (`tipo = K`) são desmembrados no `itens[]`
10. Assinatura e headers dos webhooks
11. Schema do payload de webhook na v3
12. Existência de ambiente **sandbox** — nenhuma menção encontrada. **Presuma que testes ocorrem em produção** — risco operacional a declarar.

## Fontes

- [Portal da API v3](https://api-docs.erp.olist.com/) · [índice legível por máquina](https://api-docs.erp.olist.com/llms.txt)
- [Autenticação](https://api-docs.erp.olist.com/documentacao/comecando/autenticacao) · [Criando um aplicativo](https://api-docs.erp.olist.com/documentacao/comecando/criando-um-aplicativo) · [Limites de consulta](https://api-docs.erp.olist.com/documentacao/comecando/limites-de-consulta) · [Webhooks](https://api-docs.erp.olist.com/documentacao/webhooks/webhooks)
- [Listar pedidos](https://api-docs.erp.olist.com/api-reference/pedidos/listar-pedidos) · [Obter pedido](https://api-docs.erp.olist.com/api-reference/pedidos/obter-pedido) · [Listar contatos](https://api-docs.erp.olist.com/api-reference/contatos/listar-contatos) · [Listar produtos](https://api-docs.erp.olist.com/api-reference/produtos/listar-produtos) · [Listar notas](https://api-docs.erp.olist.com/api-reference/notas/listar-notas-fiscais)
- [Central de Ajuda — limites por plano](https://ajuda.olist.com/hubs-e-plataformas-via-api/aplicativos-api-v3-configuracoes-e-utilizacao)
- [API v2 (legada)](https://tiny.com.br/api-docs/api) · [Limites v2](https://tiny.com.br/api-docs/api2-limites-api) · [Webhooks v2](https://tiny.com.br/api-docs/api2-webhooks-tiny)
- Contexto: [Olist compra a TinyERP](https://startups.com.br/negocios/olist-compra-a-tinyerp-e-a-vnda-e-chega-a-4-aquisicoes-em-1-ano/) · [Sobre a Olist](https://olist.com/sobre-nos/)

## Ver também

- [[INT - Edge Functions]] · [[BD - vendas marketing]] · [[MM - Fluxo do Dado]]
