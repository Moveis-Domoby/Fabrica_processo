// ============================================================================
// PLATAFORMA DE PRODUÇÃO DOMOBY · Edge Function `geocodificar` — SESSAO-15
//
// Endereço → ponto no mapa (D-39/Q-65), pelo Nominatim (OpenStreetMap), que é
// gratuito e sem chave — mas exige respeito: NO MÁXIMO 1 requisição por
// segundo e um User-Agent que identifique quem chama. O navegador não consegue
// nem definir User-Agent nem garantir o ritmo com várias abas abertas; por
// isso a consulta vive AQUI, serializada, e o resultado vai para o cache
// `plt_geocache` (escrito com a chave de serviço — o navegador só lê).
//
//   POST { itens: [{ chave, endereco }, …] }   (até 10 por chamada)
//   → { resultados: [{ chave, latitude, longitude, resolvido }, …] }
//
// A CHAVE vem do banco (plt_fn_programacao: md5 do endereço normalizado) —
// a normalização mora num lugar só. Quem chama precisa ser pessoa ativa da
// plataforma (JWT do Supabase); a função não é um proxy aberto.
//
// Sem ponto (endereço que o Nominatim não acha): fica gravado resolvido=false
// com a data — o front mostra o aviso e não insiste por 7 dias.
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
const MAXIMO_POR_CHAMADA = 10
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
}

interface LinhaCache {
  chave: string
  latitude: number | null
  longitude: number | null
  resolvido: boolean
  consultado_em: string
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function consultarNominatim(consulta: string): Promise<{ lat: number; lon: number } | null> {
  const url = new URL(NOMINATIM)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '1')
  url.searchParams.set('countrycodes', 'br')
  url.searchParams.set('q', consulta)
  const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'pt-BR' } })
  if (!r.ok) return null
  const lista = (await r.json()) as { lat: string; lon: string }[]
  if (!Array.isArray(lista) || lista.length === 0) return null
  const lat = Number(lista[0].lat)
  const lon = Number(lista[0].lon)
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null
}

// Tentativa completa; se não achar, sem bairro e CEP (o Nominatim se perde
// com componente demais). Nunca cai para "só a cidade": ponto no centro da
// cidade geraria sugestão de rota errada — melhor "sem ponto" (Q-65).
async function geocodificar(endereco: string): Promise<{ lat: number; lon: number } | null> {
  const completo = await consultarNominatim(endereco)
  if (completo) return completo
  const partes = endereco.split(',').map((p) => p.trim())
  if (partes.length >= 5) {
    await dormir(INTERVALO_MS)
    // [rua número, bairro, cidade, uf, cep, Brasil] → [rua número, cidade, uf, Brasil]
    const enxuto = [partes[0], partes[2], partes[3], 'Brasil'].join(', ')
    return consultarNominatim(enxuto)
  }
  return null
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
    let ponto: { lat: number; lon: number } | null = null
    try {
      ponto = await geocodificar(item.endereco)
    } catch {
      ponto = null
    }

    const linha = {
      chave: item.chave,
      endereco: item.endereco,
      latitude: ponto?.lat ?? null,
      longitude: ponto?.lon ?? null,
      resolvido: ponto !== null,
      fonte: 'nominatim',
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

  return resposta(200, { resultados })
})
