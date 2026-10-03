// ============================================================================
// PLATAFORMA DE PRODUÇÃO DOMOBY · Edge Function `geocodificar` — SESSAO-15
//
// Endereço → ponto no mapa (D-39/Q-65), pelo Nominatim (OpenStreetMap), que é
// gratuito e sem chave — mas exige respeito: NO MÁXIMO 1 requisição por
// segundo e um User-Agent que identifique quem chama. O navegador não consegue
// nem definir User-Agent nem garantir o ritmo com várias abas abertas; por
// isso a consulta vive AQUI, serializada, e o resultado vai para o cache
// `plt_geocache` (escrito com a chave de serviço — o navegador só lê).
// ↪️ 03/10/2026 (D-112): o Nominatim passou a responder HTTP 403 a este
// servidor; quando ele recusa, a consulta vai ao Photon (outro buscador
// gratuito, sem chave, sobre o mesmo mapa aberto). A coluna `fonte` do cache
// diz quem respondeu.
//
//   POST { itens: [{ chave, endereco }, …] }   (até 5 por chamada — 3 tentativas
//        por endereço, no ritmo de 1 por segundo, cabem no tempo da função)
//   → { resultados: [{ chave, latitude, longitude, resolvido, tentar_depois? }, …] }
//
// A CHAVE vem do banco (plt_fn_programacao: md5 do endereço normalizado) —
// a normalização mora num lugar só. Quem chama precisa ser pessoa ativa da
// plataforma (JWT do Supabase); a função não é um proxy aberto.
//
// Sem ponto (endereço que o Nominatim não acha): fica gravado resolvido=false
// com a data — o front mostra o aviso e não insiste por 7 dias. Serviço que
// RECUSA ou falha não é "sem ponto": nada gravado, `tentar_depois` (D-112).
// ============================================================================
import { createClient } from 'npm:@supabase/supabase-js@2'

const URL_SUPABASE = Deno.env.get('SUPABASE_URL')!
const CHAVE_SERVICO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
// Identificação pedida pela política de uso do Nominatim. O contato (e-mail
// ou site) é opcional e vive como segredo de ambiente — nunca no código.
const CONTATO = Deno.env.get('PLT_GEOCODIFICACAO_CONTATO') ?? ''
const USER_AGENT = `PlataformaProducaoDomoby/1.0${CONTATO ? ` (${CONTATO})` : ''}`

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const INTERVALO_MS = 1100
const MAXIMO_POR_CHAMADA = 5
const RETENTAR_FALHA_APOS_DIAS = 7

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
  consultado_em: string
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ↪️ 03/10/2026 (ajuste da SESSAO-28, OK do dono — D-112): resposta de ERRO do
// Nominatim (recusa, limite, fora do ar) NÃO é "o endereço não existe". Antes,
// `!r.ok` virava "sem ponto" gravado por 7 dias — na carga de teste de 03/10 os
// 18 endereços saíram "não encontrados" e a MESMA consulta, feita de fora,
// achou 15. Agora: erro = "tentar depois" (nada gravado) e o código fica no
// registro da função.
type Consulta =
  | { tipo: 'ok'; lat: number; lon: number }
  | { tipo: 'vazio' }
  | { tipo: 'erro'; motivo: string }

// Resultado que é a cidade/bairro inteiro não serve — ponto no centro geraria
// sugestão de rota errada (Q-65). Só rua/número/lugar.
const TIPOS_GENERICOS = new Set(['city', 'town', 'village', 'municipality', 'state', 'country', 'county', 'suburb', 'neighbourhood', 'quarter', 'city_district', 'postcode'])

const semAcento = (t: string) =>
  [...t.normalize('NFD')].filter((c) => c.charCodeAt(0) < 0x300 || c.charCodeAt(0) > 0x36f).join('').toLowerCase().trim()

async function consultarNominatim(consulta: string, cidade: string | null): Promise<Consulta> {
  const url = new URL(NOMINATIM)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '1')
  url.searchParams.set('countrycodes', 'br')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('q', consulta)
  let r: Response
  try {
    r = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'pt-BR' },
      signal: AbortSignal.timeout(10_000),
    })
  } catch (e) {
    return { tipo: 'erro', motivo: e instanceof Error ? e.name : 'falha de rede' }
  }
  if (!r.ok) return { tipo: 'erro', motivo: `HTTP ${r.status}` }
  let lista: { lat: string; lon: string; addresstype?: string; address?: Record<string, string> }[]
  try {
    lista = await r.json()
  } catch {
    return { tipo: 'erro', motivo: 'resposta ilegível' }
  }
  if (!Array.isArray(lista) || lista.length === 0) return { tipo: 'vazio' }
  const achado = lista[0]
  if (achado.addresstype && TIPOS_GENERICOS.has(achado.addresstype)) return { tipo: 'vazio' }
  // Rua com o mesmo nome noutra cidade não serve.
  const lugar = achado.address?.city ?? achado.address?.town ?? achado.address?.municipality ?? achado.address?.village
  if (cidade && lugar && !semAcento(lugar).includes(semAcento(cidade)) && !semAcento(cidade).includes(semAcento(lugar))) {
    return { tipo: 'vazio' }
  }
  const lat = Number(achado.lat)
  const lon = Number(achado.lon)
  return Number.isFinite(lat) && Number.isFinite(lon) ? { tipo: 'ok', lat, lon } : { tipo: 'vazio' }
}

// O segundo buscador (D-112, OK do dono em 03/10): o Photon, gratuito e sem
// chave, sobre o MESMO mapa aberto. Entra quando o Nominatim recusa — em 03/10
// o Nominatim respondia HTTP 403 a todo pedido que sai deste servidor. Só
// casa/rua (nunca cidade/bairro), com a cidade conferida; viés para Natal.
const PHOTON = 'https://photon.komoot.io/api/'

async function consultarPhoton(consulta: string, cidade: string | null): Promise<Consulta> {
  const url = new URL(PHOTON)
  url.searchParams.set('q', consulta)
  url.searchParams.set('limit', '1')
  url.searchParams.set('lat', '-5.8')
  url.searchParams.set('lon', '-35.2')
  url.searchParams.append('layer', 'house')
  url.searchParams.append('layer', 'street')
  let r: Response
  try {
    r = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(10_000) })
  } catch (e) {
    return { tipo: 'erro', motivo: `Photon ${e instanceof Error ? e.name : 'falha de rede'}` }
  }
  if (!r.ok) return { tipo: 'erro', motivo: `Photon HTTP ${r.status}` }
  let corpo: { features?: { geometry?: { coordinates?: number[] }; properties?: Record<string, string> }[] }
  try {
    corpo = await r.json()
  } catch {
    return { tipo: 'erro', motivo: 'Photon resposta ilegível' }
  }
  const achado = corpo.features?.[0]
  if (!achado) return { tipo: 'vazio' }
  const props = achado.properties ?? {}
  if (props.countrycode && props.countrycode !== 'BR') return { tipo: 'vazio' }
  const lugar = props.city ?? props.county ?? props.district
  if (cidade && lugar && !semAcento(lugar).includes(semAcento(cidade)) && !semAcento(cidade).includes(semAcento(lugar))) {
    return { tipo: 'vazio' }
  }
  const [lon, lat] = achado.geometry?.coordinates ?? []
  return Number.isFinite(lat) && Number.isFinite(lon) ? { tipo: 'ok', lat, lon } : { tipo: 'vazio' }
}

type Buscador = 'nominatim' | 'photon'

// Três tentativas, do mais preciso ao mais enxuto (o buscador se perde com
// componente demais): completo → sem o CEP → [rua número, cidade, uf]. Nunca
// cai para "só a cidade". Se alguma tentativa deu ERRO e nenhuma achou, a
// resposta é "tentar depois" — não "não existe".
async function tentarCom(buscador: Buscador, endereco: string): Promise<Consulta> {
  // [rua número, bairro, cidade, uf, cep, Brasil]
  const partes = endereco.split(',').map((p) => p.trim())
  const cidade = partes.length >= 5 ? partes[2] : null
  const tentativas = [endereco]
  if (partes.length >= 5) {
    tentativas.push([...partes.slice(0, 4), 'Brasil'].join(', '))
    tentativas.push([partes[0], partes[2], partes[3], 'Brasil'].join(', '))
  }
  let erro: string | null = null
  for (const [i, consulta] of tentativas.entries()) {
    if (i > 0) await dormir(INTERVALO_MS)
    const r = buscador === 'nominatim' ? await consultarNominatim(consulta, cidade) : await consultarPhoton(consulta, cidade)
    if (r.tipo === 'ok') return r
    if (r.tipo === 'erro') {
      erro = r.motivo
      break // buscador recusando: não insiste nas outras formas
    }
  }
  return erro ? { tipo: 'erro', motivo: erro } : { tipo: 'vazio' }
}

// O Nominatim primeiro; se ele RECUSAR, o Photon — e, numa mesma chamada, depois
// da 1ª recusa o Nominatim não é mais incomodado (`estado.nominatimRecusou`).
async function geocodificar(
  endereco: string,
  estado: { nominatimRecusou: boolean },
  recusas: string[],
): Promise<Consulta & { fonte?: Buscador }> {
  if (!estado.nominatimRecusou) {
    const r = await tentarCom('nominatim', endereco)
    if (r.tipo !== 'erro') return { ...r, fonte: 'nominatim' }
    estado.nominatimRecusou = true
    recusas.push(`Nominatim: ${r.motivo}`)
    await dormir(INTERVALO_MS)
  }
  const r = await tentarCom('photon', endereco)
  if (r.tipo === 'erro') recusas.push(r.motivo)
  return { ...r, fonte: 'photon' }
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

  // O que o cache já sabe (resolvido, ou falha recente) não vai ao Nominatim.
  const { data: cacheados } = await servidor
    .from('plt_geocache')
    .select('chave, latitude, longitude, resolvido, consultado_em')
    .in(
      'chave',
      itens.map((i) => i.chave),
    )
  const cache = new Map<string, LinhaCache>()
  for (const linha of (cacheados ?? []) as LinhaCache[]) cache.set(linha.chave, linha)

  const resultados: Resultado[] = []
  const recusas: string[] = []
  const estado = { nominatimRecusou: false }
  let consultou = false
  for (const item of itens) {
    const guardado = cache.get(item.chave)
    const falhaRecente =
      guardado &&
      !guardado.resolvido &&
      Date.now() - new Date(guardado.consultado_em).getTime() <
        RETENTAR_FALHA_APOS_DIAS * 24 * 60 * 60 * 1000
    if (guardado && (guardado.resolvido || falhaRecente)) {
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
    let consulta: Consulta & { fonte?: Buscador }
    try {
      consulta = await geocodificar(item.endereco, estado, recusas)
    } catch (e) {
      consulta = { tipo: 'erro', motivo: e instanceof Error ? e.message : 'falha' }
      recusas.push(consulta.motivo)
    }
    if (consulta.tipo === 'erro') {
      // Os dois buscadores recusaram/falharam: nada gravado — a tela tenta depois.
      resultados.push({ chave: item.chave, latitude: null, longitude: null, resolvido: false, tentar_depois: true })
      continue
    }
    const ponto = consulta.tipo === 'ok' ? { lat: consulta.lat, lon: consulta.lon } : null

    const linha = {
      chave: item.chave,
      endereco: item.endereco,
      latitude: ponto?.lat ?? null,
      longitude: ponto?.lon ?? null,
      resolvido: ponto !== null,
      // quem respondeu (nominatim/photon) — fica no cache para conferência
      fonte: consulta.fonte ?? 'nominatim',
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

  if (recusas.length > 0) {
    // A prova da causa fica no registro da função (o endereço não — dado pessoal).
    console.warn(`geocodificar: recusa/falha de buscador (${itens.length} endereço(s) na chamada) — ${[...new Set(recusas)].join(', ')}`)
  }
  return resposta(200, { resultados })
})
