// ============================================================================
// PLATAFORMA DE PRODUÇÃO DOMOBY · Edge Function `geocodificar` — SESSAO-15
//
// Endereço → ponto no mapa (D-39/Q-65), pelo Nominatim e pelo Photon (os dois
// sobre o mapa aberto, gratuitos e sem chave) — com ritmo (1 consulta por
// segundo) e um User-Agent que identifica quem chama. O navegador não consegue
// garantir nem um nem outro; por isso a consulta vive AQUI e o resultado vai
// para o cache `plt_geocache` (escrito com a chave de serviço — o navegador só
// lê). ↪️ 03/10/2026 (D-112): o Nominatim responde HTTP 403 a este servidor;
// quando ele recusa, a consulta vai ao Photon. A coluna `fonte` diz quem achou.
//
// ↪️ SESSAO-45 (04/11/2026, pedido do dono — "endereço não encontrado no mapa"
// e a rota indo ao Google Maps com o endereço errado): a escolha do ponto saiu
// para `busca.ts` (testada) — vários candidatos, pontuados por nome da rua,
// BAIRRO, CEP e cidade; ambíguo = "não achei" (a logística marca no mapa).
// O ponto marcado À MÃO (`fonte = 'manual'`, gravado pela porta
// plt_fn_geo_marcar) NUNCA é substituído. O que a busca antiga gravou antes de
// `VERSAO_BUSCA` é refeito uma vez (achado ou não) — os pontos de rua de mesmo
// nome noutro bairro saem assim, sem ninguém editar nada à mão.
//
//   POST { itens: [{ chave, endereco }, …] }   (até 5 por chamada)
//   → { resultados: [{ chave, latitude, longitude, resolvido, tentar_depois? }, …] }
//
// A CHAVE vem do banco (md5 do endereço normalizado) — ou, no endereço
// digitado à mão (parada avulsa, busca da janela do mapa), 'avulsa:' + hash.
// Quem chama precisa ser pessoa ativa da plataforma (JWT do Supabase).
// Sem ponto: resolvido=false com a data (não insiste por 7 dias). Serviço que
// RECUSA ou falha não é "sem ponto": nada gravado, `tentar_depois` (D-112).
// ============================================================================
import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  caixaDoEstado,
  candidatosNominatim,
  candidatosPhoton,
  consultasTexto,
  escolher,
  nomeDoEstado,
  partirEndereco,
  semRepetidos,
} from './busca.ts'
import type { Candidato, EnderecoPartido } from './busca.ts'

const URL_SUPABASE = Deno.env.get('SUPABASE_URL')!
const CHAVE_SERVICO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
// Identificação pedida pela política de uso do Nominatim. O contato (e-mail
// ou site) é opcional e vive como segredo de ambiente — nunca no código.
const CONTATO = Deno.env.get('PLT_GEOCODIFICACAO_CONTATO') ?? ''
const USER_AGENT = `PlataformaProducaoDomoby/1.0${CONTATO ? ` (${CONTATO})` : ''}`

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const PHOTON = 'https://photon.komoot.io/api/'
const INTERVALO_MS = 1100
const MAXIMO_POR_CHAMADA = 5
const RETENTAR_FALHA_APOS_DIAS = 7
/**
 * SESSAO-45: o que a busca ANTIGA gravou antes deste instante é refeito uma vez
 * (a regra nova acha mais e não aceita rua de mesmo nome noutro bairro). O MESMO
 * instante mora na tela (src/rotas/api.ts → VERSAO_BUSCA) — os dois andam juntos.
 */
const VERSAO_BUSCA = Date.parse('2026-11-05T00:00:00Z')
/** O Nominatim recusou: não insiste por 1 hora (cada recusa custava 1,1 s por endereço). */
const PAUSA_NOMINATIM_MS = 60 * 60 * 1000
let nominatimRecusouEm = 0

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const servidor = createClient(URL_SUPABASE, CHAVE_SERVICO, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function resposta(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

const erro = (status: number, mensagem: string) => resposta(status, { erro: mensagem })

// Só pessoa ativa da plataforma consulta — mesma régua da `autenticacao`.
async function pessoaAtiva(req: Request): Promise<boolean> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return false
  const { data, error } = await servidor.auth.getUser(token)
  if (error || !data.user) return false
  const { data: linha } = await servidor
    .from('plt_usuarios')
    .select('id')
    .eq('auth_user_id', data.user.id)
    .eq('ativo', true)
    .maybeSingle()
  return linha !== null
}

interface Item {
  chave: string
  endereco: string
}

interface Resultado {
  chave: string
  latitude: number | null
  longitude: number | null
  resolvido: boolean
  /** O serviço recusou/falhou: nada gravado, tentar de novo depois. */
  tentar_depois?: boolean
}

interface LinhaCache {
  chave: string
  latitude: number | null
  longitude: number | null
  resolvido: boolean
  fonte: string
  consultado_em: string
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Uma consulta HTTP com tempo limite; erro de rede/HTTP vira `null` + o motivo. */
async function buscarJson(url: URL, cabecalhos: Record<string, string>): Promise<{ corpo: unknown } | { erro: string }> {
  let r: Response
  try {
    r = await fetch(url, { headers: cabecalhos, signal: AbortSignal.timeout(10_000) })
  } catch (e) {
    return { erro: e instanceof Error ? e.name : 'falha de rede' }
  }
  if (!r.ok) return { erro: `HTTP ${r.status}` }
  try {
    return { corpo: await r.json() }
  } catch {
    return { erro: 'resposta ilegível' }
  }
}

/** Os candidatos do Nominatim — a busca ESTRUTURADA (rua, cidade, estado). */
async function pelosNominatim(e: EnderecoPartido): Promise<{ lista: Candidato[] } | { erro: string }> {
  const url = new URL(NOMINATIM)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '8')
  url.searchParams.set('countrycodes', 'br')
  url.searchParams.set('addressdetails', '1')
  if (e.livre || !e.rua) {
    url.searchParams.set('q', e.texto)
  } else {
    url.searchParams.set('street', [e.numero, e.rua].filter(Boolean).join(' '))
    if (e.cidade) url.searchParams.set('city', e.cidade)
    const estado = nomeDoEstado(e.uf)
    if (estado) url.searchParams.set('state', estado)
    url.searchParams.set('country', 'Brasil')
  }
  const r = await buscarJson(url, { 'User-Agent': USER_AGENT, 'Accept-Language': 'pt-BR' })
  if ('erro' in r) return { erro: `Nominatim ${r.erro}` }
  return { lista: candidatosNominatim(r.corpo) }
}

/** Os candidatos do Photon para uma consulta de texto (casa e rua; no RN, só dentro do RN). */
async function peloPhoton(consulta: string, uf: string | null, livre: boolean): Promise<{ lista: Candidato[] } | { erro: string }> {
  const url = new URL(PHOTON)
  url.searchParams.set('q', consulta)
  url.searchParams.set('limit', livre ? '5' : '10')
  url.searchParams.set('lat', '-5.8')
  url.searchParams.set('lon', '-35.2')
  // o endereço digitado vem do galpão — a busca fica no RN; o do cadastro, no estado dele
  const caixa = caixaDoEstado(livre ? 'RN' : uf)
  if (caixa) url.searchParams.set('bbox', caixa)
  if (!livre) {
    url.searchParams.append('layer', 'house')
    url.searchParams.append('layer', 'street')
  }
  const r = await buscarJson(url, { 'User-Agent': USER_AGENT })
  if ('erro' in r) return { erro: `Photon ${r.erro}` }
  return { lista: candidatosPhoton(r.corpo) }
}

type Consulta =
  | { tipo: 'ok'; lat: number; lon: number; fonte: 'nominatim' | 'photon' }
  | { tipo: 'vazio'; motivo: string }
  | { tipo: 'erro'; motivo: string }

/**
 * Junta os candidatos dos dois buscadores e escolhe (busca.ts). Erro dos DOIS
 * (nada respondeu) = "tentar depois"; resposta vazia = "não achei".
 */
async function geocodificar(endereco: string, recusas: string[]): Promise<Consulta> {
  const e = partirEndereco(endereco)
  const candidatos: Candidato[] = []
  let respondeu = false
  let primeira = true
  const pausa = async () => {
    if (!primeira) await dormir(INTERVALO_MS)
    primeira = false
  }

  if (Date.now() - nominatimRecusouEm > PAUSA_NOMINATIM_MS) {
    await pausa()
    const r = await pelosNominatim(e)
    if ('erro' in r) {
      nominatimRecusouEm = Date.now()
      recusas.push(r.erro)
    } else {
      respondeu = true
      candidatos.push(...r.lista)
    }
  }

  // O Photon sempre (o Nominatim acha a rua; o Photon traz o bairro de cada trecho).
  const consultas = consultasTexto(e)
  for (const [i, q] of consultas.entries()) {
    await pausa()
    const r = await peloPhoton(q, e.uf, e.livre)
    if ('erro' in r) {
      recusas.push(r.erro)
      break // buscador recusando: não insiste nas outras formas
    }
    respondeu = true
    candidatos.push(...r.lista)
    // a 1ª consulta já trouxe o bairro ou o CEP certos: não precisa das outras
    const parcial = escolher(e, semRepetidos(candidatos))
    if (i === 0 && parcial.motivo === 'ok' && !e.livre && e.bairro === null) break
  }

  if (!respondeu) return { tipo: 'erro', motivo: recusas.join(', ') || 'sem resposta' }
  const escolha = escolher(e, semRepetidos(candidatos))
  if (!escolha.ponto) return { tipo: 'vazio', motivo: escolha.motivo }
  const fonte = candidatos.find((c) => c.lat === escolha.ponto!.lat && c.lon === escolha.ponto!.lon)?.fonte ?? 'photon'
  return { tipo: 'ok', lat: escolha.ponto.lat, lon: escolha.ponto.lon, fonte }
}

/** O que o cache já sabe vale — menos o que a busca antiga gravou (refeito uma vez). */
function cacheVale(g: LinhaCache, chave: string): boolean {
  if (g.fonte === 'manual') return true
  const quando = new Date(g.consultado_em).getTime()
  // o endereço DIGITADO (avulsa) foi conferido por alguém no pino — não refaz
  const antigo = quando < VERSAO_BUSCA && !chave.startsWith('avulsa:')
  if (antigo) return false
  if (g.resolvido) return true
  return Date.now() - quando < RETENTAR_FALHA_APOS_DIAS * 24 * 60 * 60 * 1000
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return erro(405, 'Use POST.')
  if (!(await pessoaAtiva(req))) return erro(401, 'Só pessoa ativa da plataforma consulta endereços.')

  let corpo: { itens?: Item[] }
  try {
    corpo = await req.json()
  } catch {
    return erro(400, 'Corpo inválido — envie { itens: [{ chave, endereco }] }.')
  }
  const itens = (corpo.itens ?? [])
    .filter((i) => i && typeof i.chave === 'string' && typeof i.endereco === 'string' && i.endereco.trim())
    .slice(0, MAXIMO_POR_CHAMADA)
  if (itens.length === 0) return resposta(200, { resultados: [] })

  const { data: cacheados } = await servidor
    .from('plt_geocache')
    .select('chave, latitude, longitude, resolvido, fonte, consultado_em')
    .in(
      'chave',
      itens.map((i) => i.chave),
    )
  const cache = new Map<string, LinhaCache>()
  for (const linha of (cacheados ?? []) as LinhaCache[]) cache.set(linha.chave, linha)

  const resultados: Resultado[] = []
  const recusas: string[] = []
  const motivos: string[] = []
  let consultou = false
  for (const item of itens) {
    const guardado = cache.get(item.chave)
    if (guardado && cacheVale(guardado, item.chave)) {
      resultados.push({
        chave: item.chave,
        latitude: guardado.latitude,
        longitude: guardado.longitude,
        resolvido: guardado.resolvido,
      })
      continue
    }

    if (consultou) await dormir(INTERVALO_MS)
    consultou = true
    let consulta: Consulta
    try {
      consulta = await geocodificar(item.endereco, recusas)
    } catch (e) {
      consulta = { tipo: 'erro', motivo: e instanceof Error ? e.message : 'falha' }
      recusas.push(consulta.motivo)
    }
    if (consulta.tipo === 'erro') {
      // Os dois buscadores recusaram/falharam: nada gravado — a tela tenta depois.
      resultados.push({ chave: item.chave, latitude: null, longitude: null, resolvido: false, tentar_depois: true })
      continue
    }
    if (consulta.tipo === 'vazio') motivos.push(consulta.motivo)
    const ponto = consulta.tipo === 'ok' ? { lat: consulta.lat, lon: consulta.lon } : null

    // O ponto marcado à mão por alguém no meio do caminho nunca é sobrescrito.
    const { data: agora } = await servidor
      .from('plt_geocache')
      .select('fonte, latitude, longitude')
      .eq('chave', item.chave)
      .maybeSingle()
    const manual = agora as { fonte: string; latitude: number | null; longitude: number | null } | null
    if (manual?.fonte === 'manual') {
      resultados.push({
        chave: item.chave,
        latitude: manual.latitude,
        longitude: manual.longitude,
        resolvido: true,
      })
      continue
    }

    const linha = {
      chave: item.chave,
      endereco: item.endereco,
      latitude: ponto?.lat ?? null,
      longitude: ponto?.lon ?? null,
      resolvido: ponto !== null,
      fonte: consulta.tipo === 'ok' ? consulta.fonte : 'photon',
      consultado_em: new Date().toISOString(),
    }
    await servidor.from('plt_geocache').upsert(linha, { onConflict: 'chave' })
    resultados.push({
      chave: item.chave,
      latitude: linha.latitude,
      longitude: linha.longitude,
      resolvido: linha.resolvido,
    })
  }

  if (recusas.length > 0 || motivos.length > 0) {
    // A prova da causa fica no registro da função (o endereço não — dado pessoal).
    console.warn(
      `geocodificar: ${itens.length} endereço(s)` +
        (recusas.length ? ` — recusa/falha de buscador: ${[...new Set(recusas)].join(', ')}` : '') +
        (motivos.length ? ` — sem ponto: ${motivos.join(', ')}` : ''),
    )
  }
  return resposta(200, { resultados })
})
