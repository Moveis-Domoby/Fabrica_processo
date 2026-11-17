/**
 * ANTES DE APLICAR A SESSAO-51 (só leitura): o corpo de cada função que as atualizações
 * recriam é, no banco VIVO, o mesmo da última versão das migrations já aplicadas? (md5 do
 * corpo, fim de linha normalizado). E ninguém de fora do repositório chama a entrega parcial
 * de 5 argumentos (ela é trocada pela de 6). E o retrato das entregas parciais de ANTES
 * desta sessão (a demanda pede contar e listar — D-334). Não escreve nada; não imprime credencial (lê o SUPABASE_DB_URL do
 * .env.local como o aplicador). Adaptado do conferir-vivas da SESSAO-47/50.
 *
 * Uso: node conferir-vivas.mjs <repo> <pasta das vigentes (vigentes-antes.mjs)> <função nova>...
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { lookup } from 'node:dns/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

const [RAIZ, PASTA, ...NOVAS] = process.argv.slice(2)
const pg = createRequire(path.join(RAIZ, 'package.json'))('pg')

function ambiente() {
  const arquivo = path.join(RAIZ, '.env.local')
  if (!existsSync(arquivo)) throw new Error('falta o .env.local')
  const a = {}
  for (const linha of readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (m) a[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  if (!a.SUPABASE_DB_URL) throw new Error('SUPABASE_DB_URL vazia')
  return a
}
function partir(url) {
  const s = url.slice(url.indexOf('://') + 3)
  const c = s.lastIndexOf('@')
  const cred = s.slice(0, c)
  const dest = s.slice(c + 1)
  const d = cred.indexOf(':')
  const [hp, database = 'postgres'] = dest.split('/')
  const [host, porta = '5432'] = hp.split(':')
  return { user: decodeURIComponent(cred.slice(0, d)), password: cred.slice(d + 1), host, port: Number(porta), database: database.split('?')[0] }
}
const REGIOES = { axnzldwgwsmepukdiljx: 'ca-central-1' }
async function conectar(cfg) {
  const candidatos = []
  try { await lookup(cfg.host); candidatos.push(cfg) } catch { /* sem rota */ }
  const ref = (cfg.host.match(/^db\.([a-z]+)\.supabase\.co$/) || [])[1] || (cfg.user.match(/^postgres\.([a-z]+)$/) || [])[1]
  const regiao = REGIOES[ref]
  if (regiao) for (const n of [0, 1]) candidatos.push({ ...cfg, host: `aws-${n}-${regiao}.pooler.supabase.com`, port: 5432, user: `postgres.${ref}` })
  let ultimo
  for (const c of candidatos) {
    const t = new pg.Client({ ...c, ssl: { rejectUnauthorized: false } })
    try { await t.connect(); return t } catch (e) { ultimo = e; try { await t.end() } catch { /* */ } }
  }
  throw new Error('sem caminho até o banco: ' + ultimo?.message)
}

const md5 = (t) => createHash('md5').update(t, 'utf8').digest('hex')
function corpo(sql) {
  const m = /\bas\s+(\$[A-Za-z_]*\$)/i.exec(sql)
  if (!m) return null
  const ini = m.index + m[0].length
  const fim = sql.lastIndexOf(m[1])
  return fim > ini ? sql.slice(ini, fim).replace(/\r\n/g, '\n') : null
}

const esperadas = new Map()
const visoes = []
for (const arq of readdirSync(PASTA).filter((f) => f.endsWith('.sql'))) {
  const texto = readFileSync(path.join(PASTA, arq), 'utf8')
  const nome = arq.replace(/\.sql$/, '')
  const origem = texto.split('\n')[0].replace('-- vigente em ', '').trim()
  if (/create\s+(or\s+replace\s+)?view/i.test(texto)) { visoes.push(nome); continue }
  const c = corpo(texto)
  if (c !== null) esperadas.set(nome, { origem, md5: md5(c) })
}

const cliente = await conectar(partir(ambiente().SUPABASE_DB_URL))
try {
  await cliente.query('begin transaction read only')
  const { rows } = await cliente.query(
    `select n.nspname || '.' || p.proname as nome, pg_get_function_identity_arguments(p.oid) as args,
            md5(replace(p.prosrc, E'\\r\\n', E'\\n')) as md5
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname || '.' || p.proname = any($1::text[])
      order by 1, 2`, [[...esperadas.keys(), ...NOVAS]])
  const vivas = new Map()
  for (const r of rows) vivas.set(r.nome, [...(vivas.get(r.nome) ?? []), r])
  let iguais = 0
  const problemas = []
  for (const [nome, e] of esperadas) {
    const lista = vivas.get(nome) ?? []
    if (lista.length === 0) { problemas.push(`${nome}: NÃO EXISTE no banco (esperada de ${e.origem})`); continue }
    if (lista.some((v) => v.md5 === e.md5)) iguais++
    else problemas.push(`${nome}(${lista.map((v) => v.args).join(' | ').slice(0, 90)}): corpo DIFERENTE do de ${e.origem}`)
  }
  for (const nome of NOVAS) if (vivas.has(nome)) problemas.push(`${nome}: já existe no banco (devia nascer agora)`)
  const { rows: v } = await cliente.query(
    `select schemaname || '.' || viewname as nome from pg_views where schemaname || '.' || viewname = any($1::text[])`, [visoes])
  for (const nome of visoes) if (!v.some((x) => x.nome === nome)) problemas.push(`${nome}: a visão NÃO EXISTE no banco`)
  // quem chama a entrega parcial de 5 argumentos (a 51 a troca pela de 6) — só o navegador pode
  const { rows: chamam } = await cliente.query(
    `select n.nspname || '.' || p.proname as nome
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where (p.prosrc ilike '%plt_fn_entrega_parcial(%')
        and p.proname not in ('plt_fn_entrega_parcial')
      order by 1`)
  const fora = chamam.map((r) => r.nome).filter((n) => !esperadas.has(n))
  for (const n of fora) problemas.push(`${n}: chama a entrega parcial e NÃO é recriada pelas atualizações`)
  console.log(`funções conferidas: ${esperadas.size} · corpo igual ao esperado: ${iguais} · visões: ${visoes.length} · novas: ${NOVAS.length} · problemas: ${problemas.length}`)
  for (const p of problemas) console.log('  ✘ ' + p)
  if (problemas.length > 0) process.exitCode = 1
  // o retrato das entregas parciais de ANTES desta sessão (D-334: contar e listar; nada é mexido)
  try {
    const { rows: est } = await cliente.query(`
      with p as (
        select c.id, c.pedido_id, pe.numero, e.ocorrido_em as em, c.arquivado_em, c.liberado_completo_em
          from public.plt_cards c
          join public.plt_eventos e on e.id = c.entrega_evento_id and e.tipo = 'pedido_entregue'
                                   and e.dados ->> 'parcial' = 'true'
          left join public.pedidos pe on pe.id = c.pedido_id
         where c.tipo = 'pedido'
      )
      select (select count(*)::int from p) as pedidos,
             (select count(*)::int from p where p.arquivado_em is null and p.liberado_completo_em is null) as ainda_aguardando_no_pcp,
             (select count(*)::int from public.plt_cards u join p on u.pedido_id = p.pedido_id
                join public.plt_setores s on s.id = u.setor_atual_id
               where u.tipo = 'unidade' and u.arquivado_em is null and s.codigo = 'devolucao') as pecas_em_decisao_pos_devolucao,
             (select count(*)::int from public.plt_cards u join p on u.pedido_id = p.pedido_id
                join public.plt_setores s on s.id = u.setor_atual_id
               where u.tipo = 'unidade' and u.arquivado_em is null and s.papel_no_fluxo = 'producao') as pecas_ainda_em_producao,
             (select string_agg(p.numero::text || ' (' || to_char(p.em at time zone 'America/Fortaleza', 'DD/MM') || ')', ', ' order by p.em desc)
                from p) as numeros`)
    console.log('entregas parciais de antes desta sessão: ' + JSON.stringify(est[0]))
  } catch (e) {
    console.log('(o retrato das entregas parciais não saiu: ' + e.message + ' — não impede nada)')
  }
  await cliente.query('rollback')
} finally {
  await cliente.end()
}
