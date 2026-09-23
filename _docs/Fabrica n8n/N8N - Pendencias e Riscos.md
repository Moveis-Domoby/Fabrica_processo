---
titulo: n8n — Pendências e Riscos
tipo: indice
atualizado: 2026-09-21
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
**↪️ 03/09: desbloqueada e construída.** O CSV foi lido direto do Drive (806 respostas). Workflow em `domoby-formulario-cliente-tiny.json` (15 nodes), planilha preparada, **primeiro cadastro real gravado no Tiny em 03/09**. Falta o teste do CPF inválido e publicar. ⚠️ **O Pluga não existe mais há mais de um mês** — então o cadastro de cliente está simplesmente parado desde então, não há automação antiga rodando em paralelo. Ver [[N8N - Cadastro de Cliente]].

### P3 · Automações 6 e 7 do Plugga — não levantadas, e agora PARADAS
**↪️ 03/09 — encerrado por decisão do dono, com base em evidência.**
O Pluga foi desligado há mais de um mês. Nesse período **ninguém sentiu falta de nada**, e o dono não lembra o que as duas faziam. Um mês de silêncio operacional é o melhor teste disponível: se fossem críticas, já teria doído.

**Decisão:** não levantar. O P3 sai da lista de pendências.

> [!warning] A única ressalva: ciclo longo
> Um mês cobre bem o que era diário e semanal, e cobre mal o que era **mensal ou trimestral** — um relatório de fechamento, uma consolidação, algo que só aparece na virada. Se em outubro ou novembro alguém disser "aquilo não chega mais", é aqui que a resposta está. Reabrir este item nesse caso.

### P4 · Token do Tiny v2 em texto puro no workflow — ⚠️ AGRAVADO em 17/08
Está no body dos nodes HTTP — aparece em prints e exports. Já vazou duas vezes: num print (trocado em 11/08) e **de novo em 17/08, num export de workflow colado em chat**. Agora são **3 nós** com o token literal (pedido.obter + os 2 do workflow ClickUp→Tiny). **Fazer, nesta ordem:** (1) `TINY_TOKEN` no docker-compose com o token atual + restart; (2) trocar os 3 nós para `{{ $env.TINY_TOKEN }}` e validar com evento real; (3) **gerar token novo no Tiny** e atualizar só o compose. Regra reforçada: antes de exportar/colar workflow em qualquer lugar, conferir se há segredo no JSON.

**↪️ 03/09 — passo 1 concluído.**
`printenv` no container confirmou **`TINY_TOKEN` definida** e **`N8N_BLOCK_ENV_ACCESS_IN_NODE=false`** ✅.

Na conferência, a saída do `printenv` foi fotografada com o valor do token à mostra. **Exposição avaliada como contida pelo dono** (print só numa sessão do Claude, que ele apagou) → **rotação não feita agora**, segue como o passo 3 do P4. Terceira vez que o token aparece num print — a causa raiz é o comando, não a pessoa, e está corrigida abaixo.

> [!danger] Comando seguro para conferir variável daqui em diante
> Nunca rodar `printenv | grep TOKEN` cru. Use a versão que mostra só a presença:
> ```bash
> docker exec n8n-n8n-1 printenv | grep -E "TINY_TOKEN|N8N_BLOCK_ENV_ACCESS_IN_NODE" | sed -E 's/=.+/=<definida>/'
> ```
> Vale para qualquer segredo: `SUPABASE_FABRICA_KEY`, tokens do ClickUp e do Trello.

**Estado dos nós com token literal (03/09):** 3 — `pedido.obter` (workflow Tiny→Planilha) e os 2 do ClickUp→Tiny. Os workflows do backfill, Tiny 2 → PCP e cadastro de cliente já nascem com `$env`.

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

### P16 · Tiny da fábrica: estoque NEGATIVO em peças e insumos (registrado em 2026-09-21)
No estudo de 21/09 ([[N8N - Tiny Fabrica - Estudo do Cadastro]]) dezenas de matérias-primas (peças cortadas `… - A12`, `… - A54` etc.) aparecem com saldo físico negativo (ex.: A12 = −28, A54 = −14). Causa provável: a Ordem de Produção finalizada **baixa a estrutura (BOM)** do fabricado, mas ninguém dá **entrada** nas peças/insumos. **Decisão do dono em 21/09: saldo negativo está errado.** Não é bloqueio para a automação de produtos (ela só lê o catálogo), mas é bloqueio para qualquer conta de saldo/necessidade de produção da SESSAO-25. A decidir com o dono: dar entrada nas peças (ex.: OP das peças, ou entrada de compra dos insumos) ou tirar peças cortadas da estrutura. **Não corrigir por automação.**

### P17 · Webhook de vendas não cobre tudo — deriva silenciosa Tiny × banco (registrado em 2026-09-22)
Achado na conferência pedido a pedido da SESSAO-21 (setembro + os 5.360 do histórico; detalhe em `_docs/Plataforma/Execucao/SESSAO-21.md`). A fábrica depende **100% do webhook "Notificações de vendas"**, e três coisas nunca chegam ao banco:
1. **Marcador alterado sozinho** ("Alterar marcadores" é ação à parte no Tiny — não gera `atualizacao_pedido` nem ocorrência). Ex.: "Devolvido" posto depois do cancelamento — 10 pedidos.
2. **Contato renomeado** (é outro cadastro — não avisa o pedido). O nome guardado no pedido fica velho — 4 pedidos/2 cadastros.
3. **Campo limpo no Tiny** — o Tiny avisa, mas `fn_upsert_pedido` faz `coalesce` (vazio nunca apaga) e a coluna fica com o valor velho; e **vazio pode chegar como chave AUSENTE** no payload (ex.: `nome_vendedor`). Previsão, observação interna, vendedor — 5 pedidos.

**Corrigido o acumulado em 22/09** (15 pedidos + 2 cadastros, por SQL guardado em `supabase/manutencao/2026-09-22_correcoes_*.sql`, com ensaio e guarda). **A causa continua.** Agravante: a loja tinha uma reconciliação periódica (`tiny-auditoria-sync`) que morreu no cutover — hoje nada varre. Riscos correlatos: cliente **sem CPF** (4.507 de 10.667) é achado por nome+fone → **contato renomeado cria cliente duplicado** se o pedido for reprocessado.
**Correção de raiz proposta (decisão do dono):** A) pente-fino diário reusando `tiny_fila` + workflow de backfill (API v2, sem token novo); B) ~~"o último pacote do Tiny vence"~~ → **D-50 (dono, 23/09): edição no Tiny edita aqui, apagar no Tiny não apaga aqui — só `obs`/`obs_interna` acompanham o apagar** (janela 60 dias, 3h); C) identidade do cliente por `tiny_id_contato`; D) combinado de processo — nome do contato só com o nome. Demanda: [[SESSAO-29 - Reconciliacao Tiny - Pente-fino e Ultimo Pacote Vence]] (🔶 rascunho).

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
