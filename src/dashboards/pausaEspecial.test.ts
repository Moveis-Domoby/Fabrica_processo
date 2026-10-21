import { describe, expect, it } from 'vitest'
import { motivosComMarca, trechoNaoConta } from './pausaEspecial'

describe('motivos de pausa especiais na dashboard (SESSAO-38)', () => {
  it('marca só os motivos especiais, inclusive com o detalhe escrito depois', () => {
    expect(
      motivosComMarca(
        ['Falta de material', 'Máquina quebrou', 'Faltou peça — a dobradiça'],
        ['Máquina quebrou', 'Faltou peça'],
      ),
    ).toEqual([
      'Falta de material',
      'Máquina quebrou (não conta)',
      'Faltou peça — a dobradiça (não conta)',
    ])
  })

  it('sem especiais (o próprio funcionário recebe a lista vazia), nada muda', () => {
    const motivos = ['Máquina quebrou', 'Almoço']
    expect(motivosComMarca(motivos)).toBe(motivos)
    expect(motivosComMarca(motivos, [])).toBe(motivos)
  })

  it('o trecho "não conta" só aparece com tempo', () => {
    const fmt = (s: number) => `${Math.round(s / 60)}min`
    expect(trechoNaoConta(1800, fmt)).toBe(' · não conta 30min')
    expect(trechoNaoConta(0, fmt)).toBe('')
    expect(trechoNaoConta(undefined, fmt)).toBe('')
  })
})
