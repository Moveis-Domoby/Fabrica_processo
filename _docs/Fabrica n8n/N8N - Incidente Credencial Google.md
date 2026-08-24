---
titulo: n8n — Incidente da credencial Google (11/08/2026)
tipo: incidente
data: 2026-08-11
atualizado: 2026-08-13
tags: [incidente, google, oauth, service-account, n8n]
---

# 🔥 Incidente — credencial do Google expirou em produção

> [!abstract] Resumo
> Em 11/08/2026, das 16:16 às ~18:00+, **todas** as execuções do workflow Tiny→Planilha falharam. Pedidos 13047 e 13048 não entraram na planilha; a atualização do 12541 foi perdida. Recuperado por retry manual. Causa raiz corrigida em definitivo com **Service Account**.

## O erro

```
NodeApiError: The credential "Google Sheets account" needs to be reconnected.
Access could not be refreshed because the connected account has revoked access,
the refresh token expired, or the account password or permissions changed.
```

## Causa raiz

Projeto Google Cloud com a tela de consentimento OAuth em status **"Testing"** → o Google emite refresh tokens que **expiram em 7 dias**. A credencial foi criada ~04/08 e morreu exatamente 7 dias depois.

## Por que o dano foi silencioso (e por que isso é estrutural)

O `Webhook Tiny` responde `200` **imediatamente** (`onReceived`). Para o Tiny, tudo foi entregue — **ele não reenvia**. O único lugar onde os pedidos perdidos ainda existiam era dentro das execuções com erro do n8n. A parada só foi descoberta ~2h depois, por acaso, olhando a aba Executions.

## Recuperação (funcionou)

Executions → filtro **Status: Error** → **↻ "Retry with currently saved workflow"** em cada uma, **da mais antiga para a mais nova**.

> [!danger] Retry ANTES de adicionar nodes novos
> O retry roda o workflow salvo **atual**. Se os ramos ClickUp/Trello já estivessem ligados, cada retry teria criado cards de pedidos antigos.

## Correção definitiva — Service Account

OAuth2 pressupõe um humano clicando "autorizar"; para servidor-a-servidor a ferramenta certa é **Service Account, que não expira**.

| Item | Valor |
|---|---|
| Projeto | `n8n-integracao-504500` |
| Conta | `n8n-domoby@n8n-integracao-504500.iam.gserviceaccount.com` |
| APIs habilitadas | Google Sheets API **e** Google Drive API (sem a Drive, os dropdowns de documento no n8n ficam vazios) |

Receita: Google Cloud → Credenciais → Criar conta de serviço → aba Chaves → nova chave **JSON**. No n8n (credencial *Google Service Account API*): `client_email` → Service Account Email, `private_key` → Private Key (inteira, com `-----BEGIN PRIVATE KEY-----`). *Impersonate a User* e *Set up for use in HTTP Request node* **desligados**. Depois: **compartilhar a planilha** com o e-mail da conta, permissão **Editor**.

> [!warning] Trocar credencial reseta o node do Sheets
> Reconferir sempre: Column to match on = `PEDIDO tiny` · Cell Format = *Let Google Sheets format* · Handling extra data = *Error*.

## Lições

1. **Refresh token OAuth em caminho crítico é bomba-relógio** — vale para Google e para a API v3 do Tiny ([[N8N - API Tiny v2 vs v3]]).
2. **Webhook com 200 imediato = evento perdido se o processamento falhar.** O retry manual das execuções é a única recuperação.
3. **Sem alerta de erro, a descoberta é por acaso.** O alerta continua pendente — [[N8N - Pendencias e Riscos]].

## Ver também

[[N8N - Workflow Tiny para Planilha]] · [[N8N - Infraestrutura VPS]]
