---
titulo: n8n — Tiny GreenPallets → PCP ClickUp (automação nova)
tipo: workflow
atualizado: 2026-08-17
tags: [n8n, tiny, clickup, pcp, greenpallets]
---

# 🏭 Tiny GreenPallets → PCP no ClickUp

**Status: projetada em 17/08, não implantada.**
**Workflow a usar: `domoby-greenpallets-pcp-polling.json`** (polling — nesta pasta).
O `domoby-tiny2-pcp.json` (versão por webhook) fica **arquivado**: só serve se a GreenPallets um dia fizer upgrade de plano.

> [!warning] Por que polling e não webhook — decidido em 17/08 com print
> A extensão Webhooks apareceu **bloqueada** na loja da conta GreenPallets: "Extensão disponível para: Plano Evoluir e Potencializar", com botão de upgrade. O plano deles é **Crescer** → sem webhook. Confirma o que a doc oficial dizia. Solução: workflow **agendado (1×/hora)** que consulta `pedidos.pesquisa` da conta GP e cria os cards que faltam, com trava anti-duplicação na tabela `gp_pcp_processados` do Supabase ([[SUPA - Esquema do Banco]] — rodar o §7 do `.sql` antes de implantar).

> [!abstract] O que faz
> Pedido **novo** na conta Tiny da **GreenPallets** vira card de produção na **mesma lista PCP** do ClickUp DOMOBY (`DPTO PRODUÇÃO → PCP`, status `pedido`), no formato `GP-{pedido} - {descrição} (k/n)`. **Escopo decidido pelo dono em 17/08: SÓ os cards da PCP** — a conta GP não alimenta planilha, Supabase nem ROTAS.

## Contexto — quem é a conta 2

**GreenPallets**: empresa **parceira** da Domoby que usa a fábrica para produção (é dela a coluna `GREENPALLETS` que existe na lista PCP). Conta própria no Tiny (outro CNPJ), plano **Crescer** (API com 30 req/min), volume de **3–4 pedidos/mês**. Decisões do dono em 17/08: os cards entram na coluna **`pedido`** junto com os da Domoby (não na coluna GREENPALLETS), distinguidos pelo **prefixo `GP-`** no nome — as numerações das duas contas colidem, e sem prefixo não daria para saber a origem. Para remover o prefixo: constante `PREFIXO` no Code `Montar cards PCP`.

## A decisão: webhook separado, não o mesmo

Pergunta do dono: "dá para utilizar o mesmo webhook?" Dá, mas foi **descartado**:

| | Mesmo webhook/workflow | **Workflow separado (escolhido)** |
|---|---|---|
| Token da API | O `pedido.obter` teria que escolher o token pelo CNPJ do payload — cada conta Tiny tem token próprio | Cada workflow usa seu token (`TINY_TOKEN` / `TINY2_TOKEN`) |
| Risco | Toda mudança mexe no workflow mais crítico da operação (planilha + Supabase + ROTAS + PCP) | Erro na conta 2 não encosta na produção da conta 1 |
| Filtragem | IFs por CNPJ espalhados nos ramos (planilha/Supabase/ROTAS não valem para a conta 2) | Nenhuma — o workflow só faz o que deve |
| Operação | Liga/desliga tudo junto | Liga/desliga a conta 2 independente |

O webhook do Tiny é configurado **por conta** — a conta 2 aponta para uma URL própria e pronto. Reuso real: o Code `Montar cards PCP` é **byte a byte o mesmo** verificado contra as 758 linhas da PCP.

## A cadeia (polling, 9 nodes)

```
A cada hora → Tiny GP · pedidos.pesquisa (janela 21 dias) → Listar pedidos do período
                                                                     ↓
              Tiny GP · pedido.obter ← Supabase · trava anti-duplicação (claim-first)
                       ↓
                 Retorno OK? ──true──► Montar cards PCP (GP) → Criar card PCP - clickup
                       └──false──► Stop and Error (pedido já ficou marcado — ver nota do node)
```

Peças-chave:

- **Trava anti-duplicação (claim-first):** POST em `gp_pcp_processados` com `Prefer: resolution=ignore-duplicates,return=representation`. Pedido novo → insert devolve a linha e o fluxo segue; já processado → resposta vazia e o item morre ali. Por isso a janela de 21 dias pode se sobrepor à vontade entre ciclos.
- **`codigo_erro 20` ("consulta sem registros") é fim normal de ciclo**, não erro — a maioria das horas não tem pedido novo.
- Pedido **cancelado** antes do poll não vira card.
- O Code dos cards é o mesmo algoritmo verificado das 758 linhas, adaptado para processar vários pedidos por ciclo, com `PREFIXO = 'GP-'`.
- Token da GP só em `{{ $env.TINY2_TOKEN }}` (lição do P4 desde o dia 1).
- Se o `pedido.obter` falhar DEPOIS da trava, o pedido fica marcado sem card → execução vermelha com instrução no erro: apagar a linha em `gp_pcp_processados` para reprocessar no ciclo seguinte.

## Pré-requisitos

1. ~~Conferir se a conta tem webhook~~ ❌ **Confirmado por print em 17/08: extensão Webhooks BLOQUEADA no plano Crescer** ("disponível para Plano Evoluir e Potencializar") → por isso a versão por polling. A API v2 funciona normalmente no Crescer (30 req/min — o polling usa ~25/dia).
2. **Token v2 da GreenPallets**: gerar no painel dela (Configurações → geral → Outras configurações → **Token API** — a tela existe, aparece no print de 17/08) e **colar direto no compose, nunca em chat/print**.
3. **Rodar o §7 do `supabase-fabrica-schema.sql`** (tabela `gp_pcp_processados`) no SQL Editor do Supabase e marcar como aplicado em [[SUPA - Esquema do Banco]].

## Implantação

1. No VPS, adicionar ao bloco `environment:` do compose (junto das outras): `- TINY2_TOKEN=token_da_greenpallets` → `docker compose down && docker compose up -d` → conferir com `printenv`.
2. Importar `domoby-greenpallets-pcp-polling.json` como workflow novo. Conferir a credencial `Clickup Domoby` no último node.
3. **SEMEAR antes de ativar** — passo obrigatório: os pedidos GP dos últimos 21 dias já têm cards criados por fora, e o primeiro ciclo os veria como "novos". Então: **desabilitar o node `Criar card PCP - clickup`** (clicar nele → Deactivate) → rodar **Execute Workflow** uma vez → a trava registra todos os pedidos recentes em `gp_pcp_processados` **sem criar card nenhum** → **reabilitar o node** → salvar.
4. **Publicar** o workflow. Nada a configurar no painel da GreenPallets — o polling não depende de webhook.
5. Teste: criar um pedido de teste na conta GP com 2 itens → esperar o próximo ciclo (ou rodar Execute Workflow na mão) → conferir os cards `GP-...` na lista PCP → apagar os cards de teste **e a linha do pedido em `gp_pcp_processados`** (senão um pedido real com aquele id nunca existiria mesmo — é teste, mas fica o hábito). Rodar de novo → nada duplica.

## Riscos e observações

| Item | Avaliação |
|---|---|
| **Colisão de número de pedido** entre as contas | ✅ Resolvida pelo prefixo `GP-` no nome do card (decisão de 17/08). O (k/n) não se mistura (é calculado por execução) |
| Automação "entregue" (ROTAS) | Não é afetada — só olha a lista ROTAS, e a conta 2 não cria cards lá |
| Duplicação | Trava claim-first no Supabase: dois ciclos sobrepostos, retry, ou reativação do workflow **não** duplicam card |
| Card nasce em até 1h (não em segundos) | Aceitável por definição: produção de pallets não opera em minutos, e são 3–4 pedidos/mês |
| Pedido GP **editado** depois do card criado | O polling não atualiza card (mesma filosofia da PCP principal: card nasce uma vez). Mudança de itens depois → ajustar cards à mão |
| Alerta de erro | **Mais uma integração sem vigia — P1 fica ainda mais urgente (6ª)** |
| Futuro | Se um dia a conta 2 precisar de planilha/Supabase próprios, é outro projeto — hoje `pedidos.numero` no Supabase é único e colidiria; exigiria coluna de CNPJ/conta no esquema (registrar em [[SUPA - Esquema do Banco]] se acontecer) |

## Ver também

[[N8N - PCP Trello e ClickUp]] (a integração principal da PCP) · [[N8N - Pendencias e Riscos]] (P1, P4) · [[N8N - Tiny Integracoes Referencia]] (webhooks por conta, planos)
