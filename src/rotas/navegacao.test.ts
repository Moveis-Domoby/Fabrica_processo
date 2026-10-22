import { describe, expect, it } from 'vitest'
import {
  PARADAS_POR_LINK,
  linkGoogleMapsParada,
  linkWaze,
  linksGoogleMaps,
  lugarDaParada,
  rotuloDaParte,
} from './navegacao'
import { FABRICA } from './rotaRuas'

const parada = (i: number) => ({
  latitude: -5.8 - i / 100,
  longitude: -35.2 - i / 100,
  endereco: null,
})
const fabrica = `${FABRICA.latitude},${FABRICA.longitude}`
const params = (url: string) => new URL(url).searchParams

describe('linksGoogleMaps — a rota da plataforma no Google Maps (SESSAO-39)', () => {
  it('rota pequena: um link só — da fábrica, as paradas NA ORDEM, de volta à fábrica', () => {
    const partes = linksGoogleMaps([parada(1), parada(2), parada(3)])
    expect(partes).toHaveLength(1)
    const p = params(partes[0].url)
    expect(partes[0].url.startsWith('https://www.google.com/maps/dir/?api=1&')).toBe(true)
    expect(p.get('origin')).toBe(fabrica)
    expect(p.get('destination')).toBe(fabrica)
    expect(p.get('waypoints')).toBe('-5.81,-35.21|-5.82,-35.22|-5.83,-35.23')
    expect(p.get('travelmode')).toBe('driving')
    expect(rotuloDaParte(partes[0], partes.length)).toBe('Abrir a rota no Google Maps')
  })

  it('até 9 paradas cabem num link; a 10ª divide em duas partes equilibradas, sem parte só com a volta', () => {
    expect(
      linksGoogleMaps(Array.from({ length: PARADAS_POR_LINK }, (_, i) => parada(i))),
    ).toHaveLength(1)
    const partes = linksGoogleMaps(Array.from({ length: 10 }, (_, i) => parada(i + 1)))
    expect(partes).toHaveLength(2)
    const [a, b] = partes.map((x) => params(x.url))
    // a 2ª parte começa onde a 1ª terminou
    expect(b.get('origin')).toBe(a.get('destination'))
    expect(b.get('destination')).toBe(fabrica)
    for (const p of [a, b])
      expect((p.get('waypoints') ?? '').split('|').length).toBeLessThanOrEqual(PARADAS_POR_LINK)
    expect(rotuloDaParte(partes[0], 2)).toBe('Paradas 1 a 6')
    expect(rotuloDaParte(partes[1], 2)).toBe('Paradas 7 a 10 e a volta')
  })

  it('a rota máxima da plataforma (40 paradas) sai em 5 partes, todas dentro do limite do Google', () => {
    const partes = linksGoogleMaps(Array.from({ length: 40 }, (_, i) => parada(i + 1)))
    expect(partes).toHaveLength(5)
    for (const x of partes) {
      expect((params(x.url).get('waypoints') ?? '').split('|').length).toBeLessThanOrEqual(
        PARADAS_POR_LINK,
      )
      expect(x.url.length).toBeLessThan(2048)
    }
    expect(partes[4].comVolta).toBe(true)
  })

  it('o entregador no caminho: sem origem (o Google usa onde o aparelho está), a numeração da tela', () => {
    const partes = linksGoogleMaps([parada(3), parada(4)], { origem: 'aqui', posicoes: [3, 4] })
    const p = params(partes[0].url)
    expect(p.has('origin')).toBe(false)
    expect(p.get('waypoints')).toBe('-5.83,-35.23|-5.84,-35.24')
    expect(p.get('destination')).toBe(fabrica)
    expect(partes[0].primeira).toBe(3)
    expect(partes[0].ultima).toBe(4)
  })

  it('parada sem ponto no mapa vai pelo endereço escrito; sem nada, fica de fora', () => {
    const semPonto = { latitude: null, longitude: null, endereco: 'Rua A, 10, Tirol, Natal, RN' }
    const nada = { latitude: null, longitude: null, endereco: '  ' }
    expect(lugarDaParada(semPonto)).toBe('Rua A, 10, Tirol, Natal, RN')
    expect(lugarDaParada(nada)).toBeNull()
    const partes = linksGoogleMaps([parada(1), nada, semPonto])
    expect(params(partes[0].url).get('waypoints')).toBe('-5.81,-35.21|Rua A, 10, Tirol, Natal, RN')
    expect(linksGoogleMaps([nada])).toEqual([])
  })
})

describe('uma parada só — Google Maps e Waze já navegando', () => {
  it('o Waze vai pela coordenada (ou pelo endereço) com a navegação ligada', () => {
    expect(linkWaze(parada(1))).toBe('https://waze.com/ul?ll=-5.81,-35.21&navigate=yes')
    expect(linkWaze({ latitude: null, longitude: null, endereco: 'Rua B, 2' })).toBe(
      'https://waze.com/ul?q=Rua%20B%2C%202&navigate=yes',
    )
    expect(linkWaze({ latitude: null, longitude: null, endereco: null })).toBeNull()
  })

  it('o Google Maps até a parada, de onde o aparelho está', () => {
    const p = params(linkGoogleMapsParada(parada(2))!)
    expect(p.has('origin')).toBe(false)
    expect(p.get('destination')).toBe('-5.82,-35.22')
    expect(p.get('dir_action')).toBe('navigate')
  })
})
