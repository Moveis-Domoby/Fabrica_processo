import { describe, expect, it } from 'vitest'
import { distanciaKm, formatarDistancia, sugerirProximos } from './proximidade'
import type { ComPonto } from './proximidade'

// Pontos reais de Natal-RN (Centro, Ponta Negra, Parnamirim) para o teste ter chão.
const centro: ComPonto & { latitude: number; longitude: number } = {
  card_id: 1,
  latitude: -5.795,
  longitude: -35.209,
}
const petropolis: ComPonto = { card_id: 2, latitude: -5.79, longitude: -35.195 }
const pontaNegra: ComPonto & { latitude: number; longitude: number } = {
  card_id: 3,
  latitude: -5.88,
  longitude: -35.17,
}
const parnamirim: ComPonto = { card_id: 4, latitude: -5.915, longitude: -35.263 }
const semPonto: ComPonto = { card_id: 5, latitude: null, longitude: null }

describe('distância em linha reta', () => {
  it('Centro → Ponta Negra fica na casa dos 10 km', () => {
    const d = distanciaKm(centro, pontaNegra)
    expect(d).toBeGreaterThan(9)
    expect(d).toBeLessThan(12)
  })

  it('o mesmo ponto dá zero', () => {
    expect(distanciaKm(centro, centro)).toBe(0)
  })
})

describe('sugestão por proximidade (só sugestão — a decisão é humana)', () => {
  it('sugere quem está no raio, do mais perto ao mais longe, sem repetir selecionados', () => {
    const sugestoes = sugerirProximos([centro], [centro, petropolis, pontaNegra, parnamirim, semPonto], 5)
    expect(sugestoes.map((s) => s.item.card_id)).toEqual([2])
    expect(sugestoes[0].distanciaKm).toBeLessThan(3)
  })

  it('com raio maior, ordena pela distância ao selecionado mais perto', () => {
    const sugestoes = sugerirProximos([centro, pontaNegra], [petropolis, parnamirim, semPonto], 20)
    expect(sugestoes.map((s) => s.item.card_id)).toEqual([2, 4])
  })

  it('sem selecionado com ponto, não sugere nada', () => {
    expect(sugerirProximos([semPonto], [centro, petropolis])).toEqual([])
    expect(sugerirProximos([], [centro])).toEqual([])
  })

  it('pedido sem ponto nunca entra na sugestão (Q-65)', () => {
    const sugestoes = sugerirProximos([centro], [semPonto], 100)
    expect(sugestoes).toEqual([])
  })

  it('respeita o máximo', () => {
    const muitos = Array.from({ length: 15 }, (_, i) => ({
      card_id: 100 + i,
      latitude: -5.795 + i * 0.001,
      longitude: -35.209,
    }))
    expect(sugerirProximos([centro], muitos, 50, 10)).toHaveLength(10)
  })
})

describe('formato da distância', () => {
  it('metros abaixo de 1 km, km com vírgula acima', () => {
    expect(formatarDistancia(0.85)).toBe('850 m')
    expect(formatarDistancia(2.34)).toBe('2,3 km')
  })
})
