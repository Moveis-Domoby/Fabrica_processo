/**
 * CUTOVER DO COMERCIAL — SESSAO-21 (F6.3 e F6.5) · agenda os crons na FÁBRICA
 *
 * Lê o modelo versionado `supabase/cron/cron_comercial.sql`, troca
 * <PROJECT_REF>/<ANON_KEY> pelos valores do `.env.local` e agenda UM job por
 * vez. Nenhuma chave passa por chat, log ou tela (regra crítica 4) — só nomes,
 * horários e estados são impressos.
 *
 * Guardas antes de escrever qualquer coisa:
 *   1. o destino é o projeto da FÁBRICA (ref conferido no SUPABASE_URL);
 *   2. a chave é a ANON do mesmo projeto (papel lido do próprio JWT — nunca a
 *      service_role por engano);
 *   3. o job homônimo está DESLIGADO no projeto antigo (regra do dono único:
 *      renovador do token e disparo nunca ativos nos dois ao mesmo tempo).
 *
 * Ambiente (.env.local): SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_DB_URL
 * (fábrica) e RECOMPRA_DB_URL (projeto antigo, só leitura).
 *
 * Uso:
 *   node supabase/manutencao/2026-09-22_agendar_crons_comercial.mjs
 *       → só confere: jobs dos dois projetos (nome, horário, ativo)
 *   ... --job tiny-auth-refresh-cron --confirmar
 *       → agenda esse job na fábrica
 *   ... --disparar tiny-auth-refresh-cron --confirmar
 *       → roda UMA VEZ, agora, o comando do job já agendado (passo 5 do
 *         cutover) e mostra a resposta da function + tiny_auth.updated_at
 *         nos dois projetos (só datas — nunca o token)
 */
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { lookup } from 'node:dns/promises'
import path from 'node:path'
import pg from 'pg'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const MODELO = path.join(RAIZ, 'supabase/cron/cron_comercial.sql')
const REF_FABRICA = 'axnzldwgwsmepukdiljx'
const REGIOES = { axnzldwgwsmepukdiljx: 'ca-central-1', kfkcumjepnxnnzyvmxfo: 'us-east-1' }

const verde = (t) => `\x1b[32m${t}\x1b[0m`
const vermelho = (t) => `\x1b[31m${t}\x1b[0m`
const negrito = (t) => `\x1b[1m${t}\x1b[0m`
const titulo = (t) => console.log(`\n${negrito(`== ${t} ==`)}`)
const parar = (msg) => { console.error(vermelho(`\n✘ ${msg}`)); process.exit(1) }

function argumento(nome) {
  const i = process.argv.indexOf(nome)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const confirmar = process.argv.includes('--confirmar')
const jobAgendar = argumento('--job')
const jobDisparar = argumento('--disparar')

/** Lê o .env.local sem despejar nada na tela (mesma mecânica do aplicador). */
function carregarAmbiente() {
  const arquivo = path.join(RAIZ, '.env.local')
  if (!existsSync(arquivo)) parar('Falta o .env.local na raiz do repo.')
  const ambiente = {}
  for (const linha of readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
    const achado = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (achado) ambiente[achado[1]] = achado[2].trim().replace(/^["']|["']$/g, '')
  }
  for (const chave of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_DB_URL', 'RECOMPRA_DB_URL']) {
    if (!ambiente[chave]) parar(`${chave} está vazia no .env.local.`)
  }
  return ambiente
}

/** E-12: fatia a connection string à mão (senha com # quebra parser de URL). */
function fatiarUrl(url) {
  const semEsquema = url.replace(/^postgres(ql)?:\/\//, '')
  const arroba = semEsquema.lastIndexOf('@')
  const credenciais = semEsquema.slice(0, arroba)
  const resto = semEsquema.slice(arroba + 1)
  const doisPontos = credenciais.indexOf(':')
  const user = credenciais.slice(0, doisPontos)
  const password = credenciais.slice(doisPontos + 1)
  const barra = resto.indexOf('/')
  const hostPorta = barra < 0 ? resto : resto.slice(0, barra)
  const database = (barra < 0 ? 'postgres' : resto.slice(barra + 1).split('?')[0]) || 'postgres'
  const [host, porta] = hostPorta.split(':')
  return { user, password, host, port: Number(porta || 5432), database }
}

/** A-15 + S22: sem rota IPv6, testa CONECTANDO nos poolers da região. */
async function conectar(nome, url) {
  const cfg = fatiarUrl(url)
  const candidatos = []
  try { await lookup(cfg.host); candidatos.push(cfg) } catch { /* sem rota direta */ }
  const ref = (cfg.host.match(/^db\.([a-z]+)\.supabase\.co$/) || [])[1]
    || (cfg.user.match(/^postgres\.([a-z]+)$/) || [])[1]
  if (REGIOES[ref]) {
    for (const n of [0, 1]) {
      candidatos.push({ ...cfg, host: `aws-${n}-${REGIOES[ref]}.pooler.supabase.com`, port: 5432, user: `postgres.${ref}` })
    }
  }
  for (const candidato of candidatos) {
    const cliente = new pg.Client({ ...candidato, ssl: { rejectUnauthorized: false } })
    try {
      await cliente.connect()
      console.log(`  ${verde('✔')} conectado ao ${nome}`)
      return { cliente, ref }
    } catch {
      try { await cliente.end() } catch { /* já caiu */ }
    }
  }
  parar(`Nenhum caminho até o banco ${nome} funcionou.`)
}

/** Papel e projeto de dentro do JWT — sem imprimir o token. */
function lerJwt(token) {
  const partes = token.split('.')
  if (partes.length !== 3) return null
  try {
    return JSON.parse(Buffer.from(partes[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
  } catch { return null }
}

/** Blocos do modelo, indexados pelo marcador `-- @job <nome>`. */
function lerModelo() {
  const texto = readFileSync(MODELO, 'utf8')
  const blocos = {}
  const partes = texto.split(/^-- @job /m).slice(1)
  for (const parte of partes) {
    const nome = parte.slice(0, parte.indexOf('\n')).trim()
    blocos[nome] = parte.slice(parte.indexOf('\n') + 1)
  }
  return blocos
}

async function listarJobs(cliente) {
  const { rows } = await cliente.query('select jobname, schedule, active from cron.job order by jobname')
  return rows
}

const ambiente = carregarAmbiente()
const refUrl = (ambiente.SUPABASE_URL.match(/^https:\/\/([a-z]+)\.supabase\.co/) || [])[1]
if (refUrl !== REF_FABRICA) parar('SUPABASE_URL do .env.local não é o projeto da fábrica — nada feito.')
const jwt = lerJwt(ambiente.SUPABASE_ANON_KEY)
if (!jwt || jwt.role !== 'anon' || jwt.ref !== REF_FABRICA) {
  parar('SUPABASE_ANON_KEY não é a chave ANON da fábrica (papel/projeto do JWT não conferem) — nada feito.')
}

titulo('Conectando (nenhum valor é impresso)')
const { cliente: fabrica, ref: refFabrica } = await conectar('banco da fábrica', ambiente.SUPABASE_DB_URL)
const { cliente: antigo } = await conectar('banco antigo (só leitura)', ambiente.RECOMPRA_DB_URL)
if (refFabrica !== REF_FABRICA) parar('SUPABASE_DB_URL não aponta para a fábrica — nada feito.')

async function exigirDesligadoNoAntigo(job) {
  const { rows } = await antigo.query('select active from cron.job where jobname = $1', [job])
  if (rows.some((r) => r.active)) parar(`"${job}" está ATIVO no projeto antigo — desligue lá antes (regra do dono único).`)
  console.log(`  ${verde('✔')} "${job}" ${rows.length ? 'desativado' : 'inexistente'} no projeto antigo`)
}

async function tokenDatas() {
  const sql = 'select updated_at from public.tiny_auth where id = 1'
  const [f, a] = [await fabrica.query(sql), await antigo.query(sql)]
  return { fabrica: f.rows[0]?.updated_at?.toISOString(), antigo: a.rows[0]?.updated_at?.toISOString() }
}

try {
  const modelo = lerModelo()

  if (jobAgendar) {
    if (!modelo[jobAgendar]) parar(`"${jobAgendar}" não existe no modelo. Jobs: ${Object.keys(modelo).join(', ')}`)
    titulo(`Agendar "${jobAgendar}" na fábrica`)
    await exigirDesligadoNoAntigo(jobAgendar)
    if (!confirmar) {
      console.log('  Modo conferência — nada escrito (use --confirmar).')
    } else {
      const sql = modelo[jobAgendar]
        .replaceAll('<PROJECT_REF>', REF_FABRICA)
        .replaceAll('<ANON_KEY>', ambiente.SUPABASE_ANON_KEY)
      if (/<[A-Z_]+>/.test(sql)) parar('Sobrou placeholder no SQL — nada feito.')
      await fabrica.query(sql)
      const { rows } = await fabrica.query(
        "select active, position('<' in command) = 0 as sem_placeholder from cron.job where jobname = $1", [jobAgendar])
      if (!rows[0]?.active || !rows[0]?.sem_placeholder) parar('O job não ficou ativo/íntegro — confira no banco.')
      console.log(`  ${verde('✔')} agendado e ativo`)
    }
  }

  if (jobDisparar) {
    titulo(`Disparo manual de "${jobDisparar}" (uma vez, agora)`)
    await exigirDesligadoNoAntigo(jobDisparar)
    const { rows } = await fabrica.query('select command from cron.job where jobname = $1 and active', [jobDisparar])
    if (!rows.length) parar(`"${jobDisparar}" não está agendado/ativo na fábrica — agende antes.`)
    const ehRenovador = jobDisparar === 'tiny-auth-refresh-cron'
    const antes = ehRenovador ? await tokenDatas() : null
    if (ehRenovador) console.log(`  tiny_auth.updated_at ANTES  → fábrica ${antes.fabrica} · antigo ${antes.antigo}`)
    if (!confirmar) {
      console.log('  Modo conferência — nada disparado (use --confirmar).')
    } else {
      const { rows: req } = await fabrica.query(rows[0].command)
      const id = Object.values(req[0])[0]
      let resposta
      for (let i = 0; i < 30 && !resposta; i++) {
        await new Promise((r) => setTimeout(r, 2000))
        const { rows: r } = await fabrica.query(
          'select status_code, content, error_msg from net._http_response where id = $1', [id])
        resposta = r[0]
      }
      if (!resposta) parar('Sem resposta da function em 60s — confira net._http_response.')
      let resumo = resposta.error_msg || ''
      try {
        const corpo = JSON.parse(resposta.content || '{}')
        if (corpo.ok) resumo = `ok — ${corpo.message}`
        else if (corpo.error || corpo.msg) resumo = `erro — ${String(corpo.error || corpo.msg).slice(0, 300)}`
        // functions de disparo: só a FORMA da resposta (chaves e contagens), nunca dado de membro
        else resumo = Object.entries(corpo).map(([k, v]) => `${k}=${Array.isArray(v) ? `[${v.length}]` : typeof v === 'object' && v ? '{…}' : v}`).join(' ')
      } catch { resumo = resumo || String(resposta.content || '').slice(0, 300) }
      const cor = resposta.status_code === 200 ? verde : vermelho
      console.log(`  resposta HTTP ${cor(resposta.status_code)} · ${resumo}`)
      if (resposta.status_code !== 200) process.exitCode = 1
      if (ehRenovador) {
        const depois = await tokenDatas()
        console.log(`  tiny_auth.updated_at DEPOIS → fábrica ${depois.fabrica} · antigo ${depois.antigo}`)
        const avancou = depois.fabrica !== antes.fabrica
        const antigoParado = depois.antigo === antes.antigo
        console.log(`  ${avancou ? verde('✔') : vermelho('✘')} fábrica ${avancou ? 'AVANÇOU' : 'NÃO avançou'} · ` +
          `${antigoParado ? verde('✔') : vermelho('✘')} antigo ${antigoParado ? 'parado' : 'MUDOU'}`)
        if (!avancou || !antigoParado) process.exitCode = 1
      }
    }
  }

  titulo('Jobs agora (nome · horário · ativo)')
  for (const [nome, cliente] of [['fábrica', fabrica], ['antigo', antigo]]) {
    for (const j of await listarJobs(cliente)) {
      console.log(`  ${nome.padEnd(8)} ${j.jobname.padEnd(32)} ${j.schedule.padEnd(12)} ${j.active ? verde('ativo') : 'desativado'}`)
    }
  }
} finally {
  await fabrica.end()
  await antigo.end()
}
