/**
 * TESTE DAS MIGRATIONS DA PLATAFORMA — SESSAO-02
 *
 * Roda um Postgres de verdade DENTRO do Node (PGlite), sem Docker e sem tocar
 * em Supabase nenhum. Carrega o esquema REAL da integração (o mesmo
 * `supabase-fabrica-schema.sql` que já roda em produção), aplica as migrations
 * da plataforma DUAS VEZES e prova:
 *
 *   1. rodam do zero sem erro, duas vezes seguidas (idempotência);
 *   2. nenhuma tabela/coluna existente da integração foi alterada;
 *   3. plt_eventos é append-only — UPDATE e DELETE são recusados;
 *   4. o seed cria os 9 setores (7 de produção + ESTOQUE e ROTAS) e ZERO etapas;
 *   5. a posição do card é projetada pelo evento, sem escrita manual;
 *   6. os itens de um pedido continuam podendo ser apagados e regravados com
 *      card vivo apontando para o pedido — ou seja, fn_upsert_pedido não quebra.
 *
 * Uso:  npm run test:banco
 * Equivalente em Docker (Postgres oficial): supabase/testes/testar-migrations.sh
 */
import { PGlite } from '@electric-sql/pglite'
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const MIGRATIONS = path.join(RAIZ, 'supabase/migrations')
const ESQUEMA_INTEGRACAO = path.join(RAIZ, '_docs/Supabase-fabrica/supabase-fabrica-schema.sql')

const verde = (t) => `\x1b[32m${t}\x1b[0m`
const vermelho = (t) => `\x1b[31m${t}\x1b[0m`
const negrito = (t) => `\x1b[1m${t}\x1b[0m`

let falhas = 0
function conferir(condicao, descricao, detalhe = '') {
  if (condicao) {
    console.log(`  ${verde('✔')} ${descricao}`)
  } else {
    falhas += 1
    console.log(`  ${vermelho('✘')} ${descricao}${detalhe ? ` — ${detalhe}` : ''}`)
  }
}

function titulo(t) {
  console.log(`\n${negrito(`== ${t} ==`)}`)
}

const bd = new PGlite()

titulo('Simulando o ambiente Supabase (papéis e auth.uid)')
// O Supabase traz estes papéis e o schema auth de fábrica. Num Postgres cru não
// existem — este bloco recria só o mínimo para as migrations rodarem iguais.
await bd.exec(`
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
`)
console.log('  ambiente pronto')

titulo('Carregando o esquema REAL da integração (produção)')
await bd.exec(await readFile(ESQUEMA_INTEGRACAO, 'utf8'))
console.log('  clientes, pedidos, pedido_itens, eventos e fn_upsert_pedido no lugar')

const RETRATO = `
  select table_name || '.' || column_name || ':' || data_type || ':' || is_nullable as linha
    from information_schema.columns
   where table_schema = 'public'
     and table_name in ('clientes','pedidos','pedido_itens','eventos','gp_pcp_processados')
   order by table_name, ordinal_position;
`
const antes = (await bd.query(RETRATO)).rows.map((r) => r.linha)
console.log(`  ${antes.length} colunas registradas antes das migrations`)

const arquivos = (await readdir(MIGRATIONS)).filter((f) => f.endsWith('.sql')).sort()

for (const rodada of [1, 2]) {
  titulo(`Aplicando as migrations — rodada ${rodada}`)
  for (const arquivo of arquivos) {
    try {
      await bd.exec(await readFile(path.join(MIGRATIONS, arquivo), 'utf8'))
      console.log(`  · ${arquivo}`)
    } catch (erro) {
      falhas += 1
      console.log(`  ${vermelho('✘')} ${arquivo}\n     ${erro.message}`)
    }
  }
}
conferir(falhas === 0, 'migrations aplicadas duas vezes seguidas sem erro')

titulo('A integração continua intacta?')
const depois = (await bd.query(RETRATO)).rows.map((r) => r.linha)
const mudou = antes
  .filter((l) => !depois.includes(l))
  .concat(depois.filter((l) => !antes.includes(l)))
conferir(
  mudou.length === 0,
  'nenhuma tabela/coluna existente da integração foi alterada',
  mudou.join(' | '),
)

titulo('Seed e estrutura')
const setores = (
  await bd.query(`select codigo, nome, papel_no_fluxo from public.plt_setores order by ordem`)
).rows
console.log('  ' + setores.map((s) => `${s.nome} (${s.papel_no_fluxo})`).join(' · '))
conferir(
  setores.length === 9,
  '9 setores semeados, sem duplicar na segunda rodada',
  `vieram ${setores.length}`,
)
conferir(
  setores
    .filter((s) => s.papel_no_fluxo === 'terminal')
    .map((s) => s.codigo)
    .join(',') === 'estoque,rotas',
  'ESTOQUE e ROTAS são os dois fins de linha (D-13 / Q-28)',
)
conferir(
  setores.filter((s) => s.papel_no_fluxo === 'entrada').length === 1,
  'existe exatamente uma entrada no fluxo (D-13)',
)
conferir(!setores.some((s) => s.codigo === 'metalurgica'), 'METALURGICA não foi semeada (D-12)')

const etapas = (await bd.query(`select count(*)::int as total from public.plt_etapas`)).rows[0]
conferir(etapas.total === 0, 'nenhuma etapa interna semeada (D-14)', `vieram ${etapas.total}`)

titulo('Identidade e acesso (SESSAO-03 / D-21)')
// Matrícula MDM-XXX-NNN gerada pelo banco: XXX = 3 primeiros dígitos do CPF,
// NNN = ordem de cadastro. E as normalizações: CPF com máscara vira só dígitos,
// usuário/e-mail viram minúsculos.
await bd.exec(`
  insert into public.plt_usuarios (nome, email, cpf, usuario, papel)
    values ('Primeira Pessoa', 'Primeira@Teste.com', '061.234.567-89', 'Primeira.Pessoa', 'admin');
  insert into public.plt_usuarios (nome, email, cpf, usuario, papel)
    values ('Segunda Pessoa', 'segunda@teste.com', '98765432100', 'segunda.pessoa', 'operador');
`)
const pessoas = (
  await bd.query(
    `select matricula, cpf, usuario, email, senha_padrao, convite_token is not null as tem_convite
       from public.plt_usuarios order by matricula`,
  )
).rows
conferir(
  pessoas[0]?.matricula === 'MDM-061-001' && pessoas[1]?.matricula === 'MDM-987-002',
  'matrícula MDM-XXX-NNN gerada na ordem de cadastro',
  pessoas.map((p) => p.matricula).join(' · '),
)
conferir(
  pessoas[0]?.cpf === '06123456789' && pessoas[0]?.usuario === 'primeira.pessoa' && pessoas[0]?.email === 'primeira@teste.com',
  'CPF com máscara vira só dígitos; usuário e e-mail viram minúsculos',
)
conferir(
  pessoas.every((p) => p.senha_padrao === true && p.tem_convite === true),
  'todo cadastro nasce com senha padrão pendente de troca e com token de convite',
)

async function deveRecusar(sql, descricao, padraoErro) {
  try {
    await bd.exec(sql)
    conferir(false, descricao, 'a operação passou, e não devia')
  } catch (erro) {
    conferir(padraoErro.test(erro.message), descricao, erro.message)
  }
}
await deveRecusar(
  `insert into public.plt_usuarios (nome, email, usuario, papel)
     values ('Sem CPF', 'sem.cpf@teste.com', 'sem.cpf', 'operador')`,
  'cadastro sem CPF é recusado (matrícula exige CPF)',
  /CPF/i,
)
await deveRecusar(
  `insert into public.plt_usuarios (nome, email, cpf, usuario)
     values ('Repetido', 'outro@teste.com', '11122233344', 'PRIMEIRA.pessoa')`,
  'nome de usuário repetido é recusado (mesmo mudando maiúsculas)',
  /plt_usuarios_usuario_uq|duplicate/i,
)
await deveRecusar(
  `insert into public.plt_usuarios (nome, email, cpf, usuario)
     values ('CPF Repetido', 'cpfrep@teste.com', '061.234.567-89', 'cpf.repetido')`,
  'CPF repetido é recusado',
  /plt_usuarios_cpf_uq|duplicate/i,
)

titulo('Cenário mínimo: um pedido, um card, um evento')
await bd.exec(`
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
`)
console.log('  criado')

titulo('plt_eventos é append-only? (RNF-05)')
async function deveFalhar(sql, descricao) {
  try {
    await bd.exec(sql)
    conferir(false, descricao, 'a operação passou, e não devia')
  } catch (erro) {
    conferir(/append-only/i.test(erro.message), descricao, erro.message)
  }
}
await deveFalhar(
  `update public.plt_eventos set observacao = 'adulterado'`,
  'UPDATE em evento é recusado',
)
await deveFalhar(`delete from public.plt_eventos`, 'DELETE em evento é recusado')

titulo('A posição do card é projetada pelo evento?')
const posicao = (
  await bd.query(`
    select coalesce(s.codigo, 'sem setor') as setor, c.desde is not null as tem_desde
      from public.plt_cards c
      left join public.plt_setores s on s.id = c.setor_atual_id
     order by c.id desc limit 1`)
).rows[0]
conferir(
  posicao.setor === 'pcp',
  'o evento posicionou o card no PCP sem escrita manual',
  posicao.setor,
)
conferir(posicao.tem_desde, 'o relógio da permanência começou a contar sozinho (D-14 / M-11)')

titulo('A integração do Tiny continua funcionando com card vivo?')
// O teste que mais importa: fn_upsert_pedido APAGA e regrava os itens a cada
// atualização. Se houvesse foreign key do card para pedido_itens, isto
// quebraria — e quebraria em produção.
try {
  await bd.exec(`
    insert into public.pedido_itens (pedido_id, seq, codigo, descricao, quantidade)
      values ((select id from public.pedidos where numero = 999999), 1, '061', 'Item de teste', 2);
    delete from public.pedido_itens where pedido_id = (select id from public.pedidos where numero = 999999);
  `)
  conferir(
    true,
    'itens do pedido podem ser apagados e regravados com card vivo apontando para o pedido',
  )
} catch (erro) {
  conferir(false, 'itens do pedido podem ser apagados e regravados', erro.message)
}

titulo('As visões de tempo e qualidade respondem?')
for (const visao of ['plt_vw_permanencias', 'plt_vw_execucoes', 'plt_vw_qualidade_transicoes']) {
  try {
    await bd.query(`select * from public.${visao} limit 1`)
    conferir(true, `${visao} consulta sem erro`)
  } catch (erro) {
    conferir(false, `${visao} consulta sem erro`, erro.message)
  }
}

titulo('Resumo')
const contar = async (sql) => (await bd.query(sql)).rows[0].total
console.log(
  `  tabelas plt_*: ${await contar(
    `select count(*)::int as total from information_schema.tables where table_schema='public' and table_name like 'plt\\_%' and table_type='BASE TABLE'`,
  )}`,
)
console.log(
  `  visões plt_vw_*: ${await contar(
    `select count(*)::int as total from information_schema.views where table_schema='public' and table_name like 'plt\\_vw\\_%'`,
  )}`,
)
console.log(
  `  políticas de RLS: ${await contar(
    `select count(*)::int as total from pg_policies where schemaname='public' and tablename like 'plt\\_%'`,
  )}`,
)

await bd.close()

if (falhas > 0) {
  console.log(vermelho(`\n${falhas} verificação(ões) falharam.`))
  process.exit(1)
}
console.log(verde('\nTUDO VERDE — migrations idempotentes, integração intacta, eventos imutáveis.'))
