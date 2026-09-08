/**
 * Sugestão por proximidade (D-39): "pedidos que fazem sentido na mesma rota".
 * É lógica pura, sem mapa: distância em linha reta (haversine) do candidato
 * ao ponto selecionado mais perto. É SÓ SUGESTÃO — quem decide é a pessoa.
 * Roteirização de verdade (trânsito, ordem de parada) está fora do escopo.
 */

export interface Ponto {
  latitude: number
  longitude: number
}

export interface ComPonto {
  card_id: number
  latitude: number | null
  longitude: number | null
}

export interface Sugestao<T> {
  item: T
  distanciaKm: number
}

const RAIO_TERRA_KM = 6371

export function distanciaKm(a: Ponto, b: Ponto): number {
  const rad = (g: number) => (g * Math.PI) / 180
  const dLat = rad(b.latitude - a.latitude)
  const dLon = rad(b.longitude - a.longitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2
  return 2 * RAIO_TERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function temPonto<T extends ComPonto>(item: T): item is T & Ponto {
  return typeof item.latitude === 'number' && typeof item.longitude === 'number'
}

/**
 * Candidatos (não selecionados, com ponto) a até `raioKm` de ALGUM dos
 * selecionados, do mais perto ao mais longe, no máximo `maximo`.
 */
export function sugerirProximos<T extends ComPonto>(
  selecionados: T[],
  candidatos: T[],
  raioKm = 5,
  maximo = 10,
): Sugestao<T>[] {
  const pontosSelecionados = selecionados.filter(temPonto)
  if (pontosSelecionados.length === 0) return []
  const idsSelecionados = new Set(selecionados.map((s) => s.card_id))

  const sugestoes: Sugestao<T>[] = []
  for (const candidato of candidatos) {
    if (idsSelecionados.has(candidato.card_id) || !temPonto(candidato)) continue
    const menor = Math.min(...pontosSelecionados.map((s) => distanciaKm(s, candidato)))
    if (menor <= raioKm) sugestoes.push({ item: candidato, distanciaKm: menor })
  }
  return sugestoes.sort((a, b) => a.distanciaKm - b.distanciaKm).slice(0, maximo)
}

/** Formata a distância para a lista: "850 m" / "2,3 km". */
export function formatarDistancia(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1).replace('.', ',')} km`
}
