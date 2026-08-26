---
titulo: Supabase Fábrica — Visão Geral (projeto, endpoints, chaves, convenções)
tipo: infraestrutura
atualizado: 2026-08-26
tags: [supabase, fabrica, infraestrutura, endpoints]
---

# 🗄️ Supabase Fábrica — Visão Geral

> [!abstract] O que é este projeto
> Projeto Supabase **novo e dedicado à fábrica** (separado do painel de recompra da loja), criado em 17/08/2026 para ser o **armazenamento canônico** de clientes e pedidos, alimentado pelo webhook de vendas do Tiny via n8n. Decisões e fases da migração: [[N8N - Migracao Supabase]].

> [!danger] Antes de mexer no banco
> Ler [[SUPA - Esquema do Banco]] PRIMEIRO. É a fonte da verdade — nomes de tabela, coluna e função saem de lá, nunca de memória.

## Identificação do projeto

| Item | Valor |
|---|---|
| Nome do projeto | `contatodomoby@gmail.com's Project` · ref `axnzldwgwsmepukdiljx` · org **Tech** |
| URL do projeto | `https://________.supabase.co` ← **preencher com o ref real** |
| Região | `ca-central-1` (conferido no painel em 26/08/2026 — a nota antes dizia `sa-east-1`, estava errada) |
| Schema usado | `public` |
| Chave usada pelo n8n | **service_role** (Settings → API). A anon key não serve para nada aqui (RLS travado) |

## Onde as credenciais vivem

**Únicamente** no `/docker/n8n/docker-compose.yml` do VPS, bloco `environment:`:

```yaml
      - SUPABASE_FABRICA_URL=https://SEU-REF.supabase.co
      - SUPABASE_FABRICA_KEY=service_role_key_aqui
```

Nos nodes do n8n, sempre `{{ $env.SUPABASE_FABRICA_URL }}` e `{{ $env.SUPABASE_FABRICA_KEY }}` — **nunca a chave literal no body** (lição do token do Tiny que vazou em print). Aplicar mudança: `cd /docker/n8n && docker compose down && docker compose up -d`. Se `$env` não resolver: falta `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`.

## Endpoints em uso (PostgREST)

Headers obrigatórios em TODAS as chamadas:
`apikey: {{ $env.SUPABASE_FABRICA_KEY }}` · `Authorization: Bearer {{ $env.SUPABASE_FABRICA_KEY }}`

| Uso | Chamada |
|---|---|
| **Escrever pedido** (única porta de escrita) | `POST {URL}/rest/v1/rpc/fn_upsert_pedido` — body `{"p": <retorno.pedido cru>, "p_tipo": "...", "p_tiny_id": <id>, "p_origem": "webhook"\|"backfill"}` |
| Ler pedido por número | `GET {URL}/rest/v1/pedidos?numero=eq.13093&select=tiny_id,numero,situacao` |
| Ler cliente por CPF | `GET {URL}/rest/v1/clientes?cpf_cnpj=eq.05344461402` |
| Itens de um pedido | `GET {URL}/rest/v1/pedido_itens?pedido_id=eq.<id>&order=seq` |
| Últimos eventos (debug) | `GET {URL}/rest/v1/eventos?order=id.desc&limit=20` |

Convenções PostgREST: filtro `coluna=eq.valor` · `select=` escolhe colunas · `order=coluna.desc` · resposta é sempre **array JSON** (mesmo com 1 resultado).

## Quem escreve / quem lê

| Ator | Acesso |
|---|---|
| n8n · workflow Tiny → Planilha (ramo dupla escrita) | escreve via `fn_upsert_pedido` |
| n8n · backfill (futuro, fase 2) | escreve via `fn_upsert_pedido` com `p_origem='backfill'` |
| n8n · ClickUp ROTAS → Tiny (fase 4, futuro) | lerá `pedidos` (numero → tiny_id, situacao) |
| **Plataforma de Produção** | tabelas `plt_*` no mesmo banco (D-08), com RLS por papel. Aplicada em 26/08/2026 na SESSAO-02 |
| Plataformas futuras (rotas, estoque…) | leitura via policies próprias, a criar quando existirem |

🚨 **Este projeto NÃO tem nada a ver com o OAuth v3 do Tiny** — o cron de renovação de token vive no Supabase da **loja** (painel de recompra). Não misturar. A regra do dono único do token ([[N8N - API Tiny v2 vs v3]]) continua valendo lá.

## Arquivos desta pasta

- [[SUPA - Esquema do Banco]] — fonte da verdade do que existe no banco
- `supabase-fabrica-schema.sql` — o DDL executável (rodado em 17/08)
- `n8n-ramo-supabase.json` — os 2 nodes da dupla escrita, prontos para colar no canvas do workflow da planilha
