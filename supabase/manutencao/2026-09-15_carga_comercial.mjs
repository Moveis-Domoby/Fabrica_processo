/**
 * CARGA DO MÓDULO COMERCIAL — SESSAO-19 (F3) · reutilizável no delta da SESSAO-21
 *
 * Copia as 6 tabelas do domínio do recompra (banco `kfkcumjepnxnnzyvmxfo`)
 * para o banco da fábrica (`axnzldwgwsmepukdiljx`), byte a byte, servidor a
 * servidor — NENHUM valor passa por chat, log ou tela (regra crítica 4:
 * `tiny_auth` carrega o token OAuth do Tiny). Só contagens e checksums são
 * impressos.
 *
 * Estratégia: espelho completo (delete + insert em transação, na ordem das
 * FKs). Rodar de novo = re-espelhar; é exatamente o gesto do delta final do
 * cutover (SESSAO-21). O destino tem RLS, mas a conexão é o dono do banco.
 *
 * Ambiente (.env.local na raiz do repo):
 *   SUPABASE_DB_URL   — connection string do banco da FÁBRICA (já existe)
 *   RECOMPRA_DB_URL   — connection string do banco do RECOMPRA (adicionar)
 *
 * Sem rota IPv6, o host direto (db.<ref>.supabase.co) não resolve — o script
 * deriva sozinho o session pooler IPv4 (aws-N-<região>.pooler.supabase.com,
 * usuário postgres.<ref>), tentando as variantes conhecidas.
 *
 * Uso:
 *   node supabase/manutencao/2026-09-15_carga_comercial.mjs             → só confere (contagens origem×destino)
 *   node supabase/manutencao/2026-09-15_carga_comercial.mjs --confirmar → copia de verdade
 */
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { lookup } from 'node:dns/promises'
import path from 'node:path'
import pg from 'pg'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

const verde = (t) => `\x1b[32m${t}\x1b[0m`
const vermelho = (t) => `\x1b[31m${t}\x1b[0m`
const negrito = (t) => `\x1b[1m${t}\x1b[0m`
const titulo = (t) => console.log(`\n${negrito(`== ${t} ==`)}`)

const REGIOES = { axnzldwgwsmepukdiljx: 'ca-central-1', kfkcumjepnxnnzyvmxfo: 'us-east-1' }

// Ordem respeita as FKs (listas antes de membros antes de eventos).
const TABELAS = [
  'listas_disparo',
  'listas_disparo_membros',
  'listas_disparo_eventos',
  'webhook_eventos_crm',
  'tarifas_mensagem_whatsapp',
  'tiny_auth',
]

/** Lê o .env.local sem despejar nada na tela (mesma mecânica do aplicador). */
function carregarAmbiente() {
  const arquivo = path.join(RAIZ, '.env.local')
  if (!existsSync(arquivo)) {
    console.error(vermelho('Falta o .env.local na raiz do repo.'))
    process.exit(1)
  }
  const ambiente = {}
  for (const linha of readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
    const achado = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (achado) ambiente[achado[1]] = achado[2].trim().replace(/^["']|["']$/g, '')
  }
  for (const chave of ['SUPABASE_DB_URL', 'RECOMPRA_DB_URL']) {
    if (!ambiente[chave]) {
      console.error(
        vermelho(`${chave} está vazia no .env.local.`) +
          (chave === 'RECOMPRA_DB_URL'
            ? '\nAdicione a connection string do banco do Painel de recompra (valor com # ou espaço vai entre aspas duplas).'
            : ''),
      )
      process.exit(1)
    }
  }
  return ambiente
}

/**
 * Fatia a connection string À MÃO (E-12: senha com # quebra parser de URL).
 * Corta na ÚLTIMA arroba; a senha vai crua ao driver.
 */
function fatiarUrl(url) {
  const semEsquema = url.replace(/^postgres(ql)?:\/\//, '')
  const arroba = semEsquema.lastIndexOf('@')
  if (arroba < 0) return null
  const credenciais = semEsquema.slice(0, arroba)
  const resto = semEsquema.slice(arroba + 1)
  const doisPontos = credenciais.indexOf(':')
  const user = doisPontos < 0 ? credenciais : credenciais.slice(0, doisPontos)
  const password = doisPontos < 0 ? '' : credenciais.slice(doisPontos + 1)
  const barra = resto.indexOf('/')
  const hostPorta = barra < 0 ? resto : resto.slice(0, barra)
  const database = (barra < 0 ? 'postgres' : resto.slice(barra + 1).split('?')[0]) || 'postgres'
  const [host, porta] = hostPorta.split(':')
  return { user, password, host, port: Number(porta || 5432), database }
}

/** Host direto sem rota? Deriva o session pooler IPv4 da região do projeto. */
async function resolverDestino(cfg) {
  try {
    await lookup(cfg.host)
    return cfg
  } catch {
    const ref = (cfg.host.match(/^db\.([a-z]+)\.supabase\.co$/) || [])[1]
      || (cfg.user.match(/^postgres\.([a-z]+)$/) || [])[1]
    const regiao = REGIOES[ref]
    if (!ref || !regiao) {
      console.error(vermelho(`Host "${cfg.host}" não resolve e não sei derivar o pooler dele.`))
      process.exit(1)
    }
    for (const n of [1, 0]) {
      const hostPooler = `aws-${n}-${regiao}.pooler.supabase.com`
      try {
        await lookup(hostPooler)
        console.log(`  · sem rota até ${cfg.host} — usando o session pooler ${hostPooler}`)
        return { ...cfg, host: hostPooler, port: 5432, user: `postgres.${ref}` }
      } catch { /* tenta a próxima variante */ }
    }
    console.error(vermelho(`Nenhum pooler da região ${regiao} resolve daqui.`))
    process.exit(1)
  }
}

async function conectar(nome, url) {
  const cfg = await resolverDestino(fatiarUrl(url))
  const cliente = new pg.Client({ ...cfg, ssl: { rejectUnauthorized: false } })
  await cliente.connect()
  // O checksum usa ::text de linha inteira — fixar o formato nos DOIS lados
  // para timestamptz/date renderizarem igual, independentemente do default.
  await cliente.query(`set timezone = 'UTC'; set datestyle = 'ISO, MDY'`)
  const quem = await cliente.query('select current_database() as bd')
  console.log(`  ${verde('✔')} conectado ao ${nome} (${quem.rows[0].bd})`)
  return cliente
}

/** Contagem + checksum de uma tabela (md5 do agregado ordenado por PK). */
async function retrato(cliente, tabela) {
  const { rows } = await cliente.query(
    `select count(*)::int as total,
            coalesce(md5(string_agg(t.*::text, '|' order by t.id)), 'vazio') as checksum
       from public.${tabela} t`,
  )
  return rows[0]
}

const confirmar = process.argv.includes('--confirmar')
const ambiente = carregarAmbiente()

titulo('Conectando (nenhum valor é impresso)')
const origem = await conectar('recompra (origem)', ambiente.RECOMPRA_DB_URL)
const destino = await conectar('fábrica (destino)', ambiente.SUPABASE_DB_URL)

titulo(confirmar ? 'Copiando as 6 tabelas (espelho completo, em transação)' : 'Modo conferência — nada será escrito (use --confirmar)')

let divergencias = 0
if (confirmar) {
  await destino.query('begin')
  try {
    // Ordem inversa para apagar (FKs), ordem direta para inserir.
    for (const tabela of [...TABELAS].reverse()) {
      await destino.query(`delete from public.${tabela}`)
    }
    for (const tabela of TABELAS) {
      const { rows } = await origem.query(`select to_jsonb(t.*) as linha from public.${tabela} t order by t.id`)
      for (const { linha } of rows) {
        await destino.query(
          `insert into public.${tabela} select * from jsonb_populate_record(null::public.${tabela}, $1::jsonb)`,
          [linha],
        )
      }
      console.log(`  · ${tabela}: ${rows.length} linha(s) copiadas`)
    }
    await destino.query('commit')
  } catch (erro) {
    await destino.query('rollback')
    console.error(vermelho(`\nFalhou e NADA foi gravado (rollback): ${erro.message}`))
    process.exit(1)
  }
}

titulo('Conferência origem × destino (contagem e checksum por tabela)')
for (const tabela of TABELAS) {
  const [de, para] = [await retrato(origem, tabela), await retrato(destino, tabela)]
  const bate = de.total === para.total && de.checksum === para.checksum
  if (!bate) divergencias += 1
  console.log(
    `  ${bate ? verde('✔') : vermelho('✘')} ${tabela}: origem ${de.total} × destino ${para.total}` +
      ` — checksum ${bate ? 'idêntico' : `DIFERE (${de.checksum.slice(0, 8)}… × ${para.checksum.slice(0, 8)}…)`}`,
  )
}

await origem.end()
await destino.end()

if (divergencias > 0) {
  console.log(vermelho(`\n${divergencias} tabela(s) divergem.` + (confirmar ? '' : ' Rode com --confirmar para copiar.')))
  process.exit(confirmar ? 1 : 0)
}
console.log(verde('\nTUDO IDÊNTICO — as 6 tabelas batem byte a byte entre os dois bancos.'))
