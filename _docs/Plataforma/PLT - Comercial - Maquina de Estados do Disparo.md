---
titulo: Comercial — Máquina de Estados do Disparo
tipo: nota
atualizado: 2026-09-17
tags: [comercial, plataforma, modelo-mental, disparo, estados, campanha]
---

# 🔁 PLT — Comercial — Máquina de Estados do Disparo

> [!info] Origem e estado
> Migrada do cofre da loja (Painel de Recompra) em 17/09/2026. Vale para o módulo Comercial na plataforma da fábrica — tabelas, enums e Edge Functions foram copiadas idênticas (SESSAO-19). ⚠️ **Até o cutover ([[SESSAO-21 - Uniao 3 - Cutover e Desligamento]]) nenhum disparo acontece em nenhum dos dois painéis** (congelamento combinado, D-46) — ver a trava abaixo.

> [!abstract] O modelo em uma frase
> Uma **lista** é uma campanha; um **membro** é um contato dentro dela. A lista tem um ciclo curto (rascunho → disparando → encerrada); o membro tem um ciclo longo, movido por **três relógios independentes** e fechado por **crons**, não pela UI.

## 🔒 A trava de disparo em 3 camadas (SESSAO-20 — estado atual)

Os secrets do DataCrazy/Tiny já estão configurados na fábrica desde 15/09, então as functions de disparo **funcionam de verdade** — sem cron elas não partem sozinhas, mas um clique dispararia. Por isso a SESSAO-20 entregou o módulo atrás de uma trava explícita:

| Camada | Onde | O que faz |
|---|---|---|
| 1 | `DISPARO_LIBERADO = false` em `src/comercial/travas.ts` | flag única que governa tudo |
| 2 | Botões de disparo **desabilitados com explicação** na UI (`btn-disparar-lista`, "Enviar" por linha) | ninguém clica por engano |
| 3 | Guarda dentro de `handleRegistrarEnvio` e `iniciarFila` | nenhum caminho de código dispara, mesmo chamado programaticamente |

Verificado na S20: nenhuma chamada saiu; `listas_disparo_*` intactas (128 membros, checksum de status idêntico ao da carga da S19). **A SESSAO-21 destrava com uma linha** (virar a flag) — e só então agenda os crons na fábrica. Além disso, os **crons de disparo não estão agendados** no banco da fábrica (camada extra de segurança até o cutover), e o webhook do DataCrazy ainda aponta para o projeto antigo.

## Estados da LISTA — `status_lista_disparo`

```
rascunho ──iniciarFila()──► disparando ──fila esgota──► em_andamento ──encerrarLista()──► encerrada
                                │                          ▲
                                └──finalizarDisparo()──────┘
```

| Status | Quem grava | Significado |
|---|---|---|
| `rascunho` | `criarListaRascunho()` (default da coluna) | criada, nada enviado |
| `sincronizada` | **ninguém** | resquício do desenho original (sincronizar leads via API do CRM) |
| `disparando` | `iniciarFila()` | fila ativa, o cron está enviando |
| `em_andamento` | `enviar-proximo-disparo` (fila vazia) ou `finalizarDisparo()` | envio concluído/interrompido; **timers ainda correndo** |
| `encerrada` | `encerrarLista()` | congelada, dados consolidados, UI read-only |

## Estados do MEMBRO — `status_membro_disparo`

```
                 ┌──────────────────────┐
                 │   aguardando_envio   │  ← default no INSERT
                 └──────────┬───────────┘
   enviar-proximo-disparo   │   disparar-membro-individual
   (cron, 1×/min)           │   (botão "Enviar" da linha)
                            ▼
                 ┌──────────────────────┐
                 │ aguardando_resposta  │  grava data_envio + prazo_resposta_limite
                 └───┬────────┬─────┬───┘
    webhook           │        │     │  webhook event=erro_envio
    resposta_recebida │        │     └──────────► perdido / erro_envio_mensagem
                      │        │
                      │        │  processar-timers-disparo (prazo estourou)
                      │        │  OU webhook event=sem_resposta
                      │        └──────────────► perdido / sem_resposta_no_prazo
                      ▼
      ┌──────────────────────────────────┐
      │ respondido_aguardando_resultado  │  grava data_resposta + prazo_resultado_limite
      └──────────┬──────────────┬────────┘
  verificar-vendas-disparo      │  verificar-vendas-disparo
  achou venda na janela         │  prazo expirou, nenhuma venda
                     ▼          ▼
                  ganho     perdido / prazo_resultado_expirado
             valor_ganho,
             id_negocio_crm

 (de QUALQUER estado não-final) ──encerrarLista()──► perdido / lista_encerrada_manualmente
```

**Estados finais:** `ganho`, `perdido`.

## Motivos de perda — `motivo_perda_membro`

| Valor | Quem grava | Label na UI |
|---|---|---|
| `sem_resposta_no_prazo` | `processar-timers-disparo`; webhook `sem_resposta` | "Sem resposta" |
| `prazo_resultado_expirado` | `verificar-vendas-disparo` | "Prazo expirado" |
| `erro_envio_mensagem` | webhook `erro_envio` | "Erro no envio" |
| `lista_encerrada_manualmente` | `encerrarLista()` | "Lista encerrada" |
| `negocio_perdido_crm` | **ninguém** | "Negócio perdido" — resquício |

## Os três relógios

| Relógio | Duração | Contado a partir de | Calculado por | Fechado por |
|---|---|---|---|---|
| **Intervalo entre envios** | `intervalo_disparo_segundos` (60) | `ultimo_envio_em` | `enviar-proximo-disparo` | — |
| **Janela de resposta** | `janela_resposta_dias` (3), **dias úteis sem domingo** | `data_envio` | `enviar-proximo-disparo` / `disparar-membro-individual` | `processar-timers-disparo` ou webhook |
| **Janela de resultado** | `janela_resultado_dias` (7), **dias corridos** | `data_resposta` | `webhook-datacrazy-resposta` | `verificar-vendas-disparo` |

> [!note] O `CountdownTimer` da UI é decorativo
> Ele recalcula no browser a cada 60s e mostra "Expirado". Quem **realmente** fecha os estados são os crons — pode haver até 1 hora de defasagem entre o que a tela mostra e o que o banco registra. (E, até o cutover, os crons da fábrica **não existem** — nenhum timer fecha sozinho no banco novo.)

## Quem é a autoridade sobre o quê

| Fato | Fonte da verdade |
|---|---|
| A mensagem foi enviada | nossa Edge Function (após HTTP 200 do DataCrazy) |
| O cliente respondeu | **DataCrazy**, via `webhook-datacrazy-resposta` |
| Houve erro de envio | **DataCrazy**, via webhook |
| O cliente **comprou** | **Tiny ERP**, via a view `vendas_marketing` — ⚠️ o DataCrazy não informa venda |

Detalhes da integração: [[PLT - Comercial - Integracao DataCrazy]] · functions: [[SUPA - Comercial - Edge Functions]] · agendamentos: [[SUPA - Comercial - Cron e Rotinas]].

## Atribuição de venda — como funciona de verdade

`verificar-vendas-disparo` (cron `30 * * * *` — na fábrica, agendado só no cutover):

1. Pega membros em `respondido_aguardando_resultado`.
2. Busca vendas com `data_compra` entre `data_resposta` e `prazo_resultado_limite` — desde 2026-09-08 via a RPC `fn_vendas_disparo_por_telefone`, que filtra **no banco** e com **telefone normalizado dos dois lados** (DT-D5).
3. **O match é apenas por telefone.** Não há match por CPF, e-mail, nome ou `id_lead_crm`.
4. Achou → `ganho`, `valor_ganho = Σ valor_pedido`, `id_negocio_crm = numero_pedido` da venda mais antiga. Desde 2026-09-08 a function checa `timerExpirou` antes de fechar como ganho (DT-D4).
5. Não achou e o prazo expirou → `perdido / prazo_resultado_expirado`.

> [!danger] Consequência crítica do desenho
> **Quem nunca respondeu jamais recebe atribuição de venda**, mesmo que compre. A janela de atribuição começa na *resposta*, não no *envio*. Campanhas cujo efeito é "o cliente viu a mensagem e comprou direto no site sem responder" aparecem com conversão **zero**.
>
> Se o objetivo é medir o impacto real do disparo, isso precisa mudar — a janela deveria correr a partir de `data_envio`. (Ainda em aberto; não foi tocado pela união.)

## Corridas e conflitos — estado atual

- ✅ **Compare-and-swap no envio** (2026-09-08, DT-D7): o `UPDATE` é condicionado a `status='aguardando_envio'` em `enviar-proximo-disparo` e `disparar-membro-individual`, com rollback em falha — o botão manual e o cron não disparam mais o mesmo membro 2×.
- ✅ **Margem de 1h + compare-and-swap em `processar-timers-disparo`** (2026-09-08, DT-D6) — reduz a corrida entre o cron horário e o webhook ao fechar "sem resposta".
- 🟠 **Ainda abertos**: ordenação da fila não-determinística (`criado_em` empatado sem desempate, DT-D21); erros das functions invisíveis (`erros[]` com HTTP 200, resposta descartada pelo pg_cron, DT-D30); loops de cron sem `.limit()` — backlog grande estoura o wall-clock e recomeça (DT-D31); intervalo < 60s é ilusório, a granularidade real do cron é 1 min (DT-D20). Ver [[PLT - Comercial - Debito Tecnico]].

## Ver também

- [[PLT - Comercial - Telas]] (Listas de Disparo) · [[PLT - Comercial - Integracao DataCrazy]]
- [[SUPA - Comercial - Edge Functions]] · [[SUPA - Comercial - Cron e Rotinas]]
- [[PLT - Comercial - Legado e Cutover]] · [[handoff_2026_09_16_sessao20_modulo_comercial]]
