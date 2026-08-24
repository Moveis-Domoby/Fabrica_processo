---
titulo: n8n — Visão Geral da Migração Plugga → n8n
tipo: MOC
atualizado: 2026-08-13
tags: [moc, n8n, fabrica, migracao]
---

# 🏭 n8n — Visão Geral da Migração Plugga → n8n

> [!abstract] O que é isto
> A Domoby usava o **Plugga** para 7 automações ligando o ERP **Tiny (Olist)**, a planilha **Integração Domoby - Tinny**, o **Trello** e o **ClickUp**. Elas estão sendo migradas uma a uma para um **n8n self-hosted** (VPS Hostinger). Este conjunto de notas é a memória completa dessa migração — o que existe, por que cada decisão foi tomada, e o que ainda falta.

## Estado das 7 automações (13/08/2026)

| # | Automação | Origem → Destino | Status |
|---|---|---|---|
| 1 | Tiny → Planilha | webhook Tiny → aba COMPLETO | ✅ **em produção** desde 11/08 |
| 2 | ROTAS ClickUp | pedido → tarefa em DPTO LOGÍSTICA/ROTAS | ✅ **em produção** 12/08 |
| 3 | PCP Trello (`PCP - DOMMOBY 02`) | pedido → cards no quadro 1-PCP | ✅ **em produção** 12/08 |
| 4 | PCP ClickUp | pedido → tarefas em DPTO PRODUÇÃO/PCP | ✅ **em produção** 12/08 |
| 5 | Cadastro de cliente | formulário Google → contato no Tiny | 🔨 **em andamento** — ver [[N8N - Cadastro de Cliente (em andamento)]] |
| 6 | ? | não levantada | ⬜ |
| 7 | ? | não levantada | ⬜ |

> [!warning] As não levantadas podem estar duplicando
> Qualquer automação do Plugga ainda ligada com gatilho nas abas **DADOS, OPERADORA ou PCP** duplica registros hoje — a causa está em [[N8N - PCP Trello e ClickUp#Por que os cards duplicavam]].

## A arquitetura que substituiu o Plugga

O Plugga fazia *polling* na planilha (varria a cada minuto). O n8n inverte: tudo nasce do **webhook do Tiny**, no momento do pedido.

```
Tiny (webhook "Notificações de vendas")
  → Webhook Tiny → Normalizar evento → IF pedido → Tiny · pedido.obter → Retorno OK?
      → Mapear 49 colunas → Sheets · COMPLETO
            ├─→ Montar tarefa ClickUp → ClickUp · Criar tarefa   (ROTAS)
            └─→ Montar cards PCP ─┬─→ Criar Card PCP Trello
                                  └─→ Criar card PCP - clickup
```

Um workflow único, publicado, com ramos paralelos e independentes. A planilha continua sendo escrita (as abas derivadas e fórmulas dependem dela), mas **deixou de ser gatilho** de qualquer coisa.

## As notas desta seção

- [[N8N - Infraestrutura VPS]] — servidor, Docker, variáveis, credenciais
- [[N8N - Workflow Tiny para Planilha]] — a migração 1, nó a nó, com o código
- [[N8N - ROTAS ClickUp]] — a migração 2 e o formato do card
- [[N8N - PCP Trello e ClickUp]] — as migrações 3 e 4, o (k/n) e a duplicação
- [[N8N - Incidente Credencial Google]] — a queda de 11/08 e a correção definitiva
- [[N8N - API Tiny v2 vs v3]] — por que ficamos na v2, e o ativo do Supabase
- [[N8N - Cadastro de Cliente (em andamento)]] — a migração 5, parada aguardando o CSV
- [[N8N - Pendencias e Riscos]] — tudo que está em aberto, priorizado
- [[FAB - Estrutura de Producao (Trello e ClickUp)]] — como a fábrica se organiza nas ferramentas

## Relação com o projeto da loja (painel de recompra)

A loja tem um projeto separado — o **painel de recompra** (Supabase + DataCrazy), documentado no **cofre Obsidian da loja**. Os dois projetos tocam o mesmo ERP, mas por **APIs diferentes**:

- O painel de recompra usa a **API v3** (OAuth2, renovada por cron no Supabase)
- A migração n8n usa a **API v2** (token estático) — ver [[N8N - API Tiny v2 vs v3]]

> [!danger] Regra do dono único
> O refresh token da v3 **rotaciona** — cada renovação invalida a anterior. O cron do Supabase é o **único** renovador. Nenhuma outra aplicação (n8n incluso) pode renovar token v3, senão as duas integrações caem juntas.

## O método que funcionou (repetir nas próximas)

1. **Print da automação no Plugga** (telas "Ajustes" e "Personalize as infos")
2. **Um resultado real** (card/tarefa/linha criada) — copiar o formato de verdade em vez de deduzir
3. **Reconstruir offline e conferir contra os dados reais** antes de escrever o node — o mapeamento das 49 colunas foi validado contra 1.982 pedidos; o algoritmo da PCP contra as 758 linhas. Ambos 100%
4. Testar com **Execute step** (workflow despublicado ou pinned data), conferir o resultado, apagar o teste
5. Publicar → **desativar (não apagar) no Plugga** → acompanhar o primeiro caso real
6. Documentar aqui
