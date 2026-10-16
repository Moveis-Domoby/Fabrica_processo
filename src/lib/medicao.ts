import { supabase } from '@/lib/supabase'

/**
 * A PLATAFORMA MEDE A PRÓPRIA VELOCIDADE (SESSAO-32 · D-137 item 2 — "pode ser
 * a própria plataforma mesmo", sem a ferramenta paga da Vercel).
 *
 * Em cada abertura, o navegador mede o que a pessoa sente — quanto a tela
 * demora a aparecer (LCP), quanto o toque demora a responder (INP), quanto a
 * tela pula (CLS) — e manda UMA linha por abertura (plt_fn_medir_tela), quando
 * a pessoa sai da aba ou fecha. Sem relógio (Lei §4): o tablet que nunca sai
 * da tela manda também na troca de tela, se a última medida tem mais de 5 min.
 * Tetos da Lei: LCP ≤ 2,5 s · INP ≤ 200 ms · CLS ≤ 0,1 (p75 dos tablets).
 */

interface EntradaDeslocamento extends PerformanceEntry {
  value: number
  hadRecentInput: boolean
}
interface EntradaEvento extends PerformanceEntry {
  interactionId?: number
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const REENVIO_NA_NAVEGACAO_MS = 5 * 60_000

const medida = {
  lcp: undefined as number | undefined,
  fcp: undefined as number | undefined,
  ttfb: undefined as number | undefined,
  cls: undefined as number | undefined,
  inp: undefined as number | undefined,
  interacoes: 0,
}
let carga = ''
let rotaInicial = '/'
let modoTablet = false
let token: string | null = null
let enviadaEm = 0
let ultimaEnviada = ''

function novaCarga(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  // navegador antigo do tablet: um uuid v4 do mesmo jeito
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

function aparelho(): 'tablet' | 'celular' | 'computador' {
  const toque = window.matchMedia?.('(pointer: coarse)').matches ?? false
  if (!toque) return 'computador'
  return Math.min(window.screen.width, window.screen.height) >= 600 ? 'tablet' : 'celular'
}

function observar(
  tipo: string,
  aoChegar: (entradas: PerformanceEntry[]) => void,
  extra: Record<string, unknown> = {},
) {
  try {
    new PerformanceObserver((lista) => aoChegar(lista.getEntries())).observe({
      type: tipo,
      buffered: true,
      ...extra,
    } as PerformanceObserverInit)
  } catch {
    // navegador sem esta medida: fica vazia
  }
}

const ms = (v: number | undefined) => (v === undefined ? null : Math.round(v))

function enviar() {
  if (!url || !chave || !token || (medida.lcp === undefined && medida.fcp === undefined)) return
  const corpo = JSON.stringify({
    p_carga: carga,
    p_rota: rotaInicial,
    p_aparelho: aparelho(),
    p_modo_tablet: modoTablet,
    p_lcp_ms: ms(medida.lcp),
    p_inp_ms: ms(medida.inp),
    p_cls: medida.cls === undefined ? null : Math.round(medida.cls * 10_000) / 10_000,
    p_fcp_ms: ms(medida.fcp),
    p_ttfb_ms: ms(medida.ttfb),
    p_interacoes: medida.interacoes,
    p_versao: __VERSAO_APP__,
    p_conexao:
      (navigator as Navigator & { connection?: { effectiveType?: string } }).connection
        ?.effectiveType ?? null,
  })
  if (corpo === ultimaEnviada) return // nada mudou desde a última
  ultimaEnviada = corpo
  enviadaEm = Date.now()
  // keepalive: a requisição sobrevive à aba fechando
  void fetch(`${url}/rest/v1/rpc/plt_fn_medir_tela`, {
    method: 'POST',
    keepalive: true,
    headers: {
      apikey: chave,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: corpo,
  }).catch(() => {
    // medir nunca atrapalha a plataforma
  })
}

/** Liga a medição desta abertura (uma vez, no início do app). */
export function iniciarMedicao() {
  if (import.meta.env.DEV || typeof PerformanceObserver === 'undefined') return
  carga = novaCarga()
  // a 1ª medida sai quando a pessoa deixa a aba — nunca junto da abertura
  enviadaEm = Date.now()
  rotaInicial = window.location.pathname
  modoTablet = rotaInicial.startsWith('/tablet')
  supabase.auth.onAuthStateChange((_evento, sessao) => {
    token = sessao?.access_token ?? null
  })

  const navegacao = performance.getEntriesByType('navigation')[0] as
    PerformanceNavigationTiming | undefined
  if (navegacao) medida.ttfb = navegacao.responseStart

  // a maior pintura antes do 1º toque (o navegador para de mandar depois dele)
  observar('largest-contentful-paint', (es) => {
    if (es.length) medida.lcp = es[es.length - 1].startTime
  })
  observar('paint', (es) => {
    for (const e of es) if (e.name === 'first-contentful-paint') medida.fcp = e.startTime
  })
  // o quanto a tela pula: a pior "janela" (deslocamentos a menos de 1 s um do
  // outro, no máximo 5 s), sem contar o que veio logo depois de um toque
  let janela = 0
  let inicio = 0
  let ultimo = 0
  observar('layout-shift', (es) => {
    for (const e of es as EntradaDeslocamento[]) {
      if (e.hadRecentInput) continue
      if (janela && e.startTime - ultimo < 1000 && e.startTime - inicio < 5000) janela += e.value
      else {
        janela = e.value
        inicio = e.startTime
      }
      ultimo = e.startTime
      medida.cls = Math.max(medida.cls ?? 0, janela)
    }
  })
  // o toque mais lento (com muitos toques, ignora 1 a cada 50 — como a Google)
  const porInteracao = new Map<number, number>()
  observar(
    'event',
    (es) => {
      for (const e of es as EntradaEvento[]) {
        if (!e.interactionId) continue
        porInteracao.set(
          e.interactionId,
          Math.max(porInteracao.get(e.interactionId) ?? 0, e.duration),
        )
      }
      const duracoes = [...porInteracao.values()].sort((a, b) => b - a)
      medida.interacoes = duracoes.length
      if (duracoes.length)
        medida.inp = duracoes[Math.min(duracoes.length - 1, Math.floor(duracoes.length / 50))]
    },
    { durationThreshold: 40 },
  )

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') enviar()
  })
  window.addEventListener('pagehide', enviar)
}

/** Troca de tela: entra no modo tablet? E manda o que tem se faz tempo (sem relógio). */
export function medirNaNavegacao(rota: string) {
  if (rota.startsWith('/tablet')) modoTablet = true
  if (carga && Date.now() - enviadaEm > REENVIO_NA_NAVEGACAO_MS) enviar()
}
