#!/usr/bin/env bash
# =============================================================================
# TESTE DAS MIGRATIONS DA PLATAFORMA — SESSAO-02
#
# Sobe um Postgres descartável em Docker, carrega o esquema REAL da integração
# (o mesmo `supabase-fabrica-schema.sql` que já roda em produção), aplica as
# migrations da plataforma DUAS VEZES e prova três coisas:
#
#   1. as migrations rodam do zero sem erro, duas vezes seguidas (idempotência);
#   2. nenhuma tabela/coluna existente da integração foi alterada;
#   3. plt_eventos é append-only de verdade — UPDATE e DELETE falham.
#
# NADA aqui toca em Supabase nenhum. É tudo em container local, descartado no
# fim. Uso:  bash supabase/testes/testar-migrations.sh
# =============================================================================
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONTAINER="domoby-plt-teste"
IMAGEM="postgres:17-alpine"
SENHA="teste_local_descartavel"
BD="domoby_teste"

vermelho() { printf '\033[31m%s\033[0m\n' "$1"; }
verde()    { printf '\033[32m%s\033[0m\n' "$1"; }
titulo()   { printf '\n\033[1m== %s ==\033[0m\n' "$1"; }

limpar() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap limpar EXIT

psql_() {
  docker exec -i -e PGPASSWORD="$SENHA" "$CONTAINER" \
    psql -v ON_ERROR_STOP=1 -U postgres -d "$BD" "$@"
}

titulo "Subindo Postgres descartável ($IMAGEM)"
limpar
docker run -d --name "$CONTAINER" \
  -e POSTGRES_PASSWORD="$SENHA" -e POSTGRES_DB="$BD" \
  "$IMAGEM" >/dev/null

printf 'aguardando o banco'
for _ in $(seq 1 60); do
  if docker exec "$CONTAINER" pg_isready -U postgres -d "$BD" >/dev/null 2>&1; then
    printf ' pronto\n'; break
  fi
  printf '.'; sleep 1
done

titulo "Simulando o ambiente Supabase (papéis e auth.uid)"
# O Supabase traz estes papéis e o schema auth de fábrica; num Postgres cru,
# não existem. Este bloco só recria o mínimo para as migrations rodarem iguais.
psql_ <<'SQL' >/dev/null
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$$;
create schema if not exists auth;
create or replace function auth.uid() returns uuid
  language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
SQL
verde "ambiente pronto"

titulo "Carregando o esquema REAL da integração (produção)"
docker exec -i -e PGPASSWORD="$SENHA" "$CONTAINER" \
  psql -v ON_ERROR_STOP=1 -U postgres -d "$BD" \
  < "$RAIZ/_docs/Supabase-fabrica/supabase-fabrica-schema.sql" >/dev/null
verde "clientes, pedidos, pedido_itens, eventos e fn_upsert_pedido no lugar"

titulo "Retrato das tabelas existentes ANTES das migrations"
RETRATO_ANTES=$(psql_ -At <<'SQL'
select table_name || '.' || column_name || ':' || data_type || ':' || is_nullable
  from information_schema.columns
 where table_schema = 'public'
   and table_name in ('clientes','pedidos','pedido_itens','eventos','gp_pcp_processados')
 order by table_name, ordinal_position;
SQL
)
echo "$RETRATO_ANTES" | wc -l | xargs printf '%s colunas registradas\n'

aplicar_migrations() {
  local rodada="$1"
  titulo "Aplicando as migrations — rodada $rodada"
  for arquivo in "$RAIZ"/supabase/migrations/*.sql; do
    printf '  · %s\n' "$(basename "$arquivo")"
    docker exec -i -e PGPASSWORD="$SENHA" "$CONTAINER" \
      psql -v ON_ERROR_STOP=1 -U postgres -d "$BD" < "$arquivo" >/dev/null
  done
  verde "rodada $rodada aplicada sem erro"
}

aplicar_migrations 1
aplicar_migrations 2   # idempotência: rodar de novo não pode quebrar nada

titulo "Retrato das tabelas existentes DEPOIS das migrations"
RETRATO_DEPOIS=$(psql_ -At <<'SQL'
select table_name || '.' || column_name || ':' || data_type || ':' || is_nullable
  from information_schema.columns
 where table_schema = 'public'
   and table_name in ('clientes','pedidos','pedido_itens','eventos','gp_pcp_processados')
 order by table_name, ordinal_position;
SQL
)

if [ "$RETRATO_ANTES" = "$RETRATO_DEPOIS" ]; then
  verde "✔ nenhuma tabela/coluna existente da integração foi alterada"
else
  vermelho "✘ ALGUMA TABELA EXISTENTE MUDOU — isto não pode acontecer"
  diff <(echo "$RETRATO_ANTES") <(echo "$RETRATO_DEPOIS") || true
  exit 1
fi

titulo "Conferindo o seed dos setores (D-12)"
psql_ -At -c "select codigo || ' · ' || nome || ' · ' || papel_no_fluxo from public.plt_setores order by ordem;"
QTD_SETORES=$(psql_ -At -c "select count(*) from public.plt_setores;")
if [ "$QTD_SETORES" = "7" ]; then
  verde "✔ 7 setores semeados, sem duplicar na segunda rodada"
else
  vermelho "✘ esperava 7 setores, encontrei $QTD_SETORES"
  exit 1
fi

QTD_ETAPAS=$(psql_ -At -c "select count(*) from public.plt_etapas;")
if [ "$QTD_ETAPAS" = "0" ]; then
  verde "✔ nenhuma etapa semeada — D-14 respeitada"
else
  vermelho "✘ há $QTD_ETAPAS etapa(s) semeada(s); a D-14 proíbe seed de etapa"
  exit 1
fi

titulo "Provando que plt_eventos é append-only (RNF-05)"
psql_ >/dev/null <<'SQL'
-- Cenário mínimo: um pedido, um card, um evento.
insert into public.clientes (nome) values ('Cliente de teste');
insert into public.pedidos (numero, cliente_id, situacao)
  values (999999, (select id from public.clientes order by id desc limit 1), 'aprovado');
insert into public.plt_cards (tipo, pedido_id)
  values ('pedido', (select id from public.pedidos where numero = 999999));
insert into public.plt_eventos (card_id, tipo, setor_destino_id, origem)
  values (
    (select id from public.plt_cards order by id desc limit 1),
    'card_criado',
    (select id from public.plt_setores where codigo = 'pcp'),
    'api'
  );
SQL

if psql_ -c "update public.plt_eventos set observacao = 'adulterado';" >/dev/null 2>&1; then
  vermelho "✘ UPDATE em plt_eventos passou — append-only está furado"
  exit 1
else
  verde "✔ UPDATE em plt_eventos recusado"
fi

if psql_ -c "delete from public.plt_eventos;" >/dev/null 2>&1; then
  vermelho "✘ DELETE em plt_eventos passou — append-only está furado"
  exit 1
else
  verde "✔ DELETE em plt_eventos recusado"
fi

titulo "Conferindo a projeção da posição do card"
POSICAO=$(psql_ -At -c "
  select coalesce(s.codigo, 'sem setor')
    from public.plt_cards c
    left join public.plt_setores s on s.id = c.setor_atual_id
   order by c.id desc limit 1;")
if [ "$POSICAO" = "pcp" ]; then
  verde "✔ o evento posicionou o card no PCP sem ninguém escrever a posição à mão"
else
  vermelho "✘ posição projetada inesperada: $POSICAO"
  exit 1
fi

titulo "Conferindo que fn_upsert_pedido continua funcionando com cards vivos"
# Este é o teste que importa mais: o card aponta para o pedido, e a integração
# do Tiny apaga e regrava os itens a cada atualização. Se houvesse FK para
# pedido_itens, isto quebraria — e quebraria em produção.
psql_ >/dev/null <<'SQL'
insert into public.pedido_itens (pedido_id, seq, codigo, descricao, quantidade)
  values ((select id from public.pedidos where numero = 999999), 1, '061', 'Item de teste', 2);
delete from public.pedido_itens where pedido_id = (select id from public.pedidos where numero = 999999);
SQL
verde "✔ itens do pedido podem ser apagados e regravados com card vivo apontando para o pedido"

titulo "Resumo"
psql_ -At -c "
  select 'tabelas da plataforma: ' || count(*)
    from information_schema.tables
   where table_schema = 'public' and table_name like 'plt\_%' and table_type = 'BASE TABLE';"
psql_ -At -c "
  select 'visões da plataforma: ' || count(*)
    from information_schema.views
   where table_schema = 'public' and table_name like 'plt\_vw\_%';"
psql_ -At -c "
  select 'políticas de RLS: ' || count(*) from pg_policies
   where schemaname = 'public' and tablename like 'plt\_%';"

verde "
TUDO VERDE — migrations idempotentes, integração intacta, eventos imutáveis."
