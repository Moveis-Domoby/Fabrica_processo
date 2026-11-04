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
 *
 * ↪️ SESSAO-45 (pedido do dono, 04/11 — "a rota vai para o Google Maps com o
 * endereço errado", o 13784 e outros): o lugar de cada parada é o ENDEREÇO
 * ESCRITO do pedido (rua, número, bairro, cidade, UF e CEP — o que o cliente
 * informou na venda), e quem acha a casa é o próprio Google. Antes ia o ponto
 * da busca gratuita da plataforma, que é o MEIO da rua (às vezes a rua de
 * mesmo nome noutro bairro): o Google mostrava o endereço mais perto daquele
 * ponto — outro número, outra rua. O ponto só manda quando uma PESSOA o
 * confirmou: marcado à mão na Programação (`pontoConfirmado`) ou o pino da
 * parada avulsa. Sem endereço escrito, vai o ponto.
 */
import { FABRICA } from './rotaRuas'

export interface ParadaNavegavel {
  latitude: number | null
  longitude: number | null
  /** O endereço escrito, como o Google/Waze recebem. */
  endereco: string | null
  /** SESSAO-45: o ponto foi conferido por uma pessoa (pino marcado à mão) — manda sobre o texto. */
  pontoConfirmado?: boolean
}

/** O CEP com a máscara (59010-190); fora do formato, nada. */
function cepLegivel(cep: string | null | undefined): string | null {
  const d = (cep ?? '').replace(/\D/g, '')
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : null
}

/**
 * A parada a partir do pedido (o endereço de entrega — ou o do cadastro — e o
 * ponto do mapa). O texto no formato que o Google entende melhor:
 * "Rua X, 173 - Bairro, Cidade - UF, 59010-190".
 */
export function paradaNavegavel(e: {
  latitude: number | null
  longitude: number | null
  endereco: string | null
  numero_endereco: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  cep?: string | null
  /** SESSAO-45: o ponto foi marcado à mão por alguém da logística. */
  geo_manual?: boolean | null
  /** A parada avulsa: o pino foi posto por quem a criou. */
  ponto_confirmado?: boolean | null
}): ParadaNavegavel {
  const limpo = (t: string | null | undefined) => (t ?? '').trim() || null
  const rua = limpo(e.endereco)
  const ruaNumero = rua ? [rua, limpo(e.numero_endereco)].filter(Boolean).join(', ') : null
  const lugar = [limpo(e.cidade), limpo(e.uf)].filter(Boolean).join(' - ') || null
  const endereco =
    [
      [ruaNumero, limpo(e.bairro)].filter(Boolean).join(' - ') || null,
      lugar,
      cepLegivel(e.cep),
    ]
      .filter(Boolean)
      .join(', ') || null
  return {
    latitude: e.latitude,
    longitude: e.longitude,
    // sem a rua, o texto (só cidade/bairro) levaria ao centro da cidade — melhor o ponto
    endereco: rua ? endereco : e.latitude !== null && e.longitude !== null ? null : endereco,
    pontoConfirmado: Boolean(e.geo_manual || e.ponto_confirmado),
  }
}

/** Paradas intermediárias por link do Google Maps (o limite oficial fora do navegador do celular). */
export const PARADAS_POR_LINK = 9

/** O teto de tamanho que o Google aceita para um link do Maps. */
export const LINK_MAXIMO = 2048

const BASE_GOOGLE = 'https://www.google.com/maps/dir/?api=1'

/** A coordenada com 6 casas (~10 cm) e sem zeros sobrando: "-5.82,-35.22". */
function coordenada(latitude: number, longitude: number): string {
  const curta = (n: number) => String(Number(n.toFixed(6)))
  return `${curta(latitude)},${curta(longitude)}`
}

/**
 * O "lugar" da parada para o link: o ponto confirmado por uma pessoa; senão o
 * endereço escrito (o Google acha a casa); senão o ponto da busca.
 */
export function lugarDaParada(p: ParadaNavegavel): string | null {
  const temPonto = p.latitude !== null && p.longitude !== null
  if (temPonto && p.pontoConfirmado) return coordenada(p.latitude!, p.longitude!)
  const texto = (p.endereco ?? '').trim()
  if (texto.length > 0) return texto
  return temPonto ? coordenada(p.latitude!, p.longitude!) : null
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

type Ponto = { lugar: string | null; posicao: number | null }

/** Corta a sequência em partes de até `porLink` paradas; cada parte começa onde a anterior terminou. */
function partir(seq: Ponto[], porLink: number, volta: boolean): ParteDaRota[] {
  // Cada link leva no máximo origem + N paradas + destino. As partes saem
  // equilibradas (10 paradas e a volta = 6 + 5, nunca uma parte só com a volta).
  const saltos = seq.length - 1
  const quantas = Math.ceil(saltos / (porLink + 1))
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

/**
 * Os links do Google Maps para a rota, na ordem dada.
 * - `origem`: 'fabrica' (a rota como a plataforma montou — sai da fábrica) ou
 *   'aqui' (de onde o aparelho está — o entregador no meio do caminho).
 * - `volta`: termina na fábrica (padrão: sim — D-108).
 * Parada sem lugar (sem ponto e sem endereço) fica de fora do link. Endereço
 * escrito é mais comprido que o ponto: se algum link passaria do tamanho que o
 * Google aceita, as partes ficam menores (nunca um link cortado).
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
  const seq: Ponto[] = [
    { lugar: origem === 'fabrica' ? LUGAR_FABRICA : null, posicao: null },
    ...lugares.map((l) => ({ lugar: l.lugar, posicao: l.posicao })),
    ...(volta ? [{ lugar: LUGAR_FABRICA, posicao: null }] : []),
  ]
  for (let porLink = PARADAS_POR_LINK; porLink >= 1; porLink--) {
    const partes = partir(seq, porLink, volta)
    if (partes.every((p) => p.url.length <= LINK_MAXIMO) || porLink === 1) return partes
  }
  return []
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
  const lugar = lugarDaParada(p)
  if (!lugar) return null
  const ehPonto = p.latitude !== null && p.longitude !== null && lugar === coordenada(p.latitude, p.longitude)
  return ehPonto
    ? `https://waze.com/ul?ll=${lugar}&navigate=yes`
    : `https://waze.com/ul?q=${encodeURIComponent(lugar)}&navigate=yes`
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
