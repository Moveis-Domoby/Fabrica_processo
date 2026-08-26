/**
 * APLICADOR DE MIGRATIONS — Plataforma de Produção Domoby
 *
 * Aplica os arquivos de `supabase/migrations/` no banco apontado por
 * SUPABASE_DB_URL do `.env.local`. Nunca imprime credencial nenhuma.
 *
 * ⚠️ REGRA CRÍTICA 2 DA CASA: este script mexe no banco REAL. Ele só roda com
 * `--confirmar`, e antes de qualquer coisa tira um retrato das tabelas da
 * integração do Tiny — conferindo no fim que nada delas mudou. Se tiver mudado,
 * ele grita.
 *
 * Uso:
 *   npm run banco:conferir     → mostra o que está no banco, sem escrever nada
 *   npm run banco:aplicar      → mostra o plano, mas NÃO aplica
 *   npm run banco:aplicar -- --confirmar   → aplica de verdade
 */
import { readFile, readdir } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import pg from 'pg'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MIGRATIONS = path.join(RAIZ, 'supabase/migrations')

const verde = (t) => `\x1b[32m${t}\x1b[0m`
const vermelho = (t) => `\x1b[31m${t}\x1b[0m`
const amarelo = (t) => `\x1b[33m${t}\x1b[0m`
const negrito = (t) => `\x1b[1m${t}\x1b[0m`
const titulo = (t) => console.log(`\n${negrito(`== ${t} ==`)}`)

/** Lê o .env.local sem despejar nada na tela. */
function carregarAmbiente() {
  const arquivo = path.join(RAIZ, '.env.local')
  if (!existsSync(arquivo)) {
    console.error(
      vermelho('Falta o .env.local.') +
        '\nCopie o .env.example para .env.local e preencha com os valores do painel do Supabase.',
    )
    process.exit(1)
  }
  const ambiente = {}
  for (const linha of readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
    const achado = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (achado) ambiente[achado[1]] = achado[2].trim().replace(/^["']|["']$/g, '')
  }
  if (!ambiente.SUPABASE_DB_URL) {
    console.error(vermelho('SUPABASE_DB_URL está vazia no .env.local.'))
    process.exit(1)
  }
  return ambiente
}

const TABELAS_DA_INTEGRACAO = [
  'clientes',
  'pedidos',
  'pedido_itens',
  'eventos',
  'gp_pcp_processados',
]

const SQL_IMPRESSAO_DIGITAL = `
  select md5(string_agg(
           table_name || '.' || column_name || ':' || data_type || ':' || is_nullable,
           '|' order by table_name, ordinal_position)) as digital,
         count(*)::int as colunas
    from information_schema.columns
   where table_schema = 'public'
     and table_name = any($1::text[]);
`

async function contarLinhas(cliente) {
  const contagens = {}
  for (const tabela of TABELAS_DA_INTEGRACAO) {
    const { rows } = await cliente.query(`select count(*)::int as total from public.${tabela}`)
    contagens[tabela] = rows[0].total
  }
  return contagens
}

const confirmado = process.argv.includes('--confirmar')
const soConferir = process.argv.includes('--conferir')
const ambiente = carregarAmbiente()

const cliente = new pg.Client({
  connectionString: ambiente.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})
await cliente.connect()

try {
  const { rows: identidade } = await cliente.query(
    `select current_database() as banco, version() as versao`,
  )
  titulo('Banco conectado')
  console.log(`  ${identidade[0].banco} · ${identidade[0].versao.split(',')[0]}`)

  titulo('Tabelas da integração do Tiny (não se toca nelas)')
  const linhasAntes = await contarLinhas(cliente)
  for (const [tabela, total] of Object.entries(linhasAntes)) {
    console.log(`  ${tabela.padEnd(20)} ${String(total).padStart(6)} linha(s)`)
  }
  const { rows: antes } = await cliente.query(SQL_IMPRESSAO_DIGITAL, [TABELAS_DA_INTEGRACAO])
  console.log(`  impressão digital: ${antes[0].digital} (${antes[0].colunas} colunas)`)

  const { rows: plataformaAntes } = await cliente.query(`
    select table_name from information_schema.tables
     where table_schema = 'public' and table_name like 'plt\\_%'
     order by table_name`)
  titulo('Tabelas da plataforma já existentes')
  console.log(
    plataformaAntes.length
      ? '  ' + plataformaAntes.map((t) => t.table_name).join(', ')
      : '  nenhuma',
  )

  const arquivos = (await readdir(MIGRATIONS)).filter((f) => f.endsWith('.sql')).sort()

  if (soConferir) {
    titulo('Modo conferência — nada foi escrito')
    process.exit(0)
  }

  titulo(`Plano: ${arquivos.length} migration(s)`)
  arquivos.forEach((f) => console.log(`  · ${f}`))

  if (!confirmado) {
    console.log(
      amarelo(
        '\nNada foi aplicado. Este banco é o de PRODUÇÃO da fábrica.\n' +
          'Para aplicar de verdade:  npm run banco:aplicar -- --confirmar',
      ),
    )
    process.exit(0)
  }

  titulo('Aplicando')
  for (const arquivo of arquivos) {
    const sql = await readFile(path.join(MIGRATIONS, arquivo), 'utf8')
    // Cada migration numa transação: ou entra inteira, ou não entra.
    await cliente.query('begin')
    try {
      await cliente.query(sql)
      await cliente.query('commit')
      console.log(`  ${verde('✔')} ${arquivo}`)
    } catch (erro) {
      await cliente.query('rollback')
      console.log(`  ${vermelho('✘')} ${arquivo}\n     ${erro.message}`)
      throw erro
    }
  }

  titulo('Conferindo que a integração do Tiny está intacta')
  const { rows: depois } = await cliente.query(SQL_IMPRESSAO_DIGITAL, [TABELAS_DA_INTEGRACAO])
  const linhasDepois = await contarLinhas(cliente)

  const estruturaIgual = antes[0].digital === depois[0].digital
  const linhasIguais = TABELAS_DA_INTEGRACAO.every((t) => linhasAntes[t] === linhasDepois[t])

  console.log(
    `  estrutura: ${estruturaIgual ? verde('idêntica') : vermelho('MUDOU — investigar agora')}`,
  )
  console.log(
    `  linhas:    ${linhasIguais ? verde('idênticas') : vermelho('MUDARAM — investigar agora')}`,
  )
  if (!estruturaIgual || !linhasIguais) process.exit(1)

  titulo('Resultado')
  const { rows: resumo } = await cliente.query(`
    select
      (select count(*)::int from information_schema.tables
        where table_schema='public' and table_name like 'plt\\_%' and table_type='BASE TABLE') as tabelas,
      (select count(*)::int from information_schema.views
        where table_schema='public' and table_name like 'plt\\_vw\\_%') as visoes,
      (select count(*)::int from pg_policies
        where schemaname='public' and tablename like 'plt\\_%') as politicas,
      (select count(*)::int from public.plt_setores) as setores,
      (select count(*)::int from public.plt_etapas) as etapas`)
  const r = resumo[0]
  console.log(
    `  ${r.tabelas} tabelas · ${r.visoes} visões · ${r.politicas} políticas de RLS · ` +
      `${r.setores} setores · ${r.etapas} etapas`,
  )
  console.log(verde('\nMigrations aplicadas. Integração do Tiny intacta.'))
} finally {
  await cliente.end()
}
