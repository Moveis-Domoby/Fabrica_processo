import { describe, expect, it } from 'vitest'
import {
  FABRICA,
  chaveRota,
  corDoCaminhao,
  decodificarLinha,
  formatarDuracao,
  moverParada,
  ordemDaRota,
  ordemSugerida,
  ordenarCandidatos,
  pontosDaRota,
  separarTrechos,
  somarPecas,
  trechosEmLinhaReta,
} from './rotaRuas'
import type { ComPonto } from './proximidade'

type Parada = ComPonto & { ordem?: number | null }

// Pontos reais de Natal-RN, a partir da fábrica (Planalto): Parnamirim (7,5 km)
// e o Centro (7,7 km) perto, Ponta Negra e a Zona Norte longe — distâncias
// bem separadas para a ordem não depender de empate.
const parnamirim: Parada = { card_id: 4, latitude: -5.915, longitude: -35.263 }
const centro: Parada = { card_id: 1, latitude: -5.795, longitude: -35.209 }
const zonaNorte: Parada = { card_id: 6, latitude: -5.75, longitude: -35.25 }
const pontaNegra: Parada = { card_id: 3, latitude: -5.88, longitude: -35.17 }
const semPonto: Parada = { card_id: 5, latitude: null, longitude: null }

const ids = (lista: { card_id: number }[]) => lista.map((p) => p.card_id)

describe('a chave do cache da rota', () => {
  it('é a sequência de pontos (lon,lat com 5 casas) — o mesmo formato da função do servidor', () => {
    expect(
      chaveRota([
        { latitude: -5.848, longitude: -35.25428 },
        { latitude: -5.795, longitude: -35.209 },
        { latitude: -5.848, longitude: -35.25428 },
      ]),
    ).toBe('rota:carro:-35.25428,-5.84800;-35.20900,-5.79500;-35.25428,-5.84800')
  })

  it('a ordem muda a chave (reordenar recalcula; a mesma ordem usa o cache)', () => {
    const a = chaveRota([centro, zonaNorte] as never)
    const b = chaveRota([zonaNorte, centro] as never)
    expect(a).not.toBe(b)
    expect(chaveRota([centro, zonaNorte] as never)).toBe(a)
  })
})

describe('a linha da rota (formato compacto do serviço)', () => {
  it('decodifica o exemplo clássico do formato', () => {
    const pontos = decodificarLinha('_p~iF~ps|U_ulLnnqC_mqNvxq`@')
    expect(pontos).toEqual([
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ])
  })

  it('texto vazio dá linha vazia; texto cortado não quebra', () => {
    expect(decodificarLinha('')).toEqual([])
    expect(decodificarLinha('_p~iF~ps|U_ulL')).toEqual([[38.5, -120.2]])
  })
})

describe('a ordem sugerida parte da fábrica (D-109)', () => {
  it('a 1ª parada é a mais perto da fábrica; depois, sempre a vizinha mais perto', () => {
    expect(ids(ordemSugerida([centro, pontaNegra, parnamirim, zonaNorte]))).toEqual([4, 3, 1, 6])
  })

  it('quem não tem ponto no mapa vai para o fim', () => {
    expect(ids(ordemSugerida([semPonto, centro, parnamirim]))).toEqual([4, 1, 5])
  })
})

describe('a ordem que vale na tela', () => {
  const paradas = [centro, zonaNorte, pontaNegra, parnamirim]

  it('sem nada salvo, vale a sugestão', () => {
    expect(ids(ordemDaRota(paradas))).toEqual([4, 3, 1, 6])
  })

  it('a ordem SALVA vale; pedido novo (sem ordem) entra no fim, pela sugestão', () => {
    const salvas: Parada[] = [
      { ...centro, ordem: 1 },
      { ...parnamirim, ordem: 2 },
      { ...zonaNorte, ordem: null },
      { ...pontaNegra, ordem: null },
    ]
    // depois de Parnamirim (a última salva), a mais perto é Ponta Negra
    expect(ids(ordemDaRota(salvas))).toEqual([1, 4, 3, 6])
  })

  it('o RASCUNHO da pessoa passa por cima da ordem salva', () => {
    const salvas: Parada[] = [
      { ...centro, ordem: 1 },
      { ...parnamirim, ordem: 2 },
    ]
    expect(ids(ordemDaRota(salvas, { rascunho: [4, 1] }))).toEqual([4, 1])
  })

  it('rascunho com pedido que saiu da rota: ele some; o que entrou vai para o fim', () => {
    expect(ids(ordemDaRota([centro, zonaNorte, parnamirim], { rascunho: [6, 99, 1] }))).toEqual([6, 1, 4])
  })
})

describe('subir e descer paradas', () => {
  it('troca com a vizinha; nas pontas, nada muda', () => {
    expect(moverParada([1, 2, 3], 2, -1)).toEqual([2, 1, 3])
    expect(moverParada([1, 2, 3], 2, 1)).toEqual([1, 3, 2])
    expect(moverParada([1, 2, 3], 1, -1)).toEqual([1, 2, 3])
    expect(moverParada([1, 2, 3], 3, 1)).toEqual([1, 2, 3])
    expect(moverParada([1, 2, 3], 9, 1)).toEqual([1, 2, 3])
  })
})

describe('os pontos da rota: da fábrica à fábrica', () => {
  it('fábrica → paradas com ponto, na ordem → fábrica', () => {
    const pontos = pontosDaRota([centro, semPonto, parnamirim])
    expect(pontos).toHaveLength(4)
    expect(pontos[0]).toEqual({ latitude: FABRICA.latitude, longitude: FABRICA.longitude })
    expect(pontos[3]).toEqual(pontos[0])
    expect(pontos[1]).toEqual({ latitude: centro.latitude, longitude: centro.longitude })
  })

  it('sem nenhuma parada com ponto, não há rota', () => {
    expect(pontosDaRota([semPonto])).toEqual([])
  })

  it('em linha reta (plano B): um trecho a menos que os pontos', () => {
    const trechos = trechosEmLinhaReta(pontosDaRota([centro]))
    expect(trechos).toHaveLength(2)
    expect(trechos[0]).toBeCloseTo(trechos[1], 6)
    expect(trechos[0]).toBeGreaterThan(6)
    expect(trechos[0]).toBeLessThan(9)
  })
})

describe('o tempo na tela', () => {
  it('fala minutos e horas', () => {
    expect(formatarDuracao(20)).toBe('menos de 1 min')
    expect(formatarDuracao(480)).toBe('8 min')
    expect(formatarDuracao(3900)).toBe('1 h 05 min')
    expect(formatarDuracao(7200)).toBe('2 h 00 min')
  })
})

describe('ajustes de 03/10: a ordem da lista sem programação', () => {
  type P = Parada & { numero: number; data_prevista: string | null }
  const a: P = { ...centro, numero: 30, data_prevista: '2026-10-08' }
  const b: P = { ...parnamirim, numero: 10, data_prevista: '2026-10-05' }
  const c: P = { ...zonaNorte, numero: 20, data_prevista: null }
  const d: P = { ...semPonto, numero: 40, data_prevista: '2026-10-05' }
  const lista = [a, b, c, d]
  const numeros = (l: P[]) => l.map((p) => p.numero)

  it('padrão: o dia de entrega mais perto primeiro; empate pelo número; sem previsão no fim', () => {
    expect(numeros(ordenarCandidatos(lista, 'entrega'))).toEqual([10, 40, 30, 20])
  })

  it('"mais perto" sem nada na rota: da fábrica; sem ponto no fim', () => {
    expect(numeros(ordenarCandidatos(lista, 'perto'))).toEqual([10, 30, 20, 40])
  })

  it('"mais perto" com pedido na rota: do mais perto DELE até o mais longe', () => {
    // na rota: um ponto na Zona Norte → a Zona Norte, depois o Centro, Parnamirim por último
    expect(numeros(ordenarCandidatos([a, b, d], 'perto', [{ latitude: -5.75, longitude: -35.25 }]))).toEqual([30, 10, 40])
  })

  it('por número do pedido', () => {
    expect(numeros(ordenarCandidatos(lista, 'numero'))).toEqual([10, 20, 30, 40])
  })
})

describe('ajustes de 03/10: cor do caminhão, peças e trechos', () => {
  it('cada caminhão tem a sua cor, sempre a mesma', () => {
    expect(corDoCaminhao(7)).toBe(corDoCaminhao(7))
    expect(corDoCaminhao(1)).not.toBe(corDoCaminhao(2))
  })

  it('soma as peças da rota', () => {
    expect(somarPecas([{ total_unidades: 2 }, { total_unidades: 5 }])).toBe(7)
  })

  it('corta a linha nos encaixes das paradas: um trecho por perna, emendados', () => {
    // F (0) → A (2) → F: a linha vai e volta pelo mesmo caminho
    const linha: [number, number][] = [
      [-5.848, -35.254],
      [-5.84, -35.25],
      [-5.83, -35.24],
      [-5.84, -35.25],
      [-5.848, -35.254],
    ]
    const pontos = [
      { latitude: -5.848, longitude: -35.254 },
      { latitude: -5.8301, longitude: -35.2401 },
      { latitude: -5.848, longitude: -35.254 },
    ]
    const trechos = separarTrechos(linha, pontos)
    expect(trechos).toHaveLength(2)
    expect(trechos[0][trechos[0].length - 1]).toEqual([-5.83, -35.24])
    expect(trechos[1][0]).toEqual([-5.83, -35.24])
    expect(trechos[1][trechos[1].length - 1]).toEqual([-5.848, -35.254])
  })

  it('a volta que passa perto da 1ª parada não rouba o corte (vale a 1ª passagem)', () => {
    // F → A → B → F, e a volta de B passa de novo exatamente por A
    const linha: [number, number][] = [
      [0, 0],
      [0, 0.01], // A
      [0, 0.02], // B
      [0, 0.01], // passa por A na volta
      [0, 0],
    ]
    const p = (lon: number) => ({ latitude: 0, longitude: lon })
    const trechos = separarTrechos(linha, [p(0), p(0.01), p(0.02), p(0)])
    expect(trechos.map((t) => t.length)).toEqual([2, 2, 3])
  })

  it('sem linha suficiente, nada a cortar', () => {
    expect(separarTrechos([], [FABRICA, FABRICA])).toEqual([])
  })
})
