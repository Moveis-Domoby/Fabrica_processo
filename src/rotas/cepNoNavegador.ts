// ============================================================================
// O ponto do CEP pelo NAVEGADOR de quem usa a plataforma (ajuste de 24/11 —
// pedido do dono: "resolva" o serviço de CEP que recusava o servidor).
//
// Na validação dos endereços (24/11), o serviço de CEP gratuito respondia
// "limite de uso" (HTTP 429) a TODAS as chamadas da função de busca: o servidor
// é compartilhado e o limite é por endereço de rede. Efeito: a rua que a
// Geoapify não achava sozinha caía no centro da cidade e a conferência "o pino
// está longe do CEP" nunca perguntava. Do computador de quem usa, o mesmo
// serviço responde normal — e ele aceita chamada direta do navegador (CORS
// aberto).
//
// A forma: o navegador consulta o CEP (com tempo limite, uma vez por CEP na
// sessão) e manda a resposta junto ao endereço para a função; a função confere
// que é o mesmo CEP e usa. Sem resposta do navegador, a função tenta pelo
// servidor como antes. Nada aqui bloqueia: qualquer falha = null.
// ============================================================================

export const SERVICO_CEP_NAVEGADOR = 'https://cep.awesomeapi.com.br/json/'
/** O CEP não pode segurar a busca: passou disto, segue sem ele. */
export const TEMPO_LIMITE_CEP_MS = 4_000

/** Só os 8 dígitos de um CEP de RUA (o geral da cidade, …000, não diz onde fica a casa); senão null. */
export function cepDeRua(cep: string | null | undefined): string | null {
  const d = (cep ?? '').replace(/\D/g, '')
  return d.length === 8 && !d.endsWith('000') ? d : null
}

/**
 * O CEP escrito no meio de um endereço ("…, Natal, RN, 59014-430" ou
 * "…, 59.014-430, Brasil" — o formato do cadastro do Tiny); null sem CEP de rua.
 */
export function cepNoTexto(texto: string | null | undefined): string | null {
  const m = (texto ?? '').match(/(?:^|\D)(\d{2})\.?(\d{3})[-.\s]?(\d{3})(?!\d)/)
  return m ? cepDeRua(`${m[1]}${m[2]}${m[3]}`) : null
}

type Buscar = (url: string, init: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<Response>

/** Um sinal que desiste depois de `ms` (o navegador antigo do tablet não tem `AbortSignal.timeout`). */
function sinalComPrazo(ms: number): AbortSignal | undefined {
  if (typeof AbortController === 'undefined') return undefined
  const c = new AbortController()
  setTimeout(() => c.abort(), ms)
  return c.signal
}

const respostas = new Map<string, Promise<unknown | null>>()

/**
 * A resposta crua do serviço de CEP para um CEP de rua — uma vez por CEP na
 * sessão (a falha não fica guardada: a próxima tentativa pergunta de novo).
 */
export function respostaDoCep(cep: string | null | undefined, buscar?: Buscar): Promise<unknown | null> {
  const d = cepDeRua(cep)
  if (!d) return Promise.resolve(null)
  const guardada = respostas.get(d)
  if (guardada) return guardada
  const chamar: Buscar = buscar ?? ((url, init) => fetch(url, init))
  const p = (async () => {
    try {
      const r = await chamar(SERVICO_CEP_NAVEGADOR + d, {
        signal: sinalComPrazo(TEMPO_LIMITE_CEP_MS),
        headers: { Accept: 'application/json' },
      })
      if (!r.ok) return null
      const corpo: unknown = await r.json()
      return pontoDaResposta(d, corpo) ? corpo : null
    } catch {
      return null
    }
  })()
  respostas.set(d, p)
  void p.then((v) => {
    if (v === null) respostas.delete(d)
  })
  return p
}

/** O ponto que a resposta do serviço de CEP traz — só se for do MESMO CEP e cair no Brasil. */
export function pontoDaResposta(cep: string, corpo: unknown): { latitude: number; longitude: number } | null {
  if (!corpo || typeof corpo !== 'object') return null
  const j = corpo as Record<string, unknown>
  const d = cepDeRua(cep)
  if (!d || String(j.cep ?? '').replace(/\D/g, '') !== d) return null
  const latitude = Number(j.lat)
  const longitude = Number(j.lng)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude === 0 || longitude === 0) return null
  if (latitude > 6 || latitude < -34 || longitude > -28 || longitude < -74) return null
  return { latitude, longitude }
}

/** Só para os testes: esquece as respostas guardadas. */
export function esquecerRespostasDoCep(): void {
  respostas.clear()
}
