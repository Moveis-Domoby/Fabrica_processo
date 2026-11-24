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
// ↪️ Ajuste do dono (05/11 — "não pode acontecer o caso de endereço não
// encontrado") + correção da manhã ("não tem essa de bairro e centro da
// cidade, NO MÁXIMO a rua é aceitável, mas com aviso na tela"): a rua que não
// se acha usa o ponto do CEP (serviço de CEP gratuito, sem chave) e o centro
// do bairro (Photon) só como ÂNCORA para achar a rua de mesmo nome perto deles;
// o ponto do CEP da própria rua do pedido vale como ponto de rua (fonte 'cep').
// Sem rua: o centro da CIDADE (fonte 'aprox_cidade') e o cartão avisa para
// ajustar o pino. O "não achei" de antes é refeito uma vez (VERSAO_DEGRAUS);
// o que a 1ª versão gravou pelo bairro/CEP ('aprox_bairro'/'aprox_cep') também.
//
//   POST { itens: [{ chave, endereco }, …] }   (até 5 por chamada)
//   → { resultados: [{ chave, latitude, longitude, resolvido, tentar_depois? }, …] }
//
// A CHAVE vem do banco (md5 do endereço normalizado) — ou, no endereço
// digitado à mão (parada avulsa, busca da janela do mapa), 'avulsa:' + hash.
// Quem chama precisa ser pessoa ativa da plataforma (JWT do Supabase).
// Sem ponto: resolvido=false com a data (não insiste por 7 dias). Serviço que
// RECUSA ou falha não é "sem ponto": nada gravado, `tentar_depois` (D-112).
//
// ↪️ SESSAO-56 (23/11/2026 — "o mapa não está marcando os endereços"): o Photon
// passou a recusar este servidor em 19/11 (o Nominatim já recusava desde 03/10)
// e nenhum endereço novo ganhava ponto. O buscador principal agora é a
// GEOAPIFY, com chave própria da Domoby (escolha do dono; o segredo
// PLT_GEOAPIFY_CHAVE — nunca no código); o Photon fica de reserva e o
// Nominatim saiu. A ordem e os degraus moram em `fluxo.ts` (testado); aqui só
// a rede, o cache e o ESTADO da busca: quando nenhum buscador responde, a
// resposta leva `tentar_depois` nos itens e `busca.fora_desde` (a tela avisa
// e mostra a faixa "a busca de endereço está fora desde…") — a hora da queda
// fica numa linha reservada do próprio cache (sem tabela nova), gravada só
// nas viradas.
//
//   → { resultados: [...], busca: { fora_desde: <ISO> | null } }
// ============================================================================
import { createClient } from 'npm:@supabase/supabase-js@2'
import { procurarEndereco, proximoEstado } from './fluxo.ts'
import type { Ambiente, Consulta, EstadoDaBusca } from './fluxo.ts'

const URL_SUPABASE = Deno.env.get('SUPABASE_URL')!
const CHAVE_SERVICO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
// Identificação de quem chama (boa prática dos serviços abertos — o Photon e o
// serviço de CEP). O contato (e-mail ou site) é opcional e vive como segredo
// de ambiente — nunca no código.
const CONTATO = Deno.env.get('PLT_GEOCODIFICACAO_CONTATO') ?? ''
const USER_AGENT = `PlataformaProducaoDomoby/1.0${CONTATO ? ` (${CONTATO})` : ''}`
/** SESSAO-56: a chave da Geoapify — segredo das Edge Functions, posto pelo dono. */
const CHAVE_GEOAPIFY = (Deno.env.get('PLT_GEOAPIFY_CHAVE') ?? '').trim() || null

/** A Geoapify aceita até 5 consultas por segundo: uma pausa curta entre duas (a de 1,1 s era do Nominatim). */
const INTERVALO_MS = 250
/** Tempo limite de cada consulta a um buscador. */
const TEMPO_LIMITE_MS = 6_000
const MAXIMO_POR_CHAMADA = 5
const RETENTAR_FALHA_APOS_DIAS = 7
/**
 * SESSAO-45: o que a busca ANTIGA gravou antes deste instante é refeito uma vez
 * (a regra nova acha mais e não aceita rua de mesmo nome noutro bairro). O MESMO
 * instante mora na tela (src/rotas/api.ts → VERSAO_BUSCA) — os dois andam juntos.
 */
const VERSAO_BUSCA = Date.parse('2026-11-05T00:00:00Z')
/**
 * Ajuste do dono (05/11): o "não achei" gravado antes deste instante é refeito
 * uma vez — agora com os degraus (CEP, bairro, cidade). O MESMO instante mora na
 * tela (src/rotas/api.ts → VERSAO_DEGRAUS).
 */
const VERSAO_DEGRAUS = Date.parse('2026-11-05T03:00:00Z')
/**
 * SESSAO-56 (frente 3): a linha reservada do cache que guarda desde quando a
 * busca está sem responder (em `rota`, o campo de dados livres da tabela) —
 * nenhuma chave de endereço ou de rota tem este formato.
 */
const CHAVE_ESTADO = 'estado:busca-de-endereco'

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
  /** Só a linha do estado da busca usa (as de rota não passam por aqui). */
  rota?: unknown
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Uma consulta HTTP com tempo limite; erro de rede/HTTP vira o motivo — SEM a
 * URL (a da Geoapify leva a chave) e sem o endereço (dado pessoal).
 */
async function buscarJson(url: URL, cabecalhos: Record<string, string>): Promise<{ corpo: unknown } | { erro: string }> {
  let r: Response
  try {
    r = await fetch(url, { headers: cabecalhos, signal: AbortSignal.timeout(TEMPO_LIMITE_MS) })
  } catch (e) {
    return { erro: e instanceof Error ? e.name : 'falha de rede' }
  }
  if (!r.ok) {
    await r.body?.cancel().catch(() => undefined)
    return { erro: `HTTP ${r.status}` }
  }
  try {
    return { corpo: await r.json() }
  } catch {
    return { erro: 'resposta ilegível' }
  }
}

/** O que o cache já sabe vale — menos o que a busca antiga gravou (refeito uma vez). */
function cacheVale(g: LinhaCache, chave: string): boolean {
  if (g.fonte === 'manual') return true
  const quando = new Date(g.consultado_em).getTime()
  // o endereço DIGITADO (avulsa) foi conferido por alguém no pino — não refaz
  const antigo = quando < VERSAO_BUSCA && !chave.startsWith('avulsa:')
  if (antigo) return false
  const semana = RETENTAR_FALHA_APOS_DIAS * 24 * 60 * 60 * 1000
  // o centro do bairro / o ponto solto do CEP não valem mais (correção do dono, 05/11): refaz
  if (g.fonte === 'aprox_bairro' || g.fonte === 'aprox_cep') return false
  // o ponto aproximado (a cidade) é procurado de novo depois de 7 dias — o serviço de
  // CEP pode ter recusado (limite de uso) e o mapa aberto melhora
  if (g.fonte.startsWith('aprox_')) return Date.now() - quando < semana
  if (g.resolvido) return true
  // o "não achei" de antes dos degraus é refeito uma vez (agora sempre há um ponto)
  if (quando < VERSAO_DEGRAUS && !chave.startsWith('avulsa:')) return false
  return Date.now() - quando < semana
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
    // a chave reservada do estado da busca nunca é um endereço
    .filter((i) => i && typeof i.chave === 'string' && typeof i.endereco === 'string' && i.endereco.trim() && i.chave !== CHAVE_ESTADO)
    .slice(0, MAXIMO_POR_CHAMADA)
  if (itens.length === 0) return resposta(200, { resultados: [] })

  const { data: cacheados } = await servidor
    .from('plt_geocache')
    .select('chave, latitude, longitude, resolvido, fonte, consultado_em, rota')
    .in('chave', [...itens.map((i) => i.chave), CHAVE_ESTADO])
  const cache = new Map<string, LinhaCache>()
  for (const linha of (cacheados ?? []) as LinhaCache[]) cache.set(linha.chave, linha)
  // o estado da busca vem na MESMA leitura do cache (nenhuma consulta a mais)
  const estadoAntes = (cache.get(CHAVE_ESTADO)?.rota ?? null) as EstadoDaBusca | null
  cache.delete(CHAVE_ESTADO)

  const resultados: Resultado[] = []
  const motivos: string[] = []
  const aproximados: string[] = []
  const ambiente: Ambiente = {
    buscar: buscarJson,
    esperar: () => dormir(INTERVALO_MS),
    chaveGeoapify: CHAVE_GEOAPIFY,
    userAgent: USER_AGENT,
    recusas: [],
    geoapifyRecusou: false,
  }
  const recusas = ambiente.recusas
  let consultou = false
  // nenhum buscador respondeu a um endereço: os seguintes nem tentam (a tela avisa e oferece tentar de novo)
  let semResposta = false
  let respondeu = false
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

    if (semResposta) {
      resultados.push({ chave: item.chave, latitude: null, longitude: null, resolvido: false, tentar_depois: true })
      continue
    }
    if (consultou) await dormir(INTERVALO_MS)
    consultou = true
    let consulta: Consulta
    try {
      consulta = await procurarEndereco(item.endereco, ambiente)
    } catch (e) {
      // o nome do erro, nunca a mensagem (ela pode trazer a URL com a chave)
      consulta = { tipo: 'erro', motivo: e instanceof Error ? e.name : 'falha' }
      recusas.push(consulta.motivo)
    }
    if (consulta.tipo === 'erro') {
      // Nenhum buscador respondeu: nada gravado — a tela avisa e oferece tentar de novo.
      semResposta = true
      resultados.push({ chave: item.chave, latitude: null, longitude: null, resolvido: false, tentar_depois: true })
      continue
    }
    respondeu = true
    if (consulta.tipo === 'vazio') motivos.push(consulta.motivo)
    if (consulta.tipo === 'ok' && consulta.fonte.startsWith('aprox_')) aproximados.push(consulta.fonte.slice(6))
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
      // o "não achei" leva o nome do buscador principal (a coluna diz quem procurou)
      fonte: consulta.tipo === 'ok' ? consulta.fonte : CHAVE_GEOAPIFY ? 'geoapify' : 'photon',
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

  if (recusas.length > 0 || motivos.length > 0 || aproximados.length > 0) {
    // A prova da causa fica no registro da função (o endereço não — dado pessoal).
    console.warn(
      `geocodificar: ${itens.length} endereço(s)` +
        (recusas.length ? ` — recusa/falha de buscador: ${[...new Set(recusas)].join(', ')}` : '') +
        (aproximados.length ? ` — ponto aproximado pelo degrau: ${aproximados.join(', ')}` : '') +
        (motivos.length ? ` — sem ponto: ${motivos.join(', ')}` : ''),
    )
  }

  // O estado da busca: gravado só nas VIRADAS (caiu / voltou) — enquanto tudo
  // vai bem (ou segue fora), nenhuma escrita a mais.
  const agora = new Date().toISOString()
  const { estado, mudou } = proximoEstado(estadoAntes, { falhou: semResposta, respondeu }, agora)
  if (mudou) {
    await servidor.from('plt_geocache').upsert(
      {
        chave: CHAVE_ESTADO,
        endereco: '(estado da busca de endereço — não é um endereço)',
        latitude: null,
        longitude: null,
        resolvido: false,
        fonte: 'estado',
        consultado_em: agora,
        rota: estado,
      },
      { onConflict: 'chave' },
    )
  }
  return resposta(200, { resultados, busca: estado })
})
