---
titulo: n8n — Pendências e Riscos
tipo: indice
atualizado: 2026-08-17
tags: [pendencias, riscos, n8n, debito-tecnico]
---

# 📌 n8n — Pendências e Riscos

> [!abstract] Como usar
> Item resolvido ganha `✅ resolvido em AAAA-MM-DD`, **sem apagar** — o histórico de problemas é parte da memória.

## 🔴 Prioridade alta

### P1 · Alerta de erro — NÃO EXISTE
Nenhum workflow tem Error Workflow configurado. O incidente de 11/08 ([[N8N - Incidente Credencial Google]]) foi descoberto ~2h depois, por acaso. Hoje são **4 integrações** que podem falhar em silêncio (Sheets, ClickUp, Trello, Tiny) — e falha significa pedido sem card de produção/rota.
**Fazer:** workflow `ALERTA - Erro n8n` com node **Error Trigger** → notificação (Telegram sugerido; e-mail exige SMTP). Depois, em cada workflow: ⋯ → Settings → Error Workflow. *Adiado a pedido do usuário em 12/08.*

### P2 · Migração 5 — cadastro de cliente
Em andamento, bloqueada aguardando o CSV das respostas. Plugga segue ativo nela. Ver [[N8N - Cadastro de Cliente (em andamento)]].

### P3 · Automações 6 e 7 do Plugga — não levantadas
Se alguma tiver gatilho em DADOS/OPERADORA/PCP, **está duplicando agora** (ver [[N8N - PCP Trello e ClickUp#Por que os cards duplicavam]]). Levantar nome + gatilho de cada uma.

### P4 · Token do Tiny v2 em texto puro no workflow — ⚠️ AGRAVADO em 17/08
Está no body dos nodes HTTP — aparece em prints e exports. Já vazou duas vezes: num print (trocado em 11/08) e **de novo em 17/08, num export de workflow colado em chat**. Agora são **3 nós** com o token literal (pedido.obter + os 2 do workflow ClickUp→Tiny). **Fazer, nesta ordem:** (1) `TINY_TOKEN` no docker-compose com o token atual + restart; (2) trocar os 3 nós para `{{ $env.TINY_TOKEN }}` e validar com evento real; (3) **gerar token novo no Tiny** e atualizar só o compose. Regra reforçada: antes de exportar/colar workflow em qualquer lugar, conferir se há segredo no JSON.

**↪️ 28/08, 23h:** o workflow do backfill usa `{{ $env.TINY_TOKEN }}` desde o nascimento — então o passo 1 do P4 (criar a variável no compose) virou **pré-requisito para rodar a carga**, e a janela sem venda é a hora de fazer os três passos de uma vez. Conferir com `docker exec n8n-n8n-1 printenv | grep -E "TINY_TOKEN|SUPABASE_FABRICA"`.

### P14 · Implantar a automação ROTAS "entregue" → Tiny ✅ resolvido em 2026-08-17
Projetada em 17/08, workflow pronto (`domoby-clickup-tiny-entregue.json` na pasta `Fabrica n8n/`). Falta: importar, conectar credencial ClickUp, colocar o token v2 nos 2 nodes HTTP, ativar e testar. Ver [[N8N - ROTAS Entregue para Tiny]]. *Urgência declarada pelo dono em 17/08.*
**Implantada e testada em produção em 17/08**: primeiro teste caiu na trava de idempotência (pedido 13093 já estava Entregue no Tiny — comportamento correto); segundo teste com pedido não-entregue completou a cadeia e marcou Entregue no ERP. Nome do status confirmado: **ENTREGUE** (filtro case-insensitive). ⚠️ A coluna já tinha **106 cards** em ENTREGUE antes da automação: eles **não** serão marcados retroativamente (o gatilho é a mudança de status, não o estado). Se quiser sincronizar o passado, montar depois um workflow manual estilo `FAXINA` que varre a coluna e chama a mesma cadeia de nodes do Tiny.

## 🟡 Prioridade média

### P5 · Desligar toggle "Receber notificações de pedidos enviados" no Tiny
Path `5b0fc553…` sem workflow escutando → 404 × 10 reenvios por evento. Religar quando existir fluxo de rastreio.

### P6 · Proteger a linha 1 da aba COMPLETO
`appendOrUpdate` casa por **nome exato de cabeçalho**. Renomear (7 têm acento) quebra em silêncio; renomear `PEDIDO tiny` faz o node **anexar** em vez de atualizar. Dados → Proteger intervalos → `COMPLETO!1:1`.

### P7 · Janela do corte do PCP ClickUp
Entre desligar o Plugga e salvar o ramo novo (12/08) pode ter entrado pedido sem tarefa. Conferir últimos pedidos da planilha × lista PCP.

### P8 · Caça-duplicatas para o ClickUp
Existe para o Trello (rodado 12/08: zero duplicatas). A lista PCP do ClickUp (~1.123 tarefas, alimentada por um Plugga que duplicava) não foi varrida.

## 🟢 Backlog

### P9 · Filtrar pedido cancelado na PCP (planilha)
Pedido cancelado continua na lista de produção (pré-existente ao n8n; hoje mais visível porque SITUAÇÃO atualiza). Correção pronta — trocar a fórmula da célula `AO2` da aba DADOS:
```
=ARRAYFORMULA(SE((E2:E="")+(COMPLETO!AJ2:AJ="Cancelado");"";A2:A & " - " & ARRUMAR(SPLIT(E2:E;","))))
```
**Falta aval do usuário para mexer em fórmula de produção.**

### P10 · Correção retroativa de SKU e QUANT. PRODUTOS
160 SKUs sem zero à esquerda + 91 quantidades corrompidas como data. A informação sobrevive intacta em `LISTA DE ITENS DO PEDIDO` (`Código:` / `Quantidade:`).

### P11 · Bug de fórmula: descrição com vírgula
9 itens do catálogo têm vírgula na descrição → DADOS/OPERADORA quebram o split. Pré-existente, não mudou com a migração.

### P12 · Limpezas do ClickUp (aguardando fase de organização)
Tarefa `teste` em GREENPALLETS; histórico da PCP; estrutura geral. Usuário decidiu arrumar **depois** das migrações.

### P13 · Medição de tempo de produção
Discutido, nada decidido. Ver [[FAB - Estrutura de Producao (Trello e ClickUp)#Medição de tempo de produção]].

### P15 · Migrar o banco de dados da planilha para o Supabase — **PROMOVIDA A PROJETO ATIVO em 17/08**
O dono decidiu iniciar: Supabase passa a ser o armazenamento canônico de clientes/pedidos (todos os dados possíveis, **incluindo o `id` interno do Tiny**), alimentado pelo webhook de vendas; os nós de planilha serão substituídos gradualmente conforme der certo. Estratégia acordada: **dupla escrita** primeiro (ramo Supabase em paralelo ao Sheets, zero risco), backfill do histórico, conferência de paridade, e só então desligar planilha — mesmo método dos cortes do Plugga. Com o id armazenado, a automação P14 pode trocar o passo `pedidos.pesquisa` por uma leitura no banco. O n8n já tem o id em toda execução (`Normalizar evento` → `dados.id`).

## Regras operacionais permanentes

> [!danger] Não fazer
> - **Renomear** os nodes `Normalizar evento` e `Tiny · pedido.obter` (referenciados por nome nos Codes)
> - **Renomear cabeçalhos** da aba COMPLETO
> - Mandar **token em print/chat**
> - Renovar token v3 fora do cron do Supabase ([[N8N - API Tiny v2 vs v3]])
> - Encadear destinos em série no canvas (ramos = paralelos)
> - Esquecer **pinned data** ligado depois de testar (tecla `p` despina)

> [!tip] Sempre fazer
> - Depois de mexer em Document ID/credencial do Sheets: reconferir match column + Options
> - Retry de execuções com erro **antes** de adicionar nodes novos
> - Corte: publicar n8n → desativar (não apagar) no Plugga → conferir primeiro caso real
