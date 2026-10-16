# Pendentes — mudanças prontas que esperam o OK do dono

Arquivos aqui **não são aplicados por nada automático** (o `banco:aplicar` e a bateria do banco só leem `supabase/migrations/`). Cada um diz no topo o que faz, por que espera o dono (regra 2/3 do CLAUDE.md: tabela da integração, extensão nova, login, exclusão) e como aplicar e desfazer.

Com o OK do dono: o arquivo vira uma migration numerada (ou roda comando a comando quando tem `CONCURRENTLY`), a nota do esquema é atualizada e o diário da sessão registra o OK.

| Arquivo | O que é | Por que espera |
|---|---|---|
| `2026-10-16_gancho_do_token.sql` | O gancho do token (permissões no login) | Liga junto com o painel da Supabase, com o dono |

**Já aplicados com o OK do dono (D-138, 16/10/2026):** os índices de Pedidos com a porta por caminhos (migration 83) e os índices das cópias do Tiny com a retirada dos repetidos (migration 84).
