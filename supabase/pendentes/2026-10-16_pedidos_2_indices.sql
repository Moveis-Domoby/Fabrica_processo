-- ============================================================================
-- ⏸️ PENDENTE — NÃO APLICAR sem o OK do dono (tabelas da INTEGRAÇÃO do Tiny +
-- extensão nova). (SESSAO-32 · §1.6 · dívida 17 da lei — pedido do dono em
-- 15/10: "deixar rápidas a busca por nome em Pedidos e a lista de Cancelados
-- (índice nas tabelas do Tiny — me confirme antes de aplicar)")
--
-- Entra JUNTO com 2026-10-16_pedidos_1_porta_por_caminhos.sql (a porta da lista
-- por caminhos separados — mesmo resultado, provado); estes índices são o que
-- faz cada caminho ir direto ao que procura em vez de varrer a tabela:
--   1. pg_trgm (extensão oficial do Postgres, no esquema extensions) — índice
--      de "pedaços de 3 letras" que acha "contém o texto" sem varrer;
--   2. cancelados: índice parcial por número só dos pedidos cancelados;
--   3. busca: trigramas no nome do cliente e no vendedor do pedido.
-- Não muda nenhuma coluna nem dado da integração: só índices (o n8n continua
-- gravando igual; a gravação fica um tico mais cara — 3 índices a mais).
-- Sem travar a tabela: CREATE INDEX CONCURRENTLY (fora de transação — rodar
-- comando a comando, não pelo aplicador, que abre transação).
--
-- Ensaio ×100 (banco local, 556.800 pedidos e 1.080.000 clientes): ver o
-- handoff da SESSAO-32 (§ "Pedidos — para o seu OK").
--
-- Desfazer: DROP INDEX CONCURRENTLY de cada um (a porta segue funcionando —
-- só volta a varrer).
-- ============================================================================

create extension if not exists pg_trgm with schema extensions;

set lock_timeout = '5s';

create index concurrently if not exists pedidos_cancelados_numero_idx
  on public.pedidos (numero desc)
  where plt_privado.fn_situacao_normalizada(situacao) = 'cancelado';

create index concurrently if not exists clientes_nome_trgm_idx
  on public.clientes using gin (nome extensions.gin_trgm_ops);

create index concurrently if not exists pedidos_vendedor_trgm_idx
  on public.pedidos using gin (vendedor extensions.gin_trgm_ops);

analyze public.pedidos;
analyze public.clientes;
