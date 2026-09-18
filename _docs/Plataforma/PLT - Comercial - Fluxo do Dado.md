---
titulo: Comercial — Fluxo do Dado
tipo: nota
atualizado: 2026-09-17
tags: [comercial, plataforma, modelo-mental, pipeline, dados]
---

# 🌊 PLT — Comercial — Fluxo do Dado (do pedido no Tiny até o pixel na tela)

> [!info] Origem e estado
> Migrada do cofre da loja (Painel de Recompra) em 17/09/2026, **reescrita para o estado atual**: o domínio de dados vive no Supabase da fábrica desde a [[handoff_2026_09_16_sessao20_modulo_comercial|SESSAO-19/20]] e `vendas_marketing` agora é uma **view de compatibilidade**. Vale para o módulo Comercial na plataforma da fábrica.

> [!abstract] A pergunta que esta nota responde
> "Esse número na tela veio de onde?" — siga o caminho abaixo de trás para frente.

## O caminho completo (estado atual — banco da fábrica)

```
1. Pedido é criado OU editado no TINY ERP (site, marketplace ou balcão)
                    ↓  webhook em tempo real (n8n)
2. Pipeline da fábrica grava em `pedidos` (+ `clientes`, `pedido_itens`)
   · criação E edição chegam em minutos (fila `tiny_fila`)
   · `pedidos.raw` guarda o payload bruto do Tiny, itens incluídos
                    ↓
3. VIEW de compatibilidade `vendas_marketing`
   · mesmas colunas do recompra: numero_pedido, nome_cliente,
     telefone_cliente, data_compra, valor_pedido, numero_itens,
     itens_comprados (JSONB), id, created_at
   · gate de módulo: WHERE fn_tem_modulo('comercial') (migration 26)
                    ↓
4. RPCs agregam no Postgres (fn_dashboard_* / fn_filter_customers)
   · copiadas SEM ALTERAÇÃO do recompra (SESSAO-19) — nenhum número mudou
   · desde a migration 27: SECURITY DEFINER com fn_negar_sem_modulo
     no topo (nega com mensagem em vez de devolver vazio)
   · agrupam por COALESCE(NULLIF(TRIM(telefone_cliente),''), nome_cliente)
                    ↓  PostgREST, usuário AUTHENTICATED com módulo `comercial`
5. Hook React em src/comercial/ busca (react-query ou useEffect cru)
                    ↓
6. useMemo transforma → Recharts / HTML renderiza
```

**O que mudou em relação ao painel antigo:**

| Antes (loja) | Agora (fábrica) |
|---|---|
| `vendas_marketing` era **tabela**, alimentada por 3 Edge Functions de sync (`tiny-historico-mkt`, `tiny-incremental-sync`, `tiny-auditoria-sync`) + `pg_cron`/`pg_net` (`tick_*`) | `vendas_marketing` é **view** sobre `pedidos`+`clientes`+`pedido_itens`; a ingestão é o **webhook n8n da fábrica**, em tempo real. O trio de sync e as `tick_*` **não migraram** (redundantes) |
| Auditoria de reconciliação a cada ciclo (janela de 30 dias) | Redundante: o webhook recebe também **edições** de pedido (350 pedidos com edição registrada na verificação de 15/09) |
| Acesso do front com **chave anon** + RLS `USING (true)` | **Login `authenticated`** + RLS no padrão da casa, condicionada ao módulo `comercial`; `authenticated` **perdeu o SELECT direto** em `vendas_marketing` e `vw_clientes_consolidados` — as leituras diretas do front passaram pelas portas gateadas `fn_clientes_consolidados` e `fn_vendas_cliente` (SESSAO-20) |
| `tiny-auth-refresh` renovava o token no projeto antigo | A function **migrou** para a fábrica e está deployada, mas o cron dela só é agendado **no cutover** ([[SESSAO-21 - Uniao 3 - Cutover e Desligamento]]). Até lá, o token renova **só no projeto antigo** — dois renovadores simultâneos matam o token (refresh rotaciona, validade 24h) |

Detalhes do domínio no banco: [[SUPA - Comercial - Dominio de Dados]] · functions: [[SUPA - Comercial - Edge Functions]] · crons: [[SUPA - Comercial - Cron e Rotinas]].

> [!success] Paridade verificada (SESSAO-20, corte até 14/09)
> Receita **R$ 4.386.602,88** e **5.304 pedidos** batendo **ao centavo** entre os dois bancos; `revenue_chart` e `top_items` com **md5 idêntico**. Clientes 4.090×4.092 e recorrentes 808×806 — exatamente a **deriva de identidade** documentada na S19 (ver [[PLT - Comercial - Identidade do Cliente]]).

> [!warning] Incerteza registrada
> O plano previa duas formas de montar o `itens_comprados` da view (`pedido_itens` ou `pedidos.raw`). Qual foi a implementada não está dito nos handoffs lidos — conferir na migration da SESSAO-19 / [[SUPA - Comercial - Dominio de Dados]]. O md5 idêntico das RPCs de itens indica que o shape ficou compatível.

## Onde o dado pode se perder ou distorcer (ainda vale)

A view preserva o shape do recompra, então **quase todas as armadilhas antigas continuam**:

**① Ingestão (Tiny → view)**
- O telefone entra **como está no ERP**, sem normalização — formato conferido idêntico nos dois pipelines em 15/09 (ex.: `(84) 98892-9748`). Variantes com/sem DDI viram dois clientes. Ver [[PLT - Comercial - Identidade do Cliente]].
- `itens_comprados` chega em formatos variados (array JSON ou string contendo array serializado) — por isso as RPCs têm o teste `jsonb_typeof(...) = 'string' AND ... LIKE '[%'`.
- **Não há SKU** em lugar nenhum: o produto é identificado pela descrição textual; variação de grafia cria produto novo no relatório.
- Vendas de marketplace chegam sem CPF e com telefone mascarado — recompra cross-channel é estruturalmente difícil de medir.

**② Agregação no Postgres**
- A identidade do cliente é **recomputada em toda consulta**, sem índice funcional → seq scan + sort (DT-BD1).
- `EXTRACT(DAY FROM interval)` **trunca as horas**: 29 dias e 23h contam como 29 (DT-BD7).
- Truncamento silencioso: `LIMIT 15` na frequência de compra (DT-BD8). *(O `LIMIT 300` do top de itens foi removido em 2026-09-08 — DT-G2; hoje a RPC retorna o catálogo inteiro, ~938 itens.)*
- Buckets mensais (`TO_CHAR(data_compra,'YYYY-MM')`) usam o **timezone da sessão do banco (UTC)** — venda noturna do fim do mês pode cair no mês seguinte.

**③ Transporte**
- Limite default de ~1000 linhas do PostgREST em queries diretas sem paginação (`useDisparosData` — DT-D22).

**④ Front**
- ✅ O descompasso de fuso KPI×tabela foi **corrigido na Fase E (2026-09-08, DT-F1/F3)**: `fn_dashboard_scorecards(p_filters)` recebe o mesmo jsonb da tabela e resolve a janela em SQL.
- ✅ Meses sem venda no `RevenueChart` são preenchidos com zero desde 2026-09-08 (DT-G6).
- 🔶 O estado `loading` ainda é descartado por parte dos componentes do dashboard (DT-U1 parcial) — durante o fetch aparecem zeros/"Sem dados suficientes".
- `ItemsModal` refaz o recorte de período **em JavaScript**, divergindo do servidor (DT-F15).

## A regra de ouro para debugar "o número não bate"

> [!tip] Ordem de investigação
> 1. **É período?** Cada painel do dashboard tem seletor de período próprio, com defaults diferentes (DT-G13).
> 2. **É identidade?** Contagem de clientes ou taxa de recompra → suspeite de telefone duplicado/sem telefone antes de tudo. Inclui a deriva 4.090×4.092 entre banco antigo e novo.
> 3. **É definição?** "Itens" e "custo" ainda têm **duas definições** vivas cada; "recorrente" foi unificado (vida ≥ 2). Ver [[PLT - Comercial - Dicionario de Metricas]].
> 4. **É truncamento?** `LIMIT 15`, teto de ~1000 linhas do PostgREST.
> 5. **É fuso?** Bucket mensal em UTC.
> 6. **É gate?** Sem o módulo `comercial` no usuário, as RPCs **negam com mensagem** (não devolvem vazio) — se aparecer "Você não tem acesso ao módulo Comercial…", é permissão, não dado.

## Ver também

- [[PLT - Comercial - Identidade do Cliente]] · [[PLT - Comercial - Dicionario de Metricas]]
- [[SUPA - Comercial - Dominio de Dados]] · [[SUPA - Comercial - Edge Functions]]
- [[PLT - Plano Uniao das Plataformas]] · [[handoff_2026_09_16_sessao20_modulo_comercial]]
