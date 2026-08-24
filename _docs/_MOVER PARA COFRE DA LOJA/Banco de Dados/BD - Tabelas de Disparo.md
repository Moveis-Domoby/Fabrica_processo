---
titulo: BD — Tabelas de Disparo
tipo: banco-de-dados
atualizado: 2026-08-06
tags: [banco, tabela, disparo, campanha]
---

# 📣 BD — Tabelas do Domínio de Disparo

Ver o comportamento em [[MM - Maquina de Estados do Disparo]] e a tela em [[TELA - Listas de Disparo]].

---

## `listas_disparo` — a campanha

> Comentário oficial: *"Campanhas de disparo/recompra vinculadas a uma lista no CRM DataCrazy"*

| Coluna | Tipo | Default / Constraint |
|---|---|---|
| `id` | `uuid` | **PK**, `gen_random_uuid()` |
| `nome` | `text` | NOT NULL |
| `descricao` | `text` | ⚠️ nunca preenchida |
| `filtros_aplicados` | `jsonb` | ⚠️ **nunca preenchida** — era para guardar o recorte que gerou a lista |
| `mensagem_utilizada` | `text` | documental — **não é enviada ao CRM** |
| `id_lista_crm` | `text` | ⚠️ nunca preenchida |
| `tag_crm` | `text` | ⚠️ nunca preenchida |
| `status` | `status_lista_disparo` | NOT NULL, `'rascunho'` |
| `custo_disparo` | `numeric(12,2)` | NOT NULL, `0` — legado |
| `janela_resposta_dias` | `integer` | NOT NULL, `3` |
| `janela_resultado_dias` | `integer` | NOT NULL, `7` |
| `criado_por` | `text` | texto livre, **não é FK para `auth.users`** |
| `criado_em` | `timestamptz` | NOT NULL, `now()` |
| `sincronizado_em` | `timestamptz` | resquício |
| `encerrado_em` | `timestamptz` | ⚠️ **`encerrarLista()` não preenche** |
| `intervalo_disparo_segundos` | `integer` | NOT NULL, `60` |
| `ultimo_envio_em` | `timestamptz` | usado pela fila para liberar o próximo |
| `categoria_mensagem` | `categoria_mensagem_whatsapp` | ⚠️ nunca preenchida |
| `tarifa_aplicada` | `numeric(10,4)` | fotografada no disparo, **não muda retroativamente** |

**Índices:** só a PK.
**RLS:** habilitado com `public_full_access` — `USING(true) WITH CHECK(true)`, todos os comandos. Ver [[BD - Seguranca e RLS]].

> [!warning] Rastreabilidade perdida
> `filtros_aplicados` foi projetada exatamente para responder "de onde veio esse público?" e nunca é gravada. Preenchê-la em `criarListaRascunho()` é uma correção de 3 linhas com alto valor analítico.

---

## `listas_disparo_membros` — o contato dentro da campanha

> Comentário: *"Contatos de uma lista de disparo, com snapshot e timers de resposta/resultado calculados pela aplicação"*

| Coluna | Tipo | Default / Constraint |
|---|---|---|
| `id` | `uuid` | **PK** |
| `lista_id` | `uuid` | NOT NULL, **FK → `listas_disparo(id)` ON DELETE CASCADE** |
| `cliente_id` | `uuid` | ⚠️ **sem FK, sem tabela de destino** — coluna órfã |
| `telefone` | `text` | NOT NULL |
| `nome_cliente` | `text` | |
| `id_lead_crm` | `text` | |
| `snapshot_total_gasto` | `numeric(12,2)` | congelado na criação |
| `snapshot_qtd_compras` | `integer` | congelado |
| `snapshot_ultima_compra` | `date` | congelado |
| `status` | `status_membro_disparo` | NOT NULL, `'aguardando_envio'` |
| `motivo_perda` | `motivo_perda_membro` | |
| `data_envio` | `timestamptz` | |
| `prazo_resposta_limite` | `timestamptz` | `data_envio + janela_resposta_dias` (dias úteis sem domingo) |
| `data_resposta` | `timestamptz` | |
| `prazo_resultado_limite` | `timestamptz` | `data_resposta + janela_resultado_dias` (corridos) |
| `data_resultado` | `timestamptz` | |
| `valor_ganho` | `numeric(12,2)` | soma das vendas atribuídas |
| `id_negocio_crm` | `text` | na prática guarda o `numero_pedido` da venda |
| `criado_em` | `timestamptz` | NOT NULL, `now()` |
| `atualizado_em` | `timestamptz` | NOT NULL, `now()` — ⚠️ **sem trigger `BEFORE UPDATE`**, depende da aplicação lembrar |

**Constraint chave:** `UNIQUE (lista_id, telefone)` — impede duplicar o mesmo telefone na mesma campanha.

> [!bug] Essa constraint derruba inserts em lote
> `criarListaRascunho` e `adicionarMembrosALista` fazem um único `.insert(array)`. **Um só telefone duplicado aborta o lote inteiro** — e em `criarListaRascunho` a lista já foi criada, sobrando uma lista vazia órfã. Falta `.upsert(..., { onConflict: 'lista_id,telefone', ignoreDuplicates: true })`. Ver [[DT - Indice de Problemas Conhecidos|DT-D8]].

**Índices:**

| Índice | Definição |
|---|---|
| `idx_membros_telefone` | `(telefone)` |
| `idx_membros_lista` | `(lista_id)` |
| `idx_membros_lista_id` | `(lista_id)` 🔁 duplicado |
| `idx_membros_status` | `(status)` |
| `idx_membros_prazo_resposta` | `(prazo_resposta_limite) WHERE status='aguardando_resposta'` — parcial, para o cron |
| `idx_membros_prazo_resultado` | `(prazo_resultado_limite) WHERE status='respondido_aguardando_resultado'` — parcial |

Os dois índices parciais são bem desenhados: cobrem exatamente as queries dos crons de timer.

**RLS:** `public_full_access` — leitura **e escrita** livres, incluindo `telefone`, `nome_cliente` e os snapshots financeiros.

---

## `listas_disparo_eventos` — o log de auditoria

> Comentário: *"Auditoria/log profissional de cada ação relevante da campanha"*

| Coluna | Tipo | Constraint |
|---|---|---|
| `id` | `uuid` | **PK** |
| `lista_id` | `uuid` | NOT NULL, FK → `listas_disparo` **ON DELETE CASCADE** |
| `membro_id` | `uuid` | FK → `listas_disparo_membros` **ON DELETE SET NULL** |
| `tipo_evento` | `tipo_evento_disparo` | NOT NULL |
| `descricao` | `text` | |
| `payload` | `jsonb` | |
| `criado_em` | `timestamptz` | NOT NULL, `now()` |

**Índice:** `idx_eventos_lista` em `(lista_id, criado_em DESC)`.

**RLS:** `public_full_access` — ou seja, **o "log imutável" é editável e deletável por qualquer chave anon**.

> [!bug] Eventos criados pelo front nunca têm `membro_id`
> Todos os INSERTs de `src/lib/disparo/api.ts` omitem o campo (só as Edge Functions preenchem). Como `MembroAuditoriaModal` filtra por `ev.membro_id === membro.id`, o histórico por cliente só mostra eventos server-side — remoções, adições e o início da fila nunca aparecem lá.

---

## `tarifas_mensagem_whatsapp` — histórico de preço

> Comentário: *"A tarifa vigente é sempre a linha mais recente de cada categoria"*

| Coluna | Tipo |
|---|---|
| `id` | `uuid` PK |
| `categoria` | `categoria_mensagem_whatsapp` NOT NULL |
| `valor_unitario` | `numeric(10,4)` NOT NULL |
| `vigente_desde` | `timestamptz` NOT NULL `now()` |
| `criado_por` | `text` |

**Índice:** `idx_tarifas_categoria_data` em `(categoria, vigente_desde DESC)` — desenhado para `DISTINCT ON`/`LIMIT 1`.

> [!danger] Tabela órfã + sem RLS
> **Nenhum código consulta esta tabela.** A tarifa vem digitada à mão no `DispararModal` (default `0.35`), e `listas_disparo.categoria_mensagem` nunca é preenchida.
> Pior: **RLS não está habilitado** e há `GRANT ALL TO anon`. Qualquer um com a chave anon pode alterar tarifas.

---

## `webhook_eventos_crm` — log bruto do CRM

> Comentário: *"Log bruto e imutável de todo payload recebido das automações do DataCrazy, antes do processamento"*

| Coluna | Tipo |
|---|---|
| `id` | `uuid` PK |
| `tipo` | `text` NOT NULL |
| `payload_bruto` | `jsonb` NOT NULL |
| `telefone_identificado` | `text` |
| `id_negocio_crm` | `text` |
| `processado` | `boolean` NOT NULL `false` |
| `erro_processamento` | `text` |
| `recebido_em` | `timestamptz` NOT NULL `now()` |
| `processado_em` | `timestamptz` |

**Índice:** `idx_webhook_processado` em `(processado, recebido_em)` — fila de processamento.
**RLS:** `public_read_only` — `FOR SELECT USING (true)`. ⚠️ `payload_bruto` contém PII do CRM e é **legível publicamente**.

## Ver também

- [[MM - Maquina de Estados do Disparo]] · [[INT - DataCrazy]] · [[BD - Views]]
