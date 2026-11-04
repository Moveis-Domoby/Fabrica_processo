import { describe, expect, it } from 'vitest'
import {
  LINK_MAXIMO,
  PARADAS_POR_LINK,
  linkGoogleMapsParada,
  linkWaze,
  linksGoogleMaps,
  lugarDaParada,
  paradaNavegavel,
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

describe('SESSAO-45 — o Google acha a casa pelo ENDEREÇO do pedido; o ponto só manda se alguém o marcou', () => {
  const pedido = {
    latitude: -5.780046,
    longitude: -35.1994011,
    endereco: 'Rua Desembargador Lins Bahia',
    numero_endereco: '173',
    bairro: 'Rocas',
    cidade: 'Natal',
    uf: 'RN',
    cep: '59.010-190',
  }

  it('o 13784: vai o endereço escrito com o CEP (antes ia o meio da rua e o Google mostrava outro número)', () => {
    const p = paradaNavegavel(pedido)
    expect(p.endereco).toBe('Rua Desembargador Lins Bahia, 173 - Rocas, Natal - RN, 59010-190')
    expect(lugarDaParada(p)).toBe('Rua Desembargador Lins Bahia, 173 - Rocas, Natal - RN, 59010-190')
    const [parte] = linksGoogleMaps([p])
    expect(params(parte.url).get('waypoints')).toBe(
      'Rua Desembargador Lins Bahia, 173 - Rocas, Natal - RN, 59010-190',
    )
    expect(params(parte.url).get('destination')).toBe(fabrica)
    expect(params(parte.url).get('origin')).toBe(fabrica)
    expect(linkWaze(p)).toBe(
      `https://waze.com/ul?q=${encodeURIComponent('Rua Desembargador Lins Bahia, 173 - Rocas, Natal - RN, 59010-190')}&navigate=yes`,
    )
  })

  it('o ponto marcado à mão pela logística manda (o lugar exato que alguém conferiu)', () => {
    const p = paradaNavegavel({ ...pedido, geo_manual: true })
    expect(lugarDaParada(p)).toBe('-5.780046,-35.199401')
    expect(linkWaze(p)).toBe('https://waze.com/ul?ll=-5.780046,-35.199401&navigate=yes')
  })

  it('a parada avulsa com pino vai pelo pino; sem rua no cadastro, vai o ponto (o texto levaria ao centro da cidade)', () => {
    expect(
      lugarDaParada(
        paradaNavegavel({ latitude: -5.81, longitude: -35.22, endereco: 'Casa do bizotê', numero_endereco: null, bairro: null, cidade: null, uf: null, ponto_confirmado: true }),
      ),
    ).toBe('-5.81,-35.22')
    expect(
      lugarDaParada(
        paradaNavegavel({ latitude: -5.9, longitude: -35.3, endereco: null, numero_endereco: null, bairro: 'Centro', cidade: 'Macaíba', uf: 'RN' }),
      ),
    ).toBe('-5.9,-35.3')
  })

  it('endereços compridos: as partes encolhem para nenhum link passar do tamanho que o Google aceita', () => {
    const longo = (i: number) =>
      paradaNavegavel({
        ...pedido,
        endereco: `Avenida Senador Doutor Fulano de Tal e Coisa Comprida Número ${i}`,
        bairro: 'Residencial Jardins do Bosque das Colinas Verdes',
        cidade: 'São Gonçalo do Amarante',
      })
    const partes = linksGoogleMaps(Array.from({ length: 12 }, (_, i) => longo(i + 1)))
    for (const x of partes) expect(x.url.length).toBeLessThanOrEqual(LINK_MAXIMO)
    expect(partes[0].primeira).toBe(1)
    expect(partes[partes.length - 1].ultima).toBe(12)
    expect(partes[partes.length - 1].comVolta).toBe(true)
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
