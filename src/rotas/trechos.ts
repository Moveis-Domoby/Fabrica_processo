import { formatarDistancia } from './proximidade'
import { formatarDuracao } from './rotaRuas'
import type { EstadoRota } from './useRotaPelasRuas'

/** Um trecho para mostrar: distância sempre; tempo só quando a rota é pelas ruas. */
export interface Trecho {
  km: number
  segundos: number | null
}

export function textoTrecho(t: Trecho | undefined): string | null {
  if (!t) return null
  return t.segundos === null
    ? `${formatarDistancia(t.km)} em linha reta`
    : `${formatarDistancia(t.km)} · ${formatarDuracao(t.segundos)}`
}

/**
 * Os trechos da rota: os do serviço (pelas ruas) ou, sem eles, em linha reta.
 * Enquanto a rota nova é calculada, os números são os da linha reta — os da
 * rota de antes seriam de outra ordem (só o DESENHO de antes fica na tela).
 */
export function trechosDaRota(estado: EstadoRota, emLinhaReta: number[]): Trecho[] {
  const rota = estado.estado === 'pronta' ? estado.rota : null
  if (rota && rota.trechos.length === emLinhaReta.length) {
    return rota.trechos.map((t) => ({ km: t.distancia_m / 1000, segundos: t.duracao_s }))
  }
  return emLinhaReta.map((km) => ({ km, segundos: null }))
}

/** "Trecho fábrica → 1ª parada" etc., pelos números da LISTA (parada sem ponto conta no número). */
export function nomeDoTrecho(indice: number, numerosNoMapa: number[]): string {
  const de = indice === 0 ? 'fábrica' : `${numerosNoMapa[indice - 1]}ª parada`
  const para = indice >= numerosNoMapa.length ? 'fábrica' : `${numerosNoMapa[indice]}ª parada`
  return `${de} → ${para}`
}
