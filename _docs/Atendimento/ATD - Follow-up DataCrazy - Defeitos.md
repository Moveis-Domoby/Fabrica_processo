---
titulo: Follow up - atualização — defeitos encontrados
tipo: nota
criado: 2026-09-03
atualizado: 2026-09-17
tags: [atendimento, comercial]
---

# 🐞 `Follow up - atualização` — 15 defeitos

> [!info] Origem
> Migrada em 17/09/2026 do cofre da loja (`_Docs/automações datacrazy/FOLLOW UP - Defeitos Encontrados.md`, Painel de Recompra). Conteúdo preservado na íntegra; diagnóstico original de 03/09/2026.

Ordenados por severidade. Cada um tem o nó, a evidência (contador de execuções lido no editor) e a correção.

---

## 🔴 CRÍTICOS

### D1 · A mensagem 7 nunca foi enviada. Nenhuma vez.

**Nó `6fcaecf7` (msg 7) — 0 execuções.**
Os **296 leads** que chegaram à etapa 7 caíram todos no ramo FALSE de "janela de conversa está aberta" (`bfb5b02f`) e foram encerrados por `932d45e4` com a notificação *"finalizado por falta de janela aberta na etapa 7"* — **296 execuções nessa saída**.

**Causa:** a espera de **12 horas** antes da etapa 7 estoura a janela de 24h do WhatsApp. A janela conta a partir da última mensagem **do cliente** — que parou de responder lá no começo do fluxo. Quando o lead chega na etapa 7 (~18h depois da última mensagem da empresa, mas muito mais depois da última do cliente), a janela já fechou.

**A etapa 7 é estruturalmente inalcançável.** Ela existe no desenho e nunca existiu na prática.

**Correção:** a última mensagem só pode sair por **template aprovado (HSM)**, que funciona fora da janela. Sem HSM, remover a etapa 7 e mover o encerramento para a etapa 6.

---

### D2 · Nenhum lead jamais foi marcado como perdido

**Nós `45911eaa` e `4519de4c` (`lose-business`) — 0 execuções cada.**
Elas ficam **depois** da etapa 7 — que nunca roda (D1). Consequência em cadeia:
- O motivo de perda *"Não respondeu follow-up"* nunca é gravado.
- O card não é movido para a etapa de perda.
- O reset dos 7 campos adicionais (`d3f5a14f`) **nunca roda** — os campos `Follow up 1..7` ficam `True` para sempre no lead.
- **O funil de vendas não enxerga a perda.** Toda a análise de conversão da loja está cega para esses leads.

A anotação do próprio autor já avisava que isso dependia da automação "finalizar card" — e ela está **desligada** na lista de automações.

**Correção:** mover o `lose-business` + `finish-conversation` para um **bloco único de encerramento**, alcançado por todas as saídas do fluxo, não só pela ponta da etapa 7.

---

### D3 · 3 de cada 5 disparos morrem na janela de 24h, na entrada

**Nó `87edc5ee` — 5k entram, 2k passam.** Os outros ~3k saem por `e92e4653`, que já acumulou **23 erros**.

A automação gasta 60% do seu trabalho em leads que ela nunca poderá alcançar. E, mais grave: **esses leads não recebem nada e ninguém é avisado** — eles simplesmente somem.

**Correção:** quem não tem janela aberta não deveria ser descartado em silêncio; deveria ir para uma **fila de retomada por template (HSM)** ou gerar tarefa para o vendedor.

---

## 🟠 GRAVES

### D4 · Seis condições com o ramo TRUE vazio — e com tráfego real

Quando o campo `Follow up N` já está `True` (lead reentrando no fluxo — o que é comum, já que os campos nunca são zerados, ver D2), a condição vai para TRUE e **o fluxo simplesmente acaba ali**: sem limpar tag, sem mover card, sem encerrar atendimento.

| Nó | Condição | Execuções que passaram pelo nó |
|---|---|---|
| `667e6021` | tag de bloqueio / `Lead finalizado?` | 841 |
| `85c45f57` | `Follow up 3 = True` | 594 |
| `c208d721` | `Follow up 4 = True` | 556 |
| `19b8aa16` | `Follow up 5 = True` | 455 |
| `c3639fd8` | `Follow up 6 = True` | 362 |
| `37470be0` | `Follow up 7 = True` | 296 |

**Correção:** todo ramo TRUE aponta para o bloco único de encerramento.

---

### D5 · O fim de semana é tratado de um jeito nas etapas 1–4 e de outro nas 5 e 6

Nas etapas 1 a 4, o ramo "Sáb 18h → Dom 12h" vai para uma ação que limpa as tags. Nas etapas **5** (`f32cf95c`, **435 execuções**) e **6** (`1bafe036`, **451 execuções**) esse ramo está **vazio**.

Resultado: quase 900 leads caíram no fim de semana nas etapas 5 e 6 e **sumiram do fluxo com as tags `Em follow up N` presas**.

**Correção:** padronizar — os 7 blocos devem ser o mesmo sub-fluxo, não 7 cópias divergentes.

---

### D6 · Quando o cliente responde, ninguém é avisado

**464 pessoas responderam durante as esperas** (168 + 60 + 36 + 76 + 75 + 49). O fluxo move o card para "Follow up N concluído" e remove as tags — e **para por aí**:
- não notifica o vendedor
- não devolve o atendimento para a fila
- não marca o atendimento como "aguardando resposta"

A única notificação de *"O lead não possui atendente"* (`efeaaa81`) está no fim do fluxo e tem **0 execuções**.

É exatamente o que eu vi nas conversas reais: o cliente volta a falar e ninguém aparece. **Este defeito custa dinheiro toda semana** — a automação está fazendo o trabalho difícil (reacender o lead) e jogando fora o resultado.

**Correção:** no ramo "cliente respondeu": `stop-chat-automations` → mover card → **notificar o atendente responsável** → devolver para a fila de atendimento.

---

### D7 · A espera é feita com "Entrada do usuário", não com "Atraso de tempo"

As 8 esperas são blocos `text-input-message` com `timeoutInSeconds`. O editor tem um bloco próprio chamado **"Atraso de tempo"**, que é o correto.

Diferença prática: com "Entrada do usuário", **a automação fica segurando a sessão de conversa do lead** e captura a resposta dele antes do atendimento. Há inclusive uma `invalidResponseMessage` configurada — *"Poderia repetir, por favor?"* — que pode ir para o cliente sem que ninguém tenha pedido.

**Correção:** trocar as 8 esperas por "Atraso de tempo" e detectar a resposta do cliente por um gatilho separado de *mensagem recebida* que executa `stop-chat-automations`.

---

### D8 · Oito ramos FALSE vazios em "o negócio está na etapa esperada?"

`a5157a14` (168), `4ab5ddc3` (296), `1d670af3` (18), `f455d862` (15), `7dc9cf40` (60), `f707b63e` (2), `7eb04f56` (2), `1d680511` (2), `cfb3ab60` (1).

Se o vendedor (ou outra automação) mover o card antes, o fluxo morre sem limpar nada e o lead fica com tag de follow-up presa. **Somando D4, D5 e D8, são 14 pontas soltas com tráfego real.** É isso que o ⚠️ na lista de automações está apontando.

---

## 🟡 MÉDIOS

### D9 · O horário do fluxo não é o horário que a loja anuncia

| | Fluxo envia | Loja anuncia na recepção |
|---|---|---|
| Seg–Sex | 08:00 – **20:00** | 08:00 – 18:00 |
| Sábado | 08:00 – **18:00** | 08:00 – 16:00 |

O cliente recebe cobrança automática **até 2 horas depois** do horário que a própria loja disse que fecha.

### D10 · Fuso horário errado

Configurado `America/Bahia`. Natal/RN é `America/Fortaleza`. Hoje os dois estão em UTC−3 e não muda nada — é uma bomba-relógio, não um incêndio. Corrigir mesmo assim.

### D11 · Texto da mensagem 7 cortado no meio da palavra

> "…Se mudar de ideia, será um prazer te **atende**"

Não causou dano porque a mensagem nunca foi enviada (D1), mas mostra que ninguém revisou o fim do fluxo.

### D12 · Campo `follow up 2` em minúsculo

Os outros seis são `Follow up N`. Um campo com nome divergente é o tipo de coisa que quebra silenciosamente quando alguém for filtrar ou automatizar por cima.

---

## 🔵 DE CONTEÚDO (não são bugs — são decisões ruins)

### D13 · As mensagens 1, 2 e 3 são a mesma pergunta, três vezes em 1h15

"Ficou com alguma dúvida?" → "o que você gostaria de entender melhor?" → "posso verificar estoque, prazo e condição". Nenhuma traz informação nova. Follow-up sem informação nova ensina o cliente a ignorar a loja.

### D14 · A pergunta de qualificação chega na 5ª cobrança

*"Esse móvel é para sua casa, loja ou escritório?"* às **4 horas**, depois de duas tentativas de fechamento. É pergunta de abertura, não de cobrança — e soa como robô que não leu nada.

### D15 · A alavanca do gerente é queimada em escala industrial

*"Se eu conseguir com meu gerente…"* é a mensagem 4, disparada automaticamente em todo lead, todo dia. Concessão de gerente só funciona se for rara.

---

## Bônus · O gatilho está no evento errado

O gatilho é **"mensagem enviada pela empresa"**. Ou seja: a régua conta a partir da mensagem do vendedor, não do silêncio do cliente. Se o vendedor manda três mensagens seguidas, o relógio reinicia três vezes — e a automação entra por cima de conversas que o vendedor considera vivas. Nas conversas reais isso apareceu em **60% dos atendimentos analisados**.

---

## Ordem de correção sugerida

| # | Defeito | Esforço | Efeito |
|---|---|---|---|
| 1 | D6 — avisar o vendedor quando o cliente responde | 1 nó | **alto e imediato** — 464 respostas/período sendo jogadas fora |
| 2 | Bônus — trava de conversa viva no gatilho | 1 condição | alto |
| 3 | D2 — bloco único de encerramento com `lose-business` | remodelagem do fim | alto (funil deixa de ser cego) |
| 4 | D4/D5/D8 — fechar as 14 pontas soltas | médio | alto |
| 5 | D1/D3 — templates HSM para fora da janela | decisão + aprovação Meta | alto |
| 6 | D9/D10 — horário e fuso | trivial | médio |
| 7 | D7 — trocar espera por "Atraso de tempo" | médio | médio |
| 8 | D13/D14/D15/D11 — reescrever os textos | 1 hora | médio |

## Ver também

[[ATD - Follow-up DataCrazy - Anatomia]] · [[ATD - Follow-up DataCrazy - Fluxo v2]]
