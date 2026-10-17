/**
 * SESSAO-33 — liga no n8n a fila do Tiny para as duas contas e a API nova, e
 * (com --alerta) o fluxo de alerta de erro das automações (pendência P1).
 *
 * Roda NO COMPUTADOR DO DONO (é lá que mora a chave da API do n8n, no arquivo
 * `.env.n8n` na raiz do repositório — regra 4: a chave nunca é impressa).
 *
 *   node supabase/manutencao/2026-10-17_n8n_fila_tiny_completo.mjs
 *       → SÓ MOSTRA o que muda no fluxo "subir banco de dados --- tiny -> supabase"
 *   node supabase/manutencao/2026-10-17_n8n_fila_tiny_completo.mjs --aplicar
 *       → guarda uma cópia do fluxo VIVO em .n8n-backups/, troca SÓ a 1ª parte
 *         (a fila), mantém a 2ª parte (o "Entregue" vai ao Tiny — D-123) e o
 *         webhook da fila como estão no ar, salva, PUBLICA e confere que o que
 *         roda é o novo (versionId = activeVersionId — A-53)
 *   … --simular <fluxo.json> [--saida <arquivo>]
 *       → monta a troca a partir de um arquivo (sem rede, sem chave) e mostra
 *   … --aplicar --alerta
 *       → também cria (se não existe) o fluxo "Domoby · alerta de erro das
 *         automações", publica, e o põe como "fluxo de erro" da fila, do fluxo
 *         da fábrica e do fluxo de vendas (só a configuração — nenhum nó deles
 *         muda; os nós "Normalizar evento" e "Tiny · pedido.obter" ficam iguais)
 *
 * O que entra na 1ª parte (arquivo `_docs/Fabrica n8n/domoby-fila-tiny-completo.json`):
 * o lote vem do banco já com a chamada montada (fn_tiny_fila_lote); a conta da
 * linha escolhe o token da v2 (TINY_TOKEN · TINY_FABRICA_TOKEN); a API nova vai
 * pela ponte tiny-v3 (o token nem passa pelo n8n); a resposta crua volta ao
 * banco (fn_tiny_fila_resposta); 1 chamada a cada 2 s; e o webhook dos avisos
 * de nota autorizada / pedido enviado (o caminho que o Tiny já chama para
 * "pedidos enviados" — hoje sem ninguém escutando, P5).
 *
 * Antes de rodar: o banco precisa ter as migrations 89–92 (senão o lote novo
 * não existe) e a variável TINY_FABRICA_TOKEN no n8n (já existe — o fluxo da
 * fábrica usa). A ponte tiny-v3 só é chamada por linhas da API nova.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const ARQ_FLUXO = path.join(RAIZ, '_docs/Fabrica n8n/domoby-fila-tiny-completo.json')
const ARQ_ALERTA = path.join(RAIZ, '_docs/Fabrica n8n/domoby-alerta-erro-automacoes.json')
const PASTA_COPIAS = path.join(RAIZ, '.n8n-backups')

const ID_FILA = 'Rzm3N1bKnhsgGfav' // "subir banco de dados --- tiny -> supabase"
const ID_FABRICA = 'gJNYde20T921AY6l' // "Domoby · Tiny FÁBRICA → produtos e estoque (fluxo único)"
const WEBHOOK_FILA = 'Webhook · processar a fila do Tiny'
const CAMINHO_FILA = 'a9564e90-bdf4-4e46-b425-ea668cb7a22e'
// os nós da 1ª parte que existem hoje no ar (os 8 de sempre); tudo o mais fica
const PARTE1_DE_HOJE = [
  'Webhook · processar a fila do Tiny',
  'Config',
  'Fila · reservar lote',
  'Normalizar lote',
  'Montar requisicao Tiny',
  'Tiny · API v2',
  'Interpretar resposta',
  'Supabase · gravar',
]
// o que a API pública aceita em "settings" (o resto do objeto vivo fica de fora)
const CONFIG_ACEITA = [
  'executionOrder',
  'saveDataSuccessExecution',
  'saveDataErrorExecution',
  'saveManualExecutions',
  'saveExecutionProgress',
  'executionTimeout',
  'errorWorkflow',
  'timezone',
  'callerPolicy',
  'callerIds',
]

const aplicar = process.argv.includes('--aplicar')
const comAlerta = process.argv.includes('--alerta')
// --simular <fluxo-vivo.json> [--saida <arquivo>]: monta a troca a partir de um
// arquivo, sem rede e sem chave (é assim que a troca foi provada na nuvem)
const iSimular = process.argv.indexOf('--simular')
const simular = iSimular >= 0 ? process.argv[iSimular + 1] : null
const iSaida = process.argv.indexOf('--saida')
const saidaSimulacao = iSaida >= 0 ? process.argv[iSaida + 1] : null

function lerAmbiente(texto) {
  const valores = {}
  const linhas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
  for (const linha of linhas) {
    const i = linha.indexOf('=')
    if (i > 0)
      valores[linha.slice(0, i).trim()] = linha
        .slice(i + 1)
        .trim()
        .replace(/^["']|["']$/g, '')
  }
  // aceita o arquivo com uma linha só (a chave pura)
  if (Object.keys(valores).length === 0 && linhas.length === 1) valores.N8N_API_KEY = linhas[0]
  return valores
}

let CHAVE = ''
let BASE = ''
if (!simular) {
  const ambiente = lerAmbiente(await readFile(path.join(RAIZ, '.env.n8n'), 'utf8'))
  CHAVE = ambiente.N8N_API_KEY || ambiente.N8N_KEY || ambiente.X_N8N_API_KEY || ''
  BASE = (ambiente.N8N_URL || 'https://n8n.srv1877515.hstgr.cloud').replace(/\/+$/, '')
  if (!CHAVE) {
    console.error('Não achei a chave da API do n8n no .env.n8n (N8N_API_KEY=...).')
    process.exit(1)
  }
}

async function n8n(metodo, caminho, corpo) {
  const r = await fetch(`${BASE}/api/v1${caminho}`, {
    method: metodo,
    headers: {
      'X-N8N-API-KEY': CHAVE,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  })
  const texto = await r.text()
  if (!r.ok) throw new Error(`n8n ${metodo} ${caminho} → ${r.status}: ${texto.slice(0, 300)}`)
  return texto ? JSON.parse(texto) : null
}

const soConfig = (settings) =>
  Object.fromEntries(Object.entries(settings ?? {}).filter(([k]) => CONFIG_ACEITA.includes(k)))

async function publicar(id) {
  await n8n('POST', `/workflows/${id}/activate`)
  const depois = await n8n('GET', `/workflows/${id}`)
  const noAr =
    depois.versionId && depois.activeVersionId
      ? depois.versionId === depois.activeVersionId
      : depois.active === true
  return { depois, noAr }
}

async function guardarCopia(fluxo, rotulo) {
  await mkdir(PASTA_COPIAS, { recursive: true })
  const quando = new Date().toISOString().replace(/[:.]/g, '-')
  const arquivo = path.join(PASTA_COPIAS, `${rotulo}-${quando}.json`)
  await writeFile(arquivo, JSON.stringify(fluxo, null, 2))
  return arquivo
}

// ---------------------------------------------------------------------------
// 1 · a fila do Tiny
// ---------------------------------------------------------------------------
const novo = JSON.parse(await readFile(ARQ_FLUXO, 'utf8'))
const nomesNovos = new Set(novo.meta.parte1)
const nosNovos = novo.nodes.filter((n) => nomesNovos.has(n.name))
const vivo = simular
  ? JSON.parse(await readFile(simular, 'utf8'))
  : await n8n('GET', `/workflows/${ID_FILA}`)

const webhookVivo = vivo.nodes.find((n) => n.name === WEBHOOK_FILA)
if (!webhookVivo || webhookVivo.parameters?.path !== CAMINHO_FILA) {
  console.error(
    `O fluxo no ar não tem o "${WEBHOOK_FILA}" com o caminho de sempre — pare e confira à mão (A-44).`,
  )
  process.exit(1)
}
const ficam = vivo.nodes.filter((n) => !PARTE1_DE_HOJE.includes(n.name) && !nomesNovos.has(n.name))
const colisao = ficam.filter((n) => nomesNovos.has(n.name)).map((n) => n.name)
if (colisao.length) {
  console.error('Nome repetido entre a 2ª parte viva e a 1ª nova:', colisao)
  process.exit(1)
}
// o webhook da fila fica o MESMO objeto vivo (o endereço não muda)
const parte1 = nosNovos.map((n) => (n.name === WEBHOOK_FILA ? webhookVivo : n))
const nos = [...parte1, ...ficam]
const nomesFinais = new Set(nos.map((n) => n.name))
const ligacoes = {}
for (const [origem, saidas] of Object.entries(vivo.connections ?? {})) {
  if (PARTE1_DE_HOJE.includes(origem) || nomesNovos.has(origem)) continue
  ligacoes[origem] = saidas
}
for (const [origem, saidas] of Object.entries(novo.connections)) {
  if (nomesNovos.has(origem)) ligacoes[origem] = saidas
}
for (const saidas of Object.values(ligacoes)) {
  for (const lista of saidas.main ?? []) {
    for (const c of lista ?? []) {
      if (!nomesFinais.has(c.node)) {
        console.error(`Ligação para um nó que não existe: ${c.node}`)
        process.exit(1)
      }
    }
  }
}

console.log(`Fluxo: ${vivo.name} (${ID_FILA}) — no ar: ${vivo.active ? 'sim' : 'não'}`)
console.log(`  sai da 1ª parte: ${PARTE1_DE_HOJE.filter((n) => n !== WEBHOOK_FILA).join(' · ')}`)
console.log(
  `  entra na 1ª parte: ${nosNovos
    .filter((n) => n.name !== WEBHOOK_FILA)
    .map((n) => n.name)
    .join(' · ')}`,
)
console.log(`  fica como está (2ª parte e o resto): ${ficam.map((n) => n.name).join(' · ') || '—'}`)
console.log(`  o "${WEBHOOK_FILA}" fica o mesmo (caminho ${CAMINHO_FILA})`)

if (simular) {
  if (saidaSimulacao)
    await writeFile(saidaSimulacao, JSON.stringify({ nodes: nos, connections: ligacoes }, null, 2))
  console.log('\nSimulação: nada foi mudado no n8n.')
  process.exit(0)
}
if (!aplicar) {
  console.log('\nNada foi mudado. Para aplicar: … --aplicar   (e --alerta para o alerta de erro)')
  process.exit(0)
}

const copia = await guardarCopia(vivo, 'fila-tiny-antes')
console.log(`\nCópia do fluxo vivo: ${path.relative(RAIZ, copia)}`)
await n8n('PUT', `/workflows/${ID_FILA}`, {
  name: vivo.name,
  nodes: nos,
  connections: ligacoes,
  settings: soConfig(vivo.settings),
})
const fila = await publicar(ID_FILA)
const temPonte = (fila.depois.activeVersion?.nodes ?? fila.depois.nodes ?? []).some(
  (n) => n.name === 'Tiny · API nova (ponte)',
)
console.log(
  `Fila do Tiny salva e publicada: ${fila.noAr && temPonte ? 'NO AR ✔' : 'ATENÇÃO — confira no editor e clique em Publicar'}`,
)

// ---------------------------------------------------------------------------
// 2 · o alerta de erro (P1)
// ---------------------------------------------------------------------------
if (comAlerta) {
  const modelo = JSON.parse(await readFile(ARQ_ALERTA, 'utf8'))
  const lista = await n8n('GET', `/workflows?limit=250`)
  const todos = lista.data ?? lista
  let alerta = todos.find((w) => w.name === modelo.name)
  if (!alerta) {
    alerta = await n8n('POST', '/workflows', {
      name: modelo.name,
      nodes: modelo.nodes,
      connections: modelo.connections,
      settings: modelo.settings,
    })
    console.log(`Fluxo de alerta criado (${alerta.id}).`)
  }
  const pub = await publicar(alerta.id)
  console.log(`Fluxo de alerta: ${pub.noAr ? 'NO AR ✔' : 'ATENÇÃO — publique no editor'}`)

  const vendas = todos.find((w) => /^Principal\b/i.test(w.name ?? ''))
  const alvos = [ID_FILA, ID_FABRICA, vendas?.id].filter(Boolean)
  for (const id of alvos) {
    const w = await n8n('GET', `/workflows/${id}`)
    if (w.settings?.errorWorkflow === alerta.id) {
      console.log(`  ${w.name}: já avisa no erro`)
      continue
    }
    await guardarCopia(w, `antes-alerta-${id}`)
    await n8n('PUT', `/workflows/${id}`, {
      name: w.name,
      nodes: w.nodes,
      connections: w.connections,
      settings: { ...soConfig(w.settings), errorWorkflow: alerta.id },
    })
    const r = await publicar(id)
    console.log(`  ${w.name}: avisa no erro ${r.noAr ? '✔' : '(confira a publicação no editor)'}`)
  }
  if (!vendas)
    console.log(
      '  (não achei o fluxo de vendas "Principal…" pelo nome — ligue o fluxo de erro nele à mão)',
    )
}
