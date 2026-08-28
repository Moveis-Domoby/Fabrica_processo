# API aberta da Plataforma de Produção (SESSAO-11)

A porta de integrações da plataforma. O n8n — ou qualquer sistema — chama a
Edge Function `api`; ninguém de fora toca as tabelas direto. Todas as regras
do domínio (append-only, um card de pedido por pedido, DANIFICADO automático,
movimentação sem qualidade para origem `api`) são TRIGGERS no banco e valem
para esta porta igualzinho.

- **Base:** `https://<projeto>.supabase.co/functions/v1/api`
- **Autenticação:** header `X-Chave-API: pltk_…` — chave gerada em
  *Administração → API e integrações* (o valor aparece UMA vez; revogar corta
  o acesso na hora). Escopo `leitura` só faz GET; `escrita` faz tudo.
- Chave inválida/ausente → `401` (e a tentativa fica nos logs da função).
- **Execução (iniciar/finalizar) NÃO existe na API:** tempo de execução é
  gesto de pessoa, não de integração.

## Endpoints

| Método | Rota | O que faz |
|---|---|---|
| GET | `/setores` | setores ativos |
| GET | `/etapas?setor_id=N` | etapas ativas de um setor |
| GET | `/cards?setor_id=&tipo=&limite=&deslocamento=` | cards (sem os arquivados) |
| GET | `/cards/:id` | um card |
| GET | `/cards/:id/eventos` | a história completa do card |
| POST | `/cards` | criar card de pedido ou de unidade (nasce no PCP) |
| POST | `/cards/:id/mover` | mover para setor/etapa — sem estado de qualidade |
| DELETE | `/cards/:id` | arquivar (exclusão lógica — nada se apaga) |

Todo evento desta porta sai com `origem: "api"` e `dados.integracao` com o
nome da chave — a linha do tempo do card conta quem foi.

## Exemplos (validados na entrega da sessão)

```bash
# Setores
curl -H "X-Chave-API: $CHAVE" "$BASE/setores"

# Criar card de UNIDADE para um pedido que já existe no banco
curl -X POST -H "X-Chave-API: $CHAVE" -H "Content-Type: application/json" \
  -d '{"pedido_numero":13098,"tipo":"unidade","item_seq":1,"item_codigo":"061",
       "item_descricao":"Guarda-roupa Master","indice_unidade":1,"total_unidades":2}' \
  "$BASE/cards"
# → {"card_id":10}

# Mover o card para a SECC (sem qualidade — atestação é gesto humano)
curl -X POST -H "X-Chave-API: $CHAVE" -H "Content-Type: application/json" \
  -d '{"setor_codigo":"secc"}' "$BASE/cards/10/mover"
# → {"evento_id":47}

# A história do card
curl -H "X-Chave-API: $CHAVE" "$BASE/cards/10/eventos"

# Arquivar (o "excluir": some das telas, a história fica)
curl -X DELETE -H "X-Chave-API: $CHAVE" "$BASE/cards/10"
# → {"arquivado":true}
```

Erros de regra vêm com `422` e a mensagem do banco em português (ex.: mover
card arquivado, iniciar sem parecer).

## Webhooks de saída (RF-52)

Cadastrados em *Administração → API e integrações*: URL + tipos de evento
assinados (+ segredo opcional → header `X-Assinatura` com HMAC-sha256 do
corpo). Quando o evento acontece, entra na fila `plt_webhook_entregas` e o
POST sai em até 1 minuto (pg_cron + pg_net), com até 5 tentativas.

Payload:

```json
{
  "evento_id": 47,
  "tipo": "movimentacao_setor",
  "ocorrido_em": "2026-08-28T07:08:54Z",
  "origem": "api",
  "card_id": 10,
  "setor_origem": "PCP",
  "setor_destino": "SECC",
  "estado_qualidade": null,
  "observacao": null,
  "dados": { "integracao": "n8n produção" },
  "card": {
    "tipo": "unidade",
    "pedido_numero": 13098,
    "item_codigo": "061",
    "item_descricao": "Guarda-roupa Master",
    "indice_unidade": 1,
    "total_unidades": 2
  }
}
```

## O que a API NÃO faz (de propósito)

- Não lê nada do Tiny (a plataforma só recebe — D-31/D-33).
- Não marca qualidade nem executa (gestos humanos).
- Não cria nada no ClickUp — a ponte morreu (D-33); as entregas vivem na
  tela ROTAS da própria plataforma.
- Marcar "entregue" na plataforma não atualiza o Tiny (a automação do
  ClickUp que faz isso continua intocada — ligar os dois é decisão futura).
