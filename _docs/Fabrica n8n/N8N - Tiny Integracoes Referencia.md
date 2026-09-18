---
titulo: n8n — Tiny: referência completa de integrações (v2, v3, webhooks, apps)
tipo: referencia
atualizado: 2026-09-17
tags: [n8n, tiny, api, webhooks, oauth, referencia, comercial]
---

# HANDOFF · Tiny (Olist) — TODAS as formas de integração

> [!info] Fusão com o cofre da loja (17/09/2026)
> Esta nota incorporou o conteúdo operacional da `INT - Tiny ERP Olist` do cofre do Painel de Recompra. Contexto: o painel virou o **módulo Comercial da plataforma** (banco movido na SESSAO-19, front na SESSAO-20 — ver [[handoff_2026_09_16_sessao20_modulo_comercial]]). A fábrica/n8n continua na **v2**; o domínio comercial usa a **v3** — e o renovador de token da v3 continua sendo **um único cron, no projeto Supabase antigo da loja, até o cutover da SESSAO-21**. As seções vindas da loja estão marcadas com 🆕.

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

## 2.4 🆕 Complementos da loja sobre webhooks (fusão 17/09/2026)

Aprendizados do projeto de recompra que valem para qualquer consumidor de webhook do Tiny na casa:

- **Não é possível registrar URL programaticamente.** A configuração é global por conta, na interface do ERP — todo onboarding/repontamento é uma etapa **manual**. (Relevante para o cutover da SESSAO-21.)
- **Sem assinatura documentada:** assuma o endpoint publicamente invocável. Proteção = URL de alta entropia + **validar o payload contra a API antes de agir**.
- **Arquitetura recomendada:** usar o webhook como **gatilho de invalidação**, não como fonte de dados — ao receber, enfileirar o `id` e fazer a leitura autoritativa via API (é o modelo mental 2, "campainha, não carteiro", de [[N8N - Tiny Modelos Mentais]]). Resolve ao mesmo tempo a ausência de assinatura, a entrega fora de ordem e o payload resumido.
- **Job de reconciliação:** manter uma varredura periódica por `dataAtualizacao` (a cada ~6h) para capturar eventos perdidos — no domínio comercial esse papel é do `tiny-auditoria-sync` (ver [[SUPA - Comercial - Edge Functions]]).

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

## 3.5 🆕 Detalhes REST da v3 (fusão 17/09/2026)

### Rebranding — dois domínios em allowlist

O produto migra de "Tiny" para "**Olist Tiny**":

| Coisa | Domínio |
|---|---|
| Documentação da API v3 | `api-docs.erp.olist.com` |
| **Hosts operacionais** | `api.tiny.com.br`, `erp.tiny.com.br`, `accounts.tiny.com.br` |

**Ambos os domínios precisam estar em allowlists/firewall.**

> [!warning] Armadilha de base URL
> Exemplos comunitários no GitHub usam `https://erp.tiny.com.br/api/v3/sales/orders`. **A base oficial é `https://api.tiny.com.br/public-api/v3`, com recursos em português.** Não confie em exemplos de terceiros.

### Contrato REST (diferenças práticas em relação à v2)

| Aspecto | v2 (legada) | v3 |
|---|---|---|
| Estilo | RPC — um `.php` por operação | REST (`GET /pedidos`, `PUT /pedidos/{id}/situacao`) |
| Formato | XML ou JSON | JSON |
| Erros | HTTP 200 com erro dentro de `{"retorno":{...}}` | códigos HTTP semânticos |
| Paginação | `pagina` (100 fixo) | `limit`/`offset` + objeto `paginacao {limit, offset, total}` |
| Datas | `dd/mm/yyyy` | ISO `yyyy-mm-dd` |

**Versionamento:** o path continua `/v3`; as versões menores (3.1.x) são aditivas. A 3.1.6 (ago/2026) adicionou Orçamentos, sem breaking changes.

## 3.6 🆕 OAuth v3 na prática — o renovador único e suas regras (fusão 17/09/2026)

### Fluxo

```
1. GET .../auth?client_id=&redirect_uri=&scope=openid&response_type=code
2. POST .../token  grant_type=authorization_code &client_id &client_secret &redirect_uri &code
3. Authorization: Bearer {access_token}
4. POST .../token  grant_type=refresh_token &client_id &client_secret &refresh_token
```

> [!note] Permissões são fixadas no consentimento
> Alterar as permissões do app depois **não se propaga sozinho** — o usuário precisa refazer o login/consentimento (é o mesmo aviso do §3.1, confirmado na doc oficial: *"marque o mínimo de opções necessárias"*).

> [!danger] A ARMADILHA — refresh token de 24h sem recuperação automática
> Se a integração ficar **mais de 24h sem renovar** — deploy longo, container parado, feriado, cron pausado, falha silenciosa do scheduler — o refresh token **morre e não há recuperação programática**: um humano com acesso ao ERP precisa reautorizar no navegador. Não existe `client_credentials` documentado para contornar. **É a principal causa de "a integração parou de funcionar sozinha".**

### O que o renovador (`tiny-auth-refresh`) segue

- Renovar **proativamente a cada ~3h**, não sob demanda.
- Persistir os tokens na tabela `tiny_auth`.
- **Sempre sobrescrever** o `refresh_token` com o valor da última resposta — o Keycloak tipicamente rotaciona; tratar como rotativo é seguro nos dois cenários.
- **Alertar** se a última renovação bem-sucedida passar de ~12h.

### Estado pós-união (a informação que importa em 09/2026)

- O banco do domínio comercial foi movido para o Supabase da fábrica na SESSAO-19, e o front na SESSAO-20 ([[handoff_2026_09_16_sessao20_modulo_comercial]]).
- **O cron renovador continua rodando SOMENTE no projeto Supabase antigo da loja** até o cutover da SESSAO-21. A **regra do dono único** segue absoluta: nenhum workflow do n8n, nenhuma function do projeto da fábrica e nenhum script avulso renova token — **só lê**. Ver [[N8N - API Tiny v2 vs v3]] e [[SUPA - Comercial - Cron e Rotinas]].

## 3.7 🆕 Endpoints v3 usados pelo domínio comercial (fusão 17/09/2026)

Os endpoints abaixo alimentam o módulo Comercial (recompra/RFM). Referência de campos e pegadinhas:

### `GET /pedidos`

| Parâmetro | Nota |
|---|---|
| `dataInicial` / `dataFinal` | sobre a data de **criação** |
| `dataAtualizacao` | valor **único**, sem par final — é o que se usa para sync incremental |
| `situacao` | enum numérico (ver tabela do modelo mental 4) |
| `cpfCnpj`, `nomeCliente`, `codigoCliente`, `numero` | |
| `numeroPedidoEcommerce`, `idVendedor`, `marcadores[]` | |
| `origemPedido` | `0` = Pedido de Venda, `1` = PDV |
| `limit` / `offset` | default 100 / 0 |

**Resposta:** `{ itens: [...], paginacao: { limit, offset, total } }`. Cada item traz `cliente { id, nome, cpfCnpj, telefone, celular, email, endereco }`, `ecommerce {...}`, `vendedor`, `transportador`.

> [!success] Boa notícia para recompra
> A **listagem já traz `cliente.id` e `cliente.cpfCnpj`** — análise de RFM (recência/frequência/valor) pode ser feita só com a listagem, sem N chamadas de detalhe.

### `GET /pedidos/{id}` — ⚠️ o padrão N+1 obrigatório

**Os `itens` do pedido não existem na listagem.** SKU, quantidade e valor unitário só aparecem no detalhe.

Exclusivos do detalhe: `itens[]` (com `produto {id, sku, descricao, tipo}`), `valorTotalProdutos`, `valorDesconto`, `valorFrete`, `pagamento`/`parcelas`, `pagamentosIntegrados`, `enderecoEntrega`, `idNotaFiscal`, `dataFaturamento`, `dataEntrega`, `dataEnvio`, `deposito`, `naturezaOperacao`, `observacoes`.

> [!danger] Custo real do backfill
> 10.000 pedidos = **~10.100 requisições** (100 de listagem + 10.000 de detalhe). A 30 req/min → ~5,6 horas; a 120 req/min → ~1,4h. É por isso que existe `tiny_sync_state` com ponteiro de retomada (ver [[SUPA - Comercial - Edge Functions]]).

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

Situações da NF: as mesmas numéricas do §1.6. O filtro **`idVenda`** é o elo NF ↔ pedido — útil para reconciliar faturamento efetivo contra pedidos criados.

### Situações de pedido v3 — a correção que salva funis

A tabela numérica completa está no modelo mental 4 de [[N8N - Tiny Modelos Mentais]] (0 Aberta · 1 Faturada · 2 Cancelada · 3 Aprovada · 4 Preparando Envio · 5 Enviada · 6 Entregue · 7 Pronto Envio · 8 Dados Incompletos · 9 Não Entregue).

> [!danger] CORREÇÃO IMPORTANTE — a suposição comum está errada
> Circula a ideia de que `7` = "atendido/entregue" e `8` = "faturada". **Está invertido:**
> - `7` é **Pronto Envio**, não entregue. **Entregue é `6`.**
> - `8` é **Dados Incompletos**, não faturada. **Faturada é `1`.**
>
> Usar 7 ou 8 com o significado errado **inverteria completamente o funil de vendas** em qualquer análise.

**Recorte sugerido para "venda efetivada":** `situacao IN (1, 3, 4, 5, 6, 7)` — excluindo `0` (Aberta), `8` (Dados Incompletos), `2` (Cancelada) e `9` (Não Entregue). O critério exato depende de a empresa reconhecer receita no faturamento ou na entrega — **alinhar com o financeiro e registrar aqui**.

⚠️ `situacao` é documentado como enum escalar (enquanto `marcadores` é explicitamente array) — provavelmente **não aceita múltiplos valores numa chamada**; capturar 6 situações exigiria 6 chamadas paginadas. *Não confirmado; validar.*

## 3.8 🆕 Rate limits v3 — tabela completa e boas práticas (fusão 17/09/2026)

**O limite é POR CONTA, não por aplicativo.** Citação literal: *"Se a conta possuir mais de um aplicativo ativo, eles compartilharão o mesmo limite."*

| Plano | Leitura | Escrita |
|---|---|---|
| Construa / Crescer / Parceiros | 30/min | 30/min |
| Evoluir / Impulsione | 60/min | 60/min |
| Domine | 120/min | 100/min |
| Protagonize / Potencializar | 140/min | 100/min |

Headers em toda resposta: `X-RateLimit-Limit` (capacidade/min) · `X-RateLimit-Remaining` (restantes) · `X-RateLimit-Reset` (segundos até o reset).

Boas práticas (do projeto de recompra):

- **Throttle proativo baseado em header**, não reativo: pausar quando `X-RateLimit-Remaining` cair abaixo de ~10%, dormindo `X-RateLimit-Reset` segundos.
- **Backoff exponencial com jitter** em 429/503 (1s, 2s, 4s… teto 60s).
- **Concorrência 1** (serial) é o mais seguro. Se paralelizar, ~1/4 do teto (a v2 documentava explicitamente esse limite de concorrência).
- **Nunca paralelizar entre aplicativos** da mesma conta.
- Preferir **carga incremental** por `dataAtualizacao` a full-refresh diário.

> [!danger] Um backfill agressivo derruba as integrações de marketplace da conta
> Como a cota é por conta, um script mal calibrado pode **fazer pedidos do Mercado Livre pararem de entrar no ERP**. Rodar cargas históricas em janelas de baixo movimento.

*O código HTTP literal `429` não aparece reproduzido na documentação oficial acessível (que documenta 400/401/403/404/500/503), mas SDKs comunitários o tratam explicitamente. **Implementar tratando 429 e 503.***

## 3.9 🆕 Armadilhas de dados (valem para v2 e v3 — fusão 17/09/2026)

### CPF/CNPJ como chave de cliente
- **Formatação livre** — o campo é string; pode vir `12345678900` ou `123.456.789-00`. **Normalizar sempre** removendo não-dígitos.
- **Frequentemente vazio** em vendas de marketplace (especialmente antes do faturamento). Agrupar ingenuamente colapsa tudo num "cliente fantasma".
- **CPF divergente entre pedido e entrega:** `enderecoEntrega` tem seu **próprio** `cpfCnpj` e `nomeDestinatario` — presentes, compras corporativas e dropshipping produzem essa divergência.
- **Melhor prática:** usar **`cliente.id`** (inteiro, PK do ERP) como chave canônica, e o CPF normalizado apenas como chave **secundária** para detectar cadastros duplicados no próprio ERP.

### Telefone
Três campos sobrepostos: `telefone`, `celular` e — só no detalhe — `telefoneAdicional`. Nenhum com formato garantido. Normalizar para E.164 com fallback `celular → telefone → telefoneAdicional`.

### Identificação do canal de venda
> [!warning] `origemPedido` NÃO identifica marketplace
> Ele só distingue `0` = Pedido de Venda e `1` = PDV. **O campo correto é o objeto `ecommerce`:**
> `ecommerce { id, nome, numeroPedidoEcommerce, numeroPedidoCanalVenda, canalVenda }`
> - `ecommerce.nome` → a integração/loja de origem; `canalVenda` → o canal propriamente dito.
> - `numeroPedidoEcommerce` vs `numeroPedidoCanalVenda` → dois IDs externos distintos (hubs intermediam: o pedido tem número no hub *e* no marketplace final).
> - **A lista de valores possíveis de `canalVenda` não é documentada** — descobrir com `SELECT DISTINCT` sobre os dados reais. **Não hardcode uma lista de marketplaces.**
> - Vendas diretas provavelmente vêm com `ecommerce` nulo — tratar como "venda direta/balcão", não como erro.

> [!danger] Recompra cross-channel é estruturalmente difícil
> Um mesmo consumidor comprando no Mercado Livre e depois na loja própria aparece como **dois clientes distintos** se o marketplace mascarar o CPF (prática comum). **Declarar essa limitação na análise** em vez de reportar números falsamente baixos.

### Formatos de data inconsistentes entre recursos (v3)
- `/produtos` → `dataCriacao`/`dataAlteracao` com hora (`2023-01-01 10:00:00`)
- `/notas` → `dataInicial`/`dataFinal` só data (`2023-01-01`)
- `/pedidos` → **o formato dos parâmetros não é especificado na doc**

E o nome varia: **`dataAlteracao`** em produtos vs **`dataAtualizacao`** em pedidos e contatos. Fácil de errar em código genérico.

### Janela de data em consultas históricas
**Não há limite documentado**, mas há um teto implícito via `paginacao.total × limit=100`. **Fatiar em janelas mensais ou semanais** de qualquer forma: torna a carga retomável, evita timeouts e mantém o `offset` baixo.

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

🆕 Herdadas do cofre da loja (fusão 17/09/2026) — validar empiricamente antes de depender delas:

5. Código HTTP literal 429 na v3 (a doc acessível documenta 400/401/403/404/500/503).
6. Limite máximo de janela de data em `GET /pedidos`.
7. Formato exato dos parâmetros de data em `GET /pedidos`.
8. Semântica de `dataAtualizacao` (ponto único vs "a partir de") — **relevante: é o campo do sync incremental do comercial**.
9. Se `situacao` aceita múltiplos valores numa chamada.
10. Lista de valores de `canalVenda` / `ecommerce.nome`.
11. Rótulos de `statusCrm` (`L`,`P`,`C`,`I`) e `tipoPessoa = X`.
12. Se kits (`tipo = K`) são desmembrados no `itens[]` do pedido.
13. Assinatura/headers dos webhooks e schema do payload de webhook na v3.
14. Existência de ambiente **sandbox** — nenhuma menção encontrada. **Presuma que testes ocorrem em produção** — risco operacional a declarar.

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
- 🆕 Referência v3 detalhada (da loja): [Autenticação](https://api-docs.erp.olist.com/documentacao/comecando/autenticacao) · [Criando um aplicativo](https://api-docs.erp.olist.com/documentacao/comecando/criando-um-aplicativo) · [Limites de consulta](https://api-docs.erp.olist.com/documentacao/comecando/limites-de-consulta) · [Webhooks](https://api-docs.erp.olist.com/documentacao/webhooks/webhooks) · [Listar pedidos](https://api-docs.erp.olist.com/api-reference/pedidos/listar-pedidos) · [Obter pedido](https://api-docs.erp.olist.com/api-reference/pedidos/obter-pedido) · [Listar contatos](https://api-docs.erp.olist.com/api-reference/contatos/listar-contatos) · [Listar produtos](https://api-docs.erp.olist.com/api-reference/produtos/listar-produtos) · [Listar notas](https://api-docs.erp.olist.com/api-reference/notas/listar-notas-fiscais)

## Ver também

[[N8N - Tiny Modelos Mentais]] · [[N8N - API Tiny v2 vs v3]] · [[N8N - ROTAS Entregue para Tiny]] · [[N8N - Workflow Tiny para Planilha]] · [[handoff_2026_09_16_sessao20_modulo_comercial]] · [[SUPA - Comercial - Edge Functions]] · [[SUPA - Comercial - Cron e Rotinas]] · [[PLT - Comercial - Integracao DataCrazy]]
