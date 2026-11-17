/**
 * SUBIR A SESSAO-51 — um comando por passo; CADA PASSO SÓ COM O OK DO DONO NA CONVERSA
 * (regra 2 da casa: "Migration, acerto de dado e publicação só com o meu OK, cada um em
 * passo separado"). Modelo: o programa da SESSAO-50 (A-211).
 *
 *   node "SESSAO-51 - subida (programa, 2026-11-17).mjs" conferir
 *       → só leitura: o corpo vivo de cada função que a 51 recria é o esperado? as novas
 *         ainda não existem? ninguém de fora chama a entrega parcial de 5 argumentos?
 *         + o retrato das entregas parciais de antes desta sessão (contar e listar — D-334)
 *   node "SESSAO-51 - subida (programa, 2026-11-17).mjs" banco
 *       → conferir + aplicar as 3 atualizações, na ordem (o aplicador da casa, --so, uma
 *         transação cada, a integração do Tiny conferida em cada uma)
 *   node "SESSAO-51 - subida (programa, 2026-11-17).mjs" site
 *       → manda o ramo da sessão para a main do GitHub (a Vercel publica) — só depois do banco
 *
 * Parou no meio? Nada do que vem depois é feito. As atualizações são reaplicáveis; o envio do
 * site só anda para a frente. Não imprime credencial (o aplicador e a conferência leem o
 * SUPABASE_DB_URL do .env.local sem mostrar).
 */
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const R = 'C:/Users/wccau/Domoby/Domoby - fabrica'
const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAMO = 'sessao-51-entrega-parcial-mover-pcp'
const MIGRATIONS = [
  '20261116010000_plt_sessao51_base.sql',
  '20261116020000_plt_entrega_parcial_mantem_producao.sql',
  '20261116030000_plt_mover_card_para_pcp.sql',
]
const VIGENTES = path.join(AQUI, 'SESSAO-51 - subida - vigentes antes (programa, 2026-11-17).mjs')
const CONFERIR = path.join(AQUI, 'SESSAO-51 - subida - conferir vivas (programa, 2026-11-17).mjs')
const passo = process.argv[2]
const semCor = (t) => t.replace(/\x1b\[[0-9;]*m/g, '')

function rodar(titulo, comando, args, opcoes = {}) {
  console.log(`\n================ ${titulo} ================`)
  const r = spawnSync(comando, args, { cwd: R, encoding: 'utf8', maxBuffer: 1 << 26, ...opcoes })
  const saida = (r.stdout ?? '') + (r.stderr ?? '')
  process.stdout.write(saida)
  return { ok: r.status === 0, saida: semCor(saida) }
}
function parar(titulo, dica = '') {
  console.log(`\n❌ PAROU EM: ${titulo}. Nada do que vem depois foi feito.${dica ? '\n' + dica : ''}`)
  process.exit(1)
}

function conferir() {
  const vig = path.join(tmpdir(), 'sessao51-vigentes-antes')
  const a = rodar('as versões vigentes antes da sessão (do repositório)', process.execPath, [VIGENTES, R, vig, ...MIGRATIONS])
  if (!a.ok) parar('montar as vigentes')
  const linha = a.saida.split(/\r?\n/).find((l) => l.startsWith('novas (não podem existir no banco vivo antes):')) ?? ''
  const NOVAS = linha.split(':').slice(1).join(':').split(',').map((s) => s.trim()).filter(Boolean)
  if (NOVAS.length === 0) parar('ler as funções novas', 'A lista das vigentes não trouxe nenhuma função nova — conferir antes de seguir.')
  const b = rodar('conferindo o banco vivo (só leitura)', process.execPath, [CONFERIR, R, vig, ...NOVAS])
  if (!b.ok) parar('conferir o banco vivo', 'Alguma função do banco não é a que as atualizações esperam — nada foi escrito.')
}

if (passo === 'conferir') conferir()
else if (passo === 'banco') {
  conferir()
  for (const arquivo of MIGRATIONS) {
    const r = rodar(`aplicando ${arquivo}`, process.execPath, [path.join(R, 'supabase/aplicar-migrations.mjs'), '--confirmar', '--so', arquivo])
    if (r.ok) continue
    // o falso alarme conhecido (A-211): a atualização entrou, a estrutura da integração é a mesma,
    // só a contagem de linhas mudou no meio porque chegou um aviso do Tiny
    const entrou = r.saida.includes(`✔ ${arquivo}`) && /estrutura:\s+idêntica/.test(r.saida) && /linhas:\s+MUDARAM/.test(r.saida)
    if (entrou) { console.log(`\n⚠️  ${arquivo} ENTROU; só a contagem de linhas da integração mudou no meio (chegou algo do Tiny). Seguindo.`); continue }
    parar(`aplicar ${arquivo}`)
  }
  console.log('\n✅ BANCO: as 3 atualizações entraram, na ordem.')
} else if (passo === 'site') {
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0' }
  const f = rodar('buscando a main do GitHub', 'git',
    ['-C', R, '-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential', 'fetch', 'origin', 'main'], { env })
  if (!f.ok) parar('buscar a main do GitHub')
  const anc = spawnSync('git', ['-C', R, 'merge-base', '--is-ancestor', 'origin/main', RAMO])
  if (anc.status !== 0) parar('publicar o site', 'A main do GitHub tem commits que o ramo da sessão não tem — juntar a main no ramo (e testar de novo) antes de publicar.')
  const r = rodar('publicando o site (o ramo da sessão vai para a main do GitHub)', 'git',
    ['-C', R, '-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential', 'push', 'origin', `${RAMO}:main`], { env })
  if (!r.ok) parar('publicar o site')
  console.log('\n✅ SITE: enviado para a main — a Vercel publica em 1 a 2 minutos.')
} else {
  console.log('uso: node "SESSAO-51 - subida (programa, 2026-11-17).mjs" conferir | banco | site')
  process.exit(2)
}
