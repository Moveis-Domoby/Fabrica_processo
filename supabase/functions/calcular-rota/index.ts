// ============================================================================
// PLATAFORMA DE PRODUÇÃO DOMOBY · Edge Function `calcular-rota` — SESSAO-28
//
// A rota da Programação pelas RUAS (D-108): fábrica → paradas na ordem →
// fábrica, pelo serviço gratuito de rotas sobre o mapa aberto (OSRM), perfil de
// carro — que já respeita contramão e sentido das vias. Mesmo molde da
// `geocodificar`: o navegador não chama serviço de terceiro direto; aqui a
// chamada sai IDENTIFICADA (User-Agent), uma por vez, e o resultado vai para o
// cache do mapa (`plt_geocache`, coluna `rota` — sem tabela nova, D-47),
// escrito com a chave de serviço. O navegador lê o cache antes de chamar esta
// função; ela confere o cache de novo (outra aba pode ter calculado).
//
//   POST { pontos: [[latitude, longitude], …] }   (a ordem é a da rota; 2 a 42)
//   → { chave, resolvido, rota | null, do_cache }
//
// A CHAVE é calculada AQUI a partir dos pontos ('rota:carro:' + lon,lat com 5
// casas, separados por ';') — o mesmo formato de `chaveRota` em
// src/rotas/rotaRuas.ts (mudou um, muda o outro). Nunca se confia numa chave
// vinda de fora: quem grava o cache é só esta função.
//
// Serviço fora do ar / lento / recusando: 503 e NADA no cache — a tela mostra a
// linha reta com aviso e tenta de novo depois. "Não existe caminho" (ponto fora
// de rua) é resposta de verdade: fica gravada como resolvido=false e não se
// insiste por 7 dias.
//
// Quem chama precisa ser pessoa ativa da plataforma (JWT do Supabase); a
// função não é um proxy aberto. O servidor é configuração (segredo
// PLT_ROTAS_SERVIDOR) — trocar por um servidor próprio não muda o código.
// ============================================================================
import { createClient } from 'npm:@supabase/supabase-js@2'

const URL_SUPABASE = Deno.env.get('SUPABASE_URL')!
const CHAVE_SERVICO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
// O servidor público da FOSSGIS (perfil carro). Regras dele: no máximo 1
// pedido por segundo, User-Agent que identifique quem chama, uso leve.
const SERVIDOR = (Deno.env.get('PLT_ROTAS_SERVIDOR') ?? 'https://routing.openstreetmap.de/routed-car').replace(/\/+$/, '')
// O contato (e-mail ou site) é opcional e vive como segredo — nunca no código.
const CONTATO = Deno.env.get('PLT_GEOCODIFICACAO_CONTATO') ?? ''
const USER_AGENT = `PlataformaProducaoDomoby/1.0${CONTATO ? ` (${CONTATO})` : ''}`

const MINIMO_PONTOS = 2
const MAXIMO_PONTOS = 42 // a fábrica, até 40 paradas, a fábrica
const TEMPO_LIMITE_MS = 12_000
const RETENTAR_SEM_CAMINHO_DIAS = 7

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

// Só pessoa ativa da plataforma calcula — mesma régua da `geocodificar`.
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

type Ponto = [number, number] // [latitude, longitude]

interface Rota {
  distancia_m: number
  duracao_s: number
  trechos: { distancia_m: number; duracao_s: number }[]
  geometria: string
  servidor: string
}

function pontoValido(p: unknown): p is Ponto {
  return (
    Array.isArray(p) &&
    p.length === 2 &&
    typeof p[0] === 'number' &&
    typeof p[1] === 'number' &&
    Number.isFinite(p[0]) &&
    Number.isFinite(p[1]) &&
    Math.abs(p[0]) <= 90 &&
    Math.abs(p[1]) <= 180
  )
}

/** "lon,lat;lon,lat;…" com 5 casas — o pedaço da chave e o do endereço do serviço. */
function coordenadas(pontos: Ponto[]): string {
  return pontos.map(([lat, lon]) => `${lon.toFixed(5)},${lat.toFixed(5)}`).join(';')
}

type Consulta =
  | { tipo: 'ok'; rota: Rota }
  | { tipo: 'sem_caminho' }
  | { tipo: 'fora'; motivo: string }

async function consultarServico(pontos: Ponto[]): Promise<Consulta> {
  const url = `${SERVIDOR}/route/v1/driving/${coordenadas(pontos)}?overview=full&geometries=polyline&steps=false&alternatives=false`
  let r: Response
  try {
    r = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    })
  } catch (e) {
    return { tipo: 'fora', motivo: e instanceof Error ? e.name : 'falha de rede' }
  }
  let corpo: {
    code?: string
    routes?: { distance: number; duration: number; geometry: string; legs: { distance: number; duration: number }[] }[]
  } | null = null
  try {
    corpo = await r.json()
  } catch {
    corpo = null
  }
  // "Não há caminho" é resposta de verdade do serviço (ponto fora de rua).
  if (corpo?.code === 'NoRoute' || corpo?.code === 'NoSegment') return { tipo: 'sem_caminho' }
  const rota = corpo?.routes?.[0]
  if (!r.ok || corpo?.code !== 'Ok' || !rota || typeof rota.geometry !== 'string') {
    return { tipo: 'fora', motivo: `HTTP ${r.status}${corpo?.code ? ` · ${corpo.code}` : ''}` }
  }
  return {
    tipo: 'ok',
    rota: {
      distancia_m: Math.round(rota.distance),
      duracao_s: Math.round(rota.duration),
      trechos: rota.legs.map((l) => ({ distancia_m: Math.round(l.distance), duracao_s: Math.round(l.duration) })),
      geometria: rota.geometry,
      servidor: new URL(SERVIDOR).host,
    },
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return erro(405, 'Use POST.')
  if (!(await pessoaAtiva(req))) return erro(401, 'Só pessoa ativa da plataforma calcula rotas.')

  let corpo: { pontos?: unknown }
  try {
    corpo = await req.json()
  } catch {
    return erro(400, 'Corpo inválido — envie { pontos: [[latitude, longitude], …] }.')
  }
  const pontos = corpo.pontos
  if (!Array.isArray(pontos) || !pontos.every(pontoValido)) {
    return erro(400, 'Envie os pontos como [[latitude, longitude], …].')
  }
  if (pontos.length < MINIMO_PONTOS || pontos.length > MAXIMO_PONTOS) {
    return erro(400, `A rota precisa de ${MINIMO_PONTOS} a ${MAXIMO_PONTOS} pontos.`)
  }

  const chave = `rota:carro:${coordenadas(pontos)}`

  // O cache primeiro (outra aba pode ter acabado de calcular a mesma rota).
  const { data: guardado } = await servidor
    .from('plt_geocache')
    .select('resolvido, rota, consultado_em')
    .eq('chave', chave)
    .maybeSingle()
  if (guardado?.resolvido && guardado.rota) {
    return resposta(200, { chave, resolvido: true, rota: guardado.rota, do_cache: true })
  }
  if (
    guardado &&
    !guardado.resolvido &&
    Date.now() - new Date(guardado.consultado_em).getTime() < RETENTAR_SEM_CAMINHO_DIAS * 24 * 60 * 60 * 1000
  ) {
    return resposta(200, { chave, resolvido: false, rota: null, do_cache: true })
  }

  const consulta = await consultarServico(pontos)
  if (consulta.tipo === 'fora') {
    console.warn(`calcular-rota: serviço de rotas indisponível (${consulta.motivo})`)
    return erro(503, 'O serviço de rotas não respondeu agora — mostrando em linha reta.')
  }

  const paradas = pontos.length - 2
  const linha = {
    chave,
    endereco: `rota de ${paradas} parada${paradas === 1 ? '' : 's'} (fábrica → … → fábrica)`,
    latitude: null,
    longitude: null,
    resolvido: consulta.tipo === 'ok',
    fonte: 'osrm',
    rota: consulta.tipo === 'ok' ? consulta.rota : null,
    consultado_em: new Date().toISOString(),
  }
  const { error: erroGravar } = await servidor.from('plt_geocache').upsert(linha, { onConflict: 'chave' })
  if (erroGravar) console.warn(`calcular-rota: não gravou o cache (${erroGravar.message})`)

  return resposta(200, { chave, resolvido: linha.resolvido, rota: linha.rota, do_cache: false })
})
