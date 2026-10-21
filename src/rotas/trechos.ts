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

/**
 * SESSAO-38 (pedido do dono, ↩️ o "trecho aceso" da D-111): no lugar de escolher
 * UM trecho entre duas paradas, escolhe-se o trajeto — a rota inteira (padrão),
 * SÓ A IDA (fábrica → … → última parada) ou SÓ A VOLTA (última parada →
 * fábrica). O mapa não fica poluído pela linha da volta e cada um tem a sua
 * distância e o seu tempo.
 */
export type Trajeto = 'inteira' | 'ida' | 'volta'

export const OPCOES_TRAJETO: { valor: Trajeto; rotulo: string }[] = [
  { valor: 'inteira', rotulo: 'Rota inteira' },
  { valor: 'ida', rotulo: 'Só a ida' },
  { valor: 'volta', rotulo: 'Só a volta' },
]

/**
 * Os índices dos trechos de um trajeto. Os trechos da rota são um por perna:
 * fábrica → 1ª, 1ª → 2ª, …, última → fábrica (o último é a volta).
 */
export function trechosDoTrajeto(total: number, trajeto: Trajeto): number[] {
  const todos = Array.from({ length: Math.max(total, 0) }, (_, i) => i)
  if (trajeto === 'inteira' || total < 2) return todos
  return trajeto === 'ida' ? todos.slice(0, -1) : todos.slice(-1)
}

/** A soma de uns trechos: a distância sempre; o tempo só se todos têm tempo (pelas ruas). */
export function somarTrechos(trechos: Trecho[], indices: number[]): Trecho | null {
  const escolhidos = indices.map((i) => trechos[i]).filter((t): t is Trecho => t !== undefined)
  if (escolhidos.length === 0) return null
  const km = escolhidos.reduce((s, t) => s + t.km, 0)
  const segundos = escolhidos.every((t) => t.segundos !== null)
    ? escolhidos.reduce((s, t) => s + (t.segundos ?? 0), 0)
    : null
  return { km, segundos }
}

/** "Só a ida (fábrica → 3ª parada): 12,3 km · 25 min" — nulo na rota inteira ou sem paradas. */
export function resumoDoTrajeto(
  trajeto: Trajeto,
  trechos: Trecho[],
  numerosNoMapa: number[],
): string | null {
  if (trajeto === 'inteira' || numerosNoMapa.length === 0 || trechos.length < 2) return null
  const ultima = `${numerosNoMapa[numerosNoMapa.length - 1]}ª parada`
  const soma = somarTrechos(trechos, trechosDoTrajeto(trechos.length, trajeto))
  const texto = textoTrecho(soma ?? undefined) ?? '—'
  return trajeto === 'ida'
    ? `Só a ida (fábrica → ${ultima}): ${texto}`
    : `Só a volta (${ultima} → fábrica): ${texto}`
}
