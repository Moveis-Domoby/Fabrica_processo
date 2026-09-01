import { describe, expect, it } from 'vitest'
import { formatarValorMeta, fracaoDecorrida, percentualConcluido } from './progresso'

describe('percentualConcluido', () => {
  it('calcula o percentual inteiro', () => {
    expect(percentualConcluido(20, 28)).toBe(71)
    expect(percentualConcluido(47, 45)).toBe(104) // meta batida passa de 100
    expect(percentualConcluido(0, 10)).toBe(0)
  })
  it('não explode com alvo inválido', () => {
    expect(percentualConcluido(5, 0)).toBe(0)
  })
})

describe('fracaoDecorrida', () => {
  const inicio = '2026-09-01T03:00:00.000Z' // meia-noite em Fortaleza (UTC-3)
  const fim = '2026-09-02T03:00:00.000Z'
  it('meio-dia do período = metade decorrida', () => {
    expect(fracaoDecorrida(inicio, fim, new Date('2026-09-01T15:00:00.000Z'))).toBeCloseTo(0.5)
  })
  it('trava em 0 antes e em 1 depois da janela', () => {
    expect(fracaoDecorrida(inicio, fim, new Date('2026-08-31T00:00:00.000Z'))).toBe(0)
    expect(fracaoDecorrida(inicio, fim, new Date('2026-09-03T00:00:00.000Z'))).toBe(1)
  })
})

describe('formatarValorMeta', () => {
  it('contagens saem inteiras; horas com sufixo', () => {
    expect(formatarValorMeta(47, 'unidades')).toBe('47')
    expect(formatarValorMeta(2.25, 'tempo_util')).toBe('2,3h')
    expect(formatarValorMeta(40, 'tempo_util')).toBe('40h')
  })
})
