---
titulo: TELA — Listas de Disparo
tipo: tela
atualizado: 2026-08-06
tags: [tela, disparo, campanha, front]
componente: src/components/ListasDisparo/
---

# 📣 TELA — Listas de Disparo

Comportamento e estados em [[MM - Maquina de Estados do Disparo]]. Tabelas em [[BD - Tabelas de Disparo]].

## Fluxo de uso, passo a passo

**1. Seleção do público** — em `CustomersTable`, o usuário entra em modo de seleção e escolhe clientes. `handleConfirmCriarLista` filtra `sortedData` por `selectedIds` e chama `onCriarLista`. `App.tsx` guarda em `selectedForLista` e abre `CriarListaModal`.

**2. Criação (`rascunho`)** — `CriarListaModal` separa `validData` (telefone com ≥8 dígitos) de `semTelefone` (ignorados, com aviso âmbar) e chama `criarListaRascunho`. Opcionalmente divide em N partes. Cria 1 lista + N membros + evento `lista_criada`.

**3. Adição posterior** *(opcional)* — `AdicionarListaModal` → `adicionarMembrosALista`.

**4. Mensagem** — textarea "Mensagem Utilizada" grava `listas_disparo.mensagem_utilizada`. ⚠️ **Esse texto nunca é enviado ao DataCrazy** — ver [[INT - DataCrazy]].

**5. Disparo (`disparando`)** — botão "Disparar" → `DispararModal` (intervalo, custo por mensagem, resumo de tempo) → `iniciarFila`. A partir daí o cron envia um contato por lista por ciclo.

**6. Fim da fila (`em_andamento`)** — automático quando não sobra ninguém, ou manual via "Finalizar disparo".

**7. Timers e resultado** — três crons trabalham: `processar-timers-disparo`, `webhook-datacrazy-resposta`, `verificar-vendas-disparo`.

**8. Encerramento (`encerrada`)** — "Parar contagem e encerrar lista" fecha todos os pendentes como `perdido / lista_encerrada_manualmente`. UI vira read-only com banner verde.

**Exclusão total:** `DELETE` em `listas_disparo` — a cascata apaga membros e eventos.

---

## Componentes

### `ListasDisparoDetalhe.tsx` (611 linhas) — a tela central

**Props:** `listaId`, `onBack`
**Estado interno (13):** `lista`, `membros`, `eventos`, `scorecards`, `loading`, `mensagem`, `isSavingMsg`, `isAuditoriaOpen`, `isDispararOpen`, `isSelectionMode`, `selectedIds`, edição de nome, `membroAuditoria`

**Fetch — duas funções:**
- `fetchData()` (com spinner): `listas_disparo`, `vw_scorecards_lista`, `listas_disparo_membros`, `listas_disparo_eventos`
- `fetchDataSilent()` (sem spinner, para polling): idem **menos os eventos**

**Polling:** `setInterval(fetchDataSilent, 8000)` enquanto o status for `disparando` ou `em_andamento`.

**Renderiza:** título editável inline · 9 scorecards (Membros, Enviados, Erros Envio, Resposta %, Conversão %, Custo, Receita, Ticket Médio, ROI %) · tabela de membros (Nome, Telefone, Status, Prazo com `CountdownTimer`, Ação) · barra de progresso · sidebar com a mensagem · export CSV via `Papa.unparse` (delimitador `;`)

**IDs de teste:** `btn-finalizar-disparo`, `btn-disparar-lista`, `btn-parar-contagem`

**Subcomponentes locais:** `ScoreCard`, `MembroStatusBadge`, `CountdownTimer` (recalcula a cada 60s no browser — puramente visual).

### `CriarListaModal.tsx` (333 linhas)
Card "Tamanho do Público" · aviso âmbar dos sem telefone · bloco "Dividir lista" com preview "Parte N · X clientes" · input do nome.

### `AdicionarListaModal.tsx` (152 linhas)
Contagem de leads + `<select>` de listas. ⚠️ Ao contrário do `CriarListaModal`, **não filtra clientes sem telefone** e **não exclui listas `encerrada`** do select.

### `DispararModal.tsx` (222 linhas)
Input de intervalo + toggle seg/min · input de custo por mensagem (default `0.35`) · card "Resumo do disparo" com tempo total estimado.
**Validação:** `intervaloSegundos < 10` → *"Intervalo mínimo é 10 segundos para evitar bloqueios."*

### `AuditoriaModal.tsx` (54 linhas)
Timeline vertical dos eventos da lista. Recebe pronto, não busca nada. Exibe `tipo_evento` **cru**.

### `MembroAuditoriaModal.tsx` (174 linhas)
Filtra `eventos.filter(ev => ev.membro_id === membro.id)`. Header com nome/telefone/status · grid de 4 datas (Disparo, Resposta + "após X", Prazo Resposta, Prazo/Data Resultado) · card verde "Valor Ganho" · timeline com dots coloridos.

### `ListasDropdown.tsx` (112 linhas)
Botão no header do App. Duas queries (`listas_disparo` e `vw_scorecards_lista` **inteira**) casadas em JS com `Array.find` — O(N×M).

### `ListasDisparoMain.tsx` — 🪦 órfão E quebrado
Tela-índice de campanhas. **Não é importada em lugar nenhum** (o `App.tsx` usa direto o `Detalhe`) **e** consulta colunas inexistentes: `.order('criada_em')` — o nome real é `criado_em`; e lê `total_membros`, `taxa_resposta`, `ganhos`, `receita_gerada`, que vivem na view, não na tabela. PostgREST devolve erro, `data` é `null`, e a tela renderiza permanentemente "Nenhuma lista encontrada".

---

## Camada de API — `src/lib/disparo/api.ts`

| Função | Tabelas | O que faz |
|---|---|---|
| `criarListaRascunho(nome, membros)` | INSERT lista + membros + evento | cria com `janela_resposta_dias:3`, `janela_resultado_dias:7`, `custo_disparo:0`; snapshots do cliente |
| `adicionarMembrosALista(listaId, membros)` | INSERT bulk + evento | mesmo mapeamento |
| `salvarMensagem(listaId, msg)` | UPDATE | não gera evento |
| `iniciarFila(listaId, intervalo, tarifa)` | UPDATE + evento | `status='disparando'` |
| `finalizarDisparo(listaId)` | UPDATE + evento | `status='em_andamento'` |
| `encerrarLista(listaId)` | UPDATE membros + lista + evento | fecha pendentes como perdidos |
| `removerMembrosDaListaBulk(ids, listaId)` | DELETE + evento | |
| `registrarEnvio` · `registrarResposta` · `removerMembroDaLista` | — | 🪦 **nunca chamadas** — substituídas pelas Edge Functions |

**Não há nenhuma chamada de RPC neste módulo** — tudo é PostgREST direto sobre tabelas/view, com a chave **anon** e RLS `public_full_access`. Ver [[BD - Seguranca e RLS]].

---

## 🐛 Problemas confirmados

### 🔴 Eventos com tipo fora do enum falham
`lista_renomeada`, `membros_adicionados`, `membro_removido`, `membros_removidos` **não existem** em `tipo_evento_disparo` → `invalid input value for enum`.

Pior: os erros são tratados de forma inconsistente.
- `handleSalvarNome` **não checa** o erro → o rename funciona, o log não
- `adicionarMembrosALista` **checa e lança** → o usuário vê "Erro ao adicionar à lista" **depois dos membros já terem sido inseridos**, e o modal não fecha
- `removerMembrosDaListaBulk` não checa → delete passa, auditoria não registra

**Correção:** `ALTER TYPE tipo_evento_disparo ADD VALUE ...` para os quatro.

### 🔴 Botão "Enviar" por linha provavelmente inoperante (CORS)
`disparar-membro-individual` é a única function chamada do browser e **nenhuma das 9 define headers CORS nem trata `OPTIONS`**. Ver [[INT - Edge Functions]].

### 🔴 Risco de mensagem duplicada
O `UPDATE` de envio não é condicionado a `status = 'aguardando_envio'`. O botão manual continua renderizado enquanto a lista está `disparando` (só os botões do cabeçalho são bloqueados) → o clique manual e o ciclo do cron podem ler o mesmo membro e **ambos dispararem**. O cliente recebe duas mensagens e o custo conta uma vez.

### 🔴 INSERT em massa quebra por telefone duplicado
Um único duplicado aborta o lote **inteiro** (constraint `UNIQUE (lista_id, telefone)`), e em `criarListaRascunho` sobra uma **lista vazia órfã**. Falta `.upsert(..., { onConflict: 'lista_id,telefone', ignoreDuplicates: true })`.

### 🟠 `AdicionarListaModal` não valida telefone
`normalizarTelefone(null)` devolve `''`, que passa no `NOT NULL` e vira **membro fantasma**; o segundo cliente sem telefone colide no UNIQUE e derruba o lote.

### 🟠 Divisão em N partes produz menos de N listas
`chunkSize = Math.ceil(validData.length / splitCount)`. Com 5 clientes em 4 partes: `ceil(1.25) = 2` → chunks de 2, 2, 1 = **3 listas**, e o botão prometia 4.

### 🟠 Validações usam a coleção errada
O botão de submit desabilita por `filteredData.length === 0` e o `max` do split é `filteredData.length`, mas a criação usa `validData`. Com 10 clientes **todos sem telefone**, o botão fica habilitado e só falha no submit.

### 🟠 Intervalo abaixo de 60s é ilusório
O modal aceita a partir de 10s e estima `n × intervalo`, mas o cron roda `* * * * *`. Um disparo de 200 contatos "a cada 10s" (estimado: 33 min) leva **~3h20**.

### 🟡 Polling
- **Eventos não são atualizados:** `fetchDataSilent` não recarrega `listas_disparo_eventos`. Os modais de auditoria ficam congelados no snapshot inicial.
- **Sobrescreve a edição da mensagem:** `setMensagem(prev => prev || listaData.mensagem_utilizada || '')`. Se o usuário **limpar** o textarea durante o disparo, `prev` é `''` (falsy) e o texto antigo volta em até 8 segundos.

### 🟡 Cosméticos e semânticos
- **Label invertido:** `{isSavingMsg ? 'Salvo' : 'Salvar'}` — mostra "Salvo" **enquanto** salva.
- **Tipos de evento errados:** `iniciarFila` grava `envio_registrado` para "Fila iniciada" (o modal de auditoria mapeia isso para "Mensagem Disparada"); `finalizarDisparo` grava `lista_encerrada` para algo que **não** encerra a lista.
- **`encerrado_em` e `filtros_aplicados` nunca preenchidos** — perde-se a rastreabilidade de "de onde veio esse público".
- **`handleRegistrarEnvio` chama `fetchData()`** (com spinner) em vez de `fetchDataSilent()`, piscando a tela a cada envio manual.
- **9 scorecards em `xl:grid-cols-8`** — o card de ROI cai sozinho na segunda linha.
- **`alert()`/`confirm()` nativos** apesar de `react-hot-toast` estar configurado.

### 🟡 `useDisparosData` sem paginação
Busca **todos** os membros de todas as listas uma vez no mount, sem refetch. Sujeito ao teto de ~1000 linhas do PostgREST — as badges da tabela de clientes começam a mostrar contagens **silenciosamente truncadas** conforme o histórico cresce.

## Ver também

- [[MM - Maquina de Estados do Disparo]] · [[INT - DataCrazy]] · [[BD - Tabelas de Disparo]] · [[BD - Views]]
