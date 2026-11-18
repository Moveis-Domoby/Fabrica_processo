---
id: D-50
aliases: [D-50, D-050]
titulo: "Integração Tiny → banco: edição no Tiny edita aqui, apagar no Tiny NÃO apaga aqui (só observações); conferência diária de 60 dias às 3h"
tipo: decisao
data: 2026-09-23
status: vigente
revisa: []
revisada_por: []
complementa: []
area: [tiny-n8n]
tags: [decisao, area/tiny-n8n]
---
# D-50 · Integração Tiny → banco: edição no Tiny edita aqui, apagar no Tiny NÃO apaga aqui (só observações); conferência diária de 60 dias às 3h (23/09/2026)

**Decidido (respostas do dono às perguntas da [[SESSAO-29 - Reconciliacao Tiny - Pente-fino e Ultimo Pacote Vence]], conversa da SESSAO-21):**

- **Regra de gravação** — palavras do dono: *"observação tudo bem, mas o resto deve manter mesmo que apague lá; a única coisa realmente que pode acontecer pra alterar aqui é editar pelo Tiny — edição lá deve editar aqui também, mas não apagar"*. Tradução: valor **novo** vindo do Tiny **sobrescreve** o do banco; campo **esvaziado** no Tiny **não apaga** o do banco — **exceto `obs` e `obs_interna`**, que acompanham o Tiny inclusive quando apagadas. (O `coalesce` do `fn_upsert_pedido` já faz "edição sim, apagar não" para todos os campos; a SESSAO-29 muda **só** as observações.)
- **Conferência diária (pente-fino):** relê os pedidos dos **últimos 60 dias**, às **3h da manhã**.
- **Retroativo (23/09):** a correção de 22/09 que apagou a previsão do 13276 foi **desfeita** (`supabase/manutencao/2026-09-23_restaurar_previsao_13276.sql`); as observações internas limpas (13180, 13410) seguem limpas; o vendedor apagado em 13183 e 13421 não tem o valor antigo guardado na plataforma — com o dono.

**Descartada:** "o último pacote do Tiny vence" também para campo apagado (a proposta B original da SESSAO-29).

- **Marcadores:** ficam como estão hoje — a lista do banco acompanha a do Tiny a cada atualização (marcador removido lá sai daqui também). Resposta do dono, 23/09: *"pode deixar do jeito que está atualmente"*.
- **Nada de depender de combinado com a equipe de vendas:** a plataforma tem que se virar sozinha com o que vier do Tiny (resposta do dono à pergunta 4 da SESSAO-29) — a proposta D ("nome do contato só com o nome") foi **descartada**; o que resolve contato renomeado é o pente-fino + a identidade do cliente pelo id do contato no Tiny (itens A e C da SESSAO-29).

**↪️ 01/10/2026 — entregue na SESSAO-29 (migration 49):** a conferência roda às 3h (06:00 UTC) pelo fluxo de carga do n8n, que agora é **acordado pelo banco só quando há pedido para reler** (o relógio de 1 em 1 minuto do n8n saiu — fazia ~1.400 execuções vazias por dia). Relê a busca do Tiny pelos últimos 60 dias (pega até pedido que nunca chegou) + os não terminados de qualquer idade. As observações acompanham o Tiny quando o Tiny manda o campo (vazio = apaga); se o campo nem vier, nada muda. **Gravar só o que mudou:** pedido igual ao Tiny não é regravado (nem os itens); cada rodada deixa UMA linha no log com quantos foram relidos, quais estavam diferentes e o quê — visível em Painel admin → Auditoria ([[D-095 - Auditoria no Painel admin o rastro de tudo quem quando onde|D-95]]). Cliente: [[D-098 - O cliente e achado pelo cadastro do Tiny o fluxo de vendas|D-98]]. Pedido achado só pela conferência: [[D-096 - O pedido vivo que so a conferencia achou entra no PCP|D-96]].
