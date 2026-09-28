import { describe, expect, it } from 'vitest'
import { chaveDoDia, horaNaLista, iniciais, previaDaConversa, rotuloDoDia } from './formato'
import { limitarPosicao, posicaoPadrao, TAMANHO_BALAO } from './posicao'

// 27/09/2026 15:00 em Natal = 18:00 UTC
const AGORA = new Date('2026-09-27T18:00:00Z')

describe('formatos do chat (fuso de Natal)', () => {
  it('na lista: hora hoje, "ontem", ou dia/mês', () => {
    expect(horaNaLista('2026-09-27T12:05:00Z', AGORA)).toBe('09:05')
    expect(horaNaLista('2026-09-26T20:00:00Z', AGORA)).toBe('ontem')
    expect(horaNaLista('2026-09-20T20:00:00Z', AGORA)).toBe('20/09')
  })

  it('o dia vira no fuso de Natal, não no UTC', () => {
    // 27/09 01:30 UTC ainda é 26/09 em Natal
    expect(chaveDoDia('2026-09-27T01:30:00Z')).toBe('2026-09-26')
    expect(rotuloDoDia('2026-09-27T01:30:00Z', AGORA)).toBe('Ontem')
    expect(rotuloDoDia('2026-09-27T12:00:00Z', AGORA)).toBe('Hoje')
    expect(rotuloDoDia('2026-09-01T12:00:00Z', AGORA)).toBe('01/09/2026')
  })

  it('a prévia diz quem falou — "Você" para a própria; na particular, só o texto', () => {
    expect(
      previaDaConversa({ tipo: 'canal', texto: 'oi', autorId: 'eu', autorNome: 'Wallace', eu: 'eu' }),
    ).toBe('Você: oi')
    expect(
      previaDaConversa({ tipo: 'canal', texto: 'oi', autorId: 'x', autorNome: 'Ana Maria', eu: 'eu' }),
    ).toBe('Ana: oi')
    expect(
      previaDaConversa({ tipo: 'particular', texto: 'oi', autorId: 'x', autorNome: 'Ana', eu: 'eu' }),
    ).toBe('oi')
    expect(
      previaDaConversa({ tipo: 'avisos', texto: 'parabéns', autorId: null, autorNome: null, eu: 'eu' }),
    ).toBe('Sistema: parabéns')
  })

  it('iniciais do avatar', () => {
    expect(iniciais('Wallace Cauan Silva')).toBe('WC')
    expect(iniciais('')).toBe('')
  })
})

describe('posição do balão', () => {
  it('nasce ao lado da bolinha de execução; no celular, acima da faixa do polegar', () => {
    expect(posicaoPadrao(1280)).toEqual({ direita: 88, baixo: 24 })
    expect(posicaoPadrao(375)).toEqual({ direita: 88, baixo: 80 })
  })

  it('arrastado para fora, volta inteiro para dentro da tela', () => {
    const tela = { largura: 375, altura: 700 }
    expect(limitarPosicao({ direita: -50, baixo: 5000 }, tela)).toEqual({
      direita: 8,
      baixo: 700 - TAMANHO_BALAO - 8,
    })
  })
})
