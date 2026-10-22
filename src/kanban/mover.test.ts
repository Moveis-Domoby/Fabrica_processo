import { describe, expect, it } from 'vitest'
import { mostraMover } from './mover'

// SESSAO-39 (D-173): quando o botão Mover aparece na janela do card.
describe('mostraMover', () => {
  const base = {
    card: { tipo: 'unidade' as const },
    vivo: true,
    papelDoSetor: 'producao' as const,
    tablet: false,
    ehLider: true,
    nivelLogistica: false,
  }

  it('aparece para o líder (ou admin) na peça e no card avulso de um setor de produção', () => {
    expect(mostraMover(base)).toBe(true)
    expect(mostraMover({ ...base, card: { tipo: 'avulso' } })).toBe(true)
  })

  it('não aparece para quem não é líder nem para o nível logística', () => {
    expect(mostraMover({ ...base, ehLider: false })).toBe(false)
    expect(mostraMover({ ...base, nivelLogistica: true })).toBe(false)
  })

  it('no tablet aparece pelo estado — o banco decide com o PIN', () => {
    expect(mostraMover({ ...base, tablet: true, ehLider: false })).toBe(true)
  })

  it('fica de fora o card do pedido, a reposição, o card fora da produção e o arquivado', () => {
    expect(mostraMover({ ...base, card: { tipo: 'pedido' } })).toBe(false)
    expect(mostraMover({ ...base, card: { tipo: 'reposicao' } })).toBe(false)
    expect(mostraMover({ ...base, papelDoSetor: 'terminal' })).toBe(false)
    expect(mostraMover({ ...base, papelDoSetor: 'entrada' })).toBe(false)
    expect(mostraMover({ ...base, papelDoSetor: null })).toBe(false)
    expect(mostraMover({ ...base, vivo: false })).toBe(false)
  })
})
