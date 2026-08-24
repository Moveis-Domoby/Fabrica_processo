---
titulo: Modelo Mental — Máquina de Estados do Disparo
tipo: modelo-mental
atualizado: 2026-08-06
tags: [modelo-mental, disparo, estados, campanha]
---

# 🔁 MM — Máquina de Estados do Disparo

> [!abstract] O modelo em uma frase
> Uma **lista** é uma campanha; um **membro** é um contato dentro dela. A lista tem um ciclo curto (rascunho → disparando → encerrada); o membro tem um ciclo longo, movido por **três relógios independentes** e fechado por **crons**, não pela UI.

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
> Ele recalcula no browser a cada 60s e mostra "Expirado". Quem **realmente** fecha os estados são os crons — pode haver até 1 hora de defasagem entre o que a tela mostra e o que o banco registra.

## Quem é a autoridade sobre o quê

| Fato | Fonte da verdade |
|---|---|
| A mensagem foi enviada | nossa Edge Function (após HTTP 200 do DataCrazy) |
| O cliente respondeu | **DataCrazy**, via `webhook-datacrazy-resposta` |
| Houve erro de envio | **DataCrazy**, via webhook |
| O cliente **comprou** | **Tiny ERP**, via tabela `vendas_marketing` — ⚠️ o DataCrazy não informa venda |

## Atribuição de venda — como funciona de verdade

`verificar-vendas-disparo` (cron `30 * * * *`):

1. Pega membros em `respondido_aguardando_resultado`.
2. Busca `vendas_marketing` com `data_compra` entre `data_resposta` e `prazo_resultado_limite`.
3. **Faz o match apenas por telefone**, normalizado dos dois lados. Não há match por CPF, e-mail, nome ou `id_lead_crm`.
4. Achou → `ganho`, `valor_ganho = Σ valor_pedido`, `id_negocio_crm = numero_pedido` da venda mais antiga.
5. Não achou e o prazo expirou → `perdido / prazo_resultado_expirado`.

> [!danger] Consequência crítica do desenho
> **Quem nunca respondeu jamais recebe atribuição de venda**, mesmo que compre. A janela de atribuição começa na *resposta*, não no *envio*. Campanhas cujo efeito é "o cliente viu a mensagem e comprou direto no site sem responder" aparecem com conversão **zero**.
>
> Se o objetivo é medir o impacto real do disparo, isso precisa mudar — a janela deveria correr a partir de `data_envio`.

## Corridas e conflitos conhecidos

- **Duas autoridades fecham "sem resposta"**: se o cron horário chegar antes do webhook, uma `resposta_recebida` legítima que chegue logo depois é **descartada** pela guarda de status. Cliente que responde no limite do prazo vira perda.
- **Sem compare-and-swap no envio**: o `UPDATE` não é condicionado a `status = 'aguardando_envio'`. O botão manual e o cron podem disparar o mesmo membro — **o cliente recebe duas mensagens e o custo conta uma vez**.
- **A fila trava no contato com erro**: se o POST ao DataCrazy falhar, `ultimo_envio_em` não avança e o mesmo contato é retentado indefinidamente.

Todos catalogados em [[DT - Indice de Problemas Conhecidos]].

## Ver também

- [[TELA - Listas de Disparo]]
- [[INT - DataCrazy]]
- [[BD - Tabelas de Disparo]]
