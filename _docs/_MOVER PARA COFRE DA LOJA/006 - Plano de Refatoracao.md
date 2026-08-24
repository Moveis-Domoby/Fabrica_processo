---
titulo: Plano de Refatoração
tipo: plano
prioridade: alta
atualizado: 2026-08-06
status: não iniciado
tags: [plano, refatoracao, roadmap]
---

# 🛠️ Plano de Refatoração

> [!abstract] Objetivo
> Deixar o código organizado e profissional, o banco com segurança correta e estrutura adequada — **sem alterar o layout nem as funcionalidades atuais**.

> [!tip] Como usar esta nota
> São **6 fases independentes**, na ordem certa. Cada uma é uma sessão separada de chat.
> Cada fase traz: pré-requisitos, escopo exato, o **prompt inicial pronto para copiar**, o critério de pronto e os cuidados.
> **A análise já está feita** — está no cofre. Nenhuma fase deve começar com "analise o código".

---

## Visão geral

| Fase  | Tema                            |  Risco   | Modelo        | Muda números? |
| :---: | ------------------------------- | :------: | ------------- | :-----------: |
| **0** | Preparação e linha de base      |    —     | Sonnet        |      não      |
| **A** | Remoção de código morto         | 🟢 baixo | Sonnet        |      não      |
| **B** | Unificação da camada de dados   | 🟡 médio | Sonnet        |      não      |
| **C** | Segurança do banco (RLS)        | 🔴 alto  | Opus → Sonnet |      não      |
| **D** | Estrutura do banco e identidade | 🔴 alto  | Opus          |  **SIM** ⚠️   |
| **E** | Correção de bugs em lotes       | 🟡 médio | Sonnet        |    alguns     |

**Ordem importa.** A limpa primeiro (menos superfície para tudo depois), a estrutura por último (é o que mexe em números).

---

## Regras válidas para todas as fases

> [!warning] Inegociável
> 1. **Branch por fase.** `git checkout -b refactor/fase-a-codigo-morto`. Merge só depois de validar.
> 2. **Não alterar layout, cores, textos ou comportamento visível.** Se uma correção mudar o que o usuário vê, ela **não pertence** a esta fase — vai para a Fase E, com aviso.
> 3. **Editar arquivos direto, não imprimir código no chat.** Economiza tokens e o `git diff` mostra tudo.
> 4. **`npm run build` e `npm run lint` têm que passar** antes de encerrar a fase.
> 5. **Handoff obrigatório** ao final, usando o [[TEMPLATE - Handoff de Sessao]].
> 6. **Marcar no [[DT - Indice de Problemas Conhecidos]]** o que foi resolvido — `✅ resolvido em AAAA-MM-DD`, sem apagar o item.

---

## Fase 0 — Preparação e linha de base

**Por que existe:** não há **nenhum teste automatizado** no projeto. Refatorar sem rede é apostar. Esta fase é barata e paga por si nas cinco seguintes.

**Modelo:** Sonnet · **Risco:** nenhum

### Escopo
1. Testes de fumaça mínimos: a aplicação sobe, a tabela de clientes carrega, o dashboard renderiza sem erro, o build passa.
2. **Registrar a linha de base dos números** — isto é o mais importante da fase.
3. Versionar os cron jobs (`DT-ARQ5`): rodar `SELECT * FROM cron.job;` em produção e salvar o resultado no repositório.
4. Corrigir o script quebrado `supabase:migration:up` (`DT-ARQ4`).

### A linha de base

Com filtro em "Todo o período", anotar numa nota `Baseline - AAAA-MM-DD`:

| Métrica | Valor hoje |
|---|---|
| Total Clientes | |
| Total Pedidos | |
| Faturamento | |
| Taxa de Recompra | |
| Ticket Médio | |
| Clientes Únicos (dashboard) | |
| Recompradores | |

E as queries de contagem:
```sql
SELECT count(*) AS pedidos,
       count(DISTINCT COALESCE(NULLIF(TRIM(telefone_cliente),''), nome_cliente)) AS clientes
FROM vendas_marketing;
```

> [!danger] Sem essa linha de base, a Fase D é impossível de validar
> Você não vai conseguir distinguir "a correção funcionou" de "quebrou alguma coisa".

### Prompt inicial

```
Leia Obsidian/CLAUDE/000 - MAPA DO PROJETO e a Fase 0 de
Obsidian/CLAUDE/006 - Plano de Refatoracao.

Execute a Fase 0. Crie a branch, escreva os testes de fumaça,
corrija o script supabase:migration:up e monte a nota de linha
de base com as queries preenchidas.

Edite os arquivos direto, não imprima código no chat.
Ao terminar, rode o build e escreva o handoff.
```

### Pronto quando
- [ ] Branch criada, build e lint passando
- [ ] Testes de fumaça rodando
- [ ] Nota `Baseline - AAAA-MM-DD` criada com todos os números preenchidos
- [ ] `cron.job` versionado no repositório

---

## Fase A — Remoção de código morto

**Modelo:** Sonnet · **Risco:** 🟢 baixo · **Referência:** `DT-ARQ2`, `DT-ARQ3`, `DT-BD4`

### Escopo exato

**Apagar do front** (nenhum é importado por ninguém — confirmar com busca global antes):
```
src/hooks/useDashboardData.ts
src/hooks/useCustomerFilters.ts        ← perigoso manter: tem defaults DIFERENTES dos reais
src/hooks/useItemsData.ts
src/hooks/useTopItemsOverallData.ts
src/hooks/useTransitionData.ts
src/lib/datacrazy/client.ts
src/components/ListasDisparo/ListasDisparoMain.tsx   ← órfão E quebrado
```

**Remover de `src/lib/disparo/api.ts`** (nunca chamadas, substituídas pelas Edge Functions):
`registrarEnvio` · `registrarResposta` · `removerMembroDaLista`

**Remover dependência:** `@tanstack/react-virtual` do `package.json`

**Migration nova** — dropar a RPC legada com PII:
```sql
DROP FUNCTION IF EXISTS public.fn_dashboard_transitions(timestamptz, timestamptz);
```

**Dropar índices redundantes** (`DT-BD11`), na mesma migration:
```sql
DROP INDEX IF EXISTS idx_vendas_mkt_telefone;   -- duplica idx_vendas_marketing_telefone
DROP INDEX IF EXISTS idx_membros_lista_id;      -- duplica idx_membros_lista
DROP INDEX IF EXISTS idx_vendas_mkt_pedido;     -- duplica a UNIQUE de numero_pedido
```

**Corrigir os tipos que mentem** (`DT-ARQ7`, `DT-D11`):
- `SaleRecord.instagram_cliente` e `GroupedCustomer.instagram` — a coluna não existe
- `ScorecardsLista` — três campos com nome errado: o correto é `total_sem_resposta`, `total_expirados_sem_resultado`, `total_negocio_perdido_crm`

### Prompt inicial

```
Leia Obsidian/CLAUDE/000 - MAPA DO PROJETO e a Fase A de
Obsidian/CLAUDE/006 - Plano de Refatoracao.

Execute a Fase A: remover todo o código morto listado, sem alterar
layout nem funcionalidade. Antes de apagar cada arquivo, confirme
com busca global que ninguém o importa.

Edite os arquivos direto, não imprima código no chat.
Ao terminar: build, lint, atualize 020 - Arquitetura Geral e
BD - Visao Geral, marque DT-ARQ2/ARQ3/ARQ7/BD4/BD11/D11 como
resolvidos e escreva o handoff.
```

### Pronto quando
- [ ] Build e lint passando, nenhum import quebrado
- [ ] Migration de drop aplicada e testada
- [ ] Aplicação sobe e as três telas funcionam igual a antes
- [ ] Notas `020 - Arquitetura Geral` e `BD - Visao Geral` atualizadas

### Cuidado
`ListasDisparoMain.tsx` está quebrado, mas **confirme que ninguém o importa** antes de apagar. Se alguém importar, é porque a tela existe e está vazia — aí vira decisão de produto, não de limpeza.

---

## Fase B — Unificação da camada de dados

**Modelo:** Sonnet · **Risco:** 🟡 médio · **Referência:** `DT-ARQ1`, `DT-F5`, `DT-F6`

**Problema:** duas camadas concorrentes. `src/data/queries.ts` usa react-query (com cache e dedupe); `src/hooks/*` usa `useEffect` cru — sem cache, sem cancelamento, sem guarda de race condition.

### Escopo

Migrar para react-query, mantendo **exatamente a mesma assinatura pública** de cada hook:

```
useCustomersPaginated      ← prioridade: é a RPC mais cara do sistema
useScorecardsData
useRevenueChartData
usePurchaseFrequencyData
useTopClientsData
useFilterOptions
useDisparosData
```

**Regras da migração:**
- `queryKey` sempre com **strings serializáveis**, nunca objetos `Date` (é o que já funciona bem em `queries.ts`)
- Para `useCustomersPaginated`: `queryKey: ['customers', page, JSON.stringify(rpcFilters)]` — resolve cache, dedupe e cancelamento de uma vez
- **Adicionar debounce de 300ms** na busca (`DT-F5`) — é aqui que ele cabe
- Consolidar tudo em `src/data/queries.ts` ou manter em `src/hooks/` com o padrão unificado; escolher **um** e documentar

### Prompt inicial

```
Leia Obsidian/CLAUDE/000 - MAPA DO PROJETO, 020 - Arquitetura Geral
e a Fase B de Obsidian/CLAUDE/006 - Plano de Refatoracao.

Execute a Fase B: migrar os 7 hooks de useEffect cru para react-query,
mantendo a mesma assinatura pública. Adicione debounce de 300ms na busca.

Não altere layout nem comportamento visível — só a camada de dados.
Edite os arquivos direto, não imprima código no chat.
Ao terminar: build, lint, atualize 020 - Arquitetura Geral,
marque DT-ARQ1/F5/F6 e escreva o handoff.
```

### Pronto quando
- [ ] Nenhum `useEffect` fazendo fetch direto no `src/hooks/`
- [ ] Digitar na busca não dispara mais uma RPC por tecla
- [ ] Todas as telas com o mesmo comportamento visual de antes
- [ ] Nota `020 - Arquitetura Geral` reescrita (a seção das duas camadas deixa de existir)

### Cuidado
Os hooks de dashboard recebem objetos `Date` como dependência. Funciona hoje porque `usePeriodFilter` memoiza — mas é frágil. Ao migrar, **converta para string ISO na `queryKey`**, senão vira loop infinito de fetch.

---

## Fase C — Segurança do banco (RLS)

**Modelo:** Opus para o plano → Sonnet para aplicar · **Risco:** 🔴 alto
**Referência:** [[BD - Seguranca e RLS]], `DT-SEC1` a `DT-SEC8`

> [!danger] 🚧 BLOQUEADA — precisa de uma decisão sua antes de começar
> **A plataforma vai ter login de usuário?**
>
> **Se SIM** → Supabase Auth + políticas baseadas em `auth.uid()`. Mais trabalho, segurança de verdade, permite múltiplos usuários com permissões diferentes.
>
> **Se NÃO** (ferramenta interna, acesso controlado por outro meio) → front fica **somente leitura**, toda escrita migra para Edge Functions com `service_role`. Menos trabalho, mas exige refatorar `src/lib/disparo/api.ts` inteiro.
>
> São arquiteturas diferentes. **Responda isto antes de abrir a sessão.**

### Por que é a mais arriscada
Hoje o front **inteiro** funciona com a chave anon e RLS aberta (`USING(true)`). Fechar as políticas sem planejar **quebra a aplicação em produção**.

### Escopo, em ordem de risco crescente

**Passo 1 — grátis, faça já** (`DT-SEC2`):
```sql
REVOKE ALL ON FUNCTION public.tick_incremental_tiny() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.tick_historico_tiny()   FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.tick_auditoria_tiny()   FROM anon, authenticated;
```
Hoje qualquer visitante pode chamar isso em loop e disparar syncs contra o Tiny — derrubando, de quebra, a entrada de pedidos dos marketplaces.

**Passo 2** — mover o JWT anon das funções `tick_*` para o Vault (hoje está em **texto puro, versionado no git**).

**Passo 3** — habilitar RLS em `tarifas_mensagem_whatsapp` e `tiny_sync_state` (`DT-SEC4`).

**Passo 4** — `verify_jwt` por função: versionar `supabase/config.toml`, com `false` **apenas** para `webhook-datacrazy-resposta` (`DT-SEC6`).

**Passo 5** — fechar o módulo de disparo (`DT-SEC3`): trocar `public_full_access` por `SELECT`-only e mover escrita para Edge Functions. **É o passo caro** — refatora `src/lib/disparo/api.ts`.

**Passo 6** — resolver `DT-SEC1`: hoje a base completa de nomes e telefones é legível com a chave anon do bundle. Só a decisão lá em cima resolve isso de verdade.

### Prompt inicial

```
Leia Obsidian/CLAUDE/000 - MAPA DO PROJETO, BD - Seguranca e RLS
e a Fase C de Obsidian/CLAUDE/006 - Plano de Refatoracao.

DECISÃO JÁ TOMADA: a plataforma [TERÁ / NÃO TERÁ] login de usuário.

Antes de escrever qualquer migration, me apresente o plano completo:
o que muda, em que ordem, o que pode quebrar no front e como testar
cada passo. Só depois que eu aprovar, implemente.

Comece pelos passos 1 a 4, que são de baixo risco.
```

### Pronto quando
- [ ] Nenhuma tabela com `GRANT ALL TO anon` sem RLS
- [ ] Nenhum segredo em texto puro em migration versionada
- [ ] `config.toml` versionado com `verify_jwt` por função
- [ ] **Aplicação funcionando integralmente** — testar as três telas e um disparo real de ponta a ponta

### Cuidado
> [!danger] Teste em ambiente local antes de subir
> `npm run supabase:start` sobe o stack completo. Aplicar RLS direto em produção e descobrir que o front parou é o pior cenário possível deste plano.

---

## Fase D — Estrutura do banco e identidade do cliente

**Modelo:** Opus · **Risco:** 🔴 alto · **⚠️ MUDA OS NÚMEROS DO DASHBOARD**
**Referência:** [[MM - Identidade do Cliente]], `DT-BD1`, `DT-BD3`

**É a correção mais valiosa do projeto inteiro** — e a que exige mais cuidado de comunicação.

### D.1 — Normalizar a identidade do cliente (`DT-BD1`)

Hoje a identidade é `COALESCE(NULLIF(TRIM(telefone_cliente),''), nome_cliente)` **sem normalizar o telefone**. `84999674564` e `5584999674564` são clientes diferentes.

```sql
-- 1. coluna gerada + índices
ALTER TABLE vendas_marketing
  ADD COLUMN telefone_normalizado text
  GENERATED ALWAYS AS (
    NULLIF(REGEXP_REPLACE(COALESCE(telefone_cliente,''), '\D', '', 'g'), '')
  ) STORED;

CREATE INDEX idx_vm_tel_norm  ON vendas_marketing (telefone_normalizado);
CREATE INDEX idx_vm_cid_data  ON vendas_marketing (telefone_normalizado, data_compra);
```

> [!warning] Ordem obrigatória
> **Medir ANTES de aplicar:**
> ```sql
> SELECT count(*) FILTER (WHERE n > 1) AS identidades_que_vao_fundir
> FROM (
>   SELECT REGEXP_REPLACE(telefone_cliente,'\D','','g') AS norm,
>          count(DISTINCT telefone_cliente) n
>   FROM vendas_marketing
>   WHERE telefone_cliente IS NOT NULL
>   GROUP BY 1
> ) t;
> ```
> Esse número é **exatamente quanto os KPIs vão mudar**.
>
> **Trocar a expressão em TODAS as RPCs de uma vez.** Uma por vez faria painéis diferentes discordarem entre si durante a transição.
>
> RPCs afetadas: `fn_filter_customers`, `fn_dashboard_scorecards`, `fn_dashboard_purchase_frequency`, `fn_dashboard_transitions_summary`, `fn_dashboard_transition_clients`, e a view `vw_clientes_consolidados`.
>
> Também simplificar `CustomerLifetimeModal`, que hoje busca **4 variantes** do telefone — depois disso, uma basta.

**Efeito esperado:** menos clientes únicos · mais recompradores · **taxa de recompra maior** · mais transições no gráfico de intervalo. É o comportamento correto — mas **precisa ser anunciado antes**, ou vai parecer bug novo.

### D.2 — Normalizar `itens_comprados` (`DT-BD3`)

Hoje é JSONB sem contrato: cascata de 10 caminhos, sem índice GIN, sem SKU, produto identificado por descrição textual.

```sql
CREATE TABLE vendas_marketing_itens (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id       uuid NOT NULL REFERENCES vendas_marketing(id) ON DELETE CASCADE,
  sku            text,
  descricao      text NOT NULL,
  quantidade     integer NOT NULL DEFAULT 1,
  valor_unitario numeric(10,2)
);
CREATE INDEX ON vendas_marketing_itens (venda_id);
CREATE INDEX ON vendas_marketing_itens (descricao);
CREATE INDEX ON vendas_marketing_itens (sku);
```

Resolve de uma vez: performance dos filtros por produto, indexação, e a ambiguidade de "itens" descrita em [[MM - Dicionario de Metricas]].

**Migração:** backfill a partir do JSONB existente + adaptar as Edge Functions de sync para gravar nas duas estruturas durante a transição. **Manter `itens_comprados` até tudo estar migrado.**

> [!note] Oportunidade
> A API v3 do Tiny **já devolve o SKU** no detalhe do pedido (`itens[].produto.sku`) — nós só não gravamos. Aproveitar esta fase para capturar. Ver [[INT - Tiny ERP Olist]].

### D.3 — Materialized views (`DT-BD14`)

Com a estrutura arrumada, criar matviews de transições e de itens, com `REFRESH` no mesmo cron do incremental-sync. É a otimização de maior retorno do banco.

### Prompt inicial

```
Leia Obsidian/CLAUDE/000 - MAPA DO PROJETO, MM - Identidade do Cliente,
BD - vendas marketing e a Fase D de Obsidian/CLAUDE/006 - Plano de Refatoracao.

Vamos fazer só a D.1 (normalizar identidade do cliente) nesta sessão.

Primeiro rode a query de medição de impacto e me diga quantas
identidades vão se fundir. Depois me apresente o plano de migração
com todas as RPCs afetadas. Só implemente após minha aprovação.
```

### Pronto quando
- [ ] Impacto medido e **comunicado antes** de aplicar
- [ ] Todas as RPCs e a view usando a mesma expressão de identidade
- [ ] Números comparados com a linha de base da Fase 0, com a diferença **explicada**
- [ ] `MM - Identidade do Cliente` atualizada — o problema deixa de ser causa-raiz e vira histórico

### Cuidado
> [!danger] Faça D.1 e D.2 em sessões separadas
> São duas migrações grandes e independentes. Juntar as duas torna impossível saber qual causou o quê se algo der errado.

---

## Fase E — Correção de bugs em lotes

**Modelo:** Sonnet · **Risco:** 🟡 médio · **Referência:** [[DT - Indice de Problemas Conhecidos]]

Uma sessão por lote. Agrupados por área para aproveitar o contexto carregado.

### Lote E1 — Filtros e tabela *(alto impacto percebido)*
`DT-BD2` filtro de recompra sempre vazio · `DT-F2` página não reseta (estado sem saída) · `DT-F4` ordenação decorativa · `DT-F8` cache do ItemsModal mostra mês errado

### Lote E2 — Gráficos com número errado ⚠️ *muda valores*
`DT-G2` Top 30 Menos Comprados · `DT-G5` Ticket Médio dividido errado · `DT-G3` coluna Top Produtos vazia · `DT-G6` meses vazios não preenchidos · `DT-G7` tooltip de pedidos que nunca aparece

### Lote E3 — KPIs e fuso ⚠️ *muda valores*
`DT-F1` KPIs ignoram 6 dos 10 filtros — exige estender `fn_dashboard_scorecards` para receber o mesmo `p_filters` de `fn_filter_customers` · `DT-F3` fuso horário divergente entre KPI e tabela

### Lote E4 — Disparo *(críticos)*
`DT-D1` eventos fora do enum · `DT-D3` CORS nas Edge Functions · `DT-D4` ganho fechado cedo demais · `DT-D5` busca sem filtro de telefone · `DT-D7` risco de mensagem duplicada · `DT-D8` insert em lote quebra por duplicado

### Lote E5 — Semântica e UX
`DT-G4` rótulo "× vendido" incorreto · `DT-D10` mensagem que nunca é enviada · `DT-U1` loading descartado · `DT-G12` rótulo "(Vida)" que mente

### Prompt inicial *(exemplo, lote E1)*

```
Leia Obsidian/CLAUDE/000 - MAPA DO PROJETO, TELA - Filtros,
TELA - Painel Principal e o índice de débito técnico.

Corrija o Lote E1 da Fase D de 006 - Plano de Refatoracao:
DT-BD2, DT-F2, DT-F4 e DT-F8.

Cada correção deve ser um commit separado. Edite os arquivos direto.
Ao terminar: build, marque os IDs como resolvidos e escreva o handoff.
```

> [!warning] Lotes E2 e E3 mudam números visíveis
> Anunciar antes, e registrar o antes/depois na seção 6 do handoff.

---

## Decisões pendentes que bloqueiam fases

| # | Decisão | Bloqueia | Quem decide |
|:---:|---|:---:|---|
| 1 | A plataforma terá login de usuário? | Fase C | você |
| 2 | "Ticket Médio" = por pedido ou por cliente no segmento? | Lote E2 | você |
| 3 | "Itens" = unidades vendidas ou nº de pedidos em que aparece? | Lote E5 | você |
| 4 | "Recorrente" = 2+ compras na vida ou 2+ na janela? | Lote E3 | você |
| 5 | Atribuição de venda deve contar quem **não respondeu**? | fora do plano | você |

> [!tip] As decisões 2, 3 e 4 são baratas e destravam bastante
> Responda-as numa nota do cofre quando puder — cada resposta elimina uma adivinhação futura. Ver [[MM - Dicionario de Metricas]].

---

## Registro de execução

*Atualize conforme as fases forem concluídas.*

| Fase | Status | Data | Handoff |
|:---:|---|---|---|
| 0 | ⬜ não iniciado | | |
| A | ⬜ não iniciado | | |
| B | ⬜ não iniciado | | |
| C | 🚧 bloqueada (decisão 1) | | |
| D | ⬜ não iniciado | | |
| E | ⬜ não iniciado | | |

## Ver também

- [[000 - MAPA DO PROJETO]] · [[005 - Protocolo de Trabalho]] · [[DT - Indice de Problemas Conhecidos]] · [[MM - Identidade do Cliente]] · [[BD - Seguranca e RLS]]
