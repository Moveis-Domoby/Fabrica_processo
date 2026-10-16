# Pendentes — mudanças prontas que esperam o OK do dono

Arquivos aqui **não são aplicados por nada automático** (o `banco:aplicar` e a bateria do banco só leem `supabase/migrations/`). Cada um diz no topo o que faz, por que espera o dono (regra 2/3 do CLAUDE.md: tabela da integração, extensão nova, login, exclusão) e como aplicar e desfazer.

Com o OK do dono: o arquivo vira uma migration numerada (ou roda comando a comando quando tem `CONCURRENTLY`), a nota do esquema é atualizada e o diário da sessão registra o OK.

| Arquivo | O que é | Por que espera |
|---|---|---|
| `2026-10-16_gancho_do_token.sql` | O gancho do token (permissões no login) — ↪️ 16/10 (D-141): **recusa a pessoa desativada** ao emitir e ao renovar o token, com a mensagem clara (a mesma frase da função de login; a bateria do banco amarra as duas e prova o arquivo numa transação desfeita) | Liga junto com o painel da Supabase, com o dono |
| (função `autenticacao`, ação entrar) | O login diz "acesso desativado" a quem está desativado e acertou a senha (D-141); quem erra a senha segue vendo "usuário ou senha incorretos" | Publicar a função é publicação em produção — com o OK do dono |

**Já aplicados com o OK do dono (D-138, 16/10/2026):** os índices de Pedidos com a porta por caminhos (migration 83) e os índices das cópias do Tiny com a retirada dos repetidos (migration 84).
