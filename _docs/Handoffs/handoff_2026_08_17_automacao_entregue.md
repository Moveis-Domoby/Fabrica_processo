---
titulo: Handoff — 2026-08-17
tipo: handoff
data: 2026-08-17
atualizado: 2026-08-17
tags: [handoff, sessao, tiny, clickup, n8n]
---

# 📋 Handoff — 2026-08-17 · Pesquisa Tiny + automação ROTAS "entregue" → Tiny

## 1. Objetivo da sessão

Nas palavras do dono: (1) pesquisar **"tudo que conseguir a respeito de todas as integrações com o tiny"** — aplicativo/API interna, webhook, token, API v2, API v3, endpoints — no contexto do plano **Impulsione**; (2) documentar em **handoffs e modelos mentais** na máquina dele; (3) montar a automação: **card movido para a etapa "entregue" na lista ROTAS do ClickUp marca o pedido como entregue no Tiny**.

Mudança de rumo no meio: o dono declarou a intenção de **migrar aos poucos o banco da planilha para o Supabase** (incluindo o id interno do pedido do Tiny), mas explicitou que é para **outro momento** — a urgência é a automação de entrega. Registrado como P15, sem execução.

## 2. O que foi feito

### Pesquisa (verificada contra documentação oficial)

- API v2 completa: autenticação por token, **catálogo de todos os endpoints**, envelope `retorno`, tabela de códigos de erro, limites por plano (Impulsione ≈ Evoluir = 60 req/min, ¼ de concorrência).
- **Endpoint-chave encontrado e confirmado por fetch direto na doc oficial:** `POST https://api.tiny.com.br/api2/pedido.alterar.situacao` (sem `.php`), parâmetros `token` + `id` (interno!) + `situacao` + `formato`. Valores de situação: strings (`entregue`, `cancelado`…).
- API v3 + Aplicativos: OAuth2 Keycloak (`accounts.tiny.com.br`), access 4h, refresh 24h **rotativo**, máx. 5 apps/conta, escopos por módulo, `PUT /pedidos/{id}/situacao` com códigos **numéricos** (Entregue = 6), rate limit 60+60/min por conta.
- Webhooks: só "notificações de vendas" tem payload publicado; webhooks de e-commerce são outra coisa (só integradores homologados); **v3 não tem webhooks por app**; "Gatilhos" = automação interna do ERP, não é API.
- ClickUp: Automation "Call webhook" exige plano Business+; **webhook da API (`taskStatusUpdated`) funciona em qualquer plano** — é o caminho adotado, via node ClickUp Trigger do n8n.

### Produzido

- 3 notas novas no cofre + workflow importável (ver §5).
- Workflow **projetado, não implantado** (P14): ClickUp Trigger → filtro "entregue" → obter tarefa → validar lista ROTAS + extrair nº do card → `pedidos.pesquisa` (numero → id) → `pedido.alterar.situacao` → IF `retorno.status` com Stop and Error no ramo de falha.

## 3. Decisões tomadas

| Decisão | Alternativa descartada | Por quê |
|---|---|---|
| Gatilho = webhook da API do ClickUp (node ClickUp Trigger) | Automation nativa "Call webhook" | Automation exige Business+, consome cota mensal e não traz before/after; a API funciona em qualquer plano com a credencial já existente |
| Traduzir numero → id via `pedidos.pesquisa` a cada execução | Armazenar o id interno em algum lugar (planilha/Supabase/custom field) | Zero mudança nas automações em produção; 1 chamada extra é irrelevante a 60 req/min. Quando o Supabase existir (P15), o passo pode ser substituído por uma leitura |
| Nº do pedido extraído do NOME do card (`^\s*(\d+)`) | Custom field no ClickUp | O nome já começa com o número por construção (nosso próprio workflow cria os cards); custom field exigiria mexer na migração 2 em produção |
| Idempotência dentro do Code (`return []` se já entregue/cancelado) | Node IF | Mesma lição da migração 2: IF com expressão falha em silêncio |
| Pedido `cancelado` nunca vira `entregue` | Deixar passar | Automação não ressuscita pedido cancelado; recusa silenciosa |
| Falha do Tiny → Stop and Error (execução vermelha) | Ignorar o ramo false | Na v2 o HTTP volta 200 até em erro; vermelho é o que o futuro alerta (P1) vai capturar |
| Continuar na API v2 | Migrar para v3 | Tudo que a operação precisa existe na v2; a v3 põe token rotativo de 24h no caminho crítico (reafirma decisão de 12/08) |

## 4. Bugs

### Resolvidos
*Nenhum — sessão de pesquisa e projeto.*

### Descobertos
- **P14** (implantação pendente da automação) e **P15** (migração Supabase) adicionados a [[N8N - Pendencias e Riscos]].
- Achado de risco: webhook do ClickUp **suspende em silêncio** após 100 falhas e não reenvia eventos perdidos — reforça a urgência do P1 (alerta de erro), agora com 5 integrações sem vigia.

## 5. Arquivos alterados

```
Fabrica n8n/N8N - Tiny Modelos Mentais.md            (novo)
Fabrica n8n/N8N - Tiny Integracoes Referencia.md     (novo)
Fabrica n8n/N8N - ROTAS Entregue para Tiny.md        (novo)
Fabrica n8n/domoby-clickup-tiny-entregue.json        (novo — workflow importável)
Fabrica n8n/N8N - Pendencias e Riscos.md             (+P14, +P15)
000 - MAPA DO PROJETO.md                             (links novos + estado atual)
Handoffs/handoff_2026_08_17_automacao_entregue.md    (este arquivo)
```

## 6. Impacto nos números visíveis

Nenhum — nada foi implantado nesta sessão. Quando a automação entrar: a coluna SITUAÇÃO da planilha passará a virar "Entregue" sozinha segundos após o card ser movido (efeito em cascata via webhook de vendas — esperado, não é bug).

## 7. Notas do cofre atualizadas

- [[N8N - Tiny Modelos Mentais]] · [[N8N - Tiny Integracoes Referencia]] · [[N8N - ROTAS Entregue para Tiny]] (novas)
- [[N8N - Pendencias e Riscos]] (P14, P15)
- [[000 - MAPA DO PROJETO]] (seções novas)

## 8. Ficou pendente

### Aguardando decisão de negócio
- **Nome exato do status "entregue"** na lista ROTAS (abrir a lista → configuração de statuses). Se não for exatamente `entregue`, ajustar a constante `STATUS_ALVO` no node `Filtrar status entregue`.

### Próximo passo sugerido
1. Implantar P14 seguindo o passo a passo da seção 4 de [[N8N - ROTAS Entregue para Tiny]] (importar JSON → credenciais → token → status → ativar → testar).
2. Logo depois, atacar o **P1 (alerta de erro)** — esta automação depende dele para não falhar em silêncio.

## 9. Como validar

Roteiro completo na seção 5 de [[N8N - ROTAS Entregue para Tiny]]. Resumo: mover um card de teste para "entregue" → execução com 7 nodes verdes → pedido "Entregue" no Tiny → segunda execução (workflow da planilha) atualiza SITUAÇÃO → mover o card de novo → execução termina no `Escolher pedido no Tiny` com saída vazia (idempotência).
