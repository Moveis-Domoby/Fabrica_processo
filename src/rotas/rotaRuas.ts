/**
 * A rota pelas ruas (SESSAO-28 — D-108/D-109/D-110): lógica pura, sem mapa e
 * sem rede, testada no Vitest. Quem desenha é o `MapaProgramacao`; quem busca
 * é `useRotaPelasRuas`.
 *
 * - A rota parte da FÁBRICA e volta para ela (respostas do dono, 02/10).
 * - A ordem sugerida é a do mais perto, começando da fábrica; a pessoa pode
 *   reordenar à mão (rascunho) e salvar (ordem salva). Quem decide é a pessoa —
 *   o cálculo só desenha e mede.
 * - A chave do cache é a sequência de pontos — o MESMO formato que a Edge
 *   Function `calcular-rota` monta (mudou um, muda o outro).
 */
import { distanciaKm, temPonto } from './proximidade'
import type { ComPonto, Ponto } from './proximidade'

/**
 * A fábrica da Móveis Domoby — Rua Tancredo Neves, Planalto, Natal-RN,
 * 59073-351 (endereço e print do mapa mandados pelo dono em 02/10). No mapa
 * aberto a rua está grafada "Trancredo"; o ponto foi tirado da geometria da rua
 * cruzada com o print, e o serviço de rotas o encaixa na própria Tancredo
 * Neves. Fixo de propósito (D-108): mudou a fábrica, muda aqui.
 */
export const FABRICA = {
  latitude: -5.848,
  longitude: -35.25428,
  nome: 'Fábrica Domoby',
  endereco: 'Rua Tancredo Neves · Planalto · Natal-RN',
} as const

/** Paradas de uma rota (fora a fábrica): até 40 por caminhão. */
export const MAXIMO_PARADAS = 40

/** A chave do cache: 'rota:carro:' + "lon,lat" com 5 casas, separados por ';'. */
export function chaveRota(pontos: Ponto[]): string {
  return `rota:carro:${pontos.map((p) => `${p.longitude.toFixed(5)},${p.latitude.toFixed(5)}`).join(';')}`
}

/**
 * Decodifica a linha da rota no formato compacto do serviço (polyline,
 * precisão 5) em pares [latitude, longitude] para o Leaflet.
 */
export function decodificarLinha(codificada: string, precisao = 5): [number, number][] {
  const fator = 10 ** precisao
  const pontos: [number, number][] = []
  let indice = 0
  let lat = 0
  let lon = 0
  const proximoValor = (): number | null => {
    let resultado = 0
    let deslocamento = 0
    let byte: number
    do {
      if (indice >= codificada.length) return null
      byte = codificada.charCodeAt(indice++) - 63
      resultado |= (byte & 0x1f) << deslocamento
      deslocamento += 5
    } while (byte >= 0x20)
    return resultado & 1 ? ~(resultado >> 1) : resultado >> 1
  }
  while (indice < codificada.length) {
    const dLat = proximoValor()
    const dLon = proximoValor()
    if (dLat === null || dLon === null) break
    lat += dLat
    lon += dLon
    pontos.push([lat / fator, lon / fator])
  }
  return pontos
}

/**
 * Continua uma ordem: a partir da última parada COM ponto de `base` (ou da
 * origem, se não houver), sempre o vizinho mais perto entre `resto`. Quem não
 * tem ponto no mapa vai para o fim, na ordem em que veio.
 */
function continuarSugestao<T extends ComPonto>(base: T[], resto: T[], origem: Ponto): T[] {
  const comPonto = resto.filter(temPonto)
  const semPonto = resto.filter((p) => !temPonto(p))
  const ordenadas: T[] = [...base]
  let atual: Ponto = [...base].reverse().find(temPonto) ?? origem
  while (comPonto.length > 0) {
    let indiceMaisPerto = 0
    let menor = Number.POSITIVE_INFINITY
    comPonto.forEach((candidata, i) => {
      const d = distanciaKm(atual, candidata)
      if (d < menor) {
        menor = d
        indiceMaisPerto = i
      }
    })
    const escolhida = comPonto.splice(indiceMaisPerto, 1)[0]
    ordenadas.push(escolhida)
    atual = escolhida
  }
  return [...ordenadas, ...semPonto]
}

/** A sugestão (D-109): o mais perto primeiro, começando da fábrica. */
export function ordemSugerida<T extends ComPonto>(paradas: T[], origem: Ponto = FABRICA): T[] {
  return continuarSugestao([], paradas, origem)
}

/**
 * A ordem que vale na tela, nesta precedência:
 *  1. o RASCUNHO da pessoa (reordenou e ainda não salvou);
 *  2. a ordem SALVA (paradas com `ordem`, crescente);
 *  3. a sugestão.
 * Quem não está no rascunho/na ordem salva (pedido novo) entra no fim, pela
 * sugestão a partir da última parada posicionada.
 */
export function ordemDaRota<T extends ComPonto & { ordem?: number | null }>(
  paradas: T[],
  opcoes: { rascunho?: number[] | null; origem?: Ponto } = {},
): T[] {
  const origem = opcoes.origem ?? FABRICA
  const porId = new Map(paradas.map((p) => [p.card_id, p]))
  let base: T[]
  if (opcoes.rascunho) {
    base = opcoes.rascunho.map((id) => porId.get(id)).filter((p): p is T => p !== undefined)
  } else {
    base = paradas
      .filter((p) => typeof p.ordem === 'number')
      .sort((a, b) => (a.ordem as number) - (b.ordem as number) || a.card_id - b.card_id)
  }
  const naBase = new Set(base.map((p) => p.card_id))
  return continuarSugestao(base, paradas.filter((p) => !naBase.has(p.card_id)), origem)
}

/** Sobe (−1) ou desce (+1) uma parada na lista de ids; fora dos limites, nada muda. */
export function moverParada(ids: number[], cardId: number, delta: -1 | 1): number[] {
  const i = ids.indexOf(cardId)
  const j = i + delta
  if (i < 0 || j < 0 || j >= ids.length) return ids
  const novo = [...ids]
  ;[novo[i], novo[j]] = [novo[j], novo[i]]
  return novo
}

/** Os pontos que vão ao serviço: fábrica → paradas com ponto, na ordem → fábrica. */
export function pontosDaRota<T extends ComPonto>(paradasEmOrdem: T[], origem: Ponto = FABRICA): Ponto[] {
  const comPonto = paradasEmOrdem.filter(temPonto)
  if (comPonto.length === 0) return []
  const ida = { latitude: origem.latitude, longitude: origem.longitude }
  return [ida, ...comPonto.map((p) => ({ latitude: p.latitude, longitude: p.longitude })), ida]
}

/** As distâncias em linha reta de cada trecho (o plano B quando o serviço falha). */
export function trechosEmLinhaReta(pontos: Ponto[]): number[] {
  return pontos.slice(1).map((p, i) => distanciaKm(pontos[i], p))
}

/** Tempo legível: "menos de 1 min", "8 min", "1 h 05 min". */
export function formatarDuracao(segundos: number): string {
  const minutos = Math.round(segundos / 60)
  if (minutos < 1) return 'menos de 1 min'
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return `${horas} h ${String(resto).padStart(2, '0')} min`
}

// ---------------------------------------------------------------------------
// Ajustes da SESSAO-28 (03/10 — D-111)
// ---------------------------------------------------------------------------

/**
 * A cor de cada caminhão no mapa e na lista ("Já programadas"): fixa por
 * caminhão, fora das cores de estado (verde/âmbar/vermelho) e do amarelo das
 * paradas. Hex de propósito — o Leaflet desenha a linha com o valor literal.
 */
export const CORES_CAMINHAO = ['#2563EB', '#7C3AED', '#DB2777', '#0891B2', '#92400E', '#4F46E5'] as const

export function corDoCaminhao(caminhaoId: number): string {
  return CORES_CAMINHAO[Math.abs(caminhaoId) % CORES_CAMINHAO.length]
}

/** A rota que se está montando (aba "Programar"): azul forte com contorno branco. */
export const COR_MONTAGEM = '#1D4ED8'

export type CriterioOrdem = 'entrega' | 'perto' | 'numero'

interface Candidato extends ComPonto {
  numero: number
  data_prevista: string | null
}

/**
 * A ordem da lista de pedidos sem programação (D-111): por padrão o dia de
 * entrega mais perto primeiro (sem previsão, no fim). "Mais perto": com
 * pedidos já na rota, o mais perto DELES (a menor distância a qualquer um) até
 * o mais longe; com nada marcado, o mais perto da fábrica. Quem não tem ponto
 * no mapa vai para o fim. Empate desempata pelo número do pedido.
 */
export function ordenarCandidatos<T extends Candidato>(
  lista: T[],
  criterio: CriterioOrdem,
  referencia: Ponto[] = [],
  origem: Ponto = FABRICA,
): T[] {
  const copia = [...lista]
  if (criterio === 'numero') return copia.sort((a, b) => a.numero - b.numero)
  if (criterio === 'entrega') {
    return copia.sort((a, b) => {
      if (a.data_prevista === b.data_prevista) return a.numero - b.numero
      if (a.data_prevista === null) return 1
      if (b.data_prevista === null) return -1
      return a.data_prevista < b.data_prevista ? -1 : 1
    })
  }
  const alvos = referencia.length > 0 ? referencia : [origem]
  const distancia = (p: T) =>
    temPonto(p) ? Math.min(...alvos.map((a) => distanciaKm(a, p))) : Number.POSITIVE_INFINITY
  const medida = new Map(copia.map((p) => [p.card_id, distancia(p)]))
  return copia.sort((a, b) => medida.get(a.card_id)! - medida.get(b.card_id)! || a.numero - b.numero)
}

/** Total de peças de uma lista de pedidos (frete não conta — vem do banco). */
export function somarPecas(lista: { total_unidades: number }[]): number {
  return lista.reduce((soma, p) => soma + (p.total_unidades || 0), 0)
}

/**
 * Corta a linha da rota (fábrica → … → fábrica) em trechos, um por perna, para
 * destacar um trecho no mapa. Para cada parada, em ordem, acha o PRIMEIRO
 * vértice da linha (depois do corte anterior) que chega a menos de 5 m da
 * menor distância até ela — o serviço encaixa a parada na rua mais perto, e a
 * linha passa por esse encaixe; uma passagem posterior (a volta) nunca chega
 * mais perto que o próprio encaixe. Linha sem vértices bastantes devolve vazio.
 */
export function separarTrechos(linha: [number, number][], pontos: Ponto[]): [number, number][][] {
  const pernas = pontos.length - 1
  if (pernas < 1 || linha.length < 2) return []
  if (pernas === 1) return [linha]
  const metros = (v: [number, number], p: Ponto) =>
    distanciaKm({ latitude: v[0], longitude: v[1] }, p) * 1000
  const cortes: number[] = [0]
  for (let k = 1; k < pernas; k++) {
    const inicio = cortes[cortes.length - 1]
    const restante = linha.length - (pernas - k) // deixa vértice para as próximas pernas
    let menor = Number.POSITIVE_INFINITY
    for (let j = inicio; j < restante; j++) menor = Math.min(menor, metros(linha[j], pontos[k]))
    let corte = inicio
    for (let j = inicio; j < restante; j++) {
      if (metros(linha[j], pontos[k]) <= menor + 5) {
        corte = j
        break
      }
    }
    cortes.push(Math.max(corte, inicio))
  }
  cortes.push(linha.length - 1)
  const trechos: [number, number][][] = []
  for (let k = 0; k < pernas; k++) trechos.push(linha.slice(cortes[k], cortes[k + 1] + 1))
  return trechos
}
