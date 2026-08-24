---
titulo: n8n — Infraestrutura (VPS, Docker, credenciais)
tipo: infraestrutura
atualizado: 2026-08-13
tags: [n8n, vps, docker, credenciais]
---

# 🖥️ n8n — Infraestrutura

## O servidor

| Item | Valor |
|---|---|
| VPS | Hostinger KVM2, Ubuntu 24.04 |
| Host | `srv1877515.hstgr.cloud` · IP `187.127.46.206` |
| n8n | `https://n8n.srv1877515.hstgr.cloud` |
| Instalação | Docker + Traefik, pasta `/docker/n8n` |
| Container | **`n8n-n8n-1`** (não `n8n`) |

## Variáveis de ambiente

Em `/docker/n8n/docker-compose.yml`, bloco `environment:` do serviço n8n:

```yaml
      - EXECUTIONS_DATA_PRUNE=true
      - EXECUTIONS_DATA_MAX_AGE=168
      - EXECUTIONS_DATA_PRUNE_MAX_COUNT=10000
      - N8N_PAYLOAD_SIZE_MAX=32
      - TZ=America/Fortaleza
```

Em `/docker/n8n/.env`: `GENERIC_TIMEZONE=America/Fortaleza`.

> [!warning] Pegadinha deste template
> Variável solta no `.env` é **ignorada** — só chega ao container o que o `docker-compose.yml` referencia explicitamente. Por isso as variáveis de prune foram para o compose.

Aplicar mudanças:

```bash
cd /docker/n8n
docker compose down && docker compose up -d
docker exec n8n-n8n-1 printenv | grep -E "EXECUTIONS|TZ="
```

## Credenciais no n8n

| Credencial | Tipo | Usada por | Observações |
|---|---|---|---|
| `Google Service Account account` | Google Service Account API | node Sheets | `n8n-domoby@n8n-integracao-504500.iam.gserviceaccount.com`, projeto `n8n-integracao-504500`. **Não expira.** Ver [[N8N - Incidente Credencial Google]] |
| ClickUp (Access Token) | ClickUp API | nodes ClickUp | Token pessoal `pk_...`, gerado em ClickUp → avatar → Settings → Apps |
| `Trello account` | Trello API | nodes Trello + HTTP Request | API Key + Token via Power-Up em `trello.com/power-ups/admin` (Power-Up `n8n Domoby`, allowed origin `https://n8n.srv1877515.hstgr.cloud`) |
| Token Tiny v2 | — (texto no node HTTP) | `Tiny · pedido.obter` | ⚠️ **Está em texto puro no JSON do workflow.** Pendência: mover para env var — ver [[N8N - Pendencias e Riscos]] |

> [!danger] Regra de segurança aprendida do jeito difícil
> **Nunca mandar token em print ou chat.** O primeiro token do Tiny vazou num print e teve que ser trocado.

## Webhooks cadastrados no Tiny

Menu → Configurações → Outras configurações → Webhooks:

| Toggle | Path | Situação |
|---|---|---|
| Receber notificações de vendas | `dda37d71-027e-4766-963d-e86b1e015865` | **Ligado — é o fluxo de produção** |
| Receber notificações de pedidos enviados | `5b0fc553-894d-4dec-bee8-e033b5b844a8` | Ligado, **sem workflow escutando** → cada evento bate em 404 e o Tiny reenvia 10×. Pendência: desligar |

O plano do Tiny é **Impulsione** (≈ antigo Evoluir): webhook liberado, 60 req/min.

## Ver também

[[N8N - Visao Geral da Migracao]] · [[N8N - Workflow Tiny para Planilha]]
