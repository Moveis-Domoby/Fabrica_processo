---
titulo: n8n — Tiny: referência completa de integrações (v2, v3, webhooks, apps)
tipo: referencia
atualizado: 2026-08-17
tags: [n8n, tiny, api, webhooks, referencia]
---

# HANDOFF · Tiny (Olist) — TODAS as formas de integração

**Data da pesquisa:** 14/08/2026 · Verificado contra a documentação oficial
**Conta:** Domoby, plano **Impulsione** (antigo Evoluir)
**Complementa:** [[N8N - Tiny Modelos Mentais]] (o mapa conceitual) e os handoffs anteriores do projeto

> Como usar: este é o documento de referência. Quando precisar de um endpoint,
> parâmetro ou payload literal do Tiny, procure aqui antes de procurar na web.

---

# PARTE 1 · API v2 (a que está em produção)

## 1.1 Autenticação

- **Token estático** único por conta. Não expira nunca; só muda se for regerado no painel.
- Onde gerar/ver: Menu → Início → **Extensões da Olist** → instalar extensão **Token API** (seção Vendas) → depois Menu → **Configurações → E-commerce → Token API**. (Na prática da Domoby também aparece em Configurações → Outras configurações → Token API.)
- **Formato das chamadas:** quase tudo é `POST` com corpo `application/x-www-form-urlencoded`, sempre com `token=...&formato=JSON`.
- ⚠️ Não confundir com "Configurações de API" — essa tela é da v3 (OAuth).
- ⚠️ O token dá **acesso total** à conta. Nunca em print, nunca em chat. (Já vazou uma vez; foi trocado.)
- Recomendação pendente: tirar o token do JSON do workflow → `TINY_TOKEN` no `docker-compose.yml` + `{{ $env.TINY_TOKEN }}` no node (ver [[N8N - API Tiny v2 vs v3]] §7).

## 1.2 Envelope de resposta (vale para TODOS os endpoints v2)

```json
{ "retorno": {
    "status_processamento": "3",   // 1 não processada · 2 com erros de validação · 3 OK · 4 parcial
    "status": "OK",                // "OK" ou "Erro"
    "codigo_erro": 32,             // só quando status = "Erro"
    "erros": [ { "erro": "..." } ] // idem
}}
```

🚨 **O HTTP é quase sempre 200, mesmo em erro.** O erro vem no corpo. Todo node HTTP → Tiny precisa de um IF `retorno.status == "OK"` depois.

### Códigos de erro (tabela oficial completa)

| Cód | Significado | Cód | Significado |
|---|---|---|---|
| 1 | Token não informado | 21 | Consulta retornou muitos registros |
| 2 | Token inválido/não encontrado | 22 | XML com mais registros que o lote permite |
| 3 | XML mal formado | 23 | Página inexistente |
| 4 | Erro de processamento de XML | 30 | Duplicidade de registro |
| 5 | API bloqueada ou sem acesso | 31 | Erros de validação |
| 6 | **Rate limit do minuto estourado** | 32 | **Registro não localizado** |
| 7 | Espaço da empresa esgotado | 33 | Registro em duplicidade |
| 8 | Empresa bloqueada | 34 | NF não autorizada |
| 9 | Sequência em duplicidade | 35 | Erro inesperado, tentar de novo |
| 10 | Parâmetro não informado | 99 | Sistema em manutenção |
| 11 | **Muitos acessos concorrentes** | 20 | Consulta sem registros |

## 1.3 Limites por plano

Fonte: https://tiny.com.br/api-docs/api2-limites-api (ainda com nomes antigos de plano)

| Plano (antigo) | Plano (atual) | Req/min |
|---|---|---|
| Começar | Avance | 0 (sem API) |
| Crescer | Construa | 30 |
| **Evoluir** | **Impulsione** | **60** |
| Potencializar | Domine/Protagonize | 120 |

- Concorrência: máx. **¼ do limite** simultâneas (Impulsione = 15). Estourou → erro 11.
- Lotes: máx. 20 registros por lote; pesquisas paginam de 100 em 100.
- Header `x-limit-api` na resposta = limite real da conta (bom para confirmar o plano).
- Estourou o minuto → erro 6, bloqueio momentâneo. Retry na janela seguinte resolve.

## 1.4 Catálogo COMPLETO de endpoints v2

Base: `https://api.tiny.com.br/api2/`. Todos POST form-urlencoded salvo indicação. Padrão de nome: **plural = pesquisa** (`pedidos.pesquisa.php`), **singular = ação** (`pedido.obter.php`). Endpoints mais novos vêm **sem `.php`** — usar a URL exatamente como está.

### Conta
| Serviço | Endpoint |
|---|---|
| Informações da conta | `info.php` |

### Contatos
| Serviço | Endpoint |
|---|---|
| Pesquisar | `contatos.pesquisa.php` |
| Obter | `contato.obter.php` |
| Incluir | `contato.incluir.php` |
| Alterar | `contato.alterar.php` |

### Produtos e estoque
| Serviço | Endpoint |
|---|---|
| Pesquisar produtos | `produtos.pesquisa.php` |
| Obter produto | `produto.obter.php` |
| Incluir / Alterar | `produto.incluir.php` / `produto.alterar.php` |
| Obter estoque | `produto.obter.estoque.php` |
| Atualizar estoque | `produto.atualizar.estoque.php` |
| Atualizar preços | `produto.atualizar.precos.php` |
| Estrutura (kit) | `produto.obter.estrutura.php` |
| Tags do produto | `produto.obter.tags` |
| Produtos alterados (delta) | `lista.atualizacoes.produtos` |
| Estoque alterado (delta) | `lista.atualizacoes.estoque` |
| Árvore de categorias | `produtos.categorias.arvore.php` |

### Pedidos ⭐ (o módulo que interessa)
| Serviço | Endpoint |
|---|---|
| Pesquisar | `pedidos.pesquisa.php` |
| Obter | `pedido.obter.php` |
| Incluir | `pedido.incluir.php` |
| Alterar | `pedido.alterar.php` |
| **Alterar situação** | **`pedido.alterar.situacao`** (sem `.php`!) |
| Gerar ordem de produção | `gerar.ordem.producao.pedido.php` |
| Gerar NF do pedido | `gerar.nota.fiscal.pedido.php` |
| Cadastrar cód. rastreamento | `cadastrar.codigo.rastreamento.pedido.php` |
| Incluir / remover marcadores | `pedido.marcadores.incluir` / `pedido.marcadores.remover` |
| Lançar / estornar estoque | `pedido.lancar.estoque.php` / `pedido.estornar.estoque.php` |
| Lançar / estornar contas | `pedido.lancar.contas.php` / `pedido.estornar.contas.php` |

### Notas fiscais (NF-e/NFC-e)
| Serviço | Endpoint |
|---|---|
| Pesquisar | `notas.fiscais.pesquisa.php` |
| Obter / XML / link | `nota.fiscal.obter.php` / `nota.fiscal.obter.xml.php` / `nota.fiscal.obter.link.php` |
| Incluir / emitir | `nota.fiscal.incluir.php` / `nota.fiscal.emitir.php` |
| Incluir via XML | `incluir.nota.xml.php` |
| NFC-e (consumidor) | `nota.fiscal.consumidor.incluir.php` |
| Marcadores | `notas.fiscais.marcadores.incluir` / `.remover` |
| Rastreamento na NF | `nota.fiscal.cadastrar.codigo.rastreamento.php` |
| Lançar estoque / contas | `nota.fiscal.lancar.estoque.php` / `nota.fiscal.lancar.contas.php` |

### NFS-e (serviço)
`notas.servico.pesquisa.php` · `nota.servico.obter.php` · `nota.servico.incluir.php` · `nota.servico.enviar.php` · `nota.servico.consultar.php`

### Financeiro
| Serviço | Endpoint |
|---|---|
| Contas a receber: pesquisar/obter/incluir | `contas.receber.pesquisa.php` / `conta.receber.obter.php` / `conta.receber.incluir.php` |
| Contas a receber: alterar / baixar | `contas.receber.alterar` / `conta.receber.baixar.php` |
| Formas de recebimento | `formas.recebimento.pesquisa.php` |
| Contas a pagar: pesquisar/obter/incluir/baixar | `contas.pagar.pesquisa.php` / `conta.pagar.obter.php` / `conta.pagar.incluir.php` / `conta.pagar.baixar.php` |

### Expedição
`expedicao.liberar.objetos.php` · `expedicao.pesquisa.php` · `expedicao.pesquisar.agrupamentos.php` · `expedicao.obter.php` · `expedicao.alterar.php` · `expedicao.incluir.agrupamento.php` · `expedicao.concluir.agrupamento.php` · `expedicao.obter.agrupamento.impressao.php` · `expedicao.obter.etiquetas.impressao.php` · `formas.envio.pesquisa.php` (GET) · `formas.envio.obter.php` (GET)

### Separação
`separacoes/pesquisar` (GET) · `separacao.obter.php` (GET) · alterar situação da separação (`situacao`: 1 Aguardando, 2 Separada, 3 Embalada, 4 Em separação — URL não exposta no corpo da doc; validar com teste antes de usar)

### CRM
`crm.lista.estagios.assunto.php` · `crm.pesquisa.php` · `crm.obter.assunto.php` · `crm.incluir.assunto.php` · `crm.incluir.acao.assunto.php` · `crm.alterar.estagio.assunto.php` · `crm.alterar.situacao.acao.php`

### PDV / Contratos / Tags / Outros
- PDV: `pdv.pedido.obter.php` · `pdv.pedidos.php` · `pdv.produtos.php` · `pdv.incluir.nota.xml.php` · `pdv.cancelar.nota.xml.php`
- Contratos: `contratos.pesquisa.php` · `contrato.obter.php` · `contrato.incluir.php` · `contrato.alterar.php` (+ adicionais)
- Tags: `tag.pesquisa.php` / `tag.incluir.php` / `tag.alterar.php` (+ `grupo.tag.*`)
- Listas de preços: `listas.precos.pesquisa.php` · `listas.precos.excecoes.php`
- Vendedores: `vendedores.pesquisa.php`

## 1.5 ⭐ `pedido.alterar.situacao` — o endpoint da nova automação

Doc: https://tiny.com.br/api-docs/api2-pedidos-alterar-situacao

```
POST https://api.tiny.com.br/api2/pedido.alterar.situacao
Content-Type: application/x-www-form-urlencoded

token={TOKEN}&id={ID_INTERNO}&situacao=entregue&formato=JSON
```

| Parâmetro | Obrigatório | Observação |
|---|---|---|
| `token` | sim | token v2 da conta |
| `id` | sim | **ID interno** do pedido (NÃO o número!) |
| `situacao` | sim | string da tabela abaixo |
| `formato` | sim | `JSON` |

**Valores aceitos para `situacao`:** `aberto` · `aprovado` · `preparando_envio` · `faturado` · `pronto_envio` · `enviado` · `entregue` · `nao_entregue` · `cancelado`

Sucesso: `{"retorno":{"status_processamento":"3","status":"OK"}}`
Erros prováveis: `32` (id não localizado), `31` (validação — ex. transição inválida), `2` (token), `6`/`11` (rate limit).

**Como obter o `id` a partir do `numero`** (que é o que está no card do ClickUp):

```
POST https://api.tiny.com.br/api2/pedidos.pesquisa.php
token={TOKEN}&numero={NUMERO}&formato=JSON
```

Resposta: `retorno.pedidos[].pedido.{id, numero, situacao, ...}`. Conferir `numero` de volta (igualdade exata) antes de usar o `id`.

## 1.6 Tabelas auxiliares

**Situações de pedido (v2 — strings):** ver 1.5. São as mesmas que chegam em `codigoSituacao` no webhook de vendas e no campo `situacao` do `pedido.obter` (que o workflow traduz para os rótulos da planilha: `entregue` → "Entregue").

**Situações de NF (numéricas):** 1 Pendente · 2 Emitida · 3 Cancelada · 4 Enviada-aguard. recibo · 5 Rejeitada · 6 Autorizada · 7 Emitida DANFE · 8 Registrada · 9 Enviada-aguard. protocolo · 10 Denegada

**Status da v2 (frase oficial):** "A API V2 continuará funcional **sem data estimada para descontinuação**, mas **não receberá mais atualizações ou novos recursos**."

---

# PARTE 2 · Webhooks (o Tiny chamando você)

## 2.1 Webhooks de CONTA — os que a Domoby usa

Tela: Menu → Configurações → Outras configurações → **Webhooks** (exige extensão "Webhooks" instalada; disponível no plano Evoluir/Impulsione e acima).

| Toggle na tela | O que dispara | Payload documentado? |
|---|---|---|
| **Notificações de vendas** | criação/alteração de pedido de venda | ✅ sim (abaixo) |
| Notificações de pedidos enviados | pedido marcado como enviado / rastreio | ❌ não publicado — capturar empiricamente |
| Lançamentos de estoque | movimentação de estoque | ❌ não publicado |
| Notas fiscais autorizadas | NF autorizada na SEFAZ | ❌ não publicado |

**Payload de "Notificações de vendas"** (o que chega no `Webhook Tiny` hoje):

```json
{ "versao": "1.0.0",
  "cnpj": "48404755000188",
  "tipo": "inclusao_pedido",            // ou "atualizacao_pedido" — só esses dois
  "dados": {
    "id": 0,                            // ID INTERNO → usar na API
    "numero": 0,                        // número visível → planilha/cards
    "data": "01/01/2020",
    "idPedidoEcommerce": "X123",
    "codigoSituacao": "aberto",         // string da tabela v2
    "descricaoSituacao": "Em aberto",
    "idContato": 0, "idNotaFiscal": 0, "nomeEcommerce": "",
    "formaEnvio": { "id": "", "descricao": "" },
    "cliente": { "nome": "", "cpfCnpj": "" } } }
```

Regras de entrega:

- Exige **HTTP 200**; sem 200, reenvia **até 10×** com atraso progressivo (+5 min por tentativa).
- **Não é assinado** (sem HMAC, sem header de verificação). Segurança = manter a URL secreta (UUID no path) + conferir `cnpj` no payload se quiser reforço.
- Mudança de situação (ex.: alguém marca "entregue") **dispara `atualizacao_pedido`** com o `codigoSituacao` novo. É assim que a planilha fica sabendo.
- Não existe evento de exclusão de pedido.

## 2.2 Webhooks de E-COMMERCE — NÃO usar (armadilha de doc)

O índice https://tiny.com.br/api-docs/api2-webhooks lista 7 webhooks (estoque, produtos, rastreio, NF, preços, `situacao_pedido`, cotação de frete) com payloads próprios e até 15 tentativas de reenvio. **São exclusivos de plataformas homologadas no hub de integrações da Olist** (Configurações → E-commerce → Integrações). Não é o mecanismo da tela de Webhooks da conta. Se você estiver lendo um payload com `idEcommerce`, está na seção errada da doc.

## 2.3 Webhooks na v3 / "API de Gatilhos"

- **A v3 NÃO tem webhooks próprios por aplicativo.** Frase da doc: "atualmente não é possível criar webhooks específicos por aplicativo". Os webhooks continuam sendo os de conta (2.1) — migrar de API não muda nada aqui.
- **"Gatilhos" do Tiny** = automações internas do ERP (lançamentos financeiros/estoque automáticos quando algo acontece). **Não é API para terceiros.** Não confundir com webhook.

---

# PARTE 3 · API v3 + Aplicativos (a "API interna" do Tiny)

## 3.1 Aplicativos

- Criados **dentro do próprio ERP**: Menu → Configurações → aba Geral → **Aplicativos** → "Novo aplicativo". Informa nome + **URL de redirecionamento** (redirect URI do OAuth).
- Gera **Client ID + Client Secret**. ("Dão acesso total aos dados da sua conta" — tratar como senha.)
- **Máximo 5 aplicativos por conta.** A Domoby já usa 1 (painel de recompra). Sobram 4.
- **Escopos por módulo**, 3 níveis: Leitura · Incluir e editar · Excluir. Alterou as permissões depois? Precisa **reautorizar no navegador**.

## 3.2 OAuth2 (Keycloak, realm `tiny`)

| Item | Valor |
|---|---|
| URL de autorização | `https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/auth` |
| URL de token | `https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token` |
| Grants | `authorization_code` (bootstrap, code de **uso único**) e `refresh_token` |
| Access token | expira em **4 horas** |
| Refresh token | expira em **24 horas** e **ROTACIONA a cada uso** (o novo invalida o anterior) |
| Uso | header `Authorization: Bearer {access_token}` |
| Expirou o refresh? | `invalid_grant` → **reautorização manual no navegador**, sem alternativa via API |

🚨 **Regra da casa (repetindo o modelo mental 5):** o renovador é o cron do Supabase (3/3h), e ele é o ÚNICO. n8n só lê. Dois renovadores = rotação cruzada = as duas integrações caem juntas.

## 3.3 Endpoints v3

- Base: `https://api.tiny.com.br/public-api/v3` · Doc: https://api-docs.erp.olist.com (OpenAPI publicado; índice em `/llms.txt`)
- Módulos: pedidos, produtos (variações/kits/imagens), estoque (**depósitos** — não existe na v2), notas fiscais, contatos, expedição, financeiro (pagar/receber), **orçamentos**, **ordens de compra**, **ordens de serviço**, CRM, categorias, marcas, vendedores, usuários.
- Rate limit (Impulsione): **60 leitura + 60 escrita por minuto, POR CONTA** (os 5 apps compartilham). Headers `X-RateLimit-Limit/Remaining/Reset`.

**Alterar situação na v3** (equivalente ao 1.5, se um dia migrar):

```
PUT https://api.tiny.com.br/public-api/v3/pedidos/{idPedido}/situacao
Authorization: Bearer {access_token}
Content-Type: application/json

{ "situacao": 6 }        // 6 = Entregue (tabela numérica! ver modelos mentais §4)
```

Sucesso: **204 No Content** (sem corpo — diferente da v2).

## 3.4 v2 × v3 — resumo da decisão

| | v2 | v3 |
|---|---|---|
| Token | estático, imortal | 4h + refresh 24h rotativo |
| Alterar situação de pedido | ✅ `pedido.alterar.situacao` | ✅ `PUT /pedidos/{id}/situacao` |
| Webhooks | de conta (2.1) | os mesmos (nada novo) |
| Exclusivos | — | depósitos, OS, OC, orçamentos |
| Custo operacional | zero | renovador 24/7 + monitoramento |

**Decisão vigente (12/08/2026): ficar na v2.** Tudo que a operação precisa existe nela. Reavaliar se a Olist publicar data de descontinuação ou se surgirem `401`/`403` em massa.

---

# PARTE 4 · ClickUp → mundo externo (para a automação de entrega)

## 4.1 Dois jeitos de saber que um card mudou de status

| | A · Automation "Call webhook" | B · Webhook da API (ClickUp Trigger do n8n) |
|---|---|---|
| Plano necessário | **Business+** ❌ | **qualquer plano** ✅ |
| Consome cota | ações de automação/mês | não |
| Payload | tarefa inteira (estado atual), sem before/after | `history_items` com **before/after** do status |
| Assinatura | não | **HMAC-SHA256** no header `X-Signature` |
| Filtro por lista | na própria automation | `list_id` no registro do webhook (1 nível por webhook) |
| Retry | ~1h15 de tentativas | 5× por evento; >7s de resposta = falha; **100 falhas = suspenso em silêncio** |

**Recomendação: caminho B**, via node **ClickUp Trigger** do n8n — registra o webhook sozinho, usa a credencial ClickUp que já existe no n8n (Access Token pessoal), funciona em qualquer plano e entrega o before/after.

## 4.2 Payload do evento `taskStatusUpdated`

```json
{ "event": "taskStatusUpdated",
  "task_id": "86ajzfpbg",
  "webhook_id": "7fa3ec74-...",
  "history_items": [{
     "id": "...", "type": 6, "date": "1642740510345",
     "user": { "id": 183, "username": "John" },
     "before": "a fazer",
     "after": "entregue" }] }
```

⚠️ Em algumas versões o `before`/`after` chega como **objeto** `{ "status": "entregue", ... }` em vez de string. Código robusto trata os dois casos.

⚠️ O payload **não traz o nome da tarefa** — precisa de um GET na task (`ClickUp → Task → Get`) para ler o nome (de onde sai o número do pedido) e a lista (para confirmar que é ROTAS).

## 4.3 Registro manual do webhook (se não usar o node Trigger)

```
POST https://api.clickup.com/api/v2/team/{team_id}/webhook
Authorization: {access_token}
{ "endpoint": "https://n8n.../webhook/...", "events": ["taskStatusUpdated"], "list_id": <id da lista ROTAS> }
```

Health: `GET`/`PUT /api/v2/webhook/{id}` (reativar depois de suspenso). Respostas 401/410 do endpoint suspendem na hora.

## 4.4 Rate limit da API do ClickUp

Free/Unlimited/Business: **100 req/min por token** (HTTP 429 ao estourar). Irrelevante no volume da Domoby.

---

# PARTE 5 · Lacunas conhecidas desta pesquisa

1. Payloads dos webhooks de conta "pedidos enviados", "estoque" e "NF autorizada" **não são publicados** — quando forem necessários, apontar para o n8n e capturar um evento real (ou webhook.site).
2. Mapeamento "Impulsione = Evoluir" é por posição de mercado, não confirmado em página oficial — o header `x-limit-api` na primeira chamada tira a dúvida (esperado: 60).
3. Rotação do refresh token v3 não é afirmada com todas as letras na doc oficial — mas é o comportamento padrão do Keycloak, confirmado por integradores. **Tratar como fato.**
4. URL exata do "alterar situação da separação" v2 não aparece no corpo da doc — validar com chamada de teste se um dia for usar.

# PARTE 6 · Fontes

- Índice v2: https://tiny.com.br/api-docs/api2 · Token: https://tiny.com.br/api-docs/api2-gerar-token-api
- Alterar situação: https://tiny.com.br/api-docs/api2-pedidos-alterar-situacao · Situações: https://tiny.com.br/api-docs/api2-tabelas-pedidos
- Erros/processamento: https://tiny.com.br/api-docs/api2-tabelas-processamento · Limites: https://tiny.com.br/api-docs/api2-limites-api
- Webhooks de conta: https://tiny.com.br/api-docs/api2-webhooks-tiny · Webhooks e-commerce: https://tiny.com.br/api-docs/api2-webhooks
- v2 vs v3 (posição oficial): https://tiny.com.br/api-docs/api
- Portal v3: https://api-docs.erp.olist.com (autenticação, limites, webhooks, `atualizar situação do pedido`, `/llms.txt`)
- Aplicativos v3: https://ajuda.olist.com/hubs-e-plataformas-via-api/aplicativos-api-v3-configuracoes-e-utilizacao
- OAuth v3 na prática (n8n): https://automasoluct.com.br/2025/12/12/token-api-tiny-n8n/
- ClickUp webhooks: https://developer.clickup.com/docs/webhooks · Assinatura: https://developer.clickup.com/docs/webhooksignature · Health: https://developer.clickup.com/docs/webhookhealth · Automations: https://help.clickup.com/hc/en-us/articles/31126817112343 · Limites de automation: https://help.clickup.com/hc/en-us/articles/23477062949911 · Rate limits: https://developer.clickup.com/docs/rate-limits
- n8n ClickUp Trigger: https://docs.n8n.io/integrations/builtin/trigger-nodes/n8n-nodes-base.clickuptrigger/

## Ver também

[[N8N - Tiny Modelos Mentais]] · [[N8N - API Tiny v2 vs v3]] · [[N8N - ROTAS Entregue para Tiny]] · [[N8N - Workflow Tiny para Planilha]]
