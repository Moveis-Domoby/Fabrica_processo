import { describe, expect, it } from 'vitest'
import {
  LARGURA_MAXIMA,
  LARGURA_MINIMA,
  lerLarguras,
  limitarLargura,
  modeloDaGrade,
} from './larguraColunas'

describe('larguras das colunas do calendário', () => {
  it('limita entre o mínimo e o máximo e arredonda', () => {
    expect(limitarLargura(10)).toBe(LARGURA_MINIMA)
    expect(limitarLargura(5000)).toBe(LARGURA_MAXIMA)
    expect(limitarLargura(150.6)).toBe(151)
  })

  it('lê do aparelho só uma lista com um número por coluna', () => {
    expect(lerLarguras(null, 7)).toBeNull()
    expect(lerLarguras('lixo', 7)).toBeNull()
    expect(lerLarguras('[100,120]', 7)).toBeNull()
    expect(lerLarguras('[100,"a",1,1,1,1,1]', 7)).toBeNull()
    expect(lerLarguras('[100,120,10,9999,150,150,150]', 7)).toEqual([
      100,
      120,
      LARGURA_MINIMA,
      LARGURA_MAXIMA,
      150,
      150,
      150,
    ])
  })

  it('monta o modelo da grade: iguais, por coluna e a que está sendo medida', () => {
    expect(modeloDaGrade(null, 7)).toBe('repeat(7, minmax(0, 1fr))')
    expect(modeloDaGrade([100, 200, 90], 3)).toBe('100px 200px 90px')
    expect(modeloDaGrade([100, 200, 90], 3, 1)).toBe('100px max-content 90px')
  })
})
