# Pendentes — mudanças prontas que esperam o OK do dono

Arquivos aqui **não são aplicados por nada automático** (o `banco:aplicar` só lê `supabase/migrations/`; a bateria do banco só LÊ a porta de Pedidos daqui para provar que ela devolve o mesmo que a do ar — bloco 83). Cada um diz no topo o que faz, por que espera o dono (regra 2/3 do CLAUDE.md: tabela da integração, extensão nova, login, exclusão) e como aplicar e desfazer.

Com o OK do dono: o arquivo vira uma migration numerada (ou roda comando a comando quando tem `CONCURRENTLY`), a nota do esquema é atualizada e o diário da sessão registra o OK.

| Arquivo | O que é | Por que espera |
|---|---|---|
| `2026-10-16_pedidos_1_porta_por_caminhos.sql` + `2026-10-16_pedidos_2_indices.sql` | A lista de Pedidos por caminhos separados + os índices da busca por nome e dos Cancelados — **entram juntos** (a porta sem os índices é 20–60 ms mais lenta na busca) | Tabelas da integração do Tiny + extensão `pg_trgm` |
| `2026-10-16_indices_copias_tiny_e_repetidos.sql` | Índices das 4 chaves das cópias do Tiny (contas a receber, notas fiscais) e retirada dos 2 índices repetidos | Tabelas da integração / exclusão de estrutura |
| `2026-10-16_gancho_do_token.sql` | O gancho do token (permissões no login) | Liga junto com o painel da Supabase, com o dono |
