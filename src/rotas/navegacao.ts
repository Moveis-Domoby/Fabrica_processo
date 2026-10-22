/**
 * LEVAR A ROTA PARA O GOOGLE MAPS E O WAZE (SESSAO-39 · D-174) — lógica pura,
 * sem rede, testada no Vitest. Nenhuma chave, nenhum custo: os links oficiais
 * de cada aplicativo ("Maps URLs" do Google e "deep links" do Waze).
 *
 * - Google Maps: `maps/dir/?api=1` com origem, destino e as paradas em
 *   `waypoints`, NA ORDEM da plataforma (o Google mantém a ordem). O limite
 *   dele é de 9 paradas intermediárias por link (3 no navegador do celular,
 *   sem o aplicativo) — rota maior sai em PARTES, cada uma começando onde a
 *   anterior terminou. O caminho pelas ruas quem traça é o Google (com o
 *   trânsito dele); as paradas e a ordem são as nossas.
 * - Waze: só UM destino por link (a documentação diz que várias paradas dá
 *   erro) — por isso o Waze é por parada ("ir para esta entrega").
 * - A parada com ponto no mapa vai pela coordenada (a mesma que a plataforma
 *   usou); a sem ponto vai pelo endereço escrito (o aplicativo procura).
 */
import { FABRICA } from './rotaRuas'

export interface ParadaNavegavel {
  latitude: number | null
  longitude: number | null
  /** O endereço escrito, para a parada sem ponto no mapa. */
  endereco: string | null
}

/** A parada a partir do pedido (o ponto do mapa e o endereço do cadastro do cliente). */
export function paradaNavegavel(e: {
  latitude: number | null
  longitude: number | null
  endereco: string | null
  numero_endereco: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
}): ParadaNavegavel {
  const endereco = [
    [e.endereco, e.numero_endereco].filter(Boolean).join(' '),
    e.bairro,
    e.cidade,
    e.uf,
  ]
    .filter(Boolean)
    .join(', ')
  return { latitude: e.latitude, longitude: e.longitude, endereco: endereco || null }
}

/** Paradas intermediárias por link do Google Maps (o limite oficial fora do navegador do celular). */
export const PARADAS_POR_LINK = 9

const BASE_GOOGLE = 'https://www.google.com/maps/dir/?api=1'

/** A coordenada com 6 casas (~10 cm) e sem zeros sobrando: "-5.82,-35.22". */
function coordenada(latitude: number, longitude: number): string {
  const curta = (n: number) => String(Number(n.toFixed(6)))
  return `${curta(latitude)},${curta(longitude)}`
}

/** O "lugar" da parada para o link: a coordenada ou, sem ela, o endereço. */
export function lugarDaParada(p: ParadaNavegavel): string | null {
  if (p.latitude !== null && p.longitude !== null) return coordenada(p.latitude, p.longitude)
  const texto = (p.endereco ?? '').trim()
  return texto.length > 0 ? texto : null
}

const LUGAR_FABRICA = coordenada(FABRICA.latitude, FABRICA.longitude)

export interface ParteDaRota {
  url: string
  /** A posição (1, 2…) da primeira e da última parada desta parte, na lista recebida. */
  primeira: number
  ultima: number
  /** Esta parte termina na fábrica (a volta). */
  comVolta: boolean
}

/**
 * Os links do Google Maps para a rota, na ordem dada.
 * - `origem`: 'fabrica' (a rota como a plataforma montou — sai da fábrica) ou
 *   'aqui' (de onde o aparelho está — o entregador no meio do caminho).
 * - `volta`: termina na fábrica (padrão: sim — D-108).
 * Parada sem lugar (sem ponto e sem endereço) fica de fora do link.
 */
export function linksGoogleMaps(
  paradas: ParadaNavegavel[],
  opcoes: { origem?: 'fabrica' | 'aqui'; volta?: boolean; posicoes?: number[] } = {},
): ParteDaRota[] {
  const origem = opcoes.origem ?? 'fabrica'
  const volta = opcoes.volta ?? true
  const lugares = paradas
    .map((p, i) => ({ lugar: lugarDaParada(p), posicao: opcoes.posicoes?.[i] ?? i + 1 }))
    .filter((x): x is { lugar: string; posicao: number } => x.lugar !== null)
  if (lugares.length === 0) return []

  // A sequência inteira: [origem?] → paradas → [fábrica]. Origem nula = "daqui".
  type Ponto = { lugar: string | null; posicao: number | null }
  const seq: Ponto[] = [
    { lugar: origem === 'fabrica' ? LUGAR_FABRICA : null, posicao: null },
    ...lugares.map((l) => ({ lugar: l.lugar, posicao: l.posicao })),
    ...(volta ? [{ lugar: LUGAR_FABRICA, posicao: null }] : []),
  ]
  // Cada link leva no máximo origem + 9 paradas + destino (11 pontos, 10 saltos).
  // As partes saem equilibradas (10 paradas e a volta = 6 + 5, nunca uma parte
  // só com a volta).
  const saltos = seq.length - 1
  const quantas = Math.ceil(saltos / (PARADAS_POR_LINK + 1))
  const passo = Math.ceil(saltos / quantas)
  const partes: ParteDaRota[] = []
  for (let i = 0; i < seq.length - 1; i += passo) {
    const fim = Math.min(i + passo, seq.length - 1)
    const trecho = seq.slice(i, fim + 1)
    const [inicio, ...resto] = trecho
    const destino = resto[resto.length - 1]
    const meio = resto.slice(0, -1)
    const params = new URLSearchParams()
    if (inicio.lugar !== null) params.set('origin', inicio.lugar)
    params.set('destination', destino.lugar!)
    if (meio.length > 0) params.set('waypoints', meio.map((p) => p.lugar).join('|'))
    params.set('travelmode', 'driving')
    params.set('dir_action', 'navigate')
    const numeros = trecho.flatMap((p, k) => (k > 0 && p.posicao !== null ? [p.posicao] : []))
    partes.push({
      url: `${BASE_GOOGLE}&${params.toString()}`,
      primeira: numeros[0] ?? 0,
      ultima: numeros[numeros.length - 1] ?? 0,
      comVolta: volta && fim === seq.length - 1,
    })
  }
  return partes
}

/** O Google Maps já navegando até UMA parada (de onde o aparelho está). */
export function linkGoogleMapsParada(p: ParadaNavegavel): string | null {
  const lugar = lugarDaParada(p)
  if (!lugar) return null
  const params = new URLSearchParams({
    destination: lugar,
    travelmode: 'driving',
    dir_action: 'navigate',
  })
  return `${BASE_GOOGLE}&${params.toString()}`
}

/** O Waze já navegando até UMA parada (o Waze só aceita um destino por link). */
export function linkWaze(p: ParadaNavegavel): string | null {
  if (p.latitude !== null && p.longitude !== null)
    return `https://waze.com/ul?ll=${coordenada(p.latitude, p.longitude)}&navigate=yes`
  const texto = (p.endereco ?? '').trim()
  return texto ? `https://waze.com/ul?q=${encodeURIComponent(texto)}&navigate=yes` : null
}

/** "Paradas 1 a 9" / "Parada 10 e a volta" — o nome de gente de cada parte. */
export function rotuloDaParte(parte: ParteDaRota, total: number): string {
  if (parte.primeira === 0) return 'A volta para a fábrica'
  const paradas =
    parte.primeira === parte.ultima
      ? `Parada ${parte.primeira}`
      : `Paradas ${parte.primeira} a ${parte.ultima}`
  if (total === 1) return 'Abrir a rota no Google Maps'
  return parte.comVolta ? `${paradas} e a volta` : paradas
}
